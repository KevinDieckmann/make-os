// ─── Prozesse — Säuberer der Bestände und die reinen Schreibregeln der Werkstatt (Etappe B1, 21.10.; ANALYSE_100.md Punkte 6, 10, 43, 62, 68) ──────
// Bestand `prozesse--<haushalt>` (`ProzesseDatei`): je Prozess Entwurf, Versionen, Status. Gelesen wird JEDE Datei über `prozesseAus` (robust: Unlesbares
// fällt weg, nie ein Absturz, nie eine erfundene Angabe, Listen nie gekürzt; neue Felder hier nur als FORM gesäubert — ob sie zum Fall passen, sagt die
// Prüfung, damit beim Lesen nichts verloren geht). Geschrieben nur über `werkstattAnwenden` (alles oder nichts, Stand/409, Grenzen 413, Rechte 403)
// im Schreibweg lib/prozesse/werkstatt-server.ts. Der Entwurf bekommt bei JEDEM Speichern seine Freigabe-Schlösser (lib/prozesse/schloss.ts).
// Rein und client-sicher; Tests: tests/prozesse-modell.test.ts, tests/prozesse-versionen.test.ts.

import {
  AUSLOESER_ARTEN, BAHNEN, BEDINGUNG_OPS, BEREICH_IDS, CRM_ABFRAGE_ARTEN, EINGANG_KENNUNG, FALL_ART_IDS, FELD_KENNUNG, KENNUNG_ARTEN, KNOTEN_KENNUNG,
  LOOP_ARTEN, PROZESS_FORMEN, PROZESS_GRENZEN, PROZESS_KENNUNG, PROZESS_STATUS, PROZESS_TEXT, SCORE_PRUEFUNGEN, TEMPERATUREN, VORSCHLAG_ZIELFELDER,
  WEBHOOK_FELD_ARTEN, WEBHOOK_KENNUNG, ZETTEL_FARBEN,
  type AgentSchritt, type Ausloeser, type Bedingung, type Befund, type CrmAbfrage, type EndeAngabe, type ErneutAb, type KatalogBezug, type KnotenLage,
  type MaskenWert, type ModellWahl, type NotizZettel, type PfeilText, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten,
  type ProzessSchnittstelle, type ProzessStatus, type ProzessVersion, type ProzesseDatei, type RautenRegel, type SchleifeRegel, type SchlossMarke,
  type TeilprozessAufruf, type VertragFeld, type WartenRegel, type WebhookDatei, type WebhookEingang, type WebhookEintrag, type WebhookFeld, type Zweige,
} from './definition';
import { definitionPruefen, aktivBefunde, laufFremd, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from './definition-pruefen';
import { schlossSetzen } from './schloss';
import { veroeffentlichen, versionAlsEntwurf } from './versionen';
import { oeffentlichModus, vertragAus } from './agent-schritt';
import type { ProzessRechte } from './rollen';

type O = Record<string, unknown>;
type K = ProzessKnoten<ProzessForm>;

// ── Werkzeug ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);
const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bo = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const wahl = <T extends string>(v: unknown, l: readonly T[]): T | undefined => (typeof v === 'string' && (l as readonly string[]).includes(v) ? (v as T) : undefined);
const texte = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const liste = <T>(v: unknown, f: (x: O) => T | null): T[] => (Array.isArray(v) ? v.map(x => { const o = obj(x); return o ? f(o) : null; }).filter((x): x is T => x !== null) : []);
const ID = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const id = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);
const sauber = <T>(o: Record<string, unknown>): T => Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined)) as T;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TEAM_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

// ── Felder der Knoten (nur FORM — die Prüfung sagt, ob sie passen) ───────────────────────────────────────────────────────────────────────────────

