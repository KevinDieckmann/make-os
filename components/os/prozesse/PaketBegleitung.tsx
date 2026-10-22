'use client';

// ─── Prozesse · Werkstatt — Begleit-Prozesse am Paket (22.10., B3 „eine Fläche“; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ─────────────────────────────
// Unter der Fläche des Pakets: die Begleit-Prozesse, die daran andocken (vom Server: lib/prozesse/begleitung/andocken.ts `begleitFuer` — über die Bedingungen ihres
// Auslösers, kein zweites Feld), als Kacheln mit gestricheltem Faden — je Kachel der Auslöser, ob nur dieses Paket oder alle, und wo sie andocken (ein Tipp zeigt den
// Schritt bzw. die Phase auf der Fläche). Ein Tipp auf den Titel öffnet den Prozess in der Werkstatt. „+ Begleit-Prozess“ öffnet die Galerie
// „Fulfillment · Kunden-Begleitung“ vorbelegt mit diesem Paket (und dem gewählten Schritt bzw. der Phase) — übernommen wird über den EINEN Weg `aus-vorlage`
// (Andocken prüft die Route). Rechnet nichts, schreibt nichts außer über die Galerie.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Chip, Knopf } from '../ui';
import { WEG } from '@/lib/wege';
import type { BegleitAndock } from '@/lib/prozesse/begleitung/andocken';
import type { ProzessStatus } from '@/lib/prozesse/definition';
import { VorlagenGalerie } from './VorlagenGalerie';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const STATUS_NAME: Readonly<Record<ProzessStatus, string>> = { entwurf: 'Entwurf', probelauf: 'Probelauf', aktiv: 'aktiv', pausiert: 'pausiert', archiviert: 'archiviert' };

export function PaketBegleitung({ paketId, begleitung, titelVon, onZeigen, ziel, darf }: {
  paketId: string; begleitung: readonly BegleitAndock[];
  /** Titel eines Schritts bzw. einer Phase des Pakets (null = gibt es nicht mehr). */
  titelVon: (knotenId: string) => string | null;
  /** Den Schritt bzw. die Phase auf der Fläche zeigen. */
  onZeigen: (knotenId: string) => void;
  /** Gewählter Schritt bzw. Phase — „+ Begleit-Prozess“ dockt dort an. */
  ziel: string | null;
  /** Darf Prozesse aus Vorlagen anlegen (Werkstatt-Recht „Entwurf“). */
  darf: boolean;
}) {
  const router = useRouter();
  const [galerie, setGalerie] = useState(false);
  const zielTitel = ziel ? titelVon(ziel) : null;
  return (
    <section className="pw-begleitung" aria-label="Begleit-Prozesse am Paket" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ ...MIKRO }}>{`Begleitung · ${begleitung.length}`}</span>
        {darf && <Knopf leise onClick={() => setGalerie(true)} titel="Einen Begleit-Prozess aus der Galerie „Fulfillment · Kunden-Begleitung“ an dieses Paket andocken">
          {zielTitel ? `+ Begleit-Prozess an „${zielTitel}“` : '+ Begleit-Prozess'}
        </Knopf>}
      </div>
      {!begleitung.length && <p style={klein}>Noch kein Begleit-Prozess — Erinnerungen und vorgefertigte Nachrichten neben dem Fall kommen aus der Galerie „Kunden-Begleitung“.</p>}
      {begleitung.length > 0 && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {begleitung.map(b => {
            const an = b.knoten ? titelVon(b.knoten) : null;
            return (
              <div key={b.prozessId} className="pw-begleit-kachel" style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 12, border: `1px dashed ${C.aktiv}88`, background: C.flaeche }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Link href={WEG.prozesse({ p: b.prozessId, ansicht: 'werkstatt' })} style={{ color: C.ink, fontWeight: 600, fontSize: TYP.bedien }}>{b.titel}</Link>
                  <Chip farbe={b.status === 'aktiv' ? C.aktiv : C.inkDim}>{STATUS_NAME[b.status]}</Chip>
                </span>
                <span style={klein}>{b.ausloeser}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...klein }}>
                  <Link2 size={13} aria-hidden color={C.aktiv} />
                  {b.paket === 'alle' ? 'hört auf jedes Paket'
                    : b.knoten && an ? <button type="button" onClick={() => onZeigen(b.knoten!)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{`an „${an}“`}</button>
                      : b.knoten ? 'an einem Schritt, den es nicht mehr gibt' : 'am ganzen Paket'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {galerie && (
        <VorlagenGalerie gruppe="begleitung" andocken={{ paket: paketId, ...(ziel ? { knoten: ziel } : {}), text: zielTitel ? `dieses Paket, an „${zielTitel}“` : 'dieses Paket' }}
          onZu={() => setGalerie(false)}
          onAngelegt={id => { setGalerie(false); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' }), { scroll: false }); }} />
      )}
    </section>
  );
}
