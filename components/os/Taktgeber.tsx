'use client';

import Link from 'next/link';
// ─── MAKE OS — Taktgeber ────────────────────────────────────────────────────
// Bis zum 07.09. schlug hier die Uhr: ein setInterval im Browser hat den
// Tageslauf gestartet. Wer den Tab schloss, hielt das System an — und wer den
// Rechner erst um neun aufklappte, bekam den Morgenlauf um neun statt um sieben.
//
// Der Takt liegt jetzt auf dem Server (lib/jarvis/takt.ts) und wird vom
// Arbeiter jede Minute abgefragt. Diese Komponente hat zwei Aufgaben behalten:
//
//   1. RÜCKFALL — läuft gerade kein Arbeiter (etwa weil jemand nur
//      `npm run dev` gestartet hat), hält der offene Browser den Takt am Leben.
//      Doppelt kann dabei nichts passieren: die Fälligkeit entsteht aus dem
//      echten Zustand der Speicher, und die Warteschlange lässt denselben
//      Auftrag nur einmal offen. Zwei Frager ergeben einen Auftrag, nicht zwei.
//
//   2. MELDEN — der Wächter-Alarm und der Hinweis des Verbesserungs-Loops.
//      Die kamen früher aus der Antwort des selbst ausgelösten Laufs. Jetzt
//      läuft er im Hintergrund, also werden sie aus dem Zustand gelesen.
//
// 24.09.: auf das lebendige Bild angeglichen — schwebende Kärtchen als `.karte`,
// der Alarm mit gelbem Hauch am Rand statt Rahmen, Labels in der Text-Schrift.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from './schlank';
import { tagKey, type LaufArt } from '@/lib/tageslauf';

const MIN = 60_000;

interface Lauf { art: LaufArt; gestartet: string; alarm?: string }
interface Auftrag { name: string; status: string; beendet?: string; ergebnis?: string }
/** Meldung mit ihrem Schlüssel — den braucht das Wegklicken, sonst kommt sie
 *  beim nächsten Blick sofort wieder. */
interface Meldung { key: string; text: string }

/** Beschriftung über der Meldung — gesperrt, leise, Text-Schrift. */
const etikett = (farbe: string) => ({
  fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600 as const, letterSpacing: '.1em',
  textTransform: 'uppercase' as const, color: farbe, marginBottom: 4,
});
const schliessKnopf = { background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14, padding: 0, flex: '0 0 auto' } as const;
const weiter = { display: 'inline-block', marginTop: 8, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv, textDecoration: 'none' } as const;

export function Taktgeber() {
  const [alarm, setAlarm] = useState<Meldung | null>(null);
  /** Leiser Hinweis des Verbesserungs-Loops — kein Alarm, nur ein Wink. */
  const [hinweis, setHinweis] = useState<Meldung | null>(null);
  /** Weggeklicktes im Ref statt im State: sonst würde jeder Klick die Uhr
   *  neu aufziehen, weil der Effekt daran hinge. */
  const weg = useRef<Set<string>>(new Set());
  const wegklicken = (key: string) => { weg.current.add(key); };

  useEffect(() => {
    let aktiv = true;

    /** Anklopfen: der Server entscheidet, ob etwas fällig ist. */
    const schlag = () => {
      if (!aktiv) return;
      fetch('/api/jarvis/takt', { method: 'POST' }).catch(() => {});
    };

    /** Nachsehen, ob im Hintergrund etwas gemeldet werden will. */
    async function nachsehen() {
      if (!aktiv) return;
      try {
        const [tl, auf] = await Promise.all([
          fetch('/api/tageslauf').then(r => r.json()) as Promise<{ laeufe?: Lauf[] }>,
          fetch('/api/jarvis/auftraege').then(r => r.json()) as Promise<{ auftraege?: Auftrag[] }>,
        ]);
        if (!aktiv) return;

        const heute = (tl.laeufe ?? []).filter(l => l.gestartet.slice(0, 10) === tagKey());
        const mitAlarm = heute.find(l => l.alarm);
        setAlarm(mitAlarm?.alarm && !weg.current.has(mitAlarm.gestartet)
          ? { key: mitAlarm.gestartet, text: mitAlarm.alarm } : null);

        // Der Verbesserungs-Loop meldet sein Ergebnis über die Warteschlange.
        const v = (auf.auftraege ?? []).find(a =>
          a.name === 'verbesserung' && a.status === 'fertig'
          && a.beendet && Date.now() - Date.parse(a.beendet) < 6 * 60 * MIN
          && /(\d+) Vorschläge/.test(a.ergebnis ?? ''));
        const anzahl = v ? Number(/(\d+) Vorschläge/.exec(v.ergebnis ?? '')?.[1] ?? 0) : 0;
        setHinweis(anzahl > 0 && v?.beendet && !weg.current.has(v.beendet)
          ? { key: v.beendet, text: `${anzahl} Verbesserungs${anzahl === 1 ? 'vorschlag' : 'vorschläge'} im Bauplan` } : null);
      } catch { /* leise — beim nächsten Mal wieder */ }
    }

    // Dem Arbeiter den Vortritt lassen: erst nach einer Dreiviertelminute.
    const erster = setTimeout(schlag, 45_000);
    const uhr = setInterval(schlag, 5 * MIN);
    void nachsehen();
    const blick = setInterval(nachsehen, 3 * MIN);
    return () => { aktiv = false; clearTimeout(erster); clearInterval(uhr); clearInterval(blick); };
  }, []);

  if (!alarm && hinweis) {
    return (
      <div className="karte os-auf" style={{
        position: 'fixed', bottom: 18, right: 18, zIndex: 90, maxWidth: 340,
        padding: '14px 16px', color: C.ink, fontFamily: SCHRIFT.text,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 40px rgba(0,0,0,.45)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={etikett(C.inkLeise)}>Verbesserungs-Loop</div>
            <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>{hinweis.text}</div>
            <Link href="/os/bauplan" style={weiter}>ansehen ›</Link>
          </div>
          <button onClick={() => { wegklicken(hinweis.key); setHinweis(null); }}
            aria-label="Hinweis schließen"
            style={schliessKnopf}>✕</button>
        </div>
      </div>
    );
  }

  if (!alarm) return null;

  return (
    <div className="karte os-auf" style={{
      position: 'fixed', bottom: 18, right: 18, zIndex: 90, maxWidth: 380,
      padding: '14px 16px', color: C.ink, fontFamily: SCHRIFT.text,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 12px 40px rgba(0,0,0,.45), inset 0 0 0 1px ${LEUCHT.achtung}26, 0 0 40px -12px ${LEUCHT.achtung}40`,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: LEUCHT.achtung, flex: '0 0 auto', textShadow: `0 0 10px ${LEUCHT.achtung}33` }}>⚠</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={etikett(LEUCHT.achtung)}>Wächter</div>
          <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>{alarm.text}</div>
          <Link href="/os/tageslauf" style={weiter}>ansehen ›</Link>
        </div>
        <button onClick={() => { wegklicken(alarm.key); setAlarm(null); }}
          style={schliessKnopf}>✕</button>
      </div>
    </div>
  );
}
