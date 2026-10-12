// ─── Unternehmen › Schild: Risiko-Register — Bewertung, Prüfrhythmus, Neubewertungs-Anlässe (rein, client-sicher, 10.10.) ──
// Research › 3b (ISO 31000 schlank, IDW-Konzept der Risikotragfähigkeit): je Risiko Eintritt 1–5 × Wirkung 1–5 (Skalen = Annahme der
// Recherche), brutto/netto, Behandlung, Maßnahmen, Frühwarn-Indikator, Verlauf der Bewertungen (nie überschrieben).
// Kevin 10.10.: „das Risiko immer wieder mitbewerten“ — QUARTALSWEISE neu bewerten und SOFORT bei Ereignissen (neuer Vertrag,
// Gesellschafterwechsel, Schwelle, Ereignis im Pflichten-Kalender). Der Startkatalog (17 generische Risiken) wird je Gesellschaft
// übernommen — ohne Namen, ohne Zahlen. Hinweis, keine Rechtsberatung.

import { aktiveEintraege, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import type { Bewertung, Risiko, RisikoKategorie, SchildGesellschaft, Stufe } from './typen';
import type { SchildKontext } from './kontext';
import { schwellenFuer, ereignisDef } from './pflichten';
import { monatePlus, quartal, quartalsBeginn } from './zeit';

export const EINTRITT_STUFEN: Record<Stufe, string> = { 1: 'unter 5 % im Jahr', 2: '5–15 %', 3: '15–35 %', 4: '35–60 %', 5: 'über 60 %' };
export const WIRKUNG_STUFEN: Record<Stufe, string> = { 1: 'unter 2 % der Tragfähigkeit', 2: '2–10 %', 3: '10–30 %', 4: '30–70 %', 5: 'über 70 % — bestandsgefährdend' };
/** Prüfrhythmus (Kevin 10.10.): alle drei Monate; Ereignisse stoßen sofort an. */
export const PRUEF_MONATE = 3;

export interface KatalogRisiko { id: string; titel: string; kategorie: RisikoKategorie; indikator: string; schild: string }
/** Startkatalog (research › 3b, R1–R17) — Vorlage je Gesellschaft. Kennungen nie ändern. */
export const RISIKO_KATALOG: readonly KatalogRisiko[] = [
  { id: 'R1', titel: 'Liquiditätsengpass bis Zahlungsunfähigkeit', kategorie: 'liquiditaet', indikator: 'Reichweite der Liquidität in Monaten (24-Monats-Plan), Warnung unter 3', schild: 'Liquiditätsplanung (§ 1 StaRUG), Kreditlinie, Forderungsmanagement' },
  { id: 'R2', titel: 'Bilanzielle Überschuldung / Hälfte des Stammkapitals verloren', kategorie: 'liquiditaet', indikator: 'Eigenkapital laut BWA', schild: 'Rangrücktritt, Fortbestehensprognose, Gesellschafterversammlung nach § 49 Abs. 3 GmbHG' },
  { id: 'R3', titel: 'Klumpenrisiko Großkunde', kategorie: 'kunden', indikator: 'Umsatzanteil des größten Kunden, Warnung über 30 %', schild: 'Diversifikation, Kündigungsfristen in Verträgen' },
  { id: 'R4', titel: 'Ausfall einer Schlüsselperson (z. B. Alleingesellschafter-Geschäftsführung)', kategorie: 'personen', indikator: 'Vertretung geregelt ja/nein', schild: 'Notfall- und Vertretungsplan, Vorsorgevollmacht, Key-Person-Absicherung' },
  { id: 'R5', titel: 'Fristversäumnis bei Steuern, Offenlegung oder Register', kategorie: 'recht', indikator: 'Offene Pflichten im Pflichten-Kalender', schild: 'Pflichten-Kalender, Steuerberatungs-Mandat' },
  { id: 'R6', titel: 'Verdeckte Gewinnausschüttung / Gesellschafterverträge steuerlich nicht anerkannt', kategorie: 'steuern', indikator: 'Verträge mit Gesellschaftern ohne Datum oder Unterschrift', schild: 'Vertragsakte, Beschlüsse im Voraus' },
  { id: 'R7', titel: 'SV-Nachforderung Gesellschafter-GF / Scheinselbständigkeit', kategorie: 'personen', indikator: 'Anteilsänderung, Dauer-Freelancer', schild: 'Statusfeststellung' },
  { id: 'R8', titel: 'Datenpanne, Cyberangriff, Ransomware', kategorie: 'it', indikator: 'Datum des letzten Backup-Tests, Abdeckung zweiter Faktor', schild: 'TOM, Notfallhandbuch IT, Cyber-Police' },
  { id: 'R9', titel: 'DSGVO-Verstoß (fehlende AVV/VVT, Art. 13)', kategorie: 'recht', indikator: 'Ampel der Datenschutz-Selbstprüfung', schild: 'Datenschutz-Akte (Einstellungen › Datenschutz)' },
  { id: 'R10', titel: 'Haftung aus Kundenverträgen (unbegrenzt, Pönalen)', kategorie: 'recht', indikator: 'Verträge ohne Haftungsbegrenzung', schild: 'Klausel-Checkliste, Vermögensschaden-Haftpflicht' },
  { id: 'R11', titel: 'Verlust von Marken-, Domain- oder IP-Rechten', kategorie: 'recht', indikator: 'Ablaufdaten; Inhaber ≠ Gesellschaft', schild: 'Marken-/Domain-Wächter, Rechte-Kette' },
  { id: 'R12', titel: 'Holding-Steuerprivilegien verloren / Organschaft gescheitert', kategorie: 'struktur', indikator: 'Beteiligungsquote zum 01.01., Durchführung des GAV', schild: 'Holding-Check im Pflichten-Kalender' },
  { id: 'R13', titel: 'Gesellschafterstreit / Patt', kategorie: 'struktur', indikator: 'Stimmverteilung 50/50', schild: 'Gesellschaftervereinbarung, Pattauflösung' },
  { id: 'R14', titel: 'Verflechtung Privat ↔ Firma (Bürgschaften, Privatdarlehen, gemeinsame Konten)', kategorie: 'verflechtung', indikator: 'Anzahl privater Sicherheiten', schild: 'Getrennte Konten, Darlehensverträge, Bürgschaftsliste' },
  { id: 'R15', titel: 'Regulatorische Schwelle überschritten (BFSG, DSB, HinSchG, NIS2, E-Rechnung)', kategorie: 'recht', indikator: 'Beschäftigte, Umsatz', schild: 'Schwellen-Wächter im Pflichten-Kalender' },
  { id: 'R16', titel: 'Reputation (Bewertungen, Social Media, KI-Texte ohne Kennzeichnung)', kategorie: 'reputation', indikator: '—', schild: 'Freigabeprozess, KI-Kennzeichnung' },
  { id: 'R17', titel: 'Abhängigkeit von Kern-Dienstleistern (Cloud, Bank, Steuerberatung)', kategorie: 'lieferanten', indikator: 'Kündigungs-/Ausfallszenario', schild: 'Exit-Plan, AVV, Datenexport' },
];

export type RisikoAmpel = 'rot' | 'gelb' | 'gruen' | 'offen';
export const score = (b: Pick<Bewertung, 'eintritt' | 'wirkung'>) => b.eintritt * b.wirkung;
/** rot ≥ 15 oder Wirkung 5 (bestandsgefährdend), gelb 8–14, grün ≤ 7 (research › 3b, Annahme). */
export function ampelVon(b: Pick<Bewertung, 'eintritt' | 'wirkung'> | undefined): RisikoAmpel {
  if (!b) return 'offen';
  const s = score(b);
  return s >= 15 || b.wirkung === 5 ? 'rot' : s >= 8 ? 'gelb' : 'gruen';
}

/** Die maßgebliche Bewertung: jüngste netto (nach Maßnahmen), sonst jüngste brutto. */
export function aktuelleBewertung(r: Pick<Risiko, 'bewertungen'>): Bewertung | undefined {
  const l = [...(r.bewertungen ?? [])].map((b, i) => ({ b, i })).sort((x, y) => y.b.am.localeCompare(x.b.am) || y.i - x.i).map(x => x.b);
  return l.find(b => b.art === 'netto') ?? l.find(b => b.art === 'brutto');
}
export const juengsteBewertung = (r: Pick<Risiko, 'bewertungen'>): Bewertung | undefined =>
  [...(r.bewertungen ?? [])].sort((a, b) => b.am.localeCompare(a.am))[0];

/** Nächste Prüfung: drei Monate nach der jüngsten Bewertung; ohne Bewertung sofort (Tag des Anlegens). */
export function naechstePruefung(r: Pick<Risiko, 'bewertungen' | 'angelegt' | 'status'>, heute: string): string | undefined {
  if (r.status === 'erledigt') return undefined;
  const j = juengsteBewertung(r);
  return j ? monatePlus(j.am, PRUEF_MONATE) : (r.angelegt?.slice(0, 10) ?? heute);
}

export interface RisikoZeile { r: Risiko; bewertung?: Bewertung; ampel: RisikoAmpel; score?: number; naechste?: string; ueberfaellig: boolean; ohneMassnahme: boolean }
export function risikoZeilen(s: SchildGesellschaft | null | undefined, heute: string): RisikoZeile[] {
  const rang: Record<RisikoAmpel, number> = { rot: 0, offen: 1, gelb: 2, gruen: 3 };
  return aktiveEintraege(s?.risiken).map(r => {
    const b = aktuelleBewertung(r);
    const naechste = naechstePruefung(r, heute);
    const ampel = r.status === 'erledigt' ? 'gruen' : ampelVon(b);
    return {
      r, ...(b ? { bewertung: b, score: score(b) } : {}), ampel, ...(naechste ? { naechste } : {}), ueberfaellig: !!naechste && naechste <= heute,
      ohneMassnahme: (ampel === 'rot' || ampel === 'gelb') && !(r.massnahmen ?? []).some(m => !m.erledigt) && r.behandlung !== 'tragen' && r.behandlung !== 'uebertragen',
    };
  }).sort((a, b) => rang[a.ampel] - rang[b.ampel] || (b.score ?? 0) - (a.score ?? 0) || a.r.titel.localeCompare(b.r.titel, 'de'));
}

/** Letzte Risiko-Runde: die jüngste Bewertung über alle Risiken (Tag) — `undefined`, solange keins bewertet ist. */
export function letzteRunde(s: SchildGesellschaft | null | undefined): string | undefined {
  return aktiveEintraege(s?.risiken).flatMap(r => r.bewertungen ?? []).map(b => b.am).sort().pop();
}

export interface Anlass { id: string; text: string; am: string }
/**
 * Anlässe für eine SOFORTIGE Neubewertung seit der letzten Runde (rein): Ereignisse im Pflichten-Kalender, neue Verträge im Register
 * (Beginn), Gesellschafterwechsel (Ein-/Austritt), eine erreichte Schwelle (Profil danach geändert). Ohne Risiken keine Anlässe.
 */
export function neuBewertenAnlaesse(g: RegisterGesellschaft, s: SchildGesellschaft | null | undefined, k: SchildKontext, heute: string): Anlass[] {
  if (!aktiveEintraege(s?.risiken).length) return [];
  const seit = letzteRunde(s) ?? '';
  const raus: Anlass[] = [];
  for (const e of aktiveEintraege(s?.ereignisse)) if (e.datum > seit && e.datum <= heute) raus.push({ id: `ev:${e.id}`, text: `Ereignis: ${ereignisDef(e.art)?.label ?? e.art}`, am: e.datum });
  for (const v of aktiveEintraege(g.vertraege)) if (v.status !== 'beendet' && v.beginn && v.beginn > seit && v.beginn <= heute) raus.push({ id: `vt:${v.id}`, text: `Neuer Vertrag: ${v.titel}`, am: v.beginn });
  for (const x of aktiveEintraege(g.gesellschafter)) {
    if (x.eingetretenAm && x.eingetretenAm > seit && x.eingetretenAm <= heute) raus.push({ id: `gs:${x.id}:ein`, text: 'Gesellschafterwechsel (Eintritt)', am: x.eingetretenAm });
    if (x.ausgeschiedenAm && x.ausgeschiedenAm > seit && x.ausgeschiedenAm <= heute) raus.push({ id: `gs:${x.id}:aus`, text: 'Gesellschafterwechsel (Austritt)', am: x.ausgeschiedenAm });
  }
  const pg = s?.profil?.geaendert?.slice(0, 10);
  if (pg && pg > seit) for (const z of schwellenFuer(k, s)) if (z.stand === 'erreicht' && !z.umgesetzt) raus.push({ id: `sw:${z.def.id}`, text: `Schwelle erreicht: ${z.def.titel}`, am: pg });
  return raus.sort((a, b) => b.am.localeCompare(a.am));
}

/** Quartals-Runde fällig? Ja, wenn ein offenes Risiko seine Prüfung erreicht hat. Kennung der Runde = Quartal (idempotent). */
export function rundeFaellig(s: SchildGesellschaft | null | undefined, heute: string): { faellig: boolean; quartal: string; seit: string; anzahl: number } {
  const z = risikoZeilen(s, heute).filter(x => x.r.status !== 'erledigt' && x.ueberfaellig);
  return { faellig: z.length > 0, quartal: quartal(heute), seit: quartalsBeginn(heute), anzahl: z.length };
}

/**
 * Aggregation gegen die Tragfähigkeit (IDW-Konzept, Fach): Summe der Netto-Wirkungen in Geld aller roten/gelben Risiken. Warnung, wenn
 * die Summe die Tragfähigkeit übersteigt — mehrere Einzelrisiken zusammen können bestandsgefährdend sein.
 */
export function aggregation(s: SchildGesellschaft | null | undefined, heute: string): { summeCent: number; tragfaehigkeitCent?: number; anteil?: number; warnung: boolean; ohneBetrag: number } {
  const z = risikoZeilen(s, heute).filter(x => x.ampel === 'rot' || x.ampel === 'gelb');
  const summeCent = z.reduce((n, x) => n + (x.bewertung?.wirkungCent ?? 0), 0);
  const t = s?.profil?.tragfaehigkeitCent;
  const anteil = t && t > 0 ? Math.round((summeCent / t) * 100) : undefined;
  return { summeCent, ...(t ? { tragfaehigkeitCent: t } : {}), ...(anteil !== undefined ? { anteil } : {}), warnung: anteil !== undefined && anteil > 100, ohneBetrag: z.filter(x => x.bewertung && x.bewertung.wirkungCent === undefined).length };
}

export const katalogRisiko = (id: string) => RISIKO_KATALOG.find(r => r.id === id);