const lage = (v: unknown): KnotenLage | undefined => {
  const o = obj(v); const x = n(o?.x), y = n(o?.y);
  if (!o || x === undefined || y === undefined || Math.abs(x) > 200_000 || Math.abs(y) > 200_000) return undefined;
  const m = (w: unknown) => { const z = n(w); return z !== undefined && z >= 160 && z <= 40_000 ? z : undefined; };
  return sauber<KnotenLage>({ x, y, b: m(o.b), h: m(o.h) });
};
const zweige = (v: unknown): Zweige | undefined => {
  const o = obj(v); if (!o) return undefined;
  const z = sauber<Zweige>({ ja: id(o.ja), nein: id(o.nein), fehler: id(o.fehler), abgelaufen: id(o.abgelaufen) });
  return Object.keys(z).length ? z : undefined;
};
const pfeilText = (v: unknown): PfeilText | undefined => {
  const o = obj(v); if (!o) return undefined;
  const t = sauber<PfeilText>({ weiter: s(o.weiter), ja: s(o.ja), nein: s(o.nein), fehler: s(o.fehler), abgelaufen: s(o.abgelaufen) });
  return Object.keys(t).length ? t : undefined;
};
const bedingung = (o: O): Bedingung | null => {
  const feld = typeof o.feld === 'string' && FELD_KENNUNG.test(o.feld) ? o.feld : undefined, op = wahl(o.op, BEDINGUNG_OPS);
  if (!feld || !op) return null;
  const w = o.wert;
  const wert = typeof w === 'string' || typeof w === 'boolean' || (typeof w === 'number' && Number.isFinite(w)) ? w : Array.isArray(w) ? texte(w) : undefined;
  return sauber<Bedingung>({ feld, op, wert });
};
const bedingungen = (v: unknown): Bedingung[] | undefined => { const l = liste(v, bedingung); return l.length ? l : undefined; };
const verkn = (v: unknown) => (v === 'oder' || v === 'und' ? v : undefined);
const webhookFeld = (o: O): WebhookFeld | null => {
  const fid = typeof o.id === 'string' && FELD_KENNUNG.test(o.id) ? o.id : undefined, art = wahl(o.art, WEBHOOK_FELD_ARTEN);
  if (!fid || !art) return null;
  const opt = texte(o.optionen);
  return sauber<WebhookFeld>({ id: fid, art, pflicht: o.pflicht === true ? true : undefined, optionen: opt.length ? opt : undefined, max: n(o.max) });
};
const vertragFeld = (o: O): VertragFeld | null => {
  const fid = typeof o.id === 'string' && FELD_KENNUNG.test(o.id) ? o.id : undefined, art = wahl(o.art, ['kennung', 'zahl', 'datum', 'ja-nein', 'auswahl'] as const);
  if (!fid || !art) return null;
  const opt = texte(o.optionen);
  return sauber<VertragFeld>({ id: fid, art, kennung: wahl(o.kennung, KENNUNG_ARTEN), optionen: opt.length ? opt : undefined, pflicht: o.pflicht === true ? true : undefined, liste: o.liste === true ? true : undefined });
};
const modellWahl = (v: unknown): ModellWahl | undefined => {
  const o = obj(v); const anbieter = s(o?.anbieter), modell = s(o?.modell), stufe = wahl(o?.stufe, ['schnell', 'ausgewogen', 'stark'] as const);
  return o && anbieter && modell && stufe ? { anbieter: anbieter as ModellWahl['anbieter'], modell, stufe } : undefined;
};
const ausloeser = (v: unknown): Ausloeser | undefined => {
  const o = obj(v); const art = wahl(o?.art, AUSLOESER_ARTEN);
  if (!o || !art) return undefined;
  switch (art) {
    case 'hand': return { art };
    case 'ereignis': { const e = s(o.ereignis); return e ? sauber<Ausloeser>({ art, ereignis: e, bedingungen: bedingungen(o.bedingungen), verknuepfung: verkn(o.verknuepfung) }) : undefined; }
    case 'zeitplan': { const r = s(o.rhythmus), u = s(o.uhrzeit); const t = Array.isArray(o.tage) ? o.tage.filter((x): x is number => Number.isInteger(x)) : []; return r && u ? sauber<Ausloeser>({ art, rhythmus: r, uhrzeit: u, tage: t.length ? t : undefined }) : undefined; }
    // 22.10. (Datums-Start): „nur wenn …“ über die Felder des Falls — optional, ohne wie bisher.
    case 'datum': { const f = s(o.feld), vt = n(o.versatzTage); return f && vt !== undefined ? sauber<Ausloeser>({ art, feld: f, versatzTage: vt, werktage: o.werktage === true ? true : undefined, uhrzeit: s(o.uhrzeit), bedingungen: bedingungen(o.bedingungen), verknuepfung: verkn(o.verknuepfung) }) : undefined; }
    case 'webhook': return sauber<Ausloeser>({ art, felder: liste(o.felder, webhookFeld), bedingungen: bedingungen(o.bedingungen), verknuepfung: verkn(o.verknuepfung) });
    case 'loop': { const l = wahl(o.loop, LOOP_ARTEN); return l ? { art, loop: l } : undefined; }
  }
};
const agent = (v: unknown): AgentSchritt | undefined => {
  const o = obj(v); const w = obj(o?.wer);
  if (!o || !w) return undefined;
  const wer = w.art === 'zoe' ? { art: 'zoe' as const } : w.art === 'head' && s(w.headId) ? { art: 'head' as const, headId: w.headId as string }
    : w.art === 'skill' && s(w.skillId) ? { art: 'skill' as const, skillId: w.skillId as string } : w.art === 'fach' && s(w.agentId) ? { art: 'fach' as const, agentId: w.agentId as string } : null;
  if (!wer) return undefined;
  const g = obj(o.gedaechtnis) ?? {};
  const vf = texte(o.vorschlagFelder).filter(x => (VORSCHLAG_ZIELFELDER as readonly string[]).includes(x));
  // „Nur öffentliche Angaben“ (22.10. nachts) bleibt nur an Web-Recherche-Fach-Agenten stehen — dann sind Akte und Brain aus (wie der Motor es rechnet).
  const oeffentlich = o.nurOeffentlich === true && oeffentlichModus({ wer, nurOeffentlich: true });
  return sauber<AgentSchritt>({
    wer, auftrag: typeof o.auftrag === 'string' ? o.auftrag : '', modell: wahl(o.modell, ['schnell', 'ausgewogen', 'stark'] as const) ?? 'ausgewogen', modellWahl: modellWahl(o.modellWahl),
    budgetCent: n(o.budgetCent) ?? 0, gedaechtnis: oeffentlich ? { brain: false, akte: false } : { brain: g.brain === true, akte: g.akte !== false }, werkzeuge: texte(o.werkzeuge),
    eingabe: liste(o.eingabe, vertragFeld), ausgabe: liste(o.ausgabe, vertragFeld), warumKeineRegel: typeof o.warumKeineRegel === 'string' ? o.warumKeineRegel : '',
    ergebnis: wahl(o.ergebnis, ['daten', 'vorschlag'] as const), vorschlagFelder: vf.length ? vf : undefined, uebernahme: wahl(o.uebernahme, ['je-feld', 'sammel'] as const),
    nurOeffentlich: oeffentlich ? true : undefined,
  });
};
const raute = (v: unknown): RautenRegel | undefined => {
  const o = obj(v);
  if (o?.art === 'regel') return sauber<RautenRegel>({ art: 'regel', bedingungen: liste(o.bedingungen, bedingung), verknuepfung: verkn(o.verknuepfung) });
  if (o?.art === 'modell') return sauber<RautenRegel>({ art: 'modell', frage: typeof o.frage === 'string' ? o.frage : '', warumKeineRegel: typeof o.warumKeineRegel === 'string' ? o.warumKeineRegel : '', modell: wahl(o.modell, ['schnell', 'ausgewogen', 'stark'] as const) ?? 'ausgewogen', budgetCent: n(o.budgetCent) ?? 0, modellWahl: modellWahl(o.modellWahl) });
  if (o?.art === 'score') { const p = wahl(o.pruefung, SCORE_PRUEFUNGEN); const t = texte(o.temperatur).filter(x => (TEMPERATUREN as readonly string[]).includes(x)); return p ? sauber<RautenRegel>({ art: 'score', pruefung: p, schwelle: n(o.schwelle), temperatur: t.length ? t : undefined }) : undefined; }
  return undefined;
};
const warten = (v: unknown): WartenRegel | undefined => {
  const o = obj(v);
  // C1 (21.10., M1): `arbeitszeit` und `hoechstensStunden` (optional) — ohne sie wie bisher.
  if (o?.art === 'dauer') return sauber<WartenRegel>({ art: 'dauer', tage: n(o.tage) ?? 0, stunden: n(o.stunden), arbeitszeit: o.arbeitszeit === true ? true : undefined });
  if (o?.art === 'datum' && s(o.feld)) return sauber<WartenRegel>({ art: 'datum', feld: o.feld as string, versatzTage: n(o.versatzTage), hoechstensTage: n(o.hoechstensTage) ?? 0, werktage: o.werktage === true ? true : undefined });
  if (o?.art === 'ereignis' && s(o.ereignis)) return sauber<WartenRegel>({ art: 'ereignis', ereignis: o.ereignis as string, bedingungen: bedingungen(o.bedingungen), verknuepfung: verkn(o.verknuepfung), hoechstensTage: n(o.hoechstensTage) ?? 0, hoechstensStunden: n(o.hoechstensStunden), arbeitszeit: o.arbeitszeit === true ? true : undefined });
  return undefined;
};
const schleife = (v: unknown): SchleifeRegel | undefined => { const o = obj(v); const l = s(o?.liste), p = s(o?.prozessId); return o && l && p ? { liste: l, prozessId: p, hoechstens: n(o.hoechstens) ?? 0 } : undefined; };
const teilprozess = (v: unknown): TeilprozessAufruf | undefined => {
  const o = obj(v); const p = s(o?.prozessId);
  if (!o || !p) return undefined;
  const ein = Object.fromEntries(Object.entries(obj(o.eingaben) ?? {}).filter(([k, w]) => FELD_KENNUNG.test(k) && typeof w === 'string' && w.length <= 200)) as Record<string, string>;
  return sauber<TeilprozessAufruf>({ prozessId: p, eingaben: Object.keys(ein).length ? ein : undefined, warten: bo(o.warten) });
};
const ende = (v: unknown): EndeAngabe | undefined => { const o = obj(v); const e = wahl(o?.ergebnis, ['erfolg', 'abbruch', 'uebergabe'] as const); return e ? sauber<EndeAngabe>({ ergebnis: e, uebergabeAn: id(o?.uebergabeAn) }) : undefined; };
const schloss = (v: unknown): SchlossMarke | undefined => { const o = obj(v); const f = id(o?.fuer), g = wahl(o?.grund, ['aussen', 'geld', 'loeschen', 'dreieck'] as const); return f && g ? { fuer: f, grund: g } : undefined; };
const abfrage = (v: unknown): CrmAbfrage | undefined => {
  const o = obj(v); const art = wahl(o?.art, CRM_ABFRAGE_ARTEN);
  if (!o || !art) return undefined;
  const l = (x: unknown) => { const t = texte(x); return t.length ? t : undefined; };
  return sauber<CrmAbfrage>({ art, status: l(o.status), temperatur: l(o.temperatur), bean: l(o.bean), lifecycle: l(o.lifecycle), tage: n(o.tage), hoechstens: n(o.hoechstens) ?? 0 });
};
const erneut = (v: unknown): ErneutAb | undefined => { const o = obj(v); const a = id(o?.ab); return a ? { ab: a, hoechstens: n(o?.hoechstens) ?? 0 } : undefined; };
const MASKEN_WERT = (w: unknown): MaskenWert | undefined => {
  if (typeof w === 'string' || typeof w === 'boolean' || w === null) return w;
  if (typeof w === 'number' && Number.isFinite(w)) return w;
  if (Array.isArray(w) && w.every(x => typeof x === 'string')) return w as string[];
  if (Array.isArray(w) && w.every(x => typeof x === 'number' && Number.isFinite(x))) return w as number[];
  return undefined;
};
const katalog = (v: unknown): KatalogBezug | undefined => {
  const o = obj(v); const kid = typeof o?.id === 'string' && /^[a-z]+\.[a-z0-9-]+$/.test(o.id) ? o.id : undefined;
  if (!o || !kid) return undefined;
  const werte: Record<string, MaskenWert> = {};
  for (const [k, w] of Object.entries(obj(o.werte) ?? {})) { const x = MASKEN_WERT(w); if (/^[A-Za-z][A-Za-z0-9_.-]{0,39}$/.test(k) && x !== undefined) werte[k] = x; }
  return Object.keys(werte).length ? { id: kid, werte } : { id: kid };
};

