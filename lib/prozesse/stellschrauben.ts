// ─── Prozesse — Stellschrauben der festen System-Prozesse (rein, client-sicher; 22.10., Branch `prozesse-stellschrauben`) ───────────────────────────────
// Entscheidung 22.10.: „Alles muss anpassbar sein und immer mal wieder zu bearbeiten.“ Entscheidung (Klickrunde): ERST Stellschrauben, DANN überführen. Die
// System-Prozesse (lib/prozesse/register.ts) bleiben im Code als Ausführer — ihr Steckbrief zeigt aber, WELCHE Einstellungen sie steuern, mit Wert,
// Vorgabe, Grenzen und dem Ort, an dem der Wert gespeichert ist. KEINE zweite Wahrheit:
//   · der Server füllt `ProzessDef.stellschrauben` aus den VORHANDENEN Beständen (lib/prozesse/stellschrauben-server.ts), wie die Zahl der Fälle;
//   · geändert wird IMMER über die vorhandene Route bzw. Schreibstelle des Bestands (`weg`) — gleiche Rechte, Stand/409, Protokoll wie dort;
//   · ohne `weg` ist eine Stellschraube nur zu sehen (eine Maske in der Fachseite → `link`, oder gesetzlich fest → `fest`).
// Hier steht nur das Modell und die reinen Helfer: Wert als Text, Eingabe lesen, die Anfrage an die Route bauen (`anfrageFuer`). Rechnet nichts aus Beständen.

/**
 * Wie eine Stellschraube eingegeben wird. `fest` = nicht einstellbar (Gesetz), `info` = nur ein Wert zum Ansehen (Maske in der Fachseite), `auswahl` = eine der
 * `optionen` (Restpunkte 24.10.: Modellstufe und Autonomie der Heads).
 */
export type StellschraubeArt = 'zahl' | 'schalter' | 'stunde' | 'wochentag' | 'tage-liste' | 'auswahl' | 'info' | 'fest';
export type StellschraubeWert = number | boolean | number[] | string | null;

/**
 * Wo eine Änderung hingeht — immer eine VORHANDENE Route (die Oberfläche baut die Anfrage über `anfrageFuer`, die Route prüft Rechte und Werte selbst):
 *   prozesse        POST /api/prozesse/stellschrauben            Bestand `prozesse-stellschrauben--<h>` (neue Einstellungen der festen Prozesse, Stand/409)
 *   wertelisten     POST /api/crm/stammdaten (wertelisten)        `crm.wertelisten` — Kadenz je Kreis, Ziele je Monat, Stellschrauben der Markttraktion
 *   loeschfrist     POST /api/crm/datenschutz (fristen)           `crm-loeschfristen` — nur Fristen, die nicht fest sind
 *   mahntage        POST /api/rechnung (mahntage)                 `rechnungswesen` — die drei Mahnstufen zusammen (steigend)
 *   puls-schwelle   POST /api/fulfillment/kunde (puls-schwelle)   `fulfillment--<h>.einstellungen`
 *   fulfillment     PATCH /api/fulfillment (einstellungen)        `fulfillment--<h>.einstellungen` — Willkommen, Nachsorge
 * Restpunkte (24.10., Kevin 22.10.: „alles muss anpassbar sein“): drei Masken, deren Route ein GANZES Objekt erwartet (Scoring-Einstellungen, Buchungsseite,
 * Head-Einstellung). Die Karte schickt nur Feld + Wert + den gelesenen Stand an POST /api/prozesse/stellschrauben/weiter — der Server
 * (lib/prozesse/stellschrauben-weiter-server.ts) liest den aktuellen Stand, prüft ihn (409) und leitet an DIESELBE Schreibstelle weiter wie die Fachseite:
 *   scoring         `scoringSchreiben` (lib/crm/scoring-server.ts)   Bestand `crm-scoring` — MQL-/SQL-Schwelle, Temperatur (Fragen/Stufen/Muss bleiben im Reiter Scoring)
 *   buchung         `seiteSpeichern` (lib/kalender/buchung-seite-server.ts, auch die Route /api/kalender/buchung) — An/aus, Dauer, Vorlauf, je Tag, Puffer einer Seite
 *   head            `einstellungAendern` (lib/agenten/einstellung.ts, auch POST /api/agenten) — An/aus, Modell, Budget, Autonomie (nur verschärfen); nur der Inhaber
 */
export type StellschraubeWeg =
  | { art: 'prozesse'; id: string }
  | { art: 'wertelisten'; feld: 'kadenzTage' | 'ziele' | 'stellschrauben'; schluessel: string }
  | { art: 'loeschfrist'; id: string }
  | { art: 'mahntage'; stufe: 0 | 1 | 2; tage: [number, number, number] }
  | { art: 'puls-schwelle' }
  | { art: 'fulfillment'; feld: 'willkommenStunden' | 'nachsorgeTage' }
  | { art: 'scoring'; feld: ScoringFeld; stand: string }
  | { art: 'buchung'; seite: string; feld: BuchungFeld; stand: string }
  | { art: 'head'; head: string; feld: HeadFeld; stand: string };
