'use client';

import Link from 'next/link';
// ─── MAKE OS — Jarvis (schwebend, frei beweglich) ───────────────────────────
// Kevins Ansage: nicht starr — flexibel. Unten schwebt ein kleines, sanft
// pulsierendes Icon, das auf jeder /os-Seite mitgeht. Ein Klick öffnet den
// Chat in Normalgröße; an der oberen linken Ecke zieht man ihn stufenlos so
// groß, wie man arbeiten will, und am Kopf verschiebt man ihn frei über den
// Bildschirm. Der Rest der Oberfläche bleibt unberührt (Overlay, kein Layout).
// Fähigkeiten unverändert: Agenten ausführen, Aufgaben anlegen (Klick-
// Bestätigung), Blöcke direkt in den Planer legen (plan_block), Brain-Kontext.
//
// GEDÄCHTNIS (Kevin: „immer die Historie reingeben, damit wir das sauber
// haben"): jedes Gespräch liegt als Datei im Bestand, nicht mehr nur in der
// Sitzung. Beim Öffnen kommt der letzte Stand zurück, alte Gespräche stehen
// unter „Verlauf", und der bisherige Zug geht bei jeder Frage mit an die KI —
// vorher fing Jarvis bei jeder Nachricht wieder bei null an.
//
// STIMME (Kevin: „und gleichzeitig auch mit ihm sprechen"): Mikrofon diktiert,
// Jarvis liest seine Antwort vor, und im Freihand-Betrieb hört er nach dem
// Sprechen von selbst wieder zu — ein echtes Gespräch ohne Tastatur.
//
// 24.09.: auf das lebendige Muster umgezogen — Flächen wie die Karten, Chips,
// Knöpfe und Eingabe aus schlank.tsx, Jarvis-Lila für ihn, Teal für die
// Bedienung, Grün/Gelb/Rot für Zustand. Die Logik ist unverändert.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Rich } from './Rich';
import { Chip, Knopf, feld, LEUCHT } from './schlank';
import { useStimme } from '@/hooks/useStimme';
import { fuerStimme, titelAus, wannText, type Gespraech, type VerlaufNachricht } from '@/lib/make-one/jarvis-verlauf';

/** Was Jarvis aus einem Foto/PDF gelesen hat — Vorschlag, noch nicht gebucht. */
interface Beleg {
  richtung: 'eingang' | 'ausgang' | 'unklar';
  partner: string;
  datum?: string;
  betragBrutto?: number;
  betragNetto?: number;
  waehrung?: string;
  rechnungsnummer?: string;
  zweck?: string;
  faellig?: string;
  kategorie?: string;
  unsicher?: string[];
  dateiname: string;
}

interface Handoff { agent: string; name: string; href: string; why: string }
interface Msg { role: 'user' | 'kimmi'; text: string; zeit?: string; handoffs?: Handoff[]; ran?: { agent: string; ok: boolean }[] }
interface Fenster { offen: boolean; w: number; h: number; right: number; bottom: number }

// Jarvis-Lila für alles, was er selbst ist; Teal für das, was man drückt.
const J = LEUCHT.agenten;
const HAAR = 'rgba(255,255,255,.07)';
const FLAECHE = 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)';
const lbl: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
const MERKER_FENSTER = 'make-os-jarvis-fenster';
const MERKER_STIMME = 'make-os-jarvis-stimme';
const STANDARD: Fenster = { offen: false, w: 400, h: 560, right: 22, bottom: 22 };
const MIN_W = 320, MIN_H = 380;

/** Klickbare Pille im Chip-Stil — leuchtet in der Farbe, wenn sie „an" ist. */
const chip = (farbe: string, an = true): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, letterSpacing: '.02em',
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
      {puls && <span className="jarvis-orb-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${J}` }} />}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${J}` }} />
      <span className={puls ? 'jarvis-orb-kern' : undefined} style={{ position: 'absolute', inset: size * 0.28, borderRadius: '50%', background: J, boxShadow: `0 0 ${size * 0.4}px ${J}66` }} />
    </span>
  );
}

/** Was auf die Platte geht — die Klick-Vorschläge bleiben flüchtig. */
const zuNachrichten = (msgs: Msg[]): VerlaufNachricht[] => msgs.map(m => ({
  rolle: m.role === 'user' ? 'kevin' as const : 'jarvis' as const,
  text: m.text,
  zeit: m.zeit ?? new Date().toISOString(),
  ...(m.ran?.length ? { ran: m.ran } : {}),
}));