/** Einen Knoten eines allgemeinen Prozesses säubern (FORM — die Felder des Fulfillments wie dort, dazu die neuen). null = unlesbar. */
export function knotenAus(o: O): K | null {
  const i = id(o.id); const titel = s(o.titel);
  if (!i || !titel) return null;
  const werkzeuge = texte(o.werkzeuge);
  return sauber<K>({
    id: i, elternId: id(o.elternId), titel, rang: n(o.rang) ?? 0,
    ziel: s(o.ziel), warum: s(o.warum), eingang: s(o.eingang), ergebnis: s(o.ergebnis), kennzahl: s(o.kennzahl),
    zustaendig: wahl(o.zustaendig, ['intern', 'kunde', 'beide'] as const), rolle: s(o.rolle), dauerTage: n(o.dauerTage), aufwandStunden: n(o.aufwandStunden),
    freigabe: id(o.freigabe), kundeSichtbar: bo(o.kundeSichtbar), phaseId: s(o.phaseId), bausteinId: id(o.bausteinId),
    heute: s(o.heute), werkzeuge: werkzeuge.length ? werkzeuge : undefined, dokumentation: s(o.dokumentation),
    form: wahl(o.form, PROZESS_FORMEN), frist: (() => { const x = n(o.frist); return x !== undefined && Number.isInteger(x) && x >= 0 && x <= 3650 ? x : undefined; })(),
    zweige: zweige(o.zweige), pos: lage(o.pos), pfeilText: pfeilText(o.pfeilText),
    versuche: (() => { const x = n(o.versuche); return x !== undefined && Number.isInteger(x) && x >= 1 && x <= 20 ? x : undefined; })(),
    katalog: katalog(o.katalog), ausloeser: ausloeser(o.ausloeser), agent: agent(o.agent), raute: raute(o.raute), warten: warten(o.warten),
    schleife: schleife(o.schleife), teilprozess: teilprozess(o.teilprozess), ende: ende(o.ende), schloss: schloss(o.schloss),
    bahn: wahl(o.bahn, BAHNEN), abfrage: abfrage(o.abfrage), erneut: erneut(o.erneut),
  });
}
const zettel = (o: O): NotizZettel | null => {
  const zid = id(o.id), text = typeof o.text === 'string' ? o.text : undefined, pos = lage(o.pos);
  return zid && text !== undefined && pos ? sauber<NotizZettel>({ id: zid, text, pos, farbe: wahl(o.farbe, ZETTEL_FARBEN), von: s(o.von), am: s(o.am) }) : null;
};
const schnittstelle = (v: unknown): ProzessSchnittstelle | undefined => {
  const o = obj(v);
  return o ? { eingaben: liste(o.eingaben, vertragFeld), ausgaben: liste(o.ausgaben, vertragFeld) } : undefined;
};

