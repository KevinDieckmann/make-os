// ─── Prozesse · Bausteine mit eigenem Weg (22.10. spät) — von Ende zu Ende im Motor (lib/prozesse/lauf-server.ts, lauf-stapel.ts, bausteine-server.ts) ────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell. Nachgebaut sind nur der Termin-Schreibweg (iCloud/Google), die freie Zeit
// und der Fall-Start des Fulfillments (dort geprüft: mit welchen Werten der vorhandene Weg gerufen wird). Geprüft:
//   · Mandat anlegen (Klasse geld): das Schloss IST der eine Klick — die Freigabe aus der Sitzung legt das Mandat über POST /api/crm/lead an, der Lauf geht weiter;
//     Dienstweg → 403 (der Vorschlag bleibt offen); ein zweiter Prozess zum selben Deal findet das Mandat und geht ohne Vorschlag weiter
//   · Gäste vorschlagen: Gäste aus `gaesteVorschlag` (nie mit Werbesperre), Freigabe merkt sie über `gastTeilnahme` vor (Einladungsweg nach Ampel); der Lauf wartet
//   · Kampagnen-Ergebnis: aus dem Verlauf abgeleitet („reagiert“), Freigabe hält es über POST /api/crm/kampagnen fest; schon gesetzt → nichts vorzuschlagen;
//     abgelehnt → der Lauf geht trotzdem weiter
//   · Anfrage übernehmen: Felder des Webhook-Eingangs (fremder Text) → Vorschlag → Freigabe legt die Person über POST /api/crm/anfrage an
//   · Fall starten: Ablauf der Produkt-Karte → Freigabe startet den Fall (fallStartenServer); ohne Ablauf → weiter mit Grund
//   · Termin mit Einladung: freie Zeit + Kalender der Person, Rückfrage „Einladung an 1 Person“, Freigabe → Termin-Schreibweg mit `einladungBestaetigt` als die Person
//   · Text-Entwurf ohne Text → Gerüst als CRM-Vorschlag (nur Text); Karte ergänzen ohne Agent → Aufgabe nur für die fehlenden Felder
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-bausteine2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-bausteine2';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// Nachgebaut: Termin-Schreibweg, freie Zeit, Kalender der Person, Fall-Start des Fulfillments, Ablauf der Produkt-Karte.
const nach = vi.hoisted(() => ({ termine: [] as { person: string | null; body: Record<string, unknown> }[], faelle: [] as Record<string, unknown>[] }));
vi.mock('@/app/api/kalender/termin/route', () => ({
  POST: async (req: Request) => {
    nach.termine.push({ person: req.headers.get('x-make-user'), body: await req.json() as Record<string, unknown> });
    return Response.json({ ok: true, uid: 'makeos-probe', schluessel: 'k|makeos-probe', kalender: 'MAKE Probe (Google)' });
  },
}));
vi.mock('@/lib/kalender/freie-zeit', async () => ({
  ...await vi.importActual<object>('@/lib/kalender/freie-zeit'),
  freieZeitFuer: async () => ({ vorschlaege: [{ start: '2026-10-23T10:00:00', ende: '2026-10-23T11:00:00', tag: '2026-10-23' }], von: '2026-10-23', bis: '2026-11-06', feiertage: {} }),
}));
vi.mock('@/lib/kalender/google/ziel', async () => ({
  ...await vi.importActual<object>('@/lib/kalender/google/ziel'),
  kalenderZiel: async () => ({ kalender: 'MAKE Probe (Google)', quelle: 'google' }),
}));
// 29.10. (Kreislauf F-B3): EIN Start für jeden Fall — `ablaufFuerMandat` (Regel `startVorbelegung`) und `mandatFallStarten` statt Paket-Zuordnung + `fallStartenServer`.
vi.mock('@/lib/fulfillment/prozesse/fall-server', async () => ({
  ...await vi.importActual<object>('@/lib/fulfillment/prozesse/fall-server'),
  fallStartenServer: async (e: Record<string, unknown>) => { nach.faelle.push(e); return { mandatId: e.mandatId }; },
  mandatFallStarten: async (e: Record<string, unknown>) => { nach.faelle.push({ mandatId: e.mandatId, vorlageId: e.ablauf, person: e.person }); return { fall: { mandatId: e.mandatId }, art: 'neu', ablauf: 'paket', laeufe: 0 }; },
  ablaufFuerMandat: async (m: { leistungId?: string }) => (m.leistungId === 'l-1' ? { art: 'paket', id: 'vl-1', titel: 'Beispiel-Ablauf' } : null),
}));
vi.mock('@/lib/fulfillment/prozesse/vorlagen-anwenden', async () => ({
  ...await vi.importActual<object>('@/lib/fulfillment/prozesse/vorlagen-anwenden'),
  vorlageFuerProdukt: (_d: unknown, leistungId: string | undefined) => (leistungId === 'l-1' ? { id: 'vl-1', titel: 'Beispiel-Ablauf' } : null),
}));

