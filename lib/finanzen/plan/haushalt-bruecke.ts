// ─── Haushalt → Finanzplanung: die Brücke (31.10., Kevin: „Haushalt → Finanzplan — heute fertig“; ROADMAP_Q4 Lücke 2, Entscheidung R4) ──
// „Der Haushalt führt das Ist (Buchungen, Fixkosten, Budget, Schulden); die Finanzplanung liest daraus. Nicht doppelt pflegen.“
//
// Rein (Server und Browser). Der Rechenkern bleibt unverändert — die Brücke baut nur seine EINGABEN: beim Lesen (`ladeFinanzplan`) legt der
// Server aus den Haushaltsbeständen dazu, nie gespeichert (wie `eroeffnung`/`kontenIst`):
//   • Ist-Monate      Haushaltsbuchungen (Einheit privat) → `buchungen` mit Kennung `hh-…`; eingeordnet über die EINE Einordnung (einordnung.ts),
//                     Ausgaben über die gemerkten Regeln (Empfänger → Planzeile), sonst Fixkosten-Zeile bzw. Planzeile mit dem Kategorienamen,
//                     sonst „nicht zugeordnet“.
//   • Fixkosten       Posten mit Turnus (fixkosten.ts `sockel`, 12 volle Monate) → Budget-Zeile „fix“ `p.b.hhf-…` mit dem Monatswert.
//   • Kredite         Schulden (Einheit privat) mit Rest > 0 → Schuld `hhs-…` (Tilgungsplan) + Rate als Schulden-Zeile `p.d.hhk-…` bis schuldenfrei.
//   • Kontostände     kommen seit 08.10. schon aus dem Konten-Register (`kontenIst`) — die Brücke kennzeichnet sie nur (unabhängig vom Schalter).
// „Handwert gewinnt“: eine Zeile/Schuld der Finanzplanung mit demselben Namen (oder eine gemerkte Regel auf eine vorhandene Zeile) bleibt —
// der Haushaltswert kommt dann nicht dazu (`vonHand`). Ein Monat mit eigenen Buchungen der Finanzplanung bleibt, wie er ist. Einzelne
// Monatswerte einer übernommenen Zeile setzt man wie immer als Planzelle (`plan["p.b.hhf-…:<m>"]`) — die gewinnt im Kern.
// Einstellung je Haushalt im Dokument: `haushaltBruecke: { an }`. Fehlt sie (Altbestand), bleibt alles wie heute und die Seite zeigt die
// Vorschau „das würde sich ändern“ mit „übernehmen“; neue Dokumente beginnen mit `an: true` (`importieren`).
// Trennung: alles hier ist privat — die Business-Sicht trägt weder die Zeilen noch `haushaltQuelle`/`haushaltBruecke` (sicht.ts).

import type { Buchung as PlanBuchung, FinanzDaten, Schuld as PlanSchuld, Zeile } from '@/lib/finanzen/rechenkern';
import { histIndex, planMonat, tilgungsplan } from '@/lib/finanzen/rechenkern';
import type { Buchung, Haushalt, Schuld } from '@/lib/finanzen/haushalt/typen';
import { einordnen, katNamen, TILGUNG } from '@/lib/finanzen/haushalt/einordnung';
import { sockel } from '@/lib/finanzen/haushalt/fixkosten';
import { normal } from '@/lib/finanzen/haushalt/regeln';
import { WEG } from '@/lib/wege';

/** Gespeicherte Einstellung je Haushalt (im Plan-Dokument, optional). */
export interface BrueckeEinstellung { an: boolean }
export type BrueckeZustand = 'an' | 'aus' | 'offen';

export interface Eckwerte { monat: string; bedarf: number; schulden: number; luft: number; angespart: number; istMonate: number }
export interface QuelleZeile { art: 'fixkosten' | 'kredit'; name: string; weg: string }
export interface VonHand { art: 'fixkosten' | 'kredit' | 'monat'; name: string; /** Zeile der Finanzplanung, die gewinnt (bei Monaten keine). */ zeile?: string; /** Haushaltswert je Monat in € (bei Monaten die Zahl der Buchungen). */ wert: number; weg: string }

