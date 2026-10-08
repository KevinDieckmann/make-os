// ─── Aufräumen Etappe 3 (08.10.): Markttraktion und Altbestand ──────────────
// Kevin: „Die Software wirkt unaufgeräumt und überladen.“ Der Wächter hält fest:
// 1. Die Markttraktion hat höchstens sieben Reiter (heute sechs + die zwei Schnellknöpfe); jeder Bereich gehört genau einem Reiter,
//    einem Schnellknopf oder dem Zahnrad (Stammdaten); jede Unteransicht steht genau einmal (Power Hour nur unter Follow-up,
//    Kampagnen nur unter Marketing, Leads nur unter Qualifizierung, „Kunden“ nur in Deals › Auswertung).
// 2. Jede alte Adresse (Reiter „Sales“ mit all seinen Ansichten, alte CRM-Bereiche, Firmen › Leads, Deals › Kunden, die alte
//    Qualifizierungs-Runde der Kartei) und jeder WEG-Link der Markttraktion löst auf einen existierenden neuen Ort auf.
// 3. Entfernte Seiten leiten weiter (next.config.mjs), unter app/os gibt es keine reine Weiterleitungs-Seite mehr.
// 4. Ruhigere Köpfe: kein Untertitel länger als 110 Zeichen, kein Seitentitel als Werbesatz mit Punkt.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  aufloesen, markttraktion, REITER_ZEILE, REITER_IDS, KLICKZIELE_ZEILE, reiterVon, BEREICHE, BEREICHE_ALT, SALES_ALT_ANSICHTEN,
  DEALS_ANSICHTEN, FOLLOWUP_ANSICHTEN, BESUCHE_ANSICHTEN, QUALI_ANSICHTEN, MARKETING_ANSICHTEN, type Bereich,
} from '../lib/crm/adresse';
import { WEG } from '../lib/wege';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende: RegExp): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

/** Welche Ansichten (`a`) ein Bereich kennt — null = frei (Kartei-Ansichten, Akte, Runden, Events, Angebot, Stammdaten). */
const GUELTIG: Partial<Record<Bereich, readonly string[]>> = {
  deals: DEALS_ANSICHTEN, followup: FOLLOWUP_ANSICHTEN, besuche: BESUCHE_ANSICHTEN, qualifizierung: QUALI_ANSICHTEN, marketing: MARKETING_ANSICHTEN,
};
/** Alle Ansichten, die es je gab (Stand vor dem 08.10. eingeschlossen). */
const ALTE_ANSICHTEN = [
  undefined, 'board', 'liste', 'akte', 'kunden', 'auswertung', 'faellig', 'woche', 'powerhour', 'kadenz', 'head', 'kampagnen', 'heute', 'leads',
  'pipeline', 'uebersicht', 'anfragen', 'segmente', 'redaktion', 'newsletter', 'positionierung', 'kalender', 'wirkung', 'runde', 'scoring',
  'scoring-sales', 'runde-kreis', 'runde-chancen', 'runde-vernetzen', 'datenschutz', 'qualitaet', 'wertelisten', 'quatsch',
];

