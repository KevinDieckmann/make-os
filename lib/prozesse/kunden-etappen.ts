// ─── Prozesse × Fulfillment — was der Kunde von einem Prozess der Werkstatt sieht (22.10.; Kevin: „der Kunde sieht seine Etappen“) ──────────────────────
// Ein Mandat, dessen Produkt auf einen Prozess der Werkstatt zeigt (lib/prozesse/produkt-bindung.ts), hat oft KEINEN Fall des Fulfillments — dann zeigt der
// Kunden-Link (Seite, Vorschau „So sieht der Kunde es“) die Etappen aus dem Lauf: dieselben Schlüssel der Positivliste (`zeitstrahl`, `erledigt`, `naechstes`,
// lib/fulfillment/kunde/sicht.ts) — kein neuer Inhalt auf der Kunden-Seite, nur eine zweite Quelle für dieselben Felder. Regeln (rein, client-sicher):
//   · NUR Knoten, die im Prozess ausdrücklich „Dem Kunden zeigen“ tragen (`kundeSichtbar === true`) und eine der Formen Schritt · Nachricht · Termin haben —
//     Agenten, Rauten, Freigaben, Warten, Auslöser, Schleifen erreichen den Kunden nie.
//   · NUR scharfe Läufe (Schatten/Probelauf ist eine Rechnung, kein Stand des Kunden), nie abgebrochene; die Version des Laufs zählt (nie der Entwurf).
//   · Eine Phase erscheint nur mit mindestens einem sichtbaren Schritt (nur ihr Titel). Titel laufen durch `kundenText` (keine internen Kürzel/Zusätze).
//   · Gibt es einen Fall des Fulfillments, gilt weiter NUR der Fall (bit-gleich wie vorher) — das entscheidet der Aufrufer (`sichtFuer`).

import type { KundenPhase } from '@/lib/fulfillment/kunde/bild';
import { kundenText } from '@/lib/fulfillment/kunde/bild';
import type { ProzessDefinition } from './definition';
import type { ProzessLauf } from './lauf-typen';
import type { ProduktAblaufAnsicht } from './produkt-ablauf';
import { knotenStand } from './lauf-regeln';
import { phasen, schritteDer } from './fluss';
import { kundenFormErlaubt } from './produkt-bindung';

export { KUNDEN_FORMEN, kundenFormErlaubt } from './produkt-bindung';

export interface KundenEtappen { phasen: KundenPhase[]; erledigt: string[]; naechstes: string[] }
/** Höchstens so viele „als Nächstes“ (wie die Kunden-Karten des Falls: kurz). */
const NAECHSTES_MAX = 3;
const OFFEN = new Set(['laeuft', 'wartet', 'freigabe']);

/** Die Etappen aus den scharfen Läufen eines Mandats (in der Reihenfolge ihres Starts) — null, wenn nichts davon für den Kunden bestimmt ist. */
export function kundenEtappen(laeufe: readonly { lauf: Pick<ProzessLauf, 'modus' | 'status' | 'start' | 'schritte'>; def: Pick<ProzessDefinition, 'knoten'> }[]): KundenEtappen | null {
  const raus: KundenEtappen = { phasen: [], erledigt: [], naechstes: [] };
  const offen: string[] = [], kommt: string[] = [];
  for (const { lauf, def } of [...laeufe].sort((a, b) => (a.lauf.start < b.lauf.start ? -1 : 1))) {
    if (lauf.modus !== 'scharf' || lauf.status === 'abgebrochen') continue;
    const stand = knotenStand(lauf as ProzessLauf);
    const fertig = lauf.status === 'fertig';
    for (const ph of phasen(def)) {
      const sichtbar = schritteDer(def, ph.id).filter(s => s.kundeSichtbar === true && kundenFormErlaubt(s.form));
      if (!sichtbar.length) continue;
      const erledigt = sichtbar.filter(s => stand[s.id]?.status === 'erledigt');
      const begonnen = sichtbar.some(s => stand[s.id]);
      const alle = fertig || erledigt.length === sichtbar.length;
      raus.phasen.push({ titel: kundenText(ph.titel), stand: alle ? 'erledigt' : begonnen ? 'aktuell' : 'kommt', ...(alle ? {} : { anteil: Math.round((erledigt.length / sichtbar.length) * 100) / 100 }) });
      raus.erledigt.push(...erledigt.map(s => kundenText(s.titel)));
      if (fertig) continue;
      for (const s of sichtbar) {
        const st = stand[s.id]?.status;
        if (st && OFFEN.has(st)) offen.push(kundenText(s.titel));
        else if (!st) kommt.push(kundenText(s.titel));
      }
    }
  }
  if (!raus.phasen.length) return null;
  // Nur EINE Phase „hier stehen wir“: die erste begonnene; spätere begonnene laufen noch („laeuft“), wie im Zeitstrahl des Falls.
  const erste = raus.phasen.findIndex(p => p.stand === 'aktuell');
  raus.phasen = raus.phasen.map((p, i) => (p.stand === 'aktuell' && i !== erste ? { ...p, stand: 'laeuft' as const } : p));
  raus.naechstes = [...offen, ...kommt].slice(0, NAECHSTES_MAX);
  return raus;
}

/**
 * Die Phasen eines Werkstatt-Ablaufs, die der Kunde HINTER den Phasen des Falls sieht, solange es keine Etappen aus einem scharfen Lauf gibt (25.10., Kern-Bau-Test 2:
 * die Reise zeigte Onboarding + die Phasen des Ablaufs, die Kunden-Ansicht „Phase 1 von 1“) — DIESELBE Sichtregel wie `kundenEtappen`: nur Phasen mit mindestens
 * einem Schritt „Dem Kunden zeigen“ in einer Kunden-Form, nur ihr Titel (`kundenText`); Stand „kommt“ (alle sichtbaren Schritte erledigt: „erledigt“). Ein Ablauf im
 * Schatten erscheint so als das, was noch kommt — das Wort „Schatten“ erreicht den Kunden nie.
 */
export function kundenAblaufPhasen(a: Pick<ProduktAblaufAnsicht, 'phasen'>): KundenPhase[] {
  return a.phasen.flatMap(p => {
    const sichtbar = p.schritte.filter(s => s.kunde === true && kundenFormErlaubt(s.form) && s.zustand !== 'entfaellt');
    if (!sichtbar.length) return [];
    return [{ titel: kundenText(p.titel), stand: sichtbar.every(s => s.zustand === 'erledigt') ? 'erledigt' as const : 'kommt' as const }];
  });
}
