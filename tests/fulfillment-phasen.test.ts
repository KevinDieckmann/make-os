// ─── Fulfillment — Phasen: EINE Regel für Reihenfolge und Zuordnung (12.10.; lib/fulfillment/prozesse/phasen.ts) ─────────────────────
// Gefunden in der Demo: Paket-Vorlagen endeten mit „… Übergabe → Analyse → Strategie → Umsetzung → Steuerung → Onboarding“, der Fall
// „Vertriebsleitung auf Zeit“ mit den Phasen „Strategie“ und „Steuerung“ hinter der Übergabe. Geprüft wird:
//   · Import einer Datei, deren Bausteine Phasen in falscher Reihenfolge bringen → kanonische Reihenfolge, Dach-Themen in Diagnose/Führung
//   · Altbestand (hinten angehängte Phasen) wird beim Lesen geordnet, hohle Dach-Phasen zusammengelegt — nichts geht verloren
//   · von Hand geordnete Phasen bleiben; der Fall nimmt dieselbe Regel
// Erfundene Daten, kein Netz, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen, vorlagenAus, faelleAus } from '@/lib/fulfillment/lesen';
import { MUSTER_P1, MUSTER_P2, MUSTER_P3 } from '@/lib/fulfillment/muster';
import { vorlagenAnwenden, type VorlagenKontext } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { importAnwenden } from '@/lib/fulfillment/prozesse/import';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { phaseVon, phasenOrdnen, phasenRang, hohlerVorlagenKnoten } from '@/lib/fulfillment/prozesse/phasen';
import { kinderVon, wurzelVon, fallFortschritt } from '@/lib/fulfillment/regeln';
import type { ProzessKnoten, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const JETZT = '2026-10-12T09:00:00.000Z';
const HEUTE = '2026-10-12';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const zaehler = () => (p: string) => `${p}-t${++N}`;
const vk = (x: Partial<VorlagenKontext> = {}): VorlagenKontext => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: stand, neueId: zaehler(), ...x });
function ok<D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D {
  if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
  return r.datei;
}
const mitMuster = () => ok(vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], vk()));
const paket = (d: VorlagenDatei, titel: string) => d.prozesse.find(p => p.art === 'paket' && p.titel === titel)!;
const phasen = (knoten: readonly { id: string; elternId?: string; titel: string; rang: number }[]) => kinderVon(wurzelVon(knoten)!.id, knoten).map(k => k.titel);
const ik = (laufId: string) => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, datei: 'phasen.json', laufId });
const kid = () => `fk-i${++N}`;

/** Eine Bausteine-Datei, deren Phasen in falscher Reihenfolge kommen (Übergabe zuerst, Onboarding zuletzt) — mit Dach-Themen. */
const b = (id: string, phase: string, pakete: string[]) => ({ id, art: 'aufgabe', titel: `Schritt ${id}`, zweck: 'Erfunden.', phase, pakete });
const DATEI = {
  vorlagen: [
    b('p-uebergabe', 'uebergabe', ['p1', 'p2', 'p3']),
    b('p-steuerung', 'steuerung', ['p1', 'p2', 'p3']),
    b('p-umsetzung', 'umsetzung', ['p1', 'p2', 'p3']),
    b('p-strategie', 'strategie', ['p1', 'p2', 'p3']),
    b('p-analyse', 'analyse', ['p1', 'p2']),
    b('p-onboarding', 'onboarding', ['p1', 'p2', 'p3']),
  ],
};
function mitImport(): VorlagenDatei {
  const d = mitMuster();
  const wahl = { pakete: { p1: paket(d, MUSTER_P1.titel).id, p2: paket(d, MUSTER_P2.titel).id, p3: paket(d, MUSTER_P3.titel).id } };
  return ok(importAnwenden(d, DATEI, wahl, ik('fi-phasen'), kid));
}

