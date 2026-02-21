#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "🌱 Running seed..."
node -e "require('./dist/prisma/seed').main().catch(e => { console.error(e); process.exit(1); })" || true

echo "🚀 Starting API..."
exec node dist/main
