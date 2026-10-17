'use client';

// ─── Fulfillment · Prozess-Editor — der Fluss einer Phase zum Bearbeiten (17.10.) ───────────────────────────────────────────────────────────
// Dieselbe Zeichnung wie der Fluss im Fall (components/os/fulfillment/reise/Fluss.tsx: `KnotenKnopf`, `Pfeil`, `SeitenPfeil`) — dazu nur, was der Editor
// braucht: die Ablage-Stellen (`data-ff-ziel`: Start, Schritt, Gruppe, hinter der Gruppe, Ende, freier Nein-Platz), der freie Nein-Platz einer Entscheidung
// („+ Erinnerung“), der Abstimmungspunkt am Ende der Phase und ein Leerzustand mit einem Satz. Er rechnet nichts (Modell: lib/fulfillment/prozesse/editor.ts).

import type { KeyboardEvent as RKeyboardEvent, ReactNode } from 'react';
import { Plus, BellRing } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, RAND, ECKE, SCHRIFT, FLAECHE_STIL, TIEF } from '@/lib/make-one/design';
import type { EditorKnoten, EditorPhase } from '@/lib/fulfillment/prozesse/editor';
import { KnotenKnopf, Pfeil, SeitenPfeil } from '../reise/Fluss';
import { FORM_FARBE } from '../reise/bilder';
import { alsFlussKnoten } from './bild';
import type { ZiehQuelle } from './ziehen';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 } as const;

export interface FlussEditorProps {
  phase: EditorPhase; vorige?: EditorPhase; naechste?: EditorPhase;
  gewaehlt: string | null; darf: boolean;
  onWahl: (id: string) => void;
  /** Ziehen (aus ./ziehen.tsx) — nur, wenn bearbeitet werden darf. */
  griff: (q: ZiehQuelle) => Record<string, unknown>;
  tasten: (k: EditorKnoten) => (e: RKeyboardEvent<HTMLElement>) => void;
  onNeinNeu: (entscheidungId: string) => void;
  onGruppe: (gruppeId: string) => void;
  onAbstimmung: () => void;
  onNaechste?: () => void;
}

/** Eine Ablage-Stelle (Markierung für das Ziehen). */
const ziel = (art: string, phaseId: string, id = '', titel = '') => ({ 'data-ff-ziel': art, 'data-ff-phase': phaseId, ...(id ? { 'data-ff-id': id } : {}), ...(titel ? { 'data-ff-titel': titel } : {}) });

