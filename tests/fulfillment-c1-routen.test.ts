// ─── Fulfillment C1 — Routen (10.10.): Business only, Tor, Sicht, Update-Probe ───────────────────────────────────────────────────────
// Fremder Haushalt und Testkunde → 403 überall; `?space=privat` → 403; Dienstweg liest mit Person, schreibt nie; Kunden-Link-Schalter nur
// Inhaber. Update-Probe: Mandate ohne Fall bleiben, wie sie sind (CRM unverändert nach Lesen und nach Vorlagen-Arbeit), der Business-Index
// bekommt ohne Fall nichts (null). Fall nur für Business-Mandate, idempotent über `anfrageId`; Import mit veralteter Vorschau → 409.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-c1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-c1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const j = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {};
  return { status: r.status, j };
}

const J = '2026-10-01T08:00:00.000Z';
const mandat = (id: string, gesellschaft: string, x: Record<string, unknown> = {}) => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', leistungId: 'l-probe', gesellschaft, status: 'aktiv',
  vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [{ id: 'z-probe', text: 'Mehr Termine' }], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J, ...x,
});

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }),
    konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    leistungen: [{ id: 'l-probe', name: 'Probe-Paket', typ: 'retainer', status: 'aktiv', lieferumfang: [], geaendert: J }],
    mandate: [mandat('m-biz', 'ug'), mandat('m-ohne', 'ug', { kontaktIds: [] }), mandat('m-privat', 'kdc')],
  });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Tor und Sicht', () => {
  it('fremder Haushalt und Testkunde → 403 auf jeder C1-Route; ?space=privat → 403', async () => {
    for (const [pfad, m] of [['fulfillment', 'GET'], ['fulfillment', 'PATCH'], ['fulfillment/fall', 'GET'], ['fulfillment/fall', 'POST'], ['fulfillment/fall', 'PATCH'], ['fulfillment/cockpit', 'GET'], ['fulfillment/import', 'POST'], ['fulfillment/wirkung', 'POST']] as const) {
      expect((await rufe(pfad, m, sitzung('gast'))).status, `${pfad} ${m} gast`).toBe(403);
      expect((await rufe(pfad, m, sitzung('kunde'))).status, `${pfad} ${m} kunde`).toBe(403);
    }
    expect((await rufe('fulfillment', 'GET', sitzung('pia'), undefined, '?space=privat')).status).toBe(403);
    expect((await rufe('fulfillment/cockpit', 'GET', sitzung('pia'), undefined, '?space=privat')).status).toBe(403);
  });

  it('Dienstweg liest mit Person aus dem Haushalt, schreibt nie', async () => {
    expect((await rufe('fulfillment', 'GET', dienst('pia'))).status).toBe(200);
    expect((await rufe('fulfillment', 'PATCH', dienst('pia'), { ops: [{ op: 'aus-muster' }] })).status).toBe(403);
    expect((await rufe('fulfillment/fall', 'POST', dienst('pia'), { aktion: 'starten', mandatId: 'm-biz' })).status).toBe(403);
    expect((await rufe('fulfillment/import', 'POST', dienst('pia'), { aktion: 'vorschau', inhalt: '{}' })).status).toBe(403);
  });
});

