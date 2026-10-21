// ─── Prozesse · die Landkarte schön (21.10. abends; Befunde aus dem ersten Blick bei 1440 px mit Demo-Daten) ────────────────────────────────────
// Rein (ohne DOM): Text nie mitten im Wort (lib/text/umbruch.ts), keine Kachel schmaler als ihr längstes Wort, in der Gesamtansicht nur kurze Übergaben
// zwischen Nachbarn und keine zwei davon über Kreuz, die Fliege bleibt eine Fliege bei 1, 10 und 40 Kacheln je Flügel (kein Turm), lange Wege nur mit Fokus,
// der Bereich einer Vorlage (Etappe B) wird gelesen, keine feste Veranstaltungsmarke im Register, Ebene 2 und 3 ohne Kreuzungen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fliegeLage, prozessLage, pfeileImBild, kachelBreite, kachelTitel, KACHEL_TEXT, FLIEGE, verteilen, type FliegeLage } from '@/lib/prozesse/landkarte';
import { kurve, wegeKreuzen, wegPunkt } from '@/lib/prozesse/lage';
import { stufeVon, alsListe, alsVorlage } from '@/lib/prozesse/modell';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { KERN_STUFEN, type KernStufe, type ProzessDef } from '@/lib/prozesse/typen';
import { MARKE_EVENTS } from '@/lib/crm/marke';
import { einpassen, stueckeVon, stueckBreiteMax, textBreite, silbenTeilen, trennStellen } from '@/lib/text/umbruch';
import { textZeilen } from '@/components/os/ui/reise/flaeche-formen';
import { flaecheBild, pfeileKreuzen } from '@/lib/fulfillment/prozesse/flaeche';
import type { Box } from '@/lib/fulfillment/prozesse/flaeche';
import { demoProzesse, viele } from './fixtures/prozesse-demo';

const ueberlappt = (a: Box, b: Box) => a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h;
/** Zeilen wieder zu Text (hinter einem Trennstrich am Zeilenende ohne Leerzeichen). */
const zusammen = (z: readonly string[]) => z.reduce((t, l) => (!t ? l : /[-/]$/.test(t) ? t + l : `${t} ${l}`), '');
const norm = (t: string) => t.trim().split(/\s+/).join(' ');

