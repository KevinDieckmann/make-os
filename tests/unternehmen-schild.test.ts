// Unternehmen › Schild (10.10., Branch `unternehmen-schild`): Pflichtdokumente je Rechtsform, Pflichten-Kalender (gerechnet, nur Vermerke
// gespeichert), Schwellen, Risiko-Register (quartalsweise + Ereignisse), Marken/Domains/Versicherungen, Vorlagen, Struktur/Cap-Table,
// Compliance-Ampel — und am Server: Rechte (nur Haushalt des Inhabers), Privat-Einheit nie, Stand/409, Erinnerungen idempotent, Kalender,
// Altbestand des Registers bleibt bit-gleich. Eigener Datenordner, erfundene Konten (@example.invalid) und Daten — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { RegisterGesellschaft, RegisterDatei } from '@/lib/gesellschaften/modell';
import { monatePlus, geschaeftsjahresEnden, gjLabel, quartal } from '@/lib/gesellschaften/schild/zeit';
import { kontextVon } from '@/lib/gesellschaften/schild/kontext';
import { dokumenteSoll, dokSchwere, aufbewahrenBis, DOKUMENT_KATALOG } from '@/lib/gesellschaften/schild/dokumente';
import { pflichtenFuer, schwellenFuer, PFLICHT_REGELN, EREIGNIS_ARTEN, steuerImModul } from '@/lib/gesellschaften/schild/pflichten';
import { ampelVon, aktuelleBewertung, naechstePruefung, neuBewertenAnlaesse, rundeFaellig, aggregation, RISIKO_KATALOG } from '@/lib/gesellschaften/schild/risiken';
import { markeFristen, domainZustand, policeFristen, schutzStichtage } from '@/lib/gesellschaften/schild/schutz';
import { VORLAGEN, entwurfAus, vorlageVon, LUECKE } from '@/lib/gesellschaften/schild/vorlagen';
import { capTable, durchgerechnet, organigramm, strukturHistorie } from '@/lib/gesellschaften/schild/struktur';
import { lageAus, schildFristen, faelligeSchildErinnerungen, schildGesellschaften, istSchildAufgabe } from '@/lib/gesellschaften/schild/ampel';
import { eintragAnwenden, vermerkAnwenden, bewertungAnwenden, katalogUebernehmen, profilAnwenden, eintragHandeln, schildAufraeumen, schildOhnePerson, type Kontext } from '@/lib/gesellschaften/schild/saeubern';
import type { SchildGesellschaft, Risiko } from '@/lib/gesellschaften/schild/typen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-schild-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-schild';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const HEUTE = '2026-10-10';
const G1 = 'g-11111111-1111-4111-8111-111111111111';
const K: Kontext = { person: 'person-a', jetzt: '2026-10-10T08:00:00.000Z', heute: HEUTE, personen: ['person-a', 'person-b'] };
const gmbh = (x: Partial<RegisterGesellschaft> = {}): RegisterGesellschaft => ({ id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }], ...x });

describe('Zeit: Monate mit Monatsende, Geschäftsjahre, Quartal', () => {
  it('Monatsende bleibt Monatsende, sonst gekappt', () => {
    expect(monatePlus('2025-12-31', 3)).toBe('2026-03-31');
    expect(monatePlus('2025-12-31', 6)).toBe('2026-06-30');
    expect(monatePlus('2025-12-31', 11)).toBe('2026-11-30');
    expect(monatePlus('2026-01-31', 1)).toBe('2026-02-28');
    expect(monatePlus('2026-01-15', -3)).toBe('2025-10-15');
  });
  it('Geschäftsjahre: Kalenderjahr und abweichend; vor der Gründung keins', () => {
    expect(geschaeftsjahresEnden(undefined, '2024-01-01', '2026-12-31', '2025-03-01')).toEqual(['2025-12-31', '2026-12-31']);
    expect(geschaeftsjahresEnden(7, '2025-01-01', '2026-12-31')).toEqual(['2025-06-30', '2026-06-30']);
    expect(gjLabel('2025-12-31')).toBe('GJ 2025');
    expect(gjLabel('2026-06-30')).toBe('GJ 2025/26');
    expect(quartal(HEUTE)).toBe('2026-Q4');
  });
});

