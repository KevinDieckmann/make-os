// ─── Kalender — Eingaben der Termin-Route prüfen (rein, getestet, 29.09., K1) ─
// POST (anlegen) und PATCH (ändern) von /api/kalender/termin: was vom Browser kommt,
// wird hier gesäubert — Zeiten, Art, Farbe, frei/beschäftigt, Sichtbarkeit, Zeitzone,
// Wiederholung (voll), Erinnerungen, Arbeitsort und die Bezüge (nur Kennungen → Bestand
// `kalender-bezug`, nie in den Termin). Fehler als Satz (400).
// K3 (30.09.): Gäste (Adresse, Name, Kontakt-Kennung) — die Adresse geht NUR in den Termin (ATTENDEE), die Kennung
// in `kalender-bezug.gastKontakte`; `einladungBestaetigt: true` ist die ausdrückliche Bestätigung aus der Oberfläche.

import { istIcsArt, istBlockArt, istSichtbarkeit, farbeSauber, arbeitsortSauber, arbeitsortTitel, erinnerungenSauber, beschaeftigtStandard, type IcsArt, type BlockArt, type Sichtbarkeit, type Arbeitsort } from './arten';
import { wiederholungSauber, type Wiederholung } from './wiederholung';
import { zoneGueltig, ausWandzeitIn, STANDARD_ZONE } from './zeitzone';
import { kennungenVon, GAST_KONTAKTE_MAX, type BezugKennungen } from './bezug';
import { adresseAus, TEILNAHMEN, type Teilnahme } from './gaeste';
import type { Wer } from './einstellungen';

/** Ein Gast aus der Oberfläche: Adresse (Pflicht), Name, Kontakt-Kennung aus dem CRM. */
export interface GastEingabe { email: string; name?: string; kontaktId?: string }
const KONTAKT = /^c-[a-z0-9-]{4,60}$/;

/** Gäste prüfen (höchstens GAST_KONTAKTE_MAX, ohne Doppelte) — `null` bei ungültiger Adresse (dann 400). */
export function gaestePruefen(v: unknown): { ok: true; gaeste: GastEingabe[] } | { ok: false; fehler: string } {
  if (v === undefined || v === null) return { ok: true, gaeste: [] };
  if (!Array.isArray(v)) return { ok: false, fehler: 'Gäste als Liste.' };
  if (v.length > GAST_KONTAKTE_MAX) return { ok: false, fehler: `Höchstens ${GAST_KONTAKTE_MAX} Gäste.` };
  const raus = new Map<string, GastEingabe>();
  for (const g of v) {
    const o = (g && typeof g === 'object' ? g : { email: g }) as Record<string, unknown>;
    const email = adresseAus(o.email);
    if (!email) return { ok: false, fehler: `Keine gültige E-Mail-Adresse: „${String(o.email ?? '').slice(0, 80)}“.` };
    const name = text(o.name, 120);
    const kontaktId = typeof o.kontaktId === 'string' && KONTAKT.test(o.kontaktId) ? o.kontaktId : undefined;
    if (!raus.has(email)) raus.set(email, { email, ...(name ? { name } : {}), ...(kontaktId ? { kontaktId } : {}) });
  }
  return { ok: true, gaeste: Array.from(raus.values()) };
}

const WAND = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
/** Wandzeit „YYYY-MM-DD[THH:mm[:ss]]“ → „YYYY-MM-DDTHH:mm:ss“ (ohne Zone, nie über new Date). */
export const wand = (v: unknown): string | undefined => (typeof v === 'string' && WAND.test(v) ? (v.length === 10 ? `${v}T00:00:00` : v.length === 16 ? `${v}:00` : v) : undefined);
export const text = (v: unknown, n: number): string | undefined => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : undefined);

/**
 * Feste, echte Termin-UID (A–Z, 0–9, . _ -; 8–121 Zeichen) — für idempotente Vorgänge: Server-Läufe (Übernahme, Spiegel,
 * Buchung) und seit F1 #6 auch das Anlegen aus dem Browser (die UID entsteht dort und liegt im Entwurf; ein zweites
 * Senden nach „Keine Verbindung“ legt nichts doppelt an). Geprüft hier und in lib/kalender/icloud.ts `anlegen`.
 */
