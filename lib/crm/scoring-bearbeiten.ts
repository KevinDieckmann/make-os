// ─── Scoring-Einstellungen bearbeiten — reine Hilfen für den Editor (03.10., getestet) ─────────
// Kevin will „selbst spielen“ können: Kriterien hinzufügen, entfernen, umbenennen, Stufen und Gewichte ändern. Der Editor
// arbeitet auf einem Entwurf (tiefe Kopie); diese Funktionen bauen daraus den nächsten Entwurf — nie am Original, immer
// gültig im Sinne von `scoringPruefen` (Kennungen eindeutig, Muss-Kriterien ohne tote Verweise).

import { MESSUNGEN, type MessungId, type ScoringEinstellungen, type ScoringKriterium, type ScoringSeiteId, type ScoringStufe, type ScoringTeil } from './scoring';

export const kopie = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Eine freie Kennung aus einem Namen: klein, ohne Umlaute, eindeutig gegen `belegt`. */
export function idAusName(name: string, belegt: ReadonlySet<string> | readonly string[], vorgabe = 'frage'): string {
  const b = new Set(belegt);
  const basis = (name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || vorgabe).replace(/^[^a-z]+/, '') || vorgabe;
  let id = basis.slice(0, 26);
  for (let n = 2; b.has(id); n++) id = `${basis.slice(0, 24)}-${n}`;
  return id;
}

/** Alle Kriterien-Kennungen einer Seite. */
export const kriterienIds = (e: ScoringEinstellungen, seite: ScoringSeiteId): string[] => e[seite].teile.flatMap(t => t.kriterien.map(k => k.id));

/** Noch nicht verwendete Messungen einer Marketing-Seite — das, was man „hinzufügen“ kann. */
export function freieMessungen(e: ScoringEinstellungen): MessungId[] {
  const belegt = new Set(e.marketing.teile.flatMap(t => t.kriterien.map(k => k.messung)));
  return (Object.keys(MESSUNGEN) as MessungId[]).filter(m => !belegt.has(m) && m !== 'waerme' && m !== 'eignung');
}

/** Standard-Punkte (1 · 3 · 5) für eine neue Messung — die besten Stufen oben, „keine“ mit 0. */
export function stufenAusMessung(m: MessungId): ScoringStufe[] {
  const st = MESSUNGEN[m].stufen;
  const nullStufen = new Set(['keine', 'nein', 'offen']);
  const mitPunkten = st.filter(s => !nullStufen.has(s.id));
  const werte = mitPunkten.length >= 3 ? [5, 3, 1] : mitPunkten.length === 2 ? [5, 3] : [5];
  return st.map(s => ({ id: s.id, text: s.text, punkte: nullStufen.has(s.id) ? 0 : (werte[mitPunkten.indexOf(s)] ?? 1) }));
}

/** Ein Marketing-Kriterium aus dem Katalog der Messungen (zum „hinzufügen“). */
export function kriteriumAusMessung(e: ScoringEinstellungen, m: MessungId): ScoringKriterium {
  return { id: idAusName(m, kriterienIds(e, 'marketing'), 'signal'), name: MESSUNGEN[m].label, hinweis: MESSUNGEN[m].hinweis, quelle: 'messung', messung: m, stufen: stufenAusMessung(m) };
}

/** Eine eigene Sales-Frage mit den vier Stufen 5 · 3 · 1 · 0 (Texte zum Überschreiben). */
export function frageNeu(e: ScoringEinstellungen, name: string): ScoringKriterium {
  const n = name.trim() || 'Neue Frage';
  return {
    id: idAusName(n, kriterienIds(e, 'sales')), name: n, hinweis: '', quelle: 'frage',
    stufen: [{ id: 's5', text: 'Trifft voll zu', punkte: 5 }, { id: 's3', text: 'Trifft teilweise zu', punkte: 3 }, { id: 's1', text: 'Trifft kaum zu', punkte: 1 }, { id: 's0', text: 'Trifft nicht zu', punkte: 0 }],
  };
}

/** Neue Stufe: die nächste freie Kennung, Punkte 0 — Text und Punkte setzt der Aufrufer. */
export function stufeNeu(k: ScoringKriterium): ScoringStufe {
  const belegt = new Set(k.stufen.map(s => s.id));
  let n = k.stufen.length + 1;
  while (belegt.has(`s${n}`)) n++;
  return { id: `s${n}`, text: 'Neue Stufe', punkte: 0 };
}

export function kriteriumHinzufuegen(e: ScoringEinstellungen, seite: ScoringSeiteId, teilId: string, k: ScoringKriterium): ScoringEinstellungen {
  const n = kopie(e);
  const t = n[seite].teile.find(x => x.id === teilId) ?? n[seite].teile[0];
  t.kriterien.push(k);
  return n;
}

/** Ein Kriterium entfernen — und aus den Muss-Kriterien heraus (eine Muss-Regel ohne Kriterium entfällt; „mindestens“ passt sich an). */
export function kriteriumEntfernen(e: ScoringEinstellungen, seite: ScoringSeiteId, kriteriumId: string): ScoringEinstellungen {
  const n = kopie(e);
  const s = n[seite];
  s.teile = s.teile.map(t => ({ ...t, kriterien: t.kriterien.filter(k => k.id !== kriteriumId) })).filter(t => t.kriterien.length || s.teile.length === 1);
  s.muss = s.muss.map(m => ({ ...m, kriterien: m.kriterien.filter(i => i !== kriteriumId) })).filter(m => m.kriterien.length).map(m => ({ ...m, mindestens: Math.min(m.mindestens, m.kriterien.length) }));
  return n;
}

export function teilHinzufuegen(e: ScoringEinstellungen, seite: ScoringSeiteId, name: string): { e: ScoringEinstellungen; id: string } {
  const n = kopie(e);
  const id = idAusName(name || 'block', n[seite].teile.map(t => t.id), 'block');
  n[seite].teile.push({ id, name: name.trim() || 'Neuer Block', kriterien: [] });
  return { e: n, id };
}

/** Einen Block entfernen (mitsamt seinen Kriterien); der letzte Block bleibt. */
export function teilEntfernen(e: ScoringEinstellungen, seite: ScoringSeiteId, teilId: string): ScoringEinstellungen {
  const t = e[seite].teile.find(x => x.id === teilId);
  if (!t || e[seite].teile.length <= 1) return e;
  return t.kriterien.reduce((acc, k) => kriteriumEntfernen(acc, seite, k.id), (() => { const n = kopie(e); n[seite].teile = n[seite].teile.filter(x => x.id !== teilId); return n; })());
}

/** Wie viele Punkte eine Seite höchstens bringt (Summe der besten Stufen mal Gewicht, ohne deaktivierte Kriterien). */
export function maxPunkte(e: ScoringEinstellungen, seite: ScoringSeiteId): number {
  const s = e[seite];
  return Math.round(s.teile.reduce((a, t: ScoringTeil) => a + t.kriterien.filter(k => !k.aus).reduce((b, k) => b + Math.max(...k.stufen.map(x => x.punkte)) * (k.gewicht ?? 1), 0), 0) * 100) / 100;
}

/** Hat sich der Entwurf gegenüber dem Gespeicherten geändert? (ohne Vermerke) */
export function istGeaendert(a: ScoringEinstellungen, b: ScoringEinstellungen): boolean {
  const roh = (x: ScoringEinstellungen) => JSON.stringify({ ...x, geaendert: undefined, geaendertVon: undefined, quelle: undefined });
  return roh(a) !== roh(b);
}
