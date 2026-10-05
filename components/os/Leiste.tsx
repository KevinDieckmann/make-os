'use client';

// ─── MAKE OS — Die Leiste: Home · Wachstum · zwei Spaces · Agenten (26.09.) ──
// Oben MAKE OS und das Klappzeichen (Kevin: „die ganze Leiste einklappbar,
// oben ein Zeichen dafür“) — eingeklappt bleibt eine schmale Spalte mit
// Symbolen, der Stand wird gemerkt. Dann Home (das eigene Dashboard),
// Wachstum (die Gesamtansicht, das zentrale Stück), Privat und Business als
// Kästen in ihrer Farbe — ein Tipp klappt die Punkte SOFORT auf, der andere
// Kasten klappt zu — dann Agenten als eigener Knopf. Unten gesondert ZOE
// und Brain, dann „Problem oder Idee melden“ (Kevin/Malin 28.09.: öffnet das
// Erfassen-Fenster, kein Seitenwechsel), darunter System und das Konto. Inbox
// und Kalender stehen im Kopf oben und folgen dem Space.
// Handy: Leiste unten mit Home · Privat · Business · ZOE · Netzwerken · System —
// Privat/Business öffnen ihre Punkte als Blatt. „Netzwerken“ (Handschlag, 02.10.) hat den Platz von „Melden“ übernommen
// (Malin nutzt es unterwegs); „Problem oder Idee melden“ bleibt am Handy erreichbar: als Zeile unten in beiden Blättern
// (Privat/Business) und auf der System-Seite, am Rechner unverändert in der Seitenleiste.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, Settings, LayoutDashboard, PanelLeftClose, PanelLeftOpen, MessageSquareWarning, Handshake, type LucideIcon } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { SPACES, UNTEN, EIGEN, aktiverSpaceEintrag, type SpaceId, type SpaceEintrag } from '@/lib/make-one/spaces';
import { useSpace } from '@/hooks/useSpace';
import { problemMelden } from './bauplan/IdeeErfassen';
import { WEG } from '@/lib/wege';
import { useWartezahl, wartezahlText } from '@/lib/netzwerken/zaehler';

const SYSTEM: SpaceEintrag = { href: '/os/system', label: 'System', icon: Settings, passt: ['/os/system', '/os/verbindungen', '/os/konto', '/os/datenbasis', '/os/stammdaten', '/os/datenschutz', '/os/bauplan', '/os/roadmap', '/os/onboarding'] };
/** Unter Home (Kevin 26.09.): Wachstum — die Gesamtansicht, das zentrale Stück. */
// Der Wachstum-Knopf stand vom 26.09. abends bis spät hier unter Home — seitdem ist der Score
// oben im Kopf als Zahl (Kevin), und /os/wachstum öffnet sich über diese Zahl oder ⌘K.
const MERKER = 'make-leiste';
/** Der Einstieg unten links (Kevin/Malin 28.09.) — früher der Knopf „Idee“ im Kopf. */
export const MELDEN_LABEL = 'Problem oder Idee melden';

/**
 * „Problem oder Idee melden“ als Knopf: löst `make-idee` aus, das Fenster
 * (IdeeErfassen im /os-Layout) öffnet sich über der aktuellen Seite und nimmt
 * sie mit. Eingeklappt nur das Symbol, der Name steht dann im Tooltip.
 */
export function MeldenKnopf({ zu, stil }: { zu: boolean; stil: CSSProperties }) {
  return (
    <button type="button" onClick={problemMelden} title={MELDEN_LABEL} aria-label={MELDEN_LABEL} className="fassbar" style={stil}>
      <MessageSquareWarning size={16} strokeWidth={1.75} style={{ flex: '0 0 auto' }} />
      {!zu && <span style={{ lineHeight: 1.3 }}>{MELDEN_LABEL}</span>}
    </button>
  );
}

/**
 * Handy: „Problem oder Idee melden“ als Zeile unten im Blatt (Privat/Business) — ≥ 44 px hoch. `onWeg` schließt das Blatt,
 * danach öffnet sich das Erfassen-Fenster wie am Rechner.
 */
