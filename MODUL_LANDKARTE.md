# Modul-Landkarte — was es in MAKE OS heute wirklich gibt (Stand 08.10.2026)

> Im Code geprüft (je Modulgruppe ein Erkunder + ein Gegenprüfer, 91 Korrekturen eingearbeitet). **Online** = `origin/main` (38f88dc0 vom 07.10. abends
> + Hotfix 1de19d8c vom 08.10.); **nur lokal** = nur auf `entwicklung`. Achtung: der lokale Zweig `main` ist veraltet (27.09.) — Online-Stand immer gegen
> `origin/main` messen (`git fetch && git cat-file -e origin/main:<pfad>`). Diese Landkarte ist die Grundlage für jede Modulfrage an Kevin („Heute gibt es …“);
> nach jedem Upload bzw. größeren Bau nachziehen.

## Wichtigste Befunde (08.10.)
- **Fast alles ist online** seit dem Upload am 07.10. Nur lokal (wartet auf den Upload am 09.10.): 0-Punkt, WHOOP-Direktverbindung (API v2), Seil-Zeitstrahl,
  Aufräumen 1–3 (Heute als Startseite, Leiste je Space, Finanzen in zwei Ebenen, Markttraktion 6 Reiter), Malin-Sicht 1+2, Sicht-Prüfung (8 Lücken), neues Onboarding.
- **Gesundheit › Körper:** Inhalte (Beschwerden, Hebel, Stufenplan) stehen fest im Code und werden jedem Konto gezeigt — auch Malin und künftig jeder Demo-/Kunden-
  Instanz. Verstößt gegen Eiserne Regel 1 und die Plattform-Regel → als pflegbare Daten je Person umbauen (Vorschlag Phase 0).
- **Telegram wirkt online nicht:** der Bote läuft nur am Mac (localhost:3001), im Server-Compose fehlt er. Für das 7-Uhr-Briefing braucht es Telegram direkt auf dem Server.
- **Vault-Abgleich Mac ↔ Server läuft nicht** (letzter Commit im Mac-Vault 25.09., kein Launch-Agent) — Teil des Uploads (Vault-Umzug).
- **Brain:** Regeln/Inbox kennen Personen fest als kevin/malin (Kunden-Instanz sähe keine gemeinsamen Vorschläge); zwei Sicht-Lücken sind online offen, lokal behoben.
- **Inbox:** keine Suche, Senden ohne Anhänge/Weiterleiten, Fächer nach festen Regeln (keine KI-Einstufung), Outlook/M365 bräuchte OAuth.

## Inbox
**Stand:** Online (in main): Inbox 2 mit WhatsApp-Oberfläche läuft seit dem Upload am 07.10. (38f88dc0) auf dem Server. Lokal hat sich nur ein Hinweistext geändert. Ob sie wirklich genutzt wird, hängt an der Einrichtung (Gmail bei Google, WhatsApp bei Meta, Postfächer je Person). Geprüft gegen origin/main, der lokale Zweig main ist veraltet (Stand 27.09.).

**Heute gibt es**
- Eine Inbox für alle Postfächer: Gmail über die Google-Anmeldung, dazu iCloud, IONOS oder andere Anbieter mit Adresse und Passwort. Jedes Postfach bekommt einen Bereich (Privat oder eine Gesellschaft). Gmail ohne eigenen Eintrag hat noch keinen Bereich und erscheint dann nur unter „Alle“.
- Jede Person sieht nur ihre eigenen Postfächer, das prüft der Server. Kevin sieht nicht Malins Mails und umgekehrt.
- Oben steht ein Kasten „Lage“ je Bereich. Seine Zahlen lassen sich anklicken: braucht Antwort, wartet auf andere, Termine, Geld & Papier, neue Absender, wieder dran, nachfassen. Darunter steht ein Satz „ZOE schlägt vor“, was als Nächstes dran ist. Dieser Satz folgt festen Regeln, es läuft keine KI.
- Die Post landet in festen Fächern: Wiedervorlage fällig, Antworten, Nachfassen fällig, Termine, Geld & Papier, Neue Absender (Zulassen oder Blocken) sowie Info & Rundschreiben. Das letzte Fach ist eingeklappt und lässt sich mit einem Klick ganz erledigen.
- Ein geöffnetes Gespräch zeigt daneben Person, Firma, offene Deals, offene Aufgaben und den letzten bzw. nächsten Termin. Dazu kommen bis zu drei Vorschläge per Klick: Aufgabe mit Frist, Termin, Beleg ablegen (nur bei Postfächern einer Gesellschaft), der Kontaktakte zuordnen, Deal nachfassen, Kontakt anlegen.
- Antworten und „Allen antworten“ gehen aus dem passenden Postfach, mit dessen Signatur. Auf Wunsch schreibt ZOE einen Entwurf ins Feld, gesendet wird nur per Klick. Aus der Kontaktakte führt „In der Inbox schreiben“ zu einer neuen Mail.
- „Erledigt“ archiviert die Mail im Postfach (Gmail bzw. Archiv-Ordner). „Später“ (morgen, Montag, in einer Woche) ist nur eine Wiedervorlage in MAKE OS. Beides lässt sich rückgängig machen.
- Am Rechner gibt es Tastenkürzel (j/k, e, s, a, r), am Handy Wischen (rechts erledigt, links morgen).
- Unter „Postfächer“ kann man ein Postfach verbinden (die Anmeldung wird vor dem Speichern geprüft), Bereich, Name und Signatur festlegen, eine Verbindung erneuern oder trennen und Absender-Entscheidungen verwalten.

**Halb fertig / aus / wartet auf Einrichtung**
- WhatsApp Business ist eingebaut (Gespräche im selben Strom, Uhr für das 24-Stunden-Fenster, Vorlagen, Medien erst auf Klick), aber standardmäßig aus. Bisher kommt nichts an. Es fehlen Meta-Business-Konto, eigene Nummer, Zugangsschlüssel auf dem Server, Webhook bei Meta und die Registrierung (11 Schritte für Kevin). Unbekannte Nummern landen später direkt in „Antworten“, nicht bei „Neue Absender“.
- Gmail ist gebaut. Die Google-Zugangsdaten stehen laut Baustand seit dem 05./06.10. auf dem Server. Für Gmail fehlen laut Anleitung noch: Gmail-Schnittstelle und Berechtigung bei Google, „Gmail verbinden“ je Person und der Umzug der Mail-Adresse von IONOS zu Google. Ob das passiert ist, zeigt der Code nicht. Die Roadmap nennt „Google Workspace live“ als Ziel von Phase 1. Echtzeit über Pub/Sub ist optional, sonst wird alle 2 Minuten abgefragt.
- Eigene Postfächer (iCloud, IONOS) verbindet jede Person selbst. Die Schritte für Kevin und Malin stehen als To-do bereit. Ob sie auf dem Server erledigt sind, lässt sich im Code nicht sehen.
- Das Demo-Postfach gibt es nur in der Demo-Instanz.
- Datenschutz-Nacharbeit: Die Empfänger IONOS und iCloud müssen bei uns von Hand eingetragen werden, und der AVV mit IONOS ist abzulegen. Die Aufbewahrung des WhatsApp-Spiegels ist schon entschieden (7 Jahre nach § 257 HGB).
- Das Microsoft-365/Outlook-Postfach und Apple Mail über den Mac wurden beim Umbau entfernt. Alte Bestände bleiben ungenutzt liegen.

**Fehlt (für Richtungsentscheidungen)**
- Es gibt keine Suche innerhalb der Inbox.
- Beim Senden fehlen Anhänge und Weiterleiten.
- Es gibt keine KI-Einstufung, die Fächer folgen nur festen Regeln. Aufgaben-Vorschläge automatisch aus Mails oder WhatsApp stehen erst auf der Roadmap.
- Für Outlook/Microsoft 365 gibt es keinen eigenen Anschluss. Microsoft verlangt dort eine Anmeldung über OAuth, die nicht gebaut ist; Adresse und Passwort reichen in der Regel nicht. Massenversand (Newsletter, Kampagnen) ist zurückgestellt.

<details><summary>Belege im Code</summary>

- Die Inbox-Seite zeigt InboxZwei: Lage, Fächer in fester Reihenfolge, ZOE-Satz, Postfach-Leiste, Wischen und Tasten — `components/os/inbox/InboxZwei.tsx`
- Fächer und Screener nach festen Regeln; WhatsApp überspringt den Screener (ohneScreener) — `lib/inbox/faecher.ts`
- Der ZOE-Satz und das Lagebild folgen festen Regeln, ohne KI — `lib/inbox/strom.ts`
- Höchstens drei Vorschläge nach festen Regeln; Kontext nur Person, Firma, Deals — `lib/inbox/gespraech-server.ts`
- Offene Aufgaben und Termine im Gespräch; Später-Auswahl Morgen, Montag, In einer Woche — `components/os/inbox/Gespraech.tsx`
- Erledigt archiviert im Postfach, Später ist nur eine Wiedervorlage im Inbox-Zustand — `lib/inbox/aktionen.ts`
- Beleg ablegen nur bei einem Postfach mit Gesellschaft — `components/os/inbox/BelegAusMail.tsx`
- Der ZOE-Entwurf nutzt das Modell, gesendet wird nur per Klick — `components/os/inbox/Antwort.tsx`
- Senden ohne Anhänge und ohne Weiterleiten (nur Text, An, Cc) — `app/api/inbox/senden/route.ts`
- Gmail-Knopf nur, wenn Google eingerichtet ist; Verbinden, Erneuern, Trennen, Signatur — `components/os/inbox/Postfaecher.tsx`
- Anbieter iCloud, IONOS, eigener IMAP und Demo — `lib/postfach/anbieter.ts`
- WhatsApp ist ohne Werte in der Server-Umgebung aus — `lib/whatsapp/konfig.ts`
- 11 Einrichtungsschritte für WhatsApp; Entscheidung 07.10.: Aufbewahrung 7 Jahre, unbekannte Nummern direkt in Antworten — `UPDATES.md`
- Reihenfolge Gmail: API und Berechtigung bei Google, je Person verbinden, MX zuletzt — `GO_LIVE_CHECKLISTE.md`
- Online 38f88dc0 mit Inbox 2 und WhatsApp (ohne Einrichtung aus); früher: Google-Client-Geheimnis am 06.10. auf dem Server — `BAUSTAND.md`
- Google Workspace live und Aufgaben aus Mails/WhatsApp sind Ziele von Phase 1 — `ROADMAP_Q4.md`
- Die Inbox-Schnittstelle kennt nur Bereich- und Space-Filter, keine Suche — `app/api/inbox/route.ts`

