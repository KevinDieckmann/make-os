'use client';

// ─── Markttraktion · Marketing — gemeinsame Bauteile ─────────────────────────────────
// Kennzahl-Leiste (grau = noch nichts gemessen), Mehrfachwahl aus Pillen,
// Personenwahl mit Suche (ohne gesperrte Personen), Textfeld, das beim
// Verlassen speichert. Fürs Arbeiten zu zweit: Autor und Stimme als
// Plaketten, Freigabe-Stand als Chip, der Freigabe-Block (anfragen,
// freigeben, Änderung wünschen) und die Zeile „Als Nächstes“. Die Regeln
// dahinter stehen in lib/crm/marketing.ts (rein, getestet).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, Knopf, Chip, LEUCHT } from '../../schlank';
import { anzeigename, findeKontakte, type Kontakt } from '@/lib/make-one/crm';
import type { Kpi } from '@/lib/crm/kennzahlen';
import type { Freigabe } from '@/lib/crm/typen';
import { nameVon } from '@/lib/crm/team';
import { MARKE, stimmeText, genitiv, type FreigabeStand } from '@/lib/crm/marketing';
import { Pillen } from '../teile';
import { Person } from '../team';
import { datum } from '../daten';

export const KPI_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise } as const;

/** Kennzahlen als Kacheln — Farbe am Rand, Ziel und Herkunft darunter. */
export function KpiLeiste({ liste }: { liste: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
      {liste.map(k => (
        <div key={k.id} title={k.quelle} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', borderLeft: `3px solid ${KPI_FARBE[k.ampel]}` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: k.ampel === 'grau' ? C.inkDim : C.ink, fontVariantNumeric: 'tabular-nums' }}>{k.anzeige}</div>
          <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2, lineHeight: 1.35 }}>{k.label}</div>
          <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 2, lineHeight: 1.35 }}>Ziel {k.ziel} · {k.quelle}</div>
        </div>
      ))}
    </div>
  );
}

/** Mehrfachwahl — jede Pille schaltet für sich. */
export function Mehrfach<T extends string>({ liste, aktiv, onWahl, farbe }: { liste: { id: T; label: string }[]; aktiv: T[]; onWahl: (l: T[]) => void; farbe?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {liste.map(o => <Pillen key={o.id} farbe={farbe} liste={[o]} aktiv={aktiv.includes(o.id) ? o.id : null} onWahl={id => onWahl(aktiv.includes(id) ? aktiv.filter(x => x !== id) : [...aktiv, id])} />)}
    </div>
  );
}

