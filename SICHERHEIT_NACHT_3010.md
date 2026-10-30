# Sicherheitsprüfung Nacht 30.10. (Branch `nacht-sicherheit`, Basis fb82c8c2)

Schwerpunkt: alles, was seit 20.10. dazukam (67 geänderte Routen, 22 neue): Prozesse/Werkstatt/Fulfillment, Kreislauf Geld und Rechnungen,
öffentliche Strecken (Innovations-Check, Angebots-Formular, Social-Medienlink, Prozess-Webhook), Social (LinkedIn/Instagram, Medien,
Werkstatt, Community), weitere Google-Konten, Akten. Maßstab: CLAUDE.md (Routen-Register, Zugang & Schlüssel, öffentliche Pfade, Regeln 5–7).
Keine Namen, keine Daten. Nur additive Änderungen, gespeicherte Bestände bleiben in ihrer Form.

## Funde und Behebungen

| # | Fund | Schwere | Datei | Behebung | Test |
|---|------|---------|-------|----------|------|
| 1 | Der Instanz-Export schrieb `social-verbindungen--<haushalt>` entschlüsselt in die Datei, also die Zugangstoken der LinkedIn- und Instagram-Kanäle (`geheim`). Die Ausschluss-Regel kannte nur Bestände je Person (`PERSON_BESTAENDE`, `export: false`) und vier OAuth-Bestände. Ebenso fehlten `google-zusatz-zustand` (PKCE-Verifier) und die state-Bestände `social-linkedin-zustand` / `social-instagram-zustand`. | hoch (Geheimnis in einer Datei, die die Instanz verlässt) | `lib/datenschutz/instanz-export.ts` | Liste `OHNE_EXPORT_HAUSHALT` (social-verbindungen) und drei weitere Anmelde-Zustände in `OHNE_EXPORT_GLOBAL`. Sie stehen jetzt nur noch als Vermerk „entfernt“ im Export. Den Kopftext „nicht enthalten“ habe ich ergänzt. | `tests/instanz-export-schutz.test.ts` (ohne die Behebung rot) |
| 2 | Der Agenten-Schritt der Prozesse rahmte Fall- und Firmendaten roh in `<daten>…</daten>`. Ein Firmenname oder Grund, der aus einem öffentlichen Formular kommt (Check, Angebots-Formular), konnte mit „</daten>“ den Block schließen. Danach stand der Rest als Anweisung im Prompt (Regel 6). Das Ergebnis ist zwar nur ein Vorschlag, aber die Vertragswerte steuern die Rauten des Laufs. | mittel | `lib/prozesse/lauf-server.ts`, `lib/prozesse/agent-schritt.ts` | Neue reine Funktion `agentDatenBlock`: Sie entfernt Rahmen-Marken im Inhalt und lässt in der Quelle nur Kennungs-Zeichen zu. Es ist dieselbe Regel wie bei `daten()` (lib/brain.ts) und beim Nordstern. Der Motor baut seine Blöcke nur noch darüber. | `tests/sicherheit-nacht-3010.test.ts` |
| 3 | Beim Angebots-Formular (externer Link) gehen Vorname, Nachname und Firma wörtlich in Mail und PDF. Beides geht automatisch aus dem eigenen Postfach an eine frei eingegebene Adresse. Die Leitplanken prüften Preis, Adresse, Werbesperre, Absender und Datenschutz, aber nicht diese Felder. Mit einem geleakten Link ließen sich so Phishing-Mails mit einem Link im Namen aus dem echten Postfach verschicken (gedrosselt: 20 je Link und Viertelstunde). | mittel | `lib/crm/formulare.ts`, `lib/crm/formulare-server.ts` | Neue Leitplanke `namenAuffaellig` (`://`, `www.`, `@`, `<`/`>`): In diesen Fällen geht nichts automatisch raus, sondern zur Freigabe mit Grund. Fehlt die Angabe, gilt das bisherige Verhalten. Der Externe sieht wie bisher nur „wird geprüft“. | `tests/sicherheit-nacht-3010.test.ts`, `tests/angebot-formular.test.ts` grün |

