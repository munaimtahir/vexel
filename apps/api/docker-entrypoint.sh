#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "🌱 Running seed..."
node dist/prisma/seed.js || true

echo "🚀 Starting API..."
exec node dist/src/main
