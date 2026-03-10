# Plano de Implementacao - Streaming Server Node.js com TypeScript (sem broker)

## Visao geral

Objetivo: construir um streaming server em Node.js + TypeScript que:

1. Exponha endpoint `GET /events` com SSE.
2. Envie heartbeat periodico.
3. Suporte `Last-Event-ID` para replay.
4. Use ring buffer em memoria.
5. Consuma eventos de um provedor com reconexao automatica.

Fluxo final:

`Servidor Provedor -> consumidor no Node.js -> ring buffer em memoria -> /events (SSE) -> clientes`

---

## Fase 0 - Preparacao do projeto (TypeScript)

### Passo 1) Criar repositorio local

```bash
git init
npm init -y
```

### Passo 2) Definir stack minima

Dependencias de runtime:

- `express` (HTTP server)
- `dotenv` (configuracoes por ambiente)
- `pino` (logs)

Dependencias de desenvolvimento:

- `typescript`
- `tsx` (runner TS para desenvolvimento)
- `@types/node`
- `@types/express`

```bash
npm i express dotenv pino
npm i -D typescript tsx @types/node @types/express
```

### Passo 3) Inicializar TypeScript

```bash
npx tsc --init
```

Depois ajuste o `tsconfig.json` para um setup simples de Node:

- `target`: `ES2022`
- `module`: `NodeNext`
- `moduleResolution`: `NodeNext`
- `rootDir`: `src`
- `outDir`: `dist`
- `strict`: `true`
- `esModuleInterop`: `true`
- `skipLibCheck`: `true`

### Passo 4) Criar estrutura de pastas

Crie:

- `src/server.ts`
- `src/sse.ts`
- `src/ringBuffer.ts`
- `src/providerConsumer.ts`
- `src/eventBus.ts`
- `.env.example`
- `.gitignore`
- `README.md`

No `.gitignore`, inclua:

- `node_modules/`
- `dist/`
- `.env`

### Passo 5) Configurar scripts do `package.json`

Sugestao:

- `dev`: `tsx watch src/server.ts`
- `build`: `tsc -p tsconfig.json`
- `start`: `node dist/server.js`

Criterio de concluido:

- `npm run dev` inicia em TypeScript.
- `npm run build` gera `dist/` sem erros.

---

## Fase 1 - Base do servidor e SSE

### Passo 6) Subir servidor HTTP

No `server.ts`:

- criar app Express
- criar endpoint `GET /health` retornando `ok`
- criar endpoint `GET /events` (inicial)

Tipagem recomendada:

- usar `Request` e `Response` do Express
- criar tipo para configuracoes (`EnvConfig`)

Criterio de concluido:

- `curl http://localhost:3000/health` retorna status 200.

### Passo 7) Implementar SSE no `/events`

No endpoint SSE:

- headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
- enviar `retry: 2000\n\n` ao conectar
- manter clientes conectados em `Set<Response>`

Criterio de concluido:

- `curl -N http://localhost:3000/events` permanece conectado.

---

## Fase 2 - Heartbeat e ciclo de conexoes

### Passo 8) Implementar heartbeat

No `sse.ts`:

- timer global a cada 20s
- enviar `: ping\n\n` para todos os clientes
- no `close` da requisicao, remover cliente do `Set`

Tipagem recomendada:

- tipo `SseClient = Response`
- evitar `any` no gerenciamento de conexoes

Criterio de concluido:

- `curl -N` recebe ping periodico e desconexao limpa cliente sem erros.

---

## Fase 3 - Ring buffer + Last-Event-ID

### Passo 9) Criar ring buffer em memoria

No `ringBuffer.ts`:

- estrutura com capacidade fixa (ex.: 10000)
- metodo `push(event)`
- metodo `getAfterId(lastEventId)` para replay
- modelo de evento tipado:
  - `id` (numero crescente)
  - `type` (ex.: `update`)
  - `data` (objeto)
  - `timestamp` (opcional, recomendado)

Exemplo de tipos:

- `ProviderPayload`
- `StreamEvent<TPayload>`

Criterio de concluido:

- ao ultrapassar capacidade, descarta eventos mais antigos automaticamente.

