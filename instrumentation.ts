// ─── Next.js-Start-Haken (29.09., Paket D-A) ─────────────────────────────────
// Läuft einmal beim Start des Servers. Nur in der Node-Laufzeit (die Middleware läuft in der Edge-Laufzeit und hat
// keinen Datenordner): Start-Riegel (05.10., lib/zugang/start-riegel.ts — ohne Pflicht-Geheimnisse kein Start), dann
// Lockfile, Herzschlag und Abschalt-Handler der Datenschicht (lib/store/betrieb.ts).
// Genau diese Form (Import INNERHALB der Bedingung) lässt Next den Node-Teil aus dem Edge-Bündel entfernen —
// ein frühes `return` davor reicht nicht (der Edge-Bau scheitert sonst an fs/crypto).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Beim Bauen (`next build`, Docker-Bau ohne .env) nie prüfen — dort gibt es bewusst keine Geheimnisse.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      const { startRiegel } = await import('./lib/zugang/start-riegel-lauf');
      startRiegel();
    }
    const { betriebStarten } = await import('./lib/store/betrieb');
    await betriebStarten();
    // iCloud je Person (06.10.): der Zugang des Haushalts-Kalenders kann aus der Oberfläche kommen (verschlüsselter Bestand) —
    // einmal laden, damit `verbunden()` schon beim ersten Takt stimmt (lib/kalender/icloud-haupt.ts). Fehler stören nie.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      const { hauptZugangAuffrischen } = await import('./lib/kalender/icloud-person');
      await hauptZugangAuffrischen();
    }
  }
}
