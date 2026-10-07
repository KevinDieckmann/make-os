# Baustand MAKE OS (laufend gepflegt, für alle Claude-Sitzungen)

> Zweck: Jede Sitzung (auch andere Claude-Code-Fenster) sieht hier, was gerade gebaut wird, wo der Stand liegt und was als Nächstes kommt. Online-Stand = `main` auf dem Server; gebaut wird auf `entwicklung`; hochladen NUR auf Kevins ausdrückliches Wort.

## Online
- Server: **`38f88dc0` (07.10. ~18:28)** — Aufgaben v3 (Malin), Inbox 2 + WhatsApp (ohne Einrichtung aus), iCloud je Person, Blöcke ins eigene iCloud, Verbinden-Karten im Kalender, HOI-Befunde, Einwilligung WhatsApp, Telefon-Dubletten. Websites unverändert (alte „Klar“).
- Sicherung `vor-upload-2026-10-07-1618.tar.gz`, Rückweg-Bild `make-os:6b10a5ba` (ALTES-BILD-OK). Platte danach 5,3 GB frei — alte Bilder 70603154/db93e88/5aca6f5 nur auf Kevins Wort löschen.

## Auf `entwicklung` (lokal fertig, wartet auf Upload — Stand 07.10. spät)
- Alles bis `38f88dc0` ist online; die frühere Liste hier war damit erledigt.
- **Messlatte M3 „Malin“** — `tests/messlatte-malin.test.ts` (a83f1b72): Malin sieht keine `scope: privat`-Notiz von Kevin (auch nicht den Dateinamen) und keinen der sechs 🔒-Speicher; Frist 31.10. damit nachgewiesen. Offen für Kevin: Routinen-Planer (Gesamtansicht zeigt beiden alle Routinen) und Ernährung (gemeinsam, inkl. Profile) — so lassen oder für Malin ausblenden?
- **0-Punkt (Eröffnung) je Business-Gesellschaft** — Merge `nullpunkt` (9fddf7b1). Kevin 05.10. „geht VOR dem Upload online“ — beim Upload 07.10. vergessen.
- **Websites v3 „Der Weg“** — Merge 49fccef6 (Ruhe-Prüfer v3, Doku). Prüfer 0 Fehler, nur Platzhalter: Datenschutz-Angaben + Kevins Gründer-Satz. Kevin bestätigt Texte vor dem Upload.
- **Zeitstrahl „Seil“ 5/5** — d62fa216 (als ein Commit zusammengefasst, damit der versehentlich eingecheckte Sandbox-Bau aus dem Zwischenstand nicht in die Historie kommt). Offen: Zeilen der Spalte 22 px (Tablet-Touch < 44 px), Ziel-Kopf 12 px/Untertitel gegen den Design-Standard.

## Aufräumen (wartet auf Kevin — Löschen braucht sein Wort)
- Worktrees bereits gemergter Branches unter `.claude/worktrees/` (nullpunkt, betroffenenrechte, finanzplan-5, icloud-je-person, inbox-2, aufgaben-struktur, whatsapp, inbox-whatsapp-ui, websites-v3, zeitstrahl-seil) — `git worktree remove` je Ordner; Branches bleiben.
- `worktree-agent-a726d126d4270b431` (Kalender-Gesamtprüfung 29.09.) ist überholt: alle Korrekturen stehen schon in `entwicklung`.
- `websites-klar-2` steckt vollständig in `websites-v3`. `fokus-3d` bleibt geparkt (Kevin: Richtung geändert).

## Als Nächstes
1. Volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort
2. Vault-Notizen im MAKE OS Brain auf den Stand bringen (viele tragen nur oben ein Update-Banner, Text darunter vom 26.09.) — nur mit Kevins Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