</details>

## Markttraktion
**Stand:** Gemischt: Alle Funktionen sind mit Stand 07.10. online (Kartei, Deals, Angebot, Follow-up, Scoring, Marketing, Heads, Traktions-Index). Die aufgeräumte Fassung vom 08.10. (6 Reiter, 2 Schnellknöpfe, Stammdaten hinter dem Zahnrad) liegt nur auf entwicklung.

**Heute gibt es**
- Kontakte und Firmen als Kartei mit Filtern. „Kontakt öffnen“ hat die Reiter Über, Aktivitäten, Umsatz und Stammdaten, dazu Schnellaktionen (Notiz, E-Mail-Entwurf, Anruf, Aufgabe, Meeting als echter Termin) und eine Zusammenfassung. Export und Import liegen in den Stammdaten.
- Deals als Board und als Liste mit Stufen ab SQL, gewichteter Prognose, Deal-Akte und Auswertung (Kanal, gewonnen/verloren).
- Schnellknopf „Angebot“: Angebote aus Produkten und Positionen, mit Vorschau. Beim Stellen werden Nummer und PDF festgeschrieben, Deal und Follow-up werden mitgeführt. Ein angenommenes Angebot macht den Deal zum Gewinn.
- Eine Follow-up-Liste mit allem Fälligen (überfällig, heute, diese Woche), dazu Power Hour je Person und ein Kontakt-Rhythmus je Kreis.
- Schnellknopf „Qualifizierung & Scoring“: Man geht Lead für Lead durch und sieht Marketing- und Sales-Punkte und den Weg Lead → MQL → SQL → Deal. Die Regeln sind einstellbar.
- Marketing: Anfragen von Hand erfassen (daraus entstehen Person, Follow-up und Lead), Segmente, Kampagnen nach Vorlagen, Redaktionsplan, Newsletter-Planung, Positionierung. Dazu eine LinkedIn-Vernetzen-Runde, die man von Hand abarbeitet.
- Der Überblick zeigt den Traktions-Index (Sales/Marketing/Event mit Ampeln), „Für dich“, „Zuletzt im Team“, ein Wochen-Scoreboard und Befunde.
- Drei Heads (Sales, Marketing, Event) machen nach festem Takt Vorschläge. Man nimmt sie an oder lehnt mit Grund ab; ohne KI arbeiten sie nach einem Regelwerk. Dazu gibt es „ZOE fragen“: ZOE liest den Bestand (eingeschränkte Kontakte ausgeblendet, IBAN maskiert) und legt Änderungen nur als Vorschlag zur Freigabe ab.
- Stammdaten (online als eigener Reiter, lokal hinter dem Zahnrad): Import der Masterliste, Dubletten, Wertelisten, Export und Datenschutz (Ampel je Kanal nach § 7 UWG, Löschfristen, Auskunft).

**Halb fertig / aus / wartet auf Einrichtung**
- Lokal ist aufgeräumt auf 6 Reiter, 2 Schnellknöpfe und ein Zahnrad. Online steht noch die alte Zeile mit 10 Reitern und 2 Schnellknöpfen, darunter „Sales“ und „Stammdaten“ als eigene Reiter.
- MAKE OS verschickt keine Massen-Mails: Newsletter und Kampagnen gibt es nur als Entwurf und Export, der Versand-Plan (Postausgang, Brevo) ist zurückgestellt. Einzelne Mails an einen Kontakt gehen inzwischen per Klick über die Inbox, wenn ein Postfach verbunden ist.
- Morgen-Nachricht und Freitags-Scoreboard per Telegram laufen nur mit Bot-Token und Kopplung. Sie enthalten nur einen neutralen Hinweis mit Link.
- LinkedIn läuft nur von Hand (Suchlink, Abgleich mit dem Export), es gibt keine Schnittstelle.
- Das Team ist fest Kevin (Sales) und Malin (Marketing/Event). Über eine Build-Variable sind bis zu 4 Personen möglich, aber Übergabe und Filter denken in „die andere Person“, und der Head-Takt fällt auf „kevin“ zurück.
- „Einzeln verkaufbar“ ist im Routen-Register als Modul vorgesehen, eine Lizenz- bzw. Modul-Prüfung je Instanz gibt es aber noch nicht.
- Der AVV mit dem KI-Anbieter für CRM-Inhalte ist organisatorisch noch offen.

**Fehlt (für Richtungsentscheidungen)**
- Eigener Versand an viele: E-Mail-Folgen, Newsletter und Kampagnen an Segmente, mit Abmeldelink und Bounce-Verwaltung.
- Kontakte und Firmen werden nicht automatisch angereichert (steht erst als Ziel in der Roadmap).
- Es kommen keine Leads über die Website herein: Die Seiten haben keine Formulare und sind derzeit offline. Neue Kontakte entstehen nur von Hand, aus Inbox oder WhatsApp per Klick oder über eine freigegebene Buchung im Kalender.
- Ein Team- und Rollenmodell über zwei Personen hinaus sowie eine Instanz „nur Markttraktion“ für Kunden.

<details><summary>Belege im Code</summary>

- Die Seite setzt alle Bereiche zusammen, inkl. Angebot, ZOE fragen, Zahnrad für Stammdaten — `components/os/crm/Markttraktion.tsx`
- Lokal REITER_ZEILE (6 Reiter + 2 Schnellknöpfe + Zahnrad); online LEISTE mit 10 Bereichen + 2 Schnellknöpfen inkl. sales und stammdaten (git show origin/main) — `lib/crm/adresse.ts`
- Angebots-Tool (Editor, Positionen, Vorschau, Liste), auch online vorhanden — `components/os/crm/angebot/AngebotStart.tsx`
- Marketing- und Sales-Scoring mit einstellbaren Regeln, Lead → MQL → SQL — `lib/crm/scoring.ts`
- Oberfläche für Qualifizierung & Scoring — `components/os/crm/quali/QualifizierungScoring.tsx`
- Anfragen-Eingang erfasst von Hand, versendet nichts — `components/os/crm/marketing/Anfragen.tsx`
- Überblick mit Für dich, Zuletzt im Team, Traktions-Index, Scoreboard, Befunden — `components/os/crm/Ueberblick.tsx`
- Takt der Heads, abhängig vom Agenten-Schalter (Vorgabe an), Rückfall auf 'kevin' — `lib/heads/takt.ts`
- Team fest Kevin/Malin, über Build-Variable 1–4 Personen, Logik „anderer“ — `lib/crm/team.ts`
- „In der Inbox schreiben“ aus dem Kontakt (einzelne Mail per Klick) — `components/os/crm/kontakt-teile.tsx`
- Versand-Plan zurückgestellt — `VERSAND_PLAN.md`
- Newsletter: nur Ausgabe und Export — `components/os/crm/marketing/Newsletter.tsx`
- ZOE-Lesewerkzeuge fürs CRM mit Leitplanken — `lib/zoe/crm-werkzeuge.ts`
- Modul-Klasse markttraktion vorhanden, Lizenz-Prüfung fehlt noch — `lib/zugang/routen-register.ts`
- Die Vernetzen-Runde ist aus der Kartei erreichbar und läuft von Hand — `components/os/crm/Kartei.tsx`
- Kontakte anreichern ist ein Roadmap-Ziel — `ROADMAP_Q4.md`

</details>

## Netzwerken & Events
**Stand:** Online (in main): Netzwerken, besuchte Events, Make.One mit der Reihe Fokus Innovation und die QR-Visitenkarten sind spätestens seit dem Upload am 05.10. (6b10a5ba) auf dem Server. Die Website fokusinnovation.de ist seit dem 08.10. offline (503). Ihre neue Fassung liegt nur lokal.

**Heute gibt es**
- Netzwerken-Seite fürs Handy: Event wählen („Heute bei …“), dann eine Person erfassen. Man fotografiert die Visitenkarte (Vorderseite, Rückseite optional) und tippt die Felder von Hand. Dabei sieht man „Kennen wir schon?“ und die vorgeschlagene Firma und kann eine Sprachnotiz aufnehmen.
- Als nächsten Schritt wählt man: Termin, Qualifizieren, Follow-up, Vermitteln, Andere, Angebot schicken, zu Make.One einladen oder „nur Kontakt“. MAKE OS legt dann Kontakt, Termin, Aufgabe, Deal oder Angebots-Entwurf passend an.
- Ohne Netz kann man weiter erfassen: Die Erfassungen werden verschlüsselt auf dem Gerät zwischengespeichert und später gesendet, die Handy-Leiste zeigt, wie viele warten. Ohne Gerätespeicher halten sie nur, solange die Seite offen ist, und nach 30 Tagen werden sie verworfen.
- Abends gibt es einen Bericht und Danke-Mail-Entwürfe, aber nur für Personen, mit denen man gesprochen hat. Man öffnet sie per Klick im eigenen Mailprogramm, und nach 14 Tagen verfallen sie.
- „Meine Visitenkarten“: eigene digitale Karte(n) mit QR-Code (vCard), eigenem Logo und Farben, Vollbild zum Zeigen.
- Reiter Events für besuchte Veranstaltungen: Kalender, Anmeldestand, wer hingeht, Ziel und Zielpersonen, Kosten, Wirkung und Urteil. In der Event-Akte gibt es „Jetzt erfassen“. Bei „Im Kundenauftrag“ lassen sich die Kontakte nach Vorschau und Bestätigung als CSV-Datei für den Kunden herunterladen; das wird protokolliert, versendet wird nichts.
- Make.One für eigene Abende: Gästeliste, Checkliste (wird zu Aufgaben), Budget, Check-in am Abend (mit Visitenkarte per KI), Nachfassen, Kalendertermin. Die Reihe „Fokus Innovation“ bekommt eigene Kennzahlen.

**Halb fertig / aus / wartet auf Einrichtung**
- Visitenkarte am Handy beim Netzwerken automatisch auslesen: Die Schnittstelle ist da, der Schalter steht fest auf aus, die Felder tippt man von Hand. Per KI liest die Karte nur der ältere Knopf beim Anlegen in der Kartei und beim Check-in eines Make.One-Abends.
- Die Sprachnotiz wird nicht in Text übertragen. Das ist vorbereitet, aber per Server-Schalter aus, und es soll erst nach einem AVV mit dem Anbieter senden.
- Telegram-Hinweise für Netzwerken und Danke-Mails sind vorbereitet, aber aus.
- Die Website fokusinnovation.de ist als statische Seite gebaut, aber seit dem 08.10. offline (Hotfix, 503). Lokal liegt eine neue, ruhige Fassung, der Abschnitt zur Teilnahme wartet auf den Anwalt, und bei den Städten steht „Termin in Planung“.
- Make.One-Einladungen gibt es nur als Vormerkung bzw. Text. Es gibt weder Versand noch eine Anmeldeseite für Gäste.
- Am Rechner hat Netzwerken keinen eigenen Menüpunkt. Hin kommt man über die Suche, die Handy-Leiste und „Jetzt erfassen“ bzw. „Abendbericht“ in der Event-Akte.

