// ─── Navigation von einer fremden Seite zu einer Schnittstelle (rein, 03.10.2026) ─
// Eine Schnittstelle (/api/…) ist nie das Ziel einer Navigation von einer fremden Seite (26.09.): so kann kein fremder Link
// mit dem Cookie im Gepäck eine GET-Route mit Wirkung auslösen. Genau FÜNF Ausnahmen — die Rückrufe einer Anmeldung, zu denen
// der Anbieter den Browser selbst schickt (cross-site, navigate):
//   · Google (lib/google/verbindung.ts): `state` einmalig (15 Min.), PKCE, Rückruf gehört der Person, die ihn gestartet hat.
//   · Whoop/Microsoft 365 (app/api/oauth/callback, 03.10.): nur Inhaber, `state` wird einmalig eingelöst (lib/oauth.ts).
//     Ohne diese Ausnahme ließ sich seit 26.09. weder Whoop noch M365 neu verbinden (401 aus der Middleware). Seit 08.10. nur noch M365.
//   · WHOOP je Person (app/api/whoop/rueckruf, 08.10.): `state` einmalig (15 Min.), gehört der Person der Sitzung (lib/whoop/verbindung.ts).
//   · LinkedIn für Social (app/api/social/linkedin/rueckruf, 27.10.): `state` einmalig (15 Min.), gehört der Person der Sitzung und nennt
//     den Kanal (lib/social/anbieter/linkedin.ts).
//   · Instagram für Social (app/api/social/instagram/rueckruf, 28.10.): dieselbe Form (lib/social/anbieter/instagram.ts).

export const GOOGLE_RUECKRUF = /^\/api\/google\/rueckruf$/;
export const OAUTH_RUECKRUF = /^\/api\/oauth\/callback$/;
export const WHOOP_RUECKRUF = /^\/api\/whoop\/rueckruf$/;
export const LINKEDIN_RUECKRUF = /^\/api\/social\/linkedin\/rueckruf$/;
export const INSTAGRAM_RUECKRUF = /^\/api\/social\/instagram\/rueckruf$/;

export function crossSiteVerboten(pfad: string, kopf: { get(n: string): string | null }): boolean {
  if (!pfad.startsWith('/api/')) return false;
  if (GOOGLE_RUECKRUF.test(pfad) || OAUTH_RUECKRUF.test(pfad) || WHOOP_RUECKRUF.test(pfad) || LINKEDIN_RUECKRUF.test(pfad) || INSTAGRAM_RUECKRUF.test(pfad)) return false;
  return kopf.get('sec-fetch-site') === 'cross-site' && kopf.get('sec-fetch-mode') === 'navigate';
}
