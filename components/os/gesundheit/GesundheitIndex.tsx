'use client';

// ─── Gesundheits-Index (25.09.) — oben auf der Gesundheitsseite ─────────────
// Erholung & Schlaf 40 % · Bewegung & Aufbau 30 % · Ernährung & Körper 30 %.
// Die gemeinsame Index-Ansicht; persönlich je Person (?fuer= zeigt die andere,
// wenn sie teilt — Schwellen ändert nur die Person selbst).

import { useCallback, useEffect, useState } from 'react';
import { TYP } from '@/lib/make-one/design';
import { Karte, Chip, Ring, Fortschritt, LEUCHT } from '../schlank';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { scoreFarbe } from '../business/teile';
import { IndexAnsicht, type IndexDaten } from '../kennzahlen/IndexAnsicht';

export const GESUNDHEIT_FARBE: Record<string, string> = { er: LEUCHT.schlaf, ba: LEUCHT.gut, ek: LEUCHT.achtung };

interface Antwort extends IndexDaten { ok: boolean; person: string; fehler?: string }

export function GesundheitIndex({ fuer, ich, stand, i0 = 0 }: { fuer?: string | null; ich?: string | null; stand?: unknown; i0?: number }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const q = fuer ? `?fuer=${encodeURIComponent(fuer)}` : '';
  const laden = useCallback(async () => {
    const r = await fetch(`/api/gesundheit/index${q}`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, [q]);
  useEffect(() => { void laden(); }, [laden, stand]);
  if (fehler) return <Karte i={i0}><div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div></Karte>;
  const fremd = !!d && !!ich && d.person !== ich;
  return (
    <IndexAnsicht d={d} name="Gesundheit" chip="Gesundheits-Index" farben={GESUNDHEIT_FARBE} scope="gesundheit" kopfId="index" i0={i0}
      schwelleSenden={schwelle => fremd ? Promise.resolve({ ok: false, fehler: 'Schwellen ändert nur die Person selbst.' }) : fetch('/api/gesundheit/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schwelle }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }))}
      onGespeichert={() => void laden()}
      chips={fremd ? <Chip farbe={LEUCHT.beziehung}>{d!.person.charAt(0).toUpperCase() + d!.person.slice(1)}</Chip> : undefined}
      hinweis="Struktur und Tracking, keine ärztliche Beratung — die Ärzte führen. Punkte: an der roten Schwelle 20, an der grünen 100, dazwischen linear; eine Säule zählt ab 40 % gemessener Kennzahlen. Haut-Tagebuch und Streak zählen nur, wenn sie geführt werden." />
  );
}

/** Die Kurzform oben auf „Heute“: Ring, drei Säulen, ein Klick öffnet den Index. */
export function GesundheitIndexKurz({ fuer, onOeffnen, stand }: { fuer?: string | null; onOeffnen: () => void; stand?: unknown }) {
  const [d, setD] = useState<{ index: number | null; label: string; saeulen: { id: string; label: string; score: number | null }[] } | null>(null);
  const q = fuer ? `?fuer=${encodeURIComponent(fuer)}&kompakt=1` : '?kompakt=1';
  useEffect(() => { fetch(`/api/gesundheit/index${q}`, { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}); }, [q, stand]);
  const farbe = scoreFarbe(d?.index ?? null);
  return (
    <Karte i={0} akzent={farbe}>
      <button type="button" onClick={onOeffnen} className="fassbar" style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
        <Ring groesse="klein" wert={d?.index != null ? String(d.index) : undefined} anteil={d?.index != null ? d.index / 100 : undefined} farbe={farbe} label="" />
        <span style={{ display: 'grid', gap: 6, flex: '1 1 240px', minWidth: 0 }}>
          <span style={{ fontSize: TYP.body, fontWeight: 700, color: C.ink }}>Gesundheits-Index <span style={{ color: C.inkLeise, fontWeight: 500 }}>{d ? d.label : '…'}</span></span>
          {d?.saeulen.map(s => (
            <span key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(60px, 1.4fr) 30px', gap: 10, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <Fortschritt anteil={(s.score ?? 0) / 100} farbe={GESUNDHEIT_FARBE[s.id]} />
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, textAlign: 'right', color: s.score == null ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.score ?? '—'}</span>
            </span>
          ))}
        </span>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien, whiteSpace: 'nowrap' }}>Index öffnen ›</span>
      </button>
    </Karte>
  );
}
