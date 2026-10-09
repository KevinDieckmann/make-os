'use client';

// ─── Agenten-Seite: die Kopfzeile des Gesprächs (09.10., Aufräumen nach dem Muster der Claude-App) ─────────────────────────
// Über dem Chat steht NUR diese Zeile: links der Knopf für die Liste (und „+“, wenn die Liste zu ist), Kugel und Name (Bereich-Chip
// erlaubt), rechts kleine Symbol-Knöpfe — Info, „Neuer Thread“, der Zähler „n wartet“ (nur wenn der Hintergrund zu ist; ein
// Klick öffnet ihn), der Knopf für den Hintergrund und „⋯“ mit allem Weiteren zu diesem Gespräch. Die Reiter eines Heads stehen als schmale
// zweite Zeile darunter. Am Handy ohne Seitenfeld-Knöpfe
// (dort gibt es die Reiter Gespräch · Team · Läuft).

import type { ReactNode } from 'react';
import { Info, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, SquarePen } from 'lucide-react';
import { FARBE as C, ABSTAND, LEUCHT, RADIUS, RAND, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, SymbolKnopf } from '../ui';
import { felderVon, useAgenten, wartetAufDichZahl } from './kontext';
import { Menue, NeuMenue, type MenueEintrag } from './Kopfleiste';
import { TASTE_TEXT } from './klappen';
import { SPALTE_EINS } from './masse';

/** Kennungen der beiden Seitenfelder (für `aria-controls`). */
export const FELD_ID = { links: 'agenten-liste', rechts: 'agenten-hintergrund' } as const;

export function GespraechKopf({ avatar, vor, titel, chip, zusatz, reiter, info, neu, menue = [] }: {
  avatar: ReactNode;
  /** Vor dem Namen (Brotkrumen „Head ›“ beim Mitarbeiter-Thread). */
  vor?: ReactNode;
  /** Name. */
  titel: ReactNode;
  /** Bereich oder Zustand neben dem Namen. */
  chip?: ReactNode;
  /** Leiser Zusatz hinter dem Namen (Titel des offenen Threads). */
  zusatz?: ReactNode;
  /** Reiter des Heads (Chat · Aktivität · Info) — klein in derselben Zeile. */
  reiter?: ReactNode;
  /** Info-Ansicht an/aus (ZOE). */
  info?: { an: boolean; umschalten: () => void };
  /** „Neuer Thread“ bzw. „Neues Gespräch“. */
  neu?: { label: string; tun: () => void };
  /** Alles Weitere unter „⋯“. */
  menue?: readonly MenueEintrag[];
}) {
  const w = useAgenten();
  const handy = w.form === 'handy';
  const f = handy ? null : felderVon(w);
  const wartet = wartetAufDichZahl(w);
  return (
    <header style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: ABSTAND.s, minWidth: 0, paddingBottom: ABSTAND.s, borderBottom: `1px solid ${RAND.haar}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, minWidth: 0 }}>
        {!handy && f && (
          <SymbolKnopf ariaLabel={f.links ? `Liste zuklappen (${TASTE_TEXT.links})` : `Liste aufklappen (${TASTE_TEXT.links})`} offen={f.links} steuert={FELD_ID.links} onClick={() => f.umschalten('links')}>
            {f.links ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </SymbolKnopf>
        )}
        {!handy && f && !f.links && <NeuMenue symbol />}
        {avatar}
        {/* Der Name kürzt zuletzt, der Zusatz (Titel des Threads) zuerst. */}
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: ABSTAND.s }}>
          {vor}
          <h2 style={{ margin: 0, minWidth: 0, flex: '0 1 auto', fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titel}</h2>
          {chip && <span style={{ flex: '0 0 auto', display: 'inline-flex' }}>{chip}</span>}
          {zusatz && <span style={{ flex: '1 1 0', minWidth: 0, fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zusatz}</span>}
        </div>
        <span className="ui-symbole" style={{ flex: '0 0 auto' }}>
          {info && (
            <SymbolKnopf ariaLabel={info.an ? 'Info schließen — zurück zum Gespräch' : 'Info: Überblick und Jahresziele'} gedrueckt={info.an} onClick={info.umschalten}><Info size={18} /></SymbolKnopf>
          )}
          {neu && <SymbolKnopf ariaLabel={neu.label} onClick={neu.tun}><SquarePen size={18} /></SymbolKnopf>}
          {!handy && f && !f.rechts && wartet > 0 && (
            <Knopf leise farbe={LEUCHT.achtung} onClick={() => f.umschalten('rechts', true)} ariaLabel={`${wartet} ${wartet === 1 ? 'wartet' : 'warten'} auf dich — Hintergrund öffnen`}>
              <span aria-hidden className="krit-puls" style={{ width: 8, height: 8, borderRadius: RADIUS.pille, background: LEUCHT.achtung }} />⚑ {wartet} {wartet === 1 ? 'wartet' : 'warten'}
            </Knopf>
          )}
          {!handy && f && (
            <SymbolKnopf ariaLabel={f.rechts ? `Hintergrund zuklappen (${TASTE_TEXT.rechts})` : `Hintergrund öffnen (${TASTE_TEXT.rechts})`} offen={f.rechts} steuert={FELD_ID.rechts} onClick={() => f.umschalten('rechts')}>
              {f.rechts ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </SymbolKnopf>
          )}
          {menue.length > 0 && (
            <Menue ariaLabel="Mehr zu diesem Gespräch" rechts eintraege={menue}
              knopf={(offen, um) => <SymbolKnopf ariaLabel="Mehr zu diesem Gespräch" offen={offen} onClick={um}><MoreHorizontal size={18} /></SymbolKnopf>} />
          )}
        </span>
      </div>
      {/* Die Reiter eines Heads (Chat · Aktivität · Info) als zweite, schmale Zeile der Kopfzeile — der Name bleibt lesbar. */}
      {reiter && <div style={{ minWidth: 0 }}>{reiter}</div>}
    </header>
  );
}
