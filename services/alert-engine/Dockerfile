FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY services/alert-engine/package.json ./services/alert-engine/
RUN pnpm install --filter @field-ops/alert-engine... --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/alert-engine/node_modules ./services/alert-engine/node_modules
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY services/alert-engine ./services/alert-engine
COPY tsconfig.base.json ./
RUN pnpm --filter @field-ops/db generate
RUN pnpm --filter @field-ops/shared build
RUN pnpm --filter @field-ops/alert-engine build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 fieldops
COPY --from=builder --chown=fieldops:nodejs /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=fieldops:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=fieldops:nodejs /app/services/alert-engine/dist ./services/alert-engine/dist
COPY --from=builder --chown=fieldops:nodejs /app/services/alert-engine/node_modules ./services/alert-engine/node_modules
USER fieldops
EXPOSE 4006
CMD ["node", "services/alert-engine/dist/server.js"]
