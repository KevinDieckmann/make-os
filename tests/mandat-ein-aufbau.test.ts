// ─── Mandate entstehen über EINEN Aufbau (25.10., Kern-Reste 1) ───────────────────────────────────────────────────────────────────────────────
// Befund nach dem Bau-Test: Fulfillment › Heute („Mandat anlegen & Fall starten“) und die ZOE-Freigabe legten ein Mandat noch mit Start „heute“ an — Heute
// ohne das Fenster zum Prüfen. Regel: jeder Weg, der ein Mandat aus Deal/Angebot/Produkt anlegt, baut es über lib/crm/mandat-aus-deal.ts (dieselben Preis-Teile
// und Zusatzmodule, Vorgabe-Start = erster Tag des Folgemonats); wo ein Mensch klickt, öffnet sich das Fenster `useMandatAnlegen`.
//   · Wächter: nur erlaubte Stellen hängen ein Mandat an (Ausnahmen mit Grund)
//   · Fulfillment › Heute öffnet das Fenster (kein direkter Aufruf mehr)
//   · von Ende zu Ende (eigener Datenordner, erfundene Konten @example.invalid): Vorschau des Fensters = ZOE-Freigabe (dieselben Zusatzmodule), Start aus dem
//     Vorschlag bzw. die Vorgabe; „+ Mandat“ (mandatEntwurf) trägt dieselben Zusatzmodule wie der Deal-Weg und nimmt den gewählten Start
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Chance, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { PreisTeil } from '@/lib/crm/produkt-karte';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mandat-aufbau-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mandat-aufbau';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const WURZEL = path.resolve(__dirname, '..');
const lies = (rel: string) => readFileSync(path.join(WURZEL, rel), 'utf8');

