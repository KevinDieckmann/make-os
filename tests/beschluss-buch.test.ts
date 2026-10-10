// ─── Wächter: Unternehmen › Beschlüsse & Satzung (Beschluss-Buch, 10.10.) ───────────────────────────────────────────────────────────────
// Kevin 10.10.: „Unternehmen wird extrem spannend, wenn ich da alle Gesellschafterbeschlüsse, den Gegenstand und alles dazu gesammelt habe.“
// Geprüft wird:
//   (a) rein: Nummern (Server vergibt, Altbestand nur abgeleitet), Säubern (Beteiligte/Abstimmung/Verweise/Änderungen, Gewicht zum Zeitpunkt der
//       Abstimmung, Nummer nie aus der Eingabe), Ergebnis (Anteile, ohne Stimmrecht, drei Viertel), Fassungen (Stand am, Steckbrief nachziehen),
//       Folgen (Ereignis des Schilds mit Pflichten, Fassung, Cap-Table), offene Eintragungen, Dokument → Vorschlag (Fundstellen wörtlich), Vorlagen,
//       Buch als PDF;
//   (b) Server: fremder Haushalt/Testkunde/„nur Business“/Dienstweg ohne Person → 403; Sicht X bekommt nichts aus Y; Altbestand bleibt bit-gleich;
//       Folgen nur im Stapel und erst der Klick wirkt (Ereignis → Pflichten, Fassung → Steckbrief, Cap-Table → Aufgabe), idempotent; Fassungen nie
//       überschrieben; Recht-Check und ZOE lesen das Buch; Art. 15 nennt die eigene Stimme.
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten; kein Modellaufruf.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { RegisterDatei, RegisterGesellschaft, Beschluss } from '@/lib/gesellschaften/modell';

const { ordner, gemeldet } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-beschluss-buch-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-beschluesse';
  process.env.MAKE_OS_DOKU_WURZEL = 'aus';
  process.env.MAKE_OS_BRAIN_INDEX = 'aus';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return { ordner: o, gemeldet: [] as { an: string; art: string; titel: string }[] };
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string }) => { gemeldet.push(m); } }));
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

import { beschlussSaeubern, fassungSaeubern, GRENZEN } from '@/lib/gesellschaften/modell';
import {
  beschlussNummern, naechsteNummer, braucheNummer, abstimmungsErgebnis, standAm, steckbriefNachziehen, steckbriefAbweichungen, beschlussFolgen,
  beschluesseOhneEintragung, buchListe, buchDokument, ereignisseVon, fassungAb, EINTRAGUNG_NACHFRAGEN_TAGE,
} from '@/lib/gesellschaften/beschluesse';
import { beschlussAusText } from '@/lib/gesellschaften/beschluss-import';
import { BESCHLUSS_VORLAGEN, beschlussAusVorlage } from '@/lib/gesellschaften/beschluss-vorlagen';
import { beschlussBuchPdf } from '@/lib/gesellschaften/beschluss-pdf';
import { kontextVon } from '@/lib/gesellschaften/schild/kontext';
import { tagePlus } from '@/lib/gesellschaften/schild/zeit';

const GS1 = 'gs-aaaa-0001', GS2 = 'gs-bbbb-0002', GS3 = 'gs-cccc-0003', OG1 = 'og-dddd-0001';
const UG: RegisterGesellschaft = {
  id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', stammkapitalCent: 3_000_000, sitz: 'Musterstadt', firmierung: 'Beispiel GmbH',
  gesellschafter: [
    { id: GS1, wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 1_500_000, einlage: 'ja' },
    { id: GS2, wer: { art: 'kontakt', id: 'c-kontakt-0001' }, nennbetragCent: 1_000_000, einlage: 'ja' },
    { id: GS3, wer: { art: 'person', id: 'person-b' }, nennbetragCent: 500_000, einlage: 'ja', ohneStimmrecht: true },
  ],
  organe: [{ id: OG1, funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: 'person-a' }, seit: '2023-01-10' }],
  vertraege: [{ id: 'vt-aaaa-0001', art: 'gesellschaftsvertrag', titel: 'Satzung', parteien: [], status: 'beurkundet' }],
};
const B = (id: string, x: Partial<Beschluss> = {}): Beschluss => ({ id: `bs-${id}`, datum: '2026-03-01', art: 'gesellschafterbeschluss', titel: `Beschluss ${id}`, status: 'gefasst', ...x });

