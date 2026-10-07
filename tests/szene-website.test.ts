// ─── EINE Gestaltungsgrundlage für makeinnovation.de und fokusinnovation.de („Klar 2“, 07.10.2026) ─────────────────────────
// Bis 06.10. bewachte dieser Test die WebGL-Szene beider Seiten (website/js/szene/ → fokus/js/szene/, Byte-Kopien über
// scripts/szene-website.mjs). 07.10. Kevin: „Wir wollen innovativ UND seriös wirken. Wir haben auch in [unserer Software] keine
// Spielereien — das soll sich auch so durchziehen.“ Die Szene ist entfernt (Rückweg: Commit e008ebfc auf `entwicklung`).
// Was beide Seiten jetzt teilen, ist die Gestaltungsgrundlage css/seite.css (dazu Schriften, Logo, Menü): Original in website/,
// Byte-Kopie in fokus/ (scripts/fokus-seite.mjs). Hier wird bewacht, dass die Szene nicht zurückkommt und die Grundlage eine bleibt.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefen, KOPIEN } from '../scripts/fokus-seite.mjs';

const wurzel = process.cwd();
const SEITEN = ['website', 'fokus'];

describe('keine Szene mehr (07.10.)', () => {
  it('weder makeinnovation.de noch fokusinnovation.de haben Leinwand, WebGL, Drehbuch oder Standbild-Rechner', () => {
    for (const weg of ['website/js/szene', 'fokus/js/szene', 'website/js/drehbuch.js', 'fokus/js/drehbuch.js', 'website/js/lichtfaeden.js', 'website/standbild.mjs', 'scripts/szene-website.mjs', 'scripts/lichtfaeden-website.mjs'])
      expect(existsSync(join(wurzel, weg)), weg).toBe(false);
    for (const seite of SEITEN) {
      for (const d of readdirSync(join(wurzel, seite, 'js'))) expect(readFileSync(join(wurzel, seite, 'js', d), 'utf8'), `${seite}/js/${d}`).not.toMatch(/getContext|webgl|requestAnimationFrame/i);
      for (const d of readdirSync(join(wurzel, seite)).filter(n => n.endsWith('.html'))) expect(readFileSync(join(wurzel, seite, d), 'utf8'), `${seite}/${d}`).not.toMatch(/<canvas\b/);
    }
  });
});

describe('eine Gestaltungsgrundlage für beide Seiten', () => {
  it('fokus/css/seite.css ist Byte für Byte website/css/seite.css; alle Kopien passen (node scripts/fokus-seite.mjs)', async () => {
    expect(KOPIEN).toContainEqual(['website/css/seite.css', 'fokus/css/seite.css']);
    expect(readFileSync(join(wurzel, 'fokus/css/seite.css')).equals(readFileSync(join(wurzel, 'website/css/seite.css')))).toBe(true);
    expect(await pruefen(wurzel)).toEqual([]);
  });

  it('eine geänderte Kopie der Grundlage fällt auf', async () => {
    const d = mkdtempSync(join(tmpdir(), 'grundlage-'));
    try {
      for (const seite of SEITEN) cpSync(join(wurzel, seite), join(d, seite), { recursive: true });
      writeFileSync(join(d, 'fokus/css/seite.css'), readFileSync(join(d, 'fokus/css/seite.css'), 'utf8') + '\n/* eigene Fassung */\n');
      expect(await pruefen(d)).toContain('fokus/css/seite.css: passt nicht zur Quelle');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('jede Seite lädt zuerst die Grundlage, dann höchstens ihre eigene Datei — und die setzt keine Tokens', () => {
    const eigene: Record<string, string> = { website: 'css/start.css', fokus: 'css/fokus.css' };
    for (const seite of SEITEN) {
      const index = readFileSync(join(wurzel, seite, 'index.html'), 'utf8');
      expect(Array.from(index.matchAll(/<link rel="stylesheet" href="([^"?]+)/g), m => m[1]), seite).toEqual(['css/seite.css', eigene[seite]]);
      expect(readFileSync(join(wurzel, seite, eigene[seite]), 'utf8'), eigene[seite]).not.toMatch(/--[a-zA-Z-]+\s*:/);
    }
  });
});
