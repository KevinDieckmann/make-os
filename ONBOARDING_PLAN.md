# Einrichtung: Onboarding-Konzept und Lückenliste (überarbeitet)

> Stand 08.10.2026 spät. Entstanden aus vier Erkundern (Onboarding-Inventar, Zahlen & Daten, Verbindungen, Alltag als Business Couple), einer Synthese und
> einer Vollständigkeits-Kritik (nur lesend). Richtungsfragen R1–R10 gehen als Klickrunde an Kevin; Antworten → ENTSCHEIDUNGEN_FRAGEBOGEN.md.


Stand 08.10.2026 abends. Ich habe nur gelesen, nichts geändert. Grundlage: `MODUL_LANDKARTE.md`, `ROADMAP_Q4.md`, `ENTSCHEIDUNGEN_FRAGEBOGEN.md`, `BAUSTAND.md`, `UPLOAD_0810.md` sowie Stichproben im Code und in den Branches `privat-raus-koerper` und `finanzplan-blaetter`.

## Kurzfassung

- **Heute:**
  - Das Onboarding hat 32 Schritte in drei festen Spuren (Fundament, „kevin“, „malin“). Der Server prüft 18 Schlüssel an 22 Schritten.
  - Von den Zahlen kommen nur Kontostände, offene Zahlungen und das Controlling-Ziel vor.
  - Die Prüfung „Kontakte“ liest `netzwerk` statt der Kartei.
  - Die Prüfung „Ziele“ hält das übernommene Code-Ziel (1 Mio) für gesetzt.
  - Häkchen gelten für den ganzen Haushalt, und die Route speichert Vornamen und kürzt still.
  - Auf Heute gibt es keinen Einstieg; online läuft noch die alte Mac-Fassung.
- **Vorschlag:**
  - Neun Etappen (0–8) mit 75 Schritten, davon 13 optional.
  - Drei Ebenen statt Namen: **Instanz**, **Gemeinsam**, **Meine Einrichtung**.
  - Der Server prüft je Person und nach Rechten und liefert nur ja/nein oder Zähler.
  - Jede Zahl hat genau einen Eingabeort (Datenkarte A3).
- **Aufwand:**
  - Kevin ≈ 25–26 h, Malin ≈ 11–12 h, verteilt auf Fr 09.10. bis Fr 16.10.
  - Dazu zwei eigene Termine (Mail-Umzug, WhatsApp) mit zusammen ≈ 3 h.
- **Wichtigste Funde:**
  1. Der Stichtag des 0-Punkts archiviert alles davor, auch Monatsabschlüsse vor dem Stichtag-Monat.
  2. Ein Stichtag vor dem Planbeginn setzt den alten Anfangsbestand als Kontostand für Okt 26 in der Finanzplanung.
  3. Die Übernahme der Körper-Inhalte braucht vorher die Einwilligung (a) des Inhabers und muss vor dem Update am 16.10. durchlaufen.
- **Bis Freitag realistisch:** das „Freitag-Paket“ B0 (inhaltlich vollständig in der bestehenden Struktur, siehe A5).
  - Mit Update 2 (16.10.): Ebenen mit Rechten, geführter Ablauf, Datenstand.
  - Mit den Updates am 23. und 30.10.: Daten-Assistenten.
  - Vor dem Onboarding außerdem nötig: L2 (Körper gebaut, Nordstern in Arbeit) und L12 (Tageslauf ohne Trennung je Person, online offen).

---

# TEIL A — Onboarding-Konzept „Einrichtung“

## A1 Grundsätze (gelten auch für den späteren Einrichtungs-Assistenten für Kunden)

1. **Drei Ebenen statt Namen, gebildet aus den Konten.**
   - **Instanz:** nur der Inhaber, teils am Server. Alle anderen sehen nur „Instanz eingerichtet: ja/nein“.
   - **Gemeinsam:** Haushalt und Firmen. Eine Person trägt ein, alle Berechtigten sehen den Stand.
   - **Meine Einrichtung:** jede Person für sich; geprüft wird nur die Person der Sitzung.
2. **Der Server prüft, Häkchen nur für Unmessbares.** Persönliche Häkchen liegen je Person, gespeichert mit dem Speichernamen, nie dem Vornamen.
3. **Prüfungen liefern nur ja/nein oder Zähler.** Nie Werte, Adressen oder Gesundheitsinhalte.
4. **Befunde nach Rechten filtern, auch in „Gemeinsam“.**
   - Haushaltsfinanzen nur mit `privatFinanzZugang`, Familie und Ernährung nur im Haushalt.
   - Ein Konto mit `finanzRecht: 'business'` bekommt keine Privat-Befunde. Wächter „Sicht X bekommt nichts aus Y“.
5. **„Verbunden UND gesund“:** Ein Zustand „getrennt“ oder „anmeldung“ zählt nicht. So bleibt das Onboarding danach die dauerhafte Einrichtungs-Ampel.
6. **Jede Zahl hat genau einen Eingabeort** (A3). Wo es heute zwei gibt, nennt das Onboarding den führenden und warnt vor dem anderen.
7. **Jeder Schritt erklärt sich:** warum, was passiert, was danach anders ist, wo, wie geprüft.
8. **Nichts geht ohne Klick nach außen.** Server-Schritte zeigen nur den Befehl, nie einen Wert.
9. **Läuft auch mit einer Person** (Solopreneur). Schritte, die zwei Konten brauchen, entfallen dann.
10. **Modul-fähig und demo-fähig.**
    - Jeder Schritt trägt sein Modul (eine Instanz „nur Markttraktion“ zeigt nur ihre Schritte).
    - Das Onboarding ist mit erfundenen Daten vorführbar.
    - Eine leere Instanz startet sauber.

## A2 Ablauf

Legende:
- **Wer:** S = am Server (Inhaber) · I = Inhaber in der App · P = jede Person für sich · G = gemeinsam.
- **Prüfung:** „vorhanden“ = gibt es · „neu“ = bauen · „umbauen“ = prüft falsch · „Haken“ = von Hand. (opt) = optional.

### Etappe 0 — Am Upload-Tag und direkt danach (Server, ≈ 3½ h; 0.7 frühestens am Tag nach 0.6)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 0.1 | **Update einspielen.** Vorher Sicherung am Server, dann `entwicklung` → `main`, danach Caddy prüfen und neu laden. | S | `UPLOAD_0810.md` §0–1 | Bau-Kennung im Head of IT | 25 | – |
| 0.2 | **Pepper und strenger Start-Riegel.** Fingerabdrücke gesperrter oder gelöschter Personen sind danach nicht mehr zu erraten. Ohne Geheimnis startet die App nicht. Den Pepper nie wechseln. | S | `.env` (§2) | vorhanden: Befunde „pepper“, „start-riegel“ | 10 | 0.1 |
| 0.3 | **Zulieferer-Schlüssel** (entschieden, 3/10). Mac, dann Server; „aufräumen“ erst nach stabilen Tagen. | S | §3, `deploy/zulieferer-schluessel.sh` | vorhanden: Befund „zulieferer“ | 15 | 0.1 |
| 0.4 | **Einwilligung (a) des Inhabers** für Gesundheitsdaten, **vor 0.5**. Sonst überspringt die Übernahme die Körper-Inhalte. | P (Inhaber) | `/os/datenschutz#gesundheit` | vorhanden: `gesundheit-einwilligung` | 5 | 0.1 |
| 0.5 | **Altbestand übernehmen.** Bisherige Inhalte aus dem Code wandern einmal in die Daten des Inhabers. <br>• Ablauf: `MAKE_OS_ALTBESTAND_PERSON=<Speichername>` setzen, `docker compose up -d`, Log „uebernommen“ prüfen. <br>• Erst danach eigene Körper-Inhalte anlegen. <br>• **Muss vor dem Update am 16.10. erledigt sein.** <br>• Nur, was im Upload steckt: Körper sicher, Nordstern nur, wenn fertig. | S | `.env`; `UPDATES.md` (Branch `privat-raus-koerper`) › Offene Einmal-Schritte | neu: „Körper-Profil des Inhabers vorhanden“ (ja/nein) | 15 | 0.4, L2 |
| 0.6 | **Sicherung mit age und Wächter.** Den privaten Schlüssel habt nur ihr. Fällt die Sicherung aus, schlägt Healthchecks Alarm. | S | `deploy/server-einrichten.sh:83-85`, `/srv/make-os/.healthchecks-sicherung` | vorhanden: „sicherung-geprueft“, „sicherung-ping“ (grau bis zur nächsten Nacht) | 25 | 0.1 |
| 0.7 | **Zweite Kopie am Mac und Wiederherstellungsprobe.** Frühestens nach der nächsten Nachtsicherung (03:15); vorher gibt es kein age-Archiv. Die Probe baut lokal, also nicht parallel zu Tests. | S | `RESTORE_TEST.md` §3, `deploy/sicherung-abholen.sh`, `deploy/sicherung-probe.sh --app` | vorhanden: „abholung“; Probe: Haken mit Datum (Ergebnis in `DEPLOY.md`) | 45 | 0.6 + 1 Nacht |
| 0.8 | **Vault-Umzug, Abgleich, `_App`-Spiegel an.** Der erste Spiegel-Lauf kommt nachts; einen „Jetzt“-Knopf gibt es nicht. | S | `VAULT_UMZUG_ANLEITUNG.md`, §5–6 | vorhanden: „vault“ (nur Server-Seite, siehe L23) | 30 | 0.1 |
| 0.9 | **Adresse prüfen.** `MAKE_OS_ADRESSE` ist genau die Adresse, unter der ihr arbeitet (https). Daraus entstehen Rückruf-Adressen, Einladungslinks und Cookies. | S | `.env`, `deploy/env.server.beispiel:35-37` | neu: gesetzt und https (ja/nein) | 5 | 0.1 |
| 0.10 | **WHOOP-Anwendung (v2)** einmal je Instanz: Redirect `…/api/whoop/rueckruf`, Webhook `…/api/whoop/webhook`. | S | developer.whoop.com, `deploy/whoop-verbinden.sh` | neu: `whoopKonfiguriert()` | 15 | 0.9 |
| 0.11 | **Google prüfen und Gmail freischalten.** Gmail-API, Bereich `gmail.modify`, Lizenz für die zweite Person, Datenverarbeitungszusatz. Redirect genau `MAKE_OS_ADRESSE` + `/api/google/rueckruf`. | S | `GOOGLE_GMAIL_EINRICHTEN.md` Teil A, `deploy/google-verbinden.sh` | neu: `googleKonfiguriert()`; die Gmail-Freigabe zeigt sich bei der ersten Verbindung | 25 | 0.9 |
| 0.12 | **Notfallmappe.** Beide wissen, wo Pepper, age-Schlüssel, Datenschlüssel, Server-Zugang und Wiederherstellungs-Codes liegen. Papier an sicherem Ort, keine Werte in MAKE OS. | I + G | `NOTFALL.md`, §2 | Haken | 20 | 0.2, 0.6, R9 |

