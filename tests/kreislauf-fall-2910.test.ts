// ─── Kreislauf 29.10. — P3 „Ein Start für jeden Fall“ (Kevin 29.10.: Mandat beendet → Fall automatisch abschließen) ─────────────────────────────────────
//   · rein: Schatten blendet kein Mandat aus (F-B1), Schatten sperrt keinen scharfen Lauf (F-B1), Zusatzmodule hängen beim Start an (F-B8), `fall-abgeschlossen`
//     (fallDiff), der Lauf meldet für die Akte Schritt/Phase mit denselben Kennungen (F-B4)
//   · Server (eigener Datenordner, erfundene Konten @example.invalid): `mandatFallStarten` (Paket bzw. Prozess nach `startVorbelegung`, ohne Ablauf 409),
//     jeder scharfe Lauf legt die Akte an (F-B2), Mandat beendet → Fall abgeschlossen + Ereignis (idempotent), Netz im Morgenlauf nur ab Einführung
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { Fall, ProzessVorlage } from '@/lib/fulfillment/typen';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, schritt, konto, fk, J } from './fixtures/prozess-bau';
import { mandateMitProduktLauf } from '@/lib/prozesse/produkt-bindung';
import { starten, laufEndetMitMandat } from '@/lib/prozesse/lauf-regeln';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { fallDiff } from '@/lib/ereignisse/quellen';
import { akteEreignisse } from '@/lib/prozesse/akte-ereignisse';
import { ereignisKennung } from '@/lib/ereignisse/typen';

// Der Datenordner VOR allen Imports (die reinen Module oben ziehen die Ereignisstelle samt Speicher nach).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kreislauf-fall-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kreislauf-fall';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});

const H = 'haus-kl';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_A = pz(701);
const PAKET: ProzessVorlage = {
  id: 'fp-kl-haupt', art: 'paket', titel: 'Hauptpaket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
  knoten: [{ id: 'fk-kw', titel: 'Hauptpaket', rang: 1 }, { id: 'fk-kp', elternId: 'fk-kw', titel: 'Start', rang: 1 }, { id: 'fk-ks', elternId: 'fk-kp', titel: 'Kick-off', rang: 1, form: 'termin' }],
};
const ZUSATZ: ProzessVorlage = {
  id: 'fp-kl-zusatz', art: 'paket', zusatz: true, titel: 'Zusatzabschnitt', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
  knoten: [{ id: 'fk-zw', titel: 'Zusatzabschnitt', rang: 1 }, { id: 'fk-zp', elternId: 'fk-zw', titel: 'Zusatz liefern', rang: 1 }, { id: 'fk-zs', elternId: 'fk-zp', titel: 'Bericht', rang: 1 }],
};
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'entwurf', geaendert: J, ...x });
const mandat = (id: string, leistungId: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-21', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const liefern: ProzessDefinition = definition([
  schritt(10, 'Kick-off vereinbaren', 1), schritt(11, 'Bericht schreiben', 2), schritt(12, 'Fertig', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
], { titel: 'Liefern', bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia' });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('F-B1: Schatten blendet nicht aus und sperrt keinen scharfen Lauf (rein)', () => {
  const crm = { mandate: [{ id: 'm1', leistungId: 'p1' }], leistungen: [{ id: 'p1', prozessId: PZ_A }] };
  it('mandateMitProduktLauf: scharf → ausgeblendet, Schatten → bleibt Kandidat', () => {
    expect([...mandateMitProduktLauf([{ prozessId: PZ_A, fall: { art: 'mandat', id: 'm1' }, status: 'wartet', modus: 'scharf' }], crm)]).toEqual(['m1']);
    expect([...mandateMitProduktLauf([{ prozessId: PZ_A, fall: { art: 'mandat', id: 'm1' }, status: 'wartet', modus: 'schatten' }], crm)]).toEqual([]);
  });
  it('starten: ein offener Schatten-Lauf sperrt den scharfen Start nicht — ein scharfer sperrt den Schatten-Start', () => {
    const leer: LaeufeDatei = { v: 1, laeufe: [], zurueckgehalten: [], prozesse: {} };
    const a = (id: string, modus: 'scharf' | 'schatten') => ({ id, prozessId: PZ_A, version: 1, def: { bereich: 'fulfillment' as const, fallArt: 'mandat' as const }, fall: { art: 'mandat' as const, id: 'm1' }, modus, person: 'pia', ausloeser: { art: 'produkt' as const }, jetzt: J });
    const s = starten(leer, a('pl-1', 'schatten'));
    expect(s.ok).toBe(true);
    const sch = starten(s.datei, a('pl-2', 'scharf'));
    expect(sch.ok).toBe(true);
    const nochmal = starten(sch.datei, a('pl-3', 'schatten'));
    expect(nochmal).toMatchObject({ ok: false, grund: 'offen' });
    expect(starten(sch.datei, a('pl-4', 'scharf'))).toMatchObject({ ok: false, grund: 'offen' });
  });
});

