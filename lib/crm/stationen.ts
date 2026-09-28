// ─── Markttraktion · Stationen: eine Person in mehreren Firmen (rein, getestet, 28.09.) ──
// Kevins Entscheidung 28.09. (#2/#3, „CRM grundsätzlich fertig“): Eine Person kann
// gleichzeitig in mehreren Firmen stehen (Geschäftsführerin hier, Beirätin dort), und
// ein Jobwechsel beendet die alte Station, statt sie zu überschreiben — die
// Beschäftigungshistorie bleibt.
//
//   Kontakt.stationen  { firmaId, rolle?, art?, von?, bis?, aktiv, haupt? }[]
//
// Rückwärtskompatibel (Bestand online, oberstes Gebot „kein Datenverlust“):
//   · `firmaId`/`firma`/`position` bleiben — als ABGELEITETE Hauptstation (die aktive mit
//     `haupt`, sonst die jüngste aktive). Jeder bestehende Leser liest weiter `firmaId`.
//   · Altbestand ohne `stationen`: beim Lesen entsteht aus `firmaId`/`position` eine aktive
//     Hauptstation (`stationenVon`) — ohne Schreiben. Gespeichert wird erst, wenn sich an
//     Firma, Position oder Stationen etwas ändert — und nur, wenn die Liste mehr trägt als
//     die alten Felder (eine einzige aktive Hauptstation = „trivial“, bleibt ungeschrieben).
//   · Schreibwege halten beides synchron: `stationenSynchron` (Kartei-Route, Import).
//     Ein alter Schreiber, der nur `firmaId` setzt (Firma zuordnen, Pipeline), wird als
//     Jobwechsel verstanden: die bisherige Hauptstation endet (`bis`, `aktiv: false`).
//
// „Personen einer Firma“ bestimmt NUR `personenDerFirma` (bzw. `personenJeFirma`,
// `firmenDerPerson`) — nie `k.firmaId === f.id` (Regel in CLAUDE.md).
// Diese Datei lädt zur Laufzeit nichts aus lib/make-one/crm.ts (Säuberung lädt sie).

import type { Kontakt } from '@/lib/make-one/crm';

export const STATION_ARTEN = ['angestellt', 'geschaeftsfuehrung', 'inhaber', 'beirat', 'aufsichtsrat', 'berater', 'investor', 'sonstig'] as const;
export type StationArt = typeof STATION_ARTEN[number];
export const STATION_ART_LABEL: Record<StationArt, string> = {
  angestellt: 'Angestellt', geschaeftsfuehrung: 'Geschäftsführung', inhaber: 'Inhaber', beirat: 'Beirat',
  aufsichtsrat: 'Aufsichtsrat', berater: 'Berater', investor: 'Investor', sonstig: 'Sonstig',
};
export const STATION_ART_WAHL: { id: StationArt; label: string }[] = STATION_ARTEN.map(id => ({ id, label: STATION_ART_LABEL[id] }));

export interface Station {
  firmaId: string;
  /** Position/Titel in dieser Firma. */
  rolle?: string;
  art?: StationArt;
  /** Tag (YYYY-MM-DD). */
  von?: string;
  bis?: string;
  aktiv: boolean;
  /** Die Hauptstation — genau eine unter den aktiven. Daraus leiten sich `firmaId`/`firma`/`position` ab. */
  haupt?: boolean;
}

/** Obergrenze je Person — darüber wird abgelehnt (413), nie gekürzt. */
export const STATIONEN_MAX = 200;

const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const tag = (v: unknown) => (typeof v === 'string' && TAG.test(v) ? v : undefined);
const text = (v: unknown, n: number) => { const t = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Eine Station prüfen — ohne gültige Firmen-Kennung fällt sie weg. */
function stationSaeubern(v: unknown): Station | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const firmaId = String(o.firmaId ?? '');
  if (!FIRMA_ID.test(firmaId)) return null;
  const von = tag(o.von);
  let bis = tag(o.bis);
  if (bis && von && bis < von) bis = undefined;
  // Ohne ausdrückliche Angabe: aktiv, solange kein Ende eingetragen ist.
  const aktiv = typeof o.aktiv === 'boolean' ? o.aktiv : !bis;
  const art = (STATION_ARTEN as readonly string[]).includes(String(o.art)) ? o.art as StationArt : undefined;
  const rolle = text(o.rolle, 160);
  return { firmaId, ...(rolle ? { rolle } : {}), ...(art ? { art } : {}), ...(von ? { von } : {}), ...(bis ? { bis } : {}), aktiv, ...(aktiv && o.haupt === true ? { haupt: true } : {}) };
}

