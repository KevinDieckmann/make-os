# Kunden-Instanz datenschutzkonform aufsetzen — Checkliste

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Stand 05.10.2026. Heute gibt es **noch keine Kunden-Instanz** und keine
> Instanz-Fabrik (`PLATTFORM_PLAN.md` › Paket 4) — jeder Schritt ist Handarbeit. Diese Liste wird je Kunde kopiert, ausgefüllt
> und als **Onboarding-Protokoll** (gilt als Weisung, AVV § 3 Abs. 3) zur Kundenakte gelegt — **nicht ins Repo**.

Kunde: ‹Firma› · Instanz: ‹kennung› · Domain: ‹instanz-domain› · Edition: ‹Markttraktion | komplett› · Datum: ‹…› · Bearbeitet von: ‹…›

---

## A · Tore — vorher muss es geben (einmalig, nicht je Kunde)

- [ ] **Software neutralisiert** (Paket 1): keine festen Personen-/Firmen-Kennungen, keine Rückfälle auf eine feste Person, keine
      persönlichen Inhalte im Code (`TOM.md` L15). Bis dahin: nur Test-/Demo-Instanzen mit erfundenen Daten.
- [ ] **Verzeichnis-Startbestand neutral:** die ältesten Verzeichnis-Einträge (`verarbeitungenStart` in `lib/crm/datenschutz.ts`)
      nennen eine **fest eingetragene Person/Altfirmen** als Verantwortlichen — in einer Kunden-Instanz falsch. Muss aus der
      Instanz-Einstellung kommen. (Code-Änderung, auf Wort)
- [ ] **Datenschutz-Kontakt je Instanz baubar:** `NEXT_PUBLIC_MAKE_DATENSCHUTZ_MAIL`/`…_SEITE` wirken nur beim Bau; das `Dockerfile`
      reicht bisher nur `NEXT_PUBLIC_MAKE_OS_EINHEITEN` und `NEXT_PUBLIC_MAKE_OS_CRM_TEAM` als Build-Argumente durch. Ohne Ergänzung
      nennen Art.-13-Hinweise (Danke-Mail, Buchung) den **Kontakt von MAKE** statt des Kunden. (Code-Änderung, auf Wort)
- [ ] **2FA-Pflicht** je Instanz einstellbar (`TOM.md` L3).
- [ ] **AVVs mit den Unterauftragsverarbeitern** abgeschlossen und abgelegt (`AVV_VORLAGE.md` › Anlage 2).
- [ ] **age** für Sicherungen eingerichtet und **Probe-Restore** einmal bestanden (`TOM.md` L1/L2).
- [ ] AVV-Vorlage, Datenschutzhinweis der Anwendung, DSFA-Entwürfe **anwaltlich geprüft**.
- [ ] Support-Protokoll und Pannen-Register haben einen Ablageort (`AVV_VORLAGE.md` › Anlage 3, `DATENPANNEN.md` › 8).

## B · Vertrag

- [ ] Hauptvertrag (Lizenz: Edition, Module, Plätze, Laufzeit) unterschrieben.
- [ ] **AVV** (`AVV_VORLAGE.md`) ausgefüllt und von beiden Seiten unterschrieben; Datenarten in § 2 Abs. 3 angekreuzt.
- [ ] **Verantwortlicher** eingetragen (Firma, Anschrift, Vertretung) und **weisungsberechtigte Personen** benannt (§ 3 Abs. 2).
- [ ] Datenschutzbeauftragter des Kunden (falls vorhanden) und Kontakt für Datenpannen (Telefon, 24/7?) notiert.
- [ ] Anlage 2: welche optionalen Dienste schaltet der Kunde ein? (KI ja/nein, Google/Microsoft ja/nein, Telegram **nein**).
- [ ] Kunde hat Betriebsrat? → Hinweis Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG) bei Kapazität/Fokus-Messung (`DSFA.md` › DSFA-2).
- [ ] DSFA-Entwürfe (`DSFA.md`) an den Kunden übergeben, falls Gesundheit, Kapazität/Fokus oder KI-Hintergrundläufe genutzt werden.

## C · Instanz technisch (eigene Instanz, nie ein Konto auf der Inhaber-Instanz)

