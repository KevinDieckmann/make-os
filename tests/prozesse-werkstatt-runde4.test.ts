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
import { anlegen, kopieren, einfuegen, type Ergebnis, type Fassung } from '@/lib/prozesse/werkstatt-aktionen';
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
