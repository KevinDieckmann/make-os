# Baustand MAKE OS (laufend gepflegt, für alle Claude-Sitzungen)

> Zweck: Jede Sitzung (auch andere Claude-Code-Fenster) sieht hier, was gerade gebaut wird, wo der Stand liegt und was als Nächstes kommt. Online-Stand = `main` auf dem Server; gebaut wird auf `entwicklung`; hochladen NUR auf Kevins ausdrückliches Wort.

## Online
- Server: `6b10a5ba` (05.10.) — Google-Client-Geheimnis am 06.10. auf dem Server korrigiert (Env, kein Code).

## Auf `entwicklung` (lokal fertig, wartet auf Upload)
- Aufgaben nach Malins Bauplan (Umbau v3: Projekt › Liste › Aufgabe › Unteraufgabe) — 16329127, b1670fbc
- Relay-Notiz aus `website/` nach `research/website/` — 6c65ee0b
- Inbox-Fakten + Konzept — 22adfc7c, 2ffdd933 (`INBOX_KONZEPT.md`, `research/inbox/`)
- `deploy/google-verbinden.sh` erkennt mehrfach eingefügtes Geheimnis — dfe84c0e

## In Arbeit (07.10., Agenten in Worktrees unter `.claude/worktrees/`)
| Paket | Worktree | Stand |
|---|---|---|
| Inbox 2 (Pakete 1–4) | `agent-a3244adcf608fa028` | Fundament b78f7696 (Postfach-Register, IMAP/SMTP, Strom /api/inbox, alte Quellen raus); Oberfläche/Tests/Doku laufen |
| iCloud-Kalender je Person + „MAKE Innovation verbinden“ im Business-Kalender | `agent-a2a1be51507dd3b7f` | 4186f468, 43c306bd, 921c44ed; Browser-Prüfung läuft |

## Als Nächstes
1. WhatsApp (Cloud API, eigene Business-Nummer) — nach Inbox-Fundament, Fakten in `research/inbox/FAKTEN_WHATSAPP_IMAP.md`
2. Zusammenführen → volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
