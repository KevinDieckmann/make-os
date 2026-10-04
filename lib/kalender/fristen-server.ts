// ─── Kalender — Fristen aus dem ganzen System lesen (Server, K6a, 29.09.) ────
// EINE Stelle, die die Quellen der Fristen lädt (Meilensteine, Bauplan-Etappen, Mandate, Zahlungen/Rechnungen des
// Finanzplans, CRM: DSGVO-Anträge/Angebote/Deals, Steuertermine als Vorlage) — genutzt von GET /api/kalender (Fristen-Ebene) und Glocke/Heute
// (lib/heute/anstehend-server.ts). Seit 04.10. auch Vertragsfristen der eigenen Gesellschaften (Register). Vorher lud die Route selbst; ein zweiter Leser hätte die Quellen kopiert.
// Steuertermine: nur mit eingeschaltetem Schalter (Kalender-Einstellungen `steuerVorlage.an`, Standard aus) aus dem
// Steuer-Modul — ohne Beträge, mit Hinweis „keine Steuerberatung; gegen BMF-Steuerkalender prüfen“.
// Gerechnet wird rein in lib/kalender/eintraege.ts `fristen` (Kündigungsfrist über `mandatFristen`, eine Rechnung).
// Wirft nie — eine fehlende Quelle fehlt einfach.

import { loadJson } from '@/lib/store/local-db';
import { ladeBauplan } from '@/lib/bauplan/speicher';
import { ladeCrm } from '@/lib/crm/speicher';
import { firmaVonMandat } from '@/lib/crm/firmen-bezug';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { localDay } from '@/lib/zeit';
import { fristen, type Frist, type Quellen } from './eintraege';
import { ladeEinstellungen } from './einstellungen';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

/**
 * Vertragsfristen aus dem Gesellschafts-Register (04.10.) — nur der Haushalt des Inhabers (dem gehört der Kalender, Business);
 * ohne Haushalt keine. Gerechnet rein in lib/gesellschaften/modell.ts `vertragsStichtage`.
 */
export async function vertragsFristenLesen(): Promise<NonNullable<Quellen['vertraege']>> {
  const h = await haushaltDesInhabers();
  if (!h) return [];
  const { ladeRegister } = await import('@/lib/gesellschaften/server');
  const { alleGesellschaften, vertragsStichtage } = await import('@/lib/gesellschaften/modell');
  return vertragsStichtage(alleGesellschaften(await ladeRegister(h)));
}

/**
 * Steuertermine als Vorlage (Zusatzthema #11) — NUR wenn in den Kalender-Einstellungen eingeschaltet (Standard aus).
 * Quelle ist das Steuer-Modul (lib/steuern: eure Einstellungen, Werktag nach § 108 AO, Erklärungsfristen) — der Kalender
 * kopiert keine eigene Regel und keine Beträge; abgehakte Fristen gelten als erledigt.
 */
export async function steuerFristenLesen(heute: string): Promise<NonNullable<Quellen['steuer']>> {
  const { ladeSteuerEinstellungen, STEUERN } = await import('@/lib/steuern/speicher');
  const { fristen: steuerFristen, EINHEIT_LABEL } = await import('@/lib/steuern/rechnen');
  const [e, d] = await Promise.all([ladeSteuerEinstellungen(), loadJson<{ abgehakt?: Record<string, unknown> }>(STEUERN)]);
  return steuerFristen(e, heute, d?.abgehakt ?? {}).filter(f => !f.erledigt)
    .map(f => ({ datum: f.datum, art: `${f.einheit}-${f.art}`, titel: `${EINHEIT_LABEL[f.einheit]}: ${f.titel}`, hinweis: f.hinweis, ...(f.einheit === 'privat' ? { privat: true } : {}) }));
}

/** Die Quellen der Fristen (ohne Rechnung). Das Fenster wählt `fristen` (Steuer-Vorlage: −30 … +365 Tage ab heute). */
export async function fristenQuellenLesen(): Promise<Quellen> {
  const [meilensteine, bauplan, crm, finanzplan, einst, vertraege] = await Promise.all([
    loadJson<{ meilensteine?: Quellen['meilensteine'] }>('meilensteine').catch(() => null),
    ladeBauplan().catch(() => null),
    ladeCrm().catch(() => null),
    loadJson<{ zahlungen?: Quellen['zahlungen']; rechnungen?: Quellen['rechnungen'] }>('finanzplan').catch(() => null),
    ladeEinstellungen().catch(() => null),
    vertragsFristenLesen().catch(() => []),
  ]);
  return {
    meilensteine: meilensteine?.meilensteine, etappen: bauplan?.etappen,
    // Mandanten klickbar (28.09.): der Name der CRM-Firma (per Kennung) statt des alten Kundentexts.
    mandate: crm?.mandate.map(m => ({ ...m, kunde: firmaVonMandat(m, crm.firmen)?.name ?? m.kunde })) as Quellen['mandate'],
    zahlungen: finanzplan?.zahlungen, rechnungen: finanzplan?.rechnungen,
    // K6a: CRM-Fristen — nur Kennung, Art/Titel und Datum (Anträge ohne Namen).
    antraege: crm?.antraege.map(a => ({ id: a.id, art: a.art, frist: a.frist, status: a.status })),
    angebote: crm?.angebote.map(a => ({ id: a.id, titel: a.titel, status: a.status, gueltigBis: a.gueltigBis })),
    deals: crm?.chancen.map(c => ({ id: c.id, titel: c.titel, stufe: c.stufe, ...(c.erwartetAm ? { erwartetAm: c.erwartetAm } : {}), besitzer: c.besitzer, offen: OFFENE_STUFEN.includes(c.stufe) })),
    steuer: einst?.steuerVorlage.an ? await steuerFristenLesen(localDay()).catch(() => []) : [],
    vertraege,
  };
}

/** Alle Fristen im Fenster [von, bis) — Berliner Tage. */
export async function fristenLesen(von: string, bis: string, heute = localDay()): Promise<Frist[]> {
  return fristen(await fristenQuellenLesen(), von, bis, heute);
}
