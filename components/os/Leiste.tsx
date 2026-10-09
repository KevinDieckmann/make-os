'use client';

// ─── MAKE OS — Die Leiste (Aufräumen Etappe 1, 08.10.) ──────────────────────
// Kevin: „Die Software wirkt unaufgeräumt und überladen, ich weiß gar nicht mehr wo alles ist.“ Seitdem zeigt die Leiste
// NUR die Punkte des aktiven Space (höchstens zwölf, lib/make-one/spaces.ts `leisteFuer`): Heute · Inbox · Kalender ·
// Aufgaben · Planung · Finanzen · zwei Bereiche des Space · Kontakte · ZOE. Den Space wählt man oben im Kopf (Privat |
// Business). Unten: Einstellungen, „Problem oder Idee melden“ (öffnet das Erfassen-Fenster, kein Seitenwechsel), Konto.
// Oben MAKE OS und das Klappzeichen — eingeklappt bleibt eine schmale Spalte mit Symbolen, der Stand wird gemerkt.
// Nachbesserung 08.10. (Kevin nach der Demo): EIN Schalter oben (Alles · Privat · Business). Bei „Alles“ zeigt die Leiste
// Heute · Inbox · Kalender · Aufgaben · Planung · Finanzen · Kontakte · ZOE und darunter je eine kleine Gruppe Privat (Gesundheit,
// Familie) und Business (Markttraktion, Mandate & Unternehmen) — zusammen zwölf Punkte (`leisteFuer('alles')`, `ALLES_GRUPPEN`).
// Handy: unten FÜNF Einträge — Heute · Inbox · Menü · ZOE · Netzwerken (sechs liefen ineinander). „Menü“ öffnet das Blatt mit dem
// Schalter Alles/Privat/Business, allen Punkten der Wahl, Einstellungen und „Problem oder Idee melden“ — ein „Mehr“ daneben wäre
// dasselbe Blatt ein zweites Mal; den frei gewordenen Platz bekommt die Inbox (am Handy der häufigste Weg, sonst zwei Tipps entfernt).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { Settings, PanelLeftClose, PanelLeftOpen, MessageSquareWarning, Handshake, Sun, Inbox, LayoutGrid } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { ZOE_EINTRAG, ALLES_EINTRAEGE, ALLES_GRUPPEN, SPACE_WAHLEN, aktiverSpaceEintrag, aktiverLeistenPunkt, leisteFuer, spaceVon, wahlInfo, type SpaceWahl, type SpaceEintrag } from '@/lib/make-one/spaces';
import { useSpace } from '@/hooks/useSpace';
import { problemMelden } from './bauplan/IdeeErfassen';
import { WEG } from '@/lib/wege';
import { useWartezahl, wartezahlText } from '@/lib/netzwerken/zaehler';
import { EINSTELLUNGEN_PFADE } from '@/lib/make-one/einstellungen';
import { useNurBusiness } from './useInhaber';

/** Einstellungen (08.10., vorher „System“): Adresse bleibt /os/system; leuchtet auf allen Seiten, die dort gelistet sind. */
export const EINSTELLUNGEN: SpaceEintrag = { href: '/os/system', label: 'Einstellungen', icon: Settings, passt: EINSTELLUNGEN_PFADE };
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

/** Die Handy-Leiste unten — höchstens fünf Einträge, kurze Namen (Wächter in tests/aufraeumen-etappe1.test.ts). */
export const HANDY_LEISTE = ['Heute', 'Inbox', 'Menü', 'ZOE', 'Netzwerken'] as const;

/** Die Punkte einer Wahl als Blöcke: bei „Alles“ die gemeinsamen Punkte, dann je Gruppe Privat/Business mit Überschrift. */
export function leistenBloecke(w: SpaceWahl): { titel?: string; farbe: string; eintraege: SpaceEintrag[] }[] {
  if (w !== 'alles') return [{ farbe: spaceVon(w).farbe, eintraege: leisteFuer(w) }];
  return [{ farbe: wahlInfo('alles').farbe, eintraege: ALLES_EINTRAEGE }, ...ALLES_GRUPPEN.map(g => ({ titel: g.label, farbe: g.farbe, eintraege: g.eintraege }))];
}

