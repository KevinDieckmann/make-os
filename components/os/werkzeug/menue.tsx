'use client';

// ─── Werkzeug-Muster — das Menü eines Werkzeugs (22.10.; lib/make-one/werkzeuge.ts) ─────────────────────────────────────────────────────────
// Rückmeldung: „Menü wie HubSpot: die linke Leiste klappt beim Öffnen eines Werkzeugs auf dessen Unterpunkte um.“ EIN Bauteil für drei Orte:
//   · `leiste`  die linke Leiste (components/os/Leiste.tsx) — oben „← MAKE OS“, Name mit Symbol, die Unterpunkte; eingeklappt nur Symbole
//   · `schiene` die schmale Symbol-Leiste im Werkzeugmodus (./rahmen.tsx) — nur Symbole + Tooltip, jeder Link bleibt im ganzen Bildschirm
//   · `blatt`   das Menü-Blatt am Handy — das Werkzeug oben, darunter wie bisher Bereich, Punkte, Einstellungen
// Die Punkte kommen aufgelöst aus `werkzeugPunkte` (welcher leuchtet, welche Kinder da sind) — hier wird nichts entschieden, nur gezeichnet.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, ZIEL, ECKE, MIKRO } from '@/lib/make-one/design';
import {
  werkzeugPunkte, werkzeugAktion, imWerkzeugModus, RUECKWEG_LABEL, RUECKWEG_TITEL, type Werkzeug, type WerkzeugKontext, type PunktAnsicht,
} from '@/lib/make-one/werkzeuge';

export type MenueVariante = 'leiste' | 'schiene' | 'blatt';

/** Eine Zeile der Leiste (wie die Punkte der Space-Leiste): Symbol + Name, eingeklappt nur das Symbol; aktiv in der Farbe des Space. */
export function menueZeileStil(an: boolean, farbe: string, schmal: boolean, kind = false): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: schmal ? 'center' : 'flex-start', gap: 10, minHeight: ZIEL.handy, boxSizing: 'border-box', width: '100%',
    padding: schmal ? '10px 0' : kind ? '8px 10px 8px 30px' : '9px 10px', borderRadius: 10, textDecoration: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
    color: an ? farbe : C.inkDim, background: an ? `${farbe}1A` : 'transparent', transition: 'background .2s ease, color .2s ease',
    fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 600 : 500,
  };
}

/** Der Rückweg „← MAKE OS“ — überall dieselbe Beschriftung; eingeklappt nur der Pfeil. */
export function RueckwegKnopf({ onZurueck, schmal, stil }: { onZurueck: () => void; schmal?: boolean; stil?: CSSProperties }) {
  return (
    <button type="button" onClick={onZurueck} title={RUECKWEG_TITEL} aria-label={RUECKWEG_TITEL} className="fassbar wz-rueckweg"
      style={{ ...menueZeileStil(false, C.aktiv, !!schmal), color: C.inkDim, ...stil }}>
      <ArrowLeft size={16} strokeWidth={1.9} style={{ flex: '0 0 auto' }} aria-hidden />
      {!schmal && <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, letterSpacing: '-.01em' }}>{RUECKWEG_LABEL}</span>}
    </button>
  );
}

