# Firma und Privat getrennt — auch in der Datenhaltung

Stand 09./10.10.2026 · Branch `trennung-plan` · Analyse und Plan, **kein Umbau bestehender Bestände**.
Kevin, 09.10. spät: „Höchster Datenschutz, Firma und Privat müssen immer getrennt liegen, auch von den Daten, sonst kriegen wir es
nachher nicht in Firmen implementiert.“

## Kurz (für Kevin)

1. MAKE OS hat heute **208 Bestände** im Speicher-Register. Davon liegen **6 rein privat**, **37 rein im Business**, **39 je Person**
   (Gesundheit, Zugänge, eigene Einstellungen), **48 sind Betrieb der Instanz** — und **78 sind gemischt**.
2. „Gemischt“ heißt: Privat und Business stehen in **derselben Datei**, getrennt nur über ein Feld (Space, Ort, Gesellschaft, Bereich)
   — oder gar nicht. Gelesen wird heute fast überall **serverseitig gefiltert**, getrennt **abgelegt** ist es nicht.
3. Die großen Brocken: **Aufgaben** (`tasks`), **Ziele/Meilensteine/Routinen**, **Kalender-Spiegel**, **Finanzen** (Finanzplan,
   Buchungen, Rechnungen, Abschlüsse, Steuern, Konten), **ZOE und Agenten**, **Postfächer**.
4. Bei gut einem Dutzend Beständen kommt die Mischung allein von der **Selbstständigkeit**: Sie gehört seit 05.10. zu Privat, steht
   aber in denselben Beständen wie KD Ventures und MAKE (Rechnungen, Abschlüsse, Deals, Mandate, Steuern, Kapazität).
5. **Empfehlung:** Mischform — erst bekommt jeder Bestand seinen Bereich **im Namen** (`tasks--privat`, `tasks--business`), danach
   wandert jeder Bereich in einen **eigenen Ordner mit eigenem Schlüssel und eigener Sicherung**. Gelesen wird „beides“ nur über
   **eine Leseschicht**, die die erlaubten Bereiche einer Sicht zusammenführt — nie über einen gemischten Bestand.
6. **Heute gebaut:** jeder Bestand trägt im Register seinen Bereich, und ein Wächter (`tests/trennung-bereiche.test.ts`) sorgt dafür,
   dass **kein neuer Bestand gemischt** ist und die Liste der gemischten **nur kürzer** wird. Sonst ändert sich nichts.
7. Plan in 6 Stufen, zusammen **etwa 35–45 Arbeitstage**; zuerst Altlasten löschen und die Leseschicht bauen, dann Finanzen (größter
   Datenschutz-Nutzen), dann Aufgaben/Planung, Kalender, Postfächer, ZOE; Ordner/Schlüssel erst, wenn nichts Gemischtes mehr übrig ist.
8. Jeder Umzug läuft wie der Neustart-Umzug: Sicherung zuerst, Absichtsprotokoll, idempotent, alles zurückgelesen und verglichen.
9. Der **Firmen-Export** (eine Gesellschaft bekommt ihre eigene Instanz) baut auf dem vorhandenen Neustart-Umzug auf.
10. **Befund nebenbei:** 6 Bestände stehen gar nicht im Register — darunter der **Gesundheits-Index** (Art. 9), den „Konto löschen“
    heute liegen lässt (eigene Aufgabe vorgeschlagen).

## Entscheidungsfragen (mit Empfehlung)

