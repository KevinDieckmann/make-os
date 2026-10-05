// ─── 0-Punkt (Eröffnung) — Speicher und Laden (Server, 05.10.) ─────────────────────────────────────────────────────────────────
// EIN Bestand `business-eroeffnung` (`{ eintraege: Eroeffnung[] }`): jede Änderung ist ein neuer Eintrag (der alte bleibt), „Rückgängig“
// setzt `zurueckgenommenAm` am jüngsten — der vorige gilt wieder. Nichts wird gelöscht. Regeln und Wirkung: lib/business/eroeffnung.ts.
// Wer serverseitig Firmen-Konten oder Business-Posten summiert, nimmt `mitEroeffnung(bestand)` (lädt die geltenden Eröffnungen und
// ruft `abEroeffnung`) — eine Stelle statt verstreuter Sonderfälle.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import {
  EROEFFNUNG_BESTAND, abEroeffnung, archivZahlen, eroeffnungPruefen, geltendeEroeffnungen, rechnungVor, zahlungVor, planpostenVor, abschlussVor, eroeffnungVon,
  type AbEroeffnung, type ArchivZahl, type Eroeffnung, type EroeffnungsBestand, type FinanzBundle, type Geltende,
} from './eroeffnung';

/** Alle Einträge (Historie), so wie gespeichert. */
export async function ladeEroeffnungen(): Promise<Eroeffnung[]> {
  const d = await loadJson<EroeffnungsBestand>(EROEFFNUNG_BESTAND);
  return Array.isArray(d?.eintraege) ? d.eintraege : [];
}

/** Die geltende Eröffnung je Business-Gesellschaft (leer = keine, alles wie bisher). */
export async function geltendeLaden(): Promise<Geltende> {
  return geltendeEroeffnungen(await ladeEroeffnungen());
}

/** DIE Server-Hilfe: einen Bestand (Konten, Rechnungen, Zahlungen, Planposten) ab dem 0-Punkt rechnen. */
export async function mitEroeffnung<B extends FinanzBundle>(b: B, g?: Geltende): Promise<AbEroeffnung<B>> {
  return abEroeffnung(b, g ?? await geltendeLaden());
}

export type Schreiben = { ok: true; eintrag: Eroeffnung | null; geltend: Geltende } | { ok: false; status: 400 | 409; fehler: string; geltend?: Geltende };

/**
 * Eröffnung setzen oder ändern — immer ein NEUER Eintrag. `basis` (optional): Kennung der geltenden Eröffnung, die die Oberfläche gesehen hat
 * (null = keine); weicht sie ab, hat inzwischen jemand anders gespeichert → 409 mit dem aktuellen Stand.
 */
export async function speichereEroeffnung(roh: Record<string, unknown>, von: string, jetzt = new Date()): Promise<Schreiben> {
  const p = eroeffnungPruefen(roh);
  if (!p.ok) return { ok: false, status: 400, fehler: p.fehler };
  let ergebnis: Schreiben = { ok: false, status: 400, fehler: 'Nicht gespeichert.' };
  await updateJson<EroeffnungsBestand>(EROEFFNUNG_BESTAND, alt => {
    const liste = Array.isArray(alt?.eintraege) ? alt!.eintraege : [];
    const g = geltendeEroeffnungen(liste);
    if ('basis' in roh && (roh.basis ?? null) !== (g[p.daten.firma]?.id ?? null)) {
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand die Eröffnung geändert — der aktuelle Stand ist geladen, bitte noch einmal prüfen.', geltend: g };
      return alt ?? { eintraege: [] };
    }
    const eintrag: Eroeffnung = { id: neueKennung('er'), ...p.daten, gesetztVon: von, gesetztAm: jetzt.toISOString() };
    const neu = [...liste, eintrag];
    ergebnis = { ok: true, eintrag, geltend: geltendeEroeffnungen(neu) };
    return { eintraege: neu };
  });
  const fertig = ergebnis as Schreiben; // im Rückruf gesetzt — TS sieht das nicht
  if (fertig.ok && fertig.eintrag) await protokolliere(EROEFFNUNG_BESTAND, [{ liste: 'eintraege', op: 'neu', id: fertig.eintrag.id, felder: Object.keys(p.daten) }], { art: 'person', person: von }, jetzt);
  return fertig;
}

