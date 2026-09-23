'use client';

import Link from 'next/link';
import { localDay } from '@/lib/zeit';
import { useEffect, useMemo, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { THEME as T } from '@/lib/make-one/os-data';
import { Seitenkopf } from './Seitenkopf';

interface Entry { text?: string; mood?: number; energy?: number; stress?: number; haut?: string; ruecken?: string; flags?: string[]; at?: string; }
type Journal = Record<string, Entry>;
const ymd = (d: Date) => localDay(d);
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

const FLAGS: { id: string; label: string }[] = [
  { id: 'antiinflamm', label: 'Anti-entzündlich gegessen' },
  { id: 'bewegt', label: 'Bewegt / Reha gemacht' },
  { id: 'gutgeschlafen', label: 'Gut geschlafen' },
  { id: 'keincannabis', label: 'Kein Cannabis' },
  { id: 'keinalkohol', label: 'Kein Alkohol' },
];

export function JournalView() {
  const today = ymd(new Date());
  const [journal, setJournal] = useState<Journal>({});
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    fetch('/api/state/journal').then(r => r.json()).then((d: { journal: Journal }) => setJournal(d.journal ?? {})).catch(() => {});
  }, []);

  const spaeter = useNachspeichern<Journal>(next => {
    fetch('/api/state/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      .then(() => setSaved(true)).catch(() => {});
  }, 500);

  const entry = journal[today] ?? {};
  function patch(p: Partial<Entry>) {
    setSaved(false);
    const cur = journal[today] ?? {};
    const next: Journal = { ...journal, [today]: { ...cur, ...p, at: new Date().toISOString() } };
    setJournal(next);
    spaeter(next);
  }
  const toggleFlag = (id: string) => {
    const f = new Set(entry.flags ?? []);
    f.has(id) ? f.delete(id) : f.add(id);
    patch({ flags: Array.from(f) });
  };

  const dots = (label: string, val: number | undefined, set: (n: number) => void, bad = false) => (
    <div>
      <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 7 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const on = (val ?? 0) >= n;
          const c = bad ? T.crit : T.accent;
          return <button key={n} onClick={() => set(n)} aria-label={`${label} ${n}`} style={{ width: 26, height: 26, borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? c : T.line}`, background: on ? c : 'transparent', color: on ? T.void : T.muted, fontFamily: T.mono, fontSize: 12 }}>{n}</button>;
        })}
      </div>
    </div>
  );
  const choice = (label: string, val: string | undefined, opts: { v: string; l: string; bad?: boolean }[], key: 'haut' | 'ruecken') => (
    <div>
      <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 7 }}>
        {opts.map(o => {
          const on = val === o.v;
          const c = o.bad ? T.crit : T.accent;
          return <button key={o.v} onClick={() => patch({ [key]: on ? '' : o.v } as Partial<Entry>)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? c : T.line}`, background: on ? `${c}22` : 'transparent', color: on ? c : T.inkDim }}>{o.l}</button>;
        })}
      </div>
    </div>
  );

  // Verlauf (ohne heute) + Trend
  const history = useMemo(() => Object.entries(journal).filter(([d]) => d !== today).sort((a, b) => b[0].localeCompare(a[0])), [journal, today]);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return journal[ymd(d)] ?? {}; }), [journal]);

  const miniBars = (pick: (e: Entry) => number | undefined, c: string) => (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 34 }}>
      {last14.map((e, i) => { const v = pick(e) ?? 0; return <div key={i} style={{ width: 8, height: `${Math.max(3, (v / 5) * 34)}px`, borderRadius: 2, background: v ? c : 'rgba(255,255,255,.06)' }} />; })}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/gesundheit" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Gesundheit</Link>
        <Seitenkopf
          rubrik={<>Journal · dein Datenweg</>}
          titel={<span suppressHydrationWarning>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</span>}
          satz={<>Kurz festhalten, wie der Tag war — daraus entstehen deine Daten, um den Weg immer wieder anzupassen.</>}
          rechts={<span style={{ fontFamily: T.mono, fontSize: 11, color: saved ? T.accent : T.amber }}>{saved ? 'gespeichert ✓' : 'speichert …'}</span>}
        />

        {/* Tages-Check */}
        <div style={{ ...panel, padding: '20px 22px', margin: '18px 0 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            {dots('Stimmung', entry.mood, n => patch({ mood: n }))}
            {dots('Energie', entry.energy, n => patch({ energy: n }))}
            {dots('Stress', entry.stress, n => patch({ stress: n }), true)}
          </div>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            {choice('Haut (Psoriasis)', entry.haut, [{ v: 'ruhig', l: 'ruhig' }, { v: 'schub', l: 'Schub', bad: true }], 'haut')}
            {choice('Rücken (Bandscheibe)', entry.ruecken, [{ v: 'ok', l: 'ok' }, { v: 'schmerz', l: 'Schmerz', bad: true }], 'ruecken')}
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 8 }}>Heute gelungen</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {FLAGS.map(f => { const on = (entry.flags ?? []).includes(f.id); return <button key={f.id} onClick={() => toggleFlag(f.id)} style={{ fontSize: 12, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.accentSoft : 'transparent', color: on ? T.accentInk : T.inkDim }}>{on ? '✓ ' : ''}{f.label}</button>; })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 8 }}>Was war heute? Was ist dir aufgefallen?</div>
            <textarea value={entry.text ?? ''} onChange={e => patch({ text: e.target.value })} rows={5} placeholder="Frei schreiben …"
              style={{ width: '100%', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '12px 14px', color: T.ink, fontSize: 14, fontFamily: T.sans, resize: 'vertical', lineHeight: 1.55, outline: 'none' }} />
          </div>
        </div>

        {/* Trend */}
        <div style={lbl}>Trend · 14 Tage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, margin: '12px 0 22px' }}>
          {[['Stimmung', (e: Entry) => e.mood, T.accent], ['Energie', (e: Entry) => e.energy, T.accent], ['Stress', (e: Entry) => e.stress, T.crit]].map(([name, pick, c]) => (
            <div key={name as string} style={{ ...panel, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 10 }}>{name as string}</div>
              {miniBars(pick as (e: Entry) => number | undefined, c as string)}
            </div>
          ))}
        </div>

        {/* Verlauf */}
        <div style={lbl}>Verlauf</div>
        <div style={{ ...panel, padding: history.length ? '4px 20px' : '20px', marginTop: 12 }}>
          {history.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>Noch keine früheren Einträge — heute ist der Anfang. 🌱</div>}
          {history.slice(0, 30).map(([date, e], i) => (
            <div key={date} style={{ padding: '13px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim }}>{new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                {typeof e.mood === 'number' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent }}>Stimmung {e.mood}</span>}
                {typeof e.stress === 'number' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.crit }}>Stress {e.stress}</span>}
                {e.haut === 'schub' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.crit }}>Haut-Schub</span>}
                {e.ruecken === 'schmerz' && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.crit }}>Rücken-Schmerz</span>}
              </div>
              {e.text && <div style={{ fontSize: 13, color: T.inkDim, marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.text}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
