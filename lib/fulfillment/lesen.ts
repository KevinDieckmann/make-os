// ─── Fulfillment — Säuberer und leere Bestände (C0, 10.10.; FULFILLMENT_KONZEPT.md 8.1/8.3) ─────────────────────────────────────────
// Jede Datei, die aus dem Speicher kommt, läuft hier durch — robust: Unlesbares fällt weg, nie ein Absturz, nie eine erfundene Angabe.
// Listen werden NIE gekürzt (Grenzen prüft der Schreibweg, lib/fulfillment/grenzen.ts → 413). Texte bleiben, wie sie sind (nicht getrimmt),
// damit „gelesen = gespeichert“ gilt und der Stand (Fingerabdruck) eines Eintrags stabil bleibt. Optionale Felder ohne gültigen Wert fehlen
// ganz (nie `undefined` im Objekt). Lesen schreibt nie: ein leerer bzw. fehlender Bestand ergibt `leer…()`.
// Rein und client-sicher. Neues optionales Feld in lib/fulfillment/typen.ts → hier dazunehmen, sonst fällt es beim Lesen weg.

import type { KreislaufId } from '@/lib/crm/planung';
import {
  FULFILLMENT_VERSION,
  type VorlagenDatei, type ProzessVorlage, type ProzessKnoten, type Uebergang, type Freigabepunkt, type Rolle, type Herkunft, type Baustein, type Frage,
  type RitualVorlage, type FulfillmentEinstellungen, type ImportLauf, type AnalyseAgentId, type BausteinArt, type AblaufForm, type Rhythmus,
  type FaelleDatei, type Fall, type FallKnoten, type Vereinbarung, type Stakeholder, type Entscheidung, type Mitschrift, type WertKontoEintrag,
  type KundeDatei, type KundenLink, type FormularStand, type PulsAnfrage, type Puls, type Unterlage,
  type DossierDatei, type Dossier, type Abschnitt, type AbschnittId, type Aussage, type Quelle, type AnalyseLauf, type Massnahme, type LaufStatus,
  type PersonenDatei, type PersonenKarte, type FulfillmentArt, type FulfillmentDateien, type KnotenForm, type Zweige, type VorlagenPapierkorb, type KnotenLage, type PfeilText, type FallZusatz,
} from './typen';
import { LAGE } from './grenzen';
import { hohlerFallKnoten, hohlerVorlagenKnoten, phasenOrdnen } from './prozesse/phasen';

type O = Record<string, unknown>;

// ── Werkzeug ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);
/** Nicht-leerer Text (unverändert) oder undefined. */
const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const b = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const wahl = <T extends string>(v: unknown, l: readonly T[]): T | undefined => (typeof v === 'string' && (l as readonly string[]).includes(v) ? (v as T) : undefined);
const texte = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const liste = <T>(v: unknown, f: (x: O) => T | null): T[] => (Array.isArray(v) ? v.map(x => { const o = obj(x); return o ? f(o) : null; }).filter((x): x is T => x !== null) : []);
const ID = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const id = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);
const ids = (v: unknown): string[] => texte(v).filter(x => ID.test(x));
/** Objekt ohne `undefined`-Werte (optionale Felder fehlen ganz). */
const sauber = <T>(o: Record<string, unknown>): T => Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined)) as T;
const textMap = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(obj(v) ?? {}).filter(([k, w]) => ID.test(k) && typeof w === 'string')) as Record<string, string>;

const ZUSTAENDIG = ['intern', 'kunde', 'beide'] as const;
export const KREISLAUF_IDS = ['kanaele', 'leads', 'deals', 'followup', 'fulfillment', 'nachher', 'wiederkauf'] as const satisfies readonly KreislaufId[];
export const ANALYSE_AGENTEN = ['a0', 'ap', 'tb', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12', 'a13'] as const satisfies readonly AnalyseAgentId[];
/** Die Rhythmen eines Rituals — EINE Liste für Säuberer und Vorlagen-Ops (Typ `Rhythmus`; Texte in lib/fulfillment/prozesse/rituale.ts). */
export const RITUAL_RHYTHMEN = ['einmal', 'taeglich', 'werktags', 'woche', 'zwei-wochen', 'monat', 'quartal'] as const satisfies readonly Rhythmus[];
/** Die Zeichenformen eines Ablaufs — EINE Liste für Säuberer, Vorlagen-Ops und Import (Typ `AblaufForm`). */
export const ABLAUF_FORMEN = ['baum', 'trichter', 'fluss', 'zeitachse', 'kreis'] as const satisfies readonly AblaufForm[];
export const BAUSTEIN_ARTEN = ['aufgabe', 'dokument', 'skript', 'checkliste', 'mail', 'kennzahl', 'ritual', 'formular', 'workbook', 'analyse', 'freigabe'] as const satisfies readonly BausteinArt[];
export const ABSCHNITT_IDS = ['fazit', 'unternehmen', 'gesellschafter', 'markt', 'aussen', 'vertrieb', 'reputation', 'finanzen', 'chancen_risiken', 'good_bad', 'hypothesen', 'fragen', 'recht'] as const satisfies readonly AbschnittId[];
/** Die Formen eines Knotens im Fluss (Prozess-Editor, 17.10.) — EINE Liste für Säuberer, Editor-Ops und Oberfläche (Typ `KnotenForm`). */
export const KNOTEN_FORMEN = ['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'abstimmung'] as const satisfies readonly KnotenForm[];
/** Frist eines Knotens in Tagen (Prozess-Editor): ganze Tage 0 … 3650. */
const frist = (v: unknown): number | undefined => { const x = n(v); return x !== undefined && Number.isInteger(x) && x >= 0 && x <= 3650 ? x : undefined; };
/** Zweige ja/nein (Prozess-Editor) — nur gültige Kennungen; ohne beide fehlt das Feld. */
const zweige = (v: unknown): Zweige | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const ja = id(o.ja), nein = id(o.nein);
  return ja || nein ? sauber<Zweige>({ ja, nein }) : undefined;
};
/** Lage auf der Fläche (Prozess-Editor) — nur endliche Zahlen in den Grenzen (`LAGE`); Breite/Höhe nur gültig, sonst fehlen sie. */
const lage = (v: unknown): KnotenLage | undefined => {
  const o = obj(v);
  const x = n(o?.x), y = n(o?.y);
  if (!o || x === undefined || y === undefined || Math.abs(x) > LAGE.max || Math.abs(y) > LAGE.max) return undefined;
  const mass = (w: unknown) => { const z = n(w); return z !== undefined && z >= LAGE.rahmenMin && z <= LAGE.rahmenMax ? z : undefined; };
  return sauber<KnotenLage>({ x, y, b: mass(o.b), h: mass(o.h) });
};
/** Beschriftung der Pfeile (Fläche) — ohne Text fehlt das Feld. */
const pfeilText = (v: unknown): PfeilText | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const t = sauber<PfeilText>({ weiter: s(o.weiter), ja: s(o.ja), nein: s(o.nein) });
  return Object.keys(t).length ? t : undefined;
};
/** Höchstzahl der Runden an einer Erinnerung (Ausführung, 17.10. abends): ganze Zahl 1 … 20. */
const versuche = (v: unknown): number | undefined => { const x = n(v); return x !== undefined && Number.isInteger(x) && x >= 1 && x <= 20 ? x : undefined; };
/** Gezählte Runden einer Entscheidung bzw. Erinnerung: ganze Zahl 1 … 1000 (0 fehlt). */
const runden = (v: unknown): number | undefined => { const x = n(v); return x !== undefined && Number.isInteger(x) && x >= 1 && x <= 1000 ? x : undefined; };
const LAUF_STATUS = ['bereit', 'laeuft', 'fertig', 'fehler', 'abgebrochen', 'uebernommen', 'verworfen'] as const satisfies readonly LaufStatus[];

