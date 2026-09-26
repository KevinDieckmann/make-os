'use client';

// ─── MAKE OS — Die Leiste: zwei Spaces (26.09., Malins Vorschlag) ──────────
// Links Privat und Business, jeweils in eigener Farbe; ein Tipp klappt das
// Untermenü auf. Unten gesondert Jarvis und Brain, darunter System und das
// Konto. Auf dem Handy: Leiste unten mit Heute · Privat · Business · Jarvis ·
// System — Privat/Business öffnen ihr Untermenü als kleines Blatt.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Settings, Sun } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACES, UNTEN, aktiverSpaceEintrag, type SpaceId, type SpaceEintrag } from '@/lib/make-one/spaces';
import { useSpace } from '@/hooks/useSpace';

const SYSTEM: SpaceEintrag = { href: '/os/system', label: 'System', icon: Settings, passt: ['/os/system', '/os/verbindungen', '/os/konto', '/os/datenbasis', '/os/stammdaten', '/os/bauplan', '/os/roadmap', '/os/onboarding'] };

export function Leiste() {
  const pfad = usePathname() ?? '/os';
  const router = useRouter();
  const { space, suche, setzen } = useSpace();
  const aktiv = aktiverSpaceEintrag(pfad, suche);
  const systemAktiv = SYSTEM.passt.some(p => pfad === p || pfad.startsWith(`${p}/`));
  const [konto, setKonto] = useState<{ name: string } | null>(null);
  const [offen, setOffen] = useState<SpaceId | null>(null); // Handy-Blatt
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  useEffect(() => { setOffen(null); }, [pfad, suche]);
  const vorname = konto?.name.split(' ')[0] ?? '';
  const voll = pfad + suche;

  const zeile = (e: SpaceEintrag, farbe: string, an: boolean, eingerueckt = false) => {
    const Icon = e.icon;
    return (
      <Link key={e.href} href={e.href} className="fassbar" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: eingerueckt ? '7px 10px 7px 22px' : '9px 10px', borderRadius: 9, textDecoration: 'none',
        color: an ? farbe : C.inkDim, background: an ? `${farbe}14` : 'transparent', transition: 'background .2s ease, color .2s ease',
        fontFamily: SCHRIFT.text, fontSize: eingerueckt ? 13.5 : 14, fontWeight: an ? 600 : 500,
      }}>
        {eingerueckt ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: an ? farbe : 'rgba(255,255,255,.14)', flex: '0 0 auto' }} /> : <Icon size={16} strokeWidth={1.75} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav className="leiste-desktop" aria-label="Hauptnavigation" style={{
        width: 212, flex: '0 0 212px', padding: '22px 12px', borderRight: `1px solid ${C.linie}`, background: C.grund,
        flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <Link href="/os" title="Heute" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', padding: '4px 10px 18px', color: C.ink, textDecoration: 'none' }}>
          <span className="zeit-puls" style={{ width: 9, height: 9, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 10px ${C.aktiv}33` }} />MAKE OS
        </Link>
        <Link href="/os" className="fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, textDecoration: 'none', color: pfad === '/os' ? C.aktiv : C.inkDim, background: pfad === '/os' ? C.aktivSanft : 'transparent', fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
          <Sun size={16} strokeWidth={1.75} /><span>Heute</span>
        </Link>

        {SPACES.map(s => {
          const an = space === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} style={{ marginBottom: 4 }}>
              <button type="button" onClick={() => { setzen(s.id); if (!an) router.push(s.start); }} className="fassbar" aria-expanded={an} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                border: `1px solid ${an ? `${s.farbe}55` : 'rgba(255,255,255,.07)'}`, background: an ? `${s.farbe}1A` : 'rgba(255,255,255,.02)', color: an ? s.farbe : C.ink,
                fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 700, transition: 'background .2s ease, color .2s ease, border-color .2s ease',
              }}>
                <Icon size={16} strokeWidth={1.9} />
                <span style={{ flex: 1 }}>{s.label}</span>
                <ChevronDown size={14} strokeWidth={2} style={{ transform: an ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s ease', opacity: .7 }} />
              </button>
              {an && (
                <div style={{ display: 'grid', gap: 1, padding: '4px 0 2px' }}>
                  {s.eintraege.map(e => zeile(e, s.farbe, aktiv.eintrag?.href === e.href && aktiv.space === s.id, true))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${C.linie}` }}>
          {UNTEN.map(e => zeile(e, C.aktiv, aktiv.eintrag?.href === e.href && aktiv.space === null))}
          {zeile(SYSTEM, C.aktiv, systemAktiv)}
          <Link href="/os/konto" title="Mein Konto" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px 4px', color: C.inkDim, textDecoration: 'none', fontSize: TYP.bedien }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: C.flaeche, color: C.aktiv, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 11, fontWeight: 700 }}>{(vorname || '?').charAt(0).toUpperCase()}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || '…'}</span>
          </Link>
        </div>
      </nav>

      {/* Handy: Blatt mit dem Untermenü des angetippten Space */}
      {offen && (
        <div className="leiste-mobil-blatt" onClick={() => setOffen(null)} style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,.45)' }}>
          {SPACES.filter(s => s.id === offen).map(s => (
            <div key={s.id} onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 'calc(64px + env(safe-area-inset-bottom))', background: C.flaecheHoch, border: `1px solid ${s.farbe}44`, borderRadius: 16, padding: 10, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8)' }}>
              <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: s.farbe, padding: '4px 10px 8px', fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {s.eintraege.map(e => { const Icon = e.icon; const an = voll === e.href || aktiv.eintrag?.href === e.href; return (
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
        {([{ art: 'link' as const, href: '/os', label: 'Heute', icon: Sun, farbe: C.aktiv, an: pfad === '/os' },
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
