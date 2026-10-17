// ─── Fulfillment · Termine des Kunden — EINE Lesestelle (Server; 15.10., Abnahme B3) ─────────────────────────────────────────────────────────────
// Fall (Takt, Onboarding „Kick-off terminiert“), Cockpit, Kunden-Seite, Report und die Health „Termine“ der Leistungstreppe lesen die Termine eines
// Mandats NUR hier: die Termine des gespeicherten Kalender-Stands (iCloud/Google bzw. der Mac-Stand — `termineLesen`, ohne Abgleich, nie Netz) mit
// Bezug zum Mandat bzw. zur Firma des Mandats (`kalender-bezug`, lib/kalender/bezug.ts `mitBezug` — Serien mit jedem Vorkommen), dazu Bezüge mit Tag,
// die im Stand fehlen — nur, wenn es keinen lesbaren Stand gibt (18.10.). Private Termine tragen keinen Titel. Fehler → leer (der Fall zeigt dann „kein Termin“, nie einen erfundenen).

import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { bezugGehoertZu, type FallTermin } from './termine';

/** Wie weit zurück und voraus gelesen wird (Tage) — Kick-off seit dem Start, Takt sechs Wochen, nächster Termin. */
export const TERMINE_FENSTER = { zurueck: 120, voraus: 120 } as const;

type MandatKurz = { id: string; firmaId?: string | null };

/**
 * Die Termine je Mandat (Schlüssel = Mandat-Kennung), sortiert. Eine Minute gemerkt je Haushalt, Tag und Mandaten (`merken` — jede Schreibung über die
 * Datenschicht macht den Zwischenspeicher ungültig), damit Cockpit, Index und Fall nicht je Aufruf den Kalender-Stand neu aufklappen.
 */
export async function fallTermine(mandate: readonly MandatKurz[], heute = localDay()): Promise<Record<string, FallTermin[]>> {
  if (!mandate.length) return {};
  const [{ merken }, { fulfillmentHaushalt }] = await Promise.all([import('@/lib/store/memo'), import('../speicher')]);
  const h = await fulfillmentHaushalt();
  const schluessel = `ff-termine:${h}:${heute}:${mandate.map(m => `${m.id}/${m.firmaId ?? ''}`).sort().join(',')}`;
  return merken(schluessel, 60_000, () => fallTermineLesen(mandate, heute));
}

async function fallTermineLesen(mandate: readonly MandatKurz[], heute: string): Promise<Record<string, FallTermin[]>> {
  const raus: Record<string, FallTermin[]> = Object.fromEntries(mandate.map(m => [m.id, [] as FallTermin[]]));
  const von = tagPlus(heute, -TERMINE_FENSTER.zurueck), bis = tagPlus(heute, TERMINE_FENSTER.voraus);
  try {
    const [{ termineLesen }, { ladeEinstellungen }, { ladeBezuege }, { uidVonSchluessel, schluesselTeile }] = await Promise.all([
      import('@/lib/kalender/termine-lesen'), import('@/lib/kalender/einstellungen'), import('@/lib/kalender/bezug-server'), import('@/lib/kalender/bezug'),
    ]);
    const [stand, bezuege] = await Promise.all([ladeEinstellungen().then(e => termineLesen(e, von, bis)).catch(() => null), ladeBezuege().catch(() => ({ bezuege: {} }))]);
    const gesehen = new Set<string>();
    for (const t of stand?.termine ?? []) {
      if (t.abgesagt || t.status === 'abgesagt') continue;
      const uid = t.uid || schluesselTeile(t.id).uid;
      const privat = t.sichtbarkeit === 'privat' || !!t.persoenlich || !!t.maskiert;
      for (const m of mandate) {
        if (!bezugGehoertZu(t.bezug, m)) continue;
        const tag = t.start.slice(0, 10);
        // Art und „privat“ (18.10., L3 B1): Kunden-Wege nehmen nur `kundenTermine` (Art „termin“, nie privat).
        raus[m.id].push({ uid, tag, ...(t.ganztags ? {} : { von: t.start.slice(11, 16) }), ...(!privat && t.titel ? { titel: t.titel } : {}), ...(t.art && t.art !== 'termin' ? { art: t.art } : {}), ...(privat ? { privat: true as const } : {}) });
        gesehen.add(`${m.id}|${uid}|${tag}`);
      }
    }
    // Bezüge mit Tag NUR, wenn es gar keinen lesbaren Kalender-Stand gibt (18.10., L2 Zählungen A1): vorher kamen so abgesagte, verschobene und in
    // Apple/Google gelöschte Termine zurück (der Bezug bleibt liegen, `bezug.tag` zieht nur der iCloud-Abgleich des Haushalts nach — Google und
    // iCloud je Person nicht). Mit lesbarem Stand gilt allein der Stand. Nur Tag, kein Titel; Art und „privat“ aus der Sicherung des Bezugs.
    const standLesbar = !!stand && stand.quelle !== 'leer';
    if (!standLesbar) for (const [k, b] of Object.entries(bezuege.bezuege)) {
      if (!b.tag || b.tag < von || b.tag >= bis) continue;
      const uid = uidVonSchluessel(k);
      for (const m of mandate) if (bezugGehoertZu(b, m) && !gesehen.has(`${m.id}|${uid}|${b.tag}`) && !raus[m.id].some(x => x.uid === uid && x.tag === b.tag)) raus[m.id].push({ uid, tag: b.tag, ...(b.art && b.art !== 'termin' ? { art: b.art } : {}), ...(b.privat ? { privat: true as const } : {}) });
    }
  } catch { /* ohne Kalender keine Termine */ }
  for (const id of Object.keys(raus)) raus[id].sort((a, b) => (a.tag + (a.von ?? '')).localeCompare(b.tag + (b.von ?? '')));
  return raus;
}
