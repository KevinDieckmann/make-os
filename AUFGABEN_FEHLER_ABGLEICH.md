# Abgleich: Aufgaben-Management gegen die 100-Fehler-Prüfliste (28./29.09.2026)

Grundlage: `AUFGABEN_FEHLER_PRUEFLISTE.md`. Zwei Prüfer haben den Code lesend dagegen geprüft (Stand 118e6a3). Vollständige Tabellen (Beleg Datei:Zeile, Szenario, Aufwand) in den Prüfberichten der Sitzung.

## Ergebnis
| | #1–50 | #51–100 |
|---|---|---|
| erfüllt | 21 | 17 |
| teilweise | 16 | 22 |
| Lücke | 8 | 8 |
| nicht relevant | 5 | 7 |

Zusätzlich die Speicher-/Brain-Prüfung (Befunde A1–A9, B1–B4) — Reparatur läuft als Pakete S1 (Speichern) und S2 (Brain).

## Dringendste Lücken
1. Stiller Verlust bei Netz-/Serverfehler, 409 verwirft Charge und Entwurf, alte Tabs überschreiben (#47–#49, #52) → Paket S1.
2. Eingang-Route verwirft Listen/Gruppen/Status/Vorlagen; beschädigter Bestand zeigt Beispiel-Aufgaben (#53) → S1 + Nachtrag.
3. Serie lässt sich nicht überspringen/beenden (#29); wiedereröffnet → zwei offene Instanzen (#12).
4. Statuswechsel an zehn Stellen verteilt, Direktschreiber ohne completedAt/Verlauf/Serie (#12, #13, #74).
5. Kein Papierkorb/Rückgängig, Dateien als Waisen (#6, #7, #73, #87) → S1 (Papierkorb) + Rückgängig.
6. ZOE-Freigabe ohne Stand überschreibt neuere Änderungen (#95); Sammelfreigabe ohne Diff (#94); Datumsprüfung (#96); `create_task` für andere Person ohne Freigabe (#93); keine Charge/Rückgängig (#97).
7. Follow-up und Aufgabe = doppelte Wahrheit (#99).
8. Keine Sichtbarkeit „nur ich“ (#39, #59).
9. Server übernimmt Zeitstempel/ungeprüfte Daten aus dem Browser, `assignee` beliebig, `zoe.status` per PATCH (#14, #20, #40, #78).
10. Schnell-Anlegen erfindet Fristen („so“, „31.02.“) (#21).
Weiter: Elternaufgabe mit offenen Kindern (#66), Unteraufgaben-Fristen (#68), Werktage/Feiertage + `start ≤ due` (#22, #70), Mandanten-Bezug beim Verschieben nach Privat (#4), Suche-Normalisierung + Suchfeld (#58), Barrierefreiheit (#62, #88, #89, #90), Export (#81), Backup außer Haus + Probe-Restore + `schemaVersion` (#83), Performance/ETag (#84–#86), Tie-Breaker Sortierung (#56), Blockierte in Kacheln/Glocke (#36), Bündelung Zuweisungen (#42), Hinweis „Aufgabe gibt es nicht mehr“ (#45), Kommentare weich löschen (#76), Telegram/Tageszusammenfassung (#91).

## Entscheidungen Kevin (29.09.)
- **„Nur ich“ als Sichtbarkeit** je Aufgabe (serverseitig auf allen Lesepfaden: Überblick, Suche, Kalender, Glocke, ZOE, CRM-Akten).
- **Eine Hauptverantwortliche + Beteiligte** statt „Beide“; Bestand: Anlegerin = verantwortlich, die andere = beteiligt.
- **Serien:** Rhythmus „ab Erledigung“, **Wechsel Kevin/Malin (Rotation)**, **Status „abgebrochen“** (zählt nicht als erledigt, gibt nicht frei, keine Folgeinstanz), **Feiertage NRW** für Werktage/Fristen.
- **KI-Filter nach Mandant (#79):** entfällt — Kevin hat entschieden „ZOE darf alles lesen“; Leitplanken (Art. 18, private Notizen je Person, IBAN, „nur ich“-Aufgaben) bleiben. AVV mit dem KI-Anbieter organisatorisch ablegen.
