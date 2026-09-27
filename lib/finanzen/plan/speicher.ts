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
import { rechneMit, arbeitsplanVon, auswertung } from '@/lib/finanzen/szenarien';
import { wendeOperationenAn, neuerStand, pruefeDokument, OperationUngueltig, type Operation } from './operationen';
import { offeneBuchungen, faelligeZahl } from './hilfen';

export function speicherName(haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `finanzen-plan--${haushalt}`;
}

/** Das Dokument des Haushalts — null, wenn noch keins hochgeladen wurde. */
export async function ladeFinanzplan(haushalt: string): Promise<FinanzDaten | null> {
  const roh = await loadJson<unknown>(speicherName(haushalt));
  if (!roh) return null;
  const p = pruefeDokument(roh);
  if (!p.ok) { console.error(`[finanzplan] ${speicherName(haushalt)}: ${p.fehler}`); return null; }
  return p.dokument;
}

/** Stand der Datei (Änderungszeit + Größe) — für das ETag der GET-Antwort. */
export const dateiStand = (haushalt: string) => speicherStand([speicherName(haushalt)]);

export type PatchErgebnis =
  | { ok: true; stand: string; protokoll: Aenderung[]; meta: Record<string, { wer: string; wann: string } | null>; nachladen: boolean }
  | { ok: false; status: 400 | 404 | 409; fehler: string; stand?: string; dokument?: FinanzDaten };

/**
 * Operationen anwenden — Prüfung und Schreiben in EINER Sperre. Bei fremdem
 * Stand: 409 mit dem aktuellen Dokument, damit die Oberfläche beide Werte
 * zeigen kann statt still zu überschreiben.
 */
export async function patchen(haushalt: string, basisStand: unknown, ops: Operation[], person: string): Promise<PatchErgebnis> {
  const jetzt = new Date();
  let ergebnis: PatchErgebnis = { ok: false, status: 404, fehler: 'Noch kein Finanzplan — erst den Startbestand hochladen oder leer beginnen.' };
  await updateJson<unknown>(speicherName(haushalt), aktuell => {
    if (!aktuell) return aktuell;
    const p = pruefeDokument(aktuell);
    if (!p.ok) { ergebnis = { ok: false, status: 400, fehler: `Der gespeicherte Plan ist beschädigt: ${p.fehler}` }; return aktuell; }
    const d = p.dokument;
    if (typeof basisStand !== 'string' || basisStand !== d.stand) {
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand geändert — der Plan wurde neu geladen, bitte noch einmal.', stand: d.stand, dokument: d };
      return aktuell;
    }
    try {
      const r = wendeOperationenAn(d, ops, person, jetzt.toISOString());
      const stand = neuerStand(d.stand, jetzt);
      ergebnis = { ok: true, stand, protokoll: r.protokoll, meta: r.meta, nachladen: r.nachladen };
      return { ...r.dokument, stand };
    } catch (err) {
      ergebnis = { ok: false, status: 400, fehler: err instanceof OperationUngueltig ? err.message : 'Änderung nicht verwertbar.' };
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

/** Verdichtete Zahlen des Arbeitsplans (sonst des aktiven Treibers) — für ZOE und die Startfläche, ohne Zeilen und Buchungen. */
export function kennzahlenVon(d: FinanzDaten) {
  const ps = arbeitsplanVon(d);
  const { d: dd, sz, ug, pr, kz } = rechneMit(d, ps);
  const aw = auswertung(dd, ug, pr);
  const ziele = zielStaende(dd, ug, pr).map(z => ({ id: z.ziel.id, name: z.ziel.name, status: z.status, erreichtMonat: z.erreichtMonat }));
  return {
    szenario: sz.name, szenarioId: sz.id, arbeitsplan: ps?.name ?? null, arbeitsplanId: ps?.id ?? null, stand: d.stand, heute: d.einstellungen.heute,
    ...kz,
    freiJetzt: aw.frei.gesamt, runwayUG: aw.runway.ug, runwayPrivat: aw.runway.privat, runwayHorizont: aw.runway.horizont,
    zieleImPlan: aw.ziele.imPlan, zieleGesamt: aw.ziele.gesamt, mindestumsatz: aw.mindestumsatz.schnitt12, steuerRuecklage: aw.steuer.ruecklage,
    privatLuftOkt: pr[0]?.luft ?? 0, ugFreiDez26: ug[2]?.frei ?? 0,
    offeneBuchungen: offeneBuchungen(d), faelligePosten: faelligeZahl(d),
    kontostaendeFehlen: d.posten.filter(p => p.art === 'konto' && p.betrag == null).length,
    ziele,
  };
}
