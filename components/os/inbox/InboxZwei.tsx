'use client';

// ─── MAKE OS — Inbox 2: das Lagebild aller Kommunikation (06.10.2026; ersetzt InboxSchlank + /os/inbox/voll) ─────────
// INBOX_KONZEPT.md (Abschnitte 4, 5, 12): oben das LAGEBILD je Bereich (Zahlen anklickbar = Filter) + der ZOE-Satz (nur Vorschlag),
// darunter die Postfach-Leiste (Punkt je Postfach: Smaragd aktuell · gelb verzögert · Granat Anmeldung abgelehnt) und die
// ARBEITSLISTE in fester Reihenfolge: Wiedervorlage fällig → Antworten → Nachfassen fällig → Termine → Geld & Papier → Neue Absender
// (Zulassen · Blocken in der Zeile) → Info & Rundschreiben (eingeklappt, am Stück wegräumen). Rechner: Liste links, Gespräch rechts
// (klebend, mit Kontext); Handy: Liste zuerst, das Gespräch als eigene Ansicht. Tasten: j/k · Enter · e erledigt · s später · a Aufgabe
// · r antworten · Esc. Handy: Zeile nach rechts wischen = erledigt, nach links = später (mit „Rückgängig“).
// Alles kommt gefiltert vom Server (/api/inbox) — die Oberfläche blendet nie bloß aus. Nichts wird ohne Klick zugeordnet oder gesendet.
// WhatsApp (07.10. abends): Zeilen mit Symbol, Name (Akte bzw. Profilname) + Nummer und dem Stand des 24-h-Fensters; „Neue Absender“
// gilt auch für Nummern (Zulassen · Blocken); Lagebild und Fächer zählen WhatsApp mit (derselbe Strom).
// Teilen (08.10., Lücke 6 „Business Couple“): Fach „Übergeben“ (Kopien an bzw. von mir, `offen=ub-…` öffnet sie), „wer kümmert sich“ an
// Gesprächen der Team-Postfächer und bei WhatsApp, Suchfeld oben (am Handy hinter der Lupe, Taste „/“) — Suche auf dem Server über das,
// was die Person sieht (/api/inbox/suche), Ergebnisse mit Hervorhebung statt der Arbeitsliste (seit 10.10. auch Anhang-Namen).
// Aufgaben-Vorschläge (10.10., Roadmap Phase 1): unter dem ZOE-Satz „Vorschläge holen“ + Schalter „automatisch“ (`AufgabenVorschlaege`) — das
// Regelwerk legt Vorschläge in die EIGENEN Freigaben, angelegt wird dort per Klick.
// Ansicht & Ordnung (09.10., Kevin: „ansehen können — sortiert … auf das Postfach klicken, z. B. MAKE Innovation oder KD Ventures“):
//   · BEREICHS-LEISTE oben (wischbare Reiter): „Alle“ + je Bereich mit Postfächern der Person, mit Ungelesen-Zähler — Klick = nur dessen
//     Gespräche (der Server filtert: `?bereich=`), die Adresse trägt Bereich + Postfach + offenes Gespräch (Zurück führt in denselben Bereich).
//     Hat ein Bereich mehrere Postfächer, wählt eine zweite Pillenreihe das Postfach. Unter „Alle“ lassen sich Bereiche ausblenden (`?ohne=`,
//     Merker je Browser und Sicht). Namen/Farben nur aus Server (Register/Einheiten) bzw. lib/inbox/ansicht.ts.
//   · ZWEI ORDNUNGEN (Merker je Browser): „Wichtig zuerst“ = die Fächer wie bisher · „Neueste zuerst“ = Tag-Gruppen Heute · Gestern · Diese
//     Woche · Älter, darin ungelesen zuerst; dazu Offen · Ungelesen · Auch Erledigtes.
//   · LABELS: jede Zeile und der Kopf des Gesprächs tragen Bereich (Farbe) und Postfach, sobald mehr als eines in der Sicht ist.
//   · Postfach OHNE Bereich (z. B. Gmail verbunden, nicht zugeordnet): in jeder Sicht die Karte „… ist noch keinem Bereich zugeordnet — jetzt
//     zuordnen“ mit der Bereichswahl (Schreibweg /api/inbox/postfaecher `einstellen`); der Server liefert dafür nur Name + maskierte Adresse.
//   · Erster Abgleich läuft: „Post wird geholt …“ statt leer (lädt dann alle 10 s nach).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, KUGEL, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { useSpace } from '@/hooks/useSpace';
import { FACH_LABEL, type FachId } from '@/lib/inbox/faecher';
import { gespraechPfad, sortieren, type LageZeile } from '@/lib/inbox/strom';
import { bereichFarbe, fuerZeigen, istBereichKennung, istZeigen, nachTagen, ruheText, ZEIGEN, type Zeigen } from '@/lib/inbox/ansicht';
import { POSTFACH_ID } from '@/lib/postfach/typen';
import { aufgabeAusGespraech } from '@/lib/inbox/aus-gespraech';
import { neueMailHolen, type NeueMail } from '@/lib/inbox/neue-mail';
import type { Owner } from '@/types/common';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Leerzustand, Knopf, Segmente, Punkt, Hinweis, Spalten, Spalte, SymbolKnopf, Reiter, Pillen, MehrfachPillen, Chip, Wahl, useBreit, useHandy, useRueckgaengig, LEUCHT, FlussKarte } from '../ui';
import { useLinkAuswahl } from '../Verlauf';
import { GespraechAnsicht } from './Gespraech';
import { Postfaecher, STUFE_FARBE, STUFE_TEXT } from './Postfaecher';
import { Antwort } from './Antwort';
import { WaSymbol, fensterJetzt } from '../whatsapp';
import { fensterText, nummerAnzeige, type Fenster } from '@/lib/whatsapp/typen';
import { UebergabeAnsicht, UebergabenKarte } from './Teilen';
import { SuchErgebnisse, SuchFeld } from './Suche';
import { AufgabenVorschlaege } from './Vorschlaege';
import { aktion, holen, istUebergabeId, nameVon, senden, tagIn, zeitKurz, type GespraechZeile, type StromAntwort } from './daten';

