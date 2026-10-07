// ─── MAKE OS — Bezüge: wer zahlt worauf ein, wer wartet auf wen (rein, client- und server-sicher, 07.10.) ─────────────
// Kevin (07.10.): „Die Karten und Ziele brauchen Abhängigkeiten.“ — „Verbindungen fehlen.“ Konzept: LICHTFAEDEN.md › Seil.
//
// Die Bezüge (je EINE Quelle):
//   · Aufgabe wartet auf Aufgabe        `Task.abhaengigVon`        (28.09., Kreise prüft lib/aufgaben/abhaengig.ts `kreisBei`)
//   · Aufgabe gehört zu Meilenstein     Liste `lm-<ms>`            (30.09., kein Feld)
//   · Aufgabe zahlt ein auf Ziel        `Task.zielId`              (07.10., neu)
//   · Projekt zahlt ein auf Ziel        `Project.zielId`           (07.10., neu)
//   · Meilenstein wartet/zahlt ein      `wartetAuf` / `zielId`     (01.10. / 30.09., lib/planung/meilenstein-kette.ts)
//   · Ziel zahlt ein auf Oberziel       `Ziel.oberzielId`          (07.10., neu) — die Kaskade `abgeleitetVon` bleibt automatisch.
//
// Regeln (Schreibwege prüfen nur NEU gesetzte Bezüge — ein alter Verweis blockiert keine andere Änderung):
//   1. Bereiche bleiben getrennt: Privat ↔ Privat, Business ↔ Business. Ein Ziel ohne Space ist gemeinsam und passt zu beiden.
//   2. Keine Kreise: Ziel-Kette über `oberzielId` und `abgeleitetVon`, höchstens `ZIEL_KETTE_MAX` Ebenen.
//   3. „nur ich“: Eine für den Haushalt sichtbare Aufgabe wartet nie auf eine „nur ich“-Aufgabe (deren Titel stünde sonst bei der
//      anderen Person) — der Besitz kommt über eine Funktion herein (`nurIchBesitzer` aus lib/aufgaben/sicht.ts im Server).
//   4. Existenz: genannte Ziele stehen im geteilten Bestand und sind nicht archiviert.
// Löschen: `oberzielLoesen` / `zielBezuegeLoesen` lösen die Verweise auf ein gelöschtes Ziel; `bezuegeZurueck` setzt sie für
// „Rückgängig“ wieder — nur, wo das Feld noch leer ist und das Ziel wieder lebt.

import { spaceBereich, type SpaceId } from '@/lib/make-one/space-regeln';
import { wirksamerSpace } from './bereich';

/** Höchstens so viele Ebenen über einem Ziel (Oberziel, dessen Oberziel …). */
export const ZIEL_KETTE_MAX = 8;
const KENNUNG = /^[A-Za-z0-9_~:.-]{1,80}$/;
export const istBezugKennung = (v: unknown): v is string => typeof v === 'string' && KENNUNG.test(v);

export const BEREICH_GETRENNT = 'Abgelehnt: Privat und Business bleiben getrennt — ein Bezug geht nur innerhalb eines Bereichs. Nichts gespeichert.';
export const NUR_ICH_BEZUG = 'Abgelehnt: eine für euch beide sichtbare Aufgabe kann nicht auf eine „nur ich“-Aufgabe warten. Nichts gespeichert.';
export const ZIEL_FEHLT = 'Abgelehnt: „zahlt ein auf“ nennt ein Ziel, das es nicht (mehr) gibt. Nichts gespeichert.';

// ── Bereich ──────────────────────────────────────────────────────────────────

