# Zeitreise-Prüfung — Nacht 30./31.10.2026 (Branch `nacht-datum`)

Die ganze Testreihe lief mit vorgestellter Uhr (`vi.useFakeTimers({ now: ZIEL, toFake: ['Date'] })`, Konfiguration nur lokal, nicht im Repo).
Mit Ziel **4.1.2027** waren 17 Dateien rot. Hier steht, was dahinter steckte.

Fall **a** = Nebeneffekt der Prüfung (die vorgestellte Uhr wird mit der echten Uhr von Dateisystem oder Shell verglichen), **b** = der Test hängt an
einem festen Datum, **c** = echter Fehler im Code.

| Datei | Fall | Ursache | Behebung |
|---|---|---|---|
| agenten-p4c-demo, betreiber-demo-probe, demo, fulfillment-c1-demo, fulfillment-c3-demo, fulfillment-stimmigkeit, neustart-umzug-demo (sowie der Saat-Teil von zahlen-stimmigkeit) | **c** | Demo-Saat (`lib/demo/saat-kreislauf.ts`): die Altbestands-Rechnung liegt „vor 120 Tagen, aber nicht vor dem 1.1.“ und wird „10 Tage später“ bezahlt. In den ersten zehn Januartagen liegt dieser Zahltag in der Zukunft, die Finanzplan-Route lehnt ab („Bezahlt am liegt in der Zukunft“, 400) und **die ganze Saat bricht ab**. Davon betroffen: Demo säen, Demo zurücksetzen (500) und jeder Test, der die Demo sät. | Neue reine Funktion `altbestandTage(heute)`: bezahlt wird höchstens heute, sonst unverändert. Test `tests/demo-jahreswechsel.test.ts` prüft jeden Tag eines Jahres. Live-Daten sind nicht berührt (nur die Demo-Saat). |
| zahlen-stimmigkeit (B14) | **b** | Der Test erwartet eine Steuer-Schätzung der Hauptgesellschaft aus Ist-Monaten. Die Saat legt Monatsabschlüsse nur „bis zum Vormonat im laufenden Jahr“ an, im Januar also keine. Die App zeigt dann richtig „Ist-Monate fehlen“ mit Weg zum Monatsabschluss. | Der Test unterscheidet: im Januar prüft er genau die Lücke (Text und Link `WEG.abschluss('ug')`), sonst wie bisher die Schätzung. |
| konto-sicht, aufgaben-firmenakte-sicht | **b** | Die Gegenprobe sucht die Aufgabe in den Lichtfäden (Engstellen, `top` mit 5 Einträgen). In der ersten Januarwoche stehen dort fünf überfällige Steuerfristen vom 10.12. und 31.12. (Gewicht 2,5) und verdrängen die Aufgaben (Gewicht 1). Das ist so gewollt. | Neue Hilfe `tests/fixtures/steuer-fristen.ts` hakt im Testbestand alle Steuerfristen um heute ab. Die Prüfung „Sicht X bekommt nichts aus Y“ bleibt unverändert. |
| social-instagram | **b** | Das Token des Tests hatte einen festen Ablauf am 30.12.2026, `posten` prüft aber gegen die echte Uhr. Ab dem 30.12. galt die Anmeldung als „abgelaufen“. | Ablauf relativ zu `Date.now()` (+60 Tage). |
| unternehmen-pflicht-titel | **b** | Der Stichtag war fest (31.10.), das Ereignis lag aber „vor 10 Tagen“ relativ zur echten Uhr. Im Januar lag das Ereignis damit nach dem Stichtag, und es gab keine fälligen Pflichten. | Das Ereignis liegt jetzt relativ zum STICHTAG. |
| datenschicht-betrieb, datenschicht-kern, phase0-oberflaeche, sicher-zugang-einrichten, fulfillment-c2-route | **a** | Sie vergleichen die vorgestellte Uhr mit der echten Uhr (mtime, Shell-`date`, Skript). | Nicht geändert. |

## Echte Code-Funde

- **Demo-Saat bricht vom 1. bis 10. Januar ab** (siehe oben, behoben). Wer die Demo-Instanz in dieser Zeit neu sät oder zurücksetzt, bekäme 500.

## Beobachtet, nicht geändert (Kevins Entscheidung)

- Steuern › Schätzung der Kapitalgesellschaften: im Januar gibt es im laufenden Jahr keinen Ist-Monat. Bis der Januar abgeschlossen ist, steht für das neue Jahr
  „Ist-Monate fehlen“. Das ist ehrlich, aber ohne Zahl. Möglich wäre, bis zum ersten Abschluss die Vorjahresmonate zu nehmen. Das wäre eine Regeländerung.
- Die Demo zeigt im Januar keine Monatsabschlüsse und damit kein Controlling-Ist. Sie zeigt nur, was vom Vormonat des laufenden Jahres an da ist.
- `components/os/steuern/SteuernView.tsx` hat den festen Text „(Abschluss Jan–Sep + Plan)“. Er stimmt nur für 2026 (reine Anzeige).

## Schlussprüfung

Alle 17 Dateien, mit `--maxWorkers=1`:
- Ziel 4.1.2027: 12 grün, rot nur noch die fünf Dateien aus Fall a.
- Ziel = jetzt (31.10., 01:33): 17 von 17 grün.
- Normale Konfiguration: 17 von 17 grün (232 Tests), dazu `tests/demo-jahreswechsel.test.ts` grün.
- tsc ohne Fehler, eslint auf den geänderten Dateien sauber.
