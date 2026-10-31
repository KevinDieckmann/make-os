# ICP-Kampagnen: Start-ups · Innovative Unternehmer · Scale-ups (31.10.2026)

Kevin hat die Kampagne in drei Schritten beauftragt:

- **31.10., Auftrag:** „Weitere Firmen finden, die auf unser Sales-Profil passen. Start-ups, innovative Firmen …“
- **Nachtrag Scale-ups:** „Scale-ups kannst du auch mit dazu nehmen, die brauchen auch immer Struktur im Sales. Als eigene Liste, die müssen alle jeweils anders angesprochen werden mit anderen Problemen.“
- **Nachtrag Datenbasis:** „Diese 3 Listen mindestens 200 … sofort ein Leadscoring … auf den Homepages schauen, ob schon ein Head of Sales da ist … unsere Datenbasis muss perfekt sein, dann können wir das immer mit den Marktdaten und Studien abgleichen und unsere Ansprache verbessern … die 200 aus jeder Kampagne, die ich am besten anrufen sollte.“

**Rahmen**
- Region: Deutschland.
- Nur öffentliche, kostenlose Quellen; jede Angabe trägt ihre Quelle.
- Echte Firmendaten liegen nur auf Kevins Schreibtisch (`ICP-Listen <Tag>/`), nie im Repo.
- Der Mittelstand ab 250 Mitarbeitenden gehört nicht in diese Runde.

## 1. Drei Profile, je eigene Liste, Kampagne und Ansprache

| Profil | Wer | Problem | Einstieg | Kampagne / Segment / Label |
|---|---|---|---|---|
| **Start-up** | jung, gründergeführt (Förder-, Hochschul-, Startup-Listen, Seed) | Produkt da, Vertrieb fehlt — bzw. Produkt noch nicht am Markt | Vertrieb aufbauen · Sichtbarkeit zuerst | `icp-startups` / `seg-icp-startups` / `icp-startups` |
| **Innovativer Unternehmer** | inhabergeführt, fertiges Produkt, rund 5–50 Mitarbeitende, oft Jahre am Markt (Innovationspreise, ZIM) | Neugeschäft kommt über Empfehlung, nicht planbar | Planbares Neugeschäft | `icp-unternehmer` / `seg-icp-unternehmer` / `icp-unternehmer` |
| **Scale-up** | ab 50 Mitarbeitenden, ab 8 offenen Stellen oder Wachstumsrunde (Series A und später) | Vertrieb wächst ohne Struktur: keine Leitung, keine Pipeline, der man traut, langsame Einarbeitung | Struktur im Vertrieb | `icp-scaleups` / `seg-icp-scaleups` / `icp-scaleups` |

**Wo das liegt:**
- Zuordnung: `zielgruppeVon` (lib/funde/icp.ts). Die Art laut Quelle hat Vorrang, die Größe kann sie überstimmen.
- Profile: `PROFIL_*` (lib/funde/typen.ts).
- Kampagne: Jede Kampagne wird beim ersten Import ihres Profils angelegt und nie mit dem Homepage-Funnel gemischt.

## 2. Raster (Passung) und Lead-Score (Reihenfolge der Ansprache)

Raster und Lead-Score stehen als Daten in `ICP_RASTER` (lib/funde/icp.ts). `icpBewerten` und `prioritaetVon` rechnen genau so.

**Muss**
- Sitz in Deutschland laut Impressum.
- Eigenes, neues Produkt bzw. eigene Lösung.
- Unabhängig, keine Konzerntochter.
- Erreichbare Website mit Impressum.

**Passung (Kann, zusammen 100)**

| Punkte | Merkmal |
|---|---|
| 25 | Produkt am Markt (sonst 5) |
| 20 | Sucht Verstärkung im Vertrieb |
| 15 | B2B |
| 10 | Förderung, Investor oder Preis laut Quelle |
| 10 | Thema im Fokus |
| 10 | Geschäftsführung im Impressum |
| 5 | Sitz in Berlin |
| 5 | Website schwach |

Stufen: A ab 70, B 50–69, C unter 50.

**Ausschlüsse**
- Konzerntochter. Zählt nur als Selbstaussage im Impressum, nie über Dienstleister wie AWS oder über Kunden.
- Konzerngröße ab 1.000 Mitarbeitenden; bei Unternehmern ab 250.
- Agentur oder Beratung für Vertrieb/Marketing.
- Kein Sitz in Deutschland bzw. Website nicht erreichbar.
- Ein Impressum, das sich nicht automatisch lesen lässt, ist kein Ausschluss. Dann gilt der Sitz laut Liste mit dem Vermerk „vor der Ansprache prüfen“.

