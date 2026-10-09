# Kritische Analyse: Sind ZOE und die Agenten sauber an die Daten angebunden?

Stand 09.10.2026, Branch `agenten-nacht` (nicht online). Auftrag Kevin: „Ich möchte einmal eine kritische Analyse über die Datenarchitektur. Ob das
Agenten-System und ZOE sauber überall angebunden sind.“ Vier unabhängige Durchsichten (nur gelesen, mit Datei:Zeile belegt): **Abdeckung**,
**Datenschicht**, **Ereignisse & Takt**, **Trennung & Plattform**. Die Einzelberichte liegen in der Sitzung unter `bericht/analyse/1–4`.

---

## 1. Urteil in fünf Sätzen

1. **Lesen ist gut gebaut:** ZOE und die Agenten holen fast alles über die offiziellen Filterstellen der Bereiche (Aufgaben-Sicht, `crmSicht`,
   maskierter Kalender, Art.-9-Wege, Postfach je Person). Der Agenten-Bereich (`lib/agenten/sicht.ts`) ist dabei das Vorbild.
2. **Schreiben ist nur halb sauber:** Der neue Weg über den Freigabe-Stapel und die offiziellen Routen (`crm_vorschlag` → `innen()`) ist
   vorbildlich. Ältere ZOE-Werkzeuge schreiben aber noch direkt in die Dateien, vor allem bei Finanzen und Meilensteinen. Dabei fehlen
   Rechteprüfung, Stand/409, Protokoll und Folgebuchungen.
3. **Das System läuft nach der Uhr, nicht nach Ereignissen:** Neue Daten (Mail, Zahlungseingang, Deal-Stufe, Absage) sind in Minuten im
   System. Kein Agent erfährt davon, bis sein nächstes Zeitfenster kommt, und das kann eine Stunde bis eine Woche dauern.
4. **Zwei Agenten-Welten leben nebeneinander:** Die alten Heads (Sales/Marketing/Event/Finance) und der neue Agenten-Bereich führen Schalter,
   Autonomie, Gedächtnis, Freigaben, Lauf-Status und Kosten jeweils doppelt. Dadurch laufen Zahlen auseinander und Sperren greifen nicht überall.
5. **Für Kunden-Instanzen fehlt noch Grundsätzliches:** Zentrale Konto-Sicht für „nur Business“, Instanz-Werte zur Laufzeit statt im Build,
   CRM-Team und Kalender aus den Konten statt fester Plätze, freie Gesellschaften statt drei fester.

**Warum die Prüfungen heute (Härtetest, Durchstich, Live-Durchklick) das nicht gefunden haben:** Sie haben Abläufe Ende zu Ende
geprüft, also ob ein Klick wirkt. Diese Analyse prüft die **Struktur**: welche Daten wo ankommen, über welchen Weg und mit welcher Regel.
Das sind zwei verschiedene Fehlerklassen.

---

## 2. Was trägt (bleibt so)

- **EINE Wirkungsstelle** `lib/zoe/ausfuehren.ts`: Risiko-Stufe, KI-Sperre, Business-frei, Trockenlauf, Stapel, Protokoll. Die Stufe kann
  nur verschärft werden.
- **KI-Tor** als einzige Stelle vor jedem Modellaufruf: Schalter, Einwilligung Gesundheit (b), EU-Mindeststufe, Pseudonymisierung,
  KI-Protokoll, Budget.
- **Lese-Filter der Bereiche:** `ladeAufgabenSicht`, `crmSicht` (Art. 18, private Notizen, IBAN), `termineFuerZoe` (im Systemlauf am
  strengsten), `profileFuerBetrachter`, `familieAuszug`, `stromFuer`. Für die Kartei erzwingt ein Wächtertest diese Wege.
- **Agenten-Bereich:** `sicht.ts`/`kontext.ts` sind rein, getestet und kennen `finanzRecht`. Werkzeug-Angebot = Katalog ∩ Schalter ∩ Einwilligung.
- **Warteschlange und Takt:** Der Takt fragt den echten Zustand ab, die Warteschlange hat Pacht-Token und Idempotenz-Schlüssel. Webhooks sind
  signiert, idempotent und haben einen Polling-Rückfall.
