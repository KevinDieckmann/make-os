// ─── Prozesse B1 — Entwurf, Versionen, Rollen, Werkstatt-Route (21.10.; Punkte 10, 43, 68) ──────────────────────────────────────────────────────────
// Live läuft nur Veröffentlichtes; Versionen unveränderlich, vergleichbar, als Entwurf übernehmbar. Volle Mitglieder veröffentlichen und schalten aktiv,
// Konten „nur Business“ bauen Entwürfe; aktiv erst mit Eigner aus dem Team, Start-/Endkriterium und einer Person mit Konto (nie Rückfall auf den Inhaber).
// Wächter „Sicht X bekommt nichts aus Y“: Testkunde, fremder Haushalt, Dienstweg, Sicht Privat. Eigener Datenordner, erfundene Konten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { veroeffentlichen, versionAlsEntwurf, versionenVergleichen, entwurfGeaendert } from '@/lib/prozesse/versionen';
import { neuerProzess, werkstattAnwenden, leerProzesse, type WerkstattKontext } from '@/lib/prozesse/bestand';
import { prozessRechte, laufPerson, KEINE_RECHTE } from '@/lib/prozesse/rollen';
import { aktivBefunde } from '@/lib/prozesse/definition-pruefen';
import type { ProzessEintrag } from '@/lib/prozesse/definition';
import { fk, PZ, J, konto, schritt } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-versionen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-versionen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const zaehler = () => { let i = 10; return () => fk(i++); };
const neu = (): ProzessEintrag => neuerProzess({ id: PZ, titel: 'Lead-Eingang', bereich: 'sales', fallArt: 'lead', von: 'pia', jetzt: J, kennung: zaehler() });

describe('Versionen (rein)', () => {
  it('veröffentlichen: Name Pflicht, Nummer +1, unverändert → 409, die Version ist eine Kopie', () => {
    const e = neu();
    expect(veroeffentlichen(e, { name: '', von: 'pia', jetzt: J })).toMatchObject({ ok: false, status: 400 });
    const v1 = veroeffentlichen(e, { name: 'Start', notiz: 'erste Fassung', von: 'pia', jetzt: J });
    expect(v1).toMatchObject({ ok: true, version: { nr: 1, name: 'Start', notiz: 'erste Fassung' } });
    if (!v1.ok) return;
    expect(veroeffentlichen(v1.eintrag, { name: 'nochmal', von: 'pia', jetzt: J })).toMatchObject({ ok: false, status: 409 });
    // Den Entwurf ändern ändert die Version nicht.
    v1.eintrag.entwurf.knoten.push(schritt(90, 'Neu', 5, {}, v1.eintrag.entwurf.knoten[1].id));
    expect(v1.eintrag.versionen[0].definition.knoten.some(k => k.id === fk(90))).toBe(false);
    expect(entwurfGeaendert(v1.eintrag)).toBe(true);
    const v2 = veroeffentlichen(v1.eintrag, { name: 'Zwei', von: 'olaf', jetzt: J });
    expect(v2).toMatchObject({ ok: true, version: { nr: 2 } });
    if (!v2.ok) return;
    const vg = versionenVergleichen(v2.eintrag.versionen[0].definition, v2.eintrag.versionen[1].definition);
    expect(vg.knoten.neu).toEqual([{ id: fk(90), titel: 'Neu' }]);
    expect(vg.steckbrief).toEqual([]);
    // Version 1 als Entwurf übernehmen.
    const zurueck = versionAlsEntwurf(v2.eintrag, 1, { von: 'pia', jetzt: J });
    expect(zurueck.ok && zurueck.eintrag.entwurf.knoten.some(k => k.id === fk(90))).toBe(false);
    expect(versionAlsEntwurf(v2.eintrag, 7, { von: 'pia', jetzt: J })).toMatchObject({ ok: false, status: 404 });
  });
  it('höchstens 100 Versionen — darüber 413, nie still eine alte entfernt', () => {
    const e = neu();
    e.versionen = Array.from({ length: 100 }, (_, i) => ({ nr: i + 1, name: `v${i + 1}`, am: J, von: 'pia', definition: { ...e.entwurf, titel: `alt ${i}` } }));
    expect(veroeffentlichen(e, { name: 'zu viel', von: 'pia', jetzt: J })).toMatchObject({ ok: false, status: 413 });
  });
});