export function MeldenZeile({ onWeg }: { onWeg: () => void }) {
  return (
    <button type="button" onClick={() => { onWeg(); problemMelden(); }} title={MELDEN_LABEL} aria-label={MELDEN_LABEL} className="fassbar"
      style={{ marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px', minHeight: 44, borderRadius: 10, border: 'none', borderTop: `1px solid ${C.linie}`, background: 'transparent', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
      <MessageSquareWarning size={16} strokeWidth={1.75} />{MELDEN_LABEL}
    </button>
  );
}

export function Leiste() {
  const pfad = usePathname() ?? '/os';
  const router = useRouter();
  const { space, suche, setzen } = useSpace();
  const aktiv = aktiverSpaceEintrag(pfad, suche);
  const passt = (e: SpaceEintrag) => e.passt.some(p => pfad === p || pfad.startsWith(`${p}/`));
  const [konto, setKonto] = useState<{ name: string } | null>(null);
  const [offen, setOffen] = useState<SpaceId | null>(null); // Handy-Blatt
  const wartezahl = useWartezahl(); // Netzwerken (03.10.): wie viele Erfassungen noch auf dem Gerät warten
  // Welcher Kasten aufgeklappt ist — folgt dem Space, reagiert aber sofort auf den Tipp.
  const [auf, setAuf] = useState<SpaceId>(space);
  useEffect(() => { setAuf(space); }, [space]);
  // Eingeklappt (Kevin 26.09.): nur Symbole, Stand gemerkt.
  const [zu, setZu] = useState(false);
  useEffect(() => { try { setZu(localStorage.getItem(MERKER) === 'zu'); } catch { /* egal */ } }, []);
  const klappen = () => setZu(v => { const n = !v; try { localStorage.setItem(MERKER, n ? 'zu' : 'auf'); } catch { /* egal */ } return n; });
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  useEffect(() => { setOffen(null); }, [pfad, suche]);
  const vorname = konto?.name.split(' ')[0] ?? '';

  /** Ein Kasten (Home, Wachstum, Space, Agenten): Symbol + Text, eingeklappt nur das Symbol. */
  const kastenStil = (an: boolean, farbe: string): CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'flex-start', gap: 10, padding: zu ? '11px 0' : '11px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', textDecoration: 'none', marginBottom: 6,
    border: `1px solid ${an ? `${farbe}66` : 'rgba(255,255,255,.08)'}`, background: an ? `${farbe}1C` : 'rgba(255,255,255,.025)', color: an ? farbe : C.ink,
    fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, minHeight: 44, boxSizing: 'border-box', transition: 'background .2s ease, color .2s ease, border-color .2s ease',
  });
  const kasten = (href: string, label: string, Icon: LucideIcon, an: boolean, farbe = C.aktiv, rechts?: ReactNode) => (
    <Link key={href} href={href} title={label} className="fassbar" style={kastenStil(an, farbe)}>
      <Icon size={17} strokeWidth={1.9} />{!zu && <span style={{ flex: 1 }}>{label}</span>}{!zu && rechts}
    </Link>
  );
  /** Ein Punkt im Untermenü: Punkt-Marke links, Text; aktiv in der Space-Farbe. */
  const punkt = (e: SpaceEintrag, farbe: string, an: boolean) => (
    <Link key={e.href} href={e.href} className="fassbar" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px 7px 14px', minHeight: 40, boxSizing: 'border-box', borderRadius: 10, textDecoration: 'none',
      color: an ? farbe : C.inkDim, background: an ? `${farbe}14` : 'transparent', transition: 'background .2s ease, color .2s ease',
      fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 600 : 500,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: an ? farbe : 'rgba(255,255,255,.16)', flex: '0 0 auto' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
    </Link>
  );
  /** Ein Eintrag unten: Symbol + Text, eingeklappt nur das Symbol. */
  const zeileStil = (an: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'flex-start', gap: 10, padding: zu ? '9px 0' : '8px 10px', minHeight: 40, boxSizing: 'border-box', borderRadius: 10, textDecoration: 'none',
    color: an ? C.aktiv : C.inkDim, background: an ? C.aktivSanft : 'transparent', transition: 'background .2s ease, color .2s ease',
    fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 600 : 500,
  });
  const zeile = (e: SpaceEintrag, an: boolean) => {
    const Icon = e.icon;
    return (
      <Link key={e.href} href={e.href} title={e.label} className="fassbar" style={zeileStil(an)}>
        <Icon size={16} strokeWidth={1.75} />
        {!zu && <span>{e.label}</span>}
      </Link>
    );
  };
  const breite = zu ? 68 : 232;

  return (
    <>
      <nav className="leiste-desktop" aria-label="Hauptnavigation" style={{
        width: breite, flex: `0 0 ${breite}px`, padding: zu ? '18px 10px' : '18px 14px', borderRight: `1px solid ${C.linie}`, background: C.grund,
        flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden', transition: 'width .2s ease, flex-basis .2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'space-between', gap: 6, padding: '4px 4px 14px' }}>
          {!zu && (
            <Link href="/os" title="Home" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', color: C.ink, textDecoration: 'none', padding: '0 6px' }}>
              <span className="zeit-puls" style={{ width: 9, height: 9, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 10px ${C.aktiv}33` }} />MAKE OS
            </Link>
          )}
          <button type="button" onClick={klappen} title={zu ? 'Leiste ausklappen' : 'Leiste einklappen'} aria-label={zu ? 'Leiste ausklappen' : 'Leiste einklappen'} className="fassbar" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: C.inkDim, borderRadius: 10, width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: '0 0 auto' }}>
            {zu ? <PanelLeftOpen size={16} strokeWidth={1.9} /> : <PanelLeftClose size={16} strokeWidth={1.9} />}
          </button>
        </div>

        {/* Home: das eigene Dashboard */}
        {kasten('/os', 'Home', LayoutDashboard, pfad === '/os')}
        {/* Wachstum: die Gesamtansicht */}

        {SPACES.map(s => {
          const an = auf === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} style={{ marginBottom: 0 }}>
              <button type="button" title={s.label} onClick={() => { setAuf(s.id); setzen(s.id); if (zu) router.push(s.start); }} className="fassbar" aria-expanded={an} style={kastenStil(an, s.farbe)}>
                <Icon size={17} strokeWidth={1.9} />
                {!zu && <span style={{ flex: 1 }}>{s.label}</span>}
                {!zu && <ChevronDown size={15} strokeWidth={2} style={{ transform: an ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s ease', opacity: .75 }} />}
              </button>
              {an && !zu && (
                <div style={{ display: 'grid', gap: 1, padding: '0 0 8px 6px' }}>
                  {s.eintraege.map(e => punkt(e, s.farbe, aktiv.space === s.id && aktiv.eintrag?.href === e.href))}
                </div>
              )}
            </div>
          );
        })}

        {/* Eigene Knöpfe unter den Spaces (Kevin 26.09.): Agenten */}
        {EIGEN.map(e => kasten(e.href, e.label, e.icon, aktiv.space === null && aktiv.eintrag?.href === e.href))}

        <div style={{ marginTop: 'auto', display: 'grid', gap: 1 }}>
          <div style={{ borderTop: `1px solid ${C.linie}`, margin: '10px 0 8px' }} />
          {UNTEN.map(e => zeile(e, aktiv.space === null && aktiv.eintrag?.href === e.href))}
          {/* Zwischen Brain und System (Kevin/Malin 28.09.): öffnet das Fenster, bleibt auf der Seite. */}
          <MeldenKnopf zu={zu} stil={{ ...zeileStil(false), width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }} />
          <div style={{ borderTop: `1px solid ${C.linie}`, margin: '8px 0' }} />
          {zeile(SYSTEM, passt(SYSTEM))}
          <Link href="/os/konto" title={vorname ? `Konto · ${vorname}` : 'Mein Konto'} style={{ display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'flex-start', gap: 9, padding: zu ? '8px 0 4px' : '8px 10px 4px', minHeight: 44, boxSizing: 'border-box', color: C.inkDim, textDecoration: 'none', fontSize: TYP.bedien }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: C.flaeche, color: C.aktiv, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700 }}>{(vorname || '?').charAt(0).toUpperCase()}</span>
            {!zu && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || '…'}</span>}
          </Link>
        </div>
      </nav>

      {/* Handy: Blatt mit den Punkten des angetippten Space */}
      {offen && (
        <div className="leiste-mobil-blatt" onClick={() => setOffen(null)} style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,.45)' }}>
          {SPACES.filter(s => s.id === offen).map(s => (
            <div key={s.id} onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 'calc(64px + env(safe-area-inset-bottom))', background: C.flaecheHoch, border: `1px solid ${s.farbe}55`, borderRadius: 16, padding: 10, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8)' }}>
              <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: s.farbe, padding: '4px 10px 8px', fontSize: TYP.bedien, letterSpacing: '.08em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {s.eintraege.map(e => { const Icon = e.icon; const an = aktiv.space === s.id && aktiv.eintrag?.href === e.href; return (
                  <Link key={e.href} href={e.href} onClick={() => { setzen(s.id); setOffen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, textDecoration: 'none', color: an ? s.farbe : C.ink, background: an ? `${s.farbe}14` : 'transparent', fontSize: TYP.body, fontWeight: an ? 600 : 500 }}><Icon size={16} strokeWidth={1.75} />{e.label}</Link>
                ); })}
              </div>
              {/* „Problem oder Idee melden“ ist am Handy nicht mehr in der Leiste (dort steht Netzwerken) — hier bleibt es einen Tipp entfernt. */}
              <MeldenZeile onWeg={() => setOffen(null)} />
            </div>
          ))}
        </div>
      )}
      <nav className="leiste-mobil" aria-label="Hauptnavigation" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, borderTop: `1px solid ${C.linie}`, background: C.grund,
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', justifyContent: 'space-around',
      }}>
        {([{ art: 'link' as const, href: '/os', label: 'Home', icon: LayoutDashboard, farbe: C.aktiv, an: pfad === '/os' },
          // N3 (03.10.): ein Space leuchtet unten nur auf Seiten, die zu ihm gehören (Eintrag der Space-Punkte) — nicht auf Konto, Heute, Kalender oder Inbox, nur weil er zuletzt gewählt war.
          ...SPACES.map(s => ({ art: 'space' as const, href: s.start, label: s.label, icon: s.icon, farbe: s.farbe, an: aktiv.space === s.id || offen === s.id, id: s.id })),
          { art: 'link' as const, href: '/zoe', label: 'ZOE', icon: UNTEN[0].icon, farbe: C.aktiv, an: pfad.startsWith('/zoe') },
          { art: 'link' as const, href: WEG.netzwerken(), label: 'Netzwerken', icon: Handshake, farbe: C.aktiv, an: pfad === WEG.netzwerken() || pfad.startsWith(`${WEG.netzwerken()}/`) },
          { art: 'link' as const, href: '/os/system', label: 'System', icon: Settings, farbe: C.aktiv, an: passt(SYSTEM) }]).map(e => {
          const Icon = e.icon;
          // Netzwerken (03.10.): wartet etwas auf dem Gerät, steht es als Abzeichen am Knopf („2 warten“).
          const abzeichen = e.label === 'Netzwerken' ? wartezahlText(wartezahl) : null;
          const innen = <><Icon size={20} strokeWidth={1.75} /><span>{e.label}</span>{abzeichen && <span data-netzwerken-zaehler aria-label={`${abzeichen} auf dem Gerät`} style={{ position: 'absolute', top: -5, left: '50%', marginLeft: 4, padding: '1px 6px', borderRadius: 999, fontSize: TYP.mikro, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', background: wartezahl.wartend ? LEUCHT.achtung : LEUCHT.kritisch, color: C.grund }}>{abzeichen}</span>}</>;
          const stil = { position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, flex: 1, padding: '6px 0', border: 'none', background: 'none', textDecoration: 'none', color: e.an ? e.farbe : C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: e.an ? 700 : 500, minHeight: 48, justifyContent: 'center', cursor: 'pointer' };
          return e.art === 'space'
            ? <button key={e.label} type="button" onClick={() => setOffen(o => (o === e.id ? null : e.id))} className="fassbar" style={stil}>{innen}</button>
            : <Link key={e.href} href={e.href} className="fassbar" style={stil}>{innen}</Link>;
        })}
      </nav>
    </>
  );
}
