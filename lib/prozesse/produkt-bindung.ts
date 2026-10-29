// ─── Prozesse × Fulfillment — Produkt → Prozess (22.10.; Kevin 21.10.: „dass wir da auch solche Prozesse für unsere Produkte bauen können — das ist
// genauso wichtig“ … „darüber können wir wirklich alle Prozesse sauber anlegen und immer perfekt visualisieren und bearbeiten“) ─────────────────────────
// Fulfillment ist das WERKZEUG, keine eigene Vorlagenwelt: jedes Produkt zeigt auf seinen Ablauf, ein neues Mandat startet ihn. EINE Stelle (rein, client-sicher,
// nur Typ-Importe) für:
//   · den Verweis   `Leistung.prozessId` (Prozess der Werkstatt, `pz-…`) — oder wie bisher eine Paket-Vorlage des Fulfillments (`fulfillment--<h>.zuordnung`).
//                   Die Produktkarte („Ablauf“) wählt genau EINEN Weg (`ablaufVon`, `ablaufWechsel`): Pakete laufen weiter in der Fulfillment-Ausführung
//                   (Fall, bit-gleich wie vorher), Prozesse der Werkstatt im Lauf-Motor. Nie eine Kopie, nur die Kennung.
//   · die Auswahl   `fuerProduktWaehlbar` — Prozesse der Werkstatt mit Fall-Art Mandat in den Bereichen Fulfillment · Übergabe · Ausbau, nicht archiviert.
//   · den Start     `produktStarts` — „Mandat angelegt“ → der Prozess des Hauptprodukts und der Zusatzmodule, die schon dranhängen; „Zusatzmodul gebucht“
//                   → der Prozess dieses Moduls. Gestartet wird NUR im Motor (lib/prozesse/lauf-server.ts `produktLaeufeStarten`): nur, wenn der Prozess läuft
//                   (Probelauf = Schatten, scharf erst nach „scharf schalten“), Fall = das Mandat, ein Lauf je Fall und Prozess, die jüngste Version.
//   · bestehende    `produktMandate` — laufende Mandate, deren Produkt (Haupt oder Zusatz) auf den Prozess zeigt (Frage beim Scharfschalten).
//   · die Sicht     `produkteVonProzess` / `produkteVonVorlage` / `produktZeile` — Landkarte, Steckbrief, Werkstatt („gehört zu Produkt …“).
// Nichts Persönliches: nur Kennungen und die Namen der Produkte aus dem Katalog der Instanz.

import type { Leistung, Mandat } from '@/lib/crm/typen';
import type { Ereignis } from '@/lib/ereignisse/typen';
import type { FallArt, ProzessBereich, ProzessForm, ProzessStatus } from './definition';
import type { ProzessLauf } from './lauf-typen';

/** In welchen Bereichen ein Prozess für ein Produkt stehen darf: dort, wo ein Mandat geliefert wird (Fliege rechts vom Knoten). */
export const PRODUKT_BEREICHE: readonly ProzessBereich[] = ['fulfillment', 'uebergabe', 'ausbau'];

/**
 * Vorbelegung des Namens im Dialog „Prozess für dieses Produkt“ (25.10., Kern-Bau-Test 2: das Feld verlangt „Verb + Gegenstand“, vorbelegt war nur der Produktname):
 * „<Produkt> umsetzen“ — der Produktname wird gekürzt, nie das Verb (`max` = Grenze des Namens).
 */
export function produktProzessTitel(produkt: string, max: number): string {
  const verb = ' umsetzen';
  const name = produkt.trim().slice(0, Math.max(0, max - verb.length)).trim();
  return name ? `${name}${verb}` : '';
}

/** Darf dieser Prozess der Werkstatt einem Produkt zugeordnet werden? (Fall-Art Mandat, passender Bereich, nicht archiviert.) */
export function fuerProduktWaehlbar(p: { quelle: 'werkstatt' | 'fulfillment'; fallArt: FallArt; bereich: ProzessBereich; status: ProzessStatus | null }): boolean {
  return p.quelle === 'werkstatt' && p.fallArt === 'mandat' && PRODUKT_BEREICHE.includes(p.bereich) && p.status !== 'archiviert';
}

type Katalog = readonly (Pick<Leistung, 'id' | 'prozessId'> & { geloeschtAm?: string })[];
type MandatTeil = Pick<Mandat, 'id' | 'leistungId' | 'zusatz' | 'status'> & { geloeschtAm?: string };

/** Der Prozess, auf den ein Produkt zeigt (nicht im Papierkorb) — sonst undefined. */
export const prozessDesProdukts = (katalog: Katalog, leistungId: string | undefined): string | undefined =>
  leistungId ? katalog.find(l => l.id === leistungId && !l.geloeschtAm)?.prozessId : undefined;

/** Ein Start, den ein Ereignis über die Bindung eines Produkts auslöst. */
export interface ProduktStart { prozessId: string; leistungId: string; rolle: 'haupt' | 'zusatz' }

