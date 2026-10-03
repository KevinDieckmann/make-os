# Datenschutz bei „Netzwerken“ und „Events“ — Interessenabwägung (LIA) und Betrieb

Stand 03.10.2026 · Paket „netz-recht“ · **Hinweis, keine Rechtsberatung — einmal anwaltlich gegenlesen lassen.**
Verweis am Kontakt: `Kontakt.rechtsgrundlageNotiz = „LIA-Netzwerken v1“` (setzt nur der Server).

Kevins Entscheidung (03.10.): Kontakte, die Kevin oder Malin als Interim CSO / Head of Sales **für einen Kunden** auf einer Veranstaltung
erfassen, **gehören immer auch uns**. MAKE ist **eigener Verantwortlicher** (Art. 6 Abs. 1 lit. f DSGVO), es gibt **keine Sperre** für die
eigene Akquise. Die Übergabe an den Kunden ist eine **Übermittlung an einen Dritten** (keine Auftragsverarbeitung).

## 1 · Interessenabwägung „LIA-Netzwerken v1“ (Art. 6 Abs. 1 lit. f)

**Zweck.** B2B-Kontaktpflege nach persönlicher Übergabe einer Visitenkarte: Danke-Nachricht, Terminabsprache, Nachfassen, Pflege des
Kontakts in der Kontaktverwaltung. Bei Kunden-Events zusätzlich die Weitergabe an den Kunden zur Weiterführung der Gespräche.

**Berechtigtes Interesse.** Anbahnung und Pflege geschäftlicher Beziehungen (Interim-Vertrieb, Events & Netzwerk) — ein anerkanntes
wirtschaftliches Interesse; ohne Notiz der Kontaktdaten wäre die Begegnung sinnlos.

**Erforderlichkeit.** Es werden nur Daten erfasst, die die Person selbst gegeben hat (Visitenkarte, Gespräch): Name, Firma, Position,
geschäftliche Kontaktdaten, kurze Notiz zum Gespräch, Veranstaltung und Zeitpunkt. Keine sensiblen Angaben (Art. 9) — die Oberfläche sagt es
beim Erfassen. Fotos der Karte und Sprachnotizen sind Hilfsmittel und kurzlebig (6 Monate / 90 Tage). Das Foto wird von Standortdaten (Exif/GPS)
befreit.

**Abwägung mit den Interessen der Person.** Wer seine Visitenkarte persönlich übergibt, rechnet mit einer Rückmeldung (vernünftige Erwartung,
ErwG 47). Die Eingriffsintensität ist gering (Geschäftskontaktdaten, Sozialsphäre), die Daten stammen von der Person selbst, die Speicherung ist
begrenzt. Schutzmaßnahmen:
- **Keine Werbung ohne Einwilligung:** eine Visitenkarte ist keine Einwilligung (§ 7 UWG) — es gibt nie einen Eintrag in `einwilligungen`; Kanal-Ampel,
  Listen und Kampagnen (Mail, LinkedIn, Newsletter: Ampel rot = abgelehnt) greifen. Die Danke-Mail ist nur Dank und Verabredetes
  (fester Hinweis, Warnung bei Werbewörtern, Entwurf nur nach persönlichem Gespräch, nach 14 Tagen nicht mehr angeboten).
- **Transparenz (Art. 13):** der Hinweis steht in der Danke-Mail (wer, wozu, Rechtsgrundlage, Werbung nur mit Einwilligung, Rechte, Kontakt, bei Kunden-Events
  der Empfänger). `datenschutzInformiertAm` am Kontakt belegt es; wer keine Mail bekommt oder nicht gesprochen wurde, bekommt den Hinweis beim ersten Kontakt
  („Heute persönlich erteilt“ in der Kontaktakte); die Selbstprüfung zählt Offene („Information bei Veranstaltungs-Kontakten“).
- **Widerspruch jederzeit (Art. 21):** Werbesperre in einem Klick, gilt überall; Einschränkung (Art. 18) und Löschung (Art. 17) über die Kontaktakte.
- **Begrenzte Speicherung:** siehe Abschnitt 4.
- **Zugang:** nur Kevin und Malin, Anmeldung mit zweitem Faktor, Bestände verschlüsselt, Server in Deutschland.

**Ergebnis.** Das berechtigte Interesse überwiegt, solange die Schutzmaßnahmen eingehalten werden. Die Abwägung ist auf Anfrage der betroffenen Person offenzulegen.

## 2 · Kunden-Events (Übermittlung an den Kunden)

