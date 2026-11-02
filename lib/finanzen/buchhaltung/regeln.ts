// ─── Buchhaltung — Regeln „Empfänger/Verwendungszweck → Kategorie“ je Gesellschaft (02.11., rein: Server UND Browser) ───────────────────
// Vorbild: die Haushalts-Regeln (components/os/haushalt/Buchungen.tsx „Regel lernen“). Eine Regel gilt für EINE Gesellschaft (oder alle) und
// setzt nur die Kategorie. Drei Regeln, die überall gelten:
//   • Hand gewinnt — eine Buchung mit `kategorieHand` fasst keine Regel an,
//   • die Gegenseite gewinnt — Umbuchung/Entnahme/Einlage (aus dem eigenen Konto erkannt) überschreibt keine Regel,
//   • rückwirkend nur mit Vorschau und Klick; beim Kontoauszug-Import wirken sie auf die NEUEN Zeilen (lib/finanzen/kontoauszug/plan.ts).
// Verwendungszwecke sind fremder Text — sie werden nur verglichen, nie an ZOE gegeben.

import { suchNorm } from '@/lib/text/such-norm';
import { istGesellschaft } from '@/lib/einheiten';
import { AUS_GEGENKONTO, EIGENE_KATEGORIEN_MAX, kategorieSauber } from './kategorien';
import type { BhBuchung } from './arbeitsliste';

export type RegelFeld = 'wer' | 'zweck' | 'beide';
export interface BuchungsRegel {
  /** `br-<uuid>` */
  id: string;
  /** Gesellschaft, für die sie gilt — fehlt = alle Gesellschaften. */
  ort?: string;
  feld: RegelFeld;
  /** Suchtext (normalisiert verglichen: Groß/Klein, Umlaute egal) — „enthält“. */
  muster: string;
  kategorie: string;
  /** Optional: Notiz, die eine neue Buchung mit der Kategorie bekommt (aus einem Buchhaltungs-Paket). */
  notiz?: string;
  /** ISO-Zeitpunkt (ohne Person — der Bestand gehört dem Haushalt; wer angelegt hat, steht im Änderungsprotokoll). */
  angelegt: string;
}
export interface RegelBestand { regeln: BuchungsRegel[]; /** Eigene Kategorien des Haushalts. */ kategorien: string[] }
export const LEERER_REGELBESTAND: RegelBestand = { regeln: [], kategorien: [] };

export const REGELN_MAX = 500, MUSTER_MIN = 3, MUSTER_MAX = 80;
const ID = /^br-[a-z0-9-]{1,60}$/;

/** Gelesenen Bestand in Form bringen (Unbekanntes fällt weg, nie gekürzt). */
export function regelBestandLesen(roh: unknown): RegelBestand {
  const o = roh && typeof roh === 'object' ? roh as Partial<RegelBestand> : {};
  const regeln = (Array.isArray(o.regeln) ? o.regeln : []).filter((r): r is BuchungsRegel =>
    !!r && typeof r === 'object' && ID.test(String((r as BuchungsRegel).id)) && typeof (r as BuchungsRegel).muster === 'string' && typeof (r as BuchungsRegel).kategorie === 'string'
    && ['wer', 'zweck', 'beide'].includes((r as BuchungsRegel).feld));
  const kategorien = (Array.isArray(o.kategorien) ? o.kategorien : []).map(kategorieSauber).filter((k): k is string => !!k);
  return { regeln, kategorien };
}

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; status: 400 | 413; fehler: string };

/** Eine neue Regel prüfen (Eingabe des Browsers). */
export function regelPruefen(roh: unknown, ctx: { id: string; jetzt: string; erlaubteOrte: (o: string) => boolean }): Pruefung<BuchungsRegel> {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const feld = o.feld === 'zweck' || o.feld === 'beide' ? o.feld : o.feld === 'wer' || o.feld === undefined ? 'wer' : null;
  if (!feld) return { ok: false, status: 400, fehler: 'Unbekanntes Feld der Regel — nichts gespeichert.' };
  const muster = typeof o.muster === 'string' ? o.muster.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  if (muster.length > MUSTER_MAX) return { ok: false, status: 413, fehler: `Der Suchtext ist zu lang (höchstens ${MUSTER_MAX} Zeichen) — gekürzt wird nie, nichts gespeichert.` };
  if (suchNorm(muster).trim().length < MUSTER_MIN) return { ok: false, status: 400, fehler: `Der Suchtext ist zu kurz (mindestens ${MUSTER_MIN} Zeichen) — sonst trifft die Regel fast alles. Nichts gespeichert.` };
  const kategorie = kategorieSauber(o.kategorie);
  if (!kategorie) return { ok: false, status: 400, fehler: 'Bitte eine Kategorie wählen — nichts gespeichert.' };
  if (AUS_GEGENKONTO.has(kategorie)) return { ok: false, status: 400, fehler: `„${kategorie}“ ergibt sich aus dem Gegenkonto, nicht aus einer Regel — bitte direkt an der Buchung setzen. Nichts gespeichert.` };
  let ort: string | undefined;
  if (o.ort !== undefined && o.ort !== null && o.ort !== '') {
    if (!istGesellschaft(o.ort) || !ctx.erlaubteOrte(o.ort)) return { ok: false, status: 400, fehler: 'Diese Gesellschaft gibt es hier nicht — nichts gespeichert.' };
    ort = o.ort;
  }
  return { ok: true, wert: { id: ctx.id, ...(ort ? { ort } : {}), feld, muster, kategorie, angelegt: ctx.jetzt } };
}

