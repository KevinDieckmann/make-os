# Datenschutz-Dokumente MAKE OS

> **Entwurf — anwaltlich prüfen** (gilt für jedes Dokument in diesem Ordner). Keine Rechtsberatung. Stand 05.10.2026 (Code e15a9a8). Ziel: MAKE OS auf DSGVO-Stand bringen,
> damit Kundendaten aufgenommen werden können. Alle Dokumente beschreiben den **IST-Stand** — Offenes ist mit
> `[[KEVIN: …]]` (Entscheidung/Angabe) bzw. `[[ANWALT: …]]` (rechtliche Prüfung) markiert. Keine echten Namen oder Adressen außer
> Platzhaltern; das Repo bleibt frei von Daten (Rohbau-Regel).

## Was wo liegt

| Datei | Inhalt | Für wen |
|---|---|---|
| `TOM.md` | Technische und organisatorische Maßnahmen (Art. 32) nach Kontrollzielen, mit Nachweis im Code und **Lücken-Liste L1–L17** | eigene Doku, Anlage 1 zum AVV |
| `DATENPANNEN.md` | Prozess Art. 33/34: Erkennen, Risiko-Matrix, 72-Stunden-Ablauf, Vorlagen (Behörde, Betroffene, Kunde), Pannen-Register | eigener Betrieb + Kunden-Instanzen |
| `LOESCHKONZEPT.md` | Datenart → Frist → Auslöser → Weg → Nachweis, abgeglichen mit `lib/crm/loeschfristen.ts`; Sicherungen/Grabsteine; manuelle Stellen; **Abweichungen A1–A7** | eigene Doku, Kunden |
| `DSFA.md` | Schwellwertanalyse (DSK-Liste, WP 248) + DSFA-Entwürfe: Gesundheit+KI, Beschäftigten-Planung, KI-Hintergrundläufe/Scoring; § 38 BDSG | eigene Doku, Kunden (als Unterstützung) |
| `AVV_VORLAGE.md` | AVV MAKE (Auftragsverarbeiter) ↔ Kunde (Verantwortlicher) nach Art. 28 Abs. 3, Anlagen: TOM, Unterauftragsverarbeiter, **Support-Zugriffsprozess** | Kunden |
| `KUNDEN_ONBOARDING_DATENSCHUTZ.md` | Checkliste je Kunden-Instanz: Tore, Vertrag, Technik, Einstellungen, KI-Schalter, Vertragsende | Betrieb |
| `KI_VO.md` | Einordnung KI-Verordnung: Rollen, Art. 4, Art. 5, Art. 50 (ab 02.08.2026), Anhang III Nr. 4, Maßnahmen K1–K11 | eigene Doku, Kunden |

Verwandte Dokumente im Repo: `DATENSCHUTZ_APP.md` (Hinweis der Anwendung, Entwurf), `DATENSCHUTZ_NETZWERKEN.md` (Interessenabwägung
Netzwerken), `DEPLOY.md`, `NOTFALL.md`, `PLATTFORM_PLAN.md`; im Code die eine Quelle je Thema: `lib/crm/speicher-register.ts`
(Register aller Speicher), `lib/crm/datenschutz.ts` (Verzeichnis Art. 30, Löschregeln, Selbstprüfung), `lib/crm/loeschfristen.ts`.

**Pflege:** Ändert sich Code mit Datenschutzbezug, zieht dieselbe Änderung das betroffene Dokument hier nach (wie `DATENSCHUTZ_APP.md`).

## Kernaussagen (ehrlich)

- **Stark gebaut:** Verschlüsselung im Ruhezustand (AES-256-GCM), serverseitige Trennung, Register aller Speicher mit Wächtertest,
  Art. 15/17/18/21 als Werkzeuge, Grabsteine gegen „Restore holt Gelöschte zurück“, Löschfristen-Lauf, Human-in-the-Loop, KI-Kapselung.
- **Nicht fertig für Kundendaten:** age am Server fehlt (Sicherungen im Übergangsverfahren mit Passwort auf demselben Server),
  Probe-Restore nie gemacht, 2FA nicht Pflicht, AVVs mit Dienstleistern nicht nachgewiesen, Software noch nicht neutralisiert
  (feste Personen, Verzeichnis-Startbestand nennt eine feste Person, Datenschutz-Kontakt nicht je Instanz baubar), keine Instanz-Fabrik,
  kein technisches Support-Protokoll.
- **DSFA-pflichtig** (nach dieser Analyse): Gesundheit + KI, Beschäftigten-Planung in Kunden-Instanzen, KI-Hintergrundläufe —
  daraus folgt voraussichtlich eine **DSB-Pflicht** (§ 38 BDSG).
