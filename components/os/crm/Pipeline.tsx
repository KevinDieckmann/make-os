'use client';

// ─── Markttraktion · Deals (Ebene 2) — Board, Liste, Akte und Auswertung, ab SQL ──────────────────────────────
// Oben die Prognose (offen, gewichtet, Commit, Best Case) — jede Zahl mit
// Herleitung. Darunter die Stufen mit ihrem Austrittskriterium: Eine Chance
// rückt vor, wenn auf Kundenseite etwas passiert ist, nicht wenn wir hoffen.
// Zu zweit (25.09.): Filter „Alle · Meins · Malin“, an jeder Chance die
// Plakette der Person, die sie führt (besitzer), Prognose und hängende
// Chancen je Person. Änderungen gehen als Einzelfelder (api.teil) raus, damit
// sich Kevin und Malin an derselben Chance nichts überschreiben.

// 04.10. (Kevin: „alles anpassbar“): jeder Deal (Liste und Board) am Baustein `ZeileAktionen`. Archiv heißt bei Deals
// parken (Wiedervorlage) oder verloren (Grund) — die Rückfrage bietet beides, „Zurückholen“ öffnet einen geschlossenen Deal
// wieder auf seiner letzten offenen Stufe (Server-Regel: nächster Schritt mit Datum). Löschen nur eine Fehlanlage (ohne
// Geschichte, Wert, Notiz) nach Rückfrage — ein Deal mit Geschichte wird nie gelöscht (Server-Regel `dealRegeln`).
import { useLinkAuswahl } from '../Verlauf';
import { qualifizierungLink } from '@/lib/crm/adresse';
import { WEG, eventLink } from '@/lib/wege';
import { zoeFragen } from './ZoeFragen';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { suchPasst } from '@/lib/text/such-norm';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Punkt, Zahl, Raster, useBreit, LEUCHT, FadenLinie, ZeileAktionen, useRueckgaengig, useRueckfrage, Arbeitsflaeche, FilterKnopf, FilterGruppe, ListenAbschnitt, Klappbar, feld, type ZeilenMehr } from '../ui';
import { monatBeschriftung } from '@/lib/lichtfaeden/reihen';
import { prognoseJeMonat } from './fokus-reihen';
import { anzeigename } from '@/lib/make-one/crm';
import { gesamtwert, dealWertText, geplanterMonatswert, prognose, prognoseJePerson, werZahlen, verlustgruende, dealsOhneWert, WIN_RATE_TEXT } from '@/lib/crm/pipeline';
import { dealWertAusProdukt } from '@/lib/crm/produkt-karte';
import { zustaendig, mitglied, nameVon, verantwortlich } from '@/lib/crm/team';
import type { Chance, ChancenStufe, Qual } from '@/lib/crm/typen';
import { type CrmApi, datum, euro, kurzEuro, plusTage, nurFelder } from './daten';
import { Feldzeile, Pillen, Feld } from './teile';
import { Wahl } from './Wahl';
import { GesellschaftWahl } from './GesellschaftWahl';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';
import { DealAnlegen } from './DealAnlegen';
import { DealAkte, DealAuswertung } from './DealAkte';
import { FallAmDeal } from '../fulfillment/prozesse/FallAmDeal';
import { firmenName } from '@/lib/crm/firmen-bezug';
import { winLoss } from '@/lib/crm/deal-auswertung';
import type { DealsAnsicht } from '@/lib/crm/adresse';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { sqlRegelText, standardZumRechnen } from '@/lib/crm/scoring';
import { leadZeileFuer } from '@/lib/crm/leads';

import { tagVon } from '@/lib/zeit';
const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const ARTEN = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }] as const;
const QUELLEN = [{ id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'outreach', label: 'Ansprache' }, { id: 'bestand', label: 'Bestand' }, { id: 'inbound', label: 'Anfrage' }] as const;
const QUAL: { id: keyof Chance['qualifizierung']; label: string }[] = [
  { id: 'schmerz', label: 'Schmerz' }, { id: 'entscheider', label: 'Entscheider' }, { id: 'budget', label: 'Budget' }, { id: 'zeitpunkt', label: 'Zeitpunkt' }, { id: 'wirkung', label: 'Wirkung' }, { id: 'alternative', label: 'Alternative' },
];
const BASEN = [{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }] as const;
// 24.10.: EINE Stelle (`dealWertText`) — mit Einmal-Anteil „900 €/M + 1.500 €“.
const wertText = (c: Chance) => dealWertText(c, { kurz: true });

