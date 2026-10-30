// ─── Kalender → Space (26.09.) — client-sicher, keine Server-Importe ────────
// Welcher Kalender zu welchem Space gehört: die Zuordnung aus den Kalender-
// Einstellungen, sonst KEMARIS/Arbeit („Kevin Dieckmann“, „Work“) = Business, sonst Privat.
export function spaceVonKalender(e: object | null | undefined, kalenderName: string): 'privat' | 'business' {
  const n = kalenderName.trim();
  const fest = (e as { space?: Record<string, 'privat' | 'business'> } | null | undefined)?.space?.[n];
  if (fest) return fest;
  // Google (03.10.): der Google-Kalender der Person ist der MAKE-/Business-Kalender.
  if ((e as { google?: Record<string, string> } | null | undefined)?.google?.[n]) return 'business';
  // Weitere Google-Konten (30.10.): Arbeitskalender anderer Firmen — Business (auch der neutrale Name „Weitere Termine · <Vorname>“).
  if ((e as { zusatz?: Record<string, string> } | null | undefined)?.zusatz?.[n]) return 'business';
  return /kemaris|m365|dieckmann|work|arbeit|business|consulting|ventures/i.test(n) ? 'business' : 'privat';
}
