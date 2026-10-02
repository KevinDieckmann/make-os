# Landingpage makeinnovation.de — MAKE Innovation GmbH

Statische Seite (HTML + eine CSS-Datei + zwei kleine eigene Skripte, keine Cookies, kein Tracking, kein Speicher im
Browser, Schriften selbst gehostet). Stand v3 (01.10.2026): neue Positionierung — „Wir wollen Innovation in Deutschland
fördern — deshalb haben wir das Make.One-Netzwerk gegründet.“ Angebot: **Markttraktion**. Der Name der Software steht
bewusst nirgends auf der Seite (erst, wenn sie marktreif ist); oben rechts nur ein kleiner Knopf „Login“.
Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
**Online geht sie erst, wenn Kevin sie gesehen und freigegeben hat** — bis dahin leiten `makeinnovation.de` und
`www.makeinnovation.de` auf `https://app.makeinnovation.de/anmelden` um (302).

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf (Logo, Navigation Markttraktion · Make.One · Make.Beteiligungen · Über uns · Kontakt, Handy-Menü, „Login“), Bühne „Innovation in Deutschland fördern“ mit sich einzeichnender Wortmarke (zwei Personenstriche), **Für wen** (KI- & Tech-Startups, Scale-ups, Corporates/Innovationseinheiten), **Markttraktion** (drei gleichwertige Karten: Interim CSO · Interim Head of Sales · Events & Netzwerk; darunter MAKE Innovation Development „Coming Soon“), **So arbeiten wir** (Analyse → Aufbau → Skalierung), **Make.One** (Einladung anfragen), **Make.Beteiligungen** (Projekt einreichen), Über uns MA + KE, **Erstgespräch** (`#erstgespraech`, vorbereitete Mail), Kontakt, Fuß |
| `impressum.html` | Pflichtangaben nach § 5 DDG für die GmbH |
| `datenschutz.html` | Hinweis passend zum tatsächlichen Verhalten (Hetzner DE, Caddy ohne Zugriffsprotokoll, keine Cookies, mailto) |
| `404.html` | Seite für unbekannte Adressen (absolute Pfade, weil sie unter jeder Adresse erscheint) |
| `css/seite.css` | CI-Tokens aus `lib/make-one/design.ts` (Look wie v1); Rot/Grün nur für MA/KE und den dünnen MAKE-Faden; Bewegung nur ohne `prefers-reduced-motion` |
| `js/menue.js` | schließt das Handy-Menü (`<details>`) nach einem Klick, mit Esc oder per Klick daneben — liest, speichert, sendet nichts |
| `js/erstgespraech.js` | übernimmt das Ziel aus `#erstgespraech-link` für alle Knöpfe mit `data-erstgespraech` (ohne Skript zeigen sie auf `#erstgespraech`) — liest, speichert, sendet nichts |
| `assets/logo/` | Logo aus `scripts/website-logo.mjs` (nie von Hand ändern): Wortmarke (MAKE · roter Strich unter MA, grüner unter KE · INNOVATION), quer, kompakt, groß, Visitenkarten-Logo, hell/dunkel; Favicons/Kachel vorläufig noch die M-Bildmarke (Logo wird später überarbeitet) — Konstruktion in `assets/logo/LOGO.md` |
| `logo-entwuerfe.html` | Logo-Übersicht aller Fassungen (Arbeitsdatei, wird nie ausgeliefert) |
| `assets/fonts/` | Archivo + Public Sans (SIL Open Font License, selbst gehostet — keine Google-Fonts-Anfrage) |
| `favicon.svg` | App-Kachel des neuen Logos (= `assets/logo/kachel.svg`) |
| `pruefen.mjs` | Freigabe-Prüfung (wird nie ausgeliefert) |

Lokal ansehen: `python3 -m http.server 3013 -d website` über einen Eintrag in `.claude/launch.json` (nicht per Bash),
oder die HTML-Datei direkt im Browser öffnen. Logo ändern: `node scripts/website-logo.mjs` (Bühnen-Block mit `--buehne`).

## Freigabe — in dieser Reihenfolge

1. **Platzhalter füllen.** Jeder offene Wert steht gelb markiert als `<span class="ph">[[KEVIN: …]]</span>` in der Seite.
   Beim Füllen das **ganze** `<span class="ph">…</span>` durch den Text ersetzen (sonst bleibt die gelbe Markierung —
   die Prüfung meldet das). Abschnitte, die nicht zutreffen (z. B. USt-IdNr.), ganz streichen.
2. **Prüfen:** `node website/pruefen.mjs` → muss **„freigabefähig“** melden (Ausgang 0). Er prüft außerdem: keine
   Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite, Login-Knopf, Impressum- und
   Datenschutz-Link, alle eigenen Links und Anker — dazu: Skripte nur aus `js/` und ohne Speichern/Senden, Logo-Dateien
   vollständig, Bühnen-Zeichen = `assets/logo/wortmarke.svg`, Navigation, Angebote (drei mit „Erstgespräch anfragen“, genau
   ein „Coming Soon“ bei Development), Mail-Knöpfe Make.One/Make.Beteiligungen, **Ziel des Erstgesprächs an genau einer Stelle**
   (`#erstgespraech-link`: vorbereitete Mail oder Buchungsseite mit gültigem Slug), **keine Preise**, **Sperrliste**: keine anderen Firmen-, Marken- oder
   Projektnamen (nur MAKE), der Name der Software nirgends im Ordner, Wortregeln (kein „Dashboard“, „Tool“,
   „Reporting“, „Disruption“, „einfach zu bedienen“).