describe('Regel: welche Phase, welcher Rang', () => {
  it('erkennt kanonische Phasen am Wort, ordnet Dach-Themen zu, eigene Phasen sind Kern-Arbeit', () => {
    expect(phaseVon('Vorlauf / Onboarding')).toEqual({ id: 'vorlauf', dach: false });
    expect(phaseVon('onboarding')).toEqual({ id: 'vorlauf', dach: false });
    expect(phaseVon('Follow-up / Übergabe')).toEqual({ id: 'uebergabe', dach: false });
    expect(phaseVon('Recruiting (nur Prozess)')).toEqual({ id: 'recruiting', dach: false });
    expect(phaseVon('Strategie')).toEqual({ id: 'diagnose', dach: true });
    expect(phaseVon('steuerung')).toEqual({ id: 'fuehrung', dach: true });
    expect(phaseVon('Umsetzung & Steuerung')).toEqual({ id: 'umsetzung', dach: false });
    // Wortgenau: „Kennzahlen-Board“ und „Führungskräfte-Entwicklung“ sind eigene Phasen, keine kanonischen.
    expect(phaseVon('Kennzahlen-Board')).toBeNull();
    expect(phaseVon('Führungskräfte-Entwicklung')).toBeNull();
    expect(phasenRang('Analyse')).toBeLessThan(phasenRang('Skripte & Workbooks'));
    expect(phasenRang('Skripte & Workbooks')).toBeLessThan(phasenRang('Umsetzung'));
    expect(phasenRang('Weitere Bausteine')).toBeGreaterThan(phasenRang('Follow-up / Übergabe'));
  });
});

describe('Import: Phasen aus Bausteinen kommen an IHRE Stelle, Dach-Themen in die passende Phase', () => {
  const d = mitImport();
  it('Vertriebsleitung auf Zeit: genau die acht Phasen des Musters — keine „Strategie“, keine „Steuerung“', () => {
    const p1 = paket(d, MUSTER_P1.titel);
    expect(phasen(p1.knoten)).toEqual(['Vorlauf / Onboarding', 'Analyse', 'Diagnose', 'Aufbau', 'Recruiting', 'Umsetzung', 'Führung', 'Follow-up / Übergabe']);
    // Strategie-Baustein hängt unter Diagnose, Steuerung unter Führung.
    const unter = (bausteinId: string) => { const nach = new Map(p1.knoten.map(k => [k.id, k])); let x = p1.knoten.find(k => k.bausteinId === bausteinId); while (x?.elternId && nach.get(x.elternId)?.elternId) x = nach.get(x.elternId); return x?.titel; };
    expect(unter('fb-imp-p-strategie')).toBe('Diagnose');
    expect(unter('fb-imp-p-steuerung')).toBe('Führung');
    expect(unter('fb-imp-p-onboarding')).toBe('Vorlauf / Onboarding');
  });
  it('Sales-Systematik: Onboarding vorn, Analyse und Diagnose vor den eigenen Phasen, Umsetzung/Führung danach, Übergabe am Ende', () => {
    expect(phasen(paket(d, MUSTER_P2.titel).knoten)).toEqual([
      'Vorlauf / Onboarding', 'Analyse', 'Diagnose', 'Einführung', 'Skripte & Workbooks', 'Kennzahlen-Board', 'CRM-Workflow', 'Training & Abnahme', 'Umsetzung', 'Führung', 'Übergabe',
    ]);
  });
  it('Netzwerk-Vertrieb: Onboarding nie an Stelle 8', () => {
    const t = phasen(paket(d, MUSTER_P3.titel).knoten);
    expect(t[0]).toBe('Vorlauf / Onboarding');
    expect(t[t.length - 1]).toBe('Follow-up / Übergabe');
    expect(t).toEqual(['Vorlauf / Onboarding', 'Diagnose', 'Partner- und Empfehlungsprogramm', 'Messen & Events', 'Netzwerk-Rhythmus', 'Messung', 'Umsetzung', 'Führung', 'Follow-up / Übergabe']);
  });
  it('Ränge lückenlos 1…n; ein zweiter Import ändert nichts', () => {
    for (const p of d.prozesse.filter(x => x.art === 'paket')) expect(kinderVon(wurzelVon(p.knoten)!.id, p.knoten).map(k => k.rang)).toEqual(phasen(p.knoten).map((_, i) => i + 1));
    const p1 = paket(d, MUSTER_P1.titel);
    const wahl = { pakete: { p1: p1.id, p2: paket(d, MUSTER_P2.titel).id, p3: paket(d, MUSTER_P3.titel).id } };
    const d2 = ok(importAnwenden(d, DATEI, wahl, ik('fi-phasen-2'), kid));
    expect(d2.prozesse).toEqual(d.prozesse);
  });
  it('der Fall aus der Vorlage hat dieselben Phasen — keine Dach-Phase hinter der Übergabe', () => {
    const f = fallStarten({ mandatId: 'm-probe', vorlage: paket(d, MUSTER_P1.titel), person: 'pia', jetzt: JETZT, start: HEUTE, neueId: zaehler() });
    expect(phasen(f.knoten)).toEqual(['Vorlauf / Onboarding', 'Analyse', 'Diagnose', 'Aufbau', 'Recruiting', 'Umsetzung', 'Führung', 'Follow-up / Übergabe']);
  });
});

