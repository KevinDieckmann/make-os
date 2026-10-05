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

// ── Namen auflösen (29.09., K2 — Verbindungskarte Befund 3): vorher fand der Wächter nur Namen, die als fester Text
// im Aufruf standen. Jetzt auch: Konstanten (`loadJson(SPEICHER)`, `loadJson(MAC.erinnerungen)`, `SPEICHER[art]` → alle
// Werte), importierte Konstanten, Namens-Funktionen (`loadJson(familieName(h))` → `familie--*`) und `speicherFuer('zeit', p)`
// (→ `zeit` und `zeit--*`). Nicht Auflösbares (Parameter, berechnete Namen) bleibt wie bisher außen vor.
const LITERAL = /^(['"`])((?:(?!\1).)*)\1/;
const alsName = (roh: string) => roh.replace(/\$\{[^}]*\}/g, '*');
const quelltext = new Map<string, string>();
const lies = (p: string) => { let t = quelltext.get(p); if (t === undefined) { t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; quelltext.set(p, t); } return t; };
function modulPfad(von: string, spez: string): string | null {
  const basis = spez.startsWith('@/') ? path.join(WURZEL, spez.slice(2)) : spez.startsWith('.') ? path.resolve(path.dirname(von), spez) : null;
  if (!basis) return null;
  for (const k of [`${basis}.ts`, `${basis}.tsx`, `${basis}.mjs`, path.join(basis, 'index.ts')]) if (fs.existsSync(k)) return k;
  return null;
}
/** Lokaler Name → [Datei, exportierter Name] aus den Importen einer Datei. */
function importe(p: string): Map<string, [string, string]> {
  const karte = new Map<string, [string, string]>();
  for (const m of lies(p).matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const ziel = modulPfad(p, m[2]);
    if (!ziel) continue;
    for (const teil of m[1].split(',')) {
      const x = teil.trim().replace(/^type\s+/, '');
      if (!x) continue;
      const [orig, alias] = x.split(/\s+as\s+/);
      karte.set((alias ?? orig).trim(), [ziel, orig.trim()]);
    }
  }
  return karte;
}
/** Werte eines Bezeichners in einer Datei (folgt Importen, eine Ebene Re-Exporte). `glied` = `.x` bzw. `[…]`. */
function werte(p: string, id: string, glied: string | null, tiefe = 0): string[] {
  if (tiefe > 3) return [];
  const t = lies(p);
  const esc = id.replace(/[$]/g, '\\$');
  // const X = 'name' | `name--${…}`
  const einfach = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${esc}\\s*(?::[^=\\n]+)?=\\s*(['"\`])((?:(?!\\1).)*)\\1`).exec(t);
  if (einfach && !glied) return [alsName(einfach[2])];
  // const X = { a: 'name', … } (auch mit Typ)
  const objekt = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${esc}\\s*(?::[^=\\n]+)?=\\s*\\{([\\s\\S]*?)\\n?\\}`).exec(t);
  if (objekt) {
    const paare = Array.from(objekt[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(['"`])((?:(?!\2).)*)\2/g)).map(x => [x[1], alsName(x[3])] as const);
    if (glied?.startsWith('.')) return paare.filter(([k]) => k === glied.slice(1)).map(([, v]) => v);
    return paare.map(([, v]) => v);
  }
  // Namens-Funktion: const X = (…) => `name--${…}` bzw. function X(…) { … return `name--${…}` }
  const fnPfeil = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${esc}\\s*=\\s*\\([^)]*\\)(?:\\s*:\\s*[\\w<>|' ]+)?\\s*=>\\s*(\`[^\`]*\`)`).exec(t);
  if (fnPfeil) return [alsName(fnPfeil[1].slice(1, -1))];
  const fnDekl = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?function\\s+${esc}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]{0,400}?)\\n\\}`).exec(t);
  if (fnDekl) { const r = /return\s+(`[^`]*`|'[^']*')/.exec(fnDekl[1]); if (r) return [alsName(r[1].slice(1, -1))]; }
  const imp = importe(p).get(id);
  if (imp) return werte(imp[0], imp[1], glied, tiefe + 1);
  // export { X } from '…' / export { Y as X } from '…'
  for (const m of t.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const teil of m[1].split(',')) {
      const [orig, alias] = teil.trim().split(/\s+as\s+/);
      if ((alias ?? orig)?.trim() === id) { const ziel = modulPfad(p, m[2]); if (ziel) return werte(ziel, orig.trim(), glied, tiefe + 1); }
    }
  }
  return [];
}
/** Das erste Argument ab Position i: Literal, Bezeichner (mit .glied / […]) oder Aufruf eines Bezeichners. */
function argumentNamen(p: string, t: string, i: number): string[] {
  const rest = t.slice(i, i + 300);
  const lit = LITERAL.exec(rest);
  if (lit) return [alsName(lit[2])];
  const sf = /^speicherFuer\s*\(\s*/.exec(rest);
  if (sf) return argumentNamen(p, t, i + sf[0].length).flatMap(n => [n, `${n}--*`]);
  const id = /^([A-Za-z_$][\w$]*)(\.[A-Za-z_$][\w$]*|\s*\[[^\]]*\])?(\s*\()?/.exec(rest);
  if (!id) return [];
  return werte(p, id[1], id[2] ? id[2].trim() : null);
}

/** Alle Aufrufe mit auflösbarem Namen: Funktion, Name (Platzhalter → *), Datei. Typ-Argumente (<…>) werden übersprungen. */
function aufrufe(): { fn: string; name: string; datei: string }[] {
  const raus: { fn: string; name: string; datei: string }[] = [];
  for (const p of alleDateien()) {
    const t = lies(p);
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
      for (const name of argumentNamen(p, t, i)) if (name && !name.startsWith('*')) raus.push({ fn: m[1], name, datei: path.relative(WURZEL, p) });
      // Wie bisher: ein Literal, das mit einem Platzhalter BEGINNT, meldet der Test „dynamische Namen“ weiter.
      const lit = LITERAL.exec(t.slice(i, i + 300));
      if (lit && alsName(lit[2]).startsWith('*')) raus.push({ fn: m[1], name: alsName(lit[2]), datei: path.relative(WURZEL, p) });
    }
  }
  return raus;
}