const H = 'haus-b2';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MANDAT = pz(31), MANDAT2 = pz(32), GAESTE = pz(33), ERGEBNIS = pz(34), ANFRAGE = pz(35), FALL = pz(36), FALL2 = pz(37), TERMIN = pz(38), TEXT = pz(39), KARTE = pz(40);
const TAG = '2026-10-22T08:00:00.000Z', FRUEHER = '2026-10-20T08:00:00.000Z';
const EINGANG = 'we-00000000-0000-4000-8000-000000000001';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

const eintrag = (id: string, def: ProzessDefinition): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status: 'aktiv', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 5000, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const ende = (n: number, rang: number) => schritt(n, 'Ende', rang, { form: 'ende', ende: { ergebnis: 'erfolg' } });
const glocke = (n: number, rang: number, text: string) => schritt(n, 'Melden', rang, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text } } });
const mit = { laeuftAls: 'pia', eigner: 'konto-pia' } as const;

async function lauf(id: string): Promise<ProzessLauf> { return (await S.laeufeLesen(H)).laeufe.find(l => l.id === id)!; }
async function stapel(): Promise<{ id: string; status: string; person?: string; einmalig?: string; titel: string; nachher: string; bezug?: { art: string; id: string }; eingabe: Record<string, unknown> }[]> {
  return ((await db.loadJson<{ vorschlaege: never[] }>('zoe-stapel'))?.vorschlaege ?? []);
}
async function crm(): Promise<import('@/lib/crm/typen').CrmBestand> { return (await import('@/lib/crm/speicher')).ladeCrm(); }
async function start(prozessId: string, periode: string, fall: ProzessLauf['fall'], o: { jetzt?: string; daten?: Record<string, string>; fremd?: true } = {}): Promise<string> {
  const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
  const e = (await prozesseLesen(H)).prozesse.find(p => p.id === prozessId)!;
  const r = await S.prozessLaufStarten({
    id: (await import('@/lib/kennung')).neueKennung('pl'), prozessId, version: 1, def: e.versionen[0].definition, fall, modus: 'scharf', person: 'pia',
    ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode, jetzt: o.jetzt ?? TAG, ...(o.daten ? { daten: o.daten } : {}), ...(o.fremd ? { fremd: true } : {}),
  }, H);
  if (!r.ok) throw new Error(r.grund);
  return r.lauf.id;
}
const voran = async (id: string) => (await S.laufVoran(id, await S.kontextLaden(new Date(TAG), H)))!;
/** Der Vorschlag, auf den der Lauf wartet. */
async function wartetAuf(id: string) {
  const l = await lauf(id);
  expect(l).toMatchObject({ status: 'wartet', wartet: { art: 'freigabe' } });
  return (await stapel()).find(v => v.einmalig === l.wartet!.wirkung)!;
}
async function stapelPost(body: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> }> {
  const { POST } = await import('@/app/api/zoe/stapel/route');
  const r = await POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, unknown> };
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id, email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  const voll = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Formular', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja, gern per Mail.', wortlautVersion: 'v1', belegRef: 'Gespräch vom 01.09.' };
  await db.saveJson('kontakte', { kontakte: [
    k('c-a', { firmaId: 'f-a', firma: 'Probe GmbH', telefon: '+49 000 1111111', anrede: 'Sie', einwilligungen: [voll] }),
    k('c-gast1', { lebensphase: 'kunde', kreis: 'A' }),
    k('c-gast2', { kreis: 'A', stufe: 'gespraech' }),
    k('c-sperre', { kreis: 'A', lebensphase: 'kunde', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-k', { aktivitaeten: [{ am: '2026-10-21T09:00:00.000Z', art: 'antwort', von: 'system', text: 'Antwort per Mail' }] }),
    k('c-k2'),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const deal = (id: string, kontakt: string, extra: Record<string, unknown> = {}) => ({ id, titel: `Probe ${id}`, kontaktIds: [kontakt], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01', ...extra });
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-a', name: 'Probe GmbH', rolle: 'interessent', branche: 'Maschinenbau' }],
    chancen: [deal('ch-g', 'c-a', { stufe: 'gewonnen', firmaId: 'f-a', firma: 'Probe GmbH', leistungId: 'l-1' }), deal('ch-a', 'c-a', { firmaId: 'f-a', naechsterSchritt: { text: 'Angebot besprechen', datum: '2026-10-28' } })],
    mandate: [{ id: 'm-2', kunde: 'Ohne Ablauf AG', kontaktIds: ['c-a'], titel: 'Probe ohne Ablauf', art: 'projekt', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat' }, ustSatz: 19, zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J }],
    events: [{ id: 'ev-m', titel: 'Beispiel-Abend', format: 'stammtisch', ziel: 'Kontakte', datum: '2026-11-20', status: 'geplant', geaendert: J }],
    kampagnen: [{ id: 'kp-1', name: 'Beispiel-Kampagne', playbook: 'reaktivierung', ziel: 'Gespräche', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-k', 'c-k2'], ergebnisse: [{ kontaktId: 'c-k2', ergebnis: 'gespraech', am: '2026-10-01' }], von: 'hand', geaendert: J }],
  });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { schlossSetzen } = await import('@/lib/prozesse/schloss');
  const mandat = schlossSetzen(definition([schritt(10, 'Mandat anlegen', 1, { katalog: { id: 'crm.mandat-anlegen' } }), glocke(11, 2, 'Mandat-Schritt vorbei.'), ende(12, 3)], { ...mit, fallArt: 'deal' })).definition;
  const gaeste = definition([schritt(20, 'Gäste vorschlagen', 1, { katalog: { id: 'event.gaeste', werte: { n: 5 } } }), glocke(21, 2, 'Gäste-Schritt vorbei.'), ende(22, 3)], { ...mit, fallArt: 'event', bereich: 'marketing' });
  const ergebnis = definition([schritt(30, 'Ergebnis setzen', 1, { katalog: { id: 'crm.kampagnen-ergebnis' } }), glocke(31, 2, 'Ergebnis-Schritt vorbei.'), ende(32, 3)], { ...mit, fallArt: 'lead', bereich: 'marketing' });
  const anfrage = definition([schritt(40, 'Anfrage übernehmen', 1, { katalog: { id: 'crm.anfrage-anlegen', werte: { kanal: 'website' } } }), ende(41, 2)], { ...mit, fallArt: 'lead' });
  const fall = definition([schritt(50, 'Fall starten', 1, { katalog: { id: 'fulfillment.fall-starten' } }), glocke(51, 2, 'Fall-Schritt vorbei.'), ende(52, 3)], { ...mit, fallArt: 'deal', bereich: 'uebergabe' });
  const fall2 = definition([schritt(55, 'Fall starten', 1, { katalog: { id: 'fulfillment.fall-starten' } }), glocke(56, 2, 'Ohne Ablauf vorbei.'), ende(57, 3)], { ...mit, fallArt: 'mandat', bereich: 'uebergabe' });
  const termin = schlossSetzen(definition([schritt(60, 'Kickoff terminieren', 1, { form: 'termin', katalog: { id: 'kalender.einladung', werte: { titel: 'Auftakt', gaeste: 'fall.ansprechpartner', dauerMin: 60 } } }), glocke(61, 2, 'Termin-Schritt vorbei.'), ende(62, 3)], { ...mit, fallArt: 'deal' })).definition;
  const text = definition([schritt(70, 'Nachfassen am Telefon', 1, { katalog: { id: 'crm.entwurf-text', werte: { art: 'anruf_leitfaden', kanal: 'telefon', anlass: 'Gestelltes Angebot' } } }), ende(71, 2)], { ...mit, fallArt: 'deal' });
  const karte = definition([schritt(80, 'Karte', 1, { katalog: { id: 'crm.karte-ergaenzen', werte: { ziel: 'firma', felder: ['branche', 'webseite'] } } }), ende(81, 2)], { ...mit, fallArt: 'firma' });
  const alle: [string, ProzessDefinition][] = [[MANDAT, mandat], [MANDAT2, mandat], [GAESTE, gaeste], [ERGEBNIS, ergebnis], [ANFRAGE, anfrage], [FALL, fall], [FALL2, fall2], [TERMIN, termin], [TEXT, text], [KARTE, karte]];
  const { prozesseBestand, webhookBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: alle.map(([id, d]) => eintrag(id, d)) });
  await db.saveJson(webhookBestand(H), { v: 1, webhooks: [], eingaenge: [{ id: EINGANG, prozessId: ANFRAGE, version: 1, am: TAG, felder: { name: 'Erika Beispiel', email: 'erika.beispiel@example.invalid', firma: 'Beispiel AG', nachricht: 'Bitte um Rückruf zum Angebot.' }, fremd: true }] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: Object.fromEntries(alle.map(([id]) => [id, scharf()])) });
  S = await import('@/lib/prozesse/lauf-server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Mandat anlegen — ein Klick (Klasse geld)', () => {
  let id = '';
  it('der Schritt bereitet vor, das Schloss legt den Vorschlag mit Wirkung „Mandat aus dem Deal“ — geprüft wie ein Klick, ohne Aufgabe „von Hand“', async () => {
    id = await start(MANDAT, 'm1', { art: 'deal', id: 'ch-g' });
    const l = await voran(id);
    expect(l.schritte.find(s => s.knoten === fk(10))).toMatchObject({ status: 'erledigt', grund: 'vorbereitet' });
    const v = await wartetAuf(id);
    expect(v).toMatchObject({ status: 'offen', person: 'pia', bezug: { art: 'prozess' } });
    expect(v.eingabe._wirkung).toMatchObject({ art: 'crm', eingabe: { art: 'mandat_anlegen', dealId: 'ch-g' } });
    expect(v.eingabe._danach).toBeUndefined();
    expect(v.nachher).toMatch(/Mandat aus dem Deal/);
  });
  it('Dienstweg → 403, nichts angelegt, der Vorschlag bleibt offen; aus der Sitzung → Mandat über den CRM-Schreibweg, der Lauf geht weiter', async () => {
    const v = await wartetAuf(id);
    const { PROZESS_STAPEL_ART } = await import('@/lib/prozesse/lauf-stapel');
    const { lies } = await import('@/lib/zoe/stapel');
    expect(await PROZESS_STAPEL_ART.freigeben((await lies()).find(x => x.id === v.id)!, 'pia', { sitzung: false })).toMatchObject({ ok: false, status: 403 });
    expect((await crm()).mandate.some(m => m.chanceId === 'ch-g')).toBe(false);
    expect((await stapel()).find(x => x.id === v.id)!.status).toBe('offen');
    const r = await stapelPost({ id: v.id, entscheidung: 'freigeben' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await crm()).mandate.filter(m => m.chanceId === 'ch-g')).toHaveLength(1);
    expect(await lauf(id)).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
  });
  it('ein zweiter Prozess zum selben Deal: Mandat schon da → kein Vorschlag, weiter über „freigegeben“ (übersprungen mit Grund)', async () => {
    const vorher = (await stapel()).length;
    const zweit = await start(MANDAT2, 'm2', { art: 'deal', id: 'ch-g' });
    const l = await voran(zweit);
    expect(l).toMatchObject({ status: 'fertig' });
    expect(l.schritte.find(s => s.grund === 'schon-erledigt')).toBeTruthy();
    expect(l.schritte.map(s => s.knoten)).toContain(fk(11));
    expect((await stapel()).length).toBe(vorher);
  });
});

describe('Gäste vorschlagen — vorgemerkt erst per Klick', () => {
  it('Gäste aus gaesteVorschlag (nie mit Werbesperre), der Lauf wartet; Freigabe merkt sie über gastTeilnahme vor (Einladungsweg nach Ampel)', async () => {
    const id = await start(GAESTE, 'g1', { art: 'event', id: 'ev-m' });
    await voran(id);
    const v = await wartetAuf(id);
    const ids = (v.eingabe._wirkung as { eingabe: { kontaktIds: string[] } }).eingabe.kontaktIds;
    expect(ids).toEqual(expect.arrayContaining(['c-gast1', 'c-gast2']));
    expect(ids).not.toContain('c-sperre');
    expect(v.nachher).toMatch(/vorgemerkt/);
    const r = await stapelPost({ id: v.id, entscheidung: 'freigeben' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const t = (await crm()).teilnahmen.filter(x => x.eventId === 'ev-m');
    expect(t.map(x => x.kontaktId).sort()).toEqual([...ids].sort());
    expect(t.every(x => x.status === 'vorgemerkt' && x.rolle === 'gast')).toBe(true);
    // Einladungsweg nach der Ampel (lib/crm/eventplanung.ts `einladungswegAus`): Mail nur bei grün (Einwilligung mit vollem Nachweis), sonst persönlich.
    expect(t.find(x => x.kontaktId === 'c-gast1')!.einladungsweg).toBe('persoenlich');
    expect(t.find(x => x.kontaktId === 'c-gast2')!.einladungsweg).toBe('persoenlich');
    if (ids.includes('c-a')) expect(t.find(x => x.kontaktId === 'c-a')!.einladungsweg).toBe('mail');
    expect(await lauf(id)).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
  });
});

describe('Kampagnen-Ergebnis — abgeleitet, festgehalten per Klick', () => {
  it('aus dem Verlauf seit dem Start abgeleitet („reagiert“); Freigabe hält es über POST /api/crm/kampagnen fest', async () => {
    const id = await start(ERGEBNIS, 'k1', { art: 'lead', id: 'c-k' }, { jetzt: FRUEHER, daten: { 'bezug.kampagneid': 'kp-1' } });
    await voran(id);
    const v = await wartetAuf(id);
    expect(v.eingabe._wirkung).toMatchObject({ art: 'crm', eingabe: { art: 'kampagnen_ergebnis', kampagneId: 'kp-1', kontaktId: 'c-k', ergebnis: 'reagiert' } });
    expect((await stapelPost({ id: v.id, entscheidung: 'freigeben' })).status).toBe(200);
    expect((await crm()).kampagnen[0].ergebnisse).toEqual(expect.arrayContaining([expect.objectContaining({ kontaktId: 'c-k', ergebnis: 'reagiert' })]));
    expect(await lauf(id)).toMatchObject({ status: 'fertig' });
  });
  it('steht schon ein weiteres Ergebnis da → nichts vorzuschlagen; abgelehnt → der Lauf geht trotzdem weiter (übersprungen)', async () => {
    const id = await start(ERGEBNIS, 'k2', { art: 'lead', id: 'c-k2' }, { daten: { 'bezug.kampagneid': 'kp-1' } });
    const l = await voran(id);
    expect(l.schritte.find(s => s.knoten === fk(30))).toMatchObject({ status: 'uebersprungen', grund: 'schon-erledigt' });
    expect(l).toMatchObject({ status: 'fertig' });
    // c-k: neuer Lauf (andere Periode geht nicht — ein Lauf je Fall), darum ein neuer Kampagnen-Kontakt ohne Ergebnis.
    await db.updateJson<{ kontakte: Record<string, unknown>[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), { id: 'c-k3', vorname: 'Probe', nachname: 'c-k3', email: 'c-k3@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05' }] }));
    await db.updateJson<import('@/lib/crm/typen').CrmBestand>('crm', cur => ({ ...cur!, kampagnen: cur!.kampagnen.map(c => ({ ...c, kontaktIds: [...c.kontaktIds, 'c-k3'] })) }));
    const id3 = await start(ERGEBNIS, 'k3', { art: 'lead', id: 'c-k3' }, { daten: { 'bezug.kampagneid': 'kp-1' } });
    await voran(id3);
    const v = await wartetAuf(id3);
    expect(v.eingabe._wirkung).toMatchObject({ eingabe: { ergebnis: 'angesprochen' } });
    expect((await stapelPost({ id: v.id, entscheidung: 'ablehnen', grund: 'Ergebnis setze ich selbst.' })).status).toBe(200);
    const n = await lauf(id3);
    expect(n.schritte.find(s => s.knoten === fk(30))).toMatchObject({ status: 'uebersprungen', grund: 'abgelehnt' });
    expect(n.schritte.map(s => s.knoten)).toContain(fk(31));
    expect(n).toMatchObject({ status: 'fertig' });
  });
});

describe('Anfrage übernehmen — aus einem Webhook-Eingang', () => {
  it('die Felder des Eingangs (fremder Text) werden ein Vorschlag; Freigabe legt die Person über POST /api/crm/anfrage an', async () => {
    const id = await start(ANFRAGE, 'w1', { art: 'keiner' }, { daten: { 'bezug.eingangid': EINGANG }, fremd: true });
    await voran(id);
    const v = await wartetAuf(id);
    expect(v.eingabe._wirkung).toMatchObject({ art: 'crm', eingabe: { art: 'anfrage_anlegen', kanal: 'website', neu: { vorname: 'Erika', nachname: 'Beispiel', email: 'erika.beispiel@example.invalid' } } });
    // Der Lauf selbst trägt keinen Text aus dem Webhook.
    expect(JSON.stringify(await lauf(id))).not.toMatch(/Rückruf|Beispiel AG|erika/);
    const r = await stapelPost({ id: v.id, entscheidung: 'freigeben' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const k = (await db.loadJson<{ kontakte: { email?: string }[] }>('kontakte'))!.kontakte;
    expect(k.some(x => x.email === 'erika.beispiel@example.invalid')).toBe(true);
    expect(await lauf(id)).toMatchObject({ status: 'fertig' });
  });
});

describe('Fall starten — über den Fulfillment-Weg', () => {
  it('Ablauf aus der Produkt-Karte → Vorschlag; Freigabe startet den Fall (mandatFallStarten) als die Person', async () => {
    const id = await start(FALL, 'f1', { art: 'deal', id: 'ch-g' });
    await voran(id);
    const v = await wartetAuf(id);
    const m = (await crm()).mandate.find(x => x.chanceId === 'ch-g')!;
    expect(v.eingabe._wirkung).toEqual({ art: 'fulfillment', mandatId: m.id, vorlageId: 'vl-1' });
    expect(v.nachher).toMatch(/Beispiel-Ablauf/);
    expect((await stapelPost({ id: v.id, entscheidung: 'freigeben' })).status).toBe(200);
    expect(nach.faelle).toEqual([{ mandatId: m.id, vorlageId: 'vl-1', person: 'pia' }]);
    expect(await lauf(id)).toMatchObject({ status: 'fertig' });
  });
  it('ohne Ablauf am Produkt → kein Vorschlag, weiter mit Grund „kein Ablauf“', async () => {
    const id = await start(FALL2, 'f2', { art: 'mandat', id: 'm-2' });
    const l = await voran(id);
    expect(l.schritte.find(s => s.knoten === fk(55))).toMatchObject({ status: 'uebersprungen', grund: 'kein-ablauf' });
    expect(l).toMatchObject({ status: 'fertig' });
  });
});

describe('Termin mit Einladung — Rückfrage „Einladung an 1 Person“, angelegt erst per Klick', () => {
  it('freie Zeit und Kalender der Person im Vorschlag; Freigabe aus der Sitzung → Termin-Schreibweg mit einladungBestaetigt als die Person', async () => {
    const id = await start(TERMIN, 't1', { art: 'deal', id: 'ch-a' });
    await voran(id);
    const v = await wartetAuf(id);
    expect(v.nachher).toMatch(/Einladung an 1 Person/);
    expect(v.nachher).toMatch(/Fr, 23\.10\. 10:00–11:00 Uhr/);
    expect(v.eingabe._wirkung).toMatchObject({ art: 'termin', titel: 'Auftakt', start: '2026-10-23T10:00:00', ende: '2026-10-23T11:00:00', kalender: 'MAKE Probe (Google)', an: { kontaktId: 'c-a', email: 'c-a@example.invalid' } });
    expect(nach.termine).toEqual([]);
    expect((await stapelPost({ id: v.id, entscheidung: 'freigeben' })).status).toBe(200);
    expect(nach.termine).toHaveLength(1);
    expect(nach.termine[0]).toMatchObject({ person: 'pia', body: { titel: 'Auftakt', einladungBestaetigt: true, gaeste: [{ email: 'c-a@example.invalid' }], bezug: { dealId: 'ch-a', kontaktId: 'c-a' }, bereich: 'business' } });
    expect(String(nach.termine[0].body.uid)).toMatch(/^makeos-prozess-[0-9a-f]{16}$/);
    expect(await lauf(id)).toMatchObject({ status: 'fertig' });
  });
});

describe('Text-Entwurf ohne Text und Karte ergänzen ohne Agent', () => {
  it('Text-Entwurf: ein Gerüst aus dem Fall (Anrede, Anlass, nächster Schritt) als CRM-Vorschlag „nur Text“ — keine Aufgabe', async () => {
    const id = await start(TEXT, 'x1', { art: 'deal', id: 'ch-a' });
    const l = await voran(id);
    expect(l).toMatchObject({ status: 'fertig' });
    const v = (await stapel()).find(x => x.bezug?.art === 'crm' && x.eingabe.art === 'anruf_leitfaden')!;
    expect(v.eingabe).toMatchObject({ kontaktId: 'c-a', kanal: 'telefon' });
    expect(String(v.eingabe.text)).toContain('Anlass: Gestelltes Angebot');
    expect(String(v.eingabe.text)).toContain('Guten Tag Probe c-a');
    expect(String(v.eingabe.text)).toContain('Nächster Schritt: Angebot besprechen');
    expect(((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))?.tasks ?? []).some(t => t.id.startsWith(id))).toBe(false);
  });
  it('Karte ergänzen: nur die Felder, die in der Akte fehlen, werden eine Aufgabe', async () => {
    const id = await start(KARTE, 'c1', { art: 'firma', id: 'f-a' });
    await voran(id);
    const t = ((await db.loadJson<{ tasks: { id: string; description?: string }[] }>('tasks'))?.tasks ?? []).find(x => x.id.startsWith(id))!;
    expect(t.description).toContain('Es fehlen: Webseite (Firma)');
    expect(t.description).not.toContain('Branche');
  });
});
