// ─── Zeit & Fokus — Zeit je Business-Einheit (27.09. spät, rein, getestet) ──
// Kevin: „Fokus-Blöcke einer Aufgabe zuordnen, damit wir die Zeit je Einheit
// sehen (Selbstständigkeit · KD Ventures · MAKE Innovation GmbH).“
//
// Hier liegt beides, was dafür gerechnet wird — ohne Dateizugriff:
//   1. die Säuberung einer Zuordnung im Schreibweg (`zuordnungSaeubern`):
//      nur im Business, Aufgabe muss eine Business-Aufgabe sein, Namen über
//      `einheitName`/`sauberEinheit` (lib/einheiten.ts, lib/planung/einheiten.ts),
//      die Einheit der Aufgabe gewinnt vor einer direkt gesetzten;
//   2. die Auswertung (`zeitJeEinheit`): Woche (Mo–So) oder Monat, Tage nach
//      Berliner Wandzeit (nie nach der Zone der Maschine), je Person und gesamt,
//      Stunden je Kerneinheit · eigene · ohne Einheit, dazu die Top-Aufgaben.
// Gezählt werden nur bewusste Blöcke der ARBEIT — die automatische Zeit kennt
// keine Aufgabe. Arbeit (05.10. abends, Kevin: „Die Selbstständigkeit zählt WEITER
// als Arbeit“) = jeder Business-Block und ein Privat-Block, dessen Einheit (live aus
// Aufgabe/Mandat, sonst am Block) eine Privat-Arbeits-Einheit ist (lib/einheiten.ts
// `privatArbeitsEinheit`, unsere Instanz: die Selbstständigkeit). Arbeit ≠ Bereich:
// die Zeile der Selbstständigkeit steht als Privat-Einheit da, nie als Business. Die Einheit eines Blocks kommt LIVE aus seiner Aufgabe (wird
// die Einheit der Aufgabe später gesetzt, zählt sie rückwirkend); der am Block
// gespeicherte Wert ist Rückfall (Aufgabe gelöscht) bzw. die direkte Wahl.

import { ARBEIT_EINHEITEN_NAMEN, KERN_EINHEITEN, bereichVon, einheitName, privatArbeitsEinheit, type Bereich } from '@/lib/einheiten';
import { sauberEinheit } from '@/lib/planung/einheiten';
import { aufgabeEinheit, EINHEIT_OHNE } from '@/lib/aufgaben/einheit';
import { spaceVonAufgabe, type SpaceId } from '@/lib/make-one/space-regeln';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { bezugSaeubern, mitMandatBezug, type MandatKurz } from '@/lib/planung/mandat';
import { teile, type BlockZuordnung, type FokusBlock, type ZeitDatei } from './modell';
import { kalenderwoche } from '@/lib/zeit/kalender-kern';

/** Das, was die Auswertung und die Säuberung von einer Aufgabe brauchen. */
export interface AufgabeKurz {
  id: string; titel: string; einheit?: string; business: boolean; offen: boolean;
  /**
   * Zählt Zeit auf diese Aufgabe als Arbeit (05.10. abends)? Business-Aufgaben immer; Privat-Aufgaben, wenn ihr Space oder ihre Einheit eine
   * Privat-Arbeits-Einheit ist (unsere Instanz: der Space der Selbstständigkeit). Fehlt (Altaufrufer) = wie `business`.
   */
  arbeit?: boolean;
  /** Mandat der Aufgabe (`Task.bezug.mandatId`, 28.09. abends) — ein Fokus-Block auf die Aufgabe übernimmt es. */
  mandatId?: string;
}

type AufgabeRoh = { id: string; title: string; description?: string; projectId: string; space?: SpaceId; spaceId?: string; einheit?: unknown; status?: string; bezug?: { mandatId?: string } };

