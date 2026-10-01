# MAKE OS als Plattform für AI CEOs — Plan (Stand 01.10.2026)

Nur Planung — nichts davon ist gebaut. Zweck: MAKE OS anderen (z. B. Investoren) zeigen können und wissen,
was bis zur Marktreife fehlt.

## Idee
Der Trend: Unternehmen werden ohne Mitarbeiter aufgebaut, Menschen sind nur noch Schnittstellen — KI-Agenten
übernehmen den Rest. MAKE OS ist das Betriebssystem für diese **AI CEOs**: Privatleben und Business mit vollem
Fokus in **einer** Software. **Fokus & Zeit** sind der Kern (Kalender, Planen, Ziele, Meilensteine, Aufgaben, Heute);
alle anderen Bereiche sind gleich wichtig (Markttraktion/CRM, Finanzen, Gesundheit, Familie, Brain).
**ZOE** ist der KI-Chief-of-Staff: bereitet vor, fasst zusammen, schlägt vor — der Mensch entscheidet.

## Betrieb
**Eigene Instanz je Kunde** (eigener Server bzw. Container, eigene Schlüssel, eigene Sicherung) — kein gemeinsames
SaaS. Passt zur heutigen Architektur (verschlüsselte Bestände je Instanz, Sicherung, Rückweg, HOI, Ausrollen per GitHub).
**Markttraktion ist immer auch einzeln verkaufbar** — dieselbe Software, nur mit reduzierter Oberfläche.

## Stufe 0 — Zeigen können (der kleinste nötige Schritt)
Eure echte Instanz zeigt private Daten — für Vorführungen ungeeignet. Deshalb:
- **Demo-Instanz** unter z. B. `demo.makeinnovation.de`: eigener Container auf dem Server, eigener Datenordner,
  **erfundene, realistische Beispieldaten** einer AI-CEO-Persona (Woche im Kalender, Ziele/Meilensteine mit Aufgaben,
  Markttraktion mit Beispielkontakten und Deals, Finanzen mit Beispielzahlen, ZOE-Stapel mit Vorschlägen).
- Zugang per eigenem Demo-Login (zeitlich begrenzt teilbar); nächtlich auf den Ausgangsstand zurückgesetzt.
- Ohne echte Verbindungen (kein iCloud, keine Mails, KI nur mit Demo-Budget).
- Voraussetzung: die Beispieldaten müssen die heute fest eingebauten Personen (`kevin`/`malin`) nutzen — Stufe 0
  geht also **vor** dem großen Umbau, mit zwei erfundenen Demo-Personen auf diesen Kennungen.

## Stufe 1–4 — Marktreife (später, auf Kevins Wort)
| Paket | Inhalt | Warum |
|---|---|---|
| 1 · Neutralisieren | Personen frei anlegbar statt `kevin`/`malin`/`both` (361 Stellen in 137 Dateien), Firmen je Instanz einstellbar statt fest (46 Dateien), persönliche Inhalte raus (Nordstern, Gesundheit, Whoop-Standards, alte Firmenbezüge; ~127 Dateien) | Ohne das ist es „Kevins Software“ |
| 2 · Einrichtung | Erster Start: Name, Personen (1 oder 2), Firmen, Ziele, Kalender, KI-Schlüssel | Kunde kommt ohne euch los |
| 3 · Modul-Schalter | Bereiche je Instanz an/aus, Variante **„nur Markttraktion“** (Kalender/Aufgaben laufen unsichtbar als Grundlage mit) | Markttraktion einzeln verkaufen |
| 4 · Instanz-Fabrik | Neuer Kunde per Knopf (Server, Adresse, Schlüssel, Sicherung), Updates an alle, KI-Kosten je Kunde | Lohnt ab ca. 3–5 Kunden |
Dazu: AVV mit jedem Kunden, Datenschutzhinweis der App, Abrechnung, Support.
Reihenfolge: 1 → 3 → 2 → 4. Nach 1 + 3 kann Markttraktion als eigene Instanz für erste Kunden (von Hand) laufen.

## Lizenzen (Kevin, 01.10.: „Ich will Lizenzen vergeben können“)
- **Lizenz = Vertrag für eine Instanz:** Kunde, **Edition** (`Markttraktion` · `MAKE OS komplett` · später weitere),
  freigeschaltete **Module**, **Plätze** (Personen/Logins), **Laufzeit** (bis Datum, Verlängerung), Status (aktiv/pausiert/beendet).
- **Lizenzschlüssel:** von der MAKE Innovation GmbH **signiert** (Ed25519, privater Schlüssel nur bei euch), die Instanz prüft
  nur die Unterschrift mit dem öffentlichen Schlüssel — offline, ohne Abhängigkeit von eurem Server. Kein Schlüssel = Demo-/Testmodus.
- **Wirkung in der Instanz:** Modul-Schalter (Paket 3) folgen der Lizenz; Plätze begrenzen neue Logins; nach Ablauf eine
  Schonfrist (z. B. 14 Tage Hinweis), danach **nur lesen** — nie Daten sperren oder löschen (Kunde behält Zugriff/Export, DSGVO).
- **Lizenz-Verwaltung bei euch:** Bereich „Lizenzen“ in eurer eigenen Instanz (nur Inhaber): Kunden anlegen, Edition/Module/Plätze/
  Laufzeit wählen, Schlüssel erzeugen und verlängern, Übersicht (läuft ab, aktiv), Verbindung zum CRM (Kunde = Firma, Mandat/Rechnung).
- **Einordnung:** Lizenzen kommen mit Paket 3 (Modul-Schalter) — die Schalter sind die Stelle, an der die Lizenz wirkt.
  Die Verwaltung kann vorher schon gebaut werden (nur Schlüssel erzeugen + Übersicht).

## Was die Demo zeigen sollte (Investoren-Rundgang, ca. 10 Minuten)
1. Heute — ein Blick: Termine, Fokus, was ansteht, ZOE-Vorschläge.
2. Kalender & Planen — Woche, Fokus-Blöcke, Aufgaben im Kalender, Zeitstrahl bis Ende nächsten Jahres.
3. Ziele → Meilensteine → Aufgaben — Fortschritt rechnet sich selbst.
4. Markttraktion — Kartei, Follow-up, Traktions-Index, Angebot.
5. ZOE — Frage stellen, Vorschlag im Stapel, Freigabe per Klick („Mensch entscheidet“).
6. Privat — Gesundheit/Routinen/Finanzen als zweite, gleichwertige Welt.
7. Sicherheit — Daten verschlüsselt, eigene Instanz, DSGVO-Werkzeuge.
