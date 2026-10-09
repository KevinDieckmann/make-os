// ─── Gesundheit — Belastung (Strain) im Verhältnis zur Tagesform (rein, getestet, 09.10.2026) ────────────────────────────
// Kevin 09.10.: „Strain wird nicht angezeigt“ → Strain als eigener Ring neben Recovery und Schlaf, mit Ampel nach der Tagesform.
// Strain ist WHOOPs Maß der Tagesbelastung auf einer Skala 0–21 (Zyklus `score.strain`, https://developer.whoop.com/api).
//
// Der Rahmen je Recovery-Zone ist eine EIGENE Regel (Annahme — WHOOPs „Strain Coach“-Ziel gibt die API nicht heraus):
//   Recovery grün (≥ 66) → Rahmen 14–18 · gelb (40–65) → 10–14 · rot (< 40) → bis 10.
// Ampel: bis zur Obergrenze „gut“ (darunter heißt: noch Spielraum), bis 2 Punkte darüber „achtung“, mehr „kritisch“ — die Skala ist nicht
// linear, 2 Punkte oben sind viel. Ohne Recovery gibt es keinen Rahmen und keine Ampel („offen“). Struktur und Tracking, keine
// Trainings- oder ärztliche Beratung. Client- und server-sicher (keine Bestände, kein Netz).

/** Höchster Strain-Wert der Skala. */
export const STRAIN_MAX = 21;
/** Dieselben Recovery-Schwellen wie `zoneOf` (lib/vitals.ts) — Test hält beide gleich. */
export const REC_GRUEN = 66;
export const REC_GELB = 40;
/** Wie weit über der Obergrenze noch „achtung“ statt „kritisch“ gilt (Strain-Punkte). */
export const STRAIN_TOLERANZ = 2;

export type RecZone = 'gruen' | 'gelb' | 'rot';
export interface StrainRahmen { zone: RecZone; von: number; bis: number }
export const STRAIN_RAHMEN: Readonly<Record<RecZone, { von: number; bis: number }>> = {
  gruen: { von: 14, bis: 18 },
  gelb: { von: 10, bis: 14 },
  rot: { von: 0, bis: 10 },
};

export type BelastungAmpel = 'gut' | 'achtung' | 'kritisch' | 'offen';
export interface BelastungLage {
  ampel: BelastungAmpel;
  /** Rahmen der Tagesform — fehlt ohne Recovery. */
  rahmen?: StrainRahmen;
  /** Kurzer Satz für die Oberfläche (ohne Zahl der Recovery — die steht im eigenen Ring). */
  text: string;
  /** Kurzes Etikett unter dem Ring („im Rahmen“, „Spielraum“, „drüber“). */
  kurz: string;
}

const zahlOk = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const de = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Recovery-Zone aus dem Wert (keine Angabe = null — nie aus einer erfundenen Zahl). */
export function recZone(rec?: number): RecZone | null {
  if (!zahlOk(rec) || rec <= 0) return null;
  return rec >= REC_GRUEN ? 'gruen' : rec >= REC_GELB ? 'gelb' : 'rot';
}

/** Strain-Rahmen für eine Recovery (Annahme, siehe Kopf). */
export function strainRahmen(rec?: number): StrainRahmen | null {
  const z = recZone(rec);
  return z ? { zone: z, ...STRAIN_RAHMEN[z] } : null;
}

const rahmenText = (r: StrainRahmen) => (r.von > 0 ? `${r.von}–${r.bis}` : `bis ${r.bis}`);

/**
 * Wie steht die Belastung des Tages zur Tagesform? null = kein Strain-Wert (nie eine Null zeigen).
 * Beispiele: Recovery grün + Strain 8 → „gut · Spielraum“; Recovery rot + Strain 13 → „kritisch“.
 */
export function belastungLage(strain?: number, rec?: number): BelastungLage | null {
  if (!zahlOk(strain) || strain < 0) return null;
  const s = Math.min(STRAIN_MAX, strain);
  const r = strainRahmen(rec);
  if (!r) return { ampel: 'offen', kurz: 'ohne Rahmen', text: `Belastung ${de(s)} von ${STRAIN_MAX} — ohne Recovery gibt es keinen Rahmen für heute.` };
  const rt = `Rahmen heute ${rahmenText(r)}`;
  if (s <= r.bis) {
    const spielraum = s < r.von;
    return { ampel: 'gut', rahmen: r, kurz: spielraum ? 'Spielraum' : 'im Rahmen', text: spielraum ? `Noch Spielraum für Belastung (${rt}).` : `Belastung im Rahmen (${rt}).` };
  }
  if (s <= r.bis + STRAIN_TOLERANZ) return { ampel: 'achtung', rahmen: r, kurz: 'drüber', text: `Belastung über dem Rahmen (${rt}) — Erholung einplanen.` };
  return { ampel: 'kritisch', rahmen: r, kurz: 'deutlich drüber', text: `Belastung deutlich über dem Rahmen (${rt}) — heute Erholung zuerst.` };
}

/**
 * Für den Gesundheits-Index (Kennzahl „Belastung zur Tagesform“): Anteil der Tage mit Strain UND Recovery, an denen der Strain nicht über
 * der Obergrenze des Rahmens lag. null bei weniger als `min` solchen Tagen.
 */
export function belastungQuote(tage: readonly { strain?: number; rec?: number }[], min = 3): { quote: number; tage: number; drueber: number } | null {
  const mit = tage.filter(t => zahlOk(t.strain) && strainRahmen(t.rec));
  if (mit.length < min) return null;
  const drueber = mit.filter(t => (t.strain as number) > strainRahmen(t.rec)!.bis).length;
  return { quote: (mit.length - drueber) / mit.length, tage: mit.length, drueber };
}
