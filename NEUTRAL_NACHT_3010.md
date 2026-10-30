# Neutral für Testkunden: Nachtlauf 30.10.

Branch `nacht-neutral` (Basis 9c3e6fa2). Auftrag von Kevin am 30.10. nachts: „Neutralisieren für Testkunden“ (ROADMAP_Q4.md, Phase 3). Eine leere Kunden-Instanz soll sauber starten. In Code, Texten und Vorgaben steht dafür keine feste Person, Firma, Domain oder Marke mehr.

Was gespeichert ist, bleibt bit-gleich. Speichernamen und Fach-Kennungen (`kevin`/`malin`) in den Daten habe ich nicht umbenannt. Neutral gemacht habe ich nur Code-Logik und sichtbare Texte.

## Ausgangslage

Seit dem Suchbericht vom 08.10. (`PRIVATE_INHALTE_SUCHE.md`) ist schon viel erledigt: Prompts, Team, Vault-Sicht, Fächer und Finanz-Anzeige. Die systematische Suche über `app/ lib/ components/ hooks/ context/ scripts/ deploy/` (ohne Kommentare) fand noch:

- 83 Zeilen mit festen Kennungen in 43 Dateien;
- eine Handvoll Namen, Firmen, Domains und Markennamen.

Die meisten Kennungen sind die zwei **Fächer** des Altbestands, also Kalender-Zuordnung und Finanzkern. Das ist gewollt, siehe `lib/make-one/fach-namen.ts`. Echte Logik-Sonderfälle waren die Stellen unten.

## Neutralisiert

