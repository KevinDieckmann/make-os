'use client';

import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { Page, AgentHeader, Panel, Lbl, PrimaryButton, GhostButton, Loading, EmptyState, BulletRow, todayISO } from '@/components/os/kit';

type LoopKind = 'morgen' | 'woche' | 'rueckblick' | 'finanzen' | 'sales' | 'marketing' | 'operations' | 'kunden' | 'gesundheit';

interface Prio { titel: string; warum?: string; wann?: string }
interface FokusItem { titel: string; warum?: string }
interface Verbesserung { was: string; warum?: string }
interface LoopResult {
  loop?: string; error?: string; hinweis?: string;
  // Morgen
  gruss?: string; tagesform?: string; warum?: string; prioritaeten?: Prio[]; schutz?: string; warnung?: string;
  // Woche
  lage?: string; vorwocheStatus?: string; fortschritt?: string[]; stillstand?: string[]; eineSache?: string; fokus?: FokusItem[];
  // Rückblick
  muster?: string[]; blindeFlecken?: string[]; verbesserungen?: Verbesserung[]; anzahl?: number;
  // Bereichs-Loops (einheitlich)
  punkte?: FokusItem[];
  stats?: Record<string, number>;
}

interface LogEntry { id: string; agent: string; title: string; ts: string; payload: unknown }

const LOOPS: { id: LoopKind; label: string; sub: string }[] = [
  { id: 'woche', label: 'Wochen-Loop', sub: 'Zahlen × Pipeline × Ausführung' },
  { id: 'finanzen', label: 'Finanz-Loop', sub: 'Forderungen × Runway × Uhrwerk' },
  { id: 'sales', label: 'Sales-Loop', sub: 'Pipeline × Mandate × Produkte' },
  { id: 'marketing', label: 'Marketing-Loop', sub: 'Sichtbarkeit × Content × Launch' },
  { id: 'operations', label: 'Operations-Loop', sub: 'Ausführung × Kapazität × Entlastung' },
  { id: 'kunden', label: 'Kunden-Loop', sub: 'Mandate × Rechnungen × nächste Schritte' },
  { id: 'gesundheit', label: 'Gesundheits-Loop', sub: 'privat · Trend × Etappen × Schutz' },
  { id: 'rueckblick', label: 'Rückblick', sub: 'Was muss das System besser machen?' },
];

const formColor = (f?: string) => (f === 'gruen' ? T.accent : f === 'rot' ? T.crit : T.amber);
const formLabel = (f?: string) => (f === 'gruen' ? 'GRÜN' : f === 'rot' ? 'ROT' : 'GELB');

