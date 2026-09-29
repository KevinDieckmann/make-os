// ─── Kalender — Verfügbarkeit einer Person (rein, getestet, 29.09., K1) ─────
// EINE Stelle für „wann ist jemand da?“ (Datenregel KALENDER_VERBINDUNGEN.md 4g): aus
// Abwesend-Terminen, Arbeitsort, der Wochenvorlage (lib/planung/typen.ts `Block`: wann
// Privat, wann Arbeit) und den Feiertagen NRW (lib/zeit/kalender-kern.ts). Genutzt von
// der freien-Zeit-Suche und der Buchungsseite (K4), Heute, Glocke und ZOE (K6).
// Der Server-Lader ist lib/kalender/verfuegbarkeit.ts `verfuegbarkeitFuer(person, von, bis)`.
//
// Welche Termine betreffen die Person? Die aus ihrem Kalender (`wer`), dazu die aus dem
// gemeinsamen Kalender — Abwesend und Arbeitsort dort aber nur, wenn sie sie angelegt hat
// (`von`) oder niemand eingetragen ist. Titel nur, wenn der Termin nicht privat ist.
// Alle Zeiten Berliner Wandzeit; Tage [von, bis).

// Tag, Wandzeit, Wochentag und Feiertage NRW nur aus dem Kalender-Kern (lib/zeit/kalender-kern.ts, K2).
import { tagPlus, minutenVon, wandAus, feiertag, istWochenende, wochentag } from '@/lib/zeit/kalender-kern';
import type { TerminMitBezug } from './bezug';
import type { IcsArt, ArbeitsortArt } from './arten';
import { arbeitsortTitel } from './arten';
import type { Block } from '@/lib/planung/typen';

export interface Zeitraum { start: string; ende: string }
export interface Belegt extends Zeitraum { art: IcsArt; ganztags: boolean }
export interface TagVerfuegbarkeit {
  tag: string;
  /** Gesetzlicher Feiertag in NRW (Name). */
  feiertag?: string;
  wochenende: boolean;
  /** Arbeitsort des Tages (letzter Eintrag gewinnt). */
  arbeitsort?: { art: ArbeitsortArt; titel: string };
  /** Abwesenheiten (ganztägig oder mit Zeit) — Titel nur, wenn nicht privat. */
  abwesend: (Belegt & { titel?: string })[];
  /** Ganzer Tag nicht verfügbar (ganztägig abwesend). */
  ganzAbwesend: boolean;
  /** Soll-Arbeitszeit aus der Wochenvorlage (Blöcke „business“) — an Feiertagen und ganz abwesenden Tagen leer. */
  arbeitszeit: Zeitraum[];
  /** Beschäftigt: alle Termine mit TRANSP:OPAQUE (auch Abwesend, Fokus) — ohne Titel. */
  beschaeftigt: Belegt[];
}
export interface Verfuegbarkeit { person: string; von: string; bis: string; tage: TagVerfuegbarkeit[] }

type T = TerminMitBezug & { wer?: string };

/** Betrifft der Termin die Person? (siehe Kopf) */
export function betrifft(t: T, person: string): boolean {
  if (t.wer === person) return true;
  if (t.wer !== 'beide') return false;
  if (t.art === 'abwesend' || t.art === 'arbeitsort') return !t.von || t.von === person;
  return true;
}

/** Der Teil eines Termins an einem Tag (Wandzeit), ganztägige ganz. */
function amTag(t: T, tag: string): Belegt | null {
  const s = t.start.slice(0, 10), e = t.ende.slice(0, 10);
  if (t.ganztags) return s <= tag && (e > tag || (e === tag && s === tag)) ? { start: `${tag}T00:00:00`, ende: `${tagPlus(tag, 1)}T00:00:00`, art: t.art, ganztags: true } : null;
  if (s > tag || e < tag || (e === tag && minutenVon(t.ende) === 0 && s !== tag)) return null;
  return { start: s < tag ? `${tag}T00:00:00` : t.start, ende: e > tag ? `${tagPlus(tag, 1)}T00:00:00` : t.ende, art: t.art, ganztags: false };
}

const hhmm = (s: string) => { const m = /^(\d{2}):(\d{2})$/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** Verfügbarkeit einer Person in [von, bis) aus Terminen (mit `wer`, Bezug angewandt) und Wochenvorlage. */
export function verfuegbarkeitAus(a: { person: string; von: string; bis: string; termine: readonly T[]; bloecke?: readonly Block[] }): Verfuegbarkeit {
  // Abgesagte (STATUS:CANCELLED) und selbst abgelehnte Einladungen belegen nicht und sind keine Abwesenheit (R-K1 #68);
  // vorläufige (TENTATIVE) zählen wie bestätigte.
  const eigene = a.termine.filter(t => betrifft(t, a.person) && !t.abgesagt);
  const vorlage = (a.bloecke ?? []).filter(b => b.owner === a.person && b.art === 'business');
  const tage: TagVerfuegbarkeit[] = [];
  for (let tag = a.von, n = 0; tag < a.bis && n < 400; tag = tagPlus(tag, 1), n++) {
    const heute = eigene.map(t => ({ t, b: amTag(t, tag) })).filter((x): x is { t: T; b: Belegt } => !!x.b);
    const abwesend = heute.filter(x => x.t.art === 'abwesend').map(x => ({ ...x.b, ...(x.t.sichtbarkeit !== 'privat' && !x.t.maskiert ? { titel: x.t.titel } : {}) }));
    const ganzAbwesend = abwesend.some(x => x.ganztags);
    const ort = heute.filter(x => x.t.art === 'arbeitsort' && x.t.arbeitsort).pop();
    const ft = feiertag(tag);
    const arbeitszeit = ft || ganzAbwesend ? [] : vorlage.filter(b => b.wochentag === wochentag(tag)).flatMap(b => {
      const v = hhmm(b.von), bi = hhmm(b.bis);
      return v !== null && bi !== null && bi > v ? [{ start: wandAus(tag, v), ende: wandAus(tag, bi) }] : [];
    }).sort((x, y) => x.start.localeCompare(y.start));
    tage.push({
      tag, ...(ft ? { feiertag: ft } : {}), wochenende: istWochenende(tag),
      ...(ort ? { arbeitsort: { art: ort.t.arbeitsort!.art, titel: arbeitsortTitel(ort.t.arbeitsort!) } } : {}),
      abwesend, ganzAbwesend, arbeitszeit,
      beschaeftigt: heute.filter(x => x.t.beschaeftigt).map(x => x.b).sort((x, y) => x.start.localeCompare(y.start)),
    });
  }
  return { person: a.person, von: a.von, bis: a.bis, tage };
}

/** Ist die Person in [start, ende) (Wandzeit) frei? Nicht bei Feiertag, ganzer Abwesenheit oder Überschneidung mit „beschäftigt“. */
export function istFrei(v: Verfuegbarkeit, start: string, ende: string): boolean {
  const tag = v.tage.find(t => t.tag === start.slice(0, 10));
  if (!tag || tag.feiertag || tag.ganzAbwesend) return false;
  return !tag.beschaeftigt.some(b => b.start < ende && b.ende > start);
}