| Stelle | vorher → nachher | Test |
|---|---|---|
| `lib/make-one/fach-namen.ts` | neu `fachDerPerson(speicher, personen)`: Fach einer Person über die Konten; ohne Konto „gleicher Speichername gewinnt“ | neutral-nacht › Fächer |
| `lib/kalender/einstellungen.ts` | neu `fachVonPerson(person)` (Server, über `fachKonten`) | kalender-k1-route |
| `app/api/kalender/termin/route.ts` | Kalender der anlegenden Person: vorher nur Speichername `kevin`/`malin` → Fach über die Konten. Pia (Inhaberin) bekommt jetzt ihren Kalender statt 400 | kalender-k1-route |
| `components/os/kalender/Planen.tsx` | eigenes Fach: vorher `speicher === 'malin'` → `fachDerPerson`; `sicht === 'kevin' \|\| …` → `istFach` | tsc |
| `components/os/kalender/Kalender.tsx` | Vorgabe `wer` beim Anlegen: vorher Speichername als Fach → `fachDerPerson` | tsc |
| `components/os/kalender/MitPlanen.tsx` | Speichername wurde als Fach gecastet, Rückfall `'kevin'` → `fachDerPerson` / `FAECHER[0]` | tsc |
| `components/os/kalender/Buchungsseiten.tsx` | Seiten-Person → Fach über die Konten; Vorgabe-Person vorher `'kevin'` → erste Person des Haushalts, sobald geladen | buchung-rk2 |
| `components/os/kalender/Zeitraster.tsx`, `NeuerTermin.tsx`, `lib/kalender/formular.ts`, `eingabe.ts`, `aufgaben.ts` | Literale → `FAECHER`/`istFach`/Typ `Fach` (gleiches Verhalten) | tsc, neutral-nacht |
| `app/api/apple-calendar/route.ts` | `owner === 'kevin' \|\| 'malin'` → `istFach` | tsc |
| `lib/kalender/icloud.ts` | Einordnung im `calendar-cache`: drei feste Kalendernamen (`privat kevin`, `kevin dieckmann` …) → dieselbe Zuordnung wie der Altweg (Einstellungen + voller Name im ersten Fach). Live gleich (Fixture `KONTEN_WIE_LIVE`) | oberflaeche-neutral (altwegKalender = alte Tabelle), kalender-icloud-abgleich |
| `lib/aufgaben/saeubern.ts` | Projekt-Besitz: vorher wurde jede fremde Person still `both` → jeder Speichername bleibt (`ownerSauber`); Aufgabe ohne Zuständigkeit: vorher `'kevin'` → `both`, löst `beideAufloesen` auf die erste Person des Haushalts auf | neutral-nacht › Besitz |
| `lib/aufgaben/vorlagen.ts` | `OWNER = ['kevin','malin','both']` → `ownerSauber` | aufgaben-vorlagen-t2 |
| `lib/aufgaben/struktur.ts` | `zustaendigeVon` mit Vorgabe `['kevin','malin']`: ohne Aufrufer, entfernt | tsc |
| `lib/finanzen/haushalt/aufgaben.ts` | Beleg-Aufgaben: vorher `malin` oder sonst `kevin` → `belegZustaendig` (Verursacher = Person des Haushalts, sonst `both`). Live gleich | neutral-nacht › Belege |
| `lib/finanzen/haushalt/testdaten.ts` | Test-Haushalt: „Testkonto Kevin/Malin“ → „Person A/B“ | – |
| `app/api/state/arbeitsplatz/route.ts` | nur `kevin`/`malin` speicherbar, Vorgabe `kevin` → jeder Speichername, ohne Eintrag keiner (keine Leser) | – |
| `app/api/state/netzwerk/route.ts` | `besitzer` nur `kevin`/`malin`/`beide`, Rückfall `kevin` → Speichername oder `beide`, sonst die Sales-Verantwortung des Teams | – |
| `app/api/crm/lead/route.ts` | Fehlertext „(kevin oder malin)“ → „eine Person aus dem Team“ | – |
| `components/os/finanzplan/Ueberblick.tsx` | Wochen-Check: Bestätiger fest `['kevin','malin']`, Rückfall `'kevin'` → Konten des Haushalts + wer schon bestätigt hat; ohne Person kein Knopf | tsc |
| `components/os/finanzplan/Monat.tsx` | Monatsabschluss `wer: person \|\| 'kevin'` → Person der Sitzung | tsc |
| `lib/flaeche/register.ts`, `lib/prozesse/kundengewinnung/welle3.ts` | „Make.One“ fest → `MARKE_EVENTS` (live gleich) | flaeche-register, neutral-nacht 4 |
| `lib/make-one/agents-data.ts` | „KD-Ventures-Pipeline“ → „Beteiligungs-Pipeline“ | neutral-nacht 4 |
| `lib/make-one/roadmap-data.ts` | Bauplan-Phasen nannten Malin und Reha → Team, Bewegung | neutral-nacht 2 |
| `components/os/crm/marketing/Checks.tsx` | Hinweis nannte `fokusinnovation.de/check` → „eigene Website-Adresse“ | neutral-nacht 3 |
| `deploy/whatsapp-verbinden.sh`, `zoe-whatsapp-verbinden.sh` | Rückruf-URL fest `app.makeinnovation.de` → `MAKE_OS_ADRESSE` aus der `.env`; Bereichs-Frage ohne Firmennamen | neutral-nacht › deploy |
| `deploy/google-verbinden.sh` | Domain-Vorgabe `makeinnovation.de` → die schon eingetragene `GOOGLE_ERLAUBTE_DOMAIN`, sonst Pflichtangabe | neutral-nacht › deploy |
| `deploy/vault-hochladen.sh` | Ziel-Repo fest auf Kevins GitHub → 2. Argument oder `MAKE_VAULT_REPO` | neutral-nacht › deploy |
| `deploy/server-einrichten.sh` | „Mac/Kevin“ → „Mac des Inhabers“ | neutral-nacht › deploy |

**Hinweis für Kevin zu `vault-hochladen.sh`:** Ohne Argument bricht das Skript jetzt mit Erklärung ab. So geht es weiter wie bisher:

```
MAKE_VAULT_REPO=git@github.com:<konto>/<vault>.git deploy/vault-hochladen.sh
```

## Wächter

`tests/neutral-nacht.test.ts` liest jede Datei unter `app/ lib/ components/ hooks/ context/` (ohne Kommentare). Er wird rot bei:

1. einem Literal `'kevin'`/`"malin"`/`` `kevin` ``;
2. Vor- oder Nachnamen der gewachsenen Instanz;
3. fremden Firmen oder Produkten (KEMARIS, POINCAP, CapOS, ASTARNA, KD Management, One Buddy, onebanking …) und festen Domains (`makeinnovation.de`, `fokusinnovation.de`, sslip, Server-IP);
4. `Make.One` außerhalb von `lib/crm/marke.ts` und Gesellschaftsnamen außerhalb von `lib/einheiten.ts`;
5. einer festen Domain, Kevins GitHub-Konto oder Namen in den fünf Einrichtungs-Skripten.

Ausnahmen stehen je Datei mit Grund in der Liste. Eine Ausnahme ohne Fund ist veraltet und macht den Wächter ebenfalls rot. Dazu kommen Verhaltensfälle mit erfundenen Personen (Pia, Olaf), mit Altbestand bit-gleich.

