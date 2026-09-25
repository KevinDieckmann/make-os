// ─── Die Heads lernen aus euren Entscheidungen (rein, getestet) ────────────
// Was die besten Agenten von mittelmäßigen unterscheidet: Sie merken sich,
// was angenommen und was abgelehnt wurde — und ob ein angenommener Vorschlag
// danach wirklich etwas bewegt hat. Drei Quellen, alle ohne Modell:
//   1. Entscheidungen je Art: vorgeschlagen, angenommen, abgelehnt → Quote.
//   2. Ablehnungsgründe (ein Tipp beim Ablehnen) → häufigste Gründe.
//   3. Wirkung: Kam nach dem Annehmen eine echte Aktivität an der Person
//      (bis Frist + 7 Tage)? Gemessen an Handlung, nicht an Klicks.
// Dazu Beispiele: die jüngsten angenommenen Vorschläge (mit Entwurf, so wie
// ihr ihn übernommen habt) als Muster, die jüngsten abgelehnten mit Grund als
// Warnung. Und das Gedächtnis: Merksätze, die ihr dem Head gebt oder die er
// vorschlägt und ihr annehmt. Alles geht als <lernen> ins Datenpaket.
// 25.09. nach der Recherche (ExpeL, Reflexion, Pega/Bizzabo):
//   · Beispiele nach Ähnlichkeit (gleicher Modus, gleiche Art) statt nur die jüngsten
//   · Änderungsgrad: wie stark ihr Entwürfe vor dem Übernehmen umschreibt
//   · Wirkungsleiter: Aktivität → Antwort → Termin → Chance, nicht nur „irgendwas passiert“

import type { Kontakt } from '@/lib/make-one/crm';
import type { HeadVorschlag } from './stand';
import type { CrmBestand } from '@/lib/crm/typen';

export const ABLEHNGRUENDE = [
  { id: 'unpassend', label: 'passt nicht' },
  { id: 'zeitpunkt', label: 'falscher Zeitpunkt' },
  { id: 'erledigt', label: 'schon erledigt' },
  { id: 'person', label: 'falsche Person' },
  { id: 'ton', label: 'Ton / Entwurf passt nicht' },
  { id: 'vage', label: 'zu vage' },
] as const;
export type Ablehngrund = typeof ABLEHNGRUENDE[number]['id'];

export interface Merksatz { id: string; text: string; von: string; am: string; quelle: 'hand' | 'vorschlag' }

export type Wirkung = 'chance' | 'termin' | 'antwort' | 'aktivitaet' | 'keine';
export interface Lernstand {
  entscheidungen: number;
  /** Wie stark ihr Entwürfe umschreibt (0 = unverändert, 100 = neu geschrieben), Durchschnitt. */
  aenderungsgrad: number | null;
  /** Wirkungsleiter über alle Arten: ausgewertet, gewirkt, davon Termin und Chance. */
  wirkung: { ausgewertet: number; gewirkt: number; termin: number; chance: number };
  je_art: { art: string; angenommen: number; abgelehnt: number; quote: number | null; wirkung: string | null }[];
  ablehnungsgruende: { grund: string; anzahl: number }[];
  muster_angenommen: { art: string; titel: string; begruendung: string; entwurf?: string }[];
  warnung_abgelehnt: { art: string; titel: string; grund: string }[];
  hinweise: string[];
}

