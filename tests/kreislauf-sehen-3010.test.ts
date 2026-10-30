// ─── Kreislauf sehen (30.10., Kreislauf Geld & Lieferung Paket 5) ──────────────────────────────────────────────────────────────────────────────────
// 1 Zeitleiste je Kunde (rein) · 2 Tageszahlen bei „Automationen & Head“ (rein + Route, Sicht Business bekommt nichts aus Privat) · 3 Heute-Zeile mit
// Probeläufen getrennt · 4 Fallzahlen der Werkstatt-Prozesse auf der Landkarte · 5 Vorschläge der Inbox im Register. Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { ordner } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kreislauf-sehen-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kreislauf-sehen' });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return { ordner };
});
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Angebot, Mandat } from '@/lib/crm/typen';
import { kundenZeitleiste } from '@/lib/crm/kunden-zeitleiste';
import { kreislaufHeute, werkstattFallZahl, KREISLAUF_WERKZEUGE } from '@/lib/prozesse/kreislauf-heute';
import { heuteSatz } from '@/lib/prozesse/laeufe-ansicht';
import { heuteZeile } from '@/lib/prozesse/lauf-regeln';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { KreislaufHeuteAnsicht } from '@/components/os/werkzeug/KreislaufHeute';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';

const J = '2026-08-01T10:00:00.000Z';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const angebot = (x: Partial<Angebot>): Angebot => ({ id: 'ang-1', gesellschaft: 'ug', titel: 'Angebot', positionen: [], einleitung: '', schluss: '', gueltigBis: '2026-09-01', zahlungszielTage: 14, status: 'angenommen', version: 1, angelegt: J, ...x } as Angebot);
const lauf = (x: Partial<ProzessLauf>): ProzessLauf => ({ id: 'pl-00000000-0000-4000-8000-000000000001', prozessId: 'pz-1', version: 1, fall: { art: 'mandat', id: 'm-1' }, bereich: 'fulfillment', schluessel: 'x', durchgang: 1, modus: 'scharf', status: 'wartet', person: 'pia', ausloeser: { art: 'produkt' }, tiefe: 0, daten: {}, start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0, ...x } as ProzessLauf);