/**
 * Stationen aus dem Netz prüfen. Kein Array → `undefined` (Feld fehlt). Ein leeres Array bleibt
 * ein leeres Array (ausdrücklich „keine Station“). Doppelte Fassungen fallen weg, höchstens eine
 * Hauptstation (die erste). Über `STATIONEN_MAX` lehnt die Route vorher ab (`kontaktZuGross`).
 */
export function stationenSaeubern(v: unknown): Station[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const gesehen = new Set<string>();
  const raus: Station[] = [];
  for (const x of v) {
    const s = stationSaeubern(x);
    if (!s) continue;
    const { haupt: _h, ...ohne } = s;
    const key = JSON.stringify(ohne);
    if (gesehen.has(key)) { if (s.haupt) { const i = raus.findIndex(r => JSON.stringify({ ...r, haupt: undefined }) === JSON.stringify({ ...ohne, haupt: undefined })); if (i >= 0 && s.aktiv) raus[i] = { ...raus[i], haupt: true }; } continue; }
    gesehen.add(key);
    raus.push(s);
  }
  return hauptEindeutig(raus);
}

/** Höchstens eine Hauptstation, nur unter den aktiven; beendete tragen nie `haupt`. */
function hauptEindeutig(l: Station[]): Station[] {
  let schon = false;
  return l.map(s => {
    if (!s.haupt) return s;
    if (!s.aktiv || schon) { const { haupt: _h, ...rest } = s; return rest; }
    schon = true;
    return s;
  });
}

type MitStationen = Pick<Kontakt, 'firmaId' | 'position' | 'stationen'>;

/** Die abgeleitete Station des Altbestands (nur `firmaId`/`position`). */
const ausAltFeldern = (k: MitStationen): Station[] => (k.firmaId ? [{ firmaId: k.firmaId, ...(k.position ? { rolle: k.position } : {}), aktiv: true, haupt: true }] : []);

/**
 * Die Stationen einer Person — gespeichert oder (Altbestand) aus `firmaId`/`position` abgeleitet.
 * Zeigt `firmaId` auf eine Firma ohne aktive Station (ein alter Schreiber hat nur die Kennung gesetzt),
 * gilt sie als aktive Hauptstation — so stimmt `firmaId` = Hauptstation für jeden Leser.
 */
export function stationenVon(k: MitStationen): Station[] {
  if (!Array.isArray(k.stationen)) return ausAltFeldern(k);
  if (k.firmaId && !k.stationen.some(s => s.aktiv && s.firmaId === k.firmaId)) {
    return [...k.stationen.map(s => (s.haupt ? { ...s, haupt: false } : s)), { firmaId: k.firmaId, ...(k.position ? { rolle: k.position } : {}), aktiv: true, haupt: true }];
  }
  return k.stationen;
}

/** Die Hauptstation: die aktive mit `haupt`, sonst die jüngste aktive (nach `von`, bei Gleichstand die spätere in der Liste). */
export function hauptStation(l: readonly Station[]): Station | undefined {
  const aktiv = l.filter(s => s.aktiv);
  return aktiv.find(s => s.haupt) ?? aktiv.reduce<Station | undefined>((best, s) => (!best || (s.von ?? '') >= (best.von ?? '') ? s : best), undefined);
}

/** Die Firmen einer Person (Kennungen, ohne Doppelte) — standardmäßig nur die aktiven. */
export function firmenDerPerson(k: MitStationen, opt: { nurAktiv?: boolean } = {}): string[] {
  const nurAktiv = opt.nurAktiv ?? true;
  return Array.from(new Set(stationenVon(k).filter(s => !nurAktiv || s.aktiv).map(s => s.firmaId)));
}

