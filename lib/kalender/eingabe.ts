// ─── Kalender — Eingaben der Termin-Route prüfen (rein, getestet, 29.09., K1) ─
// POST (anlegen) und PATCH (ändern) von /api/kalender/termin: was vom Browser kommt,
// wird hier gesäubert — Zeiten, Art, Farbe, frei/beschäftigt, Sichtbarkeit, Zeitzone,
// Wiederholung (voll), Erinnerungen, Arbeitsort und die Bezüge (nur Kennungen → Bestand
// `kalender-bezug`, nie in den Termin). Fehler als Satz (400).

import { istIcsArt, istSichtbarkeit, farbeSauber, arbeitsortSauber, arbeitsortTitel, erinnerungenSauber, beschaeftigtStandard, type IcsArt, type Sichtbarkeit, type Arbeitsort } from './arten';
import { wiederholungSauber, type Wiederholung } from './wiederholung';
import { zoneGueltig, STANDARD_ZONE } from './zeitzone';
import { kennungenVon, type BezugKennungen } from './bezug';
import type { Wer } from './einstellungen';

const WAND = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
/** Wandzeit „YYYY-MM-DD[THH:mm[:ss]]“ → „YYYY-MM-DDTHH:mm:ss“ (ohne Zone, nie über new Date). */
export const wand = (v: unknown): string | undefined => (typeof v === 'string' && WAND.test(v) ? (v.length === 10 ? `${v}T00:00:00` : v.length === 16 ? `${v}:00` : v) : undefined);
export const text = (v: unknown, n: number): string | undefined => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : undefined);

export interface AnlegeEingabe {
  titel: string; start: string; ende: string; ganztags: boolean;
  kalender?: string; wer?: Wer;
  ort?: string; notiz?: string;
  art: IcsArt; farbe?: string; beschaeftigt: boolean; sichtbarkeit: Sichtbarkeit; zone: string;
  wiederholung?: Wiederholung; erinnerungenMin: number[]; arbeitsort?: Arbeitsort;
  /** Nur Kennungen → `kalender-bezug`. */
  bezug: BezugKennungen;
}

/** POST-Körper prüfen. */
export function anlegenPruefen(b: Record<string, unknown>): { ok: true; e: AnlegeEingabe } | { ok: false; fehler: string } {
  const art: IcsArt = istIcsArt(b.art) ? b.art : 'termin';
  const arbeitsort = art === 'arbeitsort' ? arbeitsortSauber(b.arbeitsort) : undefined;
  if (art === 'arbeitsort' && !arbeitsort) return { ok: false, fehler: 'Arbeitsort fehlt (Home, Büro, unterwegs, beim Kunden oder eigener Text).' };
  const titel = arbeitsort ? arbeitsortTitel(arbeitsort) : text(b.titel, 300);
  if (!titel) return { ok: false, fehler: 'Titel fehlt.' };
  const ganztags = b.ganztags === true;
  const start = wand(b.start), ende = wand(b.ende);
  if (!start || !ende || ende <= start) return { ok: false, fehler: 'Start und Ende fehlen oder passen nicht.' };
  if (b.zone !== undefined && b.zone !== null && b.zone !== '' && !zoneGueltig(b.zone)) return { ok: false, fehler: 'Unbekannte Zeitzone.' };
  const zone = ganztags || !zoneGueltig(b.zone) ? STANDARD_ZONE : b.zone;
  if (b.sichtbarkeit !== undefined && !istSichtbarkeit(b.sichtbarkeit)) return { ok: false, fehler: 'Unbekannte Sichtbarkeit.' };
  if (b.wiederholung !== undefined && b.wiederholung !== null && !wiederholungSauber(b.wiederholung)) return { ok: false, fehler: 'Wiederholung unvollständig.' };
  const wiederholung = wiederholungSauber(b.wiederholung) ?? undefined;
  const wer = (['kevin', 'malin', 'beide'] as Wer[]).find(w => w === b.wer);
  // Abwesend und Fokus sind immer beschäftigt (zählen als „nicht verfügbar“); sonst wählbar.
  const beschaeftigt = art === 'abwesend' || art === 'fokus' ? true : typeof b.beschaeftigt === 'boolean' ? b.beschaeftigt : beschaeftigtStandard(art, ganztags);
  const erinnerungenMin = erinnerungenSauber([...(Array.isArray(b.erinnerungenMin) ? b.erinnerungenMin : []), ...(typeof b.erinnerungMin === 'number' && b.erinnerungMin >= 0 ? [b.erinnerungMin] : [])]);
  const ort = text(b.ort, 300), notiz = text(b.notiz, 2000), kalender = text(b.kalender, 100);
  const farbe = farbeSauber(b.farbe);
  return {
    ok: true,
    e: {
      titel, start, ende, ganztags, ...(kalender ? { kalender } : {}), ...(wer ? { wer } : {}),
      ...(ort ? { ort } : {}), ...(notiz ? { notiz } : {}),
      art, ...(farbe ? { farbe } : {}), beschaeftigt, sichtbarkeit: istSichtbarkeit(b.sichtbarkeit) ? b.sichtbarkeit : 'standard', zone,
      ...(wiederholung ? { wiederholung } : {}), erinnerungenMin, ...(arbeitsort ? { arbeitsort } : {}),
      bezug: kennungenVon(b.bezug && typeof b.bezug === 'object' ? b.bezug as BezugKennungen : {}),
    },
  };
}

