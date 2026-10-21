// ─── Angebote · Titel aus den Produkten, Deal-Rückfrage, keine doppelte Position, Lieferumfang beim Schließen (21.10., Rundgang 19.10.) ──────────────
// A1   Ein Angebot, das nur ein anderes Produkt enthält als der Deal, hieß nach dem alten Deal („Vertriebsaufbau …“) — Mandat, Fall und Rechnung erbten den
//      Titel. Jetzt: Titel aus dem Hauptprodukt (sonst erste Position) + Firma; von Hand geschrieben bleibt; der Deal-Titel zieht beim Annehmen nur nach,
//      wenn er automatisch entstand. Bestehende Daten bleiben, wie sie sind.
// B9   Das Angebot übernahm still den offenen Deal mit einem anderen Produkt — jetzt „Zu diesem Deal (<Produkt>) oder neuer Deal?“ (Tool + 409 beim Stellen).
// B5   Eine nachträglich angehakte Option verdoppelte die Hauptposition — jetzt kommt nur die Option dazu.
// (B9neu Lieferumfang beim Schließen: tests/produkt-lieferumfang-schliessen.test.ts)
// Alle Daten erfunden (@example.invalid), eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Angebot, AngebotPosition, Chance, CrmBestand, Leistung, PreisTeil } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '@/components/os/crm/daten';
import type { AngebotDaten, AngebotMitStand } from '@/components/os/crm/angebot/angebot-daten';
import { titelKern, titelNurProdukt, produktTitel } from '@/lib/crm/titel-regel';
import {
  angebotTitelAus, angebotTitelAutomatisch, angebotTitelFuerFolge, dealTitelNachAngebot, dealProduktAnders, dealFrageText, mandatVorbelegung,
  gleichePosition, positionenErgaenzen, positionSaeubern, entwurfSaeubern,
} from '@/lib/crm/angebote';
import { angebotPositionenAusProdukt } from '@/lib/crm/produkt-karte';
import { localDay } from '@/lib/zeit';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-angebot-titel-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-angebot-titel';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-den-angebot-titel-test';

