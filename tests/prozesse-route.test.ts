// ─── Prozesse · Route der Landkarte (Etappe A, 21.10.) — „Sicht X bekommt nichts aus Y“ ────────────────────────────────────────────────────
// GET /api/prozesse/landkarte: fremder Haushalt, Testkunde ohne Haushalt und Dienstweg ohne Person → 403; Sicht Privat → 403 (Route UND Middleware);
// Inhaberin, Mitglied und „nur Business“ lesen. Die Antwort trägt die System-Prozesse, die Vorlagen aus dem Fulfillment und Zahlen nur aus Business-Daten
// — nichts Privates (Marken aus Familie, Gesundheit, privaten Aufgaben bleiben draußen), keine Kontaktdaten. Event-Nachfassen (Punkt 74) zählt
// offen · rechtzeitig aus den besuchten Events. ETag → 304. Schreibt nie. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-route-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const sitzung = (person: string) => ({ 'x-make-user': person });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
async function hole(kopf: Record<string, string>, suche = '?space=business'): Promise<{ status: number; text: string; etag: string | null }> {
  const { GET } = await import('@/app/api/prozesse/landkarte/route');
  const r = await GET(new Request(`http://test/api/prozesse/landkarte${suche}`, { headers: kopf }));
  return { status: r.status, text: r.status === 304 ? '' : await r.text(), etag: r.headers.get('etag') };
}

const J = '2026-10-01T08:00:00.000Z';
const PRIVAT = ['MARKE-PRIVAT-FAMILIE', 'MARKE-PRIVAT-AUFGABE', 'MARKE-PRIVAT-GESUNDHEIT'];
let vorher = '';

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-pz' }),
    konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-pz' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-pz', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const heute = (await import('@/lib/zeit')).localDay();
  const vor = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  await db.saveJson('crm', {
    ...leererBestand(),
    events: [{ id: 'ev-besucht', titel: 'Probe-Abend', format: 'stammtisch', ziel: 'Drei Gespräche', datum: vor(10), status: 'durchgefuehrt', marke: 'Netzwerken', geaendert: J }],
    teilnahmen: [
      { id: 't-1', eventId: 'ev-besucht', kontaktId: 'c-eins', status: 'da', followUpAm: vor(9) },
      { id: 't-2', eventId: 'ev-besucht', kontaktId: 'c-zwei', status: 'da' },
    ],
  });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-eins', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' },
    { id: 'c-zwei', vorname: 'Max', nachname: 'Muster', email: 'max@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' },
  ] });
  // Eine Paket-Vorlage im Fulfillment (Business) — sie steht auf der Landkarte.
  await db.saveJson('fulfillment--haus-pz', { version: 1, prozesse: [{
    id: 'fp-probe', art: 'paket', titel: 'MARKE-BUSINESS-PAKET', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'MARKE-BUSINESS-PAKET', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 0, form: 'termin' }],
  }], bausteine: [], rituale: [], zuordnung: {}, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  // Privates im selben Datenordner — darf nie in der Antwort stehen.
  await db.saveJson('familie--haus-pz', { eintraege: [{ id: 'f-1', titel: PRIVAT[0] }] });
  await db.saveJson('tasks', { tasks: [{ id: 'a-privat', title: PRIVAT[1], status: 'todo', space: 'privat', createdAt: J }], projects: [] });
  await db.saveJson('gesundheit-koerper--pia', { leitsatz: PRIVAT[2] });
  vorher = JSON.stringify({ crm: await db.loadJson('crm'), kontakte: await db.loadJson('kontakte'), ff: await db.loadJson('fulfillment--haus-pz') });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Tor: nur der Haushalt des Inhabers, nur Business', () => {
  it('fremder Haushalt, Testkunde ohne Haushalt, Dienstweg ohne Person bzw. mit fremder Person → 403 ohne Inhalt', async () => {
    for (const k of [sitzung('gast'), sitzung('kunde'), dienst(), dienst('gast')]) {
      const r = await hole(k);
      expect(r.status).toBe(403);
      expect(r.text).not.toContain('sp-deal');
    }
  });
  it('Sicht Privat → 403 — in der Route UND in der Middleware (ROUTEN_BEREICH)', async () => {
    const r = await hole(sitzung('pia'), '?space=privat');
    expect(r.status).toBe(403);
    expect(r.text).toContain('Business');
    const { routenBereich, sichtFremd } = await import('@/lib/zugang/sicht-bereich');
    expect(routenBereich('/api/prozesse/landkarte')).toBe('business');
    expect(sichtFremd('/api/prozesse/landkarte', 'privat')).toBe(true);
  });
  it('Inhaberin, Mitglied, „nur Business“ und Dienstweg mit Person aus dem Haushalt lesen', async () => {
    for (const k of [sitzung('pia'), sitzung('olaf'), sitzung('partnerin'), dienst('olaf')]) expect((await hole(k)).status).toBe(200);
    expect((await hole(sitzung('pia'), '')).status).toBe(200);
  });
});

