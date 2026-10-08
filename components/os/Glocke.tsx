'use client';

// ─── Die Glocke oben rechts (Kevin + Malin, 28.09. abends, Paket B2) ──────────
// „Wenn Kevin Malin eine Aufgabe zuteilt, bekommt sie eine Benachrichtigung — oben rechts
// leuchtet es rot.“ Zeigt: Zuweisungen an mich, Kommentare/Erwähnungen, fällig/überfällig.
// Rote Zahl, solange etwas ungelesen ist; kommt etwas NEUES dazu, pulsiert die Glocke kurz
// (aus bei prefers-reduced-motion). Klick öffnet die Liste (neueste zuerst), ein Eintrag führt
// zum Ziel und gilt als gelesen; „Alle gelesen“ oben.
//
// Sparsam abfragen (Tempo-Befund 27.09., 1 vCPU): beim Laden, bei Fensterfokus/Sichtbarwerden
// und alle 60 s NUR wenn die Seite sichtbar ist — immer mit ETag (304 ohne Inhalt). Der
// Anfrage-Bündler vor dem fetch teilt laufende gleiche Abfragen. Ohne Zugang (403) keine Glocke.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, UserPlus, MessageSquare, AtSign, Clock, AlertTriangle, Layers, Sparkles, Cake, CalendarPlus, CalendarClock, CalendarX, ClipboardCheck, Hourglass, PhoneForwarded, Handshake, Mail, ShieldCheck, Unplug, type LucideIcon } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { vorZeit, type GespeicherteArt, type AbgeleiteteArt, type Meldung, type MeldungenSicht } from '@/lib/meldungen/regeln';
import { useTasks } from '@/context/TasksContext';
import { imArchiv } from '@/lib/aufgaben/neustart';

/** Was aus der Aufgabe einer Meldung geworden ist (29.09., #45) — null = gibt es noch (oder unbekannt). */
export type AufgabeLage = 'weg' | 'papierkorb' | 'archiv' | 'erledigt' | null;
const LAGE_TEXT: Record<Exclude<AufgabeLage, null>, string> = { weg: 'gibt es nicht mehr', papierkorb: 'im Papierkorb', archiv: 'archiviert', erledigt: 'erledigt' };

const TAKT_MS = 60_000;

// ── Stand im Fenster (eine Glocke je Seite, aber Seitenwechsel sollen nicht neu laden) ──
interface Stand { sicht: MeldungenSicht | null; gesperrt: boolean }
let stand: Stand = { sicht: null, gesperrt: false };
let etag: string | null = null;
let laeuft: Promise<void> | null = null;
/** Kennungen, die dieses Fenster schon ungelesen gesehen hat — nur NEUE lassen die Glocke pulsieren. */
const bekannt = new Set<string>();
const hoerer = new Set<(s: Stand, neu: boolean) => void>();
const setzen = (s: Stand, neu = false) => { stand = s; hoerer.forEach(h => h(s, neu)); };

function uebernehmen(sicht: MeldungenSicht) {
  let neu = false;
  for (const m of sicht.meldungen) if (!m.gelesen && !bekannt.has(m.id)) { bekannt.add(m.id); neu = true; }
  setzen({ sicht, gesperrt: false }, neu);
}

async function laden(): Promise<void> {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    try {
      const r = await fetch('/api/meldungen', { cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} });
      if (r.status === 304) return;
      if (r.status === 401 || r.status === 403) { etag = null; setzen({ sicht: null, gesperrt: true }); return; }
      if (!r.ok) return;
      const d = (await r.json()) as { ok?: boolean } & MeldungenSicht;
      if (!d.ok || !Array.isArray(d.meldungen)) return;
      etag = r.headers.get('etag');
      uebernehmen(d);
    } catch { /* offline — beim nächsten Takt wieder */ } finally { laeuft = null; }
  })();
  return laeuft;
}

