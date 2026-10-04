// ─── Finanzplanung jetzt — Handwerte: jede gerechnete Zahl ist überschreibbar (04.10.) ──────────────
// Kevin 04.10.: „Jede Zahl. Nur die Formeln sind im Hintergrund immer hart gecodet.“ Ein Handwert steht im Plan unter
// `<kennung>:<monat>` (lib/finanzen/handwerte.ts); der Kern nimmt ihn statt des Formelwerts, alles Nachgelagerte rechnet weiter.
// Erfundene Zahlen (tests/fixtures/finanz-plan.ts) — nie echte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneSelbst, toepfeUG, zielStaende } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung } from '../lib/finanzen/szenarien';
import { geschaeftsblatt } from '../lib/finanzen/geschaeft';
import { wendeOperationenAn, pruefeDokument, lies, pfadTeile, OperationUngueltig, OperationZuGross, type Operation } from '../lib/finanzen/plan/operationen';
import { HAND_FELDER, GRENZE_PLAN_ZELLEN, abweichung, handwerteImPlan, istHandFeld } from '../lib/finanzen/handwerte';
import { RECHENZEILEN, zeileName } from '../lib/finanzen/plan/hilfen';
import { planFix, arbeitsplanFix, arbeitsplanSelbst } from './fixtures/finanz-plan';

