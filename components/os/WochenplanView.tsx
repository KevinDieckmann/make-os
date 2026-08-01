'use client';

import Link from 'next/link';
// ─── MAKE OS — Wochenplaner (beweglich) ─────────────────────────────────────
// Kevins 5-Minuten-Morgenblick: feste Termine stehen unverrückbar im Raster,
// alles andere — Fokus, Reha, Routinen, Pausen, Aufgaben — ziehst du aus der
// Leiste in den Tag und schiebst es frei herum. Kein Gespräch nötig: gucken,
// schieben, fertig. Gespeichert wird von selbst.

import { useEffect, useMemo, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
// Routinen kommen aus dem Routine-Planer — nicht mehr aus der Konstante.

interface PlanBlock { id: string; date: string; startMin: number; dauerMin: number; titel: string; art: 'fokus' | 'reha' | 'routine' | 'pause' | 'aufgabe' | 'block'; taskId?: string }
interface FixTermin { titel: string; date: string; startMin: number; dauerMin: number; quelle: string }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Raster: 06:00–22:00, 1 Minute = 0.8px → Tag = 768px hoch, 15-Minuten-Raster.
const START = 6 * 60, ENDE = 22 * 60, PX = 0.8;
const H = (ENDE - START) * PX;

const ART_FARBE: Record<PlanBlock['art'], string> = {
  fokus: T.accent, reha: '#58D9CD', routine: T.amber, pause: '#96A8A2', aufgabe: '#4A6CF7', block: '#AC9D80',
};
const BAUSTEINE: { art: PlanBlock['art']; titel: string; dauerMin: number }[] = [
  { art: 'fokus', titel: 'Fokus (Deep Work)', dauerMin: 90 },
  { art: 'reha', titel: 'Reha / Rücken', dauerMin: 30 },
  { art: 'pause', titel: 'Pause', dauerMin: 15 },
  { art: 'block', titel: 'Blockzeit', dauerMin: 60 },
];

const mmss = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const snap = (min: number) => Math.round(min / 15) * 15;

/** Montag der Woche mit Versatz (0 = diese Woche). */
function montag(offset: number): Date {
  const d = new Date();
  const tag = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - tag + offset * 7);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function WochenplanView() {
  const { state: tasksState } = useTasks();
  const [offset, setOffset] = useState(0);
  const [bloecke, setBloecke] = useState<PlanBlock[]>([]);
  const [fix, setFix] = useState<FixTermin[]>([]);
  const [aktivBlock, setAktivBlock] = useState<string | null>(null);
  // Ziele beim Planen sichtbar — und Jarvis' Wochenvorschlag (Human-in-the-Loop).
  const [ziele, setZiele] = useState<{ monat: { titel: string; fortschritt: number; erledigt?: boolean }[]; quartal: { titel: string; fortschritt: number; erledigt?: boolean }[]; fokus?: { woche?: string; monat?: string; quartal?: string } }>({ monat: [], quartal: [] });
  const [vorschlag, setVorschlag] = useState<{ begruendung: string; bloecke: PlanBlock[]; verworfen: number } | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [routinen, setRoutinen] = useState<{ id: string; label: string; dauerMin: number; aktiv: boolean }[]>([]);
  // Fokus-Regler: Kevin lenkt, das System sortiert danach vor.
  const [regler, setRegler] = useState<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heute = localDay();

  const mo = montag(offset);
  const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mo); d.setDate(d.getDate() + i); return localDay(d);
  }), [offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const wochenKey = tage[0];

  useEffect(() => {
    fetch('/api/state/routinen').then(r => r.json()).then(d => setRoutinen((d.routinen ?? []).filter((x: { aktiv: boolean }) => x.aktiv))).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setZiele({ monat: d.monat ?? [], quartal: d.quartal ?? [], fokus: d.fokus ?? {} })).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
  }, []);

  // Verschiebbare Blöcke der Woche laden.
  useEffect(() => {
    fetch(`/api/state/wochenplan?woche=${wochenKey}`).then(r => r.json())
      .then(d => setBloecke(Array.isArray(d.bloecke) ? d.bloecke : []))
      .catch(() => setBloecke([]));
  }, [wochenKey]);

  // Feste Termine aus beiden Kalendern (Apple-Cache + KEMARIS/M365), dedupliziert.
  useEffect(() => {
    Promise.all([
      fetch('/api/apple-calendar').then(r => r.json()).catch(() => []),
      fetch('/api/kemaris-calendar').then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([apple, kem]) => {
      const roh: { titel: string; start?: string; ende?: string }[] = [
        ...(Array.isArray(apple) ? apple : []).map((e: { title?: string; startDate?: string; endDate?: string; allDay?: boolean }) =>
          e.allDay ? null : { titel: e.title ?? '', start: e.startDate, ende: e.endDate }).filter(Boolean) as { titel: string; start?: string; ende?: string }[],
        ...((kem?.events ?? []) as { title?: string; start?: string; end?: string }[]).map(e => ({ titel: e.title ?? '', start: e.start, ende: e.end })),
      ];
      const gesehen = new Set<string>();
      const liste: FixTermin[] = [];
      for (const e of roh) {
        if (!e.start) continue;
        const date = e.start.slice(0, 10);
        if (!tage.includes(date)) continue;
        const key = `${e.titel.toLowerCase().trim()}|${e.start.slice(0, 16)}`;
        if (gesehen.has(key)) continue;
        gesehen.add(key);
        const s = new Date(e.start), en = e.ende ? new Date(e.ende) : null;
        const startMin = s.getHours() * 60 + s.getMinutes();
        const dauerMin = en ? Math.max(15, Math.round((en.getTime() - s.getTime()) / 60000)) : 60;
        liste.push({ titel: e.titel, date, startMin, dauerMin, quelle: 'Kalender' });
      }
      setFix(liste);
    });
  }, [wochenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function speichern(next: PlanBlock[]) {
    setBloecke(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/wochenplan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ woche: wochenKey, bloecke: next }) }).catch(() => {});
    }, 500);
  }

  // ── Ziehen & Fallenlassen ──
  function dropAufTag(e: React.DragEvent, date: string) {
    e.preventDefault();
    const daten = e.dataTransfer.getData('text/plain');
    if (!daten) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = Math.max(START, Math.min(ENDE - 15, START + snap((e.clientY - rect.top) / PX)));
    try {
      const p = JSON.parse(daten) as { move?: string; neu?: { art: PlanBlock['art']; titel: string; dauerMin: number }; aufgabe?: { taskId: string; titel: string } };
      if (p.move) {
        speichern(bloecke.map(b => b.id === p.move ? { ...b, date, startMin } : b));
      } else if (p.neu) {
        speichern([...bloecke, { id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, startMin, dauerMin: p.neu.dauerMin, titel: p.neu.titel, art: p.neu.art }]);
      } else if (p.aufgabe) {
        speichern([...bloecke, { id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, startMin, dauerMin: 60, titel: p.aufgabe.titel, art: 'aufgabe', taskId: p.aufgabe.taskId }]);
      }
    } catch { /* kein gültiges Paket */ }
  }

  const offeneAufgaben = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const geplant = new Set(bloecke.filter(b => b.taskId).map(b => b.taskId));
    // Fokus-Regler lenkt die Vorsortierung — Priorität schlägt den Regler aber immer.
    const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
    return tasksState.tasks
      .filter(t => t.status !== 'done' && !geplant.has(t.id))
      .sort((a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        boost(b) - boost(a) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 8)
      .map(t => ({ ...t, imFokus: boost(t) >= FOKUS_SCHWELLE }));
  }, [tasksState, bloecke, regler]);

  async function jarvisBelegen() {
    setDenkt(true); setVorschlag(null);
    try {
      const r = await fetch('/api/planung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ woche: wochenKey }) });
      const d = await r.json();
      if (Array.isArray(d.bloecke)) setVorschlag({ begruendung: d.begruendung ?? '', bloecke: d.bloecke, verworfen: d.verworfen ?? 0 });
    } catch { /* still */ }
    setDenkt(false);
  }

  const stunden = Array.from({ length: (ENDE - START) / 60 }, (_, i) => START / 60 + i);
  const wochenLabel = `${tage[0].slice(8)}.${tage[0].slice(5, 7)}. – ${tage[6].slice(8)}.${tage[6].slice(5, 7)}.${tage[6].slice(0, 4)}`;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '26px clamp(12px,2vw,28px) 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={lbl}>Wochenplaner · {wochenLabel}</div>
            {/* Wochen-Kapazität: was ist verplant, was drückt an Aufgabenlast? */}
            {(() => {
              const planMin = bloecke.reduce((s, b) => s + b.dauerMin, 0);
              const fixMin = fix.reduce((s, f) => s + f.dauerMin, 0);
              const offeneN = tasksState.tasks.filter(t => t.status !== 'done').length;
              const faelligWoche = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= tage[0] && t.dueDate <= tage[6]).length;
              const gesamtH = (planMin + fixMin) / 60;
              return (
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: gesamtH > 50 ? T.amber : T.muted, marginTop: 4 }}>
                  {gesamtH.toFixed(1).replace('.', ',')} h belegt ({(fixMin / 60).toFixed(1).replace('.', ',')} h Termine · {(planMin / 60).toFixed(1).replace('.', ',')} h Blöcke) · {offeneN} Aufgaben offen, {faelligWoche} fällig diese Woche{gesamtH > 50 ? ' — überladen, Ruhe braucht Luft' : ''}
                </div>
              );
            })()}
            <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Die Woche, beweglich.</h1>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setOffset(o => o - 1)} style={btn()}>‹</button>
            <button onClick={() => setOffset(0)} style={btn(offset === 0)}>heute</button>
            <button onClick={() => setOffset(o => o + 1)} style={btn()}>›</button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: T.inkDim, maxWidth: 720, lineHeight: 1.5, margin: '4px 0 14px' }}>
          Feste Termine stehen fest — alles andere ziehst du aus der Leiste in den Tag und schiebst es, bis der Tag passt.
          Blöcke: <b style={{ color: T.ink }}>anfassen & ziehen</b> zum Verschieben · <b style={{ color: T.ink }}>−/＋</b> für die Dauer · <b style={{ color: T.ink }}>✕</b> löschen.
        </p>

        {/* Ziele im Blick — die Woche plant man gegen Ziele, nicht ins Blaue */}
        {(ziele.monat.length > 0 || ziele.quartal.length > 0) && (
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...lbl }}>Ziele</span>
            {(ziele.fokus?.woche || ziele.fokus?.monat) && <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>◎ {ziele.fokus?.woche || ziele.fokus?.monat}</span>}
            {[...ziele.monat.filter(z => !z.erledigt).slice(0, 3).map(z => ({ ...z, h: 'M' })), ...ziele.quartal.filter(z => !z.erledigt).slice(0, 2).map(z => ({ ...z, h: 'Q' }))].map((z, i) => (
              <Link key={i} href={z.h === 'M' ? '/os/planung/monat' : '/os/planung/quartal'} style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{z.h}</span>
                <span style={{ fontSize: 12, color: T.inkDim }}>{z.titel}</span>
                <span style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.07)', overflow: 'hidden', display: 'inline-block' }}>
                  <span style={{ display: 'block', width: `${z.fortschritt}%`, height: '100%', background: z.fortschritt >= 70 ? T.accent : z.fortschritt >= 40 ? T.amber : T.crit }} />
                </span>
              </Link>
            ))}
            {!ziele.monat.length && <Link href="/os/planung/monat" style={{ fontSize: 12, color: T.accentInk, textDecoration: 'none' }}>Monatsziele anlegen ›</Link>}
          </div>
        )}

        {/* Jarvis belegt die Woche — Vorschlag, den du zurechtschiebst */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={jarvisBelegen} disabled={denkt} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: denkt ? 'default' : 'pointer', background: denkt ? T.line : T.accent, color: denkt ? T.muted : '#04110F' }}>
            {denkt ? 'Jarvis plant …' : '✨ Jarvis belegt die Woche'}
          </button>
          <span style={{ fontSize: 11.5, color: T.muted }}>Reha täglich · Fokus vormittags · Routinen · Aufgaben nach Priorität — um deine festen Termine herum.</span>
        </div>

        {vorschlag && (
          <div style={{ background: T.panel, border: `1px solid ${T.accent}44`, borderRadius: 14, padding: '13px 16px', marginBottom: 12 }}>
            <div style={{ ...lbl, color: T.accent, marginBottom: 5 }}>Jarvis' Vorschlag · {vorschlag.bloecke.length} Blöcke{vorschlag.verworfen ? ` · ${vorschlag.verworfen} verworfen (kollidierten mit Terminen)` : ''}</div>
            <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>{vorschlag.begruendung}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { speichern(vorschlag.bloecke); setVorschlag(null); }} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '8px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', background: T.accent, color: '#04110F' }}>
                Übernehmen — ersetzt die aktuellen Blöcke
              </button>
              <button onClick={() => setVorschlag(null)} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '8px 15px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>
                Verwerfen
              </button>
            </div>
          </div>
        )}

        {/* Leiste: Bausteine · Routinen · Aufgaben */}
        <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...lbl, marginBottom: 7 }}>Bausteine</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BAUSTEINE.map(bs => (
                  <div key={bs.titel} draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ neu: bs }))}
                    style={{ cursor: 'grab', fontSize: 12, fontWeight: 600, color: ART_FARBE[bs.art], border: `1px solid ${ART_FARBE[bs.art]}55`, background: `${ART_FARBE[bs.art]}14`, borderRadius: 8, padding: '6px 11px' }}>
                    {bs.titel} · {bs.dauerMin}m
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...lbl, marginBottom: 7 }}>Routinen <Link href="/os/planung/routinen" style={{ color: T.accentInk, textDecoration: 'none', textTransform: 'none' }}>planen ›</Link></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 460 }}>
                {routinen.map(r => (
                  <div key={r.id} draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ neu: { art: 'routine', titel: r.label, dauerMin: r.dauerMin } }))}
                    style={{ cursor: 'grab', fontSize: 11.5, color: T.amber, border: `1px solid ${T.amber}44`, borderRadius: 7, padding: '4px 9px' }}>
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ ...lbl, marginBottom: 7 }}>Aufgaben einplanen <span style={{ textTransform: 'none' }}>(ziehen · ◎ = <Link href="/os/planung/fokus" style={{ color: T.accentInk, textDecoration: 'none' }}>im Fokus</Link>)</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {offeneAufgaben.map(t => (
                  <div key={t.id} draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ aufgabe: { taskId: t.id, titel: t.title } }))}
                    style={{ cursor: 'grab', fontSize: 11.5, color: t.imFokus ? T.accentInk : '#8FA6FF', border: t.imFokus ? `1px solid ${T.accent}88` : '1px solid #4A6CF755', borderRadius: 7, padding: '4px 9px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.priority === 'critical' ? '‼ ' : ''}{t.imFokus ? '◎ ' : ''}{t.title}
                  </div>
                ))}
                {!offeneAufgaben.length && <span style={{ fontSize: 12, color: T.muted }}>Alles eingeplant oder erledigt.</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Raster */}
        <div style={{ display: 'grid', gridTemplateColumns: `46px repeat(7, minmax(120px, 1fr))`, gap: 4, overflowX: 'auto' }}>
          {/* Zeitspalte */}
          <div>
            <div style={{ height: 34 }} />
            <div style={{ position: 'relative', height: H }}>
              {stunden.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX - 7, right: 6, fontFamily: T.mono, fontSize: 10, color: T.muted }}>{String(h).padStart(2, '0')}</div>
              ))}
            </div>
          </div>

          {tage.map((date, di) => {
            const istHeute = date === heute;
            // Kapazität: verplante Stunden (Blöcke + feste Termine) je Tag —
            // ehrliche Auslastung statt gefühlter Fülle. >8h amber, >10h rot.
            const belegtMin = bloecke.filter(b => b.date === date).reduce((s, b) => s + b.dauerMin, 0)
              + fix.filter(f => f.date === date).reduce((s, f) => s + f.dauerMin, 0);
            const belegtH = belegtMin / 60;
            const lastFarbe = belegtH > 10 ? T.crit : belegtH > 8 ? T.amber : T.muted;
            return (
              <div key={date} style={{ minWidth: 0 }}>
                <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, background: istHeute ? 'rgba(33,181,170,.13)' : T.panel, border: `1px solid ${istHeute ? T.accent : T.line}` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: istHeute ? T.accent : T.inkDim }}>{WD[di]} {date.slice(8)}.{date.slice(5, 7)}.</span>
                  {belegtMin > 0 && <span title={belegtH > 10 ? 'überladen — Ruhe braucht Luft' : belegtH > 8 ? 'voll — Pausen ernst nehmen' : 'Auslastung'}
                    style={{ fontFamily: T.mono, fontSize: 9.5, color: lastFarbe }}>{belegtH.toFixed(1).replace('.', ',')}h</span>}
                </div>
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => dropAufTag(e, date)}
                  style={{ position: 'relative', height: H, background: istHeute ? 'rgba(33,181,170,.04)' : T.panel, border: `1px solid ${istHeute ? 'rgba(33,181,170,.35)' : T.line}`, borderRadius: 10, marginTop: 4 }}
                >
                  {/* Stundenlinien */}
                  {stunden.map(h => (
                    <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX, left: 0, right: 0, borderTop: `1px solid rgba(255,255,255,.045)` }} />
                  ))}

                  {/* Feste Termine (unverrückbar) */}
                  {fix.filter(f => f.date === date).map((f, fi) => {
                    const top = Math.max(0, (f.startMin - START) * PX);
                    const hoehe = Math.max(16, Math.min(H - top, f.dauerMin * PX));
                    return (
                      <div key={fi} title={`${f.titel} · ${mmss(f.startMin)}–${mmss(f.startMin + f.dauerMin)} (fest)`}
                        style={{ position: 'absolute', top, left: 3, right: 3, height: hoehe, background: 'rgba(232,236,234,.07)', borderLeft: `3px solid ${T.inkDim}`, borderRadius: 6, padding: '3px 7px', overflow: 'hidden' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔒 {f.titel}</div>
                        {hoehe > 30 && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{mmss(f.startMin)}–{mmss(f.startMin + f.dauerMin)}</div>}
                      </div>
                    );
                  })}

                  {/* Verschiebbare Blöcke */}
                  {bloecke.filter(b => b.date === date).map(b => {
                    const top = Math.max(0, (b.startMin - START) * PX);
                    const hoehe = Math.max(18, Math.min(H - top, b.dauerMin * PX));
                    const farbe = ART_FARBE[b.art];
                    const aktivB = aktivBlock === b.id;
                    return (
                      <div key={b.id} draggable
                        onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ move: b.id }))}
                        onClick={() => setAktivBlock(aktivB ? null : b.id)}
                        title={`${b.titel} · ${mmss(b.startMin)}–${mmss(b.startMin + b.dauerMin)}`}
                        style={{ position: 'absolute', top, left: 3, right: 3, height: hoehe, cursor: 'grab', background: `${farbe}1e`, borderLeft: `3px solid ${farbe}`, border: aktivB ? `1px solid ${farbe}` : undefined, borderRadius: 6, padding: '3px 7px', overflow: 'hidden', zIndex: aktivB ? 5 : 2 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: farbe, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titel}</div>
                        {hoehe > 30 && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{mmss(b.startMin)}–{mmss(b.startMin + b.dauerMin)}</div>}
                        {aktivB && (
                          <div style={{ position: 'absolute', top: 2, right: 4, display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => speichern(bloecke.map(x => x.id === b.id ? { ...x, dauerMin: Math.max(15, x.dauerMin - 30) } : x))} style={miniBtn(farbe)}>−</button>
                            <button onClick={() => speichern(bloecke.map(x => x.id === b.id ? { ...x, dauerMin: Math.min(480, x.dauerMin + 30) } : x))} style={miniBtn(farbe)}>＋</button>
                            <button onClick={() => { speichern(bloecke.filter(x => x.id !== b.id)); setAktivBlock(null); }} style={miniBtn(T.crit)}>✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>
          🔒 feste Termine (Apple + KEMARIS) · <span style={{ color: ART_FARBE.fokus }}>Fokus</span> · <span style={{ color: ART_FARBE.reha }}>Reha</span> · <span style={{ color: ART_FARBE.routine }}>Routine</span> · <span style={{ color: ART_FARBE.aufgabe }}>Aufgabe</span> · <span style={{ color: ART_FARBE.pause }}>Pause</span> — alles wird automatisch gespeichert.
        </div>
      </div>
    </div>
  );
}

function btn(aktivB = false): React.CSSProperties {
  return { fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${aktivB ? T.accent : T.line}`, background: aktivB ? 'rgba(33,181,170,.14)' : T.panel, color: aktivB ? T.accent : T.inkDim };
}
function miniBtn(farbe: string): React.CSSProperties {
  return { width: 18, height: 18, lineHeight: '14px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: `1px solid ${farbe}66`, background: T.panel, color: farbe, padding: 0 };
}
