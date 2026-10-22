// ─── Prozesse × Fulfillment — ein Paket für die Werkstatt lesen (Server, 22.10., Etappe 1 „Öffnen & Rundweg“; Plan research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──
// NUR lesen — schreibt nie, legt nichts an: das Paket aus dem Bestand `fulfillment--<h>` (EINE Wahrheit, keine Kopie), sein Stand (Fingerabdruck der ganzen Vorlage —
// derselbe wie der Fulfillment-Editor), die Befunde des Fulfillment-Modus und der Struktur (`vorlageStrukturPruefen` — dieselbe Regel wie jede Änderung am Paket),
// die Bausteine, auf die das Paket zeigt, mit der EINEN Kunden-Regel (`fuerKundenFrei`), die Zahl der laufenden Kunden (nur Mandate einer Business-Gesellschaft
// — dieselbe Grenze wie überall im Fulfillment) und die Produkte, denen das Paket zugeordnet ist (nur Kennung und Name). Keine Personen, keine Inhalte der Fälle.

import type { Befund, ProzessVorlage } from './definition';
import { fulfillmentModusBefunde, type BibliothekKurz } from './fulfillment-modus';
import type { ProduktVerweis } from './produkt-bindung';

export interface PaketFuerWerkstatt {
  paket: ProzessVorlage;
  /** Stand der ganzen Vorlage (wie der Fulfillment-Editor) — Etappe 2 schreibt nur mit diesem Stand (409). */
  stand: string;
  befunde: Befund[];
  bibliothek: BibliothekKurz[];
  /** Laufende Fälle (nicht abgeschlossen) von Business-Mandaten, die dieses Paket bzw. Zusatzmodul nutzen — nur die Zahl. */
  laufende: number;
  produkte: ProduktVerweis[];
  /** Der vorhandene Editor des Fulfillments (bis Etappe 2 der Weg zum Bearbeiten). */
  editor: string;
}

/** Das Paket `id` (nur Paket-Vorlagen) — null, wenn es keins gibt. Wirft nur, wenn ein Bestand unlesbar ist. */
export async function paketFuerWerkstatt(h: string, id: string): Promise<PaketFuerWerkstatt | null> {
  const [{ fulfillmentLesen, eintragStand }, { vorlageStrukturPruefen }, { fuerKundenFrei }, { istBusinessMandat }, { produkteVonVorlage }, { WEG }] = await Promise.all([
    import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/vorlagen-anwenden'), import('@/lib/fulfillment/prozesse/bausteine'),
    import('@/lib/fulfillment/regeln'), import('./produkt-bindung'), import('@/lib/wege'),
  ]);
  const d = await fulfillmentLesen('vorlagen', h);
  const v = d.prozesse.find(p => p.id === id && p.art === 'paket');
  if (!v) return null;
  const befunde = fulfillmentModusBefunde(v);
  try { vorlageStrukturPruefen(v, d); } catch (e) { befunde.push({ stufe: 'fehler', text: e instanceof Error ? e.message : 'Die Struktur des Pakets ist nicht gültig.' }); }
  const genutzt = new Set(v.knoten.map(k => k.bausteinId).filter((x): x is string => !!x));
  const bibliothek: BibliothekKurz[] = d.bausteine.filter(b => genutzt.has(b.id)).map(b => {
    const k = fuerKundenFrei(b, d);
    return { id: b.id, titel: b.titel, art: b.art, kundeFrei: k.frei, ...(k.grund ? { grund: k.grund } : {}) };
  });
  // Laufende Kunden und Produkte: jeder Teil für sich abgesichert — fehlt das CRM, fehlt die Zahl (nie eine erfundene).
  let laufende = 0; let produkte: ProduktVerweis[] = [];
  try {
    const [faelle, crm] = await Promise.all([fulfillmentLesen('faelle', h), (await import('@/lib/crm/speicher')).ladeCrm()]);
    const business = new Set(crm.mandate.filter(m => !m.geloeschtAm && istBusinessMandat(m.gesellschaft)).map(m => m.id));
    laufende = Object.values(faelle.faelle).filter(f => f.status !== 'abgeschlossen' && business.has(f.mandatId) && (f.vorlageId === id || (f.zusaetze ?? []).some(z => z.vorlageId === id))).length;
    produkte = produkteVonVorlage(crm.leistungen, d.zuordnung, id);
  } catch { /* ohne Zahl */ }
  return { paket: v, stand: eintragStand(v), befunde, bibliothek, laufende, produkte, editor: WEG.fulfillment('prozesse', { e: id }) };
}
