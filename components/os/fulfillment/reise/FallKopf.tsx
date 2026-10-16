'use client';

// ─── Fulfillment · Fall — der Kopf: „Wo steht der Kunde?“ (11.10., Design-Überarbeitung) ────────────────────────────────────────────────
// Rückmeldung 11.10.: „man sieht nicht, wo der Kunde steht.“ Über JEDEM Reiter eines Falls beantwortet der Kopf in einem Blick: Wo stehen wir (Phasen-
// Strahl mit „Sie sind hier“, Freigabe-Punkten als Rauten, Fortschritt je Phase) · Was ist als Nächstes · Was hängt bzw. wartet auf wen — und
// zeigt (unter Überblick und Ablauf) den einen nächsten Handgriff als Hauptaktion. Gerechnet in lib/fulfillment/prozesse/reise.ts; Daten über
// `useFall` (dieselbe Antwort wie die Reiter, der Anfrage-Bündler teilt sie). Keine eigenen Schreibwege — die Aktion springt in den Reiter.

import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT, Punkt, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { anzahl, wort } from '@/lib/text/zahlwort';
import { localDay } from '@/lib/zeit';
import type { FallReiter } from '@/lib/fulfillment/adresse';
import { fallReise, naechsterHandgriff, naechsterPunkt, seitTagen, type Handgriff } from '@/lib/fulfillment/prozesse/reise';
import { abschlussSchritt } from '@/lib/fulfillment/prozesse/ansichten';
import { useFall, useCockpit, tagKurz } from '../prozesse/daten';
import { kundenAmpel } from '@/lib/fulfillment/prozesse/darstellung';
import { WARTET_ALT_TAGE, type CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { PhasenStrahl, MiniStrahl, Antworten, AntwortKachel, FortschrittsRing, Legende, FreigabeRaute, LegendenBalken, JETZT, AMPEL_FARBE, AMPEL_TEXT } from './bilder';
import { springe, sprungAnker, type Sprung } from './sprung';

/** Wohin ein Sprung führt — gleicher Reiter: Ereignis, sonst Adresse mit Anker. */
export function useFallSprung(mandatId: string, reiter: FallReiter) {
  const router = useRouter();
  return (ziel: FallReiter, s?: Sprung) => {
    if (ziel === reiter) { if (s) springe(s); return; }
    router.push(`${WEG.fall(mandatId, ziel)}${s ? `#${sprungAnker(s)}` : ''}`, { scroll: !s });
  };
}

export function FallKopf({ mandatId, reiter }: { mandatId: string; reiter: FallReiter }) {
  const { daten } = useFall(mandatId);
  const cockpit = useCockpit();
  const router = useRouter();
  const handy = useHandy();
  const geh = useFallSprung(mandatId, reiter);
  if (!daten?.fall) return null;
  const f = daten.fall;
  const heute = localDay();
  const freigaben = daten.vorlage?.freigaben ?? [];
  const reise = fallReise(f, freigaben, heute);
  const jetzt = reise.jetzt >= 0 ? reise.phasen[reise.jetzt] : null;
  // „Als Nächstes“ aus der EINEN Rechnung (`naechsterPunkt`) — dieselbe wie Lage, Cockpit, Landkarte (14.10., Abnahme B6). Nie ein Sammel-Schritt.
  const naechste = naechsterPunkt(f, freigaben, heute);
  const griff = naechsterHandgriff(f, daten.onboarding, freigaben, heute);
  const wartet = daten.wartet ?? [];
  // „Hängt etwas?“ aus DERSELBEN Rechnung wie die Lage und das Cockpit (`wasHaengt`) — 15.10., Abnahme B1: vorher „1 wartet auf den Kunden“ (4 Tage) hier,
  // „Nichts“ in der Lage. Was noch im Rahmen wartet, steht als Satz darunter.
  const zeile = cockpit.daten?.zeilen.find(z => z.mandatId === mandatId) ?? null;
  const zurPhase = (id: string) => geh('ablauf', { art: 'phase', wert: id });
  const strahl = reise.phasen.map(p => ({ ...p, ...(p.freigabe ? { freigabe: { ...p.freigabe } } : {}) }));
  const mitAktion = reiter === 'ueberblick' || reiter === 'ablauf';
  // 12.10.: nach dem letzten Schritt geht es weiter — Fall abschließen → Wirkungsbericht → Mandat beenden → Nachsorge („Abschluss & Kreislauf“).
  const abschluss = griff.art === 'fertig' ? abschlussSchritt({ fall: f, allePhasenFertig: reise.fertig, mandatEnde: daten.nachsorge?.ende ?? null, nachsorge: daten.nachsorge?.plan ?? [] }) : null;

  const h = zeile?.haengt ?? [];
  const rot = h.filter(x => x.schwere === 'rot');
  const imRahmen = wartet.length ? `${wartet.length} ${wort(wartet.length, 'wartet', 'warten')} beim Kunden (${wartet[0].titel}${wartet[0].tage !== undefined ? `, ${seitTagen(wartet[0].tage)}` : ''}) — ${wort(wartet.length, 'hängt', 'hängen')} erst nach ${WARTET_ALT_TAGE} Tagen.` : 'Kein Schritt überfällig, nichts liegt lange beim Kunden.';
  const haengt = !zeile ? { ampel: C.inkLeise, antwort: cockpit.daten ? 'Nichts hängt' : '…', unter: cockpit.daten ? imRahmen : 'Lädt …' }
    : h.length === 1 ? { ampel: rot.length ? LEUCHT.kritisch : LEUCHT.achtung, antwort: h[0].text, unter: h[0].seit ? `seit ${tagKurz(h[0].seit)}` : 'Antippen öffnet die Stelle.' }
      : h.length ? { ampel: rot.length ? LEUCHT.kritisch : LEUCHT.achtung, antwort: `${anzahl(h.length, 'Punkt hängt', 'Punkte hängen')}${rot.length ? ` · ${rot.length} dringend` : ''}`, unter: h.slice(0, 2).map(x => x.text).join(' · ') }
        : { ampel: LEUCHT.gut, antwort: 'Nichts hängt', unter: imRahmen };

  return (
    <Karte i={0} ton="fokus" licht={JETZT}>
      <Ueberschrift farbe={JETZT} erklaerung="fulfillment.reise" rechts={<span>{daten.vorlage?.titel ?? ''}</span>}>Wo steht der Kunde?</Ueberschrift>
      {zeile && <LageZeile zeile={zeile} />}
      {reise.phasen.length === 0 ? null : handy
        ? <MiniStrahl phasen={strahl} onPhase={zurPhase} />
        : <PhasenStrahl phasen={strahl} onPhase={zurPhase} />}
      {!handy && reise.phasen.some(p => p.freigabe) && (
        <Legende eintraege={[
          { zeichen: <LegendenBalken farbe={LEUCHT.gut} />, text: 'erledigt' },
          { zeichen: <LegendenBalken farbe={JETZT} />, text: 'hier stehen wir' },
          { zeichen: <FreigabeRaute gegeben />, text: 'Abstimmungspunkt vermerkt' },
          { zeichen: <FreigabeRaute gegeben={false} aktiv />, text: 'Abstimmungspunkt offen — erst nach Bestätigung geht es weiter' },
        ]} />
      )}
      <Antworten>
        <AntwortKachel frage="Wo stehen wir?" links={<FortschrittsRing prozent={reise.fortschritt} label="Fortschritt des Falls" />}
          antwort={jetzt ? `Phase ${jetzt.nr} von ${reise.phasen.length}: ${jetzt.titel}` : reise.fertig ? 'Alle Phasen erledigt' : 'Noch keine Phase'}
          unter={jetzt ? `${jetzt.erledigt} von ${jetzt.gesamt} ${wort(jetzt.gesamt, 'Schritt', 'Schritten')} dieser Phase erledigt${jetzt.faelligAm ? ` · Phase bis ${tagKurz(jetzt.faelligAm)}` : ''}` : f.status === 'pausiert' ? 'Der Fall ist pausiert.' : undefined} />
        <AntwortKachel frage="Als Nächstes" ampel={naechste?.ueberfaellig ? LEUCHT.kritisch : JETZT}
          antwort={naechste ? naechste.titel : griff.art === 'fertig' ? '—' : griff.text}
          unter={naechste ? [naechste.zustand === 'wartet_kunde' ? 'liegt beim Kunden' : naechste.zustand === 'in_arbeit' ? 'in Arbeit' : null, naechste.ueberfaellig ? 'überfällig' : naechste.faelligAm ? `fällig ${tagKurz(naechste.faelligAm)}` : null, naechste.phase ? `in „${naechste.phase}“` : null,
            // 15.10. (Abnahme B1): weicht die Kunden-Seite ab (interner Schritt), steht hier, was der Kunde liest — die Abweichung ist erklärt.
            daten.kundeNaechster && !daten.kundeNaechster.gleich && !daten.kundeNaechster.wartet ? `interner Schritt — der Kunde sieht als Nächstes: ${daten.kundeNaechster.text ?? '„Die nächsten Schritte stimmen wir im nächsten Termin ab.“'}` : null].filter(Boolean).join(' · ') : undefined}
          onClick={naechste?.phaseId ? () => zurPhase(naechste.phaseId!) : undefined} ariaLabel={naechste ? `Als Nächstes: ${naechste.titel} — im Ablauf öffnen` : undefined} />
        <AntwortKachel frage="Hängt etwas?" ampel={haengt.ampel} antwort={haengt.antwort} unter={haengt.unter}
          onClick={h[0] ? () => router.push(h[0].href) : wartet.length ? () => geh(wartet[0].art === 'entscheidung' ? 'menschen' : 'ablauf') : undefined} />
      </Antworten>
      {mitAktion && griff.art !== 'fertig' && <Handgriffknopf griff={griff} geh={geh} />}
      {mitAktion && griff.art === 'fertig' && abschluss && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Knopf haupt onClick={() => geh('kreislauf', { art: 'stelle', wert: abschluss.art === 'nachsorge' || abschluss.art === 'mandat-beenden' ? 'kreislauf-nachher' : 'kreislauf-wirkung' })}>{abschluss.text} ›</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{abschluss.unter}</span>
        </div>
      )}
      {f.status === 'pausiert' && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Der Fall ist pausiert — Uhren und Erinnerungen ruhen.</div>}
    </Karte>
  );
}

/**
 * Die Ampel des Kunden (intern: Hänger + Health) und daneben, was der Kunde auf seiner Seite liest — dieselbe Rechnung übersetzt, mit dem Grund, wenn es
 * abweicht (15.10., Abnahme B1: „Health zählt beim Kunden nicht“, „interne Punkte zeigt die Kunden-Seite als ‚Wir sind dran‘“).
 */
export function LageZeile({ zeile }: { zeile: Pick<CockpitZeile, 'health' | 'haengt' | 'kundeSieht'> }) {
  const a = kundenAmpel(zeile);
  const k = zeile.kundeSieht;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: AMPEL_FARBE[a] }}><Punkt farbe={AMPEL_FARBE[a]} groesse={8} />{AMPEL_TEXT[a]}</span>
      {k && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Punkt farbe={AMPEL_FARBE[k.ampel]} groesse={7} />Der Kunde sieht: „{k.titel}“{k.grund ? ` (${k.grund})` : ''}</span>}
    </div>
  );
}

/** Die eine Hauptaktion des Falls — führt dorthin, wo der Handgriff passiert. */
function Handgriffknopf({ griff, geh }: { griff: Handgriff; geh: ReturnType<typeof useFallSprung> }) {
  const klick = () => {
    switch (griff.art) {
      case 'willkommen': return geh('ueberblick', { art: 'willkommen' });
      case 'onboarding': return geh(griff.reiter);
      case 'freigabe': return geh('ablauf', { art: 'freigabe', wert: griff.id });
      case 'schritt': return geh('ablauf');
      default: return undefined;
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <Knopf haupt onClick={klick}>{griff.text}{griff.art === 'onboarding' || griff.art === 'schritt' ? ' ›' : ''}</Knopf>
      {griff.art === 'willkommen' && griff.dringend && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>überfällig — bitte heute senden</span>}
    </div>
  );
}
