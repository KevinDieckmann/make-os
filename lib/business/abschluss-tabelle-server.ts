// ─── Monatsabschluss als Tabelle — Server: Vorschau, Übernehmen, Rückgängig (09.10.) ──────────────────────────────────────────────
// Regeln: lib/business/abschluss-tabelle.ts (rein). Geschrieben wird je Monat NUR über `speichereAbschluss`/`loescheAbschluss`
// (lib/business/speicher.ts) im Bereich der Route (Business-Index: Business-Gesellschaften, /api/privat/abschluss: Privat-Einheiten) — ein
// Bereich schreibt nie in den anderen. Das Lauf-Protokoll `abschluss-laeufe` hält NUR Kennung, Bereich, Gesellschaft, Monate und die alten/neuen
// Zahlen der eingefügten Felder (keine Personen) — für „Rückgängig“ (nur, was seitdem niemand geändert hat). Es wird VOR dem ersten Monat
// geschrieben: bricht die Übernahme ab, nimmt „Rückgängig“ trotzdem alles zurück, was schon steht (die übrigen Monate zählen als „schon zurück“).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { KERN_EINHEITEN, istGesellschaft, type Bereich, type Gesellschaftskennung } from '@/lib/einheiten';
import { datensaetzePruefen, auswahlAus, type VorschauAntwort } from '@/lib/tabelle/einfuegen';
import { abschlussFirmen, ladeAbschluesse, loescheAbschluss, speichereAbschluss } from './speicher';
import {
  ABSCHLUSS_FELDER, abschlussBasis, abschlussEingaben, abschlussPlan, abschlussVorschauZeilen, laufAusPlan, laufKurz, rueckPlan,
  type AbschlussLauf, type LaufKurz,
} from './abschluss-tabelle';

export const ABSCHLUSS_LAEUFE = 'abschluss-laeufe';
/** Abgeschlossene Läufe fallen nach so vielen Tagen beim nächsten Schreiben weg (danach kein Rückgängig mehr — die Abschlüsse bleiben). */
export const LAUF_HALTEN_TAGE = 400;
interface LaeufeDatei { v: 1; laeufe: AbschlussLauf[] }
const laeufeAus = (d: Partial<LaeufeDatei> | null) => (Array.isArray(d?.laeufe) ? d!.laeufe : []);

async function laeufeAendern(f: (l: AbschlussLauf[]) => AbschlussLauf[], jetzt = new Date()): Promise<void> {
  const grenze = jetzt.getTime() - LAUF_HALTEN_TAGE * 864e5;
  await updateJson<LaeufeDatei>(ABSCHLUSS_LAEUFE, cur => ({ v: 1, laeufe: f(laeufeAus(cur).map(l => ({ ...l }))).filter(l => l.status === 'laeuft' || Date.parse(l.am) >= grenze) }));
}

/** Die Läufe eines Bereichs (jüngste zuerst, Kurzform ohne Werte) — der andere Bereich sieht sie nie. */
export async function abschlussLaeufe(bereich: Bereich): Promise<LaufKurz[]> {
  return laeufeAus(await loadJson<LaeufeDatei>(ABSCHLUSS_LAEUFE)).filter(l => l.bereich === bereich).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 20).map(laufKurz);
}

export type Fehler = { ok: false; status: 400 | 404 | 409 | 413; fehler: string; vorschau?: VorschauAntwort };

const firmaIm = (bereich: Bereich, roh: unknown): Gesellschaftskennung | null => abschlussFirmen(bereich).find(f => f === roh) ?? null;
const firmenText = (bereich: Bereich) => KERN_EINHEITEN.filter(e => abschlussFirmen(bereich).includes(e.id)).map(e => e.label).join(' oder ') || 'keine im Bereich';

interface Vorbereitet { ok: true; firma: Gesellschaftskennung; plan: ReturnType<typeof abschlussPlan>; vorschau: VorschauAntwort }

async function vorbereiten(bereich: Bereich, roh: Record<string, unknown>, heute: string): Promise<Vorbereitet | Fehler> {
  const firma = firmaIm(bereich, roh.firma);
  if (!firma) {
    if (istGesellschaft(roh.firma)) return { ok: false, status: 400, fehler: bereich === 'business' ? 'Diese Gesellschaft gehört zu Privat — ihr Monatsabschluss steht unter Privat › Finanzplanung.' : 'Diese Gesellschaft gehört zum Business — ihr Monatsabschluss steht im Business-Cockpit.' };
    return { ok: false, status: 400, fehler: `Gesellschaft fehlt (${firmenText(bereich)}).` };
  }
  const d = datensaetzePruefen(roh.zeilen, [...ABSCHLUSS_FELDER]);
  if (!d.ok) return { ok: false, status: d.zuGross ? 413 : 400, fehler: d.fehler };
  const { eingaben, fehler, hinweise } = abschlussEingaben(d.datensaetze, heute);
  const bestehende = await ladeAbschluesse(bereich);
  const plan = abschlussPlan(eingaben, bestehende, firma);
  return {
    ok: true, firma, plan,
    vorschau: { ok: true, zeilen: abschlussVorschauZeilen(plan, fehler), basis: abschlussBasis(firma, plan.map(p => p.monat), bestehende), hinweise },
  };
}

/** Vorschau — schreibt nichts. */
export async function abschlussTabelleVorschau(bereich: Bereich, roh: Record<string, unknown>, heute = localDay()): Promise<VorschauAntwort | Fehler> {
  const v = await vorbereiten(bereich, roh, heute);
  return v.ok ? v.vorschau : v;
}

