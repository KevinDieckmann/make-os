# MAKE OS — Demo-Instanz (05.10.2026)

Kevin 04.10.: „Wir müssen alles anpassbar haben, auch wenn wir mal einen Demo-Account machen.“ Plattform-Regel (CLAUDE.md):
**Zeigbar** — alles mit erfundenen Beispieldaten vorführbar · **Testkunden nie auf unserer Instanz** — eigene Instanz (eigener
Container, Datenordner, Schlüssel, Adresse). Einordnung: PLATTFORM_PLAN.md › Stufe 0.

Die Demo ist **eine eigene Instanz** mit eigenem Datenordner — nie ein Konto auf app.makeinnovation.de, nie unser `.data`.

## Was gesät wird (lib/demo/saat.ts — alles erfunden)

Ein Haushalt `demo` mit zwei Personen und einer freien Mitarbeiterin — eine kleine Beratung mit Software-Produkt:

| Bereich | Inhalt |
|---|---|
| Konten | Lena Hartmann (Inhaberin) und Jonas Hartmann, beide `@example.invalid`, Gesundheit gegenseitig geteilt |
| Team | beide Konten + Mira Sommer (Design, frei, ohne Konto) |
| CRM | 6 Firmen, 8 Kontakte, 3 Produkte (aktiv, mit Angebotstext), 2 Mandate, 4 offene Deals in verschiedenen Stufen |
| Unternehmen | Beratung (Einzelunternehmen), Holding (UG, hält die operative 100 %), operative GmbH (mit Büro-Mietvertrag und Kündigungsfrist), neue Gesellschaft in Gründung (Holding 60 % / Jonas 40 %) **mit Gründungsfahrplan** (Ziel, 9 Meilensteine, 22 Aufgaben) |
| Ziele & Meilensteine | 3 Business-Jahresziele + 1 privates, 5 Meilensteine mit Aufwand, Personen, Kette („wartet auf“) und Mandat |
| Aufgaben | 10 Aufgaben (an Meilensteinen und frei, mit Fristen, verteilt) |
| Kalender | Wochenvorlage (Arbeitszeit) je Person, 23 Termine (letzte Woche bis übernächste) — nur lesen, wie vom Mac geliefert |
| Kapazität | Grundwerte, ein Urlaub, ein fester Block, zwei Mandats-Zuweisungen; Fokus-Zeit der letzten drei Wochen; **drei festgehaltene Wochenpläne** + die laufende Woche → echte Plan-Treue |
| Finanzplanung | Sachkosten, Privatbudget, Einnahmen, Retainer im Basis-Szenario, Kontostände, Planszenario „Wachstum mit Cockpit“ als Arbeitsplan |
| Familie & Gesundheit | ein Familienmensch, ein Jahrestag, sieben Tage Erholungswerte, ein Sport-Wochenplan — harmlos und minimal |
| Wissen | 4 Notizen im Demo-Vault (`scope: oeffentlich`) |
| Agenten (Paket 4c, lib/demo/saat-agenten.ts) | je Business-Head ein Thread mit gespeicherter Antwort (Sales und Marketing je zwei), zwei Mitarbeiter-Threads mit Bericht („Recherche & Prospecting“, „Bild & Video“), drei Skills (einer aktiv mit Zeitplan), zwei geplante Hintergrundaufgaben → „Als Nächstes“ gefüllt — **ohne KI-Schlüssel, kein Modellaufruf** |
| Fotos & Videos | Album „Sommerfest (Beispiel)“ mit drei erzeugten Farbflächen (keine Fotos, keine Personen): eins freigegeben, eins angefragt, eins beim Head of Marketing mit Vorschlag im Freigabe-Stapel |

Geschrieben wird über **dieselben Schreibwege wie die Oberfläche** (die Routen in-process mit der Person im Kopf — Säuberung,
Regeln, Kaskade, Meilenstein-Listen, Änderungsprotokoll). Direkt über die Datenschicht nur: Konten (sonst bräuchte es den
Einrichtungs-Schlüssel), die Demo-Marke, `calendar-cache` und die drei vergangenen Wochenpläne (Morgenlauf-Schritt mit dem
Montag von damals); im Agenten-Bereich die Antworten/Berichte der Threads, der Testlauf des aktiven Skills und der Vorschlag des Heads zum
Medium (dafür gibt es ohne Modellaufruf keinen Weg — Begründung im Kopf von lib/demo/saat-agenten.ts). Kennungen sind deterministisch — Links bleiben nach dem Zurücksetzen gleich (außer der neuen Gesellschaft).