const ausNachrichten = (ns: VerlaufNachricht[]): Msg[] => ns.map(n => ({
  role: n.rolle === 'kevin' ? 'user' as const : 'kimmi' as const,
  text: n.text,
  zeit: n.zeit,
  ...(n.ran?.length ? { ran: n.ran } : {}),
}));

export function JarvisPanel() {
  const [fenster, setFenster] = useState<Fenster>(STANDARD);
  const [convo, setConvo] = useState<Msg[]>([]);
  const [ask, setAsk] = useState('');
  const [thinking, setThinking] = useState(false);
  // Wie viel vorbereitet ist und auf Kevin wartet (kommt aus jeder Antwort).
  const [stapelOffen, setStapelOffen] = useState(0);
  // Beleg an Jarvis geben: lesen → zeigen → erst nach Bestätigung buchen.
  const dateiWahl = useRef<HTMLInputElement>(null);
  const [belegLaeuft, setBelegLaeuft] = useState<string | null>(null);
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [belegFehler, setBelegFehler] = useState<string | null>(null);
  const [belegGebucht, setBelegGebucht] = useState<string | null>(null);
  const [ueberDatei, setUeberDatei] = useState(false);
  const [briefing, setBriefing] = useState('**Sir.** Ich bin da — frag mich, lass mich planen, oder schick mich los.');
  // Gedächtnis
  const [gespraechId, setGespraechId] = useState('');
  const [alle, setAlle] = useState<Gespraech[]>([]);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);
  const [heute, setHeute] = useState('');
  // Stimme
  const [vorlesen, setVorlesen] = useState(false);
  const [freihand, setFreihand] = useState(false);

  const convoRef = useRef<HTMLDivElement>(null);
  const beruehrt = useRef(false);   // hat Kevin schon getippt? dann nichts überschreiben
  const freihandRef = useRef(false);
  freihandRef.current = freihand;
  const vorlesenRef = useRef(false);
  vorlesenRef.current = vorlesen;
  // Ziehen (Größe/Position) läuft über einen Ref — kein Re-Render pro Pixel.
  const zug = useRef<{ art: 'groesse' | 'ort'; x: number; y: number; w: number; h: number; right: number; bottom: number } | null>(null);

  const stimme = useStimme(t => { if (!thinking) send(t); });

  // ── Fenster (lokal) ──
  useEffect(() => {
    try {
      const f = localStorage.getItem(MERKER_FENSTER);
      if (f) setFenster({ ...STANDARD, ...JSON.parse(f) });
      const s = localStorage.getItem(MERKER_STIMME);
      if (s) { const j = JSON.parse(s); setVorlesen(!!j.vorlesen); setFreihand(!!j.freihand); }
    } catch { /* egal */ }
    setHeute(new Date().toISOString().slice(0, 10));
  }, []);
  useEffect(() => { try { localStorage.setItem(MERKER_FENSTER, JSON.stringify(fenster)); } catch { /* egal */ } }, [fenster]);
  useEffect(() => { try { localStorage.setItem(MERKER_STIMME, JSON.stringify({ vorlesen, freihand })); } catch { /* egal */ } }, [vorlesen, freihand]);

  // ── Gedächtnis laden: das letzte Gespräch kommt zurück, alle anderen in die Liste ──
  useEffect(() => {
    fetch('/api/state/jarvis-verlauf').then(r => r.json()).then((d: { gespraeche?: Gespraech[] }) => {
      const gs = Array.isArray(d.gespraeche) ? d.gespraeche : [];
      setAlle(gs);
      if (beruehrt.current) return;
      const letztes = gs[0];
      if (letztes?.nachrichten?.length) {
        setConvo(ausNachrichten(letztes.nachrichten));
        setGespraechId(letztes.id);
      }
    }).catch(() => {});
  }, []);

  /** Gespräch sofort auf die Platte — Kevins Regel: gleicher Stand beim nächsten Reingucken. */
  /** Datei einlesen und von Jarvis auswerten lassen. Schreibt noch nichts. */
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
      if (d.ok) setBeleg({ ...d.beleg, dateiname: f.name });
      else setBelegFehler(d.error ?? 'Beleg konnte nicht gelesen werden.');
    } catch (e) {
      setBelegFehler(e instanceof Error ? e.message : 'Beleg konnte nicht gelesen werden.');
    }
    setBelegLaeuft(null);
  }

  /** Erst jetzt schreiben — Kevin hat die Zahlen gesehen. */
  async function belegUebernehmen(ziel: 'buchung' | 'rechnung') {
    if (!beleg) return;
    setBelegLaeuft('speichern');
    try {
      const r = await fetch('/api/beleg/uebernehmen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ziel, partner: beleg.partner, datum: beleg.datum,
          betrag: beleg.betragBrutto ?? beleg.betragNetto,
          kategorie: beleg.kategorie, zweck: beleg.zweck,
          faellig: beleg.faellig, rechnungsnummer: beleg.rechnungsnummer,
        }),
      });
      const d = await r.json();
      if (d.ok) { setBelegGebucht(`${d.angelegt} → ${d.wo}`); setBeleg(null); }
      else setBelegFehler(d.error ?? 'Nicht übernommen.');
    } catch { setBelegFehler('Nicht übernommen — läuft die Software noch?'); }
    setBelegLaeuft(null);
  }

  const speichere = (msgs: Msg[], id: string) => {
    if (!id || !msgs.length) return;
    const nachrichten = zuNachrichten(msgs);
    const g: Gespraech = {
      id,
      begonnen: nachrichten[0]?.zeit ?? new Date().toISOString(),
      zuletzt: nachrichten[nachrichten.length - 1]?.zeit ?? new Date().toISOString(),
      titel: titelAus(msgs.find(m => m.role === 'user')?.text ?? ''),
      nachrichten,
    };
    setAlle(a => [g, ...a.filter(x => x.id !== id)]);
    fetch('/api/state/jarvis-verlauf', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gespraech: g }), keepalive: true,
    }).catch(() => {});
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

  useEffect(() => { const el = convoRef.current; if (el) el.scrollTop = el.scrollHeight; }, [convo, thinking, fenster.offen]);

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

  const send = async (q: string) => {
    beruehrt.current = true;
    setAsk(''); setThinking(true); setZeigeVerlauf(false);
    const id = gespraechId || `g-${Date.now().toString(36)}`;
    if (!gespraechId) setGespraechId(id);
    const vorher = convo;
    const meins: Msg = { role: 'user', text: q, zeit: new Date().toISOString() };
    setConvo(c => [...c, meins]);
    try {
      const r = await fetch('/api/kimmi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Der bisherige Zug geht mit — das ist Jarvis' Gedächtnis.
        body: JSON.stringify({ message: q, verlauf: zuNachrichten(vorher) }),
      });
      const d = await r.json();
      if (typeof d.stapelOffen === 'number') setStapelOffen(d.stapelOffen);
      const antwort: Msg = {
        role: 'kimmi', text: d.reply ?? 'Ich habe gerade keine Antwort.', zeit: new Date().toISOString(),
        handoffs: Array.isArray(d.handoffs) ? d.handoffs : undefined,
        ran: Array.isArray(d.ran) && d.ran.length ? d.ran : undefined,
      };
      setConvo(c => [...c, antwort]);
      speichere([...vorher, meins, antwort], id);
      if (vorlesenRef.current) {
        stimme.lies(fuerStimme(antwort.text), () => { if (freihandRef.current) stimme.hoerZu(); });
      }
    } catch {
      const fehler: Msg = { role: 'kimmi', text: 'Ich konnte gerade nicht antworten — versuch es nochmal.', zeit: new Date().toISOString() };
      setConvo(c => [...c, fehler]);
      speichere([...vorher, meins, fehler], id);
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    fetch('/api/jarvis/stapel').then(r => r.json()).then(d => setStapelOffen(Number(d.offen) || 0)).catch(() => {});
  }, []);

  // Der Stapel-Stand auch ohne Gespräch — sonst sieht Kevin morgens nicht,
  // dass etwas auf ihn wartet.
  useEffect(() => {
    fetch('/api/jarvis/stapel')
      .then(r => r.json())
      .then(d => setStapelOffen(Number(d.offen) || 0))
      .catch(() => {});
  }, []);

  const neuesGespraech = () => {
    stimme.schweig(); stimme.hoerAuf();
    setConvo([]); setGespraechId(''); setZeigeVerlauf(false);
    beruehrt.current = true;
  };

  const oeffne = (g: Gespraech) => {
    stimme.schweig(); stimme.hoerAuf();
    setConvo(ausNachrichten(g.nachrichten)); setGespraechId(g.id);
    setZeigeVerlauf(false);
    beruehrt.current = true;
  };

  const loesche = (id: string) => {
    setAlle(a => a.filter(g => g.id !== id));
    if (id === gespraechId) { setConvo([]); setGespraechId(''); }
    fetch(`/api/state/jarvis-verlauf?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  // ── Zu: das kleine pulsierende Icon, das überall mitgeht ──
  if (!fenster.offen) {
    return (
      <button onClick={() => setFenster(f => ({ ...f, offen: true }))} aria-label="Jarvis öffnen" title="Jarvis" className="jarvis-fab"
        style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 70, width: 52, height: 52, borderRadius: '50%', border: 'none', background: FLAECHE, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 8px 30px rgba(0,0,0,.45), 0 0 26px ${J}33, inset 0 1px 0 rgba(255,255,255,.08)` }}>
        <Orb size={30} puls />
        {(thinking || stimme.hoert || stimme.spricht) && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.achtung, boxShadow: `0 0 8px ${stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.achtung}33` }} />}
      </button>
    );
  }

  // Im engen Kopf zählt Kürze — der Gesprächsknopf trägt den Zustand ohnehin.
  const zustand = stimme.hoert ? '● hört zu' : stimme.spricht ? '● spricht' : '● online';
  const zustandFarbe = stimme.hoert ? LEUCHT.kritisch : stimme.spricht ? J : LEUCHT.gut;

  return (
    <div className="jarvis-fenster"
      // Beleg einfach aufs Fenster ziehen — der zweite Weg neben dem 📎.
      onDragOver={e => { e.preventDefault(); if (!ueberDatei) setUeberDatei(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setUeberDatei(false); }}
      onDrop={e => {
        e.preventDefault(); setUeberDatei(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void belegLesen(f);
      }}
      style={{ position: 'fixed', right: fenster.right, bottom: fenster.bottom, width: `min(${fenster.w}px, calc(100vw - 16px))`, height: `min(${fenster.h}px, calc(100vh - 16px))`, zIndex: 70, display: 'flex', flexDirection: 'column', background: FLAECHE, border: `1px solid ${ueberDatei ? C.aktiv : HAAR}`, borderRadius: 20, boxShadow: `0 24px 70px rgba(0,0,0,.55), 0 0 40px -10px ${J}40, inset 0 1px 0 rgba(255,255,255,.06)`, overflow: 'hidden', color: C.ink, fontFamily: SCHRIFT.text }}>
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
        <Orb size={26} puls={stimme.hoert || stimme.spricht} />
        <div style={{ minWidth: 0, flex: '0 0 auto' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, letterSpacing: '.06em' }}>JARVIS</div>
          <div style={{ fontSize: TYP.mikro, fontWeight: 600, color: zustandFarbe, whiteSpace: 'nowrap' }}>{zustand}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }} onPointerDown={e => e.stopPropagation()}>
          {/* Gesprächs-Modus: ein Knopf für alles — Mikrofon an, Antwort wird
              vorgelesen, danach hört er von selbst wieder zu. Kevins Ansage:
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
              Kevin gerade arbeitet. Wer den ganzen Empfang will, geht hier. */}
          <Link href="/jarvis" title="Zum Hirn — der ganze Empfang" style={chip(J)}>
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
          <button onClick={() => setFenster(f => ({ ...f, w: STANDARD.w, h: STANDARD.h, right: STANDARD.right, bottom: STANDARD.bottom }))} title="Normalgröße"
            style={{ ...rund, width: 26, height: 26, borderRadius: 8, fontSize: 12, lineHeight: 1 }}>◱</button>
          <button onClick={() => { stimme.schweig(); stimme.hoerAuf(); setFenster(f => ({ ...f, offen: false })); }} title="Schließen — Jarvis bleibt als Icon da"
            style={{ ...rund, width: 26, height: 26, borderRadius: 8, fontSize: 12, lineHeight: 1 }}>—</button>
        </div>
      </div>

      {/* Verlauf — alle Gespräche, jederzeit wieder aufmachbar */}
      {zeigeVerlauf && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
          <div style={{ ...lbl, padding: '12px 16px 6px' }}>Verlauf · {alle.length} {alle.length === 1 ? 'Gespräch' : 'Gespräche'}</div>
          {!alle.length && <div style={{ padding: '18px 16px', fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55 }}>Noch nichts gespeichert. Ab jetzt bleibt jedes Gespräch hier liegen.</div>}
          {alle.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderTop: `1px solid rgba(255,255,255,.05)`, background: g.id === gespraechId ? `${J}14` : 'transparent' }}>
              <button onClick={() => oeffne(g)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontFamily: SCHRIFT.text }}>
                <div style={{ fontSize: TYP.bedien, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titel}</div>
                <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 2 }}>
                  {heute ? wannText(g.zuletzt, heute) : g.zuletzt.slice(0, 10)} · {g.nachrichten.length} Nachrichten
                </div>
              </button>
              <button onClick={() => loesche(g.id)} title="Gespräch löschen" aria-label={`Gespräch „${g.titel}" löschen`}
                style={{ background: 'transparent', border: 0, color: C.inkLeise, cursor: 'pointer', fontSize: 13, padding: '2px 4px', flex: '0 0 auto' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Konversation */}
      {!zeigeVerlauf && (
      <div ref={convoRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {convo.length === 0 && !thinking && (
          <div>
            <div style={{ ...lbl, marginBottom: 8 }}><span style={{ color: J }}>JARVIS</span> · Lagebericht</div>
            <Rich text={briefing} />
          </div>
        )}
        {convo.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '88%', background: `${C.aktiv}22`, color: C.ink, borderRadius: 16, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}>{m.text}</div>
          : <div key={i} style={{ maxWidth: '96%' }}>
              <div style={{ ...lbl, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: J }}>JARVIS</span>
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
                    <Chip key={xi} farbe={x.ok ? LEUCHT.gut : LEUCHT.kritisch}>
                      <span style={{ fontFamily: SCHRIFT.mono, fontWeight: 600 }}>⚙ {x.agent}</span> {x.ok ? 'ausgeführt' : 'fehlgeschlagen'}
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
        {thinking && <div style={{ fontSize: 12, color: C.inkLeise }}><span style={{ ...lbl, color: J }}>JARVIS</span> denkt nach …</div>}
      </div>
      )}

      {/* Eingabe */}
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${HAAR}`, background: 'rgba(255,255,255,.03)' }}>
        {/* ── Beleg: gelesen, noch nicht gebucht ── */}
        {belegLaeuft && belegLaeuft !== 'speichern' && (
          <div style={{ fontSize: 12, fontWeight: 600, color: C.aktiv, marginBottom: 7 }}>
            liest {belegLaeuft} …
          </div>
        )}
        {belegFehler && (
          <div style={{ fontSize: 12, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 12, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            {belegFehler}
            <button onClick={() => setBelegFehler(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {belegGebucht && (
          <div style={{ fontSize: 12, color: LEUCHT.gut, background: `${LEUCHT.gut}14`, borderRadius: 12, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            Übernommen: {belegGebucht}
            <button onClick={() => setBelegGebucht(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {beleg && (
          <div style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 9 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>
              Beleg gelesen · {beleg.dateiname}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: 12.5 }}>
              <span style={{ color: C.inkLeise }}>Partner</span><span style={{ color: C.ink }}>{beleg.partner || '—'}</span>
              <span style={{ color: C.inkLeise }}>Betrag</span>
              <span style={zahl}>
                {beleg.betragBrutto != null ? `${beleg.betragBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${beleg.waehrung ?? 'EUR'}` : '—'}
                {beleg.betragNetto != null && beleg.betragBrutto !== beleg.betragNetto && <span style={{ color: C.inkLeise }}> · netto {beleg.betragNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>}
              </span>
              <span style={{ color: C.inkLeise }}>Datum</span><span style={zahl}>{beleg.datum ?? '—'}</span>
              {beleg.zweck && <><span style={{ color: C.inkLeise }}>Zweck</span><span style={{ color: C.inkDim }}>{beleg.zweck}</span></>}
              {beleg.kategorie && <><span style={{ color: C.inkLeise }}>Kategorie</span><span style={{ color: C.inkDim }}>{beleg.kategorie}</span></>}
              <span style={{ color: C.inkLeise }}>Richtung</span>
              <span style={{ color: beleg.richtung === 'unklar' ? LEUCHT.achtung : C.inkDim }}>
                {beleg.richtung === 'eingang' ? 'du zahlst' : beleg.richtung === 'ausgang' ? 'du bekommst Geld' : 'unklar — du entscheidest'}
              </span>
            </div>
            {!!beleg.unsicher?.length && (
              <div style={{ fontSize: 11.5, color: LEUCHT.achtung, marginTop: 7, lineHeight: 1.45 }}>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: LEUCHT.kritisch, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="jarvis-orb-kern" style={{ width: 7, height: 7, borderRadius: '50%', background: LEUCHT.kritisch, boxShadow: `0 0 8px ${LEUCHT.kritisch}33`, display: 'inline-block' }} />
            {stimme.teil ? stimme.teil : 'Ich höre …'}
          </div>
        )}
        {stimme.fehler && <div style={{ fontSize: TYP.mikro, color: LEUCHT.achtung, marginBottom: 6 }}>{stimme.fehler}</div>}
        <div style={{ ...feld, display: 'flex', alignItems: 'flex-end', gap: 9, padding: '8px 10px', boxShadow: stimme.hoert ? `0 0 0 1px ${LEUCHT.kritisch}, 0 0 14px ${LEUCHT.kritisch}33` : undefined }}>
          <textarea value={ask} onChange={e => setAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && ask.trim() && !thinking) { e.preventDefault(); send(ask.trim()); } }}
            placeholder={stimme.hoert ? 'Sprich einfach …' : 'Sprich mit Jarvis …'} aria-label="Nachricht an Jarvis" rows={fenster.h > 640 ? 2 : 1} disabled={thinking}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: C.ink, fontSize: 13.5, fontFamily: SCHRIFT.text, resize: 'none', lineHeight: 1.5, padding: '4px 2px' }} />
          {stimme.kannHoeren && (
            <button onClick={() => stimme.hoert ? stimme.hoerAuf() : stimme.hoerZu()} disabled={thinking}
              aria-label={stimme.hoert ? 'Aufnahme beenden' : 'Sprechen'} title={stimme.hoert ? 'Fertig — abschicken' : 'Mikrofon: sprich mit Jarvis'}
              style={{ ...rund, cursor: thinking ? 'default' : 'pointer', background: stimme.hoert ? `${LEUCHT.kritisch}22` : 'rgba(255,255,255,.06)', color: stimme.hoert ? LEUCHT.kritisch : C.inkDim, boxShadow: stimme.hoert ? `0 0 12px ${LEUCHT.kritisch}33` : undefined }}>
              {stimme.hoert ? '■' : <Mikro farbe={C.inkDim} />}
            </button>
          )}
          {/* Beleg an Jarvis geben — Kevins Ansage: „Rechnung fotografieren,
              Zahlen landen im System." */}
          <button onClick={() => dateiWahl.current?.click()} disabled={thinking || !!belegLaeuft}
            aria-label="Beleg anhängen" title="Rechnung oder Quittung anhängen — Jarvis liest die Zahlen heraus"
            style={{ ...rund, fontSize: 15, cursor: thinking || belegLaeuft ? 'default' : 'pointer' }}>📎</button>
          <input ref={dateiWahl} type="file" accept="image/*,application/pdf" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) void belegLesen(f); e.target.value = ''; }} />
          <button onClick={() => ask.trim() && !thinking && send(ask.trim())} aria-label="Senden" disabled={thinking}
            style={{ ...rund, background: thinking ? 'rgba(255,255,255,.08)' : C.aktiv, color: thinking ? C.inkLeise : C.grund, fontSize: 15, fontWeight: 700, cursor: thinking ? 'default' : 'pointer', boxShadow: thinking ? undefined : `0 6px 18px -6px ${C.aktiv}99` }}>↑</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          {['Plane meinen Tag', 'Was ist heute wichtig?', 'Was kann ich abgeben?'].map(c => (
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
              onChange={e => { stimme.waehleStimme(e.target.value); stimme.lies('Ich bin Jarvis. So klinge ich.'); }}
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
