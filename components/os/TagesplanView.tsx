'use client';

import Link from 'next/link';
// ─── MAKE OS — Tagesplanung ─────────────────────────────────────────────────
// Kevins Tages-Cockpit: oben stehen die FOKUSTHEMEN (Monats-Fokus + Bereiche
// mit hohem Fokus-Regler), darunter der ganze Tag als Kalender — auch wenn
// keine Termine da sind. Lücken sind sichtbar, und wie im Wochenplaner zieht
// man Bausteine, Routinen und Aufgaben einfach rein. Die Blöcke sind DIESELBEN
// wie im Wochenplaner (gleicher Store) — hier bearbeitet man nur den heutigen
// Tag, der Rest der Woche bleibt unangetastet.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { THEME as T } from '@/lib/make-one/os-data';
import { ART_FARBE, type PlanBlock } from '@/types/planer';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { wochenplanSchreiben } from '@/lib/make-one/wochenplan-sync';
import { SAEULE_VON_PROJEKT, KATEGORIE_ZU_SAEULE, SAEULE_LABEL, SAEULE_FARBE, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';

interface Routine { id: string; label: string; wann: 'morgen' | 'tag' | 'abend'; kategorie: string; dauerMin: number; aktiv: boolean }
interface Fix { titel: string; startMin: number; dauerMin: number }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const KATEGORIE_FARBE: Record<string, string> = { gesundheit: '#58D9CD', leben: '#C77DFF', business: '#4A6CF7' };
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (min: number) => Math.round(min / 15) * 15;

// Raster wie im Wochenplaner: 06:00–22:00.
const START = 6 * 60, ENDE = 22 * 60, PX = 0.85;
const H = (ENDE - START) * PX;

/**
 * Kevins Ansage: „Nimm im Planer auch viele Standards mit dabei." Das sind die
 * Bausteine, aus denen ein Tag bei Kevin und Malin tatsächlich besteht —
 * einmal anklicken statt jedes Mal neu tippen.
 */
const BAUSTEINE: { art: PlanBlock['art']; titel: string; dauerMin: number }[] = [
  { art: 'fokus', titel: 'Fokus (Deep Work)', dauerMin: 90 },
  { art: 'fokus', titel: 'Kurzer Fokus', dauerMin: 45 },
  { art: 'reha', titel: 'Reha / Rücken', dauerMin: 30 },
  { art: 'reha', titel: 'Bewegung / Spaziergang', dauerMin: 30 },
  { art: 'pause', titel: 'Pause', dauerMin: 15 },
  { art: 'pause', titel: 'Mittag', dauerMin: 45 },
  { art: 'block', titel: 'Blockzeit', dauerMin: 60 },
  { art: 'block', titel: 'Postfach leeren', dauerMin: 30 },
  { art: 'block', titel: 'Telefonate / Rückrufe', dauerMin: 45 },
  { art: 'block', titel: 'Finanzen & Rechnungen', dauerMin: 60 },
  { art: 'block', titel: 'Termin mit Malin', dauerMin: 60 },
  { art: 'routine', titel: 'Tagesstart', dauerMin: 15 },
  { art: 'routine', titel: 'Tagesende', dauerMin: 15 },
];

const neuId = () => `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}

export function TagesplanView({ tag }: { tag?: string } = {}) {
  // Kevins Ansage: den nächsten Tag angucken können. Ohne Anker ist es heute.
  const heute = tag ?? localDay();
  const istHeute = heute === localDay();
  const woche = montagVon(heute);
  const { state: tasksState } = useTasks();
  const [wocheBloecke, setWocheBloecke] = useState<PlanBlock[]>([]);
  const [fix, setFix] = useState<Fix[]>([]);
  const [routinen, setRoutinen] = useState<Routine[]>([]);
  const [hlog, setHlog] = useState<Record<string, string[]>>({});
  const [fokusAlle, setFokusAlle] = useState<Record<string, string>>({});
  const [ziele, setZiele] = useState<{ titel: string; fortschritt: number }[]>([]);
  const [regler, setRegler] = useState<Record<string, number>>({});
  const [aktivBlock, setAktivBlock] = useState<string | null>(null);
  const [jetztMin, setJetztMin] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Stand, wie er zuletzt gelesen/geschrieben wurde — Basis für die Unterschiede. */
  const gespeichert = useRef<PlanBlock[] | null>(null);
  /** Ein Speichervorgang steht aus — dann keinen Abgleich dazwischenschieben. */
  const speichernSteht = useRef(false);
  const hSpaeter = useNachspeichern<Record<string, string[]>>(next => {
    fetch('/api/state/health', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  }, 300);

  useEffect(() => {
    fetch(`/api/state/wochenplan?woche=${woche}`).then(r => r.json())
      .then(d => {
        const geladen = Array.isArray(d.bloecke) ? d.bloecke : [];
        gespeichert.current = geladen;
        setWocheBloecke(geladen);
      }).catch(() => {});
    Promise.all([
      fetch('/api/apple-calendar').then(r => r.json()).catch(() => []),
      fetch('/api/kemaris-calendar').then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([apple, kem]) => {
      const roh = [
        ...(Array.isArray(apple) ? apple : []).filter((e: { allDay?: boolean; startDate?: string }) => !e.allDay && e.startDate?.slice(0, 10) === heute)
          .map((e: { title?: string; startDate?: string; endDate?: string }) => ({ t: e.title ?? '', s: e.startDate!, e: e.endDate })),
        ...((kem?.events ?? []) as { title?: string; start?: string; end?: string }[]).filter(e => e.start?.slice(0, 10) === heute)
          .map(e => ({ t: e.title ?? '', s: e.start!, e: e.end })),
      ];
      const gesehen = new Set<string>();
      setFix(roh.filter(e => {
        const k = `${e.t.toLowerCase().trim()}|${e.s.slice(0, 16)}`;
        if (gesehen.has(k)) return false; gesehen.add(k); return true;
      }).map(e => {
        const s = new Date(e.s), en = e.e ? new Date(e.e) : null;
        return { titel: e.t, startMin: s.getHours() * 60 + s.getMinutes(), dauerMin: en ? Math.max(15, Math.round((en.getTime() - s.getTime()) / 60000)) : 60 };
      }));
    });
    fetch('/api/state/routinen').then(r => r.json()).then(d => setRoutinen((d.routinen ?? []).filter((x: Routine) => x.aktiv))).catch(() => {});
    fetch('/api/state/health').then(r => r.json()).then(d => setHlog(d.log ?? {})).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => { setFokusAlle(d.fokus ?? {}); setZiele((d.monat ?? []).filter((z: { erledigt?: boolean }) => !z.erledigt)); }).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
  }, [heute, woche]);

  // Jetzt-Linie erst nach dem Mount setzen (kein Hydration-Versatz), dann mitlaufen lassen.
  useEffect(() => {
    const tick = () => { const d = new Date(); setJetztMin(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
  }, []);

  const meine = useMemo(() => wocheBloecke.filter(b => b.date === heute), [wocheBloecke, heute]);

  /** Heutige Blöcke ersetzen, Rest der Woche unangetastet lassen, debounced
   *  sichern — als Einzel-Änderungen, damit Malins Fenster nichts verliert. */
  function speichern(nextHeute: PlanBlock[]) {
    const alle = [...wocheBloecke.filter(b => b.date !== heute), ...nextHeute];
    setWocheBloecke(alle);
    clearTimeout(saveTimer.current);
    speichernSteht.current = true;
    saveTimer.current = setTimeout(() => {
      speichernSteht.current = false;
      const alt = gespeichert.current;
      gespeichert.current = alle;
      void wochenplanSchreiben(woche, alt, alle);
    }, 500);
  }

  // Regelmäßiger Abgleich mit dem Bestand — nie mitten in einem eigenen Zug.
  useEffect(() => {
    const iv = setInterval(() => {
      if (speichernSteht.current) return;
      fetch(`/api/state/wochenplan?woche=${woche}`).then(r => r.json()).then(d => {
        if (speichernSteht.current) return;
        const neu = Array.isArray(d.bloecke) ? d.bloecke : [];
        if (JSON.stringify(neu) !== JSON.stringify(gespeichert.current ?? [])) {
          gespeichert.current = neu;
          setWocheBloecke(neu);
        }
      }).catch(() => { /* nächste Runde */ });
    }, 60_000);
    return () => clearInterval(iv);
  }, [woche]);

  function dropAufKalender(e: React.DragEvent) {
    e.preventDefault();
    const daten = e.dataTransfer.getData('text/plain');
    if (!daten) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = Math.max(START, Math.min(ENDE - 15, START + snap((e.clientY - rect.top) / PX)));
    try {
      const p = JSON.parse(daten) as { move?: string; neu?: { art: PlanBlock['art']; titel: string; dauerMin: number }; aufgabe?: { taskId: string; titel: string } };
      if (p.move) {
        speichern(meine.map(b => b.id === p.move ? { ...b, startMin } : b));
      } else if (p.neu) {
        speichern([...meine, { id: neuId(), date: heute, startMin, dauerMin: p.neu.dauerMin, titel: p.neu.titel, art: p.neu.art }]);
      } else if (p.aufgabe) {
        speichern([...meine, { id: neuId(), date: heute, startMin, dauerMin: 60, titel: p.aufgabe.titel, art: 'aufgabe', taskId: p.aufgabe.taskId }]);
      }
    } catch { /* kein gültiges Paket */ }
  }

  // Der Fokus des Tages — fällt auf Woche, dann Monat zurück.
  const fokusText = fokusAlle.tag || fokusAlle.woche || fokusAlle.monat || '';
  const fokusQuelle = fokusAlle.tag ? 'Tag' : fokusAlle.woche ? 'Woche' : fokusAlle.monat ? 'Monat' : '';

  // ── Fokusbereiche: Regler ≥ Schwelle + grobe Stichwort-Erkennung aus den Fokus-Texten ──
  const fokusSaeulen = useMemo(() => {
    const s = new Set<string>();
    for (const [k, v] of Object.entries(regler)) if (v >= FOKUS_SCHWELLE) s.add(k);
    const ft = `${fokusAlle.tag ?? ''} ${fokusAlle.woche ?? ''} ${fokusAlle.monat ?? ''}`.toLowerCase();
    if (/gesund|reha|rücken|schlaf|energie|stabilisier/.test(ft)) s.add('health');
    if (/kunde|umsatz|vertrieb|launch|f&f|capos|pipeline|onboard/.test(ft)) s.add('business');
    if (/malin|familie|beziehung|team/.test(ft)) s.add('social');
    return s;
  }, [regler, fokusAlle]);
  const passtZumFokus = (r: Routine) => fokusSaeulen.has(KATEGORIE_ZU_SAEULE[r.kategorie] ?? '');

  // Routine-Häkchen — derselbe Store wie im Gesundheits-Cockpit.
  const erledigt = new Set(hlog[heute] ?? []);
  function toggleRoutine(id: string) {
    const tag = new Set(hlog[heute] ?? []);
    tag.has(id) ? tag.delete(id) : tag.add(id);
    const next = { ...hlog, [heute]: Array.from(tag) };
    setHlog(next);
    hSpaeter(next);
  }

  // ── Aufgaben-Leiste: Priorität schlägt immer, dann Fokus-Regler, dann Fälligkeit ──
  const offeneAufgaben = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const geplant = new Set(wocheBloecke.filter(b => b.taskId).map(b => b.taskId));
    const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
    return tasksState.tasks
      .filter(t => t.status !== 'done' && !geplant.has(t.id))
      .sort((a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        boost(b) - boost(a) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 8)
      .map(t => ({ ...t, imFokus: boost(t) >= FOKUS_SCHWELLE }));
  }, [tasksState, wocheBloecke, regler]);

  // ── Tageslücken: freie Fenster ≥30 Min zwischen 07 und 21 Uhr ──
  const luecken = useMemo(() => {
    const belegt = [
      ...fix.map(f => [f.startMin, f.startMin + f.dauerMin] as [number, number]),
      ...meine.map(b => [b.startMin, b.startMin + b.dauerMin] as [number, number]),
    ].map(([s, e]) => [Math.max(s, 7 * 60), Math.min(e, 21 * 60)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const out: { von: number; bis: number }[] = [];
    let cursor = 7 * 60;
    for (const [s, e] of belegt) {
      if (s - cursor >= 30) out.push({ von: cursor, bis: s });
      cursor = Math.max(cursor, e);
    }
    if (21 * 60 - cursor >= 30) out.push({ von: cursor, bis: 21 * 60 });
    return out;
  }, [fix, meine]);

  // ── Durchgeplant-Check (deterministisch, keine KI) ──
  const faelligHeute = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate === heute);
  const ueberfaellig = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < heute);
  const geplantTasks = new Set(meine.filter(b => b.taskId).map(b => b.taskId));
  const check = useMemo(() => {
    const fokusMin = meine.filter(b => b.art === 'fokus').reduce((s, b) => s + b.dauerMin, 0);
    const wochenende = [0, 6].includes(new Date(`${heute}T12:00:00`).getDay());
    // Kollisionen: Blöcke, die sich mit festen Terminen oder untereinander überlappen.
    const intervalle = [
      ...fix.map(f => ({ s: f.startMin, e: f.startMin + f.dauerMin })),
      ...meine.map(b => ({ s: b.startMin, e: b.startMin + b.dauerMin })),
    ];
    let kollisionen = 0;
    for (let i = 0; i < intervalle.length; i++) {
      for (let k = i + 1; k < intervalle.length; k++) {
        if (intervalle[i].s < intervalle[k].e && intervalle[k].s < intervalle[i].e) kollisionen++;
      }
    }
    return [
      { ok: meine.some(b => b.art === 'reha'), text: 'Reha' },
      { ok: wochenende || fokusMin >= 90, text: wochenende ? 'Wochenende' : '90 Min Fokus' },
      { ok: faelligHeute.every(t => geplantTasks.has(t.id)), text: 'Fälliges im Plan' },
      { ok: meine.some(b => b.art === 'routine' && b.startMin < 10 * 60) || erledigt.size > 0, text: 'Morgenroutine' },
      { ok: kollisionen === 0, text: kollisionen ? `${kollisionen} Kollision${kollisionen > 1 ? 'en' : ''}` : 'Keine Kollisionen' },
      { ok: meine.length + fix.length <= 10, text: 'Nicht überladen' },
    ];
  }, [meine, fix, faelligHeute, geplantTasks, erledigt, heute]);
  const okN = check.filter(c => c.ok).length;

  const stunden = Array.from({ length: (ENDE - START) / 60 }, (_, i) => START / 60 + i);
  const datum = new Date(`${heute}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const sortiertNachFokus = (a: Routine, b: Routine) => Number(passtZumFokus(b)) - Number(passtZumFokus(a));

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <PlanerLeiste aktiv="tag" tag={heute} />
        <div style={lbl}>Tagesplanung · {datum}</div>

        {/* ── Die Fokusthemen stehen über dem Tag ── */}
        <h1 style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 6px', lineHeight: 1.3 }}>
          {fokusText
            ? <><span style={{ color: T.accent }}>◎</span> {fokusText}{fokusQuelle !== 'Tag' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 8, verticalAlign: 'middle' }}>{fokusQuelle.toUpperCase()}</span>}</>
            : <>Worauf es heute ankommt <Link href="/os" style={{ fontSize: 13, color: T.accentInk, textDecoration: 'none', fontWeight: 400 }}>Fokus setzen ›</Link></>}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {Array.from(fokusSaeulen).map(s => (
            <span key={s} style={{ fontSize: 11.5, fontWeight: 600, color: SAEULE_FARBE[s] ?? T.inkDim, border: `1px solid ${SAEULE_FARBE[s] ?? T.line}55`, borderRadius: 7, padding: '3px 9px' }}>
              {SAEULE_LABEL[s] ?? s}
            </span>
          ))}
          {ziele.slice(0, 3).map((z, i) => (
            <span key={`z${i}`} style={{ fontSize: 12, color: T.inkDim }}>{z.titel} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{z.fortschritt}%</span></span>
          ))}
          <Link href="/os/planung/fokus" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>Regler ›</Link>
        </div>

        {/* ── Kompakter Durchgeplant-Check ── */}
        <div style={{ ...panel, borderLeft: `3px solid ${okN === check.length ? T.accent : okN >= 3 ? T.amber : T.crit}`, padding: '9px 14px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: okN === check.length ? T.accent : okN >= 3 ? T.amber : T.crit }}>{okN}/{check.length}</span>
          {check.map((c, i) => (
            <span key={i} style={{ fontSize: 12, color: c.ok ? T.inkDim : T.crit }}>
              <span style={{ color: c.ok ? T.accent : T.crit }}>{c.ok ? '✓' : '✗'}</span> {c.text}
            </span>
          ))}
          {ueberfaellig.length > 0 && <span style={{ fontSize: 12, color: T.crit }}>⚠ {ueberfaellig.length} überfällig</span>}
          <Link href="/os/planung/woche" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>Wochenplaner ›</Link>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ── Der Tag als Kalender — Lücken sichtbar, alles reinziehbar ── */}
          <div style={{ flex: '0 1 400px', minWidth: 300 }}>
            <div style={{ ...lbl, marginBottom: 7 }}>Der Tag <span style={{ textTransform: 'none' }}>(ziehen wie im Wochenplaner)</span></div>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Zeitspalte */}
              <div style={{ position: 'relative', height: H, width: 42, flex: '0 0 auto' }}>
                {stunden.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX - 5, right: 6, fontFamily: T.mono, fontSize: 11, color: T.muted }}>{String(h).padStart(2, '0')}:00</div>
                ))}
              </div>
              {/* Tagesspalte */}
              <div onDragOver={e => e.preventDefault()} onDrop={dropAufKalender}
                style={{ position: 'relative', height: H, flex: 1, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden' }}>
                {stunden.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX, left: 0, right: 0, borderTop: `1px solid ${T.line}55` }} />
                ))}
                {/* Jetzt-Linie */}
                {istHeute && jetztMin !== null && jetztMin >= START && jetztMin <= ENDE && (
                  <div style={{ position: 'absolute', top: (jetztMin - START) * PX, left: 0, right: 0, borderTop: `2px solid ${T.crit}`, zIndex: 3 }}>
                    <span style={{ position: 'absolute', right: 4, top: -14, fontFamily: T.mono, fontSize: 11, color: T.crit }}>{mm(jetztMin)}</span>
                  </div>
                )}
                {/* Feste Termine — unverrückbar */}
                {fix.map((f, i) => (
                  <div key={`fix${i}`} style={{ position: 'absolute', top: (f.startMin - START) * PX, height: Math.max(16, f.dauerMin * PX - 2), left: 4, right: 4, background: `${T.line}88`, border: `1px solid ${T.line}`, borderRadius: 7, padding: '2px 8px', fontSize: 11, color: T.inkDim, overflow: 'hidden', zIndex: 1 }}>
                    🔒 {mm(f.startMin)} {f.titel}
                  </div>
                ))}
                {/* Bewegliche Blöcke */}
                {meine.map(b => {
                  const aktiv = aktivBlock === b.id;
                  const farbe = ART_FARBE[b.art] ?? T.muted;
                  return (
                    <div key={b.id} draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ move: b.id }))}
                      onClick={() => setAktivBlock(aktiv ? null : b.id)}
                      style={{ position: 'absolute', top: (b.startMin - START) * PX, height: Math.max(18, b.dauerMin * PX - 2), left: 4, right: 4, background: `${farbe}26`, border: `1px solid ${farbe}${aktiv ? '' : '66'}`, borderRadius: 7, padding: '2px 8px', fontSize: 11.5, color: T.ink, overflow: 'hidden', cursor: 'grab', zIndex: 2 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: farbe }}>{mm(b.startMin)}</span> {b.titel}
                      {aktiv && (
                        <span style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => speichern(meine.map(x => x.id === b.id ? { ...x, dauerMin: Math.max(15, x.dauerMin - 30) } : x))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 5, color: T.inkDim, fontSize: 11, cursor: 'pointer', padding: '0 5px' }}>−</button>
                          <button onClick={() => speichern(meine.map(x => x.id === b.id ? { ...x, dauerMin: Math.min(240, x.dauerMin + 30) } : x))} style={{ background: 'none', border: `1px solid ${T.line}`, borderRadius: 5, color: T.inkDim, fontSize: 11, cursor: 'pointer', padding: '0 5px' }}>＋</button>
                          <button onClick={() => { speichern(meine.filter(x => x.id !== b.id)); setAktivBlock(null); }} style={{ background: 'none', border: `1px solid ${T.crit}66`, borderRadius: 5, color: T.crit, fontSize: 11, cursor: 'pointer', padding: '0 5px' }}>✕</button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Rechte Spalte: Lücken, Bausteine, Aufgaben, Routinen ── */}
          <div style={{ flex: '1 1 320px', minWidth: 290, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Tageslücken */}
            <div style={{ ...panel, padding: '12px 16px' }}>
              <div style={{ ...lbl, marginBottom: 7 }}>Tageslücken <span style={{ textTransform: 'none' }}>(frei ≥30 Min · füllen durch Reinziehen)</span></div>
              {luecken.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {luecken.map((l, i) => (
                    <span key={i} style={{ fontFamily: T.mono, fontSize: 11.5, color: T.accentInk, border: `1px solid ${T.accent}44`, borderRadius: 7, padding: '3px 9px' }}>
                      {mm(l.von)}–{mm(l.bis)} · {Math.round((l.bis - l.von) / 15) * 15} min
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: T.muted }}>Keine Lücke ≥30 Min zwischen 07 und 21 Uhr — voller Tag.</span>
              )}
            </div>

            {/* Bausteine + Aufgaben */}
            <div style={{ ...panel, padding: '12px 16px' }}>
              <div style={{ ...lbl, marginBottom: 7 }}>Bausteine</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {/* Schlüssel ist der Titel, nicht die Art: „block" kommt
                    sechsmal vor — mit `art` verlieren die Bausteine beim
                    Ziehen ihre Identität. */}
                {BAUSTEINE.map(bs => (
                  <div key={bs.titel} draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ neu: { art: bs.art, titel: bs.titel, dauerMin: bs.dauerMin } }))}
                    style={{ cursor: 'grab', fontSize: 11.5, color: ART_FARBE[bs.art], border: `1px solid ${ART_FARBE[bs.art]}44`, borderRadius: 7, padding: '4px 9px' }}>
                    {bs.titel} · {bs.dauerMin}m
                  </div>
                ))}
              </div>
              <div style={{ ...lbl, marginBottom: 7 }}>Aufgaben einplanen <span style={{ textTransform: 'none' }}>(◎ = <Link href="/os/planung/fokus" style={{ color: T.accentInk, textDecoration: 'none' }}>im Fokus</Link>)</span></div>
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

            {/* Routinen heute — Fokus-passende zuerst (◎), dieselben Häkchen wie im Cockpit */}
            <div style={{ ...panel, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
                <div style={lbl}>Routinen heute</div>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: erledigt.size ? T.accent : T.muted }}>{Array.from(erledigt).filter(id => routinen.some(r => r.id === id)).length}/{routinen.length}</span>
                <span style={{ fontSize: 11, color: T.muted }}>◎ zahlt auf den Fokus ein · auch in den Tag ziehbar</span>
                <Link href="/os/planung/routinen" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>planen ›</Link>
              </div>
              {(['morgen', 'tag', 'abend'] as const).map(wann => {
                const eigene = routinen.filter(r => r.wann === wann).sort(sortiertNachFokus);
                if (!eigene.length) return null;
                return (
                  <div key={wann} style={{ marginBottom: 8 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>{wann === 'morgen' ? 'Morgens' : wann === 'tag' ? 'Tagsüber' : 'Abends'}</div>
                    {eigene.map(r => {
                      const done = erledigt.has(r.id);
                      const imFokus = passtZumFokus(r);
                      return (
                        <div key={r.id} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '4px 0' }}>
                          <span onClick={() => toggleRoutine(r.id)} style={{ width: 17, height: 17, borderRadius: 5, border: `1px solid ${done ? T.accent : T.line}`, background: done ? `${T.accent}22` : 'transparent', color: T.accent, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', cursor: 'pointer' }}>{done ? <span className="check-pop">✓</span> : ''}</span>
                          <span draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ neu: { art: 'routine', titel: r.label, dauerMin: r.dauerMin } }))}
                            onClick={() => toggleRoutine(r.id)}
                            style={{ fontSize: 12.5, color: done ? T.muted : T.inkDim, textDecoration: done ? 'line-through' : 'none', cursor: 'grab' }}>
                            {imFokus ? <span style={{ color: KATEGORIE_FARBE[r.kategorie] ?? T.accent }}>◎ </span> : ''}{r.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
