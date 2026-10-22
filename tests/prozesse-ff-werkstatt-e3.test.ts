// ─── Fulfillment in die Werkstatt — E3 „Veröffentlichen + je Kunde übernehmen“ (22.10., Entscheidung F2; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──────
// Veröffentlichen schreibt den Entwurf als NEUE Fassung ins Paket (über die Schreibstelle des Fulfillments, Stand/409) — laufende Fälle ändern sich NICHT
// (Gold „Fall vorher = Fall nachher“). Die Antwort nennt die laufenden Kunden mit ihrer Änderung (`diffVorschau`); übernommen wird je Kunde per Klick über den
// VORHANDENEN Weg (`vorlage-uebernehmen` → `vorlageUebernehmen`, dieselbe Funktion wie bisher). Neue Fälle starten mit der neuen Fassung. Wurde das Paket seit
// Beginn des Entwurfs anders gespeichert → 409 `paketGeaendert`, nur „trotzdem“ ersetzt. Rechte: nur volle Mitglieder. Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-werkstatt-e3-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-werkstatt-e3';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});

import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { paketVeroeffentlichen, fassungNotizMarke, paketEntwurfAnwenden } from '@/lib/prozesse/fulfillment-entwurf';
import { paketBearbeiten } from '@/lib/prozesse/fulfillment-bearbeiten';
import { vorlageUebernehmen } from '@/lib/fulfillment/prozesse/fall';
import type { Baustein, ProzessVorlage, VorlagenDatei, Fall } from '@/lib/fulfillment/typen';

const J = '2026-10-22T08:00:00.000Z';
const st = (x: object) => fingerabdruck(x as Record<string, unknown>);
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MAIL: Baustein = { id: 'fb-mail', art: 'mail', titel: 'Begrüßungsmail', gliederung: [], platzhalter: [], tags: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: J, geaendertVon: 'pia' };
const PAKET: ProzessVorlage = {
  id: 'fp-e3', art: 'paket', titel: 'Probe-Paket', fassung: 2, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], freigaben: [],
  knoten: [
    { id: 'fk-w', titel: 'Probe-Paket', rang: 1 },
    { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1, kundeSichtbar: true },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1 },
    { id: 'fk-b', elternId: 'fk-p1', titel: 'Fragebogen', rang: 2, zustaendig: 'kunde' },
  ],
};
const datei = (): VorlagenDatei => vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [PAKET], bausteine: [MAIL] })));
const BIB = [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail', kundeFrei: true }];
const neu = (v: ProzessVorlage, titel: string, n: number) => {
  const r = paketBearbeiten(v, BIB, [{ op: 'schritt-neu', id: u(n), ziel: { phaseId: 'fk-p1', nach: 'fk-b' }, form: 'schritt', titel }], { person: 'pia', jetzt: J, neueId: p => `${p}-x` });
  if (!r.ok) throw new Error(r.fehler);
  return r.vorlage;
};

describe('Veröffentlichen (rein)', () => {
  const k = { person: 'pia', jetzt: J, standVon: st };
  const mitEntwurf = () => {
    const d = datei();
    const r = paketEntwurfAnwenden(d, { paketId: 'fp-e3', stand: st(d.prozesse[0]), vorlage: neu(d.prozesse[0], 'Unterlagen prüfen', 1) }, k);
    if (!r.ok) throw new Error(r.fehler);
    return r.datei;
  };
  it('der Entwurf wird Fassung + 1, der Entwurf ist weg, Name/Notiz als Marke', () => {
    const d = mitEntwurf();
    const r = paketVeroeffentlichen(d, { paketId: 'fp-e3', stand: st(d.entwuerfe!['fp-e3'].vorlage), name: 'Prüfung ergänzt', notiz: 'Neuer Schritt' }, k);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fassung).toBe(3);
    expect(r.datei.prozesse[0]).toMatchObject({ fassung: 3, geaendertVon: 'pia' });
    expect(r.datei.prozesse[0].knoten.some(x => x.id === u(1))).toBe(true);
    expect('entwuerfe' in r.datei).toBe(false);
    expect(r.datei.marken[fassungNotizMarke('fp-e3', 3)]).toBe('Prüfung ergänzt — Neuer Schritt');
  });
  it('ohne Entwurf 409, veralteter Stand 409, Paket inzwischen anders → 409 paketGeaendert (trotzdem ersetzt), zu lange Notiz 413', () => {
    expect(paketVeroeffentlichen(datei(), { paketId: 'fp-e3', stand: 'x' }, k)).toMatchObject({ ok: false, status: 409 });
    const d = mitEntwurf();
    const s = st(d.entwuerfe!['fp-e3'].vorlage);
    expect(paketVeroeffentlichen(d, { paketId: 'fp-e3', stand: 'alt' }, k)).toMatchObject({ ok: false, status: 409 });
    const anders = { ...d, prozesse: d.prozesse.map(p => ({ ...p, titel: 'Im alten Editor umbenannt' })) };
    expect(paketVeroeffentlichen(anders, { paketId: 'fp-e3', stand: s }, k)).toMatchObject({ ok: false, status: 409, paketGeaendert: true });
    expect(paketVeroeffentlichen(anders, { paketId: 'fp-e3', stand: s, trotzdem: true }, k)).toMatchObject({ ok: true, fassung: 3 });
    expect(paketVeroeffentlichen(d, { paketId: 'fp-e3', stand: s, notiz: 'x'.repeat(501) }, k)).toMatchObject({ ok: false, status: 413 });
  });
});

