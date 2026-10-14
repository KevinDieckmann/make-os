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
// Seit 29.09. (K5, Kevin: „Ein Kalender, Planen als Modus“): Modus „Planen“ (`?modus=planen`, Taste p) — der frühere
// Wochenplaner im selben Raster (components/os/kalender/Planen.tsx); Blöcke sind Termine der Art Fokus/Block.
// Adresse: `?modus=planen`, `?tag=YYYY-MM-DD` (Woche/Tag dorthin), `?space=privat|business` (Bereich).
// Umschalter oben rechts (Kevin 29.09., wie Google): Kalender | Aufgaben (`?modus=aufgaben`, Taste k bzw. u) — Aufgaben
// nach Fälligkeit (AufgabenModus.tsx). Planen gehört zur Kalender-Seite; Aufgaben schließt Planen aus (lib/kalender/modus.ts).
// Seit 09.10. (Kevin: „Kalender links einklappbar … dann hat er ausreichend Platz“): die linke Spalte klappt ein — Knopf neben
// „Erstellen“, ⌘B/Strg+B, je Browser gemerkt; zugeklappt „Spalte öffnen“ + kleines „Erstellen“ vorne in der Kopfzeile. Nur breit (nebeneinander);
// Planen öffnet eine zugeklappte Spalte (die Bausteine stehen dort). Regeln rein in ./klappen.ts.
// Seit 09.10. (Kevin: „mit 2 Fingern nach links wischen = nächste Woche, nach rechts zurück“): Wischen blättert in Tag/4 Tage/Woche/Monat —
// Trackpad mit zwei Fingern, am Handy ein Finger auf der Kopfzeile der Tage; dieselbe Funktion wie die Pfeile. Regeln rein in ./wischen.ts.
// Seit 10.10. (Kevin: „Den Kalender überall in der Ansicht anpassen — nicht gut zu sehen, nicht gut zu scrollen, man sieht einfach nichts, im
// Vergleich zu Google“): der Kalender füllt den Bildschirm (`useVolleHoehe` — Raster und linke Spalte rollen je in sich, nicht die Seite);
// EINE schlanke Kopfzeile (Heute ‹ › · Zeitraum „5.–11. Okt. 2026 · KW 41“ · Abgleich als Punkte · Suche als Symbol · Ansicht · Kalender/Planen ·
// Kalender|Aufgaben · Darstellung), kein Seitenkopf darüber (der Titel bleibt für Vorleser). Darstellung je Gerät (./darstellung.tsx): Zeilenhöhe,
// Zoom (Strg/⌘ + Rad bzw. Pinch im Raster), „Aufgaben ohne Uhrzeit anzeigen“, Bedienungshilfe. Am Handy heißt „4 Tage“ „3 Tage“.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Blocks, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { tagPlus, wandAus } from '@/lib/kalender/zeit';
import { montagVon, monatsblatt } from '@/lib/kalender/layout';
import { spaceVonKalender } from '@/lib/kalender/space';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { Erklaert, Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, SymbolKnopf, Punkt, Segmente, feld, LEUCHT, useBreit, useHandy, FlussKarte } from '../ui';
import { useKalender, TerminFenster, WER_FARBE, useWerLabel, type KTermin, type Wer } from './teile';
import { Zeitraster } from './Zeitraster';
import { Monat } from './Monat';
import { Agenda } from './Agenda';
import { NeuerTermin, type Vorgabe } from './NeuerTermin';
import { useTermineFinden } from './MitPlanen';
// K2 (29.09.): 4 Tage, Jahr, Quellen „Feiertage NRW“ + „Geburtstage“, Zeit-Auswertung.
import { VierTage } from './VierTage';
import { Jahr, useJahr } from './Jahr';
import { useQuellTermine, istQuellTermin, QUELL_KALENDER } from './quellen';
import { AuswertungKarte } from './Auswertung';
import { useTasks } from '@/context/TasksContext';
import { ART_INFO, TERMIN_ARTEN, type TerminArt } from '@/lib/kalender/arten';
// K3 (30.09.): Aufgaben abhaken/einplanen/„Ohne Termin“ und Termin aus der Adresse öffnen (Akten im CRM).
import { aufgabenFuerKalender, ohneTermin, type KalenderAufgabe } from '@/lib/kalender/aufgaben';
import { useAufgabenImKalender, OhneTerminListe } from './aufgaben';
import { useTerminAusAdresse } from './verknuepfen';
import { useIch } from '../aufgaben/hilfe';
// R-K2 (29.09.): Suche mit Umlaut-Faltung (#94), Verschieben mit „Rückgängig“ (#92), belegt/freie Tage (#69/#72).
import { suchPasst } from '@/lib/text/such-norm';
import { useVerschieben } from './verschieben';
import { EinstellungenBelegt } from './EinstellungenBelegt';
import { useArbeitsrahmen, BusinessFreiLink } from '../arbeitsrahmen/BusinessFrei';
import { AbgleichPunkte, type AbgleichQuelle } from './AbgleichStand';
import { DarstellungKnopf, kalenderDarstellungAendern, useKalenderDarstellung, useVolleHoehe } from './darstellung';
import { arbeitsbeginnAus, pxJeMinute, zeitraumText, zoomMal } from '@/lib/kalender/darstellung';
import { GoogleVerbindung } from './GoogleVerbindung';
import { IcloudVerbindung } from './IcloudVerbindung';
import { BereichVerbindungen } from './VerbindenKarten';
import type { FreierTag } from '@/lib/kalender/freie-tage';
import { usePlanen, istArchivTermin, blockFarbe } from './Planen';
import { icsVonPlanArt, planArtAusTitel } from '@/lib/planung/bloecke';
import { AufgabenModus, type AufgabenModusFilter } from './AufgabenModus';
import { KalenderAufgabenSchalter } from '../KalenderAufgabenSchalter';
import { mehrereTage, mehrereTageLabel, modusAusAdresse, startAnsicht, type Modus, type KalenderAnsicht } from '@/lib/kalender/modus';
import { useSpace } from '@/hooks/useSpace';
import { BUSINESS_GESELLSCHAFTEN } from '@/lib/einheiten';
import { LINKS_ID, LINKS_TASTE, linksOffenLesen, linksOffenMerken, linksSichtbar, linksTaste, oeffnenFuerPlanen } from './klappen';
import { useKalenderWischen, wischenAktiv } from './wischen';