describe('Register aller Bestände (#74)', () => {
  const alle = aufrufe();
  it('der Scanner findet die bekannten Bestände (Selbsttest)', () => {
    const namen = new Set(alle.map(a => a.name));
    for (const n of ['kontakte', 'tasks', 'zoe-stapel', 'netzwerk', 'calendar-cache']) expect(namen.has(n)).toBe(true);
    // Seit 29.09. (K2) auch aus Konstanten, Namens-Funktionen und speicherFuer():
    for (const n of ['kalender-icloud', 'apple-reminders-cache', 'familie--*', 'zeit', 'zeit--*', 'meldungen--*']) expect(namen.has(n), n).toBe(true);
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
    const KERN = new Set(['kontakte', 'crm', 'crm-dateien--*', 'crm-import-konflikte', 'crm-import-laeufe--*', 'head-*', 'heads-replay-*', 'crm-signale', 'tasks', 'kennung-alias--*']);
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

// ── DSGVO-Prüfung 04.10. (Teil 2): Rechtsgrundlage, Art. 15, Löschfrist, Kategorie ─────────────────────────────
// Jeder NEUE Speicher mit Personenbezug trägt die Angaben (lib/crm/speicher-register.ts `mit(…)`). Die Altbestände ohne sie
// dürfen nur weniger werden — wer einen ergänzt, senkt die Zahl hier.
const ALTBESTAND_OHNE_ANGABEN = 91;
describe('Register: Pflicht-Angaben für neue Speicher (DSGVO-Prüfung 04.10.)', () => {
  const ohne = SPEICHER_REGISTER.filter(e => e.bezug !== 'kein' && !(e.rechtsgrundlage && e.art15 && e.loeschfrist));
  it(`neue Speicher mit Personenbezug haben Rechtsgrundlage, Art.-15-Weg und Löschfrist (Altbestand höchstens ${ALTBESTAND_OHNE_ANGABEN})`, () => {
    expect(ohne.length, `Neuer Speicher ohne rechtsgrundlage/art15/loeschfrist — mit mit(…) ergänzen: ${ohne.slice(-5).map(e => e.muster).join(', ')}`).toBeLessThanOrEqual(ALTBESTAND_OHNE_ANGABEN);
  });
  it('die Speicher vom 04.10. tragen die Angaben vollständig', () => {
    for (const m of ['gesellschaften--*', 'kapazitaet--*']) {
      const e = registerEintrag(m.replace('*', 'h-pruef'));
      expect(e?.rechtsgrundlage, m).toMatch(/Art\. 6/);
      expect(e?.art15?.length, m).toBeGreaterThan(20);
      expect(e?.loeschfrist?.length, m).toBeGreaterThan(10);
    }
    expect(registerEintrag('kapazitaet--h')?.kategorie).toContain('beschaeftigte');
    expect(registerEintrag('gesellschaften--h')?.kategorie).toContain('vertraulich');
  });
  it('Gesundheits-Bestände sind als besondere Kategorie (Art. 9) markiert — mit Art.-9-Grundlage', () => {
    for (const n of ['vitals', 'vitals--h', 'sport--h', 'haut--h', 'health-log--h', 'gesundheitszeit']) {
      const e = registerEintrag(n);
      expect(e?.kategorie, n).toContain('art9');
      expect(e?.rechtsgrundlage, n).toMatch(/Art\. 9 Abs\. 2/);
    }
  });
  it('Business-Index und Kapazitäts-Kennzahlen lesen keinen Gesundheits-Bestand direkt', () => {
    for (const d of ['lib/business/messen.ts', 'lib/business/speicher.ts', 'lib/business/register.ts', 'lib/kapazitaet/kennzahlen.ts']) {
      const t = fs.readFileSync(path.join(WURZEL, d), 'utf8');
      expect(/['"`](vitals|sport|haut|health-log)(--|['"`])/.test(t), d).toBe(false);
    }
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
