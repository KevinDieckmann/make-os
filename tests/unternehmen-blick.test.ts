// Unternehmen „in einem Blick“ (11.10., Branch `design-unternehmen`): Ton (ruhige Tonalität), vier Dimensionen, das Wichtigste jetzt, Jahres-Zeitstrahl +
// Kalenderdatei, Risiko-Matrix, Lebenslauf, Ereignis-Assistent (Folgekette, Zusatz-Schritte, Beschluss-Entwurf ohne doppelte Folgen), „Bereit für Kanzlei
// und Steuerbüro“, Gesundheits-Verlauf — und am Server: Verlauf nur für den Haushalt des Inhabers und nur Business, `ausBeschluss` nur auf einen Beschluss
// dieser Gesellschaft, Ereignisse ohne Zusatz bit-gleich. Eigener Datenordner, erfundene Konten (@example.invalid) und Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { RegisterDatei, RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import type { SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import { lageAus } from '@/lib/gesellschaften/schild/ampel';
import { blickFuer, lageBlick, pflichtTon, wichtigste, dokumenteBlick, mengenSatz, type Handgriff } from '@/lib/gesellschaften/schild/blick';
import { strahlEintraege, jahresStrahl, jeMonat, fristenIcs, falten, STRAHL } from '@/lib/gesellschaften/schild/jahresstrahl';
import { risikoMatrix, EINTRITT_KLAR, WIRKUNG_KLAR } from '@/lib/gesellschaften/schild/matrix';
import { risikoZeilen } from '@/lib/gesellschaften/schild/risiken';
import { lebenslauf, lebenslaufJahre } from '@/lib/gesellschaften/lebenslauf';
import { SITUATIONEN, folgekette, ereignisseFuer, ereignisEintraege, beschlussEntwurf, zusatzWahl, phaseVon, PHASEN, situationVon } from '@/lib/gesellschaften/schild/assistent';
import { pflichtenFuer, ZUSATZ_SCHRITTE, EREIGNIS_ARTEN, ereignisSchritte } from '@/lib/gesellschaften/schild/pflichten';
import { kontextVon } from '@/lib/gesellschaften/schild/kontext';
import { eintragAnwenden, vermerkAnwenden, type Kontext } from '@/lib/gesellschaften/schild/saeubern';
import { kanzleiBereit } from '@/lib/gesellschaften/schild/kanzlei';
import { verlaufPunkt, verlaufAnhaengen, verlaufFuer, verlaufReihe, VERLAUF_TAGE } from '@/lib/gesellschaften/schild/verlauf';
import { organeKurz, strichStaerke } from '@/lib/gesellschaften/schild/struktur';
import { beschlussFolgen } from '@/lib/gesellschaften/beschluesse';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-blick-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-blick';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const HEUTE = '2026-10-10';
const K: Kontext = { person: 'person-a', jetzt: '2026-10-10T08:00:00.000Z', heute: HEUTE, personen: ['person-a', 'person-b'] };
const gmbh = (x: Partial<RegisterGesellschaft> = {}): RegisterGesellschaft => ({ id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000,
  gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }], ...x });
const register = (x: Partial<RegisterGesellschaft> = {}): RegisterDatei => ({ gesellschaften: [{ id: 'kdc', rechtsform: 'einzel' }, gmbh(x)] });
const lageUg = (s?: SchildGesellschaft, x: Partial<RegisterGesellschaft> = {}) => lageAus(register(x), s ? { gesellschaften: [s] } : null, HEUTE).gesellschaften.find(g => g.id === 'ug')!;