- **Inhaber-Modell** rein in `lib/zugang/inhaber.ts`. Alle Agenten-Bestände stehen mit Art.-15/17-Angaben im Speicher-Register.

---

## 3. Abdeckung: Was ZOE und die Agenten erreichen

| Bereich | Lesen | Schreiben | Bewertung |
|---|---|---|---|
| Aufgaben/Projekte | sauber (`ladeAufgabenSicht`) | nur anlegen; ändern/abhaken/verschieben **fehlt** | Lücke |
| Ziele/Meilensteine/Fokus | Nordstern, Jahresziele, nur Business-Meilensteine | `setze_meilenstein`/`setze_fokus` **direkt in die Datei**; Ziel anlegen fehlt | Umgehung + Lücke |
| Routinen/Kapazität/Machbarkeit | kaum (nur Säule im Index) | – | Lücke |
| Kalender | **nur heute** (Woche geladen, nie gezeigt), `freie_zeit` | `plan_block` über Stapel (sauber) | Lücke Woche |
| CRM/Markttraktion | 18 Lese-Werkzeuge über `crmSicht` | `crm_vorschlag` sauber; Altwerkzeuge **daneben** | sauber, doppelt |
| Mandate/Produkte/Gesellschaften | sauber | sauber bzw. bewusst nichts | sauber |
| Finanzen Business | Index, Kontextzahlen | 5 Werkzeuge **direkt in die Datei, ohne Rechteprüfung** | **kritisch** |
| Konten-Register, Finanzplanung, Steuern-Modul | – (Head of Finance mit **eigener** Steuerrechnung) | – | Lücke / doppelt |
| Haushalt privat | sauber | über Regeln/Freigabe | sauber (Etikett „finanzen“ statt „finanzen-privat“) |
| Gesundheit/Vitalwerte | sauber mit Einwilligung; **Fach-Agenten-Ergebnisse ohne Etikett** | Route | **kritisch** (siehe 4) |
| Sport, Körper-Profil | – | – | Lücke |
| Ernährung, Familie, Inbox, Brain, Dateiablagen, Medien | sauber | Einkauf/Notizen über Freigabe; Inbox nur lesen | sauber |

**ZOE höchstens 20 Werkzeuge:** Jedes Werkzeug ist über einen Bereich erreichbar, die Heads gleichen aus. Für **Steuern, Kapazität und
Sport** hat aber kein Head Daten. Eine Frage dazu landet im Leeren.

---

## 4. Befunde nach Schwere (Stand: in Arbeit = ein Korrektur-Agent läuft gerade)

### Kritisch
| # | Befund | Folge | Stand |
|---|---|---|---|
| K1 | Finanz-Werkzeuge (`setze_kontostand`, `erfasse_rechnung/-zahlung/-planposten`, `setze_ziele`) schreiben direkt `updateJson` | Ohne Stand/409 und ohne Protokoll. „Bezahlt“ setzt weder `bezahltAm` noch Buchung. Ein Konto **„nur Business“ schreibt über ZOE in private Bestände**, die ihm die Seite verweigert | in Arbeit |
| K2 | Business-Head of Finance bekommt Zahlen der **Selbstständigkeit** (Privat) samt Steuerterminen | Trennung Privat/Business verletzt, sichtbar auch für „nur Business“ | in Arbeit |
| K3 | Ergebnisse von Fach-Agenten (`run_agent`: Fokus, Performance, Ernährung) gehen **ohne KI-Etikett** zurück ins Gespräch; `/api/fokus` liefert Recovery ohne Einwilligung | Gesundheitswerte gelangen **ohne Einwilligung (b)** und am EU-Tor vorbei zum Modell | in Arbeit |
| K4 | Not-Aus/Sperren lassen bei **Lesefehler** durch (fail-open) | Mit beschädigtem Einstellungsbestand greift der Not-Aus nicht | in Arbeit |

