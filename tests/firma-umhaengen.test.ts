// ─── Firma wechseln (Lead, Deals mit) und Firmen zusammenführen — rein und mit Abbruch nach jedem Schritt (03.10.) ──────
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-firmaumh-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-firmaumh';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Lead } from '@/lib/crm/typen';
import { firmaFolgenPlan, firmaFolgenCrm, firmaFolgenKartei, firmaZusammenPruefen, firmaMerge, firmenIdErsetzen, firmaZusammenVorschau, firmaZusammenCrm, firmaZusammenKartei, leadVereinen } from '@/lib/crm/firma-umhaengen';
import { leereKriterien } from '@/lib/crm/leads';

const HAUS = 'umh-haus';
const J = '2026-10-03T10:00:00.000Z';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id.slice(2)}`, rolle: 'zielkunde', geaendert: '2026-09-01T10:00:00.000Z', ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const deal = (id: string, kontaktIds: string[], firmaId: string | undefined, stufe: Chance['stufe'] = 'bedarf'): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds, ...(firmaId ? { firmaId, firma: `Firma ${firmaId.slice(2)}` } : {}), art: 'retainer', stufe, wert: { betrag: 100, basis: 'monat' }, naechsterSchritt: { text: 'x', datum: '2099-01-01' },
  qualifizierung: leereKriterien(), historie: [], erstellt: '2026-09-01', geaendert: '2026-09-01',
} as unknown as Chance);
const lead = (x: Partial<Lead> = {}): Lead => ({ status: 'qualifizierung', kriterien: { ...leereKriterien(), schmerz: 'ja' }, ...x });
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] } as CrmBestand);
const station = (firmaId: string, aktiv = true) => ({ firmaId, aktiv, ...(aktiv ? { haupt: true } : {}), ...(!aktiv ? { bis: '2026-01-01' } : {}) });

describe('Folgen eines Firmenwechsels — Vorschau und Rechnung (rein)', () => {
  // Anna ist zu Firma NEU gewechselt (Kartei schon geändert), Bert sitzt noch in ALT.
  const kontakte = () => [
    k('c-anna1', { firmaId: 'f-neu', stationen: [station('f-alt', false), station('f-neu')] }),
    k('c-bert1', { firmaId: 'f-alt', stationen: [station('f-alt')] }),
  ];
  const crm = (): CrmBestand => ({ ...leer(), firmen: [firma('f-alt', { lead: lead({ antworten: { schmerz: 'Angebote dauern' } }) }), firma('f-neu'), firma('f-leer')], chancen: [
    deal('ch-nur-anna', ['c-anna1'], 'f-alt'), deal('ch-beide', ['c-anna1', 'c-bert1'], 'f-alt'), deal('ch-zu', ['c-anna1'], 'f-alt', 'verloren'), deal('ch-andere', ['c-bert1'], 'f-alt'),
  ] });
  const e = { personIds: ['c-anna1'], von: 'f-alt', nach: 'f-neu', leadMit: true, dealsMit: true };

  it('Deals ziehen mit, wenn NUR die gewechselte Person daran hängt — ein Deal mit weiteren Personen bleibt und wird genannt', () => {
    const p = firmaFolgenPlan(crm(), kontakte(), e);
    expect(p.dealsMit.map(d => d.id)).toEqual(['ch-nur-anna']);
    expect(p.dealsBleiben).toEqual([{ id: 'ch-beide', titel: 'Deal ch-beide', grund: 'weitere Personen hängen am Deal' }]); // ch-andere gehört nur Bert — kommt gar nicht vor
  });
  it('Lead: Bert ist noch aktiv in der alten Firma → kopiert; verlässt auch er sie → verschoben', () => {
    expect(firmaFolgenPlan(crm(), kontakte(), e).lead).toBe('kopiert');
    const ohneBert = kontakte().map(x => (x.id === 'c-bert1' ? { ...x, firmaId: undefined, stationen: [station('f-alt', false)] } : x));
    expect(firmaFolgenPlan(crm(), ohneBert, e)).toMatchObject({ lead: 'verschoben', alteFirmaPersonen: 0 });
  });
  it('anwenden: Deal und Lead wandern, der Rest bleibt — und ein zweiter Lauf ändert nichts mehr (idempotent)', () => {
    const neu = firmaFolgenCrm(crm(), kontakte(), e, J, 'kevin');
    expect(neu.chancen.find(c => c.id === 'ch-nur-anna')).toMatchObject({ firmaId: 'f-neu', firma: 'Firma neu' });
    expect(neu.chancen.find(c => c.id === 'ch-beide')!.firmaId).toBe('f-alt');
    expect(neu.chancen.find(c => c.id === 'ch-zu')!.firmaId).toBe('f-alt'); // verlorene Deals sind Geschichte der alten Firma
    expect(neu.firmen.find(f => f.id === 'f-neu')!.lead).toMatchObject({ status: 'qualifizierung', antworten: { schmerz: 'Angebote dauern' } });
    expect(neu.firmen.find(f => f.id === 'f-alt')!.lead).toBeDefined(); // kopiert, nicht verschoben
    const zweimal = firmaFolgenCrm(neu, kontakte(), e, J, 'kevin');
    expect(zweimal).toEqual(neu);
  });
  it('verschoben: die alte Firma gibt den Lead ab', () => {
    const ohneBert = kontakte().map(x => (x.id === 'c-bert1' ? { ...x, firmaId: undefined, stationen: [station('f-alt', false)] } : x));
    const neu = firmaFolgenCrm(crm(), ohneBert, e, J, 'kevin');
    expect(neu.firmen.find(f => f.id === 'f-alt')!.lead).toBeUndefined();
    expect(neu.firmen.find(f => f.id === 'f-neu')!.lead).toBeDefined();
  });
  it('die neue Firma hatte schon einen Lead: sie gewinnt, Lücken füllt der mitgebrachte', () => {
    const c = crm();
    c.firmen = c.firmen.map(f => (f.id === 'f-neu' ? { ...f, lead: lead({ status: 'im_gespraech', kriterien: { ...leereKriterien(), entscheider: 'ja' } }) } : f));
    const p = firmaFolgenPlan(c, kontakte(), e);
    expect(p).toMatchObject({ lead: 'kopiert', zielHatteLead: true });
    const l = firmaFolgenCrm(c, kontakte(), e, J, 'kevin').firmen.find(f => f.id === 'f-neu')!.lead!;
    expect(l.status).toBe('im_gespraech');
    expect(l.kriterien).toMatchObject({ entscheider: 'ja', schmerz: 'ja' });
  });
  it('ohne Haken passiert nichts am CRM', () => {
    expect(firmaFolgenCrm(crm(), kontakte(), { ...e, leadMit: false, dealsMit: false }, J, 'kevin')).toEqual(crm());
  });
  it('Person ohne bisherige Firma: der Lead der PERSON wandert an die Firma, die Kartei räumt ihn von der Person', () => {
    const ks = [k('c-solo1', { firmaId: 'f-neu', stationen: [station('f-neu')], lead: lead({ stufen: { schmerz: 's5' } }) })];
    const c = { ...leer(), firmen: [firma('f-neu')], chancen: [deal('ch-solo', ['c-solo1'], undefined)] };
    const ein = { personIds: ['c-solo1'], nach: 'f-neu', leadMit: true, dealsMit: true };
    expect(firmaFolgenPlan(c, ks, ein)).toMatchObject({ lead: 'verschoben', leadVon: 'person' });
    const nc = firmaFolgenCrm(c, ks, ein, J, 'malin');
    expect(nc.firmen[0].lead).toMatchObject({ stufen: { schmerz: 's5' } });
    expect(nc.chancen[0].firmaId).toBe('f-neu');
    const nk = firmaFolgenKartei(nc, ks, ein, J);
    expect(nk[0].lead).toBeUndefined();
    expect(firmaFolgenKartei(nc, nk, ein, J)).toBe(nk); // zweiter Lauf: unverändert
  });
  it('leadVereinen: der Zielwert gewinnt, „unklar“ weicht dem Wissen, Antworten und Stufen füllen Lücken', () => {
    const v = leadVereinen(lead({ kriterien: { ...leereKriterien(), schmerz: 'nein' }, stufen: { a: 's1' } }), lead({ kriterien: { ...leereKriterien(), schmerz: 'ja', budget: 'ja' }, stufen: { a: 's5', b: 's3' } }))!;
    expect(v.kriterien).toMatchObject({ schmerz: 'nein', budget: 'ja' });
    expect(v.stufen).toEqual({ a: 's1', b: 's3' });
  });
});

describe('Firmen zusammenführen — Rechnung (rein)', () => {
  it('prüfen: gleiche, fehlende, Mutter/Tochter', () => {
    const fs = [firma('f-a'), firma('f-b'), firma('f-c', { mutterId: 'f-a' })];
    expect(firmaZusammenPruefen(fs, 'f-a', 'f-a')).toMatch(/verschiedene/);
    expect(firmaZusammenPruefen(fs, 'f-a', 'f-x')).toMatch(/nicht mehr/);
    expect(firmaZusammenPruefen(fs, 'f-a', 'f-c')).toMatch(/Mutter und Tochter/);
    expect(firmaZusammenPruefen(fs, 'f-a', 'f-b')).toBeNull();
  });
  it('Kennung ersetzen nur als ganzes Wort (f-ab trifft nie f-abc)', () => {
    const r = firmenIdErsetzen({ a: 'f-ab', b: ['f-abc', 'x f-ab y', '?k=f-ab'], c: { firmaId: 'f-ab' } }, 'f-ab', 'f-zz');
    expect(r.wert).toEqual({ a: 'f-zz', b: ['f-abc', 'x f-zz y', '?k=f-zz'], c: { firmaId: 'f-zz' } });
    expect(r.n).toBe(4);
  });
  it('Felder: die behaltene gewinnt, Lücken füllt die andere; Branchen vereint; Rolle „offen“ weicht', () => {
    const a = firma('f-a', { rolle: 'offen', stadt: 'Köln', branchen: ['Maschinenbau'], branche: 'Maschinenbau' });
    const b = firma('f-b', { rolle: 'kunde', stadt: 'Bonn', domain: 'b.example.invalid', branchen: ['Handel'], branche: 'Handel', mutterId: 'f-m' });
    const m = firmaMerge(a, b, J, 'kevin');
    expect(m).toMatchObject({ id: 'f-a', name: 'Firma a', stadt: 'Köln', domain: 'b.example.invalid', rolle: 'kunde', branche: 'Maschinenbau · Handel', mutterId: 'f-m' });
  });
  const crm = (): CrmBestand => ({ ...leer(), firmen: [firma('f-a'), firma('f-b', { domain: 'b.example.invalid', lead: lead() }), firma('f-t', { mutterId: 'f-b' })],
    chancen: [deal('ch-1', ['c-1'], 'f-b'), deal('ch-2', ['c-2'], 'f-a')], mandate: [{ id: 'm-1', kunde: 'Firma b', firmaId: 'f-b', kontaktIds: ['c-1'], titel: 'M', status: 'aktiv' } as never],
    followups: [{ id: 'fu-1', bezug: { art: 'firma', id: 'f-b' }, art: 'sonstig', text: 'x', faellig: '2099-01-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J }] });
  it('Vorschau zählt, was wandert', () => {
    const ks = [k('c-1', { firmaId: 'f-b', stationen: [station('f-b')] }), k('c-9', { stationen: [station('f-b', false)] })];
    expect(firmaZusammenVorschau(crm(), ks, 'f-a', 'f-b')).toMatchObject({ personen: 1, ehemalig: 1, dealsOffen: 1, dealsGesamt: 1, mandate: 1, followups: 1, lead: 'nur-weg' });
  });
  it('CRM: alle Verweise zeigen auf die behaltene Firma, die Tochter hängt jetzt an ihr, die andere ist weg, Namen am Deal folgen — idempotent', () => {
    const neu = firmaZusammenCrm(crm(), 'f-a', 'f-b', J, 'kevin');
    expect(neu.firmen.map(f => f.id)).toEqual(['f-a', 'f-t']);
    expect(neu.firmen.find(f => f.id === 'f-t')!.mutterId).toBe('f-a');
    expect(neu.firmen.find(f => f.id === 'f-a')).toMatchObject({ domain: 'b.example.invalid', lead: { status: 'qualifizierung' } });
    expect(neu.chancen.find(c => c.id === 'ch-1')).toMatchObject({ firmaId: 'f-a', firma: 'Firma a' });
    expect(neu.mandate[0]).toMatchObject({ firmaId: 'f-a', kunde: 'Firma b' }); // der Kundenname bleibt (Rechnungen hängen daran)
    expect(neu.followups![0].bezug.id).toBe('f-a');
    expect(firmaZusammenCrm(neu, 'f-a', 'f-b', J, 'kevin')).toBe(neu);
  });
  it('Kartei: Stationen wandern; war jemand in beiden aktiv, bleibt EINE laufende Station', () => {
    const ks = [k('c-1', { firmaId: 'f-b', stationen: [station('f-b')] }), k('c-2', { firmaId: 'f-a', stationen: [{ ...station('f-a'), rolle: 'GF' }, { firmaId: 'f-b', aktiv: true, rolle: 'Beirat' }] }), k('c-3', { firmaId: 'f-x' })];
    const neu = firmaZusammenKartei(ks, firma('f-a'), 'f-b', '2026-10-03');
    expect(neu.find(x => x.id === 'c-1')).toMatchObject({ firmaId: 'f-a', firma: 'Firma a' });
    expect(neu.find(x => x.id === 'c-2')!.stationen!.filter(s => s.aktiv && s.firmaId === 'f-a')).toHaveLength(1);
    expect(neu.find(x => x.id === 'c-3')).toBe(ks[2]);
    expect(firmaZusammenKartei(neu, firma('f-a'), 'f-b', '2026-10-03')).toBe(neu);
  });
});

describe('Schreibschritte — Abbruch nach jedem Schritt holt die Wiederaufnahme nach', () => {
  type LocalDb = typeof import('@/lib/store/local-db');
  let db: LocalDb;
  let srv: typeof import('@/lib/crm/firma-umhaengen-server');
  let ab: typeof import('@/lib/store/absichten');
  const lies = async () => ({ crm: (await db.loadJson<CrmBestand>('crm'))!, kontakte: (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte });

  beforeEach(async () => {
    db = await import('@/lib/store/local-db');
    srv = await import('@/lib/crm/firma-umhaengen-server');
    ab = await import('@/lib/store/absichten');
    ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; ab.absichtTest.vorSchritt = null;
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    await db.saveJson('absichten--umh-haus', { absichten: [] });
    await db.saveJson('crm', { ...leer(), firmen: [firma('f-alt', { lead: lead() }), firma('f-neu'), firma('f-dup', { domain: 'dup.example.invalid' })], chancen: [deal('ch-1', ['c-anna1'], 'f-alt'), deal('ch-2', ['c-dup1'], 'f-dup')] });
    await db.saveJson('kontakte', { kontakte: [
      k('c-anna1', { firmaId: 'f-neu', firma: 'Firma neu', stationen: [station('f-alt', false), station('f-neu')] }),
      k('c-dup1', { firmaId: 'f-dup', firma: 'Firma dup', stationen: [station('f-dup')] }),
    ] });
    for (const n of ['tasks', 'ziele']) await db.saveJson(n, { leer: true });
  });

  const EINGABE = { personIds: ['c-anna1'], von: 'f-alt', nach: 'f-neu', leadMit: true, dealsMit: true };
  const folgenZiel = async () => { const { crm, kontakte } = await lies(); return { deal: crm.chancen[0].firmaId, leadNeu: !!crm.firmen.find(f => f.id === 'f-neu')?.lead, leadAlt: !!crm.firmen.find(f => f.id === 'f-alt')?.lead, anna: kontakte[0].firmaId }; };

  it('Folgen: durchgelaufen → Deal und Lead an der neuen Firma, die Absicht ist fertig', async () => {
    const r = await srv.folgenAnwenden(EINGABE, 'kevin');
    expect(r.ok).toBe(true);
    expect(await folgenZiel()).toEqual({ deal: 'f-neu', leadNeu: true, leadAlt: false, anna: 'f-neu' });
    expect((await ab.absichtenLaden(HAUS)).filter(a => a.art === 'firma-umhaengen').map(a => a.status)).toEqual(['fertig']);
  });

  for (const [wann, haken] of [['vor dem Abhaken von „crm“', 'vorAbhaken'], ['nach dem Abhaken von „crm“', 'nachAbhaken']] as const) {
    it(`Folgen: Abbruch ${wann} → offen; die Wiederaufnahme macht denselben Stand wie ein glatter Lauf`, async () => {
      ab.absichtTest[haken] = (art, schritt) => { if (art === 'firma-umhaengen' && schritt === 'crm') throw new ab.TestAbbruch(schritt); };
      await expect(srv.folgenAnwenden(EINGABE, 'kevin')).rejects.toThrow(/Testabbruch/);
      ab.absichtTest[haken] = null;
      const offen = await srv.offeneFirmaAbsichten();
      expect(offen).toHaveLength(1);
      await srv.firmaUmhaengenFortsetzen(HAUS, offen[0]);
      expect(await folgenZiel()).toEqual({ deal: 'f-neu', leadNeu: true, leadAlt: false, anna: 'f-neu' });
      expect(await srv.offeneFirmaAbsichten()).toHaveLength(0);
    });
  }

  it('Folgen: Art. 18 → 409, nichts geändert; unbekannte Firma → 404', async () => {
    const { kontakte } = await lies();
    await db.saveJson('kontakte', { kontakte: kontakte.map(x => (x.id === 'c-anna1' ? { ...x, eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } } : x)) });
    expect(await srv.folgenAnwenden(EINGABE, 'kevin')).toMatchObject({ ok: false, status: 409 });
    expect(await srv.folgenAnwenden({ ...EINGABE, nach: 'f-gibtsnicht' }, 'kevin')).toMatchObject({ ok: false, status: 404 });
    expect((await folgenZiel()).deal).toBe('f-alt');
    expect(await srv.offeneFirmaAbsichten()).toHaveLength(0);
  });

  const zusammenZiel = async () => { const { crm, kontakte } = await lies(); return { firmen: crm.firmen.map(f => f.id).sort(), deal: crm.chancen[1].firmaId, person: kontakte[1].firmaId, domain: crm.firmen.find(f => f.id === 'f-neu')?.domain }; };
  const GEMERGT = { firmen: ['f-alt', 'f-neu'], deal: 'f-neu', person: 'f-neu', domain: 'dup.example.invalid' };

  it('Zusammenführen: durchgelaufen → eine Firma, Verweise umgebogen', async () => {
    const r = await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    expect(r.ok).toBe(true);
    expect(await zusammenZiel()).toEqual(GEMERGT);
  });
  for (const [schritt, haken] of [['kartei', 'nachAbhaken'], ['kartei', 'vorAbhaken'], ['crm', 'vorAbhaken']] as const) {
    it(`Zusammenführen: Abbruch (${haken} „${schritt}“) → die Wiederaufnahme führt zu Ende; dazwischen sind die Stände gültig`, async () => {
      ab.absichtTest[haken] = (art, s) => { if (art === 'firma-umhaengen' && s === schritt) throw new ab.TestAbbruch(s); };
      await expect(srv.zusammenfuehren('f-neu', 'f-dup', 'kevin')).rejects.toThrow(/Testabbruch/);
      ab.absichtTest[haken] = null;
      // Zwischenstand: beide Firmen noch da ODER schon zusammen — nie eine Person ohne Firma
      const { crm, kontakte } = await lies();
      expect(crm.firmen.some(f => f.id === kontakte[1].firmaId)).toBe(true);
      const offen = await srv.offeneFirmaAbsichten();
      expect(offen).toHaveLength(1);
      await srv.firmaUmhaengenFortsetzen(HAUS, offen[0]);
      expect(await zusammenZiel()).toEqual(GEMERGT);
    });
  }

  it('Zusammenführen: hängt außerhalb von Kartei und CRM noch etwas an der Firma → 409 mit dem Namen des Bestands, nichts geändert', async () => {
    await db.saveJson('tasks', { tasks: [{ id: 't-1', title: 'Rückruf', bezug: { firmaId: 'f-dup' } }] });
    const r = await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    expect(r).toMatchObject({ ok: false, status: 409, fremd: { tasks: 1 } });
    expect((r as { fehler: string }).fehler).toContain('Aufgaben (1)');
    expect((await zusammenZiel()).firmen).toEqual(['f-alt', 'f-dup', 'f-neu']);
  });

  it('Zusammenführen: Art. 18 an einer Person der Firma → 409', async () => {
    const { kontakte } = await lies();
    await db.saveJson('kontakte', { kontakte: kontakte.map(x => (x.id === 'c-dup1' ? { ...x, eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } } : x)) });
    expect(await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin')).toMatchObject({ ok: false, status: 409 });
  });

  it('Route: Vorschau und Zusammenführen über /api/crm/lead (angemeldete Person), Absicht und Stand wie oben', async () => {
    const route = (await import('@/app/api/crm/lead/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const post = async (body: unknown) => { const r = await route.POST(new Request('http://test/api/crm/lead', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'kevin' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
    const v = await post({ aktion: 'firmen-zusammen-vorschau', behalten: 'f-neu', weg: 'f-dup' });
    expect(v.status).toBe(200);
    expect(v.d.vorschau).toMatchObject({ personen: 1, dealsOffen: 1 });
    expect((await post({ aktion: 'firmen-zusammen', behalten: 'f-neu', weg: 'f-neu' })).status).toBe(409);
    expect((await post({ aktion: 'firmen-zusammen', behalten: 'f-neu', weg: 'f-dup' })).status).toBe(200);
    expect(await zusammenZiel()).toEqual(GEMERGT);
    const f = await post({ aktion: 'firma-folgen-vorschau', personIds: ['c-anna1'], von: 'f-alt', nach: 'f-neu', leadMit: true, dealsMit: true });
    expect(f.d.plan).toMatchObject({ lead: 'verschoben', dealsMit: [{ id: 'ch-1' }] });
  });
});

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
