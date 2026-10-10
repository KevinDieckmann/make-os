// ─── Fulfillment · Analyse — Quellen und gesperrte Domains (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.5/4.8) — rein ───────────────────────────
// Jede Aussage im Dossier trägt eine Quelle (URL oder Unterlage) und ein Abrufdatum. Einige Quellen nutzen Agenten NIE automatisch:
// LinkedIn und XING (Nutzungsbedingungen verbieten automatisiertes Sammeln), Handels-/Unternehmensregister (kein Massenabruf, § 9a HGB —
// ein Mensch legt den Auszug als PDF ab), Transparenzregister (berechtigtes Interesse nötig — nie), Insolvenzbekanntmachungen (Daten natürlicher
// Personen). `web_lesen` lehnt sie ab, der Such-Schritt verwirft sie, die Prüfung meldet sie. Rein und client-sicher.

/** Domains, die kein Agent liest oder als Quelle nennt (auch nicht ihre Subdomains). */
export const GESPERRTE_DOMAINS: readonly string[] = [
  'linkedin.com', 'xing.com', 'handelsregister.de', 'unternehmensregister.de', 'transparenzregister.de', 'insolvenzbekanntmachungen.de',
];

/** Hostname einer Adresse (klein, ohne `www.`) — null, wenn keine gültige http(s)-Adresse. */
export function hostVon(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase().replace(/\.$/, '');
  } catch { return null; }
}

/** Domain ohne `www.` für Anzeige und Vergleich. */
export const domainVon = (url: string): string | null => hostVon(url)?.replace(/^www\./, '') ?? null;

/** Liegt der Host auf der Domain oder einer Subdomain davon? */
export function hostPasst(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, ''), d = domain.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return !!d && (h === d || h.endsWith(`.${d}`));
}

/** Ist diese Adresse (bzw. dieser Host) gesperrt? */
export function istGesperrt(urlOderHost: string): boolean {
  const host = urlOderHost.includes('://') ? hostVon(urlOderHost) : urlOderHost.toLowerCase();
  if (!host) return true;
  return GESPERRTE_DOMAINS.some(d => hostPasst(host, d));
}

/** Eine Domain-Angabe aus den Eingaben säubern („https://www.beispiel.de/“ → „beispiel.de“) — null, wenn keine. */
export function domainSaeubern(roh: string): string | null {
  const t = String(roh ?? '').trim().toLowerCase();
  if (!t) return null;
  const host = t.includes('://') ? hostVon(t) : hostVon(`https://${t.replace(/\/.*$/, '')}`);
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || host.length > 120) return null;
  return host.replace(/^www\./, '');
}

/** Eine Adresse normalisiert (ohne Fragment, Host klein) — für den Vergleich „steht in der Erlaubnis“. */
export function urlNormal(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return null; }
}
