'use client';

// ─── Inbox teilen — „In der Inbox suchen“ (08.10.2026, Lücke 6) ─────────────────────────────────────────────────────
// Das Feld oben in der Inbox (am Handy hinter der Lupe, Taste „/“ öffnet es). Gesucht wird auf dem Server (GET /api/inbox/suche) nur in
// dem, was die Person sieht — eigene Spiegel, sichtbare Team-Postfächer, eigene Übergaben —, im selben Bereich wie die Inbox. Ergebnis
// als Gesprächsliste mit Hervorhebung (`markieren`, dieselbe Such-Regel wie überall); höchstens eine Seite, „mehr …“ lädt die nächste —
// nie still gekürzt. Der Suchbegriff bleibt im Browser (nur in der Abfrage an die eigene Route, nie in einem Protokoll).

import { forwardRef, useEffect, useState } from 'react';
import { FARBE as C, KUGEL, TYP } from '@/lib/make-one/design';
import { markieren, type TrefferOrt } from '@/lib/inbox/teilen';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Punkt, eingabe } from '../ui';
import { WaSymbol } from '../whatsapp';
import { holen, zeitKurz, type SuchAntwort, type SuchTreffer } from './daten';

const ORT: Record<TrefferOrt, string> = { betreff: 'im Betreff', absender: 'im Absender', empfaenger: 'bei den Empfängern', text: 'im Text' };

/** Text mit hervorgehobenen Suchwörtern (rein über `markieren`). */
export function Markiert({ text, frage }: { text: string; frage: string }) {
  return <>{markieren(text, frage).map((t, i) => (t.an ? <mark key={i} style={{ background: `${KUGEL.granat}40`, color: C.ink, borderRadius: 4, padding: '0 2px' }}>{t.t}</mark> : <span key={i}>{t.t}</span>))}</>;
}

/** Das Suchfeld (16 px, ≥ 44 px hoch). Esc leert. */
export const SuchFeld = forwardRef<HTMLInputElement, { wert: string; onAendern: (t: string) => void }>(function SuchFeld({ wert, onAendern }, ref) {
  return (
    <input ref={ref} type="search" value={wert} onChange={e => onAendern(e.target.value)} placeholder="In der Inbox suchen …" aria-label="In der Inbox suchen"
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onAendern(''); (e.target as HTMLInputElement).blur(); } }}
      enterKeyHint="search" autoComplete="off" maxLength={120} style={{ ...eingabe, minHeight: 44, fontSize: 16 }} data-inbox="suche" />
  );
});

/** Ergebnisse zu `frage` (entprellt), im Bereichsfilter der Inbox (`filter` = Abfrage ohne q). */
export function SuchErgebnisse({ frage, filter, offenId, onOeffnen }: { frage: string; filter: string; offenId: string | null; onOeffnen: (id: string) => void }) {
  const [d, setD] = useState<SuchAntwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [mehrLaeuft, setMehrLaeuft] = useState(false);
  useEffect(() => {
    let aus = false;
    setD(null); setFehler('');
    const t = setTimeout(async () => {
      const r = await holen<SuchAntwort>(`/api/inbox/suche?q=${encodeURIComponent(frage)}${filter ? `&${filter}` : ''}`);
      if (aus) return;
      if (r.d.ok) setD(r.d as SuchAntwort); else setFehler(String(r.d.fehler ?? 'Die Suche ging gerade nicht.'));
    }, 300);
    return () => { aus = true; clearTimeout(t); };
  }, [frage, filter]);
  const mehr = async () => {
    if (!d) return;
    setMehrLaeuft(true);
    const r = await holen<SuchAntwort>(`/api/inbox/suche?q=${encodeURIComponent(frage)}${filter ? `&${filter}` : ''}&ab=${d.treffer.length}`);
    setMehrLaeuft(false);
    if (r.d.ok) setD({ ...(r.d as SuchAntwort), treffer: [...d.treffer, ...(r.d as SuchAntwort).treffer], ab: 0 });
    else setFehler(String(r.d.fehler ?? 'Die Suche ging gerade nicht.'));
  };
  const zeile = (t: SuchTreffer) => (
    <Zeile key={`${t.art}-${t.id}`} onClick={() => onOeffnen(t.id)} aktiv={offenId === t.id}
      links={<Punkt farbe={t.art === 'uebergabe' ? KUGEL.granat : C.linie} />}
      titel={<>{t.quelle === 'whatsapp' && <span style={{ color: KUGEL.smaragd, marginRight: 6 }}><WaSymbol groesse={14} /></span>}<span style={{ fontWeight: 600 }}><Markiert text={t.name} frage={frage} /></span><span style={{ color: C.inkLeise }}> · <Markiert text={t.betreff} frage={frage} /></span></>}
      unter={<><span style={{ color: C.inkLeise }}>{t.art === 'uebergabe' ? `Übergabe${t.von ? ` · ${t.von}` : ''} · ` : t.von ? `Team-Postfach · ${t.von} · ` : ''}{ORT[t.wo]}{t.anzahl > 1 ? ` (${t.anzahl} Nachrichten)` : ''} — </span><Markiert text={t.ausschnitt} frage={frage} /></>}
      rechts={<span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>{zeitKurz(t.am)}</span>} />
  );
  return (
    <Karte i={0} dicht>
      <Ueberschrift farbe={KUGEL.granat} rechts={d ? `${d.gesamt}` : undefined}>Suche</Ueberschrift>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {!d && !fehler && <Leer>sucht …</Leer>}
      {d?.hinweis && <Leer>{d.hinweis}</Leer>}
      {d && !d.hinweis && !d.treffer.length && <Leer symbol="⌕">Nichts gefunden — gesucht wird in Betreff, Absender, Empfängern und Text deiner Post, deiner Team-Postfächer und deiner Übergaben.</Leer>}
      {d && d.treffer.length > 0 && <Liste>{d.treffer.map(zeile)}</Liste>}
      {d && d.treffer.length < d.gesamt && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{d.treffer.length} von {d.gesamt} angezeigt.</span>
          <Knopf leise onClick={mehr} aus={mehrLaeuft}>{mehrLaeuft ? 'lädt …' : 'mehr …'}</Knopf>
        </div>
      )}
    </Karte>
  );
}