| # | Frage | Empfehlung |
|---|---|---|
| 1 | **Wie fein trennen?** Nach Bereich (Privat · Business) oder nach Gesellschaft (Privat · Selbstständigkeit · KD Ventures · MAKE · weitere)? | **Nach Bereich** als physische Trennung (Ordner, Schlüssel, Sicherung). Die Gesellschaft bleibt **Pflichtfeld** jedes Business-Eintrags — damit lässt sich eine einzelne Gesellschaft später herausziehen. Je Gesellschaft ein Ordner wäre bei frei angelegten Gesellschaften (`g-…`) zu viel. |
| 2 | **Wo liegt die Kundenarbeit der Selbstständigkeit** (Deals, Mandate, Angebote, Kontakte ihrer Kunden)? (A) alles der Selbstständigkeit im Privat-Fach · (B) Kartei + CRM ganz im Business, nur **Geld** (Rechnungen, Buchungen, Abschluss, Steuern, Konto) folgt dem Bereich der Einheit · (C) die Selbstständigkeit bekommt ein eigenes drittes Fach | **(B).** Die Markttraktion ist ein eigenes, einzeln verkaufbares Modul — sie bleibt ganz. Geld und Steuern der Selbstständigkeit liegen privat (so wie Kevin es am 05.10. für Finanzen entschieden hat). Folge: `kontakte`, `crm`, `mandate-tabelle-laeufe` werden „business“ (Liste −3). Für einen Firmen-Export wird die Kartei ohnehin je Gesellschaft gefiltert. |
| 3 | **Verweise über die Grenze?** Darf eine private Aufgabe auf einen Business-Kontakt zeigen, eine Business-Aufgabe auf ein privates Ziel? | **Privat → Business: ja, nur als Kennung** (aufgelöst über die Leseschicht, wer Business nicht sehen darf, sieht „Business-Eintrag“). **Business → Privat: nie** (ein Firmen-Datensatz darf nicht von privaten Daten abhängen). Verweise auf Konten (wer, zuständig) sind immer erlaubt. Ziel-Bezüge sind heute sogar strenger (beide Richtungen abgelehnt, `lib/planung/bezuege.ts`) — das bleibt. Offen dort: Ziele **ohne Space** gelten als „gemeinsam“ und passen zu beiden; beim Teilen bekommt jedes einen Bereich (Vorschlag: aus seinen Bezügen, sonst Privat — mit Liste zum Prüfen). |
| 4 | **„Sichten der Person“** (Glocke, Tageslauf, Wachstums-Score, ZOE-Threads, ZOE-Gedächtnis) zeigen beides — dürfen sie beides speichern? | **Ja als Bestand der Person, aber mit Bereich je Eintrag** und möglichst nur Verweisen (Titel zur Laufzeit lesen). Business-Threads gehören der Person (Antwort 13) und gehen **nie** mit einem Firmen-Export. Danach sind diese Bestände nicht mehr „gemischt“, sondern „person“. |
| 5 | **Eigener Schlüssel und eigene Sicherung je Bereich?** | **Ja**, in Stufe 4: Privat-Sicherung nur mit eurer age-Identität, Business-Sicherung mit eigener (später an eine Firma übergebbar). Im laufenden Server hält der Prozess beide Schlüssel — die Trennung zwischen Personen bleibt die serverseitige Prüfung; der eigene Schlüssel schützt Sicherung, Übergabe und Export. |
| 6 | **Vor oder nach Format v2?** | **Nach v2.** Dann bindet die Verschlüsselung den Namen (und damit den Bereich) an die Datei — eine Business-Datei lässt sich nicht als Privat-Datei unterschieben. Umbenennen heißt dann neu verschlüsseln (Regel 9), das ist eingeplant. |
| 7 | **Wann?** | **Nicht im Neustart.** Der Neustart-Umzug ist fertig und geprüft — Trennung erst danach, Stufe für Stufe, jede mit eurer Freigabe. Ab sofort gilt nur die Regel für Neues. |
| 8 | **Verantwortlicher je Gesellschaft?** Heute hat die Instanz **einen** Verantwortlichen (System › Datenschutz). | In der gemeinsamen Instanz bleibt es so; mit dem ersten Firmen-Export bekommt die Firmen-Instanz ihren eigenen. Die Kartei an eine andere Gesellschaft zu geben ist eine **Übermittlung** (Hinweis, keine Rechtsberatung — einmal gegenlesen lassen). |

## Regel für Neues (gilt ab sofort, Wächter aktiv)

- Ein neuer Bestand dient **genau einem Bereich**: privat, business, je Person oder Instanz. Braucht ein Feature beides, bekommt es
  **zwei Bestände** (`<name>--privat` / `<name>--business`, bei Haushalts-Beständen `<name>--<haushalt>--privat`) — nie einen mit Feld.
- Eintrag im Speicher-Register wie bisher **plus Bereich** in einer der Listen `IN_PRIVAT`, `IN_BUSINESS`, `JE_PERSON`, `INSTANZ`
  (`lib/crm/speicher-register.ts`). Fehlt er, wird `tests/trennung-bereiche.test.ts` rot.
- Gesundheit (Art. 9) liegt nur je Person oder privat — nie im Business, nie in der Instanz (Wächter).
- Neue Felder in einem gemischten Altbestand nur, wenn sie den Bereich nicht verwischen; neue Einträge dort tragen ihr Bereichsfeld.
- Neue Verweise: privat → business nur als Kennung, business → privat nie (Frage 3).
- Neue Sichten über beide Bereiche lesen über die Leseschicht (ab Stufe 2) bzw. über die vorhandene Filterstelle des Bestands — nie
  eine eigene Mischkopie speichern.

---

# Technik

## 1. Inventur

**Quelle:** das Speicher-Register (`lib/crm/speicher-register.ts`, 208 Muster) und ein Scan aller `loadJson/updateJson/saveJson/
updateJsonAsync/updateGeschuetzt/bestandEntfernen`-Aufrufe (wie `tests/datenschutz-register.test.ts`, mit Auflösung von Konstanten,
Namens-Funktionen und `speicherFuer`). Jeder Eintrag trägt jetzt `bereich` (und bei „gemischt“ `trennung`). Abfrage im Code:
`bereichVonBestand(name)`.

**Bereiche:**

- `privat` — nur Privat des Haushalts; nie in eine Firmen-Instanz.
- `business` — nur Business; kann in eine Firmen-Instanz (gefiltert nach Gesellschaft).
- `person` — gehört einer Kontoperson und ist ihre eigene Sache (über sie oder von ihr eingestellt); wandert mit dem Konto, nie mit
  einem Bereich.
- `instanz` — Betrieb und Einstellungen der Instanz; keine Bereichsdaten.
- `gemischt` — Privat und Business in einem Bestand. Regel bei der Inventur: **im Zweifel gemischt** (auch wenn der Bereich nur
  abgeleitet ist oder nur Verweise gemischt sind) — eine Entscheidung nimmt einen Bestand heraus, die Liste wird kürzer.