describe('Text nie mitten im Wort (Befund 2: „Cockpit-Einführun g“)', () => {
  it('Stücke: Wörter, lange zusammengesetzte hinter dem Bindestrich geteilt (der Strich bleibt vorn)', () => {
    expect(stueckeVon('Cockpit-Einführung Lumen')).toEqual([{ t: 'Cockpit-', leer: false }, { t: 'Einführung', leer: false }, { t: 'Lumen', leer: true }]);
    expect(stueckeVon('Vertriebs-Kreislauf').map(s => s.t)).toEqual(['Vertriebs-', 'Kreislauf']);
    expect(stueckeVon('E-Mail').map(s => s.t)).toEqual(['E-Mail']); // erst ab zwei Zeichen davor
    expect(stueckeVon('Lead → SQL').map(s => s.t)).toEqual(['Lead', '→', 'SQL']);
  });
  it('einpassen: nur an Wortgrenzen bzw. hinter Bindestrichen; ein zu langes Wort macht die Schrift kleiner (bis min) statt es zu teilen', () => {
    const e = einpassen({ text: 'Cockpit-Einführung', breite: 250, groesse: 28, min: 24, gewicht: 700 });
    expect(e.zeilen).toEqual(['Cockpit-', 'Einführung']);
    expect(e.voll).toBe(true);
    // Ein Wort ohne Bindestrich, das in 28 px nicht passt: kleiner, aber ganz.
    const w = einpassen({ text: 'Betroffenenrechte', breite: 248, groesse: 28, min: 22, gewicht: 700 });
    expect(w.zeilen).toEqual(['Betroffenenrechte']);
    expect(w.groesse).toBeLessThan(28);
    expect(w.groesse).toBeGreaterThanOrEqual(22);
    expect(textBreite('Betroffenenrechte', w.groesse, 700)).toBeLessThanOrEqual(248);
    // Zu viel Text für die Zeilen: die letzte endet mit „…“ an einer Wortgrenze, nie in einem Wort.
    const v = einpassen({ text: 'Ein sehr langer Titel für einen Schritt mit vielen Wörtern darin', breite: 180, groesse: 15, min: 13, zeilen: 2 });
    expect(v.voll).toBe(false);
    expect(v.zeilen).toHaveLength(2);
    expect(v.zeilen[1].endsWith('…')).toBe(true);
    for (const w2 of zusammen(v.zeilen).replace('…', '').split(' ')) expect('Ein sehr langer Titel für einen Schritt mit vielen Wörtern darin'.split(' ')).toContain(w2);
    expect(einpassen({ text: '   ', breite: 100, groesse: 14 })).toEqual({ zeilen: [], groesse: 14, voll: true });
  });
  it('alle Titel der Demo-Landkarte stehen in jeder Zoomstufe ganz da — jede Zeile aus ganzen Wörtern bzw. Wortteilen hinter einem Bindestrich', () => {
    const L = demoProzesse();
    const lage = fliegeLage(L);
    for (const k of lage.kacheln) {
      const p = L.find(x => x.id === k.id)!;
      for (const st of ['fern', 'mittel', 'nah'] as const) {
        const t = KACHEL_TEXT[st];
        const text = kachelTitel(p, st);
        const e = einpassen({ text, breite: k.b - t.innen, groesse: t.groesse, min: t.min, zeilen: t.zeilen, gewicht: t.gewicht });
        expect(e.voll, `${p.id} ${st}: ${e.zeilen.join(' | ')}`).toBe(true);
        expect(norm(zusammen(e.zeilen)), `${p.id} ${st}`).toBe(norm(text));
        const stuecke = new Set(stueckeVon(text).map(s => s.t));
        for (const z of e.zeilen) for (const teil of z.split(' ')) if (!stuecke.has(teil)) expect(stueckeVon(teil).every(s => stuecke.has(s.t)), `${p.id} ${st}: „${teil}“`).toBe(true);
        expect(e.groesse).toBeGreaterThanOrEqual(t.min);
      }
    }
  });
  it('die Formen der Fläche (feste 13–15 px): erst hinter dem Bindestrich, dann an einer Silbengrenze mit Trennstrich — nie „Einführun g“', () => {
    expect(textZeilen('Cockpit-Einführung', 140, 15)).toEqual(['Cockpit-', 'Einführung']);
    const z = textZeilen('Entscheidungsdatum genannt?', 115, 13, 3);
    expect(z[0].endsWith('-')).toBe(true);
    expect(zusammen(z).replace(/-(?=\p{Ll})/u, '')).toBe('Entscheidungsdatum genannt?');
    expect(textZeilen('Kick-off planen', 200, 15)).toEqual(['Kick-off planen']);
    // Silbengrenzen: vor einem Mitlaut mit Selbstlaut dahinter; „sch“, „ch“, „ck“ bleiben zusammen, links und rechts mindestens zwei Zeichen.
    for (const t of silbenTeilen('Entscheidungsdatum', 12)) expect([...t].length).toBeLessThanOrEqual(12);
    expect(silbenTeilen('Entscheidungsdatum', 12)[0]).toBe('Entschei-');
    expect(trennStellen('Zucker')).toEqual([2]); // Zu-cker
    expect(trennStellen('Wirtschaft').map(i => 'Wirtschaft'.slice(0, i))).not.toContain('Wirts');
  });
});

describe('Kacheln sind nie schmaler als ihr längstes Wort', () => {
  const pruefe = (lage: FliegeLage, L: readonly ProzessDef[]) => {
    for (const k of lage.kacheln) {
      const p = L.find(x => x.id === k.id)!;
      for (const st of ['fern', 'mittel', 'nah'] as const) {
        const t = KACHEL_TEXT[st];
        expect(stueckBreiteMax(kachelTitel(p, st), t.min, t.gewicht), `${p.id} ${st}`).toBeLessThanOrEqual(k.b - t.innen);
      }
    }
  };
  it('Register und Demo-Vorlagen: alle Kacheln gleich breit (ruhiges Raster), jedes Wort passt in der kleinsten Schrift', () => {
    const L = demoProzesse();
    const lage = fliegeLage(L);
    expect(new Set(lage.kacheln.map(k => k.b)).size).toBe(1);
    expect(lage.kacheln[0].b).toBeGreaterThanOrEqual(FLIEGE.kachel.b);
    pruefe(lage, L);
  });
  it('ein sehr langes Wort macht alle Kacheln breiter — statt es zu trennen', () => {
    const lang: ProzessDef = { ...viele(1, 'sales')[0], id: 'lang', titel: 'Datenschutzgrundverordnungsbeauftragtenbestellung' };
    const L = [...SYSTEM_PROZESSE, lang];
    expect(kachelBreite(L)).toBeGreaterThan(FLIEGE.kachel.b);
    pruefe(fliegeLage(L), L);
  });
});