/** Rückgängig: die geltende Eröffnung der Gesellschaft zurücknehmen (bleibt in der Historie) — die vorige gilt wieder bzw. keine. */
export async function nimmEroeffnungZurueck(firma: Gesellschaftskennung, von: string, basis: unknown, jetzt = new Date()): Promise<Schreiben> {
  let ergebnis: Schreiben = { ok: false, status: 400, fehler: `${finanzOrtName(firma)} hat keine Eröffnung, die zurückgenommen werden kann.` };
  let id: string | null = null;
  await updateJson<EroeffnungsBestand>(EROEFFNUNG_BESTAND, alt => {
    const liste = Array.isArray(alt?.eintraege) ? alt!.eintraege : [];
    const g = geltendeEroeffnungen(liste);
    const jetzige = g[firma];
    if (!jetzige) return alt ?? { eintraege: [] };
    if (basis !== undefined && basis !== jetzige.id) {
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand die Eröffnung geändert — der aktuelle Stand ist geladen.', geltend: g };
      return alt ?? { eintraege: [] };
    }
    id = jetzige.id;
    const neu = liste.map(e => (e.id === jetzige.id ? { ...e, zurueckgenommenAm: jetzt.toISOString(), zurueckgenommenVon: von } : e));
    ergebnis = { ok: true, eintrag: null, geltend: geltendeEroeffnungen(neu) };
    return { eintraege: neu };
  });
  if (ergebnis.ok && id) await protokolliere(EROEFFNUNG_BESTAND, [{ liste: 'eintraege', op: 'geaendert', id, felder: ['zurueckgenommenAm'] }], { art: 'person', person: von }, jetzt);
  return ergebnis;
}

// ── Was vor dem 0-Punkt liegt (Ansicht „archiviert“) ──────────────────────────────────────────────────────────────────────────────

interface RohR { id: string; firmaId?: string; kunde: string; titel: string; betrag: number; status: string; datum?: string; faellig?: string; bezahltAm?: string }
interface RohZ { id: string; firmaId?: string; an: string; titel: string; betrag: number; status: string; faellig?: string }
interface RohP { id: string; firmaId?: string; titel: string; betrag: number; rhythmus: string; ab: string; bis?: string }
interface RohA { firma: string; monat: string; umsatz?: number; kosten?: number }

export interface ArchivAnsicht {
  zahlen: Partial<Record<Gesellschaftskennung, ArchivZahl>>;
  /** Je Gesellschaft die archivierten Posten (nur Felder zum Anzeigen). */
  posten: Partial<Record<Gesellschaftskennung, {
    rechnungen: Pick<RohR, 'id' | 'kunde' | 'titel' | 'betrag' | 'status' | 'datum' | 'faellig'>[];
    zahlungen: Pick<RohZ, 'id' | 'an' | 'titel' | 'betrag' | 'status' | 'faellig'>[];
    planposten: Pick<RohP, 'id' | 'titel' | 'betrag' | 'rhythmus' | 'ab' | 'bis'>[];
    abschluesse: Pick<RohA, 'monat' | 'umsatz' | 'kosten'>[];
  }>>;
}

/** Archivierte Posten der Business-Gesellschaften mit Eröffnung — nur Firmen-Posten dieser Gesellschaften (nie Privates). */
export async function archivAnsicht(g: Geltende): Promise<ArchivAnsicht> {
  const [fp, lp, ab, bu] = await Promise.all([
    loadJson<{ rechnungen?: RohR[]; zahlungen?: RohZ[] }>('finanzplan'),
    loadJson<{ posten?: RohP[] }>('liquiplan'),
    loadJson<{ eintraege?: RohA[] }>('business-abschluesse'),
    loadJson<{ buchungen?: { datum?: string; ort?: string }[] }>('buchungen'),
  ]);
  const q = { rechnungen: fp?.rechnungen ?? [], zahlungen: fp?.zahlungen ?? [], planposten: lp?.posten ?? [], abschluesse: ab?.eintraege ?? [], buchungen: bu?.buchungen ?? [] };
  const posten: ArchivAnsicht['posten'] = {};
  for (const e of Object.values(g)) {
    if (!e) continue;
    const meine = (firma: string | undefined) => eroeffnungVon(firma, g)?.firma === e.firma;
    posten[e.firma] = {
      rechnungen: q.rechnungen.filter(r => meine(r.firmaId) && rechnungVor(r, g)).map(r => ({ id: r.id, kunde: r.kunde, titel: r.titel, betrag: r.betrag, status: r.status, ...(r.datum ? { datum: r.datum } : {}), ...(r.faellig ? { faellig: r.faellig } : {}) })),
      zahlungen: q.zahlungen.filter(z => meine(z.firmaId) && zahlungVor(z, g)).map(z => ({ id: z.id, an: z.an, titel: z.titel, betrag: z.betrag, status: z.status, ...(z.faellig ? { faellig: z.faellig } : {}) })),
      planposten: q.planposten.filter(p => meine(p.firmaId) && planpostenVor(p, g)).map(p => ({ id: p.id, titel: p.titel, betrag: p.betrag, rhythmus: p.rhythmus, ab: p.ab, ...(p.bis ? { bis: p.bis } : {}) })),
      abschluesse: q.abschluesse.filter(a => meine(a.firma) && abschlussVor(a, g)).map(a => ({ monat: a.monat, ...(a.umsatz != null ? { umsatz: a.umsatz } : {}), ...(a.kosten != null ? { kosten: a.kosten } : {}) })),
    };
  }
  return { zahlen: archivZahlen(g, q), posten };
}