// ══ Wächter ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Stellen, die ein NEUES Mandat in den CRM-Bestand bringen dürfen — je mit Grund. */
const ERLAUBT: Record<string, string> = {
  'app/api/crm/lead/route.ts': 'DER Aufbau: aktion „mandat“ baut über lib/crm/mandat-aus-deal.ts (Vorschau fürs Fenster und Anlegen)',
  'components/os/crm/MandatAnlegenFenster.tsx': 'das EINE Fenster „Mandat anlegen“ (Vorschau, dann Anlegen mit Start)',
  'lib/zoe/crm-vorschlag.ts': 'ZOE-Freigabe ist der Klick — über aktion „mandat“, Start aus dem Vorschlag bzw. die Vorgabe',
  'lib/crm/mandat-anlegen-server.ts': '„+ Mandat“ ohne Deal (Firma + Person): `mandatEntwurf` — Vertrag aus dem Dialog, Produkt-Teil über dieselbe Vorlage `mandatVorlageAusProdukt`',
  'lib/crm/mandate-tabelle-server.ts': 'Tabellen-Import des BESTANDS (`neuesMandat`, Start aus der Tabelle) — Produkt-Teil über dieselbe Vorlage',
  'lib/zoe/werkzeuge.ts': 'ZOE `setze_kunde`: Mandat nur aus einem Namen (ohne Deal, Angebot, Produkt), freigabepflichtig',
  'lib/demo/saat.ts': 'Demo-Saat (erfundene Mandate über die Route)',
  'lib/demo/fulfillment-ablauf.ts': 'Demo-Ablauf (erfundenes Mandat über die Route)',
  'lib/brain/app-spiegel.ts': 'kein CRM-Bestand — der Brain-Spiegel sammelt Mandate zum Schreiben der Markdown-Seiten',
  'lib/crm/verbindungen.ts': 'Reparatur der Verbindungsprüfung — schreibt die vorhandene Liste zurück, legt nichts an',
};
const MUSTER = [
  /mandate:\s*\[\s*\.\.\.\s*\w+\.mandate\s*,/, // anhängen in einer CRM-Sperre
  /liste:\s*'mandate',\s*(op:\s*'upsert'|\.\.\.upsert)/, // Upsert über den Bestand
  /aktion:\s*'mandat'\s*[,}]/, // POST /api/crm/lead aktion „mandat“
  /\.mandate\.push\(/,
  /setze\(\s*'mandate'/,
];
function dateien(dir: string, raus: string[] = []): string[] {
  for (const n of readdirSync(path.join(WURZEL, dir))) {
    const rel = path.join(dir, n);
    if (statSync(path.join(WURZEL, rel)).isDirectory()) dateien(rel, raus);
    else if (/\.(ts|tsx|mjs)$/.test(n)) raus.push(rel.split(path.sep).join('/'));
  }
  return raus;
}

describe('Wächter — ein Mandat entsteht nur über den einen Aufbau (Ausnahmen mit Grund)', () => {
  const treffer = ['app', 'lib', 'components'].flatMap(d => dateien(d)).filter(f => MUSTER.some(m => m.test(lies(f))));
  it('jede Stelle, die ein Mandat anlegt, steht in der Liste — neue Stellen bauen über lib/crm/mandat-aus-deal.ts (bzw. öffnen das Fenster)', () => {
    expect(treffer.filter(f => !ERLAUBT[f])).toEqual([]);
  });
  it('keine verwaiste Ausnahme', () => {
    expect(Object.keys(ERLAUBT).filter(f => !treffer.includes(f))).toEqual([]);
  });
  it('die Route baut über mandatAusDeal; Fulfillment › Heute und der Deal öffnen das Fenster (kein eigener Aufruf)', () => {
    expect(lies('app/api/crm/lead/route.ts')).toMatch(/mandatAusDeal\(c, \{/);
    for (const f of ['components/os/fulfillment/reise/HeuteListe.tsx', 'components/os/fulfillment/prozesse/FallAmDeal.tsx']) {
      const q = lies(f);
      expect(q, f).toMatch(/useMandatAnlegen\(/);
      expect(q, f).toMatch(/mandatFenster\.oeffnen\(/);
      expect(q, f).not.toMatch(/['"`]\/api\/crm\/lead['"`?]/);
    }
  });
});

// ══ Von Ende zu Ende ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const H = 'haus-ma';
const J = '2026-10-24T08:00:00.000Z';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
// Erfundene Kombination: 1.500 € fest (50/50) · 900 €/Monat · optional Tagessatz — wie im Bau-Test der Preis-Kette.
const SPRINT = {
  id: 'l-sprint', name: 'Probesprint', typ: 'sprint', stufe: 'kern', preis: { betrag: 0, einheit: '' }, lieferumfang: ['Aufbau'], gesellschaft: 'ug', status: 'aktiv', geaendert: J,
  angebot: { leistungstext: 'Sechs Monate Probesprint.' }, vertrag: { mindestlaufzeitMonate: 6, zahlungszielTage: 14 },
  preise: [teil({ id: 'pt-1', art: 'fest', betragCent: 150_000, zahlplan: { anzahlungProzent: 50 } }), teil({ id: 'pt-2', art: 'monatlich', betragCent: 90_000 }), teil({ id: 'pt-3', art: 'tagessatz', betragCent: 120_000, rolle: 'option', mengeJeMonat: 2 })],
} as unknown as Leistung;
const deal = (id: string): Chance => ({
  id, titel: `Probesprint ${id}`, kontaktIds: ['c-erika'], firmaId: 'f-probe', firma: 'Probe GmbH', art: 'retainer', leistungId: 'l-sprint',
  wert: { betrag: 900, basis: 'monat', laufzeitMonate: 6, einmalBetrag: 1500 }, stufe: 'gewonnen', historie: [], gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J,
} as unknown as Chance);

type Json = Record<string, unknown>;
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
async function lead(body: Json): Promise<{ status: number; j: Json }> {
  const { POST } = await import('@/app/api/crm/lead/route');
  const r = await POST(new Request('http://test/api/crm/lead', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Json };
}
async function stapelPost(body: Json): Promise<{ status: number; j: Json }> {
  const { POST } = await import('@/app/api/zoe/stapel/route');
  const r = await POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Json };
}
const mandatZu = async (dealId: string): Promise<Mandat | undefined> => (await (await import('@/lib/crm/speicher')).ladeCrm()).mandate.find(m => m.chanceId === dealId);
async function zoeVorschlag(eingabe: Json): Promise<{ id: string; nachher: string } | string> {
  const { crmVorschlag } = await import('@/lib/zoe/crm-vorschlag');
  const r = await crmVorschlag(eingabe, 'http://test', 'pia');
  const text = typeof r === 'string' ? r : JSON.stringify(r);
  const id = /(v-[a-z0-9-]+)/.exec(text)?.[1];
  if (!id) return text;
  const db = await import('@/lib/store/local-db');
  const v = ((await db.loadJson<{ vorschlaege: { id: string; nachher: string }[] }>('zoe-stapel'))?.vorschlaege ?? []).find(x => x.id === id);
  return v ?? text;
}

let heute = '';
let vorgabe = '';
beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const { localDay } = await import('@/lib/zeit');
  const { startVorschlag } = await import('@/lib/crm/mandat-aus-deal');
  heute = localDay();
  vorgabe = startVorschlag(heute);
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', firmaId: 'f-probe', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'lead', geaendert: J }], leistungen: [SPRINT],
    chancen: [deal('ch-fenster'), deal('ch-zoe'), deal('ch-zoe-start')], mandate: [],
  } as unknown as CrmBestand);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Fenster und ZOE bauen dasselbe Mandat', () => {
  let zusatzFenster: Mandat['zusatz'];
  it('Vorschau des Fensters: Start = erster Tag des Folgemonats, Zusatzmodule aus den eigenen Preis-Teilen — mit Namen vom Server (für Fulfillment › Heute)', async () => {
    const r = await lead({ aktion: 'mandat', chanceId: 'ch-fenster', vorschau: true });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const m = r.j.mandat as Mandat;
    expect(m.start).toBe(vorgabe);
    expect(m.honorar).toEqual({ betrag: 900, basis: 'monat', netto: true });
    expect(m.zusatz?.map(z => z.preisTeilId)).toEqual(['pt-1']);
    zusatzFenster = m.zusatz;
    expect(r.j.namen).toEqual({ produkt: 'Probesprint', zusatz: [{ id: 'mz-e-1', name: 'Probesprint · Festpreis', beschreibung: expect.any(String) }] });
    expect(await mandatZu('ch-fenster')).toBeUndefined();
  });
  it('ZOE-Freigabe ohne Start: dieselben Zusatzmodule, Start = Vorgabe (nie mehr still heute)', async () => {
    const v = await zoeVorschlag({ art: 'mandat_anlegen', deal: 'ch-zoe' });
    expect(typeof v, String(v)).toBe('object');
    const vv = v as { id: string; nachher: string };
    expect(vv.nachher).toContain(`Start ${vorgabe}`);
    expect(await mandatZu('ch-zoe')).toBeUndefined();
    const r = await stapelPost({ id: vv.id, entscheidung: 'freigeben' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const m = await mandatZu('ch-zoe');
    expect(m).toMatchObject({ start: vorgabe, honorar: { betrag: 900, basis: 'monat' } });
    expect(m!.zusatz).toEqual(zusatzFenster);
  });
  it('ZOE-Freigabe mit Start aus dem Vorschlag; ein unsinniger Start wird gar nicht erst vorgeschlagen', async () => {
    const spaeter = new Date(Date.parse(`${heute}T12:00:00Z`) + 40 * 864e5).toISOString().slice(0, 10);
    expect(typeof await zoeVorschlag({ art: 'mandat_anlegen', deal: 'ch-zoe-start', start: '2026-02-30' })).toBe('string');
    const v = await zoeVorschlag({ art: 'mandat_anlegen', deal: 'ch-zoe-start', start: spaeter });
    expect(typeof v, String(v)).toBe('object');
    const r = await stapelPost({ id: (v as { id: string }).id, entscheidung: 'freigeben' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const m = await mandatZu('ch-zoe-start');
    expect(m?.start).toBe(spaeter);
    expect(m!.zusatz).toEqual(zusatzFenster);
  });
});

describe('„+ Mandat“ (ohne Deal): dieselbe Produkt-Vorlage, Start wählbar', () => {
  it('mandatEntwurf trägt dieselben Zusatzmodule wie der Deal-Weg; `start` gilt, ohne bleibt es heute (ältere Aufrufer)', async () => {
    const { mandatEntwurf, mandatEingabeAus } = await import('@/lib/crm/mandat-anlegen');
    const { mandatAusDeal } = await import('@/lib/crm/mandat-aus-deal');
    const ausDeal = mandatAusDeal(deal('ch-x'), { leistungen: [SPRINT], angebote: [], firmen: [], id: 'm-a', jetzt: J, heute: '2026-10-24', person: 'pia' }).mandat;
    const neu = mandatEntwurf({ id: 'm-b', firma: { id: 'f-probe', name: 'Probe GmbH' }, kontaktIds: [], gesellschaft: 'ug', leistung: SPRINT, start: '2026-11-01', jetzt: J, person: 'pia' });
    expect(neu.zusatz).toEqual(ausDeal.zusatz);
    expect(neu.start).toBe('2026-11-01');
    expect(mandatEntwurf({ id: 'm-c', firma: { id: 'f-probe', name: 'Probe GmbH' }, kontaktIds: [], gesellschaft: 'ug', leistung: SPRINT, jetzt: J, person: 'pia' }).start).toBe('2026-10-24');
    const basis = { firma: { id: 'f-probe' }, person: { id: 'c-erika' }, gesellschaft: 'ug' };
    expect(mandatEingabeAus({ ...basis, start: '2026-11-01' }, '2026-10-24')).toMatchObject({ ok: true, e: { start: '2026-11-01' } });
    expect(mandatEingabeAus({ ...basis, start: '2026-02-30' }, '2026-10-24')).toMatchObject({ ok: false, status: 400 });
    expect((mandatEingabeAus(basis, '2026-10-24') as { e: { start?: string } }).e.start).toBeUndefined();
  });
  it('der Dialog belegt den Start mit der Vorgabe des Fensters vor', () => {
    expect(lies('components/os/crm/MandatAnlegen.tsx')).toMatch(/useState\(\(\) => startVorschlag\(localDay\(\)\)\)/);
  });
});
