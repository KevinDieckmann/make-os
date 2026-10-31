// ─── Haushalt → Finanzplanung (31.10.): die Brücke ───────────────────────────────────────────────────────────────────────────────────────
// Übernahme der vier Arten (Ist-Monate, Fixkosten, Kredite, Kontostände), „Handwert gewinnt“, Schalter an/aus/offen, Vorschau ohne Schreiben,
// Trennung (Sicht Business bekommt nichts aus Privat) — rein und über die Route mit eigenem Datenordner. Erfundene, kleine Zahlen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-hhb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-hhb';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

import type { FinanzDaten } from '@/lib/finanzen/rechenkern';
import { leeresDokument, wendeOperationenAn, pruefeDokument, OperationUngueltig } from '@/lib/finanzen/plan/operationen';
import { mitHaushalt, uebernahme, ohneHaushalt, brueckeZustand, istHaushaltKennung, type HaushaltEingang, type PrivatRechner } from '@/lib/finanzen/plan/haushalt-bruecke';
import { businessSicht } from '@/lib/finanzen/plan/sicht';
import { schreibeAlsBusiness } from '@/lib/finanzen/plan/business-schreiben';
import { rechneMit, mitBereich, arbeitsplanFuer } from '@/lib/finanzen/szenarien';
import type { Buchung, Schuld } from '@/lib/finanzen/haushalt/typen';

const HEUTE = '2026-10-20';
const JETZT = '2026-10-20T10:00:00.000Z';
const rechne: PrivatRechner = d => rechneMit(mitBereich(d, 'privat'), arbeitsplanFuer(d, 'privat')).pr;

let n = 0;
const buchung = (datum: string, betragCent: number, empfaenger: string, teil: Partial<Buchung> = {}): Buchung => ({
  id: `b${++n}`, stand: 1, konto_id: 'kt1', datum, betrag: betragCent, beschreibung: '', empfaenger, kategorie_id: null, ist_umbuchung: false,
  ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: null, geaendert: JETZT, ...teil,
});
const schuld = (teil: Partial<Schuld> = {}): Schuld => ({
  id: 's1', stand: 1, bezeichnung: 'Ratenkredit Beispiel', glaeubiger: null, einheit: 'privat', startbetrag: 120000, restbetrag: 60000, rate: 10000,
  zinssatz: 0, rhythmus: 'monatlich', naechste_faelligkeit: '2026-11-01', endet_am: null, notiz: null, aus_buchung_id: null, ...teil,
});
function haushalt(): HaushaltEingang {
  const fix: Buchung[] = [];
  for (const m of ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) fix.push(buchung(`${m}-03`, -50000, 'Vermieter Beispiel', { ist_fixkosten: true, kategorie_id: 'kw' }));
  return {
    stamm: { kategorien: [
      { id: 'kw', stand: 1, name: 'Wohnen', typ: 'ausgabe', sortierung: 1, monatsbudget: null },
      { id: 'kg', stand: 1, name: 'Gehalt', typ: 'einnahme', sortierung: 2, monatsbudget: null },
      { id: 'kl', stand: 1, name: 'Lebensmittel', typ: 'ausgabe', sortierung: 3, monatsbudget: null },
      { id: 'kk', stand: 1, name: 'Kredit erhalten', typ: 'einnahme', sortierung: 4, monatsbudget: null },
    ], aliase: {}, konten: [{ id: 'kt1', stand: 1, name: 'Girokonto Beispiel', inhaber: null, einheit: 'privat', iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true }] },
    buchungen: [
      ...fix,
      buchung('2026-09-25', 300000, 'Arbeitgeber Beispiel', { kategorie_id: 'kg' }),
      buchung('2026-09-12', -8000, 'Markt Beispiel', { kategorie_id: 'kl' }),
      buchung('2026-09-14', -2000, 'Eigenes Sparkonto', { ist_umbuchung: true }),
      buchung('2026-08-01', 100000, 'Bank Beispiel', { kategorie_id: 'kk' }),
      buchung('2026-10-30', -999, 'Zukunft Beispiel'),                                    // nach heute: zählt nicht
      buchung('2026-09-10', -77700, 'Firma Beispiel', { einheit: 'ug' }),                 // nicht privat: zählt nicht
    ],
    schulden: [schuld(), schuld({ id: 's2', bezeichnung: 'Getilgt Beispiel', restbetrag: 0 }), schuld({ id: 's3', bezeichnung: 'Firmenkredit Beispiel', einheit: 'ug' })],
  };
}
const basis = (): FinanzDaten => ({ ...leeresDokument('2026-10-05'), privatBudget: [{ id: 'p.b.lm', name: 'Lebensmittel', einheit: 'privat', gruppe: 'Flexibel', soll: 400, typ: 'flex', ab: 1 }] });
const an = (d: FinanzDaten): FinanzDaten => ({ ...d, haushaltBruecke: { an: true } });

