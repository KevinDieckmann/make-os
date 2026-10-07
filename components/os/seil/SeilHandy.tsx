'use client';

// ─── Seil — am Handy ohne Querlauf (07.10.) ────────────────────────────────────────────────────────────────────────────
// Kevin: „Handy: lesbar.“ Je Ziel eine Zeile: Kopf (Ziel → Ziel-Seite, Momentum, Fokus), darunter ein kleines Seil (je Strang eine
// Faser, erledigte vorn und kräftig — lib/lichtfaeden/seil-geometrie.ts `miniSeil`) und die Stränge als Zeilen: Fortschritt als
// gefüllter Balken, Ende, „wartet auf …“. Im Fokus nur dieses Ziel aufgeklappt, mit kritischem Pfad und Engpass. Tippziele ≥ 44 px.

import Link from 'next/link';
import { Lock, Target } from 'lucide-react';
import { FARBE as C, LEUCHT, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { SeilAnsicht, SeilStrang } from '@/lib/lichtfaeden/seil';
import { SEIL_FORM, miniSeil } from '@/lib/lichtfaeden/seil-geometrie';

const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const prozent = (v: number) => `${Math.round(v * 100)} %`;
const MINI = 300;

function StrangZeile({ s }: { s: SeilStrang }) {
  const inhalt = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {s.status === 'blockiert' && <Lock size={12} aria-hidden style={{ flex: '0 0 auto', color: LEUCHT.achtung }} />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: s.status === 'erledigt' ? C.inkLeise : C.ink, textDecoration: s.status === 'erledigt' ? 'line-through' : 'none' }}>{s.titel}</span>
        <span style={{ flex: '0 0 auto', color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{s.ohneDatum ? 'ohne Datum' : kurz(s.bis)}</span>
      </span>
      {/* Fortschritt: gefüllt = erledigt, Kontur = offen; blockiert gestrichelt */}
      <span aria-hidden="true" style={{ display: 'block', height: 6, borderRadius: 4, border: `1px ${s.status === 'blockiert' ? 'dashed' : 'solid'} ${s.status === 'ueberfaellig' ? LEUCHT.achtung : s.farbe}99`, overflow: 'hidden', marginTop: 5 }}>
        <span className="seil-fuellen" style={{ display: 'block', height: '100%', width: `${Math.round(s.fortschritt * 100)}%`, background: s.farbe }} />
      </span>
      {s.grund && <span style={{ display: 'block', marginTop: 4, color: LEUCHT.achtung }}>{s.grund}</span>}
    </>
  );
  const stil = { display: 'block', minHeight: 44, padding: '8px 2px', textDecoration: 'none', color: 'inherit', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, borderBottom: '1px solid rgba(255,255,255,.05)' } as const;
  const label = `${s.titel}: ${prozent(s.fortschritt)}${s.ohneDatum ? '' : `, bis ${kurz(s.bis)}`}${s.grund ? ` — ${s.grund}` : ''}`;
  return s.link ? <Link href={s.link} aria-label={label} style={stil}>{inhalt}</Link> : <div aria-label={label} style={stil}>{inhalt}</div>;
}

export function SeilHandy({ ansicht, fokus, onFokus }: { ansicht: SeilAnsicht; fokus: string | null; onFokus: (id: string | null) => void }) {
  const gruppen = [...ansicht.seile.map(s => ({ s, ids: s.straenge })), ...(ansicht.ohneZiel.length ? [{ s: null, ids: ansicht.ohneZiel }] : [])];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {gruppen.map(({ s, ids }) => {
        const offen = !fokus || fokus === s?.zielId;
        // Unten mündet zuerst — am Handy von oben nach unten in Zeitfolge.
        const l = [...ids].reverse().map(id => ansicht.straenge[id]);
        return (
          <section key={s?.zielId ?? 'ohne'} aria-label={s ? `Ziel ${s.titel}` : 'Ohne Ziel'} style={{ opacity: offen ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
              {s ? (
                <>
                  <Link href={s.link ?? '#'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, color: C.ink, textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, minHeight: 44 }}>
                    <Target size={15} color={s.farbe} aria-hidden style={{ flex: '0 0 auto' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titel}</span>
                  </Link>
                  <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{prozent(s.momentum)}</span>
                  <button type="button" onClick={() => onFokus(fokus === s.zielId ? null : s.zielId)} aria-pressed={fokus === s.zielId} className="fassbar"
                    aria-label={fokus === s.zielId ? `Fokus auf „${s.titel}“ lösen` : `Fokus auf „${s.titel}“`}
                    style={{ minHeight: 44, minWidth: 64, padding: '0 12px', borderRadius: 999, border: `1px solid ${fokus === s.zielId ? s.farbe : 'rgba(255,255,255,.12)'}`, background: fokus === s.zielId ? `${s.farbe}22` : 'transparent', color: fokus === s.zielId ? s.farbe : C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer' }}>
                    {fokus === s.zielId ? 'Fokus ✕' : 'Fokus'}
                  </button>
                </>
              ) : <span style={{ fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, color: C.inkDim }}>Ohne Ziel</span>}
            </div>
            {s && (
              <svg viewBox={`0 0 ${MINI} ${SEIL_FORM.mini.hoehe}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', width: '100%', height: SEIL_FORM.mini.hoehe }}>
                {miniSeil(l.map(x => ({ fertig: x.status === 'erledigt' })), MINI, s.momentum).map((f, i) => (
                  <polyline key={i} points={f.punkte} fill="none" stroke={s.farbe} strokeOpacity={f.fertig ? 0.95 : 0.4} strokeWidth={f.fertig ? 1.8 : 1.1} vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
            )}
            {s && <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '4px 0 2px' }}>{s.fertig} von {s.straenge.length} {s.straenge.length === 1 ? 'Strang' : 'Strängen'} fertig{s.ankerArt === 'frist' ? ` · Frist ${kurz(s.anker)}` : ''}{s.ueberfaellig ? ' (überschritten)' : ''}</div>}
            {offen && (
              <div>
                {fokus === s?.zielId && s?.pfadText && <p style={{ margin: '6px 0', fontSize: TYP.bedien, color: LEUCHT.achtung }}>Kritischer Pfad: {s.pfadText}</p>}
                {fokus === s?.zielId && s?.engpass && <p style={{ margin: '0 0 6px', fontSize: TYP.bedien, color: C.inkDim }}>Engpass: „{s.engpass.titel}“ — {s.engpass.wartende} warten darauf.</p>}
                {l.map(x => <StrangZeile key={x.id} s={x} />)}
                {!l.length && <p style={{ margin: '6px 0', fontSize: TYP.bedien, color: C.inkLeise }}>Noch zahlt kein Strang ein — ein Meilenstein oder eine Karte mit „zahlt ein auf …“ verbindet sich hier.</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
