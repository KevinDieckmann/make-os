// Minimale Typen für node:sqlite (Node 22.13+, ohne Flag) — @types/node 20 kennt das Modul noch nicht.
// Nur, was lib/brain/index.ts benutzt. Beim Wechsel auf @types/node ≥ 22.13 kann diese Datei weg.
declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean; enableForeignKeyConstraints?: boolean; allowExtension?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    open(): void;
  }
}
