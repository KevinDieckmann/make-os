// ─── Markttraktion — Playbooks und Event-Vorlagen je Haushalt: zusammensetzen und ändern (rein; Restpunkte 24.10.) ────────────────────────────────────────
// Die Vorgabe steht im Code (`PLAYBOOKS`, `VORLAGEN`); der Bestand des Haushalts trägt NUR Abweichungen je Kennung und eigene Vorlagen (Regeln und Typen:
// ./vorlagen-regeln.ts). Ohne Bestand ist das Ergebnis genau die Vorgabe (dieselben Objekte — bit-gleich, Test). Fest bleibt immer, was gesetzlich bzw.
// fachlich fest ist: Rechtshinweis, Zielgruppen-Filter und Zuständigkeit eines Playbooks kommen aus dem Code (eigene Kopien aus ihrer `basis`), ein anderer
// Kanal hängt den festen Satz des Kanals an (`KANAL_RECHT`). Gelesen wird das NUR über lib/crm/vorlagen-anpassung-server.ts (`playbooksFuer`, `eventVorlagenFuer`).

import { PLAYBOOKS, type Playbook } from './kampagnen';
import { VORLAGEN, type Vorlage } from './eventplanung';
import {
  KANAL_RECHT, KANAL_FEST, NICHT_KOPIERBAR, VORLAGEN_GRENZEN, eigeneId, playbookTeilPruefen, eventTeilPruefen, leererBestand,
  type EigenesPlaybook, type EigeneEventVorlage, type EventTeil, type EventVorlagenBestand, type PlaybookBestand, type PlaybookKanal, type PlaybookTeil, type VorlagenArt,
} from './vorlagen-regeln';

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── Zusammensetzen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rechtshinweis eines Playbooks: der der Vorgabe, bei anderem Kanal zusätzlich der feste Satz des Kanals (nie gespeichert). */
function rechtFuer(basis: Playbook, kanal: PlaybookKanal): string {
  return kanal === basis.kanal ? basis.recht : `${basis.recht} Kanal ${kanal}: ${KANAL_RECHT[kanal]}`;
}

/** Ein Playbook mit den Abweichungen des Haushalts (die festen Felder bleiben die der Vorgabe). */
function playbookMit(basis: Playbook, teil: PlaybookTeil, marke: Pick<Playbook, 'angepasst' | 'eigen' | 'basis'>, id = basis.id): Playbook {
  const kanal = (KANAL_FEST.has(basis.id) ? basis.kanal : teil.kanal ?? basis.kanal) as PlaybookKanal;
  const { segmentId, ...rest } = teil;
  const ohneSeg = { ...basis }; delete ohneSeg.segmentId;
  return {
    ...ohneSeg, ...rest, id, kanal, recht: rechtFuer(basis, kanal), zielgruppe: basis.zielgruppe, fuer: basis.fuer,
    ...(basis.zusatz ? { zusatz: basis.zusatz } : {}),
    ...(typeof segmentId === 'string' ? { segmentId } : {}),
    ...marke,
  };
}

/**
 * Die Playbooks des Haushalts: Vorgaben (angepasst, wo der Bestand abweicht) und danach die eigenen. Ohne Bestand genau `PLAYBOOKS`. Eine eigene Vorlage,
 * deren Vorgabe es im Code nicht mehr gibt, fällt weg (ohne Recht keine Vorlage).
 */
export function playbooksAus(b: PlaybookBestand | null | undefined, vorgaben: readonly Playbook[] = PLAYBOOKS): Playbook[] {
  if (!b || (!Object.keys(b.geaendert).length && !b.eigene.length)) return vorgaben as Playbook[];
  const code = vorgaben.map(p => (b.geaendert[p.id] ? playbookMit(p, b.geaendert[p.id], { angepasst: true }) : p));
  const eigene = b.eigene.flatMap(e => {
    const basis = vorgaben.find(p => p.id === e.basis);
    if (!basis) return [];
    const { id, basis: _b, ...teil } = e;
    return [playbookMit(basis, teil, { eigen: true, basis: basis.id }, id)];
  });
  return [...code, ...eigene];
}

