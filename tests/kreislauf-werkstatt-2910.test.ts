// ─── Kreislauf 29.10. — P4 „Die Werkstatt steuert das Geld“ (Kevin: „Alle Automatisierungen kommen aus der Werkstatt“) ──────────────────────────────────
//   · rein: Warten auf eines von mehreren Ereignissen (W-B5: Motor, Maske, Prüfung, Vorlagen V10/V09A/V12), Geld-Bausteine als eigener Weg hinter dem Schloss
//     (W-B2), Positionen des Angebots-Entwurfs aus dem Fall (W-B1), neue Ereignisse sichtbar im Werkstatt-Katalog, Datum „Rechnung fällig“ auch ohne Mandat
//   · Server (eigener Datenordner, erfundene Konten @example.invalid): „neuer Lead“ nur von Hand bzw. aus dem Formular, MQL-Blick ohne Flut, Geld-Bausteine über
//     die vorhandenen Schreibwege (Rechnungsentwurf je Monat einmal, Stellen ohne Entwurf → nichts vorzuschlagen), Angebots-Entwurf mit Positionen aus dem Produkt
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { ProzessForm, ProzessKnoten, MaskenWert, ProzessDefinition } from '@/lib/prozesse/definition';
import { wartenArten } from '@/lib/prozesse/definition';
import { voran, starten, wartetAuf, laufWartetAufArt, type LaufUmfeld, type StartAnfrage, type Empfaenger } from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe, type ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { maskeWerte, maskeAnwenden } from '@/lib/prozesse/werkstatt-maske';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { vorlageVon } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { alleSchritte } from '@/lib/prozesse/fluss';
import { GELD_AKTION_VON, rechnungZumStellen, angebotZumStellen, geldMonat } from '@/lib/prozesse/geld-bausteine';
import { angebotPositionenFuerFall } from '@/lib/prozesse/geld-positionen';
import { EREIGNIS_NAME } from '@/lib/ereignisse/arten';
import { PROZESS_EREIGNISSE, DATUMS_FELDER, datumsFelderFuer } from '@/lib/prozesse/ausloeser';
import { mqlDiff } from '@/lib/ereignisse/quellen';
import { definition, fk, schritt, konto, PZ, J } from './fixtures/prozess-bau';

