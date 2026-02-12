#!/bin/sh
set -e

echo "[Entrypoint] Running database migrations..."
npx drizzle-kit migrate

echo "[Entrypoint] Running database seed..."
npx tsx scripts/seed.ts

echo "[Entrypoint] Starting Next.js server..."
exec node server.js