**Fehlt (für Richtungsentscheidungen)**
- Eine Online-Anmeldung für eigene Abende (Formular, Bestätigung, Gästeverwaltung von außen).
- Automatisches Erfassen per KI (Karte und Sprachnotiz) direkt beim Netzwerken am Handy.
- Der QR-Code wirkt nur in eine Richtung: Wer ihn scannt, landet nicht automatisch als Kontakt bei uns.
- Es gibt nur die Web-App mit Offline-Warteschlange, keine eigene Handy-App.

<details><summary>Belege im Code</summary>

- Die Netzwerken-Seite hat Event-Modus, Erfassen, Heute (Abendbericht) und Warteschlange — `components/os/netzwerken/Netzwerken.tsx`
- Erfassen: Vorderseite, Rückseite optional, Kennen wir schon, Firmenvorschlag, Sprachnotiz — `components/os/netzwerken/Erfassen.tsx`
- Nächste Schritte inkl. „Andere“ — `lib/crm/netzwerken.ts`
- Karte auslesen (KARTE_AUSLESEN_AN = false) und Transkript (TRANSKRIPTION_AN) sind aus — `lib/crm/netzwerken-karte.ts`
- KI-Visitenkarte im Check-in eines Make.One-Abends — `components/os/crm/events/Abend.tsx`
- KI-Visitenkarte beim Anlegen in der Kartei — `components/os/crm/Kartei.tsx`
- Offline-Warteschlange verschlüsselt, Rückfall Arbeitsspeicher, Verwerfen nach 30 Tagen — `lib/netzwerken/warteschlange.ts`
- Danke-Mails nur per mailto, Frist 14 Tage — `lib/crm/netzwerken-recht.ts`
- Telegram-Haken vorgesehen, aus — `lib/meldungen/speicher.ts`
- QR-Visitenkarte nur im eigenen Design — `components/os/netzwerken/QrKarte.tsx`
- Event-Akte mit „Jetzt erfassen“ und Abendbericht — `components/os/crm/besuche/BesuchAkte.tsx`
- Kunden-Übergabe als CSV-Download mit Protokoll, nichts wird versendet — `app/api/crm/events/route.ts`
- Make.One-Abende mit Gästen, Checkliste, Budget, Abend und Nachfassen — `components/os/crm/Events.tsx`
- Reihe Fokus Innovation — `lib/crm/marke.ts`
- fokusinnovation.de liefert 503 (Hotfix 1de19d8c in origin/main) — `deploy/caddy/Caddyfile`
- Fokus-Seite: Städte „Termin in Planung“, Teilnahme per Anfrage — `fokus/index.html`
- Netzwerken in der Handy-Leiste mit Zähler; am Rechner kein Menüpunkt — `components/os/Leiste.tsx`

</details>

## Mandate & Unternehmen
**Stand:** gemischt — fast alles ist online (Server-Stand 38f88dc0 vom 07.10.): Mandate, Produkte, Gesellschafts-Register, Gründungsfahrplan, Kapazität und Zeit je Mandat. Nur lokal auf „entwicklung“: der 0-Punkt und der zusammengelegte Menüpunkt „Mandate & Unternehmen“ mit drittem Reiter (08.10.).

**Heute gibt es**
- Seite „Produkte & Mandate“ mit den Reitern Mandate und Produkte; lokal (08.10.) zusätzlich ein dritter Reiter „Unternehmen“, der auf die eigene Seite des Gesellschafts-Registers springt, und ein gemeinsamer Menüpunkt „Mandate & Unternehmen“
- Mandate-Liste mit wiederkehrendem Monatsumsatz, Kundenkonzentration, Laufzeit-Radar (endet in 90 Tagen), Health, Produkt und Phase, Filter nach Person und nach Gesellschaft
- „Gewonnene Deals ohne Mandat“: ein Klick legt das Mandat an (aus einem angenommenen Angebot vorbelegt); je Mandat „+ Rechnung aus dem Honorar“ und Übernahme als Posten in die Liquidität — beides nur auf Klick
- In jedem Mandat: Health-Bewertung, die erfasste Fokus-Zeit des laufenden Monats und die verknüpften Termine
- Produkt-Katalog nach Linien mit Preis, Laufzeit, Ablauf in Phasen, Angebotstext, Unterlagen-Links und Zahlen je Produkt; Archiv und Papierkorb
- Gesellschafts-Register (eigene Seite „Unternehmen“): Steckbrief, Gesellschafter (Cap-Table), Organe & Beschlüsse, Beteiligungen, Verträge mit Fristen (Kalender, Erinnerung als Aufgabe und Glocke), Unterlagen, Absender der Angebote, Struktur „wer hält wen“, Archiv und Papierkorb
- Gründungsfahrplan per Klick im Steckbrief: legt ein Jahresziel mit neun verketteten Meilensteinen und Aufgaben für eine Gesellschaft an
- Kapazität (unter Planung): Stunden je Person und Woche, Urlaub, Zuweisungen zu Mandaten, Ampel „machbar / eng / nicht machbar“ für Meilensteine und Ziele, Wochenplan wird montags festgehalten

**Halb fertig / aus / wartet auf Einrichtung**
- 0-Punkt (Eröffnung) je Business-Gesellschaft ist gebaut, aber nicht online (beim Upload 07.10. vergessen); gepflegt wird er unter Finanzen › Business, der Steckbrief verlinkt nur dorthin
- Der gemeinsame Menüpunkt „Mandate & Unternehmen“ mit drittem Reiter ist nur lokal (Aufräumen 08.10.); online sind es zwei Menüpunkte „Mandate“ und „Unternehmen“
- Neu angelegte Gesellschaften (über die drei festen hinaus) haben nur Grunddaten: keine Rechnung aus dem Honorar, kein Finanzplan, keine Steuern (bewusst so entschieden)
- Kapazität: „Kopf & Energie“ zählt nur mit eigener Einwilligung der Person (Vorgabe aus); Plan-Treue wird erst mit festgehaltenen Montags-Wochenplänen echt; Machbarkeit braucht von Hand eingetragenen Aufwand am Meilenstein
- Ob eine Einheit zu Privat oder Business gehört, ist nur per Build-Einstellung umstellbar, nicht in der Oberfläche (für Testkunden-Instanzen nötig)
- Mandat → Liquidität und Mandat → Rechnung laufen nur auf Klick, nichts entsteht automatisch

**Fehlt (für Richtungsentscheidungen)**
- Keine automatische Abrechnung wiederkehrender Mandate (Monatsrechnung aus dem Retainer) — es gibt nur einen Hinweis in der Datenqualität, wenn ein aktives Mandat 60 Tage (Quartal: 120) ohne Rechnung ist
- Kein Abruf von Handelsregister-Daten; alles im Register wird von Hand gepflegt
- Kapazität und Mandate sind nicht mit Stundensatz/Profitabilität je Mandat verbunden (nur grober Hinweis „≈ €/h“)
- Der Kündigungstermin („kündigen bis“) wird nicht aus der Kündigungsfrist berechnet, sondern von Hand eingetragen; eine Gesamtliste aller Vertragsfristen aller Gesellschaften gibt es nur indirekt über Kalender und Aufgaben

<details><summary>Belege im Code</summary>

- Seitentitel „Produkte & Mandate“; Segment mit drittem Reiter „Unternehmen“ nur auf entwicklung, online nur Mandate · Produkte — `components/os/mandate/ProdukteMandate.tsx`
- Online zwei Leisten-Einträge „Mandate“ und „Unternehmen“, lokal einer „Mandate & Unternehmen“ — `lib/make-one/spaces.ts`
- Mandate-Liste: MRR, Laufzeitradar ≤ 90 Tage, Filter Person + Gesellschaft, Zeit des Monats, Termine, Liquiplan-Knöpfe, „+ Rechnung aus dem Honorar“ — `components/os/crm/Kunden.tsx`
- Gewonnene Deals ohne Mandat → Mandat anlegen über /api/crm/lead — `components/os/mandate/ProdukteMandate.tsx`
- Mandat-Vorbelegung aus angenommenem Angebot — `lib/crm/angebote.ts`
- Produkt-Katalog mit Linien, Phasen, Unterlagen, Angebotstext, Archiv/Papierkorb — `components/os/mandate/Produkte.tsx`
- Mandat → Liquiditätsplan nur als Vorschlag per Klick — `app/api/crm/liquiplan/route.ts`
- Register mit Sichten Gesellschaften · Struktur · Archiv · Papierkorb — `components/os/unternehmen/UnternehmenView.tsx`
- Reiter Steckbrief, Gesellschafter, Organe & Beschlüsse, Beteiligungen, Verträge, Unterlagen, Absender; 0-Punkt-Hinweis nur auf entwicklung — `components/os/unternehmen/Detail.tsx`
- „kündigen bis“ ist ein Datumsfeld von Hand, Kündigungsfrist Freitext — `components/os/unternehmen/Vertraege.tsx`
- Gründungsfahrplan: ein Jahresziel + neun Meilensteine mit Kette + Aufgaben — `lib/gesellschaften/fahrplan.ts`
- Kapazität in der Planer-Leiste (auch online) — `components/os/PlanerLeiste.tsx`
- Datenqualitäts-Hinweis „mandat-ohne-rechnung“ — `lib/crm/verbindungen.ts`
- Online-Stand = 38f88dc0 (07.10.) + Hotfix 1de19d8c; 0-Punkt „beim Upload 07.10. vergessen“ — `BAUSTAND.md`

</details>

## Finanzen
**Stand:** gemischt — fast alles ist online (Server-Stand 38f88dc0 vom 07.10.): Cockpit, Liquidität, Controlling, Rechnungen, Buchungen, Haushalt, Steuern unter Privat und Business, Head of Finance, Finanzplanung mit einzelnen Ertragsteuern, Handwerten, Privat/Business-Trennung und Darlehen. Nur lokal: 0-Punkt und die aufgeräumte Zwei-Ebenen-Navigation (08.10.).

