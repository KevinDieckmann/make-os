'use client';
// ─── Aufgaben › Archiv › Archiviert (04.10.) ────────────────────────────────
// Was einzeln archiviert wurde (Wischen › Archivieren, lib/aufgaben/archiv-einzeln.ts) — samt mitgenommener Unteraufgaben.
// Jede Zeile hängt am Baustein `ZeileAktionen`: Zurückholen (die ganze Kette) oder Löschen (Papierkorb, 30 Tage), beides
// mit „Rückgängig“ über den HandlungProvider. Die Läufe von „Neu anfangen“ stehen darunter (NeustartArchiv).

import type { CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Leer, ZeileAktionen } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { einzelnArchiviert } from '@/lib/aufgaben/archiv-einzeln';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import { useHandlung } from './Handlung';
import { spaceLabel, tagKurz, projektTitel } from './hilfe';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };

export function EinzelArchiv({ spaces }: { spaces: readonly AufgabenSpace[] }) {
  const { voll, dispatch } = useTasks();
  const handlung = useHandlung(dispatch, voll.statusEigen);
  const liste = einzelnArchiviert(voll);
  return (
    <>
      <div style={{ ...mikro, margin: '18px 2px 8px' }}>Archiviert</div>
      <Karte i={2}>
        {liste.map(e => {
          const t = voll.tasks.find(x => x.id === e.id)!;
          return (
            <ZeileAktionen key={e.id} titel={e.titel} archiviert onArchivieren={() => handlung.zurueckholen(t)} onLoeschen={() => { void handlung.loeschen(t); }}>
              <div className="zeile" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.05)', minHeight: 56, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                  <span style={{ color: e.erledigt ? C.inkDim : C.ink, fontSize: TYP.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titel}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {spaceLabel(spaces, e.spaceId)} › {projektTitel(voll, e.projectId)}{e.mit ? ` · mit ${e.mit} ${e.mit === 1 ? 'Unteraufgabe' : 'Unteraufgaben'}` : ''} · archiviert {tagKurz(e.archiviertAm.slice(0, 10))}
                  </span>
                </div>
              </div>
            </ZeileAktionen>
          );
        })}
        {!liste.length && <Leer>Nichts archiviert. Eine Aufgabe nach links wischen (am Rechner: Knöpfe am Rand der Zeile) legt sie hierher — sie bleibt erhalten und lässt sich jederzeit zurückholen.</Leer>}
      </Karte>
    </>
  );
}