/** Was die Steckbrief-Maske am Scoring ändert: die Schwellen der zwei Seiten und die drei Temperatur-Grenzen. */
export const SCORING_FELDER = ['marketing', 'sales', 'lau', 'warm', 'heiss'] as const;
export type ScoringFeld = typeof SCORING_FELDER[number];
/** Was die Steckbrief-Maske an einer Buchungsseite ändert (Fenster, Fragen, Ort, Verantwortlicher bleiben in der Verwaltung). */
export const BUCHUNG_FELDER = ['aktiv', 'dauerMin', 'vorlaufMin', 'maxJeTag', 'pufferMin'] as const;
export type BuchungFeld = typeof BUCHUNG_FELDER[number];
/** Was die Steckbrief-Maske an einem Business-Head ändert (`budget` in Euro — der Server rechnet in Cent). Not-Aus, Auftrag, Wissen bleiben in ZOE › Agenten. */
export const HEAD_FELDER = ['aktiv', 'stufe', 'budget', 'autonomie'] as const;
export type HeadFeld = typeof HEAD_FELDER[number];
/** Der Weg, über den diese drei Masken schreiben (eine Route, die weiterleitet). */
export const WEITER_URL = '/api/prozesse/stellschrauben/weiter?space=business';
export type StellschraubeWegArt = StellschraubeWeg['art'];

/**
 * Wo der Wert einer Stellschraube liegt — in Worten der Nutzer (Feinschliff 1, 23.10., Sichtprüfung: „Gespeichert in: im Code (lib/crm/kampagnen.ts)“ zeigte
 * Technik). EINE Abbildung Kennung → Satz; die Bestände dahinter nennt nur der Code (lib/prozesse/stellschrauben-bau.ts liefert die Kennung).
 */
export const STELLSCHRAUBE_ORT = {
  heads: 'Gespeichert in den Einstellungen der Heads',
  wertelisten: 'Gespeichert in den Einstellungen der Markttraktion',
  vertriebsplanung: 'Gespeichert in der Planung der Markttraktion',
  scoring: 'Gespeichert in den Scoring-Einstellungen der Markttraktion',
  buchung: 'Gespeichert bei den Buchungsseiten des Kalenders',
  fulfillment: 'Gespeichert in den Einstellungen des Fulfillments',
  rechnungswesen: 'Gespeichert in den Einstellungen des Rechnungswesens',
  loeschfristen: 'Gespeichert bei den Löschfristen des Datenschutzes',
  prozesse: 'Gespeichert in den Einstellungen der Prozesse',
  vorlagen: 'Gespeichert bei den Vorlagen der Markttraktion',
  gesetz: 'Fest im Gesetz',
  system: 'Fest im System',
} as const;
export type StellschraubeOrt = keyof typeof STELLSCHRAUBE_ORT;
/** Der Satz zum Ort (unbekannte Kennung: „Fest im System“ — nie eine Kennung auf dem Bildschirm). */
export const ortSatz = (wo: string): string => (STELLSCHRAUBE_ORT as Record<string, string>)[wo] ?? STELLSCHRAUBE_ORT.system;
export const STELLSCHRAUBE_WEGE: readonly StellschraubeWegArt[] = ['prozesse', 'wertelisten', 'loeschfrist', 'mahntage', 'puls-schwelle', 'fulfillment', 'scoring', 'buchung', 'head'];

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
  /** Nur `auswahl`: die wählbaren Werte (Anzeige-Text je Wert). */
  optionen?: readonly { wert: string; text: string }[];
  /** Wo der Wert gespeichert ist — eine Kennung; die Oberfläche zeigt den Satz aus `STELLSCHRAUBE_ORT` (nie Dateipfade oder Bestandsnamen). */
  wo: StellschraubeOrt;
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
export function wertText(s: Pick<Stellschraube, 'art' | 'einheit'> & Partial<Pick<Stellschraube, 'optionen'>>, w: StellschraubeWert | undefined): string {
  if (w === null || w === undefined || w === '') return '—';
  if (s.art === 'schalter') return w === true ? 'an' : 'aus';
  if (s.art === 'stunde' && typeof w === 'number') return `ab ${w} Uhr`;
  if (s.art === 'wochentag' && typeof w === 'number') return WOCHENTAGE[((w % 7) + 7) % 7];
  if (s.art === 'auswahl' && typeof w === 'string') return s.optionen?.find(o => o.wert === w)?.text ?? w;
  if (Array.isArray(w)) return `${w.join(' · ')}${s.einheit ? ` ${s.einheit}` : ''}`;
  if (typeof w === 'number') return `${w.toLocaleString('de-DE')}${s.einheit ? ` ${s.einheit}` : ''}`;
  return String(w);
}

/**
 * Eine Eingabe lesen und prüfen (dieselben Grenzen, die der Server prüft — der Server bleibt die Wahrheit). Leer bei einer Stellschraube ohne Vorgabe = löschen
 * (`null`). Liefert den Wert oder einen Satz.
 */
export function eingabeLesen(s: Pick<Stellschraube, 'art' | 'min' | 'max' | 'name' | 'einheit' | 'vorgabe'> & Partial<Pick<Stellschraube, 'optionen'>>, roh: string | boolean): { ok: true; wert: StellschraubeWert } | { ok: false; fehler: string } {
  if (s.art === 'schalter') return typeof roh === 'boolean' ? { ok: true, wert: roh } : { ok: false, fehler: 'an oder aus.' };
  if (s.art === 'auswahl') {
    const o = s.optionen?.find(x => x.wert === roh);
    return o ? { ok: true, wert: o.wert } : { ok: false, fehler: `${s.name}: ${(s.optionen ?? []).map(x => x.text).join(', ') || 'keine Wahl'}.` };
  }
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
    // Restpunkte (24.10.): Feld, Wert und gelesener Stand — `null` = zurück auf die Vorgabe (der Server setzt sie ein).
    case 'scoring':
    case 'buchung':
    case 'head':
      return { url: WEITER_URL, method: 'POST', body: { weg: w, wert: neu } };
  }
}
