# --- Dependencies ---
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Builder ---
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL so prisma generate + next build don't fail (overridden at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN pnpm build

# --- Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema + migrations
COPY --from=builder /app/prisma ./prisma

# Prisma CLI (migrations) + tsx for ensure-districts / NCES import on empty DB
RUN npm install -g prisma@7 tsx
RUN mkdir -p scripts src/lib
COPY --from=builder --chown=nextjs:nodejs /app/scripts/import-nces-districts.ts ./scripts/import-nces-districts.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/ensure-districts.ts ./scripts/ensure-districts.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed.ts ./scripts/seed.ts
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/nces-district.ts ./src/lib/nces-district.ts

# Next standalone output may not trace @prisma/adapter-pg/pg; tsx scripts need them.
# Install into a temp dir first to avoid npm conflicts with standalone's partial node_modules,
# then merge into /app/node_modules and regenerate the Prisma client.
USER root
RUN mkdir -p /tmp/script-deps && cd /tmp/script-deps \
    && echo '{"private":true}' > package.json \
    && npm install @prisma/client@7.5.0 @prisma/adapter-pg@7.5.0 pg@8.20.0 --omit=dev \
    && rm -rf /app/node_modules/@prisma /app/node_modules/pg /app/node_modules/pg-cloudflare \
              /app/node_modules/pg-connection-string /app/node_modules/pg-int8 \
              /app/node_modules/pg-pool /app/node_modules/pg-protocol /app/node_modules/pg-types \
              /app/node_modules/pgpass \
    && cp -r /tmp/script-deps/node_modules/. /app/node_modules/ \
    && rm -rf /tmp/script-deps
RUN prisma generate --schema=prisma/schema.prisma
RUN chown -R nextjs:nodejs /app/node_modules
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
