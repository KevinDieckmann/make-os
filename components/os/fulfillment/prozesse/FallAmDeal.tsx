'use client';

// ─── Fulfillment — „Fall starten“ direkt am gewonnenen Deal (17.10. spät, Branch `ff-einfach`) ───────────────────────────────────────────
// Rückmeldung 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist.“ Gemessen: vom gewonnenen Deal bis zum laufenden Fall waren es sechs
// Klicks über drei Seiten (Gewonnen → „Mandat anlegen“ ganz unten im Deal → „unter Produkte & Mandate öffnen“ → „Starten“ → „Fall anlegen“). Jetzt steht direkt
// unter der Stufe EIN Knopf „Mandat anlegen & Fall starten“: legt das Mandat über den vorhandenen Weg an (POST /api/crm/lead `mandat`) und öffnet gleich den
// vorhandenen Start-Dialog (Ablauf vorgewählt nach `startVorbelegung`: Prozess des Produkts, sonst sein Paket) — „Fall anlegen“ führt in den Fall. Gibt es das Mandat schon: „Fall starten“; läuft
// der Fall: „Fall öffnen ›“. Mandate einer Privat-Einheit bekommen kein Fulfillment (wie bisher nur „Mandat anlegen“). Schreibt nichts Eigenes.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT, Hinweis } from '../../ui';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { mandatInSicht } from '@/lib/fulfillment/regeln';
import { useNurBusiness } from '../../useInhaber';
import type { CrmApi } from '../../crm/daten';
import { useUebersichtKurz, startMandat } from './daten';
import { StartDialog } from './Onboarding';
import { usePlatzLage } from '../../crm/plaetze';
import { useMandatAnlegen } from '../../crm/MandatAnlegenFenster';

export function FallAmDeal({ api, chanceId }: { api: CrmApi; chanceId: string }) {
  const crm = api.crm;
  const c = crm?.stand.chancen.find(x => x.id === chanceId);
  // Nur am gewonnenen Deal fragen (17.10., Gesamtprüfung Tempo B2) — vorher holte jeder geöffnete Deal das Fulfillment.
  const kurz = useUebersichtKurz(c?.stufe === 'gewonnen');
  const [start, setStart] = useState<{ mandatId: string; kunde: string; leistungId?: string; start?: string } | null>(null);
  // 24.10. (Bau-Test, Branch `kern-preise`): „Mandat anlegen“ öffnet erst die Vorbelegung zum Prüfen (Start wählbar) — angelegt wird erst dort.
  const mandatFenster = useMandatAnlegen(api);
  // 25.10.: auch Deals/Mandate der Privat-Arbeits-Einheit bekommen Fulfillment — außer für ein Konto „nur Business“ (der Server sperrt es ohnehin, 403/404).
  const nurBusiness = useNurBusiness() === true;
  if (!crm || !c || c.stufe !== 'gewonnen') return null;
  const mandat = crm.stand.mandate.find(m => m.chanceId === c.id && !m.geloeschtAm);
  const business = mandatInSicht(mandat?.gesellschaft ?? c.gesellschaft, !nurBusiness) && !!kurz.daten;
  const fall = mandat ? kurz.daten?.faelle[mandat.id] : undefined;
  const pakete = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));

  const anlegen = async (mitFall: boolean) => {
    const r = await mandatFenster.oeffnen(c.id);
    if (!r) return;
    await api.laden(true);
    if (!r.ok) { api.setFehler(r.fehler ?? 'Mandat nicht angelegt.'); return; }
    if (mitFall && r.mandatId) setStart({ mandatId: r.mandatId, kunde: c.firma ?? c.titel, ...(c.leistungId ? { leistungId: c.leistungId } : {}), ...(r.start ? { start: r.start } : {}) });
  };
  const box = { padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.gut}12`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const, marginTop: 8 };
  const klein = { fontSize: TYP.bedien, color: C.inkDim };
  return (
    <div className="ff-fall-am-deal" style={box}>
      {!mandat ? (
        <AnlegenKnoepfe api={api} leistungId={c.leistungId} business={business} anlegen={anlegen} />
      ) : fall ? (
        <>
          <span style={{ fontSize: TYP.bedien, flex: '1 1 260px', color: LEUCHT.gut }}>Kunde — der Fall läuft{fall.phase ? ` (${fall.phase})` : ''}.</span>
          <Knopf href={WEG.fall(mandat.id)}>Fall öffnen ›</Knopf>
          <Link href={mandateLink('mandate', mandat.id)} style={{ ...klein, textDecoration: 'none' }}>Mandat ›</Link>
        </>
      ) : (
        <>
          <span style={{ fontSize: TYP.bedien, flex: '1 1 260px', color: LEUCHT.gut }}>Mandat angelegt{business ? ' — jetzt den Fall starten.' : '.'}</span>
          {business && <Knopf haupt farbe={LEUCHT.gut} onClick={() => setStart({ mandatId: mandat.id, kunde: mandat.kunde, ...(mandat.leistungId ? { leistungId: mandat.leistungId } : {}), ...(mandat.start ? { start: mandat.start } : {}) })}>Fall starten</Knopf>}
          <Link href={mandateLink('mandate', mandat.id)} style={{ ...klein, textDecoration: 'none' }}>Mandat öffnen ›</Link>
        </>
      )}
      {mandatFenster.fenster}
      {start && <StartDialog k={startMandat(kurz.daten, start)} pakete={pakete} onZu={() => setStart(null)} />}
    </div>
  );
}

/**
 * Die Knöpfe am gewonnenen Deal ohne Mandat — mit der Platzgrenze (21.10., Rundgang B3: warnen, aber erlauben): sind alle Plätze des Produkts
 * belegt, fragt der Klick erst („Alle N Plätze belegt — trotzdem anlegen?“), ein Klick „Trotzdem anlegen“ legt an (der Server lehnt nie ab).
 */
function AnlegenKnoepfe({ api, leistungId, business, anlegen }: { api: CrmApi; leistungId?: string; business: boolean; anlegen: (mitFall: boolean) => Promise<void> }) {
  const platz = usePlatzLage(api, leistungId);
  const [frage, setFrage] = useState<boolean | null>(null);
  const los = async (mitFall: boolean) => { if (platz.frage) setFrage(mitFall); else await anlegen(mitFall); };
  return (
    <>
      <span style={{ fontSize: TYP.bedien, flex: '1 1 260px' }}>Gewonnen — jetzt Kunde: {business ? 'Mandat anlegen und gleich den Fall starten.' : 'aus dem Deal wird ein Mandat (Vertrag, Kick-off, Gesundheit des Mandats).'}</span>
      {business && <Knopf haupt farbe={LEUCHT.gut} onClick={() => los(true)}>Mandat anlegen & Fall starten</Knopf>}
      <Knopf leise={business} farbe={LEUCHT.gut} onClick={() => los(false)}>{business ? 'Nur Mandat anlegen' : 'Mandat anlegen'}</Knopf>
      {frage !== null && platz.frage && (
        <div style={{ flex: '1 1 100%' }}>
          <Hinweis art="achtung" aktion={<><Knopf leise onClick={() => setFrage(null)}>Abbrechen</Knopf><Knopf onClick={async () => { const mitFall = frage; setFrage(null); await anlegen(mitFall); }}>Trotzdem anlegen</Knopf></>}>{platz.frage}</Hinweis>
        </div>
      )}
    </>
  );
}