/** Eine Event-Vorlage mit den Abweichungen des Haushalts (Format bleibt das der Vorgabe). */
function eventMit(basis: Vorlage, teil: EventTeil, marke: Pick<Vorlage, 'angepasst' | 'eigen' | 'basis'>, id = basis.id): Vorlage {
  return { ...basis, ...teil, id, format: basis.format, ...marke };
}

/** Die Event-Vorlagen des Haushalts (wie `playbooksAus`). Ohne Bestand genau `VORLAGEN`. */
export function eventVorlagenAus(b: EventVorlagenBestand | null | undefined, vorgaben: readonly Vorlage[] = VORLAGEN): Vorlage[] {
  if (!b || (!Object.keys(b.geaendert).length && !b.eigene.length)) return vorgaben as Vorlage[];
  const code = vorgaben.map(v => (b.geaendert[v.id] ? eventMit(v, b.geaendert[v.id], { angepasst: true }) : v));
  const eigene = b.eigene.flatMap(e => {
    const basis = vorgaben.find(v => v.id === e.basis);
    if (!basis) return [];
    const { id, basis: _b, ...teil } = e;
    return [eventMit(basis, teil, { eigen: true, basis: basis.id }, id)];
  });
  return [...code, ...eigene];
}

// ── Lesen (Säubern) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Einen gelesenen Bestand säubern (rein): unbekannte Kennungen und Einträge, die die Prüfung nicht bestehen, fallen weg — nie ein Absturz beim Lesen. */
export function bestandAus<T, E>(art: VorlagenArt, roh: unknown): { v: 1; geaendert: Record<string, T>; eigene: E[]; geaendertAm?: string } {
  const leer = leererBestand<T, E>();
  if (!roh || typeof roh !== 'object') return leer;
  const o = roh as Record<string, unknown>;
  const ids = new Set(art === 'playbook' ? PLAYBOOKS.map(p => p.id) : VORLAGEN.map(v => v.id));
  const pruefe = (x: unknown) => (art === 'playbook' ? playbookTeilPruefen(x) : eventTeilPruefen(x, p => `${p}-x`));
  const geaendert: Record<string, T> = {};
  for (const [id, x] of Object.entries((o.geaendert && typeof o.geaendert === 'object' ? o.geaendert : {}) as Record<string, unknown>)) {
    if (!ids.has(id)) continue;
    const r = pruefe(x);
    if (r.ok && Object.keys(r.teil).length) geaendert[id] = r.teil as T;
  }
  const eigene: E[] = [];
  for (const x of Array.isArray(o.eigene) ? o.eigene : []) {
    if (!x || typeof x !== 'object') continue;
    const { id, basis, ...teil } = x as Record<string, unknown>;
    if (typeof id !== 'string' || typeof basis !== 'string' || !ids.has(basis) || eigene.some(e => (e as { id: string }).id === id)) continue;
    const r = pruefe(teil);
    if (r.ok) eigene.push({ ...r.teil, id, basis } as E);
  }
  return { v: 1, geaendert, eigene, ...(typeof o.geaendertAm === 'string' ? { geaendertAm: o.geaendertAm } : {}) };
}

// ── Ändern ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eine Änderung (Oberfläche: „Speichern“, „Als eigene Vorlage kopieren“, „Zurück auf Standard“, „Löschen“). `vorlage` = die ganzen bearbeitbaren Felder.
 */
export type VorlagenOp =
  | { op: 'speichern'; id: string; vorlage: unknown }
  | { op: 'kopieren'; id: string; name?: string }
  | { op: 'standard'; id: string }
  | { op: 'loeschen'; id: string };
export type VorlagenErgebnis<B> = { ok: true; bestand: B; id: string; geaendert: boolean } | { ok: false; status: 400 | 404 | 409 | 413; fehler: string };

export interface AendernKontext {
  /** Zufall für neue Kennungen (8 Hex-Zeichen werden genommen). */
  zufall: () => string;
  /** Neue Kennungen für Checklisten-Punkte und Budget-Posten. */
  neueId: (praefix: string) => string;
  /** Gespeicherte Segmente (nicht gelöscht) — ein Segment-Vorschlag muss eines davon sein. */
  segmente?: ReadonlySet<string>;
}

