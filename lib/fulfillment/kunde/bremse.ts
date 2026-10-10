// ─── Fulfillment · Kunde — Bremse je Kunden-Link (nur Server; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4) ───────────────────────────────────────────
// Neben der Drossel je Netz (lib/zugang/drossel.ts: `kunde-lesen:<netz>` großzügig, `kunde:<netz>` für Fehlgriffe) gilt je Link ein festes Budget:
// Formular 120 je Stunde, Upload 30 je Stunde, Puls 5 je Tag. Gleitendes Fenster im Speicher des einen App-Prozesses (wie die Drossel) —
// nach einem Neustart beginnt niemand gesperrt. Darüber: 429 mit „Retry-After“.

export const BREMSE = {
  formular: { max: 120, fensterMs: 3_600_000 },
  upload: { max: 30, fensterMs: 3_600_000 },
  puls: { max: 5, fensterMs: 24 * 3_600_000 },
} as const;
export type BremsArt = keyof typeof BREMSE;

const zeiten = new Map<string, number[]>();

/** Darf dieser Link das jetzt noch? Ja → gezählt. Nein → Wartezeit in Sekunden. */
export function bremse(art: BremsArt, linkId: string, jetzt = Date.now()): { erlaubt: true } | { erlaubt: false; warteSek: number } {
  const { max, fensterMs } = BREMSE[art];
  const k = `${art}:${linkId}`;
  const liste = (zeiten.get(k) ?? []).filter(t => jetzt - t < fensterMs);
  if (liste.length >= max) { zeiten.set(k, liste); return { erlaubt: false, warteSek: Math.max(1, Math.ceil((liste[0] + fensterMs - jetzt) / 1000)) }; }
  liste.push(jetzt);
  zeiten.set(k, liste);
  if (zeiten.size > 5000) for (const [s, l] of Array.from(zeiten.entries())) if (!l.some(t => jetzt - t < BREMSE[s.split(':')[0] as BremsArt]?.fensterMs)) zeiten.delete(s);
  return { erlaubt: true };
}

/** Nur für Tests. */
export function _bremseZuruecksetzen(): void { zeiten.clear(); }
