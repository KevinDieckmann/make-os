'use client';

// ─── Lichtfäden v2 — die Karte für jede Ebene (03.10.2026) ──────────────────
// Kevin: „Alle Stränge sollen nachher darein laufen … Es gibt es auf jeder Ebene und nachher übergreifend für alles, dann
// laufen nur andere Fäden ineinander.“ EINE Komponente für Planung Jahr (Wurzel Space bzw. Gesamt), Ziel-Seite (Wurzel
// Ziel), Meilenstein-Seite (Wurzel Meilenstein) und die Fokus-Sicht (Wurzel Gesamt):
//   Kopf      Brotkrumen (zurück = Fäden fließen zusammen) · Person (Ich · Partner/in · Beide)
//   Zeitraum  wie die Planung (Dieses Jahr · Bis Ende nächsten Jahres · 18 Monate), Blättern, Heute, optionale Aktion
//   Band      Faedenband (Tippen auf ein Bündel = eine Ebene tiefer, Fäden fächern animiert auf)
//   Legende   je Bündel ein Knopf „eine Ebene tiefer“ (barrierefreier Weg), Engstellen als Liste, Textäquivalent.
// Daten: GET /api/lichtfaeden (Haushalts-Tor, Privat-Regel serverseitig). Logik rein in lib/lichtfaeden/*.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, LICHT_GLAS, SCHRIFT, TYP } from '@/lib/make-one/design';
import { STRAHL_RAEUME, type StrahlRaum } from '@/lib/planung/zeitstrahl';
import { navStart, springe, tiefer, zurueck, type NavStand } from '@/lib/lichtfaeden/navigation';
import type { Buendel } from '@/lib/lichtfaeden/baum';
import { Karte, Segmente, Knopf, Hinweis, Leerzustand, Ueberschrift } from '../ui';
import { useStrahlFenster, type StrahlFenster } from '../planung/useStrahlFenster';
import { Faedenband, type FaedenUebergang } from './Faedenband';
import { Brotkrumen } from './Brotkrumen';
import { Legende } from './Legende';
import { Engstellen } from './Engstellen';
import { useLichtfaeden } from './useLichtfaeden';

export interface LichtfaedenProps {
  /** Startebene (Knoten-Kennung): „gesamt“, „space:privat“, „ziel:<id>“, „ms:<id>“ … */
  wurzel: string;
  /** Höchste Brotkrume (Ziel-Seite: das Ziel selbst) — Standard „gesamt“. */
  oben?: string;
  /** Wessen Stränge zuerst: die eigenen oder alle. */
  person?: 'ich' | 'alle';
  /** Zeitfenster von außen (Planung Jahr teilt es mit dem Planungsjahr); sonst ein eigenes. */
  fenster?: StrahlFenster;
  /** Klick auf eine freie Stelle → Tag (Meilenstein anlegen). */
  onTag?: (tag: string) => void;
  /** Aktion rechts neben dem Zeitraum (z. B. „+ Meilenstein“). */
  aktion?: ReactNode;
  titel?: string;
  i?: number;
}

