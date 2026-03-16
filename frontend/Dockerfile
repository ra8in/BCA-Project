# ─────────────────────────────────────────────
# BCA Project – React + Vite Frontend
# ─────────────────────────────────────────────

# ── Development target (default) ─────────────
FROM node:20-slim AS development

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

EXPOSE 5173

# Run Vite dev server exposed to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Production build target ──────────────────
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production serve target (lightweight) ────
FROM node:20-slim AS production

RUN npm install -g serve

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

COPY --from=build /app/dist ./dist

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:4173').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" || exit 1

CMD ["serve", "-s", "dist", "-l", "4173"]
