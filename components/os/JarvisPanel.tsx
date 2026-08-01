'use client';

import Link from 'next/link';
// ─── MAKE OS — Jarvis (schwebend, frei beweglich) ───────────────────────────
// Kevins Ansage: nicht starr — flexibel. Unten schwebt ein kleines, sanft
// pulsierendes Icon, das auf jeder /os-Seite mitgeht. Ein Klick öffnet den
// Chat in Normalgröße; an der oberen linken Ecke zieht man ihn stufenlos so
// groß, wie man arbeiten will, und am Kopf verschiebt man ihn frei über den
// Bildschirm. Der Rest der Oberfläche bleibt unberührt (Overlay, kein Layout).
// Fähigkeiten unverändert: Agenten ausführen, Aufgaben anlegen (Klick-
// Bestätigung), Blöcke direkt in den Planer legen (plan_block), Brain-Kontext.
// Navigation läuft client-seitig (next/link) — das Panel bleibt beim Seiten-
// wechsel einfach stehen; sessionStorage sichert das Gespräch nur noch gegen
// harte Reloads (F5, App-Neustart).

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import type { Priority } from '@/types';
import { Rich } from './Rich';

interface MAKEAction { type: 'create_task'; title: string; priority: string; why: string }
interface Handoff { agent: string; name: string; href: string; why: string }
interface Msg { role: 'user' | 'kimmi'; text: string; actions?: MAKEAction[]; handoffs?: Handoff[]; ran?: { agent: string; ok: boolean }[] }
interface Fenster { offen: boolean; w: number; h: number; right: number; bottom: number }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const MERKER_FENSTER = 'make-os-jarvis-fenster';
const MERKER_CONVO = 'make-os-jarvis-convo';
const STANDARD: Fenster = { offen: false, w: 400, h: 560, right: 22, bottom: 22 };
const MIN_W = 320, MIN_H = 380;

function Orb({ size = 30, puls = false }: { size?: number; puls?: boolean }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'inline-block' }}>
      {puls && <span className="jarvis-orb-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}` }} />}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}` }} />
      <span className={puls ? 'jarvis-orb-kern' : undefined} style={{ position: 'absolute', inset: size * 0.28, borderRadius: '50%', background: T.accent, boxShadow: `0 0 ${size * 0.4}px ${T.accent}66` }} />
    </span>
  );
}

