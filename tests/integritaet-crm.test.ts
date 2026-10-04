// ─── Integritätsprüfung 28.09. abends — K2, W1, W4, W6, W8, W10, Kleines ─────
// Alle Daten erfunden (@example.invalid), eigener Datenordner — nie echte Bestände.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, CrmBestand, Firma, FollowUp, Mandat, Teilnahme } from '../lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-integritaet-crm-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-integritaet-crm';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const Q = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vor', nachname: id, email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [], qualifizierung: { ...Q }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as Chance);
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: 'Probe AG', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'mail', text: 'Nachfassen', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J, ...x });
const teilnahme = (id: string, eventId: string, kontaktId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id, eventId, kontaktId, status: 'eingeladen', geaendert: J, ...x });
const KEY = process.env.MAKE_OS_KEY!;
const dienst = (p = 'kevin') => ({ 'content-type': 'application/json', 'x-make-key': KEY, 'x-make-person': p });
const post = (pfad: string, body: unknown, p = 'kevin') => new Request(`http://test${pfad}`, { method: 'POST', headers: dienst(p), body: JSON.stringify(body) });

let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'probe-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'probe-haus' },
  ], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── K2: Art. 17 nimmt den Namen aus Deal-Titeln und Kundennamen ────────────
describe('K2 — Art. 17: voller Name in Deal-Titeln und Mandats-Kunden → „[gelöscht]“', () => {
  it('rein: nur der volle Name als ganzes Wort, idempotent; namensgleich → nur verknüpfte', async () => {
    const { crmNamenTilgen, crmNenntNamen, crmVerknuepft } = await import('../lib/crm/person-bestaende');
    const crm = { chancen: [deal('d-1', { titel: 'Beratung Tina Probemann (Q4)' }), deal('d-2', { titel: 'Tina Probemannsen' }), deal('d-3', { titel: 'Workshop' })], mandate: [mandat('m-1', { kunde: 'Tina Probemann' })] };
    const n = crmNamenTilgen(crm, 'Tina Probemann');
    expect(n.chancen.map(c => c.titel)).toEqual(['Beratung [gelöscht] (Q4)', 'Tina Probemannsen', 'Workshop']);
    expect(n.mandate[0].kunde).toBe('[gelöscht]');
    expect(crmNamenTilgen(n, 'Tina Probemann')).toBe(n);
    expect(crmNenntNamen(n, 'Tina Probemann')).toBe(false);
    const nur = crmVerknuepft({ chancen: [deal('d-1', { kontaktIds: ['c-t'] }), deal('d-2')], mandate: [] }, 'c-t');
    const g = crmNamenTilgen({ chancen: [deal('d-1', { titel: 'Tina Probemann A', kontaktIds: ['c-t'] }), deal('d-2', { titel: 'Tina Probemann B' })], mandate: [] }, 'Tina Probemann', nur);
    expect(g.chancen.map(c => c.titel)).toEqual(['[gelöscht] A', 'Tina Probemann B']);
  });
  it('personEntfernen (Speicher): Kennung UND Name weg — in Deal-Titel und Kunde', async () => {
    const { personEntfernen } = await import('../lib/crm/person-bestaende');
    await db.saveJson('kontakte', { kontakte: [k('c-t', { vorname: 'Tina', nachname: 'Probemann' }), k('c-u')] });
    await db.saveJson('crm', { ...speicher.leererBestand(), chancen: [deal('d-1', { titel: 'Beratung Tina Probemann', kontaktIds: ['c-t', 'c-u'] }), deal('d-2', { titel: 'Anderes' })], mandate: [mandat('m-1', { kunde: 'Tina Probemann', kontaktIds: ['c-t'] })] });
    await personEntfernen('c-t');
    const crm = await speicher.ladeCrm();
    expect(crm.chancen.map(c => c.titel)).toEqual(['Beratung [gelöscht]', 'Anderes']);
    expect(crm.chancen[0].kontaktIds).toEqual(['c-u']);
    expect(crm.mandate[0].kunde).toBe('[gelöscht]');
    expect(JSON.stringify(crm)).not.toContain('Probemann');
  });
});

