// ─── MAKE OS — Ziel ↔ Meilensteine: Kette und Abhängigkeiten (rein, 01.10.) ──
// Kevin (01.10.): „Verknüpfe die Zielebene mit der Meilenstein-Ebene. Wir haben Ziele, und darunter kann man
// Meilensteine planen … Mehrere Meilensteine zu einem Ziel, in Abhängigkeit.“
//
// Modell (additiv, optional):
//   · Ziel-Bezug: `Meilenstein.zielId` (30.09.) bzw. `abgeleitetVon` (Kaskade) — gelesen NUR über `zielVonMeilenstein`
//     (lib/planung/meilenstein-aufgaben.ts).
//   · Abhängigkeit: `Meilenstein.wartetAuf: string[]` — Kennungen anderer Meilensteine (typischerweise desselben Ziels).
//     „B wartet auf A“ = A muss erledigt sein, bevor B dran ist. Höchstens `KETTE_MAX` Vorgänger, keine Kreise, nur
//     existierende Meilensteine — geprüft im Schreibweg (/api/state/meilensteine, ZOE `setze_meilenstein`). Die Kreisprüfung
//     ist DIESELBE wie bei den Aufgaben (`kreisBei`, lib/aufgaben/abhaengig.ts) — nur auf `wartetAuf` abgebildet.
//   · „wartet“ ist ein ANZEIGE-Status (nie gespeichert): offen + mindestens ein Vorgänger nicht erledigt.
//   · Datum-Prüfung: liegt das Datum vor dem eines Vorgängers → Warnung (nie Blockieren).
//   · Glocke: ein Meilenstein, der heute/morgen fällig ist und noch wartet, sagt es im Titel (`wartetText`, genutzt von
//     lib/kalender/eintraege.ts — dieselbe Frist wie im Kalender, keine zweite Meldung).
//   · Reihenfolge im Ziel: der gespeicherte `rang` (wie überall), aber eine Abhängigkeit geht vor — `ketteOrdnen` sortiert
//     topologisch, bei Gleichstand nach Rang. Verschieben (Pfeile/Ziehen) setzt nur die Ränge der Meilensteine des Ziels
//     (die Plätze aller anderen bleiben) und lehnt ab, was einen Meilenstein vor seinen Vorgänger stellen würde.
//   · Verbindungen: gelöschter Meilenstein → raus aus `wartetAuf` der anderen (`ohneMeilenstein`, Rückgängig über
//     `verweiseZurueck`); gelöschtes Ziel → Meilensteine verlieren `zielId` (`zielVerweiseLoesen`), bleiben aber stehen.
// Client- und server-sicher, keine Server-Importe.

import type { Meilenstein } from './typen';
import { kreisBei } from '@/lib/aufgaben/abhaengig';
import { sortiertNachRang } from './rang';
import { KETTE_MAX } from './meilensteine';
import { wirksamerFortschritt, zielVonMeilenstein } from './meilenstein-aufgaben';
import type { TasksState } from '@/types/tasks';

// Höchstzahl und Säuberung liegen beim Säuberer der Meilensteine (sonst kreisten die Importe) — hier nur weitergereicht.
export { KETTE_MAX, sauberWartetAuf } from './meilensteine';

type MitKette = Pick<Meilenstein, 'id' | 'wartetAuf'>;

/** Ein Kreis, der einen der geprüften Meilensteine berührt — die Kette (Kennungen) oder null. Gleiche Prüfung wie Aufgaben. */
export function kreisIn(liste: readonly MitKette[], pruefen: Iterable<string>): string[] | null {
  return kreisBei(liste.map(m => ({ id: m.id, abhaengigVon: m.wartetAuf ?? [] })), pruefen);
}

/** Würde „vonId wartet auf aufId“ einen Kreis schließen? (Auswahl im Fenster: solche Kandidaten gar nicht anbieten.) */
export function wuerdeKreisen(vonId: string, aufId: string, liste: readonly MitKette[]): boolean {
  if (vonId === aufId) return true;
  const mit = liste.map(m => (m.id === vonId ? { ...m, wartetAuf: [...(m.wartetAuf ?? []).filter(x => x !== aufId), aufId] } : m));
  if (!mit.some(m => m.id === vonId)) mit.push({ id: vonId, wartetAuf: [aufId] });
  return !!kreisIn(mit, [vonId]);
}

/**
 * Prüfung im Schreibweg (in der Sperre, über der Liste NACH der Änderung): zu viele Vorgänger, NEU genannte Vorgänger, die
 * es nicht gibt, und Kreise — nur für die berührten Meilensteine. `vorher` = der Stand vor der Änderung: ein alter, toter
 * Verweis blockiert so keine andere Änderung (den räumt `ohneToteVerweise` bzw. die Verbindungsprüfung).
 * Liefert den Grund (Text) oder null.
 */
