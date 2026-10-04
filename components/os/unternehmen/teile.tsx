'use client';

// ─── Unternehmen (Gesellschafts-Register) · gemeinsame Teile der Oberfläche (04.10.) ────────────────────────────
// Typen der Antwort von GET /api/gesellschaften, Schreibweg (EINE Kette je Gesellschaft: nacheinander, Stand aus der
// letzten Antwort — lib/crm/gesellschaft-kette.ts), Namen der Bezüge, Betrags- und Datumsfelder, Bezug-Wahl.
// Regeln stehen rein in lib/gesellschaften/modell.ts; hier nur Darstellung.

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, auswahl, Feldzeile, Segmente } from '../ui';
import { gesellschaftKette, type GesellschaftAntwort } from '@/lib/crm/gesellschaft-kette';
import { gesellschaftenGeaendert } from '@/lib/gesellschaften/client';
import { WEG } from '@/lib/wege';
import { BEZUG_ARTEN, euroText, type Bezug, type BezugArt, type RegisterGesellschaft, type Verweise, type GeloeschterBezug } from '@/lib/gesellschaften/modell';

export type GAnzeige = RegisterGesellschaft & { name: string; stand: string; luecken: string[]; verweise: Verweise };
export interface RegisterDaten {
  gesellschaften: GAnzeige[]; personen: { id: string; name: string }[]; namen: Record<string, string>;
  /** Vermerke endgültig gelöschter Gesellschaften/Verträge (DSGVO-Nachtrag 04.10.) — Bezüge bleiben als „(gelöscht)“ lesbar. */
  geloescht: GeloeschterBezug[];
}

/**
 * Der Satz in der Rückfrage vor dem endgültigen Löschen einer Gesellschaft bzw. eines Vertrags (DSGVO-Nachtrag 04.10., Kevin):
 * Unterlagen bleiben in der Ablage (Aufbewahrungspflicht § 257 HGB) — „ansehen“ öffnet die Ablage, gefiltert auf diesen Bezug.
 */
export function UnterlagenBleiben({ href }: { href: string }) {
  return <>Die Unterlagen bleiben in der Ablage erhalten (Aufbewahrungspflicht) — <Link href={href} style={{ color: C.ink, textDecoration: 'underline' }}>ansehen ›</Link></>;
}

export const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

/** Name eines Bezugs — aus der Antwort des Servers; getilgte (Art. 17) oder fehlende Kennungen ehrlich benannt. */
export function bezugName(b: Bezug, namen: Record<string, string>): string {
  const n = namen[`${b.art}:${b.id}`];
  if (n) return n;
  if (b.id.includes('gelöscht')) return b.art === 'kontakt' ? 'Kontakt (gelöscht)' : 'Eintrag (gelöscht)';
  return b.art === 'kontakt' ? 'Kontakt (nicht mehr im CRM)' : b.art === 'firma' ? 'Firma (nicht mehr im CRM)' : b.art === 'person' ? 'Person (nicht mehr im Haushalt)' : 'Gesellschaft (nicht gefunden)';
}

/** Wohin ein Bezug führt (Akte im CRM, Firma, Gesellschaft im Register) — Personen des Haushalts und getilgte Kennungen nirgendwohin. */
export function bezugWeg(b: Bezug): string | undefined {
  if (b.id.includes('gelöscht')) return undefined;
  return b.art === 'kontakt' ? WEG.akte(b.id) : b.art === 'firma' ? WEG.firma(b.id) : b.art === 'gesellschaft' ? WEG.unternehmen(b.id) : undefined;
}

export const tagText = (t?: string) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '');
export const centText = (c?: number) => (typeof c === 'number' ? euroText(c) : '');
/** Cent → Eingabetext in Euro („25.000“, „12.500,50“). */
export const centEingabe = (c?: number) => (typeof c === 'number' ? (c / 100).toLocaleString('de-DE', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) : '');

