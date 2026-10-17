'use client';

// ─── Fulfillment · Einhänger im Produkt-Detail (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 7.1) ─────────────────────────────────────────
// „Fulfillment: <Paket-Vorlage> ›“ — welches Paket der Bibliothek ein neuer Fall dieses Produkts bekommt. Ändern = Einzel-Op `zuordnung` (PATCH
// /api/fulfillment). Ohne Fulfillment-Zugang (z. B. Business-Konto ohne Modul) liefert die Route 403 → der Einhänger zeigt nichts, das
// Produkt-Detail bleibt so, wie es heute ist.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Erklaert, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { useUebersichtKurz, vorlagenOps, fehlerText } from './daten';

export function ProduktFulfillmentZeile({ leistungId }: { leistungId: string }) {
  const { daten } = useUebersichtKurz();
  const [fehler, setFehler] = useState<string | null>(null);
  if (!daten) return null;
  const pakete = daten.prozesse.filter(p => p.art === 'paket');
  const vorlageId = daten.zuordnung[leistungId]?.vorlageId ?? null;
  const vorlage = pakete.find(p => p.id === vorlageId);
  const setze = async (id: string | null) => {
    const a = await vorlagenOps([{ op: 'zuordnung', leistungId, vorlageId: id }]);
    setFehler(a.ok ? null : fehlerText(a));
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
        <span>Fulfillment:</span>
        {vorlage ? <Link href={WEG.fulfillment('prozesse', { k: vorlage.id })} style={{ color: C.aktiv }}>{vorlage.titel} ›</Link> : <span style={{ color: C.inkLeise }}>kein Paket zugeordnet</span>}
        {pakete.length > 0 && (
          <Erklaert erklaerung="fulfillment.zuordnung" name="Paket für neue Fälle">
            <Wahl label="Paket" klein liste={pakete.map(p => ({ id: p.id, label: p.titel }))} wert={vorlageId} onWahl={id => void setze(id)} onLeeren={() => void setze(null)} leerenLabel="ohne Paket" />
          </Erklaert>
        )}
        {!pakete.length && <Link href={WEG.fulfillment('prozesse')} style={{ color: C.aktiv }}>Abläufe anlegen ›</Link>}
      </div>
      {fehler && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div>}
    </div>
  );
}
