'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { wertVon, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import { eur } from '@/lib/make-one/finance-data';
import { todayISO } from '@/components/os/kit';
import { Seitenkopf } from './Seitenkopf';

interface Sektion { titel: string; punkte?: string[]; }
interface Stats {
  finance: { fortschritt: number; istUmsatz: number; gewinn: number; runRateNoetig: number; runway: number | null; aktiv: boolean; zielUmsatz: number; zielGewinn: number } | null;
  pipeline: { total: number; hot: number; qualifiziert: number; kontaktiert: number; avgScore: number };
  tasks: { open: number; critical: number; inProgress: number; blocked: number; overdue: number };
}
interface Pack { headline: string; sektionen: Sektion[]; risiken: string[]; naechsteWoche: string[]; stats: Stats; }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...panel, padding: '12px 16px', minWidth: 140, flex: 1 }}>
      <div style={lbl}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? T.ink, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function BoardView() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  // Runway-Grenze aus dem Kompass — dieselbe Zahl wie in Controlling und Shields.
  const [runwayRot, setRunwayRot] = useState(3);
  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json())
      .then(d => setRunwayRot(wertVon('runway-warnung', d.modus ?? STANDARD_MODUS, d.eigene ?? {})))
      .catch(() => {});
  }, []);

  const [ready, setReady] = useState(false);
  const [privat, setPrivat] = useState(0);
  const [payload, setPayload] = useState<{ finance: unknown; prospects: unknown[]; tasks: unknown[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/state/finance').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/prospects').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/tasks').then(r => r.json()).catch(() => ({ state: null })),
    ]).then(([f, pr, t]) => {
      // Privat bleibt privat: Das Board ist die Geschäftssicht. Aufgaben aus
      // privaten Projekten (Gesundheit, Recht/Wittner, MAKE.One) gehen NICHT in
      // den Business-Kontext. 'joint' ist MAKE.One (Malin & Kevin) und damit
      // ausdrücklich PRIVAT — nur 'business' zählt.
      // Bewusst fail-closed: kennen wir das Projekt einer Aufgabe nicht, bleibt
      // sie draußen. Lieber ein unvollständiges Board als ein Leck.
      const projects: { id: string; category?: string }[] = t.state?.projects ?? [];
      const businessIds = new Set(projects.filter(p => p.category === 'business').map(p => p.id));
      const allTasks: { projectId?: string }[] = t.state?.tasks ?? [];
      const scoped = allTasks.filter(x => x.projectId && businessIds.has(x.projectId));
      setPayload({ finance: f.state, prospects: pr.state?.prospects ?? [], tasks: scoped });
      setPrivat(allTasks.length - scoped.length);
      setReady(true);
    });
  }, []);

  async function build() {
    if (!payload) return;
    setBusy(true);
    try {
      const r = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, today: todayISO() }) });
      setPack(await r.json());
    } catch { setPack(null); }
    setBusy(false);
  }

  const s = pack?.stats;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
        <Seitenkopf
          rubrik={<>Reporting-/Board-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, border: `1px solid ${T.accentInk}55`, borderRadius: 5, padding: '2px 7px' }}>live · Entwurf</span></>}
          titel={<>Das Wochen-Pack.</>}
          satz={<>Ein Blick über alles: Umsatz-Kurs, Pipeline und Ausführung — zusammengefasst aus Controlling, Prospecting und Aufgaben. Kennzahlen exakt, Einordnung vom Agenten.</>}
        />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0 16px' }}>
          <button onClick={build} disabled={busy || !ready} style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: busy || !ready ? 'default' : 'pointer', background: busy || !ready ? T.line : T.accent, color: busy || !ready ? T.muted : '#04110F' }}>
            {busy ? 'stelle Pack zusammen …' : pack ? 'Neu erstellen' : 'Board-Pack erstellen'}
          </button>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{ready ? `Geschäftssicht${privat > 0 ? ` · ${privat} private Aufgaben ausgeblendet` : ''}` : 'lade …'}</span>
        </div>

        {/* Kennzahlen (deterministisch) */}
        {s && (
          <>
            <div style={{ ...lbl, marginBottom: 8 }}>Kennzahlen</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <Kpi label="Umsatz-Kurs" value={s.finance?.aktiv ? `${s.finance.fortschritt}%` : '—'} sub={s.finance ? `Ziel ${eur(s.finance.zielUmsatz)}` : ''} color={T.accent} />
              <Kpi label="Run-Rate nötig" value={s.finance ? eur(s.finance.runRateNoetig) : '—'} sub="/Monat" />
              <Kpi label="Runway" value={s.finance?.runway != null ? `${s.finance.runway.toFixed(1)} Mon.` : '—'} color={s.finance?.runway != null && s.finance.runway < runwayRot ? T.crit : T.ink} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <Kpi label="Pipeline" value={`${s.pipeline.total}`} sub={`${s.pipeline.hot} starker Fit · Ø ${s.pipeline.avgScore}`} color={T.accentInk} />
              <Kpi label="Aufgaben offen" value={`${s.tasks.open}`} sub={`${s.tasks.critical} kritisch · ${s.tasks.inProgress} in Arbeit`} />
              <Kpi label="Achtung" value={`${s.tasks.overdue + s.tasks.blocked}`} sub={`${s.tasks.overdue} überfällig · ${s.tasks.blocked} blockiert`} color={s.tasks.overdue + s.tasks.blocked > 0 ? T.amber : T.ink} />
            </div>
          </>
        )}

        {/* Headline */}
        {pack?.headline && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Executive Summary</div>
            <div style={{ fontSize: 15, color: T.ink, lineHeight: 1.55 }}>{pack.headline}</div>
          </div>
        )}

        {/* Sektionen */}
        {!!pack?.sektionen?.length && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {pack.sektionen.map((sek, i) => (
              <div key={i} style={{ ...panel, padding: '14px 20px' }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{sek.titel}</div>
                {(sek.punkte ?? []).map((pt, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 3 }}><span style={{ color: T.accent }}>›</span>{pt}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Risiken + Nächste Woche */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {!!pack?.risiken?.length && (
            <div style={{ ...panel, borderColor: `${T.amber}44`, padding: '14px 20px' }}>
              <div style={{ ...lbl, color: T.amber, marginBottom: 8 }}>Risiken</div>
              {pack.risiken.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 4 }}><span style={{ color: T.amber }}>⚠</span>{r}</div>)}
            </div>
          )}
          {!!pack?.naechsteWoche?.length && (
            <div style={{ ...panel, borderColor: `${T.accent}44`, padding: '14px 20px' }}>
              <div style={{ ...lbl, color: T.accent, marginBottom: 8 }}>Fokus nächste Woche</div>
              {pack.naechsteWoche.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginTop: 4 }}><span style={{ color: T.accent }}>→</span>{r}</div>)}
            </div>
          )}
        </div>

        {!pack && !busy && (
          <div style={{ ...panel, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13.5, lineHeight: 1.5 }}>
            „Board-Pack erstellen" — der Agent zieht Controlling, Pipeline und Aufgaben zusammen und schreibt das Wochen-Briefing.
          </div>
        )}
      </div>
    </div>
  );
}