/** Bereich eines Ziels/Meilensteins für Bezüge: der wirksame Space; ohne Angabe gemeinsam (null) — passt zu beiden. */
export const planBereich = (x: { space?: SpaceId; einheit?: string }): SpaceId | null => wirksamerSpace(x) ?? null;
/** Bereich einer Aufgabe/eines Projekts: aus dem Aufgaben-Space (Privat-Einheiten → privat); ohne Space die Abweichung, sonst Business. */
export const aufgabenBereich = (t: { spaceId?: string; space?: SpaceId }): SpaceId => (t.spaceId ? spaceBereich(t.spaceId) : t.space ?? 'business');
/** Passen zwei Bereiche zusammen? `null` (gemeinsam) passt zu allem. */
export const bereichPasst = (a: SpaceId | null, b: SpaceId | null): boolean => a === null || b === null || a === b;

// ── Ziele: Oberziel und Wurzel ───────────────────────────────────────────────

export interface ZielBezugRoh { id: string; titel?: string; oberzielId?: string; abgeleitetVon?: string; space?: SpaceId; einheit?: string; archiviertAm?: string }

/** Das Eltern-Ziel eines Ziels: von Hand (`oberzielId`) vor der Kaskade (`abgeleitetVon`) — nur, wenn es das Ziel gibt. */
export function zielEltern(z: Pick<ZielBezugRoh, 'id' | 'oberzielId' | 'abgeleitetVon'>, nachId: ReadonlyMap<string, unknown>): string | undefined {
  if (z.oberzielId && z.oberzielId !== z.id && nachId.has(z.oberzielId)) return z.oberzielId;
  if (z.abgeleitetVon && z.abgeleitetVon !== z.id && nachId.has(z.abgeleitetVon)) return z.abgeleitetVon;
  return undefined;
}

/**
 * Kennung → Kennung des obersten Ziels (Seil-Wurzel): die Kette über `zielEltern` bis oben, kreisfest (höchstens
 * `ZIEL_KETTE_MAX` Schritte; ein Kreis im Altbestand endet beim letzten neuen Glied).
 */
export function seilWurzeln(ziele: readonly Pick<ZielBezugRoh, 'id' | 'oberzielId' | 'abgeleitetVon'>[]): Map<string, string> {
  const nachId = new Map(ziele.map(z => [z.id, z]));
  const aus = new Map<string, string>();
  for (const z of ziele) {
    let w = z;
    const gesehen = new Set([z.id]);
    for (let i = 0; i < ZIEL_KETTE_MAX; i++) {
      const e = zielEltern(w, nachId);
      if (!e || gesehen.has(e)) break;
      gesehen.add(e);
      w = nachId.get(e)!;
    }
    aus.set(z.id, w.id);
  }
  return aus;
}

/** Die Ziele, die direkt auf `id` einzahlen (Unterziele von Hand — nicht die Kaskade). */
export const unterziele = <Z extends Pick<ZielBezugRoh, 'id' | 'oberzielId'>>(id: string, ziele: readonly Z[]): Z[] => ziele.filter(z => z.oberzielId === id && z.id !== id);

/** Würde „`vonId` zahlt ein auf `aufId`“ einen Kreis schließen (oder die Kette zu tief machen)? Für die Auswahl. */
export function oberzielKreis(vonId: string, aufId: string, ziele: readonly Pick<ZielBezugRoh, 'id' | 'oberzielId' | 'abgeleitetVon'>[]): boolean {
  if (vonId === aufId) return true;
  const nachId = new Map(ziele.map(z => [z.id, z]));
  let id: string | undefined = aufId;
  for (let i = 0; id && i <= ZIEL_KETTE_MAX; i++) {
    if (id === vonId) return true;
    const z = nachId.get(id);
    if (!z) return false;
    id = zielEltern(z, nachId);
  }
  return !!id; // länger als die Grenze: wie ein Kreis behandeln (abgelehnt)
}

/**
 * Prüfung im Schreibweg der Ziele (über ALLEN Zielen des Bestands NACH der Änderung): für jedes berührte Ziel, dessen
 * `oberzielId` NEU ist (anders als `vorher`) — Ziel vorhanden und nicht archiviert, nicht es selbst, Bereich passt, kein Kreis.
 * Liefert den Grund (Text, beginnt mit „Abgelehnt“) oder null.
 */