export interface AenderEingabe {
  uid: string; stand?: string;
  termin: { titel?: string; start?: string; ende?: string; ort?: string | null; notiz?: string | null; art?: IcsArt; farbe?: string | null; beschaeftigt?: boolean; sichtbarkeit?: Sichtbarkeit };
  /** Bezüge ändern (null = Kennung entfernen) — nur Neben-Bestand, auch bei Serien erlaubt. */
  bezug?: Record<string, string | null>;
}

/** PATCH-Körper prüfen. */
export function aendernPruefen(b: Record<string, unknown>): { ok: true; e: AenderEingabe } | { ok: false; fehler: string } {
  const uid = text(b.uid, 300);
  if (!uid) return { ok: false, fehler: 'uid fehlt.' };
  const start = b.start !== undefined ? wand(b.start) : undefined;
  const ende = b.ende !== undefined ? wand(b.ende) : undefined;
  if ((b.start !== undefined && !start) || (b.ende !== undefined && !ende)) return { ok: false, fehler: 'Zeit im falschen Format.' };
  if (b.art !== undefined && !istIcsArt(b.art)) return { ok: false, fehler: 'Unbekannte Art.' };
  if (b.sichtbarkeit !== undefined && !istSichtbarkeit(b.sichtbarkeit)) return { ok: false, fehler: 'Unbekannte Sichtbarkeit.' };
  if (b.farbe !== undefined && b.farbe !== null && b.farbe !== '' && !farbeSauber(b.farbe)) return { ok: false, fehler: 'Unbekannte Farbe.' };
  const termin: AenderEingabe['termin'] = {
    ...(start ? { start } : {}), ...(ende ? { ende } : {}),
    ...(b.titel !== undefined ? { titel: text(b.titel, 300) ?? '' } : {}),
    ...(b.ort !== undefined ? { ort: text(b.ort, 300) || null } : {}),
    ...(b.notiz !== undefined ? { notiz: text(b.notiz, 2000) || null } : {}),
    ...(istIcsArt(b.art) ? { art: b.art } : {}),
    ...(b.farbe !== undefined ? { farbe: farbeSauber(b.farbe) ?? null } : {}),
    ...(typeof b.beschaeftigt === 'boolean' ? { beschaeftigt: b.beschaeftigt } : {}),
    ...(istSichtbarkeit(b.sichtbarkeit) ? { sichtbarkeit: b.sichtbarkeit } : {}),
  };
  let bezug: Record<string, string | null> | undefined;
  if (b.bezug && typeof b.bezug === 'object') {
    bezug = {};
    for (const [k, v] of Object.entries(b.bezug as Record<string, unknown>)) {
      if (!['kontaktId', 'firmaId', 'mandatId', 'dealId', 'aufgabeId', 'eventId'].includes(k)) continue;
      if (v === null || v === '') bezug[k] = null;
      else if (kennungenVon({ [k]: v } as BezugKennungen)[k as keyof BezugKennungen]) bezug[k] = v as string;
      else return { ok: false, fehler: `Ungültige Kennung (${k}).` };
    }
  }
  const stand = text(b.stand, 200);
  return { ok: true, e: { uid, ...(stand ? { stand } : {}), termin, ...(bezug ? { bezug } : {}) } };
}
