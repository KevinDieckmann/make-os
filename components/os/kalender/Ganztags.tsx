'use client';

// ─── Kalender: Ganztags-Bereich als Bahnen (10.10.) ──────────────────────────────────────────────────────────────────────────────
// Kevin 10.10. (Bildschirm Woche, Business): „Die Ganztags-Zeile zeigt dieselben mehrtägigen Aufgaben an JEDEM Tag einzeln (abgeschnitten,
// ‚+3 mehr‘) und frisst die Höhe — vom Zeitraster bleiben 2–3 Stunden.“ Jetzt wie Google: ein mehrtägiger Termin bzw. eine Aufgabe vom Start
// bis zur Deadline ist EIN durchgehender Balken über die Tage; höchstens zwei Bahnen sichtbar, darunter „+n“ je Tag — ein Klick klappt alles
// auf (dann rollt der Bereich in sich), „weniger“ klappt zu. Läuft ein Eintrag über den sichtbaren Zeitraum hinaus, zeigt der Rand ‹ bzw. ›.
// Lage rein in lib/kalender/layout.ts (`ganztagsLegen`, `ganztagsSicht`), Tage einer Aufgabe in lib/kalender/aufgaben.ts (`ganztagsSpanne`).
// Verhalten wie bisher: Termin antippen öffnet ihn, Frist ist ein Link, Aufgabe: Haken erledigt, Titel öffnet, ziehen auf einen Tag = neue
// Deadline ohne Uhrzeit (ins Raster darunter = mit Uhrzeit), ganztägig abwesend schraffiert den Tag.

import { useMemo, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT } from '../ui';
import { ART_FARBE } from '@/types/planer';
import { ART_INFO } from '@/lib/kalender/arten';
import { tagPlus } from '@/lib/kalender/zeit';
import { ganztagsLegen, ganztagsSicht, type GanztagsEintrag, type GanztagsPlatz } from '@/lib/kalender/layout';
import { ganztagsSpanne, type KalenderAufgabe } from '@/lib/kalender/aufgaben';
import { BLOCK_HEX } from '@/lib/kalender/darstellung';
import { FRIST_ZEICHEN, istGoogleTermin, type KTermin, type KFrist, type KErinnerung } from './teile';
import { aufgabeZiehStart, aufgabeAusZiehen, ziehtAufgabe } from './aufgaben';

/** Höhe einer Bahn (px) und Abstand dazwischen. */
export const BAHN_HOEHE = 24;
const BAHN_LUECKE = 2;
const SCHRAFFUR = `repeating-linear-gradient(135deg, ${LEUCHT.kritisch}2e 0 6px, transparent 6px 12px)`;

type Eintrag =
  | { art: 'termin'; t: KTermin }
  | { art: 'frist'; f: KFrist }
  | { art: 'aufgabe'; a: KalenderAufgabe }
  | { art: 'erinnerung'; e: KErinnerung };

/** Letzter Tag eines ganztägigen Termins (das Ende ist ausschließlich: 10.10.–11.10. = nur der 10.). */
const ganztagsBis = (t: KTermin): string => { const e = tagPlus(t.ende.slice(0, 10), -1); const s = t.start.slice(0, 10); return e < s ? s : e; };

