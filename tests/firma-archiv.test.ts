// ─── Firmen zusammenführen mit Sicherung (30 Tage) und Weg zurück (03.10.) ───────────────────────────────────
// Kevin: „Vor jedem Firmen-Zusammenführen eine Archivkopie aller betroffenen Einträge — gleiches Muster wie der Kennungs-Umzug.“
// Hier: die Kopie entsteht VOR dem ersten Schreibschritt, liegt verschlüsselt im Archiv, fällt nach 30 Tagen von selbst weg, wird bei
// Art. 17 mitgeräumt, und die Wiederherstellung nimmt zurück, was seitdem unverändert ist — nur der Inhaber, nie der Dienstweg.
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-firmaarchiv-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_GRABSTEINE_DIR;
process.env.MAKE_OS_KEY = 'pruef-schluessel-firmaarchiv';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-firmaarchiv-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-firmaarchiv-nur-im-test-0123456789abcdef';

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Mandat } from '@/lib/crm/typen';
import { firmenArchivInhalt, firmaWiederherstellen, firmaWiederherstellenPruefen, istFirmenArchiv, FIRMEN_ARCHIV_NAME } from '@/lib/crm/firma-umhaengen';
import { istUmzugsKopie, archivTag } from '@/lib/crm/loeschfristen';
import { leereKriterien } from '@/lib/crm/leads';

