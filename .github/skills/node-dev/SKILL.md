---
name: node-dev
description: 'Node.js backend development, debugging, and testing guidance. Use when working on Express, Fastify, NestJS, or Koa APIs, REST endpoints, middleware, async error handling, ESM vs CommonJS, environment config, databases (Prisma, Mongoose, TypeORM), memory leaks, or Supertest API tests.'
---

# Node.js Development

## Project Structure
- Layered: `routes/` → `controllers/` (HTTP only) → `services/` (business logic) → `repositories/`/data layer.
- Export the app separately from `listen()` (`app.ts` vs `server.ts`) so tests can import it.
- Validate config at startup (e.g. `zod` schema over `process.env`); fail fast on missing values.
- Respect module type: `"type": "module"` in `package.json` means ESM (`import`, `.js` extensions in relative imports for TS `NodeNext`).

## API Rules
- Validate every request body/query/params at the boundary (`zod`, `joi`, Fastify schemas, NestJS `ValidationPipe`).
- Centralized error handling middleware; never leak stack traces to clients in production.
- Always `await` async calls; in Express 4 wrap async handlers or forward errors with `next(err)` (Express 5 handles rejected promises).
- Parameterized queries / ORM methods only; never concatenate user input into SQL or shell commands.
- Security: `helmet`, restrictive CORS allow-list, rate limiting, hashed passwords (`bcrypt`/`argon2`), secrets from env, auth checks on every protected route.
- Graceful shutdown on `SIGTERM`: stop accepting requests, close DB pools, then exit.
- Structured logging (`pino`) instead of `console.log`.

## Debugging Checklist
| Symptom | Likely cause |
|---|---|
| Request hangs | handler never sends response, or missing `next()` |
| `UnhandledPromiseRejection` | missing `await` / `.catch`, error thrown in async middleware |
| `ERR_REQUIRE_ESM` / `Cannot use import statement` | ESM/CJS mismatch; check `type`, `tsconfig` `module`, file extensions |
| Memory grows over time | listeners never removed, unbounded caches, global arrays; profile with `node --inspect` + heap snapshots |
| High latency under load | sync CPU work or `fs.*Sync` on the event loop; move to worker threads/queues |
| Tests don't exit | open handles (DB, server, timers); run Jest with `--detectOpenHandles` |

Debug with `node --inspect` (or VS Code "JavaScript Debug Terminal").

## Testing (Supertest)
```ts
import request from 'supertest';
import { app } from '../src/app';

describe('POST /users', () => {
  it('rejects invalid email', async () => {
    const res = await request(app).post('/users').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });
});
```
- Unit-test services with mocked repositories; integration-test routes with Supertest and a test DB (Docker/Testcontainers or in-memory).
- Mock outbound HTTP with `msw` or `nock`. Close DB connections in `afterAll`.

## Recommendations
- Use an LTS Node version and pin it (`.nvmrc`, `engines`).
- TypeScript with `strict: true`; run `npm audit` regularly.
- Prefer Fastify or NestJS for new structured services; Express is fine for small apps.