type Filter = { fach: FachId | 'nachfassen' | 'wiedervorlage'; bereich: string | null } | null;
type Ordnung = 'faecher' | 'neueste';
/** Merker je Browser (09.10.): Ordnung, was „Neueste zuerst“ zeigt, und die unter „Alle“ ausgeblendeten Bereiche je Sicht. */
interface Merker { ordnung: Ordnung; zeigen: Zeigen; ohne: string[] }
const MERKER = { ordnung: 'make-inbox-ordnung', zeigen: 'make-inbox-zeigen', ohne: (sicht: string) => `make-inbox-ohne:${sicht}` };
const merkerLesen = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merkerSchreiben = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ohne Merker */ } };
/** Reiter-Kennung für „Alle“ — kein gültiger Bereich (Bereiche beginnen mit Buchstabe/Ziffer). */
const ALLE = '~alle';
const ORDNUNGEN: { id: Ordnung; label: string }[] = [{ id: 'faecher', label: 'Wichtig zuerst' }, { id: 'neueste', label: 'Neueste zuerst' }];
/** WhatsApp-Zeile: Rest des 24-h-Fensters („noch 3 Std.“) bzw. „nur Vorlage“ (rein bis auf die Uhrzeit). */
const fensterKurz = (f: Fenster) => { const x = fensterJetzt(f, Date.now()); return x.offen ? fensterText(x).replace('Fenster offen · ', '') : 'nur Vorlage'; };
const LAGE_TEILE: { feld: keyof Omit<LageZeile, 'bereich'>; text: (n: number) => string; fach: NonNullable<Filter>['fach'] }[] = [
  { feld: 'antworten', text: n => `${n} ${n === 1 ? 'braucht' : 'brauchen'} Antwort`, fach: 'antworten' },
  { feld: 'warten', text: n => `${n} ${n === 1 ? 'wartet' : 'warten'} auf andere`, fach: 'warten' },
  { feld: 'termine', text: n => `${n} Termin${n === 1 ? '' : 'e'}`, fach: 'termine' },
  { feld: 'geld', text: n => `${n} Geld & Papier`, fach: 'geld' },
  { feld: 'neu', text: n => `${n} neue Absender`, fach: 'neu' },
];

/** Zeile mit Wischen (Handy): rechts = erledigt, links = später. Unter 90 px passiert nichts; senkrechtes Scrollen bleibt frei. */
function Wisch({ children, an, rechts, links }: { children: ReactNode; an: boolean; rechts: () => void; links: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; aktiv: boolean } | null>(null);
  if (!an) return <>{children}</>;
  const ende = () => { const d = dx; setDx(0); start.current = null; if (d > 90) rechts(); else if (d < -90) links(); };
  return (
    <div style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={e => { if (e.pointerType === 'touch') start.current = { x: e.clientX, y: e.clientY, aktiv: false }; }}
      onPointerMove={e => { const s = start.current; if (!s) return; const x = e.clientX - s.x, y = e.clientY - s.y; if (!s.aktiv && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y)) s.aktiv = true; if (s.aktiv) setDx(Math.max(-160, Math.min(160, x))); }}
      onPointerUp={ende} onPointerCancel={() => { setDx(0); start.current = null; }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dx > 0 ? 'flex-start' : 'flex-end', padding: '0 18px', background: dx > 0 ? `${KUGEL.smaragd}33` : dx < 0 ? `${LEUCHT.achtung}2a` : 'transparent', color: dx > 0 ? KUGEL.smaragd : LEUCHT.achtung, fontSize: TYP.bedien, fontWeight: 700 }}>
        {dx > 0 ? 'Erledigt' : dx < 0 ? 'Morgen' : ''}
      </div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform .18s ease', background: C.flaeche, position: 'relative' }}>{children}</div>
    </div>
  );
}

