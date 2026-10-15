'use client';

// ─── Fulfillment › Visualisierung — Mandats-Cockpit, Kennzahlen, Landkarte, Kunden-Ansicht (Paket C1, 10.10.; Design-Überarbeitung 11.10.; FULFILLMENT_KONZEPT.md 6.3, 1.4) ─
// Rückmeldung 11.10.: „Cockpit über alle Kunden — eine Kartenreihe je Kunde.“ Oben „Was hängt“ (rot vor gelb, älteste zuerst), darunter je laufendem Fall
// EINE Karte, sortiert nach „braucht Aufmerksamkeit“ (lib/fulfillment/prozesse/darstellung.ts): Ampel, Fortschrittsring, Phase als Mini-Strahl, Wert-
// Konto als Balken „vorher → jetzt → Ziel“, als Nächstes, wartet auf euch, nächster Termin. Dann die Erfolgsmaße aus 1.4 (je mit Erklärung; die Säule
// „Fulfillment“ im Business-Index steht im Business-Cockpit), die Landkarte groß und die Kunden-Ansicht-Vorlage (C2 `KundenAnsichtVorschau`).

import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, ECKE, FLAECHE_STIL, SCHRIFT, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Liste, Zeile, Chip, Punkt, Raster, Kennzahl, Leerzustand, Knopf, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { useCockpit, useUebersicht, tagKurz } from './daten';
import type { FfKennzahl } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { knotenAmpel, kundenAmpel, nachAufmerksamkeit } from '@/lib/fulfillment/prozesse/darstellung';
import { Landkarte } from './Zeichnung';
import { klein } from './teile';
import { KundenAnsichtVorschau } from '../kunde';
import { AMPEL_FARBE, AMPEL_TEXT, FortschrittsRing, MiniStrahl, WertBalken } from '../reise/bilder';