const J = '2026-10-01T10:00:00.000Z';
const FIRMA = 'Atlas Beispiel GmbH';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'pauschal netto' }, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', angebot: { leistungstext: 'Erfundener Leistungstext.' }, geaendert: J, ...x } as Leistung);
const VA = leistung({ id: 'l-va', name: 'Vertriebsaufbau', preise: [teil({ id: 'pt-va', art: 'monatlich', betragCent: 300_000 })], vertrag: { mindestlaufzeitMonate: 6 } });
const WS = leistung({ id: 'l-ws', name: 'Strategie-Workshop', typ: 'workshop', preise: [teil({ id: 'pt-ws', art: 'fest', betragCent: 240_000 }), teil({ id: 'pt-event', art: 'je_einheit', betragCent: 90_000, einheit: 'je Event', rolle: 'option' })] });
const KATALOG = [VA, WS];
const pos = (x: Partial<AngebotPosition>): AngebotPosition => ({ id: 'p1', titel: 'Position', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 100_000, ustSatz: 19, basis: 'einmalig', ...x });
const deal = (x: Partial<Chance>): Chance => ({ id: 'ch-va', titel: 'Vertriebsaufbau Atlas Beispiel', kontaktIds: ['c-tobi1'], firmaId: 'f-atlas', art: 'retainer', leistungId: 'l-va', wert: { betrag: 3000, basis: 'monat' }, stufe: 'diagnose', historie: [{ stufe: 'diagnose', am: J, von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdv', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as Chance);

// ── A1 · Titel (rein) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('A1 · Titel: wann ein Titel automatisch ist', () => {
  it('Kern ohne Firma (mit oder ohne Rechtsform, vorne oder hinten) und Trenner', () => {
    expect(titelKern('Vertriebsaufbau Atlas Beispiel', FIRMA)).toBe('vertriebsaufbau');
    expect(titelKern('Atlas Beispiel GmbH · Retainer', FIRMA)).toBe('retainer');
    expect(titelKern('Atlas Beispiel GmbH', FIRMA)).toBe('');
    // Nur ein ganzes Stück mit Trenner — „Atlas“ in „Atlasprojekt“ bleibt.
    expect(titelKern('Atlasprojekt', 'Atlas')).toBe('atlasprojekt');
  });
  it('nur das Produkt (oder das Art-Wort) = automatisch; alles andere ist von Hand', () => {
    expect(titelNurProdukt('Vertriebsaufbau Atlas Beispiel', { firma: FIRMA, produkte: ['Vertriebsaufbau'] })).toBe(true);
    expect(titelNurProdukt('Atlas Beispiel GmbH · Retainer', { firma: FIRMA, produkte: [], art: 'retainer' })).toBe(true);
    expect(titelNurProdukt('', { produkte: [] })).toBe(true);
    expect(titelNurProdukt('Vertriebsaufbau Phase 2 mit der Geschäftsführung', { firma: FIRMA, produkte: ['Vertriebsaufbau'] })).toBe(false);
    expect(titelNurProdukt('Vertriebsaufbau Atlas Beispiel', { firma: FIRMA, produkte: ['Strategie-Workshop'] })).toBe(false);
  });
  it('Titel des Angebots: Hauptprodukt (laufend vor einmalig, kein Zusatzmodul) + Firma; sonst die erste Position; ohne Position leer', () => {
    expect(angebotTitelAus({ positionen: [pos({ leistungId: 'l-ws', titel: 'Strategie-Workshop' })] }, KATALOG, FIRMA)).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    expect(angebotTitelAus({ positionen: [pos({ leistungId: 'l-ws' }), pos({ id: 'p2', leistungId: 'l-va', basis: 'monat' })] }, KATALOG, FIRMA)).toBe('Atlas Beispiel GmbH · Vertriebsaufbau');
    expect(angebotTitelAus({ positionen: [pos({ titel: 'Freie Leistung' })] }, KATALOG)).toBe('Freie Leistung');
    expect(angebotTitelAus({ positionen: [] }, KATALOG, FIRMA)).toBe('');
    expect(produktTitel('Atlas Beispiel GmbH', FIRMA)).toBe('Atlas Beispiel GmbH');
  });
  it('älterer Entwurf ohne Marke: Deal-Titel, Produktname oder leer = automatisch; eigener Text bleibt', () => {
    const ctx = { firma: FIRMA, dealTitel: 'Vertriebsaufbau Atlas Beispiel', leistungen: KATALOG, positionen: [pos({ titel: 'Strategie-Workshop' })] };
    expect(angebotTitelAutomatisch('Vertriebsaufbau Atlas Beispiel', ctx)).toBe(true);
    expect(angebotTitelAutomatisch('Atlas Beispiel GmbH · Strategie-Workshop', ctx)).toBe(true);
    expect(angebotTitelAutomatisch('', ctx)).toBe(true);
    expect(angebotTitelAutomatisch('Klarheit für 2027', ctx)).toBe(false);
  });
  it('Mandat aus angenommenem Angebot: ein Titel, der nur ein FREMDES Produkt nennt (Altbestand), wird der aus den Produkten — eigener Titel bleibt', () => {
    const a = { titel: 'Vertriebsaufbau Atlas Beispiel', positionen: [pos({ leistungId: 'l-ws', titel: 'Strategie-Workshop' })], empfaenger: { name: 'Tobias Test', firma: FIRMA, zeilen: [] } } as unknown as Angebot;
    expect(angebotTitelFuerFolge(a, KATALOG)).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    expect(angebotTitelFuerFolge({ ...a, titel: 'Klarheit für 2027' }, KATALOG)).toBe('Klarheit für 2027');
    expect(angebotTitelFuerFolge({ ...a, titel: 'Strategie-Workshop' }, KATALOG)).toBe('Strategie-Workshop');
    // Ohne Katalog genau wie bisher.
    expect(angebotTitelFuerFolge(a)).toBe('Vertriebsaufbau Atlas Beispiel');
    const v = mandatVorbelegung({ ...a, id: 'ang-x', gesellschaft: 'kdv', einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14, status: 'angenommen', version: 1, angelegt: J, geaendert: J }, KATALOG);
    expect(v.titel).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
  });
  it('Deal folgt dem Angebot im Titel: nur ein automatisch entstandener Titel zieht nach', () => {
    const a = { positionen: [pos({ leistungId: 'l-ws', titel: 'Strategie-Workshop' })] };
    expect(dealTitelNachAngebot(deal({}), a, KATALOG, FIRMA)).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    expect(dealTitelNachAngebot(deal({ titel: 'Atlas Beispiel GmbH · Retainer' }), a, KATALOG, FIRMA)).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    expect(dealTitelNachAngebot(deal({ titel: 'Gespräch mit der Geschäftsführung im Herbst' }), a, KATALOG, FIRMA)).toBeNull();
    // Ohne altes Produkt am Deal zählt nur das Art-Wort — ein Produktname im Titel ist dann eigener Text.
    expect(dealTitelNachAngebot(deal({ leistungId: undefined }), a, KATALOG, FIRMA)).toBeNull();
  });
});

// ── B9 · Deal-Rückfrage (rein) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B9 · Deal mit anderem Produkt → Rückfrage', () => {
  it('nur bei Produkt am Deal UND im Angebot, und nur wenn sie sich unterscheiden', () => {
    expect(dealProduktAnders(deal({}), 'l-ws')).toBe(true);
    expect(dealProduktAnders(deal({}), 'l-va')).toBe(false);
    expect(dealProduktAnders(deal({ leistungId: undefined }), 'l-ws')).toBe(false);
    expect(dealProduktAnders(deal({}), undefined)).toBe(false);
    expect(dealFrageText('Vertriebsaufbau')).toBe('Zu diesem Deal (Vertriebsaufbau) oder neuer Deal?');
  });
  it('Entwurf: „neuer Deal“ nimmt den Deal weg, `null` leert die Wahl und den Titel-Haken', () => {
    const basis = { id: 'ang-t1', jetzt: J, person: 'kevin', heute: '2026-10-01' };
    const a = entwurfSaeubern({ gesellschaft: 'kdv', titel: 'T', dealId: 'ch-va', dealWahl: 'neu', titelVonHand: true }, null, basis);
    expect(a.dealId).toBeUndefined();
    expect(a).toMatchObject({ dealWahl: 'neu', titelVonHand: true });
    const b = entwurfSaeubern({ dealId: 'ch-va', dealWahl: 'deal', titelVonHand: null }, a, basis);
    expect(b).toMatchObject({ dealId: 'ch-va', dealWahl: 'deal' });
    expect(b.titelVonHand).toBeUndefined();
    const c = entwurfSaeubern({ dealId: null, dealWahl: null }, b, basis);
    expect(c.dealId).toBeUndefined();
    expect(c.dealWahl).toBeUndefined();
    expect(entwurfSaeubern({ dealWahl: 'irgendwas' }, null, basis).dealWahl).toBeUndefined();
  });
});

