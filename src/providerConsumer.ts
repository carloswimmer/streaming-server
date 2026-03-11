import type { ProviderPayload } from "./ringBuffer.js";

type OnEventType = (payload: ProviderPayload) => void;

export interface ProviderConsumer {
	start(onEvent: OnEventType): Promise<void>;
	stop(): Promise<void>;
}

type PythonSseProviderOptions = {
	url: string; // ex: http://localhost:8000/stream
	maxReconnectMs: number; // ex: 30000
	headers?: Record<string, string>;
};

type MockProviderOptions = {
	intervalMs: number;
	maxReconnectMs: number;
	failEveryNEvents?: number; // simulates break down
};

export class PythonSseProviderConsumer implements ProviderConsumer {
	private running = false;
	private abortController: AbortController | null = null;
	private loopPromise: Promise<void> | null = null;

	constructor(private readonly options: PythonSseProviderOptions) {}

	async start(onEvent: OnEventType): Promise<void> {
		if (this.running) return;

		this.running = true;
		this.loopPromise = this.run(onEvent);
	}

	async stop(): Promise<void> {
		this.running = false;
		this.abortController?.abort();

		if (this.loopPromise) {
			await this.loopPromise.catch(() => {
				// ignore errors during shutdown
			});
		}

		this.abortController = null;
		this.loopPromise = null;
	}

	private async run(onEvent: OnEventType): Promise<void> {
		let attempt = 0;

		while (this.running) {
			try {
				await this.connectAndConsume(onEvent);
				attempt = 0; // reset when session ends gracefully
			} catch (error) {
				if (!this.running) break;

				const waitMs = computeBackoffWithJitter(
					attempt,
					this.options.maxReconnectMs,
				);
				console.error("[provider] disconnected, retrying", {
					attempt,
					waitMs,
					error: error instanceof Error ? error.message : String(error),
				});

				attempt += 1;
				await sleep(waitMs);
			}
		}
	}

	private async connectAndConsume(onEvent: OnEventType): Promise<void> {
		this.abortController = new AbortController();

		const response = await fetch(this.options.url, {
			method: "GET",
			headers: {
				Accept: "text/event-stream",
				...(this.options.headers ?? {}),
			},
			signal: this.abortController.signal,
		});

		if (!response.ok) {
			throw new Error(`Provider responded ${response.status}`);
		}

		if (!response.body) {
			throw new Error("Provider response has no body stream");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";

		while (this.running) {
			const { done, value } = await reader.read();
			if (done) {
				throw new Error("Provider stream ended");
			}

			buffer += decoder.decode(value, { stream: true });

			// SSE events are separated by blank line
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";

			for (const part of parts) {
				const dataText = parseEventData(part);
				if (!dataText) continue;

				let payload: ProviderPayload;
				try {
					payload = JSON.parse(dataText) as ProviderPayload;
				} catch {
					console.warn("[provider] invalid JSON in SSE data");
					continue;
				}

				// time-series requirement: ensure timestamp exists
				if (typeof payload.timestamp !== "number") {
					payload.timestamp = Date.now();
				}

				onEvent(payload);
			}
		}
	}
}

export class MockProviderConsumer implements ProviderConsumer {
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private seq = 0;

	constructor(private readonly options: MockProviderOptions) {}

	async start(onEvent: OnEventType): Promise<void> {
		if (this.running) return;
		this.running = true;
		void this.run(onEvent);
	}

	private async run(onEvent: OnEventType): Promise<void> {
		let attempt = 0;

		while (this.running) {
			try {
				await this.connectAndStream(onEvent);
				attempt = 0;
			} catch (error) {
				const waitMs = computeBackoffWithJitter(
					attempt,
					this.options.maxReconnectMs,
				);
				console.error("[provider] disconnected, retrying", {
					attempt,
					waitMs,
					error,
				});
				attempt += 1;
				await sleep(waitMs);
			}
		}
	}

	private async connectAndStream(onEvent: OnEventType): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.timer = setInterval(() => {
				this.seq += 1;

				// simulates periodic break down to validate retries
				if (
					this.options.failEveryNEvents &&
					this.seq % this.options.failEveryNEvents === 0
				) {
					if (this.timer) clearInterval(this.timer);
					this.timer = null;
					reject(new Error("Simulated provider disconnect"));
					return;
				}

				onEvent({
					series: "temperature",
					sensorId: "sensor-a",
					value: 20 + Math.random() * 5,
					unit: "C",
					timestamp: Date.now(),
				});
			}, this.options.intervalMs);
		});
	}

	async stop(): Promise<void> {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}
}

function parseEventData(rawEventBlock: string): string | null {
	// SSE event block: multiple lines separated by \n, blank line ends event
	// We care only about one or more "data:" lines.
	const lines = rawEventBlock.split("\n");
	const dataLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("data:")) {
			dataLines.push(line.slice(5).trimStart());
		}
	}

	if (dataLines.length === 0) return null;
	return dataLines.join("\n");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffWithJitter(attempt: number, maxMs: number): number {
	const base = Math.min(1000 * 2 ** attempt, maxMs); // 1s,2s,4s...
	const jitter = Math.floor(Math.random() * 300); // 0-299ms
	return base + jitter;
}