// Datenordner VOR allen Imports — synchron (kein Top-Level-await: mit dem Modulgraph dieser Datei hing der Lauf sonst beim Sammeln); local-db legt ihn an.
const ordner = vi.hoisted(() => {
  const o = `${(process.env.TMPDIR ?? '/tmp').replace(/\/$/, '')}/make-os-kreislauf-werkstatt-${process.pid}-${Date.now()}`;
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kreislauf-werkstatt';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});

const lid = (n: number) => `pl-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const an: Empfaenger = { kontaktId: 'c-erika', name: 'Erika Probe', email: 'erika@example.invalid' };
const umfeld = (extra: Partial<LaufUmfeld> = {}): LaufUmfeld => ({ jetzt: J, titel: 'Probe', daten: {}, teilprozess: () => ({ version: 1 }), empfaenger: () => an, ...extra });
function lauf(def: ProzessDefinition, o: Partial<StartAnfrage> = {}): ProzessLauf {
  const r = starten(leereLaeufe(), { id: lid(1), prozessId: PZ, version: 1, def, fall: { art: 'keiner' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode: 'p1', jetzt: J, ...o });
  if (!r.ok) throw new Error(r.grund);
  return r.lauf;
}
const ende = (n: number, rang: number) => schritt(n, 'Ende', rang, { form: 'ende', ende: { ergebnis: 'erfolg' } });
const ein = (id: string, werte: Record<string, MaskenWert> = {}): Partial<ProzessKnoten<ProzessForm>> => ({ katalog: { id, ...(Object.keys(werte).length ? { werte } : {}) } });

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('W-B5: Warten auf eines von mehreren Ereignissen', () => {
  const warten = { art: 'ereignis' as const, ereignis: 'neue-mail' as const, ereignisse: ['angebot-antwort' as const, 'deal-stufe' as const], hoechstensTage: 5 };
  const d = definition([schritt(10, 'Reaktion abwarten', 1, { form: 'warten', katalog: { id: 'warten.ereignis' }, warten }), ende(11, 2)], { fallArt: 'deal' });
  it('der Lauf merkt sich alle Arten; jede davon weckt — eine fremde nicht; ein alter Lauf (nur `ereignis`) wie bisher', () => {
    expect(wartenArten(warten)).toEqual(['neue-mail', 'angebot-antwort', 'deal-stufe']);
    const l = voran(lauf(d, { fall: { art: 'deal', id: 'ch-1' } }), d, umfeld()).lauf;
    expect(l.wartet).toMatchObject({ art: 'ereignis', ereignis: 'neue-mail', ereignisse: ['angebot-antwort', 'deal-stufe'] });
    const e = (art: 'angebot-antwort' | 'followup-erledigt' | 'neue-mail') => ({ art, bezug: { dealId: 'ch-1' }, bereich: 'business' as const });
    expect(wartetAuf(l, d, e('angebot-antwort'), {})).toBe(true);
    expect(wartetAuf(l, d, e('neue-mail'), {})).toBe(true);
    expect(wartetAuf(l, d, e('followup-erledigt'), {})).toBe(false);
    expect(laufWartetAufArt({ ereignis: 'neue-mail' }, 'deal-stufe')).toBe(false);
    // Ein älterer Lauf hat nur `ereignis` im Warten: das weitere weckt ihn nicht (der Takt fragt das Warten des Laufs) — die Version davor kannte es nicht.
    const alt = { ...l, wartet: { ...l.wartet!, ereignisse: undefined } };
    expect(laufWartetAufArt(alt.wartet, 'deal-stufe')).toBe(false);
  });
  it('Maske: „oder eines davon“ liest und schreibt die weiteren Arten; ohne sie bleibt der Knoten bit-gleich', () => {
    const e = katalogEintrag('warten.ereignis')!;
    expect(e.maske.some(f => f.id === 'ereignisse' && f.typ === 'mehrfach' && f.quelle === 'ereignis')).toBe(true);
    const k = schritt(10, 'Warten', 1, { form: 'warten', katalog: { id: 'warten.ereignis' }, warten });
    expect(maskeWerte(k, e)).toMatchObject({ ereignis: 'neue-mail', ereignisse: ['angebot-antwort', 'deal-stufe'] });
    expect(maskeAnwenden(k, e, { ...maskeWerte(k, e), ereignisse: ['followup-erledigt', 'neue-mail'] }).warten).toMatchObject({ ereignisse: ['followup-erledigt'] });
    const ohne = schritt(12, 'Warten', 1, { form: 'warten', katalog: { id: 'warten.ereignis' }, warten: { art: 'ereignis', ereignis: 'neue-mail', hoechstensTage: 5 } });
    expect(maskeAnwenden(ohne, e, maskeWerte(ohne, e)).warten).toEqual(ohne.warten);
  });
  it('Prüfung: ein weiteres Ereignis, auf das kein Prozess warten kann, ist ein offener Punkt', () => {
    const schlecht = definition([schritt(10, 'Warten', 1, { form: 'warten', katalog: { id: 'warten.ereignis' }, warten: { ...warten, ereignisse: ['webhook'] } }), ende(11, 2)], { fallArt: 'deal' });
    expect(definitionPruefen(schlecht).some(b => b.feld === 'ereignisse')).toBe(true);
    expect(definitionPruefen(d).some(b => b.feld === 'ereignisse')).toBe(false);
  });
  it('Vorlagen: V10 wartet auch auf Antwort/Stufe und endet bei Entscheidung (Raute + Ziel); V09A auch auf Follow-up/Antwort; V12 Willkommen vor den Aufgaben', () => {
    const titel = (d: ProzessDefinition, t: string) => alleSchritte(d).find(x => x.schritt.titel === t)!.schritt;
    const v10 = vorlageVon('kg-v10')!;
    expect(titel(v10.definition, 'Reaktion abwarten').warten).toMatchObject({ ereignis: 'neue-mail', ereignisse: ['angebot-antwort', 'deal-stufe'] });
    expect(titel(v10.definition, 'Schon entschieden?').raute).toMatchObject({ art: 'regel', verknuepfung: 'oder' });
    expect(v10.ziel?.bedingungen.map(b => b.feld)).toEqual(['deal.angebot-entschieden', 'deal.offen']);
    const v09a = vorlageVon('kg-v09')!.teile.find(t => t.id === 'kg-v09a')!;
    expect(titel(v09a.definition, 'Bewegung abwarten').warten).toMatchObject({ ereignis: 'deal-stufe', ereignisse: ['followup-erledigt', 'antwort-gesendet'] });
    const v12 = vorlageVon('kg-v12')!.definition;
    const reihe = alleSchritte(v12).map(x => x.schritt.titel);
    expect(reihe.indexOf('Willkommen in 24 Stunden')).toBeLessThan(reihe.indexOf('Übergabe vervollständigen'));
    expect(reihe.indexOf('Fall starten')).toBeLessThan(reihe.indexOf('Vertrag unterschreiben lassen'));
  });
});

describe('W-B2: Geld-Bausteine — EIN Klick im Stapel führt aus (rein)', () => {
  it('Katalog: Rechnung für Mandat erstellen und Rechnung stellen (Klasse geld), Angebot stellen (außen) — alle mit eigenem Schreibweg', () => {
    expect(Object.keys(GELD_AKTION_VON).sort()).toEqual(['angebot.stellen', 'rechnung.mandat-entwurf', 'rechnung.stellen']);
    expect(katalogEintrag('rechnung.mandat-entwurf')?.rechte).toBe('geld');
    expect(katalogEintrag('rechnung.stellen')?.rechte).toBe('geld');
    for (const id of Object.keys(GELD_AKTION_VON)) expect(katalogEintrag(id)?.schreibweg).toMatch(/Wirkung geld/);
  });
  it('hinter dem Schloss: Wirkung „geld“ statt Aufgabe „von Hand“ — ohne Mandat bzw. Deal wie bisher von Hand', () => {
    const r = schlossSetzen(definition([schritt(10, 'Rechnung erstellen', 1, ein('rechnung.mandat-entwurf', { monat: 'vormonat' })), ende(11, 2)], { fallArt: 'mandat' })).definition;
    const a = voran(lauf(r, { fall: { art: 'mandat', id: 'm-1' } }), r, umfeld({ jetzt: '2026-10-29T10:00:00.000Z' })).aktion;
    expect(a).toMatchObject({ art: 'vorschlag', wirkung: { art: 'geld', aktion: 'rechnung-entwurf', mandatId: 'm-1', monat: '2026-09' } });
    // `danach` („von Hand“) bleibt nur der Ersatz, falls der Server keinen eigenen Weg findet — mit Wirkung nimmt die Freigabe die Wirkung (lauf-stapel.ts).
    const s = schlossSetzen(definition([schritt(20, 'Rechnung stellen', 1, ein('rechnung.stellen')), ende(21, 2)], { fallArt: 'mandat' })).definition;
    expect(voran(lauf(s, { fall: { art: 'mandat', id: 'm-1' } }), s, umfeld()).aktion).toMatchObject({ wirkung: { art: 'geld', aktion: 'rechnung-stellen', mandatId: 'm-1' } });
    const g = schlossSetzen(definition([schritt(30, 'Angebot stellen', 1, { form: 'nachricht', ...ein('angebot.stellen') }), ende(31, 2)], { fallArt: 'deal' })).definition;
    expect(voran(lauf(g, { fall: { art: 'deal', id: 'ch-1' } }), g, umfeld()).aktion).toMatchObject({ wirkung: { art: 'geld', aktion: 'angebot-stellen', dealId: 'ch-1' } });
    // Ohne Mandat (Fall „keiner“): Freigabe + Aufgabe „von Hand“ wie bisher.
    const ohne = voran(lauf(s), s, umfeld()).aktion as { wirkung?: unknown; danach?: unknown };
    expect(ohne.wirkung).toBeUndefined();
    expect(ohne.danach).toBeTruthy();
  });
  it('welcher Entwurf gemeint ist: der jüngste des Falls; keiner → null; Vormonat über den Jahreswechsel', () => {
    expect(rechnungZumStellen([{ id: 'r1', mandatId: 'm1', status: 'geplant', datum: '2026-09-01' }, { id: 'r2', mandatId: 'm1', status: 'geplant', datum: '2026-10-01' }, { id: 'r3', mandatId: 'm1', status: 'gestellt', datum: '2026-10-05' }], 'm1')).toBe('r2');
    expect(rechnungZumStellen([{ id: 'r3', mandatId: 'm1', status: 'gestellt' }], 'm1')).toBeNull();
    expect(angebotZumStellen([{ id: 'a1', status: 'entwurf', dealId: 'ch-1', geaendert: '2026-10-01' }, { id: 'a2', status: 'entwurf', dealId: 'ch-1', geaendert: '2026-10-02' }, { id: 'a3', status: 'gestellt', dealId: 'ch-1', geaendert: '2026-10-03' }], { dealId: 'ch-1' })).toBe('a2');
    expect(geldMonat('vormonat', '2026-01-15')).toBe('2025-12');
    expect(geldMonat('vorgabe', '2026-01-15')).toBeUndefined();
  });
});

describe('W-B1: Positionen des Angebots-Entwurfs aus dem Fall (rein)', () => {
  const p = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'projekt', stufe: 'kern', preis: { betrag: 2000, einheit: 'pauschal', basis: 'einmalig' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);
  const crm = (angebote: unknown[] = []) => ({ angebote, chancen: [{ id: 'ch-1', leistungId: 'p-1', wert: { betrag: 3000, basis: 'einmalig' } }], mandate: [], leistungen: [p('p-1')] }) as unknown as Pick<CrmBestand, 'angebote' | 'chancen' | 'mandate' | 'leistungen'>;
  it('zuerst das jüngste Angebot am Deal (neue Version), sonst das Produkt mit dem Wert des Deals, sonst null', () => {
    const vorher = { id: 'ang-1', dealId: 'ch-1', status: 'gestellt', geaendert: '2026-10-01', positionen: [{ id: 'x', titel: 'Alt', text: 'T', menge: 2, einheit: 'Tag', einzelpreisCent: 90000, ustSatz: 19, basis: 'einmalig' }] };
    expect(angebotPositionenFuerFall(crm([vorher]), { dealId: 'ch-1' })).toMatchObject({ quelle: 'vorgaenger', vorgaengerId: 'ang-1', positionen: [{ id: 'p-1', titel: 'Alt', menge: 2, einzelpreisCent: 90000 }] });
    const ausProdukt = angebotPositionenFuerFall(crm(), { dealId: 'ch-1' });
    expect(ausProdukt?.quelle).toBe('produkt');
    expect(ausProdukt?.positionen[0]).toMatchObject({ leistungId: 'p-1', einzelpreisCent: 300000, basis: 'einmalig' });
    expect(angebotPositionenFuerFall(crm(), { dealId: 'ch-weg' })).toBeNull();
  });
});

describe('Ereignisse im Werkstatt-Katalog (rein)', () => {
  it('„Lead wird MQL“ und „Fall abgeschlossen“ mit Klartext-Namen, wählbar als Auslöser', () => {
    expect(EREIGNIS_NAME['lead-mql']).toBe('Lead wird MQL');
    expect(EREIGNIS_NAME['fall-abgeschlossen']).toBe('Fall abgeschlossen');
    expect(PROZESS_EREIGNISSE).toEqual(expect.arrayContaining(['lead-mql', 'fall-abgeschlossen', 'neuer-lead']));
  });
  it('MQL: nur neu erreichte Leads — Firma bzw. Person', () => {
    const l = mqlDiff(new Set(['f-alt']), [{ id: 'f-alt', art: 'firma' }, { id: 'f-neu', art: 'firma' }, { id: 'c-neu', art: 'person', firmaId: 'f-x' }]);
    expect(l.map(e => [e.art, e.bezug])).toEqual([['lead-mql', { firmaId: 'f-neu' }], ['lead-mql', { kontaktId: 'c-neu', firmaId: 'f-x' }]]);
  });
  it('„Rechnung fällig“ gibt es auch bei Fall Firma bzw. Lead (Rechnung ohne Mandat, Kunde aus der Kartei)', () => {
    expect(DATUMS_FELDER.find(d => d.id === 'rechnung.faellig')).toMatchObject({ fall: 'mandat', auch: ['firma', 'lead'] });
    expect(datumsFelderFuer('firma')).toContain('rechnung.faellig');
    expect(datumsFelderFuer('lead')).toContain('rechnung.faellig');
    expect(datumsFelderFuer('deal')).not.toContain('rechnung.faellig');
  });
});

// ══ Server ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const H = 'haus-kw';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId: 'p-1', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-01-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', firmaId: 'f-probe', firma: 'Probe GmbH', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: J }],
    leistungen: [{ id: 'p-1', name: 'Diagnose', typ: 'projekt', stufe: 'kern', preis: { betrag: 2000, einheit: 'pauschal', basis: 'einmalig' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, angebot: { leistungstext: 'Zwei Tage Analyse' } }],
    chancen: [{ id: 'ch-1', titel: 'Probe Diagnose', kontaktIds: ['c-erika'], firmaId: 'f-probe', firma: 'Probe GmbH', stufe: 'angebot', historie: [], wert: { betrag: 3000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', leistungId: 'p-1', angelegt: '2026-10-01', geaendert: '2026-10-01' }],
    mandate: [mandat('m-1')] } as unknown as CrmBestand);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('neuer Lead und MQL (Server)', () => {
  it('„neuer Lead“ nur von Hand in der Kartei bzw. aus dem Formular — andere Wege und Eingeschränkte nie', async () => {
    const { personNeuEreignis } = await import('@/lib/ereignisse/quellen');
    expect(await personNeuEreignis({ id: 'c-neu-1' }, 'kartei')).toBe(1);
    expect(await personNeuEreignis({ id: 'c-neu-1' }, 'kartei')).toBe(0);
    expect(await personNeuEreignis({ id: 'c-neu-2', firmaId: 'f-probe' }, 'vertrieb')).toBe(1);
    expect(await personNeuEreignis({ id: 'c-neu-3' }, 'prospecting')).toBe(0);
    expect(await personNeuEreignis({ id: 'c-neu-4', eingeschraenkt: { seit: '2026-10-01' } }, 'kartei')).toBe(0);
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    expect((await ereignisseLaden()).eintraege.filter(e => e.art === 'neuer-lead').map(e => [e.bezug.kontaktId, e.quelle, e.stufe])).toEqual([['c-neu-1', 'kartei', 'kartei'], ['c-neu-2', 'anfrage', 'vertrieb']]);
  });
  it('MQL-Blick: der erste merkt nur (keine Flut über Altbestand)', async () => {
    const { mqlEreignisse, _mqlStandLeeren } = await import('@/lib/ereignisse/quellen');
    _mqlStandLeeren();
    expect(await mqlEreignisse({ sofort: true })).toBe(0);
    expect(await mqlEreignisse({ sofort: true })).toBe(0);
  });
});

// Großzügige Zeitgrenze: der erste Aufruf lädt das Rechnungswesen samt PDF-Bausteinen (unter Last > 60 s Transform, kein Hängen — Probe 29.10.: 0,1 s warm).
describe('Geld-Bausteine über die vorhandenen Schreibwege (Server)', { timeout: 300_000 }, () => {
  it('Rechnung für Mandat erstellen: vorlegen → per Klick genau EIN Entwurf je Leistungsmonat', async () => {
    const { wirkungVorlegen, wirkungUebernehmen } = await import('@/lib/prozesse/bausteine-server');
    const v = await wirkungVorlegen({ art: 'geld', aktion: 'rechnung-entwurf', mandatId: 'm-1', monat: '2026-09' }, { start: J, daten: {}, person: 'pia' }, { fuer: 'pia', kennung: 'k-1', h: H, jetzt: new Date() });
    expect(v).toMatchObject({ art: 'vorlegen', wirkung: { art: 'geld', aktion: 'rechnung-entwurf', mandatId: 'm-1' } });
    const w = (v as { wirkung: Parameters<typeof wirkungUebernehmen>[1] }).wirkung;
    const a = await wirkungUebernehmen('pia', w, { vid: 'v-1', kennung: 'k-1' });
    expect(a).toMatchObject({ ok: true, text: expect.stringMatching(/angelegt/) });
    const b = await wirkungUebernehmen('pia', w, { vid: 'v-1', kennung: 'k-1' });
    expect(b).toMatchObject({ ok: true, text: expect.stringMatching(/schon/) });
    const plan = await db.loadJson<{ rechnungen: { mandatId?: string; status: string }[] }>('finanzplan');
    expect(plan!.rechnungen.filter(r => r.mandatId === 'm-1' && r.status === 'geplant').length).toBe(1);
    // Rechnung stellen findet diesen Entwurf.
    const s = await wirkungVorlegen({ art: 'geld', aktion: 'rechnung-stellen', mandatId: 'm-1' }, { start: J, daten: {}, person: 'pia' }, { fuer: 'pia', kennung: 'k-2', h: H, jetzt: new Date() });
    expect(s).toMatchObject({ art: 'vorlegen', wirkung: { aktion: 'rechnung-stellen', rechnungId: expect.stringMatching(/^r-/) } });
  });
  it('ohne Entwurf bzw. ohne Mandat: nichts vorzuschlagen — der Lauf geht weiter', async () => {
    const { wirkungVorlegen } = await import('@/lib/prozesse/bausteine-server');
    const o = { start: J, daten: {}, person: 'pia' }, x = { fuer: 'pia', kennung: 'k-3', h: H, jetzt: new Date() };
    expect(await wirkungVorlegen({ art: 'geld', aktion: 'angebot-stellen', dealId: 'ch-1' }, o, x)).toMatchObject({ art: 'weiter', grund: 'daten-fehlen' });
    expect(await wirkungVorlegen({ art: 'geld', aktion: 'rechnung-stellen', mandatId: 'm-weg' }, o, x)).toMatchObject({ art: 'weiter', grund: 'daten-fehlen' });
  });
  it('Angebots-Entwurf aus dem Prozess (W-B1): Positionen aus dem Produkt des Deals — vorher scheiterte jeder Entwurf', async () => {
    const { crmVorschlagPlanen } = await import('@/lib/zoe/crm-vorschlag');
    const r = await crmVorschlagPlanen({ art: 'angebot_entwurf', gesellschaft: 'ug', positionen_aus: 'fall', kontakt: 'c-erika', deal: 'ch-1' }, 'pia');
    expect('plan' in r, JSON.stringify(r)).toBe(true);
    const plan = (r as { plan: { nachher: string; eingabe: { felder: { positionen: { leistungId?: string }[] } } } }).plan;
    expect(plan.eingabe.felder.positionen[0].leistungId).toBe('p-1');
    expect(plan.nachher).toMatch(/Positionen aus dem Produkt/);
    // Ohne `positionen_aus` (ZOE) wie bisher: Positionen sind Pflicht.
    expect('fehler' in await crmVorschlagPlanen({ art: 'angebot_entwurf', gesellschaft: 'ug', kontakt: 'c-erika', deal: 'ch-1' }, 'pia')).toBe(true);
  });
});
