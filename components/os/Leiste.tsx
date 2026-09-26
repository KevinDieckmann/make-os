'use client';

// ─── MAKE OS — Die Leiste: zwei Spaces (26.09., Malins Bild, zweite Fassung) ──
// Oben MAKE OS, darunter der Home-Knopf (Kevin 26.09.: „ein Home-Knopf, wo man
// sich sein eigenes Dashboard zusammenklickt — erstmal der Überblick über
// Business und Privat zusammen“). Dann Privat und Business als Kästen in ihrer
// Farbe; ein Tipp klappt die sechs Punkte SOFORT auf (kein Wegspringen — Kevin:
// „muss immer sauber aufgehen“), der andere Kasten klappt zu.
// Unten gesondert Jarvis und Brain, darunter System und das Konto. Inbox und
// Kalender stehen im Kopf oben und folgen dem Space.
// Handy: Leiste unten mit Heute · Privat · Business · Jarvis · System —
// Privat/Business öffnen ihre Punkte als Blatt.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown, Settings, LayoutDashboard } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACES, UNTEN, aktiverSpaceEintrag, type SpaceId, type SpaceEintrag } from '@/lib/make-one/spaces';
import { useSpace } from '@/hooks/useSpace';

const SYSTEM: SpaceEintrag = { href: '/os/system', label: 'System', icon: Settings, passt: ['/os/system', '/os/verbindungen', '/os/konto', '/os/datenbasis', '/os/stammdaten', '/os/bauplan', '/os/roadmap', '/os/onboarding', '/os/wachstum'] };

