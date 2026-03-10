# Streaming Server (Node.js + TypeScript + SSE)

A Node.js + TypeScript streaming server that receives real-time updates from a provider server and forwards them to clients using Server-Sent Events (SSE).

## Goal

This project implements:

1. `GET /events` SSE endpoint
2. Periodic heartbeat
3. `Last-Event-ID` support
4. In-memory ring buffer for recent replay
5. Automatic provider consumer reconnection

Flow:

`Provider Server -> Node.js consumer -> ring buffer -> /events (SSE) -> clients`

---

## Requirements

- Node.js 20+
- npm 10+

---

## Initial Setup (TypeScript)

If you are starting from an empty directory:

```bash
git init
npm init -y
npm i express dotenv pino
npm i -D typescript tsx @types/node @types/express
npx tsc --init
```

Create the base structure:

- `src/server.ts`
- `src/sse.ts`
- `src/ringBuffer.ts`
- `src/providerConsumer.ts`
- `src/eventBus.ts`
- `.env.example`

Recommended `tsconfig.json`:

- `target`: `ES2022`
- `module`: `NodeNext`
- `moduleResolution`: `NodeNext`
- `rootDir`: `src`
- `outDir`: `dist`
- `strict`: `true`
- `esModuleInterop`: `true`
- `skipLibCheck`: `true`

---

## Environment Variables

Create a `.env` file based on `.env.example`.

Initial suggestion:

```env
PORT=3000
HEARTBEAT_MS=20000
RING_BUFFER_SIZE=10000
SSE_RETRY_MS=2000
PROVIDER_RECONNECT_MAX_MS=30000
```

### What each variable does

- `PORT`: application HTTP port.
- `HEARTBEAT_MS`: SSE heartbeat interval (`: ping`).
- `RING_BUFFER_SIZE`: maximum number of events kept in memory.
- `SSE_RETRY_MS`: value sent to clients for SSE reconnect.
- `PROVIDER_RECONNECT_MAX_MS`: max reconnection backoff for provider consumer.

---

## Scripts (package.json)

Suggested scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js"
  }
}
```

---

## How to Run

Development (TypeScript with watch):

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run built output:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Connect to SSE:

```bash
curl -N http://localhost:3000/events
```

---

## Expected SSE Event Format

Each event should follow:

```txt
id: 123
event: update
data: {"foo":"bar"}

```

Notes:

- The blank line at the end of each event block is mandatory.
- Heartbeat can be sent as a comment:

```txt
: ping

```

---

## Recommended Manual Tests

1. **SSE Connection**
   - connect with `curl -N` and validate persistent connection.
2. **Heartbeat**
   - confirm periodic `: ping` messages.
3. **Real-time delivery**
   - generate an event in the consumer and confirm immediate broadcast.
4. **Last-Event-ID**
   - reconnect with the last id and validate replay.
5. **Provider reconnection**
   - interrupt the event source and verify backoff + reconnect.
6. **Ring buffer overflow**
   - exceed capacity and validate old event eviction.
7. **Build TypeScript**
   - run `npm run build` and validate `dist/` output generation.

---

## Versioning Strategy (Suggestion)

Milestone-based commits:

1. `chore: bootstrap node project`
2. `feat: add SSE endpoint`
3. `feat: add heartbeat and client lifecycle`
4. `feat: add ring buffer and Last-Event-ID replay`
5. `feat: add provider consumer with reconnect strategy`
6. `build: add ts build and start scripts`
7. `docs: add README with run and test guide`

---

## Current Limitations (No Broker)

- In-memory ring buffer (no disk persistence).
- Events can be lost on process restart.
- Horizontal scaling requires an additional strategy (for example, a broker in the future).
- It is recommended to run `npm run build` before every release.

---

## Roadmap

The complete phased implementation plan is available in:

- `PLANNER.md`

