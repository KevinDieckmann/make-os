// ─── Lichtfäden-Quelle: Kalender-Termine (iCloud + Google, schon für die Person maskiert) — rein ─
// Eingang sind die Termine aus `termineFuerZoe(person, …)` (lib/kalender/zoe-sicht-server.ts): private und Gesundheits-
// Termine der ANDEREN Person kommen dort schon als „Belegt“ (`maskiert`). Hier gilt dieselbe Regel noch einmal über
// `privat` + Person — der Baum macht daraus ein anonymes „belegt“-Gewicht (modell.ts `fuerBetrachter`).
// Zuordnung: Space aus dem Kalender (Einstellungen, vom Server mitgegeben). Thema: Gesundheits-Termin → Gesundheit;
// Business mit Mandats-Bezug → Mandate, mit Kontakt-/CRM-Bezug → Markttraktion; sonst „Ziele & Planung“.
// Nicht gezählt: Fokus-Blöcke und Planen-Blöcke (sie SIND die geplante Arbeit an Aufgaben — sonst doppelt), Arbeitsort,
// abgesagte Termine. Abwesend zählt als langer Termin (er bindet die ganze Zeit).

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { WEG } from '@/lib/wege';
import { BEIDE, gewichtVon, tagAus, themaPfad, type Strang, type ThemaId } from '../modell';

export interface KalenderTermin {
  id: string; titel: string; start: string; ende?: string; ganztags?: boolean; art?: string; sichtbarkeit?: string;
  /** Wem der Kalender gehört (Person oder BEIDE). */
  wer?: string;
  /** Vom Server aus dem Kalender bestimmt. */
  space: SpaceId;
  /** Vom Server erkannt (lib/kalender/zoe-sicht.ts `istGesundheitsTermin`). */
  gesundheit?: boolean;
  maskiert?: boolean;
  abgesagt?: boolean;
  /** Kein Ziel für einen Link (z. B. Microsoft-365-Spiegel: Kennung ist nur die Position in der Liste, nicht stabil). */
  ohneLink?: boolean;
  bezug?: { mandatId?: string; kontaktId?: string; firmaId?: string; dealId?: string; eventId?: string };
}
export interface KalenderDaten { termine: KalenderTermin[]; heute: string }

const NICHT_ZAEHLEN = new Set(['fokus', 'block', 'arbeitsort']);
const stunden = (a: string, b: string | undefined) => (b ? (Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 36e5 : 0);
/** Ende einer ganztägigen Spanne ist exklusiv (iCal) — der letzte belegte Tag ist der Vortag. */
function letzterTag(t: KalenderTermin, tag: string): string | undefined {
  const e = tagAus(t.ende);
  if (!e) return undefined;
  if (!t.ganztags) return e > tag ? e : undefined;
  const d = new Date(`${e}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  const l = d.toISOString().slice(0, 10);
  return l > tag ? l : undefined;
}

export function kalenderStraenge(d: KalenderDaten): Strang[] {
  const aus: Strang[] = [];
  for (const t of d.termine) {
    const tag = tagAus(t.start);
    if (!tag || t.abgesagt || NICHT_ZAEHLEN.has(t.art ?? '')) continue;
    const person = !t.wer || t.wer === BEIDE ? BEIDE : t.wer;
    const privat = !!t.maskiert || ((t.sichtbarkeit === 'privat' || !!t.gesundheit) && person !== BEIDE);
    const thema: ThemaId = t.gesundheit ? 'gesundheit'
      : t.space === 'business' && t.bezug?.mandatId ? 'mandate'
      : t.space === 'business' && (t.bezug?.kontaktId || t.bezug?.dealId || t.bezug?.eventId || t.bezug?.firmaId) ? 'markttraktion'
      : 'planung';
    const bis = letzterTag(t, tag);
    const vorbei = (bis ?? tag) < d.heute;
    const lang = !!t.ganztags || t.art === 'abwesend' || stunden(t.start, t.ende) >= 3;
    aus.push({
      id: `termin:${t.id}`, quelle: 'termin', titel: t.titel, pfad: themaPfad(t.gesundheit ? 'privat' : t.space, thema), person,
      zeit: { tag, ...(bis ? { bis } : {}) }, gewicht: gewichtVon('termin', { lang, erledigt: vorbei }), status: vorbei ? 'erledigt' : 'offen',
      ...(t.maskiert || t.ohneLink ? {} : { link: WEG.termin(t.id, tag) }), ...(privat ? { privat: true } : {}),
    });
  }
  return aus;
}
