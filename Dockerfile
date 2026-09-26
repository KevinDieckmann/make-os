# ─── MAKE OS — Container für den Server (Hetzner) ──────────────────────────
# Ein Bild für App und Arbeiter. Daten (.data) und das Obsidian-Hirn liegen
# NICHT im Bild, sondern als Ordner auf dem Server (siehe compose.yml).

# Festgenagelt am 26.09. (Digest) — Dependabot schlägt neue Stände als PR vor.
FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2 AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# pdf.js-Worker nach public/ (sonst macht das postinstall)
RUN node scripts/pdf-worker.mjs && node node_modules/next/dist/bin/next build && npm prune --omit=dev

FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2
ENV NODE_ENV=production TZ=Europe/Berlin PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=bau --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
