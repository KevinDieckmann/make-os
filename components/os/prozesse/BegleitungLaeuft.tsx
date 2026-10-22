'use client';

// ─── Prozesse · Kunden-Begleitung — Karte „Begleitung läuft“ in der Akte des Fulfillment-Falls (22.10., B3; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ─────
// Die Läufe der Werkstatt mit Fall = dieses Mandat (Begleit-Prozesse neben dem Fall): Titel, Probelauf/scharf, Status, worauf er wartet, Sprung in die Läufe der
// Werkstatt. Gelesen nur über den vorhandenen Läufe-Leser (GET /api/prozesse/laeufe?fall=mandat:<id>&space=business — serverseitig nur Business; in der Sicht
// Privat 403, dann zeigt die Karte nichts). Rechnet nichts (lib/prozesse/laeufe-ansicht.ts), schreibt nie; ohne Läufe erscheint sie nicht.

import Link from 'next/link';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip } from '../ui';
import { WEG } from '@/lib/wege';
import { EREIGNIS_NAME } from '@/lib/ereignisse/arten';
import { LAUF_STATUS_BEDEUTUNG, LAUF_STATUS_NAME, wartetSatz, zeitText } from '@/lib/prozesse/laeufe-ansicht';
import type { SkillEreignis } from '@/lib/prozesse/definition';
import { useFallLaeufe } from './laeufe-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const ereignisName = (e: string) => EREIGNIS_NAME[e as SkillEreignis] ?? e;

export function BegleitungLaeuft({ mandatId }: { mandatId: string }) {
  const d = useFallLaeufe('mandat', mandatId);
  if (!d || !d.laeufe.length) return null;
  const offen = d.laeufe.filter(l => l.status === 'laeuft' || l.status === 'wartet' || l.status === 'angehalten' || l.status === 'fehler').length;
  return (
    <Karte i={2} id="ff-begleitung">
      <Ueberschrift rechts={<span>{offen ? `${offen} offen` : 'nichts offen'}</span>}>Begleitung läuft</Ueberschrift>
      <p style={klein}>Begleit-Prozesse der Werkstatt neben diesem Fall — sie erinnern und bereiten Nachrichten vor; nach außen geht nichts ohne Freigabe.</p>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {d.laeufe.map(l => {
          const satz = l.status === 'wartet' ? wartetSatz(l.wartet, ereignisName) : null;
          return (
            <div key={l.id} style={{ display: 'grid', gap: 2, paddingLeft: 10, borderLeft: `2px dashed ${C.aktiv}66` }}>
              <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Link href={WEG.prozesse({ p: l.prozessId, ansicht: 'werkstatt', w: 'laeufe', lauf: l.id })} style={{ color: C.ink, fontWeight: 600, fontSize: TYP.bedien }}>{l.titel}</Link>
                <Chip farbe={BEDEUTUNG_FARBE[LAUF_STATUS_BEDEUTUNG[l.status]]}>{LAUF_STATUS_NAME[l.status]}</Chip>
                {l.modus === 'schatten' && <Chip farbe={C.inkDim}>Probelauf</Chip>}
              </span>
              <span style={klein}>{[satz, `seit ${zeitText(l.start)}`].filter(Boolean).join(' · ')}</span>
            </div>
          );
        })}
        {d.weitere > 0 && <span style={{ ...MIKRO }}>{`+ ${d.weitere} weitere in der Werkstatt`}</span>}
      </div>
    </Karte>
  );
}
