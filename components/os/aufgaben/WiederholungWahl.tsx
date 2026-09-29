'use client';
// ─── Wiederholung wählen (Paket C3, 28.09. spät) ────────────────────────────
// Kompakt: „wiederholt: nie · täglich · Werktage · wöchentlich (Tage) · monatlich (Tag) · jährlich“, dazu „alle n …“
// und „bis …“, mit Vorschau „nächste: Mo 05.10.“. Rechnung rein in lib/aufgaben/wiederholung.ts.
// `SerienZeichen` = das kleine ↻ an wiederkehrenden Aufgaben und Listen.
// Serien-Extras (29.09., Kevin; nur an Aufgaben, `extras`): Rhythmus „ab Fälligkeit / ab Erledigung“, „im Wechsel:
// Kevin → Malin“ (die nächste Instanz bekommt die nächste Person), „Wochenende/Feiertag (NRW) → nächster Werktag“.
// „Werktage“ kennt die Feiertage NRW immer (lib/aufgaben/feiertage.ts). Überspringen/Beenden stehen im Detail.

import { useEffect, useState, type CSSProperties } from 'react';
import { werktagAbOder } from '@/lib/aufgaben/feiertage';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import type { Wiederholung, WiederholungRegel } from '@/types/tasks';
import {
  berlinerTag, ersterTermin, istTag, kurzTag, naechsterTermin, tagPlus, wiederholungText, wochentag, REGEL_LABEL, WOCHENTAGE_KURZ,
} from '@/lib/aufgaben/wiederholung';

/** ↻ an wiederkehrenden Aufgaben/Listen (Titel = Regel in Worten). */
export function SerienZeichen({ w, groesse = 13 }: { w?: Wiederholung; groesse?: number }) {
  if (!w) return null;
  return <span title={`wiederkehrend: ${wiederholungText(w)}`} aria-label={`wiederkehrend: ${wiederholungText(w)}`} style={{ color: C.aktiv, fontSize: groesse, lineHeight: 1, flex: '0 0 auto', fontWeight: 700 }}>↻</span>;
}

const REGELN: WiederholungRegel[] = ['taeglich', 'werktage', 'woechentlich', 'monatlich', 'jaehrlich'];
const EINHEIT: Record<WiederholungRegel, [string, string]> = { taeglich: ['Tag', 'Tage'], werktage: ['Werktag', 'Werktage'], woechentlich: ['Woche', 'Wochen'], monatlich: ['Monat', 'Monate'], jaehrlich: ['Jahr', 'Jahre'] };
/** Mo … So (Anzeige-Reihenfolge), Werte wie `Wiederholung.wochentage` (0 = Sonntag). */
const WOCHE = [1, 2, 3, 4, 5, 6, 0];

const klein: CSSProperties = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '4px 10px', minHeight: 30, colorScheme: 'dark' };
const leise: CSSProperties = { fontSize: 12.5, color: C.inkLeise, display: 'inline-flex', alignItems: 'center', gap: 6 };

/** Standard beim Wechsel der Regel: Wochentag bzw. Monatstag des Bezugstags; Intervall und „bis“ bleiben. */
function mitRegel(regel: WiederholungRegel, alt: Wiederholung | undefined, bezug: string): Wiederholung {
  const w: Wiederholung = { regel, ...(alt?.intervall && alt.intervall > 1 ? { intervall: alt.intervall } : {}), ...(alt?.bis ? { bis: alt.bis } : {}) };
  if (regel === 'woechentlich') w.wochentage = alt?.wochentage?.length ? alt.wochentage : [wochentag(bezug)];
  if (regel === 'monatlich' || regel === 'jaehrlich') w.monatstag = alt?.monatstag ?? Number(bezug.slice(8, 10));
  return w;
}

/**
 * Auswahl der Wiederholung. `basis` = Deadline (Aufgabe) bzw. Start der laufenden Periode; Vorschau „nach-basis“ zeigt
 * den Termin nach der Basis (Aufgabe: nach dem Erledigen), „ab-morgen“ den ersten Termin ab morgen (Serien-Liste).
 */