describe('1 · Zeitleiste je Kunde', () => {
  const raten = mandat('m-raten', { chanceId: 'ch-1', honorar: { betrag: 3000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-09-01', ende: '2026-11-30', raten: { anzahl: 3, abstandMonate: 1 } });
  const heute = '2026-10-15';
  it('Angebot → Mandat → Raten → Fall; der Satz nennt den fälligen Entwurf; „hier“ steht auf Rate 2', () => {
    const zl = kundenZeitleiste({
      mandat: raten, heute, fall: { phase: 'Diagnose', phaseNr: 2, phasenAnzahl: 5 },
      angebote: [angebot({ dealId: 'ch-1', nummer: 'X-A-2026-0001', angenommenAm: '2026-08-20T09:00:00.000Z' }), angebot({ id: 'ang-alt', dealId: 'ch-1', status: 'ersetzt' }), angebot({ id: 'ang-fremd', dealId: 'ch-9' })],
      rechnungen: [
        { id: 'r1', status: 'bezahlt', mandatId: 'm-raten', leistungVon: '2026-09-01', bezahltAm: '2026-09-20' },
        { id: 'r2', status: 'geplant', mandatId: 'm-raten', leistungVon: '2026-10-01', positionen: [{ id: 'p1' }] as never },
      ],
    });
    expect(zl.punkte.map(p => p.art)).toEqual(['angebot', 'mandat', 'rechnung', 'rechnung', 'rechnung', 'fall']);
    expect(zl.punkte.map(p => p.titel)).toEqual(['Angebot X-A-2026-0001', 'Mandat', 'Rate 1 von 3', 'Rate 2 von 3', 'Rate 3 von 3', 'Fulfillment']);
    expect(zl.punkte.map(p => p.stand)).toEqual(['erledigt', 'erledigt', 'erledigt', 'achtung', 'offen', 'jetzt']);
    expect(zl.hier).toBe(3);
    expect(zl.satz).toBe('Fulfillment: Diagnose · Rate 2 von 3 fällig — der Entwurf liegt bereit, prüfen & stellen.');
    expect(zl.punkte[3].href).toContain('r2');
    expect(zl.satz).not.toMatch(/\d+,\d{2}|€|Muster/); // keine Beträge, keine Namen
  });
  it('überfällig geht vor; fällig ohne Entwurf nennt den Morgenlauf', () => {
    const ueber = kundenZeitleiste({ mandat: raten, heute, rechnungen: [{ id: 'r1', status: 'gestellt', mandatId: 'm-raten', leistungVon: '2026-09-01', faellig: '2026-09-30' }] });
    expect(ueber.satz).toBe('Mandat aktiv · Rate 1 von 3 überfällig seit 30.09.2026 — Mahnung prüfen.');
    const fehlt = kundenZeitleiste({ mandat: raten, heute, rechnungen: [{ id: 'r1', status: 'bezahlt', mandatId: 'm-raten', leistungVon: '2026-09-01' }] });
    expect(fehlt.satz).toMatch(/^Mandat aktiv · Rate 2 von 3 fällig — noch kein Entwurf/);
  });
  it('Monatshonorar: alte Monate ohne Rechnung bleiben weg (Altbestand), der Vormonat zählt', () => {
    const m = mandat('m-monat', { start: '2026-03-01' });
    const zl = kundenZeitleiste({ mandat: m, heute, rechnungen: [{ id: 'r-jul', status: 'bezahlt', mandatId: 'm-monat', leistungVon: '2026-07-01' }] });
    expect(zl.punkte.filter(p => p.art === 'rechnung').map(p => p.titel)).toEqual(['Juli 2026', 'September 2026', 'Oktober 2026', 'November 2026']);
    expect(zl.satz).toMatch(/September 2026 fällig — noch kein Entwurf/);
  });
});

describe('2 · Tageszahlen — rein: Privat zählt nie, Null erscheint nie, „ersetzt durch“', () => {
  const heute = '2026-10-30';
  const jetzt = '2026-10-30T09:00:00.000Z';
  it('nur Business, nur heute', () => {
    const z = kreislaufHeute({
      heute,
      mandatAuto: { 'm-ug': { am: jetzt }, 'm-kdc': { am: jetzt }, 'm-gestern': { am: '2026-10-29T09:00:00.000Z' }, 'm-zurueck': { am: jetzt, zurueckAm: jetzt } },
      mandatBusiness: id => id !== 'm-kdc',
      tasks: [
        { id: 'rv-m-ug-2026-10', space: 'business', createdAt: jetzt }, { id: 'rv-m-kdc-2026-10', space: 'privat', createdAt: jetzt },
        { id: 'mahn-r1-1', space: 'business', createdAt: jetzt },
        { id: 'mahn-r0-2', space: 'business', status: 'done', createdAt: '2026-10-01T09:00:00.000Z', verlauf: [{ am: jetzt, was: 'status', durch: 'system' }] },
        { id: 'mahn-r9-1', space: 'business', status: 'done', createdAt: '2026-10-01T09:00:00.000Z', verlauf: [{ am: jetzt, was: 'status' }] },
      ],
      ereignisse: [{ art: 'fall-abgeschlossen', stufe: 'mandatsende', bereich: 'business', am: jetzt }, { art: 'fall-abgeschlossen', stufe: 'mandatsende', bereich: 'privat', am: jetzt }, { art: 'fall-abgeschlossen', stufe: 'hand', bereich: 'business', am: jetzt }],
      laeufe: [lauf({ start: jetzt }), lauf({ start: jetzt, fall: { art: 'mandat', id: 'm-kdc' } }), lauf({ modus: 'schatten', start: jetzt }), lauf({ start: J, ende: jetzt, status: 'fertig' })],
      verborgen: new Set(['m-kdc']),
      ersetzt: { 'mahn-neu': { prozessId: 'pz-mahn', titel: 'Mahnaufgaben (überführt)' } },
    });
    expect(Object.fromEntries(z.map(x => [x.art, x.wert]))).toEqual({ mandate: 1, entwuerfe: 1, 'mahn-neu': 1, 'mahn-zu': 1, faelle: 1, 'laeufe-gestartet': 1, 'laeufe-beendet': 1, probelaeufe: 1 });
    expect(z.find(x => x.art === 'mahn-neu')?.ersetzt).toMatchObject({ titel: 'Mahnaufgaben (überführt)' });
    expect(z.find(x => x.art === 'mahn-neu')?.ersetzt?.href).toContain('pz-mahn');
    expect(kreislaufHeute({ heute, mandatBusiness: () => true, tasks: [], ereignisse: [], laeufe: [] })).toEqual([]);
    const html = renderToStaticMarkup(h(KreislaufHeuteAnsicht, { zeilen: z }));
    expect(html).toContain('ersetzt durch Mahnaufgaben (überführt)');
    expect(renderToStaticMarkup(h(KreislaufHeuteAnsicht, { zeilen: [] }))).toContain('noch nichts von selbst getan');
    expect(KREISLAUF_WERKZEUGE).toContain('produkte-mandate');
  });
});

describe('3 · Heute-Zeile zählt Probeläufe getrennt', () => {
  it('heuteZeile + heuteSatz', () => {
    const jetzt = new Date().toISOString();
    const schritt = { knoten: 'k', ab: jetzt, bis: jetzt } as never;
    const d: LaeufeDatei = { v: 1, laeufe: [lauf({ geaendert: jetzt, schritte: [schritt] }), lauf({ modus: 'schatten', geaendert: jetzt, schritte: [schritt] })], zurueckgehalten: [], prozesse: {} };
    const z = heuteZeile(d, 'pia', jetzt);
    expect(z).toMatchObject({ gelaufen: 1, probe: 1 });
    expect(heuteSatz(z)).toBe('Prozesse heute: 1 gelaufen, 1 Probelauf (Schatten)');
    expect(heuteSatz({ gelaufen: 0, aufDich: 0, probe: 2 })).toBe('Prozesse heute: 2 Probeläufe (Schatten)');
    expect(heuteSatz({ gelaufen: 0, aufDich: 0 })).toBeNull();
  });
});

describe('4 · Landkarte: Fallzahlen der Werkstatt-Prozesse', () => {
  it('offen · wartet · fertig 30 Tage, nur scharf, verborgene Mandate zählen nicht', () => {
    const l = [
      lauf({ prozessId: 'pz-a', status: 'wartet' }), lauf({ prozessId: 'pz-a', status: 'laeuft' }), lauf({ prozessId: 'pz-a', status: 'fertig', ende: '2026-10-20T10:00:00.000Z' }),
      lauf({ prozessId: 'pz-a', status: 'fertig', ende: '2026-08-01T10:00:00.000Z' }), lauf({ prozessId: 'pz-a', modus: 'schatten', status: 'wartet' }),
      lauf({ prozessId: 'pz-a', status: 'wartet', fall: { art: 'mandat', id: 'm-kdc' } }), lauf({ prozessId: 'pz-b', status: 'fertig', ende: '2026-10-29T10:00:00.000Z' }),
    ];
    expect(werkstattFallZahl(l, 'pz-a', '2026-10-30', new Set(['m-kdc']))).toMatchObject({ wert: 2, wort: 'offen · 1 wartet', zweite: { wert: 1, wort: 'fertig (30 Tage)' } });
    expect(werkstattFallZahl(l, 'pz-b', '2026-10-30')).toMatchObject({ wert: 1, wort: 'fertig (30 Tage)' });
    expect(werkstattFallZahl(l, 'pz-c', '2026-10-30')).toBeNull();
  });
});

describe('5 · Register: die Vorschläge der Inbox stehen im Anfrage-Eingang', () => {
  it('sp-anfrage trägt die Phase „Vorschläge im Gespräch“', () => {
    const p = SYSTEM_PROZESSE.find(x => x.id === 'sp-anfrage')!;
    const ph = p.phasen.find(x => x.id === 'vorschlaege');
    expect(ph?.schritte.map(s => s.titel)).toEqual(['Nachfassen vorschlagen', 'Aufgabe aus einer Frist', 'Termin vorschlagen', 'Beleg ablegen', 'Deal nachfassen planen']);
  });
});

describe('2 · Route GET /api/prozesse/laeufe?kreislauf=1 — Sicht Business bekommt nichts aus Privat', () => {
  const H = 'haus-ks';
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: H, ...extra });
  const sitzung = (person: string) => ({ 'x-make-user': person });
  const holen = async (person: string, suche: string) => {
    const { GET } = await import('@/app/api/prozesse/laeufe/route');
    const r = await GET(new Request(`http://test/api/prozesse/laeufe${suche}`, { headers: sitzung(person) }));
    return { status: r.status, text: await r.text() };
  };
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const jetzt = new Date().toISOString();
    await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber'), konto('k2', 'bea', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    const { leererBestand } = await import('@/lib/crm/speicher');
    await db.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-ug'), mandat('m-kdc', { gesellschaft: 'kdc' })] });
    await db.saveJson('kontakte', { kontakte: [] });
    const task = (id: string, space: 'business' | 'privat', spaceId: string) => ({ id, title: 'Rechnung prüfen & stellen', status: 'todo', priority: 'medium', assignee: 'both', tags: ['rechnung'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space, spaceId });
    await db.saveJson('tasks', { tasks: [task('rv-m-ug-2026-10', 'business', 'ug'), task('rv-m-kdc-2026-10', 'privat', 'kdc')], projects: [] });
    await db.saveJson('rechnungswesen', { kreislauf: { mandatAuto: { 'm-ug': { angebotId: 'ang-1', am: jetzt, posten: [] }, 'm-kdc': { angebotId: 'ang-2', am: jetzt, posten: [] } } } });
    const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
    const { prozesseHaushalt } = await import('@/lib/prozesse/werkstatt-server');
    await db.saveJson(laeufeBestand(await prozesseHaushalt()), { v: 1, laeufe: [
      lauf({ id: 'pl-00000000-0000-4000-8000-0000000000a1', start: jetzt, fall: { art: 'mandat', id: 'm-ug' } }),
      lauf({ id: 'pl-00000000-0000-4000-8000-0000000000a2', start: jetzt, fall: { art: 'mandat', id: 'm-kdc' } }),
      lauf({ id: 'pl-00000000-0000-4000-8000-0000000000a3', start: jetzt, modus: 'schatten', fall: { art: 'mandat', id: 'm-ug' } }),
    ], zurueckgehalten: [], prozesse: {} });
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

  it('Sicht Privat → 403', async () => {
    expect((await holen('pia', '?kreislauf=1&space=privat')).status).toBe(403);
  });
  it('Inhaber: Business-Zahlen; Konto „nur Business“: ohne Läufe zu Privat-Mandaten; nie Kennungen privater Mandate in der Antwort', async () => {
    const zahl = (t: string) => Object.fromEntries((JSON.parse(t) as { kreislauf: { art: string; wert: number }[] }).kreislauf.map(x => [x.art, x.wert]));
    const pia = await holen('pia', '?kreislauf=1&space=business');
    expect(pia.status).toBe(200);
    expect(zahl(pia.text)).toMatchObject({ mandate: 1, entwuerfe: 1, probelaeufe: 1, 'laeufe-gestartet': 2 });
    const bea = await holen('bea', '?kreislauf=1&space=business');
    expect(bea.status).toBe(200);
    expect(zahl(bea.text)).toMatchObject({ mandate: 1, entwuerfe: 1, probelaeufe: 1, 'laeufe-gestartet': 1 });
    for (const t of [pia.text, bea.text]) expect(t).not.toContain('kdc');
  });
});