**Heute gibt es**
- Finanzen getrennt nach Privat und Business; Privat darf Business sehen, Business nie Privat (der Server filtert Planung, Steuern und Buchungen)
- Privat: Haushaltsbuchungen per Kontoauszug-Import (N26-PDF/-Text oder CSV), Kategorien, Fixkosten & Budget, Ist gegen Soll, Schulden, Privat-Index; dazu die Brücke „Gesamt“ (was das Business fürs Leben bringen muss)
- Business: Cockpit mit Business-Index (gesamt und je Gesellschaft), Monatsabschluss zum Eintippen, Controlling & Ziele (Kurs aufs Jahresziel, Run-Rate, Runway)
- Liquidität: wie viel Geld wann da ist, aus Kontoständen, Rechnungen und Planposten (Kontostände trägt man von Hand ein)
- Finanzplanung als Blatt wie Excel unter Privat und unter Business: Szenario-Baukasten (Produkt × Kunde × Preis), Monatsplan, jede gerechnete Zahl von Hand überschreibbar, Rückgängig, Protokoll wer was änderte
- Rechenkern rechnet Körperschaft-, Gewerbe- und Einkommensteuer einzeln mit einstellbaren Sätzen; EINE Einkommensteuer aus Gehalt und Selbstständigkeit; Darlehen mit Geber und Nehmer
- Steuern: Fristen mit Countdown und Aufgaben, Rücklage und Prognose, Umsatzsteuer je Zeitraum, Übergabe-Checkliste für den Steuerberater (Hinweis, keine Beratung)
- Head of Finance: Lage aus Zahlen, Bericht und Vorschläge zur Freigabe (z. B. „mahnen“, „Rücklage“); angenommene Vorschläge werden Aufgaben, er bewegt nie Geld
- Selbstständigkeit gehört zu Privat, mit eigenem Monatsabschluss unter Privat

**Halb fertig / aus / wartet auf Einrichtung**
- Keine Bank-Anbindung: Geschäftskonten-Stände von Hand, Business-Buchungen entstehen nur aus bezahlten Rechnungen, übernommenen Belegen und dem einmaligen Alt-Import; Haushalt nur per Datei-Import
- Die neue Navigation in zwei Ebenen (Rechnungen, Liquidität, Buchungen, Controlling als Reiter; Head of Finance als Knopf) ist nur lokal (08.10.); online gibt es Reiter Privat · Business · Finanzplanung · Steuern · Gesamt · Head of Finance und eigene Seiten für Rechnungen/Liquidität/Buchungen
- 0-Punkt (Eröffnung je Business-Gesellschaft: Stichtag und Anfangsbestand, Älteres zählt nicht mehr, rückgängig machbar) ist gebaut, aber noch nicht online
- MAKE Innovation GmbH hat in Steuern keine Fristen und keine Schätzung hinterlegt
- Steuer-Fristen als Kalendervorlage: Schalter vorhanden, standardmäßig aus
- Offene Steuerfragen an den Steuerberater (Vorsteuer wird im Plan nicht abgezogen, Veranlagung, Vorauszahlungen, Ankermandat ohne USt)
- Monatsabschluss nur zum Eintippen — DATEV-BWA-Import nur als „später“ notiert
- Altbestand (Malins Kassenbuch, erstes Cockpit) hängt lokal versteckt unter Privat › Planung › Selbstständigkeit
- Head of Finance braucht das KI-Guthaben; ohne fällt er auf Regelwerk zurück

**Fehlt (für Richtungsentscheidungen)**
- Echte Bank-Anbindung (Kontostände und Umsätze automatisch) für Privat und Business
- Anbindung an Buchhaltung/Steuer (DATEV, ELSTER, sevdesk o. Ä.) — die eigentliche Buchhaltung liegt außerhalb
- Vorsteuer-Abzug und Rechnen auf ganze Cent im Rechenkern (offene Entscheidung)
- Startbestand der Finanzplanung kommt als eigene JSON-Datei — für Testkunden fehlt ein einfacher Einstieg (nur „leer beginnen“)

<details><summary>Belege im Code</summary>

- Zwei Ebenen je Bereich (nur auf entwicklung, nicht online) — `lib/finanzen/navigation.ts`
- Online-Fassung: Reiter Privat · Business · Finanzplanung · Steuern · Gesamt · Head of Finance (git show origin/main) — `components/os/FinanzenView.tsx`
- Haushalts-Import nur N26-PDF/Text und CSV; kein Bank-Anbieter im Code — `lib/finanzen/haushalt/import.ts`
- Kontostände von Hand, „bis die Anbindung steht“ — `components/os/FinanzplanungView.tsx`
- Business-Buchungen nur angezeigt/gefiltert, kein Import in der Oberfläche — `components/os/BuchungenView.tsx`
- Monatsabschluss von Hand, DATEV-BWA-Import „später“ — `components/os/business/Abschluss.tsx`
- Run-Rate und Runway im Controlling — `components/os/ControllingView.tsx`
- Steuerlogik nur für kdc/kdv, MAKE fehlt bewusst — `lib/steuern/rechnen.ts`
- Online-Rechenkern importiert ertragsteuer.ts, hand(), darlehenFluesse, estJahre (origin/main) — `lib/finanzen/rechenkern.ts`
- Handwert-Schicht inkl. KERN_STAND online — `lib/finanzen/handwerte.ts`
- Business-Sicht serverseitig gefiltert (online) — `lib/finanzen/plan/sicht.ts`
- Head of Finance mit Vorschlagsart „mahnen“ — `lib/finanzen/chef/prompt.ts`
- Vorsteuer wird nicht abgezogen, Frage an den Steuerberater — `FINANZPLANUNG_JETZT.md`
- Eröffnung fehlt auf origin/main (git cat-file) — `components/os/business/Eroeffnung.tsx`

</details>

## Angebote & Rechnungen
**Stand:** online — der Server-Stand 38f88dc0 (07.10.) enthält Angebots-Tool mit PDF, Storno, Dateiablage, den Reiter „Umsatz“ im Kontakt, Beleg-Lesen per ZOE und „Beleg aus Mail“ in der Inbox; lokal unterscheiden sich nur Texte und die neue Adresse der Rechnungsliste.

**Heute gibt es**
- Angebots-Tool (Schnellknopf „Angebot“ in der Markttraktion): Positionen aus Produkten, Sie/Du-Vorlage, Summen netto/USt/brutto, einmalig/monatlich/jährlich getrennt, Vorschau; Archiv und Papierkorb für Entwürfe
- „Stellen“ vergibt eine fortlaufende Nummer je Gesellschaft und Jahr, erzeugt ein PDF und legt es ab; Deal geht auf „Angebot“, Nachfassen wird angelegt
- Versand nur über das eigene Mail-Programm: das PDF wird heruntergeladen, die Mail öffnet sich vorbereitet, das PDF hängt man selbst an — MAKE OS verschickt nichts; danach annehmen (Deal gewonnen, Mandat vorbelegt) oder ablehnen mit Grund; neue Version statt Ändern
- Rechnungsliste („Rechnungen & Zahlungen“): geplant → gestellt → bezahlt; „bezahlt“ erzeugt die Buchung; Storno statt Löschen ab „gestellt“, mit Grund und Gegenbuchung
- Rechnungen, Angebote, Verträge und Zahlungseingang auch im Kontakt unter „Umsatz“ (Person und Firma); dort kann man an eine Rechnung ein fertiges PDF hängen und ein hochgeladenes, angenommenes Angebot als geplante Rechnung anlegen
- Dateiablage (PDF, Bilder, Office), verschlüsselt: an Kontakt/Firma/Mandat/Deal über den Kontakt, an Gesellschaften und Verträgen, an Projekten und Aufgaben
- Beleg lesen: Foto/PDF an ZOE → Zahlen werden vorgeschlagen, erst nach Bestätigung Buchung oder Rechnung; auch direkt aus einem Mail-Anhang in der Inbox

**Halb fertig / aus / wartet auf Einrichtung**
- Rechnungen sind nur Einträge (Betrag, Nummer von Hand) — MAKE OS erzeugt kein Rechnungsdokument; ein extern erstelltes PDF kann man nur anhängen
- Beleg-Lesen speichert nur die Zahlen, die Beleg-Datei selbst wird nicht abgelegt
- Beleg-Lesen braucht das KI-Guthaben; Belege aus Mails nur mit verbundenem Postfach im Bereich einer festen Gesellschaft; Register-Gesellschaften und Privat gehen nicht in den Finanzplan
- Pflichtangaben im Angebots-PDF sollen einmal mit dem Steuerberater abgestimmt werden (im Code vermerkt)
- Lokal nur kleine Änderungen (neue Adresse der Rechnungsliste als Reiter, Texte „Finanzen“ statt „Zahlen“)

**Fehlt (für Richtungsentscheidungen)**
- Rechnung schreiben mit PDF und fortlaufender Nummer (wie beim Angebot), inklusive E-Rechnung (XRechnung/ZUGFeRD)
- Ein Angebot aus dem Angebots-Tool wird nicht direkt zur Rechnung — nur über den Umweg Mandat (vorbelegt) → „Rechnung aus dem Honorar“; einmalige Positionen gehen dabei nicht als Rechnung mit, wiederkehrende Rechnungen entstehen nie automatisch
- Kein Mahnwesen (Mahnstufen, Mahnschreiben) und kein Abgleich mit Kontoeingängen — überfällige Rechnungen werden nur angezeigt und vom Head of Finance als „mahnen“ vorgeschlagen
- Annahme/Unterschrift durch den Kunden digital (heute klickt das Team „angenommen“)
- Beleg-Archiv GoBD-tauglich (Original-Datei an der Buchung)

<details><summary>Belege im Code</summary>

