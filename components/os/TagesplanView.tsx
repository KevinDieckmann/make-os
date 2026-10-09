'use client';
import { useSpace } from '@/hooks/useSpace';
import { fokusFuerSpace } from '@/lib/make-one/space-regeln';

import Link from 'next/link';
// ─── MAKE OS — Tagesplanung ─────────────────────────────────────────────────
// Kevins Tages-Cockpit: oben stehen die FOKUSTHEMEN (Monats-Fokus + Bereiche
// mit hohem Fokus-Regler), darunter der ganze Tag als Kalender — auch wenn
// keine Termine da sind. Lücken sind sichtbar, und wie im Wochenplaner zieht
// man Bausteine, Routinen und Aufgaben einfach rein. Die Blöcke sind DIESELBEN
// wie im Kalender-Modus „Planen“ — hier bearbeitet man nur den heutigen Tag.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Chips, Leuchtfarben).
// 29.09. (K5, „Ein Kalender“): Blöcke sind iCloud-Termine der Art Fokus/Block (lib/planung/bloecke.ts) — gelesen über
// /api/kalender (+ Archiv des alten Wochenplans, nur lesen), geschrieben über /api/kalender/termin (mit ETag).
// Feste Termine = die übrigen Termine des Tages (beschäftigt, mit Uhrzeit). Keine KEMARIS-Beispieldaten mehr.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, MIKRO, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ART_FARBE, type PlanBlock } from '@/types/planer';
import { useKalender } from './kalender/teile';
import { bloeckeAus, blockAnfrage, gehoertZu, planArtVon, type PlanBlockSicht } from '@/lib/planung/bloecke';
import { REHA_GEWOHNHEIT_TAGE, rehaGewohnt } from '@/lib/planung/reha-regel';
import { tagPlus, wandAus, minutenVon } from '@/lib/kalender/zeit';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { einheitKurz } from '@/lib/aufgaben/einheit';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, KATEGORIE_ZU_SAEULE, SAEULE_LABEL, SAEULE_FARBE, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Haken, Fortschritt, Zahl, LEUCHT, useRueckfrage } from './ui';
import { ZieleMeilensteine } from './planung/ZieleMeilensteine';

interface Routine { id: string; label: string; wann: 'morgen' | 'tag' | 'abend'; kategorie: string; dauerMin: number; aktiv: boolean }
interface Fix { titel: string; startMin: number; dauerMin: number }

const KATEGORIE_FARBE: Record<string, string> = { gesundheit: LEUCHT.gut, leben: LEUCHT.beziehung, business: LEUCHT.business };
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (min: number) => Math.round(min / 15) * 15;

// Raster wie im Wochenplaner: 06:00–22:00.
const START = 6 * 60, ENDE = 22 * 60, PX = 0.85;
const H = (ENDE - START) * PX;

/**
 * „Nimm im Planer auch viele Standards mit dabei." Allgemeine Bausteine eines Arbeitstags — einmal anklicken statt jedes Mal
 * neu tippen. Seit 09.10. ohne Bausteine einer bestimmten Person (Körperstelle, Termin mit einer Person): eigene Abläufe stehen
 * als Routinen und Wochenvorlage in den Daten (Planung › Routinen).
 */
const BAUSTEINE: { art: PlanBlock['art']; titel: string; dauerMin: number }[] = [
  { art: 'fokus', titel: 'Fokus (Deep Work)', dauerMin: 90 },
  { art: 'fokus', titel: 'Kurzer Fokus', dauerMin: 45 },
  { art: 'reha', titel: 'Reha / Training', dauerMin: 30 },
  { art: 'reha', titel: 'Bewegung / Spaziergang', dauerMin: 30 },
  { art: 'pause', titel: 'Pause', dauerMin: 15 },
  { art: 'pause', titel: 'Mittag', dauerMin: 45 },
  { art: 'block', titel: 'Blockzeit', dauerMin: 60 },
  { art: 'block', titel: 'Postfach leeren', dauerMin: 30 },
  { art: 'block', titel: 'Telefonate / Rückrufe', dauerMin: 45 },
  { art: 'block', titel: 'Finanzen & Rechnungen', dauerMin: 60 },
  { art: 'block', titel: 'Abstimmung im Team', dauerMin: 60 },
  { art: 'routine', titel: 'Tagesstart', dauerMin: 15 },
  { art: 'routine', titel: 'Tagesende', dauerMin: 15 },
];

