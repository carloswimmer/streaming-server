import "dotenv/config";
import express, { type Request, type Response } from "express";
import { readPositiveNumberEnv } from "./helper/readPositiveNumberEnv.js";
import { startIngestion } from "./ingestion.js";
import { tempTestEvents } from "./mock/temp-test-events.js";
import { MockProviderConsumer } from "./providerConsumer.js";
import {
	type ProviderPayload,
	RingBuffer,
	type StreamEvent,
} from "./ringBuffer.js";
import {
	broadcastSseEvent,
	handleSseConnection,
	sendSseEvent,
	validateLastEventId,
} from "./sse.js";

type EnvConfig = {
	port: number;
	sseRetryMs: number;
	heartbeatMs: number;
	ringBufferSize: number;
	providerReconnectMaxMs: number;
};

function loadConfig(): EnvConfig {
	return {
		port: readPositiveNumberEnv("PORT", 3000),
		sseRetryMs: readPositiveNumberEnv("SSE_RETRY_MS", 2000),
		heartbeatMs: readPositiveNumberEnv("HEARTBEAT_MS", 20000),
		ringBufferSize: readPositiveNumberEnv("RING_BUFFER_SIZE", 10000),
		providerReconnectMaxMs: readPositiveNumberEnv(
			"PROVIDER_RECONNECT_MAX_MS",
			30000,
		),
	};
}

const config = loadConfig();
const app = express();
const ringBuffer = new RingBuffer<ProviderPayload>(config.ringBufferSize);

// For dev purpose
const provider = new MockProviderConsumer({
	intervalMs: 3000,
	maxReconnectMs: config.providerReconnectMaxMs,
	failEveryNEvents: 5,
});
const seedEvents = tempTestEvents;

startIngestion({
	provider,
	ringBuffer,
	broadcast: broadcastSseEvent,
	seedEvents,
});

app.get("/health", (_req: Request, res: Response) => {
	res.status(200).send("ok");
});

app.get("/events", (req: Request, res: Response) => {
	try {
		const lastEventId = validateLastEventId(req.header("Last-Event-ID"));

		handleSseConnection(req, res, {
			retryMs: config.sseRetryMs,
			heartbeatMs: config.heartbeatMs,
		});

		if (lastEventId !== null) {
			const missed = ringBuffer.getAfterId(lastEventId);
			for (const event of missed) {
				sendSseEvent(res, event);
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Invalid Last-Event-ID header";
		res.status(400).json({ error: message });
	}
});

app.listen(config.port, () => {
	console.log(`Server listening on http://localhost:${config.port}`);
});
