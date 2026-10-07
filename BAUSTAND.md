# Baustand MAKE OS (laufend gepflegt, für alle Claude-Sitzungen)

> Zweck: Jede Sitzung (auch andere Claude-Code-Fenster) sieht hier, was gerade gebaut wird, wo der Stand liegt und was als Nächstes kommt. Online-Stand = `main` auf dem Server; gebaut wird auf `entwicklung`; hochladen NUR auf Kevins ausdrückliches Wort.

## Online
- Server: `6b10a5ba` (05.10.) — Google-Client-Geheimnis am 06.10. auf dem Server korrigiert (Env, kein Code).

## Auf `entwicklung` (lokal fertig, wartet auf Upload)
- Aufgaben nach Malins Bauplan (Umbau v3: Projekt › Liste › Aufgabe › Unteraufgabe) — 16329127, b1670fbc
- Relay-Notiz aus `website/` nach `research/website/` — 6c65ee0b
- Inbox-Fakten + Konzept — 22adfc7c, 2ffdd933 (`INBOX_KONZEPT.md`, `research/inbox/`)
- `deploy/google-verbinden.sh` erkennt mehrfach eingefügtes Geheimnis — dfe84c0e
- iCloud-Kalender je Person (Malin verbindet selbst; andere sehen nur „Belegt“) + Karten „<Firma> verbinden“ (Business, Google) / iCloud (Privat) im Kalender — Merge 7d4e69d7 (Branch icloud-je-person). Kevin 07.10.: „Belegt“ bleibt; Blöcke für Malin ins eigene iCloud — gebaut e919ccd5.
- HOI-Befund „iCloud-Kalender je Person“ — 0743b335
- Rückweg-Werkzeug Aufgaben v3 `scripts/aufgaben-rueckweg-v3.mjs` — 874abc9a, 34c8f993
- **Inbox 2** (eine Inbox, Postfächer je Person per IMAP/SMTP + Gmail, Lagebild, Fächer, Gespräch mit Kontext, ZOE nur Vorschlag; alte Inbox/M365/Apple-Mail raus) — Merge 0c603030; neue Abhängigkeiten imapflow 2.2.6, nodemailer 10.0.15
- **WhatsApp Business** (Cloud API: Webhook mit Signatur, Senden 24-h-Fenster/Vorlagen, Registrieren mit Speicherort DE, `deploy/whatsapp-verbinden.sh`, VVT) — Merge 944b2108
- Bewusst NICHT: nächtliche ICS-Sicherung der persönlichen iCloud-Konten (Apple hält die Daten; MAKE OS schreibt dort nur Blöcke; „Trennen löscht alles“ bleibt wahr)

## In Arbeit (07.10.)
| Paket | Ort | Stand |
|---|---|---|
| WhatsApp in die Inbox-Oberfläche einhängen + Kontakt per Telefonnummer + Screener für Nummern + HOI-Befund WhatsApp + Business-Postfächer ohne Privat | Branch `inbox-whatsapp-ui` (Worktree) auf 944b2108 | läuft |

## Als Nächstes
2. Zusammenführen → volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
