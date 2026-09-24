# Funde in MAKE.ORGA — für Malin

Stand 24.09.2026. Beim Übernehmen deines Finanz-Cockpits in MAKE OS habe ich
deine komplette Übergabe gelesen und deine Tests nachgebaut. Dein Datenmodell
und deine Regeln tragen — die Wortgrenzen, die Einnahme-Töpfe, der Turnus, die
Kontrollsummen beim Import. Der N26-Parser liefert in MAKE OS beim echten
Januar-Auszug exakt deine Summen, auf den Cent.

Diese Punkte sind mir dabei aufgefallen. In MAKE OS sind sie behoben; in deinem
Cockpit stecken sie noch — falls du bis zum Umzug weiter damit arbeitest.

## Blocker

1. **Nie mehr als 1.000 Buchungen.** Supabase gibt je Abfrage höchstens 1.000
   Zeilen heraus, und das Cockpit blättert nicht weiter.
   - `sicherung.js` sortiert aufsteigend: Die Sicherung vom 24.09. enthält
     genau 1.000 Buchungen vom 01.01. bis 16.05. — alles danach fehlt.
   - `daten.js` lädt absteigend mit `limit(5000)`, bekommt aber auch nur
     1.000: das Cockpit sieht die ÄLTESTEN Buchungen nicht, die 12-Monats-
     Analyse ist dadurch unvollständig.
   - Der Umzug nach MAKE OS liest deshalb direkt und blätternd aus Supabase
     und prüft gegen die Zeilenzahl, die Supabase selbst meldet.
2. **Zeitzone verschiebt alle Monate.** `new Date(j, m, 1).toISOString()` ist
   in Berlin 22 bzw. 23 Uhr am Vortag in UTC. Folge am 24.09.:
   „Letzter Monat“ = Juli statt August; der Vormonatsvergleich greift zwei
   Monate zurück; das Fixkosten-Fenster ist um einen Monat verschoben. Deine
   Tests merken es nicht, weil sie die Monate genauso bauen.

## Rechenregeln

3. **„Einnahmen“ dreimal verschieden.** Die Analyse lässt Kredite und
   Rückzahlungen korrekt draußen. „Luft pro Monat“ (Fixkosten) und „Umsatz“ in
   Ist gegen Soll zählen sie mit — nach einem Kredit sieht die Luft größer aus.
4. **Tilgung halb gezählt.** Die Analyse kennt nur die Kategorie „Tilgung“,
   Ist gegen Soll auch „Kredit & Raten“. Schuldenabbau und Prognose fallen zu
   niedrig aus.
5. **Kreditrate doppelt im Sockel.** Ist die Rate als Fixkosten markiert,
   zählt sie einmal als Fixkosten-Posten und noch einmal als Rate aus der
   Schuldenliste.
6. **Regeln verlieren gegen die N26-Kategorie.** Der Kommentar in `import.js`
   sagt „Eigene Regeln haben Vorrang“, `R.anwenden` setzt die Kategorie aber
   nur, wenn noch keine gesetzt ist — die N26-Kategorie gewinnt.
7. **Zweiter gleicher Kauf am selben Tag fällt weg.** Zwei Kaffee zu 3,20 € am
   selben Tag haben denselben Fingerabdruck; der zweite wird als Dublette
   verworfen. MAKE OS zählt gleiche Zeilen in einer Datei durch.

## Datenmodell und Pflege

8. **Schema weicht von der Wirklichkeit ab.** Belege und Budgets nutzen
   `art`, `betrag`, `empfaenger`, `einheit`, `notiz`, `bezahlt_am` und
   `kategorien.monatsbudget` — die stehen in keiner SQL-Datei, sie wurden in
   Supabase direkt angelegt (wie früher `ist_fixkosten`).
9. **Einheit heißt mal `selbst`, mal `selbststaendigkeit`.**
10. **Kategorien:** 37 statt der geplanten 15, mit Doppelungen
    (Mobilität/Mobilitaet, Tilgung/Kredit & Raten). Die N26-Zuordnung liefert
    Namen wie „Shopping“ oder „Essen auswärts“, die es im Grundbestand nicht
    gibt — solche Buchungen bleiben still unzugeordnet.
11. **pdf.js 3.11.174** ist von CVE-2024-4367 betroffen — du hast es mit
    `isEvalSupported: false` bereits entschärft. MAKE OS nutzt 4.10.38 lokal
    statt über ein CDN.
12. **Echte Kontodaten in Projektdateien:** `sql/make-orga-migration-v1.sql`
    (1.272 echte Buchungen — die Übergabe sagt, sie sei nicht enthalten),
    `KD-Finanzen-*.json`, `tests/daten/n26-januar-2026-zeilen.json`. Liegt alles
    im MAKE-Ordner (iCloud). Nichts davon gehört in ein Git-Repo.

## Für den Umzug

- **Einfrieren:** `docs/make-orga/einfrieren.sql` im Supabase SQL-Editor —
  danach kann niemand mehr schreiben, lesen geht weiter.
  `auftauen.sql` holt die Schreibrechte zurück.
- **Übernahme:** in MAKE OS unter Zahlen → Privat → „Aus Malins Cockpit“.
  Erst Probelauf mit Abgleich, dann übernehmen. Dafür einmal mit deinem
  Supabase-Zugang anmelden — das Passwort geht nur an Supabase.
