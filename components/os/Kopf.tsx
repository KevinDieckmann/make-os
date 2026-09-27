'use client';

// ─── MAKE OS — Der Kopf über jeder Seite (26.09. abends, Malins Bild) ───────
// Datei hieß bis 26.09. WachstumsKopf.tsx — der Score wohnt jetzt auf Home und unter Wachstum.
// Ganz links der Wachstums-Score als Zahl (Kevin 26.09. spät: „links rausnehmen,
// oben als Zahl“ — der Knopf in der Leiste ist weg), dann das Suchfeld, das im
// aktiven Space sucht (⌘K), dann Idee · Heute · Inbox · Kalender · Fokus-Zähler,
// rechts der Schalter mit dem Index des Modus (Klick wechselt Privat ↔ Business)
// und der Zeit von heute.
// Der Wachstums-Score stand seit 24.09. hier oben; seit heute steht er auf
// Heute als Widget und groß im Bereich Wachstum (Kevin: ruhiger, schneller —
// der Score rechnete bei jedem Seitenwechsel über viele Bestände).

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { zoneFarbe } from './schlank';
import { Sun, Inbox as InboxIcon, Search, CalendarDays, ArrowUpRight, Timer, Square } from 'lucide-react';
import { useSpace } from '@/hooks/useSpace';
import { spaceVon, type SpaceId } from '@/lib/make-one/spaces';
import { zeitText } from '@/lib/zeitmessung/modell';
import { WEG } from '@/lib/wege';
import { zeitSchluessel } from '@/lib/zeitmessung/bereich';

// Inbox und Kalender folgen dem aktiven Space (zweite Fassung 26.09.: dafür stehen sie nicht mehr im Untermenü).
const SCHNELL = (space: SpaceId) => [
  { href: '/os/heute', label: 'Heute', Icon: Sun, passt: ['/os/heute'] },
  { href: `/os/inbox?space=${space}`, label: 'Inbox', Icon: InboxIcon, passt: ['/os/inbox'] },
  { href: `/os/planung/woche?space=${space}`, label: 'Kalender', Icon: CalendarDays, passt: ['/os/planung/woche', '/os/kalender'] },
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
    <Link href={WEG.wachstum()} title={w?.label ? `Wachstums-Score · ${w.label} — Bereich Wachstum öffnen` : 'Bereich Wachstum öffnen'} className="wachstum-kopf-score fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink, flex: '0 0 auto' }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${farbe}`, boxShadow: w?.index != null ? `0 0 14px ${farbe}33` : 'none', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: farbe }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
      <span className="wachstum-kopf-label" style={{ display: 'grid', lineHeight: 1.15 }}>
        <span style={{ fontSize: 11, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.05em' }}>Wachstum</span>
        <span style={{ fontSize: 12, color: w?.label ? C.inkDim : C.inkLeise, fontWeight: 600 }}>{w ? (w.label || 'keine Messung') : '…'}</span>
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
    <span className="wachstum-kopf-space" style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: 999, border: `1px solid ${s.farbe}44`, background: `${s.farbe}12`, color: C.ink, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
      <button onClick={wechseln} title={`Zu ${spaceVon(anderer).label} wechseln`} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 6px 7px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: '999px 0 0 999px' }}>
        <span className="wachstum-kopf-label" style={{ fontSize: 12, color: s.farbe, fontWeight: 700 }}>{s.index.label}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{w?.index != null ? Math.round(w.index) : '—'}</span>
        {w?.label && <span className="wachstum-kopf-label" style={{ fontSize: 12, color: C.inkDim }}>· {w.label}</span>}
        {zeit && <span className="wachstum-kopf-label" title={`Heute im ${s.label}-Modus`} style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>· {zeitText(zeit[space] ?? 0)}</span>}
      </button>
      <Link href={s.index.ziel} title={`${s.index.label} öffnen`} aria-label={`${s.index.label} öffnen`} style={{ display: 'grid', placeItems: 'center', padding: '0 10px 0 2px', color: C.inkLeise, textDecoration: 'none' }}><ArrowUpRight size={14} strokeWidth={2} /></Link>
    </span>
  );
}

