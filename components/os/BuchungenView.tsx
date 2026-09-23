'use client';

// ─── MAKE OS — Buchungen ────────────────────────────────────────────────────
// Was auf den Konten wirklich passiert ist. Filtern nach Monat und Kategorie,
// damit man Fragen beantworten kann wie „wofür ging im Juli das Geld drauf".

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { eur } from '@/lib/make-one/finance-data';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string; konto?: string; ort?: string }

/**
 * Kevins Ansage: „Privat bleibt immer privat, die beiden Firmen kann man auch
 * mal zusammenfassen." Deshalb gibt es beides — die Firmen einzeln UND als eine
 * Auswahl „Geschäftlich".
 */
const ORTE: { id: string; label: string; trifft: (o?: string) => boolean }[] = [
  { id: 'alle', label: 'Alles', trifft: () => true },
  { id: 'privat', label: 'Privat', trifft: o => o === 'privat' },
  { id: 'geschaeft', label: 'Geschäftlich', trifft: o => o === 'kdv' || o === 'kdc' },
  { id: 'kdv', label: 'KD Ventures', trifft: o => o === 'kdv' },
  { id: 'kdc', label: 'Selbständigkeit', trifft: o => o === 'kdc' },
];

export function BuchungenView() {
  const [alle, setAlle] = useState<Buchung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [monat, setMonat] = useState<string>('alle');
  const [kategorie, setKategorie] = useState<string>('alle');
  const [suche, setSuche] = useState('');
  const [ort, setOrt] = useState('alle');

  useEffect(() => {
    fetch('/api/state/buchungen').then(r => r.json()).then(d => {
      setAlle(Array.isArray(d.buchungen) ? d.buchungen : []);
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, []);

  const monate = useMemo(() => Array.from(new Set(alle.map(b => b.datum.slice(0, 7)))).sort().reverse(), [alle]);
  const kategorien = useMemo(() => {
    const m = new Map<string, number>();
    alle.forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [alle]);

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase();
    const ortFilter = ORTE.find(o => o.id === ort) ?? ORTE[0];
    return alle.filter(b => {
      if (!ortFilter.trifft(b.ort)) return false;
      if (monat !== 'alle' && b.datum.slice(0, 7) !== monat) return false;
      if (kategorie !== 'alle' && b.kategorie !== kategorie) return false;
      if (n && !`${b.wer} ${b.zweck ?? ''} ${b.kategorie}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [alle, monat, kategorie, suche, ort]);

  const ein = sichtbar.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
  const aus = Math.abs(sichtbar.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0));

  const nachKategorie = useMemo(() => {
    const m = new Map<string, number>();
    sichtbar.filter(b => b.betrag < 0).forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    return Array.from(m.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s);
  }, [sichtbar]);

  const monatLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/finanzen" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Finanzen</Link>
        <Seitenkopf
          rubrik={<>Buchungen</>}
          titel={<>{sichtbar.length} {sichtbar.length === 1 ? 'Buchung' : 'Buchungen'} <span style={{ fontSize: 15, fontWeight: 600, marginLeft: 14 }}> <span style={{ color: T.accent }}>+{eur(ein)}</span> <span style={{ color: T.muted }}> / </span> <span style={{ color: T.amber }}>−{eur(aus)}</span> <span style={{ color: ein - aus >= 0 ? T.accent : T.crit }}> = {ein - aus >= 0 ? '+' : ''}{eur(ein - aus)}</span> </span></>}
        />

        {/* Wo die Buchung hingehört — Privat getrennt, Firmen einzeln oder zusammen */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          {ORTE.map(o => {
            const n = alle.filter(b => o.trifft(b.ort)).length;
            const an = ort === o.id;
            return (
              <button key={o.id} onClick={() => setOrt(o.id)} disabled={!n && o.id !== 'alle'}
                style={{
                  fontFamily: T.sans, fontSize: 12, padding: '5px 12px', borderRadius: 8,
                  cursor: !n && o.id !== 'alle' ? 'default' : 'pointer', opacity: !n && o.id !== 'alle' ? 0.4 : 1,
                  border: `1px solid ${an ? T.accent : T.line}`, background: an ? T.accentSoft : 'transparent',
                  color: an ? T.accent : T.inkDim, fontWeight: an ? 700 : 400,
                }}>{o.label} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{n}</span></button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 14px' }}>
          <button onClick={() => setMonat('alle')} style={{
            fontFamily: T.mono, fontSize: 11, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${monat === 'alle' ? T.accent : T.line}`, background: monat === 'alle' ? `${T.accent}1c` : 'transparent',
            color: monat === 'alle' ? T.accentInk : T.muted,
          }}>alle Monate</button>
          {monate.map(m => (
            <button key={m} onClick={() => setMonat(m)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${monat === m ? T.accent : T.line}`, background: monat === m ? `${T.accent}1c` : 'transparent',
              color: monat === m ? T.accentInk : T.muted,
            }}>{monatLabel(m)}</button>
          ))}
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="suchen …" aria-label="Buchungen durchsuchen"
            style={{ marginLeft: 'auto', width: 160, background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 10px', color: T.ink, fontSize: 12, fontFamily: T.sans, outline: 'none' }} />
        </div>

        {/* Wohin es ging */}
        {!!nachKategorie.length && (
          <div style={{ ...panel, padding: '15px 19px', marginBottom: 14 }}>
            <div style={{ ...lbl, marginBottom: 9 }}>Wohin es ging</div>
            {(() => {
              const max = Math.max(...nachKategorie.map(x => x.s), 1);
              return nachKategorie.slice(0, 12).map(x => (
                <div key={x.k} onClick={() => setKategorie(kategorie === x.k ? 'alle' : x.k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 0', cursor: 'pointer', opacity: kategorie === 'alle' || kategorie === x.k ? 1 : 0.4 }}>
                  <span style={{ fontSize: 12.5, color: kategorie === x.k ? T.accentInk : T.inkDim, width: 165, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k}</span>
                  <div style={{ flex: 1, height: 8, background: T.void, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((x.s / max) * 100)}%`, height: '100%', background: kategorie === x.k ? T.accent : T.amber, opacity: 0.75, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, width: 78, textAlign: 'right' }}>{eur(x.s)}</span>
                </div>
              ));
            })()}
            {kategorie !== 'alle' && (
              <button onClick={() => setKategorie('alle')} style={{ marginTop: 8, fontFamily: T.sans, fontSize: 11.5, padding: '3px 10px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>✕ Filter lösen</button>
            )}
          </div>
        )}

        {/* Die Liste */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          {!geladen && <div style={{ padding: '30px', textAlign: 'center', color: T.muted, fontSize: 13 }}>lädt …</div>}
          {geladen && !sichtbar.length && (
            <div style={{ padding: '30px 22px', textAlign: 'center', color: T.muted, fontSize: 13 }}>
              {alle.length ? 'Kein Treffer in dieser Auswahl.' : 'Noch keine Buchungen übernommen.'}
            </div>
          )}
          {sichtbar.slice(0, 300).map((b, i) => (
            <div key={b.id} style={{ display: 'flex', gap: 12, padding: '9px 16px', alignItems: 'baseline', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 58, flex: '0 0 auto' }}>{b.datum.slice(8)}.{b.datum.slice(5, 7)}.</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.wer}</div>
                {b.zweck && <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.zweck}</div>}
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 5, padding: '1px 7px', flex: '0 0 auto' }}>{b.kategorie}</span>
              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: b.betrag > 0 ? T.accent : T.inkDim, width: 88, textAlign: 'right', flex: '0 0 auto' }}>
                {b.betrag > 0 ? '+' : '−'}{eur(Math.abs(b.betrag))}
              </span>
            </div>
          ))}
          {sichtbar.length > 300 && <div style={{ padding: '10px 16px', fontFamily: T.mono, fontSize: 11, color: T.muted, borderTop: `1px solid ${T.lineSoft}` }}>+{sichtbar.length - 300} weitere — Monat oder Kategorie wählen</div>}
        </div>

        <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 11, color: T.muted }}>
          Übernommen aus eurem Finanz-Dashboard. Neue Buchungen kommen dort rein und werden hier ergänzt.
        </div>
      </div>
    </div>
  );
}
