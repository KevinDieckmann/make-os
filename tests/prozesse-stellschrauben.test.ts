// ─── Prozesse · Stellschrauben der festen System-Prozesse (22.10., Teil A) — vorhandene Einstellungen zeigen, ändern nur über die vorhandenen Routen ────────────
// Rein: der Bau liest nur aus den Quellen (fehlt eine Quelle, fehlen ihre Stellschrauben — nie eine erfundene Vorgabe), gesetzlich Festes ist „fest (Gesetz)“
// ohne Weg, die Anfrage je Weg hat genau die Form der vorhandenen Route. Route: GET /api/prozesse/landkarte trägt die Werte aus den Beständen und die Rechte
// je Person (Mahnstufen nur mit vollem Finanz-Zugang, Dienstweg nichts); eine Änderung über die vorhandene Route steht danach auf der Landkarte (EINE Wahrheit).
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KREIS_TAKT } from '@/lib/make-one/crm';
import { LOESCHFRISTEN } from '@/lib/crm/loeschfristen';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { stellschraubenBauen, VORGABE_MAHNTAGE, VORGABE_FULFILLMENT, type StellschraubenQuellen } from '@/lib/prozesse/stellschrauben-bau';
import { anfrageFuer, eingabeLesen, einstellbar, abweichend, wertText, darfAendern, type Stellschraube } from '@/lib/prozesse/stellschrauben';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-stellschrauben-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-stellschrauben';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const VOLL: StellschraubenQuellen = {
  wertelisten: {}, scoring: { marketing: 8, sales: 28, mussMarketing: 0, mussSales: 2, temperatur: { lau: 5, warm: 12, heiss: 25 } },
  loeschfristen: {}, mahnTage: [...VORGABE_MAHNTAGE], fulfillment: { ...VORGABE_FULFILLMENT, nachsorgeTage: [...VORGABE_FULFILLMENT.nachsorgeTage] },
  heads: { sales: {}, marketing: { aktiv: false }, event: {}, finanzen: { budgetCentMonat: 5000 } }, kanaele: 3, buchungsseiten: { aktiv: 1, gesamt: 2 },
};
const von = (je: Record<string, Stellschraube[]>, p: string, id: string) => je[p]?.find(s => s.id === id);

