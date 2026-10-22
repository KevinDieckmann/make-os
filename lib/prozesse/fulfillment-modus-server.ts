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
  /** Der vorhandene Editor des Fulfillments. */
  editor: string;
  /** E2 (22.10.): der Entwurf der Werkstatt (die ganze Fassung) — null ohne Entwurf; `stand` = Stand der Fassung, an der die Werkstatt arbeitet. */
  entwurf: { vorlage: ProzessVorlage; basisFassung: number; am: string; von: string; paketGeaendert: boolean } | null;
  /** Stand der Fassung, an der die Werkstatt arbeitet (Entwurf, sonst Paket) — der Schreibweg prüft ihn (409). */
  arbeitsStand: string;
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
  const e = d.entwuerfe?.[id] ?? null;
  // Die Bibliothek in Kürze umfasst auch Bausteine, die nur der Entwurf nutzt.
  for (const k of e?.vorlage.knoten ?? []) if (k.bausteinId && !genutzt.has(k.bausteinId)) {
    const b = d.bausteine.find(x => x.id === k.bausteinId);
    if (b) { const kf = fuerKundenFrei(b, d); genutzt.add(b.id); bibliothek.push({ id: b.id, titel: b.titel, art: b.art, kundeFrei: kf.frei, ...(kf.grund ? { grund: kf.grund } : {}) }); }
  }
  return {
    paket: v, stand: eintragStand(v), befunde, bibliothek, laufende, produkte, editor: WEG.fulfillment('prozesse', { e: id }),
    entwurf: e ? { vorlage: e.vorlage, basisFassung: e.basisFassung, am: e.am, von: e.von, paketGeaendert: e.basisStand !== eintragStand(v) } : null,
    arbeitsStand: eintragStand(e?.vorlage ?? v),
  };
}

/** Die ganze Bibliothek in Kürze (Bausteine hinzufügen in der Werkstatt) — Kennung, Titel, Art und die Kunden-Regel. Nur lesen. */
export async function bibliothekKurz(h: string): Promise<BibliothekKurz[]> {
  const [{ fulfillmentLesen }, { fuerKundenFrei }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/bausteine')]);
  const d = await fulfillmentLesen('vorlagen', h);
  return d.bausteine.map(b => { const k = fuerKundenFrei(b, d); return { id: b.id, titel: b.titel, art: b.art, kundeFrei: k.frei, ...(k.grund ? { grund: k.grund } : {}) }; });
}

/** E2: einen Entwurf speichern bzw. verwerfen — über die Schreibstelle des Fulfillments (`fulfillmentAendern`, eine Sperre, Grenzen 413, Protokoll ohne Werte). */
export async function paketEntwurfSchreiben(h: string, person: string, aktion: 'speichern' | 'verwerfen', eingabe: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const [{ fulfillmentAendern, eintragStand }, { paketEntwurfAnwenden, paketEntwurfVerwerfen }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('./fulfillment-entwurf')]);
  let befunde: Befund[] | undefined;
  const r = await fulfillmentAendern('vorlagen', d => {
    const x = aktion === 'verwerfen' ? paketEntwurfVerwerfen(d, eingabe.paketId) : paketEntwurfAnwenden(d, eingabe, { person, jetzt: new Date().toISOString(), standVon: eintragStand });
    if (!x.ok) befunde = x.befunde;
    return x;
  }, { art: 'person', person }, h);
  const paketId = typeof eingabe.paketId === 'string' ? eingabe.paketId : '';
  const ansicht = paketId ? await paketFuerWerkstatt(h, paketId) : null;
  if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler, ...(befunde ? { befunde } : {}), ...(r.status === 409 && ansicht ? { aktuell: ansicht } : {}) } };
  return { status: 200, body: { ok: true, geaendert: r.geaendert, ...(ansicht ?? {}) } };
}
