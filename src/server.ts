import "dotenv/config";
import express, { type Request, type Response } from "express";
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
	const port = Number(process.env.PORT ?? 3000);
	const sseRetryMs = Number(process.env.SSE_RETRY_MS ?? 2000);
	const heartbeatMs = Number(process.env.HEARTBEAT_MS ?? 20000);
	const ringBufferSize = Number(process.env.RING_BUFFER_SIZE ?? 10000);
	const providerReconnectMaxMs = Number(
		process.env.PROVIDER_RECONNECT_MAX_MS ?? 30000,
	);

	if (!Number.isFinite(port) || port <= 0) {
		throw new Error("Invalid PORT value in environment.");
	}

	if (!Number.isFinite(sseRetryMs) || sseRetryMs <= 0) {
		throw new Error("Invalid SSE_RETRY_MS value in environment.");
	}

	if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) {
		throw new Error("Invalid HEARTBEAT_MS value in environment.");
	}

	if (!Number.isFinite(ringBufferSize) || ringBufferSize <= 0) {
		throw new Error("Invalid RING_BUFFER_SIZE value in environment.");
	}

	if (!Number.isFinite(providerReconnectMaxMs) || providerReconnectMaxMs <= 0) {
		throw new Error("Invalid PROVIDER_RECONNECT_MAX_MS value in environment.");
	}

	return {
		port,
		sseRetryMs,
		heartbeatMs,
		ringBufferSize,
		providerReconnectMaxMs,
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
