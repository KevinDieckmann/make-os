// ─── Finanzplanung jetzt — Speicher (Server) ─────────────────────────────────
// EIN Dokument je Haushalt: `finanzen-plan--<haushalt>` (Kevin und Malin sind
// ein Haushalt). Lesen über loadJson, jede Änderung als Operationen IN der
// Schreibsperre von updateJson: erst Stand prüfen (sonst 409 mit dem aktuellen
// Dokument), dann anwenden, Protokoll und Meta schreiben, neuen Stand vergeben.
// Der Startbestand kommt per Upload (finanzen-plan.json v3) — nie aus dem Repo.

import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { Aenderung, FinanzDaten } from '@/lib/finanzen/rechenkern';
import { zielStaende } from '@/lib/finanzen/rechenkern';
import { rechneMit, arbeitsplanFuer, mitBereich, auswertung } from '@/lib/finanzen/szenarien';
import { wendeOperationenAn, neuerStand, pruefeDokument, OperationUngueltig, OperationZuGross, type Operation } from './operationen';
import { offeneBuchungen, faelligeZahl } from './hilfen';
import { fuerSicht, type PlanSicht } from './sicht';
import { schreibeAlsBusiness } from './business-schreiben';
import { EROEFFNUNG_BESTAND, kontoStartFuerPlan } from '@/lib/business/eroeffnung';
import { geltendeLaden } from '@/lib/business/eroeffnung-server';

export function speicherName(haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `finanzen-plan--${haushalt}`;
}

/** Das Dokument des Haushalts — null, wenn noch keins hochgeladen wurde. Mit dem 0-Punkt der Gesellschaften (`eroeffnung`, nie gespeichert). */
export async function ladeFinanzplan(haushalt: string): Promise<FinanzDaten | null> {
  const roh = await loadJson<unknown>(speicherName(haushalt));
  if (!roh) return null;
  const p = pruefeDokument(roh);
  if (!p.ok) { console.error(`[finanzplan] ${speicherName(haushalt)}: ${p.fehler}`); return null; }
  return mitKontoStart(p.dokument);
}

/**
 * 0-Punkt (05.10.): Kontostand-Startwert der Gesellschaften aus der Eröffnung (lib/business/eroeffnung.ts) ans Dokument hängen — beim Lesen,
 * nie gespeichert (der Schreibweg liest die Datei selbst und kennt das Feld nicht; Operationen auf `/eroeffnung` → 400). Ohne Eröffnung: unverändert.
 */
export async function mitKontoStart(d: FinanzDaten): Promise<FinanzDaten> {
  const eroeffnung = kontoStartFuerPlan(await geltendeLaden(), d.monate.length);
  return eroeffnung ? { ...d, eroeffnung } : d;
}

/** Stand der Datei (Änderungszeit + Größe) samt Eröffnung — für das ETag der GET-Antwort. */
export const dateiStand = (haushalt: string) => speicherStand([speicherName(haushalt), EROEFFNUNG_BESTAND]);

export type PatchErgebnis =
  | { ok: true; stand: string; protokoll: Aenderung[]; meta: Record<string, { wer: string; wann: string } | null>; nachladen: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; stand?: string; dokument?: FinanzDaten };

/**
 * Operationen anwenden — Prüfung und Schreiben in EINER Sperre. Bei fremdem
 * Stand: 409 mit dem aktuellen Dokument, damit die Oberfläche beide Werte
 * zeigen kann statt still zu überschreiben.
 */
export async function patchen(haushalt: string, basisStand: unknown, ops: Operation[], person: string, sicht: PlanSicht = 'privat'): Promise<PatchErgebnis> {
  const jetzt = new Date();
  // Für die 409-Antwort (das Dokument geht zurück an die Oberfläche): der 0-Punkt wie beim Lesen — außerhalb der Sperre geladen.
  const geltend = await geltendeLaden();
  let ergebnis: PatchErgebnis = { ok: false, status: 404, fehler: 'Noch kein Finanzplan — erst den Startbestand hochladen oder leer beginnen.' };
  await updateJson<unknown>(speicherName(haushalt), aktuell => {
    if (!aktuell) return aktuell;
    const p = pruefeDokument(aktuell);
    if (!p.ok) { ergebnis = { ok: false, status: 400, fehler: `Der gespeicherte Plan ist beschädigt: ${p.fehler}` }; return aktuell; }
    const d = p.dokument;
    if (typeof basisStand !== 'string' || basisStand !== d.stand) {
      // Die 409-Antwort trägt das Dokument — in der Business-Sicht nur den Business-Teil (Privat verlässt den Server nie).
      const start = kontoStartFuerPlan(geltend, d.monate.length);
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand geändert — der Plan wurde neu geladen, bitte noch einmal.', stand: d.stand, dokument: fuerSicht(start ? { ...d, eroeffnung: start } : d, sicht) };
      return aktuell;
    }
    // Business-Sicht (04.10.; Gegenprüfung 05.10.): jeder Schritt muss Business sein UND der private Teil bleibt unverändert — sonst 403, nichts
    // wird geschrieben (lib/finanzen/plan/business-schreiben.ts).
    if (sicht === 'business') {
      const b = schreibeAlsBusiness(d, ops, person, jetzt.toISOString());
      if (!b.ok) { ergebnis = { ok: false, status: b.status, fehler: b.fehler }; return aktuell; }
      const stand = neuerStand(d.stand, jetzt);
      ergebnis = { ok: true, stand, protokoll: b.r.protokoll, meta: b.r.meta, nachladen: b.r.nachladen };
      return { ...b.r.dokument, stand };
    }
    try {
      const r = wendeOperationenAn(d, ops, person, jetzt.toISOString());
      const stand = neuerStand(d.stand, jetzt);
      ergebnis = { ok: true, stand, protokoll: r.protokoll, meta: r.meta, nachladen: r.nachladen };
      return { ...r.dokument, stand };
    } catch (err) {
      ergebnis = { ok: false, status: err instanceof OperationZuGross ? 413 : 400, fehler: err instanceof OperationUngueltig ? err.message : 'Änderung nicht verwertbar.' };
      return aktuell;
    }
  });
  return ergebnis;
}

