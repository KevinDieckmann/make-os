'use client';

// ─── Kalender — „Mit … planen“ und Termine finden (29.09., Paket K4) ─────────
// Kevin: „Gemeinsame freie Zeit (Kevin + Malin übereinander, freie Lücken vorschlagen).“ Wie „Meet with…“ bei Google:
// Personen wählen → die Termine der anderen Person liegen halbtransparent im Raster (private nur als „belegt“),
// darunter die „Freien Zeiten“ (eine Lesefunktion: /api/kalender/frei → lib/kalender/freie-zeit.ts). Klick auf eine
// Lücke öffnet den Anlege-Dialog (K1, `NeuerTermin`) vorbelegt — angelegt wird erst dort.
//
// Einhängen in Kalender.tsx über EINEN Haken: `useTermineFinden` liefert die Karten der Leiste (Mit … planen,
// Buchungsseiten), die Überlagerung fürs Raster, die Farbe und das Öffnen von Buchungs-Einträgen.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT } from '../schlank';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import { usePersonen } from '../aufgaben/hilfe';
import { FreieZeiten } from './FreieZeiten';
import { Buchungsseiten, useBuchungen } from './Buchungsseiten';
import type { KTermin, Wer } from './teile';
import type { Vorgabe } from './NeuerTermin';
import type { FreieZeit } from '@/lib/kalender/verfuegbar';

const DAUERN = [15, 30, 45, 60, 90];