// ── W1: tote firmaId gilt als leer ─────────────────────────────────────────
describe('W1 — Firmen abgleichen verknüpft tote Verweise neu', () => {
  it('rein: tote firmaId → per Namen (vorhanden oder neu); tote Hauptstation → neu verknüpft; andere Stationen bleiben', async () => {
    const { firmenAbgleich } = await import('../lib/crm/firmen');
    const f = [firma('f-alpha-1', { name: 'Alpha GmbH' })];
    const r = firmenAbgleich([
      k('c-1', { firma: 'Alpha', firmaId: 'f-weg-1' }),
      k('c-2', { firma: 'Neu AG', firmaId: 'f-weg-2' }),
      k('c-3', { firma: 'Alpha GmbH', firmaId: 'f-weg-3', stationen: [{ firmaId: 'f-weg-3', aktiv: true, haupt: true }, { firmaId: 'f-weg-4', aktiv: false, bis: '2025-01-01' }] }),
      k('c-4', { firma: 'Alpha GmbH', firmaId: 'f-alpha-1' }),
    ], f, J);
    expect(r.kontakte[0].firmaId).toBe('f-alpha-1');
    const neu = r.firmen.find(x => x.name === 'Neu AG')!;
    expect(r.kontakte[1].firmaId).toBe(neu.id);
    expect(r.kontakte[2].firmaId).toBe('f-alpha-1');
    expect(r.kontakte[2].stationen).toEqual([{ firmaId: 'f-alpha-1', aktiv: true, haupt: true }, { firmaId: 'f-weg-4', aktiv: false, bis: '2025-01-01' }]);
    expect(r.kontakte[3]).toEqual(k('c-4', { firma: 'Alpha GmbH', firmaId: 'f-alpha-1' }));
    expect(r.verknuepft).toBe(3);
  });
  it('firmenAbgleichen (Speicher): schreibt die neue Kennung, auch wenn schon eine (tote) dastand', async () => {
    const { firmenAbgleichen } = await import('../lib/crm/abgleich');
    await db.saveJson('kontakte', { kontakte: [k('c-1', { firma: 'Beta GmbH', firmaId: 'f-geloescht-1' })] });
    await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [firma('f-beta-1', { name: 'Beta' })] });
    const r = await firmenAbgleichen();
    expect(r.verknuepft).toBe(1);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte[0].firmaId).toBe('f-beta-1');
  });
});

// ── W4: Firmenwechsel aus der Masterliste → Konflikt; keine stille Dubletten-Grenze ─
describe('W4 — Import: andere Firma wird Konflikt „Firmenwechsel?“, nicht überschrieben', () => {
  it('Firmentext, Position und Firmenfelder bleiben; Konflikte tragen den Listenwert', async () => {
    const { zusammenfuehren, FIRMENWECHSEL_HINWEIS } = await import('../lib/make-one/crm');
    const alt = k('c-1', { firma: 'Alt GmbH', firmaId: 'f-alt-1', position: 'Leitung', firmaBranche: 'Handel' });
    const r = zusammenfuehren(alt, k('c-1', { firma: 'Neu AG', position: 'Geschäftsführung', firmaBranche: 'Bau', telefon: '+49 30 1234567' }), HEUTE);
    expect(r.kontakt.firma).toBe('Alt GmbH');
    expect(r.kontakt.firmaId).toBe('f-alt-1');
    expect(r.kontakt.position).toBe('Leitung');
    expect(r.kontakt.firmaBranche).toBe('Handel');
    expect(r.kontakt.telefon).toBe('+49 30 1234567');
    expect(r.konflikte).toEqual(expect.arrayContaining([
      { kontaktId: 'c-1', feld: 'firma', online: 'Alt GmbH', liste: 'Neu AG', hinweis: FIRMENWECHSEL_HINWEIS },
      { kontaktId: 'c-1', feld: 'position', online: 'Leitung', liste: 'Geschäftsführung', hinweis: FIRMENWECHSEL_HINWEIS },
    ]));
    // Dieselbe Firma in anderer Schreibweise: kein Konflikt, der Kartei-Text bleibt.
    const g = zusammenfuehren(alt, k('c-1', { firma: 'Alt' }), HEUTE);
    expect(g.konflikte).toEqual([]);
    expect(g.kontakt.firma).toBe('Alt GmbH');
  });
  it('mögliche Dubletten werden nie gekürzt (vorher still höchstens 300)', async () => {
    const { moeglicheDubletten } = await import('../lib/make-one/crm');
    const l = Array.from({ length: 400 }, (_, i) => [k(`c-a${i}`, { vorname: 'Gleich', nachname: `Name${i}x`, firma: `A${i}` }), k(`c-b${i}`, { vorname: 'Gleich', nachname: `Name${i}x`, firma: `B${i}` })]).flat();
    expect(moeglicheDubletten(l).length).toBe(400);
  });
});