/**
 * Handy: „Problem oder Idee melden“ als Zeile unten im Blatt (Menü) — ≥ 44 px hoch. `onWeg` schließt das Blatt,
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
  const { wahl, suche, setzen } = useSpace();
  const aktiv = aktiverSpaceEintrag(pfad, suche);
  const sp = wahlInfo(wahl);
  const punktAn = aktiverLeistenPunkt(wahl, pfad, suche);
  const einstellungenAn = EINSTELLUNGEN.passt.some(p => pfad === p || pfad.startsWith(`${p}/`));
  const [konto, setKonto] = useState<{ name: string } | null>(null);
  const [offen, setOffen] = useState(false); // Handy-Blatt „Menü“
  const [blattWahl, setBlattWahl] = useState<SpaceWahl>(wahl); // im Blatt umschaltbar, ohne gleich zu springen
  // Konto „nur Business“ (09.10., E4-Rest): im Blatt wie im Kopf kein Knopf „Privat“ (der Server liefert dort nichts aus dem Haushalt).
  const nurBusiness = useNurBusiness();
  const blattWahlen = nurBusiness ? SPACE_WAHLEN.filter(id => id !== 'privat') : SPACE_WAHLEN;
  const wartezahl = useWartezahl(); // Netzwerken (03.10.): wie viele Erfassungen noch auf dem Gerät warten
  // Eingeklappt (Kevin 26.09.): nur Symbole, Stand gemerkt.
  const [zu, setZu] = useState(false);
  useEffect(() => { try { setZu(localStorage.getItem(MERKER) === 'zu'); } catch { /* egal */ } }, []);
  const klappen = () => setZu(v => { const n = !v; try { localStorage.setItem(MERKER, n ? 'zu' : 'auf'); } catch { /* egal */ } return n; });
  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) setKonto(d.ich); }).catch(() => {});
  }, []);
  useEffect(() => { setOffen(false); }, [pfad, suche]);
  useEffect(() => { if (offen) setBlattWahl(wahl); }, [offen]); // eslint-disable-line react-hooks/exhaustive-deps
  const vorname = konto?.name.split(' ')[0] ?? '';

  /** Ein Punkt der Leiste: Symbol + Text, eingeklappt nur das Symbol; aktiv in der Farbe des Space. */
  const zeileStil = (an: boolean, farbe: string = C.aktiv): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'flex-start', gap: 10, padding: zu ? '10px 0' : '9px 10px', minHeight: 44, boxSizing: 'border-box', borderRadius: 10, textDecoration: 'none',
    color: an ? farbe : C.inkDim, background: an ? `${farbe}1A` : 'transparent', transition: 'background .2s ease, color .2s ease',
    fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 600 : 500,
  });
  const zeile = (e: SpaceEintrag, an: boolean, farbe?: string) => {
    const Icon = e.icon;
    return (
      <Link key={e.href} href={e.href} title={e.label} aria-current={an ? 'page' : undefined} className="fassbar" style={zeileStil(an, farbe)}>
        <Icon size={17} strokeWidth={1.8} style={{ flex: '0 0 auto' }} />
        {!zu && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>}
      </Link>
    );
  };
  const gruppenTitel = (titel: string, farbe: string) => zu
    ? <div key={`t-${titel}`} aria-hidden style={{ borderTop: `1px solid ${C.linie}`, margin: '8px 8px 4px' }} />
    : <div key={`t-${titel}`} style={{ fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: farbe, padding: '12px 10px 4px' }}>{titel}</div>;
  const breite = zu ? 68 : 232;

  // Handy unten: fünf Einträge (HANDY_LEISTE). Heute und Inbox folgen der Wahl; „Menü“ leuchtet, wenn das Blatt offen ist oder die
  // Seite ein Punkt der Leiste ist, der unten nicht eigens steht (Aufgaben, Finanzen, Gesundheit …), oder in den Einstellungen.
  const inboxEintrag = leisteFuer(wahl).find(e => e.label === 'Inbox') ?? ALLES_EINTRAEGE[1];
  const unten = [
    { art: 'link' as const, href: sp.start, label: 'Heute', icon: Sun, an: pfad === '/os' },
    { art: 'link' as const, href: inboxEintrag.href, label: 'Inbox', icon: Inbox, an: pfad === '/os/inbox' || pfad.startsWith('/os/inbox/') },
    { art: 'menue' as const, href: '', label: 'Menü', icon: LayoutGrid, an: offen || einstellungenAn || (!!punktAn && !['Heute', 'Inbox', 'ZOE'].includes(punktAn.label)) },
    { art: 'link' as const, href: ZOE_EINTRAG.href, label: 'ZOE', icon: ZOE_EINTRAG.icon, an: aktiv.eintrag === ZOE_EINTRAG },
    { art: 'link' as const, href: WEG.netzwerken(), label: 'Netzwerken', icon: Handshake, an: pfad === WEG.netzwerken() || pfad.startsWith(`${WEG.netzwerken()}/`) },
  ];

  return (
    <>
      <nav className="leiste-desktop" aria-label="Hauptnavigation" style={{
        width: breite, flex: `0 0 ${breite}px`, padding: zu ? '18px 10px' : '18px 14px', borderRight: `1px solid ${C.linie}`, background: C.grund,
        flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', overflowX: 'hidden', transition: 'width .2s ease, flex-basis .2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'space-between', gap: 6, padding: '4px 4px 14px' }}>
          {!zu && (
            <Link href={sp.start} title="Heute" style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, letterSpacing: '-.01em', color: C.ink, textDecoration: 'none', padding: '0 6px' }}>
              <span className="zeit-puls" style={{ width: 9, height: 9, borderRadius: '50%', background: sp.farbe, boxShadow: `0 0 10px ${sp.farbe}33` }} />MAKE OS
            </Link>
          )}
          <button type="button" onClick={klappen} title={zu ? 'Leiste ausklappen' : 'Leiste einklappen'} aria-label={zu ? 'Leiste ausklappen' : 'Leiste einklappen'} className="fassbar" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: C.inkDim, borderRadius: 10, width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: '0 0 auto' }}>
            {zu ? <PanelLeftOpen size={16} strokeWidth={1.9} /> : <PanelLeftClose size={16} strokeWidth={1.9} />}
          </button>
        </div>

        {/* Die Wahl (oben im Kopf) — nur als Beschriftung, in ihrer Farbe. */}
        {!zu && <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: sp.farbe, padding: '0 10px 6px' }}>{sp.label}</div>}
        {/* Die Punkte der Wahl (Space: seine Punkte, dann ZOE; Alles: gemeinsame Punkte samt ZOE, dann die Gruppen Privat/Business). */}
        {leistenBloecke(wahl).flatMap(b => [
          ...(b.titel ? [gruppenTitel(b.titel, b.farbe)] : []),
          ...b.eintraege.map(e => zeile(e, punktAn?.href === e.href, e === ZOE_EINTRAG ? C.aktiv : b.farbe)),
        ])}

        <div style={{ marginTop: 'auto', display: 'grid', gap: 1 }}>
          <div style={{ borderTop: `1px solid ${C.linie}`, margin: '10px 0 8px' }} />
          {zeile(EINSTELLUNGEN, einstellungenAn)}
          {/* Öffnet das Fenster, bleibt auf der Seite (Kevin/Malin 28.09.). */}
          <MeldenKnopf zu={zu} stil={{ ...zeileStil(false), width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }} />
          <Link href="/os/konto" title={vorname ? `Konto · ${vorname}` : 'Mein Konto'} style={{ display: 'flex', alignItems: 'center', justifyContent: zu ? 'center' : 'flex-start', gap: 9, padding: zu ? '8px 0 4px' : '8px 10px 4px', minHeight: 44, boxSizing: 'border-box', color: C.inkDim, textDecoration: 'none', fontSize: TYP.bedien }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: C.flaeche, color: C.aktiv, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700 }}>{(vorname || '?').charAt(0).toUpperCase()}</span>
            {!zu && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || '…'}</span>}
          </Link>
        </div>
      </nav>

      {/* Handy: Blatt „Menü“ — Schalter Alles/Privat/Business, die Punkte dieser Wahl, Einstellungen, Melden. */}
      {offen && (
        <div className="leiste-mobil-blatt" onClick={() => setOffen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,.45)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 'calc(64px + env(safe-area-inset-bottom))', maxHeight: 'calc(100vh - 96px - env(safe-area-inset-bottom))', overflowY: 'auto', background: C.flaecheHoch, border: `1px solid ${wahlInfo(blattWahl).farbe}55`, borderRadius: 16, padding: 10, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8)' }}>
            <div role="group" aria-label="Bereich im Menü" style={{ display: 'grid', gridTemplateColumns: `repeat(${blattWahlen.length}, minmax(0, 1fr))`, gap: 4, padding: 3, marginBottom: 6, borderRadius: 999, background: 'rgba(255,255,255,.05)' }}>
              {blattWahlen.map(id => { const w = wahlInfo(id); const an = id === blattWahl; return (
                <button key={id} type="button" aria-pressed={an} onClick={() => setBlattWahl(id)} className="fassbar"
                  style={{ minHeight: 44, borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    border: `1px solid ${an ? `${w.farbe}66` : 'transparent'}`, background: an ? `${w.farbe}1F` : 'transparent', color: an ? w.farbe : C.inkDim }}>{w.label}</button>
              ); })}
            </div>
            {leistenBloecke(blattWahl).map(b => (
              <div key={b.titel ?? 'haupt'}>
                {b.titel && <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: b.farbe, padding: '8px 10px 4px', fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase' }}>{b.titel}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                  {b.eintraege.map(e => { const Icon = e.icon; const an = blattWahl === wahl && punktAn?.href === e.href; const farbe = e === ZOE_EINTRAG ? C.aktiv : b.farbe; return (
                    <Link key={e.href} href={e.href} onClick={() => { setzen(blattWahl); setOffen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 10px', minHeight: 44, minWidth: 0, boxSizing: 'border-box', borderRadius: 12, textDecoration: 'none', color: an ? farbe : C.ink, background: an ? `${farbe}14` : 'transparent', fontSize: TYP.body, fontWeight: an ? 600 : 500 }}>
                      <Icon size={16} strokeWidth={1.75} style={{ flex: '0 0 auto' }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                    </Link>
                  ); })}
                </div>
              </div>
            ))}
            <Link href={EINSTELLUNGEN.href} onClick={() => setOffen(false)} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px', minHeight: 44, boxSizing: 'border-box', borderRadius: 10, borderTop: `1px solid ${C.linie}`, textDecoration: 'none', color: einstellungenAn ? C.aktiv : C.inkDim, fontSize: TYP.body, fontWeight: 500 }}>
              <Settings size={16} strokeWidth={1.75} />{EINSTELLUNGEN.label}
            </Link>
            {/* „Problem oder Idee melden“ ist am Handy nicht in der Leiste (dort steht Netzwerken) — hier bleibt es einen Tipp entfernt. */}
            <MeldenZeile onWeg={() => setOffen(false)} />
          </div>
        </div>
      )}
      <nav className="leiste-mobil" aria-label="Hauptnavigation" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, borderTop: `1px solid ${C.linie}`, background: C.grund,
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', justifyContent: 'space-around',
      }}>
        {unten.map(e => {
          const Icon = e.icon;
          const farbe = e.art === 'menue' ? sp.farbe : C.aktiv;
          // Netzwerken (03.10.): wartet etwas auf dem Gerät, steht es als Abzeichen am Knopf („2 warten“).
          const abzeichen = e.label === 'Netzwerken' ? wartezahlText(wartezahl) : null;
          const innen = <><Icon size={20} strokeWidth={1.75} /><span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>{abzeichen && <span data-netzwerken-zaehler aria-label={`${abzeichen} auf dem Gerät`} style={{ position: 'absolute', top: -5, left: '50%', marginLeft: 4, padding: '1px 6px', borderRadius: 999, fontSize: TYP.mikro, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', background: wartezahl.wartend ? LEUCHT.achtung : LEUCHT.kritisch, color: C.grund }}>{abzeichen}</span>}</>;
          // Fünf gleich breite Spalten (flex 1 1 0, minWidth 0): die Namen kürzen mit „…“, statt ineinanderzulaufen.
          const stil = { position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, flex: '1 1 0', minWidth: 0, padding: '6px 2px', border: 'none', background: 'none', textDecoration: 'none', color: e.an ? farbe : C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: e.an ? 700 : 500, minHeight: 48, justifyContent: 'center', cursor: 'pointer' };
          return e.art === 'menue'
            ? <button key={e.label} type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} aria-label={`Menü · ${sp.label}`} className="fassbar" style={stil}>{innen}</button>
            : <Link key={e.label} href={e.href} className="fassbar" style={stil}>{innen}</Link>;
        })}
      </nav>
    </>
  );
}