**Alles ist bearbeitbar und löschbar** — es gibt keinen Sonderweg. Einziger Zusatz: „Demo zurücksetzen“.

## Schutz (lib/demo/schutz.ts — jeder Riegel reicht zum Abbruch)

1. **Säen** nur mit ausdrücklich gesetztem `MAKE_OS_DATEN_DIR`, nie `<repo>/.data`, nie ein Pfad mit einem `.data`-Glied
   (so heißt unser echter Datenordner — lokal und im Container `/app/.data`), und nur in einen **leeren** Ordner.
2. **Zurücksetzen** nur mit `MAKE_OS_DEMO=1` (sonst gibt es den Weg nicht: `/api/demo` → 404), nur der **Inhaber** mit
   Sitzung (kein Dienstweg), nur nach Rückfrage, nur wenn die **Demo-Marke** im Ordner liegt und **alle Konten auf
   `@example.invalid`** enden.
3. **Umgebung**: Zurücksetzen ist gesperrt, solange die Instanz echte Quellen erreichen könnte — `MAKE_OS_OHNE_APPLE=1`,
   `MAKE_OS_DOKU_WURZEL=aus`, `MAKE_VAULT_DIR` im Datenordner, `MAKE_OS_INTERN`/`PORT` gesetzt (sonst gingen interne Aufrufe an
   `localhost:3001`), kein `ICLOUD_*`, `GOOGLE_*`, `TELEGRAM_BOT_TOKEN`, `WHOOP_*`, `MS_*`.
4. **Namen**: `NEXT_PUBLIC_MAKE_OS_EINHEITEN` (Namen der drei festen Gesellschaften) und `NEXT_PUBLIC_MAKE_OS_CRM_TEAM`
   (Zuständige in Markttraktion) — ohne sie zeigte die Demo die Namen unserer Instanz. Das Skript weist darauf hin.

Zurücksetzen leert den Datenordner (bis auf den Such-Index `brain-index.sqlite*`, der sich selbst nachbaut) und sät neu;
Hash/Salz der Konten bleiben, damit die Sitzung des Vorführenden gültig bleibt.

## Lokal starten (Mac)

```bash
cd ~/Claude/Projects/MakeOS
export DEMO=~/make-os-demo                      # eigener Ordner, NICHT im Repo, nie „.data“
mkdir -p "$DEMO"
export MAKE_OS_DATEN_DIR="$DEMO/daten" MAKE_VAULT_DIR="$DEMO/daten/wissen"
export MAKE_OS_KEY="$(openssl rand -hex 32)" SESSION_SECRET="$(openssl rand -hex 32)" MAKE_OS_DATEN_SCHLUESSEL="$(openssl rand -hex 32)"
export MAKE_OS_DEMO=1 MAKE_OS_OHNE_APPLE=1 MAKE_OS_DOKU_WURZEL=aus MAKE_OS_EMBEDDINGS=aus
export PORT=3200 MAKE_OS_INTERN=http://localhost:3200 MAKE_OS_DIST=.next-demo
export NEXT_PUBLIC_MAKE_OS_EINHEITEN='{"kdc":{"label":"Hartmann Beratung","kurz":"Beratung"},"kdv":{"label":"Hartmann Holding","kurz":"Holding"},"ug":{"label":"Nordlicht Labs GmbH","kurz":"Nordlicht"}}'
export NEXT_PUBLIC_MAKE_OS_CRM_TEAM='[{"id":"lena","name":"Lena","farbe":"#58D9CD","verantwortet":["sales"]},{"id":"jonas","name":"Jonas","farbe":"#A79BFF","verantwortet":["marketing","event"]}]'
node scripts/demo-saat.mjs                       # Passwort: MAKE_OS_DEMO_PASSWORT oder erzeugt → $DEMO/daten.zugang.txt (600)
node node_modules/next/dist/bin/next dev -p 3200 # bzw. Preview über .claude/launch.json mit derselben Umgebung
```

Anmelden mit `lena@example.invalid` (Inhaberin) bzw. `jonas@example.invalid`. Die Schlüssel der Demo nie mit unseren teilen;
keine `.env.local` im Repo-Ordner, die echte Schlüssel trägt (Next lädt sie sonst mit). Beenden: Server stoppen, `$DEMO` löschen.

## Als eigener Container auf dem Server (nur beschrieben — nicht ausgeführt)

