'use client';

import Link from 'next/link';
// ─── MAKE OS — ZOE (schwebend, frei beweglich) ───────────────────────────
// Vorgabe: nicht starr — flexibel. Unten schwebt ein kleines, sanft
// pulsierendes Icon, das auf jeder /os-Seite mitgeht. Ein Klick öffnet den
// Chat in Normalgröße; an der oberen linken Ecke zieht man ihn stufenlos so
// groß, wie man arbeiten will, und am Kopf verschiebt man ihn frei über den
// Bildschirm. Der Rest der Oberfläche bleibt unberührt (Overlay, kein Layout).
// Fähigkeiten unverändert: Agenten ausführen, Aufgaben anlegen (Klick-
// Bestätigung), Blöcke direkt in den Planer legen (plan_block), Brain-Kontext.
//
// GEDÄCHTNIS (Vorgabe: „immer die Historie reingeben, damit wir das sauber
// haben"): jedes Gespräch liegt als Datei im Bestand, nicht mehr nur in der
// Sitzung. Beim Öffnen kommt der letzte Stand zurück, alte Gespräche stehen
// unter „Verlauf", und der bisherige Zug geht bei jeder Frage mit an die KI —
// vorher fing ZOE bei jeder Nachricht wieder bei null an.
//
// STIMME (Vorgabe: „und gleichzeitig auch mit ihm sprechen"): Mikrofon diktiert,
// ZOE liest seine Antwort vor, und im Freihand-Betrieb hört er nach dem
// Sprechen von selbst wieder zu — ein echtes Gespräch ohne Tastatur.
//
// 24.09.: auf das lebendige Muster umgezogen — Flächen wie die Karten, Chips,
// Knöpfe und Eingabe aus dem Standard (components/os/ui), ZOE-Lila für ihn, Teal für die
// Bedienung, Grün/Gelb/Rot für Zustand. Die Logik ist unverändert.
//
// 09.10. (Paket 4a): das Gedächtnis ist der ZOE-Thread der Person (`agenten-faeden--<person>`) — derselbe Thread wie im Empfang und auf
// der Agenten-Seite. Gesendet wird mit `zoeFaden`; der Server liest den Verlauf aus dem Thread (nie aus dem Browser) und legt Frage und
// Antwort selbst ab. Der alte Bestand `zoe-verlauf` wird beim ersten Lesen einmal übernommen (lib/agenten/zoe-faden.ts).
//
// 10.10. (Chat je Bereich, Auftrag: „ZOE unten so einstellen, dass sie den Chat immer passend zur Maske annimmt: im Sales der Head of Sales, im
// Marketing der Head of Marketing usw. — und dann können wir immer zu ZOE umschalten“): der Chat nimmt den Head an, der zur Seite passt
// (rein: lib/agenten/kontext-head.ts; welche Heads die Person nutzen DARF, sagt der Server: GET /api/agenten/chat). Mit einem Head spricht
// er über den vorhandenen Thread-Weg (POST /api/agenten/faden `senden` — derselbe Thread wie auf der Agenten-Seite, mit `space` und dem
// Bezug der Seite, nur Kennungen); „↔ ZOE“ schaltet um, beide Verläufe bleiben. Einstellung je Person (Verlauf ☰): „Passender Head“ oder
// „Immer ZOE“. Ein Seitenwechsel tauscht den Ansprechpartner erst, wenn keine Antwort mehr läuft.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Rich } from './Rich';
import { Chip, Knopf, Segmente, feld, LEUCHT, useSchwebendWeicht } from './ui';
import { KuerzelKugel, headFarbe } from './agenten/Avatar';
import { useChatKontext } from './chat/useChatKontext';
import { ansprechpartnerFuer, CHAT_WAHL_TEXT, type ChatHead, type ChatWahl, type PartnerSchluessel } from '@/lib/agenten/kontext-head';
import { WEG } from '@/lib/wege';
import { useSpace } from '@/hooks/useSpace';
import { useStimme } from '@/hooks/useStimme';
import { fuerStimme, titelAus, wannText } from '@/lib/make-one/zoe-verlauf';
import type { AgentRef, FadenKurz, Nachricht } from '@/lib/agenten/typen';
import { ZOE_FRAGEN_EREIGNIS, CRM_BEZUG_LABEL, crmBezugAus, type CrmBezug } from '@/lib/zoe/crm-bezug';
import { ZoeKugel, type ZoeZustand } from './kugel';
import { KUGEL } from '@/lib/make-one/design';

import { localDay } from '@/lib/zeit';
import { datumDe } from '@/lib/finanzen/haushalt/monat';
import { neueKennung, zufallsUuid } from '@/lib/kennung';
import { ENTSTEHEND_LEER, entstehendNach, type Entstehend } from '@/lib/http/sse';
import { postMitStrom } from '@/lib/http/strom-client';
/** Was ZOE aus einem Foto/PDF gelesen hat — Vorschlag, noch nicht gebucht. */
interface Beleg {
  richtung: 'eingang' | 'ausgang' | 'unklar';
  partner: string;
  datum?: string;
  betragBrutto?: number;
  betragNetto?: number;
  ustSatz?: number;
  waehrung?: string;
  rechnungsnummer?: string;
  zweck?: string;
  faellig?: string;
  kategorie?: string;
  unsicher?: string[];
  dateiname: string;
  /** Idempotenz (29.09., Paket D-A #19): einmal je gelesenem Beleg — ein erneuter Klick nach einem Netzfehler legt nichts doppelt an. */
  anfrageId?: string;
}

interface Handoff { agent: string; name: string; href: string; why: string }
interface Msg { role: 'user' | 'kimmi'; text: string; zeit?: string; handoffs?: Handoff[]; ran?: { agent: string; ok: boolean; gestapelt?: boolean }[] }
/** Ein Gespräch je Ansprechpartner (ZOE bzw. ein Head) — Umschalten behält beide (10.10.). `stand` = Stand des Threads (Head: 409 statt still). */
interface Gespraech { convo: Msg[]; id: string; stand: string; liste: FadenKurz[]; geladen: boolean }
const LEER_G: Gespraech = { convo: [], id: '', stand: '', liste: [], geladen: false };
const ZOE_VORSCHLAEGE = ['Plane meinen Tag', 'Was ist heute wichtig?', 'Was kann ich abgeben?'];
const HEAD_VORSCHLAEGE = ['Was ist hier gerade wichtig?', 'Was schlägst du als Nächstes vor?'];
interface Fenster { offen: boolean; w: number; h: number; right: number; bottom: number }

// ZOE-Lila für alles, was er selbst ist; Teal für das, was man drückt.
const J = LEUCHT.agenten;
const HAAR = 'rgba(255,255,255,.07)';
const FLAECHE = 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)';
const lbl: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
const MERKER_FENSTER = 'make-os-zoe-fenster';
const MERKER_STIMME = 'make-os-zoe-stimme';
const STANDARD: Fenster = { offen: false, w: 400, h: 560, right: 22, bottom: 22 };
const MIN_W = 320, MIN_H = 380;