export function kettePruefen(nachher: readonly (MitKette & { titel?: string })[], beruehrt: Iterable<string>, vorher: readonly MitKette[] = []): string | null {
  const ids = new Set(nachher.map(m => m.id));
  const alt = new Map(vorher.map(m => [m.id, new Set(m.wartetAuf ?? [])]));
  const nachId = new Map(nachher.map(m => [m.id, m]));
  const geprueft: string[] = [];
  for (const id of beruehrt) {
    const m = nachId.get(id);
    if (!m) continue;
    geprueft.push(id);
    const w = m.wartetAuf ?? [];
    if (w.length > KETTE_MAX) return `Abgelehnt: höchstens ${KETTE_MAX} Vorgänger je Meilenstein.`;
    const tot = w.filter(x => !ids.has(x) && !alt.get(id)?.has(x));
    if (tot.length) return `Abgelehnt: „wartet auf“ nennt einen Meilenstein, den es nicht gibt (${tot[0]}).`;
  }
  const kreis = kreisIn(nachher, geprueft);
  if (kreis) {
    const name = (k: string) => nachId.get(k)?.titel ?? k;
    return `Abgelehnt: das wäre ein Kreis (${kreis.map(name).join(' → ')}).`;
  }
  return null;
}

/** Vorgänger, die noch nicht erledigt sind (in der Reihenfolge von `wartetAuf`). */
export function offeneVorgaenger<M extends { id: string; erledigt?: boolean }>(m: { wartetAuf?: readonly string[] }, alle: readonly M[]): M[] {
  if (!m.wartetAuf?.length) return [];
  const nachId = new Map(alle.map(x => [x.id, x]));
  return m.wartetAuf.map(id => nachId.get(id)).filter((x): x is M => !!x && !x.erledigt);
}

/** Anzeige-Status „wartet“: offen und mindestens ein Vorgänger nicht erledigt. */
export const wartet = (m: { erledigt?: boolean; wartetAuf?: readonly string[] }, alle: readonly { id: string; erledigt?: boolean }[]): boolean =>
  !m.erledigt && offeneVorgaenger(m, alle).length > 0;

/** Wer wartet auf diesen Meilenstein? (Nachfolger.) */
export function nachfolger<M extends { wartetAuf?: readonly string[] }>(id: string, alle: readonly M[]): M[] {
  return alle.filter(m => m.wartetAuf?.includes(id));
}

/**
 * Datum-Prüfung: Vorgänger, deren Datum NACH dem eigenen liegt (beide mit festem Tag). Nur eine Warnung — geplant wird,
 * wie die Person will. `faellig` darf übergeben werden (Fenster: das Datum im Formular, noch nicht gespeichert).
 */
export function datumVorVorgaenger<M extends { id: string; faellig?: string }>(m: { wartetAuf?: readonly string[]; faellig?: string }, alle: readonly M[]): M[] {
  if (!m.faellig || !m.wartetAuf?.length) return [];
  const nachId = new Map(alle.map(x => [x.id, x]));
  return m.wartetAuf.map(id => nachId.get(id)).filter((x): x is M => !!x && !!x.faellig && x.faellig > m.faellig!);
}

/** Eine Änderung, wie sie der Schreibweg kennt (lib/store/patch-liste.ts) — hier nur die Form, damit die Datei client-sicher bleibt. */
export interface KetteOp<E> { op: 'upsert' | 'delete' | 'teil'; eintrag?: E; id?: string; felder?: Record<string, unknown> }

/**
 * Die Liste, wie sie nach den Änderungen aussähe (Schreibweg: `pruefen` läuft über dem Stand VOR den Änderungen) und
 * welche Meilensteine berührt sind (neu, geändert) — Grundlage für `kettePruefen`. Löschen nimmt den Meilenstein raus,
 * lässt die Verweise anderer aber stehen (die räumt `ohneToteVerweise` nach dem Schreiben).
 */
export function listeNachOps<E extends MitKette>(liste: readonly E[], ops: readonly KetteOp<E>[]): { nachher: E[]; beruehrt: string[] } {
  const karte = new Map(liste.map(m => [m.id, m]));
  const beruehrt: string[] = [];
  for (const o of ops) {
    if (o.op === 'delete' && o.id) { karte.delete(o.id); continue; }
    if (o.op === 'upsert' && o.eintrag) { karte.set(o.eintrag.id, o.eintrag); beruehrt.push(o.eintrag.id); continue; }
    if (o.op === 'teil' && o.id) {
      const alt = karte.get(o.id);
      if (alt) { karte.set(o.id, { ...alt, ...(o.felder ?? {}) } as E); beruehrt.push(o.id); }
    }
  }
  return { nachher: Array.from(karte.values()), beruehrt };
}