describe('Pflichtdokumente: Soll-Liste je Rechtsform, Zustand, Aufbewahrung', () => {
  it('GmbH mit einem Gesellschafter: Satzung, Liste, Transparenzregister, § 35 Abs. 3 Pflicht; Gesellschaftervereinbarung nicht', () => {
    const g = gmbh();
    const arten = dokumenteSoll(g, null, kontextVon(g), HEUTE).map(d => d.katalog.art);
    for (const a of ['satzung', 'gesellschafterliste', 'transparenzregister', 'befreiung-181', 'jahresabschluss', 'krisenfrueherkennung']) expect(arten).toContain(a);
    expect(arten).not.toContain('gesellschaftervereinbarung');
    expect(arten).not.toContain('euer');
    const satzung = dokumenteSoll(g, null, kontextVon(g), HEUTE).find(d => d.katalog.art === 'satzung')!;
    expect(satzung).toMatchObject({ zustand: 'fehlt', stufe: 'pflicht' });
    expect(dokSchwere(satzung)).toBe('rot');
  });
  it('Einzelunternehmen: EÜR statt Satzung; Holding: Beteiligungsquoten; Beschäftigte bringen Personal-Pflichten', () => {
    const e = { id: G1, rechtsform: 'einzel' } as RegisterGesellschaft;
    const a = dokumenteSoll(e, null, kontextVon(e), HEUTE).map(d => d.katalog.art);
    expect(a).toContain('euer'); expect(a).not.toContain('satzung');
    const h = gmbh({ id: 'kdv', rolle: 'holding' });
    expect(dokumenteSoll(h, null, kontextVon(h), HEUTE).map(d => d.katalog.art)).toContain('beteiligungsquoten');
    const s: SchildGesellschaft = { id: 'ug', profil: { beschaeftigte: 3 } };
    expect(dokumenteSoll(gmbh(), s, kontextVon(gmbh(), s), HEUTE).map(d => d.katalog.art)).toEqual(expect.arrayContaining(['arbeitsvertraege', 'gefaehrdungsbeurteilung', 'bg']));
  });
  it('vorhanden · abgelaufen · prüfen · veraltet · nicht nötig · aus dem Register erkannt', () => {
    const g = gmbh({ gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja', eingetretenAm: '2026-02-01' }],
      vertraege: [{ id: 'vt-aaaa-0001', art: 'gesellschaftsvertrag', titel: 'Satzung', parteien: [], status: 'beurkundet' }] });
    const s: SchildGesellschaft = { id: 'ug', dokumente: [
      { id: 'dok-1', art: 'gesellschafterliste', status: 'vorhanden', fassungVom: '2025-01-01' },
      { id: 'dok-2', art: 'elster-zertifikat', status: 'vorhanden', fassungVom: '2023-09-01', gueltigBis: '2026-09-01' },
      { id: 'dok-3', art: 'vvt', status: 'vorhanden', fassungVom: '2025-09-01' },
      { id: 'dok-4', art: 'gf-vertrag', status: 'nicht-noetig', grund: 'Fremd-GF über Dienstleister' },
      { id: 'dok-5', art: 'tom', status: 'vorhanden', fassungVom: '2026-05-01' },
    ] };
    const z = Object.fromEntries(dokumenteSoll(g, s, kontextVon(g, s), HEUTE).map(d => [d.katalog.art, d]));
    expect(z.gesellschafterliste.zustand).toBe('veraltet');
    expect(z['elster-zertifikat'].zustand).toBe('abgelaufen');
    expect(dokSchwere(z['elster-zertifikat'])).toBe('rot');
    expect(z.vvt.zustand).toBe('pruefen');
    expect(z['gf-vertrag'].zustand).toBe('nicht-noetig');
    expect(z.tom).toMatchObject({ zustand: 'vorhanden', pruefenAm: '2027-05-01' });
    expect(z.satzung).toMatchObject({ zustand: 'vorhanden', ausRegister: true });
  });
  it('Jahresabschluss je Geschäftsjahr: Soll ist das Jahr, dessen Offenlegungsfrist verstrichen ist', () => {
    const g = gmbh();
    const mit = (gj: number) => dokumenteSoll(g, { id: 'ug', dokumente: [{ id: 'dok-j', art: 'jahresabschluss', status: 'vorhanden', geschaeftsjahr: gj }] }, kontextVon(g), HEUTE).find(d => d.katalog.art === 'jahresabschluss')!;
    expect(mit(2024)).toMatchObject({ zustand: 'vorhanden', noetigFuer: '2024-12-31' });
    expect(mit(2023)).toMatchObject({ zustand: 'fehlt', noetigFuer: '2024-12-31' });
    const jung = gmbh({ gegruendetAm: '2026-03-01' });
    expect(dokumenteSoll(jung, null, kontextVon(jung), HEUTE).find(d => d.katalog.art === 'jahresabschluss')!.zustand).toBe('noch-nicht-faellig');
  });
  it('Aufbewahrung ab Ende des Kalenderjahres; dauerhaft; Laufzeit + 10', () => {
    expect(aufbewahrenBis({ fassungVom: '2025-03-15' }, { jahre: 10 })).toBe('2035-12-31');
    expect(aufbewahrenBis({ fassungVom: '2025-03-15' }, 'dauerhaft')).toBe('dauerhaft');
    expect(aufbewahrenBis({ gueltigBis: '2027-06-30' }, 'laufzeit10')).toBe('2037-12-31');
  });
  it('Katalog: eindeutige Kennungen, jede Zeile mit Norm, Hinweis und Quelle; keine Namen', () => {
    const arten = DOKUMENT_KATALOG.map(k => k.art);
    expect(new Set(arten).size).toBe(arten.length);
    for (const k of DOKUMENT_KATALOG) { expect(k.norm.length, k.art).toBeGreaterThan(0); expect(k.hinweis.length, k.art).toBeGreaterThan(10); expect(k.quelle.length, k.art).toBeGreaterThan(0); }
  });
});

