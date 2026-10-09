// ─── 0-Punkt (Eröffnung) — Speicher und Laden (Server, 05.10.) ─────────────────────────────────────────────────────────────────
// EIN Bestand `business-eroeffnung` (`{ eintraege: Eroeffnung[] }`): jede Änderung ist ein neuer Eintrag (der alte bleibt), „Rückgängig“
// setzt `zurueckgenommenAm` am jüngsten — der vorige gilt wieder. Nichts wird gelöscht. Regeln und Wirkung: lib/business/eroeffnung.ts.
// Wer serverseitig Firmen-Konten oder Business-Posten summiert, nimmt `mitEroeffnung(bestand)` (lädt die geltenden Eröffnungen und
// ruft `abEroeffnung`) — eine Stelle statt verstreuter Sonderfälle.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import { mitRegister, type GesellschaftsKasse } from '@/lib/finanzen/konten/register';
import { registerKasseLaden, eroeffnungImRegister, eroeffnungZurueckgenommen } from '@/lib/finanzen/konten/server';
import {
  EROEFFNUNG_BESTAND, TAG, abEroeffnung, archivZahlen, eroeffnungPruefen, geltendeEroeffnungen, rechnungVor, zahlungVor, planpostenVor, abschlussVor, eroeffnungVon,
  type AbEroeffnung, type ArchivZahl, type Eroeffnung, type EroeffnungsBestand, type FinanzBundle, type Geltende,
} from './eroeffnung';
import {
  POSTEN_ARTEN, POSTEN_FELDER, fassungMit, listeZuLang, mitBezahlt, neueListe, postenEingaben, postenPlan, postenVorschauZeilen,
  type PostenArt, type PostenModus, type PostenPlanZeile,
} from './eroeffnung-tabelle';
import { auswahlAus, datensaetzePruefen, type VorschauAntwort } from '@/lib/tabelle/einfuegen';
import { localDay } from '@/lib/zeit';

/** Alle Einträge (Historie), so wie gespeichert. */
export async function ladeEroeffnungen(): Promise<Eroeffnung[]> {
  const d = await loadJson<EroeffnungsBestand>(EROEFFNUNG_BESTAND);
  return Array.isArray(d?.eintraege) ? d.eintraege : [];
}

/** Die geltende Eröffnung je Business-Gesellschaft (leer = keine, alles wie bisher). */
export async function geltendeLaden(): Promise<Geltende> {
  return geltendeEroeffnungen(await ladeEroeffnungen());
}

/**
 * DIE Server-Hilfe: einen Bestand (Konten, Rechnungen, Zahlungen, Planposten) ab dem 0-Punkt rechnen. Seit 08.10. zuerst mit dem Konten-Register
 * überlagert (lib/finanzen/konten: je Gesellschaft, die das Register führt, gilt dessen Kasse als Kontostand), dann der 0-Punkt wie bisher.
 * Ohne Register-Einträge: genau wie vorher (dieselben Listen).
 */
