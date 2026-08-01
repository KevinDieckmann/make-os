// ─── MAKE OS — Netzwerk & Pipeline ──────────────────────────────────────────
// Kevins und Malins eigenes Netzwerk. Nicht das KEMARIS-CRM, sondern das,
// was ihnen persönlich gehört: wen wir kennen, was daraus werden kann, und
// wo etwas hinten runterfällt.
//
// Der Geldhebel liegt nicht im Erfassen, sondern im Nachhalten — deshalb
// rechnet diese Datei vor allem aus, was liegen geblieben ist.
//
// Client-safe: keine Server-Importe.

export type Naehe = 'eng' | 'warm' | 'kalt';
export type Stufe = 'kontakt' | 'gespraech' | 'angebot' | 'verhandlung' | 'gewonnen' | 'verloren';

export interface Kontakt {
  id: string;
  name: string;
  firma?: string;
  rolle?: string;
  email?: string;
  telefon?: string;
  /** Wie nah wir uns stehen — bestimmt, wie oft man sich melden sollte. */
  naehe: Naehe;
  /** Woher wir uns kennen. */
  quelle?: string;
  /** Was wir über ihn wissen — hier landet auch Eingesprochenes. */
  notizen?: string;
  /** YYYY-MM-DD des letzten echten Kontakts. */
  letzterKontakt?: string;
  /** Wer von uns beiden die Beziehung hält. */
  besitzer: 'kevin' | 'malin' | 'beide';
  stichworte?: string[];
}

export interface Chance {
  id: string;
  kontaktId: string;
  titel: string;
  stufe: Stufe;
  /** Erwarteter Wert in €. */
  wert?: number;
  /** Was als Nächstes passieren muss. */
  naechsterSchritt?: string;
  /** Wann — ohne Datum verliert sich jede Chance. */
  faellig?: string;
  notiz?: string;
}

export const NAEHE_META: Record<Naehe, { label: string; farbe: string; /** Tage, nach denen man sich wieder melden sollte. */ takt: number }> = {
  eng: { label: 'eng', farbe: '#21B5AA', takt: 30 },
  warm: { label: 'warm', farbe: '#4A6CF7', takt: 90 },
  kalt: { label: 'lose', farbe: '#8A9BA8', takt: 180 },
};

export const STUFEN: { id: Stufe; label: string; farbe: string; /** Grobe Abschluss-Wahrscheinlichkeit. */ quote: number }[] = [
  { id: 'kontakt', label: 'Erstkontakt', farbe: '#8A9BA8', quote: 0.1 },
  { id: 'gespraech', label: 'Im Gespräch', farbe: '#4A6CF7', quote: 0.3 },
  { id: 'angebot', label: 'Angebot', farbe: '#DE9E63', quote: 0.5 },
  { id: 'verhandlung', label: 'Verhandlung', farbe: '#21B5AA', quote: 0.8 },
  { id: 'gewonnen', label: 'Gewonnen', farbe: '#21B5AA', quote: 1 },
  { id: 'verloren', label: 'Verloren', farbe: '#5A6B66', quote: 0 },
];
export const STUFE = Object.fromEntries(STUFEN.map(s => [s.id, s])) as Record<Stufe, typeof STUFEN[number]>;
export const OFFENE_STUFEN: Stufe[] = ['kontakt', 'gespraech', 'angebot', 'verhandlung'];

/** Gewichteter Pipeline-Wert: Summe aus Wert × Wahrscheinlichkeit der Stufe. */
export function pipelineWert(chancen: Chance[]): { roh: number; gewichtet: number; anzahl: number } {
  const offen = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  return {
    roh: offen.reduce((s, c) => s + (c.wert ?? 0), 0),
    gewichtet: Math.round(offen.reduce((s, c) => s + (c.wert ?? 0) * STUFE[c.stufe].quote, 0)),
    anzahl: offen.length,
  };
}

export interface Liegenblieber {
  art: 'stumm' | 'ohne-schritt' | 'schritt-faellig';
  kontaktId: string;
  chanceId?: string;
  text: string;
  /** Je höher, desto dringender. */
  gewicht: number;
}

/**
 * Was hinten runterfällt — der eigentliche Zweck des ganzen Moduls.
 * Drei Arten: zu lange still, Chance ohne nächsten Schritt, Schritt überfällig.
 */
export function liegenGeblieben(kontakte: Kontakt[], chancen: Chance[], heute: string): Liegenblieber[] {
  const raus: Liegenblieber[] = [];
  const tageSeit = (d?: string) => {
    if (!d) return null;
    const ms = Date.parse(`${heute}T00:00:00`) - Date.parse(`${d}T00:00:00`);
    return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
  };

  for (const k of kontakte) {
    const tage = tageSeit(k.letzterKontakt);
    const takt = NAEHE_META[k.naehe].takt;
    if (tage != null && tage > takt) {
      raus.push({
        art: 'stumm', kontaktId: k.id,
        text: `${k.name}: seit ${tage} Tagen nichts gehört (${NAEHE_META[k.naehe].label}er Kontakt — Takt wären ${takt} Tage)`,
        gewicht: (tage - takt) * (k.naehe === 'eng' ? 3 : k.naehe === 'warm' ? 2 : 1),
      });
    }
  }

  for (const c of chancen) {
    if (!OFFENE_STUFEN.includes(c.stufe)) continue;
    const k = kontakte.find(x => x.id === c.kontaktId);
    const name = k?.name ?? 'Unbekannt';
    if (!c.naechsterSchritt?.trim()) {
      raus.push({
        art: 'ohne-schritt', kontaktId: c.kontaktId, chanceId: c.id,
        text: `${c.titel} (${name}): kein nächster Schritt festgelegt — ${c.wert ? `${c.wert} € ` : ''}liegen ohne Plan herum`,
        gewicht: 200 + (c.wert ?? 0) / 100,
      });
    } else if (c.faellig && c.faellig < heute) {
      const tage = tageSeit(c.faellig) ?? 0;
      raus.push({
        art: 'schritt-faellig', kontaktId: c.kontaktId, chanceId: c.id,
        text: `${c.titel} (${name}): „${c.naechsterSchritt}" war vor ${tage} Tagen fällig`,
        gewicht: 300 + tage * 5,
      });
    }
  }

  return raus.sort((a, b) => b.gewicht - a.gewicht);
}
