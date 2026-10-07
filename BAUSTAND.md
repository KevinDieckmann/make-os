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
- **WhatsApp in der Inbox-Oberfläche** (Liste, Fenster-Uhr, Antworten/Vorlagen, Medien auf Klick, Kontakt per Nummer, Screener für Nummern, HOI-Befund, Business-Postfächer ohne Privat) — Merge nach d7db5b76
- WhatsApp-Spiegel 7 Jahre (§ 257 HGB, Kevin 07.10.) — e008ebfc
- Kevin 07.10.: unbekannte WhatsApp-Nummern direkt in „Antworten“ (4035022e) · Einwilligungs-Kanal „WhatsApp“, Werbe-Vorlagen nur damit (062d7811) · Nummern-Dubletten auch bei „Telefon“ (8a571a9c)
- Bewusst NICHT: nächtliche ICS-Sicherung der persönlichen iCloud-Konten (Apple hält die Daten; MAKE OS schreibt dort nur Blöcke; „Trennen löscht alles“ bleibt wahr)

## In Arbeit (07.10. nachmittags)
| Paket | Ort | Stand |
|---|---|---|
| Websites „Klar 2“: makeinnovation.de + fokusinnovation.de neu — normale Seite statt Scroll-Film, hell → dunkel, nur Prinzipien, keine Spielereien (Kevin 07.10.) | Branch `websites-klar-2` (Worktree) | läuft |
| Zeitstrahl „Seil“: Stränge → Seil am Ziel, Abhängigkeiten (Kevin 07.10.) | Branch `zeitstrahl-seil` (Worktree agent-ac60a1ed…) | **PAUSIERT** 07.10. (Wochenlimit 94 %): Schritt 1–2/5 fertig (ed5f7bd5 Konzept in LICHTFAEDEN.md, ba19bae5 Bezüge als Daten + Tests); weiter ab „reines Seil-Modell“ nach dem Reset Do. 09.10. abends |

## Als Nächstes
2. Zusammenführen → volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
