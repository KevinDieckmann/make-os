// ─── Fulfillment — Import: Bausteine ohne Unterphase unter EINEM Sammel-Schritt (13.10.; lib/fulfillment/prozesse/import.ts › einsortieren) ───
// Befund: Beim Einsortieren entstand je Phase ein Sammel-Teilprozess „Weitere Bausteine“ und darunter für JEDEN Baustein ein Einzelschritt mit
// demselben Titel wie der Baustein (Ebene 4 und 5 gleichnamig); in der Sammel-Phase hieß sogar der Teilprozess wie die Phase. Jetzt:
//   Phase → EIN Sammel-Teilprozess („Weitere Bausteine“, in der Sammel-Phase „Allgemein“) → EIN Sammel-Schritt („Zugeordnete Bausteine“) → Bausteine (Ebene 5).
// Geprüft wird mit einer erfundenen Mini-Katalogdatei:
//   · Struktur je Phase (auch Dach-Thema → Diagnose, Sammel-Phase), Ebene 5, lückenlose Ränge, Phasen-Regel unverändert
//   · kein Titel doppelt in einer Phase; die Unterphasen-Form („Einzelschritt mit genau einem Baustein“) bleibt wie sie war
//   · der zweite Import derselben Datei ändert nichts; ein später dazukommender Baustein landet im selben Sammel-Schritt
//   · gespeicherte Vorlagen in der alten Form werden nicht umgeschrieben
//   · der Ablauf im Fall: eine Zeile „Zugeordnete Bausteine“ mit den Bausteinen als Verweisen, kein Sammel-Teilprozess als Überschrift
// Erfundene Daten, kein Netz, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen } from '@/lib/fulfillment/lesen';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import { vorlagenAnwenden, type VorlagenKontext } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { importAnwenden, importVorschau } from '@/lib/fulfillment/prozesse/import';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { phaseGruppen } from '@/lib/fulfillment/prozesse/reise';
import { SAMMEL_ALLGEMEIN, SAMMEL_SCHRITT, WEITERE_BAUSTEINE } from '@/lib/fulfillment/prozesse/phasen';
import { ebeneVon, kinderVon, teilbaum, wurzelVon } from '@/lib/fulfillment/regeln';
import type { ProzessKnoten, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const JETZT = '2026-10-13T09:00:00.000Z';
const HEUTE = '2026-10-13';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const zaehler = () => (p: string) => `${p}-s${++N}`;
const vk = (): VorlagenKontext => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: stand, neueId: zaehler() });
function ok<D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D {
  if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
  return r.datei;
}
const mitMuster = () => ok(vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], vk()));
const paket = (d: VorlagenDatei): ProzessVorlage => d.prozesse.find(p => p.art === 'paket' && p.titel === MUSTER_P1.titel)!;
const ik = (laufId: string) => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, datei: 'sammel.json', laufId });
const kid = () => `fk-s${++N}`;
const phasen = (v: ProzessVorlage) => kinderVon(wurzelVon(v.knoten)!.id, v.knoten);
const phaseNamens = (v: ProzessVorlage, titel: string) => phasen(v).find(p => p.titel === titel)!;
/** Die Titel aller Knoten unter einer Phase, die Phase selbst eingeschlossen. */
const titelUnter = (v: ProzessVorlage, phaseId: string) => teilbaum(phaseId, v.knoten).map(id => v.knoten.find(k => k.id === id)!.titel);

/** Eine erfundene Mini-Katalogdatei: Bausteine mit Phase ohne Unterphase, ein Dach-Thema, welche ganz ohne Phase und einer mit Unterphase. */
const sb = (id: string, extra: object = {}) => ({ id, art: 'aufgabe', titel: `Baustein ${id}`, zweck: 'Erfunden.', pakete: ['p1'], ...extra });
const MINI = {
  vorlagen: [
    sb('u1', { phase: 'umsetzung' }), sb('u2', { phase: 'umsetzung' }),
    sb('st', { phase: 'strategie' }),
    sb('o1'), sb('o2'),
    sb('sk', { phase: 'aufbau', unterphase: 'skripte' }),
  ],
};
const importMini = (d: VorlagenDatei = mitMuster(), datei: object = MINI, laufId = 'fi-sammel'): VorlagenDatei =>
  ok(importAnwenden(d, datei, { pakete: { p1: paket(d).id } }, ik(laufId), kid));

