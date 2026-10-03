// ─── Navigation von einer fremden Seite zu einer Schnittstelle (rein, 03.10.2026) ─
// Eine Schnittstelle (/api/…) ist nie das Ziel einer Navigation von einer fremden Seite (26.09.): so kann kein fremder Link
// mit dem Cookie im Gepäck eine GET-Route mit Wirkung auslösen. Genau EINE Ausnahme: der Rückruf der Google-Anmeldung —
// Google leitet den Browser selbst dorthin (cross-site, navigate). Die Sitzung gilt trotzdem, und die Route prüft `state`
// (einmalig, 15 Min.), PKCE und dass der Rückruf der Person gehört, die ihn gestartet hat (lib/google/verbindung.ts).

export const GOOGLE_RUECKRUF = /^\/api\/google\/rueckruf$/;

export function crossSiteVerboten(pfad: string, kopf: { get(n: string): string | null }): boolean {
  if (!pfad.startsWith('/api/')) return false;
  if (GOOGLE_RUECKRUF.test(pfad)) return false;
  return kopf.get('sec-fetch-site') === 'cross-site' && kopf.get('sec-fetch-mode') === 'navigate';
}