/** Farbe halbtransparent über dem Grund (6-stelliges Hex bleibt 6-stellig — das Raster hängt eigene Alpha-Stufen an). */
export function gedimmt(hex: string, anteil = 0.45): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16), g = parseInt(C.grund.slice(1), 16);
  const mix = (s: number) => Math.round(((n >> s) & 255) * anteil + ((g >> s) & 255) * (1 - anteil));
  return `#${[16, 8, 0].map(s => mix(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Private Termine der anderen Person nur als „belegt“ — /api/kalender maskiert sie schon (K1 `maskieren`); doppelt hält besser. */
function istPrivat(t: KTermin): boolean {
  const x = t as KTermin & { maskiert?: boolean; sichtbarkeit?: string };
  return x.maskiert === true || x.sichtbarkeit === 'privat';
}

interface Planen { personen: string[]; dauer: number; puffer: number }
/** Ein Termin der anderen Person im Raster — halbtransparent. */
type Ueberlagert = KTermin & { gedimmt?: boolean };

const KEINE: KTermin[] = [];

export function useTermineFinden({ alle = KEINE, onVorschlag }: { alle?: KTermin[]; onVorschlag: (v: Vorgabe) => void }) {
  const personen = usePersonen();
  const [ich, setIch] = useState('');
  useEffect(() => { setIch(personLesen()); }, []);
  const [planen, setPlanen] = useState<Planen | null>(null);
  const [vorschlaege, setVorschlaege] = useState<FreieZeit[] | null>(null);
  const [feiertage, setFeiertage] = useState<Record<string, string>>({});
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const buchungen = useBuchungen();

  const suchen = useCallback(async (p: Planen) => {
    if (!p.personen.length) { setVorschlaege(null); return; }
    setLaedt(true); setFehler('');
    try {
      const r = await fetch(`/api/kalender/frei?personen=${encodeURIComponent(p.personen.join(','))}&dauer=${p.dauer}&puffer=${p.puffer}&tage=14`, { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setVorschlaege(j.vorschlaege); setFeiertage(j.feiertage ?? {}); } else setFehler(j.fehler ?? 'Nicht gefunden.');
    } catch { setFehler('Keine Verbindung.'); }
    setLaedt(false);
  }, []);
  useEffect(() => { if (planen) void suchen(planen); }, [planen, suchen]);

  const andere = useMemo(() => new Set((planen?.personen ?? []).filter(p => p !== ich)), [planen, ich]);

  /** Raster: die eigenen (gefilterten) Termine + die der anderen gewählten Person(en) halbtransparent, dazu offene Buchungen. */
  const raster = useCallback((sicht: KTermin[]): KTermin[] => {
    const markiert = (t: KTermin, id = t.id): Ueberlagert => (istPrivat(t)
      ? { ...t, id, titel: 'belegt', ort: undefined, notiz: undefined, bearbeitbar: false, gedimmt: true }
      : { ...t, id, gedimmt: true, ...(id !== t.id ? { bearbeitbar: false } : {}) });
    const da = new Set(sicht.map(t => t.id));
    const eigene = sicht.map(t => (andere.has(t.wer) ? markiert(t) : t));
    const dazu = andere.size ? alle.filter(t => andere.has(t.wer) && !da.has(t.id)).map(t => markiert(t, `mit-${t.id}`)) : [];
    return [...eigene, ...dazu, ...buchungen.alsTermine];
  }, [alle, andere, buchungen.alsTermine]);

  const farbe = useCallback((f: (t: KTermin) => string) => (t: KTermin) => {
    if (t.id.startsWith('buchung-')) return gedimmt(LEUCHT.achtung, 0.7);
    return (t as Ueberlagert).gedimmt ? gedimmt(f(t)) : f(t);
  }, []);

  const oeffnen = useCallback((t: KTermin): boolean => {
    if (t.id.startsWith('buchung-')) { buchungen.zeigen(); return true; }
    return t.id.startsWith('mit-') ? true : false;
  }, [buchungen]);

  const vorlegen = (f: FreieZeit) => {
    const wer: Wer = planen && planen.personen.length > 1 ? 'beide' : ((planen?.personen[0] ?? 'kevin') as Wer);
    onVorschlag({ tag: f.tag, von: f.start.slice(11, 16), bis: f.ende.slice(11, 16), wer });
  };

  const karte: ReactNode = (
    <MitPlanenKarte personen={personen} ich={ich} planen={planen} setPlanen={setPlanen} vorschlaege={vorschlaege} feiertage={feiertage} laedt={laedt} fehler={fehler} onWahl={vorlegen} />
  );
  return { karten: <>{karte}<Buchungsseiten b={buchungen} /></>, raster, farbe, oeffnen };
}

function MitPlanenKarte({ personen, ich, planen, setPlanen, vorschlaege, feiertage, laedt, fehler, onWahl }: {
  personen: { speicher: string; name: string }[]; ich: string; planen: Planen | null; setPlanen: (p: Planen | null) => void;
  vorschlaege: FreieZeit[] | null; feiertage: Record<string, string>; laedt: boolean; fehler: string; onWahl: (f: FreieZeit) => void;
}) {
  const wahl = planen?.personen ?? [];
  const umschalten = (p: string) => {
    const neu = wahl.includes(p) ? wahl.filter(x => x !== p) : [...wahl, p];
    setPlanen(neu.length ? { dauer: planen?.dauer ?? 30, puffer: planen?.puffer ?? 0, personen: neu } : null);
  };
  return (
    <Karte i={2}>
      <Ueberschrift rechts={planen ? <Knopf leise onClick={() => setPlanen(null)}>aus</Knopf> : undefined}>Mit … planen</Ueberschrift>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {personen.map(p => { const an = wahl.includes(p.speicher); return (
          <button key={p.speicher} onClick={() => umschalten(p.speicher)} aria-pressed={an} style={{ border: `1px solid ${an ? LEUCHT.puls : 'rgba(255,255,255,.1)'}`, background: an ? `${LEUCHT.puls}22` : 'transparent', color: an ? C.ink : C.inkDim, borderRadius: 999, padding: '4px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: SCHRIFT.text }}>
            {p.name}{p.speicher === ich ? ' (ich)' : ''}
          </button>
        ); })}
      </div>
      {!planen && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>Personen wählen — ihre Termine liegen halbtransparent im Raster, darunter die gemeinsamen freien Zeiten.</div>}
      {planen && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.inkLeise }}>
            <label>Dauer <select value={planen.dauer} onChange={e => setPlanen({ ...planen, dauer: Number(e.target.value) })} style={{ background: 'rgba(255,255,255,.05)', color: C.ink, border: 'none', borderRadius: 7, padding: '3px 6px' }}>{DAUERN.map(d => <option key={d} value={d}>{d} Min</option>)}</select></label>
            <label>Puffer <select value={planen.puffer} onChange={e => setPlanen({ ...planen, puffer: Number(e.target.value) })} style={{ background: 'rgba(255,255,255,.05)', color: C.ink, border: 'none', borderRadius: 7, padding: '3px 6px' }}>{[0, 5, 10, 15, 30].map(d => <option key={d} value={d}>{d} Min</option>)}</select></label>
          </div>
          <div style={{ fontSize: 12, color: C.inkDim, fontWeight: 600 }}>Freie Zeiten · nächste 14 Tage{laedt ? ' · sucht …' : ''}</div>
          {fehler && <div style={{ fontSize: 12, color: LEUCHT.achtung }}>{fehler}</div>}
          {vorschlaege && <FreieZeiten vorschlaege={vorschlaege} feiertage={feiertage} onWahl={onWahl} />}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 10 }}>Zählt: beschäftigte Termine, Abwesend, Feiertage NRW und die Arbeitszeit aus der <Link href={WEG.routinen()} style={{ color: C.inkDim }}>Wochenvorlage</Link> (ohne Vorlage Mo–Fr 9–18).</div>
    </Karte>
  );
}
