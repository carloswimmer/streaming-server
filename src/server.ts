import "dotenv/config";
import express, { type Request, type Response } from "express";
import { handleSseConnection } from "./sse.js";

type EnvConfig = {
	port: number;
	sseRetryMs: number;
	heartbeatMs: number;
};

function loadConfig(): EnvConfig {
	const port = Number(process.env.PORT ?? 3000);
	const sseRetryMs = Number(process.env.SSE_RETRY_MS ?? 2000);
	const heartbeatMs = Number(process.env.HEARTBEAT_MS);

	if (!Number.isFinite(port) || port <= 0) {
		throw new Error("Invalid PORT value in environment.");
	}

	if (!Number.isFinite(sseRetryMs) || sseRetryMs <= 0) {
		throw new Error("Invalid SSE_RETRY_MS value in environment.");
	}

	if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) {
		throw new Error("Invalid HEARTBEAT_MS value in environment.");
	}

	return { port, sseRetryMs, heartbeatMs };
}

const config = loadConfig();
const app = express();

app.get("/health", (_req: Request, res: Response) => {
	res.status(200).send("ok");
});

app.get("/events", (req: Request, res: Response) => {
	handleSseConnection(req, res, {
		retryMs: config.sseRetryMs,
		heartbeatMs: config.heartbeatMs,
	});
});

app.listen(config.port, () => {
	console.log(`Server listening on http://localhost:${config.port}`);
});