export type ImportErgebnis = { ok: true; stand: string; ersetzt: boolean } | { ok: false; status: 409; fehler: string };

/** Startbestand setzen. Ein vorhandenes Dokument wird nur mit ausdrücklichem `ersetzen` überschrieben. */
export async function importieren(haushalt: string, dokument: FinanzDaten, ersetzen: boolean, person: string, quelle: string): Promise<ImportErgebnis> {
  const jetzt = new Date();
  let ergebnis: ImportErgebnis = { ok: false, status: 409, fehler: 'Es gibt schon einen Finanzplan. Ersetzen nur mit ausdrücklicher Bestätigung.' };
  await updateJson<unknown>(speicherName(haushalt), aktuell => {
    if (aktuell && !ersetzen) return aktuell;
    const altStand = aktuell && typeof (aktuell as { stand?: unknown }).stand === 'string' ? (aktuell as { stand: string }).stand : undefined;
    const stand = neuerStand(altStand && altStand > dokument.stand ? altStand : dokument.stand, jetzt);
    const eintrag: Aenderung = { wer: person, wann: jetzt.toISOString(), feld: aktuell ? 'Plan ersetzt' : 'Startbestand hochgeladen', alt: '', neu: quelle };
    ergebnis = { ok: true, stand, ersetzt: !!aktuell };
    return { ...dokument, stand, protokoll: [eintrag, ...dokument.protokoll].slice(0, 500) };
  });
  return ergebnis;
}

/**
 * Verdichtete Zahlen des Arbeitsplans des Bereichs (sonst des aktiven Treibers) — für ZOE und die Startfläche, ohne Zeilen und Buchungen.
 * `sicht: 'business'` (05.10.): „frei jetzt“ und „Steuerrücklage“ nur der Gesellschaften (MAKE + KD Ventures) — Privat und die
 * Selbstständigkeit (seit 05.10. Teil von Privat) zählen dort nicht; die übrigen privaten Schlüssel filtert `kennzahlenFuerSicht`.
 */
export function kennzahlenVon(d: FinanzDaten, sicht: 'privat' | 'business' = 'privat') {
  // Gegenprüfung 05.10. (Fund 13): jeder Bereich rechnet mit SEINEM Arbeitsplan (`bereiche.<sicht>.arbeitsplan`, ohne eigene Wahl der gemeinsame) —
  // wie die Oberfläche (`mitBereich` in Finanzplan.tsx). Vorher rechneten die Kennzahlen immer den gemeinsamen Arbeitsplan.
  const ps = arbeitsplanFuer(d, sicht);
  const { d: dd, sz, ug, kdc, pr, kz } = rechneMit(mitBereich(d, sicht), ps);
  const aw = auswertung(dd, ug, pr, kdc);
  const ziele = zielStaende(dd, ug, pr, kdc).map(z => ({ id: z.ziel.id, name: z.ziel.name, status: z.status, erreichtMonat: z.erreichtMonat }));
  return {
    szenario: sz.name, szenarioId: sz.id, arbeitsplan: ps?.name ?? null, arbeitsplanId: ps?.id ?? null, stand: d.stand, heute: d.einstellungen.heute,
    ...kz,
    freiJetzt: sicht === 'business' ? aw.frei.business : aw.frei.gesamt, runwayUG: aw.runway.ug, runwayPrivat: aw.runway.privat, runwayHorizont: aw.runway.horizont,
    zieleImPlan: aw.ziele.imPlan, zieleGesamt: aw.ziele.gesamt, mindestumsatz: aw.mindestumsatz.schnitt12, steuerRuecklage: sicht === 'business' ? aw.steuer.ruecklageBusiness : aw.steuer.ruecklageGesamt,
    privatLuftOkt: pr[0]?.luft ?? 0, ugFreiDez26: ug[2]?.frei ?? 0,
    offeneBuchungen: offeneBuchungen(d), faelligePosten: faelligeZahl(d),
    kontostaendeFehlen: d.posten.filter(p => p.art === 'konto' && p.betrag == null).length,
    ziele,
  };
}
