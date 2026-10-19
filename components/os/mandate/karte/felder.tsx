'use client';

// ─── Produkt-Karte · kleine Eingaben (P2, 19.10.) ────────────────────────────────────────────────────────────────────────
// Felder, die beim Verlassen bzw. mit Enter speichern — EINMAL (Enter blendet aus, das Verlassen danach speichert nicht noch einmal: Rundgang
// 19.10. A6). Ungültige Eingaben bleiben stehen, darunter ein Satz; gespeichert wird nur, was sich geändert hat.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, LEUCHT } from '../../ui';
import { zahlAus } from '@/lib/crm/produkt-katalog';

const fehlerStil = { fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.4 } as const;
const beschriftungStil = { fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim } as const;

/** Beschriftetes Feld mit Satz darunter (Fehler in Warnfarbe, sonst ein leiser Hinweis). */
export function Feld({ label, hinweis, fehler, children }: { label: string; hinweis?: string; fehler?: string | null; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0, alignContent: 'start' }}>
      <span style={beschriftungStil}>{label}</span>
      {children}
      {fehler ? <span role="alert" style={fehlerStil}>{fehler}</span> : hinweis ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>{hinweis}</span> : null}
    </label>
  );
}

/**
 * Zahl, die beim Verlassen/Enter übernommen wird: leer = `null` (entfernen), Unsinn oder außerhalb der Grenzen = Satz, nichts gesendet.
 * `onFertig` darf einen Fehlertext zurückgeben (dann bleibt die Eingabe stehen).
 */
export function ZahlFeld({ label, wert, onFertig, min = 0, max, ganz = true, einheit, platzhalter, hinweis }: {
  label: string; wert: number | null | undefined; onFertig: (n: number | null) => unknown; min?: number; max: number; ganz?: boolean; einheit?: string; platzhalter?: string; hinweis?: string;
}) {
  const aussen = wert == null ? '' : String(wert).replace('.', ',');
  const [t, setT] = useState(aussen);
  const [fehler, setFehler] = useState<string | null>(null);
  const fokus = useRef(false);
  const zuletzt = useRef(aussen);
  useEffect(() => { if (!fokus.current) { setT(aussen); zuletzt.current = aussen; } }, [aussen]);
  const fertig = async () => {
    if (t.trim() === zuletzt.current.trim()) { setFehler(null); return; }
    const n = zahlAus(t);
    if (n !== null && (Number.isNaN(n) || (ganz && !Number.isInteger(n)) || n < min || n > max)) {
      setFehler(`${ganz ? 'Eine ganze Zahl' : 'Eine Zahl'} von ${min.toLocaleString('de-DE')} bis ${max.toLocaleString('de-DE')}${einheit ? ` (${einheit})` : ''}.`);
      return;
    }
    zuletzt.current = t;
    const r = await onFertig(n);
    setFehler(typeof r === 'string' ? r : null);
  };
  return (
    <Feld label={label} fehler={fehler} hinweis={hinweis}>
      <input value={t} inputMode={ganz ? 'numeric' : 'decimal'} placeholder={platzhalter ?? '—'} aria-label={label}
        onFocus={() => { fokus.current = true; }} onChange={e => setT(e.target.value)}
        onBlur={() => { fokus.current = false; void fertig(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setT(zuletzt.current); setFehler(null); } }}
        style={{ ...feld, fontVariantNumeric: 'tabular-nums' }} />
    </Feld>
  );
}

/**
 * Text (eine Zeile oder mehrere), der beim Verlassen übernommen wird. `onFertig` gibt optional einen Fehlertext zurück (z. B. „zu lang“) —
 * dann bleibt die Eingabe stehen. Ein Zähler erscheint ab 80 % der Länge.
 */
export function TextFeld({ label, wert, onFertig, max, zeilen = 1, platzhalter, hinweis, pflicht, modus }: {
  label: string; wert: string; onFertig: (t: string) => unknown; max: number; zeilen?: number; platzhalter?: string; hinweis?: string; pflicht?: boolean;
  /** Tastatur am Handy (Beträge: „decimal“). */ modus?: 'decimal' | 'numeric';
}) {
  const [t, setT] = useState(wert);
  const [fehler, setFehler] = useState<string | null>(null);
  const fokus = useRef(false);
  const zuletzt = useRef(wert);
  useEffect(() => { if (!fokus.current) { setT(wert); zuletzt.current = wert; } }, [wert]);
  const fertig = async () => {
    if (t.trim() === zuletzt.current.trim()) { setFehler(null); return; }
    const r = await onFertig(t);
    if (typeof r === 'string') { setFehler(r); return; }
    zuletzt.current = t;
    setFehler(null);
  };
  const lang = t.length > max * 0.8;
  const stil = { ...feld, ...(pflicht && !t.trim() ? { borderColor: `${LEUCHT.achtung}88` } : {}) };
  return (
    <Feld label={label} fehler={fehler} hinweis={lang ? `${t.length.toLocaleString('de-DE')} von ${max.toLocaleString('de-DE')} Zeichen` : hinweis}>
      {zeilen > 1
        ? <textarea value={t} rows={zeilen} placeholder={platzhalter} aria-label={label} onFocus={() => { fokus.current = true; }} onChange={e => setT(e.target.value)}
            onBlur={() => { fokus.current = false; void fertig(); }} style={{ ...stil, resize: 'vertical', lineHeight: 1.5 }} />
        : <input value={t} placeholder={platzhalter} aria-label={label} inputMode={modus} onFocus={() => { fokus.current = true; }} onChange={e => setT(e.target.value)}
            onBlur={() => { fokus.current = false; void fertig(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} style={stil} />}
    </Feld>
  );
}