// ── (a) rein ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('(a) Nummern: der Server vergibt, Altbestand nur abgeleitet', () => {
  it('Altbestand ohne Nummer wird je Jahr nach Datum gezählt — an gespeicherten Nummern vorbei; Entwürfe ohne Nummer', () => {
    const l = [B('alt-b', { datum: '2026-05-01' }), B('alt-a', { datum: '2026-02-01' }), B('neu', { datum: '2026-04-01', nummer: { jahr: 2026, nr: 1 } }), B('ent', { status: 'entwurf' }), B('vj', { datum: '2025-12-01' })];
    const n = beschlussNummern(l);
    expect(n.get('bs-neu')).toEqual({ jahr: 2026, nr: 1 });
    expect(n.get('bs-alt-a')).toEqual({ jahr: 2026, nr: 2, abgeleitet: true });
    expect(n.get('bs-alt-b')).toEqual({ jahr: 2026, nr: 3, abgeleitet: true });
    expect(n.get('bs-vj')).toEqual({ jahr: 2025, nr: 1, abgeleitet: true });
    expect(n.has('bs-ent')).toBe(false);
    expect(naechsteNummer(l, 2026)).toEqual({ jahr: 2026, nr: 4 });
    expect(naechsteNummer(l, 2027)).toEqual({ jahr: 2027, nr: 1 });
  });
  it('Nummer nur beim ersten „nicht mehr Entwurf“ — nie für gefassten Altbestand, nie zweimal', () => {
    expect(braucheNummer(B('x'), undefined)).toBe(true);
    expect(braucheNummer(B('x', { status: 'entwurf' }), undefined)).toBe(false);
    expect(braucheNummer(B('x'), B('x', { status: 'entwurf' }))).toBe(true);
    expect(braucheNummer(B('x', { status: 'eingetragen' }), B('x'))).toBe(false); // Altbestand, der schon gefasst war
    expect(braucheNummer(B('x', { nummer: { jahr: 2026, nr: 2 } }), undefined)).toBe(false);
  });
});

describe('(a) Säubern: neue Felder, Gewicht zum Zeitpunkt der Abstimmung, nie still kürzen', () => {
  it('Beteiligte/Abstimmung/Verweise/Änderungen gegen die Gesellschaft; die Nummer kommt nie aus der Eingabe', () => {
    const r = beschlussSaeubern({ id: 'bs-neu-0001', datum: '2026-03-01', art: 'kapitalmassnahme', titel: 'Kapitalerhöhung', status: 'gefasst', nummer: { jahr: 1999, nr: 99 },
      abstimmung: [{ id: GS1, stimme: 'ja' }, { id: GS3, stimme: 'nein' }], verweise: [{ art: 'vertrag', id: 'vt-aaaa-0001' }, { art: 'risiko', id: 'rk-aaaa-0001' }],
      aenderungen: [{ merkmal: 'stammkapital', cent: '50.000' }] }, undefined, UG, { jetzt: '2026-03-01T10:00:00.000Z', heute: '2026-03-01' });
    expect(r.fehler).toEqual([]);
    expect(r.e!.nummer).toBeUndefined();
    expect(r.e!.beteiligte).toEqual([GS1, GS3]);
    expect(r.e!.abstimmung).toEqual([{ id: GS1, stimme: 'ja', gewichtCent: 1_500_000 }, { id: GS3, stimme: 'nein', gewichtCent: 500_000, ohneStimmrecht: true }]);
    expect(r.e!.aenderungen).toEqual([{ merkmal: 'stammkapital', cent: 5_000_000 }]);
    expect(r.e!.angelegt).toBe('2026-03-01T10:00:00.000Z');
    // Das Gewicht bleibt, auch wenn sich die Cap-Table später ändert.
    const spaeter = { ...UG, gesellschafter: UG.gesellschafter!.map(x => (x.id === GS1 ? { ...x, nennbetragCent: 9_999_900 } : x)) };
    const r2 = beschlussSaeubern({ titel: 'Kapitalerhöhung (geändert)' }, { ...r.e!, nummer: { jahr: 2026, nr: 3 } }, spaeter, { heute: '2026-03-02' });
    expect(r2.e!.abstimmung![0].gewichtCent).toBe(1_500_000);
    expect(r2.e!.nummer).toEqual({ jahr: 2026, nr: 3 });
  });
  it('Fehler statt still verwerfen: fremder Beteiligter, doppelte Stimme, Verweis ins Leere, Inhalt über der Grenze', () => {
    const f = (x: Record<string, unknown>) => beschlussSaeubern({ id: 'bs-neu-0002', datum: '2026-03-01', art: 'gesellschafterbeschluss', titel: 'Test', ...x }, undefined, UG).fehler.map(e => e.feld);
    expect(f({ beteiligte: ['gs-fremd-9999'] })).toContain('beteiligte');
    expect(f({ abstimmung: [{ id: GS1, stimme: 'ja' }, { id: GS1, stimme: 'nein' }] })).toContain('abstimmung');
    expect(f({ verweise: [{ art: 'vertrag', id: 'vt-gibt-esnicht' }] })).toContain('verweise');
    expect(f({ inhalt: 'x'.repeat(GRENZEN.inhalt + 1) })).toContain('inhalt');
    expect(f({ aenderungen: [{ merkmal: 'gegenstand', text: '' }] })).toContain('aenderungen');
  });
  it('Statuswechsel stempelt „angemeldet am“ bzw. „eingetragen am“ — nie am Altbestand, der schon so steht', () => {
    const alt = B('st', { status: 'gefasst' });
    expect(beschlussSaeubern({ status: 'angemeldet' }, alt, UG, { heute: '2026-04-01' }).e!.angemeldetAm).toBe('2026-04-01');
    expect(beschlussSaeubern({ titel: 'nur Titel' }, B('st', { status: 'eingetragen' }), UG, { heute: '2026-04-01' }).e!.eingetragenAm).toBeUndefined();
  });
  it('Altbestand ohne neue Felder bleibt lesbar und unverändert, wenn nichts Neues kommt', () => {
    const alt: Beschluss = { id: 'bs-alt-0001', datum: '2025-06-01', art: 'gf-beschluss', titel: 'Alt', status: 'gefasst', inhalt: 'Wortlaut' };
    expect(beschlussSaeubern({}, alt).e).toEqual(alt);
  });
  it('Fassung: Merkmal, gültig ab, Wert; Beschluss muss zur Gesellschaft gehören', () => {
    const o = { jetzt: '2026-03-01T10:00:00.000Z', person: 'person-a', beschluesse: [{ id: 'bs-da-0001' }] };
    expect(fassungSaeubern({ id: 'fs-neu-0001', merkmal: 'gegenstand', ab: '2026-03-01', text: 'Beratung und Software.', beschlussId: 'bs-da-0001' }, o).e).toMatchObject({ merkmal: 'gegenstand', von: 'person-a', beschlussId: 'bs-da-0001' });
    expect(fassungSaeubern({ id: 'fs-neu-0002', merkmal: 'stammkapital', ab: '2026-03-01', cent: '50.000' }, o).e!.cent).toBe(5_000_000);
    expect(fassungSaeubern({ id: 'fs-neu-0003', merkmal: 'gegenstand', ab: '2026-03-01', text: 'x', beschlussId: 'bs-fremd-0001' }, o).fehler.map(x => x.feld)).toContain('beschlussId');
    expect(fassungSaeubern({ id: 'fs-neu-0004', merkmal: 'satzung', ab: '2026-03-01' }, o).fehler.length).toBeGreaterThan(0);
  });
});

