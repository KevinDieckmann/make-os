# Private Inhalte im Code von MAKE OS: Suchbericht

> Basis für das Phase-3-Paket „feste Kevin/Malin-Stellen vollständig neutralisieren“ (ROADMAP_Q4.md). Nur neutrale Beschreibungen, keine Inhalte. Paket 1 (Finanz-Cockpit-Datei, tote Dateien) und Teile von Paket 2/3 laufen am 08.10. spät vor dem Upload (Branch `vor-upload-datenschutz`).

Stand: Branch `entwicklung`, Commit 01ee4d77. Ich habe nur gelesen und nichts geändert. Durchsucht sind lib/, app/, components/, scripts/ und public/. prototype/ ist nur gezählt. Tests und die Demo-Saat sind ausgenommen. Die drei Stellen, die schon in Arbeit sind (health-data.ts, nordstern-data.ts, der Sonderfall in vitals.ts), melde ich nicht noch einmal.

---

## Teil 1 – für Kevin

### Zahlen je Kategorie
Gezählt sind Zeilen außerhalb von Kommentaren. Die Kategorien überschneiden sich teilweise.

| Kategorie | Zeilen | Dateien | Einordnung |
|---|---|---|---|
| Feste `kevin`/`malin`-Kennungen in Logik, Standards und Rückfällen | 255 | 103 | Plattform-Schuld; vieles funktioniert in einer Kundeninstanz nicht |
| Vornamen in sichtbaren Texten und KI-Prompts | 354 | 125 | davon rund 60 Stellen in Prompts |
| Fremde Firmen- und Produktnamen außerhalb von lib/einheiten.ts (KEMARIS, CapOS, POINCAP, ASTARNA, Liquido, KD Management) | 117 | 55 | dazu 51 feste Nennungen von „KD Ventures“ oder des Nachnamens |
| Gesundheit mit Personenbezug | 269 | 65 | meist Feldnamen zweier krankheitsbezogener Module; etwa 20 sichtbare Texte oder Prompt-Stellen; 6 Kommentare nennen Diagnose oder Substanz |
| Persönliche Ziele und Zahlen (Nordstern, Lebensziel) | 42 | 25 | fest in 11 Agenten-Prompts und als Startwert im Controlling |
| Echte Finanzdaten und Dritte | etwa 40 Datensätze | 1 | alles in public/finanz-dashboard.html |
| Vorname eines Dritten im Finanzkern | 59 | 11 | Feldnamen und eine sichtbare Zahlungszeile |
| Private Texte (Liebesgruß, feste Anrede, Paar-Rituale) | 15 | 11 | dazu 2 ganze Dateien |
| Ohne Anmeldung öffentlich sichtbar | 2 | 2 | Meta-Beschreibung und App-Manifest |
| Adressen und Domains | 3 Rückfälle + 2 Mac-Pfade | 4 | keine IBAN und keine Telefonnummer im TS-Code |
| Toter Code mit Privatem | 2 Dateien | – | wird nirgends importiert |
| Kommentare mit euren Namen | etwa 1.370 | über 600 | niedrig, gehen aber mit dem Code an Dritte |
| prototype/ (nur gezählt) | etwa 200 | 4 | make-os.html: 51 Zeilen mit Namen, 55 mit Firmen, 72 mit Gesundheit, 13 mit Beträgen |

### Die 10 wichtigsten Stellen

1. **public/finanz-dashboard.html** ist Malins altes Cockpit. Darin stehen rund 35 echte Kontobewegungen von Mai bis Juli. Darunter sind Entnahmen und der Zahlungseingang eines namentlich genannten Kunden. Dazu kommen drei echte Eingangsrechnungen mit Rechnungsnummern und ein vorausgefüllter Notarkontakt mit Telefonnummer. Die Datei liegt in public/, ist also in jeder Instanz für jedes angemeldete Konto abrufbar. Sie liegt auch im Repo, das nach der Rohbau-Regel an Dritte geht.
2. **WillkommenMalin.tsx** enthält einen persönlichen Liebesgruß von dir. Er erscheint für jedes Konto mit dem Speichernamen „malin“. In einer Kundeninstanz trifft das jede Inhaberin, die Malin heißt, weil das erste Konto den Vornamen als Speichernamen bekommt.
3. **Wer nicht „malin“ ist, heißt für ZOE „Kevin“.** Das betrifft Empfang, Morgenbericht, Gesprächs-Prompt, den Körperblock und Haushalts-Werkzeuge. Jedes weitere Teammitglied und jede Kundin wird als Kevin mit deiner festen Anrede angesprochen.
4. **Der Grundauftrag von ZOE** (lib/brain.ts und die ZOE-Route) enthält eure Lebenspläne, „Familien-KI“, die Beziehung, eine Körperbeschwerde einer Person und deine Firmen- und Produktgeschichte. Das geht bei jedem Modellaufruf an Anthropic, für jede Person.
5. **Nordstern-Zahlen und dein Lebensziel** stehen fest in 11 Agenten-Prompts. Dazu kommen sie als Startwert im Controlling jeder neuen Instanz.
6. **Vertriebs-Prompts schreiben immer im Namen von Kevin Dieckmann / KEMARIS / POINCAP.** Das gilt für Erstansprache, Prospecting-Kundenprofil, Content-Sprachregeln, Recherche, Tageslauf und die Heads. Diese Entwürfe gehen nach außen.
7. **Gesundheit ist fest verdrahtet.**
   - Ein tägliches Warn-Schild zu einer Körperbeschwerde sehen alle Konten.
   - Die Energie-Seite nennt den Befund einer Person im Klartext.
   - Die Abendfragen zu einem Krankheitsbild gehen an jede Person.
   - Es gibt einen festen Kalender-Baustein und einen Ernährungs-Startbestand, der aus einem Profil abgeleitet ist.
   - Zwei krankheitsbezogene Module (ein Tagebuch, eine Verzichts-Serie) mit eigenen Index-Kennzahlen stecken in jeder Instanz.