describe('Übernahme der vier Arten (Schalter an)', () => {
  it('Fixkosten, Kredite, Ist-Monate und Kontostände kommen aus dem Haushalt', () => {
    const d = mitHaushalt(an({ ...basis(), kontenIst: { privat: { betrag: 1000, stand: HEUTE, aeltester: HEUTE, konten: 1, fehlen: 0 } } }), haushalt(), HEUTE, rechne);
    const q = d.haushaltQuelle!;
    expect(q.zustand).toBe('an');
    // Fixkosten: Monatswert aus dem Rhythmus, Zeile „fix“
    const fix = d.privatBudget.find(z => z.name === 'Vermieter Beispiel')!;
    expect(fix).toMatchObject({ typ: 'fix', soll: 500, einheit: 'privat', gruppe: 'Fixkosten', tag: 3 });
    expect(istHaushaltKennung(fix.id)).toBe(true);
    expect(q.zeilen[fix.id]).toMatchObject({ art: 'fixkosten' });
    expect(q.zeilen[fix.id].weg).toContain('/os/finanzen');
    // Kredit: Schuld + Rate bis schuldenfrei; getilgte und Firmen-Schulden nicht
    const s = d.schulden.find(x => x.name === 'Ratenkredit Beispiel')!;
    expect(s).toMatchObject({ rest: 600, rate: 100, einheit: 'privat', status: 'läuft', start: 2 });
    expect(d.schulden.some(x => x.name === 'Getilgt Beispiel' || x.name === 'Firmenkredit Beispiel')).toBe(false);
    const rate = d.privatSchulden.find(z => z.name === 'Ratenkredit Beispiel')!;
    expect(rate).toMatchObject({ soll: 100, ab: 2, bis: 7 });
    // Ist: eingeordnet über die EINE Einordnung; nach heute und nicht privat fehlen
    const hh = d.buchungen.filter(b => istHaushaltKennung(b.id));
    expect(hh.find(b => b.n === 'Arbeitgeber Beispiel')?.z).toBe('x.einnahme');
    expect(hh.find(b => b.n === 'Markt Beispiel')?.z).toBe('p.b.lm');                 // Kategoriename = Planzeile
    expect(hh.find(b => b.n === 'Eigenes Sparkonto')?.z).toBe('x.umbuchung');
    expect(hh.find(b => b.n === 'Bank Beispiel')?.z).toBe('x.kredit');
    expect(hh.filter(b => b.n === 'Vermieter Beispiel').every(b => b.z === fix.id)).toBe(true);
    expect(hh.some(b => b.n === 'Zukunft Beispiel' || b.n === 'Firma Beispiel')).toBe(false);
    expect(hh.find(b => b.n === 'Markt Beispiel')).toMatchObject({ b: -80, k: 'Girokonto Beispiel', e: 'privat' });
    expect(q.monate).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    // Kontostände: aus dem Konten-Register gekennzeichnet
    expect(q.konten).toBeTruthy();
    // Der Kern rechnet damit: Bedarf Okt = Lebensmittel + Miete, Schulden ab Nov = Rate
    const pr = rechne(d);
    expect(pr[0].bedarf).toBeCloseTo(900, 6);
    expect(pr[0].schulden).toBe(0);
    expect(pr[1].schulden).toBeCloseTo(100, 6);
  });
  it('eine gemerkte Regel (Empfänger → Planzeile) gilt auch für Buchungen aus dem Haushalt', () => {
    const d0 = an(basis()); d0.regeln = { 'markt beispiel': 'x.einmalig' };
    const d = mitHaushalt(d0, haushalt(), HEUTE);
    expect(d.buchungen.find(b => b.n === 'Markt Beispiel')?.z).toBe('x.einmalig');
  });
});