// ══ Route ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const lies = (n: string) => readFileSync(path.join(ordner, `${n}.json`), 'utf8');
const faelle = async () => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle;
const mandat = (id: string, gesellschaft = 'ug') => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft, status: 'aktiv', zustaendig: 'olaf', vertragUnterschrieben: true,
  start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
});
type Ansicht = { arbeitsStand: string; paket: ProzessVorlage; kunden: { mandatId: string; fassung: number; aenderung: { titel: string; zeilen: string[] }[] | null }[] };
const ansicht = async () => (await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?space=business&paket=fp-e3')).j as unknown as Ansicht;
const entwurf = async (titel: string, n: number) => {
  const a = await ansicht();
  const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId: 'fp-e3', stand: a.arbeitsStand, vorlage: neu(a.paket, titel, n) }, '?space=business');
  if (r.status !== 200) throw new Error(`Entwurf: ${r.status} ${JSON.stringify(r.j)}`);
  return r.j as unknown as Ansicht;
};

describe('Route: veröffentlichen, dann je Kunde übernehmen', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-e3' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-e3' }), konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-e3', finanzRecht: 'business' }),
    ], einladungen: [] });
    const { leererBestand } = await import('@/lib/crm/speicher');
    await db.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-1'), mandat('m-2'), mandat('m-3'), mandat('m-p', 'kdc')] });
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
    await db.saveJson('fulfillment--haus-e3', datei());
    for (const m of ['m-1', 'm-2']) {
      const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: m, vorlageId: 'fp-e3', anfrageId: `e3-start-${m}` });
      if (s.status !== 200) throw new Error(`Start ${m}: ${s.status} ${JSON.stringify(s.j)}`);
    }
  });
  afterAll(async () => {
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
    rmSync(ordner, { recursive: true, force: true });
  });

  it('veröffentlichen: nur volle Mitglieder; Fassung 3 im Paket — laufende Fälle Byte für Byte gleich (Gold); die Antwort nennt die Kunden mit ihrer Änderung', async () => {
    const a = await entwurf('Unterlagen prüfen', 1);
    const vorher = lies('fulfillment-faelle--haus-e3');
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('partnerin'), { aktion: 'paket-veroeffentlichen', paketId: 'fp-e3', stand: a.arbeitsStand }, '?space=business')).status).toBe(403);
    const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-veroeffentlichen', paketId: 'fp-e3', stand: a.arbeitsStand, name: 'Prüfung' }, '?space=business');
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.veroeffentlicht).toBe(3);
    expect(lies('fulfillment-faelle--haus-e3')).toBe(vorher);
    const roh = JSON.parse(lies('fulfillment--haus-e3'));
    expect(roh.prozesse[0].fassung).toBe(3);
    expect('entwuerfe' in roh).toBe(false);
    const kunden = (r.j as unknown as Ansicht).kunden;
    expect(kunden.map(x => [x.mandatId, x.fassung])).toEqual([['m-1', 2], ['m-2', 2]]);
    expect(kunden[0].aenderung).toEqual([{ titel: 'Neu', zeilen: ['Unterlagen prüfen'] }]);
  });
  it('übernehmen je Kunde über den vorhandenen Weg: nur dieser Fall ändert sich — genau wie `vorlageUebernehmen`', async () => {
    const vor = await faelle();
    const m2 = JSON.stringify(vor['m-2']);
    const r = await rufe('fulfillment/fall', 'POST', sitzung('olaf'), { aktion: 'vorlage-uebernehmen', mandatId: 'm-1' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const nach = await faelle();
    expect(nach['m-1'].vorlageFassung).toBe(3);
    const paket = JSON.parse(lies('fulfillment--haus-e3')).prozesse[0] as ProzessVorlage;
    const erwartet: Fall = vorlageUebernehmen(vor['m-1'], paket, nach['m-1'].geaendert, 'olaf');
    expect(nach['m-1'].knoten.map(x => [x.id, x.titel, x.elternId])).toEqual(erwartet.knoten.map(x => [x.id, x.titel, x.elternId]));
    expect(JSON.stringify(nach['m-2'])).toBe(m2);
    const a = await ansicht();
    expect(a.kunden.map(x => [x.mandatId, x.aenderung === null])).toEqual([['m-1', true], ['m-2', false]]);
  });
  it('ein neuer Fall startet mit der neuen Fassung', async () => {
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-3', vorlageId: 'fp-e3', anfrageId: 'e3-start-m-3' });
    expect(s.status).toBe(200);
    const f = (await faelle())['m-3'];
    expect(f.vorlageFassung).toBe(3);
    expect(f.knoten.some(x => x.id === u(1))).toBe(true);
  });
  it('Paket inzwischen anders gespeichert (alter Editor) → 409 paketGeaendert; „trotzdem“ veröffentlicht', async () => {
    const a = await entwurf('Abschluss prüfen', 2);
    const db = await import('@/lib/store/local-db');
    const roh = JSON.parse(lies('fulfillment--haus-e3'));
    roh.prozesse[0].titel = 'Im alten Editor umbenannt';
    await db.saveJson('fulfillment--haus-e3', roh);
    const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-veroeffentlichen', paketId: 'fp-e3', stand: a.arbeitsStand }, '?space=business');
    expect(r.status).toBe(409);
    expect(r.j.paketGeaendert).toBe(true);
    const t = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-veroeffentlichen', paketId: 'fp-e3', stand: a.arbeitsStand, trotzdem: true }, '?space=business');
    expect(t.status, JSON.stringify(t.j)).toBe(200);
    expect(t.j.veroeffentlicht).toBe(4);
  });
});
