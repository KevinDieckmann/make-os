'use client';

// ─── MAKE OS — Kapazität: kleine Bausteine (04.10.) ─────────────────────────
// Machbarkeits-Marke (Chip + Satz) und das Last-Band je Woche. Beide zeichnen nur, gerechnet wird in lib/kapazitaet.
// Das Last-Band dockt unter jeden Strahl an: es bekommt das sichtbare Fenster (von/bis) und legt die Wochen nach
// `lastJeWoche` (Lage 0–1) darunter — dieselbe Breite wie der Strahl, ohne in dessen Dateien zu greifen.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { MACHBAR_LABEL, type Machbarkeit, type MachbarStatus, type KapaStand, type LastStufe } from '@/lib/kapazitaet/typen';
import { lastJeWoche } from '@/lib/kapazitaet/last';
import { Chip, LEUCHT } from '../ui';

export const MACHBAR_FARBE: Record<MachbarStatus, string> = {
  machbar: LEUCHT.gut, eng: LEUCHT.achtung, 'nicht-machbar': LEUCHT.kritisch, ueberfaellig: LEUCHT.kritisch,
  'aufwand-fehlt': C.inkLeise, 'termin-fehlt': C.inkLeise, erledigt: C.inkLeise,
};
export const STUFE_FARBE: Record<LastStufe, string> = { leer: 'rgba(255,255,255,.08)', gut: LEUCHT.gut, eng: LEUCHT.achtung, ueber: LEUCHT.kritisch };
export const STUFE_TEXT: Record<LastStufe, string> = { leer: 'nichts verplant', gut: 'passt', eng: 'eng', ueber: 'Überlast' };

const z = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

/** Chip „machbar / eng / nicht machbar …“ — der Satz dahinter als Titel (oder sichtbar mit `mitText`). */
export function MachbarMarke({ m, mitText }: { m: Pick<Machbarkeit, 'status' | 'text'>; mitText?: boolean }) {
  const farbe = MACHBAR_FARBE[m.status];
  return (
    <span title={m.text} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
      <Chip farbe={farbe}>{MACHBAR_LABEL[m.status]}</Chip>
      {mitText && <span style={{ fontSize: TYP.bedien, color: m.status === 'nicht-machbar' || m.status === 'ueberfaellig' ? LEUCHT.kritisch : C.inkDim, lineHeight: 1.45 }}>{m.text}</span>}
    </span>
  );
}

/**
 * Das Last-Band: je Woche ein dezenter Balken (Höhe = Auslastung bis 120 %), Engpass-Wochen farbig. Unter einen Strahl
 * gelegt bekommt es dessen Fenster; ohne Kapazitäts-Stand oder ohne Wochen im Fenster zeichnet es nichts.
 */
export function LastBand({ stand, von, bis, person, hoehe = 26, beschriftung = true }: { stand: Pick<KapaStand, 'team' | 'personen'> | null; von: string; bis: string; person?: string; hoehe?: number; beschriftung?: boolean }) {
  const wochen = lastJeWoche(stand, { von, bis }, person);
  if (!wochen.length) return null;
  const eng = wochen.filter(w => w.engpass);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div role="img" aria-label={`Last je Woche: ${eng.length ? `${eng.length} Engpass-Woche${eng.length === 1 ? '' : 'n'}, ab ${kurz(eng[0].woche)}` : 'keine Engpässe'}`}
        style={{ position: 'relative', height: hoehe, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {wochen.map(w => {
          const a = w.auslastung == null ? (w.bedarf > 0 ? 1.2 : 0) : Math.min(1.2, w.auslastung);
          const h = w.stufe === 'leer' ? 2 : Math.max(3, Math.round((a / 1.2) * hoehe));
          return (
            <div key={w.woche} title={`Woche ab ${kurz(w.woche)}: ${z(w.bedarf)} h verplant von ${z(w.kapa)} h — ${STUFE_TEXT[w.stufe]}`}
              style={{
                position: 'absolute', bottom: 0, left: `calc(${(w.anteilVon * 100).toFixed(3)}% + 1px)`, width: `calc(${((w.anteilBis - w.anteilVon) * 100).toFixed(3)}% - 2px)`,
                height: h, borderRadius: '3px 3px 0 0', background: w.engpass ? `${STUFE_FARBE[w.stufe]}b3` : 'rgba(255,255,255,.14)',
              }} />
          );
        })}
        {/* 100 %-Linie: bis hierhin passt es */}
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round(hoehe / 1.2), borderTop: '1px dashed rgba(255,255,255,.12)' }} />
      </div>
      {beschriftung && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkLeise }}>
          <span>Last je Woche{person ? '' : ' (Team)'} — gestrichelt = 100 % der belastbaren Zeit</span>
          {eng.length > 0 && <span style={{ color: LEUCHT.achtung }}>{eng.length} Engpass-Woche{eng.length === 1 ? '' : 'n'} · erste ab {kurz(eng[0].woche)}</span>}
        </div>
      )}
    </div>
  );
}
