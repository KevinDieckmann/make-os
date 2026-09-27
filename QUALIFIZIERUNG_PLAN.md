# Masterliste · Lead-Score · Qualifizierungsrunde — Plan (27.09.2026)

Kevins Auftrag vor dem Upload: Malins Leads sind in die Masterliste eingeflossen, die Liste
soll sauber online, Markttraktion wird um >600 Datensätze reicher, kalte Leads gehen ins
Marketing zum Vernetzen, und ein wiederkehrender Qualifizierungsprozess mit Lead-Score
macht aus Rohdaten qualifizierte Leads. Später: Produkte je Deal, Research-Bot.

## Befund (Masterliste vom 26.09., 732 Zeilen, 40 Spalten)
- Owner: 213 Malin · 107 Kevin · 33 beide · 297 „kein Owner“ · 76 leer · 6 extern.
- 33 Zeilen tragen den Vermerk „Dublette Kevin/Malin prüfen“ (STATUS_RECHERCHE).
- Aufhänger bei 299, E-Mail bei 179, Telefon bei 472, LinkedIn bei 207, HubSpot-ID bei 554.
- LEAD_STATUS fast leer (122 gesetzt), VERTRIEBS_EIGNUNG: 103 ja · 184 vielleicht · 308 nein.
- Online (lokal) liegen 453 Kontakte aus dem ersten Import — ohne Malins Teil.
- Upload-Weg existiert: Stammdaten › Austausch (CSV hochladen, `/api/crm/import`, idempotent,
  Schlüssel E-Mail › HubSpot-ID › Name+Firma, Pipeline-Felder bleiben unberührt).

## 1 · Import so, dass Malins Arbeit überlebt
- **Regel:** Online gewinnt. Die Liste füllt nur leere Felder; abweichende gefüllte Felder
  landen in einer Konfliktliste (Feld, online, Liste) und werden nicht überschrieben.
  Ausnahme: Felder, die online noch nie von Hand angefasst wurden (`quellen` = nur Import).
- **Vorschau vor dem Schreiben:** `POST /api/crm/import` mit `vorschau:true` liefert
  neu / aktualisiert / Konflikte / mögliche Dubletten, ohne zu schreiben. Danach „Übernehmen“.
- **Dubletten:** Name+Firma-Schlüssel wird tolerant (Umlaute, Titel, Firma-Zusätze wie GmbH);
  Treffer ohne sichere Kennung kommen als „mögliche Dublette“ in die bestehende Dubletten-Ansicht
  (Kontakte › Dubletten, `lib/crm/dubletten.ts`), nicht automatisch verschmolzen.
- **Owner:** „Malin Würriehausen“ → `malin`, „Kevin Dieckmann“ → `kevin`, „… & …“ → `beide`,
  „(kein Owner)“/leer → ohne Besitzer (siehe Frage 3). Der Import setzt einen Owner nie zurück.
- **Kalt-Merkmal beim Import:** Zeilen ohne Aufhänger, ohne echtes Gespräch und mit Eignung
  „nein“/leer bekommen `temperatur: 'kalt'` und laufen in das Marketing-Segment „Vernetzen“
  (gespeichertes Segment mit Regel, Marketing › Segmente + Vernetzen-Runde). Sie erscheinen
  nicht in Firmen › Leads, bis sie warm werden (siehe Frage 1).

