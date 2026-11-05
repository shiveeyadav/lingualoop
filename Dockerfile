# LinguaLoop - multi-stage build for any Docker host (Shipvolta, Render, Coolify, plain Docker).

# ---- 1. install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

# ---- 2. build ----
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Fail the image build early if course content is invalid.
RUN node -e "require('./lib/content').loadAllCourses(); console.log('content ok')"
RUN npm run build && npm prune --omit=dev && rm -rf .next/cache

# ---- 3. run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/content ./content
COPY --from=build /app/db ./db
COPY --from=build /app/lib ./lib
COPY --from=build /app/scripts/init-db.js ./scripts/init-db.js
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1
# Apply schema + admin, then start Next. `exec` lets Next receive SIGTERM directly.
CMD ["sh", "-c", "node scripts/init-db.js && exec node_modules/.bin/next start -p ${PORT:-3000}"]
