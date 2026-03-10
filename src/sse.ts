import type { Request, Response } from "express";

export type SseClient = Response;

type SseOptions = {
	retryMs: number;
	heartbeatMs: number;
};

const clients = new Set<SseClient>();
let heartbeatTimer: NodeJS.Timeout | null = null;

export function handleSseConnection(
	req: Request,
	res: Response,
	options: SseOptions,
): void {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");

	res.write(`retry: ${options.retryMs}\n\n`);

	clients.add(res);

	if (!heartbeatTimer) {
		heartbeatTimer = setInterval(() => {
			for (const client of clients) {
				client.write(": ping\n\n");
			}
		}, options.heartbeatMs);
	}

	req.on("close", () => {
		clients.delete(res);
		if (clients.size === 0 && heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
		res.end();
	});
}