**Lead-Score für die Ansprache (`prioritaet`, 0–100)**

Lead-Score = 60 % Passung + Erreichbarkeit + Geschäftsführung bekannt (10) + **keine Vertriebsleitung sichtbar (10)**.
- Erreichbarkeit: Handy 20 · Festnetz 12 · nur Mail 6.

Die Listen sind danach sortiert. Die Import-Datei je Profil enthält die Top 200 (`IMPORT_MAX`).

**Vertriebsleitung (`vertriebsleitungAus`)**
- Gesucht wird auf Team-, Über-uns- und Startseite: Head of Sales/Revenue/Business Development, VP Sales, Chief Sales/Revenue/Commercial Officer, Sales Director, Vertriebsleitung.
- Eine Stellenanzeige („Head of Sales (m/w/d)“, „wir suchen …“) zählt NICHT als besetzt.
- Ergebnis: ja · nein (Teamseite gelesen, keine Leitung) · unbekannt.

## 3. Datenbasis: Steckbrief je Firma (`lib/crm/icp-firma.ts`, an der Firma in der Kartei)

Strukturiert, damit wir je Segment auswerten und mit Marktdaten und Studien abgleichen können:

| Feld | Woher |
|---|---|
| `icp` | Passung, Stufe, Zielgruppe, Einstieg, Lead-Score, Gründe, Aufhänger |
| `steckbrief.vertriebsleitung` + `vertriebsleitungRolle` | Team-, Über-uns- und Startseite; nur die Rolle, nie Namen |
| `mitarbeitende` | Selbstangabe („Wir sind …“); nie Kundengrößen |
| `stellen` / `stellenVertrieb` | Karriereseite, auch Personio/Join |
| `gruendungsjahr` / `register` | Website / Impressum (HRB + Amtsgericht) |
| `signal` | Quelle: Förderung, Runde, Preis |
| `profile` | Links zu LinkedIn, Instagram, X, YouTube, Xing, TikTok, Facebook — nur Links |
| `beitraege` | letzte 5 Beiträge von Blog/News der eigenen Website (Titel, Datum, Link) |
| `partner` / `referenzen` | Partner-/Integrations-/Kundenseite (Logo-Namen) bzw. Zahl der Referenz-Logos |

Dazu kommen `Firma.linkedin`, `mitarbeiter`, `gegruendet`, `marktinfo` (Thema) und `quellen` je Feld.

**Bewusst nicht**
- **LinkedIn/Instagram auslesen.** Beiträge, Mitarbeitende und Follower zeigen beide nur angemeldet, und automatisches Auslesen ist nach ihren Nutzungsbedingungen verboten. Wer mehr will, exportiert aus dem eigenen Konto (z. B. Sales Navigator); dafür kommt ein Import.
- **Netzwerke einzelner Mitarbeitender.** Das wäre Profilbildung über Dritte ohne Zweck-Notwendigkeit (Art. 5 Abs. 1 lit. c, Art. 6 Abs. 1 lit. f DSGVO). Wir führen Rollen und Firmenbeziehungen, als Person nur die Geschäftsführung aus dem Impressum.

**Lernschleife**
- Die Kampagnen-Kennzahlen (Gespräche, Abend-Zusagen je Firma) lassen sich je Profil, Stufe, Einstieg und Steckbrief-Merkmal auswerten, z. B. „ohne Vertriebsleitung“ gegen „mit“.
- Die Ergebnisse gleichen wir mit Studien ab, etwa dem Deutschen Startup Monitor, und schärfen danach Raster und Aufhänger. Das Raster ist Daten: eine Änderung ist eine Zeile, mit Test.

## 4. Quellen und Ablauf (wiederholbar)

1. **Listen**:
   - Förder- und Portfolio-Listen: HTGF, IBB Ventures, Bayern Kapital, BM-H Hessen, NRW.BANK, Start-up BW;
   - Hochschul- und Startup-Listen: TU Berlin, UnternehmerTUM, KIT, Uni Hamburg, RWTH, Startup City Hamburg, SpinLab, Failory-Städtelisten;
   - Finanzierungsmeldungen: monatliche Listen finanzierter Start-ups, Einzelmeldungen;
   - Wachstums-Rankings und Growth-Portfolios;
   - Innovationspreise und Förderprogramme (Unternehmer).

   Ausgelassen werden Exits, Pharma/Biotech ohne Produkt, Krypto-Token-Projekte, Konzerntöchter, Agenturen und Rüstung.
