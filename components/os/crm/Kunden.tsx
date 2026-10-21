'use client';

// ─── Mandate (Produkte & Mandate, /os/mandate) — und die Kurzfassung für Sales ───
// Seit 25.09. leben die Mandate im eigenen Bereich links unter Aufgaben (Kevin:
// „Mandaten-Abteil … Produkte und Mandate“); Deals › Kunden zeigt nur noch
// die Kurzfassung mit Sprung dorthin (KundenKurz). Je Mandat jetzt auch das
// Produkt und die Phase in dessen Ablauf. Die Produkte: components/os/mandate/Produkte.tsx.
// Oben MRR und Kundenkonzentration. Je Mandat: Status, Laufzeit und Frist,
// Health (DEAR: Beteiligung, Umsetzung, Wirkung, Zahlung, Stimmung), die
// offenen Punkte und Widersprüche — sichtbar, nicht geglättet — und ob das
// Mandat im Liquiditätsplan steht.
// Zu zweit (25.09.): Je Mandat ist jemand zuständig (ohne Eintrag Kevin als
// Sales-Verantwortung) — Filter „Alle · Meins · Malin“, Plakette, Zeile je
// Person, Übergeben. Änderungen gehen als Einzelfelder raus (api.teil).
// 28.09.: Filter nach Gesellschaft (Alle · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH)
// neben dem Personen-Filter; „+ Mandat“ übernimmt die gefilterte Gesellschaft. Rechnungen
// aus dem Honorar landen bei der Gesellschaft des Mandats (firmaFuerGesellschaft).
// 04.10. (Kevin: „alles anpassbar“): jede Mandatszeile am Baustein `ZeileAktionen` — Archivieren = Status „beendet“ (ein aktives
// erst nach Rückfrage; „Zurückholen“ setzt es wieder auf aktiv bzw. Verhandlung ohne Vertrag) und Löschen = Papierkorb 30 Tage
// (nur ohne Rechnungen, Dateien, offene Follow-ups — prüft der Server; components/os/crm/ablage.tsx, lib/crm/ablage.ts).

import { TermineAkte } from '../kalender/TermineAkte';
import { localDay, tagePlus } from '@/lib/zeit';
import { useLinkAuswahl } from '../Verlauf';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { mandateLink } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';
import { zoeFragen } from './ZoeFragen';
import { rechnungPasst } from '@/lib/crm/kunden';
import { mandatPhase, portfolio } from '@/lib/crm/produkte';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, Segmente, Hinweis, useBreit, LEUCHT, ZeileAktionen, feld } from '../ui';
import { useCrmAblage, PapierkorbKarte } from './ablage';
import { anzeigename } from '@/lib/make-one/crm';
import { HEALTH_GEWICHTE, HEALTH_LABEL, kundenJePerson, gesellschaftFilterFuer, passtGesellschaft, beendenVorgabe, beendenHinweise, type GesellschaftFilter, type LiquiLageArt } from '@/lib/crm/kunden';
import { mandatName, titelOhneFirma } from '@/lib/crm/mandat-name';
import { postenZeitText, type Planposten } from '@/lib/make-one/liquiditaet';
import { werZahlen } from '@/lib/crm/pipeline';
import { zustaendig, mitglied, nameVon } from '@/lib/crm/team';
import type { Mandat } from '@/lib/crm/typen';
import { type CrmApi, datum, euro, kurzEuro, nurFelder } from './daten';
import { Feldzeile, Feld } from './teile';
import { Wahl } from './Wahl';
import { GesellschaftWahl } from './GesellschaftWahl';
import { finanzFirmaFuer, NUR_GRUNDDATEN, istBusinessGesellschaft } from '@/lib/einheiten';
import { mandatGesellschaftOffen, ANRECHNUNG_FEHLT } from '@/lib/crm/kunden';
import { firmaVonMandat } from '@/lib/crm/firmen-bezug';
import { MandantLink } from './MandantLink';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';
import { useZiel, useZuZiel } from '../ziel';
import { MandatZeitMonat } from '../zeit/ZeitJeMandat';
import { entwurfAnlegen, KEIN_RECHNUNGS_ZUGANG } from '../rechnung/daten';
import { monatsName, mandatLaeuftIm, mandatMonatVorgabe } from '@/lib/finanzen/rechnung/regeln';
import { MandatFortschritt, FallPhase } from '../mandate/treppe/Fortschritt';
import { MandatAnlegen, FirmaZuordnen } from './MandatAnlegen';
import { OnboardingFrage } from '../fulfillment/prozesse/OnboardingFrage';
import { MandatVertrag, MandatLeistungen, MandatZusatzModule } from './MandatZusatz';
import { useNurBusiness } from '../useInhaber';
import { anzahl } from '@/lib/text/zahlwort';
import { useSpace } from '@/hooks/useSpace';

const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const STATUS: { id: Mandat['status']; label: string }[] = [{ id: 'angebot', label: 'Angebot' }, { id: 'verhandlung', label: 'Verhandlung' }, { id: 'aktiv', label: 'Aktiv' }, { id: 'pausiert', label: 'Pausiert' }, { id: 'beendet', label: 'Beendet' }];
const VERTRAG = [{ id: 'ja', label: 'unterschrieben' }, { id: 'nein', label: 'nicht unterschrieben' }] as const;
const HONORAR_BASIS = [{ id: 'monat', label: 'je Monat' }, { id: 'einmalig', label: 'einmalig' }, { id: 'tag', label: 'je Tag' }] as const;
const NETTO = [{ id: 'netto', label: 'netto' }, { id: 'brutto', label: 'brutto' }] as const;
const UST = [{ id: '19', label: '19 % USt' }, { id: '0', label: 'Reverse Charge' }] as const;
const VERLAENGERUNG = [{ id: 'auto', label: 'verlängert sich' }, { id: 'manuell', label: 'endet' }, { id: 'offen', label: 'offen' }] as const;
const statusFarbe = (s: string) => (s === 'aktiv' ? LEUCHT.gut : s === 'verhandlung' || s === 'angebot' ? LEUCHT.business : C.inkLeise);
/** Lage im Liquiditätsplan je Mandat (GET /api/crm/liquiplan — gerechnet in lib/crm/kunden.ts `mandatLiquiLage`). */
interface LiquiLage { id: string; lage: LiquiLageArt; grund?: string; letzteZahlung?: string; soll: Planposten[]; vorhanden: { id: string; betrag: number } | null }
/** Der Hinweis in der Liste, wenn der Plan abweicht — fehlt die Anrechnung (P3b), sagt er das. */
const abweichText = (lq: Pick<LiquiLage, 'grund'>) => (lq.grund?.startsWith(ANRECHNUNG_FEHLT) ? `Liquiplan weicht ab — ${ANRECHNUNG_FEHLT}` : 'Liquiplan weicht ab');
/** Euro auf den Cent (Teilmonate). */
const euroCent = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
/** Titel in Listen: „Firma“ und der Rest des Titels — steht die Firma schon im Titel, nicht doppelt (18.10., N18). */
const MandatTitel = ({ m }: { m: Pick<Mandat, 'kunde' | 'titel'> }) => { const rest = titelOhneFirma(m.kunde, m.titel); return <>{m.kunde}{rest && <span style={{ color: C.inkLeise }}> · {rest}</span>}</>; };

