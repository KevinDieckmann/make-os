// ─── Zusatz 05.10.: Fristen für entfernte Konten, Löschprotokoll, Pannen-Register (+ Route) ─
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-dsgvo-zusatz-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-dsgvo-zusatz';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

import { kapaVerwaisteKonten } from '@/lib/kapazitaet/aufraeumen';
import { protokollUeberFrist } from '@/lib/crm/loeschprotokoll';
import { panneSaeubern, panneOffen, pannenUeberFrist, type Panne } from '@/lib/datenschutz/pannen';
import { LOESCHFRISTEN } from '@/lib/crm/loeschfristen';
import { LOESCHREGELN } from '@/lib/crm/datenschutz';
import { registerEintrag } from '@/lib/crm/speicher-register';

describe('Kapazität entfernter Konten', () => {
  it('nur konto-* ohne Konto; ohne Inhaber/Konten nie etwas (Schutz vor leerem Konten-Bestand)', () => {
    const kapa = { personen: { 'konto-pa': { stundenWoche: 20 }, 'konto-weg': { stundenWoche: 10 }, 'konto-alt': { stundenWoche: 5 }, 'tp-mira': { stundenWoche: 8 } }, zuweisungen: [] };
    const plan = { wochen: [{ woche: '2026-09-28', personen: [{ id: 'konto-plan', quelle: 'konto', verfuegbar: 1, geplant: 0, gebunden: 0 }] }] };
    expect(kapaVerwaisteKonten(kapa, plan, new Set(['pa']), true)).toEqual(['konto-alt', 'konto-plan', 'konto-weg']);
    expect(kapaVerwaisteKonten(kapa, plan, new Set(['pa']), false)).toEqual([]);
    expect(kapaVerwaisteKonten(kapa, plan, new Set(), true)).toEqual([]);
  });
});

describe('Löschprotokoll — eigene Frist', () => {
  it('abgeschlossene alte Einträge weg, laufende/unvollständige bleiben', () => {
    const e = [
      { id: 'lp-aaaaaaaa', datum: '2022-01-01', grund: 'x', von: 'pa', status: 'vollstaendig' as const },
      { id: 'lp-bbbbbbbb', datum: '2022-01-01', grund: 'x', von: 'pa', status: 'unvollstaendig' as const },
      { id: 'lp-cccccccc', datum: '2026-01-01', grund: 'x', von: 'pa' },
    ];
    const r = protokollUeberFrist(e, '2023-10-05');
    expect(r.n).toBe(1);
    expect(r.eintraege.map(x => x.id)).toEqual(['lp-bbbbbbbb', 'lp-cccccccc']);
    for (const id of ['loeschprotokoll', 'pannen', 'bauplan-bilder'] as const) expect(LOESCHFRISTEN.some(f => f.id === id), id).toBe(true);
    for (const id of ['kapazitaet-konto', 'loeschprotokoll', 'pannen']) expect(LOESCHREGELN.some(r => r.id === id), id).toBe(true);
    expect(registerEintrag('crm-loeschprotokoll')?.frist).toBe('loeschprotokoll');
    expect(registerEintrag('datenschutz-pannen')?.loeschfrist).toMatch(/36 Monate/);
  });
});

describe('Pannen-Register (rein)', () => {
  const roh = { kenntnisAm: '2026-10-01T08:00:00Z', beschreibung: 'Mail an falschen Empfänger', arten: ['vertraulichkeit'], betroffene: 'Geschäftskontakte', anzahl: 3, daten: 'Name, E-Mail', risiko: 'risiko', begruendung: 'wenige Personen', behoerde: { gemeldet: false }, benachrichtigt: { ja: false }, massnahmen: 'Rückruf' };
  it('Pflichtfelder und Säubern; gemeldet braucht Tag', () => {
    expect(panneSaeubern({ ...roh, arten: [] }, { id: 'pn-1', jetzt: '2026-10-05T10:00:00Z', von: 'pa' }).ok).toBe(false);
    expect(panneSaeubern({ ...roh, behoerde: { gemeldet: true } }, { id: 'pn-1', jetzt: '2026-10-05T10:00:00Z', von: 'pa' }).ok).toBe(false);
    const r = panneSaeubern(roh, { id: 'pn-1', jetzt: '2026-10-05T10:00:00Z', von: 'pa' });
    expect(r.ok && r.p.arten).toEqual(['vertraulichkeit']);
  });
  it('offen: Meldung binnen 72 h (überfällig danach), Abschluss; Frist ab Abschluss', () => {
    const r = panneSaeubern(roh, { id: 'pn-1', jetzt: '2026-10-05T10:00:00Z', von: 'pa' });
    if (!r.ok) throw new Error(r.fehler);
    const o = panneOffen(r.p, '2026-10-05T10:00:00Z');
    expect(o.find(x => x.dringend)?.text).toMatch(/überfällig/);
    expect(panneOffen(r.p, '2026-10-02T10:00:00Z').find(x => x.dringend)?.text).toMatch(/bis 2026-10-04 08:00/);
    const fertig: Panne = { ...r.p, behoerde: { gemeldet: true, am: '2026-10-02' }, abgeschlossenAm: '2026-10-03' };
    expect(panneOffen(fertig, '2026-10-05T10:00:00Z')).toEqual([]);
    expect(pannenUeberFrist({ pannen: [fertig, r.p] }, '2026-12-01').n).toBe(1);
    expect(pannenUeberFrist({ pannen: [fertig, r.p] }, '2026-01-01').n).toBe(0);
  });
});

describe('Pannen — Route: nur Inhaber', () => {
  type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  let route: Mod;
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    route = (await import('@/app/api/datenschutz/pannen/route')) as unknown as Mod;
    await db.saveJson('konten', { konten: [
      { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
      { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] }, haushalt: 'h-pruef' },
    ], einladungen: [] });
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  const req = (p: string, body?: unknown, kopf: Record<string, string> = {}) => new Request('http://test/api/datenschutz/pannen', body ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': p, ...kopf }, body: JSON.stringify(body) } : { headers: { 'x-make-user': p } });
  it('Mitglied 403, Dienstweg 403; Inhaber legt an, ändert, löscht', async () => {
    expect((await route.GET(req('pb'))).status).toBe(403);
    const panne = { kenntnisAm: '2026-10-01T08:00:00Z', beschreibung: 'Erfundene Panne', arten: ['verfuegbarkeit'], betroffene: 'keine', daten: 'keine', risiko: 'kein', begruendung: 'aus Sicherung zurückgeholt', behoerde: { gemeldet: false, grund: 'kein Risiko' }, benachrichtigt: { ja: false }, massnahmen: 'Probe' };
    expect((await route.POST(req('pb', { aktion: 'panne', panne }))).status).toBe(403);
    expect((await route.POST(req('pa', { aktion: 'panne', panne }, { 'x-make-key': 'pruef-schluessel-dsgvo-zusatz', 'x-make-person': 'pa' }))).status).toBe(403);
    const a = await (await route.POST(req('pa', { aktion: 'panne', panne }))).json();
    expect(a.ok).toBe(true);
    const id = a.pannen[0].id;
    expect(id).toMatch(/^pn-/);
    const b = await (await route.POST(req('pa', { aktion: 'panne', panne: { ...a.pannen[0], abgeschlossenAm: '2026-10-02' } }))).json();
    expect(b.offen[id]).toEqual([]);
    expect((await (await route.POST(req('pa', { aktion: 'panne-weg', id }))).json()).pannen).toEqual([]);
  });
});