/** Was die Brücke beim Lesen mitgibt — NIE gespeichert, nie in der Business-Sicht. */
export interface HaushaltQuelle {
  zustand: BrueckeZustand;
  /** Übernommene Zeilen (nur bei `an`): Zeilen-Kennung → Art, Name, Ort im Haushalt. */
  zeilen: Record<string, QuelleZeile>;
  /** Übernommene Schulden (nur bei `an`): Kennung → Ort im Haushalt. */
  schulden: Record<string, string>;
  /** Monate (JJJJ-MM), deren Ist aus dem Haushalt kommt (bei `an`) bzw. käme. */
  monate: string[];
  /** Was der Haushalt bringt (bei jedem Zustand gezählt). */
  umfang: { fixkosten: number; kredite: number; buchungen: number; monate: number };
  /** Haushaltswerte, die nicht übernommen werden, weil die Finanzplanung einen eigenen Wert hat. */
  vonHand: VonHand[];
  /** Kontostände Privat aus dem Konten-Register (seit 08.10. immer, unabhängig vom Schalter). */
  konten: string | null;
  /** Nur im Zustand `offen`: Vorher/Nachher und was dazukäme. */
  vorschau?: { vorher: Eckwerte; nachher: Eckwerte; fixkosten: { name: string; proMonat: number }[]; kredite: { name: string; rate: number; bis: string | null }[]; monate: { monat: string; anzahl: number }[] };
  /** Haushalt nicht lesbar — dann bleibt alles wie heute. */
  fehler?: string;
}

/** Ausschnitt des Haushalts, den die Brücke liest. */
export type HaushaltEingang = Pick<Haushalt, 'buchungen' | 'schulden'> & { stamm: Pick<Haushalt['stamm'], 'kategorien' | 'aliase' | 'konten'> };

/** Kennungen, die nur die Brücke vergibt — Schreibschritte darauf lehnt der Server ab (Werte aus dem Haushalt ändert man im Haushalt). */
export const HH_PRAEFIX = { fix: 'p.b.hhf-', kredit: 'p.d.hhk-', schuld: 'hhs-', buchung: 'hhb-' } as const;
export const istHaushaltKennung = (id: unknown): boolean => typeof id === 'string' && (id.startsWith(HH_PRAEFIX.fix) || id.startsWith(HH_PRAEFIX.kredit) || id.startsWith(HH_PRAEFIX.schuld) || id.startsWith(HH_PRAEFIX.buchung));
export const HAUSHALT_SCHREIBEN_TEXT = 'Dieser Wert kommt aus dem Haushalt — dort ändern (oder hier einen Monatswert von Hand setzen).';

export function brueckeZustand(d: Pick<FinanzDaten, 'haushaltBruecke'>): BrueckeZustand {
  const e = d.haushaltBruecke;
  return e && typeof e.an === 'boolean' ? (e.an ? 'an' : 'aus') : 'offen';
}