const HAUS = 'archiv-haus';
const J = '2026-10-03T10:00:00.000Z';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id.slice(2)}`, rolle: 'zielkunde', geaendert: '2026-09-01T10:00:00.000Z', ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const deal = (id: string, kontaktIds: string[], firmaId: string): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds, firmaId, firma: `Firma ${firmaId.slice(2)}`, art: 'retainer', stufe: 'bedarf', wert: { betrag: 100, basis: 'monat' }, naechsterSchritt: { text: 'x', datum: '2099-01-01' },
  qualifizierung: leereKriterien(), historie: [], erstellt: '2026-09-01', geaendert: '2026-09-01',
} as unknown as Chance);
const mandat = (id: string, firmaId: string): Mandat => ({ id, kunde: `Firma ${firmaId.slice(2)}`, firmaId, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, geaendert: '2026-09-01' } as unknown as Mandat);
const station = (firmaId: string) => ({ firmaId, aktiv: true, haupt: true });
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] } as unknown as CrmBestand);

const STAND = (): { crm: CrmBestand; kontakte: Kontakt[] } => ({
  crm: {
    ...leer(),
    firmen: [firma('f-neu'), firma('f-dup', { domain: 'dup.example.invalid', notiz: 'Geheimer Hinweis' }), firma('f-kind', { mutterId: 'f-dup' }), firma('f-fremd')],
    chancen: [deal('ch-1', ['c-dup1'], 'f-dup'), deal('ch-fremd', ['c-fremd1'], 'f-fremd')],
    mandate: [mandat('m-1', 'f-dup')],
  },
  kontakte: [
    k('c-neu1', { firmaId: 'f-neu', firma: 'Firma neu', stationen: [station('f-neu')] }),
    k('c-dup1', { firmaId: 'f-dup', firma: 'Firma dup', email: 'dup1@example.invalid', stationen: [station('f-dup')] }),
    k('c-fremd1', { firmaId: 'f-fremd', firma: 'Firma fremd', stationen: [station('f-fremd')] }),
  ],
});

describe('Inhalt der Sicherung (rein)', () => {
  it('beide Firmen, was auf die weggeführte zeigt, ihre Personen — und nichts Fremdes', () => {
    const s = STAND();
    const a = firmenArchivInhalt(s.crm, s.kontakte, 'f-neu', 'f-dup', J, 'kevin');
    expect(istFirmenArchiv(a)).toBe(true);
    expect((a.crm.firmen as Firma[]).map(f => f.id).sort()).toEqual(['f-dup', 'f-kind', 'f-neu']);
    expect((a.crm.chancen as Chance[]).map(c => c.id)).toEqual(['ch-1']);
    expect((a.crm.mandate as Mandat[]).map(m => m.id)).toEqual(['m-1']);
    expect(a.kontakte.kontakte.map(x => x.id)).toEqual(['c-dup1']);
    expect(JSON.stringify(a)).not.toContain('fremd');
    expect(a).toMatchObject({ behalten: 'f-neu', weg: 'f-dup', am: J, person: 'kevin' });
  });
  it('Dateiname: Präfix der Umzugs-Kopien (30 Tage), Tag lesbar', () => {
    const name = `crm-vor-firmen-zusammenfuehren-2026-10-03T10-00-00-000Z.json`;
    expect(FIRMEN_ARCHIV_NAME.test(name)).toBe(true);
    expect(istUmzugsKopie(name)).toBe(true);
    expect(archivTag(name)).toBe('2026-10-03');
    expect(FIRMEN_ARCHIV_NAME.test('../x.json')).toBe(false);
    expect(FIRMEN_ARCHIV_NAME.test('crm-vor-brain-umzug-2026-10-03T10-00-00-000Z.json')).toBe(false);
  });
});

describe('Wiederherstellen (rein): nur, was seitdem unverändert ist', () => {
  const lauf = () => {
    const s = STAND();
    const a = firmenArchivInhalt(s.crm, s.kontakte, 'f-neu', 'f-dup', J, 'kevin');
    return { s, a };
  };
  it('zurück auf den Stand davor — Firma, Deal, Mandat, Person, Tochterfirma', async () => {
    const { firmaZusammenCrm, firmaZusammenKartei } = await import('@/lib/crm/firma-umhaengen');
    const { s, a } = lauf();
    const nachCrm = firmaZusammenCrm(s.crm, 'f-neu', 'f-dup', J, 'kevin');
    const nachKartei = firmaZusammenKartei(s.kontakte, nachCrm.firmen.find(f => f.id === 'f-neu')!, 'f-dup', '2026-10-03');
    expect(nachCrm.firmen.some(f => f.id === 'f-dup')).toBe(false);
    expect(firmaWiederherstellenPruefen(nachCrm, a)).toBeNull();
    const r = firmaWiederherstellen(nachCrm, nachKartei, a);
    expect(r.uebersprungen).toEqual([]);
    expect(r.crm.firmen.map(f => f.id).sort()).toEqual(['f-dup', 'f-fremd', 'f-kind', 'f-neu']);
    expect(r.crm.firmen.find(f => f.id === 'f-neu')).toEqual(s.crm.firmen.find(f => f.id === 'f-neu'));
    expect(r.crm.firmen.find(f => f.id === 'f-kind')!.mutterId).toBe('f-dup');
    expect(r.crm.chancen.find(c => c.id === 'ch-1')).toMatchObject({ firmaId: 'f-dup', firma: 'Firma dup' });
    expect(r.crm.mandate[0].firmaId).toBe('f-dup');
    expect(r.kontakte.find(x => x.id === 'c-dup1')).toMatchObject({ firmaId: 'f-dup', firma: 'Firma dup' });
    expect(r.zurueck).toMatchObject({ eintraege: 2, personen: 1 });
    // idempotent: ein zweiter Lauf auf dem Ergebnis findet nichts mehr zu tun und nichts „geändert“
    const nochmal = firmaWiederherstellen({ ...r.crm, firmen: r.crm.firmen.filter(f => f.id !== 'f-dup') }, r.kontakte, a);
    expect(nochmal.uebersprungen).toEqual([]);
    expect(nochmal.zurueck.eintraege + nochmal.zurueck.personen).toBe(0);
  });
  it('was seitdem geändert wurde, bleibt — und wird genannt', async () => {
    const { firmaZusammenCrm, firmaZusammenKartei } = await import('@/lib/crm/firma-umhaengen');
    const { s, a } = lauf();
    const nachCrm = firmaZusammenCrm(s.crm, 'f-neu', 'f-dup', J, 'kevin');
    const nachKartei = firmaZusammenKartei(s.kontakte, nachCrm.firmen.find(f => f.id === 'f-neu')!, 'f-dup', '2026-10-03');
    // Der Deal wurde danach weiterbearbeitet, die Person ist umgezogen, das Mandat gelöscht.
    const spaeter: CrmBestand = { ...nachCrm, chancen: nachCrm.chancen.map(c => (c.id === 'ch-1' ? { ...c, stufe: 'angebot' } as Chance : c)), mandate: [] };
    const personSpaeter = nachKartei.map(x => (x.id === 'c-dup1' ? { ...x, position: 'Neu: Geschäftsführung' } : x));
    const r = firmaWiederherstellen(spaeter, personSpaeter, a);
    expect(r.crm.chancen.find(c => c.id === 'ch-1')).toMatchObject({ firmaId: 'f-neu', stufe: 'angebot' });
    expect(r.kontakte.find(x => x.id === 'c-dup1')).toMatchObject({ firmaId: 'f-neu', position: 'Neu: Geschäftsführung' });
    expect(r.uebersprungen.join(' | ')).toMatch(/Eintrag wurde seitdem geändert/);
    expect(r.uebersprungen.join(' | ')).toMatch(/gibt es nicht mehr/);
    expect(r.uebersprungen.join(' | ')).toMatch(/Person wurde seitdem geändert/);
    // die Firma selbst kommt trotzdem zurück
    expect(r.crm.firmen.some(f => f.id === 'f-dup')).toBe(true);
  });
  it('Art. 17: eine Person, die nicht mehr in der Sicherung steht, kommt nicht zurück', async () => {
    const { firmaZusammenCrm, firmaZusammenKartei } = await import('@/lib/crm/firma-umhaengen');
    const { s, a } = lauf();
    const ohnePerson = { ...a, kontakte: { kontakte: [] } };
    const nachCrm = firmaZusammenCrm(s.crm, 'f-neu', 'f-dup', J, 'kevin');
    const nachKartei = firmaZusammenKartei(s.kontakte, nachCrm.firmen.find(f => f.id === 'f-neu')!, 'f-dup', '2026-10-03');
    const r = firmaWiederherstellen(nachCrm, nachKartei, ohnePerson);
    expect(r.kontakte.find(x => x.id === 'c-dup1')!.firmaId).toBe('f-neu'); // bleibt bei der behaltenen Firma
    expect(r.zurueck.personen).toBe(0);
  });
  it('prüfen: schon zurückgenommen / behaltene Firma weg / unvollständig', () => {
    const { s, a } = lauf();
    expect(firmaWiederherstellenPruefen(s.crm, a)).toMatch(/gibt es schon wieder/);
    expect(firmaWiederherstellenPruefen({ firmen: [] }, a)).toMatch(/behaltene Firma/);
    expect(firmaWiederherstellenPruefen({ firmen: [] }, { ...a, crm: { ...a.crm, firmen: [] } })).toMatch(/unvollständig/);
  });
});

describe('Server: Sicherung vor dem ersten Schreibschritt, 30 Tage, Art. 17, Inhaber', () => {
  type LocalDb = typeof import('@/lib/store/local-db');
  let db: LocalDb;
  let srv: typeof import('@/lib/crm/firma-umhaengen-server');
  let ab: typeof import('@/lib/store/absichten');
  const archivDateien = () => { try { return readdirSync(path.join(ordner, 'archiv')).filter(n => FIRMEN_ARCHIV_NAME.test(n)); } catch { return []; } };
  const lies = async () => ({ crm: (await db.loadJson<CrmBestand>('crm'))!, kontakte: (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte });

  beforeEach(async () => {
    rmSync(path.join(ordner, 'archiv'), { recursive: true, force: true });
    db = await import('@/lib/store/local-db');
    srv = await import('@/lib/crm/firma-umhaengen-server');
    ab = await import('@/lib/store/absichten');
    ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; ab.absichtTest.vorSchritt = null;
    const s = STAND();
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    await db.saveJson('absichten--archiv-haus', { absichten: [] });
    await db.saveJson('crm', s.crm);
    await db.saveJson('kontakte', { kontakte: s.kontakte });
    for (const n of ['tasks', 'ziele']) await db.saveJson(n, { leer: true });
  });

  it('Zusammenführen legt VOR dem ersten Schreibschritt eine verschlüsselte Sicherung an; der Name steht im Ergebnis', async () => {
    let beimErstenSchritt: string[] = [];
    ab.absichtTest.vorSchritt = (art, schritt) => { if (art === 'firma-umhaengen' && schritt === 'kartei') beimErstenSchritt = archivDateien(); };
    const r = await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    expect(r).toMatchObject({ ok: true });
    expect(beimErstenSchritt).toHaveLength(1); // schon da, bevor die Kartei angefasst wird
    const dateien = archivDateien();
    expect(dateien).toHaveLength(1);
    expect((r as { archiv?: string }).archiv).toBe(dateien[0]);
    // verschlüsselt: im Rohtext steht nichts Lesbares
    const roh = readFileSync(path.join(ordner, 'archiv', dateien[0]), 'utf8');
    expect(roh).not.toContain('dup.example.invalid');
    expect(roh).not.toContain('Geheimer Hinweis');
    // und lesbar mit dem Schlüssel — mit allem, was betroffen ist
    const { archivLesen } = await import('@/lib/store/archiv');
    const a = await archivLesen<unknown>(dateien[0]);
    expect(istFirmenArchiv(a)).toBe(true);
    if (istFirmenArchiv(a)) {
      expect(a.kontakte.kontakte.map(x => x.id)).toEqual(['c-dup1']);
      expect((a.crm.chancen as Chance[]).map(c => c.id)).toEqual(['ch-1']);
    }
    // die Absicht ist fertig und behält nur den Dateinamen der Sicherung
    const fertig = (await ab.absichtenLaden(HAUS)).filter(x => x.art === 'firma-umhaengen');
    expect(fertig.map(x => x.status)).toEqual(['fertig']);
    expect(fertig[0].daten).toEqual({ archiv: dateien[0] });
  });

  it('Abgelehnte Zusammenführung (Art. 18, Fremdbestand): keine Sicherung, nichts geändert', async () => {
    await db.saveJson('tasks', { tasks: [{ id: 't-1', title: 'Rückruf', bezug: { firmaId: 'f-dup' } }] });
    expect(await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin')).toMatchObject({ ok: false, status: 409 });
    expect(archivDateien()).toHaveLength(0);
  });

  it('Abbruch nach der Sicherung: die Wiederaufnahme legt KEINE zweite an', async () => {
    ab.absichtTest.vorAbhaken = (art, s) => { if (art === 'firma-umhaengen' && s === 'kartei') throw new ab.TestAbbruch(s); };
    await expect(srv.zusammenfuehren('f-neu', 'f-dup', 'kevin')).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.vorAbhaken = null;
    expect(archivDateien()).toHaveLength(1);
    const offen = await srv.offeneFirmaAbsichten();
    expect(offen).toHaveLength(1);
    await srv.firmaUmhaengenFortsetzen(HAUS, offen[0]);
    expect(archivDateien()).toHaveLength(1);
    expect((await lies()).crm.firmen.some(f => f.id === 'f-dup')).toBe(false);
  });

  it('Eine ältere offene Absicht ohne Schritt „archiv“ läuft wie bisher zu Ende (ohne Sicherung)', async () => {
    const { absicht } = await ab.absichtBeginnen(HAUS, { art: 'firma-umhaengen', schluessel: 'z:f-dup>f-neu', schritte: ['kartei', 'crm'], daten: { aktion: 'zusammen', behalten: 'f-neu', weg: 'f-dup', person: 'kevin', jetzt: J }, person: 'kevin' });
    await srv.firmaUmhaengenFortsetzen(HAUS, absicht);
    expect((await lies()).crm.firmen.some(f => f.id === 'f-dup')).toBe(false);
    expect(archivDateien()).toHaveLength(0);
  });

  it('Liste: die Sicherung mit beiden Firmen, Person, Resttagen — und ob die Wiederherstellung geht', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const liste = await srv.firmenArchive();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ behalten: { id: 'f-neu', name: 'Firma neu' }, weg: { id: 'f-dup', name: 'Firma dup' }, person: 'kevin', moeglich: true });
    expect(liste[0].nochTage).toBeGreaterThan(28);
    expect(liste[0].grund).toBeUndefined();
  });

  it('Wiederherstellen: nach dem Zusammenführen geht es zurück — und das Ergebnis gleicht dem Stand davor', async () => {
    const vorher = await lies();
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const [z] = await srv.firmenArchive();
    expect(z.moeglich).toBe(true);
    const r = await srv.firmenWiederherstellen(z.datei, 'kevin');
    expect(r).toMatchObject({ ok: true, uebersprungen: [] });
    const nachher = await lies();
    expect(nachher.crm.firmen.map(f => f.id).sort()).toEqual(vorher.crm.firmen.map(f => f.id).sort());
    expect(nachher.crm.chancen.find(c => c.id === 'ch-1')!.firmaId).toBe('f-dup');
    expect(nachher.crm.mandate[0].firmaId).toBe('f-dup');
    expect(nachher.kontakte.find(x => x.id === 'c-dup1')).toMatchObject({ firmaId: 'f-dup', firma: 'Firma dup' });
    expect(nachher.crm.firmen.find(f => f.id === 'f-kind')!.mutterId).toBe('f-dup');
    // ein zweites Mal: die Firma gibt es wieder → 409
    expect(await srv.firmenWiederherstellen(z.datei, 'kevin')).toMatchObject({ ok: false, status: 409 });
    expect((await srv.offeneFirmaAbsichten())).toHaveLength(0);
    // ungültiger Name / fehlende Datei
    expect(await srv.firmenWiederherstellen('../x.json', 'kevin')).toMatchObject({ ok: false, status: 400 });
    expect(await srv.firmenWiederherstellen('crm-vor-firmen-zusammenfuehren-2020-01-01T00-00-00-000Z.json', 'kevin')).toMatchObject({ ok: false, status: 404 });
  });

  it('Wiederherstellen: Art. 18 → 409', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const [z] = await srv.firmenArchive();
    const { kontakte } = await lies();
    await db.saveJson('kontakte', { kontakte: kontakte.map(x => (x.id === 'c-dup1' ? { ...x, eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } } : x)) });
    expect(await srv.firmenWiederherstellen(z.datei, 'kevin')).toMatchObject({ ok: false, status: 409 });
  });

  it('Abbruch beim Wiederherstellen: die Wiederaufnahme führt zu Ende', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const [z] = await srv.firmenArchive();
    ab.absichtTest.vorAbhaken = (art, s) => { if (art === 'firma-umhaengen' && s === 'kartei') throw new ab.TestAbbruch(s); };
    await expect(srv.firmenWiederherstellen(z.datei, 'kevin')).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.vorAbhaken = null;
    const offen = await srv.offeneFirmaAbsichten();
    expect(offen).toHaveLength(1);
    await srv.firmaUmhaengenFortsetzen(HAUS, offen[0]);
    const nachher = await lies();
    expect(nachher.kontakte.find(x => x.id === 'c-dup1')!.firmaId).toBe('f-dup');
    expect(nachher.crm.firmen.some(f => f.id === 'f-dup')).toBe(true);
  });

  it('Route /api/crm/firma-archiv: nur der Inhaber von Hand — Mitglied 403, Dienstweg 403, fremder Haushalt 403, ohne Person 401', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const route = (await import('@/app/api/crm/firma-archiv/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const post = async (body: unknown, kopf: Record<string, string>) => { const r = await route.POST(new Request('http://test/api/crm/firma-archiv', { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
    const dienst = { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
    expect((await post({ aktion: 'liste' }, dienst)).status).toBe(403);
    expect((await post({ aktion: 'liste' }, { 'x-make-user': 'malin' })).status).toBe(403);
    const liste = await post({ aktion: 'liste' }, { 'x-make-user': 'kevin' });
    expect(liste.status).toBe(200);
    expect(liste.d.sicherungen).toHaveLength(1);
    expect((await post({ aktion: 'wiederherstellen', datei: liste.d.sicherungen[0].datei }, dienst)).status).toBe(403);
    expect((await post({ aktion: 'gibtsnicht' }, { 'x-make-user': 'kevin' })).status).toBe(400);
    const r = await post({ aktion: 'wiederherstellen', datei: liste.d.sicherungen[0].datei }, { 'x-make-user': 'kevin' });
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, uebersprungen: [] });
    expect((await lies()).crm.firmen.some(f => f.id === 'f-dup')).toBe(true);
  });

  it('Löschfrist: nach 30 Tagen räumt der Lauf die Sicherung weg (Standard „archiv-umzug“)', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const heute = new Date().toISOString().slice(0, 10);
    const frueh = new Date(Date.parse(`${heute}T12:00:00Z`) + 20 * 864e5);
    await loeschfristenLauf(frueh, true);
    expect(archivDateien()).toHaveLength(1); // nach 20 Tagen noch da
    const spaet = new Date(Date.parse(`${heute}T12:00:00Z`) + 32 * 864e5);
    await loeschfristenLauf(spaet, true);
    expect(archivDateien()).toHaveLength(0);
  });

  it('Art. 17: eine gelöschte Person verschwindet auch aus der Sicherung (Kartei-Eintrag raus, Rest getilgt)', async () => {
    await srv.zusammenfuehren('f-neu', 'f-dup', 'kevin');
    const route = (await import('@/app/api/crm/datenschutz/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const r = await route.POST(new Request('http://test/api/crm/datenschutz', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin', 'content-type': 'application/json' }, body: JSON.stringify({ id: 'c-dup1', grund: 'Test' }) }));
    expect(r.status).toBe(200);
    const { archivLesen } = await import('@/lib/store/archiv');
    const text = JSON.stringify(await archivLesen<unknown>(archivDateien()[0]));
    expect(text).not.toContain('c-dup1');
    expect(text).not.toContain('dup1@example.invalid');
  });
});

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