- Angebots-Route: speichern, stellen, annehmen, ablehnen, version, ablage; nichts wird versendet (auch auf origin/main) — `app/api/crm/angebot/route.ts`
- Summen in Cent, Nummern je Gesellschaft und Jahr, Sie/Du-Vorlagen, Mandat-Vorbelegung, Hinweis Pflichtangaben/Steuerberater — `lib/crm/angebote.ts`
- PDF-Erzeugung nur für Angebote (pdf-lib) — `lib/crm/angebot-pdf.ts`
- Versand per mailto, „PDF anhängen und abschicken“ — `components/os/crm/angebot/Ansicht.tsx`
- Rechnungsliste mit Status, Nummer als Textfeld, Storno-Knopf — `components/os/FinanzplanungView.tsx`
- Storno und bezahlt als Aktionen der Route — `app/api/state/finanzplan/route.ts`
- Umsatz-Reiter: „+ PDF“ an Rechnung, „→ als Rechnung planen“ nur für Ablage-Angebote — `components/os/crm/kontakt/UmsatzReiter.tsx`
- Tool-Angebote tragen keinen Ablage-Eintrag (kein „als Rechnung planen“) — `lib/crm/umsatz.ts`
- Beleg lesen schreibt nichts, nutzt KI — `app/api/beleg/route.ts`
- Beleg übernehmen → Buchung oder Rechnung, ohne Datei-Ablage — `app/api/beleg/uebernehmen/route.ts`
- Beleg aus Mail in der Inbox eingehängt (auch online) — `components/os/inbox/Gespraech.tsx`
- CRM-Dateiablage (online) — `app/api/crm/dateien/route.ts`
- Online-Stand 38f88dc0 (07.10.) — `BAUSTAND.md`

</details>

## Gesundheit
**Stand:** gemischt — online ist der Stand vom 07.10. abends (main 38f88dc0, dazu der Hotfix vom 08.10.): Seite, Index, Sport, Ernährung, Datei-Import (nur Inhaber), Telegram-Takt (neutrale Hinweise) und die Art.-9-Einwilligung. Nur lokal: WHOOP je Person, Schutz der Ernährungsprofile, personenneutrale Essensvorschläge.

**Heute gibt es**
- Seite Gesundheit mit fünf Reitern: Heute · Index · Verlauf · Ernährung · Körper.
- Morgen-Check mit drei Ringen (Recovery, Schlaf, Anspannung 1–5) und einem Satz zur Tageslage. Die Recovery steht auf Grün, Gelb oder Rot.
- Tagesliste zum Abhaken mit Routinen und einem Symptom-Regler. Daneben die Karte „Drei Fragen“ (gut, dankbar, hart zu dir) und die Karte „Für dich“ mit Rückblick, heute und Ausblick.
- Gesundheits-Index mit drei Säulen (Erholung & Schlaf, Bewegung & Aufbau, Ernährung & Körper). Ein Klick auf eine Kennzahl zeigt Formel, Schwellen und Verlauf. Der Reiter „Verlauf“ zeigt 30 Tage Recovery, Schlaf, HRV, Ruhepuls, einen Symptom-Wert und Routinen.
- WHOOP-Werte kommen online über eine Export-Datei (ZIP oder CSV). Einlesen darf nur der Inhaber, alle anderen tragen den Morgen-Check von Hand ein. Der Telegram-Bote meldet sich morgens, mittags, abends und sonntags, wenn Telegram eingerichtet und gekoppelt ist. Ohne Ausnahme schickt er nur einen neutralen Hinweis mit Link, keine Werte.
- Sport-Bereich: geführter Einstieg (Hyrox, Lauf, Kraft oder Grundlagen), Wochenplan mit Plan gegen Ist, Hyrox-Zielzeit-Rechner, Läufe mit Bestzeiten, Gym mit Übungsbibliothek und Erholungs-Ampel „Heute trainieren?“.
- Ernährung zu zweit: Essenswoche, Einkaufsliste nach Kategorien („Warenkorb kopieren“ für den Lieferdienst), Vorrat, Stammliste, Profile je Person und eure Gerichte-Bibliothek. Auf Klick schlägt ZOE Wochenplan und Rezepte vor.
- Die andere Person sieht deine Gesundheit nur, wenn du sie im Konto mit ihr teilst. Ihre ZOE darf deine Werte nur mit einer zusätzlichen Einwilligung abfragen.
- Einwilligung für Gesundheitsdaten in drei Zwecken (verarbeiten, an die KI, an den Partner samt dessen ZOE) unter Datenschutz. Oben im Bereich steht ein Hinweis, solange sie fehlt. Ohne sie geht nichts an die KI.

**Halb fertig / aus / wartet auf Einrichtung**
- Die direkte WHOOP-Verbindung je Person (mit Webhook und automatischem Abgleich) ist fertig gebaut, aber nur lokal. Es fehlen die Zugangsdaten aus dem WHOOP-Developer-Dashboard, deshalb zeigt die Karte „nicht eingerichtet“. Die Datenschutz-Garantie von WHOOP steht noch auf „zu prüfen“.
- Online gibt es noch den alten WHOOP-Anschluss. Er gilt nur für den Inhaber und nutzt die alte Schnittstelle v1, die WHOOP abgekündigt hat. Lokal ist er schon ersetzt.
- Der Reiter „Körper“ zeigt Profil und Stufenplan, „Was Aufmerksamkeit braucht“ und „Zusammenhänge“ fest aus dem Code (Stand 29.07.). Das sind echte Gesundheitsangaben einer Person. Sie erscheinen bei jedem Konto, auch bei Malin in ihrer eigenen Ansicht, und würden in jeder Demo- oder Kunden-Instanz erscheinen. Bei den Hebeln kommen nur drei von sechs Werten live aus dem Index, die anderen drei sind feste Texte. Energie und Gesundheits-Meilensteine im selben Reiter sind dagegen live.
- Feste Sonderfälle für Kevin: „Sauber geblieben“ steht bei ihm immer da, bei anderen nur, wenn es Einträge gibt. Ohne eigene Werte rechnet der Server bei ihm mit festen WHOOP-Werten vom 30.07. Symptom-Regler und der Satz ein fester Hinweistext zu einer Beschwerde stehen für jede Person drin.
- Strava und Apple Health sind nur als Herkunft im Datenmodell vorgesehen. Einen Import gibt es nicht.
- Zwei Dinge gibt es nur lokal: personenneutrale Essensvorschläge und den Schutz der Ernährungsprofile (Bedarf, Ziel und Unverträgliches sieht nur die Person selbst). Online sehen beide alle Profile.

**Fehlt (für Richtungsentscheidungen)**
- Gesundheitsinhalte (Beschwerden, Hebel, Profil, Stufenplan) als pflegbare Daten je Person statt fest im Code. Das ist die Voraussetzung, damit der Bereich für andere Kunden taugt.
- Der Sportplan ist nicht mit dem Kalender verbunden. Es entstehen keine Trainingsblöcke, die Zeit belegen.
- Kein automatischer Import aus Apple Health oder Strava. Eine echte Lieferdienst-Bestellung gibt es nicht, nur kopierten Text.
- Richtungsfrage: Gehört Gesundheit (besonders geschützte Daten nach Art. 9) zum verkaufbaren AI-CEO-Produkt oder bleibt sie privat?
- Malin ist Gesundheits-Beauftragte, hat dafür aber keine eigene Rolle oder Sicht. Sie sieht nur, was jemand mit ihr teilt.

<details><summary>Belege im Code</summary>

- Fünf Reiter, Morgen-Check, Routinen/Symptom-Regler, Drei Fragen, Für dich, Körper-Reiter ohne Bedingung je Person, Hebel nur teils live, Sauber-geblieben-Sonderfall ansicht === 'kevin' — `components/os/GesundheitView.tsx`
- Echte Gesundheitsangaben einer Person und feste WHOOP-Werte vom 30.07. im Code — `lib/make-one/health-data.ts`
- Feste Rückfallwerte nur für person === 'kevin' — `lib/vitals.ts`
- Index: drei Säulen, 18 Kennzahlen — `lib/gesundheit/index.ts`
- Telegram-Takt: ohne telegramVollFuer nur neutraler Hinweis mit Link; ohne Token kein Lauf — `lib/gesundheit/lauf.ts`
- WHOOP-Export-Import: GET und POST nur nurInhaber — `app/api/import/whoop/route.ts`
- Teilen = Konto › teilt.gesundheit; Partner-ZOE braucht zusätzlich (b) und (c) — `lib/zoe/raum.ts`
- Drei Zwecke der Einwilligung, gesundheitFuerZoe; Datei ist in origin/main (online) — `lib/datenschutz/gesundheit-einwilligung.ts`
- Hinweis zur Einwilligung oben im Bereich, auch online — `components/os/gesundheit/EinwilligungHinweis.tsx`
- Sport: Einstieg Hyrox/Lauf/Kraft/Grundlagen, keine Kalender-Anbindung — `components/os/sport/Einstieg.tsx`
- Strava/Apple Health nur als Quellen-Typ — `lib/sport/modell.ts`
- Ernährung: Woche, Einkauf, Warenkorb, Vorrat, Stammliste, Profile, Gerichte — `components/os/ErnaehrungView.tsx`
- WHOOP-Karte „nicht eingerichtet“; nicht in origin/main — `components/os/gesundheit/WhoopKarte.tsx`
- WHOOP-Garantie 'pruefen' — `lib/datenschutz/einrichtung.ts`
- Online-Stand = 38f88dc0 (07.10.); malin-sicht/-2 und whoop nur auf entwicklung — `BAUSTAND.md`
- Personenneutrale Essensvorschläge nur lokal (nicht in origin/main) — `lib/ernaehrung/neutral.ts`

</details>

## Familie & Partnerschaft
**Stand:** online — der ganze Bereich ist in main (Stand 07.10. abends), auch der Kalender-Spiegel mit Nachziehen und die Geburtstage in Kalender, Glocke, Heute und ZOE. Lokal gibt es dazu keine weiteren Änderungen.

**Heute gibt es**
- Seite Familie & Partnerschaft mit drei Teilen: Wir zwei · Familie · Rahmen.
- Pflege-Rhythmus über 28 Tage: Er misst, was ihr gemeinsam tut, nie eine Person. In einer Ausnahmezeit pausiert er. Er zählt als Säule „Familie & Partnerschaft“ im Wachstums-Score.
- Wir zwei: Wertschätzung „heute verbunden“, Themen-Parkplatz mit Vereinbarungen, Dates mit Ideenkatalog, „Wenn es hakt“ (Reparatur mit eigener Reflexion), Wünsche und Profile mit Träumen, eure Vision je Jahr.
- Paar-Gespräch mit festem Wochentermin, fester Agenda und geführter Gesprächsansicht. Die Ansicht hat sechs Schritte mit Zeitbox und macht nach einem Abbruch dort weiter.
- Familie: wichtige Tage mit Aktion (Geschenk, Karte …), „Unsere Menschen“ mit Kontakt-Takt, Karten „Wer trägt was“ und Traditionen.
- Rahmen: Termin des Paar-Gesprächs, Business-freie Zeiten, Ausnahmezeit und Kinder an/aus.
- Die Seite „Kontakte · privat“ zeigt dieselben Menschen und wichtigen Tage noch einmal: Name, Rolle, Geburtstag, Kontakt-Takt und Notiz. Ein Adressbuch ist sie nicht.
- Was als „nur ich“ markiert ist, sieht nur, wer es geschrieben hat. Der Server sorgt dafür.
- Paar-Gespräch und Dates kommen per Knopf in den gemeinsamen iCloud-Kalender. Verschiebt man sie oder sagt ab, zieht der Termin nach. Geburtstage aus der Familie stehen im Kalender, in der Glocke, auf Heute und bei ZOE, mit Geschenk-Vorlauf.

