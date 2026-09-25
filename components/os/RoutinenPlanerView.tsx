'use client';

import Link from 'next/link';
// ─── MAKE OS — Routine-Planer ───────────────────────────────────────────────
// Positive Routinen für Gesundheit, Leben und Business — HIER werden sie
// geplant. Alles andere greift darauf zu: der Wochenplaner (Leiste + Jarvis),
// die Tagesplanung, das Gesundheits-Cockpit (Häkchen) und der MAKE Score.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Knopf/feld).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { listeSchreiben } from '@/lib/make-one/liste-sync';
import { PlanerLeiste } from './PlanerLeiste';
import { Seite, Karte, Ueberschrift, Liste, Leer, Chip, Knopf, Punkt, feld, LEUCHT } from './schlank';

interface Routine { id: string; label: string; wann: 'morgen' | 'tag' | 'abend'; kategorie: 'gesundheit' | 'leben' | 'business'; dauerMin: number; aktiv: boolean }

const WANN: { id: Routine['wann']; label: string; hint: string }[] = [
  { id: 'morgen', label: 'Morgens', hint: 'der Start — vor allem anderen' },
  { id: 'tag', label: 'Tagsüber', hint: 'zwischen den Blöcken' },
  { id: 'abend', label: 'Abends', hint: 'der Abschluss — runterfahren' },
];
const KAT: { id: Routine['kategorie']; label: string; farbe: string }[] = [
  { id: 'gesundheit', label: 'Gesundheit', farbe: LEUCHT.gut },
  { id: 'leben', label: 'Leben', farbe: LEUCHT.beziehung },
  { id: 'business', label: 'Business', farbe: LEUCHT.business },
];
const katFarbe = (k: Routine['kategorie']) => KAT.find(x => x.id === k)!.farbe;

const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const mini: CSSProperties = { width: 24, height: 24, fontSize: TYP.bedien, lineHeight: 1, borderRadius: 7, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,.08)', color: C.inkDim, padding: 0 };
const linkStil = { color: C.inkDim, textDecoration: 'none' as const };

