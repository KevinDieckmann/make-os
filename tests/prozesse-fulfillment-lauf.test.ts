// ─── Prozesse × Fulfillment — ein neues Mandat startet den Prozess seines Produkts (22.10.; Server von Ende zu Ende) ───────────────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell. Geprüft:
//   · Mandat mit Produkt → Prozess scharf: GENAU EIN Lauf (Fall = das Mandat, Auslöser „produkt“, jüngste Version); ein zweiter Takt startet nichts
//   · Entwurf (nie veröffentlicht) → kein Lauf; Probelauf → Schatten
//   · eigener Auslöser „Mandat angelegt“ UND Bindung → trotzdem genau ein Lauf (ein Lauf je Fall und Prozess)
//   · Zusatzmodul: beim Anlegen über „mandat-angelegt“, später über „Zusatzmodul gebucht“ — je eigener Prozess
//   · laufende Fälle bleiben auf ihrer Version, neue nehmen die jüngste
//   · GOLD: ein Mandat mit Fulfillment-Paket verhält sich wie vorher — kein Lauf, alle Fulfillment-Bestände bit-gleich, dieselben Ereignisse
//   · bestehende Fälle beim Scharfschalten zählen die Mandate des Produkts; Landkarte/Werkstatt zeigen „gehört zu Produkt …“; Verbindungsprüfung
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-fulfillment-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-fulfillment';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-pf';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PZ_SCHARF = pz(101), PZ_ENTWURF = pz(102), PZ_PROBE = pz(103), PZ_ZUSATZ = pz(104), PZ_DOPPEL = pz(105), PZ_WEG = pz(199);
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

