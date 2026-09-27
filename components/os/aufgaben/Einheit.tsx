'use client';

// ─── MAKE OS — Aufgaben: Business-Einheit als Chip + Menü (27.09.) ──────────
// Kevin: Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures und
// MAKE OS UG unterscheiden. Sichtbar ist nur der gesetzte Wert als Chip (farbig
// dezent je Kerneinheit, eigene grau); ein Klick öffnet das Menü mit der
// Werteliste des Haushalts, „ohne Einheit“ und „+ neu“ (legt die Einheit über
// /api/planung/einheiten an). Eigenes kleines Bauteil — das allgemeine
// Chip+Menü-Bauteil (components/os/crm/Wahl.tsx, Paket D) kam erst während des
// Baus in den Stand und kennt kein „+ neu“; zusammenlegen, sobald es das kann.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { EINHEITEN_STANDARD } from '@/lib/planung/einheiten';
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

const chip = (farbe: string, leer: boolean): CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap', cursor: 'pointer',
  border: leer ? `1px dashed ${C.inkLeise}66` : 'none', borderRadius: 999, padding: leer ? '2px 9px' : '3px 10px',
  background: leer ? 'transparent' : `${farbe}22`, color: leer ? C.inkLeise : farbe,
});

// ── Auswahl: Chip + Menü ────────────────────────────────────────────────────
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
  const [auf, setAuf] = useState(false);
  const [lage, setLage] = useState<{ top: number; left: number; maxH: number }>({ top: 0, left: 0, maxH: 320 });
  const [neu, setNeu] = useState<string | null>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const menue = useRef<HTMLDivElement>(null);
  const n = einheitName(wert);

  const oeffnen = () => {
    const r = knopf.current?.getBoundingClientRect();
    if (r) {
      const unten = window.innerHeight - r.bottom - 14, oben = r.top - 14, breite = 240;
      const nachOben = unten < 220 && oben > unten;
      const maxH = Math.max(160, Math.min(340, nachOben ? oben : unten));
      setLage({ top: nachOben ? Math.max(8, r.top - 6 - maxH) : r.bottom + 6, left: Math.min(Math.max(8, r.left), window.innerWidth - breite - 8), maxH });
    }
    setAuf(true);
  };
  const schliessen = useCallback(() => { setAuf(false); setNeu(null); }, []);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: MouseEvent) => { if (!menue.current?.contains(e.target as Node) && !knopf.current?.contains(e.target as Node)) schliessen(); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') schliessen(); };
    const rollen = (e: Event) => { if (!menue.current?.contains(e.target as Node)) schliessen(); };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', taste);
    window.addEventListener('scroll', rollen, true);
    window.addEventListener('resize', schliessen);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); window.removeEventListener('scroll', rollen, true); window.removeEventListener('resize', schliessen); };
  }, [auf, schliessen]);

  const waehle = (e: string | undefined) => { setzen(e); if (merken) einheitMerken(e); schliessen(); };
  const zeile = (label: string, farbe: string, aktiv: boolean, onClick: () => void, key: string) => (
    <button key={key} role="menuitemradio" aria-checked={aktiv} onClick={onClick} className="fassbar" style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, cursor: 'pointer',
      padding: '7px 10px', background: aktiv ? `${farbe}1f` : 'transparent', color: aktiv ? farbe : C.ink, fontFamily: SCHRIFT.text, fontSize: 13,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: farbe, opacity: aktiv ? 1 : 0.7, flex: '0 0 auto' }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {aktiv && <span aria-hidden>✓</span>}
    </button>
  );

  return (
    <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <button ref={knopf} type="button" onClick={() => (auf ? schliessen() : oeffnen())} aria-haspopup="menu" aria-expanded={auf}
        title={n ? `${titel}: ${n} — klicken zum Ändern` : `${titel} wählen`} className="fassbar" style={chip(einheitFarbe(n), !n)}>
        {n ?? leer}
      </button>
      {/* Ins <body> gehängt: Karten mit Erscheinen-Animation (transform) würden `position: fixed` sonst an sich binden. */}
      {auf && createPortal(
        <div ref={menue} onClick={e => e.stopPropagation()} role="menu" aria-label={titel} style={{
          position: 'fixed', top: lage.top, left: lage.left, width: 240, maxHeight: lage.maxH, overflowY: 'auto', zIndex: 90,
          background: C.flaeche, borderRadius: 12, padding: 6, boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)', border: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, padding: '4px 10px 6px' }}>{titel}</div>
          {einheiten.map(e => zeile(e, einheitFarbe(e), !!n && e.toLocaleLowerCase('de-DE') === n.toLocaleLowerCase('de-DE'), () => waehle(e), e))}
          {n && !einheiten.some(e => e.toLocaleLowerCase('de-DE') === n.toLocaleLowerCase('de-DE')) && zeile(n, einheitFarbe(n), true, () => waehle(n), '__jetzt')}
          {zeile('ohne Einheit', EINHEIT_GRAU, !n, () => waehle(undefined), '__ohne')}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 4, paddingTop: 4 }}>
            {neu === null
              ? <button onClick={() => setNeu('')} className="fassbar" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: C.aktiv, cursor: 'pointer', padding: '7px 10px', fontFamily: SCHRIFT.text, fontSize: 13, borderRadius: 8 }}>+ neu</button>
              : <input autoFocus value={neu} placeholder="Neue Einheit (Enter)" aria-label="Neue Einheit" maxLength={40}
                  onChange={e => setNeu(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Escape') { e.stopPropagation(); setNeu(null); }
                    if (e.key === 'Enter') { const s = await anlegen(neu); if (s) waehle(s); }
                  }}
                  style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px 10px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 13, outline: 'none' }} />}
          </div>
        </div>,
        document.body,
      )}
    </span>
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
