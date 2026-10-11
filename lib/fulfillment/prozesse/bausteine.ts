// ─── Fulfillment · Prozesse — Bausteine der Bibliothek: Marken, Prüfung, Eingabe (C1, 10.10.) ──────────────────────────────────────
// Ein Baustein ist die kleinste wiederverwendbare Einheit (Dokument, Skript, Checkliste, Mail, Kennzahl, Ritual, Formular/Workbook,
// Analyse, Freigabe). Er steckt in beliebig vielen Paket-Vorlagen (Knoten auf Ebene 5 verweisen nur per `bausteinId`).
// Marken (Entscheidung 22:30, 23:20, 00:20):
//   · „vor Einsatz rechtlich prüfen“  → `rechtPruefen` (Ansprache-Texte, § 7 UWG, Provisionen …); geprüft = `rechtGeprueft` (Tag, Person, Notiz)
//   · „vor Verkauf prüfen“            → `urheberPruefen` (gekauftes/fremdes Material); geprüft = Marke `urheber-geprueft:<id>` in `VorlagenDatei.marken`
//   · „nur intern“                    → Schlagwort `nur-intern` (Material der früheren Agentur): NIE in Kunden-Ansicht, Kunden-PDF, Report oder Export
//     an Dritte; `kundeSichtbar` ist dann immer false. Der C0-Typ `Baustein` kennt kein eigenes Feld dafür (der Säuberer behielte es nicht) —
//     deshalb das Schlagwort. JEDER Kunden-Weg (C1 Wirkungsbericht, C2 Ansicht/PDF/Report/Export) fragt NUR `fuerKundenFrei(b, datei)` bzw.
//     `kundenGesperrt(bausteine, datei)` aus dieser Datei.
// Rein und client-sicher.

import type { Baustein, BausteinArt, Frage, VorlagenDatei, Zustaendig } from '../typen';
import { BAUSTEIN_ARTEN, ANALYSE_AGENTEN } from '../lesen';
import { GRENZEN, ID_FREI } from '../grenzen';
import { nein, istObj, pflichtText, optText, optWahl, optBool, textListe } from './pruefen';

export const TAG_NUR_INTERN = 'nur-intern';
export const TAG_VOR_VERKAUF = 'pruefen-vor-verkauf';
/** Messe-/Event-Nachfasstakt (Entscheidung 00:20): Tag 1, 3, 7, 14, 30 nach dem Ereignis — als Einzelschritte in „Nach der Messe“. */
export const MESSE_NACHFASS_TAGE: readonly number[] = [1, 3, 7, 14, 30];
/**
 * Länge eines Gliederungspunkts: die Vorlagen-Dateien tragen ganze Sätze je Punkt (bis rund 600 Zeichen) — die C0-Grenze `TEXT_MAX.gliederungPunkt`
 * (300) hätte jeden vierten Baustein abgelehnt. C1 nimmt deshalb bis 1.000 Zeichen je Punkt (wie Ziel/Ergebnis); darüber 413, nie gekürzt.
 */
export const GLIEDERUNG_PUNKT_MAX = 1000;

export const BAUSTEIN_ART_LABEL: Record<BausteinArt, string> = {
  aufgabe: 'Aufgabe', dokument: 'Dokument', skript: 'Skript', checkliste: 'Checkliste', mail: 'Mail', kennzahl: 'Kennzahl', ritual: 'Ritual',
  formular: 'Formular', workbook: 'Workbook', analyse: 'Analyse', freigabe: 'Freigabe',
};

export const nurIntern = (b: Pick<Baustein, 'tags'>): boolean => b.tags.includes(TAG_NUR_INTERN);
export const markeUrheberGeprueft = (id: string) => `urheber-geprueft:${id}`;
/** Vermerk „Urheberrecht/Verkauf geprüft“ (Tag | Person) — oder null. */
export function urheberGeprueft(d: Pick<VorlagenDatei, 'marken'>, id: string): { am: string; von: string } | null {
  const v = d.marken[markeUrheberGeprueft(id)];
  if (!v) return null;
  const [am, von] = v.split('|');
  return { am: am ?? '', von: von ?? '' };
}
/** Steht noch eine Prüfung „vor Verkauf“ aus (Material Dritter, nicht als geprüft vermerkt)? */
export const vorVerkaufOffen = (b: Pick<Baustein, 'id' | 'urheberPruefen' | 'tags'>, d: Pick<VorlagenDatei, 'marken'>): boolean =>
  (!!b.urheberPruefen || b.tags.includes(TAG_VOR_VERKAUF)) && !urheberGeprueft(d, b.id);
