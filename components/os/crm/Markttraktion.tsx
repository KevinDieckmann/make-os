'use client';

// ─── MAKE OS — Markttraktion (25.09.) ───────────────────────────────────────
// Kevin: „alles, was unter dem CRM läuft — Sales, Marketing, Event — heißt
// Markttraktion.“ Aufbau:
//   Überblick   Traction-Score über die drei Welten, die drei Heads, die
//               Übergaben zwischen den Welten, was jetzt zu tun ist
//   Sales       Heute (Power Hour) · 1 Leads (qualifizieren → SQL) · 2 Deals (Pipeline,
//               Closing) · 3 Kunden (Mandate) · Kampagnen — Head of Sales; oben der Trichter
//   Marketing   Übersicht · Segmente · Kampagnen · Redaktionsplan ·
//               Newsletter · Positionierung                     — Head of Marketing
//   Event       Events mit Gästen, Checkliste, Abend, Nachfassen  — Head of Event
//   Kontakte · Firmen · Stammdaten — die gemeinsame Grundlage aller drei Welten;
//               „Akte öffnen“ zeigt eine Person auf einer ganzen Seite (a=akte)
// Kampagnen planen beide Heads (Sales und Marketing) auf denselben Daten.
// Das Grundkonzept (Stufen mit Austrittskriterium, Warum-jetzt-Punkte,
// Sperre statt Löschen, Score aus fünf Säulen) stammt aus der Markttraktion in
// KEMARIS Operations; die Daten sind ausschließlich unsere eigenen
// (Masterdatei + Brain). Technisch heißt die Datenschicht weiter „crm“
// (lib/crm, /api/crm) — das ist die Kartei darunter, nicht der Name.

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Seite, LEUCHT } from '../schlank';
import { aufloesen, markttraktion, PFAD, type Bereich, type DealsAnsicht, type FollowupAnsicht } from '@/lib/crm/adresse';
import { useCrm } from './daten';
import { Pillen } from './teile';
import { Ueberblick, WELT_FARBE } from './Ueberblick';
import { Heute } from './Heute';
import { Kartei } from './Kartei';
import { Pipeline } from './Pipeline';
import { KundenKurz } from './Kunden';
import { FollowUp } from './FollowUp';
import { Marketing } from './Marketing';
import { Events } from './Events';
import { Stammdaten } from './Stammdaten';
import { SchnellErfassen } from './SchnellErfassen';
import { Runden, type RundenArt } from './Runden';
import { Leads, SalesTrichter } from './Leads';
import { useZurueck, nachOben } from '../Verlauf';
import { KontaktAkte } from './Akte';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';

// Reiter in Kevins Reihenfolge (27.09.): Überblick · Kontakte · Firmen · Deals · Follow-up · Marketing · Events · Stammdaten.
// Der Reiter „Sales“ ist aufgegangen: Leads leben bei den Firmen, die Power Hour im Follow-up, Kampagnen im Marketing.
const HAUPT: { id: Bereich; label: string; farbe?: string }[] = [
  { id: 'ueberblick', label: 'Überblick' },
  { id: 'kontakte', label: 'Kontakte' }, { id: 'firmen', label: 'Firmen' },
  { id: 'deals', label: 'Deals', farbe: WELT_FARBE.sales }, { id: 'followup', label: 'Follow-up', farbe: WELT_FARBE.sales },
  { id: 'marketing', label: 'Marketing', farbe: WELT_FARBE.marketing }, { id: 'event', label: 'Events', farbe: WELT_FARBE.event },
  { id: 'stammdaten', label: 'Stammdaten' },
];
const DEALS: { id: DealsAnsicht; label: string }[] = [{ id: 'board', label: 'Board' }, { id: 'liste', label: 'Liste' }, { id: 'auswertung', label: 'Auswertung' }, { id: 'kunden', label: 'Kunden' }];
const FOLLOWUP: { id: FollowupAnsicht; label: string }[] = [{ id: 'faellig', label: 'Fällig' }, { id: 'woche', label: 'Woche' }, { id: 'powerhour', label: 'Power Hour' }, { id: 'kadenz', label: 'Kadenz' }];

