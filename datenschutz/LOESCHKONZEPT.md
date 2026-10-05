# Löschkonzept — MAKE OS

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Stand 05.10.2026, **abgeglichen mit dem Code** (Branch `entwicklung`,
> e15a9a8): `lib/crm/loeschfristen.ts` (`LOESCHFRISTEN`), `lib/crm/datenschutz.ts` (`LOESCHREGELN`), `lib/crm/speicher-register.ts`,
> `deploy/sicherung.sh`, `deploy/generationen.sh`. Aufbau angelehnt an DIN 66398 (Datenart → Frist → Auslöser → Weg → Nachweis).

**Eine Quelle:** Die Fristen stehen im Code und sind unter Markttraktion › Stammdaten › Datenschutz sichtbar und (wo erlaubt) im
Rahmen min–max einstellbar; gespeichert werden nur Abweichungen (`crm-loeschfristen`). Ändert sich der Code, wird **dieses
Dokument nachgezogen** — nicht umgekehrt. Abweichungen zwischen Code und Dokument stehen in Abschnitt 7.

Grundsätze:
1. **Personen (Kartei) werden nie automatisch gelöscht.** Über der Frist entsteht eine Aufgabe „prüfen: löschen oder begründen“
   (ohne Namen/Kennung in der Aufgabe); Verlängerung nur mit Grund, höchstens 36 Monate je Schritt.
2. **Technische Bestände** (Caches, Protokolle, Medien, Läufe) löscht der tägliche Lauf (`lib/crm/loeschfristen-lauf.ts`,
   Takt-Schritt „Löschfristen“, Tagesmarke) automatisch, mit Protokoll „System“ und nur Zahlen.
3. **Art. 17 (Löschantrag)** wirkt sofort über **alle** Speicher laut Register (`personEntfernen` + `WEITERE_SPEICHER`), setzt einen
   Grabstein und einen Eintrag auf die gehashte Sperrliste.
4. **Aufbewahrungspflichten** (HGB/AO) gehen vor: dann **sperren** statt löschen (Art. 17 Abs. 3 lit. b/e, Art. 18).
5. **Sicherungen** werden nicht einzeln bereinigt („beyond use“); nach jedem Zurückspielen wenden die Grabsteine die Löschung erneut an.

---

## 1 · Einstellbare Löschfristen (`LOESCHFRISTEN`)

Wirkung: **auto** = Lauf löscht · **Aufgabe** = nur Prüf-Aufgabe · **fest** = nicht einstellbar.

