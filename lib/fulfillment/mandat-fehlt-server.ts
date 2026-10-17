// ─── Fulfillment — Mandat fehlt im CRM: Marken lesen/schreiben (Server; 18.10., Gesamtprüfung L3 B5) — Regel rein in ./mandat-fehlt.ts ─────────────

import { fulfillmentAendern, fulfillmentLesen } from './speicher';
import { fehlendeMandatePlanen, markenOhneBezug, type FehltPlan } from './mandat-fehlt';

/**
 * Welche fehlenden Mandate sind heute „endgültig weg“? Schreibt neue Marken bzw. entfernt die Marken wiedergekehrter Mandate (Vorlagen-Bestand,
 * EINE Schreibstelle `fulfillmentAendern`). Ohne Änderung wird nichts geschrieben. Gebremst → Warnung im Log (nur die Art, keine Kennungen).
 */
export async function fehlendeMandatePruefen(betroffen: ReadonlySet<string>, bekannt: ReadonlySet<string>, heute: string, h: string, teil: string): Promise<FehltPlan> {
  const v = await fulfillmentLesen('vorlagen', h);
  const plan = fehlendeMandatePlanen({ betroffen, bekannt, marken: v.marken, heute });
  if (Object.keys(plan.neu).length || plan.aus.length) {
    await fulfillmentAendern('vorlagen', d => {
      const marken = { ...d.marken, ...plan.neu };
      for (const k of plan.aus) delete marken[k];
      return { ok: true, datei: { ...d, marken }, geaendert: [] };
    }, { art: 'system' }, h);
  }
  if (plan.gebremst) console.warn(`[loeschfristen] fulfillment-${teil}: gebremst (${plan.gebremst}) — nichts entfernt`);
  return plan;
}

/** Nach dem Lauf: Marken, deren Mandat in keinem Fulfillment-Bestand mehr vorkommt, fallen weg (Haushaltung). */
export async function fehltMarkenAufraeumen(h: string): Promise<void> {
  const [v, faelle, kunde, dossiers, personen] = await Promise.all([
    fulfillmentLesen('vorlagen', h), fulfillmentLesen('faelle', h), fulfillmentLesen('kunde', h), fulfillmentLesen('dossiers', h), fulfillmentLesen('personen', h),
  ]);
  const genannt = new Set<string>([
    ...Object.keys(faelle.faelle), ...Object.keys(dossiers.dossiers), ...personen.karten.map(k => k.mandatId),
    ...[...kunde.formulare, ...kunde.puls, ...kunde.pulsAnfragen, ...kunde.links, ...kunde.unterlagen].map(x => x.mandatId),
  ]);
  const weg = markenOhneBezug(v.marken, genannt);
  if (!weg.length) return;
  await fulfillmentAendern('vorlagen', d => {
    const marken = { ...d.marken };
    for (const k of weg) delete marken[k];
    return { ok: true, datei: { ...d, marken }, geaendert: [] };
  }, { art: 'system' }, h);
}
