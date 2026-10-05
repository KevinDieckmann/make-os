# Datenpannen — Prozess nach Art. 33/34 DSGVO

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Stand 05.10.2026. Gilt für die eigene Instanz (MAKE als
> Verantwortlicher) und für Kunden-Instanzen (MAKE als Auftragsverarbeiter, Abschnitt 6).

**Datenpanne** (Art. 4 Nr. 12) = Verletzung der Sicherheit, die zur Vernichtung, zum Verlust, zur Veränderung, zur unbefugten
Offenlegung von bzw. zum unbefugten Zugang zu personenbezogenen Daten führt — **unabhängig davon, ob absichtlich**. Auch ein
nicht wiederherstellbarer Datenverlust oder eine Mail an den falschen Empfänger ist eine Panne.

Grundregel: **Jede** Panne wird im Pannen-Register dokumentiert (Art. 33 Abs. 5) — auch die, die nicht gemeldet werden muss.

---

## 1 · Rollen

| Rolle | Aufgabe | Wer |
|---|---|---|
| Pannen-Leitung | entscheidet über Eindämmung, Meldung, Benachrichtigung; zeichnet die Meldung | [[KEVIN: Geschäftsführung — Name/Funktion]] |
| Vertretung | übernimmt, wenn die Leitung binnen 2 h nicht erreichbar ist | [[KEVIN: zweite Person — Name/Funktion]] |
| Technik | Eindämmen, Spuren sichern, Ursache, Wiederherstellung | [[KEVIN: wer? ggf. externer Dienstleister]] |
| Rechtliche Bewertung | Risiko-Einschätzung, Meldetext | [[ANWALT: Kanzlei / Datenschutzbeauftragter, Erreichbarkeit]] |
| Kommunikation | Benachrichtigung Betroffener, Kunden | Pannen-Leitung |

Erreichbarkeit außerhalb der Arbeitszeit: [[KEVIN: Telefonkette festlegen]]. Die 72 Stunden laufen **auch am Wochenende**.

---

## 2 · Erkennen — woher eine Panne kommen kann

| Quelle | Was meldet sie | Wo |
|---|---|---|
| **Head of IT (HOI)** | Lage, Fehlerquote, Fehlanmeldungen 24 h, neue Netze 7 Tage, CSP-Verstöße, Sicherung (fehlt/teilweise/Übergang), Abholung > 48 h, abgebrochene Vorgänge, Klartext-Bestand abgelehnt, beschädigte Bestände (`.corrupt-…`), Schlüssel/Pepper/Format | `/os/hoi`; Tagesbericht ab 07:45, stündlich neues Rot (aufs Handy nur mit Telegram-Boten) |
| **Anmelde-Alarm** | Anmeldung aus neuem Netz; ≥ 5 Fehlversuche in 10 Minuten | an die betroffene Person — **nur mit Telegram** (`lib/zugang/anmelde-alarm.ts`); sonst Konto › Anmelde-Protokoll |
| **CSP-Meldungen** | Browser meldet blockierte Skripte/Quellen (möglicher Einschleusungsversuch) | `/api/hoi/csp` → HOI |
| **Healthchecks** | Nachtsicherung ausgeblieben oder fehlerhaft | Mail an beide Personen (falls eingerichtet) |
| **Glocke „Sicherheit“** | Änderung der Anmelde-Adressen | in der App |
| Server | `fail2ban`-Sperren, Systemlog (`journalctl`), Docker-Logs | nur per SSH |
| GitHub | Dependabot-Warnungen, unerwartete Pushes, Secret-Scanning | GitHub |
| Hoster/Anbieter | Sicherheitsmeldung von Hetzner, Google, Microsoft, Anthropic | Mail |
| Menschen | „Das war ich nicht“, verlorenes Handy/Mac, Mail an falschen Empfänger, falsche Datei an Kunden | jede Person meldet **sofort** an die Pannen-Leitung |
| Kunde (Kunden-Instanz) | Meldung des Verantwortlichen | Support-Kanal [[KEVIN: Adresse]] |

Lücke: Ohne Telegram-Boten und ohne regelmäßigen Blick in den HOI kann ein Alarm Stunden unbemerkt bleiben. [[KEVIN: Telegram-Entscheidung bzw. anderer Kanal]]

---

## 3 · Bewerten — Risiko-Matrix

**Schritt 1: Ist es überhaupt eine Panne mit Personenbezug?** Wenn nein (z. B. nur Kennzahlen ohne Personen) → Register-Eintrag, fertig.

**Schritt 2: Eintrittswahrscheinlichkeit × Schwere** für die Betroffenen (nicht für das Unternehmen):

