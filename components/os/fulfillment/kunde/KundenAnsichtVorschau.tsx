'use client';

// ─── Fulfillment · „So sieht der Kunde es“ (C2, 10.10.; FULFILLMENT_KONZEPT.md 6.4) ─────────────────────────────────────────────────────────────
// Mit Mandat: `GET /api/fulfillment/kunde/vorschau?m=` liefert GENAU die Kunden-Sicht (Positivliste, serverseitig gefiltert) — gezeigt mit derselben
// Komponente `KundenAnsicht` wie die öffentliche Seite, nur gesperrt. Ohne Mandat (Fulfillment › Visualisierung): die Vorlage der Kunden-Ansicht mit
// erfundenen Beispielwerten — sie zeigt, welche Teile ein Kunde sieht (und welche nie).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Hinweis, Leer, Karte, Ueberschrift } from '../../ui';
import { KundenAnsicht } from './KundenAnsicht';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';

/** Die Vorlage (erfunden, neutral) — dieselben Schlüssel wie eine echte Sicht. */
const VORLAGE: KundenSicht = {
  modus: 'voll', anrede: 'du', anbieter: { name: 'Eure Gesellschaft' }, ansprechperson: 'Eure Ansprechperson',
  firma: 'Beispiel Werkzeugbau', mandat: 'Vertrieb neu aufstellen', paket: 'Vertriebsleitung auf Zeit', stand: '—', fortschritt: 34,
  lage: { ampel: 'gelb', titel: 'Wir warten auf euren Input', saetze: ['Wir sind in Phase 2 von 4 („Analyse“) — insgesamt sind 34 % des Weges geschafft.', 'In den letzten zwei Wochen haben wir 3 Schritte abgeschlossen.', 'Von euch brauchen wir eine Sache — sie wartet seit 9 Tagen.'] },
  zeitstrahl: [
    { titel: 'Vorlauf & Onboarding', stand: 'erledigt', anteil: 1, abstimmung: { titel: 'Rahmen & Zugänge', erledigt: true } },
    { titel: 'Analyse', stand: 'aktuell', anteil: 0.5 }, { titel: 'Diagnose', stand: 'kommt', anteil: 0, abstimmung: { titel: 'Diagnose-Abnahme', erledigt: false } }, { titel: 'Aufbau', stand: 'kommt', anteil: 0 },
  ],
  erledigt: ['Kick-off', 'Zugänge eingerichtet'], naechstes: ['Wettbewerb sichten', 'Diagnose vorstellen'], wartet: [{ titel: 'Preisliste freigeben', seit: '—', frist: '—' }],
  wertKonto: [{ name: 'Neue Termine je Monat', vorher: '4', jetzt: '7', ziel: '12', anteil: 38 }],
  quickWins: [{ text: 'Angebotsvorlage vereinheitlicht', erledigt: true, am: '—' }, { text: 'Nachfass-Rhythmus eingeführt', erledigt: false, bis: '—' }],
  rituale: [{ titel: 'Wochen-Check', rhythmus: 'wöchentlich' }],
  entscheidungen: [{ titel: 'Zielgruppe zuerst Maschinenbau', am: '—', status: 'entschieden' }], formulare: [],
  upload: { erlaubt: true, eingegangen: 1, frei: 19, geprueft: 1, offen: 0 }, puls: { offen: false },
  datenschutz: { verantwortlich: 'aus der Einrichtung (System › Datenschutz)', fassung: '—', absaetze: ['Der Hinweis nach Art. 13 DSGVO steht hier — mit Verantwortlichem und Speicherfristen der Instanz.'] },
};

export function KundenAnsichtVorschau({ mandatId }: { mandatId?: string }) {
  const [sicht, setSicht] = useState<KundenSicht | null>(mandatId ? null : VORLAGE);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!mandatId) return;
    let aus = false;
    void (async () => {
      const r = await fetch(`/api/fulfillment/kunde/vorschau?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (aus) return;
      if (!r || !r.ok || !j.ok) setFehler(String(j.fehler ?? 'Die Vorschau ließ sich nicht laden.')); else setSicht(j.sicht as KundenSicht);
    })();
    return () => { aus = true; };
  }, [mandatId]);
  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  if (!sicht) return <Leer>Vorschau lädt …</Leer>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!mandatId && (
        <Karte flach>
          <Ueberschrift>Kunden-Ansicht — Vorlage</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>So ist die Seite eines Kunden aufgebaut (Beispielwerte, erfunden). Nie zu sehen: Stakeholder, Haltungen, Notizen, interne Schritte, Health, Honorar, Dossier, Personenteil, andere Mandate, die Liste der Dateien und Namen eures Teams.</div>
        </Karte>
      )}
      <div style={{ maxWidth: 1080 }}><KundenAnsicht sicht={sicht} vorschau /></div>
    </div>
  );
}