/** Steht noch eine Rechtsprüfung aus? */
export const rechtOffen = (b: Pick<Baustein, 'rechtPruefen' | 'rechtGeprueft'>): boolean => !!b.rechtPruefen && !b.rechtGeprueft;
/**
 * Darf dieser Baustein an Kunden gehen (Kunden-Ansicht, Kunden-PDF, Report, Wirkungsbericht, Antworten-Export)? Die EINE Regel für alle
 * Kunden-Wege (zusammengeführt 11.10. — C2 hatte daneben eigene Felder gelesen, die es im Bestand gar nicht gibt):
 *   · nie, wenn „nur intern“ (Schlagwort `nur-intern`);
 *   · nicht, solange „vor Verkauf prüfen“ (Schlagwort `pruefen-vor-verkauf` bzw. `urheberPruefen`) ohne Vermerk `urheber-geprueft:<id>` ist;
 *   · nicht, solange „vor Einsatz rechtlich prüfen“ (`rechtPruefen`) ohne `rechtGeprueft` ist.
 * Kein Kunden-Weg fragt etwas anderes (Wächter tests/fulfillment-zusammen.test.ts). Intern bleibt alles frei nutzbar.
 */
export function fuerKundenFrei(b: Pick<Baustein, 'id' | 'tags' | 'urheberPruefen' | 'rechtPruefen' | 'rechtGeprueft'>, d: Pick<VorlagenDatei, 'marken'>): { frei: boolean; grund?: string } {
  if (nurIntern(b)) return { frei: false, grund: 'nur intern (Material, das nie an Kunden geht)' };
  if (vorVerkaufOffen(b, d)) return { frei: false, grund: 'Material Dritter — erst nach dem Vermerk „vor Verkauf geprüft“' };
  if (rechtOffen(b)) return { frei: false, grund: 'erst nach dem Vermerk „rechtlich geprüft“' };
  return { frei: true };
}
/** Die Kennungen aller Bausteine, die (noch) nicht an Kunden gehen — für Knoten, die per `bausteinId` auf sie zeigen. */
export function kundenGesperrt(bausteine: readonly Pick<Baustein, 'id' | 'tags' | 'urheberPruefen' | 'rechtPruefen' | 'rechtGeprueft'>[], d: Pick<VorlagenDatei, 'marken'>): Set<string> {
  return new Set(bausteine.filter(b => !fuerKundenFrei(b, d).frei).map(b => b.id));
}

const ZUSTAENDIG: readonly Zustaendig[] = ['intern', 'kunde', 'beide'];
const FRAGE_ARTEN = ['text', 'langtext', 'zahl', 'auswahl', 'ja-nein'] as const;

function fragenAus(v: unknown): Frage[] | undefined {
  if (v === undefined) return undefined;
  if (v === null) return [];
  if (!Array.isArray(v)) return nein('Fragen: Liste erwartet.');
  if (v.length > GRENZEN.fragenJeFormular) return nein(`Fragen: höchstens ${GRENZEN.fragenJeFormular} je Formular (jetzt ${v.length}). Nichts gespeichert.`, 413);
  const ids = new Set<string>();
  return v.map((x, i) => {
    if (!istObj(x)) return nein(`Frage ${i + 1}: Objekt erwartet.`);
    const id = typeof x.id === 'string' && ID_FREI.test(x.id) ? x.id : nein(`Frage ${i + 1}: Kennung fehlt (Buchstaben, Ziffern, Bindestrich).`);
    if (ids.has(id)) nein(`Frage ${i + 1}: Kennung „${id}“ doppelt.`);
    ids.add(id);
    const art = optWahl(x.art, FRAGE_ARTEN, `Frage ${i + 1}: Art`) ?? 'langtext';
    const opt = textListe(x.optionen, 'kurz', `Frage ${i + 1}: Optionen`, 40);
    const f: Frage = { id, frage: pflichtText(x.frage, 'frage', `Frage ${i + 1}`), art };
    const ab = optText(x.abschnitt, 'titel', `Frage ${i + 1}: Abschnitt`); if (ab) f.abschnitt = ab;
    if (opt?.length) f.optionen = opt;
    if (x.pflicht === true) f.pflicht = true;
    const hilfe = optText(x.hilfe, 'kurz', `Frage ${i + 1}: Hilfe`); if (hilfe) f.hilfe = hilfe;
    return f;
  });
}

/** Felder, die im Editor geändert werden dürfen (alles andere setzt der Server). */
export const BAUSTEIN_FELDER = ['art', 'titel', 'zweck', 'warum', 'ergebnis', 'kennzahl', 'hinweis', 'gliederung', 'text', 'platzhalter', 'fragen', 'kundeFuellt', 'wer', 'kundeSichtbar', 'lieferobjekt', 'analyse', 'ritualId', 'tags', 'rechtPruefen', 'urheberPruefen', 'herkunftText', 'nurIntern'] as const;

/**
 * Eine Eingabe aus dem Editor prüfen und auf den alten Baustein legen (oder einen neuen bauen). Texte über den Grenzen → 413, Unsinn → 400.
 * `rechtPruefen`/`urheberPruefen`: `{ grund }` setzt die Marke (seit heute), `null` löst sie. `nurIntern: true|false` setzt/löst das Schlagwort.
 */
