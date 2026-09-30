'use client';

// ─── MAKE OS — Aufgaben: Business-Einheit als Chip + Menü (27.09.) ──────────
// Kevin: Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures und
// MAKE Innovation GmbH unterscheiden. Sichtbar ist nur der gesetzte Wert als Chip (farbig
// dezent je Kerneinheit, eigene grau); ein Klick öffnet das Menü mit der
// Werteliste des Haushalts, „ohne Einheit“ und „+ neu“ (legt die Einheit über
// /api/planung/einheiten an). Seit 27.09. spät baut EinheitWahl auf dem einen
// Auswahl-Bauteil auf (components/os/crm/Wahl.tsx mit `onNeu`).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { EINHEITEN_STANDARD, EINHEIT_MIN, EINHEIT_MAX } from '@/lib/planung/einheiten';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { einheitName } from '@/lib/einheiten';
import { einheitFarbe, EINHEIT_GRAU, EINHEIT_MERKER, type EinheitOption, type EinheitFilter } from '@/lib/aufgaben/einheit';

// ── Werteliste + Merker ─────────────────────────────────────────────────────
let ladung: Promise<string[]> | null = null;
const EREIGNIS = 'make-einheiten-geaendert';
function laden(neu = false): Promise<string[]> {
  if (!ladung || neu) {
    ladung = fetch('/api/planung/einheiten', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (Array.isArray(d?.einheiten) ? (d.einheiten as string[]) : [...EINHEITEN_STANDARD]))
      .catch(() => [...EINHEITEN_STANDARD]);
  }
  return ladung;
}

export function einheitGemerkt(): string | null {
  try { return localStorage.getItem(EINHEIT_MERKER) || null; } catch { return null; }
}
export function einheitMerken(name: string | null | undefined): void {
  try { if (name) localStorage.setItem(EINHEIT_MERKER, name); else localStorage.removeItem(EINHEIT_MERKER); } catch { /* egal */ }
}

/** Die Einheiten des Haushalts (Kern + Kunden + eigene) und „+ neu“. */
export function useEinheiten(): { einheiten: string[]; anlegen: (name: string) => Promise<string | null> } {
  const [einheiten, setEinheiten] = useState<string[]>([...EINHEITEN_STANDARD]);
  useEffect(() => {
    let aktiv = true;
    const holen = (neu: boolean) => laden(neu).then(l => { if (aktiv) setEinheiten(l); });
    void holen(false);
    const auf = () => void holen(false);
    window.addEventListener(EREIGNIS, auf);
    return () => { aktiv = false; window.removeEventListener(EREIGNIS, auf); };
  }, []);
  const anlegen = useCallback(async (name: string): Promise<string | null> => {
    try {
      const r = await fetch('/api/planung/einheiten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const d = await r.json();
      if (!r.ok || !d.einheit) return null;
      if (Array.isArray(d.einheiten)) { ladung = Promise.resolve(d.einheiten as string[]); setEinheiten(d.einheiten); window.dispatchEvent(new Event(EREIGNIS)); }
      return d.einheit as string;
    } catch { return null; }
  }, []);
  return { einheiten, anlegen };
}

// ── Anzeige ─────────────────────────────────────────────────────────────────
/** Reine Anzeige: farbiger Text ohne Fläche (Fläche heißt „klickbar“). */
export function EinheitMarke({ name, stil }: { name?: string | null; stil?: CSSProperties }) {
  const n = einheitName(name);
  if (!n) return null;
  return <span title={`Einheit: ${n}`} style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: einheitFarbe(n), whiteSpace: 'nowrap', ...stil }}>{n}</span>;
}

// ── Auswahl: Chip + Menü ────────────────────────────────────────────────────
/**
 * Einheit als Wahl-Chip (components/os/crm/Wahl.tsx, seit 27.09. spät das eine
 * Auswahl-Bauteil): Werte der Haushalts-Werteliste mit Farbpunkt, der Chip in
 * der Farbe der Einheit, Menü am Chip (Portal ins <body>), „ohne Einheit“ als
 * Leeren-Zeile und „+ neu …“ (legt über /api/planung/einheiten an, Länge
 * EINHEIT_MIN–EINHEIT_MAX). `merken` hält die Wahl als Vorgabe für die nächste
 * neue Aufgabe fest.
 */
export function EinheitWahl({ wert, setzen, einheiten, anlegen, leer = '+ Einheit', titel = 'Einheit', merken = false }: {
  wert?: string | null;
  setzen: (einheit: string | undefined) => void;
  einheiten: readonly string[];
  anlegen: (name: string) => Promise<string | null>;
  leer?: string;
  titel?: string;
  /** Wahl als Vorgabe für die nächste neue Aufgabe merken (nur an der Anlage-Zeile). */
  merken?: boolean;
}) {
  const n = einheitName(wert);
  const gleich = (a: string, b: string) => a.toLocaleLowerCase('de-DE') === b.toLocaleLowerCase('de-DE');
  // Gesetzter Wert in der Schreibweise der Liste; steht er in keiner Liste (Altbestand), bleibt er als eigene Zeile sichtbar.
  const gesetzt = n ? einheiten.find(e => gleich(e, n)) ?? n : null;
  const liste: WahlEintrag<string>[] = useMemo(() => [
    ...einheiten.map(e => ({ id: e, label: e, punkt: einheitFarbe(e) })),
    ...(gesetzt && !einheiten.includes(gesetzt) ? [{ id: gesetzt, label: gesetzt, punkt: einheitFarbe(gesetzt) }] : []),
  ], [einheiten, gesetzt]);
  const waehle = (e: string | undefined) => { setzen(e); if (merken) einheitMerken(e); };
  return (
    <Wahl label={titel} liste={liste} wert={gesetzt} leer={leer} klein farbe={gesetzt ? einheitFarbe(gesetzt) : EINHEIT_GRAU}
      onWahl={waehle} onLeeren={() => waehle(undefined)} leerenLabel="ohne Einheit"
      onNeu={anlegen} neuMin={EINHEIT_MIN} neuMax={EINHEIT_MAX} />
  );
}

// ── Filter-Pillen (nur Business) ────────────────────────────────────────────
export function EinheitFilterPillen({ optionen, wert, setzen }: { optionen: readonly EinheitOption[]; wert: EinheitFilter; setzen: (f: EinheitFilter) => void }) {
  return (
    <div role="group" aria-label="Nach Einheit filtern" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {optionen.map(o => {
        const an = wert === o.id;
        const farbe = o.farbe === EINHEIT_GRAU ? C.aktiv : o.farbe;
        return (
          <button key={o.id} onClick={() => setzen(o.id)} aria-pressed={an} className="fassbar" style={{
            fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
            border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim,
          }}>{o.label}{o.anzahl ? <span style={{ opacity: 0.6, marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>{o.anzahl}</span> : null}</button>
        );
      })}
    </div>
  );
}
