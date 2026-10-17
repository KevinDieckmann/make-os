// ─── Reise + Fluss überall (17.10.) — Kevin: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung. Dann sieht
// das ganze System gleich klar aus.“ Wächter: die Reise-Bausteine liegen genau EINMAL (components/os/ui/reise, Typen lib/reise/bild.ts), das Fulfillment und
// die drei Bereiche nutzen sie, kein Bereich baut eine eigene Zeichnung; die Modelle rechnen nichts neu (Kreislauf aus `kreislauf`, Einrichtung über
// `einrichtungStand`/`istFertig`, Planung über `ketteOrdnen`/`aufgabenVonMeilenstein`); am Handy läuft die Reise senkrecht.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KAESTCHEN_MAX, sichtbareKaestchen } from '@/lib/reise/bild';
import { kreislaufSpalten, KUNDE_AB } from '@/lib/crm/kreislauf-bild';
import { einrichtungReise, etappenFluss, etappeId } from '@/lib/make-one/onboarding-bild';
import { einrichtungStand, schritteFuer, istFertig } from '@/lib/make-one/onboarding-data';
import { ketteSpalten, meilensteinFluss, erreichtId } from '@/lib/planung/kette-bild';
import { ketteOrdnen } from '@/lib/planung/meilenstein-kette';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import { ReiseBild } from '@/components/os/ui/reise/ReiseBild';
import type { Kreislauf } from '@/lib/crm/planung';
import type { Meilenstein } from '@/lib/planung/typen';
import type { Task } from '@/types/tasks';

const wurzel = process.cwd();
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(ordner: string): string[] {
  const raus: string[] = [];
  for (const e of readdirSync(path.join(wurzel, ordner))) {
    const p = `${ordner}/${e}`;
    if (statSync(path.join(wurzel, p)).isDirectory()) raus.push(...dateien(p));
    else if (/\.(tsx?|mts)$/.test(e)) raus.push(p);
  }
  return raus;
}
const ALLE = [...dateien('components'), ...dateien('lib'), ...dateien('app')];

