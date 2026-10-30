'use client';

// ─── Kreislauf sehen — „Heute von selbst erledigt“ bei „Automationen & Head“ (30.10., Kreislauf Geld & Lieferung Paket 5) ─────────────────────────────
// Nur Zähler mit Link: Mandate aus angenommenen Angeboten, Rechnungsentwürfe des Morgenlaufs, Mahnaufgaben angelegt/geschlossen, Fälle zum Mandatsende,
// Werkstatt-Läufe (scharf) und Probeläufe getrennt; ist ein Teil in die Werkstatt überführt, steht „ersetzt durch <Prozess>“ daneben. Daten: GET
// /api/prozesse/laeufe?kreislauf=1 (Tor der Werkstatt — nur Business, serverseitig gerechnet in lib/prozesse/kreislauf-heute-server.ts).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift } from '../ui';
import type { KreislaufHeuteZeile } from '@/lib/prozesse/kreislauf-heute';

export const KREISLAUF_HEUTE_QUELLE = '/api/prozesse/laeufe?kreislauf=1&space=business';
const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;

/** Die Ansicht ohne Abruf (Tests rendern sie mit Beispieldaten). `null` = lädt bzw. nicht erreichbar → nichts. */
export function KreislaufHeuteAnsicht({ zeilen }: { zeilen: readonly KreislaufHeuteZeile[] | null }) {
  if (!zeilen) return null;
  return (
    <Karte flach>
      <Ueberschrift>Heute von selbst erledigt</Ueberschrift>
      {!zeilen.length && <p style={klein}>Heute hat der Kreislauf noch nichts von selbst getan.</p>}
      {zeilen.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {zeilen.map(z => (
            <li key={z.art} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <Sparkles size={15} aria-hidden color={C.inkDim} />
              <Link href={z.href} style={{ fontSize: TYP.body, color: C.ink, textDecoration: 'none' }}>{z.text} ›</Link>
              {z.ersetzt && <Link href={z.ersetzt.href} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>ersetzt durch {z.ersetzt.titel} ›</Link>}
            </li>
          ))}
        </ul>
      )}
    </Karte>
  );
}

export function KreislaufHeute() {
  const [zeilen, setZeilen] = useState<KreislaufHeuteZeile[] | null>(null);
  useEffect(() => {
    let an = true;
    fetch(KREISLAUF_HEUTE_QUELLE, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { ok?: boolean; kreislauf?: KreislaufHeuteZeile[] } | null) => { if (an && j?.ok && Array.isArray(j.kreislauf)) setZeilen(j.kreislauf); });
    return () => { an = false; };
  }, []);
  return <KreislaufHeuteAnsicht zeilen={zeilen} />;
}
