'use client';

// ─── MAKE OS — Finanzen ─────────────────────────────────────────────────────
// Kevin, 24.09.: „dass wir in unserem Dashboard wirklich über Privat und über Business unterscheiden können.“ 25.09.: „Alles unter
// Zahlen“ (seit 08.10. heißt der Bereich überall „Finanzen“). Hinter jeder Kachel stehen Punkte mit Links bis zur Buchung, Rechnung
// oder zum Beleg (lib/wege.ts).
//
// 08.10. (Aufräumen Etappe 2, Kevin: „Die Software wirkt unaufgeräumt und überladen“): höchstens ZWEI Ebenen, jede Sache an EINEM
// Ort. Der Bereich (Privat/Business) kommt aus dem Kopf-Schalter bzw. `?space=`; „Alles“/ohne Space = Privat (Privat darf Business
// sehen, nie umgekehrt). Aufbau und Regeln: lib/finanzen/navigation.ts.
//   Privat    Überblick · Konten & Buchungen (Ebene 2: Buchungen … Schulden, Selbstständigkeit) · Planung (Ebene 2: Blätter) · Steuern
//   Business  Überblick (Ebene 2: Cockpit · Controlling & Ziele) · Rechnungen & Zahlungen (oben: Rechnungen schreiben mit PDF, 08.10.) · Liquidität · Buchungen · Planung · Steuern
//   Head of Finance = Knopf auf der Seite. Gesamt (die Brücke) steht einmal: unten auf Privat › Überblick (#gesamt).
// 22.10. abends (Werkzeug Finanzen, Gruppe A): Ebene 1 ist das Menü der linken Leiste (lib/make-one/werkzeuge.ts `FINANZEN_WERKZEUG`, Punkte NUR aus
// `FINANZ_MENUE`) — die Reiterleiste hier ist weg; Cockpit und Controlling & Ziele sind Menüpunkte (ihre Pillenreihe ist weg). Ebene 2 bleibt: die Pillen unter
// Konten & Buchungen und die Blätter der Planung. „Automationen & Head“ = s=chef: oben die Abläufe des Bereichs und die Karte(n) der Heads
// (BereichAutomationen), darunter der Head of Finance. Am Handy steht das Menü oben im Blatt „Menü“.
// Die früheren Nebenseiten (/os/finanzen/planung, …/liquiditaet, …/buchungen, …/grundlage, …/dashboard, /os/controlling) leiten in
// next.config.mjs mit allen Parametern hierher. Wer keinen Haushalt hat, sieht nur Business (Überblick, Planung) und den Head of Finance.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot } from 'lucide-react';
import { Seite, Pillen, Knopf, Karte, Ueberschrift, LEUCHT } from './ui';
import { ZahlenBusiness } from './ZahlenView';
import { HaushaltView } from './haushalt/HaushaltView';
import { GesamtView } from './haushalt/GesamtView';
import { FinanzchefView } from './FinanzchefView';
import { BusinessCockpit } from './business/BusinessCockpit';
import { SteuernView } from './steuern/SteuernView';
import { Finanzplan } from './finanzplan/Finanzplan';
import { FinanzplanungView } from './FinanzplanungView';
import { RechnungenKarte } from './rechnung/RechnungenKarte';
import { LiquiditaetView } from './LiquiditaetView';
import { BuchungenView } from './BuchungenView';
import { ControllingView } from './ControllingView';
import { GrundlageView } from './GrundlageView';
import { useZuZiel } from './ziel';
import { useSpace } from '@/hooks/useSpace';
import { useHaushaltZugang } from './useInhaber';
import { FINANZ_MENUE, finanzOrt, finanzAdresse, finanzMenueId, finanzMenueErlaubt, kontenUnter, type FinanzMenueId, type FinanzOrt, type KontenUnter } from '@/lib/finanzen/navigation';
import { FINANZEN_WERKZEUG } from '@/lib/make-one/werkzeuge';
import { BereichAutomationen } from './werkzeug/BereichAutomationen';

/** Ein Satz je Ort (eine Zeile, Design-Standard) — aus dem Menü (`FINANZ_MENUE`), der Head of Finance eigens. */
const CHEF_SATZ = 'Automationen & Head · Abläufe, Lage, Fristen, Vorschläge zur Freigabe';