/**
 * Welche Prozesse ein Ereignis über die Produkt-Bindung startet (rein): „Mandat angelegt“ → Hauptprodukt, dann die Zusatzmodule am Mandat; „Zusatzmodul gebucht“
 * → das Produkt des Moduls, solange es am Mandat hängt und das Mandat nicht beendet ist. Ein Prozess höchstens einmal (Haupt vor Zusatz). Alles andere: nichts.
 */
export function produktStarts(e: Pick<Ereignis, 'art' | 'bezug'>, crm: { mandate: readonly MandatTeil[]; leistungen: Katalog }): ProduktStart[] {
  if (e.art !== 'mandat-angelegt' && e.art !== 'zusatz-gebucht') return [];
  const m = e.bezug.mandatId ? crm.mandate.find(x => x.id === e.bezug.mandatId) : undefined;
  if (!m || m.geloeschtAm) return [];
  const raus: ProduktStart[] = [];
  const dazu = (leistungId: string | undefined, rolle: ProduktStart['rolle']) => {
    const p = prozessDesProdukts(crm.leistungen, leistungId);
    if (p && leistungId && !raus.some(r => r.prozessId === p)) raus.push({ prozessId: p, leistungId, rolle });
  };
  if (e.art === 'mandat-angelegt') {
    dazu(m.leistungId, 'haupt');
    for (const z of m.zusatz ?? []) dazu(z.leistungId, 'zusatz');
  } else if (m.status !== 'beendet' && e.bezug.leistungId && (m.zusatz ?? []).some(z => z.leistungId === e.bezug.leistungId)) {
    dazu(e.bezug.leistungId, 'zusatz');
  }
  return raus;
}

/**
 * Darf ein Prozess für ein Mandat der Privat-Arbeits-Einheit laufen (25.10., Fulfillment für die Selbstständigkeit)? Ereignisse solcher Mandate sind Arbeit, kein
 * privater Lebensbereich — aber NICHT jeder Business-Prozess hört darauf: nur ein Prozess, auf den das Produkt des Mandats zeigt (Haupt oder Zusatzmodul, wie
 * `produktStarts`), oder ein Begleit-Prozess, der am Fall andockt (`begleit`, lib/prozesse/begleitung/andocken.ts `istBegleitProzess`). Rein.
 */
export function arbeitErlaubtFuer(prozessId: string, mandatId: string | undefined, crm: { mandate: readonly MandatTeil[]; leistungen: Katalog }, begleit: boolean): boolean {
  if (!mandatId) return false;
  if (begleit) return crm.mandate.some(m => m.id === mandatId && !m.geloeschtAm);
  return produktStarts({ art: 'mandat-angelegt', bezug: { mandatId } }, crm).some(x => x.prozessId === prozessId);
}

/** Laufende Mandate (Status „aktiv“), deren Hauptprodukt oder ein Zusatzmodul auf diesen Prozess zeigt — die „bestehenden Fälle“ beim Scharfschalten. */
export function produktMandate<M extends MandatTeil>(prozessId: string, crm: { mandate: readonly M[]; leistungen: Katalog }): { mandat: M; leistungId: string; rolle: ProduktStart['rolle'] }[] {
  const raus: { mandat: M; leistungId: string; rolle: ProduktStart['rolle'] }[] = [];
  for (const m of crm.mandate) {
    if (m.geloeschtAm || m.status !== 'aktiv') continue;
    const s = produktStarts({ art: 'mandat-angelegt', bezug: { mandatId: m.id } }, { mandate: [m], leistungen: crm.leistungen }).find(x => x.prozessId === prozessId);
    if (s) raus.push({ mandat: m, leistungId: s.leistungId, rolle: s.rolle });
  }
  return raus;
}

/**
 * Mandate, deren Ablauf ein Prozess der Werkstatt IST (Kevin 22.10.: „Dort ausblenden“ — im Fulfillment kein Kandidat „noch kein Fall“ mehr, nichts doppelt): es gibt
 * einen SCHARFEN Lauf (auch fertig — nur nicht abgebrochen) mit Fall = dieses Mandat des Prozesses, auf den das HAUPTprodukt des Mandats zeigt.
 * 29.10. (Kreislauf, F-B1): ein Probelauf/Schatten zählt NICHT mehr — er legt keine Akte an, das Mandat bliebe sonst ohne Fall und ohne Vorschlag „Fall starten“.
 * Zusatzmodule zählen nicht (ihr Prozess ersetzt den Ablauf des Hauptprodukts nicht); ohne Lauf (Entwurf, noch nicht gestartet) bleibt das Mandat Kandidat. Rein.
 */
export function mandateMitProduktLauf(laeufe: readonly (Pick<ProzessLauf, 'prozessId' | 'fall' | 'status'> & Partial<Pick<ProzessLauf, 'modus'>>)[], crm: { mandate: readonly Pick<Mandat, 'id' | 'leistungId'>[]; leistungen: Katalog }): Set<string> {
  const raus = new Set<string>();
  if (!laeufe.length) return raus;
  const haupt = new Map(crm.mandate.map(m => [m.id, prozessDesProdukts(crm.leistungen, m.leistungId)] as const));
  for (const l of laeufe) {
    if (l.status === 'abgebrochen' || l.modus === 'schatten' || l.fall.art !== 'mandat' || !l.fall.id) continue;
    if (haupt.get(l.fall.id) === l.prozessId) raus.add(l.fall.id);
  }
  return raus;
}

