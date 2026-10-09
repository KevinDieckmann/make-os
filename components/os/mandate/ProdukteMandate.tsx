'use client';

import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Punkt } from '../ui';

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
import { Seite, Segmente, Hinweis, LEUCHT } from '../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { mandateLink, markttraktion } from '@/lib/crm/adresse';
import { useCrm } from '../crm/daten';
import { MandateUebersicht } from '../crm/Kunden';
import { Produkte } from './Produkte';
import { MandateTabelle } from './MandateTabelle';
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
      // Mandate & Unternehmen (08.10.): ein Punkt in der Leiste — das Gesellschafts-Register ist der dritte Reiter (eigene Seite /os/unternehmen).
      rechts={<Segmente liste={[{ id: 'mandate' as const, label: 'Mandate' }, { id: 'produkte' as const, label: 'Produkte' }, { id: 'unternehmen' as const, label: 'Unternehmen' }]} aktiv={reiter} onWahl={r => router.push(r === 'unternehmen' ? WEG.unternehmen() : mandateLink(r), { scroll: false })} />}>
      {api.fehler && <Hinweis art="kritisch">{api.fehler}</Hinweis>}
      {reiter === 'mandate' && <IndexStreifen ids={STREIFEN.mandate} titel="Business-Index · Kunden" />}
      {reiter === 'mandate' ? <MandateUebersicht api={api} zuKontakt={zuKontakt} /> : <Produkte api={api} />}
      {reiter === 'mandate' && <GewonneneOhneMandat api={api} />}
      {/* Daten-Assistent B9 c (09.10.): mehrere Mandate aus Excel/CSV — Vorschau, Übernehmen, Rückgängig. */}
      {reiter === 'mandate' && <MandateTabelle onGeaendert={() => api.laden(true)} />}
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Neue Mandate entstehen meist aus einem gewonnenen Deal — <Link href={WEG.deals()} style={{ color: C.inkDim }}>Deals öffnen ›</Link></div>
    </Seite>
  );
}

/** Gewonnene Deals, aus denen noch kein Mandat entstanden ist (26.09.) — ein Klick legt es an. */
function GewonneneOhneMandat({ api }: { api: ReturnType<typeof useCrm> }) {
  const router = useRouter();
  const crm = api.crm;
  if (!crm) return null;
  const offen = crm.stand.chancen.filter(c => c.stufe === 'gewonnen' && !crm.stand.mandate.some(m => m.chanceId === c.id));
  if (!offen.length) return null;
  const anlegen = async (chanceId: string) => {
    const r = await fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'mandat', chanceId }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) { await api.laden(); router.push(WEG.mandat(r.mandatId)); }
  };
  return (
    <Karte i={2} akzent={LEUCHT.geld}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={<span>{offen.length}</span>}>Gewonnene Deals ohne Mandat</Ueberschrift>
      <Liste>
        {offen.map(c => (
          <Zeile key={c.id} onClick={() => router.push(WEG.deal(c.id))} links={<Punkt farbe={LEUCHT.geld} />} titel={c.titel} unter={c.firma ?? undefined}
            rechts={<Knopf leise onClick={() => void anlegen(c.id)}>Mandat anlegen</Knopf>} />
        ))}
      </Liste>
    </Karte>
  );
}