const verweis: CSSProperties = { fontSize: 12, color: C.aktiv, textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' };
const mini = (farbe: string): CSSProperties => ({ background: `${farbe}33`, border: 'none', borderRadius: 5, color: farbe, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '0 6px', lineHeight: '16px' });

/** Ziehbare Pille — Baustein, Routine oder Aufgabe, die man in den Tag zieht. */
function Ziehbar({ farbe, daten, children, breit }: { farbe: string; daten: object; children: React.ReactNode; breit?: number }) {
  return (
    <span draggable onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify(daten))} className="fassbar" style={{
      display: 'inline-block', background: `${farbe}22`, color: farbe, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, letterSpacing: '.02em',
      whiteSpace: 'nowrap', cursor: 'grab', maxWidth: breit ?? '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle',
    }}>{children}</span>
  );
}

export function TagesplanView({ tag }: { tag?: string } = {}) {
  const { ausAdresse: spaceAusAdresse } = useSpace();
  const { bestaetigen, dialog } = useRueckfrage();
  // Kevins Ansage: den nächsten Tag angucken können. Ohne Anker ist es heute.
  const heute = tag ?? localDay();
  const istHeute = heute === localDay();
  const { state: tasksState } = useTasks();
  const { daten: kal, laden: kalLaden } = useKalender(heute, tagPlus(heute, 1));
  const [ich, setIch] = useState<string | null>(null);
  const [archiv, setArchiv] = useState<PlanBlockSicht[]>([]);
  // Reha zählt im „Durchgeplant“-Check nur, wenn die Person selbst in den letzten Tagen Reha geplant hat (nie fest für alle).
  const [rehaVorher, setRehaVorher] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [routinen, setRoutinen] = useState<Routine[]>([]);
  const [hlog, setHlog] = useState<Record<string, string[]>>({});
  const [fokusAlle, setFokusAlle] = useState<Record<string, string>>({});
  const [ziele, setZiele] = useState<{ titel: string; fortschritt: number }[]>([]);
  const [regler, setRegler] = useState<Record<string, number>>({});
  const [aktivBlock, setAktivBlock] = useState<string | null>(null);
  const [jetztMin, setJetztMin] = useState<number | null>(null);
  const hSpaeter = useNachspeichern<Record<string, string[]>>(next => {
    fetch('/api/state/health', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  }, 300);

  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (typeof d.ich?.speicher === 'string') setIch(d.ich.speicher); }).catch(() => {});
    // Archiv: Blöcke des alten Wochenplans an diesem Tag, die (noch) nicht übernommen sind — nur lesen.
    // Dazu die eigenen Blöcke der letzten Tage — nur für die Reha-Regel (`rehaGewohnt`, lib/planung/reha-regel.ts).
    fetch(`/api/planung/bloecke?von=${tagPlus(heute, -REHA_GEWOHNHEIT_TAGE)}&bis=${tagPlus(heute, 1)}`).then(r => r.json())
      .then(d => {
        const alle = (d.bloecke ?? []) as (PlanBlockSicht & { gespiegelt?: true })[];
        setArchiv(alle.filter(b => b.date === heute && b.quelle === 'archiv' && !b.gespiegelt));
        setRehaVorher(rehaGewohnt(alle, heute));
      }).catch(() => { setArchiv([]); setRehaVorher(false); });
    fetch('/api/state/routinen?sicht=ich').then(r => r.json()).then(d => setRoutinen((d.routinen ?? []).filter((x: Routine) => x.aktiv))).catch(() => {});
    fetch('/api/state/health').then(r => r.json()).then(d => setHlog(d.log ?? {})).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => { setFokusAlle(d.fokus ?? {}); setZiele((d.monat ?? []).filter((z: { erledigt?: boolean }) => !z.erledigt)); }).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
  }, [heute]);

  // Jetzt-Linie erst nach dem Mount setzen (kein Hydration-Versatz), dann mitlaufen lassen.
  useEffect(() => {
    const tick = () => { const d = new Date(); setJetztMin(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Termine des Tages (Kalender): Blöcke der eigenen Person + feste Termine (beschäftigt, mit Uhrzeit, kein Block).
  const termineHeute = useMemo(() => (kal?.termine ?? []).filter(t => !t.ganztags && t.start.slice(0, 10) === heute), [kal, heute]);
  const standVon = useMemo(() => new Map(termineHeute.map(t => [t.uid, t.stand])), [termineHeute]);
  const meine = useMemo<PlanBlockSicht[]>(() => [...bloeckeAus(termineHeute.filter(t => !ich || gehoertZu(t, ich))), ...archiv], [termineHeute, ich, archiv]);
  const fix = useMemo<Fix[]>(() => termineHeute.filter(t => !planArtVon(t) && t.art !== 'arbeitsort' && t.beschaeftigt !== false).map(t => {
    const s0 = minutenVon(t.start);
    const e0 = t.ende.slice(0, 10) > heute ? 24 * 60 : minutenVon(t.ende);
    return { titel: t.titel, startMin: s0, dauerMin: Math.max(15, e0 - s0) };
  }), [termineHeute, heute]);

  /** Ein Block ist ein Termin: anlegen/ändern/löschen über /api/kalender/termin (mit ETag), dann neu laden. */
  async function schreiben(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    const url = method === 'DELETE' ? `/api/kalender/termin?uid=${encodeURIComponent(String(body.uid))}${body.stand ? `&stand=${encodeURIComponent(String(body.stand))}` : ''}` : '/api/kalender/termin';
    const r = await fetch(url, { method, ...(method === 'DELETE' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? null : r.fehler ?? 'Nicht gespeichert.');
    await kalLaden();
  }
  const bearbeitbar = (b: PlanBlockSicht) => b.quelle === 'kalender' && !!b.uid && !!termineHeute.find(t => t.uid === b.uid)?.bearbeitbar;
  const blockNeu = (n: { art: PlanBlock['art']; titel: string; dauerMin: number; taskId?: string }, startMin: number) =>
    schreiben('POST', blockAnfrage({ date: heute, startMin, dauerMin: n.dauerMin, titel: n.titel, art: n.art, ...(n.taskId ? { taskId: n.taskId } : {}) }));
  const blockSetzen = (b: PlanBlockSicht, startMin: number, dauerMin: number) =>
    schreiben('PATCH', { uid: b.uid, start: wandAus(heute, startMin), ende: wandAus(heute, startMin + dauerMin), ...(standVon.get(b.uid!) ? { stand: standVon.get(b.uid!) } : {}) });
  const blockWeg = (b: PlanBlockSicht) => schreiben('DELETE', { uid: b.uid, ...(standVon.get(b.uid!) ? { stand: standVon.get(b.uid!) } : {}) });

  function dropAufKalender(e: React.DragEvent) {
    e.preventDefault();
    const daten = e.dataTransfer.getData('text/plain');
    if (!daten) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = Math.max(START, Math.min(ENDE - 15, START + snap((e.clientY - rect.top) / PX)));
    try {
      const p = JSON.parse(daten) as { move?: string; neu?: { art: PlanBlock['art']; titel: string; dauerMin: number }; aufgabe?: { taskId: string; titel: string } };
      if (p.move) { const b = meine.find(x => x.id === p.move); if (b && bearbeitbar(b)) void blockSetzen(b, startMin, b.dauerMin); }
      else if (p.neu) void blockNeu(p.neu, startMin);
      else if (p.aufgabe) void blockNeu({ art: 'aufgabe', titel: p.aufgabe.titel, dauerMin: 60, taskId: p.aufgabe.taskId }, startMin);
    } catch { /* kein gültiges Paket */ }
  }

  // Der Fokus des Tages — fällt auf Woche, dann Monat zurück.
  // Im Space zählt der Space-Fokus, sonst der gemeinsame (26.09.).
  const fokusSicht = fokusFuerSpace(fokusAlle, spaceAusAdresse);
  const fokusText = fokusSicht.tag || fokusSicht.woche || fokusSicht.monat || '';
  const fokusQuelle = fokusSicht.tag ? 'Tag' : fokusSicht.woche ? 'Woche' : fokusSicht.monat ? 'Monat' : '';

  // ── Fokusbereiche: Regler ≥ Schwelle + grobe Stichwort-Erkennung aus den Fokus-Texten ──
  const fokusSaeulen = useMemo(() => {
    const s = new Set<string>();
    for (const [k, v] of Object.entries(regler)) if (v >= FOKUS_SCHWELLE) s.add(k);
    const ft = `${fokusAlle.tag ?? ''} ${fokusAlle.woche ?? ''} ${fokusAlle.monat ?? ''}`.toLowerCase();
    if (/gesund|reha|schlaf|energie|stabilisier|training|bewegung/.test(ft)) s.add('health');
    if (/kunde|umsatz|vertrieb|launch|pipeline|onboard/.test(ft)) s.add('business');
    if (/partner|familie|beziehung|team/.test(ft)) s.add('social');
    return s;
  }, [regler, fokusAlle]);
  const passtZumFokus = (r: Routine) => fokusSaeulen.has(KATEGORIE_ZU_SAEULE[r.kategorie] ?? '');

  // Routine-Häkchen — derselbe Store wie im Gesundheits-Cockpit.
  const erledigt = useMemo(() => new Set(hlog[heute] ?? []), [hlog, heute]);
  function toggleRoutine(id: string) {
    const tag = new Set(hlog[heute] ?? []);
    if (tag.has(id)) tag.delete(id); else tag.add(id);
    const next = { ...hlog, [heute]: Array.from(tag) };
    setHlog(next);
    hSpaeter(next);
  }

  // ── Aufgaben-Leiste: Priorität schlägt immer, dann Fokus-Regler, dann Fälligkeit ──
  const offeneAufgaben = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const geplant = new Set(meine.filter(b => b.taskId).map(b => b.taskId));
    const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
    return tasksState.tasks
      .filter(t => t.status !== 'done' && !geplant.has(t.id))
      .sort((a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        boost(b) - boost(a) ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 8)
      .map(t => ({ ...t, imFokus: boost(t) >= FOKUS_SCHWELLE }));
  }, [tasksState, meine, regler]);

  // ── Tageslücken: freie Fenster ≥30 Min zwischen 07 und 21 Uhr ──
  const luecken = useMemo(() => {
    const belegt = [
      ...fix.map(f => [f.startMin, f.startMin + f.dauerMin] as [number, number]),
      ...meine.map(b => [b.startMin, b.startMin + b.dauerMin] as [number, number]),
    ].map(([s, e]) => [Math.max(s, 7 * 60), Math.min(e, 21 * 60)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const out: { von: number; bis: number }[] = [];
    let cursor = 7 * 60;
    for (const [s, e] of belegt) {
      if (s - cursor >= 30) out.push({ von: cursor, bis: s });
      cursor = Math.max(cursor, e);
    }
    if (21 * 60 - cursor >= 30) out.push({ von: cursor, bis: 21 * 60 });
    return out;
  }, [fix, meine]);

  // ── Durchgeplant-Check (deterministisch, keine KI) ──
  const faelligHeute = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate === heute);
  const ueberfaellig = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < heute);
  const geplantTasks = useMemo(() => new Set(meine.filter(b => b.taskId).map(b => b.taskId)), [meine]);
  const check = useMemo(() => {
    const fokusMin = meine.filter(b => b.art === 'fokus').reduce((s, b) => s + b.dauerMin, 0);
    const wochenende = [0, 6].includes(new Date(`${heute}T12:00:00`).getDay());
    // Kollisionen: Blöcke, die sich mit festen Terminen oder untereinander überlappen.
    const intervalle = [
      ...fix.map(f => ({ s: f.startMin, e: f.startMin + f.dauerMin })),
      ...meine.map(b => ({ s: b.startMin, e: b.startMin + b.dauerMin })),
    ];
    let kollisionen = 0;
    for (let i = 0; i < intervalle.length; i++) {
      for (let k = i + 1; k < intervalle.length; k++) {
        if (intervalle[i].s < intervalle[k].e && intervalle[k].s < intervalle[i].e) kollisionen++;
      }
    }
    const rehaHeute = meine.some(b => b.art === 'reha');
    return [
      ...(rehaVorher || rehaHeute ? [{ ok: rehaHeute, text: 'Reha' }] : []),
      { ok: wochenende || fokusMin >= 90, text: wochenende ? 'Wochenende' : '90 Min Fokus' },
      { ok: faelligHeute.every(t => geplantTasks.has(t.id)), text: 'Fälliges im Plan' },
      { ok: meine.some(b => b.art === 'routine' && b.startMin < 10 * 60) || erledigt.size > 0, text: 'Morgenroutine' },
      { ok: kollisionen === 0, text: kollisionen ? `${kollisionen} Kollision${kollisionen > 1 ? 'en' : ''}` : 'Keine Kollisionen' },
      { ok: meine.length + fix.length <= 10, text: 'Nicht überladen' },
    ];
  }, [meine, fix, faelligHeute, geplantTasks, erledigt, heute, rehaVorher]);
  const okN = check.filter(c => c.ok).length;
  const checkFarbe = okN === check.length ? LEUCHT.gut : okN >= 3 ? LEUCHT.achtung : LEUCHT.kritisch;

  const stunden = Array.from({ length: (ENDE - START) / 60 }, (_, i) => START / 60 + i);
  const datum = new Date(`${heute}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const sortiertNachFokus = (a: Routine, b: Routine) => Number(passtZumFokus(b)) - Number(passtZumFokus(a));
  const routinenErledigt = Array.from(erledigt).filter(id => routinen.some(r => r.id === id)).length;

  return (
    <Seite titel="Tagesplanung" unter={<div>{datum}<div style={{ marginTop: 12 }}><PlanerLeiste aktiv="tag" tag={heute} /></div></div>}>
      {/* ── Die Fokusthemen stehen über dem Tag ── */}
      <Karte i={0} akzent={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/kompass" style={verweis}>Regler ›</Link>}>
          Fokus{fokusQuelle && fokusQuelle !== 'Tag' ? ` · ${fokusQuelle}` : ''}
        </Ueberschrift>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, lineHeight: 1.35 }}>
          {fokusText
            ? <><span style={{ color: LEUCHT.schlaf }}>◎</span> {fokusText}</>
            : <>Worauf es heute ankommt <Link href="/os/fokus" style={{ ...verweis, fontSize: TYP.bedien, marginLeft: 6 }}>Fokus setzen ›</Link></>}
        </div>
        {(fokusSaeulen.size > 0 || ziele.length > 0) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            {Array.from(fokusSaeulen).map(s => <Chip key={s} farbe={SAEULE_FARBE[s] ?? C.inkDim}>{SAEULE_LABEL[s] ?? s}</Chip>)}
            {ziele.slice(0, 3).map((z, i) => (
              <span key={`z${i}`} style={{ fontSize: TYP.bedien, color: C.inkDim }}>{z.titel} <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{z.fortschritt}%</span></span>
            ))}
          </div>
        )}
      </Karte>

      {/* ── Kompakter Durchgeplant-Check ── */}
      <Karte i={1}>
        <Ueberschrift farbe={checkFarbe} rechts={<Link href="/os/kalender?modus=planen" style={verweis}>Wochenplaner ›</Link>}>Durchgeplant</Ueberschrift>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Zahl wert={`${okN}/${check.length}`} label="Punkte erfüllt" farbe={checkFarbe} />
          <div style={{ flex: '1 1 240px', minWidth: 'min(240px, 100%)' }}>
            <Fortschritt anteil={okN / check.length} farbe={checkFarbe} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {check.map((c, i) => <Chip key={i} farbe={c.ok ? LEUCHT.gut : LEUCHT.kritisch}>{c.ok ? '✓' : '✗'} {c.text}</Chip>)}
              {ueberfaellig.length > 0 && <Link href="/os/aufgaben" style={{ textDecoration: 'none' }}><Chip farbe={LEUCHT.achtung}>⚠ {ueberfaellig.length} überfällig ›</Chip></Link>}
            </div>
          </div>
        </div>
      </Karte>

      {/* ── Tagesziele links, Meilensteine des Tages rechts (27.09.) — Kaskade aus dem Jahr, Priorität per Pfeil ── */}
      <ZieleMeilensteine horizont="tag" farbe={LEUCHT.schlaf} i={2} kompakt />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── Der Tag als Kalender — Lücken sichtbar, alles reinziehbar ── */}
        <Karte i={2} style={{ flex: '0 1 440px', minWidth: 'min(300px, 100%)' }}>
          <Ueberschrift farbe={LEUCHT.puls} rechts="ziehen wie im Kalender (Planen)">Der Tag</Ueberschrift>
          {meldung && <div role="alert" style={{ marginBottom: 8, fontSize: 12.5, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 8, padding: '6px 10px' }}>{meldung}</div>}
          {kal && !kal.icloud && <div style={{ marginBottom: 8, fontSize: 12, color: C.inkLeise }}>Ohne iCloud nur lesen — Blöcke sind Termine im Kalender.</div>}
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Zeitspalte */}
            <div style={{ position: 'relative', height: H, width: 42, flex: '0 0 auto' }}>
              {stunden.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX - 6, right: 6, fontSize: 11, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}:00</div>
              ))}
            </div>
            {/* Tagesspalte */}
            <div onDragOver={e => e.preventDefault()} onDrop={dropAufKalender}
              style={{ position: 'relative', height: H, flex: 1, minWidth: 0, background: 'rgba(255,255,255,.03)', borderRadius: 12, overflow: 'hidden' }}>
              {stunden.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h * 60 - START) * PX, left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,.05)' }} />
              ))}
              {/* Jetzt-Linie */}
              {istHeute && jetztMin !== null && jetztMin >= START && jetztMin <= ENDE && (
                <div style={{ position: 'absolute', top: (jetztMin - START) * PX, left: 0, right: 0, borderTop: `2px solid ${LEUCHT.kritisch}`, boxShadow: `0 0 10px ${LEUCHT.kritisch}33`, zIndex: 3 }}>
                  <span style={{ position: 'absolute', right: 6, top: -15, fontSize: 11, fontWeight: 700, color: LEUCHT.kritisch, fontVariantNumeric: 'tabular-nums' }}>{mm(jetztMin)}</span>
                </div>
              )}
              {/* Feste Termine — unverrückbar */}
              {fix.map((f, i) => (
                <div key={`fix${i}`} style={{ position: 'absolute', top: (f.startMin - START) * PX, height: Math.max(16, f.dauerMin * PX - 2), left: 4, right: 4, background: 'rgba(255,255,255,.08)', borderLeft: `3px solid ${C.inkLeise}`, borderRadius: 8, padding: '2px 8px', fontSize: 11, color: C.inkDim, overflow: 'hidden', zIndex: 1 }}>
                  🔒 {mm(f.startMin)} {f.titel}
                </div>
              ))}
              {/* Bewegliche Blöcke */}
              {meine.map(b => {
                const aktiv = aktivBlock === b.id;
                const farbe = ART_FARBE[b.art] ?? C.inkLeise;
                const aenderbar = bearbeitbar(b);
                return (
                  <div key={b.id} draggable={aenderbar} title={aenderbar ? undefined : b.quelle === 'archiv' ? 'Alter Wochenplan — nur lesen (Kalender › Planen: übernehmen)' : 'Nur in Apple änderbar'}
                    onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ move: b.id }))}
                    onClick={() => aenderbar && setAktivBlock(aktiv ? null : b.id)}
                    style={{ position: 'absolute', top: (b.startMin - START) * PX, height: Math.max(18, b.dauerMin * PX - 2), left: 4, right: 4, background: `${farbe}2A`, borderLeft: `3px solid ${farbe}`, borderRadius: 8, padding: '2px 8px', fontSize: 11.5, color: C.ink, overflow: 'hidden', cursor: 'grab', zIndex: aktiv ? 4 : 2, boxShadow: aktiv ? `0 0 0 1px ${farbe}, 0 0 14px ${farbe}33` : undefined, transition: 'box-shadow .2s ease' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{mm(b.startMin)}</span> {b.titel}
                    {aktiv && (
                      <span style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => void blockSetzen(b, b.startMin, Math.max(15, b.dauerMin - 30))} style={mini(C.inkDim)}>−</button>
                        <button onClick={() => void blockSetzen(b, b.startMin, Math.min(240, b.dauerMin + 30))} style={mini(C.inkDim)}>＋</button>
                        <button onClick={async () => { if (await bestaetigen({ titel: `„${b.titel}“ löschen?`, text: 'Der Termin verschwindet auch in Apple.', ja: 'Löschen', gefahr: true })) { void blockWeg(b); setAktivBlock(null); } }} style={mini(LEUCHT.kritisch)}>✕</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Karte>

        {/* ── Rechte Spalte: Lücken, Bausteine, Aufgaben, Routinen ── */}
        <div style={{ flex: '1 1 320px', minWidth: 'min(290px, 100%)', display: 'grid', gap: 14, alignContent: 'start' }}>
          {/* Tageslücken */}
          <Karte i={3}>
            <Ueberschrift farbe={LEUCHT.puls} rechts="frei ≥30 Min · füllen durch Reinziehen">Tageslücken</Ueberschrift>
            {luecken.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {luecken.map((l, i) => (
                  <Chip key={i} farbe={LEUCHT.puls}>{mm(l.von)}–{mm(l.bis)} · {Math.round((l.bis - l.von) / 15) * 15} min</Chip>
                ))}
              </div>
            ) : (
              <Leer>Keine Lücke ≥30 Min zwischen 07 und 21 Uhr — voller Tag.</Leer>
            )}
          </Karte>

          {/* Bausteine + Aufgaben */}
          <Karte i={4}>
            <Ueberschrift>Bausteine</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {/* Schlüssel ist der Titel, nicht die Art: „block" kommt
                  sechsmal vor — mit `art` verlieren die Bausteine beim
                  Ziehen ihre Identität. */}
              {BAUSTEINE.map(bs => (
                <Ziehbar key={bs.titel} farbe={ART_FARBE[bs.art]} daten={{ neu: { art: bs.art, titel: bs.titel, dauerMin: bs.dauerMin } }}>
                  {bs.titel} · {bs.dauerMin}m
                </Ziehbar>
              ))}
            </div>
            <Ueberschrift rechts={<span>◎ = <Link href="/os/kompass" style={verweis}>im Fokus</Link></span>}>Aufgaben einplanen</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {offeneAufgaben.map(t => (
                <Ziehbar key={t.id} farbe={t.imFokus ? LEUCHT.schlaf : ART_FARBE.aufgabe} daten={{ aufgabe: { taskId: t.id, titel: t.title } }} breit={240}>
                  {t.priority === 'critical' ? '‼ ' : ''}{t.imFokus ? '◎ ' : ''}{t.einheit ? <span style={{ opacity: 0.75 }}>{einheitKurz(t.einheit)} · </span> : null}{t.title}
                </Ziehbar>
              ))}
              {!offeneAufgaben.length && <Leer>Alles eingeplant oder erledigt.</Leer>}
            </div>
          </Karte>

          {/* Routinen heute — Fokus-passende zuerst (◎), dieselben Häkchen wie im Cockpit */}
          <Karte i={5}>
            <Ueberschrift farbe={LEUCHT.gut} rechts={<>
              <span style={{ color: routinenErledigt ? LEUCHT.gut : C.inkLeise, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{routinenErledigt}/{routinen.length}</span>
              <Link href="/os/planung/routinen" style={verweis}>planen ›</Link>
            </>}>Routinen heute</Ueberschrift>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>◎ zahlt auf den Fokus ein · auch in den Tag ziehbar</div>
            {(['morgen', 'tag', 'abend'] as const).map(wann => {
              const eigene = routinen.filter(r => r.wann === wann).sort(sortiertNachFokus);
              if (!eigene.length) return null;
              return (
                <div key={wann} style={{ marginTop: 8 }}>
                  <div style={MIKRO}>{wann === 'morgen' ? 'Morgens' : wann === 'tag' ? 'Tagsüber' : 'Abends'}</div>
                  <Liste>
                    {eigene.map(r => {
                      const done = erledigt.has(r.id);
                      const imFokus = passtZumFokus(r);
                      return (
                        <Zeile key={r.id} onClick={() => toggleRoutine(r.id)}
                          links={<Haken an={done} onChange={() => toggleRoutine(r.id)} farbe={imFokus ? KATEGORIE_FARBE[r.kategorie] ?? LEUCHT.gut : undefined} />}
                          titel={
                            <span draggable
                              onDragStart={e => e.dataTransfer.setData('text/plain', JSON.stringify({ neu: { art: 'routine', titel: r.label, dauerMin: r.dauerMin } }))}
                              style={{ color: done ? C.inkLeise : C.ink, textDecoration: done ? 'line-through' : 'none', cursor: 'grab' }}>
                              {imFokus ? <span style={{ color: KATEGORIE_FARBE[r.kategorie] ?? LEUCHT.gut }}>◎ </span> : ''}{r.label}
                            </span>
                          }
                          rechts={<span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{r.dauerMin} min</span>} />
                      );
                    })}
                  </Liste>
                </div>
              );
            })}
          </Karte>
        </div>
      </div>
      {dialog}
    </Seite>
  );
}
