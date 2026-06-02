FROM node:20-alpine AS base
RUN npm install -g pnpm@9

WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/db/package.json ./packages/db/

RUN pnpm install --filter @field-ops/db --frozen-lockfile

COPY packages/db ./packages/db

RUN pnpm --filter @field-ops/db generate

CMD ["pnpm", "--filter", "@field-ops/db", "migrate:deploy"]
