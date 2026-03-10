export type ProviderPayload = Record<string, unknown>;

export type StreamEvent<TPayload = ProviderPayload> = {
	id: number;
	type: string;
	data: TPayload;
	timestamp: number;
};

export class RingBuffer<TPayload = ProviderPayload> {
	private readonly capacity: number;
	private events: Array<StreamEvent<TPayload>> = [];

	constructor(capacity: number) {
		if (!Number.isInteger(capacity) || capacity <= 0) {
			throw new Error("RingBuffer capacity must be a positive integer.");
		}

		this.capacity = capacity;
	}

	push(event: StreamEvent<TPayload>): void {
		this.events.push(event);

		if (this.events.length > this.capacity) {
			this.events.shift();
		}
	}

	getAfterId(lastEventId: number): Array<StreamEvent<TPayload>> {
		return this.events.filter((event) => event.id > lastEventId);
	}

	size(): number {
		return this.events.length;
	}

	peekAll(): Array<StreamEvent<TPayload>> {
		return [...this.events];
	}
}
