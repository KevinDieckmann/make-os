'use client';

// ─── Die Fragen der Qualifizierung (03.10.) ────────────────────────────────────────────────────
// Die Fragen und ihre Stufen kommen aus den Sales-Scoring-Einstellungen — nicht mehr fest im Code. Je Frage eine Zeile:
// Name, gewählte Stufe, Punkte; Antippen klappt die Stufen auf (große Flächen, am Handy bedienbar) und das Feld „was genau“.
// Geschrieben wird sofort (der Aufrufer speichert und rechnet den Score live neu); „offen lassen“ nimmt die Antwort zurück.
// Quelle der Anzeige ist das Rechenergebnis des Kerns (`score.scoring.sales`) — dieselbe Rechnung wie überall.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { feld, LEUCHT } from '../../schlank';
import type { LeadScore } from '@/lib/crm/score';
import type { KriteriumErgebnis, ScoringEinstellungen, ScoringKriterium } from '@/lib/crm/scoring';
import { punkteText } from './hilfen';

const anteilFarbe = (e: KriteriumErgebnis): string => (e.offen || !e.beantwortet ? C.inkLeise : e.max > 0 && e.punkte >= e.max * 0.6 ? LEUCHT.gut : e.punkte > 0 ? LEUCHT.achtung : LEUCHT.kritisch);

/** Stufen nach Punkten absteigend — die beste Antwort steht oben. */
const sortiert = (k: ScoringKriterium) => [...k.stufen].sort((a, b) => b.punkte - a.punkte);

export function Fragen({ einstellungen, score, stufen, antworten, onStufe, onAntwort, nurOffene, erstOffen }: {
  einstellungen: ScoringEinstellungen; score: LeadScore;
  /** Die gewählten Stufen (lokal, sofort sichtbar) und die Freitexte. */
  stufen: Record<string, string>; antworten: Record<string, string>;
  onStufe: (kriteriumId: string, stufeId: string | null) => void; onAntwort: (kriteriumId: string, text: string) => void;
  /** Nur Fragen ohne eigene Antwort zeigen (Gesprächsmodus nimmt sie der Reihe nach selbst). */
  nurOffene?: boolean;
  /** Die erste offene Frage ist beim Öffnen aufgeklappt. */
  erstOffen?: boolean;
}) {
  const ergebnis = new Map((score.scoring?.sales.teile ?? []).flatMap(t => t.kriterien).map(k => [k.id, k]));
  const musse = einstellungen.sales.muss.flatMap(m => m.kriterien);
  const erste = erstOffen ? einstellungen.sales.teile.flatMap(t => t.kriterien).find(k => k.quelle === 'frage' && !k.aus && ergebnis.get(k.id)?.herkunft === 'ohne')?.id : undefined;
  const [auf, setAuf] = useState<string | null>(erste ?? null);
  const [text, setText] = useState<Record<string, string>>(antworten);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {einstellungen.sales.teile.map(t => {
        const fragen = t.kriterien.filter(k => k.quelle === 'frage' && !k.aus && (!nurOffene || ergebnis.get(k.id)?.offen));
        if (!fragen.length) return null;
        const te = score.scoring?.sales.teile.find(x => x.id === t.id);
        return (
          <div key={t.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700, marginBottom: 4 }}>
              <span>{t.name}</span>{te && <span style={{ fontVariantNumeric: 'tabular-nums', textTransform: 'none', letterSpacing: 0 }}>{punkteText(te.punkte)}/{punkteText(te.max)}</span>}
            </div>
            {fragen.map(k => {
              const e = ergebnis.get(k.id);
              const offen = auf === k.id;
              const gewaehlt = stufen[k.id] ?? (e && (e.herkunft === 'alt' || e.herkunft === 'lead') ? e.stufeId : undefined);
              const f = e ? anteilFarbe(e) : C.inkLeise;
              const istMuss = musse.includes(k.id);
              return (
                <div key={k.id} style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <button type="button" onClick={() => setAuf(offen ? null : k.id)} aria-expanded={offen} className="fassbar"
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', width: '100%', minHeight: 48, padding: '6px 2px', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, fontWeight: 600 }}>{k.name}{istMuss && <span title="Muss-Kriterium: ohne dieses ist es kein SQL" style={{ fontSize: 10.5, fontWeight: 700, color: LEUCHT.achtung, border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 999, padding: '0 6px' }}>Muss</span>}</span>
                      <span style={{ display: 'block', fontSize: 12, color: e?.beantwortet && e.herkunft !== 'messung' ? C.inkDim : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e?.stufeText && e.herkunft !== 'ohne' ? `${e.herkunft === 'messung' ? 'aus der Liste: ' : ''}${e.stufeText}` : 'noch offen'}
                      </span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: f, fontVariantNumeric: 'tabular-nums' }}>{e ? `${punkteText(e.punkte)}/${punkteText(e.max)}` : ''}</span>
                    <span aria-hidden style={{ color: C.inkLeise, transform: offen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                  </button>
                  {offen && (
                    <div style={{ display: 'grid', gap: 8, padding: '4px 0 14px' }}>
                      {k.hinweis && <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{k.hinweis}</div>}
                      <div role="radiogroup" aria-label={k.name} style={{ display: 'grid', gap: 6 }}>
                        {sortiert(k).map(s => {
                          const an = gewaehlt === s.id;
                          return (
                            <button key={s.id} type="button" role="radio" aria-checked={an} onClick={() => onStufe(k.id, an ? null : s.id)} className="fassbar"
                              style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 10, alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink,
                                border: `1px solid ${an ? LEUCHT.business : 'rgba(255,255,255,.1)'}`, background: an ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.03)' }}>
                              <b style={{ minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: an ? LEUCHT.business : C.inkDim }}>{punkteText(s.punkte)}</b>
                              <span style={{ lineHeight: 1.4 }}>{s.text}</span>
                            </button>
                          );
                        })}
                        {gewaehlt && <button type="button" onClick={() => onStufe(k.id, null)} className="fassbar" style={{ minHeight: 44, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5, textAlign: 'left', padding: '0 4px' }}>Antwort zurücknehmen (offen lassen)</button>}
                      </div>
                      <textarea value={text[k.id] ?? ''} onChange={ev => setText(a => ({ ...a, [k.id]: ev.target.value }))} onBlur={() => { if ((text[k.id] ?? '') !== (antworten[k.id] ?? '')) onAntwort(k.id, text[k.id] ?? ''); }}
                        rows={2} maxLength={1000} placeholder="Was genau — Zahlen, Beispiel, Zitat …" aria-label={`${k.name} — was genau`} style={{ ...feld, fontSize: 16, padding: '8px 11px', width: '100%', resize: 'vertical' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
