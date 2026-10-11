// ─── Markttraktion · Ziele eines Mandats lesen und säubern (rein, client-sicher; 11.10., Fulfillment zusammen) ─────────────────────────────
// EINE Stelle für `Mandat.ziele`: der CRM-Säuberer (lib/crm/speicher.ts) UND jeder Leser, der den rohen Bestand sieht (ladeCrm säubert beim Lesen
// nicht), nehmen diese Funktion. Grund (Live-Daten-Regel: nach einem Update müssen alle Daten noch da sein): Mandate tragen ihre Ziele
// teils noch in der ALTEN Form — als Text (`ziele: ['Mehr Termine', …]`). Der Säuberer bis 10.10. las nur Objekte und verwarf solche Texte beim
// nächsten Speichern des Mandats; mit Fulfillment schreiben neue Wege (Phase, Ist-Wert, neues Ziel) automatisch an Mandate. Jetzt wird die alte
// Form gelesen und als `{ id: 'z<i>', text }` erhalten — dieselbe Kennung, die der Säuberer schon immer für Ziele ohne Kennung vergab, also
// stimmen Wert-Konto-Schlüssel vor und nach dem ersten Speichern überein. Objekte bleiben bit-gleich wie bisher.
// Wächter: tests/fulfillment-zusammen.test.ts („Mandat im Altformat“).

export interface MandatZiel { id: string; text: string; ziel?: string; ist?: string }

/** Grenze je Mandat (wie `LISTEN_GRENZEN.mandate.ziele` in lib/crm/speicher.ts — nur Sicherung, die Grenze prüft `crmGrenzen` vorher). */
export const MANDAT_ZIELE_MAX = 500;

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const opt = (v: unknown, n: number) => { const t = txt(v, n); return t || undefined; };

/**
 * Ziele säubern bzw. lesen — Objekte wie bisher (`id` ≤ 40, sonst `z<i>`; `text` ≤ 300 Pflicht; `ziel`/`ist` ≤ 80), Texte der alten Form als
 * `{ id: 'z<i>', text }` (stößt `z<i>` auf eine schon vergebene Kennung, dann `z<i>-t`). Nie geworfen, nie still mehr gekürzt als bisher.
 */
export function mandatZieleLesen(v: unknown, max = MANDAT_ZIELE_MAX): MandatZiel[] {
  if (!Array.isArray(v)) return [];
  const roh = v.slice(0, max);
  const vergeben = new Set(roh.map(z => (z && typeof z === 'object' ? txt((z as Record<string, unknown>).id, 40) : '')).filter(Boolean));
  const raus: MandatZiel[] = [];
  roh.forEach((z, i) => {
    if (typeof z === 'string') {
      const text = txt(z, 300);
      if (!text) return;
      const id = vergeben.has(`z${i}`) ? `z${i}-t` : `z${i}`;
      vergeben.add(id);
      raus.push({ id, text });
      return;
    }
    const o = (z && typeof z === 'object' ? z : {}) as Record<string, unknown>;
    const text = txt(o.text, 300);
    if (!text) return;
    const ziel = opt(o.ziel, 80), ist = opt(o.ist, 80);
    raus.push({ id: txt(o.id, 40) || `z${i}`, text, ...(ziel ? { ziel } : {}), ...(ist ? { ist } : {}) });
  });
  return raus;
}