*Danach, nicht Teil des Onboardings:* alte Server-Bilder löschen, Format v2 und starke Passwort-Härtung nach stabilen Tagen (`UPLOAD_0810.md` §7–8).

### Etappe 1 — Zugang, Sicherheit, Datenschutz (Inhaber ≈ 1 h, je Person ≈ 30 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 1.1 | **Eigener zweiter Faktor**; Wiederherstellungs-Codes in den Passwort-Manager. | P | `/os/konto` | vorhanden: `zwei-faktor` | 5 | – |
| 1.2 | **Zweite Person.** Konto prüfen, sonst einladen (48 h, einmalig). Bei euch gibt es das Konto schon. Bei einer Person entfällt der Schritt. | I | Konto › Einladen | neu: Konten ≥ 2 | 5 | 0.1 |
| 1.3 | **Haushalt und Finanzrecht.** Ohne Haushalt keine Privat-Finanzen, Familie, Ernährung. „Nur Business“ sperrt Privates auf dem Server. | I | Konto › Haushalt | neu: alle Konten im Haushalt, Finanzrecht bewusst | 5 | 1.2 |
| 1.4 | **2FA-Pflicht.** Vorher zeigt der Head-of-IT-Befund „n von m ohne“. | I | Konto › Zugang der Instanz | vorhanden: `zwei-faktor-pflicht` + Befund `zwei-faktor` | 2 | 1.1 |
| 1.5 | **Datenschutz der Instanz.** <br>• Verantwortlichen festlegen (R10). <br>• Empfänger auf Stand: Hetzner, Google, Anthropic mit AVV-Datum; Microsoft 365, Telegram, Newsletter archivieren; IONOS, iCloud-Mail, Healthchecks, GitHub „in Gebrauch“; WHOOP-Garantie prüfen; WhatsApp erst bei Einrichtung zurückholen. <br>• Eine schon gespeicherte Liste kennt neue Startwerte nicht: von Hand ergänzen. <br>• Art.-14-Vorlage prüfen (vor 4.2). <br>• Löschfristen ansehen. | I | `/os/datenschutz`, Stammdaten › Datenschutz | neu: Selbstprüfung „verantwortlicher“ und „avv“ erfüllt | 35 | – |
| 1.6 | **KI der Instanz:** Schlüssel und Guthaben, Hintergrund-KI, Web-Suche, Bereiche. Ohne Schlüssel fallen ZOE und die Heads still auf das Regelwerk zurück. | I | `/os/hoi`, Datenschutz (KI) | vorhanden: Befund „ki“; neu: Instanz-Eintrag festgeschrieben | 10 | 1.5 |
| 1.7 | **Wer sieht was, und was ich teile.** <br>• Gemeinsam: Aufgaben, Kontakte, Finanzen je nach Recht, gemeinsame Kalender. <br>• Nur für mich: Notizen, „nur ich“, private Termine (die andere Person sieht „Belegt“), Routinen, Postfächer, Agenten-Log, Körper. <br>• „Gesundheit teilen“ und „Eigene Ziele teilen“ entscheide ich selbst. <br>• Der Partner darf in nicht-private Kalender schreiben wie eine Assistenz. | P | Konto | Haken je Person | 10 | 1.3 |
| 1.8 | **Gesundheit: Einwilligung (a)(b)(c)** der zweiten Person. Der Inhaber hat (a) schon in 0.4 gegeben. | P | `/os/datenschutz#gesundheit` | (a) vorhanden; (b)(c) Haken | 5 | – |
| 1.9 | **Eigene KI-Schalter** (nur einschränken). | P | Datenschutz (KI) | neu: Eintrag der Person | 5 | 1.6 |
| 1.10 | **Handy:** Homescreen, optional Mikrofon für ZOE-Sprache, weitere Anmelde-Adressen. | P | Safari › Teilen; Konto | Haken | 5 | 1.1 |

### Etappe 2 — Verbindungen (je Person ≈ 40 Min, Inhaber 20 Min, gemeinsam 20 Min, zwei eigene Termine)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 2.1 | **iCloud-Kalender (Privat).** Blöcke landen auf dem eigenen iPhone, die andere Person sieht „Belegt“. Beim Inhaber ersetzt der Eintrag die Server-Umgebung; `ICLOUD_*` danach von Hand aus der `.env` nehmen. | P | `/os/kalender?space=privat` | vorhanden: `icloud`; neu: Zustand ≠ „anmeldung“ | 10 | – |
| 2.2 | **Google-Kalender (Business)**, beide Richtungen. Alte Business-Termine aus iCloud nach Vorschau umziehen (opt). | P | `/os/kalender?space=business` | neu: `googleStatus(person)` Funktion kalender, nicht getrennt | 5 (+15) | 0.11 |
| 2.3 | **Gmail verbinden.** | P | `/os/inbox?postfaecher=1` | vorhanden: `postfach`; neu: Funktion gmail | 5 | 0.11 |
| 2.4 | **Weitere Postfächer und Bereich.** IONOS bis zum Umzug, iCloud-Mail für Privates. Jedes Postfach bekommt einen Bereich, auch Gmail. Danach neue Absender zulassen oder blocken. | P | Inbox › Postfächer | umbauen: jedes Postfach mit Bereich, keins „anmeldung“ | 15 | 2.3 |
| 2.5 | **Kalender zuordnen.** <br>• Kalender je Person und „Gemeinsam“; dorthin spiegeln Paar-Gespräch, Dates, Events. <br>• Privat/Business je Kalender (die Vorgabe-Regel „KEMARIS/Arbeit = Business“ prüfen). <br>• Zählt als belegt, freie Tage, Arbeitsfenster (Vorgabe 7–20), Standarddauern, Kündigungs-Vorlauf. <br>• Gemeinsamen Kalender in Apple teilen. | G | Kalender › Einstellungen | neu: jeder zugeordnete Name existiert im Stand | 20 | 2.1, 2.2 (beide) |
| 2.6 | **Zeit, die woanders belegt ist (Microsoft 365, KEMARIS).** MAKE OS bindet diesen Kalender noch nicht an. Übergang: als feste Blöcke bzw. Abwesenheit in der Wochenvorlage, oder eine Frei/Gebucht-Freigabe in einen verbundenen Kalender (Weg vorher prüfen, Annahme). Sonst gilt diese Zeit als frei. | I | Planung › Routinen bzw. Kalender | Haken | 20 | 2.5 |
| 2.7 | **WHOOP** (opt). Zeigt die Karte „neu verbinden“, neu verbinden (alter Zugang ohne Workouts). | P | `/os/gesundheit#whoop` | neu: `whoopStatus(person)` verbunden | 3 | 0.10, (a) |
| 2.8 | **Mail-Domain umziehen** (eigener Termin). <br>• Reihenfolge: `hello@`-Gruppe, „Senden als“, Testmail, SPF/DKIM/DMARC, **MX zuletzt**. <br>• Alte Mails optional mitnehmen (D4). <br>• IONOS mindestens 4 Wochen weiterlaufen lassen. | I (+P) | `GOOGLE_GMAIL_EINRICHTEN.md` Teil D | Haken (DNS-Prüfung fehlt, L24) | 90 | 2.3 |
| 2.9 | **WhatsApp Business** (eigener Termin; die Verifizierung bei Meta dauert Tage). Erst nach R5. | I/S | `UPDATES.md` 07.10., `deploy/whatsapp-verbinden.sh` | vorhanden: `/api/whatsapp/status`, Befund „whatsapp“ | 90 | 1.5, R5 |
| 2.10 | **Hinweise aufs Handy:** wartet auf L13/L14. Bis dahin kein Telegram-Schritt. | P | – | erst nach dem Bau | – | 2.9 |