describe('Ruhige Tonalität: rot nur, wenn eine Folge droht', () => {
  it('Pflicht: gesetzlich verstrichen → rot; Vorschlagstermin verstrichen → gelb; im Vorlauf → gelb, mit Eskalation rot; sonst nichts', () => {
    expect(pflichtTon({ status: 'ueberfaellig' })).toBe('rot');
    expect(pflichtTon({ status: 'ueberfaellig', annahme: true })).toBe('gelb');
    expect(pflichtTon({ status: 'faellig' })).toBe('gelb');
    expect(pflichtTon({ status: 'faellig', eskalation: true })).toBe('rot');
    expect(pflichtTon({ status: 'offen' })).toBeNull();
    expect(pflichtTon({ status: 'erledigt' })).toBeNull();
  });
  it('fehlende Unterlagen ohne Frist sind ruhig (nie rot) — auch Pflichtunterlagen; Rechtsform fehlt → gelb', () => {
    const g = lageUg();
    const b = blickFuer(g, null, HEUTE);
    const doks = b.handgriffe.filter(h => h.art === 'dokument');
    expect(doks.length).toBeGreaterThan(5);
    expect(doks.every(h => h.ton !== 'rot')).toBe(true);
    expect(doks.find(h => h.id.endsWith(':satzung'))!.ton).toBe('ruhig');
    const ohne = blickFuer(lageAus({ gesellschaften: [{ id: 'ug' }] }, null, HEUTE).gesellschaften[0], null, HEUTE);
    expect(ohne.handgriffe.find(h => h.id.endsWith(':rechtsform'))!.ton).toBe('gelb');
  });
  it('die Compliance-Ampel bleibt unverändert (Head of Recht), der Ton ist die Sprache der Oberfläche', () => {
    const g = lageUg();
    expect(g.compliance.ampel).toBe('rot');
    const b = blickFuer(g, null, HEUTE);
    // Verstrichene gesetzliche Fristen (Offenlegung, Feststellung …) machen den Ton rot — die fehlenden Unterlagen allein nicht.
    expect(b.ton).toBe('rot');
    expect(b.handgriffe.filter(h => h.ton === 'rot').every(h => h.art === 'pflicht')).toBe(true);
  });
  it('alles erledigt und abgelegt → grün; ohne verstrichene Pflicht, aber mit Lücken → ruhig', () => {
    const g = lageUg();
    const vermerke = g.pflichten.filter(p => p.status !== 'offen').map((p, i) => ({ id: `vm-${i}`, regelId: p.regelId, periode: p.periode, status: 'erledigt' as const, am: '2026-01-01', von: 'person-a' }));
    const b = blickFuer(lageUg({ id: 'ug', vermerke }), { id: 'ug', vermerke }, HEUTE);
    expect(b.handgriffe.some(h => h.ton === 'rot')).toBe(false);
    expect(['ruhig', 'gelb']).toContain(b.ton);
  });
});

describe('Das Wichtigste jetzt: höchstens drei, nach Folge und Frist; Mengen statt Listen', () => {
  const h = (id: string, art: Handgriff['art'], gewicht: number): Handgriff => ({ id, art, gewicht, ton: 'ruhig', gesellschaftId: 'ug', gesellschaft: 'X', titel: id, weg: '/os/unternehmen' });
  it('höchstens drei, je Art höchstens zwei, solange es andere gibt', () => {
    const l = [h('d1', 'dokument', 300), h('d2', 'dokument', 290), h('d3', 'dokument', 280), h('r1', 'risiko', 100)];
    expect(wichtigste(l).map(x => x.id)).toEqual(['d1', 'd2', 'r1']);
    expect(wichtigste([h('d1', 'dokument', 3), h('d2', 'dokument', 2), h('d3', 'dokument', 1)]).map(x => x.id)).toEqual(['d1', 'd2', 'd3']);
  });
  it('die rote Pflicht steht vor den Unterlagen; mehrere Perioden einer Regel = EIN Handgriff mit Anzahl', () => {
    const b = blickFuer(lageUg(), null, HEUTE);
    expect(b.wichtigste).toHaveLength(3);
    expect(b.wichtigste[0].ton).toBe('rot');
    const regeln = b.handgriffe.filter(x => x.art === 'pflicht').map(x => x.id);
    expect(new Set(regeln).size).toBe(regeln.length);
    expect(b.satz).toMatch(/verstrichen/);
    expect(mengenSatz({ dokumenteFehlen: 0, pflichtDokumenteFehlen: 0, verstrichen: 0, bald: 0, risikenOffen: 0, schutzOffen: 0, ohneEile: 0 })).toMatch(/Keine Frist offen/);
  });
  it('vier Dimensionen mit Anteil 0–1 bzw. null, Weg in den Reiter; lageBlick zählt je Ton', () => {
    const b = blickFuer(lageUg(), null, HEUTE);
    expect(b.dimensionen.map(d => d.id)).toEqual(['dokumente', 'pflichten', 'risiken', 'schutz']);
    for (const d of b.dimensionen) if (d.anteil !== null) { expect(d.anteil).toBeGreaterThanOrEqual(0); expect(d.anteil).toBeLessThanOrEqual(1); }
    expect(b.dimensionen.find(d => d.id === 'risiken')!.anteil).toBeNull();
    const lb = lageBlick(lageAus(register(), null, HEUTE), []);
    expect(lb.je.map(x => x.id)).toContain('ug');
    expect(lb.je.map(x => x.id)).not.toContain('kdc'); // die Privat-Einheit nie
    expect(lb.satz).toMatch(/^\d+ Gesellschaften? — .*mit drohender Folge/);
    expect(lb.zaehler.rot + lb.zaehler.gelb + lb.zaehler.ruhig + lb.zaehler.gruen).toBe(lb.je.length);
  });
  it('Dokumente: Ring zählt Pflicht und Empfehlung, „zuerst“ höchstens drei — Gesellschaftsrecht vor dem Rest', () => {
    const d = dokumenteBlick(lageUg().dokumente);
    expect(d.ok + (d.soll - d.ok)).toBe(d.soll);
    expect(d.zuerst.length).toBe(3);
    expect(d.zuerst[0].stufe).toBe('pflicht');
    expect(d.zuerst[0].katalog.gruppe).toBe('gesellschaft');
    expect(d.gruppen.reduce((n, g) => n + g.soll, 0)).toBe(d.soll);
  });
});

