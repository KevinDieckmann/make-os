// ─── Fulfillment in die Werkstatt — E2 „Bearbeiten im Fulfillment-Modus“ (22.10.; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──────────────────────────────
// Die Werkstatt bearbeitet einen ENTWURF im Bestand `fulfillment--<h>` (optional `entwuerfe`, nie eine Kopie in `prozesse--<h>`):
//   · rein: Bearbeiten mit den Regeln des Fulfillment-Editors (Sammel-Teilprozess bei Bausteinen, Papierkorb), Entwurf speichern (Stand/409, Fulfillment-Modus,
//     Struktur), gleich dem Paket → kein Entwurf, unverändert → nichts geschrieben, verwerfen; Säuberer und Grenzen
//   · Gold „Paket vorher = Paket nachher“: ein Entwurf ändert das Paket nie; „Fall vorher = Fall nachher“: die Fälle bleiben Byte für Byte, ein neuer Fall startet aus
//     dem Paket (nicht aus dem Entwurf)
//   · Route: nur volle Mitglieder schreiben (Partnerin „nur Business“ 403, Dienstweg 403, Privat 403), 409 mit der aktuellen Fassung
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-werkstatt-e2-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-werkstatt-e2';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});

import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { grenzenPruefen, GRENZEN } from '@/lib/fulfillment/grenzen';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { paketEntwurfAnwenden, paketEntwurfVerwerfen, paketEntwurfVon, gleicheFassung } from '@/lib/prozesse/fulfillment-entwurf';
import { paketBearbeiten, phaseVerschieben, schrittVerschieben, PALETTE_FORMEN } from '@/lib/prozesse/fulfillment-bearbeiten';
import type { Baustein, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-22T08:00:00.000Z';
const st = (x: object) => fingerabdruck(x as Record<string, unknown>);
const k = { person: 'pia', jetzt: J, standVon: st };
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let nr = 100;
const neueId = (p: string) => `${p}-00000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`;
const MAIL: Baustein = { id: 'fb-mail', art: 'mail', titel: 'Begrüßungsmail', gliederung: [], platzhalter: [], tags: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: J, geaendertVon: 'pia' };
const BIB = [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail', kundeFrei: true }];
const PAKET: ProzessVorlage = {
  id: 'fp-e2', art: 'paket', titel: 'Probe-Paket', fassung: 2, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], freigaben: [{ id: 'F0', titel: 'Rahmen', wer: 'beide' }],
  knoten: [
    { id: 'fk-w', titel: 'Probe-Paket', rang: 1 },
    { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1, kundeSichtbar: true, freigabe: 'F0' },
    { id: 'fk-p2', elternId: 'fk-w', titel: 'Umsetzung', rang: 2, kundeSichtbar: true },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1, form: 'termin' },
    { id: 'fk-b', elternId: 'fk-p1', titel: 'Fragebogen', rang: 2, form: 'schritt', zustaendig: 'kunde' },
    { id: 'fk-c', elternId: 'fk-p2', titel: 'Training', rang: 1, form: 'schritt' },
  ],
};
const datei = (): VorlagenDatei => vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [PAKET], bausteine: [MAIL] })));
const bearbeitet = (v: ProzessVorlage, ops: Parameters<typeof paketBearbeiten>[2]) => {
  const r = paketBearbeiten(v, BIB, ops, { person: 'pia', jetzt: J, neueId });
  if (!r.ok) throw new Error(r.fehler);
  return r.vorlage;
};

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Bearbeiten mit den Regeln des Fulfillment-Editors', () => {
  it('die Palette: fünf Formen am Schritt (die Bestätigung hängt an der Phase)', () => {
    expect([...PALETTE_FORMEN]).toEqual(['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin']);
  });
  it('Schritt anlegen, Baustein daran → Sammel-Teilprozess (Ebene 4/5) wie im Editor; Löschen → Papierkorb des Pakets', () => {
    const v0 = datei().prozesse[0];
    const v1 = bearbeitet(v0, [{ op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p2', nach: 'fk-c' }, form: 'nachricht', titel: 'Zwischenstand', frist: 3 }, { op: 'baustein-dazu', id: u(2), schrittId: u(1), bausteinId: 'fb-mail' }]);
    const s = v1.knoten.find(x => x.id === u(1))!;
    expect(v1.knoten.find(x => x.id === s.elternId)!.elternId).toBe('fk-p2'); // Ebene 4 unter einem Sammel-Teilprozess
    expect(v1.knoten.find(x => x.id === u(2))).toMatchObject({ elternId: u(1), bausteinId: 'fb-mail' });
    const v2 = bearbeitet(v1, [{ op: 'weg', id: 'fk-c' }]);
    expect(v2.knoten.some(x => x.id === 'fk-c')).toBe(false);
    expect(v2.papierkorb?.[0].id).toBe('fk-c');
  });
  it('Verschieben: Schritt nach oben/unten im Abschnitt, Phase früher/später — an der Grenze nichts', () => {
    const v = datei().prozesse[0];
    expect(schrittVerschieben(v, 'fk-a', 'hoch')).toBeNull();
    const runter = schrittVerschieben(v, 'fk-a', 'runter')!;
    expect(bearbeitet(v, [runter]).knoten.filter(x => x.elternId === 'fk-p1').sort((a, b) => a.rang - b.rang).map(x => x.id)).toEqual(['fk-b', 'fk-a']);
    expect(phaseVerschieben(v, 'fk-p1', 'hoch')).toBeNull();
    const ph = bearbeitet(v, [phaseVerschieben(v, 'fk-p2', 'hoch')!]);
    expect(ph.knoten.filter(x => x.elternId === 'fk-w').sort((a, b) => a.rang - b.rang).map(x => x.id)).toEqual(['fk-p2', 'fk-p1']);
  });
  it('eine Ablehnung des Editors kommt als Satz zurück (z. B. Nein-Zweig an einem Nicht-Entscheid)', () => {
    const r = paketBearbeiten(datei().prozesse[0], BIB, [{ op: 'nein-erinnerung', id: u(9), entscheidungId: 'fk-c' }], { person: 'pia', jetzt: J, neueId });
    expect(r.ok).toBe(false);
  });
});

describe('Entwurf speichern (rein) — Gold „Paket vorher = Paket nachher“', () => {
  it('ein Entwurf entsteht neben dem Paket; das Paket bleibt Byte für Byte', () => {
    const d = datei(); const vorher = JSON.stringify(d.prozesse);
    const v = bearbeitet(d.prozesse[0], [{ op: 'schritt-neu', id: u(3), ziel: { phaseId: 'fk-p1', nach: 'fk-b' }, form: 'schritt', titel: 'Unterlagen prüfen' }]);
    const r = paketEntwurfAnwenden(d, { paketId: 'fp-e2', stand: st(d.prozesse[0]), vorlage: v }, k);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.datei.prozesse)).toBe(vorher);
    const e = r.datei.entwuerfe!['fp-e2'];
    expect(e).toMatchObject({ basisFassung: 2, basisStand: st(d.prozesse[0]), von: 'pia' });
    expect(e.vorlage.knoten.some(x => x.id === u(3))).toBe(true);
    expect(e.vorlage.fassung).toBe(2); // die Fassungsnummer bestimmt nie der Browser
    // Unverändert noch einmal → nichts geändert; Stand ist jetzt der des Entwurfs.
    const r2 = paketEntwurfAnwenden(r.datei, { paketId: 'fp-e2', stand: st(e.vorlage), vorlage: { ...v, fassung: 99 } }, { ...k, jetzt: '2026-10-22T09:00:00.000Z' });
    expect(r2.ok && r2.datei).toBe(r.datei);
    // Alter Stand → 409 mit dem aktuellen.
    const r3 = paketEntwurfAnwenden(r.datei, { paketId: 'fp-e2', stand: st(d.prozesse[0]), vorlage: v }, k);
    expect(r3).toMatchObject({ ok: false, status: 409, konflikte: [{ id: 'fp-e2', stand: st(e.vorlage) }] });
    // Zurück auf den Stand des Pakets → kein Entwurf mehr (das Feld fehlt ganz).
    const r4 = paketEntwurfAnwenden(r.datei, { paketId: 'fp-e2', stand: st(e.vorlage), vorlage: d.prozesse[0] }, k);
    expect(r4.ok && 'entwuerfe' in r4.datei).toBe(false);
  });
  it('Werkstatt-Arten, fremde Kennung, kaputte Struktur → abgelehnt; die Kennung kommt nie aus dem Browser', () => {
    const d = datei(); const s = st(d.prozesse[0]);
    const agent = { ...d.prozesse[0], knoten: d.prozesse[0].knoten.map(x => (x.id === 'fk-c' ? { ...x, form: 'agent' } : x)) };
    expect(paketEntwurfAnwenden(d, { paketId: 'fp-e2', stand: s, vorlage: agent }, k)).toMatchObject({ ok: false, status: 400 });
    const ohneBaustein = { ...d.prozesse[0], knoten: [...d.prozesse[0].knoten, { id: u(4), elternId: 'fk-c', titel: 'X', rang: 1, bausteinId: 'fb-gibt-es-nicht' }] };
    expect(paketEntwurfAnwenden(d, { paketId: 'fp-e2', stand: s, vorlage: ohneBaustein }, k)).toMatchObject({ ok: false, status: 400 });
    expect(paketEntwurfAnwenden(d, { paketId: 'fp-nix', stand: s, vorlage: d.prozesse[0] }, k)).toMatchObject({ ok: false, status: 404 });
    const fremd = bearbeitet(d.prozesse[0], [{ op: 'titel', titel: 'Neu' }]);
    const r = paketEntwurfAnwenden(d, { paketId: 'fp-e2', stand: s, vorlage: { ...fremd, id: 'fp-andere' } }, k);
    expect(r.ok && Object.keys(r.datei.entwuerfe ?? {})).toEqual(['fp-e2']);
  });
  it('verwerfen: das Feld fehlt danach ganz; ohne Entwurf nichts geändert', () => {
    const d = datei();
    const v = bearbeitet(d.prozesse[0], [{ op: 'titel', titel: 'Anders' }]);
    const r = paketEntwurfAnwenden(d, { paketId: 'fp-e2', stand: st(d.prozesse[0]), vorlage: v }, k);
    if (!r.ok) throw new Error('kein Entwurf');
    const w = paketEntwurfVerwerfen(r.datei, 'fp-e2');
    expect(w.ok && 'entwuerfe' in w.datei).toBe(false);
    expect(paketEntwurfVerwerfen(d, 'fp-e2')).toMatchObject({ ok: true, geaendert: [] });
    expect(paketEntwurfVon(r.datei, 'fp-e2')?.entwurf).not.toBeNull();
    expect(gleicheFassung(v, { ...v, fassung: 7, geaendert: 'x', geaendertVon: 'y' })).toBe(true);
  });
  it('Säuberer: Entwürfe bleiben beim Lesen, Unlesbares fällt weg, ohne Entwürfe fehlt das Feld (bit-gleich); Grenzen 413', () => {
    const d = datei();
    expect('entwuerfe' in d).toBe(false);
    const roh = { ...d, entwuerfe: { 'fp-e2': { vorlage: d.prozesse[0], basisFassung: 2, basisStand: 's', am: J, von: 'pia' }, 'fp-falsch': { vorlage: d.prozesse[0], basisFassung: 2, basisStand: 's', am: J } } };
    const l = vorlagenAus(JSON.parse(JSON.stringify(roh)));
    expect(Object.keys(l.entwuerfe ?? {})).toEqual(['fp-e2']);
    const viele = Object.fromEntries(Array.from({ length: GRENZEN.vorlagen + 1 }, (_, i) => [`fp-x${i}`, { vorlage: d.prozesse[0], basisFassung: 1, basisStand: 's', am: J, von: 'pia' }]));
    expect(grenzenPruefen('vorlagen', { ...d, entwuerfe: viele })).toMatch(/Entwürfe/);
  });
});

