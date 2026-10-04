// ─── Lichtfäden · Abweichungen — wann ein Strang ausschlagen darf (04.10.2026 abends, rein) ─
// Kevin (04.10.): „Es darf nur ausgeschlagen werden, wenn etwas Unvorhergesehenes kommt oder etwas schiefgelaufen ist. Ziel
// ist, dass alle Linien immer ruhig laufen — nach Ziel, Plan und Meilenstein.“
//
// Eine ABWEICHUNG ist ein echtes Ereignis gegen den Plan — mit Ort im Baum (Pfad wie am Strang), Person, Zeitraum und einer
// Stärke 0 … 1. Der Strahl (lib/lichtfaeden/strahl.ts) schlägt NUR hier aus; ohne Abweichung liegt jeder Strang glatt auf
// seiner Spur. Keine Zufallswerte, kein Rauschen: gleiche Daten = gleiche Abweichungen (Wächter tests/strahl-ruhig.test.ts).
//
// Quellen heute (aus den Strängen der Lichtfäden, also schon mit Personen-/Privat-Regel — anonyme „Belegt“-Stränge der
// anderen Person tragen nie eine Abweichung):
//   · Meilenstein überfällig        — offener Meilenstein, dessen Tag vor heute liegt              (Art `ueberfaellig`)
//   · Ziel gekippt                  — offenes Ziel, dessen Frist vor heute liegt                   (Art `ziel-gekippt`)
//   · Frist gerissen                — offene Steuerfrist / Projekt-Ende / gestellte Rechnung vorbei (Art `frist-gerissen`)
// Angedockt werden kann jede weitere reine Quelle über `AbweichungsQuelle` (z. B. das Kapazitäts-Paket: Woche „überlastet“,
// UMBAU_ABEND_0410.md › 7) — ein Lader in `LADER` (lib/lichtfaeden/abweichung-quellen-server.ts), sonst nichts. Angedockt ist
// schon `verschoben` für Deals (Entscheidung ≥ 2× verschoben, `dealsVerschoben`). Ohne Datengrundlage: `verschoben` für
// Meilensteine (sie speichern keinen ursprünglichen Termin) und `ungeplant` (kein Bestand kennt es) — die Arten sind da.

import { BEIDE, GESAMT, type Strang, type StrangQuelle } from './modell';

export type AbweichungArt = 'ueberfaellig' | 'verschoben' | 'frist-gerissen' | 'ziel-gekippt' | 'ueberlastet' | 'ungeplant';

export interface Abweichung {
  /** Eindeutig je Quelle, z. B. `ueberfaellig:ms:m-4`. */
  id: string;
  art: AbweichungArt;
  /** Wo im Baum (wie `Strang.pfad`: gesamt → space → thema → ziel → meilenstein) — bestimmt, welcher Strang ausschlägt. */
  pfad: readonly string[];
  /** Speichername der Person oder BEIDE — dieselbe Personen-Sicht wie die Stränge (`passtZuPerson`). */
  person: string;
  /** Seit wann die Abweichung besteht (z. B. der gerissene Termin) und bis wann sie gilt (Standard: heute). */
  von: string;
  bis?: string;
  /** Größe 0 … 1 am Ende (`bis`) — rechnet `abweichungsStaerke`, nie geschätzt. */
  staerke: number;
  /** Wächst die Abweichung von `von` bis `bis` an (überfällig: jeden Tag ein wenig mehr) oder gilt sie gleich stark (Kapazität)? */
  verlauf: 'anstieg' | 'gleich';
  /** Für Vorleser und die Zeile unter dem Band — bei privaten Dingen der anderen Person nur „Belegt“ (`abweichungFuerBetrachter`). */
  titel: string;
  /** Der Strang, an dem sie hängt (Blatt-Ebene: genau dieser Faden schlägt aus); fehlt bei Quellen ohne Strang. */
  strang?: string;
  /** Privat: Titel, Strang und Ort unter dem Space nur für die eigene Person (wie `Strang.privat`). */
  privat?: boolean;
}

/** Die Regeln — EINE Stelle. */
export const ABWEICHUNG = {
  /** Nach so vielen Tagen schlägt eine Abweichung halb aus (weiche Sättigung: 1 Tag kaum, 2 Wochen halb, 2 Monate fast voll). */
  halbTage: 14,
  /** Nach `bis` klingt der Ausschlag in so vielen Tagen aus — der Strang kehrt in seine Spur zurück. */
  ausklingenTage: 14,
  /** Was als Abweichung zählt, wenn es offen und vorbei ist: Art und Gewicht (1 = voller Ausschlag möglich). */
  quellen: {
    meilenstein: { art: 'ueberfaellig', gewicht: 1 },
    ziel: { art: 'ziel-gekippt', gewicht: 1 },
    frist: { art: 'frist-gerissen', gewicht: 1 },
    projekt: { art: 'frist-gerissen', gewicht: 0.6 },
    rechnung: { art: 'frist-gerissen', gewicht: 0.5 },
  } as Partial<Record<StrangQuelle, { art: AbweichungArt; gewicht: number }>>,
} as const;

