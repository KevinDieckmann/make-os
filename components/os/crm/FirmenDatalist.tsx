'use client';

// ─── Firmenauswahl: Vorschlagsliste ohne Kürzung, mit Suchfilter (28.09., Ablaufprüfung) ─
// Vorher boten Kartei (+ Person), Kontakt-Matrix und Stationen nur die ersten 400 Firmen an (`slice(0, 400)`) —
// wer bei 633 Firmen eine hintere suchte, fand sie nicht und legte eine Dublette an. Jetzt: alle Firmen, gefiltert
// nach dem Getippten (Name oder Domain, dieselbe Suchregel wie die Kartei).

import { useMemo, useState, type CSSProperties } from 'react';
import { suchPasst } from '@/lib/text/such-norm';

type FirmaKurz = { id: string; name: string; domain?: string };

/** Die Vorschläge zum Eingabefeld (`list={id}`): alle Firmen, die zum Suchtext passen — ohne Obergrenze. */
export function FirmenDatalist({ id, firmen, suche }: { id: string; firmen: readonly FirmaKurz[]; suche: string }) {
  const liste = useMemo(() => (suche.trim() ? firmen.filter(f => suchPasst([f.name, f.domain], suche)) : firmen), [firmen, suche]);
  return <datalist id={id}>{liste.map(f => <option key={f.id} value={f.name} />)}</datalist>;
}

/** Ungesteuertes Firmenfeld (übernimmt beim Verlassen) mit derselben Vorschlagsliste. */
export function FirmaSuchFeld({ id, firmen, anfang, onFertig, stil, platzhalter }: { id: string; firmen: readonly FirmaKurz[]; anfang: string; onFertig: (name: string) => void; stil: CSSProperties; platzhalter: string }) {
  const [suche, setSuche] = useState(anfang);
  return (
    <>
      <input list={id} defaultValue={anfang} aria-label="Firma" placeholder={platzhalter} onChange={e => setSuche(e.target.value)}
        onBlur={e => onFertig(e.target.value.trim())} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={stil} />
      <FirmenDatalist id={id} firmen={firmen} suche={suche} />
    </>
  );
}