export function LoopView() {
  const [kind, setKind] = useState<LoopKind>('woche');
  const [res, setRes] = useState<Record<string, LoopResult | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<LogEntry[]>([]);

  async function loadHistory() {
    try {
      const r = await fetch('/api/state/agent-log?prefix=loop-&limit=20');
      const d = await r.json();
      setHistory(d.entries ?? []);
    } catch { /* Historie ist optional */ }
  }
  useEffect(() => { loadHistory(); }, []);

  async function run(k: LoopKind) {
    setBusy(true);
    try {
      const r = await fetch('/api/loop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loop: k, today: todayISO() }) });
      const d = await r.json();
      setRes(s => ({ ...s, [k]: d }));
      loadHistory();
    } catch { setRes(s => ({ ...s, [k]: { error: 'Loop gerade nicht möglich.' } })); }
    setBusy(false);
  }

  const cur = res[kind];

  return (
    <Page maxWidth={880}>
      <AgentHeader label="Loops" badge="der Takt" badgeColor={T.accent} title="Der Rhythmus des Systems." backHref="/os" backLabel="‹ Übersicht">
        Loops sind das, was aus einzelnen Agenten ein Betriebssystem macht: sie ziehen deine echten Daten zusammen, leiten <b style={{ color: T.ink }}>eine Handlung</b> daraus ab und merken sich das Ergebnis — damit der nächste Lauf darauf aufbaut.
      </AgentHeader>

      {/* Loop-Wahl */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, margin: '20px 0 16px' }}>
        {LOOPS.map(l => (
          <button key={l.id} onClick={() => setKind(l.id)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${kind === l.id ? T.accent : T.line}`, background: kind === l.id ? `${T.accent}18` : T.panel }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: kind === l.id ? T.accent : T.ink }}>{l.label}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.35 }}>{l.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <PrimaryButton onClick={() => run(kind)} disabled={busy}>
          {busy ? 'läuft …' : cur ? 'Neu laufen lassen' : `${LOOPS.find(l => l.id === kind)?.label} starten`}
        </PrimaryButton>
        {cur?.stats && (
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
            {Object.entries(cur.stats).map(([k, v]) => `${v} ${k}`).join(' · ')}
          </span>
        )}
      </div>

      {busy && <Loading text="ziehe deine echten Daten zusammen …" />}

      {cur?.error && <Panel style={{ padding: '14px 18px', borderColor: `${T.crit}55` }}><span style={{ color: T.crit, fontSize: 13 }}>{cur.error}</span></Panel>}
      {cur?.hinweis && <EmptyState>{cur.hinweis}</EmptyState>}

      {/* ── MORGEN ── */}
      {kind === 'morgen' && cur && !cur.error && cur.gruss && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel accent={formColor(cur.tagesform)} style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <Lbl>Heute</Lbl>
              <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: formColor(cur.tagesform), border: `1px solid ${formColor(cur.tagesform)}55`, borderRadius: 5, padding: '2px 8px' }}>{formLabel(cur.tagesform)}</span>
            </div>
            <div style={{ fontSize: 15.5, color: T.ink, lineHeight: 1.55 }}>{cur.gruss}</div>
            {cur.warum && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>{cur.warum}</div>}
          </Panel>

          {!!cur.prioritaeten?.length && (
            <Panel style={{ padding: '16px 20px' }}>
              <Lbl style={{ marginBottom: 10 }}>Heute zählt nur das ({cur.prioritaeten.length})</Lbl>
              {cur.prioritaeten.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, fontWeight: 700, flex: '0 0 auto', marginTop: 2 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{p.titel}</div>
                    <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2, lineHeight: 1.45 }}>{p.warum}</div>
                    {p.wann && <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentInk, marginTop: 3 }}>{p.wann}</div>}
                  </div>
                </div>
              ))}
            </Panel>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {cur.schutz && (
              <Panel style={{ padding: '14px 18px', borderColor: `${T.accentInk}44` }}>
                <Lbl color={T.accentInk} style={{ marginBottom: 6 }}>Schutz</Lbl>
                <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{cur.schutz}</div>
              </Panel>
            )}
            {cur.warnung && (
              <Panel style={{ padding: '14px 18px', borderColor: `${T.amber}44` }}>
                <Lbl color={T.amber} style={{ marginBottom: 6 }}>Achtung</Lbl>
                <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{cur.warnung}</div>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ── WOCHE ── */}
      {kind === 'woche' && cur && !cur.error && cur.lage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel accent={T.accent} style={{ padding: '18px 22px' }}>
            <Lbl style={{ marginBottom: 6 }}>Wochenlage</Lbl>
            <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>{cur.lage}</div>
          </Panel>

          {cur.vorwocheStatus && (
            <Panel style={{ padding: '14px 18px', borderColor: `${T.accentInk}44` }}>
              <Lbl color={T.accentInk} style={{ marginBottom: 6 }}>Rückkopplung — letzte Woche</Lbl>
              <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{cur.vorwocheStatus}</div>
            </Panel>
          )}

          {cur.eineSache && (
            <Panel style={{ padding: '16px 20px', borderColor: `${T.accent}55`, background: T.accentSoft }}>
              <Lbl color={T.accent} style={{ marginBottom: 6 }}>Die eine Sache</Lbl>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: T.ink, lineHeight: 1.5 }}>{cur.eineSache}</div>
            </Panel>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {!!cur.fortschritt?.length && (
              <Panel style={{ padding: '14px 18px' }}>
                <Lbl color={T.accent} style={{ marginBottom: 8 }}>Vorwärts</Lbl>
                {cur.fortschritt.map((f, i) => <BulletRow key={i} icon="✓" color={T.accent}>{f}</BulletRow>)}
              </Panel>
            )}
            {!!cur.stillstand?.length && (
              <Panel style={{ padding: '14px 18px', borderColor: `${T.amber}44` }}>
                <Lbl color={T.amber} style={{ marginBottom: 8 }}>Stillstand</Lbl>
                {cur.stillstand.map((f, i) => <BulletRow key={i} icon="⚠" color={T.amber}>{f}</BulletRow>)}
              </Panel>
            )}
          </div>

          {!!cur.fokus?.length && (
            <Panel style={{ padding: '16px 20px' }}>
              <Lbl style={{ marginBottom: 8 }}>Fokus nächste Woche</Lbl>
              {cur.fokus.map((f, i) => (
                <div key={i} style={{ padding: '8px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>→ {f.titel}</div>
                  {f.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>{f.warum}</div>}
                </div>
              ))}
            </Panel>
          )}

          {cur.schutz && (
            <Panel style={{ padding: '14px 18px', borderColor: `${T.accentInk}44` }}>
              <Lbl color={T.accentInk} style={{ marginBottom: 6 }}>Freihalten</Lbl>
              <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{cur.schutz}</div>
            </Panel>
          )}
        </div>
      )}

      {/* ── RÜCKBLICK ── */}
      {kind === 'rueckblick' && cur && !cur.error && (cur.muster || cur.verbesserungen) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!!cur.muster?.length && (
            <Panel accent={T.accent} style={{ padding: '16px 20px' }}>
              <Lbl style={{ marginBottom: 8 }}>Muster in meinen Empfehlungen</Lbl>
              {cur.muster.map((m, i) => <BulletRow key={i} icon="◆" color={T.accentInk}>{m}</BulletRow>)}
            </Panel>
          )}
          {!!cur.blindeFlecken?.length && (
            <Panel style={{ padding: '16px 20px', borderColor: `${T.amber}44` }}>
              <Lbl color={T.amber} style={{ marginBottom: 8 }}>Was mir fehlt</Lbl>
              {cur.blindeFlecken.map((m, i) => <BulletRow key={i} icon="⚠" color={T.amber}>{m}</BulletRow>)}
            </Panel>
          )}
          {!!cur.verbesserungen?.length && (
            <Panel style={{ padding: '16px 20px' }}>
              <Lbl style={{ marginBottom: 8 }}>Was das System besser machen muss</Lbl>
              {cur.verbesserungen.map((v, i) => (
                <div key={i} style={{ padding: '8px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{v.was}</div>
                  {v.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>{v.warum}</div>}
                </div>
              ))}
            </Panel>
          )}
        </div>
      )}

      {/* ── BEREICHS-LOOPS: ein Format, ein Renderer (Finanzen/Sales/Marketing/Operations/Kunden/Gesundheit) ── */}
      {!['morgen', 'woche', 'rueckblick'].includes(kind) && cur && !cur.error && cur.lage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel accent={T.accent} style={{ padding: '16px 20px' }}>
            <Lbl style={{ marginBottom: 8 }}>Lage</Lbl>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{cur.lage}</div>
            {cur.warnung && <div style={{ fontSize: 12.5, color: T.crit, marginTop: 8 }}>⚠ {cur.warnung}</div>}
          </Panel>
          {!!cur.punkte?.length && (
            <Panel style={{ padding: '16px 20px' }}>
              <Lbl style={{ marginBottom: 8 }}>Die Moves</Lbl>
              {cur.punkte.map((pkt, i) => (
                <div key={i} style={{ padding: '8px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{pkt.titel}</div>
                  {pkt.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2 }}>{pkt.warum}</div>}
                </div>
              ))}
            </Panel>
          )}
          {cur.eineSache && (
            <Panel style={{ padding: '14px 20px', borderColor: `${T.amber}55` }}>
              <Lbl color={T.amber} style={{ marginBottom: 6 }}>Die eine Sache</Lbl>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{cur.eineSache}</div>
            </Panel>
          )}
        </div>
      )}

      {!cur && !busy && <EmptyState>Wähl einen Loop und starte ihn — ich ziehe deine echten Daten (Termine, Aufgaben, Zahlen, Recovery) zusammen.</EmptyState>}

      {/* Gedächtnis */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Lbl style={{ marginBottom: 8 }}>Gedächtnis — frühere Läufe ({history.length})</Lbl>
          <Panel style={{ overflow: 'hidden' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{ display: 'flex', gap: 12, padding: '9px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, alignItems: 'baseline' }}>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, flex: '0 0 auto' }}>{h.ts.slice(0, 16).replace('T', ' ')}</span>
                <span style={{ fontSize: 13, color: T.inkDim }}>{h.title}</span>
              </div>
            ))}
          </Panel>
          <div style={{ marginTop: 10 }}>
            <GhostButton onClick={loadHistory}>↻ Gedächtnis aktualisieren</GhostButton>
          </div>
        </div>
      )}
    </Page>
  );
}
