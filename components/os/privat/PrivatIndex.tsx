'use client';

// ─── Privat-Index (25.09.) — oben unter Zahlen → Privat ─────────────────────
// Dieselbe Logik wie der Business-Index, für euren Haushalt: Reserve &
// Liquidität 40 % · Ausgaben & Budget 35 % · Vermögen & Schulden 25 %. Die
// Ansicht ist die gemeinsame aller Indizes (IndexAnsicht); eigen ist nur die
// Rücklage-Karte.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { WEG } from '@/lib/wege';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, feld, LEUCHT, Hinweis } from '../ui';
import { IndexAnsicht, type IndexDaten } from '../kennzahlen/IndexAnsicht';

export const PRIVAT_FARBE: Record<string, string> = { rl: LEUCHT.geld, ab: LEUCHT.achtung, vs: LEUCHT.schlaf };

interface Antwort extends IndexDaten { ok: boolean; frisch: boolean; ruecklage: { betrag: number; stand: string; von: string; quelle?: 'register' } | null; fehler?: string }

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
  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  return (
    <IndexAnsicht d={d} name="Privat" chip="Privat-Index" farben={PRIVAT_FARBE} scope="privat" kopfId="index" fadenLinie
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
      {/* Ein Formular: Enter speichert wie der Knopf (Praxis-Fund N7). */}
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input inputMode="decimal" value={wert} onChange={e => setWert(e.target.value)} placeholder="z. B. 12.000" aria-label="Rücklage in Euro" enterKeyHint="done"
          style={{ ...feld, width: 180, fontSize: TYP.body, fontFamily: SCHRIFT.display, fontWeight: 700, padding: '9px 12px', fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ color: C.inkLeise }}>€</span>
        <Knopf farbe={LEUCHT.geld} typ="submit">Speichern</Knopf>
      </form>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.ok ? 'gut' : 'kritisch'}>{meldung.text}</Hinweis></div>}
      {/* Konten-Register (08.10.): führt es Tagesgeld-Konten mit Stand, gilt deren Summe — die Eintragung hier bleibt gespeichert, zählt dann aber nicht. */}
      {r?.quelle === 'register' && <div style={{ marginTop: 10 }}><Hinweis art="info">Gilt jetzt: die Tagesgeld-Konten aus dem Konten-Register ({Math.round(r.betrag / 100).toLocaleString('de-DE')} €). Stände pflegt ihr unter <Link href={WEG.kontenRegister('privat')} style={{ color: 'inherit' }}>Konten & Buchungen</Link>.</Hinweis></div>}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Was sofort verfügbar ist (Tagesgeld, Notgroschen) — ohne Depot und Altersvorsorge. Die Kontoauszüge enthalten keine Kontostände, deshalb tragt ihr die Rücklage hier ein; einmal im Monat aktualisieren reicht.</div>
    </Karte>
  );
}
