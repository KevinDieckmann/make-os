// ─── Checks — Auswertung (24.10., Innovations-Check) ────────────────────────────────────────────────────────────
// Nachbau der verbindlichen Referenz (Bauanleitung `referenz/scoring.js`, Kopie in tests/fixtures/check-referenz/scoring.cjs):
// für dieselben Eingaben dieselben Werte — der Wächter tests/check-auswertung.test.ts vergleicht beide mit den vier Testfällen der
// Anleitung und mit vielen Zufallsfällen. Regeln stehen in den Vorlagen-Daten (scoring.json, benchmarks.json, lead-scoring.json).
// Zahlen kommen NIE aus einem Sprachmodell — Stufe, Punkte, Lücken und Lead-Klasse rechnet nur diese Datei. Rein.

import { DIMENSION_JE_ABSCHNITT, alleFragen, fragenNachId, type FrageMitAbschnitt } from './katalog';
import type { CheckAntwort, CheckAntworten, CheckBenchmarks, CheckErgebnis, CheckKatalog, CheckLeadScore, CheckLuecke, CheckProfil, CheckRegeln, CheckVerhalten, DimKey, LeadScoringRegeln } from './typen';

/** Punkte einer Antwort (0–4) oder null, wenn sie nicht zählt (offen, Profil, Branchen-Modul, unbewerteter Beleg). */
export function punkteFuer(f: Pick<FrageMitAbschnitt, 'typ' | 'optionen'>, a: CheckAntwort | undefined): number | null {
  if (!a) return null;
  if (f.typ === 'beleg') return Number.isInteger(a.belegScore) ? (a.belegScore as number) : null;
  if (f.typ === 'einfach') {
    const opt = f.optionen?.find(o => o.id === a.optionIds?.[0]);
    return opt && typeof opt.punkte === 'number' ? opt.punkte : null;
  }
  if (f.typ === 'mehrfach') {
    const ids = a.optionIds ?? [];
    if (ids.some(id => id.endsWith('_keine'))) return 0;
    const n = ids.length;
    if (n === 0) return null;
    return n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
  }
  return null;
}

export const robotikRelevant = (p: CheckProfil, r: CheckRegeln): boolean => r.robotik.relevante_branchen.includes(p.branche ?? '') || p.logistik === true;

/** Stufe, Dimensionen, Gewichte und Genauigkeit — die Gesamtauswertung. */
export function auswerten(k: CheckKatalog, r: CheckRegeln, p: CheckProfil, antworten: CheckAntworten): CheckErgebnis {
  const nachId = fragenNachId(k);
  const summen: Partial<Record<DimKey, number>> = {}, anzahl: Partial<Record<DimKey, number>> = {};
  for (const [id, a] of Object.entries(antworten)) {
    const f = nachId[id];
    if (!f) continue;
    const dim = DIMENSION_JE_ABSCHNITT[f.abschnitt];
    if (!dim) continue;
    const pkt = punkteFuer(f, a);
    if (pkt === null) continue;
    summen[dim] = (summen[dim] ?? 0) + pkt;
    anzahl[dim] = (anzahl[dim] ?? 0) + 1;
  }
  const dims: Partial<Record<DimKey, number>> = {};
  for (const d of Object.keys(summen) as DimKey[]) dims[d] = Math.round((summen[d]! / (4 * anzahl[d]!)) * 100);

  // Plausibilitätsregel (Vorschlag aus scoring.json, der Inhaber bestätigt): ohne konkreten Beleg keine hohen Werte.
  const c5 = antworten.C5?.belegScore;
  if (dims.ki !== undefined && (c5 === 0 || c5 === 1)) dims.ki = Math.min(dims.ki, 60);
  const d6 = antworten.D6?.belegScore;
  if (dims.automatisierung !== undefined && d6 === 0) dims.automatisierung = Math.min(dims.automatisierung, 60);

  const robotik = robotikRelevant(p, r) && (anzahl.robotik ?? 0) > 0;
  const gewichte: Record<DimKey, number> = { strategie: 15, ki: 30, automatisierung: 30, daten: 10, robotik: robotik ? 5 : 0, team: robotik ? 10 : 15 };
  if (!robotik) delete dims.robotik;

  let gsumme = 0, gesamtSumme = 0;
  for (const [d, g] of Object.entries(gewichte) as [DimKey, number][]) {
    if (dims[d] === undefined || g === 0) continue;
    gesamtSumme += dims[d]! * g; gsumme += g;
  }
  const gesamt = gsumme ? Math.round(gesamtSumme / gsumme) : 0;
  const stufe = r.stufen.find(s => gesamt >= s.von && gesamt <= s.bis) ?? r.stufen[0];

  // Genauigkeit: mindestens 80 % der Fragen aus B bis E und G beantwortet.
  const kern = Object.values(nachId).filter(f => 'BCDEG'.includes(f.abschnitt));
  const beantwortet = kern.filter(f => punkteFuer(f, antworten[f.id]) !== null).length;
  const genauigkeit = kern.length && beantwortet / kern.length >= 0.8 ? 'genau' : 'vorlaeufig';

  return { dimensionen: dims, gewichte, gesamt, stufe: stufe.stufe, stufe_name: stufe.name, genauigkeit, robotik_gewertet: robotik };
}

