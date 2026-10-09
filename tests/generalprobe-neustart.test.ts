// ─── Generalprobe Neustart (09.10.2026 abends): was beim Durchklicken als „neuer Kunde“ brach — Wächter ─────────────────────────────────
// Ablauf am Mac mit erfundenen Daten: Demo-Ordner → Neustart-Umzug → neue Instanz → erstes Konto → Einrichtung. Funde:
//   (1) Haushalt: das erste Konto konnte keinen Namen eintragen — „Freischalten“ setzte fest „haushalt“, die übernommenen Bestände je Haushalt
//       (CRM-/Aufgaben-Dateien, Sperrliste …) lagen unter dem alten Namen und waren weg. Jetzt: Vorschlag aus den Dateinamen + Feld.
//   (2) „Als Nächstes“ stand im Neustart dauerhaft auf „0.1 · Update einspielen“ — jetzt zuerst der Kern.
//   (3) Ein persönlicher Auftrag an den Gesundheits-Head machte „Autonomie der Agenten“ grün.
//   (4) Kontoauszug als CSV einer Bank mit „Buchungstag;…“ im Kopf → „Keine Buchung erkannt“ im Haushalt.
// Eigener Datenordner, erfundene Konten und Werte — nie .data/, kein Modell, kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-generalprobe-'));
const DATEN = path.join(wurzel, 'daten');
process.env.MAKE_OS_DATEN_DIR = DATEN;
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DEMO', 'MAKE_OS_EINRICHTUNG', 'ANTHROPIC_API_KEY']) delete process.env[k];
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const { haushaltVorschlaege, haushaltVorschlaegeLesen } = await import('@/lib/zugang/haushalt-vorschlag');
const D = await import('@/lib/make-one/onboarding-data');
const { pruefeAlles } = await import('@/lib/onboarding-status');
const { ausCsv } = await import('@/lib/finanzen/haushalt/import');

const HAUS = 'familie-probe';
const INHABER_N = { inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, altbestand: false, neustart: true };
let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  await fs.mkdir(DATEN, { recursive: true });
  db = await import('@/lib/store/local-db');
});

describe('(1) Name des Haushalts nach dem Neustart', () => {
  it('Vorschlag aus den Dateinamen der Bestände je Haushalt — Ersatznamen, Protokolle und Bestände je Person zählen nicht', () => {
    const dateien = [
      `crm-dateien--${HAUS}.json`, `aufgaben-dateien--${HAUS}.json`, `crm-sperrliste--${HAUS}.json`, 'crm.json', 'kontakte.json',
      'aenderungsprotokoll--haushalt--2026-10.json', 'aenderungsprotokoll--anders--2026-10.json', 'leseprotokoll--ohne-haushalt--2026-10.json',
      'visitenkarten--erste.json', 'onboarding--erste.json', 'crm-dateien--haushalt.json', 'aufgaben-dateien--haupt.json', 'kennung-alias--zweiter.json',
    ];
    expect(haushaltVorschlaege(dateien, [HAUS])).toEqual([HAUS, 'zweiter']);
    expect(haushaltVorschlaege(['crm.json', 'kontakte.json'])).toEqual([]);
    expect(haushaltVorschlaege(['crm-dateien--Gross-Schreibung.json', 'crm-dateien--a..b.json'])).toEqual([]);
  });

  it('liest nur Namen aus dem Datenordner (nie Inhalte) — und die Route bietet sie nur an, solange die Inhaber keinen Haushalt haben', async () => {
    await db.saveJson(`crm-dateien--${HAUS}`, { eintraege: [] });
    await fs.mkdir(path.join(DATEN, 'dateien', HAUS), { recursive: true });
    expect(await haushaltVorschlaegeLesen()).toEqual([HAUS]);
    const route = await import('@/app/api/konto/haushalt/route');
    const anfrage = () => new Request('http://x/api/konto/haushalt', { headers: { 'x-make-user': 'erste' } });
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'erste', email: 'erste@example.invalid', name: 'Erste', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-10-09', teilt: { gesundheit: [] } }], einladungen: [] });
    const ohne = await (await route.GET(anfrage())).json();
    expect(ohne.ok).toBe(true);
    expect(ohne.haushalt).toBeNull();
    expect(ohne.vorschlaege).toEqual([HAUS]);
    await db.updateJson<{ konten: { haushalt?: string }[] }>('konten', s => ({ ...s!, konten: s!.konten.map(k => ({ ...k, haushalt: HAUS })) }));
    const mit = await (await route.GET(anfrage())).json();
    expect(mit.haushalt).toBe(HAUS);
    expect(mit.vorschlaege).toEqual([]);
  });

  it('Oberfläche: Feld „Name des Haushalts“ statt eines festen Namens; die Einrichtung und der Umzugs-Bericht nennen es', async () => {
    const ui = await fs.readFile(path.join(process.cwd(), 'components/os/HaushaltZuordnung.tsx'), 'utf8');
    expect(ui).toContain('Name des Haushalts');
    expect(ui).toContain('vorschlaege');
    const schritt = D.schrittMitId('haushalt')!;
    expect(schritt.wie.join(' ')).toContain('Namen des Haushalts');
    const lauf = await fs.readFile(path.join(process.cwd(), 'lib/neustart/umzug-lauf.mjs'), 'utf8');
    expect(lauf).toContain('„Name des Haushalts“');
  });
});