Commits: a08224b9 (1), b471fae3 (2), b06f4c0a (3).

## Offen — braucht Kevins Entscheidung

1. **Öffentliche Strecken hängen sich an eine vorhandene Person, ohne dass die Adresse bestätigt ist.** Betroffen sind Check (`leadAnlegen` → `anfrageAnlegen`, Kanal Website) und Angebots-Formular. Wer die Mail-Adresse einer bestehenden Person kennt, löst bei ihr Folgendes aus:
   - eine Aktivität „Anfrage über Website“,
   - die Einwilligung „Antwort auf Anfrage“ (die Ampel bleibt höchstens gelb, Werbung wird dadurch nie grün),
   - eine höhere Stufe, eine Lead-Notiz und ein Follow-up „beantworten“ an die echte Person.

   Die Buchung macht es anders: Dort bleibt die Mail „unbestätigt“ bis zum Bestätigungslink, und es gibt kein CRM vor der Freigabe. Mögliche Wege:
   - (a) wie die Buchung: an einer vorhandenen Person nur „Anfrage (Adresse unbestätigt)“, ohne Einwilligung und ohne Stufe;
   - (b) bei einer vorhandenen Person immer erst zur Freigabe;
   - (c) so lassen.
2. **Automatische Antworten der Social-Community** (Modus „auto“, Entscheidung vom 28.10.): Die KI antwortet ohne Klick auf Text Dritter. Leitplanken sind da: Klasse nur Frage oder freundlich, Spam/Kritik/Beratung gehen zu einem Menschen, Limits, Ähnlichkeitsbremse und Not-Aus. Das steht in Spannung zu Regel 6 („nach fremdem Text nur Vorschlag“). Bewusst so lassen?
3. **Sicherheitsrisiko „Selbst posten“ bei Social** (Stufe 2 mit Leitplanken, Entscheidung vom 26.10.): Das ist eine Außenwirkung ohne Klick, wenn eine Freigabe oder die Automatik greift. Zur Kenntnis.
4. **Leseprotokoll für Social-DMs:** `GET /api/social/community` liefert Kommentare und DMs Dritter ohne `leseZugriff`. Die Inbox protokolliert nur das Lesen fremder Postfächer, das Social-Postfach liegt je Haushalt. Kein Verstoß gegen die Liste in CLAUDE.md, aber auf Wunsch als Bereich `inbox` nachziehbar.

## Geprüft ohne Befund

- **Routen-Register:** Alle Routen stehen mit Klasse drin, das Tor sitzt am Anfang, und kein GET schreibt ohne Grund. Wächter grün: `routen-register` (53), `messlatte-malin` (18), `datenschutz-register`, `ki-datenschutz`, `sicher-zugang-json`, `repo-sauber`.
- **Öffentliche Wege in der Middleware:** `/check` + `POST /api/check`, `/angebot/<slug>` + API, `/api/social/medien/sm-<32 hex>` (nur GET/HEAD), `POST /api/prozesse/webhook/pw-<24 hex>` und `/schriften/*.woff2`.
  - Die Regex sind eng, die Personen-Köpfe werden gelöscht, und es gibt keine offenen Weiterleitungen.
  - Die Köpfe kommen aus next.config.mjs (`buchung`); in Caddy gibt es zusätzlich `@angebot`/`@kunde`, und fokusinnovation.de leitet nur Check, Buchung und Assets an die App weiter.
