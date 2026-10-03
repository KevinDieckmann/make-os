'use client';

// ─── MAKE OS — Der Kopf über jeder Seite (26.09. abends, Malins Bild) ───────
// Datei hieß bis 26.09. WachstumsKopf.tsx — der Score wohnt jetzt auf Home und unter Wachstum.
// Ganz links der Wachstums-Score als Zahl (Kevin 26.09. spät: „links rausnehmen,
// oben als Zahl“ — der Knopf in der Leiste ist weg), dann das Suchfeld, das im
// aktiven Space sucht (⌘K), dann Idee · Heute · Inbox · Kalender · Fokus-Zähler,
// die Glocke (Meldungen, 28.09. abends), rechts der Schalter mit dem Index des Modus (Klick wechselt Privat ↔ Business)
// und der Zeit von heute.
// Der Wachstums-Score stand seit 24.09. hier oben; seit heute steht er auf
// Heute als Widget und groß im Bereich Wachstum (Kevin: ruhiger, schneller —
// der Score rechnete bei jedem Seitenwechsel über viele Bestände).

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { zoneFarbe } from './schlank';
import { Sun, Inbox as InboxIcon, Search, CalendarDays, ArrowUpRight, Timer, Square, Tag } from 'lucide-react';
import { useSpace } from '@/hooks/useSpace';
import { spaceVon, type SpaceId } from '@/lib/make-one/spaces';
import { zeitText, teile } from '@/lib/zeitmessung/modell';
import { gemerkterFokus, fokusMerken, fokusAbgleichen, FOKUS_MERKER, FOKUS_EREIGNIS, type LaufenderFokus } from '@/lib/zeitmessung/fokus-laufend';
import { useTasks } from '@/context/TasksContext';
import { ZuordnungWahl, type Zuordnung } from './zeit/Zuordnung';
import { useMandate } from './zeit/useMandate';
import { fokusTitel } from '@/lib/zeitmessung/fokus-regeln';
import { WEG } from '@/lib/wege';
import { zeitSchluessel } from '@/lib/zeitmessung/bereich';
import { Glocke } from './Glocke';

// Inbox und Kalender folgen dem aktiven Space (zweite Fassung 26.09.: dafür stehen sie nicht mehr im Untermenü).
const SCHNELL = (space: SpaceId) => [
  { href: '/os/heute', label: 'Heute', Icon: Sun, passt: ['/os/heute'] },
  { href: `/os/inbox?space=${space}`, label: 'Inbox', Icon: InboxIcon, passt: ['/os/inbox'] },
  // K5 (29.09.): EIN Kalender — der Knopf öffnet /os/kalender (Woche); Planen ist dort ein Modus.
  { href: `/os/kalender?space=${space}`, label: 'Kalender', Icon: CalendarDays, passt: ['/os/kalender', '/os/planung/woche'] },
];

// Der Index je Space: einmal je fünf Minuten holen, nicht bei jedem Seitenwechsel.
const indexZwischen = new Map<SpaceId, { t: number; w: { index: number | null; label: string } }>();