export function InboxZwei() {
  const params = useSearchParams();
  // Sicht Privat · Business (10.10.): der Bereich des Kopf-Schalters (die Adresse `?space=` gewinnt dort schon) — vorher nur aus der Adresse,
  // und ein Link ohne `?space=` zeigte unter „Business“ die Post beider Bereiche. Der Server filtert (`imBereich`).
  const space: 'privat' | 'business' = useSpace().space;
  const [offenId, setOffenId] = useLinkAuswahl('offen');
  const [ansicht, setAnsicht] = useState<'liste' | 'postfaecher'>(() => (params.get('postfaecher') === '1' ? 'postfaecher' : 'liste'));
  const router = useRouter();
  const pfad = usePathname() ?? '/os/inbox';
  // Bereich und Postfach stehen in der Adresse (Ort wechseln = neuer Verlaufseintrag; Zurück führt in denselben Bereich).
  const bereichRoh = params.get('bereich');
  const bereich = bereichRoh && istBereichKennung(bereichRoh) ? bereichRoh : null;
  const pfRoh = params.get('postfach');
  const pfWahl = bereich && pfRoh && POSTFACH_ID.test(pfRoh) ? pfRoh : null;
  const [filter, setFilter] = useState<Filter>(null);
  const [merker, setMerker] = useState<Merker | null>(null);
  const [ohneAuf, setOhneAuf] = useState(false);
  const sichtSchluessel = space ?? 'alles';
  useEffect(() => {
    const o = merkerLesen(MERKER.ordnung); const z = merkerLesen(MERKER.zeigen);
    let ohne: string[] = [];
    try { const roh = JSON.parse(merkerLesen(MERKER.ohne(sichtSchluessel)) ?? '[]'); if (Array.isArray(roh)) ohne = roh.filter(istBereichKennung).slice(0, 30); } catch { /* leer */ }
    setMerker({ ordnung: o === 'neueste' ? 'neueste' : 'faecher', zeigen: istZeigen(z) ? z : 'offen', ohne });
  }, [sichtSchluessel]);
  const merkerSetzen = useCallback((m: Partial<Merker>) => {
    setMerker(alt => {
      const neu = { ...(alt ?? { ordnung: 'faecher' as Ordnung, zeigen: 'offen' as Zeigen, ohne: [] }), ...m };
      if (m.ordnung) merkerSchreiben(MERKER.ordnung, m.ordnung);
      if (m.zeigen) merkerSchreiben(MERKER.zeigen, m.zeigen);
      if (m.ohne) merkerSchreiben(MERKER.ohne(sichtSchluessel), m.ohne.length ? JSON.stringify(m.ohne) : null);
      return neu;
    });
  }, [sichtSchluessel]);
  const ordnung: Ordnung = merker?.ordnung ?? 'faecher';
  const zeigen: Zeigen = merker?.zeigen ?? 'offen';
  /** Bereich (und ggf. Postfach) wählen — schließt ein offenes Gespräch, Lage-Filter fällt weg. */
  const geheZu = useCallback((b: string | null, pf: string | null = null) => {
    const q = new URLSearchParams(params.toString());
    if (b) q.set('bereich', b); else q.delete('bereich');
    if (b && pf) q.set('postfach', pf); else q.delete('postfach');
    q.delete('offen');
    setFilter(null);
    router.push(`${pfad}${q.toString() ? `?${q}` : ''}`, { scroll: false });
  }, [params, pfad, router]);
  const [s, setS] = useState<StromAntwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [weg, setWeg] = useState<Set<string>>(new Set());
  const [infoAuf, setInfoAuf] = useState(false);
  const [ich, setIch] = useState('');
  const [neueMail, setNeueMail] = useState<NeueMail | null>(null);
  const [antwortStart, setAntwortStart] = useState<string | null>(null);
  const [frage, setFrage] = useState('');
  const [sucheAuf, setSucheAuf] = useState(false);
  const suchFeld = useRef<HTMLInputElement>(null);
  const sucht = frage.trim().length >= 2;
  const breit = useBreit();
  const handy = useHandy();
  const { melden, hinweis } = useRueckgaengig();
  const { state, dispatch } = useTasks();

  // Sicht (space) UND Bereich gehen beide an den Server — er filtert; die Oberfläche blendet nie bloß aus.
  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (space) q.set('space', space);
    if (bereich) { q.set('bereich', bereich); if (pfWahl) q.set('postfach', pfWahl); }
    else if (merker?.ohne.length) q.set('ohne', merker.ohne.join(','));
    return q.toString();
  }, [bereich, pfWahl, space, merker?.ohne]);
  const url = `/api/inbox${filterQuery ? `?${filterQuery}` : ''}`;

  const laden = useCallback(async () => {
    const r = await holen<StromAntwort>(url);
    if (r.d.ok) { setS(r.d as StromAntwort); setFehler(''); setWeg(new Set()); } else setFehler(String(r.d.fehler ?? 'Die Inbox ließ sich nicht laden.'));
  }, [url]);
  // Erster Abgleich eines Postfachs läuft („neu“): alle 10 s nachsehen, sonst alle 60 s.
  const holt = useMemo(() => (s?.postfaecher ?? []).filter(p => p.zustand.stufe === 'neu' && p.quelle !== 'whatsapp'), [s]);
  const takt = holt.length ? 10_000 : 60_000;
  const merkerDa = merker !== null;
  useEffect(() => {
    if (!merkerDa) return; // erst die Merker lesen — sonst holt die Inbox zweimal
    void laden();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, takt);
    return () => clearInterval(t);
  }, [laden, takt, merkerDa]);
  useEffect(() => { void holen<{ ich?: { speicher?: string } }>('/api/konto/ich').then(r => { if (typeof r.d.ich?.speicher === 'string') setIch(r.d.ich.speicher); }); }, []);
  // Link aus dem alten Verlauf: `?offen=gmail-<Nachricht>` → das Gespräch dazu.
  useEffect(() => {
    if (offenId?.startsWith('gmail-')) void holen<{ id?: string }>(`/api/inbox/gespraech?gmail=${encodeURIComponent(offenId.slice(6))}`).then(r => setOffenId(r.d.ok && r.d.id ? r.d.id : null));
  }, [offenId, setOffenId]);
  // „In der Inbox schreiben“ aus Akte/Prospecting.
  useEffect(() => { if (params.get('neu') === '1') { const m = neueMailHolen(); if (m) setNeueMail(m); } }, [params]);

  const sichtbar = useMemo(() => (s?.gespraeche ?? []).filter(g => !weg.has(g.id)), [s, weg]);
  const passt = (g: GespraechZeile) => !filter || ((filter.bereich === null || g.bereich === filter.bereich) && (filter.fach === 'nachfassen' ? g.fach === 'warten' && g.nachfassen : filter.fach === 'wiedervorlage' ? g.wiedervorlage === 'faellig' : g.fach === filter.fach));
  const arbeit = sichtbar.filter(g => g.inArbeit && passt(g));
  const gruppen: { id: string; titel: string; farbe: string; liste: GespraechZeile[]; eingeklappt?: boolean }[] = useMemo(() => {
    const wv = arbeit.filter(g => g.wiedervorlage === 'faellig');
    const rest = arbeit.filter(g => g.wiedervorlage !== 'faellig');
    const nurWarten = filter?.fach === 'warten';
    return [
      { id: 'wv', titel: 'Wiedervorlage fällig', farbe: LEUCHT.achtung, liste: sortieren(wv) },
      { id: 'antworten', titel: FACH_LABEL.antworten, farbe: KUGEL.granat, liste: sortieren(rest.filter(g => g.fach === 'antworten')) },
      { id: 'warten', titel: nurWarten ? FACH_LABEL.warten : 'Nachfassen fällig', farbe: LEUCHT.achtung, liste: sortieren(rest.filter(g => g.fach === 'warten' && (nurWarten || g.nachfassen))) },
      { id: 'termine', titel: FACH_LABEL.termine, farbe: LEUCHT.planung, liste: sortieren(rest.filter(g => g.fach === 'termine')) },
      { id: 'geld', titel: FACH_LABEL.geld, farbe: LEUCHT.geld, liste: sortieren(rest.filter(g => g.fach === 'geld')) },
      { id: 'neu', titel: FACH_LABEL.neu, farbe: C.inkDim, liste: sortieren(rest.filter(g => g.fach === 'neu')) },
      { id: 'info', titel: FACH_LABEL.info, farbe: C.inkLeise, liste: sortieren(rest.filter(g => g.fach === 'info')), eingeklappt: !infoAuf && filter?.fach !== 'info' },
    ].filter(x => x.liste.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbeit.map(g => g.id).join('|'), infoAuf, filter]);
  // „Neueste zuerst“: Tag-Gruppen (Heute · Gestern · Diese Woche · Älter), darin ungelesen zuerst — auch ein Lage-Filter wirkt hier.
  const chrono = useMemo(() => (s ? nachTagen(fuerZeigen(sichtbar.filter(passt), zeigen), s.heute) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sichtbar, zeigen, filter, s?.heute]);
  // Lange Tage-Gruppen zeigen erst 60 Zeilen — sichtbar mit „weitere n zeigen“, nie still gekürzt.
  const [mehrJe, setMehrJe] = useState<Record<string, number>>({});
  const chronoGezeigt = chrono.map(gr => ({ ...gr, gezeigt: gr.liste.slice(0, mehrJe[gr.id] ?? 60) }));
  const reihe = ordnung === 'neueste' ? chronoGezeigt.flatMap(g => g.gezeigt) : gruppen.flatMap(g => (g.eingeklappt ? [] : g.liste));
  const offen = offenId ? sichtbar.find(g => g.id === offenId) ?? null : null;
  const offeneUebergabe = istUebergabeId(offenId) ? offenId : null;

  const tun = useCallback(async (g: GespraechZeile, was: 'erledigt' | 'spaeter', bis?: string) => {
    setWeg(w => new Set(w).add(g.id));
    if (offenId === g.id) { const i = reihe.findIndex(x => x.id === g.id); setOffenId(reihe[i + 1]?.id ?? null); }
    const r = await aktion(g.id, was, bis ? { bis } : {});
    if (!r.d.ok) { setWeg(w => { const n = new Set(w); n.delete(g.id); return n; }); melden(String(r.d.fehler ?? 'Das ging nicht.')); return; }
    melden(was === 'erledigt' ? `Erledigt: ${g.betreff}` : `Wiedervorlage ${bis?.slice(8, 10)}.${bis?.slice(5, 7)}.: ${g.betreff}`, () => { void aktion(g.id, 'zurueck').then(() => laden()); });
    void laden();
  }, [offenId, reihe, setOffenId, melden, laden]);
  const aufgabeAus = useCallback((g: GespraechZeile) => {
    if (!ich) { melden('Dein Konto lädt noch — gleich noch einmal.'); return; }
    const link = gespraechPfad(g.id);
    if (state.tasks.some(t => t.status !== 'done' && (t.description ?? '').includes(link))) { melden(`Aufgabe gab es schon: ${g.betreff}`); return; }
    const v = aufgabeAusGespraech(g, g.frist?.datum);
    dispatch({ type: 'ADD_TASK', payload: { projectId: state.projects[0]?.id ?? '', ...v, status: 'todo', assignee: ich as Owner, tags: [], subTasks: [], dependencies: [], sortOrder: 0 } });
    melden(`Aufgabe angelegt: ${v.title}`);
  }, [state, dispatch, ich, melden]);
  const screener = async (g: GespraechZeile, was: 'zulassen' | 'blocken') => {
    setWeg(w => new Set(w).add(g.id));
    const r = await aktion(g.id, was);
    melden(String(r.d.ok ? r.d.text : r.d.fehler ?? 'Das ging nicht.'), r.d.ok ? () => { void aktion(g.id, 'offen').then(() => laden()); } : undefined);
    void laden();
  };

  // Tasten (Superhuman-Muster)
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const ziel = ev.target as HTMLElement | null;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ziel?.tagName === 'INPUT' || ziel?.tagName === 'TEXTAREA' || ziel?.tagName === 'SELECT' || ziel?.isContentEditable || ansicht !== 'liste') return;
      // „/“ öffnet die Suche (wie in Gmail/Superhuman).
      if (ev.key === '/') { ev.preventDefault(); setSucheAuf(true); setTimeout(() => suchFeld.current?.focus(), 0); return; }
      const k = ev.key.toLowerCase();
      const i = offenId ? reihe.findIndex(g => g.id === offenId) : -1;
      if (k === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); const n = reihe[Math.min(reihe.length - 1, i + 1)]; if (n) setOffenId(n.id); return; }
      if (k === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); const n = reihe[Math.max(0, i - 1)]; if (n) setOffenId(n.id); return; }
      if (k === 'escape') { setOffenId(null); return; }
      if (k === 'enter' && i < 0 && reihe[0]) { setOffenId(reihe[0].id); return; }
      if (i < 0) return;
      const g = reihe[i];
      if (k === 'e') { ev.preventDefault(); void tun(g, 'erledigt'); }
      else if (k === 's') { ev.preventDefault(); void tun(g, 'spaeter', tagIn(1)); }
      else if (k === 'a') { ev.preventDefault(); aufgabeAus(g); }
      else if (k === 'r') { ev.preventDefault(); setAntwortStart(g.id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reihe, offenId, setOffenId, tun, aufgabeAus, ansicht]);

  const namen = useMemo<Record<string, string>>(() => Object.fromEntries([
    ...(s?.bereiche ?? []).map(b => [b.id, b.name]),
    ...(s?.leiste ?? []).flatMap(e => (e.id ? [[e.id, e.name]] : [])),
  ]), [s]);
  const bereichWort = (b: string | null) => (b ? namen[b] ?? b : 'Ohne Bereich');
  // Bereichs-Leiste und Etiketten (09.10.): Namen, Farben und Zähler kommen vom Server (`leiste`), die Farbe der Bereiche aus ansicht.ts.
  const leiste = useMemo(() => (s?.leiste ?? []).filter(e => e.id !== null), [s]);
  const eintrag = bereich ? leiste.find(e => e.id === bereich) ?? null : null;
  const pfName = useMemo<Record<string, string>>(() => Object.fromEntries((s?.leiste ?? []).flatMap(e => e.postfaecher.map(p => [p.id, p.name]))), [s]);
  const pfZahl = (s?.leiste ?? []).reduce((n, e) => n + e.postfaecher.length, 0);
  const zeigeBereich = !bereich && (s?.leiste?.length ?? 0) > 1;
  const zeigePf = !pfWahl && (bereich ? (eintrag?.postfaecher.length ?? 0) > 1 : pfZahl > 1);
  /** Ruhiges Etikett vor dem Ausschnitt: Bereich (in seiner Farbe) · Postfach — nur, wenn die Sicht mehr als eines zeigt. */
  const etikett = (g: GespraechZeile): ReactNode => {
    const pf = zeigePf ? pfName[g.postfachId] : undefined;
    if (!zeigeBereich && !pf) return null;
    return (
      <span data-inbox="etikett">
        {zeigeBereich && <span style={{ color: bereichFarbe(g.bereich), fontWeight: 600 }}>{bereichWort(g.bereich)}</span>}
        {zeigeBereich && pf ? <span style={{ color: C.inkLeise }}> · </span> : null}
        {pf ? <span style={{ color: C.inkDim }}>{pf}</span> : null}
        <span style={{ color: C.inkLeise }}> — </span>
      </span>
    );
  };

  const zeile = (g: GespraechZeile, gruppe: string, chronologisch = false) => {
    const wa = g.quelle === 'whatsapp' && g.whatsapp ? g.whatsapp : null;
    const ruhe = chronologisch ? ruheText(g) : null;
    const text = g.fach === 'warten'
      ? `${g.vonUns ? 'Du hast geschrieben' : 'Automatische Antwort'} · seit ${g.wartetTage} ${g.wartetTage === 1 ? 'Tag' : 'Tagen'} keine Antwort`
      : `${g.team?.kuemmert ? `${g.team.kuemmert.person === ich ? 'du kümmerst dich' : `${g.team.kuemmert.name} kümmert sich`} · ` : ''}${g.frist ? `bis ${g.frist.datum.slice(8, 10)}.${g.frist.datum.slice(5, 7)}. · ` : ''}${wa ? `WhatsApp · ${fensterKurz(wa.fenster)} — ` : ''}${g.zuordnung?.firma ? `${g.zuordnung.firma} — ` : g.fach === 'neu' && !wa ? `${g.gegenueber.email} — ` : ''}${handy ? g.ausschnitt.slice(0, 80) + (g.ausschnitt.length > 80 ? ' …' : '') : g.ausschnitt}`;
    // In „Neueste zuerst“ sagt die Zeile, in welchem Fach das Gespräch liegt (bzw. warum es ruht) — die Ordnung der Fächer bleibt sichtbar.
    const fachWort = chronologisch ? (ruhe ?? (g.fach === 'geblockt' ? null : FACH_LABEL[g.fach])) : null;
    const unter = <>{etikett(g)}{fachWort ? <span style={{ color: C.inkLeise }}>{fachWort} · </span> : null}{text}</>;
    // WhatsApp: der „Betreff“ ist der Anfang der Nachricht (steht schon unten) — oben stattdessen die Nummer.
    const betreffFarbe = g.ungelesen ? C.inkDim : C.inkLeise;
    const titel = wa
      ? <><span style={{ color: KUGEL.smaragd, marginRight: 6 }}><WaSymbol groesse={14} /></span><span style={{ fontWeight: g.ungelesen ? 700 : 500 }}>{nameVon(g)}</span>{nameVon(g) !== g.gegenueber.email ? <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}> · {nummerAnzeige(wa.nummer)}</span> : null}<span style={{ color: C.inkLeise }}>{g.anzahl > 1 ? ` (${g.anzahl})` : ''}</span></>
      : <><span style={{ fontWeight: g.ungelesen ? 700 : 500 }}>{nameVon(g)}</span><span style={{ color: betreffFarbe, fontWeight: g.ungelesen ? 600 : 400 }}> · {g.betreff}{g.anzahl > 1 ? ` (${g.anzahl})` : ''}</span></>;
    const screenerHier = gruppe === 'neu' || (chronologisch && g.fach === 'neu' && g.inArbeit);
    const inhalt = (
      <Zeile onClick={() => setOffenId(offenId === g.id ? null : g.id)} aktiv={offenId === g.id}
        links={<Punkt farbe={g.ungelesen ? KUGEL.granat : g.fach === 'warten' && g.nachfassen ? LEUCHT.achtung : C.linie} />}
        titel={titel}
        unter={unter}
        rechts={screenerHier && !handy ? (
          <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <Knopf leise onClick={() => screener(g, 'zulassen')}>Zulassen</Knopf>
            <Knopf leise onClick={() => screener(g, 'blocken')}>Blocken</Knopf>
          </span>
        ) : <span style={{ fontSize: TYP.bedien, color: g.ungelesen ? C.ink : C.inkLeise, fontWeight: g.ungelesen ? 600 : 400, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>{zeitKurz(g.am)}</span>} />
    );
    return (
      <div key={g.id} style={ruhe ? { opacity: 0.62 } : undefined} data-inbox-zeile={g.ungelesen ? 'ungelesen' : 'gelesen'}>
        <Wisch an={handy && g.inArbeit} rechts={() => void tun(g, 'erledigt')} links={() => void tun(g, 'spaeter', tagIn(1))}>{inhalt}</Wisch>
        {screenerHier && handy && (
          <div style={{ display: 'flex', gap: 8, padding: '0 0 10px 22px' }}>
            <Knopf leise onClick={() => screener(g, 'zulassen')}>Zulassen</Knopf>
            <Knopf leise onClick={() => screener(g, 'blocken')}>Blocken</Knopf>
          </div>
        )}
      </div>
    );
  };

  const anmeldung = (s?.postfaecher ?? []).filter(p => p.zustand.stufe === 'anmeldung');
  const lageZahl = (s?.lage ?? []).reduce((n, l) => n + l.antworten, 0);
  const uebergaben = s?.uebergaben ?? [];
  const nichtsOffen = !!s && s.postfaecher.length > 0 && !arbeit.filter(g => g.fach !== 'info').length && !filter && !uebergaben.some(u => u.status !== 'erledigt') && !(holt.length && !sichtbar.length);
  const mitInhalt = !!s && (s.postfaecher.length > 0 || uebergaben.length > 0);
  const unzugeordnet = s?.unzugeordnet ?? [];
  /** Ein Bereich aus der Adresse, den diese Sicht nicht kennt (alter Link, anderer Space): klar sagen statt leer. */
  const fremderBereich = !!s && !!bereich && !eintrag;
  const alleUngelesen = (s?.leiste ?? []).reduce((n, e) => n + e.ungelesen, 0);
  const zaehler = (n: number) => (n > 0 ? <span style={{ marginLeft: 6, color: KUGEL.granat, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} title={`${n} ungelesen`}>{n}</span> : null);
  const leisteIds = leiste.map(e => e.id as string);
  const ohne = (merker?.ohne ?? []).filter(id => leisteIds.includes(id));

  /** Postfach einem Bereich zuordnen — der vorhandene Schreibweg der Postfächer (`einstellen`), danach dorthin wechseln. */
  const zuordnen = async (id: string, b: { id: string; name: string }, name: string) => {
    const r = await senden<{ text?: string }>('/api/inbox/postfaecher', { aktion: 'einstellen', id, bereich: b.id });
    if (!r.d.ok) { melden(String(r.d.fehler ?? 'Das ging nicht — nichts geändert.')); return; }
    melden(`${name} gehört jetzt zu ${b.name}.`);
    // Die wählbaren Bereiche gehören zur Sicht (Server: `waehlbar`) — also gleich dorthin, wo die Post jetzt steht.
    geheZu(b.id);
  };
  const zuordnenKarten = unzugeordnet.length > 0 && (
    <div style={{ display: 'grid', gap: 10 }} data-inbox="unzugeordnet">
      {unzugeordnet.map(p => {
        const wer = p.quelle === 'gmail' ? 'Dein Gmail' : `Dein Postfach „${p.anzeigename}“`;
        const wahl = s?.waehlbar ?? [];
        return (
          <Hinweis key={p.id} art="achtung" titel={`${wer}${p.adresse ? ` (${p.adresse})` : ''} ist noch keinem Bereich zugeordnet — jetzt zuordnen`}
            aktion={!wahl.length ? <Knopf leise onClick={() => setAnsicht('postfaecher')}>Postfächer</Knopf> : undefined}>
            <div>{p.nachrichten ? `${p.nachrichten} ${p.nachrichten === 1 ? 'Nachricht wartet' : 'Nachrichten warten'}` : 'Die Post wartet'} — sobald das Postfach einen Bereich hat, steht sie dort und trägt sein Label.{!wahl.length ? ' In dieser Sicht gibt es keinen passenden Bereich — unter „Postfächer“ zuordnen.' : ''}</div>
            {wahl.length > 0 && (
              <div className="ui-pillen" style={{ marginTop: 10 }}>
                {wahl.map(b => <Wahl key={b.id} klein an={false} farbe={bereichFarbe(b.id)} onClick={() => void zuordnen(p.id, b, p.quelle === 'gmail' ? 'Gmail' : p.anzeigename)}>{b.name}</Wahl>)}
              </div>
            )}
          </Hinweis>
        );
      })}
    </div>
  );
  const naechsteWv = (s?.gespraeche ?? []).map(g => g.wiedervorlage).filter((x): x is string => !!x && x !== 'faellig').sort()[0];

  const kopfRechts = (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {ansicht === 'liste' && handy && <SymbolKnopf ariaLabel={sucheAuf ? 'Suche schließen' : 'In der Inbox suchen'} onClick={() => { if (sucheAuf) { setSucheAuf(false); setFrage(''); } else { setSucheAuf(true); setTimeout(() => suchFeld.current?.focus(), 0); } }}>{sucheAuf ? '✕' : '⌕'}</SymbolKnopf>}
      {ansicht === 'liste' ? <Knopf leise onClick={() => setAnsicht('postfaecher')}>Postfächer</Knopf> : <Knopf leise onClick={() => setAnsicht('liste')}>‹ Zur Inbox</Knopf>}
      {ansicht === 'liste' && <span className="ui-nur-breit"><Knopf leise onClick={async () => { melden('Gleicht ab …'); const r = await senden<{ fehler?: number }>('/api/inbox', { aktion: 'abgleichen' }); melden(r.d.ok ? 'Abgeglichen.' : String(r.d.fehler ?? 'Abgleich ging nicht.')); void laden(); }}>Abgleichen</Knopf></span>}
    </span>
  );

  if (ansicht === 'postfaecher') {
    return (
      <Seite titel="Postfächer" unter="Verbinden, Bereich festlegen, Verbindung erneuern — Passwörter liegen verschlüsselt auf dem Server." rechts={kopfRechts}>
        <Postfaecher space={space} onGeaendert={() => void laden()} meldung={t => melden(t)} />
        {hinweis}
      </Seite>
    );
  }

  const liste = sucht ? (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      <SuchErgebnisse frage={frage.trim()} filter={filterQuery} offenId={offenId} onOeffnen={id => setOffenId(id)} />
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      {!!s && s.postfaecher.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }} data-inbox="ordnung">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Segmente liste={ORDNUNGEN} aktiv={ordnung} onWahl={o => merkerSetzen({ ordnung: o })} />
            {ordnung === 'neueste' && <Pillen einzeilig liste={ZEIGEN.map(z => ({ id: z.id, label: z.label }))} aktiv={zeigen} onWahl={z => merkerSetzen({ zeigen: z })} />}
            {!bereich && leiste.length > 1 && (
              <Knopf leise onClick={() => setOhneAuf(x => !x)}>{ohne.length ? `${leiste.length - ohne.length} von ${leiste.length} Bereichen` : 'Bereiche in „Alle“'}{ohneAuf ? ' ▴' : ' ▾'}</Knopf>
            )}
          </div>
          {!bereich && leiste.length > 1 && ohneAuf && (
            <div data-inbox="bereiche-auswahl">
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>In „Alle“ zeigen (gemerkt in diesem Browser):</div>
              <MehrfachPillen liste={leiste.map(e => ({ id: e.id as string, label: e.name }))} aktiv={leisteIds.filter(id => !ohne.includes(id))}
                onWahl={ids => { if (!ids.length) { melden('Mindestens ein Bereich bleibt sichtbar.'); return; } merkerSetzen({ ohne: leisteIds.filter(id => !ids.includes(id)) }); }} />
            </div>
          )}
        </div>
      )}
      <UebergabenKarte liste={uebergaben} offenId={offenId} onOeffnen={setOffenId} i={0} person={ich} />
      {filter && (
        <Hinweis art="info" aktion={<Knopf leise onClick={() => setFilter(null)}>Alle zeigen</Knopf>}>
          Gefiltert: {filter.fach === 'nachfassen' ? 'Nachfassen fällig' : filter.fach === 'wiedervorlage' ? 'Wiedervorlage' : FACH_LABEL[filter.fach]}{filter.bereich !== null ? ` · ${bereichWort(filter.bereich)}` : ''}
        </Hinweis>
      )}
      {holt.length > 0 && !sichtbar.length && (
        <Karte i={0} dicht><div data-inbox="holt"><Leer symbol="⟳">Post wird geholt … — {holt.map(p => p.anzeigename).join(', ')}: die letzten 30 Tage kommen gleich. Die Inbox lädt von selbst nach.</Leer></div></Karte>
      )}
      {holt.length > 0 && sichtbar.length > 0 && <Hinweis art="info" rolle="status">Post wird noch geholt ({holt.map(p => p.anzeigename).join(', ')}) — es kommt gleich mehr dazu.</Hinweis>}
      {ordnung === 'faecher' && nichtsOffen && (
        <Leerzustand symbol="✓" titel="Inbox leer" ton={KUGEL.smaragd}>
          Nichts wartet auf dich.{naechsteWv ? ` Nächste Wiedervorlage am ${naechsteWv.slice(8, 10)}.${naechsteWv.slice(5, 7)}.` : ''}{(s?.lage ?? []).some(l => l.warten) ? ' Einige Gespräche warten auf eine Antwort von anderen.' : ''}
        </Leerzustand>
      )}
      {ordnung === 'faecher' && filter && !arbeit.length && <Karte i={0}><Leer>In diesem Fach ist gerade nichts.</Leer></Karte>}
      {ordnung === 'neueste' && !!s && s.postfaecher.length > 0 && !chrono.length && !(holt.length && !sichtbar.length) && (
        <Karte i={0}><Leer symbol="✓">{zeigen === 'ungelesen' ? 'Nichts Ungelesenes.' : zeigen === 'offen' ? 'Nichts offen.' : 'Hier ist noch keine Post.'}{zeigen !== 'alle' ? ' „Auch Erledigtes“ zeigt alles, was gekommen ist.' : ''}</Leer></Karte>
      )}
      {ordnung === 'neueste' && chronoGezeigt.map((gr, i) => {
        const neu = gr.liste.filter(g => g.ungelesen).length;
        const rest = gr.liste.length - gr.gezeigt.length;
        return (
          <Karte key={gr.id} i={i} dicht>
            <Ueberschrift farbe={neu ? KUGEL.granat : C.inkLeise} rechts={`${gr.liste.length}${neu ? ` · ${neu} ungelesen` : ''}`}>{gr.titel}</Ueberschrift>
            <Liste>{gr.gezeigt.map(g => zeile(g, gr.id, true))}</Liste>
            {rest > 0 && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehrJe(m => ({ ...m, [gr.id]: (m[gr.id] ?? 60) + 100 }))}>weitere {Math.min(rest, 100)} von {rest} zeigen</Knopf></div>}
          </Karte>
        );
      })}
      {ordnung === 'faecher' && gruppen.map((gr, i) => (
        <Karte key={gr.id} i={i} dicht>
          <Ueberschrift farbe={gr.farbe} rechts={gr.id === 'info' ? (
            <span style={{ display: 'flex', gap: 6 }}>
              <Knopf leise onClick={() => setInfoAuf(x => !x)}>{gr.eingeklappt ? `${gr.liste.length} anzeigen` : 'einklappen'}</Knopf>
              <Knopf leise onClick={async () => { const ids = gr.liste.map(g => g.id); setWeg(w => new Set([...w, ...ids])); const r = await senden<{ erledigt?: number; fehler?: number }>('/api/inbox', { aktion: 'alle-erledigen', ids }); melden(r.d.ok ? `${r.d.erledigt ?? 0} erledigt${r.d.fehler ? ` · ${r.d.fehler} ging nicht` : ''}.` : String(r.d.fehler ?? 'Das ging nicht.')); void laden(); }}>alle erledigen</Knopf>
            </span>
          ) : `${gr.liste.length}`}>{gr.titel}</Ueberschrift>
          {gr.eingeklappt ? <Leer>Newsletter und Automatisches — {gr.liste.length} {gr.liste.length === 1 ? 'Gespräch' : 'Gespräche'}, die keine Entscheidung brauchen.</Leer> : <Liste>{gr.liste.map(g => zeile(g, gr.id))}</Liste>}
        </Karte>
      ))}
    </div>
  );

  // Kopf des Gesprächs: Bereich (Farbe) und Postfach — wohin die Antwort geht, steht immer da.
  const kopfEtikett = (g: GespraechZeile) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }} data-inbox="gespraech-etikett">
      <Chip farbe={bereichFarbe(g.bereich)}>{bereichWort(g.bereich)}</Chip>
      {pfName[g.postfachId] && pfZahl > 1 ? <Chip farbe={C.inkDim}>{pfName[g.postfachId]}</Chip> : null}
    </div>
  );
  const detail = offen ? (
    <Karte i={1} akzent={KUGEL.granat}>
      {kopfEtikett(offen)}
      <GespraechAnsicht key={`${offen.id}-${antwortStart === offen.id ? 'r' : ''}`} id={offen.id} person={ich} meldung={melden} onGeaendert={() => void laden()} onZurueck={() => setOffenId(null)} startAntwort={antwortStart === offen.id} />
    </Karte>
  ) : offeneUebergabe ? (
    <Karte i={1} akzent={KUGEL.granat}>
      <UebergabeAnsicht key={offeneUebergabe} id={offeneUebergabe} person={ich} meldung={melden} onGeaendert={() => void laden()} onZurueck={() => setOffenId(null)} />
    </Karte>
  ) : null;
  const istOffen = !!offen || !!offeneUebergabe;
  const suchZeile = (!handy || sucheAuf) ? <div style={{ marginBottom: 14 }}><SuchFeld ref={suchFeld} wert={frage} onAendern={t => { setFrage(t); if (!t && handy) setSucheAuf(false); }} /></div> : null;

  return (
    <Seite titel="Inbox" unter={lageZahl > 0 ? `${lageZahl} ${lageZahl === 1 ? 'Gespräch braucht' : 'Gespräche brauchen'} eine Antwort.` : undefined} rechts={kopfRechts}>
      {fehler && <div style={{ marginBottom: 12 }}><Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal</Knopf>}>{fehler}</Hinweis></div>}
      {!s && !fehler && <Karte i={0}><Leer>lädt …</Leer></Karte>}
      {zuordnenKarten && <div style={{ marginBottom: 14 }}>{zuordnenKarten}</div>}
      {fremderBereich && (
        <div style={{ marginBottom: 14 }}>
          <Hinweis art="info" aktion={<Knopf leise onClick={() => geheZu(null)}>Alle zeigen</Knopf>}>Dieser Bereich hat in dieser Sicht keine Postfächer.</Hinweis>
        </div>
      )}
      {/* Bereichs-Leiste (09.10.): „Alle“ + je Bereich mit Postfächern, Zähler = ungelesen. Am Handy wischbar; mit offenem Gespräch nur am Rechner. */}
      {leiste.length > 0 && (breit || !istOffen) && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          <nav aria-label="Bereiche der Inbox" className="ui-reiter-zeile" data-inbox="bereiche">
            <Reiter ariaLabel="Bereiche der Inbox" aktiv={bereich ?? ALLE} onWahl={id => geheZu(id === ALLE ? null : id)}
              liste={[{ id: ALLE, label: <>Alle{zaehler(alleUngelesen)}</> }, ...leiste.map(e => ({ id: e.id as string, label: <>{e.name}{zaehler(e.ungelesen)}</>, farbe: e.farbe }))]} />
          </nav>
          {eintrag && eintrag.postfaecher.length > 1 && (
            <Pillen einzeilig liste={[{ id: ALLE, label: 'Alle Postfächer' }, ...eintrag.postfaecher.map(p => ({ id: p.id, label: p.name }))]} aktiv={pfWahl ?? ALLE} onWahl={id => geheZu(bereich, id === ALLE ? null : id)} />
          )}
        </div>
      )}
      {s && !s.postfaecher.length && !uebergaben.length && !unzugeordnet.length && !fremderBereich && (
        <Leerzustand symbol="✉" titel="Verbinde dein erstes Postfach" ton={KUGEL.granat} aktion={<Knopf haupt onClick={() => setAnsicht('postfaecher')}>Postfach verbinden</Knopf>}>
          iCloud, IONOS, Google Workspace oder ein anderer Anbieter — MAKE OS holt die Post selbst, sortiert sie in Fächer und zeigt, was gerade passiert.
        </Leerzustand>
      )}
      {/* Mit offenem Gespräch tritt das Lagebild zurück (Esc bzw. „Zurück“ holt es wieder) — das Gespräch steht oben. */}
      {mitInhalt && suchZeile}
      {s && s.postfaecher.length > 0 && !istOffen && !sucht && (
        <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          <Karte i={0} ton={lageZahl ? KUGEL.granat : KUGEL.smaragd} dicht>
            <Ueberschrift farbe={lageZahl ? KUGEL.granat : KUGEL.smaragd}>Lage</Ueberschrift>
            <div style={{ display: 'grid', gap: 10 }} data-inbox="lage">
              {s.lage.length === 0 && <div style={{ fontSize: TYP.body, color: C.inkDim }}>Nichts offen.</div>}
              {s.lage.map(l => (
                <div key={String(l.bereich)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, marginRight: 4 }}>{bereichWort(l.bereich)}</span>
                  {l.wiedervorlage > 0 && <Knopf leise farbe={LEUCHT.achtung} onClick={() => setFilter({ fach: 'wiedervorlage', bereich: l.bereich })}>{l.wiedervorlage} wieder dran</Knopf>}
                  {LAGE_TEILE.filter(t => l[t.feld] > 0).map(t => <Knopf key={t.feld} leise farbe={t.feld === 'antworten' ? KUGEL.granat : undefined} onClick={() => setFilter({ fach: t.fach, bereich: l.bereich })}>{t.text(l[t.feld])}</Knopf>)}
                  {l.nachfassen > 0 && <Knopf leise farbe={LEUCHT.achtung} onClick={() => setFilter({ fach: 'nachfassen', bereich: l.bereich })}>{l.nachfassen} nachfassen</Knopf>}
                  {!LAGE_TEILE.some(t => l[t.feld] > 0) && !l.wiedervorlage && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>nichts offen</span>}
                </div>
              ))}
              <button type="button" disabled={!s.zoe.gespraech} onClick={() => s.zoe.gespraech && setOffenId(s.zoe.gespraech)} data-inbox="zoe-satz"
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: '6px 0 0', minHeight: 44, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, lineHeight: 1.45, cursor: s.zoe.gespraech ? 'pointer' : 'default' }}>
                <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, display: 'block' }}>ZOE schlägt vor</span>
                {s.zoe.text}{s.zoe.gespraech ? ' ›' : ''}
              </button>
              <AufgabenVorschlaege meldung={t => melden(t)} space={space} />
            </div>
          </Karte>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} data-inbox="postfach-leiste">
            {s.postfaecher.map(p => (
              <button key={p.id} type="button" onClick={() => setAnsicht('postfaecher')} title={STUFE_TEXT[p.zustand.stufe]}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 12px', borderRadius: 999, border: `1px solid ${C.linie}`, background: 'rgba(255,255,255,.03)', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' }}>
                <Punkt farbe={STUFE_FARBE[p.zustand.stufe]} />{p.anzeigename}{p.zustand.stufe !== 'aktuell' ? <span style={{ color: C.inkLeise }}>· {STUFE_TEXT[p.zustand.stufe]}</span> : null}
              </button>
            ))}
          </div>
          {anmeldung.length > 0 && (
            <Hinweis art="kritisch" rolle="alert" titel="Verbindung erneuern" aktion={<Knopf onClick={() => setAnsicht('postfaecher')}>Verbindung erneuern</Knopf>}>
              {anmeldung.map(p => p.anzeigename).join(', ')}: der Anbieter hat die Anmeldung abgelehnt. Bei iCloud heißt das meist: nach einem Wechsel des Apple-Passworts ein neues App-spezifisches Passwort eintragen.
            </Hinweis>
          )}
          {neueMail && (
            <Karte i={0}>
              <Antwort allen={false} meldung={t => melden(t)} onZu={() => setNeueMail(null)} onGesendet={() => { setNeueMail(null); void laden(); }}
                v={{ betreff: neueMail.betreff ?? '', von: [], postfaecher: s.postfaecher.filter(p => p.quelle !== 'whatsapp' && p.zustand.stufe !== 'anmeldung').map(p => ({ id: p.id, name: `${p.anzeigename} · ${p.bereichName}` })), start: { an: neueMail.an, text: neueMail.text, betreff: neueMail.betreff } }} />
            </Karte>
          )}
        </div>
      )}
      {/* Rechner: ohne offenes Gespräch die Liste in voller Breite; mit Gespräch Liste ⅓ · Gespräch + Kontext ⅔ (Front-Muster). */}
      {mitInhalt && (breit && istOffen ? (
        <Spalten verhaeltnis="1:2"><Spalte>{liste}</Spalte><Spalte klebt>{detail}</Spalte></Spalten>
      ) : istOffen ? detail : liste)}
      {s && s.postfaecher.length > 0 && !istOffen && !sucht && <div style={{ marginTop: 18 }}><FlussKarte bereich="inbox" farbe={KUGEL.granat} /></div>}
      {mitInhalt && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 18 }}>Tasten: / suchen · j/k wandern · e erledigt · s später · a Aufgabe · r antworten{handy ? ' · Wischen: rechts erledigt, links morgen' : ''}</div>}
      {hinweis}
    </Seite>
  );
}

