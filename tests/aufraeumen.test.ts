// ─── Aufräumen (04.10., UMBAU_ABEND_0410.md Abschnitt 8) ─────────────────────
// Kevin: „Dann ist die Software fast fertig“ — keine toten Enden, ein Weg statt zwei. Der Wächter hält fest:
// 1. Es gibt keine Seiten außerhalb von /os, /zoe, /anmelden, /buchen und /api (plus reine Weiterleitungen) — keine
//    Routengruppe mit eigener Leiste, keine Stub-/Beispieldaten-Seiten. Alte Adressen leiten weiter (kein 404 für Lesezeichen).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

/** Seiten, die nur weiterleiten (redirect aus next/navigation, sonst nichts). */
const NUR_WEITERLEITUNG = ['app/page.tsx', 'app/jarvis/page.tsx'];
const ERLAUBT = ['os', 'zoe', 'anmelden', 'buchen', 'api', 'jarvis', 'schriften'];

describe('Routen: ein Weg statt zwei', () => {
  it('app/ hat nur die erlaubten Bereiche — keine Routengruppe, kein Alt-Dashboard', () => {
    const ordner = readdirSync(path.join(wurzel, 'app')).filter(n => statSync(path.join(wurzel, 'app', n)).isDirectory());
    expect(ordner.filter(n => !ERLAUBT.includes(n))).toEqual([]);
    expect(ordner.some(n => n.startsWith('('))).toBe(false);
  });

  it('Seiten außerhalb von /os, /zoe, /anmelden, /buchen leiten nur weiter', () => {
    const seiten = dateien('app', /^page\.tsx$/).filter(p => !/^app\/(os|zoe|anmelden|buchen|api)\//.test(p));
    expect(seiten.sort()).toEqual([...NUR_WEITERLEITUNG].sort());
    for (const p of NUR_WEITERLEITUNG) expect(lies(p)).toMatch(/redirect\(/);
  });

  it('keine Stub-Seiten, keine Beispieldaten, keine Alt-Leiste', () => {
    for (const p of dateien('app')) {
      const t = lies(p);
      expect(t, p).not.toMatch(/StubModule|mock-data|components\/layout\/|components\/ui\/make\//);
    }
    for (const weg of ['components/layout', 'components/ui/make', 'components/shared', 'components/tasks', 'components/dashboard',
      'components/fundament', 'lib/mock-data', 'lib/constants.ts', 'context/MakeOSContext.tsx', 'context/AppContext.tsx', 'context/PrivacyContext.tsx']) {
      expect(existsSync(path.join(wurzel, weg)), weg).toBe(false);
    }
  });

  it('alte Adressen der Gruppe app/(dashboard) leiten auf die passende /os-Seite', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    const ziel = (q: string) => regeln.find(r => r.source === q)?.destination;
    expect(ziel('/dashboard')).toBe('/os');
    expect(ziel('/tasks')).toBe('/os/aufgaben');
    expect(ziel('/tasks/:pfad*')).toBe('/os/aufgaben');
    expect(ziel('/wellness')).toBe('/os/gesundheit');
    expect(ziel('/routines')).toBe('/os/planung/routinen');
    expect(ziel('/groceries')).toBe('/os/familie');
    expect(ziel('/dog')).toBe('/os/familie');
    // Jedes Ziel ist eine echte Seite.
    for (const r of regeln.filter(x => !x.destination.includes('?'))) {
      const seite = path.join(wurzel, 'app', r.destination === '/os' ? 'os' : r.destination.slice(1), 'page.tsx');
      expect(existsSync(seite), `${r.source} → ${r.destination}`).toBe(true);
    }
  });
});

describe('Stapel: Meilensteine führen in die Planung', () => {
  // ZOE setzt Meilensteine im Bestand „meilensteine“ (Planung, Lichtfäden) — die Bau-Roadmap ist etwas anderes.
  it('StapelView und StapelVoll verlinken über WEG.jahr(), nicht /os/roadmap', () => {
    for (const p of ['components/os/StapelView.tsx', 'components/os/StapelVoll.tsx']) {
      const t = lies(p);
      expect(t, p).toMatch(/meilensteine: \{[^}]*href: WEG\.jahr\(\)/);
      expect(t, p).not.toMatch(/meilensteine: \{[^}]*\/os\/roadmap/);
    }
  });
});