describe('Markttraktion — höchstens sieben Reiter, jede Ansicht einmal', () => {
  it('Reiterzeile: sechs Reiter, zwei Schnellknöpfe, Stammdaten hinter dem Zahnrad', () => {
    expect(REITER_IDS.length).toBeLessThanOrEqual(7);
    expect(REITER_IDS).toEqual(['ueberblick', 'kontakte', 'deals', 'followup', 'marketing', 'events']);
    expect(REITER_ZEILE.mitte).toEqual(['qualifizierung', 'angebot']);
    expect(REITER_ZEILE.zahnrad).toBe('stammdaten');
    // Vorher zwölf Klickziele in der Zeile — jetzt acht (Offene Frage an Kevin: Schnellknöpfe zählen als Klickziel mit).
    expect(KLICKZIELE_ZEILE).toBeLessThanOrEqual(8);
  });
  it('jeder Bereich gehört genau einem Ort; „Sales“ ist kein Bereich mehr', () => {
    const orte = [...REITER_ZEILE.links.flatMap(r => r.bereiche), ...REITER_ZEILE.mitte, ...REITER_ZEILE.rechts.flatMap(r => r.bereiche), REITER_ZEILE.zahnrad];
    expect(new Set(orte).size).toBe(orte.length);
    expect([...orte].sort()).toEqual([...BEREICHE].sort());
    expect(BEREICHE as string[]).not.toContain('sales');
    expect(reiterVon('firmen')).toBe('kontakte');
    expect(reiterVon('event')).toBe('events');
    expect(reiterVon('stammdaten')).toBeNull();
  });
  it('die Seite rendert die Zeile aus REITER_ZEILE, ohne Sales-Reiter, mit Zahnrad; doppelte Ansichten sind weg', () => {
    const v = lies('components/os/crm/Markttraktion.tsx');
    expect(v).toContain('REITER_ZEILE.links.map');
    expect(v).toContain('REITER_ZEILE.rechts.map');
    expect(v).toContain('gehe(REITER_ZEILE.zahnrad)');
    expect(v).not.toMatch(/bereich === 'sales'/);
    expect(v).not.toContain('SalesStart');
    expect(v).not.toContain('<Kampagnen');            // Kampagnen nur noch unter Marketing
    expect((v.match(/<Heute /g) ?? []).length).toBe(1); // Power Hour nur unter Follow-up
    expect((v.match(/<Leads /g) ?? []).length).toBe(1); // Leads nur unter Qualifizierung
    expect(existsSync(path.join(wurzel, 'components/os/crm/SalesStart.tsx'))).toBe(false);
    // Die alte Qualifizierungs-Runde der Kartei gibt es nicht mehr neben der Runde des Schnellknopfs.
    expect(lies('components/os/crm/Runden.tsx')).not.toContain('QualifizierungsRunde');
    expect(lies('components/os/crm/Leads.tsx')).not.toContain('export function QualifizierungsRunde');
  });
  it('jeder Untertitel der Markttraktion ist eine Zeile (≤ 110 Zeichen)', () => {
    const v = lies('components/os/crm/Markttraktion.tsx');
    const block = v.slice(v.indexOf('const UNTER: Record<Bereich, string> = {'), v.indexOf('};', v.indexOf('const UNTER: Record<Bereich, string> = {')));
    const texte = [...block.matchAll(/^\s+[a-z]+: '([^']*)',$/gm)].map(m => m[1]);
    expect(texte.length).toBe(BEREICHE.length);
    for (const t of texte) expect(t.length, t).toBeLessThanOrEqual(110);
  });
});

