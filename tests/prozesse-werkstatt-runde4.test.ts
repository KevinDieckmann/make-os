// ─── Prozesse · Werkstatt — Runde 4 (25.10., Befunde aus dem dritten Bau-Test im Demo) ──────────────────────────────────────────────────────────────────────
// Je Befund ein Wächter: (1) ⌘V: der Titel einer Kopie folgt ihrem Namen (auch nach dem Umbenennen), solange er am Original dem Namen folgte;
// (2) das Ausgang-Menü nennt jedes Ziel genau einmal, das wirksame ist gewählt, Optionen beginnen mit dem Namen — über alle Vorlagen;
// (3) eine angehängte Kopie liegt in der Spalte hinter ihrem Ziel (der Faden läuft vorwärts); (4) die Kamera rechnet im freien Feld ohne Leiste und Panel;
// (5) Befunde nennen den Namen des Schritts; (6) die Schleife belegt die einzige passende Liste vor; (7) „Echtes Mandat“ zeigt Produkt bzw. Stufe/Status;
// (8)–(10) Probelauf-Hinweis, Panel-Scroll, Handy.
// Erfundene Werte, kein Netz, kein Modell.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { anlegen, kopieren, einfuegen, ausgangsWahl, ausgangSetzen, ausgangWahlAus, hauptZiel, mehrfachZiele, AUSGANG_NAECHSTER, AUSGANG_ENDE, type Ergebnis, type Fassung } from '@/lib/prozesse/werkstatt-aktionen';
import { ausgaengeVon } from '@/lib/prozesse/werkstatt-lage';
import { ausgangsZiele } from '@/lib/prozesse/fluss';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { ALLE_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { MUSTER_PAKETE } from '@/lib/fulfillment/muster';
import { paketAlsDefinition } from '@/lib/prozesse/fulfillment-modus';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { neuerKnoten, nameSetzen, maskeWerte, titelSetzen } from '@/lib/prozesse/werkstatt-maske';
import { phasen } from '@/lib/prozesse/fluss';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-9400-${String(++n).padStart(12, '0')}`;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const AUFGABE = katalogEintrag('aufgabe.anlegen')!;
const titelVon = (k: Fassung['knoten'][number]) => maskeWerte(k, AUFGABE).titel;

const mandatProzess = () => {
  const e = neuerProzess({ id: 'pz-00000000-0000-4000-9400-000000000001', titel: 'Mandat-Start (Probe)', bereich: 'uebergabe', fallArt: 'mandat', von: 'test', jetzt: '2026-10-25T10:00:00Z', kennung });
  const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
  return { e, start };
};

describe('(1) ⌘V-Kopie: der Titel folgt dem Namen', () => {
  const bau = (titel?: string) => {
    const { e, start } = mandatProzess();
    let kick = neuerKnoten(AUFGABE, kennung(), 'Kick-off Diagnose');
    kick = nameSetzen(kick, AUFGABE, 'Kick-off Diagnose');
    if (titel) kick = titelSetzen(kick, AUFGABE, titel);
    const f = gut(anlegen({ knoten: e.entwurf.knoten }, kick, { nach: start.id, ausgang: 'weiter' }));
    return { f, kick: f.knoten.find(k => k.id === kick.id)! };
  };
  it('Bau-Test 3: Kopie heißt „Kick-off Diagnose (Kopie)“ und trägt denselben Titel; umbenannt in „Kick-off Vertrieb“ zieht der Titel mit', () => {
    const { f, kick } = bau();
    expect(titelVon(kick)).toBe('Kick-off Diagnose');
    const g = gut(einfuegen(f, kopieren(f, [kick.id])!, { phaseId: phasen(f)[0].id, kennung }));
    const kopie = g.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose (Kopie)');
    expect(titelVon(kopie)).toBe('Kick-off Diagnose (Kopie)');
    const umbenannt = nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb');
    expect(umbenannt.titel).toBe('Kick-off Vertrieb');
    expect(titelVon(umbenannt)).toBe('Kick-off Vertrieb');
    // Das Original bleibt, wie es war.
    expect(titelVon(g.knoten.find(k => k.id === kick.id)!)).toBe('Kick-off Diagnose');
  });
  it('ein selbst geänderter Titel bleibt an der Kopie — und folgt auch dort nicht dem Namen', () => {
    const { f, kick } = bau('Diagnose-Termin mit {{firma.name}} vereinbaren');
    const g = gut(einfuegen(f, kopieren(f, [kick.id])!, { phaseId: phasen(f)[0].id, kennung }));
    const kopie = g.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose (Kopie)');
    expect(titelVon(kopie)).toBe('Diagnose-Termin mit {{firma.name}} vereinbaren');
    expect(titelVon(nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb'))).toBe('Diagnose-Termin mit {{firma.name}} vereinbaren');
  });
  it('in einen anderen Prozess (freier Name) bleibt der Name — und der Titel folgt weiter', () => {
    const { f, kick } = bau();
    const ablage = kopieren(f, [kick.id])!;
    const { e } = mandatProzess();
    const g = gut(einfuegen({ knoten: e.entwurf.knoten }, ablage, { phaseId: phasen({ knoten: e.entwurf.knoten })[0].id, kennung }));
    const kopie = g.knoten.find(k => !e.entwurf.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose');
    expect(titelVon(nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb'))).toBe('Kick-off Vertrieb');
  });
  it('die Regel steht an EINER Stelle (einfuegen nimmt nameSetzen)', () => {
    expect(lies('lib/prozesse/werkstatt-aktionen.ts')).toContain('nameSetzen(k, katalogEintrag(k.katalog?.id), name)');
  });
});

describe('(2) Ausgang-Menü: jedes Ziel genau einmal, das wirksame gewählt, Optionen beginnen mit dem Namen', () => {
  const FASSUNGEN: { name: string; d: Pick<ProzessDefinition, 'knoten'> }[] = [
    ...ALLE_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]).map(d => ({ name: d.id, d })),
    ...MUSTER_PAKETE.map(v => ({ name: v.id, d: paketAlsDefinition(v) as Pick<ProzessDefinition, 'knoten'> })),
  ];
  /** Wohin ein Ausgang gerade wirklich führt (dieselbe Auflösung wie Motor und Probelauf). */
  const wirksam = (d: Pick<ProzessDefinition, 'knoten'>, id: string, a: string): string | null => {
    const k = d.knoten.find(x => x.id === id)!;
    const eigner = k.schloss && (a === 'ja' || a === 'weiter') ? d.knoten.find(x => x.id === k.schloss!.fuer)! : k;
    if (eigner !== k || !(a === 'nein' || a === 'fehler' || a === 'abgelaufen')) return hauptZiel(d.knoten, eigner.id);
    const z = ausgangsZiele({ knoten: d.knoten }).get(`${id}|${a}`);
    return z !== undefined ? z : a === 'abgelaufen' && k.form === 'warten' ? hauptZiel(d.knoten, id) : null;
  };
  it('über alle Vorlagen: kein Ziel doppelt, gewählt = wirksam, jede Option beginnt mit dem Namen — und führt dorthin, wohin sie sagt', () => {
    let menues = 0, gewechselt = 0;
    for (const { name, d } of FASSUNGEN) {
      for (const k of d.knoten.filter(x => x.form && x.form !== 'ende')) {
        for (const a of ausgaengeVon(k)) {
          const w = ausgangsWahl(d, k.id, a);
          if (!w.optionen.length) continue;
          menues++;
          const wo = `${name} „${k.titel}“ ${a}: ${w.optionen.map(o => o.label).join(' | ')}`;
          const ziele = w.optionen.map(o => o.ziel ?? '∅');
          expect(new Set(ziele).size, wo).toBe(ziele.length);
          // Jede Option beginnt mit dem Namen ihres Ziels (bzw. „Lauf endet“/„Lauf hält an“) — nie mit „—“ oder einem zusätzlichen „„“.
          for (const o of w.optionen) {
            expect(o.label, wo).not.toMatch(/^—/);
            const t = o.ziel ? d.knoten.find(x => x.id === o.ziel)?.titel.trim() || '(ohne Namen)' : 'Lauf ';
            expect(o.label.startsWith(t), `${wo} — ${o.label}`).toBe(true);
          }
          const gewaehlt = w.optionen.find(o => o.wert === w.wert);
          expect(gewaehlt, wo).toBeTruthy();
          expect(gewaehlt!.ziel, wo).toBe(wirksam(d, k.id, a));
          // „(folgt im Ablauf)“ nur am impliziten Ziel des Strangs.
          for (const o of w.optionen) if (o.label.includes('(folgt im Ablauf')) expect(o.wert === AUSGANG_NAECHSTER || o.wert === '', wo).toBe(true);
          // Verdrahtung unverändert: jede andere Option führt nach dem Wählen genau zu ihrem Ziel; kein anderer Ausgang ändert sich (Regel der Werkstatt-Fäden).
          for (const o of w.optionen.filter(x => x.wert !== w.wert)) {
            const r = ausgangSetzen({ knoten: [...d.knoten] }, k.id, a, ausgangWahlAus(o.wert));
            if (!r.ok) continue;
            gewechselt++;
            expect(wirksam(r.fassung, k.id, a), `${wo} → ${o.label}`).toBe(o.ziel);
          }
        }
      }
    }
    expect(menues).toBeGreaterThan(100);
    expect(gewechselt).toBeGreaterThan(200);
  });
  it('Bau-Test 3: „Lauf endet (folgt im Ablauf)“ steht nicht neben „Lauf endet“, ein implizites Ziel nicht neben sich selbst', () => {
    const { e, start } = mandatProzess();
    const a = neuerKnoten(AUFGABE, kennung(), 'Kick-off Cockpit planen');
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, a, { nach: start.id, ausgang: 'weiter' }));
    // Am Ende des Strangs: das Ende ist implizit und steht genau einmal da.
    const am = ausgangsWahl(f, a.id, 'weiter');
    expect(am.optionen.filter(o => o.ziel === null).map(o => o.label)).toEqual(['Lauf endet (folgt im Ablauf)']);
    expect(am.wert).toBe(AUSGANG_NAECHSTER);
    const b = neuerKnoten(AUFGABE, kennung(), 'Kick-off Diagnose');
    f = gut(anlegen(f, b, { nach: a.id, ausgang: 'weiter' }));
    const w = ausgangsWahl(f, a.id, 'weiter');
    expect(w.optionen.map(o => o.label)).toEqual(['Kick-off Diagnose (folgt im Ablauf)', 'Lauf endet']);
    // Ausdrücklich „Lauf endet“: jetzt steht das Ende einmal (gewählt), das Ziel des Strangs weiter einmal als „folgt im Ablauf“.
    f = gut(ausgangSetzen(f, a.id, 'weiter', ausgangWahlAus(AUSGANG_ENDE)));
    const x = ausgangsWahl(f, a.id, 'weiter');
    expect(x.wert).toBe(AUSGANG_ENDE);
    expect(x.optionen.map(o => o.label)).toEqual(['Kick-off Diagnose (folgt im Ablauf)', 'Lauf endet']);
  });
  it('die Bahn heißt wie auf der Fläche — eine Person mit ihrem Namen statt „Mensch“', () => {
    const { e, start } = mandatProzess();
    const sys = neuerKnoten(katalogEintrag('glocke.melden')!, kennung(), 'Melden');
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, sys, { nach: start.id, ausgang: 'weiter' }));
    const person = { ...neuerKnoten(AUFGABE, kennung(), 'Kick-off planen'), bahn: 'mensch' as const };
    person.katalog = { id: 'aufgabe.anlegen', werte: { ...(person.katalog?.werte ?? {}), titel: 'Kick-off planen', wer: 'lena' } };
    f = gut(anlegen(f, person, { nach: sys.id, ausgang: 'weiter' }));
    const w = ausgangsWahl(f, sys.id, 'weiter', { team: [{ id: 'lena', name: 'Lena Beispiel' }] });
    expect(w.optionen[0].label).toBe('Kick-off planen (folgt im Ablauf · Bahn „Lena Beispiel“)');
    const ohne = ausgangsWahl(f, sys.id, 'weiter');
    expect(ohne.optionen[0].label).toBe('Kick-off planen (folgt im Ablauf · Bahn „Person (nicht mehr im Team)“)');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain("ausgangsWahl(d, k.id, a, { team: teamAusAuswahl(p.auswahl['team-person']) })");
  });
  it('Mehrfach-Dialog: das Ziel „weiter im Ablauf“ steht nicht noch einmal als Schritt da', () => {
    const { e, start } = mandatProzess();
    const a = neuerKnoten(AUFGABE, kennung(), 'Prüfen');
    const f = gut(anlegen({ knoten: e.entwurf.knoten }, a, { nach: start.id, ausgang: 'weiter' }));
    const m = mehrfachZiele(f, start.id);
    expect(m.map(x => x.label)).toEqual(['Prüfen (folgt im Ablauf)']);
  });
});
