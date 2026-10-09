// ─── Onboarding für Update 2 (16.10.): B3 Teil 2, B4, B8, B10, B11 (ONBOARDING_PLAN.md A5) ─────────────────────────────────────
// Wächter:
//   (1) Schema (B4): jeder Schritt hat ein Modul, Voraussetzungen zeigen auf vorhandene Schritte (ohne Kreise), Datenorte auf Zeilen der
//       Datenkarte (und jede Zeile mit Ort hat einen Schritt), „Als Nächstes“ achtet auf Voraussetzungen, ein leerer Befund lässt das Häkchen
//       entscheiden — alles über `istFertig` (keine zweite Fertig-Regel), Modul-Filter.
//   (2) Prüfungen (B3 Teil 2): Monatsabschluss erst ab dem 0-Punkt, Mandate/Kapazität ohne Mandat „leer“, Produkte, Business-Einstellungen,
//       Finanzplan (Platzhalter), Konten-Register (eigene + gemeinsame, frisch), Arbeitsrahmen, Routinen, Agenten (eigene Heads, Thread),
//       Brain (freigegebene Regel + Brücke), Medienspeicher, Datenschutz-Selbstprüfung, Head-of-IT-Befunde — nur ja/nein + Zähler, nie Werte.
//   (3) B11: „Sicht X bekommt nichts aus Y“ — Business-Partner bekommt keine Privat- und keine Familien-Befunde (auch nicht über GET);
//       „nur ich“-Menschen der anderen Person zählen nie; fremde private Konten zählen nie.
//   (4) B10: der Morgenlauf merkt grüne Schritte (nie das GET), ein zurückgefallener Schritt erscheint als „braucht dich“ — nur für die Person.
//   (5) B8: die Datenbasis liest nur die Einrichtung (keine alten Wege, keine Namen) und zeigt nur Befunde, die der Server gab.
// Datenordner und Vault im Temp-Ordner, erfundene Konten und Zahlen — nie .data/, nie der echte Vault.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { promises as fs, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/onboarding' }));

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-onboarding-u2-'));
const DATEN = path.join(wurzel, 'daten');
const VAULT = path.join(wurzel, 'Make.Claude');
process.env.MAKE_OS_DATEN_DIR = DATEN;
process.env.MAKE_VAULT_DIR = VAULT;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-onboarding-u2-0123456789';
process.env.MAKE_OS_ADRESSE = 'https://instanz-u2.example.invalid';
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DEMO', 'ANTHROPIC_API_KEY', 'MAKE_OS_MEDIEN', 'MAKE_OS_MEDIEN_S3_ENDPUNKT', 'MAKE_OS_MEDIEN_S3_BUCKET', 'MAKE_OS_MEDIEN_S3_ZUGANG', 'MAKE_OS_MEDIEN_S3_GEHEIMNIS']) delete process.env[k];
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const D = await import('@/lib/make-one/onboarding-data');
const { SCHRITTE, DATENKARTE, MODULE, schrittMitId, schritteFuer, fortschrittVon, istFertig, offeneVoraussetzungen, zurueckgefallen, nurModule, datenStandVon } = D;
const S = await import('@/lib/onboarding-status');
const { pruefeAlles, einrichtungFesthalten, PRIVAT_PRUEFUNGEN, HAUSHALT_PRUEFUNGEN, ALLE_PRUEFUNGEN, PERSOENLICHE_PRUEFUNGEN } = S;

