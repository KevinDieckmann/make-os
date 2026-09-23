'use client';

import Link from 'next/link';
import { localDay } from '@/lib/zeit';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { WOCHE, type BlockKind } from '@/lib/make-one/health-data';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

const KIND: Record<BlockKind, { c: string; l: string }> = {
  health: { c: T.accent, l: 'Gesundheit / Reha' },
  move: { c: '#5FB97E', l: 'Bewegung' },
  ruhe: { c: T.amber, l: 'Ruhe & Rituale' },
  focus: { c: '#8AA0C8', l: 'Fokuszeit (geschützt)' },
  business: { c: T.muted, l: 'Business' },
};

export function WochenView() {
  // Erst im Browser bestimmen: der Server kennt eine andere Zeitzone und
  // würde nachts die falsche Spalte hervorheben (Hydration-Fehler).
  const [todayIdx, setTodayIdx] = useState(-1); // Mo=0 … So=6, -1 = noch unbekannt
  useEffect(() => { setTodayIdx((new Date().getDay() + 6) % 7); }, []);
  const [cal, setCal] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [calMsg, setCalMsg] = useState('');

  async function protectWeek() {
    setCal('creating'); setCalMsg('');
    const events: object[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dow = (d.getDay() + 6) % 7;
      const ds = localDay(d);
      events.push({ title: 'Reha & Mobilität', calendar: 'Privat Kevin', date: ds, startHour: 18, startMin: 0, durationMin: 20 });
      if (dow < 5) events.push({ title: 'Fokuszeit (Deep Work)', calendar: 'Privat Kevin', date: ds, startHour: 9, startMin: 0, durationMin: 180 });
    }
    try {
      const r = await fetch('/api/apple-calendar/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }) });
      const j = await r.json();
      if (j.ok) { setCal('done'); setCalMsg(`${j.created} Blöcke in „Privat Kevin" eingetragen (7 Tage: Reha täglich + Fokuszeit Mo–Fr).`); }
      else {
        setCal('error');
        const needsGrant = `${j.detail ?? ''}${j.error ?? ''}`.toLowerCase().includes('freigeben') || `${j.detail ?? ''}`.toLowerCase().includes('timeout');
        setCalMsg(needsGrant ? 'macOS muss den Kalender-Zugriff einmal erlauben — bestätige das Popup „Zugriff auf Kalender", dann nochmal klicken.' : (j.error ?? 'Konnte nicht eintragen.'));
      }
    } catch { setCal('error'); setCalMsg('Konnte nicht eintragen — versuch es nochmal.'); }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Wochenplanung · dein Rhythmus</>}
          titel={<>Die Woche mit Ruhe.</>}
          satz={<>Fokuszeit 09–17 ist geschützt. Reha läuft täglich. Feste Rituale geben Halt — Sunday Dinner, Reflexion, Bewegung. Der Rhythmus trägt, nicht die Willenskraft.</>}
        />

        {/* Woche schützen — Blöcke in den Kalender */}
        <div style={{ ...panel, padding: '16px 20px', margin: '18px 0 4px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderColor: cal === 'done' ? T.accent : T.line }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Woche selbst schützen</div>
            <div style={{ fontSize: 12.5, color: cal === 'error' ? T.amber : T.inkDim, marginTop: 4, lineHeight: 1.5 }}>
              {calMsg || 'Trägt Reha (täglich, 18:00) + Fokuszeit (Mo–Fr, 09:00) für die nächsten 7 Tage in deinen Apple-Kalender „Privat Kevin".'}
            </div>
          </div>
          <button onClick={protectWeek} disabled={cal === 'creating'}
            style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, cursor: cal === 'creating' ? 'default' : 'pointer', whiteSpace: 'nowrap', border: `1px solid ${T.accent}`, background: cal === 'creating' ? T.panel2 : T.accent, color: cal === 'creating' ? T.muted : T.void }}>
            {cal === 'creating' ? 'trage ein …' : cal === 'done' ? '↻ Nochmal eintragen' : 'In Kalender eintragen'}
          </button>
        </div>

        {/* Legende */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '18px 0 16px' }}>
          {Object.values(KIND).map(k => (
            <span key={k.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: T.inkDim }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: k.c }} />{k.l}
            </span>
          ))}
        </div>

        {/* Wochenraster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          {WOCHE.map((day, i) => {
            const isToday = i === todayIdx;
            return (
              <div key={day.day} style={{ ...panel, padding: '14px 14px', borderColor: isToday ? T.accent : T.line }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: isToday ? T.accentInk : T.ink }}>{day.label}</span>
                  {isToday && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: T.accent }}>heute</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {day.blocks.map((b, j) => (
                    <div key={j} style={{ borderLeft: `2px solid ${KIND[b.kind].c}`, paddingLeft: 9 }}>
                      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '.04em' }}>{b.t}</div>
                      <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.35, marginTop: 1 }}>{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...panel, padding: '16px 20px', marginTop: 18, display: 'flex', gap: 12 }}>
          <span style={{ color: T.accent, flex: '0 0 auto', fontSize: 15 }}>◆</span>
          <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55 }}>
            Nächster Schritt, wenn du bereit bist: Reha-Blöcke + Fokuszeit direkt in deinen Kalender legen (Apple/M365), damit die Woche sich selbst schützt — kommt mit der Kalender-Anbindung.
          </div>
        </div>
      </div>
    </div>
  );
}