/** Steht die Person (aktuell bzw. je) in dieser Firma? */
export function istPersonDerFirma(k: MitStationen, firmaId: string, opt: { nurAktiv?: boolean } = {}): boolean {
  return !!firmaId && firmenDerPerson(k, opt).includes(firmaId);
}

/**
 * DIE Frage „Wer gehört zu dieser Firma?“ — Leads, BEAN, Deals je Firma, Segmente, Export,
 * Verbindungsprüfung, Firmen-Abgleich, Firmenkarte. `nurAktiv` (Standard): nur laufende Stationen;
 * `nurAktiv: false` zählt auch ehemalige (Historie, Löschsperre).
 */
export function personenDerFirma<K extends MitStationen>(kontakte: readonly K[], firmaId: string, opt: { nurAktiv?: boolean } = {}): K[] {
  return kontakte.filter(k => istPersonDerFirma(k, firmaId, opt));
}

/** Personen je Firma in einem Durchgang (für Listen über alle Firmen). */
export function personenJeFirma<K extends MitStationen>(kontakte: readonly K[], opt: { nurAktiv?: boolean } = {}): Map<string, K[]> {
  const m = new Map<string, K[]>();
  for (const k of kontakte) for (const id of firmenDerPerson(k, opt)) m.set(id, [...(m.get(id) ?? []), k]);
  return m;
}

/** Aktuelle und ehemalige Personen einer Firma getrennt (Firmenkarte). Wer aktiv dort ist, ist nie „ehemalig“. */
export function personenAufteilen<K extends MitStationen>(kontakte: readonly K[], firmaId: string): { aktuell: K[]; ehemalig: K[] } {
  const aktuell: K[] = [], ehemalig: K[] = [];
  for (const k of kontakte) {
    const st = stationenVon(k).filter(s => s.firmaId === firmaId);
    if (st.some(s => s.aktiv)) aktuell.push(k);
    else if (st.length) ehemalig.push(k);
  }
  return { aktuell, ehemalig };
}

/** Die Station einer Person in dieser Firma (aktive zuerst, sonst die jüngste beendete). */
export function stationIn(k: MitStationen, firmaId: string): Station | undefined {
  const st = stationenVon(k).filter(s => s.firmaId === firmaId);
  return st.find(s => s.aktiv) ?? [...st].sort((a, b) => (b.bis ?? '').localeCompare(a.bis ?? ''))[0];
}

/** Eine einzige aktive Hauptstation ohne Zusatz = genau das, was die alten Felder schon sagen. */
const trivial = (l: readonly Station[]) => l.length === 1 && l[0].aktiv && !!l[0].haupt && !l[0].art && !l[0].von && !l[0].bis;

/** Die Station beenden (Jobwechsel): nie löschen — `bis` und `aktiv: false`. */
const beenden = (s: Station, heute: string): Station => { const { haupt: _h, ...rest } = s; return { ...rest, aktiv: false, bis: s.bis ?? heute }; };

/**
 * `firmaId`/`firma`/`position` und `stationen` synchron halten — DIE Funktion für jeden Schreibweg
 * (Kartei-Route, Import). `neu` ist der Eintrag, wie er gespeichert werden soll, `alt` der gespeicherte
 * (fehlt bei Neuanlage). `firmaName` löst die Kennung der Hauptstation in den Anzeigenamen auf.
 *
 * Vorrang:
 *   1. `neu.stationen` weicht von den gespeicherten ab → die Stationen sind die Wahrheit; `firmaId`,
 *      `position` (= Rolle der Hauptstation) und `firma` folgen ihnen.
 *   2. sonst hat ein alter Schreiber `firmaId` geändert → Jobwechsel: die alte Hauptstation endet heute,
 *      die neue beginnt (war die Firma schon aktive Station, wird sie nur Hauptstation); ohne `firmaId`
 *      endet die Hauptstation. `position`/`firma` bleiben, wie der Schreiber sie schickt (altes Verhalten).
 *   3. sonst `position` geändert (Hand, Import) → Rolle der Hauptstation.
 * Ein Eintrag ohne `stationen` (älteres Fenster, Dienstweg) verliert die gespeicherten nie. Eine triviale
 * Liste (eine aktive Hauptstation ohne Zusatz) wird nur geschrieben, wenn schon Stationen gespeichert waren.
 */