/** Aus einer gespeicherten Aufgabe (types/tasks.ts) die Kurzform — Space und Einheit über dieselben Regeln wie der Aufgaben-Schreibweg. */
export function aufgabeKurz(t: AufgabeRoh, orgZuordnung: Record<string, string> = {}): AufgabeKurz {
  const business = spaceVonAufgabe(t, orgZuordnung) === 'business';
  // Aufgaben im Space einer Privat-Arbeits-Einheit (Selbstständigkeit) ohne eigene Einheit zählen für diese Einheit (05.10. abends).
  const spaceEinheit = privatArbeitsEinheit(t.spaceId);
  const einheit = aufgabeEinheit(t, orgZuordnung) ?? (spaceEinheit ? KERN_EINHEITEN.find(e => e.id === spaceEinheit)?.label : undefined);
  return {
    id: t.id,
    titel: String(t.title ?? '').slice(0, 120),
    einheit,
    business,
    arbeit: business || !!spaceEinheit || !!privatArbeitsEinheit(einheit),
    offen: t.status !== 'done',
    ...(typeof t.bezug?.mandatId === 'string' && t.bezug.mandatId ? { mandatId: t.bezug.mandatId } : {}),
  };
}

export const AUFGABE_ID_MAX = 80;

/**
 * Die Zuordnung eines Blocks, wie sie gespeichert wird:
 * - Privat (und Gemeinsam) verwirft alles — Einheiten und Mandate gibt es nur im Business.
 * - `aufgabeId` bleibt nur, wenn die Aufgabe gefunden wurde und im Business liegt.
 * - Einheit: die der Aufgabe, sonst die direkt gewählte (auch bei einer Aufgabe ohne Einheit), vereinheitlicht.
 * - Mandat (28.09., „Mandat an Zielen und Zeit“): trägt die Aufgabe ein Mandat (`bezug.mandatId`), übernimmt der Block
 *   es (28.09. abends). `mandatId`/`firmaId` nur in der Form geprüft; ist das Mandat
 *   bekannt (`mandate`), kommen Firma und Einheit aus dem Mandat — das Mandat ist das Konkreteste und gewinnt
 *   vor der Einheit der Aufgabe (wie `einheitAusBezug`: Mandat → Deal → Produkt).
 */
export function zuordnungSaeubern(
  schluessel: string,
  roh: { aufgabeId?: unknown; einheit?: unknown; mandatId?: unknown; firmaId?: unknown },
  aufgabe?: AufgabeKurz | null,
  mandate?: ReadonlyMap<string, MandatKurz> | null,
): BlockZuordnung {
  if (teile(schluessel).space !== 'business') return arbeitImPrivat(roh, aufgabe, mandate);
  const id = typeof roh.aufgabeId === 'string' ? roh.aufgabeId.trim() : '';
  const mitAufgabe = !!id && id.length <= AUFGABE_ID_MAX && !!aufgabe && aufgabe.id === id && aufgabe.business;
  const einheit = (mitAufgabe ? sauberEinheit(aufgabe!.einheit) : null) ?? sauberEinheit(roh.einheit) ?? undefined;
  // Mandat der Aufgabe (28.09. abends): ein Block auf eine Aufgabe mit Mandat übernimmt es (wie die Einheit der Aufgabe gewinnt).
  const bezugRoh = mitAufgabe && aufgabe!.mandatId ? { ...roh, mandatId: aufgabe!.mandatId } : roh;
  const z: BlockZuordnung = { ...(mitAufgabe ? { aufgabeId: id } : {}), ...(einheit ? { einheit } : {}), ...bezugSaeubern(bezugRoh, true) };
  return mitMandatBezug(z, mandate, true);
}

/**
 * Privat- (und Gemeinsam-)Blöcke (05.10. abends): eine Zuordnung bleibt nur, wenn sie zu einer Privat-Arbeits-Einheit führt (unsere Instanz:
 * eine Aufgabe im Space der Selbstständigkeit, die Einheit „Selbstständigkeit“ oder ein Mandat der Selbstständigkeit) — dann zählt der Block als
 * Arbeit unter Privat. Alles andere verwirft der Schreibweg wie bisher (Business-Arbeit: „ins Business“ umbuchen).
 */
