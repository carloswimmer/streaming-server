import type { ProviderConsumer } from "./providerConsumer.js";
import type { ProviderPayload, RingBuffer, StreamEvent } from "./ringBuffer.js";

type StartIngestionDeps = {
	provider: ProviderConsumer;
	ringBuffer: RingBuffer<ProviderPayload>;
	broadcast: (event: StreamEvent<ProviderPayload>) => void;
	eventType?: string;
	seedEvents?: Array<StreamEvent<ProviderPayload>>;
};

export async function startIngestion({
	provider,
	ringBuffer,
	broadcast,
	eventType = "timeseries.update",
	seedEvents = [],
}: StartIngestionDeps): Promise<{ stop: () => Promise<void> }> {
	// opcional para dev/test
	for (const event of seedEvents) {
		ringBuffer.push(event);
	}

	const seeded = ringBuffer.peekAll();
	let nextEventId = seeded.length > 0 ? seeded[seeded.length - 1].id : 0;

	await provider.start((payload) => {
		const event: StreamEvent<ProviderPayload> = {
			id: ++nextEventId,
			type: eventType,
			data: payload,
			timestamp:
				typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
		};

		ringBuffer.push(event);
		broadcast(event);
	});

	return {
		stop: async () => {
			await provider.stop();
		},
	};
}