export function EditorFluss(p: FlussEditorProps) {
  const { phase } = p;
  const nach = new Map(phase.abschnitte.flatMap(a => a.knoten).map(k => [k.id, k]));
  const knopf = (k: EditorKnoten): ReactNode => (
    <KnotenKnopf k={alsFlussKnoten(k)} gewaehlt={p.gewaehlt === k.id} onWahl={() => p.onWahl(k.id)} editor
      griff={{ ...ziel('schritt', phase.id, k.id, k.titel), 'data-ff-knoten': k.id, onKeyDown: p.tasten(k), ...(p.darf ? p.griff({ art: 'schritt', id: k.id, titel: k.titel, phaseId: phase.id }) : {}), 'aria-keyshortcuts': p.darf ? 'Alt+ArrowUp Alt+ArrowDown Delete Enter' : 'Enter' }} />
  );
  /** Ein Knoten mit seiner Seite: Entscheidung → Nein-Zweig (Knoten) oder freier Platz „+ Erinnerung“. */
  const zeile = (k: EditorKnoten): ReactNode => {
    if (k.form !== 'entscheidung') return <div className="ff-fluss-zelle">{knopf(k)}</div>;
    const nein = k.zweige?.nein ? nach.get(k.zweige.nein) : undefined;
    return (
      <div className="ff-fluss-zweig">
        <div className="ff-fluss-zelle">{knopf(k)}</div>
        <SeitenPfeil nein />
        <div className="ff-fluss-erinnerung" style={{ minWidth: 0 }}>
          {nein ? knopf(nein) : p.darf ? (
            <button type="button" className="fassbar" onClick={() => p.onNeinNeu(k.id)} {...ziel('nein', phase.id, k.id, k.titel)}
              aria-label={`Nein-Zweig von „${k.titel}“: Erinnerung anlegen`}
              style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 18, border: `1px dashed ${TIEF.rand(FORM_FARBE.erinnerung)}`, background: 'none', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', textAlign: 'left' }}>
              <BellRing size={15} color={FORM_FARBE.erinnerung} aria-hidden /><span>+ Erinnerung</span>
            </button>
          ) : <span style={klein}>kein Nein-Zweig</span>}
        </div>
      </div>
    );
  };
  const strang = (knoten: readonly EditorKnoten[]) => knoten.filter(k => !k.neinVon).map((k, i, l) => (
    <div key={k.id} style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>
      {i > 0 && <Pfeil text={l[i - 1].form === 'entscheidung' ? 'ja' : undefined} />}
      {zeile(k)}
    </div>
  ));
  const leer = !phase.abschnitte.some(a => a.knoten.length);
  const start = p.vorige ? (p.vorige.abstimmung ? `Nach Abstimmungspunkt${p.vorige.abstimmung.nr ? ` ${p.vorige.abstimmung.nr}` : ''}` : `Nach Phase ${p.vorige.nr} · ${p.vorige.titel}`) : 'Start';
  return (
    <div className="ff-fluss" role="group" aria-label={`Ablauf der Phase ${phase.nr}: ${phase.titel} — bearbeiten`}>
      <span className="ff-fluss-start" role="note" aria-label={`Start: ${start}`} {...ziel('anfang', phase.id)}
        style={{ display: 'grid', placeItems: 'center', textAlign: 'center', minWidth: 120, maxWidth: 260, minHeight: 64, padding: '8px 18px', borderRadius: 999, border: `2px solid ${C.inkDim}`, background: C.grund, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.3, boxSizing: 'border-box' }}>
        <span style={{ fontWeight: 600 }}>{start}</span>
      </span>
      {phase.abschnitte.map(a => (
        <div key={a.schluessel} style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>
          <Pfeil />
          {a.art === 'strang' ? strang(a.knoten) : (
            <>
              <div {...ziel('gruppe', phase.id, a.gruppeId, a.titel)} role="group" aria-label={`Teilprozess „${a.titel}“`}
                style={{ ...FLAECHE_STIL.leise, borderRadius: ECKE.flach, padding: '6px 10px 12px', display: 'grid', gap: 4, justifyItems: 'center', width: 'min(100%, 420px)', boxSizing: 'border-box' }}>
                <button type="button" className="fassbar" onClick={() => p.onGruppe(a.gruppeId!)} aria-pressed={p.gewaehlt === a.gruppeId} aria-label={`Teilprozess „${a.titel}“ bearbeiten`}
                  style={{ ...MIKRO, color: p.gewaehlt === a.gruppeId ? C.ink : C.inkDim, minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}>{a.titel}</button>
                {strang(a.knoten)}
              </div>
              <div {...ziel('nachgruppe', phase.id, a.gruppeId, a.titel)} aria-hidden style={{ width: 'min(100%, 420px)', minHeight: 16 }} />
            </>
          )}
        </div>
      ))}
      {leer && (
        <>
          <Pfeil />
          <div className="ff-editor-ziel-leer" {...ziel('ende', phase.id)}>
            <span style={klein}>{p.darf ? 'Noch kein Schritt — zieh einen aus der Palette hierher oder tippe ihn dort an.' : 'Diese Phase hat noch keine Schritte.'}</span>
          </div>
        </>
      )}
      {phase.abstimmung && (
        <>
          <Pfeil />
          <div className="ff-fluss-zelle">
            <KnotenKnopf editor gewaehlt={p.gewaehlt === `fg-${phase.id}`} onWahl={p.onAbstimmung}
              k={{ id: `fg-${phase.id}`, titel: `Abstimmungspunkt${phase.abstimmung.nr ? ` ${phase.abstimmung.nr}` : ''}${phase.abstimmung.titel ? ` · ${phase.abstimmung.titel}` : ''}`, form: 'entscheidung', zustand: 'offen', unter: 'am Ende der Phase — ja: weiter' }} />
          </div>
        </>
      )}
      <Pfeil text={phase.abstimmung ? 'ja' : undefined} />
      <button type="button" className="fassbar ff-fluss-ende" onClick={p.onNaechste} disabled={!p.onNaechste} {...ziel('ende', phase.id)}
        aria-label={p.naechste ? `Ende der Phase — weiter zu Phase ${p.naechste.nr} · ${p.naechste.titel}` : 'Ende des Ablaufs'}
        style={{ minHeight: 48, minWidth: 120, maxWidth: 300, padding: '8px 18px', borderRadius: 999, border: `2px solid ${RAND.stark}`, background: 'none', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: p.onNaechste ? 'pointer' : 'default', textAlign: 'center' }}>
        {p.naechste ? `Phase ${p.naechste.nr} · ${p.naechste.titel} ›` : 'Ende des Ablaufs'}
      </button>
      {p.darf && !leer && <span style={{ ...klein, color: C.inkLeise, marginTop: 6, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={13} aria-hidden />Ziehen ordnet um — Tastatur: Alt + ↑/↓ verschiebt, Entf löscht, Enter bearbeitet.</span>}
    </div>
  );
}
