'use client';

// ─── Markttraktion · Visitenkarte → Kontakt (Platzhalter, wird gebaut) ──────
export interface VisitenkartenDaten { vorname?: string; nachname?: string; firma?: string; position?: string; email?: string; telefon?: string; linkedin?: string; webseite?: string }
export function VisitenkarteKnopf(_: { onErkannt: (d: VisitenkartenDaten) => void }) { return null; }
