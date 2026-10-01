# Landingpage makeinnovation.de — MAKE Innovation GmbH

Statische Seite (HTML + eine CSS-Datei + ein kleines eigenes Skript für das Handy-Menü, keine Cookies, kein Tracking,
kein Speicher im Browser, Schriften selbst gehostet). Stand v2 (01.10.2026): neues Logo, Produkte, Markttraktion-Abschnitt.
Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
**Online geht sie erst, wenn Kevin sie gesehen und freigegeben hat** — bis dahin leiten `makeinnovation.de` und
`www.makeinnovation.de` auf `https://app.makeinnovation.de/anmelden` um (302).

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf (Logo, Abschnitte, Handy-Menü, „Anmelden“), Bühne mit sich zeichnender Bildmarke, **Produkte** (Markttraktion + Make.One aktiv mit Mail-Knopf, MAKE Innovation Development „Coming Soon“), **Markttraktion** (was es löst, Kreislauf, Traktions-Index, Bausteine, Datenschutz und Kontrolle), Über uns MA + KE, Ruf, Kontakt, Fuß |
| `impressum.html` | Pflichtangaben nach § 5 DDG für die GmbH |
| `datenschutz.html` | Hinweis passend zum tatsächlichen Verhalten (Hetzner DE, Caddy ohne Zugriffsprotokoll, keine Cookies, mailto) |
| `404.html` | Seite für unbekannte Adressen (absolute Pfade, weil sie unter jeder Adresse erscheint) |
| `css/seite.css` | CI-Tokens aus `lib/make-one/design.ts` (Look wie v1); Rot/Grün nur für MA/KE und den dünnen MAKE-Faden; Bewegung nur ohne `prefers-reduced-motion` |
| `js/menue.js` | schließt das Handy-Menü (`<details>`) nach einem Klick, mit Esc oder per Klick daneben — liest, speichert, sendet nichts |
| `assets/logo/` | Logo aus `scripts/website-logo.mjs` (nie von Hand ändern): Bildmarke, quer, kompakt, groß, hell/dunkel, Favicons — Konstruktion in `assets/logo/LOGO.md` |
| `logo-entwuerfe.html` | drei Logo-Entwürfe zur Auswahl (Arbeitsdatei, wird nie ausgeliefert) |
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
   Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite, Anmelden-Knopf, Impressum- und
   Datenschutz-Link, alle eigenen Links und Anker — dazu: Skripte nur aus `js/` und ohne Speichern/Senden, Logo-Dateien
   vollständig, Bühnen-Zeichen = `assets/logo/bildmarke.svg`, Produkte (genau ein „Coming Soon“, bei Development),
   **Sperrliste**: keine anderen Firmen-, Marken- oder Projektnamen auf der Seite (nur MAKE), Wortregeln (kein
   „Dashboard“, „Tool“, „Reporting“, „Disruption“, „einfach zu bedienen“).
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

## Offene Platzhalter (Stand 01.10.2026)

- **Impressum:** Straße/Hausnummer · PLZ/Ort · Geschäftsführung (Vor- und Nachnamen) · Telefonnummer · Registergericht ·
  HRB-Nummer · USt-IdNr. (oder Abschnitt streichen)
- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · E-Mail-Anbieter für `hello@makeinnovation.de` (Name, Sitz, AV-Vertrag) ·
  eigener Datenschutzhinweis der App unter `app.makeinnovation.de` (gibt es heute noch nicht — anlegen oder Satz anpassen)
- **Startseite:** Make.One — für wen ist es, und wie kommt man hinein (Einladung, Empfehlung, Anfrage)? · ein Satz zu
  MAKE Innovation Development

## Bitte zusätzlich prüfen (kein Platzhalter, aber Kevins Entscheidung)

- Impressum › Verbraucherstreitbeilegung: der Satz „nicht bereit und nicht verpflichtet …“ ist die übliche Fassung —
  bestätigen oder streichen.
- Gründer-Texte stammen aus `homepage/quelle/teile/founder.html` (Kevins Worte, 27.09.). Ohne Fotos — Initialen in
  Personenfarbe. Fotos nur, wenn ihr sie freigebt (dann als Datei in `assets/`, `img-src 'self'` erlaubt das).
- Die Seite nennt keine Preise, Kundenzahlen oder Versprechen — bewusst. Die Prozentzahlen im Traktions-Index sind die
  Gewichte aus `lib/crm/traktion.ts` (Sales 50 · Marketing 40 · Events 10), keine Ergebnisse; die Funktionen im
  Markttraktion-Abschnitt stehen so in der Software (Kartei, Follow-up, Kanal-Ampel, Einwilligung mit Nachweis,
  Double-Opt-in, Art. 15/17/18).
- Anrede bleibt „du“ wie in v1 und den Rechtstexten. Für ein B2B-Angebot ginge auch „Sie“ — Kevins Entscheidung.
- Logo-Entwurf: auf der Seite A „Fuge“; B und C in `logo-entwuerfe.html`.

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind nach bestem Wissen aus dem tatsächlichen
> Verhalten der Seite und des Servers abgeleitet (Stand Oktober 2026: § 5 DDG, DSGVO, TDDDG; die frühere Pflicht zum
> Link auf die EU-OS-Plattform ist mit deren Abschaltung im Juli 2025 entfallen). Vor der Freigabe von einer
> fachkundigen Person prüfen lassen.