const tag = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Lichtfaeden({ wurzel, oben, person: personStart = 'alle', fenster: fensterAussen, onTag, aktion, titel = 'Lichtfäden', i = 0 }: LichtfaedenProps) {
  const eigenesFenster = useStrahlFenster(new Date().getFullYear());
  const fenster = fensterAussen ?? eigenesFenster;
  const [nav, setNav] = useState<NavStand>(() => navStart(wurzel));
  useEffect(() => { setNav(springe(wurzel)); }, [wurzel]);
  const [person, setPerson] = useState<string>(personStart);
  const { daten, laedt, fehler, neu } = useLichtfaeden({ wurzel: nav.wurzel, person, von: fenster.fenster.von, bis: fenster.fenster.bis });
  const [hervor, setHervor] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const uebergang = useRef<FaedenUebergang | null>(null);
  const ansicht = daten?.ansicht ?? null;
  // Solange die neue Ebene lädt, bleibt die alte stehen; der Übergang gehört zur neuen (Faedenband wendet ihn dort an).
  const aktuell = ansicht;

  function wechsel(neuerStand: NavStand | null) {
    if (!neuerStand || !ansicht) return;
    uebergang.current = neuerStand.uebergang ? { richtung: neuerStand.uebergang.richtung, fokus: neuerStand.uebergang.fokus, vorher: ansicht.buendel, fuer: neuerStand.wurzel } : null;
    setHervor(null); setOffen(null);
    setNav(neuerStand);
  }
  const onTiefer = (b: Buendel) => wechsel(tiefer(nav, b));
  const onKrume = (id: string) => { if (ansicht) wechsel(zurueck(nav, id, ansicht.pfad)); };

  const personen = daten?.personen;
  const personWahl = useMemo(() => {
    if (!personen || personen.length < 2) return [];
    const andere = personen.filter(p => !p.ich);
    return [{ id: 'ich', label: 'Ich' }, ...andere.map(p => ({ id: p.id, label: p.name })), { id: 'alle', label: personen.length === 2 ? 'Beide' : 'Alle' }];
  }, [personen]);

  const heute = tag(new Date());
  return (
    <Karte i={i} className="licht-karte" style={{ background: LICHT_GLAS.karte }} ariaLabel={titel}>
      <Ueberschrift rechts={personWahl.length ? <Segmente liste={personWahl} aktiv={person} onWahl={setPerson} /> : undefined}>{titel}</Ueberschrift>
      <div style={{ display: 'grid', gap: 10 }}>
        {aktuell && <Brotkrumen pfad={aktuell.pfad} onWahl={onKrume} oben={oben} />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmente umbrechen liste={STRAHL_RAEUME.map(r => ({ id: r.id, label: r.label }))} aktiv={fenster.raum} onWahl={(r: StrahlRaum) => fenster.setRaum(r)} />
          <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{fenster.fenster.label}</span>
          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto' }}>
            <Knopf leise aus={fenster.heuteSichtbar} onClick={fenster.zuHeute}>Heute</Knopf>
            {aktion}
          </span>
        </div>
        {fehler && <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={neu}>Noch einmal versuchen</Knopf>}>{fehler}</Hinweis>}
        {aktuell ? (
          <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }} aria-busy={laedt}>
            <Pfeil richtung={-1} onBlaettern={fenster.blaettern} />
            <Faedenband ansicht={aktuell} engstellen={daten?.engstellen ?? []} uebergang={uebergang.current} hervor={hervor} onHervor={setHervor}
              onTiefer={onTiefer} onEngstelle={w => setOffen(o => (o === w ? null : w))} onTag={onTag} onBlaettern={fenster.blaettern} onBreite={fenster.setBreite}
              label={`Lichtfäden ${aktuell.pfad.map(k => k.name).join(' › ')}, ${fenster.fenster.label}`} />
            <Pfeil richtung={1} onBlaettern={fenster.blaettern} />
          </div>
        ) : !fehler && <div style={{ height: 220, borderRadius: 16, background: 'rgba(255,255,255,.02)' }} aria-busy="true" aria-label="Lichtfäden laden" />}
        {aktuell && !aktuell.buendel.length && !laedt && (
          <Leerzustand symbol="✦" titel="Hier läuft noch nichts zusammen">
            Im Zeitraum ist auf dieser Ebene nichts terminiert. Meilensteine, Termine, Fristen und Follow-ups erscheinen hier, sobald sie ein Datum haben.
          </Leerzustand>
        )}
        {aktuell && <Legende buendel={aktuell.buendel} hervor={hervor} onHervor={setHervor} onTiefer={onTiefer} />}
        {!!daten?.engstellen.length && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise }}>Engstellen ab {heute.slice(8, 10)}.{heute.slice(5, 7)}.</span>
            <Engstellen liste={daten.engstellen} offen={offen} onOffen={setOffen} />
          </div>
        )}
        {daten && <p className="nur-vorleser" aria-live="polite">{daten.text}</p>}
      </div>
    </Karte>
  );
}

/** Blättern um einen Monat (Umschalt: ein Quartal) — nur am Rechner; am Handy wischt man. */
function Pfeil({ richtung, onBlaettern }: { richtung: -1 | 1; onBlaettern: (n: number) => void }) {
  return (
    <span className="ui-nur-breit" style={{ alignSelf: 'center', flex: '0 0 auto' }}>
      <button type="button" onClick={e => onBlaettern(richtung * (e.shiftKey ? 3 : 1))} className="fassbar"
        aria-label={richtung < 0 ? 'Einen Monat zurück (Umschalt: ein Quartal)' : 'Einen Monat vor (Umschalt: ein Quartal)'} title={richtung < 0 ? 'Einen Monat zurück — Umschalt: ein Quartal · Tasten ← →' : 'Einen Monat vor — Umschalt: ein Quartal · Tasten ← →'}
        style={{ width: 32, height: 44, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.05)', color: C.inkDim, fontSize: 18, cursor: 'pointer', margin: richtung < 0 ? '0 8px 0 -6px' : '0 -6px 0 8px' }}>{richtung < 0 ? '‹' : '›'}</button>
    </span>
  );
}
