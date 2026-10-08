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
//   Business  Überblick (Ebene 2: Cockpit · Controlling & Ziele) · Rechnungen & Zahlungen · Liquidität · Buchungen · Planung · Steuern
//   Head of Finance = Knopf neben den Reitern. Gesamt (die Brücke) steht einmal: unten auf Privat › Überblick (#gesamt).
// Die früheren Nebenseiten (/os/finanzen/planung, …/liquiditaet, …/buchungen, …/grundlage, …/dashboard, /os/controlling) leiten in
// next.config.mjs mit allen Parametern hierher. Wer keinen Haushalt hat, sieht nur Business (Überblick, Planung) und den Head of Finance.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot } from 'lucide-react';
import { Seite, Reiter, Pillen, Knopf, Karte, Ueberschrift, LEUCHT } from './ui';
import { ZahlenBusiness } from './ZahlenView';
import { HaushaltView } from './haushalt/HaushaltView';
import { GesamtView } from './haushalt/GesamtView';
import { FinanzchefView } from './FinanzchefView';
import { BusinessCockpit } from './business/BusinessCockpit';
import { SteuernView } from './steuern/SteuernView';
import { Finanzplan } from './finanzplan/Finanzplan';
import { FinanzplanungView } from './FinanzplanungView';
import { LiquiditaetView } from './LiquiditaetView';
import { BuchungenView } from './BuchungenView';
import { ControllingView } from './ControllingView';
import { GrundlageView } from './GrundlageView';
import { FinanzDashboardView } from './FinanzDashboardView';
import { useZuZiel } from './ziel';
import { useSpace } from '@/hooks/useSpace';
import { PRIVAT_REITER, BUSINESS_REITER, UEBERBLICK_UNTER, finanzOrt, finanzAdresse, kontenUnter, type FinanzReiter, type FinanzOrt, type KontenUnter } from '@/lib/finanzen/navigation';

/** Ein Satz je Ort (eine Zeile, Design-Standard). */
const UNTER: Record<FinanzReiter | 'chef' | 'controlling', string> = {
  privat: 'Privat-Index, was ansteht und was das Business fürs Leben bringen muss',
  konten: 'Eure Konten, Buchungen, Budgets und Schulden',
  business: 'Business-Index, Konten und Fälliges der Gesellschaften',
  controlling: 'Kurs aufs Jahresziel, Run-Rate und Runway',
  rechnungen: 'Was reinkommt, was raus muss — in welcher Reihenfolge',
  liquiditaet: 'Wie viel Geld wann da ist',
  buchungen: 'Was auf den Konten der Gesellschaften passiert ist',
  finanzplanung: 'Szenarien, Blätter und Ist-Abgleich',
  steuern: 'Fristen, Rücklage, Umsatzsteuer, Übergabe an den Steuerberater',
  chef: 'Head of Finance · Lage, Fristen, Vorschläge zur Freigabe',
};

export function FinanzenView() {
  const router = useRouter(); const p = useSearchParams();
  const { space } = useSpace();
  const [zugang, setZugang] = useState<boolean | null>(null);
  // Business-Index und Steuern gehören dem Haushalt des Inhabers (eigene Prüfung in der API).
  const [inhaber, setInhaber] = useState<boolean | null>(null);
  // Planung (04.10. spät): auch Konten ohne Privatzugang (Finanzrecht „nur Business“) haben sie — der Server filtert.
  const [planZugang, setPlanZugang] = useState(false);
  useEffect(() => {
    fetch('/api/haushalt?nur=zugang').then(r => setZugang(r.ok)).catch(() => setZugang(false));
    fetch('/api/finanzplan?nur=kennzahlen').then(r => setPlanZugang(r.ok)).catch(() => setPlanZugang(false));
    fetch('/api/business?scope=gesamt&kompakt=1').then(r => setInhaber(r.ok)).catch(() => setInhaber(false));
  }, []);

  const ort: FinanzOrt = finanzOrt(new URLSearchParams(p.toString()), { gemerkt: space, haushalt: zugang });
  const { bereich } = ort;
  // Reiter, die dieses Konto hat: ohne Haushalt nur Überblick + Planung (der Server filtert), Steuern nur im Haushalt des Inhabers.
  const reiterListe = (bereich === 'privat' ? PRIVAT_REITER : BUSINESS_REITER).filter(r =>
    zugang === false ? r.id === 'business' || (r.id === 'finanzplanung' && planZugang) : r.id !== 'steuern' || inhaber !== false);
  const reiter: FinanzReiter | 'chef' = ort.reiter === 'chef' || reiterListe.some(r => r.id === ort.reiter) ? ort.reiter : reiterListe[0]?.id ?? 'business';

  // Ort wechseln = router.push (Zurück führt zum vorigen Ort, 25.09.); die Filter des alten Ortes fallen weg.
  const geh = (ziel: Parameters<typeof finanzAdresse>[1]) => router.push(finanzAdresse(bereich, ziel), { scroll: false });

  // #gesamt (die Brücke) und #altbestand springen nach dem Laden einmal hin.
  useZuZiel(null, zugang !== null);

  const chefAn = reiter === 'chef';
  const kopfZeile = zugang !== null && (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
      <nav aria-label="Finanzen" className="ui-reiter-zeile" style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Reiter ariaLabel={bereich === 'privat' ? 'Finanzen Privat' : 'Finanzen Business'} liste={reiterListe} aktiv={chefAn ? null : reiter} onWahl={geh} />
      </nav>
      <Knopf leise href={finanzAdresse(bereich, 'chef')} farbe={chefAn ? LEUCHT.geld : undefined} ariaLabel="Head of Finance" titel="Head of Finance — Lage, Fristen, Vorschläge zur Freigabe">
        <Bot size={16} /><span className="ui-nur-breit">Head of Finance</span>
      </Knopf>
    </div>
  );

  // Ebene 2 — nur unter Konten & Buchungen und unter Business › Überblick.
  const ebene2 = reiter === 'konten'
    ? <Pillen einzeilig liste={kontenUnter()} aktiv={ort.unter as KontenUnter} onWahl={geh} />
    : reiter === 'business' && inhaber
      ? <Pillen einzeilig liste={UEBERBLICK_UNTER} aktiv={ort.unter === 'controlling' ? 'controlling' : 'business'} onWahl={geh} />
      : null;

  const unterSatz = chefAn ? UNTER.chef : reiter === 'business' && ort.unter === 'controlling' ? UNTER.controlling : UNTER[reiter];
  const breit = reiter === 'chef' ? undefined : 1440;

  return (
    <Seite titel="Finanzen" breit={breit} unter={`${bereich === 'privat' ? 'Privat' : 'Business'} · ${unterSatz}`}>
      {kopfZeile}
      {ebene2 && <nav aria-label="Unterbereiche" style={{ minWidth: 0 }}>{ebene2}</nav>}
      {zugang === null ? null : <Inhalt ort={{ ...ort, reiter }} zugang={zugang} inhaber={inhaber} planZugang={planZugang} altbestand={p.get('alt')} u={p.get('u')} t={p.get('t')} />}
    </Seite>
  );
}