describe('Bau (rein): nur aus den Quellen, je Prozess, mit Vorgabe und Weg', () => {
  it('jede Kennung gehört zu einem System-Prozess; ohne Quellen nur die reinen Ansichts-Verweise (Vorlagen)', () => {
    const ids = new Set(SYSTEM_PROZESSE.map(p => p.id));
    for (const p of Object.keys(stellschraubenBauen(VOLL))) expect(ids.has(p), p).toBe(true);
    expect(Object.keys(stellschraubenBauen({})).sort()).toEqual(['sp-kampagnen', 'sp-makeone']);
  });
  it('Kadenz je Kreis: Wert aus den Wertelisten, sonst die Vorgabe des Codes; ein kaputter Wert gilt nie', () => {
    const je = stellschraubenBauen({ wertelisten: { kadenzTage: { A: 45, B: 3 } } });
    expect(von(je, 'sp-followup', 'kadenz-A')).toMatchObject({ wert: 45, vorgabe: KREIS_TAKT.A, weg: { art: 'wertelisten', feld: 'kadenzTage', schluessel: 'A' } });
    expect(von(je, 'sp-followup', 'kadenz-B')!.wert).toBe(KREIS_TAKT.B);
    expect(abweichend(von(je, 'sp-followup', 'kadenz-A')!)).toBe(true);
    expect(abweichend(von(je, 'sp-followup', 'kadenz-C')!)).toBe(false);
  });
  it('Löschfristen: einstellbare mit Weg und Grenzen, feste als „fest (Gesetz)“ ohne Weg — dazu die Monatsfrist des Art. 12', () => {
    const l = stellschraubenBauen({ loeschfristen: { kontakte: 36 } })['sp-betroffenenrechte'];
    expect(l.find(s => s.id === 'art12-frist')).toMatchObject({ art: 'fest', fest: expect.stringContaining('Art. 12') });
    for (const f of LOESCHFRISTEN) {
      const s = l.find(x => x.id === `frist-${f.id}`)!;
      if (f.wirkung === 'fest') { expect(s.art).toBe('fest'); expect(s.weg).toBeUndefined(); expect(s.fest).toMatch(/^fest \(Gesetz\)/); }
      else expect(s).toMatchObject({ art: 'zahl', vorgabe: f.standard, min: f.min, max: f.max, weg: { art: 'loeschfrist', id: f.id } });
    }
    expect(l.find(s => s.id === 'frist-kontakte')!.wert).toBe(36);
  });
  it('Mahnstufen steigen: die Grenzen jeder Stufe folgen den Nachbarn; Fulfillment, Heads, Scoring, Kanäle, Buchungsseiten', () => {
    const je = stellschraubenBauen({ ...VOLL, mahnTage: [5, 10, 30] });
    expect(von(je, 'sp-rechnung', 'mahnstufe-2')).toMatchObject({ wert: 10, vorgabe: 14, min: 6, max: 29, weg: { art: 'mahntage', stufe: 1, tage: [5, 10, 30] } });
    expect(von(je, 'sp-uebergabe', 'willkommen-stunden')).toMatchObject({ wert: 24, weg: { art: 'fulfillment', feld: 'willkommenStunden' } });
    expect(von(je, 'sp-wirkung', 'nachsorge-tage')).toMatchObject({ art: 'tage-liste', wert: [14, 45, 90] });
    expect(von(je, 'sp-head-takt', 'head-marketing-aktiv')).toMatchObject({ art: 'info', wert: 'aus', link: { href: expect.stringContaining('/os/agenten') } });
    expect(von(je, 'sp-monatsabschluss', 'head-finanzen-budget')!.wert).toBe('50 €');
    expect(von(je, 'sp-lead-sql', 'scoring-sql')!.wert).toBe('28 Punkte · 2 Muss');
    expect(von(je, 'sp-vertriebsplanung', 'kanaele')!.wert).toBe('3 eingerichtet');
    expect(von(je, 'sp-buchung', 'buchungsseiten')!.wert).toBe('1 von 2 aktiv');
    // Ansichts-Zeilen haben nie einen Weg; ein Prozess mit nur solchen Zeilen ist nicht „einstellbar“.
    for (const l of Object.values(je)) for (const s of l) if (s.art === 'info' || s.art === 'fest') expect(s.weg).toBeUndefined();
    expect(einstellbar({ stellschrauben: je['sp-kampagnen'] })).toBe(false);
    expect(einstellbar({ stellschrauben: je['sp-followup'] })).toBe(true);
  });
});

