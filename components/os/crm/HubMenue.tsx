'use client';

// ─── Markttraktion · das Hub-Menü (22.10.) ───────────────────────────────────────────────────────────────────────────────────────────────
// Kevin 22.10.: Markttraktion wird ein eigenes Werkzeug wie HubSpot — die Punkte stehen als Daten in `HUB_MENUE` (lib/crm/adresse.ts), hier nur
// die Symbole (`HUB_SYMBOLE`, lucide-react) und das Menü IN der Seite.
//
// ÜBERGANG — wird durch die Werkzeug-Leiste ersetzt: Sobald das Werkzeug-Muster (lib/make-one/werkzeuge.ts, Rahmen components/os/werkzeug/*) die
// Markttraktion trägt, klappt die linke Leiste beim Öffnen auf diese Punkte um. Dann fällt `HubMenue` aus components/os/crm/Markttraktion.tsx
// weg (die Seite rendert nur noch den Inhalt); `HUB_SYMBOLE` und `HUB_MENUE` bleiben die Quelle der Werkzeug-Konfiguration.
// Breit (≥ 1400 px, globals.css `.mt-hub`): eine schmale Spalte links neben dem Inhalt, klebt beim Scrollen. Schmaler und am Handy: oben ein Knopf
// mit dem aktuellen Punkt, der die Gruppen als Blatt aufklappt. Jeder Punkt ist ein Link (`next/link`) — Zurück führt dorthin zurück.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, Building2, Funnel, SquareKanban, FileSignature, PhoneCall, Megaphone, CalendarDays, Handshake, Goal, ChartNoAxesCombined, Bot, Settings, ChevronDown } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, MIKRO, RAND, ECKE } from '@/lib/make-one/design';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { HUB_MENUE, hubGruppenAnzeige, type HubEintrag, type HubOrtId, type HubSymbol } from '@/lib/crm/adresse';
import { nachOben } from '../Verlauf';

/** Das Symbol je Punkt (Namen aus `HUB_MENUE`) — dieselbe Zuordnung nimmt die Werkzeug-Konfiguration. */
export const HUB_SYMBOLE: Record<HubSymbol, LucideIcon> = {
  LayoutDashboard, Users, Building2, Funnel, SquareKanban, FileSignature, PhoneCall, Megaphone, CalendarDays, Handshake, Goal, ChartNoAxesCombined, Bot, Settings,
};

/** Die Farbe eines leuchtenden Punkts — die des Space, wie in der Leiste. */
const AN = SPACE_FARBE.business;

function Punkt({ p, an, onWahl }: { p: HubEintrag; an: boolean; onWahl?: () => void }) {
  const Icon = HUB_SYMBOLE[p.symbol];
  return (
    <Link href={p.ziel} title={p.titel} aria-current={an ? 'page' : undefined} className="fassbar" scroll={false}
      onClick={() => { onWahl?.(); if (!an) nachOben(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', minHeight: 44, boxSizing: 'border-box', borderRadius: 10, textDecoration: 'none',
        color: an ? AN : C.inkDim, background: an ? `${AN}1A` : 'transparent', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 600 : 500,
      }}>
      <Icon size={17} strokeWidth={1.8} aria-hidden style={{ flex: '0 0 auto' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
    </Link>
  );
}

/** Die Gruppen mit Überschrift und darunter der Fuß (Stammdaten). */
function Gruppen({ aktiv, onWahl, blatt }: { aktiv: HubOrtId; onWahl?: () => void; blatt?: boolean }) {
  const gruppen = hubGruppenAnzeige();
  return (
    <>
      <div className={blatt ? 'mt-hub-blatt' : undefined} style={blatt ? undefined : { display: 'grid', gap: 1 }}>
        {gruppen.map(g => (
          <div key={g.id} role="group" aria-label={g.titel ?? 'Überblick'} style={{ display: 'grid', gap: 1, alignContent: 'start' }}>
            {g.titel && <div style={{ ...MIKRO, padding: '12px 10px 4px' }}>{g.titel}</div>}
            {g.punkte.map(p => <Punkt key={p.id} p={p} an={p.id === aktiv} onWahl={onWahl} />)}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 1, borderTop: `1px solid ${RAND.haar}`, marginTop: 8, paddingTop: 8 }}>
        {HUB_MENUE.fuss.map(p => <Punkt key={p.id} p={p} an={p.id === aktiv} onWahl={onWahl} />)}
      </div>
    </>
  );
}

/** Das Menü der Markttraktion in der Seite (siehe Kopf — Übergang bis zur Werkzeug-Leiste). */
export function HubMenue({ aktiv }: { aktiv: HubOrtId }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => { setOffen(false); }, [aktiv]);
  const alle = [...hubGruppenAnzeige().flatMap(g => g.punkte), ...HUB_MENUE.fuss];
  const jetzt = alle.find(p => p.id === aktiv) ?? alle[0];
  const Icon = HUB_SYMBOLE[jetzt.symbol];
  return (
    <>
      <nav aria-label="Markttraktion" className="mt-hub-nav-breit"><Gruppen aktiv={aktiv} /></nav>
      <div className="mt-hub-nav-schmal">
        <button type="button" onClick={() => setOffen(!offen)} aria-expanded={offen} aria-controls="mt-hub-blatt" className="fassbar"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '8px 14px', boxSizing: 'border-box', cursor: 'pointer',
            borderRadius: ECKE.knopf, border: `1px solid ${AN}55`, background: `${AN}14`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, textAlign: 'left',
          }}>
          <Icon size={18} strokeWidth={1.8} aria-hidden style={{ flex: '0 0 auto', color: AN }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jetzt.name}</span>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 500 }}>Menü</span>
          <ChevronDown size={16} aria-hidden style={{ flex: '0 0 auto', transform: offen ? 'rotate(180deg)' : undefined, transition: 'transform .2s ease' }} />
        </button>
        {offen && (
          <nav id="mt-hub-blatt" aria-label="Markttraktion" style={{ padding: 8, borderRadius: ECKE.flach, border: `1px solid ${RAND.flaeche}`, background: C.flaecheHoch }}>
            <Gruppen aktiv={aktiv} onWahl={() => setOffen(false)} blatt />
          </nav>
        )}
      </div>
    </>
  );
}