type Ansicht = KalenderAnsicht;
/** Ansichten mit Zeitraster — nur dort lässt sich planen. */
const MIT_RASTER: readonly Ansicht[] = ['tag', 'vier', 'woche'];
const ANSICHTEN: { id: Ansicht; label: string; taste: string }[] = [{ id: 'tag', label: 'Tag', taste: 'd' }, { id: 'vier', label: '4 Tage', taste: 'x' }, { id: 'woche', label: 'Woche', taste: 'w' }, { id: 'monat', label: 'Monat', taste: 'm' }, { id: 'jahr', label: 'Jahr', taste: 'y' }, { id: 'agenda', label: 'Termine', taste: 'a' }];
const MERKER = 'make-os:kalender-ansicht';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const uhr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const monatPlus = (tag: string, n: number) => { const d = new Date(`${tag.slice(0, 7)}-15T12:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

interface Einstellungen { /** Google (03.10.): Kalendername → Person — nur gelesen, nie gespeichert. */ google?: Record<string, string>; kalender: Record<Wer, string>; dauer: { termin: number; fokus: number; routine: number; aufgabe: number; reha: number }; space: Record<string, 'privat' | 'business'>; standardSicht?: 'alle' | Wer; belegt?: Record<string, boolean>; freieTage?: FreierTag[] }
interface Analyse { briefing?: string; conflicts?: { date: string; a: string; b: string; overlap: string }[]; vorschlaege?: { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string }[]; /** R-Z (29.09.): Vorschläge liegen als Freigabe im ZOE-Stapel (Gruppe „Kalender“) — nie autonom eingetragen. */ gestapelt?: number }
type Bereich = 'alle' | 'privat' | 'business';


/** Klappmenü am Knopf: Klick daneben oder Esc schließt (Erstellen, Ansicht). */
function useKlappMenue() {
  const [auf, setAuf] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuf(false); };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  return { auf, setAuf, box };
}
const MENUE: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', zIndex: 40, minWidth: 190, display: 'grid', padding: 6, borderRadius: 12, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' };
const MENUE_ZEILE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'transparent', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' };

/** „Erstellen ▾“ wie Google: Menü der Arten. `kompakt` (Handy, 10.10.): nur „+“ — die Kopfzeile passt so in zwei Zeilen. */
function ErstellenMenue({ onArt, breit, kompakt }: { onArt: (a: TerminArt) => void; breit: boolean; kompakt?: boolean }) {
  const { auf, setAuf, box } = useKlappMenue();
  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-haspopup="menu" aria-expanded={auf} aria-label={kompakt ? 'Erstellen' : undefined} title={kompakt ? 'Erstellen (c)' : undefined} className="fassbar"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, minWidth: kompakt ? 44 : undefined, padding: kompakt ? 0 : breit ? '10px 18px' : '8px 14px', borderRadius: 14, border: `1px solid ${LEUCHT.puls}80`, background: `${LEUCHT.puls}24`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px -8px rgba(0,0,0,.6)' }}>
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1, color: LEUCHT.puls }}>+</span>{!kompakt && <> Erstellen <span aria-hidden style={{ fontSize: TYP.bedien, color: C.inkLeise }}>▾</span></>}
      </button>
      {auf && (
        <div role="menu" style={{ ...MENUE, ...(kompakt ? { right: 0 } : { left: 0 }) }}>
          {TERMIN_ARTEN.map(a => (
            <button key={a} role="menuitem" type="button" onClick={() => { setAuf(false); onArt(a); }} className="fassbar" style={MENUE_ZEILE}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: ART_INFO[a].farbe ?? LEUCHT.puls }} />{ART_INFO[a].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ansicht als Menü „Woche ▾“ (10.10., wie Google) — für die schmale Kopfzeile; breit stehen die Segmente. Mit den Tasten (d · x · w · m · y · a). */
function AnsichtMenue({ liste, aktiv, onWahl }: { liste: readonly { id: Ansicht; label: string; taste: string }[]; aktiv: Ansicht; onWahl: (a: Ansicht) => void }) {
  const { auf, setAuf, box } = useKlappMenue();
  const jetzt = liste.find(a => a.id === aktiv) ?? liste[0];
  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-haspopup="menu" aria-expanded={auf} aria-label={`Ansicht: ${jetzt?.label ?? ''} — wechseln`} className="fassbar"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {jetzt?.label}<span aria-hidden style={{ color: C.inkLeise }}>▾</span>
      </button>
      {auf && (
        <div role="menu" style={{ ...MENUE, right: 0, minWidth: 170 }}>
          {liste.map(a => (
            <button key={a.id} role="menuitemradio" aria-checked={a.id === aktiv} type="button" onClick={() => { setAuf(false); onWahl(a.id); }} className="fassbar"
              style={{ ...MENUE_ZEILE, fontWeight: a.id === aktiv ? 700 : 500, background: a.id === aktiv ? 'rgba(255,255,255,.06)' : 'transparent' }}>
              {a.label}<span aria-hidden style={{ marginLeft: 'auto', color: C.inkLeise, fontSize: TYP.bedien }}>{a.taste}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Kalender() {
  const WER_LABEL = useWerLabel(); // Namen der Fächer aus den Konten (14.10., Abnahme A1) — nie fest im Code
  const breit = useBreit();
  const handy = useHandy();
  const router = useRouter();
  // Darstellung je Gerät (10.10.): Zeilenhöhe × Zoom, Aufgaben ohne Uhrzeit, Bedienungshilfe; am Handy „3 Tage“ statt 4.
  const darstellung = useKalenderDarstellung();
  const px = pxJeMinute(darstellung);
  const nTage = mehrereTage(handy);
  const ansichten = useMemo(() => ANSICHTEN.map(a => (a.id === 'vier' ? { ...a, label: mehrereTageLabel(handy) } : a)), [handy]);
  // Volle Höhe (10.10.): der Kalender reicht bis zum unteren Fensterrand, Raster und linke Spalte rollen in sich.
  const flaeche = useRef<HTMLDivElement>(null);
  const hoehe = useVolleHoehe(flaeche);
  const [sucheOffen, setSucheOffen] = useState(false);
  const sucheFeld = useRef<HTMLInputElement>(null);
  const heute = localDay();
  const [ansicht, setAnsichtRoh] = useState<Ansicht>('woche');
  const [anker, setAnker] = useState(heute);
  const [sicht, setSicht] = useState<'alle' | Wer>('alle');
  const [bereich, setBereich] = useState<Bereich>('alle');
  // Der Schalter im Kopf wählt den Bereich (seit 09.10. nur Privat · Business); im Kalender bleibt er umschaltbar — auch auf „Alles“.
  const { filter: kopfBereich } = useSpace();
  useEffect(() => { setBereich(kopfBereich); }, [kopfBereich]);
  const { state: aufgabenStand } = useTasks();
  const [aus, setAus] = useState<Set<string>>(new Set());
  const [ebenen, setEbenen] = useState<{ fristen: boolean; erinnerungen: boolean; aufgaben: boolean }>({ fristen: true, erinnerungen: true, aufgaben: true });
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<KTermin | null>(null);
  const [neu, setNeu] = useState<Vorgabe | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [einst, setEinst] = useState<Einstellungen | null>(null);
  const [zeigeEinst, setZeigeEinst] = useState(false);
  // Linke Spalte (09.10.): je Browser gemerkt, Vorgabe offen — gelesen nach dem ersten Zeichnen (Server kennt den Speicher nicht).
  const [linksOffen, setLinksOffen] = useState(true);
  useEffect(() => { setLinksOffen(linksOffenLesen()); }, []);
  const linksUmschalten = (offen?: boolean) => { const n = offen ?? !linksOffen; setLinksOffen(n); linksOffenMerken(n); };
  // Rückkehr von Google (?google=…) oder aus den Einstellungen (?einstellungen=1, 08.10.): die Einstellungen öffnen — sie stehen in der
  // linken Spalte, also auch diese (nur für den Moment, nicht gemerkt).
  useEffect(() => { try { const a = new URLSearchParams(window.location.search); if (a.has('google') || a.get('einstellungen') === '1') { setZeigeEinst(true); setLinksOffen(true); } } catch { /* ohne Adresse */ } }, []);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [analysiert, setAnalysiert] = useState(false);
  const [eingetragen, setEingetragen] = useState<Record<number, 'ok' | 'busy' | 'err'>>({});
  const [abgleich, setAbgleich] = useState(false);
  const [modus, setModusRoh] = useState<Modus>('kalender');
  const planenStart = useRef(false);
  const [aufgabenFilter, setAufgabenFilterRoh] = useState<AufgabenModusFilter>({ wer: 'alle' });

  useEffect(() => { let a: string | null = null; try { a = localStorage.getItem(MERKER); } catch { /* egal */ } setAnsichtRoh(startAnsicht(a, breit)); }, [breit]);
  const setAnsicht = (a: Ansicht) => { setAnsichtRoh(a); try { localStorage.setItem(MERKER, a); } catch { /* egal */ } };
  // Adresse (K5): ?modus=planen|aufgaben · ?tag= · ?space= · as/ap/al/wer (Aufgaben-Filter) — alte Links
  // (/os/planung/woche, WEG.woche) und der Umschalter in den Aufgaben landen hier (lib/kalender/modus.ts).
  useEffect(() => {
    const a = modusAusAdresse(window.location.search);
    setModusRoh(a.modus);
    // Aus dem früheren Wochenplaner (Link mit ?modus=planen): am großen Bildschirm die Woche.
    if (a.modus === 'planen') planenStart.current = true;
    if (a.tag) setAnker(a.tag);
    if (a.space) setBereich(a.space);
    setAufgabenFilterRoh({ wer: a.wer ?? 'alle', ...(a.as ? { as: a.as } : {}), ...(a.ap ? { ap: a.ap } : {}), ...(a.al ? { al: a.al } : {}) });
  }, []);
  const adresseSetzen = (teil: Record<string, string | undefined>) => {
    try { const u = new URL(window.location.href); for (const [k, v] of Object.entries(teil)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); } window.history.replaceState(null, '', u.toString()); } catch { /* egal */ }
  };
  const setAufgabenFilter = (f: AufgabenModusFilter) => { setAufgabenFilterRoh(f); adresseSetzen({ as: f.as, ap: f.ap, al: f.al, wer: f.wer === 'alle' ? undefined : f.wer }); };
  useEffect(() => { if (planenStart.current && breit) { planenStart.current = false; setAnsichtRoh('woche'); } }, [breit, modus]);
  // Planen braucht das Zeitraster: aus Monat/Jahr/Termine geht es in die Woche (am Handy in den Tag).
  useEffect(() => { if (modus === 'planen' && !MIT_RASTER.includes(ansicht)) setAnsichtRoh(breit ? 'woche' : 'tag'); }, [modus, ansicht, breit]);
  // Planen braucht die Bausteine links: eine zugeklappte Spalte geht beim Wechsel nach „Planen“ auf (klappen.ts, nicht gemerkt).
  useEffect(() => { if (oeffnenFuerPlanen(modus, breit, linksOffen)) setLinksOffen(true); }, [modus, breit]); // eslint-disable-line react-hooks/exhaustive-deps
  const setModus = (m: Modus) => { setModusRoh(m); adresseSetzen({ modus: m === 'kalender' ? undefined : m }); };
  useEffect(() => {
    fetch('/api/state/kalender-einstellungen').then(r => r.json()).then((e: Einstellungen) => { setEinst(e); if (e.standardSicht) setSicht(e.standardSicht); }).catch(() => {});
  }, []);
  // F2 N7: nur die geänderten Teile senden (`{ teil }`) — der Server legt sie auf den AKTUELLEN Stand; ein älterer Stand in
  // diesem Fenster überschreibt so nie, was die andere Person inzwischen an anderen Einstellungen geändert hat.
  const einstSetzen = (teil: Partial<Einstellungen>) => { if (!einst) return; setEinst({ ...einst, ...teil }); fetch('/api/state/kalender-einstellungen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teil }), keepalive: true }).catch(() => {}); };
  const standardDauer = einst?.dauer.termin ?? 60;

  // Zeitraum je Ansicht
  const { von, bis, tage, blatt } = useMemo(() => {
    if (ansicht === 'tag') return { von: anker, bis: tagPlus(anker, 1), tage: [anker], blatt: [] as string[] };
    if (ansicht === 'vier') { const t = Array.from({ length: nTage }, (_, i) => tagPlus(anker, i)); return { von: anker, bis: tagPlus(anker, nTage), tage: t, blatt: [] as string[] }; }
    // Jahr (K2): die Ansicht lädt ihr Jahr verdichtet selbst (useJahr) — hier nur der Ankertag für Leiste/Mini-Monat.
    if (ansicht === 'jahr') return { von: anker, bis: tagPlus(anker, 1), tage: [anker], blatt: [] as string[] };
    if (ansicht === 'woche') { const mo = montagVon(anker); const t = Array.from({ length: 7 }, (_, i) => tagPlus(mo, i)); return { von: mo, bis: tagPlus(mo, 7), tage: t, blatt: [] as string[] }; }
    if (ansicht === 'monat') { const b = monatsblatt(Number(anker.slice(0, 4)), Number(anker.slice(5, 7))); return { von: b[0], bis: tagPlus(b[41], 1), tage: b, blatt: b }; }
    const t = Array.from({ length: 30 }, (_, i) => tagPlus(anker, i)); return { von: anker, bis: tagPlus(anker, 30), tage: t, blatt: [] as string[] };
  }, [ansicht, anker, nTage]);
  // Sicht Privat · Business (10.10.): der Bereich geht an den Server — nur „Alles“ (ausdrücklich gewählt) holt beide.
  const { daten, laedt, laden, setDaten } = useKalender(von, bis, bereich);
  // Business-frei (08.10., Lücke 7): die EIGENEN Business-freien Zeiten des Zeitraums — dezent im Raster.
  const rahmen = useArbeitsrahmen(MIT_RASTER.includes(ansicht) ? von : '', MIT_RASTER.includes(ansicht) ? bis : '');
  // Quellen (K2): Feiertage NRW + Geburtstage — ganztägig, schreibgeschützt, in allen Ansichten; im Jahr das ganze Jahr.
  const jahr = Number(anker.slice(0, 4));
  const quell = useQuellTermine(ansicht === 'jahr' ? `${jahr}-01-01` : von, ansicht === 'jahr' ? `${jahr + 1}-01-01` : bis, bereich);
  const jahrDaten = useJahr(ansicht === 'jahr' ? jahr : 0, bereich);
  // K4 Termine finden: „Mit … planen“ (Überlagerung + freie Zeiten) und Buchungsseiten — ein Haken (components/os/kalender/MitPlanen.tsx).
  const k4 = useTermineFinden({ alle: daten?.termine, onVorschlag: setNeu });

  const kalFarbe = useCallback((name: string, wer: Wer) => daten?.kalender.find(k => k.name === name)?.farbe ?? WER_FARBE[wer], [daten]);
  // Blöcke (K5) in der Farbe ihrer Art (Reha, Routine, Pause, Aufgabe, Block), solange der Termin keine eigene hat.
  const farbe = useCallback((t: KTermin) => (istQuellTermin(t) ? t.farbe : t.farbeEigen ?? blockFarbe(t) ?? kalFarbe(t.kalender, t.wer)), [kalFarbe]);
  const such = suche.trim().toLowerCase();
  const imBereich = useCallback((b: 'privat' | 'business' | undefined) => bereich === 'alle' || !b || b === bereich, [bereich]);
  const termine = useMemo(() => [
    ...(daten?.termine ?? []).filter(t => (sicht === 'alle' || t.wer === sicht) && !aus.has(t.kalender) && imBereich(spaceVonKalender(einst, t.kalender)) && (!such || suchPasst([t.titel, t.ort, t.kalender, t.notiz], such))),
    ...quell.filter(t => !aus.has(t.kalender) && imBereich(t.space) && (!such || suchPasst([t.titel, t.kalender], such))),
  ], [daten, quell, sicht, aus, such, einst, imBereich]);
  const wocheDesAnkers = useMemo(() => { const mo = montagVon(anker); return Array.from({ length: 7 }, (_, i) => tagPlus(mo, i)); }, [anker]);
  // Planen (K5): Bausteine platzieren, Stunden der Woche, Archiv der alten Wochenplan-Blöcke (schreibgeschützt im Raster).
  const planen = usePlanen({ aktiv: modus === 'planen' && MIT_RASTER.includes(ansicht), tage, termine, sicht, laden, melden: setMeldung });
  const rasterTermine = useMemo(() => (planen.archivTermine.length ? [...termine, ...planen.archivTermine] : termine), [termine, planen.archivTermine]);
  // Klick auf einen Quell-Eintrag öffnet nie das Termin-Fenster: Geburtstag → Person/Kontaktakte, Feiertag → nichts.
  const oeffnen = (t: KTermin) => {
    if (istQuellTermin(t)) { if (t.href) router.push(t.href); return; }
    // Alter Wochenplan (K5): schreibgeschützt — wird mit der Übernahme zum Termin bzw. bleibt Archiv.
    if (istArchivTermin(t)) { setMeldung(t.titel.endsWith('(wartet auf Übernahme)') ? 'Block aus dem alten Wochenplan — „Jetzt übernehmen“ (links) macht ihn zum Termin.' : 'Vergangener Block aus dem alten Wochenplan — nur zum Nachlesen.'); return; }
    setOffen(t);
  };
  const jahrKalender = jahrDaten?.kalender;
  const kalenderAn = useCallback((name: string) => { if (aus.has(name)) return false; if (sicht === 'alle') return true; const w = jahrKalender?.find(k => k.name === name)?.wer; return !w || w === sicht; }, [aus, sicht, jahrKalender]);
  const kalenderFarbe = useCallback((name: string) => { const k = jahrKalender?.find(x => x.name === name); return k?.farbe ?? WER_FARBE[k?.wer ?? 'beide']; }, [jahrKalender]);
  // Fristen gehören dem Haushalt: in „Alle“ und „Gemeinsam“, gefiltert nach Bereich (KALENDER_VERBINDUNGEN.md 4i).
  const fristenSichtbar = sicht === 'alle' || sicht === 'beide';
  const fristen = useMemo(() => (!fristenSichtbar ? [] : (ebenen.fristen && !such ? daten?.fristen ?? [] : (daten?.fristen ?? []).filter(f => such && suchPasst([f.titel], such))).filter(f => imBereich(f.bereich))), [daten, ebenen.fristen, such, fristenSichtbar, imBereich]);
  const erinnerungen = useMemo(() => (ebenen.erinnerungen && !such ? daten?.erinnerungen ?? [] : (daten?.erinnerungen ?? []).filter(e => such && suchPasst([e.titel], such))), [daten, ebenen.erinnerungen, such]);
  // Aufgaben (K3): Start bis Deadline, ohne Abgebrochene/Papierkorb/Archiv/fremde „nur ich“ — lib/kalender/aufgaben.ts.
  const ich = useIch();
  const aufgabenImZeitraum = useMemo<KalenderAufgabe[]>(() => (ebenen.aufgaben ? aufgabenFuerKalender(aufgabenStand.tasks, von, bis, { sicht, bereich, suche: such, ich }) : []), [aufgabenStand.tasks, ebenen.aufgaben, von, bis, such, sicht, bereich, ich]);
  const ohne = useMemo(() => (ebenen.aufgaben ? ohneTermin(aufgabenStand.tasks, { sicht, bereich, suche: such, ich }) : []), [aufgabenStand.tasks, ebenen.aufgaben, such, sicht, bereich, ich]);
  const ka = useAufgabenImKalender();
  useTerminAusAdresse(daten?.termine, setAnker, setOffen);
  const neuVon = (art: TerminArt, tag = ansicht === 'tag' ? anker : heute): Vorgabe => ({ tag, art, ...(art === 'abwesend' || art === 'arbeitsort' ? { ganztags: true } : { von: '09:00' }), ...(sicht === 'kevin' || sicht === 'malin' || sicht === 'beide' ? { wer: sicht } : ich === 'kevin' || ich === 'malin' ? { wer: ich } : {}), ...(bereich === 'business' ? { spaceId: BUSINESS_GESELLSCHAFTEN[0] ?? 'kdv' } : {}) });
  const neuImRaster = (tag: string, m: number, ende?: number) => {
    // Planen: ist ein Baustein gewählt, entsteht hier der Block (kein Dialog).
    if (planen.platzieren(tag, m, ende)) return;
    setNeu({ ...neuVon('termin', tag), von: uhr(m), bis: uhr(Math.min(23 * 60 + 59, ende ?? m + standardDauer)) });
  };
  const arbeitsortNeu = (tag: string, wer: Wer) => setNeu({ tag, art: 'arbeitsort', ganztags: true, wer });

  // Navigation
  const springe = (richtung: -1 | 1) => setAnker(a => ansicht === 'tag' ? tagPlus(a, richtung) : ansicht === 'vier' ? tagPlus(a, nTage * richtung) : ansicht === 'woche' ? tagPlus(a, 7 * richtung) : ansicht === 'monat' ? monatPlus(a, richtung) : ansicht === 'jahr' ? monatPlus(a, 12 * richtung) : tagPlus(a, 30 * richtung));
  // Wischen (09.10.): Trackpad zwei Finger waagerecht bzw. ein Finger auf der Kopfzeile der Tage — dieselbe Funktion wie die Pfeile.
  const inhalt = useRef<HTMLDivElement>(null);
  useKalenderWischen(inhalt, { aktiv: wischenAktiv(ansicht, modus) && !offen && !neu, weiter: springe });
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.tagName === 'SELECT' || ziel.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't') setAnker(localDay());
      else if (e.key === 'ArrowLeft') springe(-1);
      else if (e.key === 'ArrowRight') springe(1);
      else if (e.key === 'n' || e.key === 'c') setNeu(neuVon('termin'));
      else if (e.key === 'p') setModus(modus === 'planen' ? 'kalender' : 'planen');
      else if (e.key === 'k') setModus('kalender');
      else if (e.key === 'u') setModus('aufgaben');
      else if (e.key === '/') { setSucheOffen(true); setTimeout(() => sucheFeld.current?.focus(), 0); }
      else { const a = ANSICHTEN.find(x => x.taste === e.key); if (a) setAnsicht(a.id); else return; }
      e.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [ansicht, anker, heute, sicht, bereich, modus, nTage]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⌘B / Strg+B klappt die linke Spalte (nur breit, nicht im Eingabefeld, nicht über einem offenen Termin-Fenster).
  useEffect(() => {
    if (!breit) return;
    const taste = (e: KeyboardEvent) => {
      if (offen || neu || !linksTaste(e, document.activeElement as HTMLElement | null)) return;
      e.preventDefault();
      linksUmschalten();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [breit, linksOffen, offen, neu]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zeitraum der Kopfzeile in EINER Zeile (10.10.): „5.–11. Okt. 2026 · KW 41“ (lib/kalender/darstellung.ts).
  const titel = zeitraumText(ansicht, tage, anker);

  // Schreiben
  // Verschieben/Dauer mit Stand (ETag, 409 statt still überschreiben) + „Rückgängig“ (Standard `useRueckgaengig`, R-K2 #92, verschieben.tsx);
  // Schlüssel = `objektSchluessel` (R-K1: Kalender + UID).
  const { verschieben, hinweis: rueckgaengig } = useVerschieben({ setDaten, laden, melden: setMeldung });
  const jetztAbgleichen = async () => { setAbgleich(true); const r = await fetch('/api/kalender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'abgleichen' }) }).then(x => x.json()).catch(() => ({ ok: false })); if (!r.ok && r.fehler) setMeldung(r.fehler); await laden(); setAbgleich(false); };
  const analysieren = async () => {
    setAnalysiert(true); setEingetragen({});
    const wochenTage = Array.from({ length: 8 }, (_, i) => tagPlus(heute, i));
    const events = (daten?.termine ?? []).filter(t => wochenTage.includes(t.start.slice(0, 10))).map(t => ({ id: t.id, title: t.titel, startDate: t.start, endDate: t.ende, allDay: t.ganztags, calendarName: t.kalender, location: t.ort }));
    const d: Analyse = await fetch('/api/kalender/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, today: heute }) }).then(r => r.json()).catch(() => ({ briefing: 'Analyse gerade nicht möglich.' }));
    setAnalyse(d); setAnalysiert(false);
  };
  const blockEintragen = async (b: NonNullable<Analyse['vorschlaege']>[number], i: number) => {
    setEingetragen(e => ({ ...e, [i]: 'busy' }));
    const startMin = b.startHour * 60 + (b.startMin ?? 0);
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: b.title, kalender: b.calendar, start: wandAus(b.date, startMin), ende: wandAus(b.date, startMin + b.durationMin), ...icsVonPlanArt(planArtAusTitel(b.title)) }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setEingetragen(e => ({ ...e, [i]: r.ok ? 'ok' : 'err' }));
    if (r.ok) void laden(); else if (r.fehler) setMeldung(r.fehler);
  };

  // Mini-Monat (Leiste)
  const miniBlatt = useMemo(() => monatsblatt(Number(anker.slice(0, 4)), Number(anker.slice(5, 7))), [anker]);
  const tageMitTermin = useMemo(() => new Set((daten?.termine ?? []).map(t => t.start.slice(0, 10))), [daten]);
  // Sicht je Person (14.10.): die Fächer der Zuordnung mit dem Namen der Person dahinter (Konten), ein leeres Fach nur, wenn es gerade gewählt ist.
  const sichten: { id: 'alle' | Wer; label: string }[] = [{ id: 'alle', label: 'Alle' }, ...WER_LABEL.belegt.map(w => ({ id: w, label: WER_LABEL[w] })), ...(sicht !== 'alle' && !WER_LABEL.belegt.includes(sicht) ? [{ id: sicht, label: WER_LABEL[sicht] }] : [])];
  // Quellen (03.10.): iCloud und/oder Google — je nachdem, was verbunden ist.
  const mitGoogle = !!daten?.google?.length;
  // iCloud je Person (06.10.): die eigene Verbindung zählt auch als Live-Quelle.
  const icloudLive = !!daten?.icloud || !!daten?.icloudEigen;
  const live = icloudLive || mitGoogle;
  // Abgleich je Quelle als Punkt in der Kopfzeile (10.10.) — statt einer Textzeile „letzter Abgleich …“ je Kalender.
  const abgleichQuellen = useMemo<AbgleichQuelle[]>(() => [
    ...(daten?.icloud && daten.abgleich ? [{ name: `iCloud${daten.konto ? ` · ${daten.konto}` : ''}`, quelle: 'iCloud', a: daten.abgleich }] : []),
    ...(daten?.icloudEigen ? [{ name: 'Meine iCloud', quelle: 'iCloud', a: daten.icloudEigen.abgleich }] : []),
    ...(daten?.google ?? []).map(g => ({ name: `${g.kalender} (Google)`, quelle: 'Google', a: g.abgleich })),
  ], [daten]);
  // Arbeitsbeginn (10.10.): dorthin rollt das Raster, wenn heute nicht zu sehen ist — aus den eigenen Business-freien Zeiten, sonst 7 Uhr.
  const arbeitsbeginn = useMemo(() => arbeitsbeginnAus(rahmen?.fenster, tage), [rahmen, tage]);
  const quelleText = daten?.quelle === 'icloud' ? [daten.icloud ? `iCloud${daten.konto ? ` · ${daten.konto}` : ''}` : '', mitGoogle ? 'Google' : ''].filter(Boolean).join(' + ') : daten?.quelle === 'mac' ? 'Zwischenstand (nur lesen)' : 'noch keine Quelle';

  const leiste = (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      {breit && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <ErstellenMenue breit onArt={a => setNeu(neuVon(a))} />
          <SymbolKnopf ariaLabel={`Spalte zuklappen (${LINKS_TASTE})`} offen steuert={LINKS_ID} onClick={() => linksUmschalten(false)}><PanelLeftClose size={18} /></SymbolKnopf>
        </div>
      )}
      {planen.leiste}
      <Karte i={1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SymbolKnopf onClick={() => setAnker(a => monatPlus(a, -1))} ariaLabel="Vormonat">‹</SymbolKnopf>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14 }}>{MONATE[Number(anker.slice(5, 7)) - 1]} {anker.slice(0, 4)}</span>
          <SymbolKnopf onClick={() => setAnker(a => monatPlus(a, 1))} ariaLabel="Folgemonat">›</SymbolKnopf>
        </div>
        <div className="ui-mini-monat" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px 0', textAlign: 'center' }}>
          {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((w, i) => <span key={i} style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{w}</span>)}
          {miniBlatt.map(tag => { const im = tag.slice(0, 7) === anker.slice(0, 7); const gew = ansicht === 'tag' ? tag === anker : ansicht === 'woche' || ansicht === 'vier' ? tage.includes(tag) : false; return (
            <button key={tag} onClick={() => { setAnker(tag); if (ansicht === 'monat' || ansicht === 'agenda' || ansicht === 'jahr') setAnsicht('tag'); }} aria-label={`${Number(tag.slice(8, 10))}. ${MONATE[Number(tag.slice(5, 7)) - 1]}${tag === heute ? ', heute' : ''}${tageMitTermin.has(tag) ? ', mit Terminen' : ''}`} aria-pressed={gew} style={{ position: 'relative', border: 'none', borderRadius: 10, padding: '4px 0', minHeight: 40, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text,
              background: tag === heute ? LEUCHT.puls : gew ? 'rgba(255,255,255,.08)' : 'transparent', color: tag === heute ? '#0b0b0c' : im ? C.ink : C.inkLeise, fontWeight: tag === heute ? 700 : 500 }}>
              {Number(tag.slice(8, 10))}{tageMitTermin.has(tag) && tag !== heute && <span style={{ position: 'absolute', left: '50%', bottom: 1, width: 3, height: 3, borderRadius: '50%', background: LEUCHT.puls, transform: 'translateX(-50%)' }} />}
            </button>
          ); })}
        </div>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Sicht</Ueberschrift>
        {/* F3 (29.09.): in der 280-px-Leiste wurde „Gemeinsam“ abgeschnitten — die Knöpfe brechen jetzt um. */}
        <Segmente liste={sichten} aktiv={sicht} onWahl={setSicht} umbrechen />
        <div style={{ marginTop: 8 }}><Segmente liste={[{ id: 'alle', label: 'Alles' }, { id: 'privat', label: 'Privat' }, { id: 'business', label: 'Business' }] as { id: Bereich; label: string }[]} aktiv={bereich} onWahl={setBereich} umbrechen /></div>
        <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
          {(daten?.kalender ?? []).map(k => (
            <label key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: TYP.bedien, color: aus.has(k.name) ? C.inkLeise : C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!aus.has(k.name)} onChange={() => setAus(s => { const n = new Set(s); if (n.has(k.name)) n.delete(k.name); else n.add(k.name); return n; })} />
              <span style={{ width: 10, height: 10, borderRadius: 3, background: k.farbe ?? WER_FARBE[k.wer] }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
              {k.quelle === 'google' && <span title="Dieser Kalender liegt bei Google (Workspace) und gleicht in beide Richtungen ab" style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.inkLeise, border: '1px solid rgba(255,255,255,.18)', borderRadius: 4, padding: '0 4px', lineHeight: '14px' }}>G</span>}
              <span style={{ marginLeft: 'auto', fontSize: TYP.bedien, color: C.inkLeise }}>{WER_LABEL[k.wer]}{k.schreibbar ? '' : ' · 🔒'}</span>
            </label>
          ))}
          {!daten?.kalender.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine Kalender geladen.</span>}
          {QUELL_KALENDER.map(k => (
            <label key={k.name} title={k.hinweis} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: TYP.bedien, color: aus.has(k.name) ? C.inkLeise : C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!aus.has(k.name)} onChange={() => setAus(s => { const n = new Set(s); if (n.has(k.name)) n.delete(k.name); else n.add(k.name); return n; })} />
              <span style={{ width: 10, height: 10, borderRadius: 3, background: k.farbe }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: TYP.bedien, color: C.inkLeise }}>🔒</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {([['fristen', 'Fristen', LEUCHT.agenten], ['erinnerungen', 'Erinnerungen', LEUCHT.schlaf], ['aufgaben', 'Aufgaben', LEUCHT.achtung]] as const).filter(([id]) => id !== 'erinnerungen' || !daten?.erinnerungenAus).map(([id, label, f]) => (
            <button key={id} onClick={() => setEbenen(e => ({ ...e, [id]: !e[id] }))} style={{ border: `1px solid ${ebenen[id] ? f : 'rgba(255,255,255,.1)'}`, background: ebenen[id] ? `${f}22` : 'transparent', color: ebenen[id] ? f : C.inkLeise, borderRadius: 999, padding: '3px 14px', minHeight: 40, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>{label}</button>
          ))}
        </div>
        {daten?.erinnerungenAus === 'uebernommen' && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Apple-Erinnerungen sind als Aufgaben übernommen — sie stehen unter Aufgaben.</div>}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>{quelleText}{daten?.stand ? ` · Stand ${new Date(daten.stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}{daten?.fehler ? ` · ${daten.fehler}` : ''}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {live && <Knopf leise aus={abgleich} onClick={() => void jetztAbgleichen()}>{abgleich ? 'gleicht ab …' : icloudLive && mitGoogle ? '↻ Abgleichen' : mitGoogle ? '↻ Mit Google abgleichen' : '↻ Mit iCloud abgleichen'}</Knopf>}
          {modus !== 'planen' && <button type="button" onClick={() => setModus('planen')} style={{ fontSize: TYP.bedien, color: C.inkDim, alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, padding: 0 }}>Woche planen (Blöcke) ›</button>}
        </div>
      </Karte>
      {ebenen.aufgaben && (
        <Karte i={2}>
          <Ueberschrift>Ohne Termin</Ueberschrift>
          <OhneTerminListe aufgaben={ohne} onOeffnen={ka.oeffnen} onAbhaken={ka.abhaken} />
          {ohne.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{breit ? 'Ins Raster ziehen plant ein (Deadline + Uhrzeit).' : 'Einplanen: Aufgabe öffnen und Deadline setzen.'}</div>}
        </Karte>
      )}
      {k4.karten}
      <Karte i={3} akzent={analyse?.conflicts?.length ? LEUCHT.kritisch : undefined}>
        <Ueberschrift rechts={<Knopf leise aus={analysiert || !daten} onClick={() => void analysieren()}>{analysiert ? 'analysiert …' : 'Woche prüfen'}</Knopf>}>Kalender-Agent</Ueberschrift>
        {!analyse && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Konflikte finden, Reha- und Fokus-Blöcke in freie Lücken vorschlagen — eintragen tust du.</div>}
        {analyse?.briefing && <div style={{ fontSize: TYP.bedien, lineHeight: 1.55, marginBottom: 8 }}>{analyse.briefing}</div>}
        {!!analyse?.gestapelt && <Link href="/os/stapel" style={{ display: 'inline-block', fontSize: TYP.bedien, color: LEUCHT.agenten, textDecoration: 'none', fontWeight: 600, marginBottom: 8 }}>{analyse.gestapelt === 1 ? '1 Vorschlag' : `${analyse.gestapelt} Vorschläge`} im Stapel ›</Link>}
        {!!analyse?.conflicts?.length && <Liste>{analyse.conflicts.map((c, i) => <Zeile key={i} links={<Punkt farbe={LEUCHT.kritisch} />} titel={<><b>{c.a}</b> ⨯ <b>{c.b}</b></>} unter={`${c.date} · ${c.overlap}`} />)}</Liste>}
        {!!analyse?.vorschlaege?.length && (
          <Liste>
            {analyse.vorschlaege.map((b, i) => <Zeile key={i} links={<Punkt farbe={LEUCHT.schlaf} />} titel={b.title} unter={`${b.date} · ${String(b.startHour).padStart(2, '0')}:${String(b.startMin ?? 0).padStart(2, '0')} · ${b.durationMin} Min · ${b.calendar}${b.grund ? ` · ${b.grund}` : ''}`}
              rechts={<Knopf leise={eingetragen[i] === 'ok'} aus={eingetragen[i] === 'busy' || eingetragen[i] === 'ok'} farbe={eingetragen[i] === 'err' ? LEUCHT.kritisch : LEUCHT.schlaf} onClick={() => void blockEintragen(b, i)}>{eingetragen[i] === 'ok' ? '✓' : eingetragen[i] === 'busy' ? '…' : eingetragen[i] === 'err' ? 'Fehler' : 'Eintragen'}</Knopf>} />)}
          </Liste>
        )}
      </Karte>
      {/* Überblick „Für dich“ (04.10. abends): Ist der letzten 3 Monate → heute → Prognose aus echten Daten; serverseitig gefiltert (FlussKarte, /api/fluss). */}
      <FlussKarte bereich="kalender" farbe={LEUCHT.schlaf} i={4} />
      <AuswertungKarte stichtag={ansicht === 'woche' || ansicht === 'vier' || ansicht === 'tag' ? anker : heute} i={4} />
      <Karte i={5}>
        <Ueberschrift erklaerung="kalender.einstellungen" rechts={<Knopf leise onClick={() => setZeigeEinst(v => !v)}>{zeigeEinst ? 'zu' : 'öffnen'}</Knopf>}>Einstellungen</Ueberschrift>
        {zeigeEinst && einst && (
          <div style={{ display: 'grid', gap: 10 }}>
            <IcloudVerbindung onGeaendert={() => void laden()} />
            <GoogleVerbindung onGeaendert={() => void laden()} />
            {WER_LABEL.belegt.map(w => (
              <label key={w} style={{ display: 'grid', gap: 4 }}><Erklaert erklaerung="kalender.zuordnung" name={`Kalender ${WER_LABEL[w]}`}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kalender {WER_LABEL[w]}</span></Erklaert>
                <input value={einst.kalender[w]} onChange={e => einstSetzen({ kalender: { ...einst.kalender, [w]: e.target.value } })} placeholder="Name wie in der Kalender-App" style={{ ...feld, fontSize: 13 }} /></label>
            ))}
            <label style={{ display: 'grid', gap: 4 }}><Erklaert erklaerung="kalender.dauer" name="Standarddauer"><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Standarddauer Termin (Min.)</span></Erklaert>
              <input type="number" min={5} max={600} step={5} value={einst.dauer.termin} onChange={e => einstSetzen({ dauer: { ...einst.dauer, termin: Number(e.target.value) || 60 } })} style={{ ...feld, width: 100, fontSize: 13 }} /></label>
            <div style={{ display: 'grid', gap: 4 }}>
              <Erklaert erklaerung="kalender.space" name="Kalender einem Bereich zuordnen"><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kalender → Space</span></Erklaert>
              {(daten?.kalender ?? []).map(k => { const sp = spaceVonKalender(einst, k.name); return (
                <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien }}>
                  <span style={{ flex: 1, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
                  {(['privat', 'business'] as const).map(s => <button key={s} onClick={() => einstSetzen({ space: { ...einst.space, [k.name]: s } })} style={{ border: `1px solid ${sp === s ? SPACE_FARBE[s] : 'rgba(255,255,255,.1)'}`, background: sp === s ? `${SPACE_FARBE[s]}22` : 'transparent', color: sp === s ? SPACE_FARBE[s] : C.inkLeise, borderRadius: 999, padding: '2px 12px', minHeight: 40, fontSize: TYP.bedien, cursor: 'pointer' }}>{s === 'privat' ? 'Privat' : 'Business'}</button>)}
                </div>
              ); })}
            </div>
            <EinstellungenBelegt kalender={daten?.kalender ?? []} einst={einst} setzen={einstSetzen} />
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Business-freie Zeiten sperren Business-Termine (mit Rückfrage), freie Zeiten und Buchungsseiten: <BusinessFreiLink text="Familie › Rahmen" /></div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Namen müssen genau so heißen wie in der Kalender-App. iCloud verbinden: oben unter „iCloud Kalender“.</div>
          </div>
        )}
      </Karte>
    </div>
  );

  // Eigenschaften, die Tag/Woche und 4 Tage gleich bekommen (Darstellung je Gerät, Arbeitsbeginn, Planen-Stunden im Tageskopf).
  const rasterGemeinsam = {
    heute, fristen, erinnerungen, aufgaben: aufgabenImZeitraum, aufgabeDauer: einst?.dauer.aufgabe ?? 30,
    onNeu: neuImRaster, onVerschieben: verschieben, onAufgabe: ka.oeffnen, onAufgabeHaken: ka.abhaken, onAufgabeEinplanen: ka.einplanen, onArbeitsortNeu: arbeitsortNeu,
    businessFrei: rahmen?.fenster, px, onZoom: (f: number) => { kalenderDarstellungAendern({ zoom: zoomMal(darstellung.zoom, f) }); },
    aufgabenGanztags: darstellung.aufgabenOhneZeit, hilfe: darstellung.hilfe, onHilfe: (an: boolean) => { kalenderDarstellungAendern({ hilfe: an }); },
    tagZusatz: planen.tagZusatz, arbeitsbeginn,
  };
  const ansichtListe = modus === 'planen' ? ansichten.filter(a => MIT_RASTER.includes(a.id)) : ansichten;
  const sucheAuf = () => { setSucheOffen(true); setTimeout(() => sucheFeld.current?.focus(), 0); };
  // Monat (10.10.): „Aufgaben ohne Uhrzeit anzeigen“ gilt auch hier — mit Uhrzeit bleiben sie.
  const monatAufgaben = darstellung.aufgabenOhneZeit ? aufgabenImZeitraum : aufgabenImZeitraum.filter(a => !!a.zeit);

  // EINE schlanke Kopfzeile (10.10.): links Navigation + Zeitraum + Abgleich-Punkte, rechts Suche · Ansicht · Kalender/Planen · Kalender|Aufgaben ·
  // Darstellung. Breit (Containerabfrage `.kalender-kopf`, app/globals.css) stehen Ansicht und Kalender/Planen als Segmente, schmal als Menü bzw. Symbol.
  // Suche als Symbol (10.10.): ein Klick (oder „/“) öffnet das Feld; leer und verlassen bzw. Esc klappt es wieder zu.
  const sucheElement = sucheOffen || suche ? (
    <input ref={sucheFeld} value={suche} onChange={e => setSuche(e.target.value)} onBlur={() => { if (!suche.trim()) setSucheOffen(false); }}
      onKeyDown={e => { if (e.key === 'Escape') { setSuche(''); setSucheOffen(false); e.currentTarget.blur(); } }}
      placeholder={modus === 'aufgaben' ? 'Aufgaben suchen …' : 'Suchen …'} aria-label={modus === 'aufgaben' ? 'Aufgaben suchen' : 'Termine suchen'} className="kalender-suche" style={{ ...feld, fontSize: 13, padding: '7px 11px' }} />
  ) : (
    <SymbolKnopf ariaLabel={modus === 'aufgaben' ? 'Aufgaben suchen' : 'Termine suchen'} titel="Suchen (/)" onClick={sucheAuf}><Search size={18} /></SymbolKnopf>
  );
  const kopfzeile = (
    <div className="kalender-kopf" role="group" aria-label="Kalender bedienen">
      <div className="kalender-kopf-links">
        {/* Spalte zugeklappt (09.10.): „Spalte öffnen“ und ein kleines „Erstellen“ vorne — sonst stünde „Erstellen“ nur in der Spalte. */}
        {breit && !linksOffen && <SymbolKnopf ariaLabel={`Spalte öffnen — Monat, Sicht, Kalender (${LINKS_TASTE})`} offen={false} steuert={LINKS_ID} onClick={() => linksUmschalten(true)}><PanelLeftOpen size={18} /></SymbolKnopf>}
        {breit && !linksOffen && <ErstellenMenue breit={false} onArt={a => setNeu(neuVon(a))} />}
        <Knopf leise onClick={() => setAnker(heute)}>Heute</Knopf>
        <SymbolKnopf ariaLabel="zurück" titel="Zurück (←)" onClick={() => springe(-1)}><ChevronLeft size={20} /></SymbolKnopf>
        <SymbolKnopf ariaLabel="weiter" titel="Weiter (→)" onClick={() => springe(1)}><ChevronRight size={20} /></SymbolKnopf>
        <span className="kalender-zeitraum" aria-live="polite" title={titel} style={{ fontFamily: SCHRIFT.display }}>{handy ? zeitraumText(ansicht, tage, anker, { kurz: heute }) : titel}</span>
        <AbgleichPunkte quellen={abgleichQuellen} onAbgleichen={live ? () => void jetztAbgleichen() : undefined} laeuft={abgleich} />
        {laedt && !daten && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</span>}
        {/* Am Handy steht die Suche in der ersten Zeile — so passt die zweite (Ansicht · Planen · Kalender|Aufgaben · Darstellung · +). */}
        {handy && sucheElement}
      </div>
      <div className="kalender-kopf-rechts">
        {!handy && sucheElement}
        {modus !== 'aufgaben' && <div className="kal-breit"><Segmente liste={ansichtListe.map(a => ({ id: a.id, label: a.label }))} aktiv={ansicht} onWahl={setAnsicht} /></div>}
        {modus !== 'aufgaben' && <div className="kal-schmal"><AnsichtMenue liste={ansichtListe} aktiv={ansicht} onWahl={setAnsicht} /></div>}
        {/* Modus (K5): Kalender · Planen — dasselbe Raster (nur auf der Kalender-Seite des Umschalters); schmal als Symbol. */}
        {modus !== 'aufgaben' && <div className="kal-breit"><Segmente liste={[{ id: 'kalender' as Modus, label: 'Kalender' }, { id: 'planen' as Modus, label: 'Planen' }]} aktiv={modus} onWahl={setModus} /></div>}
        {modus !== 'aufgaben' && <div className="kal-schmal"><SymbolKnopf ariaLabel="Planen" titel={modus === 'planen' ? 'Planen beenden (p)' : 'Woche planen — Blöcke setzen (p)'} gedrueckt={modus === 'planen'} onClick={() => setModus(modus === 'planen' ? 'kalender' : 'planen')}><Blocks size={18} /></SymbolKnopf></div>}
        {/* Umschalter Kalender | Aufgaben (Kevin 29.09., wie Google). */}
        <KalenderAufgabenSchalter aktiv={modus === 'aufgaben' ? 'aufgaben' : 'kalender'} kalender={{ onClick: () => setModus(modus === 'planen' ? 'planen' : 'kalender') }} aufgaben={{ onClick: () => setModus('aufgaben') }} tasten={{ kalender: 'k', aufgaben: 'u' }} />
        <DarstellungKnopf />
        {!breit && <ErstellenMenue breit={false} kompakt={handy} onArt={a => setNeu(neuVon(a))} />}
      </div>
    </div>
  );

  const haupt = (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, minHeight: 0, minWidth: 0, height: breit ? '100%' : hoehe ?? undefined }}>
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        {kopfzeile}
        {/* Planen (K5): Stunden des Zeitraums als EINE schmale Zeile (die Stunden je Tag stehen im Tageskopf des Rasters). */}
        {planen.kopf}
      </div>
      {/* overscroll-behavior-x: kein „Zurück“ des Browsers am Rand, wenn waagerecht gewischt wird (wischen.ts fängt den Wischer ab). */}
      <div ref={inhalt} style={{ minHeight: 0, overscrollBehaviorX: 'none', ...(modus === 'aufgaben' || ansicht === 'agenda' ? { overflowY: 'auto' as const, overscrollBehaviorY: 'contain' as const } : {}) }}>
        {modus === 'aufgaben' && <AufgabenModus heute={heute} woche={wocheDesAnkers} sicht={sicht} bereich={bereich} suche={suche} filter={aufgabenFilter} onFilter={setAufgabenFilter} />}
        {modus !== 'aufgaben' && (ansicht === 'tag' || ansicht === 'woche') && (
          <Zeitraster tage={tage} termine={k4.raster(rasterTermine)} farbe={k4.farbe(farbe)} onOeffnen={t => { if (!k4.oeffnen(t)) oeffnen(t); }} {...rasterGemeinsam} />
        )}
        {modus !== 'aufgaben' && ansicht === 'vier' && (
          <VierTage start={anker} anzahl={nTage} termine={rasterTermine} farbe={farbe} onOeffnen={oeffnen} {...rasterGemeinsam} />
        )}
        {modus !== 'aufgaben' && ansicht === 'monat' && <Monat blatt={blatt} monat={Number(anker.slice(5, 7))} heute={heute} termine={termine.filter(t => t.art !== 'arbeitsort')} fristen={fristen} erinnerungen={erinnerungen} farbe={farbe} onTag={tag => { setAnker(tag); setAnsicht('tag'); }} onOeffnen={oeffnen} aufgaben={monatAufgaben} onAufgabe={ka.oeffnen} onAufgabeHaken={ka.abhaken} onAufgabeEinplanen={ka.einplanen} />}
        {modus !== 'aufgaben' && ansicht === 'jahr' && <Jahr jahr={jahr} heute={heute} daten={jahrDaten} quellen={quell.filter(t => !aus.has(t.kalender))} kalenderAn={kalenderAn} farbe={kalenderFarbe} onTag={tag => { setAnker(tag); setAnsicht('tag'); }} />}
        {modus !== 'aufgaben' && ansicht === 'agenda' && <Karte i={0}><Agenda tage={tage} heute={heute} termine={termine} fristen={fristen} erinnerungen={erinnerungen} farbe={farbe} suche={such} onOeffnen={oeffnen} aufgaben={aufgabenImZeitraum} onAufgabe={ka.oeffnen} onAufgabeHaken={ka.abhaken} /></Karte>}
      </div>
    </div>
  );

  return (
    // Kein sichtbarer Seitenkopf (10.10.): die Kopfzeile trägt Zeitraum und Bedienung; der Titel bleibt für Vorleser (.kalender-seite, globals.css).
    <Seite titel="Kalender" className="kalender-seite" breit={2400}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>{meldung}<span style={{ marginLeft: 'auto' }}><SymbolKnopf onClick={() => setMeldung(null)} ariaLabel="Hinweis schließen">✕</SymbolKnopf></span></div>}
      {!daten && !laedt && <Leer>Kalender wird geladen …</Leer>}
      {/* 06.10.: „<Firma> verbinden“ (Business, Google) bzw. iCloud (Privat) — für die eigene Person, dort wo es hingehört. Verbunden steht hier nichts
          mehr (10.10.): den Stand zeigen die Abgleich-Punkte der Kopfzeile. */}
      {(bereich === 'business' || bereich === 'privat') && <BereichVerbindungen key={bereich} bereich={bereich} onGeaendert={() => void laden()} ohneHinweis />}
      {/* Linke Spalte (09.10.): zugeklappt bleibt sie geladen (`hidden`, Zustand und Karten bleiben), das Raster bekommt die ganze Breite.
          Volle Höhe (10.10.): breit hat die Fläche die Höhe bis zum Fensterrand — Spalte und Raster rollen je in sich; schmal das Raster allein. */}
      <div ref={flaeche} style={{ display: 'grid', gridTemplateColumns: breit && linksSichtbar(breit, linksOffen) ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 14, alignItems: breit ? 'stretch' : 'start', ...(breit ? { height: hoehe ?? 'calc(100vh - 140px)', gridTemplateRows: 'minmax(0, 1fr)' } : {}) }}>
        {breit && <div id={LINKS_ID} hidden={!linksSichtbar(breit, linksOffen)} style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', paddingRight: 4 }}>{leiste}</div>}
        {haupt}
        {!breit && <div id={LINKS_ID} style={{ minWidth: 0 }}>{leiste}</div>}
      </div>
      {planen.unten}
      {rueckgaengig}
      {offen && <TerminFenster key={offen.id} termin={offen} icloud={daten?.icloud ?? false} space={spaceVonKalender(einst, offen.kalender)} kalenderFarbe={kalFarbe(offen.kalender, offen.wer)} onZu={() => setOffen(null)} onGespeichert={() => void laden()} />}
      {neu && <NeuerTermin vorgabe={neu} heute={heute} standardDauer={standardDauer} fokusDauer={einst?.dauer.fokus ?? 90} kalender={daten?.kalender ?? []} kalenderStandard={einst?.kalender} bereich={bereich === 'business' ? 'business' : 'privat'} onZu={() => setNeu(null)} onAngelegt={x => { if (x.uid) void laden(); }} />}
    </Seite>
  );
}