- [ ] **Eigener Container** (App + Arbeiter) mit eigenem Compose-Projekt; Speichergrenzen passend zum Server.
- [ ] **Eigener Datenordner** `/srv/<instanz>/daten`, **eigener Grabstein-Ordner** `/srv/<instanz>/grabsteine` (0700, Besitzer App-Nutzer),
      eigener Vault-Ordner (falls Brain genutzt) — **nicht** auf GitHub ohne gesonderte Vereinbarung.
- [ ] **Eigener Datenschlüssel** (`openssl rand -hex 32`, im eigenen Terminal) als **Datei** `schluessel/daten` (0400), nicht in der `.env`.
- [ ] **Eigener Pepper** (`MAKE_OS_PEPPER`), nie wechseln.
- [ ] **Eigene age-Identität** für die Sicherungen; nur der öffentliche Schlüssel auf den Server; optional zweiter Empfänger = Kunde.
- [ ] Schlüssel in den **Passwort-Manager-Tresor des Kunden** bei MAKE + Papier (Anlage 3); Zugriff nur benannte Personen.
- [ ] `MAKE_OS_FORMAT=v2` (neue Instanz braucht keinen Rückweg zum Altformat).
- [ ] **Eigene Domain** (`MAKE_OS_DOMAIN`, `MAKE_OS_ADRESSE`), TLS über Caddy, HSTS; Sicherheits-Köpfe unverändert.
- [ ] Eigene Geheimnisse: `MAKE_OS_KEY`, `SESSION_SECRET`, `MAKE_OS_KEY_HOI` — nie von einer anderen Instanz übernehmen.
- [ ] **Sicherung:** Cron `sicherung.sh` mit eigenem Basis-Ordner, Generationen 14/8/12, **eigener Healthcheck**, Abholung an den
      Sicherungsort von MAKE (eigener Abhol-Schlüssel mit Forced Command), Hoster-Abbilder an.
- [ ] Head of IT: Sicherung grün mit age, Verschlüsselung im Ruhezustand grün, Pepper gesetzt, Schreibformat v2.
- [ ] **Support-SSH-Schlüssel** je Person für diese Instanz; keine Sammelschlüssel.
- [ ] Build-Argumente gesetzt: `NEXT_PUBLIC_MAKE_OS_EINHEITEN` (Name(n) der Gesellschaft(en) des **Kunden** — daraus liest das
      Verzeichnis den Verantwortlichen), `NEXT_PUBLIC_MAKE_OS_CRM_TEAM`, Datenschutz-Kontakt (siehe A).
- [ ] Leerer Start geprüft (Instanz startet sauber ohne Bestände) — oder auf Wunsch Beispieldaten (nie echte Daten anderer Kunden).

## D · Einstellungen in der Instanz (mit dem Kunden zusammen)

**Konten und Rollen**
- [ ] Erstes Konto = **Inhaber** des Kunden (Einladungs-Code), weitere per Einladung; Rollen `inhaber`/`mitglied`, Finanzrecht `business`
      für Personen ohne Privatzugang.
- [ ] **2FA** für alle Konten eingeschaltet (bis zur Pflicht: im Protokoll vermerken, wer ohne 2FA arbeitet).
- [ ] Kein Konto für MAKE in der Instanz (Support nach Anlage 3), außer der Kunde weist es ausdrücklich an — dann befristet.

**KI-Schalter (Vorgaben für Kunden-Instanzen)**
| Schalter | Vorgabe | Wo | Kunde wählt |
|---|---|---|---|
| KI insgesamt | **aus**, bis AVV mit dem KI-Anbieter zum Kunden passt | `ANTHROPIC_API_KEY` leer = aus | ☐ an ☐ aus |
| KI-Hintergrundläufe (Heads, Tagesstart, Inbox-Einstufung, Research, Delegation) | aus | Agenten-Schalter (`/os/agenten`, `agents-config`) | je Lauf ☐ |
| Gesundheit an ZOE | **aus** (Schalter noch zu bauen, `DSFA.md` DSFA-1 M1) | — | ☐ |
| Erholungs-Faktor in der Kapazität | **nicht für Beschäftigte** (DSFA-1 M4) | Einwilligung nur durch die Person | ☐ |
| KI-Abschrift Sprachnotizen | aus | `TRANSKRIPTION_AN` | ☐ |
| Embeddings (Brain-Suche) | lokal, kein Dritter | `MAKE_OS_EMBEDDINGS` | ☐ |
| _App-Spiegel in den Vault | aus | `MAKE_OS_APP_SPIEGEL` | ☐ |
| Telegram | **aus** | `TELEGRAM_BOT_TOKEN` leer | — |