| Datenart (Kennung) | Standard (Rahmen) | Auslöser / Startereignis | Weg | Wirkung | Nachweis |
|---|---|---|---|---|---|
| Kontakte ohne Beziehung und Aktivität (`kontakte`) | 24 Monate (6–120) | letzte Spur: letzter Kontakt, menschliche Aktivität, Import, „geprüft am“ — ausgenommen Kunden/Ex-Kunden/Partner/Multiplikatoren/Investoren, Mandat, offener Deal, Art. 18, gültige Verlängerung | Aufgabe `loeschfrist-kontakte`; Liste + „Frist verlängern mit Grund“ in Stammdaten › Datenschutz | Aufgabe | Lauf-Marke (`ueberFrist`), `Kontakt.loeschfristVerlaengert {bis, grund}`, nach Löschung Löschprotokoll |
| Import-Konflikte (`import-konflikte`) | 90 Tage (7–365) | Alter des Imports | Lauf | auto | Lauf-Marke `bereinigt` |
| Import-Läufe / Rückgängig (`import-laeufe`) | 30 Tage (1–90) | Zeitpunkt des Laufs | Lauf (`lib/crm/import-lauf.ts`) | auto | Lauf-Marke |
| Heads-Replay (`heads-replay`) | 90 Tage (7–365) | Zeitpunkt des Falls | Lauf | auto | Lauf-Marke |
| Signale: Mail-Betreff/Termintitel (`signale`) | 12 Monate (1–60) | Datum der Signal-Aktivität | Lauf entfernt den Text, Ereignis bleibt | auto | Lauf-Marke |
| Änderungsprotokoll (`aenderungsprotokoll`) | 36 Monate (12–120) | Monat der Datei | Monatsdatei geleert (Vermerk bleibt) | auto | Vermerk in der Datei |
| Aktivitäten-Texte gelöschter Personen (`aktivitaeten-geloeschte`) | sofort | Art.-17-Löschung | `lib/crm/person-bestaende.ts` | fest | Löschprotokoll |
| ZOE-Protokoll + entschiedene Vorschläge (`zoe-arbeitslisten`) | 90 Tage (30–365) | Zeitpunkt | Lauf (nur was dauerhaft in den Entscheidungen steht) | auto | Lauf-Marke |
| ZOE-Entscheidungen (`zoe-entscheidungen`) | 36 Monate (12–120) | Monat der Datei | Monatsdatei geleert | auto | Vermerk |
| Gespräche mit ZOE (`zoe-verlauf`) | 12 Monate (1–60) | letzte Nachricht | Lauf | auto | Lauf-Marke |
| ZOE-Gedächtnis (`zoe-gedaechtnis`) | 24 Monate (6–120) | letzte Erneuerung des Fakts | Lauf | auto | Lauf-Marke |
| Postfach-Zwischenspeicher (`postfach-caches`) | 30 Tage (7–365) | Datum der Mail | Lauf (Apple-/M365-Spiegel, Einstufungen) | auto | Lauf-Marke |
| Kalender-Zwischenspeicher (`kalender-caches`) | 12 Monate (1–60) | Terminende in der Vergangenheit | Lauf | auto | Lauf-Marke |
| Umzugs-/Aufräum-Kopien im Archiv (`archiv-umzug`) | 30 Tage (7–365) | Datum im Dateinamen (`crm-vor-*`, `make-orga-*`, `business-vor-*`, `kategorien-vor-*`) | Lauf; andere Archiv-Dateien nie automatisch | auto | Lauf-Marke |
| Altbestand Netzwerk (`netzwerk`) | 24 Monate (6–120) | letzter Kontakt | zählt in die Löschfrist-Aufgabe; Bestand wird stillgelegt | Aufgabe | Lauf-Marke |
| Grabsteine gelöschter Personen (`grabsteine`) | 13 Monate (13–120) | Tag der Löschung | Lauf; liegt **außerhalb** des Datenordners | auto | Marke `datenschutz-grabsteine` |
| Terminbuchungen (`buchungen`) | 30 Tage (7–365) | Endzustand bzw. Termin (bestätigte: Frist ab Termin) | Lauf, Schritt 14 | auto | Lauf-Marke; Anfrage + Aktivität im CRM folgen der Kartei-Frist |
| Netzwerken: Fotos der Visitenkarten (`netzwerken-karten`) | 6 Monate (1–36) | Erfassung | Lauf (Eintrag + verschlüsselte Datei) | auto | Lauf-Marke |
| Netzwerken: Sprachnotizen (`netzwerken-sprachnotizen`) | 90 Tage (7–365) | Erfassung | Lauf (Eintrag + Datei) | auto | Lauf-Marke |
| Netzwerken: Kontakte ohne weitere Interaktion (`netzwerken-kontakte`) | 12 Monate (6–60) | Event / letzte Interaktion | zählt in die Löschfrist-Aufgabe | Aufgabe | Lauf-Marke |
| Netzwerken: Gesprächs-Info und Zielpersonen (`netzwerken-info`) | 12 Monate (3–60) | Tag des Events | Lauf (Teilnahme, Termin, Kennzahlen bleiben) | auto | Lauf-Marke |
| Übergabe-Protokolle Kunden-Events (`uebergabe-protokolle`) | 36 Monate (12–120) | Tag der Übergabe | Lauf (Event und Journal) | auto | Lauf-Marke |
| Mail-Spiegel Gmail (`mail-spiegel`) | 180 Tage (30–730) | Datum der Nachricht; beim Trennen sofort | Lauf; Original bleibt in Gmail | auto | Lauf-Marke |
| Tageskopien und Nachtsicherungen (`sicherungen`) | „14 Tage“ (fest) | — | siehe Abschnitt 4 — **Text im Code stimmt für Nachtsicherungen nicht** (Abschnitt 7, A1) | fest | — |