/** Klickbare Pille im Chip-Stil — leuchtet in der Farbe, wenn sie „an" ist. */
const chip = (farbe: string, an = true): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, letterSpacing: '.02em',
  lineHeight: 1.2, whiteSpace: 'nowrap', background: an ? `${farbe}22` : 'rgba(255,255,255,.06)', color: an ? farbe : C.inkDim,
  border: 'none', borderRadius: 999, padding: '5px 11px', cursor: 'pointer', textDecoration: 'none',
});
const knopf = (aktiv?: boolean) => chip(C.aktiv, !!aktiv);
/** Runder Bedienknopf (Mikro, Beleg, Senden, Fenster). */
const rund: CSSProperties = { width: 32, height: 32, borderRadius: 10, flex: '0 0 auto', border: 'none', background: 'rgba(255,255,255,.06)', color: C.inkDim, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 14, padding: 0 };
const zahl: CSSProperties = { fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', color: C.ink };

/** Mikrofon — gezeichnet statt Emoji, damit es zum Rest der Oberfläche passt. */
function Mikro({ farbe }: { farbe: string }) {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      <rect x="4" y="1" width="5" height="8" rx="2.5" stroke={farbe} strokeWidth="1.3" />
      <path d="M1.6 7.2a4.9 4.9 0 0 0 9.8 0" stroke={farbe} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.5 12.1V14" stroke={farbe} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Orb({ size = 30, puls = false }: { size?: number; puls?: boolean }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'inline-block' }}>
      {puls && <span className="zoe-orb-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${J}` }} />}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${J}` }} />
      <span className={puls ? 'zoe-orb-kern' : undefined} style={{ position: 'absolute', inset: size * 0.28, borderRadius: '50%', background: J, boxShadow: `0 0 ${size * 0.4}px ${J}66` }} />
    </span>
  );
}

/**
 * ZOE als kleine Lichtkugel (05.10., UMBAU_ABEND_0410.md 1): dieselbe Kugel wie im Empfang, wenige Punkte, 24 Bilder je
 * Sekunde, pausiert außerhalb des Bildes und im Hintergrund-Tab. Ohne WebGL bleibt das bisherige Symbol (`Orb`).
 */
function ZoeSymbol({ size, zustand, puls }: { size: number; zustand: ZoeZustand; puls: boolean }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'inline-block' }}>
      <ZoeKugel groesse="symbol" zustand={zustand} rueckfall={<Orb size={size} puls={puls} />} />
    </span>
  );
}

/** Ein ZOE-Thread (Server) als Anzeige: die Person rechts, ZOE und die Hinweise („An … gesendet“, „Bericht von …“) links. */
const ausFaden = (ns: readonly Nachricht[]): Msg[] => ns.map(n => ({
  role: n.rolle === 'person' ? 'user' as const : 'kimmi' as const,
  text: n.text,
  zeit: n.zeit,
  ...(n.werkzeuge?.length ? { ran: n.werkzeuge.map(w => ({ agent: w.name, ok: w.ok, ...(w.gestapelt ? { gestapelt: true } : {}) })) } : {}),
}));
// Sicht Privat · Business (Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat“): ZOE-Threads nur des Bereichs im Kopf —
// der Server filtert (`?space=`, lib/agenten/sicht.ts `fadenImBereich`), auch beim Öffnen eines einzelnen Threads.
const zoeFaeden = (space: 'privat' | 'business') => `/api/agenten/faden?agent=zoe&space=${space}`;
/** Einen eigenen Thread laden (ZOE oder Head) — Nachrichten und Stand; nur aus dem Bereich `space`. */
const ladeThread = async (id: string, space: 'privat' | 'business'): Promise<{ nachrichten: Nachricht[]; stand: string } | null> => {
  try {
    const r = await fetch(`/api/agenten/faden?id=${encodeURIComponent(id)}&space=${space}`);
    if (!r.ok) return null;
    const d = await r.json() as { faden?: { nachrichten?: Nachricht[] }; stand?: string };
    return d.faden?.nachrichten ? { nachrichten: d.faden.nachrichten, stand: String(d.stand ?? '') } : null;
  } catch { return null; }
};

