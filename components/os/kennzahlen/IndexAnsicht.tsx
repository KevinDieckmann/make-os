'use client';

// ─── Kennzahlen-Index — die eine Ansicht für alle Indizes (25.09.) ──────────
// Business, Privat, Gesundheit und Markttraktion sehen gleich aus und verhalten
// sich gleich: oben der Ring mit den Säulen und dem größten Hebel, dann je
// Säule ihre Kacheln (Wert, Ampel, die Punkte dahinter mit Link), dazwischen
// eigene Karten des Bereichs, unten der Verlauf. Ein Klick auf eine Kachel
// öffnet Formel, Schwellen, alle Punkte und den Verlauf der Kennzahl (?k=).

import { type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Ring, Fortschritt, Chip, LEUCHT } from '../schlank';
import { useLinkAuswahl } from '../Verlauf';
import { KennzahlKachel, KennzahlFenster, AMPEL_FARBE, scoreFarbe, type SchwelleSenden } from '../business/teile';
import { VerlaufKarte, type Serie } from '../business/Verlauf';
import type { IndexErgebnis, SaeulenStand } from '@/lib/kennzahlen/kern';
import type { Wechsel, VerlaufPunkt } from '@/lib/kennzahlen/speicher';

export interface IndexDaten { pi: IndexErgebnis; vor30: number | null; wechsel: Wechsel[]; verlauf: VerlaufPunkt[] }

export function verlaufSerien(saeulen: { id: string; label: string }[], farben: Record<string, string>): Serie[] {
  return [{ id: 'index', label: 'Index', farbe: C.ink, dick: 2.6 }, ...saeulen.map(s => ({ id: s.id, label: s.label, farbe: farben[s.id] ?? C.inkLeise, dick: 1.8 }))];
}