// ── Der Wachstums-Score ganz links (Kevin 26.09. spät: „links rausnehmen und oben als Zahl“) ──
// Der Server merkt den Score fünf Minuten (/api/performance); hier noch einmal fünf Minuten
// im Fenster, damit ein Seitenwechsel ihn nicht neu holt. Klick öffnet den Bereich Wachstum.
let scoreZwischen: { t: number; w: { index: number | null; label: string } } | null = null;
function WachstumsZahl() {
  const [w, setW] = useState<{ index: number | null; label: string } | null>(scoreZwischen?.w ?? null);
  useEffect(() => {
    if (scoreZwischen && Date.now() - scoreZwischen.t < 5 * 60_000) { setW(scoreZwischen.w); return; }
    fetch('/api/performance', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      const a = (d as { aktuell?: { index?: number | null; label?: string } } | null)?.aktuell;
      if (!a) return;
      const wert = { index: a.index ?? null, label: a.label ?? '' };
      scoreZwischen = { t: Date.now(), w: wert }; setW(wert);
    }).catch(() => {});
  }, []);
  const farbe = w?.index != null ? zoneFarbe(w.index) : C.inkLeise;
  return (
    <Link href={WEG.wachstum()} title={w?.label ? `Wachstums-Score · ${w.label} — Bereich Wachstum öffnen` : 'Bereich Wachstum öffnen'} className="wachstum-kopf-score fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink, flex: '0 0 auto', minHeight: 44 }}>
      <span className="kopf-score-kreis" style={{ borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${farbe}`, boxShadow: w?.index != null ? `0 0 14px ${farbe}33` : 'none', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: farbe }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
      <span className="wachstum-kopf-label" style={{ display: 'grid', lineHeight: 1.15 }}>
        <span style={{ fontSize: TYP.mikro, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.08em' }}>Wachstum</span>
        <span style={{ fontSize: TYP.bedien, color: w?.label ? C.inkDim : C.inkLeise, fontWeight: 600 }}>{w ? (w.label || 'keine Messung') : '…'}</span>
      </span>
    </Link>
  );
}

/** Zeit heute je Modus — einmal je Minute holen; der Fokus-Zähler meldet Änderungen per Ereignis. */
export const ZEIT_EREIGNIS = 'make-zeit-geaendert';
let zeitZwischen: { t: number; heute: Record<string, number> } | null = null;
function useZeitHeute(): Record<string, number> | null {
  const [z, setZ] = useState<Record<string, number> | null>(zeitZwischen?.heute ?? null);
  useEffect(() => {
    let weg = false;
    const holen = (frisch = false) => {
      if (!frisch && zeitZwischen && Date.now() - zeitZwischen.t < 60_000) { setZ(zeitZwischen.heute); return; }
      fetch('/api/state/zeit', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
        const g = (d as { bild?: { tagHeute?: { gesamt?: Record<string, number> } } } | null)?.bild?.tagHeute?.gesamt;
        if (!g || weg) return;
        zeitZwischen = { t: Date.now(), heute: g }; setZ(g);
      }).catch(() => {});
    };
    holen();
    const auf = () => holen(true);
    window.addEventListener(ZEIT_EREIGNIS, auf);
    const t = setInterval(() => holen(true), 5 * 60_000);
    return () => { weg = true; window.removeEventListener(ZEIT_EREIGNIS, auf); clearInterval(t); };
  }, []);
  return z;
}

/**
 * Der Schalter oben rechts (Kevin 26.09. spät): zeigt den Index des aktiven Modus und die
 * Zeit von heute darin; ein Klick WECHSELT den Modus (Privat ↔ Business), Index und Seiten
 * folgen. Der kleine Pfeil öffnet die Index-Seite.
 */
function SpaceSchalter({ space, ausAdresse, setzen }: { space: SpaceId; ausAdresse: SpaceId | null; setzen: (s: SpaceId) => void }) {
  const router = useRouter();
  const s = spaceVon(space);
  const anderer: SpaceId = space === 'privat' ? 'business' : 'privat';
  const [w, setW] = useState<{ index: number | null; label: string } | null>(indexZwischen.get(space)?.w ?? null);
  const zeit = useZeitHeute();
  useEffect(() => {
    const z = indexZwischen.get(space);
    if (z && Date.now() - z.t < 5 * 60_000) { setW(z.w); return; }
    const url = space === 'business' ? '/api/business?scope=gesamt&kompakt=1' : '/api/privat?kompakt=1';
    fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      const bi = space === 'business' ? d.bi : d;
      if (bi && typeof bi === 'object') { const wert = { index: bi.index ?? null, label: bi.label ?? '' }; indexZwischen.set(space, { t: Date.now(), w: wert }); setW(wert); }
    }).catch(() => {});
  }, [space]);
  const farbe = w?.index != null ? zoneFarbe(w.index) : C.inkLeise;
  const wechseln = () => {
    setzen(anderer);
    // Auf einer Seite, die zu einem Space gehört, geht es zur Übersicht des anderen; gemeinsame Seiten (Home, Heute …) bleiben.
    if (ausAdresse) router.push(spaceVon(anderer).start);
  };
  return (
    <span className="wachstum-kopf-space" style={{ display: 'inline-flex', alignItems: 'stretch', minHeight: 40, borderRadius: 999, border: `1px solid ${s.farbe}44`, background: `${s.farbe}12`, color: C.ink, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
      <button onClick={wechseln} title={`Zu ${spaceVon(anderer).label} wechseln`} className="fassbar kopf-pille-knopf" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 6px 7px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: '999px 0 0 999px' }}>
        <span className="wachstum-kopf-label" style={{ fontSize: TYP.bedien, color: s.farbe, fontWeight: 700 }}>{s.index.label}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
        {w?.label && <span className="wachstum-kopf-label" style={{ fontSize: TYP.bedien, color: C.inkDim }}>· {w.label}</span>}
        {zeit && <span className="wachstum-kopf-label" title={`Heute im ${s.label}-Modus`} style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>· {zeitText(zeit[space] ?? 0)}</span>}
      </button>
      <Link href={s.index.ziel} title={`${s.index.label} öffnen`} aria-label={`${s.index.label} öffnen`} className="kopf-pille-pfeil" style={{ display: 'grid', placeItems: 'center', minWidth: 44, color: C.inkLeise, textDecoration: 'none' }}><ArrowUpRight size={14} strokeWidth={2} /></Link>
    </span>
  );
}

// ── Fokus-Zähler (Kevin 26.09. spät: „mit Fokus auch wieder messen“) ────────
// Startet bewusste Zeit für den Bereich, auf dem man gerade ist. Läuft über Seitenwechsel
// hinweg (localStorage, lib/zeitmessung/fokus-laufend.ts) und wird beim Stopp als Block verbucht
// (/api/state/zeit). Seit 27.09. spät: im Business lässt sich der laufende Block gleich einer
// Aufgabe oder Einheit zuordnen (Chip neben dem Zähler); das Aufgaben-Detail kann ihn starten.
// Seit 28.09. auch einem Mandat (Kevin: „Mandat an Zielen und Zeit“ — Zeit je Mandat).
const uhr = (sek: number) => {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
/**
 * Zuordnen im Kopf (27.09. spät): ein kleiner Knopf neben dem laufenden Zähler öffnet ein Feld mit Aufgabe und Einheit —
 * zwei Chips direkt im Kopf hätten ihn überlaufen lassen. Punkt am Knopf = zugeordnet.
 */
const MENUES = '[data-wahl-menue],.wahl-hinter,[role="listbox"],[role="menu"]';
function FokusZuordnenKnopf({ wert, setzen }: { wert: Zuordnung; setzen: (z: Zuordnung) => void }) {
  const [auf, setAuf] = useState(false);
  const feldRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!auf) return;
    // Die Menüs der Chips hängen als Portal am Seitenende — ein Klick dort schließt das Feld nicht.
    const weg = (e: MouseEvent) => {
      const z = e.target as HTMLElement | null;
      if (feldRef.current?.contains(z) || z?.closest?.(MENUES)) return;
      setAuf(false);
    };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector(MENUES)) setAuf(false); };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  const gesetzt = !!(wert.aufgabeId || wert.einheit || wert.mandatId);
  return (
    <span ref={feldRef} className="wachstum-kopf-label" style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-expanded={auf} aria-label="Fokus einer Aufgabe, einem Mandat oder einer Einheit zuordnen" title={gesetzt ? 'Zuordnung ändern' : 'Einer Aufgabe, einem Mandat oder einer Einheit zuordnen'} className="fassbar kopf-rund" style={{ ...rund(gesetzt), position: 'relative', cursor: 'pointer', background: 'none', padding: 0 }}>
        <Tag size={14} strokeWidth={1.9} />
      </button>
      {auf && (
        <span role="group" aria-label="Fokus zuordnen" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 40, display: 'grid', gap: 8, padding: '12px 14px', minWidth: 280, maxWidth: 380, borderRadius: 14, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Fokus zuordnen</span>
          <ZuordnungWahl klein wert={wert} setzen={setzen} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Zählt auf das Mandat und seine Einheit — sonst auf die Einheit der Aufgabe oder die gewählte.</span>
        </span>
      )}
    </span>
  );
}

function FokusZaehler({ pfad, space }: { pfad: string; space: SpaceId }) {
  const [laufend, setLaufend] = useState<LaufenderFokus | null>(null);
  const [jetzt, setJetzt] = useState(0);
  const { state } = useTasks();
  // Mandat im Kopf nennen (29.09.) — die Mandate nur laden, wenn eins zugeordnet ist (der Kopf steht auf jeder Seite).
  const { karte: mandate } = useMandate(!!laufend?.mandatId);
  useEffect(() => {
    const lesen = () => { setLaufend(gemerkterFokus()); setJetzt(Date.now()); };
    lesen();
    // Der Server hält den laufenden Fokus je Person (29.09.) — beim Öffnen und bei Fokus abgleichen (anderes Gerät, Tab-Verlust).
    void fokusAbgleichen();
    const fokus = () => { void fokusAbgleichen(); };
    const fremd = (e: StorageEvent) => { if (e.key === FOKUS_MERKER) lesen(); };
    window.addEventListener(FOKUS_EREIGNIS, lesen);
    window.addEventListener('storage', fremd);
    window.addEventListener('focus', fokus);
    return () => { window.removeEventListener(FOKUS_EREIGNIS, lesen); window.removeEventListener('storage', fremd); window.removeEventListener('focus', fokus); };
  }, []);
  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [laufend]);
  const starten = () => {
    const { schluessel, bereich } = zeitSchluessel(pfad, window.location.search, space);
    fokusMerken({ von: new Date().toISOString(), schluessel, label: bereich.label });
  };
  const zuordnen = (z: Zuordnung) => {
    if (!laufend) return;
    const { aufgabeId: _a, einheit: _e, mandatId: _m, ...rest } = laufend;
    fokusMerken({ ...rest, ...(z.aufgabeId ? { aufgabeId: z.aufgabeId } : {}), ...(z.einheit ? { einheit: z.einheit } : {}), ...(z.mandatId ? { mandatId: z.mandatId } : {}) });
  };
  const stoppen = async () => {
    if (!laufend) return;
    const l = laufend;
    // Erst der fertige Block, dann den laufenden löschen (29.09.) — scheitert das Speichern, läuft der Zähler weiter,
    // statt dass die Fokus-Zeit still verloren geht.
    let status = 0, grund = '';
    try {
      const r = await fetch('/api/state/zeit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'fokus', von: l.von, bis: new Date().toISOString(), schluessel: l.schluessel, label: l.label, aufgabeId: l.aufgabeId, einheit: l.einheit, mandatId: l.mandatId, terminUid: l.terminUid }) });
      status = r.status;
      if (!r.ok) grund = String(((await r.json().catch(() => ({}))) as { error?: string }).error ?? '');
    } catch { status = 0; }
    if (status < 200 || status >= 300) {
      // Inhaltlich abgelehnt (400): fragen statt endlos weiterzählen; sonst (Netz, 5xx, Sitzung) weiterlaufen lassen.
      if (status === 400 && window.confirm(`Fokus-Block abgelehnt${grund ? `: ${grund}` : ''}.\n\nZähler trotzdem beenden (diese Zeit wird nicht gezählt)?`)) fokusMerken(null);
      else if (status !== 400) window.alert('Fokus-Zeit nicht gespeichert (keine Verbindung oder Server nicht erreichbar). Der Zähler läuft weiter — bitte gleich noch einmal beenden.');
      return;
    }
    fokusMerken(null);
    window.dispatchEvent(new Event(ZEIT_EREIGNIS));
  };
  if (laufend) {
    const sek = Math.max(0, Math.round((jetzt - Date.parse(laufend.von)) / 1000));
    const aufgabe = laufend.aufgabeId ? state.tasks.find(t => t.id === laufend.aufgabeId)?.title : undefined;
    const titel = fokusTitel(laufend, aufgabe, laufend.mandatId ? mandate.get(laufend.mandatId) : null);
    const text = titel.length > 22 ? `${titel.slice(0, 21)}…` : titel;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto', minWidth: 0 }}>
        <button onClick={stoppen} title={`Fokus „${titel}“ beenden`} className="fassbar fokus-laeuft" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', minHeight: 40, borderRadius: 999, border: `1px solid ${C.aktiv}66`, background: `${C.aktiv}14`, color: C.ink, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 8px ${C.aktiv}` }} />
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{uhr(sek)}</span>
          <span className="wachstum-kopf-label" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{text}</span>
          <Square size={10} fill="currentColor" strokeWidth={0} style={{ color: C.inkLeise }} />
        </button>
        {teile(laufend.schluessel).space === 'business' && (
          <FokusZuordnenKnopf wert={{ aufgabeId: laufend.aufgabeId, einheit: laufend.einheit, mandatId: laufend.mandatId }} setzen={zuordnen} />
        )}
      </span>
    );
  }
  return (
    <button onClick={starten} title="Fokus starten — bewusste Zeit für diesen Bereich" aria-label="Fokus starten" className="kopf-knopf" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div className="kopf-rund" style={rund(false)}><Timer size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: C.inkLeise }}>Fokus</span></div>
    </button>
  );
}