export function stationenSynchron<K extends Kontakt>(neu: K, alt: Kontakt | undefined, heute: string, firmaName?: (id: string) => string | undefined): K {
  const altGespeichert = alt?.stationen;
  const explizit = neu.stationen !== undefined && !gleich(neu.stationen, altGespeichert);
  const firmaGeaendert = (neu.firmaId ?? '') !== (alt?.firmaId ?? '');
  const positionGeaendert = (neu.position ?? '') !== (alt?.position ?? '');
  if (!explizit && !firmaGeaendert && !positionGeaendert) {
    // Nichts an Firma/Position: die gespeicherten Stationen bleiben, wie sie sind.
    if (altGespeichert && neu.stationen === undefined) return { ...neu, stationen: altGespeichert };
    return neu;
  }
  const basis = alt ? stationenVon(alt) : [];
  const altHaupt = hauptStation(basis);
  let liste: Station[];
  if (explizit) liste = [...(neu.stationen ?? [])];
  else if (!firmaGeaendert) liste = [...basis];
  else {
    const i = neu.firmaId ? basis.findIndex(s => s.aktiv && s.firmaId === neu.firmaId) : -1;
    if (i >= 0) liste = basis.map((s, j) => (j === i ? { ...s, haupt: true } : beendetOhneHaupt(s)));
    else {
      liste = basis.map(s => (s === altHaupt ? beenden(s, heute) : s));
      if (neu.firmaId) liste.push({ firmaId: neu.firmaId, ...(altHaupt ? { von: heute } : {}), aktiv: true, haupt: true });
    }
  }
  // Genau eine Hauptstation unter den aktiven.
  liste = hauptEindeutig(liste.map(s => (s.aktiv ? s : beendetOhneHaupt(s))));
  const kandidat = hauptStation(liste);
  if (kandidat && !kandidat.haupt) liste = liste.map(s => (s === kandidat ? { ...s, haupt: true } : s));
  const out = { ...neu } as unknown as Record<string, unknown>;
  const hIndex = liste.findIndex(s => s.haupt);

  if (explizit) {
    const h = hIndex >= 0 ? liste[hIndex] : undefined;
    if (h) {
      out.firmaId = h.firmaId;
      if (h.rolle) out.position = h.rolle; else delete out.position;
      const name = firmaName?.(h.firmaId);
      if (name) out.firma = name;
    } else {
      delete out.firmaId;
      // Ausgeschieden: die abgeleiteten Felder fallen, die Historie bleibt in `stationen`.
      if (altHaupt) { delete out.position; delete out.firma; }
    }
  } else if (hIndex >= 0) {
    const h = liste[hIndex];
    out.firmaId = h.firmaId;
    // Rolle ↔ Position: eine geänderte Position wird die Rolle; eine Station ohne Rolle übernimmt die Position,
    // wenn sie die bisherige Hauptstation fortsetzt oder die Person vorher keine Firma hatte.
    const fortsetzung = !altHaupt || altHaupt.firmaId === h.firmaId;
    if (positionGeaendert) liste[hIndex] = neu.position ? { ...h, rolle: neu.position } : beendetOhneRolle(h);
    else if (!h.rolle && neu.position && fortsetzung) liste[hIndex] = { ...h, rolle: neu.position };
    if (!out.firma) { const name = firmaName?.(h.firmaId); if (name) out.firma = name; }
  } else delete out.firmaId;

  const schreiben = explizit || !!altGespeichert || !trivial(liste);
  if (schreiben) out.stationen = liste;
  else delete out.stationen;
  return out as unknown as K;
}
const beendetOhneRolle = (s: Station): Station => { const { rolle: _r, ...rest } = s; return rest; };
const beendetOhneHaupt = (s: Station): Station => { if (!s.haupt) return s; const { haupt: _h, ...rest } = s; return rest; };

