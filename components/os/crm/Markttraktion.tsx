'use client';

// ─── MAKE OS — Markttraktion (25.09., Reiter neu 27.09., aufgeräumt 08.10.) ──
// Kevin: „alles, was unter dem CRM läuft — Sales, Marketing, Event — heißt Markttraktion.“ Aufräumen Etappe 3 (08.10., Kevin: „Die
// Software wirkt unaufgeräumt und überladen.“): sechs Reiter statt zwölf, jede Unteransicht genau einmal (Liste: lib/crm/adresse.ts):
//   Überblick           Traktions-Index, Für dich, Team, Übergaben, was jetzt zu tun ist
//   Kontakte & Firmen   Personen · Firmen (Kartei, Runden, „Kontakt öffnen“, Firmenkarte)
//   Deals               Board · Liste · Auswertung (Kanal-Leistung, Kunden kurz, Pipeline) — ab SQL im Closing, Head of Sales am Board
//   Follow-up           Fällig · Woche · Power Hour · Kadenz
//   Marketing           Übersicht · Anfragen · Segmente · Kampagnen · Redaktionsplan · Newsletter · Positionierung — Head of Marketing
//   Events              Besuchte Events (Kalender · Wirkung · Im Kundenauftrag, Event-Akte) · Make.One (unsere eigenen Abende)
// In der Mitte die zwei Schnellknöpfe, leise pulsierend: Qualifizierung (Runde · Leads · Scoring) und Angebot. Die Stammdaten
// (Qualität, Wertelisten, Datenschutz, Import & Export) öffnet das Zahnrad oben rechts. Alte Adressen (Reiter „Sales“, Firmen › Leads,
// Deals › Kunden …) übersetzt `aufloesen` und die Seite schreibt sie still auf den neuen Ort um.
// Das Grundkonzept stammt aus der Markttraktion in KEMARIS Operations; die Daten sind ausschließlich unsere eigenen. Technisch heißt
// die Datenschicht weiter „crm“ (lib/crm, /api/crm) — das ist die Kartei darunter, nicht der Name.

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TIEF } from '@/lib/make-one/design';
import { Settings } from 'lucide-react';
import { Seite, Knopf, SymbolKnopf, Reiter as ReiterLeiste, LEUCHT } from '../ui';
import { aufloesen, markttraktion, kontaktAkte, angebotAusAdresse, REITER_ZEILE, reiterVon, reiterStart, PFAD, type Bereich, type ReiterId, type DealsAnsicht, type FollowupAnsicht, type AkteReiter, type BesucheAnsicht, type QualiAnsicht } from '@/lib/crm/adresse';
import { istBesuch } from '@/lib/crm/besuche-form';
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
import { Besuche } from './besuche/Besuche';
import { Stammdaten } from './Stammdaten';
import { SchnellErfassen } from './SchnellErfassen';
import { FehlerHinweis } from './FehlerHinweis';
import { Runden, type RundenArt } from './Runden';
import { Leads, SalesTrichter } from './Leads';
import { KanalLeistungLaden } from './Qualifizierung';
import { QualifizierungScoring } from './quali/QualifizierungScoring';
import { useZurueck, nachOben } from '../Verlauf';
import { KontaktAkte } from './Akte';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';
import { AngebotStart } from './angebot/AngebotStart';
import { ZoeFragenKnopf } from './ZoeFragen';
import { zoeBezugFuer } from '@/lib/zoe/crm-bezug';

// Die Reiterzeile (Aufräumen Etappe 3, 08.10.): links die Arbeit, in der Mitte die Schnellknöpfe, rechts die Welten Marketing und
// Events. Reihenfolge und Zuordnung stehen in `REITER_ZEILE` (lib/crm/adresse.ts).
const REITER_NAME: Record<ReiterId, { label: string; farbe?: string }> = {
  ueberblick: { label: 'Überblick' },
  kontakte: { label: 'Kontakte & Firmen' },
  deals: { label: 'Deals', farbe: WELT_FARBE.sales },
  followup: { label: 'Follow-up' },
  marketing: { label: 'Marketing', farbe: WELT_FARBE.marketing },
  events: { label: 'Events', farbe: WELT_FARBE.event },
};
const SCHNELL_NAME: Partial<Record<Bereich, { label: string; farbe: string }>> = {
  qualifizierung: { label: 'Qualifizierung & Scoring', farbe: LEUCHT.business },
  angebot: { label: 'Angebot', farbe: LEUCHT.gut },
};
const eintrag = (r: { id: ReiterId }) => ({ id: r.id, ...REITER_NAME[r.id] });
const LINKS = REITER_ZEILE.links.map(eintrag);
const RECHTS = REITER_ZEILE.rechts.map(eintrag);
const MITTE = REITER_ZEILE.mitte.map(b => ({ id: b, label: SCHNELL_NAME[b]?.label ?? b, farbe: SCHNELL_NAME[b]?.farbe }));
const DEALS: { id: DealsAnsicht; label: string }[] = [{ id: 'board', label: 'Board' }, { id: 'liste', label: 'Liste' }, { id: 'auswertung', label: 'Auswertung' }];
const FOLLOWUP: { id: FollowupAnsicht; label: string }[] = [{ id: 'faellig', label: 'Fällig' }, { id: 'woche', label: 'Woche' }, { id: 'powerhour', label: 'Power Hour' }, { id: 'kadenz', label: 'Kadenz' }];
const KONTAKTE: { id: Bereich; label: string }[] = [{ id: 'kontakte', label: 'Personen' }, { id: 'firmen', label: 'Firmen' }];
const EVENTS: { id: Bereich; label: string }[] = [{ id: 'besuche', label: 'Besuchte Events' }, { id: 'event', label: 'Make.One' }];