| Schwere ↓ / Wahrscheinlichkeit → | gering | mittel | hoch |
|---|---|---|---|
| **gering** (Geschäftskontaktdaten, öffentlich auffindbar) | kein Risiko | Risiko | Risiko |
| **mittel** (Gesprächsnotizen, Vertriebsstand, Kalender mit Dritten, Beschäftigtendaten Arbeitszeit) | Risiko | Risiko | hohes Risiko |
| **hoch** (Gesundheit Art. 9, Finanzen/IBAN, Zugangsdaten, Gesellschafter-/Vertragsdaten, große Mengen) | Risiko | hohes Risiko | hohes Risiko |

| Ergebnis | Pflicht |
|---|---|
| **kein Risiko** (Art. 33 Abs. 1 Halbsatz 2) | nur Register, Begründung festhalten |
| **Risiko** | **Meldung an die Aufsichtsbehörde binnen 72 h** (Art. 33) + Register |
| **hohes Risiko** | zusätzlich **Benachrichtigung der Betroffenen unverzüglich** (Art. 34), außer Art. 34 Abs. 3 greift |

**Typische Einordnungen in MAKE OS** (Anhaltspunkte, keine Automatik):
- Verschlüsselter Bestand oder age-Archiv abhanden, **Schlüssel nachweislich nicht** betroffen → in der Regel kein hohes Risiko
  (Art. 34 Abs. 3 lit. a). Achtung: liegt der Schlüssel auf demselben System (Server, Hetzner-Abbild, openssl-Passwortdatei), gilt das **nicht**.
- Hetzner-Abbild oder Server kompromittiert → Daten **und** Schlüssel betroffen → hohes Risiko annehmen.
- Konto übernommen (Passwort ohne 2FA) → Umfang nach Rolle: Inhaber-Haushalt = Kartei, Kalender, Finanzen, Gesundheit → hohes Risiko.
- Kunden-Export (CSV) an falschen Empfänger → Geschäftskontaktdaten → in der Regel Risiko, bei vielen Personen hoch.
- Gesundheitsdaten (Whoop, Gesundheits-Log) offengelegt → hohes Risiko.
- Datenverlust ohne Offenlegung, aus Sicherung ≤ 24 h vollständig zurückgeholt → meist kein Risiko (dokumentieren).
- Daten an KI-Anbieter außerhalb des vorgesehenen Umfangs (z. B. eingeschränkte Person im Paket) → Risiko prüfen.

---

## 4 · Ablauf (72 Stunden ab Kenntnis)

„Kenntnis“ = sobald mit hinreichender Sicherheit feststeht, dass eine Panne vorliegt. Erste Prüfung darf Stunden dauern, nicht Tage.

| Zeit | Schritt | Wer | Hilfsmittel |
|---|---|---|---|
| **T0** | Meldung an Pannen-Leitung, Register-Eintrag anlegen (Zeitpunkt Kenntnis!) | wer es bemerkt | Vorlage Abschnitt 8 |
| **T0 + 1 h** | **Eindämmen**: Sitzungen widerrufen („Alle anderen Geräte abmelden“), Passwort ändern, Konto sperren; ggf. App anhalten (`docker compose stop app arbeiter`); Ausroll-/Abhol-Schlüssel entfernen; Tokens bei Google/Microsoft widerrufen | Technik | `NOTFALL.md`, `DEPLOY.md` |
| T0 + 2 h | **Spuren sichern** (vor dem Aufräumen): Docker-Logs, Systemlog, Anmelde-Protokoll, HOI-Stand, betroffenes Archiv — nur verschlüsselt ablegen | Technik | — |
| T0 + 4 h | **Erstbewertung**: welche Daten, welche Personen (Kategorien, ungefähre Zahl), Ursache bekannt? Risiko nach Abschnitt 3 | Leitung + Technik | Speicher-Register `lib/crm/speicher-register.ts` |
| T0 + 4 h | **Kunden-Instanz:** Meldung an den Kunden (Abschnitt 6) — **nicht** auf die eigene Bewertung warten | Leitung | Vorlage 6 |
| T0 + 24 h | Rechtliche Bewertung, Entscheidung Meldung ja/nein (Begründung ins Register) | Leitung + [[ANWALT]] | — |
| T0 + 24–48 h | Schlüssel rotieren, falls betroffen (`datenschluessel-rotieren-live.sh`); Wiederherstellung (`wiederherstellen.sh` — Grabsteine!) | Technik | `NOTFALL.md` |
| **spätestens T0 + 72 h** | **Meldung an die Aufsichtsbehörde** (Vorlage 5) — wenn noch nicht alles bekannt: **schrittweise melden** (Art. 33 Abs. 4), Verzögerung begründen | Leitung | Vorlage 5 |
| unverzüglich (bei hohem Risiko) | **Benachrichtigung der Betroffenen** (Vorlage 7) | Leitung | Vorlage 7 |
| T0 + 30 Tage | Nachbereitung: Ursache, Maßnahmen umgesetzt, TOM/DSFA angepasst, Register abgeschlossen | Leitung | `TOM.md` |

