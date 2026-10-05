// ─── Selbstständigkeit unter Privat — Teil 2 (05.10. abends, Paket selbst-privat-2) ───────────────────────────────────────────────
// Kevins Entscheidungen: (1) Ziele, Meilensteine, Routinen mit Einheit „Selbstständigkeit“ automatisch nach Privat — Einheit, Kennungen und
// Verknüpfungen bleiben, nur der abgeleitete Bereich wechselt; (2) die Selbstständigkeit zählt WEITER als Arbeit (Fokus, Kapazität, Zeit je
// Einheit) — Arbeit ≠ Bereich, eigene Zuordnung je Einheit. Prüft unsere Instanz gegen die Instanz-Einstellungen „wie vorher“
// (`{"kdc":{"bereich":"business"}}`) und „keine Arbeit“ (`{"kdc":{"arbeit":false}}`). Erfundene Daten, nie echte.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Ziel, Meilenstein, Routine, Block, ZieleDatei } from '../lib/planung/typen';
import type { FokusBlock, ZeitDatei } from '../lib/zeitmessung/modell';
import type { AufgabeKurz } from '../lib/zeitmessung/einheiten';

const WIE_VORHER = JSON.stringify({ kdc: { bereich: 'business' } });
const KEINE_ARBEIT = JSON.stringify({ kdc: { arbeit: false } });
/** Module frisch laden — mit einer Instanz-Einstellung (oder ohne = unsere Instanz). */
async function mit<T>(umgebung: string, laden: () => Promise<T>): Promise<T> {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MAKE_OS_EINHEITEN', umgebung);
  return laden();
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const HEUTE = '2026-10-05';

// ── Altbestand (so gespeichert vor dem 05.10. — Form des alten Stands): eine Ziel-Kette der Selbstständigkeit ──
const zielJahr: Ziel = {
  id: 'z-selbst', titel: 'Beratung ausbauen', fortschritt: 20, erledigt: false, space: 'business', einheit: 'Selbstständigkeit', rang: 1, jahr: 2026,
  zielwert: 12, termin: '2026-12-15', mandatId: 'man-1', firmaId: 'f-1', aufwand: 40, personen: ['konto-pa'], messlatte: '12 Kunden',
};
const zielKdv: Ziel = { id: 'z-kdv', titel: 'Holding aufräumen', fortschritt: 0, space: 'business', einheit: 'KD Ventures', rang: 2, jahr: 2026 };
const zielPrivat: Ziel = { id: 'z-privat', titel: 'Urlaub planen', fortschritt: 0, space: 'privat', rang: 3, jahr: 2026 };
const msSelbst: Meilenstein = {
  id: 'ms-selbst', titel: 'Website live', space: 'business', bereich: 'business', faellig: '2026-11-01', fortschritt: 30, erledigt: false,
  einheit: 'Selbstständigkeit', mandatId: 'man-1', firmaId: 'f-1', zielId: 'z-selbst', wartetAuf: ['ms-vorher'], aufwand: 20, personen: ['konto-pa'], rang: 1,
};
const msVorher: Meilenstein = { id: 'ms-vorher', titel: 'Texte schreiben', space: 'business', bereich: 'business', faellig: '2026-10-20', fortschritt: 0, erledigt: false, einheit: 'Selbstständigkeit', zielId: 'z-selbst' };
const msKdv: Meilenstein = { id: 'ms-kdv', titel: 'Jahresabschluss KDV', space: 'business', bereich: 'business', faellig: '2026-11-10', fortschritt: 0, erledigt: false, einheit: 'KD Ventures' };
const routineSelbst: Routine = { id: 'r-selbst', label: 'Buchhaltung Selbstständigkeit', wann: 'tag', kategorie: 'business', dauerMin: 30, aktiv: true, space: 'business', einheit: 'Selbstständigkeit', owner: 'pa', rhythmus: 'monatlich', naechstesMal: '2026-10-05' };
const routineKdv: Routine = { id: 'r-kdv', label: 'Belege KDV', wann: 'tag', kategorie: 'business', dauerMin: 15, aktiv: true, space: 'business', einheit: 'KD Ventures', owner: 'pa' };
const blockSelbst: Block = { id: 'bl-1', owner: 'pa', wochentag: 1, von: '09:00', bis: '13:00', art: 'business', einheit: 'Selbstständigkeit', titel: 'Beratung' };

describe('Eine zweite Zuordnung je Einheit: Arbeit (lib/einheiten.ts) — getrennt vom Bereich', () => {
  it('unsere Instanz: alle Firmen und das Einzelunternehmen zählen als Arbeit, Privat nie; die Selbstständigkeit ist Privat-Arbeit', async () => {
    const e = await mit('', () => import('../lib/einheiten'));
    expect(e.ZAEHLT_ALS_ARBEIT).toEqual({ kdc: true, kdv: true, ug: true });
    expect(['privat', 'kdc', 'kdv', 'ug', 'g-abcd1234', 'kemaris'].map(e.zaehltAlsArbeit)).toEqual([false, true, true, true, true, false]);
    expect(e.ARBEIT_GESELLSCHAFTEN).toEqual(['kdc', 'kdv', 'ug']);
    expect(e.ARBEIT_EINHEITEN_NAMEN).toEqual(['Selbstständigkeit', 'KD Ventures', 'MAKE Innovation GmbH']);
    expect(['Selbstständigkeit', 'kdc', 'selbststaendigkeit', 'KD Ventures', 'privat', undefined].map(e.privatArbeitsEinheit)).toEqual(['kdc', 'kdc', 'kdc', undefined, undefined, undefined]);
    expect(e.PRIVAT_EINHEITEN_NAMEN).toEqual(['Selbstständigkeit']);
  });
  it('je Instanz umstellbar: „keine Arbeit“ für die Selbstständigkeit, bzw. Selbstständigkeit im Business (dann keine Privat-Arbeit)', async () => {
    const a = await mit(KEINE_ARBEIT, () => import('../lib/einheiten'));
    expect(a.zaehltAlsArbeit('kdc')).toBe(false);
    expect(a.privatArbeitsEinheit('Selbstständigkeit')).toBeUndefined();
    expect(a.privatEinheit('Selbstständigkeit')).toBe('kdc');   // Bereich bleibt Privat
    const b = await mit(WIE_VORHER, () => import('../lib/einheiten'));
    expect(b.zaehltAlsArbeit('kdc')).toBe(true);
    expect(b.privatArbeitsEinheit('Selbstständigkeit')).toBeUndefined();
    expect(b.PRIVAT_EINHEITEN_NAMEN).toEqual([]);
  });
});

describe('Entscheidung 1 — Ziele, Meilensteine, Routinen der Selbstständigkeit stehen unter Privat (abgeleitet, kein Umzug)', () => {
  it('Altbestand: der Schreibweg lässt jedes Feld stehen (idempotent) — Speicherform bleibt Business + Einheit, der Bereich wird Privat', async () => {
    const [{ sauberZiel }, { sauberMeilenstein, meilensteinSpace, meilensteinSpeicherSpace }, { sauberRoutine, sauberBlock, spaceVonRoutine }, { wirksamerSpace, zaehltAlsArbeit }, { spaceVonZiel }] = await mit('', () => Promise.all([
      import('../lib/planung/ziele'), import('../lib/planung/meilensteine'), import('../lib/planung/routinen'), import('../lib/planung/bereich'), import('../lib/lichtfaeden/modell'),
    ]));
    // Nichts geht verloren, nichts wird umgeschrieben (alter Stand liest genau dieselbe Form) — und ein zweiter Lauf ändert nichts.
    expect(sauberZiel(zielJahr)).toEqual(zielJahr);
    expect(sauberZiel(sauberZiel(zielJahr))).toEqual(zielJahr);
    expect(sauberMeilenstein(msSelbst)).toEqual(msSelbst);
    expect(sauberMeilenstein(sauberMeilenstein(msSelbst))).toEqual(msSelbst);
    expect(sauberRoutine(routineSelbst)).toEqual(routineSelbst);
    expect(sauberBlock(blockSelbst)).toEqual(blockSelbst);
    // Bereich: Privat — Kennungen und Verknüpfungen (Mandat, Ziel, Kette, Aufwand, Personen) bleiben.
    expect([wirksamerSpace(zielJahr), spaceVonZiel(zielJahr), meilensteinSpace(msSelbst), spaceVonRoutine(routineSelbst)]).toEqual(['privat', 'privat', 'privat', 'privat']);
    expect(meilensteinSpeicherSpace(msSelbst)).toBe('business');
    expect([wirksamerSpace(zielKdv), meilensteinSpace(msKdv), spaceVonRoutine(routineKdv), wirksamerSpace(zielPrivat)]).toEqual(['business', 'business', 'business', 'privat']);
    // Arbeit (Kapazität): die Selbstständigkeit zählt weiter, Privates nicht, gemeinsame Ziele wie bisher.
    expect([zaehltAlsArbeit(zielJahr, true), zaehltAlsArbeit(msSelbst), zaehltAlsArbeit(zielKdv, true), zaehltAlsArbeit(zielPrivat, true), zaehltAlsArbeit({}, true), zaehltAlsArbeit({})]).toEqual([true, true, true, false, true, false]);
  });
  it('neu angelegt unter Privat mit der Einheit: der Server legt es in der Form des alten Stands ab (Business + Einheit) — Bereich Privat', async () => {
    const [{ sauberZiel }, { sauberMeilenstein, meilensteinSpace }, { sauberRoutine, sauberBlock }] = await mit('', () => Promise.all([
      import('../lib/planung/ziele'), import('../lib/planung/meilensteine'), import('../lib/planung/routinen'),
    ]));
    expect(sauberZiel({ id: 'z-neu', titel: 'Neu', fortschritt: 0, space: 'privat', einheit: 'Selbstständigkeit', aufwand: 8 })).toMatchObject({ space: 'business', einheit: 'Selbstständigkeit', aufwand: 8 });
    const m = sauberMeilenstein({ id: 'ms-neu', titel: 'Neu', space: 'privat', bereich: 'gesundheit', fortschritt: 0, erledigt: false, einheit: 'Selbstständigkeit', aufwand: 5 })!;
    expect(m).toMatchObject({ space: 'business', bereich: 'business', einheit: 'Selbstständigkeit', aufwand: 5 });
    expect(meilensteinSpace(m)).toBe('privat');
    expect(sauberRoutine({ label: 'Neu', space: 'privat', einheit: 'Selbstständigkeit' })).toMatchObject({ space: 'business', einheit: 'Selbstständigkeit' });
    expect(sauberBlock({ owner: 'pa', wochentag: 2, von: '08:00', bis: '10:00', art: 'privat', einheit: 'Selbstständigkeit' })).toMatchObject({ art: 'business', einheit: 'Selbstständigkeit' });
    // Privat ohne Einheit und mit einer Business-Einheit: wie bisher (Privat verwirft die Einheit).
    expect(sauberZiel({ titel: 'P', space: 'privat', einheit: 'KD Ventures' })).toMatchObject({ space: 'privat' });
    expect(sauberZiel({ titel: 'P', space: 'privat', einheit: 'KD Ventures' })).not.toHaveProperty('einheit');
  });
  it('Kaskade und Meilenstein-Aufgaben: abgeleitete Ziele/Meilensteine erben Einheit und damit den Bereich; die Aufgaben-Liste zieht nicht um', async () => {
    const [{ kaskadeAnwenden, meilensteineAbleiten }, { meilensteinSpace }, { meilensteinAufgabenSpace, meilensteinListeId }, { wirksamerSpace }] = await mit('', () => Promise.all([
      import('../lib/planung/kaskade'), import('../lib/planung/meilensteine'), import('../lib/planung/meilenstein-aufgaben'), import('../lib/planung/bereich'),
    ]));
    const datei: ZieleDatei = { tag: [], woche: [], monat: [], quartal: [], jahr: [zielJahr, zielKdv] };
    const k = kaskadeAnwenden(datei, 2026);
    const quartal = k.quartal.find(z => z.abgeleitetVon === 'z-selbst')!;
    expect(quartal).toMatchObject({ space: 'business', einheit: 'Selbstständigkeit', mandatId: 'man-1' });
    expect(wirksamerSpace(quartal)).toBe('privat');
    const ms = meilensteineAbleiten(datei.jahr, []);
    const abgeleitet = ms.find(m => m.abgeleitetVon === 'z-selbst')!;
    expect(abgeleitet).toMatchObject({ space: 'business', bereich: 'business', einheit: 'Selbstständigkeit', mandatId: 'man-1' });
    expect(meilensteinSpace(abgeleitet)).toBe('privat');
    // Die Aufgaben des Meilensteins liegen im Space der Selbstständigkeit (seit selbst-privat unter Privat) — gleiche Liste, kein Umzug.
    // Mit Mandat wie bisher im Space des Mandanten (unverändert, offene Frage im Bericht).
    expect(meilensteinAufgabenSpace(msVorher)).toBe('kdc');
    expect(meilensteinAufgabenSpace(msSelbst)).toBe('m-f-1');
    expect(meilensteinListeId(msSelbst.id)).toBe(meilensteinListeId('ms-selbst'));
    expect(meilensteinAufgabenSpace(msKdv)).toBe('kdv');
  });
  it('Ansichten: Lichtfäden (Ziel, Meilenstein, Routine), Kalender-Frist, Routinen „heute dran“ — unter Privat; KD Ventures bleibt Business', async () => {
    const [{ planungStraenge }, { gesundheitStraenge }, { fristen }, { heuteFaellig }] = await mit('', () => Promise.all([
      import('../lib/lichtfaeden/quellen/planung'), import('../lib/lichtfaeden/quellen/gesundheit'), import('../lib/kalender/eintraege'), import('../lib/planung/routinen'),
    ]));
    const p = planungStraenge({
      heute: HEUTE, aufgaben: [], projekte: [],
      ziele: [{ ...zielJahr, person: 'beide', farbe: '#fff' }, { ...zielKdv, person: 'beide', farbe: '#fff' }],
      meilensteine: [msSelbst, msKdv],
    });
    const pfad = (id: string) => p.straenge.find(s => s.id === id)?.pfad.join('/') ?? '';
    expect(pfad('ms:ms-selbst')).toContain('privat');
    expect(pfad('ziel:z-selbst')).toContain('privat');
    expect(pfad('ms:ms-kdv')).toContain('business');
    const g = gesundheitStraenge({ heute: HEUTE, routinen: [routineSelbst, { ...routineKdv, rhythmus: 'monatlich', naechstesMal: '2026-10-06' }], sport: [], links: { routinen: '/r', sport: '/s' } });
    expect(g.find(s => s.id === 'routine:r-selbst')!.pfad.join('/')).toContain('privat');
    expect(g.find(s => s.id === 'routine:r-kdv')!.pfad.join('/')).toContain('business');
    const f = fristen({ meilensteine: [msSelbst, msKdv] }, '2026-10-01', '2026-12-01');
    expect(Object.fromEntries(f.map(x => [x.id, x.bereich]))).toMatchObject({ 'ms-ms-selbst': 'privat', 'ms-ms-kdv': 'business' });
    expect(heuteFaellig([routineSelbst], 'pa', {}, HEUTE, 'privat').map(x => x.routine.id)).toEqual(['r-selbst']);
    expect(heuteFaellig([routineSelbst], 'pa', {}, HEUTE, 'business')).toEqual([]);
  });
  it('wie vorher (Instanz-Einstellung „Selbstständigkeit im Business“): alles steht wieder im Business', async () => {
    const [{ meilensteinSpace }, { spaceVonRoutine }, { spaceVonZiel }] = await mit(WIE_VORHER, () => Promise.all([
      import('../lib/planung/meilensteine'), import('../lib/planung/routinen'), import('../lib/lichtfaeden/modell'),
    ]));
    expect([spaceVonZiel(zielJahr), meilensteinSpace(msSelbst), spaceVonRoutine(routineSelbst)]).toEqual(['business', 'business', 'business']);
  });
});

describe('Entscheidung 2 — die Selbstständigkeit zählt WEITER als Arbeit (Fokus, Zeit je Einheit, Zeit je Mandat, Kapazität-Ist)', () => {
  const A = (id: string, x: Partial<AufgabeKurz> = {}): AufgabeKurz => ({ id, titel: `Aufgabe ${id}`, business: false, offen: true, ...x });
  const B = (von: string, min: number, x: Partial<FokusBlock> = {}): FokusBlock => ({ von, bis: new Date(Date.parse(von) + min * 60_000).toISOString(), schluessel: 'privat:aufgaben', label: 'Aufgaben', sek: min * 60, ...x });
  const datei = (...b: FokusBlock[]): ZeitDatei => ({ tage: Object.fromEntries(b.map(x => [x.von.slice(0, 10), { auto: {}, bewusst: {}, bloecke: b.filter(y => y.von.slice(0, 10) === x.von.slice(0, 10)) }])) });

  it('Schreibweg: ein Privat-Block auf eine Aufgabe der Selbstständigkeit behält Aufgabe und Einheit; Business-Arbeit unter Privat weiter nicht', async () => {
    const { zuordnungSaeubern, aufgabeKurz } = await mit('', () => import('../lib/zeitmessung/einheiten'));
    const kurz = aufgabeKurz({ id: 't-selbst', title: 'Angebot', projectId: 'pm-kdc', spaceId: 'kdc', status: 'todo' });
    expect(kurz).toMatchObject({ business: false, arbeit: true, einheit: 'Selbstständigkeit' });
    expect(zuordnungSaeubern('privat:aufgaben', { aufgabeId: 't-selbst' }, kurz)).toEqual({ aufgabeId: 't-selbst', einheit: 'Selbstständigkeit' });
    expect(zuordnungSaeubern('privat:fokus', { einheit: 'Selbstständigkeit' })).toEqual({ einheit: 'Selbstständigkeit' });
    expect(zuordnungSaeubern('gemeinsam:home', { einheit: 'selbststaendigkeit' })).toEqual({ einheit: 'Selbstständigkeit' });
    // Unverändert: Business-Einheiten und reine Privat-Aufgaben unter Privat → nichts (umbuchen „ins Business“).
    expect(zuordnungSaeubern('privat:aufgaben', { aufgabeId: 'a1', einheit: 'KD Ventures' }, A('a1', { einheit: 'KD Ventures', business: true, arbeit: true }))).toEqual({});
    expect(zuordnungSaeubern('privat:aufgaben', { aufgabeId: 'a2' }, aufgabeKurz({ id: 'a2', title: 'Einkauf', projectId: 'p', spaceId: 'privat' }))).toEqual({});
    // Mandat der Selbstständigkeit an einem Privat-Block: Firma und Einheit aus dem Mandat.
    const mandate = new Map([['man-1', { id: 'man-1', firmaId: 'f-1', einheit: 'Selbstständigkeit', firma: 'Kunde', titel: 't', aktiv: true, status: 'aktiv' } as never]]);
    expect(zuordnungSaeubern('privat:aufgaben', { mandatId: 'man-1' }, null, mandate)).toEqual({ mandatId: 'man-1', firmaId: 'f-1', einheit: 'Selbstständigkeit' });
  });
  it('Zeit je Einheit: Vorher (nur Business-Blöcke) → Nachher (Arbeit) — die Selbstständigkeit als Privat-Zeile, Privates ohne Arbeit zählt nie', async () => {
    const z = await mit('', () => import('../lib/zeitmessung/einheiten'));
    const karte = new Map([['t-selbst', A('t-selbst', { einheit: 'Selbstständigkeit', arbeit: true })], ['t-kdv', A('t-kdv', { einheit: 'KD Ventures', business: true, arbeit: true })]]);
    const d = datei(
      B('2026-09-29T07:00:00Z', 90, { aufgabeId: 't-selbst' }),                                 // Privat-Block, Aufgabe der Selbstständigkeit
      B('2026-09-29T10:00:00Z', 30, { einheit: 'Selbstständigkeit' }),                          // Privat-Block, direkt zugeordnet
      B('2026-09-29T12:00:00Z', 60, { schluessel: 'business:aufgaben', aufgabeId: 't-kdv' }),   // Business wie immer
      B('2026-09-29T15:00:00Z', 45, { schluessel: 'privat:gesundheit' }),                       // Privat ohne Arbeit
    );
    const vorher = z.bloeckeImZeitraum(d, '2026-09-28', '2026-10-04');
    const nachher = z.bloeckeImZeitraum(d, '2026-09-28', '2026-10-04', z.arbeitsPruefer(karte, null));
    expect([vorher.reduce((s, b) => s + b.sek, 0) / 60, nachher.reduce((s, b) => s + b.sek, 0) / 60]).toEqual([60, 180]);
    const w = z.zeitJeEinheit([{ person: 'pa', name: 'Anna', datei: d }], [...karte.values()], 'woche', '2026-09-30');
    expect(w.gesamt.zeilen.map(r => [r.label, r.bereich, r.sek / 60])).toEqual([
      ['Selbstständigkeit', 'privat', 120], ['KD Ventures', 'business', 60], ['MAKE Innovation GmbH', 'business', 0], ['ohne Einheit', 'business', 0],
    ]);
    expect(w.gesamt.sek / 60).toBe(180);
  });
  it('Zeit je Mandat: Privat-Blöcke auf ein Mandat der Selbstständigkeit zählen mit (Abrechnung, Auslastung)', async () => {
    const { zeitJeMandat } = await mit('', () => import('../lib/zeitmessung/mandate'));
    const mandate = new Map([['man-1', { id: 'man-1', firmaId: 'f-1', einheit: 'Selbstständigkeit', firma: 'Kunde', titel: 'Beratung', aktiv: true, status: 'aktiv', honorarMonat: 4000 } as never]]);
    const d = datei(B('2026-09-29T07:00:00Z', 120, { mandatId: 'man-1', einheit: 'Selbstständigkeit' }), B('2026-09-29T10:00:00Z', 30, { schluessel: 'privat:gesundheit' }));
    const m = zeitJeMandat([{ person: 'pa', name: 'Anna', datei: d }], mandate, 'woche', '2026-09-30');
    expect(m.gesamt.sek / 60).toBe(120);
    expect(m.gesamt.zeilen[0]).toMatchObject({ id: 'man-1', sek: 7200 });
  });
  it('Instanz „Selbstständigkeit keine Arbeit“: Privat-Blöcke zählen nicht, der Schreibweg verwirft die Zuordnung', async () => {
    const z = await mit(KEINE_ARBEIT, () => import('../lib/zeitmessung/einheiten'));
    expect(z.zuordnungSaeubern('privat:fokus', { einheit: 'Selbstständigkeit' })).toEqual({});
    const d = datei(B('2026-09-29T07:00:00Z', 90, { einheit: 'Selbstständigkeit' }));
    expect(z.bloeckeImZeitraum(d, '2026-09-28', '2026-10-04', z.arbeitsPruefer(null, null))).toEqual([]);
  });
});
