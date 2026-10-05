// ─── Verzeichnis (Art. 30) vervollständigt + Export (05.10.) ────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dsgvo-vv-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-dsgvo-vv';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

import { verzeichnisVervollstaendigen, verarbeitungenStart, verarbeitungenPlattform, VV_PLATTFORM_IDS, TOMS_BASIS, alteFassungenHeben } from '@/lib/crm/datenschutz';
import { EMPFAENGER_START, VERANTWORTLICHER_FEHLT, VERANTWORTLICH_EINRICHTUNG } from '@/lib/datenschutz/einrichtung';
import { verzeichnisDokument, verzeichnisHtml } from '@/lib/datenschutz/verzeichnis-export';
import { fristenWirksam } from '@/lib/crm/loeschfristen';
import type { Verarbeitung } from '@/lib/crm/typen';

const J = '2026-10-05T10:00:00.000Z';

describe('Verzeichnis vollständig', () => {
  it('alle Plattform-Verarbeitungen mit allen Pflichtfeldern, Platzhalter-Verantwortlichem und Empfängern aus dem Register', () => {
    for (const id of ['vv-konten', 'vv-buchung', 'vv-gesundheit', 'vv-familie', 'vv-finanzen', 'vv-zoe', 'vv-brain', 'vv-telegram', 'vv-mac-m365', 'vv-aufgaben-zeit', 'vv-kampagnen', 'vv-sicherungen', 'vv-bauplan']) expect(VV_PLATTFORM_IDS).toContain(id);
    const ids = new Set(EMPFAENGER_START.map(e => e.id));
    for (const v of verarbeitungenPlattform(J)) {
      for (const f of ['zweck', 'personen', 'daten', 'rechtsgrundlage', 'empfaenger', 'drittland', 'loeschfrist', 'toms'] as const) expect(v[f], `${v.id}.${f}`).toBeTruthy();
      expect(v.verantwortlich).toBe(VERANTWORTLICH_EINRICHTUNG);
      for (const e of v.empfaengerIds ?? []) expect(ids.has(e), `${v.id} → ${e}`).toBe(true);
    }
    expect(verarbeitungenPlattform(J).find(v => v.id === 'vv-gesundheit')?.rechtsgrundlage).toMatch(/Art\. 9 Abs\. 2 lit\. a/);
    expect(verarbeitungenPlattform(J).find(v => v.id === 'vv-kampagnen')?.rechtsgrundlage).toMatch(/Profiling/);
  });
  it('Nachtragen: fehlende dazu, Geändertes bleibt, unveränderte alte Fassung wird gehoben', () => {
    const alt = verarbeitungenStart(J).map(v => ({ ...v, toms: 'Zugang nur mit Anmeldung (zwei Konten), HTTPS, Server in Deutschland (Hetzner), nächtliche verschlüsselte Sicherung, Agentenpakete ohne Privatnotiz' }));
    const { empfaengerIds: _x, ...ohneIds } = alt[0];
    const vorher: Verarbeitung[] = [ohneIds, { ...alt[1], toms: 'von Hand geändert' }, ...alt.slice(2)];
    const r = verzeichnisVervollstaendigen(vorher, J);
    expect(r.geaendert).toBe(true);
    const n = new Map(r.liste.map(v => [v.id, v]));
    expect(n.get('vv-kontakte')?.toms).toBe(TOMS_BASIS);
    expect(n.get('vv-kontakte')?.empfaengerIds).toContain('anthropic');
    expect(n.get('vv-vertrieb')?.toms).toBe('von Hand geändert');
    for (const id of VV_PLATTFORM_IDS) expect(n.has(id), id).toBe(true);
    expect(verzeichnisVervollstaendigen(r.liste, J).geaendert).toBe(false);
    expect(alteFassungenHeben(r.liste)).toEqual(r.liste);
  });
});

describe('Export', () => {
  const liste = verzeichnisVervollstaendigen([], J).liste;
  it('ohne Verantwortlichen: deutlich „fehlt“; mit: aufgelöst, Empfänger mit AVV-Status', () => {
    const ohne = verzeichnisDokument({ verarbeitungen: liste, verantwortlicher: null, empfaenger: EMPFAENGER_START, fristen: fristenWirksam({}), jetzt: J });
    expect(ohne.verantwortlicher).toMatchObject({ fehlt: true });
    expect(ohne.verarbeitungen[0].verantwortlich).toBe(VERANTWORTLICHER_FEHLT);
    expect(verzeichnisHtml(ohne)).toContain(VERANTWORTLICHER_FEHLT);
    const mit = verzeichnisDokument({ verarbeitungen: liste, verantwortlicher: { name: 'Beispiel GmbH', anschrift: 'Weg 1', mail: 'd@example.invalid' }, empfaenger: EMPFAENGER_START, fristen: fristenWirksam({}), jetzt: J });
    expect(mit.verarbeitungen.every(v => v.verantwortlich.startsWith('Beispiel GmbH'))).toBe(true);
    const z = mit.verarbeitungen.find(v => v.id === 'vv-zoe')!;
    expect(z.empfaengerRegister.find(e => e.name.startsWith('Anthropic'))?.avv).toBe('offen');
    expect(mit.loeschfristen.find(f => f.titel.startsWith('Sicherungen'))?.frist).toBe('bis zu 12 Monate');
  });
  it('HTML ist escaped und ohne Skripte', () => {
    const d = verzeichnisDokument({ verarbeitungen: [{ ...liste[0], zweck: '<script>alert(1)</script>' }], verantwortlicher: null, empfaenger: [], fristen: fristenWirksam({}), jetzt: J });
    const h = verzeichnisHtml(d);
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });
});

describe('Export — Route', () => {
  type Mod = { GET: (r: Request) => Promise<Response> };
  let route: Mod;
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    route = (await import('@/app/api/datenschutz/verzeichnis/route')) as unknown as Mod;
    await db.saveJson('konten', { konten: [
      { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
      { id: '3', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
    ], einladungen: [] });
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  const req = (p: string, f: string) => new Request(`http://test/api/datenschutz/verzeichnis?format=${f}`, { headers: { 'x-make-user': p } });
  it('Testkunde 403; Haushalt bekommt HTML (mit CSP) und JSON als Datei; das Verzeichnis ist danach vollständig gespeichert', async () => {
    expect((await route.GET(req('px', 'html'))).status).toBe(403);
    const h = await route.GET(req('pa', 'html'));
    expect(h.headers.get('content-type')).toMatch(/text\/html/);
    expect(h.headers.get('content-security-policy')).toMatch(/default-src 'none'/);
    expect(await h.text()).toContain('Nutzerkonten und Anmeldeprotokoll');
    const j = await route.GET(req('pa', 'json'));
    expect(j.headers.get('content-disposition')).toMatch(/attachment; filename="Verzeichnis-Art30-/);
    const d = await j.json();
    expect(d.verarbeitungen.length).toBeGreaterThanOrEqual(4 + 3 + 2 + VV_PLATTFORM_IDS.length);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).verarbeitungen.some(v => v.id === 'vv-bauplan')).toBe(true);
  });
});
