// ─── Prozesse · Werkstatt — eigene Prozesse auf der Landkarte (Etappe B2, 21.10.; Kevins Bild: „Neuer Prozess erscheint als eigene Kachel in seinem Bereich“) ──
// Ein Prozess der Werkstatt (Bestand `prozesse--<haushalt>`) steht als Kachel in SEINEM Bereich der Fliege (Feld `bereich`: Marketing · Sales · Übergabe ·
// Fulfillment · Ausbau im Kern, Führung und Unterstützung als Bänder) — dasselbe Modell wie System-Prozesse und Fulfillment-Vorlagen (`ProzessDef`), nichts
// kopiert. Gezeigt wird die jüngste veröffentlichte Version, sonst der Entwurf (die Marke sagt, was es ist); archivierte fehlen. Der Drill-down führt in die
// Werkstatt (`WEG.prozesse({ p, ansicht: 'werkstatt' })`). Keine Personen, keine Namen (der Eigner nur als „festgelegt“), keine Beträge — wie die Landkarte.
// Rein (Server UND Browser); Tests: tests/prozesse-werkstatt-lage.test.ts.

import { WEG } from '@/lib/wege';
import { FALL_ARTEN, PROZESS_BEREICHE, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten } from './definition';
import { alleSchritte, phasen, schritteDer, seitenZiele, startKnoten } from './fluss';
import { ausloeserText } from './ausloeser';
import type { FlussForm } from '@/lib/reise/bild';
import type { KernStufe, ProzessDef, ProzessPhase, ProzessSchritt } from './typen';

type K = ProzessKnoten<ProzessForm>;

/** Die festen Formen der Landkarte (Miro-Stil) für die Formen der Werkstatt. */
export const LANDKARTEN_FORM: Readonly<Record<ProzessForm, FlussForm>> = {
  schritt: 'schritt', nachricht: 'nachricht', entscheidung: 'entscheidung', erinnerung: 'erinnerung', termin: 'termin', abstimmung: 'entscheidung',
  ausloeser: 'schritt', agent: 'schritt', warten: 'termin', schleife: 'schritt', teilprozess: 'schritt', freigabe: 'entscheidung', ende: 'schritt',
};

function phasenVon(d: ProzessDefinition): ProzessPhase[] {
  const seite = seitenZiele(d.knoten);
  return phasen(d).map(p => ({
    id: p.id, titel: p.titel,
    schritte: schritteDer(d, p.id).filter(s => s.form !== 'ausloeser').map((s: K): ProzessSchritt => ({
      id: s.id, titel: s.titel, form: LANDKARTEN_FORM[s.form ?? 'schritt'],
      ...(s.form === 'entscheidung' && s.zweige?.ja ? { ja: s.zweige.ja } : {}),
      ...((s.form === 'entscheidung' || s.form === 'freigabe') && s.zweige?.nein ? { nein: s.zweige.nein } : {}),
      ...(s.form === 'ende' ? { ende: true as const } : {}),
      ...(seite.has(s.id) && s.form === 'erinnerung' && s.zweige?.ja ? { zurueck: true as const } : {}),
    })),
  }));
}

/** Ein Prozess der Werkstatt als Prozess der Landkarte (Quelle „Werkstatt“). Archiviert bzw. ohne Phase: null. */
export function prozessAusWerkstatt(e: ProzessEintrag): ProzessDef | null {
  if (e.status === 'archiviert') return null;
  const v = e.versionen.at(-1);
  const d = v?.definition ?? e.entwurf;
  if (!phasen(d).length) return null;
  const bereich = PROZESS_BEREICHE.find(b => b.id === (d.bereich ?? 'fulfillment')) ?? PROZESS_BEREICHE[3];
  const starts = startKnoten(d).map(s => (s.ausloeser ? ausloeserText(s.ausloeser) : s.titel));
  const schritte = alleSchritte(d).length;
  return {
    id: e.id, titel: d.titel || 'Neuer Prozess', quelle: 'werkstatt',
    band: bereich.band, ...(bereich.band === 'kern' ? { stufe: bereich.id as KernStufe } : {}),
    steckbrief: {
      ausloeser: starts.length ? starts.join(' · ') : 'noch kein Auslöser',
      eingang: d.startKriterium?.trim() || 'Startkriterium noch offen',
      ergebnis: d.endKriterium?.trim() || 'Endkriterium noch offen',
      empfaenger: FALL_ARTEN.find(f => f.id === (d.fallArt ?? 'mandat'))?.titel ?? 'Fall',
      eigner: d.eigner ? 'festgelegt (Werkstatt › Steckbrief)' : 'noch offen',
    },
    phasen: phasenVon(d),
    werkstatt: { status: e.status, version: v?.nr ?? null, schritte },
    editor: WEG.prozesse({ p: e.id, ansicht: 'werkstatt' }),
    link: { href: WEG.prozesse({ p: e.id, ansicht: 'werkstatt' }), text: 'In der Werkstatt öffnen' },
  };
}