describe('Jahres-Zeitstrahl und Kalenderdatei', () => {
  const lage = lageAus(register(), null, HEUTE);
  const e = strahlEintraege(lage);
  it('zwölf Monate ab zwei Monaten zurück, Lagen 0–1, heute und „bald“ (90 Tage) im Fenster', () => {
    const s = jahresStrahl(e, HEUTE);
    expect(s.monate).toHaveLength(STRAHL.monate);
    expect(s.von).toBe('2026-08-01');
    expect(s.bis).toBe('2027-07-31');
    expect(s.heuteX).toBeGreaterThan(0); expect(s.heuteX).toBeLessThan(0.25);
    expect(s.bald.bis).toBeGreaterThan(s.bald.von);
    for (const m of s.marken) { expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(1); expect(m.tag >= s.von && m.tag <= s.bis).toBe(true); }
    // Marken, die sich zu nahe kommen, stehen in verschiedenen Reihen.
    const gleich = s.marken.filter(m => m.tag === s.marken[0].tag);
    expect(new Set(gleich.map(m => m.reihe)).size).toBe(gleich.length);
    expect(s.vorher.anzahl).toBeGreaterThan(0); // verstrichene Pflichten vor August werden gezählt, nicht gezeichnet
  });
  it('Töne: verstrichen gesetzlich = rot, Vorschlagstermin = gelb, erledigt = erledigt; nur Business', () => {
    expect(e.every(x => x.gesellschaftId === 'ug')).toBe(true);
    expect(e.some(x => x.ton === 'rot')).toBe(true);
    const tr = e.find(x => x.id.includes('transparenz-abgleich|2026'))!;
    expect(tr.ton).toBe('gelb'); // Abgleich Ende Januar ist ein Vorschlag (annahme)
  });
  it('Liste je Monat: zuerst „Verstrichen“, dann die Monate ab heute', () => {
    const gr = jeMonat(e, HEUTE, jahresStrahl(e, HEUTE));
    expect(gr[0].key).toBe('verstrichen');
    expect(gr.slice(1).every(g => /^\d{4}-\d{2}$/.test(g.key))).toBe(true);
  });
  it('ICS: gültiger Rahmen, ganztägig, Erinnerung, nichts Erledigtes, Zeilen ≤ 75 Byte, Sonderzeichen maskiert', () => {
    const ics = fristenIcs([...e, { ...e[0], id: 'x-erledigt', ton: 'erledigt' }], '2026-10-10T08:00:00.000Z', 'Plan; Test');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(e.filter(x => x.ton !== 'erledigt').length);
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(ics).toMatch(/TRIGGER:-P7D/);
    expect(ics).toContain('X-WR-CALNAME:Plan\\; Test');
    expect(ics).not.toContain('x-erledigt');
    for (const z of ics.split('\r\n')) expect(new TextEncoder().encode(z).length).toBeLessThanOrEqual(75);
    expect(falten('ä'.repeat(80)).split('\r\n ').join('')).toBe('ä'.repeat(80));
  });
});

describe('Risiko-Matrix: Punkte = Risiken, Nummern nach Schwere, Achsen in Klartext', () => {
  const s: SchildGesellschaft = { id: 'ug', risiken: [
    { id: 'rk-1', titel: 'Großkunde', kategorie: 'kunden', status: 'offen', bewertungen: [{ am: '2026-09-01', von: 'person-a', eintritt: 4, wirkung: 4, art: 'netto' }] },
    { id: 'rk-2', titel: 'Domain', kategorie: 'recht', status: 'offen', bewertungen: [{ am: '2026-09-01', von: 'person-a', eintritt: 1, wirkung: 2, art: 'netto' }] },
    { id: 'rk-3', titel: 'Unbewertet', kategorie: 'it', status: 'offen', bewertungen: [] },
    { id: 'rk-4', titel: 'Erledigt', kategorie: 'it', status: 'erledigt', bewertungen: [{ am: '2026-09-01', von: 'person-a', eintritt: 5, wirkung: 5, art: 'netto' }] },
  ] };
  it('25 Felder, zwei Punkte (Erledigtes fällt weg), Nummer 1 = schwerstes, Unbewertete gezählt', () => {
    const m = risikoMatrix([{ gesellschaftId: 'ug', gesellschaft: 'X', risiken: risikoZeilen(s, HEUTE) }]);
    expect(m.zellen).toHaveLength(25);
    expect(m.punkte.map(p => [p.nr, p.titel, p.ampel])).toEqual([[1, 'Großkunde', 'rot'], [2, 'Domain', 'gruen']]);
    expect(m.zellen.find(z => z.eintritt === 4 && z.wirkung === 4)!.punkte).toHaveLength(1);
    expect(m.unbewertet).toBe(1);
    expect(EINTRITT_KLAR[5]).toBe('fast sicher');
    expect(WIRKUNG_KLAR[5]).toBe('bestandsgefährdend');
  });
});

