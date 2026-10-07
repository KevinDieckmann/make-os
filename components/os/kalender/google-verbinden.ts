// ─── Kalender — Google verbinden: EIN Weg für Einstellungen und Business-Karte (Browser, 06.10.2026) ─
// Vorher steckte das Starten der Google-Anmeldung nur in GoogleVerbindung.tsx (Einstellungen). Seit 06.10. startet auch die Karte
// „<Firma> verbinden“ im Business-Kalender (VerbindenKarten.tsx) denselben Weg — deshalb hier gemeinsam: Stand lesen, Anmeldung
// starten (POST /api/google/verbinden mit der Funktion `kalender` → Google → /api/google/rueckruf → /os/kalender?google=…),
// Texte der Rückkehr. Nie Tokens im Browser.

/** Stand der eigenen Google-Kalender-Verbindung (GET /api/kalender/google) — `liste`: zusätzlich die wählbaren Kalender. */
export async function googleKalenderStandLaden<T>(liste = false): Promise<T | null> {
  return fetch(`/api/kalender/google${liste ? '?liste=1' : ''}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() as Promise<T> : null)).catch(() => null);
}

/**
 * Die Google-Anmeldung für den Kalender starten: bei Erfolg leitet der Browser zu Google (und kommt mit `?google=…` zurück),
 * sonst der Fehlertext (z. B. „noch nicht eingerichtet“).
 */
export async function googleKalenderVerbinden(): Promise<{ fehler: string } | null> {
  const r = await fetch('/api/google/verbinden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funktionen: ['kalender'] }) })
    .then(async x => (await x.json().catch(() => ({}))) as { ok?: boolean; url?: unknown; fehler?: string })
    .catch(() => ({ ok: false, fehler: 'Keine Verbindung.' } as { ok?: boolean; url?: unknown; fehler?: string }));
  if (r.ok && typeof r.url === 'string') { window.location.href = r.url; return null; }
  return { fehler: r.fehler ?? 'Google ließ sich nicht starten.' };
}

/** Texte nach der Rückkehr von Google (`?google=<status>`). */
export const GOOGLE_HINWEISE: Record<string, { text: string; achtung?: boolean }> = {
  verbunden: { text: 'Google ist verbunden — der erste Abgleich läuft.' },
  abgebrochen: { text: 'Die Anmeldung bei Google wurde abgebrochen.', achtung: true },
  domain: { text: 'Dieses Google-Konto gehört nicht zur erlaubten Domain — bitte mit dem Workspace-Konto anmelden.', achtung: true },
  'scope-fehlt': { text: 'Bei Google fehlt eine Freigabe — bitte noch einmal verbinden und alle Häkchen lassen.', achtung: true },
  state: { text: 'Die Anmeldung war abgelaufen — bitte noch einmal starten.', achtung: true },
  person: { text: 'Diese Anmeldung gehörte einer anderen Person.', achtung: true },
  token: { text: 'Google hat die Anmeldung nicht angenommen — bitte noch einmal versuchen.', achtung: true },
  fehler: { text: 'Die Verbindung zu Google ließ sich nicht abschließen.', achtung: true },
};

/** Text, wenn auf dem Server die Google-Anwendung fehlt. */
export const GOOGLE_NICHT_EINGERICHTET = 'Noch nicht eingerichtet: Auf dem Server fehlen die Zugangsdaten der Google-Anwendung (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). Schritt für Schritt: GOOGLE_KALENDER_EINRICHTEN.md.';
