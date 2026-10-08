// ─── Arbeitsrahmen je Person — Business-freie Zeiten (rein, client-sicher, 08.10., Lücke 7) ─────────────────────────
// Kevin (ROADMAP_Q4 › Lücken, 08.10.): „Business-freie Zeiten wirken nicht → ein Arbeitsrahmen je Person; Business-frei sperrt
// Kalender, Kapazität, ZOE, Heads und Glocke.“ Fragebogen Teil 3: „Business-freie Zeiten durchsetzen.“
//
// EINE Regel für alle Stellen, die fragen „ist diese Person gerade (oder dann) Business-frei?“:
//   Grundlage  die gemeinsamen Zeiten der Familie (Familie › Rahmen, `Einstellungen.businessFrei` im Bestand
//              `familie--<haushalt>`) — sie gelten für jedes volle Mitglied des Haushalts.
//   Ergänzung  optional je Person (`arbeitsrahmen--<person>`) — sie kann NUR einschränken (mehr Business-freie Zeit),
//              nie eine gemeinsame Zeit aufheben: der Rahmen ist die Vereinigung beider Listen.
// Ein Fenster = Wochentage (0 = Sonntag … 6 = Samstag, wie in der Familie) + „von“/„bis“ in Berliner Wandzeit.
//   · „bis“ 23:59 (so speichert die Familie „bis Mitternacht“) und 24:00 heißen: bis zum Ende des Tages.
//   · „bis“ vor „von“ (z. B. 22:00–06:00) läuft über Mitternacht in den Folgetag — der Wochentag ist der des Beginns.
//   · „von“ = „bis“ heißt 24 Stunden ab „von“ (00:00–00:00 = der ganze Tag).
// Gerechnet wird in Berliner Wandzeit („YYYY-MM-DDTHH:mm:ss“, lib/zeit/kalender-kern.ts) — die Zeitumstellung ändert nichts an
// einem Fenster (22:00–06:00 bleibt 22:00–06:00, in der Nacht der doppelten Stunde dauert es eine Stunde länger). Die Zeichenketten
// sind gleich lang und vergleichen sich daher wie Zeiten. Alle anderen Stellen (Kalender, Kapazität, ZOE, Heads, Glocke) lesen NUR
// hierüber — der Server-Lader ist lib/arbeitsrahmen/server.ts.

import { tagPlus, wandAus, wochentag as isoWochentag } from '@/lib/zeit/kalender-kern';

/** Ein Business-freies Zeitfenster (wie `Einstellungen.businessFrei` der Familie). */
export interface BusinessFreiFenster { tage: number[]; von: string; bis: string }
/** Eine Spanne in Berliner Wandzeit, Ende exklusiv. */
export interface Spanne { start: string; ende: string }
/** Der Rahmen einer Person: gemeinsame Zeiten der Familie + eigene Ergänzung. */
export interface Rahmen { familie: readonly BusinessFreiFenster[]; eigene: readonly BusinessFreiFenster[] }

/** Höchstens so viele eigene Fenster je Person (wie die Familie: 10) — mehr → 413, nie gekürzt. */
export const EIGENE_MAX = 10;
/** Weiter als so viele Tage rechnet niemand Fenster aus (Kapazität: 53 Wochen + Puffer). */
export const TAGE_MAX = 400;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minuten = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
/** „bis“ in Minuten: 23:59 und 24:00 = Ende des Tages. */
const endeMinuten = (bis: string) => (bis === '24:00' || bis === '23:59' ? 1440 : minuten(bis));

/** Wochentag eines Berliner Tags wie in der Familie: 0 = Sonntag … 6 = Samstag. */
export const wochentagSo0 = (tag: string): number => isoWochentag(tag) % 7;

/** Ein gültiges Fenster? (Tage 0–6, mindestens einer, „HH:MM“; „bis“ darf 24:00 sein.) */
function gueltig(f: unknown): f is BusinessFreiFenster {
  if (!f || typeof f !== 'object') return false;
  const x = f as Partial<BusinessFreiFenster>;
  return Array.isArray(x.tage) && x.tage.length > 0 && x.tage.every(t => Number.isInteger(t) && t >= 0 && t <= 6)
    && typeof x.von === 'string' && HHMM.test(x.von) && typeof x.bis === 'string' && (HHMM.test(x.bis) || x.bis === '24:00');
}

/** Tolerant lesen (Bestand der Familie, alte Stände): Unbrauchbares fällt weg, Tage werden Zahlen. */
export function fensterLesen(roh: unknown): BusinessFreiFenster[] {
  if (!Array.isArray(roh)) return [];
  const raus: BusinessFreiFenster[] = [];
  for (const f of roh) {
    const o = f as { tage?: unknown; von?: unknown; bis?: unknown } | null;
    if (!o || typeof o !== 'object') continue;
    const k = { tage: Array.isArray(o.tage) ? Array.from(new Set(o.tage.map(Number))).sort((a, b) => a - b) : [], von: String(o.von ?? ''), bis: String(o.bis ?? '') };
    if (gueltig(k)) raus.push(k);
  }
  return raus;
}