describe('Markttraktion — jede alte Adresse findet ihren neuen Ort', () => {
  it('jede Kombination aus alten und neuen Bereichen × allen Ansichten löst auf einen gültigen Ort', () => {
    for (const s of [undefined, ...BEREICHE, ...BEREICHE_ALT, 'quatsch']) {
      for (const a of ALTE_ANSICHTEN) {
        const z = aufloesen(s, a);
        expect(BEREICHE, `${s}/${a}`).toContain(z.s);
        const g = GUELTIG[z.s];
        if (z.a && g) expect(g, `${s}/${a} → ${z.s}/${z.a}`).toContain(z.a);
        // Der Link ist stabil: noch einmal aufgelöst bleibt er, wo er ist.
        const link = new URL(markttraktion(s, a), 'http://x');
        expect(aufloesen(link.searchParams.get('s') ?? undefined, link.searchParams.get('a'))).toEqual(z);
      }
    }
  });
  it('der frühere Reiter „Sales“ und die Doppelungen landen am einen neuen Ort', () => {
    const erwartet: [string, string | undefined, { s: Bereich; a?: string }][] = [
      ['sales', undefined, { s: 'deals' }], ['sales', 'head', { s: 'deals' }], ['sales', 'powerhour', { s: 'followup', a: 'powerhour' }],
      ['sales', 'kampagnen', { s: 'marketing', a: 'kampagnen' }], ['sales', 'auswertung', { s: 'deals', a: 'auswertung' }],
      ['sales', 'heute', { s: 'followup', a: 'powerhour' }], ['sales', 'leads', { s: 'qualifizierung', a: 'leads' }],
      ['sales', 'pipeline', { s: 'deals' }], ['sales', 'kunden', { s: 'deals', a: 'auswertung' }],
      ['firmen', 'leads', { s: 'qualifizierung', a: 'leads' }], ['deals', 'kunden', { s: 'deals', a: 'auswertung' }],
      ['kontakte', 'runde-chancen', { s: 'qualifizierung' }], ['heute', undefined, { s: 'followup', a: 'powerhour' }],
      ['kunden', undefined, { s: 'deals', a: 'auswertung' }], ['events', undefined, { s: 'event' }], ['kartei', undefined, { s: 'kontakte' }],
    ];
    for (const [s, a, z] of erwartet) expect(aufloesen(s, a), `${s}/${a}`).toEqual(z);
    for (const a of SALES_ALT_ANSICHTEN) expect(BEREICHE).toContain(aufloesen('sales', a).s);
  });
  it('jeder WEG-Link der Markttraktion ist schon der neue Ort (kanonisch)', () => {
    const links = [
      WEG.markttraktion(), WEG.deals(), WEG.deal(), WEG.deal('ch-1'), WEG.followup(), WEG.followup('woche'), WEG.followup('powerhour'), WEG.followup('kadenz'),
      WEG.powerHour(), WEG.qualifizierung(), WEG.leads(), WEG.leads('f-1'), WEG.kunden(), WEG.kampagne(), WEG.kampagne('kp-1'), WEG.angebot(),
      WEG.akte('c-1'), WEG.kontakt(), WEG.kontakt('c-1'), WEG.firma(), WEG.firma('f-1'), WEG.event(), WEG.event('ev-1', 'gaeste'), WEG.besuch(),
      WEG.besuch('ev-2'), WEG.besuch(undefined, 'wirkung'), WEG.besuch(undefined, 'kunden'), WEG.stammdaten(), WEG.stammdaten('datenschutz'),
      ...(['anfragen', 'segmente', 'kampagnen', 'redaktion', 'newsletter', 'positionierung'] as const).map(a => WEG.marketing(a)), WEG.marketing(),
    ];
    for (const l of links) {
      const u = new URL(l, 'http://x');
      expect(u.pathname, l).toBe('/os/markttraktion');
      const s = u.searchParams.get('s') ?? 'ueberblick', a = u.searchParams.get('a') ?? undefined;
      expect(aufloesen(s, a), l).toEqual(a ? { s, a } : { s });
    }
    expect(WEG.leads()).toBe('/os/markttraktion?s=qualifizierung&a=leads');
    expect(WEG.kunden()).toBe('/os/markttraktion?s=deals&a=auswertung');
    expect(WEG.kampagne('kp-1')).toBe('/os/markttraktion?s=marketing&a=kampagnen&k=kp-1');
  });
  it('kein Code baut mehr Links auf den Reiter „Sales“, Firmen › Leads oder Deals › Kunden', () => {
    const code = [...dateien('components', /\.tsx?$/), ...dateien('lib', /\.tsx?$/), ...dateien('app', /\.tsx?$/)].filter(f => f !== 'lib/crm/adresse.ts');
    const funde = code.filter(f => /markttraktion\('sales'|s=sales|markttraktion\('firmen', 'leads'|markttraktion\('deals', 'kunden'|gehe\('sales'/.test(lies(f)));
    expect(funde).toEqual([]);
  });
});

describe('Altbestand — entfernte Seiten leiten weiter, keine Weiterleitungs-Seite unter app/os', () => {
  const ENTFERNT: [string, string][] = [
    ['/os/aufgaben/board', '/os/aufgaben'], ['/os/roadmap', '/os/bauplan?s=phasen'], ['/os/saeule/planning', '/os/aufgaben'],
    ['/os/saeule/finance', '/os/finanzen'], ['/os/saeule/business', '/os/finanzen?s=business&space=business'], ['/os/saeule/agents', '/os/agenten'],
    ['/os/saeule/:key', '/os/wachstum'], ['/os/crm', '/os/markttraktion'], ['/os/business', '/os/finanzen?s=business&space=business'],
    ['/os/finanzplan', '/os/finanzen?s=finanzplanung&space=privat'], ['/os/planung/woche', '/os/kalender?modus=planen'],
    ['/os/datenschutz/nachweise', '/os/datenschutz#nachweise'],
  ];
  it('jede entfernte Adresse hat ihre Regel, das Ziel ist eine echte Seite, die alte Seite ist weg', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    for (const [quelle, ziel] of ENTFERNT) {
      expect(regeln.find(r => r.source === quelle)?.destination, quelle).toBe(ziel);
      const pfad = ziel.split(/[?#]/)[0];
      expect(existsSync(path.join(wurzel, 'app', pfad.slice(1), 'page.tsx')), ziel).toBe(true);
      if (!quelle.includes(':')) expect(existsSync(path.join(wurzel, 'app', quelle.slice(1), 'page.tsx')), quelle).toBe(false);
    }
    expect(existsSync(path.join(wurzel, 'app/os/saeule'))).toBe(false);
  });
  it('keine Seite unter app/os ist eine reine Weiterleitung (die stehen in next.config.mjs)', () => {
    const nurWeiter = dateien('app/os', /^page\.tsx$/).filter(p => { const t = lies(p); return /\bredirect\(/.test(t) && !/<[A-Z]/.test(t); });
    expect(nurWeiter).toEqual([]);
  });
  it('kein Code verlinkt mehr auf entfernte Seiten; die alte Bereichsliste ist weg', () => {
    const code = [...dateien('components', /\.tsx?$/), ...dateien('lib', /\.tsx?$/), ...dateien('app', /\.tsx?$/), ...dateien('hooks', /\.tsx?$/)];
    const funde = code.filter(f => /['"`]\/os\/(aufgaben\/board|roadmap|saeule\/)/.test(lies(f)));
    expect(funde).toEqual([]);
    expect(existsSync(path.join(wurzel, 'lib/make-one/bereiche.ts'))).toBe(false);
    expect(code.filter(f => lies(f).includes('make-one/bereiche'))).toEqual([]);
  });
  it('der Zeitstrahl (Seil) ist eine Darstellung der Aufgaben, die Roadmap ein Reiter im Bauplan', () => {
    const raum = lies('components/os/aufgaben/AufgabenRaum.tsx');
    expect(raum).toContain("darstellung === 'zeitstrahl'");
    expect(raum).toContain('<Seil ebene="aufgaben"');
    const bau = lies('components/os/bauplan/BauplanBoard.tsx');
    expect(bau).toContain("label: 'Phasen'");
    expect(bau).toContain('<Phasen />');
  });
});

describe('Ruhigere Köpfe', () => {
  const seiten = [...dateien('components', /\.tsx$/), ...dateien('app', /\.tsx$/)].filter(f => lies(f).includes('<Seite'));
  it('kein Untertitel länger als 110 Zeichen (Text-Untertitel)', () => {
    const lang: string[] = [];
    for (const f of seiten) {
      const t = lies(f);
      for (const m of t.matchAll(/<Seite\b[\s\S]{0,600}?unter="([^"]*)"/g)) if (m[1].length > 110) lang.push(`${f}: ${m[1].length}`);
    }
    expect(lang).toEqual([]);
  });
  it('Seitentitel sind Namen, keine Werbesätze mit Punkt', () => {
    const saetze: string[] = [];
    for (const f of seiten) for (const m of lies(f).matchAll(/<Seite\b[\s\S]{0,80}?titel="([^"]*)"/g)) if (/[.!]$/.test(m[1])) saetze.push(`${f}: ${m[1]}`);
    expect(saetze).toEqual([]);
  });
});