async function senden(body: Record<string, unknown>): Promise<void> {
  try {
    const r = await fetch('/api/meldungen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => null)) as ({ ok?: boolean } & MeldungenSicht) | null;
    if (r.ok && d?.ok && Array.isArray(d.meldungen)) { etag = null; uebernehmen(d); }
  } catch { /* nächster Takt holt den Stand */ }
}

/** Sofort in der Sicht als gelesen zeigen, dann speichern. */
function gelesenMarkieren(ids: string[] | 'alle') {
  const s = stand.sicht;
  if (s) {
    const meldungen = s.meldungen.map(m => (ids === 'alle' || ids.includes(m.id) ? { ...m, gelesen: true } : m));
    const ungelesen = meldungen.reduce((n, m) => n + (m.gelesen ? 0 : m.art === 'sammel' ? Math.max(1, m.anzahl ?? 1) : 1), 0);
    setzen({ sicht: { ...s, meldungen, ungelesen }, gesperrt: false });
  }
  void senden(ids === 'alle' ? { aktion: 'gelesen', alle: true } : { aktion: 'gelesen', ids });
}

const ART: Record<GespeicherteArt | AbgeleiteteArt, { Icon: LucideIcon; label: string; farbe: string }> = {
  zuweisung: { Icon: UserPlus, label: 'Zuweisung', farbe: C.aktiv },
  kommentar: { Icon: MessageSquare, label: 'Kommentar', farbe: C.inkDim },
  erwaehnung: { Icon: AtSign, label: 'Erwähnung', farbe: C.aktiv },
  faellig: { Icon: Clock, label: 'Fällig', farbe: C.achtung },
  ueberfaellig: { Icon: AlertTriangle, label: 'Überfällig', farbe: C.kritisch },
  zoe: { Icon: Sparkles, label: 'ZOE', farbe: C.aktiv },
  buchung: { Icon: CalendarPlus, label: 'Terminanfrage', farbe: C.aktiv },
  // F1 (29.09.): ein Kalender-Spiegel ließ sich nicht nachziehen (lib/kalender/spiegel-server.ts).
  kalender: { Icon: CalendarX, label: 'Kalender', farbe: C.achtung },
  sammel: { Icon: Layers, label: 'Weitere', farbe: C.inkDim },
  // K2 (29.09.): Geburtstag am Vortag und am Tag — abgeleitet, nie gespeichert.
  geburtstag: { Icon: Cake, label: 'Geburtstag', farbe: '#FF7EB6' },
  // K6a (29.09.): was ansteht — abgeleitet, nie gespeichert (lib/heute/anstehend.ts).
  termin: { Icon: CalendarClock, label: 'Termin', farbe: C.aktiv },
  nachbereiten: { Icon: ClipboardCheck, label: 'Nachbereiten', farbe: C.achtung },
  frist: { Icon: Hourglass, label: 'Frist', farbe: C.achtung },
  followup: { Icon: PhoneForwarded, label: 'Follow-up', farbe: C.aktiv },
  vorschlag: { Icon: Sparkles, label: 'ZOE-Vorschlag', farbe: C.aktiv },
  // Netzwerken (02.10.): jemand hat dir einen Termin gebucht bzw. eine Person zugeteilt (gespeichert) und „Danke-Mails bereit“ (abgeleitet).
  netzwerken: { Icon: Handshake, label: 'Netzwerken', farbe: C.aktiv },
  danke: { Icon: Mail, label: 'Danke-Mails', farbe: C.achtung },
  // 03.10.: etwas am eigenen Zugang wurde geändert (Anmelde-Adresse).
  sicherheit: { Icon: ShieldCheck, label: 'Sicherheit', farbe: C.achtung },
  // 04.10.: „kündigen bis“ eines Vertrags naht (Gesellschafts-Register).
  vertrag: { Icon: Hourglass, label: 'Vertragsfrist', farbe: C.achtung },
  // 06.10. (Inbox 2): ein Postfach braucht eine neue Anmeldung („Verbindung erneuern“).
  postfach: { Icon: Mail, label: 'Postfach', farbe: C.achtung },
  // 08.10.: eine eigene Verbindung (WHOOP) ist getrennt — neu verbinden.
  verbindung: { Icon: Unplug, label: 'Verbindung', farbe: C.achtung },
};

function zeitVon(m: Meldung, jetzt: number): string {
  if (m.virtuell) return m.art === 'faellig' || m.art === 'termin' || m.art === 'nachbereiten' || m.art === 'frist' || m.art === 'followup' || m.art === 'vorschlag' || m.art === 'danke' ? 'heute' : m.art === 'geburtstag' ? (m.titel.includes(' morgen ') ? 'morgen' : 'heute') : 'überfällig';
  return vorZeit(m.am, jetzt);
}

/** Die Liste im Panel — eigene Komponente, damit sie ohne Browser prüfbar ist (Render-Test). */
export function GlockeListe({ sicht, jetzt, oeffnen, alleGelesen, telegram, lage }: {
  sicht: MeldungenSicht;
  jetzt: number;
  oeffnen: (m: Meldung) => void;
  alleGelesen: () => void;
  telegram: (an: boolean) => void;
  /** Lage der Aufgabe hinter einer Meldung (fehlt z. B. im Test). */
  lage?: (aufgabeId: string) => AufgabeLage;
}) {
  return (
    <div style={{ display: 'grid', gap: 0, fontFamily: SCHRIFT.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${C.linie}` }}>
        <span style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, flex: 1 }}>
          Meldungen{sicht.ungelesen ? ` · ${sicht.ungelesen} neu` : ''}
        </span>
        <button type="button" onClick={alleGelesen} disabled={!sicht.ungelesen} className="fassbar"
          style={{ background: 'none', border: 'none', padding: '4px 10px', minHeight: 44, borderRadius: 8, cursor: sicht.ungelesen ? 'pointer' : 'default', color: sicht.ungelesen ? C.aktiv : C.inkLeise, font: 'inherit', fontSize: TYP.bedien, fontWeight: 600 }}>
          Alle gelesen
        </button>
      </div>
      {sicht.meldungen.length === 0 ? (
        <div style={{ padding: '22px 14px', fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center' }}>Keine Meldungen.</div>
      ) : (
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 4, display: 'grid', gap: 2 }}>
          {sicht.meldungen.map(m => {
            const a = ART[m.art];
            return (
              <li key={m.id}>
                <Link href={m.link} onClick={() => oeffnen(m)} data-meldung={m.art}
                  style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '9px 10px', borderRadius: 10, textDecoration: 'none', color: C.ink, background: m.gelesen ? 'transparent' : 'rgba(255,255,255,.035)' }}>
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `${a.farbe}1a`, color: a.farbe }}>
                    <a.Icon size={14} strokeWidth={2} />
                  </span>
                  <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: TYP.bedien, lineHeight: 1.35, color: m.gelesen ? C.inkDim : C.ink, fontWeight: m.gelesen ? 400 : 600, overflowWrap: 'anywhere' }}>{m.titel}</span>
                    <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{a.label} · {zeitVon(m, jetzt)}{(() => { const l = m.bezug?.art === 'aufgabe' ? lage?.(m.bezug.id) : null; return l ? <b style={{ color: l === 'erledigt' ? C.inkDim : C.kritisch, fontWeight: 600 }}> · Aufgabe {LAGE_TEXT[l]}</b> : null; })()}</span>
                  </span>
                  {!m.gelesen && <span aria-label="ungelesen" style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: C.kritisch, boxShadow: `0 0 8px ${C.kritisch}` }} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: `1px solid ${C.linie}`, fontSize: TYP.bedien, color: C.inkLeise, cursor: 'pointer' }}>
        <input type="checkbox" checked={sicht.einstellungen.telegram} onChange={e => telegram(e.target.checked)} style={{ accentColor: C.aktiv }} />
        <span>Auch per Telegram — folgt; es wird noch nichts gesendet.</span>
      </label>
    </div>
  );
}

/**
 * Der Stand der Glocke für andere Bauteile (02.10., Pop-up „Netzwerken“): dieselbe Abfrage und derselbe Takt der Glocke —
 * kein zweiter Abruf. `gelesen` markiert Meldungen sofort in der Sicht und speichert danach.
 */
export function useGlockenSicht(): { sicht: MeldungenSicht | null; gelesen: (ids: string[]) => void } {
  const [s, setS] = useState<Stand>(stand);
  useEffect(() => {
    const hoer = (n: Stand) => setS(n);
    hoerer.add(hoer);
    setS(stand);
    void laden();
    return () => { hoerer.delete(hoer); };
  }, []);
  return { sicht: s.sicht, gelesen: gelesenMarkieren };
}

/** Die Glocke im Kopf. */
export function Glocke() {
  const aufgaben = useTasks();
  const [s, setS] = useState<Stand>(stand);
  const [auf, setAuf] = useState(false);
  const [puls, setPuls] = useState(false);
  const [ort, setOrt] = useState<{ top: number; right: number } | null>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const feld = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pulsZeit: ReturnType<typeof setTimeout> | undefined;
    const hoer = (n: Stand, neu: boolean) => {
      setS(n);
      if (neu && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setPuls(true);
        clearTimeout(pulsZeit);
        pulsZeit = setTimeout(() => setPuls(false), 3600);
      }
    };
    hoerer.add(hoer);
    setS(stand);
    void laden();
    const sichtbar = () => { if (document.visibilityState === 'visible') void laden(); };
    window.addEventListener('focus', sichtbar);
    document.addEventListener('visibilitychange', sichtbar);
    const takt = setInterval(sichtbar, TAKT_MS);
    return () => {
      hoerer.delete(hoer);
      clearTimeout(pulsZeit);
      clearInterval(takt);
      window.removeEventListener('focus', sichtbar);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, []);

  const platzieren = useCallback(() => {
    const r = knopf.current?.getBoundingClientRect();
    // Am Handy ist das Feld fast so breit wie der Bildschirm: rechts so weit einrücken, dass links nie etwas abgeschnitten wird.
    const breite = Math.min(400, window.innerWidth - 32);
    if (r) setOrt({ top: Math.round(r.bottom + 10), right: Math.max(16, Math.min(Math.round(window.innerWidth - r.right), window.innerWidth - breite - 16)) });
  }, []);

  useEffect(() => {
    if (!auf) return;
    platzieren();
    const weg = (e: MouseEvent) => {
      const z = e.target as Node | null;
      if (feld.current?.contains(z) || knopf.current?.contains(z)) return;
      setAuf(false);
    };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAuf(false); knopf.current?.focus(); } };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', taste);
    window.addEventListener('resize', platzieren);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); window.removeEventListener('resize', platzieren); };
  }, [auf, platzieren]);

  if (s.gesperrt) return null;
  const zahl = s.sicht?.ungelesen ?? 0;
  const lage = (id: string): AufgabeLage => {
    if (!aufgaben.ready) return null;
    const t = aufgaben.state.tasks.find(x => x.id === id);
    if (t) return t.status === 'done' ? 'erledigt' : null;
    const v = aufgaben.voll.tasks.find(x => x.id === id);
    if (!v) return 'weg';
    if (v.geloeschtAm) return 'papierkorb';
    return imArchiv(v) || aufgaben.voll.projects.some(p => p.id === v.projectId && imArchiv(p)) ? 'archiv' : null;
  };
  const rot = zahl > 0;

  return (
    <>
      <button ref={knopf} type="button" onClick={() => { setAuf(a => !a); if (!auf) void laden(); }}
        aria-haspopup="dialog" aria-expanded={auf}
        aria-label={rot ? `Meldungen — ${zahl} ungelesen` : 'Meldungen'} title={rot ? `${zahl} neue Meldung${zahl === 1 ? '' : 'en'}` : 'Meldungen'}
        className="kopf-knopf" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', flex: '0 0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div className={`kopf-rund${puls ? ' glocke-puls' : ''}`}
            style={{ position: 'relative', border: `2px solid ${rot ? C.kritisch : auf ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: rot ? C.kritisch : auf ? C.aktiv : C.inkDim, boxShadow: rot ? `0 0 12px ${C.kritisch}55` : 'none' }}>
            <Bell size={15} strokeWidth={1.9} />
            {rot && (
              <span aria-hidden style={{ position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'grid', placeItems: 'center', background: C.kritisch, color: '#fff', fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', boxShadow: `0 0 0 2px ${C.grund}` }}>
                {zahl > 99 ? '99+' : zahl}
              </span>
            )}
          </div>
          <span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: rot ? C.kritisch : auf ? C.aktiv : C.inkLeise }}>Meldungen</span>
        </div>
      </button>
      {auf && ort && typeof document !== 'undefined' && createPortal(
        <div ref={feld} role="dialog" aria-label="Meldungen"
          style={{ position: 'fixed', top: ort.top, right: ort.right, zIndex: 60, width: 'min(400px, calc(100vw - 32px))', maxHeight: 'min(70vh, 560px)', overflowY: 'auto', borderRadius: 14, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' }}>
          {s.sicht ? (
            <GlockeListe sicht={s.sicht} jetzt={Date.now()}
              lage={lage}
              oeffnen={m => { if (!m.gelesen) gelesenMarkieren([m.id]); setAuf(false); }}
              alleGelesen={() => gelesenMarkieren('alle')}
              telegram={an => { const x = stand.sicht; if (x) setzen({ sicht: { ...x, einstellungen: { telegram: an } }, gesperrt: false }); void senden({ aktion: 'einstellungen', telegram: an }); }} />
          ) : (
            <div style={{ padding: '22px 14px', fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center' }}>Lädt …</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
