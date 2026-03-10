import type { Request, Response } from "express";
import type { StreamEvent } from "./ringBuffer.js";

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

export function serializeSseEvent<TPayload>(
	event: StreamEvent<TPayload>,
): string {
	const message = {
		...event.data,
		timestamp: event.timestamp,
	};

	return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(message)}\n\n`;
}

export function sendSseEvent<TPayload>(
	client: SseClient,
	event: StreamEvent<TPayload>,
): void {
	client.write(serializeSseEvent(event));
}

export function validateLastEventId(
	lastEventId: string | undefined,
): number | null {
	if (lastEventId === undefined) {
		return null;
	}

	const parsed = Number(lastEventId);

	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error("Invalid Last-Event-ID header");
	}

	return parsed;
}

export function broadcastSseEvent<TPayload>(
	event: StreamEvent<TPayload>,
): void {
	for (const client of clients) {
		sendSseEvent(client, event);
	}
}