/** Alle Mandate mit Kennzahlen, Filter und Detail — der Hauptteil von Produkte & Mandate. */
export function MandateUebersicht({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  // Offenes Mandat bzw. offene Leistung im Link (k): Zurück schließt es wieder.
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const router = useRouter();
  // Am Handy: Hinweise in die Zeile darunter — sonst drücken die Chips den Kundennamen weg.
  const breit = useBreit();
  const [liqui, setLiqui] = useState<{ mandate: LiquiLage[]; freiePosten: { id: string; titel: string; betrag: number }[] } | null>(null);
  const [alle, setAlle] = useState(false);
  const [wahl, setWahl] = useWerFilter('kunden');
  // Filter nach Gesellschaft (28.09.): Alle · die festen Gesellschaften — zusätzlich zur Person. Konto „nur Business“ ohne Privat-Einheit (B17, 14.10.).
  const [ges, setGes] = useState<GesellschaftFilter>('alle');
  const nurBusiness = useNurBusiness();
  // Business-Sicht (17.10., Abnahme 3 · C3): die Mandate-Seite gehört zum Business — der Filter nennt keine Privat-Einheit (Selbstständigkeit),
  // auch nicht bei der Inhaberin (vorher nur beim Konto „nur Business“). Regel `bereichVon` über `gesellschaftFilterFuer`.
  const imBusiness = useSpace().space === 'business';
  // Kommt man über einen Link auf ein Mandat, springt die Liste einmal dorthin.
  useZuZiel(useZiel('k'), !!api.crm);
  const ablage = useCrmAblage(api, 'mandate');
  const [korbOffen, setKorbOffen] = useState(false);
  const [neuWahl, setNeuWahl] = useState(false);
  // „Firma zuordnen“ (10.10.) für ein bestehendes Mandat ohne Firma — nur auf Klick, sonst bleibt der Altbestand unverändert.
  const [zuordnen, setZuordnen] = useState<string | null>(null);
  const ladeLiqui = () => fetch('/api/crm/liquiplan').then(r => r.json()).then(d => d.ok && setLiqui(d)).catch(() => {});
  useEffect(() => { void ladeLiqui(); }, []);
  // Aus dem Fulfillment (18.10., N6): „Mandat beenden ›“ öffnet hier denselben Dialog (`?k=<Mandat>&beenden=1`, WEG.mandatBeenden) — einmal,
  // sobald Mandate und Liquiditätsplan geladen sind; danach ohne den Zusatz in der Adresse (Neuladen öffnet ihn nicht erneut).
  const beendenZiel = useZiel('beenden');
  // „Mandat aus diesem Produkt anlegen“ (19.10., P3 — WEG.mandatAusProdukt, `?leistung=<Produkt>`): öffnet „+ Mandat“ einmal mit dem Produkt,
  // sobald der Katalog da ist; danach ohne den Zusatz in der Adresse (Neuladen öffnet ihn nicht erneut).
  const ausProdukt = useZiel('leistung');
  const [neuProdukt, setNeuProdukt] = useState<string | null>(null);
  // Nach dem Anlegen (21.10., Rundgang B6): hat das Produkt einen Ablauf, fragt „Kundenonboarding jetzt starten?“ (vorhandener Start-Dialog, nichts automatisch).
  const [onboardingFuer, setOnboardingFuer] = useState<string | null>(null);
  const ausProduktOffen = useRef(false);
  useEffect(() => {
    if (!ausProdukt || ausProduktOffen.current || !api.crm) return;
    ausProduktOffen.current = true;
    router.replace(mandateLink());
    if (api.crm.stand.leistungen.some(l => l.id === ausProdukt && !l.geloeschtAm)) { setNeuProdukt(ausProdukt); setNeuWahl(true); }
  }, [ausProdukt, api.crm, router]);
  const beendenRef = useRef<((m: Mandat) => void) | null>(null);
  const beendenOffen = useRef(false);
  useEffect(() => {
    if (beendenZiel !== '1' || beendenOffen.current || !api.crm || !liqui || !auswahl) return;
    const m = api.crm.stand.mandate.find(x => x.id === auswahl);
    if (!m) return;
    beendenOffen.current = true;
    router.replace(WEG.mandat(m.id));
    if (m.status !== 'beendet') beendenRef.current?.(m);
  }, [beendenZiel, api.crm, liqui, auswahl, router]);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const ich = api.ich;
  const REIHE = ['aktiv', 'verhandlung', 'angebot', 'pausiert', 'beendet'];
  const mandate = [...crm.stand.mandate].sort((a, b) => REIHE.indexOf(a.status) - REIHE.indexOf(b.status) || a.kunde.localeCompare(b.kunde));
  const laufend = mandate.filter(m => m.status !== 'beendet');
  const gefiltert = mandate.filter(m => passtWer(wahl, m.zustaendig, 'sales', ich) && passtGesellschaft(ges, m.gesellschaft));
  // Ein Mandat aus einem Link (z. B. hinter der Kündigungsrate) ist immer sichtbar — auch beendet oder bei jemand anderem.
  const gewaehlt = auswahl ? mandate.find(m => m.id === auswahl) : undefined;
  const basis = alle ? gefiltert : gefiltert.filter(m => m.status !== 'beendet');
  const sichtbar = gewaehlt && !basis.includes(gewaehlt) ? [...basis, gewaehlt] : basis;
  const beendetVerborgen = gefiltert.length - gefiltert.filter(m => m.status !== 'beendet').length;
  const zahlen = werZahlen(laufend, m => m.zustaendig, 'sales', ich);
  const offenePunkte = laufend.reduce((a, m) => a + m.offen.length, 0);
  const radar = mandate.filter(m => m.status === 'aktiv' && (crm.mandate[m.id]?.endeIn ?? 999) <= 90);
  const jePerson = kundenJePerson(crm.stand.mandate, crm.heute, crm.mandate);
  const meine = ich ? jePerson.find(x => x.person === ich) : undefined;
  // Neues Mandat: für die gefilterte Person, sonst für mich (im Team) — ohne beides gilt die Sales-Verantwortung.
  const neuFuer = wahl !== 'alle' && wahl !== 'ich' && mitglied(wahl) ? wahl : mitglied(ich)?.id;
  // „Mandat beenden“ (18.10., N6): EIN Dialog für Status-Wahl, Archivieren und den Weg aus dem Fulfillment — Ende-Datum (Vorgabe: Ende der Laufzeit),
  // Hinweise zu Mindestlaufzeit und Kündigungsfrist, und im selben Schritt endet der Liquiditätsplan (POST /api/crm/liquiplan `beenden`).
  const mandatBeenden = (m: Mandat, opt: { schliessen?: boolean } = {}) => {
    const heute = crm.heute;
    const wert = { current: beendenVorgabe(m, heute).tag };
    const mitPosten = !!liqui?.mandate.find(x => x.id === m.id)?.vorhanden;
    const vorher = { status: m.status, ende: m.ende };
    const name = mandatName(m.kunde, m.titel);
    ablage.fragen({ titel: `„${name}“ beenden?`, text: <BeendenFelder m={m} heute={heute} wert={wert} mitPosten={mitPosten} />, wahl: [{ label: 'Mandat beenden', tun: async () => {
      const h = beendenHinweise(m, wert.current, heute);
      if (h.fehler) { ablage.melden(`Nicht beendet — ${h.fehler}`); return; }
      if (opt.schliessen && auswahl === m.id) setAuswahl(null);
      if (!(await api.teil('mandate', m.id, { status: 'beendet', ende: wert.current }))) return;
      if (mitPosten) await fetch('/api/crm/liquiplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mandatId: m.id, aktion: 'beenden' }) }).catch(() => null);
      void ladeLiqui();
      ablage.melden(`„${name}“ beendet zum ${datum(wert.current)}${mitPosten ? ' — der Liquiditätsplan endet mit' : ''} · unter „Beendete zeigen“ zurückholbar`, () => void api.teil('mandate', m.id, nurFelder({ status: vorher.status, ende: vorher.ende })));
    } }] });
  };
  beendenRef.current = mandatBeenden;
  // Archivieren = Status „beendet“ (kein eigenes Feld): ein laufendes (bzw. pausiertes) Mandat über „Mandat beenden“ — es zählt danach nicht mehr in MRR und Radar.
  const beenden = (m: Mandat) => {
    const vorher = m.status;
    if (vorher === 'aktiv' || vorher === 'pausiert') { mandatBeenden(m, { schliessen: true }); return; }
    if (auswahl === m.id) setAuswahl(null);
    void api.teil('mandate', m.id, { status: 'beendet' });
    ablage.melden(`„${mandatName(m.kunde, m.titel)}“ beendet — unter „Beendete zeigen“ zurückholbar`, () => void api.teil('mandate', m.id, { status: vorher }));
  };
  const zurueckholen = (m: Mandat) => {
    const status: Mandat['status'] = m.vertragUnterschrieben ? 'aktiv' : 'verhandlung';
    void api.teil('mandate', m.id, { status });
    ablage.melden(`„${mandatName(m.kunde, m.titel)}“ ist zurück — ${status === 'aktiv' ? 'aktiv' : 'in Verhandlung (ohne Vertrag)'}`, () => void api.teil('mandate', m.id, { status: 'beendet' }));
  };
  const loeschen = (m: Mandat) => {
    if (auswahl === m.id) setAuswahl(null);
    ablage.loeschen(m.id, mandatName(m.kunde, m.titel), m.status === 'beendet' ? undefined : { archivAnbieten: false, text: 'Das Mandat läuft noch. Im Papierkorb ist es überall ausgeblendet (Umsatz, Zahlen, Suche). Gibt es Rechnungen, Dateien oder offene Follow-ups dazu, bleibt es stehen — dann ist „Beenden“ der Weg. Ist es nur vorbei: Archivieren (beendet).' });
  };
  // Neues Mandat ohne Deal (08.10., Woche 2 · 3.13): die Gesellschaft wird VOR dem Anlegen gewählt (bzw. aus dem Filter) — vorher entstand
  // es mit „offen“, und die Rechnung landete still bei der Vorgabe. Seit 10.10. IMMER mit Lead (Firma + Ansprechperson, vorhanden oder neu) —
  // der Dialog `MandatAnlegen` schreibt über EINEN Server-Weg (POST /api/crm/lead `mandat-neu`), die Firma steht danach unter den Kunden.
  const produktName = (m: Mandat) => { const p = crm.stand.leistungen.find(x => x.id === m.leistungId); const ph = mandatPhase(m, p); return p ? `${p.name.slice(0, 40)}${ph ? ` · Phase ${ph.nr}/${ph.von}` : ''}` : ''; };

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={() => setNeuWahl(true)}>+ Mandat</Knopf>}>Überblick</Ueberschrift>
        {zuordnen && <MandatAnlegen api={api} modus="zuordnen" mandatId={zuordnen} onZu={() => setZuordnen(null)} onFertig={() => setZuordnen(null)} />}
        {neuWahl && <MandatAnlegen api={api} modus="neu" {...(ges !== 'alle' ? { gesellschaft: ges } : {})} {...(neuProdukt ? { leistungId: neuProdukt } : {})} {...(neuFuer ? { zustaendig: neuFuer } : {})} onZu={() => { setNeuWahl(false); setNeuProdukt(null); }} onFertig={id => { setNeuWahl(false); setNeuProdukt(null); setAuswahl(id); setOnboardingFuer(id); }} />}
        {onboardingFuer && (() => { const nm = crm.stand.mandate.find(x => x.id === onboardingFuer); return nm ? <OnboardingFrage m={nm} produktName={crm.stand.leistungen.find(l => l.id === nm.leistungId)?.name} onZu={() => setOnboardingFuer(null)} /> : null; })()}
        <Raster min={150}>
          <Zahl wert={kurzEuro(crm.mrr)} label="wiederkehrend je Monat (netto)" farbe={LEUCHT.geld} />
          <Zahl wert={String(mandate.filter(m => m.status === 'aktiv').length)} label="aktive Mandate" />
          {/* Konzentration ist ein Risiko, keine Dringlichkeit (11.10.: Rot nur für Dringendes) — gelb, mit dem Satz darunter. */}
          <Zahl wert={crm.konzentration ? `${crm.konzentration.anteil} %` : '—'} label={crm.konzentration ? `größter Kunde: ${crm.konzentration.kunde.slice(0, 22)}` : 'Kundenkonzentration'} farbe={crm.konzentration && crm.konzentration.anteil > 50 ? LEUCHT.achtung : undefined} />
          <Zahl wert={String(offenePunkte)} label={offenePunkte === 1 ? 'offener Punkt oder Widerspruch' : 'offene Punkte & Widersprüche'} farbe={offenePunkte ? LEUCHT.achtung : undefined} />
        </Raster>
        {/* Antwort zuerst (11.10.): „Als Nächstes“ steht direkt unter den Zahlen, danach worauf zu achten ist — als Hinweis-Karten statt farbiger Textzeilen. */}
        {meine && (meine.kritisch > 0 || meine.reviews > 0) && (
          <div style={{ marginTop: 12 }}><Hinweis art="info" titel="Als Nächstes">{meine.kritisch > 0 ? `${meine.kritisch} deiner Mandate ${meine.kritisch === 1 ? 'ist' : 'sind'} kritisch — Gesundheit prüfen, offene Punkte klären, Verlängerung ansprechen.` : `${meine.reviews} Kundenreview${meine.reviews === 1 ? '' : 's'} in den nächsten 7 Tagen — Gesundheit bewerten, offene Punkte klären.`}</Hinweis></div>
        )}
        {((crm.konzentration && crm.konzentration.anteil > 50) || radar.length > 0) && (
          <div style={{ marginTop: 10 }}>
            <Hinweis art="achtung" titel="Worauf achten">
              {crm.konzentration && crm.konzentration.anteil > 50 && <div>Mehr als die Hälfte des wiederkehrenden Umsatzes hängt an einem Kunden — der Head of Sales priorisiert neue Mandate.</div>}
              {radar.length > 0 && <div>Laufzeitradar: {radar.map(m => { const t = crm.mandate[m.id]?.endeIn ?? 0; return `${m.kunde} (${t < 0 ? `seit ${-t} Tagen abgelaufen — Status klären` : `endet in ${t} Tagen`})`; }).join(' · ')}</div>}
            </Hinweis>
          </div>
        )}
        {jePerson.length > 1 && (
          <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
            {jePerson.map(x => (
              <div key={x.person} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
                <span style={{ minWidth: 76 }}><Person id={x.person} name groesse={18} /></span>
                <span>{x.aktiv} aktiv</span>
                <span><b style={{ color: C.ink }}>{kurzEuro(x.mrr)}</b> je Monat</span>
                {x.reviews > 0 && <span style={{ color: LEUCHT.achtung }}>{x.reviews} {x.reviews === 1 ? 'Review' : 'Reviews'} in 7 Tagen</span>}
                {x.kritisch > 0 && <span style={{ color: LEUCHT.kritisch }}>{x.kritisch} kritisch</span>}
                {x.offen > 0 && <span>{anzahl(x.offen, 'offener Punkt', 'offene Punkte')}</span>}
              </div>
            ))}
          </div>
        )}
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={`${sichtbar.length} ${sichtbar.length === 1 ? 'Mandat' : 'Mandate'}`}>Mandate</Ueberschrift>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
            <span role="group" aria-label="Nach Gesellschaft filtern"><Segmente liste={gesellschaftFilterFuer(nurBusiness || imBusiness).map(g => ({ id: g.id, label: breit ? g.label : g.kurz }))} aktiv={ges} onWahl={setGes} /></span>
          </div>
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, minHeight: 44 }}>{alle ? 'Beendete ausblenden' : `Beendete zeigen (${beendetVerborgen})`}</button>
            {(ablage.korb.length > 0 || korbOffen) && <button onClick={() => setKorbOffen(!korbOffen)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, minHeight: 44 }}>{korbOffen ? 'Papierkorb schließen' : `Papierkorb (${ablage.korb.length})`}</button>}
          </span>
        </div>
        <Liste>
          {sichtbar.map(m => {
            const l = crm.mandate[m.id];
            const lq = liqui?.mandate.find(x => x.id === m.id);
            return (
              <div key={m.id} id={`ziel-${m.id}`}>
                <ZeileAktionen titel={mandatName(m.kunde, m.titel)} archiviert={m.status === 'beendet'} onArchivieren={() => (m.status === 'beendet' ? zurueckholen(m) : beenden(m))} onLoeschen={() => loeschen(m)}
                  loeschenFragt={m.status !== 'beendet'} href={WEG.mandat(m.id)} onOeffnen={() => setAuswahl(m.id)}
                  mehr={[
                    ...(m.firmaId ? [{ id: 'firma', label: 'Firma öffnen', tun: () => router.push(WEG.firma(m.firmaId)) }] : [{ id: 'firma-zuordnen', label: 'Firma zuordnen', tun: () => setZuordnen(m.id) }]),
                    ...(m.kontaktIds[0] ? [{ id: 'kontakt', label: 'Ansprechpartner öffnen', tun: () => zuKontakt(m.kontaktIds[0]) }] : []),
                    { id: 'zoe', label: 'Mit ZOE besprechen', hinweis: 'ZOE öffnet mit diesem Bezug', tun: () => zoeFragen({ art: 'mandat', id: m.id }) },
                  ]}>
                <Zeile onClick={() => setAuswahl(auswahl === m.id ? null : m.id)} aktiv={auswahl === m.id}
                  links={<Punkt farbe={l?.ampel ? AMPEL[l.ampel] : statusFarbe(m.status)} />}
                  titel={<MandatTitel m={m} />}
                  unter={[produktName(m), ...(!breit ? [lq?.lage === 'fehlt' ? 'nicht im Liquiplan' : lq?.lage === 'abweichend' ? abweichText(lq) : lq?.lage === 'endet' ? 'Liquiplan läuft weiter' : '', !m.vertragUnterschrieben && m.status !== 'beendet' ? 'ohne Vertrag' : ''] : []), m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'Honorar offen', l?.endeAm ? `bis ${datum(l.endeAm)}` : '', l?.health != null ? `Gesundheit ${l.health}` : '', m.offen.length ? `${m.offen.length} offen` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {breit && lq?.lage === 'fehlt' && <Chip farbe={LEUCHT.achtung}>nicht im Liquiplan</Chip>}
                    {breit && lq?.lage === 'abweichend' && <Chip farbe={LEUCHT.achtung}>{abweichText(lq)}</Chip>}
                    {breit && lq?.lage === 'endet' && <Chip farbe={LEUCHT.achtung}>Liquiplan läuft weiter</Chip>}
                    {breit && !m.vertragUnterschrieben && m.status !== 'beendet' && <Chip farbe={C.inkLeise}>ohne Vertrag</Chip>}
                    {breit && !m.firmaId && <Chip farbe={LEUCHT.achtung}>ohne Firma</Chip>}
                    <Chip farbe={statusFarbe(m.status)}>{STATUS.find(s => s.id === m.status)?.label}</Chip>
                    <Person id={zustaendig(m.zustaendig, 'sales')} groesse={18} />
                  </span>} />
                </ZeileAktionen>
                {auswahl === m.id && <MandatDetail m={m} api={api} lq={lq} frei={liqui?.freiePosten ?? []} neuLaden={ladeLiqui} zuKontakt={zuKontakt} onBeenden={() => mandatBeenden(m)} />}
              </div>
            );
          })}
        </Liste>
        {!sichtbar.length && <Leer>{mandate.length && wahl !== 'alle' ? `Hier liegt kein laufendes Mandat bei ${wahl === 'ich' ? 'dir' : nameVon(wahl)} — „Alle“ zeigen oder ein Mandat übergeben.` : 'Noch keine Mandate.'}</Leer>}
      </Karte>
      {korbOffen && <PapierkorbKarte ablage={ablage} liste="mandate" i={2} />}
      {ablage.dialog}
      {ablage.hinweis}

      <HeadPanel head="sales" standardModus="kundenreview" zuKontakt={zuKontakt} i={2} />
    </>
  );
}