### 1.1 Nicht gemischt (130)

**privat (6):** `familie--*`, `ernaehrung`, `ernaehrung-vorschlag`, `kompass`, `nordstern--*`, `gesundheit-takt`.
Hinweis: den Nordstern lesen auch Business-Konten (Planung › Jahr) — das ist ein Lesen Business → Privat und gehört in Frage 3.

**business (37):** Kartei-Pflicht und Markttraktion (`crm-import-konflikte`, `crm-import-laeufe--*`, `crm-sperrliste--*`,
`crm-loeschprotokoll`, `kennung-alias--*`, `datenschutz-migration`, `netzwerk`, `kunden`, `stammdaten`, `prospects`, `crm-signale`,
`crm-scoring`, `traktion-verlauf`, `uebergabe-journal--*`, `events-geloescht`, `netzwerken-erfassungen--*`, `visitenkarten--*`,
`buchung--*`, `head-*`, `heads-replay-*`, `content-entwuerfe`, `delegation-runde`), Business-Postfächer und -Kalender (`gmail-stand--*`,
`gmail-text--*` — Workspace mit Domain-Prüfung —, `kalender-google--*`, `kalender-umzug-sicherung--*`, `m365-postfach`,
`microsoft-inbox`, `kemaris-calendar`, `whatsapp-spiegel`, `whatsapp-zustand`, `whatsapp-medien` — die Nummer ist nur im Business
zulässig), `medien--*`, `team--*`, `planung-einheiten--*`, `finance`, `business-eroeffnung`.
Hinweis zu `finance`: Controlling-Monate ohne Einheitenfeld; vor dem 05.10. zählte die Selbstständigkeit zum Business — beim Umbau der
Finanzen prüfen, ob der Bestand noch gebraucht wird (das Ist kommt heute aus `business-abschluesse`).

**person (39):** Gesundheit (`sport`, `vitals`, `haut`, `streak`, `health-log`, `journal`, `gesundheit-koerper`,
`gesundheit-unterlagen`, `gesundheitszeit` je mit und ohne `--*`, `gesundheit-einwilligungen`, `whoop-stand--*`, `whoop-verbindung--*`),
Zugänge und Kanäle (`google-verbindung--*`, `icloud-verbindung--*`, `kalender-icloud--*`, `postfaecher--*`, `postfach-zugang--*`,
`oauth-tokens`, `zoe-kanal--*`, `zoe-whatsapp-medien`), eigene Einstellungen und Ablagen (`arbeitsmodus(--*)`, `arbeitsrahmen--*`,
`flaeche(--*)`, `onboarding--*`, `fokus-laufend--*`, `agenten-skills-privat--*`, `medien-privat--*`, `ki-tiefenbericht--*`).

**instanz (48):** Konten, Anmeldungen, Riegel, Schalter, Protokoll-Siegel, HOI, KI-Tor (`ki-protokoll--*` — ein KI-Aufruf kann
Kategorien beider Bereiche tragen, das Protokoll gehört deshalb der Instanz), Datenschutz-Einrichtung, Pannen, Grabstein-Marke,
Absichten, Idempotenz-Ablage (Liste vollständig in `INSTANZ`).

### 1.2 Gemischt (78) — was trennt, wer liest/schreibt, Umbau, Risiken

Umbau: **S** ≤ 1 Tag · **M** 2–3 Tage · **L** ≥ 4 Tage (je Bestand bzw. Gruppe, inkl. Umzug und Tests).

**Kartei und Markttraktion**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `kontakte` | kein Feld; Bereich einer Person nur abgeleitet (Firma → Deals/Mandate, `lib/zoe/crm-sicht.ts`) | 45 Dateien direkt, 41 über `kontakteFuerVerarbeitung`; Schreiben nur `aendereKontakte` (26) | S bei Frage 2 = (B) · L bei (A) | Art. 15/17/18, Sperrliste, Grabsteine, Import-Abgleich |
| `crm` | `gesellschaft` an Deal/Mandat/Angebot, `Event.fuer`; Firma abgeleitet (`bereichVonGesellschaft`) | `ladeCrm` 90, `aendereCrm` 47, eine Schreibstelle `lib/crm/speicher.ts` | S (B) · L (A) | Rechnung ↔ Mandat, Deal ↔ Follow-up ↔ Aufgabe, Kalender-Bezug |
| `crm-dateien--*` | Bezug je Eintrag → Gesellschaft; Rechnungs-PDFs auch der Selbstständigkeit | `lib/dateien/ablage.ts`, `/api/crm/dateien` | M | Belege mit festem Bezug (nicht löschbar), Dateien im selben Ordner wie die Aufgaben-Dateien |
| `gesellschaften--*` | je Gesellschaft (kdc privat) | EINE Schreibstelle `lib/gesellschaften/server.ts` | M | Absender der Angebote, Fahrplan, Vertragsfristen → Kalender/Aufgaben |
| `mandate-tabelle-laeufe` | Mandat → Gesellschaft | `lib/crm/mandate-tabelle-server.ts` | S | folgt `crm` |

