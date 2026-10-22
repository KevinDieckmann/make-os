// ─── Prozesse · Datums-Start (22.10.; ANALYSE_100.md Punkt 34) — Auslöser „Datum am Fall“ im Takt ─────────────────────────────────────────────────────────────
// Rein (lib/prozesse/datum-start.ts): Stichtag ± (Werk-)Tage über den Kalender-Kern (Wochenende, Feiertag NRW), Merker „erstes Mal nur merken“, Nachholen nach einem
// Ausfall (begrenzt), feste Periode „Prozess + Fall + Stichtag“ in `starten` (je Fall und Stichtag ein Lauf, neue Periode darf neu starten).
// Takt (lib/prozesse/lauf-server.ts `datumStarten`): erster Takt startet nichts (auch nichts nachgeholt), am Stichtag genau ein Lauf je Fall, doppelter Takt nichts
// doppelt, Entwurf/pausiert nie, Probelauf im Schatten, Art. 18 beendet; die fünf Vorlagen V04 · V08 · V14 · V15 · V18 starten jetzt selbst; Fristen über
// `fristenLesen` (Deal „Entscheidung bis“, 1 Werktag vorher). Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag, Ausloeser } from '@/lib/prozesse/definition';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';
import { datumFaellig, datumFeldFenster, datumPeriode, stichtagVon, datumErklaerung, istDatumPeriode } from '@/lib/prozesse/datum-start';
import { starten, datumSchonGestartet, laeufeAus } from '@/lib/prozesse/lauf-regeln';
import { ausloeserAus, ausloeserText } from '@/lib/prozesse/ausloeser';
import { vorschauText } from '@/components/os/prozesse/WerkstattDatum';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-datum-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-datum';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// ══ Rein ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Stichtag: Kalendertage bzw. Werktage NRW (Kalender-Kern)', () => {
  it('Kalendertage: einfach plus/minus', () => {
    expect(stichtagVon('2026-10-30', { versatzTage: -2 })).toBe('2026-10-28');
    expect(stichtagVon('2026-09-12', { versatzTage: 45 })).toBe('2026-10-27');
    expect(stichtagVon('2027-01-25', { versatzTage: -90 })).toBe('2026-10-27');
    expect(stichtagVon('2026-10-27T10:00:00.000Z', { versatzTage: 0 })).toBe('2026-10-27');
    expect(stichtagVon('kein Datum', { versatzTage: 1 })).toBeNull();
  });
  it('Werktage: über das Wochenende und über Feiertage NRW (25./26.12.) hinweg', () => {
    // Montag 02.11.2026 − 1 Werktag = Freitag 30.10. (Kalendertage wären Sonntag 01.11. — Allerheiligen).
    expect(stichtagVon('2026-11-02', { versatzTage: -1, werktage: true })).toBe('2026-10-30');
    expect(stichtagVon('2026-11-02', { versatzTage: -1 })).toBe('2026-11-01');
    // Montag 28.12. − 1 Werktag = Donnerstag 24.12. (25.12. Feiertag, 26./27. Wochenende); zurück + 1 Werktag = 28.12.
    expect(stichtagVon('2026-12-28', { versatzTage: -1, werktage: true })).toBe('2026-12-24');
    expect(stichtagVon('2026-12-24', { versatzTage: 1, werktage: true })).toBe('2026-12-28');
    expect(stichtagVon('2026-10-23', { versatzTage: 2, werktage: true })).toBe('2026-10-27');
  });
  it('Werktage mit Versatz 0: ein Wochenende/Feiertag gilt als der Werktag davor (vor einer Frist nie zu spät)', () => {
    expect(stichtagVon('2026-10-24', { versatzTage: 0, werktage: true })).toBe('2026-10-23'); // Samstag → Freitag
    expect(stichtagVon('2026-12-25', { versatzTage: 0, werktage: true })).toBe('2026-12-24'); // 1. Weihnachtstag → 24.12.
    expect(stichtagVon('2026-10-27', { versatzTage: 0, werktage: true })).toBe('2026-10-27');
  });
  it('das Fenster der Daten am Fall deckt auch lange Werktags-Versätze', () => {
    for (const v of [-90, -28, -1, 0, 2, 45]) {
      const f = datumFeldFenster('2026-10-27', '2026-10-27', { versatzTage: v, werktage: true });
      // Es gibt ein Datum im Fenster, dessen Stichtag der 27.10. ist.
      let gefunden = false;
      for (let d = f.von; d <= f.bis; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) if (stichtagVon(d, { versatzTage: v, werktage: true }) === '2026-10-27') gefunden = true;
      expect(gefunden, `Versatz ${v}`).toBe(true);
    }
  });
});

