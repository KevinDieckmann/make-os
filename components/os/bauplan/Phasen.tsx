'use client';

// ─── MAKE OS — Bauplan › Phasen (bis 08.10. die eigene Seite /os/roadmap) ──
// In welcher Reihenfolge MAKE OS gebaut wird: sieben Phasen, die aufeinander
// aufbauen — Messbarkeit lässt sich nicht auf Daten bauen, die noch nicht
// reinfließen. Aufräumen Etappe 3 (08.10.): eine Ansicht des Bauplans
// (`/os/bauplan?s=phasen`), /os/roadmap leitet hierher.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { PHASEN } from '@/lib/make-one/roadmap-data';
import { KAT_LABEL, BLOCK_LABEL, type BacklogItem } from '@/lib/make-one/backlog-data';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Ring, Zahl, Fortschritt, LEUCHT } from '../ui';

const blockColor = (b: string) => (b === 'frei' ? LEUCHT.gut : b === 'inhaber' ? LEUCHT.achtung : C.inkLeise);
const katColor = (k: string) => (k === 'anbindung' ? LEUCHT.puls : k === 'agent' ? LEUCHT.agenten : k === 'qualitaet' ? LEUCHT.gut : LEUCHT.schlaf);
export function Phasen() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [offen, setOffen] = useState<string | null>('takt');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/state/backlog').then(r => r.json()).then((d: { items: BacklogItem[] }) => {
      setItems(d.items ?? []); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const jePhase = (id: string) => items.filter(i => i.phase === id);
  const gesamt = items.length;
  const fertig = items.filter(i => i.status === 'erledigt').length;

  return (
    <>
      <Karte i={0} ton={LEUCHT.puls}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={`${PHASEN.length} Phasen`}>Der Fahrplan</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
          <Zahl wert={gesamt ? String(gesamt) : undefined} label="Bausteine" />
          <Zahl wert={fertig ? String(fertig) : undefined} label="erledigt" farbe={LEUCHT.gut} />
          <Zahl wert={gesamt && fertig ? String(Math.round((fertig / gesamt) * 100)) : undefined} label="% des Fahrplans" farbe={LEUCHT.puls} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Fortschritt anteil={gesamt ? fertig / gesamt : 0} farbe={LEUCHT.puls} />
        </div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts="Klick öffnet die Phase">Die Phasen</Ueberschrift>
        {!loaded ? (
          <Leer>lade Fahrplan …</Leer>
        ) : (
          <Liste>
            {PHASEN.map(p => {
              const eigene = jePhase(p.id);
              const done = eigene.filter(i => i.status === 'erledigt').length;
              const meine = eigene.filter(i => i.status !== 'erledigt' && i.block === 'frei').length;
              const deine = eigene.filter(i => i.status !== 'erledigt' && i.block === 'inhaber').length;
              const auf = offen === p.id;
              const pct = eigene.length ? (done / eigene.length) * 100 : 0;
              const farbe = pct === 100 ? LEUCHT.gut : LEUCHT.puls;

              return (
                <div key={p.id}>
                  <Zeile onClick={() => setOffen(auf ? null : p.id)} aktiv={auf}
                    links={<Ring groesse="klein" label="" wert={eigene.length ? String(Math.round(pct)) : undefined} farbe={farbe} anteil={eigene.length ? pct / 100 : undefined} />}
                    titel={<><span style={{ color: C.inkLeise, fontWeight: 400 }}>{String(p.nr).padStart(2, '0')} · </span>{p.name}</>}
                    unter={<span title={p.ziel}>{p.ziel}</span>}
                    rechts={
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Chip farbe={pct === 100 ? LEUCHT.gut : C.inkDim}>{done}/{eigene.length}</Chip>
                        {meine > 0 && <Chip farbe={LEUCHT.gut}>{meine} baubar</Chip>}
                        {deine > 0 && <Chip farbe={LEUCHT.achtung}>{deine} brauchen dich</Chip>}
                      </div>
                    } />

                  {auf && (
                    <div style={{ padding: '6px 2px 16px' }}>
                      <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 }}>{p.ziel}</p>
                      <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: '8px 0 12px' }}>
                        <b style={{ color: LEUCHT.puls }}>Fertig, wenn: </b>{p.fertigWenn}
                      </p>
                      {eigene.sort((a, b) => a.prio - b.prio).map(i => (
                        <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', opacity: i.status === 'erledigt' ? 0.45 : 1 }}>
                          <Chip farbe={i.prio === 1 ? LEUCHT.puls : C.inkLeise}>P{i.prio}</Chip>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: TYP.body, fontWeight: 500, color: C.ink, textDecoration: i.status === 'erledigt' ? 'line-through' : 'none' }}>{i.titel}</span>
                              <Chip farbe={katColor(i.kategorie)}>{KAT_LABEL[i.kategorie]}</Chip>
                              <Chip farbe={blockColor(i.block)}>{BLOCK_LABEL[i.block]}</Chip>
                            </div>
                            {i.warum && <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '4px 0 0' }}>{i.warum}</p>}
                            {i.block === 'inhaber' && i.brauche && (
                              <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '4px 0 0' }}>
                                <b style={{ color: LEUCHT.achtung }}>Du brauchst: </b>{i.brauche}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {!eigene.length && <Leer>Noch kein Baustein in dieser Phase eingeordnet.</Leer>}
                    </div>
                  )}
                </div>
              );
            })}
          </Liste>
        )}
      </Karte>

    </>
  );
}