**Halb fertig / aus / wartet auf Einrichtung**
- Business-freie Zeiten werden nur gespeichert. Sie wirken nirgends: keine Sperre im Kalender, keine Wirkung auf Kapazität oder ZOE.
- „Mit Kindern“ schaltet nur zusätzliche Aufgabenkarten frei. Ein eigener Kinder-Bereich fehlt.

**Fehlt (für Richtungsentscheidungen)**
- Business-freie Zeiten wirklich durchsetzen: im Kalender blockieren, in der Kapazität abziehen, ZOE daran halten.
- ZOE hat kein eigenes Werkzeug für Familie und macht keine Vorschläge für Dates oder die Gesprächs-Agenda. Sie kennt nur die Geburtstage der nächsten 7 Tage.
- Gebaut für genau zwei Erwachsene (Partner = die andere Person). Weitere Familienmitglieder als eigene Nutzer gibt es nicht.
- Ein privates Adressbuch mit Telefon, Mail und Adresse fehlt. „Kontakte · privat“ kennt nur Name, Rolle, Geburtstag und Takt.
- Richtungsfrage: Gehört das Paar- und Familienmodul ins verkaufbare Produkt oder bleibt es privat?

<details><summary>Belege im Code</summary>

- Drei Teile; Rahmen mit Paar-Gespräch, Business-frei, Ausnahmezeit, Kinder — `components/os/familie/FamilieView.tsx`
- Kacheln Wir zwei inkl. Vision, Reparatur, „Einander kennen“, „in den Kalender“ über /api/kalender/spiegel — `components/os/familie/WirZwei.tsx`
- Geführtes Paar-Gespräch, sechs Schritte mit Zeitbox — `components/os/familie/Gespraech.tsx`
- Wichtige Tage, Menschen mit Takt, Wer trägt was, Traditionen; Kinder nur zusätzliche Karten — `components/os/familie/FamilieOrga.tsx`
- Pflege-Rhythmus 28 Tage, Pause, sichtFuer „nur ich“ — `lib/familie/logik.ts`
- Rhythmus als Faktor im Wachstums-Score — `lib/performance.ts`
- Mensch ohne Telefon/Adresse; businessFrei nur im Typ, nirgends ausgewertet — `lib/familie/typen.ts`
- „Kontakte · privat“ = dieselben Menschen + Tage — `components/os/familie/MenschenView.tsx`
- Server filtert „nur ich“, zieht Kalender-Spiegel nach (auch in origin/main) — `app/api/familie/route.ts`
- Kalender-Spiegel ist in origin/main (online) — `lib/kalender/spiegel.ts`
- Geburtstage als Quelle ist in origin/main (online) — `lib/kalender/quellen-geburtstage-server.ts`
- ZOE sieht nur Anlässe (Geburtstage) im Kontext, kein Familien-Werkzeug — `lib/brain.ts`

</details>

## Brain & Wissen
**Stand:** gemischt — online ist der Stand vom 07.10. abends: Brain-Seite mit Fragen, Stöbern, Regeln und Inbox, nächtliche Zusammenfassung mit App-Tagesbericht, Brain-Kugel und die gemeinsame ZOE-Suche über Brain und App. Der _App-Spiegel ist ausgeschaltet, der Vault-Abgleich am Mac nicht eingerichtet. Nur lokal: Brain als Reiter unter ZOE und die zwei Sicht-Korrekturen vom 08.10.

**Heute gibt es**
- Seite Brain für den Obsidian-Vault mit Notizenzahl. Am Rechner mit Obsidian gibt es den Knopf „Obsidian öffnen“.
- „Fragen“: Chat mit dem Brain. Er antwortet nur aus euren Notizen und nennt Quellen, die man rechts lesen kann.
- „Stöbern“ nach Bereichen und eine Notiz im Lesefenster öffnen. Bearbeitet wird in Obsidian.
- „Regeln“: Konstitution und Regeln für ZOE anlegen, als Entwurf halten, freigeben und ablösen. Nur freigegebene Regeln gehen an ZOE.
- „Inbox“: Vorschläge von ZOE (neue Notiz, Ergänzung, Regel) annehmen oder mit Grund ablehnen. Nachts fasst ZOE den Tag zu Vorschlägen zusammen, auf Wunsch auch per Knopf. Dazu kommt ein App-Tagesbericht.
- Private Notizen sieht nur ihr Eigentümer. ZOE sucht mit derselben Sicht. Im Gespräch legt sie Notizen nur als Vorschlag über den Freigabe-Stapel an.
- Brain-Kugel: Kontakte, Firmen, Deals, Mandate, Aufgaben, Ziele, Meilensteine, Termine, Notizen und Gesellschaften als Sterne zum Anklicken. Sie zeigt nur, was man sehen darf.
- ZOE kann Brain und App in einem Zug durchsuchen (Aufgaben, Projekte, Angebote, Mandate).

**Halb fertig / aus / wartet auf Einrichtung**
- Der Abgleich zwischen Mac und Server per Git ist gebaut, am Mac aber nicht eingerichtet. Der Vault wurde zuletzt am 25.09. hochgeladen, am Mac liegen seitdem rund 157 nicht abgeglichene Änderungen. Online antwortet das Brain aus dieser alten Kopie. Das Einrichten ist für den nächsten Upload beschlossen (08.10.).
- Der „_App-Spiegel“ (Projekte, Mandate, Angebote, Entscheidungen als Notizen im Vault) ist online im Code, aber ausgeschaltet. Das Einschalten ist für den nächsten Upload beschlossen (08.10.).
- Für die Einstellungen der App-Brücke (Privat nur als Zahlen oder voll, Freigabe der Zeitauswertung) gibt es eine Schnittstelle, aber keine Oberfläche.
- Die Bedeutungssuche (Embeddings) ist auf dem Server mit 1 CPU aus. Dort gibt es nur Stichwortsuche.
- In der Brain-Kugel fehlen Gesundheit, Familie und Finanzen. Das ist bewusst so.
- Regeln und Inbox kennen die Personen fest als kevin und malin und fallen auf „kevin“ zurück. Gemeinsame Vorschläge sieht nur, wer kevin oder malin heißt. In einer Demo- oder Kunden-Instanz bliebe die Inbox damit für alle leer. Das widerspricht der Plattform-Regel.
- Zwei Sicht-Lücken sind nur lokal geschlossen (08.10.). Online landen nachts persönliche gemerkte Fakten aus Kevins Raum als „gemeinsam“ in der Brain-Inbox und sind für Malin sichtbar. Außerdem kann ein Nachtrag von ZOE an ein fremdes Protokoll mit gleichem Titel angehängt werden.

**Fehlt (für Richtungsentscheidungen)**
- Notizen in MAKE OS selbst schreiben oder bearbeiten. Heute geht das nur in Obsidian.
- Brain für Testkunden: Wie bekommt eine Kunden-Instanz ihren Vault ohne Obsidian und Git-Einrichtung?
- Feste Kern-Notizen (Profile, laufende Projekte), die ZOE immer mitliest. Heute lädt sie fest nur ihre Identität, die Vertraulichkeitsregeln, die Konstitution und die Regeln. Alles andere sucht sie.

<details><summary>Belege im Code</summary>

- Modi Fragen/Stöbern/Regeln/Inbox, Brain-Kugel (auch in origin/main), Obsidian-Knopf; ZoeReiter nur auf entwicklung — `components/os/WissenView.tsx`
- Regeln: Entwurf, freigeben, ablösen — `components/os/wissen/Regeln.tsx`
- Inbox mit Annehmen/Ablehnen, Index- und Konsolidierungsknopf — `components/os/wissen/Inbox.tsx`
- Gemeinsame Vorschläge nur für person === 'kevin' || 'malin'; Rückfall 'kevin' — `lib/brain/inbox.ts`
- GiltFuer fest kevin/malin, Rückfall 'kevin' — `lib/brain/regeln.ts`
- Tagesbericht + Spiegel in der nächtlichen Konsolidierung; Fix „nur gemeinsamer Raum“ erst 08.10. auf entwicklung — `lib/brain/konsolidierung.ts`
- Schreiben nur mit MAKE_VAULT_DIR (Server /vault); Spiegel zusätzlich MAKE_OS_APP_SPIEGEL=an — `lib/brain/vault-ziel.ts`
- Nachtrag an fremdes Protokoll erst 08.10. lokal verhindert (anhaengenErlaubt) — `lib/zoe/vault.ts`
- notiz_anlegen/notiz_ergaenzen im Gespräch immer Vorschlag — `lib/zoe/gespraech-schutz.ts`
- Keine Oberfläche ruft /api/brain/app auf — `app/api/brain/app/route.ts`
- Embeddings erst ab 3 CPUs — `lib/brain/einbettung.ts`
- Kugel-Arten ohne Gesundheit/Familie/Finanzen — `lib/brain/kugel.ts`
- Suche über Brain und App, eingehängt in origin/main — `lib/zoe/arbeit-werkzeug.ts`
- Abgleich-Skript vorhanden; Mac-Vault-Repo letzter Commit 25.09., kein Launch-Agent, kein Obsidian-Git-Plugin — `deploy/vault-abgleich.sh`
- Schritt 5 „Vault-Abgleich per Git“ und Schritt 6 „_App-Spiegel an“ erst beim nächsten Upload — `UPLOAD_0810.md`
- Online-Stand 38f88dc0 und Kevins Entscheidungen 08.10. — `BAUSTAND.md`
- ZOE lädt fest 00_ZOE_AGENT, Vertraulichkeitsregeln, Konstitution, Regeln — `lib/zoe/vault.ts`

</details>

## Datenschutz & Sicherheit
**Stand:** gemischt — Datenschutz-Seite (unter System), zweiter Faktor mit Pflicht-Schalter, KI-Schalter, Nachweise, Meine Daten und Routen-Register sind seit dem Upload vom 05.10. abends online; die 2FA-Pflicht (Schalter in der App), Pepper und der strenge Riegel (Server) sind noch nicht gesetzt, und die Verschärfungen bei Malins Sicht liegen nur auf entwicklung