### Wichtig
- **Warteschlange wird still gekürzt** (`slice(0, 400)`); bei vielen Heads fallen heutige Riegel weg. Dann laufen Morgen-/Abendlauf doppelt,
  Tageshöchstzahl und Fehlerpause werden zurückgesetzt. Head-Vorschläge `slice(-120)`, auch offene. *(in Arbeit)*
- **Überlappende Läufe:** Die Pacht (300 s) ist kürzer als ein Lauf. Derselbe Skill läuft doppelt, mit doppelten Kosten. *(in Arbeit)*
- **Ein Engpass:** Hakt der Morgenlauf, laufen an diesem Tag keine Heads, kein Head of Finance und kein Morgen-/Abendlauf. *(in Arbeit)*
- **Alte Heads ignorieren den neuen Not-Aus** beim Hand-Lauf, setzen trotz Zurückstufung selbst Aufgaben und löschen bei „Rückgängig“ hart
  (ohne Papierkorb). *(in Arbeit)*
- **Stiller Rückfall auf die Selbstständigkeit**, wenn bei einer Business-Buchung keine Firma angegeben ist. *(in Arbeit)*
- **Zwei Wege für dieselbe CRM-Aktivität:** `notiere_kontakt` ohne Anlass-Pflicht (§ 7 UWG), ohne Sperrliste, ohne Idempotenz. *(in Arbeit)*
- **„Nur Business“ im ZOE-Kern nicht durchgezogen:** Titel/Notizen privater Aufgaben gehen über ZOE an das Modell. *(teilweise in Arbeit, Grundsatz → E4)*
- **Bereich je Einheit fehlt im ZOE-Pfad:** Kasse, Forderungen, Schilde, Board zählen die Selbstständigkeit als Business. *(in Arbeit, außer `lib/brain.ts`)*
- **Löschfrist der ZOE-Gespräche greift nicht** (fest 12 Monate, nur beim nächsten Schreiben; DSGVO Art. 5 Abs. 1 e). *(in Arbeit)*
- **Tempo:** Ein Ein-Zeilen-Fehler im Zwischenspeicher (`RAUSCHEN`) macht bei jedem KI-Aufruf alle gemerkten Indizes ungültig. *(in Arbeit)*
- **Lese-Protokoll fehlt auf KI-Lesewegen** (Gesundheit anderer Person, Kontaktakte, Haushalt). *(offen)*
- **Steuertermine doppelt gerechnet:** Der Head of Finance und das Steuern-Modul können verschiedene Fristen nennen. *(offen → E7)*
- **Hintergrundläufe nur für den Haupt-Inhaber**, und im Systemlauf ohne Person im KI-Tor. *(Person: in Arbeit; je Person → E8)*

### Klein (gesammelt)
Rundung auf ganze Euro in zwei Werkzeugen · „PIPELINE“-Block aus der Zielliste statt aus den Deals · `hake_routine` verlangt die
Gesundheits-Einwilligung auch für Business-Routinen · Gruß im Empfang überschreibt den der anderen Person · Skill-Erfolgsquote zählt nicht ·
Chat-Züge verdrängen die Lauf-Historie · Pseudonymisierung nur für Kartei-Kontakte · Zeitzone in Heads/Finance von der Maschine.

---

## 5. Die vier strukturellen Schwächen

**A. Uhr statt Ereignis.**
- Heute reagiert kein Agent auf:
  - neue Mail oder WhatsApp eines Kontakts (die Power Hour schlägt sogar Nachfassen bei jemandem vor, der gerade geantwortet hat)
  - Zahlungseingang
  - Deal-Stufe, Lead wird SQL, neue Anfrage
  - Termin vom Gegenüber abgesagt
  - „An ZOE geben“ (läuft erst am nächsten Morgen)
  - Kapazität „nicht machbar“, Index-Ampel rot
