'use client';

// ─── Fulfillment — Kunden in Lieferung und Erfolgsmaße (Paket C1, 10.10. als Unter-Reiter „Visualisierung“; seit 17.10. Teil der Landkarte) ──────────────
// Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Den Unter-Reiter „Visualisierung“ gibt es nicht mehr (Adresse leitet auf die Landkarte): er
// zeigte „Was hängt“ (steht jetzt in der Lage-Zeile oben und auf jeder Kunden-Karte), die Landkarte ein zweites Mal und eine Kunden-Ansicht-Vorlage
// („Dem Kunden zeigen“ steht an der Landkarte). Was bleibt, hängt die Landkarte (Prozesse.tsx) ein:
//   · `Cockpit` — je laufendem Fall EINE Karte, sortiert nach „braucht Aufmerksamkeit“ (lib/fulfillment/prozesse/darstellung.ts): Ampel, Fortschrittsring,
//     Phase als Mini-Strahl, Wert-Konto als Balken, als Nächstes, was hängt, nächster Termin.
//   · `Erfolgsmasse` — die Erfolgsmaße aus 1.4 (je mit Erklärung; die Säule „Fulfillment“ im Business-Index steht im Business-Cockpit), zugeklappt.
// 17.10. spät (Branch `ff-einfach`, „maximal einfach für uns“): was zu tun ist („Als Nächstes“, „Hängt“), steht jetzt in „Heute im Fulfillment“ direkt darüber —
// mit dem Handgriff in der Zeile. Die Karte zeigt nur noch, WO jeder Kunde steht (Ampel, Fortschritt, Phase, Wert-Konto mit Messung, worauf gewartet wird) —
// nichts doppelt. „Der Kunde sieht …“ steht im Fall-Kopf (nur, wenn es abweicht).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, ECKE, FLAECHE_STIL, SCHRIFT, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Chip, Punkt, Raster, Kennzahl, Klappbar, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { useCockpit, tagKurz } from './daten';
import { wort } from '@/lib/text/zahlwort';
import type { FfKennzahl } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { WARTET_AUF_TEXT } from '@/lib/fulfillment/prozesse/reise';
import { kundenAmpel, nachAufmerksamkeit } from '@/lib/fulfillment/prozesse/darstellung';
import { klein } from './teile';
import { AMPEL_FARBE, AMPEL_TEXT, FortschrittsRing, MiniStrahl, WertBalken } from '../reise/bilder';

