'use client';

// ─── Markttraktion · Marketing — ansprechbar sein, nicht laut ─────────────────────────
// Oben der Head of Marketing (Lauf, Vorschläge zur Freigabe). Darunter sechs
// Reiter:
//   Übersicht       Wirkung (Kennzahlen mit Ampel), Einwilligungsbestand,
//                   Art. 14, Quellen der Chancen, Stimme der Kunden
//   Segmente        gespeicherte Filter über die Kartei, Export nur mit Ampel
//   Kampagnen       Playbooks auf Basis der Kunden (./Kampagnen.tsx)
//   Redaktionsplan  Beiträge von der Idee bis zur Wirkung je Person
//   Newsletter      Ausgaben, Empfänger nur mit Double-Opt-in
//   Positionierung  Positionierung, Zielgruppe, Ton, Themensäulen
// Gemessen wird an Gesprächen und Chancen — keine Likes, keine Öffnungsraten.
// MAKE OS versendet und veröffentlicht nichts.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HeadPanel } from './HeadPanel';
import { Pillen } from './teile';
import type { CrmApi } from './daten';
import { Kampagnen } from './Kampagnen';
import { Uebersicht } from './marketing/Uebersicht';
import { Segmente } from './marketing/Segmente';
import { Redaktionsplan } from './marketing/Redaktionsplan';
import { Newsletter } from './marketing/Newsletter';
import { Positionierung } from './marketing/Positionierung';

type Unter = 'uebersicht' | 'segmente' | 'kampagnen' | 'redaktion' | 'newsletter' | 'positionierung';
const UNTER: { id: Unter; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' }, { id: 'segmente', label: 'Segmente' }, { id: 'kampagnen', label: 'Kampagnen' },
  { id: 'redaktion', label: 'Redaktionsplan' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'positionierung', label: 'Positionierung' },
];
/** Kampagnen-Ansicht liest diesen Schlüssel und öffnet den Planer mit dem Segment. */
const KAMPAGNE_SEGMENT_SCHLUESSEL = 'crm-kampagne-segment';

export function Marketing({ api, zuKontakt, start, onAnsicht }: { api: CrmApi; zuKontakt: (id: string) => void; start?: string; onAnsicht?: (a: string) => void }) {
  const params = useSearchParams();
  const wunsch = start ?? params.get('a') ?? undefined;
  const [unter, setUnter] = useState<Unter>(UNTER.find(u => u.id === wunsch)?.id ?? 'uebersicht');
  useEffect(() => { if (wunsch && UNTER.some(u => u.id === wunsch)) setUnter(wunsch as Unter); }, [wunsch]);
  // Die Ansicht steht in der Adresse — Zurück im Browser und Links führen wieder genau hierher.
  const waehle = (u: Unter) => { setUnter(u); onAnsicht?.(u); };
  const zuKampagne = (segmentId: string) => {
    try { sessionStorage.setItem(KAMPAGNE_SEGMENT_SCHLUESSEL, segmentId); } catch { /* ohne Speicher öffnet der Planer leer */ }
    waehle('kampagnen');
  };
  const n = { segmente: api.crm?.stand.segmente?.length ?? 0, redaktion: api.crm?.stand.beitraege?.length ?? 0, newsletter: api.crm?.stand.newsletter?.length ?? 0 } as Partial<Record<Unter, number>>;
  const liste = UNTER.map(u => ({ id: u.id, label: n[u.id] ? `${u.label} ${n[u.id]}` : u.label }));

  return (
    <>
      {/* Die Kampagnen-Ansicht bringt ihren eigenen Head-Lauf (Modus „kampagne“) mit. */}
      {unter !== 'kampagnen' && <HeadPanel head="marketing" standardModus="wochenplan" zuKontakt={zuKontakt} i={0} />}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={liste} aktiv={unter} onWahl={waehle} /></div>
      {unter === 'uebersicht' && <Uebersicht api={api} zuKontakt={zuKontakt} />}
      {unter === 'segmente' && <Segmente api={api} zuKontakt={zuKontakt} zuKampagne={zuKampagne} />}
      {unter === 'kampagnen' && <Kampagnen api={api} zuKontakt={zuKontakt} />}
      {unter === 'redaktion' && <Redaktionsplan api={api} zuKontakt={zuKontakt} />}
      {unter === 'newsletter' && <Newsletter api={api} />}
      {unter === 'positionierung' && <Positionierung api={api} />}
    </>
  );
}
