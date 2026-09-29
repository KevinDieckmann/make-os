'use client';

// ─── Kalender: Tages-/Wochenraster (27.09., K1 29.09.) ──────────────────────
// Wie Google Kalender: Stundenraster 0–24, Ganztags-Zeile oben, Termine als
// Blöcke (überlappende nebeneinander, lib/kalender/layout.ts), rote Jetzt-Linie,
// Anfassen verschiebt (auch auf einen anderen Tag), die untere Kante ändert die
// Dauer — alles im 15-Minuten-Raster. Was nur in Apple änderbar ist (Serie,
// Teilnehmer, fremder Kalender) zeigt 🔒 und lässt sich nicht ziehen.
// Seit 29.09. (K1): AUFZIEHEN in einer Lücke (Maus sofort, Touch nach kurzem Halten)
// zeigt „(Kein Titel) 4–5 Uhr“ und öffnet den Dialog vorbelegt; ein Klick legt wie
// bisher mit Standarddauer an. Arbeitsort als Leiste über den Tagen (je Person, wie
// Googles „Home“), Abwesend rot schraffiert (ganztägig über die ganze Spalte), Fokuszeit
// mit eigenem Stil, freie Termine hell, private der anderen Person als „Belegt“,
// Aufgaben mit Uhrzeit als Block an ihrer Zeit.
// Seit 30.09. (K3): Aufgaben abhaken (Haken), öffnen (Klick) und ZIEHEN — ins Raster = Deadline + Uhrzeit, in die
// Ganztags-Zeile = Deadline ohne Uhrzeit; auch aus der Seitenliste „Ohne Termin“. Start bis Deadline als Balken in der
// Ganztags-Zeile, Unteraufgaben mit „↳“. Regeln: lib/kalender/aufgaben.ts; Schreiben: components/os/kalender/aufgaben.tsx.
// Termine mit Gästen verschieben sich nicht per Ziehen (die Änderung ginge an die Gäste) — Klick öffnet sie.
// Seit 29.09. (R-K2, Kalender-Prüfliste):
//   · #92 Touch: ein Termin wird erst nach langem Drücken (350 ms) gezogen — sonst rollt der Finger die Liste; Tippen
//     öffnet. Nach dem Verschieben „Rückgängig“ (components/os/kalender/verschieben.tsx). Gilt auch für Blöcke (Planen).
//   · J-Zusatz: mehrtägige Termine mit Uhrzeit verschieben sich als DIFFERENZ auf Start und Ende (`verschiebeDifferenz`);
//     die Dauer ändert nur das letzte Segment (`endeAmTag`) — vorher wurden sie auf einen Tag gekürzt.
//   · #85 ab 4 Spalten „+n“ (Klick klappt den Tag auf) · #86 Markierung der doppelten/fehlenden Stunde (25.10./29.03.)
//   · #89 Klickfläche mindestens 24 px hoch.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE, type DragEvent } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';
import { spaltenLegen, ziehSpanne, spanneText, rasterLage, zeitumstellung, letzterTag, verschiebeDifferenz, endeAmTag, startMinute } from '@/lib/kalender/layout';
import { ART_INFO, ARBEITSORTE } from '@/lib/kalender/arten';
import { ART_FARBE } from '@/types/planer';
import { GanztagsZelle, WER_FARBE, WER_LABEL, istVorlaeufig, type KTermin, type KFrist, type KErinnerung, type Wer } from './teile';
import { ganztagsAm, mitZeitAm, zeitAusMinuten, type KalenderAufgabe } from '@/lib/kalender/aufgaben';
import { aufgabeZiehStart, aufgabeAusZiehen, ziehtAufgabe } from './aufgaben';
import { wandAus, wandzeit, minutenVon } from '@/lib/kalender/zeit';

export const PX_MIN = 0.9;
const RASTER = 15;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const minVon = (wand: string) => Number(wand.slice(11, 13)) * 60 + Number(wand.slice(14, 16));
const uhr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const SCHRAFFUR = `repeating-linear-gradient(135deg, ${LEUCHT.kritisch}2e 0 6px, transparent 6px 12px)`;
const LANGES_HALTEN_MS = 350;
/** Mindesthöhe eines Blocks im Raster (px, #89 — Klickfläche nach WCAG 2.5.8). */
export const MIN_HOEHE = 24;
const WD_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** „Sa 10:00“ — Vorschau beim Ziehen mehrtägiger Termine. */
const kurz = (wand: string) => `${WD_KURZ[new Date(`${wand.slice(0, 10)}T12:00:00Z`).getUTCDay()]} ${wand.slice(11, 16)}`;

/** Eine Aufgabe im Raster (= KalenderAufgabe, lib/kalender/aufgaben.ts). */
export type RasterAufgabe = KalenderAufgabe;
/** Nur ziehen, was sich still verschieben lässt: nicht mit Gästen (die Änderung ginge an sie — Klick öffnet mit Rückfrage). */
const ziehbar = (t: KTermin) => t.bearbeitbar && !t.mitTeilnehmern;
/** Läuft der Termin mit Uhrzeit über mehr als einen Tag des Rasters? */
const mehrtaegig = (t: KTermin) => !t.ganztags && letzterTag(t) > t.start.slice(0, 10);

