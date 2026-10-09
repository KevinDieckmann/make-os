# Gesundheits-Cockpit — Gestaltungsvorschlag zum Durchgehen

Stand: 09.10.2026 · Entwurf zum gemeinsamen Durchgehen mit der trainierenden Person (Hyrox), bevor gebaut wird.
Kevin 09.10.: „Die große Neugestaltung wartet, bis Malin ihre Daten drin hat und sagt, was sie braucht.“ Nichts hier ist aus echten Daten
abgeleitet — alle Beispiele sind erfunden. Tracking und Struktur, keine Trainings- oder ärztliche Beratung.

## Was es heute schon gibt (Stand Branch `gesundheit-cockpit`)

- **Daten:** WHOOP liefert je Tag Recovery, HRV, Ruhepuls, SpO2, Hauttemperatur, Schlaf (Dauer, Phasen leicht/tief/REM/wach, Bedarf,
  Leistung, Konsistenz, Effizienz, Störungen, Atemfrequenz), Strain, Energie (kcal), Schritte; je Workout Sportart, Dauer, Strain, kcal,
  Ø/max Puls, Distanz, Höhenmeter, Minuten je Herzfrequenz-Zone 0–5. Alles liegt je Person (Art. 9), andere sehen es nur mit „Teilen“.
- **Gesundheit › Heute:** drei Ringe Recovery · Schlaf · Strain (Strain mit Ampel nach der Tagesform), die Anspannung 1–5 als eigene
  Einschätzung, zwei kleine Karten „Schlaf“ und „Körperwerte“ (gegen den eigenen Ø der 7 Tage davor), Sport-Kachel, WHOOP-Karte,
  Unterlagen, Routinen, Drei Fragen. Verlauf 30 Tage inkl. Strain. Index mit „Belastung zur Tagesform“ und „Schlaf gegen Bedarf“.

## Vorschlag: Aufbau von oben nach unten (Handy zuerst)

Jede Karte beantwortet genau eine Frage. Eine Hauptaktion je Ansicht (heute: den Tag eintragen bzw. das geplante Training öffnen).

| # | Karte | Frage, die sie beantwortet | Inhalt (Beispiel erfunden) |
|---|---|---|---|
| 1 | **Tageskarte** | Wie bin ich heute drauf — und was heißt das? | Ringe Recovery · Schlaf · Strain mit Tiefe; darunter EIN Satz aus einer reinen, getesteten Regel, z. B. „Recovery grün, Strain bisher niedrig → Spielraum für eine harte Einheit“. Anspannung 1–5 als eigene Einschätzung darunter. |
| 2 | **Heute geplant** | Passt das geplante Training zur Tagesform? | Geplante Einheit aus Sport › Woche (z. B. „Hyrox-Simulation 60 min“) + Strain-Rahmen des Tages (z. B. „Rahmen 14–18“) + Hinweis, wenn Plan und Tagesform auseinanderliegen (Vorschlag tauschen/verkürzen — nur Vorschlag). |
| 3 | **Schlaf** | Habe ich genug und regelmäßig geschlafen? | Geschlafen gegen Bedarf (Balken), Phasen als ein Balken, Konsistenz der letzten 7 Nächte, Schlafschuld. |
| 4 | **Körperwerte** | Weicht mein Körper von meinem Normal ab? | HRV, Ruhepuls, Atemfrequenz, SpO2, Hauttemperatur — immer gegen den eigenen 7-Tage-Bezug, nie als absolute Ampel. |
| 5 | **Training · Woche** | Wie verteilt sich meine Belastung? | Strain je Tag der Woche (kleine Säulen in der Farbe der Tagesform), letzte Workouts mit Minuten je Herzfrequenz-Zone, Einheiten Plan/Ist. |
| 6 | **Verläufe** | Wohin geht der Trend? | 7 / 30 Tage umschaltbar: Recovery, HRV, Ruhepuls, Schlaf, Strain — als kleine Linien. |
| 7 | **Wettkampf-Ziel** (nur mit Ziel) | Bin ich auf Kurs zum Wettkampf? | Wochen bis zum Ziel, Stationen-Schwächen aus Hyrox, Laufzeiten-Prognose (vorhandene Sport-Rechnungen). |
| 8 | Bestehend, weiter unten | — | Routinen, Drei Fragen, Unterlagen & Gesundheits-Agent, WHOOP-Verbindung, Körper-Profil (Reiter), Ernährung (Reiter). Nichts fällt weg. |

Regeln, die gleich bleiben: die Fläche bleibt gestaltbar (Kacheln verschieben/ausblenden, der Standard wird nie gespeichert); keine Null,
fehlend = „—“; die drei Teal-Töne nie gemeinsam als Serien; Zahlen in Ringen weiß; am Handy 375 px ohne Querscrollen.

## Fragen an die trainierende Person (zum Durchgehen)

1. **Ziele:** Welches Ziel zählt gerade am meisten (z. B. Wettkampf mit Datum, Zeitziel, Pro-Division, allgemeine Fitness)? Gibt es Zwischenziele?
2. **Disziplinen:** Welche Einheiten machst du in einer normalen Woche (Laufen, Kraft, Hyrox-Stationen, Rad, Mobility …)? Welche trackt WHOOP
   schon richtig, welche trägst du von Hand ein?
3. **Wochenrhythmus:** Wie sieht eine typische Woche aus — welche Tage hart, welche locker, wann Ruhetag? Gibt es feste Trainingszeiten?
4. **Morgens zuerst:** Was willst du als Allererstes sehen, wenn du die Seite öffnest — Recovery, das geplante Training, den Schlaf?
5. **Was nervt heute?** Was fehlt dir in der WHOOP-App oder hier, was suchst du zu lange, was ist zu viel?
6. **Belastungs-Rahmen:** Passt der Vorschlag „Recovery grün → Strain 14–18, gelb → 10–14, rot → bis 10“ zu deinem Training, oder brauchst du
   eigene Grenzen (z. B. in Wettkampfwochen)?
7. **Herzfrequenz-Zonen:** Sind dir die Zonen je Einheit wichtig (z. B. Anteil Zone 2 beim Lauf)? Wenn ja: je Einheit oder als Wochensumme?
8. **Erholung:** Welche Werte nimmst du ernst, wenn es dir nicht gut geht (HRV, Ruhepuls, Hauttemperatur, Atemfrequenz)? Ab wann willst du
   einen Hinweis — oder lieber keinen?
9. **Ernährung & Gewicht:** Gehört das ins Cockpit (heute bewusst ohne Körpermaße — WHOOP-Scope `read:body_measurement` ist nicht angefragt)?
10. **Teilen:** Wer soll was sehen (Partner, Coach)? Heute: nichts, außer du teilst Gesundheit ausdrücklich.
11. **ZOE:** Soll ZOE dir aus diesen Werten einen Tagesvorschlag machen? (Nur mit deiner Einwilligung „an die KI“.)

## Offen / Annahmen (zum Bestätigen)

- Der Strain-Rahmen je Recovery-Zone ist eine eigene Regel (WHOOPs „Strain Coach“-Ziel gibt die API nicht heraus).
- Zyklus-Tag: ein WHOOP-Zyklus, der ab 18 Uhr Ortszeit beginnt, zählt zum Folgetag (die Doku sagt nicht, ob er mit dem Einschlafen oder dem
  Aufwachen beginnt) — bitte an einem Abend mit spätem Training prüfen, ob der Strain am richtigen Tag steht.
- Atemfrequenz in Atemzügen je Minute (die Doku nennt keine Einheit).
