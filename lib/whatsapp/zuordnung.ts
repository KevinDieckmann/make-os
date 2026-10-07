// ─── WhatsApp — Telefonnummer → Kontakt/Firma/Deal (rein, 07.10.2026) ──────────────────────────────────────────────────
// Dieselbe Regel wie bei Mail (lib/gmail/zuordnung.ts `zuordnen`), nur mit der Telefonnummer statt der Adresse:
//   ANZEIGE  „gehört zu …“, sobald die Nummer (Telefon oder SMS/Mobil der Akte, normalisiert mit `normTelefon`) in der Kartei steht —
//            auch für eingeschränkte Personen (Auffinden ist keine Verarbeitung), dann mit `sperre`.
//   VERLAUF  erst nach dem Klick „Zuordnen“ (lib/inbox/verlauf.ts) — ZOE schlägt nur vor (Kevin 06.10.).
// Eine Nummer, die mehrere Akten tragen, wird NICHT zugeordnet (mehrdeutig — lieber kein Vorschlag als ein falscher).

import { anzeigename, normTelefon, type Kontakt } from '@/lib/make-one/crm';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Zuordnung } from '@/lib/gmail/typen';

/** Telefonnummer → Schlüssel (nur Ziffern, international, wie die wa_id von Meta). Leer, wenn zu kurz. Rein. */
export const telefonSchluessel = (t?: string | null): string => normTelefon(t ?? '').replace(/^\+/, '');

/** Nummer → Kontakt; mehrdeutige Nummern (zwei Akten) fallen heraus. Rein. */
export function telefonIndex(kontakte: readonly Kontakt[]): Map<string, Kontakt> {
  const m = new Map<string, Kontakt>();
  const doppelt = new Set<string>();
  for (const k of kontakte) {
    for (const s of new Set([telefonSchluessel(k.telefon), telefonSchluessel(k.sms)])) {
      if (!s) continue;
      const da = m.get(s);
      if (da && da.id !== k.id) doppelt.add(s); else m.set(s, k);
    }
  }
  for (const s of doppelt) m.delete(s);
  return m;
}

/** Zuordnung einer WhatsApp-Nummer für die Anzeige — null, wenn niemand (eindeutig) in der Kartei ist. Rein. */
export function waZuordnen(nummer: string, index: Map<string, Kontakt>, crm: Pick<CrmBestand, 'chancen' | 'firmen'>): Zuordnung | null {
  const c = index.get(nummer);
  return c ? zuordnungAus(c, crm) : null;
}

/**
 * Alle Akten, die diese Nummer tragen (Telefon oder SMS/Mobil) — für „Zuordnen zu …“, wenn die Nummer mehrdeutig ist (07.10. abends).
 * Nie automatisch: die Inbox zeigt die Auswahl, die Person klickt. Eingeschränkte Personen (Art. 18) und Werbesperren fallen heraus. Rein.
 */
export function telefonKandidaten(nummer: string, kontakte: readonly Kontakt[], max = 5): Kontakt[] {
  if (!nummer) return [];
  return kontakte.filter(k => !k.eingeschraenkt && !k.werbesperre && (telefonSchluessel(k.telefon) === nummer || telefonSchluessel(k.sms) === nummer)).slice(0, max);
}

/** Zuordnung für eine bestimmte Akte (Anzeige: Name, Firma, offener Deal, Sperre, Anrede). Rein. */
export function zuordnungAus(c: Kontakt, crm: Pick<CrmBestand, 'chancen' | 'firmen'>): Zuordnung {
  const deal = crm.chancen.find(x => OFFENE_STUFEN.includes(x.stufe) && x.kontaktIds.includes(c.id));
  const firma = c.firmaId ? crm.firmen.find(f => f.id === c.firmaId) : undefined;
  return {
    kontaktId: c.id, name: anzeigename(c),
    ...(firma?.name ?? c.firma ? { firma: firma?.name ?? c.firma } : {}), ...(c.firmaId ? { firmaId: c.firmaId } : {}),
    ...(deal ? { dealId: deal.id, dealTitel: deal.titel } : {}),
    ...(c.eingeschraenkt ? { sperre: 'eingeschraenkt' as const } : c.werbesperre ? { sperre: 'werbesperre' as const } : {}),
    ...(c.anrede ? { anrede: c.anrede } : {}),
  };
}
