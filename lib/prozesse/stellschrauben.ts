// ─── Prozesse — Stellschrauben der festen System-Prozesse (rein, client-sicher; 22.10., Branch `prozesse-stellschrauben`) ───────────────────────────────
// Kevin 22.10.: „Alles muss anpassbar sein und immer mal wieder zu bearbeiten.“ Entscheidung (Klickrunde): ERST Stellschrauben, DANN überführen. Die
// System-Prozesse (lib/prozesse/register.ts) bleiben im Code als Ausführer — ihr Steckbrief zeigt aber, WELCHE Einstellungen sie steuern, mit Wert,
// Vorgabe, Grenzen und dem Ort, an dem der Wert gespeichert ist. KEINE zweite Wahrheit:
//   · der Server füllt `ProzessDef.stellschrauben` aus den VORHANDENEN Beständen (lib/prozesse/stellschrauben-server.ts), wie die Zahl der Fälle;
//   · geändert wird IMMER über die vorhandene Route bzw. Schreibstelle des Bestands (`weg`) — gleiche Rechte, Stand/409, Protokoll wie dort;
//   · ohne `weg` ist eine Stellschraube nur zu sehen (eine Maske in der Fachseite → `link`, oder gesetzlich fest → `fest`).
// Hier steht nur das Modell und die reinen Helfer: Wert als Text, Eingabe lesen, die Anfrage an die Route bauen (`anfrageFuer`). Rechnet nichts aus Beständen.

/** Wie eine Stellschraube eingegeben wird. `fest` = nicht einstellbar (Gesetz), `info` = nur ein Wert zum Ansehen (Maske in der Fachseite). */
export type StellschraubeArt = 'zahl' | 'schalter' | 'stunde' | 'wochentag' | 'tage-liste' | 'info' | 'fest';
export type StellschraubeWert = number | boolean | number[] | string | null;

/**
 * Wo eine Änderung hingeht — immer eine VORHANDENE Route (die Oberfläche baut die Anfrage über `anfrageFuer`, die Route prüft Rechte und Werte selbst):
 *   prozesse        POST /api/prozesse/stellschrauben            Bestand `prozesse-stellschrauben--<h>` (neue Einstellungen der festen Prozesse, Stand/409)
 *   wertelisten     POST /api/crm/stammdaten (wertelisten)        `crm.wertelisten` — Kadenz je Kreis, Ziele je Monat, Stellschrauben der Markttraktion
 *   loeschfrist     POST /api/crm/datenschutz (fristen)           `crm-loeschfristen` — nur Fristen, die nicht fest sind
 *   mahntage        POST /api/rechnung (mahntage)                 `rechnungswesen` — die drei Mahnstufen zusammen (steigend)
 *   puls-schwelle   POST /api/fulfillment/kunde (puls-schwelle)   `fulfillment--<h>.einstellungen`
 *   fulfillment     PATCH /api/fulfillment (einstellungen)        `fulfillment--<h>.einstellungen` — Willkommen, Nachsorge
 */
export type StellschraubeWeg =
  | { art: 'prozesse'; id: string }
  | { art: 'wertelisten'; feld: 'kadenzTage' | 'ziele' | 'stellschrauben'; schluessel: string }
  | { art: 'loeschfrist'; id: string }
  | { art: 'mahntage'; stufe: 0 | 1 | 2; tage: [number, number, number] }
  | { art: 'puls-schwelle' }
  | { art: 'fulfillment'; feld: 'willkommenStunden' | 'nachsorgeTage' };
export type StellschraubeWegArt = StellschraubeWeg['art'];
export const STELLSCHRAUBE_WEGE: readonly StellschraubeWegArt[] = ['prozesse', 'wertelisten', 'loeschfrist', 'mahntage', 'puls-schwelle', 'fulfillment'];

export interface Stellschraube {
  /** Eindeutig im Prozess (Schlüssel der Oberfläche). */
  id: string;
  /** Abschnitt im Steckbrief (z. B. „Head of Sales“) — fehlt = oben. */
  gruppe?: string;
  name: string;
  erklaerung: string;
  art: StellschraubeArt;
  /** Der wirksame Wert. */
  wert: StellschraubeWert;
  /** Der Wert der Vorgabe — fehlt, wenn es keine gibt (z. B. ein Ziel: leer = kein Ziel). */
  vorgabe?: StellschraubeWert;
  einheit?: string;
  min?: number; max?: number;
  /** Wo der Wert gespeichert ist (Bestand bzw. Ort in Worten). */
  wo: string;
  /** Wie eine Änderung gespeichert wird — fehlt = nur ansehen. */
  weg?: StellschraubeWeg;
  /** Die Maske in der Fachseite, wo es sie schon gibt (nur über WEG gebaut). */
  link?: { href: string; text: string };
  /** Gesetzlich fest: „fest (Gesetz)“ + Grund. */
  fest?: string;
}

/** Was eine Person ändern darf — je Weg (der Server rechnet es mit den Regeln der jeweiligen Route; die Route prüft beim Schreiben noch einmal). */
export type StellschraubenRechte = Partial<Record<StellschraubeWegArt, boolean>>;

export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;