/** Person aus der Kartei suchen (ab zwei Zeichen). Gesperrte Personen stehen nicht zur Wahl. */
export function PersonWahl({ kontakte, onWahl, platzhalter = 'Person suchen: Name, Firma, Mail …' }: { kontakte: Kontakt[]; onWahl: (k: Kontakt) => void; platzhalter?: string }) {
  const [q, setQ] = useState('');
  const treffer = useMemo(() => (q.trim().length >= 2 ? findeKontakte(kontakte.filter(k => !k.werbesperre), q, 6) : []), [kontakte, q]);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={platzhalter} aria-label="Person suchen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
      {treffer.map(k => (
        <button key={k.id} onClick={() => { onWahl(k); setQ(''); }} className="fassbar" style={{ textAlign: 'left', background: 'rgba(255,255,255,.03)', border: 'none', borderRadius: 10, color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 10px' }}>
          {anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}
        </button>
      ))}
      {q.trim().length >= 2 && !treffer.length && <div style={{ fontSize: 12, color: C.inkLeise, padding: '2px 2px' }}>Niemand gefunden.</div>}
    </div>
  );
}

/** Mehrzeiliges Feld, das beim Verlassen speichert. */
export function Textfeld({ wert = '', onFertig, platzhalter, zeilen = 4, max }: { wert?: string; onFertig: (t: string) => void; platzhalter?: string; zeilen?: number; max?: number }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  return <textarea value={t} rows={zeilen} maxLength={max} placeholder={platzhalter} aria-label={platzhalter} onChange={e => setT(e.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }}
    style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />;
}

/** In die Zwischenablage — Versand und Veröffentlichung bleiben bei dir. */
export async function kopieren(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// ── Zu zweit ───────────────────────────────────────────────────────────────
/** Stimme als Plakette: die Person — oder die Marke als kleines Quadrat. Ohne Eintrag gestrichelt. */
export function StimmePlakette({ stimme, groesse = 20 }: { stimme?: string | null; groesse?: number }) {
  if (stimme === MARKE) return <span title="Marke" style={{ width: groesse, height: groesse, borderRadius: 6, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto', background: 'rgba(255,255,255,.07)', color: C.inkDim, border: '1px solid rgba(255,255,255,.16)', fontSize: Math.round(groesse * 0.45), fontWeight: 700 }}>M</span>;
  return <Person id={stimme ?? null} groesse={groesse} />;
}

/** Wer schreibt › in wessen Namen es erscheint. */
export function AutorStimme({ autor, stimme, groesse = 20 }: { autor: string; stimme?: string | null; groesse?: number }) {
  const titel = `Schreibt: ${nameVon(autor)} · erscheint als: ${stimmeText(stimme)}`;
  return (
    <span title={titel} aria-label={titel} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flex: '0 0 auto' }}>
      <Person id={autor} groesse={groesse} />
      <span aria-hidden style={{ color: C.inkLeise, fontSize: 11 }}>›</span>
      <StimmePlakette stimme={stimme} groesse={groesse} />
    </span>
  );
}

export const STAND_FARBE: Record<FreigabeStand, string> = { nicht_noetig: C.inkLeise, fehlt: C.inkDim, offen: LEUCHT.achtung, aenderung: LEUCHT.kritisch, ok: LEUCHT.gut };
/** Freigabe-Stand als Chip — nichts, wenn keine Freigabe nötig ist. */
export function FreigabeChip({ stand, an }: { stand: FreigabeStand; an?: string | null }) {
  if (stand === 'nicht_noetig') return null;
  const text = stand === 'offen' ? `Freigabe bei ${nameVon(an)}` : stand === 'aenderung' ? 'Änderung gewünscht' : stand === 'fehlt' ? 'Freigabe fehlt' : 'freigegeben';
  return <Chip farbe={STAND_FARBE[stand]}>{text}</Chip>;
}

/** „Als Nächstes: …“ — jede Karte sagt, was zu tun ist. */
export function AlsNaechstes({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)', fontSize: TYP.bedien, color: C.ink, lineHeight: 1.45 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Als Nächstes</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

/**
 * Freigabe zwischen Kevin und Malin: anfragen, freigeben, Änderung wünschen.
 * Welche Knöpfe erscheinen, hängt am Stand (lib/crm/marketing.ts) und daran,
 * wer angemeldet ist — freigeben kann nur, wer freigeben soll.
 */
export function FreigabeBlock({ f, stand, an, ich, heute, ziele, ohne, erledigt, onAnfragen, onFreigeben, onAenderung }: {
  f?: Freigabe | null; stand: FreigabeStand;
  /** Wer freigibt — beim Beitrag die Stimme, beim Newsletter die angefragte Person (ohne Anfrage null). */
  an: string | null; ich: string | null; heute: string;
  /** Newsletter: wen man um Freigabe bitten kann. */
  ziele?: string[];
  /** Text, wenn keine Freigabe nötig bzw. angefragt ist. */
  ohne: ReactNode;
  /** Veröffentlicht oder versendet — nur noch anzeigen. */
  erledigt?: boolean;
  onAnfragen: (an: string) => void; onFreigeben: () => void; onAenderung: (notiz: string) => void;
}) {
  const [wunsch, setWunsch] = useState(false);
  const [notiz, setNotiz] = useState('');
  const text = { fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 } as const;
  const reihe = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as const;
  const seit = f?.am ? datum(f.am.slice(0, 10), heute) : null;
  const n = nameVon(an);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {stand === 'nicht_noetig' && (
        <div style={reihe}>
          <span style={{ ...text, color: C.inkLeise }}>{ohne}</span>
          {!erledigt && (ziele ?? []).map(z => <Knopf key={z} leise onClick={() => onAnfragen(z)}>Zur Freigabe an {nameVon(z)}</Knopf>)}
        </div>
      )}
      {stand === 'fehlt' && an && (
        <div style={reihe}>
          <span style={text}>{ich === an ? 'Erscheint in deinem Namen — dein Okay fehlt noch.' : `Erscheint in ${genitiv(n)} Namen — vor dem Planen braucht es ${genitiv(n)} Okay.`}</span>
          {!erledigt && (ich === an ? <Knopf farbe={LEUCHT.gut} onClick={onFreigeben}>Freigeben</Knopf> : <Knopf onClick={() => onAnfragen(an)}>Zur Freigabe an {n}</Knopf>)}
        </div>
      )}
      {stand === 'offen' && an && (
        <>
          <div style={reihe}>
            <Person id={an} groesse={18} />
            <span style={text}>{ich === an ? 'Wartet auf dein Okay' : `Liegt bei ${n}`}{seit ? ` · seit ${seit}` : ''}{f?.von && f.von !== ich ? ` · angefragt von ${nameVon(f.von)}` : ''}</span>
          </div>
          {f?.notiz && <div style={{ ...text, color: C.inkLeise }}>„{f.notiz}“</div>}
          {ich === an && !erledigt && !wunsch && (
            <div style={reihe}><Knopf farbe={LEUCHT.gut} onClick={onFreigeben}>Freigeben</Knopf><Knopf leise onClick={() => setWunsch(true)}>Änderung wünschen</Knopf></div>
          )}
        </>
      )}
      {stand === 'aenderung' && an && (
        <>
          <div style={reihe}><Person id={an} groesse={18} /><span style={text}>{ich === an ? 'Du hast eine Änderung gewünscht' : `${n} wünscht eine Änderung`}{seit ? ` · ${seit}` : ''}</span></div>
          {f?.notiz && <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5, padding: '8px 12px', borderLeft: `3px solid ${LEUCHT.kritisch}`, background: 'rgba(255,255,255,.03)', borderRadius: 8, whiteSpace: 'pre-wrap' }}>„{f.notiz}“</div>}
          {!erledigt && (ich === an ? <div style={reihe}><Knopf leise onClick={onFreigeben}>Doch freigeben</Knopf></div> : <div style={reihe}><Knopf onClick={() => onAnfragen(an)}>Überarbeitet — erneut an {n}</Knopf></div>)}
        </>
      )}
      {stand === 'ok' && an && (
        <div style={reihe}>
          <span style={{ ...text, color: LEUCHT.gut }}>Freigegeben von {n}{seit ? ` · ${seit}` : ''}</span>
          {ich === an && !erledigt && !wunsch && <button onClick={() => setWunsch(true)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>doch eine Änderung wünschen</button>}
        </div>
      )}
      {wunsch && (
        <div style={{ display: 'grid', gap: 6 }}>
          <textarea value={notiz} rows={3} maxLength={600} placeholder="Was soll anders werden?" aria-label="Was soll anders werden?" autoFocus onChange={e => setNotiz(e.target.value)}
            style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />
          <div style={reihe}>
            <Knopf farbe={LEUCHT.kritisch} aus={!notiz.trim()} onClick={() => { onAenderung(notiz); setWunsch(false); setNotiz(''); }}>Änderung wünschen</Knopf>
            <button onClick={() => { setWunsch(false); setNotiz(''); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