/** Streng prüfen (Schreibweg der eigenen Ergänzung): ein ungültiges Fenster → Satz (400), zu viele → 413. Nie kürzen. */
export function fensterPruefen(roh: unknown): { ok: true; fenster: BusinessFreiFenster[] } | { ok: false; status: 400 | 413; fehler: string } {
  if (!Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Zeitfenster fehlen (Liste erwartet).' };
  if (roh.length > EIGENE_MAX) return { ok: false, status: 413, fehler: `Höchstens ${EIGENE_MAX} eigene Zeitfenster — nichts gespeichert.` };
  const fenster: BusinessFreiFenster[] = [];
  for (const [i, f] of roh.entries()) {
    const o = f as { tage?: unknown; von?: unknown; bis?: unknown } | null;
    const k = { tage: Array.isArray(o?.tage) ? Array.from(new Set((o!.tage as unknown[]).map(Number))).sort((a, b) => a - b) : [], von: String(o?.von ?? ''), bis: String(o?.bis ?? '') };
    if (!gueltig(k)) return { ok: false, status: 400, fehler: `Zeitfenster ${i + 1}: mindestens ein Wochentag und Uhrzeiten „HH:MM“ — nichts gespeichert.` };
    fenster.push(k);
  }
  return { ok: true, fenster };
}

/** Spannen sortieren und Überlappendes/Angrenzendes zusammenlegen. */
export function vereinigen(l: readonly Spanne[]): Spanne[] {
  const s = l.filter(x => x.ende > x.start).map(x => ({ ...x })).sort((a, b) => a.start.localeCompare(b.start));
  const raus: Spanne[] = [];
  for (const x of s) {
    const letzte = raus[raus.length - 1];
    if (letzte && x.start <= letzte.ende) { if (x.ende > letzte.ende) letzte.ende = x.ende; }
    else raus.push(x);
  }
  return raus;
}

/** Fensterliste eines Rahmens (Familie + eigene) — dieselbe Liste für jede Stelle. */
const alleFenster = (r: Rahmen | readonly BusinessFreiFenster[]): readonly BusinessFreiFenster[] =>
  (Array.isArray(r) ? r : [...(r as Rahmen).familie, ...(r as Rahmen).eigene]) as readonly BusinessFreiFenster[];

/**
 * Die Business-freien Spannen im Zeitraum [von, bis) (Berliner Tage) — vereinigt, sortiert und auf den Zeitraum geschnitten.
 * Ein Fenster des Vortags, das über Mitternacht läuft, zählt mit.
 */
export function businessFreiFenster(r: Rahmen | readonly BusinessFreiFenster[], von: string, bis: string): Spanne[] {
  const fenster = alleFenster(r);
  if (!fenster.length || !(bis > von)) return [];
  const anfang = `${von}T00:00:00`, schluss = `${bis}T00:00:00`;
  const roh: Spanne[] = [];
  for (let tag = tagPlus(von, -1), n = 0; tag < bis && n <= TAGE_MAX; tag = tagPlus(tag, 1), n++) {
    const wt = wochentagSo0(tag);
    for (const f of fenster) {
      if (!f.tage.includes(wt)) continue;
      const s = minuten(f.von), e = endeMinuten(f.bis);
      const start = wandAus(tag, s), ende = wandAus(tag, e > s ? e : e + 1440);
      const a = start > anfang ? start : anfang, b = ende < schluss ? ende : schluss;
      if (b > a) roh.push({ start: a, ende: b });
    }
  }
  return vereinigen(roh);
}

/** Liegt der Zeitpunkt (Berliner Wandzeit) in einer der Spannen? */
export const istBusinessFrei = (spannen: readonly Spanne[], wand: string): boolean => spannen.some(s => s.start <= wand && wand < s.ende);

/** Bis wann (Wandzeit, exklusiv) ist die Person ab `wand` Business-frei — oder null. Angrenzende Spannen zählen zusammen. */
export function freiBis(spannen: readonly Spanne[], wand: string): string | null {
  const v = vereinigen(spannen);
  const s = v.find(x => x.start <= wand && wand < x.ende);
  return s ? s.ende : null;
}

/** Überschneidet [start, ende) eine der Spannen? */
export const ueberlappt = (spannen: readonly Spanne[], start: string, ende: string): boolean => spannen.some(s => s.start < ende && s.ende > start);

/** Spannen `weg` aus `l` herausnehmen (z. B. Business-freie Zeit aus der Arbeitszeit der Wochenvorlage). */
export function abziehen(l: readonly Spanne[], weg: readonly Spanne[]): Spanne[] {
  let rest = l.map(x => ({ start: x.start, ende: x.ende }));
  for (const w of weg) {
    const neu: Spanne[] = [];
    for (const x of rest) {
      if (w.ende <= x.start || w.start >= x.ende) { neu.push(x); continue; }
      if (w.start > x.start) neu.push({ start: x.start, ende: w.start });
      if (w.ende < x.ende) neu.push({ start: w.ende, ende: x.ende });
    }
    rest = neu;
  }
  return rest;
}

/** Der Teil der Spannen an einem Berliner Tag (geschnitten auf 00:00 … 24:00). */
export function amTag(spannen: readonly Spanne[], tag: string): Spanne[] {
  const a = `${tag}T00:00:00`, b = `${tagPlus(tag, 1)}T00:00:00`;
  return spannen.flatMap(s => { const start = s.start > a ? s.start : a, ende = s.ende < b ? s.ende : b; return ende > start ? [{ start, ende }] : []; });
}

const WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/**
 * „bis 23:59“ bzw. „bis Mo 06:00“ — das Ende einer Spanne für die Anzeige (Heute, Kopf). Ein Ende um Mitternacht heißt
 * „23:59“ des Tages davor (so tragen Kevin und Malin „bis Mitternacht“ ein). `heute` = Berliner Tag.
 */
export function bisText(ende: string, heute: string): string {
  let tag = ende.slice(0, 10), uhr = ende.slice(11, 16);
  if (uhr === '00:00') { tag = tagPlus(tag, -1); uhr = '23:59'; }
  return tag === heute ? `bis ${uhr}` : tag === tagPlus(heute, 1) ? `bis morgen ${uhr}` : `bis ${WT_KURZ[wochentagSo0(tag)]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}. ${uhr}`;
}

// ── Was ist „Business“? — eine Regel für Termine, Blöcke und Meldungen ────────────────────────────────────────────────

/** Block-Unterarten aus „Planen“, die keine Arbeit sind (Reha, Routine, Pause) — alles andere (Fokus, Aufgabe, eigener Block) ist Arbeit. */
const KEINE_ARBEIT = new Set(['reha', 'routine', 'pause']);
/** Ist ein Block Arbeit? `art` wie im Kalender (fokus | block), `blockArt` die Unterart aus „Planen“. */
export const istArbeitsBlock = (art: string, blockArt?: string | null): boolean => art === 'fokus' || (art === 'block' && !KEINE_ARBEIT.has(String(blockArt ?? '')));

/**
 * Ist ein neuer Termin ein Business-Termin? Bereich Business (Kalenderseite) oder ein Business-Kalender (Google bzw.
 * Kalender-Einstellungen › Space) — Abwesend und Arbeitsort nie (sie sind keine Arbeit, sondern sagen, wo/ob jemand da ist).
 */
export function terminIstBusiness(t: { art: string; bereich?: string | null; kalenderBusiness: boolean }): boolean {
  if (t.art === 'abwesend' || t.art === 'arbeitsort') return false;
  return t.bereich === 'business' || t.kalenderBusiness;
}

/**
 * ZOE-Werkzeug-Gruppen, die Business sind (lib/zoe/register.ts): Markttraktion/CRM, Kontakte der Kartei, Kunden, Business-Index,
 * Firmen-Finanzen. Im Hintergrund (Takt, Läufe) legt ZOE in einer Business-freien Zeit damit nichts an (lib/zoe/ausfuehren.ts).
 * Privates („haushalt“, „gesundheit“, „aufgaben“ …) bleibt frei.
 */
export const ZOE_BUSINESS_GRUPPEN: ReadonlySet<string> = new Set(['markttraktion', 'kontakte', 'kunden', 'business', 'finanzen']);
/** Der Satz für ZOE, wenn ein Hintergrundlauf in der freien Zeit etwas Business-mäßiges anlegen wollte. */
export const ZOE_ZURUECKGEHALTEN = 'ZURÜCKGEHALTEN — gerade Business-freie Zeit: Business-Vorschläge legt ZOE erst danach an. Nichts gespeichert, nichts im Stapel.';

/**
 * Neutraler Hinweis im ZOE-Gespräch (lib … app/api/kimmi): ZOE stößt keine Business-Themen an und plant keine Arbeit hinein;
 * fragt die Person selbst, hilft ZOE ganz normal. Keine Familieninhalte, kein Grund — nur „gerade“ und „bis wann“ (`bisText`).
 */
export function businessFreiSatz(name: string, bis: string): string {
  return `GERADE BUSINESS-FREI (${bis}): Für ${name} ist jetzt Business-freie Zeit. Stoß von dir aus keine Business-Themen an (Markttraktion, Deals, Firmen-Finanzen, Arbeitsaufgaben), schlage keine Arbeit in dieser Zeit vor und lege keine Business-Vorschläge an. Fragt ${name} selbst nach etwas Geschäftlichem, hilf ganz normal.`;
}

/** Der Satz der Rückfrage — ohne Zeiten, ohne Namen (gilt auch für Konten, die nur „ja/nein“ erfahren). */
export const BUSINESS_FREI_FRAGE = 'Business-frei — trotzdem?';
export const BUSINESS_FREI_HINWEIS = 'Dieser Termin liegt in einer Business-freien Zeit. Trotzdem anlegen?';
/** Der Text der 409-Antwort — auch für Wege ohne eigene Rückfrage verständlich (Planen, Analyse-Vorschläge). */
export const BUSINESS_FREI_FEHLER = 'Business-frei — trotzdem? Der Termin liegt in einer Business-freien Zeit; über „Erstellen“ lässt er sich nach einer Rückfrage anlegen.';
