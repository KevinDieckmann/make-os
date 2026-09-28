# Aufgaben — Umbau wie Monday/ClickUp (Kevin + Malin, 28.09. abends)

## Kevins Entscheidungen (28.09.)
- **Spaces:** Privat = ein Space „Privat“, Projekte darin. Business: **Firmen fest** (Selbstständigkeit · KD Ventures · MAKE OS UG) + **Mandanten automatisch** — jede CRM-Firma mit aktivem Mandat bekommt einen Space (verknüpft mit der Firma); endet das Mandat, wandert der Space ins Archiv.
- **Ebenen:** Bereich (Privat | Business → Firma | Mandant) → Space → **Projekt** (z. B. Buchhaltung) → **Liste** (z. B. Januar, Februar) → **Aufgabe** (aufklappbar) → **Unteraufgabe** (z. B. der einzelne Beleg). Ohne Liste: „Sonstige“. Ohne Projekt: „Sonstige“ im Space.
- **Status:** Offen · In Arbeit · Wartend · Erledigt fest; je Space eigene Status dazu (Farbe, Reihenfolge, Grundstatus als Bedeutung).
- **Felder:** Status, Deadline, Beschreibung, Zuständig, Priorität, Verknüpfung mit CRM (Kontakt, Firma, Mandat, Deal), Kommentare mit @-Erwähnung.
- **Schnell anlegen ganz oben:** Titel tippen, Projekt/Liste/übergeordnete Aufgabe per Klick wählen (vorbelegt mit dem, was offen ist); nicht zugeordnet → „Sonstige“.
- **Glocke oben rechts:** Zuweisungen an mich, Kommentare/Erwähnungen, fällig/überfällig; neue Meldung → Glocke leuchtet rot/pingt. Telegram mitgedacht, kommt später.
- **Dashboards:** Privates auf die privaten Flächen, Business auf die Business-Flächen.
- **Querschnitt:** Privat/Business und Firma/Mandant-Zuordnung wie im CRM auch in den anderen Reitern prüfen (eigene Prüfung, danach Vorschlag).
- **Problem oder Idee melden:** Knopf unten links zwischen Brain und System (gebaut, aee8642).

## Datenmodell (verträglich erweitert, bestehende Leser laufen weiter)
- `Task`: `spaceId`, `listeId?`, `parentId?` (Unteraufgabe), `statusId?` (eigener Status, trägt einen Grundstatus), `bezug?` {kontaktId, firmaId, mandatId, dealId}, `kommentare?`, `startDate?`. `space`/`einheit` bleiben und werden aus `spaceId` abgeleitet.
- `Project`: `spaceId`. Neu im Bestand: `listen[]`, `statusEigen[]`.
- Grundstatus: Offen = todo (backlog wird Offen), In Arbeit = in-progress, Wartend = blocked, Erledigt = done.
- Spaces: fest `privat`, `kdc`, `kdv`, `ug`; Mandanten `m-<firmaId>` aus dem CRM abgeleitet (aktives Mandat), Archiv sonst.
- Zugang: nur Haushalt des Inhabers (bisher fehlte die Prüfung), Stand/409, Änderungsprotokoll.
- Meldungen: `lib/meldungen/melden.ts` (Schnittstelle `melde()`), Speicher je Person.

## Pakete
1. **B1 Aufgaben:** Modell + Server + Übernahme des Bestands + neue Aufgaben-Seite (Bereich/Space/Projekt/Liste/Aufgabe/Unteraufgabe, Detail, Schnell-Anlegen, Status-Verwaltung, CRM-Verknüpfung) + Dashboards.
2. **B2 Glocke:** Meldungen-Speicher, API, Glocke im Kopf, fällig/überfällig, Telegram-Kanal vorbereitet.
3. **B3 Querschnitt-Prüfung:** welche Reiter Privat/Business + Firma/Mandant brauchen (nur lesen, Vorschlag).
