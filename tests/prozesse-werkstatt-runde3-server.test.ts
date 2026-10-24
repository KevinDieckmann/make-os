// ─── Prozesse · Werkstatt — Feinschliff Runde 3, Server (24.10., zweiter Bau-Test im Demo) ──────────────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten, kein Netz, kein Modell. Geprüft:
//   (4) „Schritt testen“ an einer CRM-Abfrage: Trefferzahl und die ersten (≤ 5) Treffer mit Namen und Link — nur aus der eigenen Sicht: eingeschränkte Personen
//       (Art. 18) fehlen, ein fremder Haushalt, ein Testkunde ohne Haushalt und der Dienstweg bekommen nichts (403, keine Namen); nichts wird geschrieben;
//   (8) die Auswahl der Prozesse trägt den Fall (die Schleife bietet nur passende an), der Probelauf der Schleife nennt Zahl, Einträge und Teilprozess.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-runde3-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-runde3';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-runde3';
const pz = (n: number) => `pz-00000000-0000-4000-8300-${String(n).padStart(12, '0')}`;
const DEALS = pz(1), LEADS = pz(2), TEIL_DEAL = pz(3), TEIL_LEAD = pz(4), SCHLEIFE = pz(5);
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), 'content-type': 'application/json' });
let S: typeof import('@/lib/prozesse/lauf-server');