const gleich = (a: StellschraubeWert | undefined, b: StellschraubeWert | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** Weicht der Wert von der Vorgabe ab? Ohne Vorgabe: ist überhaupt ein Wert gesetzt? */
export const abweichend = (s: Pick<Stellschraube, 'wert' | 'vorgabe'>): boolean => (s.vorgabe === undefined ? s.wert !== null && s.wert !== '' : !gleich(s.wert, s.vorgabe));
/** Lässt sich die Stellschraube ändern (von der Rolle unabhängig)? */
export const aenderbar = (s: Pick<Stellschraube, 'weg' | 'art'>): boolean => !!s.weg && s.art !== 'fest' && s.art !== 'info';
/** Darf DIESE Person sie ändern? */
export const darfAendern = (s: Pick<Stellschraube, 'weg' | 'art'>, rechte: StellschraubenRechte | undefined): boolean => aenderbar(s) && !!rechte?.[s.weg!.art];
/** Hat ein Prozess Stellschrauben, die sich ändern lassen? (das Zeichen „einstellbar“ an der Kachel) */
export const einstellbar = (p: { stellschrauben?: readonly Stellschraube[] }): boolean => !!p.stellschrauben?.some(aenderbar);

/** Ein Wert als Text (Anzeige, auch für „Vorgabe: …“). */
export function wertText(s: Pick<Stellschraube, 'art' | 'einheit'>, w: StellschraubeWert | undefined): string {
  if (w === null || w === undefined || w === '') return '—';
  if (s.art === 'schalter') return w === true ? 'an' : 'aus';
  if (s.art === 'stunde' && typeof w === 'number') return `ab ${w} Uhr`;
  if (s.art === 'wochentag' && typeof w === 'number') return WOCHENTAGE[((w % 7) + 7) % 7];
  if (Array.isArray(w)) return `${w.join(' · ')}${s.einheit ? ` ${s.einheit}` : ''}`;
  if (typeof w === 'number') return `${w.toLocaleString('de-DE')}${s.einheit ? ` ${s.einheit}` : ''}`;
  return String(w);
}

/**
 * Eine Eingabe lesen und prüfen (dieselben Grenzen, die der Server prüft — der Server bleibt die Wahrheit). Leer bei einer Stellschraube ohne Vorgabe = löschen
 * (`null`). Liefert den Wert oder einen Satz.
 */
export function eingabeLesen(s: Pick<Stellschraube, 'art' | 'min' | 'max' | 'name' | 'einheit' | 'vorgabe'>, roh: string | boolean): { ok: true; wert: StellschraubeWert } | { ok: false; fehler: string } {
  if (s.art === 'schalter') return typeof roh === 'boolean' ? { ok: true, wert: roh } : { ok: false, fehler: 'an oder aus.' };
  const t = String(roh).trim();
  if (!t && s.vorgabe === undefined) return { ok: true, wert: null };
  if (s.art === 'tage-liste') {
    const teile = t.split(/[\s,;·]+/).filter(Boolean).map(Number);
    if (!teile.length || teile.some(n => !Number.isInteger(n) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max))) return { ok: false, fehler: `${s.name}: ganze Zahlen ${s.min ?? 1}–${s.max ?? 365}, mit Komma getrennt.` };
    return { ok: true, wert: Array.from(new Set(teile)).sort((a, b) => a - b) };
  }
  const n = Number(t.replace(/\s/g, '').replace(',', '.'));
  const ganz = s.art !== 'zahl' || s.einheit !== '€';
  if (!t || !Number.isFinite(n) || (ganz && !Number.isInteger(n)) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)) {
    return { ok: false, fehler: `${s.name}: ${ganz ? 'ganze Zahl' : 'Zahl'}${s.min !== undefined ? ` ${s.min}–${s.max}` : ''}${s.einheit && s.art === 'zahl' ? ` ${s.einheit}` : ''}.` };
  }
  return { ok: true, wert: n };
}

/** Eine Anfrage an die vorhandene Route (`fetch(url, { method, body })`) — `wert: 'vorgabe'` setzt zurück. */
export interface StellschraubeAnfrage { url: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> }

/**
 * Die Anfrage für eine Änderung (rein, getestet): Form genau so, wie die Route sie heute erwartet. `stand` = Stand des Bestands `prozesse-stellschrauben`
 * aus der letzten Antwort (nur für den Weg `prozesse`). `null` = keine Anfrage (nur ansehen).
 */
export function anfrageFuer(s: Pick<Stellschraube, 'weg' | 'art' | 'vorgabe'>, wert: StellschraubeWert | 'vorgabe', stand?: string): StellschraubeAnfrage | null {
  if (!s.weg || !aenderbar(s)) return null;
  const w = s.weg;
  const zurueck = wert === 'vorgabe';
  const neu: StellschraubeWert = zurueck ? null : wert;
  switch (w.art) {
    case 'prozesse':
      return { url: '/api/prozesse/stellschrauben?space=business', method: 'POST', body: { stand: stand ?? '', ops: [{ id: w.id, wert: neu }] } };
    case 'wertelisten':
      return { url: '/api/crm/stammdaten?space=business', method: 'POST', body: { aktion: 'wertelisten', wertelisten: { [w.feld]: { [w.schluessel]: neu } } } };
    case 'loeschfrist':
      return { url: '/api/crm/datenschutz?space=business', method: 'POST', body: { aktion: 'fristen', fristen: { [w.id]: neu } } };
    case 'mahntage': {
      const tage = [...w.tage] as [number, number, number];
      const v = zurueck ? s.vorgabe : neu;
      if (typeof v !== 'number') return null;
      tage[w.stufe] = v;
      return { url: '/api/rechnung', method: 'POST', body: { aktion: 'mahntage', tage } };
    }
    case 'puls-schwelle': {
      const v = zurueck ? s.vorgabe : neu;
      return typeof v === 'number' ? { url: '/api/fulfillment/kunde?space=business', method: 'POST', body: { aktion: 'puls-schwelle', wert: v } } : null;
    }
    case 'fulfillment': {
      const v = zurueck ? s.vorgabe : neu;
      if (v === null || v === undefined) return null;
      return { url: '/api/fulfillment?space=business', method: 'PATCH', body: { ops: [{ op: 'einstellungen', felder: { [w.feld]: v } }] } };
    }
  }
}
