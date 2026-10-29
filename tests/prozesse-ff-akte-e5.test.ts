// ─── Fulfillment in die Werkstatt — E5 „Akte für Mandate mit Werkstatt-Prozess“ (22.10., Entscheidung F3; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › E5) ──
// Ein Mandat, dessen Produkt auf einen Prozess der Werkstatt zeigt, bekommt beim Start des SCHARFEN Laufs seine Akte (Onboarding, keine Paket-Knoten,
// `Fall.ablauf` = Prozess) — erscheint einmal, nie zusätzlich als Kandidat:
//   · rein: `prozessAkteStarten`, `fallAblauf` (Feld, sonst Kennung — Rückweg), Säuberer behält `ablauf`, Kunden-Sicht nimmt für die Akte die Etappen des Laufs
//   · Gold: ein Fall mit Paket ist durch Säuberer und Kunden-Sicht bit-gleich (kein `ablauf`, Etappen ändern nichts)
//   · von Ende zu Ende (eigener Datenordner, erfundene Konten @example.invalid): Mandat anlegen → Takt → scharfer Lauf + Akte; zweiter Takt nichts doppelt;
//     Probelauf (Schatten) → keine Akte; Kandidat XOR Fall; die Leser (Übersicht, Fall, Cockpit, Kunden-Vorschau) laufen mit der Akte
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { Fall, ProzessVorlage } from '@/lib/fulfillment/typen';
import { definition, schritt, konto, J } from './fixtures/prozess-bau';
import { fallStarten, prozessAkteStarten, fallAblauf, PROZESS_AKTE_WURZEL } from '@/lib/fulfillment/prozesse/fall';
import { fallAus } from '@/lib/fulfillment/lesen';
import { obKnotenId } from '@/lib/fulfillment/prozesse/onboarding';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-akte-e5-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-akte-e5';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-e5';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_SCHARF = pz(501), PZ_PROBE = pz(502);
let nr = 0;
const neueId = (p: string) => `${p}-e5-${++nr}`;
const PAKET: ProzessVorlage = {
  id: 'fp-e5', art: 'paket', titel: 'Paket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
  knoten: [{ id: 'fk-w', titel: 'Paket', rang: 1 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 1 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 1, form: 'termin' }],
};

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Die Akte eines Werkstatt-Prozesses (rein)', () => {
  const akte = prozessAkteStarten({ mandatId: 'm-x', prozessId: PZ_SCHARF, titel: 'Diagnose liefern', version: 3, person: 'pia', jetzt: J, start: '2026-10-21', neueId });
  it('nur das Onboarding (Wurzel + Onboarding-Phase mit den Schritten), `ablauf` = Prozess, Kennung = Prozess, Fassung = Version', () => {
    expect(akte).toMatchObject({ mandatId: 'm-x', vorlageId: PZ_SCHARF, vorlageFassung: 3, status: 'onboarding', ablauf: { art: 'prozess', prozessId: PZ_SCHARF } });
    expect(akte.knoten.find(k => !k.elternId)!.id).toBe(PROZESS_AKTE_WURZEL);
    expect(akte.knoten.filter(k => k.id !== PROZESS_AKTE_WURZEL).every(k => k.extra === true)).toBe(true);
    expect(akte.knoten.some(k => k.id === obKnotenId('willkommen'))).toBe(true);
  });
  it('fallAblauf: Feld, sonst Kennung (Rückweg: ein älterer Stand verliert das Feld); ein Fall mit Paket → null', () => {
    expect(fallAblauf(akte)).toEqual({ art: 'prozess', prozessId: PZ_SCHARF });
    const { ablauf: _a, ...ohne } = akte;
    expect(fallAblauf(ohne as Fall)).toEqual({ art: 'prozess', prozessId: PZ_SCHARF });
    expect(fallAblauf(fallStarten({ mandatId: 'm-y', vorlage: PAKET, person: 'pia', jetzt: J, start: '2026-10-21', neueId }))).toBeNull();
  });
  it('Säuberer: behält `ablauf` (nur die gültige Form); Gold — ein Fall mit Paket trägt kein `ablauf` und bleibt bit-gleich', () => {
    expect(fallAus(JSON.parse(JSON.stringify(akte)))!.ablauf).toEqual({ art: 'prozess', prozessId: PZ_SCHARF });
    expect(fallAus(JSON.parse(JSON.stringify({ ...akte, ablauf: { art: 'prozess', prozessId: 'boese' } })))!.ablauf).toBeUndefined();
    const p = fallStarten({ mandatId: 'm-y', vorlage: PAKET, person: 'pia', jetzt: J, start: '2026-10-21', neueId });
    const einmal = JSON.stringify(fallAus(JSON.parse(JSON.stringify(p))));
    expect(einmal).not.toContain('ablauf');
    expect(JSON.stringify(fallAus(JSON.parse(einmal)))).toBe(einmal);
  });
  it('Kunden-Sicht: für die Akte Zeitstrahl/Erledigt/Nächstes aus den Etappen; für einen Fall mit Paket ändern Etappen nichts (Gold)', async () => {
    const { kundenSicht } = await import('@/lib/fulfillment/kunde/sicht');
    const { leerKunde } = await import('@/lib/fulfillment/lesen');
    const basis = {
      modus: 'voll' as const, heute: '2026-10-22', mandat: { id: 'm-x', titel: 'Mandat', kunde: 'Probe' } as Mandat, bausteine: [], marken: {}, rituale: [], kunde: leerKunde(),
      rechte: { formular: false, upload: false, puls: false }, standVon: () => 's', datenschutz: { verantwortlich: 'x', fassung: 'f', absaetze: [] }, uploadFrei: 0,
    };
    const etappen = { phasen: [{ titel: 'Analyse', stand: 'aktuell' as const, anteil: 0.5 }], erledigt: ['Außensicht'], naechstes: ['Workshop'] };
    const a = kundenSicht({ ...basis, fall: akte, etappen });
    expect(a).toMatchObject({ zeitstrahl: etappen.phasen, erledigt: etappen.erledigt, naechstes: etappen.naechstes });
    const p = fallStarten({ mandatId: 'm-x', vorlage: PAKET, person: 'pia', jetzt: J, start: '2026-10-21', neueId });
    expect(JSON.stringify(kundenSicht({ ...basis, fall: p, etappen }))).toBe(JSON.stringify(kundenSicht({ ...basis, fall: p })));
  });
});

