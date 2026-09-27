'use client';

import Link from 'next/link';
// ─── MAKE OS — Planung nach Horizont (Monat · Quartal · Jahr) ───────────────
// Eine Seite je Zeithorizont: Fokus, Zeitstrahl, Forecast — und darunter
// Ziele links, Meilensteine rechts (Malins Rückmeldung 27.09.), mit Priorität
// per Pfeil, Erledigtem unten, Business-Einheiten und der Ziel-Kaskade aus dem
// Jahr. Das Bauteil dafür ist components/os/planung/ZieleMeilensteine.tsx —
// dasselbe steht auch in Woche und Tag.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Haken/Zahl).

import { useCallback, useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { NORDSTERN } from '@/lib/make-one/nordstern-data';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Zahl, feld, prioFarbe, LEUCHT } from './schlank';
import { useZiel, useZuZiel } from './ziel';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_LABEL, spaceVonAufgabe, fokusSchluessel, type SpaceId } from '@/lib/make-one/space-regeln';
import { EinheitMarke } from './aufgaben/Einheit';
import { zeitraum } from '@/lib/planung/zeitraum';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import { ZieleMeilensteine } from './planung/ZieleMeilensteine';
import type { PlanungStand } from './planung/usePlanung';

type Horizont = 'monat' | 'quartal' | 'jahr';

const META: Record<Horizont, { titel: string; claim: string; hinweis: string }> = {
  monat: { titel: 'Monatsplanung', claim: 'Was diesen Monat zählt.', hinweis: '3–5 Ziele — mehr ist Verzettelung.' },
  quartal: { titel: 'Quartalsplanung', claim: 'Die Etappe zum Jahresziel.', hinweis: 'Welche 3 Dinge müssen in 3 Monaten stehen?' },
  jahr: { titel: 'Jahresplanung & Ziele', claim: 'Das Jahr, an dem du dich misst.', hinweis: 'Nordstern + Meilensteine + deine Jahresziele — Zahlen und Termine kaskadieren nach unten.' },
};
/** Eine Farbe je Horizont — dieselbe wie auf der Wachstums-Seite. */
const HFARBE: Record<Horizont, string> = { jahr: LEUCHT.schlaf, quartal: LEUCHT.puls, monat: LEUCHT.gut };

const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

