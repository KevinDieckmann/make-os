// ─── Fulfillment in die Werkstatt — B3 „Eine Fläche“ (22.10.; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › B3) ──────────────────────────────────────
// Begleit-Prozesse docken OHNE zweites Feld an: über die Bedingungen ihres Auslösers (`fall.paket` bzw. `bezug.vorlageid`, `bezug.knotenid`):
//   · rein: `begleitFuer` (dieses Paket · alle Pakete · anderes Paket fällt weg · archiviert fällt weg · kein Begleit-Prozess fällt weg), `andockenAnwenden`
//   · Route: „Aus Vorlage“ mit `andocken` (Paket/Schritt müssen existieren, nur Begleit-Vorlagen), GET ?paket= liefert `begleitung`, Sicht Privat 403
//   · von Ende zu Ende über den Takt: ein Hänger des Falls startet NUR den Begleit-Prozess dieses Pakets (Probelauf = Schatten), der Lauf wartet auf
//     „Kunde hat geliefert“; GET /api/prozesse/laeufe?fall=mandat:<id> zeigt ihn (Karte „Begleitung läuft“); geliefert + nichts mehr offen → Ziel erreicht
//   · Gold: Paket und Fall bleiben über alle Takte Byte für Byte (der Begleit-Lauf schreibt nie in den Fall)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-begleitung-b3-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-begleitung-b3';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { andockVon, andockenAnwenden, begleitFuer, istBegleitProzess } from '@/lib/prozesse/begleitung/andocken';
import { vorlageVon } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { ausloeserAus, ausloeserPasst } from '@/lib/prozesse/ausloeser';
import { startKnoten } from '@/lib/prozesse/fluss';
import { wartetSatz } from '@/lib/prozesse/laeufe-ansicht';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import type { Ereignis } from '@/lib/ereignisse/typen';

const def = (id: string) => vorlageVon(id)!.definition;
const ausl = (d: ProzessDefinition) => startKnoten(d)[0].ausloeser!;
const bed = (d: ProzessDefinition) => (ausl(d) as { bedingungen?: { feld: string; op: string; wert?: unknown }[] }).bedingungen ?? [];

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('andockenAnwenden (rein)', () => {
  it('Ereignis mit Schritt: „nur dieses Paket“ (fall.paket) + „nur dieser Schritt“ (bezug.knotenid), die Stufe bleibt; gültig für den Auslöser', () => {
    const r = andockenAnwenden(def('fb-01'), { paket: 'fp-p', knoten: 'fk-s1' });
    expect(r.hinweise).toEqual([]);
    expect(bed(r.definition)).toEqual([{ feld: 'ereignis.stufe', op: 'gleich', wert: 'wartet' }, { feld: 'fall.paket', op: 'gleich', wert: 'fp-p' }, { feld: 'bezug.knotenid', op: 'gleich', wert: 'fk-s1' }]);
    expect(ausloeserAus(ausl(r.definition), 'mandat').befunde).toEqual([]);
    expect(andockVon(r.definition)).toMatchObject({ paket: 'fp-p', knoten: 'fk-s1' });
  });
  it('Datum (nächster Termin) und Ereignis ohne Schritt (Ziel erreicht): nur das Paket; erneut andocken ersetzt, nichts doppelt', () => {
    const t = andockenAnwenden(def('fb-05'), { paket: 'fp-p', knoten: 'fk-s1' }).definition;
    expect(bed(t)).toEqual([{ feld: 'fall.status', op: 'einer-von', wert: ['onboarding', 'laeuft'] }, { feld: 'fall.paket', op: 'gleich', wert: 'fp-p' }]);
    expect(ausloeserAus(ausl(t), 'mandat').befunde).toEqual([]);
    const z = andockenAnwenden(def('fb-07'), { paket: 'fp-p', knoten: 'fk-s1' }).definition;
    expect(bed(z)).toEqual([{ feld: 'fall.paket', op: 'gleich', wert: 'fp-p' }]);
    const zweimal = andockenAnwenden(andockenAnwenden(def('fb-01'), { paket: 'fp-p', knoten: 'fk-s1' }).definition, { paket: 'fp-q' }).definition;
    expect(bed(zweimal)).toEqual([{ feld: 'ereignis.stufe', op: 'gleich', wert: 'wartet' }, { feld: 'bezug.knotenid', op: 'gleich', wert: 'fk-s1' }, { feld: 'fall.paket', op: 'gleich', wert: 'fp-q' }]);
  });
  it('kein Begleit-Prozess (V15: Datum „Ende des Mandats“) bleibt unverändert; „oder“-Bedingungen bleiben mit Hinweis', () => {
    expect(istBegleitProzess(def('kg-v15'))).toBe(false);
    expect(andockenAnwenden(def('kg-v15'), { paket: 'fp-p' }).definition).toBe(def('kg-v15'));
    const oder: ProzessDefinition = { ...def('fb-08'), knoten: def('fb-08').knoten.map(k => (k.ausloeser?.art === 'ereignis' ? { ...k, ausloeser: { ...k.ausloeser, verknuepfung: 'oder' as const } } : k)) };
    const r = andockenAnwenden(oder, { paket: 'fp-p' });
    expect(r.definition).toEqual(oder);
    expect(r.hinweise.join(' ')).toMatch(/oder/);
  });
});