// ── B5 · keine doppelte Position (rein) ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B5 · ein zweiter Klick bringt nur, was fehlt', () => {
  it('Option nachträglich angehakt: nur die Option kommt dazu (auch ohne Preis-Teil an der Position)', () => {
    const erst = angebotPositionenAusProdukt(WS, [], { idBasis: 'p-a' });
    expect(erst).toHaveLength(1);
    const zweit = angebotPositionenAusProdukt(WS, ['pt-event'], { idBasis: 'p-b' });
    const e = positionenErgaenzen(erst, zweit);
    expect(e.neu.map(p => p.titel)).toEqual(['Strategie-Workshop · je Event']);
    expect(e.schonDa.map(p => p.titel)).toEqual(['Strategie-Workshop']);
    // Ein dritter Klick: alles schon da.
    expect(positionenErgaenzen([...erst, ...e.neu], angebotPositionenAusProdukt(WS, ['pt-event'], { idBasis: 'p-c' })).neu).toEqual([]);
  });
  it('mit Preis-Teil entscheidet er (auch nach geändertem Titel); Menge/Preis zählen nicht; freie Positionen nie gleich', () => {
    const a = pos({ leistungId: 'l-ws', preisTeilId: 'pt-ws', titel: 'Workshop (angepasst)', einzelpreisCent: 1 });
    expect(gleichePosition(a, pos({ leistungId: 'l-ws', preisTeilId: 'pt-ws', titel: 'Strategie-Workshop' }))).toBe(true);
    expect(gleichePosition(a, pos({ leistungId: 'l-ws', preisTeilId: 'pt-event', titel: 'Workshop (angepasst)' }))).toBe(false);
    expect(gleichePosition(pos({ titel: 'Frei' }), pos({ titel: 'Frei' }))).toBe(false);
  });
  it('die Säuberung behält den Preis-Teil nur an einer Produkt-Position und nur in seiner Form', () => {
    expect(positionSaeubern({ titel: 'A', leistungId: 'l-ws', preisTeilId: 'pt-ws' }, 0)?.preisTeilId).toBe('pt-ws');
    expect(positionSaeubern({ titel: 'A', preisTeilId: 'pt-ws' }, 0)?.preisTeilId).toBeUndefined();
    expect(positionSaeubern({ titel: 'A', leistungId: 'l-ws', preisTeilId: '<x>' }, 0)?.preisTeilId).toBeUndefined();
  });
});