### Etappe 3 — Firmen & Zahlen (Inhaber ≈ 3¼ h, gemeinsam ≈ 1½–2¼ h, je Person 45 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 3.1 | **Stichtag festlegen (R2).** <br>• Ab dem Stichtag rechnet jede Business-Gesellschaft neu. <br>• Rechnungen, Zahlungen, Planposten und Buchungen davor sowie Monatsabschlüsse vor dem Stichtag-Monat bleiben sichtbar, zählen aber nicht. <br>• Liegt er vor dem 01.10.26, startet der Finanzplan im Okt 26 mit dem alten Bestand (Handwert nötig, 5.4). | G | Gespräch | sichtbar an den Eröffnungen | 10 | – |
| 3.2 | **Steckbrief je Gesellschaft.** <br>• Rechtsform, Status, Rolle operativ/holding (steuert die Holding-Sicht), Sitz, Gründung, Stammkapital, Geschäftsjahr. <br>• Opt: Gründungs- bzw. Umbenennungsfahrplan per Klick, solange die Eintragung läuft. | I | `/os/unternehmen` | neu: feste Business-Gesellschaften mit Steckbrief, mindestens eine Rolle | 35 | 1.3 |
| 3.3 | **Gesellschafter, Organe, Beschlüsse, Beteiligungen (fremde Firmen), Verträge, Unterlagen.** Verträge mit „kündigen bis“ erzeugen Erinnerung (Vorgabe 30 Tage) und Kalender-Eintrag. | I | `/os/unternehmen` | neu: Nennbeträge = Stammkapital; je Kapitalgesellschaft ein Geschäftsführer-Organ | 50 | 3.2 |
| 3.4 | **Absender für Angebote:** Firmierung, Anschrift, Steuernummer, USt-ID, Register, Geschäftsführung, Bank, Logo, Nummernkürzel. | I | `/os/unternehmen?r=absender` | neu: Pflichtangaben vollständig | 20 | 3.2 |
| 3.5 | **Steuerprofil** im Steuer-Modul und gleich in Finanzplanung › Zahnrad (bis L9 zwei Orte; die GmbH hat im Steuer-Modul keine Fristen). Schalter „Steuertermine im Kalender“ (Vorgabe aus). | I | `/os/finanzen?s=steuern` | neu: gespeichert, nicht Vorgabe | 25 | 3.2 |
| 3.6 | **0-Punkt je Business-Gesellschaft.** <br>• Kontostand am Stichtag plus **alle** dann offenen Forderungen und Verbindlichkeiten, auch Rechnungen aus der Liste mit Datum vor dem Stichtag (die werden archiviert). <br>• Bezahlte Eröffnungs-Posten gehen heute nur über eine neue Fassung raus (L34). | I | `/os/finanzen?s=business#eroeffnung` | neu: `geltendeEroeffnungen` für jede Gesellschaft aus `BUSINESS_GESELLSCHAFTEN` | 30 | 3.1, 3.2 |
| 3.7 | **Monatsabschlüsse** ab dem Stichtag-Monat bis zum Vormonat. Bei Stichtag 01.10. gibt es den ersten im November. Bei 01.01. sind es 9 × 2 Formulare; erst mit der Tabelle aus B9a zumutbar. | G | `…#abschluss` | neu: Vormonat vorhanden, **nur** wenn ≥ Stichtag-Monat | 15–60 | 3.6 |
| 3.8 | **Kontostände, Rechnungen, Zahlungen nach dem Stichtag.** Datum muss nach dem Stichtag liegen, sonst gilt der 0-Punkt. Bezahltes markieren, Zahlungen mit Frist. | G | Liquidität `#kontostaende`; Rechnungen & Zahlungen | umbauen `konten`: nur Business-Gesellschaften, 0-Punkt zählt, ≤ 7 Tage; umbauen `posten`: überfällige gestellte Rechnungen | 30 | 3.6 |
| 3.9 | **Grundlagen des Business-Index:** Köpfe (FTE), verfügbare Beratertage je Monat, Jahresziel je Gesellschaft (gleiche Zahl wie 5.1), bei Bedarf Schwellen. Sonst bleiben Personal und Auslastung „keine Daten“. | I | Business-Cockpit › Feinjustierung | neu: `fte` und `ziele` gesetzt | 15 | 3.2 |
| 3.10 | **Privatkonten und Kontoauszüge.** <br>• Jede Person ihre Konten mit Inhaber, gemeinsame einmal. <br>• Kontrollsumme prüfen; Zeitraum mit R3 festlegen. <br>• Bis zur Bank-Anbindung der monatliche Weg; heute nur N26 erprobt. | P/G | `/os/finanzen?s=konten&space=privat` | neu: jedes Haushaltskonto mit Buchung ≤ 31 Tage | 45 | 1.3 |
| 3.11 | **Fixkosten, Budget, Schulden an einem Ort (R4), dazu das Rücklage-Ziel** des Privat-Index. | G | Privat › Konten & Buchungen; Privat-Index | neu: keine Fixkosten „Rhythmus unklar“, Schulden mit Rate, Rücklage gesetzt | 35 | 3.10 |

### Etappe 4 — Kontakte, Vertrieb & Mandate (Inhaber ≈ 1¾ h, gemeinsam ≈ 1 h 10 Min, je Person opt 25 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 4.1 | **Team und Zuständigkeiten:** Rollen wie Sales, Marketing & Event, Haushaltsfinanzen, Gesundheit begleiten. Die Vertriebs-Zuständigkeit hängt bis L19 an einer Build-Variable. | G | Konto › Team | neu: Rolle je Konto in `team--<haushalt>` | 10 | 1.3 |
| 4.2 | **Kartei importieren und bereinigen.** <br>• Import mit Vorschau, Konflikte, Dubletten und Firmen, Herkunft und Rechtsgrundlage, Kreis A/B. <br>• **„Zuständig“ je wichtigem Kontakt**, sonst landet die Power Hour bei einer Person. <br>• Für Kontakte aus fremden Quellen startet die Art.-14-Uhr (1 Monat). | I | Markttraktion › Zahnrad | umbauen `kontakte`: Kartei statt `netzwerk`; Import-Konflikte = 0; Verbindungsprüfung ohne Fehler | 50 | 1.5 |
| 4.3 | **Produkte:** Preis, Basis, Laufzeit, Gesellschaft, Leistungstext. Die alte Karte „Produkte“ unter Rechnungen nicht mehr pflegen (L11). | G | `/os/mandate?s=produkte` | neu: mindestens ein aktives Produkt ohne `produktAngebotFehlt` | 30 | 3.2 |
| 4.4 | **Laufende Mandate:** Firma, Produkt, Honorar, Rhythmus, Gesellschaft, Zahlungsziel, Zuständigkeit. | I | `/os/mandate` | neu: aktiv mit `firmaId`, Honorar, Gesellschaft ≠ offen | 30 | 4.2, 4.3 |
| 4.5 | **Offene Deals** mit Stufe, Wert und nächstem Schritt mit Datum. | I | `/os/markttraktion?s=deals` | neu: kein offener Deal ohne nächsten Schritt | 20 | 4.2 |
| 4.6 | **Vertriebs-Grundlagen:** Positionierung (Zielgruppe, Nutzen, Ton), Wertelisten (Verlustgründe, Kadenz je Kreis), Wochenziele im Scoreboard je Person; Scoring-Standard lassen oder anpassen. | G | Marketing › Positionierung; Zahnrad; Überblick | neu: Positionierung und Wochenziele gesetzt | 30 | 4.1 |
| 4.7 | **Eigene Visitenkarte** (opt). | P | `/os/netzwerken/karte` | neu: Bestand vorhanden | 10 | – |
| 4.8 | **Buchungsseite für Erstgespräche** (opt). Braucht Verantwortlichen, frischen Kalender und Wochenvorlage. | P | Kalender › Buchungsseiten | neu: aktive Seite | 15 | 1.5, 2.5, 5.7 |