**Heute gibt es**
- Eine Seite „Datenschutz“ (online unter „System“, lokal heißt der Bereich jetzt „Einstellungen“) mit einer Selbstprüfung als Ampel („x von y erfüllt“, je offenem Punkt ein Knopf „Beheben“), dem Verantwortlichen, der Liste der Dienstleister mit Stand des Auftragsverarbeitungsvertrags (AVV) und dem Verzeichnis zum Öffnen/Drucken oder als Datei
- Zweiter Faktor je Konto (Authenticator-App plus acht Wiederherstellungs-Codes); der Inhaber hat im Konto einen Schalter, der ihn für alle zur Pflicht macht
- Jede Person kann unter Konto › Meine Daten selbst ihre Auskunft (Art. 15) ansehen, alle eigenen Daten herunterladen und ihr Konto löschen (Passwort, „LÖSCHEN“ eintippen, mit zweitem Faktor auch den Code; der Inhaber erst, wenn es keine anderen Konten mehr gibt)
- KI-Schalter für die ganze Instanz und je Person: Hintergrund-KI, Web-Suche und einzelne Bereiche, die ZOE lesen darf (unsere Instanz steht auf „kompatibel“, also alles an); dazu ein KI-Protokoll, das nur festhält, wann und wofür die KI genutzt wurde, und als Datei herunterladbar ist
- Gesundheits-Einwilligung je Person in drei Stufen: in MAKE OS verarbeiten, an die KI geben, mit dem Partner teilen
- Nachweise nur für den Inhaber: wer welche sensiblen Daten angesehen hat, eine Prüfung „Protokoll unverändert“ und der Stand der Verschlüsselung
- Die Bestände liegen auf dem Server verschlüsselt (ohne Datenschlüssel startet die App dort nicht); jede Nacht entsteht eine Sicherung auf dem Server, dazu die täglichen Hetzner-Abbilder
- Nur für den Inhaber: ein Register für Datenpannen und „Vertragsende“ (die ganze Instanz exportieren)
- Im Hintergrund: jede Schnittstelle steht mit ihrer Zugangsregel in einem Register, das ein Test prüft, und Privates der anderen Person liefert der Server gar nicht erst aus (zum Beispiel Kalender nur als „Belegt“)

**Halb fertig / aus / wartet auf Einrichtung**
- 2FA-Pflicht (ein Schalter in der App), Pepper und strenger Start-Riegel (Einstellungen am Server) sind gebaut, aber noch nicht eingeschaltet — das sind Upload-Schritte vom 08.10.; Kevin muss vor der Pflicht selbst den zweiten Faktor einrichten
- Das neuere Speicherformat v2 und die stärkere Passwort-Härtung sind gebaut, bleiben aber bewusst aus (erst nach stabilen Tagen)
- Die Nachtsicherung auf dem Server läuft ohne age (nur openssl, Passwortdatei auf demselben Server). Der zweite Sicherungsort am Mac ist nie eingerichtet worden, und eine Wiederherstellung wurde nie geübt
- Die Datenschutz-Dokumente (AVV-Vorlage, TOM, DSFA, Löschkonzept, Datenschutzhinweis der App) sind Entwürfe mit offenen Platzhaltern, nicht anwaltlich geprüft — und in der App stehen nur ihre Namen, lesen kann man sie dort nicht
- Die Verträge mit Dienstleistern sind im System als Status pflegbar. Kevin hat am 08.10. die AVV mit Hetzner und Google und die Drittland-Verträge bestätigt; die eigene Lückenliste (Stand 05.10.) führt die AVV aber noch als nicht nachgewiesen, und ob sie im System als „bestätigt“ eingetragen sind, ist nicht belegt
- Glocken-Meldungen per Telegram: es gibt einen Schalter, aber der Versand ist nicht gebaut — auch eingeschaltet geht nichts raus
- Nur lokal: die Verschärfungen bei Malins Sicht (fremde Routinen und Wochenblöcke nur „Belegt“, Ernährungsprofile nur für die Person selbst) und die automatische Prüfung aller lesenden Schnittstellen
- Eine Instanz löschen geht nur per Skript, nicht aus der App (so gewollt)

**Fehlt (für Richtungsentscheidungen)**
- Anwaltliche Prüfung und ein fertiges Datenschutz-Paket für Kunden (AVV, TOM, Liste der Unterauftragnehmer) — Voraussetzung für den ersten Testkunden
- Ein bewiesener Rückweg: eine Wiederherstellung aus der Sicherung testen und eine Sicherung außerhalb von Hetzner einrichten
- Kein externer Sicherheitstest und keine Meldestelle für Schwachstellen
- Offene Fragen an Kevin zum Teilen zwischen den Partnern (z. B. eigene Ziele der anderen lesbar? Agenten-Log je Person trennen?) — entschieden und gebaut ist das noch nicht
- Server-Härtung offen: sudo ohne Passwort, nur ein kleiner Server (1 vCPU / 2 GB)
- Datenschutz-Folgenabschätzung abschließen und die Frage Datenschutzbeauftragter klären — laut eigener Analyse voraussichtlich Pflicht (Gesundheit + KI)
- Die Brain-Notizen (Vault) liegen auf dem Server und bei GitHub unverschlüsselt — dafür gibt es noch keine Lösung

<details><summary>Belege im Code</summary>

- Datenschutz-Seite mit Prüfung, Verantwortlichem, Empfängern, Verzeichnis, Nachweisen (nur Inhaber), Pannen, Vertragsende — `components/os/DatenschutzView.tsx`
- Selbstprüfung „x von y erfüllt“ mit Knopf „Beheben“ — `components/os/datenschutz/Pruefung.tsx`
- Dokumente nur als Dateinamen im Repository, die App liefert sie nicht aus — `components/os/datenschutz/Dokumente.tsx`
- KI-Schalter (Instanz/Person, Bereiche), Vorgabe kompatibel/sparsam, Telegram-Ausnahme, KI-Protokoll als Datei, Gesundheits-Einwilligung (a/b/c) — `components/os/datenschutz/KiGesundheit.tsx`
- Lese-Protokoll, Protokoll-Kette, Verschlüsselungsstand, Format-v2-Bereitschaft — `components/os/datenschutz/Nachweise.tsx`
- Auskunft, Herunterladen, Konto löschen (Passwort, Code nur mit 2FA, „LÖSCHEN“; Inhaber nur ohne andere Konten) — `components/os/MeineDaten.tsx`
- Zweiter Faktor mit acht Wiederherstellungscodes, Kachel „Zugang der Instanz“ nur für den Inhaber — `components/os/KontoView.tsx`
- 2FA-Pflicht ist ein Schalter in der App — `components/os/ZugangEinstellungen.tsx`
- Start-Riegel: am Server kein Start ohne Datenschlüssel; Pepper nur Pflicht mit MAKE_OS_START_RIEGEL=streng — `lib/zugang/start-riegel.ts`
- Upload-Schritte: Pepper + strenger Riegel am Server, 2FA-Pflicht per Schalter (Kevin richtet erst selbst 2FA ein), Format v2 erst danach — `UPLOAD_0810.md`
- Befund: kein age am Mac, keine Abholung, zweiter Sicherungsort läuft nicht, Restore nie geübt — `RESTORE_TEST.md`
- Lückenliste L1–L19: age am Server fehlt, Restore nie, 2FA nicht erzwungen, AVVs nicht nachgewiesen, Vault unverschlüsselt (L9), sudo ohne Passwort, kein externer Test — `datenschutz/TOM.md`
- Dokumente sind Entwürfe; DSFA-pflichtig, voraussichtlich DSB-Pflicht — `datenschutz/README.md`
- Zugangsregel je Schnittstelle (Register mit Wächtertest), Modul-Klasse nur vorbereitet — `lib/zugang/routen-register.ts`
- Telegram-Haken der Glocke versendet nichts, auch wenn der Schalter an ist — `lib/meldungen/speicher.ts`
- Kevins Entscheidungen 08.10. (AVV Hetzner/Google bestätigt, Upload-Schalter), offene Fragen aus der Sicht-Prüfung — `BAUSTAND.md`

</details>

## Plattform & Testkunden
**Stand:** gemischt — Demo-Saat, Einrichtungs-Code, Start-Riegel, KI-Vorgabe und Datenschutz-Einrichtung sind seit dem 05.10. im Online-Code, aber keine Demo- oder Kundeninstanz läuft; das überarbeitete Onboarding (Server-Stand) liegt nur auf entwicklung

**Heute gibt es**
- Ein Skript füllt eine leere Beispiel-Instanz mit einem erfundenen Paar (Lena/Jonas), Firmen, Kontakten, Deals, Zielen, Terminen, Finanzplan und Gründungsfahrplan; in so einer Demo gibt es unter System den Knopf „Demo zurücksetzen“
- Eine neue, leere Instanz startet ohne Konto. Das erste Konto (Inhaber) entsteht mit einem Einmal-Code aus dem Server-Terminal, weitere Personen lädt der Inhaber im Konto ein
- Die Namen der drei festen Firmen und die Vertriebs-Zuständigkeiten lassen sich je Instanz beim Bauen einstellen; weitere Gesellschaften trägt man im Unternehmens-Register selbst ein
- Die Datenschutz-Einrichtung je Instanz (Verantwortlicher, Dienstleister) geht über die Oberfläche; neue Instanzen starten mit KI „sparsam“ (Hintergrund-KI und Web-Suche aus)
- Ohne Dienstschlüssel, Sitzungs-Geheimnis und Datenschlüssel startet die App am Server gar nicht erst — eine Kundeninstanz kann also nicht „offen“ hochfahren; die Vorlage für neue Instanzen verlangt zusätzlich den Pepper
- Updates rollen per GitHub auf unseren einen Server aus, und der Head of IT zeigt die Lage dieser Instanz als Ampeln

**Halb fertig / aus / wartet auf Einrichtung**
- Die Demo-Instanz läuft nirgends online: Container und Adresse (demo.makeinnovation.de) sind nur beschrieben, ein nächtliches Zurücksetzen ist nicht gebaut
- Das Onboarding (drei Spuren Fundament, Kevin, Malin, prüft teils selbst, was erledigt ist) ist fest auf uns beide zugeschnitten; online steht noch die alte Mac-Fassung (.env.local, iCloud-Ordner), die Fassung auf Server-Stand mit Prüfung von zweitem Faktor und Sicherung gibt es nur lokal
- Neutralisierung erst teilweise: noch rund 260 Stellen in etwa 100 Dateien kennen fest „kevin“/„malin“ (der Plan zählt mit „beide“ 361 Stellen), und ZOE-Prompts tragen teils noch unseren Kontext
- Markttraktion als eigenes Modul ist nur im Routen-Register markiert — es gibt keine Modul-Schalter und keine Lizenzen
- Firmennamen, Vertriebs-Zuständigkeiten und die Zuordnung Privat/Business je Firma lassen sich nur über Variablen beim Bauen ändern, nicht in der Oberfläche
- Der KI-Verbrauch wird gezählt, aber es gibt keine Monatsgrenze und kein Budget je Instanz
- Die Datenschutz-Checkliste je Kundeninstanz ist geschrieben, aber nur als Entwurf

