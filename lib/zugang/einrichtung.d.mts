export const EINRICHTUNG_STUNDEN: number;
export function einrichtungDatei(ordner: string): string;
export function codeNorm(c: unknown): string;
export function neuerCode(): string;
export function codeAblegen(ordner: string, stunden?: number, jetzt?: Date): Promise<{ code: string; bis: string }>;
export function codePruefen(ordner: string, eingabe: unknown, jetzt?: Date): Promise<'ok' | 'falsch' | 'fehlt' | 'abgelaufen'>;
export function codeVerbrauchen(ordner: string): Promise<void>;
