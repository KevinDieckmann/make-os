/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen beliebige Bestände als JSON */
// ─── Neustart-Umzug mit der Demo-Saat (09.10.2026): echte Form der Bestände, drei Konten (eins „nur Business“) ─────────────
// Die Demo (lib/demo/saat.ts) schreibt über die echten Routen — damit trägt der alte Ordner genau die Form, die die App erzeugt:
// Kartei, CRM, Gesellschafts-Register (mit `g-…`), Gründungsfahrplan als Meilensteine mit Aufgaben-Listen, Team, Kapazität,
// Finanzplanung, Gesundheit. Geprüft: Kartei und CRM kommen Kennung für Kennung mit, die Aufgaben des Fahrplans ziehen nach
// „Übernommen“, die Personen-Abbildung (lena → lea) trifft Bestände, Werte und Schlüssel, und der Bericht nennt die drei Konten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';

const { wurzel, alt } = await vi.hoisted(async () => {
  const fsm = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fsm.mkdtempSync(p.join(os.tmpdir(), 'make-os-neustart-demo-'));
  const alt = p.join(wurzel, 'demo-alt');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: alt, MAKE_VAULT_DIR: p.join(alt, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo-umzug', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
    MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-demo-umzug-nicht-echt', MAKE_OS_PEPPER: 'pruef-pepper-demo-umzug-nicht-echt-0123456789',
    MAKE_OS_GRABSTEINE_DIR: p.join(wurzel, 'grabsteine'),
    NEXT_PUBLIC_MAKE_OS_CRM_TEAM: JSON.stringify([{ id: 'lena', name: 'Lena', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'jonas', name: 'Jonas', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]),
    NEXT_PUBLIC_MAKE_OS_EINHEITEN: JSON.stringify({ kdc: { label: 'Beispiel Beratung', kurz: 'Beratung' }, kdv: { label: 'Beispiel Holding', kurz: 'Holding' }, ug: { label: 'Beispiel Labs GmbH', kurz: 'Labs' } }),
  });
  delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID', 'MAKE_OS_ALTBESTAND_PERSON']) delete process.env[k];
  return { wurzel, alt };
});

import { schluesselRing, huelleOeffnen, huellenVersion } from '@/lib/store/huelle.mjs';
import { umzugLaufen } from '@/lib/neustart/umzug-lauf.mjs';
import { localDay } from '@/lib/zeit';

async function lies<T = any>(ordner: string, name: string): Promise<T> {
  const roh = await fs.readFile(path.join(ordner, `${name}.json`), 'utf8');
  const o = JSON.parse(roh);
  return JSON.parse(huellenVersion(o) ? huelleOeffnen(o, schluesselRing(), name).text : roh);
}
const ids = (l: { id: string }[] | undefined) => (l ?? []).map(x => x.id).sort();

beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: localDay() });
}, 300_000);
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true }); });

describe('Neustart-Umzug mit der Demo', () => {
  it('Probelauf: drei Konten (eins „nur Business“), Haushalt „demo“, nichts geschrieben', async () => {
    const b = await umzugLaufen({ von: alt, nach: path.join(wurzel, 'probe') });
    expect(b.konten.personen.map(p => p.speicher).sort()).toEqual(['ben', 'jonas', 'lena']);
    expect(b.konten.personen.find(p => p.speicher === 'ben')).toMatchObject({ rolle: 'mitglied', finanzRecht: 'business' });
    expect(b.konten.haushalt).toBe('demo');
    expect(b.hinweise.join(' ')).toMatch(/Vorname „ben“/);
    expect(b.nicht.map(x => x.name)).toEqual(expect.arrayContaining(['konten', 'meilensteine', 'ziele', 'gesellschaften--demo', 'team--demo']));
    expect(existsSync(path.join(wurzel, 'probe'))).toBe(false);
  });

  it('ausgeführt mit lena → lea: Kartei und CRM vollständig, Fahrplan-Aufgaben in „Übernommen“, Namen überall umgeschrieben', async () => {
    const nach = path.join(wurzel, 'neu');
    const b = await umzugLaufen({ von: alt, nach, ausfuehren: true, personen: new Map([['lena', 'lea']]), auch: ['gesellschaften--demo'] });
    // Kartei und CRM: dieselben Kennungen in jeder Liste.
    const kAlt = await lies(alt, 'kontakte'), kNeu = await lies(nach, 'kontakte');
    expect(ids(kNeu.kontakte)).toEqual(ids(kAlt.kontakte));
    expect(kNeu.kontakte.length).toBeGreaterThanOrEqual(8);
    const cAlt = await lies(alt, 'crm'), cNeu = await lies(nach, 'crm');
    for (const l of ['firmen', 'chancen', 'mandate', 'leistungen', 'events', 'teilnahmen', 'kampagnen', 'followups', 'angebote']) expect(ids(cNeu[l]), l).toEqual(ids(cAlt[l]));
    // Kein „lena“ mehr als ganzer Wert — Bestände je Person umbenannt.
    expect(JSON.stringify(kNeu)).not.toMatch(/"lena"/);
    expect(JSON.stringify(cNeu)).not.toMatch(/"lena"/);
    expect(JSON.stringify(kAlt)).toMatch(/"lena"/);
    for (const f of await fs.readdir(nach)) expect(f).not.toMatch(/--lena\.json$/);
    // Register mitgenommen (--auch).
    expect(existsSync(path.join(nach, 'gesellschaften--demo.json'))).toBe(true);
    // Aufgaben: die Fahrplan-Aufgaben hingen an Meilenstein-Listen → Projekt „Übernommen“ im Space ihrer Gesellschaft; keine `lm-`-Liste mehr.
    const st = await lies(nach, 'tasks');
    expect(st.listen.some((l: { id: string }) => l.id.startsWith('lm-'))).toBe(false);
    expect(st.projects.some((p: { id: string }) => p.id.startsWith('pm-'))).toBe(false);
    expect(st.projects.some((p: { title: string }) => p.title === 'Übernommen')).toBe(true);
    expect(b.aufgaben!.umgehaengt.aufgaben).toBeGreaterThan(0);
    expect(st.tasks.length).toBe(b.aufgaben!.neu.aufgaben);
    for (const t of st.tasks) expect(t.zielId).toBeUndefined();
    // Konten nie, Planung nie.
    for (const n of ['konten', 'meilensteine', 'ziele', 'routinen', 'team--demo']) expect(existsSync(path.join(nach, `${n}.json`)), n).toBe(false);
    expect(b.geschrieben?.geprueft).toBe(b.bestaende.length + (b.dateien!.crm.mitDatei - b.dateien!.crm.fehlen) + (b.dateien!.aufgaben.mitDatei - b.dateien!.aufgaben.fehlen) + b.dateien!.bilder);
    const marke = await fs.readFile(path.join(nach, 'system', 'neustart.json'), 'utf8');
    expect(JSON.parse(marke).zaehler).toMatchObject({ kontakte: kNeu.kontakte.length, deals: cNeu.chancen.length, aufgaben: st.tasks.length });
    for (const x of ['"lea"', '"ben"', '"jonas"', '"demo"', '@']) expect(marke).not.toContain(x);
  }, 120_000);
});