describe('Import ohne Unterphase: EIN Sammel-Teilprozess, EIN Sammel-Schritt je Phase, die Bausteine darunter', () => {
  const d = importMini();
  const v = paket(d);

  /** Der Pfad Phase → Sammel-Teilprozess → Sammel-Schritt → Bausteine in einer Phase. */
  function sammel(phaseTitel: string, teilTitel: string) {
    const p = phaseNamens(v, phaseTitel);
    const teile = kinderVon(p.id, v.knoten).filter(k => k.titel === teilTitel);
    expect(teile).toHaveLength(1);
    const schritte = kinderVon(teile[0].id, v.knoten);
    expect(schritte.map(k => k.titel)).toEqual([SAMMEL_SCHRITT]);
    return kinderVon(schritte[0].id, v.knoten);
  }

  it('Umsetzung: zwei Bausteine direkt unter dem Sammel-Schritt — Ebene 5, Ränge 1 und 2, kein Einzelschritt je Baustein', () => {
    const b = sammel('Umsetzung', WEITERE_BAUSTEINE);
    expect(b.map(k => k.bausteinId)).toEqual(['fb-imp-u1', 'fb-imp-u2']);
    expect(b.map(k => k.rang)).toEqual([1, 2]);
    expect(b.map(k => ebeneVon(k, v.knoten))).toEqual([5, 5]);
    expect(v.knoten.some(k => k.titel === 'Baustein u1' && !k.bausteinId)).toBe(false);
  });
  it('das Dach-Thema „Strategie“ kommt in die Phase Diagnose (Phasen-Regel unverändert), neben deren eigene Schritte', () => {
    const b = sammel('Diagnose', WEITERE_BAUSTEINE);
    expect(b.map(k => k.bausteinId)).toEqual(['fb-imp-st']);
    expect(titelUnter(v, phaseNamens(v, 'Diagnose').id)).toEqual(expect.arrayContaining(['Diagnosebericht', 'Quick Wins']));
    expect(phasen(v).map(p => p.titel)).toEqual([
      'Vorlauf / Onboarding', 'Analyse', 'Diagnose', 'Aufbau', 'Recruiting', 'Umsetzung', 'Führung', 'Follow-up / Übergabe', WEITERE_BAUSTEINE,
    ]);
  });
  it('ganz ohne Phase: die Sammel-Phase hat „Allgemein“ als Teilprozess — nie „Weitere Bausteine“ unter „Weitere Bausteine“', () => {
    const b = sammel(WEITERE_BAUSTEINE, SAMMEL_ALLGEMEIN);
    expect(b.map(k => k.bausteinId)).toEqual(['fb-imp-o1', 'fb-imp-o2']);
    expect(kinderVon(phaseNamens(v, WEITERE_BAUSTEINE).id, v.knoten).map(k => k.titel)).toEqual([SAMMEL_ALLGEMEIN]);
  });
  it('kein Titel doppelt in einer Phase — und kein Knoten heißt wie sein Elternknoten (einzige Ausnahme: der Einzelschritt der Unterphase-Form)', () => {
    for (const phase of ['Umsetzung', 'Diagnose', WEITERE_BAUSTEINE]) {
      const t = titelUnter(v, phaseNamens(v, phase).id);
      expect(new Set(t).size, `${phase}: ${t.join(' | ')}`).toBe(t.length);
    }
    const gleichnamig = v.knoten.filter(k => k.elternId && v.knoten.find(x => x.id === k.elternId)!.titel === k.titel);
    expect(gleichnamig.map(k => k.bausteinId)).toEqual(['fb-imp-sk']);   // Unterphase „Skripte“: Einzelschritt mit genau einem Baustein, wie bisher
  });
  it('mit Unterphase bleibt alles wie bisher: Teilprozess der Unterphase → Einzelschritt mit dem Titel des Bausteins → Baustein', () => {
    const skripte = kinderVon(phaseNamens(v, 'Aufbau').id, v.knoten).find(k => k.titel === 'Skripte')!;
    const schritt = kinderVon(skripte.id, v.knoten);
    expect(schritt.map(k => k.titel)).toEqual(['Baustein sk']);
    expect(kinderVon(schritt[0].id, v.knoten).map(k => k.bausteinId)).toEqual(['fb-imp-sk']);
  });
});

describe('Idempotenz und spätere Bausteine', () => {
  it('der zweite Import derselben Datei ändert nichts — die Vorschau nennt alles „gleich“', () => {
    const d = importMini();
    const d2 = importMini(d, MINI, 'fi-sammel-2');
    expect(d2).toEqual(d);
    const vs = importVorschau(MINI, d, 'sammel.json');
    expect(vs.zaehler.gleich).toBe(6);
    expect(vs.zaehler.neu).toBe(0);
  });
  it('ein später dazukommender Baustein landet im selben Sammel-Schritt — kein zweiter Sammel-Teilprozess, kein zweiter Sammel-Schritt', () => {
    const d = importMini();
    const d2 = importMini(d, { vorlagen: [sb('u3', { phase: 'umsetzung' }), sb('o3')] }, 'fi-sammel-3');
    const v = paket(d2);
    const um = phaseNamens(v, 'Umsetzung');
    expect(kinderVon(um.id, v.knoten).filter(k => k.titel === WEITERE_BAUSTEINE)).toHaveLength(1);
    const schritte = v.knoten.filter(k => k.titel === SAMMEL_SCHRITT);
    expect(schritte).toHaveLength(3);   // Umsetzung, Diagnose, Sammel-Phase — je Phase genau einer
    const inUmsetzung = schritte.find(k => teilbaum(um.id, v.knoten).includes(k.id))!;
    expect(kinderVon(inUmsetzung.id, v.knoten).map(k => [k.bausteinId, k.rang])).toEqual([['fb-imp-u1', 1], ['fb-imp-u2', 2], ['fb-imp-u3', 3]]);
    expect(kinderVon(phaseNamens(v, WEITERE_BAUSTEINE).id, v.knoten)).toHaveLength(1);
  });
});