function arbeitImPrivat(
  roh: { aufgabeId?: unknown; einheit?: unknown; mandatId?: unknown; firmaId?: unknown },
  aufgabe?: AufgabeKurz | null,
  mandate?: ReadonlyMap<string, MandatKurz> | null,
): BlockZuordnung {
  const id = typeof roh.aufgabeId === 'string' ? roh.aufgabeId.trim() : '';
  const mitAufgabe = !!id && id.length <= AUFGABE_ID_MAX && !!aufgabe && aufgabe.id === id && !aufgabe.business && !!aufgabe.arbeit;
  const einheit = (mitAufgabe ? sauberEinheit(aufgabe!.einheit) : null) ?? sauberEinheit(roh.einheit) ?? undefined;
  const bezugRoh = mitAufgabe && aufgabe!.mandatId ? { ...roh, mandatId: aufgabe!.mandatId } : roh;
  const z = mitMandatBezug({ ...(mitAufgabe ? { aufgabeId: id } : {}), ...(einheit ? { einheit } : {}), ...bezugSaeubern(bezugRoh, true) } as BlockZuordnung, mandate, true);
  return privatArbeitsEinheit(z.einheit) ? z : {};
}

/**
 * Die Einheit eines Blocks. Mit Mandat (am Block oder an seiner Aufgabe): die Einheit des Mandats LIVE (Mandat → Deal →
 * Produkt, `einheitAusBezug` in `mandatKurzListe`) — so zählt ein Block auch dann richtig, wenn die Gesellschaft des Mandats
 * erst nach dem Block gesetzt wurde (Sichtprüfung 29.09.: „ohne Einheit“ trotz Mandat); sonst die am Block gespeicherte
 * (sie kam beim Speichern aus dem Mandat). Ohne Mandat: die der Aufgabe (live), sonst die am Block gespeicherte.
 */
export function einheitVonBlock(b: Pick<FokusBlock, 'aufgabeId' | 'einheit' | 'mandatId'>, aufgaben: ReadonlyMap<string, AufgabeKurz>, mandate?: ReadonlyMap<string, Pick<MandatKurz, 'einheit'>> | null): string | undefined {
  const a = b.aufgabeId ? aufgaben.get(b.aufgabeId) : undefined;
  const mandatId = b.mandatId ?? a?.mandatId;
  if (mandatId) {
    const live = einheitName(mandate?.get(mandatId)?.einheit);
    if (live) return live;
    if (b.mandatId && einheitName(b.einheit)) return einheitName(b.einheit);
  }
  return einheitName(a?.einheit) ?? einheitName(b.einheit);
}

/** Tragen Blöcke oder Aufgaben ein Mandat? Dann lohnt es, die Mandate (CRM) für die Auswertung zu laden. */
export function brauchtMandate(dateien: readonly ZeitDatei[], aufgaben: readonly AufgabeKurz[]): boolean {
  return aufgaben.some(a => !!a.mandatId) || dateien.some(d => Object.values(d.tage ?? {}).some(t => (t.bloecke ?? []).some(b => !!b.mandatId)));
}

// ── Zeitraum (Berliner Wandzeit) ────────────────────────────────────────────

export type Zeitraum = 'woche' | 'monat';
export const ZEITRAUM_LABEL: Record<Zeitraum, string> = { woche: 'Woche', monat: 'Monat' };

/** Der Berliner Kalendertag eines Zeitpunkts. */
export const berlinTag = (iso: string): string => wandzeit(new Date(iso)).slice(0, 10);

const wochentagIndex = (tag: string) => (new Date(`${tag}T12:00:00Z`).getUTCDay() + 6) % 7; // Mo = 0

