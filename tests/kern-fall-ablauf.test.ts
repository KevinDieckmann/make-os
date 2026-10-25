// ─── Kern-Bau-Test 24.10. — der Fall nutzt den Ablauf des Produkts (lib/prozesse/produkt-ablauf.ts) ─────────────────────────────────────────────────
// Befund: ein Produkt mit eigenem, gebundenem Werkstatt-Prozess (veröffentlicht, im Schatten) — der Fall-Dialog bot nur Pakete, vorbelegt mit dem Paket eines
// ANDEREN Produkts; die Reise zeigte dessen Phasen, Aufgaben entstanden keine. Regel jetzt:
//   · rein: `startVorbelegung` (Prozess des Produkts > Paket DIESES Produkts > nichts — nie ein fremdes Paket), `ablaufLage`, `produktAblaufAnsicht`, `ablaufSpalten`
//   · von Ende zu Ende (eigener Datenordner, erfundene Konten @example.invalid, OHNE Takt — wie die Demo): Vorbelegung + Reise aus dem Ablauf; „Fall anlegen“
//     legt die Akte an und stößt den Lauf einmal an — Schatten: Lauf da, keine Aufgabe, Hinweis; scharf: Aufgabe wie im Takt; kein fremder Prozess (400)
//   · Wächter „Sicht Privat bekommt nichts aus Business“: ?space=privat → 403, Mandat einer Privat-Einheit → 404 ohne Ablauf
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import { definition, schritt, konto, fk, J } from './fixtures/prozess-bau';
import { startVorbelegung, ablaufLage, produktAblaufAnsicht, ablaufSpalten, ablaufPhasenKennung } from '@/lib/prozesse/produkt-ablauf';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kern-fall-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kern-fall';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-kf';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_SCHATTEN = pz(601), PZ_SCHARF = pz(602);

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Vorbelegung von „Fall starten“ (rein)', () => {
  const pakete = [{ id: 'fp-fremd', titel: 'Paket eines anderen Produkts' }, { id: 'fp-eigen', titel: 'Eigenes Paket' }];
  const zuordnung = { 'p-fremd': { vorlageId: 'fp-fremd' }, 'p-eigen': { vorlageId: 'fp-eigen' }, 'p-beides': { vorlageId: 'fp-eigen' } };
  const produktProzesse = { 'p-prozess': { id: PZ_SCHATTEN, titel: 'Sprint liefern', lage: 'schatten' as const }, 'p-beides': { id: PZ_SCHARF, titel: 'Neu', lage: 'scharf' as const } };
  it('der Prozess des Produkts ist der Ablauf — er gewinnt auch gegen ein zugeordnetes Paket', () => {
    expect(startVorbelegung('p-prozess', { produktProzesse, zuordnung, pakete })).toEqual({ art: 'prozess', id: PZ_SCHATTEN, titel: 'Sprint liefern', lage: 'schatten' });
    expect(startVorbelegung('p-beides', { produktProzesse, zuordnung, pakete })?.art).toBe('prozess');
  });
  it('ohne Prozess: nur das Paket DIESES Produkts; sonst nichts — nie das Paket eines anderen Produkts', () => {
    expect(startVorbelegung('p-eigen', { produktProzesse, zuordnung, pakete })).toEqual({ art: 'paket', id: 'fp-eigen', titel: 'Eigenes Paket' });
    expect(startVorbelegung('p-ohne', { produktProzesse, zuordnung, pakete })).toBeNull();
    expect(startVorbelegung(undefined, { produktProzesse, zuordnung, pakete })).toBeNull();
    // Ein gelöschtes Paket in der Zuordnung belegt nichts vor.
    expect(startVorbelegung('p-eigen', { zuordnung, pakete: [pakete[0]] })).toBeNull();
  });
  it('Lage: archiviert → gilt nicht; ohne Version/Entwurf → Entwurf; pausiert → angehalten; sonst die Weiche des Motors', () => {
    expect(ablaufLage({ status: 'archiviert', versionen: [1] }, 'scharf')).toBeNull();
    expect(ablaufLage({ status: 'entwurf', versionen: [] }, null)).toBe('entwurf');
    expect(ablaufLage({ status: 'aktiv', versionen: [] }, 'scharf')).toBe('entwurf');
    expect(ablaufLage({ status: 'pausiert', versionen: [1] }, null)).toBe('angehalten');
    expect(ablaufLage({ status: 'probelauf', versionen: [1] }, 'schatten')).toBe('schatten');
    expect(ablaufLage({ status: 'aktiv', versionen: [1] }, 'scharf')).toBe('scharf');
  });
});