// ── Vorlagen-Bestand `fulfillment--<h>` ───────────────────────────────────────────────────────────────────────────────────────────────

/** Vorgaben der Instanz-Einstellungen (Kunden-Link kommt AUS, Puls-Schwelle 6, Willkommen in 24 h, Nachsorge +14/+45/+90 Tage). */
export const EINSTELLUNGEN_VORGABE: FulfillmentEinstellungen = { kundenLink: { an: false }, pulsSchwelle: 6, willkommenStunden: 24, nachsorgeTage: [14, 45, 90] };

const herkunft = (v: unknown): Herkunft | undefined => {
  const o = obj(v); const art = wahl(o?.art, ['muster', 'import', 'hand', 'demo'] as const); const am = s(o?.am);
  if (!o || !art || !am) return undefined;
  const q = texte(o.quelleIds);
  return sauber<Herkunft>({ art, am, datei: s(o.datei), quelleIds: q.length ? q : undefined, importLauf: s(o.importLauf) });
};
const knoten = (o: O): ProzessKnoten | null => {
  const i = id(o.id); const titel = s(o.titel);
  if (!i || !titel) return null;
  const kreislauf = texte(o.kreislauf).filter((x): x is KreislaufId => (KREISLAUF_IDS as readonly string[]).includes(x));
  const werkzeuge = texte(o.werkzeuge);
  return sauber<ProzessKnoten>({
    id: i, elternId: id(o.elternId), titel, rang: n(o.rang) ?? 0,
    zone: wahl(o.zone, ['dach', 'etage', 'fundament'] as const), kreislauf: kreislauf.length ? kreislauf : undefined, ort: s(o.ort), verweis: id(o.verweis),
    ziel: s(o.ziel), warum: s(o.warum), eingang: s(o.eingang), ergebnis: s(o.ergebnis), kennzahl: s(o.kennzahl),
    zustaendig: wahl(o.zustaendig, ZUSTAENDIG), rolle: s(o.rolle), dauerTage: n(o.dauerTage), aufwandStunden: n(o.aufwandStunden),
    freigabe: id(o.freigabe), kundeSichtbar: b(o.kundeSichtbar), phaseId: s(o.phaseId), bausteinId: id(o.bausteinId),
    heute: s(o.heute), werkzeuge: werkzeuge.length ? werkzeuge : undefined, dokumentation: s(o.dokumentation),
    art: wahl(o.art, ['einstieg', 'stufe', 'ausstieg', 'routine'] as const), optional: b(o.optional), ausgang: s(o.ausgang), original: s(o.original),
    beleg: wahl(o.beleg, ['quelle', 'ergaenzung'] as const),
    form: wahl(o.form, KNOTEN_FORMEN), frist: frist(o.frist), zweige: zweige(o.zweige), pos: lage(o.pos), pfeilText: pfeilText(o.pfeilText), versuche: versuche(o.versuche),
  });
};
/** Der gemerkte Platz eines gelöschten Schritts (genau eine Angabe, sonst keiner). */
const platzAus = (v: unknown): VorlagenPapierkorb['platz'] => {
  const o = obj(v);
  if (!o) return undefined;
  for (const f of ['nach', 'vor', 'inGruppe', 'nachGruppe'] as const) { const x = id(o[f]); if (x) return { [f]: x }; }
  return o.anfang === true ? { anfang: true } : undefined;
};
/** Ein Eintrag im Papierkorb einer Paket-Vorlage (Prozess-Editor) — ohne Knoten fällt er weg (es gäbe nichts zurückzuholen). */
const papierkorbEintrag = (o: O): VorlagenPapierkorb | null => {
  const i = id(o.id), am = s(o.am), art = wahl(o.art, ['phase', 'gruppe', 'schritt', 'baustein'] as const);
  const kn = liste(o.knoten, knoten);
  if (!i || !am || !art || !kn.length) return null;
  const verweise = liste(o.verweise, x => { const k = id(x.knotenId), z = wahl(x.zweig, ['ja', 'nein'] as const), ziel = id(x.ziel); return k && z && ziel ? { knotenId: k, zweig: z, ziel } : null; });
  return sauber<VorlagenPapierkorb>({
    id: i, am, von: s(o.von) ?? '', art, phaseId: id(o.phaseId), elternId: id(o.elternId), nachId: id(o.nachId), vorId: id(o.vorId), platz: platzAus(o.platz), knoten: kn,
    verweise: verweise.length ? verweise : undefined, still: o.still === true ? true : undefined,
  });
};
const uebergang = (o: O): Uebergang | null => {
  const von = id(o.von), nach = id(o.nach), art = wahl(o.art, ['weiter', 'rueckweg', 'ausstieg', 'schleife', 'kreislauf'] as const);
  return von && nach && art ? sauber<Uebergang>({ von, nach, art, weiche: s(o.weiche), beleg: wahl(o.beleg, ['quelle', 'ergaenzung'] as const) }) : null;
};
const freigabepunkt = (o: O): Freigabepunkt | null => {
  const i = id(o.id), titel = s(o.titel);
  return i && titel ? { id: i, titel, wer: wahl(o.wer, ZUSTAENDIG) ?? 'beide' } : null;
};
const rolle = (o: O): Rolle | null => {
  const i = id(o.id), titel = s(o.titel);
  return i && titel ? sauber<Rolle>({ id: i, titel, aufgabe: s(o.aufgabe) }) : null;
};
/**
 * Die Teile des Vorlagen-Säuberers für den Säuberer der Werkstatt (lib/prozesse/bestand.ts, 22.10. — Fulfillment in die Werkstatt, Etappe 1): EINE Regel je
 * Feld, damit ein Paket, das die Werkstatt öffnet und wieder speichert, nichts verliert. Reine Weitergabe — das Verhalten hier bleibt, wie es ist.
 */