// ══ Route ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const lies = (n: string) => readFileSync(path.join(ordner, `${n}.json`), 'utf8');
const mandat = (id: string) => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf', vertragUnterschrieben: true,
  start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
});

describe('Route: Entwurf eines Pakets', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-e2' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-e2' }), konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-e2', finanzRecht: 'business' }),
    ], einladungen: [] });
    const { leererBestand } = await import('@/lib/crm/speicher');
    await db.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-1'), mandat('m-2')] });
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
    await db.saveJson('fulfillment--haus-e2', datei());
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', vorlageId: 'fp-e2', anfrageId: 'e2-start-1' });
    if (s.status !== 200) throw new Error(`Start: ${s.status} ${JSON.stringify(s.j)}`);
  });
  afterAll(async () => {
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
    rmSync(ordner, { recursive: true, force: true });
  });
  const ansicht = async (p = 'pia') => (await rufe('prozesse/werkstatt', 'GET', sitzung(p), undefined, '?space=business&paket=fp-e2&bibliothek=1')).j as { arbeitsStand: string; entwurf: unknown; bearbeiten: boolean; paket: ProzessVorlage; bibliothekAlle: unknown[] };

  it('GET: bearbeiten nur volle Mitglieder; die ganze Bibliothek auf Wunsch', async () => {
    expect((await ansicht('pia')).bearbeiten).toBe(true);
    expect((await ansicht('olaf')).bearbeiten).toBe(true);
    expect((await ansicht('partnerin')).bearbeiten).toBe(false);
    expect((await ansicht()).bibliothekAlle).toHaveLength(1);
  });
  it('POST: „nur Business“ 403, Dienstweg 403, Privat 403 — nichts geschrieben', async () => {
    const vorher = lies('fulfillment--haus-e2');
    const a = await ansicht();
    const v = bearbeitet(a.paket, [{ op: 'titel', titel: 'Neuer Titel' }]);
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('partnerin'), { aktion: 'paket-entwurf', paketId: 'fp-e2', stand: a.arbeitsStand, vorlage: v }, '?space=business')).status).toBe(403);
    expect((await rufe('prozesse/werkstatt', 'POST', dienst('pia'), { aktion: 'paket-entwurf', paketId: 'fp-e2', stand: a.arbeitsStand, vorlage: v }, '?space=business')).status).toBe(403);
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId: 'fp-e2', stand: a.arbeitsStand, vorlage: v }, '?space=privat')).status).toBe(403);
    expect(lies('fulfillment--haus-e2')).toBe(vorher);
  });
  it('Entwurf speichern: Paket und Fälle Byte für Byte gleich (Gold), keine Kopie in prozesse--…; 409 mit der aktuellen Fassung', async () => {
    const faelle = lies('fulfillment-faelle--haus-e2');
    const a = await ansicht();
    const v = bearbeitet(a.paket, [{ op: 'schritt-neu', id: u(5), ziel: { phaseId: 'fk-p2' }, form: 'nachricht', titel: 'Abschlussbericht' }]);
    const r = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId: 'fp-e2', stand: a.arbeitsStand, vorlage: v }, '?space=business');
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const roh = JSON.parse(lies('fulfillment--haus-e2'));
    expect(JSON.stringify(vorlagenAus(roh).prozesse)).toBe(JSON.stringify(datei().prozesse));
    expect(roh.entwuerfe['fp-e2'].vorlage.knoten.some((x: { id: string }) => x.id === u(5))).toBe(true);
    expect(lies('fulfillment-faelle--haus-e2')).toBe(faelle);
    const pz = (await (await import('@/lib/store/local-db')).loadJson('prozesse--haus-e2'));
    expect(pz).toBeNull();
    const alt = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId: 'fp-e2', stand: a.arbeitsStand, vorlage: v }, '?space=business');
    expect(alt.status).toBe(409);
    expect((alt.j.aktuell as { arbeitsStand: string }).arbeitsStand).toBe(r.j.arbeitsStand);
  });
  it('ein neuer Fall startet weiter aus dem PAKET, nicht aus dem Entwurf', async () => {
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-2', vorlageId: 'fp-e2', anfrageId: 'e2-start-2' });
    expect(s.status).toBe(200);
    const f = (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle['m-2'];
    expect(f.knoten.some(x => x.id === u(5))).toBe(false);
    expect(f.vorlageFassung).toBe(2);
  });
  it('verwerfen: der Entwurf ist weg, das Paket bleibt', async () => {
    const r = await rufe('prozesse/werkstatt', 'POST', sitzung('olaf'), { aktion: 'paket-verwerfen', paketId: 'fp-e2' }, '?space=business');
    expect(r.status).toBe(200);
    const roh = JSON.parse(lies('fulfillment--haus-e2'));
    expect('entwuerfe' in roh).toBe(false);
    expect(JSON.stringify(vorlagenAus(roh).prozesse)).toBe(JSON.stringify(datei().prozesse));
  });
});