describe('(a) Abstimmung: Anteile, ohne Stimmrecht, Mehrheit als gesetzlicher Regelfall', () => {
  it('nach Anteilen: Enthaltungen zählen nicht als abgegeben, stimmrechtslose gar nicht', () => {
    const e = abstimmungsErgebnis({ art: 'gesellschafterbeschluss', abstimmung: [{ id: GS1, stimme: 'ja', gewichtCent: 1_500_000 }, { id: GS2, stimme: 'enthaltung', gewichtCent: 1_000_000 }, { id: GS3, stimme: 'nein', gewichtCent: 500_000, ohneStimmrecht: true }] })!;
    expect(e).toMatchObject({ basis: 'anteile', ja: 1_500_000, nein: 0, enthaltung: 1_000_000, abgegeben: 1_500_000, mehrheit: 'einfach', angenommen: true, ohneStimmrecht: 1 });
    expect(e.text).toMatch(/angenommen/);
  });
  it('Satzungsänderung braucht drei Viertel der abgegebenen Stimmen', () => {
    const ab = [{ id: GS1, stimme: 'ja' as const, gewichtCent: 1_500_000 }, { id: GS2, stimme: 'nein' as const, gewichtCent: 1_000_000 }];
    expect(abstimmungsErgebnis({ art: 'satzungsaenderung', abstimmung: ab })!.angenommen).toBe(false); // 60 % < 75 %
    expect(abstimmungsErgebnis({ art: 'gesellschafterbeschluss', abstimmung: ab })!.angenommen).toBe(true);
    expect(abstimmungsErgebnis({ art: 'gesellschafterbeschluss', aenderungen: [{ merkmal: 'gegenstand', text: 'x' }], abstimmung: ab })!.mehrheit).toBe('dreiviertel');
  });
  it('nur Organe: nach Köpfen; niemand abgestimmt: kein Ergebnis', () => {
    expect(abstimmungsErgebnis({ art: 'gf-beschluss', abstimmung: [{ id: OG1, stimme: 'ja' }] })).toMatchObject({ basis: 'koepfe', ja: 1, angenommen: true });
    expect(abstimmungsErgebnis({ art: 'gf-beschluss' })).toBeNull();
  });
});

describe('(a) Gegenstand & Satzung: Stand am Datum, Steckbrief zeigt die gültige Fassung', () => {
  const g: RegisterGesellschaft = { ...UG, fassungen: [
    { id: 'fs-g1', merkmal: 'gegenstand', ab: '2023-01-10', text: 'Beratung.' },
    { id: 'fs-g2', merkmal: 'gegenstand', ab: '2026-04-20', text: 'Beratung und Software.', beschlussId: 'bs-s1' },
    { id: 'fs-k2', merkmal: 'stammkapital', ab: '2027-01-01', cent: 5_000_000 },
    { id: 'fs-x', merkmal: 'gegenstand', ab: '2026-05-01', text: 'gelöscht', geloeschtAm: '2026-05-02T10:00:00.000Z' },
  ] };
  it('je Merkmal die jüngste Fassung bis zum Tag; Papierkorb zählt nicht; spätere als „kommt“', () => {
    const vor = standAm(g, '2026-04-19', '2026-10-10');
    expect(vor.find(s => s.merkmal === 'gegenstand')).toMatchObject({ wert: 'Beratung.', kommt: { id: 'fs-g2' } });
    expect(standAm(g, '2026-10-10', '2026-10-10').find(s => s.merkmal === 'gegenstand')!.wert).toBe('Beratung und Software.');
    // Stammkapital: nur eine künftige Fassung → bis dahin der Steckbrief (noch nicht ersetzt), mit „kommt“.
    const k = standAm(g, '2026-10-10', '2026-10-10').find(s => s.merkmal === 'stammkapital')!;
    expect(k).toMatchObject({ ausSteckbrief: true, kommt: { id: 'fs-k2' } });
    expect(k.wert).toMatch(/30\.000/);
  });
  it('neue, heute gültige Fassung zieht das Steckbrief-Feld nach; künftige nicht; Abweichung wird gemeldet (kein Automatismus)', () => {
    const neu = { id: 'fs-s3', merkmal: 'sitz' as const, ab: '2026-06-01', text: 'Neustadt' };
    expect(steckbriefNachziehen({ fassungen: [...(g.fassungen ?? []), neu] }, neu, '2026-10-10')).toEqual({ feld: 'sitz', wert: 'Neustadt' });
    expect(steckbriefNachziehen(g, g.fassungen![2], '2026-10-10')).toBeNull();
    expect(steckbriefAbweichungen({ ...g, fassungen: [...g.fassungen!, neu] }, '2026-10-10')).toMatchObject([{ merkmal: 'sitz', feld: 'sitz', steckbrief: 'Musterstadt', wert: 'Neustadt' }]);
  });
});