/** Ein Prozess für ein Produkt: Kick-off (Mensch) → Ende — Fall-Art Mandat, Bereich Fulfillment, läuft als pia. */
const liefern = (titel: string, extra: Partial<ProzessDefinition> = {}): ProzessDefinition =>
  definition([
    schritt(10, 'Kick-off vereinbaren', 1, { kundeSichtbar: true }), schritt(12, 'Ergebnis-Workshop', 2, { form: 'termin', kundeSichtbar: true }), schritt(13, 'Intern prüfen', 3),
    schritt(11, 'Fertig', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ], { titel, bereich: 'fulfillment', fallArt: 'mandat', laeuftAls: 'pia', ...extra });
const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status'], versionen = 1): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: Array.from({ length: versionen }, (_, i) => ({ nr: i + 1, name: `v${i + 1}`, am: J, von: 'pia', definition: { ...def, id } })),
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const produkt = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'entwurf', geaendert: J, ...x });
const mandat = (id: string, leistungId: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: false,
  start: '2026-10-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);

async function laeufe(): Promise<LaeufeDatei> { return S.laeufeLesen(H); }
const laeufeVon = async (prozessId: string): Promise<ProzessLauf[]> => (await laeufe()).laeufe.filter(l => l.prozessId === prozessId);
/** Alle Fulfillment-Bestände (Dateien, deren Name mit „fulfillment“ beginnt) — Inhalt für den Gold-Vergleich. */
function fulfillmentDateien(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) geh(p); else if (n.startsWith('fulfillment')) raus[path.relative(ordner, p)] = readFileSync(p, 'utf8'); } };
  geh(ordner);
  return raus;
}
async function mandateAnlegen(...neu: Mandat[]): Promise<void> {
  const { aendereCrm } = await import('@/lib/crm/speicher');
  await aendereCrm(b => ({ ...b, mandate: [...b.mandate, ...neu] }), { art: 'person', person: 'pia' });
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: J }],
    leistungen: [
      produkt('p-paket', { name: 'Paketprodukt' }), produkt('p-scharf', { name: 'Diagnose', prozessId: PZ_SCHARF }), produkt('p-entwurf', { prozessId: PZ_ENTWURF }),
      produkt('p-probe', { prozessId: PZ_PROBE }), produkt('p-zusatz', { rolle: 'zusatz', prozessId: PZ_ZUSATZ }), produkt('p-doppel', { prozessId: PZ_DOPPEL }),
      produkt('p-tot', { prozessId: PZ_WEG }),
    ],
    mandate: [mandat('ma-alt', 'p-scharf')],
  } satisfies CrmBestand);
  // Ein Prozess mit eigenem Auslöser „Mandat angelegt, nur wenn Produkt = p-doppel“ UND der Bindung am Produkt — darf trotzdem nur einmal starten.
  const doppel = liefern('Doppelt gebunden');
  doppel.knoten = doppel.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: { art: 'ereignis' as const, ereignis: 'mandat-angelegt' as const, bedingungen: [{ feld: 'mandat.produkt', op: 'gleich' as const, wert: 'p-doppel' }] }, katalog: { id: 'ausloeser.ereignis' } } : k));
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [
    eintrag(PZ_SCHARF, liefern('Diagnose liefern'), 'aktiv'), eintrag(PZ_ENTWURF, liefern('Noch im Bau'), 'entwurf', 0), eintrag(PZ_PROBE, liefern('Erst probieren'), 'probelauf'),
    eintrag(PZ_ZUSATZ, liefern('Zusatz liefern'), 'aktiv'), eintrag(PZ_DOPPEL, doppel, 'aktiv'),
  ] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ_SCHARF]: scharf(), [PZ_ZUSATZ]: scharf(), [PZ_DOPPEL]: scharf() } });
  // Fulfillment: eine Paket-Vorlage, dem Produkt „p-paket“ zugeordnet (der vorhandene Weg — Fall startet im Fulfillment, nicht im Motor).
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [{
    id: 'fp-paket', art: 'paket', titel: 'Paket liefern', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'Paket liefern', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 0, form: 'termin' }],
  }, {
    id: 'fp-frei', art: 'paket', titel: 'Paket ohne Produkt', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w2', titel: 'Paket ohne Produkt', rang: 0 }, { id: 'fk-p2', elternId: 'fk-w2', titel: 'Start', rang: 0 }, { id: 'fk-s2', elternId: 'fk-p2', titel: 'Kick-off', rang: 0, form: 'termin' }],
  }], bausteine: [], rituale: [], zuordnung: { 'p-paket': { vorlageId: 'fp-paket' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
  S = await import('@/lib/prozesse/lauf-server');
  // Erster Takt: der Motor merkt sich den Stand der Ereignisse (nie die Vergangenheit nachholen).
  await S.prozesseImTakt();
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Ein neues Mandat startet den Prozess seines Produkts', () => {
  let fulfillmentVorher: Record<string, string> = {};
  it('scharf → genau EIN Lauf am Mandat; Entwurf → keiner; Probelauf → Schatten; Bindung + eigener Auslöser → trotzdem einer', async () => {
    fulfillmentVorher = fulfillmentDateien();
    expect(Object.keys(fulfillmentVorher).length).toBeGreaterThan(0);
    await mandateAnlegen(mandat('ma-paket', 'p-paket'), mandat('ma-scharf', 'p-scharf'), mandat('ma-entwurf', 'p-entwurf'), mandat('ma-probe', 'p-probe'), mandat('ma-doppel', 'p-doppel'));
    await S.prozesseImTakt();
    const s = await laeufeVon(PZ_SCHARF);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ fall: { art: 'mandat', id: 'ma-scharf' }, modus: 'scharf', version: 1, person: 'pia', ausloeser: { art: 'produkt' }, daten: { 'produkt.id': 'p-scharf', 'produkt.rolle': 'haupt' } });
    // Er läuft wirklich: die erste Wirkung ist die Aufgabe „Kick-off vereinbaren“ (feste Kennung des Schritts, Systemlauf).
    expect(s[0].status).toBe('wartet');
    const tasks = ((await db.loadJson<{ tasks: { id: string; title: string; bezug?: Record<string, string> }[] }>('tasks'))?.tasks ?? []);
    expect(tasks.filter(t => t.id.startsWith(s[0].id))).toEqual([expect.objectContaining({ title: 'Kick-off vereinbaren', bezug: expect.objectContaining({ mandatId: 'ma-scharf' }) })]);
    expect(await laeufeVon(PZ_ENTWURF)).toEqual([]);
    expect((await laeufeVon(PZ_PROBE)).map(l => [l.fall.id, l.modus])).toEqual([['ma-probe', 'schatten']]);
    expect((await laeufeVon(PZ_DOPPEL)).map(l => l.fall.id)).toEqual(['ma-doppel']);
    // Nur die Mandate mit Produkt-Prozess — das Bestandsmandat „ma-alt“ startet nicht (nur neue Fälle).
    expect((await laeufe()).laeufe.map(l => l.fall.id).sort()).toEqual(['ma-doppel', 'ma-probe', 'ma-scharf']);
  });
  it('ein zweiter Takt startet nichts doppelt (ein Lauf je Fall und Prozess)', async () => {
    const vorher = (await laeufe()).laeufe.length;
    await S.prozesseImTakt();
    expect((await laeufe()).laeufe.length).toBe(vorher);
  });
  it('GOLD: das Mandat mit Fulfillment-Paket verhält sich wie vorher — kein Lauf, jeder Fulfillment-Bestand bit-gleich, Paket weiter zugeordnet', async () => {
    expect((await laeufe()).laeufe.some(l => l.fall.id === 'ma-paket')).toBe(false);
    expect(fulfillmentDateien()).toEqual(fulfillmentVorher);
    const [{ fulfillmentLesen }, { vorlageFuerProdukt }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/vorlagen-anwenden')]);
    expect(vorlageFuerProdukt(await fulfillmentLesen('vorlagen', H), 'p-paket')?.id).toBe('fp-paket');
    // Dieselben Ereignisse wie vor der Bindung: je neues Mandat genau „mandat-angelegt“, kein „zusatz-gebucht“.
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    const e = (await ereignisseLaden()).eintraege.filter(x => x.bezug.mandatId === 'ma-paket');
    expect(e.map(x => [x.art, x.bezug])).toEqual([['mandat-angelegt', { mandatId: 'ma-paket', firmaId: 'f-probe', kontaktId: 'c-erika' }]]);
  });
});

