# Mess Distribution - Next.js production image
# Uses Next.js standalone output

FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

RUN npm install --no-audit --no-fund


FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Baked into client + next.config rewrites at build time.
ARG NEXT_PUBLIC_USE_API=false
ARG NEXT_PUBLIC_ZK_DEMO=false
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG API_PROXY_URL=http://api:8000

ENV NEXT_PUBLIC_USE_API=$NEXT_PUBLIC_USE_API \
    NEXT_PUBLIC_ZK_DEMO=$NEXT_PUBLIC_ZK_DEMO \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    API_PROXY_URL=$API_PROXY_URL

RUN npm run build


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Keep visible on runtime (NEXT_PUBLIC already inlined; proxy target used if config re-reads).
ARG NEXT_PUBLIC_USE_API=false
ARG NEXT_PUBLIC_ZK_DEMO=false
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG API_PROXY_URL=http://api:8000
ENV NEXT_PUBLIC_USE_API=$NEXT_PUBLIC_USE_API \
    NEXT_PUBLIC_ZK_DEMO=$NEXT_PUBLIC_ZK_DEMO \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    API_PROXY_URL=$API_PROXY_URL

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/standalone ./

COPY --from=builder --chown=nextjs:nodejs \
    /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
