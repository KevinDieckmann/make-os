// ─── Test-Fixture: WÖRTLICH aus dem Stand c9c65695 (vor „Brain-/Vault-Sicht ohne feste Personen“, 09.10.) ──────────────────
// Nicht ändern — tests/vault-sicht.test.ts prüft damit den Altbestand (Gold-Vergleich): mit den gewachsenen Speichernamen als
// Konten liefert die neue Sicht aus den Konten GENAU dasselbe wie diese Funktionen mit festen Namen. Die Quellen:
//   `git show c9c65695:lib/zoe/vault.ts`        → darfSehen, AGENT, istPrivat (+ GEMEINSAM), anhaengenErlaubt
//   `git show c9c65695:lib/brain/inbox.ts`      → darfVorschlagSehen, vertr, Eigentümer beim Annehmen, gilt_fuer beim Lesen
//   `git show c9c65695:lib/brain/regeln.ts`     → gilt, owner-Rückfall in regelAus, Filter in regelnBlock
// Nur die Namen tragen den Zusatz „Alt“, und die Typen stehen hier (sonst nichts geändert).

export interface Sicht { person: string; agent?: boolean }
/** Ohne Person (Hintergrundlauf eines Agenten): nie Privates. */
export const AGENT_ALT: Sicht = { person: 'kevin', agent: true };

export function darfSehenAlt(n: { scope?: string; owner?: string }, s: Sicht): boolean {
  const scope = n.scope || 'intern';           // ohne Kennzeichnung mindestens intern
  if (s.agent && scope === 'privat') return false;
  // Symmetrisch (29.09., #92): Privates sieht NUR, wem es gehört — auch Kevin nicht Malins. Ohne owner: Kevins Vault.
  if (scope === 'privat') return (n.owner || 'kevin') === s.person;
  if (s.person === 'kevin' || s.person === 'malin') return true;
  return scope === 'familie' || scope === 'oeffentlich';
}

const GEMEINSAM = [/malin[_\s]*(&|und)?[_\s]*kevin[_\s]*brain/i, /malin\s*(&|und)\s*kevin/i];
export function istPrivatAlt(segment: string): boolean {
  const s = segment.toLowerCase();
  if (!/malin/.test(s)) return false;
  return !GEMEINSAM.some(r => r.test(segment));
}

export function anhaengenErlaubtAlt(k: { scope?: string; owner?: string }, person: string, scope?: 'intern' | 'privat'): boolean {
  if (!darfSehenAlt(k, { person })) return false;
  if (scope === 'privat') return (k.scope || 'intern') === 'privat' && (k.owner || 'kevin') === person;
  return true;
}

// lib/brain/inbox.ts
export type VertraulichkeitAlt = 'gemeinsam' | 'privat-kevin' | 'privat-malin';
export const vertrAlt = (v: unknown): VertraulichkeitAlt => ((['gemeinsam', 'privat-kevin', 'privat-malin'] as const).includes(String(v) as VertraulichkeitAlt) ? (String(v) as VertraulichkeitAlt) : 'gemeinsam');
export function darfVorschlagSehenAlt(v: { vertraulichkeit: string }, sicht: Sicht): boolean {
  if (sicht.agent) return v.vertraulichkeit === 'gemeinsam';
  if (v.vertraulichkeit === 'gemeinsam') return sicht.person === 'kevin' || sicht.person === 'malin';
  return v.vertraulichkeit === `privat-${sicht.person}`;
}
/** Aus `vorschlagAnnehmen`: Scope und Eigentümer der neuen Notiz. */
export const annehmenZielAlt = (vertraulichkeit: string) => ({
  scope: vertraulichkeit === 'gemeinsam' ? 'intern' : 'privat',
  owner: vertraulichkeit === 'privat-malin' ? 'malin' : 'kevin',
});
/** Aus `vorschlagAus`: gilt_fuer eines Vorschlags. */
export const vorschlagGiltAlt = (v: unknown) => ((['kevin', 'malin', 'beide', 'zoe'] as const).includes(String(v) as 'kevin') ? String(v) : undefined);

// lib/brain/regeln.ts
export type GiltFuerAlt = 'kevin' | 'malin' | 'beide' | 'zoe';
export const giltAlt = (v: unknown): GiltFuerAlt => ((['kevin', 'malin', 'beide', 'zoe'] as const).includes(String(v) as GiltFuerAlt) ? (String(v) as GiltFuerAlt) : 'beide');
/** Aus `regelAus`: Eigentümer einer Regel ohne `owner`. */
export const regelOwnerAlt = (owner?: string) => owner ?? 'kevin';
/** Aus `regelnBlock`: gilt die (freigegebene) Regel für diese Person? */
export const regelPasstAlt = (giltFuer: GiltFuerAlt, person: string) => giltFuer === 'beide' || giltFuer === 'zoe' || giltFuer === person;