describe('Pflichten-Kalender: gerechnet, nie gespeichert — nur Vermerke', () => {
  const pf = (g: RegisterGesellschaft, s?: SchildGesellschaft) => pflichtenFuer(kontextVon(g, s), s, HEUTE);
  const finde = (l: ReturnType<typeof pf>, regel: string, periode: string) => l.find(p => p.regelId === regel && p.periode === periode);
  it('GmbH, Kalenderjahr: aufstellen 3 M, feststellen 8 M, offenlegen 12 M; klein: 6 M bzw. 11 M', () => {
    const l = pf(gmbh());
    expect(finde(l, 'ja-aufstellen', '2025-12-31')).toMatchObject({ frist: '2026-03-31', status: 'ueberfaellig' });
    expect(finde(l, 'ja-feststellen', '2025-12-31')).toMatchObject({ frist: '2026-08-31', status: 'ueberfaellig' });
    // Offenlegen: die Hauptgesellschaft führt seit 15.10. das Steuer-Modul (`steuerImModul`, „nur einmal“) — die 12-Monats-Regel des Schilds gilt für
    // eine Gesellschaft aus dem Register, die nicht im Steuer-Modul steht.
    expect(finde(l, 'ja-offenlegen', '2025-12-31')).toBeUndefined();
    const reg = pf(gmbh({ id: G1 }));
    expect(finde(reg, 'ja-offenlegen', '2024-12-31')).toMatchObject({ frist: '2025-12-31', status: 'ueberfaellig' });
    expect(finde(reg, 'ja-offenlegen', '2025-12-31')).toMatchObject({ frist: '2026-12-31', status: 'offen' });
    expect(finde(l, 'ug-ruecklage', '2025-12-31')).toBeUndefined();
    expect(finde(l, 'gv-einladung', '2025-12-31')).toBeUndefined(); // ein Gesellschafter → keine Einladung, Niederschrift
    const klein: SchildGesellschaft = { id: 'ug', profil: { groessenklasse: 'klein' } };
    const k = pf(gmbh(), klein);
    expect(finde(k, 'ja-aufstellen', '2025-12-31')!.frist).toBe('2026-06-30');
    expect(finde(k, 'ja-feststellen', '2025-12-31')).toMatchObject({ frist: '2026-11-30', status: 'offen' });
  });
  it('UG: Rücklage mit der Feststellung; zwei Gesellschafter: Einladung eine Woche vorher; abweichendes Geschäftsjahr', () => {
    const ug = gmbh({ id: 'kdv', rechtsform: 'ug', gesellschafter: [
      { id: 'gs-aaaa-0001', wer: { art: 'person', id: 'person-a' }, nennbetragCent: 300_000, einlage: 'ja' },
      { id: 'gs-aaaa-0002', wer: { art: 'person', id: 'person-b' }, nennbetragCent: 200_000, einlage: 'ja' }] });
    const l = pf(ug);
    expect(finde(l, 'ug-ruecklage', '2025-12-31')!.frist).toBe('2026-08-31');
    expect(finde(l, 'gv-einladung', '2025-12-31')!.frist).toBe('2026-08-24');
    const abw = pf(gmbh({ geschaeftsjahrBeginn: 7 }));
    expect(finde(abw, 'ja-aufstellen', '2026-06-30')).toMatchObject({ frist: '2026-09-30', periodeLabel: 'GJ 2025/26' });
  });
  it('Vermerk „erledigt“ bzw. „trifft nicht zu“ entscheidet den Status; geplante und aufgelöste Gesellschaften haben keinen Jahreszyklus', () => {
    const s: SchildGesellschaft = { id: 'ug', vermerke: [
      { id: 'vm-1', regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', am: '2026-03-20', von: 'person-a' },
      { id: 'vm-2', regelId: 'ja-feststellen', periode: '2025-12-31', status: 'nicht-zutreffend', am: '2026-09-01', von: 'person-a' }] };
    const l = pf(gmbh(), s);
    expect(finde(l, 'ja-aufstellen', '2025-12-31')!.status).toBe('erledigt');
    expect(finde(l, 'ja-feststellen', '2025-12-31')!.status).toBe('nicht-zutreffend');
    expect(pf(gmbh({ status: 'geplant' }))).toEqual([]);
    expect(pf(gmbh({ status: 'gruendung', gegruendetAm: undefined }))).toEqual([]);
  });
  it('Ereignis „Anteilsübertragung“: Liste + Transparenzregister unverzüglich (Vorschlag 14 Tage), SV-Status vorher', () => {
    const s: SchildGesellschaft = { id: 'ug', ereignisse: [{ id: 'ev-aaaa-0001', art: 'anteilsuebertragung', datum: '2026-10-01' }] };
    const l = pf(gmbh(), s).filter(p => p.ereignisId);
    expect(l.find(p => p.regelId === 'ev:gesellschafterliste')).toMatchObject({ frist: '2026-10-15', status: 'faellig', annahme: true });
    expect(l.find(p => p.regelId === 'ev:sv-status')).toMatchObject({ frist: '2026-10-01', status: 'ueberfaellig' });
    // Ein Ereignis, das für die Rechtsform nicht gilt, bringt keine Pflichten (UG-Krisenpflicht bei einer GmbH).
    expect(pf(gmbh(), { id: 'ug', ereignisse: [{ id: 'ev-aaaa-0002', art: 'ug-drohende-zu', datum: '2026-10-01' }] }).filter(p => p.ereignisId)).toEqual([]);
  });
  it('Regeln und Ereignisse: eindeutige Kennungen, jede mit Norm und Quelle', () => {
    const ids = PFLICHT_REGELN.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of PFLICHT_REGELN) expect(r.norm.length).toBeGreaterThan(2);
    for (const e of EREIGNIS_ARTEN) { expect(e.pflichten.length, e.id).toBeGreaterThan(0); for (const p of e.pflichten) expect(p.quelle.length).toBeGreaterThan(0); }
    expect(steuerImModul('kdv')).toBe(true);
    expect(steuerImModul('ug')).toBe(true); // seit 15.10. wie KD Ventures
    expect(steuerImModul(G1)).toBe(false);
  });
  it('Schwellen-Wächter: unbekannt ohne Profil, erreicht ab 10/20/50 Personen bzw. 800.000 € Umsatz; „umgesetzt“ per Vermerk', () => {
    const ohne = schwellenFuer(kontextVon(gmbh()), null);
    expect(ohne.find(z => z.def.id === 'dsb')!.stand).toBe('unbekannt');
    const s: SchildGesellschaft = { id: 'ug', profil: { beschaeftigte: 22, umsatzVorjahrCent: 90_000_000, bilanzsummeCent: 10_000_000 }, vermerke: [{ id: 'vm-3', regelId: 'schwelle:dsb', periode: 'laufend', status: 'erledigt', am: HEUTE, von: 'person-a' }] };
    const z = Object.fromEntries(schwellenFuer(kontextVon(gmbh(), s), s).map(x => [x.def.id, x]));
    expect(z.bfsg.stand).toBe('erreicht'); expect(z.dsb.stand).toBe('erreicht'); expect(z.dsb.umgesetzt).toBeTruthy();
    expect(z.hinschg.stand).toBe('nicht'); expect(z.erechnung.stand).toBe('erreicht');
    expect(z.buchfuehrung).toBeUndefined(); // nur Einzelunternehmen
  });
});

describe('Risiko-Register: Bewertung, quartalsweise Prüfung, Anlässe, Aggregation', () => {
  const r = (x: Partial<Risiko> = {}): Risiko => ({ id: 'rk-aaaa-0001', titel: 'Liquidität', kategorie: 'liquiditaet', status: 'offen', bewertungen: [], angelegt: '2026-01-01T00:00:00.000Z', ...x });
  it('Ampel: rot ab 15 oder Wirkung 5, gelb 8–14, grün ≤ 7', () => {
    expect(ampelVon({ eintritt: 3, wirkung: 5 })).toBe('rot');
    expect(ampelVon({ eintritt: 5, wirkung: 3 })).toBe('rot');
    expect(ampelVon({ eintritt: 2, wirkung: 4 })).toBe('gelb');
    expect(ampelVon({ eintritt: 2, wirkung: 3 })).toBe('gruen');
    expect(ampelVon(undefined)).toBe('offen');
  });
  it('maßgeblich ist die jüngste Netto-Bewertung; nächste Prüfung drei Monate nach der jüngsten', () => {
    const x = r({ bewertungen: [{ am: '2026-03-01', von: 'a', eintritt: 4, wirkung: 4, art: 'brutto' }, { am: '2026-03-01', von: 'a', eintritt: 2, wirkung: 3, art: 'netto' }, { am: '2026-07-01', von: 'a', eintritt: 5, wirkung: 5, art: 'brutto' }] });
    expect(aktuelleBewertung(x)).toMatchObject({ eintritt: 2, wirkung: 3, art: 'netto' });
    expect(naechstePruefung(x, HEUTE)).toBe('2026-10-01');
    expect(naechstePruefung(r({ status: 'erledigt' }), HEUTE)).toBeUndefined();
  });
  it('Quartals-Runde und Anlässe: Ereignis, neuer Vertrag, Gesellschafterwechsel, erreichte Schwelle — alles seit der letzten Runde', () => {
    const g = gmbh({ vertraege: [{ id: 'vt-aaaa-0002', art: 'kooperation', titel: 'Rahmenvertrag', parteien: [], status: 'unterschrieben', beginn: '2026-09-01' }],
      gesellschafter: [{ id: 'gs-aaaa-0003', wer: { art: 'person', id: 'person-a' }, nennbetragCent: 2_500_000, einlage: 'ja', eingetretenAm: '2026-08-15' }] });
    const s: SchildGesellschaft = { id: 'ug', profil: { beschaeftigte: 25, geaendert: '2026-09-20T00:00:00.000Z' },
      ereignisse: [{ id: 'ev-aaaa-0003', art: 'gf-wechsel', datum: '2026-09-10' }],
      risiken: [r({ bewertungen: [{ am: '2026-06-01', von: 'a', eintritt: 2, wirkung: 2, art: 'netto' }] })] };
    const a = neuBewertenAnlaesse(g, s, kontextVon(g, s), HEUTE).map(x => x.id);
    expect(a).toEqual(expect.arrayContaining(['ev:ev-aaaa-0003', 'vt:vt-aaaa-0002', 'gs:gs-aaaa-0003:ein', 'sw:dsb']));
    expect(rundeFaellig(s, HEUTE)).toMatchObject({ faellig: true, quartal: '2026-Q4', anzahl: 1 });
    // Nach einer neuen Bewertung heute ist nichts mehr offen.
    const neu = { ...s, risiken: [r({ bewertungen: [{ am: HEUTE, von: 'a', eintritt: 2, wirkung: 2, art: 'netto' }] })] };
    expect(neuBewertenAnlaesse(g, neu, kontextVon(g, neu), HEUTE)).toEqual([]);
    expect(rundeFaellig(neu, HEUTE).faellig).toBe(false);
    // Ohne Risiken keine Anlässe (erst den Katalog übernehmen).
    expect(neuBewertenAnlaesse(g, { ...s, risiken: [] }, kontextVon(g, s), HEUTE)).toEqual([]);
  });
  it('Aggregation: Summe der Netto-Wirkungen gegen die Tragfähigkeit', () => {
    const s: SchildGesellschaft = { id: 'ug', profil: { tragfaehigkeitCent: 1_000_000 }, risiken: [
      r({ id: 'rk-aaaa-0010', bewertungen: [{ am: HEUTE, von: 'a', eintritt: 4, wirkung: 4, art: 'netto', wirkungCent: 800_000 }] }),
      r({ id: 'rk-aaaa-0011', bewertungen: [{ am: HEUTE, von: 'a', eintritt: 3, wirkung: 3, art: 'netto', wirkungCent: 400_000 }] }),
      r({ id: 'rk-aaaa-0012', bewertungen: [{ am: HEUTE, von: 'a', eintritt: 1, wirkung: 1, art: 'netto', wirkungCent: 9_000_000 }] })] };
    expect(aggregation(s, HEUTE)).toMatchObject({ summeCent: 1_200_000, anteil: 120, warnung: true });
  });
  it('Startkatalog: 17 generische Risiken ohne Namen', () => {
    expect(RISIKO_KATALOG.map(x => x.id)).toEqual(Array.from({ length: 17 }, (_, i) => `R${i + 1}`));
  });
});