Nie: Beweise löschen, Betroffene vertrösten, intern „erst mal abwarten“.

---

## 5 · Vorlage: Meldung an die Aufsichtsbehörde (Art. 33 Abs. 3)

Zuständig ist die Behörde am **Sitz des Verantwortlichen**: [[KEVIN: Sitz der Gesellschaft → zuständige Landesbehörde und deren
Online-Meldeformular eintragen (bei Sitz in Nordrhein-Westfalen: Landesbeauftragte für Datenschutz und Informationsfreiheit NRW)]].
Die meisten Behörden verlangen ihr **Online-Formular** — die Felder unten dort übernehmen.

```
Meldung einer Verletzung des Schutzes personenbezogener Daten nach Art. 33 DSGVO
[ ] Erstmeldung   [ ] Nachmeldung zu Aktenzeichen: ________

1. Verantwortlicher
   Firma, Anschrift: [[KEVIN]]
   Ansprechpartner (Name, Funktion, Telefon, E-Mail): [[KEVIN]]
   Datenschutzbeauftragter (falls benannt): [[KEVIN: falls benannt]]

2. Zeitpunkte
   Beginn der Verletzung (falls bekannt): TT.MM.JJJJ hh:mm
   Ende / eingedämmt am:                   TT.MM.JJJJ hh:mm
   Kenntnis erlangt am:                    TT.MM.JJJJ hh:mm
   Bei Meldung nach 72 h — Gründe der Verzögerung: ________

3. Art der Verletzung
   [ ] Vertraulichkeit (unbefugte Offenlegung/Zugang)
   [ ] Integrität (unbefugte Veränderung)
   [ ] Verfügbarkeit (Verlust/Vernichtung)
   Beschreibung (was ist passiert, wie entdeckt, Ursache soweit bekannt): ________

4. Betroffene Personen
   Kategorien (z. B. Geschäftskontakte, Interessenten, Beschäftigte, Nutzer der Anwendung): ________
   Ungefähre Zahl: ________

5. Betroffene Daten
   Kategorien (z. B. Kontaktdaten, Gesprächsnotizen, Kalender, Finanzdaten, Gesundheitsdaten Art. 9): ________
   Ungefähre Zahl der Datensätze: ________
   Waren die Daten verschlüsselt? Mit welchem Verfahren? War der Schlüssel betroffen? ________

6. Wahrscheinliche Folgen für die Betroffenen
   (z. B. Phishing, Identitätsmissbrauch, Rufschädigung, Diskriminierung, finanzieller Schaden): ________

7. Ergriffene / vorgeschlagene Maßnahmen
   zur Behebung: ________
   zur Abmilderung nachteiliger Folgen: ________
   gegen Wiederholung: ________

8. Benachrichtigung der Betroffenen
   [ ] erfolgt am ________ (Weg: ________)   [ ] geplant am ________
   [ ] nicht erforderlich, weil (Art. 34 Abs. 3 lit. a/b/c): ________

9. Grenzüberschreitend? Andere Behörden informiert? ________
```

---

## 6 · Kunden-Instanzen: Meldung an den Kunden (MAKE als Auftragsverarbeiter, Art. 33 Abs. 2)

In einer Kunden-Instanz ist der **Kunde Verantwortlicher**. MAKE meldet **nicht** selbst an die Behörde und benachrichtigt **nicht**
selbst die Betroffenen, sondern meldet dem Kunden **unverzüglich (ohne schuldhaftes Zögern)**, Ziel spätestens
[[KEVIN: z. B. 24 Stunden]] nach Kenntnis (so im AVV § 9 vereinbart), damit dessen 72-Stunden-Frist eingehalten werden kann.
Teilinformationen gehen sofort, der Rest wird nachgereicht. MAKE unterstützt bei Bewertung, Meldung und Benachrichtigung (Art. 28 Abs. 3 lit. f).