describe('Zusatzmodule — eigener Prozess je Modul', () => {
  it('beim Anlegen (über „mandat-angelegt“) und später gebucht (über „Zusatzmodul gebucht“) — Fall ist das Mandat', async () => {
    await mandateAnlegen(mandat('ma-mit-zusatz', 'p-paket', { zusatz: [{ id: 'mz-0001', leistungId: 'p-zusatz' }] }));
    await S.prozesseImTakt();
    expect((await laeufeVon(PZ_ZUSATZ)).map(l => [l.fall.id, l.daten['produkt.rolle']])).toEqual([['ma-mit-zusatz', 'zusatz']]);
    // Später gebucht: an das Paket-Mandat (das selbst keinen Lauf hat).
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === 'ma-paket' ? { ...m, zusatz: [{ id: 'mz-0002', leistungId: 'p-zusatz' }] } : m)) }), { art: 'person', person: 'pia' });
    await S.prozesseImTakt();
    expect((await laeufeVon(PZ_ZUSATZ)).map(l => l.fall.id).sort()).toEqual(['ma-mit-zusatz', 'ma-paket']);
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    expect((await ereignisseLaden()).eintraege.filter(x => x.art === 'zusatz-gebucht').map(x => x.bezug)).toEqual([{ mandatId: 'ma-paket', firmaId: 'f-probe', kontaktId: 'c-erika', leistungId: 'p-zusatz' }]);
    // Das Paket-Mandat selbst bekommt weiterhin keinen Lauf eines Hauptprodukt-Prozesses.
    expect((await laeufe()).laeufe.filter(l => l.fall.id === 'ma-paket').map(l => l.prozessId)).toEqual([PZ_ZUSATZ]);
  });
});

describe('Versionen, bestehende Fälle', () => {
  it('laufende Fälle bleiben auf ihrer Version, ein neues Mandat nimmt die jüngste', async () => {
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    await db.updateJson<{ v: 1; prozesse: ProzessEintrag[] }>(prozesseBestand(H), d => ({ ...d!, prozesse: d!.prozesse.map(p => (p.id === PZ_SCHARF ? { ...p, versionen: [...p.versionen, { nr: 2, name: 'v2', am: J, von: 'pia', definition: p.versionen[0].definition }] } : p)) }));
    await mandateAnlegen(mandat('ma-v2', 'p-scharf'));
    await S.prozesseImTakt();
    const l = await laeufeVon(PZ_SCHARF);
    expect(l.map(x => [x.fall.id, x.version]).sort()).toEqual([['ma-scharf', 1], ['ma-v2', 2]]);
  });
  it('„Gilt das für n bestehende Fälle?“ zählt die laufenden Mandate des Produkts (auch ohne eigenen Auslöser)', async () => {
    const v = await S.scharfVorschau(PZ_SCHARF);
    // ma-alt, ma-scharf, ma-v2 — alle aktiv mit „p-scharf“.
    expect(v?.bestehende).toBe(3);
  });
});