describe('Gespeicherte Vorlagen in der alten Form werden nicht umgeschrieben', () => {
  it('die alte Kette „Weitere Bausteine → Schritt → Baustein“ bleibt wie sie ist; neue Bausteine kommen im selben Teilprozess unter den Sammel-Schritt', () => {
    // Nur die Bibliothek anlegen (kein Einsortieren), dann die alte Form von Hand in die Vorlage setzen (so stand sie im Bestand).
    const d0 = mitMuster();
    const d1 = ok(importAnwenden(d0, MINI, {}, ik('fi-bib'), kid));
    const p0 = paket(d1);
    const um = phaseNamens(p0, 'Umsetzung');
    const alt: ProzessKnoten[] = [
      { id: 'alt-t', elternId: um.id, titel: WEITERE_BAUSTEINE, rang: kinderVon(um.id, p0.knoten).length + 1 },
      { id: 'alt-s', elternId: 'alt-t', titel: 'Baustein u1', rang: 1 },
      { id: 'alt-b', elternId: 'alt-s', titel: 'Baustein u1', rang: 1, bausteinId: 'fb-imp-u1' },
    ];
    const d2: VorlagenDatei = { ...d1, prozesse: d1.prozesse.map(p => (p.id === p0.id ? { ...p, knoten: [...p.knoten, ...alt] } : p)) };
    const d3 = ok(importAnwenden(d2, MINI, { pakete: { p1: p0.id } }, ik('fi-alt'), kid));
    const v = paket(d3);
    // Die alte Kette ist unverändert (u1 steht schon in der Vorlage und wird nicht noch einmal einsortiert).
    for (const k of alt) expect(v.knoten.find(x => x.id === k.id)).toEqual(k);
    // u2 hängt im vorhandenen Teilprozess, unter einem neuen Sammel-Schritt neben der alten Kette — nicht in einem zweiten „Weitere Bausteine“.
    const umN = phaseNamens(v, 'Umsetzung');
    expect(kinderVon(umN.id, v.knoten).filter(k => k.titel === WEITERE_BAUSTEINE).map(k => k.id)).toEqual(['alt-t']);
    expect(kinderVon('alt-t', v.knoten).map(k => k.titel)).toEqual(['Baustein u1', SAMMEL_SCHRITT]);
    const sammel = kinderVon('alt-t', v.knoten)[1];
    expect(kinderVon(sammel.id, v.knoten).map(k => k.bausteinId)).toEqual(['fb-imp-u2']);
  });
});

describe('Ablauf im Fall: eine Zeile „Zugeordnete Bausteine“, keine Überschrift „Weitere Bausteine“', () => {
  const v = paket(importMini());
  const f = fallStarten({ mandatId: 'm-sammel', vorlage: v, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: zaehler() });
  const gruppen = (phaseTitel: string) => phaseGruppen(f, f.knoten.find(k => k.titel === phaseTitel && ebeneVon(k, f.knoten) === 2)!.id, HEUTE);

  it('in der Phase steht die Zeile mit den Bausteinen als Verweisen; der Sammel-Teilprozess ist keine Gruppe', () => {
    const g = gruppen('Umsetzung');
    expect(g.every(x => x.teil === null)).toBe(true);
    const zeilen = g.flatMap(x => x.zeilen).filter(z => z.knoten.titel === SAMMEL_SCHRITT);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].bausteine.map(b => b.bausteinId)).toEqual(['fb-imp-u1', 'fb-imp-u2']);
  });
  it('in der Sammel-Phase ist auch „Allgemein“ keine Überschrift', () => {
    const g = gruppen(WEITERE_BAUSTEINE);
    expect(g.map(x => x.teil)).toEqual([null]);
    expect(g[0].zeilen.map(z => z.knoten.titel)).toEqual([SAMMEL_SCHRITT]);
  });
  it('ein eigener Teilprozess „Allgemein“ in einer echten Phase bleibt eine Gruppe', () => {
    const l = [
      { id: 'w', titel: 'Paket', rang: 1, status: 'offen' as const }, { id: 'p', elternId: 'w', titel: 'Umsetzung', rang: 1, status: 'offen' as const },
      { id: 't', elternId: 'p', titel: SAMMEL_ALLGEMEIN, rang: 1, status: 'offen' as const }, { id: 's', elternId: 't', titel: 'Etwas tun', rang: 1, status: 'offen' as const },
    ];
    expect(phaseGruppen({ knoten: l }, 'p', HEUTE).map(x => x.teil?.titel ?? null)).toEqual([SAMMEL_ALLGEMEIN]);
  });
});
