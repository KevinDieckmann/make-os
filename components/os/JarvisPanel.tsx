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

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import type { Priority } from '@/types';
import { Rich } from './Rich';
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

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const MERKER_FENSTER = 'make-os-jarvis-fenster';
const MERKER_STIMME = 'make-os-jarvis-stimme';
const STANDARD: Fenster = { offen: false, w: 400, h: 560, right: 22, bottom: 22 };
const MIN_W = 320, MIN_H = 380;

const knopf = (aktiv?: boolean) => ({
  fontFamily: T.mono, fontSize: 11, background: aktiv ? T.accentSoft : 'transparent',
  border: `1px solid ${aktiv ? T.lineHot : T.line}`, color: aktiv ? T.accent : T.muted,
  borderRadius: 7, padding: '4px 8px', cursor: 'pointer', lineHeight: 1.2,
});

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
      {puls && <span className="jarvis-orb-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}` }} />}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}` }} />
      <span className={puls ? 'jarvis-orb-kern' : undefined} style={{ position: 'absolute', inset: size * 0.28, borderRadius: '50%', background: T.accent, boxShadow: `0 0 ${size * 0.4}px ${T.accent}66` }} />
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
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
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
        style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 70, width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'linear-gradient(165deg,#1A2024,#12171A)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 8px 30px rgba(0,0,0,.45), 0 0 26px ${T.accent}33, inset 0 1px 0 rgba(255,255,255,.08)` }}>
        <Orb size={30} puls />
        {(thinking || stimme.hoert || stimme.spricht) && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: stimme.hoert ? T.crit : stimme.spricht ? T.accent : T.amber }} />}
      </button>
    );
  }

  // Im engen Kopf zählt Kürze — der Gesprächsknopf trägt den Zustand ohnehin.
  const zustand = stimme.hoert ? '● hört zu' : stimme.spricht ? '● spricht' : '● online';

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
      style={{ position: 'fixed', right: fenster.right, bottom: fenster.bottom, width: `min(${fenster.w}px, calc(100vw - 16px))`, height: `min(${fenster.h}px, calc(100vh - 16px))`, zIndex: 70, display: 'flex', flexDirection: 'column', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: `1px solid ${ueberDatei ? T.accent : 'rgba(255,255,255,.08)'}`, borderRadius: 20, boxShadow: `0 24px 70px rgba(0,0,0,.55), 0 0 40px -10px ${T.accent}44, inset 0 1px 0 rgba(255,255,255,.06)`, overflow: 'hidden' }}>
      {ueberDatei && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: `${T.accent}14`, border: `2px dashed ${T.accent}`, borderRadius: 20, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.accentInk }}>Beleg loslassen — ich lese die Zahlen heraus</span>
        </div>
      )}
      {/* Zieh-Ecke: stufenlos so groß, wie du arbeiten willst */}
      <div onPointerDown={zugStart('groesse')} title="Ziehen zum Vergrößern"
        style={{ position: 'absolute', top: 0, left: 0, width: 26, height: 26, cursor: 'nwse-resize', zIndex: 3, borderTop: `2px solid ${T.accent}55`, borderLeft: `2px solid ${T.accent}55`, borderTopLeftRadius: 20 }} />

      {/* Kopf — am Kopf packst du das Fenster und schiebst es, wohin du willst */}
      <div onPointerDown={zugStart('ort')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 20px', borderBottom: `1px solid ${T.line}`, background: 'rgba(255,255,255,.03)', cursor: 'grab', touchAction: 'none' }}>
        <Orb size={26} puls={stimme.hoert || stimme.spricht} />
        <div style={{ minWidth: 0, flex: '0 0 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>JARVIS</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: stimme.hoert ? T.crit : stimme.spricht ? T.accentInk : T.accent, whiteSpace: 'nowrap' }}>{zustand}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }} onPointerDown={e => e.stopPropagation()}>
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
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 11,
                borderRadius: 8, padding: '5px 10px', cursor: 'pointer', lineHeight: 1.2,
                border: `1px solid ${freihand ? T.accent : T.line}`,
                background: freihand ? T.accentSoft : 'transparent',
                color: freihand ? T.accent : T.muted,
              }}>
              <Mikro farbe={freihand ? T.accent : T.muted} />
              <span style={{ whiteSpace: 'nowrap' }}>
                {freihand ? (stimme.hoert ? 'hört' : stimme.spricht ? 'spricht' : 'Gespräch') : 'Gespräch'}
              </span>
            </button>
          )}
          {/* Weg ins volle Hirn. Das Symbol selbst öffnet weiter dieses Fenster:
              eine Frage im Vorbeigehen soll die Seite nicht verlassen, auf der
              Kevin gerade arbeitet. Wer den ganzen Empfang will, geht hier. */}
          <Link href="/jarvis" title="Zum Hirn — der ganze Empfang"
            style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, background: T.accentSoft,
              border: `1px solid ${T.lineHot}`, borderRadius: 7, padding: '4px 9px',
              textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ◎ Hirn
          </Link>
          {stapelOffen > 0 && (
            <Link href="/os/stapel" title={`${stapelOffen} vorbereitet — wartet auf deine Freigabe`}
              style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.amber, background: `${T.amber}18`,
                border: `1px solid ${T.amber}55`, borderRadius: 7, padding: '4px 9px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ✋ {stapelOffen}
            </Link>
          )}
          <button onClick={() => setZeigeVerlauf(v => !v)} title={`Verlauf — ${alle.length} Gespräche`} style={{ ...knopf(zeigeVerlauf), whiteSpace: 'nowrap' }}>
            ☰{alle.length ? ` ${alle.length}` : ''}
          </button>
          {convo.length > 0 && <button onClick={neuesGespraech} title="Neues Gespräch (das alte bleibt im Verlauf)" style={{ ...knopf(), whiteSpace: 'nowrap' }}>Neu</button>}
          <button onClick={() => setFenster(f => ({ ...f, w: STANDARD.w, h: STANDARD.h, right: STANDARD.right, bottom: STANDARD.bottom }))} title="Normalgröße"
            style={{ fontSize: 11, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 }}>◱</button>
          <button onClick={() => { stimme.schweig(); stimme.hoerAuf(); setFenster(f => ({ ...f, offen: false })); }} title="Schließen — Jarvis bleibt als Icon da"
            style={{ fontSize: 12, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 }}>—</button>
        </div>
      </div>

      {/* Verlauf — alle Gespräche, jederzeit wieder aufmachbar */}
      {zeigeVerlauf && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
          <div style={{ ...lbl, padding: '12px 16px 6px' }}>Verlauf · {alle.length} {alle.length === 1 ? 'Gespräch' : 'Gespräche'}</div>
          {!alle.length && <div style={{ padding: '18px 16px', fontSize: 12.5, color: T.muted }}>Noch nichts gespeichert. Ab jetzt bleibt jedes Gespräch hier liegen.</div>}
          {alle.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderTop: `1px solid ${T.lineSoft}`, background: g.id === gespraechId ? T.accentSoft : 'transparent' }}>
              <button onClick={() => oeffne(g)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titel}</div>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 2 }}>
                  {heute ? wannText(g.zuletzt, heute) : g.zuletzt.slice(0, 10)} · {g.nachrichten.length} Nachrichten
                </div>
              </button>
              <button onClick={() => loesche(g.id)} title="Gespräch löschen" aria-label={`Gespräch „${g.titel}" löschen`}
                style={{ background: 'transparent', border: 0, color: T.muted, cursor: 'pointer', fontSize: 13, padding: '2px 4px', flex: '0 0 auto' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Konversation */}
      {!zeigeVerlauf && (
      <div ref={convoRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {convo.length === 0 && !thinking && (
          <div>
            <div style={{ ...lbl, marginBottom: 8 }}><span style={{ color: T.accent }}>JARVIS</span> · Lagebericht</div>
            <Rich text={briefing} />
          </div>
        )}
        {convo.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '88%', background: T.accentSoft, border: `1px solid ${T.lineHot}`, color: T.ink, borderRadius: '16px 16px 6px 16px', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          : <div key={i} style={{ maxWidth: '96%' }}>
              <div style={{ ...lbl, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: T.accent }}>JARVIS</span>
                {stimme.kannSprechen && (
                  <button onClick={() => stimme.spricht ? stimme.schweig() : stimme.lies(fuerStimme(m.text))} title={stimme.spricht ? 'Still' : 'Vorlesen'}
                    style={{ background: 'transparent', border: 0, color: T.muted, cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: T.mono }}>
                    {stimme.spricht ? '■' : '▶'}
                  </button>
                )}
              </div>
              <Rich text={m.text} />
              {m.ran && m.ran.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {m.ran.map((x, xi) => (
                    <span key={xi} style={{ fontFamily: T.mono, fontSize: 11, color: x.ok ? T.accent : T.crit, border: `1px solid ${x.ok ? T.accent : T.crit}44`, borderRadius: 5, padding: '2px 7px' }}>
                      ⚙ {x.agent} {x.ok ? 'ausgeführt' : 'fehlgeschlagen'}
                    </span>
                  ))}
                </div>
              )}
              {m.handoffs && m.handoffs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {m.handoffs.map((h, hi) => (
                    <Link key={hi} href={h.href} title={h.why} style={{ fontSize: 12, fontWeight: 600, color: T.accent, background: T.accentSoft, border: `1px solid ${T.lineHot}`, borderRadius: 8, padding: '6px 11px', textDecoration: 'none' }}>→ {h.name} öffnen</Link>
                  ))}
                </div>
              )}
            </div>
        )}
        {thinking && <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}><span style={{ color: T.accent }}>JARVIS</span> denkt nach …</div>}
      </div>
      )}

      {/* Eingabe */}
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${T.line}`, background: 'rgba(255,255,255,.03)' }}>
        {/* ── Beleg: gelesen, noch nicht gebucht ── */}
        {belegLaeuft && belegLaeuft !== 'speichern' && (
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, marginBottom: 7 }}>
            liest {belegLaeuft} …
          </div>
        )}
        {belegFehler && (
          <div style={{ fontSize: 12, color: T.amber, background: `${T.amber}12`, border: `1px solid ${T.amber}44`, borderRadius: 9, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            {belegFehler}
            <button onClick={() => setBelegFehler(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {belegGebucht && (
          <div style={{ fontSize: 12, color: T.accentInk, background: T.accentSoft, border: `1px solid ${T.lineHot}`, borderRadius: 9, padding: '8px 11px', marginBottom: 8, lineHeight: 1.5 }}>
            Übernommen: {belegGebucht}
            <button onClick={() => setBelegGebucht(null)} style={{ marginLeft: 7, background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {beleg && (
          <div style={{ background: T.panel2, border: `1px solid ${T.lineHot}`, borderRadius: 11, padding: '10px 12px', marginBottom: 9 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
              Beleg gelesen · {beleg.dateiname}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: 12.5 }}>
              <span style={{ color: T.muted }}>Partner</span><span style={{ color: T.ink }}>{beleg.partner || '—'}</span>
              <span style={{ color: T.muted }}>Betrag</span>
              <span style={{ color: T.ink, fontFamily: T.mono }}>
                {beleg.betragBrutto != null ? `${beleg.betragBrutto.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${beleg.waehrung ?? 'EUR'}` : '—'}
                {beleg.betragNetto != null && beleg.betragBrutto !== beleg.betragNetto && <span style={{ color: T.muted }}> · netto {beleg.betragNetto.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>}
              </span>
              <span style={{ color: T.muted }}>Datum</span><span style={{ color: T.ink, fontFamily: T.mono }}>{beleg.datum ?? '—'}</span>
              {beleg.zweck && <><span style={{ color: T.muted }}>Zweck</span><span style={{ color: T.inkDim }}>{beleg.zweck}</span></>}
              {beleg.kategorie && <><span style={{ color: T.muted }}>Kategorie</span><span style={{ color: T.inkDim }}>{beleg.kategorie}</span></>}
              <span style={{ color: T.muted }}>Richtung</span>
              <span style={{ color: beleg.richtung === 'unklar' ? T.amber : T.inkDim }}>
                {beleg.richtung === 'eingang' ? 'du zahlst' : beleg.richtung === 'ausgang' ? 'du bekommst Geld' : 'unklar — du entscheidest'}
              </span>
            </div>
            {!!beleg.unsicher?.length && (
              <div style={{ fontSize: 11.5, color: T.amber, marginTop: 7, lineHeight: 1.45 }}>
                Nicht sicher gelesen: {beleg.unsicher.join(' · ')} — bitte prüfen.
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              <button onClick={() => belegUebernehmen('buchung')} disabled={belegLaeuft === 'speichern'}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${T.lineHot}`, background: beleg.richtung === 'ausgang' ? 'transparent' : T.accent, color: beleg.richtung === 'ausgang' ? T.inkDim : T.void }}>
                Als Ausgabe buchen
              </button>
              <button onClick={() => belegUebernehmen('rechnung')} disabled={belegLaeuft === 'speichern'}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${beleg.richtung === 'ausgang' ? T.lineHot : T.line}`, background: beleg.richtung === 'ausgang' ? T.accent : 'transparent', color: beleg.richtung === 'ausgang' ? T.void : T.inkDim }}>
                Als Rechnung führen
              </button>
              <button onClick={() => setBeleg(null)} style={{ fontSize: 12, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>Verwerfen</button>
            </div>
          </div>
        )}
        {stimme.hoert && (
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.crit, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="jarvis-orb-kern" style={{ width: 7, height: 7, borderRadius: '50%', background: T.crit, display: 'inline-block' }} />
            {stimme.teil ? stimme.teil : 'Ich höre …'}
          </div>
        )}
        {stimme.fehler && <div style={{ fontSize: 11, color: T.amber, marginBottom: 6 }}>{stimme.fehler}</div>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, background: 'rgba(255,255,255,.05)', border: `1px solid ${stimme.hoert ? T.crit : 'rgba(255,255,255,.06)'}`, borderRadius: 14, padding: '8px 10px' }}>
          <textarea value={ask} onChange={e => setAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && ask.trim() && !thinking) { e.preventDefault(); send(ask.trim()); } }}
            placeholder={stimme.hoert ? 'Sprich einfach …' : 'Sprich mit Jarvis …'} aria-label="Nachricht an Jarvis" rows={fenster.h > 640 ? 2 : 1} disabled={thinking}
            style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: T.ink, fontSize: 13.5, fontFamily: T.sans, resize: 'none', lineHeight: 1.5 }} />
          {stimme.kannHoeren && (
            <button onClick={() => stimme.hoert ? stimme.hoerAuf() : stimme.hoerZu()} disabled={thinking}
              aria-label={stimme.hoert ? 'Aufnahme beenden' : 'Sprechen'} title={stimme.hoert ? 'Fertig — abschicken' : 'Mikrofon: sprich mit Jarvis'}
              style={{ width: 32, height: 32, borderRadius: 9, flex: '0 0 auto', cursor: thinking ? 'default' : 'pointer', fontSize: 14,
                border: `1px solid ${stimme.hoert ? T.crit : T.line}`, background: stimme.hoert ? `${T.crit}22` : 'transparent', color: stimme.hoert ? T.crit : T.inkDim }}>
              {stimme.hoert ? '■' : <Mikro farbe={T.inkDim} />}
            </button>
          )}
          {/* Beleg an Jarvis geben — Kevins Ansage: „Rechnung fotografieren,
              Zahlen landen im System." */}
          <button onClick={() => dateiWahl.current?.click()} disabled={thinking || !!belegLaeuft}
            aria-label="Beleg anhängen" title="Rechnung oder Quittung anhängen — Jarvis liest die Zahlen heraus"
            style={{ width: 32, height: 32, borderRadius: 9, flex: '0 0 auto', cursor: thinking || belegLaeuft ? 'default' : 'pointer', fontSize: 15,
              border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim }}>📎</button>
          <input ref={dateiWahl} type="file" accept="image/*,application/pdf" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) void belegLesen(f); e.target.value = ''; }} />
          <button onClick={() => ask.trim() && !thinking && send(ask.trim())} aria-label="Senden" disabled={thinking}
            style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.lineHot}`, background: T.accent, color: T.void, cursor: thinking ? 'default' : 'pointer', fontSize: 15, flex: '0 0 auto' }}>↑</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          {['Plane meinen Tag', 'Was ist heute wichtig?', 'Was kann ich abgeben?'].map(c => (
            <button key={c} onClick={() => !thinking && send(c)} disabled={thinking}
              style={{ fontSize: 11, color: T.inkDim, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px', cursor: thinking ? 'default' : 'pointer' }}>{c}</button>
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
              style={{ fontFamily: T.mono, fontSize: 11, background: 'transparent', border: `1px solid ${T.line}`, color: T.muted, borderRadius: 7, padding: '4px 6px', cursor: 'pointer', maxWidth: 104 }}>
              {stimme.stimmen.map(v => <option key={v.name} value={v.name} style={{ background: T.panel, color: T.ink }}>{v.kurz}</option>)}
            </select>
          )}
          {stimme.spricht && (
            <button onClick={() => stimme.schweig()} title="Vorlesen abbrechen" style={{ ...knopf(true), color: T.amber, borderColor: `${T.amber}66` }}>
              ■ Still
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