### Passo 10) Integrar `Last-Event-ID`

No `GET /events`:

- ler header `Last-Event-ID`
- validar e converter para numero
- se existir, reenviar eventos posteriores via ring buffer
- depois entrar no fluxo em tempo real
- criar uma funcao unica para serializacao SSE:
  - `id: ...`
  - `event: ...`
  - `data: ...`
  - linha em branco ao final

Criterio de concluido:

- reconexao com `Last-Event-ID` recebe apenas eventos perdidos.

---

## Fase 4 - Consumidor do provedor com reconexao

### Passo 11) Criar adaptador do provedor

No `providerConsumer.ts`, definir interface tipada:

- `start(onEvent: (payload: ProviderPayload) => void): Promise<void>`
- `stop(): Promise<void>`

No `onEvent(payload)`:

1. gerar `eventId` monotonicamente crescente
2. armazenar no ring buffer
3. publicar para clientes SSE conectados

### Passo 12) Reconexao automatica

No consumidor:

- detectar falhas/desconexao
- aplicar backoff exponencial com jitter (1s, 2s, 4s ... ate 30s)
- resetar backoff ao reconectar com sucesso
- logar tentativas e erros

Boa pratica:

- encapsular retry em funcao utilitaria tipada

Criterio de concluido:

- ao derrubar provedor, consumidor tenta reconectar sem travar servidor.

---

## Fase 5 - Observabilidade e robustez minima

### Passo 13) Logs e metricas basicas

Registrar:

- clientes conectados
- eventos recebidos do provedor
- eventos enviados por SSE
- reconexoes do consumidor

Endpoints:

- `GET /metrics` (JSON simples)
- `GET /health`

Criterio de concluido:

- diagnostico rapido de gargalo entre provedor, buffer e entrega.

---

## Fase 6 - Testes manuais guiados

### Passo 14) Checklist de validacao

1. **Conexao SSE**
   - `curl -N http://localhost:3000/events`
2. **Heartbeat**
   - confirmar `: ping` a cada ~20s
3. **Tempo real**
   - simular chegada de eventos e observar entrega imediata
4. **Reconexao**
   - interromper provedor e validar retries com backoff
5. **Last-Event-ID**
   - desconectar, gerar eventos, reconectar e validar replay
6. **Overflow do buffer**
   - gerar mais eventos que a capacidade e validar descarte dos antigos
7. **Build TypeScript**
   - executar `npm run build` e validar geracao de `dist/`

---

## Fase 7 - Versionamento no GitHub

### Passo 15) Commits por marco

Sugestao de historico:

1. `chore: bootstrap typescript project`
2. `feat: add SSE endpoint`
3. `feat: add heartbeat and client lifecycle`
4. `feat: add ring buffer and Last-Event-ID replay`
5. `feat: add provider consumer with reconnect strategy`
6. `build: add ts build and start scripts`
7. `docs: add README with run and test guide`

### Passo 16) Publicar no GitHub

- criar repositorio no GitHub
- adicionar remote
- enviar branch principal

No `README.md`, documentar:

- como rodar localmente (`npm run dev`)
- como compilar (`npm run build`)
- como rodar build (`npm start`)
- variaveis de ambiente
- como testar com `curl -N`
- limitacoes do design (buffer em memoria, sem persistencia)

---

## Configuracao inicial recomendada

- `PORT=3000`
- `HEARTBEAT_MS=20000`
- `RING_BUFFER_SIZE=10000`
- `SSE_RETRY_MS=2000`
- `PROVIDER_RECONNECT_MAX_MS=30000`

---

## Armadilhas comuns

- esquecer linha em branco no fim de cada evento SSE
- nao remover cliente no `req.on("close")`
- nao validar `Last-Event-ID` invalido
- fazer reconnect sem jitter
- enviar payloads muito grandes em alta frequencia
- usar `any` em partes criticas e perder seguranca de tipos
- nao rodar `npm run build` antes de publicar

---

## Proximo passo sugerido

Seguir este planner implementando fase por fase e abrindo PRs pequenas por marco, facilitando revisao e rollback.