export function Cockpit() {
  const router = useRouter();
  const { daten, fehler } = useCockpit();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const zeilen = nachAufmerksamkeit(daten.zeilen);
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
        <Ueberschrift erklaerung="fulfillment.kundenKarten" rechts={<span>{zeilen.length} laufend</span>}>Unsere Kunden</Ueberschrift>
        {daten.kapa && <div style={klein}>Kapazität: {daten.kapa.stundenWoche.toLocaleString('de-DE')} h Aufwand je Woche{daten.kapa.frei != null ? ` gegen ${daten.kapa.frei.toLocaleString('de-DE')} h frei` : ''}{daten.kapa.ueber ? ' — mehr verplant als frei' : ''}.</div>}
        {!zeilen.length ? (
          <Leerzustand symbol="◎" ton={LEUCHT.business} titel="Noch kein laufender Fall" aktion={<Knopf onClick={() => router.push(WEG.fulfillment('onboarding'))}>Zum Onboarding ›</Knopf>}>
            Ein Fall startet, sobald ein Mandat unterschrieben ist und ihr das Onboarding startet.
          </Leerzustand>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
            {zeilen.map(z => <KundenKarte key={z.mandatId} z={z} onOeffnen={() => router.push(WEG.fall(z.mandatId))} />)}
          </div>
        )}
      </Karte>
    </div>
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
        <FortschrittsRing prozent={z.fortschritt} label={`Fortschritt ${z.kunde}`} farbe={LEUCHT.business} />
        <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, overflowWrap: 'break-word' }}>{z.kunde}</b>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: f }}><Punkt farbe={f} groesse={8} />{AMPEL_TEXT[a]}</span>
          {/* 15.10. (Abnahme B1): dieselbe Rechnung, für den Kunden übersetzt — mit Grund, wenn sie abweicht */}
          {z.kundeSieht && <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'break-word' }}>Der Kunde sieht: „{z.kundeSieht.titel}“{z.kundeSieht.grund ? ` — ${z.kundeSieht.grund}` : ''}</span>}
          <span style={{ ...klein, color: C.inkLeise, overflowWrap: 'break-word' }}>{z.paket ?? z.titel}</span>
        </span>
      </span>
      {z.phasen && z.phasen.length > 0 && <MiniStrahl phasen={z.phasen} hoehe={6} />}
      <WertBalken wert={z.wert?.wert} ziele={z.wert?.ziele} kompakt />
      {/* 14.10. (Abnahme B6): „Als Nächstes“ ist der nächste Schritt (dieselbe Rechnung wie Fall-Kopf und Lage) — was hängt, steht darunter für sich. */}
      <span style={{ display: 'grid', gap: 4 }}>
        <span style={{ ...MIKRO }}>Als Nächstes</span>
        <span style={{ fontSize: TYP.bedien, color: C.ink, overflowWrap: 'anywhere' }}>{z.schritt ?? z.phase ?? '—'}</span>
      </span>
      {z.haengt[0] && (
        <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: TYP.bedien, color: rot.length ? LEUCHT.kritisch : LEUCHT.achtung, overflowWrap: 'anywhere' }}>
          <Punkt farbe={rot.length ? LEUCHT.kritisch : LEUCHT.achtung} groesse={7} />Hängt: {(rot[0] ?? z.haengt[0]).text}{z.haengt.length > 1 ? ` (+${z.haengt.length - 1})` : ''}
        </span>
      )}
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {z.status === 'onboarding' && <Chip farbe={z.onboarding.willkommenUeberfaellig ? LEUCHT.kritisch : LEUCHT.planung}>Onboarding · {z.onboarding.offen} offen</Chip>}
        {z.wartet > 0 && <Chip farbe={(z.wartetAeltesterTage ?? 0) > 7 ? LEUCHT.kritisch : LEUCHT.achtung}>{z.wartet} wartet auf Kunde{z.wartetAeltesterTage ? ` · ${z.wartetAeltesterTage} T.` : ''}</Chip>}
        {z.health && <Chip farbe={AMPEL_FARBE[z.health]}>Health {z.health === 'gruen' ? 'grün' : z.health}</Chip>}
        {z.puls && <Chip farbe={z.pulsKritisch ? LEUCHT.kritisch : LEUCHT.gut}>Puls {z.puls.wert}/10</Chip>}
        {z.report.faellig && <Chip farbe={LEUCHT.achtung}>Report fällig</Chip>}
        {z.naechsterRitual && <Chip farbe={C.inkDim}>Termin {tagKurz(z.naechsterRitual)}</Chip>}
        {z.analyse?.vorhanden && <Chip farbe={LEUCHT.agenten}>Dossier{z.analyse.f2 ? ' geprüft' : ''}</Chip>}
      </span>
    </button>
  );
}

function Kz({ x, erklaerung }: { x: FfKennzahl | undefined; erklaerung: Parameters<typeof Kennzahl>[0]['erklaerung'] }) {
  return x ? <Kennzahl wert={x.anzeige} label={x.label} unter={x.luecke ?? (x.n ? `aus ${x.n}` : undefined)} erklaerung={erklaerung} /> : null;
}

export function Visualisierung() {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  const cockpit = useCockpit();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const lk = daten.prozesse.find(p => p.art === 'landkarte');
  const ersterFall = Object.keys(daten.faelle)[0];
  const k = (id: string) => daten.kennzahlen.find(x => x.id === id);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
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
      {lk && (
        <Karte i={4} akzent={LEUCHT.business}>
          <Ueberschrift farbe={LEUCHT.business} erklaerung="fulfillment.landkarte">Landkarte</Ueberschrift>
          <Landkarte vorlage={lk} zaehler={daten.zaehler[lk.id] ?? {}} gross ampel={knotenAmpel(daten.zaehler[lk.id] ?? {}, cockpit.daten?.zeilen ?? [])} onKnoten={id => router.push(WEG.fulfillment('prozesse', { k: id }))} />
        </Karte>
      )}
      <Karte i={5}>
        <Ueberschrift>Kunden-Ansicht (Vorlage)</Ueberschrift>
        <KundenAnsichtVorschau {...(ersterFall ? { mandatId: ersterFall } : {})} />
      </Karte>
    </div>
  );
}