describe('Mandat beendet: welche Läufe enden (rein, Kevin 29.10.)', () => {
  const l = (daten: Record<string, string>, status: ProzessLauf['status'] = 'wartet', id = 'm1') => ({ fall: { art: 'mandat' as const, id }, daten, status });
  it('offene Läufe am Mandat enden — außer Nachsorge/Verlängerung (gestartet durch „Fall abgeschlossen“, „Mandat beendet“ bzw. Datum „Ende des Mandats“)', () => {
    expect(laufEndetMitMandat(l({ 'ereignis.art': 'mandat-angelegt' }), 'm1')).toBe(true);
    expect(laufEndetMitMandat(l({}), 'm1')).toBe(true);
    expect(laufEndetMitMandat(l({ 'ereignis.art': 'fall-abgeschlossen' }), 'm1')).toBe(false);
    expect(laufEndetMitMandat(l({ 'ereignis.art': 'mandat-beendet' }), 'm1')).toBe(false);
    expect(laufEndetMitMandat(l({ 'datum.feld': 'mandat.ende' }), 'm1')).toBe(false);
    expect(laufEndetMitMandat(l({}, 'fertig'), 'm1')).toBe(false);
    expect(laufEndetMitMandat(l({}, 'wartet', 'm2'), 'm1')).toBe(false);
  });
});

describe('F-B8: Zusatzmodule hängen beim Start des Falls an (rein)', () => {
  const vorlagen = { zuordnung: { 'p-z': { vorlageId: ZUSATZ.id }, 'p-alt': { vorlageId: ZUSATZ.id } }, prozesse: [PAKET, ZUSATZ] };
  const neu = () => fallStarten({ mandatId: 'm1', vorlage: PAKET, person: 'pia', jetzt: J, start: '2026-10-21', neueId: p => `${p}-x` });
  it('ein Modul mit Zusatz-Paket → Abschnitt; zweimal → nichts doppelt; beendet vor dem Start → nicht', async () => {
    const { zusaetzeAnhaengen } = await import('@/lib/fulfillment/prozesse/fall-server');
    const f = zusaetzeAnhaengen(neu(), { zusatz: [{ id: 'mz-1', leistungId: 'p-z' }] }, vorlagen, { person: 'pia', jetzt: J, start: '2026-10-21' });
    expect(f.zusaetze?.map(z => z.vorlageId)).toEqual([ZUSATZ.id]);
    expect(zusaetzeAnhaengen(f, { zusatz: [{ id: 'mz-1', leistungId: 'p-z' }] }, vorlagen, { person: 'pia', jetzt: J, start: '2026-10-21' })).toBe(f);
    const g = zusaetzeAnhaengen(neu(), { zusatz: [{ id: 'mz-2', leistungId: 'p-alt', bis: '2026-09-30' }] }, vorlagen, { person: 'pia', jetzt: J, start: '2026-10-21' });
    expect(g.zusaetze ?? []).toEqual([]);
    // Ohne Zusatz-Paket (nur ein Produkt ohne Zuordnung) bleibt der Fall, wie er ist.
    const h0 = neu();
    expect(zusaetzeAnhaengen(h0, { zusatz: [{ id: 'mz-3', leistungId: 'p-ohne' }] }, vorlagen, { person: 'pia', jetzt: J, start: '2026-10-21' })).toBe(h0);
  });
});