describe('Kunden-Sicht: Etappen aus dem Lauf (nur „Dem Kunden zeigen“, nur scharf)', () => {
  it('ein scharfer Lauf zeigt seine markierten Schritte — interne nie; der Probelauf (Schatten) zeigt nichts', async () => {
    const { kundenEtappenFuer } = await import('@/lib/prozesse/kunden-etappen-server');
    const e = await kundenEtappenFuer('ma-scharf');
    expect(e).toEqual({ phasen: [{ titel: 'Ablauf', stand: 'aktuell', anteil: 0 }], erledigt: [], naechstes: ['Kick-off vereinbaren', 'Ergebnis-Workshop'] });
    expect(JSON.stringify(e)).not.toContain('Intern prüfen');
    expect(await kundenEtappenFuer('ma-probe')).toBeNull();
    expect(await kundenEtappenFuer('ma-entwurf')).toBeNull();
    // Das Paket-Mandat hat einen scharfen Lauf seines Zusatzmoduls — dessen Etappen gelten (die Kunden-Sicht nimmt sie nur, solange es keinen Fall gibt).
    expect((await kundenEtappenFuer('ma-paket'))?.naechstes).toEqual(['Kick-off vereinbaren', 'Ergebnis-Workshop']);
  });
  it('die Kunden-Sicht nimmt sie nur OHNE Fall des Fulfillments (Quelle in `sichtFuer`)', () => {
    const s = readFileSync(path.join(process.cwd(), 'lib/fulfillment/kunde/server.ts'), 'utf8');
    expect(s).toContain("const etappen = !fall && e.modus === 'voll' ? await (await import('@/lib/prozesse/kunden-etappen-server')).kundenEtappenFuer(e.mandat.id) : null;");
  });
});

describe('Sichtbar: Landkarte, Werkstatt, Verbindungsprüfung', () => {
  it('Landkarte: Werkstatt-Prozess und Paket nennen ihr Produkt (Link), der Auslöser sagt „neues Mandat“; ohne Produkt kein neuer Schlüssel', async () => {
    const { landkarteLesen } = await import('@/lib/prozesse/server');
    const d = await landkarteLesen();
    const w = d.prozesse.find(p => p.id === PZ_SCHARF)!;
    expect(w.stufe).toBe('fulfillment');
    expect(w.produkte).toEqual([{ id: 'p-scharf', name: 'Diagnose', href: '/os/mandate?s=produkte&k=p-scharf' }]);
    expect(w.steckbrief.ausloeser).toMatch(/^Neues Mandat bzw\. Zusatzmodul des Produkts · /);
    expect(d.prozesse.find(p => p.id === 'fp-paket')?.produkte?.map(x => x.id)).toEqual(['p-paket']);
    const frei = d.prozesse.find(p => p.id === 'fp-frei')!;
    expect('produkte' in frei).toBe(false);
    expect(frei.steckbrief.ausloeser).toBe('Fall startet aus diesem Paket');
  });
  it('Werkstatt: ein Prozess nennt die Produkte, die auf ihn zeigen (nur Kennung + Name)', async () => {
    const { GET } = await import('@/app/api/prozesse/werkstatt/route');
    const r = await GET(new Request(`http://test/api/prozesse/werkstatt?space=business&id=${PZ_SCHARF}`, { headers: sitzung('pia') }));
    const j = await r.json() as { ok: boolean; produkte: { id: string; name: string }[] };
    expect(r.status).toBe(200);
    expect(j.produkte).toEqual([{ id: 'p-scharf', name: 'Diagnose' }]);
  });
  it('Verbindungsprüfung: ein Produkt zeigt auf einen Prozess, den es nicht gibt → Befund; Reparieren löst nur diesen Verweis', async () => {
    const [{ ladeVerbindungsBestaende }, { verbindungenPruefen, verbindungenReparieren }] = await Promise.all([import('@/lib/crm/verbindungen-laden'), import('@/lib/crm/verbindungen')]);
    const b = await ladeVerbindungsBestaende('2026-10-22', 'pia');
    expect(b.prozesse?.ids).toContain(PZ_SCHARF);
    const f = verbindungenPruefen(b).find(x => x.id === 'produkt-prozess-tot');
    expect(f).toMatchObject({ anzahl: 1, beispiele: ['p-tot'], reparierbar: true });
    const r = verbindungenReparieren(b, ['produkt-prozess-tot'], '2026-10-22T10:00:00.000Z', 'pia');
    expect(r.bestaende.crm.leistungen.find(l => l.id === 'p-tot')?.prozessId).toBeUndefined();
    expect(r.bestaende.crm.leistungen.find(l => l.id === 'p-scharf')?.prozessId).toBe(PZ_SCHARF);
  });
});
