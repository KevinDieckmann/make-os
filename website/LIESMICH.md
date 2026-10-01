# Landingpage makeinnovation.de — MAKE Innovation GmbH

Statische Seite (HTML + eine CSS-Datei, **kein JavaScript**, keine Cookies, kein Tracking, Schriften selbst gehostet).
Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
**Online geht sie erst, wenn Kevin sie gesehen und freigegeben hat** — bis dahin leiten `makeinnovation.de` und
`www.makeinnovation.de` auf `https://app.makeinnovation.de/anmelden` um (302).

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf mit Logo + „Anmelden“, Bühne, Was wir machen (3 Punkte), Gründer MA + KE, Kontakt (mailto), Fuß |
| `impressum.html` | Pflichtangaben nach § 5 DDG für die GmbH |
| `datenschutz.html` | Hinweis passend zum tatsächlichen Verhalten (Hetzner DE, Caddy ohne Zugriffsprotokoll, keine Cookies, mailto) |
| `404.html` | Seite für unbekannte Adressen (absolute Pfade, weil sie unter jeder Adresse erscheint) |
| `css/seite.css` | CI-Tokens aus `lib/make-one/design.ts`; Granat/Smaragd nur für MA/KE |
| `assets/fonts/` | Archivo + Public Sans (SIL Open Font License, selbst gehostet — keine Google-Fonts-Anfrage) |
| `favicon.svg` | Logo F (zwei Striche, MA Granat + KE Smaragd), aus `homepage/` |
| `pruefen.mjs` | Freigabe-Prüfung (wird nie ausgeliefert) |

Lokal ansehen: `python3 -m http.server 3013 -d website` über einen Eintrag in `.claude/launch.json` (nicht per Bash),
oder die HTML-Datei direkt im Browser öffnen.

## Freigabe — in dieser Reihenfolge

1. **Platzhalter füllen.** Jeder offene Wert steht gelb markiert als `<span class="ph">[[KEVIN: …]]</span>` in der Seite.
   Beim Füllen das **ganze** `<span class="ph">…</span>` durch den Text ersetzen (sonst bleibt die gelbe Markierung —
   die Prüfung meldet das). Abschnitte, die nicht zutreffen (z. B. USt-IdNr.), ganz streichen.
2. **Prüfen:** `node website/pruefen.mjs` → muss **„freigabefähig“** melden (Ausgang 0). Er prüft außerdem: keine
   Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite, Anmelden-Knopf, Impressum- und
   Datenschutz-Link, alle eigenen Links und Anker.
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
- **Startseite:** ein Satz zum Angebot der GmbH (nutzt ihr MAKE OS nur selbst, oder bietet ihr es bzw. Begleitung schon
  anderen an?) — sonst Zeile streichen

## Bitte zusätzlich prüfen (kein Platzhalter, aber Kevins Entscheidung)

- Impressum › Verbraucherstreitbeilegung: der Satz „nicht bereit und nicht verpflichtet …“ ist die übliche Fassung —
  bestätigen oder streichen.
- Gründer-Texte stammen aus `homepage/quelle/teile/founder.html` (Kevins Worte, 27.09.). Ohne Fotos — Initialen in
  Personenfarbe. Fotos nur, wenn ihr sie freigebt (dann als Datei in `assets/`, `img-src 'self'` erlaubt das).
- Die Bühne nennt keine Preise, Kundenzahlen oder Versprechen — bewusst (Preise in `homepage/` sind unbestätigt).

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind nach bestem Wissen aus dem tatsächlichen
> Verhalten der Seite und des Servers abgeleitet (Stand Oktober 2026: § 5 DDG, DSGVO, TDDDG; die frühere Pflicht zum
> Link auf die EU-OS-Plattform ist mit deren Abschaltung im Juli 2025 entfallen). Vor der Freigabe von einer
> fachkundigen Person prüfen lassen.