export async function mitEroeffnung<B extends FinanzBundle>(b: B, g?: Geltende, kasse?: GesellschaftsKasse): Promise<AbEroeffnung<B>> {
  return abEroeffnung(mitRegister(b, kasse ?? await registerKasseLaden()), g ?? await geltendeLaden());
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
  if (fertig.ok && fertig.eintrag) {
    await protokolliere(EROEFFNUNG_BESTAND, [{ liste: 'eintraege', op: 'neu', id: fertig.eintrag.id, felder: Object.keys(p.daten) }], { art: 'person', person: von }, jetzt);
    // Konten-Register (08.10.): führt es die Gesellschaft schon, ist der Anfangsbestand dort ein Stand am Stichtag (sonst bleibt der 0-Punkt die Quelle).
    await eroeffnungImRegister(fertig.eintrag, von, jetzt);
  }
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
  if (ergebnis.ok && id) {
    await protokolliere(EROEFFNUNG_BESTAND, [{ liste: 'eintraege', op: 'geaendert', id, felder: ['zurueckgenommenAm'] }], { art: 'person', person: von }, jetzt);
    // Konten-Register (08.10.): der Stand dieses 0-Punkts zählt dort ebenso nicht mehr (bleibt in der Historie).
    await eroeffnungZurueckgenommen(id, firma, von, jetzt, (ergebnis as Schreiben).geltend?.[firma] ?? null);
  }
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

// ── Offene Posten als Tabelle einfügen + „bezahlt am“ (09.10., B9 b / L34) ─────────────────────────────────────────────────────────────
// Regeln: lib/business/eroeffnung-tabelle.ts (rein). Jede Übernahme ist eine NEUE FASSUNG über `speichereEroeffnung` (Historie bleibt, `basis` =
// Kennung der geltenden Fassung → 409); „Rückgängig“ = das vorhandene Zurücknehmen dieser Fassung. Ohne geltende Eröffnung gibt es nichts zu
// ergänzen (erst Stichtag und Kontostand setzen).

export type PostenFehlerAntwort = { ok: false; status: 400 | 409 | 413; fehler: string; vorschau?: VorschauAntwort; geltend?: Geltende };

interface PostenVorbereitet { ok: true; e: Eroeffnung; art: PostenArt; modus: PostenModus; plan: PostenPlanZeile[]; vorschau: VorschauAntwort }

async function postenVorbereiten(roh: Record<string, unknown>, heute: string): Promise<PostenVorbereitet | PostenFehlerAntwort> {
  const firma = roh.firma as Gesellschaftskennung;
  const art = POSTEN_ARTEN.find(a => a.id === roh.art)?.id;
  if (!art) return { ok: false, status: 400, fehler: 'Art fehlt (forderungen oder verbindlichkeiten).' };
  const modus: PostenModus = roh.modus === 'ersetzen' ? 'ersetzen' : 'ergaenzen';
  const g = await geltendeLaden();
  const e = g[firma];
  if (!e) return { ok: false, status: 409, fehler: `${finanzOrtName(firma)} hat noch keinen 0-Punkt — erst Stichtag und Kontostand setzen, dann die offenen Posten einfügen.`, geltend: g };
  const d = datensaetzePruefen(roh.zeilen, POSTEN_FELDER.map(f => f.id));
  if (!d.ok) return { ok: false, status: d.zuGross ? 413 : 400, fehler: d.fehler };
  const { eingaben, fehler, hinweise } = postenEingaben(d.datensaetze, heute);
  const { zeilen: plan, doppelt } = postenPlan(eingaben, e[art] ?? [], modus);
  return { ok: true, e, art, modus, plan, vorschau: { ok: true, zeilen: postenVorschauZeilen(plan, [...fehler, ...doppelt]), basis: e.id, hinweise } };
}

/** Vorschau — schreibt nichts. */
export async function postenVorschau(roh: Record<string, unknown>, heute = localDay()): Promise<VorschauAntwort | PostenFehlerAntwort> {
  const v = await postenVorbereiten(roh, heute);
  return v.ok ? v.vorschau : v;
}

export type PostenErgebnis = Schreiben | PostenFehlerAntwort | { ok: true; eintrag: null; geltend: Geltende; nichts: true };

/** Übernehmen — nur mit der `basis` (Kennung der geltenden Fassung) der gesehenen Vorschau; Ergebnis: neue Fassung (Rückgängig = zurücknehmen). */
export async function postenUebernehmen(roh: Record<string, unknown>, von: string, jetzt = new Date()): Promise<PostenErgebnis> {
  const v = await postenVorbereiten(roh, localDay(jetzt));
  if (!v.ok) return v;
  if (roh.basis !== v.e.id) return { ok: false, status: 409, fehler: 'Inzwischen hat jemand den 0-Punkt geändert — die Vorschau ist neu geladen, bitte noch einmal prüfen.', vorschau: v.vorschau };
  const liste = neueListe(v.plan, v.e[v.art] ?? [], v.modus, auswahlAus(roh.auswahl));
  const zuLang = listeZuLang(liste, v.art);
  if (zuLang) return { ok: false, status: 413, fehler: zuLang };
  if (JSON.stringify(liste) === JSON.stringify(v.e[v.art] ?? [])) return { ok: true, eintrag: null, geltend: await geltendeLaden(), nichts: true };
  return speichereEroeffnung({ ...fassungMit(v.e, v.art, liste), basis: v.e.id }, von, jetzt);
}

/** „Bezahlt am“ eines Postens setzen (`bezahltAm: null` = wieder offen) — neue Fassung mit Stand (`basis`, sonst 409). */
export async function postenBezahlt(roh: Record<string, unknown>, von: string, jetzt = new Date()): Promise<Schreiben | PostenFehlerAntwort> {
  const firma = roh.firma as Gesellschaftskennung;
  const art = POSTEN_ARTEN.find(a => a.id === roh.art)?.id;
  if (!art) return { ok: false, status: 400, fehler: 'Art fehlt (forderungen oder verbindlichkeiten).' };
  const tag = roh.bezahltAm === null ? null : typeof roh.bezahltAm === 'string' && TAG.test(roh.bezahltAm) ? roh.bezahltAm : undefined;
  if (tag === undefined) return { ok: false, status: 400, fehler: '„Bezahlt am“ als JJJJ-MM-TT (oder leer, um den Posten wieder zu öffnen).' };
  if (tag && tag > localDay(jetzt)) return { ok: false, status: 400, fehler: '„Bezahlt am“ liegt in der Zukunft.' };
  const g = await geltendeLaden();
  const e = g[firma];
  if (!e) return { ok: false, status: 409, fehler: `${finanzOrtName(firma)} hat keinen 0-Punkt.`, geltend: g };
  if (roh.basis !== e.id) return { ok: false, status: 409, fehler: 'Inzwischen hat jemand den 0-Punkt geändert — der aktuelle Stand ist geladen.', geltend: g };
  const liste = mitBezahlt(e[art] ?? [], Number(roh.index), tag);
  if (!liste) return { ok: false, status: 400, fehler: 'Diesen Posten gibt es in der geltenden Fassung nicht.' };
  return speichereEroeffnung({ ...fassungMit(e, art, liste), basis: e.id }, von, jetzt);
}