const HAUS = 'haus-u2';
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp[0].toUpperCase()}${sp.slice(1)} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const KONTEN = { konten: [konto('k1', 'erste', 'inhaber'), konto('k2', 'zweite', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] };

const INHABER = { inhaber: true, haupt: true, eingeladen: false, personen: 3, privatFinanzen: true, altbestand: true };
const MITGLIED = { inhaber: false, haupt: false, eingeladen: true, personen: 3, privatFinanzen: true, altbestand: true };
const PARTNER = { ...MITGLIED, privatFinanzen: false };
const schritt = (id: string) => schrittMitId(id)!;
const lies = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8');

let db: typeof import('@/lib/store/local-db');
let HEUTE = '';
let VORMONAT = '';
beforeAll(async () => {
  await fs.mkdir(DATEN, { recursive: true });
  db = await import('@/lib/store/local-db');
  HEUTE = (await import('@/lib/zeit')).localDay();
  const j = Number(HEUTE.slice(0, 4)), m = Number(HEUTE.slice(5, 7));
  VORMONAT = m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
  await db.saveJson('konten', KONTEN);
});

// ── (1) Schema und reine Regeln ──────────────────────────────────────────────────────────────────────────────────────────────
describe('B4: Schema und geführter Ablauf (rein)', () => {
  it('jeder Schritt hat ein bekanntes Modul; Voraussetzungen zeigen auf andere Schritte und bilden keinen Kreis', () => {
    for (const s of SCHRITTE) {
      expect(s.modul, s.id).toBeDefined();
      expect(Object.keys(MODULE), s.id).toContain(s.modul);
      for (const v of s.nach ?? []) { expect(schrittMitId(v), `${s.id} → ${v}`).not.toBeNull(); expect(v, s.id).not.toBe(s.id); }
    }
    const besucht = new Map<string, 'laeuft' | 'fertig'>();
    const tief = (id: string, pfad: string[]): void => {
      if (besucht.get(id) === 'fertig') return;
      expect(besucht.get(id), `Kreis: ${[...pfad, id].join(' → ')}`).not.toBe('laeuft');
      besucht.set(id, 'laeuft');
      for (const v of schritt(id).nach ?? []) tief(v, [...pfad, id]);
      besucht.set(id, 'fertig');
    };
    for (const s of SCHRITTE) tief(s.id, []);
  });

  it('Datenorte zeigen auf Zeilen der Datenkarte — und jede Zeile mit Eingabeort hat einen Schritt, der sie einträgt', () => {
    const ids = new Set(DATENKARTE.map(d => d.id));
    expect(ids.size).toBe(DATENKARTE.length);
    for (const s of SCHRITTE) for (const o of s.datenOrt ?? []) expect(ids.has(o), `${s.id}: ${o}`).toBe(true);
    const genutzt = new Set(SCHRITTE.flatMap(s => s.datenOrt ?? []));
    for (const d of DATENKARTE.filter(x => x.href)) expect(genutzt.has(d.id), d.id).toBe(true);
    for (const s of SCHRITTE.filter(x => x.wartetAuf)) expect(s.wartetAuf!.length, s.id).toBeLessThanOrEqual(120);
  });

  it('neue Prüf-Schlüssel stehen an ihren Schritten (Ebene passt) und in den Listen', () => {
    const erwartet: Record<string, string> = {
      datenschutz: 'datenschutz', 'ki-instanz': 'ki', vault: 'vault', 'sicherung-mac': 'abholung', 'hoi-gruen': 'hoi', medienspeicher: 'medien',
      monatsabschluss: 'monatsabschluss', mandate: 'mandate', produkte: 'produkte', 'mandate-kapazitaet': 'kapazitaet', 'business-grundlagen': 'business-einstellungen',
      agenten: 'agenten', brain: 'brain', finanzplan: 'finanzplan', 'privat-fixkosten': 'haushalt-fixkosten', 'ich-privatkonten': 'konten-register',
      'ich-arbeitsrahmen': 'arbeitsrahmen', 'ich-routinen': 'routinen', 'familie-rahmen': 'familie-rahmen', 'familie-menschen': 'familie-menschen',
    };
    for (const [id, p] of Object.entries(erwartet)) { expect(schritt(id).pruefung, id).toBe(p); expect(ALLE_PRUEFUNGEN, p).toContain(p); }
    // B11: alles über private Finanzen hängt an Schritten, die Konten ohne Privat-Finanzen gar nicht haben.
    for (const p of PRIVAT_PRUEFUNGEN) for (const s of SCHRITTE.filter(x => x.pruefung === p)) expect(s.privatFinanzen, s.id).toBe(true);
    for (const p of PERSOENLICHE_PRUEFUNGEN) for (const s of SCHRITTE.filter(x => x.pruefung === p)) expect(s.ebene, s.id).toBe('ich');
  });

  it('ein leerer Befund lässt das Häkchen entscheiden; ein roter schlägt es weiter; DatenStand aus EINEM Befund', () => {
    const s = schritt('mandate');
    const leer = { erfuellt: false, wert: 'kein laufendes Mandat', leer: true as const };
    expect(istFertig(s, { erledigt: {}, befunde: { mandate: leer } })).toBe(false);
    expect(istFertig(s, { erledigt: { mandate: { at: 'x', von: 'dir' } }, befunde: { mandate: leer } })).toBe(true);
    expect(istFertig(s, { erledigt: { mandate: { at: 'x', von: 'dir' } }, befunde: { mandate: { erfuellt: false, wert: '1 von 2' } } })).toBe(false);
    expect(datenStandVon(leer)).toBe('leer');
    expect(datenStandVon({ erfuellt: false, wert: 'x', veraltet: true })).toBe('veraltet');
    expect(datenStandVon({ erfuellt: false, wert: 'x' })).toBe('offen');
    expect(datenStandVon({ erfuellt: true, wert: 'x' })).toBe('gepflegt');
    expect(datenStandVon(undefined)).toBe('unbekannt');
  });

  it('„Als Nächstes“ überspringt Schritte mit offener Voraussetzung (sperrt aber nichts); Hinweise nur für sichtbare Schritte', () => {
    const liste = schritteFuer(INHABER);
    const vorher = Object.fromEntries(liste.filter(s => s.etappe < 3 && !s.spaeter && !s.optional).map(s => [s.id, { at: 'x', von: 'dir' }]));
    const befunde = Object.fromEntries(liste.filter(s => s.etappe < 3 && s.pruefung).map(s => [s.pruefung!, { erfuellt: true, wert: 'x' }]));
    // Etappe 0–2 fertig, Stichtag offen: Als Nächstes ist 3.1 — der 0-Punkt (nach Stichtag) kommt nicht vor ihm.
    const n = fortschrittVon(liste, { erledigt: vorher, befunde })!.naechster!;
    expect(n.id).toBe('stichtag');
    const ohneStichtag = fortschrittVon(liste.filter(s => s.id !== 'stichtag' && s.id !== 'steckbrief'), { erledigt: vorher, befunde }).naechster!;
    expect(ohneStichtag.etappe).toBe(3); // Voraussetzungen außerhalb der Liste ordnen nicht
    const z = { erledigt: {}, befunde: {} };
    expect(offeneVoraussetzungen(schritt('eroeffnung'), INHABER, z).map(s => s.id)).toEqual(['stichtag', 'steckbrief']);
    // Unsichtbare Voraussetzungen fallen weg: ohne Altbestand kein 0.5, ohne Privat-Finanzen keine Privat-Schritte.
    expect(offeneVoraussetzungen(schritt('jahresziele'), { ...INHABER, altbestand: false }, z)).toEqual([]);
    expect(offeneVoraussetzungen(schritt('privat-fixkosten'), PARTNER, z)).toEqual([]);
    expect(offeneVoraussetzungen(schritt('eroeffnung'), INHABER, { erledigt: { stichtag: { at: 'x', von: 'dir' }, steckbrief: { at: 'x', von: 'dir' } }, befunde: {} })).toEqual([]);
  });

  it('B10 rein: zurückgefallen nur, wenn schon einmal grün und jetzt rot (nicht leer, nicht ohne Befund)', () => {
    const liste = schritteFuer(INHABER);
    const rot = { erfuellt: false, wert: '1 von 2' };
    expect(zurueckgefallen(liste, { erledigt: {}, befunde: { produkte: rot } }).map(s => s.id)).toEqual([]);
    expect(zurueckgefallen(liste, { erledigt: {}, befunde: { produkte: rot }, gruen: { produkte: '2026-10-01' } }).map(s => s.id)).toEqual(['produkte']);
    expect(zurueckgefallen(liste, { erledigt: {}, befunde: { mandate: { erfuellt: false, wert: 'x', leer: true } }, gruen: { mandate: '2026-10-01' } })).toEqual([]);
    expect(zurueckgefallen(liste, { erledigt: {}, befunde: {}, gruen: { produkte: '2026-10-01' } })).toEqual([]);
  });

  it('Modul-Filter: „nur Markttraktion“ zeigt Grundlage + Markttraktion; ohne Angabe alles', () => {
    const nur = nurModule(SCHRITTE, ['markttraktion']);
    expect(nur.some(s => s.id === 'kartei')).toBe(true);
    expect(nur.some(s => s.id === 'update')).toBe(true);
    expect(nur.some(s => s.modul === 'finanzen' || s.modul === 'gesundheit' || s.modul === 'familie')).toBe(false);
    expect(nurModule(SCHRITTE).length).toBe(SCHRITTE.length);
  });
});

// ── (2) Prüfungen ────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('B3 Teil 2: Prüfungen — nur ja/nein und Zähler', () => {
  it('Monatsabschluss: ohne 0-Punkt und vor dem ersten fälligen Monat „leer“ (Häkchen zählt), danach der Vormonat je Gesellschaft', async () => {
    expect((await pruefeAlles('erste')).monatsabschluss).toMatchObject({ erfuellt: false, leer: true });
    await db.saveJson('business-eroeffnung', { eintraege: [{ id: 'er-1', firma: 'kdv', stichtag: `${HEUTE.slice(0, 7)}-01`, kontostand: 1234.56, gesetztVon: 'erste', gesetztAm: '2026-10-01T00:00:00Z' }] });
    const vor = (await pruefeAlles('erste')).monatsabschluss;
    expect(vor).toMatchObject({ leer: true });
    expect(vor.wert).toMatch(/noch keiner fällig/);
    await db.saveJson('business-eroeffnung', { eintraege: [{ id: 'er-2', firma: 'kdv', stichtag: `${VORMONAT}-01`, kontostand: 1234.56, gesetztVon: 'erste', gesetztAm: '2026-10-01T00:00:00Z' }] });
    const faellig = (await pruefeAlles('erste')).monatsabschluss;
    expect(faellig).toEqual({ erfuellt: false, wert: expect.stringMatching(/^0 von 1 Abschluss für /) });
    await db.saveJson('business-abschluesse', { eintraege: [{ firma: 'kdv', monat: VORMONAT, von: 'erste', am: '2026-10-01T00:00:00Z', umsatz: 98765 }] });
    expect((await pruefeAlles('erste')).monatsabschluss).toMatchObject({ erfuellt: true });
    expect(JSON.stringify(await pruefeAlles('erste'))).not.toMatch(/98765|1234/);
  });

  it('Mandate und Kapazität: ohne laufendes Mandat „leer“; unvollständig rot; vollständig + Zuweisung grün', async () => {
    let b = await pruefeAlles('erste');
    expect(b.mandate).toMatchObject({ leer: true });
    expect(b.kapazitaet).toMatchObject({ leer: true });
    const mandat = (id: string, x: Record<string, unknown> = {}) => ({ id, kunde: 'Geheimkunde', kontaktIds: [], titel: 'Geheimtitel', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 4321, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ...x });
    await db.saveJson('crm', { firmen: [{ id: 'f-a', name: 'Geheimfirma' }], mandate: [mandat('m-1', { firmaId: 'f-a' }), mandat('m-2', { gesellschaft: 'offen' })], leistungen: [] });
    b = await pruefeAlles('erste');
    expect(b.mandate).toEqual({ erfuellt: false, wert: '1 von 2 laufenden Mandaten mit Firma, Honorar und Gesellschaft' });
    expect(b.kapazitaet).toEqual({ erfuellt: false, wert: '0 von 2 laufenden Mandaten mit Zuweisung' });
    await db.saveJson('crm', { firmen: [{ id: 'f-a', name: 'Geheimfirma' }], mandate: [mandat('m-1', { firmaId: 'f-a' })], leistungen: [] });
    await db.saveJson(`kapazitaet--${HAUS}`, { personen: {}, zuweisungen: [{ id: 'z-1', person: 'konto-erste', art: 'mandat', bezugId: 'm-1', stundenWoche: 8 }] });
    b = await pruefeAlles('erste');
    expect(b.mandate.erfuellt).toBe(true);
    expect(b.kapazitaet.erfuellt).toBe(true);
    expect(JSON.stringify(b)).not.toMatch(/Geheim|4321/);
  });

  it('Produkte: aktiv mit Leistungstext; Business-Einstellungen: Köpfe und Jahresziel je Business-Gesellschaft', async () => {
    expect((await pruefeAlles('erste')).produkte).toEqual({ erfuellt: false, wert: 'noch kein aktives Produkt' });
    const crm = await db.loadJson<Record<string, unknown>>('crm');
    await db.saveJson('crm', { ...crm, leistungen: [{ id: 'l-1', name: 'Geheimprodukt', status: 'aktiv', preis: { betrag: 5000, einheit: 'Monat' } }] });
    expect((await pruefeAlles('erste')).produkte).toEqual({ erfuellt: false, wert: '1 aktiv, aber ohne Leistungstext' });
    await db.saveJson('crm', { ...crm, leistungen: [{ id: 'l-1', name: 'Geheimprodukt', status: 'aktiv', preis: { betrag: 5000, einheit: 'Monat' }, angebot: { leistungstext: 'Geheimer Leistungstext' } }] });
    expect((await pruefeAlles('erste')).produkte).toEqual({ erfuellt: true, wert: '1 aktives Produkt mit Leistungstext' });
    expect((await pruefeAlles('erste'))['business-einstellungen'].erfuellt).toBe(false);
    await db.saveJson('business-einstellungen', { fte: { kdv: 2, ug: 1 }, ziele: { kdv: 100000, ug: 200000 } });
    expect((await pruefeAlles('erste'))['business-einstellungen']).toEqual({ erfuellt: true, wert: '2 von 2 Business-Gesellschaften mit Köpfen und Jahresziel' });
    expect(JSON.stringify(await pruefeAlles('erste'))).not.toMatch(/Geheim|100000|200000/);
  });

  it('Finanzplan: ohne Dokument rot, mit Platzhalter-Netto-Tabelle rot, sonst grün — nur mit Privat-Finanzen', async () => {
    expect((await pruefeAlles('erste')).finanzplan.wert).toMatch(/noch kein Dokument/);
    const { leeresDokument } = await import('@/lib/finanzen/plan/operationen');
    await db.saveJson(`finanzen-plan--${HAUS}`, leeresDokument(HEUTE));
    expect((await pruefeAlles('erste')).finanzplan).toEqual({ erfuellt: false, wert: 'Dokument da — die Netto-Tabelle ist noch der Platzhalter' });
    const { planFix } = await import('./fixtures/finanz-plan');
    await db.saveJson(`finanzen-plan--${HAUS}`, planFix());
    expect((await pruefeAlles('erste')).finanzplan).toEqual({ erfuellt: true, wert: 'Dokument da, Netto-Tabelle eingetragen' });
    expect((await pruefeAlles('zweite')).finanzplan.erfuellt).toBe(true);
    expect((await pruefeAlles('erste'))['haushalt-fixkosten']).toEqual({ erfuellt: false, wert: 'noch keine Buchungen im Haushalt' });
  });

  it('Konten-Register: nur eigene und gemeinsame Konten, frisch ≤ 31 Tage, sonst „veraltet“ — fremde private zählen nie', async () => {
    const stand = (datum: string) => ({ id: `ks-${datum}`, betrag: 7777.77, datum, quelle: 'hand', erfasstVon: 'erste', erfasstAm: `${datum}T08:00:00Z` });
    const kt = (id: string, x: Record<string, unknown>) => ({ id, name: 'Geheimkonto', art: 'giro', angelegtVon: 'erste', angelegtAm: '2026-10-01T00:00:00Z', staende: [stand(HEUTE)], ...x });
    await db.saveJson(`konten--${HAUS}`, { v: 1, konten: [kt('kt-1', { ort: 'privat', person: 'erste' }), kt('kt-2', { ort: 'gemeinsam' }), kt('kt-3', { ort: 'privat', person: 'zweite', staende: [stand('2020-01-01')] })] });
    expect((await pruefeAlles('erste'))['konten-register']).toEqual({ erfuellt: true, wert: '2 von 2 Konten mit Stand ≤ 31 Tage' });
    expect((await pruefeAlles('zweite'))['konten-register']).toEqual({ erfuellt: false, wert: '1 von 2 Konten mit Stand ≤ 31 Tage', veraltet: true });
    expect(JSON.stringify(await pruefeAlles('zweite'))).not.toMatch(/7777|Geheimkonto/);
  });

  it('Arbeitsrahmen und Routinen: nur die eigene Person (Grundwert oder Arbeits-Blöcke; eigene aktive Routine)', async () => {
    let e = await pruefeAlles('erste');
    expect(e.arbeitsrahmen.erfuellt).toBe(false);
    expect(e.routinen.erfuellt).toBe(false);
    await db.saveJson('routinen', {
      routinen: [{ id: 'r-1', titel: 'Geheimroutine', aktiv: true, owner: 'zweite' }, { id: 'r-2', titel: 'Gemeinsam', aktiv: true, owner: 'beide' }],
      bloecke: [{ id: 'b-1', owner: 'zweite', wochentag: 1, von: '09:00', bis: '12:00', art: 'business' }],
    });
    e = await pruefeAlles('erste');
    const z = await pruefeAlles('zweite');
    expect(e.routinen.erfuellt).toBe(false);
    expect(e.arbeitsrahmen.erfuellt).toBe(false);
    expect(z.routinen).toEqual({ erfuellt: true, wert: '1 aktive Routine von dir' });
    expect(z.arbeitsrahmen).toEqual({ erfuellt: true, wert: '1 Arbeits-Block in deiner Wochenvorlage' });
    const kapa = await db.loadJson<Record<string, unknown>>(`kapazitaet--${HAUS}`);
    await db.saveJson(`kapazitaet--${HAUS}`, { ...kapa, personen: { 'konto-erste': { stundenWoche: 30 } } });
    expect((await pruefeAlles('erste')).arbeitsrahmen).toEqual({ erfuellt: true, wert: 'Grundwert in der Kapazität gesetzt' });
    expect(JSON.stringify(await pruefeAlles('erste'))).not.toContain('Geheimroutine');
  });

  it('Agenten: eingestellte Heads des Haushalts oder eigene; Einstellungen anderer Personen und fremde Threads zählen nicht', async () => {
    expect((await pruefeAlles('erste')).agenten.erfuellt).toBe(false);
    const { einstellungBestand, fadenBestand } = await import('@/lib/agenten/typen');
    await db.saveJson(einstellungBestand(HAUS), { v: 1, heads: {}, personen: { zweite: { heads: { gesundheit: { stufe: 'stark', geaendertAm: '2026-10-01T00:00:00Z' } } } } });
    expect((await pruefeAlles('erste')).agenten.erfuellt).toBe(false);
    expect((await pruefeAlles('zweite')).agenten).toEqual({ erfuellt: true, wert: '1 Head eingestellt' });
    await db.saveJson(fadenBestand('erste'), { v: 1, faeden: [{ id: 'fd-1', besitzer: 'erste', agent: { art: 'head', headId: 'sales' }, titel: 'Geheimthread', nachrichten: [] }] });
    expect((await pruefeAlles('erste')).agenten).toEqual({ erfuellt: true, wert: 'noch kein Head eingestellt — du arbeitest in 1 Thread mit einem Head' });
    await db.saveJson(einstellungBestand(HAUS), { v: 1, heads: { sales: { autonomie: 'vorschlag', geaendertAm: '2026-10-02T00:00:00Z' } } });
    expect((await pruefeAlles('erste')).agenten).toEqual({ erfuellt: true, wert: '1 Head eingestellt' });
  });

  // Die Sicht auf Regeln ist DIE Regel `darfSehen` (lib/zoe/vault.ts) — seit 09.10. aus den Konten (volle Mitglieder des Haushalts
  // sehen „intern“); die Test-Regel trägt „familie“, damit sie auch für „nur Business“-Konten zählt.
  it('Brain: freigegebene Regel (von einem bekannten Konto) und die App-Brücke', async () => {
    expect((await pruefeAlles('erste')).brain).toEqual({ erfuellt: false, wert: '0 freigegebene Regeln · App-Brücke noch nicht gesetzt' });
    const ordner = path.join(VAULT, '00. Fundament', 'Regeln');
    await fs.mkdir(ordner, { recursive: true });
    const regel = (von: string) => `---\ntype: regel\ntitel: Geheimregel\nprioritaet: 2\ngilt_fuer: beide\nstatus: aktiv\nscope: familie\nowner: erste\nerstellt_von: erste\nerstellt_am: 2026-10-01\ngeaendert_von: erste\ngeaendert_am: 2026-10-01\nfreigegeben_von: ${von}\nfreigegeben_am: 2026-10-01\nstand: 2026-10-01\n---\n\n# Geheimregel\n\nText.\n`;
    await fs.writeFile(path.join(ordner, 'fremd.md'), regel('niemand'));
    await fs.writeFile(path.join(ordner, 'echt.md'), regel('erste'));
    await db.saveJson(`brain-bruecke--${HAUS}`, { privat: 'anzahl', zeitFreigabe: [], geaendertVon: 'erste', geaendertAm: '2026-10-01T00:00:00Z' });
    expect((await pruefeAlles('zweite')).brain).toEqual({ erfuellt: true, wert: '1 freigegebene Regel · App-Brücke gesetzt' });
    expect(JSON.stringify(await pruefeAlles('zweite'))).not.toContain('Geheimregel');
  });

  it('Instanz: Medienspeicher, Datenschutz-Selbstprüfung, KI, Head of IT — für Nicht-Inhaber nur „Instanz eingerichtet: ja/nein“', async () => {
    const e = await pruefeAlles('erste');
    expect(e.medien).toEqual({ erfuellt: false, wert: 'noch der Ordner auf dem Server (außerhalb der Nachtsicherung)' });
    expect(e.datenschutz.erfuellt).toBe(false);
    expect(e.datenschutz.wert).toMatch(/Verantwortlicher fehlt/);
    expect(e.datenschutz.wert).not.toMatch(/Hetzner|Google|Anthropic|IONOS/i);
    expect(e.ki).toEqual({ erfuellt: false, wert: 'kein KI-Schlüssel — ZOE und die Heads laufen nur mit dem Regelwerk' });
    expect(e.hoi.erfuellt).toBe(false);
    expect(e.vault.erfuellt).toBe(false);
    expect(e.abholung.erfuellt).toBe(false);
    const z = await pruefeAlles('zweite');
    for (const id of S.INSTANZ_PRUEFUNGEN) if (z[id]) expect(z[id].wert, id).toMatch(/^Instanz eingerichtet: (ja|nein)$/);
    Object.assign(process.env, { MAKE_OS_MEDIEN_S3_ENDPUNKT: 'https://nbg1.speicher.example.invalid', MAKE_OS_MEDIEN_S3_BUCKET: 'geheim-bucket', MAKE_OS_MEDIEN_S3_ZUGANG: 'GEHEIMZUGANG', MAKE_OS_MEDIEN_S3_GEHEIMNIS: 'GEHEIMNIS123' });
    try {
      await db.saveJson('merken-anstoss', { x: Date.now() }); // eine Schreibung leert den Zwischenspeicher
      const m = await pruefeAlles('erste');
      expect(m.medien).toEqual({ erfuellt: true, wert: 'Object Storage eingerichtet' });
      expect(JSON.stringify(m)).not.toMatch(/geheim-bucket|GEHEIM|speicher\.example/);
    } finally {
      for (const k of ['MAKE_OS_MEDIEN_S3_ENDPUNKT', 'MAKE_OS_MEDIEN_S3_BUCKET', 'MAKE_OS_MEDIEN_S3_ZUGANG', 'MAKE_OS_MEDIEN_S3_GEHEIMNIS']) delete process.env[k];
      await fs.rm(path.join(DATEN, 'merken-anstoss.json'), { force: true });
    }
  });
});