/**
 * Herkunft einer Definition (22.10., Vorlagen der Kundengewinnung): aus welcher Vorlage ein Prozess übernommen wurde (`art: 'muster'`, `quelleIds` = Kennung der
 * Vorlage) — damit die Galerie „schon übernommen“ zeigt und Übergaben auf den passenden eigenen Prozess zeigen. Nur Form, keine Personen.
 */
const herkunft = (v: unknown): ProzessDefinition['herkunft'] | undefined => {
  const o = obj(v); const art = wahl(o?.art, ['muster', 'import', 'hand', 'demo'] as const);
  if (!o || !art) return undefined;
  const q = texte(o.quelleIds).filter(x => ID.test(x));
  return sauber<NonNullable<ProzessDefinition['herkunft']>>({ art, quelleIds: q.length ? q : undefined, am: typeof o.am === 'string' ? o.am.slice(0, 40) : '' });
};

/** Eine Definition säubern (rein) — Art immer „paket“, Listen nie gekürzt. null = unlesbar. */
export function definitionAus(o: O): ProzessDefinition | null {
  const i = id(o.id), titel = typeof o.titel === 'string' ? o.titel : undefined;
  if (!i || titel === undefined) return null;
  const z = liste(o.zettel, zettel);
  return sauber<ProzessDefinition>({
    id: i, art: 'paket', titel, beschreibung: s(o.beschreibung),
    knoten: liste(o.knoten, knotenAus), uebergaenge: [], freigaben: [], rollen: [],
    fassung: n(o.fassung) ?? 1, geaendert: s(o.geaendert) ?? '', geaendertVon: s(o.geaendertVon) ?? '',
    bereich: wahl(o.bereich, BEREICH_IDS), fallArt: wahl(o.fallArt, FALL_ART_IDS),
    eigner: typeof o.eigner === 'string' && TEAM_ID.test(o.eigner) ? o.eigner : undefined,
    laeuftAls: typeof o.laeuftAls === 'string' && PERSON.test(o.laeuftAls) ? o.laeuftAls : undefined,
    startKriterium: s(o.startKriterium), endKriterium: s(o.endKriterium), schnittstelle: schnittstelle(o.schnittstelle),
    zettel: z.length ? z : undefined, herkunft: herkunft(o.herkunft),
  });
}
const version = (o: O): ProzessVersion | null => {
  const nr = n(o.nr), am = s(o.am); const d = obj(o.definition) ? definitionAus(o.definition as O) : null;
  return nr !== undefined && Number.isInteger(nr) && nr >= 1 && am && d ? sauber<ProzessVersion>({ nr, name: s(o.name) ?? `Version ${nr}`, notiz: s(o.notiz), am, von: s(o.von) ?? '', definition: d }) : null;
};
export function eintragAus(o: O): ProzessEintrag | null {
  const i = typeof o.id === 'string' && PROZESS_KENNUNG.test(o.id) ? o.id : undefined;
  const e = obj(o.entwurf) ? definitionAus(o.entwurf as O) : null;
  if (!i || !e || e.id !== i) return null;
  const versionen = liste(o.versionen, version).filter(v => v.definition.id === i).sort((a, b) => a.nr - b.nr).filter((v, x, l) => l.findIndex(y => y.nr === v.nr) === x);
  return sauber<ProzessEintrag>({
    id: i, entwurf: e, versionen, status: wahl(o.status, PROZESS_STATUS) ?? 'entwurf',
    angelegtAm: s(o.angelegtAm) ?? '', angelegtVon: s(o.angelegtVon) ?? '', entwurfAm: s(o.entwurfAm) ?? '', entwurfVon: s(o.entwurfVon) ?? '',
    statusAm: s(o.statusAm), statusVon: s(o.statusVon),
  });
}
export const leerProzesse = (): ProzesseDatei => ({ v: 1, prozesse: [] });
/** Den Bestand `prozesse--<haushalt>` säubern (rein, schreibt nie). Doppelte Kennungen: der erste gilt. */
export function prozesseAus(roh: unknown): ProzesseDatei {
  const o = obj(roh);
  if (!o) return leerProzesse();
  const l = liste(o.prozesse, eintragAus);
  return { v: 1, prozesse: l.filter((x, i) => l.findIndex(y => y.id === x.id) === i) };
}

