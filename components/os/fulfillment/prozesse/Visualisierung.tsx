'use client';

// ─── Fulfillment › Visualisierung — Landkarte groß, Mandats-Cockpit, Kennzahlen, Kunden-Ansicht (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 6.3, 1.4) ─
// Das Cockpit zeigt „Was hängt“ zuerst (rot vor gelb, älteste zuerst), dann je laufendem Fall Phase, Fortschritt, „wartet auf euch“, Health,
// Puls, Analyse, Onboarding, nächsten Termin. Die Kennzahlen aus 1.4 stehen je mit Erklärung; die Säule „Fulfillment“ im Business-Index
// (Health, Takt, Puls, Wert-Konto) steht im Business-Cockpit. Die Kunden-Ansicht-Vorlage liefert Paket C2 (`KundenAnsichtVorschau`).

import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Liste, Zeile, Chip, Punkt, Raster, Kennzahl, Fortschritt, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { useCockpit, useUebersicht, tagKurz } from './daten';
import type { FfKennzahl } from '@/lib/fulfillment/prozesse/kennzahlen';
import { Landkarte } from './Zeichnung';
import { klein } from './teile';
import { KundenAnsichtVorschau } from '../kunde';

const AMPEL_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const AMPEL_TEXT = { gruen: 'grün', gelb: 'gelb', rot: 'rot' } as const;

export function Cockpit() {
  const router = useRouter();
  const { daten, fehler } = useCockpit();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Karte i={1} akzent={daten.haengt.some(h => h.schwere === 'rot') ? LEUCHT.kritisch : LEUCHT.gut}>
        <Ueberschrift erklaerung="fulfillment.cockpit" rechts={<span>{daten.haengt.length}</span>}>Was hängt</Ueberschrift>
        {!daten.haengt.length ? <div style={klein}>Nichts hängt — alle Fälle sind im Takt.</div> : (
          <Liste>
            {daten.haengt.map((h, i) => <Zeile key={`${h.mandatId}-${h.art}-${i}`} links={<Punkt farbe={h.schwere === 'rot' ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={h.text} unter={`${h.kunde}${h.seit ? ` · seit ${tagKurz(h.seit)}` : ''}`} onClick={() => router.push(h.href)} umbrechen />)}
          </Liste>
        )}
      </Karte>
      <Karte i={2}>
        <Ueberschrift erklaerung="fulfillment.fortschritt" rechts={<span>{daten.zeilen.length} laufend</span>}>Mandats-Cockpit</Ueberschrift>
        {daten.kapa && <div style={klein}>Kapazität: {daten.kapa.stundenWoche.toLocaleString('de-DE')} h Aufwand je Woche{daten.kapa.frei != null ? ` gegen ${daten.kapa.frei.toLocaleString('de-DE')} h frei` : ''}{daten.kapa.ueber ? ' — mehr verplant als frei' : ''}.</div>}
        {!daten.zeilen.length ? <div style={klein}>Noch kein laufender Fall — unter Onboarding starten.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {daten.zeilen.map(z => (
              <button key={z.mandatId} type="button" onClick={() => router.push(WEG.fall(z.mandatId))} className="fassbar"
                style={{ display: 'grid', gap: 6, textAlign: 'left', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', cursor: 'pointer', color: C.ink }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: TYP.body }}>{z.kunde}</b>
                  <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                    {z.health && <Chip farbe={AMPEL_FARBE[z.health]}>Health {AMPEL_TEXT[z.health]}</Chip>}
                    {z.puls && <Chip farbe={z.pulsKritisch ? LEUCHT.kritisch : LEUCHT.gut}>Puls {z.puls.wert}/10</Chip>}
                    {z.status === 'onboarding' && <Chip farbe={z.onboarding.willkommenUeberfaellig ? LEUCHT.kritisch : LEUCHT.planung}>Onboarding · {z.onboarding.offen} offen</Chip>}
                    {z.analyse?.vorhanden && <Chip farbe={LEUCHT.agenten}>Dossier{z.analyse.f2 ? ' geprüft' : ''}</Chip>}
                  </span>
                </div>
                <span style={klein}>{[z.paket, z.phase, z.schritt ? `als Nächstes: ${z.schritt}` : null].filter(Boolean).join(' · ')}</span>
                <Fortschritt anteil={z.fortschritt / 100} farbe={LEUCHT.business} />
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
                  {z.fortschritt} % · {z.wartet ? `${z.wartet} wartet auf Kunde${z.wartetAeltesterTage ? ` (ältester ${z.wartetAeltesterTage} Tage)` : ''}` : 'nichts wartet'}
                  {z.naechsterRitual ? ` · nächster Termin ${tagKurz(z.naechsterRitual)}` : ''}{z.report.faellig ? ' · Report fällig' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </Karte>
    </div>
  );
}

function Kz({ x, erklaerung }: { x: FfKennzahl | undefined; erklaerung: Parameters<typeof Kennzahl>[0]['erklaerung'] }) {
  return x ? <Kennzahl wert={x.anzeige} label={x.label} unter={x.luecke ?? (x.n ? `aus ${x.n}` : undefined)} erklaerung={erklaerung} /> : null;
}

export function Visualisierung() {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const lk = daten.prozesse.find(p => p.art === 'landkarte');
  const ersterFall = Object.keys(daten.faelle)[0];
  const k = (id: string) => daten.kennzahlen.find(x => x.id === id);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {lk && (
        <Karte i={1} akzent={LEUCHT.business}>
          <Ueberschrift farbe={LEUCHT.business} erklaerung="fulfillment.landkarte">Landkarte</Ueberschrift>
          <Landkarte vorlage={lk} zaehler={daten.zaehler[lk.id] ?? {}} gross onKnoten={id => router.push(WEG.fulfillment('prozesse', { k: id }))} />
        </Karte>
      )}
      <Cockpit />
      <Karte i={3}>
        <Ueberschrift>Erfolgsmaße</Ueberschrift>
        <div style={{ ...MIKRO }}>Wie gut wir liefern — je Kennzahl mit Erklärung</div>
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
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Health, Takt, Kunden-Puls und Wert-Konto zählen zusätzlich als Säule „Fulfillment“ im Business-Index — ohne laufenden Fall bleibt der Index genau wie bisher.</div>
      </Karte>
      <Karte i={4}>
        <Ueberschrift>Kunden-Ansicht (Vorlage)</Ueberschrift>
        <KundenAnsichtVorschau {...(ersterFall ? { mandatId: ersterFall } : {})} />
      </Karte>
    </div>
  );
}