// ── (3) B11 — Rechte-Filter ──────────────────────────────────────────────────────────────────────────────────────────────────
type Antwort = { befunde: Record<string, { erfuellt: boolean; wert: string }>; gruen: Record<string, string>; ich: { privatFinanzen?: boolean } | null };
const hol = async (p: string): Promise<Antwort> => (await (await import('@/app/api/onboarding/route')).GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': p } }))).json();

describe('B11: Business-Partner bekommt keine Privat-Befunde (Sicht X bekommt nichts aus Y)', () => {
  beforeAll(async () => {
    const t = (d: string) => `${Number(HEUTE.slice(0, 4)) + 1}-${d}`;
    await db.saveJson(`familie--${HAUS}`, {
      einstellungen: { gespraech: { wochentag: 0, uhrzeit: '19:00', dauerMin: 45 }, businessFrei: [], kinder: false, ausnahmeBis: null, kalenderTermine: { [t('01-04')]: 'makeos-gespraech-geheim' } },
      menschen: [
        { id: 'm-1', von: 'zweite', am: '2026-10-01', sichtbarkeit: 'nur-ich', name: 'Geheimmensch', rolle: 'freund', geburtstag: '01.02.', kontaktAlleTage: null, letzterKontakt: null, notiz: '' },
        { id: 'm-2', von: 'erste', am: '2026-10-01', name: 'Offen', rolle: 'freund', geburtstag: null, kontaktAlleTage: null, letzterKontakt: null, notiz: '' },
      ],
    });
  });

  it('der Partner („nur Business“) bekommt weder Privat-Finanzen noch Familie — nicht einmal einen Zähler; die Inhaberin schon', async () => {
    const p = await pruefeAlles('partner');
    for (const k of [...PRIVAT_PRUEFUNGEN, ...HAUSHALT_PRUEFUNGEN]) expect(p[k], k).toBeUndefined();
    const e = await pruefeAlles('erste');
    for (const k of [...PRIVAT_PRUEFUNGEN, ...HAUSHALT_PRUEFUNGEN]) expect(e[k], k).toBeDefined();
    // Über die Route genauso — und die Antwort trägt keinen Privat-Wert.
    const g = await hol('partner');
    expect(g.ich?.privatFinanzen).toBe(false);
    for (const k of [...PRIVAT_PRUEFUNGEN, ...HAUSHALT_PRUEFUNGEN]) expect(g.befunde[k], k).toBeUndefined();
    expect(JSON.stringify(g)).not.toMatch(/Geheim|7777|Netto-Tabelle|Rücklage|Paar-Gespräch|Geburtstag/);
  });

  it('Familie: das Paar-Gespräch im Kalender zählt; „nur ich“-Menschen der anderen Person nie', async () => {
    const e = await pruefeAlles('erste'), z = await pruefeAlles('zweite');
    expect(e['familie-rahmen']).toEqual({ erfuellt: true, wert: 'das nächste Paar-Gespräch steht im gemeinsamen Kalender' });
    expect(e['familie-menschen']).toEqual({ erfuellt: false, wert: 'noch kein Mensch mit Geburtstag' });
    expect(z['familie-menschen']).toEqual({ erfuellt: true, wert: '1 Mensch mit Geburtstag' });
    expect(JSON.stringify(e) + JSON.stringify(z)).not.toMatch(/Geheimmensch|makeos-gespraech/);
  });

  it('die Datenbasis (B8) zeigt nur Zeilen mit Befund — dem Partner also keine Privat-Zeile', async () => {
    const { datenbasisZeilen } = await import('@/components/os/DatenbasisView');
    const g = await hol('partner');
    const ids = datenbasisZeilen({ befunde: g.befunde, ich: { ...PARTNER } }).map(x => x.s.id);
    for (const id of ['finanzplan', 'privat-fixkosten', 'ich-privatkonten', 'familie-rahmen', 'familie-menschen']) expect(ids, id).not.toContain(id);
    expect(ids).toContain('mandate');
    const e = await hol('erste');
    expect(datenbasisZeilen({ befunde: e.befunde, ich: { ...INHABER } }).map(x => x.s.id)).toContain('finanzplan');
  });
});

// ── (4) B10 — dauerhafte Ampel ───────────────────────────────────────────────────────────────────────────────────────────────
describe('B10: grün festhalten (Morgenlauf), zurückgefallen = „braucht dich“', () => {
  it('GET schreibt nie; der Morgenlauf merkt grüne Schritte je Person; ein zweiter Lauf schreibt nichts', async () => {
    const vorher = (await fs.readdir(DATEN)).sort();
    await hol('erste'); await hol('zweite');
    expect((await fs.readdir(DATEN)).sort()).toEqual(vorher);
    const r = await einrichtungFesthalten(HEUTE);
    expect(r.personen).toBe(3);
    expect(r.neu).toBeGreaterThan(0);
    const e = await hol('erste');
    expect(e.gruen['business-grundlagen']).toBe(HEUTE);
    expect(e.gruen.produkte).toBe(HEUTE);
    // Der Partner hat den Inhaber-Schritt nicht — also auch keine Marke; die Marken der anderen sieht niemand.
    expect((await hol('zweite')).gruen['business-grundlagen']).toBeUndefined();
    const roh = await db.loadJson<{ gruen?: Record<string, string> }>('onboarding--erste');
    expect(Object.values(roh?.gruen ?? {}).every(t => t === HEUTE)).toBe(true);
    expect(JSON.stringify(roh)).not.toMatch(/Geheim|\d{4,}\.\d/);
    const stand = await fs.stat(path.join(DATEN, 'onboarding--erste.json'));
    expect((await einrichtungFesthalten(HEUTE)).neu).toBe(0);
    expect((await fs.stat(path.join(DATEN, 'onboarding--erste.json'))).mtimeMs).toBe(stand.mtimeMs);
  });

  it('fällt ein grüner Schritt auf Rot, steht er für genau diese Person unter „braucht dich“', async () => {
    await db.saveJson('business-einstellungen', { fte: { kdv: 2, ug: 1 }, ziele: { kdv: 100000 } });
    const e = await hol('erste');
    expect(e.befunde['business-einstellungen'].erfuellt).toBe(false);
    const ids = zurueckgefallen(schritteFuer(INHABER), { erledigt: {}, befunde: e.befunde, gruen: e.gruen }).map(s => s.id);
    expect(ids).toContain('business-grundlagen');
    const z = await hol('zweite');
    expect(zurueckgefallen(schritteFuer(MITGLIED), { erledigt: {}, befunde: z.befunde, gruen: z.gruen }).map(s => s.id)).not.toContain('business-grundlagen');
  });

  it('Heute-Karte und Einrichtung nutzen dieselbe Regel; der Morgenlauf hat den Schritt; keine zweite Glocke', () => {
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain('zurueckgefallen(meine, d.z)');
    expect(w).toMatch(/Punkt braucht dich/);
    expect(lies('components/os/OnboardingView.tsx')).toContain('zurueckgefallen(schritte, z)');
    expect(lies('app/api/tagesstart/route.ts')).toContain('einrichtungFesthalten(today)');
    expect(lies('lib/onboarding-status.ts')).not.toMatch(/\bmelde\(/);
  });
});

// ── (5) B8 — Datenbasis ──────────────────────────────────────────────────────────────────────────────────────────────────────
describe('B8: Datenbasis aus denselben Prüfungen', () => {
  it('keine alten Lesewege, keine festen Namen, Daten nur aus /api/onboarding', () => {
    const q = lies('components/os/DatenbasisView.tsx');
    const code = q.split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');
    for (const alt of ['/api/state/finance', '/api/state/kunden', '/api/state/finanzplan', 'produkte', '/api/oauth/status', '/api/state/agents', 'live: 12']) expect(code, alt).not.toContain(alt);
    expect(code).not.toMatch(/\b(Kevin|Malin)\b/);
    expect(code).toContain('useOnboarding()');
    expect(code).toContain('datenStandVon');
  });
});

describe('Oberfläche: Einrichtung, Ebenen und Datenbasis rendern (ohne Daten, Server-Render)', () => {
  it('die Seiten bauen sich ohne Fehler auf', async () => {
    const { OnboardingUebersicht, EbeneView } = await import('@/components/os/OnboardingView');
    const { DatenbasisView } = await import('@/components/os/DatenbasisView');
    expect(renderToStaticMarkup(createElement(OnboardingUebersicht))).toContain('Einrichtung');
    for (const e of ['ich', 'gemeinsam', 'instanz'] as const) expect(renderToStaticMarkup(createElement(EbeneView, { ebene: e }))).toContain('Stand');
    expect(renderToStaticMarkup(createElement(DatenbasisView))).toContain('Datenstand');
  });
});