export function WerkzeugMenue({ werkzeug, kontext, variante, schmal = false, farbe, onZurueck, onWeg }: {
  werkzeug: Werkzeug; kontext: WerkzeugKontext; variante: MenueVariante;
  /** Nur Symbole (eingeklappte Leiste, Symbol-Leiste). */ schmal?: boolean;
  /** Die Farbe des Space (aktiver Punkt, Symbol des Werkzeugs). */ farbe: string;
  /** „← MAKE OS“ — fehlt im Blatt (dort stehen die Punkte des Space gleich darunter). */ onZurueck?: () => void;
  /** Nach einem Klick (Blatt schließen). */ onWeg?: () => void;
}) {
  const nurSymbole = schmal || variante === 'schiene';
  const ziel = (href: string) => (variante === 'schiene' ? imWerkzeugModus(href) : href);
  const punkte = werkzeugPunkte(werkzeug, kontext);
  const fuss = werkzeugPunkte(werkzeug, kontext, 'fuss');
  const Icon = werkzeug.icon;

  const eintrag = (p: PunktAnsicht, kind = false) => {
    const S = p.icon;
    // Ein Punkt, der in einen anderen Bereich führt (Planung › „Woche planen“ → Kalender), trägt ↗ — er verlässt das Werkzeug.
    const raus = p.wechselt ? <ArrowUpRight size={13} strokeWidth={1.9} aria-hidden style={{ flex: '0 0 auto', marginLeft: 'auto', opacity: 0.7 }} /> : null;
    const innen = <>
      <S size={kind ? 15 : 17} strokeWidth={1.8} style={{ flex: '0 0 auto' }} aria-hidden />
      {!nurSymbole && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>}
      {!nurSymbole && raus}
    </>;
    const titel = `${p.titel === p.label ? p.label : `${p.label} — ${p.titel}`}${p.wechselt ? ` (öffnet ${p.wechselt})` : ''}`;
    if (variante === 'blatt') {
      const stil: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: kind ? '10px 10px 10px 22px' : '10px 10px', minHeight: ZIEL.handy, minWidth: 0, boxSizing: 'border-box', borderRadius: ECKE.eingabe, textDecoration: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, color: p.an ? farbe : C.ink, background: p.an ? `${farbe}14` : 'transparent', fontSize: TYP.body, fontWeight: p.an ? 600 : 500 };
      const blattInnen = <><S size={16} strokeWidth={1.75} style={{ flex: '0 0 auto' }} aria-hidden /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>{raus}</>;
      return p.href
        ? <Link key={p.id} href={p.href} onClick={() => onWeg?.()} aria-current={p.an ? 'page' : undefined} title={titel} data-werkzeug-punkt={p.id} style={stil}>{blattInnen}</Link>
        : <button key={p.id} type="button" onClick={() => { werkzeugAktion(werkzeug.id, p.aktion!); onWeg?.(); }} title={titel} data-werkzeug-punkt={p.id} className="fassbar" style={stil}>{blattInnen}</button>;
    }
    const stil = menueZeileStil(p.an, farbe, nurSymbole, kind);
    return p.href
      ? <Link key={p.id} href={ziel(p.href)} title={titel} aria-label={nurSymbole ? p.label : undefined} aria-current={p.an ? 'page' : undefined} className="fassbar" data-werkzeug-punkt={p.id} style={stil}>{innen}</Link>
      : <button key={p.id} type="button" onClick={() => werkzeugAktion(werkzeug.id, p.aktion!)} title={titel} aria-label={nurSymbole ? p.label : undefined} className="fassbar" data-werkzeug-punkt={p.id} style={stil}>{innen}</button>;
  };
  // Überschriften der Gruppen (Markttraktion: CRM · Vertrieb · Marketing · Steuerung): nur eine Beschriftung über den Punkten, keine Ebene — schmal ein Strich.
  const ueberschrift = (g: string) => (nurSymbole
    ? <div key={`g:${g}`} role="separator" aria-label={g} title={g} style={{ borderTop: `1px solid ${C.linie}`, margin: '6px 8px' }} />
    : <div key={`g:${g}`} role="heading" aria-level={3} className="wz-gruppe" style={{ ...MIKRO, padding: variante === 'blatt' ? '8px 10px 2px' : '10px 10px 4px', ...(variante === 'blatt' ? { gridColumn: '1 / -1' } : {}) }}>{g}</div>);
  // Ein Punkt ohne Gruppe nach einer Gruppe (z. B. „Automationen & Head“ hinter „Geldfluss“) bekommt einen Strich — sonst stünde er optisch in der Gruppe davor.
  const strich = (k: string) => <div key={`s:${k}`} role="separator" aria-hidden style={{ borderTop: `1px solid ${C.linie}`, margin: '6px 8px', ...(variante === 'blatt' ? { gridColumn: '1 / -1' } : {}) }} />;
  const liste = (ps: PunktAnsicht[]) => ps.flatMap((p, i) => [
    ...(p.gruppe && p.gruppe !== ps[i - 1]?.gruppe ? [ueberschrift(p.gruppe)] : []),
    ...(!p.gruppe && ps[i - 1]?.gruppe ? [strich(p.id)] : []),
    eintrag(p), ...p.unter.map(u => eintrag(u, true)),
  ]);

  if (variante === 'blatt') {
    return (
      <nav aria-label={`${werkzeug.name} — Menü`} data-werkzeug={werkzeug.id} style={{ display: 'grid', gap: 2, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.linie}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 4px', fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, color: C.ink }}>
          <Icon size={16} strokeWidth={1.9} color={farbe} aria-hidden />{werkzeug.name}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>{liste([...punkte, ...fuss])}</div>
      </nav>
    );
  }

  return (
    <nav aria-label={`${werkzeug.name} — Menü`} data-werkzeug={werkzeug.id} style={{ display: 'grid', gap: 2 }}>
      {onZurueck && <RueckwegKnopf onZurueck={onZurueck} schmal={nurSymbole} />}
      {/* Name mit Symbol — ein Klick führt zum Einstieg des Werkzeugs. */}
      <Link href={ziel(werkzeug.start)} title={werkzeug.name} aria-label={nurSymbole ? werkzeug.name : undefined} className="fassbar wz-name"
        style={{ display: 'flex', alignItems: 'center', justifyContent: nurSymbole ? 'center' : 'flex-start', gap: 9, minHeight: ZIEL.handy, padding: nurSymbole ? '8px 0' : '8px 10px', margin: '6px 0 4px', boxSizing: 'border-box', borderRadius: 10, textDecoration: 'none', color: C.ink, fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, letterSpacing: '-.01em' }}>
        <span aria-hidden style={{ width: 28, height: 28, flex: '0 0 auto', borderRadius: 8, display: 'grid', placeItems: 'center', background: `${farbe}24`, border: `1px solid ${farbe}66`, color: farbe }}>
          <Icon size={15} strokeWidth={1.9} />
        </span>
        {!nurSymbole && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{werkzeug.name}</span>}
      </Link>
      {liste(punkte)}
      {fuss.length > 0 && <div aria-hidden style={{ borderTop: `1px solid ${C.linie}`, margin: '8px 0 6px' }} />}
      {liste(fuss)}
    </nav>
  );
}