export { knoten as vorlagenKnotenAus, uebergang as uebergangAus, freigabepunkt as freigabepunktAus, rolle as rolleAus, papierkorbEintrag as papierkorbEintragAus };
export function vorlageAus(o: O): ProzessVorlage | null {
  const i = id(o.id), art = wahl(o.art, ['landkarte', 'paket', 'ablauf'] as const), titel = s(o.titel);
  if (!i || !art || !titel) return null;
  const zh = texte(o.zeichenhinweise);
  const phasenVonHand = art === 'paket' && o.phasenVonHand === true ? true as const : undefined;
  const kn = liste(o.knoten, knoten);
  const pk = art === 'paket' ? liste(o.papierkorb, papierkorbEintrag) : [];
  return sauber<ProzessVorlage>({
    id: i, art, titel, beschreibung: s(o.beschreibung), form: wahl(o.form, ABLAUF_FORMEN),
    quelleHinweis: s(o.quelleHinweis), vorbehalt: s(o.vorbehalt), zeichenhinweise: zh.length ? zh : undefined,
    // Paket-Vorlagen: Phasen nach der EINEN Regel geordnet, hohle Dach-Phasen zusammengelegt (12.10., ./prozesse/phasen.ts) — nur beim Lesen;
    // gespeichert wird die geordnete Fassung erst mit dem nächsten Schreibvorgang. Von Hand geordnete Phasen bleiben.
    knoten: art === 'paket' && !phasenVonHand ? phasenOrdnen(kn, { hohl: hohlerVorlagenKnoten }) : kn,
    uebergaenge: liste(o.uebergaenge, uebergang), freigaben: liste(o.freigaben, freigabepunkt), rollen: liste(o.rollen, rolle),
    fassung: n(o.fassung) ?? 1, herkunft: herkunft(o.herkunft), geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '', phasenVonHand,
    papierkorb: pk.length ? pk : undefined,
    // Zusatzmodul (17.10. spät) — nur Pakete.
    zusatz: art === 'paket' && o.zusatz === true ? true : undefined,
  });
}
const frage = (o: O): Frage | null => {
  const i = id(o.id), f = s(o.frage), art = wahl(o.art, ['text', 'langtext', 'zahl', 'auswahl', 'ja-nein'] as const);
  if (!i || !f || !art) return null;
  const opt = texte(o.optionen);
  return sauber<Frage>({ id: i, abschnitt: s(o.abschnitt), frage: f, art, optionen: opt.length ? opt : undefined, pflicht: b(o.pflicht), hilfe: s(o.hilfe) });
};
const vermerk = <T extends string>(v: unknown, felder: readonly T[]): Record<T, string> | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  const r = {} as Record<T, string>;
  for (const f of felder) { const x = o[f]; if (typeof x !== 'string') return undefined; r[f] = x; }
  return r;
};
export function bausteinAus(o: O): Baustein | null {
  const i = id(o.id), art = wahl(o.art, BAUSTEIN_ARTEN), titel = s(o.titel);
  if (!i || !art || !titel) return null;
  return sauber<Baustein>({
    id: i, art, titel, zweck: s(o.zweck), warum: s(o.warum), ergebnis: s(o.ergebnis), kennzahl: s(o.kennzahl), hinweis: s(o.hinweis),
    gliederung: texte(o.gliederung), text: typeof o.text === 'string' ? o.text : undefined, platzhalter: texte(o.platzhalter),
    fragen: Array.isArray(o.fragen) ? liste(o.fragen, frage) : undefined, kundeFuellt: b(o.kundeFuellt),
    wer: wahl(o.wer, ZUSTAENDIG) ?? 'intern', kundeSichtbar: b(o.kundeSichtbar) ?? false,
    lieferobjekt: s(o.lieferobjekt), analyse: wahl(o.analyse, ANALYSE_AGENTEN), ritualId: id(o.ritualId),
    rechtPruefen: vermerk(o.rechtPruefen, ['seit', 'grund'] as const), rechtGeprueft: vermerk(o.rechtGeprueft, ['am', 'von', 'notiz'] as const),
    urheberPruefen: vermerk(o.urheberPruefen, ['seit', 'grund'] as const), herkunftText: s(o.herkunftText),
    tags: texte(o.tags), vonHand: o.vonHand === true ? true : undefined, herkunft: herkunft(o.herkunft),
    fassung: n(o.fassung) ?? 1, geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '',
    sieheAuch: (() => { const l = Array.from(new Set(ids(o.sieheAuch))).filter(x => x !== i); return l.length ? l : undefined; })(),
  });
}
const TEILNEHMENDE = ['intern', 'entscheider', 'tagesverantwortlich', 'team'] as const;
const ritual = (o: O): RitualVorlage | null => {
  const i = id(o.id), titel = s(o.titel), rhythmus = wahl(o.rhythmus, RITUAL_RHYTHMEN);
  if (!i || !titel || !rhythmus) return null;
  const pakete = texte(o.pakete);
  return { id: i, titel, rhythmus, dauerMin: n(o.dauerMin) ?? 0, agenda: texte(o.agenda), teilnehmende: texte(o.teilnehmende).filter((x): x is (typeof TEILNEHMENDE)[number] => (TEILNEHMENDE as readonly string[]).includes(x)), geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '', ...(pakete.length ? { pakete } : {}) };
};
export function einstellungenAus(v: unknown): FulfillmentEinstellungen {
  const o = obj(v) ?? {};
  const kl = obj(o.kundenLink) ?? {};
  const nach = Array.isArray(o.nachsorgeTage) ? o.nachsorgeTage.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0) : null;
  const schwelle = n(o.pulsSchwelle), stunden = n(o.willkommenStunden);
  return {
    kundenLink: sauber({ an: kl.an === true, am: s(kl.am), von: s(kl.von) }),
    pulsSchwelle: schwelle !== undefined && schwelle >= 0 && schwelle <= 10 ? schwelle : EINSTELLUNGEN_VORGABE.pulsSchwelle,
    willkommenStunden: stunden !== undefined && stunden > 0 ? stunden : EINSTELLUNGEN_VORGABE.willkommenStunden,
    nachsorgeTage: nach && nach.length ? nach : [...EINSTELLUNGEN_VORGABE.nachsorgeTage],
  };
}
const importLauf = (o: O): ImportLauf | null => {
  const i = id(o.id), am = s(o.am);
  if (!i || !am) return null;
  const geaendert = liste(o.geaendert, g => {
    const gi = id(g.id); const vo = obj(g.vorher);
    if (!gi || !vo) return null;
    const vorher = gi.startsWith('fp-') ? vorlageAus(vo) : bausteinAus(vo);
    return vorher ? { id: gi, vorher } : null;
  });
  return { id: i, am, von: s(o.von) ?? '', datei: s(o.datei) ?? '', neu: ids(o.neu), geaendert };
};