- **Check:** Token je Sitzung (32 Byte, als SHA-256 gespeichert, zeitkonstant verglichen), Drossel je Netz (Start, Schritte, falsche Tokens), Honigtopf, Mindestzeit bis zur Kontaktfrage, 16 KB-Grenze (413), Schalter „kommt AUS“ (404), Lead über `anfrageAnlegen` (Sperrliste, Art. 18).
- **Angebots-Formular:**
  - Link-Token: 96 Bit, nur als Fingerabdruck gespeichert, zeitkonstant verglichen.
  - Schutz: signierter Stempel an den Slug gebunden, gleiche 404 für jede Fehlerart, Drossel je Netz und je Link.
  - Externe Eingaben: Kennungen nimmt der Link nicht an, Rabatt oder eigener Preis führen zur Freigabe.
  - Personen: Art. 18 vor jeder Wirkung, Sperrliste über `personAnlegen`.
  - Antwort an Externe: nie etwas aus dem Bestand.
- **Social-Medienlink:** 128 Bit, 60 Minuten gültig, nur als Fingerabdruck gespeichert, zeitkonstant. Er liefert nur Medien, die für Social freigegeben sind, mit `nosniff`, und gleich 404 für jede Fehlerart.
- **Prozess-Webhook:** eigener Schlüssel je Adresse (SHA-256, zeitkonstant), erst nach „scharf“ aktiv, Drossel je Netz und Adresse, 64 KB-Grenze, nur Schema-Felder, liefert nie Daten. Webhook-Felder sind fremder Text (`laufFremd` → Freigabepflicht).
- **OAuth Social (LinkedIn/Instagram):** `state` mit 24 Byte, einmalig, 15 Minuten, an die Person gebunden. Cross-Site-Ausnahme nur für genau diese Rückrufe. Token nur serverseitig (`verbindungSicht` ohne `geheim`). Personenmarke nur für die Person selbst.
- **Weitere Google-Konten:** PKCE, `state` als Hash gespeichert, Prüfung von Domain und `hd`, jede Ablehnung widerruft das Token. Das Konto-Löschen widerruft alle. Der Status ist maskiert, Export `export: false`.
- **Rechnungen:** Zugang = Haushalt des Inhabers plus Sicht aus dem Konto. Stellen, Storno, Mahnung und Vorbereiten nur von Hand (Dienstweg 403). PDF mit `nosniff` und `sandbox`. Katalog über `kontakteFuerVerarbeitung` (Art. 18).
- **Downloads und Exporte:** Angebots-PDF, Treppen-Report, Kunden-Dateien (`octet-stream`, attachment), Fulfillment-CSV (Formeln neutralisiert), Verzeichnis-HTML (CSP ohne Skripte).
- **KI-Wege:** Social-Antwort, Fremd-Kommentar und Redaktion, Werkstatt-Schnitt, Prozess-Head, Prozess-Agent. Alle laufen über `askText` mit `ki:`-Angabe, Text Dritter steht in `fremd()`. Der Prozess-Agent hat nach der Behebung oben einen dichten `<daten>`-Rahmen.
- **Werkstatt (ffmpeg/whisper):** `spawn` ohne Shell, Argumente als Liste, Filterwerte nur Zahlen und interne Pfade, Medien nur aus der Business-Ablage.
- **Stapel:** Versand aus einem Prozess-Vorschlag nur aus der eigenen Sitzung (`sitzung: !dienst`). Sammelfreigabe nur für risikoarme Arten. Empfänger nie aus fremdem Text.
- **Zufall und Vergleiche:** In neuem Code nirgends `Math.random` für Geheimnisse, alle Token-Vergleiche sind zeitkonstant.
- **Art. 15/17 der neuen Bestände** (`check-sitzungen`, `angebot-formular--*`, `prozesse-webhook--*`, `social-community--*`, `fulfillment-*`, `kalender-google-zusatz--*`): stehen im Register und in `person-weitere.ts`.

## Hinweise zur Prüfung

Gezielte Tests (`--maxWorkers=1`), keine volle Testreihe und kein Build (Last-Vorgabe der Nacht). `tsc` über `tsc-sicher.sh`, eslint auf den geänderten Dateien.