describe('begleitFuer (rein)', () => {
  const p = (id: string, d: ProzessDefinition, status: 'entwurf' | 'probelauf' | 'aktiv' | 'archiviert' = 'probelauf') => ({ id, titel: d.titel, status, definition: d });
  it('dieses Paket zuerst (mit Schritt), dann alle Pakete; anderes Paket, archiviert und Nicht-Begleit fallen weg', () => {
    const l = begleitFuer('fp-p', [
      p('pz-alle', def('fb-04')), p('pz-dieses', andockenAnwenden(def('fb-01'), { paket: 'fp-p', knoten: 'fk-s1' }).definition, 'aktiv'),
      p('pz-anderes', andockenAnwenden(def('fb-02'), { paket: 'fp-q' }).definition), p('pz-archiv', def('fb-06'), 'archiviert'), p('pz-v15', def('kg-v15')),
      p('pz-alt', { ...def('fb-03'), knoten: def('fb-03').knoten.map(k => (k.ausloeser?.art === 'ereignis' ? { ...k, ausloeser: { ...k.ausloeser, bedingungen: [{ feld: 'bezug.vorlageid', op: 'gleich' as const, wert: 'fp-p' }] } } : k)) }),
    ]);
    expect(l.map(x => [x.prozessId, x.paket, x.knoten ?? null])).toEqual([['pz-dieses', 'dieses', 'fk-s1'], ['pz-alt', 'dieses', null], ['pz-alle', 'alle', null]]);
    expect(l.find(x => x.prozessId === 'pz-dieses')!.ausloeser).toMatch(/Hängt|Fall|Ereignis|wenn/i);
  });
});

describe('wartetSatz (rein)', () => {
  it('Ereignis mit Namen, Freigabe, Aufgabe', () => {
    expect(wartetSatz({ art: 'ereignis', ereignis: 'kunde-geliefert' }, e => (e === 'kunde-geliefert' ? 'Kunde hat geliefert' : e))).toBe('wartet auf „Kunde hat geliefert“');
    expect(wartetSatz({ art: 'freigabe' })).toBe('wartet auf eine Freigabe im Stapel');
    expect(wartetSatz({ art: 'aufgabe' })).toBe('wartet auf eine Aufgabe');
    expect(wartetSatz(undefined)).toBeNull();
  });
});

// ══ Route und Takt ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Hd = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, Hd>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const H = 'haus-b3';
const J = '2026-10-01T08:00:00.000Z';
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const roh = (name: string) => readFileSync(path.join(ordner, `${name}.json`), 'utf8');
const M = { id: 'm-b3', firmaId: 'f-b3', gesellschaft: 'ug', kontaktIds: ['c-probe'] };
let paketP = '', paketQ = '', heute = '';
const ids: Record<string, string> = {};

