// ─── Navigation von einer fremden Seite zu einer Schnittstelle (rein, 03.10.2026) ─
// Eine Schnittstelle (/api/…) ist nie das Ziel einer Navigation von einer fremden Seite (26.09.): so kann kein fremder Link
// mit dem Cookie im Gepäck eine GET-Route mit Wirkung auslösen. Genau DREI Ausnahmen — die Rückrufe einer Anmeldung, zu denen
// der Anbieter den Browser selbst schickt (cross-site, navigate):
//   · Google (lib/google/verbindung.ts): `state` einmalig (15 Min.), PKCE, Rückruf gehört der Person, die ihn gestartet hat.
//   · Whoop/Microsoft 365 (app/api/oauth/callback, 03.10.): nur Inhaber, `state` wird einmalig eingelöst (lib/oauth.ts).
//     Ohne diese Ausnahme ließ sich seit 26.09. weder Whoop noch M365 neu verbinden (401 aus der Middleware). Seit 08.10. nur noch M365.
//   · WHOOP je Person (app/api/whoop/rueckruf, 08.10.): `state` einmalig (15 Min.), gehört der Person der Sitzung (lib/whoop/verbindung.ts).

export const GOOGLE_RUECKRUF = /^\/api\/google\/rueckruf$/;
export const OAUTH_RUECKRUF = /^\/api\/oauth\/callback$/;
export const WHOOP_RUECKRUF = /^\/api\/whoop\/rueckruf$/;

export function crossSiteVerboten(pfad: string, kopf: { get(n: string): string | null }): boolean {
  if (!pfad.startsWith('/api/')) return false;
  if (GOOGLE_RUECKRUF.test(pfad) || OAUTH_RUECKRUF.test(pfad) || WHOOP_RUECKRUF.test(pfad)) return false;
  return kopf.get('sec-fetch-site') === 'cross-site' && kopf.get('sec-fetch-mode') === 'navigate';
}
