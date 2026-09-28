// ─── Angebote laufen ab — auch ohne dass jemand die Markttraktion öffnet (28.09.) ─────────────────────────
// Vorher zog nur das Lesen (GET bestand/angebot) den Ablauf nach. Jetzt auch der tägliche Morgenlauf
// (POST /api/tagesstart, Schritt „Angebote“) — über dieselbe Funktion `ablaufNachziehen`, in derselben Sperre der
// Follow-up-Hinweis „Angebot abgelaufen — nachfassen oder Version 2“ (einmal je Angebot, nie für Art. 18).
// Eigener Datenordner, Innen-Adresse auf einen geschlossenen Port (die übrigen Schritte scheitern sofort, statt einen
// laufenden Dev-Server zu treffen). Alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Angebot, AngebotPosition, Chance, CrmBestand, FollowUp } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-angebot-ablauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-angebot-ablauf';
process.env.MAKE_OS_INTERN = 'http://127.0.0.1:9';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const J = new Date().toISOString();
let HEUTE = '';
let GESTERN = '';
let MORGEN = '';
const pos = (): AngebotPosition => ({ id: 'p1', titel: 'Leistung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' });
const ang = (id: string, x: Partial<Angebot> = {}): Angebot => ({ id, gesellschaft: 'kdv', titel: 'Retainer', positionen: [pos()], einleitung: '', schluss: '', gueltigBis: GESTERN, zahlungszielTage: 14, status: 'gestellt', version: 1, angelegt: J, geaendert: J, gestelltVon: 'kevin', ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'malin', angelegt: J, geaendert: J, letzteAktivitaet: '2026-01-01', ...x,
});
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Testa', nachname: 'Beispielfrau', eignung: '', prio: '', stufe: 'angebot', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

let db: typeof import('@/lib/store/local-db');
let angebote: typeof import('@/lib/crm/angebote');
let server: typeof import('@/lib/crm/angebot-server');
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;

beforeAll(async () => {
  const zeit = await import('@/lib/zeit');
  HEUTE = zeit.localDay();
  GESTERN = zeit.tagePlus(HEUTE, -1);
  MORGEN = zeit.tagePlus(HEUTE, 1);
  db = await import('@/lib/store/local-db');
  angebote = await import('@/lib/crm/angebote');
  server = await import('@/lib/crm/angebot-server');
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-ab' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-ab' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [person('c-ab-1'), person('c-ab-2'), person('c-ab-3', { eingeschraenkt: { seit: HEUTE, grund: 'Richtigkeit bestritten', von: 'kevin' } })] });
  const nachfassen: FollowUp = { id: 'fu-ang-mitdeal', bezug: { art: 'chance', id: 'ch-ab' }, kontaktId: 'c-ab-1', art: 'anruf', text: 'Angebot nachfassen', faellig: MORGEN, zustaendig: 'malin', status: 'offen', quelle: 'deal', angelegt: J, geaendert: J };
  await db.saveJson('crm', { ...speicher.leererBestand(), chancen: [deal('ch-ab', { kontaktIds: ['c-ab-1'] })], followups: [nachfassen], angebote: [
    ang('ang-mitdeal', { kontaktId: 'c-ab-1', dealId: 'ch-ab', nummer: 'KDV-A-2026-0007' }),
    ang('ang-ohnedeal', { kontaktId: 'c-ab-2' }),
    ang('ang-noch', { kontaktId: 'c-ab-2', gueltigBis: MORGEN }),
    ang('ang-art18', { kontaktId: 'c-ab-3' }),
    ang('ang-entwurf', { kontaktId: 'c-ab-2', status: 'entwurf' }),
  ] });
});
afterAll(() => { delete process.env.MAKE_OS_INTERN; rmSync(ordner, { recursive: true, force: true }); });

describe('Morgenlauf zieht den Ablauf nach', () => {
  it('POST /api/tagesstart: Schritt „Angebote“ — Status, Follow-ups, nichts anderes angefasst', async () => {
    const route = await import('@/app/api/tagesstart/route');
    const r = await route.POST(new Request('http://test/api/tagesstart', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }, body: JSON.stringify({ force: true }) }));
    const d = await r.json() as { schritte: { name: string; ok: boolean; info?: string }[] };
    expect(d.schritte[0]).toMatchObject({ name: 'Angebote', ok: true });
    expect(d.schritte[0].info).toMatch(/^3 abgelaufen/);

    const b = await crm();
    const status = Object.fromEntries(b.angebote.map(a => [a.id, a.status]));
    expect(status).toEqual({ 'ang-mitdeal': 'abgelaufen', 'ang-ohnedeal': 'abgelaufen', 'ang-noch': 'gestellt', 'ang-art18': 'abgelaufen', 'ang-entwurf': 'entwurf' });
    expect(b.angebote.find(a => a.id === 'ang-mitdeal')).toMatchObject({ abgelaufenAm: HEUTE, geaendertVon: 'system' });

    // Offenes „Angebot nachfassen“ bekommt den Hinweis und wird heute fällig — kein zweites Follow-up.
    const fu = b.followups.find(f => f.id === 'fu-ang-mitdeal')!;
    expect(fu).toMatchObject({ text: `${angebote.ABLAUF_FOLLOWUP_TEXT} (KDV-A-2026-0007)`, faellig: HEUTE, status: 'offen' });
    expect(b.followups.some(f => f.id === 'fu-ang-mitdeal-ablauf')).toBe(false);
    // Ohne offenes Nachfassen: neues Follow-up an der Person, zuständig die stellende Person.
    expect(b.followups.find(f => f.id === 'fu-ang-ohnedeal-ablauf')).toMatchObject({ bezug: { art: 'kontakt', id: 'c-ab-2' }, kontaktId: 'c-ab-2', text: angebote.ABLAUF_FOLLOWUP_TEXT, faellig: HEUTE, zustaendig: 'kevin', status: 'offen' });
    // Art. 18: Status ja, Follow-up nein.
    expect(b.followups.some(f => f.kontaktId === 'c-ab-3')).toBe(false);
  });

  it('zweiter Lauf: nichts mehr zu tun, keine doppelten Follow-ups', async () => {
    const vorher = (await crm()).followups.length;
    expect(await server.ablaufNachziehen()).toBe(0);
    expect((await crm()).followups).toHaveLength(vorher);
  });
});

describe('ablaufFollowUps (rein)', () => {
  it('einmal je Angebot; ohne Person und Deal keins; erledigtes Nachfassen → neues Ablauf-Follow-up', () => {
    const a = ang('ang-x', { kontaktId: 'c-x' });
    const erledigt: FollowUp = { id: 'fu-ang-x', bezug: { art: 'kontakt', id: 'c-x' }, kontaktId: 'c-x', art: 'anruf', text: 'Angebot nachfassen', faellig: GESTERN, zustaendig: 'kevin', status: 'erledigt', quelle: 'deal', angelegt: J, geaendert: J };
    const ctx = { heute: HEUTE, jetzt: J, zustaendig: () => 'kevin' };
    const eins = angebote.ablaufFollowUps([erledigt], [a, ang('ang-leer')], ctx);
    expect(eins.map(f => f.id)).toEqual(['fu-ang-x', 'fu-ang-x-ablauf']);
    expect(eins[0]).toBe(erledigt);
    expect(angebote.ablaufFollowUps(eins, [a], ctx)).toEqual(eins);
  });
});