describe('Rollen (rein)', () => {
  it('volle Mitglieder alles, „nur Business“ nur Entwürfe, Dienstweg nur sehen, außerhalb nichts', () => {
    expect(prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: false, nurBusiness: false })).toEqual({ sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true });
    expect(prozessRechte({ imHaushalt: true, vollesMitglied: false, inhaber: false, nurBusiness: true })).toEqual({ sehen: true, entwurf: true, veroeffentlichen: false, status: false, webhook: false });
    expect(prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false, dienst: true })).toEqual({ ...KEINE_RECHTE, sehen: true });
    expect(prozessRechte({ imHaushalt: false, vollesMitglied: false, inhaber: false, nurBusiness: false })).toEqual(KEINE_RECHTE);
  });
  it('als wer der Lauf schreibt: „läuft als“ (Konto), sonst der Eigner mit Konto — nie der Inhaber als Rückfall', () => {
    const team = [{ id: 'konto-pia', aktiv: true, speicher: 'pia' }, { id: 'extern-1', aktiv: true }];
    expect(laufPerson({ eigner: 'konto-pia' }, team, ['pia', 'olaf'])).toBe('pia');
    expect(laufPerson({ eigner: 'extern-1' }, team, ['pia', 'olaf'])).toBeNull();
    expect(laufPerson({ eigner: 'extern-1', laeuftAls: 'olaf' }, team, ['pia', 'olaf'])).toBe('olaf');
    expect(laufPerson({}, team, ['pia'])).toBeNull();
  });
});

