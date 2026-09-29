// ─── Mandats-Review — eine Regel (F2 M1, 29.09.) ─────────────────────────────
// Eigenes Blatt ohne Importe: followup.ts und kalender/eintraege.ts lesen es beide (kein Kreis über kunden → team → followup).

/**
 * Zählt das Review eines Mandats? — die EINE Regel (F2 M1, 29.09.) für Follow-ups (`v:review`, lib/crm/followup.ts, führt
 * in Glocke/Heute/Power Hour) und die Kalender-Frist (`md-review`, nur Kalenderansicht): nur aktive Mandate; ein pausiertes
 * Mandat hat kein fälliges Review. Ohne Status (alte Quellen) gilt aktiv.
 */
export const reviewZaehlt = (m: { status?: string; naechstesReview?: string }): boolean => (m.status ?? 'aktiv') === 'aktiv' && !!m.naechstesReview;
