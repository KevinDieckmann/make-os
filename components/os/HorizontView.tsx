'use client';

import Link from 'next/link';
// ─── MAKE OS — Planung nach Horizont (Monat · Quartal · Jahr) ───────────────
// Eine Seite je Zeithorizont: Fokus, Zeitstrahl, Forecast — und darunter
// Ziele links, Meilensteine rechts (Malins Rückmeldung 27.09.), mit Priorität
// per Pfeil, Erledigtem unten, Business-Einheiten und der Ziel-Kaskade aus dem
// Jahr. Das Bauteil dafür ist components/os/planung/ZieleMeilensteine.tsx —
// dasselbe steht auch in Woche und Tag.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Haken/Zahl).
// 30.09. (Kevin: „bis Ende nächsten Jahres gucken und planen“, „einzeln nach vorne und hinten scrollen“):
// Im Jahr EIN Stand (usePlanung hier, ans Bauteil gereicht) für Zeitstrahl, Forecast, Fokus und Listen.
//   · Zeitstrahl = Fenster aus ganzen Monaten (planung/useStrahlFenster.ts): Zeitraum-Wahl (Standard „Bis Ende
//     nächsten Jahres“), Blättern ‹ › / Tasten / Wischen, „Heute“, alles in der Adresse (`?raum=`, `?ab=`).
//     Marker: Meilensteine (offen + erledigt leise), Jahresziele mit Frist ohne eigenen Meilenstein, Projekt-Fristen;
//     Quartale als Bänder. Klick auf eine Stelle / „+ Meilenstein“ legt an (vorbelegt: Datum, Bereich, Einheit),
//     Klick auf einen Meilenstein öffnet seine Detailseite (WEG.meilenstein, Paket „meilensteine“).
//   · Planungsjahr (`?jahr=`): mindestens laufendes + nächstes; Ziele, Meilensteine, Fokus und Forecast je Jahr.
//     Das Nachladen beim Blättern entfällt: Meilensteine/Ziele/Projekte kommen je einmal ganz (ein Bestand), gefiltert
//     wird rein nach Fenster.
// 03.10. (Kevin: „Alle Stränge sollen nachher darein laufen“): Im Jahr stehen die Lichtfäden v2 (components/os/lichtfaeden,
// LICHTFAEDEN.md) — Wurzel = der gewählte Space (bzw. Gesamt): alle Stränge aus Planung, Kalender, Markttraktion, Finanzen,
// Familie und Gesundheit, Tippen auf ein Bündel = eine Ebene tiefer. Blättern, Heute, Anlegen per Klick bleiben wie gehabt.
import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Zahl, feld, prioFarbe, LEUCHT, Segmente, Knopf, useRueckgaengig, FlussKarte } from './ui';
import { useZiel, useZuZiel } from './ziel';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_LABEL, spaceVonAufgabe, fokusSchluessel, type SpaceId } from '@/lib/make-one/space-regeln';
import { EinheitMarke } from './aufgaben/Einheit';
import { zeitraum } from '@/lib/planung/zeitraum';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import { passtEinheit } from '@/lib/planung/einheiten';
import { beginntText, jahrAus, jahrLage, meilensteinImJahr, meilensteinJahr, planJahre, zielJahr, type JahrLage } from '@/lib/planung/zeitstrahl';
import { fokusImJahr, fokusJahrSchluessel } from '@/lib/planung/jahr-fokus';
import { WEG } from '@/lib/wege';
import { wartetText } from '@/lib/planung/meilenstein-kette';
import { zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';
import { ZieleMeilensteine } from './planung/ZieleMeilensteine';
import { NordsternKarte } from './planung/NordsternKarte';
import { usePlanung } from './planung/usePlanung';
import { useStrahlFenster, adresseSetzen } from './planung/useStrahlFenster';
import { useMeilensteinFenster } from './planung/MeilensteinFenster';
import { NeuAnfangenKnopf } from './aufgaben/NeuAnfangen';
import { Lichtfaeden } from './lichtfaeden/Lichtfaeden';
import { Seil } from './seil/Seil';
import { useKapazitaet } from './kapazitaet/useKapazitaet';
import { LastBand } from './kapazitaet/teile';
import { wirksamerSpace } from '@/lib/planung/bereich';

type Horizont = 'monat' | 'quartal' | 'jahr';

const META: Record<Horizont, { titel: string; claim: string; hinweis: string }> = {
  monat: { titel: 'Monatsplanung', claim: 'Was diesen Monat zählt.', hinweis: '3–5 Ziele — mehr ist Verzettelung.' },
  quartal: { titel: 'Quartalsplanung', claim: 'Die Etappe zum Jahresziel.', hinweis: 'Welche 3 Dinge müssen in 3 Monaten stehen?' },
  jahr: { titel: 'Jahresplanung & Ziele', claim: 'Das Jahr, an dem du dich misst.', hinweis: 'Zahlen und Termine kaskadieren nach unten.' },
};
/** Eine Farbe je Horizont — dieselbe wie auf der Wachstums-Seite. */
const HFARBE: Record<Horizont, string> = { jahr: LEUCHT.schlaf, quartal: LEUCHT.puls, monat: LEUCHT.gut };

const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

export function HorizontView({ horizont }: { horizont: Horizont }) {
  // ?m=<Meilenstein> aus einem Link (Kalender, Energie, Monat): hinspringen und hervorheben (26.09.).
  const zielM = useZiel('m');
  const meta = META[horizont];
  const heute = localDay();
  const laufend = Number(heute.slice(0, 4));
  const farbe = HFARBE[horizont];
  const { state: tasksState } = useTasks();
  const istJahr = horizont === 'jahr';

  // EIN Stand für Zeitstrahl, Forecast, Fokus und die Listen darunter (30.09. — vorher reichte das Bauteil ihn hoch).
  const p = usePlanung(horizont);
  const { ziele, ms, fokus: fokusAlle, geladen } = p;
  const rueck = useRueckgaengig();

  // Planungsjahr (30.09.): aus der Adresse (`?jahr=`), ein verlinkter Meilenstein zieht in sein Jahr.
  const [planJahr, setPlanJahrRoh] = useState(laufend);
  useEffect(() => { const j = jahrAus(new URLSearchParams(window.location.search).get('jahr'), laufend); if (j) setPlanJahrRoh(j); }, [laufend]);
  useEffect(() => {
    if (!istJahr || !zielM) return;
    const m = ms.find(x => x.id === zielM);
    if (m && !meilensteinImJahr(m, planJahr, laufend)) { const j = meilensteinJahr(m); if (j) setPlanJahrRoh(j); }
  }, [istJahr, zielM, ms]); // eslint-disable-line react-hooks/exhaustive-deps -- nur beim Ankommen
  const setPlanJahr = (j: number) => { setPlanJahrRoh(j); adresseSetzen({ jahr: j === laufend ? null : String(j) }); };
  const [extraJahre, setExtraJahre] = useState<number[]>([]);
  const jahre = useMemo(() => planJahre(laufend, [...ziele.map(z => zielJahr(z, laufend)), ...ms.map(meilensteinJahr), ...extraJahre, planJahr]), [laufend, ziele, ms, extraJahre, planJahr]);
  const zr = istJahr ? { von: `${planJahr}-01-01`, bis: `${planJahr}-12-31`, label: String(planJahr) } : zeitraum(horizont, heute);

  // Ziele je Space (26.09., Kevin): Privat, Business, gemeinsam (ohne Space) — der Filter folgt der Adresse oder dem Merker.
  // „Alles“ im Kopf (08.10.) = Filter „alle“ (`filter` aus useSpace).
  const { filter: spaceVorgabe } = useSpace();
  const [spaceFilter, setSpaceFilter] = useState<SpaceId | 'alle'>('alle');
  useEffect(() => { setSpaceFilter(spaceVorgabe); }, [spaceVorgabe]);
  // Einheit (nur Business) — hier gehalten, damit das Anlegen am Zeitstrahl sie vorbelegt.
  const [einheitFilter, setEinheitFilter] = useState('alle');
  const imBusiness = spaceFilter === 'business';
  // Bereich abgeleitet (05.10. abends): Ziele der Selbstständigkeit stehen unter Privat (`wirksamerSpace`).
  const zieleImSpace = ziele.filter(z => { const zs = wirksamerSpace(z); return (spaceFilter === 'alle' || !zs || zs === spaceFilter) && (!istJahr || zielJahr(z, laufend) === planJahr); });
  // Fokus je Space (26.09.) und im Jahr je Jahr (30.09., lib/planung/jahr-fokus.ts): im Space der Space-Satz, ohne Space der gemeinsame.
  const fokusBasis = fokusSchluessel(horizont, spaceFilter === 'alle' ? null : spaceFilter);
  const fokusKey = istJahr ? fokusJahrSchluessel(fokusBasis, planJahr) : fokusBasis;
  const fokus = istJahr ? fokusImJahr(fokusAlle, fokusBasis, planJahr, laufend) : (fokusAlle[fokusKey] ?? '');
  useZuZiel(zielM, geladen);

  function fokusSetzen(v: string) { p.fokusSetzen(fokusKey, v); }

  // Aufgaben, die in diesem Zeitraum fällig sind.
  const faellig = tasksState.tasks
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= zr.von && t.dueDate <= zr.bis && (spaceFilter === 'alle' || spaceVonAufgabe(t) === spaceFilter))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const schnitt = zieleImSpace.length ? Math.round(zieleImSpace.reduce((s, z) => s + (z.erledigt ? 100 : z.fortschritt), 0) / zieleImSpace.length) : null;

  // ── Meilenstein öffnen / anlegen — EINE Stelle: öffnen = die Detailseite (Aufgaben, Verlauf, Dateien, Notizen —
  // WEG.meilenstein, 30.09.), anlegen = das Fenster (dort auch Bearbeiten/Verschieben/Löschen mit „Rückgängig“) ──
  const msFenster = useMeilensteinFenster(p, rueck, heute);
  const vorgabe = (tag?: string) => ({
    faellig: tag ?? (planJahr === laufend ? heute : `${planJahr}-01-15`),
    space: spaceFilter === 'alle' ? 'business' as const : spaceFilter,
    ...(imBusiness && einheitFilter !== 'alle' ? { einheit: einheitFilter } : {}),
  });

  // ── Zeitstrahl: im Jahr das Seil (07.10., Standard) bzw. die Lichtfäden („Alle Stränge“) — ein Fenster zum Blättern; in Monat/Quartal der schlichte Strahl ──
  const fensterJahr = useStrahlFenster(planJahr);
  const [jahrSicht, setJahrSicht] = useState<'seil' | 'faeden'>('seil');
  useEffect(() => { try { const v = localStorage.getItem('make-planung-jahr-sicht'); if (v === 'seil' || v === 'faeden') setJahrSicht(v); } catch { /* ohne Speicher: Seil */ } }, []);
  const jahrSichtSetzen = (v: 'seil' | 'faeden') => { setJahrSicht(v); try { localStorage.setItem('make-planung-jahr-sicht', v); } catch { /* egal */ } };
  const sichtWahl = <Segmente liste={[{ id: 'seil' as const, label: 'Seil' }, { id: 'faeden' as const, label: 'Alle Stränge' }]} aktiv={jahrSicht} onWahl={jahrSichtSetzen} />;
  // Kapazität (04.10.): Last je Woche als dezentes Band UNTER dem Strahl (eigene Komponente — der Strahl selbst bleibt unberührt).
  const kapa = useKapazitaet(istJahr && spaceFilter !== 'privat');
  const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ticks: StrahlTick[] = (() => {
    const y = zr.von.slice(0, 4);
    if (horizont === 'quartal') {
      const m0 = Number(zr.von.slice(5, 7));
      return [0, 1, 2].map(i => ({ date: `${y}-${p2(m0 + i)}-01`, label: MON_KURZ[m0 + i - 1] }));
    }
    const letzter = Number(zr.bis.slice(8));
    return [1, 8, 15, 22, 29].filter(t => t <= letzter).map(t => ({ date: `${zr.von.slice(0, 8)}${p2(t)}`, label: `${t}.` }));
  })();
  const imFilter = (space: SpaceId, einheit?: string) => (spaceFilter === 'alle' || space === spaceFilter) && (!imBusiness || passtEinheit(einheit, einheitFilter));
  /** Der Titel des Ziels, auf das ein Meilenstein einzahlt (Marker-Text; führt die Kette 01.10.). */
  const zielTitel = (m: { zielId?: string; abgeleitetVon?: string }) => { const id = zielVonMeilenstein(m); return id ? p.alleZiele.find(z => z.id === id)?.titel : undefined; };
  const strahlMarker: StrahlMarker[] = istJahr ? [] : ms
    .filter(m => m.faellig && !m.erledigt && imFilter(meilensteinSpace(m), m.einheit))
    .map(m => ({
      id: m.id, date: m.faellig!, label: m.titel, farbe: meilensteinSpace(m) === 'privat' ? LEUCHT.gut : LEUCHT.achtung,
      symbol: '◇',
      titel: `${m.titel} · ${m.faellig!.slice(8)}.${m.faellig!.slice(5, 7)}.${m.faellig!.slice(0, 4)} · ${m.fortschritt} %${wartetText(m, ms) ? ` · ${wartetText(m, ms)}` : ''}${zielTitel(m) ? ` · Ziel „${zielTitel(m)}“` : ''}`,
      href: WEG.meilenstein(m.id),
    }));
  if (horizont === 'monat') {
    const proTag: Record<string, string[]> = {};
    faellig.forEach(t => { proTag[t.dueDate!] = [...(proTag[t.dueDate!] ?? []), t.title]; });
    Object.keys(proTag).forEach(d => {
      const titel = proTag[d];
      const ids = faellig.filter(t => t.dueDate === d).map(t => t.id);
      strahlMarker.push({ date: d, label: titel.length === 1 ? titel[0] : `${titel.length} Aufgaben`, farbe: C.inkDim, symbol: '●', titel: titel.join(' · '), href: ids.length === 1 ? `/os/aufgaben?offen=${encodeURIComponent(ids[0])}` : '/os/aufgaben' });
    });
  }

  // Forecast: Zeit verstrichen vs. Fortschritt — ehrlich gerechnet, nicht geraten. Im Jahr je Planungsjahr (30.09.):
  // läuft · beginnt in n Monaten (keine 0 % „Zeit vorbei“) · abgeschlossen.
  const lage: JahrLage = (() => {
    if (istJahr) return jahrLage(planJahr, heute, schnitt);
    const von = new Date(`${zr.von}T00:00:00`).getTime();
    const bis = new Date(`${zr.bis}T23:59:59`).getTime();
    const jetzt = Date.now();
    const verstrichen = jetzt <= von ? 0 : jetzt >= bis ? 100 : Math.round(((jetzt - von) / (bis - von)) * 100);
    return { art: 'laeuft', verstrichen, schnitt, prognose: schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null };
  })();
  const prognose = lage.art === 'laeuft' ? lage.prognose : null;
  const prognoseFarbe = prognose == null ? C.inkLeise : prognose >= 95 ? LEUCHT.gut : prognose >= 70 ? LEUCHT.achtung : LEUCHT.kritisch;
  const msImJahr = istJahr ? ms.filter(m => meilensteinImJahr(m, planJahr, laufend) && imFilter(meilensteinSpace(m), m.einheit)) : [];

  const fokusTitel = `${istJahr ? `Fokus des Jahres ${planJahr}` : horizont === 'quartal' ? 'Fokus des Quartals' : 'Fokus des Monats'}${spaceFilter === 'alle' ? ' · gemeinsam' : ` · ${SPACE_LABEL[spaceFilter]}`}`;
  // Karten-Indizes fürs gestaffelte Erscheinen (das Ziele/Meilensteine-Bauteil belegt drei).
  const hatForecast = lage.art === 'zukunft' || (lage.art === 'vorbei' && schnitt != null) || (schnitt != null && prognose != null);
  const hatNordstern = horizont === 'jahr' && spaceFilter !== 'privat';
  const kForecast = 1, kNordstern = kForecast + (hatForecast ? 1 : 0), kZM = kNordstern + (hatNordstern ? 1 : 0), kAufgaben = kZM + 3;

  return (
    <Seite
      titel={meta.titel}
      unter={<>{zr.label} · {meta.claim} {meta.hinweis}</>}
      rechts={<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{schnitt != null && <Chip farbe={col(schnitt)}>Ziele Ø {schnitt} %</Chip>}<NeuAnfangenKnopf klein /></span>}
    >
      <PlanerLeiste aktiv={horizont} />

      {/* Planungsjahr (30.09.): laufendes + nächstes (und belegte) — Ziele, Meilensteine, Fokus und Forecast je Jahr */}
      {istJahr && (
        <div role="group" aria-label="Planungsjahr" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Planungsjahr</span>
          <Segmente liste={jahre.map(j => ({ id: String(j), label: j === laufend ? `${j} · jetzt` : String(j) }))} aktiv={String(planJahr)} onWahl={j => setPlanJahr(Number(j))} />
          {jahre[jahre.length - 1] < laufend + 5 && (
            <Knopf leise titel="Ein weiteres Jahr planen" onClick={() => { const n = jahre[jahre.length - 1] + 1; setExtraJahre(e => [...e, n]); setPlanJahr(n); }}>+ {jahre[jahre.length - 1] + 1}</Knopf>
          )}
        </div>
      )}

      {/* Fokus dieses Horizonts — die eine Richtung, gegen die geplant wird */}
      <Karte i={0} akzent={farbe}>
        <Ueberschrift farbe={farbe} rechts="Sichtbar im Wochenplaner und in der Tagesplanung — ZOE plant dagegen.">{fokusTitel}</Ueberschrift>
        <input value={fokus} onChange={e => fokusSetzen(e.target.value)} aria-label={fokusTitel}
          placeholder={horizont === 'monat' ? 'z. B. Gesundheit stabilisieren + F&F-Kunden onboarden' : 'Woran richtet sich alles aus?'}
          style={{ ...feld, fontWeight: 600 }} />
      </Karte>

      {/* Zeitstrahl — der Zeitraum als Linie: Heute-Anker, Meilensteine, Fälligkeiten. Im Jahr: Fenster zum Blättern, Anlegen per Klick. */}
      {istJahr ? (jahrSicht === 'seil' ? (
        // Seil (07.10., Kevin: „Am Ende müssen sie irgendwo alle ineinander greifen, wie ein Kabel oder ein Seil“): Stränge je Ziel,
        // Abhängigkeiten, Fokus mit kritischem Pfad — LICHTFAEDEN.md › Seil. Die Lichtfäden bleiben als „Alle Stränge“ (Last über alles).
        <Seil ebene="jahr" bereich={spaceFilter} fenster={fensterJahr} titel="Ziele als Seil" i={1} kopfRechts={sichtWahl}
          aktion={<Knopf onClick={() => msFenster.oeffneNeu(vorgabe())}>+ Meilenstein</Knopf>} />
      ) : (
        <Lichtfaeden wurzel={spaceFilter === 'alle' ? 'gesamt' : `space:${spaceFilter}`} fenster={fensterJahr} titel="Lichtfäden" i={1}
          onTag={tag => msFenster.oeffneNeu(vorgabe(tag))} kopfRechts={sichtWahl}
          aktion={<Knopf onClick={() => msFenster.oeffneNeu(vorgabe())}>+ Meilenstein</Knopf>} />
      )) : (
        <Zeitstrahl von={zr.von} bis={zr.bis} ticks={ticks} marker={strahlMarker} />
      )}
      {istJahr && spaceFilter !== 'privat' && kapa.stand && (
        <div style={{ display: 'grid', gap: 4, margin: '-6px 4px 0' }}>
          <LastBand stand={kapa.stand} von={fensterJahr.fenster.von} bis={fensterJahr.fenster.bis} hoehe={22} />
          <Link href={WEG.kapazitaet()} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none', justifySelf: 'start' }}>Kapazität je Person ›</Link>
        </div>
      )}

      {/* Überblick „Für dich“ (04.10. abends): Ist der letzten 3 Monate → heute → Prognose aus echten Daten; serverseitig gefiltert (FlussKarte, /api/fluss). */}
      <FlussKarte bereich="planung" space={spaceFilter === 'alle' ? null : spaceFilter} farbe={LEUCHT.planung} i={2} />

      {/* Forecast — Zeit vs. Fortschritt, deterministisch; im Jahr je Planungsjahr */}
      {hatForecast && (
        <Karte i={kForecast}>
          {lage.art === 'zukunft' ? (
            <>
              <Ueberschrift farbe={LEUCHT.puls}>Forecast · {planJahr}</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                <Zahl wert={String(lage.monate >= 1 ? lage.monate : lage.tage)} label={lage.monate >= 1 ? (lage.monate === 1 ? 'Monat bis zum Start' : 'Monate bis zum Start') : (lage.tage === 1 ? 'Tag bis zum Start' : 'Tage bis zum Start')} farbe={LEUCHT.puls} />
                <Zahl wert={String(zieleImSpace.length)} label={zieleImSpace.length === 1 ? 'Ziel geplant' : 'Ziele geplant'} />
                <Zahl wert={String(msImJahr.length)} label={msImJahr.length === 1 ? 'Meilenstein geplant' : 'Meilensteine geplant'} />
              </div>
              <p style={{ fontSize: TYP.body, fontWeight: 600, color: C.inkDim, margin: '14px 0 0' }}>
                → {planJahr} {beginntText(lage)} — jetzt planen, dann gilt ab Januar der Forecast gegen die Zeit.
              </p>
            </>
          ) : lage.art === 'vorbei' ? (
            <>
              <Ueberschrift farbe={col(schnitt ?? 0)}>Ergebnis · {planJahr}</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                <Zahl wert="100" label="% der Zeit vorbei" />
                <Zahl wert={String(schnitt)} label="% Ziele erreicht (Ø)" farbe={col(schnitt ?? 0)} />
              </div>
            </>
          ) : (
            <>
              <Ueberschrift farbe={prognoseFarbe}>Forecast{istJahr ? ` · ${planJahr}` : ''}</Ueberschrift>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                <Zahl wert={String(lage.verstrichen)} label="% der Zeit vorbei" />
                <Zahl wert={String(schnitt)} label="% Ziele im Schnitt" farbe={col(schnitt ?? 0)} />
                <Zahl wert={String(prognose)} label="% am Ende bei diesem Tempo" farbe={prognoseFarbe} />
              </div>
              <p style={{ fontSize: TYP.body, fontWeight: 600, color: prognoseFarbe, margin: '14px 0 0' }}>
                → bei diesem Tempo ~{prognose} % am Ende{(prognose ?? 0) < 95 ? ' — nachschärfen oder Ziel ehrlich kürzen' : ' — Kurs hält'}
              </p>
            </>
          )}
        </Karte>
      )}

      {/* Jahr: der Nordstern ist Business — im Privat-Space steht er nicht (26.09.). Seit 08.10. abends gemeinsames, pflegbares Ziel
          des Haushalts (Daten statt Konstante, /api/planung/nordstern) — die Karte lädt, zeigt den Leerzustand und bearbeitet selbst. */}
      {hatNordstern && (
        <NordsternKarte i={kNordstern}
          rechts={<Link href={spaceFilter === 'business' ? '/os/finanzen?s=business' : '/os/gesundheit?s=index'} style={{ color: C.inkLeise, textDecoration: 'none' }}>{spaceFilter === 'business' ? 'Meilensteine zählen im Business-Index ›' : 'Meilensteine zählen in den Indizes ›'}</Link>} />
      )}

      {/* Ziele links, Meilensteine rechts — Priorität per Pfeil, Erledigtes unten, Einheiten im Business, Kaskade aus dem Jahr */}
      <ZieleMeilensteine horizont={horizont} farbe={farbe} spaceFilter={spaceFilter} onSpace={setSpaceFilter} zielM={zielM} i={kZM}
        planung={p} planJahr={planJahr} einheitFilter={einheitFilter} onEinheit={setEinheitFilter} rueckgaengig={rueck}
        onMsOeffnen={istJahr ? msFenster.oeffne : undefined} />
      {msFenster.fenster}
      {rueck.hinweis}

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