function MandatDetail({ m, api, lq, frei, neuLaden, zuKontakt, onBeenden }: { m: Mandat; api: CrmApi; lq?: LiquiLage; frei: { id: string; titel: string; betrag: number }[]; neuLaden: () => void; zuKontakt: (id: string) => void; onBeenden: () => void }) {
  const crm = api.crm!;
  const l = crm.mandate[m.id];
  // Nur die geänderten Felder — Kevin und Malin können gleichzeitig am selben Mandat arbeiten.
  const setze = (teil: Partial<Mandat>) => api.teil('mandate', m.id, nurFelder(teil));
  const produkt = m.leistungId ? crm.stand.leistungen.find(x => x.id === m.leistungId) : undefined;
  const firma = firmaVonMandat(m, crm.stand.firmen);
  const personen = m.kontaktIds.map(id => (api.kontakte ?? []).find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k);
  const liquiplan = async (aktion: 'anlegen' | 'verknuepfen' | 'beenden', postenId?: string) => {
    await fetch('/api/crm/liquiplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mandatId: m.id, aktion, postenId }) });
    neuLaden(); void api.laden();
  };
  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      {m.offen.length > 0 && (
        <div style={{ padding: 12, borderRadius: 12, background: `${LEUCHT.achtung}10`, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: LEUCHT.achtung, letterSpacing: '.06em', textTransform: 'uppercase' }}>Offen & widersprüchlich</div>
          {m.offen.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
              <span style={{ flex: 1 }}>{o}</span>
              <button onClick={() => setze({ offen: m.offen.filter((_, j) => j !== i) })} title="Geklärt" aria-label="Geklärt" style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer' }}>✓</button>
            </div>
          ))}
        </div>
      )}
      <Feldzeile label="Zuständig">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={m.zustaendig} welt="sales" onWahl={z => void api.teil('mandate', m.id, { zustaendig: z })} />
          <Uebergeben api={api} art="mandat" id={m.id} jetzt={zustaendig(m.zustaendig, 'sales')} klein />
        </div>
      </Feldzeile>
      {m.chanceId && <Feldzeile label="Deal"><Link href={WEG.deal(m.chanceId)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>Deal öffnen ›</Link></Feldzeile>}
      {istBusinessGesellschaft(m.gesellschaft) && <Feldzeile label="Fulfillment"><Link href={WEG.fall(m.id)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>Fulfillment öffnen ›</Link></Feldzeile>}
      {/* „Beendet“ öffnet „Mandat beenden“ (18.10., N6: vorher sofort `ende = heute`, auch mitten in der Mindestlaufzeit). */}
      <Feldzeile label="Status"><Wahl label="Status" liste={STATUS} wert={m.status} onWahl={status => (status === 'beendet' && m.status !== 'beendet' ? onBeenden() : setze({ status }))} /></Feldzeile>
      <Feldzeile label="Vertrag"><Wahl label="Vertrag" liste={VERTRAG} wert={m.vertragUnterschrieben ? 'ja' : 'nein'} farbe={m.vertragUnterschrieben ? LEUCHT.gut : C.aktiv} onWahl={x => setze({ vertragUnterschrieben: x === 'ja' })} /></Feldzeile>
      <Feldzeile label="Kunde"><Feld wert={m.kunde} onFertig={kunde => kunde.trim() && setze({ kunde: kunde.trim() })} /></Feldzeile>
      {/* Mandanten klickbar (28.09.): das Mandat führt zurück in die Firmenakte (per Kennung, sonst eindeutiger Name). */}
      {firma ? <Feldzeile label="Firma"><span style={{ fontSize: TYP.bedien }}><MandantLink firmaId={firma.id} firmaDa name={firma.name} /></span></Feldzeile>
        : <Feldzeile label="Firma"><span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>{m.firmaId && <MandantLink firmaId={m.firmaId} firmaDa={false} name={m.kunde} />}<FirmaZuordnen api={api} mandatId={m.id} /></span></Feldzeile>}
      <Feldzeile label="Titel"><Feld wert={m.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Produkt">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Produkt" liste={crm.stand.leistungen.filter(x => (x.status !== 'eingestellt' && !x.geloeschtAm) || x.id === m.leistungId).map(x => ({ id: x.id, label: x.name }))} wert={m.leistungId}
            onWahl={leistungId => leistungId !== m.leistungId && setze({ leistungId, phase: undefined })} onLeeren={() => setze({ leistungId: undefined, phase: undefined })} />
          {produkt && <Link href={mandateLink('produkte', produkt.id)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>Produkt öffnen ›</Link>}
        </div>
      </Feldzeile>
      {/* 17.10. (dritte Abnahme B6): läuft ein Fulfillment-Fall, steht hier SEINE Phase mit dem Sprung in die Reise — der Ablauf des Produkts nur ohne Fall. */}
      <FallPhase mandatId={m.id} rahmen={inhalt => <Feldzeile label="Phase">{inhalt}</Feldzeile>}
        ohne={produkt ? (produkt.phasen?.length
          ? <Wahl label="Phase" liste={produkt.phasen.map(p => ({ id: p.id, label: p.name }))} wert={m.phase ?? produkt.phasen[0].id} onWahl={phase => setze({ phase })} farbe={LEUCHT.business} />
          : <Link href={WEG.fall(m.id)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Kein laufender Fall — im Fulfillment ansehen ›</Link>) : null} />
      {/* Leistungstreppe (10.10.): Fortschritt im Paket, Health-Ampel, nächste Stufe und der Fortschritts-Report an den Kunden. */}
      <MandatFortschritt mandatId={m.id} />
      <Feldzeile label="Honorar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={m.honorar.betrag ? String(m.honorar.betrag) : ''} breite={120} platzhalter="€" onFertig={b => setze({ honorar: { ...m.honorar, betrag: Number(b) || 0 } })} />
          <Wahl label="Honorar-Basis" liste={HONORAR_BASIS} wert={m.honorar.basis} onWahl={basis => setze({ honorar: { ...m.honorar, basis } })} />
          <Wahl label="netto oder brutto" liste={NETTO} wert={m.honorar.netto ? 'netto' : 'brutto'} onWahl={x => setze({ honorar: { ...m.honorar, netto: x === 'netto' } })} />
          <Wahl label="Umsatzsteuer" liste={UST} wert={String(m.ustSatz) === '0' ? '0' : String(m.ustSatz) === '19' ? '19' : null} onWahl={x => setze({ ustSatz: Number(x) })} />
        </div>
      </Feldzeile>
      {/* Mandat = Hauptprodukt + Zusatzmodule (19.10., P3): Module mit Honorar, inklusive, „abrechnen“; Rechnung und Liquidität kennen sie. */}
      <MandatZusatzModule m={m} katalog={crm.stand.leistungen} setze={setze} />
      {/* Mandat an Zielen und Zeit (28.09.): erfasste Fokus-Zeit dieses Mandats im laufenden Monat */}
      <Feldzeile label="Zeit"><MandatZeitMonat mandatId={m.id} /></Feldzeile>
      {/* K3 (30.09.): am Mandat verknüpfte Termine (kalender-bezug), Klick öffnet den Kalender. */}
      <Feldzeile label="Termine"><TermineAkte frage={{ mandate: [m.id] }} heute={crm.heute} /></Feldzeile>
      <Feldzeile label="Laufzeit">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="date" wert={m.start} breite={150} platzhalter="Start" onFertig={start => setze({ start: start || undefined })} />
          <span style={{ color: C.inkLeise }}>bis</span>
          <Feld typ="date" wert={m.ende} breite={150} platzhalter="Ende" onFertig={ende => setze({ ende: ende || undefined })} />
          <Feld typ="number" wert={m.kuendigungsfristTage ? String(m.kuendigungsfristTage) : ''} breite={120} platzhalter="Frist Tage" onFertig={f => setze({ kuendigungsfristTage: Number(f) || undefined })} />
          <Wahl label="Verlängerung" liste={VERLAENGERUNG} wert={m.verlaengerung} onWahl={verlaengerung => setze({ verlaengerung })} />
        </div>
        {l?.endeAm && <div style={{ fontSize: TYP.bedien, color: l.endeIn !== null && l.endeIn <= 90 ? LEUCHT.achtung : C.inkLeise, marginTop: 4 }}>Ende {datum(l.endeAm)} ({l.endeIn} Tage){l.fristBis && l.fristBis !== l.endeAm ? ` · kündbar bis ${datum(l.fristBis)}` : ''}</div>}
      </Feldzeile>
      {/* Vertrag (19.10., P3): Mindestlaufzeit, Rhythmus, Zahlungsziel — pflegbar, daneben was das Produkt vorsieht. */}
      <MandatVertrag m={m} produkt={produkt} setze={setze} />
      <Feldzeile label="Gesellschaft"><GesellschaftWahl wert={m.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      <Feldzeile label="Nächstes Review"><Feld typ="date" wert={m.naechstesReview} breite={160} platzhalter="Datum" onFertig={r => setze({ naechstesReview: r || undefined })} /></Feldzeile>
      <div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Gesundheit des Mandats {l?.health != null ? `· ${l.health}` : '— noch nicht bewertet'} (unter 60 rot, bis 75 gelb){m.health.zahlung === null && crm.zahlung?.[m.id] ? ` · Zahlung aus dem Finanzplan: ${crm.zahlung[m.id]!.wert} (${crm.zahlung[m.id]!.text})` : ''}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(HEALTH_GEWICHTE) as (keyof typeof HEALTH_GEWICHTE)[]).map(f => (
            <div key={f} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 44px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{HEALTH_LABEL[f]} <span style={{ color: C.inkLeise }}>{HEALTH_GEWICHTE[f]}</span></span>
              {m.health[f] == null
                ? <button onClick={() => setze({ health: { ...m.health, [f]: 70 } })} style={{ justifySelf: 'start', background: 'none', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 8, color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 10px' }}>bewerten</button>
                : <input type="range" min={0} max={100} step={5} value={m.health[f]!} aria-label={HEALTH_LABEL[f]} onChange={e => setze({ health: { ...m.health, [f]: Number(e.target.value) } })} style={{ accentColor: m.health[f]! >= 75 ? LEUCHT.gut : m.health[f]! >= 60 ? LEUCHT.achtung : LEUCHT.kritisch }} />}
              <span style={{ fontSize: TYP.bedien, color: m.health[f] == null ? C.inkLeise : C.ink, textAlign: 'right' }}>{m.health[f] ?? '–'}</span>
            </div>
          ))}
        </div>
      </div>
      <Feldzeile label="Liquiditätsplan">
        {!lq && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</span>}
        {lq?.lage === 'ok' && <Link href={WEG.planposten(lq.vorhanden?.id)} style={{ fontSize: TYP.bedien, color: LEUCHT.gut, textDecoration: 'none' }}>steht drin{lq.soll.length > 1 ? ` — mit ${lq.soll.length - (lq.soll.some(p => p.rhythmus !== 'einmalig') ? 1 : 0)} Teilmonat${lq.soll.length > 2 ? 'en' : ''}` : ''} — Posten öffnen ›</Link>}
        {/* N14 (18.10.): der Satz je Fall — nie mehr „Status oder Honorar fehlt“ bei einem beendeten Mandat. */}
        {lq?.lage === 'kein-posten' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{lq.grund ?? 'kein Posten'}</span>}
        {lq?.lage === 'beendet' && (
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
            <span>{lq.grund}</span>
            {lq.vorhanden && <Link href={WEG.planposten(lq.vorhanden.id)} style={{ color: C.inkLeise, textDecoration: 'none' }}>Posten öffnen ›</Link>}
          </span>
        )}
        {lq?.lage === 'endet' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{lq.grund}</span>
            <Knopf leise onClick={() => liquiplan('beenden')}>{lq.letzteZahlung ? `Posten zum Mandatsende angleichen (letzte Zahlung ${datum(lq.letzteZahlung)})` : 'Posten zum Mandatsende angleichen'}</Knopf>
          </div>
        )}
        {(lq?.lage === 'fehlt' || lq?.lage === 'abweichend') && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{lq.lage === 'fehlt' ? 'Fehlt im Liquiditätsplan — würde eintragen:' : `Weicht ab: ${lq.grund ?? ''} Angeglichen hieße das:`}</span>
            <SollListe soll={lq.soll} heute={crm.heute} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Knopf leise onClick={() => liquiplan('anlegen')}>{lq.lage === 'fehlt' ? 'Eintragen' : 'Plan angleichen'}</Knopf>
              {lq.lage === 'fehlt' && frei.slice(0, 4).map(p => <Knopf key={p.id} leise onClick={() => liquiplan('verknuepfen', p.id)}>= {p.titel.slice(0, 26)} ({euro(p.betrag)})</Knopf>)}
            </div>
          </div>
        )}
      </Feldzeile>
      <Feldzeile label="Ansprechpartner">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{personen.map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 999, padding: '5px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>{anzeigename(k)}</button>)}{!personen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>—</span>}</div>
      </Feldzeile>
      <MandatRechnungen m={m} />
      <MandatLeistungen m={m} setze={setze} />
      <Feldzeile label="Offener Punkt"><Feld leeren platzhalter="Neuer offener Punkt …" onFertig={t => t.trim() && setze({ offen: [...m.offen, t.trim()] })} /></Feldzeile>
      {m.quelle && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Quelle: {m.quelle}</div>}
    </div>
  );
}

/** Was ein Mandat im Liquiditätsplan einträgt: Teilmonate (einmalig) und die vollen Monate — mit Betrag und Zahltagen. */
function SollListe({ soll, heute }: { soll: Planposten[]; heute: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>
      {soll.map(p => <li key={p.id} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>{p.rhythmus === 'einmalig' && p.titel.includes(' — ') ? p.titel.split(' — ').pop() : p.rhythmus === 'einmalig' ? 'einmalig' : 'volle Monate'}: <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{euroCent(p.betrag)}</b> brutto · {postenZeitText(p, heute)}</li>)}
    </ul>
  );
}

/**
 * Inhalt der Rückfrage „Mandat beenden“ (18.10., N6): Ende-Datum (Vorgabe: Ende der Laufzeit), die Hinweise dazu (rein, `beendenHinweise`) und was im
 * selben Schritt passiert. Der gewählte Tag steht in `wert` (die Rückfrage liest ihn beim Klick).
 */
function BeendenFelder({ m, heute, wert, mitPosten }: { m: Mandat; heute: string; wert: { current: string }; mitPosten: boolean }) {
  const vorgabe = beendenVorgabe(m, heute);
  const [ende, setEnde] = useState(wert.current);
  const h = beendenHinweise(m, ende, heute);
  return (
    <span style={{ display: 'grid', gap: 10, whiteSpace: 'normal' }}>
      <span>Status „beendet“: es zählt dann nicht mehr im wiederkehrenden Umsatz und im Laufzeitradar; Rechnungen, Zeiten und Verlauf bleiben. Zurückholen geht jederzeit.</span>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ende (letzter Tag der Leistung)</span>
        <input type="date" value={ende} onChange={e => { setEnde(e.target.value); wert.current = e.target.value; }} style={{ ...feld, colorScheme: 'dark', maxWidth: 220 }} aria-label="Ende des Mandats" />
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{vorgabe.art === 'laufzeit' ? `Vorgabe: Ende der Laufzeit (${datum(vorgabe.tag)})` : vorgabe.art === 'ende' ? `Vorgabe: das Ende am Mandat (${datum(vorgabe.tag)})` : 'Vorgabe: heute'}</span>
      </label>
      {h.fehler && <span style={{ color: LEUCHT.kritisch }}>{h.fehler}</span>}
      {h.hinweise.map(t => <span key={t} style={{ color: LEUCHT.achtung }}>{t}</span>)}
      {mitPosten && <span>Der Liquiditätsplan endet im selben Schritt mit dem Mandat — der letzte Monat anteilig wie die Rechnung.</span>}
    </span>
  );
}

/**
 * Deals › Kunden (seit 25.09., Reiter seit 27.09.): nur noch die Kurzfassung — Monatsumsatz,
 * laufende Mandate, ein Klick öffnet das Mandat unter Produkte & Mandate.
 */
export function KundenKurz({ api }: { api: CrmApi }) {
  const router = useRouter();
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const p = portfolio(crm.stand);
  const REIHE = ['aktiv', 'verhandlung', 'angebot', 'pausiert'];
  const laufend = crm.stand.mandate.filter(m => m.status !== 'beendet').sort((a, b) => REIHE.indexOf(a.status) - REIHE.indexOf(b.status) || a.kunde.localeCompare(b.kunde));
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<Link href={mandateLink()} style={{ color: LEUCHT.business, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600 }}>Produkte & Mandate ›</Link>}>Ebene 3 · Kunden</Ueberschrift>
      <Raster min={150}>
        <Zahl wert={kurzEuro(p.mrr)} label="wiederkehrend je Monat (netto)" farbe={LEUCHT.geld} />
        <Zahl wert={String(p.aktiv)} label="aktive Mandate" />
        <Zahl wert={p.groessterKunde ? `${Math.round(p.groessterKunde.anteil * 100)} %` : '—'} label={p.groessterKunde ? `größter Kunde: ${p.groessterKunde.kunde.slice(0, 22)}` : 'Kundenkonzentration'} farbe={p.groessterKunde && p.groessterKunde.anteil > 0.5 ? LEUCHT.kritisch : undefined} />
      </Raster>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '10px 0 4px', lineHeight: 1.5 }}>Die Mandate und Produkte leben unter „Produkte & Mandate“ (links in der Leiste). Aus einem gewonnenen Deal entsteht das Mandat wie bisher über „Mandat anlegen“.</div>
      <Liste>
        {laufend.map(m => (
          <Zeile key={m.id} onClick={() => router.push(mandateLink('mandate', m.id))} links={<Punkt farbe={crm.mandate[m.id]?.ampel ? AMPEL[crm.mandate[m.id]!.ampel!] : statusFarbe(m.status)} />}
            titel={<MandatTitel m={m} />}
            unter={m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'Honorar offen'}
            rechts={<Chip farbe={statusFarbe(m.status)}>{STATUS.find(s => s.id === m.status)?.label}</Chip>} />
        ))}
      </Liste>
      {!laufend.length && <Leer>Noch keine laufenden Mandate.</Leer>}
    </Karte>
  );
}