describe('Übergaben: in der Gesamtansicht nur kurz, ruhig und nie über Kreuz (Befund 1)', () => {
  const faelle: [string, ProzessDef[]][] = [
    ['Register', [...SYSTEM_PROZESSE]],
    ['Demo', demoProzesse()],
    ['40 je Flügel', [...SYSTEM_PROZESSE, ...viele(40, 'fulfillment'), ...viele(40, 'marketing')]],
  ];
  for (const [name, L] of faelle) {
    it(`${name}: keine zwei Wege der Gesamtansicht kreuzen sich, keiner läuft durch eine Kachel`, () => {
      const lage = fliegeLage(L);
      const immer = lage.pfeile.filter(p => p.sicht === 'immer');
      expect(immer.length).toBeGreaterThan(0);
      for (let i = 0; i < immer.length; i++) for (let j = i + 1; j < immer.length; j++) expect(wegeKreuzen(immer[i].punkte, immer[j].punkte), `${immer[i].id} × ${immer[j].id}`).toBe(false);
      for (const p of immer) {
        for (const k of lage.kacheln.filter(k => k.id !== p.von && k.id !== p.nach)) {
          for (const [x, y] of p.punkte) expect(x > k.x + 1 && x < k.x + k.b - 1 && y > k.y + 1 && y < k.y + k.h - 1, `${p.id} durch ${k.id}`).toBe(false);
        }
      }
    });
  }
  it('kurz heißt: Nachbarn (benachbarte Spalten bzw. übereinander in derselben Hälfte); alles andere nur mit Fokus', () => {
    const lage = fliegeLage(demoProzesse());
    const nach = new Map(lage.kacheln.map(k => [k.id, k]));
    for (const p of lage.pfeile.filter(x => x.sicht === 'immer')) {
      const a = nach.get(p.von)!, b = nach.get(p.nach)!;
      const dx = Math.abs(a.x - b.x);
      expect(dx === 0 ? Math.abs(a.y - b.y) <= a.h + FLIEGE.zeile + 0.5 : dx <= a.b + FLIEGE.spalte + 0.5, p.id).toBe(true);
    }
    // Lange und bandübergreifende Wege stehen nicht in der Gesamtansicht.
    const fern = new Set(lage.pfeile.filter(x => x.sicht === 'fokus').map(x => x.id));
    for (const id of ['sp-vertriebsplanung>sp-kampagnen', 'sp-uebergabe>sp-rechnung', 'sp-wiederkauf>sp-deal', 'sp-treppe>sp-deal', 'sp-rechnung>sp-monatsabschluss']) expect(fern.has(id), id).toBe(true);
    for (const id of ['sp-lead-sql>sp-deal', 'sp-deal>sp-uebergabe', 'sp-uebergabe>sp-lieferung']) expect(fern.has(id), id).toBe(false);
  });
  it('mit Fokus: die Wege der Kachel kommen dazu, hell; beim Präsentieren nur die nach vorn', () => {
    const lage = fliegeLage(demoProzesse());
    const ohne = pfeileImBild(lage.pfeile, []);
    expect(ohne.every(w => w.pfeil.sicht === 'immer' && !w.hell)).toBe(true);
    const mit = pfeileImBild(lage.pfeile, ['sp-deal']);
    const ids = mit.filter(w => w.hell).map(w => w.pfeil.id).sort();
    expect(ids).toEqual(['sp-deal>sp-uebergabe', 'sp-lead-sql>sp-deal', 'sp-treppe>sp-deal', 'sp-wiederkauf>sp-deal']);
    expect(mit.length).toBe(ohne.length + 2);
    expect(mit.at(-1)!.hell).toBe(true); // helle Wege oben
    const vor = pfeileImBild(lage.pfeile, ['sp-deal'], { nurAus: true });
    expect(vor.filter(w => w.hell).map(w => w.pfeil.id)).toEqual(['sp-deal>sp-uebergabe']);
    // Jeder Weg mit Fokus hat eine Beschriftung an seinem Weg.
    for (const w of mit.filter(x => x.hell)) expect(w.pfeil.textOrt.every(Number.isFinite)).toBe(true);
  });
  it('lange Wege laufen nie in der Gasse entlang (dort ist der Weg des Kunden) — sie kreuzen sie höchstens', () => {
    const lage = fliegeLage(demoProzesse());
    const m = lage.fliege.mitte, g = FLIEGE.gasse / 2 - 4;
    for (const p of lage.pfeile.filter(x => x.sicht === 'fokus')) {
      for (let i = 1; i < p.punkte.length; i++) {
        const [a, b] = [p.punkte[i - 1], p.punkte[i]];
        const waagerecht = a[1] === b[1];
        if (waagerecht && Math.abs(a[1] - m) < g) expect(Math.abs(a[0] - b[0]), `${p.id} läuft in der Gasse`).toBeLessThan(100);
      }
    }
  });
  it('Kurven: Anfang und Ende stimmen, Beschriftung auf dem Weg; Kreuzungstest erkennt ein X', () => {
    const k = kurve([0, 0], [100, 50]);
    expect(k[0]).toEqual([0, 0]);
    expect(k.at(-1)).toEqual([100, 50]);
    expect(wegPunkt([[0, 0], [100, 0]], 0.5)).toEqual([50, 0]);
    expect(wegeKreuzen([[0, 0], [10, 10]], [[0, 10], [10, 0]])).toBe(true);
    expect(wegeKreuzen([[0, 0], [10, 0]], [[0, 5], [10, 5]])).toBe(false);
  });
});