const webhookEintrag = (o: O): WebhookEintrag | null => {
  const p = typeof o.prozessId === 'string' && PROZESS_KENNUNG.test(o.prozessId) ? o.prozessId : undefined;
  const k = typeof o.kennung === 'string' && WEBHOOK_KENNUNG.test(o.kennung) ? o.kennung : undefined;
  const h = typeof o.schluesselHash === 'string' && /^[a-f0-9]{64}$/.test(o.schluesselHash) ? o.schluesselHash : undefined;
  const am = s(o.angelegtAm);
  if (!p || !k || !h || !am) return null;
  return sauber<WebhookEintrag>({
    prozessId: p, kennung: k, schluesselHash: h, scharf: o.scharf === true, angelegtAm: am, angelegtVon: s(o.angelegtVon) ?? '',
    erneuertAm: s(o.erneuertAm), erneuertVon: s(o.erneuertVon), scharfAm: s(o.scharfAm), scharfVon: s(o.scharfVon),
    anzahl: n(o.anzahl), zuletztAm: s(o.zuletztAm),
  });
};
const eingang = (o: O): WebhookEingang | null => {
  const i = typeof o.id === 'string' && EINGANG_KENNUNG.test(o.id) ? o.id : undefined;
  const p = typeof o.prozessId === 'string' && PROZESS_KENNUNG.test(o.prozessId) ? o.prozessId : undefined;
  const am = s(o.am), v = n(o.version);
  if (!i || !p || !am || v === undefined) return null;
  const felder: Record<string, string | number | boolean> = {};
  for (const [k, w] of Object.entries(obj(o.felder) ?? {})) if (FELD_KENNUNG.test(k) && (typeof w === 'string' || typeof w === 'boolean' || (typeof w === 'number' && Number.isFinite(w)))) felder[k] = w;
  return { id: i, prozessId: p, version: v, am, felder, fremd: true };
};
export const leerWebhooks = (): WebhookDatei => ({ v: 1, webhooks: [], eingaenge: [] });
/** Den Bestand `prozesse-webhook--<haushalt>` säubern (rein). Je Prozess höchstens ein Webhook, je Kennung höchstens einer (der erste gilt). */
export function webhooksAus(roh: unknown): WebhookDatei {
  const o = obj(roh);
  if (!o) return leerWebhooks();
  const w = liste(o.webhooks, webhookEintrag);
  return {
    v: 1, webhooks: w.filter((x, i) => w.findIndex(y => y.prozessId === x.prozessId || y.kennung === x.kennung) === i),
    eingaenge: liste(o.eingaenge, eingang),
  };
}