export function HorizontView({ horizont }: { horizont: Horizont }) {
  // ?m=<Meilenstein> aus einem Link (Kalender, Energie, Monat): hinspringen und hervorheben (26.09.).
  const zielM = useZiel('m');
  const meta = META[horizont];
  const heute = localDay();
  const zr = zeitraum(horizont, heute);
  const farbe = HFARBE[horizont];
  const { state: tasksState } = useTasks();

  // Der Stand kommt aus dem Ziele/Meilensteine-Bauteil (usePlanung) — hier nur für Forecast, Zeitstrahl, Fokus.
  const [ziele, setZiele] = useState<Ziel[]>([]);
  const [ms, setMs] = useState<Meilenstein[]>([]);
  const [fokusAlle, setFokusAlle] = useState<Record<string, string>>({});
  const [geladen, setGeladen] = useState(false);
  const fokusSetzenRef = useRef<PlanungStand['fokusSetzen'] | null>(null);
  const onStand = useCallback((s: PlanungStand) => { setZiele(s.ziele); setMs(s.ms); setFokusAlle(s.fokus); setGeladen(s.geladen); fokusSetzenRef.current = s.fokusSetzen; }, []);

  // Ziele je Space (26.09., Kevin): Privat, Business, gemeinsam (ohne Space) — der Filter folgt der Adresse oder dem Merker.
  const { space: aktiverSpace, ausAdresse: spaceAusAdresse } = useSpace();
  const [spaceFilter, setSpaceFilter] = useState<SpaceId | 'alle'>('alle');
  useEffect(() => { setSpaceFilter(spaceAusAdresse ?? aktiverSpace); }, [spaceAusAdresse, aktiverSpace]);
  const zieleImSpace = ziele.filter(z => spaceFilter === 'alle' || !z.space || z.space === spaceFilter);
  // Fokus je Space (26.09.): im Space der Space-Satz, ohne Space der gemeinsame.
  const fokusKey = fokusSchluessel(horizont, spaceFilter === 'alle' ? null : spaceFilter);
  const fokus = fokusAlle[fokusKey] ?? '';
  useZuZiel(zielM, geladen);

  function fokusSetzen(v: string) {
    setFokusAlle(a => ({ ...a, [fokusKey]: v }));
    fokusSetzenRef.current?.(fokusKey, v);
  }

  // Aufgaben, die in diesem Zeitraum fällig sind.
  const faellig = tasksState.tasks
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= zr.von && t.dueDate <= zr.bis && (spaceFilter === 'alle' || spaceVonAufgabe(t) === spaceFilter))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const schnitt = zieleImSpace.length ? Math.round(zieleImSpace.reduce((s, z) => s + (z.erledigt ? 100 : z.fortschritt), 0) / zieleImSpace.length) : null;

  // Zeitstrahl: Ticks je Horizont, darauf offene Meilensteine + (Monat) fällige Aufgaben.
  const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ticks: StrahlTick[] = (() => {
    const y = zr.von.slice(0, 4);
    if (horizont === 'jahr') return MON_KURZ.map((l, i) => ({ date: `${y}-${p2(i + 1)}-01`, label: l }));
    if (horizont === 'quartal') {
      const m0 = Number(zr.von.slice(5, 7));
      return [0, 1, 2].map(i => ({ date: `${y}-${p2(m0 + i)}-01`, label: MON_KURZ[m0 + i - 1] }));
    }
    const letzter = Number(zr.bis.slice(8));
    return [1, 8, 15, 22, 29].filter(t => t <= letzter).map(t => ({ date: `${zr.von.slice(0, 8)}${p2(t)}`, label: `${t}.` }));
  })();
  const strahlMarker: StrahlMarker[] = ms
    .filter(m => !m.erledigt && m.faellig && (spaceFilter === 'alle' || (spaceFilter === 'privat' ? m.bereich === 'gesundheit' : m.bereich === 'business')))
    .map(m => ({ date: m.faellig!, label: m.titel, farbe: m.bereich === 'gesundheit' ? LEUCHT.gut : LEUCHT.achtung, symbol: '◇', href: horizont === 'jahr' ? undefined : `/os/planung/jahr?m=${encodeURIComponent(m.id)}` }));
  if (horizont === 'monat') {
    const proTag: Record<string, string[]> = {};
    faellig.forEach(t => { proTag[t.dueDate!] = [...(proTag[t.dueDate!] ?? []), t.title]; });
    Object.keys(proTag).forEach(d => {
      const titel = proTag[d];
      const ids = faellig.filter(t => t.dueDate === d).map(t => t.id);
      strahlMarker.push({ date: d, label: titel.length === 1 ? titel[0] : `${titel.length} Aufgaben`, farbe: C.inkDim, symbol: '●', titel: titel.join(' · '), href: ids.length === 1 ? `/os/aufgaben?offen=${encodeURIComponent(ids[0])}` : '/os/aufgaben' });
    });
  }

  // Forecast: Zeit verstrichen vs. Fortschritt — ehrlich gerechnet, nicht geraten.
  const verstrichen = (() => {
    const von = new Date(`${zr.von}T00:00:00`).getTime();
    const bis = new Date(`${zr.bis}T23:59:59`).getTime();
    const jetzt = Date.now();
    if (jetzt <= von) return 0;
    if (jetzt >= bis) return 100;
    return Math.round(((jetzt - von) / (bis - von)) * 100);
  })();
  const prognose = schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null;
  const prognoseFarbe = prognose == null ? C.inkLeise : prognose >= 95 ? LEUCHT.gut : prognose >= 70 ? LEUCHT.achtung : LEUCHT.kritisch;

  const fokusTitel = `${horizont === 'jahr' ? 'Fokus des Jahres' : horizont === 'quartal' ? 'Fokus des Quartals' : 'Fokus des Monats'}${spaceFilter === 'alle' ? ' · gemeinsam' : ` · ${SPACE_LABEL[spaceFilter]}`}`;
  // Karten-Indizes fürs gestaffelte Erscheinen (das Ziele/Meilensteine-Bauteil belegt drei).
  const hatForecast = schnitt != null && prognose != null;
  const hatNordstern = horizont === 'jahr' && spaceFilter !== 'privat';
  const kForecast = 1, kNordstern = kForecast + (hatForecast ? 1 : 0), kZM = kNordstern + (hatNordstern ? 1 : 0), kAufgaben = kZM + 3;

  return (
    <Seite
      titel={meta.claim}
      unter={<>{meta.titel} · {zr.label} — {meta.hinweis}</>}
      rechts={schnitt != null ? <Chip farbe={col(schnitt)}>Ziele Ø {schnitt} %</Chip> : undefined}
    >
      <PlanerLeiste aktiv={horizont} />

      {/* Fokus dieses Horizonts — die eine Richtung, gegen die geplant wird */}
      <Karte i={0} akzent={farbe}>
        <Ueberschrift farbe={farbe} rechts="Sichtbar im Wochenplaner und in der Tagesplanung — ZOE plant dagegen.">{fokusTitel}</Ueberschrift>
        <input value={fokus} onChange={e => fokusSetzen(e.target.value)} aria-label={fokusTitel}
          placeholder={horizont === 'monat' ? 'z. B. Gesundheit stabilisieren + F&F-Kunden onboarden' : 'Woran richtet sich alles aus?'}
          style={{ ...feld, fontWeight: 600 }} />
      </Karte>

      {/* Zeitstrahl — der Zeitraum als Linie: Heute-Anker, Meilensteine, Fälligkeiten */}
      <Zeitstrahl von={zr.von} bis={zr.bis} ticks={ticks} marker={strahlMarker} />

      {/* Forecast — Zeit vs. Fortschritt, deterministisch */}
      {hatForecast && (
        <Karte i={kForecast}>
          <Ueberschrift farbe={prognoseFarbe}>Forecast</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
            <Zahl wert={String(verstrichen)} label="% der Zeit vorbei" />
            <Zahl wert={String(schnitt)} label="% Ziele im Schnitt" farbe={col(schnitt)} />
            <Zahl wert={String(prognose)} label="% am Ende bei diesem Tempo" farbe={prognoseFarbe} />
          </div>
          <p style={{ fontSize: TYP.body, fontWeight: 600, color: prognoseFarbe, margin: '14px 0 0' }}>
            → bei diesem Tempo ~{prognose} % am Ende{prognose < 95 ? ' — nachschärfen oder Ziel ehrlich kürzen' : ' — Kurs hält'}
          </p>
        </Karte>
      )}

      {/* Jahr: der Nordstern ist Business — im Privat-Space steht er nicht (26.09.). */}
      {hatNordstern && (
        <Karte i={kNordstern}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href={spaceFilter === 'business' ? '/os/finanzen?s=business' : '/os/gesundheit?s=index'} style={{ color: C.inkLeise, textDecoration: 'none' }}>{spaceFilter === 'business' ? 'Meilensteine zählen im Business-Index ›' : 'Meilensteine zählen in den Indizes ›'}</Link>}>Nordstern</Ueberschrift>
          <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55, margin: 0 }}>{NORDSTERN}</p>
        </Karte>
      )}

      {/* Ziele links, Meilensteine rechts — Priorität per Pfeil, Erledigtes unten, Einheiten im Business, Kaskade aus dem Jahr */}
      <ZieleMeilensteine horizont={horizont} farbe={farbe} spaceFilter={spaceFilter} onSpace={setSpaceFilter} onStand={onStand} zielM={zielM} i={kZM} />

      {/* Aufgaben im Zeitraum */}
      <Karte i={kAufgaben}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={faellig.length > 15 ? `die nächsten 15 von ${faellig.length}` : undefined}>Fällig in {zr.label} ({faellig.length})</Ueberschrift>
        {!faellig.length && <Leer>Keine terminierten Aufgaben in diesem Zeitraum.</Leer>}
        <Liste>
          {faellig.slice(0, 15).map(t => (
            <Link key={t.id} href={`/os/aufgaben?offen=${encodeURIComponent(t.id)}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <Zeile
                links={<span style={{ fontSize: TYP.bedien, fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.dueDate && t.dueDate < heute ? LEUCHT.kritisch : C.inkLeise, flex: '0 0 auto', width: 78 }}>{t.dueDate}</span>}
                titel={t.title}
                unter={t.einheit && spaceVonAufgabe(t) === 'business' ? <EinheitMarke name={t.einheit} /> : undefined}
                rechts={<Chip farbe={prioFarbe(t.priority)}>{t.priority}</Chip>} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}