async function paketNeu(titel: string, anfrageId: string, mitKunde: boolean): Promise<string> {
  const neu = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel, phase: 'Start', anfrageId });
  const id = neu.j.vorlageId as string;
  if (!mitKunde) return id;
  const kn = (neu.j.vorlage as { knoten: { id: string; elternId?: string }[] }).knoten;
  const start = kn.find(x => x.elternId === kn.find(y => !y.elternId)!.id)!.id;
  const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: id, stand: neu.j.stand, ops: [
    { op: 'schritt-neu', id: u(1), ziel: { phaseId: start }, form: 'schritt', titel: 'Unterlagen schicken', zustaendig: 'kunde', frist: 3 },
    { op: 'phase-neu', id: u(3), titel: 'Umsetzung', nach: start },
    { op: 'schritt-neu', id: u(4), ziel: { phaseId: u(3) }, form: 'schritt', titel: 'Umsetzen' },
  ] });
  if (r.status !== 200) throw new Error(`Editor: ${r.status} ${JSON.stringify(r.j)}`);
  return id;
}

beforeAll(async () => {
  heute = (await import('@/lib/zeit')).localDay();
  const { tagPlus } = await import('@/lib/kalender/zeit');
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await d.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', { ...leererBestand(), mandate: [{
    id: 'm-b3', kunde: 'Probe Kunde', firmaId: 'f-b3', kontaktIds: ['c-probe'], titel: 'Mandat Probe', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf',
    vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
    ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  }] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await d.saveJson('postfaecher--pia', { v: 1, postfaecher: [{ id: 'pf-00000000-0000-4000-8000-000000000001', quelle: 'imap', bereich: 'ug', anzeigename: 'Probe', adresse: 'pia@example.invalid' }] });
  paketP = await paketNeu('Probe-Paket P', 'b3-p', true);
  paketQ = await paketNeu('Probe-Paket Q', 'b3-q', false);
  const st = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-b3', vorlageId: paketP, start: tagPlus(heute, -20), anfrageId: 'b3-start' });
  if (st.status !== 200) throw new Error(`Start: ${st.status} ${JSON.stringify(st.j)}`);
  const { MUSTER_ONBOARDING } = await import('@/lib/fulfillment/muster');
  const { obKnotenId } = await import('@/lib/fulfillment/prozesse/onboarding');
  const ob = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b3', ops: MUSTER_ONBOARDING.map(s => ({ op: 'knoten-status', id: obKnotenId(s.schluessel), status: 'entfaellt', grund: 'Probe ohne Onboarding' })) });
  if (ob.status !== 200) throw new Error(`Onboarding: ${ob.status} ${JSON.stringify(ob.j)}`);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('„+ Begleit-Prozess“ am Paket über die Route', () => {
  it('andocken prüft Paket, Schritt und Art: unbekanntes Paket/Schritt → 400, Kundengewinnung → 400; nichts angelegt', async () => {
    const post = (b: Record<string, unknown>, n: number) => rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', eigner: 'konto-pia', anfrageId: `pza-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...b });
    expect((await post({ vorlageId: 'fb-01', andocken: { paket: 'fp-gibt-es-nicht' } }, 1)).status).toBe(400);
    expect((await post({ vorlageId: 'fb-01', andocken: { paket: paketP, knoten: 'fk-gibt-es-nicht' } }, 2)).status).toBe(400);
    expect((await post({ vorlageId: 'kg-v09', andocken: { paket: paketP } }, 3)).status).toBe(400);
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    expect((await prozesseLesen(H)).prozesse).toHaveLength(0);
  });
  it('FB1 an Paket P (Schritt „Unterlagen schicken“) und an Paket Q, FB4 ohne Andocken — die Werkstatt-Ansicht von P zeigt genau ihre Begleitung; Paket Byte für Byte', async () => {
    const paketVorher = roh(`fulfillment--${H}`);
    const post = async (vorlageId: string, n: number, andocken?: Record<string, string>) => {
      const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', vorlageId, eigner: 'konto-pia', anfrageId: `pza-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...(andocken ? { andocken } : {}) });
      expect(r.status, JSON.stringify(r.j)).toBe(200);
      expect((r.j.eintrag as { status: string }).status).toBe('probelauf');
      return (r.j.eintrag as { id: string }).id;
    };
    ids.p = await post('fb-01', 10, { paket: paketP, knoten: u(1) });
    ids.q = await post('fb-01', 11, { paket: paketQ });
    ids.alle = await post('fb-04', 12);
    const g = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, `?paket=${paketP}&space=business`);
    expect(g.status).toBe(200);
    expect((g.j.begleitung as { prozessId: string; paket: string; knoten?: string }[]).map(b => [b.prozessId, b.paket, b.knoten ?? null])).toEqual([[ids.p, 'dieses', u(1)], [ids.alle, 'alle', null]]);
    expect((await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, `?paket=${paketP}&space=privat`)).status).toBe(403);
    expect(roh(`fulfillment--${H}`)).toBe(paketVorher);
  });
  it('Wiedereintritt je Mandat aus der Vorlage: FB1 läuft frühestens nach 14 Tagen erneut (Läufe-Einstellung), FB4 nach einem Tag', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const d = await S.laeufeLesen(H);
    expect(d.prozesse[ids.p]?.einstellung.erneutNachTagen).toBe(14);
    expect(d.prozesse[ids.alle]?.einstellung.erneutNachTagen).toBe(1);
  });
});

