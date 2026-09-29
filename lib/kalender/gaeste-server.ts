// ─── Kalender — Gäste gegen die Kartei prüfen (Server, 30.09., Paket K3) ────
// Regeln (lib/kalender/gaeste.ts): Art. 18 — eine eingeschränkte Person wird nie eingeladen, auch nicht über eine frei
// eingegebene Adresse (deshalb liest diese Prüfung die ganze Kartei: sie SCHÜTZT, sie spricht niemanden an).
// Werbesperre — ein 1:1-Termin ist keine Werbung: erlaubt, die Oberfläche zeigt einen Hinweis. Eine frei eingegebene
// Adresse, die genau EINER Person gehört, bekommt deren Kennung (→ `gastKontakte`, Auswertung, Meeting-Aktivität).
// Die Suche für den Dialog liefert Adressen nur auf eine Anfrage hin (höchstens 8 Treffer) — nie die ganze Liste.

import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { alleAdressen } from '@/lib/crm/emails';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { suchPasst } from '@/lib/text/such-norm';
import type { GastEingabe } from './eingabe';
import type { GastWahl } from './gaeste';

export type GaestePruefung = { ok: true; gaeste: GastEingabe[]; werbesperre: number } | { ok: false; fehler: string };

/** Rein: Gäste gegen eine Kartei prüfen (Art. 18 → Ablehnung, Werbesperre zählen, Adresse → Kennung). */
export function gaesteGegenKartei(gaeste: readonly GastEingabe[], kartei: readonly Kontakt[]): GaestePruefung {
  const nachAdresse = new Map<string, Kontakt[]>();
  for (const k of kartei) for (const a of alleAdressen(k)) nachAdresse.set(a, [...(nachAdresse.get(a) ?? []), k]);
  const nachId = new Map(kartei.map(k => [k.id, k]));
  let werbesperre = 0;
  const raus: GastEingabe[] = [];
  for (const g of gaeste) {
    const treffer = nachAdresse.get(g.email) ?? [];
    const k = g.kontaktId ? nachId.get(g.kontaktId) : treffer.length === 1 ? treffer[0] : undefined;
    if (g.kontaktId && !k) return { ok: false, fehler: 'Ein Gast verweist auf einen Kontakt, den es nicht mehr gibt.' };
    if (k?.eingeschraenkt || treffer.some(x => x.eingeschraenkt)) return { ok: false, fehler: 'Eine eingeladene Person ist eingeschränkt (Art. 18 DSGVO) — sie wird nicht eingeladen.' };
    if (k?.werbesperre || treffer.some(x => x.werbesperre)) werbesperre++;
    raus.push({ email: g.email, ...(g.name ? { name: g.name } : k ? { name: anzeigename(k) } : {}), ...(k ? { kontaktId: k.id } : {}) });
  }
  return { ok: true, gaeste: raus, werbesperre };
}

/** Gäste prüfen — die ganze Kartei (auch eingeschränkte Personen: nur, um sie auszuschließen). */
export async function gaestePruefenCrm(gaeste: readonly GastEingabe[]): Promise<GaestePruefung> {
  if (!gaeste.length) return { ok: true, gaeste: [], werbesperre: 0 };
  return gaesteGegenKartei(gaeste, await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }));
}

/** Rein: Kontakte mit E-Mail zu einer Suche (Art. 18 fehlen schon), höchstens `max`. */
export function gaesteSuchen(kartei: readonly Kontakt[], frage: string, max = 8): GastWahl[] {
  const q = frage.trim();
  if (q.length < 2) return [];
  const raus: GastWahl[] = [];
  for (const k of kartei) {
    if (k.eingeschraenkt) continue;
    const adressen = alleAdressen(k);
    if (!adressen.length || !suchPasst([anzeigename(k), k.firma, ...adressen], q)) continue;
    raus.push({ email: adressen[0], name: anzeigename(k), kontaktId: k.id, ...(k.werbesperre ? { werbesperre: true as const } : {}) });
    if (raus.length >= max) break;
  }
  return raus;
}