**Fehlt (für Richtungsentscheidungen)**
- Eine Instanz-Fabrik: neuen Kunden per Skript oder Knopf anlegen (Container, eigene Domain, Schlüssel, Sicherung) und Updates an alle Instanzen verteilen
- Ein Einrichtungs-Assistent beim ersten Start (Name, Personen, Firmen, Ziele, Kalender, KI-Schlüssel) — heute kommt ein Kunde nicht ohne euch los
- Lizenzen und Editionen (z. B. „nur Markttraktion“) samt Modul-Schaltern
- Eine Feedback-Brücke („Melden“ aus der Kundeninstanz landet ohne Kundendaten in eurem Bauplan) und protokollierter Support-Zugriff
- Kapazität: ein kleiner Server (1 vCPU / 2 GB); mehrere Instanzen nebeneinander sind ungeprüft
- Anbindungen (Google, WhatsApp, WHOOP, iCloud) brauchen je Instanz eigene Zugänge und werden heute per Server-Skript eingerichtet — ein Kunde kann das nicht selbst
- Abrechnung und Preis je Kunde — laut Plan erst nach den Testkunden

<details><summary>Belege im Code</summary>

- Demo-Saat mit erfundenem Haushalt über die normalen Schreibwege — `lib/demo/saat.ts`
- Riegel: Zurücksetzen nur mit MAKE_OS_DEMO=1, Inhaber, Demo-Marke — `lib/demo/schutz.ts`
- Demo-Container auf dem Server nur beschrieben, nächtliches Zurücksetzen nicht gebaut, bekannte Grenzen (kevin/malin-Altstellen, Prompts) — `DEMO.md`
- Knopf „Demo zurücksetzen“ unter System eingehängt — `components/os/SystemView.tsx`
- Erstes Konto nur mit Einmal-Code aus dem Terminal — `scripts/einrichtung-token.mjs`
- Pflicht-Geheimnisse im Modus „scharf“, Pepper nur mit „streng“ — `lib/zugang/start-riegel.ts`
- Vorlage für neue Instanzen setzt MAKE_OS_START_RIEGEL=streng — `deploy/env.server.beispiel`
- KI-Vorgabe „sparsam“ für neue, „kompatibel“ für unsere Instanz — `lib/datenschutz/ki-einstellungen.ts`
- Onboarding-Spuren fest Kevin/Malin (Plattform-Schuld im Kommentar); online noch Mac-Fassung — `lib/make-one/onboarding-data.ts`
- Vertriebs-Team nur über NEXT_PUBLIC_MAKE_OS_CRM_TEAM — `lib/crm/team.ts`
- Pakete Neutralisieren (361 Stellen), Einrichtung, Modul-Schalter, Instanz-Fabrik und Lizenzen nur geplant — `PLATTFORM_PLAN.md`
- Ziel: 3–5 Testkunden im Januar, Instanz-Fabrik im Dezember, Datenschutz-Paket im November, Feedback-Brücke — `ROADMAP_Q4.md`
- Modul-Klasse „modul:markttraktion“ nur als Markierung, bis zur Lizenz gilt das Haushalts-Tor — `lib/zugang/routen-register.ts`
- KI-Verbrauch nur gezählt, keine Grenze — `lib/zoe/verbrauch.ts`
- Anbindungen je Instanz per Server-Skript — `deploy/google-verbinden.sh`
- Kundencheckliste Datenschutz nur als Entwurf — `datenschutz/KUNDEN_ONBOARDING_DATENSCHUTZ.md`

</details>

## Handy, Sprache & Telegram
**Stand:** gemischt — Web-App, alte Handy-Leiste, Sprache mit ZOE, Diktat und Netzwerken sind online; die Telegram-Teile sind im Online-Code, kommen aber ohne Boten auf dem Server praktisch nicht an (Koppeln geht online nicht); die neue Handy-Leiste liegt nur auf entwicklung

**Heute gibt es**
- MAKE OS lässt sich als Web-App auf den Homescreen legen (eigenes Icon, startet ohne Browserleiste)
- Am Handy gibt es eine Leiste unten — online: Home · Privat · Business · ZOE · Netzwerken · System
- ZOE per Sprache: Mikrofon-Knopf zum Diktieren, ZOE liest Antworten vor, dazu ein Gesprächsmodus ohne Tippen. Die Erkennung macht der Browser selbst (dabei kann Audio an den Browser-Hersteller gehen); MAKE OS speichert dabei kein Audio
- Diktieren geht auch für Notizen an Kontakten. Netzwerken ist fürs Handy gebaut: Kontakt erfassen, eigene Visitenkarte als QR-Code, Sprachnotiz (als Audio verschlüsselt am Kontakt, 90 Tage), verschlüsselte Warteschlange ohne Netz
- Morgens legt ZOE Vorschläge in den Freigabe-Stapel — das sieht man in der App, nicht per Telegram

**Halb fertig / aus / wartet auf Einrichtung**
- Telegram ist gebaut, kommt online aber praktisch nicht an: Koppeln per Code in der Konto-Seite, Gesundheits-Check-in morgens/mittags/abends plus Wochenblick, werktags die Vertriebs-Morgennachricht, freitags das Scoreboard, der Tagesbericht vom Head of IT und die Warnung bei neuer Anmeldung oder Fehlversuchen
- Der Telegram-Abholer („Bote“) läuft nur am Mac und spricht dort mit der lokalen App, nicht mit dem Server; den Dienstschlüssel nimmt der Server von außen seit 05.10. ohnehin nicht mehr an. Neu koppeln und Antworten an ZOE aus Telegram gehen online deshalb nicht; ob Bot-Token und eine alte Kopplung aus der Mac-Zeit am Server liegen, steht nicht im Repo
- Telegram-Texte sind standardmäßig neutral („Neue Nachricht in MAKE OS“ mit Link), volle ZOE-Antworten nur, wenn die Person das selbst einschaltet — wirkt erst, wenn Telegram am Server läuft
- Sprachnachrichten in Telegram: Der Bot antwortet „kann ich noch nicht hören“; die Transkription von Sprachnotizen ist nicht gebaut (Schalter vorhanden, er tut auch eingeschaltet nichts)
- Glocken-Meldungen an Telegram weiterleiten: Schalter da, Versand nicht gebaut
- Es gibt kein gemeinsames 7-Uhr-Briefing von ZOE per Telegram (laut Roadmap geplant); gebaut sind nur Gesundheits-Check-in und Vertriebsnachricht getrennt
- Die neue Handy-Leiste (Heute · Inbox · Menü · ZOE · Netzwerken, Menü als Blatt mit allen Punkten) gibt es nur lokal
- Die Web-App hat keinen Offline-Modus (außer der Netzwerken-Warteschlange) und keine Push-Benachrichtigungen (kein Service Worker)
- Die Sprachfunktion hängt vom Browser ab; ob sie am iPhone im Homescreen-Modus läuft, ist im Code nicht belegt

**Fehlt (für Richtungsentscheidungen)**
- Benachrichtigungen aufs Handy ohne Telegram (Web-Push oder eine native App)
- ZOE als echter Sprach-Assistent: Sprachnachrichten verstehen, Freisprechen, Fernziel Assistent zu Hause
- Entscheidung Telegram oder Alternative (Drittland-Dienst ohne AVV) — und, falls Telegram bleibt, den Empfang auf dem Server betreiben (im Code nur als Idee „Webhook statt Bote“ vermerkt)
- Ein zusammengefasstes Tages-Briefing (Termine, Top-3, offene Freigaben) aufs Handy
- Eine native App (laut Plan später)

<details><summary>Belege im Code</summary>

- Homescreen-Web-App (standalone, Icons), kein Service Worker — `public/manifest.webmanifest`
- Apple-Web-App-Einstellungen im Wurzel-Layout — `app/layout.tsx`
- Neue Handy-Leiste Heute · Inbox · Menü · ZOE · Netzwerken (nur lokal; online noch Home · Privat · Business · ZOE · Netzwerken · System) — `components/os/Leiste.tsx`
- Spracherkennung und Vorlesen im Browser; Audio geht nur zur Erkennung durch den Browser, nichts wird bei uns gespeichert — `hooks/useStimme.ts`
- Mikrofon, Vorlesen, Gesprächsmodus im ZOE-Panel (im OS-Rahmen eingehängt) — `components/os/ZoePanel.tsx`
- Diktat für Notizen an Kontakten — `components/os/crm/KontaktSpalten.tsx`
- Bote = Long-Polling-Prozess, Ziel standardmäßig localhost:3001 — `bote.mjs`
- Bote startet nur über start.sh am Mac — `start.sh`
- Server-Compose hat nur app, arbeiter, caddy — kein Bote — `compose.yml`
- Telegram-Eingang nur über den Dienstweg (vom Boten); Sprachnachrichten werden abgelehnt — `app/api/telegram/eingang/route.ts`
- Senden braucht Token und gekoppelten Chat; Sicherheitsnetz für neutrale Texte — `lib/telegram.ts`
- Gesundheits-Takt morgens/mittags/abends/Woche, nur für gekoppelte Personen — `lib/gesundheit/lauf.ts`
- Takt: Markttraktion und HOI-Bericht nur mit Telegram-Token — `lib/zoe/takt.ts`
- Anmelde-Warnungen (neue Adresse, Fehlversuche) per Telegram — `app/api/konto/anmelden/route.ts`
- Telegram-Kopplung per Code in der Konto-Seite — `components/os/KontoView.tsx`
- Lücke L6: ohne Boten kommen Anmelde-Alarm und HOI-Rot nicht aufs Handy — `datenschutz/TOM.md`
- Transkription: Schalter TRANSKRIPTION_AN, liefert auch eingeschaltet immer null — `lib/crm/netzwerken-karte.ts`
- Geplant: 7-Uhr-Telegram-Briefing, Web-App polieren, Sprache stärken, native App später — `ROADMAP_Q4.md`

</details>

