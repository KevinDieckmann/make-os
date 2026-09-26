# ─── MAKE OS — Container für den Server (Hetzner) ──────────────────────────
# Ein Bild für App und Arbeiter. Daten (.data) und das Obsidian-Hirn liegen
# NICHT im Bild, sondern als Ordner auf dem Server (siehe compose.yml).

# Festgenagelt am 26.09. (Digest) — Dependabot schlägt neue Stände als PR vor.
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# pdf.js-Worker nach public/ (sonst macht das postinstall)
RUN node scripts/pdf-worker.mjs && node node_modules/next/dist/bin/next build && npm prune --omit=dev

FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
ENV NODE_ENV=production TZ=Europe/Berlin PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=bau --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