const zweiPhasen = (): ProzessDefinition => definition([
  schritt(10, 'Kick-off vereinbaren', 1, { kundeSichtbar: true }),
  schritt(11, 'Mail an den Kunden', 2, { form: 'nachricht' }),
  { id: fk(12), elternId: fk(2), titel: 'Freigabe', rang: 3, form: 'freigabe', schloss: { fuer: fk(11), grund: 'aussen' } },
  schritt(20, 'Pipeline aufbauen', 1, {}, fk(5)),
  schritt(21, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }, fk(5)),
], { titel: 'Sprint liefern', bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia' }, [{ id: fk(5), elternId: fk(1), titel: 'Umsetzung', rang: 2 }]);

describe('Die Reise aus dem Ablauf (rein)', () => {
  const kurz = { id: PZ_SCHATTEN, titel: 'Sprint liefern', lage: 'schatten' as const };
  it('Phasen und Schritte — ohne Auslöser, Ende, Freigabe-Schloss; im Schatten ist nichts erledigt und nichts „hier“', () => {
    const lauf = { id: 'pl-1', modus: 'schatten' as const, status: 'fertig' as const, schritte: [{ knoten: fk(10), status: 'wuerde' as const, ab: J, kennung: 'x' }] };
    const a = produktAblaufAnsicht(kurz, zweiPhasen(), 1, lauf as never);
    expect(a.phasen.map(p => [p.titel, p.schritte.map(s => s.titel)])).toEqual([['Ablauf', ['Kick-off vereinbaren', 'Mail an den Kunden']], ['Umsetzung', ['Pipeline aufbauen']]]);
    expect(a.phasen.flatMap(p => p.schritte.map(s => s.zustand))).toEqual(['offen', 'offen', 'offen']);
    expect(a.lauf).toEqual({ id: 'pl-1', modus: 'schatten', status: 'fertig' });
    // 25.10. (Kern-Runde 4): im Schatten tragen die Phasen des Ablaufs ihr Kennzeichen (sie zählen mit — `phasenZaehlung`).
    expect(ablaufSpalten(a, 2, false).map(s => [s.id, s.nr, s.zustand, s.unter])).toEqual([[ablaufPhasenKennung(fk(2)), 2, 'offen', '0 von 2 · im Schatten'], [ablaufPhasenKennung(fk(5)), 3, 'offen', '0 von 1 · im Schatten']]);
  });
  it('scharf: erledigt · hier · offen aus dem Lauf; läuft das Onboarding noch, steht die Phase als „läuft“ daneben (nie ein zweites „Hier“)', () => {
    const lauf = { id: 'pl-2', modus: 'scharf' as const, status: 'wartet' as const, schritte: [
      { knoten: fk(10), status: 'erledigt' as const, ab: J, kennung: 'a' }, { knoten: fk(11), status: 'freigabe' as const, ab: J, kennung: 'b' },
    ] };
    const a = produktAblaufAnsicht({ ...kurz, lage: 'scharf' }, zweiPhasen(), 1, lauf as never);
    expect(a.phasen[0].schritte.map(s => s.zustand)).toEqual(['erledigt', 'hier']);
    expect(a.phasen[0].schritte[0].kunde).toBe(true);
    expect(ablaufSpalten(a, 2, false)[0]).toMatchObject({ zustand: 'jetzt', unter: '1 von 2' });
    const neben = ablaufSpalten(a, 2, true)[0];
    expect(neben.zustand).toBe('laeuft');
    expect(neben.kaestchen.some(k => k.zustand === 'hier')).toBe(false);
  });
});

// ══ Von Ende zu Ende (ohne Takt) ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x });
const mandat = (id: string, leistungId: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-21', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);

type Json = Record<string, unknown>;
const holen = async (r: Response): Promise<{ status: number; j: Json }> => ({ status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Json : {} });
const fallGet = async (m: string, suche = '&space=business') => holen(await (await import('@/app/api/fulfillment/fall/route')).GET(new Request(`http://test/api/fulfillment/fall?m=${m}${suche}`, { headers: sitzung('pia') })));
const starten = async (m: string, vorlageId: string, anfrageId: string) => holen(await (await import('@/app/api/fulfillment/fall/route')).POST(new Request('http://test/api/fulfillment/fall?space=business', {
  method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ aktion: 'starten', mandatId: m, vorlageId, start: '2026-10-22', anfrageId }),
})));
let db: typeof import('@/lib/store/local-db');
const tasks = async () => ((await db.loadJson<{ tasks: { id: string; title: string; bezug?: Record<string, string> }[] }>('tasks'))?.tasks ?? []);
const laeufe = async () => (await (await import('@/lib/prozesse/lauf-server')).laeufeLesen(H)).laeufe;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: J }],
    leistungen: [produkt('p-schatten', { prozessId: PZ_SCHATTEN }), produkt('p-scharf', { prozessId: PZ_SCHARF }), produkt('p-fremd'), produkt('p-ohne')],
    mandate: [],
  } satisfies CrmBestand);
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ_SCHATTEN, zweiPhasen(), 'probelauf'), eintrag(PZ_SCHARF, { ...zweiPhasen(), titel: 'Scharf liefern' }, 'aktiv')] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ_SCHARF]: scharf() } });
  // Ein Paket, das einem ANDEREN Produkt zugeordnet ist — es darf nie vorbelegt werden.
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [{
    id: 'fp-fremd', art: 'paket', titel: 'Vertriebsaufbau', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'Vertriebsaufbau', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 0, form: 'termin' }],
  }], bausteine: [], rituale: [], zuordnung: { 'p-fremd': { vorlageId: 'fp-fremd' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  const { aendereCrm } = await import('@/lib/crm/speicher');
  await aendereCrm(b => ({ ...b, mandate: [mandat('m-schatten', 'p-schatten'), mandat('m-scharf', 'p-scharf'), mandat('m-ohne', 'p-ohne'), mandat('m-privat', 'p-schatten', { gesellschaft: 'kdc' })] }), { art: 'person', person: 'pia' });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Fall eines Produkts mit gebundenem Ablauf — ohne Takt (wie die Demo)', () => {
  it('ohne Fall: die Antwort trägt den Ablauf (Lage „im Schatten“, Phasen und Schritte) — die Seite belegt ihn vor', async () => {
    const r = await fallGet('m-schatten');
    expect(r.status).toBe(200);
    expect(r.j.fall).toBeNull();
    expect(r.j.produktAblauf).toMatchObject({ id: PZ_SCHATTEN, titel: 'Sprint liefern', lage: 'schatten', lauf: null });
    expect((r.j.produktAblauf as { phasen: { titel: string }[] }).phasen.map(p => p.titel)).toEqual(['Ablauf', 'Umsetzung']);
    expect((await fallGet('m-ohne')).j.produktAblauf).toBeUndefined();
  });
  it('Übersicht: je Produkt sein Prozess (`produktProzesse`), der Kandidat trägt `prozess` statt eines Pakets; ein Produkt ohne Ablauf bekommt KEIN fremdes Paket', async () => {
    const r = await holen(await (await import('@/app/api/fulfillment/route')).GET(new Request('http://test/api/fulfillment?nur=kurz&space=business', { headers: sitzung('pia') })));
    expect(r.status).toBe(200);
    const j = r.j as { produktProzesse: Record<string, unknown>; kandidaten: { mandatId: string; prozess?: unknown; vorlage?: unknown }[] };
    expect(j.produktProzesse).toEqual({ 'p-schatten': { id: PZ_SCHATTEN, titel: 'Sprint liefern', lage: 'schatten' }, 'p-scharf': { id: PZ_SCHARF, titel: 'Scharf liefern', lage: 'scharf' } });
    const k = new Map(j.kandidaten.map(x => [x.mandatId, x]));
    expect(k.get('m-schatten')).toMatchObject({ prozess: { id: PZ_SCHATTEN, lage: 'schatten' } });
    expect(k.get('m-schatten')?.vorlage).toBeUndefined();
    expect(k.get('m-ohne')?.vorlage).toBeUndefined();
    expect(k.get('m-ohne')?.prozess).toBeUndefined();
  });
  it('Schatten: „Fall anlegen“ legt die Akte an und stößt den Lauf EINMAL an — Lauf im Schatten, keine Aufgabe; die Reise zeigt den Ablauf mit Hinweis', async () => {
    const r = await starten('m-schatten', PZ_SCHATTEN, 'kf-1');
    expect(r.status).toBe(200);
    expect(r.j).toMatchObject({ ok: true, laeufe: 1, fall: { vorlageId: PZ_SCHATTEN, ablauf: { art: 'prozess', prozessId: PZ_SCHATTEN }, startAm: '2026-10-22' } });
    const l = (await laeufe()).filter(x => x.fall.id === 'm-schatten');
    expect(l.map(x => [x.prozessId, x.modus])).toEqual([[PZ_SCHATTEN, 'schatten']]);
    expect((await tasks()).filter(t => t.bezug?.mandatId === 'm-schatten')).toEqual([]);
    const g = await fallGet('m-schatten');
    expect(g.j.produktAblauf).toMatchObject({ id: PZ_SCHATTEN, lage: 'schatten', lauf: { modus: 'schatten' } });
    expect((g.j.produktAblauf as { phasen: { schritte: { zustand: string }[] }[] }).phasen.flatMap(p => p.schritte.map(s => s.zustand)).every(z => z === 'offen')).toBe(true);
    // Der Ablauf heißt wie der Prozess (vorher „Vorlage entfernt“).
    expect(g.j.vorlage).toMatchObject({ id: PZ_SCHATTEN, titel: 'Sprint liefern' });
  });
  it('kein zweiter Fall (409), kein zweiter Lauf; ein Takt danach legt nichts doppelt an', async () => {
    expect((await starten('m-schatten', PZ_SCHATTEN, 'kf-2')).status).toBe(409);
    const S = await import('@/lib/prozesse/lauf-server');
    await S.prozesseImTakt(); await S.prozesseImTakt();
    expect((await laeufe()).filter(x => x.fall.id === 'm-schatten')).toHaveLength(1);
  });
  it('scharf: dieselbe Aktion legt die Aufgabe an wie der Takt (erster Schritt), die Reise zeigt ihn als „hier“', async () => {
    const r = await starten('m-scharf', PZ_SCHARF, 'kf-3');
    expect(r.status).toBe(200);
    expect(r.j.laeufe).toBe(1);
    const l = (await laeufe()).find(x => x.fall.id === 'm-scharf')!;
    expect(l).toMatchObject({ prozessId: PZ_SCHARF, modus: 'scharf', ausloeser: { art: 'produkt' } });
    expect((await tasks()).filter(t => t.id.startsWith(l.id))).toEqual([expect.objectContaining({ title: 'Kick-off vereinbaren', bezug: expect.objectContaining({ mandatId: 'm-scharf' }) })]);
    const g = await fallGet('m-scharf');
    expect((g.j.produktAblauf as { phasen: { schritte: { titel: string; zustand: string }[] }[] }).phasen[0].schritte[0]).toEqual(expect.objectContaining({ titel: 'Kick-off vereinbaren', zustand: 'hier' }));
  });
  it('nie der Prozess eines anderen Produkts (400, nichts angelegt)', async () => {
    const r = await starten('m-ohne', PZ_SCHATTEN, 'kf-4');
    expect(r.status).toBe(400);
    expect((await fallGet('m-ohne')).j.fall).toBeNull();
  });
  it('Wächter — Sicht Privat bekommt nichts aus Business: ?space=privat → 403; Mandat einer Privat-Einheit → 404 ohne Ablauf', async () => {
    const p = await fallGet('m-schatten', '&space=privat');
    expect(p.status).toBe(403);
    expect(p.j.produktAblauf).toBeUndefined();
    const m = await fallGet('m-privat');
    expect(m.status).toBe(404);
    expect(m.j.produktAblauf).toBeUndefined();
    const u = await holen(await (await import('@/app/api/fulfillment/route')).GET(new Request('http://test/api/fulfillment?nur=kurz&space=privat', { headers: sitzung('pia') })));
    expect(u.status).toBe(403);
    expect(u.j.produktProzesse).toBeUndefined();
  });
});