8. **Ohne Anmeldung öffentlich:**
   - Die Seiten-Beschreibung nennt euch beide. Sie steht auch auf den öffentlichen Buchungsseiten für Gäste.
   - Das App-Manifest nennt dich.
   - Fehlt die Datenschutz-Einrichtung, fallen Kontakt-Mail, Datenschutz-Seite und Verantwortlicher auf MAKE zurück. Das landet in Danke-Mails an Dritte und widerspricht der Regel „Verantwortlicher nie fest im Code“.
9. **Team-Rückfall bei leerem Bestand.** Eine neue oder leere Instanz bekommt euer Team: dich mit vollem Namen, Malin mit ihren Rollen einschließlich Gesundheitsrolle, und acht Führungsrollen der Beteiligung. Das geht in Prompts und in die Delegation. Konten, die Kevin oder Malin heißen, erben eure Rollen. Die Paar-Rituale zählen in den Wachstums-Score.
10. **Finanzkern und Firmenlisten.**
    - Im Finanzkern stehen Personennamen und der Vorname eines Darlehensgebers als Feldnamen. Der Vorname erscheint auch als sichtbare Zeile im Zahlungskalender.
    - Dazu kommen KEMARIS-Tranchen, ASTARNA-Kunden, das Ankermandat und die Kategorie „Entnahme Kevin“.
    - Es gibt eine zweite Firmenliste neben lib/einheiten.ts (organisation-data.ts mit KEMARIS und deinem vollen Namen).

### Empfehlung in Paketen

| Paket | Inhalt | Aufwand |
|---|---|---|
| **1 Sofort raus** | finanz-dashboard.html aus public/ und dem Repo entfernen (Altbestand ist eingefroren); WillkommenMalin entfernen oder als einmalige Nachricht in die Daten legen; tote Dateien löschen (zurufe-data.ts, Datenteil von os-data.ts); Meta-Beschreibung und Manifest neutral; 6 Kommentare mit Diagnose umschreiben; prototype/ aus dem Repo | S |
| **2 Gesundheit entpersonalisieren** | Schild, Energie-Text und Abendfragen nur noch aus eigenen Einstellungen der Person; Tagebuch und Verzichts-Serie als optionale Module je Person (Standard aus); Bausteine und Ernährungs-Start leer; Behandlungs-Stichworte allgemein; den Körpersatz sofort aus dem ZOE-Grundauftrag nehmen | M |
| **3 ZOE- und Agenten-Prompts auf ein Instanz-Profil umstellen** | Firma, Produkt, Zielgruppe, Stimme, Anrede je Person und Lebensauftrag als pflegbare Daten (Nordstern aus Planung › Jahr, wie im Fragebogen). Namen aus den Konten statt `person==='malin'?…:'Kevin'`. Gilt für etwa 25 Routen und Dateien | L (die reine Korrektur der Namen ist S) |
| **4 Rückfälle nach außen** | Datenschutz-Rückfall auf „Verantwortlicher fehlt“ statt MAKE; Domain-Rückfall in Gmail; Team-Rückfall nur aus Konten mit neutralen Rollen; RITUALE aus dem Familie-Bestand | M |
| **5 Feste kevin/malin-Logik neutralisieren** | Kalendermodell (Wer = Konten + „gemeinsam“), Vault- und Brain-Sicht, Aufgaben- und Finanz-Auswahlen, Onboarding-Spuren, Bauplan „wartet auf Kevin“, `speicherFuer`-Sonderfall des Erstkontos (braucht eine Migration der Bestände ohne Suffix), `personAus`-Rückfall | L |
| **6 Firmen nur noch über lib/einheiten.ts bzw. das Register** | organisation-data.ts ablösen, `kemaris` als Register-Gesellschaft `g-…`, Kalender-Namenserkennung nur über Einstellungen, Meeting-Projekte und Stichworte aus Daten | M |
| **7 Finanzkern** | Feldnamen auf Gehalt 1/2 und Partnerdarlehen umbenennen, Szenario-Bausteine generisch, mit Lesen der alten Felder und `KERN_STAND`. Braucht dein Wort wegen der Kern-Regel | L |
| **8 Wächter und Historie** | Wächtertest erweitern (keine Vornamen, Firmen oder Diagnosewörter in Prompts, public/ und Standards). Vor jeder Weitergabe an Dritte frisches Repo oder bereinigte Git-Historie, denn alles oben steckt auch in alten Commits | S + M |