describe('Die Fliege bleibt eine Fliege — bei 1, 10 und 40 Kacheln je Flügel (Befund 3 und 4)', () => {
  const fluegel = (n: number, paar: [KernStufe, KernStufe], tag: string): ProzessDef[] => [...viele(Math.ceil(n / 2), paar[0], `${tag}a`), ...viele(Math.floor(n / 2), paar[1], `${tag}b`)];
  const formPruefen = (L: readonly ProzessDef[], name: string) => {
    const lage = fliegeLage(L);
    const { spalten, mitte } = lage.fliege;
    const knoten = spalten.find(s => s.seite === 'knoten')!;
    for (const seite of ['links', 'rechts'] as const) {
      const s = spalten.filter(x => x.seite === seite).sort((a, b) => a.tiefe - b.tiefe);
      // Vom Knoten nach außen steigt der Umriss immer (mindestens um die Weitung): links verengt es sich zur Übergabe, rechts weitet es sich.
      let davor = knoten.halb;
      for (const x of s) { expect(x.halb, `${name} ${seite} ${x.stufe}:${x.tiefe}`).toBeGreaterThanOrEqual(davor + FLIEGE.weitung - 0.1); davor = x.halb; }
      // Kein Turm: jede Spalte trägt höchstens so viele Zeilen je Hälfte, wie ihre Tiefe erlaubt.
      for (const x of s) expect(x.inhalt, `${name} ${x.stufe}:${x.tiefe}`).toBeLessThanOrEqual(FLIEGE.gasse / 2 + x.zeilen * FLIEGE.kachel.h + (x.zeilen - 1) * FLIEGE.zeile + FLIEGE.luft + 0.1);
      // Der Flügel ist breiter als hoch-geteilt-durch-drei (nie ein schmaler hoher Block).
      const breit = Math.max(...s.map(x => x.x + x.b)) - Math.min(...s.map(x => x.x));
      expect(breit, `${name} ${seite}`).toBeGreaterThan((2 * Math.max(...s.map(x => x.halb))) / 3);
    }
    // Jede Kachel des Kerns liegt in ihrer Spalte und im Umriss; keine überlappt; die Stufen stehen in ihrer Reihenfolge von links nach rechts.
    for (const k of lage.kacheln.filter(x => x.band === 'kern')) {
      const sp = spalten.find(x => x.x === k.x && x.stufe === k.stufe)!;
      expect(sp, `${name} ${k.id}`).toBeTruthy();
      expect(k.y >= mitte - sp.halb - 0.1 && k.y + k.h <= mitte + sp.halb + 0.1, `${name} ${k.id} im Umriss`).toBe(true);
    }
    for (let i = 0; i < lage.kacheln.length; i++) for (let j = i + 1; j < lage.kacheln.length; j++) expect(ueberlappt(lage.kacheln[i], lage.kacheln[j]), `${name} ${lage.kacheln[i].id} × ${lage.kacheln[j].id}`).toBe(false);
    const xs = KERN_STUFEN.map(s => lage.fliege.stufen.find(x => x.id === s.id)!);
    for (let i = 1; i < xs.length; i++) expect(xs[i].x, name).toBeGreaterThan(xs[i - 1].x + xs[i - 1].b - 0.1);
    return lage;
  };
  for (const n of [1, 10, 40]) {
    it(`${n} je Flügel (auf beide Stufen verteilt und alle in einer Stufe)`, () => {
      formPruefen([...fluegel(n, ['marketing', 'sales'], 'l'), ...fluegel(n, ['fulfillment', 'ausbau'], 'r')], `${n} verteilt`);
      formPruefen([...viele(n, 'sales'), ...viele(n, 'fulfillment')], `${n} innen`);
      formPruefen([...SYSTEM_PROZESSE, ...viele(n, 'marketing'), ...viele(n, 'ausbau')], `${n} außen + Register`);
    });
  }
  it('Demo: die Fulfillment-Vorlagen stehen in zwei Spalten statt in einem Turm; Reihenfolge stabil (Spalte für Spalte, oben → unten)', () => {
    const L = demoProzesse();
    const lage = formPruefen(L, 'Demo');
    const ff = lage.fliege.spalten.filter(s => s.stufe === 'fulfillment');
    expect(ff.length).toBe(2);
    const ids = L.filter(p => p.band === 'kern' && stufeVon(p) === 'fulfillment').map(p => p.id);
    const gelegt = lage.kacheln.filter(k => k.stufe === 'fulfillment').sort((a, b) => a.x - b.x || a.y - b.y).map(k => k.id);
    expect(gelegt).toEqual(ids);
    // Die Spalte außen trägt nie weniger als die innen (die Form weitet sich).
    const n = ff.sort((a, b) => a.tiefe - b.tiefe).map(s => lage.kacheln.filter(k => k.x === s.x).length);
    expect(n[1]).toBeGreaterThanOrEqual(n[0]);
    // Genau wie die Liste: dieselbe Stufe je Prozess.
    expect(alsListe(L).find(b => b.id === 'kern')!.gruppen.find(g => g.id === 'fulfillment')!.prozesse.map(p => p.id)).toEqual(ids);
  });
  it('verteilen: anteilig nach Plätzen, der Rest nach außen, nie über die Plätze', () => {
    expect(verteilen(10, [4, 6])).toEqual([4, 6]);
    expect(verteilen(7, [4, 6])).toEqual([2, 5]);
    expect(verteilen(1, [4])).toEqual([1]);
    expect(verteilen(0, [4, 6])).toEqual([0, 0]);
    const v = verteilen(42, [4, 6, 8, 10, 12, 14]);
    expect(v.reduce((a, b) => a + b, 0)).toBe(42);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
  });
  it('die Flügel tragen die Töne ihrer Stufen von links nach rechts; der Knoten ist eine eigene Fläche um die Übergabe', () => {
    const lage = fliegeLage(demoProzesse());
    expect(lage.fliege.toene.map(t => t.stufe)).toEqual(KERN_STUFEN.map(s => s.id));
    for (let i = 1; i < lage.fliege.toene.length; i++) expect(lage.fliege.toene[i].bei).toBeGreaterThan(lage.fliege.toene[i - 1].bei);
    const k = lage.kacheln.find(x => x.stufe === 'uebergabe')!;
    const kn = lage.fliege.knoten;
    expect(kn.x < k.x && kn.x + kn.b > k.x + k.b && kn.y < k.y && kn.y + kn.h > k.y + k.h).toBe(true);
    // Die Titel der Stufen folgen der Form: außen höher als innen, der Knoten am tiefsten.
    const y = Object.fromEntries(lage.fliege.stufen.map(s => [s.id, s.titelY]));
    expect(y.marketing).toBeLessThan(y.sales);
    expect(y.sales).toBeLessThan(y.uebergabe);
    expect(y.ausbau).toBeLessThan(y.uebergabe);
  });
});