describe('Merker: erstes Mal nur merken, danach jeder Moment genau einmal', () => {
  it('ohne Merker: nur merken (nichts nachholen) — der Merker ist der jüngste fällige Moment', () => {
    expect(datumFaellig(undefined, '2026-10-26T20:00:00', '08:00', 3)).toEqual({ merker: '2026-10-26T08:00', tage: [] });
    expect(datumFaellig(undefined, '2026-10-26T07:00:00', '08:00', 3)).toEqual({ merker: '2026-10-25T08:00', tage: [] });
  });
  it('vor der Uhrzeit nichts, ab der Uhrzeit der Tag, danach nichts mehr', () => {
    expect(datumFaellig('2026-10-26T08:00', '2026-10-27T07:59:00', '08:00', 3)).toBeNull();
    expect(datumFaellig('2026-10-26T08:00', '2026-10-27T08:00:00', '08:00', 3)).toEqual({ merker: '2026-10-27T08:00', tage: ['2026-10-27'] });
    expect(datumFaellig('2026-10-27T08:00', '2026-10-27T23:00:00', '08:00', 3)).toBeNull();
  });
  it('nach einem Ausfall höchstens n Tage zurück; ohne Uhrzeit gilt 08:00', () => {
    expect(datumFaellig('2026-10-10T08:00', '2026-10-27T09:00:00', undefined, 3)).toEqual({ merker: '2026-10-27T08:00', tage: ['2026-10-25', '2026-10-26', '2026-10-27'] });
  });
  it('scharf nie für einen Stichtag vor dem Scharfschalten (`ab`)', () => {
    expect(datumFaellig('2026-10-20T08:00', '2026-10-27T09:00:00', '08:00', 3, '2026-10-26T12:00:00')).toEqual({ merker: '2026-10-27T08:00', tage: ['2026-10-27'] });
  });
});

describe('Je Fall und Stichtag höchstens ein Lauf (Periode in `starten`)', () => {
  const DEF = definition([schritt(10, 'Prüfen', 1)], { fallArt: 'lead', laeuftAls: 'pia' });
  const anfrage = (id: string, periode: string, jetzt: string) => ({
    id, prozessId: DEF.id, version: 1, def: DEF, fall: { art: 'lead' as const, id: 'c-x' }, modus: 'scharf' as const, person: 'pia',
    ausloeser: { art: 'datum' as const, knoten: fk(3), quelle: periode }, automatisch: true, periode, jetzt,
  });
  it('die Periode ist fest: Knoten + Stichtag', () => {
    expect(datumPeriode('fk-a', '2026-10-27')).toBe('datum:fk-a:2026-10-27');
    expect(istDatumPeriode(datumPeriode('fk-a', '2026-10-27'))).toBe(true);
    expect(istDatumPeriode('zeitplan:fk-a:2026-10-27T08:00')).toBe(false);
  });
  it('offen → „offen“; beendet + dieselbe Periode → „schon“; beendet + neue Periode → neuer Lauf (Wiedereintritt je Periode)', () => {
    const p1 = datumPeriode(fk(3), '2026-10-27');
    const a = starten(laeufeAus(null), anfrage('pl-1', p1, J));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(starten(a.datei, anfrage('pl-2', p1, J))).toMatchObject({ ok: false, grund: 'offen' });
    expect(datumSchonGestartet(a.datei, DEF.id, { art: 'lead', id: 'c-x' }, p1)).toBe(true);
    const fertig: LaeufeDatei = { ...a.datei, laeufe: a.datei.laeufe.map(l => ({ ...l, status: 'fertig' as const, ende: J })) };
    expect(starten(fertig, anfrage('pl-3', p1, J))).toMatchObject({ ok: false, grund: 'schon' });
    expect(datumSchonGestartet(fertig, DEF.id, { art: 'lead', id: 'c-x' }, p1)).toBe(true);
    const p2 = datumPeriode(fk(3), '2027-01-27');
    expect(datumSchonGestartet(fertig, DEF.id, { art: 'lead', id: 'c-x' }, p2)).toBe(false);
    const neu = starten(fertig, anfrage('pl-4', p2, J));
    expect(neu).toMatchObject({ ok: true, lauf: { durchgang: 2, ausloeser: { art: 'datum', quelle: p2 } } });
  });
  it('ohne Datums-Periode gilt die alte Regel (ein Lauf je Fall, Wiedereintritt nur nach Einstellung)', () => {
    const a = starten(laeufeAus(null), { ...anfrage('pl-5', 'ereignis-1', J), ausloeser: { art: 'ereignis' as const, quelle: 'e-1' } });
    if (!a.ok) throw new Error('Start');
    const fertig: LaeufeDatei = { ...a.datei, laeufe: a.datei.laeufe.map(l => ({ ...l, status: 'fertig' as const, ende: J })) };
    expect(starten(fertig, { ...anfrage('pl-6', 'ereignis-2', J), ausloeser: { art: 'ereignis' as const, quelle: 'e-2' } })).toMatchObject({ ok: false, grund: 'schon' });
  });
});