// ── Altbestand: so legte der Import vor dem 12.10. an (Phasen hinten angehängt) ─────────────────────────────────────────────────────

/** Eine Paket-Vorlage wie im Altbestand: Muster-Phasen, dahinter angehängt Strategie/Steuerung/Onboarding — je mit Schritt und Baustein. */
function altP1(): Record<string, unknown> {
  const v = JSON.parse(JSON.stringify(MUSTER_P1)) as ProzessVorlage;
  const w = v.knoten.find(k => !k.elternId)!;
  const n = kinderVon(w.id, v.knoten).length;
  const kette = (phase: string, titel: string, rang: number): ProzessKnoten[] => [
    { id: `alt-${phase}`, elternId: w.id, titel, rang },
    { id: `alt-${phase}-u`, elternId: `alt-${phase}`, titel: 'Weitere Bausteine', rang: 1 },
    { id: `alt-${phase}-s`, elternId: `alt-${phase}-u`, titel: `Schritt ${phase}`, rang: 1 },
    { id: `alt-${phase}-b`, elternId: `alt-${phase}-s`, titel: `Schritt ${phase}`, rang: 1, bausteinId: `fb-${phase}` },
  ];
  v.knoten = [...v.knoten, ...kette('strategie', 'Strategie', n + 1), ...kette('steuerung', 'Steuerung', n + 2)];
  return { version: 1, prozesse: [{ ...v, id: 'fp-alt-p1', herkunft: { art: 'hand', am: JETZT } }], bausteine: [], rituale: [] };
}

describe('Altbestand: beim Lesen geordnet, hohle Dach-Phasen zusammengelegt — nichts geht verloren', () => {
  it('Vorlage: „Strategie“ → Diagnose, „Steuerung“ → Führung; alle Schritte und Bausteine bleiben', () => {
    const roh = altP1();
    const v = vorlagenAus(roh).prozesse[0];
    expect(phasen(v.knoten)).toEqual(['Vorlauf / Onboarding', 'Analyse', 'Diagnose', 'Aufbau', 'Recruiting', 'Umsetzung', 'Führung', 'Follow-up / Übergabe']);
    expect(v.knoten.find(k => k.bausteinId === 'fb-strategie')).toBeTruthy();
    expect(v.knoten.find(k => k.id === 'alt-strategie-u')!.elternId).toBe(v.knoten.find(k => k.titel === 'Diagnose')!.id);
    expect(v.knoten.find(k => k.id === 'alt-steuerung-u')!.elternId).toBe(v.knoten.find(k => k.titel === 'Führung')!.id);
    // Idempotent: noch einmal säubern ändert nichts (der Stand bleibt stabil).
    expect(vorlagenAus(JSON.parse(JSON.stringify(vorlagenAus(roh)))).prozesse[0]).toEqual(v);
  });
  it('eine Dach-Phase mit eigenen Angaben bleibt als Phase — nur an ihre Stelle sortiert', () => {
    const roh = altP1() as { prozesse: { knoten: ProzessKnoten[] }[] };
    roh.prozesse[0].knoten = roh.prozesse[0].knoten.map(k => (k.id === 'alt-strategie' ? { ...k, ziel: 'Eigenes Ziel' } : k));
    const v = vorlagenAus(roh).prozesse[0];
    const t = phasen(v.knoten);
    expect(t.indexOf('Strategie')).toBe(t.indexOf('Diagnose') + 1);
    expect(t[t.length - 1]).toBe('Follow-up / Übergabe');
  });
  it('Sales-Systematik im Altbestand: angehängte Phasen kommen nach vorn bzw. vor die Übergabe', () => {
    const v = JSON.parse(JSON.stringify(MUSTER_P2)) as ProzessVorlage;
    const w = v.knoten.find(k => !k.elternId)!;
    const n = kinderVon(w.id, v.knoten).length;
    ['Analyse', 'Strategie', 'Umsetzung', 'Steuerung', 'Onboarding'].forEach((titel, i) => v.knoten.push({ id: `alt-${i}`, elternId: w.id, titel, rang: n + i + 1 }));
    const g = vorlagenAus({ prozesse: [v] }).prozesse[0];
    expect(phasen(g.knoten)).toEqual(['Onboarding', 'Analyse', 'Strategie', 'Einführung', 'Skripte & Workbooks', 'Kennzahlen-Board', 'CRM-Workflow', 'Training & Abnahme', 'Umsetzung', 'Steuerung', 'Übergabe']);
  });
  it('schon geordnet → dieselbe Liste (kein Schreiben aus dem Lesen)', () => {
    const k = MUSTER_P1.knoten;
    expect(phasenOrdnen(k, { hohl: hohlerVorlagenKnoten })).toBe(k);
  });
  it('Fall: hohle Dach-Phasen zusammengelegt, Blätter und Fortschritt bleiben; angefasste bleiben als Phase', () => {
    const v = vorlagenAus(altP1()).prozesse[0];
    // Ein Fall aus dem ALTEN Stand der Vorlage (Phasen 9/10 = Strategie/Steuerung): direkt aus den Rohdaten gestartet.
    const vAlt = { ...v, knoten: (altP1() as { prozesse: ProzessVorlage[] }).prozesse[0].knoten };
    const f = fallStarten({ mandatId: 'm-alt', vorlage: vAlt, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: zaehler() });
    expect(phasen(f.knoten)).toContain('Strategie');
    const blaetter = (l: { id: string; elternId?: string }[]) => l.filter(x => !l.some(y => y.elternId === x.id)).map(x => x.id).sort();
    const g = faelleAus({ faelle: { 'm-alt': f } }).faelle['m-alt'];
    expect(phasen(g.knoten)).not.toContain('Strategie');
    expect(phasen(g.knoten)).not.toContain('Steuerung');
    expect(phasen(g.knoten)[phasen(g.knoten).length - 1]).toBe('Follow-up / Übergabe');
    // Die Blätter der Dach-Phasen leben unter Diagnose bzw. Führung weiter (Führung war vorher selbst ein Blatt).
    expect(blaetter(g.knoten)).toEqual(blaetter(f.knoten).filter(id => id !== f.knoten.find(k => k.titel === 'Führung')!.id));
    expect(fallFortschritt(g)).toBe(0);
    // Eine schon angefasste Dach-Phase (Status ≠ offen) bleibt als Phase — an ihrer Stelle hinter Diagnose.
    const f2 = { ...f, knoten: f.knoten.map(k => (k.id === 'alt-strategie' ? { ...k, status: 'in_arbeit' as const } : k)) };
    const t = phasen(faelleAus({ faelle: { 'm-alt': f2 } }).faelle['m-alt'].knoten);
    expect(t.indexOf('Strategie')).toBe(t.indexOf('Diagnose') + 1);
  });
});

