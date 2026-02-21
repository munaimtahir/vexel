FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY apps/worker/package.json ./
RUN pnpm install --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY apps/worker/ .
# Copy API prisma schema so we can generate the Prisma client
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate
RUN pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