3. **Kevin sieht die Seite lokal an** und gibt sie ausdrücklich frei.
4. **Caddyfile umstellen** (`deploy/caddy/Caddyfile`): den Block „VORERST“ (`makeinnovation.de, www.makeinnovation.de`
   mit `redir … 302`) löschen und die **FREIGABE-FASSUNG** zwischen `▼` und `▲` entkommentieren (nur das führende `# `
   entfernen). `npx vitest run tests/caddy-buchung-koepfe.test.ts` — der Test lässt die aktive Freigabe-Fassung nur
   zu, wenn `pruefen.mjs` grün ist (sonst schlägt die CI fehl und nichts wird ausgerollt).
5. **Hochladen nur auf Kevins Wort** (wie immer: `entwicklung` → `main`). Danach auf dem Server einmal
   `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` und
   `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` (Caddy lädt eine geänderte Caddyfile nicht
   von selbst). Prüfen: `curl -sI https://makeinnovation.de` → 200 mit `content-security-policy`,
   `curl -sI https://www.makeinnovation.de` → 301 auf `https://makeinnovation.de/`.

## Offene Platzhalter (Stand 01.10.2026, v3)

- **Startseite:** ein Satz zu Kevins Vertriebserfahrung (Über uns, ohne Kundennamen)

## Später auf Buchungsseite umstellen

Hauptweg ist vorerst **„Erstgespräch anfragen“ → vorbereitete Mail** an `hello@makeinnovation.de` (Betreff
„Erstgespräch – Markttraktion“, Text: Firma, worum es geht, 2–3 Terminvorschläge), weil die Buchungsseite der Software
noch nicht so weit ist. Das Ziel steht an **genau einer Stelle**: `index.html`, Knopf `id="erstgespraech-link"`
(Abschnitt „Erstgespräch“). Alle anderen Knöpfe tragen `data-erstgespraech` und übernehmen es über `js/erstgespraech.js`.
**Umstellen:** nur dieses eine `href` durch `https://app.makeinnovation.de/buchen/<slug>` ersetzen (Slug der
Buchungsseite, Form `name-<24 Hex-Zeichen>`), dann `node website/pruefen.mjs`. Dazu im Datenschutzhinweis einen
Abschnitt „Termin buchen“ ergänzen (Buchungsseite unter app.makeinnovation.de, verarbeitet Name, E-Mail, ggf. Firma und
Anliegen, eigener Hinweis vor dem Absenden) und im Abschnitt „Cookies und Speicher“ den Satz zum Skript anpassen.

## Offene Platzhalter — Rechtstexte

- **Impressum:** Straße/Hausnummer · PLZ/Ort · Geschäftsführung (Vor- und Nachnamen) · Telefonnummer · Registergericht ·
  HRB-Nummer · USt-IdNr. (oder Abschnitt streichen)
- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · E-Mail-Anbieter für `hello@makeinnovation.de` (Name, Sitz, AV-Vertrag) ·
  eigener Datenschutzhinweis der App unter `app.makeinnovation.de` (gibt es heute noch nicht — anlegen oder Satz anpassen)

## Bitte zusätzlich prüfen (kein Platzhalter, aber Kevins Entscheidung)

- Impressum › Verbraucherstreitbeilegung: der Satz „nicht bereit und nicht verpflichtet …“ ist die übliche Fassung —
  bestätigen oder streichen.
- **Make.Beteiligungen:** bewusst vorsichtig formuliert („Kooperation oder Beteiligung im Einzelfall“, Hinweis „keine
  Anlageberatung, kein Finanzierungsangebot, keine Rendite- oder Finanzierungszusage“). Vor der Freigabe juristisch
  gegenlesen lassen.
- Die Seite nennt keine Preise, Kundennamen, Kundenzahlen oder Erfolgsversprechen — bewusst. Die Fakten zu den Mandaten
  (ca. 2 Tage pro Woche, wöchentliche Calls, 6–12 Monate, Make.One-Zugang beim Interim CSO) sind Kevins Vorgaben vom 01.10.
- Die Make.One-Formate (Stammtisch, Dinner, Workshop, Webinar) haben je einen allgemeinen Satz, keine Termine oder Orte.
- Gründer-Texte: MAKE = Malin + Kevin, Malins Zeile aus v2 (Kevins Worte, 27.09.). Ohne Fotos — Initialen in
  Personenfarbe. Fotos nur, wenn ihr sie freigebt (dann als Datei in `assets/`, `img-src 'self'` erlaubt das).
- Anrede „du“ (bzw. „ihr“ für Teams) wie in den Rechtstexten.

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind nach bestem Wissen aus dem tatsächlichen
> Verhalten der Seite und des Servers abgeleitet (Stand Oktober 2026: § 5 DDG, DSGVO, TDDDG; die frühere Pflicht zum
> Link auf die EU-OS-Plattform ist mit deren Abschaltung im Juli 2025 entfallen). Vor der Freigabe von einer
> fachkundigen Person prüfen lassen.
