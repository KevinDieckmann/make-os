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

## In Arbeit (07.10., Agenten in Worktrees unter `.claude/worktrees/`)
| Paket | Worktree | Stand |
|---|---|---|
| Inbox 2 (Pakete 1–4) | `agent-a3244adcf608fa028` | Fundament b78f7696 (Postfach-Register, IMAP/SMTP, Strom /api/inbox, alte Quellen raus); Oberfläche/Tests/Doku laufen |
| WhatsApp (Cloud API, eigene Business-Nummer) | Branch `whatsapp` auf Basis `inbox-2` b78f7696 | gestartet 07.10.: Webhook mit Signaturprüfung, Senden (24-h-Fenster/Vorlagen), Verbinden-Skript, VVT, Tests |

## Als Nächstes
2. Zusammenführen → volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