export function Ganztags({ tage, kopfBreite, termine, fristen, erinnerungen, aufgaben, farbe, onTermin, onAufgabeHaken, onAufgabeOeffnen, onAufgabeAblegen }: {
  tage: readonly string[]; kopfBreite: number;
  /** Ganztägige Termine (ohne Arbeitsort). */
  termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[];
  /** Aufgaben (leer, wenn „Aufgaben ohne Uhrzeit anzeigen“ aus ist). */
  aufgaben: KalenderAufgabe[];
  farbe: (t: KTermin) => string;
  onTermin: (t: KTermin) => void;
  onAufgabeHaken: (id: string) => void;
  /** Klick auf den Titel öffnet; ohne: der Klick auf die Pille hakt ab. */
  onAufgabeOeffnen?: (id: string) => void;
  /** Aufgabe hierher gezogen: neue Deadline ohne Uhrzeit. Ohne: nicht ziehbar. */
  onAufgabeAblegen?: (id: string, tag: string) => void;
}) {
  const [auf, setAuf] = useState(false);
  const flaeche = useRef<HTMLDivElement>(null);
  const { liste, lage } = useMemo(() => {
    const liste = new Map<string, Eintrag>();
    const ein: GanztagsEintrag[] = [];
    for (const t of termine) { const id = `t:${t.id}`; liste.set(id, { art: 'termin', t }); ein.push({ id, von: t.start.slice(0, 10), bis: ganztagsBis(t), rang: 0 }); }
    for (const f of fristen) { const id = `f:${f.id}`; liste.set(id, { art: 'frist', f }); ein.push({ id, von: f.tag, bis: f.tag, rang: 1 }); }
    for (const a of aufgaben) { const s = ganztagsSpanne(a); if (!s) continue; const id = `a:${a.id}`; liste.set(id, { art: 'aufgabe', a }); ein.push({ id, ...s, rang: 2 }); }
    for (const e of erinnerungen) { const id = `e:${e.id}`; liste.set(id, { art: 'erinnerung', e }); ein.push({ id, von: e.tag, bis: e.tag, rang: 3 }); }
    return { liste, lage: ganztagsLegen(ein, tage) };
  }, [termine, fristen, aufgaben, erinnerungen, tage]);
  const sicht = ganztagsSicht(lage, tage.length, auf);
  const mitMehr = sicht.mehr.some(n => n > 0);
  const zeilen = Math.max(1, sicht.zeilen + (mitMehr ? 1 : 0));
  // Ganztägig abwesend: der ganze Tag schraffiert (auch im Raster darunter).
  const abwesend = useMemo(() => new Set(tage.filter(tag => termine.some(t => t.art === 'abwesend' && t.start.slice(0, 10) <= tag && t.ende.slice(0, 10) > tag))), [tage, termine]);

  const spalteAus = (x: number) => { const r = flaeche.current?.getBoundingClientRect(); if (!r || !tage.length) return 0; return Math.max(0, Math.min(tage.length - 1, Math.floor(((x - r.left) / r.width) * tage.length))); };
  const ueber = (e: DragEvent<HTMLDivElement>) => { if (onAufgabeAblegen && ziehtAufgabe(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } };
  const ab = (e: DragEvent<HTMLDivElement>) => { const id = aufgabeAusZiehen(e); if (!id || !onAufgabeAblegen) return; e.preventDefault(); onAufgabeAblegen(id, tage[spalteAus(e.clientX)]); };

  const balken = (p: GanztagsPlatz) => {
    const x = liste.get(p.id); if (!x) return null;
    const rand = { borderTopLeftRadius: p.linksOffen ? 0 : 6, borderBottomLeftRadius: p.linksOffen ? 0 : 6, borderTopRightRadius: p.rechtsOffen ? 0 : 6, borderBottomRightRadius: p.rechtsOffen ? 0 : 6 };
    const ort: React.CSSProperties = { gridColumn: `${p.a + 1} / ${p.b + 2}`, gridRow: p.bahn + 1, margin: `0 ${p.rechtsOffen ? 0 : 3}px 0 ${p.linksOffen ? 0 : 3}px`, zIndex: 1, minWidth: 0, height: BAHN_HOEHE, boxSizing: 'border-box' };
    const pille = (f: string): React.CSSProperties => ({ ...ort, ...rand, display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', background: `${f}${BLOCK_HEX}`, borderLeft: p.linksOffen ? 'none' : `3px solid ${f}`,
      color: C.ink, fontSize: TYP.bedien, fontWeight: 600, lineHeight: `${BAHN_HOEHE}px`, fontFamily: SCHRIFT.text, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', textDecoration: 'none' });
    const kante = (inhalt: React.ReactNode) => <>{p.linksOffen && <span aria-hidden style={{ color: C.inkDim }}>‹</span>}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{inhalt}</span>{p.rechtsOffen && <span aria-hidden style={{ color: C.inkDim }}>›</span>}</>;
    if (x.art === 'termin') {
      const t = x.t;
      const f = t.art === 'abwesend' ? LEUCHT.kritisch : (t as { farbe?: string }).farbe ?? farbe(t);
      const hinweis = (t as { hinweis?: string }).hinweis;
      const titel = `${t.art && t.art !== 'termin' ? `${ART_INFO[t.art].label}: ` : ''}${t.titel} · ${t.kalender}${hinweis ? ` — ${hinweis}` : t.bearbeitbar ? '' : ` (nur in ${istGoogleTermin(t) ? 'Google' : 'Apple'} änderbar)`}`;
      return (
        <button key={p.id} type="button" data-ganztags-eintrag={p.id} onClick={() => onTermin(t)} title={titel} className="fassbar ui-kein-ziel" style={{ ...pille(f), background: t.art === 'abwesend' ? SCHRAFFUR : pille(f).background }}>
          {kante(<>{t.art === 'abwesend' && <span aria-hidden>⊘ </span>}{t.sichtbarkeit === 'privat' && <span aria-hidden>🔒 </span>}{t.titel}</>)}
        </button>
      );
    }
    if (x.art === 'frist') {
      const f = x.f; const z = FRIST_ZEICHEN[f.art];
      return (
        <Link key={p.id} href={f.href} data-ganztags-eintrag={p.id} title={`${z.label}: ${f.titel}${f.unter ? ` · ${f.unter}` : ''}`} className="ui-kein-ziel" style={{ ...pille(z.farbe), textDecoration: f.erledigt ? 'line-through' : 'none' }}>
          {kante(<><span aria-hidden style={{ color: z.farbe }}>{z.zeichen} </span>{f.titel}</>)}
        </Link>
      );
    }
    if (x.art === 'erinnerung') {
      const e = x.e;
      return (
        <div key={p.id} data-ganztags-eintrag={p.id} title={`Erinnerung${e.liste ? ` (${e.liste})` : ''}: ${e.titel}`} style={{ ...pille(LEUCHT.schlaf), cursor: 'default' }}>
          {kante(<><span aria-hidden style={{ color: LEUCHT.schlaf }}>◷ </span>{e.zeit ? `${e.zeit} ` : ''}{e.titel}</>)}
        </div>
      );
    }
    const a = x.a;
    const f = ART_FARBE.aufgabe;
    const titel = `Aufgabe${a.eltern ? ` (Unteraufgabe von „${a.eltern}“)` : ''}: ${a.title}${a.start ? ` · Start ${a.start.slice(8, 10)}.${a.start.slice(5, 7)}. → Deadline ${a.tag.slice(8, 10)}.${a.tag.slice(5, 7)}.${a.zeit ? ` ${a.zeit}` : ''}` : ''}${onAufgabeAblegen ? ' · ziehen verschiebt die Deadline' : ''}`;
    const inhalt = <>{a.eltern ? <span aria-label="Unteraufgabe">↳ </span> : null}{a.priority === 'critical' ? '‼ ' : ''}{a.wiederkehrend ? <span aria-label="wiederkehrend">↻ </span> : null}{a.title}</>;
    if (!onAufgabeOeffnen) return <button key={p.id} type="button" data-ganztags-eintrag={p.id} onClick={() => onAufgabeHaken(a.id)} title={titel} className="fassbar ui-kein-ziel" style={pille(f)}>{kante(inhalt)}</button>;
    return (
      <div key={p.id} data-ganztags-eintrag={p.id} data-aufgabe={a.id} draggable={!!onAufgabeAblegen} onDragStart={e => aufgabeZiehStart(e, a.id)} title={titel} style={{ ...pille(f), cursor: onAufgabeAblegen ? 'grab' : 'default' }}>
        {!p.linksOffen && <button type="button" className="ui-kein-ziel" onClick={() => onAufgabeHaken(a.id)} aria-label={`„${a.title}“ als erledigt markieren`} title="Abhaken"
          style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${f}`, flex: '0 0 auto', background: 'transparent', padding: 0, cursor: 'pointer' }} />}
        <button type="button" onClick={() => onAufgabeOeffnen(a.id)} className="fassbar ui-kein-ziel"
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {kante(inhalt)}
        </button>
      </div>
    );
  };

  return (
    <div data-ganztags-bereich="" style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px minmax(0, 1fr)`, borderBottom: '1px solid rgba(255,255,255,.07)', maxHeight: auf ? `min(40vh, ${8 * (BAHN_HOEHE + BAHN_LUECKE) + 10}px)` : undefined, overflowY: auf ? 'auto' : 'hidden', scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '4px 4px 0 0' }}>
        {sicht.klappbar ? (
          <button type="button" className="fassbar ui-kein-ziel" onClick={() => setAuf(a => !a)} aria-expanded={auf} aria-label={auf ? 'Ganztägiges zuklappen' : 'Alles Ganztägige zeigen'} title={auf ? 'weniger zeigen' : 'alles zeigen'}
            style={{ minWidth: 36, height: BAHN_HOEHE, border: 'none', borderRadius: 7, background: 'rgba(255,255,255,.06)', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', padding: '0 6px' }}>{auf ? '▴' : '▾'}</button>
        ) : <span aria-hidden title="ganztägig" style={{ fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, lineHeight: `${BAHN_HOEHE}px` }}>ganzt.</span>}
      </div>
      <div ref={flaeche} onDragOver={ueber} onDrop={ab}
        style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${tage.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${zeilen}, ${BAHN_HOEHE}px)`, rowGap: BAHN_LUECKE, padding: '3px 0', minWidth: 0 }}>
        {tage.map((tag, i) => <div key={tag} data-ganztags={tag} aria-hidden style={{ gridColumn: i + 1, gridRow: `1 / span ${zeilen}`, margin: '-3px 0', borderLeft: '1px solid rgba(255,255,255,.05)', background: abwesend.has(tag) ? SCHRAFFUR : undefined }} />)}
        {sicht.sichtbar.map(balken)}
        {mitMehr && tage.map((tag, i) => sicht.mehr[i] > 0 && (
          <button key={`mehr-${tag}`} type="button" className="fassbar ui-kein-ziel" onClick={() => setAuf(true)} aria-label={`${sicht.mehr[i]} weitere ganztägige Einträge am ${Number(tag.slice(8, 10))}. zeigen`}
            style={{ gridColumn: i + 1, gridRow: zeilen, zIndex: 1, justifySelf: 'start', margin: '0 3px', height: BAHN_HOEHE, border: 'none', borderRadius: 6, background: 'transparent', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer', padding: '0 6px' }}>+{sicht.mehr[i]}</button>
        ))}
      </div>
    </div>
  );
}
