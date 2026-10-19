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
import { mandateLink, markttraktion, mandatNeuAusAdresse } from '@/lib/crm/adresse';
import { MandatAnlegen } from '../crm/MandatAnlegen';
import { useCrm } from '../crm/daten';
import { MandateUebersicht } from '../crm/Kunden';
import { Produkte } from './Produkte';
import { MandateTabelle } from './MandateTabelle';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';
import { OnboardingHinweis } from '../fulfillment/prozesse';

type Reiter = 'mandate' | 'produkte';
/** Fulfillment (10.10.): dritter Punkt der Segmente — eine eigene Seite (`/os/mandate/fulfillment`, components/os/fulfillment/FulfillmentSeite.tsx). */
type Segment = Reiter | 'fulfillment';

export function ProdukteMandate() {
  const router = useRouter();
  const params = useSearchParams();
  const reiter: Reiter = params.get('s') === 'produkte' ? 'produkte' : 'mandate';
  const api = useCrm();
  const zuKontakt = (id: string) => router.push(markttraktion('kontakte', 'akte', id));
  const zu = (s: Segment) => router.push(s === 'fulfillment' ? WEG.fulfillment() : mandateLink(s), { scroll: false });
  // „Mandat aus diesem Produkt anlegen“ (19.10., Produkt-Karte): `?neu=mandat&produkt=<id>` (WEG.mandatAusProdukt) öffnet „+ Mandat“ mit dem
  // Produkt vorbelegt. Die Stufe leitet der Server aus dem Produkt ab (lib/crm/treppe.ts `stufeVonMandat`) — darum keine Stufen-Kennung hier.
  const neuAusProdukt = mandatNeuAusAdresse(params);
  const produktNeu = neuAusProdukt ? api.crm?.stand.leistungen.find(l => l.id === neuAusProdukt.leistungId) : undefined;
  return (
    <Seite titel="Produkte & Mandate" unter={reiter === 'produkte' ? 'Was wir anbieten — mit Preis, Ablauf und Unterlagen.' : 'Für wen wir gerade arbeiten — Laufzeit, Gesundheit, Umsatz.'}
      // Produkte & Mandate (10.10.): das Gesellschafts-Register ist ein eigener Punkt in der Leiste (/os/unternehmen), kein Reiter mehr hier.
      rechts={<Segmente<Segment> liste={[{ id: 'mandate', label: 'Mandate' }, { id: 'produkte', label: 'Produkte' }, { id: 'fulfillment', label: 'Fulfillment' }]} aktiv={reiter} onWahl={zu} />}>
      {api.fehler && <Hinweis art="kritisch">{api.fehler}</Hinweis>}
      {/* Fulfillment (10.10.): „Kundenonboarding starten“ für unterschriebene Mandate ohne Fall (Paket C1; bis dahin leer). */}
      {reiter === 'mandate' && <OnboardingHinweis api={api} />}
      {/* Antwort zuerst (11.10.): oben der Überblick mit „Als Nächstes“ und die Liste — die Index-Kennzahlen (meist „fehlt“) stehen als Hintergrund darunter. */}
      {reiter === 'mandate' ? <MandateUebersicht api={api} zuKontakt={zuKontakt} /> : <Produkte api={api} />}
      {reiter === 'mandate' && <GewonneneOhneMandat api={api} />}
      {reiter === 'mandate' && <IndexStreifen ids={STREIFEN.mandate} titel="Business-Index · Kunden" />}
      {/* Daten-Assistent B9 c (09.10.): mehrere Mandate aus Excel/CSV — Vorschau, Übernehmen, Rückgängig. */}
      {reiter === 'mandate' && <MandateTabelle onGeaendert={() => api.laden(true)} />}
      {produktNeu && (
        <MandatAnlegen api={api} modus="neu" stufe={{ id: '', name: produktNeu.name, leistungId: produktNeu.id }} {...(produktNeu.gesellschaft !== 'offen' ? { gesellschaft: produktNeu.gesellschaft } : {})}
          onZu={() => router.replace(mandateLink('mandate'), { scroll: false })} onFertig={id => router.replace(WEG.mandat(id), { scroll: false })} />
      )}
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