### Etappe 5 — Planung & Finanzplan (gemeinsam ≈ 3 h, Inhaber ≈ 1¼ h, je Person ≈ 50 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 5.1 | **Nordstern und Jahresziele** je Bereich, mit Zahl. Den Nordstern nur, wenn er mit 0.5 übernommen wurde (sonst entsteht eine zweite Fassung neben dem Code). | G | `/os/planung/jahr` | umbauen `ziele`: Jahresziel des laufenden Jahres aus der Planung | 30 | 0.5 |
| 5.2 | **Zahlenziele gleichziehen:** Controlling (Jahresziel, Startmonat, Runway) und Jahresziel je Gesellschaft (3.9) auf die Zahl aus Planung › Jahr, bis L10. | I | Finanzen › Controlling & Ziele | neu: bewusst gespeichert, nicht die Code-Vorgabe | 10 | 5.1, 3.9 |
| 5.3 | **Meilensteine und Fokus:** mit Termin, Aufwand und Beteiligten; ein Fokus je Horizont. | G | Planung › Jahr; `/os/fokus` | umbauen `fokus` (auch `privat:`/`business:`, `jahr:<JJJJ>`); neu: kein „Aufwand fehlt“ | 30 | 5.1 |
| 5.4 | **Finanzplan anlegen:** `finanzen-plan.json` hochladen oder leer beginnen, dazu Gehälter, Netto-Tabelle, Privatkonten, Darlehen. Kontostände der Gesellschaften kommen aus dem 0-Punkt. Bei Stichtag vor 01.10. den Kontostand Okt 26 als Handwert setzen. | G | `/os/finanzen?s=finanzplanung&space=privat` | neu: Dokument vorhanden, Netto-Tabelle kein Platzhalter | 45 | 3.5, 3.6, 3.11 |
| 5.5 | **Selbstständigkeit Jan–Sep:** Einnahmen, Ausgaben, Gehalt vor Planbeginn, **ESt-Vorauszahlungen nur hier** (die Steuer-Einstellungen zählen mit Finanzplanung nicht). | I | `…&u=selbst` | neu: gesetzt ja/nein | 30 | 5.4 |
| 5.6 | **Finanzplan Business:** Bausteine aus Mandaten, Sachkosten, Arbeitsplan. | I | `…&space=business` | neu: Arbeitsplan gesetzt, keine offenen Vorschläge | 30 | 4.4, 5.4 |
| 5.7 | **Arbeitsrahmen je Person.** <br>• Wochenvorlage führend, Grundwert, Urlaub einmal als „Abwesend“. <br>• Arbeitszeit außerhalb (2.6) als Block. <br>• Ohne Eintrag: 40 h bzw. Mo–Fr 9–18. | P | Planung › Routinen, Planung › Kapazität | neu: Business-Blöcke oder Grundwert der Person | 20 | 2.5, 2.6 |
| 5.8 | **Mandate je Person** (gebundene h/Woche). | I | Planung › Kapazität | neu: jedes aktive Mandat mit Zuweisung | 10 | 4.4, 5.7 |
| 5.9 | **Eigene Routinen.** | P | Planung › Routinen | neu: mindestens eine aktive | 10 | – |
| 5.10 | **Gemeinsame Rhythmen:** Finanzen-Check als Serie mit Rotation, Wochenstart und Rückblick als Routinen für beide, Paar-Gespräch mit Termin. | G | Aufgaben, Routinen, Familie › Rahmen | neu: Serie mit Rotation über beide Konten | 20 | 2.5 |
| 5.11 | **Kompass** (gilt bis L21 für beide, also gemeinsam). | G | `/os/kompass` | vorhanden: `kompass` | 15 | 5.1 |
| 5.12 | **Projekte und Listen je Space** (GmbH, Beteiligungsgesellschaft, Privat, Mandanten), aus Vorlagen, mit Verantwortlichen. | G | Aufgaben › Überblick › „+ Projekt“ | neu: je Business-Space mindestens ein Projekt | 30 | 4.4 |
| 5.13 | **Aufgaben sichten:** Verantwortliche, Fälligkeiten, Projekte. | P | `/os/aufgaben` (Meine) | vorhanden: `aufgaben-ich`, `aufgaben` | 20 | 5.12 |

### Etappe 6 — Gesundheit & Familie (je Person 25 Min, gemeinsam 30 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 6.1 | **Gesundheit je Person:** Ernährungsprofil, Sport-Einstieg, Körper-Profil (beim Inhaber erst nach 0.5). Niemand macht das für eine andere Person. | P | `/os/gesundheit`, `/os/sport` | neu: nur ja/nein je Teil | 20 | 1.8/0.4, 0.5 |
| 6.2 | **„Kopf & Energie“ in der Kapazität** (opt): eigene Einwilligung plus „Gesundheit mit allen teilen“. Vorgabe aus. | P | Planung › Kapazität | neu: ja/nein nur für die Person selbst | 5 | 1.8 |
| 6.3 | **Familie › Rahmen:** Paar-Gespräch (landet im gemeinsamen Kalender), Business-freie Zeiten (wirken erst mit L20), Ausnahmezeit. | G | `/os/familie` | neu: Gesprächstag gesetzt und gespiegelt | 15 | 2.5 |
| 6.4 | **Menschen und wichtige Tage.** Geburtstage privater Menschen hier, die von Geschäftskontakten im CRM. | G | `/os/familie` | neu: Menschen mit Geburtstag | 15 | – |

### Etappe 7 — ZOE & Brain (Inhaber 15 Min, je Person 10 Min, gemeinsam 55 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 7.1 | **Autonomie der Agenten** bewusst setzen; was nach außen geht, braucht immer eine Freigabe. | I | ZOE › Agenten | umbauen `agenten`: bewusst gespeichert statt gezählt | 15 | 1.6 |
| 7.2 | **ZOE kennenlernen:** fragen, einen Vorschlag freigeben, Protokoll ansehen. | P | `/os/stapel` | vorhanden: `zoe` | 10 | 1.9 |
| 7.3 | **Brain:** <br>• Regeln und Konstitution freigeben, Kern-Notizen „Wer wir sind“ anlegen. <br>• App-Brücke (Privat als Zahlen oder voll) und Zeit-Freigabe je Person: bis L29 nur über die Schnittstelle. | G | `/os/wissen`; `/api/brain/app` | neu: mindestens eine freigegebene Regel, Brücke gesetzt | 45 | 0.8 |
| 7.4 | **Probelauf Übergabe:** Aufgabe mit @Name an die andere Person, Glocke, Kommentar, erledigt. Entfällt bei einer Person. | G | Heute › Schnellanlage, Glocke | neu: Aufgabe mit `angelegtVon ≠ assignee` erledigt | 10 | 1.3 |

### Etappe 8 — Abschluss (je Person 20 Min, gemeinsam 15 Min, Inhaber 20 Min)
| Nr | Schritt, Erklärung | Wer | Wo | Prüfung | Min | nach |
|---|---|---|---|---|---|---|
| 8.1 | **Rundgang:** Schalter Alles/Privat/Business, Leiste, Heute anpassen, ⌘K, Handy-Menü, Netzwerken, Melden. | P | Heute | Haken | 20 | – |
| 8.2 | **Datenstand:** je Bereich „gepflegt / leer / veraltet“ mit Link; CRM-Verbindungsprüfung, Index ohne Finanz-Lücke. | G | Abschluss bzw. `/os/datenbasis` (neu aufgebaut) | neu (B8) | 15 | alle |
| 8.3 | **Head of IT ohne Rot.** Lage-Sammler-Cron läuft (Befund „host“ nicht grau), Außenblick per GitHub-Secrets. | I | GitHub › Secrets; `/os/hoi` | vorhanden: `gesamt(befunde).rot = 0`, Befunde „host“, „aussen“ | 20 | 0–2 |

## A3 Datenkarte: welche Zahl wohin (bis die Doppelungen weg sind)
| Fakt | Hier eintragen (führend) | Dort nicht (noch) pflegen |
|---|---|---|
| Kontostand Gesellschaft am Stichtag | 0-Punkt | Finanzplanung-Posten „Konto“, `annahmen.kdvStart` |
| Kontostand Gesellschaft danach | Liquidität `#kontostaende`, Datum **nach** dem Stichtag | Einstellungen › Stammdaten › Konten |
| Kontostand Okt 26 im Finanzplan bei Stichtag vor 01.10. | Handwert in der Finanzplanung | – |
| Kontostand privat | Finanzplanung › Privat (Posten Konto) | Haushalt (kennt keinen Saldo) |
| Offene Posten am Stichtag | 0-Punkt (auch archivierte Rechnungen vor dem Stichtag) | Finanzplanung › Verpflichtungen |
| Offene Posten danach | Rechnungen & Zahlungen | ebenso |
| Monatszahlen Business | Monatsabschluss (ab Stichtag-Monat) | `finance.months` (Rückfall im Controlling) |
| Köpfe und Beratertage je Gesellschaft | Business-Einstellungen | Kapazität (rechnet je Person, nicht je Firma) |
| Firmendaten, Bank | Unternehmen › Steckbrief und Absender | Einstellungen › Stammdaten › Firmen und Konten |
| Beteiligungen an fremden Firmen | Register › Beteiligungen | – |
| Selbstständigkeit Jan–Sep | Finanzplanung › Selbstständigkeit | Privat-Monatsabschluss derselben Monate |
| ESt-Vorauszahlungen der Selbstständigkeit | Finanzplanung › Selbstständigkeit | Steuer-Einstellungen (zählen mit Finanzplanung nicht) |
| Steuerparameter der Selbstständigkeit | Finanzplanung › Zahnrad | Steuer-Modul (liest bei vorhandener Finanzplanung daraus) |
| Produkte und Preise | Mandate › Produkte | Rechnungen › Karte „Produkte“ |
| Jahresziel Umsatz | Planung › Jahr, dieselbe Zahl in Controlling und Business-Einstellungen | – |
| Arbeitszeit | Wochenvorlage | Kalender-Arbeitsfenster, Beratertage |
| Arbeitszeit außerhalb (KEMARIS) | Blöcke bzw. Abwesenheit (2.6) | – |
| Urlaub | Kalender „Abwesend“ | Ausnahme in der Kapazität |
| Budget, Schulden, Fixkosten privat | nach R4 | der jeweils andere Ort |
| Rücklage privat | Privat-Index | – |
| Geburtstage | Familie (privat) bzw. CRM (geschäftlich) | – |
| Persönliche Kennungen (Steuer-ID, SV-Nummer) | vorerst **nirgends** (L27) | Einstellungen › Stammdaten |
| Verträge | Gesellschaften: Register; privat: kein Ort (L36) | – |

## A4 Gesamtdauer und Termine

**Dauer:**
- Je Person (P): ≈ 3½ h, mit Optionalem ≈ 4¼ h.
- Inhaber zusätzlich (I): ≈ 8 h.
- Am Server (S): ≈ 3½ h.
- Gemeinsam (G): ≈ 7½ h, bei Stichtag 01.01. ≈ 8¼ h.
- Eigene Termine (Mail-Umzug, WhatsApp): ≈ 3 h.
- **Kevin gesamt ≈ 25–26 h, Malin ≈ 11–12 h.**

