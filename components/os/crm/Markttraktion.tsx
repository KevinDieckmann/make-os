'use client';

// ─── MAKE OS — Markttraktion (25.09.) ───────────────────────────────────────
// Kevin: „alles, was unter dem CRM läuft — Sales, Marketing, Event — heißt
// Markttraktion.“ Aufbau:
//   Überblick   Traction-Score über die drei Welten, die drei Heads, die
//               Übergaben zwischen den Welten, was jetzt zu tun ist
//   Sales       Heute (Power Hour) · Pipeline · Kunden · Kampagnen  — Head of Sales
//   Marketing   Übersicht · Segmente · Kampagnen · Redaktionsplan ·
//               Newsletter · Positionierung                     — Head of Marketing
//   Event       Events mit Gästen, Checkliste, Abend, Nachfassen  — Head of Event
//   Kontakte · Firmen · Stammdaten — die gemeinsame Grundlage aller drei Welten
// Kampagnen planen beide Heads (Sales und Marketing) auf denselben Daten.
// Das Grundkonzept (Stufen mit Austrittskriterium, Warum-jetzt-Punkte,
// Sperre statt Löschen, Score aus fünf Säulen) stammt aus der Markttraktion in
// KEMARIS Operations; die Daten sind ausschließlich unsere eigenen
// (Masterdatei + Brain). Technisch heißt die Datenschicht weiter „crm“
// (lib/crm, /api/crm) — das ist die Kartei darunter, nicht der Name.

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, LEUCHT } from '../schlank';
import { aufloesen, PFAD, type Bereich, type SalesAnsicht } from '@/lib/crm/adresse';
import { useCrm } from './daten';
import { Pillen } from './teile';
import { Ueberblick, WELT_FARBE } from './Ueberblick';
import { Heute } from './Heute';
import { Kartei } from './Kartei';
import { Pipeline } from './Pipeline';
import { Kunden } from './Kunden';
import { Kampagnen } from './Kampagnen';
import { Marketing } from './Marketing';
import { Events } from './Events';
import { Stammdaten } from './Stammdaten';
import { SchnellErfassen } from './SchnellErfassen';
import { Runden, type RundenArt } from './Runden';

const WELTEN: { id: Bereich; label: string; farbe?: string }[] = [
  { id: 'ueberblick', label: 'Überblick' }, { id: 'sales', label: 'Sales', farbe: WELT_FARBE.sales },
  { id: 'marketing', label: 'Marketing', farbe: WELT_FARBE.marketing }, { id: 'event', label: 'Event', farbe: WELT_FARBE.event },
];
const GRUNDLAGE: { id: Bereich; label: string }[] = [{ id: 'kontakte', label: 'Kontakte' }, { id: 'firmen', label: 'Firmen' }, { id: 'stammdaten', label: 'Stammdaten' }];
const SALES: { id: SalesAnsicht; label: string }[] = [{ id: 'heute', label: 'Heute · Power Hour' }, { id: 'pipeline', label: 'Pipeline' }, { id: 'kunden', label: 'Kunden' }, { id: 'kampagnen', label: 'Kampagnen' }];

const UNTER: Record<Bereich, string> = {
  ueberblick: 'Sales, Marketing und Event als ein System — gemessen an Gesprächen und Chancen, nicht an Lautstärke.',
  sales: 'Versprechen vor Signalen vor Chancen — und nur über Kanäle, die zulässig sind.',
  marketing: 'Ansprechbar sein, nicht laut.',
  event: 'Erfolgreich ist ein Event, wenn danach die richtigen Gespräche stattfinden.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Ein Unternehmen, alle Beziehungen.',
  stammdaten: 'Sauber halten, was alles andere trägt: Qualität, Werte, Datenschutz.',
};

