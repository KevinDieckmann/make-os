'use client';

// ─── Kreislauf sehen — die Zeitleiste in der Mandatsakte (30.10., Kreislauf Geld & Lieferung Paket 5) ──────────────────────────────────────────────
// Oben ein Satz „wo steht es, was kommt als Nächstes“, darunter die Stationen Angebot → Mandat → Raten bzw. Monatsrechnungen → Fulfillment, verbunden vom
// Lichtfaden (FlowLinie — hell bis „hier“, dahinter gedämpft). Gerechnet wird NUR in lib/crm/kunden-zeitleiste.ts; die Daten kommen aus den vorhandenen
// Lesewegen: CRM-Bestand (Angebote), GET /api/rechnung (serverseitig nach der Sicht des Kontos gefiltert — derselbe Abruf wie „Rechnungen“ darunter,
// der Anfrage-Bündler teilt ihn) und die Leistungstreppe (Phase des Falls). Links nur über WEG (aus der Rechnung).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE, type Bedeutung } from '@/lib/make-one/design';
import { FlowLinie } from '../ui';
import { localDay } from '@/lib/zeit';
import { rechnungPasst } from '@/lib/crm/kunden';
import { kundenZeitleiste, type ZeitleistenStand } from '@/lib/crm/kunden-zeitleiste';
import type { Angebot, Mandat } from '@/lib/crm/typen';
import type { FlowFaden } from '@/lib/lichtfaeden/flow';
import { useTreppe } from '../mandate/treppe/daten';

/** Ausschnitt einer Zeile aus GET /api/rechnung — nur, was die Zeitleiste braucht. */
interface RechnungKurz { id: string; status: 'geplant' | 'gestellt' | 'bezahlt' | 'storniert'; kunde: string; faellig?: string; bezahltAm?: string; leistungVon?: string; art?: 'rechnung' | 'storno' | 'mahnung'; angebotId?: string; mandatId?: string; positionen?: { id: string }[] }

const BEDEUTUNG: Record<ZeitleistenStand, Bedeutung> = { erledigt: 'gut', jetzt: 'info', offen: 'neutral', achtung: 'achtung', kritisch: 'kritisch' };

/** Den Faden durch die Punkte messen (Mitte jedes Punkts), hell bis zum Punkt „hier“. */
function messenFuer(hier: number, n: number) {
  return (eltern: HTMLElement, leinwand: DOMRect): FlowFaden[] => {
    const punkte = Array.from(eltern.querySelectorAll<HTMLElement>('[data-zl-punkt]')).map(el => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - leinwand.left, r.top + r.height / 2 - leinwand.top] as const;
    });
    if (punkte.length < 2) return [];
    return [{ id: 'zeitleiste', punkte, farbe: C.aktiv, staerke: 'fein', bisHier: n > 1 && hier >= 0 ? hier / (n - 1) : 1, hier: hier >= 0, frans: true }];
  };
}

export function MandatZeitleiste({ m, angebote }: { m: Mandat; angebote?: readonly Angebot[] }) {
  const treppe = useTreppe();
  const [rechnungen, setRechnungen] = useState<RechnungKurz[] | null>(null);
  const heute = localDay();
  useEffect(() => {
    let lebt = true;
    fetch('/api/rechnung').then(async r => {
      if (!lebt) return;
      const d = r.ok ? await r.json().catch(() => null) as { rechnungen?: RechnungKurz[] } | null : null;
      setRechnungen(d?.rechnungen ?? []);
    }).catch(() => { if (lebt) setRechnungen([]); });
    return () => { lebt = false; };
  }, [m.id]);
  const fall = treppe.lage?.kunden.find(k => k.mandatId === m.id)?.fall ?? null;
  const zl = useMemo(() => {
    const eigene = (rechnungen ?? []).filter(r => r.mandatId === m.id || (!r.mandatId && rechnungPasst(m, r)));
    return kundenZeitleiste({ mandat: m, angebote: angebote ?? [], rechnungen: eigene as Parameters<typeof kundenZeitleiste>[0]['rechnungen'], fall: fall ? { ...(fall.phase ? { phase: fall.phase } : {}), ...(fall.phaseNr ? { phaseNr: fall.phaseNr } : {}), ...(fall.phasenAnzahl ? { phasenAnzahl: fall.phasenAnzahl } : {}) } : null, heute });
  }, [m, angebote, rechnungen, fall, heute]);
  const messen = useMemo(() => messenFuer(zl.hier, zl.punkte.length), [zl.hier, zl.punkte.length]);
  if (rechnungen === null) return null;
  return (
    <section aria-label="Zeitleiste des Kunden" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <span style={{ ...MIKRO, color: C.inkLeise }}>Kreislauf</span>
      <p style={{ margin: 0, fontSize: TYP.body, color: C.ink, lineHeight: 1.45 }}>{zl.satz}</p>
      <ol className="zl-weg" style={{ position: 'relative', listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {zl.punkte.map((p, i) => {
          const farbe = BEDEUTUNG_FARBE[BEDEUTUNG[p.stand]];
          const inhalt = (
            <span style={{ display: 'grid', gap: 2, justifyItems: 'start', minWidth: 0 }}>
              <span data-zl-punkt="" aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: p.stand === 'offen' ? 'transparent' : farbe, border: `2px solid ${farbe}`, boxShadow: i === zl.hier ? `0 0 0 4px ${farbe}33` : undefined }} />
              <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{p.titel}</span>
              <span style={{ fontSize: TYP.bedien, color: p.stand === 'kritisch' || p.stand === 'achtung' ? farbe : C.inkDim, lineHeight: 1.35 }}>{p.text}</span>
            </span>
          );
          return (
            <li key={p.id} aria-current={i === zl.hier ? 'step' : undefined} style={{ flex: '1 1 140px', minWidth: 120, maxWidth: 220 }}>
              {p.href ? <Link href={p.href} style={{ display: 'block', minHeight: 44, textDecoration: 'none', color: 'inherit' }}>{inhalt}</Link> : inhalt}
            </li>
          );
        })}
        <FlowLinie messen={messen} />
      </ol>
    </section>
  );
}