const JETZT = '2026-10-04T10:00:00.000Z';
const mit = (d: FinanzDaten, plan: Record<string, number>): FinanzDaten => ({ ...d, plan: { ...d.plan, ...plan } });
const an = (d: FinanzDaten, ops: Operation[]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;
const zahlen = (g: ReturnType<typeof rechneMit>) => JSON.stringify({ ug: g.ug, kdc: g.kdc, pr: g.pr, kz: g.kz, gruppe: g.gruppe });
/** Die Gegenoperation wie im Browser (components/os/finanzplan/daten.ts › gegenOperation): alter Wert zurück oder entfernen. */
const gegen = (d: FinanzDaten, op: Operation): Operation => { const alt = lies(d, pfadTeile(op.pfad)); return alt === undefined ? { pfad: op.pfad } : { pfad: op.pfad, neu: alt }; };

describe('(a) ohne Handwerte rechnet der Kern wie vorher', () => {
  it('ein Handwert gleich dem Formelwert ändert keine Zahl (bit-genau) — für jede Kennung', () => {
    const d = planFix(14000), ps = arbeitsplanSelbst();
    const vorher = rechneMit(d, ps);
    const v = zahlen(vorher);
    // Für jede gerechnete Größe den eigenen Formelwert als Handwert eintragen (Monat 5) — das Ergebnis darf sich nicht bewegen.
    const monat = 5;
    const formelWerte = rechneMit(mit(d, Object.fromEntries(Object.keys(HAND_FELDER).filter(k => !k.startsWith('ab.')).map(k => [`${k}:${monat}`, 0]))), ps).formel;
    // formelWerte enthält zu jeder Kennung den Formelwert bei Handwert 0 — für den Vergleich nehmen wir je Kennung einzeln den echten Formelwert.
    for (const k of Object.keys(HAND_FELDER).filter(x => !x.startsWith('ab.') && !x.startsWith('ug.reserve') && x !== 'ug.topfFrei')) {
      const mm = k === 'p.malinSelbst' ? 2 : monat;   // gilt nur vor dem Start in der Gesellschaft
      const probe = rechneMit(mit(d, { [`${k}:${mm}`]: 0 }), ps).formel[`${k}:${mm}`];
      expect(probe, `Formelwert für ${k} gesammelt`).toBeTypeOf('number');
      const gleich = rechneMit(mit(d, { [`${k}:${mm}`]: probe }), ps);
      expect(zahlen(gleich), k).toBe(v);
    }
    expect(Object.keys(formelWerte).length).toBeGreaterThan(50);
  });
  it('ohne Handwert: keine Formelwerte außer den alten Zellen-Überschreibungen; unbekannte Schlüssel ändern nichts', () => {
    const d = planFix(14000);
    const g = rechneMit(d, arbeitsplanFix());
    expect(Object.keys(g.formel)).toEqual(['ug.events:9']);   // die Fixture überschreibt eine Rechenzeile (seit 27.09.)
    expect(zahlen(rechneMit(mit(d, { 'zz.unbekannt:3': 999, 'ug.konto:x': 5 }), arbeitsplanFix()))).toBe(zahlen(g));
  });
  it('kein Handwert bei Nicht-Zahlen im Dokument (beschädigt) — dann gilt die Formel', () => {
    const d = planFix(14000);
    const kaputt = { ...d, plan: { ...d.plan, 'ug.konto:4': 'x' as unknown as number } };
    expect(zahlen(rechneMit(kaputt, null))).toBe(zahlen(rechneMit(d, null)));
  });
});

describe('(b) Handwert in einer Kostenzeile wirkt auf Summe, Steuer und Kontostand', () => {
  const d = planFix(14000);
  const vorher = rechneMit(d, null);
  it('Einmalige Kosten +1.000 im Monat 5: Kosten, Ergebnis, Auszahlungen, Konto ab Monat 5, Rücklage und Steuer im Folgejahr', () => {
    const k = vorher.ug[4].einmalig + 1000;
    const g = rechneMit(mit(d, { 'ug.einmalig:5': k }), null);
    expect(g.ug[4].einmalig).toBe(k);
    expect(g.ug[4].kosten - vorher.ug[4].kosten).toBeCloseTo(1000, 9);
    expect(g.ug[4].gewinn - vorher.ug[4].gewinn).toBeCloseTo(-1000, 9);
    expect(g.ug[4].auszahlungen - vorher.ug[4].auszahlungen).toBeCloseTo(1000, 9);
    for (let i = 4; i < 8; i++) expect(g.ug[i].konto - vorher.ug[i].konto, `Konto Monat ${i + 1}`).toBeCloseTo(-1000, 9);
    expect(g.ug[4].steuerRuecklage).toBeLessThan(vorher.ug[4].steuerRuecklage);
    // Zahlung der Steuer 2027 im Juni 2028 (Plan-Monat 21) sinkt; danach steht das Konto um 1.000 minus gesparte Steuer tiefer.
    expect(g.ug[20].steuer).toBeLessThan(vorher.ug[20].steuer);
    const gespart = vorher.ug[20].steuer - g.ug[20].steuer;
    expect(g.ug[22].konto - vorher.ug[22].konto).toBeCloseTo(-1000 + gespart, 6);
    // Kennzahlen und Mindestumsatz ziehen mit
    expect(g.kz.kontoDez28).toBeCloseTo(vorher.kz.kontoDez28 - 1000 + gespart, 6);
    expect(g.formel['ug.einmalig:5']).toBe(vorher.ug[4].einmalig);
  });
  it('Planzeile (Sachkosten) von Hand wirkt wie bisher — Formel ist ihr Sollwert', () => {
    const g = rechneMit(mit(d, { 'sk1:6': 750 }), null);
    expect(g.ug[5].sach - vorher.ug[5].sach).toBeCloseTo(500, 9);
    expect(g.ug[5].kosten - vorher.ug[5].kosten).toBeCloseTo(500, 9);
  });
  it('Summe „Kosten gesamt“ von Hand wirkt auf Ergebnis und Auszahlungen; laufende Kosten (Mindestumsatz) wirken bis in die Töpfe', () => {
    const g = rechneMit(mit(d, { 'ug.kosten:7': vorher.ug[6].kosten + 300, 'ug.laufend:8': vorher.ug[7].laufend + 200 }), null);
    expect(g.ug[6].gewinn - vorher.ug[6].gewinn).toBeCloseTo(-300, 9);
    expect(g.ug[6].auszahlungen - vorher.ug[6].auszahlungen).toBeCloseTo(300, 9);
    expect(g.ug[7].kosten - vorher.ug[7].kosten).toBeCloseTo(200, 9);
    const t0 = toepfeUG(vorher.ug, 2), t1 = toepfeUG(g.ug, 2);
    expect(t1[7].reserveZiel - t0[7].reserveZiel).toBeCloseTo(400, 9);
    const aw0 = auswertung(d, vorher.ug, vorher.pr, vorher.kdc), aw1 = auswertung(d, g.ug, g.pr, g.kdc);
    expect(aw1.mindestumsatz.schnitt12).toBeGreaterThan(aw0.mindestumsatz.schnitt12);
  });
});

describe('(c) Handwert auf einer Steuerzeile ersetzt die gerechnete Steuer', () => {
  const d = planFix(14000);
  const vorher = rechneMit(d, null);
  it('Ertragsteuer-Zahlung im Juni 27 (Monat 9) von Hand: Auszahlungen und Konto ab da, Rücklage', () => {
    expect(vorher.ug[8].steuer).toBeGreaterThan(0);
    const hand = vorher.ug[8].steuer + 2500;
    const g = rechneMit(mit(d, { 'ug.steuer:9': hand }), null);
    expect(g.ug[8].steuer).toBe(hand);
    expect(g.ug[8].auszahlungen - vorher.ug[8].auszahlungen).toBeCloseTo(2500, 9);
    for (let i = 8; i < 14; i++) expect(g.ug[i].konto - vorher.ug[i].konto).toBeCloseTo(-2500, 9);
    // Zu viel gezahlt → die Rücklage sinkt um denselben Betrag (nie unter null).
    expect(g.ug[8].steuerRuecklage).toBeCloseTo(Math.max(0, vorher.ug[8].steuerRuecklage - 2500), 9);
    expect(g.formel['ug.steuer:9']).toBeCloseTo(vorher.ug[8].steuer, 9);
  });
  it('Körperschaftsteuer-Aufwand von Hand: Ergebnis nach Steuern, Rücklage und die Zahlung im Folgejahr', () => {
    const hand = vorher.ug[4].st.kst + 1000;
    const g = rechneMit(mit(d, { 'ug.kst:5': hand }), null);
    expect(g.ug[4].st.kst).toBe(hand);
    expect(g.ug[4].st.summe - vorher.ug[4].st.summe).toBeCloseTo(1000, 9);
    expect(g.ug[4].ergebnisNach - vorher.ug[4].ergebnisNach).toBeCloseTo(-1000, 9);
    expect(g.ug[4].steuerRuecklage - vorher.ug[4].steuerRuecklage).toBeCloseTo(1000, 9);
    expect(g.ug[20].steuer - vorher.ug[20].steuer).toBeCloseTo(1000, 9);   // Steuer 2027 wird im Juni 2028 gezahlt
    expect(g.ug[21].konto - vorher.ug[21].konto).toBeCloseTo(-1000, 6);
    const b = geschaeftsblatt(d, 'ug', g, null, 1);
    expect(b.ergebnisNachSteuern[4]).toBe(g.ug[4].ergebnisNach);
  });
  it('Verlustvortrag von Hand mindert die Steuer des laufenden Jahres', () => {
    const g = rechneMit(mit(d, { 'ug.verlustvortrag:4': 50000 }), null);
    expect(g.ug[3].st.verlustvortrag).toBe(50000);
    expect(g.ug[14].steuerRuecklage).toBeLessThan(vorher.ug[14].steuerRuecklage);
  });
  it('Selbstständigkeit: Einkommensteuer von Hand wirkt auf Ergebnis nach Steuern und damit auf den Entnahme-Anteil nach Privat', () => {
    const ps = { ...arbeitsplanSelbst(), annahmen: { ...arbeitsplanSelbst().annahmen, entnahme: { anteil: 0.5, ab: 1 } } };
    const v = rechneMit(d, ps);
    const g = rechneMit(mit(d, { 'kdc.est:3': v.kdc[2].st.est + 400 }), ps);
    expect(g.kdc[2].ergebnisNach - v.kdc[2].ergebnisNach).toBeCloseTo(-400, 9);
    expect(g.kdc[2].entnahme - v.kdc[2].entnahme).toBeCloseTo(-200, 9);
    expect(g.pr[2].entnahme - v.pr[2].entnahme).toBeCloseTo(-200, 9);
  });
});

describe('(d) zurücksetzen = Formel, Rückgängig über die Gegenoperation', () => {
  it('setzen, dann entfernen → exakt die Zahlen vorher; Rückgängig (Gegenoperation) ebenso', () => {
    const d = planFix(14000);
    const v = zahlen(rechneMit(d, arbeitsplanFix()));
    const op: Operation = { pfad: '/plan/ug.konto:6', neu: 12345 };
    const g = gegen(d, op);
    const gesetzt = an(d, [op]);
    expect(rechneMit(gesetzt, arbeitsplanFix()).ug[5].konto).toBe(12345);
    expect(gesetzt.meta['ug.konto:6']).toEqual({ wer: 'kevin', wann: JETZT });
    expect(zahlen(rechneMit(an(gesetzt, [{ pfad: '/plan/ug.konto:6' }]), arbeitsplanFix()))).toBe(v);
    const zurueck = an(gesetzt, [g]);
    expect(zurueck.plan['ug.konto:6']).toBeUndefined();
    expect(zurueck.meta['ug.konto:6']).toBeUndefined();
    expect(zahlen(rechneMit(zurueck, arbeitsplanFix()))).toBe(v);
  });
  it('Kontostand von Hand: Folgemonate rechnen vom Handwert weiter', () => {
    const d = planFix(14000);
    const v = rechneMit(d, null), g = rechneMit(mit(d, { 'ug.konto:6': v.ug[5].konto + 5000 }), null);
    for (let i = 5; i < 12; i++) expect(g.ug[i].konto - v.ug[i].konto).toBeCloseTo(5000, 9);
    expect(g.ug[5].frei - v.ug[5].frei).toBeCloseTo(5000, 9);
  });
  it('Angespart von Hand: Privat spart von dort weiter; Ziele und Gruppe ziehen mit', () => {
    const d = { ...planFix(14000), ziele: [{ id: 'z1', name: 'R', quelle: 'privat.angespart' as const, ziel: 40000, bis: '2027-12', einheit: 'privat' as const }, { id: 'z4', name: 'G', quelle: 'gruppe' as const, ziel: 30000, bis: '2028-12', einheit: 'privat' as const }] };
    const v = rechneMit(d, null), g = rechneMit(mit(d, { 'p.angespart:4': v.pr[3].angespart + 7000 }), null);
    for (let i = 3; i < 27; i++) expect(g.pr[i].angespart - v.pr[i].angespart).toBeCloseTo(7000, 9);
    expect(g.kz.gruppeDez28 - v.kz.gruppeDez28).toBeCloseTo(7000, 9);
    const z0 = zielStaende(d, v.ug, v.pr, v.kdc), z1 = zielStaende(d, g.ug, g.pr, g.kdc);
    expect(z1[0].verlauf[10] - z0[0].verlauf[10]).toBeCloseTo(7000, 9);
    expect(z1[1].verlauf[10] - z0[1].verlauf[10]).toBeCloseTo(7000, 9);
  });
});

describe('(e) Summe von Hand: gilt, und die Abweichung zur Summe der Einzelzeilen ist sichtbar', () => {
  it('Umsatz Monat 3 von Hand: Ergebnis rechnet damit, Formel = Summe der Einzelzeilen', () => {
    const d = planFix(14000);
    const v = rechneMit(d, arbeitsplanFix());
    const plan = { ...d.plan, 'ug.umsatz:3': 50000 };
    const g = rechneMit({ ...d, plan }, arbeitsplanFix());
    const u = v.ug[2];
    expect(g.formel['ug.umsatz:3']).toBeCloseTo(u.ob + u.retainer + u.astarna + u.events + u.bausteineUmsatz, 9);
    expect(abweichung(plan, g.formel, 'ug.umsatz:3')).toBeCloseTo(50000 - u.umsatz, 9);
    expect(g.ug[2].gewinn - v.ug[2].gewinn).toBeCloseTo(50000 - u.umsatz, 9);
    expect(g.ug[2].einzahlungen).toBe(v.ug[2].einzahlungen);   // der Zahlungseingang hat seine eigene Zeile
    expect(abweichung(plan, g.formel, 'ug.umsatz:4')).toBeNull();
  });
  it('KD Ventures: Einnahmen von Hand gehen in Ergebnis, Ertragsteuer und Konto', () => {
    const d = planFix(14000);
    const v = rechneMit(d, arbeitsplanFix());
    const g = rechneMit(mit(d, { 'kdv.einnahmen:4': v.ug[3].kdvEinnahmen + 10000 }), arbeitsplanFix());
    expect(g.ug[3].kdvErgebnis - v.ug[3].kdvErgebnis).toBeCloseTo(10000, 9);
    expect(g.ug[3].kdvGewinn - v.ug[3].kdvGewinn).toBeCloseTo(10000, 9);
    expect(g.ug[3].kdvKonto - v.ug[3].kdvKonto).toBeCloseTo(10000, 9);
    expect(g.ug[3].kdvSt.ruecklage).toBeGreaterThan(v.ug[3].kdvSt.ruecklage);
  });
  it('Abschluss der Selbstständigkeit (ohne Monat, Monat 0): Einkommensteuer von Hand wirkt auf frei', () => {
    const d = planFix(14000);
    const v = rechneSelbst(d), f: Record<string, number> = {};
    const g = rechneSelbst(mit(d, { 'ab.est:0': v.est + 900 }), f);
    expect(g.est).toBe(v.est + 900);
    expect(g.frei - v.frei).toBeCloseTo(-900, 9);
    expect(f['ab.est:0']).toBe(v.est);
  });
});

describe('(f) Operationen: Prüfung, Grenzen, 409', () => {
  const d = planFix(14000);
  it('Handwert braucht eine Zahl und einen gültigen Monat; Entfernen geht immer', () => {
    expect(() => an(d, [{ pfad: '/plan/ug.konto:5', neu: 'viel' }])).toThrow(OperationUngueltig);
    expect(() => an(d, [{ pfad: '/plan/ug.konto', neu: 5 }])).toThrow(/Planzelle unbrauchbar/);
    expect(() => an(d, [{ pfad: '/plan/ug.konto:99', neu: 5 }])).toThrow(/Planzelle unbrauchbar/);
    expect(() => an(d, [{ pfad: '/plan/ug.konto:5', neu: Infinity }])).toThrow(OperationUngueltig);
    expect(an(d, [{ pfad: '/plan/ab.est:0', neu: 5 }]).plan['ab.est:0']).toBe(5);
    expect(an({ ...d, plan: { ...d.plan, 'alt ohne Monat': 3 } }, [{ pfad: '/plan/alt ohne Monat' }]).plan['alt ohne Monat']).toBeUndefined();
  });
  it('über die Zellen-Grenze: Ablehnung (413-Fehler), nie kürzen — Verkleinern bleibt erlaubt', () => {
    const voll: Record<string, number> = {};
    for (let i = 0; i < GRENZE_PLAN_ZELLEN; i++) voll[`z${i}:1`] = 1;
    const v = { ...d, plan: voll };
    expect(() => an(v, [{ pfad: '/plan/ug.konto:5', neu: 1 }])).toThrow(OperationZuGross);
    expect(Object.keys(an(v, [{ pfad: '/plan/z1:1' }]).plan).length).toBe(GRENZE_PLAN_ZELLEN - 1);
    expect(Object.keys(an(v, [{ pfad: '/plan/z1:1', neu: 9 }]).plan).length).toBe(GRENZE_PLAN_ZELLEN);
  });
  it('Protokoll nennt den Handwert', () => {
    const r = wendeOperationenAn(d, [{ pfad: '/plan/ug.steuer:9', neu: 777, feld: 'Ertragsteuer-Zahlung · Jun 27' }], 'malin', JETZT);
    expect(r.protokoll[0]).toMatchObject({ wer: 'malin', feld: 'Ertragsteuer-Zahlung · Jun 27', neu: '777' });
  });
});

describe('(f) Schreibweg mit Sperre: 409 bei fremdem Stand, 413 über der Grenze', () => {
  const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-hand-'));
  let speicher: typeof import('../lib/finanzen/plan/speicher');
  beforeAll(async () => {
    process.env.MAKE_OS_DATEN_DIR = ordner;
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    speicher = await import('../lib/finanzen/plan/speicher');
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  it('Handwert schreiben, fremder Stand → 409 mit Dokument, Grenze → 413', async () => {
    const d = planFix(14000);
    const imp = await speicher.importieren('test-hand', d, false, 'kevin', 'Test');
    expect(imp.ok).toBe(true);
    const stand = (imp as { stand: string }).stand;
    const e = await speicher.patchen('test-hand', stand, [{ pfad: '/plan/ug.frei:4', neu: 1000 }], 'kevin');
    expect(e.ok).toBe(true);
    const alt = await speicher.patchen('test-hand', stand, [{ pfad: '/plan/ug.frei:5', neu: 1 }], 'malin');
    expect(alt).toMatchObject({ ok: false, status: 409 });
    expect((alt as { dokument: FinanzDaten }).dokument.plan['ug.frei:4']).toBe(1000);
    const geladen = await speicher.ladeFinanzplan('test-hand');
    expect(rechneMit(geladen!, null).ug[3].frei).toBe(1000);
    const ops = Array.from({ length: 2 }, (_, i) => ({ pfad: `/plan/ug.konto:${i + 1}`, neu: i }));
    const groß = await speicher.importieren('test-hand', { ...d, plan: Object.fromEntries(Array.from({ length: GRENZE_PLAN_ZELLEN }, (_, i) => [`z${i}:1`, 1])) }, true, 'kevin', 'Test');
    const z = await speicher.patchen('test-hand', (groß as { stand: string }).stand, ops, 'kevin');
    expect(z).toMatchObject({ ok: false, status: 413 });
  }, 30_000);   // 20.000 Zellen schreiben und lesen — unter Last langsam
});

describe('(g) alte Dokumente und der Rückweg', () => {
  it('ein Dokument ohne Handwerte läuft unverändert durch die Prüfung', () => {
    const d = planFix(14000);
    const p = pruefeDokument(JSON.parse(JSON.stringify(d)));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.dokument.plan).toEqual(d.plan);
  });
  it('Handwerte bleiben beim Lesen erhalten (die Prüfung lässt den Plan, wie er ist)', () => {
    const d = mit(planFix(14000), { 'ug.konto:4': 1, 'kdc.est:3': 2, 'ab.est:0': 3 });
    const p = pruefeDokument(JSON.parse(JSON.stringify(d)));
    expect(p.ok && p.dokument.plan).toEqual(d.plan);
    expect(handwerteImPlan(d.plan).sort()).toEqual(['ab.est:0', 'kdc.est:3', 'ug.events:9', 'ug.konto:4']);
  });
});

describe('Kennungen der Handwerte', () => {
  it('kollidieren nie mit Planzeilen-Kennungen (ug.s., p.b., p.e., p.d.) und haben einen Namen', () => {
    for (const [k, f] of Object.entries(HAND_FELDER)) {
      expect(/^(ug\.s\.|p\.b\.|p\.e\.|p\.d\.)/.test(k), k).toBe(false);
      expect(k.includes(':') || /\s/.test(k), k).toBe(false);
      expect(f.name.length, k).toBeGreaterThan(1);
      expect(RECHENZEILEN[k]).toBe(f.name);
    }
    expect(istHandFeld('ug.konto')).toBe(true); expect(istHandFeld('sk1')).toBe(false);
    expect(zeileName(planFix(), 'ug.steuerRuecklage')).toBe('Steuerrücklage');
  });
  it('keine festen Personennamen in den Kennungs-Namen (Plattform-Regel)', () => {
    for (const f of Object.values(HAND_FELDER)) expect(/kevin|malin/i.test(f.name), f.name).toBe(false);
  });
});