/** Eigene Kategorie dazunehmen (Liste wächst nur bis zur Grenze → 413). */
export function eigeneKategorieDazu(b: RegelBestand, roh: unknown): Pruefung<RegelBestand> {
  const k = kategorieSauber(roh);
  if (!k) return { ok: false, status: 400, fehler: 'Bitte einen Namen für die Kategorie (höchstens 60 Zeichen) — nichts gespeichert.' };
  if (b.kategorien.some(x => x.localeCompare(k, 'de', { sensitivity: 'base' }) === 0)) return { ok: true, wert: b };
  if (b.kategorien.length >= EIGENE_KATEGORIEN_MAX) return { ok: false, status: 413, fehler: `Höchstens ${EIGENE_KATEGORIEN_MAX} eigene Kategorien — nichts gespeichert.` };
  return { ok: true, wert: { ...b, kategorien: [...b.kategorien, k] } };
}

/** Trifft die Regel die Buchung? (Gesellschaft passt, Suchtext im gewählten Feld enthalten) */
export function regelTrifft(r: BuchungsRegel, b: Pick<BhBuchung, 'wer' | 'zweck' | 'ort'>): boolean {
  if (r.ort && r.ort !== b.ort) return false;
  const m = suchNorm(r.muster).trim();
  if (!m) return false;
  const text = r.feld === 'wer' ? b.wer : r.feld === 'zweck' ? b.zweck ?? '' : `${b.wer} ${b.zweck ?? ''}`;
  return suchNorm(text).includes(m);
}

/** Die Regel, die für eine Buchung gilt: die Regel der Gesellschaft vor der für alle, der längere Suchtext vor dem kürzeren, dann die ältere. */
export function regelFuer(regeln: readonly BuchungsRegel[], b: Pick<BhBuchung, 'wer' | 'zweck' | 'ort'>): BuchungsRegel | undefined {
  return regeln.filter(r => regelTrifft(r, b))
    .sort((a, c) => Number(!!c.ort) - Number(!!a.ort) || c.muster.length - a.muster.length || a.angelegt.localeCompare(c.angelegt) || a.id.localeCompare(c.id))[0];
}

/** Darf eine Regel die Kategorie dieser Buchung setzen? (Hand gewinnt, Gegenkonto gewinnt, „bitte zuordnen“ bleibt beim Menschen) */
export const regelDarf = (b: Pick<BhBuchung, 'kategorieHand' | 'kategorie' | 'zuordnen'>): boolean => !b.kategorieHand && !AUS_GEGENKONTO.has(b.kategorie) && !b.zuordnen;

/** Vorschlag „Regel lernen“ aus einer Buchung: der Name der Gegenseite (sonst der Anfang des Zwecks). */
export function regelVorschlag(b: Pick<BhBuchung, 'wer' | 'zweck' | 'ort' | 'kategorie'>): { feld: RegelFeld; muster: string; ort?: string; kategorie: string } {
  const wer = b.wer.normalize('NFC').replace(/\s+/g, ' ').trim();
  const nimmWer = suchNorm(wer).trim().length >= MUSTER_MIN;
  const muster = (nimmWer ? wer : (b.zweck ?? '').replace(/\s+/g, ' ').trim()).slice(0, MUSTER_MAX).trim();
  return { feld: nimmWer ? 'wer' : 'zweck', muster, ...(b.ort ? { ort: b.ort } : {}), kategorie: b.kategorie };
}

export interface RegelWirkung { id: string; datum: string; wer: string; betrag: number; vorher: string; nachher: string; regel: string }

/** Rückwirkend: was die Regeln an gespeicherten Buchungen ändern würden (nur Vorschau — geschrieben wird erst per Klick mit Stand). */
export function rueckwirkend(alle: readonly BhBuchung[], regeln: readonly BuchungsRegel[], nur?: (r: BuchungsRegel) => boolean): RegelWirkung[] {
  const raus: RegelWirkung[] = [];
  const aktiv = nur ? regeln.filter(nur) : regeln;
  for (const b of alle) {
    if (!regelDarf(b)) continue;
    const r = regelFuer(regeln, b);
    if (!r || (nur && !aktiv.includes(r))) continue;
    if (r.kategorie === b.kategorie) continue;
    raus.push({ id: b.id, datum: b.datum, wer: b.wer, betrag: b.betrag, vorher: b.kategorie, nachher: r.kategorie, regel: r.id });
  }
  return raus.sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id));
}