describe('Werkstatt-Regeln (rein): Stand, Rechte, aktiv schalten', () => {
  const stand = (e: ProzessEintrag) => JSON.stringify(e).length.toString(36) + e.entwurf.knoten.length;
  const kx = (rechte = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false })): WerkstattKontext => ({
    person: 'pia', jetzt: J, rechte, standVon: stand, neueKennung: (() => { let i = 0; return (p: string) => `${p}-00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`; })(),
    pruef: { team: [{ id: 'konto-pia', aktiv: true, speicher: 'pia' }], konten: ['pia'] },
  });
  it('anlegen, Stand veraltet → 409 mit aktuellem Stand', () => {
    const a = werkstattAnwenden(leerProzesse(), { aktion: 'anlegen', titel: 'Nachfassen', bereich: 'sales', fallArt: 'deal' }, kx());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const r = werkstattAnwenden(a.datei, { aktion: 'steckbrief', id: a.eintrag.id, stand: 'alt', felder: { titel: 'Neu' } }, kx());
    expect(r).toMatchObject({ ok: false, status: 409, konflikt: { id: a.eintrag.id, stand: stand(a.eintrag) } });
  });
  it('„nur Business“ baut Entwürfe, veröffentlicht nicht (403); unbekannter Bereich 400; neue Knoten nur mit fk-<uuid>', () => {
    const k = kx(prozessRechte({ imHaushalt: true, vollesMitglied: false, inhaber: false, nurBusiness: true }));
    const a = werkstattAnwenden(leerProzesse(), { aktion: 'anlegen', titel: 'X', bereich: 'sales', fallArt: 'deal' }, k);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(werkstattAnwenden(a.datei, { aktion: 'veroeffentlichen', id: a.eintrag.id, stand: stand(a.eintrag), name: 'v1' }, k)).toMatchObject({ ok: false, status: 403 });
    expect(werkstattAnwenden(a.datei, { aktion: 'status', id: a.eintrag.id, stand: stand(a.eintrag), status: 'aktiv' }, k)).toMatchObject({ ok: false, status: 403 });
    expect(werkstattAnwenden(leerProzesse(), { aktion: 'anlegen', titel: 'X', bereich: 'privat', fallArt: 'deal' }, k)).toMatchObject({ ok: false, status: 400 });
    const knoten = [...a.eintrag.entwurf.knoten, { id: 'frei-erfunden', elternId: a.eintrag.entwurf.knoten[1].id, titel: 'A', rang: 2 }];
    expect(werkstattAnwenden(a.datei, { aktion: 'entwurf', id: a.eintrag.id, stand: stand(a.eintrag), knoten }, k)).toMatchObject({ ok: false, status: 400 });
    expect(werkstattAnwenden(leerProzesse(), { aktion: 'anlegen', titel: 'X', bereich: 'sales', fallArt: 'deal' }, { ...k, rechte: KEINE_RECHTE })).toMatchObject({ ok: false, status: 403 });
  });
  it('aktiv erst mit Version, Eigner, Kriterien und Person mit Konto; Pausieren nur, was läuft', () => {
    const a = werkstattAnwenden(leerProzesse(), { aktion: 'anlegen', titel: 'Nachfassen', bereich: 'sales', fallArt: 'deal' }, kx());
    if (!a.ok) throw new Error(a.fehler);
    let d = a.datei, e = a.eintrag;
    const schritt2 = (r: ReturnType<typeof werkstattAnwenden>) => { if (!r.ok) throw new Error(r.fehler); d = r.datei; e = r.eintrag; return r; };
    expect(werkstattAnwenden(d, { aktion: 'status', id: e.id, stand: stand(e), status: 'aktiv' }, kx())).toMatchObject({ ok: false, status: 409 });
    expect(werkstattAnwenden(d, { aktion: 'status', id: e.id, stand: stand(e), status: 'pausiert' }, kx())).toMatchObject({ ok: false, status: 409 });
    schritt2(werkstattAnwenden(d, { aktion: 'veroeffentlichen', id: e.id, stand: stand(e), name: 'v1' }, kx()));
    const fehlt = aktivBefunde(e, kx().pruef);
    expect(fehlt.map(b => b.feld).sort()).toEqual(['eigner', 'endKriterium', 'laeuftAls', 'startKriterium']);
    schritt2(werkstattAnwenden(d, { aktion: 'steckbrief', id: e.id, stand: stand(e), felder: { eigner: 'konto-pia', startKriterium: 'Deal in Stufe Angebot', endKriterium: 'Antwort da' } }, kx()));
    schritt2(werkstattAnwenden(d, { aktion: 'veroeffentlichen', id: e.id, stand: stand(e), name: 'v2' }, kx()));
    const r = schritt2(werkstattAnwenden(d, { aktion: 'status', id: e.id, stand: stand(e), status: 'aktiv' }, kx()));
    expect(r.eintrag).toMatchObject({ status: 'aktiv', statusVon: 'pia' });
    // Eigner ohne Konto, kein „läuft als“ → nicht aktiv.
    const k2 = { ...kx(), pruef: { team: [{ id: 'konto-pia', aktiv: true }], konten: ['pia'] } };
    expect(aktivBefunde(e, k2.pruef).some(b => b.feld === 'laeuftAls')).toBe(true);
  });
});