describe('Lebenslauf der Gesellschaft', () => {
  const g = gmbh({
    eingetragenAm: '2023-02-01',
    beschluesse: [{ id: 'bs-aaaa-0001', datum: '2024-03-01', art: 'kapitalmassnahme', titel: 'Kapitalerhöhung', status: 'eingetragen', eingetragenAm: '2024-04-10' }, { id: 'bs-aaaa-0002', datum: '2025-01-01', art: 'sonstiges', titel: 'Entwurf', status: 'entwurf' }],
    fassungen: [{ id: 'fs-1', merkmal: 'stammkapital', ab: '2024-04-10', cent: 5_000_000, beschlussId: 'bs-aaaa-0001' }, { id: 'fs-2', merkmal: 'gegenstand', ab: '2024-04-10', text: 'Neu', beschlussId: 'bs-aaaa-0001' }],
    organe: [{ id: 'og-1', funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: 'person-a' }, seit: '2023-01-10' }],
  });
  const s: SchildGesellschaft = { id: 'ug', ereignisse: [{ id: 'ev-1', art: 'kapitalmassnahme', datum: '2024-03-01', beschlussId: 'bs-aaaa-0001' }, { id: 'ev-2', art: 'neuer-vertrag', datum: '2026-09-01', notiz: 'Rahmenvertrag' }] };
  const l = lebenslauf(g, s, b => `Name ${b.id}`, HEUTE);
  it('Gründung, Eintragung, Beschlüsse (ohne Entwurf), Fassungen gebündelt, Organe, Ereignisse — neueste zuerst', () => {
    expect(l.map(x => x.tag)).toEqual([...l.map(x => x.tag)].sort().reverse());
    expect(l.some(x => x.titel === 'Entwurf')).toBe(false);
    expect(l.filter(x => x.art === 'fassung')).toHaveLength(1);
    expect(l.find(x => x.art === 'fassung')!.titel).toMatch(/Stammkapital .*50\.000.*Gegenstand/);
    expect(l.find(x => x.art === 'organ')!.titel).toBe('Geschäftsführung: Name person-a beginnt');
    expect(l.some(x => x.id === 'ev:ev-1')).toBe(false); // steht schon als Beschluss
    expect(l.find(x => x.id === 'ev:ev-2')!.unter).toBe('Rahmenvertrag');
    expect(lebenslaufJahre(l)[0].jahr).toBe('2026');
  });
  it('Organe im Bild: nur wer heute im Amt ist; Strichstärke wächst mit dem Anteil', () => {
    expect(organeKurz(g, b => `N-${b.id}`, HEUTE)).toEqual(['Geschäftsführung: N-person-a']);
    expect(organeKurz({ organe: [{ id: 'og-2', funktion: 'prokura', wer: { art: 'person', id: 'p' }, bis: '2025-01-01' }] }, () => 'x', HEUTE)).toEqual([]);
    expect(strichStaerke(100)).toBeGreaterThan(strichStaerke(10));
    expect(strichStaerke(-5)).toBe(1.2);
  });
});