export function oberzielPruefen(nachher: readonly ZielBezugRoh[], beruehrt: Iterable<string>, vorher: ReadonlyMap<string, string | undefined>): string | null {
  const nachId = new Map(nachher.map(z => [z.id, z]));
  for (const id of beruehrt) {
    const z = nachId.get(id);
    if (!z?.oberzielId || z.oberzielId === vorher.get(id)) continue;
    const ober = nachId.get(z.oberzielId);
    if (!ober || ober.archiviertAm || ober.id === z.id) return ZIEL_FEHLT;
    if (!bereichPasst(planBereich(z), planBereich(ober))) return BEREICH_GETRENNT;
    if (oberzielKreis(z.id, ober.id, nachher)) {
      return `Abgelehnt: „${z.titel ?? z.id}“ würde über die Ziel-Kette auf sich selbst einzahlen (oder die Kette wäre tiefer als ${ZIEL_KETTE_MAX} Ebenen). Nichts gespeichert.`;
    }
  }
  return null;
}

/**
 * Meilensteine (Schreibweg, über der Liste NACH der Änderung): ein NEU gesetztes `zielId` nennt ein Ziel des geteilten Bestands
 * im passenden Bereich; NEU genannte Vorgänger (`wartetAuf`) liegen im selben Bereich. Existenz/Kreise der Vorgänger prüft
 * weiter `kettePruefen`. `ziele` = null → das Ziel wird nicht geprüft (kein Ziel genannt).
 */
export function meilensteinBezugPruefen(
  nachher: readonly { id: string; space?: SpaceId; einheit?: string; bereich?: string; zielId?: string; wartetAuf?: string[] }[],
  beruehrt: Iterable<string>,
  vorher: ReadonlyMap<string, { zielId?: string; wartetAuf?: string[] }>,
  ziele: ReadonlyMap<string, { space?: SpaceId; einheit?: string }> | null,
): string | null {
  const nachId = new Map(nachher.map(m => [m.id, m]));
  const bereich = (m: { space?: SpaceId; einheit?: string; bereich?: string }): SpaceId | null => planBereich({ space: m.space ?? (m.bereich === 'gesundheit' ? 'privat' : m.bereich === 'business' ? 'business' : undefined), einheit: m.einheit });
  for (const id of beruehrt) {
    const m = nachId.get(id);
    if (!m) continue;
    const alt = vorher.get(id);
    if (m.zielId && m.zielId !== alt?.zielId) {
      const z = ziele?.get(m.zielId);
      if (!z) return ZIEL_FEHLT;
      if (!bereichPasst(bereich(m), planBereich(z))) return BEREICH_GETRENNT;
    }
    for (const v of (m.wartetAuf ?? []).filter(x => !(alt?.wartetAuf ?? []).includes(x))) {
      const w = nachId.get(v);
      if (w && !bereichPasst(bereich(m), bereich(w))) return BEREICH_GETRENNT;
    }
  }
  return null;
}

/** Kandidaten für „zahlt ein auf …“ an einem Ziel: gleicher Bereich, nicht archiviert, kein Kreis, nicht es selbst. */
export function oberzielKandidaten<Z extends ZielBezugRoh & { erledigt?: boolean }>(z: ZielBezugRoh, ziele: readonly Z[]): Z[] {
  return ziele.filter(x => x.id !== z.id && !x.archiviertAm && !x.erledigt && bereichPasst(planBereich(z), planBereich(x)) && !oberzielKreis(z.id, x.id, ziele));
}

// ── Aufgaben und Projekte ────────────────────────────────────────────────────

export interface AufgabeBezugRoh { id: string; title?: string; spaceId?: string; space?: SpaceId; parentId?: string; sichtbarkeit?: string; angelegtVon?: string; abhaengigVon?: string[]; zielId?: string; projectId?: string; listeId?: string }