describe('Auslöser: „nur wenn …“ über die Felder des Falls, Satz und Erklärung', () => {
  it('Bedingungen über Fall-Felder werden angenommen, fremde Felder gemeldet', () => {
    const ok = ausloeserAus({ art: 'datum', feld: 'event.datum', versatzTage: -28, uhrzeit: '09:00', bedingungen: [{ feld: 'event.besucht', op: 'gleich', wert: false }] }, 'event');
    expect(ok.befunde).toEqual([]);
    expect(ok.ausloeser).toMatchObject({ art: 'datum', bedingungen: [{ feld: 'event.besucht' }] });
    const fremd = ausloeserAus({ art: 'datum', feld: 'event.datum', versatzTage: 0, bedingungen: [{ feld: 'deal.stufe', op: 'gleich', wert: 'x' }] }, 'event');
    expect(fremd.befunde.length).toBeGreaterThan(0);
  });
  it('Satz und Erklärung nennen Uhrzeit, Werktage und die Quelle', () => {
    const a: Extract<Ausloeser, { art: 'datum' }> = { art: 'datum', feld: 'mandat.kuendigungsfrist', versatzTage: -5, werktage: true, uhrzeit: '09:00' };
    expect(ausloeserText(a)).toBe('5 Werktage vor: Kündigungsfrist des Mandats, 09:00');
    const e = datumErklaerung(a);
    expect(e).toContain('Kalender-Fristen');
    expect(e).toContain('5 Werktage vorher um 09:00');
    expect(e).toContain('Feiertage NRW');
    expect(datumErklaerung({ feld: 'lead.wiedervorlage', versatzTage: 0 })).toContain('am Tag selbst um 08:00');
  });
  it('Vorschau der Werkstatt als Satz (nur Tage und Anzahlen)', () => {
    expect(vorschauText(null, false)).toContain('sobald der Entwurf gespeichert ist');
    expect(vorschauText({ naechste: [], gesamt: 0, tage: 60, gekuerzt: false, lesbar: true }, true)).toBe('In den nächsten 60 Tagen startet kein Fall.');
    expect(vorschauText({ naechste: [{ tag: '2026-10-27', n: 2 }, { tag: '2026-11-03', n: 1 }], gesamt: 9, tage: 60, gekuerzt: false, lesbar: true }, true))
      .toBe('Nächste Starts: 27.10. (2 Fälle) · 03.11. (1 Fall) — in 60 Tagen insgesamt 9 Fälle.');
  });
});

