'use client';

// ─── Kalender: Jahresansicht (29.09., Paket K2) ─────────────────────────────
// Wie Googles „Jahr“: zwölf Mini-Monate, Montag zuerst. Ein Punkt je Tag mit Terminen (Farbe des ersten Kalenders,
// ab drei Terminen ein kräftigerer Punkt), Feiertage NRW grün, Geburtstage als rosa Punkt — jeweils nur, wenn der
// Kalender eingeblendet ist. Klick auf einen Tag öffnet die Tagesansicht. Kürzel „y“.
//
// Die Termine eines ganzen Jahres kommen VERDICHTET (GET /api/kalender/jahr: je Tag Zähler je Kalender + ganztägige
// Einträge) — die 120-Tage-Grenze von /api/kalender bleibt. Gefiltert wird mit derselben Sicht wie überall (`kalenderAn`).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { monatsblatt } from '@/lib/kalender/layout';
import type { JahrVerdichtet } from '@/lib/kalender/jahr';
import { LEUCHT } from '../ui';
import type { KalenderStand } from './teile';
import { FEIERTAG_FARBE, GEBURTSTAG_FARBE, type QuellTermin } from './quellen';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export type JahrStand = JahrVerdichtet & { jahr: number; kalender: KalenderStand['kalender'] };

/** Das verdichtete Jahr laden. */
export function useJahr(jahr: number): JahrStand | null {
  const [stand, setStand] = useState<JahrStand | null>(null);
  useEffect(() => {
    if (!jahr) return; // 0 = Jahresansicht nicht offen — nichts laden
    let lebt = true;
    fetch(`/api/kalender/jahr?jahr=${jahr}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (lebt && d?.ok) setStand({ jahr: d.jahr, tage: d.tage ?? {}, ganztags: d.ganztags ?? [], kalender: d.kalender ?? [] }); }).catch(() => {});
    return () => { lebt = false; };
  }, [jahr]);
  return stand?.jahr === jahr ? stand : null;
}

export interface JahresTag { termine: number; farbe?: string; feiertag?: string; geburtstage: string[]; ganztags: string[] }

/**
 * Tag → was darauf liegt (rein): Termine der eingeblendeten Kalender, Farbe des ersten Kalenders mit Terminen,
 * ganztägige Titel, Feiertag, Geburtstage.
 */
export function jahresTage(v: JahrVerdichtet | null, quellen: readonly QuellTermin[], kalenderAn: (name: string) => boolean, farbe: (kalender: string) => string): Map<string, JahresTag> {
  const karte = new Map<string, JahresTag>();
  const platz = (tag: string) => { let x = karte.get(tag); if (!x) { x = { termine: 0, geburtstage: [], ganztags: [] }; karte.set(tag, x); } return x; };
  for (const [tag, jeKalender] of Object.entries(v?.tage ?? {})) {
    for (const [k, n] of Object.entries(jeKalender)) { if (!kalenderAn(k) || !n) continue; const p = platz(tag); p.termine += n; p.farbe ??= farbe(k); }
  }
  for (const g of v?.ganztags ?? []) {
    if (!kalenderAn(g.kalender)) continue;
    for (const [tag] of Object.entries(v?.tage ?? {}).filter(([t]) => t >= g.von && t <= g.bis)) platz(tag).ganztags.push(g.titel);
  }
  for (const q of quellen) {
    const p = platz(q.start.slice(0, 10));
    if (q.quelle === 'feiertag') p.feiertag = q.titel; else p.geburtstage.push(q.titel.replace(/^🎂\s*/, ''));
  }
  return karte;
}

export function Jahr({ jahr, heute, daten, quellen, kalenderAn, farbe, onTag }: {
  jahr: number; heute: string;
  /** Das verdichtete Jahr (`useJahr`) — null, solange es lädt. */
  daten: JahrVerdichtet | null;
  /** Feiertage/Geburtstage des Jahres (nur eingeblendete). */
  quellen: readonly QuellTermin[];
  /** Ist der Kalender eingeblendet (Sicht, Schalter)? */
  kalenderAn: (name: string) => boolean;
  farbe: (kalender: string) => string; onTag: (tag: string) => void;
}) {
  const tage = useMemo(() => jahresTage(daten, quellen, kalenderAn, farbe), [daten, quellen, kalenderAn, farbe]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 14, fontFamily: SCHRIFT.text, overflow: 'auto', height: '100%', alignContent: 'start', paddingBottom: 8 }}>
      {MONATE.map((name, i) => {
        const blatt = monatsblatt(jahr, i + 1);
        // Nur so viele Wochen wie nötig (5 oder 6) — die sechste nur, wenn der Monat hineinreicht.
        const wochen = blatt.slice(35).some(t => Number(t.slice(5, 7)) === i + 1) ? 6 : 5;
        return (
          <section key={name} aria-label={`${name} ${jahr}`} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '10px 10px 8px', background: 'rgba(255,255,255,.015)' }}>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
              {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((w, k) => <span key={k} style={{ fontSize: 12, color: C.inkLeise }}>{w}</span>)}
              {blatt.slice(0, wochen * 7).map(tag => {
                const im = Number(tag.slice(5, 7)) === i + 1;
                if (!im) return <span key={tag} />;
                const x = tage.get(tag);
                const h = tag === heute;
                const titel = [x?.feiertag, ...(x?.geburtstage ?? []).map(g => `Geburtstag: ${g}`), ...(x?.ganztags ?? []), x?.termine ? `${x.termine} Termin${x.termine > 1 ? 'e' : ''}` : ''].filter(Boolean).join(' · ');
                return (
                  <button key={tag} type="button" onClick={() => onTag(tag)} title={titel || undefined} aria-label={`${Number(tag.slice(8, 10))}. ${name}${titel ? ` — ${titel}` : ''}`}
                    style={{ position: 'relative', border: 'none', borderRadius: 7, padding: '4px 0 6px', fontSize: 12, cursor: 'pointer', fontFamily: SCHRIFT.text, fontVariantNumeric: 'tabular-nums',
                      background: h ? LEUCHT.puls : x?.feiertag ? `${FEIERTAG_FARBE}29` : 'transparent', color: h ? '#0b0b0c' : x?.feiertag ? FEIERTAG_FARBE : C.ink, fontWeight: h || x?.feiertag ? 700 : 500 }}>
                    {Number(tag.slice(8, 10))}
                    <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 1, display: 'flex', justifyContent: 'center', gap: 2 }}>
                      {!!x?.termine && <span style={{ width: x.termine >= 3 ? 5 : 3.5, height: x.termine >= 3 ? 5 : 3.5, borderRadius: '50%', background: h ? '#0b0b0c' : x.farbe ?? LEUCHT.puls }} />}
                      {!!x?.geburtstage.length && <span style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: GEBURTSTAG_FARBE }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