export function IndexAnsicht({ d, name, chip, farben, scope, schwelleSenden, onGespeichert, chips, kopfRechts, kopfId, saeuleKopf, zwischen, hinweis, i0 = 0, verlaufAb = 2, ohneVerlauf }: {
  d: IndexDaten | null;
  /** Name im Ring-Label („Privat · Solide“) und im Verlauf. */
  name: string;
  chip: string;
  farben: Record<string, string>;
  scope: string;
  schwelleSenden: SchwelleSenden;
  onGespeichert: () => void;
  /** Weitere Chips im Kopf (z. B. „Buchungen älter als 45 Tage“). */
  chips?: ReactNode;
  kopfRechts?: ReactNode;
  kopfId?: string;
  /** Eigener Inhalt oben in jeder Säulen-Karte (z. B. der Head der Welt). */
  saeuleKopf?: (s: SaeulenStand) => ReactNode;
  /** Eigene Karten zwischen den Säulen und dem Verlauf. */
  zwischen?: ReactNode;
  hinweis?: ReactNode;
  i0?: number;
  /** Verlauf erst ab so vielen Tagen zeigen. */
  verlaufAb?: number;
  ohneVerlauf?: boolean;
}) {
  const [offen, setOffen] = useLinkAuswahl('k');
  const pi = d?.pi ?? null;
  const farbe = scoreFarbe(pi?.index ?? null);
  const trend = pi?.index != null && d?.vor30 != null ? pi.index - d.vor30 : null;
  const alleK = pi?.saeulen.flatMap(s => s.kennzahlen) ?? [];
  const offeneK = pi && offen ? pi.saeulen.flatMap(s => s.kennzahlen.map(k => ({ k, s }))).find(x => x.k.id === offen) : undefined;
  const zaehlende = pi?.saeulen.filter(s => s.gewicht > 0) ?? [];

  return (
    <>
      <Karte i={i0} akzent={farbe} id={kopfId} style={kopfId ? { scrollMarginTop: 90 } : undefined}>
        {kopfRechts && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{kopfRechts}</div>}
        <div style={{ display: 'flex', gap: 'clamp(18px, 4vw, 44px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring groesse="gross" wert={pi?.index != null ? String(pi.index) : undefined} anteil={pi?.index != null ? pi.index / 100 : undefined} farbe={farbe} label={pi ? `${name} · ${pi.label}` : 'lädt …'} />
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip farbe={farbe}>{chip}</Chip>
              {trend != null && trend !== 0 && <Chip farbe={trend > 0 ? LEUCHT.gut : LEUCHT.kritisch}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)} in 30 Tagen</Chip>}
              {chips}
              {pi && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{Math.round(pi.abdeckung * 100)} % auf echten Daten · {pi.luecken} Messlücke{pi.luecken === 1 ? '' : 'n'}</span>}
            </div>
            {zaehlende.map(s => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(70px, 2fr) 40px', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{s.label} <span style={{ color: C.inkLeise, fontWeight: 400 }}>{Math.round(s.gewicht * 100)} %</span></span>
                <Fortschritt anteil={(s.score ?? 0) / 100} farbe={s.zuDuenn ? C.inkLeise : farben[s.id] ?? C.inkLeise} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, textAlign: 'right', color: s.score == null || s.zuDuenn ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }} title={s.zuDuenn ? 'zu wenig Daten — zählt nicht in den Index' : undefined}>{s.score ?? '—'}{s.zuDuenn ? '*' : ''}</span>
              </div>
            ))}
            {pi?.hebel && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Größter Hebel: <button onClick={() => setOffen(pi.hebel!.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontWeight: 700, cursor: 'pointer', fontSize: TYP.bedien, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)' }}>{pi.hebel.label}</button> ({pi.hebel.saeule})</div>}
            {pi?.saeulen.some(s => s.zuDuenn) && <div style={{ fontSize: 12, color: C.inkLeise }}>* zu wenig Daten (unter 40 % gemessen) — zählt noch nicht in den Index.</div>}
          </div>
        </div>
        {!!d?.wechsel.length && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: C.inkLeise }}>Seit {d.wechsel[0].seit.slice(8)}.{d.wechsel[0].seit.slice(5, 7)}.:</span>
            {d.wechsel.map(w => <button key={w.id} onClick={() => setOffen(w.id)} style={{ background: `${AMPEL_FARBE[w.nach]}1c`, border: 'none', borderRadius: 999, padding: '4px 10px', color: AMPEL_FARBE[w.nach], cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{alleK.find(x => x.id === w.id)?.label ?? w.id}: {w.von} → {w.nach}</button>)}
          </div>
        )}
      </Karte>

      {pi?.saeulen.map((s, i) => {
        const gruppen = Array.from(new Set(s.kennzahlen.map(k => k.gruppe)));
        return (
          <Karte key={s.id} i={i0 + i + 1} akzent={farben[s.id]}>
            <Ueberschrift farbe={farben[s.id]} rechts={<span>{s.kennzahlen.filter(k => k.gemessen).length} von {s.kennzahlen.length} gemessen{s.zuDuenn ? ' · zählt noch nicht' : s.gewicht === 0 ? ' · zählt nicht in den Index' : ''}</span>}>
              {s.label}{s.gewicht > 0 && <> · {Math.round(s.gewicht * 100)} %</>} {s.score != null && <span style={{ color: C.ink, marginLeft: 6, letterSpacing: 0 }}>{s.score}</span>}
            </Ueberschrift>
            <div style={{ fontSize: 12.5, color: C.inkLeise, margin: '-4px 0 12px' }}>{s.satz}</div>
            {saeuleKopf?.(s)}
            <div style={{ display: 'grid', gap: 14 }}>
              {gruppen.map(g => (
                <div key={g} style={{ display: 'grid', gap: 8 }}>
                  {gruppen.length > 1 && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>{g}</span>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                    {s.kennzahlen.filter(k => k.gruppe === g).map(k => <KennzahlKachel key={k.id} k={k} onOeffnen={() => setOffen(k.id)} />)}
                  </div>
                </div>
              ))}
            </div>
          </Karte>
        );
      })}

      {zwischen}
      {d && !ohneVerlauf && d.verlauf.length >= verlaufAb && <VerlaufKarte punkte={d.verlauf} serien={verlaufSerien(zaehlende, farben)} i={i0 + (pi?.saeulen.length ?? 0) + 2} name={name} />}
      {hinweis && <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.6 }}>{hinweis}</div>}

      {offeneK && d && (
        <KennzahlFenster key={offeneK.k.id} k={offeneK.k} saeule={offeneK.s.label} scope={scope} onZu={() => setOffen(null)} onGespeichert={onGespeichert}
          schwelleSenden={schwelleSenden} verlauf={d.verlauf.map(v => ({ tag: v.tag, wert: v.werte?.[offeneK.k.id] ?? null }))} />
      )}
    </>
  );
}