// ══ Takt ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const H = 'haus-datum';
const SCHARF_AM = '2026-10-20T08:00:00.000Z';
// Berliner Zeit (ab 25.10. MEZ = UTC+1): T1 26.10. 20:00 · T2 27.10. 08:05 · T3 27.10. 09:35 · T4 27.10. 19:35 · T5 30.10. 09:35 (Freitag).
const T1 = '2026-10-26T19:00:00.000Z', T2 = '2026-10-27T07:05:00.000Z', T3 = '2026-10-27T08:35:00.000Z', T4 = '2026-10-27T18:35:00.000Z', T5 = '2026-10-30T08:35:00.000Z';
const P_PAUSE = 'pz-00000000-0000-4000-8000-0000000000d1', P_PROBE = 'pz-00000000-0000-4000-8000-0000000000d2', P_ENTWURF = 'pz-00000000-0000-4000-8000-0000000000d3', P_FRIST = 'pz-00000000-0000-4000-8000-0000000000d4';
const vorlagen = new Map<string, string>(); // Vorlage → Prozess

let S: typeof import('@/lib/prozesse/lauf-server');

/** Eine kleine Definition mit Datums-Auslöser (statt „von Hand“). */
function mitDatum(id: string, fallArt: 'lead' | 'deal', a: Extract<Ausloeser, { art: 'datum' }>): ProzessDefinition {
  const d = definition([schritt(60, 'Prüfen', 1), schritt(61, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { id, fallArt, laeuftAls: 'pia' });
  return { ...d, knoten: d.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: a, katalog: { id: 'ausloeser.datum' } } : k)) };
}
const eintrag = (def: ProzessDefinition, status: ProzessEintrag['status']): ProzessEintrag => ({
  id: def.id, entwurf: def, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: def }],
});
const scharf = () => ({ einstellung: { scharf: { am: SCHARF_AM, von: 'pia', version: 1, budgetCent: 500, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });

const takt = (iso: string) => S.prozesseImTakt(new Date(iso));
async function laeufeVon(prozessId: string): Promise<ProzessLauf[]> { return (await S.laeufeLesen(H)).laeufe.filter(l => l.prozessId === prozessId); }
const faelle = (l: ProzessLauf[]) => l.map(x => x.fall.id).sort();

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id, email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    // V08: ruhender Lead mit Wiedervorlage am Stichtag; ein Lead mit Wiedervorlage am Vortag (darf nie nachgeholt werden); ein aktiver Lead (nur wenn „ruht“).
    k('c-ruht', { lead: { status: 'ruht', wiedervorlage: '2026-10-27', grundArt: 'spaeter' } }),
    k('c-alt', { lead: { status: 'ruht', wiedervorlage: '2026-10-26' } }),
    k('c-aktiv', { lead: { status: 'kontaktiert', wiedervorlage: '2026-10-27' } }),
    k('c-m', {}),
    k('c-gesperrt', { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const mandat = (id: string, ende: string, status: string, kontakt: string) => ({
    id, kunde: `Probe ${id}`, kontaktIds: [kontakt], titel: `Probe ${id}`, art: 'projekt', gesellschaft: 'ug', status, vertragUnterschrieben: true, start: '2026-01-01', ende,
    kuendigungsfristTage: 30, verlaengerung: 'manuell', honorar: { betrag: 100, basis: 'monat' }, ustSatz: 19, zahlungszielTage: 14, ziele: [],
    health: { beteiligung: 80, umsetzung: 80, wirkung: 80, zahlung: 80, stimmung: 80 }, leistungen: [], offen: [], geaendert: '2026-10-01',
  });
  await db.saveJson('crm', {
    ...leererBestand(),
    mandate: [
      mandat('m-15', '2027-01-25', 'aktiv', 'c-m'),       // V15: 90 Tage vor dem Ende = 27.10.
      mandat('m-18', '2027-01-25', 'aktiv', 'c-gesperrt'), // V15: Art. 18 → der Lauf endet
      mandat('m-14', '2026-09-12', 'beendet', 'c-m'),     // V14: 45 Tage nach dem Ende = 27.10. (auch beendete Mandate)
    ],
    events: [
      { id: 'ev-b', titel: 'Probe-Messe', format: 'netzwerken', ziel: 'Kontakte', datum: '2026-10-27', status: 'geplant', marke: 'Netzwerken', geaendert: '2026-10-20' }, // V04
      { id: 'ev-b-ab', titel: 'Abgesagte Messe', format: 'netzwerken', ziel: 'Kontakte', datum: '2026-10-27', status: 'abgesagt', marke: 'Netzwerken', geaendert: '2026-10-20' },
      { id: 'ev-eigen-heute', titel: 'Eigener Abend', format: 'stammtisch', ziel: 'Kontakte', datum: '2026-10-27', status: 'geplant', geaendert: '2026-10-20' },
      { id: 'ev-o', titel: 'Probe-Stammtisch', format: 'stammtisch', ziel: 'Kontakte', datum: '2026-11-24', status: 'geplant', geaendert: '2026-10-20' }, // V18: 28 Tage vorher = 27.10.
    ],
    // Frist „Entscheidung bis“ am Montag 02.11. — 1 Werktag vorher = Freitag 30.10.
    chancen: [{ id: 'ch-f', titel: 'Probe Deal', kontaktIds: ['c-m'], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J, erwartetAm: '2026-11-02' }],
  });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  // Die 18 Vorlagen wie über „Aus Vorlage anlegen“ — aktiv und scharf nur V04 · V08 · V14 · V15 · V18; die übrigen Hauptprozesse ruhen (Teilprozesse laufen im Probelauf).
  const [{ ausVorlageAnwenden }, { prozessRechte }, { prozesseAendern }, { KUNDENGEWINNUNG_VORLAGEN }] = await Promise.all([
    import('@/lib/prozesse/kundengewinnung/uebernehmen'), import('@/lib/prozesse/rollen'), import('@/lib/prozesse/werkstatt-server'), import('@/lib/prozesse/kundengewinnung/bibliothek'),
  ]);
  let n = 0;
  const neu = (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const rechte = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false });
  for (const v of KUNDENGEWINNUNG_VORLAGEN) {
    await prozesseAendern<object>(d => {
      const r = ausVorlageAnwenden(d, v.id, { person: 'pia', jetzt: J, rechte, neueKennung: neu, eigner: 'konto-pia' });
      if (!r.ok) throw new Error(`Übernahme ${v.id}: ${JSON.stringify(r)}`);
      return { ok: true, datei: r.datei };
    }, { art: 'person', person: 'pia' }, H);
  }
  const ZIEL = ['kg-v04', 'kg-v08', 'kg-v14', 'kg-v15', 'kg-v18'];
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  const datei = await db.loadJson<{ v: number; prozesse: ProzessEintrag[] }>(prozesseBestand(H));
  const haupt = new Set(KUNDENGEWINNUNG_VORLAGEN.map(v => v.id));
  for (const p of datei!.prozesse) {
    const quelle = p.entwurf.herkunft?.quelleIds?.[0] ?? '';
    if (ZIEL.includes(quelle)) vorlagen.set(quelle, p.id);
  }
  const prozesse: ProzessEintrag[] = datei!.prozesse.map(p => {
    const quelle = p.entwurf.herkunft?.quelleIds?.[0] ?? '';
    if (ZIEL.includes(quelle)) return { ...p, status: 'aktiv' as const };
    return haupt.has(quelle) ? { ...p, status: 'pausiert' as const } : p;
  });
  prozesse.push(
    eintrag(mitDatum(P_PAUSE, 'lead', { art: 'datum', feld: 'lead.wiedervorlage', versatzTage: 0, uhrzeit: '08:00' }), 'pausiert'),
    eintrag(mitDatum(P_PROBE, 'lead', { art: 'datum', feld: 'lead.wiedervorlage', versatzTage: 0, uhrzeit: '08:00' }), 'probelauf'),
    eintrag(mitDatum(P_ENTWURF, 'lead', { art: 'datum', feld: 'lead.wiedervorlage', versatzTage: 0, uhrzeit: '08:00' }), 'entwurf'),
    eintrag(mitDatum(P_FRIST, 'deal', { art: 'datum', feld: 'deal.entscheidung', versatzTage: -1, werktage: true, uhrzeit: '09:00' }), 'aktiv'),
  );
  await db.saveJson(prozesseBestand(H), { ...datei, prozesse });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { ...Object.fromEntries([...vorlagen.values()].map(id => [id, scharf()])), [P_PAUSE]: scharf(), [P_FRIST]: scharf() } });
  S = await import('@/lib/prozesse/lauf-server');
}, 120_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Vorlagen: der Datums-Auslöser nennt, worauf er hört', () => {
  it('die fünf Vorlagen sind veröffentlicht; V04 nur besuchte, V18 nur eigene Events, V08 nur ruhende Leads, V15 nur aktive Mandate', async () => {
    expect([...vorlagen.keys()].sort()).toEqual(['kg-v04', 'kg-v08', 'kg-v14', 'kg-v15', 'kg-v18']);
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const d = await prozesseLesen(H);
    const ausloeser = (v: string) => d.prozesse.find(p => p.id === vorlagen.get(v))!.versionen.at(-1)!.definition.knoten.find(k => k.ausloeser?.art === 'datum')!.ausloeser!;
    expect(ausloeser('kg-v04')).toMatchObject({ feld: 'event.datum', versatzTage: 0, bedingungen: [{ feld: 'event.besucht', wert: true }, { feld: 'event.status', op: 'ungleich' }] });
    expect(ausloeser('kg-v18')).toMatchObject({ feld: 'event.datum', versatzTage: -28, bedingungen: [{ feld: 'event.besucht', wert: false }, { feld: 'event.status', op: 'ungleich' }] });
    expect(ausloeser('kg-v08')).toMatchObject({ feld: 'lead.wiedervorlage', bedingungen: [{ feld: 'lead.status', wert: 'ruht' }] });
    expect(ausloeser('kg-v15')).toMatchObject({ feld: 'mandat.ende', versatzTage: -90, bedingungen: [{ feld: 'mandat.status', wert: 'aktiv' }] });
    expect(ausloeser('kg-v14')).toMatchObject({ feld: 'mandat.ende', versatzTage: 45 });
  });
  it('Vorschau der Werkstatt: nur Tage und Anzahlen (V18 am 27.10. ein Fall)', async () => {
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const p = (await prozesseLesen(H)).prozesse.find(x => x.id === vorlagen.get('kg-v18'))!;
    const knoten = p.entwurf.knoten.find(k => k.ausloeser?.art === 'datum')!.id;
    const v = await S.datumVorschau(p.id, knoten, H, new Date('2026-10-22T10:00:00.000Z'));
    expect(v).toMatchObject({ naechste: [{ tag: '2026-10-27', n: 1 }], gesamt: 1, lesbar: true });
    expect(JSON.stringify(v)).not.toMatch(/Probe|example\.invalid|ev-/);
    expect(await S.datumVorschau(p.id, p.entwurf.knoten.find(k => k.form !== 'ausloeser' && k.elternId)!.id, H)).toBeNull();
  });
  it('bestehende Fälle beim Scharfschalten: Stichtag in den letzten Tagen erreicht — mit derselben Periode wie der Datums-Start', async () => {
    const kx = await S.kontextLaden(new Date(T3), H);
    const def = kx.prozesse.prozesse.find(p => p.id === P_PAUSE)!.versionen[0].definition;
    const b = await S.bestehendeFaelle(def, kx);
    expect(b.map(x => x.fall.id).sort()).toEqual(['c-aktiv', 'c-alt', 'c-ruht']);
    expect(b.find(x => x.fall.id === 'c-alt')?.periode).toBe(datumPeriode(fk(3), '2026-10-26'));
  });
});