export function RoutinenPlanerView() {
  const [routinen, setRoutinen] = useState<Routine[]>([]);
  const [geladen, setGeladen] = useState(false);
  /** Laden fehlgeschlagen → nicht speichern, sonst löscht der erste Klick alles. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const [neu, setNeu] = useState('');
  const [neuWann, setNeuWann] = useState<Routine['wann']>('morgen');
  const [neuKat, setNeuKat] = useState<Routine['kategorie']>('gesundheit');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Zuletzt gelesener/geschriebener Stand — Basis für die Unterschiede. */
  const gespeichert = useRef<Routine[] | null>(null);

  useEffect(() => {
    fetch('/api/state/routinen')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(d => { setRoutinen(Array.isArray(d.routinen) ? d.routinen : []); setGeladen(true); })
      .catch(err => {
        console.error('[MAKE OS] Routinen konnten nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true); setGeladen(true);
      });
  }, []);

  function persist(next: Routine[]) {
    setRoutinen(next);
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const alt = gespeichert.current;
      gespeichert.current = next;
      void listeSchreiben<Routine>('/api/state/routinen', 'routinen', alt, next);
    }, 500);
  }

  const add = () => {
    const l = neu.trim();
    if (!l) return;
    persist([...routinen, { id: `r-${Date.now().toString(36)}`, label: l, wann: neuWann, kategorie: neuKat, dauerMin: 15, aktiv: true }]);
    setNeu('');
  };

  const aktivN = routinen.filter(r => r.aktiv).length;

  return (
    <Seite
      titel="Was dich jeden Tag trägt."
      unter={<>Routine-Planer · Positive Routinen für Gesundheit, Leben und Business — hier geplant, überall wirksam: im <Link href="/os/planung/woche" style={linkStil}>Wochenplaner</Link> (Leiste + Jarvis-Vorschlag), in der <Link href="/os/planung" style={linkStil}>Tagesplanung</Link>, im <Link href="/os/gesundheit" style={linkStil}>Cockpit</Link> (Häkchen) und im MAKE Score. Pausierte zählen nirgends mit.</>}
      rechts={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={aktivN ? LEUCHT.gut : C.inkLeise}>{aktivN} aktive Routinen</Chip>
        {KAT.map(k => <Chip key={k.id} farbe={k.farbe}>{k.label}</Chip>)}
      </div>}
    >
      <PlanerLeiste aktiv="routinen" />

      {/* Neu anlegen */}
      <Karte i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut}>Neue Routine</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="z. B. 10 Min Spazieren nach dem Mittag …"
            style={{ ...feld, width: 'auto', flex: '1 1 220px', minWidth: 0 }} />
          <select value={neuWann} onChange={e => setNeuWann(e.target.value as Routine['wann'])} aria-label="Tageszeit" style={wahl}>
            {WANN.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <select value={neuKat} onChange={e => setNeuKat(e.target.value as Routine['kategorie'])} aria-label="Kategorie" style={{ ...wahl, color: katFarbe(neuKat) }}>
            {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <Knopf onClick={add}>+ Routine</Knopf>
        </div>
      </Karte>

      {/* Drei Tageszeiten */}
      {!geladen ? (
        <Karte i={1}><Leer>lade …</Leer></Karte>
      ) : WANN.map((w, wi) => {
        const eigene = routinen.filter(r => r.wann === w.id);
        const aktivHier = eigene.filter(r => r.aktiv).length;
        return (
          <Karte key={w.id} i={1 + wi}>
            <Ueberschrift farbe={LEUCHT.puls} rechts={<>{w.hint} · <b style={{ color: aktivHier ? C.inkDim : C.inkLeise, fontWeight: 600 }}>{aktivHier} aktiv</b></>}>{w.label}</Ueberschrift>
            {!eigene.length && <Leer>Noch nichts — leg oben eine an.</Leer>}
            <Liste>
              {eigene.map(r => (
                <div key={r.id} className="zeile" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: r.aktiv ? 1 : 0.45, transition: 'opacity .2s ease' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, aktiv: !x.aktiv } : x))}
                      title={r.aktiv ? 'aktiv — klicken zum Pausieren' : 'pausiert — klicken zum Aktivieren'} aria-label={r.aktiv ? 'aktiv' : 'pausiert'}
                      style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none', padding: 0, background: r.aktiv ? LEUCHT.gut : 'rgba(255,255,255,.12)', position: 'relative', flex: '0 0 auto', boxShadow: r.aktiv ? `0 0 10px ${LEUCHT.gut}33` : undefined, transition: 'background .2s ease' }}>
                      <span style={{ position: 'absolute', top: 2, left: r.aktiv ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: r.aktiv ? C.grund : C.inkDim, transition: 'left .15s ease' }} />
                    </button>
                    <Punkt farbe={katFarbe(r.kategorie)} groesse={8} />
                    <input value={r.label} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))} aria-label="Routine"
                      style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 500 }} />
                    <button onClick={() => persist(routinen.filter(x => x.id !== r.id))} aria-label="Routine löschen"
                      style={{ fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, paddingLeft: 46 }}>
                    <select value={r.kategorie} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, kategorie: e.target.value as Routine['kategorie'] } : x))} aria-label="Kategorie"
                      style={{ ...wahl, padding: '5px 8px', color: katFarbe(r.kategorie) }}>
                      {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                    <select value={r.wann} onChange={e => persist(routinen.map(x => x.id === r.id ? { ...x, wann: e.target.value as Routine['wann'] } : x))} aria-label="Tageszeit"
                      style={{ ...wahl, padding: '5px 8px' }}>
                      {WANN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim, flex: '0 0 auto' }}>
                      <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, dauerMin: Math.max(5, x.dauerMin - 5) } : x))} aria-label="5 Minuten weniger" style={mini}>−</button>
                      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'center' }}>{r.dauerMin} min</span>
                      <button onClick={() => persist(routinen.map(x => x.id === r.id ? { ...x, dauerMin: Math.min(120, x.dauerMin + 5) } : x))} aria-label="5 Minuten mehr" style={mini}>＋</button>
                    </span>
                  </div>
                </div>
              ))}
            </Liste>
          </Karte>
        );
      })}
    </Seite>
  );
}
