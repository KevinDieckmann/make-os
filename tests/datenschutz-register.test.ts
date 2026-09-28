// ─── Wächter (29.09., Paket D-B #74/#72/#92): Register aller Bestände, Art.-18-Leser, ZOE liest die Kartei nur über crm-sicht ─
// Scannt den Code (app, lib, components, context, hooks, scripts, worker.mjs …) nach Aufrufen von
// loadJson/updateJson/saveJson/updateJsonAsync/updateGeschuetzt mit Literal als erstem Argument.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SPEICHER_REGISTER, DYNAMISCHE_NAMEN, registerEintrag } from '@/lib/crm/speicher-register';
import { WEITERE_SPEICHER } from '@/lib/crm/person-weitere';
import { KONTAKTE_LESER_ERLAUBT } from '@/lib/crm/verarbeitung';

const WURZEL = path.resolve(__dirname, '..');
const ORDNER = ['app', 'lib', 'components', 'context', 'hooks', 'scripts'];
const EINZELN = ['worker.mjs', 'zulieferer.mjs', 'bote.mjs'];
const FN = /\b(loadJson|updateJson|saveJson|updateJsonAsync|updateGeschuetzt)\s*/g;

function* dateien(d: string): Generator<string> {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') yield* dateien(p); }
    else if (/\.(ts|tsx|mjs)$/.test(e.name)) yield p;
  }
}
const alleDateien = (): string[] => [
  ...ORDNER.filter(o => fs.existsSync(path.join(WURZEL, o))).flatMap(o => Array.from(dateien(path.join(WURZEL, o)))),
  ...EINZELN.map(d => path.join(WURZEL, d)).filter(p => fs.existsSync(p)),
];

/** Alle Aufrufe mit Literal: Funktion, Name (Platzhalter → *), Datei. Typ-Argumente (<…>) werden übersprungen. */
function aufrufe(): { fn: string; name: string; datei: string }[] {
  const raus: { fn: string; name: string; datei: string }[] = [];
  for (const p of alleDateien()) {
    const t = fs.readFileSync(p, 'utf8');
    FN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FN.exec(t))) {
      let i = m.index + m[0].length;
      if (t[i] === '<') {
        let tiefe = 0;
        for (; i < t.length; i++) { const c = t[i]; if (c === '<') tiefe++; else if (c === '>' && t[i - 1] !== '=') { tiefe--; if (tiefe === 0) { i++; break; } } }
      }
      while (/\s/.test(t[i] ?? '')) i++;
      if (t[i] !== '(') continue;
      i++;
      while (/\s/.test(t[i] ?? '')) i++;
      const q = t[i];
      if (q !== "'" && q !== '"' && q !== '`') continue;
      const ende = t.indexOf(q, i + 1);
      raus.push({ fn: m[1], name: t.slice(i + 1, ende).replace(/\$\{[^}]*\}/g, '*'), datei: path.relative(WURZEL, p) });
    }
  }
  return raus;
}

describe('Register aller Bestände (#74)', () => {
  const alle = aufrufe();
  it('der Scanner findet die bekannten Bestände (Selbsttest)', () => {
    const namen = new Set(alle.map(a => a.name));
    for (const n of ['kontakte', 'tasks', 'zoe-stapel', 'netzwerk', 'calendar-cache']) expect(namen.has(n)).toBe(true);
  });
  it('jeder Bestandsname im Code steht im Register (mit Behandlung und Grund)', () => {
    const fehlend = Array.from(new Set(alle.filter(a => {
      if (DYNAMISCHE_NAMEN[a.name]) return false;
      return !registerEintrag(a.name);
    }).map(a => `${a.name} (${a.datei})`)));
    expect(fehlend, `Neuer Bestand ohne Eintrag in lib/crm/speicher-register.ts: ${fehlend.join(', ')}`).toEqual([]);
  });
  it('dynamische Namen stehen nur dort, wo sie erwartet sind, und ihr Muster ist registriert', () => {
    for (const a of alle.filter(x => x.name.startsWith('*'))) {
      const d = DYNAMISCHE_NAMEN[a.name];
      expect(d, `${a.name} in ${a.datei}`).toBeTruthy();
      expect(a.datei).toBe(d!.datei);
      expect(registerEintrag(d!.muster)).toBeTruthy();
    }
  });
  it('jeder Eintrag hat einen Grund; entfernen/tilgen ist wirklich umgesetzt', () => {
    const KERN = new Set(['kontakte', 'crm', 'crm-dateien--*', 'crm-import-konflikte', 'crm-import-laeufe--*', 'head-*', 'heads-replay-*', 'crm-signale', 'tasks']);
    const weitere = new Set(WEITERE_SPEICHER.map(s => s.name));
    for (const e of SPEICHER_REGISTER) {
      expect(e.grund.length, e.muster).toBeGreaterThan(10);
      if (e.behandlung === 'entfernen' || e.behandlung === 'tilgen') expect(KERN.has(e.muster) || weitere.has(e.muster), `${e.muster}: keine Umsetzung`).toBe(true);
    }
    // und umgekehrt: jede Umsetzung ist registriert
    for (const s of WEITERE_SPEICHER) expect(registerEintrag(s.name), s.name).toBeTruthy();
  });
  it('Muster sind eindeutig', () => {
    const m = SPEICHER_REGISTER.map(e => e.muster);
    expect(new Set(m).size).toBe(m.length);
  });
});

describe('Art. 18 zentral (#72): loadJson(\'kontakte\') nur in der Erlaubnisliste', () => {
  const stellen = aufrufe().filter(a => a.fn === 'loadJson' && a.name === 'kontakte');
  it('jede Lesestelle der Kartei ist erlaubt (mit Grund) — sonst kontakteFuerVerarbeitung()', () => {
    const fremd = Array.from(new Set(stellen.map(s => s.datei))).filter(d => !KONTAKTE_LESER_ERLAUBT[d]);
    expect(fremd, `Neue Kartei-Leser ohne Art.-18-Filter: ${fremd.join(', ')} — lib/crm/verarbeitung.ts kontakteFuerVerarbeitung() nehmen`).toEqual([]);
  });
  it('die Erlaubnisliste hat keine toten Einträge und jeder hat einen Grund', () => {
    const da = new Set(stellen.map(s => s.datei));
    for (const [d, grund] of Object.entries(KONTAKTE_LESER_ERLAUBT)) {
      expect(da.has(d), `${d} liest die Kartei gar nicht mehr — Eintrag entfernen`).toBe(true);
      expect(grund.length).toBeGreaterThan(10);
    }
  });
  it('in lib/zoe liest nur crm-sicht die Kartei direkt (#92)', () => {
    const zoe = stellen.filter(s => s.datei.startsWith('lib/zoe/')).map(s => s.datei);
    expect(Array.from(new Set(zoe))).toEqual(['lib/zoe/crm-sicht.ts']);
  });
});
