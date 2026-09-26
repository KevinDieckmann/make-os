'use client';

// ─── Privat-Index (25.09.) — oben unter Zahlen → Privat ─────────────────────
// Dieselbe Logik wie der Business-Index, für euren Haushalt: Reserve &
// Liquidität 40 % · Ausgaben & Budget 35 % · Vermögen & Schulden 25 %. Die
// Ansicht ist die gemeinsame aller Indizes (IndexAnsicht); eigen ist nur die
// Rücklage-Karte.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, feld, LEUCHT } from '../schlank';
import { IndexAnsicht, type IndexDaten } from '../kennzahlen/IndexAnsicht';

export const PRIVAT_FARBE: Record<string, string> = { rl: LEUCHT.geld, ab: LEUCHT.achtung, vs: LEUCHT.schlaf };

interface Antwort extends IndexDaten { ok: boolean; frisch: boolean; ruecklage: { betrag: number; stand: string; von: string } | null; fehler?: string }

const senden = (body: Record<string, unknown>) =>
  fetch('/api/privat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

/** stand = ändert sich, wenn sich die Haushaltsdaten ändern (dann neu rechnen). */
export function PrivatIndex({ stand }: { stand?: unknown }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch('/api/privat', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden, stand]);
  if (fehler) return <Karte i={0}><div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div></Karte>;
  return (
    <IndexAnsicht d={d} name="Privat" chip="Privat-Index" farben={PRIVAT_FARBE} scope="privat" kopfId="index"
      schwelleSenden={schwelle => senden({ schwelle })} onGespeichert={() => void laden()}
      chips={d && !d.frisch ? <Chip farbe={LEUCHT.achtung}>Buchungen älter als 45 Tage</Chip> : undefined}
      zwischen={d ? <RuecklageKarte r={d.ruecklage} onGespeichert={() => void laden()} /> : null} />
  );
}

function RuecklageKarte({ r, onGespeichert }: { r: Antwort['ruecklage']; onGespeichert: () => void }) {
  const [wert, setWert] = useState(r ? String(Math.round(r.betrag / 100)) : '');
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setWert(r ? String(Math.round(r.betrag / 100)) : ''); }, [r?.betrag]); // eslint-disable-line react-hooks/exhaustive-deps
  const speichern = async () => {
    const x = await senden({ ruecklage: wert.trim() ? wert : null });
    setMeldung(x.ok ? { ok: true, text: 'Gespeichert — der Notgroschen rechnet neu.' } : { ok: false, text: x.fehler ?? 'Nicht gespeichert.' });
    if (x.ok) onGespeichert();
  };
  return (
    <Karte i={4} id="ruecklage" style={{ scrollMarginTop: 90 }}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={r ? <span>Stand {r.stand.slice(8, 10)}.{r.stand.slice(5, 7)}.{r.stand.slice(0, 4)}</span> : <span>fehlt noch</span>}>Rücklage · Notgroschen</Ueberschrift>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} placeholder="z. B. 12.000" aria-label="Rücklage in Euro"
          style={{ ...feld, width: 180, fontSize: TYP.body, fontFamily: SCHRIFT.display, fontWeight: 700, padding: '9px 12px', fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ color: C.inkLeise }}>€</span>
        <Knopf farbe={LEUCHT.geld} onClick={() => void speichern()}>Speichern</Knopf>
        {meldung && <span style={{ fontSize: 12.5, color: meldung.ok ? LEUCHT.gut : LEUCHT.kritisch }}>{meldung.text}</span>}
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Was sofort verfügbar ist (Tagesgeld, Notgroschen) — ohne Depot und Altersvorsorge. Die Kontoauszüge enthalten keine Kontostände, deshalb tragt ihr die Rücklage hier ein; einmal im Monat aktualisieren reicht.</div>
    </Karte>
  );
}