export type Uebernahme = { ok: true; laufId: string | null; geschrieben: number; text: string } | Fehler;

/**
 * Übernehmen — nur mit der `basis` genau dieser Vorschau (sonst 409 mit der neuen). `auswahl` (optional): nur diese Monate (Schlüssel der
 * Vorschau). Monate mit Fehler bleiben weg; „gleich“ wird nicht geschrieben. Je Monat über den vorhandenen Weg `speichereAbschluss`.
 */
export async function abschlussTabelleUebernehmen(bereich: Bereich, roh: Record<string, unknown>, person: string, jetzt = new Date()): Promise<Uebernahme> {
  const v = await vorbereiten(bereich, roh, localDay(jetzt));
  if (!v.ok) return v;
  if (v.vorschau.basis !== roh.basis) return { ok: false, status: 409, fehler: 'Inzwischen hat sich etwas geändert — die Vorschau ist neu geladen, bitte noch einmal prüfen.', vorschau: v.vorschau };
  const auswahl = auswahlAus(roh.auswahl);
  const plan = v.plan.filter(p => p.status !== 'gleich' && (!auswahl || auswahl.has(p.monat)));
  if (!plan.length) return { ok: true, laufId: null, geschrieben: 0, text: 'Nichts zu übernehmen — alles ist schon so eingetragen.' };
  const lauf = laufAusPlan(neueKennung('al'), bereich, v.firma, jetzt.toISOString(), plan);
  await laeufeAendern(l => [...l, lauf], jetzt);
  let geschrieben = 0;
  for (const p of plan) {
    const r = await speichereAbschluss({ firma: v.firma, monat: p.monat, ...Object.fromEntries(p.aenderungen.map(a => [a.feld, a.neu])) }, person, bereich);
    if (!r.ok) {
      // Nur möglich, wenn sich zwischendurch die Regeln änderten (Zukunft um Mitternacht) — der Lauf hält, was schon steht.
      await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status: 'teilweise' as const } : x)), jetzt);
      return { ok: false, status: 400, fehler: `${p.monat}: ${r.fehler} — ${geschrieben} Monat${geschrieben === 1 ? '' : 'e'} stehen schon (Rückgängig nimmt sie zurück).` };
    }
    geschrieben++;
  }
  await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status: 'uebernommen' as const } : x)), jetzt);
  return { ok: true, laufId: lauf.id, geschrieben, text: `${geschrieben} Monat${geschrieben === 1 ? '' : 'e'} übernommen.` };
}

export type Zurueck = { ok: true; zurueck: number; konflikte: string[]; schonZurueck: number; text: string } | Fehler;

/** Rückgängig — nur, was seitdem niemand geändert hat (`rueckPlan`); Konflikte bleiben stehen und werden genannt. */
export async function abschlussTabelleZurueck(bereich: Bereich, laufId: unknown, person: string, jetzt = new Date()): Promise<Zurueck> {
  const lauf = typeof laufId === 'string' ? laeufeAus(await loadJson<LaeufeDatei>(ABSCHLUSS_LAEUFE)).find(l => l.id === laufId && l.bereich === bereich) : undefined;
  if (!lauf) return { ok: false, status: 404, fehler: 'Diese Einfügung gibt es nicht (mehr).' };
  if (lauf.status === 'zurueckgenommen') return { ok: false, status: 409, fehler: 'Diese Einfügung ist schon zurückgenommen.' };
  const r = rueckPlan(lauf, await ladeAbschluesse(bereich));
  let zurueck = 0;
  for (const a of r.aktionen) {
    if (a.art === 'loeschen') { await loescheAbschluss(lauf.firma, a.monat, bereich); zurueck++; continue; }
    const s = await speichereAbschluss({ firma: lauf.firma, monat: a.monat, ...a.werte }, person, bereich);
    if (s.ok) zurueck++; else r.konflikte.push(a.monat);
  }
  const status: AbschlussLauf['status'] = r.konflikte.length ? 'teilweise' : 'zurueckgenommen';
  await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status, zurueck: { am: jetzt.toISOString(), zurueck: (x.zurueck?.zurueck ?? 0) + zurueck, konflikte: r.konflikte.length, schonZurueck: r.schon } } : x)), jetzt);
  const teile = [`${zurueck} Monat${zurueck === 1 ? '' : 'e'} zurückgenommen`];
  if (r.konflikte.length) teile.push(`${r.konflikte.length} seitdem geändert und deshalb stehen gelassen (${r.konflikte.join(', ')})`);
  if (r.schon) teile.push(`${r.schon} stand${r.schon === 1 ? '' : 'en'} schon so`);
  return { ok: true, zurueck, konflikte: r.konflikte, schonZurueck: r.schon, text: `${teile.join(' · ')}.` };
}

/** Die Aktionen der Tabelle in einer Route (Business-Index bzw. Privat) — ein Ort für beide. `null` = keine Tabellen-Aktion. */
export async function abschlussTabelleAktion(bereich: Bereich, b: Record<string, unknown>, person: string): Promise<{ status: number; body: unknown } | null> {
  if (b.aktion === 'tabelle_vorschau') { const r = await abschlussTabelleVorschau(bereich, b); return { status: r.ok ? 200 : r.status, body: r }; }
  if (b.aktion === 'tabelle_uebernehmen') { const r = await abschlussTabelleUebernehmen(bereich, b, person); return { status: r.ok ? 200 : r.status, body: r }; }
  if (b.aktion === 'tabelle_zurueck') { const r = await abschlussTabelleZurueck(bereich, b.laufId, person); return { status: r.ok ? 200 : r.status, body: r }; }
  return null;
}