Nicht automatisch erfasst (Hinweis aus `DATENSCHUTZ_NETZWERKEN.md`): der Text „Info:“ in der Verlaufszeile „Kennengelernt bei …“ und
in Follow-ups/Aufgaben, die aus einer Erfassung entstanden — die Info dort löschen oder die Person löschen.

---

## 2 · Regeln mit Aufbewahrungspflicht und feste Fristen (`LOESCHREGELN`)

| Datenart | Frist | Auslöser | Weg | Nachweis |
|---|---|---|---|---|
| Interessent ohne Geschäftsbeziehung | 24 Monate | letzter Kontakt | löschen oder Begründung (= Frist `kontakte`) | wie oben |
| Werbewiderspruch | sofort | Widerspruch (Art. 21) | **Sperren**: Werbesperre bleibt stehen, auch nach Löschung als Hash auf der Sperrliste | Sperrliste (`crm-sperrliste--*`, HMAC) |
| Kunde nach Vertragsende | 36 Monate (Verjährung § 195 BGB) | Ende des Mandats | **prüfen** (Aufgabe von Hand — kein eigener Lauf) | — [[KEVIN: Lauf/Aufgabe gewünscht?]] |
| Geschäftliche Korrespondenz | 6 Jahre ab Jahresende | Jahr des Schreibens | sperren (§ 257 HGB) | — |
| Rechnungen und Buchungsbelege | 8 Jahre ab Jahresende | Jahr der Buchung | sperren (§ 147 AO, § 257 HGB) | — |
| Papierkörbe (CRM-Listen, Produkte, Aufgaben, Gesellschafts-Register) | 30 Tage | Zeitpunkt „in den Papierkorb“ (Server-Zeit) | Morgenlauf; mit Verweisen bleibt der Eintrag im Papierkorb; Art. 15/17 lesen den Papierkorb mit | Morgenlauf-Schritt |
| Kapazität deaktivierter Team-Personen (Grundwert, Urlaub/Blöcke, Zuweisungen, Einwilligung Erholung) | 30 Tage | `deaktiviertAm` (setzt nur der Server) | Morgenlauf `kapaDeaktivierteAufraeumen`; Reaktivieren davor erhält alles | Morgenlauf |
| Festgehaltene Wochenpläne (Kapazität) | 24 Monate je Woche; Team-Personen ohne Konto mit den übrigen Kapazitätsdaten nach 30 Tagen | Woche | Morgenlauf „Wochenplan festhalten“ | Morgenlauf |
| Unterlagen endgültig gelöschter Gesellschaften/Verträge (Dateiablage) | 6 bzw. 10 Jahre ab Jahresende | Jahr | **aufbewahren**, Bezug „(gelöscht)“ bleibt lesbar | Register-Vermerk `geloescht` |

[[ANWALT: Fristen 6/8/10 Jahre je Unterlagenart nach der Änderung von § 147 AO / § 257 HGB (Buchungsbelege 8 Jahre) bestätigen;
„Verträge/Beschlüsse 10 Jahre“ prüfen]]

---

## 3 · Weitere Speicher mit eigener Regel (aus dem Speicher-Register)