**Aufgaben und Planung**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `tasks` | `Task/Project.spaceId` (privat · kdc · kdv · ug · m-<firma>), eigene Status je Space; Vorlagen, Serien, Papierkorb über alle | `ladeAufgabenSicht` 32, `systemAufgabenAendern` 18, `aufgabenAendern` 13; 10 Dateien direkt | **L** (6–8 T) | Space-Wechsel = Umzug zwischen Beständen (Teilbaum, Dateien, Verlauf); Meilenstein-Listen `pm-<space>`; Papierkorb-Ketten (`geloeschtMit`); Serien; „nur ich“; Browser-Stand je Zeile (409); Follow-up ↔ Aufgabe; Brain-Index `app_chunks`; Neustart-Archiv |
| `aufgaben-dateien--*` | `bereich` je Datei | `lib/dateien/aufgaben-ablage.ts` | S | Bereich zieht beim Umzug einer Aufgabe mit (`umzug-dateien.ts`) |
| `ordnung` | `orgs`: Aufgabe → Ort | `/api/state/ordnung`, 5 Leser | S | Ort entscheidet über Altaufgaben |
| `zoe-chargen--*` | Kennungen beider Bereiche | `lib/zoe/aufgaben-charge.ts` | S | folgt `tasks` |
| `ziele`, `ziele-eigen(--*)` | `space` + `einheit` je Horizont; Fokus-Sätze `privat:jahr`/`business:jahr` | Ziele-Route (PATCH, Kaskade), 10 Dateien | M | Kaskade Jahr → Tag, `oberzielId`, `zielId` an Aufgaben/Projekten/Meilensteinen, Ziel-Farben, Lichtfäden/Seil |
| `meilensteine`, `meilenstein-raum--*` | `space` + `einheit`/`mandatId` (Bereich über `wirksamerSpace`) | **23 Dateien** direkt | M–L | `wartetAuf`-Kette, Meilenstein-Liste in `tasks`, Kapazität, Kalender-Fristen |
| `routinen` | `Routine.space`, `Block.art` (+ einheit) | `/api/state/routinen`, 11 Dateien | M | „Belegt“-Sicht der anderen Person, Kapazität, Verfügbarkeit |
| `wochenplan`, `wochenplan--*` | Altbestand: Blöcke mit `art` | Übernahme in den Kalender (Archiv) | S (löschen) | erst nach abgeschlossener Übernahme |
| `kapazitaet--*`, `kapazitaet-plan--*` | zählt **Arbeit**, nicht Bereich (Selbstständigkeit = Privat-Arbeit) | `lib/kapazitaet/*` | M | Säule `kp` im Business-Index, Team-Löschfrist |
| `zeit`, `zeit--*` | Schlüssel `space:bereich`; Fokus-Blöcke mit Einheit/Mandat | `lib/zeitmessung/speicher.ts` | M | Säule „Fokus & Zeit“ in beiden Indizes, Zeit je Mandat, Umbuchen Privat ↔ Business |
| `performance(--*)`, `tageslauf(--*)` | Säulen bzw. ein Text über beides (Tageslauf mit Tagesform, Art. 9) | `/api/performance`, Tageslauf | S | Aggregate — künftig je Eintrag Bereich oder nur rechnen (Frage 4) |

**Kalender**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `calendar-cache` | Kategorie/Kalender je Termin; Space über `kalender-einstellungen` | 13 Dateien, Schreiber iCloud-Abgleich, Mac, Zulieferung | M | Leser für ZOE/Heute/Signale; Maskierung „Belegt“ |
| `kalender-icloud` | Space je Kalender (Einstellungen) | `ladeStand` (26 Leser), `lib/kalender/icloud.ts` | M | Haupt-Person-Verbindung, Überlagerung Google/je Person, Sicherung je Kalender |
| `kalender-bezug` | Bezug Kontakt/Firma/Mandat/Deal/Event (Business) und Aufgabe (beide) | `bezug-server.ts`, `bezugSetzen` (9) | M | Meetings am Kontakt (`terminUid`), Follow-ups, Spiegel-Marken, Verbindungsprüfung |
| `meetings` | kein Feld; nur über den Termin | `/api/state/meetings` | S | Art. 17 tilgt |
| `apple-reminders-cache`, `apple-contacts-cache` | Altbestand, eingefroren | Mac-Zulieferer | S (löschen) | nur wenn der Zulieferer aus ist |

**Postfächer**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `imap-stand--*`, `imap-text--*` | mehrere Postfächer je Person in einem Bestand; `postfachId` → Bereich im Register | `lib/postfach/spiegel.ts`, EINE Filterstelle `imBereich` | M | IDLE-Wächter, Aufbewahrung je Postfach |
| `inbox-zustand--*`, `inbox-uebergaben--*`, `inbox-geteilt--*` | Gespräch → Postfach → Bereich | `lib/inbox/zustand.ts`, Übergaben | M | Screener je Absender (bereichsübergreifend), Zuordnung → Kartei |
| `inbox-absender`, `inbox-triage`, `inbox-status`, `apple-mail-cache` | Altbestände ohne Bereich | nur Löschfristen-Lauf | S (löschen) | Übernahme in `inbox-zustand` muss gelaufen sein |