export function bausteinAusEingabe(roh: Record<string, unknown>, alt: Baustein | undefined, k: { id: string; heute: string; jetzt: string; person: string }): Baustein {
  for (const key of Object.keys(roh)) if (key !== 'id' && !(BAUSTEIN_FELDER as readonly string[]).includes(key)) nein(`Unbekanntes Feld „${key}“ am Baustein.`);
  const teil: Record<string, unknown> = {};
  const art = optWahl(roh.art, BAUSTEIN_ARTEN, 'Art');
  if (art === null) nein('Die Art eines Bausteins lässt sich nicht leeren.');
  if (art) teil.art = art;
  if (roh.titel !== undefined) teil.titel = pflichtText(roh.titel, 'titel', 'Titel');
  for (const [f, feld] of [['zweck', 'ziel'], ['warum', 'ziel'], ['ergebnis', 'ergebnis'], ['kennzahl', 'kurz'], ['hinweis', 'hinweis'], ['lieferobjekt', 'kurz'], ['herkunftText', 'hinweis']] as const) {
    const t = optText(roh[f], feld, f);
    if (t !== undefined) teil[f] = t;
  }
  if (roh.text !== undefined) {
    if (roh.text === null || roh.text === '') teil.text = null;
    else if (typeof roh.text !== 'string') nein('Text: Text erwartet.');
    else if (roh.text.length > GRENZEN.text) nein(`Text: höchstens ${GRENZEN.text.toLocaleString('de-DE')} Zeichen (jetzt ${roh.text.length.toLocaleString('de-DE')}). Nichts gespeichert.`, 413);
    else teil.text = roh.text;
  }
  const gl = textListe(roh.gliederung, 'ziel', 'Gliederung', GRENZEN.gliederung); if (gl) teil.gliederung = gl;
  const pl = textListe(roh.platzhalter, 'kurz', 'Platzhalter', 60); if (pl) teil.platzhalter = pl;
  const fr = fragenAus(roh.fragen); if (fr !== undefined) teil.fragen = fr.length ? fr : null;
  const kf = optBool(roh.kundeFuellt, 'Kunde füllt aus'); if (kf !== undefined) teil.kundeFuellt = kf || null;
  const wer = optWahl(roh.wer, ZUSTAENDIG, 'Zuständig'); if (wer) teil.wer = wer;
  const ks = optBool(roh.kundeSichtbar, 'Für Kunden sichtbar'); if (ks !== undefined) teil.kundeSichtbar = !!ks;
  const an = optWahl(roh.analyse, ANALYSE_AGENTEN, 'Analyse-Agent'); if (an !== undefined) teil.analyse = an;
  if (roh.ritualId !== undefined) teil.ritualId = roh.ritualId === null || roh.ritualId === '' ? null : typeof roh.ritualId === 'string' && /^fr-[a-z0-9-]{1,100}$/.test(roh.ritualId) ? roh.ritualId : nein('Ritual: unbekannte Kennung.');
  let tags = textListe(roh.tags, 'kurz', 'Schlagworte', 40)?.map(t => t.toLowerCase());
  for (const [f, name] of [['rechtPruefen', 'Rechtsprüfung'], ['urheberPruefen', 'Prüfung vor Verkauf']] as const) {
    const v = roh[f];
    if (v === undefined) continue;
    if (v === null || v === false) { teil[f] = null; continue; }
    const grund = istObj(v) ? optText(v.grund, 'kurz', `${name}: Grund`) : typeof v === 'string' ? optText(v, 'kurz', `${name}: Grund`) : v === true ? 'von Hand markiert' : nein(`${name}: Grund erwartet.`);
    teil[f] = { seit: (alt?.[f] as { seit?: string } | undefined)?.seit ?? k.heute, grund: grund || 'von Hand markiert' };
  }
  const basis: Baustein = alt ?? { id: k.id, art: 'dokument', titel: '', gliederung: [], platzhalter: [], wer: 'intern', kundeSichtbar: false, tags: [], fassung: 0, geaendert: '', geaendertVon: '', herkunft: { art: 'hand', am: k.jetzt } };
  if (roh.nurIntern !== undefined) {
    const an2 = optBool(roh.nurIntern, 'Nur intern');
    const t = new Set(tags ?? basis.tags);
    if (an2) t.add(TAG_NUR_INTERN); else t.delete(TAG_NUR_INTERN);
    tags = [...t];
  }
  if (tags) teil.tags = Array.from(new Set(tags));
  const neu = { ...basis } as Record<string, unknown>;
  for (const [f, v] of Object.entries(teil)) { if (v === null) delete neu[f]; else neu[f] = v; }
  const b = neu as unknown as Baustein;
  if (!b.titel) nein('Titel fehlt.');
  if (nurIntern(b)) b.kundeSichtbar = false;
  if (b.kundeFuellt && b.art !== 'formular' && b.art !== 'workbook') nein('„Kunde füllt aus“ gibt es nur für Formulare und Workbooks.');
  if (b.fragen && b.art !== 'formular' && b.art !== 'workbook') nein('Fragen gibt es nur für Formulare und Workbooks.');
  if (b.analyse && b.art !== 'analyse') nein('Ein Analyse-Agent gehört nur an einen Baustein der Art „Analyse“.');
  return b;
}
