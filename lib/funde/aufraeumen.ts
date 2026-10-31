// ─── Funde — Löschfrist (rein + Lauf; Morgenlauf-Schritt „kampagne-funde“ in lib/crm/loeschfristen-lauf.ts) ────────────────────
// Nicht übernommene Funde (vorbereitet, verworfen, gesperrt) fallen nach der Frist weg (Vorgabe 21 Tage, höchstens 30 — Art. 14 Abs. 3 lit. a:
// wer nicht binnen eines Monats informiert wird, darf nicht weiter gespeichert sein). Übernommene/gesendete stehen in der Kartei; ihr Fund (mit
// Vorschau) bleibt, solange der Link gilt (60 Tage), dann weg. Die OSM-Kennung bleibt in `bekannt`, damit derselbe Betrieb nicht wiederkommt.

import { VORSCHAU_TAGE, type Fund } from './typen';

const tageSeit = (iso: string, heute: string) => Math.floor((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T12:00:00Z`)) / 864e5);

/** Welche Funde fallen weg? (rein) */
export function fundeUeberFrist(funde: readonly Fund[], heute: string, tage: number): Fund[] {
  return funde.filter(f => {
    const ab = f.gesendet?.am ?? f.geaendert ?? f.angelegt;
    if (f.status === 'uebernommen' || f.status === 'gesendet') return tageSeit(ab, heute) > VORSCHAU_TAGE;
    return tageSeit(f.angelegt, heute) > tage;
  });
}

/** Lauf: entfernen, offene Stapel-Vorschläge der entfernten Funde ablehnen. Zählt, nennt keine Namen. */
export async function fundeAufraeumen(heute: string, tage: number): Promise<number> {
  const { ladeFunde, aendereFunde } = await import('./speicher');
  const vorab = fundeUeberFrist((await ladeFunde()).funde, heute, tage);
  if (!vorab.length) return 0;
  let weg: Fund[] = [];
  await aendereFunde(b => {
    weg = fundeUeberFrist(b.funde, heute, tage);
    const ids = new Set(weg.map(f => f.id));
    return { ...b, funde: b.funde.filter(f => !ids.has(f.id)), bekannt: [...new Set([...b.bekannt, ...weg.map(f => f.osmId).filter((x): x is string => !!x)])] };
  }, { wer: { art: 'system' } });
  const { entscheide } = await import('@/lib/zoe/stapel');
  for (const f of weg) if (f.vorschlagId && f.status === 'vorbereitet') await entscheide(f.vorschlagId, 'abgelehnt', { grund: 'Löschfrist (nicht übernommen)', von: null }).catch(() => null);
  return weg.length;
}
