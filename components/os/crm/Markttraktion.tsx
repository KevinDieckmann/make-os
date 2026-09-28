'use client';

// ─── MAKE OS — Markttraktion (25.09., Reiter neu 27.09.) ────────────────────
// Kevin: „alles, was unter dem CRM läuft — Sales, Marketing, Event — heißt
// Markttraktion.“ Reiter in Kevins Reihenfolge (27.09.):
//   Überblick   Traktions-Index über die drei Welten, die Heads, Übergaben, was jetzt zu tun ist
//   Kontakte    jede Person mit ihrer Geschichte (Kartei, Runden, „Kontakt öffnen“)
//   Firmen      ein Unternehmen, alle Beziehungen — und die Leads (Ebene 1: qualifizieren → SQL)
//   Deals       ab SQL im Closing (Ebene 2): Board mit Ziehen, Liste, Deal-Akte, Auswertung, Kunden (Ebene 3 → Mandate)
//   Follow-up   was dran ist: Zusagen, Wiedervorlagen, Deal-Schritte, Nachfassen, Kadenz — dazu die Power Hour
//   Marketing   Übersicht · Segmente · Kampagnen · Redaktionsplan · Newsletter · Positionierung — Head of Marketing
//   Events      Events mit Gästen, Checkliste, Abend, Nachfassen, Feedback, Budget — Head of Event
//   Stammdaten  Qualität, Wertelisten, Datenschutz, Import & Export
// In der Mitte (28.09. abends) die zwei Schnellknöpfe des Bereichs, jeder für sich und leise pulsierend:
//   Qualifizierung (orange)  Lead für Lead bis zum SQL
//   Angebot (grün)           Produkte anklicken, anpassen, senden — components/os/crm/angebot (AngebotStart)
// Der frühere Reiter „Sales“ ist darin aufgegangen; alte Adressen übersetzt lib/crm/adresse.ts.
// Das Grundkonzept (Stufen mit Austrittskriterium, Warum-jetzt-Punkte, Sperre statt
// Löschen, Score aus den Welten) stammt aus der Markttraktion in KEMARIS Operations;
// die Daten sind ausschließlich unsere eigenen (Masterdatei + Brain). Technisch heißt
// die Datenschicht weiter „crm“ (lib/crm, /api/crm) — das ist die Kartei darunter, nicht der Name.

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Seite, LEUCHT } from '../schlank';
import { aufloesen, markttraktion, kontaktAkte, angebotAusAdresse, LEISTE, PFAD, type Bereich, type DealsAnsicht, type FollowupAnsicht, type SalesReiterAnsicht, type AkteReiter } from '@/lib/crm/adresse';
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
import { FehlerHinweis } from './FehlerHinweis';
import { Runden, type RundenArt } from './Runden';
import { Leads, SalesTrichter } from './Leads';
import { SalesStart } from './SalesStart';
import { Kampagnen } from './Kampagnen';
import { Qualifizierung, KanalLeistungLaden } from './Qualifizierung';
import { useZurueck, nachOben } from '../Verlauf';
import { KontaktAkte } from './Akte';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';
import { AngebotStart } from './angebot/AngebotStart';
import { ZoeFragenKnopf } from './ZoeFragen';
import { zoeBezugFuer } from '@/lib/zoe/crm-bezug';

// Drei Gruppen (Kevin 27.09. abends, Mitte 28.09. abends): links die Arbeit — Überblick · Kontakte · Firmen · Deals · Follow-up —,
// in der Mitte die Schnellknöpfe Qualifizierung (orange) und Angebot (grün), rechts die Welten mit ihrem Punkt —
// Sales · Marketing · Make.One — und die Stammdaten. Die Reihenfolge steht in `LEISTE` (lib/crm/adresse.ts).
type ReiterEintrag = { id: Bereich; label: string; farbe?: string };
const REITER: Record<Bereich, ReiterEintrag> = {
  ueberblick: { id: 'ueberblick', label: 'Überblick' },
  kontakte: { id: 'kontakte', label: 'Kontakte' },
  firmen: { id: 'firmen', label: 'Firmen' },
  deals: { id: 'deals', label: 'Deals' },
  followup: { id: 'followup', label: 'Follow-up' },
  qualifizierung: { id: 'qualifizierung', label: 'Qualifizierung', farbe: LEUCHT.business },
  angebot: { id: 'angebot', label: 'Angebot', farbe: LEUCHT.gut },
  sales: { id: 'sales', label: 'Sales', farbe: WELT_FARBE.sales },
  marketing: { id: 'marketing', label: 'Marketing', farbe: WELT_FARBE.marketing },
  event: { id: 'event', label: 'Make.One', farbe: WELT_FARBE.event },
  stammdaten: { id: 'stammdaten', label: 'Stammdaten' },
};
const LINKS = LEISTE.links.map(b => REITER[b]);
const MITTE = LEISTE.mitte.map(b => REITER[b]);
const RECHTS = LEISTE.rechts.map(b => REITER[b]);
const SALES: { id: SalesReiterAnsicht; label: string }[] = [{ id: 'head', label: 'Head of Sales' }, { id: 'powerhour', label: 'Power Hour' }, { id: 'kampagnen', label: 'Kampagnen' }, { id: 'auswertung', label: 'Auswertung' }];
const DEALS: { id: DealsAnsicht; label: string }[] = [{ id: 'board', label: 'Board' }, { id: 'liste', label: 'Liste' }, { id: 'kunden', label: 'Kunden' }, { id: 'auswertung', label: 'Auswertung' }];
const FOLLOWUP: { id: FollowupAnsicht; label: string }[] = [{ id: 'faellig', label: 'Fällig' }, { id: 'woche', label: 'Woche' }, { id: 'powerhour', label: 'Power Hour' }, { id: 'kadenz', label: 'Kadenz' }];