export const leerVorlagen = (): VorlagenDatei => ({
  version: FULFILLMENT_VERSION, prozesse: [], bausteine: [], rituale: [], zuordnung: {}, agentZusatz: {},
  einstellungen: { ...EINSTELLUNGEN_VORGABE, kundenLink: { an: false }, nachsorgeTage: [...EINSTELLUNGEN_VORGABE.nachsorgeTage] }, importLaeufe: [], marken: {},
});
export function vorlagenAus(roh: unknown): VorlagenDatei {
  const o = obj(roh);
  if (!o) return leerVorlagen();
  const zuordnung: VorlagenDatei['zuordnung'] = {};
  for (const [k, w] of Object.entries(obj(o.zuordnung) ?? {})) { const v = id(obj(w)?.vorlageId); if (ID.test(k) && v) zuordnung[k] = { vorlageId: v }; }
  const agentZusatz: VorlagenDatei['agentZusatz'] = {};
  for (const [k, w] of Object.entries(obj(o.agentZusatz) ?? {})) { const a = wahl(k, ANALYSE_AGENTEN); if (a && typeof w === 'string') agentZusatz[a] = w; }
  // „Siehe auch“ (17.10. spät): nur Verweise auf Bausteine, die es (noch) gibt — gelöschte fallen beim Lesen weg (nichts wird gespeichert).
  const bausteine = liste(o.bausteine, bausteinAus);
  const da = new Set(bausteine.map(b => b.id));
  const mitVerweisen = bausteine.map(b => {
    if (!b.sieheAuch || b.sieheAuch.every(x => da.has(x))) return b;
    const l = b.sieheAuch.filter(x => da.has(x));
    if (l.length) return { ...b, sieheAuch: l };
    const { sieheAuch: _s, ...rest } = b;
    return rest;
  });
  return {
    version: n(o.version) ?? FULFILLMENT_VERSION,
    prozesse: liste(o.prozesse, vorlageAus), bausteine: mitVerweisen, rituale: liste(o.rituale, ritual),
    zuordnung, agentZusatz, einstellungen: einstellungenAus(o.einstellungen), importLaeufe: liste(o.importLaeufe, importLauf), marken: textMap(o.marken),
    ...entwuerfeAus(o.entwuerfe),
  };
}
/** Entwürfe der Werkstatt (22.10., E2): nur Paket-Fassungen mit derselben Kennung wie ihr Schlüssel; ohne Entwurf fehlt das Feld ganz (bit-gleich wie vorher). */
function entwuerfeAus(v: unknown): Pick<VorlagenDatei, 'entwuerfe'> {
  const raus: NonNullable<VorlagenDatei['entwuerfe']> = {};
  for (const [k, w] of Object.entries(obj(v) ?? {})) {
    const e = obj(w); const vorlage = e && obj(e.vorlage) ? vorlageAus(e.vorlage as O) : null;
    const basisFassung = n(e?.basisFassung), basisStand = s(e?.basisStand), am = s(e?.am);
    if (!ID.test(k) || !vorlage || vorlage.art !== 'paket' || vorlage.id !== k || basisFassung === undefined || !basisStand || !am) continue;
    raus[k] = { vorlage, basisFassung, basisStand, am, von: s(e?.von) ?? '' };
  }
  return Object.keys(raus).length ? { entwuerfe: raus } : {};
}

// ── Fälle `fulfillment-faelle--<h>` ───────────────────────────────────────────────────────────────────────────────────────────────────