const TAG = 864e5;
const tagPlus = (d: string, n: number) => new Date(Date.parse(`${d.slice(0, 10)}T12:00:00Z`) + n * TAG).toISOString().slice(0, 10);
const kurz = (t: string | undefined, n: number) => (t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Wie weit zwei Texte auseinanderliegen (Wörter, 0–100) — einfach, aber robust. */
export function aenderung(vorher: string, nachher: string): number {
  const w = (t: string) => t.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const a = w(vorher), b = w(nachher);
  if (!a.length && !b.length) return 0;
  const zaehl = (l: string[]) => l.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const ma = zaehl(a), mb = zaehl(b);
  let gleich = 0;
  for (const [x, n] of Array.from(ma.entries())) gleich += Math.min(n, mb.get(x) ?? 0);
  return Math.round((1 - (2 * gleich) / (a.length + b.length)) * 100);
}

/**
 * Wie weit ein angenommener Vorschlag gewirkt hat — die höchste erreichte
 * Stufe bis Frist + 7 Tage: Chance (neu mit der Person) > Termin > Antwort >
 * Aktivität > keine. null = (noch) nicht auswertbar.
 */
export function wirkungsStufe(v: Pick<HeadVorschlag, 'kontakt_id' | 'entschieden' | 'frist' | 'status'>, kontakte: Map<string, Kontakt>, heute: string, crm?: Pick<CrmBestand, 'chancen'>): Wirkung | null {
  if ((v.status !== 'angenommen' && v.status !== 'erledigt') || !v.kontakt_id || !v.entschieden) return null;
  const k = kontakte.get(v.kontakt_id);
  if (!k) return null;
  const ab = v.entschieden.slice(0, 10);
  const bis = tagPlus(v.frist && v.frist > ab ? v.frist : ab, 7);
  const imFenster = (d: string) => d.slice(0, 10) >= ab && d.slice(0, 10) <= bis;
  if (crm?.chancen.some(c => c.kontaktIds.includes(k.id) && imFenster(c.angelegt))) return 'chance';
  const akt = (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && a.art !== 'uebergabe' && imFenster(a.am));
  if (akt.some(a => a.art === 'termin' || a.ergebnis === 'termin')) return 'termin';
  if (akt.some(a => a.art === 'antwort' || a.ergebnis === 'gespraech' || a.art === 'gespraech')) return 'antwort';
  if (akt.length) return 'aktivitaet';
  return heute > bis ? 'keine' : null;
}

/** Hat ein angenommener Vorschlag gewirkt? null = (noch) nicht auswertbar. */
export function hatGewirkt(v: Pick<HeadVorschlag, 'kontakt_id' | 'entschieden' | 'frist' | 'status'>, kontakte: Map<string, Kontakt>, heute: string): boolean | null {
  if ((v.status !== 'angenommen' && v.status !== 'erledigt') || !v.kontakt_id || !v.entschieden) return null;
  const k = kontakte.get(v.kontakt_id);
  if (!k) return null;
  const ab = v.entschieden.slice(0, 10);
  const bis = tagPlus(v.frist && v.frist > ab ? v.frist : ab, 7);
  const passiert = (k.aktivitaeten ?? []).some(a => a.art !== 'system' && a.art !== 'uebergabe' && a.am.slice(0, 10) >= ab && a.am.slice(0, 10) <= bis);
  if (passiert) return true;
  return heute > bis ? false : null;
}

export function lernstand(vorschlaege: HeadVorschlag[], kontakte: Kontakt[], heute: string, modus?: string, crm?: Pick<CrmBestand, 'chancen'>): Lernstand {
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const alleEntschieden = vorschlaege.filter(v => v.status === 'angenommen' || v.status === 'abgelehnt' || v.status === 'erledigt');
  // Selbst übernommene zählen nicht als eure Zustimmung (sonst lobt sich der Head selbst) — für die Wirkung aber schon.
  const entschieden = alleEntschieden.filter(v => !v.auto || v.status === 'abgelehnt');
  const arten = Array.from(new Set(entschieden.map(v => v.art)));
  const je_art = arten.map(art => {
    const l = entschieden.filter(v => v.art === art);
    const an = l.filter(v => v.status !== 'abgelehnt');
    const ab = l.length - an.length;
    const stufen = an.map(v => wirkungsStufe(v, nachId, heute, crm)).filter((x): x is Wirkung => x !== null);
    const gewirkt = stufen.filter(x => x !== 'keine');
    const hoch = (['chance', 'termin'] as Wirkung[]).map(s => [s, stufen.filter(x => x === s).length] as const).filter(([, n]) => n).map(([s, n]) => `${n} ${s === 'chance' ? 'Chance' : 'Termin'}`);
    return { art, angenommen: an.length, abgelehnt: ab, quote: l.length >= 3 ? Math.round((an.length / l.length) * 100) : null, wirkung: stufen.length ? `${gewirkt.length} von ${stufen.length}${hoch.length ? ` (${hoch.join(', ')})` : ''}` : null };
  }).sort((a, b) => (b.angenommen + b.abgelehnt) - (a.angenommen + a.abgelehnt));
  const gruende = new Map<string, number>();
  for (const v of entschieden) if (v.status === 'abgelehnt' && v.grund) gruende.set(v.grund, (gruende.get(v.grund) ?? 0) + 1);
  const label = (g: string) => ABLEHNGRUENDE.find(x => x.id === g)?.label ?? g;
  // Beispiele nach Ähnlichkeit: gleicher Modus zuerst, dann die jüngsten (ExpeL).
  const neueste = [...entschieden].sort((a, b) => Number(b.modus === modus) - Number(a.modus === modus) || (b.entschieden ?? b.aktualisiert).localeCompare(a.entschieden ?? a.aktualisiert));
  const alleStufen = alleEntschieden.filter(v => v.status !== 'abgelehnt').map(v => wirkungsStufe(v, nachId, heute, crm)).filter((x): x is Wirkung => x !== null);
  const wirkung = { ausgewertet: alleStufen.length, gewirkt: alleStufen.filter(x => x !== 'keine').length, termin: alleStufen.filter(x => x === 'termin').length, chance: alleStufen.filter(x => x === 'chance').length };
  const umgeschrieben = entschieden.filter(v => v.status !== 'abgelehnt' && v.entwurf?.text && v.entwurfFinal).map(v => aenderung(v.entwurf!.text, v.entwurfFinal!));
  const aenderungsgrad = umgeschrieben.length ? Math.round(umgeschrieben.reduce((a, x) => a + x, 0) / umgeschrieben.length) : null;
  const hinweise: string[] = [];
  for (const a of je_art) {
    if (a.quote !== null && a.quote < 25) hinweise.push(`„${a.art}“ wurde nur zu ${a.quote} % angenommen — nur mit besonders starkem, belegtem Anlass vorschlagen.`);
    if (a.quote !== null && a.quote >= 75 && a.angenommen >= 4) hinweise.push(`„${a.art}“ wird fast immer angenommen (${a.quote} %) — hier stimmt dein Urteil.`);
  }
  const top = Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) hinweise.push(`Häufigster Ablehnungsgrund: „${label(top[0])}“ (${top[1]}×) — darauf besonders achten.`);
  if (gruende.get('erledigt') && gruende.get('erledigt')! >= 2) hinweise.push('Mehrfach „schon erledigt“: vor jedem Vorschlag den Verlauf der Person prüfen (letzte Aktivität, nächster Schritt).');
  if (gruende.get('ton') && gruende.get('ton')! >= 2) hinweise.push('Entwürfe passten öfter nicht im Ton — kürzer, persönlicher, konkreter Bezug, keine Floskeln.');
  if (aenderungsgrad !== null && umgeschrieben.length >= 3 && aenderungsgrad >= 40) hinweise.push(`Entwürfe werden stark umgeschrieben (Ø ${aenderungsgrad} %) — orientiere dich eng an den übernommenen Fassungen unter „muster_angenommen“.`);
  return {
    entscheidungen: entschieden.length,
    aenderungsgrad, wirkung,
    je_art: je_art.slice(0, 12),
    ablehnungsgruende: Array.from(gruende.entries()).map(([g, n]) => ({ grund: label(g), anzahl: n })).sort((a, b) => b.anzahl - a.anzahl),
    muster_angenommen: neueste.filter(v => v.status !== 'abgelehnt').slice(0, 3).map(v => ({ art: v.art, titel: v.titel, begruendung: kurz(v.begruendung, 240), ...(v.entwurfFinal ?? v.entwurf?.text ? { entwurf: kurz(v.entwurfFinal ?? v.entwurf?.text, 500) } : {}) })),
    warnung_abgelehnt: neueste.filter(v => v.status === 'abgelehnt').slice(0, 4).map(v => ({ art: v.art, titel: v.titel, grund: v.grund ? label(v.grund) : 'ohne Grund' })),
    hinweise,
  };
}

/** Merksatz säubern: kurz, ohne Steuerzeichen, keine Dubletten. */
export function merksatzNeu(liste: Merksatz[], text: string, von: string, am: string, quelle: Merksatz['quelle']): Merksatz[] {
  const t = text.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (t.length < 4 || liste.some(m => m.text.toLowerCase() === t.toLowerCase())) return liste;
  return [...liste, { id: `m-${Date.parse(am).toString(36)}${Math.random().toString(36).slice(2, 5)}`, text: t, von, am, quelle }].slice(-30);
}
