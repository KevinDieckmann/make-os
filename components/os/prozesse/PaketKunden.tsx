'use client';

// ─── Prozesse · Werkstatt — laufende Kunden eines Pakets: die neue Fassung je Kunde übernehmen (22.10., Fulfillment in die Werkstatt E3, Entscheidung F2) ────────
// Eine neue Fassung erreicht einen laufenden Fall NUR per Klick je Kunde — über den VORHANDENEN Weg des Fulfillments (POST /api/fulfillment/fall
// `vorlage-uebernehmen`: hinzufügen und ändern, nie entfernen; Zusatzmodul ebenso). Die Vorschau „was sich ändert“ ist dieselbe wie im Fall (`diffVorschau`).
// Rechnet nichts; die Liste kommt vom Server (GET /api/prozesse/werkstatt?paket= → `kunden`).

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Hinweis, Knopf } from '../ui';
import { WEG } from '@/lib/wege';
import type { LaufenderKunde } from '@/lib/prozesse/fulfillment-modus-server';

const klein = { ...MIKRO, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien } as const;

export function PaketKunden({ kunden, paketId, fassung, darf, onNeu }: { kunden: readonly LaufenderKunde[]; paketId: string; fassung: number; darf: boolean; onNeu: () => void | Promise<unknown> }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const offen = kunden.filter(k => k.aenderung);
  if (!offen.length) return null;
  const uebernehmen = async (k: LaufenderKunde) => {
    setFehler(null);
    const r = await fetch('/api/fulfillment/fall', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'vorlage-uebernehmen', mandatId: k.mandatId, ...(k.art === 'zusatz' ? { vorlageId: paketId } : {}) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) as { ok?: boolean; fehler?: string } | null : null;
    if (!r?.ok || !j?.ok) { setFehler(String(j?.fehler ?? 'Nicht übernommen.')); return; }
    await onNeu();
  };
  return (
    <Hinweis art="info" titel={`${offen.length === 1 ? '1 laufender Kunde' : `${offen.length} laufende Kunden`} — Änderung je Kunde übernehmen`}>
      <span style={{ display: 'block', marginBottom: 8 }}>{`Fassung ${fassung} ist veröffentlicht. Laufende Fälle bleiben, wie sie sind, bis ihr die Änderung je Kunde übernehmt — hinzugefügt und geändert wird, entfernt nie.`}</span>
      {fehler && <span style={{ display: 'block', color: C.kritisch, marginBottom: 8 }}>{fehler}</span>}
      <div style={{ display: 'grid', gap: 10 }}>
        {offen.map(k => (
          <div key={`${k.mandatId}:${k.art}`} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Link href={WEG.fall(k.mandatId)} style={{ color: C.ink, fontWeight: 600, fontSize: TYP.bedien }}>{k.kunde}</Link>
              <span style={klein}>{`${k.titel}${k.art === 'zusatz' ? ' · Zusatzmodul' : ''} · Fassung ${k.fassung} → ${fassung}`}</span>
              {darf && <Knopf leise onClick={() => uebernehmen(k)}>Übernehmen</Knopf>}
            </div>
            {(k.aenderung ?? []).map(a => <span key={a.titel} style={klein}>{`${a.titel}: ${a.zeilen.slice(0, 4).join(' · ')}${a.zeilen.length > 4 ? ` · +${a.zeilen.length - 4}` : ''}`}</span>)}
          </div>
        ))}
      </div>
    </Hinweis>
  );
}
