'use client';

// ─── MAKE OS — Markttraktion (25.09., Reiter neu 27.09., aufgeräumt 08.10., Hub seit 22.10.) ──
// Kevin: „alles, was unter dem CRM läuft — Sales, Marketing, Event — heißt Markttraktion.“ Seit 22.10. ist sie ein eigenes Werkzeug wie HubSpot:
// statt Reiterzeile, Schnellknöpfen und Zahnrad ein Menü mit Gruppen (Liste: `HUB_MENUE` in lib/crm/adresse.ts):
//   Überblick           Für dich, Team, Übergaben, was jetzt zu tun ist
//   CRM                 Kontakte (Kartei, Runden, „Kontakt öffnen“) · Firmen (Firmen-Kartei, Firmenkarte)
//   Vertrieb            Leads & Qualifizierung (Runde · Leads · Scoring) · Deals (Board · Liste, Deal-Akte) · Angebote · Follow-up & Power Hour
//                       (Fällig · Woche · Power Hour · Kadenz)
//   Marketing           Marketing (Übersicht · Anfragen · Segmente · Kampagnen · Redaktionsplan · Newsletter · Positionierung) · Events (Kalender ·
//                       Wirkung · Im Kundenauftrag · Make.One — EINE Reiterzeile) · Netzwerken (eigene Seite)
//   Steuerung           Planung (Kreislauf · Ziele · Leadkanäle · Challenges) · Auswertung (Flow, Traktions-Index, Scoreboard, Kanäle, Kunden, Pipeline) ·
//                       Automationen & Head (Standard-Punkt des Werkzeug-Musters)
//   Fuß                 Formulare (25.10.: „Angebot anfordern“, externe Links, Eingänge, Einstellungen) · Stammdaten (Qualität, Wertelisten, Datenschutz, Import & Export)
// Die dritte Ebene bleibt als Reiter IN der Seite. „+ Angebot“ steht im Kopf, sobald eine Kontakt-, Firmen- oder Deal-Akte offen ist, und nimmt sie
// mit (`angebotVonHier`); „+ Aktivität“ und „ZOE fragen“ bleiben im Kopf. Alte Adressen (Reiter „Sales“, Firmen › Leads, Deals › Kunden …)
// übersetzt `aufloesen` und die Seite schreibt sie still auf den neuen Ort um.
// Das Menü ist die linke Leiste: Markttraktion ist ein Werkzeug (lib/make-one/werkzeuge.ts `MARKTTRAKTION_WERKZEUG`) — beim Öffnen klappt die Leiste
// auf die Punkte um (am Handy oben im Blatt „Menü“); die Seite rendert nur den Inhalt. „Automationen & Head“ = der Baustein des Werkzeug-Musters.
// Das Grundkonzept stammt aus der Markttraktion in KEMARIS Operations; die Daten sind ausschließlich unsere eigenen. Technisch heißt
// die Datenschicht weiter „crm“ (lib/crm, /api/crm) — das ist die Kartei darunter, nicht der Name.

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Seite, Knopf } from '../ui';
import { aufloesen, markttraktion, kontaktAkte, angebotAusAdresse, angebotVonHier, planungLink, punktVon, eventsReiterVon, EVENTS_REITER, PFAD, type Bereich, type DealsAnsicht, type FollowupAnsicht, type AkteReiter, type BesucheAnsicht, type QualiAnsicht, type PlanungAnsicht, type EventsReiterId } from '@/lib/crm/adresse';
import { istBesuch } from '@/lib/crm/besuche-form';
import { useCrm } from './daten';
import { Pillen } from './teile';
import { Ueberblick, WELT_FARBE } from './Ueberblick';
import { Heute } from './Heute';
import { Kartei } from './Kartei';
import { Pipeline } from './Pipeline';
import { FollowUp } from './FollowUp';
import { Marketing } from './Marketing';
import { Events } from './Events';
import { Besuche } from './besuche/Besuche';
import { Stammdaten } from './Stammdaten';
import { SchnellErfassen } from './SchnellErfassen';
import { FehlerHinweis } from './FehlerHinweis';
import { Runden, type RundenArt } from './Runden';
import { Leads, SalesTrichter } from './Leads';
import { QualifizierungScoring } from './quali/QualifizierungScoring';
import { useZurueck, nachOben } from '../Verlauf';
import { KontaktAkte } from './Akte';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';
import { AngebotStart } from './angebot/AngebotStart';
import { MtPlanung } from './planung/Planung';
import { ZoeFragenKnopf } from './ZoeFragen';
import { zoeBezugFuer } from '@/lib/zoe/crm-bezug';
import { markttraktionHead } from '@/lib/agenten/kontext-head';
import { MARKE_EVENTS } from '@/lib/crm/marke';
import { Auswertung } from './Auswertung';
import { Formulare } from './formulare/Formulare';
import { BereichAutomationen } from '../werkzeug/BereichAutomationen';
import { MARKTTRAKTION_WERKZEUG } from '@/lib/make-one/werkzeuge';

