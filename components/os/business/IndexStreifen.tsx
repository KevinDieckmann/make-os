'use client';

// ─── Business-Index auf den Fachseiten (25.09.) ─────────────────────────────
// Kevin: „tiefer verankern“. Zahlen, Markttraktion und Mandate zeigen die
// Kennzahlen des Index, die zu ihnen gehören — dieselbe Zahl wie im Cockpit
// (eine Wahrheit), ein Klick öffnet sie dort mit Formel, Quelle und Verlauf.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../schlank';
import { AMPEL_FARBE, scoreFarbe } from './teile';
import type { BusinessIndex, KennzahlStand } from '@/lib/business/index';
import { WEG } from '@/lib/wege';

/** Welche Kennzahlen eine Fachseite zeigt. */
export const STREIFEN = {
  zahlen: ['liquiditaet', 'runway', 'deckung13', 'ueberfaellig', 'dso', 'kostenquote', 'plan_ist', 'kapitaldienst'],
  markttraktion: ['traktion', 'run_rate', 'pipeline', 'win_rate', 'sales_cycle', 'cac'],
  mandate: ['konzentration', 'churn', 'nrr', 'ueberfaellig', 'dso'],
} as const;

export function IndexStreifen({ ids, titel = 'Business-Index', i = 0 }: { ids: readonly string[]; titel?: string; i?: number }) {
  const [bi, setBi] = useState<BusinessIndex | null>(null);
  const [kein, setKein] = useState(false);
  useEffect(() => {
    fetch('/api/business?scope=gesamt&kompakt=1', { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (d.ok) setBi(d.bi); else setKein(true); }).catch(() => setKein(true));
  }, []);
  if (kein) return null; // kein Zugang (anderer Haushalt) oder nicht erreichbar — die Seite bleibt, wie sie war
  const alle = bi?.saeulen.flatMap(s => s.kennzahlen) ?? [];
  const liste = ids.map(id => alle.find(k => k.id === id)).filter((k): k is KennzahlStand => !!k);
  const farbe = scoreFarbe(bi?.index ?? null);
  return (
    <Karte i={i}>
      <Ueberschrift farbe={farbe} rechts={<Link href={WEG.business()} style={{ color: C.inkLeise, textDecoration: 'none' }}>Cockpit ›</Link>}>
        {titel}{bi?.index != null && <span style={{ color: C.ink, marginLeft: 6, letterSpacing: 0 }}>{bi.index}</span>}{bi && <span style={{ color: C.inkLeise, fontWeight: 600, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>{bi.label}</span>}
      </Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 8 }}>
        {(bi ? liste : ids.map(id => ({ id }))).map((x: KennzahlStand | { id: string }) => {
          // Solange geladen wird: dieselben Kacheln, leer — nichts springt.
          const k = 'label' in x ? (x as KennzahlStand) : null;
          const f = k ? AMPEL_FARBE[k.ampel] : C.inkLeise;
          return (
            <Link key={x.id} href={WEG.business({ k: x.id })} className="fassbar" title={k ? `${k.label}: ${k.quelle}` : undefined}
              style={{ display: 'grid', gap: 3, padding: '9px 11px', borderRadius: 12, textDecoration: 'none', minWidth: 0,
                background: k?.gemessen ? `color-mix(in srgb, ${f} 7%, ${C.flaecheHoch})` : 'rgba(255,255,255,.025)', border: `1px solid ${k?.gemessen ? `${f}33` : 'rgba(255,255,255,.06)'}` }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: f, flex: '0 0 auto' }} />{k ? k.label : '…'}
              </span>
              <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, color: k?.gemessen ? (k.ampel === 'gruen' ? C.ink : f) : C.inkLeise, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {k ? (k.gemessen ? k.anzeige : 'fehlt') : '—'}
              </span>
            </Link>
          );
        })}
      </div>
      {bi && liste.some(k => !k.gemessen) && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>„fehlt“ = Messlücke — im Cockpit steht, wie ihr sie schließt.</div>}
      {bi && liste.some(k => k.ampel === 'rot') && <div style={{ fontSize: 12, color: LEUCHT.kritisch, marginTop: 4 }}>Rot: {liste.filter(k => k.ampel === 'rot').map(k => k.label).join(', ')}</div>}
    </Karte>
  );
}