describe('Ereignis-Assistent: Folgekette, Zusatz-Schritte, Beschluss-Entwurf', () => {
  const k = kontextVon(gmbh());
  it('jede Lage hat ein bekanntes Ereignis, vorgeschlagene Zusatz-Schritte gibt es im Katalog, Beschluss-Vorlagen gibt es', () => {
    for (const s of SITUATIONEN) {
      expect(EREIGNIS_ARTEN.some(e => e.id === s.ereignis), s.id).toBe(true);
      for (const z of s.zusatz) expect(ZUSATZ_SCHRITTE.some(x => x.key === z), `${s.id}:${z}`).toBe(true);
    }
    expect(new Set(SITUATIONEN.map(s => s.id)).size).toBe(SITUATIONEN.length);
    expect(situationVon('gibt-es-nicht')).toBeUndefined();
  });
  it('Phasen in der üblichen Reihenfolge: Beschluss → Notar → … → intern; gleiche Schritte aus zwei Ereignissen einmal', () => {
    const sitz = situationVon('sitz')!;
    expect(ereignisseFuer(sitz, k, false)).toEqual(['sitz-anschrift']);
    expect(ereignisseFuer(sitz, k, true)).toEqual(['sitz-anschrift', 'satzungsaenderung']);
    const f = folgekette(sitz, k, '2026-11-01', { beschluss: true, zusatz: ['z-bank'] });
    const ids = f.phasen.map(p => p.id);
    expect(ids).toEqual(PHASEN.map(p => p.id).filter(p => ids.includes(p)));
    expect(f.phasen[0].id).toBe('beschluss');
    const titel = f.phasen.flatMap(p => p.schritte.map(s => s.titel));
    expect(new Set(titel).size).toBe(titel.length);
    expect(titel).toContain('Bank informieren (Vertretung, Anschrift bzw. Firma, Kontovollmachten)');
    expect(f.phasen.flatMap(p => p.schritte).find(s => s.key.endsWith(':finanzamt'))!.frist).toBe('2026-12-01');
    expect(phaseVon('transparenzregister')).toBe('transparenz');
    expect(phaseVon('z-steuerbuero')).toBe('informieren');
  });
  it('Rechtsform passt nicht (Einzelunternehmen) → „gilt nicht“; Gründung führt die Anmeldung', () => {
    const einzel = kontextVon({ id: 'g-11111111-1111-4111-8111-111111111111', rechtsform: 'einzel' });
    expect(folgekette(situationVon('kapital')!, einzel, HEUTE, { beschluss: true, zusatz: [] }).giltNicht).toBe(true);
    const gr = folgekette(situationVon('gruendung')!, kontextVon(gmbh({ status: 'gruendung' })), HEUTE, { beschluss: false, zusatz: [] });
    expect(gr.phasen.map(p => p.id)).toEqual(['beschluss', 'notar', 'geld', 'register', 'transparenz', 'behoerden'].filter(p => gr.phasen.some(x => x.id === p)));
    expect(gr.phasen.flatMap(p => p.schritte).some(s => /Handelsregister/.test(s.titel))).toBe(true);
  });
  it('Zusatz-Wahl ohne Doppel zu den Pflichten; Einträge: Zusatz nur am Ereignis der Lage', () => {
    const firma = situationVon('firma')!;
    const w = zusatzWahl(firma);
    expect(w.filter(z => z.vorgeschlagen).map(z => z.key)).toEqual([...firma.zusatz]);
    const e = ereignisEintraege(situationVon('sitz')!, k, '2026-11-01', { beschluss: true, zusatz: ['z-bank', 'z-bank', 'z-unbekannt'] }, 'Notiz');
    expect(e).toEqual([{ art: 'sitz-anschrift', datum: '2026-11-01', zusatz: ['z-bank'], notiz: 'Notiz' }, { art: 'satzungsaenderung', datum: '2026-11-01', notiz: 'Notiz' }]);
  });
  it('Beschluss-Entwurf: Status Entwurf, Datum des Ereignisses, Platzhalter statt erfundener Werte, Kapital als Ausgangspunkt', () => {
    const b = beschlussEntwurf(situationVon('firma')!, gmbh(), '2026-11-01', HEUTE)!;
    expect(b).toMatchObject({ status: 'entwurf', datum: '2026-11-01', art: 'satzungsaenderung', aenderungen: [{ merkmal: 'firmierung', text: '[…]' }] });
    expect(String(b.inhalt)).toMatch(/keine Rechtsberatung/i);
    expect(beschlussEntwurf(situationVon('kapital')!, gmbh(), HEUTE, HEUTE)!.aenderungen).toEqual([{ merkmal: 'stammkapital', cent: 2_500_000 }]);
    expect(beschlussEntwurf(situationVon('kapital')!, gmbh({ stammkapitalCent: undefined }), HEUTE, HEUTE)!.aenderungen).toEqual([]);
    expect(beschlussEntwurf(situationVon('gruendung')!, gmbh(), HEUTE, HEUTE)).toBeNull();
  });
});

describe('Zusatz-Schritte im Pflichten-Kalender: nur angehakt, Altbestand bit-gleich', () => {
  const k = kontextVon(gmbh());
  it('ein Ereignis ohne Zusatz rechnet wie bisher; mit Zusatz kommen genau diese Schritte dazu', () => {
    const ohne: SchildGesellschaft = { id: 'ug', ereignisse: [{ id: 'ev-1', art: 'gf-wechsel', datum: '2026-10-01' }] };
    const mit: SchildGesellschaft = { id: 'ug', ereignisse: [{ id: 'ev-1', art: 'gf-wechsel', datum: '2026-10-01', zusatz: ['z-partner'] }] };
    const a = pflichtenFuer(k, ohne, HEUTE).filter(p => p.gruppe === 'ereignis');
    const b = pflichtenFuer(k, mit, HEUTE).filter(p => p.gruppe === 'ereignis');
    expect(b.length).toBe(a.length + 1);
    expect(b.filter(p => !a.some(x => x.schluessel === p.schluessel)).map(p => p.regelId)).toEqual(['ev:z-partner']);
    expect(ereignisSchritte({ art: 'gf-wechsel' }).map(p => p.key)).toEqual(EREIGNIS_ARTEN.find(e => e.id === 'gf-wechsel')!.pflichten.map(p => p.key));
  });
  it('Säubern: nur bekannte Zusatz-Schritte, ohne Doppelte; ein Vermerk auf einen Zusatz-Schritt geht', () => {
    const leer: SchildGesellschaft = { id: 'ug' };
    expect(eintragAnwenden(leer, 'ereignisse', { art: 'gf-wechsel', datum: '2026-10-01', zusatz: ['z-erfunden'] }, K, { neueId: 'ev-x' }).fehler[0].feld).toBe('zusatz');
    const r = eintragAnwenden(leer, 'ereignisse', { art: 'gf-wechsel', datum: '2026-10-01', zusatz: ['z-bank', 'z-bank'] }, K, { neueId: 'ev-x' });
    expect(r.s!.ereignisse![0].zusatz).toEqual(['z-bank']);
    expect(r.s!.ereignisse![0].beschlussId).toBeUndefined(); // vom Browser nie
    const v = vermerkAnwenden(r.s!, { regelId: 'ev:z-bank', periode: 'ev-x', status: 'erledigt' }, K, 'vm-1');
    expect(v.fehler).toEqual([]);
    expect(vermerkAnwenden(r.s!, { regelId: 'ev:z-versicherungen', periode: 'ev-x', status: 'erledigt' }, K, 'vm-2').status).toBe(404);
    // Ändern ohne `zusatz` behält ihn; neue Ereignis-Arten werden angenommen.
    expect(eintragAnwenden(r.s!, 'ereignisse', { notiz: 'neu' }, K, { eintragId: 'ev-x' }).s!.ereignisse![0].zusatz).toEqual(['z-bank']);
    for (const art of ['gruendung', 'aufloesung', 'beteiligung-erwerb']) expect(eintragAnwenden(leer, 'ereignisse', { art, datum: '2026-10-01' }, K, { neueId: 'ev-y' }).fehler).toEqual([]);
  });
});