**Termine (Vorschlag):**
- **Fr 09.10.** nach dem Ausrollen, ab ca. 16:30, Kevin ≈ 1½ h: 0.1, 0.2, 0.3 (Server-Teil), 1.1, 0.4, 0.5, 1.4, 0.9, dazu 0.8, wenn Zeit bleibt.
- **Sa 10.10. vormittags**, Kevin ≈ 3 h:
  - 0.6, 0.8 (falls offen), 0.10, 0.11, 1.5, 1.6.
  - Etappe 2 für sich: 2.1–2.4, 2.7.
  - WhatsApp bei Meta anstoßen, wenn R5 entschieden ist.
- **Sa 10.10. nachmittags**, gemeinsam ≈ 2½ h:
  - Malins Etappen 1 und 2.
  - Dazu 0.12, 1.7, 2.5, 2.6, 3.1, 4.1, 6.3, 6.4, 7.4.
- **So 11.10.**, Kevin:
  - 0.7 (≈ 45 Min, braucht das erste age-Archiv).
  - 3.2–3.6, 3.8, 3.9, 7.1 (≈ 3¼ h).
- **Mo–Mi 12.–14.10. abends:**
  - Kevin 4.2–4.5 (≈ 2 h).
  - Jede Person 3.10, 5.7, 5.9, 5.13, 6.1 (≈ 1¾ h).
- **Do 15.10.**, gemeinsam ≈ 3 h: 3.11, 4.3, 4.6, 5.1, 5.3, 5.4, 5.10, 5.11, 5.12, 7.3.
- **Fr 16.10. mit Update 2:**
  - Kevin 3.7 (nur Monate ab dem Stichtag), 5.2, 5.5, 5.6, 5.8, 8.3 (≈ 2 h).
  - Gemeinsam 8.1 und 8.2.
  - **Harte Frist:** 0.5 muss vorher „uebernommen“ melden.
- **Eigene Termine:**
  - Mail-Umzug an einem Werktag-Vormittag nach dem Gmail-Test.
  - WhatsApp nach der Verifizierung bei Meta.
- **Hinweis:** Laut Roadmap startet Malin am 01.11. Bleibt es dabei, macht sie dann die Etappen 1, 2 und 6; Kevin macht die gemeinsamen Schritte vorab (R1).

## A5 Bauplan für das Onboarding selbst
| Baustein | Was | Dateien | Größe | Für Kunden | Wann |
|---|---|---|---|---|---|
| **B0 Freitag-Paket** | <br>• B2 komplett, B3 Teil 1, neutrale Spur-Titel ohne Wechsel der Kennungen. <br>• Alle neuen Schritt-Texte und die Datenkarte in den bestehenden Spuren; Telegram-Schritt raus. <br>• WHOOP, Rundgang und Bauplan in jede persönliche Spur. <br>• Karte auf Heute (B5). <br>• `UPLOAD_0810.md` um 0.4/0.5 ergänzen. | `lib/make-one/onboarding-data.ts`, `lib/onboarding-status.ts`, `app/api/onboarding/route.ts`, `components/os/flaeche/widgets.tsx`, `components/os/HeuteView.tsx`, `UPLOAD_0810.md`, Tests | S–M | ja | bis Fr-Mittag |
| **B1 Ebenen statt Namen** | <br>• `SPUREN` → Ebenen `instanz · gemeinsam · ich`, gebildet aus den Konten. <br>• Seiten `/os/onboarding`, `/ich`, `/gemeinsam`, `/instanz` (nur Inhaber); `/zusammenarbeit` bleibt. <br>• `/kevin` und `/malin` löschen, nur in `next.config.mjs` weiterleiten. <br>• Alte Häkchen `<spur>-<x>` einmalig an die Person mit diesem Speichernamen. <br>• `ONBOARDING_MALIN.md` anpassen. | dazu `app/os/onboarding/*`, `next.config.mjs`, `lib/make-one/seiten.ts`, `lib/make-one/einstellungen.ts`, `components/os/KontoView.tsx:170`, Tests `aufraeumen-etappe1`, `onboarding-stand` | M | ja | 16.10. |
| **B2 Häkchen je Person, sicherer Schreibweg** | <br>• `onboarding--<person>` (persönlich), `onboarding` (gemeinsam). <br>• POST mit `personStreng`; `id` aus `SCHRITTE`, sonst 400 (nie kürzen); kleiner Body; Instanz-Schritte nur Inhaber (403); `bauPruefen`; Speichername statt Vorname. <br>• Speicher-Register, `PERSON_BESTAENDE`, Marke in der Messlatte, Wächter. | `app/api/onboarding/route.ts`, `lib/crm/speicher-register.ts`, `lib/datenschutz/konto-daten.ts`, `tests/onboarding-stand.test.ts`, `tests/messlatte-malin.test.ts` | S | ja | Fr |
| **B3 Prüfungen** | <br>• **Teil 1 (Fr):** `kontakte` über eine Zählfunktion der Kartei (`kontakteFuerVerarbeitung`, nicht `loadJson('kontakte')`); `ziele` aus der Planung; `konten` über `geltendeLaden()` + `BUSINESS_GESELLSCHAFTEN`; `posten` mit überfälligen Rechnungen; neu google, gmail, whoop, eroeffnung, haushalt; „gesund“ = nicht getrennt/anmeldung. <br>• **Teil 2 (16.10.):** Datenschutz-Selbstprüfung, Finanzplan, Haushalt, Monatsabschluss (ab Stichtag), Mandate, Produkte, Kapazität, Familie, Brain, Agenten, Business-Einstellungen. <br>• Head-of-IT-Befunde wiederverwenden (`zwei-faktor`, `vault`, `abholung` …). <br>• `merken` mit Person im Schlüssel (1 vCPU). | `lib/onboarding-status.ts`, `lib/hoi/lage.ts` (nur lesen) | S + M | ja | Teil 1 Fr, Teil 2 16.10. |
| **B4 Schema und geführter Ablauf** | <br>• Felder `ebene`, `modul`, `danach`, `nach[]`, `optional`, `nurMitMehreren`, `wartetAuf`, `datenOrt`. <br>• „Nächster Schritt“ oben, Fortschritt je Ebene, Abhängigkeiten als Hinweis; Bausteine aus `components/os/ui`. | `onboarding-data.ts`, `OnboardingView.tsx` | M | ja | 16.10. (Texte Fr) |
| **B5 Einstieg** | <br>• Widget „Einrichtung · x von y“ vorne in `HEUTE_STANDARD`, verschwindet bei „fertig“. <br>• `fortschritt()` wird gerechnet, aber nirgends gezeigt (`app/api/startflaeche/route.ts:37,158`, keine Oberfläche ruft die Route). <br>• `WillkommenMalin` → neutrale Begrüßung neuer Personen. | `components/os/flaeche/widgets.tsx`, `components/os/HeuteView.tsx`, `components/os/WillkommenMalin.tsx` | S | ja | Karte Fr, Begrüßung 16.10. |
| **B6 Instanz-Teil über den Head of IT** | <br>• Server-Schritte zeigen den `befehl` und prüfen über vorhandene Befunde. <br>• Für Verbindungen neu: graue Befunde „erwartet, nicht eingerichtet“ (heute gibt es dann gar keinen). | `onboarding-data.ts`, `lib/hoi/lage.ts` | S–M | teils | Texte Fr, grau 16.10. |
| **B7 Datenkarte** | A3 als Daten (`DATENKARTE`), gezeigt in Etappe 3 und 5. | `onboarding-data.ts` | S | ja | Fr |
| **B8 Datenstand** | <br>• `/os/datenbasis` neu aus denselben Prüfungen. <br>• Alte Lesewege raus (`state/finance` months, `state/kunden`, `finanzplan.produkte`, feste Namen). | `components/os/DatenbasisView.tsx` | M | ja | 16.10. |
| **B9 Daten-Assistenten** | <br>• (a) Monatsabschluss als Tabelle mit Einfügen aus Excel/BWA-CSV, (b) offene Posten, (c) Mandate-Tabelle. <br>• (d) Kontoauszug mit Spaltenzuordnung, Vorspann, Saldo, CAMT; (e) Kartei-Import mit Spaltenzuordnung. <br>• Immer Vorschau → Bestätigen → Rückgängig; nie kürzen. | `components/os/business/Abschluss.tsx`, `Eroeffnung.tsx`, `components/os/mandate/`, `lib/finanzen/haushalt/import.ts`, `app/api/crm/import` | je M | ja | a–c 23.10., d–e 30.10. |
| **B10 Dauerhafte Ampel** | Prüfungen laufen weiter; fällt ein Schritt zurück, zeigt die Heute-Karte „1 Punkt braucht dich“. Keine zweite Glocke. | `lib/onboarding-status.ts`, Widget | S | ja | 23.10. |
| **B11 Rechte-Filter der Befunde** | „Gemeinsam“-Befunde nach `privatFinanzZugang` bzw. Haushalt; Wächter „Business-Partner bekommt keine Privat-Befunde“. | `lib/onboarding-status.ts`, Tests | S | ja | 16.10. (Fr nur, wenn neue Privat-Prüfungen schon kommen) |

**Kürzungs-Linie:** Wird B0 bis Freitagmittag nicht gegengeprüft fertig, geht der Upload ohne Onboarding-Umbau hoch. Kevin führt die Schritte dann nach dieser Liste durch (Haken von Hand), und B0 kommt am 16.10.