describe('fall-abgeschlossen (rein, fallDiff)', () => {
  const m = { id: 'm1', gesellschaft: 'ug', firmaId: 'f-1', kontaktIds: ['c-1'] };
  const f = (status: string, geaendert = '2026-10-29T10:00:00.000Z') => ({ knoten: [], status, geaendert, vorlageId: 'fp-x' });
  it('neu abgeschlossen → ein Ereignis mit Stufe; schon abgeschlossen bzw. ohne Status vorher → keins', () => {
    const l = fallDiff(f('laeuft'), f('abgeschlossen'), m, () => null, 'mandatsende');
    expect(l).toEqual([{ id: ereignisKennung('fall', 'm1', 'abgeschlossen', '2026-10-29'), art: 'fall-abgeschlossen', quelle: 'fulfillment', bereich: 'business', stufe: 'mandatsende',
      bezug: { mandatId: 'm1', firmaId: 'f-1', kontaktId: 'c-1', vorlageId: 'fp-x' } }]);
    expect(fallDiff(f('laeuft'), f('abgeschlossen'), m, () => null)[0].stufe).toBe('hand');
    expect(fallDiff(f('abgeschlossen'), f('abgeschlossen'), m, () => null)).toEqual([]);
    expect(fallDiff({ knoten: [] }, f('abgeschlossen'), m, () => null)).toEqual([]);
  });
});

describe('F-B4: der scharfe Lauf meldet für die Akte Schritt und Phase (rein)', () => {
  const jetzt = '2026-10-29T12:00:00.000Z';
  const lauf = (modus: 'scharf' | 'schatten', schritte: ProzessLauf['schritte']) => ({ modus, fall: { art: 'mandat' as const, id: 'm1' }, schritte, prozessId: PZ_A, status: 'laeuft' as const });
  const s = (n: number, status: 'erledigt' | 'wartet', ab: string, bis?: string) => ({ knoten: fk(n), status, ab, ...(bis ? { bis } : {}) }) as ProzessLauf['schritte'][number];
  const b = { mandatId: 'm1', firmaId: 'f-1', bereich: 'business' as const };
  it('erledigter Schritt + Phase begonnen; dieselben Kennungen-Schemata wie der Paket-Fall; Schatten und Altes nie', () => {
    const l = akteEreignisse(lauf('scharf', [s(10, 'erledigt', '2026-10-28T09:00:00.000Z', '2026-10-29T09:00:00.000Z'), s(11, 'wartet', '2026-10-29T09:00:00.000Z')]), liefern, b, jetzt);
    expect(l.map(e => [e.art, e.id, e.stufe ?? null])).toEqual([
      ['fall-schritt-erledigt', ereignisKennung('fall', 'm1', fk(10), '2026-10-29'), null],
      ['fall-phase', ereignisKennung('fall', 'm1', 'phase', fk(2), 'begonnen', '2026-10-28'), 'begonnen'],
    ]);
    expect(l[1].bezug).toMatchObject({ mandatId: 'm1', vorlageId: PZ_A, knotenId: fk(2) });
    expect(akteEreignisse(lauf('schatten', [s(10, 'erledigt', '2026-10-28T09:00:00.000Z', '2026-10-29T09:00:00.000Z')]), liefern, b, jetzt)).toEqual([]);
    expect(akteEreignisse(lauf('scharf', [s(10, 'erledigt', '2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z')]), liefern, b, jetzt)).toEqual([]);
  });
  it('alle Schritte der Phase erledigt → Phase abgeschlossen (Tag des letzten)', () => {
    const l = akteEreignisse(lauf('scharf', [s(10, 'erledigt', '2026-10-29T08:00:00.000Z', '2026-10-29T09:00:00.000Z'), s(11, 'erledigt', '2026-10-29T09:00:00.000Z', '2026-10-29T11:00:00.000Z')]), liefern, b, jetzt);
    expect(l.filter(e => e.art === 'fall-phase').map(e => e.stufe)).toEqual(['begonnen', 'abgeschlossen']);
  });
});