export const UID_FEST = /^[A-Za-z0-9][A-Za-z0-9._-]{7,120}$/;
/** Neue UID für einen Termin aus dem Browser (F1 #6) — passt zu `UID_FEST`. */
export const neueTerminUid = (): string => `makeos-t-${globalThis.crypto.randomUUID()}`;

export interface AnlegeEingabe {
  titel: string; start: string; ende: string; ganztags: boolean;
  kalender?: string; wer?: Wer;
  ort?: string; notiz?: string;
  art: IcsArt; farbe?: string; beschaeftigt: boolean; sichtbarkeit: Sichtbarkeit; zone: string;
  /** R-K1 #13: Zone des Endes, wenn anders als `zone` (Flug) — `ende` ist dort gemeint. Nur über die Route, ohne Dialog. */
  endZone?: string;
  wiederholung?: Wiederholung; erinnerungenMin: number[]; arbeitsort?: Arbeitsort;
  /** K5: Unterart eines Blocks (nur Art „block“). */
  blockArt?: BlockArt;
  /** Nur Kennungen → `kalender-bezug`. */
  bezug: BezugKennungen;
  /** Gäste (K3) — nur mit `einladungBestaetigt` geschrieben. */
  gaeste: GastEingabe[];
  einladungBestaetigt: boolean;
  /** F1 #6: feste UID aus dem Browser (`UID_FEST`) — zweites Senden = derselbe Termin. */
  uid?: string;
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
  if (b.zone !== undefined && b.zone !== null && b.zone !== '' && !zoneGueltig(b.zone)) return { ok: false, fehler: 'Unbekannte Zeitzone.' };
  if (b.endZone !== undefined && b.endZone !== null && b.endZone !== '' && !zoneGueltig(b.endZone)) return { ok: false, fehler: 'Unbekannte Zeitzone des Endes.' };
  const zone = ganztags || !zoneGueltig(b.zone) ? STANDARD_ZONE : b.zone;
  const endZone = !ganztags && zoneGueltig(b.endZone) && b.endZone !== zone ? b.endZone : undefined;
  // Mit eigener Endzone zählt der echte Zeitpunkt, nicht der Text (18:00 Berlin → 20:00 New York ist später).
  const passt = !!start && !!ende && (endZone ? ausWandzeitIn(ende, endZone).getTime() > ausWandzeitIn(start, zone).getTime() : ende > start);
  if (!start || !ende || !passt) return { ok: false, fehler: 'Start und Ende fehlen oder passen nicht.' };
  if (b.sichtbarkeit !== undefined && !istSichtbarkeit(b.sichtbarkeit)) return { ok: false, fehler: 'Unbekannte Sichtbarkeit.' };
  if (b.wiederholung !== undefined && b.wiederholung !== null && !wiederholungSauber(b.wiederholung)) return { ok: false, fehler: 'Wiederholung unvollständig.' };
  const wiederholung = wiederholungSauber(b.wiederholung) ?? undefined;
  const wer = (['kevin', 'malin', 'beide'] as Wer[]).find(w => w === b.wer);
  // Abwesend und Fokus sind immer beschäftigt (zählen als „nicht verfügbar“); sonst wählbar.
  const beschaeftigt = art === 'abwesend' || art === 'fokus' ? true : typeof b.beschaeftigt === 'boolean' ? b.beschaeftigt : beschaeftigtStandard(art, ganztags);
  const erinnerungenMin = erinnerungenSauber([...(Array.isArray(b.erinnerungenMin) ? b.erinnerungenMin : []), ...(typeof b.erinnerungMin === 'number' && b.erinnerungMin >= 0 ? [b.erinnerungMin] : [])]);
  const ort = text(b.ort, 300), notiz = text(b.notiz, 2000), kalender = text(b.kalender, 100);
  const farbe = farbeSauber(b.farbe);
  const g = gaestePruefen(b.gaeste);
  if (!g.ok) return g;
  if (b.uid !== undefined && (typeof b.uid !== 'string' || !UID_FEST.test(b.uid))) return { ok: false, fehler: 'Ungültige Termin-Kennung.' };
  // Gäste nur an echten Terminen (Abwesend, Fokuszeit, Arbeitsort laden niemanden ein).
  if (g.gaeste.length && art !== 'termin') return { ok: false, fehler: 'Gäste gibt es nur an Terminen.' };
  return {
    ok: true,
    e: {
      titel, start, ende, ganztags, ...(kalender ? { kalender } : {}), ...(wer ? { wer } : {}),
      ...(ort ? { ort } : {}), ...(notiz ? { notiz } : {}),
      art, ...(farbe ? { farbe } : {}), beschaeftigt, sichtbarkeit: istSichtbarkeit(b.sichtbarkeit) ? b.sichtbarkeit : 'standard', zone,
      ...(endZone ? { endZone } : {}),
      ...(wiederholung ? { wiederholung } : {}), erinnerungenMin, ...(arbeitsort ? { arbeitsort } : {}),
      ...(art === 'block' && istBlockArt(b.blockArt) ? { blockArt: b.blockArt } : {}),
      bezug: kennungenVon(b.bezug && typeof b.bezug === 'object' ? b.bezug as BezugKennungen : {}),
      gaeste: g.gaeste, einladungBestaetigt: b.einladungBestaetigt === true,
      ...(typeof b.uid === 'string' ? { uid: b.uid } : {}),
    },
  };
}

