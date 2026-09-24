'use client';

import Link from 'next/link';
// ─── MAKE OS — Wochenplaner (beweglich) ─────────────────────────────────────
// Kevins 5-Minuten-Morgenblick: feste Termine stehen unverrückbar im Raster,
// alles andere — Fokus, Reha, Routinen, Pausen, Aufgaben — ziehst du aus der
// Leiste in den Tag und schiebst es frei herum. Kein Gespräch nötig: gucken,
// schieben, fertig. Gespeichert wird von selbst.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Chips, Leuchtfarben).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ART_FARBE, type PlanBlock } from '@/types/planer';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { wochenplanSchreiben } from '@/lib/make-one/wochenplan-sync';
import { verteileSpuren, spurStil, titelStil } from '@/lib/make-one/spuren';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Fortschritt, Segmente, feld, LEUCHT } from './schlank';
// Routinen kommen aus dem Routine-Planer — nicht mehr aus der Konstante.

interface FixTermin { titel: string; date: string; startMin: number; dauerMin: number; quelle: string }

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Raster: 06:00–22:00, 1 Minute = 0.8px → Tag = 768px hoch, 15-Minuten-Raster.
const START = 6 * 60, ENDE = 22 * 60, PX = 0.8;
const H = (ENDE - START) * PX;

const BAUSTEINE: { art: PlanBlock['art']; titel: string; dauerMin: number }[] = [
  { art: 'fokus', titel: 'Fokus (Deep Work)', dauerMin: 90 },
  { art: 'reha', titel: 'Reha / Rücken', dauerMin: 30 },
  { art: 'pause', titel: 'Pause', dauerMin: 15 },
  { art: 'block', titel: 'Blockzeit', dauerMin: 60 },
];
const DAUERN = [15, 30, 60, 90, 120].map(d => ({ id: String(d), label: d < 60 ? `${d}m` : `${d / 60}h` }));
const ART_LABEL: Record<'block' | 'fokus' | 'reha' | 'pause', string> = { block: 'Block', fokus: 'Fokus', reha: 'Reha', pause: 'Pause' };

const mmss = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const snap = (min: number) => Math.round(min / 15) * 15;
const fmtH = (h: number) => h.toFixed(1).replace('.', ',');

/** Montag der Woche mit Versatz (0 = diese Woche). */
function montag(offset: number): Date {
  const d = new Date();
  const tag = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - tag + offset * 7);
  d.setHours(12, 0, 0, 0);
  return d;
}

const verweis: CSSProperties = { fontSize: 12, color: C.aktiv, textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' };
const zeit: CSSProperties = { fontSize: 11, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' };
/** Wahlknopf in Kennzahlfarbe — Art des eigenen Blocks. */
const wahl = (an: boolean, farbe: string): CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: an ? `${farbe}26` : 'rgba(255,255,255,.05)', color: an ? farbe : C.inkDim, transition: 'background .15s ease, color .15s ease',
});

/** Ziehbare Pille — Baustein, Routine oder Aufgabe, die man in den Tag zieht. */
function Ziehbar({ farbe, daten, children, breit }: { farbe: string; daten: object; children: React.ReactNode; breit?: number }) {
  return (
    <span draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify(daten))} className="fassbar" style={{
      display: 'inline-block', background: `${farbe}22`, color: farbe, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, letterSpacing: '.02em',
      whiteSpace: 'nowrap', cursor: 'grab', maxWidth: breit ?? '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle',
    }}>{children}</span>
  );
}