/** ISO-Kalenderwoche eines Tages — aus dem Kalender-Kern (29.09., K2: eine Stelle). */
export { kalenderwoche };

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Woche Mo–So bzw. Kalendermonat um einen Stichtag (YYYY-MM-DD), beide Enden eingeschlossen. */
export function zeitraumVon(zeitraum: Zeitraum, stichtag: string): { von: string; bis: string; label: string } {
  if (zeitraum === 'monat') {
    const [j, m] = stichtag.split('-').map(Number);
    const von = `${j}-${String(m).padStart(2, '0')}-01`;
    const naechster = m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`;
    return { von, bis: tagPlus(naechster, -1), label: `${MONATE[m - 1]} ${j}` };
  }
  const von = tagPlus(stichtag, -wochentagIndex(stichtag));
  return { von, bis: tagPlus(von, 6), label: `KW ${kalenderwoche(von)}` };
}

// ── Auswertung ──────────────────────────────────────────────────────────────

export interface AufgabeZeit { id: string; titel: string; sek: number }
export interface EinheitZeile {
  /** Einheiten-Name — oder EINHEIT_OHNE. */
  id: string;
  label: string;
  art: 'kern' | 'eigen' | 'ohne';
  /** Bereich der Einheit (05.10. abends): `privat` für eine Privat-Arbeits-Einheit (Selbstständigkeit) — Anzeige „Privat · …“, nie Business. */
  bereich: Bereich;
  sek: number;
  bloecke: number;
  /** Die Aufgaben mit der meisten Zeit, höchstens TOP_AUFGABEN. */
  aufgaben: AufgabeZeit[];
  /** Zeit in Blöcken ohne Aufgabe (nur Einheit oder gar nichts). */
  ohneAufgabeSek: number;
}
export interface EinheitAuswertung { sek: number; bloecke: number; zeilen: EinheitZeile[] }
export interface PersonAuswertung { person: string; name: string; auswertung: EinheitAuswertung }
export interface ZeitJeEinheit { zeitraum: Zeitraum; von: string; bis: string; label: string; personen: PersonAuswertung[]; gesamt: EinheitAuswertung }

export const TOP_AUFGABEN = 3;
const norm = (s: string) => s.toLocaleLowerCase('de-DE');

/** Wer entscheidet, ob ein Block Arbeit ist — `arbeitsPruefer`; ohne Angabe nur Business-Blöcke (wie bis 05.10.). */
export type ArbeitsPruefer = (b: FokusBlock) => boolean;
export const nurBusinessBloecke: ArbeitsPruefer = b => teile(b.schluessel).space === 'business';

/**
 * Ist ein Block Arbeit (05.10. abends)? Business-Blöcke immer; Privat-/Gemeinsam-Blöcke, wenn ihre Einheit — live aus Aufgabe bzw. Mandat,
 * sonst die am Block — eine Privat-Arbeits-Einheit ist (unsere Instanz: die Selbstständigkeit). Aufgaben/Mandate dürfen fehlen.
 */
export function arbeitsPruefer(aufgaben?: ReadonlyMap<string, AufgabeKurz> | null, mandate?: ReadonlyMap<string, Pick<MandatKurz, 'einheit'>> | null): ArbeitsPruefer {
  const karte = aufgaben ?? new Map<string, AufgabeKurz>();
  return b => nurBusinessBloecke(b) || !!privatArbeitsEinheit(einheitVonBlock(b, karte, mandate));
}

/** Bereich einer Einheiten-Zeile (Anzeige „Privat · …“): eine feste Einheit nach ihrem Bereich, sonst Business. */
export const bereichVonEinheit = (name: string): Bereich => {
  const g = KERN_EINHEITEN.find(e => norm(e.label) === norm(name))?.id;
  return g ? bereichVon(g) : 'business';
};

/**
 * Die Arbeits-Blöcke einer Datei, deren Anfang (Berlin) im Zeitraum liegt. Ohne Prüfer nur die Business-Blöcke (wie bisher); mit
 * `arbeitsPruefer(…)` auch die Arbeit unter Privat (Selbstständigkeit).
 */
export function bloeckeImZeitraum(d: ZeitDatei, von: string, bis: string, istArbeit: ArbeitsPruefer = nurBusinessBloecke): FokusBlock[] {
  // Die Tages-Schlüssel der Datei folgen der Zone des Servers — deshalb einen Tag Puffer und dann nach Berlin filtern.
  const vorher = tagPlus(von, -1), nachher = tagPlus(bis, 1);
  const aus: FokusBlock[] = [];
  for (const [tag, t] of Object.entries(d.tage ?? {})) {
    if (tag < vorher || tag > nachher) continue;
    for (const b of t.bloecke ?? []) {
      if (!(b.sek > 0) || !istArbeit(b)) continue;
      const bt = berlinTag(b.von);
      if (bt >= von && bt <= bis) aus.push(b);
    }
  }
  return aus;
}

/**
 * Blöcke → Zeilen: die Arbeits-Einheiten immer (`ARBEIT_EINHEITEN_NAMEN` — unsere Instanz alle drei; die Selbstständigkeit mit `bereich:
 * 'privat'`, 05.10. abends: sie zählt WEITER als Arbeit, steht aber unter Privat, nie als Business-Einheit), eigene nur mit Zeit (nach Zeit),
 * „ohne Einheit“ immer zuletzt.
 */
export function auswerten(bloecke: readonly FokusBlock[], aufgaben: ReadonlyMap<string, AufgabeKurz>, mandate?: ReadonlyMap<string, Pick<MandatKurz, 'einheit'>> | null): EinheitAuswertung {
  const topf = new Map<string, { label: string; sek: number; bloecke: number; aufgaben: Map<string, number>; ohneAufgabeSek: number }>();
  const holen = (id: string, label: string) => {
    let t = topf.get(id);
    if (!t) { t = { label, sek: 0, bloecke: 0, aufgaben: new Map(), ohneAufgabeSek: 0 }; topf.set(id, t); }
    return t;
  };
  for (const n of ARBEIT_EINHEITEN_NAMEN) holen(norm(n), n);
  holen(EINHEIT_OHNE, 'ohne Einheit');
  let sek = 0;
  for (const b of bloecke) {
    const e = einheitVonBlock(b, aufgaben, mandate);
    const t = e ? holen(norm(e), e) : holen(EINHEIT_OHNE, 'ohne Einheit');
    t.sek += b.sek; t.bloecke += 1; sek += b.sek;
    if (b.aufgabeId) t.aufgaben.set(b.aufgabeId, (t.aufgaben.get(b.aufgabeId) ?? 0) + b.sek);
    else t.ohneAufgabeSek += b.sek;
  }
  const kern = new Set(ARBEIT_EINHEITEN_NAMEN.map(norm));
  const zeile = (id: string, art: EinheitZeile['art']): EinheitZeile => {
    const t = topf.get(id)!;
    const top = [...t.aufgaben.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_AUFGABEN)
      .map(([aid, s]) => ({ id: aid, titel: aufgaben.get(aid)?.titel || 'Aufgabe (gelöscht)', sek: s }));
    return { id: art === 'ohne' ? EINHEIT_OHNE : t.label, label: t.label, art, bereich: art === 'ohne' ? 'business' : bereichVonEinheit(t.label), sek: t.sek, bloecke: t.bloecke, aufgaben: top, ohneAufgabeSek: t.ohneAufgabeSek };
  };
  const eigene = [...topf.keys()].filter(k => k !== EINHEIT_OHNE && !kern.has(k) && topf.get(k)!.sek > 0)
    .sort((a, b) => topf.get(b)!.sek - topf.get(a)!.sek || a.localeCompare(b));
  return {
    sek, bloecke: bloecke.length,
    zeilen: [...ARBEIT_EINHEITEN_NAMEN.map(n => zeile(norm(n), 'kern')), ...eigene.map(k => zeile(k, 'eigen')), zeile(EINHEIT_OHNE, 'ohne')],
  };
}

/**
 * Die ganze Auswertung: je Person und gesamt (alle übergebenen Personen zusammen). `nurBusiness` (05.10. abends): für Konten ohne
 * Privatzugang (`finanzRecht: 'business'`) nur die Business-Blöcke — die Arbeit der Selbstständigkeit gehört zum Privat-Bereich und geht an
 * sie nie hinaus (serverseitig, die Route entscheidet aus dem Konto).
 */
export function zeitJeEinheit(
  personen: readonly { person: string; name: string; datei: ZeitDatei }[],
  aufgaben: readonly AufgabeKurz[],
  zeitraum: Zeitraum,
  stichtag: string,
  mandate?: ReadonlyMap<string, Pick<MandatKurz, 'einheit'>> | null,
  nurBusiness = false,
): ZeitJeEinheit {
  const { von, bis, label } = zeitraumVon(zeitraum, stichtag);
  const karte = new Map(aufgaben.map(a => [a.id, a]));
  const alle: FokusBlock[] = [];
  const istArbeit = nurBusiness ? nurBusinessBloecke : arbeitsPruefer(karte, mandate);
  const jePerson = personen.map(p => {
    const b = bloeckeImZeitraum(p.datei, von, bis, istArbeit);
    alle.push(...b);
    return { person: p.person, name: p.name, auswertung: auswerten(b, karte, mandate) };
  });
  return { zeitraum, von, bis, label, personen: jePerson, gesamt: auswerten(alle, karte, mandate) };
}