export function Leiste() {
  const pfad = usePathname() ?? '/os';
  const { space, suche, setzen } = useSpace();
  const aktiv = aktiverSpaceEintrag(pfad, suche);
  const systemAktiv = SYSTEM.passt.some(p => pfad === p || pfad.startsWith(`${p}/`));
  const [konto, setKonto] = useState<{ name: string } | null>(null);
  const [offen, setOffen] = useState<SpaceId | null>(null); // Handy-Blatt
  // Welcher Kasten aufgeklappt ist — folgt dem Space, reagiert aber sofort auf den Tipp.
  const [auf, setAuf] = useState<SpaceId>(space);
  useEffect(() => { setAuf(space); }, [space]);
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  useEffect(() => { setOffen(null); }, [pfad, suche]);
  const vorname = konto?.name.split(' ')[0] ?? '';

  /** Ein Punkt im Untermenü: Punkt-Marke links, Text; aktiv in der Space-Farbe. */
  const punkt = (e: SpaceEintrag, farbe: string, an: boolean) => (
    <Link key={e.href} href={e.href} className="fassbar" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px 7px 14px', borderRadius: 9, textDecoration: 'none',
      color: an ? farbe : C.inkDim, background: an ? `${farbe}14` : 'transparent', transition: 'background .2s ease, color .2s ease',
      fontFamily: SCHRIFT.text, fontSize: 13.5, fontWeight: an ? 600 : 500,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: an ? farbe : 'rgba(255,255,255,.16)', flex: '0 0 auto' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
    </Link>
  );
  /** Ein Eintrag unten: Symbol + Text. */
  const zeile = (e: SpaceEintrag, an: boolean) => {
    const Icon = e.icon;
    return (
      <Link key={e.href} href={e.href} className="fassbar" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, textDecoration: 'none',
        color: an ? C.aktiv : C.inkDim, background: an ? C.aktivSanft : 'transparent', transition: 'background .2s ease, color .2s ease',
        fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 500,
      }}>
        <Icon size={16} strokeWidth={1.75} />
        <span>{e.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav className="leiste-desktop" aria-label="Hauptnavigation" style={{
        width: 220, flex: '0 0 220px', padding: '22px 14px', borderRight: `1px solid ${C.linie}`, background: C.grund,
        flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <Link href="/os" title="Home" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', padding: '4px 10px 16px', color: C.ink, textDecoration: 'none' }}>
          <span className="zeit-puls" style={{ width: 9, height: 9, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 10px ${C.aktiv}33` }} />MAKE OS
        </Link>
        {/* Home: das eigene Dashboard — Überblick über Privat und Business zusammen, frei gestaltbar */}
        <Link href="/os" className="fassbar" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, textDecoration: 'none', marginBottom: 6,
          border: `1px solid ${pfad === '/os' ? `${C.aktiv}66` : 'rgba(255,255,255,.08)'}`, background: pfad === '/os' ? C.aktivSanft : 'rgba(255,255,255,.025)', color: pfad === '/os' ? C.aktiv : C.ink,
          fontFamily: SCHRIFT.text, fontSize: 14.5, fontWeight: 700, transition: 'background .2s ease, color .2s ease, border-color .2s ease',
        }}>
          <LayoutDashboard size={17} strokeWidth={1.9} /><span style={{ flex: 1 }}>Home</span>
        </Link>

        {SPACES.map(s => {
          const an = auf === s.id;
          const Icon = s.icon;
          const kasten: CSSProperties = {
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            border: `1px solid ${an ? `${s.farbe}66` : 'rgba(255,255,255,.08)'}`, background: an ? `${s.farbe}1C` : 'rgba(255,255,255,.025)', color: an ? s.farbe : C.ink,
            fontFamily: SCHRIFT.text, fontSize: 14.5, fontWeight: 700, transition: 'background .2s ease, color .2s ease, border-color .2s ease',
          };
          return (
            <div key={s.id} style={{ marginBottom: 6 }}>
              <button type="button" onClick={() => { setAuf(s.id); setzen(s.id); }} className="fassbar" aria-expanded={an} style={kasten}>
                <Icon size={17} strokeWidth={1.9} />
                <span style={{ flex: 1 }}>{s.label}</span>
                <ChevronDown size={15} strokeWidth={2} style={{ transform: an ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s ease', opacity: .75 }} />
              </button>
              {an && (
                <div style={{ display: 'grid', gap: 1, padding: '6px 0 4px 6px' }}>
                  {s.eintraege.map(e => punkt(e, s.farbe, aktiv.space === s.id && aktiv.eintrag?.href === e.href))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', display: 'grid', gap: 1 }}>
          <div style={{ borderTop: `1px solid ${C.linie}`, margin: '10px 0 8px' }} />
          {UNTEN.map(e => zeile(e, aktiv.space === null && aktiv.eintrag?.href === e.href))}
          <div style={{ borderTop: `1px solid ${C.linie}`, margin: '8px 0' }} />
          {zeile(SYSTEM, systemAktiv)}
          <Link href="/os/konto" title="Mein Konto" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px 4px', color: C.inkDim, textDecoration: 'none', fontSize: TYP.bedien }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: C.flaeche, color: C.aktiv, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 11, fontWeight: 700 }}>{(vorname || '?').charAt(0).toUpperCase()}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || '…'}</span>
          </Link>
        </div>
      </nav>

      {/* Handy: Blatt mit den Punkten des angetippten Space */}
      {offen && (
        <div className="leiste-mobil-blatt" onClick={() => setOffen(null)} style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,.45)' }}>
          {SPACES.filter(s => s.id === offen).map(s => (
            <div key={s.id} onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 'calc(64px + env(safe-area-inset-bottom))', background: C.flaecheHoch, border: `1px solid ${s.farbe}55`, borderRadius: 16, padding: 10, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8)' }}>
              <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: s.farbe, padding: '4px 10px 8px', fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {s.eintraege.map(e => { const Icon = e.icon; const an = aktiv.space === s.id && aktiv.eintrag?.href === e.href; return (
                  <Link key={e.href} href={e.href} onClick={() => { setzen(s.id); setOffen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px', borderRadius: 10, textDecoration: 'none', color: an ? s.farbe : C.ink, background: an ? `${s.farbe}14` : 'transparent', fontSize: 14, fontWeight: 500 }}><Icon size={16} strokeWidth={1.75} />{e.label}</Link>
                ); })}
              </div>
            </div>
          ))}
        </div>
      )}
      <nav className="leiste-mobil" aria-label="Hauptnavigation" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, borderTop: `1px solid ${C.linie}`, background: C.grund,
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', justifyContent: 'space-around',
      }}>
        {([{ art: 'link' as const, href: '/os', label: 'Home', icon: LayoutDashboard, farbe: C.aktiv, an: pfad === '/os' },
          ...SPACES.map(s => ({ art: 'space' as const, href: s.start, label: s.label, icon: s.icon, farbe: s.farbe, an: space === s.id && pfad !== '/os', id: s.id })),
          { art: 'link' as const, href: '/jarvis', label: 'Jarvis', icon: UNTEN[0].icon, farbe: C.aktiv, an: pfad.startsWith('/jarvis') },
          { art: 'link' as const, href: '/os/system', label: 'System', icon: Settings, farbe: C.aktiv, an: systemAktiv }]).map(e => {
          const Icon = e.icon;
          const innen = <><Icon size={20} strokeWidth={1.75} /><span>{e.label}</span></>;
          const stil = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, flex: 1, padding: '6px 0', border: 'none', background: 'none', textDecoration: 'none', color: e.an ? e.farbe : C.inkDim, fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 500, cursor: 'pointer' };
          return e.art === 'space'
            ? <button key={e.label} type="button" onClick={() => setOffen(o => (o === e.id ? null : e.id))} className="fassbar" style={stil}>{innen}</button>
            : <Link key={e.href} href={e.href} className="fassbar" style={stil}>{innen}</Link>;
        })}
      </nav>
    </>
  );
}
