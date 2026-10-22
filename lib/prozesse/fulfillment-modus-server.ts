// ─── Prozesse × Fulfillment — ein Paket für die Werkstatt lesen (Server, 22.10., Etappe 1 „Öffnen & Rundweg“; Plan research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──
// NUR lesen — schreibt nie, legt nichts an: das Paket aus dem Bestand `fulfillment--<h>` (EINE Wahrheit, keine Kopie), sein Stand (Fingerabdruck der ganzen Vorlage —
// derselbe wie der Fulfillment-Editor), die Befunde des Fulfillment-Modus und der Struktur (`vorlageStrukturPruefen` — dieselbe Regel wie jede Änderung am Paket),
// die Bausteine, auf die das Paket zeigt, mit der EINEN Kunden-Regel (`fuerKundenFrei`), die Zahl der laufenden Kunden (nur Mandate einer Business-Gesellschaft
// — dieselbe Grenze wie überall im Fulfillment) und die Produkte, denen das Paket zugeordnet ist (nur Kennung und Name). Keine Personen, keine Inhalte der Fälle.

import type { Befund, ProzessVorlage } from './definition';
import { fulfillmentModusBefunde, type BibliothekKurz } from './fulfillment-modus';
import type { ProduktVerweis } from './produkt-bindung';

export interface LaufenderKunde { mandatId: string; kunde: string; titel: string; art: 'paket' | 'zusatz'; fassung: number; aenderung: { titel: string; zeilen: string[] }[] | null }

export interface PaketFuerWerkstatt {
  paket: ProzessVorlage;
  /** Stand der ganzen Vorlage (wie der Fulfillment-Editor) — Etappe 2 schreibt nur mit diesem Stand (409). */
  stand: string;
  befunde: Befund[];
  bibliothek: BibliothekKurz[];
  /** Laufende Fälle (nicht abgeschlossen) von Business-Mandaten, die dieses Paket bzw. Zusatzmodul nutzen — die Zahl. */
  laufende: number;
  /**
   * E3 (22.10., F2 „je Kunde übernehmen“): diese Fälle mit dem, was sich für sie ändern würde (`vorlagenDiff`/`zusatzDiff` → `diffVorschau` — dieselbe Vorschau wie im
   * Fall); `aenderung` null = der Fall hat schon die aktuelle Fassung. Nur Mandate von Business-Gesellschaften; die Route schreibt das Lese-Protokoll.
   */
  kunden: LaufenderKunde[];
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
  let kunden: LaufenderKunde[] = []; let produkte: ProduktVerweis[] = [];
  try {
    const [faelle, crm, { vorlagenDiff, zusatzDiff, diffVorschau }] = await Promise.all([fulfillmentLesen('faelle', h), (await import('@/lib/crm/speicher')).ladeCrm(), import('@/lib/fulfillment/prozesse/fall')]);
    const mandate = new Map(crm.mandate.filter(m => !m.geloeschtAm && istBusinessMandat(m.gesellschaft)).map(m => [m.id, m] as const));
    for (const f of Object.values(faelle.faelle)) {
      const m = mandate.get(f.mandatId);
      if (!m || f.status === 'abgeschlossen') continue;
      const z = f.zusaetze?.find(x => x.vorlageId === id);
      if (f.vorlageId !== id && !z) continue;
      const diff = f.vorlageId === id ? vorlagenDiff(f, v) : zusatzDiff(f, v);
      kunden.push({ mandatId: m.id, kunde: m.kunde, titel: m.titel, art: f.vorlageId === id ? 'paket' : 'zusatz', fassung: f.vorlageId === id ? f.vorlageFassung : z!.vorlageFassung, aenderung: diff ? diffVorschau(diff) : null });
    }
    kunden = kunden.sort((a, b) => a.kunde.localeCompare(b.kunde, 'de'));
    produkte = produkteVonVorlage(crm.leistungen, d.zuordnung, id);
  } catch { /* ohne Zahl */ }
  const laufende = kunden.length;
  const e = d.entwuerfe?.[id] ?? null;
  // Die Bibliothek in Kürze umfasst auch Bausteine, die nur der Entwurf nutzt.
  for (const k of e?.vorlage.knoten ?? []) if (k.bausteinId && !genutzt.has(k.bausteinId)) {
    const b = d.bausteine.find(x => x.id === k.bausteinId);
    if (b) { const kf = fuerKundenFrei(b, d); genutzt.add(b.id); bibliothek.push({ id: b.id, titel: b.titel, art: b.art, kundeFrei: kf.frei, ...(kf.grund ? { grund: kf.grund } : {}) }); }
  }
  return {
    paket: v, stand: eintragStand(v), befunde, bibliothek, laufende, kunden, produkte, editor: WEG.fulfillment('prozesse', { e: id }),
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

/**
 * E2/E3: einen Entwurf speichern, verwerfen bzw. veröffentlichen — über die Schreibstelle des Fulfillments (`fulfillmentAendern`, eine Sperre, Grenzen 413, Protokoll
 * ohne Werte). Veröffentlichen ändert KEINEN Fall: die Antwort trägt die laufenden Kunden mit ihrer Änderung (übernommen wird je Kunde per Klick, F2).
 */
export async function paketEntwurfSchreiben(h: string, person: string, aktion: 'speichern' | 'verwerfen' | 'veroeffentlichen', eingabe: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const [{ fulfillmentAendern, eintragStand }, { paketEntwurfAnwenden, paketEntwurfVerwerfen, paketVeroeffentlichen }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('./fulfillment-entwurf')]);
  let befunde: Befund[] | undefined; let paketGeaendert = false; let fassung: number | undefined;
  const k = { person, jetzt: new Date().toISOString(), standVon: eintragStand };
  const r = await fulfillmentAendern('vorlagen', d => {
    const x = aktion === 'verwerfen' ? paketEntwurfVerwerfen(d, eingabe.paketId) : aktion === 'veroeffentlichen' ? paketVeroeffentlichen(d, eingabe, k) : paketEntwurfAnwenden(d, eingabe, k);
    if (!x.ok) { befunde = x.befunde; paketGeaendert = !!x.paketGeaendert; } else fassung = x.fassung;
    return x;
  }, { art: 'person', person }, h);
  const paketId = typeof eingabe.paketId === 'string' ? eingabe.paketId : '';
  const ansicht = paketId ? await paketFuerWerkstatt(h, paketId) : null;
  if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler, ...(befunde ? { befunde } : {}), ...(paketGeaendert ? { paketGeaendert: true } : {}), ...(r.status === 409 && ansicht ? { aktuell: ansicht } : {}) } };
  return { status: 200, body: { ok: true, geaendert: r.geaendert, ...(fassung ? { veroeffentlicht: fassung } : {}), ...(ansicht ?? {}) } };
}