Eigenes Bild (die Namen werden beim Bauen eingesetzt), eigener Datenordner, eigene Schlüssel, eigene Adresse
(z. B. `demo.makeinnovation.de`), eigener Port. **Nie** den Datenordner oder die `.env` von app.makeinnovation.de mitbenutzen.

```bash
# 1) Bild bauen (auf dem Server, im App-Ordner)
docker build -t make-os:demo \
  --build-arg NEXT_PUBLIC_MAKE_OS_EINHEITEN='{"kdc":{"label":"Hartmann Beratung"},"kdv":{"label":"Hartmann Holding"},"ug":{"label":"Nordlicht Labs GmbH"}}' \
  --build-arg NEXT_PUBLIC_MAKE_OS_CRM_TEAM='[{"id":"lena","name":"Lena","verantwortet":["sales"]},{"id":"jonas","name":"Jonas","verantwortet":["marketing","event"]}]' .
# 2) Ordner + eigene Geheimnisse
sudo install -d -m 700 -o make -g make /srv/make-os-demo/daten
#    /srv/make-os-demo/.env: MAKE_OS_KEY, SESSION_SECRET, MAKE_OS_DATEN_SCHLUESSEL, MAKE_OS_PEPPER (alle neu: openssl rand -hex 32),
#    MAKE_OS_DEMO_PASSWORT, MAKE_OS_ADRESSE=https://demo.makeinnovation.de — KEIN ICLOUD_*, GOOGLE_*, TELEGRAM_*, WHOOP_*, MS_*.
#    ANTHROPIC_API_KEY nur mit eigenem Demo-Budget (eigener Schlüssel).
```

`compose.demo.yml` (eigenes Projekt, z. B. `docker compose -p make-os-demo -f compose.demo.yml up -d`):

```yaml
services:
  demo:
    image: make-os:demo
    restart: unless-stopped
    mem_limit: 768m
    security_opt: ["no-new-privileges:true"]
    cap_drop: [ALL]
    env_file: /srv/make-os-demo/.env
    environment:
      PORT: "3000"
      TZ: Europe/Berlin
      MAKE_OS_DEMO: "1"
      MAKE_OS_DATEN_DIR: /demo/daten          # bewusst NICHT /app/.data
      MAKE_VAULT_DIR: /demo/daten/wissen
      MAKE_OS_INTERN: http://localhost:3000
      MAKE_OS_OHNE_APPLE: "1"
      MAKE_OS_DOKU_WURZEL: aus
      MAKE_OS_EMBEDDINGS: aus
      MAKE_OS_GRABSTEINE_DIR: /demo/grabsteine
    volumes:
      - /srv/make-os-demo/daten:/demo/daten
      - /srv/make-os-demo/grabsteine:/demo/grabsteine
    expose: ["3000"]
```

```bash
# 3) Einmal säen (Container läuft noch nicht; Ordner leer)
docker run --rm --env-file /srv/make-os-demo/.env -e MAKE_OS_DATEN_DIR=/demo/daten -e MAKE_VAULT_DIR=/demo/daten/wissen \
  -e MAKE_OS_OHNE_APPLE=1 -e MAKE_OS_DOKU_WURZEL=aus -v /srv/make-os-demo/daten:/demo/daten make-os:demo node scripts/demo-saat.mjs
# 4) Starten und in Caddy einen eigenen Block „demo.makeinnovation.de → demo:3000“ ergänzen (eigenes Zertifikat)
```

Optional nächtlich zurücksetzen: ein Takt, der als Inhaber der Demo `POST /api/demo { aktion: 'zuruecksetzen', bestaetigt: true }`
aufruft (noch nicht gebaut — der Knopf unter System genügt für Vorführungen).

## Bekannte Grenzen (Plattform-Schulden, PLATTFORM_PLAN › Paket 1)

- Einige Altstellen kennen nur `kevin`/`malin` (z. B. Projekt-Besitzer `Owner`, Kalender-Zuordnung `Wer`, Blöcke im Kalender
  anlegen, Prompts von ZOE und den Agenten mit unserem Kontext) — in der Demo fallen sie auf „beide“ bzw. leer zurück. ZOE
  daher in der Demo nur mit eigenem Schlüssel und Bewusstsein, dass Prompts noch unseren Kontext tragen.
- Die alte Liquiditäts-Seite (Finanzen › Finanzmeeting) nennt Rollen im Text fest; die Finanzplanung (v3) ist neutral.
- Der Rechenkern trägt Feldnamen wie `kevinBrutto` (nur Schema, keine Daten).
- Termine der Demo sind nur lesbar (kein iCloud/Google).