describe('Bereich je Vorlage (kommt mit Etappe B) und keine feste Marke', () => {
  it('ein Prozess mit `bereich` steht in dieser Stufe — Bild und Liste; ohne bzw. mit fremdem Wert wie bisher', () => {
    const v = { ...viele(1, 'fulfillment')[0], id: 'v-sales', bereich: 'sales' } as ProzessDef & { bereich: string };
    expect(stufeVon(v)).toBe('sales');
    expect(stufeVon({ stufe: 'ausbau', bereich: 'quatsch' })).toBe('ausbau');
    expect(stufeVon({})).toBe('fulfillment');
    const L = [...SYSTEM_PROZESSE, v];
    expect(fliegeLage(L).kacheln.find(k => k.id === 'v-sales')!.stufe).toBe('sales');
    expect(alsListe(L).find(b => b.id === 'kern')!.gruppen.find(g => g.id === 'sales')!.prozesse.map(p => p.id)).toContain('v-sales');
  });
  it('die Veranstaltungsmarke kommt aus MARKE_EVENTS (je Instanz) — nie als Text im Register', () => {
    const quelle = readFileSync(path.join(process.cwd(), 'lib/prozesse/register.ts'), 'utf8').split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
    expect(quelle).not.toMatch(/Make\.One/);
    expect(SYSTEM_PROZESSE.find(p => p.id === 'sp-makeone')!.titel).toBe(`Eigenes Event (${MARKE_EVENTS})`);
  });
});