const TAG_MS = 864e5;
const ms = (t: string) => Date.parse(`${t.slice(0, 10)}T12:00:00Z`);
const tage = (von: string, bis: string) => Math.round((ms(bis) - ms(von)) / TAG_MS);
const tagPlus = (t: string, n: number) => new Date(ms(t) + n * TAG_MS).toISOString().slice(0, 10);
const ist01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Stärke einer Abweichung aus ihrer Dauer in Tagen (weich gesättigt, `halbTage` → 0,5) mal Gewicht. 0 Tage = 0. */
export function abweichungsStaerke(tageDauer: number, gewicht = 1): number {
  if (!(tageDauer > 0)) return 0;
  return Math.round(ist01(gewicht) * (1 - Math.pow(2, -tageDauer / ABWEICHUNG.halbTage)) * 1000) / 1000;
}

/** Abweichungen aus den Strängen: offene Meilensteine, Ziel-Fristen, Fristen, Projekt-Enden, Rechnungen, deren Tag vorbei ist. */
export function abweichungenAusStraengen(straenge: readonly Strang[], heute: string): Abweichung[] {
  const aus: Abweichung[] = [];
  for (const s of straenge) {
    const regel = ABWEICHUNG.quellen[s.quelle];
    if (!regel || s.status === 'erledigt' || !(s.zeit.tag < heute)) continue;
    const staerke = abweichungsStaerke(tage(s.zeit.tag, heute), regel.gewicht);
    if (!(staerke > 0)) continue;
    aus.push({ id: `${regel.art}:${s.id}`, art: regel.art, pfad: s.pfad, person: s.person, von: s.zeit.tag, bis: heute, staerke, verlauf: 'anstieg', titel: s.titel, strang: s.id, ...(s.privat ? { privat: true } : {}) });
  }
  return aus;
}

/** Der Kontext, den eine angedockte Quelle bekommt (rein, nur lesen). */
export interface AbweichungsKontext { heute: string; von: string; bis: string; straenge: readonly Strang[] }
/**
 * Schnittstelle für weitere Abweichungs-Quellen (z. B. Kapazität „überlastet“): eine REINE Funktion, die aus dem Kontext
 * (und ihren eigenen, vorher geladenen Daten) Abweichungen macht. Sie kennt die Personen-Regel selbst: private Last der
 * anderen Person darf nur ohne Titel und nur bis zum Space (`[GESAMT, 'space:…']`) erscheinen.
 */
export type AbweichungsQuelle = (k: AbweichungsKontext) => readonly Abweichung[];

/** Ist eine Abweichung gültig (Pfad ab GESAMT, Tage ok, Stärke 0 … 1)? Ungültige fallen still weg. */
export function abweichungGueltig(a: Abweichung): boolean {
  const tagOk = (t: unknown) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) && Number.isFinite(ms(t));
  return !!a.id && a.pfad[0] === GESAMT && a.pfad.length >= 2 && tagOk(a.von) && (a.bis == null || (tagOk(a.bis) && a.bis >= a.von))
    && a.staerke > 0 && a.staerke <= 1 && typeof a.person === 'string' && !!a.person;
}

/**
 * Die Privat-Regel für Abweichungen (wie `fuerBetrachter` am Strang): Eine private Abweichung der ANDEREN Person bleibt als
 * Ausschlag sichtbar (die Last zählt), aber ohne Titel, ohne Strang und nur bis zum Space — dort, wo auch ihr „Belegt“ liegt.
 */
export function abweichungFuerBetrachter(a: Abweichung, betrachter: string): Abweichung {
  if (!a.privat || a.person === BEIDE || a.person === betrachter) return a;
  return { id: `belegt:${a.art}:${a.von}:${a.person}:${Math.round(a.staerke * 100)}`, art: a.art, pfad: a.pfad.slice(0, 2), person: a.person, von: a.von, ...(a.bis ? { bis: a.bis } : {}), staerke: a.staerke, verlauf: a.verlauf, titel: 'Belegt', privat: true };
}

/**
 * Alle Abweichungen für einen Betrachter: die aus den Strängen (die die Route schon mit `fuerBetrachter` gefiltert hat) + die
 * der angedockten Quellen, je mit der Privat-Regel. Gekapselt: eine fehlerhafte Quelle fehlt einfach.
 */
export function abweichungenSammeln(k: AbweichungsKontext, betrachter: string, quellen: readonly AbweichungsQuelle[] = []): Abweichung[] {
  const aus = abweichungenAusStraengen(k.straenge, k.heute);
  for (const q of quellen) {
    try { for (const a of q(k)) if (abweichungGueltig(a)) aus.push(abweichungFuerBetrachter(a, betrachter)); } catch { /* fehlt einfach */ }
  }
  const gesehen = new Set<string>();
  return aus.filter(a => (gesehen.has(a.id) ? false : (gesehen.add(a.id), true)));
}

