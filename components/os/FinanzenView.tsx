'use client';

// ─── MAKE OS — Zahlen: Privat · Business · Steuern · Gesamt · Head of Finance ─
// Kevin, 24.09.: „dass wir in unserem Dashboard wirklich über Privat und über
// Business unterscheiden können.“ 25.09.: „Alles unter Zahlen“ — Privat trägt
// oben den Privat-Index, Business ist das Cockpit mit dem Business-Index (und
// darunter Konten, Fälliges, Grundlage), Steuern ist neu. Hinter jeder Kachel
// stehen Punkte mit Links bis zur Buchung, Rechnung oder zum Beleg.
// Wer keinen Haushalt hat, sieht nur Business (ohne Index) und den Head of Finance.

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Seite, Segmente } from './schlank';
import { ZahlenBusiness } from './ZahlenView';
import { HaushaltView } from './haushalt/HaushaltView';
import { GesamtView } from './haushalt/GesamtView';
import { FinanzchefView } from './FinanzchefView';
import { BusinessCockpit } from './business/BusinessCockpit';
import { SteuernView } from './steuern/SteuernView';

type Sicht = 'privat' | 'business' | 'steuern' | 'gesamt' | 'chef';

const UNTER: Record<Sicht, string> = {
  privat: 'Privat · Privat-Index und eure Haushaltsfinanzen',
  business: 'Business · Business-Index, Geschäftsmodell, Konten und Fälliges',
  steuern: 'Steuern · Fristen, Rücklage, Umsatzsteuer, Übergabe an den Steuerberater',
  gesamt: 'Gesamt · was das Business fürs Leben bringen muss',
  chef: 'Head of Finance · Lage, Fristen, Vorschläge zur Freigabe',
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
    : gewuenscht === 'business' || gewuenscht === 'gesamt' || (gewuenscht === 'steuern' && inhaber !== false) ? gewuenscht
    : zugang ? 'privat' : (gewuenscht ?? 'privat');
  const setze = (s: Record<string, string | null>) => {
    const q = new URLSearchParams(p.toString());
    for (const [k, v] of Object.entries(s)) { if (v === null) q.delete(k); else q.set(k, v); }
    // Sicht wechseln ist ein Ortswechsel — Zurück führt zur vorigen Sicht (25.09.).
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  };
  const chef = { id: 'chef' as Sicht, label: 'Head of Finance' };
  const liste = zugang
    ? [{ id: 'privat' as Sicht, label: 'Privat' }, { id: 'business' as Sicht, label: 'Business' }, ...(inhaber ? [{ id: 'steuern' as Sicht, label: 'Steuern' }] : []), { id: 'gesamt' as Sicht, label: 'Gesamt' }, chef]
    : [{ id: 'business' as Sicht, label: 'Business' }, chef];

  return (
    <Seite titel="Zahlen" breit={sicht === 'business' || sicht === 'steuern' || sicht === 'privat' ? 1440 : undefined} unter={UNTER[sicht]}
      rechts={zugang !== null ? <div style={{ overflowX: 'auto', maxWidth: '100%' }}><Segmente liste={liste} aktiv={sicht} onWahl={s => setze({ s, t: null, k: null, f: null, monat: null, kat: null, q: null })} /></div> : undefined}>
      {zugang === null && sicht === 'privat' ? null
        : sicht === 'privat' ? <HaushaltView reiter={p.get('t')} onReiter={t => setze({ t, k: null, monat: null, kat: null, q: null })} />
        : sicht === 'gesamt' ? <GesamtView />
        : sicht === 'chef' ? <FinanzchefView />
        : sicht === 'steuern' ? <SteuernView />
        : inhaber ? <BusinessCockpit eingebettet darunter={<ZahlenBusiness ohneStreifen />} />
        : inhaber === false ? <ZahlenBusiness /> : null}
    </Seite>
  );
}