const UNTER: Record<Bereich, string> = {
  ueberblick: 'Sales, Marketing und Event als ein System — gemessen an Gesprächen und Deals, nicht an Lautstärke.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Ein Unternehmen, alle Beziehungen — hier wird qualifiziert, bis es ein SQL ist.',
  deals: 'Ab SQL im Closing: jede Stufe endet mit einem Ereignis auf Kundenseite.',
  followup: 'Was heute dran ist — Zusagen, Wiedervorlagen, Kadenz. Nichts fällt runter.',
  qualifizierung: 'Lead für Lead: Kernfragen, Schmerz im Klartext, Lead-Score live — bis es ein SQL ist.',
  angebot: 'Angebot in einer Minute: Produkte anklicken, anpassen, senden.',
  sales: 'Vertrieb als System: der Head of Sales, die Power Hour, Kampagnen und die Auswertung.',
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

/**
 * Die zwei Schnellknöpfe in der Mitte (28.09. abends): jeder für sich, getönt in seiner Farbe, dahinter ein leiser Puls
 * (`.mt-schnell` in globals.css, aus bei „Bewegung reduzieren“). Aktiv = kräftige Fläche, volle Kontur, heller Text.
 */
function Schnellknoepfe({ aktiv, onWahl, className }: { aktiv: Bereich; onWahl: (b: Bereich) => void; className: string }) {
  return (
    <div role="tablist" aria-label="Schnellknöpfe" className={className}>
      {MITTE.map(b => {
        const an = aktiv === b.id;
        const f = b.farbe ?? C.aktiv;
        return (
          <button key={b.id} role="tab" aria-selected={an} onClick={() => onWahl(b.id)} className="mt-schnell"
            style={{
              ['--puls' as string]: f,
              padding: '7px 16px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700,
              ...TIEF.knopf(f),
              ...(an ? { background: `${f}3D`, border: `1px solid ${f}`, color: C.ink, boxShadow: `inset 0 0 0 1px ${f}66` } : {}),
            }}>
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
  const { setFehler, setHinweis } = api;
  const fehlerZu = useCallback(() => setFehler(null), [setFehler]);
  const hinweisZu = useCallback(() => setHinweis(null), [setHinweis]);
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
  const gehe = (s: Bereich, a?: string, k?: string, wie: 'push' | 'replace' = 'push', t?: string) => {
    const q = new URLSearchParams();
    if (s !== 'ueberblick') q.set('s', s);
    if (a) q.set('a', a);
    if (k) q.set('k', k);
    if (t) q.set('t', t);
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
  const salesAnsicht = (bereich === 'sales' ? (ansicht ?? 'head') : 'head') as SalesReiterAnsicht;
  // Aktivität hinzufügen — von überall in der Markttraktion, ein Knopf oben rechts (bis 28.09. „Gespräch festhalten“).
  const [erfassen, setErfassen] = useState(false);
  const runde = bereich === 'kontakte' && ansicht?.startsWith('runde-') ? (ansicht.slice(6) as RundenArt) : null;
  // „Kontakt öffnen“ (Kevin 25.09., Name 28.09.): eigener Eintrag im Verlauf des Browsers — „Zurück“ dort führt ebenfalls in die Kartei.
  const akteId = bereich === 'kontakte' && ansicht === 'akte' ? kParam : null;
  const zuAkte = (id: string) => gehe('kontakte', 'akte', id);
  // Reiter (28.09.: Über · Aktivitäten · Umsatz · Daten): `t` und `u` in der Adresse, Wechsel ersetzt den Eintrag;
  // „Über“ steht nicht in der Adresse. Ein Anker (#akt-…) springt im Reiter Aktivitäten zur Quelle.
  const akteReiterSetzen = (t: AkteReiter, u?: string | null, anker?: string) => {
    if (!akteId) return;
    router.replace(`${kontaktAkte(akteId, t, u)}${anker ? `#${anker}` : ''}`, { scroll: false });
    // Der Reiter liest den Anker aus der Adresse; ein Hash-Ereignis weckt ihn auch, wenn er schon offen ist.
    if (anker) setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 60);
  };

  return (
    // „+ Aktivität hinzufügen“ steht neben dem Titel — so ist er auch am Handy immer sichtbar (in der Reiterleiste rutschte er aus dem Bild).
    <Seite titel="Markttraktion" unter={UNTER[bereich]} rechts={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {/* „ZOE fragen“ (28.09., C7): mit dem, was gerade offen ist (Kontakt, Firma, Deal, Angebot) oder dem Reiter — ZOE liest selbst nach, schlägt nur vor. */}
      <ZoeFragenKnopf bezug={zoeBezugFuer(bereich, ansicht, kParam)} />
      <button onClick={() => setErfassen(true)} className="fassbar" style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 12, cursor: 'pointer', ...TIEF.knopf(C.aktiv), fontWeight: 700, fontSize: TYP.bedien, fontFamily: SCHRIFT.text, whiteSpace: 'nowrap' }}>+ Aktivität hinzufügen</button>
    </span>}>
      {/* Breit: eine Zeile, die Schnellknöpfe mittig zwischen links und rechts. Wird es zu eng (Rahmen < 1100 px, z. B. am
          Laptop mit Leiste oder am Handy): die Schnellknöpfe als eigene Zeile oben, darunter die Reiter zum Wischen — nie
          zwei Paare sichtbar zugleich (das andere ist display:none, also auch für Screenreader weg). */}
      <div className="mt-leistenrahmen">
        <Schnellknoepfe aktiv={bereich} onWahl={b => gehe(b)} className="mt-schnellzeile mt-nur-schmal" />
        <nav aria-label="Markttraktion" style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', padding: '8px 2px' }}>
          <Reiter liste={LINKS} aktiv={bereich} onWahl={b => gehe(b)} />
          <span aria-hidden style={{ flex: '1 0 8px' }} />
          <Schnellknoepfe aktiv={bereich} onWahl={b => gehe(b)} className="mt-schnellmitte mt-nur-breit" />
          <span aria-hidden className="mt-nur-breit" style={{ flex: '1 0 8px' }} />
          <Reiter liste={RECHTS} aktiv={bereich} onWahl={b => gehe(b)} leise />
        </nav>
      </div>
      <SchnellErfassen api={api} offen={erfassen} onZu={() => setErfassen(false)} kontaktId={bereich === 'kontakte' && auswahl && !auswahl.startsWith('f-') ? auswahl : undefined} />
      {/* Meldungen (K1): fixiert unten, bleiben stehen bis weggeklickt / ~8 s / nächstes Schreiben — nicht mehr oben als Zeile, die das Laden löschte. */}
      <FehlerHinweis text={api.fehler} onZu={fehlerZu} />
      <FehlerHinweis text={api.hinweis} onZu={hinweisZu} ton="info" bleibt />

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
      {bereich === 'angebot' && <AngebotStart api={api} {...angebotAusAdresse(params)} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} />}
      {bereich === 'qualifizierung' && <Qualifizierung api={api} zuKontakt={zuKontakt} zuFirma={zuFirma} zuLeads={id => gehe('firmen', 'leads', id)} />}
      {bereich === 'sales' && (
        <>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig farbe={WELT_FARBE.sales} liste={SALES} aktiv={salesAnsicht} onWahl={a => gehe('sales', a === 'head' ? undefined : a)} /></div>
          {salesAnsicht === 'head' && <SalesStart api={api} zuKontakt={zuKontakt} zuBereich={zuBereich} />}
          {salesAnsicht === 'powerhour' && <Heute api={api} name={name} zuKontakt={zuKontakt} />}
          {salesAnsicht === 'kampagnen' && <Kampagnen api={api} zuKontakt={zuKontakt} head="sales" />}
          {salesAnsicht === 'auswertung' && <KanalLeistungLaden i={0} mitTemperatur />}
          {salesAnsicht === 'auswertung' && <Pipeline api={api} ansicht="auswertung" zuKontakt={zuKontakt} zuLeads={() => gehe('firmen', 'leads')} zuAkte={zuAkte} zurueck={() => gehe('sales')} />}
        </>
      )}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('marketing', a === 'uebersicht' ? undefined : a)} />}
      {bereich === 'event' && <Events api={api} zuKontakt={zuKontakt} start={params.get('k') ?? undefined} onAuswahl={(id, wie) => gehe('event', undefined, id ?? undefined, wie)} />}

      {runde && <Runden api={api} art={runde} name={name} zuKontakt={zuKontakt} zurueck={() => zurueckWie(markttraktion('kontakte'))}
        kampagneId={kParam?.startsWith('kp-') ? kParam : undefined} zuKampagne={id => gehe('kontakte', 'runde-vernetzen', id ?? undefined, 'replace')} />}
      {akteId && <KontaktAkte api={api} id={akteId} name={name} zurueck={() => zurueckWie(markttraktion('kontakte', undefined, akteId))} zuFirma={zuFirma} zuAkte={zuAkte} t={params.get('t')} u={params.get('u')} setReiter={akteReiterSetzen} />}
      {!runde && !akteId && (bereich === 'kontakte' || (bereich === 'firmen' && ansicht !== 'leads')) && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht === 'akte' ? undefined : ansicht} zuRunde={a => gehe('kontakte', `runde-${a}`)} zuAkte={zuAkte} startBean={params.get('bean')} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('stammdaten', a || undefined)} />}
    </Seite>
  );
}