describe('Von Hand geordnet: die Reihenfolge gehört der Hand', () => {
  it('Phase hoch/runter setzt die Marke — danach ordnet der Säuberer nicht mehr um; der Fall übernimmt die Marke', () => {
    const d = mitMuster();
    const p1 = paket(d, MUSTER_P1.titel);
    const fuehrung = p1.knoten.find(k => k.titel === 'Führung')!;
    const d2 = ok(vorlagenAnwenden(d, [{ op: 'knoten-rang', vorlageId: p1.id, id: fuehrung.id, richtung: 'hoch' }], vk()));
    const v2 = paket(d2, MUSTER_P1.titel);
    expect(v2.phasenVonHand).toBe(true);
    const t = phasen(v2.knoten);
    expect(t.indexOf('Führung')).toBe(t.indexOf('Umsetzung') - 1);
    const gelesen = paket(vorlagenAus(JSON.parse(JSON.stringify(d2))), MUSTER_P1.titel);
    expect(phasen(gelesen.knoten)).toEqual(t);
    const f = fallStarten({ mandatId: 'm-hand', vorlage: gelesen, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: zaehler() });
    expect(f.phasenVonHand).toBe(true);
    expect(phasen(faelleAus({ faelle: { 'm-hand': f } }).faelle['m-hand'].knoten)).toEqual(phasen(f.knoten));
  });
  it('ein Schritt unterhalb einer Phase umgestellt → keine Marke', () => {
    const d = mitMuster();
    const p1 = paket(d, MUSTER_P1.titel);
    const dossier = p1.knoten.find(k => k.titel === 'Dossier')!;
    const d2 = ok(vorlagenAnwenden(d, [{ op: 'knoten-rang', vorlageId: p1.id, id: dossier.id, richtung: 'hoch' }], vk()));
    expect(paket(d2, MUSTER_P1.titel).phasenVonHand).toBeUndefined();
  });
});
