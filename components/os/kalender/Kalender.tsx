'use client';

// ─── MAKE OS — Kalender (neu, 27.09.) ───────────────────────────────────────
// Kevin: „Der Kalender ist wirklich noch grausig … guck bei Google Kalender,
// wie die das aufgebaut haben.“ Also: Tag · Woche · Monat · Agenda, Heute-
// Knopf und Pfeile, Mini-Monat und Kalender-Schalter links, Suche, Schnell-
// eingabe („Mo 10 Uhr Kaffee mit Anna 45min“), Klick in die Lücke legt an,
// Ziehen verschiebt, Serie und Erinnerung beim Anlegen, Tastatur (t, ←, →,
// d/w/m/a, n). Daten wie bisher: iCloud direkt (lib/kalender), Fristen aus dem
// System, Apple-Erinnerungen, Aufgaben mit Datum. Der Kalender-Agent
// (Konflikte, Schutz-Blöcke) und die Einstellungen sitzen in der Leiste.
// Seit 29.09. (K1, Google-Vorbild): „Erstellen ▾“ mit den Arten (Termin, Aufgabe, Abwesend,
// Fokuszeit, Arbeitsort), Kürzel c, Aufziehen im Raster, Arbeitsort-Leiste, Farbe je Termin.
// Aufgaben kommen aus dem TasksContext (dieselben Aufgaben, mit Uhrzeit an ihrer Zeit).
// Fristen und Aufgaben respektieren Sicht (Kevin/Malin/Gemeinsam) und Bereich (Privat/Business).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { tagPlus, wandAus } from '@/lib/kalender/zeit';
import { montagVon, monatsblatt } from '@/lib/kalender/layout';
import { spaceVonKalender } from '@/lib/kalender/space';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Punkt, Segmente, Chip, feld, LEUCHT, useBreit } from '../schlank';
import { useKalender, TerminFenster, WER_FARBE, WER_LABEL, type KTermin, type Wer } from './teile';
import { Zeitraster } from './Zeitraster';
import { Monat } from './Monat';
import { Agenda } from './Agenda';
import { NeuerTermin, type Vorgabe } from './NeuerTermin';
import { useTermineFinden } from './MitPlanen';
import { suchPasst } from '@/lib/text/such-norm';
// K2 (29.09.): 4 Tage, Jahr, Quellen „Feiertage NRW“ + „Geburtstage“, Zeit-Auswertung.
import { VierTage } from './VierTage';
import { Jahr, useJahr } from './Jahr';
import { useQuellTermine, istQuellTermin, QUELL_KALENDER } from './quellen';
import { AuswertungKarte } from './Auswertung';
import { kalenderwoche } from '@/lib/zeit/kalender-kern';
import { useTasks } from '@/context/TasksContext';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { WEG } from '@/lib/wege';
import { ART_INFO, TERMIN_ARTEN, type TerminArt } from '@/lib/kalender/arten';
import type { RasterAufgabe } from './Zeitraster';
import type { Task } from '@/types/tasks';