// ── Fokus-Zähler (Kevin 26.09. spät: „mit Fokus auch wieder messen“) ────────
// Startet bewusste Zeit für den Bereich, auf dem man gerade ist. Läuft über Seitenwechsel
// hinweg (localStorage) und wird beim Stopp als Block verbucht (/api/state/zeit).
const FOKUS_MERKER = 'make-fokus';
interface Laufend { von: string; schluessel: string; label: string }
function gemerkterFokus(): Laufend | null {
  try { const v = localStorage.getItem(FOKUS_MERKER); return v ? (JSON.parse(v) as Laufend) : null; } catch { return null; }
}
const uhr = (sek: number) => {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
function FokusZaehler({ pfad, space }: { pfad: string; space: SpaceId }) {
  const [laufend, setLaufend] = useState<Laufend | null>(null);
  const [jetzt, setJetzt] = useState(0);
  useEffect(() => { setLaufend(gemerkterFokus()); setJetzt(Date.now()); }, []);
  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [laufend]);
  const starten = () => {
    const { schluessel, bereich } = zeitSchluessel(pfad, window.location.search, space);
    const l: Laufend = { von: new Date().toISOString(), schluessel, label: bereich.label };
    try { localStorage.setItem(FOKUS_MERKER, JSON.stringify(l)); } catch { /* egal */ }
    setLaufend(l); setJetzt(Date.now());
  };
  const stoppen = async () => {
    if (!laufend) return;
    const l = laufend;
    setLaufend(null);
    try { localStorage.removeItem(FOKUS_MERKER); } catch { /* egal */ }
    try {
      await fetch('/api/state/zeit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'fokus', von: l.von, bis: new Date().toISOString(), schluessel: l.schluessel, label: l.label }) });
    } catch { /* der Block ist dann weg — besser als ein hängender Zähler */ }
    window.dispatchEvent(new Event(ZEIT_EREIGNIS));
  };
  if (laufend) {
    const sek = Math.max(0, Math.round((jetzt - Date.parse(laufend.von)) / 1000));
    return (
      <button onClick={stoppen} title={`Fokus „${laufend.label}“ beenden`} className="fassbar fokus-laeuft" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, border: `1px solid ${C.aktiv}66`, background: `${C.aktiv}14`, color: C.ink, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 8px ${C.aktiv}` }} />
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{uhr(sek)}</span>
        <span className="wachstum-kopf-label" style={{ fontSize: 12, color: C.inkDim }}>{laufend.label}</span>
        <Square size={10} fill="currentColor" strokeWidth={0} style={{ color: C.inkLeise }} />
      </button>
    );
  }
  return (
    <button onClick={starten} title="Fokus starten — bewusste Zeit für diesen Bereich" aria-label="Fokus starten" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(false)}><Timer size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Fokus</span></div>
    </button>
  );
}

const rund = (an: boolean) => ({ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: an ? C.aktiv : C.inkDim } as const);

export function Kopf() {
  const pfad = usePathname() ?? '';
  const { space, ausAdresse, setzen } = useSpace();
  const sp = spaceVon(space);
  const suchen = () => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }));
  return (
    <div className="wachstum-kopf os-auf">
      <div className="wachstum-kopf-innen">
        {/* Ganz links der Wachstums-Score als Zahl (Kevin 26.09. spät), dann das Suchfeld ausgeglichen in der Mitte */}
        <WachstumsZahl />
        {/* Suchfeld im aktiven Space — auf dem Handy nur die Lupe */}
        <button onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" className="wachstum-kopf-suche fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 520px', minWidth: 0, maxWidth: 960, margin: '0 auto', padding: '9px 14px', borderRadius: 12, cursor: 'text', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left' }}>
          <Search size={15} strokeWidth={1.9} style={{ flex: '0 0 auto' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sp.suche}</span>
          <span className="nur-tastatur" style={{ fontSize: 11, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '1px 6px', color: C.inkLeise }}>⌘K</span>
        </button>
        <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
          <button className="wachstum-kopf-lupe" onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(false)}><Search size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: C.inkLeise }}>Suche</span></div>
          </button>
          {SCHNELL(space).map(({ href, label, Icon, passt }) => {
            const an = passt.some(p => pfad === p || pfad.startsWith(`${p}/`) || (p !== '/os/heute' && pfad.startsWith(p)));
            return (
              <Link key={href} href={href} title={label} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div style={rund(an)}><Icon size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: 11, color: an ? C.aktiv : C.inkLeise }}>{label}</span></div>
              </Link>
            );
          })}
          <FokusZaehler pfad={pfad} space={space} />
          <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.06)', margin: '0 2px' }} />
          <SpaceSchalter space={space} ausAdresse={ausAdresse} setzen={setzen} />
        </div>
      </div>
    </div>
  );
}