describe('Marken, Domains, Versicherungen', () => {
  it('Marke DPMA: Schutz bis Monatsende nach 10 Jahren, Verlängerungsfenster 6 Monate, Nachfrist; EUIPO taggenau', () => {
    expect(markeFristen({ id: 'mk-aaaa-0001', bezeichnung: 'Beispielmarke', amt: 'dpma', anmeldetag: '2016-11-15' }, HEUTE)).toMatchObject({ schutzEnde: '2026-11-30', verlaengerungAb: '2026-05-31', nachfristBis: '2027-05-31', zustand: 'verlaengern' });
    expect(markeFristen({ id: 'mk-aaaa-0002', bezeichnung: 'Alt', amt: 'dpma', anmeldetag: '2016-03-15' }, HEUTE).zustand).toBe('abgelaufen');
    expect(markeFristen({ id: 'mk-aaaa-0003', bezeichnung: 'EU', amt: 'euipo', anmeldetag: '2020-05-05', eintragungstag: '2020-09-01' }, HEUTE)).toMatchObject({ schutzEnde: '2030-05-05', zustand: 'ok', schonfristEnde: '2025-12-01', schonfristGeschaetzt: true });
  });
  it('Domain: Ablauf, automatische Verlängerung', () => {
    expect(domainZustand({ id: 'dm-1', domain: 'beispiel.de', laeuftBis: '2026-10-20' }, HEUTE)).toBe('bald');
    expect(domainZustand({ id: 'dm-1', domain: 'beispiel.de', laeuftBis: '2026-10-01' }, HEUTE)).toBe('abgelaufen');
    expect(domainZustand({ id: 'dm-1', domain: 'beispiel.de', laeuftBis: '2027-10-01' }, HEUTE)).toBe('ok');
  });
  it('Versicherung: stillschweigende Verlängerung, „kündigen bis“, Sonderkündigung nach drei Jahren, gekündigt', () => {
    expect(policeFristen({ id: 'vs-1', art: 'cyber', beginn: '2022-01-01', ablauf: '2025-01-01' }, HEUTE)).toMatchObject({ periodeEnde: '2028-01-01', kuendigenBis: '2027-10-01', zustand: 'ok' });
    expect(policeFristen({ id: 'vs-1', art: 'cyber', beginn: '2022-01-01', ablauf: '2025-01-01' }, HEUTE).sonderkuendigung).toMatch(/§ 11 Abs\. 4 VVG/);
    expect(policeFristen({ id: 'vs-2', art: 'do', ablauf: '2027-01-31' }, HEUTE)).toMatchObject({ kuendigenBis: '2026-10-31', zustand: 'kuendigen-bald' });
    expect(policeFristen({ id: 'vs-3', art: 'do', ablauf: '2027-01-31', gekuendigtZum: '2027-01-31' }, HEUTE).zustand).toBe('gekuendigt');
    const st = schutzStichtage({ id: 'ug', versicherungen: [{ id: 'vs-2', art: 'do', ablauf: '2027-01-31' }] }, HEUTE);
    expect(st.find(x => x.id === 'vs-kuend-vs-2')).toMatchObject({ tag: '2026-10-31', kuendigung: true });
  });
});

