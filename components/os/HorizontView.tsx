'use client';

import Link from 'next/link';
// ─── MAKE OS — Planung nach Horizont (Monat · Quartal · Jahr) ───────────────
// Eine Seite je Zeithorizont: Ziele (editierbar, mit Fortschritt) + die
// Aufgaben, die in diesem Zeitraum fällig sind + beim Jahr die Meilensteine
// und der Nordstern. Die Zielebene ÜBER dem Taskmanagement.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { NORDSTERN } from '@/lib/make-one/nordstern-data';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';

interface Ziel { id: string; titel: string; fortschritt: number; notiz?: string; erledigt?: boolean }
interface Meilenstein { id: string; titel: string; bereich: 'business' | 'gesundheit'; faellig?: string; zeitfenster?: string; messlatte?: string; fortschritt: number; erledigt: boolean; erledigtAm?: string }
type Horizont = 'monat' | 'quartal' | 'jahr';

const META: Record<Horizont, { titel: string; claim: string; hinweis: string }> = {
  monat: { titel: 'Monatsplanung', claim: 'Was diesen Monat zählt.', hinweis: '3–5 Ziele — mehr ist Verzettelung.' },
  quartal: { titel: 'Quartalsplanung', claim: 'Die Etappe zum Jahresziel.', hinweis: 'Welche 3 Dinge müssen in 3 Monaten stehen?' },
  jahr: { titel: 'Jahresplanung & Ziele', claim: 'Das Jahr, an dem du dich misst.', hinweis: 'Nordstern + Meilensteine + deine Jahresziele.' },
};

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const col = (v: number) => (v >= 70 ? T.accent : v >= 40 ? T.amber : T.crit);

