// ─── Kalender — Bestand `kalender-bezug` (Server, 29.09., K1) ───────────────
// Was drinsteht und warum: lib/kalender/bezug.ts. Geschrieben wird NUR hier — aus
// /api/kalender/termin (Anlegen/Ändern/Löschen), aus dem iCloud-Abgleich (Sicherung
// nachtragen) und aus der Verbindungsprüfung (tote Einträge/Kennungen entfernen).
// Jeder Schreibvorgang in EINER Sperre auf dem aktuellen Stand; der Bestand ist wie
// jeder andere verschlüsselt (lib/store/local-db.ts). Register: lib/crm/speicher-register.ts.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { bezugAendern, bezugAbgleichPlan, bezugUmzugPlan, kennungenVon, BEZUG_MAX, LEER_BEZUG, type BezugBestand, type TerminBezug, type BezugFeld, type ObjektKurz } from './bezug';

export const BEZUG_SPEICHER = 'kalender-bezug';

export class BezugZuGross extends Error { status = 413; }

const sauberBestand = (b: BezugBestand | null | undefined): BezugBestand => (b && b.bezuege && typeof b.bezuege === 'object' ? b : { ...LEER_BEZUG, bezuege: {} });

export async function ladeBezuege(): Promise<BezugBestand> {
  return sauberBestand(await loadJson<BezugBestand>('kalender-bezug'));
}

/**
 * Einen Eintrag ändern (Teil; `null`-Werte entfernen Felder, `null` als Ganzes entfernt den Eintrag). Liefert den neuen
 * Eintrag. `altSchluessel` (R-K1 #46): derselbe Termin in der alten Form ohne Kalender (`uid`). Steht unter dem neuen
 * Schlüssel noch nichts, ist der alte Eintrag die Grundlage; er fällt danach weg — außer `altBehalten` (die UID steht in
 * mehreren Kalendern: der alte Eintrag gilt dann weiter für die andere Kopie).
 */
export async function bezugSetzen(schluessel: string, teil: Record<string, unknown> | null, jetzt = new Date().toISOString(), opt: { altSchluessel?: string; altBehalten?: boolean } = {}): Promise<TerminBezug | null> {
  let ergebnis: TerminBezug | null = null;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b = sauberBestand(cur);
    const altKey = opt.altSchluessel && opt.altSchluessel !== schluessel && b.bezuege[opt.altSchluessel] ? opt.altSchluessel : undefined;
    const alt = b.bezuege[schluessel] ?? (altKey ? b.bezuege[altKey] : undefined);
    const neu = teil === null ? null : bezugAendern(alt, teil, jetzt);
    ergebnis = neu;
    if (!alt && !neu) return cur as BezugBestand;
    const bezuege = { ...b.bezuege };
    if (altKey && !opt.altBehalten) delete bezuege[altKey];
    if (neu) bezuege[schluessel] = neu; else delete bezuege[schluessel];
    if (Object.keys(bezuege).length > BEZUG_MAX) throw new BezugZuGross(`Zu viele Kalender-Bezüge (über ${BEZUG_MAX}) — nichts gespeichert.`);
    return { ...b, bezuege };
  });
  return ergebnis;
}

/**
 * Nach einem iCloud-Lauf: alte Schlüssel ohne Kalender umziehen (eindeutige UID, R-K1 #46), Sicherungen nachtragen,
 * Starttage und Farbe nachziehen (nur, wenn sich etwas ändert).
 */
export async function bezuegeAbgleichen(objekte: readonly ObjektKurz[], jetzt = new Date().toISOString()): Promise<number> {
  const vorher = await ladeBezuege();
  if (!bezugUmzugPlan(objekte, vorher).length && !Object.keys(bezugAbgleichPlan(objekte, vorher, jetzt)).length) return 0;
  let n = 0;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b0 = sauberBestand(cur);
    const umzug = bezugUmzugPlan(objekte, b0);
    const bezuege = { ...b0.bezuege };
    for (const [alt, neu] of umzug) { bezuege[neu] = bezuege[alt]; delete bezuege[alt]; }
    const b = { ...b0, bezuege };
    const plan = bezugAbgleichPlan(objekte, b, jetzt);
    n = umzug.length + Object.keys(plan).length;
    if (!n || Object.keys(b.bezuege).length + Object.keys(plan).length > BEZUG_MAX) { n = 0; return cur as BezugBestand; }
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

/**
 * Verbindungsprüfung „termin-waise-neu“ (K6a, #100): Bezüge gelöschter Termine an den neuen Termin hängen — in EINER
 * Sperre, nur wenn der alte Eintrag noch da ist und der neue Schlüssel frei ist. Liefert die Zahl der umgehängten.
 */
export async function bezuegeUmhaengen(paare: readonly (readonly [string, string])[]): Promise<number> {
  if (!paare.length) return 0;
  let n = 0;
  await updateJson<BezugBestand>('kalender-bezug', cur => {
    const b = sauberBestand(cur);
    const bezuege = { ...b.bezuege };
    for (const [alt, neu] of paare) {
      if (!bezuege[alt] || bezuege[neu]) continue;
      bezuege[neu] = bezuege[alt];
      delete bezuege[alt];
      n++;
    }
    return n ? { ...b, bezuege } : cur as BezugBestand;
  });
  return n;
}
