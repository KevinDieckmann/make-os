export interface SchreiberEintrag { pid: number; host: string; start: string; herz: string; art: string }
export const SCHREIBER_DATEI: '.schreiber';
export const HERZ_MS: number;
export const LEBT_MS: number;
export function schreiberLesen(ordner: string): Promise<SchreiberEintrag | null>;
export function schreiberLebt(e: SchreiberEintrag | null, jetzt?: number, host?: string): boolean;
export function istEigener(e: SchreiberEintrag | null): boolean;
export function schreiberSetzen(ordner: string, art?: string): Promise<{ fremd: SchreiberEintrag | null }>;
export function schreiberHerz(ordner: string, start: string, art?: string): Promise<{ fremd: SchreiberEintrag | null }>;
export function schreiberEntfernenSync(ordner: string): void;
export function skriptSperreOderAbbruch(ordner: string, was?: string): Promise<void>;
