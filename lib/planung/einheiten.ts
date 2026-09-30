// ─── MAKE OS — Planung: Business-Einheiten ──────────────────────────────────
// Kevin (27.09.): Ziele und Meilensteine im Business nach Einheit zuordnen und
// filtern — vorbelegt Selbstständigkeit · KD Ventures · MAKE Innovation GmbH (lib/einheiten.ts,
// eine Quelle mit Aufgaben und CRM) · Kunden, weitere frei
// anlegbar. Die Liste gehört dem Haushalt (Speicher planung-einheiten--<h>).
// Privat kennt keine Einheiten.

import { KERN_EINHEITEN_NAMEN, einheitName } from '@/lib/einheiten';

export const EINHEITEN_STANDARD: readonly string[] = [...KERN_EINHEITEN_NAMEN, 'Kunden'];
export const EINHEIT_MIN = 2;
export const EINHEIT_MAX = 40;
export const EINHEITEN_HOECHSTENS = 30;

export interface EinheitenDatei { eigene: string[] }

/** Einen Namen säubern — null, wenn unbrauchbar. */
export function sauberEinheit(roh: unknown): string | null {
  const s = (einheitName(String(roh ?? '').replace(/\s+/g, ' ').trim()) ?? '').slice(0, EINHEIT_MAX);
  return s.length >= EINHEIT_MIN ? s : null;
}

const norm = (s: string) => s.toLocaleLowerCase('de-DE');

/** Die vollständige Werteliste: Standard zuerst, dann die eigenen — ohne Doppelte (Groß/Klein egal). */
export function einheitenListe(eigene: readonly string[] | null | undefined): string[] {
  const aus: string[] = [...EINHEITEN_STANDARD];
  const gesehen = new Set(aus.map(norm));
  for (const e of eigene ?? []) {
    const s = sauberEinheit(e);
    if (!s || gesehen.has(norm(s))) continue;
    gesehen.add(norm(s)); aus.push(s);
    if (aus.length >= EINHEITEN_HOECHSTENS) break;
  }
  return aus;
}

/** Eine Einheit hinzufügen — gibt die neuen `eigene` zurück (unverändert, wenn schon da oder unbrauchbar). */
export function einheitHinzufuegen(eigene: readonly string[], neu: unknown): { eigene: string[]; einheit: string | null; neuAngelegt: boolean } {
  const s = sauberEinheit(neu);
  if (!s) return { eigene: [...eigene], einheit: null, neuAngelegt: false };
  const alle = einheitenListe(eigene);
  const da = alle.find(x => norm(x) === norm(s));
  if (da) return { eigene: [...eigene], einheit: da, neuAngelegt: false };
  if (alle.length >= EINHEITEN_HOECHSTENS) return { eigene: [...eigene], einheit: null, neuAngelegt: false };
  return { eigene: [...eigene, s], einheit: s, neuAngelegt: true };
}

/** Datei säubern (Altbestand, kaputte Eingaben). */
export function sauberEinheitenDatei(roh: unknown): EinheitenDatei {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const eigene = (Array.isArray(r.eigene) ? r.eigene : []).map(sauberEinheit).filter((x): x is string => !!x);
  return { eigene: einheitenListe(eigene).slice(EINHEITEN_STANDARD.length) };
}

/**
 * Passt ein Eintrag zum Einheiten-Filter? `alle` lässt alles durch. Seit 30.09. über `einheitName` auf beiden
 * Seiten — ein gespeicherter Altname (z. B. „Neue UG“ → MAKE Innovation GmbH) passt weiter zum heutigen Namen.
 */
export const passtEinheit = (einheit: string | undefined, filter: string | 'alle'): boolean =>
  filter === 'alle' || norm(einheitName(einheit) ?? '') === norm(einheitName(filter) ?? filter);
