// ─── Fulfillment · Kunde — die Bilder der Kunden-Wege (12.10., Fulfillment extern, „ein Bild“) ──────────────────────────────────────────────────
// Wert-Balken (vorher → jetzt → Ziel), Lage mit Ampel, Fortschritt — für die Kunden-Seite und die Präsentation „Dem Kunden zeigen“. Die Reise selbst zeichnet
// seit 17.10. dieselbe Zeile wie intern (components/os/ui/reise/ReiseBild.tsx, Modell `kundenReise`; der frühere Phasen-Strahl ist weg). Sie zeichnen
// nur: die Modelle (`kundenReise`, `wertModell`) rechnet lib/fulfillment/kunde/bild.ts, dieselben zeichnen die PDFs (lib/fulfillment/kunde/pdf-bild.ts).
// Farben nur aus den Token (LEUCHT, FARBE, TIEF), Text ≥ 13 px (Beschriftungen in Großbuchstaben 11 px), keine Skripte von außen, kein Bild außer dem Logo.

import type { CSSProperties } from 'react';
import { FARBE as C, TYP, MIKRO, TIEF, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../../ui';
import { ohneUmbruch, wertModell, type KundenAmpel, type KundenLage, type KundenWert } from '@/lib/fulfillment/kunde/bild';

export const KUNDEN_AMPEL_FARBE: Record<KundenAmpel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
/** Die Farbe für „hier stehen wir“ und den erledigten Weg — der Akzent der Instanz (Petrol), ruhig. */
export const WEG_FARBE = C.aktiv;

const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 };

/** Die Lage: Ampel-Punkt, ein Titel, drei Sätze. */
export function LageBlock({ lage, gross }: { lage: KundenLage; gross?: boolean }) {
  const f = KUNDEN_AMPEL_FARBE[lage.ampel];
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, flex: '0 0 auto', background: f, boxShadow: TIEF.schein(f, 14) }} />
        <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: gross ? 28 : TYP.titel, fontWeight: 700, letterSpacing: '-.01em', color: C.ink, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{lage.titel}</h2>
      </div>
      <div style={{ display: 'grid', gap: 4, paddingLeft: 22 }}>
        {lage.saetze.map((s, i) => <p key={i} style={{ margin: 0, fontSize: gross ? 18 : TYP.body, color: i === 0 ? C.ink : C.inkDim, lineHeight: 1.5 }}>{ohneUmbruch(s)}</p>)}
      </div>
    </div>
  );
}

/** Ein Ziel als Balken: Name und Anteil, die Schiene von „vorher“ (links) bis „Ziel“ (rechts), gefüllt bis „jetzt“. Ohne Messung nur die Zeile. */
export function KundenWertBalken({ w, gross }: { w: KundenWert; gross?: boolean }) {
  const m = wertModell(w);
  const f = m.erreicht ? LEUCHT.gut : WEG_FARBE;
  const p = m.anteil != null ? Math.round(m.anteil * 100) : null;
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }} role="group" aria-label={`${w.name}: vorher ${w.vorher}, jetzt ${w.jetzt}, Ziel ${w.ziel}${p != null ? `, ${p} Prozent des Wegs` : ''}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', minWidth: 0 }}>
        <span style={{ fontSize: gross ? 19 : TYP.body, fontWeight: 700, color: C.ink, lineHeight: 1.35, overflowWrap: 'anywhere', minWidth: 0 }}>{w.name}</span>
        {p != null && <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', fontSize: gross ? 26 : TYP.titel, fontWeight: 700, color: f, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{p}{'\u00A0'}%</span>}
      </div>
      {p != null ? (
        <>
          <span aria-hidden style={{ position: 'relative', display: 'block', height: gross ? 12 : 10, borderRadius: 6, background: 'rgba(255,255,255,.08)' }}>
            <span style={{ position: 'absolute', inset: 0, width: `${Math.max(p, 3)}%`, borderRadius: 6, background: TIEF.verlauf(f) }} />
            <span style={{ position: 'absolute', left: `calc(${Math.max(p, 3)}% - 8px)`, top: -3, width: 16, height: (gross ? 12 : 10) + 6, borderRadius: 8, background: f, boxShadow: TIEF.schein(f, 12) }} />
          </span>
          <div className="kunde-wert-achse" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', ...klein, fontSize: gross ? 15 : TYP.bedien }}>
            <span>vorher <b style={{ color: C.inkDim }}>{w.vorher}</b></span>
            <span style={{ color: C.ink }}>jetzt <b style={{ color: f }}>{w.jetzt}</b></span>
            <span>Ziel <b style={{ color: C.inkDim }}>{w.ziel}</b>{w.bis ? ` · bis ${w.bis}` : ''}</span>
          </div>
        </>
      ) : m.leer ? (
        // Abnahme A3: ein Ziel ohne Werte nicht als „vorher — → jetzt — → Ziel —“, sondern als ruhiger Satz.
        <div style={{ ...klein, fontSize: gross ? 15 : TYP.bedien }}>{m.zeile}</div>
      ) : (
        <div style={{ ...klein, fontSize: gross ? 15 : TYP.bedien }}>vorher <b style={{ color: C.inkDim }}>{w.vorher}</b> → jetzt <b style={{ color: C.ink }}>{w.jetzt}</b> → Ziel <b style={{ color: C.inkDim }}>{w.ziel}</b>{w.bis ? ` (bis ${w.bis})` : ''}</div>
      )}
    </div>
  );
}

/** Fortschritt als große Zahl mit einer Zeile darunter (Präsentation und Kopf der Lage). */
export function FortschrittZahl({ prozent, gross }: { prozent: number; gross?: boolean }) {
  return (
    <div role="img" style={{ display: 'grid', gap: 2, justifyItems: 'end', flex: '0 0 auto' }} aria-label={`${prozent} Prozent des Weges geschafft`}>
      <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', fontSize: gross ? 52 : 34, fontWeight: 700, color: C.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>{prozent}<span style={{ fontSize: gross ? 24 : 18, color: C.inkDim }}>{'\u00A0'}%</span></span>
      <span style={{ ...MIKRO }}>des Weges geschafft</span>
    </div>
  );
}