describe('Vorlagen → Entwurf (regelbasiert, ohne Modell)', () => {
  it('füllt nur aus dem Register, Unbekanntes bleibt „[…]“, Hinweis vorne', () => {
    const e = entwurfAus(vorlageVon('feststellung-ja')!, gmbh({ firmierung: 'Beispiel GmbH', sitz: 'Musterstadt' }), HEUTE);
    expect(e.text.startsWith('Mustertext zum Ausfüllen')).toBe(true);
    expect(e.text).toContain('Beispiel GmbH');
    expect(e.text).toContain('Geschäftsjahr 2025');
    expect(e.text).toContain(`Handelsregister ${LUECKE}`);
    expect(e.text).not.toMatch(/\{\{/);
  });
  it('alle Vorlagen ohne Namen oder Beträge, jede mit Norm', () => {
    for (const v of VORLAGEN) { expect(v.norm.length).toBeGreaterThan(2); expect(v.text).not.toMatch(/\d{1,3}\.\d{3}(,\d{2})? ?€/); }
  });
});

describe('Struktur & Cap-Table', () => {
  const kdv = { id: 'kdv', rechtsform: 'ug', gesellschafter: [{ id: 'gs-k-0001', wer: { art: 'person', id: 'person-a' }, nennbetragCent: 500_000, einlage: 'ja', eingetretenAm: '2021-06-15' }] } as RegisterGesellschaft;
  const ug = gmbh({ gesellschafter: [
    { id: 'gs-u-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_000_000, einlage: 'ja' },
    { id: 'gs-u-0002', wer: { art: 'kontakt', id: 'c-beispiel-1' }, nennbetragCent: 500_000, einlage: 'nein', ohneStimmrecht: true, eingetretenAm: '2026-02-01' }],
    beteiligungen: [{ id: 'bt-u-0001', firmaId: 'f-beispiel', anteilProzent: 10 }] });
  it('Anteile und Stimmen (stimmrechtslose Anteile zählen nicht)', () => {
    const ct = capTable(ug);
    expect(ct.zeilen.map(z => [z.anteil, z.stimmen])).toEqual([[80, 100], [20, 0]]);
  });
  it('durchgerechnet über die Holding: wirtschaftlich berechtigt über 25 %', () => {
    const d = durchgerechnet('ug', [kdv, ug]);
    expect(d.find(x => x.wer.id === 'person-a')).toMatchObject({ prozent: 80, wirtschaftlichBerechtigt: true, ueber: ['kdv'] });
    expect(d.find(x => x.wer.id === 'c-beispiel-1')).toMatchObject({ prozent: 20, wirtschaftlichBerechtigt: false });
  });
  it('Organigramm: Gesellschafter oben, Holding, Tochter, fremde Beteiligung unten — Kreise laufen nicht endlos', () => {
    const b = organigramm([kdv, ug], x => x.id);
    const ebene = (id: string) => b.knoten.find(k => k.id === id)!.ebene;
    expect([ebene('person-a'), ebene('kdv'), ebene('ug'), ebene('f-beispiel')]).toEqual([0, 1, 2, 3]);
    expect(b.kanten.find(k => k.zu === 'fremd:f-beispiel')).toMatchObject({ fremd: true, anteil: 10 });
    const kreis = organigramm([{ ...kdv, gesellschafter: [{ id: 'gs-x', wer: { art: 'gesellschaft', id: 'ug' }, nennbetragCent: 1, einlage: 'ja' }] }, ug], x => x.id);
    expect(kreis.knoten.length).toBeGreaterThan(0);
  });
  it('Historie: Ein-/Austritte, Ereignisse, Fassungen der Liste', () => {
    const h = strukturHistorie(ug, { id: 'ug', ereignisse: [{ id: 'ev-1', art: 'anteilsuebertragung', datum: '2026-02-01' }] }, b => b.id);
    expect(h.map(x => x.text)).toEqual(expect.arrayContaining(['c-beispiel-1 tritt ein', 'Anteilsübertragung', 'Gründung']));
  });
});

describe('Säubern: Fehler statt still verwerfen, „wer“ nur vom Server, Verlauf nur anhängen', () => {
  const leer: SchildGesellschaft = { id: 'ug' };
  it('Dokument: Art Pflicht, „nicht nötig“ braucht Grund, Fassung nicht in der Zukunft', () => {
    expect(eintragAnwenden(leer, 'dokumente', { art: 'gibt-es-nicht' }, K, { neueId: 'dok-x-0001' }).fehler.length).toBeGreaterThan(0);
    expect(eintragAnwenden(leer, 'dokumente', { art: 'satzung', status: 'nicht-noetig' }, K, { neueId: 'dok-x-0001' }).fehler[0].text).toMatch(/Grund/);
    expect(eintragAnwenden(leer, 'dokumente', { art: 'satzung', fassungVom: '2030-01-01' }, K, { neueId: 'dok-x-0001' }).fehler[0].text).toMatch(/Zukunft/);
    const ok = eintragAnwenden(leer, 'dokumente', { art: 'satzung', fassungVom: '2026-01-02', dateiIds: ['d-abcd-1234'], angelegt: '1999-01-01' }, K, { neueId: 'dok-x-0001' });
    expect(ok.s!.dokumente![0]).toMatchObject({ id: 'dok-x-0001', status: 'vorhanden', angelegt: K.jetzt });
  });
  it('Entwurf über der Grenze → 413, nie gekürzt', () => {
    const s: SchildGesellschaft = { id: 'ug', entwuerfe: [{ id: 'ew-x-0001', vorlage: 'nda', titel: 'NDA', text: 'x', am: K.jetzt, von: 'person-a' }] };
    const r = eintragAnwenden(s, 'entwuerfe', { text: 'a'.repeat(30_001) }, K, { eintragId: 'ew-x-0001' });
    expect(r.status).toBe(413);
  });
  it('Risiko: verantwortlich nur eine Person des Haushalts; Bewertung wird angehängt (am/von vom Server)', () => {
    expect(eintragAnwenden(leer, 'risiken', { titel: 'Test', kategorie: 'recht', verantwortlich: 'fremde-person' }, K, { neueId: 'rk-x-0001' }).fehler[0].text).toMatch(/Haushalt/);
    let s = eintragAnwenden(leer, 'risiken', { titel: 'Test', kategorie: 'recht', verantwortlich: 'person-b', bewertungen: [{ am: '1999-01-01', von: 'x', eintritt: 1, wirkung: 1 }] }, K, { neueId: 'rk-x-0001' }).s!;
    expect(s.risiken![0].bewertungen).toEqual([]);
    s = bewertungAnwenden(s, { risikoId: 'rk-x-0001', eintritt: 4, wirkung: 5, am: '1999-01-01', von: 'eindringling' }, K).s!;
    s = bewertungAnwenden(s, { risikoId: 'rk-x-0001', eintritt: 2, wirkung: 3, art: 'brutto' }, K).s!;
    expect(s.risiken![0].bewertungen).toEqual([{ am: HEUTE, von: 'person-a', eintritt: 4, wirkung: 5, art: 'netto' }, { am: HEUTE, von: 'person-a', eintritt: 2, wirkung: 3, art: 'brutto' }]);
    expect(bewertungAnwenden(s, { risikoId: 'rk-x-0001', eintritt: 6, wirkung: 1 }, K).fehler.length).toBe(1);
  });
  it('Startkatalog ohne Doppelte', () => {
    let n = 0;
    const id = () => `rk-x-${String(++n).padStart(4, '0')}`;
    const a = katalogUebernehmen(leer, ['R1', 'R5'], K, id);
    expect(a.neu).toBe(2);
    const b = katalogUebernehmen(a.s!, ['R1', 'R5', 'R8'], K, id);
    expect(b.neu).toBe(1);
    expect(b.s!.risiken!.map(r => r.katalogId)).toEqual(['R1', 'R5', 'R8']);
    expect(katalogUebernehmen(leer, ['R99'], K, id).fehler.length).toBe(1);
  });
  it('Vermerk nur zu einer Pflicht, die es gibt; „erledigt am“ nicht in der Zukunft; null nimmt ihn zurück', () => {
    expect(vermerkAnwenden(leer, { regelId: 'gibt-es-nicht', periode: '2025-12-31', status: 'erledigt' }, K, 'vm-x-0001').status).toBe(404);
    expect(vermerkAnwenden(leer, { regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', am: '2030-01-01' }, K, 'vm-x-0001').fehler.length).toBe(1);
    const s = vermerkAnwenden(leer, { regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', von: 'eindringling' }, K, 'vm-x-0001').s!;
    expect(s.vermerke).toEqual([{ id: 'vm-x-0001', regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', am: HEUTE, von: 'person-a' }]);
    expect(vermerkAnwenden(s, { regelId: 'ja-aufstellen', periode: '2025-12-31', status: null }, K, 'vm-x-0002').s!.vermerke).toEqual([]);
    expect(vermerkAnwenden({ id: 'ug', ereignisse: [{ id: 'ev-x-0001', art: 'prokura', datum: HEUTE }] }, { regelId: 'ev:hr', periode: 'ev-x-0001', status: 'erledigt' }, K, 'vm-x-0003').fehler).toEqual([]);
  });
  it('Profil: Beträge in Euro → Cent, Unsinn → Fehler; Domain ohne Zugangsdaten', () => {
    expect(profilAnwenden(leer, { umsatzVorjahrCent: '850.000', beschaeftigte: 4 }, K).s!.profil).toMatchObject({ umsatzVorjahrCent: 85_000_000, beschaeftigte: 4 });
    expect(profilAnwenden(leer, { beschaeftigte: -1 }, K).fehler.length).toBe(1);
    const d = eintragAnwenden(leer, 'domains', { domain: 'https://Beispiel.de/pfad', passwort: 'geheim', zugangWo: 'Tresor' }, K, { neueId: 'dm-x-0001' }).s!.domains![0];
    expect(d).toMatchObject({ domain: 'beispiel.de', zugangWo: 'Tresor' });
    expect(JSON.stringify(d)).not.toContain('geheim');
  });
  it('Papierkorb 30 Tage, endgültig nur aus dem Papierkorb; Konto gelöscht → „wer“ getilgt', () => {
    const s: SchildGesellschaft = { id: 'ug', marken: [{ id: 'mk-x-0001', bezeichnung: 'M' }] };
    expect(eintragHandeln(s, 'marken', 'mk-x-0001', 'endgueltig', K.jetzt).status).toBe(409);
    const korb = eintragHandeln(s, 'marken', 'mk-x-0001', 'loeschen', '2026-08-01T00:00:00.000Z').s!;
    expect(schildAufraeumen({ gesellschaften: [korb] }, '2026-08-15T00:00:00.000Z').n).toBe(0);
    expect(schildAufraeumen({ gesellschaften: [korb] }, '2026-09-15T00:00:00.000Z').n).toBe(1);
    const mitPerson: SchildGesellschaft = { id: 'ug', geaendertVon: 'person-b', vermerke: [{ id: 'vm-1', regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', am: HEUTE, von: 'person-b' }],
      risiken: [{ id: 'rk-1', titel: 'x', kategorie: 'recht', status: 'offen', verantwortlich: 'person-b', bewertungen: [{ am: HEUTE, von: 'person-b', eintritt: 1, wirkung: 1, art: 'netto' }] }] };
    const t = schildOhnePerson({ gesellschaften: [mitPerson] }, 'person-b');
    expect(t.n).toBe(4);
    expect(JSON.stringify(t.neu)).not.toContain('person-b');
  });
});

describe('Ampel und Lage: nur Business-Gesellschaften, „was fehlt“ mit Weg', () => {
  const register: RegisterDatei = { gesellschaften: [{ id: 'kdc', rechtsform: 'einzel' }, gmbh(), { id: 'kdv', rechtsform: 'ug', rolle: 'holding' }] };
  it('die Privat-Einheit (Selbstständigkeit) gehört nicht ins Schild', () => {
    expect(schildGesellschaften(register).map(g => g.id)).toEqual(['kdv', 'ug']);
  });
  it('rot bei fehlendem Pflichtdokument bzw. überfälliger Pflicht; jeder Punkt hat einen Weg', () => {
    const l = lageAus(register, null, HEUTE);
    const ug = l.gesellschaften.find(g => g.id === 'ug')!;
    expect(ug.compliance.ampel).toBe('rot');
    expect(ug.compliance.teile.dokumente.ampel).toBe('rot');
    expect(ug.compliance.teile.pflichten.ampel).toBe('rot');
    expect(ug.compliance.teile.risiken.punkte[0].text).toMatch(/Startkatalog/);
    for (const t of Object.values(ug.compliance.teile)) for (const p of t.punkte) expect(p.weg).toMatch(/^\/os\/unternehmen/);
    expect(l.gesamt).toMatchObject({ ampel: 'rot' });
  });
  it('Kalender: Pflichten (art pflicht) und Schutzrechte (art vertrag) mit Weg in den Reiter', () => {
    const l = lageAus(register, { gesellschaften: [{ id: 'ug', versicherungen: [{ id: 'vs-2', art: 'do', ablauf: '2027-01-31' }] }] }, HEUTE);
    const f = schildFristen(l);
    expect(f.find(x => x.id.startsWith('pf-ug-') && x.id.includes('ja-feststellen|2025-12-31'))).toMatchObject({ art: 'pflicht', tag: '2026-08-31', href: '/os/unternehmen?s=pflichten&w=ug' });
    // Die Offenlegung der Hauptgesellschaft steht im Kalender aus dem Steuer-Modul (seit 15.10.) — nicht noch einmal aus dem Schild.
    expect(f.some(x => x.id.startsWith('pf-ug-') && x.id.includes('ja-offenlegen'))).toBe(false);
    expect(f.find(x => x.id.includes('vs-kuend-vs-2'))).toMatchObject({ art: 'vertrag', kuendigung: true, href: '/os/unternehmen?s=schutz&w=ug' });
  });
  it('Erinnerungen: feste Kennungen (idempotent), Titel ohne Beträge', () => {
    const l = lageAus(register, null, HEUTE);
    const a = faelligeSchildErinnerungen(l), b = faelligeSchildErinnerungen(lageAus(register, null, HEUTE));
    expect(a.map(x => x.aufgabeId)).toEqual(b.map(x => x.aufgabeId));
    expect(a.every(x => istSchildAufgabe(x.aufgabeId) && x.aufgabeId.length <= 80)).toBe(true);
    expect(a.some(x => /€/.test(x.titel))).toBe(false);
  });
});

// ─── Server: Rechte, Trennung, Stand, Erinnerungen, Kalender, Altbestand ─────────────────────────────────────────────

describe('Server: /api/gesellschaften/schild', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let route: Route;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string, x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...x });
  const get = (p: string, q = '') => route.GET(new Request(`http://test/api/gesellschaften/schild${q}`, { headers: kopf(p) }));
  const patch = (p: string, body: unknown) => route.PATCH(new Request('http://test/api/gesellschaften/schild', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const stand = async (id: string) => ((await (await get('person-a')).json()).eintraege as { id: string; stand: string }[]).find(e => e.id === id)!.stand;
  // Altbestand des Registers, wie ihn der Online-Stand schreibt — OHNE irgendein Feld des Schilds.
  const ALT_REGISTER = { gesellschaften: [
    { id: 'kdc', rechtsform: 'einzel', status: 'eingetragen', geaendert: '2026-10-01T08:00:00.000Z', geaendertVon: 'person-a' },
    { id: 'kdv', rechtsform: 'ug', status: 'eingetragen', rolle: 'holding', gegruendetAm: '2021-06-15', stammkapitalCent: 500_000, firmierung: 'Beispiel Holding UG (haftungsbeschränkt)', unbekanntesFeldDerZukunft: { a: 1 } },
    { id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] },
  ] };
  const registerDatei = () => path.join(ordner, 'gesellschaften--haus.json');

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k5', 'nur-business', 'mitglied', 'haus', { finanzRecht: 'business' }),
      konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2 });
    await db.saveJson('gesellschaften--haus', ALT_REGISTER);
    await db.saveJson('gesellschaften--kunde-haus', { gesellschaften: [{ id: G1, name: 'Fremde GmbH', rechtsform: 'gmbh' }] });
    await db.saveJson('unternehmen-schild--kunde-haus', { gesellschaften: [{ id: G1, risiken: [{ id: 'rk-fremd-0001', titel: 'FREMDES-RISIKO', kategorie: 'recht', status: 'offen', bewertungen: [] }] }] });
    route = (await import('@/app/api/gesellschaften/schild/route')) as unknown as Route;
  });

  it('Testkunde, Partner (fremder Haushalt), Konto mit Finanzrecht „nur Business“, ohne Person, Dienstweg ohne Person: 403 — lesen und schreiben', async () => {
    for (const p of ['testkunde', 'partner', 'nur-business']) {
      expect((await get(p)).status, p).toBe(403);
      expect((await get(p, '?lage=1')).status, p).toBe(403);
      expect((await patch(p, { id: 'ug', stand: 'x', profil: { beschaeftigte: 1 } })).status, p).toBe(403);
    }
    expect((await route.GET(new Request('http://test/api/gesellschaften/schild'))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/gesellschaften/schild', { headers: { 'x-make-key': 'pruef-schluessel-schild' } }))).status).toBe(403);
  });

  it('Sicht X bekommt nichts aus Y: nur das eigene Schild, nie das eines anderen Haushalts — und nie die Privat-Einheit', async () => {
    const r = await get('person-b');
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.eintraege.map((e: { id: string }) => e.id)).toEqual(['kdv', 'ug']);
    const text = JSON.stringify(d) + JSON.stringify(await (await get('person-b', '?lage=1')).json());
    expect(text).not.toContain('FREMDES-RISIKO');
    expect(text).not.toContain(G1);
    // Schreiben auf die Privat-Einheit → 400 (gehört zu Privat), eine fremde Register-Gesellschaft → 404.
    expect((await patch('person-a', { id: 'kdc', stand: 'x', profil: { beschaeftigte: 1 } })).status).toBe(400);
    expect((await patch('person-a', { id: G1, stand: 'x', profil: { beschaeftigte: 1 } })).status).toBe(404);
    const { routenBereich } = await import('@/lib/zugang/sicht-bereich');
    expect(routenBereich('/api/gesellschaften/schild')).toBe('business');
  });

  it('Altbestand: Register ohne Schild-Felder wird bit-gleich gelesen und bleibt nach Schreibvorgängen ins Schild vollständig erhalten', async () => {
    const vorher = readFileSync(registerDatei());
    const regRoute = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
    const lesen = async () => ((await (await regRoute.GET(new Request('http://test/api/gesellschaften', { headers: kopf('person-a') }))).json()).gesellschaften as Record<string, unknown>[])
      .map(({ verweise: _v, luecken: _l, ...g }) => g);
    const regVorher = await lesen();
    // Schild schreiben: Profil, Dokument, Risiko aus dem Katalog, Vermerk — alles im eigenen Bestand.
    let st = await stand('kdv');
    let r = await (await patch('person-a', { id: 'kdv', stand: st, profil: { beschaeftigte: 2 } })).json();
    r = await (await patch('person-a', { id: 'kdv', stand: r.eintrag.stand, liste: 'dokumente', eintrag: { art: 'satzung', fassungVom: '2026-01-02' } })).json();
    r = await (await patch('person-a', { id: 'kdv', stand: r.eintrag.stand, katalog: ['R1'] })).json();
    expect(r.ok).toBe(true);
    st = r.eintrag.stand;
    expect(readFileSync(registerDatei()).equals(vorher)).toBe(true);
    expect(await lesen()).toEqual(regVorher);
    expect(regVorher.find(g => g.id === 'kdv')).toMatchObject({ unbekanntesFeldDerZukunft: { a: 1 }, firmierung: 'Beispiel Holding UG (haftungsbeschränkt)' });
    // Ein unbekanntes Feld im Schild-Eintrag (spätere Fassung) überlebt einen Schreibvorgang auf ein anderes Feld.
    await db.updateJson<{ gesellschaften: Record<string, unknown>[] }>('unternehmen-schild--haus', cur => ({ ...cur!, gesellschaften: cur!.gesellschaften.map(g => (g.id === 'kdv' ? { ...g, zukunftsFeld: 'bleibt' } : g)) }));
    st = await stand('kdv');
    r = await (await patch('person-a', { id: 'kdv', stand: st, profil: { beschaeftigte: 3 } })).json();
    expect(r.eintrag).toMatchObject({ zukunftsFeld: 'bleibt', profil: { beschaeftigte: 3 } });
    expect(r.eintrag.dokumente).toHaveLength(1);
    expect(r.eintrag.risiken).toHaveLength(1);
  });

  it('Stand: veraltet → 409 mit aktuellem Eintrag, nichts gespeichert', async () => {
    const st = await stand('ug');
    const ok = await (await patch('person-a', { id: 'ug', stand: st, profil: { groessenklasse: 'klein' } })).json();
    expect(ok.ok).toBe(true);
    const r = await patch('person-b', { id: 'ug', stand: st, profil: { groessenklasse: 'gross' } });
    expect(r.status).toBe(409);
    const d = await r.json();
    expect(d.aktuell.profil.groessenklasse).toBe('klein');
  });

  it('Erinnerungen: fällige Pflicht → Aufgabe + Glocke (vorhandene Art „vertrag“, Kennung usp-), zweiter Lauf nichts doppelt, Vermerk schließt die Aufgabe; Telegram neutral', async () => {
    const { schildErinnerungen, unternehmenLage } = await import('@/lib/gesellschaften/schild-server');
    const { localDay, tagePlus } = await import('@/lib/zeit');
    // Eine Anteilsübertragung vor zehn Tagen: „Gesellschafterliste unverzüglich“ (Vorschlag 14 Tage) ist jetzt im Vorlauf.
    const ev = await (await patch('person-a', { id: 'ug', stand: await stand('ug'), liste: 'ereignisse', eintrag: { art: 'anteilsuebertragung', datum: tagePlus(localDay(), -10) } })).json();
    expect(ev.ok).toBe(true);
    const lage = await unternehmenLage('haus');
    const ug = lage.gesellschaften.find(g => g.id === 'ug')!;
    const p = ug.pflichten.find(x => x.regelId === 'ev:gesellschafterliste')!;
    expect(p.status).toBe('faellig');
    const erste = (await db.loadJson<{ tasks: { id: string; status: string; space?: string; spaceId?: string; notiz?: string }[] }>('tasks'))!.tasks.filter(t => t.id.startsWith('usp-'));
    expect(erste.length).toBeGreaterThan(0);
    expect(erste[0]).toMatchObject({ space: 'business' });
    expect(erste[0].notiz).toContain('/os/unternehmen?s=');
    expect((await schildErinnerungen('haus')).neu).toBe(0);
    for (const per of ['person-a', 'person-b']) {
      const m = await db.loadJson<{ eintraege: { art: string; bezug?: { id: string } }[] }>(`meldungen--${per}`);
      expect(m!.eintraege.some(e => e.art === 'vertrag' && /^usp-/.test(e.bezug?.id ?? ''))).toBe(true);
    }
    // Vermerk „erledigt“ über die Route → die passende Aufgabe ist erledigt.
    const { kurzHash } = await import('@/lib/gesellschaften/schild/ampel');
    const aid = `usp-${kurzHash(`ug|${p.schluessel}`)}`;
    expect(erste.some(t => t.id === aid)).toBe(true);
    const r = await (await patch('person-a', { id: 'ug', stand: await stand('ug'), vermerk: { regelId: p.regelId, periode: p.periode, status: 'erledigt' } })).json();
    expect(r.eintrag.vermerke[0]).toMatchObject({ von: 'person-a', status: 'erledigt' });
    const nachher = (await db.loadJson<{ tasks: { id: string; status: string }[] }>('tasks'))!.tasks.find(t => t.id === aid)!;
    expect(nachher.status).toBe('done');
    const { telegramText } = await import('@/lib/meldungen/speicher');
    expect(telegramText({ art: 'faellig', titel: 'Fällig: Pflicht: Jahresabschluss offenlegen — Beispiel GmbH', bezug: { art: 'aufgabe', id: aid } })).toBe('Eine Unternehmens-Pflicht naht — Details in MAKE OS');
    expect(telegramText({ art: 'vertrag', titel: 'Pflicht: X — Beispiel GmbH', bezug: { art: 'aufgabe', id: aid } })).toBe('Eine Unternehmens-Pflicht naht — Details in MAKE OS');
  });

  it('Kalender: die Fristen-Ebene trägt die Pflichten des Schilds (Business)', async () => {
    const { fristenLesen } = await import('@/lib/kalender/fristen-server');
    const f = await fristenLesen('2026-01-01', '2028-01-01', HEUTE, 'person-a');
    const pf = f.filter(x => x.art === 'pflicht');
    expect(pf.length).toBeGreaterThan(0);
    expect(pf.every(x => x.bereich === 'business' && x.href.startsWith('/os/unternehmen?s='))).toBe(true);
  });

  it('Vorlage → Entwurf je Gesellschaft (gefüllt aus dem Register), Ereignis, Risiko-Bewertung über die Route', async () => {
    let r = await (await patch('person-a', { id: 'ug', stand: await stand('ug'), vorlage: 'entscheidungsprotokoll' })).json();
    expect(r.ok).toBe(true);
    expect(r.entwurfId).toMatch(/^ew-/);
    expect(r.eintrag.entwuerfe[0]).toMatchObject({ vorlage: 'entscheidungsprotokoll', von: 'person-a' });
    r = await (await patch('person-a', { id: 'ug', stand: r.eintrag.stand, liste: 'ereignisse', eintrag: { art: 'gf-wechsel', datum: HEUTE } })).json();
    expect(r.eintrag.ereignisse.some((x: { art: string }) => x.art === 'gf-wechsel')).toBe(true);
    r = await (await patch('person-a', { id: 'ug', stand: r.eintrag.stand, katalog: ['R4'] })).json();
    const rk = r.eintrag.risiken[0].id;
    r = await (await patch('person-a', { id: 'ug', stand: r.eintrag.stand, bewertung: { risikoId: rk, eintritt: 3, wirkung: 5 } })).json();
    expect(r.eintrag.risiken[0].bewertungen[0]).toMatchObject({ eintritt: 3, wirkung: 5, von: 'person-a' });
    const lage = await (await get('person-a', '?lage=1')).json();
    expect(lage.gesellschaften.find((g: { id: string }) => g.id === 'ug').teile.risiken.punkte.some((p: { text: string }) => /rot ohne offene Maßnahme/.test(p.text))).toBe(false);
    expect(lage.hinweis).toMatch(/keine Rechtsberatung/);
  });

  it('Konto gelöscht: „wer“ im Schild wird „[gelöscht]“, Einträge bleiben', async () => {
    const st = await stand('kdv');
    await patch('person-b', { id: 'kdv', stand: st, liste: 'risiken', eintrag: { titel: 'Von B', kategorie: 'recht', verantwortlich: 'person-b' } });
    const { schildKontoLoeschen } = await import('@/lib/gesellschaften/schild-server');
    expect(await schildKontoLoeschen('haus', 'person-b')).toBeGreaterThan(0);
    const d = await db.loadJson<{ gesellschaften: unknown[] }>('unternehmen-schild--haus');
    expect(JSON.stringify(d)).not.toContain('"person-b"');
    expect(JSON.stringify(d)).toContain('Von B');
  });
});