// ── Route: Wächter „Sicht X bekommt nichts aus Y“ ───────────────────────────────────────────────────────────────────────────────────────────────
type H = (r: Request) => Promise<Response>;
const kopf = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(methode: 'GET' | 'POST', k: Record<string, string>, body?: unknown, suche = '', pfad = 'prozesse/werkstatt') {
  const m = await import(`@/app/api/${pfad}/route`) as unknown as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: k, ...(methode === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('Werkstatt-Route', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-pz' }),
      konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-pz' }),
      konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-pz', finanzRecht: 'business' }),
      konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
      konto('k5', 'kunde', 'mitglied'),
    ], einladungen: [] });
    await db.saveJson('fulfillment--haus-pz', { version: 1, prozesse: [{ id: 'fp-probe', art: 'paket', titel: 'Lieferung', fassung: 2, geaendert: J, geaendertVon: 'pia', knoten: [{ id: 'fk-w', titel: 'Lieferung', rang: 1 }], uebergaenge: [], freigaben: [], rollen: [] }], bausteine: [], rituale: [], zuordnung: {}, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  });

  it('fremder Haushalt, Testkunde, Dienstweg ohne Person → 403; Sicht Privat → 403', async () => {
    expect((await rufe('GET', kopf('gast'))).status).toBe(403);
    expect((await rufe('GET', kopf('kunde'))).status).toBe(403);
    expect((await rufe('GET', { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! })).status).toBe(403);
    expect((await rufe('GET', kopf('pia'), undefined, '?space=privat')).status).toBe(403);
    expect((await rufe('GET', kopf('gast'), undefined, '', 'prozesse/katalog')).status).toBe(403);
    expect((await rufe('POST', kopf('gast'), { aktion: 'anlegen', titel: 'X', bereich: 'sales', fallArt: 'deal' })).status).toBe(403);
  });

  it('der Dienstweg schreibt nie (auch nicht im Auftrag einer Person im Haushalt)', async () => {
    expect((await rufe('POST', dienst('pia'), { aktion: 'anlegen', titel: 'X', bereich: 'sales', fallArt: 'deal' })).status).toBe(403);
  });

  it('„nur Business“ baut Entwürfe, veröffentlicht nicht; volle Mitglieder veröffentlichen; Liste zeigt Fulfillment nur lesend', async () => {
    const a = await rufe('POST', kopf('partnerin'), { aktion: 'anlegen', titel: 'Event nachfassen', bereich: 'marketing', fallArt: 'event', anfrageId: 'a-0123456789abcdef' });
    expect(a.status).toBe(200);
    const id = a.j.eintrag.id;
    // Idempotent über die anfrageId.
    const a2 = await rufe('POST', kopf('partnerin'), { aktion: 'anlegen', titel: 'Event nachfassen', bereich: 'marketing', fallArt: 'event', anfrageId: 'a-0123456789abcdef' });
    expect(a2.j.eintrag.id).toBe(id);
    expect((await rufe('POST', kopf('partnerin'), { aktion: 'veroeffentlichen', id, stand: a.j.stand, name: 'v1' })).status).toBe(403);
    const v = await rufe('POST', kopf('olaf'), { aktion: 'veroeffentlichen', id, stand: a.j.stand, name: 'v1' });
    expect(v.status).toBe(200);
    expect(v.j.version).toMatchObject({ nr: 1, name: 'v1', von: 'olaf' });
    const alt = await rufe('POST', kopf('olaf'), { aktion: 'steckbrief', id, stand: a.j.stand, felder: { titel: 'Anders' } });
    expect(alt.status).toBe(409);
    expect(alt.j.stand).toBe(v.j.stand);
    const l = await rufe('GET', kopf('partnerin'));
    expect(l.j.rechte).toMatchObject({ entwurf: true, veroeffentlichen: false });
    expect(l.j.prozesse).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, quelle: 'werkstatt', version: 1, bereich: 'marketing' }),
      expect.objectContaining({ id: 'fp-probe', quelle: 'fulfillment', nurLesen: true, bereich: 'fulfillment', fallArt: 'mandat' }),
    ]));
    const g = await rufe('GET', kopf('olaf'), undefined, `?id=${id}`);
    expect(g.j.eintrag.versionen).toEqual([expect.objectContaining({ nr: 1, name: 'v1' })]);
    expect(g.j.eintrag.versionen[0].definition).toBeUndefined();
    expect(Array.isArray(g.j.kanten)).toBe(true);
    expect((await rufe('GET', kopf('olaf'), undefined, `?id=${id}&vergleich=1,entwurf`)).j.vergleich).toBeTruthy();
  });

  it('Konto löschen: Speichername und Team-Kennung werden „[gelöscht]“, die Prozesse bleiben', async () => {
    const { prozesseOhnePerson } = await import('@/lib/prozesse/werkstatt-server');
    const e = { ...neu(), entwurf: { ...neu().entwurf, eigner: 'konto-pia', laeuftAls: 'pia' } };
    const r = prozesseOhnePerson({ v: 1, prozesse: [e] }, 'pia');
    expect(r.n).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(r.wert)).not.toMatch(/"pia"|konto-pia/);
    expect(r.wert.prozesse).toHaveLength(1);
  });
});