// Die dritte Ebene (Reiter in der Seite): Deals und Follow-up hier, Events als EINE Zeile (Adressen in `EVENTS_REITER`); Qualifizierung, Marketing,
// Planung und Stammdaten tragen ihre Reiter selbst.
const DEALS: { id: DealsAnsicht; label: string }[] = [{ id: 'board', label: 'Board' }, { id: 'liste', label: 'Liste' }];
const FOLLOWUP: { id: FollowupAnsicht; label: string }[] = [{ id: 'faellig', label: 'Fällig' }, { id: 'woche', label: 'Woche' }, { id: 'powerhour', label: 'Power Hour' }, { id: 'kadenz', label: 'Kadenz' }];
const EVENTS_NAME: Record<EventsReiterId, string> = { kalender: 'Kalender', wirkung: 'Wirkung', kunden: 'Im Kundenauftrag', makeone: MARKE_EVENTS };
const EVENTS: { id: EventsReiterId; label: string }[] = EVENTS_REITER.map(r => ({ id: r.id, label: EVENTS_NAME[r.id] }));

// Untertitel: eine Zeile (Aufräumen Etappe 3) — was hier passiert, kein Werbesatz.
const UNTER: Record<Bereich, string> = {
  ueberblick: 'Sales, Marketing und Event als ein System — gemessen an Gesprächen und Deals.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Jedes Unternehmen mit allen Beziehungen.',
  deals: 'Ab SQL im Closing: jede Stufe endet mit einem Ereignis auf Kundenseite.',
  followup: 'Was heute dran ist — Zusagen, Wiedervorlagen, Kadenz, Power Hour.',
  qualifizierung: 'Lead für Lead bis zum SQL — mit den Scoring-Einstellungen von Marketing und Sales.',
  angebot: 'Angebot in einer Minute: Produkte anklicken, anpassen, senden.',
  planung: 'Vom Umsatzziel zu den Aktivitäten je Leadkanal und Woche — mit Kapazität und Challenges.',
  marketing: 'Ansprechbar sein, nicht laut.',
  besuche: 'Veranstaltungen, die wir besuchen: planen, vor Ort erfassen, auswerten.',
  event: 'Unsere eigenen Abende — gemessen an den Gesprächen danach.',
  stammdaten: 'Qualität, Wertelisten, Datenschutz, Import und Export.',
  auswertung: 'Der Weg vom Kontakt zum Kunden — mit Traktions-Index, Scoreboard, Kanälen und Pipeline.',
  automationen: 'Die Abläufe von Marketing, Sales und Übergabe — mit ihren Heads.',
  formulare: 'Angebot anfordern — für das Team und externe Vertriebler per Link, mit Eingängen und Einstellungen.',
};