/**
 * `aktiv` = der Termin hängt am Zeiger (Maus sofort, Touch erst nach langem Drücken). `dMin` = ungekappte senkrechte
 * Verschiebung (mehrtägige Termine rechnen damit als Differenz).
 */
interface Zieh { /** Termin.id (Kalender + UID, R-K1) */ id: string; art: 'move' | 'resize'; y0: number; x0: number; start: number; ende: number; tag: number; neuTag: number; neuStart: number; neuEnde: number; bewegt: boolean; aktiv: boolean; dMin: number; pointerId: number }
interface Aufzug { tag: number; a: number; b: number; y0: number; bewegt: boolean; pointerId: number; aktiv: boolean }

export function Zeitraster({ tage, heute, termine, fristen, erinnerungen, aufgaben, aufgabeDauer = 30, farbe, onOeffnen, onNeu, onVerschieben, onAufgabe, onAufgabeHaken, onAufgabeEinplanen, onArbeitsortNeu }: {
  tage: string[]; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[];
  aufgaben: RasterAufgabe[];
  aufgabeDauer?: number;
  farbe: (t: KTermin) => string;
  onOeffnen: (t: KTermin) => void;
  /** Klick (nur Start) oder Aufziehen (Start + Ende) in einer Lücke. */
  onNeu: (tag: string, startMin: number, endeMin?: number) => void;
  onVerschieben: (t: KTermin, tag: string, startMin: number, endeMin: number) => void;
  /** Klick auf eine Aufgabe: öffnen. */
  onAufgabe: (id: string) => void;
  /** Haken an einer Aufgabe (K3) — ohne: kein Haken. */
  onAufgabeHaken?: (id: string) => void;
  /** Aufgabe hierher gezogen (K3): Deadline `tag`, Uhrzeit `zeit` (null = Ganztags-Zeile). Ohne: nicht ziehbar. */
  onAufgabeEinplanen?: (id: string, tag: string, zeit: string | null) => void;
  /** Klick in eine leere Zelle der Arbeitsort-Leiste. */
  onArbeitsortNeu?: (tag: string, wer: Wer) => void;
}) {
  const spalten = useRef<HTMLDivElement | null>(null);
  const rollen = useRef<HTMLDivElement | null>(null);
  const [zieh, setZiehRoh] = useState<Zieh | null>(null);
  const ziehRef = useRef<Zieh | null>(null);
  const setZieh = (z: Zieh | null) => { ziehRef.current = z; setZiehRoh(z); };
  const ziehHalten = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Aufgeklappte Tage (#85: alle Spalten statt „+n“). */
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());
  const [aufzug, setAufzugRoh] = useState<Aufzug | null>(null);
  /** Wo eine gezogene Aufgabe landen würde (Vorschau-Linie). */
  const [ablage, setAblage] = useState<{ tag: number; min: number } | null>(null);
  const aufzugRef = useRef<Aufzug | null>(null);
  const halten = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setAufzug = (a: Aufzug | null) => { aufzugRef.current = a; setAufzugRoh(a); };
  // Jetzt-Linie in Berliner Wandzeit (R-K1 #7) — nicht in der Zone des Browsers (unterwegs in New York läge sie sonst falsch).
  // Erst im Browser setzen (sonst Hydration-Mismatch, wenn Server und Browser in verschiedenen Minuten zeichnen).
  const [jetztMin, setJetztMin] = useState<number | null>(null);
  useEffect(() => {
    const setzen = () => setJetztMin(minutenVon(wandzeit(new Date())));
    setzen();
    const t = setInterval(setzen, 60_000);
    return () => clearInterval(t);
  }, []);
  // Beim ersten Zeichnen auf 7 Uhr rollen (bzw. eine Stunde vor jetzt, wenn heute sichtbar ist).
  // Gesamtprüfung 29.09.: beim ersten Zeichnen ist die Liste oft noch nicht begrenzt (Spalten erst nach `useBreit`) — dann
  // lief `scrollTop` ins Leere und das Raster stand nach jedem Neuladen auf 0 Uhr. Deshalb: rollen, sobald die Liste
  // wirklich rollen kann (ResizeObserver), und nur einmal je Zeitraum (wer selbst gerollt hat, wird nicht zurückgeholt).
  const gerollt = useRef(false);
  const hinRollen = useRef(() => {});
  hinRollen.current = () => {
    const r = rollen.current; if (!r || gerollt.current || r.scrollHeight <= r.clientHeight) return;
    r.scrollTop = startMinute(tage, heute, minutenVon(wandzeit(new Date()))) * PX_MIN;
    gerollt.current = true;
  };
  useEffect(() => { gerollt.current = false; hinRollen.current(); }, [tage.length]);
  useEffect(() => {
    const r = rollen.current; if (!r || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => hinRollen.current());
    ro.observe(r);
    return () => ro.disconnect();
  }, []);
  // Touch: solange aufgezogen wird, darf die Liste nicht rollen (nicht-passiver Hörer — React-Hörer sind passiv).
  useEffect(() => {
    const r = rollen.current; if (!r) return;
    const bremse = (e: TouchEvent) => { if (aufzugRef.current?.aktiv || ziehRef.current?.aktiv) e.preventDefault(); };
    r.addEventListener('touchmove', bremse, { passive: false });
    return () => r.removeEventListener('touchmove', bremse);
  }, []);

  const jeTag = useMemo(() => tage.map(tag => {
    const mitZeit = termine.filter(t => !t.ganztags && t.art !== 'arbeitsort' && t.start.slice(0, 10) <= tag && t.ende.slice(0, 10) >= tag && (t.ende.slice(0, 10) > tag || minVon(t.ende) > 0));
    const aufgabenMitZeit = mitZeitAm(aufgaben, tag);
    const lagen = [
      ...mitZeit.map(t => ({ id: t.id, von: t.start.slice(0, 10) < tag ? 0 : minVon(t.start), bis: t.ende.slice(0, 10) > tag ? 24 * 60 : Math.max(minVon(t.ende), (t.start.slice(0, 10) < tag ? 0 : minVon(t.start)) + RASTER) })),
      ...aufgabenMitZeit.map(a => { const v = Number(a.zeit!.slice(0, 2)) * 60 + Number(a.zeit!.slice(3, 5)); return { id: `a:${a.id}`, von: v, bis: Math.min(24 * 60, v + aufgabeDauer) }; }),
    ];
    const gelegt = spaltenLegen(lagen);
    const plaetze = new Map(gelegt.map(p => [p.id, p]));
    const lagenMap = new Map(lagen.map(l => [l.id, l]));
    // #85: ab 4 Spalten nur die ersten und „+n“ — aufgeklappt alle.
    const { sicht, mehr } = rasterLage(gelegt, lagenMap, aufgeklappt.has(tag));
    // Aufgeklappt: „−“ oben an der ersten breiten Gruppe (sonst null).
    const breit = gelegt.filter(p => p.spalten > 3).map(p => lagenMap.get(p.id)?.von ?? 0);
    const wenigerVon = aufgeklappt.has(tag) && breit.length ? Math.min(...breit) : null;
    const ganztags = termine.filter(t => t.ganztags && t.art !== 'arbeitsort' && t.start.slice(0, 10) <= tag && t.ende.slice(0, 10) > tag);
    return { tag, mitZeit, aufgabenMitZeit, lagen: lagenMap, plaetze, sicht, mehr, wenigerVon, umstellung: zeitumstellung(tag),
      ganztags, abwesendGanz: ganztags.some(t => t.art === 'abwesend'),
      fristen: fristen.filter(f => f.tag === tag), erinnerungen: erinnerungen.filter(e => e.tag === tag), aufgaben: ganztagsAm(aufgaben, tag) };
  }), [tage, termine, fristen, erinnerungen, aufgaben, aufgabeDauer, aufgeklappt]);

  // Arbeitsort-Leiste: je Person eine Zeile (nur, wenn im Zeitraum eingetragen).
  const arbeitsorte = useMemo(() => {
    const zeilen = new Map<Wer, Map<string, KTermin>>();
    for (const t of termine.filter(x => x.art === 'arbeitsort')) {
      const wer: Wer = t.wer === 'beide' && (t.von === 'kevin' || t.von === 'malin') ? t.von : t.wer;
      const z = zeilen.get(wer) ?? new Map<string, KTermin>();
      for (const tag of tage) if (t.start.slice(0, 10) <= tag && (t.ende.slice(0, 10) > tag || (!t.ganztags && t.start.slice(0, 10) === tag))) z.set(tag, t);
      zeilen.set(wer, z);
    }
    return (['kevin', 'malin', 'beide'] as Wer[]).filter(w => zeilen.get(w)?.size).map(w => ({ wer: w, tage: zeilen.get(w)! }));
  }, [termine, tage]);

  const spalteAus = (clientX: number) => { const r = spalten.current?.getBoundingClientRect(); if (!r) return 0; return Math.max(0, Math.min(tage.length - 1, Math.floor(((clientX - r.left) / r.width) * tage.length))); };

  // ── Aufgaben ziehen (HTML5, eigener Datentyp) ──
  const aufgabeUeber = (e: DragEvent<HTMLDivElement>, ti: number) => {
    if (!onAufgabeEinplanen || !ziehtAufgabe(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const min = Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_MIN / RASTER) * RASTER;
    if (!ablage || ablage.tag !== ti || ablage.min !== min) setAblage({ tag: ti, min });
  };
  const aufgabeAb = (e: DragEvent<HTMLDivElement>, tag: string, mitZeit: boolean) => {
    const id = aufgabeAusZiehen(e);
    setAblage(null);
    if (!id || !onAufgabeEinplanen) return;
    e.preventDefault();
    onAufgabeEinplanen(id, tag, mitZeit ? zeitAusMinuten((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_MIN, RASTER) : null);
  };
  const ganztagsUeber = (e: DragEvent<HTMLDivElement>) => { if (onAufgabeEinplanen && ziehtAufgabe(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } };

  const haltenAus = () => { if (ziehHalten.current) clearTimeout(ziehHalten.current); ziehHalten.current = null; };
  const anfassen = (e: RPE<HTMLDivElement>, t: KTermin, tagIdx: number, art: Zieh['art']) => {
    e.stopPropagation();
    if (!ziehbar(t) || e.button !== 0) return;
    const l = jeTag[tagIdx].lagen.get(t.id)!;
    const el = e.currentTarget as HTMLElement, pid = e.pointerId;
    const z: Zieh = { id: t.id, art, y0: e.clientY, x0: e.clientX, start: l.von, ende: l.bis, tag: tagIdx, neuTag: tagIdx, neuStart: l.von, neuEnde: l.bis, bewegt: false, aktiv: e.pointerType !== 'touch', dMin: 0, pointerId: pid };
    haltenAus();
    if (e.pointerType === 'touch') {
      // #92: am Handy erst nach langem Drücken — ein Finger, der die Liste rollt, verschiebt nie einen Termin.
      setZieh(z);
      ziehHalten.current = setTimeout(() => {
        const jetzt = ziehRef.current;
        if (!jetzt || jetzt.id !== t.id || jetzt.bewegt) return;
        try { el.setPointerCapture(pid); } catch { /* Finger schon weg */ }
        try { navigator.vibrate?.(10); } catch { /* ohne Vibration */ }
        setZieh({ ...jetzt, aktiv: true });
      }, LANGES_HALTEN_MS);
      return;
    }
    el.setPointerCapture(pid);
    setZieh(z);
  };
  const bewegen = (e: RPE<HTMLDivElement>) => {
    const zieh = ziehRef.current;
    if (!zieh || zieh.pointerId !== e.pointerId) return;
    if (!zieh.aktiv) {
      // Vor dem langen Drücken: Bewegung = rollen → loslassen.
      if (Math.abs(e.clientY - zieh.y0) > 8 || Math.abs(e.clientX - zieh.x0) > 8) { haltenAus(); setZieh(null); }
      return;
    }
    const dMin = Math.round((e.clientY - zieh.y0) / PX_MIN / RASTER) * RASTER;
    const bewegt = zieh.bewegt || Math.abs(e.clientY - zieh.y0) > 4 || Math.abs(e.clientX - zieh.x0) > 8;
    if (zieh.art === 'move') {
      const dauer = zieh.ende - zieh.start;
      const neuStart = Math.max(0, Math.min(24 * 60 - dauer, zieh.start + dMin));
      setZieh({ ...zieh, bewegt, dMin, neuTag: spalteAus(e.clientX), neuStart, neuEnde: neuStart + dauer });
    } else setZieh({ ...zieh, bewegt, dMin, neuEnde: Math.max(zieh.start + RASTER, Math.min(24 * 60, zieh.ende + dMin)) });
  };
  const loslassen = (t: KTermin) => {
    const z = ziehRef.current;
    haltenAus();
    if (!z) return;
    setZieh(null);
    if (!z.bewegt) { onOeffnen(t); return; }
    if (!z.aktiv) return;
    if (mehrtaegig(t)) {
      // J-Zusatz: Differenz auf Start UND Ende (die Dauer bleibt) bzw. neues Ende am letzten Segment.
      const r = z.art === 'move' ? verschiebeDifferenz(t, z.neuTag - z.tag, z.dMin) : endeAmTag(t, tage[z.tag], z.neuEnde);
      if (wandAus(r.tag, r.startMin) === t.start && wandAus(r.tag, r.endeMin) === t.ende) return;
      onVerschieben(t, r.tag, r.startMin, r.endeMin);
      return;
    }
    if (z.neuTag === z.tag && z.neuStart === z.start && z.neuEnde === z.ende) return;
    onVerschieben(t, tage[z.neuTag], z.neuStart, z.neuEnde);
  };
  const ziehAbbruch = () => { haltenAus(); setZieh(null); };
  /** Vorschau beim Ziehen eines mehrtägigen Termins: neuer Start → neues Ende. */
  const mehrtaegigVorschau = (t: KTermin, z: Zieh): string => {
    const r = z.art === 'move' ? verschiebeDifferenz(t, z.neuTag - z.tag, z.dMin) : endeAmTag(t, tage[z.tag], z.neuEnde);
    return `${kurz(wandAus(r.tag, r.startMin))} → ${kurz(wandAus(r.tag, r.endeMin))}`;
  };

  // ── Aufziehen in einer Lücke ──
  const minuteIn = (e: { clientY: number }, el: HTMLElement) => (e.clientY - el.getBoundingClientRect().top) / PX_MIN;
  const lueckeDruck = (e: RPE<HTMLDivElement>, ti: number) => {
    if (zieh || e.button !== 0) return;
    const el = e.currentTarget, m = minuteIn(e, el), pid = e.pointerId;
    const start: Aufzug = { tag: ti, a: m, b: m, y0: e.clientY, bewegt: false, pointerId: pid, aktiv: e.pointerType !== 'touch' };
    if (e.pointerType === 'touch') {
      // Touch: erst nach kurzem Halten — sonst rollt der Finger die Liste.
      setAufzug(start);
      if (halten.current) clearTimeout(halten.current);
      halten.current = setTimeout(() => { const a = aufzugRef.current; if (a && !a.bewegt) { try { el.setPointerCapture(pid); } catch { /* schon weg */ } setAufzug({ ...a, aktiv: true, b: a.a + 60 }); } }, LANGES_HALTEN_MS);
      return;
    }
    el.setPointerCapture(pid);
    setAufzug(start);
  };
  const lueckeZug = (e: RPE<HTMLDivElement>) => {
    const a = aufzugRef.current; if (!a || a.pointerId !== e.pointerId) return;
    const weit = Math.abs(e.clientY - a.y0) > 6;
    if (!a.aktiv) { if (weit) { if (halten.current) clearTimeout(halten.current); setAufzug(null); } return; }
    setAufzug({ ...a, b: minuteIn(e, e.currentTarget), bewegt: a.bewegt || weit });
  };
  const lueckeLos = (e: RPE<HTMLDivElement>) => {
    const a = aufzugRef.current; if (!a || a.pointerId !== e.pointerId) return;
    if (halten.current) clearTimeout(halten.current);
    setAufzug(null);
    const tag = tage[a.tag];
    if (a.aktiv && (a.bewegt || e.pointerType === 'touch')) { const s = ziehSpanne(a.a, a.b, RASTER); onNeu(tag, s.von, s.bis); return; }
    if (!a.bewegt) onNeu(tag, Math.max(0, Math.min(24 * 60 - RASTER, Math.floor(a.a / RASTER) * RASTER)));
  };
  const lueckeAbbruch = () => { if (halten.current) clearTimeout(halten.current); setAufzug(null); };

  const stunden = Array.from({ length: 24 }, (_, i) => i);
  const kopfBreite = 46;
  const vorschau = aufzug && aufzug.aktiv && (aufzug.bewegt || aufzug.b !== aufzug.a) ? { ...ziehSpanne(aufzug.a, aufzug.b, RASTER), tag: aufzug.tag } : null;
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', minHeight: 0, height: '100%', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,.015)' }}>
      {/* Tagesköpfe */}
      <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px repeat(${tage.length}, minmax(0, 1fr))`, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div />
        {tage.map(tag => { const d = new Date(`${tag}T12:00:00`); const h = tag === heute; return (
          <div key={tag} style={{ padding: '8px 6px 6px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: h ? LEUCHT.puls : C.inkLeise, fontWeight: 700 }}>{WD[d.getDay()]}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', marginTop: 2, fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, background: h ? LEUCHT.puls : 'transparent', color: h ? '#0b0b0c' : C.ink }}>{d.getDate()}</div>
          </div>
        ); })}
      </div>
      {/* Arbeitsort-Leiste (wie Googles „Home“) — je Person */}
      <div>
        {arbeitsorte.map(z => (
          <div key={z.wer} style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px repeat(${tage.length}, minmax(0, 1fr))`, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <div title={`Arbeitsort ${WER_LABEL[z.wer]}`} style={{ fontSize: 11, color: WER_FARBE[z.wer], padding: '4px 4px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{WER_LABEL[z.wer]}</div>
            {tage.map(tag => { const t = z.tage.get(tag); const ort = t?.arbeitsort ? ARBEITSORTE.find(a => a.id === t.arbeitsort!.art) : undefined; return (
              <div key={tag} style={{ borderLeft: '1px solid rgba(255,255,255,.05)', padding: '2px 4px', minWidth: 0 }}>
                {t ? (
                  <button type="button" onClick={() => onOeffnen(t)} title={`Arbeitsort ${WER_LABEL[z.wer]}: ${t.titel}`} className="fassbar"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minWidth: 0, border: 'none', background: 'transparent', color: C.inkDim, fontSize: 11.5, cursor: 'pointer', padding: '1px 2px', fontFamily: SCHRIFT.text }}>
                    <span aria-hidden>{ort?.zeichen ?? '•'}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                  </button>
                ) : onArbeitsortNeu && z.wer !== 'beide' ? (
                  <button type="button" onClick={() => onArbeitsortNeu(tag, z.wer)} aria-label={`Arbeitsort ${WER_LABEL[z.wer]} am ${tag} eintragen`} style={{ width: '100%', border: 'none', background: 'transparent', color: C.inkLeise, cursor: 'pointer', fontSize: 11, opacity: .5 }}>+</button>
                ) : null}
              </div>
            ); })}
          </div>
        ))}
      </div>
      {/* Ganztags-Zeile */}
      <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px repeat(${tage.length}, minmax(0, 1fr))`, borderBottom: '1px solid rgba(255,255,255,.07)', maxHeight: 132, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, color: C.inkLeise, padding: '6px 4px', textAlign: 'right' }}>ganzt.</div>
        {jeTag.map(t => (
          <div key={t.tag} data-ganztags={t.tag} onDragOver={ganztagsUeber} onDrop={e => aufgabeAb(e, t.tag, false)} style={{ padding: 4, borderLeft: '1px solid rgba(255,255,255,.05)', minWidth: 0, minHeight: 28, background: t.abwesendGanz ? SCHRAFFUR : undefined }}>
            <GanztagsZelle termine={t.ganztags} aufgaben={t.aufgaben} erinnerungen={t.erinnerungen} fristen={t.fristen} onTermin={onOeffnen}
              onAufgabeHaken={onAufgabeHaken ?? onAufgabe} onAufgabeOeffnen={onAufgabeHaken ? onAufgabe : undefined} aufgabenZiehbar={!!onAufgabeEinplanen} />
          </div>
        ))}
      </div>
      {/* Stundenraster */}
      <div ref={rollen} style={{ overflowY: 'auto', minHeight: 0, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${kopfBreite}px 1fr`, height: 24 * 60 * PX_MIN }}>
          <div style={{ position: 'relative' }}>
            {stunden.map(h => <div key={h} style={{ position: 'absolute', top: h * 60 * PX_MIN - 7, right: 6, fontSize: 11, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}
          </div>
          <div ref={spalten} style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${tage.length}, minmax(0, 1fr))` }}>
            {/* Stundenlinien */}
            {stunden.map(h => <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * 60 * PX_MIN, borderTop: `1px solid rgba(255,255,255,${h % 6 === 0 ? '.09' : '.05'})`, pointerEvents: 'none' }} />)}
            {jeTag.map((t, ti) => {
              const h = t.tag === heute;
              return (
                <div key={t.tag} data-spalte={t.tag} onPointerDown={e => lueckeDruck(e, ti)} onPointerMove={lueckeZug} onPointerUp={lueckeLos} onPointerCancel={lueckeAbbruch}
                  onDragOver={e => aufgabeUeber(e, ti)} onDragLeave={() => setAblage(a => (a?.tag === ti ? null : a))} onDrop={e => aufgabeAb(e, t.tag, true)}
                  style={{ position: 'relative', borderLeft: '1px solid rgba(255,255,255,.05)', background: t.abwesendGanz ? SCHRAFFUR : h ? 'rgba(255,255,255,.02)' : undefined, cursor: 'copy', touchAction: aufzug?.aktiv ? 'none' : 'pan-y', userSelect: 'none' }}>
                  {h && jetztMin != null && <div style={{ position: 'absolute', left: 0, right: 0, top: jetztMin * PX_MIN, borderTop: `2px solid ${LEUCHT.kritisch}`, zIndex: 3, pointerEvents: 'none' }}><span style={{ position: 'absolute', left: -5, top: -5, width: 8, height: 8, borderRadius: '50%', background: LEUCHT.kritisch }} /></div>}
                  {/* #86: Zeitumstellung — Ende Oktober gibt es 02:00–03:00 zweimal, Ende März gar nicht. */}
                  {t.umstellung && (
                    <div role="note" title={t.umstellung === 'doppelt' ? 'Zeitumstellung: 02:00–03:00 gibt es heute zweimal (erst Sommer-, dann Winterzeit). Termine in dieser Stunde können übereinander liegen.' : 'Zeitumstellung: 02:00–03:00 gibt es heute nicht (die Uhr springt von 2 auf 3 Uhr).'}
                      style={{ position: 'absolute', left: 0, right: 0, top: 120 * PX_MIN, height: 60 * PX_MIN, background: `repeating-linear-gradient(45deg, ${LEUCHT.achtung}1f 0 5px, transparent 5px 10px)`, borderTop: `1px dashed ${LEUCHT.achtung}88`, borderBottom: `1px dashed ${LEUCHT.achtung}88`, pointerEvents: 'none', zIndex: 1, fontSize: 11, color: LEUCHT.achtung, padding: '1px 4px', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: SCHRIFT.text }}>
                      {t.umstellung === 'doppelt' ? '2–3 Uhr doppelt' : '2–3 Uhr entfällt'}
                    </div>
                  )}
                  {/* #85: „+n“ je Gruppe mit mehr als 3 Spalten — Klick klappt den Tag auf (alle Spalten), „−“ wieder zu. */}
                  {t.mehr.map(m => (
                    <button key={`mehr-${m.gruppe}`} type="button" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setAufgeklappt(a => new Set(a).add(t.tag)); }}
                      aria-label={`${m.n} weitere Einträge zeigen`} title={`${m.n} weitere Einträge — aufklappen`}
                      style={{ position: 'absolute', top: m.von * PX_MIN, height: MIN_HOEHE, left: `calc(${(200 / 3).toFixed(4)}% + 2px)`, width: `calc(${(100 / 3).toFixed(4)}% - 4px)`, zIndex: 3, border: `1px solid rgba(255,255,255,.14)`, borderRadius: 7, background: C.flaecheHoch, color: C.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SCHRIFT.text, padding: 0 }}>+{m.n}</button>
                  ))}
                  {t.wenigerVon !== null && (
                    <button type="button" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setAufgeklappt(a => { const n = new Set(a); n.delete(t.tag); return n; }); }}
                      aria-label="Weniger Spalten zeigen" title="Wieder zusammenklappen"
                      style={{ position: 'absolute', top: Math.max(0, t.wenigerVon * PX_MIN - MIN_HOEHE - 2), right: 2, zIndex: 4, minWidth: MIN_HOEHE, height: MIN_HOEHE, border: `1px solid rgba(255,255,255,.14)`, borderRadius: 7, background: C.flaecheHoch, color: C.inkDim, fontSize: 13, cursor: 'pointer', padding: 0 }}>−</button>
                  )}
                  {t.mitZeit.map(ev => {
                    const l = t.lagen.get(ev.id)!; const s = t.sicht.get(ev.id);
                    if (!s) return null; // #85: steckt hinter „+n“
                    const z = zieh && zieh.aktiv && zieh.id === ev.id && zieh.tag === ti ? zieh : null;
                    const von = z ? z.neuStart : l.von, bis = z ? z.neuEnde : l.bis;
                    const versetzt = z && z.art === 'move' && z.neuTag !== ti;
                    const abwesend = ev.art === 'abwesend', fokus = ev.art === 'fokus', frei = ev.beschaeftigt === false;
                    const f = ev.maskiert ? C.inkLeise : abwesend ? LEUCHT.kritisch : farbe(ev);
                    const laeuftJetzt = fokus && h && jetztMin != null && jetztMin >= l.von && jetztMin < l.bis;
                    const darfZiehen = ziehbar(ev);
                    // J-Zusatz: die Dauer eines mehrtägigen Termins ändert nur sein letztes Segment.
                    const mehr = mehrtaegig(ev);
                    const darfDauer = darfZiehen && (!mehr || letzterTag(ev) === t.tag);
                    return (
                      <div key={ev.id} role="button" tabIndex={0} data-termin={ev.id} title={`${ev.art && ev.art !== 'termin' ? `${ART_INFO[ev.art].label}: ` : ''}${ev.titel} · ${mehr ? `${kurz(ev.start)} – ${kurz(ev.ende)}` : `${uhr(l.von)}–${uhr(l.bis)}`} · ${ev.kalender}${ev.bearbeitbar ? '' : ' (nur in Apple änderbar)'}`}
                        onPointerDown={e => anfassen(e, ev, ti, 'move')} onPointerMove={bewegen} onPointerUp={e => { e.stopPropagation(); loslassen(ev); }} onPointerCancel={ziehAbbruch}
                        onClick={e => { e.stopPropagation(); if (!darfZiehen) onOeffnen(ev); }} onKeyDown={e => { if (e.key === 'Enter') onOeffnen(ev); }}
                        style={{ position: 'absolute', top: von * PX_MIN, height: Math.max(MIN_HOEHE, (bis - von) * PX_MIN - 2), left: `calc(${s.links}% + 2px)`, width: `calc(${s.breite}% - 4px)`,
                          background: abwesend ? SCHRAFFUR : ev.maskiert ? 'rgba(255,255,255,.06)' : frei ? `${f}10` : `${f}${versetzt ? '33' : '2a'}`,
                          border: frei && !abwesend ? `1px dashed ${f}88` : undefined,
                          // Vorläufige Buchung (K4) gestrichelt, Fokuszeit doppelt, sonst durchgezogen.
                          borderLeft: `3px ${istVorlaeufig(ev) ? 'dashed' : fokus ? 'double' : 'solid'} ${f}`, borderRadius: 7, padding: '3px 6px', overflow: 'hidden', cursor: darfZiehen ? (z ? 'grabbing' : 'grab') : 'pointer',
                          // #92: rollen erlaubt, bis der Termin nach langem Drücken am Finger hängt.
                          boxShadow: z ? `0 8px 24px rgba(0,0,0,.4), 0 0 0 1px ${f}` : undefined, zIndex: z ? 5 : 2, opacity: versetzt ? .45 : 1, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: z ? 'none' : 'pan-y', fontFamily: SCHRIFT.text }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ev.maskiert ? C.inkDim : C.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {!ev.bearbeitbar && !ev.maskiert && <span aria-label="nur in Apple" style={{ marginRight: 4 }}>🔒</span>}
                          {ev.mitTeilnehmern && !ev.maskiert && <span aria-label="mit Gästen" title={ev.ichOrganisator ? 'Du hast eingeladen' : 'Du bist Gast'} style={{ marginRight: 4 }}>👥</span>}
                          {fokus && <span aria-hidden style={{ marginRight: 4, color: f }}>{laeuftJetzt ? '▶' : '◎'}</span>}
                          {abwesend && <span aria-hidden style={{ marginRight: 4, color: f }}>⊘</span>}
                          {ev.art === 'block' && <span aria-hidden style={{ marginRight: 4, color: f }}>▪</span>}
                          {ev.titel}
                        </div>
                        {z && mehr && z.bewegt && <div aria-live="polite" style={{ fontSize: 11, color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{mehrtaegigVorschau(ev, z)}</div>}
                        {(bis - von) * PX_MIN >= 30 && !(z && mehr) && <div style={{ fontSize: 11, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{mehr ? `${kurz(ev.start)} – ${kurz(ev.ende)}` : `${uhr(von)}–${uhr(bis)}`}{ev.ort ? ` · ${ev.ort}` : ''}{frei ? ' · frei' : ''}</div>}
                        {darfDauer && <div onPointerDown={e => anfassen(e, ev, ti, 'resize')} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, cursor: 'ns-resize' }} />}
                      </div>
                    );
                  })}
                  {/* Aufgaben mit Uhrzeit — dieselbe Aufgabe, an ihrer Zeit */}
                  {t.aufgabenMitZeit.map(a => {
                    const l = t.lagen.get(`a:${a.id}`)!; const s = t.sicht.get(`a:${a.id}`);
                    if (!s) return null; // #85: steckt hinter „+n“
                    return (
                      <div key={`a:${a.id}`} data-aufgabe={a.id} draggable={!!onAufgabeEinplanen} onDragStart={e => { e.stopPropagation(); aufgabeZiehStart(e, a.id); }} onDragEnd={() => setAblage(null)}
                        onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} title={`Aufgabe${a.eltern ? ` (Unteraufgabe von „${a.eltern}“)` : ''}: ${a.title} · ${a.zeit}${onAufgabeEinplanen ? ' — ziehen verschiebt' : ''}`}
                        style={{ position: 'absolute', top: l.von * PX_MIN, height: Math.max(MIN_HOEHE, (l.bis - l.von) * PX_MIN - 2), left: `calc(${s.links}% + 2px)`, width: `calc(${s.breite}% - 4px)`, zIndex: 2,
                          display: 'flex', alignItems: 'flex-start', gap: 5, textAlign: 'left', border: `1px solid ${ART_FARBE.aufgabe}66`, background: `${ART_FARBE.aufgabe}18`, borderRadius: 7, padding: '3px 6px', color: C.ink, fontSize: 12, fontWeight: 600, cursor: onAufgabeEinplanen ? 'grab' : 'pointer', overflow: 'hidden', fontFamily: SCHRIFT.text, textDecoration: a.done ? 'line-through' : 'none' }}>
                        {onAufgabeHaken
                          ? <button type="button" onClick={e => { e.stopPropagation(); onAufgabeHaken(a.id); }} aria-label={`„${a.title}“ als erledigt markieren`} title="Abhaken"
                            style={{ width: 13, height: 13, marginTop: 1, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, background: 'transparent', flex: '0 0 auto', padding: 0, cursor: 'pointer' }} />
                          : <span aria-hidden style={{ width: 10, height: 10, marginTop: 2, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, flex: '0 0 auto' }} />}
                        <button type="button" onClick={e => { e.stopPropagation(); onAufgabe(a.id); }} style={{ all: 'unset', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {a.eltern && <span aria-label="Unteraufgabe" style={{ color: C.inkLeise }}>↳ </span>}{a.zeit} {a.title}
                        </button>
                      </div>
                    );
                  })}
                  {/* Wohin eine gezogene Aufgabe fällt */}
                  {ablage && ablage.tag === ti && (
                    <div aria-hidden style={{ position: 'absolute', top: ablage.min * PX_MIN, left: 2, right: 2, height: Math.max(MIN_HOEHE, aufgabeDauer * PX_MIN - 2), borderRadius: 7, border: `2px dashed ${ART_FARBE.aufgabe}`, background: `${ART_FARBE.aufgabe}14`, pointerEvents: 'none', zIndex: 6, fontSize: 11, color: C.inkDim, padding: '2px 6px', fontFamily: SCHRIFT.text }}>{zeitAusMinuten(ablage.min, RASTER)}</div>
                  )}
                  {/* Vorschau beim Aufziehen: „(Kein Titel) 4–5 Uhr“ */}
                  {vorschau && vorschau.tag === ti && (
                    <div aria-live="polite" style={{ position: 'absolute', top: vorschau.von * PX_MIN, height: Math.max(MIN_HOEHE, (vorschau.bis - vorschau.von) * PX_MIN - 2), left: 2, right: 2, borderRadius: 7, background: `${LEUCHT.puls}40`, borderLeft: `3px solid ${LEUCHT.puls}`, pointerEvents: 'none', zIndex: 6, padding: '3px 6px', fontSize: 12, color: C.ink, fontFamily: SCHRIFT.text, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
                      <b>(Kein Titel)</b><div style={{ fontSize: 11, color: C.inkDim }}>{spanneText(vorschau.von, vorschau.bis)}</div>
                    </div>
                  )}
                  {/* Geist in der Zielspalte beim Verschieben auf einen anderen Tag */}
                  {zieh && zieh.aktiv && zieh.art === 'move' && zieh.neuTag === ti && zieh.tag !== ti && (
                    <div style={{ position: 'absolute', top: zieh.neuStart * PX_MIN, height: (zieh.neuEnde - zieh.neuStart) * PX_MIN - 2, left: 2, right: 2, borderRadius: 7, border: `2px dashed ${WER_FARBE.kevin}`, background: 'rgba(255,255,255,.06)', pointerEvents: 'none', zIndex: 4, fontSize: 11, color: C.inkDim, padding: '3px 6px' }}>{uhr(zieh.neuStart)}–{uhr(zieh.neuEnde)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.inkLeise, padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,.05)', fontFamily: SCHRIFT.text }}>Klick in eine Lücke legt an · aufziehen wählt die Zeit (am Handy kurz halten) · anfassen verschiebt · untere Kante ändert die Dauer · Aufgaben: Haken erledigt, ziehen plant ein · 🔒 nur in Apple änderbar · 👥 mit Gästen</div>
    </div>
  );
}
