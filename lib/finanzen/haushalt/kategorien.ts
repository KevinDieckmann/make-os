// ─── Kategorien aufräumen ───────────────────────────────────────────────────
// Malins Cockpit hat 37 Kategorien mit Doppelungen (Mobilität / Mobilitaet,
// Tilgung / Kredit & Raten, …). Sie wollte auf etwa 15. Hier entsteht ein
// VORSCHLAG — angewandt wird erst nach eurer Freigabe. Zusammenlegen hängt
// Buchungen und Regeln um und merkt sich die alte Kennung als Alias, damit
// nichts ins Leere zeigt (etwa ein späterer Re-Import mit alter Kennung).

import type { Buchung, Kategorie, Regel, Stamm } from './typen';
import { normal } from './regeln';
import { ART } from './einordnung';

/** Bekannte Synonyme: alter/unscharfer Name → der Name, der bleibt. Aus Malins Altdaten-Zuordnung (KATEGORIE_ALT_NEU) und ihren eigenen Umbenennungen. */
export const SYNONYME: Record<string, string> = {
  'Mobilitaet': 'Mobilität', 'Fahrten & Verkehr': 'Mobilität', 'Verkehr': 'Mobilität',
  'Essen gehen': 'Essen auswärts',
  'Telekom & Internet': 'Abos & Verträge', 'Telekom': 'Abos & Verträge', 'Streaming': 'Abos & Verträge', 'Abos & Vertraege': 'Abos & Verträge',
  'Drogerie': 'Beauty & Pflege',
  'Kredit & Raten': 'Tilgung',
  'Sport & Fitness': 'Sport',
  'Software/Tech': 'Investitionen & Tech',
  'Geschenk': 'Geschenk & Familie', 'Erstattung': 'Erstattung / Retoure', 'Einmalig': 'Sonstige Einnahme',
  'Selbstständigkeit': 'Entnahme Kevin (Selbstständigkeit)',
};

const schluessel = (n: string) => normal(n).replace(/[^a-z0-9]/g, '');

export interface Zusammenlegung { von: string; nach: string; vonName: string; nachName: string; buchungen: number; regeln: number; grund: string }

/** Vorschläge: Schreibvarianten und bekannte Synonyme — nur zwischen gleichen Typen. */
export function vorschlag(stamm: Stamm, buchungen: Buchung[]): Zusammenlegung[] {
  const nutzung = (id: string) => ({ b: buchungen.filter(x => x.kategorie_id === id).length, r: stamm.regeln.filter(x => x.kategorie_id === id).length });
  const nachName = new Map(stamm.kategorien.map(k => [k.name, k]));
  const raus: Zusammenlegung[] = [];
  const vergeben = new Set<string>();
  // 1. Synonyme mit vorhandenem Ziel
  for (const k of stamm.kategorien) {
    const ziel = SYNONYME[k.name] ? nachName.get(SYNONYME[k.name]) : undefined;
    if (!ziel || ziel.id === k.id || ziel.typ !== k.typ) continue;
    const n = nutzung(k.id);
    raus.push({ von: k.id, nach: ziel.id, vonName: k.name, nachName: ziel.name, buchungen: n.b, regeln: n.r, grund: 'gleiche Bedeutung' });
    vergeben.add(k.id);
  }
  // 2. Schreibvarianten (Umlaute, Leerzeichen, Zeichen) — die meistgenutzte bleibt
  const gruppen = new Map<string, Kategorie[]>();
  for (const k of stamm.kategorien) {
    if (vergeben.has(k.id)) continue;
    const s = `${k.typ}|${schluessel(k.name)}`;
    gruppen.set(s, [...(gruppen.get(s) ?? []), k]);
  }
  for (const g of Array.from(gruppen.values())) {
    if (g.length < 2) continue;
    const sortiert = g.slice().sort((a, b) => (nutzung(b.id).b - nutzung(a.id).b) || (/[äöüß]/.test(b.name) ? 1 : 0) - (/[äöüß]/.test(a.name) ? 1 : 0));
    const bleibt = sortiert[0];
    for (const k of sortiert.slice(1)) {
      const n = nutzung(k.id);
      raus.push({ von: k.id, nach: bleibt.id, vonName: k.name, nachName: bleibt.name, buchungen: n.b, regeln: n.r, grund: 'andere Schreibweise' });
    }
  }
  return raus;
}

/** Leere Kategorien, die niemand braucht (keine Buchung, keine Regel, keine Einnahme-Art aus Malins Tabelle, kein Budget). */
export function ungenutzt(stamm: Stamm, buchungen: Buchung[]): Kategorie[] {
  return stamm.kategorien.filter(k => !buchungen.some(b => b.kategorie_id === k.id) && !stamm.regeln.some(r => r.kategorie_id === k.id)
    && !(k.typ === 'einnahme' && k.name in ART) && !k.monatsbudget && k.typ !== 'umbuchung');
}

/** Zusammenlegen anwenden: Buchungen und Regeln umhängen, Alias merken, alte Kategorie entfernen. Rein — schreibt nichts. */
export function anwenden(stamm: Stamm, buchungen: Buchung[], paare: { von: string; nach: string }[], jetzt: string): { stamm: Stamm; buchungen: Buchung[]; geaendert: number } {
  const ids = new Set(stamm.kategorien.map(k => k.id));
  const gueltig = paare.filter(p => p.von !== p.nach && ids.has(p.von) && ids.has(p.nach));
  const ziel = new Map(gueltig.map(p => [p.von, p.nach]));
  // Ketten auflösen (A → B, B → C ⇒ A → C)
  const endziel = (id: string) => { let x = id; for (let i = 0; i < 10 && ziel.has(x); i++) x = ziel.get(x)!; return x; };
  let geaendert = 0;
  const neuB = buchungen.map(b => {
    if (!b.kategorie_id || !ziel.has(b.kategorie_id)) return b;
    geaendert++;
    return { ...b, kategorie_id: endziel(b.kategorie_id), stand: b.stand + 1, geaendert: jetzt };
  });
  const regeln: Regel[] = stamm.regeln.map(r => (r.kategorie_id && ziel.has(r.kategorie_id) ? { ...r, kategorie_id: endziel(r.kategorie_id), stand: r.stand + 1 } : r));
  const aliase = { ...stamm.aliase };
  for (const [von] of Array.from(ziel.entries())) aliase[von] = endziel(von);
  for (const k of Object.keys(aliase)) aliase[k] = endziel(aliase[k]);
  return { stamm: { ...stamm, kategorien: stamm.kategorien.filter(k => !ziel.has(k.id)), regeln, aliase }, buchungen: neuB, geaendert };
}