const KNOTEN_STATUS = ['offen', 'in_arbeit', 'wartet_kunde', 'erledigt', 'entfaellt'] as const;
const fallKnoten = (o: O): FallKnoten | null => {
  const i = id(o.id), titel = s(o.titel), status = wahl(o.status, KNOTEN_STATUS);
  if (!i || !titel || !status) return null;
  return sauber<FallKnoten>({
    id: i, elternId: id(o.elternId), titel, rang: n(o.rang) ?? 0, ziel: s(o.ziel), ergebnis: s(o.ergebnis), kennzahl: s(o.kennzahl),
    zustaendig: wahl(o.zustaendig, ZUSTAENDIG), freigabe: id(o.freigabe), kundeSichtbar: b(o.kundeSichtbar), phaseId: s(o.phaseId), bausteinId: id(o.bausteinId), dauerTage: n(o.dauerTage),
    status, seit: s(o.seit), faelligAm: s(o.faelligAm), erledigtAm: s(o.erledigtAm), erledigtVon: s(o.erledigtVon), grund: s(o.grund), extra: o.extra === true ? true : undefined,
    form: wahl(o.form, KNOTEN_FORMEN), frist: frist(o.frist), zweige: zweige(o.zweige), versuche: versuche(o.versuche),
    // Ausführung (17.10. abends) — Antwort, Runden, Eskalation (ohne Feld wie bisher).
    antwort: wahl(o.antwort, ['ja', 'nein'] as const), antwortAm: s(o.antwortAm), runden: runden(o.runden), eskaliertAm: s(o.eskaliertAm),
    // Zusatzmodul (17.10. spät) — an Phasen: die Vorlage des Abschnitts.
    zusatz: id(o.zusatz),
  });
};
const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Ein angehängtes Zusatzmodul (17.10. spät) — ohne Vorlage, Wurzel oder Starttag fällt es weg. */
const fallZusatz = (o: O): FallZusatz | null => {
  const vorlageId = id(o.vorlageId), wurzelId = id(o.wurzelId), startAm = s(o.startAm), angehaengtAm = s(o.angehaengtAm);
  if (!vorlageId || !wurzelId || !startAm || !TAG.test(startAm) || !angehaengtAm) return null;
  return { vorlageId, vorlageFassung: n(o.vorlageFassung) ?? 1, wurzelId, titel: s(o.titel) ?? 'Zusatzmodul', startAm, angehaengtAm, angehaengtVon: s(o.angehaengtVon) ?? '' };
};
const vereinbarung = (v: unknown): Vereinbarung | undefined => {
  const o = obj(v);
  if (!o) return undefined;
  return sauber<Vereinbarung>({
    rollen: s(o.rollen), reaktionszeiten: s(o.reaktionszeiten), wirBrauchen: s(o.wirBrauchen), eskalation: s(o.eskalation), scopeDrin: s(o.scopeDrin),
    scopeDraussen: s(o.scopeDraussen), entscheidungsrechte: s(o.entscheidungsrechte), bestaetigtAm: s(o.bestaetigtAm), bestaetigtWie: wahl(o.bestaetigtWie, ['kickoff', 'mail', 'termin'] as const),
  });
};
const stakeholder = (o: O): Stakeholder | null => {
  const i = id(o.id), kontaktId = s(o.kontaktId), rolle = wahl(o.rolle, ['entscheider', 'unterstuetzer', 'skeptiker', 'nutzer', 'einkauf', 'sponsor'] as const);
  const einfluss = o.einfluss === 1 || o.einfluss === 2 || o.einfluss === 3 ? o.einfluss : undefined;
  if (!i || !kontaktId || !rolle || !einfluss) return null;
  return sauber<Stakeholder>({ id: i, kontaktId, rolle, einfluss, haltung: wahl(o.haltung, ['positiv', 'neutral', 'kritisch'] as const), notiz: s(o.notiz) });
};
const entscheidung = (o: O): Entscheidung | null => {
  const i = id(o.id), am = s(o.am), titel = s(o.titel), status = wahl(o.status, ['offen', 'entschieden', 'verworfen'] as const);
  if (!i || !am || !titel || !status) return null;
  return sauber<Entscheidung>({ id: i, am, titel, inhalt: s(o.inhalt), status, wer: wahl(o.wer, ZUSTAENDIG) ?? 'intern', frist: s(o.frist), geteilt: o.geteilt === true, von: s(o.von) ?? '' });
};
const mitschrift = (o: O): Mitschrift | null => {
  const i = id(o.id), am = s(o.am);
  if (!i || !am) return null;
  return sauber<Mitschrift>({ id: i, ritualId: id(o.ritualId), am, anlass: s(o.anlass) ?? '', ergebnis: s(o.ergebnis) ?? '', naechster: s(o.naechster) ?? '', frist: s(o.frist), von: s(o.von) ?? '' });
};
const wertEintrag = (v: unknown): WertKontoEintrag | null => {
  const o = obj(v);
  if (!o) return null;
  const messungen = liste(o.messungen, m => { const am = s(m.am), wert = n(m.wert), quelle = wahl(m.quelle, ['hand', 'kunde'] as const); return am && wert !== undefined && quelle ? { am, wert, quelle } : null; });
  return sauber<WertKontoEintrag>({
    ausgang: s(o.ausgang), ausgangZahl: n(o.ausgangZahl), zielZahl: n(o.zielZahl), einheit: s(o.einheit), richtung: wahl(o.richtung, ['hoch', 'runter'] as const),
    zielBis: s(o.zielBis), festgelegtAm: s(o.festgelegtAm), messungen,
  });
};
export function fallAus(o: O): Fall | null {
  const mandatId = id(o.mandatId), vorlageId = id(o.vorlageId), gestartetAm = s(o.gestartetAm), status = wahl(o.status, ['onboarding', 'laeuft', 'pausiert', 'abgeschlossen'] as const);
  if (!mandatId || !vorlageId || !gestartetAm || !status) return null;
  const freigaben: Fall['freigaben'] = {};
  for (const [k, w] of Object.entries(obj(o.freigaben) ?? {})) {
    const f = obj(w); const am = s(f?.am);
    if (!ID.test(k) || !f || !am) continue;
    const ku = obj(f.kunde); const wie = wahl(ku?.wie, ['kickoff', 'mail', 'link', 'termin'] as const); const kam = s(ku?.am);
    freigaben[k] = sauber({ am, von: s(f.von) ?? '', kunde: wie && kam ? { wie, am: kam } : undefined, notiz: s(f.notiz) });
  }
  const ob = obj(o.onboarding) ?? {};
  const wertKonto: Fall['wertKonto'] = {};
  for (const [k, w] of Object.entries(obj(o.wertKonto) ?? {})) { const e = wertEintrag(w); if (ID.test(k) && e) wertKonto[k] = e; }
  const wirkung = (() => {
    const w = obj(o.wirkung); const erstelltAm = s(w?.erstelltAm);
    if (!w || !erstelltAm) return undefined;
    const z = obj(w.zitat); const text = s(z?.text), einw = s(z?.einwilligungAm), wie = s(z?.wie);
    return sauber<NonNullable<Fall['wirkung']>>({ erstelltAm, dateiName: s(w.dateiName), zitat: text && einw && wie ? { text, einwilligungAm: einw, wie } : undefined });
  })();
  return sauber<Fall>({
    mandatId, vorlageId, vorlageFassung: n(o.vorlageFassung) ?? 1, gestartetAm, gestartetVon: s(o.gestartetVon) ?? '', status,
    startAm: (() => { const t = s(o.startAm); return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined; })(),
    // Phasen nach der EINEN Regel (12.10., ./prozesse/phasen.ts): hohle Dach-Phasen („Strategie“, „Steuerung“) mit der passenden Phase
    // zusammengelegt — nur beim Lesen; der nächste Schreibvorgang speichert es. Hatte die Vorlage ihre Phasen von Hand geordnet, bleibt die Reihenfolge.
    knoten: o.phasenVonHand === true ? liste(o.knoten, fallKnoten) : phasenOrdnen(liste(o.knoten, fallKnoten), { hohl: hohlerFallKnoten }), freigaben,
    onboarding: sauber({ willkommenGesendetAm: s(ob.willkommenGesendetAm), willkommenVon: s(ob.willkommenVon), kickoffAm: s(ob.kickoffAm), kickoffVon: s(ob.kickoffVon) }),
    vereinbarung: vereinbarung(o.vereinbarung), stakeholder: liste(o.stakeholder, stakeholder), entscheidungen: liste(o.entscheidungen, entscheidung),
    rituale: liste(o.rituale, r => { const ri = id(r.ritualId), am = s(r.angelegtAm); return ri && am ? { ritualId: ri, terminUids: texte(r.terminUids), angelegtAm: am } : null; }),
    mitschriften: liste(o.mitschriften, mitschrift),
    quickWins: liste(o.quickWins, q => { const qi = id(q.id), text = s(q.text), bis = s(q.bis), quelle = wahl(q.quelle, ['analyse', 'hand'] as const); return qi && text && bis && quelle ? sauber({ id: qi, text, bis, erledigtAm: s(q.erledigtAm), quelle }) : null; }),
    kickoffFragen: liste(o.kickoffFragen, q => {
      const qi = id(q.id), f = s(q.frage), an = wahl(q.an, ['gruender', 'entscheider', 'vertrieb'] as const), quelle = wahl(q.quelle, ['analyse', 'hand'] as const);
      return qi && f && an && quelle ? sauber({ id: qi, frage: f, an, warum: s(q.warum), quelle, erledigt: q.erledigt === true ? true as const : undefined }) : null;
    }),
    wertKonto,
    befaehigung: liste(o.befaehigung, x => { const xi = id(x.id), text = s(x.text); return xi && text ? sauber({ id: xi, text, erfuellt: x.erfuellt === true, am: s(x.am) }) : null; }),
    wirkung, marken: textMap(o.marken), geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '',
    phasenVonHand: o.phasenVonHand === true ? true : undefined,
    zusaetze: (() => { const z = liste(o.zusaetze, fallZusatz).filter((x, i, l) => l.findIndex(y => y.vorlageId === x.vorlageId) === i); return z.length ? z : undefined; })(),
    ohneOnboarding: o.ohneOnboarding === true ? true : undefined,
  });
}
export const leerFaelle = (): FaelleDatei => ({ version: FULFILLMENT_VERSION, faelle: {} });
export function faelleAus(roh: unknown): FaelleDatei {
  const o = obj(roh);
  if (!o) return leerFaelle();
  const faelle: FaelleDatei['faelle'] = {};
  for (const [k, w] of Object.entries(obj(o.faelle) ?? {})) { const f = obj(w) ? fallAus(w as O) : null; if (f && f.mandatId === k) faelle[k] = f; }
  return { version: n(o.version) ?? FULFILLMENT_VERSION, faelle };
}