- Die Skills haben den Auslöser „Ereignis“ schon, nur speist ihn keine Quelle.
- **Lösung:** EINE Ereignisstelle (siehe E1).

**B. Zwei Agenten-Welten.** Ein Thema liegt jeweils an mehreren Stellen:

| Thema | Stellen |
|---|---|
| Schalter | 2 |
| Autonomie | 2 |
| Gedächtnis | 4 |
| Freigaben | 3 Bestände |
| Lauf-Status | 4 |
| Kosten | 4 |

Das Lesemodell versöhnt sie mit Faustregeln (z. B. „gleicher Name ± 120 s“). Das hält nicht auf Dauer. **Lösung:** die alten Heads in den neuen
Bereich überführen (E2). Die heutigen Korrekturen schließen nur die gefährlichen Lücken (Not-Aus, Autonomie, hartes Löschen).

**C. Die Agenten-Datenschicht skaliert nicht.**
- `agenten-faeden--<person>` ist EINE Datei mit allen Threads, Nachrichten, Plänen und Merksätzen einer Person:
  - Sie wächst auf geschätzt 20–40 MB im Jahr.
  - Jede Nachricht schreibt die ganze Datei (entschlüsseln, parsen, verschlüsseln, fsync).
  - Der Takt liest sie jede Minute zweimal, „Läuft“ alle 30 Sekunden.
- `ki-protokoll--<Monat>` schreibt bei jedem Aufruf die ganze Monatsdatei.
- Auf 1 vCPU blockiert das den einzigen Thread. **Lösung:** Threads in Index + je Thread teilen (E3). SQLite erst danach und nur für
  reine Protokolle.

**D. Trennung als Einzelfälle statt als EINE Konto-Sicht.**
- „Nur Business“ prüfen etwa 12 Stellen einzeln, und „Bereich je Einheit“ ist im ZOE-Pfad an fünf Stellen nachgebaut (`!== 'privat'`).
- Der Agenten-Bereich hat die richtige Form (`kontoSicht`). Der ZOE-Kern hat sie nicht.
- **Lösung:** EINE `kontoSicht(person)`, eingehängt in Aufgaben-Sicht, `gatherBrain`, Stapel, Suche und Agentenliste (E4).

---

## 6. Was gerade parallel behoben wird (vier Korrektur-Agenten, je mit Wächtertest)

| Agent | Inhalt |
|---|---|
| ZOE-Schreibwege | K1, K2, Firma-Rückfall, CRM-Altwerkzeuge auf den einen Weg, Meilenstein/Fokus über die Route, `suche_arbeit` mit richtiger Sicht und Etikett, Kleinkram |
| Takt robust | K4 (fail-closed), Warteschlange/Head-Vorschläge nie kürzen, Pacht/Überlappung, Engpass Morgenlauf, CRM-Signale im Takt, Berliner Zeit, verpasste Läufe nachholen, Tageslauf je Person |
| Agenten-Datenschicht | RAUSCHEN, Not-Aus/Autonomie der alten Heads, Rücknahme mit Papierkorb, Skill-Quote, Löschfrist der Threads, agent-log, Gedächtnis/Finance nie kürzen, Empfang, Stapel-Dubletten |
| KI-Etiketten | K3 (Gesundheit über Fach-Agenten), Person im KI-Tor bei Systemläufen, Bereich je Einheit in Kasse/Schilden/Board, feste Personen im Head of Finance und Kalender-Vorschlag, Tageslauf-Aufgaben im richtigen Bereich |

---

## 7. Entscheidungen für Kevin (mit Empfehlung)