export interface AenderEingabe {
  uid: string; stand?: string;
  termin: { titel?: string; start?: string; ende?: string; ort?: string | null; notiz?: string | null; art?: IcsArt; farbe?: string | null; beschaeftigt?: boolean; sichtbarkeit?: Sichtbarkeit; blockArt?: BlockArt | null };
  /** Bezüge ändern (null = Kennung entfernen) — nur Neben-Bestand, auch bei Serien erlaubt. */
  bezug?: Record<string, string | null>;
  /** K3: die ganze neue Gästeliste (nur Organisator, nur nach Bestätigung). */
  gaeste?: GastEingabe[];
  /** K3: als Gast antworten (nur nach Bestätigung). */
  antwort?: Exclude<Teilnahme, 'offen'>;
  einladungBestaetigt: boolean;
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
  if (b.blockArt !== undefined && b.blockArt !== null && b.blockArt !== '' && !istBlockArt(b.blockArt)) return { ok: false, fehler: 'Unbekannte Block-Art.' };
  const termin: AenderEingabe['termin'] = {
    ...(start ? { start } : {}), ...(ende ? { ende } : {}),
    ...(b.titel !== undefined ? { titel: text(b.titel, 300) ?? '' } : {}),
    ...(b.ort !== undefined ? { ort: text(b.ort, 300) || null } : {}),
    ...(b.notiz !== undefined ? { notiz: text(b.notiz, 2000) || null } : {}),
    ...(istIcsArt(b.art) ? { art: b.art } : {}),
    ...(b.farbe !== undefined ? { farbe: farbeSauber(b.farbe) ?? null } : {}),
    ...(typeof b.beschaeftigt === 'boolean' ? { beschaeftigt: b.beschaeftigt } : {}),
    ...(istSichtbarkeit(b.sichtbarkeit) ? { sichtbarkeit: b.sichtbarkeit } : {}),
    ...(b.blockArt !== undefined ? { blockArt: istBlockArt(b.blockArt) ? b.blockArt : null } : {}),
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
  let gaeste: GastEingabe[] | undefined;
  if (b.gaeste !== undefined) { const g = gaestePruefen(b.gaeste); if (!g.ok) return g; gaeste = g.gaeste; }
  if (b.antwort !== undefined && !(TEILNAHMEN as readonly unknown[]).includes(b.antwort)) return { ok: false, fehler: 'Antwort: zugesagt, abgesagt oder vielleicht.' };
  const antwort = b.antwort === 'zugesagt' || b.antwort === 'abgesagt' || b.antwort === 'vielleicht' ? b.antwort : undefined;
  return { ok: true, e: { uid, ...(stand ? { stand } : {}), termin, ...(bezug ? { bezug } : {}), ...(gaeste ? { gaeste } : {}), ...(antwort ? { antwort } : {}), einladungBestaetigt: b.einladungBestaetigt === true } };
}