// ── Kunde `fulfillment-kunde--<h>` ────────────────────────────────────────────────────────────────────────────────────────────────────

const kundenLink = (o: O): KundenLink | null => {
  const i = s(o.id), mandatId = id(o.mandatId), tokenHash = s(o.tokenHash), erstelltAm = s(o.erstelltAm), ablaufAm = s(o.ablaufAm), status = wahl(o.status, ['aktiv', 'widerrufen', 'abgelaufen'] as const);
  if (!i || !/^kl-[a-f0-9]{24}$/.test(i) || !mandatId || !tokenHash || !/^[a-f0-9]{64}$/.test(tokenHash) || !erstelltAm || !ablaufAm || !status) return null;
  const r = obj(o.rechte) ?? {};
  return sauber<KundenLink>({ id: i, mandatId, tokenHash, erstelltAm, erstelltVon: s(o.erstelltVon) ?? '', ablaufAm, status, rechte: { formular: r.formular === true, upload: r.upload === true, puls: r.puls === true }, zuletztAm: s(o.zuletztAm), hinweisFassung: s(o.hinweisFassung) ?? '' });
};
const formularStand = (o: O): FormularStand | null => {
  const mandatId = id(o.mandatId), bausteinId = id(o.bausteinId), geaendertAm = s(o.geaendertAm), quelle = wahl(o.quelle, ['kunde', 'intern'] as const);
  if (!mandatId || !bausteinId || !geaendertAm || !quelle) return null;
  return { mandatId, bausteinId, fassung: n(o.fassung) ?? 1, antworten: textMap(o.antworten), fertig: ids(o.fertig), geaendertAm, quelle };
};
const pulsAnfrage = (o: O): PulsAnfrage | null => {
  const i = id(o.id), mandatId = id(o.mandatId), tokenHash = s(o.tokenHash), erstelltAm = s(o.erstelltAm), offenBis = s(o.offenBis);
  if (!i || !mandatId || !tokenHash || !/^[a-f0-9]{64}$/.test(tokenHash) || !erstelltAm || !offenBis) return null;
  return sauber<PulsAnfrage>({ id: i, mandatId, tokenHash, erstelltAm, offenBis, beantwortetAm: s(o.beantwortetAm) });
};
const puls = (o: O): Puls | null => {
  const i = id(o.id), mandatId = id(o.mandatId), am = s(o.am), wert = n(o.wert), quelle = wahl(o.quelle, ['link', 'hand'] as const);
  if (!i || !mandatId || !am || wert === undefined || wert < 0 || wert > 10 || !quelle) return null;
  return sauber<Puls>({ id: i, mandatId, am, wert, satz: s(o.satz), anfrageId: id(o.anfrageId), quelle });
};
const unterlage = (o: O): Unterlage | null => {
  const i = id(o.id), mandatId = id(o.mandatId), name = s(o.name), typ = s(o.typ), am = s(o.am), herkunftK = wahl(o.herkunft, ['kunde', 'intern'] as const);
  const zweck = wahl(o.zweck, ['register', 'playbook', 'notiz', 'sonstig'] as const), status = wahl(o.status, ['ungeprueft', 'freigegeben', 'gesperrt'] as const);
  if (!i || !mandatId || !name || !typ || !am || !herkunftK || !zweck || !status) return null;
  return sauber<Unterlage>({ id: i, mandatId, name, typ, groesse: n(o.groesse) ?? 0, am, herkunft: herkunftK, linkId: s(o.linkId), von: s(o.von), zweck, status, beleg: o.beleg === true ? true : undefined });
};
export const leerKunde = (): KundeDatei => ({ version: FULFILLMENT_VERSION, links: [], formulare: [], pulsAnfragen: [], puls: [], unterlagen: [] });
export function kundeAus(roh: unknown): KundeDatei {
  const o = obj(roh);
  if (!o) return leerKunde();
  return {
    version: n(o.version) ?? FULFILLMENT_VERSION, links: liste(o.links, kundenLink), formulare: liste(o.formulare, formularStand),
    pulsAnfragen: liste(o.pulsAnfragen, pulsAnfrage), puls: liste(o.puls, puls), unterlagen: liste(o.unterlagen, unterlage),
  };
}