describe('Takt: Datum am Fall startet selbst — erstes Mal nur merken, nichts doppelt', () => {
  it('erster Takt (26.10. 20:00): startet nichts — auch nicht die Wiedervorlage von heute (nicht nachholen); merkt je Auslöser', async () => {
    await takt(T1);
    const d = await S.laeufeLesen(H);
    expect(d.laeufe).toEqual([]);
    for (const id of [...vorlagen.values(), P_PROBE, P_FRIST]) expect(Object.keys(d.prozesse[id]?.datum ?? {}).length, id).toBe(1);
    // Pausiert und Entwurf merken nicht einmal (sie laufen nicht).
    expect(d.prozesse[P_PAUSE]?.datum).toBeUndefined();
  });
  it('27.10. 08:05: V08 startet genau den ruhenden Lead mit Wiedervorlage heute (scharf) — Probelauf im Schatten, pausiert/Entwurf nie', async () => {
    await takt(T2);
    const v08 = await laeufeVon(vorlagen.get('kg-v08')!);
    expect(faelle(v08)).toEqual(['c-ruht']);
    expect(v08[0]).toMatchObject({ modus: 'scharf', ausloeser: { art: 'datum', quelle: expect.stringMatching(/^datum:.+:2026-10-27$/) }, daten: { 'datum.stichtag': '2026-10-27', 'datum.feld': 'lead.wiedervorlage', 'bezug.kontaktid': 'c-ruht' } });
    // Ohne „nur wenn“: beide Leads mit Wiedervorlage heute — c-alt (gestern) nie.
    const probe = await laeufeVon(P_PROBE);
    expect(faelle(probe)).toEqual(['c-aktiv', 'c-ruht']);
    expect(probe.every(l => l.modus === 'schatten')).toBe(true);
    expect(await laeufeVon(P_PAUSE)).toEqual([]);
    expect(await laeufeVon(P_ENTWURF)).toEqual([]);
    // Die übrigen Vorlagen haben andere Uhrzeiten (09:00, 19:00) — noch nichts.
    for (const v of ['kg-v04', 'kg-v14', 'kg-v15', 'kg-v18']) expect(await laeufeVon(vorlagen.get(v)!), v).toEqual([]);
  });
  it('doppelter Takt: startet nichts doppelt', async () => {
    const vorher = (await S.laeufeLesen(H)).laeufe.length;
    await takt(T2);
    await takt('2026-10-27T07:30:00.000Z');
    expect((await S.laeufeLesen(H)).laeufe.length).toBe(vorher);
  });
  it('27.10. 09:35: V15 (90 Tage vor dem Ende, aktiv), V14 (45 Tage nach dem Ende, auch beendet), V18 (28 Tage vor dem eigenen Event) — Art. 18 endet', async () => {
    await takt(T3);
    expect(faelle(await laeufeVon(vorlagen.get('kg-v15')!))).toEqual(['m-15', 'm-18']);
    expect(faelle(await laeufeVon(vorlagen.get('kg-v14')!))).toEqual(['m-14']);
    expect(faelle(await laeufeVon(vorlagen.get('kg-v18')!))).toEqual(['ev-o']);
    const gesperrt = (await laeufeVon(vorlagen.get('kg-v15')!)).find(l => l.fall.id === 'm-18')!;
    expect(gesperrt).toMatchObject({ status: 'abgebrochen', grund: 'art18' });
    expect(await laeufeVon(vorlagen.get('kg-v04')!)).toEqual([]);
  });
  it('27.10. 19:35: V04 startet das besuchte Event — nie das abgesagte, nie den eigenen Abend', async () => {
    await takt(T4);
    await takt(T4);
    expect(faelle(await laeufeVon(vorlagen.get('kg-v04')!))).toEqual(['ev-b']);
    // Je Fall genau ein Lauf über alle Takte.
    const d = await S.laeufeLesen(H);
    const je = new Map<string, number>();
    for (const l of d.laeufe) je.set(`${l.prozessId}|${l.fall.id}`, (je.get(`${l.prozessId}|${l.fall.id}`) ?? 0) + 1);
    expect([...je.values()].every(n => n === 1)).toBe(true);
  });
  it('Frist über `fristenLesen`, 1 Werktag vorher: „Entscheidung bis“ Montag 02.11. startet Freitag 30.10. (nicht Sonntag)', async () => {
    expect(await laeufeVon(P_FRIST)).toEqual([]);
    await takt(T5);
    const l = await laeufeVon(P_FRIST);
    expect(faelle(l)).toEqual(['ch-f']);
    expect(l[0]).toMatchObject({ modus: 'scharf', daten: { 'datum.stichtag': '2026-10-30', 'bezug.dealid': 'ch-f' } });
    // Nach dem Takt nichts mehr nachgeholt: die Vorlagen bleiben bei ihren Läufen.
    expect(faelle(await laeufeVon(vorlagen.get('kg-v08')!))).toEqual(['c-ruht']);
  });
  it('die Läufe tragen nur Kennungen (keine Namen, keine Adressen)', async () => {
    const roh = JSON.stringify((await S.laeufeLesen(H)).laeufe);
    for (const x of ['Probe-Messe', 'example.invalid', 'Probe m-15']) expect(roh).not.toContain(x);
  });
});