export function WochenplanView() {
  const router = useRouter();
  const { state: tasksState } = useTasks();
  const [offset, setOffset] = useState(0);
  const [bloecke, setBloecke] = useState<PlanBlock[]>([]);
  const [fix, setFix] = useState<FixTermin[]>([]);
  const [aktivBlock, setAktivBlock] = useState<string | null>(null);
  // Ziele beim Planen sichtbar — und Jarvis' Wochenvorschlag (Human-in-the-Loop).
  const [ziele, setZiele] = useState<{ monat: { titel: string; fortschritt: number; erledigt?: boolean }[]; quartal: { titel: string; fortschritt: number; erledigt?: boolean }[]; fokus?: { woche?: string; monat?: string; quartal?: string } }>({ monat: [], quartal: [] });
  const [vorschlag, setVorschlag] = useState<{ begruendung: string; bloecke: PlanBlock[]; verworfen: number } | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [routinen, setRoutinen] = useState<{ id: string; label: string; dauerMin: number; aktiv: boolean }[]>([]);
  // Fokus-Regler: Kevin lenkt, das System sortiert danach vor.
  const [regler, setRegler] = useState<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Stand, wie er zuletzt gelesen/geschrieben wurde — Basis für die Unterschiede. */
  const gespeichert = useRef<PlanBlock[] | null>(null);
  /** Ein Speichervorgang steht aus — dann keinen Abgleich dazwischenschieben. */
  const speichernSteht = useRef(false);
  // Selbst anlegen + Spiegelung nach Apple.
  const [neuTitel, setNeuTitel] = useState('');
  const [neuDauer, setNeuDauer] = useState(60);
  const [neuArt, setNeuArt] = useState<PlanBlock['art']>('block');
  const [appleSync, setAppleSync] = useState(false);
  const [appleKalender, setAppleKalender] = useState<string>('');
  const [syncLaeuft, setSyncLaeuft] = useState<string | null>(null);
  const [syncMeldung, setSyncMeldung] = useState<string | null>(null);
  const heute = localDay();

  const mo = montag(offset);
  const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mo); d.setDate(d.getDate() + i); return localDay(d);
  }), [offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const wochenKey = tage[0];

  useEffect(() => {
    fetch('/api/state/routinen').then(r => r.json()).then(d => setRoutinen((d.routinen ?? []).filter((x: { aktiv: boolean }) => x.aktiv))).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setZiele({ monat: d.monat ?? [], quartal: d.quartal ?? [], fokus: d.fokus ?? {} })).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
    // Welcher Kalender beschrieben würde — nur zur Anzeige, ohne zu schreiben.
    fetch('/api/apple-calendar/termin').then(r => r.json()).then(d => { if (d.ok) setAppleKalender(d.gewaehlt ?? ''); }).catch(() => {});
  }, []);

  // Verschiebbare Blöcke der Woche laden.
  useEffect(() => {
    fetch(`/api/state/wochenplan?woche=${wochenKey}`).then(r => r.json())
      .then(d => {
        const geladen = Array.isArray(d.bloecke) ? d.bloecke : [];
        gespeichert.current = geladen;
        setBloecke(geladen);
      })
      .catch(() => setBloecke([]));
  }, [wochenKey]);

  // Regelmäßiger Abgleich: Malins Züge erscheinen in Kevins Fenster von
  // selbst — aber nie mitten in einem eigenen, noch ungespeicherten Zug.
  useEffect(() => {
    const iv = setInterval(() => {
      if (speichernSteht.current) return;
      fetch(`/api/state/wochenplan?woche=${wochenKey}`).then(r => r.json()).then(d => {
        if (speichernSteht.current) return;
        const neu = Array.isArray(d.bloecke) ? d.bloecke : [];
        if (JSON.stringify(neu) !== JSON.stringify(gespeichert.current ?? [])) {
          gespeichert.current = neu;
          setBloecke(neu);
        }
      }).catch(() => { /* nächste Runde */ });
    }, 60_000);
    return () => clearInterval(iv);
  }, [wochenKey]);

  // Feste Termine aus beiden Kalendern (Apple-Cache + KEMARIS/M365), dedupliziert.
  useEffect(() => {
    Promise.all([
      fetch('/api/apple-calendar').then(r => r.json()).catch(() => []),
      fetch('/api/kemaris-calendar').then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([apple, kem]) => {
      const roh: { titel: string; start?: string; ende?: string }[] = [
        ...(Array.isArray(apple) ? apple : []).map((e: { title?: string; startDate?: string; endDate?: string; allDay?: boolean }) =>
          e.allDay ? null : { titel: e.title ?? '', start: e.startDate, ende: e.endDate }).filter(Boolean) as { titel: string; start?: string; ende?: string }[],
        ...((kem?.events ?? []) as { title?: string; start?: string; end?: string }[]).map(e => ({ titel: e.title ?? '', start: e.start, ende: e.end })),
      ];
      const gesehen = new Set<string>();
      const liste: FixTermin[] = [];
      for (const e of roh) {
        if (!e.start) continue;
        const date = e.start.slice(0, 10);
        if (!tage.includes(date)) continue;
        const key = `${e.titel.toLowerCase().trim()}|${e.start.slice(0, 16)}`;
        if (gesehen.has(key)) continue;
        gesehen.add(key);
        const s = new Date(e.start), en = e.ende ? new Date(e.ende) : null;
        const startMin = s.getHours() * 60 + s.getMinutes();
        const dauerMin = en ? Math.max(15, Math.round((en.getTime() - s.getTime()) / 60000)) : 60;
        liste.push({ titel: e.titel, date, startMin, dauerMin, quelle: 'Kalender' });
      }
      setFix(liste);
    });
  }, [wochenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zwei-Fenster-Fundament: nur die Unterschiede schreiben, nicht die Woche.
  function speichern(next: PlanBlock[]) {
    setBloecke(next);
    clearTimeout(saveTimer.current);
    speichernSteht.current = true;
    saveTimer.current = setTimeout(() => {
      speichernSteht.current = false;
      const alt = gespeichert.current;
      gespeichert.current = next;
      void wochenplanSchreiben(wochenKey, alt, next);
    }, 500);
  }

  // ── Apple-Synchronisation ────────────────────────────────────────────────
  // Kevins Ansage: „Wenn ich einen Block anlege, soll sofort der Termin bei
  // Apple entstehen." Bewusst mit sichtbarem Schalter: es schreibt in seinen
  // echten Kalender, das soll niemand aus Versehen anhaben.

  /** Block in den Apple Kalender spiegeln und die Termin-Id am Block merken. */
  async function nachApple(b: PlanBlock, alle: PlanBlock[]) {
    setSyncLaeuft(b.id);
    try {
      const r = await fetch('/api/apple-calendar/termin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel: b.titel, date: b.date, startMin: b.startMin, dauerMin: b.dauerMin, notiz: 'Aus MAKE OS geplant.' }),
      });
      const d = await r.json();
      if (d.ok && d.uid) {
        speichern(alle.map(x => x.id === b.id ? { ...x, appleUid: d.uid } : x));
        setSyncMeldung(null);
      } else {
        setSyncMeldung(d.error ?? 'Termin konnte nicht angelegt werden.');
      }
    } catch {
      setSyncMeldung('Kalender nicht erreichbar — läuft die App?');
    }
    setSyncLaeuft(null);
  }

  /** Block löschen — und den gespiegelten Termin gleich mit. */
  function blockLoeschen(b: PlanBlock) {
    speichern(bloecke.filter(x => x.id !== b.id));
    setAktivBlock(null);
    if (b.appleUid) {
      fetch(`/api/apple-calendar/termin?uid=${encodeURIComponent(b.appleUid)}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  /** Selbst anlegen: Klick auf freie Fläche → Block an dieser Uhrzeit. */
  function eigenerBlock(date: string, startMin: number) {
    const b: PlanBlock = {
      id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      date, startMin, dauerMin: neuDauer, titel: neuTitel.trim() || 'Blockzeit', art: neuArt,
    };
    const alle = [...bloecke, b];
    speichern(alle);
    setNeuTitel('');
    setAktivBlock(b.id);
    if (appleSync) void nachApple(b, alle);
  }

  // ── Ziehen & Fallenlassen ──
  function dropAufTag(e: React.DragEvent, date: string) {
    e.preventDefault();
    const daten = e.dataTransfer.getData('text/plain');
    if (!daten) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = Math.max(START, Math.min(ENDE - 15, START + snap((e.clientY - rect.top) / PX)));
    try {
      const p = JSON.parse(daten) as { move?: string; neu?: { art: PlanBlock['art']; titel: string; dauerMin: number }; aufgabe?: { taskId: string; titel: string } };
      if (p.move) {
        speichern(bloecke.map(b => b.id === p.move ? { ...b, date, startMin } : b));
      } else if (p.neu) {
        speichern([...bloecke, { id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, startMin, dauerMin: p.neu.dauerMin, titel: p.neu.titel, art: p.neu.art }]);
      } else if (p.aufgabe) {
        speichern([...bloecke, { id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, date, startMin, dauerMin: 60, titel: p.aufgabe.titel, art: 'aufgabe', taskId: p.aufgabe.taskId }]);
      }
    } catch { /* kein gültiges Paket */ }
  }

  const offeneAufgaben = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const geplant = new Set(bloecke.filter(b => b.taskId).map(b => b.taskId));
    // Fokus-Regler lenkt die Vorsortierung — Priorität schlägt den Regler aber immer.
    const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
    return tasksState.tasks
      .filter(t => t.status !== 'done' && !geplant.has(t.id))
      .sort((a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        boost(b) - boost(a) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 8)
      .map(t => ({ ...t, imFokus: boost(t) >= FOKUS_SCHWELLE }));
  }, [tasksState, bloecke, regler]);

  async function jarvisBelegen() {
    setDenkt(true); setVorschlag(null);
    try {
      const r = await fetch('/api/planung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ woche: wochenKey }) });
      const d = await r.json();
      if (Array.isArray(d.bloecke)) setVorschlag({ begruendung: d.begruendung ?? '', bloecke: d.bloecke, verworfen: d.verworfen ?? 0 });
    } catch { /* still */ }
    setDenkt(false);
  }

  const stunden = Array.from({ length: (ENDE - START) / 60 }, (_, i) => START / 60 + i);
  const wochenLabel = `${tage[0].slice(8)}.${tage[0].slice(5, 7)}. – ${tage[6].slice(8)}.${tage[6].slice(5, 7)}.${tage[6].slice(0, 4)}`;

  // Wochen-Kapazität: was ist verplant, was drückt an Aufgabenlast?
  const planMin = bloecke.reduce((s, b) => s + b.dauerMin, 0);
  const fixMin = fix.reduce((s, f) => s + f.dauerMin, 0);
  const offeneN = tasksState.tasks.filter(t => t.status !== 'done').length;
  const faelligWoche = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= tage[0] && t.dueDate <= tage[6]).length;
  const gesamtH = (planMin + fixMin) / 60;
  const ueberladen = gesamtH > 50;

  const zielListe = [...ziele.monat.filter(z => !z.erledigt).slice(0, 3).map(z => ({ ...z, h: 'M' })), ...ziele.quartal.filter(z => !z.erledigt).slice(0, 2).map(z => ({ ...z, h: 'Q' }))];

  return (
    <Seite
      breit={1200}
      titel="Wochenplaner"
      unter={<div>
        Die Woche, beweglich. Feste Termine stehen fest — alles andere ziehst du aus der Leiste in den Tag und schiebst es, bis der Tag passt.
        Blöcke: <b style={{ color: C.ink }}>anfassen & ziehen</b> zum Verschieben · <b style={{ color: C.ink }}>−/＋</b> für die Dauer · <b style={{ color: C.ink }}>✕</b> löschen.
        <div style={{ marginTop: 12 }}><PlanerLeiste aktiv="woche" /></div>
      </div>}
      rechts={<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, marginRight: 6 }}>{wochenLabel}</span>
        <Knopf leise onClick={() => setOffset(o => o - 1)}>‹</Knopf>
        <Knopf leise={offset !== 0} farbe={LEUCHT.puls} onClick={() => setOffset(0)}>heute</Knopf>
        <Knopf leise onClick={() => setOffset(o => o + 1)}>›</Knopf>
      </div>}
    >
      {/* Wochen-Kapazität */}
      <Karte i={0} akzent={ueberladen ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={ueberladen ? LEUCHT.achtung : LEUCHT.puls} rechts={ueberladen ? <Chip farbe={LEUCHT.achtung}>überladen, Ruhe braucht Luft</Chip> : 'Termine + Blöcke'}>Diese Woche</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
          <Zahl wert={gesamtH ? fmtH(gesamtH) : undefined} label="h belegt" farbe={ueberladen ? LEUCHT.achtung : LEUCHT.puls} />
          <Zahl wert={fixMin ? fmtH(fixMin / 60) : undefined} label="h Termine" />
          <Zahl wert={planMin ? fmtH(planMin / 60) : undefined} label="h Blöcke" />
          <Zahl wert={offeneN ? String(offeneN) : undefined} label="Aufgaben offen" />
          <Zahl wert={faelligWoche ? String(faelligWoche) : undefined} label="fällig diese Woche" farbe={faelligWoche ? LEUCHT.achtung : undefined} />
        </div>
      </Karte>

      {/* Ziele im Blick — die Woche plant man gegen Ziele, nicht ins Blaue */}
      {(ziele.monat.length > 0 || ziele.quartal.length > 0) && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={!ziele.monat.length ? <Link href="/os/planung/monat" style={verweis}>Monatsziele anlegen ›</Link> : undefined}>Ziele</Ueberschrift>
          {(ziele.fokus?.woche || ziele.fokus?.monat) && (
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(16px,2vw,18px)', fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>
              <span style={{ color: LEUCHT.schlaf }}>◎</span> {ziele.fokus?.woche || ziele.fokus?.monat}
            </div>
          )}
          <Liste>
            {zielListe.map((z, i) => (
              <Zeile key={i} onClick={() => router.push(z.h === 'M' ? '/os/planung/monat' : '/os/planung/quartal')}
                links={<Chip farbe={z.h === 'M' ? LEUCHT.schlaf : LEUCHT.agenten}>{z.h}</Chip>} titel={z.titel}
                rechts={<div style={{ width: 64, flex: '0 0 auto' }}><Fortschritt anteil={z.fortschritt / 100} farbe={z.fortschritt >= 70 ? LEUCHT.gut : z.fortschritt >= 40 ? LEUCHT.achtung : LEUCHT.kritisch} /></div>} />
            ))}
          </Liste>
        </Karte>
      )}

      {/* Jarvis belegt die Woche — Vorschlag, den du zurechtschiebst */}
      <Karte i={2} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten}>Jarvis belegt die Woche</Ueberschrift>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Knopf onClick={jarvisBelegen} aus={denkt} farbe={LEUCHT.agenten}>{denkt ? 'Jarvis plant …' : '✨ Jarvis belegt die Woche'}</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Reha täglich · Fokus vormittags · Routinen · Aufgaben nach Priorität — um deine festen Termine herum.</span>
        </div>
        {vorschlag && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <Ueberschrift farbe={LEUCHT.agenten} rechts={`${vorschlag.bloecke.length} Blöcke${vorschlag.verworfen ? ` · ${vorschlag.verworfen} verworfen (kollidierten mit Terminen)` : ''}`}>Jarvis&apos; Vorschlag</Ueberschrift>
            <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>{vorschlag.begruendung}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Knopf farbe={LEUCHT.agenten} onClick={() => { speichern(vorschlag.bloecke); setVorschlag(null); }}>Übernehmen — ersetzt die aktuellen Blöcke</Knopf>
              <Knopf leise onClick={() => setVorschlag(null)}>Verwerfen</Knopf>
            </div>
          </div>
        )}
      </Karte>

      {/* Eigener Block: Titel, Dauer, Art — dann in den Tag klicken */}
      <Karte i={3}>
        <Ueberschrift farbe={ART_FARBE[neuArt]}>Eigener Block</Ueberschrift>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            placeholder="Wofür? z. B. Steuerberater anrufen"
            aria-label="Titel des eigenen Blocks"
            style={{ ...feld, width: 'auto', flex: '1 1 220px', minWidth: 'min(180px, 100%)' }} />
          <Segmente liste={DAUERN} aktiv={String(neuDauer)} onWahl={id => setNeuDauer(Number(id))} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['block', 'fokus', 'reha', 'pause'] as const).map(a => (
              <button key={a} className="fassbar" onClick={() => setNeuArt(a)} style={wahl(neuArt === a, ART_FARBE[a])}>{ART_LABEL[a]}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Dann unten in den Tag klicken — dort, wo der Block liegen soll.</div>

        {/* Spiegelung nach Apple — bewusst ein Schalter, kein Automatismus */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <span title={appleSync ? 'Neue Blöcke landen sofort im Apple Kalender' : 'Blöcke bleiben nur in MAKE OS'}>
            <Knopf leise={!appleSync} farbe={LEUCHT.puls} onClick={() => setAppleSync(!appleSync)}>{appleSync ? '● ' : '○ '}In Apple Kalender schreiben</Knopf>
          </span>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>
            {appleSync
              ? <>Neue Blöcke werden sofort als Termin in <b style={{ color: C.inkDim }}>{appleKalender || '…'}</b> angelegt. Löschst du den Block, geht der Termin mit.</>
              : <>Aus. Blöcke bleiben in MAKE OS. {appleKalender && `Ziel wäre: ${appleKalender}.`}</>}
          </span>
          {syncLaeuft && <span style={{ fontSize: 12, color: LEUCHT.puls }}>schreibt …</span>}
        </div>
        {syncMeldung && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ flex: 1 }}>{syncMeldung}</span>
            <button onClick={() => setSyncMeldung(null)} aria-label="Meldung schließen" style={{ background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>✕</button>
          </div>
        )}
      </Karte>

      {/* Leiste: Bausteine · Routinen · Aufgaben */}
      <Karte i={4}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <Ueberschrift>Bausteine</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BAUSTEINE.map(bs => (
                <Ziehbar key={bs.titel} farbe={ART_FARBE[bs.art]} daten={{ neu: bs }}>{bs.titel} · {bs.dauerMin}m</Ziehbar>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 0, maxWidth: 460 }}>
            <Ueberschrift rechts={<Link href="/os/planung/routinen" style={verweis}>planen ›</Link>}>Routinen</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {routinen.map(r => (
                <Ziehbar key={r.id} farbe={ART_FARBE.routine} daten={{ neu: { art: 'routine', titel: r.label, dauerMin: r.dauerMin } }}>{r.label}</Ziehbar>
              ))}
              {!routinen.length && <Leer>Noch keine Routinen — im Routine-Planer anlegen.</Leer>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 'min(220px, 100%)' }}>
            <Ueberschrift rechts={<span>ziehen · ◎ = <Link href="/os/planung/fokus" style={verweis}>im Fokus</Link></span>}>Aufgaben einplanen</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {offeneAufgaben.map(t => (
                <Ziehbar key={t.id} farbe={t.imFokus ? LEUCHT.schlaf : ART_FARBE.aufgabe} daten={{ aufgabe: { taskId: t.id, titel: t.title } }} breit={240}>
                  {t.priority === 'critical' ? '‼ ' : ''}{t.imFokus ? '◎ ' : ''}{t.title}
                </Ziehbar>
              ))}
              {!offeneAufgaben.length && <Leer>Alles eingeplant oder erledigt.</Leer>}
            </div>
          </div>
        </div>
      </Karte>

      {/* Raster */}
      <Karte i={5}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '46px repeat(7, minmax(120px, 1fr))', gap: 4 }}>
            {/* Zeitspalte */}
            <div>
              <div style={{ height: 34 }} />
              <div style={{ position: 'relative', height: H }}>
                {stunden.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX - 7, right: 6, ...zeit }}>{String(h).padStart(2, '0')}</div>
                ))}
              </div>
            </div>

            {tage.map((date, di) => {
              const istHeute = date === heute;
              // Kapazität: verplante Stunden (Blöcke + feste Termine) je Tag —
              // ehrliche Auslastung statt gefühlter Fülle. >8h gelb, >10h rot.
              const belegtMin = bloecke.filter(b => b.date === date).reduce((s, b) => s + b.dauerMin, 0)
                + fix.filter(f => f.date === date).reduce((s, f) => s + f.dauerMin, 0);
              const belegtH = belegtMin / 60;
              const lastFarbe = belegtH > 10 ? LEUCHT.kritisch : belegtH > 8 ? LEUCHT.achtung : C.inkLeise;
              // Feste Termine UND Blöcke gemeinsam verteilen — sie liegen in
              // derselben Spalte und dürfen sich deshalb nicht zudecken.
              const tagesFix = fix.filter(f => f.date === date);
              const tagesBloecke = bloecke.filter(b => b.date === date);
              const spuren = verteileSpuren([
                ...tagesFix.map((f, i) => ({ id: `fix-${i}`, startMin: f.startMin, dauerMin: f.dauerMin })),
                ...tagesBloecke.map(b => ({ id: b.id, startMin: b.startMin, dauerMin: b.dauerMin })),
              ]);
              return (
                <div key={date} style={{ minWidth: 0 }}>
                  <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, background: istHeute ? `${LEUCHT.puls}1F` : 'rgba(255,255,255,.05)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: istHeute ? LEUCHT.puls : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{WD[di]} {date.slice(8)}.{date.slice(5, 7)}.</span>
                    {belegtMin > 0 && <span title={belegtH > 10 ? 'überladen — Ruhe braucht Luft' : belegtH > 8 ? 'voll — Pausen ernst nehmen' : 'Auslastung'}
                      style={{ fontSize: 11, fontWeight: 700, color: lastFarbe, fontVariantNumeric: 'tabular-nums' }}>{fmtH(belegtH)}h</span>}
                  </div>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => dropAufTag(e, date)}
                    // Klick auf freie Fläche legt dort einen Block an — Kevins
                    // Ansage: „Ich will auch selber Blöcke anlegen können."
                    onClick={e => {
                      if (e.target !== e.currentTarget) return;   // nur die leere Fläche
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      eigenerBlock(date, Math.max(START, Math.min(ENDE - 15, START + snap((e.clientY - rect.top) / PX))));
                    }}
                    title="Auf eine freie Stelle klicken, um dort einen Block anzulegen"
                    style={{ position: 'relative', height: H, background: istHeute ? `${LEUCHT.puls}0A` : 'rgba(255,255,255,.03)', boxShadow: istHeute ? `inset 0 0 0 1px ${LEUCHT.puls}33` : undefined, borderRadius: 12, marginTop: 4, cursor: 'copy' }}
                  >
                    {/* Stundenlinien */}
                    {stunden.map(h => (
                      <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,.045)' }} />
                    ))}

                    {/* Feste Termine (unverrückbar) */}
                    {tagesFix.map((f, fi) => {
                      const top = Math.max(0, (f.startMin - START) * PX);
                      const hoehe = Math.max(16, Math.min(H - top, f.dauerMin * PX));
                      const lage = spuren.get(`fix-${fi}`);
                      const n = lage?.spuren ?? 1;
                      return (
                        <div key={fi} title={`${f.titel} · ${mmss(f.startMin)}–${mmss(f.startMin + f.dauerMin)} (fest)`}
                          style={{ position: 'absolute', top, ...spurStil(lage), height: hoehe, background: C.flaecheHoch, borderLeft: `3px solid ${C.inkDim}`, boxShadow: n > 1 ? `0 0 0 1px ${C.grund}` : undefined, borderRadius: 7, padding: n > 2 ? '2px 4px' : '3px 6px', overflow: 'hidden', zIndex: 1 }}>
                          <div style={titelStil(n, C.inkDim)}>{n > 2 ? '' : '🔒 '}{f.titel}</div>
                          {hoehe > 30 && n < 3 && <div style={zeit}>{mmss(f.startMin)}–{mmss(f.startMin + f.dauerMin)}</div>}
                        </div>
                      );
                    })}

                    {/* Verschiebbare Blöcke */}
                    {tagesBloecke.map(b => {
                      const top = Math.max(0, (b.startMin - START) * PX);
                      const hoehe = Math.max(18, Math.min(H - top, b.dauerMin * PX));
                      const farbe = ART_FARBE[b.art];
                      const aktivB = aktivBlock === b.id;
                      const lage = spuren.get(b.id);
                      return (
                        <div key={b.id} draggable
                          onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ move: b.id }))}
                          onClick={() => setAktivBlock(aktivB ? null : b.id)}
                          title={`${b.titel} · ${mmss(b.startMin)}–${mmss(b.startMin + b.dauerMin)}`}
                          style={{ position: 'absolute', top, ...spurStil(lage), height: hoehe, cursor: 'grab', background: `${farbe}26`, backdropFilter: 'blur(2px)', borderLeft: `3px solid ${farbe}`, boxShadow: aktivB ? `0 0 0 1px ${farbe}, 0 0 14px ${farbe}66` : undefined, borderRadius: 7, padding: '3px 6px', overflow: 'hidden', zIndex: aktivB ? 8 : 3, transition: 'box-shadow .2s ease' }}>
                          <div style={titelStil(lage?.spuren ?? 1, farbe)}>{b.titel}</div>
                          {hoehe > 30 && (lage?.spuren ?? 1) < 3 && <div style={zeit}>{mmss(b.startMin)}–{mmss(b.startMin + b.dauerMin)}</div>}
                          {aktivB && (
                            <div style={{ position: 'absolute', top: 2, right: 4, display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => speichern(bloecke.map(x => x.id === b.id ? { ...x, dauerMin: Math.max(15, x.dauerMin - 30) } : x))} style={miniBtn(farbe)}>−</button>
                              <button onClick={() => speichern(bloecke.map(x => x.id === b.id ? { ...x, dauerMin: Math.min(480, x.dauerMin + 30) } : x))} style={miniBtn(farbe)}>＋</button>
                              <button onClick={() => blockLoeschen(b)} title={b.appleUid ? 'Block und Apple-Termin löschen' : 'Block löschen'} style={miniBtn(LEUCHT.kritisch)}>✕</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', fontSize: 12, color: C.inkLeise, marginTop: 14, lineHeight: 1.6 }}>
          <span>🔒 feste Termine (Apple + KEMARIS)</span>
          {(['fokus', 'reha', 'routine', 'aufgabe', 'pause'] as const).map(a => (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ART_FARBE[a] }}><Punkt farbe={ART_FARBE[a]} groesse={7} />{a === 'fokus' ? 'Fokus' : a === 'reha' ? 'Reha' : a === 'routine' ? 'Routine' : a === 'aufgabe' ? 'Aufgabe' : 'Pause'}</span>
          ))}
          <span>— alles wird automatisch gespeichert.</span>
        </div>
      </Karte>
    </Seite>
  );
}

function miniBtn(farbe: string): React.CSSProperties {
  return { width: 18, height: 18, lineHeight: '18px', fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: 'pointer', border: 'none', background: `${farbe}33`, color: farbe, padding: 0 };
}