// ── Schreibregeln der Werkstatt (rein) ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WerkstattKontext {
  person: string;
  jetzt: string;
  rechte: ProzessRechte;
  /** Stand eines Eintrags (Server: Fingerabdruck). */
  standVon: (e: ProzessEintrag) => string;
  /** Neue Kennung (`pz-<uuid>` bzw. `fk-<uuid>`). */
  neueKennung: (praefix: 'pz' | 'fk') => string;
  pruef?: PruefKontext;
}
export type WerkstattErgebnis =
  | { ok: true; datei: ProzesseDatei; eintrag: ProzessEintrag; befunde: Befund[]; version?: ProzessVersion; geaendert: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; befunde?: Befund[]; konflikt?: { id: string; stand: string } };

const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string, extra: { befunde?: Befund[]; konflikt?: { id: string; stand: string } } = {}): WerkstattErgebnis => ({ ok: false, status, fehler, ...extra });
const textFeld = (v: unknown, max: number, name: string, pflicht: boolean): { ok: true; wert: string | null | undefined } | { ok: false; e: WerkstattErgebnis } => {
  if (v === undefined) return { ok: true, wert: undefined };
  if (v === null || (typeof v === 'string' && !v.trim())) return pflicht ? { ok: false, e: nein(400, `${name} fehlt.`) } : { ok: true, wert: null };
  if (typeof v !== 'string') return { ok: false, e: nein(400, `${name}: Text erwartet.`) };
  if (v.trim().length > max) return { ok: false, e: nein(413, `${name}: höchstens ${max.toLocaleString('de-DE')} Zeichen. Nichts gespeichert.`) };
  return { ok: true, wert: v.trim() };
};

/** Ein neuer Prozess (rein): Wurzel = der Prozess, eine Phase „Ablauf“, ein Auslöser „von Hand“ — mit festen neuen Kennungen. */
export function neuerProzess(a: { id: string; titel: string; bereich: ProzessDefinition['bereich']; fallArt: ProzessDefinition['fallArt']; eigner?: string; beschreibung?: string; von: string; jetzt: string; kennung: () => string }): ProzessEintrag {
  const w = a.kennung(), p = a.kennung(), st = a.kennung();
  const entwurf: ProzessDefinition = sauber<ProzessDefinition>({
    id: a.id, art: 'paket', titel: a.titel, beschreibung: a.beschreibung, uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: a.jetzt, geaendertVon: a.von,
    bereich: a.bereich, fallArt: a.fallArt, eigner: a.eigner,
    knoten: [
      { id: w, titel: a.titel, rang: 1 },
      { id: p, elternId: w, titel: 'Ablauf', rang: 1 },
      { id: st, elternId: p, titel: 'Start', rang: 1, form: 'ausloeser', bahn: 'mensch', ausloeser: { art: 'hand' }, katalog: { id: 'ausloeser.hand' } },
    ],
  });
  return { id: a.id, entwurf, versionen: [], status: 'entwurf', angelegtAm: a.jetzt, angelegtVon: a.von, entwurfAm: a.jetzt, entwurfVon: a.von };
}

/** Den Entwurf speichern (rein): Schlösser setzen, prüfen — `fehler` → 400 mit allen Befunden, sonst gespeichert (Befunde `offen`/`hinweis` gehen mit). */
function entwurfSpeichern(e: ProzessEintrag, d: ProzessDefinition, kx: WerkstattKontext): { ok: true; eintrag: ProzessEintrag; befunde: Befund[] } | { ok: false; e: WerkstattErgebnis } {
  const mitSchloss = schlossSetzen(d, { ...(kx.pruef ?? {}), laufFremd: laufFremd(d) }).definition;
  const befunde = definitionPruefen(mitSchloss, kx.pruef ?? {});
  if (sperrtSpeichern(befunde)) return { ok: false, e: nein(400, befunde.find(x => x.stufe === 'fehler')!.text, { befunde }) };
  return { ok: true, befunde, eintrag: { ...e, entwurf: { ...mitSchloss, geaendert: kx.jetzt, geaendertVon: kx.person }, entwurfAm: kx.jetzt, entwurfVon: kx.person } };
}

/**
 * Die Änderungen der Werkstatt (rein, alles oder nichts). `aktion`:
 *   anlegen { titel, bereich, fallArt, eigner?, beschreibung? } · steckbrief { id, stand, felder } · entwurf { id, stand, knoten, zettel? }
 *   veroeffentlichen { id, stand, name, notiz? } · version-uebernehmen { id, stand, nr } · status { id, stand, status }
 * Rechte (Punkt 68): Entwürfe bauen volle Mitglieder und Konten „nur Business“; veröffentlichen und Status nur volle Mitglieder (403).
 */
