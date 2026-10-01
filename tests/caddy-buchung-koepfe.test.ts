// ─── Upload U1 N1 (29.09.): Caddy überschreibt die strengen Köpfe der Buchungsseite nicht mehr ─
// Die App setzt für /buchen… und /api/buchung… `Referrer-Policy: no-referrer` und eine Permissions-Policy ohne
// Kamera/Mikrofon (next.config.mjs). Caddy setzte früher für ALLE Pfade die allgemeinen Werte und überschrieb sie.
// Geprüft wird der Text der Caddyfile (Caddy selbst läuft nur auf dem Server).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8').split('\n').filter(z => !z.trim().startsWith('#')).join('\n');
const nextKonfig = readFileSync('next.config.mjs', 'utf8');

describe('Caddyfile: Referrer-/Permissions-Policy', () => {
  it('allgemein nur als Vorgabe („?“) — nie ein harter Überschreiber', () => {
    expect(caddy).toMatch(/^\s*\?Referrer-Policy strict-origin-when-cross-origin$/m);
    expect(caddy).toMatch(/^\s*\?Permissions-Policy /m);
    expect(caddy).not.toMatch(/^\s*Referrer-Policy strict-origin-when-cross-origin$/m);
  });
  it('Buchungspfade: dieselben strengen Werte wie die App', () => {
    expect(caddy).toMatch(/@buchung path \/buchen \/buchen\/\* \/api\/buchung \/api\/buchung\/\*/);
    const block = /header @buchung \{([\s\S]*?)\}/.exec(caddy)?.[1] ?? '';
    expect(block).toMatch(/Referrer-Policy no-referrer/);
    const pp = /Permissions-Policy "([^"]+)"/.exec(block)?.[1];
    expect(pp).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(nextKonfig).toContain(`{ key: 'Permissions-Policy', value: '${pp}' }`);
    expect(nextKonfig).toContain("{ key: 'Referrer-Policy', value: 'no-referrer' }");
  });
});

// ─── Domain makeinnovation.de (01.10.) ──────────────────────────────────────────────────────────────────────────
// Software zusätzlich unter app.makeinnovation.de — über die Server-.env (MAKE_OS_DOMAIN als kommagetrennte Liste,
// sslip bleibt Rückfall), NICHT als zweite Adresse im Block. makeinnovation.de + www leiten VORERST
// auf die Anmeldung um; die Freigabe-Fassung (Landingpage aus /srv/website) steht kommentiert darunter und wird hier
// schon mitgeprüft. Aktiv werden darf sie nur, wenn website/pruefen.mjs „freigabefähig“ meldet.
import { pruefeWebsite } from '../website/pruefen.mjs';
import { join } from 'node:path';

const roh = readFileSync('deploy/caddy/Caddyfile', 'utf8');