- **KI-VO:** Art. 4 gilt schon (Schulung fehlt), Art. 50 seit 02.08.2026 (Kennzeichnung nachziehen); Delegation bleibt nur dann
  außerhalb von Hochrisiko, wenn sie keine Leistungsdaten je Person nutzt.

## Was noch zu tun ist

### [[KEVIN]] — Entscheidungen und Angaben
1. [ ] **Verantwortlichen festlegen:** welche Gesellschaft ist Verantwortlicher (eigene Instanz) bzw. Vertragspartner/Auftragsverarbeiter
       (Kunden)? Firmierung, Anschrift, Vertretung, Registerangaben; Verzeichnis vereinheitlichen (ältere Einträge nennen eine Person/Altfirmen).
2. [ ] **AVVs abschließen und ablegen:** Hetzner · Google Workspace (Datenverarbeitungszusatz in der Admin-Konsole) · Anthropic
       (DPA; **Zero-Data-Retention anfragen**) · Microsoft 365 · GitHub (Code und Vault) · Newsletter-Werkzeug (sobald gewählt).
3. [ ] **age auf dem Server einrichten** (`UPDATES.md` › „Go-Live: VOR dem Upload am Server“ Schritt 2) — danach HOI „Sicherung geprüft“ grün.
4. [ ] **Probe-Restore** einmal durchführen und in `DEPLOY.md` eintragen; danach quartalsweise.
5. [ ] **Telegram-Entscheidung:** Boten einrichten (Anmelde-Alarm, HOI-Rot aufs Handy; Gesundheitswerte nicht in Nachrichten) oder anderen Kanal.
6. [ ] **2FA-Pflicht** beschließen (alle Konten; mindestens für Kunden-Instanzen und Konten mit Gesundheitsdaten).
7. [ ] **Business-Kalender aus iCloud** vollständig nach Google Workspace (iCloud-Verbraucherkonto: kein AVV möglich).
8. [ ] Stand am Server bestätigen: Pepper gesetzt · Datenschlüssel als Datei · `MAKE_OS_FORMAT=v2` (wann) · Healthcheck-Adresse ·
       Hetzner-Standort · 2FA bei Hetzner/GitHub/Google/Microsoft/Anthropic · FileVault am Mac (Sicherungsort).
9. [ ] Rollen im Pannenprozess besetzen (`DATENPANNEN.md` › 1), Ablageort Pannen-Register und Support-Protokoll.
10. [ ] Schulung KI-Kompetenz (Art. 4) durchführen und festhalten (`KI_VO.md` K1).
11. [ ] Entscheidungen zu Code-Änderungen (nur auf Wort): Löschfrist-Text Sicherungen (A1), Kapazität entfernter Konten (A3),
        Schalter „Gesundheit an ZOE“, Delegation ohne Leistungsdaten (K9), Herkunftsfeld KI-Entwürfe (K6), Build-Args Datenschutz-Kontakt,
        neutraler Verzeichnis-Startbestand, scrypt-Parameter, 2FA-Pflicht.

### [[ANWALT]] — rechtliche Prüfung
1. [ ] **Datenschutzhinweis der Anwendung** (`DATENSCHUTZ_APP.md` › 4) und Website-Erklärung (`website/datenschutz.html`) freigeben.
2. [ ] **Interessenabwägungen:** Netzwerken (`DATENSCHUTZ_NETZWERKEN.md`), dazu neu Scoring/KI-Auswertung im CRM (`DSFA.md` DSFA-3).
3. [ ] **AVV-Vorlage** (`AVV_VORLAGE.md`): Haftung, Fristen, Kontrollrechte, Abgrenzung zur Tätigkeit als Interim Head of Sales, Einordnung Google/Microsoft.
4. [ ] **Einwilligungen:** Gesundheitsdaten + KI-Übermittlung in die USA (Art. 9 Abs. 2 lit. a, Art. 49), Erholungs-Faktor; Freiwilligkeit bei Beschäftigten.
5. [ ] **§ 26 BDSG** bzw. tragfähige Grundlage für Beschäftigtendaten (nach EuGH C-34/21), Mitbestimmung § 87 Abs. 1 Nr. 6 BetrVG bei Kunden.
6. [ ] **DSB-Pflicht** (§ 38 BDSG) bei DSFA-pflichtigen Verarbeitungen; Benennung und Meldung (Art. 37 Abs. 7).
7. [ ] DSFA-Entwürfe prüfen, DSK-Listennummern zuordnen, Restrisiko bestätigen (Art. 36).
8. [ ] KI-VO: Art. 50 Abs. 2 (Ausnahme bei menschlicher Freigabe?), Art. 6 Abs. 3/4 für die Delegation, aktueller Stand von Änderungen.
9. [ ] Aufbewahrungsfristen (6/8/10 Jahre) und „beyond use“ für Sicherungen bis 12 Monate bestätigen; Frist für Pannen-Register und Löschprotokoll.