/**
 * Prüfung im Schreibweg der Aufgaben (über dem Endstand): je berührter Aufgabe nur die NEU genannten Vorgänger und ein NEU
 * gesetztes Ziel. `besitzer(t)` = wer eine Aufgabe sehen darf (undefined = alle, Name = nur diese Person, null = niemand —
 * dieselbe Regel wie `darfSehen`). `ziele` = die Ziele des geteilten Bestands (Kennung → Bereich-Angaben, ohne archivierte).
 * Kreise prüft weiter `kreisBei`. Liefert den Grund oder null.
 */
export function aufgabenBezugPruefen(
  nachher: ReadonlyMap<string, AufgabeBezugRoh>,
  beruehrt: Iterable<string>,
  vorher: ReadonlyMap<string, Pick<AufgabeBezugRoh, 'abhaengigVon' | 'zielId'>>,
  o: { besitzer: (t: AufgabeBezugRoh) => string | null | undefined; ziele: ReadonlyMap<string, { space?: SpaceId; einheit?: string }> | null },
): string | null {
  for (const id of beruehrt) {
    const t = nachher.get(id);
    if (!t) continue;
    const alt = vorher.get(id);
    const neu = (t.abhaengigVon ?? []).filter(x => !(alt?.abhaengigVon ?? []).includes(x));
    if (neu.length) {
      const eigen = o.besitzer(t);
      for (const v of neu) {
        const w = nachher.get(v);
        if (!w) continue; // unbekannte Kennungen räumt `abhaengigAngleichen`/die Übernahme
        if (aufgabenBereich(t) !== aufgabenBereich(w)) return BEREICH_GETRENNT;
        const b = o.besitzer(w);
        if (b !== undefined && b !== eigen) return NUR_ICH_BEZUG;
      }
    }
    if (t.zielId && t.zielId !== alt?.zielId) {
      const z = o.ziele?.get(t.zielId);
      if (!z) return ZIEL_FEHLT;
      if (!bereichPasst(aufgabenBereich(t), planBereich(z))) return BEREICH_GETRENNT;
    }
  }
  return null;
}

/** Dieselbe Prüfung für Projekte (`Project.zielId`). */
export function projektBezugPruefen(
  nachher: readonly { id: string; spaceId?: string; zielId?: string }[],
  beruehrt: Iterable<string>,
  vorher: ReadonlyMap<string, string | undefined>,
  ziele: ReadonlyMap<string, { space?: SpaceId; einheit?: string }> | null,
): string | null {
  const nachId = new Map(nachher.map(p => [p.id, p]));
  for (const id of beruehrt) {
    const p = nachId.get(id);
    if (!p?.zielId || p.zielId === vorher.get(id)) continue;
    const z = ziele?.get(p.zielId);
    if (!z) return ZIEL_FEHLT;
    if (!bereichPasst(aufgabenBereich(p), planBereich(z))) return BEREICH_GETRENNT;
  }
  return null;
}

/**
 * Kandidaten für „wartet auf …“ an einer Aufgabe (Auswahl im Detail): gleicher Bereich, offen, nicht sie selbst; eine für den
 * Haushalt sichtbare Aufgabe bekommt keine „nur ich“-Aufgabe angeboten. Kreise filtert der Aufrufer (`wuerdeKreisen`).
 */
export function vorgaengerPasst(t: AufgabeBezugRoh, x: AufgabeBezugRoh & { status?: string }): boolean {
  if (x.id === t.id || x.status === 'done' || x.status === 'cancelled') return false;
  if (aufgabenBereich(t) !== aufgabenBereich(x)) return false;
  const nurIch = (a: AufgabeBezugRoh) => a.sichtbarkeit === 'nur-ich';
  return !nurIch(x) || (nurIch(t) && t.angelegtVon === x.angelegtVon);
}

