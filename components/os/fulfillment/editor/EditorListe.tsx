'use client';

// ─── Fulfillment · Prozess-Editor am Handy (≤ 720 px) — Liste mit Pfeilen statt Ziehen (17.10.) ──────────────────────────────────────────────
// Am Handy wird nichts gezogen: die Phasen stehen als Liste (antippen = wählen, ▲ ▼ = umsortieren, „+ Phase“), darunter die Schritte der gewählten Phase
// (Form-Zeichen + Titel, ▲ ▼, antippen = bearbeiten), der Nein-Zweig eingerückt unter seiner Entscheidung, „Hinzufügen“ mit denselben Formen wie die Palette;
// das Seitenfeld steht unter der Liste. Dieselben Ops wie am Rechner (über `api`), alle Ziele ≥ 44 px.

import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf } from '../../ui';
import type { EditorModell, EditorPhase } from '@/lib/fulfillment/prozesse/editor';
import { flussFormVon } from '@/lib/fulfillment/prozesse/reise-bild';
import { FormZeichen } from '../reise/ReiseBild';
import { FreigabeRaute } from '../reise/bilder';
import { klein } from '../prozesse/teile';
import { knotenUnter } from './bild';
import { EinfuegenMenue, K44, ZIEL_PX, type EditorApi } from './SeitenFeld';

const zeile = (an: boolean) => ({
  display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0, minHeight: ZIEL_PX, padding: '6px 10px', borderRadius: 10, textAlign: 'left' as const, cursor: 'pointer',
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, background: an ? TIEF.flaeche(C.aktiv) : 'none', border: `1px solid ${an ? TIEF.rand(C.aktiv) : RAND.flaeche}`,
});
const Pfeile = ({ hoch, runter, aus, name }: { hoch: () => void; runter: () => void; aus: [boolean, boolean]; name: string }) => (
  <span style={{ display: 'inline-flex', gap: 4 }}>
    <Knopf leise style={{ ...K44, minWidth: ZIEL_PX, padding: 0 }} aus={aus[0]} ariaLabel={`„${name}“ nach oben`} onClick={hoch}><ArrowUp size={15} aria-hidden /></Knopf>
    <Knopf leise style={{ ...K44, minWidth: ZIEL_PX, padding: 0 }} aus={aus[1]} ariaLabel={`„${name}“ nach unten`} onClick={runter}><ArrowDown size={15} aria-hidden /></Knopf>
  </span>
);

export function EditorListe({ modell, phase, gewaehlt, api, onPhase, onKnoten, feld }: {
  modell: EditorModell; phase: EditorPhase | null; gewaehlt: string | null; api: EditorApi;
  onPhase: (id: string) => void; onKnoten: (phaseId: string, id: string) => void; feld: ReactNode;
}) {
  const aus = !api.darf || api.laeuft;
  return (
    <div className="ff-editor-liste" style={{ display: 'grid', gap: 14 }}>
      <Karte i={1} flach>
        <Ueberschrift>Phasen</Ueberschrift>
        <ol aria-label="Phasen des Ablaufs" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {modell.phasen.map((p, i) => (
            <li key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="fassbar" aria-pressed={phase?.id === p.id} onClick={() => onPhase(p.id)} style={zeile(phase?.id === p.id)}>
                <span style={{ ...MIKRO, flex: '0 0 auto' }}>{i + 1}</span>
                <span className="ff-titel" title={p.titel} style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{p.titel}</span>
                {p.abstimmung && <FreigabeRaute gegeben={false} groesse={10} />}
              </button>
              {api.darf && <Pfeile name={p.titel} aus={[aus || i === 0, aus || i === modell.phasen.length - 1]} hoch={() => api.phaseSchieben(p, -1)} runter={() => api.phaseSchieben(p, 1)} />}
            </li>
          ))}
        </ol>
        {api.darf && <Knopf leise style={K44} aus={aus} onClick={() => api.phaseNeu(modell.phasen.at(-1)?.id)}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={14} aria-hidden />Phase</span></Knopf>}
      </Karte>
      {phase && (
        <Karte i={2} flach>
          <Ueberschrift>Phase {phase.nr} · {phase.titel}</Ueberschrift>
          {!phase.schritte && <div style={klein}>Noch kein Schritt — unten hinzufügen.</div>}
          <ol aria-label={`Schritte in ${phase.titel}`} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {phase.abschnitte.flatMap(a => [
              ...(a.art === 'gruppe' ? [<li key={`g-${a.schluessel}`} style={{ ...MIKRO, paddingTop: 6 }}>{a.titel}</li>] : []),
              ...a.knoten.filter(k => !k.neinVon).flatMap(k => {
                const reihe = phase.abschnitte.flatMap(x => x.knoten.filter(y => !y.neinVon).map(y => y.id));
                const i = reihe.indexOf(k.id);
                const nein = k.zweige?.nein ? a.knoten.concat(phase.abschnitte.flatMap(x => x.knoten)).find(x => x.id === k.zweige!.nein) : undefined;
                const unter = knotenUnter(k);
                const eintrag = (x: typeof k, eingerueckt = false) => (
                  <li key={x.id} style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: eingerueckt ? 22 : 0 }}>
                    <button type="button" className="fassbar" aria-pressed={gewaehlt === x.id} onClick={() => onKnoten(phase.id, x.id)} style={zeile(gewaehlt === x.id)}>
                      {eingerueckt && <span aria-hidden style={{ color: C.inkLeise }}>nein →</span>}
                      <span style={{ display: 'inline-flex', flex: '0 0 auto' }}>{x.form === 'schritt' ? <span aria-hidden style={{ width: 12, height: 9, borderRadius: 2, border: `1.5px solid ${C.inkDim}` }} /> : <FormZeichen form={flussFormVon(x.form)} />}</span>
                      <span style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                        <span className="ff-titel" title={x.titel}>{x.titel}</span>
                        {(x === k ? unter : knotenUnter(x)) && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{x === k ? unter : knotenUnter(x)}</span>}
                      </span>
                    </button>
                    {!eingerueckt && api.darf && <Pfeile name={x.titel} aus={[aus || i <= 0, aus || i >= reihe.length - 1]} hoch={() => api.schritt(x, -1)} runter={() => api.schritt(x, 1)} />}
                  </li>
                );
                return [eintrag(k), ...(nein ? [eintrag(nein, true)] : [])];
              }),
            ])}
          </ol>
          {phase.abstimmung && <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, minHeight: ZIEL_PX }}><FreigabeRaute gegeben={false} />Abstimmungspunkt{phase.abstimmung.nr ? ` ${phase.abstimmung.nr}` : ''} · {phase.abstimmung.titel}</span>}
          {api.darf && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={MIKRO}>Hinzufügen</span>
              <EinfuegenMenue api={api} onZu={() => undefined} />
            </div>
          )}
        </Karte>
      )}
      {feld}
    </div>
  );
}
