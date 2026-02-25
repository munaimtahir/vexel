FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
# Copy workspace manifests for dependency resolution
COPY pnpm-workspace.yaml package.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/theme/package.json ./packages/theme/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --ignore-scripts --shamefully-hoist

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:9021
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
# SDK and theme source needed because they are pnpm workspace symlinks
COPY packages/sdk/ ./packages/sdk/
COPY packages/theme/ ./packages/theme/
COPY apps/admin/ ./apps/admin/
WORKDIR /app/apps/admin
RUN NEXT_TELEMETRY_DISABLED=1 pnpm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/admin/server.js"]
