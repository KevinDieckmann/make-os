'use client';

// ─── Fulfillment · Fall — der Kopf: „Wo steht der Kunde?“ (11.10., Design-Überarbeitung) ────────────────────────────────────────────────
// Rückmeldung 11.10.: „man sieht nicht, wo der Kunde steht.“ Über JEDEM Reiter eines Falls beantwortet der Kopf in einem Blick: Wo stehen wir (Phasen-
// Strahl mit „Sie sind hier“, Freigabe-Punkten als Rauten, Fortschritt je Phase) · Was ist als Nächstes · Was hängt bzw. wartet auf wen — und
// zeigt (unter Überblick und Ablauf) den einen nächsten Handgriff als Hauptaktion. Gerechnet in lib/fulfillment/prozesse/reise.ts; Daten über
// `useFall` (dieselbe Antwort wie die Reiter, der Anfrage-Bündler teilt sie). Keine eigenen Schreibwege — die Aktion springt in den Reiter.

import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import type { FallReiter } from '@/lib/fulfillment/adresse';
import { fallReise, naechsterHandgriff, naechsterPunkt, seitTagen, type Handgriff } from '@/lib/fulfillment/prozesse/reise';
import { abschlussSchritt } from '@/lib/fulfillment/prozesse/ansichten';
import { useFall, tagKurz } from '../prozesse/daten';
import { PhasenStrahl, MiniStrahl, Antworten, AntwortKachel, FortschrittsRing, Legende, FreigabeRaute, LegendenBalken, JETZT } from './bilder';
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
  const ueberfaellig = f.knoten.filter(k => k.status !== 'erledigt' && k.status !== 'entfaellt' && k.faelligAm && k.faelligAm < heute && kinderLos(k.id, f.knoten));
  const wartet = daten.wartet ?? [];
  const willkommenRot = !!daten.onboarding?.willkommen.ueberfaellig && !f.onboarding.willkommenGesendetAm;
  const zurPhase = (id: string) => geh('ablauf', { art: 'phase', wert: id });
  const strahl = reise.phasen.map(p => ({ ...p, ...(p.freigabe ? { freigabe: { ...p.freigabe } } : {}) }));
  const mitAktion = reiter === 'ueberblick' || reiter === 'ablauf';
  // 12.10.: nach dem letzten Schritt geht es weiter — Fall abschließen → Wirkungsbericht → Mandat beenden → Nachsorge („Abschluss & Kreislauf“).
  const abschluss = griff.art === 'fertig' ? abschlussSchritt({ fall: f, allePhasenFertig: reise.fertig, mandatEnde: daten.nachsorge?.ende ?? null, nachsorge: daten.nachsorge?.plan ?? [] }) : null;

  const haengt = willkommenRot ? { ampel: LEUCHT.kritisch, antwort: 'Willkommensmail überfällig', unter: 'Die 24 Stunden nach der Unterschrift sind um.' }
    : ueberfaellig.length ? { ampel: LEUCHT.kritisch, antwort: `${ueberfaellig.length} überfällig`, unter: ueberfaellig.slice(0, 2).map(k => `„${k.titel}“ fällig ${tagKurz(k.faelligAm)}`).join(' · ') }
      : wartet.length ? { ampel: LEUCHT.achtung, antwort: `${wartet.length} wartet auf den Kunden`, unter: `${wartet[0].titel}${wartet[0].tage !== undefined ? ` · ${seitTagen(wartet[0].tage)}` : ''}` }
        : { ampel: LEUCHT.gut, antwort: 'Nichts hängt', unter: 'Kein Schritt überfällig, nichts liegt beim Kunden.' };

  return (
    <Karte i={0} ton="fokus" licht={JETZT}>
      <Ueberschrift farbe={JETZT} erklaerung="fulfillment.reise" rechts={<span>{daten.vorlage?.titel ?? ''}</span>}>Wo steht der Kunde?</Ueberschrift>
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
          unter={jetzt ? `${jetzt.erledigt} von ${jetzt.gesamt} Schritten dieser Phase erledigt${jetzt.faelligAm ? ` · Phase bis ${tagKurz(jetzt.faelligAm)}` : ''}` : f.status === 'pausiert' ? 'Der Fall ist pausiert.' : undefined} />
        <AntwortKachel frage="Als Nächstes" ampel={naechste?.ueberfaellig ? LEUCHT.kritisch : JETZT}
          antwort={naechste ? naechste.titel : griff.art === 'fertig' ? '—' : griff.text}
          unter={naechste ? [naechste.zustand === 'wartet_kunde' ? 'liegt beim Kunden' : naechste.zustand === 'in_arbeit' ? 'in Arbeit' : null, naechste.ueberfaellig ? 'überfällig' : naechste.faelligAm ? `fällig ${tagKurz(naechste.faelligAm)}` : null, naechste.phase ? `in „${naechste.phase}“` : null].filter(Boolean).join(' · ') : undefined}
          onClick={naechste?.phaseId ? () => zurPhase(naechste.phaseId!) : undefined} ariaLabel={naechste ? `Als Nächstes: ${naechste.titel} — im Ablauf öffnen` : undefined} />
        <AntwortKachel frage="Hängt etwas?" ampel={haengt.ampel} antwort={haengt.antwort} unter={haengt.unter}
          onClick={wartet.length && !ueberfaellig.length && !willkommenRot ? () => geh(wartet[0].art === 'entscheidung' ? 'menschen' : 'ablauf') : undefined} />
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

const kinderLos = (id: string, l: readonly { elternId?: string }[]) => !l.some(k => k.elternId === id);

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