| Speicher | Frist | Weg |
|---|---|---|
| Absichtsprotokoll (`absichten--*`) | fertige Vorgänge 30 Tage; Art.-17-Absicht leert ihre Daten beim Abschluss | automatisch |
| Netzwerken-Erfassungs-Journal (`netzwerken-erfassungen--*`) | beim Abschluss geleert; nie fertig gewordene nach 60 Tagen | automatisch |
| Gelöschte Events (`events-geloescht`) | 90 Tage (nur Kennung + Tag) | räumt sich beim Schreiben auf |
| Idempotenz-Ablage (`anfragen-ergebnis`) | 24 Stunden | automatisch |
| Kalender-Umzugs-Sicherung iCloud → Google (`kalender-umzug-sicherung--*`) | 30 Tage | Takt |
| Kalender-Tagessicherung (Archiv `kalender-export-*`) | 14 Tage; **nicht** im Nachtarchiv | automatisch |
| Google-Anmelde-Zustand (`google-oauth-zustand`) | 15 Minuten | automatisch |
| Anmelde-Protokoll (`anmeldungen`) | **12 Monate** (seit 05.10.; Notbremse 50 000 Einträge) — Konto gelöscht: Einträge bleiben, Kennung „[gelöscht]“ | beim Schreiben gekürzt |
| Agenten-Log (`agent-log`) | letzte 200 Einträge | beim Schreiben gekürzt |
| Offline-Warteschlange im Browser (IndexedDB) | Warnung ab 14 Tagen, nach 30 Tagen verworfen; Abmelden löscht | im Browser |
| Konten (`konten`), eigene Daten des Haushalts (Gesundheit, Journal, Finanzen, Familie, Ziele …) | bis die Person löscht bzw. ihr Konto löscht | **Konto › Meine Daten › „Mein Konto löschen“** (05.10., siehe 3a) |
| Kapazität eines **entfernten Kontos** | **offen** — Konten werden nicht deaktiviert; Wochenpläne erst nach 24 Monaten | Lücke (Abschnitt 7, A3) |
| Löschprotokoll (`crm-loeschprotokoll`), Sperrliste | keine Frist (nur Protokoll-IDs bzw. HMACs) | [[KEVIN: Frist für das Löschprotokoll festlegen]] |
| Spiegel Apple (`calendar-cache`, `kalender-icloud`, `apple-*-cache`), Google Kalender (`kalender-google--*`) | Wahrheit beim Anbieter; Spiegel baut sich neu auf | Art. 17 meldet „n Einträge in Apple/Google nennen die Person — dort löschen“ (**von Hand**) |
| Rechnungen, Buchungen, Finanzplan (`finanzplan`, `buchungen`, `liquiplan`, `finance` …) | Aufbewahrungspflicht | von Art. 17 ausgenommen (Kundenname auf der Rechnung bleibt) |

### 3a · Konto löschen (Art. 17, seit 05.10. — `lib/datenschutz/konto-daten.ts`, Route `POST /api/konto/daten`)

Jede Person löscht ihr Konto selbst (Rückfrage, Passwort, zweiter Faktor, „LÖSCHEN“). Der Inhaber erst, wenn es keine anderen Konten gibt.

| Was | Wirkung |
|---|---|
| Grabstein | HMAC der zufälligen Konto-Kennung (keine Adresse, kein Name) — ein Zurückspielen holt das Konto nicht zurück (`grabsteineAnwenden` → `kontenNachGrabstein`); ein neues Konto mit gleichem Vornamen trifft er nicht |
| Bestände je Person (`PERSON_BESTAENDE`: Zeit, Fokus, Sport, Vitalwerte, Haut, Serien, Gesundheits-Log, Journal, eigene Ziele, Visitenkarten, Meldungen, Wachstum, Flächen, Google-Kalender-/Gmail-Spiegel, Google-Verbindung) | Datei **und** ihre Tagessicherungen in `backup/` entfernt (`bestandEntfernen`); Google-Token vorher widerrufen |
| Konto, eigene Einladungen, „teilt Gesundheit mit“ der anderen | entfernt |
| ZOE-Gespräche, Telegram-Kopplung, KI-Schalter der Person, private Aufgaben („nur ich“), Team-Eintrag, Kapazität | entfernt |
| Protokolle (Anmelde-, Lese-, Änderungs-, KI-Protokoll), Einwilligungs-Nachweis Gesundheit | Einträge bleiben (Nachweis, Art. 5 Abs. 2), Kennung → „[gelöscht]“ — rechtmäßige Umschreibung, die Hash-Kette zählt sie als „getilgt“ |
| Aufgaben des Teams, die der Person zugewiesen sind | bleiben (Arbeit des Haushalts) — die Antwort nennt die Zahl, neu zuweisen |
| Tagessicherungen geteilter Bestände (`backup/`, 14 Tage), Nachtarchive (≤ 12 Monate) | laufen ab; ein Zurückspielen löscht über den Grabstein erneut |

