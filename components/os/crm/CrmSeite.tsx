'use client';

// ─── MAKE OS — CRM (24.09.) ─────────────────────────────────────────────────
// Kevin: „Alles, was mit Kundengewinnung zu tun hat, unter das CRM“ —
// Marketing, Sales und Kundenmanagement als ein System. Sechs Bereiche:
//   Heute      wer ist dran (Power Hour)
//   Kartei     jede Person mit Verlauf, Notizen, Kanälen, Einwilligungen
//   Pipeline   Chancen nach Stufen mit Prognose
//   Kunden     Mandate, Health, Liquiditätsplan, Leistungskatalog
//   Marketing  wen wir ansprechen dürfen, Fristen, Quellen, Stimme der Kunden
//   Events     Gäste, Nachfassen, Wirkung
//   Stammdaten Selbstprüfung, Datenqualität, Wertelisten, Datenschutz, Import/Export
// Das Grundkonzept (Stufen mit Austrittskriterium, Warum-jetzt-Punkte,
// Sperre statt Löschen) stammt aus der Markttraktion in KEMARIS Operations;
// die Daten sind ausschließlich unsere eigenen (Masterdatei + Brain).

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TYP } from '@/lib/make-one/design';
import { Seite, Segmente, LEUCHT } from '../schlank';
import { useCrm } from './daten';
import { Heute } from './Heute';
import { Kartei } from './Kartei';
import { Pipeline } from './Pipeline';
import { Kunden } from './Kunden';
import { Marketing } from './Marketing';
import { Events } from './Events';
import { Stammdaten } from './Stammdaten';

type Bereich = 'heute' | 'kontakte' | 'firmen' | 'pipeline' | 'kunden' | 'marketing' | 'events' | 'stammdaten';
const BEREICHE: { id: Bereich; label: string }[] = [
  { id: 'heute', label: 'Heute' }, { id: 'kontakte', label: 'Kontakte' }, { id: 'firmen', label: 'Firmen' }, { id: 'pipeline', label: 'Pipeline' },
  { id: 'kunden', label: 'Kunden' }, { id: 'marketing', label: 'Marketing' }, { id: 'events', label: 'Events' }, { id: 'stammdaten', label: 'Stammdaten' },
];
const UNTER: Record<Bereich, string> = {
  heute: 'Versprechen vor Signalen vor Chancen — und nur über Kanäle, die zulässig sind.',
  kontakte: 'Jede Person mit ihrer ganzen Geschichte.',
  firmen: 'Ein Unternehmen, alle Beziehungen.',
  pipeline: 'Eine Chance rückt vor, wenn beim Kunden etwas passiert ist.',
  kunden: 'Bestand sichern: Laufzeiten, Health, offene Punkte, Liquidität.',
  marketing: 'Ansprechbar sein, nicht laut.',
  events: 'Erfolgreich ist ein Event, wenn danach die richtigen Gespräche stattfinden.',
  stammdaten: 'Sauber halten, was alles andere trägt: Qualität, Werte, Datenschutz.',
};

export function CrmSeite() {
  const router = useRouter(); const pfad = usePathname(); const params = useSearchParams();
  // „kartei“ bleibt als alter Verweis gültig und führt zu den Kontakten.
  const sRoh = params.get('s') === 'kartei' ? 'kontakte' : params.get('s');
  const bereich = (BEREICHE.find(b => b.id === sRoh)?.id ?? 'heute') as Bereich;
  const ansicht = params.get('a') ?? undefined;
  const [auswahl, setAuswahl] = useState<string | null>(params.get('k'));
  const api = useCrm();
  const wechsle = (b: Bereich) => router.replace(b === 'heute' ? pfad : `${pfad}?s=${b}`);
  const zuBereich = (b: string, a?: string) => router.replace(`${pfad}?s=${b === 'kartei' ? 'kontakte' : b}${a ? `&a=${a}` : ''}`);
  const zuKontakt = (id: string) => { setAuswahl(id); router.replace(`${pfad}?s=kontakte&k=${id}`); };
  const zuFirma = (id: string) => { setAuswahl(id); router.replace(`${pfad}?s=firmen&k=${id}`); };
  // Die Auswahl folgt dem Link (Schnellsuche, Befunde, Zurück im Browser).
  const kParam = params.get('k');
  useEffect(() => { if (kParam) setAuswahl(kParam); }, [kParam]);
  const name = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '—');

  return (
    <Seite titel="CRM" unter={UNTER[bereich]} rechts={<div className="crm-bereiche" style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}><Segmente liste={BEREICHE} aktiv={bereich} onWahl={wechsle} /></div>}>
      {api.fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{api.fehler}</div>}
      {bereich === 'heute' && <Heute api={api} name={name} zuKontakt={zuKontakt} zuBereich={zuBereich} />}
      {(bereich === 'kontakte' || bereich === 'firmen') && <Kartei api={api} name={name} modus={bereich === 'firmen' ? 'firmen' : 'personen'} auswahl={auswahl} setAuswahl={setAuswahl} zuKontakt={zuKontakt} zuFirma={zuFirma} start={ansicht} />}
      {bereich === 'pipeline' && <Pipeline api={api} zuKontakt={zuKontakt} />}
      {bereich === 'kunden' && <Kunden api={api} zuKontakt={zuKontakt} />}
      {bereich === 'marketing' && <Marketing api={api} zuKontakt={zuKontakt} />}
      {bereich === 'events' && <Events api={api} zuKontakt={zuKontakt} />}
      {bereich === 'stammdaten' && <Stammdaten api={api} zuBereich={zuBereich} zuKontakt={zuKontakt} start={ansicht} />}
    </Seite>
  );
}