**Finanzen und Steuern**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `finanzplan` | `firmaId` an Rechnung/Zahlung/Merkposten, Firmen-Konten | **27 Dateien** direkt; Schreiber Finanzplan-Route, Rechnungen, Konten, Beleg-Übernahme, Prüfliste | **L** | Rechnungen ab „gestellt“ unveränderlich (§ 147 AO), Buchung `bu-re-…` in derselben Sperre, Mandat-Bezug, 0-Punkt (`abEroeffnung`) |
| `buchungen` | Feld `ort` | 10 Dateien | M | Kontoauszug, Beleg-Übernahme, Storno-Gegenbuchung |
| `liquiplan` | Firma bzw. „ausdrücklich privat“ | 11 Dateien | M | Liquiditätsvorschau `ohnePrivat`, CRM-Vorschläge |
| `finanzen-plan--*` | EIN Dokument, Pfade privat/business (`businessSicht`, `privatTeil`, `schreibeAlsBusiness`) | `lib/finanzen/plan/speicher.ts` | **L** | der Rechenkern rechnet beide Achsen zusammen (Runway Privat zählt die Selbstständigkeit, Darlehen mit Geber/Nehmer über die Grenze, EINE Einkommensteuer) — Privat liest Business, nie umgekehrt |
| `business-abschluesse`, `abschluss-laeufe` | Firma → `bereichVonFirma` | `lib/business/speicher.ts` (`ladeAbschluesse(…, bereich)`) | S | schon heute je Bereich gelesen/geschrieben |
| `business-einstellungen`, `business-verlauf`, `finanzchef-einstellung` | je Sicht/Firma; Altwerte der Selbstständigkeit bleiben liegen | Business-Index, Head of Finance | S | Altwerte kdc herauslösen |
| `steuern` | je Steuer-Firma + private ESt | `lib/steuern/speicher.ts` | M | `steuernNurBusiness`, ESt gemeinsam aus der Finanzplanung |
| `rechnungswesen` | Nummernkreis je Gesellschaft | `lib/finanzen/rechnung/server.ts` | S | fortlaufende Nummer (§ 14 UStG) darf nie springen |
| `haushalt-*--*`, `haushalt-umzug--*` | `einheit` je Posten/Beleg; dazu `haushalt-chef--*` (Head of Finance) | `ladeHaushalt` 23 | M | Belege der Selbstständigkeit/UG für Steuern; Altvokabular `einheitenLesen` |
| `konten--*`, `kontoauszug-laeufe--*` | Inhaber je Konto | `lib/finanzen/konten/server.ts` | M | Kasse Business = Firmenkonten, Runway Privat |
| `grundlage` | Teile p/s/u/b des V1-Exports | 5 Leser | S | Kredite sind PRIVAT (nie in Business-Kennzahlen) |

**ZOE, Agenten, KI, Medien, Protokolle**

| Bestand | Trennt heute | Zugriff | Umbau | Risiken |
|---|---|---|---|---|
| `zoe-verlauf`, `zoe-gedaechtnis` | kein Feld | `lib/zoe/*` | M | Gespräche sind Text; Bereich je Nachricht/Merksatz nachrüsten |
| `zoe-stapel`, `zoe-entscheidungen--*`, `zoe-protokoll`, `zoe-auftraege`, `zoe-empfang` | Bereich je Vorschlag abgeleitet (`lib/zoe/bereich-server.ts`) | `lib/zoe/stapel.ts` u. a. | M | Freigabe läuft als die benannte Person; Rechenschaft (nur anhängend) |
| `agenten-faeden--*`, `agenten-faden--*`, `agenten-plan--*` | Agent → Bereich | `lib/agenten/*` | M | Antwort 13: Threads gehören der Person |
| `agenten-skills--*`, `agenten-einstellung--*` | Head → Bereich; Abschnitte der Privat-Heads je Person (Gesundheits-Auftrag, **Art. 9** im gemischten Bestand) | `lib/agenten/einstellung.ts` | M | **vorrangig**: Art.-9-Inhalt raus aus dem Haushalts-Bestand |
| `agent-log`, `meldungen--*`, `ereignisse--*` | Agent, Art/Bezug, Feld `bereich` | `lib/meldungen/speicher.ts`, `lib/ereignisse/server.ts` | S–M | Glocke ist global (Frage 4) |
| `ki-medien--*`, `ki-medien`, `medien`, `medien-uploads` | Ziel-Ablage bzw. Album → Katalog; Dateien beider Ablagen in einem Speicher (Schlüssel je Medium) | `lib/medien/*`, `lib/ki/medien.ts` | S–M | Medienspeicher außerhalb des Datenordners |
| `aenderungsprotokoll--*`, `leseprotokoll--*`, `aenderungen` | Feld `bestand` bzw. `bereich` je Eintrag | `lib/store/aenderungsprotokoll.ts`, `leseprotokoll.ts` | M | **Hash-Kette**: Teilen = neue Kette je Bereich ab einem Siegel, alte Monate bleiben als Ganzes (nie umschreiben) |