## Tests

Ich habe nur gezielte Läufe gemacht, keine volle Testreihe und keinen Bau. Alle grün:

- neutral-nacht, neutral-rest, oberflaeche-neutral;
- aufgaben-vertiefung, aufgaben-serie, aufgaben-vorlagen-t2, aufgaben-t1-modell, aufgaben-t1-server, aufgaben-route, zoe-aufgaben;
- kalender-icloud-abgleich, kalender-k1-route, kalender-k5, kalender-eintraege, google-ziel, business-frei-termin;
- k1-haushalt, sicher-s1-routen, flaeche-register, buchung-rk2.

tsc ist ohne Fehler, eslint auf allen geänderten Dateien ohne Befund.

## Offen: braucht Kevins Entscheidung

| Stelle | Warum nicht geändert |
|---|---|
| `lib/kalender/space.ts` | Die Business-Erkennung am Kalendernamen kennt `kemaris\|dieckmann`. Auf der Live-Instanz hängt daran, ob der Holding-Kalender als Business zählt. Neutral geht es erst mit einer Zuordnung in den Kalender-Einstellungen der Live-Instanz (Kalender › Einstellungen › Bereich), danach kann das Muster raus. |
| Finanzkern-Felder (`kevinBrutto`, `malinNetto`, `darlehenKevin`, `astarna` …) in `lib/finanzen/rechenkern.ts` und `components/os/finanzplan/*` | Kern-Regel „Namen/Formeln unverändert bis Kevins Wort“. Angezeigt wird schon „Gehalt 1/2“ bzw. der Vorname aus den Konten und „Provision“. Umbenennen mit Lesen der alten Felder und `KERN_STAND` wäre Paket 7 im Suchbericht. |
| `lib/zoe/raum.ts` `ERSTKONTO` | Die Bestände des Erstkontos liegen ohne Suffix. Neutral geht es nur mit einer Daten-Migration (`<basis>--kevin`), auf Live heikel. |
| `lib/zugang/konten.ts` `RESERVIERTE_SPEICHER` | Schützt die Fach-Zuordnung „gleicher Speichername gewinnt“. In einer Kundeninstanz ist die Reservierung harmlos. Je Instanz aus der Einrichtung ginge mit einer neuen Variable. |
| `lib/make-one/crm.ts` `privatNotizVerfasser` | Alte private Notizen ohne `privatNotizVon` gelten als vom Erstkonto. Neue tragen immer die Person, deshalb so gelassen. |
| `lib/planung/wochenplan-uebernahme*.ts`, `lib/altbestand/nordstern-uebernahme.ts` | Einmalige Übernahmen des Altbestands. Sie fallen nach der Übernahme bzw. mit dem übernächsten Upload weg. |
| `lib/check/vorlagen/innovations-check/scoring.json` | Der Siegel-Name „MAKE Innovations-Check“ ist Produktinhalt. Offen ist, ob die Vorlage je Instanz kommt. |
| `deploy/sicherung-abholen.sh` | Die Vorgabe `make@2.28.108.162` habe ich bewusst gelassen, weil die nächtliche Abholung am Mac sonst ohne `MAKE_OS_ABHOL_HOST` bricht. Vorschlag: die Variable in der Mac-Abholung setzen, dann die Vorgabe streichen. |
| `deploy/vault-hochladen.sh` (Mac-Pfade `~/Vaults/MAKE`, `~/Desktop/MAKE`) | Eigene Mac-Pfade mit `$HOME`. Ein Kunde gibt den Pfad als erstes Argument mit. |
| `scripts/update-probe/*`, `scripts/website-logo.mjs`, `scripts/fokus-seite.mjs`, `scripts/business-auf-null.mjs` | Werkzeuge der eigenen Instanz bzw. Website. Die Update-Probe simuliert bewusst den Altbestand mit `kevin`/`malin`. Nicht im Wächter. |
| Kalendermodell `Wer = 'kevin' \| 'malin' \| 'beide'` (`lib/kalender/belegt.ts`, `einstellungen.ts`, `schnell.ts`, `components/os/kalender/teile.tsx`) | Das ist die Fach-Kennung in den gespeicherten Einstellungen. Namen kommen schon aus den Konten. Mehr als zwei Personen je Kalender-Zuordnung wäre ein eigenes Paket (Plattform-Schuld). |