describe('Bereit für Kanzlei und Steuerbüro', () => {
  it('GmbH ohne Unterlagen: offen; mit Profil, Abschluss-Vermerk, Beschluss und Unterlagen: bereit', () => {
    const leer = kanzleiBereit(lageUg(), gmbh(), HEUTE);
    expect(leer.status).toBe('offen');
    expect(leer.gj).toBe('GJ 2025');
    expect(leer.fragen.length).toBe(leer.gesamt - leer.da);
    const doks = ['steuer-stammdaten', 'elster-zertifikat', 'verfahrensdoku', 'gesellschafterliste', 'krisenfrueherkennung'].map((art, i) => ({ id: `dok-${i}`, art, status: 'vorhanden' as const, fassungVom: '2026-10-01', ...(art === 'elster-zertifikat' ? { gueltigBis: '2028-01-01' } : {}) }));
    const s: SchildGesellschaft = { id: 'ug', profil: { groessenklasse: 'klein', umsatzVorjahrCent: 1, bilanzsummeCent: 1 }, dokumente: doks,
      vermerke: [{ id: 'vm-1', regelId: 'ja-aufstellen', periode: '2025-12-31', status: 'erledigt', am: '2026-05-01', von: 'person-a' }] };
    const reg = gmbh({ beschluesse: [{ id: 'bs-aaaa-0009', datum: '2026-06-01', art: 'jahresabschluss', titel: 'Feststellung', status: 'gefasst' }] });
    const voll = kanzleiBereit(lageAus({ gesellschaften: [reg] }, { gesellschaften: [s] }, HEUTE).gesellschaften.find(x => x.id === 'ug')!, reg, HEUTE);
    expect(voll.punkte.filter(p => !p.da).map(p => p.id)).toEqual([]);
    expect(voll.status).toBe('bereit');
  });
});

describe('Gesundheits-Verlauf: ein Punkt je Tag, rollend, nur erlaubte Gesellschaften', () => {
  const lb = lageBlick(lageAus(register(), null, HEUTE), []);
  it('anhängen ersetzt den Tag (idempotent), älter als 400 Tage fällt heraus', () => {
    const p = verlaufPunkt(lb, HEUTE);
    expect(p.je.ug.t).toBe('rot');
    expect(p.je.ug.d).toHaveLength(4);
    const a = verlaufAnhaengen(null, p);
    expect(a.geaendert).toBe(true);
    expect(verlaufAnhaengen(a.d, p).geaendert).toBe(false);
    const alt = { tage: [{ tag: '2025-01-01', je: { ug: { t: 'gruen' as const, d: [1, 1, 1, 1] as [number, number, number, number] } } }] };
    expect(verlaufAnhaengen(alt, p).d.tage.map(x => x.tag)).toEqual([HEUTE]);
    expect(VERLAUF_TAGE).toBe(400);
  });
  it('Filter: nur die übergebenen Kennungen; Reihe nimmt den schlimmsten Ton', () => {
    const d = { tage: [{ tag: '2026-10-09', je: { ug: { t: 'gelb' as const, d: [1, 1, 1, 1] as [number, number, number, number] }, kdc: { t: 'rot' as const, d: [1, 1, 1, 1] as [number, number, number, number] } } }] };
    expect(verlaufFuer(d, ['ug'])[0].je).toEqual({ ug: d.tage[0].je.ug });
    expect(verlaufFuer(d, ['g-x'])).toEqual([]);
    expect(verlaufReihe(d.tage)).toEqual([{ tag: '2026-10-09', ton: 'rot' }]);
    expect(verlaufReihe(d.tage, 'ug')).toEqual([{ tag: '2026-10-09', ton: 'gelb' }]);
  });
});