/**
 * Ausschlag je Woche 0 … 1 für eine Menge Abweichungen auf einem Wochenraster (`wochen` = Montage, älteste zuerst):
 *   · `anstieg`: in jeder Woche von `von` bis `bis` die Stärke, die die Abweichung am Ende dieser Woche hatte (wächst an);
 *   · `gleich`: in jeder berührten Woche die volle Stärke;
 *   · nach `bis` klingt sie linear über `ausklingenTage` aus.
 * Mehrere Abweichungen in einer Woche: 1 − Π(1 − v) — mehr Abweichungen = mehr Ausschlag, aber nie über 1.
 */
export function ausschlagJeWoche(abw: readonly Abweichung[], wochen: readonly string[]): number[] {
  const rest = wochen.map(() => 1);
  for (const a of abw) {
    if (!abweichungGueltig(a)) continue;
    const bis = a.bis ?? a.von;
    const dauer = Math.max(1, tage(a.von, bis));
    const voll = abweichungsStaerke(dauer, 1);
    wochen.forEach((w, i) => {
      const ende = tagPlus(w, 6);
      if (ende < a.von) return;
      let v: number;
      if (w <= bis) {
        // in der Woche, in der die Abweichung besteht
        v = a.verlauf === 'gleich' ? a.staerke : a.staerke * (voll > 0 ? abweichungsStaerke(Math.max(0, tage(a.von, ende < bis ? ende : bis)), 1) / voll : 1);
      } else {
        // danach klingt sie aus (gemessen ab dem Montag der Woche nach `bis`)
        const nach = tage(bis, w);
        v = a.staerke * Math.max(0, 1 - nach / ABWEICHUNG.ausklingenTage);
      }
      if (v > 0) rest[i] *= 1 - ist01(v);
    });
  }
  return rest.map(r => Math.round((1 - r) * 1000) / 1000);
}

/** Ein Satz für Vorleser: „Abweichung: Stammtisch Herbst überfällig seit 17.09.“ (nur eigene/gemeinsame — Belegt hat keine). */
export function abweichungText(a: Pick<Abweichung, 'art' | 'titel' | 'von'>): string {
  const d = `${a.von.slice(8, 10)}.${a.von.slice(5, 7)}.`;
  const wort: Record<AbweichungArt, string> = {
    ueberfaellig: `überfällig seit ${d}`, verschoben: `verschoben (ursprünglich ${d})`, 'frist-gerissen': `Frist gerissen am ${d}`,
    'ziel-gekippt': `Ziel-Frist überschritten seit ${d}`, ueberlastet: `überlastet ab ${d}`, ungeplant: `ungeplant am ${d}`,
  };
  return `${a.titel} ${wort[a.art]}`;
}

// ── Angedockte Quellen (rein) ────────────────────────────────────────────────

/** Was die Quelle „verschobene Entscheidung“ von einem Deal braucht (lib/crm/pipeline.ts `erwartetVerschiebung` führt die Felder). */
export interface DealVerschiebung { id: string; titel: string; erwartetAm?: string; erwartetUrsprung?: string; erwartetVerschoben?: number }

/**
 * Quelle `verschoben`: ein offener Deal, dessen Entscheidung mindestens `ab`-mal verschoben wurde (dieselbe Schwelle wie die
 * gelbe Deal-Ampel, `VERSCHOBEN_GELB`). Ort = der Pfad seines Strangs (`deal:<id>`, nur offene Deals haben einen); Stärke aus
 * den Tagen zwischen ursprünglichem und heutigem Termin (Gewicht 0,6). Liegt der ursprüngliche Termin hinter uns, wächst die
 * Abweichung von dort bis heute an, sonst gilt sie diese Woche.
 */
export function dealsVerschoben(deals: readonly DealVerschiebung[], ab: number): AbweichungsQuelle {
  return k => {
    const pfadVon = new Map(k.straenge.filter(s => s.quelle === 'deal').map(s => [s.id, s]));
    const aus: Abweichung[] = [];
    for (const d of deals) {
      const s = pfadVon.get(`deal:${d.id}`);
      if (!s || (d.erwartetVerschoben ?? 0) < ab || !d.erwartetUrsprung || !d.erwartetAm) continue;
      const staerke = abweichungsStaerke(Math.abs(tage(d.erwartetUrsprung.slice(0, 10), d.erwartetAm.slice(0, 10))), 0.6);
      if (!(staerke > 0)) continue;
      const vorbei = d.erwartetUrsprung.slice(0, 10) < k.heute;
      aus.push({
        id: `verschoben:${s.id}`, art: 'verschoben', pfad: s.pfad, person: s.person, von: vorbei ? d.erwartetUrsprung.slice(0, 10) : k.heute, bis: k.heute,
        staerke, verlauf: vorbei ? 'anstieg' : 'gleich', titel: d.titel, strang: s.id,
      });
    }
    return aus;
  };
}