describe('Inhalt: System-Prozesse, Vorlagen, Zahlen — nichts Privates', () => {
  it('alle System-Prozesse und die Vorlage aus dem Fulfillment; keine Privat-Marke, keine Kontaktdaten', async () => {
    const r = await hole(sitzung('partnerin'));
    const j = JSON.parse(r.text) as { ok: boolean; prozesse: { id: string; quelle: string }[]; zahlen: Record<string, { wert: number }> };
    expect(j.ok).toBe(true);
    const { SYSTEM_PROZESSE } = await import('@/lib/prozesse/register');
    for (const p of SYSTEM_PROZESSE) expect(j.prozesse.some(x => x.id === p.id), p.id).toBe(true);
    expect(j.prozesse.find(x => x.id === 'fp-probe')?.quelle).toBe('vorlage');
    expect(r.text).toContain('MARKE-BUSINESS-PAKET');
    for (const m of PRIVAT) expect(r.text, m).not.toContain(m);
    for (const x of ['Erika', 'Muster', 'example.invalid', 'c-eins']) expect(r.text, x).not.toContain(x);
  });
  it('Punkt 74: Event-Nachfassen zählt offen · rechtzeitig nachgefasst aus den besuchten Events; ohne Daten keine Zahl (nie eine erfundene Null)', async () => {
    const j = JSON.parse((await hole(sitzung('pia'))).text) as { zahlen: Record<string, { wert: number; wort: string; zweite?: { wert: number; wort: string } }> };
    expect(j.zahlen['sp-event-nachfassen']).toMatchObject({ wert: 1, wort: 'offen', zweite: { wert: 1, wort: 'rechtzeitig nachgefasst' } });
    // Ohne laufende Fälle: keine Zahl an Lieferung und Onboarding.
    expect(j.zahlen['sp-lieferung']).toBeUndefined();
    expect(j.zahlen['sp-uebergabe']).toBeUndefined();
    for (const z of Object.values(j.zahlen)) expect(z.wert > 0 || (z.zweite?.wert ?? 0) > 0).toBe(true);
  });
  it('ETag: derselbe Stand → 304; Lesen schreibt nichts', async () => {
    const a = await hole(sitzung('pia'));
    expect(a.etag).toBeTruthy();
    const b = await hole({ ...sitzung('pia'), 'if-none-match': a.etag! });
    expect(b.status).toBe(304);
    const db = await import('@/lib/store/local-db');
    expect(JSON.stringify({ crm: await db.loadJson('crm'), kontakte: await db.loadJson('kontakte'), ff: await db.loadJson('fulfillment--haus-pz') })).toBe(vorher);
  });
});

describe('Register und Leiste', () => {
  it('die Route steht im Routen-Register mit eigenem Tor; die Seite ist Business, in Leiste, Schnellsuche und Chat-Zuordnung', async () => {
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    expect(ROUTEN_REGISTER['prozesse/landkarte']).toMatchObject({ methoden: { GET: 'modul:prozesse' }, tor: 'prozesseZugang' });
    const { leisteFuer, aktiverSpaceEintrag, spaceVonAdresse } = await import('@/lib/make-one/spaces');
    expect(leisteFuer('business').map(e => e.label)).toContain('Prozesse');
    expect(leisteFuer('business', true).map(e => e.label)).toContain('Prozesse');
    expect(leisteFuer('privat').map(e => e.label)).not.toContain('Prozesse');
    expect(aktiverSpaceEintrag('/os/prozesse', '?p=sp-deal')).toMatchObject({ space: 'business', eintrag: { label: 'Prozesse' } });
    expect(spaceVonAdresse('/os/prozesse', '')).toBe('business');
    const { SEITEN_SUCHE } = await import('@/lib/make-one/seiten');
    expect(SEITEN_SUCHE.find(s => s.id === 'prozesse')).toMatchObject({ href: '/os/prozesse', space: 'business' });
    const { kontextHeadFuer } = await import('@/lib/agenten/kontext-head');
    expect(kontextHeadFuer('/os/prozesse', '', 'business')).toBe('operations');
  });
});