export function MarkttraktionSeite() {
  const router = useRouter(); const params = useSearchParams();
  const { s: bereich, a: ansicht } = aufloesen(params.get('s'), params.get('a'));
  // Alte Adressen (Reiter „Sales“, Firmen › Leads, Deals › Kunden …) still auf den neuen Ort schreiben — so leuchtet der richtige Punkt
  // und Bausteine, die selbst in der Adresse lesen, sehen dieselbe Ansicht. Alle übrigen Parameter (k, t, u, r, bean …) bleiben.
  useEffect(() => {
    const rohS = params.get('s'), rohA = params.get('a');
    if ((rohS ?? 'ueberblick') === bereich && (rohA || undefined) === ansicht) return;
    const q = new URLSearchParams(params.toString());
    if (bereich === 'ueberblick') q.delete('s'); else q.set('s', bereich);
    if (ansicht) q.set('a', ansicht); else q.delete('a');
    router.replace(q.toString() ? `${PFAD}?${q}` : PFAD, { scroll: false });
  }, [params, bereich, ansicht, router]);
  // Welcher Punkt des Hubs gilt (deals&a=auswertung = Auswertung) — dieselbe Regel lässt den Punkt in der Werkzeug-Leiste leuchten.
  const hubOrt = punktVon({ s: bereich, a: ansicht });
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
  const zuDeal = (id: string) => gehe('deals', 'akte', id);
  const name = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '—');
  const dealsAnsicht = (bereich === 'deals' ? (ansicht ?? 'board') : 'board') as DealsAnsicht;
  const followupAnsicht = (bereich === 'followup' ? (ansicht ?? 'faellig') : 'faellig') as FollowupAnsicht;
  // Links auf ein BESUCHTES Event (Make.One-Adresse s=event&k=…, z. B. aus Kontaktakte, Deal, Verbindungsprüfung, ZOE) landen in der
  // Event-Akte unter „Events“ — der alte Weg bleibt gültig, nur der Ort ist der richtige (03.10.).
  const besuchsId = bereich === 'event' && kParam && api.crm?.stand.events.some(e => e.id === kParam && istBesuch(e)) ? kParam : null;
  // Der Parameter `r` (Reiter in der Event-Akte) geht bei der Umleitung mit — sonst landete ein Link „…&r=nachfassen“ auf dem Start der Akte.
  const rParam = params.get('r');
  useEffect(() => { if (besuchsId) router.replace(`${markttraktion('besuche', undefined, besuchsId)}${rParam ? `&r=${encodeURIComponent(rParam)}` : ''}`, { scroll: false }); }, [besuchsId, rParam, router]);
  const besuche = (bereich === 'besuche' ? (ansicht ?? 'kalender') : 'kalender') as BesucheAnsicht;
  // Events (22.10.): EINE Reiterzeile Kalender · Wirkung · Im Kundenauftrag · Make.One — keine vierte Ebene, die Adressen bleiben.
  const eventsReiter = eventsReiterVon({ s: bereich, a: ansicht });
  const eventsPillen = eventsReiter && <div style={{ overflowX: 'auto', scrollbarWidth: 'none', flex: '1 1 auto' }}><Pillen einzeilig farbe={WELT_FARBE.event} liste={EVENTS} aktiv={eventsReiter}
    onWahl={id => { const r = EVENTS_REITER.find(x => x.id === id); if (r) gehe(r.s, r.a); }} /></div>;
  // Aktivität hinzufügen — von überall in der Markttraktion, ein Knopf oben rechts (bis 28.09. „Gespräch festhalten“).
  const [erfassen, setErfassen] = useState(false);
  const runde = bereich === 'kontakte' && (ansicht === 'runde-kreis' || ansicht === 'runde-vernetzen') ? (ansicht.slice(6) as RundenArt) : null;
  // „Kontakt öffnen“ (Kevin 25.09., Name 28.09.): eigener Eintrag im Verlauf des Browsers — „Zurück“ dort führt ebenfalls in die Kartei.
  const akteId = bereich === 'kontakte' && ansicht === 'akte' ? kParam : null;
  const zuAkte = (id: string) => gehe('kontakte', 'akte', id);
  // „+ Angebot“ (22.10., statt des Schnellknopfs): steht im Kopf, solange eine Person, eine Firma oder ein Deal offen ist, und nimmt sie mit
  // (08.10., Woche 2 · 3.15). In den Runden trägt `k` eine Kampagne — dort kein „+ Angebot“.
  const angebotBezug = !!kParam && !runde && (bereich === 'kontakte' || bereich === 'firmen' || (bereich === 'deals' && ansicht === 'akte'));
  const neuesAngebot = () => { router.push(angebotVonHier(bereich, ansicht, kParam), { scroll: false }); nachOben(); };
  // Reiter (28.09.: Über · Aktivitäten · Umsatz · Daten): `t` und `u` in der Adresse, Wechsel ersetzt den Eintrag;
  // „Über“ steht nicht in der Adresse. Ein Anker (#akt-…) springt im Reiter Aktivitäten zur Quelle.
  const akteReiterSetzen = (t: AkteReiter, u?: string | null, anker?: string) => {
    if (!akteId) return;
    router.replace(`${kontaktAkte(akteId, t, u)}${anker ? `#${anker}` : ''}`, { scroll: false });
    // Der Reiter liest den Anker aus der Adresse; ein Hash-Ereignis weckt ihn auch, wenn er schon offen ist.
    if (anker) setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 60);
  };

  return (
    // „+ Aktivität hinzufügen“ steht neben dem Titel — so ist er auch am Handy immer sichtbar.
    <Seite titel="Markttraktion" unter={UNTER[bereich]} rechts={<>
      {/* „ZOE fragen“ (28.09., C7): mit dem, was gerade offen ist (Kontakt, Firma, Deal, Angebot) oder dem Bereich — ZOE liest selbst nach, schlägt nur vor. */}
      {/* Seit 10.10. (Chat je Bereich): „Mit <Head> sprechen“ — der Head des Bereichs (Sales, Marketing, Event) im Chat unten; „↔ ZOE“ wechselt dort. */}
      <ZoeFragenKnopf bezug={zoeBezugFuer(bereich, ansicht, kParam)} headId={markttraktionHead(`?s=${bereich}`)} />
      {angebotBezug && <Knopf onClick={neuesAngebot} ariaLabel="Angebot für diese Akte anlegen" style={{ whiteSpace: 'nowrap' }}>+ Angebot</Knopf>}
      {/* „+ Aktivität hinzufügen“ steht neben dem Titel — so ist er auch am Handy immer sichtbar (am Handy kürzer: „+ Aktivität“). */}
      <Knopf onClick={() => setErfassen(true)} ariaLabel="Aktivität hinzufügen" style={{ whiteSpace: 'nowrap' }}><span>+ Aktivität<span className="ui-nur-breit"> hinzufügen</span></span></Knopf>
    </>}>
      <SchnellErfassen api={api} offen={erfassen} onZu={() => setErfassen(false)} kontaktId={bereich === 'kontakte' && auswahl && !auswahl.startsWith('f-') ? auswahl : undefined} />
      {/* Meldungen (K1): fixiert unten, bleiben stehen bis weggeklickt / ~8 s / nächstes Schreiben — nicht mehr oben als Zeile, die das Laden löschte. */}
      <FehlerHinweis text={api.fehler} onZu={fehlerZu} />
      <FehlerHinweis text={api.hinweis} onZu={hinweisZu} ton="info" bleibt />

      {/* Antwort zuerst (11.10.): „Für dich“ und was zu tun ist oben — die Index-Kennzahlen (oft noch „fehlt“) als Hintergrund darunter. */}
      {bereich === 'ueberblick' && <Ueberblick api={api} zuBereich={zuBereich} />}
      {bereich === 'ueberblick' && <IndexStreifen ids={STREIFEN.markttraktion} titel="Business-Score · Markttraktion" />}

      {/* Auswertung (22.10., eigener Punkt): der Flow vom Kontakt zum Kunden und alle Kennzahlen — die alte Adresse deals&a=auswertung zeigt dasselbe. */}
      {hubOrt === 'auswertung' && <Auswertung api={api} zuBereich={zuBereich} zuDeal={zuDeal} />}
      {/* „Automationen & Head“ (Werkzeug-Muster): die Prozesse von Marketing, Sales und Übergabe mit den Heads Sales, Marketing und Event. */}
      {hubOrt === 'automationen' && <BereichAutomationen werkzeug={MARKTTRAKTION_WERKZEUG} />}

      {bereich === 'deals' && hubOrt === 'deals' && (
        <>
          {dealsAnsicht !== 'akte' && <div><Pillen einzeilig farbe={WELT_FARBE.sales} liste={DEALS} aktiv={dealsAnsicht} onWahl={a => gehe('deals', a === 'board' ? undefined : a)} /></div>}
          <Pipeline api={api} ansicht={dealsAnsicht} zuKontakt={zuKontakt} zuLeads={() => gehe('qualifizierung', 'leads')} zuAkte={zuDeal} zurueck={() => zurueckWie(markttraktion('deals'))} zuOffen={params.get('zu') === '1'} />
        </>
      )}
      {bereich === 'followup' && (
        <>
          <div><Pillen einzeilig farbe={WELT_FARBE.sales} liste={FOLLOWUP} aktiv={followupAnsicht} onWahl={a => gehe('followup', a === 'faellig' ? undefined : a)} /></div>
          {followupAnsicht === 'powerhour' && <Heute api={api} name={name} zuKontakt={zuKontakt} />}
          {followupAnsicht !== 'powerhour' && <FollowUp api={api} ansicht={followupAnsicht} zuKontakt={zuKontakt} zuDeal={zuDeal} zuAkte={zuAkte} />}
        </>
      )}
      {bereich === 'planung' && <MtPlanung ansicht={(ansicht ?? 'kreislauf') as PlanungAnsicht} kanal={params.get('kanal')} onOrt={(a, k) => { router.push(planungLink(a, k), { scroll: false }); if (a !== (ansicht ?? 'kreislauf')) nachOben(); }} />}
      {bereich === 'angebot' && <AngebotStart api={api} {...angebotAusAdresse(params)} zuKontakt={zuKontakt} zuDeal={zuDeal} />}
      {bereich === 'qualifizierung' && <QualifizierungScoring api={api} ansicht={(ansicht ?? 'runde') as QualiAnsicht} start={kParam} onAnsicht={a => gehe('qualifizierung', a === 'runde' ? undefined : a, kParam ?? undefined, 'replace')} zuLeads={id => gehe('qualifizierung', 'leads', id)}
        leads={<><SalesTrichter api={api} zuBereich={zuBereich} /><Leads api={api} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} /></>} />}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('marketing', a === 'uebersicht' ? undefined : a)} />}
      {bereich === 'besuche' && <Besuche api={api} zuKontakt={zuKontakt} zuFirma={zuFirma} ansicht={besuche} k={kParam} reiter={eventsPillen} onAkte={(id, wie) => gehe('besuche', undefined, id ?? undefined, wie ?? (id ? 'push' : 'replace'))} />}
      {bereich === 'event' && !besuchsId && !kParam && <div>{eventsPillen}</div>}
      {bereich === 'event' && !besuchsId && <Events api={api} zuKontakt={zuKontakt} start={params.get('k') ?? undefined} onAuswahl={(id, wie) => gehe('event', undefined, id ?? undefined, wie)} />}

      {runde && <Runden api={api} art={runde} name={name} zuKontakt={zuKontakt} zurueck={() => zurueckWie(markttraktion('kontakte'))}
        kampagneId={kParam?.startsWith('kp-') ? kParam : undefined} zuKampagne={id => gehe('kontakte', 'runde-vernetzen', id ?? undefined, 'replace')} />}
      {akteId && <KontaktAkte api={api} id={akteId} name={name} zurueck={() => zurueckWie(markttraktion('kontakte', undefined, akteId))} zuFirma={zuFirma} zuAkte={zuAkte} t={params.get('t')} u={params.get('u')} setReiter={akteReiterSetzen} />}
      {!runde && !akteId && (bereich === 'kontakte' || bereich === 'firmen') && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht === 'akte' ? undefined : ansicht} zuRunde={a => (a === 'chancen' ? gehe('qualifizierung') : gehe('kontakte', `runde-${a}`))} zuAkte={zuAkte} startBean={params.get('bean')} />}
      {bereich === 'formulare' && <Formulare api={api} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('stammdaten', a || undefined)} />}
    </Seite>
  );
}
