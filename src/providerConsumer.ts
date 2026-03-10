import { resolve } from "node:dns";
import type { ProviderPayload } from "./ringBuffer.js";

type OnEventType = (payload: ProviderPayload) => void;

export interface ProviderConsumer {
	start(onEvent: OnEventType): Promise<void>;
	stop(): Promise<void>;
}

type MockProviderOptions = {
	intervalMs: number;
	maxReconnectMs: number;
	failEveryNEvents?: number; // simulates break down
};

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffWithJitter(attempt: number, maxMs: number): number {
	const base = Math.min(1000 * 2 ** attempt, maxMs); // 1s,2s,4s...
	const jitter = Math.floor(Math.random() * 300); // 0-299ms
	return base + jitter;
}
