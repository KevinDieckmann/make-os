'use client';

// ─── MAKE OS — Agenten ──────────────────────────────────────────────────────
// Jarvis dirigiert, darunter die Abteilungen. Seit 24.09. im lebendigen
// Muster: der Agenten-Score als Ring, die letzten Läufe, je Abteilung eine
// Karte mit den Agenten als Zeilen (Status, Autonomie als Chips), aufklappbar
// für Autonomie, Modell, Status, Funktionen und Bauplan.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import {
  DEPARTMENTS, ORCHESTRATOR, ARCHITEKTUR, REALITAET,
  STATUS_LABEL, AUTONOMY_LABEL, AUTONOMY_ORDER, MODEL_LABEL,
  type AgentStatus, type Autonomy, type ModelTier, type DeptAgent,
} from '@/lib/make-one/agents-data';
import { AgentenHirn } from './AgentenHirn';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Ring, Zahl, LEUCHT } from './schlank';

interface Cfg { autonomy?: Autonomy; enabled?: boolean; model?: ModelTier; buildNext?: boolean }
type CfgMap = Record<string, Cfg>;
interface Lauf { id: string; agent: string; title: string; ts: string }

const MODELS: ModelTier[] = ['schnell', 'ausgewogen', 'stark'];
const statusFarbe = (s: AgentStatus) => (s === 'live' ? LEUCHT.gut : s === 'teil' ? LEUCHT.achtung : C.inkLeise);
const autoFarbe = (a: Autonomy) => (a === 'autonom' ? LEUCHT.agenten : a === 'entwurf' ? LEUCHT.puls : a === 'freigabe' ? LEUCHT.achtung : C.inkLeise);
const her = (iso: string) => { const min = Math.floor((Date.now() - Date.parse(iso)) / 60000); return min < 60 ? `vor ${Math.max(1, min)} min` : min < 1440 ? `vor ${Math.floor(min / 60)} h` : `vor ${Math.floor(min / 1440)} d`; };

function Wahl({ an, farbe, onClick, children }: { an: boolean; farbe: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 9, cursor: 'pointer', border: 'none', background: an ? `${farbe}22` : 'rgba(255,255,255,.05)', color: an ? farbe : C.inkDim, transition: 'background .15s ease, color .15s ease' }}>{children}</button>
  );
}

