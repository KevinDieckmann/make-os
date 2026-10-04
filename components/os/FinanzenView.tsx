'use client';

// ─── MAKE OS — Zahlen: Privat · Business · Steuern · Gesamt · Head of Finance ─
// Kevin, 24.09.: „dass wir in unserem Dashboard wirklich über Privat und über
// Business unterscheiden können.“ 25.09.: „Alles unter Zahlen“ — Privat trägt
// oben den Privat-Index, Business ist das Cockpit mit dem Business-Index (und
// darunter Konten, Fälliges, Grundlage), Steuern ist neu. Hinter jeder Kachel
// stehen Punkte mit Links bis zur Buchung, Rechnung oder zum Beleg.
// Wer keinen Haushalt hat, sieht nur Business (ohne Index) und den Head of Finance.
// 04.10. (Kevin: „Teile die Finanzplanung … bei Privat und bei Business“): Reiter „Finanzplanung“ in beiden — dieselbe Komponente
// (components/os/finanzplan/Finanzplan.tsx) mit `sicht`: unter Privat alles (auch die Firmen), unter Business nur die Gesellschaften
// (vom Server gefiltert). Adresse: ?s=finanzplanung&space=privat|business&u=<Unterseite>.

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Seite, Reiter } from './ui';
import { ZahlenBusiness } from './ZahlenView';
import { HaushaltView } from './haushalt/HaushaltView';
import { GesamtView } from './haushalt/GesamtView';
import { FinanzchefView } from './FinanzchefView';
import { BusinessCockpit } from './business/BusinessCockpit';
import { SteuernView } from './steuern/SteuernView';
import { Finanzplan } from './finanzplan/Finanzplan';

type Sicht = 'privat' | 'business' | 'steuern' | 'gesamt' | 'chef' | 'finanzplanung';

const UNTER: Record<Sicht, string> = {
  privat: 'Privat · Privat-Index und eure Haushaltsfinanzen',
  business: 'Business · Business-Index, Geschäftsmodell, Konten und Fälliges',
  steuern: 'Steuern · Fristen, Rücklage, Umsatzsteuer, Übergabe an den Steuerberater',
  gesamt: 'Gesamt · was das Business fürs Leben bringen muss',
  chef: 'Head of Finance · Lage, Fristen, Vorschläge zur Freigabe',
  finanzplanung: 'Finanzplanung · Liquidität, Blätter und Szenarien',
};

export function FinanzenView() {
  const router = useRouter(); const pfad = usePathname(); const p = useSearchParams();
  const [zugang, setZugang] = useState<boolean | null>(null);
  // Business-Index und Steuern gehören dem Haushalt des Inhabers (eigene Prüfung in der API).
  const [inhaber, setInhaber] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/haushalt?nur=zugang').then(r => setZugang(r.ok)).catch(() => setZugang(false));
    fetch('/api/business?scope=gesamt&kompakt=1').then(r => setInhaber(r.ok)).catch(() => setInhaber(false));
  }, []);
  const gewuenscht = p.get('s') as Sicht | null;
  // Der Head of Finance ist für alle da — ohne Haushalt sieht er nur Business.
  const sicht: Sicht = gewuenscht === 'chef' ? 'chef'
    : zugang === false ? 'business'
    : gewuenscht === 'business' || gewuenscht === 'gesamt' || gewuenscht === 'finanzplanung' || (gewuenscht === 'steuern' && inhaber !== false) ? gewuenscht
    : zugang ? 'privat' : (gewuenscht ?? 'privat');
  const setze = (s: Record<string, string | null>) => {
    const q = new URLSearchParams(p.toString());
    for (const [k, v] of Object.entries(s)) { if (v === null) q.delete(k); else q.set(k, v); }
    // Sicht wechseln ist ein Ortswechsel — Zurück führt zur vorigen Sicht (25.09.).
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  };
  const chef = { id: 'chef' as Sicht, label: 'Head of Finance' };
  // Reiter je Space (26.09. abends, Kevin: „im Business nur Business, im Privat nur Privat“). „Gesamt“ ist die Brücke und steht in beiden.
  // Finanzplanung: dieselbe Brücke — die Sicht folgt dem Space (privat = alles, business = nur die Gesellschaften).
  const imPrivat = sicht === 'privat' || ((sicht === 'gesamt' || sicht === 'finanzplanung') && p.get('space') === 'privat');
  const planung = { id: 'finanzplanung' as Sicht, label: 'Finanzplanung' };
  const liste = !zugang
    ? [{ id: 'business' as Sicht, label: 'Business' }, chef]
    : imPrivat
      ? [{ id: 'privat' as Sicht, label: 'Privat' }, planung, { id: 'gesamt' as Sicht, label: 'Gesamt' }]
      : [{ id: 'business' as Sicht, label: 'Business' }, planung, ...(inhaber ? [{ id: 'steuern' as Sicht, label: 'Steuern' }] : []), { id: 'gesamt' as Sicht, label: 'Gesamt' }, chef];

  return (
    <Seite titel="Zahlen" breit={sicht === 'business' || sicht === 'steuern' || sicht === 'privat' || sicht === 'finanzplanung' ? 1440 : undefined} unter={UNTER[sicht]}>
      {/* Eine wischbare Leiste (Standard-Baustein) — am Handy steht der Inhalt gleich darunter, der Kopf bleibt klein. */}
      {zugang !== null && (
        <nav aria-label="Zahlen" className="ui-reiter-zeile">
          <Reiter ariaLabel="Sicht der Zahlen" liste={liste} aktiv={sicht} onWahl={s => setze({ s, space: s === 'gesamt' || s === 'finanzplanung' ? (imPrivat ? 'privat' : 'business') : null, t: null, k: null, f: null, monat: null, kat: null, q: null, u: null, zeile: null, sz: null, feld: null, steuern: null })} />
        </nav>
      )}
      {zugang === null && sicht === 'privat' ? null
        : sicht === 'privat' ? <HaushaltView reiter={p.get('t')} onReiter={t => setze({ t, k: null, monat: null, kat: null, q: null })} />
        : sicht === 'finanzplanung' ? (zugang ? <Finanzplan key={imPrivat ? 'privat' : 'business'} sicht={imPrivat ? 'privat' : 'business'} eingebettet /> : null)
        : sicht === 'gesamt' ? <GesamtView />
        : sicht === 'chef' ? <FinanzchefView />
        : sicht === 'steuern' ? <SteuernView />
        : inhaber ? <BusinessCockpit eingebettet darunter={<ZahlenBusiness ohneStreifen />} />
        : inhaber === false ? <ZahlenBusiness /> : null}
    </Seite>
  );
}