/** Runder Kopf-Knopf: Größe über `.kopf-rund` (globals.css: 40 px am Rechner, 44 px am Handy), hier nur Farbe/Rand nach Zustand. */
const rund = (an: boolean) => ({ border: `2px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: an ? C.aktiv : C.inkDim } as const);

/** Handy-Breite (≤ 720 px), live — der Index-Schalter wandert dort aus der engen Kopfzeile in eine eigene Zeile darunter. */
function useHandy(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 720px)');
    const lesen = () => setH(m.matches);
    lesen();
    m.addEventListener('change', lesen);
    return () => m.removeEventListener('change', lesen);
  }, []);
  return h;
}

export function Kopf() {
  const pfad = usePathname() ?? '';
  const { space, ausAdresse, setzen } = useSpace();
  const sp = spaceVon(space);
  const handy = useHandy();
  const suchen = () => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }));
  return (
    <>
    <div className="wachstum-kopf os-auf">
      <div className="wachstum-kopf-innen">
        {/* Ganz links der Wachstums-Score als Zahl (Kevin 26.09. spät), dann das Suchfeld ausgeglichen in der Mitte */}
        <WachstumsZahl />
        {/* Suchfeld im aktiven Space — auf dem Handy nur die Lupe. Es gibt zuerst nach (flex-shrink 1000), damit ein laufender
            Fokus-Zähler rechts den Kopf nicht überlaufen lässt (27.09. spät). */}
        <button onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" className="wachstum-kopf-suche fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1000 520px', minWidth: 0, maxWidth: 960, margin: '0 auto', padding: '9px 14px', minHeight: 44, borderRadius: 12, cursor: 'text', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left' }}>
          <Search size={15} strokeWidth={1.9} style={{ flex: '0 0 auto' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sp.suche}</span>
          <span className="nur-tastatur" style={{ fontSize: TYP.mikro, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '1px 6px', color: C.inkLeise }}>⌘K</span>
        </button>
        <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
          <button className="wachstum-kopf-lupe kopf-knopf" onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div className="kopf-rund" style={rund(false)}><Search size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: C.inkLeise }}>Suche</span></div>
          </button>
          {SCHNELL(space).map(({ href, label, Icon, passt }) => {
            const an = passt.some(p => pfad === p || pfad.startsWith(`${p}/`) || (p !== '/os/heute' && pfad.startsWith(p)));
            return (
              <Link key={href} href={href} title={label} aria-label={label} className="kopf-knopf" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div className="kopf-rund" style={rund(an)}><Icon size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: an ? C.aktiv : C.inkLeise }}>{label}</span></div>
              </Link>
            );
          })}
          {/* Glocke (28.09. abends): Zuweisungen, Kommentare/Erwähnungen, fällig/überfällig — rot bei Ungelesenem */}
          <Glocke />
          <FokusZaehler pfad={pfad} space={space} />
          {!handy && <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.06)', margin: '0 2px' }} />}
          {!handy && <SpaceSchalter space={space} ausAdresse={ausAdresse} setzen={setzen} />}
        </div>
      </div>
    </div>
    {/* Handy (03.10.): der Index-Schalter steht in einer eigenen, mitlaufenden Zeile — in der Kopfzeile ist neben sieben 44-px-Zielen kein Platz. */}
    {handy && <div className="kopf-index-zeile"><SpaceSchalter space={space} ausAdresse={ausAdresse} setzen={setzen} /></div>}
    </>
  );
}