---

# TEIL B — Lückenliste „Damit ihr als Business Couple perfekt arbeiten könnt“

**Wann:** V = vor dem Onboarding nötig · P1 = Phase 1 (Oktober) · P2 = Phase 2 (November) · sp = später.

**Schnell-Index V:**
- Bauen bzw. entscheiden: L1 (B0), L2, L4, L12.
- Nur Regel festlegen (die Datenkarte trägt sie): L5, L6, L9, L20.
- Kleine Korrekturen: L10, L11, L15 (falsche Fakten), L18 (Rückfall), L23 (grau), L24, L25.
- Entscheidung bzw. Übergang: L26, L33, L35 (Notfallmappe als Mindestmaß).

### Onboarding & Plattform
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L1 | Onboarding: <br>• fest auf zwei Namen (auch in der Demo sichtbar), Häkchen für den Haushalt; <br>• zwei Prüfungen falsch (`netzwerk` statt Kartei, Code-Ziel gilt als gesetzt); <br>• Route kürzt `id` still und speichert Vornamen; <br>• kein Einstieg auf Heute; online die alte Mac-Fassung. | blockiert · M · V | `lib/make-one/onboarding-data.ts`, `lib/onboarding-status.ts:82,87,115,121`, `app/api/onboarding/route.ts:30-33`, `components/os/KontoView.tsx:170` | B0–B11 |
| L2 | Persönliche Inhalte im Code. <br>• Körper: **gebaut**, noch nicht gemergt. <br>• Nordstern und alte Meilensteine: **in Arbeit**, noch im Code (inkl. Altname). | blockiert · M · V | Branch `privat-raus-koerper` (`lib/altbestand/uebernahme.ts`), Branch `privat-raus-nordstern` (ohne Commit), `lib/make-one/nordstern-data.ts:10` | Körper gegenprüfen und mergen; Nordstern nur, wenn fertig; Übernahme 0.4/0.5 vor 16.10. |
| L3 | Instanz-Einrichtung nur per SSH, `.env` und Build-Variablen (Geheimnisse, Firmennamen, Bereich je Einheit, Vertriebsteam). | stört (für Kunden blockiert) · L · sp | `deploy/env.server.beispiel`, `lib/einheiten.ts`, `lib/crm/team.ts`, `lib/google/verbindung.ts:85` | Zwischenschritt `deploy/env-setzen.sh` mit verdeckter Eingabe; später Instanz-Einstellungen in der App (nur Inhaber, `erneutPruefen`, verschlüsselt, Werte nie zurück) |

### Finanzen & Zahlen
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L4 | Der Stichtag archiviert alles davor (auch Monatsabschlüsse vor dem Stichtag-Monat). Liegt er vor dem Planbeginn, setzt die Finanzplanung den alten Bestand als Kontostand Okt 26. | blockiert · S · V (Entscheidung) | `lib/business/eroeffnung.ts:97,106-109,291`; `lib/finanzen/rechenkern.ts:439,466` | R2 entscheiden; bei Stichtag vor 01.10. Handwert oder `kontoStartFuerPlan` nur bei Stichtag ≥ Planbeginn |
| L5 | Kontostände an fünf Stellen; die Demo trägt dasselbe Konto doppelt ein. | blockiert · L · Regel V, Bau P1 | `lib/finanzen/finanzplan-bestand.ts:17-25`, `lib/business/eroeffnung.ts:34-51`, `lib/finanzen/szenarien.ts:243-247`, `lib/demo/saat.ts:355,366` | Konten-Register (Konto → Gesellschaft/Person/gemeinsam, Stand mit Datum), alle lesen daraus |
| L6 | Haushalt und Finanzplanung führen Budget, Schulden, Fixkosten und Ist getrennt. | blockiert · L · Regel V (R4), Brücke P1 | `lib/finanzen/haushalt/typen.ts:133-139`, `lib/finanzen/rechenkern.ts:190-202`, `components/os/finanzplan/Monat.tsx:223` | eine Seite führt, die andere liest |
| L7 | Zahlen nur Formular für Formular, kein Einfügen aus Excel/BWA, kein Import für Geschäftskonten. | blockiert · M/L · P1 | `components/os/business/Abschluss.tsx:7,24-35`, `components/os/BuchungenView.tsx` | B9 a–c; CSV/CAMT bis zur Bank-Anbindung |
| L8 | Kontoauszug-Import nur für N26 erprobt, Kopfzeile muss in Zeile 1 stehen, keine Spaltenzuordnung, Inhaber fest „Kevin/Malin“. | stört · M · P1 | `lib/finanzen/haushalt/import.ts:128-153`, `components/os/haushalt/Stammdaten.tsx:105,127` | B9 d; Inhaber aus den Konten |
| L9 | Steuerprofil an zwei Orten, GmbH ohne Fristen; die Selbstständigkeit Jan–Sep doppelt. | stört · M · Regel V, Bau P1 | `lib/steuern/rechnen.ts:27,61-85`, `lib/finanzen/rechenkern.ts:540-548`, `app/api/privat/abschluss/route.ts` | ein Profil je Gesellschaft/Person; Monatsabschlüsse speisen `selbst.posten` |
| L10 | Jahresziele an vier Stellen; die Code-Vorgabe 1 Mio/300k zählt nach dem ersten Speichern als „gesetzt“ (und erscheint in jeder neuen Instanz). | stört · S+M · Vorgabe V, Quelle P1 | `lib/make-one/finance-data.ts:21-24`, `components/os/ControllingView.tsx:109,131,310`, `lib/business/speicher.ts:37` | Vorgabe entfernen; Planung › Jahr führt |
| L11 | Alte Karte „Produkte“ unter Rechnungen doppelt zum Katalog. | stört · S · V | `components/os/FinanzplanungView.tsx:385-405`, `components/os/DatenbasisView.tsx:54-57` | übernehmen, Karte entfernen |
| L31 | **Rechnungen schreiben** (PDF, fortlaufende Nummer, E-Rechnung), **Mahnwesen**, Abgleich mit Zahlungseingängen. „MAKE OS trägt die GmbH“ hängt daran. | blockiert (Ziel 2 der Roadmap) · L · Entscheidung P1, Bau P1/P2 | `MODUL_LANDKARTE.md` › Angebote & Rechnungen; `lib/crm/angebot-pdf.ts` (nur Angebote); `components/os/FinanzplanungView.tsx` (Nummer als Textfeld) | wie das Angebots-Tool: Nummer + PDF in einer Sperre; Angebot → Rechnung direkt; Mahnstufen als Vorschlag |
| L32 | **Keine Bank-Anbindung.** Jede Zahl bleibt Handarbeit; „sauber rein“ hält nur mit monatlicher Disziplin. | blockiert (dauerhaft) · L · P2 (laut Roadmap) | `ROADMAP_Q4.md` › Phase 2; `lib/finanzen/haushalt/import.ts` | finAPI wie geplant; bis dahin B9 d und die wöchentliche Ampel (B10) |
| L34 | **Eröffnungs-Posten** lassen sich nicht als bezahlt markieren (Status fest), nur über eine neue Fassung des 0-Punkts. | stört · S · P1 | `lib/business/eroeffnung.ts` (`istEroeffnungsKennung`, `status: 'gestellt'`/`'offen'`) | „bezahlt am“ je Eröffnungs-Posten; bis dahin Onboarding-Text |

### ZOE & Kanal aufs Handy
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L12 | Tageslauf, Arbeits-Schalter und Gesundheitszeit liegen in geteilten Beständen ohne Person. Die Tages-Ausrichtung entsteht mit dem Gesundheitskontext der auslösenden Person und ist für jedes Konto lesbar. Der Prompt ist fest auf Kevin geschrieben. Online offen. | blockiert (Trennung, Art. 9) · S · V | `app/api/tageslauf/route.ts:40-51,216-235,299`, `app/api/state/arbeitsmodus/route.ts:37-46`, `components/os/RitualView.tsx:107-112` | Bestände je Person, GET nur eigene Läufe, Prompt neutral, Wächter + Messlatte |
| L13 | Kein Kanal aufs Handy: die Glocke wirkt nur bei offener App, der Telegram-Haken versendet nichts, der Bote läuft nur am Mac, kein Web-Push. **Auch Anmelde-Warnungen und Head-of-IT-Rot erreichen niemanden.** | blockiert · L · P1 | `lib/meldungen/speicher.ts:47-53`, `compose.yml`, `public/manifest.webmanifest`, `app/api/konto/anmelden/route.ts`, `datenschutz/TOM.md` (L6) | Kanal-Schicht je Person (neutral, Ruhezeiten); Sicherheits-Hinweise zuerst |
| L14 | WhatsApp als ZOE-Kanal kollidiert mit dem geteilten Business-Postfach; außerhalb des 24-h-Fensters geht nur eine genehmigte Vorlage. | blockiert · M · P1 (R5) | `lib/whatsapp/konfig.ts`, `lib/whatsapp/strom.ts`, `research/inbox/FAKTEN_WHATSAPP_IMAP.md` §3 | Nummer je Konto bestätigen, eigene Nummern nie in den Strom, Utility-Vorlage „Briefing bereit“, Opt-in je Person |
| L15 | ZOE-Rhythmus nur für den Inhaber; Briefing nicht auf Heute; Loops nur per Klick. Der Gesprächs-Prompt enthält **falsche Fakten** (alte Holding- und Produktnamen, „MAKE.One = privat, kein Unternehmen“) und „Kevins Stapel“. | blockiert · M · Fakten V (S), Rest P1 | `lib/zoe/takt.ts:212-241`, `lib/zoe/agenten.ts:265-276`, `app/api/loop/route.ts`, `app/api/kimmi/route.ts:82-123` (v. a. 86, 101) | Fakten aus Register und Einheiten; Läufe je Konto; Briefing-Karte; gemeinsamer Wochenblick |

