'use client';

// ─── System › Datenschutz · Selbstprüfung (05.10.) ──────────────────────────
// Aus den echten Beständen gerechnet (GET /api/datenschutz/pruefung), nicht abgehakt — jede offene Prüfung mit Weg zum Beheben.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, Punkt, LEUCHT } from '../ui';
import type { Pruefpunkt } from '@/lib/crm/datenschutz';

const P_FARBE = { erfuellt: LEUCHT.gut, teilweise: LEUCHT.achtung, offen: LEUCHT.kritisch } as const;

export function PruefungKarte({ stand, i = 2 }: { /** Wechselt nach jeder Änderung in der Einrichtung → neu rechnen. */ stand: number; i?: number }) {
  const [p, setP] = useState<Pruefpunkt[] | null>(null);
  useEffect(() => {
    let lebt = true;
    void fetch('/api/datenschutz/pruefung', { cache: 'no-store' }).then(r => r.json()).then(x => { if (lebt && x?.ok) setP(x.selbstpruefung); }).catch(() => {});
    return () => { lebt = false; };
  }, [stand]);
  const offen = p?.filter(x => x.status !== 'erfuellt').length ?? 0;
  return (
    <Karte i={i} id="pruefung">
      <Ueberschrift rechts={p ? <Chip farbe={offen ? LEUCHT.achtung : LEUCHT.gut}>{p.length - offen} von {p.length} erfüllt</Chip> : undefined}>Selbstprüfung</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>Aus den echten Beständen gerechnet, nicht abgehakt. Keine Rechtsberatung.</div>
      {!p ? <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Rechnet …</div> : (
        <Liste>
          {p.map(x => (
            <Zeile key={x.id} umbrechen links={<Punkt farbe={P_FARBE[x.status]} />} titel={x.titel} unter={`${x.befund} · ${x.norm}`}
              rechts={x.status !== 'erfuellt' && x.weg ? <Knopf leise href={x.weg.href} titel={x.weg.text}>Beheben</Knopf> : <Chip farbe={P_FARBE[x.status]}>{x.status === 'erfuellt' ? 'erfüllt' : x.status}</Chip>} />
          ))}
        </Liste>
      )}
    </Karte>
  );
}