describe('(a) Folgen eines gefassten Beschlusses — Vorschläge, eine Quelle für Pflichten (Schild)', () => {
  const k = kontextVon(UG);
  it('Kapitalerhöhung: Ereignis „Kapitalmaßnahme“ (Notar/HR, Gesellschafterliste, Transparenzregister), Fassung Stammkapital, Cap-Table', () => {
    const b = B('kap', { art: 'kapitalmassnahme', aenderungen: [{ merkmal: 'stammkapital', cent: 5_000_000 }] });
    const { folgen } = beschlussFolgen(UG, b, { kontext: k });
    expect(folgen.map(f => f.art)).toEqual(['ereignis', 'fassung', 'cap-table']);
    const ev = folgen[0];
    expect(ev.ereignis).toBe('kapitalmassnahme');
    expect(ev.pflichten!.join(' ')).toMatch(/Handelsregister/);
    expect(ev.pflichten!.join(' ')).toMatch(/Gesellschafterliste/);
    expect(ev.pflichten!.join(' ')).toMatch(/Transparenzregister/);
    expect(folgen[1]).toMatchObject({ merkmal: 'stammkapital', ab: '2026-03-01' });
  });
  it('GF-Bestellung → „Wechsel in der Geschäftsführung“; Sitz → Satzungsänderung + Sitz/Anschrift; Jahresabschluss → keine Eintragung', () => {
    expect(ereignisseVon({ art: 'gf-bestellung' })).toEqual(['gf-wechsel']);
    expect(ereignisseVon({ art: 'gesellschafterbeschluss', aenderungen: [{ merkmal: 'sitz', text: 'Neustadt' }] }).sort()).toEqual(['satzungsaenderung', 'sitz-anschrift']);
    expect(ereignisseVon({ art: 'jahresabschluss' })).toEqual([]);
  });
  it('eingetragen: keine Pflichten mehr (sonst stünden alte Fristen rot); Entwurf/aufgehoben: nichts; ohne Schild: nur Hinweis', () => {
    expect(beschlussFolgen(UG, B('e', { art: 'gf-bestellung', status: 'eingetragen' }), { kontext: k }).folgen).toEqual([]);
    expect(beschlussFolgen(UG, B('e', { art: 'gf-bestellung', status: 'entwurf' }), { kontext: k }).folgen).toEqual([]);
    const ohne = beschlussFolgen(UG, B('e', { art: 'gf-bestellung' }), { kontext: null });
    expect(ohne.folgen).toEqual([]);
    expect(ohne.hinweise[0]).toMatch(/Business/);
  });
  it('schon angelegte Ereignisse bzw. Fassungen dieses Beschlusses kommen nicht noch einmal', () => {
    const b = B('kap', { art: 'kapitalmassnahme', aenderungen: [{ merkmal: 'stammkapital', cent: 5_000_000 }] });
    const g = { ...UG, fassungen: [{ id: 'fs-1', merkmal: 'stammkapital' as const, ab: '2026-03-01', cent: 5_000_000, beschlussId: b.id }] };
    expect(beschlussFolgen(g, b, { kontext: k, ereignisseDa: [{ art: 'kapitalmassnahme', beschlussId: b.id }] }).folgen.map(f => f.art)).toEqual(['cap-table']);
  });
  it('„gültig ab“: Wirkung vor Eintragung vor Beschlusstag; die Geschäftsführung wirkt ab Beschluss', () => {
    expect(fassungAb({ datum: '2026-03-01', eingetragenAm: '2026-04-20' }, 'gegenstand')).toBe('2026-04-20');
    expect(fassungAb({ datum: '2026-03-01', eingetragenAm: '2026-04-20' }, 'geschaeftsfuehrung')).toBe('2026-03-01');
    expect(fassungAb({ datum: '2026-03-01', wirkungAb: '2026-07-01', eingetragenAm: '2026-04-20' }, 'gegenstand')).toBe('2026-07-01');
  });
  it('offene Eintragungen: gefasst ohne Anmeldung; angemeldet erst nach der Nachfrage-Frist', () => {
    const heute = '2026-10-10';
    const g = { ...UG, beschluesse: [
      B('a', { art: 'satzungsaenderung', datum: '2026-09-01' }), B('b', { art: 'gf-bestellung', status: 'angemeldet', angemeldetAm: tagePlus(heute, -(EINTRAGUNG_NACHFRAGEN_TAGE + 1)) }),
      B('c', { art: 'gf-bestellung', status: 'angemeldet', angemeldetAm: tagePlus(heute, -5) }), B('d', { art: 'jahresabschluss' }),
    ] };
    const o = beschluesseOhneEintragung([g], heute);
    expect(o.map(x => [x.beschlussId, x.status])).toEqual([['bs-b', 'angemeldet'], ['bs-a', 'gefasst']]);
    expect(o[1].text).toMatch(/noch nicht zum Handelsregister angemeldet/);
  });
});

