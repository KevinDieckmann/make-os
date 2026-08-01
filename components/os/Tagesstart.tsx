'use client';

import Link from 'next/link';
// Der Tagesstart: beim ersten Öffnen an einem Tag holt MAKE alles frisch und
// legt die Tagesausrichtung hin. Kevin soll morgens nichts suchen müssen.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';

interface Prio { titel: string; warum?: string; wann?: string }
interface Loop { gruss?: string; tagesform?: string; warum?: string; prioritaeten?: Prio[]; schutz?: string; warnung?: string; alarm?: string; autoAufgaben?: { titel: string; stand: string }[] }
interface Status {
  today: string; gelaufen: boolean; loopHeute: boolean;
  vitalsHeute: boolean; vitalsStand: string; kalenderAlterStd: number | null;
  offen: string[];
  loop?: Loop | null;
  schritte?: { name: string; ok: boolean; info?: string }[];
}

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const formColor = (f?: string) => (f === 'gruen' ? T.accent : f === 'gelb' ? T.amber : f === 'rot' ? T.crit : T.muted);

export function Tagesstart() {
  const [st, setSt] = useState<Status | null>(null);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  // Prioritäten per Klick in echte Aufgaben — mit Duplikat-Schutz der Route.
  const { rehydrate } = useTasks();
  const [uebernommen, setUebernommen] = useState<Record<number, 'busy' | 'ok' | 'dupl' | 'err'>>({});

  async function uebernehmen(p: Prio, i: number) {
    setUebernommen(u => ({ ...u, [i]: 'busy' }));
    try {
      const r = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: p.titel,
          description: [p.warum, p.wann ? `Wann: ${p.wann}` : ''].filter(Boolean).join(' · ') || 'Aus dem Tagesstart übernommen.',
          priority: 'high', projectId: 'proj-kdm',
        }),
      });
      const d = await r.json();
      setUebernommen(u => ({ ...u, [i]: d.ok ? (d.duplikat ? 'dupl' : 'ok') : 'err' }));
      // Provider auf Server-Stand ziehen — sonst überschreibt sein nächster
      // debounced PUT die frisch angelegte Aufgabe.
      if (d.ok && !d.duplikat) await rehydrate();
    } catch { setUebernommen(u => ({ ...u, [i]: 'err' })); }
  }

  async function alleUebernehmen() {
    const prios = loop?.prioritaeten ?? [];
    for (let i = 0; i < Math.min(3, prios.length); i++) {
      if (uebernommen[i] !== 'ok' && uebernommen[i] !== 'dupl') await uebernehmen(prios[i], i);
    }
  }

  async function run(force = false) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/tagesstart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const d: Status = await r.json();
      setSt(d);
      if (d.loop) setLoop(d.loop);
    } catch { /* still — der Rest der Seite funktioniert weiter */ }
    setBusy(false);
  }

  useEffect(() => {
    fetch('/api/tagesstart').then(r => r.json()).then((d: Status) => {
      setSt(d);
      // Einmal pro Tag von selbst — genau das ist der Punkt.
      if (!d.gelaufen && !started.current) { started.current = true; run(false); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!st) return null;

  const card = {
    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14,
    borderLeft: `3px solid ${loop ? formColor(loop.tagesform) : T.accent}`,
    padding: '16px 20px',
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={lbl}>Tagesstart</div>
        {loop?.tagesform && (
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: formColor(loop.tagesform), border: `1px solid ${formColor(loop.tagesform)}55`, borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase' }}>
            {loop.tagesform}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={() => run(true)} disabled={busy} style={{ fontFamily: T.mono, fontSize: 10.5, color: busy ? T.muted : T.accentInk, background: 'transparent', border: 'none', cursor: busy ? 'default' : 'pointer', padding: 0 }}>
          {busy ? 'hole alles …' : '↻ neu'}
        </button>
      </div>

      {busy && !loop && (
        <div style={{ fontSize: 13.5, color: T.inkDim, marginTop: 8, lineHeight: 1.5 }}>
          Ich hole gerade deine Termine, Aufgaben und Zahlen zusammen …
        </div>
      )}

      {loop?.gruss && (
        <div style={{ fontSize: 15, color: T.ink, marginTop: 8, lineHeight: 1.5 }}>{loop.gruss}</div>
      )}
      {loop?.warum && (
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>{loop.warum}</div>
      )}

      {!!loop?.prioritaeten?.length && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {loop.prioritaeten.slice(0, 3).map((p, i) => {
            const st = uebernommen[i];
            return (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, flex: '0 0 auto' }}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>{p.titel}</span>
                  {p.wann && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginLeft: 8 }}>{p.wann}</span>}
                  {p.warum && <div style={{ fontSize: 12, color: T.inkDim, marginTop: 1, lineHeight: 1.4 }}>{p.warum}</div>}
                </div>
                <button onClick={() => uebernehmen(p, i)} disabled={st === 'busy' || st === 'ok' || st === 'dupl'}
                  style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, whiteSpace: 'nowrap', flex: '0 0 auto', cursor: st ? 'default' : 'pointer',
                    border: `1px solid ${st === 'err' ? T.crit : st === 'ok' || st === 'dupl' ? T.line : T.accent}`,
                    background: st === 'ok' || st === 'dupl' ? 'transparent' : `${T.accent}18`,
                    color: st === 'err' ? T.crit : st === 'ok' || st === 'dupl' ? T.muted : T.accent }}>
                  {st === 'busy' ? '…' : st === 'ok' ? '✓ Aufgabe' : st === 'dupl' ? 'gibt es schon' : st === 'err' ? 'Fehler' : '→ Aufgabe'}
                </button>
              </div>
            );
          })}
          <button onClick={alleUebernehmen} style={{ alignSelf: 'flex-start', fontFamily: T.sans, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer', marginTop: 2 }}>
            Alle übernehmen
          </button>
        </div>
      )}

      {!!loop?.autoAufgaben?.length && (
        <div style={{ fontSize: 12, color: T.accent, marginTop: 8, lineHeight: 1.5 }}>
          ⚙ Automatisch als Aufgaben angelegt ({loop.autoAufgaben.filter(x => x.stand === 'angelegt').length}) — Task-Agent steht auf „autonom".
        </div>
      )}
      {loop?.schutz && (
        <div style={{ fontSize: 12.5, color: T.accentInk, marginTop: 10 }}>◇ {loop.schutz}</div>
      )}
      {loop?.warnung && (
        <div style={{ fontSize: 12.5, color: T.amber, marginTop: 6 }}>⚠ {loop.warnung}</div>
      )}
      {loop?.alarm && (
        <div style={{ fontSize: 12.5, color: T.amber, marginTop: 6 }}><b>Wächter:</b> {loop.alarm}</div>
      )}
      <Link href="/os/tageslauf" style={{ display: 'inline-block', marginTop: 10, fontFamily: T.mono, fontSize: 10.5, color: T.accentInk, textDecoration: 'none' }}>ganze Kette ansehen ›</Link>

      {/* Was die Zahlen noch verfälscht — ehrlich statt stillschweigend. */}
      {!!st.offen.length && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...lbl, color: T.amber }}>damit alles stimmt</span>
          {st.offen.map((o, i) => {
            const href = o.includes('gesundheit') ? '/os/gesundheit' : '/os/kalender';
            return (
              <Link key={i} href={href} style={{ fontSize: 12, color: T.inkDim, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 10px' }}>
                {o.replace(/\s*\(\/os\/\w+\)/, '')} ›
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