/** Kandidaten für „zahlt ein auf …“ an einer Aufgabe/einem Projekt: Ziele aus passendem Bereich, offen, nicht archiviert. */
export function zielKandidaten<Z extends { id: string; space?: SpaceId; einheit?: string; archiviertAm?: string; erledigt?: boolean }>(bereich: SpaceId, ziele: readonly Z[]): Z[] {
  return ziele.filter(z => !z.archiviertAm && !z.erledigt && bereichPasst(bereich, planBereich(z)));
}

// ── Löschen und „Rückgängig“ ──────────────────────────────────────────────────

/** Gelöschte Ziele: andere Ziele verlieren `oberzielId` (sie bleiben stehen). `geloest` = deren Kennungen. */
export function oberzielLoesen<Z extends { id: string; oberzielId?: string }>(liste: readonly Z[], tot: ReadonlySet<string>): { liste: Z[]; geloest: string[] } {
  const geloest: string[] = [];
  const aus = liste.map(z => {
    if (!z.oberzielId || !tot.has(z.oberzielId)) return z;
    geloest.push(z.id);
    const n = { ...z };
    delete n.oberzielId;
    return n;
  });
  return { liste: aus, geloest };
}

/** Welche Aufgaben und Projekte zahlen direkt auf ein gelöschtes Ziel ein (`zielId`)? Nur Kennungen — gelöst wird im Schreibweg. */
export function zielBezuegeLoesen(state: { tasks: readonly { id: string; zielId?: string }[]; projects: readonly { id: string; zielId?: string }[] }, tot: ReadonlySet<string>): { aufgaben: string[]; projekte: string[] } {
  return {
    aufgaben: state.tasks.filter(t => !!t.zielId && tot.has(t.zielId)).map(t => t.id),
    projekte: state.projects.filter(p => !!p.zielId && tot.has(p.zielId)).map(p => p.id),
  };
}

/** Was ein Ziel-Löschen gelöst hat — die Antwort der Route, Grundlage für „Rückgängig“. */
export interface BezuegeGeloest { zielId: string; ziele: string[]; meilensteine: string[]; aufgaben: string[]; projekte: string[] }
export const KEINE_BEZUEGE_GELOEST = (zielId: string): BezuegeGeloest => ({ zielId, ziele: [], meilensteine: [], aufgaben: [], projekte: [] });

/**
 * „Rückgängig“: welche Einträge bekommen ihren Bezug zurück? Nur, wenn das Ziel wieder lebt und das Feld noch leer ist (andere
 * Änderungen inzwischen gehen vor). Rein — der Server schreibt danach über die vorhandenen Schreibwege.
 */
export function bezuegeZurueck(
  g: BezuegeGeloest,
  stand: { zielLebt: boolean; ziele: readonly { id: string; oberzielId?: string }[]; meilensteine: readonly { id: string; zielId?: string }[]; aufgaben: readonly { id: string; zielId?: string }[]; projekte: readonly { id: string; zielId?: string }[] },
): { ziele: string[]; meilensteine: string[]; aufgaben: string[]; projekte: string[] } {
  if (!stand.zielLebt) return { ziele: [], meilensteine: [], aufgaben: [], projekte: [] };
  const leer = <T extends { id: string }>(liste: readonly T[], ids: readonly string[], feld: (x: T) => string | undefined) => {
    const wer = new Set(ids);
    return liste.filter(x => wer.has(x.id) && !feld(x) && x.id !== g.zielId).map(x => x.id);
  };
  return {
    ziele: leer(stand.ziele, g.ziele, z => z.oberzielId),
    meilensteine: leer(stand.meilensteine, g.meilensteine, m => m.zielId),
    aufgaben: leer(stand.aufgaben, g.aufgaben, t => t.zielId),
    projekte: leer(stand.projekte, g.projekte, p => p.zielId),
  };
}

/** Eine Liste von Kennungen aus einer Anfrage säubern (≤ `max`, nur gültige, ohne Doppelte). */
export function kennungenSaeubern(v: unknown, max = 500): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.filter(istBezugKennung))).slice(0, max);
}
