// ─── MAKE OS — Einrichtung als Reise + Fluss (17.10., Kevins Miro-Standard für das ganze System) ─────────────────────────────────────────────────
// Kevin 17.10.: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung. Dann sieht das ganze System gleich klar
// aus.“ Die Etappen der Einrichtung als EINE Zeile (components/os/ui/reise `ReiseBild`) mit „Hier“ = die Etappe des nächsten Schritts; je Etappe höchstens
// vier Schritte als Kästchen (Rest „+n“). Ein Tipp auf eine Etappe zeigt ihre Schritte als Fluss (oben → unten), ein Tipp auf einen Schritt sein Detail.
// Rein, client-sicher, KEINE zweite Regel: Schritte NUR aus `schritteFuer` (Betreiber-Schritte nur in der Betreiber-Instanz — dieselbe Regel `sichtbarFuer`),
// fertig NUR `istFertig`, gezählt NUR `fortschrittVon`, „als Nächstes“ NUR `einrichtungStand`, „braucht dich“ NUR `zurueckgefallen`, Texte NUR `texteFuer`.

import { sichtbareKaestchen, type BildKaestchen, type BildSpalte, type FlussBild, type FlussKnotenBild, type KaestchenZustand, type ReiseZustand } from '@/lib/reise/bild';
import {
  einrichtungStand, etappenFuer, fortschrittVon, istFertig, schritteFuer, texteFuer, werText, zurueckgefallen,
  type Etappe, type HakenZustand, type Kontext, type Schritt,
} from './onboarding-data';

/** Kennung einer Etappe in der Reise (die Zeichnung braucht Texte als Kennung). */
export const etappeId = (nr: number) => `etappe-${nr}`;
export const etappeAusId = (id: string): number | null => (/^etappe-\d{1,2}$/.test(id) ? Number(id.slice(7)) : null);

/** Ein Schritt im Fluss — der Knoten trägt die Kennung des Schritts. */
export type EinrichtungKnoten = FlussKnotenBild<EinrichtungKnoten>;
export interface EtappenFluss extends FlussBild<EinrichtungKnoten> { etappe: number; naechste?: number }

interface Grundlage { etappen: Etappe[]; schritte: Schritt[]; naechster: Schritt | null; zurueck: ReadonlySet<string> }

/** Was Reise und Fluss teilen: die Etappen dieser Instanz (mit Schritten der Person), ihre Schritte in der Fassung der Instanz, der nächste, „braucht dich“. */
function grundlage(k: Kontext | null, z: HakenZustand | null | undefined): Grundlage {
  const roh = schritteFuer(k);
  const schritte = roh.map(s => texteFuer(s, k));
  const etappen = etappenFuer(!!k?.altbestand, !!k?.neustart, k?.betreiber, !!k?.nurBusiness).filter(e => schritte.some(s => s.etappe === e.nr));
  return { etappen, schritte, naechster: einrichtungStand(k, z).naechster, zurueck: new Set(zurueckgefallen(roh, z).map(s => s.id)) };
}

const schrittZustand = (s: Schritt, z: HakenZustand | null | undefined, naechster: Schritt | null): KaestchenZustand =>
  istFertig(s, z) ? 'erledigt' : naechster?.id === s.id ? 'hier' : 'offen';

/** Die Etappen als Reise-Zeile — „Hier“ = die Etappe des nächsten Schritts; fertig = jeder zählende Schritt getan (`fortschrittVon`, wie überall). */
export function einrichtungReise(k: Kontext | null, z: HakenZustand | null | undefined): { spalten: BildSpalte[]; hier: string | null } {
  const g = grundlage(k, z);
  const spalten = g.etappen.map((e): BildSpalte => {
    const liste = g.schritte.filter(s => s.etappe === e.nr);
    const f = fortschrittVon(liste, z, { alle: true });
    const zustand: ReiseZustand = g.naechster?.etappe === e.nr ? 'jetzt' : f.gesamt > 0 && f.fertig === f.gesamt ? 'fertig' : 'offen';
    const alle = liste.map((s): BildKaestchen => ({
      id: s.id, titel: s.titel, zustand: schrittZustand(s, z, g.naechster),
      ...(g.zurueck.has(s.id) ? { haengt: 'rot' as const } : {}), unter: s.optional ? 'optional' : `${s.minuten} Min.`,
    }));
    const zeigen = sichtbareKaestchen(alle, zustand);
    return {
      id: etappeId(e.nr), nr: e.nr, titel: e.titel, zustand, kaestchen: zeigen, mehr: alle.length - zeigen.length,
      unter: zustand === 'fertig' ? 'erledigt' : f.gesamt ? `${f.fertig} von ${f.gesamt}` : 'nur optional',
      ...(alle.some(x => x.haengt) ? { haengt: 'rot' as const } : {}),
    };
  });
  return { spalten, hier: g.naechster ? etappeId(g.naechster.etappe) : null };
}

/** Die Schritte EINER Etappe als Fluss (oben → unten): Start = die Etappe davor, Schritte, Ende = die nächste Etappe bzw. „Einrichtung steht“. */
export function etappenFluss(k: Kontext | null, z: HakenZustand | null | undefined, nr: number): EtappenFluss | null {
  const g = grundlage(k, z);
  const i = g.etappen.findIndex(e => e.nr === nr);
  if (i < 0) return null;
  const e = g.etappen[i], vor = g.etappen[i - 1], nach = g.etappen[i + 1];
  const knoten = g.schritte.filter(s => s.etappe === nr).map((s): EinrichtungKnoten => ({
    id: s.id, titel: s.titel, form: 'schritt', zustand: schrittZustand(s, z, g.naechster),
    ...(g.zurueck.has(s.id) ? { haengt: 'rot' as const } : {}),
    unter: [werText(s), `${s.minuten} Min.`, ...(s.optional ? ['optional'] : []), ...(g.zurueck.has(s.id) ? ['war schon grün — braucht dich'] : [])].join(' · '),
  }));
  return {
    etappe: nr, nr: e.nr, titel: e.titel,
    start: vor ? { titel: `Nach Etappe ${vor.nr}`, unter: vor.titel } : { titel: 'Los geht’s' },
    teile: knoten.length ? [{ art: 'linie', knoten }] : [], abschluss: [],
    ende: nach ? { titel: `Etappe ${nach.nr} · ${nach.titel}` } : { titel: 'Einrichtung steht' },
    ...(nach ? { naechste: nach.nr } : {}),
  };
}