export function WiederholungWahl({ wert, basis, onChange, vorschau = 'nach-basis', ohneBis, extras, personen = [], zustaendig }: {
  wert?: Wiederholung;
  basis?: string;
  onChange: (w: Wiederholung | undefined) => void;
  vorschau?: 'nach-basis' | 'ab-morgen';
  ohneBis?: boolean;
  /** Serien-Extras (nur Aufgaben): ab Erledigung, im Wechsel, Feiertage. */
  extras?: boolean;
  /** Personen des Haushalts (Speichername + Name) — für „im Wechsel“. */
  personen?: readonly { speicher: string; name: string }[];
  /** Wer die Aufgabe gerade hat — beginnt den Wechsel. */
  zustaendig?: string;
}) {
  const heute = berlinerTag();
  const bezug = basis && istTag(basis.slice(0, 10)) ? basis.slice(0, 10) : heute;
  const [n, setN] = useState(String(wert?.intervall ?? 1));
  const [tag, setTag] = useState(String(wert?.monatstag ?? ''));
  useEffect(() => { setN(String(wert?.intervall ?? 1)); setTag(String(wert?.monatstag ?? '')); }, [wert?.intervall, wert?.monatstag]);

  const setze = (teil: Partial<Wiederholung>) => {
    if (!wert) return;
    const neu: Wiederholung = { ...wert, ...teil };
    for (const k of Object.keys(teil) as (keyof Wiederholung)[]) if (teil[k] === undefined) delete neu[k];
    onChange(neu);
  };
  const intervallFest = () => {
    const x = Math.trunc(Number(n));
    const gut = Number.isFinite(x) && x >= 1 && x <= 365 ? x : 1;
    setN(String(gut));
    if (gut !== (wert?.intervall ?? 1)) setze({ intervall: gut > 1 ? gut : undefined });
  };
  const tagFest = () => {
    const x = Math.trunc(Number(tag));
    if (!Number.isFinite(x) || x < 1 || x > 31) { setTag(String(wert?.monatstag ?? '')); return; }
    if (x !== wert?.monatstag) setze({ monatstag: x });
  };
  const roh = wert ? (vorschau === 'ab-morgen' ? ersterTermin(wert, tagPlus(heute, 1)) : naechsterTermin(wert, bezug)) : null;
  // Wochenende/Feiertag → nächster Werktag (wie der Schreibweg, lib/aufgaben/serie.ts).
  const naechste = roh && wert?.feiertage === 'NRW' && wert.regel !== 'werktage' ? werktagAbOder(roh, 'NRW') : roh;
  const name = (p: string) => personen.find(x => x.speicher === p)?.name ?? p;
  const wechsel = (wert?.rotation?.length ?? 0) > 1;
  const wechselAn = () => {
    const erste = zustaendig && personen.some(p => p.speicher === zustaendig) ? zustaendig : personen[0]?.speicher;
    if (!erste) return;
    setze({ rotation: [erste, ...personen.map(p => p.speicher).filter(p => p !== erste)] });
  };

  // Schmal (375 px, Sichtprüfung 29.09.): die Auswahl ist so breit wie ihre längste Option („Werktage (ohne Feiertage NRW)“)
  // und ragte über den Kartenrand — sie darf schrumpfen (`maxWidth: 100%`, `minWidth: 0`), die Wochentage umbrechen.
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', maxWidth: '100%', minWidth: 0 }}>
      <select value={wert?.regel ?? ''} aria-label="Wiederholung" onChange={e => onChange(e.target.value ? mitRegel(e.target.value as WiederholungRegel, wert, bezug) : undefined)} style={{ ...klein, maxWidth: '100%', minWidth: 0, textOverflow: 'ellipsis' }}>
        <option value="">nie</option>
        {REGELN.map(r => <option key={r} value={r}>{r === 'werktage' ? 'Werktage (ohne Feiertage NRW)' : REGEL_LABEL[r]}</option>)}
      </select>
      {wert && (
        <label style={leise}>alle
          <input value={n} onChange={e => setN(e.target.value.replace(/\D/g, '').slice(0, 3))} onBlur={intervallFest} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            inputMode="numeric" aria-label="Intervall" style={{ ...klein, width: 46, textAlign: 'center' }} />
          {EINHEIT[wert.regel][(wert.intervall ?? 1) === 1 ? 0 : 1]}
        </label>
      )}
      {wert?.regel === 'woechentlich' && (
        <span role="group" aria-label="Wochentage" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 3, maxWidth: '100%' }}>
          {WOCHE.map(d => {
            const an = wert.wochentage?.includes(d) ?? false;
            return (
              <button key={d} type="button" aria-pressed={an} onClick={() => {
                const alt = wert.wochentage ?? [];
                const neu = an ? alt.filter(x => x !== d) : [...alt, d];
                setze({ wochentage: neu.length ? Array.from(new Set(neu)).sort() : undefined });
              }} className="fassbar" style={{ ...klein, padding: '4px 7px', minWidth: 30, cursor: 'pointer', borderColor: an ? `${C.aktiv}99` : 'rgba(255,255,255,.08)', background: an ? `${C.aktiv}22` : 'rgba(255,255,255,.03)', color: an ? C.aktiv : C.inkDim, fontWeight: 600 }}>
                {WOCHENTAGE_KURZ[d]}
              </button>
            );
          })}
        </span>
      )}
      {(wert?.regel === 'monatlich' || wert?.regel === 'jaehrlich') && (
        <label style={leise} title="31 = immer der letzte Tag des Monats">am
          <input value={tag} onChange={e => setTag(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={tagFest} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            inputMode="numeric" aria-label="Tag im Monat" style={{ ...klein, width: 42, textAlign: 'center' }} />.
        </label>
      )}
      {wert && !ohneBis && (
        <label style={leise}>bis
          <input type="date" value={wert.bis ?? ''} min={bezug} onChange={e => setze({ bis: e.target.value || undefined })} aria-label="Wiederholen bis" style={klein} />
        </label>
      )}
      {wert && <span style={{ fontSize: 12.5, color: naechste ? C.inkDim : C.inkLeise }}>{wert.serieBeendet ? 'Serie beendet' : wert.ab === 'erledigt' ? 'nächste: gerechnet ab dem Tag der Erledigung' : naechste ? `nächste: ${kurzTag(naechste)}` : 'Serie endet'}</span>}
      {wert && extras && (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flexBasis: '100%' }}>
          <select value={wert.ab ?? 'faellig'} aria-label="Rhythmus rechnen ab" onChange={e => setze({ ab: e.target.value === 'erledigt' ? 'erledigt' : undefined })} style={klein}>
            <option value="faellig">ab Fälligkeit</option>
            <option value="erledigt">ab Erledigung</option>
          </select>
          {personen.length > 1 && (
            <button type="button" aria-pressed={wechsel} onClick={() => (wechsel ? setze({ rotation: undefined }) : wechselAn())} className="fassbar"
              title="Die nächste Instanz bekommt die nächste Person"
              style={{ ...klein, cursor: 'pointer', borderColor: wechsel ? `${C.aktiv}99` : 'rgba(255,255,255,.08)', background: wechsel ? `${C.aktiv}22` : 'rgba(255,255,255,.03)', color: wechsel ? C.aktiv : C.inkDim }}>
              ⇄ im Wechsel{wechsel ? `: ${wert.rotation!.map(name).join(' → ')}` : ''}
            </button>
          )}
          {wert.regel !== 'werktage' && (
            <label style={leise}>
              <input type="checkbox" checked={wert.feiertage === 'NRW'} onChange={e => setze({ feiertage: e.target.checked ? 'NRW' : undefined })} style={{ width: 18, height: 18 }} />
              Wochenende/Feiertag (NRW) → nächster Werktag
            </label>
          )}
        </span>
      )}
    </span>
  );
}