export function werkstattAnwenden(datei: ProzesseDatei, eingabe: unknown, kx: WerkstattKontext): WerkstattErgebnis {
  const o = obj(eingabe);
  if (!o) return nein(400, 'Eingabe fehlt.');
  const aktion = o.aktion;
  if (!kx.rechte.entwurf) return nein(403, 'Prozesse bauen nur Personen im Haushalt.');
  if (aktion === 'anlegen') {
    if (datei.prozesse.length >= PROZESS_GRENZEN.prozesse) return nein(413, `Höchstens ${PROZESS_GRENZEN.prozesse} Prozesse — nichts angelegt.`);
    const t = textFeld(o.titel, PROZESS_TEXT.titel, 'Name', true); if (!t.ok) return t.e;
    const be = textFeld(o.beschreibung, PROZESS_TEXT.beschreibung, 'Beschreibung', false); if (!be.ok) return be.e;
    const bereich = wahl(o.bereich, BEREICH_IDS), fallArt = wahl(o.fallArt, FALL_ART_IDS);
    if (!bereich) return nein(400, 'Bereich: Marketing, Sales, Übergabe, Fulfillment, Ausbau, Führung oder Unterstützung.');
    if (!fallArt) return nein(400, 'Woran hängt ein Lauf? (lead, deal, mandat, event, firma, keiner)');
    const eigner = typeof o.eigner === 'string' && TEAM_ID.test(o.eigner) ? o.eigner : undefined;
    const e = neuerProzess({ id: kx.neueKennung('pz'), titel: t.wert!, bereich, fallArt, eigner, beschreibung: be.wert ?? undefined, von: kx.person, jetzt: kx.jetzt, kennung: () => kx.neueKennung('fk') });
    const r = entwurfSpeichern(e, e.entwurf, kx);
    if (!r.ok) return r.e;
    return { ok: true, datei: { ...datei, prozesse: [...datei.prozesse, r.eintrag] }, eintrag: r.eintrag, befunde: r.befunde, geaendert: true };
  }
  const pid = o.id;
  const alt = datei.prozesse.find(x => x.id === pid);
  if (!alt) return nein(404, 'Diesen Prozess gibt es nicht (mehr).');
  if (typeof o.stand !== 'string' || !o.stand) return nein(400, 'Stand fehlt — bitte neu laden.');
  const stand = kx.standVon(alt);
  if (o.stand !== stand) return nein(409, 'Inzwischen hat jemand anders geändert — bitte neu laden. Nichts gespeichert.', { konflikt: { id: alt.id, stand } });
  const ersetzt = (e: ProzessEintrag, befunde: Befund[], version?: ProzessVersion): WerkstattErgebnis => {
    const geaendert = JSON.stringify(e) !== JSON.stringify(alt);
    return { ok: true, datei: geaendert ? { ...datei, prozesse: datei.prozesse.map(x => (x.id === e.id ? e : x)) } : datei, eintrag: geaendert ? e : alt, befunde, ...(version ? { version } : {}), geaendert };
  };

  switch (aktion) {
    case 'steckbrief': {
      const f = obj(o.felder);
      if (!f) return nein(400, 'felder fehlt.');
      if (alt.status === 'archiviert') return nein(409, 'Ein archivierter Prozess wird nicht geändert — erst zurückholen.');
      const d: ProzessDefinition = { ...alt.entwurf };
      const t = textFeld(f.titel, PROZESS_TEXT.titel, 'Name', true); if (!t.ok) return t.e;
      if (t.wert) { d.titel = t.wert; const w = d.knoten.find(k => !k.elternId); if (w) d.knoten = d.knoten.map(k => (k.id === w.id ? { ...k, titel: t.wert! } : k)); }
      for (const [feld, max, name] of [['beschreibung', PROZESS_TEXT.beschreibung, 'Beschreibung'], ['startKriterium', PROZESS_TEXT.kriterium, 'Startkriterium'], ['endKriterium', PROZESS_TEXT.kriterium, 'Endkriterium']] as const) {
        const x = textFeld(f[feld], max, name, false); if (!x.ok) return x.e;
        if (x.wert === null) delete d[feld]; else if (x.wert !== undefined) d[feld] = x.wert;
      }
      if (f.bereich !== undefined) { const v = wahl(f.bereich, BEREICH_IDS); if (!v) return nein(400, 'Unbekannter Bereich.'); d.bereich = v; }
      if (f.fallArt !== undefined) { const v = wahl(f.fallArt, FALL_ART_IDS); if (!v) return nein(400, 'Unbekannte Fall-Art.'); d.fallArt = v; }
      if (f.eigner !== undefined) { if (f.eigner === null) delete d.eigner; else if (typeof f.eigner === 'string' && TEAM_ID.test(f.eigner)) d.eigner = f.eigner; else return nein(400, 'Eigner: eine Person aus dem Team.'); }
      if (f.laeuftAls !== undefined) { if (f.laeuftAls === null) delete d.laeuftAls; else if (typeof f.laeuftAls === 'string' && PERSON.test(f.laeuftAls)) d.laeuftAls = f.laeuftAls; else return nein(400, '„Läuft als“: ein Konto des Haushalts.'); }
      if (f.schnittstelle !== undefined) {
        if (f.schnittstelle === null) delete d.schnittstelle;
        else {
          const so = obj(f.schnittstelle) ?? {};
          const ein = vertragAus(so.eingaben, 'Eingaben'), aus = vertragAus(so.ausgaben, 'Ausgaben');
          const bf = [...ein.befunde, ...aus.befunde];
          if (bf.some(x => x.stufe === 'fehler')) return nein(400, bf[0].text, { befunde: bf });
          d.schnittstelle = { eingaben: ein.felder, ausgaben: aus.felder };
        }
      }
      const r = entwurfSpeichern(alt, d, kx);
      return r.ok ? ersetzt(r.eintrag, r.befunde) : r.e;
    }
    case 'entwurf': {
      if (alt.status === 'archiviert') return nein(409, 'Ein archivierter Prozess wird nicht geändert — erst zurückholen.');
      if (!Array.isArray(o.knoten)) return nein(400, 'knoten: die Knoten des Entwurfs als Liste.');
      if (o.knoten.length > PROZESS_GRENZEN.knotenJeProzess) return nein(413, `Höchstens ${PROZESS_GRENZEN.knotenJeProzess} Knoten — nichts gespeichert.`);
      const bekannt = new Set([...alt.entwurf.knoten.map(k => k.id), ...alt.versionen.flatMap(v => v.definition.knoten.map(k => k.id))]);
      const knoten: K[] = [];
      for (const [i, roh] of o.knoten.entries()) {
        const k = obj(roh) ? knotenAus(roh as O) : null;
        if (!k) return nein(400, `Knoten ${i + 1}: unlesbar (Kennung und Titel).`);
        if (!bekannt.has(k.id) && !KNOTEN_KENNUNG.test(k.id)) return nein(400, `Knoten ${i + 1}: neue Knoten tragen eine Kennung fk-<uuid>.`);
        knoten.push(k);
      }
      let z = alt.entwurf.zettel;
      if (o.zettel !== undefined) {
        if (o.zettel !== null && !Array.isArray(o.zettel)) return nein(400, 'zettel: als Liste.');
        const l = Array.isArray(o.zettel) ? o.zettel : [];
        if (l.length > PROZESS_GRENZEN.zettel) return nein(413, `Höchstens ${PROZESS_GRENZEN.zettel} Notiz-Zettel — nichts gespeichert.`);
        const zs = liste(l, zettel);
        if (zs.length !== l.length) return nein(400, 'Ein Notiz-Zettel ist unlesbar (Kennung, Text, Lage).');
        if (zs.some(x => x.text.length > PROZESS_TEXT.zettel)) return nein(413, `Ein Notiz-Zettel hat höchstens ${PROZESS_TEXT.zettel} Zeichen — nichts gespeichert.`);
        z = zs.length ? zs.map(x => (x.von ? x : { ...x, von: kx.person, am: kx.jetzt })) : undefined;
      }
      const d: ProzessDefinition = sauber<ProzessDefinition>({ ...alt.entwurf, knoten, zettel: z });
      const r = entwurfSpeichern(alt, d, kx);
      return r.ok ? ersetzt(r.eintrag, r.befunde) : r.e;
    }
    case 'veroeffentlichen': {
      if (!kx.rechte.veroeffentlichen) return nein(403, 'Veröffentlichen, aktiv schalten und Webhooks gibt es nur für volle Mitglieder — Entwürfe kannst du bauen.');
      if (alt.status === 'archiviert') return nein(409, 'Ein archivierter Prozess wird nicht veröffentlicht — erst zurückholen.');
      const befunde = definitionPruefen(alt.entwurf, kx.pruef ?? {});
      if (sperrtVeroeffentlichen(befunde)) return nein(409, 'Noch nicht fertig — erst die offenen Punkte erledigen.', { befunde });
      const v = veroeffentlichen(alt, { name: o.name, notiz: o.notiz, von: kx.person, jetzt: kx.jetzt });
      if (!v.ok) return nein(v.status, v.fehler);
      return ersetzt(v.eintrag, befunde, v.version);
    }
    case 'version-uebernehmen': {
      if (alt.status === 'archiviert') return nein(409, 'Ein archivierter Prozess wird nicht geändert — erst zurückholen.');
      const v = versionAlsEntwurf(alt, o.nr, { von: kx.person, jetzt: kx.jetzt });
      if (!v.ok) return nein(v.status, v.fehler);
      const r = entwurfSpeichern(v.eintrag, v.eintrag.entwurf, kx);
      return r.ok ? ersetzt(r.eintrag, r.befunde) : r.e;
    }
    case 'status': {
      if (!kx.rechte.status) return nein(403, 'Veröffentlichen, aktiv schalten und Webhooks gibt es nur für volle Mitglieder — Entwürfe kannst du bauen.');
      const ziel = wahl(o.status, PROZESS_STATUS);
      if (!ziel) return nein(400, `Status: ${PROZESS_STATUS.join(', ')}.`);
      let befunde: Befund[] = [];
      if (ziel === 'aktiv') {
        befunde = aktivBefunde(alt, kx.pruef ?? {});
        if (befunde.length) return nein(409, 'Noch nicht aktiv — erst die offenen Punkte erledigen.', { befunde });
      }
      if (ziel === 'probelauf' && !alt.versionen.length) return nein(409, 'Ein Probelauf braucht eine veröffentlichte Version.');
      if (ziel === 'pausiert' && alt.status !== 'aktiv' && alt.status !== 'probelauf') return nein(409, 'Pausieren geht nur, wenn der Prozess läuft.');
      if (ziel === alt.status) return ersetzt(alt, befunde);
      return ersetzt({ ...alt, status: ziel as ProzessStatus, statusAm: kx.jetzt, statusVon: kx.person }, befunde);
    }
    default: return nein(400, 'Unbekannte Aktion.');
  }
}