### 1.3 Abgeleitete Stellen ohne eigenen Bestand

Lesen beide Bereiche zur Laufzeit und speichern nichts (oder nur Zwischenspeicher): **Lichtfäden/Seil** (Privat der anderen Person nur
„Belegt“), **Heute**, **Schnellsuche**, **Business-Index** (`ladeRoh` filtert serverseitig), **Steuern**, **ZOE-Kontext** (`gatherBrain`),
**Brain-Index** (`app_chunks` mit `haushalt` + `privat`, im tmpfs, abgeleitet) und der **Brain-Vault** (Markdown, `scope: privat` je
Notiz, `_App/Projekte/<Space>`). Sie werden nicht umgezogen, sondern auf die Leseschicht umgestellt; der Index bekommt statt `privat`
eine Spalte `bereich` und filtert weiter IN der Abfrage.

### 1.4 Befund: Bestände ohne Register-Eintrag

Der Scanner löst ihre Namen nicht auf (Parameter), deshalb fehlen sie im Register und damit in allen Wächtern:

- `gesundheit-index` / `gesundheit-index--*` — Gesundheits-Index je Person (Art. 9: Schwellen, Tageswerte). Steht auch nicht in
  `PERSON_BESTAENDE` → **Konto löschen lässt ihn liegen, der Konto-Export enthält ihn nicht.**
- `privat-index--*` (Privat-Index je Haushalt), `traktion-index` (Zahlen), `finanzchef` (Head of Finance, Business),
  `planung-neustart--*` (Archiv „Neu anfangen“: Ziele und Meilensteine beider Bereiche) und `haushalt-chef--*` (Head of Finance
  Haushalt — passt nur zufällig auf das Muster `haushalt-*--*` der Haushaltsfinanzen).

Nicht in diesem Paket geändert (Register-Angaben sind Rechtsaussagen, und der Konto-Wächter würde sofort eine Verhaltensänderung
verlangen). Vorschlag: eigene kleine Aufgabe — Register-Einträge mit Angaben, `gesundheit-index` in `PERSON_BESTAENDE`, Scanner um
`indexName(...)`, `standName(...)` und die Neustart-Namen erweitern.

## 2. Zielarchitektur — drei Varianten

### (a) Bestände je Bereich im selben Ordner

`tasks--privat` / `tasks--business`, `finanzen-plan--<haushalt>--privat` / `--business` …; ein Ordner, ein Schlüssel, eine Sicherung.

- **Für:** klein, nutzt alles Vorhandene (Sperren, Register, Art. 15/17 über Muster, Tagessicherungen); mit Format v2 bindet die AAD den
  Bereich an die Datei.
- **Gegen:** keine physische Trennung (ein Schlüssel, eine Sicherung); ein Firmen-Export muss Dateien heraussuchen; schaltet eine Instanz
  die Selbstständigkeit auf Business (`NEXT_PUBLIC_MAKE_OS_EINHEITEN`), ziehen Daten um.

### (b) Eigener Datenordner je Bereich

`daten/privat/…`, `daten/business/…`, `daten/person/<speicher>/…`, `daten/instanz/…`, je mit eigenem Schlüssel(ring), eigener
Sicherung (age-Empfänger je Bereich), eigenen Tagessicherungen, Datei-Ablagen und Protokoll-Kette.

- **Für:** physisch getrennt; Export einer Firma = Ordner + Schlüssel übergeben; Privat-Sicherung nie mit Business-Schlüssel lesbar.
- **Gegen:** großer Umbau der Datenschicht (Ordnerwahl je Name in `local-db.ts`, `bestandEntfernen`, Durchsicht, Rotation,
  `scripts/daten-verschluesselung.mjs`, `deploy/sicherung.sh`, Restore, Grabsteine, HOI, Absichten); gemischte Bestände haben **kein
  Zuhause** — sie müssen vorher ohnehin geteilt werden.

### (c) Mischform — **Empfehlung**

1. **Erst der Name:** jeder geteilte Bestand trägt seinen Bereich als letztes Glied (`<basis>[--<haushalt|person>]--<bereich>`; die
   Wörter `privat`/`business` werden als Speicher- und Haushaltsnamen reserviert). Bereich je Name aus dem Register (`bereichVonBestand`).
2. **Dann der Ordner:** sobald nichts Gemischtes mehr übrig ist, wählt `local-db.ts` den Ordner aus dem Bereich des Namens
   (`ordnerFuer(name)`) und den Schlüsselring aus dem Bereich (`MAKE_OS_DATEN_SCHLUESSEL_<BEREICH>`, ohne Variable der bisherige).
   Weil der Name gleich bleibt, ändert sich die AAD nicht — der Umzug in Ordner ist Kopieren + Umschlüsseln (`bestandUmschluesseln`
   gibt es).