/** „wartet noch auf „A“ und 1 weiteren“ — null, wenn nichts mehr offen ist (Anzeige, Glocke). */
export function wartetText(m: { erledigt?: boolean; wartetAuf?: readonly string[] }, alle: readonly { id: string; erledigt?: boolean; titel?: string }[]): string | null {
  if (m.erledigt) return null;
  const auf = offeneVorgaenger(m, alle);
  if (!auf.length) return null;
  const name = (x: { titel?: string }) => `„${x.titel?.trim() || 'ein Meilenstein'}“`;
  return `wartet noch auf ${name(auf[0])}${auf.length > 1 ? ` und ${auf.length - 1} ${auf.length === 2 ? 'weiteren' : 'weitere'}` : ''}`;
}

/** Verweise auf Meilensteine, die es nicht (mehr) gibt, entfernen — unveränderte Einträge bleiben dieselben Objekte. */
export function ohneToteVerweise<M extends MitKette>(liste: readonly M[]): { liste: M[]; geaendert: string[] } {
  const ids = new Set(liste.map(m => m.id));
  const geaendert: string[] = [];
  const aus = liste.map(m => {
    if (!m.wartetAuf?.length || m.wartetAuf.every(x => ids.has(x) && x !== m.id)) return m;
    geaendert.push(m.id);
    const w = m.wartetAuf.filter(x => ids.has(x) && x !== m.id);
    const n = { ...m };
    if (w.length) n.wartetAuf = w; else delete n.wartetAuf;
    return n;
  });
  return { liste: aus, geaendert };
}

/** Was ein Löschen an den anderen geändert hat — für „Rückgängig“. */
export interface KettenVerweis { id: string; wartetAuf: string[] }

/** Einen Meilenstein entfernen und ihn aus `wartetAuf` aller anderen nehmen. `betroffen` = deren alte Listen (für Rückgängig). */
export function ohneMeilenstein<M extends MitKette>(liste: readonly M[], id: string): { liste: M[]; betroffen: KettenVerweis[] } {
  const betroffen: KettenVerweis[] = [];
  const aus = liste.filter(m => m.id !== id).map(m => {
    if (!m.wartetAuf?.includes(id)) return m;
    betroffen.push({ id: m.id, wartetAuf: [...m.wartetAuf] });
    const w = m.wartetAuf.filter(x => x !== id);
    const n = { ...m };
    if (w.length) n.wartetAuf = w; else delete n.wartetAuf;
    return n;
  });
  return { liste: aus, betroffen };
}

/** Rückgängig: den Verweis auf `id` bei den betroffenen wieder eintragen (nur, wo er fehlt; andere Änderungen bleiben). */
export function verweiseZurueck<M extends MitKette>(liste: readonly M[], id: string, betroffen: readonly KettenVerweis[]): M[] {
  const wer = new Set(betroffen.map(b => b.id));
  return liste.map(m => {
    if (!wer.has(m.id) || m.wartetAuf?.includes(id)) return m;
    return { ...m, wartetAuf: [...(m.wartetAuf ?? []), id].slice(0, KETTE_MAX) };
  });
}

/** Gelöschte Ziele: Meilensteine verlieren `zielId` (sie bleiben stehen). `geloest` = die Kennungen der Meilensteine. */
export function zielVerweiseLoesen<M extends Pick<Meilenstein, 'id' | 'zielId'>>(liste: readonly M[], toteZiele: ReadonlySet<string>): { liste: M[]; geloest: string[] } {
  const geloest: string[] = [];
  const aus = liste.map(m => {
    if (!m.zielId || !toteZiele.has(m.zielId)) return m;
    geloest.push(m.id);
    const n = { ...m };
    delete n.zielId;
    return n;
  });
  return { liste: aus, geloest };
}

// ── Die Kette eines Ziels ────────────────────────────────────────────────────

export interface Kette<M> {
  /** Reihenfolge: jeder Meilenstein nach seinen Vorgängern (im Ziel), bei Gleichstand nach Rang. */
  reihe: M[];
  /** Stufe je Meilenstein (1 = wartet auf niemanden im Ziel). Gleiche Stufe = parallel. */
  stufe: Map<string, number>;
  /** Die Stufen als Gruppen (1 → 2 → 3, parallele nebeneinander). */
  stufen: M[][];
}

/**
 * Die Meilensteine EINES Ziels als Kette ordnen (Kahn, Gleichstand nach Rang). Abhängigkeiten außerhalb der Menge
 * zählen für die Stufe nicht (die Anzeige nennt sie). Ein (verbotener) Kreis im Altbestand bricht nichts: die Reste
 * kommen in Rang-Reihenfolge hinten dran.
 */