export function Cockpit() {
  const router = useRouter();
  const { daten, fehler } = useCockpit();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const zeilen = nachAufmerksamkeit(daten.zeilen);
  // 17.10. spät: ohne laufenden Fall sagt „Heute im Fulfillment“ darüber schon, wie ein Fall startet — keine zweite leere Karte.
  if (!zeilen.length) return null;
  return (
    <Karte i={1} id="ff-kunden">
      <Ueberschrift erklaerung="fulfillment.kundenKarten" rechts={<span>{zeilen.length} laufend</span>}>Kunden in Lieferung</Ueberschrift>
      {daten.kapa && <div style={klein}>Kapazität: {daten.kapa.stundenWoche.toLocaleString('de-DE')} h Aufwand je Woche{daten.kapa.frei != null ? ` gegen ${daten.kapa.frei.toLocaleString('de-DE')} h frei` : ''}{daten.kapa.ueber ? ' — mehr verplant als frei' : ''}.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
        {zeilen.map(z => <KundenKarte key={z.mandatId} z={z} onOeffnen={() => router.push(WEG.fall(z.mandatId))} />)}
      </div>
    </Karte>
  );
}

/** Eine Kunden-Karte im Cockpit: Ampel, Ring, Mini-Strahl, Wert-Konto, als Nächstes, wartet auf euch — ein Tipp öffnet den Fall. */
function KundenKarte({ z, onOeffnen }: { z: CockpitZeile; onOeffnen: () => void }) {
  const a = kundenAmpel(z);
  const f = AMPEL_FARBE[a];
  const rot = z.haengt.filter(h => h.schwere === 'rot');
  return (
    <button type="button" onClick={onOeffnen} className="fassbar" aria-label={`${z.kunde} — ${AMPEL_TEXT[a]}, ${z.fortschritt} % — Fall öffnen`}
      style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: 14, display: 'grid', gap: 10, alignContent: 'start', textAlign: 'left', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, minWidth: 0,
        borderLeft: `3px solid ${TIEF.rand(f)}` }}>
      <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <FortschrittsRing prozent={z.fortschritt} label={`Fortschritt ${z.kunde}`} />
        <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, overflowWrap: 'break-word' }}>{z.kunde}</b>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: f }}><Punkt farbe={f} groesse={8} />{AMPEL_TEXT[a]}</span>
          <span style={{ ...klein, color: C.inkLeise, overflowWrap: 'break-word' }}>{z.paket ?? z.titel}</span>
        </span>
      </span>
      {z.phasen && z.phasen.length > 0 && <MiniStrahl phasen={z.phasen} hoehe={6} />}
      {/* Wert-Konto nur mit Messung (17.10. spät: ohne Messung stand „noch keine Messung“ auf jeder neuen Karte — leblos). */}
      {z.wert && <WertBalken wert={z.wert.wert} ziele={z.wert.ziele} kompakt />}
      {/* Wo er steht: worauf gewartet wird (dieselbe Rechnung wie Fall-Kopf und Reise „hier“) — was zu tun ist, steht in „Heute im Fulfillment“. */}
      {z.schrittLage && <span style={{ ...klein, color: rot.length ? LEUCHT.kritisch : z.schrittLage.ueberfaellig ? LEUCHT.achtung : C.inkDim }}>{WARTET_AUF_TEXT[z.schrittLage.wartetAuf].replace(/^./, c => c.toUpperCase())}{z.haengt.length ? ` · ${z.haengt.length === 1 ? 'ein Punkt hängt' : `${z.haengt.length} Punkte hängen`}` : ''}</span>}
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {z.status === 'onboarding' && <Chip farbe={z.onboarding.willkommenUeberfaellig ? LEUCHT.kritisch : LEUCHT.planung}>Onboarding · {z.onboarding.offen} offen</Chip>}
        {z.wartet > 0 && <Chip farbe={(z.wartetAeltesterTage ?? 0) > 7 ? LEUCHT.kritisch : LEUCHT.achtung}>{z.wartet} {wort(z.wartet, 'wartet', 'warten')} auf Kunde{z.wartetAeltesterTage ? ` · ${z.wartetAeltesterTage} T.` : ''}</Chip>}
        {z.naechsterRitual && <Chip farbe={C.inkDim}>Termin {tagKurz(z.naechsterRitual)}</Chip>}
      </span>
    </button>
  );
}

function Kz({ x, erklaerung }: { x: FfKennzahl | undefined; erklaerung: Parameters<typeof Kennzahl>[0]['erklaerung'] }) {
  return x ? <Kennzahl wert={x.anzeige} label={x.label} unter={x.luecke ?? (x.n ? `aus ${x.n}` : undefined)} erklaerung={erklaerung} /> : null;
}

/** Die Erfolgsmaße (1.4) — wie gut wir liefern, je Kennzahl mit Erklärung. Zugeklappt am Ende der Landkarte. */
export function Erfolgsmasse({ kennzahlen }: { kennzahlen: readonly FfKennzahl[] }) {
  const [auf, setAuf] = useState(false);
  const k = (id: string) => kennzahlen.find(x => x.id === id);
  return (
    <Klappbar id="ff-erfolgsmasse" titel="Erfolgsmaße — wie gut wir liefern" offen={auf} umschalten={() => setAuf(!auf)}>
      <Raster min={170}>
        <Kz x={k("ff_willkommen_24h")} erklaerung="fulfillment.kennzahl.willkommen" />
        <Kz x={k("ff_kickoff_tage")} erklaerung="fulfillment.kennzahl.kickoff" />
        <Kz x={k("ff_wertkonto")} erklaerung="fulfillment.kennzahl.wertkonto" />
        <Kz x={k("ff_quickwin_30")} erklaerung="fulfillment.kennzahl.quickwin" />
        <Kz x={k("ff_report_takt")} erklaerung="fulfillment.kennzahl.reporttakt" />
        <Kz x={k("ff_wartet_alt")} erklaerung="fulfillment.kennzahl.wartet" />
        <Kz x={k("ff_puls")} erklaerung="fulfillment.kennzahl.puls" />
        <Kz x={k("ff_befaehigung")} erklaerung="fulfillment.kennzahl.befaehigung" />
        <Kz x={k("ff_dossier_belegt")} erklaerung="fulfillment.kennzahl.dossier" />
        <Kz x={k("ff_analyse_kosten")} erklaerung="fulfillment.kennzahl.kosten" />
      </Raster>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kunden-Gesundheit, Takt, Kunden-Puls und Wert-Konto zählen zusätzlich als Säule „Fulfillment“ im Business-Index — ohne laufenden Fall bleibt der Index genau wie bisher.</div>
    </Klappbar>
  );
}