// ══ Von Ende zu Ende ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const liefern = (titel: string): ProzessDefinition => definition([
  schritt(10, 'Kick-off vereinbaren', 1, { kundeSichtbar: true }), schritt(11, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
], { titel, bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia' });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'entwurf', geaendert: J, ...x });
const mandat = (id: string, leistungId: string): Mandat => ({
  id, kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-21', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
} as Mandat);

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');
const faelle = async () => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle', H)).faelle;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: J }],
    leistungen: [produkt('p-scharf', { prozessId: PZ_SCHARF }), produkt('p-probe', { prozessId: PZ_PROBE }), produkt('p-paket')], mandate: [] } satisfies CrmBestand);
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ_SCHARF, liefern('Diagnose liefern'), 'aktiv'), eintrag(PZ_PROBE, liefern('Erst probieren'), 'probelauf')] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ_SCHARF]: scharf() } });
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [PAKET], bausteine: [], rituale: [], zuordnung: { 'p-paket': { vorlageId: 'fp-e5' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  S = await import('@/lib/prozesse/lauf-server');
  await S.prozesseImTakt(); // erster Takt: Stand der Ereignisse merken
  const { aendereCrm } = await import('@/lib/crm/speicher');
  await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-scharf', 'p-scharf'), mandat('m-probe', 'p-probe'), mandat('m-paket', 'p-paket')] }), { art: 'person', person: 'pia' });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Akte beim Start des scharfen Laufs', () => {
  it('scharf → Lauf UND Akte (Onboarding, `ablauf`); Probelauf → Schatten-Lauf, keine Akte; Paket-Mandat → weder Lauf noch Fall (wie vorher)', async () => {
    await S.prozesseImTakt();
    const l = (await S.laeufeLesen(H)).laeufe;
    expect(l.map(x => [x.fall.id, x.modus]).sort()).toEqual([['m-probe', 'schatten'], ['m-scharf', 'scharf']]);
    const f = await faelle();
    expect(Object.keys(f)).toEqual(['m-scharf']);
    expect(f['m-scharf']).toMatchObject({ vorlageId: PZ_SCHARF, status: 'onboarding', ablauf: { art: 'prozess', prozessId: PZ_SCHARF } });
    expect(f['m-scharf'].knoten.some(k => k.id === obKnotenId('kickoff'))).toBe(true);
  });
  it('ein zweiter Takt legt nichts doppelt an (ein Fall je Mandat, Byte für Byte)', async () => {
    const vorher = JSON.stringify(await faelle());
    await S.prozesseImTakt();
    expect(JSON.stringify(await faelle())).toBe(vorher);
  });
  // 29.10. (Kreislauf, F-B1): ein Schatten-Lauf blendet das Mandat NICHT mehr aus — er legt keine Akte an, sonst bliebe es ohne Fall und ohne Vorschlag.
  it('Kandidat XOR Fall: die Akte ist kein Kandidat „noch kein Fall“; das Mandat mit Schatten-Lauf und das Paket-Mandat schon', async () => {
    const { GET } = await import('@/app/api/fulfillment/route');
    const r = await GET(new Request('http://test/api/fulfillment?nur=kurz&space=business', { headers: sitzung('pia') }));
    expect(r.status).toBe(200);
    const j = await r.json() as { kandidaten: { mandatId: string }[]; faelle: Record<string, unknown> };
    expect(j.kandidaten.map(k => k.mandatId).sort()).toEqual(['m-paket', 'm-probe']);
    expect(Object.keys(j.faelle)).toEqual(['m-scharf']);
  });
  it('die Leser laufen mit der Akte: Übersicht (voll), Fall, Cockpit, Kunden-Vorschau', async () => {
    const { GET } = await import('@/app/api/fulfillment/route');
    const voll = await GET(new Request('http://test/api/fulfillment?space=business', { headers: sitzung('pia') }));
    expect(voll.status).toBe(200);
    expect(Object.keys((await voll.json() as { faelle: Record<string, unknown> }).faelle)).toEqual(['m-scharf']);
    const fall = await (await import('@/app/api/fulfillment/fall/route')).GET(new Request('http://test/api/fulfillment/fall?m=m-scharf&space=business', { headers: sitzung('pia') }));
    expect(fall.status).toBe(200);
    const { cockpitDaten } = await import('@/lib/fulfillment/prozesse/server');
    expect((await cockpitDaten()).zeilen.map(z => z.mandatId)).toEqual(['m-scharf']);
    const { faelleFuerProzesse } = await import('@/lib/fulfillment/prozesse/server');
    expect((await faelleFuerProzesse())['m-scharf']).toMatchObject({ paket: PZ_SCHARF, status: 'onboarding' });
    // „So sieht der Kunde es“: Nächstes aus dem scharfen Lauf (nur „Dem Kunden zeigen“), der Rest aus der Akte.
    const v = await (await import('@/app/api/fulfillment/kunde/vorschau/route')).GET(new Request('http://test/api/fulfillment/kunde/vorschau?m=m-scharf&space=business', { headers: sitzung('pia') }));
    expect(v.status).toBe(200);
    const sicht = (await v.json() as { sicht: { naechstes: string[]; zeitstrahl: { titel: string }[] } }).sicht;
    expect(sicht.naechstes).toContain('Kick-off vereinbaren');
    expect(sicht.zeitstrahl.map(p => p.titel)).not.toContain('Onboarding');
  });
  it('ein Paket-Fall startet weiter wie vorher (kein `ablauf`)', async () => {
    const { fallStartenServer } = await import('@/lib/fulfillment/prozesse/fall-server');
    const f = await fallStartenServer({ mandatId: 'm-paket', vorlageId: 'fp-e5', person: 'pia' });
    expect(f.ablauf).toBeUndefined();
    expect(fallAblauf(f)).toBeNull();
  });
});
