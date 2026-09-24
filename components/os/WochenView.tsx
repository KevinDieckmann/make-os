'use client';

// ─── MAKE OS — Wochen-Rhythmus ──────────────────────────────────────────────
// Die Woche mit Ruhe: Fokuszeit geschützt, Reha täglich, feste Rituale. Ein
// Klick trägt Reha + Fokuszeit für sieben Tage in den Apple-Kalender.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Chips, Leuchtfarben).

import { localDay } from '@/lib/zeit';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WOCHE, type BlockKind } from '@/lib/make-one/health-data';
import { Seite, Karte, Ueberschrift, Chip, Knopf, Punkt, LEUCHT } from './schlank';

/** Farbe je Blockart — Business bleibt bewusst leise: hier geht es um die Ruhe. */
const KIND: Record<BlockKind, { c: string; l: string }> = {
  health: { c: LEUCHT.gut, l: 'Gesundheit / Reha' },
  move: { c: LEUCHT.geld, l: 'Bewegung' },
  ruhe: { c: LEUCHT.achtung, l: 'Ruhe & Rituale' },
  focus: { c: LEUCHT.schlaf, l: 'Fokuszeit (geschützt)' },
  business: { c: C.inkLeise, l: 'Business' },
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

  const schutzFarbe = cal === 'done' ? LEUCHT.gut : cal === 'error' ? LEUCHT.achtung : LEUCHT.puls;

  return (
    <Seite
      breit={1180}
      titel="Wochen-Rhythmus"
      unter="Die Woche mit Ruhe: Fokuszeit 09–17 ist geschützt. Reha läuft täglich. Feste Rituale geben Halt — Sunday Dinner, Reflexion, Bewegung. Der Rhythmus trägt, nicht die Willenskraft."
      rechts={<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {Object.values(KIND).map(k => (
          <span key={k.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkDim, whiteSpace: 'nowrap' }}>
            <Punkt farbe={k.c} groesse={7} />{k.l}
          </span>
        ))}
      </div>}
    >
      {/* Woche schützen — Blöcke in den Kalender */}
      <Karte i={0} akzent={schutzFarbe}>
        <Ueberschrift farbe={schutzFarbe} rechts={
          <Knopf onClick={protectWeek} aus={cal === 'creating'} farbe={schutzFarbe}>
            {cal === 'creating' ? 'trage ein …' : cal === 'done' ? '↻ Nochmal eintragen' : 'In Kalender eintragen'}
          </Knopf>
        }>Woche selbst schützen</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: cal === 'error' ? LEUCHT.achtung : cal === 'done' ? LEUCHT.gut : C.inkDim, lineHeight: 1.55 }}>
          {calMsg || 'Trägt Reha (täglich, 18:00) + Fokuszeit (Mo–Fr, 09:00) für die nächsten 7 Tage in deinen Apple-Kalender „Privat Kevin".'}
        </div>
      </Karte>

      {/* Wochenraster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        {WOCHE.map((day, i) => {
          const isToday = i === todayIdx;
          return (
            <Karte key={day.day} i={1 + i} akzent={isToday ? LEUCHT.puls : undefined} style={{ padding: '16px 16px' }}>
              <Ueberschrift farbe={isToday ? LEUCHT.puls : undefined} rechts={isToday ? <Chip farbe={LEUCHT.puls}>heute</Chip> : undefined}>{day.label}</Ueberschrift>
              <div style={{ display: 'grid', gap: 9 }}>
                {day.blocks.map((b, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ display: 'inline-flex', marginTop: 4 }}><Punkt farbe={KIND[b.kind].c} groesse={7} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{b.t}</div>
                      <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.35, marginTop: 1 }}>{b.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Karte>
          );
        })}
      </div>

      <Karte i={8}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: LEUCHT.puls, flex: '0 0 auto', fontSize: TYP.body }}>◆</span>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
            Nächster Schritt, wenn du bereit bist: Reha-Blöcke + Fokuszeit direkt in deinen Kalender legen (Apple/M365), damit die Woche sich selbst schützt — kommt mit der Kalender-Anbindung.
          </div>
        </div>
      </Karte>
    </Seite>
  );
}
