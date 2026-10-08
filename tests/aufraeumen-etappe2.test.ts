// ─── Aufräumen Etappe 2 (08.10.): Finanzen in höchstens zwei Ebenen ─────────
// Kevin: „Die Software wirkt unaufgeräumt und überladen.“ Der Wächter hält fest:
// 1. Finanzen hat höchstens zwei Navigationsebenen: EINE Reiterleiste je Bereich (FinanzenView), darunter höchstens EINE Pillenreihe
//    (Konten & Buchungen, Business-Überblick, Blätter der Planung). Eingebettete Ansichten tragen weder Seite noch Reiter.
// 2. Keine Seite unter app/os/finanzen außer der einen; die früheren Nebenseiten und Weiterleitungs-Seiten gibt es nicht mehr.
// 3. Alte Adressen leiten in next.config.mjs weiter — mit ihren Parametern auf den richtigen Ort (wie Next sie zusammenführt).
// 4. Der Bereich: ?space= gewinnt, sonst der Reiter, sonst der Kopf-Schalter; ohne Haushalt immer Business. Business zeigt nie Privates.
// 5. „Zahlen“ ist als Bereichsname nirgends mehr sichtbar; jeder Finanz-Weg (WEG, Schnellsuche) zeigt auf /os/finanzen.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { WEG } from '../lib/wege';
import { SEITEN_SUCHE } from '../lib/make-one/seiten';
import { finanzOrt, finanzAdresse, kontenUnter, PRIVAT_REITER, BUSINESS_REITER, UEBERBLICK_UNTER, HAUSHALT_UNTER, FINANZ_S } from '../lib/finanzen/navigation';
import { blaetterFuer, blattAus, abschnitteFuer, NUR_PRIVAT_UNTERSEITEN, NUR_PRIVAT_ABSCHNITTE, ABSCHNITTE, ZAHNRAD, finanzplanAdresse, alteAdresseUmschreiben, istAbschnittId, type Unterseite, type AbschnittId } from '../lib/finanzen/plan/hilfen';
import { PRIVAT_GESELLSCHAFTEN } from '../lib/einheiten';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende: RegExp): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}
const ort = (adresse: string, o: Parameters<typeof finanzOrt>[1] = {}) => finanzOrt(new URLSearchParams(adresse.split(/[?#]/)[1] ?? ''), o);
const EINGEBETTET = ['BuchungenView', 'ControllingView', 'LiquiditaetView', 'FinanzplanungView', 'GrundlageView', 'FinanzDashboardView'].map(n => `components/os/${n}.tsx`);

describe('Aufräumen Etappe 2 — höchstens zwei Ebenen', () => {
  it('Ebene 1: wenige Reiter je Bereich, eindeutig, Überblick vorn', () => {
    for (const l of [PRIVAT_REITER, BUSINESS_REITER]) {
      expect(l.length).toBeLessThanOrEqual(6);
      expect(l[0].label).toBe('Überblick');
      expect(new Set(l.map(r => r.label)).size).toBe(l.length);
    }
    expect(PRIVAT_REITER.map(r => r.label)).toEqual(['Überblick', 'Konten & Buchungen', 'Planung', 'Steuern']);
    expect(BUSINESS_REITER.map(r => r.label)).toEqual(['Überblick', 'Rechnungen & Zahlungen', 'Liquidität', 'Buchungen', 'Planung', 'Steuern']);
    // Head of Finance ist ein Knopf, Gesamt kein Reiter mehr.
    for (const l of [PRIVAT_REITER, BUSINESS_REITER]) expect(l.map(r => r.label)).not.toEqual(expect.arrayContaining(['Head of Finance', 'Gesamt']));
  });
  it('Ebene 2: eine flache Reihe — keine dritte Ebene darunter', () => {
    for (const l of [kontenUnter(), UEBERBLICK_UNTER, blaetterFuer('privat'), blaetterFuer('business')]) {
      expect(new Set(l.map(x => x.id)).size).toBe(l.length);
      expect(new Set(l.map(x => x.label)).size).toBe(l.length);
      for (const x of l) expect(Object.keys(x)).not.toContain('unter');
    }
    // Business-Blätter ohne Privates (Sicht-Regel 04.10.).
    for (const u of NUR_PRIVAT_UNTERSEITEN) expect(blaetterFuer('business').map(b => b.id)).not.toContain(u);
    // „Buchungen“ heißt in der Planung „Ist-Buchungen“ (seit 08.10. abends ein Abschnitt des Blatts Monat) — die Kontobuchungen stehen unter Konten & Buchungen.
    expect(ABSCHNITTE.monat.find(a => a.id === 'buchungen')?.label).toBe('Ist-Buchungen');
    // Abschnitte stehen als Daten neben den Blättern, nie als dritte Pillenreihe (keine `unter`-Liste an einem Blatt).
    for (const u of Object.keys(ABSCHNITTE) as Unterseite[]) for (const a of ABSCHNITTE[u]) expect(Object.keys(a)).not.toContain('unter');
  });
  it('FinanzenView rendert genau EINE Reiterleiste; Planung und Haushalt keine eigene', () => {
    const v = lies('components/os/FinanzenView.tsx');
    expect((v.match(/<Reiter /g) ?? []).length).toBe(1);
    expect(v).toContain('Head of Finance');
    expect(lies('components/os/finanzplan/Finanzplan.tsx')).not.toMatch(/<Reiter /);
    expect(lies('components/os/haushalt/HaushaltView.tsx')).not.toMatch(/<Reiter /);
  });
  it('eingebettete Ansichten tragen weder Seite noch Reiter', () => {
    for (const f of EINGEBETTET) {
      const t = lies(f);
      expect(t, f).not.toMatch(/<Seite[ >]/);
      expect(t, f).not.toMatch(/<Reiter /);
    }
  });
});

describe('Aufräumen Etappe 2 — keine Nebenseiten', () => {
  it('unter app/os/finanzen steht nur die eine Seite; Controlling, Finanzplan, Business sind keine Seiten mehr', () => {
    expect(dateien('app/os/finanzen', /\.tsx?$/)).toEqual(['app/os/finanzen/page.tsx']);
    for (const d of ['app/os/controlling', 'app/os/finanzplan', 'app/os/business']) expect(existsSync(path.join(wurzel, d)), d).toBe(false);
  });
  it('kein Code verlinkt mehr auf die alten Adressen', () => {
    const code = [...dateien('components', /\.tsx?$/), ...dateien('lib', /\.tsx?$/), ...dateien('app', /\.tsx?$/), ...dateien('hooks', /\.tsx?$/)]
      .filter(f => f !== 'lib/make-one/spaces.ts'); // Muster für „welcher Space leuchtet“ — dort stehen alte Adressen als Erkennung, nicht als Link.
    const funde = code.filter(f => /['"`]\/os\/(finanzen\/(planung|liquiditaet|buchungen|grundlage|dashboard)|controlling|finanzplan\b|business\b)/.test(lies(f)));
    expect(funde).toEqual([]);
  });
});

describe('Aufräumen Etappe 2 — alte Adressen leiten mit Parametern weiter', () => {
  /** Wie Next eine Weiterleitung zusammenführt (prepare-destination.js): erst die alten Parameter, dann die des Ziels. */
  async function folge(alt: string): Promise<string> {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    const [pfad, suche = ''] = alt.split('?');
    const r = regeln.find(x => x.source === pfad);
    expect(r, pfad).toBeTruthy();
    const [zielPfad, zielSuche = ''] = r!.destination.split('?');
    const q = Object.fromEntries(new URLSearchParams(suche));
    Object.assign(q, Object.fromEntries(new URLSearchParams(zielSuche)));
    return `${zielPfad}?${new URLSearchParams(q).toString()}`;
  }
  it('jede alte Adresse landet am richtigen Ort, die Parameter bleiben', async () => {
    const f = [
      ['/os/finanzen/planung?r=r1', 'business', 'rechnungen', 'r', 'r1'],
      ['/os/finanzen/planung?z=z1', 'business', 'rechnungen', 'z', 'z1'],
      ['/os/finanzen/liquiditaet?p=p1', 'business', 'liquiditaet', 'p', 'p1'],
      ['/os/finanzen/buchungen?monat=2026-08&kat=Software&q=Acme', 'business', 'buchungen', 'kat', 'Software'],
      ['/os/controlling', 'business', 'business', 's', 'controlling'],
      ['/os/finanzplan?u=buchungen&monat=8&space=business', 'privat', 'finanzplanung', 'u', 'buchungen'],
      ['/os/finanzen/grundlage', 'privat', 'finanzplanung', 'alt', 'grundlage'],
      ['/os/finanzen/dashboard', 'privat', 'finanzplanung', 'alt', 'v1'],
      ['/os/business?f=kdv&k=runway', 'business', 'business', 'k', 'runway'],
    ] as const;
    for (const [alt, bereich, reiter, k, v] of f) {
      const neu = await folge(alt);
      expect(neu.startsWith('/os/finanzen?'), alt).toBe(true);
      const o = ort(neu, { gemerkt: bereich === 'privat' ? 'business' : 'privat', haushalt: true });
      expect([alt, o.bereich, o.reiter]).toEqual([alt, bereich, reiter]);
      expect(new URLSearchParams(neu.split('?')[1]).get(k), alt).toBe(v);
    }
    expect(ort(await folge('/os/controlling'), { haushalt: true }).unter).toBe('controlling');
    // 08.10. abends: das alte Blatt ?u=buchungen ist ein Abschnitt des Blatts Monat — die Planung schreibt die Adresse auf Monat #buchungen um.
    const fp = new URLSearchParams((await folge('/os/finanzplan?u=buchungen&monat=8&space=business')).split('?')[1]);
    expect(blattAus(fp.get('u'), 'privat')).toEqual({ u: 'monat', abschnitt: 'buchungen', alt: true });
    // Buchungen einer Privat-Einheit (z. B. der Selbstständigkeit) landen unter Privat › Konten & Buchungen.
    if (PRIVAT_GESELLSCHAFTEN.length) expect(ort(await folge(`/os/finanzen/buchungen?ort=${PRIVAT_GESELLSCHAFTEN[0]}`))).toEqual({ bereich: 'privat', reiter: 'konten', unter: 'firma' });
  });
});

describe('Aufräumen Etappe 2 — der Bereich', () => {
  it('?space= gewinnt, sonst der Reiter, sonst der Kopf-Schalter („Alles“/ohne = Privat)', () => {
    expect(ort('?s=rechnungen&space=privat').reiter).toBe('privat'); // Business-Reiter gibt es unter Privat nicht → Überblick
    expect(ort('?s=rechnungen').bereich).toBe('business');
    expect(ort('?s=privat&t=fixkosten')).toEqual({ bereich: 'privat', reiter: 'konten', unter: 'fixkosten' });
    expect(ort('?s=gesamt')).toEqual({ bereich: 'privat', reiter: 'privat', unter: null });
    expect(ort('', { gemerkt: null }).bereich).toBe('privat');
    expect(ort('', { gemerkt: 'business' })).toEqual({ bereich: 'business', reiter: 'business', unter: 'business' });
    expect(ort('?s=chef&space=privat')).toEqual({ bereich: 'privat', reiter: 'chef', unter: null });
  });
  it('ohne Haushalt immer Business — nie ein privater Reiter', () => {
    for (const a of ['?s=privat', '?s=privat&t=buchungen', '?space=privat&s=finanzplanung', '?s=gesamt', `?s=buchungen&ort=${PRIVAT_GESELLSCHAFTEN[0] ?? 'kdc'}`]) {
      const o = ort(a, { haushalt: false });
      expect(o.bereich, a).toBe('business');
      expect(['privat', 'konten'], a).not.toContain(o.reiter);
    }
  });
  it('Adressen tragen immer den Bereich (Kopf und Leiste zeigen denselben Space)', () => {
    for (const r of [...PRIVAT_REITER, ...HAUSHALT_UNTER]) expect(finanzAdresse('privat', r.id)).toContain('space=privat');
    for (const r of [...BUSINESS_REITER, ...UEBERBLICK_UNTER]) expect(finanzAdresse('business', r.id)).toContain('space=business');
    expect(ort(finanzAdresse('privat', 'konten'))).toEqual({ bereich: 'privat', reiter: 'konten', unter: 'buchungen' });
    expect(ort(finanzAdresse('business', 'buchungen'))).toEqual({ bereich: 'business', reiter: 'buchungen', unter: null });
  });
});

describe('Aufräumen Etappe 2 — ein Name, ein Ort', () => {
  it('jeder Finanz-Weg zeigt auf /os/finanzen mit einem echten Ort', () => {
    const wege = [WEG.rechnung('r1'), WEG.rechnungen(), WEG.zahlung('z1'), WEG.planposten('p1'), WEG.kontostaende(), WEG.liquiditaet(), WEG.controlling(),
      WEG.buchungen({ monat: '2026-08' }), WEG.grundlage(), WEG.altbestand(), WEG.gesamt(), WEG.chef(), WEG.steuern(), WEG.privat('buchungen'), WEG.business({ k: 'runway' })];
    for (const w of wege) {
      expect(w.split(/[?#]/)[0], w).toBe('/os/finanzen');
      expect(FINANZ_S as readonly string[], w).toContain(new URLSearchParams(w.split(/[?#]/)[1]).get('s'));
    }
    expect(WEG.kontostaende().endsWith('#kontostaende')).toBe(true);
    expect(WEG.gesamt()).toBe('/os/finanzen?s=privat#gesamt');
  });
  it('die Schnellsuche kennt jeden Ort unter „Finanzen“, keiner führt auf eine alte Adresse', () => {
    const f = SEITEN_SUCHE.filter(s => s.titel.startsWith('Finanzen'));
    expect(f.length).toBeGreaterThanOrEqual(12);
    for (const s of f) expect(s.href.split(/[?#]/)[0], s.id).toBe('/os/finanzen');
  });
  it('„Zahlen“ ist als Bereichsname nirgends mehr sichtbar (nur in Kommentaren)', () => {
    const code = [...dateien('components', /\.tsx?$/), ...dateien('lib', /\.tsx?$/), ...dateien('app', /\.tsx?$/)];
    const funde: string[] = [];
    for (const f of code) lies(f).split('\n').forEach((z, i) => {
      const t = z.trim();
      if (/^(\/\/|\*|\/\*|\{\/\*)/.test(t)) return;
      const ohneKommentar = z.replace(/\s\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '');
      if (/Zahlen (→|›)|titel="Zahlen"|label: 'Zahlen'|>Zahlen ›</.test(ohneKommentar)) funde.push(`${f}:${i + 1}`);
    });
    expect(funde).toEqual([]);
    expect(lies('components/os/FinanzenView.tsx')).toContain('titel="Finanzen"');
  });
});

// ─── 08.10. abends (Fragebogen Teil 3 Frage 10): die Blätter der Planung zusammengelegt ─────────────────────────────────────
// Kevin: „Vorschlag so übernehmen · MAKE und KD Ventures zusammen als ‚Gesellschaften‘ · Wochen-Check bleibt eigenes Blatt“.
// Jede alte Adresse ?u=<früheres Blatt> führt auf das neue Blatt + Abschnitt (Adress-Logik `blattAus`, die Planung schreibt per router.replace um).
describe('Aufräumen Etappe 2 — Blätter der Planung (08.10. abends)', () => {
  /** Alt → [Privat, Business] (Blatt#Abschnitt) — so steht es im angenommenen Vorschlag; private fallen in Business auf die Lage zurück (wie bis 08.10.). */
  const ALT: Record<string, [string, string]> = {
    lage: ['lage', 'lage'], check: ['check', 'lage'], planen: ['planen', 'planen'], szenarien: ['szenarien', 'szenarien'],
    ziele: ['planen#ziele', 'planen#ziele'], budget: ['monat#budget', 'lage'], buchungen: ['monat#buchungen', 'monat#buchungen'],
    privat: ['privat', 'lage'], selbst: ['selbst', 'lage'],
    ug: ['gesellschaften#ug', 'gesellschaften#ug'], toepfe: ['gesellschaften#toepfe', 'gesellschaften#toepfe'], kdv: ['gesellschaften#kdv', 'gesellschaften#kdv'],
    gesamt: ['gesamt', 'gesamt'], entwicklung: ['gesamt#entwicklung', 'lage'], geldfluss: ['gesamt#geldfluss', 'lage'],
    posten: ['faellig#posten', 'faellig#posten'], kalender: ['faellig#kalender', 'faellig#kalender'], schulden: ['faellig#schulden', 'faellig#schulden'],
    protokoll: ['szenarien#protokoll', 'szenarien#protokoll'],
  };
  const text = (z: ReturnType<typeof blattAus>) => (z.abschnitt ? `${z.u}#${z.abschnitt}` : z.u);
  it('Privat 9 Blätter, Business 6 — in dieser Reihenfolge; Annahmen & Steuern hinter dem Zahnrad, nicht als Pille', () => {
    expect(blaetterFuer('privat').map(b => b.id)).toEqual(['lage', 'check', 'planen', 'monat', 'privat', 'selbst', 'gesellschaften', 'gesamt', 'faellig']);
    expect(blaetterFuer('business').map(b => b.id)).toEqual(['lage', 'planen', 'monat', 'gesellschaften', 'gesamt', 'faellig']);
    expect(blaetterFuer('privat').find(b => b.id === 'check')?.label).toBe('Wochen-Check');
    for (const s of ['privat', 'business'] as const) expect(blaetterFuer(s).map(b => b.id)).not.toContain(ZAHNRAD.id);
    expect(lies('components/os/finanzplan/Finanzplan.tsx')).toMatch(/<Settings [^>]*\/>/);
  });
  it('jede alte Kennung (?u=…) landet in beiden Sichten auf dem richtigen Blatt und Abschnitt', () => {
    for (const [alt, [p, b]] of Object.entries(ALT)) {
      expect(text(blattAus(alt, 'privat')), `${alt} privat`).toBe(p);
      expect(text(blattAus(alt, 'business')), `${alt} business`).toBe(b);
    }
    // Neue Kennungen bleiben, wie sie sind; Unbekanntes → Lage.
    for (const b of blaetterFuer('privat')) expect(blattAus(b.id, 'privat')).toEqual({ u: b.id, alt: false });
    expect(blattAus('quatsch', 'privat')).toEqual({ u: 'lage', alt: false });
    expect(blattAus(null, 'business')).toEqual({ u: 'lage', alt: false });
  });
  it('Abschnitte: private gibt es in der Business-Sicht nicht; jeder Abschnitt steht auf genau einem Blatt', () => {
    const alle = (Object.keys(ABSCHNITTE) as Unterseite[]).flatMap(u => ABSCHNITTE[u].map(a => a.id));
    expect(new Set(alle).size).toBe(alle.length);
    for (const u of Object.keys(ABSCHNITTE) as Unterseite[]) for (const a of abschnitteFuer(u, 'business')) expect(NUR_PRIVAT_ABSCHNITTE).not.toContain(a.id);
    expect([...NUR_PRIVAT_ABSCHNITTE].sort()).toEqual(['budget', 'entwicklung', 'geldfluss']);
    expect(abschnitteFuer('monat', 'business').map(a => a.id)).toEqual(['buchungen']);
    expect(abschnitteFuer('gesellschaften', 'business').map(a => a.id)).toEqual(['ug', 'toepfe', 'kdv']);
  });
  it('die Adresse trägt Blatt und Anker; alte Parameter (Monat, Zeile, Szenario, Steuern) bleiben', () => {
    const z = blattAus('buchungen', 'privat');
    expect(finanzplanAdresse('privat', { u: z.u, monat: 8, zeile: 'pb1' }, z.abschnitt as AbschnittId)).toBe('/os/finanzen?s=finanzplanung&space=privat&u=monat&monat=8&zeile=pb1#buchungen');
    const f = lies('components/os/finanzplan/Finanzplan.tsx');
    expect(f).toContain('router.replace(adresse(z.u, new URLSearchParams(params.toString()), z.abschnitt)');
    expect(f).toContain('alteAdresseUmschreiben(uRoh, sicht)');
  });
  it('alte Adresse wird höchstens einmal umgeschrieben (keine Schleife) und behält jeden Parameter', () => {
    // Was die Seite mit router.replace tut: Ziel aus `alteAdresseUmschreiben`, Adresse mit allen bisherigen Parametern (u ersetzt).
    const umschreiben = (adresse: string, sicht: 'privat' | 'business') => {
      const q = new URLSearchParams(adresse.split(/[?#]/)[1] ?? '');
      const z = alteAdresseUmschreiben(q.get('u'), sicht);
      if (!z) return null;
      q.set('u', z.u);
      return finanzplanAdresse(sicht, q, z.abschnitt);
    };
    for (const sicht of ['privat', 'business'] as const) {
      for (const alt of Object.keys(ALT)) {
        const start = `/os/finanzen?s=finanzplanung&space=${sicht}&u=${alt}&monat=8&zeile=pb1&sz=s2&feld=preis&steuern=kdv`;
        const neu = umschreiben(start, sicht);
        if (!istAbschnittId(alt)) { expect(neu, `${alt} ${sicht}: ein Blatt bleibt stehen`).toBeNull(); continue; }
        expect(neu, `${alt} ${sicht}`).not.toBeNull();
        // Ein zweiter Durchlauf (die Seite rendert mit der neuen Adresse) schreibt nichts mehr um — keine Schleife.
        expect(umschreiben(neu!, sicht), `${alt} ${sicht}: zweiter Durchlauf`).toBeNull();
        const q = new URLSearchParams(neu!.split(/[?#]/)[1]);
        expect(q.get('u'), `${alt} ${sicht}`).toBe(blattAus(alt, sicht).u);
        for (const [k, v] of [['monat', '8'], ['zeile', 'pb1'], ['sz', 's2'], ['feld', 'preis'], ['steuern', 'kdv'], ['s', 'finanzplanung'], ['space', sicht]]) expect(q.get(k), `${alt} ${sicht} ${k}`).toBe(v);
        const anker = neu!.split('#')[1];
        expect(anker, `${alt} ${sicht}: Anker`).toBe(blattAus(alt, sicht).abschnitt);
      }
    }
    // Nichts zum Umschreiben: kein u, neues Blatt, Unbekanntes.
    for (const u of [null, '', 'monat', 'gesellschaften', 'quatsch']) expect(alteAdresseUmschreiben(u, 'privat')).toBeNull();
  });
});
