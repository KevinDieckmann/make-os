# Baustand MAKE OS (laufend gepflegt, für alle Claude-Sitzungen)

> Zweck: Jede Sitzung (auch andere Claude-Code-Fenster) sieht hier, was gerade gebaut wird, wo der Stand liegt und was als Nächstes kommt. Online-Stand = `main` auf dem Server; gebaut wird auf `entwicklung`; hochladen NUR auf Kevins ausdrückliches Wort.

## Online
- Server: **`38f88dc0` (07.10. ~18:28)** — Aufgaben v3 (Malin), Inbox 2 + WhatsApp (ohne Einrichtung aus), iCloud je Person, Blöcke ins eigene iCloud, Verbinden-Karten im Kalender, HOI-Befunde, Einwilligung WhatsApp, Telefon-Dubletten. Websites unverändert (alte „Klar“).
- Sicherung `vor-upload-2026-10-07-1618.tar.gz`, Rückweg-Bild `make-os:6b10a5ba` (ALTES-BILD-OK). Platte danach 5,3 GB frei — alte Bilder 70603154/db93e88/5aca6f5 nur auf Kevins Wort löschen.

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
- **WhatsApp in der Inbox-Oberfläche** (Liste, Fenster-Uhr, Antworten/Vorlagen, Medien auf Klick, Kontakt per Nummer, Screener für Nummern, HOI-Befund, Business-Postfächer ohne Privat) — Merge nach d7db5b76
- WhatsApp-Spiegel 7 Jahre (§ 257 HGB, Kevin 07.10.) — e008ebfc
- Kevin 07.10.: unbekannte WhatsApp-Nummern direkt in „Antworten“ (4035022e) · Einwilligungs-Kanal „WhatsApp“, Werbe-Vorlagen nur damit (062d7811) · Nummern-Dubletten auch bei „Telefon“ (8a571a9c)
- Bewusst NICHT: nächtliche ICS-Sicherung der persönlichen iCloud-Konten (Apple hält die Daten; MAKE OS schreibt dort nur Blöcke; „Trennen löscht alles“ bleibt wahr)

## Pausiert (07.10. abends, Kevin: „wir müssen runterfahren“) — Zwischenstände gesichert, NICHT online
| Paket | Branch / Worktree | Stand | Weiter mit |
|---|---|---|---|
| Websites v3 „Der Weg“ (Kugel raus, Innovation nach vorne, Linienplan, Farbfläche, Arbeits-Schemata, Gründer, FAQ) | `websites-v3` · `.claude/worktrees/agent-a930ae2991317f9aa` | 32f3807c, 54ff6ab6 + Zwischenstand 5af8012d (unfertig: Ruhe-Regeln für v3 wurden gerade umgeschrieben) | Ruhe-Prüfer/Tests auf v3 anpassen, Sichtprüfung, Fotos, Kevin zeigen |
| Zeitstrahl „Seil“ | `zeitstrahl-seil` · `.claude/worktrees/agent-ac60a1ed809782024` | 4/5: Konzept, Bezüge, Seil-Modell, Adapter + /api/seil, Zeichnung (Canvas, Fokus-Modus, Handy) + Zwischenstand 94638d5f (unfertig: Beschriftungs-Spalte links im Gantt-Stil) | Beschriftungs-Spalte fertig, Merge `entwicklung`, volle Suite, Sandbox-Prüfung, Fotos, Doku (5/5) |

## Als Nächstes
2. Zusammenführen → volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
