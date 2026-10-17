'use client';

// ─── Fulfillment — „Fall starten“ direkt am gewonnenen Deal (17.10. spät, Branch `ff-einfach`) ───────────────────────────────────────────
// Rückmeldung 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist.“ Gemessen: vom gewonnenen Deal bis zum laufenden Fall waren es sechs
// Klicks über drei Seiten (Gewonnen → „Mandat anlegen“ ganz unten im Deal → „unter Produkte & Mandate öffnen“ → „Starten“ → „Fall anlegen“). Jetzt steht direkt
// unter der Stufe EIN Knopf „Mandat anlegen & Fall starten“: legt das Mandat über den vorhandenen Weg an (POST /api/crm/lead `mandat`) und öffnet gleich den
// vorhandenen Start-Dialog (Ablauf vorgewählt aus der Zuordnung des Produkts) — „Fall anlegen“ führt in den Fall. Gibt es das Mandat schon: „Fall starten“; läuft
// der Fall: „Fall öffnen ›“. Mandate einer Privat-Einheit bekommen kein Fulfillment (wie bisher nur „Mandat anlegen“). Schreibt nichts Eigenes.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import type { CrmApi } from '../../crm/daten';
import { useUebersichtKurz } from './daten';
import { StartDialog } from './Onboarding';

export function FallAmDeal({ api, chanceId }: { api: CrmApi; chanceId: string }) {
  const crm = api.crm;
  const c = crm?.stand.chancen.find(x => x.id === chanceId);
  // Nur am gewonnenen Deal fragen (17.10., Gesamtprüfung Tempo B2) — vorher holte jeder geöffnete Deal das Fulfillment.
  const kurz = useUebersichtKurz(c?.stufe === 'gewonnen');
  const [start, setStart] = useState<{ mandatId: string; kunde: string; leistungId?: string } | null>(null);
  if (!crm || !c || c.stufe !== 'gewonnen') return null;
  const mandat = crm.stand.mandate.find(m => m.chanceId === c.id && !m.geloeschtAm);
  const business = istBusinessGesellschaft(mandat?.gesellschaft ?? c.gesellschaft) && !!kurz.daten;
  const fall = mandat ? kurz.daten?.faelle[mandat.id] : undefined;
  const pakete = (kurz.daten?.prozesse ?? []).filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));
  const vorlageFuer = (leistungId?: string) => {
    const id = leistungId ? kurz.daten?.zuordnung[leistungId]?.vorlageId : undefined;
    const p = pakete.find(x => x.id === id);
    return p ? { vorlage: { id: p.id, titel: p.titel } } : {};
  };
  const anlegen = async (mitFall: boolean) => {
    const r = await fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'mandat', chanceId: c.id }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' })) as { ok?: boolean; fehler?: string; mandatId?: string };
    await api.laden(true);
    if (!r.ok) { api.setFehler(r.fehler ?? 'Mandat nicht angelegt.'); return; }
    if (mitFall && r.mandatId) setStart({ mandatId: r.mandatId, kunde: c.firma ?? c.titel, ...(c.leistungId ? { leistungId: c.leistungId } : {}) });
  };
  const box = { padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.gut}12`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const, marginTop: 8 };
  const klein = { fontSize: TYP.bedien, color: C.inkDim };
  return (
    <div className="ff-fall-am-deal" style={box}>
      {!mandat ? (
        <>
          <span style={{ fontSize: TYP.bedien, flex: '1 1 260px' }}>Gewonnen — jetzt Kunde: {business ? 'Mandat anlegen und gleich den Fall starten.' : 'aus dem Deal wird ein Mandat (Vertrag, Kick-off, Gesundheit des Mandats).'}</span>
          {business && <Knopf haupt farbe={LEUCHT.gut} onClick={() => anlegen(true)}>Mandat anlegen & Fall starten</Knopf>}
          <Knopf leise={business} farbe={LEUCHT.gut} onClick={() => anlegen(false)}>{business ? 'Nur Mandat anlegen' : 'Mandat anlegen'}</Knopf>
        </>
      ) : fall ? (
        <>
          <span style={{ fontSize: TYP.bedien, flex: '1 1 260px', color: LEUCHT.gut }}>Kunde — der Fall läuft{fall.phase ? ` (${fall.phase})` : ''}.</span>
          <Knopf href={WEG.fall(mandat.id)}>Fall öffnen ›</Knopf>
          <Link href={mandateLink('mandate', mandat.id)} style={{ ...klein, textDecoration: 'none' }}>Mandat ›</Link>
        </>
      ) : (
        <>
          <span style={{ fontSize: TYP.bedien, flex: '1 1 260px', color: LEUCHT.gut }}>Mandat angelegt{business ? ' — jetzt den Fall starten.' : '.'}</span>
          {business && <Knopf haupt farbe={LEUCHT.gut} onClick={() => setStart({ mandatId: mandat.id, kunde: mandat.kunde, ...(mandat.leistungId ? { leistungId: mandat.leistungId } : {}) })}>Fall starten</Knopf>}
          <Link href={mandateLink('mandate', mandat.id)} style={{ ...klein, textDecoration: 'none' }}>Mandat öffnen ›</Link>
        </>
      )}
      {start && <StartDialog k={{ mandatId: start.mandatId, kunde: start.kunde, ...vorlageFuer(start.leistungId) }} pakete={pakete} onZu={() => setStart(null)} />}
    </div>
  );
}
