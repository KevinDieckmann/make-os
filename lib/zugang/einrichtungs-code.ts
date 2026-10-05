// ─── Einrichtungs-Code (App-Seite) — die Regel steht in einrichtung.mjs (auch fürs Skript) ─────────────────
import { datenOrdner } from '@/lib/store/local-db';
import { codePruefen, codeVerbrauchen } from './einrichtung.mjs';

export const einrichtungsCodePruefen = (eingabe: unknown, jetzt = new Date()) => codePruefen(datenOrdner(), eingabe, jetzt);
export const einrichtungsCodeVerbrauchen = () => codeVerbrauchen(datenOrdner());