- Markierung: `Kontakt.kennengelerntFuer` (Kunden-Firma, Event, Tag) — sichtbar in der Kontaktakte („kennengelernt für <Kunde> bei <Event>“).
- **Export** (Event-Akte › „An Kunden übergeben“, nur mit Sitzung): Vorschau vor dem Download. Ungefragt gehen nur Personen mit, die **an diesem Event neu angelegt**
  wurden (`Teilnahme.netzwerken.neuAngelegt`); **Bestandspersonen** (vorher bekannt, angehängt, per Mail zusammengeführt) nur mit **ausdrücklichem Haken je Person**;
  gesperrte (Art. 18, Werbesperre) nie. „Noch nicht informiert“ ist markiert (Übergabe bleibt möglich, aber bewusst). Pflicht-Haken: „Rolle und Vertrag mit dem Kunden geklärt“.
- Nur Felder (Name, Firma, Position, Mail, Telefon, Handy, LinkedIn, Webseite) mit **Herkunft je Zeile aus den Daten**, Berliner Kennenlern-Tag, Stand des Datenschutzhinweises und
  „keine Werbe-Einwilligung“ — nie Fotos, Sprachnotizen, Gesprächsnotizen oder Kennungen. Nach der Weitergabe die Datei löschen.
- **Protokoll** am Event (`uebergaben`): Tag, wer, Anzahl, Empfänger (Firma), Dateiname, Kennungen der Personen, der Haken. Wird das Event gelöscht, verlangt der Server die Bestätigung,
  das Protokoll wandert ins **Übergabe-Journal** (`uebergabe-journal--<haushalt>`, 36 Monate). Der Browser kann das Protokoll nie setzen oder verändern.
- **Betroffenenrechte:** Auskunft (Art. 15) nennt „übergeben am … an <Kunde>“; Löschung/Berichtigung: der Bericht nennt den Empfänger („dort informieren, Art. 19“) — die Mitteilung an den Kunden
  schickt ein Mensch. Die Kennung der Person fällt bei Art. 17 aus dem Protokoll (Datum, Anzahl und Empfänger bleiben als Nachweis).
- Offen (Kevin, anwaltlich): die Rolle gegenüber dem Kunden (eigener Verantwortlicher — gemeinsam Verantwortliche nach Art. 26 — Auftrag?) und der Vertrag mit dem Kunden.

## 3 · Technische Maßnahmen (Auszug)

Fotos ohne Exif (Browser-Canvas, Rückfall und Server säubern zusätzlich) · Fotos/Sprachnotizen verschlüsselt in der Dateiablage · Offline-Warteschlange im Browser nur verschlüsselt
(AES-GCM, nicht exportierbarer Schlüssel in IndexedDB, nie Klartext auf der Platte, Abmelden löscht Daten und Schlüssel, ab 14 Tagen Warnung, nach 30 Tagen automatisch verworfen) ·
Telegram-Benachrichtigungen ohne Namen (`telegramText`) · KI-Transkript der Sprachnotiz vorbereitet, **aus** (`TRANSKRIPTION_AN` nur am Server, erst mit AVV/SCC des Anbieters; ein Transkript ersetzt das Audio) ·
Verzeichnis nach Art. 30: `vv-netzwerken`, `vv-besuche-kunde`, `vv-kunden-export` (werden idempotent nachgetragen).

## 4 · Löschfristen (Stammdaten › Datenschutz, anpassbar)

| Datenart | Frist | Wirkung |
|---|---|---|
| Kartenfoto (`netzwerken-karten`) | 6 Monate nach der Erfassung | automatisch (Eintrag + Datei) |
| Sprachnotiz (`netzwerken-sprachnotizen`) | 90 Tage | automatisch |
| Gesprächs-Info und Zielpersonen (`netzwerken-info`) | 12 Monate nach dem Event | automatisch (Teilnahme, Termin und Kennzahlen bleiben) |
| Netzwerken-Kontakte ohne weitere Interaktion (`netzwerken-kontakte`) | 12 Monate | nur Prüf-Aufgabe „löschen oder begründen“ — nie automatisch |
| Übergabe-Protokolle (`uebergabe-protokolle`) | 36 Monate | automatisch (Event und Journal) |
| Offline-Warteschlange im Browser | 14 Tage Warnung · 30 Tage weg | automatisch im Browser |

Nicht automatisch erfasst: der Text „Info:“ in der Verlaufszeile „Kennengelernt bei …“ am Kontakt und in Follow-ups/Aufgaben, die aus der Erfassung entstanden — wer die Info löschen will, löscht sie dort
oder löscht die Person.

## 5 · Was außerhalb der Software zu tun ist

AVV/Verträge (Hetzner, Microsoft, Apple, Anthropic; Vertrag mit dem Kunden) · Datenschutzerklärung `website/datenschutz.html` (Abschnitt `#kontakte`, Platzhalter) freigeben und veröffentlichen ·
Verzeichnis (VVT) als Dokument ablegen · diese Interessenabwägung anwaltlich prüfen · Pflichtangaben in der Mail-Signatur (Impressum-Angaben) · Geräteregel für Handys (Sperre, kein geteiltes Konto, Abmelden).