describe('Wächter: die Reise-Bausteine liegen genau einmal', () => {
  it('ReiseBild, Fluss, KnotenKnopf, FormenLegende, FreigabeRaute, FormZeichen — je EINE Definition, alle unter components/os/ui/reise', () => {
    // `Fluss` heißt auch das Geldfluss-Diagramm der Finanzplanung (components/os/finanzplan/diagramme.tsx — ein anderes Bild); der Ablauf-Fluss ist generisch.
    for (const name of ['ReiseBild', 'Fluss<', 'KnotenKnopf', 'FormenLegende', 'FreigabeRaute', 'FormZeichen', 'Pfeil', 'SeitenPfeil']) {
      const orte = ALLE.filter(p => new RegExp(`export function ${name}${name.endsWith('<') ? '' : '\\b'}`).test(lies(p)));
      expect(orte, name).toHaveLength(1);
      expect(orte[0], name).toMatch(/^components\/os\/ui\/reise\//);
    }
    for (const [name, re] of [['sichtbareKaestchen', /export function sichtbareKaestchen\b/], ['FlussForm', /export type FlussForm\b/], ['KAESTCHEN_MAX', /export const KAESTCHEN_MAX\b/], ['JETZT', /export const JETZT\b/], ['FORM_FARBE', /export const FORM_FARBE\b/]] as const) {
      expect(ALLE.filter(p => re.test(lies(p))), name).toHaveLength(1);
    }
    // Die alten Orte im Fulfillment gibt es nicht mehr — das Fulfillment importiert vom gemeinsamen Ort (Verhalten unverändert, tests/fulfillment-*).
    expect(existsSync(path.join(wurzel, 'components/os/fulfillment/reise/ReiseBild.tsx'))).toBe(false);
    expect(existsSync(path.join(wurzel, 'components/os/fulfillment/reise/Fluss.tsx'))).toBe(false);
    expect(lies('components/os/fulfillment/reise/FallReise.tsx')).toContain("from '../../ui/reise/ReiseBild'");
    expect(lies('components/os/fulfillment/kunde/KundenAnsicht.tsx')).toContain("from '../../ui/reise/ReiseBild'");
    // Die gemeinsamen Bausteine holen keine Daten (die öffentliche Kunden-Seite bündelt sie mit).
    for (const p of dateien('components/os/ui/reise')) expect(lies(p), p).not.toMatch(/from '@\/lib\/(fulfillment|crm|planung|make-one\/onboarding)|fetch\(/);
  });

  it('Markttraktion › Kreislauf, Einrichtung und Planung › Ziel zeichnen mit denselben Bausteinen — keine eigene Reise, kein Ring', () => {
    const kreis = lies('components/os/crm/planung/Kreislauf.tsx');
    const ob = lies('components/os/OnboardingView.tsx');
    const ziel = lies('components/os/planung/ZielDetail.tsx');
    expect(kreis).toContain("import { ReiseBild } from '../../ui/reise/ReiseBild'");
    expect(kreis).toContain('kreislaufSpalten(');
    expect(kreis).not.toContain('function Ring(');
    expect(ob).toContain("import { ReiseBild } from './ui/reise/ReiseBild'");
    expect(ob).toContain("import { Fluss, FormenLegende } from './ui/reise/Fluss'");
    expect(ziel).toContain("import { ReiseBild } from '../ui/reise/ReiseBild'");
    expect(ziel).toContain("import { Fluss, FormenLegende } from '../ui/reise/Fluss'");
    for (const [p, q] of [['Kreislauf', kreis], ['Einrichtung', ob], ['Ziel', ziel]] as const) {
      expect(q, p).not.toMatch(/rotate\(45deg\)/); // die Raute kommt aus FreigabeRaute, nie nachgebaut
      expect(q, p).not.toMatch(/className="ff-reise/); // die Zeile zeichnet nur ReiseBild
    }
    // Planung: die Kette rechnet weiter lib/planung/meilenstein-kette.ts — das Bild nimmt nur ihre Reihe.
    expect(ziel).toContain('ketteSpalten(kette.reihe');
    expect(lies('lib/planung/kette-bild.ts')).not.toMatch(/wartetAuf\.sort|function ketteOrdnen/);
    // Einrichtung: Fortschritt nur über die vorhandenen Regeln.
    const obBild = lies('lib/make-one/onboarding-bild.ts');
    for (const f of ['einrichtungStand(', 'fortschrittVon(', 'istFertig(', 'schritteFuer(', 'zurueckgefallen(']) expect(obBild, f).toContain(f);
  });

  it('Handy (≤ 720 px): die Reise läuft senkrecht, nichts quer — auch ohne Band und im Kreislauf', () => {
    const css = lies('app/globals.css');
    const handy = css.slice(css.indexOf('@media (max-width: 720px) {\n  .ff-reise {'));
    expect(handy).toMatch(/^@media \(max-width: 720px\) \{\n {2}\.ff-reise \{ grid-template-columns: minmax\(0, 1fr\) !important; \}/);
    expect(handy).toContain('.ff-reise-zwischen { display: none; }');
    expect(handy).toContain('.ff-reise-laeuft:not(.ff-reise-aktiv) .ff-reise-kaestchen');
    // Die Zeilen ohne Band gelten nur am Rechner — am Handy bleibt `grid-template-rows: none` (senkrechte Liste).
    expect(css).toContain('@media (min-width: 721px) { .ff-reise-ohne-band > .ff-reise-spalte');
  });
});

describe('ReiseBild: ohne Band, „läuft“ (Kreislauf), eigenes Wort', () => {
  it('ohne Band kein Band, mit Wort „Etappe“; laufende Stufe ohne „Hier“, gewählte trägt ff-reise-aktiv', () => {
    const html = renderToStaticMarkup(h(ReiseBild, { band: false, wort: 'Etappe', aktiv: 'b', spalten: [
      { id: 'a', nr: 0, titel: 'A', zustand: 'laeuft', farbe: '#123456', kaestchen: [{ id: 'x', titel: '3 aktiv', zustand: 'offen' }], mehr: 0 },
      { id: 'b', nr: 1, titel: 'B', zustand: 'laeuft', kaestchen: [], mehr: 0, raute: { titel: 'B wartet darauf', gegeben: true, gegebenText: 'erledigt' } },
    ] }));
    expect(html).toContain('ff-reise-ohne-band');
    expect(html).not.toContain('ff-reise-band');
    expect(html).toContain('Etappe 0');
    expect(html).not.toContain('▾ Hier');
    expect(html).toMatch(/ff-reise-spalte ff-reise-laeuft ff-reise-aktiv/);
    expect(html).toContain('B wartet darauf · erledigt');
  });
  it('Vorgabe wie im Fulfillment: Band „Kunde“, Wort „Phase“, „vermerkt“', () => {
    const html = renderToStaticMarkup(h(ReiseBild, { spalten: [{ id: 'a', nr: 1, titel: 'A', zustand: 'jetzt', kaestchen: [], mehr: 5, raute: { titel: 'Abstimmungspunkt 1', gegeben: true } }], onPhase: () => {} }));
    expect(html).toContain('ff-reise-band');
    expect(html).toContain('Phase 1');
    expect(html).toContain('▾ Hier');
    expect(html).toContain('Abstimmungspunkt 1 · vermerkt');
    expect(html).toContain('5 weitere Schritte in „A“ zeigen');
  });
  it('Fenster-Regel: höchstens vier Kästchen, um „hier“', () => {
    const k = (z: 'erledigt' | 'hier' | 'offen') => ({ zustand: z });
    const l = [k('erledigt'), k('erledigt'), k('erledigt'), k('hier'), k('offen'), k('offen'), k('offen')];
    expect(sichtbareKaestchen(l, 'jetzt')).toHaveLength(KAESTCHEN_MAX);
    expect(sichtbareKaestchen(l, 'jetzt')[1].zustand).toBe('hier');
  });
});

describe('Markttraktion › Kreislauf als Reise — dieselben Zahlen, Band „Kunde“ ab Fulfillment', () => {
  const stufe = (id: Kreislauf['stufen'][number]['id'], anzahl: number, zusatz: string, x: Partial<Kreislauf['stufen'][number]> = {}) => ({ id, label: id, anzahl, zusatz, href: '/os/x', hrefLabel: 'öffnen', ...x });
  const k: Pick<Kreislauf, 'stufen'> = { stufen: [
    stufe('kanaele', 3, '12 Leads/Monat geplant', { plan: '12 neue Leads/Monat', ist: '9 neue Leads/Monat (Ø 3 Monate)' }),
    stufe('leads', 1200, '1500 Leads gesamt'), stufe('deals', 4, '18.000 € offen'),
    stufe('followup', 6, '2 überfällig', { haengt: 'rot' }), stufe('fulfillment', 2, '2 Produkt-Phasen · 1 im Paket'),
    stufe('nachher', 1, 'Upselling · Cross-Selling · Bewertung · Testimonial · Newsletter'), stufe('wiederkauf', 0, '1 offene Deals mit Bestandskunden'),
  ] };
  const EINHEIT = { kanaele: 'aktiv', leads: 'in Arbeit', deals: 'offen', followup: 'fällig', fulfillment: 'aktiv', nachher: 'Kunden offen', wiederkauf: 'Kunden' } as const;
  it('alle Stufen laufen zugleich (kein „Hier“), Zahl mit Wort zuerst, höchstens vier Kästchen, Rest „+n“', () => {
    const sp = kreislaufSpalten(k, EINHEIT, () => '#000000');
    expect(sp.map(s => s.zustand)).toEqual(Array(7).fill('laeuft'));
    expect(sp[1].kaestchen[0].titel).toBe('1.200 in Arbeit');
    expect(sp[0].kaestchen.map(x => x.titel)).toEqual(['3 aktiv']); // der Zusatz sagt dasselbe wie „Plan“ — nur einmal
    for (const s of sp) expect(s.kaestchen.length).toBeLessThanOrEqual(KAESTCHEN_MAX);
    expect(sp[5].kaestchen.map(x => x.titel)).toEqual(['1 Kunden offen', 'Upselling', 'Cross-Selling', 'Bewertung']);
    expect(sp[5].mehr).toBe(2);
    expect(sp[3]).toMatchObject({ haengt: 'rot' });
    expect(sp[3].kaestchen[1]).toMatchObject({ titel: '2 überfällig', haengt: 'rot' });
  });
  it('das Band zeigt, wo der Kunde beginnt: gestrichelt bis vor Fulfillment, ab da mit Satz', () => {
    const sp = kreislaufSpalten(k, EINHEIT);
    const ab = sp.findIndex(s => s.id === KUNDE_AB);
    expect(ab).toBe(4);
    for (const s of sp.slice(0, ab)) expect(s.band).toEqual({ intern: true });
    expect(sp[ab].band).toEqual({ text: 'ab hier Kunde' });
    expect(sp.slice(ab).every(s => !s.band?.intern)).toBe(true);
  });
});

describe('Einrichtung als Reise — Etappen mit „Hier“, Schritte als Fluss', () => {
  const ICH = { inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, altbestand: false, betreiber: false };
  it('„Hier“ = die Etappe des nächsten Schritts (einrichtungStand), Kästchen über istFertig, ohne Betreiber keine Etappe 0', () => {
    const z = { erledigt: {}, befunde: {} };
    const r = einrichtungReise(ICH, z);
    const naechster = einrichtungStand(ICH, z).naechster!;
    expect(r.hier).toBe(etappeId(naechster.etappe));
    expect(r.spalten.filter(s => s.zustand === 'jetzt').map(s => s.id)).toEqual([r.hier]);
    expect(r.spalten.flatMap(s => s.kaestchen).filter(k => k.zustand === 'hier').map(k => k.id)).toEqual([naechster.id]);
    for (const s of r.spalten) expect(s.kaestchen.length).toBeLessThanOrEqual(KAESTCHEN_MAX);
    // Betreiber-Schritte nur in der Betreiber-Instanz (wie bisher).
    expect(schritteFuer(ICH).some(s => s.betreiber)).toBe(false);
    expect(r.spalten.flatMap(s => s.kaestchen).some(k => schritteFuer({ ...ICH, betreiber: true }).find(x => x.id === k.id)?.betreiber)).toBe(false);
  });
  it('alle Schritte einer Etappe abgehakt → Etappe erledigt; der Fluss zeigt jeden Schritt der Etappe, das Ende die nächste Etappe', () => {
    const erste = einrichtungReise(ICH, { erledigt: {}, befunde: {} }).spalten[0];
    const nr = Number(erste.id.slice(7));
    const schritte = schritteFuer(ICH).filter(s => s.etappe === nr && !s.pruefung);
    const z = { erledigt: Object.fromEntries(schritte.map(s => [s.id, { at: '2026-10-17T08:00:00Z', von: 'test' }])), befunde: {} };
    const fl = etappenFluss(ICH, z, nr)!;
    const knoten = fl.teile.flatMap(t => (t.art === 'linie' ? t.knoten : []));
    expect(knoten.map(k => k.id)).toEqual(schritteFuer(ICH).filter(s => s.etappe === nr).map(s => s.id));
    for (const k of knoten) expect(k.zustand === 'erledigt').toBe(istFertig(schritteFuer(ICH).find(s => s.id === k.id)!, z));
    expect(fl.start.titel).toBe('Los geht’s');
    expect(fl.naechste).toBe(Number(einrichtungReise(ICH, z).spalten[1].id.slice(7)));
  });
});

describe('Planung › Ziel — die Meilenstein-Kette als Reise', () => {
  const ms = (id: string, rang: number, x: Partial<Meilenstein> = {}): Meilenstein => ({ id, titel: `M ${id}`, rang, fortschritt: 0, space: 'business', zielId: 'z1', ...x } as Meilenstein);
  const aufgabe = (id: string, msId: string, status: Task['status'], sortOrder: number, x: Partial<Task> = {}): Task => ({ id, title: `A ${id}`, status, sortOrder, listeId: meilensteinListeId(msId), createdAt: '2026-10-01', ...x } as Task);
  const alle = [ms('c', 3, { wartetAuf: ['b'] }), ms('a', 1, { erledigt: true }), ms('b', 2, { wartetAuf: ['a'], faellig: '2026-10-10' })];
  const state = { tasks: [aufgabe('t1', 'b', 'done', 1), aufgabe('t2', 'b', 'todo', 2), aufgabe('t3', 'b', 'todo', 3, { dueDate: '2026-10-01' }), aufgabe('t4', 'b', 'todo', 4), aufgabe('t5', 'b', 'todo', 5), aufgabe('u1', 'b', 'todo', 6, { parentId: 't2' })] };
  const HEUTE = '2026-10-17';
  it('Reihenfolge der Kette, „Hier“ = der erste offene, Raute nur bei Abhängigkeit, höchstens vier Aufgaben (ohne Unteraufgaben)', () => {
    const reihe = ketteOrdnen(alle).reihe;
    const sp = ketteSpalten(reihe, state, HEUTE);
    expect(sp.map(s => s.id)).toEqual(['a', 'b', 'c']);
    expect(sp.map(s => s.zustand)).toEqual(['fertig', 'jetzt', 'offen']);
    expect(sp[0].raute).toMatchObject({ titel: '„M b“ wartet darauf', gegeben: true, gegebenText: 'erledigt' });
    expect(sp[1].raute).toMatchObject({ gegeben: false, hier: true });
    expect(sp[2].raute).toBeUndefined();
    expect(sp[1].kaestchen.length + sp[1].mehr).toBe(5);
    expect(sp[1].kaestchen.length).toBe(KAESTCHEN_MAX);
    expect(sp[1].kaestchen.find(k => k.zustand === 'hier')?.id).toBe('t2');
    expect(sp[1].haengt).toBe('rot'); // überfälliger Meilenstein
    // Ohne Abhängigkeit: Pfeil statt Raute.
    expect(ketteSpalten(ketteOrdnen([ms('x', 1), ms('y', 2)]).reihe, state, HEUTE)[0].raute).toBeUndefined();
  });
  it('Fluss eines Meilensteins: Start „Nach …“, seine Aufgaben, die Raute „erreicht?“, dann der nächste', () => {
    const reihe = ketteOrdnen(alle).reihe;
    const fl = meilensteinFluss(reihe, alle, state, HEUTE, 'b')!;
    expect(fl.start).toEqual({ titel: 'Nach', unter: '„M a“' });
    expect(fl.teile.flatMap(t => (t.art === 'linie' ? t.knoten : [])).map(k => [k.id, k.zustand])).toEqual([['t1', 'erledigt'], ['t2', 'hier'], ['t3', 'offen'], ['t4', 'offen'], ['t5', 'offen']]);
    expect(fl.teile.flatMap(t => (t.art === 'linie' ? t.knoten : [])).find(k => k.id === 't3')).toMatchObject({ haengt: 'gelb', unter: 'überfällig seit 01.10.' });
    expect(fl.abstimmung).toMatchObject({ id: erreichtId('b'), form: 'entscheidung', entscheid: true, zustand: 'offen', haengt: 'rot' });
    expect(fl.ende.titel).toBe('M c');
    expect(fl.naechster).toBe('c');
    expect(meilensteinFluss(reihe, alle, state, HEUTE, 'c')!.ende.titel).toBe('Ziel erreicht');
  });
});