describe('Update-Probe und Ablauf', () => {
  it('ohne Fall: Lesen ändert nichts am CRM, der Index bekommt nichts, das Mandat steht als Kandidat', async () => {
    const db = await import('@/lib/store/local-db');
    const vorher = JSON.stringify(await db.loadJson('crm'));
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    expect(ue.status).toBe(200);
    expect(ue.j.prozesse).toEqual([]);
    const f = await rufe('fulfillment/fall', 'GET', sitzung('olaf'), undefined, '?m=m-biz');
    expect(f.status).toBe(200);
    expect(f.j.fall).toBeNull();
    expect((await rufe('fulfillment/cockpit', 'GET', sitzung('pia'))).j.zeilen).toEqual([]);
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
    const { ffKennzahlenFuerIndex } = await import('@/lib/fulfillment/prozesse/server');
    expect(await ffKennzahlenFuerIndex('2026-10-10')).toBeNull();
  });

  it('Vorlagen aus dem Muster; Kunden-Link-Schalter nur über C2 und nur Inhaber; Arbeit an Vorlagen ändert kein Mandat', async () => {
    const db = await import('@/lib/store/local-db');
    const vorher = JSON.stringify(await db.loadJson('crm'));
    expect((await rufe('fulfillment', 'PATCH', sitzung('olaf'), { ops: [{ op: 'aus-muster' }] })).status).toBe(200);
    const ue = await rufe('fulfillment', 'GET', sitzung('partnerin'));
    expect(ue.status).toBe(200);
    expect((ue.j.prozesse as { art: string }[]).filter(p => p.art === 'paket')).toHaveLength(3);
    // EIN Schreibweg für den Schalter (zusammengeführt 11.10.): POST /api/fulfillment/kunde { aktion: 'schalter' } — nur der Inhaber; die Vorlagen-Ops lehnen ab.
    expect((await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'einstellungen', felder: { kundenLink: { an: true } } }] })).status).toBe(400);
    expect((await rufe('fulfillment/kunde', 'POST', sitzung('olaf'), { aktion: 'schalter', an: true })).status).toBe(403);
    expect((await rufe('fulfillment/kunde', 'POST', dienst('pia'), { aktion: 'schalter', an: true })).status).toBe(403);
    const sch = await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'schalter', an: false });
    expect(sch.status).toBe(200);
    expect(sch.j.schalter).toMatchObject({ instanz: false, an: false });
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
  });

  it('Fall nur für Business-Mandate; Start idempotent; Ops schreiben, ein neues Ziel landet am Mandat', async () => {
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    const paket = (ue.j.prozesse as { id: string; art: string }[]).find(p => p.art === 'paket')!;
    expect((await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-privat', vorlageId: paket.id, anfrageId: 'ff-probe-privat' })).status).toBe(400);
    const a = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-biz', vorlageId: paket.id, anfrageId: 'ff-probe-1' });
    expect(a.status).toBe(200);
    const b = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-biz', vorlageId: paket.id, anfrageId: 'ff-probe-1' });
    expect(b.status).toBe(200);
    const f = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    expect((f.j.fall as { status: string }).status).toBe('onboarding');
    expect((f.j.onboarding as { schritte: unknown[] }).schritte).toHaveLength(8);
    const ops = await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-biz', ops: [{ op: 'willkommen-gesendet' }, { op: 'stakeholder', eintrag: { kontaktId: 'c-probe', rolle: 'entscheider', einfluss: 3 } }] });
    expect(ops.status).toBe(200);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-biz', ops: [{ op: 'stakeholder', eintrag: { kontaktId: 'c-unbekannt', rolle: 'nutzer', einfluss: 1 } }] })).status).toBeGreaterThanOrEqual(400);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-biz', ops: [{ op: 'ziel-neu', text: 'Kürzere Angebotszeit' }] })).status).toBe(200);
    const db = await import('@/lib/store/local-db');
    const crm = await db.loadJson('crm') as { mandate: { id: string; ziele: { text: string }[] }[] };
    expect(crm.mandate.find(m => m.id === 'm-biz')!.ziele.map(z => z.text)).toContain('Kürzere Angebotszeit');
    expect(crm.mandate.find(m => m.id === 'm-ohne')).toEqual(expect.objectContaining({ ziele: [{ id: 'z-probe', text: 'Mehr Termine' }] }));
    // 17.10. (Gesamtprüfung L2b B1): scheitert eine andere Änderung derselben Anfrage, kommt kein Ziel ans Mandat; dasselbe Ziel nie zweimal.
    const schief = await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-biz', ops: [{ op: 'ziel-neu', text: 'Mehr Empfehlungen' }, { op: 'stakeholder', eintrag: { kontaktId: 'c-unbekannt', rolle: 'nutzer', einfluss: 1 } }] });
    expect(schief.status).toBeGreaterThanOrEqual(400);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-biz', ops: [{ op: 'ziel-neu', text: 'kürzere angebotszeit ' }] })).status).toBe(200);
    const crm2 = await db.loadJson('crm') as { mandate: { id: string; ziele: { text: string }[] }[] };
    const texte = crm2.mandate.find(m => m.id === 'm-biz')!.ziele.map(z => z.text);
    expect(texte).not.toContain('Mehr Empfehlungen');
    expect(texte.filter(t => t.toLowerCase().includes('angebotszeit'))).toHaveLength(1);
    // Cockpit und Index sehen den Fall jetzt
    const c = await rufe('fulfillment/cockpit', 'GET', sitzung('pia'));
    expect((c.j.zeilen as { mandatId: string }[]).map(z => z.mandatId)).toEqual(['m-biz']);
    const { ffKennzahlenFuerIndex } = await import('@/lib/fulfillment/prozesse/server');
    expect((await ffKennzahlenFuerIndex('2026-10-10'))?.zeilen.map(z => z.mandatId)).toEqual(['m-biz']);
  });

  it('Import: Vorschau schreibt nichts; veraltete Vorschau → 409; übernehmen, dann Rückgängig', async () => {
    const inhalt = JSON.stringify({ vorlagen: [{ id: 'probe-a', art: 'aufgabe', titel: 'Probe A', zweck: 'Erfunden.' }] });
    const v = await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'vorschau', datei: 'probe.json', inhalt });
    expect(v.status).toBe(200);
    expect((v.j.vorschau as { zaehler: { neu: number } }).zaehler.neu).toBe(1);
    expect((await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'uebernehmen', datei: 'probe.json', inhalt, vorschauId: 'fv-veraltet' })).status).toBe(409);
    const u = await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'uebernehmen', datei: 'probe.json', inhalt, vorschauId: v.j.vorschauId });
    expect(u.status).toBe(200);
    expect(u.j.neu).toBe(1);
    const r = await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'rueckgaengig', laufId: u.j.laufId });
    expect(r.status).toBe(200);
    expect(r.j.bericht).toMatchObject({ entfernt: 1 });
    expect((await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'vorschau', datei: 'x.json', inhalt: 'kein json' })).status).toBe(400);
  });
});
