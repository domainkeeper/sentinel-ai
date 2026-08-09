# Syntax: docker/docker-compose
# Builder stage — installs full deps and compiles TypeScript -> dist.
FROM node:24-slim AS build
WORKDIR /app

# Install dependencies first (cached unless package files change).
COPY package.json package-lock.json ./
RUN npm ci

# Compile the backend only (frontend is intentionally NOT copied).
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage — minimal, backend-only image.
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# SQLite file lives under /app/data; mount a persistent volume here.
ENV DATABASE_PATH=/app/data/sentinel.db
WORKDIR /app

# Runtime dependencies only (no typescript/tsx/vitest).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled backend from the builder.
COPY --from=build /app/dist ./dist

# A writable, persistent location for the SQLite database.
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "dist/index.js"]
