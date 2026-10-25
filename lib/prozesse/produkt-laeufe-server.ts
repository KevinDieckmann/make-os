// ─── Prozesse × Fulfillment — welche Mandate laufen schon in einem Prozess der Werkstatt (Server, 22.10.; Kevin: „Dort ausblenden“) ──────────────────────
// Liest NUR den Bestand der Läufe (`prozess-laeufe--<h>`, roh über `laeufeAus`), schreibt nie, wirft nie: bei einem Lesefehler die leere Menge — dann
// rechnen die Kandidaten des Fulfillments wie vorher (lieber einmal zu viel „Fall starten?“ als ein Mandat ohne Ablauf). Die Regel selbst ist rein:
// lib/prozesse/produkt-bindung.ts `mandateMitProduktLauf`. Genutzt von der EINEN Kandidaten-Rechnung (lib/fulfillment/regeln.ts `onboardingKandidaten`) über
// ihre beiden Aufrufer (GET /api/fulfillment → `kandidatenAnsicht`, Morgenlauf-Vorschläge).
// 24.10. (Bau-Test Kern): dazu der Ablauf des Produkts für den Fall — `produktProzesseLesen` (je Produkt Prozess + Lage, Vorbelegung von „Fall starten“) und
// `produktAblaufLesen` (Phasen/Schritte mit dem Stand des Laufs für die Reise). Ebenso nur lesen, nie werfen.

import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Fall } from '@/lib/fulfillment/typen';
import type { ProduktAblaufAnsicht, ProduktProzessKurz } from './produkt-ablauf';

export async function mandateMitProduktLaufLesen(crm: Pick<CrmBestand, 'mandate' | 'leistungen'>): Promise<Set<string>> {
  try {
    const [{ loadJson }, { laeufeBestand }, { laeufeAus }, { prozesseHaushalt }, { mandateMitProduktLauf }] = await Promise.all([
      import('@/lib/store/local-db'), import('./lauf-typen'), import('./lauf-regeln'), import('./werkstatt-server'), import('./produkt-bindung'),
    ]);
    const d = laeufeAus(await loadJson<unknown>(laeufeBestand(await prozesseHaushalt())));
    return mandateMitProduktLauf(d.laeufe, crm);
  } catch {
    return new Set();
  }
}

// ══ Der Ablauf des Produkts im Fall (24.10., Bau-Test Kern — Regeln: lib/prozesse/produkt-ablauf.ts) ═══════════════════════════════════════════════

/** Werkstatt, Läufe und Weiche — einmal je Anfrage gelesen (alles dynamisch: dieser Weg hängt an GET-Routen des Fulfillments). */
async function bindungsUmfeld() {
  const [{ loadJson }, { laeufeBestand, leererStand }, { laeufeAus }, { prozesseHaushalt, prozesseLesen }, { modusFuer }, ablauf] = await Promise.all([
    import('@/lib/store/local-db'), import('./lauf-typen'), import('./lauf-regeln'), import('./werkstatt-server'), import('./lauf-server'), import('./produkt-ablauf'),
  ]);
  const h = await prozesseHaushalt();
  const [werkstatt, laeufe] = await Promise.all([prozesseLesen(h), loadJson<unknown>(laeufeBestand(h)).then(laeufeAus)]);
  const kurz = (prozessId: string): ProduktProzessKurz | null => {
    const e = werkstatt.prozesse.find(p => p.id === prozessId);
    if (!e) return null;
    const lage = ablauf.ablaufLage(e, modusFuer(e, laeufe.prozesse[e.id] ?? leererStand()));
    if (!lage) return null;
    const titel = (e.versionen.at(-1)?.definition ?? e.entwurf).titel;
    return { id: e.id, titel, lage };
  };
  return { werkstatt, laeufe, kurz, ablauf };
}

/**
 * Je Produkt (nicht im Papierkorb) mit gebundenem Prozess: Kennung, Titel und Lage — für die Vorbelegung von „Fall starten“ (`startVorbelegung`). Archivierte bzw.
 * fehlende Prozesse fallen weg (dann gelten die Pakete wie bisher). Wirft nie: bei einem Lesefehler leer.
 */
export async function produktProzesseLesen(crm: Pick<CrmBestand, 'leistungen'>): Promise<Record<string, ProduktProzessKurz>> {
  const gebunden = crm.leistungen.filter(l => !l.geloeschtAm && l.prozessId);
  if (!gebunden.length) return {};
  try {
    const u = await bindungsUmfeld();
    const raus: Record<string, ProduktProzessKurz> = {};
    for (const l of gebunden) { const k = u.kurz(l.prozessId!); if (k) raus[l.id] = k; }
    return raus;
  } catch {
    return {};
  }
}

/**
 * Die Ansicht des Ablaufs für den Fall eines Mandats: der Prozess, den die Akte trägt (`fallAblauf`), sonst der des Hauptprodukts — mit dem Stand des jüngsten
 * Laufs (nicht abgebrochen) an diesem Mandat und der Definition seiner Version (ohne Lauf: die jüngste Version, sonst der Entwurf). null ohne Prozess. Wirft nie.
 */
export async function produktAblaufLesen(mandat: Pick<Mandat, 'id' | 'leistungId'>, crm: Pick<CrmBestand, 'leistungen'>, fall?: Pick<Fall, 'ablauf' | 'vorlageId'> | null): Promise<ProduktAblaufAnsicht | null> {
  try {
    const [{ fallAblauf }, { prozessDesProdukts }] = await Promise.all([import('@/lib/fulfillment/prozesse/ablauf-art'), import('./produkt-bindung')]);
    const prozessId = (fall ? fallAblauf(fall)?.prozessId : undefined) ?? prozessDesProdukts(crm.leistungen, mandat.leistungId);
    if (!prozessId) return null;
    const u = await bindungsUmfeld();
    const kurz = u.kurz(prozessId);
    const e = u.werkstatt.prozesse.find(p => p.id === prozessId);
    if (!kurz || !e) return null;
    const lauf = u.laeufe.laeufe.filter(l => l.prozessId === prozessId && l.fall.art === 'mandat' && l.fall.id === mandat.id && l.status !== 'abgebrochen')
      .sort((a, b) => (a.start < b.start ? -1 : 1)).at(-1) ?? null;
    const version = lauf?.version ?? e.versionen.at(-1)?.nr ?? null;
    const def = (version !== null ? e.versionen.find(v => v.nr === version)?.definition : undefined) ?? e.entwurf;
    return u.ablauf.produktAblaufAnsicht(kurz, def, version, lauf);
  } catch {
    return null;
  }
}
