// ─── Next.js-Start-Haken (29.09., Paket D-A) ─────────────────────────────────
// Läuft einmal beim Start des Servers. Nur in der Node-Laufzeit (die Middleware läuft in
// der Edge-Laufzeit und hat keinen Datenordner): Lockfile, Herzschlag und Abschalt-Handler
// der Datenschicht (lib/store/betrieb.ts).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { betriebStarten } = await import('./lib/store/betrieb');
  await betriebStarten();
}