// ── Dossiers `fulfillment-dossiers--<h>` und Personen `fulfillment-personen--<h>` ─────────────────────────────────────────────────────

const quelle = (o: O): Quelle | null => {
  const i = id(o.id), abgerufenAm = s(o.abgerufenAm);
  if (!i || !abgerufenAm) return null;
  const url = s(o.url);
  return sauber<Quelle>({ id: i, url: url && /^https?:\/\//i.test(url) ? url : undefined, unterlageId: id(o.unterlageId), titel: s(o.titel), domain: s(o.domain), abgerufenAm });
};
const aussage = (o: O): Aussage | null => {
  const i = id(o.id), text = s(o.text), art = wahl(o.art, ['fakt', 'schaetzung', 'hypothese'] as const), stand = s(o.stand);
  const agent = o.agent === 'hand' ? 'hand' as const : wahl(o.agent, ANALYSE_AGENTEN);
  if (!i || !text || !art || !stand || !agent) return null;
  return sauber<Aussage>({ id: i, text, art, quellen: ids(o.quellen), stand, agent, personRef: id(o.personRef), veraltet: o.veraltet === true ? true : undefined, gekuerzt: o.gekuerzt === true ? true : undefined });
};
const abschnitt = (aid: AbschnittId, v: unknown): Abschnitt | null => {
  const o = obj(v);
  if (!o) return null;
  const status = wahl(o.status, ['leer', 'entwurf', 'geprueft'] as const) ?? 'leer';
  const t = obj(o.tabelle);
  const tabelle = t ? { spalten: texte(t.spalten), zeilen: liste(t.zeilen, z => ({ werte: texte(z.werte), quellen: ids(z.quellen) })) } : undefined;
  return sauber<Abschnitt>({ id: aid, aussagen: liste(o.aussagen, aussage), tabelle, status, stand: s(o.stand) });
};
const lauf = (o: O): AnalyseLauf | null => {
  const i = id(o.id), agent = wahl(o.agent, ANALYSE_AGENTEN), status = wahl(o.status, LAUF_STATUS);
  if (!i || !agent || !status) return null;
  return sauber<AnalyseLauf>({
    id: i, agent, status, schaetzungCent: n(o.schaetzungCent) ?? 0, bestaetigtCent: n(o.bestaetigtCent) ?? 0, grenzeCent: n(o.grenzeCent) ?? 0, kostenCent: n(o.kostenCent),
    gestartetAm: s(o.gestartetAm), gestartetVon: s(o.gestartetVon), laeuftSeit: s(o.laeuftSeit), fertigAm: s(o.fertigAm), fehler: s(o.fehler), grund: s(o.grund),
    ergebnis: o.ergebnis === undefined ? undefined : o.ergebnis, versuch: n(o.versuch) ?? 0,
    // Erfundenes Beispiel der Demo-Instanz (15.10., lib/demo/beispiel.ts) — nur die Marke, sonst nichts.
    beispiel: o.beispiel === true ? true : undefined,
  });
};
const massnahme = (o: O): Massnahme | null => {
  const i = id(o.id), text = s(o.text), hebel = wahl(o.hebel, ['zufluss', 'umwandlung', 'zyklus', 'dealwert', 'bindung'] as const);
  const aufwand = wahl(o.aufwand, ['klein', 'mittel', 'gross'] as const), evidenz = wahl(o.evidenz, ['A', 'B', 'C'] as const);
  if (!i || !text || !hebel || !aufwand || !evidenz) return null;
  return sauber<Massnahme>({ id: i, text, hebel, wirkung: s(o.wirkung) ?? '', aufwand, evidenz, abhaengig: s(o.abhaengig) });
};
const AN = ['gruender', 'entscheider', 'vertrieb'] as const;
export function dossierAus(o: O): Dossier | null {
  const mandatId = id(o.mandatId);
  const e = obj(o.eingaben);
  const firma = s(e?.firma);
  if (!mandatId || !e || !firma) return null;
  const abschnitte: Dossier['abschnitte'] = {};
  for (const [k, w] of Object.entries(obj(o.abschnitte) ?? {})) { const aid = wahl(k, ABSCHNITT_IDS); const a = aid ? abschnitt(aid, w) : null; if (aid && a) abschnitte[aid] = a; }
  const f1 = (() => { const f = obj(o.f1); const am = s(f?.am); if (!f || !am) return undefined; return sauber<NonNullable<Dossier['f1']>>({ am, von: s(f.von) ?? '', umfang: texte(f.umfang).filter((x): x is AnalyseAgentId => (ANALYSE_AGENTEN as readonly string[]).includes(x)), funktionen: texte(f.funktionen), kundeBestaetigtAm: s(f.kundeBestaetigtAm), wie: wahl(f.wie, ['kickoff', 'mail'] as const) }); })();
  const ia = (() => { const x = obj(o.interessenabwaegung); const am = s(x?.am); if (!x || !am) return undefined; return { zweck: s(x.zweck) ?? '', erforderlichkeit: s(x.erforderlichkeit) ?? '', abwaegung: s(x.abwaegung) ?? '', schutz: s(x.schutz) ?? '', am, von: s(x.von) ?? '' }; })();
  const pruefung = (() => {
    const p = obj(o.pruefung); const am = s(p?.am);
    if (!p || !am) return undefined;
    const befunde = liste(p.befunde, x => {
      const art = wahl(x.art, ['dsgvo', 'quelle', 'qualitaet'] as const), text = s(x.text);
      if (!art || !text) return null;
      const u = obj(x.ueberstimmt); const uv = s(u?.von), ug = s(u?.grund);
      return sauber<NonNullable<Dossier['pruefung']>['befunde'][number]>({ art, text, bezug: s(x.bezug), ueberstimmt: uv && ug ? { von: uv, grund: ug } : undefined });
    });
    return { am, bestanden: p.bestanden === true, befunde };
  })();
  const f2 = (() => { const f = obj(o.f2); const am = s(f?.am); return f && am ? { am, von: s(f.von) ?? '' } : undefined; })();
  const leseteil = (() => { const l = obj(o.leseteil); const li = id(l?.id), person = s(l?.person), am = s(l?.gestartetAm); return li && person && am ? { id: li, person, gestartetAm: am } : undefined; })();
  const diagnose = (() => {
    const d = obj(o.diagnose);
    if (!d) return undefined;
    return {
      top5: liste(d.top5, massnahme), quickWins: texte(d.quickWins),
      fragen: liste(d.fragen, f => { const fr = s(f.frage), an = wahl(f.an, AN); return fr && an ? { frage: fr, an, warum: s(f.warum) ?? '' } : null; }),
    };
  })();
  const pg = liste(o.personenGeloescht, x => { const am = s(x.am), anz = n(x.anzahl); return am && anz !== undefined ? { am, anzahl: anz } : null; });
  return sauber<Dossier>({
    mandatId, firmaId: s(o.firmaId), version: n(o.version) ?? 1,
    eingaben: sauber({ firma, domains: texte(e.domains), registerNr: s(e.registerNr), sitz: s(e.sitz), branche: s(e.branche), urls: texte(e.urls).filter(u => /^https?:\/\//i.test(u)) }),
    f1, interessenabwaegung: ia, abschnitte, quellen: liste(o.quellen, quelle), laeufe: liste(o.laeufe, lauf), pruefung, f2, leseteil, diagnose,
    personenGeloescht: pg.length ? pg : undefined, geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '',
    beispiel: o.beispiel === true ? true : undefined,
  });
}
export const leerDossiers = (): DossierDatei => ({ version: FULFILLMENT_VERSION, dossiers: {} });
export function dossiersAus(roh: unknown): DossierDatei {
  const o = obj(roh);
  if (!o) return leerDossiers();
  const dossiers: DossierDatei['dossiers'] = {};
  for (const [k, w] of Object.entries(obj(o.dossiers) ?? {})) { const d = obj(w) ? dossierAus(w as O) : null; if (d && d.mandatId === k) dossiers[k] = d; }
  return { version: n(o.version) ?? FULFILLMENT_VERSION, dossiers };
}

const karte = (o: O): PersonenKarte | null => {
  const i = id(o.id), mandatId = id(o.mandatId), funktion = s(o.funktion), name = s(o.name), erfasstAm = s(o.erfasstAm);
  const identitaet = wahl(o.identitaet, ['hoch', 'mittel', 'niedrig'] as const), status = wahl(o.status, ['entwurf', 'geprueft'] as const);
  const a = obj(o.art14); const faellig = s(a?.faelligAm);
  if (!i || !mandatId || !funktion || !name || !erfasstAm || !identitaet || !status || !a || !faellig) return null;
  return sauber<PersonenKarte>({
    id: i, mandatId, funktion, name, kontaktId: s(o.kontaktId), rolleSeit: s(o.rolleSeit),
    werdegang: liste(o.werdegang, aussage), themen: liste(o.themen, aussage), auftritte: liste(o.auftritte, aussage), aufhaenger: liste(o.aufhaenger, aussage),
    identitaet, ausgelassen: texte(o.ausgelassen), quellen: liste(o.quellen, quelle),
    art14: sauber({ faelligAm: faellig, gegebenAm: s(a.gegebenAm), wie: wahl(a.wie, ['kickoff', 'mail', 'erster-kontakt'] as const), von: s(a.von) }),
    erfasstAm, loeschAm: s(o.loeschAm), status,
  });
};
export const leerPersonen = (): PersonenDatei => ({ version: FULFILLMENT_VERSION, karten: [] });
export function personenAus(roh: unknown): PersonenDatei {
  const o = obj(roh);
  if (!o) return leerPersonen();
  return { version: n(o.version) ?? FULFILLMENT_VERSION, karten: liste(o.karten, karte) };
}

// ── Eine Stelle je Art (für lib/fulfillment/speicher.ts) ──────────────────────────────────────────────────────────────────────────────
export const SAEUBERER: { [A in FulfillmentArt]: (roh: unknown) => FulfillmentDateien[A] } = {
  vorlagen: vorlagenAus, faelle: faelleAus, kunde: kundeAus, dossiers: dossiersAus, personen: personenAus,
};
export const LEER: { [A in FulfillmentArt]: () => FulfillmentDateien[A] } = {
  vorlagen: leerVorlagen, faelle: leerFaelle, kunde: leerKunde, dossiers: leerDossiers, personen: leerPersonen,
};