type Ansicht = 'tag' | 'vier' | 'woche' | 'monat' | 'jahr' | 'agenda';
const ANSICHTEN: { id: Ansicht; label: string; taste: string }[] = [{ id: 'tag', label: 'Tag', taste: 'd' }, { id: 'vier', label: '4 Tage', taste: 'x' }, { id: 'woche', label: 'Woche', taste: 'w' }, { id: 'monat', label: 'Monat', taste: 'm' }, { id: 'jahr', label: 'Jahr', taste: 'y' }, { id: 'agenda', label: 'Termine', taste: 'a' }];
const MERKER = 'make-os:kalender-ansicht';
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const uhr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const monatPlus = (tag: string, n: number) => { const d = new Date(`${tag.slice(0, 7)}-15T12:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

interface Einstellungen { kalender: Record<Wer, string>; dauer: { termin: number; fokus: number; routine: number; aufgabe: number; reha: number }; space: Record<string, 'privat' | 'business'>; standardSicht?: 'alle' | Wer }
interface Analyse { briefing?: string; conflicts?: { date: string; a: string; b: string; overlap: string }[]; vorschlaege?: { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string }[]; eingetragen?: boolean }
type Bereich = 'alle' | 'privat' | 'business';

/** Gehört eine Aufgabe in die Sicht? Kevin/Malin: verantwortlich oder beteiligt; Gemeinsam: mehr als eine Person. */
function aufgabeInSicht(t: Pick<Task, 'assignee' | 'beteiligte'>, sicht: 'alle' | Wer): boolean {
  if (sicht === 'alle') return true;
  const mehrere = t.assignee === 'both' || (t.beteiligte?.length ?? 0) > 0;
  if (sicht === 'beide') return mehrere;
  return t.assignee === sicht || t.assignee === 'both' || (t.beteiligte ?? []).includes(sicht);
}

/** „Erstellen ▾“ wie Google: Menü der Arten. */
function ErstellenMenue({ onArt, breit }: { onArt: (a: TerminArt) => void; breit: boolean }) {
  const [auf, setAuf] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuf(false); };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-haspopup="menu" aria-expanded={auf} className="fassbar"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: breit ? '10px 18px' : '8px 14px', borderRadius: 14, border: `1px solid ${LEUCHT.puls}80`, background: `${LEUCHT.puls}24`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px -8px rgba(0,0,0,.6)' }}>
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1, color: LEUCHT.puls }}>+</span> Erstellen <span aria-hidden style={{ fontSize: 11, color: C.inkLeise }}>▾</span>
      </button>
      {auf && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, minWidth: 190, display: 'grid', padding: 6, borderRadius: 12, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' }}>
          {TERMIN_ARTEN.map(a => (
            <button key={a} role="menuitem" type="button" onClick={() => { setAuf(false); onArt(a); }} className="fassbar"
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: ART_INFO[a].farbe ?? LEUCHT.puls }} />{ART_INFO[a].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Kalender() {
  const breit = useBreit();
  const router = useRouter();
  const heute = localDay();
  const [ansicht, setAnsichtRoh] = useState<Ansicht>('woche');
  const [anker, setAnker] = useState(heute);
  const [sicht, setSicht] = useState<'alle' | Wer>('alle');
  const [bereich, setBereich] = useState<Bereich>('alle');
  const { state: aufgabenStand } = useTasks();
  const [aus, setAus] = useState<Set<string>>(new Set());
  const [ebenen, setEbenen] = useState<{ fristen: boolean; erinnerungen: boolean; aufgaben: boolean }>({ fristen: true, erinnerungen: true, aufgaben: true });
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<KTermin | null>(null);
  const [neu, setNeu] = useState<Vorgabe | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [einst, setEinst] = useState<Einstellungen | null>(null);
  const [zeigeEinst, setZeigeEinst] = useState(false);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [analysiert, setAnalysiert] = useState(false);
  const [eingetragen, setEingetragen] = useState<Record<number, 'ok' | 'busy' | 'err'>>({});
  const [abgleich, setAbgleich] = useState(false);

  useEffect(() => { try { const a = localStorage.getItem(MERKER) as Ansicht | null; if (a && ANSICHTEN.some(x => x.id === a)) setAnsichtRoh(a); else if (!breit) setAnsichtRoh('tag'); } catch { /* egal */ } }, [breit]);
  const setAnsicht = (a: Ansicht) => { setAnsichtRoh(a); try { localStorage.setItem(MERKER, a); } catch { /* egal */ } };
  useEffect(() => {
    fetch('/api/state/kalender-einstellungen').then(r => r.json()).then((e: Einstellungen) => { setEinst(e); if (e.standardSicht) setSicht(e.standardSicht); }).catch(() => {});
  }, []);
  const einstSetzen = (teil: Partial<Einstellungen>) => { if (!einst) return; const n = { ...einst, ...teil }; setEinst(n); fetch('/api/state/kalender-einstellungen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n), keepalive: true }).catch(() => {}); };
  const standardDauer = einst?.dauer.termin ?? 60;

  // Zeitraum je Ansicht
  const { von, bis, tage, blatt } = useMemo(() => {
    if (ansicht === 'tag') return { von: anker, bis: tagPlus(anker, 1), tage: [anker], blatt: [] as string[] };
    if (ansicht === 'vier') { const t = Array.from({ length: 4 }, (_, i) => tagPlus(anker, i)); return { von: anker, bis: tagPlus(anker, 4), tage: t, blatt: [] as string[] }; }
    // Jahr (K2): die Ansicht lädt ihr Jahr verdichtet selbst (useJahr) — hier nur der Ankertag für Leiste/Mini-Monat.
    if (ansicht === 'jahr') return { von: anker, bis: tagPlus(anker, 1), tage: [anker], blatt: [] as string[] };
    if (ansicht === 'woche') { const mo = montagVon(anker); const t = Array.from({ length: 7 }, (_, i) => tagPlus(mo, i)); return { von: mo, bis: tagPlus(mo, 7), tage: t, blatt: [] as string[] }; }
    if (ansicht === 'monat') { const b = monatsblatt(Number(anker.slice(0, 4)), Number(anker.slice(5, 7))); return { von: b[0], bis: tagPlus(b[41], 1), tage: b, blatt: b }; }
    const t = Array.from({ length: 30 }, (_, i) => tagPlus(anker, i)); return { von: anker, bis: tagPlus(anker, 30), tage: t, blatt: [] as string[] };
  }, [ansicht, anker]);
  const { daten, laedt, laden, setDaten } = useKalender(von, bis);
  // Quellen (K2): Feiertage NRW + Geburtstage — ganztägig, schreibgeschützt, in allen Ansichten; im Jahr das ganze Jahr.
  const jahr = Number(anker.slice(0, 4));
  const quell = useQuellTermine(ansicht === 'jahr' ? `${jahr}-01-01` : von, ansicht === 'jahr' ? `${jahr + 1}-01-01` : bis);
  const jahrDaten = useJahr(ansicht === 'jahr' ? jahr : 0);
  // K4 Termine finden: „Mit … planen“ (Überlagerung + freie Zeiten) und Buchungsseiten — ein Haken (components/os/kalender/MitPlanen.tsx).
  const k4 = useTermineFinden({ alle: daten?.termine, onVorschlag: setNeu });

  const kalFarbe = useCallback((name: string, wer: Wer) => daten?.kalender.find(k => k.name === name)?.farbe ?? WER_FARBE[wer], [daten]);
  const farbe = useCallback((t: KTermin) => (istQuellTermin(t) ? t.farbe : t.farbeEigen ?? kalFarbe(t.kalender, t.wer)), [kalFarbe]);
  const such = suche.trim().toLowerCase();
  const imBereich = useCallback((b: 'privat' | 'business' | undefined) => bereich === 'alle' || !b || b === bereich, [bereich]);
  const termine = useMemo(() => [
    ...(daten?.termine ?? []).filter(t => (sicht === 'alle' || t.wer === sicht) && !aus.has(t.kalender) && imBereich(spaceVonKalender(einst, t.kalender)) && (!such || `${t.titel} ${t.ort ?? ''} ${t.kalender} ${t.notiz ?? ''}`.toLowerCase().includes(such))),
    ...quell.filter(t => !aus.has(t.kalender) && imBereich(t.space) && (!such || `${t.titel} ${t.kalender}`.toLowerCase().includes(such))),
  ], [daten, quell, sicht, aus, such, einst, imBereich]);
  // Klick auf einen Quell-Eintrag öffnet nie das Termin-Fenster: Geburtstag → Person/Kontaktakte, Feiertag → nichts.
  const oeffnen = (t: KTermin) => { if (istQuellTermin(t)) { if (t.href) router.push(t.href); return; } setOffen(t); };
  const jahrKalender = jahrDaten?.kalender;
  const kalenderAn = useCallback((name: string) => { if (aus.has(name)) return false; if (sicht === 'alle') return true; const w = jahrKalender?.find(k => k.name === name)?.wer; return !w || w === sicht; }, [aus, sicht, jahrKalender]);
  const kalenderFarbe = useCallback((name: string) => { const k = jahrKalender?.find(x => x.name === name); return k?.farbe ?? WER_FARBE[k?.wer ?? 'beide']; }, [jahrKalender]);
  // Fristen gehören dem Haushalt: in „Alle“ und „Gemeinsam“, gefiltert nach Bereich (KALENDER_VERBINDUNGEN.md 4i).
  const fristenSichtbar = sicht === 'alle' || sicht === 'beide';
  const fristen = useMemo(() => (!fristenSichtbar ? [] : (ebenen.fristen && !such ? daten?.fristen ?? [] : (daten?.fristen ?? []).filter(f => such && f.titel.toLowerCase().includes(such))).filter(f => imBereich(f.bereich))), [daten, ebenen.fristen, such, fristenSichtbar, imBereich]);
  const erinnerungen = useMemo(() => (ebenen.erinnerungen && !such ? daten?.erinnerungen ?? [] : (daten?.erinnerungen ?? []).filter(e => such && e.titel.toLowerCase().includes(such))), [daten, ebenen.erinnerungen, such]);
  const aufgabenImZeitraum = useMemo<RasterAufgabe[]>(() => (ebenen.aufgaben ? aufgabenStand.tasks : [])
    .filter(a => a.dueDate && a.dueDate.slice(0, 10) >= von && a.dueDate.slice(0, 10) < bis && a.status !== 'done' && a.status !== 'cancelled' && aufgabeInSicht(a, sicht) && imBereich(spaceVonAufgabe(a)) && (!such || suchPasst([a.title], such)))
    .map(a => ({ id: a.id, title: a.title, done: false, priority: a.priority, tag: a.dueDate!.slice(0, 10), ...(a.dueTime ? { zeit: a.dueTime } : {}) })), [aufgabenStand.tasks, ebenen.aufgaben, von, bis, such, sicht, imBereich]);
  const neuVon = (art: TerminArt, tag = ansicht === 'tag' ? anker : heute): Vorgabe => ({ tag, art, ...(art === 'abwesend' || art === 'arbeitsort' ? { ganztags: true } : { von: '09:00' }), ...(sicht === 'kevin' || sicht === 'malin' || sicht === 'beide' ? { wer: sicht } : {}), ...(bereich === 'business' ? { spaceId: 'kdc' } : {}) });
  const neuImRaster = (tag: string, m: number, ende?: number) => setNeu({ ...neuVon('termin', tag), von: uhr(m), bis: uhr(Math.min(23 * 60 + 59, ende ?? m + standardDauer)) });
  const arbeitsortNeu = (tag: string, wer: Wer) => setNeu({ tag, art: 'arbeitsort', ganztags: true, wer });

  // Navigation
  const springe = (richtung: -1 | 1) => setAnker(a => ansicht === 'tag' ? tagPlus(a, richtung) : ansicht === 'vier' ? tagPlus(a, 4 * richtung) : ansicht === 'woche' ? tagPlus(a, 7 * richtung) : ansicht === 'monat' ? monatPlus(a, richtung) : ansicht === 'jahr' ? monatPlus(a, 12 * richtung) : tagPlus(a, 30 * richtung));
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't') setAnker(localDay());
      else if (e.key === 'ArrowLeft') springe(-1);
      else if (e.key === 'ArrowRight') springe(1);
      else if (e.key === 'n' || e.key === 'c') setNeu(neuVon('termin'));
      else { const a = ANSICHTEN.find(x => x.taste === e.key); if (a) setAnsicht(a.id); else return; }
      e.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [ansicht, anker, heute, sicht, bereich]); // eslint-disable-line react-hooks/exhaustive-deps

  const titel = ansicht === 'tag' ? `${WD[new Date(`${anker}T12:00:00`).getDay()]}, ${Number(anker.slice(8, 10))}. ${MONATE[Number(anker.slice(5, 7)) - 1]} ${anker.slice(0, 4)}`
    : ansicht === 'woche' ? `KW ${kalenderwoche(tage[0])} · ${Number(tage[0].slice(8, 10))}.${Number(tage[0].slice(5, 7))}. – ${Number(tage[6].slice(8, 10))}.${Number(tage[6].slice(5, 7))}.${tage[6].slice(0, 4)}`
    : ansicht === 'vier' ? `${Number(tage[0].slice(8, 10))}.${Number(tage[0].slice(5, 7))}. – ${Number(tage[3].slice(8, 10))}.${Number(tage[3].slice(5, 7))}.${tage[3].slice(0, 4)}`
    : ansicht === 'jahr' ? `${jahr}`
    : ansicht === 'monat' ? `${MONATE[Number(anker.slice(5, 7)) - 1]} ${anker.slice(0, 4)}` : `Nächste 30 Tage ab ${Number(anker.slice(8, 10))}.${Number(anker.slice(5, 7))}.`;

  // Schreiben
  const verschieben = async (t: KTermin, tag: string, startMin: number, endeMin: number) => {
    const start = wandAus(tag, startMin), ende = wandAus(tag, endeMin);
    setDaten(d => (d ? { ...d, termine: d.termine.map(x => (x.uid === t.uid ? { ...x, start, ende } : x)) } : d));
    // Mit Stand (ETag): woanders geändert → 409 statt still überschreiben; der Termin springt beim Neuladen zurück.
    const r = await fetch('/api/kalender/termin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: t.uid, start, ende, ...(t.stand ? { stand: t.stand } : {}) }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) setMeldung(r.fehler ?? 'Nicht verschoben.'); else setMeldung(null);
    void laden();
  };
  const jetztAbgleichen = async () => { setAbgleich(true); const r = await fetch('/api/kalender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'abgleichen' }) }).then(x => x.json()).catch(() => ({ ok: false })); if (!r.ok && r.fehler) setMeldung(r.fehler); await laden(); setAbgleich(false); };
  const analysieren = async () => {
    setAnalysiert(true); setEingetragen({});
    const wochenTage = Array.from({ length: 8 }, (_, i) => tagPlus(heute, i));
    const events = (daten?.termine ?? []).filter(t => wochenTage.includes(t.start.slice(0, 10))).map(t => ({ id: t.id, title: t.titel, startDate: t.start, endDate: t.ende, allDay: t.ganztags, calendarName: t.kalender, location: t.ort }));
    const d: Analyse = await fetch('/api/kalender/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, today: heute }) }).then(r => r.json()).catch(() => ({ briefing: 'Analyse gerade nicht möglich.' }));
    setAnalyse(d); setAnalysiert(false);
    if (d.eingetragen) { setEingetragen(Object.fromEntries((d.vorschlaege ?? []).map((_, i) => [i, 'ok' as const]))); void laden(); }
  };
  const blockEintragen = async (b: NonNullable<Analyse['vorschlaege']>[number], i: number) => {
    setEingetragen(e => ({ ...e, [i]: 'busy' }));
    const startMin = b.startHour * 60 + (b.startMin ?? 0);
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: b.title, kalender: b.calendar, start: wandAus(b.date, startMin), ende: wandAus(b.date, startMin + b.durationMin) }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setEingetragen(e => ({ ...e, [i]: r.ok ? 'ok' : 'err' }));
    if (r.ok) void laden(); else if (r.fehler) setMeldung(r.fehler);
  };

  // Mini-Monat (Leiste)
  const miniBlatt = useMemo(() => monatsblatt(Number(anker.slice(0, 4)), Number(anker.slice(5, 7))), [anker]);
  const tageMitTermin = useMemo(() => new Set((daten?.termine ?? []).map(t => t.start.slice(0, 10))), [daten]);
  const sichten: { id: 'alle' | Wer; label: string }[] = [{ id: 'alle', label: 'Alle' }, { id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Gemeinsam' }];
  const quelleText = daten?.quelle === 'icloud' ? `iCloud${daten.konto ? ` · ${daten.konto}` : ''}` : daten?.quelle === 'mac' ? 'Stand vom Mac (nur lesen)' : 'noch keine Quelle';

  const leiste = (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      {breit && <div><ErstellenMenue breit onArt={a => setNeu(neuVon(a))} /></div>}
      <Karte i={1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={() => setAnker(a => monatPlus(a, -1))} aria-label="Vormonat" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 16 }}>‹</button>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14 }}>{MONATE[Number(anker.slice(5, 7)) - 1]} {anker.slice(0, 4)}</span>
          <button onClick={() => setAnker(a => monatPlus(a, 1))} aria-label="Folgemonat" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 16 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
          {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((w, i) => <span key={i} style={{ fontSize: 11, color: C.inkLeise }}>{w}</span>)}
          {miniBlatt.map(tag => { const im = tag.slice(0, 7) === anker.slice(0, 7); const gew = ansicht === 'tag' ? tag === anker : ansicht === 'woche' || ansicht === 'vier' ? tage.includes(tag) : false; return (
            <button key={tag} onClick={() => { setAnker(tag); if (ansicht === 'monat' || ansicht === 'agenda' || ansicht === 'jahr') setAnsicht('tag'); }} style={{ position: 'relative', border: 'none', borderRadius: 7, padding: '4px 0', fontSize: 11.5, cursor: 'pointer', fontFamily: SCHRIFT.text,
              background: tag === heute ? LEUCHT.puls : gew ? 'rgba(255,255,255,.08)' : 'transparent', color: tag === heute ? '#0b0b0c' : im ? C.ink : C.inkLeise, fontWeight: tag === heute ? 700 : 500 }}>
              {Number(tag.slice(8, 10))}{tageMitTermin.has(tag) && tag !== heute && <span style={{ position: 'absolute', left: '50%', bottom: 1, width: 3, height: 3, borderRadius: '50%', background: LEUCHT.puls, transform: 'translateX(-50%)' }} />}
            </button>
          ); })}
        </div>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Sicht</Ueberschrift>
        <Segmente liste={sichten} aktiv={sicht} onWahl={setSicht} />
        <div style={{ marginTop: 8 }}><Segmente liste={[{ id: 'alle', label: 'Alles' }, { id: 'privat', label: 'Privat' }, { id: 'business', label: 'Business' }] as { id: Bereich; label: string }[]} aktiv={bereich} onWahl={setBereich} /></div>
        <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
          {(daten?.kalender ?? []).map(k => (
            <label key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: aus.has(k.name) ? C.inkLeise : C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!aus.has(k.name)} onChange={() => setAus(s => { const n = new Set(s); if (n.has(k.name)) n.delete(k.name); else n.add(k.name); return n; })} />
              <span style={{ width: 10, height: 10, borderRadius: 3, background: k.farbe ?? WER_FARBE[k.wer] }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.inkLeise }}>{WER_LABEL[k.wer]}{k.schreibbar ? '' : ' · 🔒'}</span>
            </label>
          ))}
          {!daten?.kalender.length && <span style={{ fontSize: 12, color: C.inkLeise }}>Noch keine Kalender geladen.</span>}
          {QUELL_KALENDER.map(k => (
            <label key={k.name} title={k.hinweis} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: aus.has(k.name) ? C.inkLeise : C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!aus.has(k.name)} onChange={() => setAus(s => { const n = new Set(s); if (n.has(k.name)) n.delete(k.name); else n.add(k.name); return n; })} />
              <span style={{ width: 10, height: 10, borderRadius: 3, background: k.farbe }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.inkLeise }}>🔒</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {([['fristen', 'Fristen', LEUCHT.agenten], ['erinnerungen', 'Erinnerungen', LEUCHT.schlaf], ['aufgaben', 'Aufgaben', LEUCHT.achtung]] as const).map(([id, label, f]) => (
            <button key={id} onClick={() => setEbenen(e => ({ ...e, [id]: !e[id] }))} style={{ border: `1px solid ${ebenen[id] ? f : 'rgba(255,255,255,.1)'}`, background: ebenen[id] ? `${f}22` : 'transparent', color: ebenen[id] ? f : C.inkLeise, borderRadius: 999, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer', fontFamily: SCHRIFT.text }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 10 }}>{quelleText}{daten?.stand ? ` · Stand ${new Date(daten.stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}{daten?.fehler ? ` · ${daten.fehler}` : ''}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {daten?.icloud && <Knopf leise aus={abgleich} onClick={() => void jetztAbgleichen()}>{abgleich ? 'gleicht ab …' : '↻ Mit iCloud abgleichen'}</Knopf>}
          <Link href="/os/planung/woche" style={{ fontSize: 12, color: C.inkDim, alignSelf: 'center' }}>Wochenplaner (Blöcke) ›</Link>
        </div>
      </Karte>
      {k4.karten}
      <Karte i={3} akzent={analyse?.conflicts?.length ? LEUCHT.kritisch : undefined}>
        <Ueberschrift rechts={<Knopf leise aus={analysiert || !daten} onClick={() => void analysieren()}>{analysiert ? 'analysiert …' : 'Woche prüfen'}</Knopf>}>Kalender-Agent</Ueberschrift>
        {!analyse && <div style={{ fontSize: 12.5, color: C.inkDim }}>Konflikte finden, Reha- und Fokus-Blöcke in freie Lücken vorschlagen — eintragen tust du.</div>}
        {analyse?.briefing && <div style={{ fontSize: TYP.bedien, lineHeight: 1.55, marginBottom: 8 }}>{analyse.briefing}</div>}
        {!!analyse?.conflicts?.length && <Liste>{analyse.conflicts.map((c, i) => <Zeile key={i} links={<Punkt farbe={LEUCHT.kritisch} />} titel={<><b>{c.a}</b> ⨯ <b>{c.b}</b></>} unter={`${c.date} · ${c.overlap}`} />)}</Liste>}
        {!!analyse?.vorschlaege?.length && (
          <Liste>
            {analyse.vorschlaege.map((b, i) => <Zeile key={i} links={<Punkt farbe={LEUCHT.schlaf} />} titel={b.title} unter={`${b.date} · ${String(b.startHour).padStart(2, '0')}:${String(b.startMin ?? 0).padStart(2, '0')} · ${b.durationMin} Min · ${b.calendar}${b.grund ? ` · ${b.grund}` : ''}`}
              rechts={<Knopf leise={eingetragen[i] === 'ok'} aus={eingetragen[i] === 'busy' || eingetragen[i] === 'ok'} farbe={eingetragen[i] === 'err' ? LEUCHT.kritisch : LEUCHT.schlaf} onClick={() => void blockEintragen(b, i)}>{eingetragen[i] === 'ok' ? '✓' : eingetragen[i] === 'busy' ? '…' : eingetragen[i] === 'err' ? 'Fehler' : 'Eintragen'}</Knopf>} />)}
          </Liste>
        )}
      </Karte>
      <AuswertungKarte stichtag={ansicht === 'woche' || ansicht === 'vier' || ansicht === 'tag' ? anker : heute} i={4} />
      <Karte i={5}>
        <Ueberschrift rechts={<Knopf leise onClick={() => setZeigeEinst(v => !v)}>{zeigeEinst ? 'zu' : 'öffnen'}</Knopf>}>Einstellungen</Ueberschrift>
        {zeigeEinst && einst && (
          <div style={{ display: 'grid', gap: 10 }}>
            {(['kevin', 'malin', 'beide'] as Wer[]).map(w => (
              <label key={w} style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12, color: C.inkLeise }}>Kalender {WER_LABEL[w]}</span>
                <input value={einst.kalender[w]} onChange={e => einstSetzen({ kalender: { ...einst.kalender, [w]: e.target.value } })} placeholder="Name wie in der Kalender-App" style={{ ...feld, fontSize: 13 }} /></label>
            ))}
            <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12, color: C.inkLeise }}>Standarddauer Termin (Min.)</span>
              <input type="number" min={5} max={600} step={5} value={einst.dauer.termin} onChange={e => einstSetzen({ dauer: { ...einst.dauer, termin: Number(e.target.value) || 60 } })} style={{ ...feld, width: 100, fontSize: 13 }} /></label>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: C.inkLeise }}>Kalender → Space</span>
              {(daten?.kalender ?? []).map(k => { const sp = spaceVonKalender(einst, k.name); return (
                <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <span style={{ flex: 1, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
                  {(['privat', 'business'] as const).map(s => <button key={s} onClick={() => einstSetzen({ space: { ...einst.space, [k.name]: s } })} style={{ border: `1px solid ${sp === s ? SPACE_FARBE[s] : 'rgba(255,255,255,.1)'}`, background: sp === s ? `${SPACE_FARBE[s]}22` : 'transparent', color: sp === s ? SPACE_FARBE[s] : C.inkLeise, borderRadius: 999, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>{s === 'privat' ? 'Privat' : 'Business'}</button>)}
                </div>
              ); })}
            </div>
            <div style={{ fontSize: 11.5, color: C.inkLeise }}>Namen müssen genau so heißen wie in der Kalender-App. iCloud verbinden: System › Konto.</div>
          </div>
        )}
      </Karte>
    </div>
  );

  const haupt = (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, minHeight: 0, minWidth: 0, height: breit ? 'calc(100vh - 190px)' : undefined }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => setAnker(heute)}>Heute</Knopf>
        <button onClick={() => springe(-1)} aria-label="zurück" style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 9, color: C.ink, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>‹</button>
        <button onClick={() => springe(1)} aria-label="weiter" style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 9, color: C.ink, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>›</button>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', marginRight: 'auto' }}>{titel}{laedt && <span style={{ fontSize: 11, color: C.inkLeise, fontWeight: 400, marginLeft: 8 }}>lädt …</span>}</span>
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen …" aria-label="Termine suchen" style={{ ...feld, width: breit ? 180 : '100%', fontSize: 13, padding: '7px 11px' }} />
        {/* Sechs Ansichten passen am Handy nicht nebeneinander — die Leiste rollt statt die Seite zu verbreitern. */}
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}><Segmente liste={ANSICHTEN.map(a => ({ id: a.id, label: a.label }))} aktiv={ansicht} onWahl={setAnsicht} /></div>
        {!breit && <ErstellenMenue breit={false} onArt={a => setNeu(neuVon(a))} />}
      </div>
      <div style={{ minHeight: 0 }}>
        {(ansicht === 'tag' || ansicht === 'woche') && (
          <Zeitraster tage={tage} heute={heute} termine={k4.raster(termine)} fristen={fristen} erinnerungen={erinnerungen} aufgaben={aufgabenImZeitraum} aufgabeDauer={einst?.dauer.aufgabe ?? 30} farbe={k4.farbe(farbe)}
            onOeffnen={t => { if (!k4.oeffnen(t)) oeffnen(t); }} onNeu={neuImRaster} onVerschieben={verschieben} onAufgabe={id => router.push(WEG.aufgabe(id))} onArbeitsortNeu={arbeitsortNeu} />
        )}
        {ansicht === 'vier' && (
          <VierTage start={anker} heute={heute} termine={termine} fristen={fristen} erinnerungen={erinnerungen} aufgaben={aufgabenImZeitraum} aufgabeDauer={einst?.dauer.aufgabe ?? 30} farbe={farbe}
            onOeffnen={oeffnen} onNeu={neuImRaster} onVerschieben={verschieben} onAufgabe={id => router.push(WEG.aufgabe(id))} onArbeitsortNeu={arbeitsortNeu} />
        )}
        {ansicht === 'monat' && <Monat blatt={blatt} monat={Number(anker.slice(5, 7))} heute={heute} termine={termine.filter(t => t.art !== 'arbeitsort')} fristen={fristen} erinnerungen={erinnerungen} farbe={farbe} onTag={tag => { setAnker(tag); setAnsicht('tag'); }} onOeffnen={oeffnen} />}
        {ansicht === 'jahr' && <Jahr jahr={jahr} heute={heute} daten={jahrDaten} quellen={quell.filter(t => !aus.has(t.kalender))} kalenderAn={kalenderAn} farbe={kalenderFarbe} onTag={tag => { setAnker(tag); setAnsicht('tag'); }} />}
        {ansicht === 'agenda' && <Karte i={0}><Agenda tage={tage} heute={heute} termine={termine} fristen={fristen} erinnerungen={erinnerungen} farbe={farbe} suche={such} onOeffnen={oeffnen} /></Karte>}
      </div>
    </div>
  );

  return (
    <Seite titel="Kalender" unter="Tag, 4 Tage, Woche, Monat, Jahr, Termine — iCloud direkt, dazu Feiertage NRW, Geburtstage, Fristen, Erinnerungen und Aufgaben mit Datum. Tastatur: t heute · ← → blättern · d/x/w/m/y/a Ansicht · c erstellen." rechts={<Chip farbe={LEUCHT.puls}>{daten?.icloud ? 'iCloud · live' : 'nur lesen'}</Chip>}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}>{meldung}<button onClick={() => setMeldung(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>}
      {!daten && !laedt && <Leer>Kalender wird geladen …</Leer>}
      <div style={{ display: 'grid', gridTemplateColumns: breit ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {breit && leiste}
        {haupt}
        {!breit && leiste}
      </div>
      {offen && <TerminFenster key={offen.id} termin={offen} icloud={daten?.icloud ?? false} space={spaceVonKalender(einst, offen.kalender)} kalenderFarbe={kalFarbe(offen.kalender, offen.wer)} onZu={() => setOffen(null)} onGespeichert={() => void laden()} />}
      {neu && <NeuerTermin vorgabe={neu} heute={heute} standardDauer={standardDauer} fokusDauer={einst?.dauer.fokus ?? 90} kalender={daten?.kalender ?? []} kalenderStandard={einst?.kalender} onZu={() => setNeu(null)} onAngelegt={x => { if (x.uid) void laden(); }} />}
    </Seite>
  );
}
