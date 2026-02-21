#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "🌱 Running seed..."
node_modules/.bin/ts-node --transpile-only prisma/seed.ts || true

echo "🚀 Starting API..."
exec node dist/main