// Untertitel: eine Zeile (Aufräumen Etappe 3) — was hier passiert, kein Werbesatz.
const UNTER: Record<Bereich, string> = {
  ueberblick: 'Sales, Marketing und Event als ein System — gemessen an Gesprächen und Deals.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Jedes Unternehmen mit allen Beziehungen.',
  deals: 'Ab SQL im Closing: jede Stufe endet mit einem Ereignis auf Kundenseite.',
  followup: 'Was heute dran ist — Zusagen, Wiedervorlagen, Kadenz, Power Hour.',
  qualifizierung: 'Lead für Lead bis zum SQL — mit den Scoring-Einstellungen von Marketing und Sales.',
  angebot: 'Angebot in einer Minute: Produkte anklicken, anpassen, senden.',
  marketing: 'Ansprechbar sein, nicht laut.',
  besuche: 'Veranstaltungen, die wir besuchen: planen, vor Ort erfassen, auswerten.',
  event: 'Make.One: unsere eigenen Abende — gemessen an den Gesprächen danach.',
  stammdaten: 'Qualität, Wertelisten, Datenschutz, Import und Export.',
};

/** Eine Gruppe Reiter der Leiste (Standard-Baustein `Reiter`); `leise` = die zweite Gruppe (Welten) mit eigener Rahmung. */
function Reiter({ liste, aktiv, onWahl, leise }: { liste: { id: ReiterId; label: string; farbe?: string }[]; aktiv: ReiterId | null; onWahl: (r: ReiterId) => void; leise?: boolean }) {
  return <ReiterLeiste liste={liste} aktiv={aktiv} onWahl={onWahl} gruppe={leise} />;
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
              padding: '8px 16px', minHeight: 40, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 700,
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
  // Alte Adressen (Reiter „Sales“, Firmen › Leads, Deals › Kunden …) still auf den neuen Ort schreiben — so leuchtet der richtige Reiter
  // und Bausteine, die selbst in der Adresse lesen, sehen dieselbe Ansicht. Alle übrigen Parameter (k, t, u, r, bean …) bleiben.
  useEffect(() => {
    const rohS = params.get('s'), rohA = params.get('a');
    if ((rohS ?? 'ueberblick') === bereich && (rohA || undefined) === ansicht) return;
    const q = new URLSearchParams(params.toString());
    if (bereich === 'ueberblick') q.delete('s'); else q.set('s', bereich);
    if (ansicht) q.set('a', ansicht); else q.delete('a');
    router.replace(q.toString() ? `${PFAD}?${q}` : PFAD, { scroll: false });
  }, [params, bereich, ansicht, router]);
  const reiter = reiterVon(bereich);
  const api = useCrm();
  const leiste = useRef<HTMLElement>(null);
  // Der aktive Reiter bleibt im sichtbaren Ausschnitt der wischbaren Leiste (am Handy sonst oft ausgeblendet; nur waagerecht, die Seite scrollt nicht mit).
  useEffect(() => {
    const n = leiste.current; const el = n?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!n || !el) return;
    const a = el.getBoundingClientRect(); const z = n.getBoundingClientRect();
    if (a.left < z.left + 8 || a.right > z.right - 8) n.scrollTo({ left: n.scrollLeft + (a.left - z.left) - 16, behavior: 'smooth' });
  }, [bereich]);
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
  // Links auf ein BESUCHTES Event (Make.One-Adresse s=event&k=…, z. B. aus Kontaktakte, Deal, Verbindungsprüfung, ZOE) landen in der
  // Event-Akte unter „Events“ — der alte Weg bleibt gültig, nur der Ort ist der richtige (03.10.).
  const besuchsId = bereich === 'event' && kParam && api.crm?.stand.events.some(e => e.id === kParam && istBesuch(e)) ? kParam : null;
  // Der Parameter `r` (Reiter in der Event-Akte) geht bei der Umleitung mit — sonst landete ein Link „…&r=nachfassen“ auf dem Start der Akte.
  const rParam = params.get('r');
  useEffect(() => { if (besuchsId) router.replace(`${markttraktion('besuche', undefined, besuchsId)}${rParam ? `&r=${encodeURIComponent(rParam)}` : ''}`, { scroll: false }); }, [besuchsId, rParam, router]);
  const besuche = (bereich === 'besuche' ? (ansicht ?? 'kalender') : 'kalender') as BesucheAnsicht;
  // Aktivität hinzufügen — von überall in der Markttraktion, ein Knopf oben rechts (bis 28.09. „Gespräch festhalten“).
  const [erfassen, setErfassen] = useState(false);
  const runde = bereich === 'kontakte' && (ansicht === 'runde-kreis' || ansicht === 'runde-vernetzen') ? (ansicht.slice(6) as RundenArt) : null;
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
    <Seite titel="Markttraktion" unter={UNTER[bereich]} rechts={<>
      {/* „ZOE fragen“ (28.09., C7): mit dem, was gerade offen ist (Kontakt, Firma, Deal, Angebot) oder dem Reiter — ZOE liest selbst nach, schlägt nur vor. */}
      <ZoeFragenKnopf bezug={zoeBezugFuer(bereich, ansicht, kParam)} />
      {/* „+ Aktivität hinzufügen“ steht neben dem Titel — so ist er auch am Handy immer sichtbar (am Handy kürzer: „+ Aktivität“). */}
      <Knopf onClick={() => setErfassen(true)} ariaLabel="Aktivität hinzufügen" style={{ whiteSpace: 'nowrap' }}><span>+ Aktivität<span className="ui-nur-breit"> hinzufügen</span></span></Knopf>
      {/* Stammdaten (Qualität, Wertelisten, Datenschutz, Import & Export) — seit 08.10. hinter dem Zahnrad statt als Reiter. */}
      <SymbolKnopf ariaLabel="Stammdaten der Markttraktion" titel="Stammdaten: Qualität, Wertelisten, Datenschutz, Import & Export" onClick={() => gehe(REITER_ZEILE.zahnrad)}><Settings size={18} aria-hidden /></SymbolKnopf>
    </>}>
      {/* Breit: eine Zeile, die Schnellknöpfe mittig zwischen links und rechts. Wird es zu eng (Rahmen < 1100 px, z. B. am
          Laptop mit Leiste oder am Handy): die Schnellknöpfe als eigene Zeile oben, darunter die Reiter zum Wischen — nie
          zwei Paare sichtbar zugleich (das andere ist display:none, also auch für Screenreader weg). */}
      <div className="mt-leistenrahmen">
        <Schnellknoepfe aktiv={bereich} onWahl={b => gehe(b)} className="mt-schnellzeile mt-nur-schmal" />
        <nav aria-label="Markttraktion" ref={leiste} className="ui-reiter-zeile mt-leiste">
          <Reiter liste={LINKS} aktiv={reiter} onWahl={r => gehe(reiterStart(r))} />
          <span aria-hidden style={{ flex: '1 0 8px' }} />
          <Schnellknoepfe aktiv={bereich} onWahl={b => gehe(b)} className="mt-schnellmitte mt-nur-breit" />
          <span aria-hidden className="mt-nur-breit" style={{ flex: '1 0 8px' }} />
          <Reiter liste={RECHTS} aktiv={reiter} onWahl={r => gehe(reiterStart(r))} leise />
        </nav>
      </div>
      <SchnellErfassen api={api} offen={erfassen} onZu={() => setErfassen(false)} kontaktId={bereich === 'kontakte' && auswahl && !auswahl.startsWith('f-') ? auswahl : undefined} />
      {/* Meldungen (K1): fixiert unten, bleiben stehen bis weggeklickt / ~8 s / nächstes Schreiben — nicht mehr oben als Zeile, die das Laden löschte. */}
      <FehlerHinweis text={api.fehler} onZu={fehlerZu} />
      <FehlerHinweis text={api.hinweis} onZu={hinweisZu} ton="info" bleibt />

      {(bereich === 'kontakte' || bereich === 'firmen') && !akteId && !runde && <div><Pillen einzeilig liste={KONTAKTE} aktiv={bereich} onWahl={b => gehe(b)} /></div>}
      {(bereich === 'besuche' || bereich === 'event') && !kParam && <div><Pillen einzeilig farbe={WELT_FARBE.event} liste={EVENTS} aktiv={bereich} onWahl={b => gehe(b)} /></div>}
      {bereich === 'ueberblick' && <IndexStreifen ids={STREIFEN.markttraktion} titel="Business-Index · Markttraktion" />}
      {bereich === 'ueberblick' && <Ueberblick api={api} zuBereich={zuBereich} />}

      {bereich === 'deals' && (
        <>
          {dealsAnsicht !== 'akte' && <div><Pillen einzeilig farbe={WELT_FARBE.sales} liste={DEALS} aktiv={dealsAnsicht} onWahl={a => gehe('deals', a === 'board' ? undefined : a)} /></div>}
          {/* Auswertung (08.10.): Kanal-Leistung (vorher Sales › Auswertung), Kunden kurz (vorher Deals › Kunden), dann die Pipeline-Auswertung. */}
          {dealsAnsicht === 'auswertung' && <KanalLeistungLaden i={0} mitTemperatur />}
          {dealsAnsicht === 'auswertung' && <KundenKurz api={api} />}
          <Pipeline api={api} ansicht={dealsAnsicht} zuKontakt={zuKontakt} zuLeads={() => gehe('qualifizierung', 'leads')} zuAkte={id => gehe('deals', 'akte', id)} zurueck={() => zurueckWie(markttraktion('deals'))} />
        </>
      )}
      {bereich === 'followup' && (
        <>
          <div><Pillen einzeilig farbe={WELT_FARBE.sales} liste={FOLLOWUP} aktiv={followupAnsicht} onWahl={a => gehe('followup', a === 'faellig' ? undefined : a)} /></div>
          {followupAnsicht === 'powerhour' && <Heute api={api} name={name} zuKontakt={zuKontakt} />}
          {followupAnsicht !== 'powerhour' && <FollowUp api={api} ansicht={followupAnsicht} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} zuAkte={zuAkte} />}
        </>
      )}
      {bereich === 'angebot' && <AngebotStart api={api} {...angebotAusAdresse(params)} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} />}
      {bereich === 'qualifizierung' && <QualifizierungScoring api={api} ansicht={(ansicht ?? 'runde') as QualiAnsicht} start={kParam} onAnsicht={a => gehe('qualifizierung', a === 'runde' ? undefined : a, kParam ?? undefined, 'replace')} zuLeads={id => gehe('qualifizierung', 'leads', id)}
        leads={<><SalesTrichter api={api} zuBereich={zuBereich} /><Leads api={api} zuKontakt={zuKontakt} zuDeal={id => gehe('deals', 'akte', id)} /></>} />}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('marketing', a === 'uebersicht' ? undefined : a)} />}
      {bereich === 'besuche' && <Besuche api={api} zuKontakt={zuKontakt} zuFirma={zuFirma} ansicht={besuche} k={kParam} onAnsicht={a => gehe('besuche', a === 'kalender' ? undefined : a)} onAkte={(id, wie) => gehe('besuche', undefined, id ?? undefined, wie ?? (id ? 'push' : 'replace'))} />}
      {bereich === 'event' && !besuchsId && <Events api={api} zuKontakt={zuKontakt} start={params.get('k') ?? undefined} onAuswahl={(id, wie) => gehe('event', undefined, id ?? undefined, wie)} />}

      {runde && <Runden api={api} art={runde} name={name} zuKontakt={zuKontakt} zurueck={() => zurueckWie(markttraktion('kontakte'))}
        kampagneId={kParam?.startsWith('kp-') ? kParam : undefined} zuKampagne={id => gehe('kontakte', 'runde-vernetzen', id ?? undefined, 'replace')} />}
      {akteId && <KontaktAkte api={api} id={akteId} name={name} zurueck={() => zurueckWie(markttraktion('kontakte', undefined, akteId))} zuFirma={zuFirma} zuAkte={zuAkte} t={params.get('t')} u={params.get('u')} setReiter={akteReiterSetzen} />}
      {!runde && !akteId && (bereich === 'kontakte' || bereich === 'firmen') && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht === 'akte' ? undefined : ansicht} zuRunde={a => (a === 'chancen' ? gehe('qualifizierung') : gehe('kontakte', `runde-${a}`))} zuAkte={zuAkte} startBean={params.get('bean')} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} onAnsicht={a => gehe('stammdaten', a || undefined)} />}
    </Seite>
  );
}
