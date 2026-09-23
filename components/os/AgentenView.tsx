'use client';

import Link from 'next/link';
import { AgentenHirn } from './AgentenHirn';
import { useEffect, useRef, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { THEME as T } from '@/lib/make-one/os-data';
import {
  DEPARTMENTS, ORCHESTRATOR, ARCHITEKTUR, REALITAET,
  STATUS_LABEL, AUTONOMY_LABEL, AUTONOMY_ORDER, MODEL_LABEL,
  type AgentStatus, type Autonomy, type ModelTier, type DeptAgent,
} from '@/lib/make-one/agents-data';
import { Seitenkopf } from './Seitenkopf';

interface Cfg { autonomy?: Autonomy; enabled?: boolean; model?: ModelTier; buildNext?: boolean; }
type CfgMap = Record<string, Cfg>;

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const statusColor = (s: AgentStatus) => (s === 'live' ? T.accent : s === 'teil' ? T.amber : T.muted);
const autoColor = (a: Autonomy) => (a === 'autonom' ? T.accent : a === 'entwurf' ? T.accentInk : a === 'freigabe' ? T.amber : T.muted);
const MODELS: ModelTier[] = ['schnell', 'ausgewogen', 'stark'];

export function AgentenView() {
  const [cfg, setCfg] = useState<CfgMap>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/state/agents').then(r => r.json()).then((d: { config: CfgMap }) => setCfg(d.config ?? {})).catch(() => {});
  }, []);

  const spaeter = useNachspeichern<CfgMap>(next => {
    fetch('/api/state/agents', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  }, 300);

  function patch(id: string, p: Cfg) {
    const next: CfgMap = { ...cfg, [id]: { ...cfg[id], ...p } };
    setCfg(next);
    spaeter(next);
  }

  const eff = (a: DeptAgent) => {
    const c = cfg[a.id] ?? {};
    return { autonomy: c.autonomy ?? a.autonomy, model: c.model ?? a.model, enabled: c.enabled !== false, buildNext: c.buildNext === true };
  };

  const all = DEPARTMENTS.flatMap(d => d.agents);
  const liveCount = all.filter(a => a.status === 'live').length;
  const buildCount = all.filter(a => (cfg[a.id]?.buildNext) === true).length;

  const pill = (text: string, color: string) => (
    <span style={{ fontFamily: T.mono, fontSize: 11, color, border: `1px solid ${color}55`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{text}</span>
  );
  // Der Schlüssel gehört ans Element — sonst warnt React bei jeder Liste.
  const selBtn = (active: boolean, onClick: () => void, text: string, color = T.accent, key?: string) => (
    <button key={key ?? text} onClick={onClick} style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? color : T.line}`, background: active ? `${color}22` : 'transparent', color: active ? color : T.inkDim }}>{text}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Agenten · verwalten & bauen</>}
          titel={<>Deine Agenten-Abteilungen.</>}
          satz={<>JARVIS dirigiert, {DEPARTMENTS.length} Abteilungen darunter. Klick einen Agenten auf, um <b style={{ color: T.ink }}>Autonomie, Modell & Freigaben einzustellen</b>, seine geplanten Funktionen zu sehen und ihn zum Bauen zu markieren. Wir schalten Abteilung für Abteilung live.</>}
        />

        <AgentenHirn />

        {/* Orchestrator */}
        <section style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '18px 22px', margin: '20px 0 22px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', flex: '0 0 auto', background: 'radial-gradient(circle,rgba(33,181,170,.7),rgba(33,181,170,.15) 60%,transparent)', border: `1.5px solid ${T.accent}` }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{ORCHESTRATOR.name}</div>
            <div style={{ fontSize: 12, color: T.inkDim, marginTop: 3, lineHeight: 1.5 }}>{ORCHESTRATOR.note}</div>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}><b style={{ color: T.accent, fontSize: 15 }}>{liveCount}</b> live · <b style={{ color: T.ink }}>{all.length}</b> Agenten{buildCount ? ` · ${buildCount}★ zum Bauen` : ''}</div>
        </section>

        {/* Abteilungen */}
        {DEPARTMENTS.map(d => (
          <div key={d.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{d.name}</span>
              <span style={{ fontSize: 12.5, color: T.muted }}>· {d.mission}</span>
            </div>
            <div style={{ ...panel, overflow: 'hidden' }}>
              {d.agents.map((a, i) => {
                const e = eff(a); const isOpen = open === a.id;
                return (
                  <div key={a.id} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: isOpen ? T.panel2 : 'transparent' }}>
                    <div onClick={() => setOpen(isOpen ? null : a.id)} style={{ display: 'flex', gap: 12, padding: '13px 16px', cursor: 'pointer', alignItems: 'center', opacity: e.enabled ? 1 : 0.5 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{a.name}</span>
                          {pill(STATUS_LABEL[a.status], statusColor(a.status))}
                          {e.buildNext && pill('★ bauen', T.accent)}
                        </div>
                        <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 3 }}>{a.role}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
                        {pill(AUTONOMY_LABEL[e.autonomy], autoColor(e.autonomy))}
                        <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>{isOpen ? '▾' : '▸'}</span>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '4px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Einstellungen */}
                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ ...lbl, marginBottom: 7 }}>Autonomie</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {AUTONOMY_ORDER.map(au => selBtn(e.autonomy === au, () => patch(a.id, { autonomy: au }), AUTONOMY_LABEL[au], autoColor(au)))}
                            </div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.45, maxWidth: 420 }}>
                              {e.autonomy === 'autonom'
                                ? 'Wirkt sofort: Ergebnisse werden direkt angewendet — ohne Rückfrage.'
                                : 'Ergebnisse werden vorgelegt, du bestätigst per Klick.'}
                              {a.id === 'task' && ' (Bei „autonom" legt der Tageslauf die Morgen-Prioritäten selbst als Aufgaben an.)'}
                              {a.id === 'kalender' && ' (Bei „autonom" trägt der Agent Schutz-Blöcke direkt in den echten Kalender ein.)'}
                            </div>
                          </div>
                          <div>
                            <div style={{ ...lbl, marginBottom: 7 }}>Modell</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {MODELS.map(m => selBtn(e.model === m, () => patch(a.id, { model: m }), MODEL_LABEL[m]))}
                            </div>
                          </div>
                          <div>
                            <div style={{ ...lbl, marginBottom: 7 }}>Status</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {selBtn(e.enabled, () => patch(a.id, { enabled: !e.enabled }), e.enabled ? 'Aktiv ✓' : 'Aus', e.enabled ? T.accent : T.muted)}
                              {selBtn(e.buildNext, () => patch(a.id, { buildNext: !e.buildNext }), '★ Als Nächstes bauen', T.amber)}
                            </div>
                          </div>
                        </div>

                        {a.href && (
                          <Link href={a.href} style={{ alignSelf: 'flex-start', textDecoration: 'none', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '8px 16px', borderRadius: 9, border: 'none', background: T.accent, color: '#04110F' }}>Agent öffnen ›</Link>
                        )}

                        {a.gate && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.amber }}>Freigabe-Gate: {a.gate}</div>}

                        {/* Funktionen */}
                        <div>
                          <div style={{ ...lbl, marginBottom: 7 }}>Funktionen</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {a.funktionen.map(f => <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: T.inkDim, lineHeight: 1.4 }}><span style={{ color: T.accent, flex: '0 0 auto' }}>›</span>{f}</div>)}
                          </div>
                        </div>

                        {/* Bauplan */}
                        <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: '11px 13px' }}>
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, textTransform: 'uppercase', letterSpacing: '.08em' }}>So würde ich ihn bauen</span>
                          <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.5, marginTop: 5 }}>{a.bauplan}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Architektur + Realität */}
        <div style={{ ...lbl, marginTop: 8 }}>So skalierst du auf 100–150 (recherchiert)</div>
        <div style={{ ...panel, padding: '16px 20px', margin: '12px 0 16px' }}>
          {ARCHITEKTUR.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '9px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0, fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, flex: '0 0 auto', marginTop: 1 }}>{i + 1}</span>{line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, padding: '14px 18px', borderRadius: 12, background: T.panel2, border: `1px solid ${T.line}` }}>
          <span style={{ color: T.amber, flex: '0 0 auto', fontSize: 15 }}>⚠</span>
          <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55 }}>{REALITAET}</div>
        </div>
      </div>
    </div>
  );
}