```
Betreff: Sicherheitsvorfall in Ihrer MAKE-OS-Instanz <instanz> — Meldung nach Art. 33 Abs. 2 DSGVO / AVV § 9

Sehr geehrte Damen und Herren,

wir haben am TT.MM.JJJJ um hh:mm Uhr Kenntnis von einem Vorfall in Ihrer Instanz <instanz> erhalten.

Was wir wissen:      ________
Was wir noch nicht wissen: ________
Betroffene Daten (Kategorien, ungefähre Zahl): ________
Verschlüsselung / Schlüssel betroffen?: ________
Bereits ergriffene Maßnahmen: ________
Unsere vorläufige Einschätzung des Risikos: ________ (Ihre Bewertung als Verantwortlicher bleibt maßgeblich)

Ihre Frist zur Meldung an die Aufsichtsbehörde endet voraussichtlich am TT.MM.JJJJ hh:mm (72 Stunden ab Ihrer Kenntnis).
Wir unterstützen Sie bei der Meldung und einer etwaigen Benachrichtigung der Betroffenen. Nächstes Update: TT.MM. hh:mm.

Ansprechpartner: [[KEVIN: Name, Telefon, E-Mail]]
```

Der Vorfall kommt **zusätzlich** in das eigene Pannen-Register (Spalte „Instanz/Kunde“).

---

## 7 · Vorlage: Benachrichtigung der Betroffenen (Art. 34)

Klar und einfach (Art. 34 Abs. 2, Art. 12). Weg: E-Mail an die bekannte Adresse; bei unverhältnismäßigem Aufwand öffentliche
Bekanntmachung (Art. 34 Abs. 3 lit. c) — vorher [[ANWALT]].

```
Betreff: Wichtiger Hinweis zum Schutz Ihrer Daten

Guten Tag <Anrede>,

am TT.MM.JJJJ ist bei uns ein Sicherheitsvorfall aufgetreten, der auch Daten über Sie betrifft.

Was ist passiert?   <kurz, ohne Fachsprache>
Welche Daten?       <z. B. Name, geschäftliche E-Mail-Adresse, Telefonnummer, Notizen zu unserem Gespräch>
Mögliche Folgen:    <z. B. gefälschte E-Mails, die unseren Namen nutzen>
Was wir getan haben: <eingedämmt, Zugänge gesperrt, Behörde informiert am …>
Was Sie tun können: <z. B. bei E-Mails mit unserem Namen und Zahlungsaufforderung misstrauisch sein; Passwort ändern, falls …>

Ihre Fragen beantwortet: [[KEVIN: Name, Telefon, E-Mail]]
Verantwortlich: [[KEVIN: Firma, Anschrift]]  ·  Datenschutzbeauftragter: [[KEVIN: falls benannt]]
Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren.

Wir bedauern den Vorfall.
```

Keine Benachrichtigung nötig, wenn (Art. 34 Abs. 3): (a) die Daten für Unbefugte unzugänglich sind (z. B. Verschlüsselung,
Schlüssel sicher), (b) nachträgliche Maßnahmen das hohe Risiko beseitigen, (c) sie unverhältnismäßig wäre (dann öffentliche
Bekanntmachung). Die Begründung gehört ins Register.

---

## 8 · Vorlage: Pannen-Register (Art. 33 Abs. 5)

Das Register enthält **selbst** personenbezogene Angaben und gehört **nicht ins Code-Repository**. Ablage:
[[KEVIN: Ort festlegen, z. B. verschlüsselte Dateiablage der Gesellschaft in MAKE OS oder Passwort-Manager-Notiz]];
Aufbewahrung [[ANWALT: Frist für das Register]]. Spalten:

| Nr. | Kenntnis am (Datum, Uhrzeit) | Instanz / Kunde | Beschreibung (Was, Ursache) | Art (V/I/A) | Betroffene (Kategorien, Zahl) | Daten (Kategorien, verschlüsselt?) | Risiko (kein/Risiko/hoch) + Begründung | Gemeldet an Behörde (Datum, Az.) bzw. Grund der Nichtmeldung | Kunde informiert (Datum) | Betroffene benachrichtigt (Datum, Weg) bzw. Grund | Maßnahmen (sofort / dauerhaft) | Abgeschlossen am | Zeichen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-01 | | | | | | | | | | | | | |

---

## 9 · Nach jeder Panne

- `TOM.md` Lücken-Liste ergänzen bzw. Maßnahme abhaken; betroffene DSFA (`DSFA.md`) neu bewerten.
- Wenn ein Code-Fehler Ursache war: Wächtertest, der genau diesen Fall rot macht.
- Jährlich einmal den Ablauf **üben** (Planspiel „Konto übernommen“, „Server weg“ — zusammen mit `NOTFALL.md`).
