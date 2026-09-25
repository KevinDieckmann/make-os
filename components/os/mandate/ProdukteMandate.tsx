'use client';

// ─── Produkte & Mandate (/os/mandate) ───────────────────────────────────────
// Kevin 25.09.: „Das Mandaten-Abteil auf die linke Seite unter Aufgaben — da
// ist das Thema Produkte und Mandate abgebildet.“ Zwei Reiter:
//   Mandate   alle Mandate mit Monatsumsatz, Konzentration, Laufzeitradar,
//             Health, Liquiditätsplan, Produkt und Phase (components/os/crm/Kunden.tsx)
//   Produkte  der Katalog nach Linien mit Zahlen, Ablauf und Unterlagen (./Produkte.tsx)
// Adresse: ?s=produkte für den zweiten Reiter, ?k=<id> für das offene Mandat
// bzw. Produkt — Reiterwechsel sind Verlaufsschritte (Zurück führt zurück).
// Sales › 3 · Kunden zeigt nur noch die Kurzfassung und verlinkt hierher.

import { useRouter, useSearchParams } from 'next/navigation';
import { Seite, Segmente, LEUCHT } from '../schlank';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { mandateLink, markttraktion } from '@/lib/crm/adresse';
import { useCrm } from '../crm/daten';
import { MandateUebersicht } from '../crm/Kunden';
import { Produkte } from './Produkte';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';

type Reiter = 'mandate' | 'produkte';

export function ProdukteMandate() {
  const router = useRouter();
  const params = useSearchParams();
  const reiter: Reiter = params.get('s') === 'produkte' ? 'produkte' : 'mandate';
  const api = useCrm();
  const zuKontakt = (id: string) => router.push(markttraktion('kontakte', 'akte', id));
  return (
    <Seite titel="Produkte & Mandate" unter={reiter === 'produkte' ? 'Was wir anbieten — mit Preis, Ablauf und Unterlagen.' : 'Für wen wir gerade arbeiten — Laufzeit, Health, Umsatz.'}
      rechts={<Segmente liste={[{ id: 'mandate' as Reiter, label: 'Mandate' }, { id: 'produkte' as Reiter, label: 'Produkte' }]} aktiv={reiter} onWahl={r => router.push(mandateLink(r), { scroll: false })} />}>
      {api.fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{api.fehler}</div>}
      {reiter === 'mandate' && <IndexStreifen ids={STREIFEN.mandate} titel="Business-Index · Kunden" />}
      {reiter === 'mandate' ? <MandateUebersicht api={api} zuKontakt={zuKontakt} /> : <Produkte api={api} />}
      <div style={{ fontSize: 12, color: C.inkLeise }}>Neue Mandate entstehen meist aus einem gewonnenen Deal (Markttraktion › Sales › Deals → „Mandat anlegen“).</div>
    </Seite>
  );
}