3. **Gelesen wird über eine Leseschicht** (`lib/store/bereich-db.ts`, Stufe 2):
   - `bereicheFuer(person, sicht)` — EINE Stelle: Inhaber/volle Mitglieder Privat + Business, `finanzRecht: 'business'` nur Business,
     Testkunde ohne Haushalt nichts, Dienstweg ohne Person nur Systemlauf-Bereiche. Kevins Regel aus der Finanzplanung gilt allgemein:
     **Privat-Sicht darf Business lesen, Business-Sicht nie Privat.**
   - `liesBereiche(basis, bereiche)` lädt nur die erlaubten Teil-Bestände und führt sie zusammen (jede Zeile behält `bereich` und
     ihren Stand); `schreibeBereich(basis, bereich, op)` schreibt genau einen. Ein Wechsel des Bereichs (Aufgabe von Privat nach MAKE)
     ist ein Umzug: Absicht → im Ziel anlegen → in der Quelle löschen (idempotent, Abbruch nach jedem Schritt getestet).
   - Sperr-Rangfolge `--privat` vor `--business` (wie `crm` vor `kontakte`), zwei Bestände in einer Sperre wie heute
     (`updateJsonAsync` außen).
   - **Was nicht geladen wird, kann nicht durchrutschen** — die Trennung serverseitig wird strukturell statt nur gefiltert. Wächter: eine
     Business-Sicht ruft nachweislich keinen `…--privat`-Bestand (Spion auf `loadJson`), zusätzlich zur Messlatte.
4. **Verweise** (Frage 3): Privat → Business als Kennung, aufgelöst über die Leseschicht (sonst Platzhalter „Business-Eintrag“, in
   einer reinen Privat-Instanz „nicht in dieser Instanz“); Business → Privat nie. Die Verbindungsprüfung bekommt
   `verweis-ueber-bereich` (Fehler bei Business → Privat, Hinweis bei Privat → Business ohne Ziel).
5. **Sichten der Person** (Glocke, Tageslauf, Score, Threads, Gedächtnis) bleiben je Person, tragen aber den Bereich je Eintrag und
   speichern möglichst nur Verweise (Frage 4).

**Was das für … heißt**

- **Art. 15/17:** `person-bestaende.ts`/`person-weitere.ts` laufen über Muster — mit `--*` am Ende erfassen sie beide Teile, die Wirkungen
  bleiben gleich. Neu: die Kontakt-Auskunft nennt den Bereich (welcher Verantwortliche, Frage 8). Konto löschen: Person-Bestände wie
  heute, Haushalts-Bestände beider Bereiche.
- **Sicherung/Restore:** bis Stufe 4 unverändert; danach je Ordner ein Archiv mit eigenem age-Empfänger, Prüfung je Ordner,
  Grabsteine werden in allen Ordnern angewendet (Restore-Skript zwingend), Einzel-Restore je Bestand bleibt.
- **Verschlüsselung:** Format v2 zuerst (Frage 6); Umbenennen = neu verschlüsseln (Regel 9); Schlüssel je Bereich erst in Stufe 4.
- **Firmen-Export:** der Neustart-Umzug (`lib/neustart/umzug(-lauf).mjs`) kann schon heute Bestände auswählen, filtern, umschlüsseln,
  zurücklesen und vergleichen — der Export ist ein Neustart mit `--bereich business --gesellschaft <kennung>`: Business-Ordner, Kartei
  gefiltert nach Bezug zur Gesellschaft (Übermittlung mit Nachweis), Konten nie, Person-Bestände nie.
- **Rollen:** `finanzRecht: 'business'` bekommt über `bereicheFuer` nur Business; Partner/Teammitglied später ebenso über diese Stelle.
- **Demo-Saat:** schreibt über die Routen — folgt automatisch; `tests/demo.test.ts` prüft zusätzlich, dass die Demo nach jedem Umzug
  dieselbe Gesamtsicht liefert.

## 3. Stufenplan

Reihenfolge nach Nutzen/Risiko. Jede Stufe: eigener Branch, nur auf Kevins Wort hochladen, Einmal-Schritte in `UPDATES.md`.

**Muster für jeden Umzug (wie der Neustart-Umzug):** Probelauf mit Bericht → Archivkopie (`archiv/<bestand>-vor-trennung-<zeit>`,
verschlüsselt, 30 Tage) → Absicht (`absichten--<haushalt>`, Art `bereich-trennen`, Schritte je Teil-Bestand) → Teile schreiben →
alles zurücklesen, Zeile für Zeile mit dem Original vergleichen (Leseschicht über beide Teile = Original) → erst dann den alten Bestand
leeren (nicht löschen: Marke `getrenntAm` + Verweis auf die Teile) → nach Kevins Abnahme in der Löschfrist `archiv-umzug` weg.
Idempotent: ein zweiter Lauf findet die Marke und tut nichts. **Rückweg:** der alte Stand kennt die neuen Namen nicht — Rückweg nur
mit der Archivkopie bzw. dem Skript `bereich-zusammenfuehren` (führt die Teile in den alten Bestand zurück, gleiche Prüfung).