describe('Anfragen (rein): genau die Form der vorhandenen Routen', () => {
  const je = stellschraubenBauen({ ...VOLL, mahnTage: [7, 14, 21] });
  it('Wertelisten, Löschfrist, Mahnstufen, Puls-Schwelle, Fulfillment — Vorgabe setzt zurück', () => {
    const k = von(je, 'sp-followup', 'kadenz-A')!;
    expect(anfrageFuer(k, 45)).toEqual({ url: '/api/crm/stammdaten?space=business', method: 'POST', body: { aktion: 'wertelisten', wertelisten: { kadenzTage: { A: 45 } } } });
    expect(anfrageFuer(k, 'vorgabe')!.body).toEqual({ aktion: 'wertelisten', wertelisten: { kadenzTage: { A: null } } });
    const f = von(je, 'sp-betroffenenrechte', 'frist-kontakte')!;
    expect(anfrageFuer(f, 30)).toEqual({ url: '/api/crm/datenschutz?space=business', method: 'POST', body: { aktion: 'fristen', fristen: { kontakte: 30 } } });
    const m = von(je, 'sp-rechnung', 'mahnstufe-3')!;
    expect(anfrageFuer(m, 28)!.body).toEqual({ aktion: 'mahntage', tage: [7, 14, 28] });
    expect(anfrageFuer({ ...m, weg: { art: 'mahntage', stufe: 2, tage: [7, 14, 28] } }, 'vorgabe')!.body).toEqual({ aktion: 'mahntage', tage: [7, 14, 21] });
    expect(anfrageFuer(von(je, 'sp-uebergabe', 'puls-schwelle')!, 4)).toEqual({ url: '/api/fulfillment/kunde?space=business', method: 'POST', body: { aktion: 'puls-schwelle', wert: 4 } });
    expect(anfrageFuer(von(je, 'sp-wirkung', 'nachsorge-tage')!, 'vorgabe')).toEqual({ url: '/api/fulfillment?space=business', method: 'PATCH', body: { ops: [{ op: 'einstellungen', felder: { nachsorgeTage: [14, 45, 90] } }] } });
    // Nur ansehen: keine Anfrage.
    expect(anfrageFuer(von(je, 'sp-betroffenenrechte', 'art12-frist')!, 2)).toBeNull();
    expect(anfrageFuer(von(je, 'sp-head-takt', 'head-sales-budget')!, 2)).toBeNull();
  });
  it('Eingaben: Grenzen, Listen, leeres Ziel = löschen; Rechte je Weg', () => {
    const k = von(je, 'sp-followup', 'kadenz-A')!;
    expect(eingabeLesen(k, '45')).toEqual({ ok: true, wert: 45 });
    expect(eingabeLesen(k, '3').ok).toBe(false);
    expect(eingabeLesen(k, '4,5').ok).toBe(false);
    expect(eingabeLesen(von(je, 'sp-wirkung', 'nachsorge-tage')!, '90, 14 45')).toEqual({ ok: true, wert: [14, 45, 90] });
    const z = von(je, 'sp-vertriebsplanung', 'ziel-umsatzNeuMonat')!;
    expect(eingabeLesen(z, '')).toEqual({ ok: true, wert: null });
    expect(eingabeLesen(z, '1500,50')).toEqual({ ok: true, wert: 1500.5 });
    expect(wertText(z, null)).toBe('—');
    expect(darfAendern(k, { wertelisten: true })).toBe(true);
    expect(darfAendern(von(je, 'sp-rechnung', 'mahnstufe-1')!, { wertelisten: true, mahntage: false })).toBe(false);
  });
});