function Reiter({ liste, aktiv, onWahl, leise }: { liste: { id: Bereich; label: string; farbe?: string }[]; aktiv: Bereich; onWahl: (b: Bereich) => void; leise?: boolean }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, background: leise ? 'transparent' : 'rgba(255,255,255,.06)', border: leise ? '1px solid rgba(255,255,255,.08)' : 'none', borderRadius: 12, padding: 3, flex: '0 0 auto' }}>
      {liste.map(b => {
        const an = aktiv === b.id;
        return (
          <button key={b.id} role="tab" aria-selected={an} onClick={() => onWahl(b.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, transition: 'background .2s ease, color .2s ease',
            background: an ? C.ink : 'transparent', color: an ? C.grund : C.inkDim,
          }}>
            {b.farbe && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: b.farbe, boxShadow: an ? 'none' : `0 0 8px ${b.farbe}` }} />}
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

export function MarkttraktionSeite() {
  const router = useRouter(); const params = useSearchParams();
  const { s: bereich, a: ansicht } = aufloesen(params.get('s'), params.get('a'));
  const [auswahl, setAuswahl] = useState<string | null>(params.get('k'));
  const api = useCrm();
  const gehe = (s: Bereich, a?: string, k?: string) => {
    const q = new URLSearchParams();
    if (s !== 'ueberblick') q.set('s', s);
    if (a) q.set('a', a);
    if (k) q.set('k', k);
    router.replace(q.toString() ? `${PFAD}?${q}` : PFAD, { scroll: false });
  };
  const zuBereich = (b: string, a?: string) => { const z = aufloesen(b, a); gehe(z.s, z.a); };
  const zuKontakt = (id: string) => { setAuswahl(id); gehe('kontakte', undefined, id); };
  const zuFirma = (id: string) => { setAuswahl(id); gehe('firmen', undefined, id); };
  // Die Auswahl folgt dem Link (Schnellsuche, Befunde, Zurück im Browser).
  const kParam = params.get('k');
  useEffect(() => { if (kParam) setAuswahl(kParam); }, [kParam]);
  const name = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '—');
  const sales = (ansicht ?? 'heute') as SalesAnsicht;
  // Gespräch festhalten — von überall in der Markttraktion, ein Knopf oben rechts.
  const [erfassen, setErfassen] = useState(false);
  const runde = bereich === 'kontakte' && ansicht?.startsWith('runde-') ? (ansicht.slice(6) as RundenArt) : null;

  return (
    <Seite titel="Markttraktion" unter={UNTER[bereich]}>
      <nav aria-label="Markttraktion" style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', margin: '-4px 0 2px', paddingBottom: 2 }}>
        <Reiter liste={WELTEN} aktiv={bereich} onWahl={b => gehe(b)} />
        <Reiter leise liste={GRUNDLAGE} aktiv={bereich} onWahl={b => gehe(b)} />
        <span style={{ flex: 1 }} />
        <button onClick={() => setErfassen(true)} className="fassbar" style={{ flex: '0 0 auto', padding: '8px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: C.aktiv, color: C.grund, fontWeight: 700, fontSize: TYP.bedien, fontFamily: SCHRIFT.text, whiteSpace: 'nowrap' }}>+ Gespräch</button>
      </nav>
      <SchnellErfassen api={api} offen={erfassen} onZu={() => setErfassen(false)} kontaktId={bereich === 'kontakte' && auswahl && !auswahl.startsWith('f-') ? auswahl : undefined} />
      {api.fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{api.fehler}</div>}

      {bereich === 'ueberblick' && <Ueberblick api={api} zuBereich={zuBereich} />}

      {bereich === 'sales' && (
        <>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig farbe={WELT_FARBE.sales} liste={SALES} aktiv={sales} onWahl={a => gehe('sales', a === 'heute' ? undefined : a)} /></div>
          {sales === 'heute' && <Heute api={api} name={name} zuKontakt={zuKontakt} />}
          {sales === 'pipeline' && <Pipeline api={api} zuKontakt={zuKontakt} />}
          {sales === 'kunden' && <Kunden api={api} zuKontakt={zuKontakt} />}
          {sales === 'kampagnen' && <Kampagnen api={api} zuKontakt={zuKontakt} head="sales" />}
        </>
      )}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('marketing', a === 'uebersicht' ? undefined : a)} />}
      {bereich === 'event' && <Events api={api} zuKontakt={zuKontakt} start={params.get('k') ?? undefined} onAuswahl={id => gehe('event', undefined, id ?? undefined)} />}

      {runde && <Runden api={api} art={runde} name={name} zuKontakt={zuKontakt} zurueck={() => gehe('kontakte')} />}
      {!runde && (bereich === 'kontakte' || bereich === 'firmen') && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht} zuRunde={a => gehe('kontakte', `runde-${a}`)} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} />}
    </Seite>
  );
}