export function ZoePanel() {
  // Der aktive Space geht mit jeder Nachricht mit (26.09.): ZOE antwortet aus dieser Sicht und legt Neues dort ab.
  // Der Space ist auch der Bereich des Gesprächs (09.10. spät): er ordnet Vorschläge im Stapel zu (lib/zoe/bereich.ts, Regel (c)) und wählt
  // die Merksätze. Der Zähler zeigt dieselbe Sicht wie ZOE › Freigaben (Kopf: Privat · Business).
  const { space: aktiverSpace } = useSpace();
  const stapelSicht = aktiverSpace;
  // Der Bereich, in dem eine laufende Antwort begonnen hat — wechselt der Kopf, gehört sie nicht mehr in diesen Verlauf (10.10.).
  const spaceRef = useRef(aktiverSpace);
  spaceRef.current = aktiverSpace;
  const [fenster, setFenster] = useState<Fenster>(STANDARD);
  // Die Kugel weicht beim Lesen nach unten aus (18.10., N20 — lag am Handy auf „Entwurf öffnen“); oben, am Ende und nach oben rollend ist sie da.
  const weicht = useSchwebendWeicht();
  const [ask, setAsk] = useState('');
  const [thinking, setThinking] = useState(false);
  // Streaming (09.10.): der Text, während er entsteht, und das laufende Werkzeug — bis die fertige Antwort da ist.
  const [entsteht, setEntsteht] = useState<Entstehend>(ENTSTEHEND_LEER);
  // Wie viel vorbereitet ist und auf die Person wartet (kommt aus jeder Antwort).
  const [stapelOffen, setStapelOffen] = useState(0);
  // „ZOE fragen“ aus der Markttraktion (28.09., C7): Art + Kennung geht mit jeder Nachricht mit, bis man ihn löst. Seit 10.10. kommt der Bezug
  // auch von der Seite selbst (offener Kontakt, Firma, Deal, Angebot, Mandat — `seitenBezug`); ✕ löst ihn bis zum nächsten Seitenwechsel.
  const [bezugGewaehlt, setBezugGewaehlt] = useState<CrmBezug | null>(null);
  const [bezugWeg, setBezugWeg] = useState<string | null>(null);
  // Beleg an ZOE geben: lesen → zeigen → erst nach Bestätigung buchen.
  const dateiWahl = useRef<HTMLInputElement>(null);
  const [belegLaeuft, setBelegLaeuft] = useState<string | null>(null);
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [belegFehler, setBelegFehler] = useState<string | null>(null);
  const [belegGebucht, setBelegGebucht] = useState<string | null>(null);
  const [ueberDatei, setUeberDatei] = useState(false);
  // Eröffnung ohne Lagebericht: neutral, ohne feste Anrede — den Namen kennt ZOE erst aus dem Konto (`anredeSatz` im Gespräch).
  const [briefing, setBriefing] = useState('**Ich bin da.** Frag mich, lass mich planen, oder schick mich los.');
  // Gedächtnis — je Ansprechpartner (10.10.): der Thread dieses Gesprächs ('' = beim nächsten Senden ein neuer) und alle Threads mit ihm.
  const [gs, setGs] = useState<Partial<Record<PartnerSchluessel, Gespraech>>>({});
  const gsRef = useRef(gs);
  gsRef.current = gs;
  const aendere = useCallback((key: PartnerSchluessel, fn: (x: Gespraech) => Gespraech) => setGs(a => ({ ...a, [key]: fn(a[key] ?? LEER_G) })), []);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);
  const [heute, setHeute] = useState('');
  // Stimme
  const [vorlesen, setVorlesen] = useState(false);
  const [freihand, setFreihand] = useState(false);

  const convoRef = useRef<HTMLDivElement>(null);
  const beruehrt = useRef(new Set<PartnerSchluessel>());   // schon getippt? dann nichts überschreiben (je Ansprechpartner)
  const freihandRef = useRef(false);
  freihandRef.current = freihand;
  const vorlesenRef = useRef(false);
  vorlesenRef.current = vorlesen;
  // Ziehen (Größe/Position) läuft über einen Ref — kein Re-Render pro Pixel.
  const zug = useRef<{ art: 'groesse' | 'ort'; x: number; y: number; w: number; h: number; right: number; bottom: number } | null>(null);

  const stimme = useStimme(t => { if (!thinking) send(t); });

  // ── Ansprechpartner (10.10., Chat je Bereich): der passende Head der Seite oder ZOE ──
  // Der Kontext wird erst geladen, wenn der Chat einmal offen war. Der Server liefert nur Heads, die die Person sehen darf (lib/agenten/sicht.ts);
  // `manuell` = der Umschalter „↔“ im Kopf (gilt nur für den Head, für den er gesetzt wurde). Gewechselt wird nie während einer Antwort.
  const [einmalOffen, setEinmalOffen] = useState(false);
  useEffect(() => { if (fenster.offen) setEinmalOffen(true); }, [fenster.offen]);
  const kx = useChatKontext(einmalOffen);
  const [manuell, setManuell] = useState<{ ziel: 'zoe' | 'head'; fuer: string | null } | null>(null);
  // Ein anderer Bereich (anderer Head der Seite) beginnt wieder mit der eigenen Wahl — der Umschalter gilt nur, solange man im Bereich bleibt.
  useEffect(() => { setManuell(m => (m && m.fuer === kx.vorschlag ? m : null)); }, [kx.vorschlag]);
  const ap = ansprechpartnerFuer({ vorschlag: kx.vorschlag, heads: kx.heads, wahl: kx.wahl, fehlt: kx.fehlt, manuell });
  const [aktiv, setAktiv] = useState<{ key: PartnerSchluessel; head: ChatHead | null }>({ key: 'zoe', head: null });
  const zielHead = ap.partner === 'zoe' ? null : ap.angebot;
  useEffect(() => {
    if (thinking) return; // laufende Antwort nie abbrechen — der Wechsel kommt, sobald sie fertig ist
    setAktiv(a => (a.key === ap.partner && a.head?.id === zielHead?.id ? a : { key: ap.partner, head: zielHead }));
  }, [ap.partner, zielHead, thinking]);
  const kopfHead = aktiv.head;
  const partnerName = kopfHead ? kopfHead.name : 'ZOE';
  /** Farbe des Ansprechpartners: ZOE-Lila bzw. die Farbe des Heads aus dem Katalog. */
  const PF = kopfHead ? headFarbe(kopfHead.farbe) : J;
  const g = gs[aktiv.key] ?? LEER_G;
  const convo = g.convo, gespraechId = g.id, alle = g.liste;
  const vorschlagRef = useRef<string | null>(null);
  vorschlagRef.current = kx.vorschlag;
  const umschalten = () => {
    if (thinking || !ap.angebot) return;
    stimme.schweig(); stimme.hoerAuf();
    setZeigeVerlauf(false);
    setManuell({ ziel: kopfHead ? 'zoe' : 'head', fuer: kx.vorschlag });
  };
  const wahlSetzen = (w: ChatWahl) => { setManuell(null); void kx.setzeWahl(w); };
  // Bezug: gewählt („Mit … sprechen“, „ZOE fragen“) vor der Seite; ein Seitenwechsel nimmt den gewählten zurück.
  useEffect(() => { setBezugGewaehlt(null); }, [kx.seite]);
  const bezug: CrmBezug | null = bezugGewaehlt ?? (kx.bezug && bezugWeg !== kx.seite ? kx.bezug : null);
  const bezugLoesen = () => { setBezugGewaehlt(null); setBezugWeg(kx.seite); };

  // ── Fenster (lokal) ──
  useEffect(() => {
    try {
      const f = localStorage.getItem(MERKER_FENSTER);
      if (f) setFenster({ ...STANDARD, ...JSON.parse(f) });
      const s = localStorage.getItem(MERKER_STIMME);
      if (s) { const j = JSON.parse(s); setVorlesen(!!j.vorlesen); setFreihand(!!j.freihand); }
    } catch { /* egal */ }
    setHeute(localDay());
  }, []);
  useEffect(() => { try { localStorage.setItem(MERKER_FENSTER, JSON.stringify(fenster)); } catch { /* egal */ } }, [fenster]);
  useEffect(() => {
    const fragen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const b = crmBezugAus(detail);
      // `ziel` (10.10.): „Mit <Head> sprechen“ öffnet den passenden Head der Seite (`seite`), „ZOE fragen“ ZOE (`zoe`) — ohne Angabe wie bisher.
      const ziel = detail && typeof detail === 'object' ? (detail as { ziel?: unknown }).ziel : undefined;
      if (!b && ziel !== 'seite' && ziel !== 'zoe') return;
      if (b) setBezugGewaehlt(b);
      if (ziel === 'seite' || ziel === 'zoe') setManuell({ ziel: ziel === 'seite' ? 'head' : 'zoe', fuer: vorschlagRef.current });
      setZeigeVerlauf(false);
      setFenster(f => ({ ...f, offen: true }));
    };
    window.addEventListener(ZOE_FRAGEN_EREIGNIS, fragen);
    return () => window.removeEventListener(ZOE_FRAGEN_EREIGNIS, fragen);
  }, []);
  useEffect(() => { try { localStorage.setItem(MERKER_STIMME, JSON.stringify({ vorlesen, freihand })); } catch { /* egal */ } }, [vorlesen, freihand]);

  // ── Gedächtnis laden: der jüngste ZOE-Thread DIESES Bereichs kommt zurück (derselbe wie im Empfang und auf der Agenten-Seite), alle des
  // Bereichs in die Liste. Wechselt der Kopf (10.10.), beginnt die Ansicht neu — ein Gespräch des anderen Bereichs bleibt nie stehen. ──
  useEffect(() => {
    let lebt = true;
    beruehrt.current.delete('zoe');
    aendere('zoe', () => LEER_G);
    fetch(zoeFaeden(aktiverSpace)).then(r => r.json()).then(async (d: { faeden?: FadenKurz[] }) => {
      if (!lebt) return;
      const fs = Array.isArray(d.faeden) ? d.faeden : [];
      aendere('zoe', x => ({ ...x, liste: fs, geladen: true }));
      if (beruehrt.current.has('zoe') || !fs[0]) return;
      const f = await ladeThread(fs[0].id, aktiverSpace);
      if (!lebt || beruehrt.current.has('zoe') || !f?.nachrichten.length) return;
      aendere('zoe', x => ({ ...x, convo: ausFaden(f.nachrichten), id: fs[0].id, stand: f.stand }));
    }).catch(() => {});
    return () => { lebt = false; };
  }, [aendere, aktiverSpace]);

  // ── Ein Head als Ansprechpartner (10.10.): sein jüngster Thread dieser Sicht kommt zurück — derselbe wie auf der Agenten-Seite. Threads mit
  // laufendem bzw. eingereihtem Lauf (Hintergrundaufgabe) bleiben dort; ohne passenden Thread beginnt das nächste Senden einen neuen. ──
  useEffect(() => {
    const h = aktiv.head;
    if (!fenster.offen || !h) return;
    const key = aktiv.key;
    if (gsRef.current[key]?.geladen) return;
    aendere(key, x => ({ ...x, geladen: true }));
    void (async () => {
      try {
        const r = await fetch(`/api/agenten/faden?agent=${encodeURIComponent(key)}&space=${h.bereich}`);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json() as { faeden?: FadenKurz[] };
        const fs = (Array.isArray(d.faeden) ? d.faeden : []).filter(f => f.agent.art === 'head');
        aendere(key, x => ({ ...x, liste: fs }));
        const weiter = fs.find(f => f.status !== 'laeuft' && !f.eingereiht);
        if (!weiter || beruehrt.current.has(key)) return;
        const f = await ladeThread(weiter.id, h.bereich);
        if (!f || beruehrt.current.has(key)) return;
        aendere(key, x => ({ ...x, convo: ausFaden(f.nachrichten), id: weiter.id, stand: f.stand }));
      } catch {
        aendere(key, x => ({ ...x, geladen: false })); // beim nächsten Öffnen noch einmal
      }
    })();
  }, [fenster.offen, aktiv, aendere]);

  /** Gespräch sofort auf die Platte — Regel: gleicher Stand beim nächsten Reingucken. */
  /** Datei einlesen und von ZOE auswerten lassen. Schreibt noch nichts. */
  async function belegLesen(f: File) {
    setBelegFehler(null); setBeleg(null); setBelegGebucht(null);
    setBelegLaeuft(f.name);
    try {
      const base64: string = await new Promise((ok, fehl) => {
        const leser = new FileReader();
        leser.onload = () => ok(String(leser.result).split(',')[1] ?? '');
        leser.onerror = () => fehl(new Error('Datei nicht lesbar'));
        leser.readAsDataURL(f);
      });
      const r = await fetch('/api/beleg', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datei: base64, medientyp: f.type, name: f.name }),
      });
      const d = await r.json();
      if (d.ok) setBeleg({ ...d.beleg, dateiname: f.name, anfrageId: neueKennung('anf') });
      else setBelegFehler(d.error ?? 'Beleg konnte nicht gelesen werden.');
    } catch (e) {
      setBelegFehler(e instanceof Error ? e.message : 'Beleg konnte nicht gelesen werden.');
    }
    setBelegLaeuft(null);
  }

  /** Erst jetzt schreiben — die Person hat die Zahlen gesehen. */
  async function belegUebernehmen(ziel: 'buchung' | 'rechnung') {
    if (!beleg) return;
    setBelegLaeuft('speichern');
    try {
      const r = await fetch('/api/beleg/uebernehmen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ziel, partner: beleg.partner, datum: beleg.datum,
          // brutto/netto/Satz getrennt — die Route rechnet über lib/finanzen/ust.ts (netto ist nie brutto).
          betragBrutto: beleg.betragBrutto, betragNetto: beleg.betragNetto, ustSatz: beleg.ustSatz,
          kategorie: beleg.kategorie, zweck: beleg.zweck,
          faellig: beleg.faellig, rechnungsnummer: beleg.rechnungsnummer, anfrageId: beleg.anfrageId,
        }),
      });
      const d = await r.json();
      if (d.ok) { setBelegGebucht(`${d.angelegt} → ${d.wo}`); setBeleg(null); }
      else setBelegFehler(d.error ?? 'Nicht übernommen.');
    } catch { setBelegFehler('Nicht übernommen — läuft die Software noch?'); }
    setBelegLaeuft(null);
  }

  /** Die Liste nachziehen — gespeichert hat der Server (Frage und Antwort stehen im Thread). */
  const merke = (key: PartnerSchluessel, id: string, frage: string) => {
    if (!id) return;
    const jetzt = new Date().toISOString();
    const agent: AgentRef = key === 'zoe' ? { art: 'zoe' } : { art: 'head', headId: key.slice(5) };
    aendere(key, x => {
      const alt = x.liste.find(f => f.id === id);
      return { ...x, liste: [{ ...(alt ?? { id, titel: titelAus(frage), agent, status: 'offen' as const }), aktualisiert: jetzt }, ...x.liste.filter(f => f.id !== id)] };
    });
  };

  // Lagebericht als Eröffnung — aus dem letzten vollen Tageslauf.
  useEffect(() => {
    fetch('/api/tageslauf').then(r => r.json()).then((d: { letzterVoll?: { gestartet?: string; ausrichtung?: { gruss?: string; prioritaeten?: { titel: string; wann?: string }[]; schutz?: string } } | null }) => {
      const a = d.letzterVoll?.ausrichtung;
      if (!a?.gruss) return;
      const wann = d.letzterVoll?.gestartet ? ` _(Stand ${d.letzterVoll.gestartet.slice(11, 16)} Uhr)_` : '';
      const prios = (a.prioritaeten ?? []).slice(0, 3).map((p, i) => `${i + 1}. **${p.titel}**${p.wann ? ` · ${p.wann}` : ''}`).join('\n');
      setBriefing([`**Lagebericht.** ${a.gruss}${wann}`, prios, a.schutz ? `◇ ${a.schutz}` : ''].filter(Boolean).join('\n\n'));
    }).catch(() => {});
  }, []);

  useEffect(() => { const el = convoRef.current; if (el) el.scrollTop = el.scrollHeight; }, [convo, thinking, fenster.offen, entsteht.text]);

  // ── Stufenlos ziehen: Größe (Ecke oben links) und Ort (Kopfzeile) ──
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const z = zug.current;
      if (!z) return;
      e.preventDefault();
      const dx = e.clientX - z.x, dy = e.clientY - z.y;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (z.art === 'groesse') {
        // Fenster hängt rechts unten — die obere linke Ecke zieht es auf.
        const w = Math.max(MIN_W, Math.min(vw - 16, z.w - dx));
        const h = Math.max(MIN_H, Math.min(vh - 16, z.h - dy));
        setFenster(f => ({ ...f, w, h }));
      } else {
        const right = Math.max(8, Math.min(vw - MIN_W, z.right - dx));
        const bottom = Math.max(8, Math.min(vh - 120, z.bottom - dy));
        setFenster(f => ({ ...f, right, bottom }));
      }
    };
    const up = () => {
      if (!zug.current) return;
      zug.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  const zugStart = (art: 'groesse' | 'ort') => (e: React.PointerEvent) => {
    e.preventDefault();
    zug.current = { art, x: e.clientX, y: e.clientY, w: fenster.w, h: fenster.h, right: fenster.right, bottom: fenster.bottom };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = art === 'groesse' ? 'nwse-resize' : 'grabbing';
  };

  /** Senden an den, der gerade antwortet: ZOE (ihr Thread über /api/kimmi) oder den Head der Seite (sein Thread über /api/agenten/faden). */
  const send = (q: string) => (aktiv.head ? sendHead(q, aktiv.head, aktiv.key) : sendZoe(q));

  const sendZoe = async (q: string) => {
    beruehrt.current.add('zoe');
    setAsk(''); setThinking(true); setZeigeVerlauf(false);
    const meins: Msg = { role: 'user', text: q, zeit: new Date().toISOString() };
    aendere('zoe', x => ({ ...x, convo: [...x.convo, meins] }));
    setEntsteht(ENTSTEHEND_LEER);
    try {
      // Der Verlauf liegt im ZOE-Thread auf dem Server — hier geht nur die neue Nachricht mit (Paket 4a). Mit Strom (09.10.): der Text
      // erscheint, während er entsteht; am Ende dieselbe Antwort wie ohne Strom (Rückfall auf JSON in lib/http/strom-client.ts).
      // `anfrageId` (Härtetest 09.10.): der Rückfall auf JSON nach einem Netzfehler lässt den Zug auf dem Server nie zweimal laufen.
      const fuer = aktiverSpace;
      const r = await postMitStrom('/api/kimmi', { message: q, zoeFaden: gespraechId || 'neu', space: fuer, anfrageId: zufallsUuid(), ...(bezug ? { bezug } : {}) },
        e => setEntsteht(s => entstehendNach(s, e)));
      // Inzwischen den Bereich gewechselt (10.10.): die Antwort steht im Thread ihres Bereichs — hier (anderer Bereich) nichts anhängen.
      if (spaceRef.current !== fuer) return;
      if (r.netz) throw new Error('netz');
      // Der Zug hat nicht stattgefunden (Modell, Sperre, Schlüssel — `ok: false`): der Satz erscheint, die Frage kommt zurück ins Feld (nie verloren).
      if ((r.body as { ok?: unknown } | null)?.ok === false) setAsk(a => a || q);
      if (r.unterbrochen) {
        // Abgerissen: der Server hat nichts Halbes gespeichert — den Thread neu laden, statt still noch einmal zu senden (Kosten).
        const f = gespraechId ? await ladeThread(gespraechId, aktiverSpace) : null;
        aendere('zoe', x => ({ ...x, convo: [...(f ? ausFaden(f.nachrichten) : x.convo), { role: 'kimmi', text: 'Die Verbindung ist abgerissen — fehlt meine Antwort, frag bitte noch einmal.', zeit: new Date().toISOString() }] }));
        return;
      }
      const d = (r.body ?? {}) as { reply?: string; stapelOffen?: unknown; fadenId?: unknown; handoffs?: unknown; ran?: unknown };
      // Neu fragen statt die Zahl der Antwort zu nehmen (09.10. spät): sie zählt für den Bereich des Gesprächs, der Zähler hier für die Sicht.
      if (typeof d.stapelOffen === 'number') stapelZaehlen();
      const fid = typeof d.fadenId === 'string' ? d.fadenId : '';
      if (fid) { aendere('zoe', x => ({ ...x, id: fid })); merke('zoe', fid, q); }
      const antwort: Msg = {
        role: 'kimmi', text: d.reply ?? 'Ich habe gerade keine Antwort.', zeit: new Date().toISOString(),
        handoffs: Array.isArray(d.handoffs) ? d.handoffs : undefined,
        ran: Array.isArray(d.ran) && d.ran.length ? d.ran : undefined,
      };
      aendere('zoe', x => ({ ...x, convo: [...x.convo, antwort] }));
      if (vorlesenRef.current) {
        stimme.lies(fuerStimme(antwort.text), () => { if (freihandRef.current) stimme.hoerZu(); });
      }
    } catch {
      const fehler: Msg = { role: 'kimmi', text: 'Ich konnte gerade nicht antworten — versuch es nochmal.', zeit: new Date().toISOString() };
      aendere('zoe', x => ({ ...x, convo: [...x.convo, fehler] }));
      setAsk(a => a || q); // keine Verbindung: die Frage bleibt im Feld (Härtetest 09.10.)
    } finally {
      setThinking(false);
      setEntsteht(ENTSTEHEND_LEER);
    }
  };

  /**
   * An den Head der Seite (10.10.): derselbe Weg wie auf der Agenten-Seite (POST /api/agenten/faden `senden`, mit Strom) — kein zweiter Chat-Weg,
   * kein Modellaufruf daneben. Mit `space` (der Server lehnt einen Head anderer Sicht ab) und dem Bezug der Seite (nur Art + Kennung). Der
   * Verlauf kommt aus der Antwort des Servers (Thread); scheitert der Zug, nimmt der Server die Nachricht zurück und die Frage kommt ins Feld.
   */
  const sendHead = async (q: string, head: ChatHead, key: PartnerSchluessel) => {
    beruehrt.current.add(key);
    setAsk(''); setThinking(true); setZeigeVerlauf(false);
    const meins: Msg = { role: 'user', text: q, zeit: new Date().toISOString() };
    const vorher = gsRef.current[key] ?? LEER_G;
    aendere(key, x => ({ ...x, convo: [...x.convo, meins] }));
    setEntsteht(ENTSTEHEND_LEER);
    const hinweis = (text: string): Msg => ({ role: 'kimmi', text, zeit: new Date().toISOString() });
    try {
      const r = await postMitStrom('/api/agenten/faden', {
        aktion: 'senden', agent: { art: 'head', headId: head.id }, text: q, ...(vorher.id ? { fadenId: vorher.id, stand: vorher.stand } : {}),
        space: head.bereich, anfrageId: zufallsUuid(), ...(bezug ? { bezug } : {}),
      }, e => setEntsteht(s => entstehendNach(s, e)));
      if (r.netz) throw new Error('netz');
      const d = (r.body ?? {}) as { ok?: unknown; faden?: { id?: unknown; nachrichten?: Nachricht[] }; stand?: unknown; fehler?: unknown; stapelOffen?: unknown };
      if (r.unterbrochen) {
        const f = vorher.id ? await ladeThread(vorher.id, head.bereich) : null;
        aendere(key, x => ({ ...x, convo: [...(f ? ausFaden(f.nachrichten) : x.convo), hinweis('Die Verbindung ist abgerissen — fehlt die Antwort, frag bitte noch einmal.')], ...(f ? { stand: f.stand } : {}) }));
        return;
      }
      const fid = typeof d.faden?.id === 'string' ? d.faden.id : '';
      const nachrichten = Array.isArray(d.faden?.nachrichten) ? d.faden.nachrichten : null;
      if (r.status >= 200 && r.status < 300 && d.ok !== false && fid && nachrichten) {
        aendere(key, x => ({ ...x, convo: ausFaden(nachrichten), id: fid, stand: typeof d.stand === 'string' ? d.stand : '' }));
        merke(key, fid, q);
        if (typeof d.stapelOffen === 'number') stapelZaehlen();
        const letzte = [...nachrichten].reverse().find(n => n.rolle !== 'person');
        if (letzte && vorlesenRef.current) stimme.lies(fuerStimme(letzte.text), () => { if (freihandRef.current) stimme.hoerZu(); });
        return;
      }
      // Nicht gelaufen (Sperre, Not-Aus, Budget, Stand veraltet …): der Server hat die Nachricht nicht behalten — der Satz erscheint, die Frage
      // kommt zurück ins Feld. Kam der aktuelle Thread mit (409), gilt er.
      const text = typeof d.fehler === 'string' && d.fehler ? d.fehler : 'Gerade keine Antwort — versuch es bitte noch einmal.';
      aendere(key, x => ({ ...x, convo: [...(nachrichten ? ausFaden(nachrichten) : x.convo.filter(m => m !== meins)), hinweis(text)], ...(nachrichten && fid ? { id: fid, stand: typeof d.stand === 'string' ? d.stand : x.stand } : {}) }));
      setAsk(a => a || q);
    } catch {
      aendere(key, x => ({ ...x, convo: [...x.convo.filter(m => m !== meins), hinweis(`${head.name} konnte gerade nicht antworten — versuch es nochmal.`)] }));
      setAsk(a => a || q);
    } finally {
      setThinking(false);
      setEntsteht(ENTSTEHEND_LEER);
    }
  };

  // Der Stapel-Stand auch ohne Gespräch — sonst sieht man morgens nicht, dass etwas wartet. Je Sicht (09.10. spät): der Server zählt nur
  // die Vorschläge dieses Bereichs und die unklaren — dieselbe Zahl, die ZOE › Freigaben zeigt. Vorher fragten hier zwei gleiche Effekte.
  const stapelZaehlen = useCallback(() => {
    fetch(`/api/zoe/stapel?space=${stapelSicht}`)
      .then(r => r.json())
      .then(d => setStapelOffen(Number(d.offen) || 0))
      .catch(() => {});
  }, [stapelSicht]);
  useEffect(() => { stapelZaehlen(); }, [stapelZaehlen]);

  const neuesGespraech = () => {
    stimme.schweig(); stimme.hoerAuf();
    aendere(aktiv.key, x => ({ ...x, convo: [], id: '', stand: '' }));
    setZeigeVerlauf(false);
    beruehrt.current.add(aktiv.key);
  };

  const oeffne = async (t: FadenKurz) => {
    stimme.schweig(); stimme.hoerAuf();
    const key = aktiv.key;
    beruehrt.current.add(key);
    setZeigeVerlauf(false);
    const f = await ladeThread(t.id, aktiv.head?.bereich ?? aktiverSpace);
    aendere(key, x => ({ ...x, convo: f ? ausFaden(f.nachrichten) : [], id: t.id, stand: f?.stand ?? '' }));
  };

  /** Löschen braucht den Stand des Threads (409 statt still überschreiben) — erst lesen, dann löschen. */
  const loesche = async (id: string) => {
    const f = await ladeThread(id, aktiv.head?.bereich ?? aktiverSpace);
    if (!f) return;
    const r = await fetch('/api/agenten/faden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'loeschen', fadenId: id, stand: f.stand }) }).catch(() => null);
    if (!r?.ok) return;
    aendere(aktiv.key, x => ({ ...x, liste: x.liste.filter(t => t.id !== id), ...(id === x.id ? { convo: [], id: '', stand: '' } : {}) }));
  };

  const kugelZustand: ZoeZustand = stimme.hoert ? 'hoert' : stimme.spricht ? 'spricht' : thinking ? 'denkt' : 'ruht';

  // ── Zu: das kleine pulsierende Icon, das überall mitgeht ──
  if (!fenster.offen) {
    return (
      <button onClick={() => setFenster(f => ({ ...f, offen: true }))} aria-label={`${partnerName} öffnen`} title={partnerName} className={`zoe-fab schwebend${weicht ? ' schwebend-weg' : ''}`}
        style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 70, width: 52, height: 52, borderRadius: '50%', border: 'none', background: FLAECHE, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 8px 30px rgba(0,0,0,.45), 0 0 26px ${KUGEL.smaragd}2E, inset 0 1px 0 rgba(255,255,255,.08)` }}>
        <ZoeSymbol size={38} zustand={kugelZustand} puls />
        {(thinking || stimme.hoert || stimme.spricht) && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.achtung, boxShadow: `0 0 8px ${stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.achtung}33` }} />}
      </button>
    );
  }

  // Im engen Kopf zählt Kürze — der Gesprächsknopf trägt den Zustand ohnehin.
  const zustand = stimme.hoert ? '● hört zu' : stimme.spricht ? '● spricht' : '● online';
  const zustandFarbe = stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.gut;

  return (
    <div className="zoe-fenster"
      // Beleg einfach aufs Fenster ziehen — der zweite Weg neben dem 📎.
      onDragOver={e => { e.preventDefault(); if (!ueberDatei) setUeberDatei(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setUeberDatei(false); }}
      onDrop={e => {
        e.preventDefault(); setUeberDatei(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void belegLesen(f);
      }}
      style={{ position: 'fixed', right: fenster.right, bottom: fenster.bottom, width: `min(${fenster.w}px, calc(100vw - ${fenster.right + 8}px))`, height: `min(${fenster.h}px, calc(100vh - ${fenster.bottom + 8}px))`, zIndex: 70, display: 'flex', flexDirection: 'column', background: FLAECHE, border: `1px solid ${ueberDatei ? C.aktiv : HAAR}`, borderRadius: 20, boxShadow: `0 24px 70px rgba(0,0,0,.55), 0 0 40px -10px ${J}40, inset 0 1px 0 rgba(255,255,255,.06)`, overflow: 'hidden', color: C.ink, fontFamily: SCHRIFT.text }}>
      {ueberDatei && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: `${C.aktiv}14`, border: `2px dashed ${C.aktiv}`, borderRadius: 20, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.aktiv }}>Beleg loslassen — ich lese die Zahlen heraus</span>
        </div>
      )}
      {/* Zieh-Ecke: stufenlos so groß, wie du arbeiten willst */}
      <div onPointerDown={zugStart('groesse')} title="Ziehen zum Vergrößern"
        style={{ position: 'absolute', top: 0, left: 0, width: 26, height: 26, cursor: 'nwse-resize', zIndex: 3, borderTop: `2px solid ${J}55`, borderLeft: `2px solid ${J}55`, borderTopLeftRadius: 20 }} />

      {/* Kopf — am Kopf packst du das Fenster und schiebst es, wohin du willst */}
      <div onPointerDown={zugStart('ort')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 20px', borderBottom: `1px solid ${HAAR}`, background: 'rgba(255,255,255,.03)', cursor: 'grab', touchAction: 'none' }}>
        {/* Ansprechpartner (10.10.): der Head der Seite als Kürzel-Kugel in seiner Farbe — sonst ZOE als Lichtkugel. */}
        {kopfHead
          ? <KuerzelKugel name={kopfHead.name} farbe={PF} bereich={kopfHead.bereich} groesse={28} />
          : <ZoeSymbol size={28} zustand={kugelZustand} puls={stimme.hoert || stimme.spricht} />}
        <div style={{ minWidth: 0, flex: '0 1 auto' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, letterSpacing: kopfHead ? '.02em' : '.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partnerName}</div>
          <div style={{ fontSize: TYP.mikro, fontWeight: 600, color: zustandFarbe, whiteSpace: 'nowrap' }}>{zustand}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }} onPointerDown={e => e.stopPropagation()}>
          {/* Umschalter (10.10.): zwischen dem Head der Seite und ZOE — beide Verläufe bleiben. Während einer Antwort gesperrt. */}
          {ap.angebot && (
            <button onClick={umschalten} disabled={thinking} className="zoe-umschalten"
              title={kopfHead ? `Zu ZOE wechseln — das Gespräch mit ${kopfHead.name} bleibt` : `Zu ${ap.angebot.name} wechseln — das Gespräch mit ZOE bleibt`}
              aria-label={kopfHead ? 'Zu ZOE wechseln' : `Zu ${ap.angebot.name} wechseln`}
              style={{ ...chip(kopfHead ? J : headFarbe(ap.angebot.farbe)), cursor: thinking ? 'default' : 'pointer' }}>
              ↔ {kopfHead ? 'ZOE' : ap.angebot.kurz}
            </button>
          )}
          {/* Gesprächs-Modus: ein Knopf für alles — Mikrofon an, Antwort wird
              vorgelesen, danach hört er von selbst wieder zu. Vorgabe:
              „damit ich eine echte Konversation aufbauen kann." */}
          {stimme.kannHoeren && stimme.kannSprechen && (
            <button
              onClick={() => {
                const an = !freihand;
                setFreihand(an); setVorlesen(an);
                if (an) { if (!thinking && !stimme.spricht) stimme.hoerZu(); }
                else { stimme.schweig(); stimme.hoerAuf(); }
              }}
              title={freihand ? 'Gespräch beenden' : 'Gespräch: sprechen und vorlesen lassen'}
              style={chip(J, freihand)}>
              <Mikro farbe={freihand ? J : C.inkDim} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {freihand ? (stimme.hoert ? 'hört' : stimme.spricht ? 'spricht' : 'Gespräch') : 'Gespräch'}
              </span>
            </button>
          )}
          {/* Weg ins volle Hirn. Das Symbol selbst öffnet weiter dieses Fenster:
              eine Frage im Vorbeigehen soll die Seite nicht verlassen, auf der
              man gerade arbeitet. Wer den ganzen Empfang will, geht hier. */}
          <Link href="/zoe" title="Zum Hirn — der ganze Empfang" className="zoe-hirn-link" style={chip(J)}>
            ◎ Hirn
          </Link>
          {stapelOffen > 0 && (
            <Link href="/os/stapel" title={`${stapelOffen} vorbereitet — wartet auf deine Freigabe`} style={{ textDecoration: 'none', display: 'inline-flex' }}>
              <Chip farbe={LEUCHT.achtung}>✋ {stapelOffen}</Chip>
            </Link>
          )}
          <button onClick={() => setZeigeVerlauf(v => !v)} title={`Verlauf — ${alle.length} Gespräche`} style={knopf(zeigeVerlauf)}>
            ☰{alle.length ? ` ${alle.length}` : ''}
          </button>
          {convo.length > 0 && <button onClick={neuesGespraech} title="Neues Gespräch (das alte bleibt im Verlauf)" style={knopf()}>Neu</button>}
          <button onClick={() => setFenster(f => ({ ...f, w: STANDARD.w, h: STANDARD.h, right: STANDARD.right, bottom: STANDARD.bottom }))} title="Normalgröße" aria-label="Normalgröße"
            className="zoe-normalgroesse" style={{ ...rund, width: 26, height: 26, borderRadius: 8, fontSize: TYP.bedien, lineHeight: 1 }}>◱</button>
          <button onClick={() => { stimme.schweig(); stimme.hoerAuf(); setFenster(f => ({ ...f, offen: false })); }} title="Schließen — ZOE bleibt als Icon da" aria-label="ZOE schließen"
            style={{ ...rund, width: 26, height: 26, borderRadius: 8, fontSize: TYP.bedien, lineHeight: 1 }}>—</button>
        </div>
      </div>

      {/* Warum hier ZOE statt des passenden Heads antwortet (10.10.) — z. B. die eigene Gesundheits-Einwilligung fehlt. */}
      {kx.bereit && ap.hinweis && !kopfHead && (
        <div role="note" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: `1px solid ${HAAR}`, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{ap.hinweis}</span>
          {ap.einwilligung && <Link href={WEG.datenschutz('gesundheit')} style={{ color: C.aktiv, textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 600 }}>Einwilligung ›</Link>}
        </div>
      )}

      {/* Bezug (28.09., C7; seit 10.10. auch von der Seite selbst): nur Art + Kennung — ZOE bzw. der Head liest selbst nach und schlägt nur vor. */}
      {bezug && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: `1px solid ${HAAR}`, fontSize: TYP.bedien, color: C.inkDim }}>
          <span style={{ color: PF, fontWeight: 700 }}>Bezug</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CRM_BEZUG_LABEL[bezug.art]}{bezug.id ? ` · ${bezug.id}` : ''}</span>
          <button onClick={bezugLoesen} title="Bezug lösen" aria-label="Bezug lösen" style={{ background: 'transparent', border: 0, color: C.inkLeise, cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}

      {/* Verlauf — alle Gespräche, jederzeit wieder aufmachbar */}
      {zeigeVerlauf && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
          {/* Einstellung je Person (10.10.): wer im Chat unten antwortet — der passende Head der Seite oder immer ZOE. */}
          <div style={{ padding: '12px 16px 4px', display: 'grid', gap: 8 }}>
            <div style={lbl}>Im Chat antwortet</div>
            <Segmente liste={[{ id: 'seite' as ChatWahl, label: CHAT_WAHL_TEXT.seite }, { id: 'zoe' as ChatWahl, label: CHAT_WAHL_TEXT.zoe }]} aktiv={kx.wahl} onWahl={wahlSetzen} />
            {kopfHead && (
              <Link href={WEG.agenten({ h: kopfHead.id, ...(gespraechId ? { f: gespraechId } : {}) })} style={{ color: C.aktiv, fontSize: TYP.bedien, textDecoration: 'none', fontWeight: 600 }}>
                {kopfHead.name} im Agenten-Bereich öffnen ›
              </Link>
            )}
          </div>
          <div style={{ ...lbl, padding: '12px 16px 6px' }}>Verlauf mit {partnerName} · {alle.length} {alle.length === 1 ? 'Gespräch' : 'Gespräche'}</div>
          {!alle.length && <div style={{ padding: '18px 16px', fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55 }}>Noch nichts gespeichert. Ab jetzt bleibt jedes Gespräch hier liegen.</div>}
          {alle.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderTop: `1px solid rgba(255,255,255,.05)`, background: g.id === gespraechId ? `${J}14` : 'transparent' }}>
              <button onClick={() => { void oeffne(g); }} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontFamily: SCHRIFT.text }}>
                <div style={{ fontSize: TYP.bedien, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titel}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>
                  {heute ? wannText(g.aktualisiert, heute) : g.aktualisiert.slice(0, 10)}
                </div>
              </button>
              <button onClick={() => { void loesche(g.id); }} title="Gespräch löschen" aria-label={`Gespräch „${g.titel}" löschen`}
                style={{ background: 'transparent', border: 0, color: C.inkLeise, cursor: 'pointer', fontSize: 13, padding: '2px 4px', flex: '0 0 auto' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Konversation */}
      {!zeigeVerlauf && (
      <div ref={convoRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {convo.length === 0 && !thinking && (kopfHead ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={lbl}><span style={{ color: PF }}>{kopfHead.name}</span> · hier zuständig</div>
            <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>{kopfHead.auftrag}</div>
            {kopfHead.hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{kopfHead.hinweis}</div>}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Was schreibt, liegt danach als Vorschlag unter Freigaben — erst dein Klick übernimmt. Mit „↔ ZOE“ sprichst du mit ZOE.</div>
          </div>
        ) : (
          <div>
            <div style={{ ...lbl, marginBottom: 8 }}><span style={{ color: J }}>ZOE</span> · Lagebericht</div>
            <Rich text={briefing} />
          </div>
        ))}
        {convo.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '88%', background: `${C.aktiv}22`, color: C.ink, borderRadius: 16, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}>{m.text}</div>
          : <div key={i} style={{ maxWidth: '96%' }}>
              <div style={{ ...lbl, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: PF }}>{partnerName}</span>
                {/* KI-VO Art. 50 (05.10.): dezent als KI-erzeugt gekennzeichnet — wichtig, wenn Text weitergegeben wird. */}
                <span title="KI-erzeugt (KI-VO Art. 50) — vor dem Weitergeben prüfen" aria-label="KI-erzeugt" style={{ color: C.inkLeise, fontWeight: 500 }}>· KI</span>
                {stimme.kannSprechen && (
                  <button onClick={() => stimme.spricht ? stimme.schweig() : stimme.lies(fuerStimme(m.text))} title={stimme.spricht ? 'Still' : 'Vorlesen'}
                    style={{ background: 'transparent', border: 0, color: C.inkLeise, cursor: 'pointer', fontSize: TYP.mikro, padding: 0, fontFamily: SCHRIFT.text }}>
                    {stimme.spricht ? '■' : '▶'}
                  </button>
                )}
              </div>
              <Rich text={m.text} />
              {m.ran && m.ran.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {m.ran.map((x, xi) => (
                    <Chip key={xi} farbe={x.gestapelt ? LEUCHT.achtung : x.ok ? LEUCHT.gut : LEUCHT.kritisch}>
                      <span style={{ fontFamily: SCHRIFT.mono, fontWeight: 600 }}>⚙ {x.agent}</span> {x.gestapelt ? 'als Vorschlag' : x.ok ? 'ausgeführt' : 'fehlgeschlagen'}
                    </Chip>
                  ))}
                </div>
              )}
              {m.handoffs && m.handoffs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {m.handoffs.map((h, hi) => (
                    <Link key={hi} href={h.href} title={h.why} style={{ ...chip(C.aktiv), padding: '6px 12px' }}>→ {h.name} öffnen</Link>
                  ))}
                </div>
              )}
            </div>
        )}
        {/* Streaming (09.10.): der Text, während er entsteht, und „ruft … auf“ bei Werkzeugen — kein Tipp-Effekt, nur anhängen. */}
        {thinking && entsteht.text && (
          <div style={{ maxWidth: '96%' }}>
            <div style={{ ...lbl, marginBottom: 5 }}><span style={{ color: PF }}>{partnerName}</span></div>
            <Rich text={entsteht.text} />
          </div>
        )}
        {thinking && <div role="status" aria-live="polite" style={{ fontSize: TYP.bedien, color: C.inkLeise }}><span style={{ ...lbl, color: PF }}>{partnerName}</span> {entsteht.werkzeug ? `ruft ${entsteht.werkzeug} auf …` : entsteht.text ? 'schreibt …' : 'denkt nach …'}</div>}
      </div>
      )}

      {/* Eingabe */}
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${HAAR}`, background: 'rgba(255,255,255,.03)' }}>
        {/* ── Beleg: gelesen, noch nicht gebucht ── */}
        {belegLaeuft && belegLaeuft !== 'speichern' && (
          <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.aktiv, marginBottom: 7 }}>
            liest {belegLaeuft} …
          </div>
        )}
        {belegFehler && (
          <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 12, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            {belegFehler}
            <button onClick={() => setBelegFehler(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {belegGebucht && (
          <div style={{ fontSize: TYP.bedien, color: LEUCHT.gut, background: `${LEUCHT.gut}14`, borderRadius: 12, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            Übernommen: {belegGebucht}
            <button onClick={() => setBelegGebucht(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {beleg && (
          <div style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 9 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>
              Beleg gelesen · {beleg.dateiname}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: TYP.bedien }}>
              <span style={{ color: C.inkLeise }}>Partner</span><span style={{ color: C.ink }}>{beleg.partner || '—'}</span>
              <span style={{ color: C.inkLeise }}>Betrag</span>
              <span style={zahl}>
                {beleg.betragBrutto != null ? `${beleg.betragBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${beleg.waehrung ?? 'EUR'}` : '—'}
                {beleg.betragNetto != null && beleg.betragBrutto !== beleg.betragNetto && <span style={{ color: C.inkLeise }}> · netto {beleg.betragNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>}
              </span>
              <span style={{ color: C.inkLeise }}>Datum</span><span style={zahl}>{beleg.datum ? datumDe(beleg.datum) : '—'}</span>
              {beleg.zweck && <><span style={{ color: C.inkLeise }}>Zweck</span><span style={{ color: C.inkDim }}>{beleg.zweck}</span></>}
              {beleg.kategorie && <><span style={{ color: C.inkLeise }}>Kategorie</span><span style={{ color: C.inkDim }}>{beleg.kategorie}</span></>}
              <span style={{ color: C.inkLeise }}>Richtung</span>
              <span style={{ color: beleg.richtung === 'unklar' ? LEUCHT.achtung : C.inkDim }}>
                {beleg.richtung === 'eingang' ? 'du zahlst' : beleg.richtung === 'ausgang' ? 'du bekommst Geld' : 'unklar — du entscheidest'}
              </span>
            </div>
            {!!beleg.unsicher?.length && (
              <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 7, lineHeight: 1.45 }}>
                Nicht sicher gelesen: {beleg.unsicher.join(' · ')} — bitte prüfen.
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Knopf onClick={() => belegUebernehmen('buchung')} aus={belegLaeuft === 'speichern'} leise={beleg.richtung === 'ausgang'}>
                Als Ausgabe buchen
              </Knopf>
              <Knopf onClick={() => belegUebernehmen('rechnung')} aus={belegLaeuft === 'speichern'} leise={beleg.richtung !== 'ausgang'}>
                Als Rechnung führen
              </Knopf>
              <Knopf leise onClick={() => setBeleg(null)}>Verwerfen</Knopf>
            </div>
          </div>
        )}
        {stimme.hoert && (
          <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: LEUCHT.kritisch, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="zoe-orb-kern" style={{ width: 7, height: 7, borderRadius: '50%', background: LEUCHT.kritisch, boxShadow: `0 0 8px ${LEUCHT.kritisch}33`, display: 'inline-block' }} />
            {stimme.teil ? stimme.teil : 'Ich höre …'}
          </div>
        )}
        {stimme.fehler && <div style={{ fontSize: TYP.mikro, color: LEUCHT.achtung, marginBottom: 6 }}>{stimme.fehler}</div>}
        <div style={{ ...feld, display: 'flex', alignItems: 'flex-end', gap: 9, padding: '8px 10px', boxShadow: stimme.hoert ? `0 0 0 1px ${LEUCHT.kritisch}, 0 0 14px ${LEUCHT.kritisch}33` : undefined }}>
          <textarea value={ask} onChange={e => setAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && ask.trim() && !thinking) { e.preventDefault(); send(ask.trim()); } }}
            placeholder={stimme.hoert ? 'Sprich einfach …' : `Sprich mit ${partnerName} …`} aria-label={`Nachricht an ${partnerName}`} rows={fenster.h > 640 ? 2 : 1} disabled={thinking}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: C.ink, fontSize: 13.5, fontFamily: SCHRIFT.text, resize: 'none', lineHeight: 1.5, padding: '4px 2px' }} />
          {stimme.kannHoeren && (
            <button onClick={() => stimme.hoert ? stimme.hoerAuf() : stimme.hoerZu()} disabled={thinking}
              aria-label={stimme.hoert ? 'Aufnahme beenden' : 'Sprechen'} title={stimme.hoert ? 'Fertig — abschicken' : `Mikrofon: sprich mit ${partnerName}`}
              style={{ ...rund, cursor: thinking ? 'default' : 'pointer', background: stimme.hoert ? `${LEUCHT.kritisch}22` : 'rgba(255,255,255,.06)', color: stimme.hoert ? LEUCHT.kritisch : C.inkDim, boxShadow: stimme.hoert ? `0 0 12px ${LEUCHT.kritisch}33` : undefined }}>
              {stimme.hoert ? '■' : <Mikro farbe={C.inkDim} />}
            </button>
          )}
          {/* Beleg an ZOE geben — Vorgabe: „Rechnung fotografieren,
              Zahlen landen im System." */}
          <button onClick={() => dateiWahl.current?.click()} disabled={thinking || !!belegLaeuft}
            aria-label="Beleg anhängen" title="Rechnung oder Quittung anhängen — ZOE liest die Zahlen heraus"
            style={{ ...rund, fontSize: 15, cursor: thinking || belegLaeuft ? 'default' : 'pointer' }}>📎</button>
          <input ref={dateiWahl} type="file" accept="image/*,application/pdf" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) void belegLesen(f); e.target.value = ''; }} />
          {/* Leer oder während ZOE denkt: aus (Praxis 04.10. — vorher immer aktiv, auch ohne Text). */}
          <button onClick={() => ask.trim() && !thinking && send(ask.trim())} aria-label="Senden" disabled={thinking || !ask.trim()}
            style={{ ...rund, background: thinking || !ask.trim() ? 'rgba(255,255,255,.08)' : C.aktiv, color: thinking || !ask.trim() ? C.inkLeise : C.grund, fontSize: 15, fontWeight: 700, cursor: thinking || !ask.trim() ? 'default' : 'pointer', boxShadow: thinking || !ask.trim() ? undefined : `0 6px 18px -6px ${C.aktiv}99` }}>↑</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          {(kopfHead ? HEAD_VORSCHLAEGE : ZOE_VORSCHLAEGE).map(c => (
            <button key={c} onClick={() => !thinking && send(c)} disabled={thinking}
              style={{ ...knopf(), cursor: thinking ? 'default' : 'pointer' }}>{c}</button>
          ))}
          {stimme.kannSprechen && (
            <button onClick={() => { const n = !vorlesen; setVorlesen(n); if (!n) { setFreihand(false); stimme.schweig(); } }}
              title="Antworten vorlesen" style={{ ...knopf(vorlesen), marginLeft: 'auto' }}>
              Vorlesen {vorlesen ? 'an' : 'aus'}
            </button>
          )}
          {/* Stimme wählen — „Anna" ist die alte macOS-Stimme, die neueren
              klingen deutlich natürlicher. Die Wahl bleibt gespeichert. */}
          {stimme.kannSprechen && stimme.stimmen.length > 1 && (
            <select
              value={stimme.stimmName}
              onChange={e => { stimme.waehleStimme(e.target.value); stimme.lies('Ich bin ZOE. So klinge ich.'); }}
              aria-label="Stimme wählen" title="Stimme wählen — wird sofort vorgesprochen"
              style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', cursor: 'pointer', maxWidth: 104 }}>
              {stimme.stimmen.map(v => <option key={v.name} value={v.name} style={{ background: C.flaeche, color: C.ink }}>{v.kurz}</option>)}
            </select>
          )}
          {stimme.spricht && (
            <button onClick={() => stimme.schweig()} title="Vorlesen abbrechen" style={chip(LEUCHT.achtung)}>
              ■ Still
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