---

## Teil 2 – technisch

Risiko: **hoch** = sichtbar für andere Konten, für die KI, für eine Kundeninstanz oder für Dritte; **mittel**; **niedrig**. Sensible Inhalte sind nur umschrieben.

### A. Echte Daten, private Texte, öffentlich Sichtbares

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| public/finanz-dashboard.html:3286-3303 | Finanzen/Dritte | etwa 35 echte Kontobewegungen (Entnahmen, Zahlung eines namentlich genannten Kunden, Händler, Bankname) | hoch | Datei aus public/ und Repo löschen; FinanzDashboardView.tsx und seiten.ts:50 abbauen |
| public/finanz-dashboard.html:1269-1271 | Finanzen/Dritte | 3 echte Eingangsrechnungen (Lieferant, Rechnungsnummer, Betrag) | hoch | wie oben |
| public/finanz-dashboard.html:1240 | Dritte | vorausgefüllter Notarkontakt mit Telefonnummer | hoch | wie oben |
| public/finanz-dashboard.html:201-246, 618-624, 1183-1228 | Namen/Firma | Personen, Gründungsname, Beteiligung, Hinweise auf Banken | hoch | wie oben |
| public/finanz-dashboard.html:127-128 | Technik | lädt fremde Skripte ohne CSP (next.config.mjs:16,48) | mittel | geht mit der Datei weg |
| components/os/WillkommenMalin.tsx:57-118; app/os/layout.tsx:13,58 | privater Text | persönlicher Liebesgruß, gilt für den Speichernamen „malin“ in jeder Instanz | hoch | entfernen oder als Nachricht im Haushaltsbestand |
| app/layout.tsx:25 | öffentlich | Meta-Beschreibung mit beiden Vornamen, wird von /anmelden und /buchen/* geerbt | hoch | neutral bzw. aus der Instanz-Einstellung |
| public/manifest.webmanifest:4 | öffentlich | Beschreibung mit Vornamen, von der Middleware ausgenommen | hoch | neutral |
| lib/crm/netzwerken-recht.ts:34-35, 41 | Adresse/Verantwortlicher | ohne Einrichtung MAKE-Mail, MAKE-Seite und `UG_NAME` als Verantwortlicher, landet in Danke-Mail-Entwürfen | hoch | Rückfall `VERANTWORTLICHER_FEHLT` + Hinweis, keine MAKE-Werte |
| lib/gmail/mime.ts:331 | Domain | Rückfall-Domain MAKE für die Message-ID | niedrig | Domain des Postfachs bzw. der Instanz |
| lib/make-one/zurufe-data.ts:1-80 | privat/Gesundheit (tot) | Liebeszeilen und ein Gesundheitszuruf zu einer Person, nirgends importiert | mittel | Datei löschen |
| lib/make-one/os-data.ts:28-68 | privat (tot) | Fokus aus einer echten Mail, Selbsteinschätzungen (MSI, Lebensrad), unbenutzt | niedrig | Datenteil löschen, THEME behalten |
| prototype/*.html | alle | Klickdummys mit Namen, Firmen, Gesundheit und Beträgen (make-os.html stark) | mittel | aus dem Repo nehmen |
| (Git-Historie) | alle | alle Funde stecken auch in alten Commits | hoch bei Weitergabe | vor Weitergabe frisches Repo bzw. bereinigte Historie |

### B. KI-Prompts mit Privatem, Personen, Zielen und Firmen

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/brain.ts:453-465 (eingebunden :491, 6 Routen) | Gesundheit/privat | Grundauftrag: Lebenspläne, Beziehung, Körperbeschwerde einer Person, Vornamen | hoch | Körpersatz sofort raus; Auftrag aus dem Instanz-Profil |
| lib/brain.ts:420, 135 | Person | Körperblock nennt Nicht-Malin „Kevin“; `gatherBrain`-Standard 'kevin' | mittel | Name aus dem Konto; Person Pflicht |
| app/api/kimmi/route.ts:71-81 | Person/privat | Familien-KI, Lebenspläne, Anrede und Räume nur für Kevin/Malin, sonst KEVIN | hoch | Instanz-Profil; Räume und Anrede aus den Konten |
| app/api/kimmi/route.ts:62, 86, 96-101 | Firma | Gründer-, Holding- und Produktgeschichte samt Altnamen, Sprachregeln der Beteiligung, CRM-Anbieter, Paar-Marke | hoch | Firmen aus dem Register, Sprachregeln als Brain-Regel (Daten) |
| app/api/kimmi/route.ts:188, 197, 415, 458, 466, 657 | Person/Firma | Werkzeug-Schemas mit festem enum kevin/malin bzw. `kemaris`, „Standard Kevin“ | mittel | enum zur Laufzeit aus Konten und Register |
| app/api/kimmi/route.ts:545-549 | Gesundheit | Werkzeug eines krankheitsbezogenen Tagebuchs, jeder Person angeboten | mittel | nur bei eingeschaltetem Modul; neutrale Beschreibung |
| app/api/zoe/empfang/route.ts:43-44, 59, 96 | Person | Nicht-Malin = Kevin mit fester Anrede | hoch | Name aus `namenVon`, Anrede als Profileinstellung |
| app/api/zoe/morgen/route.ts:81, 96, 117 | Person | wie oben | hoch | wie oben |
| app/api/tageslauf/route.ts:157, 230-231 | Firma/Person/Ziel | Produkt, Holding, Region, feste Anrede, Lebensziel, Nordstern | hoch | Instanz-Profil |
| app/api/board/route.ts:85; app/api/controlling/analyse/route.ts:45; app/api/okr/route.ts:2,49,61; app/api/loop/route.ts:110,161,251,277; app/api/performance/route.ts:114; app/api/fokus/route.ts:48; app/api/research/route.ts:20; lib/finanzen/chef/prompt.ts:31 | Ziele | festes Umsatz- und Gewinnziel bzw. persönliches Lebensziel | hoch | aus Planung › Jahr bzw. den Controlling-Zielen; ohne Ziel weglassen |
| lib/make-one/finance-data.ts:19-24 | Ziele | Startwert des Controllings = eure Zielzahlen | hoch | Startwert 0 |
| lib/finanzen/chef/prompt.ts:22-32, 156 | Person/Bank | Personen, Hausbank, Firmen, alter Export | hoch | Instanz-Daten |
| app/api/outreach/route.ts:42-45, 73; lib/ansprache.ts:32-35, 57-58, 70 | Firma (nach außen) | Erstansprache im Namen von Kevin für ein altes Produkt, Betreff fest | hoch | Absender aus dem Konto, Produkt aus dem Produktkatalog |
| app/api/prospecting/score/route.ts:33; lib/make-one/prospecting-data.ts:28-36 | Firma | Kundenprofil eines alten Produkts als Standard | mittel | leerer Standard, Profil aus Daten |
| app/api/content/route.ts:2, 22-27 | Firma | Sprachregeln und Zielkunde der Beteiligung bzw. des alten Produkts | mittel | Stimme und CI als Einstellung |
| lib/heads/prompt.ts:40, 73, 77, 112, 125, 127, 132, 136, 152 | Person/Firma | Stimme, Zielgruppe und Zuständigkeiten von Kevin/Malin, Firmenliste | hoch | Instanz-Profil + Team-Bestand |
| app/api/beleg/route.ts:44-47 | Firma | feste Liste der eigenen Firmen inkl. Beteiligung | mittel | `registerEinheitenNamen` |
| app/api/meeting/route.ts:22-26, 44-50, 63 | Firma/Person | feste Projekte (Beteiligung, altes Produkt, alter Holdingname, Paar-Marke), Standard-Owner kevin | mittel | Projekte aus den Aufgaben, Owner aus den Konten |
| app/api/delegation/route.ts:66, 79, 81-93 | Person | schließt „malin“ aus, Paar-Projekte nur an „malin“, Prompt über Kevins Entlastung | mittel | Rollen aus dem Team-Bestand |
| app/api/loop/route.ts:109, 160, 207-241, 292; app/api/performance/route.ts:112-116; app/api/research/route.ts:19; app/api/fokus/route.ts:41; lib/zoe/agenten.ts:52-53, 241-435; lib/zoe/ausfuehren.ts:83; lib/zoe/werkzeuge.ts:86, 678, 956, 1002; lib/zoe/brain-chat.ts:53; lib/brain/konsolidierung.ts:93; lib/zoe/selbstbild.ts:33-98; app/api/crm/kontakt-frage/route.ts:74; app/api/crm/visitenkarte/route.ts:33; app/api/loop/verbesserung/route.ts:80-109 | Namen | „Kevins MAKE OS“, Vornamen in Prompts und Meldungen | mittel | „Inhaber“ bzw. Name aus dem Konto |

### C. Gesundheit

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/risk.ts:106-109 | Gesundheit | tägliches Schild zu einer Körperbeschwerde, für alle Konten | hoch | nur aus eigener Routine bzw. Einstellung, nur für die Person |
| components/os/EnergieView.tsx:106 | Gesundheit | nennt den Befund einer Person im Klartext | hoch | neutraler Text bzw. aus dem Profil |
| lib/gesundheit/takt.ts:88, 91 | Gesundheit | Abendfragen zu einem Krankheitsbild an jede Person (Bote) | hoch | nur Fragen zu Modulen, die die Person führt |
| lib/gesundheit/lauf.ts:34-35 | Person/Gesundheit | Verzichts-Serie fürs Erstkonto immer aktiv | mittel | wie bei allen: nur wenn geführt |
| components/os/JournalView.tsx:23, 54-56, 160; components/os/GesundheitView.tsx:29; app/api/state/journal/route.ts:25-27 | Gesundheit | Journal-Schalter mit konkretem Genussmittel bzw. Körperstelle | mittel | Merkmale je Person, Standard neutral |
| lib/gesundheit/index.ts:56-71, 108-109, 186-263; lib/gesundheit/eintraege.ts; app/api/state/haut/route.ts; Streak-Route | Gesundheit | zwei krankheitsbezogene Module mit Index-Kennzahlen in jeder Instanz; Muster mit konkreten Behandlungsarten | mittel | optionale Module je Person (Standard aus); allgemeine Muster |
| components/os/kalender/Planen.tsx:37; components/os/TagesplanView.tsx:51, 59, 168; lib/kalender/einstellungen.ts:59; lib/planung/bloecke.ts:86-89 | Gesundheit/Person | Standard-Baustein zu einer Körperstelle; Baustein „Termin mit Malin“ | mittel | Bausteine aus den Routinen bzw. Einstellungen der Person |
| app/api/state/ernaehrung/route.ts:29-36 | Gesundheit | Ernährungs-Startgrundsätze jeder Instanz aus dem Profil einer Person; der Kommentar nennt eine Diagnose | mittel | leer starten, Kommentar neutral |
| components/os/EnergieView.tsx:21; lib/make-one/stichworte-data.ts:146-147; lib/make-one/umsetzung-data.ts:44 | Gesundheit | Muster mit konkreten Behandlungsarten | niedrig | allgemein halten |
| components/os/RitualView.tsx:203, 261 | Gesundheit | Hinweis bzw. Platzhalter mit Körperstelle | niedrig | neutral |
| app/api/state/haut/route.ts:2; lib/gesundheit/eintraege.ts:6-7; lib/risk.ts:106; app/api/state/ernaehrung/route.ts:29; app/api/state/journal/route.ts:27; lib/performance.ts:118 | Gesundheit (Kommentar) | Kommentare mit Diagnose oder Substanz | mittel (Repo an Dritte) | neutral umschreiben |
| components/os/DatenbasisView.tsx:84, 90 | Person/Gesundheit | Körperwerte und Journal fest einer Person zugeordnet | mittel | Rollen statt Namen |

### D. Team, Rituale, Onboarding, Anrede

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/make-one/team-data.ts:20-44; lib/make-one/team-speicher.ts:42, 55, 60, 67; lib/make-one/team-typen.ts:111, 128-138 | Person/Team | bei leerem Bestand bzw. ohne Haushalt euer Team inkl. vollem Namen und Partnerrollen (mit Gesundheitsrolle) in Prompts und Delegation; Konten namens Kevin/Malin erben Rollen; Inhaber über den Namen erkannt | hoch | Rückfall nur Konten mit neutralen Rollen; eure Rollen einmal in `team--<haushalt>` übernehmen |
| lib/make-one/team-data.ts:49-53; lib/performance.ts:12, 240-256 | privat | feste Paar-Rituale mit Uhrzeit + Check-In der Beteiligung zählen in den Score | mittel | Rituale aus dem Familie-Bestand |
| lib/make-one/onboarding-data.ts:41-47, 196-356; app/os/onboarding/kevin\|malin/page.tsx:3; components/os/OnboardingView.tsx:231-232 | Person | Spuren fest mit euren Namen | mittel | Spuren je Konto |
| components/os/ZoePanel.tsx:150; components/os/ZoeStart.tsx:136 | Person | feste Anrede in der Oberfläche für jede Person | mittel | aus dem Profil |
| lib/crm/team.ts:47-50 | Person | CRM-Team-Standard Kevin/Malin mit Zuständigkeiten (Variable vorhanden) | mittel | Standard aus den Konten |
| components/os/bauplan/BauplanBoard.tsx:76, 135, 252; KarteDetail.tsx:21; Phasen.tsx:15, 56, 91; lib/bauplan/board.ts:144; lib/make-one/backlog-data.ts:10, 31, 73-107; app/api/state/backlog/route.ts:61 | Person | „wartet auf Kevin“ als feste Blockart | niedrig | „wartet auf Inhaber“, Migration der Kennung |

### E. Feste Personen-Logik (Plattform-Schuld)

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/zoe/vault.ts:138, 144-145, 400-405, 427, 435 | Person/Sicht | nur Speichernamen kevin/malin sehen „intern“; ohne Owner gilt kevin; Agent läuft als kevin. In einer Kundeninstanz sieht die Inhaberin ihre internen Notizen nicht | mittel | Haushalt des Inhabers statt Namen; Owner-Rückfall = Inhaber |
| lib/brain/inbox.ts:62, 71, 129, 132, 169; lib/brain/regeln.ts:24-27, 40-42, 68-69; lib/brain/konsolidierung.ts:115; components/os/wissen/Regeln.tsx:14, 20 | Person | Vertraulichkeit und „gilt für“ fest kevin/malin | mittel | `privat-<speicher>`, Personen aus den Konten |
| lib/zoe/raum.ts:37-38, 56, 115; lib/performance.ts:111, 116, 145 | Person/Speicher | Erstkonto „kevin“ ohne Suffix; Dienstweg ohne Person = kevin | mittel | Suffix für alle + einmalige Migration; Systemlauf ohne Person |
| components/os/kalender/teile.tsx:28, 76; lib/kalender/einstellungen.ts:11, 58, 97, 145; lib/kalender/belegt.ts:7-25; lib/kalender/eingabe.ts:92; lib/kalender/aufgaben.ts:21; lib/kalender/schnell.ts:18; lib/kalender/formular.ts:97; components/os/kalender/Kalender.tsx:224, 282, 376; NeuerTermin.tsx:279; Planen.tsx:52, 75, 90, 100, 121, 237, 272; Zeitraster.tsx:157, 162; MitPlanen.tsx:95; Buchungsseiten.tsx:251 | Person | Kalendermodell nur kevin/malin/beide, Standardnamen „Privat <Name>“ | mittel | Wer = Konten + „gemeinsam“ |
| lib/planung/bloecke-server.ts:44; lib/zoe/kalender-vorschlag.ts:39 | Person | eigener Kalender nur für kevin/malin | mittel | Konten des Haushalts |
| lib/kalender/icloud.ts:396-400; app/api/apple-calendar/route.ts:43-45, 56, 124 | Name | Kalendername mit vollem Namen fest einer Person zugeordnet | mittel | nur Einstellungen |
| lib/kalender/space.ts:3, 10 | Name/Firma | Nachname und Beteiligung als Business-Erkennung | niedrig | aus Einstellungen bzw. Gesellschaften |
| lib/kalender/zoe-sicht-server.ts:35, 61-79 | Firma | leere Kalenderquelle der Beteiligung, Eigentümer kevin | niedrig | entfernen bis zur Anbindung |
| lib/business/messen.ts:551, 557; lib/business/register.ts:129 | Person | Meeting-Last = alles außer „malin“ | mittel | Personen aus den Konten |
| lib/heads/takt.ts:25, 32, 61 | Person | Standardperson kevin | niedrig | Team-Personen |
| app/api/startflaeche/route.ts:69 | Person | feste Indexfelder je Name | mittel | je Speichername |
| lib/steuern/speicher.ts:237; lib/finanzen/haushalt/aufgaben.ts:57; lib/aufgaben/saeubern.ts:147, 207, 254; lib/aufgaben/serie.ts:380; lib/aufgaben/vorlagen.ts:26; lib/aufgaben/struktur.ts:469; components/os/aufgaben/hilfe.ts:28, 93; components/os/aufgaben/VorlagenDialog.tsx:120; app/api/tasks/create/route.ts:74 | Person | Aufgaben ohne Angabe gehen an kevin; Owner-Liste fest | mittel | Inhaber bzw. Konten |
| app/api/finanzchef/route.ts:143; lib/finanzen/chef/pruefer.ts:18, 32; lib/finanzen/chef/prompt.ts:124; components/os/FinanzchefView.tsx:291; lib/finanzen/chef/ist-stand.ts:9, 32-62 | Person | Verantwortliche fest; Haushaltsname und alter Export in der Checkliste | mittel | Personen bzw. Rollen aus dem Haushalt |
| components/os/finanzplan/Monat.tsx:18, 69; Verpflichtungen.tsx:26, 150; Ueberblick.tsx:211, 336, 372; teile.tsx:70; components/os/haushalt/Stammdaten.tsx:105, 127; Schulden.tsx:280; lib/zoe/werkzeuge.ts:600, 821, 1050 | Person | Auswahl Kevin/Malin/Beide fest; Nicht-Malin = „Kevin“ als Verursacher | mittel | Haushaltskonten |
| lib/crm/aktivitaeten.ts:373-374; lib/make-one/crm.ts:474-479, 1367; lib/crm/leads.ts:146; lib/crm/umzug.ts:70; app/api/state/netzwerk/route.ts:38; lib/zoe/crm-werkzeug-defs.ts:26, 46, 82, 97; lib/zoe/crm-vorschlag.ts:267, 406; components/os/crm/Kartei.tsx:250; Runden.tsx:183; Qualifizierung.tsx:251 | Person | CRM-Filter, Schemas und Rückfälle fest | mittel | Laufzeit-Liste aus den Konten |
| lib/make-one/schnell-anlegen.ts:101; components/os/KompassView.tsx:569; components/os/MeetingView.tsx:30 | Person | feste Personenliste in Schnelleingabe und Filtern | niedrig | Konten |
| components/os/WissenView.tsx:403; components/os/crm/Vernetzen.tsx:36, 295; kontakt-teile.tsx:203; SchnellErfassen.tsx:112; NutzungsMelder.tsx:44; flaeche/widgets.tsx:113; components/os/bauplan/gemeinsam.tsx:238, 257 | Person | Browser-Rückfall auf 'kevin' bzw. feste Namen und Farben | niedrig | eigene Person aus /api/konto/ich |
| app/api/state/zoe-verlauf/route.ts:29, 37, 53, 97; lib/make-one/zoe-verlauf.ts:14, 67; app/api/telegram/eingang/route.ts:57-58; components/os/ZoePanel.tsx:119, 126; ZoeStart.tsx:35, 156, 377-383 | Person | Nutzer-Rolle heißt „kevin“; Altbestand ohne Person = kevin | niedrig | Rolle `nutzer` (Lesen versteht beide) |
| app/api/state/arbeitsplatz/route.ts:24-28; app/api/state/bauzeit/route.ts:26; components/os/ZusammenarbeitView.tsx:19, 38 | Person | nur kevin/malin speicherbar; Bauzeit immer „von Kevin“ | niedrig | Person der Sitzung |
| lib/zugang/konten.ts:74 | Person | reservierte Speichernamen kevin/malin in jeder Instanz | niedrig | Instanz-Einstellung |
| lib/planung/wochenplan-uebernahme.ts:30; wochenplan-uebernahme-server.ts:47, 223; scripts/verbindungen-pruefen.mjs:19 | Person | Altname bzw. Standard nur kevin | niedrig | nach der Übernahme entfernen |

### F. Firmen außerhalb von lib/einheiten.ts

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/make-one/organisation-data.ts:17-49 (genutzt von lib/aufgaben/struktur.ts:18, lib/brain.ts:29, lib/make-one/space-regeln.ts:7, components/os/KompassView.tsx:22) | Firma | zweite Firmenliste mit Beteiligung und vollem Namen samt Erkennungsmustern | mittel | auf `lib/einheiten.ts` + Register umstellen |
| lib/finanzen/haushalt/entflechtung.ts:20-26; app/api/state/liquiplan/route.ts:51; app/api/state/ordnung/route.ts:18, 24; lib/zoe/werkzeuge.ts:557; app/api/haushalt/pruefliste/route.ts:61 | Firma | Kennung `kemaris` als feste Zuordnung | mittel | Register-Gesellschaft `g-…` |
| lib/finanzen/finanzplan-bestand.ts:135 | Name | Rückfallname des Einzelunternehmens mit vollem Namen | mittel | `KERN_EINHEITEN`-Label |
| lib/make-one/stichworte-data.ts:51, 110-113, 165 | Firma/privat | Produkt- und Beteiligungs-Stichworte, auf eine private Rechtsangelegenheit zugeschnittenes Muster, Name des Haustiers | niedrig | in eigene Stichworte (Daten) verschieben |
| lib/make-one/fokus-data.ts:14; lib/make-one/ordnung-data.ts:40, 61; lib/make-one/agents-data.ts:46-150; components/os/MeetingView.tsx:28; components/os/ResearchView.tsx:17; components/os/TagesplanView.tsx:169; components/os/flaeche/widgets.tsx:656; lib/zoe/vault.ts:154 | Firma | alte Produkt- und Projektkennungen und Beteiligung in Vorgaben und Texten | niedrig | neutralisieren |
| app/api/kemaris-calendar/route.ts; lib/brain.ts:88-95, 189-193, 238, 361; app/api/kalender/analyse/route.ts:101 | Firma | Kalenderquelle der Beteiligung (leer) als feste Struktur | niedrig | bis zur Anbindung entfernen |
| lib/einheiten.ts:285-296; scripts/business-auf-null.mjs:25-27 | Name | Erkennung von Altnamen | niedrig | so lassen (erlaubter Ort bzw. Skript der eigenen Instanz) |

### G. Finanzkern und Altbestand

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/finanzen/rechenkern.ts:111, 119, 131-132, 344-353, 377, 427-481, 762, 812, 826-827, 854; lib/finanzen/annahmen-felder.ts:33-34; lib/finanzen/handwerte.ts:73, 88; lib/finanzen/plan/operationen.ts:435; lib/finanzen/plan/sicht.ts:87; components/os/finanzplan/{Gesamt,Geschaeft,Auswerten,Planen,Ueberblick,Verpflichtungen}.tsx | Dritte/Finanzen | Feldfamilie und sichtbare Zahlungszeile mit dem Vornamen eines Darlehensgebers | mittel | in Partnerdarlehen umbenennen, alte Felder weiter lesen, `KERN_STAND` hochzählen. Braucht dein Wort |
| lib/finanzen/rechenkern.ts:476; lib/finanzen/plan/operationen.ts:313; components/os/finanzplan/Gesamt.tsx:79-155; Geschaeft.tsx:163, 245; Planen.tsx:53-54; Baukasten.tsx:136, 253-276; Auswerten.tsx:88, 108 | Person/Finanzen | Gehälter als `kevinBrutto`/`malinBrutto`, `darlehenKevin` | mittel | Gehalt 1/2 (die Anzeige nutzt schon `personName`) |
| components/os/finanzplan/Planen.tsx:377, 381-382; Auswerten.tsx:106; lib/finanzen/plan/operationen.ts:439; scripts/liquiplan-aus-excel.py:98-113 | Firma | Szenario-Bausteine mit Produkt- und Beteiligungsnamen | mittel | generische Bausteine mit pflegbarem Namen |
| lib/finanzen/rechenkern.ts:401 | Dritte (Kommentar) | Vorname des Steuerberaters | niedrig | neutral |
| lib/finanzen/haushalt/einordnung.ts:20; kategorien.ts:22; gesamt.ts:22; testdaten.ts:12, 49 | Person | Kategorie „Entnahme <Name>“ | niedrig | neutraler Name + Alias beim Lesen |
| components/os/GrundlageView.tsx:95-97, 113, 182, 206-209; components/os/FinanzenView.tsx:151; components/os/ZahlenView.tsx:124-126; components/os/haushalt/*; app/api/haushalt/umzug/route.ts:46-66; lib/finanzen/haushalt/{datei,supabase}-umzug.ts | Person | Altbestand bzw. Umzug „aus Malins Cockpit“, Personen in Feldnamen, Lieferant genannt | niedrig | nach Abschluss entfernen bzw. „Altsystem“ |
| lib/finanzen/chef/prompt.ts:30; app/api/kimmi/route.ts:270 | Bank | Hausbank des Haushalts im Prompt | niedrig | aus den Konten |

### H. Sonstiges

| Datei:Zeile | Kategorie | Befund (neutral) | Risiko | Vorschlag |
|---|---|---|---|---|
| lib/zoe/vault.ts:41 | Pfad | iCloud-Ordner mit privatem Ordnernamen fest im Code | niedrig | `MAKE_VAULT_DIR` bzw. Einstellung |
| app/api/crm/import/route.ts:75; components/os/crm/stammdaten/Austausch.tsx:138 | Pfad | Ordner auf dem Mac-Schreibtisch fest | niedrig | Upload statt Ordner |
| lib/crm/datenschutz.ts:255-429 | Namen | Verarbeitungsverzeichnis nennt Vornamen als Empfänger | mittel (Export an Behörde oder Kunde) | „Konten des Haushalts“ |
| lib/crm/speicher-register.ts:221-370; lib/steuern/rechnen.ts:157; lib/mac.ts:16; lib/finanzen/haushalt/speicher.ts:275; lib/finanzen/haushalt/zoe.ts:21, 31 | Namen | Gründe, Fristen und Meldungen mit Vornamen | niedrig | neutral |
| components/os/KontoView.tsx:170; TeamKarte.tsx:127; FinanzplanungView.tsx:191; finanzplan/Einrichtung.tsx:41; finanzplan/Planen.tsx:98; haushalt/GesamtView.tsx:45-59; crm/Ueberblick.tsx:119; crm/stammdaten/Verweise.tsx:47; crm/marketing/Newsletter.tsx:170; kalender/EinstellungenBelegt.tsx:46; kalender/Buchungsseiten.tsx:149; bauplan/Planung.tsx:73, 81; KompassView.tsx:526; ErnaehrungView.tsx:543; business/Abschluss.tsx:175 | Namen | Hinweise und Platzhalter mit Vornamen | niedrig | neutral |
| scripts/website-logo.mjs:297, 327 | Namen | Erklärtext des Logos nennt euch | niedrig | so lassen oder neutral |
| (etwa 1.370 Kommentarzeilen, über 600 Dateien) | Namen | Entscheidungs-Historie mit Vornamen | niedrig | beim Anfassen; Wächter gegen neue Fälle in Prompts, Standards und public/ |