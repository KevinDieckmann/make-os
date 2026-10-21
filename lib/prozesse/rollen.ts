// ─── Prozesse — Rollen: wer baut, veröffentlicht, schaltet scharf, als wer läuft (Etappe B1, 21.10.; ANALYSE_100.md Punkte 10, 68) ──────────────────
// Vier Rollen sauber getrennt (Kevin 21.10.):
//   sehen            jedes Konto im Haushalt des Inhabers (Prozesse sind Business — ein Konto „nur Business“ sieht sie)
//   Entwurf bauen    volle Mitglieder UND Konten „nur Business“ (Team) — ein Entwurf läuft nie
//   veröffentlichen, Status (Probelauf/aktiv/pausiert/archiviert), Webhook (Schlüssel, scharf)   nur volle Mitglieder (Inhaber bzw. ohne `finanzRecht: 'business'`)
//   als wer läuft    eine benannte Person mit Konto (`laeuftAls`, sonst der Eigner, wenn er ein Konto hat) — nie Rückfall auf den Inhaber (Regel 5)
// Personen nur aus dem Team (`teamVon`) bzw. den Konten — nie Namen im Code. Der Dienstweg (Takt, ZOE, Skripte) schreibt hier nie.
// Rein und client-sicher; die Konto-Sicht liefert der Server (lib/zugang/konto-sicht.ts). Tests: tests/prozesse-versionen.test.ts.

import type { ProzessDefinition } from './definition';

/** Was die Rolle über eine Person wissen muss (aus `KontoSicht`). */
export interface RollenSicht { imHaushalt: boolean; vollesMitglied: boolean; inhaber: boolean; nurBusiness: boolean; dienst?: boolean }
export interface ProzessRechte { sehen: boolean; entwurf: boolean; veroeffentlichen: boolean; status: boolean; webhook: boolean }
export const KEINE_RECHTE: ProzessRechte = { sehen: false, entwurf: false, veroeffentlichen: false, status: false, webhook: false };

/** Die Rechte einer Person (rein). Dienstweg: nur sehen. */
export function prozessRechte(s: RollenSicht | null | undefined): ProzessRechte {
  if (!s?.imHaushalt) return KEINE_RECHTE;
  if (s.dienst) return { ...KEINE_RECHTE, sehen: true };
  const voll = s.inhaber || s.vollesMitglied;
  return { sehen: true, entwurf: voll || s.nurBusiness, veroeffentlichen: voll, status: voll, webhook: voll };
}

/** Sätze der Sperren (eine Stelle, überall gleich). */
export const NUR_VOLLE_MITGLIEDER = 'Veröffentlichen, aktiv schalten und Webhooks gibt es nur für volle Mitglieder — Entwürfe kannst du bauen.';
export const KEIN_ENTWURF = 'Prozesse bauen nur Personen im Haushalt.';

/** Eine Person des Teams (wie `TeamPerson`, nur was die Regel braucht). */
export interface TeamKurz { id: string; aktiv: boolean; speicher?: string }

/**
 * Als wer der Lauf schreibt (rein): `laeuftAls` (ein Konto des Haushalts), sonst der Eigner, wenn er ein Konto hat — sonst null (dann wird der Prozess
 * nicht aktiv; nie Rückfall auf den Inhaber).
 */
export function laufPerson(d: Pick<ProzessDefinition, 'laeuftAls' | 'eigner'>, team: readonly TeamKurz[], konten: readonly string[]): string | null {
  if (d.laeuftAls) return konten.includes(d.laeuftAls) ? d.laeuftAls : null;
  const e = d.eigner ? team.find(t => t.id === d.eigner && t.aktiv) : undefined;
  return e?.speicher && konten.includes(e.speicher) ? e.speicher : null;
}
