// ─── Kalender — Bestand `kalender-bezug` (Server, 29.09., K1) ───────────────
// Was drinsteht und warum: lib/kalender/bezug.ts. Geschrieben wird NUR hier — aus
// /api/kalender/termin (Anlegen/Ändern/Löschen), aus dem iCloud-Abgleich (Sicherung
// nachtragen) und aus der Verbindungsprüfung (tote Einträge/Kennungen entfernen).
// Jeder Schreibvorgang in EINER Sperre auf dem aktuellen Stand; der Bestand ist wie
// jeder andere verschlüsselt (lib/store/local-db.ts). Register: lib/crm/speicher-register.ts.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { bezugAendern, bezugAbgleichPlan, kennungenVon, BEZUG_MAX, LEER_BEZUG, type BezugBestand, type TerminBezug, type BezugFeld } from './bezug';
import type { IcsZusatz } from './ics';

export const BEZUG_SPEICHER = 'kalender-bezug';

export class BezugZuGross extends Error { status = 413; }

const sauberBestand = (b: BezugBestand | null | undefined): BezugBestand => (b && b.bezuege && typeof b.bezuege === 'object' ? b : { ...LEER_BEZUG, bezuege: {} });

export async function ladeBezuege(): Promise<BezugBestand> {
  return sauberBestand(await loadJson<BezugBestand>('kalender-bezug'));
}

/** Einen Eintrag ändern (Teil; `null`-Werte entfernen Felder, `null` als Ganzes entfernt den Eintrag). Liefert den neuen Eintrag. */
export async function bezugSetzen(schluessel: string, teil: Record<string, unknown> | null, jetzt = new Date().toISOString()): Promise<TerminBezug | null> {
  let ergebnis: TerminBezug | null = null;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b = sauberBestand(cur);
    const alt = b.bezuege[schluessel];
    const neu = teil === null ? null : bezugAendern(alt, teil, jetzt);
    ergebnis = neu;
    if (!alt && !neu) return cur as BezugBestand;
    const bezuege = { ...b.bezuege };
    if (neu) bezuege[schluessel] = neu; else delete bezuege[schluessel];
    if (Object.keys(bezuege).length > BEZUG_MAX) throw new BezugZuGross(`Zu viele Kalender-Bezüge (über ${BEZUG_MAX}) — nichts gespeichert.`);
    return { ...b, bezuege };
  });
  return ergebnis;
}

/** Nach einem iCloud-Lauf: Sicherungen nachtragen, Starttage nachziehen (nur, wenn sich etwas ändert). */
export async function bezuegeAbgleichen(objekte: readonly { uid: string; tag?: string; zusatz: IcsZusatz | null }[], jetzt = new Date().toISOString()): Promise<number> {
  const vorab = bezugAbgleichPlan(objekte, await ladeBezuege(), jetzt);
  if (!Object.keys(vorab).length) return 0;
  let n = 0;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b = sauberBestand(cur);
    const plan = bezugAbgleichPlan(objekte, b, jetzt);
    n = Object.keys(plan).length;
    if (!n || Object.keys(b.bezuege).length + n > BEZUG_MAX) { n = 0; return cur as BezugBestand; }
    return { ...b, bezuege: { ...b.bezuege, ...plan } };
  });
  return n;
}

/**
 * Verbindungsprüfung, Reparatur (in der Sperre, auf dem aktuellen Stand): Einträge `weg` entfernen, tote Kennungen
 * (`tot` je Feld) aus den übrigen nehmen. Der Rest bleibt unverändert.
 */
export async function bezuegeBereinigen(weg: readonly string[], tot: Partial<Record<BezugFeld, ReadonlySet<string>>>, jetzt = new Date().toISOString()): Promise<number> {
  let n = 0;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b = sauberBestand(cur);
    const bezuege: Record<string, TerminBezug> = {};
    for (const [k, e] of Object.entries(b.bezuege)) {
      if (weg.includes(k)) { n++; continue; }
      const k2 = kennungenVon(e);
      const raus = (Object.keys(k2) as BezugFeld[]).filter(f => tot[f]?.has(k2[f]!));
      if (!raus.length) { bezuege[k] = e; continue; }
      n++;
      const neu = bezugAendern(e, Object.fromEntries(raus.map(f => [f, null])), jetzt);
      if (neu) bezuege[k] = neu;
    }
    return n ? { ...b, bezuege } : cur as BezugBestand;
  });
  return n;
}
