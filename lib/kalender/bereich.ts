// ─── Kalender — Bereich eines neuen Termins (rein, client-sicher, 03.10.2026) ─
// Wohin ein neuer Termin gehört: Business/MAKE (Google Kalender der Person), Privat oder Gemeinsam (iCloud).
// Die Entscheidung trifft der Server (lib/kalender/google/ziel.ts `kalenderZiel`); hier nur der Wertebereich.
export type KalenderBereich = 'business' | 'privat' | 'gemeinsam';
export const istBereich = (v: unknown): v is KalenderBereich => v === 'business' || v === 'privat' || v === 'gemeinsam';
