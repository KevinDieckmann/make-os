'use client';

// ─── MAKE OS — Roadmap ──────────────────────────────────────────────────────
// In welcher Reihenfolge MAKE OS gebaut wird: sieben Phasen, die aufeinander
// aufbauen — Messbarkeit lässt sich nicht auf Daten bauen, die noch nicht
// reinfließen. 24.09.: auf das lebendige Muster umgezogen.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { PHASEN } from '@/lib/make-one/roadmap-data';
import { KAT_LABEL, BLOCK_LABEL, type BacklogItem } from '@/lib/make-one/backlog-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Ring, Zahl, Fortschritt, LEUCHT } from './schlank';

const blockColor = (b: string) => (b === 'frei' ? LEUCHT.gut : b === 'kevin' ? LEUCHT.achtung : C.inkLeise);
const katColor = (k: string) => (k === 'anbindung' ? LEUCHT.puls : k === 'agent' ? LEUCHT.agenten : k === 'qualitaet' ? LEUCHT.gut : LEUCHT.schlaf);
/** Ein Verweis, der wie ein Knopf aussieht. */
const linkKnopf: CSSProperties = {
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, whiteSpace: 'nowrap',
  background: LEUCHT.puls, color: C.grund, textDecoration: 'none', boxShadow: `0 6px 18px -6px ${LEUCHT.puls}99`,
};

export function RoadmapView() {
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
    <Seite titel="Roadmap" unter="Sieben Phasen, die aufeinander aufbauen. Erst der tägliche Takt, dann vollständige Daten, dann Steuerung — Messbarkeit auf Daten zu bauen, die noch nicht reinfließen, führt zu Zahlen, denen man nicht trauen kann.">
      <Karte i={0} akzent={LEUCHT.puls}>
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
              const deine = eigene.filter(i => i.status !== 'erledigt' && i.block === 'kevin').length;
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
                      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55, margin: '8px 0 12px' }}>
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
                            {i.warum && <p style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5, margin: '4px 0 0' }}>{i.warum}</p>}
                            {i.block === 'kevin' && i.brauche && (
                              <p style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5, margin: '4px 0 0' }}>
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

      <Karte i={2}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ fontSize: TYP.body, color: C.inkDim, flex: '1 1 220px' }}>
            Einzelne Punkte bearbeiten, Prioritäten ändern oder Neues notieren:
          </span>
          <Link href="/os/bauplan" className="fassbar" style={linkKnopf}>Zum Bauplan →</Link>
        </div>
      </Karte>
    </Seite>
  );
}