export function FinanzenView() {
  const router = useRouter(); const p = useSearchParams();
  const { space } = useSpace();
  // Zugang zu den privaten Haushaltsfinanzen aus dem Konto (15.10., Abnahme 2 B8) — vorher eine Anfrage, die für „nur Business“ mit 403 endete.
  const zugang = useHaushaltZugang();
  // Business-Index und Steuern gehören dem Haushalt des Inhabers (eigene Prüfung in der API).
  const [inhaber, setInhaber] = useState<boolean | null>(null);
  // Planung (04.10. spät): auch Konten ohne Privatzugang (Finanzrecht „nur Business“) haben sie — der Server filtert.
  const [planZugang, setPlanZugang] = useState(false);
  useEffect(() => {
    fetch('/api/finanzplan?nur=kennzahlen').then(r => setPlanZugang(r.ok)).catch(() => setPlanZugang(false));
    fetch('/api/business?scope=gesamt&kompakt=1').then(r => setInhaber(r.ok)).catch(() => setInhaber(false));
  }, []);

  const ort: FinanzOrt = finanzOrt(new URLSearchParams(p.toString()), { gemerkt: space, haushalt: zugang });
  const { bereich } = ort;
  // Der Punkt des Menüs (Ebene 1, in der Leiste): nur, was dieses Konto hat (`finanzMenueErlaubt` — dieselbe Regel wie das Menü); sonst der erste.
  // Ohne Haushalt nur Cockpit, Rechnungen und Planung (der Server filtert), Steuern und Controlling nur im Haushalt des Inhabers.
  const erlaubt = FINANZ_MENUE[bereich].filter(m => finanzMenueErlaubt(m.id, { haushalt: zugang, planZugang, inhaber }));
  const gewuenscht = finanzMenueId(ort);
  const punkt: FinanzMenueId | 'chef' = gewuenscht === 'chef' || erlaubt.some(m => m.id === gewuenscht) ? gewuenscht : erlaubt[0]?.id ?? 'business';

  // Ort wechseln = router.push (Zurück führt zum vorigen Ort, 25.09.); die Filter des alten Ortes fallen weg.
  const geh = (ziel: Parameters<typeof finanzAdresse>[1]) => router.push(finanzAdresse(bereich, ziel), { scroll: false });

  // #gesamt (die Brücke), #altbestand, #einstellungen und #eroeffnung (Fuß des Menüs) springen nach dem Laden hin — auch, wenn nur die Adresse wechselt.
  useZuZiel(null, zugang !== null, p.toString());

  const chefAn = punkt === 'chef';
  // Head of Finance bleibt zusätzlich ein Knopf auf der Seite (er führt zu „Automationen & Head“).
  const chefKnopf = zugang !== null && !chefAn && (
    <Knopf leise href={finanzAdresse(bereich, 'chef')} ariaLabel="Head of Finance" titel="Head of Finance — Lage, Fristen, Vorschläge zur Freigabe">
      <Bot size={16} /><span className="ui-nur-breit">Head of Finance</span>
    </Knopf>
  );

  // Ebene 2 — nur unter Konten & Buchungen (die Blätter der Planung stehen in der Planung selbst).
  const ebene2 = punkt === 'konten' ? <Pillen einzeilig liste={kontenUnter()} aktiv={ort.unter as KontenUnter} onWahl={geh} /> : null;

  const unterSatz = chefAn ? CHEF_SATZ : FINANZ_MENUE[bereich].find(m => m.id === punkt)?.titel ?? '';
  const breit = chefAn ? undefined : 1440;

  return (
    <Seite titel="Finanzen" breit={breit} unter={`${bereich === 'privat' ? 'Privat' : 'Business'} · ${unterSatz}`} rechts={chefKnopf || undefined}>
      {ebene2 && <nav aria-label="Unterbereiche" style={{ minWidth: 0 }}>{ebene2}</nav>}
      {zugang === null ? null : <Inhalt ort={ort} punkt={punkt} zugang={zugang} inhaber={inhaber} planZugang={planZugang} altbestand={p.get('alt')} u={p.get('u')} t={p.get('t')} />}
    </Seite>
  );
}