describe('(2) „Als Nächstes“ im Neustart zuerst aus dem Kern', () => {
  it('ohne Häkchen: der erste offene Kern-Schritt, nicht „0.1 · Update einspielen“', () => {
    const meine = D.schritteFuer(INHABER_N);
    const z = { erledigt: {}, befunde: {} };
    const alt = D.fortschrittVon(meine, z, { alle: true });
    expect(alt.naechster?.etappe).toBe(0);
    const neu = D.fortschrittVon(meine, z, { alle: true, kernZuerst: true });
    expect(neu.naechster?.samstag).toBe(true);
    expect(neu.naechster?.etappe).toBeGreaterThanOrEqual(1);
    // Zählung unverändert — nur die Reihenfolge.
    expect([neu.fertig, neu.gesamt]).toEqual([alt.fertig, alt.gesamt]);
  });

  it('Heute-Karte und Einrichtung geben `kernZuerst` im Neustart mit', async () => {
    const w = await fs.readFile(path.join(process.cwd(), 'components/os/flaeche/widgets.tsx'), 'utf8');
    const o = await fs.readFile(path.join(process.cwd(), 'components/os/OnboardingView.tsx'), 'utf8');
    expect(w).toMatch(/fortschrittVon\(meine, d\.z, \{ alle: true, kernZuerst: !!d\.ich\.neustart \}\)/);
    expect(o).toMatch(/kernZuerst: neustart/);
  });
});

describe('(3) „Autonomie der Agenten“ wird nicht vom persönlichen Auftrag grün', () => {
  it('nur Auftrag (Stempel) → offen; eine echte Einstellung → erfüllt', async () => {
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'erste', email: 'erste@example.invalid', name: 'Erste', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-10-09', teilt: { gesundheit: [] }, haushalt: HAUS }], einladungen: [] });
    const stempel = { geaendertAm: '2026-10-09T15:00:00.000Z', geaendertVon: 'erste' };
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {}, personen: { erste: { heads: { gesundheit: { auftrag: 'Ziel: zweimal die Woche laufen (erfunden).', auftragAm: stempel.geaendertAm, auftragVon: 'erste', ...stempel } } } } });
    const vorher = await pruefeAlles('erste');
    expect(vorher.agenten?.erfuellt).toBe(false);
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { sales: { autonomie: 'vorschlag', ...stempel } }, personen: {} });
    // pruefeAlles merkt 60 s je Person — eine andere Person hat keinen Zwischenspeicher; Inhaber im selben Haushalt.
    await db.updateJson<{ konten: unknown[] }>('konten', s => ({ ...s!, konten: [...s!.konten, { id: 'k2', speicher: 'zweite', email: 'zweite@example.invalid', name: 'Zweite', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-10-09', teilt: { gesundheit: [] }, haushalt: HAUS }] }));
    const nachher = await pruefeAlles('zweite');
    expect(nachher.agenten?.erfuellt).toBe(true);
  });
});

describe('(4) Kontoauszug-CSV deutscher Banken im Haushalt', () => {
  it('„Buchungstag;Valuta;…;Betrag“ wird gelesen', () => {
    const csv = 'Buchungstag;Valuta;Auftraggeber/Empfänger;Verwendungszweck;Betrag;Währung\n01.09.2026;01.09.2026;Beispiel Wohnbau GmbH;Miete;-1200,00;EUR\n28.09.2026;28.09.2026;Arbeitgeber Beispiel AG;Gehalt;3200,00;EUR\n';
    const r = ausCsv(csv);
    expect(r.buchungen.map(b => [b.datum, b.betrag])).toEqual([['2026-09-01', -120000], ['2026-09-28', 320000]]); // Cent
  });
  it('„Buchungstag;Wertstellung;…;Betrag“ : Wertstellung ist nicht der Betrag', () => {
    const csv = 'Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung\n02.09.2026;02.09.2026;Lastschrift;Strom Beispiel;-85,50;EUR\n';
    expect(ausCsv(csv).buchungen.map(b => [b.datum, b.betrag])).toEqual([['2026-09-02', -8550]]);
  });
  it('N26-CSV wie bisher', () => {
    const csv = '"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)"\n"2026-09-03","Supermarkt Beispiel","","Presentment","","-64.20"\n';
    expect(ausCsv(csv).buchungen.map(b => [b.datum, b.betrag])).toEqual([['2026-09-03', -6420]]);
  });
});
