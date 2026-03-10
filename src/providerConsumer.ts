import type { ProviderPayload } from "./ringBuffer.js";

type OnEventType = (payload: ProviderPayload) => void;

export interface ProviderConsumer {
	start(onEvent: OnEventType): Promise<void>;
	stop(): Promise<void>;
}

type MockProviderOptions = {
	intervalMs: number;
};

export class MockProviderConsumer implements ProviderConsumer {
	private timer: NodeJS.Timeout | null = null;
	private seq = 0;

	constructor(private readonly options: MockProviderOptions) {}

	async start(onEvent: OnEventType): Promise<void> {
		if (this.timer) return;

		this.timer = setInterval(() => {
			this.seq += 1;

			onEvent({
				series: "temperature",
				sensorId: "sensor-a",
				value: 20 + Math.random() * 5,
				unit: "C",
				timestamp: Date.now(),
			});
		}, this.options.intervalMs);
	}

	async stop(): Promise<void> {
		if (!this.timer) return;
		clearInterval(this.timer);
		this.timer = null;
	}
}
