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

## Querschnitt (Prüfung 28.09. abends) — Kevins Auswahl
- **Sofort (klein, läuft):** UG-Mandate landeten als Rechnung bei kdc (Fehler), Mandate-Filter nach Gesellschaft, Meilensteine mit echtem Privat/Business, Einheit am Wochenplan-Block.
- **Als Nächstes (Kevin: ja):**
  1. **Finanzen: eine Einheitenliste.** Heute sechs Listen (Cockpit kdc/kdv, Steuern kdc/kdv/privat, Finanzplanung ug/privat/kdv mit kdc→UG, Privat-Finanzen privat/selbststaendigkeit/ug, Liquidität-Start kdv/kdc). Ziel: überall `lib/einheiten.ts`, UG überall, Selbstständigkeit eigene Achse; bestehende Summen dürfen sich dabei nicht ändern (Regressionstest), Rechenkern-Namen bleiben.
  2. **Mandat an Zielen und Zeit:** Ziele, Meilensteine, Zeitmessung bekommen optional `mandatId`/`firmaId`; Einheit wird wie bei Heads aus der Gesellschaft abgeleitet; Zeit je Mandat sichtbar (Abrechnung/Auslastung).
- **Später (Kevin: nicht jetzt):** Rechnungen per Kennung an CRM-Firma, Termine/Mails per Klick verknüpfen.

## Vertiefung (Kevin 28.09. ~22:20) — „das Tool tiefer, da muss alles möglich sein“
Kevins Entscheidungen:
- **Gruppen über den Listen:** Projekt → Gruppe (z. B. Marketing, Sales, Operations; farbig, einklappbar) → Liste → Aufgabe → Unteraufgabe. Listen dürfen auch direkt im Projekt liegen.
- **Projekt-Ebene voll ausbauen:** Projektseite mit Übersicht (Fortschritt, Fälliges, Verantwortliche), **Notizen** (formatierbar, Checklisten, Links), **Dateien/Uploads**, Beschreibung, Status/Zeitraum, Mitglieder.
- **Unteraufgaben** direkt anlegen, mit eigenen Feldern (Status, Deadline, Zuständig).
- **Dateien und Notizen:** an Projekt und Aufgabe, verschlüsselt, privat/business getrennt. **ZOE darf Projekt-/Aufgaben-Dateien und Notizen lesen** (Kevins Wahl) — immer als Fremdtext gekapselt (`fremd()`), mit Größengrenze. Die CRM-Dateiablage (Angebote, Rechnungen, Einwilligungsbelege) bleibt wie bisher außerhalb von ZOE.
- **Wiederkehrend:** wiederkehrende Aufgaben und **wiederkehrende Listen** (z. B. jeden Monat „Monatsabschluss“ neu), dazu **Vorlagen** für Projekte und Listen.
- **ZOE mit eigenen Aufgaben und Stapel:** Aufgaben an ZOE zuweisbar; sie bereitet vor (Entwurf, Recherche, Unteraufgaben-Vorschlag) und legt das Ergebnis in ihren Stapel, Status „Wartet auf Freigabe“; erst euer Klick übernimmt/erledigt. Nach außen schickt sie nichts.
- **Ansichten:** Liste, Board, **Tabelle** (Spalten sortierbar), **Kalender/Zeitachse** nach Deadline.
- **Eigene Felder** je Projekt (Text, Zahl, Betrag, Datum, Auswahl, Link, Person) und **Abhängigkeiten** („B wartet auf A“).
- **Verlauf je Aufgabe** (wer, wann, was — ohne Inhalte von Kommentaren im Protokoll) und **Zeit je Aufgabe** (Fokus-Zeit).
- Upload auf den Server: erst auf Kevins ausdrückliches Wort.
- **Navigation wie im CRM (Kevin ~22:30):** `/os/aufgaben` startet mit einer **Überblick-Seite** (Kacheln + Karten je Privat/Firma/Mandant), oben Leiste Überblick · Privat · Firmen ▾ · Mandanten ▾ · Archiv (Dropdowns mit Suche wie im CRM), im Space Brotkrumen Space ▾ › Projekt ▾ › Gruppe ▾ › Liste ▾ zum schnellen Umschalten auch zwischen Listen; Zustand in der Adresse (`WEG.aufgaben`).
- **Mandanten überall klickbar** (Baustein `MandantLink`): Zeit je Mandat, Ziele, Finanzen, Kalender-Fristen, Heads, Suche → CRM-Firmenakte/Mandat; Mandanten-Space-Kopf verlinkt Firma + Mandat, CRM-Akten verlinken zurück in den Space.