---

## 4 · Sicherungen und Grabsteine

| Ort | Was | Generationen / Frist | Löschweg | Nachweis |
|---|---|---|---|---|
| Server `daten/backup/` | Tageskopie je Bestand vor dem ersten Überschreiben des Tages (verschlüsselt wie der Bestand) | 14 Tage | automatisch | — |
| Server `/srv/make-os/sicherungen/` | Nachtarchiv (age bzw. Übergang openssl), inkl. Grabsteine | **14 täglich · 8 wöchentlich · 12 monatlich** (längstens ~12 Monate) | `generationen_aufraeumen` nach jeder Sicherung | `daten/system/sicherung.json` (nur letzte Sicherung; gelöschte Generationen werden **nicht** protokolliert) |
| Mac `~/MAKE-OS-Sicherungen` | dieselben Archive (täglich abgeholt) | 14 / 8 / 12 | `generationen.sh` beim Abholen | `daten/system/abholung.json` am Server |
| Hetzner-Abbilder | ganzer Server (Daten **und** Schlüssel) | 7 täglich | beim Hoster automatisch | Hoster-Menü |
| Grabsteine `/srv/make-os/grabsteine` | HMAC der Kennung + Sperrlisten-Hashes je gelöschter Person — **nie Klartext** | 13 Monate (länger als jede Generation) | Löschfristen-Lauf | Marke `datenschutz-grabsteine` |

**Art. 17 und Sicherungen:** Eine gelöschte Person bleibt bis zum Ablauf der jeweiligen Generation in Archiven (höchstens ~12 Monate),
ist dort aber verschlüsselt und wird nicht genutzt („beyond use“). Wird ein Archiv zurückgespielt, wenden
`deploy/wiederherstellen.sh` (zwingend), `scripts/einzel-wiederherstellen.mjs` und der nächste Takt die Grabsteine an — die Person
wird erneut entfernt und gesperrt. Die Kalender-Wiederherstellung prüft jede `.ics` gegen die Grabsteine.
[[ANWALT: Reicht „beyond use“ + Grabsteine für Sicherungen bis 12 Monate? Im Datenschutzhinweis erwähnen?]]

---

## 5 · Manuell: Vault, GitHub-Historie, externe Dienste

| Ort | Problem | Weg | Wer |
|---|---|---|---|
| Obsidian-Vault (Server `/srv/make-os/vault`, Mac, privates GitHub-Repo) | Nicht im Speicher-Register, nicht verschlüsselt, **Git-Historie behält gelöschte Notizen** | Art. 17: Notizen suchen und löschen; aus der Historie nur mit `git filter-repo` + Force-Push + GitHub-Support (Cache/Forks) entfernbar. Vorsorge: keine Daten Dritter im Vault, nur Kennungen | [[KEVIN]] |
| Code-Repository (GitHub) | darf keine Daten enthalten (Rohbau-Regel, `tests/repo-sauber.test.ts`) — falls doch: Historie bereinigen wie oben, Schlüssel rotieren | | [[KEVIN]] |
| Apple iCloud / Google / Microsoft (Kalender, Kontakte, Postfächer) | Wahrheit beim Anbieter | dort löschen (Art. 17-Bericht nennt die Anzahl) | Person des Haushalts |
| Kunden, an die übermittelt wurde (Kunden-Events) | Art. 19 | Bericht nennt den Empfänger; Mitteilung schickt ein Mensch | Inhaber |
| KI-Anbieter (Anthropic) | Eingaben/Ausgaben je nach Vertrag beim Anbieter gespeichert | Zero-Data-Retention anfragen [[KEVIN]]; sonst Frist des Anbieters | [[KEVIN]] |
| Telegram | gesendete Benachrichtigungen (ohne Namen Dritter) | im Chat löschen | Person |
| Exportierte Dateien (CSV, Auskunft) | außerhalb der Software | nach Weitergabe sofort löschen (Hinweis in der Oberfläche) | wer exportiert |

---

## 6 · Kunden-Instanzen: Vertragsende