2. **Dubletten** nach Domain zwischen allen Listen (die Signale werden zusammengeführt) und gegen die Homepage-Listen. Beim Import zusätzlich gegen Kartei, Sperrliste und vorhandene Funde.
3. **Lesen:** Startseite, Impressum, Karriere-, Team-, Blog- und Partnerseite. Fehlende Seiten liest ein Browser ohne Fenster nach. Aus dem Impressum kommen eine Geschäftsführung, Anschrift, Mail (nie datenschutz@) und Telefon (Handy/Festnetz). Daraus entstehen Merkmale, Passung und Lead-Score.
4. **Ausgabe:** je Profil eine CSV mit allen Firmen inkl. Ausschlüssen und Grund, nach Lead-Score sortiert, und `… – Top 200 (Import).json` (Format `make-os-funde`).

## 5. Kampagne je Profil: Sequenz und Kanal-Ampel

**Segment:** Herkunft „Recherche“ + Label des Profils. Reihenfolge nach Lead-Score (Rang in der Liste).

| Tag | Schritt | Ampel |
|---|---|---|
| 0 | Funde im ZOE-Stapel prüfen und freigeben. Vorher „Sitz prüfen“ und die Geschäftsführung ansehen. | intern |
| 1 | Geschäftsführung (Scale-up: auch Vertriebsleitung, falls vorhanden) bei LinkedIn vernetzen, **ohne Nachricht** | grün |
| 3 | **Brief** mit dem Aufhänger des Profils + Einladung zu unserem nächsten Abend | grün |
| ab Reaktion | Gespräch: Anruf über den Leitfaden am Fund, Mail als Antwort | grün nach Reaktion |
| — | Kaltmail, LinkedIn-Nachricht ohne Vorkontakt | **rot** (§ 7 Abs. 2 UWG, auch an Firmen) |
| — | Anruf ohne Vorkontakt | **gelb**: B2B nur mit mutmaßlicher Einwilligung, also mit konkretem, sachlichem Anlass (z. B. offene Vertriebsstelle). Auf eigenes Risiko; im Zweifel erst nach Reaktion. |

Es wird nichts automatisch versendet. Eine Mail geht nur über „eigenes Risiko“ des Inhabers und die Freigabe im Stapel.

**Art. 14 DSGVO:** Quelle, Zweck, berechtigtes Interesse und Widerspruch stehen in der ersten Nachricht; der Baustein ist im Entwurf.

**„Am besten anrufen“:** Rang 1 bis 200 je Liste. Die Spalte „Bester Weg“ (Handy > Festnetz > Mail > nur Brief) steht neben Aufhänger 1, dem Anlass fürs Gespräch.

## 6. Texte (Absender = Gesellschaft aus dem Register, „Sie“)

Keine Produkt- oder Partnernamen von uns, keine erfundenen Zahlen. Die einzige Zahl ist belegt: Deutscher Startup Monitor 2025, S. 56 — 63,5 % der Start-ups nennen Vertrieb als größte Herausforderung; sie steht nur im Start-up-Text. Für den Abend gilt „Termine folgen“.

- **Start-up:** „vom Produkt in den Markt“ (`entwurfStartup`). Aufhänger: Stelle im Vertrieb · Produkt am Markt + DSM-Zahl · Positionierung zuerst · Förderung als Bezug.
- **Innovativer Unternehmer:** „planbares Neugeschäft“. Aufhänger: Produkt funktioniert, Neugeschäft kommt über Empfehlung · Auszeichnung als Bezug · Website zeigt den Vorsprung nicht.
- **Scale-up:** „Struktur für den wachsenden Vertrieb“. Aufhänger: keine Vertriebsleitung sichtbar · Einstellungen im Vertrieb brauchen Playbook und Einarbeitung · Runde = höhere Ziele.
- **Anruf-Leitfaden** je Profil, mit eigener Einstiegsfrage:
  - Start-up: „Wie gewinnen Sie heute neue Kunden?“
  - Unternehmer: „Woher kommen Ihre neuen Kunden — wie planbar?“
  - Scale-up: „Wie viele verkaufen — wie läuft die Einarbeitung?“
- **LinkedIn:** Vernetzung ohne Text.

## 7. Offen

- Termin des nächsten Abends — vor den Briefen.
- Import für LinkedIn-Exporte aus dem eigenen Konto (Sales Navigator / Connections), damit LinkedIn-Daten rechtssauber dazukommen.
- Auswertung „Kennzahl je Merkmal“ als Karte unter Markttraktion › Auswertung (Daten liegen jetzt strukturiert an der Firma).
- Weitere Quellen: EXIST (keine öffentliche Liste gefunden), weitere Landesfonds und Hochschulen.