describe('Handwert gewinnt', () => {
  it('eine eigene Zeile gleichen Namens bleibt — der Haushaltswert kommt nicht dazu, steht aber unter „von Hand“', () => {
    const d0 = an(basis()); d0.privatBudget.push({ id: 'p.b.miete', name: 'Vermieter Beispiel', einheit: 'privat', gruppe: 'Fixkosten', soll: 650, typ: 'fix', ab: 1 });
    d0.privatSchulden.push({ id: 'p.d.kredit', name: 'Ratenkredit Beispiel', einheit: 'privat', gruppe: 'Schulden', soll: 120, ab: 1 });
    const d = mitHaushalt(d0, haushalt(), HEUTE);
    expect(d.privatBudget.filter(z => z.name === 'Vermieter Beispiel')).toEqual([d0.privatBudget[1]]);
    expect(d.privatSchulden.filter(z => z.name === 'Ratenkredit Beispiel')).toEqual([d0.privatSchulden[0]]);
    expect(d.schulden).toEqual([]);
    expect(d.haushaltQuelle!.vonHand.map(v => [v.art, v.zeile])).toEqual(expect.arrayContaining([['fixkosten', 'p.b.miete'], ['kredit', 'p.d.kredit']]));
    // Buchungen des Empfängers zählen auf die eigene Zeile
    expect(d.buchungen.filter(b => b.n === 'Vermieter Beispiel').every(b => b.z === 'p.b.miete')).toBe(true);
  });
  it('ein Monat mit eigenen Buchungen der Finanzplanung bleibt — der Haushalt füllt nur die übrigen', () => {
    const d0 = an(basis()); d0.buchungen = [{ id: 'eigen1', d: '2026-09-02', b: -10, n: 'Eigen', k: 'gemeinsam', z: 'x.offen' }];
    const d = mitHaushalt(d0, haushalt(), HEUTE);
    expect(d.buchungen.filter(b => b.d.startsWith('2026-09'))).toEqual(d0.buchungen);
    expect(d.haushaltQuelle!.monate).not.toContain('2026-09');
    expect(d.haushaltQuelle!.vonHand.some(v => v.art === 'monat' && v.name === '2026-09')).toBe(true);
  });
  it('ein Monatswert von Hand auf einer übernommenen Zeile gewinnt im Kern', () => {
    const d1 = mitHaushalt(an(basis()), haushalt(), HEUTE);
    const fix = d1.privatBudget.find(z => z.name === 'Vermieter Beispiel')!;
    const d = mitHaushalt({ ...an(basis()), plan: { [`${fix.id}:1`]: 700 } }, haushalt(), HEUTE);
    expect(rechne(d)[0].bedarf).toBeCloseTo(1100, 6);
    expect(rechne(d)[1].bedarf).toBeCloseTo(900, 6);
  });
});

describe('Schalter: offen (Altbestand), aus, an', () => {
  it('offen: keine Zahl ändert sich, dazu die Vorschau vorher/nachher', () => {
    const d0 = basis();
    expect(brueckeZustand(d0)).toBe('offen');
    const d = mitHaushalt(d0, haushalt(), HEUTE, rechne);
    expect(ohneQuelle(d)).toEqual(d0);
    const v = d.haushaltQuelle!.vorschau!;
    expect(v.vorher.bedarf).toBeCloseTo(400, 6);
    expect(v.nachher.bedarf).toBeCloseTo(900, 6);
    expect(v.fixkosten).toEqual([{ name: 'Vermieter Beispiel', proMonat: 500 }]);
    expect(v.kredite[0]).toMatchObject({ name: 'Ratenkredit Beispiel', rate: 100 });
    expect(v.nachher.istMonate).toBeGreaterThan(v.vorher.istMonate);
    expect(rechne(d)[0].bedarf).toBeCloseTo(400, 6);
  });
  it('aus: unverändert, keine Vorschau, aber gezählt, was käme', () => {
    const d0 = { ...basis(), haushaltBruecke: { an: false } };
    const d = mitHaushalt(d0, haushalt(), HEUTE, rechne);
    expect(ohneQuelle(d)).toEqual(d0);
    expect(d.haushaltQuelle!.zustand).toBe('aus');
    expect(d.haushaltQuelle!.vorschau).toBeUndefined();
    expect(d.haushaltQuelle!.umfang.fixkosten).toBe(1);
  });
  it('die Vorschau rechnet ohne Schreiben: Eingaben bleiben unberührt, `ohneHaushalt` gibt die gespeicherte Form zurück', () => {
    const d0 = an(basis()); const hh = haushalt();
    const vorD = JSON.stringify(d0), vorH = JSON.stringify(hh);
    const d = mitHaushalt(d0, hh, HEUTE, rechne);
    mitHaushalt(basis(), hh, HEUTE, rechne);
    uebernahme(d0, hh, HEUTE);
    expect(JSON.stringify(d0)).toBe(vorD); expect(JSON.stringify(hh)).toBe(vorH);
    expect(ohneHaushalt(d)).toEqual(d0);
  });
  it('ohne Haushalt bzw. nicht lesbar: alles wie vorher, mit Hinweis', () => {
    const d0 = an(basis());
    const d = mitHaushalt(d0, null, HEUTE, rechne, 'nicht lesbar');
    expect(ohneQuelle(d)).toEqual(d0);
    expect(d.haushaltQuelle!.fehler).toBe('nicht lesbar');
  });
});