function Inhalt({ ort, punkt, zugang, inhaber, planZugang, altbestand, u, t }: { ort: FinanzOrt; punkt: FinanzMenueId | 'chef'; zugang: boolean; inhaber: boolean | null; planZugang: boolean; altbestand: string | null; u: string | null; t: string | null }) {
  const { bereich } = ort;
  const reiter = punkt === 'controlling' ? 'business' : punkt;
  // „Automationen & Head“ (22.10. abends): die Abläufe des Bereichs (Business: Monatsabschluss, Rechnung) und die Karte des Heads, darunter der Head of Finance.
  if (reiter === 'chef') return <><BereichAutomationen werkzeug={FINANZEN_WERKZEUG} space={bereich} /><FinanzchefView bereich={bereich} /></>;
  if (reiter === 'steuern') return <SteuernView key={bereich} bereich={bereich} />;
  if (reiter === 'finanzplanung') {
    if (!zugang && !planZugang) return null;
    const b = bereich === 'privat' && zugang ? 'privat' : 'business';
    return (
      <>
        <Finanzplan key={b} bereich={b} eingebettet />
        {/* Altbestand der Selbstständigkeit (05.10.: sie gehört zu Privat): das Kassenbuch — nur hier, nie in der Hauptnavigation.
            Das erste Cockpit (public/finanz-dashboard.html) ist seit 08.10. spät entfernt (echte Kontobewegungen im Repo). */}
        {b === 'privat' && u === 'selbst' && <Altbestand offen={altbestand} />}
      </>
    );
  }
  if (bereich === 'privat') {
    // 27.10.: unter der Selbstständigkeit (Privat) auch ihre Rechnungen — dieselbe Übersicht wie unter Business, der Server filtert nach Bereich.
    if (reiter === 'konten') return ort.unter === 'firma' ? <><RechnungenKarte bereich="privat" /><BuchungenView bereich="privat" /></> : <HaushaltView ansicht="konten" reiter={t} />;
    return (
      <>
        <HaushaltView ansicht="uebersicht" reiter={null} />
        {/* Gesamt (bis 08.10. ein eigener Reiter, auch unter Business): die Brücke Privat → Business trägt private Zahlen — sie steht EINMAL, hier. */}
        <div id="gesamt" className="ui-karten" style={{ scrollMarginTop: 80 }}><GesamtView /></div>
      </>
    );
  }
  // Rechnungen (seit 27.10. die EINE Übersicht) oben, darunter Planposten & ältere Rechnungen ohne Positionen (nur mit Haushaltszugang — trägt Privates).
  if (reiter === 'rechnungen') return <><RechnungenKarte />{zugang && <FinanzplanungView />}</>;
  if (reiter === 'liquiditaet') return <LiquiditaetView />;
  if (reiter === 'buchungen') return <BuchungenView bereich="business" />;
  if (punkt === 'controlling' && inhaber) return <ControllingView />;
  // Konten, Fälliges und Monat (ZahlenBusiness) lesen die GEMEINSAMEN Finanz-Bestände (Finanzplan-Listen, Liquiplan, Buchungen) — die tragen
  // Privates und gehen nur an volle Mitglieder (`privatFinanzZugang`). Ein Konto „nur Business“ sieht hier das Cockpit ohne sie, statt
  // leerer Nullen (Gesamtprüfung 12.10.: vorher brach die Seite für dieses Konto ab).
  return inhaber ? <BusinessCockpit eingebettet teil="finanzen" darunter={zugang ? <ZahlenBusiness ohneStreifen /> : undefined} /> : inhaber === false && zugang ? <ZahlenBusiness /> : null;
}

/** Altbestand der Selbstständigkeit — geladen erst auf Klick. */
function Altbestand({ offen: start }: { offen: string | null }) {
  const [offen, setOffen] = useState<boolean>(start === 'grundlage');
  useEffect(() => { if (start === 'grundlage') setOffen(true); }, [start]);
  return (
    <div id="altbestand" className="ui-karten" style={{ scrollMarginTop: 80 }}>
      <Karte i={9}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Altbestand</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise farbe={offen ? LEUCHT.geld : undefined} onClick={() => setOffen(!offen)}>Grundlage · Kassenbuch</Knopf>
        </div>
      </Karte>
      {offen && <GrundlageView />}
    </div>
  );
}
