// ─── Aufräumen Etappe 1 (08.10.): Navigation, Kopf, Startseite ──────────────
// Kevin: „Die Software wirkt unaufgeräumt und überladen, ich weiß gar nicht mehr wo alles ist.“ Der Wächter hält fest:
// 1. Die Leiste hat je Space höchstens zwölf Punkte.
// 2. Jede Seite unter app/os ist erreichbar — über die Leiste, die Einstellungen, ZOE (Reiter + Agenten) oder die Schnellsuche;
//    die Schnellsuche (⌘K) findet ausnahmslos jede Seite.
// 3. Keine Seite steht doppelt in den Einstellungen; ZOE-Dinge stehen dort nicht; Telegram genau einmal.
// 4. EINE Startseite: /os heißt „Heute“; /os/heute und /os/uebersicht leiten weiter, keine Weiterleitung verdeckt eine Seite,
//    kein Code verlinkt mehr auf die alten Adressen.
// 5. Kopf schlank (kein Score, kein Index-Schalter, keine Heute/Inbox/Kalender-Knöpfe), Namen „Finanzen“ und „Brain“.
// 6. Nachbesserung 08.10. (Kevin nach der Demo): EIN Schalter oben — Alles · Privat · Business; Heute hat keinen eigenen; die Leiste
//    zeigt bei „Alles“ die Gruppen Privat und Business; die Handy-Leiste hat höchstens fünf Einträge.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SPACES, SPACE_WAHLEN, leisteFuer, ALLES_GRUPPEN, ZOE_BEREICH, ZOE_EINTRAG } from '../lib/make-one/spaces';
import { EINSTELLUNGEN_GRUPPEN, EINSTELLUNGEN_PFADE } from '../lib/make-one/einstellungen';
import { SEITEN_SUCHE } from '../lib/make-one/seiten';
import { DEPARTMENTS } from '../lib/make-one/agents-data';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende: RegExp): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}
const pfadVon = (href: string) => href.split(/[?#]/)[0];

/** Alle Seiten unter app/os als Adresse; reine Weiterleitungs-Seiten (kein JSX) zählen nicht. */
const SEITEN = dateien('app/os', /^page\.tsx$/)
  .filter(p => /(return|=>)\s*\(?\s*<[A-Z]/.test(lies(p)))
  .map(p => `/${path.dirname(p).replace(/^app\//, '')}`);
/** Detailseiten mit Kennung — erreichbar aus ihren Listen (Ziel, Meilenstein), nicht über Menüs. */
const DETAIL = ['/os/planung/meilenstein/[id]', '/os/planung/ziel/[id]'];
const passt = (seite: string, href: string) => new RegExp(`^${seite.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(pfadVon(href));

describe('Aufräumen Etappe 1 — Leiste', () => {
  it('höchstens zwölf Punkte je Space, eindeutig, Heute vorn und ZOE hinten', () => {
    for (const s of SPACES) {
      const l = leisteFuer(s.id);
      expect(l.length, s.id).toBeLessThanOrEqual(12);
      expect(new Set(l.map(e => e.label)).size).toBe(l.length);
      expect(l[0].label).toBe('Heute');
      expect(l.at(-1)).toBe(ZOE_EINTRAG);
      expect(l.map(e => e.label)).toContain('Finanzen');
      expect(l.map(e => e.label)).not.toContain('Zahlen');
    }
  });
  it('„Alles“: höchstens zwölf Punkte, Heute vorn, ZOE dabei, darunter je eine Gruppe Privat und Business', () => {
    const l = leisteFuer('alles');
    expect(l.length).toBeLessThanOrEqual(12);
    expect(l[0].label).toBe('Heute');
    expect(l).toContain(ZOE_EINTRAG);
    expect(ALLES_GRUPPEN.map(g => g.space)).toEqual(['privat', 'business']);
    for (const g of ALLES_GRUPPEN) for (const e of g.eintraege) expect(leisteFuer(g.space)).toContain(e);
    // Die Leiste rendert die Gruppen mit Überschrift (leistenBloecke).
    expect(lies('components/os/Leiste.tsx')).toContain('leistenBloecke(wahl)');
  });
  it('Fokus, Kompass und Wachstum sind kein eigener Punkt, sondern Einstiege unter Planung (PlanerLeiste)', () => {
    for (const s of SPACES) expect(leisteFuer(s.id).map(e => e.label)).not.toEqual(expect.arrayContaining(['Fokus']));
    const planer = lies('components/os/PlanerLeiste.tsx');
    for (const h of ["href: '/os/fokus'", "href: '/os/kompass'", "href: '/os/wachstum'"]) expect(planer).toContain(h);
  });
});

describe('Aufräumen Etappe 1 — jede Seite ist erreichbar', () => {
  const leiste = SPACE_WAHLEN.flatMap(w => leisteFuer(w)).map(e => e.href).concat('/os/system', '/os/konto');
  const einstellungen = EINSTELLUNGEN_GRUPPEN.flatMap(g => g.eintraege.map(e => e.href));
  const zoe = [...ZOE_BEREICH.map(b => b.href), ...DEPARTMENTS.flatMap(d => d.agents.map(a => a.href).filter((h): h is string => !!h))];
  const suche = SEITEN_SUCHE.map(s => s.href);

  it('die Liste der Seiten ist vollständig gelesen', () => {
    expect(SEITEN).toContain('/os');
    expect(SEITEN).toContain('/os/system');
    expect(SEITEN).not.toContain('/os/heute');
    expect(SEITEN).not.toContain('/os/uebersicht');
    expect(SEITEN.length).toBeGreaterThan(40); // Etappe 3 hat Altbestand entfernt (08.10.)
  });
  it('über Leiste, Einstellungen, ZOE oder Schnellsuche', () => {
    const alle = [...leiste, ...einstellungen, ...zoe, ...suche];
    const fehlt = SEITEN.filter(s => !DETAIL.includes(s) && !alle.some(h => passt(s, h)));
    expect(fehlt).toEqual([]);
  });
  it('die Schnellsuche findet jede Seite (auch die nicht mehr im Menü), Kennungen eindeutig', () => {
    const fehlt = SEITEN.filter(s => !DETAIL.includes(s) && !suche.some(h => passt(s, h)));
    expect(fehlt).toEqual([]);
    expect(new Set(SEITEN_SUCHE.map(s => s.id)).size).toBe(SEITEN_SUCHE.length);
    // Jedes Ziel der Suche ist eine Seite (keine toten Einträge).
    const tot = suche.filter(h => !SEITEN.some(s => passt(s, h)) && pfadVon(h) !== '/zoe');
    expect(tot).toEqual([]);
    expect(SEITEN_SUCHE.some(s => /Zahlen/.test(s.titel))).toBe(false);
    expect(SEITEN_SUCHE.find(s => s.href === '/os/wissen')?.titel).toMatch(/^Brain/);
  });
});

describe('Aufräumen Etappe 1 — Einstellungen', () => {
  const eintraege = EINSTELLUNGEN_GRUPPEN.flatMap(g => g.eintraege);
  it('vier Gruppen, jede Seite genau einmal', () => {
    expect(EINSTELLUNGEN_GRUPPEN.map(g => g.titel)).toEqual(['Konto & Sicherheit', 'Verbindungen', 'Daten & Datenschutz', 'Betrieb']);
    const pfade = eintraege.map(e => pfadVon(e.href));
    expect(new Set(pfade).size).toBe(pfade.length);
    for (const e of eintraege) expect(SEITEN.some(s => passt(s, e.href)), e.href).toBe(true);
  });
  it('ZOE-Dinge stehen nicht hier; Telegram genau einmal; Wachstum nicht doppelt', () => {
    const zoePfade = ZOE_BEREICH.flatMap(b => b.passt);
    expect(eintraege.filter(e => zoePfade.some(z => pfadVon(e.href) === z || pfadVon(e.href).startsWith(`${z}/`)))).toEqual([]);
    expect(eintraege.filter(e => /Telegram/.test(`${e.label} ${e.was}`)).length).toBe(1);
    expect(eintraege.some(e => pfadVon(e.href) === '/os/wachstum')).toBe(false);
    // „Einstellungen“ leuchtet auf jeder hier gelisteten eigenen Seite.
    for (const e of eintraege) if (!/[?#]/.test(e.href)) expect(EINSTELLUNGEN_PFADE.some(p => pfadVon(e.href) === p || pfadVon(e.href).startsWith(`${p}/`)), e.href).toBe(true);
  });
  it('die Seite heißt „Einstellungen“ und liest die eine Liste', () => {
    const v = lies('components/os/SystemView.tsx');
    expect(v).toContain('titel="Einstellungen"');
    expect(v).toContain('EINSTELLUNGEN_GRUPPEN');
    expect(v).not.toContain("label: 'Zahlen'");
  });
});

describe('Aufräumen Etappe 1 — eine Startseite „Heute“', () => {
  it('alte Adressen leiten weiter, keine Weiterleitung verdeckt eine echte Seite', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    const ziel = (q: string) => regeln.find(r => r.source === q)?.destination;
    expect(ziel('/os/heute')).toBe('/os');
    expect(ziel('/os/uebersicht')).toBe('/os');
    expect(existsSync(path.join(wurzel, 'app/os/heute'))).toBe(false);
    expect(existsSync(path.join(wurzel, 'app/os/uebersicht'))).toBe(false);
    const statisch = SEITEN.filter(s => !s.includes('['));
    for (const r of regeln) if (!/[:*(]/.test(r.source)) expect(statisch, r.source).not.toContain(r.source);
  });
  it('kein Code verlinkt mehr auf /os/heute oder /os/uebersicht', () => {
    const code = [...dateien('components', /\.tsx?$/), ...dateien('lib', /\.tsx?$/), ...dateien('app', /\.tsx?$/), ...dateien('hooks', /\.tsx?$/)];
    const funde = code.filter(f => /['"`]\/os\/(heute|uebersicht)\b/.test(lies(f)));
    expect(funde).toEqual([]);
  });
  it('Heute: Gruß und Datum einmal, je Sicht Steht an · Fokus · Termine · Aufgaben · Wachstums-Score; alte Flächen-Kennungen', () => {
    const v = lies('components/os/HeuteView.tsx');
    expect(v).toContain('titel="Heute"');
    expect((v.match(/gruss\}/g) ?? []).length).toBe(1);
    expect(v).toContain("{ alle: 'home', privat: 'uebersicht-privat', business: 'uebersicht-business' }");
    const std = v.slice(v.indexOf('export const HEUTE_STANDARD'));
    const teile = [std.slice(std.indexOf('alle: ['), std.indexOf('privat: [')), std.slice(std.indexOf('privat: ['), std.indexOf('business: [')), std.slice(std.indexOf('business: ['), std.indexOf('\n};'))];
    for (const t of teile) for (const art of ['anstehend', 'fokus', 'termine', 'aufgaben', 'score']) expect(t, art).toContain(`art: '${art}'`);
    expect(lies('app/os/page.tsx')).toContain('<HeuteView />');
    // Nachbesserung 08.10.: kein zweiter Schalter auf Heute — die Sicht folgt dem Kopf.
    expect(v).not.toContain('<Segmente');
    expect(v).not.toContain('rechts=');
    expect(v).toContain('useSpace().wahl');
    expect(lies('components/os/flaeche/widgets.tsx')).toContain("anstehend: { art: 'anstehend'");
  });
});