### Zusammenarbeit zu zweit
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L16 | Eine Mail lässt sich nicht an die andere Person übergeben; kein Weiterleiten, keine Anhänge. `hello@` (Google-Gruppe) landet doppelt in zwei persönlichen Spiegeln, ohne „wer antwortet“. | stört · M · P1 | `components/os/inbox/Gespraech.tsx:84-92`, `app/api/inbox/gespraech/route.ts:16-28`, `app/api/inbox/senden/route.ts`, `GOOGLE_GMAIL_EINRICHTEN.md:142-144` | „An <Person> übergeben“ mit freigegebener Kopie; gemeinsames Postfach je Gesellschaft mit „wer kümmert sich“ |
| L17 | Im geteilten WhatsApp-Postfach fehlt „wer antwortet“. | stört · S · P1 | `lib/inbox/zustand.ts`, `lib/whatsapp/strom.ts` | übernehmen/abgeben, Fächer „bei mir / bei dir“ |
| L18 | Heute trennt nicht meins/unseres; Filter „von mir vergeben“ fehlt; das Widget fällt auf 'kevin' zurück; Ziele und Meilensteine ohne Verantwortliche. | stört · S · Rückfall V, Rest P1 | `components/os/flaeche/widgets.tsx:113`, `lib/aufgaben/struktur.ts:427-436`, `lib/planung/typen.ts` | Kacheln „Meine“ / „Bei <Partner>, von mir“; Feld `verantwortlich` |
| L19 | Rollen nur Freitext; Team an drei Stellen. | stört · M · P1 | `lib/crm/team.ts:28-50`, `lib/kalender/einstellungen.ts:11,58` | eine Rollen-Quelle aus Konten und Team |
| L20 | Business-freie Zeiten wirken nirgends; Arbeitszeit an vier Stellen, Urlaub doppelt. | stört · M · Regel V, Bau P1 | `lib/familie/typen.ts:20`, `lib/kalender/einstellungen.ts:17-19`, `lib/kalender/freie-zeit.ts:10,36` | ein Arbeitsrahmen je Person; Business-frei sperrt Kalender, Kapazität, ZOE, Heads, Glocke |
| L21 | Kompass gilt für den ganzen Haushalt. | stört · M · P1 | `app/api/state/kompass/route.ts:37,51` | Regler je Person |
| L22 | Keine Meldung bei Familie-Themen, Partner-Terminen im gemeinsamen Kalender, Änderungen im Finanzplan; Familien-Einstellungen ohne Stand. | stört · M · P1 | `lib/meldungen/regeln.ts:36`, `lib/familie/speicher.ts:102-115` | neue Meldungsarten, neutral, abschaltbar; Stand/409 |
| L35 | **Nur ein Inhaber, keine Vertretung.** Rollen nur `inhaber`/`mitglied`, kein Wechsel in der App. Fällt der Inhaber aus, kann niemand Haushalt, 2FA, Datenschutz, Nachweise oder den Server verwalten. | stört (Ausfallrisiko) · M · Notfallmappe V (0.12), Bau P1/P2 (R9) | `lib/zugang/konten.ts:22`, `app/api/konto/haushalt/route.ts:25-44`, `lib/zugang/haushalt-inhaber.ts:79-84` | nach R9 |

### Verbindungen & Betrieb
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L23 | Head of IT: Verbindungen ohne Einrichtung liefern gar keinen Befund (`grau` gibt es, wird hier nicht genutzt); Vault nur Server-Seite; Zulieferung ohne Frische; keine DNS-Prüfung. | stört · S/M · grau V, Rest P1 | `lib/hoi/lage.ts:12,215,231,248,286,325`, `deploy/lage-sammeln.sh:70-99` | graue Befunde „erwartet“, Mac-Commit, Frische aus `/api/zulieferung`, `node:dns` |
| L24 | Verbindungen an fünf Orten; Verbindungen-Seite mit Altlasten (M365 mit `.env.local`/localhost); Anleitungen nur im Repo. | stört · S/M · Altlasten V, Übersicht P1 | `components/os/VerbindungenView.tsx:4,48`, `lib/oauth.ts:33,38`, `lib/make-one/einstellungen.ts:16-21` | eine Übersicht je Instanz und Person, Adressen zum Kopieren |
| L25 | Datenschutz-Register: <br>• M365, Telegram und Newsletter als Startwerte. <br>• Eine gespeicherte Liste kennt neue Startwerte nicht. <br>• AVV Hetzner/Google/Anthropic bestätigt, aber nicht eingetragen; WHOOP „zu prüfen“. <br>• WhatsApp-Spiegel: Text sagt 180 Tage, Frist steht auf 2.557. <br>• Die Dokumente sind in der App nicht lesbar. | stört · S · V | `lib/datenschutz/einrichtung.ts:193-212`, `lib/crm/datenschutz.ts:171`, `lib/crm/loeschfristen.ts:103`, `components/os/datenschutz/Dokumente.tsx` | bereinigen; jede Verbindung setzt ihren Empfänger auf „in Gebrauch“ |
| L26 | Der Mac-Zulieferer braucht eine lokal laufende App auf Kevins Mac; die zweite Person hat keinen Weg (Upload-Teil entschieden). | stört · M · R6 | `zulieferer.mjs:2-18,36-50` | nach R6 |
| L33 | **Microsoft 365 (KEMARIS):** Kalender und Mail nicht anbindbar. Die Hauptarbeitszeit gilt in Kapazität, freier Zeit und bei ZOE als frei. | stört (Kapazität falsch) · M/L · Übergang V (2.6), Bau sp | `app/api/kemaris-calendar/route.ts:1-16`; `MODUL_LANDKARTE.md` › Inbox „Fehlt“ | Übergang über Blöcke bzw. Frei/Gebucht-Freigabe; später OAuth je Person |
| L37 | **Die Inbox hat keine Suche.** | stört · M · P1 (Inbox ist Platz 3 der Polier-Reihenfolge) | `app/api/inbox/route.ts` | Suche über die eigenen Spiegel (nur Kopf + Ausschnitt), serverseitig je Person |

### Firmen, Kontakte & Mandate
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L27 | Firmen-Stammdaten dreifach. Die Stammdaten-Kartei liefert persönliche Kennungen (Steuer-ID, SV-Nummer, IBAN) dem ganzen Haushalt aus, verdeckt nur in der Oberfläche, schreibt per PUT ohne Stand und kürzt still auf 400 Zeichen. | stört · S/M · Absicherung V (bis dahin keine Kennungen eintragen), Zusammenführen P1 | `app/api/state/stammdaten/route.ts:36,51,58`, `components/os/StammdatenView.tsx:8,87`, `lib/gesellschaften/modell.ts:181-208`, `lib/crm/gesellschaften.ts:19-50` | Kennungen serverseitig je Person, Einzeländerungen mit Stand, 413 statt Kürzen |
| L28 | Kartei-Import nur für die eigene Masterliste; Mandate und Deals nur einzeln; „+ Mandat“ ohne Firmen-Kennung. | stört · M · P1 | `app/api/crm/import/route.ts`, `lib/make-one/crm.ts:538-560`, `components/os/crm/Kunden.tsx:121` | Import mit Spaltenzuordnung; Mandate-Tabelle (B9 c) |

### Privat, Brain & später
| Nr | Lücke | Schwere · Größe · Wann | Beleg | Vorschlag |
|---|---|---|---|---|
| L29 | Kein Ort für Kern-Fakten; App-Brücke ohne Oberfläche; Vault nur über Obsidian/Git (die zweite Person schreibt praktisch nicht ins Brain); Brain-Regeln und -Inbox fest auf kevin/malin. | stört · M · P1 | `lib/zoe/vault.ts`, `app/api/brain/app/route.ts`, `lib/brain/inbox.ts`, `lib/brain/regeln.ts` | Kern-Notizen in der App (Vorschlag → Freigabe → Vault); Personen aus den Konten |
| L30 | Später gebündelt: <br>• Gesundheits-Begleitung mit eigener Rolle (Sport kennt kein `?fuer`), Vier-Augen-Freigabe. <br>• Google und WhatsApp für Kunden (Cloud-Projekt je Instanz, Embedded Signup). <br>• Server-Last mit allen Verbindungen. | nice/stört · M–L · sp | `app/api/sport/route.ts`, `lib/zoe/stapel.ts:162-166`, `lib/postfach/takt.ts` | nach Phase 2 bzw. den Testkunden |
| L36 | **Private Verträge, Fristen und Unterlagen** (Versicherungen, Miete, Abos, Kfz) haben keinen Ort; Fixkosten kennen keine Kündigungsfrist; das Register gilt nur für Gesellschaften; kein privates Adressbuch. | stört · M · P2/sp | `lib/finanzen/haushalt/` (kein Feld), `lib/gesellschaften/`, `MODUL_LANDKARTE.md` › Familie | Vertrags-Liste je Haushalt nach dem Muster des Registers (Frist → Kalender/Glocke), Unterlagen verschlüsselt |

---

## Richtungsfragen vor dem Bau