/** Zeitraum-Grenzen des Horizonts (lokal). */
function zeitraum(h: Horizont): { von: string; bis: string; label: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  if (h === 'monat') {
    const m = d.getMonth();
    return { von: `${y}-${p(m + 1)}-01`, bis: `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}`, label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  }
  if (h === 'quartal') {
    const q = Math.floor(d.getMonth() / 3);
    return { von: `${y}-${p(q * 3 + 1)}-01`, bis: `${y}-${p(q * 3 + 3)}-${p(new Date(y, q * 3 + 3, 0).getDate())}`, label: `Q${q + 1} ${y}` };
  }
  return { von: `${y}-01-01`, bis: `${y}-12-31`, label: String(y) };
}

export function HorizontView({ horizont }: { horizont: Horizont }) {
  const meta = META[horizont];
  const zr = zeitraum(horizont);
  const { state: tasksState } = useTasks();
  const [ziele, setZiele] = useState<Ziel[]>([]);
  const [fokus, setFokus] = useState('');
  const [neu, setNeu] = useState('');
  const [geladen, setGeladen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/ziele').then(r => r.json()).then(d => {
      setZiele(Array.isArray(d[horizont]) ? d[horizont] : []);
      setFokus(d.fokus?.[horizont] ?? '');
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, [horizont]);

  // Meilensteine — pflegbarer Store (Jahr verwaltet, Monat zeigt die nächsten).
  const [ms, setMs] = useState<Meilenstein[]>([]);
  const [msNeu, setMsNeu] = useState({ titel: '', bereich: 'business' as Meilenstein['bereich'], faellig: '' });
  const msTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    fetch('/api/state/meilensteine').then(r => r.json()).then(d => setMs(Array.isArray(d.meilensteine) ? d.meilensteine : [])).catch(() => {});
  }, [horizont]);
  function msPersist(next: Meilenstein[]) {
    setMs(next);
    clearTimeout(msTimer.current);
    msTimer.current = setTimeout(() => {
      fetch('/api/state/meilensteine', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meilensteine: next }) }).catch(() => {});
    }, 500);
  }
  const msPatch = (id: string, p: Partial<Meilenstein>) => msPersist(ms.map(m => m.id === id ? { ...m, ...p } : m));
  const msFaelligLabel = (m: Meilenstein) => m.faellig ? `${m.faellig.slice(8)}.${m.faellig.slice(5, 7)}.` : (m.zeitfenster ?? '');

  function persist(next: Ziel[]) {
    setZiele(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont, ziele: next }) }).catch(() => {});
    }, 500);
  }

  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function fokusSetzen(v: string) {
    setFokus(v);
    clearTimeout(fokusTimer.current);
    fokusTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont, fokus: v }) }).catch(() => {});
    }, 600);
  }

  const addZiel = () => {
    const t = neu.trim();
    if (!t) return;
    persist([...ziele, { id: `z-${Date.now().toString(36)}`, titel: t, fortschritt: 0 }]);
    setNeu('');
  };

  // Aufgaben, die in diesem Zeitraum fällig sind.
  const heute = localDay();
  const faellig = tasksState.tasks
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= zr.von && t.dueDate <= zr.bis)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const schnitt = ziele.length ? Math.round(ziele.reduce((s, z) => s + (z.erledigt ? 100 : z.fortschritt), 0) / ziele.length) : null;

  // Zeitstrahl: Ticks je Horizont, darauf offene Meilensteine + (Monat) fällige Aufgaben.
  const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ticks: StrahlTick[] = (() => {
    const y = zr.von.slice(0, 4);
    if (horizont === 'jahr') return MON_KURZ.map((l, i) => ({ date: `${y}-${p2(i + 1)}-01`, label: l }));
    if (horizont === 'quartal') {
      const m0 = Number(zr.von.slice(5, 7));
      return [0, 1, 2].map(i => ({ date: `${y}-${p2(m0 + i)}-01`, label: MON_KURZ[m0 + i - 1] }));
    }
    const letzter = Number(zr.bis.slice(8));
    return [1, 8, 15, 22, 29].filter(t => t <= letzter).map(t => ({ date: `${zr.von.slice(0, 8)}${p2(t)}`, label: `${t}.` }));
  })();
  const strahlMarker: StrahlMarker[] = ms
    .filter(m => !m.erledigt && m.faellig)
    .map(m => ({ date: m.faellig!, label: m.titel, farbe: m.bereich === 'gesundheit' ? '#58D9CD' : T.amber, symbol: '◇', href: horizont === 'jahr' ? undefined : '/os/planung/jahr' }));
  if (horizont === 'monat') {
    const proTag: Record<string, string[]> = {};
    faellig.forEach(t => { proTag[t.dueDate!] = [...(proTag[t.dueDate!] ?? []), t.title]; });
    Object.keys(proTag).forEach(d => {
      const titel = proTag[d];
      strahlMarker.push({ date: d, label: titel.length === 1 ? titel[0] : `${titel.length} Aufgaben`, farbe: T.inkDim, symbol: '●', titel: titel.join(' · '), href: '/os/aufgaben' });
    });
  }

  // Forecast: Zeit verstrichen vs. Fortschritt — ehrlich gerechnet, nicht geraten.
  const verstrichen = (() => {
    const von = new Date(`${zr.von}T00:00:00`).getTime();
    const bis = new Date(`${zr.bis.slice(0, 8)}${Math.min(31, Number(zr.bis.slice(8)))}T23:59:59`).getTime();
    const jetzt = Date.now();
    if (jetzt <= von) return 0;
    if (jetzt >= bis) return 100;
    return Math.round(((jetzt - von) / (bis - von)) * 100);
  })();
  const prognose = schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>{meta.titel} · {zr.label}</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>{meta.claim}</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 640, lineHeight: 1.5 }}>{meta.hinweis}</p>

        {/* Fokus dieses Horizonts — die eine Richtung, gegen die geplant wird */}
        <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '12px 16px', margin: '16px 0 12px' }}>
          <div style={{ ...lbl, marginBottom: 6 }}>Fokus {horizont === 'jahr' ? 'des Jahres' : horizont === 'quartal' ? 'des Quartals' : 'des Monats'}</div>
          <input value={fokus} onChange={e => fokusSetzen(e.target.value)}
            placeholder={horizont === 'monat' ? 'z. B. Gesundheit stabilisieren + F&F-Kunden onboarden' : 'Woran richtet sich alles aus?'}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 14.5, fontWeight: 600 }} />
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Sichtbar im Wochenplaner und in der Tagesplanung — Jarvis plant dagegen.</div>
        </div>

        {/* Zeitstrahl zuerst — der Zeitraum als Linie: Heute-Anker, Meilensteine, Fälligkeiten */}
        <Zeitstrahl von={zr.von} bis={zr.bis} ticks={ticks} marker={strahlMarker} />

        {/* Forecast — Zeit vs. Fortschritt, deterministisch */}
        {schnitt != null && prognose != null && (
          <div style={{ ...panel, padding: '11px 16px', marginBottom: 12, display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ ...lbl }}>Forecast</span>
            <span style={{ fontSize: 13, color: T.inkDim }}>{verstrichen}% der Zeit vorbei · Ziele bei Ø {schnitt}%</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: prognose >= 95 ? T.accent : prognose >= 70 ? T.amber : T.crit }}>
              → bei diesem Tempo ~{prognose}% am Ende{prognose < 95 ? ' — nachschärfen oder Ziel ehrlich kürzen' : ' — Kurs hält'}
            </span>
          </div>
        )}

        {/* Monat: die nächsten offenen Meilensteine — fällige zuerst, mit Fortschritt */}
        {horizont === 'monat' && (
          <div style={{ ...panel, padding: '14px 20px', marginBottom: 12 }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Meilensteine im Blick <Link href="/os/planung/jahr" style={{ color: T.accentInk, textDecoration: 'none', textTransform: 'none' }}>pflegen ›</Link></div>
            {ms.filter(m => !m.erledigt)
              .sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999'))
              .slice(0, 6)
              .map(m => {
                const spaet = m.faellig && m.faellig < localDay();
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: T.inkDim, lineHeight: 1.7, flexWrap: 'wrap' }}>
                    <span style={{ color: spaet ? T.crit : T.amber }}>◇</span>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{m.titel}</span>
                    {msFaelligLabel(m) && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: spaet ? T.crit : T.muted }}>{spaet ? 'überfällig ' : ''}{msFaelligLabel(m)}</span>}
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: col(m.fortschritt) }}>{m.fortschritt}%</span>
                    {m.messlatte && <span style={{ fontSize: 11.5, color: T.muted }}>· {m.messlatte}</span>}
                  </div>
                );
              })}
            {!ms.filter(m => !m.erledigt).length && <span style={{ fontSize: 12.5, color: T.muted }}>Alle Meilensteine erledigt.</span>}
          </div>
        )}

        {/* Jahr: Nordstern + Meilenstein-Verwaltung (Business & Gesundheit) */}
        {horizont === 'jahr' && (
          <>
            <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px', margin: '18px 0 12px' }}>
              <div style={{ ...lbl, marginBottom: 6 }}>Nordstern</div>
              <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>{NORDSTERN}</div>
            </div>
            {(['business', 'gesundheit'] as const).map(bereich => (
              <div key={bereich} style={{ ...panel, borderLeft: `3px solid ${bereich === 'gesundheit' ? '#58D9CD' : T.accent}`, padding: '14px 20px', marginBottom: 12 }}>
                <div style={{ ...lbl, marginBottom: 10, color: bereich === 'gesundheit' ? '#58D9CD' : T.muted }}>
                  Meilensteine · {bereich === 'gesundheit' ? 'Gesundheit' : 'Business'} <span style={{ textTransform: 'none' }}>(fließen in den MAKE Score)</span>
                </div>
                {ms.filter(m => m.bereich === bereich).map(m => (
                  <div key={m.id} style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', padding: '5px 0', borderBottom: `1px solid ${T.lineSoft}` }}>
                    <span onClick={() => msPatch(m.id, { erledigt: !m.erledigt, fortschritt: !m.erledigt ? 100 : m.fortschritt, erledigtAm: !m.erledigt ? localDay() : undefined })}
                      style={{ width: 17, height: 17, borderRadius: 5, border: `1px solid ${m.erledigt ? T.accent : T.line}`, background: m.erledigt ? `${T.accent}22` : 'transparent', color: T.accent, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', cursor: 'pointer' }}>
                      {m.erledigt ? <span className="check-pop">✓</span> : ''}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: m.erledigt ? T.muted : T.ink, textDecoration: m.erledigt ? 'line-through' : 'none', minWidth: 140 }}>{m.titel}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: m.faellig && m.faellig < localDay() && !m.erledigt ? T.crit : T.muted }}>{msFaelligLabel(m)}</span>
                    {!m.erledigt && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                        <input type="range" min={0} max={100} step={5} value={m.fortschritt}
                          onChange={e => msPatch(m.id, { fortschritt: Number(e.target.value) })}
                          style={{ width: 90, accentColor: col(m.fortschritt) }} />
                        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: col(m.fortschritt), width: 34, textAlign: 'right' }}>{m.fortschritt}%</span>
                        <button onClick={() => msPersist(ms.filter(x => x.id !== m.id))} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </span>
                    )}
                    {m.messlatte && <span style={{ flexBasis: '100%', fontSize: 11.5, color: T.muted, paddingLeft: 26 }}>Messlatte: {m.messlatte}</span>}
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={msNeu.titel} onChange={e => setMsNeu({ ...msNeu, titel: e.target.value })} placeholder="Neuer Meilenstein …"
                style={{ flex: 1, minWidth: 180, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 12px', outline: 'none' }} />
              <input type="date" value={msNeu.faellig} onChange={e => setMsNeu({ ...msNeu, faellig: e.target.value })}
                style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.ink, fontFamily: T.mono, fontSize: 12, padding: '8px 10px', outline: 'none' }} />
              <select value={msNeu.bereich} onChange={e => setMsNeu({ ...msNeu, bereich: e.target.value as Meilenstein['bereich'] })}
                style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.ink, fontFamily: T.sans, fontSize: 12.5, padding: '8px 10px', outline: 'none' }}>
                <option value="business" style={{ background: T.panel }}>Business</option>
                <option value="gesundheit" style={{ background: T.panel }}>Gesundheit</option>
              </select>
              <button onClick={() => {
                if (!msNeu.titel.trim()) return;
                msPersist([...ms, { id: `ms-${Date.now().toString(36)}`, titel: msNeu.titel.trim(), bereich: msNeu.bereich, faellig: msNeu.faellig || undefined, fortschritt: 0, erledigt: false }]);
                setMsNeu({ titel: '', bereich: msNeu.bereich, faellig: '' });
              }}
                style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.accent, color: '#04110F' }}>+ Meilenstein</button>
            </div>
          </>
        )}

        {/* Ziele */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '18px 0 9px' }}>
          <div style={lbl}>Ziele ({ziele.length})</div>
          {schnitt != null && <span style={{ fontFamily: T.mono, fontSize: 11, color: col(schnitt) }}>Ø {schnitt}%</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addZiel(); }}
            placeholder={`Neues ${horizont === 'jahr' ? 'Jahres' : horizont === 'quartal' ? 'Quartals' : 'Monats'}ziel …`}
            style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13.5, padding: '10px 13px', outline: 'none' }} />
          <button onClick={addZiel} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.accent, color: '#04110F' }}>+ Ziel</button>
        </div>

        {!geladen ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade …</div>
        ) : !ziele.length ? (
          <div style={{ ...panel, padding: '20px', textAlign: 'center', color: T.inkDim, fontSize: 13, lineHeight: 1.5 }}>
            Noch keine Ziele für {zr.label}. Was soll am Ende stehen?
          </div>
        ) : (
          <div style={{ ...panel, overflow: 'hidden', marginBottom: 18 }}>
            {ziele.map((z, i) => (
              <div key={z.id} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, opacity: z.erledigt ? 0.5 : 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => persist(ziele.map(x => x.id === z.id ? { ...x, erledigt: !x.erledigt } : x))}
                    style={{ width: 22, height: 22, borderRadius: 6, cursor: 'pointer', border: `1px solid ${z.erledigt ? T.accent : T.line}`, background: z.erledigt ? `${T.accent}22` : 'transparent', color: T.accent, fontSize: 12, flex: '0 0 auto' }}>
                    {z.erledigt ? '✓' : ''}
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, textDecoration: z.erledigt ? 'line-through' : 'none', flex: 1, minWidth: 160 }}>{z.titel}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                    <input type="range" min={0} max={100} step={5} value={z.erledigt ? 100 : z.fortschritt}
                      onChange={e => persist(ziele.map(x => x.id === z.id ? { ...x, fortschritt: Number(e.target.value) } : x))}
                      disabled={z.erledigt} style={{ width: 120, accentColor: col(z.erledigt ? 100 : z.fortschritt) }} />
                    <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: col(z.erledigt ? 100 : z.fortschritt), width: 38, textAlign: 'right' }}>{z.erledigt ? 100 : z.fortschritt}%</span>
                  </div>
                  <button onClick={() => persist(ziele.filter(x => x.id !== z.id))}
                    style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Aufgaben im Zeitraum */}
        <div style={{ ...lbl, margin: '18px 0 9px' }}>Fällig in {zr.label} ({faellig.length})</div>
        {!faellig.length ? (
          <div style={{ fontSize: 12.5, color: T.muted }}>Keine terminierten Aufgaben in diesem Zeitraum.</div>
        ) : (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {faellig.slice(0, 15).map((t, i) => (
              <Link key={t.id} href="/os/aufgaben" style={{ display: 'flex', gap: 12, padding: '10px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, textDecoration: 'none', alignItems: 'baseline' }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: t.dueDate && t.dueDate < heute ? T.crit : T.muted, flex: '0 0 auto', width: 78 }}>{t.dueDate}</span>
                <span style={{ fontSize: 13.5, color: T.ink, flex: 1 }}>{t.title}</span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: t.priority === 'critical' ? T.crit : T.muted }}>{t.priority}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