/** Die drei größten Lücken: größter Abstand zum Branchenwert, bei Gleichstand der niedrigere eigene Wert zuerst. */
export function luecken(e: Pick<CheckErgebnis, 'dimensionen'>, b: CheckBenchmarks, branche: string | undefined): CheckLuecke[] {
  const werte = b.dimension_benchmark_start.werte_0_100;
  const bm = (branche && werte[branche]) || werte.default;
  return (Object.entries(e.dimensionen) as [DimKey, number][])
    .map(([d, v]) => ({ dimension: d, wert: v, branche: bm[d], abstand: bm[d] - v }))
    .sort((a, x) => x.abstand - a.abstand || a.wert - x.wert)
    .slice(0, 3);
}

/** Lead-Klasse A/B/C (Startwerte aus lead-scoring.json — der Inhaber kalibriert nach den ersten Gesprächen). */
export function leadPunkte(ls: LeadScoringRegeln, p: CheckProfil, e: Pick<CheckErgebnis, 'stufe'>, v: CheckVerhalten): CheckLeadScore {
  const wert = (tabelle: Record<string, number>, schluessel: string | undefined, rueckfall = 1): number =>
    schluessel !== undefined && Object.prototype.hasOwnProperty.call(tabelle, schluessel) ? tabelle[schluessel] : rueckfall;
  const t = ls.automatisch_aus_dem_check;
  let pkt = 0;
  pkt += wert(t[0].werte, p.groesse);
  pkt += wert(t[1].werte, p.umsatz ?? 'keine_angabe', 2);
  pkt += wert(t[2].werte, p.rolle);
  pkt += p.budgetPunkte === undefined ? t[3].fehlt : wert(t[3].werte_nach_punkten, String(p.budgetPunkte), t[3].fehlt);
  pkt += wert(t[4].werte, String(e.stufe), 1);
  pkt += v.gespraechGebucht ? 5 : v.berichtGeoeffnet ? 3 : 1;
  pkt += (v.gratisProdukte ?? 0) >= 2 ? 5 : v.gratisProdukte === 1 ? 3 : 1;
  let klasse: CheckLeadScore['klasse'] = pkt >= 26 ? 'A' : pkt >= 18 ? 'B' : 'C';
  // Start-up in der Ideen- oder Prototyp-Phase höchstens B (keine Mandate ohne fertiges Produkt, Ausnahme im Einzelfall).
  if (p.branche === 'tech' && p.startup && p.phase === 0 && klasse === 'A') klasse = 'B';
  return { punkte: pkt, klasse };
}

/** Profil aus den Antworten der A-Fragen (Codes der Optionen) + Budget (B2) + Start-up-Phase (J1). */
export function profilAus(k: CheckKatalog, antworten: CheckAntworten): CheckProfil {
  const nachId = fragenNachId(k);
  const p: CheckProfil = {};
  for (const f of alleFragen(k).filter(x => x.abschnitt === 'A' && x.feld)) {
    const a = antworten[f.id];
    const opt = f.optionen?.find(o => o.id === a?.optionIds?.[0]);
    if (!opt?.code) continue;
    (p as Record<string, unknown>)[f.feld!] = opt.code;
    if (opt.freitext && opt.freitext_feld && a?.optionText) (p as Record<string, unknown>)[opt.freitext_feld] = a.optionText;
    if (f.zusatz?.feld === 'startup' && typeof a?.zusatz === 'boolean') p.startup = a.zusatz;
  }
  const b2 = nachId.B2 && punkteFuer(nachId.B2, antworten.B2);
  if (typeof b2 === 'number') p.budgetPunkte = b2;
  const j1 = nachId.J1?.optionen?.find(o => o.id === antworten.J1?.optionIds?.[0]);
  if (typeof j1?.stufe === 'number') p.phase = j1.stufe;
  return p;
}

/** Geschätztes Potenzial in Stunden je Woche aus D7 (× 0,5, „realistisch in 90 Tagen“) — immer als Spanne und Schätzung zeigen. */
export function zeitPotenzial(r: CheckRegeln, antworten: CheckAntworten): { stunden: number; von: number; bis: number } | null {
  const id = antworten.D7?.optionIds?.[0];
  const h = id ? r.zeitersparnis_schaetzung.werte_stunden[id] : undefined;
  if (typeof h !== 'number') return null;
  const stunden = h * 0.5;
  return { stunden, von: Math.max(0, Math.floor(stunden * 0.75)), bis: Math.ceil(stunden * 1.25) };
}
