FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY services/content-guard/package.json ./services/content-guard/
RUN pnpm install --filter @field-ops/content-guard... --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/content-guard/node_modules ./services/content-guard/node_modules
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY services/content-guard ./services/content-guard
COPY tsconfig.base.json ./
RUN pnpm --filter @field-ops/db generate
RUN pnpm --filter @field-ops/shared build
RUN pnpm --filter @field-ops/content-guard build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 fieldops
COPY --from=builder --chown=fieldops:nodejs /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=fieldops:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=fieldops:nodejs /app/services/content-guard/dist ./services/content-guard/dist
COPY --from=builder --chown=fieldops:nodejs /app/services/content-guard/node_modules ./services/content-guard/node_modules
USER fieldops
EXPOSE 4002
CMD ["node", "services/content-guard/dist/server.js"]