const eintrag = (id: string, def: ProzessDefinition): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status: 'probelauf', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
function alleDateien(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) geh(p); else raus[path.relative(ordner, p)] = readFileSync(p, 'utf8'); } };
  geh(ordner);
  return raus;
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: H }),
    konto('k2', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    // Ein Testkunde ohne Haushalt.
    konto('k3', 'kunde', 'mitglied'),
  ], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id.slice(2), email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna'), k('c-bert'), k('c-carl'), k('c-dora'), k('c-emil'), k('c-fritz'),
    k('c-gesperrt', { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const deal = (id: string, kontakt: string, extra: Record<string, unknown> = {}) => ({ id, titel: `Deal ${id.slice(3)}`, kontaktIds: [kontakt], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01', ...extra });
  await db.saveJson('crm', {
    ...leererBestand(),
    chancen: [
      ...['anna', 'bert', 'carl', 'dora', 'emil', 'fritz'].map(n => deal(`ch-${n}`, `c-${n}`)),
      deal('ch-mitschritt', 'c-anna', { naechsterSchritt: { text: 'Anrufen', datum: '2026-11-02' } }),
      deal('ch-gesperrt', 'c-gesperrt'),
    ],
  });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const ende = (n: number, rang: number) => schritt(n, 'Ende', rang, { form: 'ende', ende: { ergebnis: 'erfolg' } });
  const deals = definition([schritt(10, 'Deals ohne Schritt finden', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 50 } }), ende(11, 2)], { laeuftAls: 'pia', fallArt: 'keiner' });
  const leads = definition([schritt(20, 'Leads finden', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'leads', hoechstens: 50 } }), ende(21, 2)], { laeuftAls: 'pia', fallArt: 'keiner' });
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  const teilDeal = definition([schritt(30, 'Deal klären', 1), ende(31, 2)], { laeuftAls: 'pia', fallArt: 'deal', titel: 'Deal klären' });
  const teilLead = definition([schritt(40, 'Lead pflegen', 1), ende(41, 2)], { laeuftAls: 'pia', fallArt: 'lead', titel: 'Lead pflegen' });
  const schleife = definition([
    schritt(50, 'Deals ohne Schritt finden', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 50 } }),
    schritt(51, 'Je Deal klären', 2, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(50)}`, prozessId: TEIL_DEAL, hoechstens: 50 } }),
    ende(52, 3),
  ], { laeuftAls: 'pia', fallArt: 'keiner' });
  const mitTitel = (e: ProzessEintrag, titel: string): ProzessEintrag => ({ ...e, entwurf: { ...e.entwurf, titel } });
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(DEALS, deals), eintrag(LEADS, leads), mitTitel(eintrag(TEIL_DEAL, teilDeal), 'Deal klären'), mitTitel(eintrag(TEIL_LEAD, teilLead), 'Lead pflegen'), eintrag(SCHLEIFE, schleife)] });
  S = await import('@/lib/prozesse/lauf-server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('(4) „Schritt testen“ an „CRM abfragen“: Zahl und die ersten Treffer mit Namen — nur aus der eigenen Sicht', () => {
  it('Deals ohne nächsten Schritt: 6 Treffer, die ersten 5 mit Titel und Link; der Deal einer eingeschränkten Person und der mit Schritt fehlen', async () => {
    const vorher = alleDateien();
    const r = await S.probelauf({ prozessId: DEALS, quelle: 'entwurf', fall: 'beispiel', person: 'pia', nur: fk(10), ausgabe: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.schritte[0].ausgabe!;
    expect(a.zeilen.find(z => z.feld === 'Was')?.wert).toMatch(/Deals ohne nächsten Schritt|ohne/i);
    expect(a.zeilen.find(z => z.feld === 'Treffer jetzt (nur gelesen)')?.wert).toBe('6 Deals — die ersten 5:');
    expect(a.treffer).toHaveLength(5);
    for (const t of a.treffer!) {
      expect(Object.keys(t).sort()).toEqual(['art', 'href', 'id', 'name']);
      expect(t.href).toMatch(/^\/os\//);
    }
    const ids = a.treffer!.map(t => t.id);
    expect(ids).not.toContain('ch-gesperrt');
    expect(ids).not.toContain('ch-mitschritt');
    expect(a.treffer!.map(t => t.name)).toEqual(ids.map(id => `Deal ${id.slice(3)}`));
    // JSON nur Kennungen und die Zahl — nie Namen.
    expect(a.json.treffer).toBe(6);
    expect(JSON.stringify(a.json)).not.toMatch(/Deal [a-z]/);
    expect(alleDateien()).toEqual(vorher);
  });
  it('Leads: Namen der Personen nur aus der verarbeitbaren Kartei — die eingeschränkte Person erscheint nie', async () => {
    const r = await S.probelauf({ prozessId: LEADS, quelle: 'entwurf', fall: 'beispiel', person: 'pia', nur: fk(20), ausgabe: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.schritte[0].ausgabe!;
    expect(a.treffer?.length).toBeGreaterThan(0);
    expect(a.treffer!.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(a)).not.toMatch(/gesperrt/);
    for (const t of a.treffer!) expect(t.href).toMatch(/^\/os\/markttraktion/);
  });
  it('Route: eigener Haushalt bekommt die Namen; fremder Haushalt, Testkunde ohne Haushalt und Dienstweg bekommen nichts', async () => {
    const { POST } = await import('@/app/api/prozesse/probelauf/route');
    const probe = async (kopf: Record<string, string>) => {
      const r = await POST(new Request('http://test/api/prozesse/probelauf?space=business', { method: 'POST', headers: kopf, body: JSON.stringify({ prozessId: DEALS, quelle: 'entwurf', fall: 'beispiel', nur: fk(10), ausgabe: true }) }));
      return { status: r.status, text: await r.text() };
    };
    const eigen = await probe(sitzung('pia'));
    expect(eigen.status).toBe(200);
    expect(eigen.text).toContain('Deal anna');
    for (const kopf of [sitzung('gast'), sitzung('kunde'), dienst('pia'), dienst()]) {
      const x = await probe(kopf);
      expect([401, 403]).toContain(x.status);
      expect(x.text).not.toMatch(/Deal [a-z]|ch-/);
    }
  });
});

describe('(8) Teilprozess der Schleife nach Fall (Server)', () => {
  it('die Auswahl der Prozesse trägt den Fall — nur Kennung, Name, Fall (und der Entwurfs-Hinweis)', async () => {
    const { auswahlListen } = await import('@/lib/prozesse/werkstatt-server');
    const a = await auswahlListen(H, 'pia');
    const p = new Map((a.prozess ?? []).map(x => [x.id, x]));
    expect(p.get(TEIL_DEAL)).toMatchObject({ id: TEIL_DEAL, label: 'Deal klären', fall: 'deal' });
    expect(p.get(TEIL_LEAD)?.fall).toBe('lead');
    expect(p.get(SCHLEIFE)?.fall).toBe('keiner');
    for (const x of a.prozess ?? []) expect(Object.keys(x).every(k => ['id', 'label', 'fall', 'hinweis'].includes(k))).toBe(true);
  });
  it('Probelauf der Schleife: „würde für 6 Deals je einen Teil-Lauf von „Deal klären“ starten (höchstens 50 je Lauf)“ — nichts geschrieben', async () => {
    const vorher = alleDateien();
    const r = await S.probelauf({ prozessId: SCHLEIFE, quelle: 'entwurf', fall: 'beispiel', person: 'pia' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.schritte.find(x => x.knotenId === fk(51))?.text).toBe('würde für 6 Deals je einen Teil-Lauf von „Deal klären“ starten (höchstens 50 je Lauf)');
    expect(alleDateien()).toEqual(vorher);
  });
});