/** Eine neue Station aus der Oberfläche. */
export interface StationNeu { firmaId: string; rolle?: string; art?: StationArt; von?: string }

/**
 * Jobwechsel (Kontaktseite „Firma wechseln“): die bisherige Hauptstation endet am Tag des Wechsels
 * (`bis`, `aktiv: false`) — nie überschrieben —, die neue beginnt und wird Hauptstation. Ein Wechsel in
 * dieselbe Firma ändert nur Rolle/Art. Liefert die neue Liste (die Felder dazu: `stationenFelder`).
 */
export function stationWechseln(k: MitStationen, neu: StationNeu, heute: string): Station[] {
  const tagWechsel = neu.von && TAG.test(neu.von) ? neu.von : heute;
  const alt = stationenVon(k);
  const h = hauptStation(alt);
  const rolle = text(neu.rolle, 160);
  const zusatz = { ...(rolle ? { rolle } : {}), ...(neu.art ? { art: neu.art } : {}) };
  if (h && h.firmaId === neu.firmaId) return alt.map(s => (s === h ? { ...s, ...zusatz, haupt: true } : s));
  const schon = alt.find(s => s.aktiv && s.firmaId === neu.firmaId);
  const liste = alt.map(s => (s === h ? { ...beendetOhneHaupt(s), aktiv: false, bis: h.bis ?? tagWechsel } : s === schon ? { ...s, ...zusatz, haupt: true } : beendetOhneHaupt(s)));
  return schon ? liste : [...liste, { firmaId: neu.firmaId, ...zusatz, von: tagWechsel, aktiv: true, haupt: true }];
}

/** Eine weitere laufende Station (z. B. Beirat neben der Geschäftsführung) — die Hauptstation bleibt. */
export function stationHinzufuegen(k: MitStationen, neu: StationNeu): Station[] {
  const alt = stationenVon(k);
  const rolle = text(neu.rolle, 160);
  const zusatz = { ...(rolle ? { rolle } : {}), ...(neu.art ? { art: neu.art } : {}), ...(neu.von && TAG.test(neu.von) ? { von: neu.von } : {}) };
  const schon = alt.find(s => s.aktiv && s.firmaId === neu.firmaId);
  if (schon) return alt.map(s => (s === schon ? { ...s, ...zusatz } : s));
  return [...alt, { firmaId: neu.firmaId, ...zusatz, aktiv: true, ...(alt.some(s => s.aktiv) ? {} : { haupt: true }) }];
}

/** Eine Station beenden (ausgeschieden) — bleibt als Historie stehen. */
export function stationBeenden(k: MitStationen, index: number, bis: string): Station[] {
  return stationenVon(k).map((s, i) => (i === index ? { ...beendetOhneHaupt(s), aktiv: false, bis: TAG.test(bis) ? bis : s.bis } as Station : s));
}
/** Eine Station entfernen — nur für Fehleinträge (eine echte Historie beendet man). */
export function stationEntfernen(k: MitStationen, index: number): Station[] {
  return stationenVon(k).filter((_, i) => i !== index);
}
/** Diese laufende Station wird Hauptstation. */
export function hauptWaehlen(k: MitStationen, index: number): Station[] {
  const l = stationenVon(k);
  if (!l[index]?.aktiv) return l;
  return l.map((s, i) => (i === index ? { ...s, haupt: true } : beendetOhneHaupt(s)));
}
/** Rolle, Art, von/bis einer Station ändern. */
export function stationAendern(k: MitStationen, index: number, felder: Partial<Pick<Station, 'rolle' | 'art' | 'von' | 'bis'>>): Station[] {
  return stationenVon(k).map((s, i) => {
    if (i !== index) return s;
    const x: Station = { ...s };
    for (const f of ['rolle', 'art', 'von', 'bis'] as const) {
      if (!(f in felder)) continue;
      const v = felder[f];
      if (v === undefined || v === '') delete x[f]; else (x as unknown as Record<string, unknown>)[f] = v;
    }
    return x;
  });
}