// ── W6: Löschsperren und Event-Kaskade ────────────────────────────────────
describe('W6 — Löschen: Sperren für Produkte, Segmente, Beiträge, Ablage, Follow-ups; Events nur mit Kaskade', () => {
  const bestand = (): CrmBestand => ({
    ...speicher.leererBestand(),
    firmen: [firma('f-a')],
    chancen: [deal('d-1', { leistungId: 'l-1' })],
    mandate: [mandat('m-1', { leistungId: 'l-1' })],
    leistungen: [{ id: 'l-1', name: 'Begleitung', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'kdc', status: 'aktiv', geaendert: J } as unknown as CrmBestand['leistungen'][number], { id: 'l-2', name: 'Frei', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'kdc', status: 'aktiv', geaendert: J } as unknown as CrmBestand['leistungen'][number]],
    events: [{ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-10', status: 'geplant', segmentId: 'seg-1', geaendert: J } as CrmBestand['events'][number]],
    teilnahmen: [teilnahme('tn-1', 'ev-1', 'c-a'), teilnahme('tn-2', 'ev-1', 'c-b')],
    segmente: [{ id: 'seg-1', name: 'Kalt', kriterien: {}, geaendert: J } as CrmBestand['segmente'][number]],
    beitraege: [{ id: 'b-1', titel: 'Beitrag', kanal: 'linkedin', status: 'idee', wirkung: [], quellen: [], geaendert: J } as unknown as CrmBestand['beitraege'][number]],
    newsletter: [{ id: 'n-1', titel: 'N', status: 'entwurf', inhalt: '', beitragIds: ['b-1'], geaendert: J }],
    followups: [fu('fu-e', { bezug: { art: 'event', id: 'ev-1' } }), fu('fu-f', { bezug: { art: 'firma', id: 'f-a' } }), fu('fu-m', { bezug: { art: 'mandat', id: 'm-1' }, status: 'erledigt' })],
  });
  it('Produkt mit Deal/Mandat → Sperre mit Rat „eingestellt“; freies Produkt geht', async () => {
    const { loeschSperren } = await import('../lib/crm/crm-stand');
    const s = loeschSperren(bestand(), [{ liste: 'leistungen', op: 'delete', id: 'l-1' }, { liste: 'leistungen', op: 'delete', id: 'l-2' }]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ liste: 'leistungen', id: 'l-1', anzahl: { deals: 1, mandate: 1 } });
    expect(s[0].text).toContain('eingestellt');
  });
  it('Segment in Event, Beitrag im Newsletter → Sperre; Firma zählt Ablage-Einträge und offene Follow-ups', async () => {
    const { loeschSperren } = await import('../lib/crm/crm-stand');
    const s = loeschSperren(bestand(), [{ liste: 'segmente', op: 'delete', id: 'seg-1' }, { liste: 'beitraege', op: 'delete', id: 'b-1' }, { liste: 'firmen', op: 'delete', id: 'f-a' }, { liste: 'mandate', op: 'delete', id: 'm-1' }],
      { kontakte: [], rechnungen: [], dateien: [{ firmaId: 'f-a' }, { mandatId: 'm-1' }] });
    expect(s.map(x => [x.liste, x.id])).toEqual([['segmente', 'seg-1'], ['beitraege', 'b-1'], ['firmen', 'f-a'], ['mandate', 'm-1']]);
    expect(s[2].anzahl).toMatchObject({ dateien: 1, followups: 1 });
    expect(s[3].anzahl).toMatchObject({ dateien: 1 });
    expect(s[3].anzahl.followups).toBeUndefined(); // erledigtes Follow-up zählt nicht
    expect(s.map(x => x.text).join(' ')).not.toMatch(/Stammtisch|c-a/);
  });
  it('Event: allein gelöscht → Sperre; mit Kaskade im selben Satz → frei; Kaskade entfernt Teilnahmen, sagt offene Follow-ups ab', async () => {
    const { loeschSperren, loeschKaskade } = await import('../lib/crm/crm-stand');
    const b = bestand();
    const ops = [{ liste: 'events', op: 'delete' as const, id: 'ev-1' }];
    expect(loeschSperren(b, ops)[0]).toMatchObject({ liste: 'events', anzahl: { teilnahmen: 2, followups: 1 } });
    const k2 = loeschKaskade(b, ops, J);
    expect(k2).toEqual([
      { liste: 'teilnahmen', op: 'delete', id: 'tn-1' }, { liste: 'teilnahmen', op: 'delete', id: 'tn-2' },
      { liste: 'followups', op: 'teil', id: 'fu-e', felder: { status: 'abgesagt', notiz: 'Abgesagt: Event „Stammtisch“ gelöscht.', geaendert: J } },
    ]);
    expect(loeschSperren(b, [...ops, ...k2])).toEqual([]);
  });
  it('Serverweg POST /api/crm/events { aktion: loeschen }: alles in einer Änderung', async () => {
    // Endgültig nur aus dem Papierkorb (04.10., lib/crm/ablage.ts) — das Event liegt dort.
    await db.saveJson('crm', { ...bestand(), events: bestand().events.map(e => (e.id === 'ev-1' ? { ...e, geloeschtAm: J } : e)) });
    const route = await import('@/app/api/crm/events/route');
    const r = await route.POST(post('/api/crm/events', { aktion: 'loeschen', eventId: 'ev-1' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, teilnahmen: 2, abgesagt: 1 });
    const crm = await speicher.ladeCrm();
    expect(crm.events).toEqual([]);
    expect(crm.teilnahmen).toEqual([]);
    expect(crm.followups.find(f => f.id === 'fu-e')).toMatchObject({ status: 'abgesagt' });
    // Der alte Weg über den Bestand (nur das Event) wird jetzt abgelehnt, solange Teilnahmen da sind.
    await db.saveJson('crm', bestand());
    const bestandRoute = await import('@/app/api/crm/bestand/route');
    const p = await bestandRoute.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: dienst(), body: JSON.stringify({ ops: [{ liste: 'events', op: 'delete', id: 'ev-1' }] }) }));
    expect(p.status).toBe(409);
    expect((await speicher.ladeCrm()).events).toHaveLength(1);
  });
});

