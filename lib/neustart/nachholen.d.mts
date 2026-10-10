// Typen zu lib/neustart/nachholen.mjs (Nachholen einzelner Business-Bestände aus dem Archiv, 09.10.2026 spät).

export const NACHHOLBAR: readonly { name: string; art: 'head'; grund: string }[];
export const NICHT_NACHHOLBAR: readonly { muster: string; grund: string }[];
export function nachholenGrund(name: unknown): string | null;
export function nachholenPruefen(namen: unknown): string[];
export function headStandFiltern(stand: unknown): Record<string, unknown> & { berichte: unknown[]; vorschlaege: Record<string, unknown>[]; letzte: Record<string, string>; versuche: Record<string, string>; gedaechtnis?: Record<string, unknown>[]; autonomie?: 'intern' | 'aus' };
export function headStandZusammenfuehren(ziel: unknown, archiv: unknown): { wert: Record<string, unknown>; neu: number };
export function headZaehler(stand: unknown): { merksaetze: number; entschieden: number; offen: number; berichte: number; autonomie: 'intern' | 'aus' | null };