// ══ Server ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
let db: typeof import('@/lib/store/local-db');
const faelle = async () => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle', H)).faelle as Record<string, Fall>;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: J }],
    leistungen: [produkt('p-haupt'), produkt('p-z', { rolle: 'zusatz' }), produkt('p-pz', { prozessId: PZ_A }), produkt('p-ohne')],
    mandate: [
      mandat('m-paket', 'p-haupt', { zusatz: [{ id: 'mz-1', leistungId: 'p-z' }] }), mandat('m-pz', 'p-pz'), mandat('m-ohne', 'p-ohne'),
      mandat('m-akte', 'p-pz'), mandat('m-netz', 'p-haupt'), mandat('m-alt', 'p-haupt'),
    ] } satisfies CrmBestand);
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ_A, liefern, 'aktiv')] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ_A]: scharf() } });
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [PAKET, ZUSATZ], bausteine: [], rituale: [], zuordnung: { 'p-haupt': { vorlageId: PAKET.id }, 'p-z': { vorlageId: ZUSATZ.id } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('EIN Start für jeden Fall (mandatFallStarten)', () => {
  it('Paket nach der Zuordnung des Produkts — mit dem Zusatzmodul des Mandats als Abschnitt (F-B8)', async () => {
    const { mandatFallStarten } = await import('@/lib/fulfillment/prozesse/fall-server');
    const r = await mandatFallStarten({ mandatId: 'm-paket', person: 'pia' });
    expect(r).toMatchObject({ art: 'neu', ablauf: 'paket' });
    expect(r.fall.vorlageId).toBe(PAKET.id);
    expect(r.fall.zusaetze?.map(z => z.vorlageId)).toEqual([ZUSATZ.id]);
  });
  it('Prozess des Produkts (Werkstatt) → Akte mit `ablauf`', async () => {
    const { mandatFallStarten } = await import('@/lib/fulfillment/prozesse/fall-server');
    const r = await mandatFallStarten({ mandatId: 'm-pz', person: 'pia' });
    expect(r.ablauf).toBe('prozess');
    expect((await faelle())['m-pz']).toMatchObject({ vorlageId: PZ_A, ablauf: { art: 'prozess', prozessId: PZ_A } });
  });
  it('ohne Ablauf am Produkt → 409, nichts angelegt', async () => {
    const { mandatFallStarten } = await import('@/lib/fulfillment/prozesse/fall-server');
    await expect(mandatFallStarten({ mandatId: 'm-ohne', person: 'pia' })).rejects.toMatchObject({ status: 409 });
    expect((await faelle())['m-ohne']).toBeUndefined();
  });
  it('die Fall-Route nimmt denselben Weg (ohne Wahl: Regel des Produkts)', async () => {
    const { POST } = await import('@/app/api/fulfillment/fall/route');
    const r = await POST(new Request('http://test/api/fulfillment/fall', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ aktion: 'starten', mandatId: 'm-netz', anfrageId: 'a-kl-1' }) }));
    expect(r.status).toBe(200);
    expect((await faelle())['m-netz']?.vorlageId).toBe(PAKET.id);
  });
});

describe('F-B2: jeder scharfe Lauf legt die Akte an', () => {
  it('ein scharfer Start (z. B. „scharf schalten“ für bestehende) → Akte; ein zweiter Start legt nichts doppelt an', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const def = { ...liefern, id: PZ_A };
    const r = await S.prozessLaufStarten({ id: 'pl-kl-akte', prozessId: PZ_A, version: 1, def, fall: { art: 'mandat', id: 'm-akte' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'bestehend', quelle: 'bestehend:2026-10-29' }, automatisch: true, jetzt: new Date().toISOString() }, H);
    expect(r.ok).toBe(true);
    const f = (await faelle())['m-akte'];
    expect(f).toMatchObject({ vorlageId: PZ_A, ablauf: { art: 'prozess', prozessId: PZ_A } });
    const vorher = JSON.stringify(f);
    await S.prozessLaufStarten({ id: 'pl-kl-akte2', prozessId: PZ_A, version: 1, def, fall: { art: 'mandat', id: 'm-akte' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'bestehend', quelle: 'x' }, automatisch: true, jetzt: new Date().toISOString() }, H);
    expect(JSON.stringify((await faelle())['m-akte'])).toBe(vorher);
  });
});