describe('Schreibwege', () => {
  it('der Schalter ist { an }, gespeichert über pruefeDokument; „haushaltQuelle“ und Haushaltswerte schreibt niemand', () => {
    const d0 = basis();
    const r = wendeOperationenAn(d0, [{ pfad: '/haushaltBruecke', neu: { an: true } }], 'kevin', JETZT);
    expect(r.dokument.haushaltBruecke).toEqual({ an: true });
    expect(r.nachladen).toBe(true);
    const p = pruefeDokument(JSON.parse(JSON.stringify(r.dokument)));
    expect(p.ok && p.dokument.haushaltBruecke).toEqual({ an: true });
    const ohne = pruefeDokument(JSON.parse(JSON.stringify(d0)));
    expect(ohne.ok && 'haushaltBruecke' in ohne.dokument).toBe(false);
    for (const op of [{ pfad: '/haushaltBruecke', neu: { an: 'ja' } }, { pfad: '/haushaltBruecke', neu: { an: true, x: 1 } }, { pfad: '/haushaltBruecke/an', neu: true }, { pfad: '/haushaltQuelle', neu: {} },
      { pfad: '/privatBudget/id=p.b.hhf-00000000/soll', neu: 1 }, { pfad: '/privatBudget/-', neu: { id: 'p.b.hhf-1', name: 'x', einheit: 'privat', gruppe: 'Fixkosten', soll: 1 } },
      { pfad: '/buchungen', neu: [{ id: 'hhb-b1', d: '2026-09-01', b: -1, n: 'x', k: 'k', z: 'x.offen' }] }, { pfad: '/schulden/id=hhs-1/rate', neu: 1 }])
      expect(() => wendeOperationenAn(d0, [op], 'kevin', JETZT), op.pfad).toThrow(OperationUngueltig);
    // Eigene Buchung einer übernommenen Zeile zuordnen geht (der Wert ist nur eine Kennung)
    const d1 = { ...d0, buchungen: [{ id: 'eigen1', d: '2026-09-02', b: -10, n: 'Eigen', k: 'gemeinsam', z: 'x.offen' }] };
    expect(wendeOperationenAn(d1, [{ pfad: '/buchungen/id=eigen1/z', neu: 'p.b.hhf-abc' }], 'kevin', JETZT).dokument.buchungen[0].z).toBe('p.b.hhf-abc');
  });
  it('aus der Business-Sicht ist der Schalter tabu (403/400)', () => {
    const w = schreibeAlsBusiness(basis(), [{ pfad: '/haushaltBruecke', neu: { an: true } }], 'team', JETZT);
    expect(w.ok).toBe(false);
  });
});

describe('Trennung: Sicht Business bekommt nichts aus Privat (rein)', () => {
  it('weder übernommene Zeilen, Schulden, Buchungen noch Schalter oder Quelle', () => {
    const d = mitHaushalt(an(basis()), haushalt(), HEUTE, rechne);
    const b = businessSicht(d);
    const text = JSON.stringify(b);
    expect(text).not.toMatch(/Vermieter Beispiel|Ratenkredit Beispiel|Arbeitgeber Beispiel|Markt Beispiel|hhf-|hhk-|hhs-|hhb-/);
    expect('haushaltQuelle' in b).toBe(false);
    expect('haushaltBruecke' in b).toBe(false);
  });
});