export function JarvisPanel() {
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const [fenster, setFenster] = useState<Fenster>(STANDARD);
  const [convo, setConvo] = useState<Msg[]>([]);
  const [ask, setAsk] = useState('');
  const [thinking, setThinking] = useState(false);
  const [doneActions, setDoneActions] = useState<Record<string, boolean>>({});
  const [briefing, setBriefing] = useState('**Sir.** Ich bin da — frag mich, lass mich planen, oder schick mich los.');
  const convoRef = useRef<HTMLDivElement>(null);
  // Ziehen (Größe/Position) läuft über einen Ref — kein Re-Render pro Pixel.
  const zug = useRef<{ art: 'groesse' | 'ort'; x: number; y: number; w: number; h: number; right: number; bottom: number } | null>(null);

  // Fenster + Gespräch überleben auch harte Reloads (Navigation läuft jetzt
  // client-seitig über next/link — das Panel bleibt dabei ohnehin stehen).
  useEffect(() => {
    try {
      const f = localStorage.getItem(MERKER_FENSTER);
      if (f) setFenster({ ...STANDARD, ...JSON.parse(f) });
      const c = sessionStorage.getItem(MERKER_CONVO);
      if (c) setConvo(JSON.parse(c));
    } catch { /* egal */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(MERKER_FENSTER, JSON.stringify(fenster)); } catch { /* egal */ } }, [fenster]);
  useEffect(() => { try { sessionStorage.setItem(MERKER_CONVO, JSON.stringify(convo.slice(-30))); } catch { /* egal */ } }, [convo]);

  // Lagebericht als Eröffnung — aus dem letzten vollen Tageslauf.
  useEffect(() => {
    fetch('/api/tageslauf').then(r => r.json()).then((d: { letzterVoll?: { gestartet?: string; ausrichtung?: { gruss?: string; prioritaeten?: { titel: string; wann?: string }[]; schutz?: string } } | null }) => {
      const a = d.letzterVoll?.ausrichtung;
      if (!a?.gruss) return;
      const wann = d.letzterVoll?.gestartet ? ` _(Stand ${d.letzterVoll.gestartet.slice(11, 16)} Uhr)_` : '';
      const prios = (a.prioritaeten ?? []).slice(0, 3).map((p, i) => `${i + 1}. **${p.titel}**${p.wann ? ` · ${p.wann}` : ''}`).join('\n');
      setBriefing([`**Lagebericht.** ${a.gruss}${wann}`, prios, a.schutz ? `◇ ${a.schutz}` : ''].filter(Boolean).join('\n\n'));
    }).catch(() => {});
  }, []);

  useEffect(() => { const el = convoRef.current; if (el) el.scrollTop = el.scrollHeight; }, [convo, thinking, fenster.offen]);

  // ── Stufenlos ziehen: Größe (Ecke oben links) und Ort (Kopfzeile) ──
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const z = zug.current;
      if (!z) return;
      e.preventDefault();
      const dx = e.clientX - z.x, dy = e.clientY - z.y;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (z.art === 'groesse') {
        // Fenster hängt rechts unten — die obere linke Ecke zieht es auf.
        const w = Math.max(MIN_W, Math.min(vw - 16, z.w - dx));
        const h = Math.max(MIN_H, Math.min(vh - 16, z.h - dy));
        setFenster(f => ({ ...f, w, h }));
      } else {
        const right = Math.max(8, Math.min(vw - MIN_W, z.right - dx));
        const bottom = Math.max(8, Math.min(vh - 120, z.bottom - dy));
        setFenster(f => ({ ...f, right, bottom }));
      }
    };
    const up = () => {
      if (!zug.current) return;
      zug.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  const zugStart = (art: 'groesse' | 'ort') => (e: React.PointerEvent) => {
    e.preventDefault();
    zug.current = { art, x: e.clientX, y: e.clientY, w: fenster.w, h: fenster.h, right: fenster.right, bottom: fenster.bottom };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = art === 'groesse' ? 'nwse-resize' : 'grabbing';
  };

  const send = async (q: string) => {
    setAsk(''); setThinking(true);
    setConvo(c => [...c, { role: 'user', text: q }]);
    try {
      const r = await fetch('/api/kimmi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) });
      const d = await r.json();
      setConvo(c => [...c, { role: 'kimmi', text: d.reply ?? 'Ich habe gerade keine Antwort.', actions: Array.isArray(d.actions) ? d.actions : undefined, handoffs: Array.isArray(d.handoffs) ? d.handoffs : undefined, ran: Array.isArray(d.ran) && d.ran.length ? d.ran : undefined }]);
    } catch {
      setConvo(c => [...c, { role: 'kimmi', text: 'Ich konnte gerade nicht antworten — versuch es nochmal.' }]);
    } finally {
      setThinking(false);
    }
  };

  const doAction = (a: MAKEAction, key: string) => {
    const valid = (['low', 'medium', 'high', 'critical'] as const);
    const prio: Priority = valid.includes(a.priority as Priority) ? (a.priority as Priority) : 'medium';
    tasksDispatch({ type: 'ADD_TASK', payload: {
      projectId: tasksState.projects[0]?.id ?? '',
      title: a.title, description: a.why ? `Von Jarvis · ${a.why}` : 'Von Jarvis',
      status: 'todo', priority: prio, assignee: 'kevin',
      tags: [], subTasks: [], dependencies: [], sortOrder: 0,
    } });
    setDoneActions(d => ({ ...d, [key]: true }));
  };

  // ── Zu: das kleine pulsierende Icon, das überall mitgeht ──
  if (!fenster.offen) {
    return (
      <button onClick={() => setFenster(f => ({ ...f, offen: true }))} aria-label="Jarvis öffnen" title="Jarvis" className="jarvis-fab"
        style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 70, width: 52, height: 52, borderRadius: '50%', border: `1px solid ${T.lineHot}`, background: T.panel, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.45)' }}>
        <Orb size={30} puls />
        {thinking && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: T.amber }} />}
      </button>
    );
  }

  return (
    <div className="jarvis-fenster" style={{ position: 'fixed', right: fenster.right, bottom: fenster.bottom, width: `min(${fenster.w}px, calc(100vw - 16px))`, height: `min(${fenster.h}px, calc(100vh - 16px))`, zIndex: 70, display: 'flex', flexDirection: 'column', background: T.void, border: `1px solid ${T.lineHot}`, borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,.55)', overflow: 'hidden' }}>
      {/* Zieh-Ecke: stufenlos so groß, wie du arbeiten willst */}
      <div onPointerDown={zugStart('groesse')} title="Ziehen zum Vergrößern"
        style={{ position: 'absolute', top: 0, left: 0, width: 26, height: 26, cursor: 'nwse-resize', zIndex: 3, borderTop: `2px solid ${T.accent}55`, borderLeft: `2px solid ${T.accent}55`, borderTopLeftRadius: 16 }} />

      {/* Kopf — am Kopf packst du das Fenster und schiebst es, wohin du willst */}
      <div onPointerDown={zugStart('ort')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 20px', borderBottom: `1px solid ${T.line}`, background: T.panel, cursor: 'grab', touchAction: 'none' }}>
        <Orb size={26} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>JARVIS</div>
          <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.accent }}>● online · alles verbunden</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }} onPointerDown={e => e.stopPropagation()}>
          {convo.length > 0 && (
            <button onClick={() => { setConvo([]); setDoneActions({}); }} title="Neues Gespräch"
              style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px', cursor: 'pointer' }}>Neu</button>
          )}
          <button onClick={() => setFenster(f => ({ ...f, w: STANDARD.w, h: STANDARD.h, right: STANDARD.right, bottom: STANDARD.bottom }))} title="Normalgröße"
            style={{ fontSize: 11, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 }}>◱</button>
          <button onClick={() => setFenster(f => ({ ...f, offen: false }))} title="Schließen — Jarvis bleibt als Icon da"
            style={{ fontSize: 12, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 }}>—</button>
        </div>
      </div>

      {/* Konversation */}
      <div ref={convoRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {convo.length === 0 && !thinking && (
          <div>
            <div style={{ ...lbl, marginBottom: 8 }}><span style={{ color: T.accent }}>JARVIS</span> · Lagebericht</div>
            <Rich text={briefing} />
          </div>
        )}
        {convo.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '88%', background: T.accentSoft, border: `1px solid ${T.lineHot}`, color: T.ink, borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          : <div key={i} style={{ maxWidth: '96%' }}>
              <div style={{ ...lbl, marginBottom: 5 }}><span style={{ color: T.accent }}>JARVIS</span></div>
              <Rich text={m.text} />
              {m.actions && m.actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {m.actions.map((a, ai) => {
                    const key = `${i}-${ai}`;
                    return doneActions[key]
                      ? <span key={ai} style={{ fontSize: 12, color: T.accent, border: `1px solid ${T.lineHot}`, background: T.accentSoft, borderRadius: 8, padding: '6px 10px' }}>✓ „{a.title}" angelegt</span>
                      : <button key={ai} onClick={() => doAction(a, key)} style={{ fontSize: 12, fontWeight: 600, color: T.void, background: T.accent, border: `1px solid ${T.accent}`, borderRadius: 8, padding: '6px 11px', cursor: 'pointer' }}>+ Aufgabe: {a.title}{a.priority && a.priority !== 'medium' ? ` · ${a.priority}` : ''}</button>;
                  })}
                </div>
              )}
              {m.ran && m.ran.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {m.ran.map((x, xi) => (
                    <span key={xi} style={{ fontFamily: T.mono, fontSize: 9, color: x.ok ? T.accent : T.crit, border: `1px solid ${x.ok ? T.accent : T.crit}44`, borderRadius: 5, padding: '2px 7px' }}>
                      ⚙ {x.agent} {x.ok ? 'ausgeführt' : 'fehlgeschlagen'}
                    </span>
                  ))}
                </div>
              )}
              {m.handoffs && m.handoffs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {m.handoffs.map((h, hi) => (
                    <Link key={hi} href={h.href} title={h.why} style={{ fontSize: 12, fontWeight: 600, color: T.accent, background: T.accentSoft, border: `1px solid ${T.lineHot}`, borderRadius: 8, padding: '6px 11px', textDecoration: 'none' }}>→ {h.name} öffnen</Link>
                  ))}
                </div>
              )}
            </div>
        )}
        {thinking && <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}><span style={{ color: T.accent }}>JARVIS</span> denkt nach …</div>}
      </div>

      {/* Eingabe */}
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${T.line}`, background: T.panel }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 11, padding: '8px 10px' }}>
          <textarea value={ask} onChange={e => setAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && ask.trim() && !thinking) { e.preventDefault(); send(ask.trim()); } }}
            placeholder="Sprich mit Jarvis …" aria-label="Nachricht an Jarvis" rows={fenster.h > 640 ? 2 : 1} disabled={thinking}
            style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: T.ink, fontSize: 13.5, fontFamily: T.sans, resize: 'none', lineHeight: 1.5 }} />
          <button onClick={() => ask.trim() && !thinking && send(ask.trim())} aria-label="Senden" disabled={thinking}
            style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.lineHot}`, background: T.accent, color: T.void, cursor: thinking ? 'default' : 'pointer', fontSize: 15, flex: '0 0 auto' }}>↑</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {['Plane meinen Tag', 'Was ist heute wichtig?', 'Was kann ich abgeben?'].map(c => (
            <button key={c} onClick={() => !thinking && send(c)} disabled={thinking}
              style={{ fontSize: 11, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px', cursor: thinking ? 'default' : 'pointer' }}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