**Module und Fristen**
- [ ] Nur freigeschaltete Module sichtbar (Lizenz/Modul-Schalter — Paket 3, noch nicht gebaut: bis dahin im Protokoll festhalten).
- [ ] Kapazität / Fokus-Messung für Beschäftigte: ☐ an ☐ aus (Vorgabe aus, `DSFA.md` DSFA-2 M1).
- [ ] **Löschfristen** mit dem Kunden durchgehen (Stammdaten › Datenschutz; `LOESCHKONZEPT.md`) — Abweichungen vom Standard im Protokoll.
- [ ] **Verzeichnis (Art. 30)** in der Instanz prüfen: Verantwortlicher = Kunde, Empfänger/Drittland passend zu den eingeschalteten Diensten.
- [ ] **Datenschutzhinweise** des Kunden: Hinweis für Nutzer/Beschäftigte, Art.-13-Block der Danke-Mail und der Buchungsseite
      nennen den Kunden (Kontakt aus A).
- [ ] Verbundene Dienste (Google Workspace/Microsoft 365 **des Kunden**) — der Kunde verbindet selbst, mit seinem Vertrag.
- [ ] Apple iCloud für Geschäftliches: **nicht** empfehlen (kein AVV).

## E · Vertragsende (Rückgabe und Löschung, AVV § 11)

- [ ] Kündigung/Ende erfasst; Frist zur Wahl Rückgabe ‹Datum›.
- [ ] Lizenz auf „nur lesen“ (kein Sperren, kein Löschen vor der Rückgabe — Kunde behält Zugriff/Export).
- [ ] **Export** (seit 05.10. ein Klick, Paket „Betroffenenrechte v2“): der Inhaber des Kunden unter **System › Datenschutz › Vertragsende**
      → „Alles exportieren“ (Passwort + zweiter Faktor) = EINE JSON-Datei mit allen Beständen, Dateien und Bildern, entschlüsselt
      (`/api/datenschutz/instanz-export`, nur Inhaber-Sitzung, steht im Lese- und Anmeldeprotokoll). Die Datei sofort verschlüsselt
      weitergeben (age-Empfänger des Kunden oder Passwort getrennt übermittelt) und danach löschen. Zusätzlich auf Wunsch die CSV-Exporte.
- [ ] Übergabe bestätigt vom Kunden ‹Datum›.
- [ ] **Löschung der Instanz** — nie aus der App, nie automatisch: App anhalten, dann auf dem Server
      `node scripts/instanz-loeschen.mjs --ordner <Datenordner der Instanz>` (**Trockenlauf**: zeigt Umfang, Grabstein-Ordner, die Nachtarchive
      mit dem Tag, an dem sie spätestens überschrieben sind, und einen **Bestätigungs-Code**, der nur heute und nur für diesen Stand gilt) →
      `… --ausfuehren --code <CODE> --bericht loeschbestaetigung.txt` löscht Datenordner (inkl. Tagessicherungen und Archiv-Kopien) und
      Grabstein-Ordner und schreibt den Entwurf der Löschbestätigung. Das Skript bricht ab, wenn eine App den Ordner hält, und fasst nie `.data` an.
- [ ] Danach von Hand: Container/Volumes, Vault, Nachtarchive Server und Sicherungsort MAKE (alle Generationen — oder Ablauf ≤ 12 Monate
      abwarten und das so in die Bestätigung schreiben), Schlüssel (Daten, Pepper, age) aus dem Passwort-Manager (= Restkopien unlesbar),
      Support-SSH-Schlüssel, DNS, Healthcheck, Hoster-Abbilder (oder Ablauf 7 Tage).
- [ ] Temporäre Export-Ordner gelöscht.
- [ ] **Löschbestätigung** (Vorlage `AVV_VORLAGE.md` § 11 Abs. 4) an den Kunden ‹Datum›.

## F · Regelmäßig während der Laufzeit

- [ ] Quartalsweise Probe-Restore der Kunden-Instanz (Ergebnis an den Kunden auf Anfrage).
- [ ] Änderungen an Unterauftragsverarbeitern mit Frist ankündigen (AVV § 6 Abs. 2).
- [ ] TOM-Änderungen mitteilen (AVV § 5 Abs. 2).
- [ ] Support-Zugriffe protokollieren und berichten (Anlage 3).