| # | Frage | Empfehlung | Wann |
|---|---|---|---|
| E1 | **EINE Ereignisstelle** bauen: Bestand `ereignisse--<haushalt>`, nur Kennungen, gespeist von Mail-Abgleich, Kontoauszug, CRM-Schreibweg, Kalender-Abgleich und „An ZOE geben“; liest der Takt für Ereignis-Skills und Heads | **Ja**, klein anfangen mit Mail, Zahlungseingang, Deal-Stufe/Anfrage und „An ZOE geben“ | vor dem 50-€-Live-Test bzw. Update 2 |
| E2 | Alte Heads in den neuen Agenten-Bereich **überführen** (ein Stapel, ein Gedächtnis, eine Schalter-Quelle, ein Lauf-Status) | **Ja**, als eigenes Paket | nach Update 2 (die gefährlichen Lücken sind jetzt zu) |
| E3 | **Threads-Ablage teilen** (Index + je Thread) und KI-Protokoll auf Tagesdateien | **Ja, jetzt**: Die Bestände sind noch nicht online, es gibt keinen Altbestand und keinen Rückweg-Ärger | vor Update 2 |
| E4 | „Nur Business“ gilt auch für **Aufgaben** (und damit für ZOE): EINE `kontoSicht` | **Ja**, Privat-Aufgaben sind privat; sonst sieht ein Business-Partner sie über ZOE | vor Update 2 |
| E5 | Fehlende Bereiche anschließen: Finanzplanung, Steuern, Konten-Register, Kapazität/Machbarkeit, Termine der Woche, Sport/Körper (nur eigene), Aufgaben ändern/abhaken | **Ja**, in dieser Reihenfolge: Woche → Aufgaben abhaken → Kapazität → Steuern/Finanzplanung → Sport | Woche + Aufgaben vor Update 2, Rest danach |
| E6 | Plattform: **CRM-Team aus den Konten**, Kalender als Personenliste, Instanz-Werte zur Laufzeit statt im Build | **Ja**, Voraussetzung für Testkunden und „nur Markttraktion“ | bis Q1 (Testkunden) |
| E7 | **Steuern EINE Quelle**: Head of Finance liest das Steuern-Modul statt eigener Termine | **Ja** (klein) | vor Update 2 |
| E8 | Morgen-/Abendlauf und Tageslauf **je Person** (heute nur Haupt-Inhaber) | **Ja**, mit eigener Einwilligung je Person | nach Update 2 |
| E9 | Freie Gesellschaften statt drei fester Plätze (`kdc/kdv/ug`) im Rechenkern | erst mit dem ersten Kunden, dessen Struktur nicht passt | später |

---

### Entschieden (Kevin, 09.10. nachmittags, Klickrunde)
- **E1 Ereignisstelle: ja, vor Update 2** — klein anfangen (Mail, Zahlungseingang, Deal-Stufe/Anfrage, „An ZOE geben“).
- **E3 Gesprächs-Ablage teilen: ja, jetzt** — Index + je Thread, solange nichts davon online ist (dazu KI-Protokoll auf Tagesdateien).
- **E4 „Nur Business“ gilt auch für Aufgaben und ZOE: ja** — EINE `kontoSicht(person)`.
- **E2 Alte Heads überführen: ja, nach Update 2** — als eigenes Paket; die gefährlichen Lücken schließen die Korrekturen von heute.
- Offen: E5–E9.

## 8. Messbar machen (damit das nicht wieder unbemerkt wächst)

- **Head of IT:** Befund, wenn ein Agenten-Bestand größer als 5 MB wird oder Schreiben/Parsen länger als 200 ms dauert
  (`messe('schreiben')` gibt es schon).
- **Wächter „kein direktes Schreiben“:** In `lib/zoe`, `lib/agenten` und `lib/heads` kein `updateJson`/`saveJson` auf Fach-Beständen außerhalb
  einer Liste mit Begründung, nach dem Vorbild von `KONTAKTE_LESER_ERLAUBT`.
- **Wächter „Etikett stimmt“:** Jede Datenquelle eines Werkzeugs bzw. Fach-Agenten nennt ihre KI-Kategorie, und der Test prüft sie gegen die
  gelesenen Bestände, statt nur ihr Vorhandensein.
- **Wächter „Sicht Business bekommt nichts aus Privat“** auch für ZOE: Gespräch, Kontext, Suche, Stapel.
