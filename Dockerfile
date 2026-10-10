# ─── MAKE OS — Container für den Server (Hetzner) ──────────────────────────
# Ein Bild für App und Arbeiter. Daten (.data) und das Obsidian-Hirn liegen
# NICHT im Bild, sondern als Ordner auf dem Server (siehe compose.yml).

# Festgenagelt am 26.09. (Digest) — Dependabot schlägt neue Stände als PR vor.
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Namen je Instanz (05.10., Demo-Instanz — DEMO.md): NEXT_PUBLIC_ wird beim Bauen eingesetzt. Leer = wie bisher (unsere Instanz).
ARG NEXT_PUBLIC_MAKE_OS_EINHEITEN=""
ARG NEXT_PUBLIC_MAKE_OS_CRM_TEAM=""
ENV NEXT_PUBLIC_MAKE_OS_EINHEITEN=$NEXT_PUBLIC_MAKE_OS_EINHEITEN NEXT_PUBLIC_MAKE_OS_CRM_TEAM=$NEXT_PUBLIC_MAKE_OS_CRM_TEAM
# pdf.js-Worker nach public/ (sonst macht das postinstall)
RUN node scripts/pdf-worker.mjs && node node_modules/next/dist/bin/next build && npm prune --omit=dev

FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
ENV NODE_ENV=production TZ=Europe/Berlin PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=bau --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
