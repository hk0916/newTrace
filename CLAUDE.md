# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev              # Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run ws:dev           # WebSocket server with watch (localhost:8080)
npm run ws:start         # WebSocket server without watch

npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:migrate       # Run pending migrations
npm run db:push          # Push schema directly (skip migrations)
npm run db:studio        # Drizzle Studio GUI
npm run db:seed          # Seed database (npx tsx scripts/seed.ts)
```

Both `npm run dev` and `npm run ws:dev` must be running for full functionality.

## Project Structure

- `/app` — Next.js App Router (routes, layouts, pages)
- `/app/api` — Backend API routes
- `/app/dashboard` — Dashboard UI pages
- `/components` — Reusable React components (`/components/ui` for shadcn/ui)
- `/lib` — Utility functions, database client, auth, validators
- `/server` — Standalone WebSocket server

## Coding Standards

- Use TypeScript strict mode
- Prefer server components over client components
- Use `async/await` instead of `.then()`
- Always validate user input with Zod (schemas in `lib/validators/`)

## DO NOT

- Never commit `.env` files
- Never use `any` type in TypeScript
- Never bypass authentication checks
- Never expose API keys in client code

## Architecture

**BLE asset tracking platform** with multi-tenant support. Two separate processes:

1. **Next.js App** (port 3000) — Dashboard UI + REST API
2. **Standalone WebSocket Server** (port 8080) — Receives binary BLE data from physical gateways

### Multi-Tenancy & RBAC

Three roles: `super`, `admin`, `user`. Super users select a company via cookie (`lib/company-cookie.ts`); admin/user are scoped to their `companyId` from the JWT session. The helper `resolveCompanyId()` in `lib/api-utils.ts` handles this branching.

System companies created by seed: `skaichips`, `super`, `unregistered` (auto-assigned to unregistered gateways).

### Auth (NextAuth v5)

- **Do NOT use DrizzleAdapter** — credentials-only auth uses `authorize` callback + JWT strategy directly in `lib/auth.ts`.
- Session/JWT types are extended in `lib/auth-types.ts` (id, role, companyId).
- Use explicit `Session | null` type, not `Awaited<ReturnType<typeof auth>>` — the latter conflicts with NextMiddleware overload signatures.

### Database (Drizzle ORM + PostgreSQL)

Schema in `lib/db/schema.ts`. Key tables: `companies`, `gateways`, `gatewayStatus`, `tags`, `tagSensingData`, `users`, `alertSettings`, `assetMaps`, `assetMapGateways`, `alertAcknowledgments`.

Gateway has two tables: `gateways` (master config, company assignment) and `gatewayStatus` (real-time WS data like firmware, connection state).

### WebSocket Server (`server/`)

Uses `ws` package directly (not Next.js API routes). Files:
- `websocket.ts` — Server setup, connection lifecycle
- `handlers.ts` — Processes 0x08 (GW Info) and 0x0A (Tag Data) packets
- `protocol.ts` — Binary packet parsing, temperature/voltage calculations
- `types.ts` — TypeScript interfaces

**Important:** The WS server runs via `tsx` and must use relative imports (`../lib/db`) — the `@/` path alias does not resolve outside Next.js.

### Gateway Binary Protocol

Packets: `[dataType, direction, lengthHi, lengthLo, ...payload]`
- **0x08 (GW Info):** MAC, HW/FW versions, OTA URL, WS URL, reportInterval, rssiFilter
- **0x0A (Tag Data):** GW MAC, scanTick, RSSI, TAG MAC, advData (temperature, voltage, raw)

### API Pattern

All API routes in `app/api/` use helpers from `lib/api-utils.ts`:
- `getSession()` — Returns session or null
- `requireAuth()` — Throws 401 if unauthenticated
- `requireAdmin()` — Throws 403 if not admin/super
- `resolveCompanyId(session)` — Resolves company from cookie (super) or session

Validation via Zod schemas in `lib/validators/`.

### UI

Next.js App Router with shadcn/ui (new-york style, slate base color). Components in `components/ui/`. Dashboard pages use client components that fetch from the REST API.

### Alert Acknowledgment

Session-scoped via JWT `iat` timestamp — acknowledged alerts don't reappear until next login.