function Inhalt({ ort, zugang, inhaber, planZugang, altbestand, u, t }: { ort: FinanzOrt; zugang: boolean; inhaber: boolean | null; planZugang: boolean; altbestand: string | null; u: string | null; t: string | null }) {
  const { bereich, reiter } = ort;
  if (reiter === 'chef') return <FinanzchefView />;
  if (reiter === 'steuern') return <SteuernView key={bereich} bereich={bereich} />;
  if (reiter === 'finanzplanung') {
    if (!zugang && !planZugang) return null;
    const b = bereich === 'privat' && zugang ? 'privat' : 'business';
    return (
      <>
        <Finanzplan key={b} bereich={b} eingebettet />
        {/* Altbestand der Selbstständigkeit (05.10.: sie gehört zu Privat): Malins Kassenbuch und ihr erstes Cockpit — nur hier, nie in der Hauptnavigation. */}
        {b === 'privat' && u === 'selbst' && <Altbestand offen={altbestand} />}
      </>
    );
  }
  if (bereich === 'privat') {
    if (reiter === 'konten') return ort.unter === 'firma' ? <BuchungenView bereich="privat" /> : <HaushaltView ansicht="konten" reiter={t} />;
    return (
      <>
        <HaushaltView ansicht="uebersicht" reiter={null} />
        {/* Gesamt (bis 08.10. ein eigener Reiter, auch unter Business): die Brücke Privat → Business trägt private Zahlen — sie steht EINMAL, hier. */}
        <div id="gesamt" className="ui-karten" style={{ scrollMarginTop: 80 }}><GesamtView /></div>
      </>
    );
  }
  if (reiter === 'rechnungen') return <FinanzplanungView />;
  if (reiter === 'liquiditaet') return <LiquiditaetView />;
  if (reiter === 'buchungen') return <BuchungenView bereich="business" />;
  if (ort.unter === 'controlling' && inhaber) return <ControllingView />;
  return inhaber ? <BusinessCockpit eingebettet darunter={<ZahlenBusiness ohneStreifen />} /> : inhaber === false ? <ZahlenBusiness /> : null;
}

/** Altbestand der Selbstständigkeit — geladen erst auf Klick (das erste Cockpit lädt von außen). */
function Altbestand({ offen: start }: { offen: string | null }) {
  const [offen, setOffen] = useState<string | null>(start === 'grundlage' || start === 'v1' ? start : null);
  useEffect(() => { if (start === 'grundlage' || start === 'v1') setOffen(start); }, [start]);
  return (
    <div id="altbestand" className="ui-karten" style={{ scrollMarginTop: 80 }}>
      <Karte i={9}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Altbestand</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise farbe={offen === 'grundlage' ? LEUCHT.geld : undefined} onClick={() => setOffen(offen === 'grundlage' ? null : 'grundlage')}>Grundlage · Malins Kassenbuch</Knopf>
          <Knopf leise farbe={offen === 'v1' ? LEUCHT.geld : undefined} onClick={() => setOffen(offen === 'v1' ? null : 'v1')}>Erstes Cockpit (Version 1)</Knopf>
        </div>
      </Karte>
      {offen === 'grundlage' && <GrundlageView />}
      {offen === 'v1' && <FinanzDashboardView />}
    </div>
  );
}