// ── Route: Werte aus den Beständen, Rechte je Person, ändern nur über die vorhandenen Routen ────────────────────────────────────────────────────────────────

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json', ...(person ? { 'x-make-person': person } : {}) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
async function landkarte(kopf: Record<string, string>): Promise<{ status: number; j: J }> {
  const { GET } = await import('@/app/api/prozesse/landkarte/route');
  const r = await GET(new Request('http://test/api/prozesse/landkarte?space=business', { headers: kopf }));
  return { status: r.status, j: r.status === 200 ? await r.json() : null };
}
const schraube = (j: J, p: string, id: string): Stellschraube => (j.prozesse as { id: string; stellschrauben?: Stellschraube[] }[]).find(x => x.id === p)!.stellschrauben!.find(s => s.id === id)!;
/** Die Anfrage aus `anfrageFuer` an die vorhandene Route schicken (wie die Oberfläche). */
async function senden(s: Stellschraube, wert: Parameters<typeof anfrageFuer>[1], person = 'pia'): Promise<{ status: number; j: J }> {
  const a = anfrageFuer(s, wert)!;
  const pfad = a.url.split('?')[0];
  const ROUTEN: Record<string, () => Promise<unknown>> = {
    '/api/crm/stammdaten': () => import('@/app/api/crm/stammdaten/route'), '/api/crm/datenschutz': () => import('@/app/api/crm/datenschutz/route'),
    '/api/rechnung': () => import('@/app/api/rechnung/route'), '/api/fulfillment': () => import('@/app/api/fulfillment/route'),
    '/api/fulfillment/kunde': () => import('@/app/api/fulfillment/kunde/route'),
  };
  const mod = (await ROUTEN[pfad]()) as Record<string, (r: Request) => Promise<Response>>;
  const r = await mod[a.method](new Request(`http://test${a.url}`, { method: a.method, headers: sitzung(person), body: JSON.stringify(a.body) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-st' }),
    konto('k2', 'partnerin', 'mitglied', { haushalt: 'haus-st', finanzRecht: 'business' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route: Landkarte trägt die Stellschrauben', () => {
  it('ohne Bestände: die Vorgaben; Rechte je Person (Mahnstufen nur mit vollem Finanz-Zugang, Dienstweg nichts); Privat und fremder Haushalt 403', async () => {
    const r = await landkarte(sitzung('pia'));
    expect(r.status).toBe(200);
    expect(schraube(r.j, 'sp-followup', 'kadenz-A').wert).toBe(KREIS_TAKT.A);
    expect(schraube(r.j, 'sp-rechnung', 'mahnstufe-1').wert).toBe(7);
    expect(schraube(r.j, 'sp-uebergabe', 'willkommen-stunden').wert).toBe(24);
    expect(r.j.stellschraubenRechte).toMatchObject({ wertelisten: true, loeschfrist: true, mahntage: true, fulfillment: true, 'puls-schwelle': true });
    expect((await landkarte(sitzung('partnerin'))).j.stellschraubenRechte).toMatchObject({ wertelisten: true, mahntage: false });
    expect((await landkarte(dienst('pia'))).j.stellschraubenRechte).toEqual({});
    expect((await landkarte(sitzung('gast'))).status).toBe(403);
    const { GET } = await import('@/app/api/prozesse/landkarte/route');
    expect((await GET(new Request('http://test/api/prozesse/landkarte?space=privat', { headers: sitzung('pia') }))).status).toBe(403);
  });
  it('ändern über die vorhandenen Routen — danach steht der Wert auf der Landkarte (EINE Wahrheit); „Vorgabe“ speichert nichts', async () => {
    let j = (await landkarte(sitzung('pia'))).j;
    expect((await senden(schraube(j, 'sp-followup', 'kadenz-A'), 45)).status).toBe(200);
    expect((await senden(schraube(j, 'sp-betroffenenrechte', 'frist-import-konflikte'), 120)).status).toBe(200);
    expect((await senden(schraube(j, 'sp-rechnung', 'mahnstufe-2'), 20)).status).toBe(200);
    expect((await senden(schraube(j, 'sp-uebergabe', 'willkommen-stunden'), 48)).status).toBe(200);
    expect((await senden(schraube(j, 'sp-wirkung', 'puls-schwelle'), 4)).status).toBe(200);
    expect((await senden(schraube(j, 'sp-wirkung', 'nachsorge-tage'), [7, 30])).status).toBe(200);
    j = (await landkarte(sitzung('pia'))).j;
    expect(schraube(j, 'sp-followup', 'kadenz-A').wert).toBe(45);
    expect(schraube(j, 'sp-betroffenenrechte', 'frist-import-konflikte').wert).toBe(120);
    expect(schraube(j, 'sp-rechnung', 'mahnstufe-2').wert).toBe(20);
    expect(schraube(j, 'sp-rechnung', 'mahnstufe-3').weg).toEqual({ art: 'mahntage', stufe: 2, tage: [7, 20, 21] });
    expect(schraube(j, 'sp-uebergabe', 'willkommen-stunden').wert).toBe(48);
    expect(schraube(j, 'sp-uebergabe', 'puls-schwelle').wert).toBe(4);
    expect(schraube(j, 'sp-wirkung', 'nachsorge-tage').wert).toEqual([7, 30]);
    // Dieselben Werte wie in der Fachseite: die Wertelisten der Stammdaten.
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).wertelisten?.kadenzTage).toEqual({ A: 45 });
    // Zurück auf die Vorgabe: nichts mehr gespeichert.
    expect((await senden(schraube(j, 'sp-followup', 'kadenz-A'), 'vorgabe')).status).toBe(200);
    expect((await ladeCrm()).wertelisten?.kadenzTage).toBeUndefined();
    expect(schraube((await landkarte(sitzung('pia'))).j, 'sp-followup', 'kadenz-A').wert).toBe(KREIS_TAKT.A);
  });
  it('die Route prüft selbst: Mahnstufen ohne vollen Finanz-Zugang 403, Unsinn 400 — nichts gespeichert', async () => {
    const j = (await landkarte(sitzung('pia'))).j;
    expect((await senden(schraube(j, 'sp-rechnung', 'mahnstufe-1'), 3, 'partnerin')).status).toBe(403);
    expect((await senden(schraube(j, 'sp-followup', 'kadenz-B'), 2)).status).toBe(400);
    const n = (await landkarte(sitzung('pia'))).j;
    expect(schraube(n, 'sp-rechnung', 'mahnstufe-1').wert).toBe(7);
    expect(schraube(n, 'sp-followup', 'kadenz-B').wert).toBe(KREIS_TAKT.B);
  });
});
