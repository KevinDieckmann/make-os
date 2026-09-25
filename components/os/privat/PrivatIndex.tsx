'use client';

// ─── Privat-Index (25.09.) — oben unter Zahlen → Privat ─────────────────────
// Dieselbe Logik wie der Business-Index, für euren Haushalt: Reserve &
// Liquidität 40 % · Ausgaben & Budget 35 % · Vermögen & Schulden 25 %. Jede
// Kachel mit Ampel und den Punkten dahinter (Link in Buchungen, Kategorien,
// Schulden); ein Klick öffnet Formel, Schwellen, alle Punkte und den Verlauf.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Ring, Fortschritt, Chip, Knopf, feld, LEUCHT } from '../schlank';
import { useLinkAuswahl } from '../Verlauf';
import { KennzahlKachel, KennzahlFenster, AMPEL_FARBE, scoreFarbe } from '../business/teile';
import { VerlaufKarte, type Serie } from '../business/Verlauf';
import { useZuZiel } from '../ziel';
import type { IndexErgebnis, Ampel } from '@/lib/kennzahlen/kern';

export const PRIVAT_FARBE: Record<string, string> = { rl: LEUCHT.geld, ab: LEUCHT.achtung, vs: LEUCHT.schlaf };
const SERIEN: Serie[] = [
  { id: 'index', label: 'Index', farbe: C.ink, dick: 2.6 },
  { id: 'rl', label: 'Reserve & Liquidität', farbe: PRIVAT_FARBE.rl, dick: 1.8 },
  { id: 'ab', label: 'Ausgaben & Budget', farbe: PRIVAT_FARBE.ab, dick: 1.8 },
  { id: 'vs', label: 'Vermögen & Schulden', farbe: PRIVAT_FARBE.vs, dick: 1.8 },
];

interface Antwort {
  ok: boolean; pi: IndexErgebnis; frisch: boolean;
  ruecklage: { betrag: number; stand: string; von: string } | null;
  verlauf: { tag: string; index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null> }[];
  vor30: number | null;
  wechsel: { id: string; von: Ampel; nach: Ampel; seit: string }[];
  fehler?: string;
}

const senden = (body: Record<string, unknown>) =>
  fetch('/api/privat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

/** stand = ändert sich, wenn sich die Haushaltsdaten ändern (dann neu rechnen). */
export function PrivatIndex({ stand }: { stand?: unknown }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useLinkAuswahl('k');
  const laden = useCallback(async () => {
    const r = await fetch('/api/privat', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden, stand]);
  useZuZiel(null, !!d);

  if (fehler) return <Karte i={0}><div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div></Karte>;
  const pi = d?.pi ?? null;
  const farbe = scoreFarbe(pi?.index ?? null);
  const trend = pi?.index != null && d?.vor30 != null ? pi.index - d.vor30 : null;
  const offeneK = pi && offen ? pi.saeulen.flatMap(s => s.kennzahlen.map(k => ({ k, s }))).find(x => x.k.id === offen) : undefined;
  const alleK = pi?.saeulen.flatMap(s => s.kennzahlen) ?? [];

  return (
    <>
      <Karte i={0} akzent={farbe} id="index" style={{ scrollMarginTop: 90 }}>
        <div style={{ display: 'flex', gap: 'clamp(18px, 4vw, 44px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring groesse="gross" wert={pi?.index != null ? String(pi.index) : undefined} anteil={pi?.index != null ? pi.index / 100 : undefined} farbe={farbe} label={pi ? `Privat · ${pi.label}` : 'lädt …'} />
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip farbe={farbe}>Privat-Index</Chip>
              {trend != null && trend !== 0 && <Chip farbe={trend > 0 ? LEUCHT.gut : LEUCHT.kritisch}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)} in 30 Tagen</Chip>}
              {d && !d.frisch && <Chip farbe={LEUCHT.achtung}>Buchungen älter als 45 Tage</Chip>}
              {pi && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{Math.round(pi.abdeckung * 100)} % auf echten Daten · {pi.luecken} Messlücke{pi.luecken === 1 ? '' : 'n'}</span>}
            </div>
            {pi?.saeulen.map(s => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(70px, 2fr) 40px', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{s.label} <span style={{ color: C.inkLeise, fontWeight: 400 }}>{Math.round(s.gewicht * 100)} %</span></span>
                <Fortschritt anteil={(s.score ?? 0) / 100} farbe={s.zuDuenn ? C.inkLeise : PRIVAT_FARBE[s.id]} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, textAlign: 'right', color: s.score == null || s.zuDuenn ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.score ?? '—'}{s.zuDuenn ? '*' : ''}</span>
              </div>
            ))}
            {pi?.hebel && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Größter Hebel: <button onClick={() => setOffen(pi.hebel!.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontWeight: 700, cursor: 'pointer', fontSize: TYP.bedien, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)' }}>{pi.hebel.label}</button> ({pi.hebel.saeule})</div>}
          </div>
        </div>
        {!!d?.wechsel.length && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: C.inkLeise }}>Seit {d.wechsel[0].seit.slice(8)}.{d.wechsel[0].seit.slice(5, 7)}.:</span>
            {d.wechsel.map(w => <button key={w.id} onClick={() => setOffen(w.id)} style={{ background: `${AMPEL_FARBE[w.nach]}1c`, border: 'none', borderRadius: 999, padding: '4px 10px', color: AMPEL_FARBE[w.nach], cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{alleK.find(x => x.id === w.id)?.label ?? w.id}: {w.von} → {w.nach}</button>)}
          </div>
        )}
      </Karte>

      {pi?.saeulen.map((s, i) => (
        <Karte key={s.id} i={i + 1} akzent={PRIVAT_FARBE[s.id]}>
          <Ueberschrift farbe={PRIVAT_FARBE[s.id]} rechts={<span>{s.kennzahlen.filter(k => k.gemessen).length} von {s.kennzahlen.length} gemessen{s.zuDuenn ? ' · zählt noch nicht' : ''}</span>}>
            {s.label} · {Math.round(s.gewicht * 100)} % {s.score != null && <span style={{ color: C.ink, marginLeft: 6, letterSpacing: 0 }}>{s.score}</span>}
          </Ueberschrift>
          <div style={{ fontSize: 12.5, color: C.inkLeise, margin: '-4px 0 12px' }}>{s.satz}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
            {s.kennzahlen.map(k => <KennzahlKachel key={k.id} k={k} onOeffnen={() => setOffen(k.id)} />)}
          </div>
        </Karte>
      ))}

      {d && <RuecklageKarte r={d.ruecklage} onGespeichert={() => void laden()} />}
      {d && d.verlauf.length > 1 && <VerlaufKarte punkte={d.verlauf} serien={SERIEN} i={5} name="Privat-Index" />}

      {offeneK && d && (
        <KennzahlFenster key={offeneK.k.id} k={offeneK.k} saeule={offeneK.s.label} scope="privat" onZu={() => setOffen(null)} onGespeichert={() => void laden()}
          schwelleSenden={schwelle => senden({ schwelle })}
          verlauf={d.verlauf.map(v => ({ tag: v.tag, wert: v.werte?.[offeneK.k.id] ?? null }))} />
      )}
    </>
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