describe('Aufräumen Etappe 1 — Kopf', () => {
  it('nur Space-Schalter, Suche, Glocke, Fokus — kein Score, kein Index, keine Heute/Inbox/Kalender-Knöpfe', () => {
    const k = lies('components/os/Kopf.tsx');
    for (const raus of ['/api/performance', 'WachstumsZahl', "'/os/heute'", 'SCHNELL', 'index.ziel', 'CalendarDays', 'InboxIcon']) expect(k, raus).not.toContain(raus);
    for (const rein of ['<SpaceSchalter', '<Glocke />', '<FokusZaehler', 'make-suche']) expect(k, rein).toContain(rein);
  });
  it('EIN Schalter mit Alles · Privat · Business (Reihenfolge), am Handy kompakt', async () => {
    expect(SPACE_WAHLEN).toEqual(['alles', 'privat', 'business']);
    const k = lies('components/os/Kopf.tsx');
    expect(k).toContain('SPACE_WAHLEN.map');
    expect((k.match(/<SpaceSchalter/g) ?? []).length).toBe(1);
    const css = lies('app/globals.css');
    expect(css).toMatch(/\.kopf-space button \{ min-height: 44px !important; padding: 0 8px !important; font-size: 12px/);
    // Kein anderer Bauteil der Shell baut einen zweiten Bereichs-Schalter.
    for (const f of ['components/os/HeuteView.tsx', 'components/os/Leiste.tsx']) expect(lies(f)).not.toContain('SpaceSchalter');
  });
});

describe('Aufräumen Etappe 1 — Handy-Leiste', () => {
  it('höchstens fünf Einträge, kurze Namen, Spalten kürzen statt zu überlappen, Tippziele ≥ 44 px', async () => {
    const { HANDY_LEISTE } = await import('../components/os/Leiste');
    expect(HANDY_LEISTE.length).toBeLessThanOrEqual(5);
    expect([...HANDY_LEISTE]).toEqual(['Heute', 'Inbox', 'Menü', 'ZOE', 'Netzwerken']);
    for (const n of HANDY_LEISTE) expect(n.length, n).toBeLessThanOrEqual(10);
    const l = lies('components/os/Leiste.tsx');
    expect(l).toContain("flex: '1 1 0', minWidth: 0");
    expect(l).toContain("textOverflow: 'ellipsis'");
    expect(l).toContain('minHeight: 48');
    // Das Menü-Blatt trägt Schalter, Einstellungen und Melden.
    expect(l).toContain('aria-label="Bereich im Menü"');
    expect(l).toContain('<MeldenZeile');
    expect(l).toContain('EINSTELLUNGEN.href');
  });
});
