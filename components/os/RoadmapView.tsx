'use client';

import Link from 'next/link';
// Die Roadmap: in welcher Reihenfolge MAKE OS gebaut wird. Sieben Phasen, die
// aufeinander aufbauen — man kann Messbarkeit nicht auf Daten bauen, die noch
// nicht reinfließen.

import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { PHASEN } from '@/lib/make-one/roadmap-data';
import { KAT_LABEL, BLOCK_LABEL, type BacklogItem } from '@/lib/make-one/backlog-data';
import { Seitenkopf } from './Seitenkopf';

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const blockColor = (b: string) => (b === 'frei' ? T.accent : b === 'kevin' ? T.amber : T.muted);
const katColor = (k: string) => (k === 'anbindung' ? '#4A6CF7' : k === 'agent' ? T.accent : k === 'qualitaet' ? T.accentInk : '#AC9D80');

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
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Roadmap · der Fahrplan</>}
          titel={<>In welcher Reihenfolge wir bauen.</>}
          satz={<>Sieben Phasen, die aufeinander aufbauen. Erst der tägliche Takt, dann vollständige Daten, dann Steuerung — Messbarkeit auf Daten zu bauen, die noch nicht reinfließen, führt zu Zahlen, denen man nicht trauen kann.</>}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 20px' }}>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Bausteine</div><div style={{ fontSize: 21, fontWeight: 700 }}>{gesamt}</div></div>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Erledigt</div><div style={{ fontSize: 21, fontWeight: 700, color: T.accent }}>{fertig}</div></div>
          <div style={{ ...panel, padding: '10px 16px', flex: 1, minWidth: 200 }}>
            <div style={lbl}>Fortschritt</div>
            <div style={{ height: 8, background: T.void, borderRadius: 5, marginTop: 9, overflow: 'hidden' }}>
              <div style={{ width: `${gesamt ? (fertig / gesamt) * 100 : 0}%`, height: '100%', background: `linear-gradient(90deg,${T.accent},${T.accentInk})` }} />
            </div>
          </div>
        </div>

        {!loaded ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade Fahrplan …</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PHASEN.map(p => {
              const eigene = jePhase(p.id);
              const done = eigene.filter(i => i.status === 'erledigt').length;
              const meine = eigene.filter(i => i.status !== 'erledigt' && i.block === 'frei').length;
              const deine = eigene.filter(i => i.status !== 'erledigt' && i.block === 'kevin').length;
              const auf = offen === p.id;
              const pct = eigene.length ? (done / eigene.length) * 100 : 0;

              return (
                <div key={p.id} style={{ ...panel, overflow: 'hidden', borderLeft: `3px solid ${pct === 100 ? T.accent : auf ? T.accentInk : T.line}` }}>
                  <div onClick={() => setOffen(auf ? null : p.id)} style={{ padding: '16px 20px', cursor: 'pointer', background: auf ? T.panel2 : 'transparent' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.accent, flex: '0 0 auto' }}>{String(p.nr).padStart(2, '0')}</span>
                      <span style={{ fontSize: 16.5, fontWeight: 700, color: T.ink }}>{p.name}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                        {done}/{eigene.length}
                        {meine > 0 && <span style={{ color: T.accent }}> · {meine} baubar</span>}
                        {deine > 0 && <span style={{ color: T.amber }}> · {deine} brauchen dich</span>}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>{auf ? '▾' : '▸'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: T.inkDim, marginTop: 6, lineHeight: 1.5, paddingLeft: 26 }}>{p.ziel}</div>
                    <div style={{ height: 3, background: T.void, borderRadius: 2, marginTop: 10, marginLeft: 26, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: T.accent }} />
                    </div>
                  </div>

                  {auf && (
                    <div style={{ padding: '2px 20px 18px 46px' }}>
                      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, lineHeight: 1.5, borderLeft: `2px solid ${T.lineSoft}`, paddingLeft: 12 }}>
                        <b style={{ color: T.accentInk }}>Fertig, wenn: </b>{p.fertigWenn}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {eigene.sort((a, b) => a.prio - b.prio).map(i => (
                          <div key={i.id} style={{ opacity: i.status === 'erledigt' ? 0.45 : 1 }}>
                            <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: T.mono, fontSize: 11, color: i.prio === 1 ? T.accent : T.muted, flex: '0 0 auto' }}>P{i.prio}</span>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, textDecoration: i.status === 'erledigt' ? 'line-through' : 'none' }}>{i.titel}</span>
                              <span style={{ fontFamily: T.mono, fontSize: 11, color: katColor(i.kategorie), border: `1px solid ${katColor(i.kategorie)}44`, borderRadius: 4, padding: '1px 6px' }}>{KAT_LABEL[i.kategorie]}</span>
                              <span style={{ fontFamily: T.mono, fontSize: 11, color: blockColor(i.block), border: `1px solid ${blockColor(i.block)}44`, borderRadius: 4, padding: '1px 6px' }}>{BLOCK_LABEL[i.block]}</span>
                            </div>
                            {i.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 3, lineHeight: 1.45, paddingLeft: 26 }}>{i.warum}</div>}
                            {i.block === 'kevin' && i.brauche && (
                              <div style={{ marginTop: 5, marginLeft: 26, display: 'flex', gap: 7, background: T.panel2, border: `1px solid ${T.amber}33`, borderRadius: 8, padding: '7px 11px' }}>
                                <span style={{ color: T.amber, flex: '0 0 auto', fontSize: 12 }}>→</span>
                                <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.45 }}>{i.brauche}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ ...panel, padding: '14px 20px', marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: T.inkDim, flex: 1, minWidth: 220 }}>
            Einzelne Punkte bearbeiten, Prioritäten ändern oder Neues notieren:
          </span>
          <Link href="/os/bauplan" style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', color: '#04110F', background: T.accent, borderRadius: 9, padding: '9px 16px' }}>Zum Bauplan →</Link>
        </div>
      </div>
    </div>
  );
}
