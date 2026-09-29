'use client';

// ─── Anlässe der nächsten Tage (29.09., Paket K2) ───────────────────────────
// Eine ruhige Zeile für Heute (und jede andere Seite): Feiertag NRW heute/morgen und Geburtstage der nächsten sieben
// Tage („Malin hat morgen Geburtstag“). Daten nur über GET /api/kalender/quellen (Feiertage aus dem Kalender-Kern,
// Geburtstage über `geburtstageIm` — Familie + CRM, ohne Art.-18-Kontakte). Ein Klick öffnet Person/Kontaktakte.
// Nichts da → nichts gezeigt.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { FEIERTAG_FARBE } from '@/lib/kalender/quellen-feiertage';
import { GEBURTSTAG_FARBE, type Geburtstag } from '@/lib/kalender/geburtstag';

interface Stand { feiertage: { tag: string; name: string }[]; geburtstage: Geburtstag[]; heute: string }

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const wannText = (tag: string, heute: string): string => (tag === heute ? 'heute' : tag === tagPlus(heute, 1) ? 'morgen' : `${WD[new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}.`);

/** Rein darstellend (Render-Test): die Pillen für Feiertage und Geburtstage. */
export function AnlaesseZeile({ feiertage, geburtstage, heute }: Stand) {
  if (!feiertage.length && !geburtstage.length) return null;
  const pille = (farbe: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: TYP.bedien, fontWeight: 600, color: farbe, background: `${farbe}1c`, textDecoration: 'none', fontFamily: SCHRIFT.text });
  return (
    <div aria-label="Anlässe" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '-4px 0 14px' }}>
      {feiertage.map(f => <span key={f.tag} style={pille(FEIERTAG_FARBE)} title="Gesetzlicher Feiertag in NRW">{wannText(f.tag, heute)}: {f.name}</span>)}
      {geburtstage.map(g => (
        <Link key={g.id} href={g.href} style={pille(GEBURTSTAG_FARBE)} title={g.herkunft === 'crm' ? 'Kontaktakte öffnen' : 'Person öffnen'}>
          🎂 {g.name} hat {wannText(g.tag, heute)} Geburtstag{g.alter !== undefined && g.alter > 0 ? ` (wird ${g.alter})` : ''}
        </Link>
      ))}
      <span style={{ fontSize: 12, color: C.inkLeise }}>nächste 7 Tage</span>
    </div>
  );
}

/**
 * `geburtstage={false}` (Heute, F2 M2): nur Feiertage — Geburtstage stehen auf Heute an EINER Stelle, in „Steht an“
 * (mit Geschenk-Vorlauf). Andere Seiten zeigen beide.
 */
export function Anlaesse({ tage = 7, geburtstage = true }: { tage?: number; geburtstage?: boolean }) {
  const [stand, setStand] = useState<Stand | null>(null);
  useEffect(() => {
    const heute = localDay();
    fetch(`/api/kalender/quellen?von=${heute}&bis=${tagPlus(heute, tage + 1)}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (d?.ok) setStand({ heute, feiertage: (d.feiertage ?? []).filter((f: { tag: string }) => f.tag <= tagPlus(heute, 1)), geburtstage: geburtstage ? d.geburtstage ?? [] : [] }); }).catch(() => {});
  }, [tage, geburtstage]);
  return stand ? <AnlaesseZeile {...stand} /> : null;
}