## 2 · Lead-Score (rein, getestet: `lib/crm/score.ts`)
0–100 Punkte aus vier Teilen, jeder Teil einzeln sichtbar (keine Blackbox):
| Teil | Punkte | Woraus |
|---|---|---|
| Fit | 30 | Eignung/Fit ja 30 · vielleicht 15 · offen 8 · nein 0; Typ Zielkunde/Lead +0, Dienstleister/Investor → nicht bewertet |
| Wärme | 30 | echtes Gespräch ≤30 Tage 30 · ≤90 Tage 20 · Antwort/Inbound 12 · nur angesprochen 8 · sonst 0 |
| Qualifizierung | 30 | 5 je Kernfrage „ja“; Schmerz oder Entscheider „nein“ deckelt auf 10 |
| Erreichbarkeit | 10 | E-Mail 4 · Telefon 3 · LinkedIn 3 |
Stufen: **kalt** < 25 · **lau** 25–49 · **warm** 50–74 · **heiß** ≥ 75. `temperatur` wird nicht
gespeichert, sondern abgeleitet (wie die Phase) — von Hand nur „kalt halten“ (ruht/kein Fit).
- **Kanal & Kanal-Leistung:** Herkunftskanal je Kontakt (`quelle`: empfehlung/event/content/
  outreach/bestand/inbound/kampagne; Import-Quellen werden gemappt: HubSpot-Export → bestand,
  Apple → netzwerk, Malin-Import → bestand). Auswertung je Kanal: Anzahl, Anteil warm+,
  SQL-Quote, Win-Rate — in Marketing › Auswertung, im Sales-Reiter (Auswertung) und im
  Datenblock von Head of Sales/Marketing.
- **Sichtbar:** Score-Chip in Akte (Kopf), Leads-Liste (Spalte, sortierbar), Kontakte-Liste,
  Qualifizierungsrunde (live beim Tippen), Überblick (Verteilung kalt/lau/warm/heiß).

## 3 · Reiter „Qualifizierung“ (rechts, vor Sales)
- Neuer `Bereich` `qualifizierung` in `lib/crm/adresse.ts`, Reiter in `RECHTS` vor Sales mit
  Zähler „noch N offen“. Keine Unter-Reiter: Filter-Zeile (Person: Malin ✓ / Kevin / beide /
  ohne Besitzer · Temperatur · Kanal), darunter die Karten nacheinander (wie Runden.tsx,
  Tastatur ←/→, Enter = weiter).
- **Wer ist dran:** eigene Leads mit Status neu/kontaktiert/im_gespraech/qualifizierung, deren
  Kernfragen unvollständig sind oder deren letzte Qualifizierung > 60 Tage her ist; sortiert nach
  Score absteigend (warm zuerst), kalte Segment-Mitglieder standardmäßig ausgeblendet.
- **Maske je Lead:** Kopf (Name, Firma, Rolle, Kanal, Score live mit vier Balken), dann die sechs
  Kernfragen als Ja/Nein/Unklar **plus Freitext je Frage** (neues Feld
  `Lead.antworten?: Partial<Record<keyof Kriterien, string>>`), Fit, Notiz, nächster Schritt.
  Knöpfe: „Akte öffnen“ (Akte in neuer Sicht, Rückweg bleibt), „Zurückstellen“, „Kein Fit“,
  „Später“, „SQL → Deal“ (bestehender Weg `dealAnlegen`). Speichern über `/api/crm/lead`.
- **Produkte je Deal:** Platz in der Maske als „Passende Leistung“ (Auswahl aus Leistungen,
  Mehrfach), gespeichert als `Chance.leistungIds[]` — kommt im Feinschliff, nicht vor dem Upload.

## 4 · Später (geplant, nicht vor dem Upload)
- **Research-Bot** als eigener Auftrag im Stapel: pro Lead öffentliche Daten (Impressum,
  Handelsregister-Öffentliches, Website, Posts) sammeln, Vorschlag je Feld, Übernahme nur mit
  Freigabe (human-in-the-loop, keine automatische Kontaktaufnahme).
- Qualifizierungsrunde als wöchentlicher Impuls im Tageslauf („12 Leads warten“).

## Bauschritte (Reihenfolge)
1. `lib/crm/score.ts` + Tests · `antworten` am Lead · Kanal-Mapping.
2. Import: Online-gewinnt-Regel, Vorschau, Konflikte, tolerantes Matching, Owner-Mapping, Kalt-Segment.
3. Reiter Qualifizierung + Maske + Person-Filter + Akte-Sprung.
4. Score sichtbar machen (Akte, Leads, Kontakte, Überblick), Kanal-Auswertung, Head-Datenblöcke.
5. Doku (README/UPDATES/CLAUDE.md), tsc/lint/vitest, Prüfbau 3011, dann Upload auf Kevins Wort.
Nach dem Upload: Masterliste online über Stammdaten › Austausch hochladen (Vorschau → Übernehmen),
danach Malins erste Qualifizierungsrunde.