| Stufe | Inhalt | Liste gemischt | Aufwand |
|---|---|---|---|
| **0 — heute** | Register-Feld `bereich` + Wächter; Regel für Neues. Dazu (offen) die 6 Register-Lücken schließen (1.4). | 78 | 0,5 T (+0,5 T Lücken) |
| **1 — Altlasten** | Bestände ohne aktiven Leser einfrieren und löschen (mit Archivkopie): `inbox-absender`, `inbox-triage`, `inbox-status`, `apple-mail-cache`, `wochenplan`, `wochenplan--*`, `aenderungen`, `haushalt-umzug--*`; `apple-reminders-cache`/`apple-contacts-cache`, sobald der Mac-Zulieferer aus ist. Entscheidung Frage 2 → `kontakte`, `crm`, `mandate-tabelle-laeufe` werden „business“. | 65 | 1–2 T |
| **2 — Leseschicht** | `lib/store/bereich-db.ts` (`bereicheFuer`, `liesBereiche`, `schreibeBereich`, Umzug zwischen Bereichen), Verweis-Regel + Verbindungsprüfung, Wächter „Business-Sicht lädt keinen Privat-Bestand“. Noch keine Daten bewegt. | 65 | 3–4 T |
| **3a — Finanzen** | `crm-dateien--*` (Rechnungs-PDFs folgen der Rechnung), `gesellschaften--*`, `finanzplan`, `buchungen`, `liquiplan`, `rechnungswesen`, `business-abschluesse`, `abschluss-laeufe`, `business-einstellungen`, `business-verlauf`, `finanzchef-einstellung`, `steuern`, `konten--*`, `kontoauszug-laeufe--*`, `haushalt-*--*`, `grundlage`, `finanzen-plan--*` (Dokument in Privat- und Business-Teil, Rechenkern liest beide; Business schreibt nie in den Privat-Teil — heute schon `schreibeAlsBusiness`). Größter Datenschutz-Nutzen (Finanzen, Konten). | 48 | 6–8 T |
| **3b — Aufgaben & Planung** | `tasks` (+ `aufgaben-dateien--*`, `ordnung`, `zoe-chargen--*`), `ziele`, `ziele-eigen(--*)`, `meilensteine`, `meilenstein-raum--*`, `routinen`, `zeit(--*)`, `kapazitaet(-plan)--*`. Browser: `TasksContext` bekommt Stand je Zeile aus beiden Teilen (ETag über beide). Ziele ohne Space bekommen einen Bereich (Frage 3). | 34 | 8–10 T |
| **3c — Kalender & Postfächer** | Spiegel je Kalender-Bereich (`calendar-cache`, `kalender-icloud`), `kalender-bezug` folgt dem Termin, `meetings`; IMAP-Spiegel je Postfach (`imap-…--<person>--<postfach>`), Inbox-Zustand je Bereich. | 25 | 5–6 T |
| **3d — ZOE, Agenten, Sichten der Person, Medien, Protokolle** | Bereich je Eintrag in Stapel/Entscheidungen/Threads/Gedächtnis/Glocke/Ereignissen, Wachstums-Score und Tageslauf je Bereich (Frage 4), Privat-Heads raus aus `agenten-einstellung--*` (Art. 9 zuerst!), Medien-Dateien je Ablage, Protokolle mit eigener Kette je Bereich ab einem Siegel. | 0 | 6–8 T |
| **4 — Ordner und Schlüssel** | `ordnerFuer(name)` in `local-db.ts`, Schlüsselring je Bereich, Sicherung/Restore/Rotation/Durchsicht/HOI/Grabsteine je Ordner, Datei-Ablagen (`dateien/`, Bild-Ordner, Medienspeicher) je Bereich. Server-Schritte für Kevin (neue Schlüssel, age-Empfänger). | 0 | 5–7 T |
| **5 — Firmen-Export** | Neustart-Umzug mit Bereich/Gesellschaft-Filter, Kartei-Filter nach Bezug + Übermittlungs-Nachweis, Verantwortlicher je Instanz. | 0 | 3–4 T |

Zusammen etwa **35–45 Arbeitstage**. Stufe 3a–3d sind unabhängig voneinander und können einzeln laufen; Stufe 4 erst, wenn die Liste
leer ist. Tests je Stufe: Umzug (Abbruch nach jedem Schritt, idempotent, Gesamtsicht vorher = nachher), Wächter „Sicht X bekommt nichts
aus Y“ (strukturell), Messlatte Malin, Demo-Saat, `tests/trennung-bereiche.test.ts` (Liste kürzer), Rückweg-Skript.

## 4. Was heute gebaut ist

- `lib/crm/speicher-register.ts`: Typ `SpeicherBereich`, Felder `bereich`/`trennung` an jedem Eintrag (aus den Listen `IN_PRIVAT`,
  `IN_BUSINESS`, `JE_PERSON`, `INSTANZ` und der Tabelle `GEMISCHT`), `bereichVonBestand(name)`. Keine Verhaltensänderung — niemand liest
  das Feld außer dem Wächter.
- `tests/trennung-bereiche.test.ts`: (a) jeder Eintrag hat einen gültigen Bereich, jedes Muster steht genau einmal in den Listen;
  (b) die gemischten werden nur weniger (`ALTBESTAND_GEMISCHT`, 78 — wer trennt, nimmt den Bestand dort heraus, sonst rot);
  (c) ein neuer Bestand ist nie gemischt; dazu: gemischte sagen, was trennt; Art.-9-Bestände nie im Business oder in der Instanz,
  gemischt nur im Altbestand (`agenten-einstellung--*`, `tageslauf(--*)`).
