/** Verzeichnis-fsync; schluckt nur EINVAL/ENOTSUP/EOPNOTSUPP. */
export function ordnerSync(ordner: string): Promise<void>;
/** Temp-Name im Zielordner (`<pfad>.<pid>.<zufall>.tmp`). */
export function tmpName(pfad: string): string;
/** open → write → fsync → close → rename → Ordner-fsync. Vorgabe-Rechte 0600. */
export function atomarSchreiben(pfad: string, daten: string | Uint8Array, opt?: { modus?: number }): Promise<void>;
/** Byte-genaue Kopie, atomar und dauerhaft. */
export function atomarKopieren(quelle: string, ziel: string, opt?: { modus?: number }): Promise<void>;
