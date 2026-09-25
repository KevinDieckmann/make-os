'use client';

// ─── Business-Index — Bausteine der Oberfläche ──────────────────────────────
// Kachel je Kennzahl (Wert, Ampel, woraus gerechnet — oder die Messlücke mit
// „so schließen“) und das Fenster dahinter (Formel, Schwellen, Punkte, Verlauf).

import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Balken, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import type { KennzahlStand, Ampel } from '@/lib/business/index';

export const AMPEL_FARBE: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'gut', gelb: 'beobachten', rot: 'handeln', grau: 'fehlt' };
export const SAEULE_FARBE: Record<string, string> = { fh: LEUCHT.geld, ud: LEUCHT.schlaf, mt: LEUCHT.business };
export const scoreFarbe = (n: number | null) => (n == null ? C.inkLeise : n >= 80 ? LEUCHT.gut : n >= 60 ? LEUCHT.puls : n >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

const z = (n: number, s = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: s });
/** Eine Schwelle in der Einheit der Kennzahl. */
export function schwelle(n: number, e: KennzahlStand['einheit']): string {
  switch (e) {
    case 'eur': return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    case 'prozent': return `${z(n)} %`;
    case 'monate': return `${z(n)} Monate`;
    case 'tage': return `${z(n, 0)} Tage`;
    case 'faktor': return z(n, 2);
    case 'stunden': return `${z(n)} h`;
    case 'anzahl': return z(n);
    case 'punkte': return `${z(n, 0)} Punkte`;
  }
}
export const schwellenText = (k: Pick<KennzahlStand, 'richtung' | 'gruen' | 'rot' | 'einheit'>) =>
  k.richtung === 'hoch' ? `grün ab ${schwelle(k.gruen, k.einheit)} · rot unter ${schwelle(k.rot, k.einheit)}` : `grün bis ${schwelle(k.gruen, k.einheit)} · rot über ${schwelle(k.rot, k.einheit)}`;

export function KennzahlKachel({ k, onOeffnen }: { k: KennzahlStand; onOeffnen: () => void }) {
  const f = AMPEL_FARBE[k.ampel];
  return (
    <button type="button" onClick={onOeffnen} className="fassbar"
      style={{ display: 'grid', gap: 6, alignContent: 'start', textAlign: 'left', minWidth: 0, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text,
        background: k.gemessen ? `color-mix(in srgb, ${f} 7%, ${C.flaecheHoch})` : 'rgba(255,255,255,.025)', border: `1px solid ${k.gemessen ? `${f}33` : 'rgba(255,255,255,.07)'}`, color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.label}</span>
        <span title={AMPEL_TEXT[k.ampel]} style={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: f, boxShadow: k.gemessen ? `0 0 8px ${f}` : undefined }} />
      </div>
      {k.gemessen ? (
        <>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(19px,2.2vw,22px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: k.ampel === 'gruen' ? C.ink : f }}>{k.anzeige}</div>
          <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{k.quelle}</div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 700, color: C.inkLeise }}>—</div>
          <div style={{ fontSize: 12, color: C.inkDim, lineHeight: 1.4 }}>{k.quelle}</div>
          {k.pflegen && <span style={{ fontSize: 12, color: LEUCHT.puls, fontWeight: 600 }}>{k.pflegen.text} ›</span>}
        </>
      )}
    </button>
  );
}

export function KennzahlFenster({ k, saeule, verlauf, onZu }: { k: KennzahlStand; saeule: string; verlauf: { tag: string; wert: number | null }[]; onZu: () => void }) {
  const f = AMPEL_FARBE[k.ampel];
  const mitWert = verlauf.filter(v => v.wert != null);
  const max = Math.max(...mitWert.map(v => Math.abs(v.wert as number)), k.gruen, k.rot, 1);
  const zeile = (t: string, inhalt: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 130px) 1fr', gap: 12, fontSize: TYP.bedien, lineHeight: 1.5 }}>
      <span style={{ color: C.inkLeise }}>{t}</span><span style={{ color: C.ink, minWidth: 0, overflowWrap: 'anywhere' }}>{inhalt}</span>
    </div>
  );
  return (
    <Fenster breit={600} onZu={onZu} titel={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: f }} />{k.label}</span>}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 34, fontWeight: 700, letterSpacing: '-.03em', color: k.gemessen ? C.ink : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{k.anzeige ?? '—'}</span>
        <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: f }}>{AMPEL_TEXT[k.ampel]}</span>
        {k.punkte != null && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{k.punkte} von 100 Punkten</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {zeile('Säule', `${saeule} · ${k.gruppe}`)}
        {zeile('Formel', k.formel)}
        {zeile(k.gemessen ? 'Gerechnet' : 'Es fehlt', k.quelle)}
        {zeile('Schwellen', schwellenText(k))}
        {zeile('Punkte', k.einheit === 'punkte' ? 'Der Wert ist schon ein Score (0–100).' : 'An der roten Schwelle 20, an der grünen 100, dazwischen linear.')}
      </div>
      {mitWert.length > 1 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' }}>Verlauf · {mitWert.length} Tage</span>
          <Balken werte={verlauf.slice(-30).map(v => (v.wert == null ? null : Math.abs(v.wert)))} max={max} farbe={f} hoehe={48} titel={verlauf.slice(-30).map(v => `${v.tag}: ${v.wert == null ? '—' : schwelle(v.wert, k.einheit)}`)} />
        </div>
      )}
      {k.pflegen && (
        <div><Link href={k.pflegen.href} onClick={onZu} className="fassbar" style={{ display: 'inline-flex', textDecoration: 'none', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink }}>{k.pflegen.text} ›</Link></div>
      )}
    </Fenster>
  );
}