**R1 · Wann läuft das Onboarding?**
1. Wie vorgeschlagen: Freitag Server, Samstag Kevin und gemeinsam, fertig bis 16.10.
2. Alles an einem langen Samstag (10.10., ≈ 8 h), Rest einzeln
3. Kevin komplett bis 16.10., Malin zu ihrem Start am 01.11.
4. Malin macht ihre persönlichen Schritte sofort mit, gemeinsame Zahlen später
5. Zwei feste Blöcke: Sa 10.10. und Sa 17.10., je 3 h gemeinsam
6. Jeden Abend 45 Minuten, bis alles grün ist
7. Erst nach Update 2 (16.10.) mit Ebenen, Datenstand und Tabellen
8. Freitag nur der Server-Teil, alles andere nach Update 2
9. Claude begleitet live im Chat und prüft nach jedem Schritt
10. Jetzt nur Zugang und Verbindungen, Zahlen erst zum Monatsabschluss Oktober
11. Jede Etappe einzeln freigeben

**R2 · Stichtag des 0-Punkts**

Folgen beachten:
- Alles davor wird archiviert.
- Ein Stichtag vor dem 01.10.26 setzt den alten Bestand als Kontostand Okt 26 (Handwert nötig).
- Ein Kontostand mit Datum = Stichtag zählt nicht.

Möglichkeiten:
1. 01.10.2026 (Planbeginn, Jan–Sep nur archiviert; erster Monatsabschluss im November)
2. 01.01.2026 (9 Monatsabschlüsse nachtragen, Handwert Okt 26)
3. Tag der Gründung bzw. Eintragung je Gesellschaft
4. 01.11.2026, sauberer Start nach dem Onboarding
5. Tag des Uploads (09.10.)
6. Eigener Stichtag je Gesellschaft
7. 01.10., Jan–Sep aber getrennt als „Ist vor dem Stichtag“ zeigen (müsste gebaut werden)
8. 01.07.2026 (nur das dritte Quartal nachtragen)
9. Erst die BWA des Steuerberaters abwarten
10. Kein 0-Punkt, Monatsabschlüsse seit Jahresbeginn reichen
11. 31.12.2025 mit den Zahlen aus dem Jahresabschluss

**R3 · Wie kommen die Zahlen rein?**
1. Von Hand, Formulare wie heute
2. Tabellen-Erfassung mit Einfügen aus Excel/Numbers (B9 a–c)
3. BWA/SuSa des Steuerberaters als CSV
4. DATEV-Schnittstelle prüfen
5. CSV/CAMT-Import für Bankumsätze bis zur Bank-Anbindung
6. Bank-Anbindung auf Oktober vorziehen
7. Leere Import-Vorlage (Excel) ausfüllen und hochladen (Vorschau, dann Bestätigen)
8. Vorhandene `finanzen-plan.json` hochladen und daraus 0-Punkt und Mandate vorschlagen lassen
9. Malin pflegt Privat, Kevin pflegt Business
10. Steuerberater bekommt ein Konto „nur Business-Zahlen“
11. ZOE liest hochgeladene BWA-/Kontoauszug-PDFs und schlägt Werte zur Freigabe vor
12. Mischung: Business per Tabelle/BWA, Privat per Kontoauszug

**R4 · Wer führt bei Privat-Finanzen (Budget, Schulden, Fixkosten)?**
1. Haushalt führt das Ist, die Finanzplanung liest daraus (Brücke bauen)
2. Die Finanzplanung führt alles, der Haushalt ist nur Import
3. Haushalt führt, die Finanzplanung nur als Prognose ohne eigenes Budget
4. Getrennt lassen, das Onboarding erklärt den Unterschied
5. Haushalt abschaffen, Import direkt in die Finanzplanung
6. Budget in der Finanzplanung, Schulden im Haushalt
7. Schulden in der Finanzplanung (Darlehen-Liste), Budget im Haushalt
8. Nach Malins Arbeitsweise entscheiden
9. Einen Monat beides nutzen, dann entscheiden
10. Das Blatt Wochen-Check als einziger Ort für Soll und Ist
11. Erst das Konten-Register (L5), dann den Rest daran ausrichten

**R5 · Der WhatsApp-Kanal für ZOE (entschieden ist WhatsApp; offen ist der Weg)**
1. Dieselbe Business-Nummer, eure eigenen Nummern nie im Kunden-Strom (L14)
2. Zweite Business-Nummer nur für ZOE
3. Zweite Nummer erst nach den Testkunden, bis dahin Briefing-Karte auf Heute
4. Übergang Web-Push, WhatsApp danach
5. Übergang E-Mail an die eigene Adresse
6. Übergang nur die Heute-Karte
7. WhatsApp nur als Hinweis (Vorlage „Briefing bereit“), Inhalte in der App
8. WhatsApp mit Inhalten nur für Personen, die das selbst einschalten
9. Sprachnachrichten an ZOE gleich mitplanen
10. Kanal je Person wählbar
11. Erst die Meta-Verifizierung abwarten, dann entscheiden

**R6 · Mac-Zulieferer langfristig (für den Upload entschieden: eigener Schlüssel)**
1. Erinnerungen einmalig in Aufgaben übernehmen, dann abschalten
2. So lassen, dazu ein Frische-Befund im Head of IT
3. Umbauen auf einen Launch-Agent ohne lokale App
4. Nur noch Erinnerungen, keine Kontakte
5. Nur noch Kontakte, keine Erinnerungen
6. Erinnerungen künftig per Siri-Kurzbefehl „Sag ZOE …“
7. Malin bekommt auch einen Zulieferer
8. Nach Phase 2 (Handy & Sprache) entscheiden
9. Abschalten und den Bestand nach der Übernahme löschen
10. Bis Ende Oktober behalten, dann abschalten
11. Export über Kurzbefehle statt Mac-Skript

**R7 · Umfang des Onboarding-Baus vor dem Start**
1. Freitag-Paket B0 bis Freitag, Ebenen und Ablauf mit Update 2
2. Komplett mit Ebenen schon Freitag (Upload notfalls Samstag)
3. Upload Freitag ohne Umbau, Kevin hakt nach dieser Liste ab, v2 am 16.10.
4. Erst die Doppelungen auflösen (Konten, Ziele, Steuer), dann Onboarding
5. Geführter Assistent mit einem Schritt pro Bildschirm
6. Checkliste wie heute, nur inhaltlich vollständig
7. ZOE führt im Gespräch durchs Onboarding
8. Gleich als Kunden-Einrichtungsassistent bauen (inkl. leerer Instanz)
9. Jetzt nur der Inhaber- und Instanz-Teil, Personen-Teil zu Malins Start
10. Mit Bildschirmfotos je Schritt
11. „Datenstand“ als Pflicht vor „fertig“

**R8 · Was zuerst nach dem Onboarding (Phase 1)?**
1. Handy-Kanal und Briefing je Person (L13–L15)
2. Zahlen-Tabellen und Importe (L7, L8)
3. Konten-Register (L5)
4. Rechnungen schreiben, Mahnwesen, E-Rechnung (L31)
5. Bank-Anbindung vorziehen (L32)
6. Mail übergeben, gemeinsame Postfächer, Inbox-Suche (L16, L17, L37)
7. Rollen-Quelle und Heute „meins/unseres“ (L18, L19)
8. Business-freie Zeiten, Arbeitsrahmen, Microsoft-365-Übergang (L20, L33)
9. Kern-Fakten im Brain (L29)
10. Verbindungs-Übersicht und Head of IT (L23, L24)
11. Steuerprofil und Selbstständigkeit (L9)
12. Polier-Reihenfolge laut Plan, Lücken je Modul mitnehmen

**R9 · Wer verwaltet, wenn der Inhaber ausfällt? (L35)**
1. Die zweite Person wird gleichwertige zweite Inhaberin
2. Rolle „Stellvertretung“: Inhaber-Rechte nur nach Bestätigung durch den Inhaber
3. Notfallmappe auf Papier reicht, keine Änderung in der App
4. Notfall-Code, der Inhaber-Rechte für 72 h freischaltet (protokolliert)
5. Vier-Augen für Inhaber-Dinge: beide müssen klicken
6. Server-Zugang (SSH-Schlüssel) auch für die zweite Person
7. Nur ein lesender Notfallzugang
8. Steuerberater oder Anwalt verwahrt die Notfallmappe
9. Inhaber-Rechte je Bereich verteilen (z. B. Datenschutz bei der zweiten Person)
10. Erst bei den Testkunden lösen
11. ZOE erinnert vierteljährlich daran, die Notfallmappe zu prüfen

**R10 · Wer ist Verantwortlicher (Datenschutz) dieser Instanz? (1.5; die Website nennt laut Doku einen anderen — Hinweis, keine Rechtsberatung)**
1. MAKE Innovation GmbH
2. KD Ventures UG
3. Je Bereich: Privat = die Personen des Haushalts, Business = die jeweilige Gesellschaft
4. Gemeinsam Verantwortliche (Art. 26): GmbH und Personen
5. Der Inhaber persönlich
6. Die Selbstständigkeit (Einzelunternehmen)
7. Wie auf der Website, sobald sie wieder online ist
8. Vorläufig die GmbH, anwaltlich prüfen lassen
9. Erst der Anwalt, dann eintragen
10. Bis zum Datenschutz-Paket (Phase 2) offen lassen, mit Hinweis „fehlt“
11. Je Instanz im Kunden-Onboarding abfragen, für uns die GmbH