export function ketteOrdnen<M extends MitKette & { rang?: number }>(ms: readonly M[]): Kette<M> {
  const sortiert = sortiertNachRang(ms);
  const drin = new Set(sortiert.map(m => m.id));
  const vor = new Map(sortiert.map(m => [m.id, (m.wartetAuf ?? []).filter(x => drin.has(x) && x !== m.id)]));
  const stufe = new Map<string, number>();
  const reihe: M[] = [];
  const offen = [...sortiert];
  while (offen.length) {
    const i = offen.findIndex(m => (vor.get(m.id) ?? []).every(x => stufe.has(x)));
    const m = offen.splice(i < 0 ? 0 : i, 1)[0];
    stufe.set(m.id, 1 + Math.max(0, ...(vor.get(m.id) ?? []).map(x => stufe.get(x) ?? 0)));
    reihe.push(m);
  }
  const stufen: M[][] = [];
  for (const m of reihe) { const s = stufe.get(m.id)! - 1; (stufen[s] ??= []).push(m); }
  return { reihe, stufe, stufen: stufen.filter(Boolean) };
}

/** Steht ein Meilenstein in `reihe` vor einem seiner Vorgänger? (Dann ist die Reihenfolge nicht erlaubt.) */
export function reiheVerletzt(reihe: readonly MitKette[]): { id: string; vor: string } | null {
  const pos = new Map(reihe.map((m, i) => [m.id, i]));
  for (const [i, m] of reihe.entries()) for (const v of m.wartetAuf ?? []) { const j = pos.get(v); if (j !== undefined && j > i) return { id: m.id, vor: v }; }
  return null;
}

/**
 * Die Meilensteine einer Teilmenge (z. B. eines Ziels) in die gegebene Reihenfolge bringen: sie belegen dieselben Plätze
 * in der Rang-Reihenfolge wie vorher, nur untereinander neu verteilt — alle anderen behalten ihren Platz. Zurück kommt die
 * ganze Liste mit lückenlosen Rängen (wie `verschiebe`).
 */
export function ordneTeilmenge<E extends { id: string; rang?: number }>(liste: readonly E[], reihe: readonly string[]): E[] {
  const sortiert = sortiertNachRang(liste);
  const teil = new Set(reihe);
  const nachId = new Map(sortiert.map(e => [e.id, e]));
  const neu = reihe.map(id => nachId.get(id)).filter((e): e is E => !!e);
  let k = 0;
  return sortiert.map(e => (teil.has(e.id) ? neu[k++] ?? e : e)).map((e, i) => ({ ...e, rang: i + 1 }));
}

/**
 * Einen Meilenstein in der Kette eines Ziels um eine Stelle verschieben (Pfeile) — null, wenn es nicht geht (Rand, oder der
 * Nachbar ist sein Vorgänger bzw. Nachfolger: die Abhängigkeit geht vor).
 */
export function verschiebeInKette<M extends MitKette & { rang?: number }>(alle: readonly M[], reihe: readonly M[], id: string, richtung: 'auf' | 'ab'): M[] | null {
  const i = reihe.findIndex(m => m.id === id);
  const j = richtung === 'auf' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= reihe.length) return null;
  const neu = reihe.map(m => m.id);
  [neu[i], neu[j]] = [neu[j], neu[i]];
  const nachId = new Map(reihe.map(m => [m.id, m]));
  if (reiheVerletzt(neu.map(x => nachId.get(x)!))) return null;
  return ordneTeilmenge(alle, neu);
}

/** Ziehen: `id` an die Stelle von `aufId` setzen — null, wenn die Reihenfolge eine Abhängigkeit verletzen würde. */
export function zieheInKette<M extends MitKette & { rang?: number }>(alle: readonly M[], reihe: readonly M[], id: string, aufId: string): M[] | null {
  const von = reihe.findIndex(m => m.id === id), nach = reihe.findIndex(m => m.id === aufId);
  if (von < 0 || nach < 0 || von === nach) return null;
  const neu = [...reihe];
  const [m] = neu.splice(von, 1);
  neu.splice(nach, 0, m);
  if (reiheVerletzt(neu)) return null;
  return ordneTeilmenge(alle, neu.map(x => x.id));
}

/** Ziel-Fortschritt LIVE aus seinen Meilensteinen (Mittelwert des wirksamen Fortschritts) — null ohne Meilensteine. */
export function zielFortschrittLive(zielId: string, ms: readonly Meilenstein[], state: Pick<TasksState, 'tasks'> | null): number | null {
  const l = ms.filter(m => zielVonMeilenstein(m) === zielId);
  if (!l.length) return null;
  return Math.round(l.reduce((s, m) => s + wirksamerFortschritt(m, state), 0) / l.length);
}
