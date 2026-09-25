// ─── Das volle Datenpaket eines Head-Laufs ─────────────────────────────────
// datenpaket() (lib/heads/daten.ts) liefert die Fachdaten der Welt. Dazu
// kommen hier, was die besten Agenten zusätzlich sehen:
//   grundlauf   die Vorschläge des Regelwerks (lib/heads/grundlauf.ts) —
//               übernehmen, verwerfen mit Grund, ergänzen
//   lernen      Annahmequoten, Wirkung, Ablehnungsgründe, Muster und
//               Warnungen aus euren Entscheidungen (lib/heads/lernen.ts)
//   gedaechtnis Merksätze, die ihr dem Head gegeben habt
//   team        wer die Welt verantwortet, wer mitarbeitet
//   uebergaben  was andere Welten dieser Welt hingelegt haben (und umgekehrt)
// Rein bis auf nichts: alle Eingaben kommen herein.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { uebergaben } from '@/lib/crm/traktion';
import { TEAM, verantwortlich, nameVon, haeltBeziehung, zustaendig, BEIDE } from '@/lib/crm/team';
import { datenpaket } from './daten';
import { einstellungAus } from '@/lib/crm/marketing';
import { grundlauf } from './grundlauf';
import { lernstand } from './lernen';
import type { HeadId } from './prompt';
import type { HeadStand } from './stand';
import type { Vorschlag } from './pruefer';

export function vollesPaket(head: HeadId, modus: string, kontakte: Kontakt[], crm: CrmBestand, heute: string, person: string, stand: HeadStand) {
  const frueher = stand.vorschlaege.filter(v => v.status !== 'erledigt').map(v => ({ titel: v.titel, status: v.status }));
  const basis = datenpaket(head, modus, kontakte, crm, heute, person, frueher) as Record<string, unknown>;
  const g = modus === 'frage' ? null : grundlauf(head, modus, basis);
  const ue = uebergaben(kontakte, crm, heute).filter(u => u.an === head || u.von === head).map(u => ({ titel: u.titel, anzahl: u.anzahl, von: u.von, an: u.an, text: u.text }));
  return {
    ...basis,
    team: { verantwortlich: nameVon(verantwortlich(head)), mitglieder: TEAM.map(t => ({ kuerzel: t.id, name: t.name, verantwortet: t.verantwortet })), regel: 'Beide sehen alles. Zuständig ist, wer eingetragen ist (Beziehung, Chance, Mandat, Event) — sonst die/der Verantwortliche. „fuer“ setzt der Code.' },
    uebergaben: ue,
    lernen: lernstand(stand.vorschlaege, kontakte, heute, modus, crm),
    gedaechtnis: (stand.gedaechtnis ?? []).map(m => m.text),
    // Stimmprofil: der hinterlegte Ton — die angenommenen Entwürfe stehen als Muster unter „lernen“.
    stimme: { ton: einstellungAus(crm).ton || null },
    ...(g ? { grundlauf: g.antwort.vorschlaege.map(v => ({ art: v.art, titel: v.titel, begruendung: v.begruendung, kontakt_id: v.kontakt_id, chance_id: v.chance_id, mandat_id: v.mandat_id, event_id: v.event_id, frist: v.frist, prioritaet: v.prioritaet, dedup_schluessel: v.dedup_schluessel, quelle: v.quelle })) } : {}),
  };
}
export type VollesPaket = ReturnType<typeof vollesPaket>;

/** Wer einen Vorschlag tun soll — Chance → Mandat → Event → Beziehung → Verantwortung der Welt. */
export function fuerWen(v: Pick<Vorschlag, 'kontakt_id' | 'chance_id' | 'mandat_id' | 'event_id'>, head: HeadId, kontakte: Map<string, Kontakt>, crm: CrmBestand, person: string): string {
  const aufloesen = (z: string) => (z === BEIDE ? person : z);
  if (v.chance_id) { const c = crm.chancen.find(x => x.id === v.chance_id); if (c) return aufloesen(zustaendig(c.besitzer, 'sales')); }
  if (v.mandat_id) { const m = crm.mandate.find(x => x.id === v.mandat_id); if (m) return aufloesen(zustaendig(m.zustaendig, 'sales')); }
  if (v.event_id && head === 'event') {
    const t = v.kontakt_id ? crm.teilnahmen.find(x => x.eventId === v.event_id && x.kontaktId === v.kontakt_id) : undefined;
    if (t?.einladenDurch) return t.einladenDurch;
    const e = crm.events.find(x => x.id === v.event_id); if (e && !v.kontakt_id) return aufloesen(zustaendig(e.zustaendig, 'event'));
  }
  if (v.kontakt_id) { const k = kontakte.get(v.kontakt_id); if (k) return aufloesen(haeltBeziehung(k)); }
  return verantwortlich(head);
}