interface RechnungKurz { id: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string; bezahltAm?: string; mandatId?: string; firmaId?: string }

/**
 * Rechnungen zum Mandat (26.09.): was gestellt, offen, überfällig ist — je Zeile die Rechnung. Neue Rechnung NUR über den einen Anleger
 * (08.10., Woche 2 · 3.13: Monatsrechnung aus dem Honorar → Editor, gestellt mit Nummer + PDF); das frühere „nur planen“ schrieb daneben
 * direkt in den Finanzplan. Gesellschaft „offen“ → erst wählen. Ohne Finanz-Zugang (403) sagt die Zeile das, statt „keine Rechnung“ (3.16).
 */
function MandatRechnungen({ m }: { m: Mandat }) {
  const router = useRouter();
  const [liste, setListe] = useState<RechnungKurz[] | 'kein' | 'fehler' | null>(null);
  const heute = localDay();
  useEffect(() => {
    let lebt = true;
    // Über die Rechnungs-Route (17.10., Abnahme 3 · B9): sie filtert serverseitig nach der Sicht des Kontos — ein Konto „nur Business“ bekommt
    // die Rechnungen der Business-Gesellschaften (wie Cockpit und Head of Finance) statt eines 403 vom gemeinsamen Finanzplan.
    fetch('/api/rechnung').then(async r => {
      if (!lebt) return;
      if (r.status === 403) { setListe('kein'); return; }
      const d = await r.json().catch(() => null) as { rechnungen?: RechnungKurz[] } | null;
      setListe(d ? d.rechnungen ?? [] : 'fehler');
    }).catch(() => { if (lebt) setListe('fehler'); });
    return () => { lebt = false; };
  }, [m.id]);
  const eigene = (Array.isArray(liste) ? liste : []).filter(r => r.mandatId === m.id || (!r.mandatId && rechnungPasst(m, r))).sort((a, b) => (b.faellig ?? '').localeCompare(a.faellig ?? ''));
  const offen = eigene.filter(r => r.status === 'gestellt');
  const ueber = offen.filter(r => r.faellig && r.faellig < heute);
  // Register-Gesellschaft (04.10.): der Finanzplan führt sie noch nicht — ehrlich sagen statt still bei der Selbstständigkeit ablegen.
  // „offen“ (Mandat ohne Deal angelegt, Woche 2 · 3.13): nicht still die Vorgabe — erst oben die Gesellschaft wählen.
  const offenGes = mandatGesellschaftOffen(m.gesellschaft);
  const finanzFirma = offenGes ? null : finanzFirmaFuer(m.gesellschaft);
  const [fehler, setFehler] = useState<string | null>(null);
  // Monatsrechnung mit PDF (08.10.): ein Entwurf je Leistungsmonat auf Klick — gestellt wird erst im Editor (nie automatisch).
  const monat = heute.slice(0, 7);
  const vormonat = tagePlus(`${monat}-01`, -1).slice(0, 7);
  // Nur Monate, in denen das Mandat läuft (18.10.: Beginn und Ende — der Server lehnt andere mit 409 ab; der Teilmonat rechnet anteilig).
  const vormonatLief = mandatLaeuftIm(m, vormonat);
  const monatLaeuft = mandatLaeuftIm(m, monat);
  // Läuft es in keinem der beiden (beginnt später bzw. endete früher): sein nächster bzw. letzter Monat.
  const andererMonat = !vormonatLief && !monatLaeuft ? mandatMonatVorgabe(m, heute) : null;
  const monatsrechnung = async (mo: string) => {
    const e = await entwurfAnlegen({ quelle: 'mandat', mandatId: m.id, monat: mo });
    if (!e.id) { setFehler(e.fehler ?? 'Nicht angelegt.'); return; }
    router.push(WEG.rechnungSchreiben(e.id));
  };
  return (
    <Feldzeile label="Rechnungen">
      {/* minmax(0, 1fr) (17.10., Abnahme 3 · B8): die Rechnungszeile kürzt mit „…“ statt die Seite am Handy quer zu schieben. */}
      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
        {liste === null && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</span>}
        {liste === 'kein' && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{KEIN_RECHNUNGS_ZUGANG}</span>}
        {liste === 'fehler' && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Rechnungen nicht erreichbar — gleich noch einmal öffnen.</span>}
        {Array.isArray(liste) && !eigene.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>noch keine Rechnung zu diesem Mandat</span>}
        {eigene.slice(0, 5).map(r => (
          <Link key={r.id} href={WEG.rechnung(r.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien, color: C.ink, textDecoration: 'none' }}>
            <Punkt farbe={r.status === 'bezahlt' ? LEUCHT.gut : r.faellig && r.faellig < heute ? LEUCHT.kritisch : r.status === 'gestellt' ? LEUCHT.achtung : C.inkLeise} groesse={7} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titel || r.kunde} <span style={{ color: C.inkLeise }}>· {r.status}{r.faellig ? ` · fällig ${datum(r.faellig)}` : ''}</span></span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euro(r.betrag)}</span><span style={{ color: C.inkLeise }}>›</span>
          </Link>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Den Vormonat nur, wenn das Mandat da schon lief (17.10., Gesamtprüfung L1 B9 — vorher „Rechnung für September“ bei Start am 17.10.). */}
          {liste !== 'kein' && m.honorar.betrag > 0 && finanzFirma && vormonatLief && <Knopf leise onClick={() => monatsrechnung(vormonat)}>Rechnung für {monatsName(vormonat)} schreiben</Knopf>}
          {liste !== 'kein' && m.honorar.betrag > 0 && finanzFirma && andererMonat && mandatLaeuftIm(m, andererMonat) && <Knopf leise onClick={() => monatsrechnung(andererMonat)}>Rechnung für {monatsName(andererMonat)} schreiben</Knopf>}
          {liste !== 'kein' && m.honorar.betrag > 0 && finanzFirma && monatLaeuft && <Knopf leise onClick={() => monatsrechnung(monat)}>{vormonatLief ? '… für' : 'Rechnung für'} {monatsName(monat)}{vormonatLief ? '' : ' schreiben'}</Knopf>}
          {liste !== 'kein' && offenGes && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Gesellschaft noch „offen“ — oben wählen, dann lässt sich die Rechnung schreiben.</span>}
          {liste !== 'kein' && m.honorar.betrag > 0 && !finanzFirma && !offenGes && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{NUR_GRUNDDATEN}</span>}
          {ueber.length > 0 && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{ueber.length} überfällig</span>}
          {fehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{fehler}</span>}
          {eigene.length > 5 && <Link href={WEG.rechnungen()} style={{ fontSize: TYP.bedien, color: C.inkLeise }}>alle ›</Link>}
        </div>
      </div>
    </Feldzeile>
  );
}