const antwortVon = (r: Response) => r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}.` })) as Promise<GesellschaftAntwort<GAnzeige>>;

/**
 * Schreiber einer Gesellschaft: jede Änderung geht nacheinander mit dem Stand der letzten Antwort hinaus (409 → neuer Stand,
 * Meldung bleibt bis zum nächsten Schreiben). `onNeu` bekommt den neuen Serverstand.
 */
export function useSchreiber(g: GAnzeige, onNeu: (g: GAnzeige) => void) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [unterwegs, setUnterwegs] = useState(0);
  const onNeuRef = useRef(onNeu);
  onNeuRef.current = onNeu;
  const kette = useRef(gesellschaftKette<GAnzeige>(g.stand, { uebernehmen: x => { onNeuRef.current(x); gesellschaftenGeaendert(); }, meldung: setMeldung, offen: setUnterwegs }));
  useEffect(() => { kette.current.standSetzen(g.stand); }, [g.stand]);
  const schreibe = (body: Record<string, unknown>) => kette.current.schreibe(stand => fetch('/api/gesellschaften', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, ...body, stand }),
  }).then(antwortVon));
  return { schreibe, meldung, unterwegs };
}

/** Textfeld, das beim Verlassen (oder Enter) speichert — nur, wenn sich etwas geändert hat. */
export function TextFeld({ wert, onFertig, platzhalter, label, typ = 'text', lang }: { wert: string; onFertig: (t: string) => void; platzhalter?: string; label: string; typ?: 'text' | 'date'; lang?: boolean }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  const fertig = () => { if (t.trim() !== wert) onFertig(t.trim()); };
  if (lang) return <textarea value={t} aria-label={label} placeholder={platzhalter} rows={3} onChange={e => setT(e.target.value)} onBlur={fertig} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />;
  return <input type={typ} value={t} aria-label={label} placeholder={platzhalter} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={feld} />;
}

/** Eine Auswahl über <select> (lange Listen: Gesellschaften, Personen, Monate). */
export function Auswahl<T extends string>({ wert, liste, onWahl, label, leer }: { wert: T | ''; liste: readonly { id: T; label: string }[]; onWahl: (v: T | '') => void; label: string; leer?: string }) {
  return (
    <select value={wert} aria-label={label} onChange={e => onWahl(e.target.value as T | '')} style={{ ...auswahl, width: '100%' }}>
      {leer !== undefined && <option value="">{leer}</option>}
      {liste.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
  );
}

/** Treffer aus dem CRM (Kontakte/Firmen) — höchstens 20, erst ab 2 Zeichen. */
function CrmSuche({ art, onWahl }: { art: 'kontakte' | 'firmen'; onWahl: (x: { id: string; name: string }) => void }) {
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setTreffer([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/gesellschaften?suche=${art}&q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' }).then(r => r.json()).then(d => setTreffer(d?.treffer ?? [])).catch(() => setTreffer([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, art]);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input value={q} onChange={e => setQ(e.target.value)} aria-label={art === 'kontakte' ? 'Kontakt suchen' : 'Firma suchen'} placeholder={art === 'kontakte' ? 'Kontakt suchen …' : 'Firma suchen …'} style={feld} />
      {treffer.length > 0 && (
        <div role="listbox" style={{ display: 'grid', gap: 2 }}>
          {treffer.map(x => <button key={x.id} type="button" role="option" aria-selected={false} className="fassbar ui-zeile ui-zeile-klick" onClick={() => { onWahl(x); setQ(''); setTreffer([]); }} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: C.ink, fontSize: TYP.body, cursor: 'pointer' }}>{x.name}</button>)}
        </div>
      )}
      {q.trim().length >= 2 && !treffer.length && <span style={klein}>Kein Treffer im CRM.</span>}
    </div>
  );
}

/**
 * Wer? — Eigene Gesellschaft · Person im Haushalt · Kontakt · Firma (CRM). `ohne` = Kennungen, die nicht wählbar sind
 * (z. B. die Gesellschaft selbst). Liefert den Bezug samt Anzeigename (für die Rückmeldung vor dem Speichern).
 */
export function BezugWahl({ daten, wert, onWahl, ohne = [], arten = BEZUG_ARTEN.map(a => a.id) }: { daten: RegisterDaten; wert: Bezug | null; onWahl: (b: Bezug, name: string) => void; ohne?: string[]; arten?: readonly BezugArt[] }) {
  const [art, setArt] = useState<BezugArt>(wert?.art ?? arten[0]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const waehle = (b: Bezug, name: string) => { setGewaehlt(name); onWahl(b, name); };
  const ges = daten.gesellschaften.filter(g => !ohne.includes(g.id)).map(g => ({ id: g.id as string, label: g.name }));
  const pers = daten.personen.map(p => ({ id: p.id, label: p.name }));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {arten.length > 1 && <Segmente umbrechen liste={BEZUG_ARTEN.filter(a => arten.includes(a.id)).map(a => ({ id: a.id, label: a.label }))} aktiv={art} onWahl={setArt} />}
      {art === 'gesellschaft' && <Auswahl label="Gesellschaft" wert={wert?.art === 'gesellschaft' ? wert.id : ''} leer="Gesellschaft wählen …" liste={ges} onWahl={v => { if (v) waehle({ art, id: v }, ges.find(x => x.id === v)?.label ?? v); }} />}
      {art === 'person' && <Auswahl label="Person" wert={wert?.art === 'person' ? wert.id : ''} leer="Person wählen …" liste={pers} onWahl={v => { if (v) waehle({ art, id: v }, pers.find(x => x.id === v)?.label ?? v); }} />}
      {(art === 'kontakt' || art === 'firma') && <CrmSuche art={art === 'kontakt' ? 'kontakte' : 'firmen'} onWahl={x => waehle({ art, id: x.id }, x.name)} />}
      {wert && wert.art === art && <span style={klein}>Gewählt: <strong style={{ color: C.ink }}>{gewaehlt ?? bezugName(wert, daten.namen)}</strong>{bezugWeg(wert) && <> · <Link href={bezugWeg(wert)!} style={{ color: 'inherit' }}>{wert.art === 'gesellschaft' ? 'im Register öffnen' : 'im CRM öffnen'} ›</Link></>}</span>}
    </div>
  );
}

/** Feld mit Beschriftung in einem zweispaltigen Raster (am Handy eine Spalte). */
export function Felder({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>{children}</div>;
}
export { Feldzeile };