describe('Mandat beendet → Fall abgeschlossen (Kevin 29.10.)', () => {
  it('über den CRM-Schreibweg: Status „abgeschlossen“ + Marke + Ereignis `fall-abgeschlossen` (Stufe mandatsende); zweimal → nichts doppelt', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { localDay } = await import('@/lib/zeit');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === 'm-paket' ? { ...m, status: 'beendet', ende: localDay() } : m)) }), { art: 'person', person: 'pia' });
    const f = (await faelle())['m-paket'];
    const { MARKE_MANDATSENDE, fallNachMandatsende } = await import('@/lib/fulfillment/prozesse/fall-server');
    expect(f.status).toBe('abgeschlossen');
    expect(f.marken[MARKE_MANDATSENDE]).toBe(localDay());
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    const ab = (await ereignisseLaden()).eintraege.filter(e => e.art === 'fall-abgeschlossen');
    expect(ab.map(e => [e.bezug.mandatId, e.stufe])).toEqual([['m-paket', 'mandatsende']]);
    expect(await fallNachMandatsende('m-paket')).toBe(false);
    expect((await ereignisseLaden()).eintraege.filter(e => e.art === 'fall-abgeschlossen').length).toBe(1);
  });
  it('Mandat mit Werkstatt-Akte endet → offene Läufe am Fall enden („Mandat beendet“); ein Nachsorge-Lauf (an „Fall abgeschlossen“) bleibt', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const offen = (await S.laeufeLesen(H)).laeufe.filter(x => x.fall.id === 'm-pz' && x.status !== 'fertig' && x.status !== 'abgebrochen');
    expect(offen.length).toBeGreaterThan(0);
    // Ein Nachsorge-Lauf desselben Mandats (gestartet durch „Fall abgeschlossen“) — er gehört zur Zeit danach.
    await S.laeufeAendern(d => ({ datei: { ...d, laeufe: [...d.laeufe, { ...offen[0], id: 'pl-kl-nachsorge', schluessel: `${offen[0].schluessel}|nachsorge`, daten: { ...offen[0].daten, 'ereignis.art': 'fall-abgeschlossen' } }] }, r: null }), H);
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { localDay } = await import('@/lib/zeit');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === 'm-pz' ? { ...m, status: 'beendet', ende: localDay() } : m)) }), { art: 'person', person: 'pia' });
    const nach = (await S.laeufeLesen(H)).laeufe;
    for (const o of offen) expect(nach.find(x => x.id === o.id)).toMatchObject({ status: 'abgebrochen', grund: 'mandat-beendet' });
    expect(nach.find(x => x.id === 'pl-kl-nachsorge')?.status).toBe(offen[0].status);
    expect((await faelle())['m-pz'].status).toBe('abgeschlossen');
  });
  it('Netz im Morgenlauf: erst nur der Stichtag; danach schließt es Fälle ab dem Stichtag — Altbestand (Ende davor) bleibt', async () => {
    const { mandatFallStarten, mandatsendeNetz, MARKE_MANDATSENDE_SEIT } = await import('@/lib/fulfillment/prozesse/fall-server');
    const { localDay } = await import('@/lib/zeit');
    const heute = localDay();
    await mandatFallStarten({ mandatId: 'm-alt', person: 'pia' });
    expect(await mandatsendeNetz(H, heute)).toBe(0);
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    expect((await fulfillmentLesen('vorlagen', H)).marken[MARKE_MANDATSENDE_SEIT]).toBe(heute);
    // Beide Mandate enden ohne den CRM-Schreibweg (z. B. ein Ereignis ging verloren): m-netz heute, m-alt vor dem Stichtag.
    const crm = await db.loadJson<CrmBestand>('crm');
    await db.saveJson('crm', { ...crm!, mandate: crm!.mandate.map(m => (m.id === 'm-netz' ? { ...m, status: 'beendet', ende: heute } : m.id === 'm-alt' ? { ...m, status: 'beendet', ende: '2026-01-15' } : m)) });
    expect(await mandatsendeNetz(H, heute)).toBe(1);
    expect((await faelle())['m-netz'].status).toBe('abgeschlossen');
    expect((await faelle())['m-alt'].status).not.toBe('abgeschlossen');
  });
});