describe('Ebene 2 und 3: ruhig und ohne Kreuzungen', () => {
  it('Geister: weiche Wege mit verteilten Anschlüssen — keine zwei kreuzen sich, keiner endet im selben Punkt', () => {
    for (const p of SYSTEM_PROZESSE) {
      const l = prozessLage(p, SYSTEM_PROZESSE);
      for (let i = 0; i < l.pfeile.length; i++) for (let j = i + 1; j < l.pfeile.length; j++) {
        expect(wegeKreuzen(l.pfeile[i].punkte, l.pfeile[j].punkte), `${p.id}: ${l.pfeile[i].id} × ${l.pfeile[j].id}`).toBe(false);
        expect(l.pfeile[i].punkte.at(-1)).not.toEqual(l.pfeile[j].punkte.at(-1));
      }
    }
  });
  it('Ablauf (die Fläche des Editors): kein Pfeil kreuzt einen anderen — auch „ja“ einer Entscheidung, deren „nein“ nach rechts geht', () => {
    for (const p of SYSTEM_PROZESSE) {
      const b = flaecheBild(alsVorlage(p));
      for (let i = 0; i < b.pfeile.length; i++) for (let j = i + 1; j < b.pfeile.length; j++) {
        expect(pfeileKreuzen(b.pfeile[i].punkte, b.pfeile[j].punkte), `${p.id}: ${b.pfeile[i].id} × ${b.pfeile[j].id}`).toBe(0);
      }
    }
  });
  it('pfeileKreuzen: Kreuz zählt, gemeinsamer Anfang nicht, ein Stück übereinander schon — außer zusammen in denselben Eingang', () => {
    expect(pfeileKreuzen([[0, 5], [10, 5]], [[5, 0], [5, 10]])).toBe(1);
    expect(pfeileKreuzen([[0, 0], [10, 0]], [[0, 0], [0, 10]])).toBe(0);
    expect(pfeileKreuzen([[0, 0], [0, 20], [30, 20]], [[0, 5], [0, 15], [-20, 15]])).toBe(1);
    expect(pfeileKreuzen([[0, 0], [0, 20]], [[20, 10], [0, 10], [0, 20]])).toBe(0);
  });
});
