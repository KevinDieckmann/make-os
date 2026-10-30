# ─── MAKE OS — Container für den Server (Hetzner) ──────────────────────────
# Ein Bild für App und Arbeiter. Daten (.data) und das Obsidian-Hirn liegen
# NICHT im Bild, sondern als Ordner auf dem Server (siehe compose.yml).

# Festgenagelt am 26.09. (Digest) — Dependabot schlägt neue Stände als PR vor.
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Namen je Instanz (05.10., Demo-Instanz — DEMO.md): NEXT_PUBLIC_ wird beim Bauen eingesetzt. Leer = wie bisher (unsere Instanz).
ARG NEXT_PUBLIC_MAKE_OS_EINHEITEN=""
ARG NEXT_PUBLIC_MAKE_OS_CRM_TEAM=""
# Veranstaltungsmarke je Instanz (14.10., lib/crm/marke.ts) — leer = wie bisher.
ARG NEXT_PUBLIC_MAKE_OS_EVENT_MARKE=""
ENV NEXT_PUBLIC_MAKE_OS_EINHEITEN=$NEXT_PUBLIC_MAKE_OS_EINHEITEN NEXT_PUBLIC_MAKE_OS_CRM_TEAM=$NEXT_PUBLIC_MAKE_OS_CRM_TEAM NEXT_PUBLIC_MAKE_OS_EVENT_MARKE=$NEXT_PUBLIC_MAKE_OS_EVENT_MARKE
# pdf.js-Worker nach public/ (sonst macht das postinstall)
# Heap (14.10.): der Bau braucht inzwischen > 2 GB — Node nimmt sonst nur ~¼ des Arbeitsspeichers (Runner 7 GB → ~1,75 GB → Abbruch).
RUN node scripts/pdf-worker.mjs && NODE_OPTIONS=--max-old-space-size=4096 node node_modules/next/dist/bin/next build && npm prune --omit=dev

# Reel-Werkstatt (28.10., Malin-Paket): whisper.cpp (MIT) für Untertitel auf dem eigenen Server — gebaut aus einem festgenagelten Stand
# (v1.9.5, Commit unten), ohne CPU-Sonderbefehle (GGML_NATIVE=OFF: das Bild baut GitHub, laufen muss es auf dem Server) und ohne OpenMP (keine Laufzeit-Bibliothek nötig). Nur das Programm
# `whisper-cli` wandert ins Bild; das Modell liegt außerhalb (/modelle, deploy/whisper-modell.sh).
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS whisper
RUN apt-get update && apt-get install -y --no-install-recommends git cmake g++ make ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git init /w && cd /w && git fetch --depth 1 https://github.com/ggml-org/whisper.cpp d1be6fde11ac6e0407606b4e42fe72d34add8037 && git checkout FETCH_HEAD \
 && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
 && cmake --build build -j 2 --target whisper-cli && cp build/bin/whisper-cli /usr/local/bin/whisper-cli

FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
ENV NODE_ENV=production TZ=Europe/Berlin PORT=3000 NEXT_TELEMETRY_DISABLED=1
# ffmpeg (Debian, mit libass für Untertitel) und eine freie Schrift für die eingebrannten Texte (Reel-Werkstatt, 28.10.).
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli
WORKDIR /app
COPY --from=bau --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