// ── Oberfläche: Editor (Server-Render) ────────────────────────────────────────────────────────────────────────────────────────────────────────

const K: Kontakt = { id: 'c-tobi1', vorname: 'Tobias', nachname: 'Test', email: 'c-tobi1@example.invalid', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], firmaId: 'f-atlas', anrede: 'Sie', importiertAm: '2026-08-01', geaendertAm: '2026-08-01' };
const STAND: CrmBestand = {
  firmen: [{ id: 'f-atlas', name: FIRMA, rolle: 'zielkunde', geaendert: J }], chancen: [deal({})], mandate: [], leistungen: KATALOG, events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [],
  segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [],
} as unknown as CrmBestand;
const api = { crm: { ok: true, heute: '2026-10-01', stand: STAND, ich: 'kevin', stufen: [{ id: 'diagnose', label: 'Diagnose', p: 60, weiterWenn: '', offen: true }], prognose: {}, gewinnquote: {}, ampel: {}, mandate: {}, zahlung: {}, mrr: 0, konzentration: null, events: {}, termine: {} }, kontakte: [K], fehler: null, laden: async () => {} } as unknown as CrmApi;
const daten = { angebote: [], gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt', stand: 's', luecken: [] }], fehler: null, gesperrt: false, laden: async () => {}, uebernehmen: () => {}, entfernen: () => {}, setFehler: () => {} } as unknown as AngebotDaten;
const entwurf = (x: Partial<AngebotMitStand>): AngebotMitStand => ({ id: 'ang-e1', gesellschaft: 'kdv', kontaktId: 'c-tobi1', firmaId: 'f-atlas', dealId: 'ch-va', titel: 'Vertriebsaufbau Atlas Beispiel', positionen: [pos({ leistungId: 'l-ws', titel: 'Strategie-Workshop', einzelpreisCent: 240_000 })], einleitung: 'Guten Tag,', schluss: 'Grüße', gueltigBis: '2026-11-30', zahlungszielTage: 14, status: 'entwurf', version: 1, angelegt: J, geaendert: J, stand: 's1', ...x } as AngebotMitStand);
const zeichne = async (start: AngebotMitStand | null, vorbelegung = {}) => {
  const { Editor } = await import('@/components/os/crm/angebot/Editor');
  return renderToStaticMarkup(h(Editor, { api, daten, id: start?.id ?? 'ang-neu', start, vorbelegung, onGespeichert: () => {}, onGestellt: () => {}, onListe: () => {} }));
};

describe('Editor: Rückfrage statt still übernehmen, Titel aus den Produkten', () => {
  it('still gefundener Deal mit anderem Produkt → „Zu diesem Deal (Vertriebsaufbau) oder neuer Deal?“, Senden gesperrt', async () => {
    const html = await zeichne(entwurf({}));
    expect(html).toContain('Zu diesem Deal (Vertriebsaufbau) oder neuer Deal?');
    expect(html).toContain('Neuer Deal');
    expect(html).toContain('Deal wählen (dieser oder neu)');
  });
  it('bestätigter Deal → keine Rückfrage; „neuer Deal“ → kein Deal am Entwurf', async () => {
    expect(await zeichne(entwurf({ dealWahl: 'deal' }))).not.toContain('oder neuer Deal?');
    const neu = await zeichne(entwurf({ dealId: undefined, dealWahl: 'neu' }));
    expect(neu).not.toContain('oder neuer Deal?');
    expect(neu).toContain('neuer Deal beim Senden');
  });
  it('neu vom Kontakt aus: der Deal ist nur vorgeschlagen, seine Position kommt mit, der Titel aus dem Produkt (nicht der Deal-Titel)', async () => {
    const html = await zeichne(null, { kontaktId: 'c-tobi1' });
    expect(html).toContain('value="Atlas Beispiel GmbH · Vertriebsaufbau"');
    expect(html).not.toContain('value="Vertriebsaufbau Atlas Beispiel"');
    expect(html).not.toContain('oder neuer Deal?');
  });
  it('von Hand geschriebener Titel (Marke) bleibt — mit Weg zurück zum Titel aus den Produkten', async () => {
    const html = await zeichne(entwurf({ titel: 'Klarheit für 2027', titelVonHand: true, dealWahl: 'deal' }));
    expect(html).toContain('value="Klarheit für 2027"');
    expect(html).toContain('Titel aus den Produkten: „Atlas Beispiel GmbH · Strategie-Workshop“');
  });
});

// ── Schreibwege: stellen (Rückfrage 409, neuer Deal), annehmen (Deal-Titel), Mandat und Rechnung ──────────────────────────────────────────────

type Route = { POST: (r: Request) => Promise<Response> };
let angebotRoute: Route, leadRoute: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
const kopf = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
const post = async (r: Route, url: string, body: Record<string, unknown>) => { const x = await r.POST(new Request(`http://test${url}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) })); return { status: x.status, d: await x.json() as Record<string, any> }; }; // eslint-disable-line @typescript-eslint/no-explicit-any
const crm = () => speicher.ladeCrm();
const WS_POS = [{ id: 'p1', leistungId: 'l-ws', preisTeilId: 'pt-ws', titel: 'Strategie-Workshop', text: 'Text', menge: 1, einheit: 'pauschal', einzelpreisCent: 240_000, ustSatz: 19, basis: 'einmalig' }];
const speichern = async (felder: Record<string, unknown>) => {
  const r = await post(angebotRoute, '/api/crm/angebot', { aktion: 'speichern', felder: { gesellschaft: 'kdv', kontaktId: 'c-tobi1', firmaId: 'f-atlas', positionen: WS_POS, titel: angebotTitelAus({ positionen: WS_POS as AngebotPosition[] }, KATALOG, FIRMA), ...felder } });
  expect(r.status).toBe(200);
  return r.d.angebot as Angebot & { stand: string };
};
const stellen = (a: Angebot & { stand: string }) => post(angebotRoute, '/api/crm/angebot', { aktion: 'stellen', id: a.id, stand: a.stand });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' }], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ ...K, firma: FIRMA }] });
  await db.saveJson('crm', {
    ...speicher.leererBestand(), firmen: [{ id: 'f-atlas', name: FIRMA, rolle: 'zielkunde', geaendert: J }], leistungen: KATALOG,
    chancen: [deal({}), deal({ id: 'ch-hand', titel: 'Gespräch mit der Geschäftsführung im Herbst' })],
  });
  await db.saveJson('gesellschaften--test-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: 'info@example.invalid' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', { ...SEED, rechnungen: [] });
  angebotRoute = (await import('@/app/api/crm/angebot/route')) as unknown as Route;
  leadRoute = (await import('@/app/api/crm/lead/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Stellen: nie still einen Deal mit anderem Produkt', () => {
  it('ohne Wahl und offener Deal mit anderem Produkt → 409 mit der Rückfrage, nichts gestellt, keine Nummer', async () => {
    const a = await speichern({ dealId: 'ch-va' });
    const r = await stellen(a);
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ grund: 'deal-frage', deal: { id: 'ch-va' } });
    expect(r.d.fehler).toContain('Zu diesem Deal (Vertriebsaufbau) oder neuer Deal?');
    const x = (await crm()).angebote.find(y => y.id === a.id)!;
    expect(x.status).toBe('entwurf');
    expect(x.nummer).toBeUndefined();
    expect(x.lauf).toBeUndefined();
    // Ohne Deal am Entwurf findet der Server denselben offenen Deal — auch dann die Rückfrage.
    const b = await speichern({});
    expect((await stellen(b)).d.grund).toBe('deal-frage');
  });
  it('„neuer Deal“ → ein eigener Deal mit dem Workshop, der offene bleibt unberührt', async () => {
    const a = await speichern({ dealWahl: 'neu' });
    const r = await stellen(a);
    expect(r.status).toBe(200);
    const b = await crm();
    const neu = b.chancen.find(c => c.id === r.d.dealId)!;
    expect(neu.id).not.toBe('ch-va');
    expect(neu).toMatchObject({ leistungId: 'l-ws', titel: 'Atlas Beispiel GmbH · Strategie-Workshop', stufe: 'angebot' });
    expect(b.chancen.find(c => c.id === 'ch-va')).toMatchObject({ stufe: 'diagnose', titel: 'Vertriebsaufbau Atlas Beispiel', leistungId: 'l-va' });
  });
});

describe('Annehmen: Deal folgt im Titel nur, wenn er automatisch war — Mandat und Rechnung nehmen den richtigen Titel', () => {
  it('„Zu diesem Deal“: gestellt am offenen Deal; angenommen → Produkt UND automatischer Titel ziehen nach', async () => {
    const a = await speichern({ dealId: 'ch-va', dealWahl: 'deal' });
    const s = await stellen(a);
    expect(s.status).toBe(200);
    expect(s.d.dealId).toBe('ch-va');
    const g = s.d.angebot as Angebot & { stand: string };
    expect(g.titel).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    expect((await post(angebotRoute, '/api/crm/angebot', { aktion: 'annehmen', id: g.id, stand: g.stand })).status).toBe(200);
    expect((await crm()).chancen.find(c => c.id === 'ch-va')).toMatchObject({ stufe: 'gewonnen', leistungId: 'l-ws', titel: 'Atlas Beispiel GmbH · Strategie-Workshop' });
    // Mandat aus dem Deal: der Titel des Angebots (nie der alte Deal-Titel) — Fall und Monatsrechnung lesen ihn vom Mandat.
    const m = await post(leadRoute, '/api/crm/lead', { aktion: 'mandat', chanceId: 'ch-va' });
    expect(m.status).toBe(200);
    const mandat = (await crm()).mandate.find(x => x.chanceId === 'ch-va')!;
    expect(mandat.titel).toBe('Atlas Beispiel GmbH · Strategie-Workshop');
    const { entwurfNeu } = await import('@/lib/finanzen/rechnung/server');
    const r = await entwurfNeu({ person: 'kevin', haushalt: 'test-haus', sicht: 'privat', quelle: 'mandat', mandatId: mandat.id, monat: localDay().slice(0, 7) });
    expect(r.rechnung.positionen![0].titel).toMatch(/^Atlas Beispiel GmbH · Strategie-Workshop/);
    expect(JSON.stringify(r.rechnung)).not.toContain('Vertriebsaufbau');
  });
  it('von Hand geschriebener Deal-Titel bleibt — nur das Produkt folgt', async () => {
    const a = await speichern({ dealId: 'ch-hand', dealWahl: 'deal' });
    const s = await stellen(a);
    expect(s.status).toBe(200);
    const g = s.d.angebot as Angebot & { stand: string };
    expect((await post(angebotRoute, '/api/crm/angebot', { aktion: 'annehmen', id: g.id, stand: g.stand })).status).toBe(200);
    expect((await crm()).chancen.find(c => c.id === 'ch-hand')).toMatchObject({ stufe: 'gewonnen', leistungId: 'l-ws', titel: 'Gespräch mit der Geschäftsführung im Herbst' });
  });
});