/**
 * Die Felder für `kontaktTeil` zu einer neuen Stationen-Liste: `stationen` plus die abgeleiteten
 * `firmaId`/`firma`/`position` (dieselbe Rechnung wie der Server, damit die Anzeige sofort stimmt).
 * `undefined` heißt „Feld entfernen“ (kontaktTeil schickt es als null).
 */
export function stationenFelder(k: Kontakt, liste: Station[], heute: string, firmaName?: (id: string) => string | undefined): Pick<Kontakt, 'stationen' | 'firmaId' | 'firma' | 'position'> {
  const r = stationenSynchron({ ...k, stationen: liste }, k, heute, firmaName);
  return { stationen: r.stationen ?? liste, firmaId: r.firmaId, firma: r.firma, position: r.position };
}

/** Stationen zweier Einträge derselben Person vereinen (Dubletten): `a` gewinnt, dieselbe laufende Firma nur einmal. */
export function stationenVereinen(a: MitStationen, b: MitStationen): Station[] | undefined {
  const sa = stationenVon(a), sb = stationenVon(b);
  if (!sa.length && !sb.length) return a.stationen ?? b.stationen;
  const raus = [...sa];
  for (const s of sb) {
    const gleicheLaufende = s.aktiv && raus.find(x => x.aktiv && x.firmaId === s.firmaId);
    if (gleicheLaufende) {
      const i = raus.indexOf(gleicheLaufende);
      raus[i] = { ...gleicheLaufende, ...(!gleicheLaufende.rolle && s.rolle ? { rolle: s.rolle } : {}), ...(!gleicheLaufende.art && s.art ? { art: s.art } : {}), ...(!gleicheLaufende.von && s.von ? { von: s.von } : {}) };
      continue;
    }
    const { haupt: _h, ...ohne } = s;
    if (raus.some(x => gleich({ ...x, haupt: undefined }, { ...ohne, haupt: undefined }))) continue;
    raus.push(ohne);
  }
  return hauptEindeutig(raus.some(s => s.haupt) || !raus.some(s => s.aktiv) ? raus : raus.map(s => (s === hauptStation(raus) ? { ...s, haupt: true } : s)));
}

/** Prüfbefunde je Person (Verbindungsprüfung): gespeicherte Stationen mit toter Firma, nicht genau einer Hauptstation, `firmaId` ≠ Hauptstation. */
export function stationenBefund(k: MitStationen, firmaDa: (id: string) => boolean): { firmaTot: boolean; hauptFalsch: boolean } {
  const l = Array.isArray(k.stationen) ? k.stationen : [];
  const firmaTot = l.some(s => !firmaDa(s.firmaId));
  const aktiv = l.filter(s => s.aktiv);
  const haupt = aktiv.filter(s => s.haupt);
  const hauptFalsch = l.length > 0 && ((aktiv.length > 0 && haupt.length !== 1) || l.some(s => !s.aktiv && s.haupt)
    || (aktiv.length > 0 ? (k.firmaId ?? '') !== (haupt[0]?.firmaId ?? '') : !!k.firmaId && !l.some(s => s.firmaId === k.firmaId)));
  return { firmaTot, hauptFalsch };
}

/**
 * Gehört eine Aktivität der Person in die Zeitlinie dieser Firma? Mit `firmaId` an der Aktivität (seit 28.09.
 * beim Anlegen gesetzt) genau dann, wenn sie dort entstand; Altbestand ohne: wenn ihr Tag in eine Station der
 * Person bei dieser Firma fällt (ohne `von` seit jeher, ohne `bis` bis heute).
 */
export function aktivitaetZurFirma(k: MitStationen, a: { am: string; firmaId?: string }, firmaId: string): boolean {
  if (a.firmaId) return a.firmaId === firmaId;
  const tag = (a.am ?? '').slice(0, 10);
  return stationenVon(k).some(s => s.firmaId === firmaId && (!s.von || s.von <= tag) && (s.aktiv || !s.bis || tag <= s.bis));
}