export function AgentenView() {
  const [cfg, setCfg] = useState<CfgMap>({});
  const [offen, setOffen] = useState<string | null>(null);
  const [laeufe, setLaeufe] = useState<Lauf[]>([]);
  const [score, setScore] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/agents').then(r => r.json()).then((d: { config: CfgMap }) => setCfg(d.config ?? {})).catch(() => {});
    fetch('/api/state/agent-log?limit=10').then(r => r.json()).then(d => setLaeufe(Array.isArray(d.entries) ? d.entries : [])).catch(() => {});
    fetch('/api/performance').then(r => r.json()).then(d => { const s = (d.aktuell?.saeulen ?? []).find((x: { key: string }) => x.key === 'agents'); setScore(s ? s.score : null); }).catch(() => setScore(null));
  }, []);
  const spaeter = useNachspeichern<CfgMap>(next => { fetch('/api/state/agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {}); }, 300);
  const patch = (id: string, p: Cfg) => { const next: CfgMap = { ...cfg, [id]: { ...cfg[id], ...p } }; setCfg(next); spaeter(next); };
  const eff = (a: DeptAgent) => { const c = cfg[a.id] ?? {}; return { autonomy: c.autonomy ?? a.autonomy, model: c.model ?? a.model, enabled: c.enabled !== false, buildNext: c.buildNext === true }; };

  const alle = DEPARTMENTS.flatMap(d => d.agents);
  const live = alle.filter(a => a.status === 'live').length;
  const bauen = alle.filter(a => cfg[a.id]?.buildNext === true).length;
  const woche = laeufe.filter(l => Date.now() - Date.parse(l.ts) < 7 * 86400_000).length;
  const abteilungVon = (agentId: string) => DEPARTMENTS.find(d => d.agents.some(a => a.id === agentId));

  return (
    <Seite titel="Agenten" unter={`${ORCHESTRATOR.name} dirigiert · ${DEPARTMENTS.length} Abteilungen · ${live} von ${alle.length} live`}>
      <Karte i={0} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten} rechts={<Link href="/os/wachstum" style={{ color: C.inkLeise, textDecoration: 'none' }}>Wachstum ›</Link>}>Agenten-Score</Ueberschrift>
        <div style={{ display: 'flex', gap: 'clamp(16px,3vw,32px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring label="Agenten" wert={score != null ? String(score) : undefined} farbe={LEUCHT.agenten} anteil={score != null ? score / 100 : undefined} />
          <div style={{ flex: 1, minWidth: 220, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
            <Zahl wert={String(live)} label={`von ${alle.length} Agenten live`} farbe={LEUCHT.gut} />
            <Zahl wert={laeufe.length ? String(woche) : undefined} label="Läufe in 7 Tagen" farbe={LEUCHT.puls} />
            <Zahl wert={bauen ? String(bauen) : undefined} label="zum Bauen markiert" farbe={LEUCHT.achtung} />
          </div>
        </div>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '14px 0 0', lineHeight: 1.5 }}>{ORCHESTRATOR.note}</p>
      </Karte>

      <Karte i={1}><AgentenHirn /></Karte>

      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href="/os/stapel" style={{ color: C.inkLeise, textDecoration: 'none' }}>Aufträge & Freigaben ›</Link>}>Zuletzt gelaufen</Ueberschrift>
        <Liste>
          {laeufe.length === 0 && <Leer>Noch kein Lauf protokolliert.</Leer>}
          {laeufe.slice(0, 8).map(l => {
            const d = abteilungVon(l.agent);
            return <Zeile key={l.id} links={<Punkt farbe={d?.color ?? LEUCHT.agenten} />} titel={l.title} unter={`${alle.find(a => a.id === l.agent)?.name ?? l.agent} · ${her(l.ts)}`} />;
          })}
        </Liste>
      </Karte>

      {DEPARTMENTS.map((d, di) => {
        const liveHier = d.agents.filter(a => a.status === 'live').length;
        return (
          <Karte key={d.id} i={3 + di}>
            <Ueberschrift farbe={d.color} rechts={`${liveHier} von ${d.agents.length} live`}>{d.name}</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '-4px 0 8px' }}>{d.mission}</div>
            <Liste>
              {d.agents.map(a => {
                const e = eff(a); const auf = offen === a.id;
                return (
                  <div key={a.id} style={{ opacity: e.enabled ? 1 : .55 }}>
                    <Zeile onClick={() => setOffen(auf ? null : a.id)} aktiv={auf}
                      links={<Punkt farbe={statusFarbe(a.status)} />}
                      titel={<>{a.name}{e.buildNext && <span style={{ color: LEUCHT.achtung, marginLeft: 8, fontSize: 12 }}>★ bauen</span>}</>}
                      unter={a.role}
                      rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Chip farbe={statusFarbe(a.status)}>{STATUS_LABEL[a.status]}</Chip><Chip farbe={autoFarbe(e.autonomy)}>{AUTONOMY_LABEL[e.autonomy]}</Chip></span>} />
                    {auf && (
                      <div style={{ padding: '6px 2px 18px 24px', borderBottom: 'none', display: 'grid', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 11.5, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Autonomie</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{AUTONOMY_ORDER.map(au => <Wahl key={au} an={e.autonomy === au} farbe={autoFarbe(au)} onClick={() => patch(a.id, { autonomy: au })}>{AUTONOMY_LABEL[au]}</Wahl>)}</div>
                            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6, maxWidth: 420, lineHeight: 1.45 }}>{e.autonomy === 'autonom' ? 'Wirkt sofort: Ergebnisse werden direkt angewendet, ohne Rückfrage.' : 'Ergebnisse werden vorgelegt, du bestätigst per Klick.'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Modell</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{MODELS.map(m => <Wahl key={m} an={e.model === m} farbe={C.aktiv} onClick={() => patch(a.id, { model: m })}>{MODEL_LABEL[m]}</Wahl>)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11.5, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Status</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <Wahl an={e.enabled} farbe={LEUCHT.gut} onClick={() => patch(a.id, { enabled: !e.enabled })}>{e.enabled ? 'Aktiv ✓' : 'Aus'}</Wahl>
                              <Wahl an={e.buildNext} farbe={LEUCHT.achtung} onClick={() => patch(a.id, { buildNext: !e.buildNext })}>★ Als Nächstes bauen</Wahl>
                            </div>
                          </div>
                        </div>
                        {a.gate && <div style={{ fontSize: 12, color: LEUCHT.achtung }}>Freigabe-Gate: {a.gate}</div>}
                        <div>
                          <div style={{ fontSize: 11.5, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Funktionen</div>
                          {a.funktionen.map(f => <div key={f} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><span style={{ color: d.color }}>›</span>{f}</div>)}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11.5, color: LEUCHT.agenten, letterSpacing: '.06em', textTransform: 'uppercase' }}>So würde ich ihn bauen</div>
                          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginTop: 5 }}>{a.bauplan}</div>
                        </div>
                        {a.href && <div><Link href={a.href} style={{ textDecoration: 'none' }}><Knopf>Agent öffnen ›</Knopf></Link></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </Liste>
          </Karte>
        );
      })}

      <Karte i={3 + DEPARTMENTS.length}>
        <Ueberschrift>So skalierst du auf 100 bis 150</Ueberschrift>
        {ARCHITEKTUR.map((zeile, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i ? '1px solid rgba(255,255,255,.06)' : 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: LEUCHT.agenten, flex: '0 0 auto' }}>{i + 1}</span>{zeile}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 12, background: `${LEUCHT.achtung}12` }}>
          <span style={{ color: LEUCHT.achtung }}>⚠</span><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{REALITAET}</div>
        </div>
      </Karte>
    </Seite>
  );
}