describe('Von Ende zu Ende über den Takt (Probelauf = Schatten)', () => {
  // Im Probelauf (Schatten) wartet der Motor nicht wirklich — ein Warten gilt als „eingetreten“, jede Raute liest aber die ECHTE Lage des Falls. So zeigt der
  // Lauf, welchen Weg er gehen würde: wartet noch etwas auf den Kunden → zweite Erinnerung, Anruf, Eigner; wartet nichts mehr → „Geliefert“.
  let fallVorher = '', paketVorher = '';
  const knoten = (lokal: string, id: string) => {
    const neu = (async () => (await import('@/lib/prozesse/werkstatt-server')).prozesseLesen(H))();
    // Nur Schritte (mit Form) — eine Phase kann denselben Titel tragen („Zweite Erinnerung“).
    return neu.then(d => d.prozesse.find(p => p.id === id)!.entwurf.knoten.find(k => !!k.form && k.form !== 'freigabe' && k.titel === def('fb-01').knoten.find(x => x.id === `fb-01:${lokal}`)!.titel)!.id);
  };
  it('ein Hänger „wartet“ im Fall P startet nur den Begleit-Prozess von P (der für Q nicht, der für alle hört auf „Etappe geschafft“); der Fall wartet noch → bis zum Eigner', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    await S.prozesseImTakt(); // erster Takt: Cursor setzen (nie die Vergangenheit nachholen)
    fallVorher = roh(`fulfillment-faelle--${H}`); paketVorher = roh(`fulfillment--${H}`);
    const { fallHaengtEreignisse } = await import('@/lib/ereignisse/quellen');
    expect(await fallHaengtEreignisse([{ m: M, vorlageId: paketP, haengt: [{ art: 'wartet', knotenId: u(1), seit: heute }] }])).toBe(1);
    await S.prozesseImTakt();
    await S.prozesseImTakt();
    const l = (await S.laeufeLesen(H)).laeufe;
    expect(l.map(x => [x.prozessId, x.fall.id, x.modus])).toEqual([[ids.p, 'm-b3', 'schatten']]);
    expect(l[0]).toMatchObject({ status: 'fertig', ergebnis: 'abbruch' });
    const besucht = l[0].schritte.map(x => x.knoten);
    expect(besucht).toContain(await knoten('e2', ids.p));
    expect(besucht).toContain(await knoten('g1', ids.p));
    // Gold: der Begleit-Lauf (Schatten) schreibt nie in den Fall und nie ins Paket.
    expect(roh(`fulfillment-faelle--${H}`)).toBe(fallVorher);
    expect(roh(`fulfillment--${H}`)).toBe(paketVorher);
  });
  it('Karte „Begleitung läuft“: GET /api/prozesse/laeufe?fall=mandat:<id> — Titel, Probelauf, Status; Sicht Privat 403, Unsinn 400', async () => {
    const r = await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, '?fall=mandat:m-b3&space=business');
    expect(r.status).toBe(200);
    expect(r.j.laeufe).toEqual([expect.objectContaining({ prozessId: ids.p, titel: def('fb-01').titel, modus: 'schatten', status: 'fertig', fall: { art: 'mandat', id: 'm-b3' } })]);
    expect(r.j.weitere).toBe(0);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, '?fall=mandat:m-b3&space=privat')).status).toBe(403);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, '?fall=keiner:x&space=business')).status).toBe(400);
    expect((await rufe('prozesse/laeufe', 'GET', sitzung('pia'), undefined, '?fall=mandat:m-anderes&space=business')).j.laeufe).toEqual([]);
  });
  it('Ende-Bedingung: hat der Kunde geliefert und wartet nichts mehr, endet der Lauf bei „Geliefert“ — keine zweite Erinnerung; FB1 läuft binnen 14 Tagen nicht doppelt', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    // Eine zweite Kopie von FB1 an Paket P (nach dem ersten Hänger übernommen) — die erste hat am Mandat schon einen Lauf (Wiedereintritt erst nach 14 Tagen).
    const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'fb-01', eigner: 'konto-pia', anfrageId: 'pza-00000000-0000-4000-8000-000000000020', andocken: { paket: paketP } });
    expect(r.status).toBe(200);
    ids.zwei = (r.j.eintrag as { id: string }).id;
    // Das Team hakt die Lieferung im Fall ab (der vorhandene Weg des Falls — nicht der Begleit-Prozess).
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b3', ops: [{ op: 'knoten-status', id: u(1), status: 'erledigt' }] })).status).toBe(200);
    const { faelleFuerProzesse } = await import('@/lib/fulfillment/prozesse/server');
    expect((await faelleFuerProzesse(heute))['m-b3'].wartetKunde).toBe(0);
    fallVorher = roh(`fulfillment-faelle--${H}`); paketVorher = roh(`fulfillment--${H}`);
    const { fallHaengtEreignisse } = await import('@/lib/ereignisse/quellen');
    expect(await fallHaengtEreignisse([{ m: M, vorlageId: paketP, haengt: [{ art: 'wartet', knotenId: u(1), seit: '2026-10-01' }] }])).toBe(1);
    await S.prozesseImTakt();
    await S.prozesseImTakt();
    const alle = (await S.laeufeLesen(H)).laeufe;
    expect(alle.filter(x => x.prozessId === ids.p)).toHaveLength(1);
    const l = alle.filter(x => x.prozessId === ids.zwei);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    expect(l[0].schritte.map(x => x.knoten)).toContain(await knoten('z1', ids.zwei));
    expect(l[0].schritte.map(x => x.knoten)).not.toContain(await knoten('e2', ids.zwei));
    expect(roh(`fulfillment-faelle--${H}`)).toBe(fallVorher);
    expect(roh(`fulfillment--${H}`)).toBe(paketVorher);
  });
  it('Auslöser mit „nur dieses Paket“ passt nur auf den Fall dieses Pakets (fall.paket aus der Cockpit-Rechnung)', () => {
    const a = ausl(andockenAnwenden(def('fb-01'), { paket: 'fp-p' }).definition);
    const e = { id: 'x', nr: 1, art: 'fall-haengt', quelle: 'fulfillment', bereich: 'business', stufe: 'wartet', am: J, bezug: { mandatId: 'm-b3' } } as unknown as Ereignis;
    expect(ausloeserPasst(a, 'pz-egal', e, { 'ereignis.stufe': 'wartet', 'fall.paket': 'fp-p' })).toBe(true);
    expect(ausloeserPasst(a, 'pz-egal', e, { 'ereignis.stufe': 'wartet', 'fall.paket': 'fp-q' })).toBe(false);
  });
});