const UNTER: Record<Bereich, string> = {
  ueberblick: 'Sales, Marketing und Event als ein System — gemessen an Gesprächen und Deals, nicht an Lautstärke.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Ein Unternehmen, alle Beziehungen — hier wird qualifiziert, bis es ein SQL ist.',
  deals: 'Ab SQL im Closing: jede Stufe endet mit einem Ereignis auf Kundenseite.',
  followup: 'Was heute dran ist — Zusagen, Wiedervorlagen, Kadenz. Nichts fällt runter.',
  marketing: 'Ansprechbar sein, nicht laut.',
  event: 'Erfolgreich ist ein Event, wenn danach die richtigen Gespräche stattfinden.',
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
            {b.farbe && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: b.farbe, boxShadow: an ? 'none' : `0 0 8px ${b.farbe}33` }} />}
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
  const api = useCrm();
  const zurueckWie = useZurueck();
  // Die Auswahl steht im Link (k) — so zeigen Zurück, Vor, Schnellsuche und Befunde immer dieselbe Person.
  const kParam = params.get('k');
  const auswahl = kParam;
  /**
   * Hin zu einem Ort (25.09.: „überall sauber zurück“): Bereich, Ansicht oder
   * etwas öffnen = neuer Eintrag im Verlauf (push) — Zurück führt genau dorthin
   * zurück. Nur Gleichrangiges austauschen (die nächste Person in der Liste)
   * ersetzt den Eintrag (replace). Beim Wechsel des Bereichs oder der Ansicht
   * beginnt der Inhalt oben.
   */
  const gehe = (s: Bereich, a?: string, k?: string, wie: 'push' | 'replace' = 'push') => {
    const q = new URLSearchParams();
    if (s !== 'ueberblick') q.set('s', s);
    if (a) q.set('a', a);
    if (k) q.set('k', k);
    const ziel = q.toString() ? `${PFAD}?${q}` : PFAD;
    if (ziel === `${PFAD}${params.toString() ? `?${params}` : ''}`) return;
    router[wie](ziel, { scroll: false });
    if (wie === 'push' && (s !== bereich || (a ?? '') !== (ansicht ?? ''))) nachOben();
  };
  /** In der Kartei eine Person oder Firma wählen: die erste öffnet (Zurück schließt sie wieder), jede weitere tauscht nur. */
  const setAuswahl = (id: string | null) => gehe(bereich, ansicht, id ?? undefined, auswahl && id ? 'replace' : id ? 'push' : 'replace');
  // Ziel mit Objekt (Person, Deal, Event): der Team-Feed und die Index-Punkte geben `k` mit (26.09.).
  const zuBereich = (b: string, a?: string, k?: string) => { const z = aufloesen(b, a); gehe(z.s, z.a, k); };
  const zuKontakt = (id: string) => gehe('kontakte', undefined, id);
  const zuFirma = (id: string) => gehe('firmen', undefined, id);
  const name = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '—');
  const dealsAnsicht = (bereich === 'deals' ? (ansicht ?? 'board') : 'board') as DealsAnsicht;
  const followupAnsicht = (bereich === 'followup' ? (ansicht ?? 'faellig') : 'faellig') as FollowupAnsicht;
  // Gespräch festhalten — von überall in der Markttraktion, ein Knopf oben rechts.
  const [erfassen, setErfassen] = useState(false);
  const runde = bereich === 'kontakte' && ansicht?.startsWith('runde-') ? (ansicht.slice(6) as RundenArt) : null;
  // Die Akte einer Person (Kevin 25.09.): eigener Eintrag im Verlauf des Browsers — „Zurück“ dort führt ebenfalls in die Kartei.
  const akteId = bereich === 'kontakte' && ansicht === 'akte' ? kParam : null;
  const zuAkte = (id: string) => gehe('kontakte', 'akte', id);

  return (
    // „+ Gespräch“ steht neben dem Titel — so ist er auch am Handy immer sichtbar (in der Reiterleiste rutschte er aus dem Bild).
    <Seite titel="Markttraktion" unter={UNTER[bereich]} rechts={<button onClick={() => setErfassen(true)} className="fassbar" style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 12, cursor: 'pointer', ...TIEF.knopf(C.aktiv), fontWeight: 700, fontSize: TYP.bedien, fontFamily: SCHRIFT.text, whiteSpace: 'nowrap' }}>+ Gespräch festhalten</button>}>
      <nav aria-label="Markttraktion" style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', margin: '-4px 0 2px', paddingBottom: 2 }}>
        <Reiter liste={HAUPT} aktiv={bereich} onWahl={b => gehe(b)} />
      </nav>
      <SchnellErfassen api={api} offen={erfassen} onZu={() => setErfassen(false)} kontaktId={bereich === 'kontakte' && auswahl && !auswahl.startsWith('f-') ? auswahl : undefined} />
      {api.fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{api.fehler}</div>}

      {bereich === 'firmen' && !akteId && <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig farbe={WELT_FARBE.sales} liste={[{ id: 'kartei', label: 'Alle Firmen' }, { id: 'leads', label: 'Leads · qualifizieren' }]} aktiv={ansicht === 'leads' ? 'leads' : 'kartei'} onWahl={a => gehe('firmen', a === 'leads' ? 'leads' : undefined)} /></div>}
      {bereich === 'ueberblick' && <IndexStreifen ids={STREIFEN.markttraktion} titel="Business-Index · Markttraktion" />}
      {bereich === 'ueberblick' && <Ueberblick api={api} zuBereich={zuBereich} />}

      {bereich === 'firmen' && ansicht === 'leads' && (
        <>
          <SalesTrichter api={api} zuBereich={zuBereich} />
          <Leads api={api} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} />
        </>
      )}
      {bereich === 'deals' && (
        <>
          {dealsAnsicht !== 'akte' && <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig farbe={WELT_FARBE.sales} liste={DEALS} aktiv={dealsAnsicht} onWahl={a => gehe('deals', a === 'board' ? undefined : a)} /></div>}
          {(dealsAnsicht === 'board' || dealsAnsicht === 'liste' || dealsAnsicht === 'akte' || dealsAnsicht === 'auswertung') && <Pipeline api={api} ansicht={dealsAnsicht} zuKontakt={zuKontakt} zuLeads={() => gehe('firmen', 'leads')} zuAkte={id => gehe('deals', 'akte', id)} zurueck={() => zurueckWie(markttraktion('deals'))} />}
          {dealsAnsicht === 'kunden' && <KundenKurz api={api} />}
        </>
      )}
      {bereich === 'followup' && (
        <>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig farbe={WELT_FARBE.sales} liste={FOLLOWUP} aktiv={followupAnsicht} onWahl={a => gehe('followup', a === 'faellig' ? undefined : a)} /></div>
          {followupAnsicht === 'powerhour' && <Heute api={api} name={name} zuKontakt={zuKontakt} />}
          {followupAnsicht !== 'powerhour' && <FollowUp api={api} ansicht={followupAnsicht} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} zuAkte={zuAkte} />}
        </>
      )}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('marketing', a === 'uebersicht' ? undefined : a)} />}
      {bereich === 'event' && <Events api={api} zuKontakt={zuKontakt} start={params.get('k') ?? undefined} onAuswahl={(id, wie) => gehe('event', undefined, id ?? undefined, wie)} />}

      {runde && <Runden api={api} art={runde} name={name} zuKontakt={zuKontakt} zurueck={() => zurueckWie(markttraktion('kontakte'))}
        kampagneId={kParam?.startsWith('kp-') ? kParam : undefined} zuKampagne={id => gehe('kontakte', 'runde-vernetzen', id ?? undefined, 'replace')} />}
      {akteId && <KontaktAkte api={api} id={akteId} name={name} zurueck={() => zurueckWie(markttraktion('kontakte', undefined, akteId))} zuFirma={zuFirma} zuAkte={zuAkte} />}
      {!runde && !akteId && (bereich === 'kontakte' || (bereich === 'firmen' && ansicht !== 'leads')) && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht === 'akte' ? undefined : ansicht} zuRunde={a => gehe('kontakte', `runde-${a}`)} zuAkte={zuAkte} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('stammdaten', a || undefined)} />}
    </Seite>
  );
}