// ─── Server ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Server: Verlauf, Assistent (ausBeschluss), Folgen nicht doppelt', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let schildRoute: Route;
  let regRoute: Route;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string, x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...x });
  const get = (p: string, q = '') => schildRoute.GET(new Request(`http://test/api/gesellschaften/schild${q}`, { headers: kopf(p) }));
  const patch = (p: string, body: unknown) => schildRoute.PATCH(new Request('http://test/api/gesellschaften/schild', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const regPatch = (p: string, body: unknown) => regRoute.PATCH(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const regStand = async () => ((await (await regRoute.GET(new Request('http://test/api/gesellschaften', { headers: kopf('person-a') }))).json()).gesellschaften as { id: string; stand: string }[]).find(g => g.id === 'ug')!.stand;
  const schildStand = async () => ((await (await get('person-a')).json()).eintraege as { id: string; stand: string }[]).find(e => e.id === 'ug')!.stand;

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k5', 'nur-business', 'mitglied', 'haus', { finanzRecht: 'business' }),
      konto('k3', 'testkunde', 'inhaber', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2 });
    await db.saveJson('gesellschaften--haus', register({ beschluesse: [{ id: 'bs-fremd-0001', datum: '2026-01-01', art: 'sonstiges', titel: 'Alt', status: 'gefasst' }] }));
    await db.saveJson('gesellschaften--kunde-haus', { gesellschaften: [{ id: 'ug', rechtsform: 'gmbh', beschluesse: [{ id: 'bs-kunde-0001', datum: '2026-01-01', art: 'sonstiges', titel: 'FREMD', status: 'gefasst' }] }] });
    await db.saveJson('unternehmen-verlauf--kunde-haus', { tage: [{ tag: '2026-10-01', je: { ug: { t: 'rot', d: [1, 1, 1, 1] } } }] });
    await db.saveJson('unternehmen-verlauf--haus', { tage: [{ tag: '2026-10-01', je: { ug: { t: 'gelb', d: [10, 20, 30, 40] }, kdc: { t: 'rot', d: [1, 1, 1, 1] }, 'g-99999999-9999-4999-8999-999999999999': { t: 'rot', d: [1, 1, 1, 1] } } }] });
    schildRoute = (await import('@/app/api/gesellschaften/schild/route')) as unknown as Route;
    regRoute = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
  });

  it('Verlauf: Testkunde und Konto „nur Business“ → 403; Sicht X bekommt nichts aus Y — nur Business-Gesellschaften des eigenen Haushalts', async () => {
    for (const p of ['testkunde', 'nur-business']) expect((await get(p, '?verlauf=1')).status, p).toBe(403);
    const d = await (await get('person-b', '?verlauf=1')).json();
    expect(d.ok).toBe(true);
    expect(d.tage).toEqual([{ tag: '2026-10-01', je: { ug: { t: 'gelb', d: [10, 20, 30, 40] } } }]); // ohne Privat-Einheit, ohne Unbekanntes, ohne fremden Haushalt
  });

  it('Morgenlauf: Verlauf merken ist idempotent (ein Tag, kein zweites Schreiben)', async () => {
    const S = await import('@/lib/gesellschaften/schild-server');
    expect(await S.schildVerlaufMerken('haus', HEUTE)).toBe(true);
    expect(await S.schildVerlaufMerken('haus', HEUTE)).toBe(false);
    const v = (await db.loadJson<{ tage: { tag: string }[] }>('unternehmen-verlauf--haus'))!.tage;
    expect(v.filter(x => x.tag === HEUTE)).toHaveLength(1);
  });

  it('Assistent: Beschluss-Entwurf über das Register, Ereignis mit ausBeschluss + Zusatz über das Schild; fremder/unbekannter Beschluss → 404; Folgen später nicht doppelt', async () => {
    const sit = situationVon('gf')!;
    const g = (await db.loadJson<RegisterDatei>('gesellschaften--haus'))!.gesellschaften.find(x => x.id === 'ug')!;
    const r = await regPatch('person-a', { id: 'ug', stand: await regStand(), liste: 'beschluesse', eintrag: beschlussEntwurf(sit, g, '2026-11-01', HEUTE) });
    expect(r.status).toBe(200);
    const neu = ((await r.json()).gesellschaft.beschluesse as { id: string; status: string; nummer?: unknown }[]).find(b => b.status === 'entwurf')!;
    expect(neu.nummer).toBeUndefined();
    // Unbekannter bzw. fremder Beschluss: 404, nichts gespeichert.
    for (const bid of ['bs-gibt-es-nicht', 'bs-kunde-0001']) {
      const x = await patch('person-a', { id: 'ug', stand: await schildStand(), liste: 'ereignisse', eintrag: { art: 'gf-wechsel', datum: '2026-11-01' }, ausBeschluss: bid });
      expect(x.status, bid).toBe(404);
    }
    expect((await patch('person-a', { id: 'ug', stand: await schildStand(), liste: 'ereignisse', eintrag: { art: 'gf-wechsel', datum: '2026-11-01' }, ausBeschluss: 'KEIN muster' })).status).toBe(400);
    expect((await db.loadJson<{ gesellschaften: { ereignisse?: unknown[] }[] }>('unternehmen-schild--haus'))?.gesellschaften?.find(() => true)?.ereignisse ?? []).toEqual([]);
    const [ev] = ereignisEintraege(sit, kontextVon(g), '2026-11-01', { beschluss: true, zusatz: ['z-partner'] });
    const ok = await patch('person-a', { id: 'ug', stand: await schildStand(), liste: 'ereignisse', eintrag: ev, ausBeschluss: neu.id });
    expect(ok.status).toBe(200);
    const e = (await ok.json()).eintrag.ereignisse[0];
    expect(e).toMatchObject({ art: 'gf-wechsel', datum: '2026-11-01', zusatz: ['z-partner'], beschlussId: neu.id });
    // Wird der Beschluss später gefasst, schlägt das Beschluss-Buch das Ereignis NICHT noch einmal vor.
    const reg = (await db.loadJson<RegisterDatei>('gesellschaften--haus'))!.gesellschaften.find(x => x.id === 'ug')!;
    const b = { ...reg.beschluesse!.find(x => x.id === neu.id)!, status: 'gefasst' as const };
    const schild = (await db.loadJson<{ gesellschaften: SchildGesellschaft[] }>('unternehmen-schild--haus'))!.gesellschaften.find(x => x.id === 'ug')!;
    const f = beschlussFolgen(reg, b, { kontext: kontextVon(reg, schild), ereignisseDa: schild.ereignisse });
    expect(f.folgen.filter(x => x.art === 'ereignis')).toEqual([]);
    // Die Pflichten samt Zusatz-Schritt stehen im Kalender des Schilds.
    const lage = lageAus(await db.loadJson('gesellschaften--haus'), await db.loadJson('unternehmen-schild--haus'), HEUTE);
    expect(lage.gesellschaften.find(x => x.id === 'ug')!.pflichten.some(p => p.regelId === 'ev:z-partner')).toBe(true);
  });
});

