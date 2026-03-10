import express, { type Request, type Response } from "express";

type EnvConfig = {
	port: number;
	sseRetryMs: number;
};

function loadConfig(): EnvConfig {
	const port = Number(process.env.PORT ?? 3000);
	const sseRetryMs = Number(process.env.SSE_RETRY_MS ?? 2000);

	if (!Number.isFinite(port) || port <= 0) {
		throw new Error("Invalid PORT value in environment.");
	}

	if (!Number.isFinite(sseRetryMs) || sseRetryMs <= 0) {
		throw new Error("Invalid SSE_RETRY_MS value in environment.");
	}

	return { port, sseRetryMs };
}

const config = loadConfig();
const app = express();
const clients = new Set<Response>();

app.get("/health", (_req: Request, res: Response) => {
	res.status(200).send("ok");
});

app.get("/events", (req: Request, res: Response) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");

	res.write(`retry: ${config.sseRetryMs}\n\n`);

	clients.add(res);

	req.on("close", () => {
		clients.delete(res);
		res.end();
	});
});

app.listen(config.port, () => {
	console.log(`Server listening on http://localhost:${config.port}`);
});
