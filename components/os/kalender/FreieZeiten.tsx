'use client';

// ─── Kalender — Liste „Freie Zeiten“ (29.09., Paket K4) ─────────────────────
// Vorschläge aus /api/kalender/frei, nach Tagen gruppiert. Klick legt einen Termin VOR (öffnet den Anlege-Dialog
// vorbelegt) — angelegt wird erst dort. Feiertage NRW (aus K1 `verfuegbarkeitFuer`) stehen als Hinweis darüber.

import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { vorschlagText, type FreieZeit } from '@/lib/kalender/verfuegbar';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const tagKopf = (tag: string) => `${WD[new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

export function FreieZeiten({ vorschlaege, onWahl, jeTag = 4, feiertage = {} }: { vorschlaege: FreieZeit[]; onWahl: (f: FreieZeit) => void; jeTag?: number; feiertage?: Record<string, string> }) {
  const tage = new Map<string, FreieZeit[]>();
  for (const f of vorschlaege) tage.set(f.tag, [...(tage.get(f.tag) ?? []), f]);
  const frei = Object.entries(feiertage);
  const hinweis = frei.length ? <div style={{ fontSize: 11.5, color: LEUCHT.achtung }}>Feiertage (NRW): {frei.map(([t, n]) => `${tagKopf(t)} ${n}`).join(' · ')}</div> : null;
  if (!tage.size) return <div style={{ display: 'grid', gap: 6 }}><div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine gemeinsame Lücke in den nächsten Tagen — kürzere Dauer oder weniger Puffer versuchen.</div>{hinweis}</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {hinweis}
      {Array.from(tage.entries()).map(([tag, l]) => (
        <div key={tag} style={{ display: 'grid', gap: 5 }}>
          <div style={{ fontSize: 11.5, color: C.inkLeise, fontWeight: 600 }}>{tagKopf(tag)}{l[0].feiertag && <span style={{ color: LEUCHT.achtung, marginLeft: 6 }}>· {l[0].feiertag}</span>}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {l.slice(0, jeTag).map(f => (
              <button key={f.start} onClick={() => onWahl(f)} title={`${vorschlagText(f)} — Termin vorlegen`} className="fassbar"
                style={{ border: `1px solid ${LEUCHT.puls}55`, background: `${LEUCHT.puls}14`, color: C.ink, borderRadius: 8, padding: '4px 9px', fontSize: 12, cursor: 'pointer', fontFamily: SCHRIFT.text, fontVariantNumeric: 'tabular-nums' }}>
                {f.start.slice(11, 16)}
              </button>
            ))}
            {l.length > jeTag && <span style={{ fontSize: 11.5, color: C.inkLeise, alignSelf: 'center' }}>+{l.length - jeTag}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