export function Pipeline({ api, ansicht = 'board', zuKontakt, zuLeads, zuAkte, zurueck, zuOffen, kopf, ansichtWahl }: { api: CrmApi; ansicht?: DealsAnsicht; zuKontakt: (id: string) => void; /** Ebene 1 — wer im Gespräch ist, wird erst dort qualifiziert. */ zuLeads?: () => void; /** Deal-Akte öffnen (27.09.). */ zuAkte?: (id: string) => void; zurueck?: () => void; /** „Gewonnen · Verloren · Geparkt“ aufgeklappt öffnen (Adresse `zu=1`, z. B. aus dem Flow der Auswertung, 22.10.). */ zuOffen?: boolean;
  /** Arbeitsfläche der Liste (31.10.): Kopf-Teile der Seite (ZOE/Head daneben, „+ Aktivität“ im „⋯“) und der Umschalter Board · Liste in der Filterzeile. */
  kopf?: { neben?: ReactNode; mehr?: ReactNode }; ansichtWahl?: ReactNode }) {
  // Offener Deal im Link (k): Zurück schließt ihn wieder.
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const [geschlossen, setGeschlossen] = useState(!!zuOffen);
  // Aus dem Flow der Auswertung (22.10.): die aufgeklappte Karte kommt ins Bild.
  const geladen = !!api.crm;
  useEffect(() => { if (zuOffen && geladen) document.getElementById('deals-geschlossen')?.scrollIntoView({ block: 'start' }); }, [zuOffen, geladen]);
  const breit = useBreit();
  const board = ansicht !== 'liste';
  // Deal anlegen: ein Dialog für alle Wege (27.09.).
  const [anlegen, setAnlegen] = useState<{ kontaktId?: string; besitzer?: string } | null>(null);
  const [wunsch, setWunsch] = useState<{ id: string; ziel: ChancenStufe } | null>(null);
  const [alleVorschlaege, setAlleVorschlaege] = useState(false);
  const [wahl, setWahl] = useWerFilter('pipeline');
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  // Liste als Arbeitsfläche (31.10.): Suche und Stufe nur für die Liste — das Board zeigt weiter alle offenen Deals.
  const [suche, setSuche] = useState('');
  const [stufeFilter, setStufeFilter] = useState<ChancenStufe | 'alle'>('alle');
  // In EINER Spalte (schmal, Handy) stehen Prognose und Head zugeklappt über der Liste — sonst schiebt die große Karte die Deals aus dem Bild.
  const [prognoseOffen, setPrognoseOffen] = useState(false);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const ich = api.ich;
  const offen = crm.stufen.filter(s => s.offen);
  const istOffen = (c: Chance) => offen.some(s => s.id === c.stufe);
  // Filter „Alle · Meins · Malin“ — die Prognose rechnet für die Auswahl, die Zeile je Person immer für alle.
  const passt = (c: Chance) => passtWer(wahl, c.besitzer, 'sales', ich);
  const chancen = crm.stand.chancen.filter(passt);
  const zahlen = werZahlen(crm.stand.chancen.filter(istOffen), c => c.besitzer, 'sales', ich);
  const p = wahl === 'alle' ? crm.prognose : prognose(chancen, crm.heute, crm.stand.wahrscheinlichkeiten);
  const jePerson = prognoseJePerson(crm.stand.chancen, crm.heute, crm.stand.wahrscheinlichkeiten);
  const ohneWert = dealsOhneWert(chancen);
  // Eine Definition für die Win Rate überall (Auswertung, Kennzahl, hier): Fenster, Mindestzahl und Texte aus `WIN_RATE` (2.14).
  const wl = winLoss(crm.stand.chancen, crm.heute);
  const meine = ich ? jePerson.find(x => x.person === ich) : undefined;
  // Fokus-Signatur (04.10.): die gewichteten erwarteten Abschlüsse der nächsten sechs Monate (Auswahl wie die Prognose).
  const jeMonat = prognoseJeMonat(api, chancen, 6);
  // Neue Chance: für die gefilterte Person, sonst für mich (im Team), sonst die Sales-Verantwortung.
  const neuFuer = wahl !== 'alle' && wahl !== 'ich' && mitglied(wahl) ? wahl : mitglied(ich)?.id ?? verantwortlich('sales');
  // 2.9 (08.10.): „+ Deal für <Person>“ gibt diese Person als „führt“ mit — vorher entschied der Server still anders.
  const neu = () => setAnlegen({ besitzer: neuFuer });
  // Ein geschlossener Deal aus einem Link (z. B. hinter der Win Rate) wird gezeigt, auch wenn der Filter ihn sonst verbirgt.
  const gewaehlt = auswahl ? crm.stand.chancen.find(c => c.id === auswahl) : undefined;
  const zu = [...chancen.filter(c => !istOffen(c)), ...(gewaehlt && !istOffen(gewaehlt) && !passt(gewaehlt) ? [gewaehlt] : [])];
  const zeigeZu = geschlossen || (!!gewaehlt && !istOffen(gewaehlt));
  // Aus der Kartei: wer laut Masterdatei im Gespräch ist oder ein Angebot hat, aber noch keine Chance.
  const mitChance = new Set(crm.stand.chancen.flatMap(c => c.kontaktIds));
  const vorschlaege = (api.kontakte ?? []).filter(k => ['gespraech', 'termin', 'angebot'].includes(k.stufe) && !mitChance.has(k.id) && !ausgenommen(k) && passtWer(wahl, k.besitzer, 'sales', ich))
    .sort((a, b) => (a.stufe === 'angebot' ? 0 : 1) - (b.stufe === 'angebot' ? 0 : 1));
  // Die Chance führt, wer die Beziehung hält — im Gespräch ist ja sie/er.
  const ausKontakt = (k: NonNullable<CrmApi['kontakte']>[number]) => setAnlegen({ kontaktId: k.id, ...(k.besitzer && k.besitzer !== 'beide' ? { besitzer: k.besitzer } : {}) });

  if (ansicht === 'akte' && auswahl) return <DealAkte api={api} id={auswahl} zuKontakt={zuKontakt} zurueck={() => (zurueck ? zurueck() : setAuswahl(null))} />;
  if (ansicht === 'auswertung') return <DealAuswertung api={api} zuAkte={id => (id ? zuAkte?.(id) : zurueck?.())} />;
  // Ziehen im Board (27.09.): auf eine offene Stufe → Stufenwechsel (der Server prüft den nächsten Schritt); auf Gewonnen/Verloren/Geparkt → Detail mit Nachfrage.
  const zieheNach = (id: string, ziel: ChancenStufe) => {
    const c = crm.stand.chancen.find(x => x.id === id);
    if (!c || c.stufe === ziel) return;
    if (ziel === 'verloren' || ziel === 'geparkt') { setAuswahl(id); setWunsch({ id, ziel }); return; }
    // Offene Zielstufe braucht einen nächsten Schritt mit Datum vor sich (Server-Regel) — sonst die Karte öffnen und sagen, was fehlt.
    if (offen.some(s => s.id === ziel) && !(c.naechsterSchritt && c.naechsterSchritt.datum >= crm.heute)) {
      setAuswahl(id);
      api.setFehler(c.naechsterSchritt ? `„${c.titel}“: der nächste Schritt vom ${datum(c.naechsterSchritt.datum)} ist überfällig — unten ein neues Datum setzen, dann die Stufe wechseln.` : `„${c.titel}“: erst einen nächsten Schritt mit Datum festhalten, dann die Stufe wechseln.`);
      return;
    }
    // 2.16 (09.10.): „Rückgängig“ wie beim Parken — die alte Stufe hat ihren Schritt noch (eben geprüft), der Server nimmt sie zurück.
    const vorher = c.stufe;
    void api.teil('chancen', id, { stufe: ziel });
    melden(`„${c.titel}“ → ${crm.stufen.find(s => s.id === ziel)?.label ?? ziel}`, () => void api.teil('chancen', id, { stufe: vorher }));
  };
  // ── Archivieren · Zurückholen · Löschen (04.10.) ──
  const fehlanlage = (c: Chance) => c.historie.length <= 1 && !c.wert.betrag && !(c.notiz ?? '').trim();
  const verlorenFragen = (c: Chance) => { setAuswahl(c.id); setWunsch({ id: c.id, ziel: 'verloren' }); };
  const parken = (c: Chance) => {
    const vorher = c.stufe, bis = plusTage(crm.heute, 60);
    if (auswahl === c.id) setAuswahl(null);
    void api.teil('chancen', c.id, { stufe: 'geparkt', wiedervorlage: bis, letzteAktivitaet: tagVon(new Date().toISOString()) });
    melden(`„${c.titel}“ geparkt bis ${datum(bis)} — unter „Gewonnen · Verloren · Geparkt“`, () => void api.teil('chancen', c.id, { stufe: vorher }));
  };
  const deal: DealAktionen = {
    archivieren: c => fragen({
      titel: `„${c.titel}“ archivieren?`,
      text: 'Archiv heißt bei Deals: parken (mit Wiedervorlage) oder verloren (mit Grund) — so lernt die Pipeline. Nichts wird gelöscht; zurückholen geht jederzeit.',
      wahl: [{ label: 'Verloren …', ton: 'leise', tun: () => verlorenFragen(c) }, { label: `Parken bis ${datum(plusTage(crm.heute, 60))}`, tun: () => parken(c) }],
    }),
    zurueckholen: c => {
      // Auf die letzte offene Stufe aus der Historie — offen braucht einen nächsten Schritt mit Datum (Server-Regel).
      const ziel = [...c.historie].reverse().find(h => offen.some(s => s.id === h.stufe))?.stufe ?? offen[0]?.id;
      if (!ziel) return;
      if (!(c.naechsterSchritt && c.naechsterSchritt.datum >= crm.heute)) {
        setAuswahl(c.id);
        api.setFehler(`„${c.titel}“ zurückholen: erst einen nächsten Schritt mit Datum festhalten, dann die Stufe „${crm.stufen.find(s => s.id === ziel)?.label ?? ziel}“ wählen.`);
        return;
      }
      const vorher = c.stufe;
      void api.teil('chancen', c.id, { stufe: ziel });
      melden(`„${c.titel}“ ist zurück — ${crm.stufen.find(s => s.id === ziel)?.label ?? ziel}`, () => void api.teil('chancen', c.id, vorher === 'geparkt' ? { stufe: vorher, wiedervorlage: c.wiedervorlage ?? plusTage(crm.heute, 60) } : { stufe: vorher, grund: c.grund ?? '' }));
    },
    loeschen: c => fehlanlage(c)
      ? fragen({
        titel: `Fehlanlage „${c.titel}“ löschen?`,
        text: 'Der Deal hat keine Geschichte, keinen Wert und keine Notiz — er geht ganz weg (ein Lead, der darauf zeigte, kehrt in die Qualifizierung zurück). Das lässt sich nicht rückgängig machen.',
        wahl: [{ label: 'Löschen', ton: 'gefahr', tun: () => { if (auswahl === c.id) setAuswahl(null); return api.weg('chancen', c.id); } }],
      })
      : fragen({
        titel: `„${c.titel}“ hat Geschichte`,
        text: 'Deals mit Geschichte werden nicht gelöscht — sie werden verloren oder geparkt markiert, damit Win Rate, Zyklus und Prognose stimmen.',
        wahl: istOffen(c) ? [{ label: 'Verloren …', ton: 'leise', tun: () => verlorenFragen(c) }, { label: 'Parken', tun: () => parken(c) }] : [],
      }),
    istOffen,
    // Im Menü „⋯“ (10.10.): parken und verloren direkt — ohne den Umweg über „Archivieren“; dazu der erste Kontakt.
    mehr: c => [
      ...(istOffen(c) ? [
        { id: 'parken', label: `Parken bis ${datum(plusTage(crm.heute, 60))}`, hinweis: 'mit Wiedervorlage', tun: () => parken(c) },
        { id: 'verloren', label: 'Verloren …', hinweis: 'mit Grund', tun: () => verlorenFragen(c) },
      ] : []),
      ...(c.kontaktIds[0] ? [{ id: 'kontakt', label: 'Kontakt öffnen', tun: () => zuKontakt(c.kontaktIds[0]) }] : []),
      { id: 'zoe', label: 'Mit ZOE besprechen', hinweis: 'ZOE öffnet mit diesem Bezug', tun: () => zoeFragen({ art: 'deal', id: c.id }) },
    ],
  };
  const zieh = (e: React.DragEvent, ziel: ChancenStufe) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) zieheNach(id, ziel); };
  const neuKnopf = <Knopf haupt onClick={neu}>+ Deal{neuFuer !== ich ? ` für ${nameVon(neuFuer)}` : ''}</Knopf>;
  /** Die Prognose (Zahlen, Faden je Monat, je Person) — im Board oben; in der Liste (Arbeitsfläche) rechts, solange kein Deal offen ist. */
  const prognoseKarte = (mitKnopf: boolean) => (
    <Karte i={0} ton="fokus" licht={LEUCHT.business}>
      <Ueberschrift rechts={mitKnopf ? neuKnopf : undefined}>{wahl === 'alle' ? 'Prognose' : `Prognose · ${wahl === 'ich' ? 'meine' : nameVon(wahl)}`}</Ueberschrift>
      <Raster min={150}>
        <Zahl wert={kurzEuro(p.offen)} label="offen" />
        <Zahl wert={kurzEuro(p.gewichtet)} label="gewichtet" farbe={LEUCHT.business} />
        {/* 28.09., K4: dieselbe Zahl ohne die Deals mit roter Ampel — die ehrlichere für Finanzen (Head of Finance bekommt sie). */}
        {p.gewichtetOhneHaengende !== p.gewichtet && <Zahl wert={kurzEuro(p.gewichtetOhneHaengende)} label="gewichtet ohne hängende" />}
        <Zahl wert={kurzEuro(p.commit)} label="Commit · Abschluss" farbe={LEUCHT.gut} />
        <Zahl wert={kurzEuro(p.bestCase)} label="Best Case · ab Angebot" />
        <Zahl wert={String(p.ohneSchritt)} label="ohne nächsten Schritt" farbe={p.ohneSchritt ? LEUCHT.achtung : undefined} />
        {/* 2.13 (09.10.): Deals ohne Wert zählen 0 € — hier steht, wie viele es sind (nie eine Null: nur, wenn es welche gibt). */}
        {ohneWert > 0 && <Zahl wert={String(ohneWert)} label={ohneWert === 1 ? 'Deal ohne Wert (zählt 0 €)' : 'Deals ohne Wert (zählen 0 €)'} farbe={LEUCHT.achtung} />}
        <Zahl wert={wl.quote !== null ? `${wl.quote} %` : `${wl.gewonnen} · ${wl.verloren}`} label={wl.quote !== null ? WIN_RATE_TEXT.label : WIN_RATE_TEXT.ohneQuote} />
      </Raster>
      {jeMonat && jeMonat.some(v => v > 0) && (
        <FadenLinie reihe={jeMonat} heute={0} label="Erwartete Abschlüsse gewichtet je Monat, nächste 6 Monate" beschriftung={monatBeschriftung(crm.heute)} format={kurzEuro}
          farbe={LEUCHT.business} hoehe={44} achse={[monatBeschriftung(crm.heute)(0), 'Erwartet · gewichtet', monatBeschriftung(crm.heute)(jeMonat.length - 1)]} style={{ marginTop: 14 }} />
      )}
      {jePerson.length > 1 && (
        <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
          {jePerson.map(x => (
            <div key={x.person} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
              <span style={{ minWidth: 76 }}><Person id={x.person} name groesse={18} /></span>
              <span>{x.anzahl} {x.anzahl === 1 ? 'Deal' : 'Deals'}</span>
              <span>gewichtet <b style={{ color: C.ink }}>{kurzEuro(x.gewichtet)}</b></span>
              {x.commit > 0 && <span>Commit {kurzEuro(x.commit)}</span>}
              {x.haengt > 0 && <span style={{ color: LEUCHT.kritisch }}>{x.haengt} hängt</span>}
              {x.ohneSchritt > 0 && <span style={{ color: LEUCHT.achtung }}>{x.ohneSchritt} ohne nächsten Schritt</span>}
            </div>
          ))}
        </div>
      )}
      {meine && (meine.haengt > 0 || meine.ohneSchritt > 0) && (
        <div style={{ fontSize: TYP.bedien, color: C.ink, marginTop: 10 }}>Als Nächstes: {meine.haengt > 0 ? `${meine.haengt} deiner Deals ${meine.haengt === 1 ? 'hängt' : 'hängen'} — nächsten Schritt mit Datum setzen, übergeben oder parken.` : `${meine.ohneSchritt} deiner Deals ohne nächsten Schritt — einen mit Datum eintragen.`}</div>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Wert = Monatshonorar × Laufzeit (ohne Angabe 12 Monate), gewichtet mit der Stufen-Wahrscheinlichkeit. Die Wahrscheinlichkeiten sind vorsichtige Startwerte und werden durch gemessene Quoten ersetzt.</div>
    </Karte>
  );

  const anlegenFeld = anlegen && <DealAnlegen api={api} kontaktId={anlegen.kontaktId} besitzer={anlegen.besitzer} onFertig={id => { setAnlegen(null); if (zuAkte) zuAkte(id); else setAuswahl(id); }} onAbbruch={() => setAnlegen(null)} zuDeal={zuAkte} />;

  // ── Liste als Arbeitsfläche (31.10., DESIGN_STANDARD.md › Arbeitsfläche) ────────────────────────────────────────────────────────────────────
  // Kopf in EINER Zeile (Deals · offen/gewichtet · ⋯ · „+ Deal“), Board · Liste, Wer, Suche und „Filter ▾“ (Stufe, Geschlossene) in EINER Zeile.
  // Die Stufen sind Abschnitte EINER Liste (keine Karte je Stufe); rechts steht der gewählte Deal, ohne Auswahl die Prognose mit dem Head of Sales.
  // Das Board bleibt, wie es ist (Ziehen zwischen Spalten braucht die Breite).
  if (!board) {
    const passtSuche = (c: Chance) => !suche.trim() || suchPasst([c.titel, firmenName(c, crm.stand.firmen), c.firma, ...c.kontaktIds.map(id => { const k = (api.kontakte ?? []).find(x => x.id === id); return k ? anzeigename(k) : ''; })], suche);
    const stufen = offen.filter(s => stufeFilter === 'alle' || s.id === stufeFilter);
    const zuGefiltert = zu.filter(passtSuche);
    const offenGesamt = chancen.filter(istOffen).length;
    const filterZahl = (stufeFilter !== 'alle' ? 1 : 0) + (geschlossen ? 1 : 0);
    const filterWeg = () => { setStufeFilter('alle'); setGeschlossen(false); };
    // Ein Klick öffnet die Deal-Akte als eigene Seite (30.10., Kevin: „sauber in die Akte gehen“) — ohne `zuAkte` (eingebettet) wie bisher unter der Zeile.
    const zeileVon = (c: Chance) => <ChancenZeile key={c.id} c={c} api={api} offen={!zuAkte && auswahl === c.id} inline onKlick={() => (zuAkte ? zuAkte(c.id) : setAuswahl(auswahl === c.id ? null : c.id))} zuKontakt={zuKontakt} deal={deal} wunsch={wunsch?.id === c.id ? wunsch.ziel : undefined} wunschWeg={() => setWunsch(null)} />;
    const leiste = (
      <>
        {ansichtWahl}
        <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen: Deal, Firma, Person …" aria-label="Deals durchsuchen" type="search" className="af-suche" style={{ ...feld, padding: '9px 13px', fontSize: TYP.bedien, minHeight: 40 }} />
        <FilterKnopf aktiv={filterZahl} onZuruecksetzen={filterWeg}>
          <FilterGruppe titel="Stufe">
            <Pillen liste={[{ id: 'alle' as const, label: 'Alle Stufen' }, ...offen.map(s => ({ id: s.id, label: `${s.label} ${chancen.filter(c => c.stufe === s.id).length}` }))]} aktiv={stufeFilter} onWahl={setStufeFilter} />
          </FilterGruppe>
          <FilterGruppe titel="Geschlossene">
            <Pillen liste={[{ id: 'nein', label: 'ausblenden' }, { id: 'ja', label: `Gewonnen · Verloren · Geparkt ${zu.length}` }]} aktiv={zeigeZu ? 'ja' : 'nein'} onWahl={w => { if (w === 'nein' && gewaehlt && !istOffen(gewaehlt)) setAuswahl(null); setGeschlossen(w === 'ja'); }} />
          </FilterGruppe>
        </FilterKnopf>
        {stufeFilter !== 'alle' && <button type="button" className="af-chip-weg fassbar" onClick={() => setStufeFilter('alle')} title="Filter aufheben">{offen.find(s => s.id === stufeFilter)?.label ?? 'Stufe'} <span aria-hidden>✕</span></button>}
      </>
    );
    const liste = () => (
      <div style={{ paddingBottom: 12 }}>
        {stufen.map(s => {
          const l = chancen.filter(c => c.stufe === s.id && passtSuche(c));
          const js = p.jeStufe.find(x => x.stufe === s.id);
          return (
            <ListenAbschnitt key={s.id} id={s.id} titel={<span title={`Weiter, wenn: ${s.weiterWenn}`}>{s.label}</span>} farbe={LEUCHT.business}
              rechts={`${s.p} % · ${l.length} · ${kurzEuro(js?.wert ?? 0)}${dealsOhneWert(l) ? ` · ${dealsOhneWert(l)} ohne Wert` : ''}${js?.haengt ? ` · ${js.haengt} hängt` : ''}`}>
              <Liste>{l.map(c => zeileVon(c))}</Liste>
              {!l.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '6px 0' }}>{suche.trim() ? 'Kein Treffer in dieser Stufe.' : 'Kein Deal in dieser Stufe.'}</div>}
            </ListenAbschnitt>
          );
        })}
        {vorschlaege.length > 0 && stufeFilter === 'alle' && !suche.trim() && (
          <ListenAbschnitt id="vorschlaege" titel="Im Gespräch, noch kein Deal" farbe={C.inkLeise}
            rechts={zuLeads ? <Knopf leise onClick={zuLeads}>Zu den Leads</Knopf> : `${vorschlaege.length} aus der Kartei`}>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '2px 0 6px' }}>Erst qualifizieren (Qualifizierung › Leads: {sqlRegelText(crm.stand.scoring ?? standardZumRechnen())}), dann wird daraus ein SQL-Deal.</div>
            <Liste>
              {vorschlaege.slice(0, alleVorschlaege ? 40 : 6).map(k => <Zeile key={k.id} titel={<>{anzeigename(k)}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.stufe === 'angebot' ? 'Angebot' : k.stufe === 'termin' ? 'Termin' : 'im Gespräch'} rechts={<Knopf leise onClick={() => ausKontakt(k)}>+ Deal</Knopf>} />)}
            </Liste>
            {vorschlaege.length > 6 && <button onClick={() => setAlleVorschlaege(!alleVorschlaege)} className="fassbar" style={{ marginTop: 8, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 44 }}>{alleVorschlaege ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</button>}
          </ListenAbschnitt>
        )}
        <div id="deals-geschlossen">
          <ListenAbschnitt id="geschlossen" titel="Gewonnen · Verloren · Geparkt" farbe={C.inkLeise}
            rechts={<button onClick={() => { if (zeigeZu && gewaehlt && !istOffen(gewaehlt)) setAuswahl(null); setGeschlossen(!zeigeZu); }} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, minHeight: 36 }}>{zeigeZu ? 'ausblenden' : `${zu.length} zeigen`}</button>}>
            {zeigeZu && <Liste>{zuGefiltert.map(c => zeileVon(c))}</Liste>}
          </ListenAbschnitt>
        </div>
      </div>
    );
    return (
      <>
        <Arbeitsflaeche titel="Deals" label="Deals" verhaeltnis="1:1" zweiAb={880}
          zaehler={<span title={`${kurzEuro(p.offen)} offen · ${kurzEuro(p.gewichtet)} gewichtet`}><b style={{ color: C.ink, fontWeight: 600 }}>{offenGesamt}</b> offen · {kurzEuro(p.gewichtet)} gewichtet{p.ohneSchritt ? ` · ${p.ohneSchritt} ohne nächsten Schritt` : ''}</span>}
          neben={kopf?.neben} mehr={kopf?.mehr} haupt={neuKnopf}
          leiste={leiste} hinweise={anlegenFeld || undefined}
          liste={() => liste()}
          // Rechts nur die Prognose mit dem Head of Sales — der Deal öffnet als Akte (30.10.).
          detail={null}
          leer={st => {
            const voll = <div style={{ display: 'grid', gap: 14 }}>{prognoseKarte(false)}<HeadPanel head="sales" standardModus="deal_review" zuKontakt={zuKontakt} i={1} nachEntscheid={() => void api.laden()} /></div>;
            return st.zwei ? voll : <Klappbar id="deals-prognose" titel="Prognose & Head of Sales" offen={prognoseOffen} umschalten={() => setPrognoseOffen(o => !o)}>{voll}</Klappbar>;
          }} leerOben />
        {dialog}
        {hinweis}
      </>
    );
  }

  return (
    <>
      <HeadPanel head="sales" standardModus="deal_review" zuKontakt={zuKontakt} i={0} nachEntscheid={() => void api.laden()} />
      {anlegenFeld}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
      </div>
      {prognoseKarte(true)}

      {breit && board && (() => {
        const sel = auswahl ? crm.stand.chancen.find(c => c.id === auswahl) : null;
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${offen.length}, minmax(0, 1fr))`, gap: 12, alignItems: 'start' }}>
              {offen.map(s => {
                const l = chancen.filter(c => c.stufe === s.id);
                const js = p.jeStufe.find(x => x.stufe === s.id);
                return (
                  <div key={s.id} onDragOver={e => e.preventDefault()} onDrop={e => zieh(e, s.id)} style={{ background: 'rgba(255,255,255,.025)', borderRadius: 14, padding: 10, minHeight: 160 }}>
                    <div title={`Weiter, wenn: ${s.weiterWenn}`} style={{ padding: '2px 4px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkDim }}><span>{s.label}</span><span style={{ color: C.inkLeise }}>{s.p} %</span></div>
                      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>{l.length} · {kurzEuro(js?.wert ?? 0)}{dealsOhneWert(l) ? <span style={{ color: LEUCHT.achtung }}> · {dealsOhneWert(l)} ohne Wert</span> : null}{js?.haengt ? <span style={{ color: LEUCHT.kritisch }}> · {js.haengt} hängt</span> : null}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {l.map(c => {
                        const a = crm.ampel[c.id];
                        return (
                          <ZeileAktionen key={c.id} titel={c.titel} onArchivieren={() => deal.archivieren(c)} onLoeschen={() => deal.loeschen(c)}
                            loeschenFragt href={WEG.deal(c.id)} onOeffnen={() => (zuAkte ? zuAkte(c.id) : setAuswahl(c.id))} mehr={deal.mehr(c)}>
                          <button draggable onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }} onDoubleClick={() => zuAkte?.(c.id)} title="Klick: Details · Doppelklick: Akte · Ziehen: Stufe wechseln" onClick={() => setAuswahl(auswahl === c.id ? null : c.id)} className="fassbar" style={{ textAlign: 'left', cursor: 'grab', border: `1px solid ${auswahl === c.id ? LEUCHT.business : 'rgba(255,255,255,.06)'}`, borderLeft: `3px solid ${a ? AMPEL[a.ampel] : C.inkLeise}`, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '9px 10px', color: C.ink, display: 'grid', gap: 3 }}>
                            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: TYP.bedien, fontWeight: 600, lineHeight: 1.3 }}>{c.titel}</span>
                              <Person id={zustaendig(c.besitzer, 'sales')} groesse={16} />
                            </span>
                            {firmenName(c, crm.stand.firmen) && firmenName(c, crm.stand.firmen) !== c.titel && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{firmenName(c, crm.stand.firmen)}</span>}
                            <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{wertText(c)}</span>
                            <span style={{ fontSize: 12, color: c.naechsterSchritt && c.naechsterSchritt.datum < crm.heute ? LEUCHT.kritisch : C.inkLeise }}>{c.naechsterSchritt ? `→ ${datum(c.naechsterSchritt.datum, crm.heute)}` : 'kein nächster Schritt'}</span>
                          </button>
                          </ZeileAktionen>
                        );
                      })}
                      {!l.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px' }}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {(['gewonnen', 'verloren', 'geparkt'] as ChancenStufe[]).map(z => (
                <div key={z} onDragOver={e => e.preventDefault()} onDrop={e => zieh(e, z)} style={{ border: `1px dashed ${z === 'gewonnen' ? LEUCHT.gut : z === 'verloren' ? LEUCHT.kritisch : 'rgba(255,255,255,.2)'}55`, borderRadius: 12, padding: '8px 12px', fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center' }}>hierher ziehen: {crm.stufen.find(s => s.id === z)?.label}</div>
              ))}
            </div>
            {sel && offen.some(s => s.id === sel.stufe) && (
              <Karte i={2} akzent={LEUCHT.business}>
                <Ueberschrift rechts={<button onClick={() => setAuswahl(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14 }}>✕</button>}>{sel.titel}</Ueberschrift>
                {zuAkte && <div style={{ marginBottom: 8 }}><Knopf leise onClick={() => zuAkte(sel.id)}>Akte öffnen ›</Knopf></div>}
                <ChancenDetail c={sel} api={api} personen={sel.kontaktIds.map(id => (api.kontakte ?? []).find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k)} zuKontakt={zuKontakt} wunsch={wunsch?.id === sel.id ? wunsch.ziel : undefined} wunschWeg={() => setWunsch(null)} />
              </Karte>
            )}
          </>
        );
      })()}

      {!breit && offen.map((s, i) => {
        const l = chancen.filter(c => c.stufe === s.id);
        const js = p.jeStufe.find(x => x.stufe === s.id);
        return (
          <Karte key={s.id} i={i + 1}>
            <Ueberschrift rechts={`${s.p} % · ${l.length} · ${kurzEuro(js?.wert ?? 0)}${dealsOhneWert(l) ? ` · ${dealsOhneWert(l)} ohne Wert` : ''}${js?.haengt ? ` · ${js.haengt} hängt` : ''}`}>{s.label}</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Weiter, wenn: {s.weiterWenn}</div>
            <Liste>
              {l.map(c => <ChancenZeile key={c.id} c={c} api={api} offen={auswahl === c.id} onKlick={() => setAuswahl(auswahl === c.id ? null : c.id)} zuKontakt={zuKontakt} deal={deal} wunsch={wunsch?.id === c.id ? wunsch.ziel : undefined} wunschWeg={() => setWunsch(null)} />)}
            </Liste>
            {!l.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '6px 0' }}>Kein Deal in dieser Stufe.</div>}
          </Karte>
        );
      })}

      {vorschlaege.length > 0 && (
        <Karte i={1}>
          <Ueberschrift rechts={zuLeads ? <Knopf leise onClick={zuLeads}>Zu den Leads</Knopf> : `${vorschlaege.length} aus der Kartei`}>Im Gespräch, noch kein Deal</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Erst qualifizieren (Qualifizierung › Leads: {sqlRegelText(crm.stand.scoring ?? standardZumRechnen())}), dann wird daraus ein SQL-Deal. Direkt angelegt bleibt der Lead in der Qualifizierung („direkt angelegt“, kein SQL).</div>
          <Liste>
            {vorschlaege.slice(0, alleVorschlaege ? 40 : 6).map(k => <Zeile key={k.id} titel={<>{anzeigename(k)}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.stufe === 'angebot' ? 'Angebot' : k.stufe === 'termin' ? 'Termin' : 'im Gespräch'} rechts={<Knopf leise onClick={() => ausKontakt(k)}>+ Deal</Knopf>} />)}
          </Liste>
          {vorschlaege.length > 6 && <button onClick={() => setAlleVorschlaege(!alleVorschlaege)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{alleVorschlaege ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</button>}
        </Karte>
      )}

      <Karte i={7} id="deals-geschlossen">
        <Ueberschrift rechts={<button onClick={() => { if (zeigeZu && gewaehlt && !istOffen(gewaehlt)) setAuswahl(null); setGeschlossen(!zeigeZu); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>{zeigeZu ? 'ausblenden' : `${zu.length} zeigen`}</button>}>Gewonnen · Verloren · Geparkt</Ueberschrift>
        {zeigeZu && <Liste>{zu.map(c => <ChancenZeile key={c.id} c={c} api={api} offen={auswahl === c.id} onKlick={() => setAuswahl(auswahl === c.id ? null : c.id)} zuKontakt={zuKontakt} deal={deal} wunsch={wunsch?.id === c.id ? wunsch.ziel : undefined} wunschWeg={() => setWunsch(null)} />)}</Liste>}
      </Karte>
      {dialog}
      {hinweis}
    </>
  );
}

/** Zeilen-Aktionen eines Deals (Pipeline) — Archiv = parken/verloren, Zurückholen = wieder offen, Löschen = nur Fehlanlage. */
interface DealAktionen { archivieren: (c: Chance) => void; zurueckholen: (c: Chance) => void; loeschen: (c: Chance) => void; istOffen: (c: Chance) => boolean; mehr: (c: Chance) => ZeilenMehr[] }

function ChancenZeile({ c, api, offen, inline = true, onKlick, zuKontakt, deal, wunsch, wunschWeg }: { c: Chance; api: CrmApi; offen: boolean; /** Detail unter der Zeile (schmal); in der Arbeitsfläche mit zwei Spalten steht es rechts. */ inline?: boolean; onKlick: () => void; zuKontakt: (id: string) => void; deal: DealAktionen; wunsch?: ChancenStufe; wunschWeg?: () => void }) {
  const crm = api.crm!;
  const a = crm.ampel[c.id];
  const kontakte = api.kontakte ?? [];
  const personen = c.kontaktIds.map(id => kontakte.find(k => k.id === id)).filter(Boolean);
  return (
    <div>
      <ZeileAktionen titel={c.titel} archiviert={!deal.istOffen(c)} onArchivieren={() => (deal.istOffen(c) ? deal.archivieren(c) : deal.zurueckholen(c))} onLoeschen={() => deal.loeschen(c)}
        loeschenFragt href={WEG.deal(c.id)} onOeffnen={onKlick} mehr={deal.mehr(c)}>
      <Zeile onClick={onKlick} aktiv={offen} links={<Punkt farbe={a ? AMPEL[a.ampel] : C.inkLeise} />}
        titel={<>{c.titel}{firmenName(c, crm.stand.firmen) && <span style={{ color: C.inkLeise }}> · {firmenName(c, crm.stand.firmen)}</span>}</>}
        unter={[c.naechsterSchritt ? `→ ${c.naechsterSchritt.text} · ${datum(c.naechsterSchritt.datum, crm.heute)}` : 'kein nächster Schritt', a?.gruende[0]].filter(Boolean).join(' · ')}
        rechts={<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: TYP.bedien, color: C.inkDim }}>{gesamtwert(c) > 0 ? wertText(c) : '—'}</span><Person id={zustaendig(c.besitzer, 'sales')} groesse={18} /></span>} />
      </ZeileAktionen>
      {offen && inline && <ChancenDetail c={c} api={api} personen={personen as NonNullable<typeof personen[number]>[]} zuKontakt={zuKontakt} wunsch={wunsch} wunschWeg={wunschWeg} />}
    </div>
  );
}

export function ChancenDetail({ c, api, personen, zuKontakt, wunsch, wunschWeg }: { c: Chance; api: CrmApi; personen: NonNullable<CrmApi['kontakte']>; zuKontakt: (id: string) => void; /** Stufe, die per Ziehen gewünscht wurde (Verloren/Geparkt) — öffnet die Nachfrage. */ wunsch?: ChancenStufe; wunschWeg?: () => void }) {
  const crm = api.crm!;
  const { bestaetigen, dialog } = useRueckfrage();
  const [wechsel, setWechsel] = useState<{ ziel: ChancenStufe; grund: string; wiedervorlage: string } | null>(null);
  useEffect(() => { if (wunsch) { setWechsel({ ziel: wunsch, grund: '', wiedervorlage: plusTage(crm.heute, 60) }); wunschWeg?.(); } }, [wunsch, wunschWeg, crm.heute]);
  const [suche, setSuche] = useState('');
  // Nur die geänderten Felder — die andere Person kann gleichzeitig an derselben Chance arbeiten.
  const setze = (teil: Partial<Chance>) => api.teil('chancen', c.id, nurFelder(teil));
  const wechsle = (ziel: ChancenStufe, extra: { grund?: string; wiedervorlage?: string } = {}) => {
    if (ziel === c.stufe) return setWechsel(null);
    if (ziel === 'verloren' && !extra.grund) return setWechsel({ ziel, grund: '', wiedervorlage: '' });
    if (ziel === 'geparkt' && !extra.wiedervorlage) return setWechsel({ ziel, grund: '', wiedervorlage: plusTage(crm.heute, 60) });
    const jetzt = new Date().toISOString();
    void setze({ stufe: ziel, letzteAktivitaet: tagVon(jetzt), ...(extra.grund ? { grund: extra.grund } : {}), ...(extra.wiedervorlage ? { wiedervorlage: extra.wiedervorlage } : {}) });
    setWechsel(null);
  };
  const fuehrt = zustaendig(c.besitzer, 'sales');
  const treffer = suche.trim().length >= 2 ? (api.kontakte ?? []).filter(k => `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  // 2.11 (09.10.): Datum ohne Text wird gemerkt (mit Hinweis), nicht still verworfen; den Schritt eines OFFENEN Deals leeren nur nach Rückfrage
  // (ohne Schritt hängt er) — Pflicht bleibt beim Anlegen und beim Stufenwechsel (Server).
  const [datumOhneText, setDatumOhneText] = useState<string | null>(null);
  const [schrittNeu, setSchrittNeu] = useState(0);
  const dealOffen = !!crm.stufen.find(s => s.id === c.stufe)?.offen;
  const schrittText = async (text: string) => {
    const t = text.trim();
    if (t) { void setze({ naechsterSchritt: { text: t, datum: datumOhneText ?? c.naechsterSchritt?.datum ?? plusTage(crm.heute, 3) } }); setDatumOhneText(null); return; }
    if (!c.naechsterSchritt) return;
    if (dealOffen && !(await bestaetigen({ titel: 'Nächsten Schritt leeren?', text: 'Ein offener Deal ohne nächsten Schritt hängt (Ampel rot) und erscheint in keiner Liste als fällig. Besser: gleich einen neuen Schritt mit Datum eintragen.', ja: 'Trotzdem leeren', gefahr: true }))) { setSchrittNeu(n => n + 1); return; }
    void setze({ naechsterSchritt: undefined });
  };
  const schrittDatum = (d2: string) => {
    if (!d2) return;
    if (c.naechsterSchritt) { void setze({ naechsterSchritt: { ...c.naechsterSchritt, datum: d2 } }); return; }
    setDatumOhneText(d2);
  };
  // 2.15 (09.10.): die Fragen des LEADS (Stufen der Scoring-Einstellungen) — dieselben wie in der Qualifizierung; die alten sechs Kernfragen
  // stehen nur noch bei Deals ohne Person (kein Lead).
  const leadZ = useMemo(() => (personen[0] ? leadZeileFuer(personen[0], api.kontakte ?? [], crm.stand, crm.heute) : undefined), [personen, api.kontakte, crm.stand, crm.heute]);
  const leadFragen = (leadZ?.score.scoring?.sales.teile.flatMap(t => t.kriterien) ?? []).filter(x => x.quelle === 'frage');

  return (
    <div className="quali-seite" style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <Feldzeile label="Führt">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={c.besitzer} welt="sales" onWahl={besitzer => void api.teil('chancen', c.id, { besitzer })} />
          <Uebergeben api={api} art="chance" id={c.id} jetzt={fuehrt} klein />
        </div>
      </Feldzeile>
      <div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Stufe</div>
        <Pillen liste={crm.stufen.map(s => ({ id: s.id, label: s.label }))} aktiv={c.stufe} onWahl={wechsle} farbe={LEUCHT.business} />
        {wechsel && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            {wechsel.ziel === 'verloren'
              ? <Wahl label="Verlustgrund" leer="+ Verlustgrund wählen" liste={verlustgruende(crm.stand.wertelisten).map(g => ({ id: g, label: g }))} wert={wechsel.grund || null} onWahl={grund => wechsle('verloren', { grund })} farbe={LEUCHT.kritisch} />
              : <><input type="date" value={wechsel.wiedervorlage} onChange={e => setWechsel({ ...wechsel, wiedervorlage: e.target.value })} aria-label="Wiedervorlage" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 10px', color: C.ink }} /><Knopf onClick={() => wechsle('geparkt', { wiedervorlage: wechsel.wiedervorlage })}>Parken bis dahin</Knopf></>}
            <Knopf leise onClick={() => setWechsel(null)}>Abbrechen</Knopf>
          </div>
        )}
        {c.historie.length > 1 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{c.historie.map(h => `${crm.stufen.find(s => s.id === h.stufe)?.label} ${datum(h.am)}${mitglied(h.von) ? ` (${nameVon(h.von)})` : ''}`).join(' → ')}</div>}
        {/* 17.10. spät (Fulfillment „maximal einfach“): gewonnen → direkt unter der Stufe „Mandat anlegen & Fall starten“ (vorher ganz unten nur „Mandat anlegen“). */}
        <FallAmDeal api={api} chanceId={c.id} />
      </div>
      <Feldzeile label="Titel"><Feld wert={c.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Firma">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Firma" liste={[...crm.stand.firmen].sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ id: f.id, label: f.name, ...(f.stadt ? { hinweis: f.stadt } : {}) }))} wert={c.firmaId}
            onWahl={id => { const f = crm.stand.firmen.find(x => x.id === id); if (f) void setze({ firmaId: f.id, firma: f.name }); }} onLeeren={() => void setze({ firmaId: undefined, firma: undefined })} />
          {!c.firmaId && c.firma && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>„{c.firma}“ ist keiner Firma zugeordnet — oben wählen.</span>}
        </div>
      </Feldzeile>
      <Feldzeile label="Art"><Wahl label="Art" liste={ARTEN} wert={c.art} onWahl={art => setze({ art })} /></Feldzeile>
      <Feldzeile label="Wert">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={c.wert.betrag ? String(c.wert.betrag) : ''} breite={120} platzhalter="Betrag €" onFertig={b => setze({ wert: { ...c.wert, betrag: Number(b) || 0 } })} />
          <Wahl label="Wert-Basis" liste={BASEN} wert={c.wert.basis} onWahl={basis => setze({ wert: { ...c.wert, basis } })} />
          {c.wert.basis !== 'einmalig' && <Feld typ="number" wert={c.wert.laufzeitMonate ? String(c.wert.laufzeitMonate) : ''} breite={110} platzhalter="Monate" onFertig={m => setze({ wert: { ...c.wert, laufzeitMonate: Number(m) || undefined } })} />}
          {/* 24.10.: Einmal-Anteil neben dem laufenden Wert (nie auf die Laufzeit verteilt). */}
          {c.wert.basis !== 'einmalig' && <Feld typ="number" wert={c.wert.einmalBetrag ? String(c.wert.einmalBetrag) : ''} breite={130} platzhalter="+ einmalig €" onFertig={x => setze({ wert: { ...c.wert, einmalBetrag: Number(x) > 0 ? Number(x) : undefined } })} />}
          {/* 25.10.: der geplante Teil (Tages-/Stundensätze) wird getrennt genannt — das feste Honorar ist der Rest. */}
          {geplanterMonatswert(c) > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>davon ca. {euro(geplanterMonatswert(c))}/Monat geplante Sätze</span>}
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>= {euro(gesamtwert(c))}</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Nächster Schritt">
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}><Feld key={schrittNeu} wert={c.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => void schrittText(text)} /></div>
            <Feld typ="date" wert={c.naechsterSchritt?.datum ?? datumOhneText ?? undefined} breite={150} platzhalter="Datum" onFertig={schrittDatum} />
          </div>
          {datumOhneText && !c.naechsterSchritt && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Datum {datum(datumOhneText)} gemerkt — jetzt eintragen, was passiert; ohne Text wird nichts gespeichert.</div>}
        </div>
      </Feldzeile>
      <Feldzeile label="Entscheidung bis"><Feld typ="date" wert={c.erwartetAm} breite={160} platzhalter="Datum" onFertig={erwartetAm => setze({ erwartetAm: erwartetAm || undefined })} /></Feldzeile>
      {leadZ && leadFragen.length > 0 ? (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Qualifizierung des Leads — dieselben Fragen wie in der Runde</span>
            <Link href={qualifizierungLink(leadZ.id)} style={{ fontSize: TYP.bedien, color: C.aktiv, marginLeft: 'auto' }}>In der Qualifizierung bearbeiten ›</Link>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {leadFragen.map(x => (
              <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 40%) 1fr', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
                <span style={{ color: C.inkDim }}>{x.name}</span>
                <span style={{ color: x.offen || !x.beantwortet ? C.inkLeise : x.punkte >= x.max * 0.6 ? LEUCHT.gut : x.punkte > 0 ? LEUCHT.achtung : LEUCHT.kritisch }}>{x.stufeText ?? 'offen'}</span>
              </div>
            ))}
          </div>
          {leadZ.score.scoring && !leadZ.score.scoring.sales.erreicht && leadZ.score.scoring.sales.fehlt.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Bis SQL fehlt: {leadZ.score.scoring.sales.fehlt.join(', ')}</div>}
        </div>
      ) : (
      <div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Qualifizierung — was noch unklar ist, ist die nächste Frage</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {QUAL.map(q => (
            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{q.label}</span>
              <Pillen liste={[{ id: 'ja', label: 'ja' }, { id: 'unklar', label: 'unklar' }, { id: 'nein', label: 'nein' }]} aktiv={c.qualifizierung[q.id]} onWahl={(v: Qual) => setze({ qualifizierung: { ...c.qualifizierung, [q.id]: v } })}
                farbe={c.qualifizierung[q.id] === 'ja' ? LEUCHT.gut : c.qualifizierung[q.id] === 'nein' ? LEUCHT.kritisch : LEUCHT.achtung} />
            </div>
          ))}
        </div>
      </div>
      )}
      <Feldzeile label="Produkt">
        {/* 24.10. (Bau-Test): nur aktive Produkte (keine Entwürfe); die Gesellschaft folgt dem Produkt, ein Deal ohne Wert bekommt den Wert des Produkts. */}
        <Wahl label="Produkt" liste={crm.stand.leistungen.filter(x => (x.status === 'aktiv' && !x.geloeschtAm) || x.id === c.leistungId).map(x => ({ id: x.id, label: x.name }))} wert={c.leistungId}
          onWahl={leistungId => {
            const l = crm.stand.leistungen.find(x => x.id === leistungId);
            const w = l && !(gesamtwert(c) > 0) ? dealWertAusProdukt(l) : null;
            setze({ leistungId, ...(l?.gesellschaft && l.gesellschaft !== 'offen' && l.gesellschaft !== c.gesellschaft ? { gesellschaft: l.gesellschaft } : {}), ...(w ? { wert: w } : {}) });
          }} onLeeren={() => setze({ leistungId: undefined })} />
      </Feldzeile>
      <Feldzeile label="Quelle"><Wahl label="Quelle" liste={QUELLEN} wert={c.quelle} onWahl={quelle => quelle !== c.quelle && setze({ quelle, quelleBezug: undefined })} onLeeren={() => setze({ quelle: undefined, quelleBezug: undefined })} /></Feldzeile>
      {(c.quelle === 'event' || c.quelle === 'content' || c.quelle === 'kampagne') && (
        <Feldzeile label={c.quelle === 'event' ? 'Welches Event' : c.quelle === 'kampagne' ? 'Welche Kampagne' : 'Welcher Beitrag'}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Wahl label={c.quelle === 'event' ? 'Event' : c.quelle === 'kampagne' ? 'Kampagne' : 'Beitrag'} leer="+ wählen"
              liste={c.quelle === 'event' ? crm.stand.events.map(x => ({ id: x.id, label: x.titel, hinweis: datum(x.datum) })) : c.quelle === 'kampagne' ? (crm.stand.kampagnen ?? []).map(x => ({ id: x.id, label: x.name })) : (crm.stand.beitraege ?? []).map(x => ({ id: x.id, label: x.titel }))}
              wert={c.quelleBezug} onWahl={quelleBezug => setze({ quelleBezug })} onLeeren={() => setze({ quelleBezug: undefined })} />
            {c.quelleBezug && <Link href={c.quelle === 'event' ? eventLink(crm?.stand.events.find(x => x.id === c.quelleBezug) ?? { id: c.quelleBezug }) : c.quelle === 'kampagne' ? WEG.kampagne(c.quelleBezug) : WEG.marketing('redaktion', c.quelleBezug)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>öffnen ›</Link>}
          </div>
        </Feldzeile>
      )}
      <Feldzeile label="Selbstauskunft"><Feld wert={c.selbstauskunft} platzhalter="„Wie sind Sie auf uns aufmerksam geworden?“" onFertig={s => setze({ selbstauskunft: s || undefined })} /></Feldzeile>
      <Feldzeile label="Gesellschaft"><GesellschaftWahl wert={c.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      <Feldzeile label="Personen">
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personen.map(k => <span key={k.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><button onClick={() => zuKontakt(k.id)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 999, padding: '5px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>{anzeigename(k)}</button><button onClick={() => setze({ kontaktIds: c.kontaktIds.filter(x => x !== k.id) })} aria-label="Person entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button></span>)}
          </div>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Person hinzufügen …" aria-label="Person hinzufügen" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 10px', color: C.ink, fontSize: TYP.bedien }} />
          {treffer.map(k => <button key={k.id} onClick={() => { void setze({ kontaktIds: Array.from(new Set([...c.kontaktIds, k.id])), ...(c.firma ? {} : k.firma ? { firma: k.firma } : {}) }); setSuche(''); }} style={{ textAlign: 'left', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 0' }}>+ {anzeigename(k)}{k.firma ? ` · ${k.firma}` : ''}</button>)}
        </div>
      </Feldzeile>
      <Feldzeile label="Notiz"><Feld wert={c.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      {c.grund && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Grund: {c.grund}{c.wiedervorlage ? ` · Wiedervorlage ${datum(c.wiedervorlage)}` : ''}</div>}
      {/* Sperre statt Löschen (Konzept): ein Deal mit Geschichte wird verloren oder geparkt — löschen geht nur bei einer Fehlanlage. */}
      {c.historie.length <= 1 && !c.wert.betrag && !(c.notiz ?? '').trim()
        ? <div><button onClick={async () => { if (await bestaetigen({ titel: `Fehlanlage „${c.titel}“ löschen?`, text: 'Der Deal hat keine Geschichte, keinen Wert und keine Notiz — er geht ganz weg. Ein Deal mit Geschichte wird stattdessen als verloren oder geparkt markiert.', ja: 'Löschen', gefahr: true })) void api.weg('chancen', c.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Fehlanlage löschen</button></div>
        : <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Löschen gibt es nicht — ein Deal mit Geschichte wird verloren oder geparkt, damit die Pipeline lernt.</div>}
      {dialog}
    </div>
  );
}
