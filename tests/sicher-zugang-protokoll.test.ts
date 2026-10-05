// ─── Zugang & Schlüssel härten, Punkt 6 (05.10.): Anmeldeprotokoll nach Frist, Konto-Änderungen ins Änderungsprotokoll ─
// Anmeldungen: 12 Monate statt 300 Einträge (Notbremse 50 000). Konto neu/gelöscht, Rolle, Haushalt, Finanzrecht, zweiter
// Faktor an/aus und Instanz-Einstellungen landen im Änderungsprotokoll — nur Kennungen und Feldnamen. Eigener Datenordner.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-protokoll-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-protokoll-nur-test';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
const PW = 'TESTPASSWORT-nur-fuer-den-test';

let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let A: typeof import('@/lib/zugang/anmeldungen');
let P: typeof import('@/lib/store/aenderungsprotokoll');
let haushalt: typeof import('@/app/api/konto/haushalt/route');
let zweiFaktor: typeof import('@/app/api/konto/zwei-faktor/route');

const put = (body: unknown) => haushalt.PUT(new Request('http://test/api/konto/haushalt', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' }, body: JSON.stringify(body) }));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  A = await import('@/lib/zugang/anmeldungen');
  P = await import('@/lib/store/aenderungsprotokoll');
  haushalt = await import('@/app/api/konto/haushalt/route');
  zweiFaktor = await import('@/app/api/konto/zwei-faktor/route');
});
beforeEach(async () => {
  rmSync(ordner, { recursive: true, force: true });
  const hash = await K.passwortHashen(PW);
  await db.saveJson('konten', { konten: [
    { id: 'k-a', speicher: 'person-a', email: 'a@example.invalid', name: 'A', rolle: 'inhaber', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-test' },
    { id: 'k-b', speicher: 'person-b', email: 'b@example.invalid', name: 'B', rolle: 'mitglied', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, zweiterFaktor: { geheimnis: 'JBSWY3DPEHPK3PXP', seit: '2026-01-01', wiederherstellung: [] } },
  ], einladungen: [] });
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const eintraege = async () => (await P.protokollMonat('haus-test', P.monatBerlin())).filter(e => e.bestand === 'konten');

describe('Anmeldeprotokoll nach Frist', () => {
  it('nachFrist: älter als 12 Monate fällt weg, alles darin bleibt — auch weit über 300 Einträge', () => {
    const jetzt = new Date('2026-10-05T12:00:00Z');
    const e = (zeit: string) => ({ zeit, speicher: 'person-a', art: 'anmelden' as const, ok: true, adresse: '203.0.113.x' });
    const viele = Array.from({ length: 1000 }, (_, i) => e(new Date(jetzt.getTime() - i * 60_000).toISOString())).reverse();
    expect(A.nachFrist([e('2025-10-04T12:00:00.000Z'), e('2025-10-06T12:00:00.000Z'), ...viele], jetzt)).toHaveLength(1001);
    expect(A.FRIST_MONATE).toBe(12);
    expect(A.nachFrist(Array.from({ length: A.MAX_NOTBREMSE + 5 }, () => e('2026-10-01T00:00:00.000Z')), jetzt)).toHaveLength(A.MAX_NOTBREMSE);
  });
  it('notiere räumt Einträge außerhalb der Frist weg und hält mehr als 300', async () => {
    const alt = { zeit: '2024-01-01T00:00:00.000Z', speicher: 'person-a', art: 'anmelden', ok: true, adresse: 'x' };
    const frisch = Array.from({ length: 400 }, () => ({ zeit: new Date().toISOString(), speicher: 'person-a', art: 'anmelden', ok: false, adresse: 'x' }));
    await db.saveJson('anmeldungen', { eintraege: [alt, ...frisch] });
    await A.notiere({ speicher: 'person-a', art: 'anmelden', ok: true, adresse: 'y' });
    const alle = await A.alle();
    expect(alle).toHaveLength(401);
    expect(alle.some(x => x.zeit.startsWith('2024'))).toBe(false);
  });
});

describe('Konto-Änderungen im Änderungsprotokoll', () => {
  it('kontoAenderungen (rein): neu, gelöscht, Felder, 2FA an/aus, Instanz', () => {
    const k = (id: string, x: Record<string, unknown> = {}) => ({ id, speicher: id, email: `${id}@example.invalid`, name: id, rolle: 'mitglied' as const, hash: 'h', salz: 's', angelegt: 'x', teilt: { gesundheit: [] }, ...x });
    const alt = { konten: [k('k1'), k('k2', { haushalt: 'h1' }), k('k3')], einladungen: [] };
    const neu = { konten: [k('k1', { rolle: 'inhaber', zweiterFaktor: { geheimnis: 'g', seit: 'x', wiederherstellung: [] } }), k('k2', { finanzRecht: 'business' }), k('k4')], einladungen: [], einstellungen: { zweiFaktorPflicht: true, zweiFaktorPflichtSeit: 'x' } };
    expect(K.kontoAenderungen(alt as never, neu as never)).toEqual([
      { op: 'geaendert', id: 'k1', felder: ['rolle', 'zweiterFaktor'] },
      { op: 'geaendert', id: 'k2', felder: ['haushalt', 'finanzRecht'] },
      { op: 'neu', id: 'k4' },
      { op: 'geloescht', id: 'k3' },
      { op: 'geaendert', id: 'instanz', felder: ['zweiFaktorPflicht'] },
    ]);
    expect(K.kontoAenderungen(alt as never, alt as never)).toEqual([]);
  });
  // Wer: in einer echten Anfrage aus den Köpfen (werAusAnfrage über next/headers) — außerhalb von Next (Test) „system“.
  it('Haushalt/Finanzrecht über die Route: Eintrag mit Kennung und Feldnamen — ohne Werte', async () => {
    expect((await put({ speicher: 'person-b', haushalt: 'haus-test', finanzRecht: 'business' })).status).toBe(200);
    const e = await eintraege();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ bestand: 'konten', op: 'geaendert', id: 'k-b', felder: ['haushalt', 'finanzRecht'] });
    const roh = JSON.stringify(e);
    for (const wert of ['business', 'b@example.invalid', 'haus-test"']) expect(roh).not.toContain(wert);
  });
  it('2FA aus: Eintrag „zweiterFaktor“; Anmelde-Kleinkram (letzteStufe, Widerruf) erzeugt keinen', async () => {
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, letzteStufe: 5 }, widerrufen: [{ sid: 'abcdefabcdef', bis: 1 }] } : k) }));
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-b' ? { ...k, haushalt: 'haus-test' } : k) }));
    const r = await zweiFaktor.POST(new Request('http://test/api/konto/zwei-faktor', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'person-b' }, body: JSON.stringify({ aktion: 'aus', passwort: PW }) }));
    expect(r.status).toBe(200);
    const e = await eintraege();
    expect(e.map(x => x.felder)).toEqual([['haushalt'], ['zweiterFaktor']]);
  });
});
