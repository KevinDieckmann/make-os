// ─── Next.js-Start-Haken (29.09., Paket D-A) ─────────────────────────────────
// Läuft einmal beim Start des Servers. Nur in der Node-Laufzeit (die Middleware läuft in der Edge-Laufzeit und hat
// keinen Datenordner): Lockfile, Herzschlag und Abschalt-Handler der Datenschicht (lib/store/betrieb.ts).
// Genau diese Form (Import INNERHALB der Bedingung) lässt Next den Node-Teil aus dem Edge-Bündel entfernen —
// ein frühes `return` davor reicht nicht (der Edge-Bau scheitert sonst an fs/crypto).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { betriebStarten } = await import('./lib/store/betrieb');
    await betriebStarten();
  }
}