// ─── Oberfläche: rendert ohne Fehler, sagt „Was sehe ich?“, nennt keine Rechtsberatung als Beratung ──────────────────────

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/unternehmen' }));

describe('Oberfläche (statisch gerendert)', () => {
  const reg = gmbh({ beschluesse: [{ id: 'bs-aaaa-0001', datum: '2024-03-01', art: 'kapitalmassnahme', titel: 'Kapitalerhöhung', status: 'eingetragen' }] });
  const s: SchildGesellschaft = { id: 'ug', risiken: [{ id: 'rk-1', titel: 'Großkunde', kategorie: 'kunden', status: 'offen', bewertungen: [{ am: '2026-09-01', von: 'person-a', eintritt: 4, wirkung: 4, art: 'netto' }] }] };
  const lage = lageAus({ gesellschaften: [{ id: 'kdc', rechtsform: 'einzel' }, reg] }, { gesellschaften: [s] }, HEUTE);
  const anzeige = { ...reg, name: 'Beispiel GmbH', stand: 'x', luecken: [], verweise: { deals: 0, mandate: 0, produkte: 0, gesellschafter: 0, vertraege: 0, nachfolger: 0 } };
  const daten = { gesellschaften: [anzeige], personen: [], namen: {}, geloescht: [] };
  const schild = { heute: HEUTE, eintraege: [{ ...s, stand: 'y' }] };
  const render = async (el: unknown) => (await import('react-dom/server')).renderToStaticMarkup(el as never);
  it('Überblick (alle und eine), Zeitstrahl, Matrix, Lebenslauf, Kanzlei, Assistent', async () => {
    const { createElement: h } = await import('react');
    const { BlickUeberblick } = await import('@/components/os/unternehmen/blick/Blick');
    const { Assistent } = await import('@/components/os/unternehmen/blick/Assistent');
    const alle = await render(h(BlickUeberblick, { lage, schild, daten, heute: HEUTE }));
    expect(alle).toContain('Das Schild in einem Blick');
    expect(alle).toContain('Das Wichtigste jetzt');
    expect(alle).toContain('Was sehe ich?');
    const eine = await render(h(BlickUeberblick, { lage, schild, daten, gewaehlt: 'ug', heute: HEUTE }));
    for (const t of ['Vollständigkeit der Firmen-Akte', 'Bereit für Kanzlei und Steuerbüro', 'Risiko-Matrix', 'Lebenslauf der Gesellschaft']) expect(eine).toContain(t);
    const a = await render(h(Assistent, { lage, daten, schild, gewaehlt: 'ug', situation: 'firma', heute: HEUTE, waehle: () => {}, ersetzenRegister: () => {}, ersetzenSchild: () => {}, schliessen: () => {} }));
    expect(a).toContain('Was ist passiert?');
    expect(a).toContain('Handelsregister');
    expect(a).toMatch(/keine Rechtsberatung/);
  });
});

// Hilfe für die Typen der Testdaten (unbenutzte Importe vermeiden).
void ([] as Handgriff[]);