Auf Weisung des Kunden (AVV § 11): **Rückgabe** (Export, Abschnitt Onboarding) und danach **Löschung** von
1. Datenordner der Instanz und Grabstein-Ordner,
2. Datenschlüssel, Pepper, age-Identität der Instanz (Passwort-Manager) — damit werden auch Restkopien unlesbar („crypto-shredding“),
3. Nachtarchiven am Server und am Mac (alle Generationen), Container/Volume, DNS-Eintrag,
4. Hoster-Abbildern (Ablauf 7 Tage abwarten oder löschen), Support-Notizen.

Schriftliche **Löschbestätigung** an den Kunden mit Datum, Umfang, Restbeständen mit Grund (z. B. eigene Rechnungen). Vorlage:
`AVV_VORLAGE.md` › § 11. Checkliste in `KUNDEN_ONBOARDING_DATENSCHUTZ.md` › E.

**Seit 05.10. (Betroffenenrechte v2) mit Werkzeug — nie automatisch:**
1. **Rückgabe:** System › Datenschutz › Vertragsende → „Alles exportieren“ (nur Inhaber-Sitzung + Passwort + zweiter Faktor; alle Bestände,
   Dateien, Bilder entschlüsselt in EINER JSON-Datei; Eintrag im Lese- und Anmeldeprotokoll). Nicht enthalten: `backup/`, `archiv/`,
   Grabsteine, Schlüssel (steht im Kopf der Datei).
2. **Löschen:** `node scripts/instanz-loeschen.mjs --ordner <Datenordner>` — Trockenlauf (Vorgabe) zeigt Umfang, Grabstein-Ordner und die
   Nachtarchive mit „spätestens überschrieben am“ (jüngstes Archiv + 12 Monate), dazu einen Bestätigungs-Code (gilt nur heute, nur für
   diesen Stand). `--ausfuehren --code <CODE> [--bericht <datei>]` löscht Datenordner + Grabstein-Ordner und schreibt den Entwurf der
   Löschbestätigung. Bricht ab, wenn eine App den Ordner hält; fasst nie `.data` an; löscht Sicherungen nie einzeln (sie werden genannt).
3. Schlüssel, Archive, Abbilder, DNS usw. wie oben von Hand.

---

## 7 · Abweichungen Code ↔ Konzept (zu klären)

| # | Abweichung | Vorschlag |
|---|---|---|
| A1 | `LOESCHFRISTEN.sicherungen` zeigt „Tageskopien **und Nachtsicherungen** 14 Tage“ — die Nachtarchive halten aber 14/8/12 Generationen (bis ~12 Monate). Die Anzeige in Stammdaten › Datenschutz ist damit zu kurz. | Text im Code trennen: Tageskopien 14 Tage · Nachtarchive bis 12 Monate (Generationen) · Hoster-Abbilder 7 Tage. **Code-Änderung nur auf ausdrückliches Wort.** [[KEVIN: freigeben?]] |
| A2 | Gelöschte Sicherungs-Generationen werden nicht protokolliert | Zahl der gelöschten Archive in `sicherung.json` aufnehmen |
| A3 | Kapazitätsdaten eines **entfernten Kontos** haben keine Frist | beim Entfernen eines Kontos mitlöschen oder 30-Tage-Regel wie bei Team-Personen |
| A4 | „Kunde nach Vertragsende 36 Monate prüfen“ hat keinen Lauf | Prüf-Aufgabe analog `kontakte` |
| A5 | Löschprotokoll und Sperrliste ohne Frist | Frist festlegen (Sperrliste bewusst dauerhaft — Werbewiderspruch) |
| A6 | Verzeichnis-Einträge `vv-kontakte`/`vv-mandate` nennen als Löschfrist „Kunden 36 Monate nach Vertragsende“, Buchungsbelege 8 Jahre — deckungsgleich; `vv-events` „24 Monate nach dem Event“ hat keinen eigenen Lauf (Personen folgen `kontakte`/`netzwerken-*`) | im Verzeichnis präzisieren |
| A7 | Vault ist nicht im Speicher-Register | Eintrag „Vault (manuell)“ im Register bzw. Brain-Regeln |