// ── Sicht: welche Produkte gehören zu einem Prozess ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ProduktVerweis { id: string; name: string }
type KatalogMitName = readonly (Pick<Leistung, 'id' | 'name' | 'prozessId'> & { geloeschtAm?: string })[];

/** Produkte, die auf einen Prozess der Werkstatt zeigen (ohne Papierkorb), in der Reihenfolge des Katalogs. */
export const produkteVonProzess = (katalog: KatalogMitName, prozessId: string): ProduktVerweis[] =>
  katalog.filter(l => !l.geloeschtAm && l.prozessId === prozessId).map(l => ({ id: l.id, name: l.name }));

/** Produkte, denen eine Paket-Vorlage des Fulfillments zugeordnet ist (`zuordnung`) — ohne Papierkorb. */
export const produkteVonVorlage = (katalog: KatalogMitName, zuordnung: Readonly<Record<string, { vorlageId: string }>>, vorlageId: string): ProduktVerweis[] =>
  katalog.filter(l => !l.geloeschtAm && zuordnung[l.id]?.vorlageId === vorlageId).map(l => ({ id: l.id, name: l.name }));

const gleich = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');
/**
 * Die Zeile „für Produkt …“ an einer Kachel — nur, wenn sie etwas sagt, was der Titel nicht schon sagt (jede Information nur einmal: ein Prozess, der wie sein
 * Produkt heißt, braucht die Zeile nicht). Mehrere Produkte: das erste und die Zahl der übrigen.
 */
export function produktZeile(titel: string, produkte: readonly ProduktVerweis[]): string | null {
  if (!produkte.length) return null;
  if (produkte.length === 1) return gleich(produkte[0].name, titel) ? null : `für ${produkte[0].name}`;
  return `für ${produkte[0].name} und ${produkte.length - 1} weitere`;
}

// ── Die Wahl auf der Produktkarte: genau EIN Ablauf ─────────────────────────────────────────────────────────────────────────────────────────────

/** Was ein Produkt heute als Ablauf hat: ein Prozess der Werkstatt (gewinnt, er startet im Motor) oder ein Paket des Fulfillments — sonst nichts. */
export type AblaufWahl = { art: 'prozess'; id: string } | { art: 'paket'; id: string } | null;
const IST_PROZESS = /^pz-/;
export function ablaufVon(l: Pick<Leistung, 'id' | 'prozessId'>, zuordnung: Readonly<Record<string, { vorlageId: string }>> | null | undefined): AblaufWahl {
  if (l.prozessId) return { art: 'prozess', id: l.prozessId };
  const v = zuordnung?.[l.id]?.vorlageId;
  return v ? { art: 'paket', id: v } : null;
}
/** Ein Schritt beim Wechsel: den Verweis am Produkt setzen bzw. lösen, oder die Paket-Zuordnung des Fulfillments. */
export type AblaufSchritt = { art: 'produkt'; prozessId: string | null } | { art: 'zuordnung'; vorlageId: string | null };
/**
 * Die Schritte, um von der heutigen Wahl zu `neu` zu kommen (Kennung `pz-…` = Prozess der Werkstatt, sonst ein Paket; `null` = ohne Ablauf): ERST das Neue setzen,
 * DANN das Alte lösen — scheitert der zweite Schritt, fehlt nie ein Ablauf. Unveränderte Teile bleiben unberührt (kein Schreiben ohne Änderung).
 */
export function ablaufWechsel(l: Pick<Leistung, 'id' | 'prozessId'>, zuordnung: Readonly<Record<string, { vorlageId: string }>> | null | undefined, neu: string | null): AblaufSchritt[] {
  const paket = zuordnung?.[l.id]?.vorlageId ?? null;
  const raus: AblaufSchritt[] = [];
  if (neu && IST_PROZESS.test(neu)) {
    if (l.prozessId !== neu) raus.push({ art: 'produkt', prozessId: neu });
    if (paket) raus.push({ art: 'zuordnung', vorlageId: null });
  } else if (neu) {
    if (paket !== neu) raus.push({ art: 'zuordnung', vorlageId: neu });
    if (l.prozessId) raus.push({ art: 'produkt', prozessId: null });
  } else {
    if (l.prozessId) raus.push({ art: 'produkt', prozessId: null });
    if (paket) raus.push({ art: 'zuordnung', vorlageId: null });
  }
  return raus;
}

// ── Kunden-Sicht: welche Knoten eines Prozesses der Kunde überhaupt sehen darf (Schalter „Dem Kunden zeigen“; Etappen: lib/prozesse/kunden-etappen.ts) ──

/** Formen, die ein Kunde sehen darf (alles andere bleibt intern, auch wenn es markiert wäre). */
export const KUNDEN_FORMEN: readonly ProzessForm[] = ['schritt', 'nachricht', 'termin'];
export const kundenFormErlaubt = (form: ProzessForm | undefined): boolean => KUNDEN_FORMEN.includes(form ?? 'schritt');