describe('(a) Dokument → Vorschlag (Regelwerk ohne Modell), Vorlagen, Buch', () => {
  const TEXT = [
    'Niederschrift über eine Gesellschafterversammlung der Beispiel GmbH',
    '— Seite 1 —',
    'Anwesend: sämtliche Gesellschafter, zusammen 100 % des Stammkapitals.',
    'Die Gesellschafter beschließen einstimmig die Änderung des Gesellschaftsvertrags.',
    '§ 2 Gegenstand. Gegenstand des Unternehmens ist die Beratung zu Kennzahlen sowie die Entwicklung von Software.',
    'Das Stammkapital wird von 25.000 € auf 50.000 € erhöht.',
    'Musterstadt, den 12.03.2026',
    'Nächste Versammlung am 01.01.2099.',
  ].join('\n');
  it('Felder mit wörtlichen Fundstellen; Datum nie aus der Zukunft; Beteiligte nur als Text', () => {
    const v = beschlussAusText(TEXT, '2026-10-10');
    expect(v.felder).toMatchObject({ datum: '2026-03-12', gremium: 'gesellschafterversammlung' });
    expect(['kapitalmassnahme', 'satzungsaenderung']).toContain(v.felder.art);
    expect(v.felder.titel).toMatch(/^Niederschrift/);
    expect(v.aenderungen.find(a => a.merkmal === 'gegenstand')!.text).toMatch(/^die Beratung zu Kennzahlen/);
    expect(v.aenderungen.find(a => a.merkmal === 'stammkapital')!.cent).toBe(5_000_000);
    expect(v.fundstellen.find(f => f.feld === 'gegenstand')).toMatchObject({ stelle: '§ 2 · Seite 1' });
    expect(v.fundstellen.find(f => f.feld === 'datum')!.zitat).toBe('Musterstadt, den 12.03.2026');
    expect(v.beteiligteText[0]).toMatch(/^Anwesend/);
    expect(v.fundstellen.find(f => f.feld === 'abstimmung')!.zitat).toMatch(/einstimmig/);
  });
  it('leerer Text (Scan): Hinweis statt Vorschlag', () => {
    expect(beschlussAusText('— Seite 1 —', '2026-10-10').hinweis).toMatch(/Scan/);
  });
  it('Vorlagen: neutral, Platzhalter aus dem Register, Hinweis vorne, keine Namen oder Beträge im Code', () => {
    const e = beschlussAusVorlage(BESCHLUSS_VORLAGEN.find(v => v.id === 'kapitalerhoehung')!, UG, '2026-10-10');
    expect(e.inhalt.startsWith('Mustertext zum Ausfüllen — keine Rechtsberatung')).toBe(true);
    expect(e.inhalt).toContain('Beispiel GmbH');
    expect(e.inhalt).toContain('[…]');
    expect(e.aenderungen).toEqual([{ merkmal: 'stammkapital', cent: 3_000_000 }]);
    for (const v of BESCHLUSS_VORLAGEN) {
      const t = `${v.titel} ${v.wofuer} ${v.text ?? ''}`;
      expect(t, v.id).not.toMatch(/kevin|malin|dieckmann|kemaris|kd ventures|make innovation/i);
      expect(t, v.id).not.toMatch(/\d{1,3}\.\d{3}\s*€/);
      expect(beschlussAusVorlage(v, UG, '2026-10-10').inhalt.length, v.id).toBeGreaterThan(200);
    }
    expect(new Set(BESCHLUSS_VORLAGEN.map(v => v.id)).size).toBe(BESCHLUSS_VORLAGEN.length);
  });
  it('Buch: chronologisch, Nummer, Ergebnis, Gegenstand; als PDF lesbar', async () => {
    const g: RegisterGesellschaft = { ...UG, fassungen: [{ id: 'fs-g1', merkmal: 'gegenstand', ab: '2023-01-10', text: 'Beratung.' }], beschluesse: [
      B('z', { datum: '2026-05-01', nummer: { jahr: 2026, nr: 2 }, titel: 'Zweiter' }), B('e', { datum: '2026-02-01', titel: 'Erster', abstimmung: [{ id: GS1, stimme: 'ja', gewichtCent: 1_500_000 }], beteiligte: [GS1] }),
    ] };
    expect(buchListe(g.beschluesse).map(x => x.b.titel)).toEqual(['Erster', 'Zweiter']);
    const d = buchDokument(g, { 'gesellschaft:kdv': 'Beispiel Holding' }, { heute: '2026-10-10' });
    expect(d.jahre[0].eintraege[0].kopf).toMatch(/^Nr\. 1\/2026 \(abgeleitet\)/);
    expect(d.jahre[0].eintraege[0].zeilen.join(' ')).toMatch(/Beteiligte: Beispiel Holding/);
    expect(d.satzung[0]).toMatch(/^Gegenstand des Unternehmens: Beratung\./);
    const pdf = await beschlussBuchPdf(d, { erstellt: new Date('2026-10-10T10:00:00Z') });
    const geladen = await PDFDocument.load(pdf);
    expect(geladen.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(geladen.getTitle()).toBe(d.titel);
  });
});

// ── (b) Server ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('(b) Server: Zugang, Sicht, Altbestand, Folgen nur per Klick, Import, PDF, Recht-Check, ZOE, Art. 15', () => {
  type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
  let reg: Route, route: Route;
  let db: typeof import('@/lib/store/local-db');
  let stapel: typeof import('@/lib/zoe/stapel');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string, x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...x });
  const get = (p: string, q: string) => route.GET(new Request(`http://test/api/gesellschaften/beschluesse${q}`, { headers: kopf(p) }));
  const post = (h: Record<string, string>, body: unknown) => route.POST(new Request('http://test/api/gesellschaften/beschluesse', { method: 'POST', headers: h, body: JSON.stringify(body) }));
  const regGet = async (p: string) => (await (await reg.GET(new Request('http://test/api/gesellschaften', { headers: kopf(p) }))).json()) as { gesellschaften: (RegisterGesellschaft & { stand: string })[] };
  const patch = (p: string, body: unknown) => reg.PATCH!(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const ug = async () => (await regGet('person-a')).gesellschaften.find(x => x.id === 'ug')!;
  const offeneBeschluss = async () => (await stapel.lies('offen')).filter(v => v.bezug?.art === 'recht' && String(v.werkzeug).startsWith('recht_beschluss_'));
  const ALT: Beschluss = { id: 'bs-alt-0001', datum: '2026-01-15', art: 'gesellschafterbeschluss', titel: 'Altbestand', status: 'gefasst', inhalt: 'Wortlaut vom Online-Stand' };
  const G3 = 'g-33333333-3333-4333-8333-333333333333';
  let heute = '';

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    heute = (await import('@/lib/zeit')).localDay();
    await db.saveJson('konten', { konten: [
      konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k5', 'nur-business', 'mitglied', 'haus', { finanzRecht: 'business' }),
      konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-kontakt-0001', vorname: 'Erika', nachname: 'Beispiel', aktivitaeten: [] }] });
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2 });
    await db.saveJson('gesellschaften--haus', { gesellschaften: [{ ...UG, beschluesse: [ALT] }] } as RegisterDatei);
    await db.saveJson('gesellschaften--kunde-haus', { gesellschaften: [{ id: G3, name: 'Fremde GmbH', rechtsform: 'gmbh', beschluesse: [{ id: 'bs-fremd-0001', datum: '2026-02-01', art: 'gesellschafterbeschluss', titel: 'FREMDER-BESCHLUSS', status: 'gefasst' }] }] });
    reg = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
    route = (await import('@/app/api/gesellschaften/beschluesse/route')) as unknown as Route;
    stapel = await import('@/lib/zoe/stapel');
  });

  it('Testkunde, Partner (fremder Haushalt), Konto „nur Business“, ohne Person, Dienstweg ohne Person → 403; Folgen nie über den Dienstweg', async () => {
    for (const p of ['testkunde', 'partner', 'nur-business']) {
      expect((await get(p, '?id=ug&pdf=1')).status, p).toBe(403);
      expect((await get(p, '?id=ug&b=bs-alt-0001')).status, p).toBe(403);
      expect((await post(kopf(p), { aktion: 'folgen', id: 'ug', beschlussId: 'bs-alt-0001' })).status, p).toBe(403);
    }
    expect((await route.GET(new Request('http://test/api/gesellschaften/beschluesse?id=ug&pdf=1'))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/gesellschaften/beschluesse?id=ug&pdf=1', { headers: { 'x-make-key': 'pruef-schluessel-beschluesse' } }))).status).toBe(403);
    expect((await post({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-beschluesse', 'x-make-person': 'person-a' }, { aktion: 'folgen', id: 'ug', beschlussId: 'bs-alt-0001' })).status).toBe(403);
    const { sichtFremd } = await import('@/lib/zugang/sicht-bereich');
    expect(sichtFremd('/api/gesellschaften/beschluesse', 'privat')).toBe(true);
  });

  it('Sicht X bekommt nichts aus Y: das Buch des anderen Haushalts gibt es nicht — weder im Register noch als PDF', async () => {
    expect(JSON.stringify(await regGet('person-b'))).not.toMatch(/FREMDER-BESCHLUSS/);
    expect((await get('person-b', `?id=${G3}&pdf=1`)).status).toBe(404);
    expect((await get('testkunde', `?id=${G3}&pdf=1`)).status).toBe(403);
  });

  it('Nummer vom Server, Altbestand bleibt bit-gleich; gefasst → Folgen NUR im Stapel (nichts geschrieben), idempotent', async () => {
    let g = await ug();
    const tasksVorher = (await db.loadJson<{ tasks: unknown[] }>('tasks'))!.tasks.length;
    const r = await patch('person-a', { id: 'ug', stand: g.stand, liste: 'beschluesse', eintrag: { datum: '2026-09-01', art: 'kapitalmassnahme', titel: 'Kapitalerhöhung', status: 'gefasst', nummer: { jahr: 2000, nr: 7 },
      abstimmung: [{ id: GS1, stimme: 'ja' }, { id: GS2, stimme: 'ja' }], aenderungen: [{ merkmal: 'stammkapital', cent: '50.000' }] } });
    expect(r.status).toBe(200);
    g = (await r.json()).gesellschaft;
    const neu = g.beschluesse!.find(b => b.titel === 'Kapitalerhöhung')!;
    expect(neu.nummer).toEqual({ jahr: 2026, nr: 2 }); // Altbestand (Jan 2026) ist abgeleitet Nr. 1
    expect(neu.abstimmung![0].gewichtCent).toBe(1_500_000);
    const roh = (await db.loadJson<RegisterDatei>('gesellschaften--haus'))!.gesellschaften[0];
    expect(roh.beschluesse!.find(b => b.id === ALT.id)).toEqual(ALT);
    // Folgen: drei Vorschläge für person-a — kein Ereignis, keine Fassung, keine Aufgabe ohne Klick.
    const offen = await offeneBeschluss();
    expect(offen.map(v => v.werkzeug).sort()).toEqual(['recht_beschluss_captable', 'recht_beschluss_ereignis', 'recht_beschluss_fassung']);
    expect(offen.every(v => v.person === 'person-a' && v.gruppe === 'business')).toBe(true);
    expect(stapel.vorschlagSichtbar(offen[0], 'person-b', true)).toBe(false);
    expect((await db.loadJson<{ gesellschaften: { ereignisse?: unknown[] }[] }>('unternehmen-schild--haus'))?.gesellschaften?.[0]?.ereignisse ?? []).toEqual([]);
    expect(roh.fassungen ?? []).toEqual([]);
    expect((await db.loadJson<{ tasks: unknown[] }>('tasks'))!.tasks.length).toBe(tasksVorher);
    // Noch einmal speichern (Titel) → keine neuen Vorschläge.
    const r2 = await patch('person-a', { id: 'ug', stand: g.stand, liste: 'beschluesse', eintragId: neu.id, eintrag: { titel: 'Kapitalerhöhung auf das Doppelte' } });
    expect(r2.status).toBe(200);
    expect((await offeneBeschluss()).length).toBe(3);
    // Lesen der Folgen: alle schon in den Freigaben.
    const f = await (await get('person-b', `?id=ug&b=${neu.id}`)).json();
    expect(f.folgen.every((x: { imStapel: boolean }) => x.imStapel)).toBe(true);
  });

  it('Freigabe: Ereignis → Pflichten im Schild, Fassung → Historie + Steckbrief, Cap-Table → Aufgabe; nichts doppelt; „nur Business“ darf nicht', async () => {
    const S = await import('@/lib/recht/server');
    const offen = await offeneBeschluss();
    const ev = offen.find(v => v.werkzeug === 'recht_beschluss_ereignis')!;
    expect(await S.RECHT_STAPEL_ART.freigeben(ev, 'nur-business', {})).toMatchObject({ ok: false, status: 403 });
    expect(await S.RECHT_STAPEL_ART.freigeben(ev, 'person-b', {})).toMatchObject({ ok: false, status: 403 }); // nur für person-a vorbereitet
    expect((await S.RECHT_STAPEL_ART.freigeben(ev, 'person-a', {})).ok).toBe(true);
    const schild = (await db.loadJson<{ gesellschaften: { id: string; ereignisse?: { art: string; beschlussId?: string }[] }[] }>('unternehmen-schild--haus'))!;
    const neuId = String(ev.eingabe.beschlussId);
    expect(schild.gesellschaften.find(x => x.id === 'ug')!.ereignisse).toMatchObject([{ art: 'kapitalmassnahme', beschlussId: neuId }]);
    const { lageAus } = await import('@/lib/gesellschaften/schild/ampel');
    const lage = lageAus(await db.loadJson('gesellschaften--haus'), await db.loadJson('unternehmen-schild--haus'), heute);
    expect(lage.gesellschaften.find(x => x.id === 'ug')!.pflichten.filter(p => p.gruppe === 'ereignis').map(p => p.titel).join(' ')).toMatch(/Gesellschafterliste/);
    const fa = offen.find(v => v.werkzeug === 'recht_beschluss_fassung')!;
    expect((await S.RECHT_STAPEL_ART.freigeben(fa, 'person-a', {})).ok).toBe(true);
    const g = (await db.loadJson<RegisterDatei>('gesellschaften--haus'))!.gesellschaften[0];
    expect(g.fassungen).toMatchObject([{ merkmal: 'stammkapital', cent: 5_000_000, ab: '2026-09-01', beschlussId: neuId, von: 'person-a' }]);
    expect(g.stammkapitalCent).toBe(5_000_000); // gültige Fassung → Steckbrief
    const ct = offen.find(v => v.werkzeug === 'recht_beschluss_captable')!;
    expect((await S.RECHT_STAPEL_ART.freigeben(ct, 'person-a', {})).ok).toBe(true);
    const tasks = (await db.loadJson<{ tasks: { id: string; space?: string; title: string }[] }>('tasks'))!.tasks;
    expect(tasks.filter(t => t.id.startsWith('bfc-'))).toHaveLength(1);
    expect(tasks.find(t => t.id.startsWith('bfc-'))!.space).toBe('business');
    // Folgen noch einmal legen (Knopf): die Marke verhindert Doppeltes.
    expect(await (await post(kopf('person-a'), { aktion: 'folgen', id: 'ug', beschlussId: neuId })).json()).toMatchObject({ ok: true, gelegt: 0 });
  });

  it('Fassungen werden nie überschrieben (409) und nicht archiviert (400); in den Papierkorb geht eine falsche', async () => {
    let g = await ug();
    const f = g.fassungen![0];
    expect((await patch('person-a', { id: 'ug', stand: g.stand, liste: 'fassungen', eintragId: f.id, eintrag: { text: 'anders' } })).status).toBe(409);
    expect((await patch('person-a', { id: 'ug', stand: g.stand, liste: 'fassungen', eintragId: f.id, aktion: 'archivieren' })).status).toBe(400);
    const r = await patch('person-a', { id: 'ug', stand: g.stand, liste: 'fassungen', eintrag: { merkmal: 'gegenstand', ab: '2026-02-01', text: 'Beratung zu Kennzahlen (Beispiel).' } });
    expect(r.status).toBe(200);
    g = (await r.json()).gesellschaft;
    const geg = g.fassungen!.find(x => x.merkmal === 'gegenstand')!;
    g = (await (await patch('person-a', { id: 'ug', stand: g.stand, liste: 'fassungen', eintragId: geg.id, aktion: 'loeschen' })).json()).gesellschaft;
    expect(g.fassungen!.find(x => x.id === geg.id)!.geloeschtAm).toBeTruthy();
  });

  it('Aus Dokument: Vorschlag aus der Unterlage dieser Gesellschaft (Fundstellen wörtlich); fremde Datei → 404; PDF des Buchs', async () => {
    const { ablegen } = await import('@/lib/dateien/ablage');
    const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const s = d.addPage();
    ['Gesellschafterbeschluss der Beispiel GmbH', 'Die Gesellschafter beschliessen: Zum Geschaeftsfuehrer bestellt wird die Person laut Anlage.', 'Musterstadt, den 02.03.2026']
      .forEach((z, i) => s.drawText(z, { x: 40, y: 780 - i * 16, font: f, size: 11 }));
    const e = await ablegen('haus', 'person-a', { art: 'sonstig', titel: 'Beschluss GF' }, { bytes: Buffer.from(await d.save()), name: 'beschluss.pdf', typ: 'application/pdf' }, new Date().toISOString(), { gesellschaft: 'ug' });
    const r = await (await get('person-b', `?id=ug&datei=${e.id}`)).json();
    expect(r.ok).toBe(true);
    expect(r.vorschlag.felder.datum).toBe('2026-03-02');
    expect(r.vorschlag.fundstellen.find((x: { feld: string }) => x.feld === 'datum').zitat).toMatch(/02\.03\.2026/);
    expect((await get('person-b', `?id=kdv&datei=${e.id}`)).status).toBe(404);
    const p = await get('person-b', '?id=ug&pdf=1');
    expect(p.status).toBe(200);
    expect(p.headers.get('content-type')).toBe('application/pdf');
    expect(p.headers.get('content-disposition')).toMatch(/^attachment; filename="Beschluss-Buch-/);
    expect((await PDFDocument.load(new Uint8Array(await p.arrayBuffer()))).getPageCount()).toBeGreaterThanOrEqual(1);
    expect((await get('person-b', '?id=kdc&pdf=1')).status).toBe(400); // Privat-Einheit
  });

  it('Head of Recht: der Check nennt Beschlüsse ohne Anmeldung; ZOE liest das Buch nur lesend; Art. 15 nennt die eigene Stimme', async () => {
    const S = await import('@/lib/recht/server');
    const { check } = await S.rechtCheckJetzt('haus', heute);
    const b = check.fehlt.filter(x => x.art === 'beschluss');
    expect(b.length).toBe(1);
    expect(b[0].text).toMatch(/noch nicht zum Handelsregister angemeldet/);
    expect(b[0].weg).toMatch(/s=beschluesse/);
    expect(check.text).toMatch(/Kapitalerhöhung/);
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const roh = WERKZEUGE.gesellschaften_lesen.lauf;
    const lauf = async (...a: Parameters<typeof roh>): Promise<string> => { const r = await roh(...a); return typeof r === 'string' ? r : r.meldung; };
    const t = await lauf({}, '', 'person-b');
    expect(t).toMatch(/Beschluss Nr\. 2\/2026 vom 2026-09-01: Kapitalerhöhung/);
    expect(t).not.toMatch(/FREMDER-BESCHLUSS|Wortlaut vom Online-Stand/);
    expect(await lauf({}, '', 'testkunde')).toMatch(/^Kein Zugang/);
    const { registerAuskunft } = await import('@/lib/gesellschaften/auskunft');
    const a = registerAuskunft(await db.loadJson('gesellschaften--haus'), 'c-kontakt-0001');
    expect(a.find(x => x.rolle === 'Beschluss')!.angaben).toMatch(/Nr\. 2\/2026 .*eigene Stimme: Ja/);
    expect(JSON.stringify(a)).not.toMatch(/Wortlaut/);
  });
});
