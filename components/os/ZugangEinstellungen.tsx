'use client';

// ─── Zugang der Instanz (Konto-Seite, nur Inhaber, 05.10.) ──────────────────
// 2FA-Pflicht für alle Konten (wer keinen zweiten Faktor hat, wird beim nächsten Anmelden zur Einrichtung geführt) und
// das Leerlauf-Ende der Sitzungen. Der Server entscheidet (PUT /api/konto/einstellungen, middleware.ts) — die Seite
// zeigt nur an und schaltet.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Schalter, Hinweis, Feldzeile, feld, LEUCHT } from './ui';

interface Bild { ok: boolean; zweiFaktorPflicht: boolean; leerlaufStunden: number; ohneZweitenFaktor: number; fehler?: string }

export function ZugangEinstellungen({ i = 6 }: { i?: number }) {
  const [b, setB] = useState<Bild | null>(null);
  const [stunden, setStunden] = useState('');
  const [meldung, setMeldung] = useState('');
  const laden = () => fetch('/api/konto/einstellungen').then(r => r.json()).then((d: Bild) => { if (d.ok) { setB(d); setStunden(String(d.leerlaufStunden)); } }).catch(() => {});
  useEffect(() => { void laden(); }, []);
  if (!b) return null;
  async function setze(body: Record<string, unknown>, ok: string) {
    setMeldung('');
    const r: Bild = await fetch('/api/konto/einstellungen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    if (r.ok) { setB(r); setStunden(String(r.leerlaufStunden)); setMeldung(ok); } else setMeldung(r.fehler ?? 'Das hat nicht geklappt.');
  }
  const h = Number(stunden);
  const stundenOk = Number.isInteger(h) && h >= 1 && h <= 336;
  return (
    <Karte i={i} akzent={LEUCHT.achtung}>
      <Ueberschrift farbe={LEUCHT.achtung}>Zugang der Instanz</Ueberschrift>
      <Liste>
        <Zeile titel="Zweiter Faktor für alle Pflicht"
          unter={b.zweiFaktorPflicht
            ? 'An — wer keinen zweiten Faktor hat, richtet ihn beim nächsten Anmelden ein und kommt vorher nirgends hin.'
            : `Aus — ${b.ohneZweitenFaktor === 0 ? 'alle Konten haben ihn trotzdem schon.' : `${b.ohneZweitenFaktor} Konto${b.ohneZweitenFaktor === 1 ? '' : 'en'} ohne zweiten Faktor.`} Für Kundendaten empfohlen: an.`}
          rechts={<Schalter an={b.zweiFaktorPflicht} onChange={an => void setze({ zweiFaktorPflicht: an }, an ? 'Pflicht ist an.' : 'Pflicht ist aus.')} ariaLabel="Zweiter Faktor für alle Pflicht" />} />
      </Liste>
      <form className="konto-feldreihe" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); if (stundenOk) void setze({ leerlaufStunden: h }, 'Leerlauf gespeichert.'); }}>
        <Feldzeile label="Abmelden nach so vielen Stunden ohne Aktivität (1–336)"><input value={stunden} onChange={e => setStunden(e.target.value)} inputMode="numeric" style={feld} /></Feldzeile>
        <Knopf leise typ="submit" aus={!stundenOk || h === b.leerlaufStunden}>Speichern</Knopf>
      </form>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Zusätzlich endet jede Sitzung spätestens nach 14 Tagen.</div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={/nicht|Erst/.test(meldung) ? 'kritisch' : 'gut'}>{meldung}</Hinweis></div>}
    </Karte>
  );
}