/** Kurze, stabile Kennung (FNV-1a, 8 Hex) — ohne „:“/„@“, damit Planzellen `<kennung>:<monat>` eindeutig bleiben. */
function kurz(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const euro = (cent: number): number => Math.round(cent) / 100;
const monatVonTag = (tag: string) => tag.slice(0, 7);

/** Ergebnis der Übernahme (rein): die Listen MIT den Haushaltswerten und die Quelle. */
export interface Uebernahme {
  privatBudget: Zeile[]; privatSchulden: Zeile[]; schulden: PlanSchuld[]; buchungen: PlanBuchung[];
  quelle: Omit<HaushaltQuelle, 'zustand' | 'vorschau' | 'konten'>;
  /** Für die Vorschau: was dazukäme. */
  neu: { fixkosten: { name: string; proMonat: number }[]; kredite: { name: string; rate: number; bis: string | null }[]; monate: { monat: string; anzahl: number }[] };
}

/**
 * Die Übernahme rechnen — unabhängig vom Schalter (der Aufrufer entscheidet, ob sie gilt). `heute` = Berliner Tag.
 */
export function uebernahme(d: FinanzDaten, hh: HaushaltEingang, heute: string): Uebernahme {
  const katName = katNamen(hh.stamm);
  const privat = <T extends { einheit?: unknown }>(l: T[]) => l.filter(x => (x.einheit ?? 'privat') === 'privat');
  const buchungenHH = privat(hh.buchungen ?? []);
  const schuldenHH = privat(hh.schulden ?? []);
  const N = d.monate.length;
  const monatName = (m: number) => d.monate[m - 1] ?? `Monat ${m}`;

  // Namen der eigenen Zeilen/Schulden — „Handwert gewinnt“.
  const eigeneZeile = new Map<string, string>();
  for (const z of [...d.privatBudget, ...d.privatSchulden]) eigeneZeile.set(normal(z.name), z.id);
  const eigeneSchuld = new Set(d.schulden.filter(s => s.einheit === 'privat').map(s => normal(s.name)));
  const zeilenIds = new Set([...d.privatBudget, ...d.privatSchulden].map(z => z.id));
  const regelZiel = (empf: string): string | null => { const z = d.regeln[empf.toLowerCase()]; return z && (zeilenIds.has(z) || z.startsWith('x.')) ? z : null; };

  const zeilen: Record<string, QuelleZeile> = {};
  const vonHand: VonHand[] = [];
  const budgetNeu: Zeile[] = [];
  const fixkostenNeu: Uebernahme['neu']['fixkosten'] = [];
  /** Fixkosten-Empfänger (normal) → Zeile, auf die ihre Buchungen zählen. */
  const fixZeile = new Map<string, string>();

  // ── Fixkosten ──
  const s = sockel(buchungenHH, schuldenHH, heute, katName);
  const nachId = new Map(buchungenHH.map(b => [b.id, b]));
  for (const p of s.posten) {
    if (!(p.proMonat > 0)) continue;
    const nn = normal(p.name);
    const proMonat = euro(p.proMonat);
    const weg = WEG.privat('fixkosten');
    const hand = eigeneZeile.get(nn) ?? regelZiel(p.name);
    if (hand && !hand.startsWith('x.')) { vonHand.push({ art: 'fixkosten', name: p.name, zeile: hand, wert: proMonat, weg }); fixZeile.set(nn, hand); continue; }
    const id = `${HH_PRAEFIX.fix}${kurz(nn)}`;
    const juengste = p.ids.map(i => nachId.get(i)).filter((b): b is Buchung => !!b).sort((a, b) => b.datum.localeCompare(a.datum))[0];
    const tag = juengste ? Number(juengste.datum.slice(8, 10)) : undefined;
    budgetNeu.push({ id, name: p.name, einheit: 'privat', gruppe: 'Fixkosten', typ: 'fix', soll: proMonat, ab: 1, ...(tag ? { tag } : {}) });
    zeilen[id] = { art: 'fixkosten', name: p.name, weg };
    fixZeile.set(nn, id);
    fixkostenNeu.push({ name: p.name, proMonat });
  }

  // ── Kredite ──
  const schuldNeu: PlanSchuld[] = [];
  const ratenNeu: Zeile[] = [];
  const krediteNeu: Uebernahme['neu']['kredite'] = [];
  const schuldWege: Record<string, string> = {};
  for (const x of schuldenHH as Schuld[]) {
    if (!(Number(x.restbetrag) > 0)) continue;
    const nn = normal(x.bezeichnung);
    const rate = euro(Number(x.rate) || 0);
    const weg = WEG.privat('schulden');
    if (eigeneSchuld.has(nn) || eigeneZeile.has(nn)) { vonHand.push({ art: 'kredit', name: x.bezeichnung, zeile: eigeneZeile.get(nn), wert: rate, weg }); continue; }
    const start = x.naechste_faelligkeit && /^\d{4}-\d{2}-\d{2}$/.test(x.naechste_faelligkeit) ? Math.max(1, Math.min(N, planMonat(x.naechste_faelligkeit))) : 1;
    const schuld: PlanSchuld = { id: `${HH_PRAEFIX.schuld}${kurz(x.id)}`, name: x.bezeichnung, einheit: 'privat', rest: euro(Number(x.restbetrag)), rate, zins: Number(x.zinssatz) || 0, start, status: rate > 0 ? 'läuft' : 'unklar', ...(x.glaeubiger ? { notiz: x.glaeubiger } : {}) };
    schuldNeu.push(schuld); schuldWege[schuld.id] = weg;
    let bis: string | null = null;
    if (rate > 0) {
      const t = tilgungsplan(schuld, 0, N);
      const id = `${HH_PRAEFIX.kredit}${kurz(x.id)}`;
      ratenNeu.push({ id, name: x.bezeichnung, einheit: 'privat', gruppe: 'Schulden', soll: rate, ab: start, ...(t.frei ? { bis: t.frei } : {}) });
      zeilen[id] = { art: 'kredit', name: x.bezeichnung, weg };
      bis = t.frei ? monatName(t.frei) : null;
    }
    krediteNeu.push({ name: x.bezeichnung, rate, bis });
  }

  // ── Ist-Monate ──
  const n = d.historie.length + N;
  const eigeneMonate = new Set<number>();
  for (const b of d.buchungen) if ((b.e ?? 'privat') === 'privat' && !istHaushaltKennung(b.id)) eigeneMonate.add(histIndex(b.d));
  const budgetName = new Map<string, string>();
  for (const z of [...d.privatBudget, ...budgetNeu]) budgetName.set(normal(z.name), z.id);
  const kontoName = new Map((hh.stamm.konten ?? []).map(k => [k.id, k.name]));
  // Gemerkte Regeln dürfen auch auf übernommene Zeilen zeigen (in der Monatsansicht zugeordnet, „merken“).
  const alleIds = new Set([...zeilenIds, ...budgetNeu.map(z => z.id), ...ratenNeu.map(z => z.id)]);
  const regelIst = (empf: string): string | null => { const z = d.regeln[empf.toLowerCase()]; return z && (alleIds.has(z) || z.startsWith('x.')) ? z : null; };
  const buchungNeu: PlanBuchung[] = [];
  const jeMonat = new Map<string, number>();
  const handMonate = new Map<string, number>();
  for (const b of buchungenHH) {
    if (!b.datum || b.datum > heute) continue;
    const i = histIndex(b.datum);
    if (!(i >= 0 && i < n)) continue;
    const mon = monatVonTag(b.datum);
    if (eigeneMonate.has(i)) { handMonate.set(mon, (handMonate.get(mon) ?? 0) + 1); continue; }
    const e = einordnen(b, katName);
    const empf = b.empfaenger || b.beschreibung || '';
    let z: string;
    if (e === 'umbuchung' || e === 'durchlauf') z = 'x.umbuchung';
    else if (e === 'geliehen') z = 'x.kredit';
    else if (e === 'einnahme-einmalig') z = 'x.einmalig';
    else if (e === 'einnahme-planbar' || e === 'einnahme-offen') z = 'x.einnahme';
    else {
      const kat = katName(b.kategorie_id);
      z = regelIst(empf)
        ?? (b.ist_fixkosten && !TILGUNG.includes(kat) ? fixZeile.get(normal(empf)) : undefined)
        ?? (kat ? budgetName.get(normal(kat)) : undefined)
        ?? 'x.offen';
    }
    buchungNeu.push({ id: `${HH_PRAEFIX.buchung}${b.id}`, d: b.datum, b: euro(b.betrag), n: empf, k: kontoName.get(b.konto_id) ?? 'haushalt', z, e: 'privat', ...(b.notiz ? { notiz: b.notiz } : {}) });
    jeMonat.set(mon, (jeMonat.get(mon) ?? 0) + 1);
  }
  for (const [mon, anzahl] of handMonate) vonHand.push({ art: 'monat', name: mon, wert: anzahl, weg: WEG.privat('buchungen', { monat: mon }) });
  const monate = [...jeMonat.keys()].sort();

  return {
    privatBudget: [...d.privatBudget, ...budgetNeu],
    privatSchulden: [...d.privatSchulden, ...ratenNeu],
    schulden: [...d.schulden, ...schuldNeu],
    buchungen: [...d.buchungen, ...buchungNeu],
    quelle: { zeilen, schulden: schuldWege, monate, umfang: { fixkosten: budgetNeu.length, kredite: schuldNeu.length, buchungen: buchungNeu.length, monate: monate.length }, vonHand },
    neu: { fixkosten: fixkostenNeu, kredite: krediteNeu, monate: monate.map(monat => ({ monat, anzahl: jeMonat.get(monat) ?? 0 })) },
  };
}

/** Eckwerte des ersten Planmonats (Privat) — für die Vorschau. `rechne` liefert die Privat-Monate des Kerns (der Aufrufer reicht ihn herein). */
export type PrivatRechner = (d: FinanzDaten) => { bedarf: number; schulden: number; luft: number; angespart: number }[];
function eckwerte(d: FinanzDaten, rechne: PrivatRechner, istMonate: number): Eckwerte {
  const pr = rechne(d);
  const r = (x: number) => Math.round(x * 100) / 100;
  return { monat: d.monate[0] ?? '', bedarf: r(pr[0]?.bedarf ?? 0), schulden: r(pr[0]?.schulden ?? 0), luft: r(pr[0]?.luft ?? 0), angespart: r(pr[pr.length - 1]?.angespart ?? 0), istMonate };
}
const monateMitDaten = (d: FinanzDaten): number => new Set(d.buchungen.filter(b => (b.e ?? 'privat') === 'privat').map(b => b.d.slice(0, 7))).size;

/**
 * Die Brücke anwenden (rein): `an` → Dokument mit den Haushaltswerten + `haushaltQuelle`; `aus` → unverändert + Quelle (nur Zähler);
 * `offen` (Altbestand ohne Entscheidung) → unverändert + Quelle mit Vorschau (Vorher/Nachher über `rechne`). Ohne Haushalt (`hh` null):
 * unverändert + Quelle mit `fehler`, wenn einer angegeben ist. Die Zahlen des Dokuments ändern sich nur bei `an` — nie still.
 */
export function mitHaushalt(d: FinanzDaten, hh: HaushaltEingang | null, heute: string, rechne?: PrivatRechner, fehler?: string): FinanzDaten {
  const zustand = brueckeZustand(d);
  const konten = d.kontenIst?.privat ? WEG.kontenRegister('privat') : null;
  if (!hh) return { ...d, haushaltQuelle: { zustand, zeilen: {}, schulden: {}, monate: [], umfang: { fixkosten: 0, kredite: 0, buchungen: 0, monate: 0 }, vonHand: [], konten, ...(fehler ? { fehler } : {}) } };
  const u = uebernahme(d, hh, heute);
  if (zustand === 'an') {
    return { ...d, privatBudget: u.privatBudget, privatSchulden: u.privatSchulden, schulden: u.schulden, buchungen: u.buchungen, haushaltQuelle: { zustand, ...u.quelle, konten } };
  }
  const leer = !u.quelle.umfang.fixkosten && !u.quelle.umfang.kredite && !u.quelle.umfang.buchungen;
  const quelle: HaushaltQuelle = { zustand, ...u.quelle, zeilen: {}, schulden: {}, konten };
  if (zustand === 'offen' && rechne && !leer) {
    const nachherDok: FinanzDaten = { ...d, privatBudget: u.privatBudget, privatSchulden: u.privatSchulden, schulden: u.schulden, buchungen: u.buchungen };
    quelle.vorschau = { vorher: eckwerte(d, rechne, monateMitDaten(d)), nachher: eckwerte(nachherDok, rechne, monateMitDaten(nachherDok)), ...u.neu };
  }
  return { ...d, haushaltQuelle: quelle };
}

/** Die Brücke abnehmen (für Schreibwege, die ein gelesenes Dokument zurück auf die gespeicherte Form bringen müssten — heute nur Tests/Wächter). */
export function ohneHaushalt(d: FinanzDaten): FinanzDaten {
  const { haushaltQuelle: _q, ...rest } = d;
  return {
    ...rest,
    privatBudget: d.privatBudget.filter(z => !istHaushaltKennung(z.id)),
    privatSchulden: d.privatSchulden.filter(z => !istHaushaltKennung(z.id)),
    schulden: d.schulden.filter(s => !istHaushaltKennung(s.id)),
    buchungen: d.buchungen.filter(b => !istHaushaltKennung(b.id)),
  };
}

/** Kommt diese Zeile/Schuld/Buchung aus dem Haushalt? (Anzeige) */
export const ausHaushalt = (d: Pick<FinanzDaten, 'haushaltQuelle'>, id: string): QuelleZeile | null => d.haushaltQuelle?.zeilen[id] ?? null;
export const schuldAusHaushalt = (d: Pick<FinanzDaten, 'haushaltQuelle'>, id: string): string | null => d.haushaltQuelle?.schulden[id] ?? null;
