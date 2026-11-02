'use client';

// ─── Unternehmen › Steckbrief › Karte „Darlehen“ (02.11.) ───────────────────────────────────────────────────────────
// Darlehen der Finanzplanung, an denen diese Gesellschaft Geber oder Nehmer ist: Restschuld heute, nächste Rate, Link zum Vertrag.
// Der Server filtert (GET /api/vertraege?darlehen=<gesellschaft>, Rechte und Sicht der Finanzplanung) — eine private Gegenseite heißt nur „Privat“.
// Ohne Darlehen (oder ohne Zugang) zeigt die Karte nichts.

import { useEffect, useState } from 'react';
import { Karte, Ueberschrift, Knopf, Zeile } from '../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { vertragLink } from '@/lib/crm/adresse';
import { betragDeutsch } from '@/lib/finanzen/darlehen-plan';
import type { DarlehenKarteZeile } from '@/lib/vertraege/finanzen';

export function DarlehenKarte({ gesellschaft }: { gesellschaft: string }) {
  const [zeilen, setZeilen] = useState<DarlehenKarteZeile[] | null>(null);
  useEffect(() => {
    let weg = false;
    fetch(`/api/vertraege?darlehen=${encodeURIComponent(gesellschaft)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(d => { if (!weg) setZeilen(d?.ok ? d.darlehen ?? [] : []); })
      .catch(() => { if (!weg) setZeilen([]); });
    return () => { weg = true; };
  }, [gesellschaft]);
  if (!zeilen?.length) return null;
  return (
    <Karte>
      <Ueberschrift>Darlehen</Ueberschrift>
      {zeilen.map(z => (
        <Zeile key={z.id} titel={z.name}
          unter={`${z.rolle === 'nehmer' ? 'von' : 'an'} ${z.gegenseite} · Restschuld ${betragDeutsch(z.restschuld)} €${z.naechste ? ` · nächste Rate ${z.naechste.monat}: ${betragDeutsch(z.naechste.betrag)} €` : ''}`}
          rechts={z.vertragId ? <Knopf leise href={vertragLink({ vertragId: z.vertragId })}>Vertrag</Knopf> : undefined} />
      ))}
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 6 }}>Aus der Finanzplanung — Raten und Restschuld rechnet sie aus dem Vertrag.</div>
    </Karte>
  );
}