// ── W8: Datenschutz-Kette ─────────────────────────────────────────────────
describe('W8 — Werbesperre, Art. 18 und voller Nachweis', () => {
  it('Fällig-Liste: werbliche Follow-ups an Personen mit Werbesperre fallen heraus (mit Zähler), Vertrag/Deal bleibt', async () => {
    const { faellige, werbesperreHinweis } = await import('../lib/crm/followup');
    const kontakte = [k('c-a', { werbesperre: { seit: HEUTE, grund: 'Widerspruch' } }), k('c-b')];
    const crm = { ...speicher.leererBestand(), chancen: [deal('d-1', { stufe: 'angebot' })], followups: [fu('fu-1'), fu('fu-2', { art: 'anruf' }), fu('fu-3', { bezug: { art: 'chance', id: 'd-1' } }), fu('fu-4', { art: 'termin' }), fu('fu-5', { kontaktId: 'c-b', bezug: { art: 'kontakt', id: 'c-b' } })] };
    let gesperrt = 0;
    const l = faellige(kontakte, crm, HEUTE, { beiSperre: () => { gesperrt++; } });
    expect(l.filter(x => !x.virtuell).map(x => x.id).sort()).toEqual(['fu-3', 'fu-4', 'fu-5']);
    expect(gesperrt).toBe(2);
    expect(werbesperreHinweis(2)).toContain('Werbesperre');
  });
  it('Netzwerk: Art. 18 → 409; Werbesperre → keine Anfrage und kein „Ja“; „Ja“ sonst mit vollem Nachweis; CSV > 5 MB → 413', async () => {
    await db.saveJson('kontakte', { kontakte: [
      k('c-eins', { linkedin: 'https://www.linkedin.com/in/probe-e', eingeschraenkt: { seit: HEUTE, grund: 'Antrag', von: 'kevin' } }),
      k('c-werb', { linkedin: 'https://www.linkedin.com/in/probe-w', werbesperre: { seit: HEUTE, grund: 'Widerspruch' }, netzwerk: { kevin: { status: 'vernetzt', vernetztAm: HEUTE } } as Kontakt['netzwerk'] }),
      k('c-ja1', { linkedin: 'https://www.linkedin.com/in/probe-j', netzwerk: { kevin: { status: 'vernetzt', vernetztAm: HEUTE } } as Kontakt['netzwerk'] }),
    ] });
    await db.saveJson('crm', speicher.leererBestand());
    const nw = await import('@/app/api/crm/netzwerk/route');
    expect((await nw.POST(post('/api/crm/netzwerk', { aktion: 'nicht_gefunden', id: 'c-eins' }))).status).toBe(409);
    expect((await nw.POST(post('/api/crm/netzwerk', { aktion: 'angefragt', id: 'c-werb' }))).status).toBe(409);
    expect((await nw.POST(post('/api/crm/netzwerk', { aktion: 'antwort', art: 'ja', id: 'c-werb' }))).status).toBe(409);
    const vorher = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(vorher.find(x => x.id === 'c-eins')!.linkedinNichtGefunden).toBeUndefined();
    const r = await nw.POST(post('/api/crm/netzwerk', { aktion: 'antwort', art: 'ja', id: 'c-ja1', wortlaut: 'Darf ich Ihnen schreiben? — Ja, gern' }));
    expect(r.status).toBe(200);
    const ew = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-ja1')!.einwilligungen!;
    expect(ew).toHaveLength(1);
    expect(ew[0]).toMatchObject({ kanal: 'social', grundlage: 'einwilligung', wortlaut: 'Darf ich Ihnen schreiben? — Ja, gern', erfasstVon: 'kevin', erteiltAm: expect.any(String) });
    expect(ew[0].belegRef).toMatch(/^LinkedIn-Nachricht vom \d{4}-\d{2}-\d{2}/);
    expect(ew[0].zeitpunkt).toMatch(/T/);
    const gross = await nw.POST(post('/api/crm/netzwerk', { aktion: 'import', csv: 'x'.repeat(5_000_001) }));
    expect(gross.status).toBe(413);
  });
  it('Follow-up-Route: Art. 18 → 409 beim Anlegen und Verschieben; geaendertAm ist ein Berliner Tag', async () => {
    const { localDay } = await import('../lib/zeit');
    await db.saveJson('kontakte', { kontakte: [
      k('c-e', { eingeschraenkt: { seit: HEUTE, grund: 'Antrag', von: 'kevin' }, naechsterSchritt: { text: 'Anrufen', datum: localDay() } }),
      k('c-s', { naechsterSchritt: { text: 'Anrufen', datum: localDay() } }),
    ] });
    await db.saveJson('crm', speicher.leererBestand());
    const fuRoute = await import('@/app/api/crm/followup/route');
    expect((await fuRoute.POST(post('/api/crm/followup', { aktion: 'anlegen', kontaktId: 'c-e', text: 'x', faellig: '2030-01-01' }))).status).toBe(409);
    expect((await fuRoute.POST(post('/api/crm/followup', { aktion: 'verschieben', id: 'v:schritt:c-e', tage: 3 }))).status).toBe(409);
    expect((await fuRoute.POST(post('/api/crm/followup', { aktion: 'verschieben', id: 'v:schritt:c-s', tage: 3 }))).status).toBe(200);
    const s = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-s')!;
    expect(s.geaendertAm).toBe(localDay());
    expect(s.geaendertAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── W10: Beleg einer Einwilligung ist nicht löschbar ─────────────────────
describe('W10 — Datei als Beleg einer Einwilligung', () => {
  it('rein: zählt Einwilligungen mit dieser Kennung (auch widerrufene), nicht Teil einer längeren', async () => {
    const { einwilligungenMitBeleg, einwilligungBelegTot } = await import('../lib/dateien/einwilligung-beleg');
    const kontakte = [
      k('c-1', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'x', belegRef: 'd-beleg-1', widerrufenAm: HEUTE }] }),
      k('c-2', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'x', belegRef: 'Formular d-beleg-12' }] }),
    ];
    expect(einwilligungenMitBeleg(kontakte, 'd-beleg-1')).toEqual({ anzahl: 1, kontaktIds: ['c-1'] });
    expect(einwilligungBelegTot(kontakte, new Set(['d-beleg-1']))).toEqual(['c-2']);
  });
  it('Ablage: entfernen → 409 mit Grund, Eintrag bleibt; ohne Einwilligung geht es', async () => {
    const { ablegen, entfernen, ablageListe, AblageFehler } = await import('../lib/dateien/ablage');
    const pdf = new TextEncoder().encode('%PDF-1.4\n% Probe\n%%EOF\n');
    const a = await ablegen('probe-haus', 'kevin', { art: 'sonstig', kontaktId: 'c-1' }, { bytes: Buffer.from(pdf), name: 'einwilligung.pdf', typ: 'application/pdf' });
    const b = await ablegen('probe-haus', 'kevin', { art: 'sonstig', kontaktId: 'c-1' }, { bytes: Buffer.from(pdf), name: 'frei.pdf', typ: 'application/pdf' });
    await db.saveJson('kontakte', { kontakte: [k('c-1', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'Formular', wortlaut: 'Ja', belegRef: a.id }] })] });
    await expect(entfernen('probe-haus', a.id)).rejects.toBeInstanceOf(AblageFehler);
    await expect(entfernen('probe-haus', a.id)).rejects.toMatchObject({ status: 409 });
    expect((await ablageListe('probe-haus')).map(e => e.id)).toContain(a.id);
    expect(await entfernen('probe-haus', b.id)).toBe(true);
  });
});