/** Oberste Blöcke einer Caddyfile (Kopfzeile → Inhalt). Stil wie im Repo: „{“ am Zeilenende, „}“ allein. */
function bloecke(text: string): Map<string, string> {
  const raus = new Map<string, string>();
  let kopf: string | null = null; let tiefe = 0; let inhalt: string[] = [];
  for (const zeile of text.split('\n')) {
    const z = zeile.trim();
    if (!z || z.startsWith('#')) continue;
    if (tiefe === 0) {
      if (!z.endsWith('{')) continue;
      kopf = z.slice(0, -1).trim(); tiefe = 1; inhalt = []; continue;
    }
    if (z.endsWith('{')) tiefe++;
    if (z === '}') tiefe--;
    if (tiefe === 0) { raus.set(kopf!, inhalt.join('\n')); kopf = null; continue; }
    inhalt.push(z);
  }
  return raus;
}
/** Die kommentierte Freigabe-Fassung, entkommentiert (nur das führende „# “ fällt weg). */
function freigabeFassung(): string {
  const a = roh.indexOf('# ▼ FREIGABE-FASSUNG'); const b = roh.indexOf('# ▲ FREIGABE-FASSUNG');
  expect(a).toBeGreaterThan(-1); expect(b).toBeGreaterThan(a);
  return roh.slice(a, b).split('\n').slice(1).map(z => z.replace(/^# ?/, '')).join('\n');
}
const aktiv = bloecke(caddy);
const freigabeAktiv = Array.from(aktiv.values()).some(b => b.includes('root * /srv/website'));
const LANDING_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

describe('Caddyfile: Domain makeinnovation.de', () => {
  it('Software-Block: nur {$MAKE_OS_DOMAIN} (die .env trägt app.makeinnovation.de + sslip) — Köpfe und Buchungsweg unverändert', () => {
    const app = aktiv.get('{$MAKE_OS_DOMAIN}');
    expect(app, 'Software-Block').toBeDefined();
    expect(app).toMatch(/^Strict-Transport-Security "max-age=31536000; includeSubDomains"$/m);
    expect(app).toMatch(/^X-Content-Type-Options nosniff$/m);
    expect(app).toMatch(/^Cross-Origin-Opener-Policy same-origin$/m);
    expect(app).toMatch(/^\?Referrer-Policy strict-origin-when-cross-origin$/m);
    expect(app).toMatch(/^@buchung path \/buchen \/buchen\/\* \/api\/buchung \/api\/buchung\/\*$/m);
    expect(app).toMatch(/^header @buchung \{$/m);
    expect(app).toMatch(/^reverse_proxy app:3000$/m);
    // Die App setzt ihre CSP selbst — Caddy darf sie für die Software nicht überschreiben.
    expect(app).not.toMatch(/Content-Security-Policy/);
  });

  it('keine Adresse doppelt (sonst startet Caddy nicht): app.makeinnovation.de steht nur in MAKE_OS_DOMAIN', () => {
    const adressen = Array.from(aktiv.keys()).filter(k => !k.startsWith('(')).flatMap(k => k.split(',').map(a => a.trim()));
    expect(new Set(adressen).size).toBe(adressen.length);
    expect(adressen).not.toContain('app.makeinnovation.de');
    // Die Hauptdomain hat ihren eigenen Block — in MAKE_OS_DOMAIN darf sie nie stehen (Beispiel-.env als Vorlage).
    const domain = /^MAKE_OS_DOMAIN=(.*)$/m.exec(readFileSync('deploy/env.server.beispiel', 'utf8'))?.[1] ?? '';
    const liste = domain.replace(/"/g, '').split(',').map(a => a.trim());
    expect(liste).not.toContain('makeinnovation.de');
    expect(liste).not.toContain('www.makeinnovation.de');
  });

  it('Hauptdomain: VORERST 302 auf die Anmeldung — oder die Freigabe-Fassung, dann nur mit grüner Prüfung', () => {
    if (!freigabeAktiv) {
      const vorerst = aktiv.get('makeinnovation.de, www.makeinnovation.de');
      expect(vorerst, 'Umleitungs-Block').toBeDefined();
      expect(vorerst).toMatch(/^redir https:\/\/app\.makeinnovation\.de\/anmelden 302$/m);
      expect(vorerst).not.toMatch(/file_server|root /);
      expect(vorerst).toMatch(/^Strict-Transport-Security "max-age=31536000"$/m);
    } else {
      const { fehler, platzhalter } = pruefeWebsite(join(process.cwd(), 'website'));
      expect(fehler, fehler.join('\n')).toEqual([]);
      expect(platzhalter.map(p => `${p.datei}:${p.zeile} ${p.text}`), 'Landingpage aktiv, aber nicht freigabefähig').toEqual([]);
    }
  });

  it('Freigabe-Fassung (kommentiert oder aktiv): www → 301, Landingpage read-only mit strengen Köpfen', () => {
    const f = freigabeAktiv ? aktiv : bloecke(freigabeFassung());
    const www = f.get('www.makeinnovation.de');
    expect(www).toMatch(/^redir https:\/\/makeinnovation\.de\{uri\} 301$/m);
    const seite = f.get('makeinnovation.de') ?? '';
    expect(seite).toMatch(/^root \* \/srv\/website$/m);
    expect(seite).toMatch(/^encode zstd gzip$/m);
    expect(seite).toMatch(/^import landingpage_koepfe$/m);
    expect(seite).toMatch(/^hide LIESMICH\.md pruefen\.mjs$/m);
    expect(seite).toMatch(/^respond @intern 404$/m);
    expect(seite).toMatch(/^header @seiten Cache-Control "no-cache"$/m);
    expect(seite).not.toMatch(/reverse_proxy|browse/);
    const koepfe = f.get('(landingpage_koepfe)') ?? '';
    expect(/Content-Security-Policy "([^"]+)"/.exec(koepfe)?.[1]).toBe(LANDING_CSP);
    expect(koepfe).toMatch(/^Strict-Transport-Security "max-age=31536000"$/m);
    expect(koepfe).toMatch(/^X-Content-Type-Options nosniff$/m);
    expect(koepfe).toMatch(/^Referrer-Policy strict-origin-when-cross-origin$/m);
    expect(/Permissions-Policy "([^"]+)"/.exec(koepfe)?.[1]).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    expect(koepfe).toMatch(/^X-Frame-Options DENY$/m);
    // Die Köpfe gelten auch für die 404-Seite (eigene Route-Kette).
    expect(seite).toMatch(/handle_errors \{[\s\S]*import landingpage_koepfe[\s\S]*rewrite \* \/404\.html/);
  });

  it('compose: Caddy liest die Landingpage nur lesend aus dem Repo-Ordner', () => {
    const compose = readFileSync('compose.yml', 'utf8');
    expect(compose).toMatch(/^\s*- \.\/website:\/srv\/website:ro$/m);
    expect(compose).toMatch(/^\s*- \.\/deploy\/caddy:\/etc\/caddy:ro$/m);
  });
});
