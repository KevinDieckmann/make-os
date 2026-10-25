'use client';

import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Punkt } from '../ui';

// ─── Produkte & Mandate (/os/mandate) ───────────────────────────────────────
// Kevin 25.09.: „Das Mandaten-Abteil auf die linke Seite unter Aufgaben — da
// ist das Thema Produkte und Mandate abgebildet.“ Orte der Seite:
//   Mandate   alle Mandate mit Monatsumsatz, Konzentration, Laufzeitradar,
//             Health, Liquiditätsplan, Produkt und Phase (components/os/crm/Kunden.tsx)
//   Produkte  der Katalog nach Linien mit Zahlen, Ablauf und Unterlagen (./Produkte.tsx)
//   Automationen & Head  (22.10. abends) die Prozesse des Bereichs (Übergabe, Fulfillment, Ausbau + die Prozesse der Produkte) und seine Heads
// Adresse: ?s=produkte | automationen, ?k=<id> für das offene Mandat bzw. Produkt.
// Seit 22.10. abends ist Produkte & Mandate ein Werkzeug (lib/make-one/werkzeuge.ts `PRODUKTE_WERKZEUG`): die linke Leiste trägt das Menü
// (Mandate · Produkte · Fulfillment · Automationen & Head) — die frühere Segment-Zeile Mandate · Produkte · Fulfillment im Seitenkopf ist weg.
// Sales › 3 · Kunden zeigt nur noch die Kurzfassung und verlinkt hierher.

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Seite, Hinweis, LEUCHT } from '../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { mandateOrt, markttraktion } from '@/lib/crm/adresse';
import { PRODUKTE_WERKZEUG } from '@/lib/make-one/werkzeuge';
import { BereichAutomationen } from '../werkzeug/BereichAutomationen';
import { useCrm } from '../crm/daten';
import { useMandatAnlegen } from '../crm/MandatAnlegenFenster';
import { MandateUebersicht } from '../crm/Kunden';
import { Produkte } from './Produkte';
import { MandateTabelle } from './MandateTabelle';
import { IndexStreifen, STREIFEN } from '../business/IndexStreifen';
import { OnboardingHinweis } from '../fulfillment/prozesse';

const UNTER = {
  mandate: 'Für wen wir gerade arbeiten — Laufzeit, Gesundheit, Umsatz.',
  produkte: 'Was wir anbieten — mit Preis, Ablauf und Unterlagen.',
  automationen: 'Die Abläufe von der Übergabe bis zum Ausbau — und die Heads dieses Bereichs.',
} as const;

export function ProdukteMandate() {
  const router = useRouter();
  const params = useSearchParams();
  // Der Ort folgt der Adresse (auch beim Klick im Menü der Leiste — kein Zustand, der nur beim ersten Laden gelesen wird).
  const reiter = mandateOrt(params.get('s'));
  const api = useCrm();
  const zuKontakt = (id: string) => router.push(markttraktion('kontakte', 'akte', id));
  // Die Prozesse der Produkte (`Leistung.prozessId`, 22.10.) gehören zu „Automationen & Head“ dieses Bereichs — nur Verweise, keine Kopie.
  const produktProzesse = useMemo(() => [...new Set((api.crm?.stand.leistungen ?? []).map(l => l.prozessId).filter((x): x is string => !!x))], [api.crm]);
  if (reiter === 'automationen') {
    return (
      <Seite titel="Produkte & Mandate" unter={UNTER.automationen}>
        <BereichAutomationen werkzeug={PRODUKTE_WERKZEUG} space="business" weitereProzesse={produktProzesse} />
      </Seite>
    );
  }
  return (
    // Produkte & Mandate (10.10.): das Gesellschafts-Register ist ein eigener Punkt in der Leiste (/os/unternehmen), kein Reiter mehr hier.
    <Seite titel="Produkte & Mandate" unter={UNTER[reiter]}>
      {api.fehler && <Hinweis art="kritisch">{api.fehler}</Hinweis>}
      {/* Fulfillment (10.10.): „Kundenonboarding starten“ für unterschriebene Mandate ohne Fall (Paket C1; bis dahin leer). */}
      {reiter === 'mandate' && <OnboardingHinweis api={api} />}
      {/* Antwort zuerst (11.10.): oben der Überblick mit „Als Nächstes“ und die Liste — die Index-Kennzahlen (meist „fehlt“) stehen als Hintergrund darunter. */}
      {reiter === 'mandate' ? <MandateUebersicht api={api} zuKontakt={zuKontakt} /> : <Produkte api={api} />}
      {reiter === 'mandate' && <GewonneneOhneMandat api={api} />}
      {reiter === 'mandate' && <IndexStreifen ids={STREIFEN.mandate} titel="Business-Score · Kunden" />}
      {/* Daten-Assistent B9 c (09.10.): mehrere Mandate aus Excel/CSV — Vorschau, Übernehmen, Rückgängig. */}
      {reiter === 'mandate' && <MandateTabelle onGeaendert={() => api.laden(true)} />}
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Neue Mandate entstehen meist aus einem gewonnenen Deal — <Link href={WEG.deals()} style={{ color: C.inkDim }}>Deals öffnen ›</Link></div>
    </Seite>
  );
}

/** Gewonnene Deals, aus denen noch kein Mandat entstanden ist (26.09.) — ein Klick legt es an. */
function GewonneneOhneMandat({ api }: { api: ReturnType<typeof useCrm> }) {
  const router = useRouter();
  const mandatFenster = useMandatAnlegen(api);
  const crm = api.crm;
  if (!crm) return null;
  const offen = crm.stand.chancen.filter(c => c.stufe === 'gewonnen' && !crm.stand.mandate.some(m => m.chanceId === c.id));
  if (!offen.length) return null;
  // 24.10.: erst die Vorbelegung zum Prüfen (Start wählbar) — angelegt wird erst im Fenster.
  const anlegen = async (chanceId: string) => {
    const r = await mandatFenster.oeffnen(chanceId);
    if (r?.ok && r.mandatId) { await api.laden(); router.push(WEG.mandat(r.mandatId)); }
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
      {mandatFenster.fenster}
    </Karte>
  );
}