// ── Kleines: ZOE setze_kunde, Kampagne ohne 40er-Grenze, Lead-Notiz, Dateiliste ─
describe('Kleines — nie abschneiden, kein Teilstring-Treffer', () => {
  it('mandatTreffer: exakt (Rechtsform egal) oder Kennung; mehrere/ähnliche → Rückfrage', async () => {
    const { mandatTreffer } = await import('../lib/crm/mandat-treffer');
    const l = [mandat('m-1', { kunde: 'Beispiel AG' }), mandat('m-2', { kunde: 'Beispielbau GmbH' }), mandat('m-3', { kunde: 'Zwilling' }), mandat('m-4', { kunde: 'Zwilling GmbH' }), mandat('m-5', { kunde: 'Alt', status: 'beendet' })];
    expect(mandatTreffer(l, { name: 'beispiel' })).toMatchObject({ art: 'treffer', mandat: { id: 'm-1' } });
    expect(mandatTreffer(l, { name: 'Beisp' })).toMatchObject({ art: 'aehnlich' });
    expect(mandatTreffer(l, { name: 'Zwilling' })).toMatchObject({ art: 'mehrdeutig' });
    expect(mandatTreffer(l, { name: 'Alt' })).toEqual({ art: 'keiner' });
    expect(mandatTreffer(l, { id: 'm-2' })).toMatchObject({ art: 'treffer', mandat: { id: 'm-2' } });
  });
  it('ZOE setze_kunde: Teilstring schreibt nicht; exakter Name ändert über den Mandat-Weg; neu nur ohne Treffer', async () => {
    const { WERKZEUGE } = await import('../lib/zoe/werkzeuge');
    await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat('m-1', { kunde: 'Beispiel AG' }), mandat('m-2', { kunde: 'Beispielbau GmbH' })] });
    const r1 = await WERKZEUGE.setze_kunde.lauf({ name: 'Beisp', cashflow: 999 }, 'http://test', 'kevin');
    expect(r1).toMatch(/^Nicht ausgeführt: Kein Mandat heißt genau/);
    expect((await speicher.ladeCrm()).mandate.map(m => m.honorar.betrag)).toEqual([2500, 2500]);
    const r2 = await WERKZEUGE.setze_kunde.lauf({ name: 'beispiel ag', cashflow: 3000, status: 'ruht' }, 'http://test', 'kevin');
    expect(r2).toMatch(/^Erfasst: Beispiel AG aktualisiert/);
    const m = (await speicher.ladeCrm()).mandate;
    expect(m[0]).toMatchObject({ status: 'pausiert', honorar: { betrag: 3000, basis: 'monat' } });
    expect(m[1].honorar.betrag).toBe(2500);
    expect(await WERKZEUGE.setze_kunde.lauf({ name: 'Ganz Neu GmbH' }, 'http://test', 'kevin')).toMatch(/als Mandat angelegt/);
    expect((await speicher.ladeCrm()).mandate.map(x => x.kunde)).toContain('Ganz Neu GmbH');
  });
  it('Kampagne übernimmt die ganze Zielgruppe (vorher still höchstens 40)', async () => {
    const { planen, zielgruppe, PLAYBOOKS } = await import('../lib/crm/kampagnen');
    const pb = { ...PLAYBOOKS[0], zielgruppe: {}, zusatz: undefined };
    const kontakte = Array.from({ length: 60 }, (_, i) => k(`c-z${i}`));
    const alle = zielgruppe(kontakte, speicher.leererBestand(), pb, HEUTE).length;
    expect(alle).toBeGreaterThan(40);
    expect(planen(pb, kontakte, speicher.leererBestand(), HEUTE, 'kp-1').kontaktIds.length).toBe(alle);
  });
  it('Lead-Notiz: anhängen, solange es passt — sonst unverändert mit Hinweis', async () => {
    const { notizAnhaengen, LEAD_NOTIZ_MAX } = await import('../lib/crm/notiz-anhaengen');
    expect(notizAnhaengen('alt', 'neu')).toEqual({ ok: true, notiz: 'alt\nneu' });
    expect(notizAnhaengen('alt\nneu', 'neu')).toEqual({ ok: true, notiz: 'alt\nneu' });
    const voll = 'x'.repeat(LEAD_NOTIZ_MAX - 2);
    const r = notizAnhaengen(voll, 'Interesse aus Kampagne');
    expect(r.ok).toBe(false);
    expect(r.notiz).toBe(voll);
  });
  it('Dateiliste: alle Einträge (vorher nur die letzten 500)', async () => {
    const eintraege = Array.from({ length: 650 }, (_, i) => ({ id: `d-liste-${String(i).padStart(4, '0')}`, art: 'sonstig', kontaktId: 'c-1', hochgeladenAm: J, hochgeladenVon: 'kevin' }));
    await db.saveJson('crm-dateien--probe-haus', { eintraege });
    const route = await import('@/app/api/crm/dateien/route');
    const d = await (await route.GET(new Request('http://test/api/crm/dateien', { headers: dienst() }))).json();
    expect(d.eintraege).toHaveLength(650);
    expect(d.anzahl).toBe(650);
  });
});