/** Nur die Felder, die von der Vorgabe abweichen (ohne Abweichung: nichts). */
function abweichungen<T extends Record<string, unknown>>(teil: T, vorgabe: Record<string, unknown>): Partial<T> {
  const raus: Partial<T> = {};
  for (const [k, v] of Object.entries(teil)) {
    if (k === 'segmentId') { if (v) (raus as Record<string, unknown>)[k] = v; continue; }
    if (!gleich(v, vorgabe[k])) (raus as Record<string, unknown>)[k] = v;
  }
  return raus;
}

/** Eine Änderung anwenden (rein). Unbekannt 404, ungültig 400, zu viele eigene 413 — sonst der neue Bestand und die Kennung der betroffenen Vorlage. */
export function vorlagenAendern(art: 'playbook', b: PlaybookBestand, op: VorlagenOp, ctx: AendernKontext): VorlagenErgebnis<PlaybookBestand>;
export function vorlagenAendern(art: 'event', b: EventVorlagenBestand, op: VorlagenOp, ctx: AendernKontext): VorlagenErgebnis<EventVorlagenBestand>;
export function vorlagenAendern(art: VorlagenArt, b: PlaybookBestand | EventVorlagenBestand, op: VorlagenOp, ctx: AendernKontext): VorlagenErgebnis<PlaybookBestand | EventVorlagenBestand> {
  if (!op || typeof op !== 'object' || typeof (op as { id?: unknown }).id !== 'string') return { ok: false, status: 400, fehler: 'Welche Vorlage? (id fehlt)' };
  const vorgaben: readonly (Playbook | Vorlage)[] = art === 'playbook' ? PLAYBOOKS : VORLAGEN;
  const code = vorgaben.find(v => v.id === op.id);
  const eigenIdx = b.eigene.findIndex(e => e.id === op.id);
  if (!code && eigenIdx < 0) return { ok: false, status: 404, fehler: 'Diese Vorlage gibt es nicht (mehr) — bitte neu laden.' };
  const geaendert = { ...b.geaendert } as Record<string, unknown>;
  const eigene = [...b.eigene] as (EigenesPlaybook | EigeneEventVorlage)[];
  const fertig = (id: string, wurde: boolean) => ({ ok: true as const, bestand: { ...b, geaendert, eigene } as PlaybookBestand | EventVorlagenBestand, id, geaendert: wurde });

  if (op.op === 'speichern') {
    const basisId = code ? code.id : eigene[eigenIdx].basis;
    const basis = vorgaben.find(v => v.id === basisId)!;
    const r = art === 'playbook' ? playbookTeilPruefen(op.vorlage, KANAL_FEST.has(basisId) ? { kanalFest: (basis as Playbook).kanal } : {}) : eventTeilPruefen(op.vorlage, ctx.neueId);
    if (!r.ok) return { ok: false, status: r.status, fehler: r.fehler };
    const teil = r.teil as Record<string, unknown>;
    if (art === 'playbook' && typeof teil.segmentId === 'string' && ctx.segmente && !ctx.segmente.has(teil.segmentId)) return { ok: false, status: 400, fehler: 'Dieses Segment gibt es nicht (mehr) — bitte ein gespeichertes wählen.' };
    if (code) {
      const ab = abweichungen(teil, code as unknown as Record<string, unknown>);
      const vorher = geaendert[code.id] ?? {};
      // Felder, die nicht mitkamen, behalten ihre bisherige Abweichung; mitgekommene ersetzen sie (gleich der Vorgabe = keine Abweichung mehr).
      const neu: Record<string, unknown> = { ...(vorher as Record<string, unknown>) };
      for (const k of Object.keys(teil)) { if (k in ab) neu[k] = (ab as Record<string, unknown>)[k]; else delete neu[k]; }
      if (Object.keys(neu).length) geaendert[code.id] = neu; else delete geaendert[code.id];
      return fertig(code.id, !gleich(vorher, geaendert[code.id] ?? {}));
    }
    const alt = eigene[eigenIdx];
    const neu = { ...alt, ...teil, id: alt.id, basis: alt.basis } as Record<string, unknown>;
    if (art === 'playbook' && teil.segmentId === null) delete neu.segmentId;
    eigene[eigenIdx] = neu as unknown as EigenesPlaybook | EigeneEventVorlage;
    return fertig(alt.id, !gleich(alt, neu));
  }

  if (op.op === 'kopieren') {
    const basisId = code ? code.id : eigene[eigenIdx].basis;
    if (art === 'playbook' && NICHT_KOPIERBAR.has(basisId)) return { ok: false, status: 400, fehler: 'Dieses Playbook steuert die Vernetzen-Runde — es gibt es nur einmal. Bearbeiten geht.' };
    if (eigene.length >= VORLAGEN_GRENZEN.eigene) return { ok: false, status: 413, fehler: `Höchstens ${VORLAGEN_GRENZEN.eigene} eigene Vorlagen — erst eine löschen. Nichts gespeichert.` };
    // Kopiert wird die WIRKSAME Fassung (mit den Abweichungen des Haushalts), nur die bearbeitbaren Felder.
    const quelle = (art === 'playbook' ? playbooksAus(b as PlaybookBestand) : eventVorlagenAus(b as EventVorlagenBestand)).find(v => v.id === op.id)!;
    let id = eigeneId(art, basisId, ctx.zufall());
    for (let i = 0; eigene.some(e => e.id === id) && i < 5; i++) id = eigeneId(art, basisId, ctx.zufall());
    const titel = typeof op.name === 'string' && op.name.trim() ? op.name.trim() : `${art === 'playbook' ? (quelle as Playbook).name : (quelle as Vorlage).label} (Kopie)`;
    if (art === 'playbook') {
      const p = quelle as Playbook;
      const r = playbookTeilPruefen({ name: titel, kurz: p.kurz, warum: p.warum, kennzahl: p.kennzahl, kanal: p.kanal, schritte: p.schritte, ...(p.segmentId ? { segmentId: p.segmentId } : {}) });
      if (!r.ok) return { ok: false, status: r.status, fehler: r.fehler };
      eigene.push({ ...(r.teil as Required<PlaybookTeil>), id, basis: basisId } as EigenesPlaybook);
    } else {
      const v = quelle as Vorlage;
      const r = eventTeilPruefen({ label: titel, beschreibung: v.beschreibung, uhrzeit: v.uhrzeit, kapazitaet: v.kapazitaet, mixZiel: v.mixZiel, ablauf: v.ablauf, checkliste: v.checkliste, budget: v.budget }, ctx.neueId);
      if (!r.ok) return { ok: false, status: r.status, fehler: r.fehler };
      eigene.push({ ...(r.teil as Required<EventTeil>), id, basis: basisId } as EigeneEventVorlage);
    }
    return fertig(id, true);
  }

  if (op.op === 'standard') {
    if (!code) return { ok: false, status: 400, fehler: 'Eine eigene Vorlage hat keinen Standard — löschen oder bearbeiten.' };
    const war = code.id in geaendert;
    delete geaendert[code.id];
    return fertig(code.id, war);
  }

  if (op.op === 'loeschen') {
    if (code) return { ok: false, status: 400, fehler: 'Vorlagen des Systems lassen sich nicht löschen — „Zurück auf Standard“ nimmt die eigenen Änderungen heraus.' };
    const [weg] = eigene.splice(eigenIdx, 1);
    return fertig(weg.id, true);
  }
  return { ok: false, status: 400, fehler: 'op: speichern, kopieren, standard oder loeschen.' };
}

/** Wie viele Vorlagen der Haushalt angepasst oder selbst angelegt hat (Zähler an der Stellschraube „Vorlagen“). */
export const vorlagenAnzahl = (b: { geaendert: Record<string, unknown>; eigene: readonly unknown[] }): number => Object.keys(b.geaendert).length + b.eigene.length;