// ── Route mit eigenem Datenordner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
const req = (url: string, body?: unknown, method = 'GET', person = 'inhaber') =>
  new Request(`http://test${url}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let plan: Mod;
type Dok = FinanzDaten & { haushaltQuelle?: unknown };

beforeAll(async () => {
  // Die Route rechnet mit dem echten „heute“ (Berliner Tag) — für die Probe fest auf den Tag der Beispieldaten.
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(JETZT));
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'inhaber', email: 'i@test', name: 'Inhaber Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'hh-test' },
    { id: 'k2', speicher: 'team', email: 't@test', name: 'Team Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'hh-test', finanzRecht: 'business' },
  ], einladungen: [] });
  const h = haushalt();
  await db.saveJson('haushalt-buchungen--hh-test', { buchungen: h.buchungen, einheiten: 2 });
  await db.saveJson('haushalt-stamm--hh-test', { ...h.stamm, regeln: [], einheiten: 2 });
  await db.saveJson('haushalt-schulden--hh-test', { schulden: h.schulden, einheiten: 2 });
  await db.saveJson('finanzen-plan--hh-test', basis());   // Altbestand: ohne Schalter
  plan = (await import('@/app/api/finanzplan/route')) as unknown as Mod;
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

const lade = async (url: string, person = 'inhaber') => (await (await plan.GET(req(url, undefined, 'GET', person))).json()) as { ok: boolean; dokument: Dok };

describe('Route /api/finanzplan', () => {
  it('Altbestand: Privat zeigt die Vorschau, die Zahlen bleiben; „Übernehmen“ legt die Werte dazu; gespeichert wird nur der Schalter', async () => {
    const v = await lade('/api/finanzplan');
    expect(v.dokument.privatBudget.map(z => z.name)).toEqual(['Lebensmittel']);
    expect(v.dokument.haushaltQuelle).toMatchObject({ zustand: 'offen', vorschau: { fixkosten: [{ name: 'Vermieter Beispiel', proMonat: 500 }] } });
    const r = await plan.PATCH(req('/api/finanzplan', { basisStand: v.dokument.stand, ops: [{ pfad: '/haushaltBruecke', neu: { an: true } }] }, 'PATCH'));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { nachladen: boolean }).nachladen).toBe(true);
    const n = await lade('/api/finanzplan');
    expect(n.dokument.privatBudget.map(z => z.name)).toEqual(['Lebensmittel', 'Vermieter Beispiel']);
    expect(n.dokument.haushaltQuelle).toMatchObject({ zustand: 'an' });
    const db = await import('@/lib/store/local-db');
    const gespeichert = await db.loadJson<FinanzDaten>('finanzen-plan--hh-test');
    expect(gespeichert!.haushaltBruecke).toEqual({ an: true });
    expect(JSON.stringify(gespeichert)).not.toMatch(/Vermieter Beispiel|hhf-|hhb-|haushaltQuelle/);
  });
  it('Sicht Business bekommt nichts aus Privat — weder über ?sicht=business noch mit finanzRecht „business“', async () => {
    for (const [url, person] of [['/api/finanzplan?sicht=business', 'inhaber'], ['/api/finanzplan', 'team'], ['/api/finanzplan?sicht=privat', 'team']] as const) {
      const b = await lade(url, person);
      const text = JSON.stringify(b.dokument);
      expect(text, `${url} ${person}`).not.toMatch(/Vermieter Beispiel|Ratenkredit Beispiel|Arbeitgeber Beispiel|hhf-|hhk-|hhs-|hhb-|haushaltQuelle|haushaltBruecke/);
    }
    const kz = await (await plan.GET(req('/api/finanzplan?nur=kennzahlen', undefined, 'GET', 'team'))).json();
    expect(JSON.stringify(kz)).not.toMatch(/Vermieter|Ratenkredit/);
    // Den Schalter umlegen geht aus Business nicht
    const st = (await lade('/api/finanzplan?sicht=business')).dokument.stand;
    const w = await plan.PATCH(req('/api/finanzplan?sicht=business', { basisStand: st, ops: [{ pfad: '/haushaltBruecke', neu: { an: false } }] }, 'PATCH'));
    expect(w.status).toBe(403);
  });
});

function ohneQuelle(d: FinanzDaten): FinanzDaten { const { haushaltQuelle: _q, ...rest } = d; return rest as FinanzDaten; }
