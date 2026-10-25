// ─── Prozesse · Werkstatt — die Einstellungs-Maske je Baustein (Etappe B2, 21.10.; ANALYSE_100.md Punkt 22, Kevins Bild der Werkstatt) ─────────────────
// Klick auf einen Knoten öffnet rechts ein Panel aus dem Masken-Schema des Katalogs (lib/prozesse/baustein-katalog.ts): Felder mit Typ, Pflicht, Vorgabe,
// Auswahlquelle. Hier steht rein, wie Maske und Knoten zusammenhängen — EINE Stelle in beide Richtungen:
//   · `maskeWerte(knoten, eintrag)` — die Werte für das Panel: aus `katalog.werte` bzw. (Bausteine mit eigenem Feld, `eintrag.feld`) aus dem Feld des Knotens
//     (Auslöser, Agent, Raute, Warten, Schleife, Teilprozess, Ende, CRM-Abfrage, „erneut ab“).
//   · `maskeAnwenden(knoten, eintrag, werte, kx)` — die Werte zurück in den Knoten: Masken ohne eigenes Feld nach `katalog.werte` (nur Felder der Maske, Leeres
//     fällt weg), sonst als Objekt in das Feld — in der Form, die die Säuberer der Bestände lesen (lib/prozesse/bestand.ts). Was noch fehlt, bleibt leer (der
//     Entwurf wird gespeichert, die Prüfung meldet `offen`); feste Werte (`agentFest`, `fest`) setzt immer die Regel, nie die Maske.
//   · `neuerKnoten(eintrag, kennung)` — ein Knoten aus dem Katalog mit den Vorgaben seiner Maske (Formauswahl am „+“, Tab, Palette).
//   · `maskeBefunde` — die Befunde der Maske (sauberes Panel: Fehler und Offenes am Feld).
// Rein und client-sicher; Tests: tests/prozesse-werkstatt-maske.test.ts.

import {
  type AgentSchritt, type AgentWer, type Ausloeser, type Bedingung, type Befund, type CrmAbfrage, type EndeAngabe, type ErneutAb, type MaskenWert,
  type ModellWahl, type ModelTier, type ProzessForm, type ProzessKnoten, type RautenRegel, type SchleifeRegel, type TeilprozessAufruf, type VertragFeld,
  type WartenRegel, type WebhookFeld,
} from './definition';
import { katalogEintrag, maskeSaeubern, maskeVorgaben, type KatalogEintrag, type KatalogKategorie, type MaskenKontext } from './baustein-katalog';
import { suchPasst } from '@/lib/text/such-norm';
import { modellSchluessel, stufeVorgabe, type ModellOption } from './modell-wahl';
import { istWebRecherche, oeffentlichModus } from './agent-schritt';
import { DATUMS_FELDER, LOOP_NAME } from './ausloeser';
import { zeitplanKurz } from './zeitplan-tage';
import { EREIGNIS_NAME, istEreignisArt } from '@/lib/ereignisse/arten';

type K = ProzessKnoten<ProzessForm>;
type W = Record<string, MaskenWert>;
type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);
const leer = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const ohneLeere = (o: O): W => Object.fromEntries(Object.entries(o).filter(([, v]) => !leer(v))) as W;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);
const liste = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const texte = (v: unknown): string[] => liste<unknown>(v).filter((x): x is string => typeof x === 'string');

/** Die Werte der Maske eines Knotens (für das Panel). */
export function maskeWerte(k: K, e: KatalogEintrag): W {
  if (!e.feld) {
    const w: W = { ...(k.katalog?.werte ?? {}) };
    // Übernommene Vorlagen bis 22.10. trugen die Frist einer Entscheidung nur am Knoten (`frist`) — die Maske zeigt sie als „Entscheiden binnen“; beim nächsten
    // Speichern steht sie dann in `katalog.werte.fristTage` (der Motor liest beides, lib/prozesse/lauf-regeln.ts).
    if (w.fristTage === undefined && typeof k.frist === 'number' && e.maske.some(f => f.id === 'fristTage')) w.fristTage = k.frist;
    return w;
  }
  // Noch ohne Feld (das Nötigste fehlt): die bisher eingegebenen Werte stehen solange in `katalog.werte` — nichts geht verloren.
  if (k[e.feld] === undefined) return { ...(k.katalog?.werte ?? {}) };
  switch (e.feld) {
    case 'ausloeser': {
      const a = k.ausloeser;
      if (!a) return {};
      if (a.art === 'ereignis') return ohneLeere({ ereignis: a.ereignis, bedingungen: a.bedingungen ?? [], verknuepfung: a.verknuepfung });
      if (a.art === 'zeitplan') return ohneLeere({ rhythmus: a.rhythmus, uhrzeit: a.uhrzeit, tage: a.tage ?? [] });
      if (a.art === 'datum') return ohneLeere({ feld: a.feld, versatzTage: a.versatzTage, werktage: a.werktage ?? false, uhrzeit: a.uhrzeit, bedingungen: a.bedingungen ?? [], verknuepfung: a.verknuepfung });
      if (a.art === 'webhook') return ohneLeere({ felder: a.felder, bedingungen: a.bedingungen ?? [], verknuepfung: a.verknuepfung });
      if (a.art === 'loop') return { loop: a.loop };
      if (a.art === 'person') return ohneLeere({ uhrzeit: a.uhrzeit, bis: a.bis, tage: a.tage, nachMorgenlauf: a.nachMorgenlauf ?? false });
      return {};
    }
    case 'agent': {
      const a = k.agent;
      if (!a) return {};
      return ohneLeere({
        auftrag: a.auftrag, modell: a.modell, modellWahl: a.modellWahl ? modellSchluessel(a.modellWahl) : undefined, budgetCent: a.budgetCent || undefined, warumKeineRegel: a.warumKeineRegel,
        werkzeuge: a.werkzeuge, brain: a.gedaechtnis.brain, akte: a.gedaechtnis.akte, eingabe: a.eingabe, ausgabe: a.ausgabe,
        headId: a.wer.art === 'head' ? a.wer.headId : undefined, skillId: a.wer.art === 'skill' ? a.wer.skillId : undefined,
        vorschlagFelder: a.vorschlagFelder, uebernahme: a.uebernahme ?? (a.ergebnis === 'vorschlag' ? 'je-feld' : undefined),
        // Alte Schritte ohne das Feld zeigen „aus“ (so laufen sie auch) — die Vorgabe „an“ gilt nur für neue Research-Knoten.
        ...(istWebRecherche(a) ? { nurOeffentlich: a.nurOeffentlich === true } : {}),
      });
    }
    case 'raute': {
      const r = k.raute;
      if (!r) return {};
      if (r.art === 'regel') return ohneLeere({ bedingungen: r.bedingungen, verknuepfung: r.verknuepfung });
      if (r.art === 'score') return ohneLeere({ pruefung: r.pruefung, schwelle: r.schwelle, temperatur: r.temperatur });
      return ohneLeere({ frage: r.frage, warumKeineRegel: r.warumKeineRegel, modell: r.modell, modellWahl: r.modellWahl ? modellSchluessel(r.modellWahl) : undefined, budgetCent: r.budgetCent || undefined });
    }
    case 'warten': {
      const w = k.warten;
      if (!w) return {};
      // 22.10. (alles an einer Vorlage änderbar): „Arbeitszeit zählen“ stand in der Maske, fiel aber beim Lesen und Schreiben weg.
      if (w.art === 'dauer') return ohneLeere({ tage: w.tage, stunden: w.stunden, arbeitszeit: w.arbeitszeit });
      if (w.art === 'datum') return ohneLeere({ feld: w.feld, versatzTage: w.versatzTage, werktage: w.werktage ?? false, hoechstensTage: w.hoechstensTage || undefined });
      // 22.10.: „Höchstens (Stunden)“ und „Arbeitszeit zählen“ (z. B. „Antwort binnen 4 Stunden“ der Vorlagen) stehen jetzt auch im Panel — vorher leer und
      // beim nächsten Speichern verloren.
      return ohneLeere({ ereignis: w.ereignis, bedingungen: w.bedingungen ?? [], verknuepfung: w.verknuepfung, hoechstensTage: w.hoechstensTage || undefined, hoechstensStunden: w.hoechstensStunden, arbeitszeit: w.arbeitszeit });
    }
    case 'schleife': return k.schleife ? ohneLeere({ liste: k.schleife.liste, prozessId: k.schleife.prozessId, hoechstens: k.schleife.hoechstens || undefined }) : {};
    case 'teilprozess': return k.teilprozess ? ohneLeere({ prozessId: k.teilprozess.prozessId, warten: k.teilprozess.warten }) : {};
    case 'ende': return k.ende?.uebergabeAn ? { uebergabeAn: k.ende.uebergabeAn } : {};
    case 'abfrage': {
      const q = k.abfrage;
      return q ? ohneLeere({ art: q.art, status: q.status, temperatur: q.temperatur, bean: q.bean, lifecycle: q.lifecycle, stufe: q.stufe, nurMeine: q.nurMeine, wertAb: q.wertAb, tage: q.tage, hoechstens: q.hoechstens || undefined }) : {};
    }
    case 'erneut': return k.erneut ? ohneLeere({ ab: k.erneut.ab, hoechstens: k.erneut.hoechstens || undefined }) : {};
  }
}

/** Was die Maske über die Instanz wissen muss: die angebundenen Modelle (für „Modell“ → Anbieter, Kennung, Stufe). */
export interface MaskenUmfeld { modelle?: readonly ModellOption[] | null }

const modellWahlVon = (schluessel: unknown, kx: MaskenUmfeld): ModellWahl | undefined => {
  const o = typeof schluessel === 'string' ? kx.modelle?.find(m => m.schluessel === schluessel) : undefined;
  return o ? { anbieter: o.anbieter, modell: o.modell, stufe: o.stufe } : undefined;
};
const stufe = (v: unknown, sonst: ModelTier): ModelTier => (v === 'schnell' || v === 'ausgewogen' || v === 'stark' ? v : sonst);
const bedingungen = (v: unknown): Bedingung[] => liste<Bedingung>(v).filter(b => !!obj(b) && typeof b.feld === 'string' && typeof b.op === 'string');
const verkn = (v: unknown) => (v === 'oder' ? 'oder' as const : v === 'und' ? 'und' as const : undefined);
const sauber = <T>(o: O): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Wer arbeitet am Agenten-Knoten — fest aus dem Baustein (ZOE, Research) bzw. aus der Maske (Head, Skill). */
function agentWer(e: KatalogEintrag, w: W, alt?: AgentWer): AgentWer {
  if (e.agentFest) return e.agentFest.wer;
  if (e.id === 'agent.head') return { art: 'head', headId: text(w.headId) || (alt?.art === 'head' ? alt.headId : '') };
  if (e.id === 'agent.skill') return { art: 'skill', skillId: text(w.skillId) || (alt?.art === 'skill' ? alt.skillId : '') };
  return { art: 'zoe' };
}

/** Das Feld eines Knotens aus den Werten der Maske (Bausteine mit eigenem Feld) — undefined, solange das Nötigste fehlt (dann meldet die Prüfung `offen`). */
function feldAus(e: KatalogEintrag, w: W, alt: K, kx: MaskenUmfeld): Partial<K> {
  switch (e.feld) {
    case 'ausloeser': {
      let a: Ausloeser | undefined;
      if (e.id === 'ausloeser.hand') a = { art: 'hand' };
      else if (e.id === 'ausloeser.ereignis') a = text(w.ereignis) ? sauber<Ausloeser>({ art: 'ereignis', ereignis: w.ereignis, bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung) }) : undefined;
      else if (e.id === 'ausloeser.zeitplan') { const t = liste<unknown>(w.tage).filter((x): x is number => Number.isInteger(x)); a = text(w.rhythmus) && text(w.uhrzeit) ? sauber<Ausloeser>({ art: 'zeitplan', rhythmus: w.rhythmus, uhrzeit: w.uhrzeit, tage: t.length ? t : undefined }) : undefined; }
      else if (e.id === 'ausloeser.datum') a = text(w.feld) && zahl(w.versatzTage) !== undefined ? sauber<Ausloeser>({ art: 'datum', feld: w.feld, versatzTage: zahl(w.versatzTage), werktage: w.werktage === true ? true : undefined, uhrzeit: text(w.uhrzeit) || undefined, bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung) }) : undefined;
      else if (e.id === 'ausloeser.webhook') a = sauber<Ausloeser>({ art: 'webhook', felder: liste<WebhookFeld>(w.felder), bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung) });
      else if (e.id === 'ausloeser.loop') a = text(w.loop) ? { art: 'loop', loop: w.loop as 'morgen' } : undefined;
      // Je Person (24.10.): die Stunde einer Stellschraube (`stundeAus`, nur aus einer Überführung) bleibt beim Bearbeiten stehen.
      else if (e.id === 'ausloeser.person') a = text(w.uhrzeit) ? sauber<Ausloeser>({ art: 'person', uhrzeit: w.uhrzeit, bis: text(w.bis) || undefined, tage: (text(w.tage) || 'mo-fr') as 'mo-fr', nachMorgenlauf: w.nachMorgenlauf === true ? true : undefined, stundeAus: alt.ausloeser?.art === 'person' ? alt.ausloeser.stundeAus : undefined }) : undefined;
      return { ausloeser: a };
    }
    case 'agent': {
      const wer = agentWer(e, w, alt.agent?.wer);
      // Head bzw. Skill noch nicht gewählt: noch kein Agenten-Schritt (sonst wäre der Entwurf nicht speicherbar) — die Werte warten in `katalog.werte`.
      if ((wer.art === 'head' && !wer.headId) || (wer.art === 'skill' && !wer.skillId)) return { agent: undefined };
      const vorschlag = e.agentFest?.ergebnis === 'vorschlag' || alt.agent?.ergebnis === 'vorschlag';
      const vf = texte(w.vorschlagFelder);
      // „Nur öffentliche Angaben“ (nur Web-Recherche-Fach-Agenten): Akte und Brain sind dann aus — gespeichert, wie es läuft.
      const oeffentlich = w.nurOeffentlich === true && oeffentlichModus({ wer, nurOeffentlich: true });
      const a: AgentSchritt = sauber<AgentSchritt>({
        wer, auftrag: text(w.auftrag), modell: stufe(w.modell, stufeVorgabe(wer)), modellWahl: modellWahlVon(w.modellWahl, kx),
        budgetCent: zahl(w.budgetCent) ?? 0, gedaechtnis: oeffentlich ? { brain: false, akte: false } : { brain: w.brain === true, akte: w.akte !== false }, nurOeffentlich: oeffentlich ? true : undefined,
        werkzeuge: e.agentFest ? [] : texte(w.werkzeuge), eingabe: liste<VertragFeld>(w.eingabe), ausgabe: liste<VertragFeld>(w.ausgabe), warumKeineRegel: text(w.warumKeineRegel),
        ergebnis: vorschlag ? 'vorschlag' : undefined, vorschlagFelder: vorschlag && vf.length ? vf : undefined,
        uebernahme: vorschlag && w.uebernahme === 'sammel' ? 'sammel' : undefined,
      });
      return { agent: a };
    }
    case 'raute': {
      let r: RautenRegel | undefined;
      if (e.id === 'entscheidung.regel') r = sauber<RautenRegel>({ art: 'regel', bedingungen: bedingungen(w.bedingungen), verknuepfung: verkn(w.verknuepfung) });
      else if (e.id === 'entscheidung.score') r = text(w.pruefung) ? sauber<RautenRegel>({ art: 'score', pruefung: w.pruefung, schwelle: zahl(w.schwelle), temperatur: texte(w.temperatur).length ? texte(w.temperatur) : undefined }) : undefined;
      else if (e.id === 'entscheidung.modell') r = sauber<RautenRegel>({ art: 'modell', frage: text(w.frage), warumKeineRegel: text(w.warumKeineRegel), modell: stufe(w.modell, 'ausgewogen'), budgetCent: zahl(w.budgetCent) ?? 0, modellWahl: modellWahlVon(w.modellWahl, kx) });
      return { raute: r };
    }
    case 'warten': {
      let x: WartenRegel | undefined;
      if (e.id === 'warten.dauer') x = sauber<WartenRegel>({ art: 'dauer', tage: zahl(w.tage) ?? 0, stunden: zahl(w.stunden), arbeitszeit: w.arbeitszeit === true ? true : undefined });
      else if (e.id === 'warten.datum') x = text(w.feld) ? sauber<WartenRegel>({ art: 'datum', feld: w.feld, versatzTage: zahl(w.versatzTage), hoechstensTage: zahl(w.hoechstensTage) ?? 0, werktage: w.werktage === true ? true : undefined }) : undefined;
      else if (e.id === 'warten.ereignis') x = text(w.ereignis) ? sauber<WartenRegel>({ art: 'ereignis', ereignis: w.ereignis, bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung), hoechstensTage: zahl(w.hoechstensTage) ?? 0, hoechstensStunden: zahl(w.hoechstensStunden), arbeitszeit: w.arbeitszeit === true ? true : undefined }) : undefined;
      return { warten: x };
    }
    case 'schleife': return { schleife: text(w.liste) && text(w.prozessId) ? { liste: text(w.liste), prozessId: text(w.prozessId), hoechstens: zahl(w.hoechstens) ?? 0 } as SchleifeRegel : undefined };
    case 'teilprozess': return { teilprozess: text(w.prozessId) ? sauber<TeilprozessAufruf>({ prozessId: text(w.prozessId), eingaben: alt.teilprozess?.eingaben, warten: e.id === 'teilprozess.starten' ? w.warten === true : undefined }) : undefined };
    case 'ende': {
      const ergebnis = e.id === 'ende.abbruch' ? 'abbruch' as const : e.id === 'ende.uebergabe' ? 'uebergabe' as const : 'erfolg' as const;
      return { ende: sauber<EndeAngabe>({ ergebnis, uebergabeAn: ergebnis === 'uebergabe' && text(w.uebergabeAn) ? text(w.uebergabeAn) : undefined }) };
    }
    case 'abfrage': {
      const l = (x: unknown) => { const t = texte(x); return t.length ? t : undefined; };
      return { abfrage: text(w.art) ? sauber<CrmAbfrage>({ art: w.art, status: l(w.status), temperatur: l(w.temperatur), bean: l(w.bean), lifecycle: l(w.lifecycle), stufe: l(w.stufe), nurMeine: w.nurMeine === true ? true : undefined, wertAb: zahl(w.wertAb), tage: zahl(w.tage), hoechstens: zahl(w.hoechstens) ?? 0 }) : undefined };
    }
    case 'erneut': return { erneut: text(w.ab) ? { ab: text(w.ab), hoechstens: zahl(w.hoechstens) ?? 0 } as ErneutAb : undefined };
    default: return {};
  }
}

/** Die Werte der Maske in den Knoten schreiben (rein). Unbekannte Felder fallen weg; Leeres entfernt den Wert. */
export function maskeAnwenden(k: K, e: KatalogEintrag, werte: W, kx: MaskenUmfeld = {}): K {
  if (e.feld) {
    const teil = feldAus(e, werte, k, kx);
    const n: K = { ...k, katalog: { id: e.id } };
    for (const [f, v] of Object.entries(teil)) { if (v === undefined) delete (n as unknown as O)[f]; else (n as unknown as O)[f] = v; }
    // Fehlt das Nötigste noch, warten die einfachen Werte (Text, Zahl, ja/nein, Auswahl) in `katalog.werte` — beim nächsten Wert entsteht das Feld.
    if (n[e.feld] === undefined) {
      const w: W = {};
      for (const f of e.maske) { const v = werte[f.id]; if (!leer(v) && (typeof v !== 'object' || (Array.isArray(v) && (v.every(x => typeof x === 'string') || v.every(x => typeof x === 'number'))))) w[f.id] = v as MaskenWert; }
      if (Object.keys(w).length) n.katalog = { id: e.id, werte: w };
    }
    return n;
  }
  const w: W = {};
  for (const f of e.maske) { const v = werte[f.id]; if (!leer(v)) w[f.id] = v; }
  return { ...k, katalog: Object.keys(w).length ? { id: e.id, werte: w } : { id: e.id } };
}

// ── Name und Titel gehören zusammen (Kern-Bau-Test 24.10.: „Aufgabe braucht Name UND Titel getrennt“) ────────────────────────────────────────────────
// Ein Baustein mit Titel-Feld (Aufgabe, Termin, Follow-up …) trägt zwei Texte: den Namen des Schritts (Fläche, Liste) und den Titel dessen, was er anlegt. Regel:
//   · der Titel folgt dem Namen, solange er leer ist bzw. noch dem bisherigen Namen gleicht — wer ihn selbst ändert, löst ihn;
//   · der Name folgt dem Titel, solange er noch der Vorgabe des Bausteins (bzw. dem bisherigen Titel) gleicht — aber nur ohne Platzhalter (ein Name mit
//     „{{firma.name}}“ wäre auf der Fläche unlesbar), höchstens `NAME_MAX` Zeichen.
const TITEL_FELD = 'titel';
/** So lang darf ein Name höchstens werden (wie das Feld auf der Fläche). */
export const NAME_MAX = 120;
const hatTitelFeld = (e: Pick<KatalogEintrag, 'maske'>): boolean => e.maske.some(f => f.id === TITEL_FELD);
/** Den Namen eines Knotens setzen — der Titel folgt, solange er nicht selbst geändert wurde (rein). */
export function nameSetzen(k: K, e: KatalogEintrag | null | undefined, neu: string, kx: MaskenUmfeld = {}): K {
  const n: K = { ...k, titel: neu };
  if (!e || !hatTitelFeld(e)) return n;
  const w = maskeWerte(k, e);
  const t = text(w[TITEL_FELD]).trim();
  if (t && t !== k.titel.trim()) return n;
  return maskeAnwenden(n, e, { ...w, [TITEL_FELD]: neu }, kx);
}
/** Den Titel (Maske) setzen — der Name folgt, solange er noch die Vorgabe des Bausteins bzw. der bisherige Titel ist und der Titel keinen Platzhalter trägt (rein). */
export function titelSetzen(k: K, e: KatalogEintrag, neu: MaskenWert, kx: MaskenUmfeld = {}): K {
  const w = maskeWerte(k, e);
  const alt = text(w[TITEL_FELD]).trim();
  const n = maskeAnwenden(k, e, { ...w, [TITEL_FELD]: neu }, kx);
  const t = text(neu).trim();
  const name = k.titel.trim();
  const folgt = !!t && !t.includes('{{') && t.length <= NAME_MAX && (name === e.name || (!!alt && name === alt));
  return folgt ? { ...n, titel: t } : n;
}

// ── Schleife: die Liste vorbelegen (Runde 4, Bau-Test 3: „nur „Ergebnis von „CRM abfragen““ gab es — trotzdem war nichts gewählt“) ─────────────────────────
/** Die Listen, über die eine Schleife laufen kann: die Ergebnisse der CRM-Abfragen des Prozesses (`abfrage:<Knoten>`) — EINE Regel für Panel und Vorbelegung. */
export function schleifenListen(knoten: readonly K[], ohne?: string): { id: string; label: string }[] {
  return knoten.filter(x => x.id !== ohne && (x.abfrage || x.katalog?.id === 'crm.abfragen')).map(x => ({ id: `abfrage:${x.id}`, label: `Ergebnis von „${x.titel}“` }));
}
/**
 * Eine neue Schleife belegt ihre Liste vor (rein): gibt es im Prozess genau EINE passende Liste, diese; sonst die Abfrage, an die sie angehängt wird (`nach`). Eine
 * schon gewählte Liste bleibt; andere Knoten bleiben, wie sie sind. Mit der Liste greift auch der Filter der Teilprozesse (`schleifenElementFall`) sofort.
 */
export function schleifeVorbelegen(knoten: readonly K[], k: K, nach?: string | null): K {
  if (k.form !== 'schleife') return k;
  const e = katalogEintrag(k.katalog?.id);
  if (!e) return k;
  const w = maskeWerte(k, e);
  if (text(w.liste)) return k;
  const l = schleifenListen(knoten, k.id);
  const wahl = l.length === 1 ? l[0].id : nach && l.some(x => x.id === `abfrage:${nach}`) ? `abfrage:${nach}` : null;
  return wahl ? maskeAnwenden(k, e, { ...w, liste: wahl }) : k;
}

/** Ein neuer Knoten aus dem Katalog (rein): Form, Bahn, Name, Vorgaben der Maske. Agenten mit festem Agenten bekommen ihn gleich. */
export function neuerKnoten(e: KatalogEintrag, id: string, titel?: string): K {
  const k: K = { id, titel: titel?.trim() || e.name, rang: 0, form: e.form, bahn: e.bahn, katalog: { id: e.id } };
  return maskeAnwenden(k, e, maskeVorgaben(e));
}

/** Die Befunde der Maske eines Knotens (nur die Felder ohne eigenes Feld — die mit eigenem Feld prüft die Regel ihres Felds, lib/prozesse/definition-pruefen.ts). */
export function maskeBefunde(k: K, kx: MaskenKontext = {}): Befund[] {
  const e = katalogEintrag(k.katalog?.id);
  return e && !e.feld ? maskeSaeubern(e, k.katalog?.werte, kx, k.id, k.titel).befunde : [];
}

// ── Suche der Knoten-Auswahl (Bau-Test 2, 24.10.: „mehrfach“ fand die Mehrfach-Entscheidung nicht) ─────────────────────────────────────────────────────

/**
 * Stichwörter je Baustein — Wörter, unter denen man ihn sucht, ohne seinen Namen zu kennen (Kennung des Katalogs → Wörter). Gesucht wird über Name, Satz,
 * Anbindung, Form und diese Wörter (`suchPasst` — eine Regel für alle Suchen: Umlaute, Groß/klein, Wortteile). Nur Suchhilfe, nie gespeichert.
 */
export const BAUSTEIN_STICHWOERTER: Readonly<Record<string, readonly string[]>> = {
  'ausloeser.ereignis': ['Trigger', 'Start', 'wenn etwas passiert'], 'ausloeser.zeitplan': ['Trigger', 'Start', 'täglich', 'wöchentlich', 'monatlich', 'regelmäßig', 'Cron'],
  'ausloeser.datum': ['Trigger', 'Start', 'Frist', 'Stichtag', 'Geburtstag'], 'ausloeser.hand': ['Trigger', 'Start', 'manuell', 'Knopf'],
  'ausloeser.loop': ['Trigger', 'Start'], 'ausloeser.person': ['Trigger', 'Start', 'Uhrzeit', 'täglich'], 'ausloeser.webhook': ['Trigger', 'Start', 'API', 'HTTP', 'extern'],
  'aufgabe.anlegen': ['Task', 'To-do', 'Todo'], 'aufgabe.an-zoe': ['KI', 'Assistent', 'Aufgabe'],
  'inbox.mail-entwurf': ['E-Mail', 'Email', 'Nachricht', 'schreiben', 'senden'], 'whatsapp.entwurf': ['Nachricht', 'Chat', 'Messenger', 'senden'],
  'kalender.block': ['Termin', 'Zeit blocken', 'Fokus'], 'kalender.einladung': ['Meeting', 'Kalender', 'einladen'],
  'crm.abfragen': ['Liste', 'Filter', 'suchen', 'Leads', 'Deals', 'Daten holen'], 'crm.outreach-aufgabe': ['Ansprache', 'Akquise', 'anrufen'],
  'crm.kontakt-notiz': ['Kommentar', 'Vermerk'], 'crm.kontakt-pflegen': ['Stammdaten', 'aktualisieren', 'ändern'], 'crm.firma-akte': ['Firma', 'Daten holen'],
  'crm.deal-anlegen': ['Chance', 'Opportunity', 'Verkauf'], 'crm.deal-stufe': ['Pipeline', 'Phase', 'Stufe'], 'crm.lead-qualifizieren': ['SQL', 'MQL', 'Scoring'],
  'crm.followup': ['Nachfassen', 'Wiedervorlage'], 'crm.uebergeben': ['Zuständig', 'abgeben', 'Team'],
  'angebot.entwurf': ['Offerte', 'Kostenvoranschlag'], 'angebot.stellen': ['Offerte', 'versenden'], 'rechnung.erfassen': ['Faktura', 'abrechnen'],
  'glocke.melden': ['Benachrichtigung', 'Meldung', 'Hinweis'], 'telegram.hinweis': ['Benachrichtigung', 'Push', 'Nachricht'], 'loeschen.papierkorb': ['löschen', 'entfernen'],
  'erinnerung.runde': ['Nachfassen', 'Wiederholung', 'Runde'],
  'entscheidung.mensch': ['wenn', 'Verzweigung', 'Frage', 'ja nein'], 'entscheidung.regel': ['wenn', 'Bedingung', 'Verzweigung', 'Filter', 'if', 'ja nein'],
  'entscheidung.score': ['wenn', 'Verzweigung', 'Lead-Score', 'Temperatur'], 'entscheidung.modell': ['wenn', 'Verzweigung', 'KI'],
  'freigabe.stapel': ['Genehmigung', 'Approval', 'prüfen', 'Stapel'],
  'warten.dauer': ['Pause', 'Verzögerung', 'Delay', 'Tage', 'Stunden'], 'warten.datum': ['Pause', 'Frist', 'Termin'], 'warten.ereignis': ['Pause', 'Antwort', 'bis etwas passiert'],
  'agent.zoe': ['KI', 'Assistent'], 'agent.head': ['KI'], 'agent.skill': ['KI', 'Fähigkeit'], 'agent.research': ['KI', 'Recherche', 'Web'],
  'teilprozess.aufruf': ['Unterprozess', 'Subprozess', 'Prozess aufrufen'], 'teilprozess.starten': ['Unterprozess', 'Teilprozess', 'anderer Prozess'],
  'lauf.erneut-ab': ['zurück', 'wiederholen', 'Schleife'], 'schleife.je-eintrag': ['Loop', 'für jeden', 'je Eintrag', 'Wiederholung', 'Liste'],
  'crm.entwurf-text': ['LinkedIn', 'Nachricht', 'Anruf', 'Leitfaden'], 'crm.karte-ergaenzen': ['Akte', 'anreichern'], 'crm.lead-parken': ['ruhen', 'später', 'Wiedervorlage'],
  'crm.deal-vorschlagen': ['Chance'], 'crm.deal-schritt': ['Next Step'], 'crm.mandat-anlegen': ['Kunde', 'Auftrag'],
  'fulfillment.fall-starten': ['Kunde', 'Paket'], 'event.gaeste': ['Event', 'Einladung'], 'crm.kampagnen-ergebnis': ['Kampagne'], 'crm.anfrage-anlegen': ['Lead', 'Eingang'],
  'ende.ziel': ['Ende', 'Stopp', 'Erfolg', 'fertig'], 'ende.abbruch': ['Ende', 'Stopp', 'abbrechen'], 'ende.uebergabe': ['Ende', 'anderer Prozess'],
};
/** Worüber ein Baustein gefunden wird (rein): Name, Satz, Anbindung, Form, Stichwörter. */
export const suchFelderVon = (e: Pick<KatalogEintrag, 'id' | 'name' | 'satz' | 'anbindung' | 'form'>): string[] =>
  [e.name, e.satz, e.anbindung, formWort(e.form), ...(BAUSTEIN_STICHWOERTER[e.id] ?? [])];

/** Die Bau-Hilfen über der Liste (keine Bausteine des Katalogs): Auslöser ändern bzw. hinzufügen, Mehrfach-Entscheidung — auch sie findet die Suche. */
export type SonderWahl = 'ausloeser-wechseln' | 'ausloeser-neu' | 'mehrfach';
export interface SonderEintrag { id: SonderWahl; name: string; satz: string; kategorie: KatalogKategorie; stichwoerter: readonly string[] }
export const SONDER_AUSWAHL: readonly SonderEintrag[] = [
  { id: 'ausloeser-wechseln', name: 'Auslöser ändern …', satz: 'Von Hand, Ereignis, Zeitplan, je Person ab Uhrzeit, Webhook — der Ablauf dahinter bleibt.', kategorie: 'ausloeser', stichwoerter: ['Trigger', 'Start', 'wechseln', 'Typ'] },
  { id: 'ausloeser-neu', name: 'Weiteren Auslöser hinzufügen …', satz: 'Ein zweiter Start — beide führen in den ersten Schritt.', kategorie: 'ausloeser', stichwoerter: ['Trigger', 'Start', 'zweiter'] },
  { id: 'mehrfach', name: 'Mehrfach-Entscheidung …', satz: 'Mehrere Fälle, der erste passende gewinnt — wird zu Rauten nach Regel.', kategorie: 'entscheidung', stichwoerter: ['mehrfach', 'mehrere Fälle', 'Verzweigung', 'Switch', 'wenn', 'Raute'] },
];
/** Welche Bau-Hilfen die Auswahl zeigt (rein): nur, wo es sie gibt (`mehrfach`, `ausloeser`), passend zur Kategorie und zur Suche (dieselbe Regel wie für Bausteine). */
export function sonderAuswahl(o: { suche?: string; kategorie?: string; mehrfach?: boolean; ausloeser?: boolean }): SonderEintrag[] {
  return SONDER_AUSWAHL.filter(x => (x.id === 'mehrfach' ? !!o.mehrfach : !!o.ausloeser)
    && (!o.kategorie || o.kategorie === 'alle' || o.kategorie === x.kategorie)
    && suchPasst([x.name, x.satz, ...x.stichwoerter], o.suche));
}

/** Die Formauswahl (Punkt 17): Bausteine einer Form zuerst, dann der Rest — gefiltert nach Suchtext (`suchFelderVon`). Auslöser nur am Anfang. */
export function formauswahl(katalog: readonly KatalogEintrag[], o: { suche?: string; form?: ProzessForm; ohneAusloeser?: boolean; anhaengen?: boolean } = {}): KatalogEintrag[] {
  const passt = (e: KatalogEintrag) => suchPasst(suchFelderVon(e), o.suche);
  // Feinschliff 22.10. (Befund 1): beim Anhängen an einen Knoten stehen Aktionen und Entscheidungen vorn, Auslöser (nur am Anfang sinnvoll) ganz hinten.
  const rang = (e: KatalogEintrag) => (o.anhaengen && e.form === 'ausloeser' ? 1 : 0);
  // Feste Schritte (Paket Ü) kommen nur mit „In die Werkstatt überführen“ — nie aus der Auswahl.
  return katalog.filter(e => !e.nurUeberfuehrung && !(o.ohneAusloeser && e.form === 'ausloeser') && passt(e))
    .sort((a, b) => Number(b.form === o.form) - Number(a.form === o.form) || rang(a) - rang(b));
}

// ── Knoten-Auswahl als Seitenleiste (Werkstatt bau-fertig, 22.10., Punkt 5 — n8n-Art: Suche, Gruppen, „Zuletzt benutzt“) ─────────────────────────────

/**
 * Die Gruppe „Daten“: Bausteine, die Daten holen, durchgehen oder danach verzweigen — ohne selbst etwas zu bewirken (CRM-Abfrage, Akte lesen, Schleife je
 * Eintrag, Entscheidung nach Regel bzw. Score). Sie stehen nur hier, nicht noch einmal bei ihrer Anbindung.
 */
export const DATEN_BAUSTEINE: readonly string[] = ['crm.abfragen', 'crm.firma-akte', 'schleife.je-eintrag', 'entscheidung.regel', 'entscheidung.score'];
/** Reihenfolge der Anbindungs-Gruppen (was fehlt, kommt danach in Katalog-Reihenfolge). */
export const ANBINDUNG_REIHE: readonly string[] = ['Ablauf', 'Aufgabe', 'CRM', 'Inbox', 'WhatsApp', 'Kalender', 'Angebot', 'Rechnung', 'Fulfillment', 'Events', 'Glocke', 'Telegram', 'ZOE', 'Heads', 'Skills', 'Fach-Agenten', 'Webhook'];
/** So viele Bausteine merkt „Zuletzt benutzt“ (im Browser, je Person — nie im Bestand). */
export const ZULETZT_MAX = 6;
export const ZULETZT_MERKER = 'make-werkstatt-zuletzt';
export interface AuswahlGruppe { id: string; titel: string; eintraege: KatalogEintrag[] }

/** „Zuletzt benutzt“ fortschreiben (rein): der benutzte Baustein vorn, keine Doppelten, höchstens `ZULETZT_MAX`, nur Bausteine des Katalogs. */
export function zuletztMerken(l: readonly string[], id: string): string[] {
  return [id, ...l.filter(x => x !== id)].filter(x => !!katalogEintrag(x)).slice(0, ZULETZT_MAX);
}
/** Gemerkte Liste lesen (rein, robust): nur Kennungen des Katalogs, höchstens `ZULETZT_MAX`. */
export function zuletztAus(roh: string | null): string[] {
  try { const v = JSON.parse(roh ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!katalogEintrag(x)).slice(0, ZULETZT_MAX) : []; } catch { return []; }
}

/**
 * Die Knoten-Auswahl in Gruppen (rein): „Zuletzt benutzt“ (nur ohne Suche), „Auslöser“ (vorn bzw. — beim Anhängen — ganz hinten), „Daten“, dann je Anbindung
 * (Ablauf, Aufgabe, CRM, Inbox …). Gefiltert wie `formauswahl` (Suche über Name, Satz, Anbindung, Form, Stichwörter; Kategorie); innerhalb einer Gruppe stehen Bausteine derselben
 * Form wie der Ausgangsknoten vorn. Leere Gruppen fallen weg.
 */
export function formauswahlGruppen(katalog: readonly KatalogEintrag[], o: { suche?: string; form?: ProzessForm; ohneAusloeser?: boolean; anhaengen?: boolean; kategorie?: string; zuletzt?: readonly string[] } = {}): AuswahlGruppe[] {
  const l = formauswahl(katalog, o).filter(e => !o.kategorie || o.kategorie === 'alle' || e.kategorie === o.kategorie);
  const raus: AuswahlGruppe[] = [];
  if (!o.suche?.trim() && o.zuletzt?.length) {
    const z = o.zuletzt.map(id => l.find(e => e.id === id)).filter((e): e is KatalogEintrag => !!e);
    if (z.length) raus.push({ id: 'zuletzt', titel: 'Zuletzt benutzt', eintraege: z });
  }
  const ausl = l.filter(e => e.form === 'ausloeser');
  const daten = l.filter(e => e.form !== 'ausloeser' && DATEN_BAUSTEINE.includes(e.id));
  const rest = l.filter(e => e.form !== 'ausloeser' && !DATEN_BAUSTEINE.includes(e.id));
  const auslGruppe: AuswahlGruppe = { id: 'ausloeser', titel: o.anhaengen ? 'Auslöser (nur am Anfang)' : 'Auslöser', eintraege: ausl };
  if (!o.anhaengen) raus.push(auslGruppe);
  raus.push({ id: 'daten', titel: 'Daten', eintraege: daten });
  const anbindungen = [...ANBINDUNG_REIHE, ...rest.map(e => e.anbindung).filter(a => !ANBINDUNG_REIHE.includes(a))];
  for (const a of Array.from(new Set(anbindungen))) raus.push({ id: `a:${a}`, titel: a, eintraege: rest.filter(e => e.anbindung === a) });
  if (o.anhaengen) raus.push(auslGruppe);
  return raus.filter(g => g.eintraege.length);
}

// ── Die Unterzeile eines Knotens (Kevins Bild: „kleine Unterzeile, z. B. Mail-Entwurf · Stapel“) — die EINE Kurzzeile je Knoten ────────────────────────────
// Feinschliff 24.10. (Bau-Test: „Ereignis“ statt „neuer Lead“, „Zeitplan 08:00“ statt „montags 08:00“): sie zeigt die EINSTELLUNG — Ereignis mit Namen, Zeitplan mit
// Tagen, Warten mit Dauer bzw. worauf, Mail mit Betreff (gekürzt). Genutzt von Fläche, Liste (lib/prozesse/werkstatt-landkarte.ts → `was`) und Handy.

const FORM_WORT: Readonly<Record<ProzessForm, string>> = {
  schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Entscheidung', erinnerung: 'Erinnerung', termin: 'Termin', abstimmung: 'Abstimmung',
  ausloeser: 'Auslöser', agent: 'Agent', warten: 'Warten', schleife: 'Schleife', teilprozess: 'Teilprozess', freigabe: 'Freigabe', ende: 'Ende',
};
export const formWort = (f: ProzessForm | undefined) => FORM_WORT[f ?? 'schritt'];

/**
 * Was unter dem Namen eines Knotens steht (rein): der Baustein bzw. die Regel dahinter, „· Stapel“, wenn hinter ihm ein Freigabe-Schloss steht (die Wirkung
 * geschieht erst nach dem Klick). `agentName` = wie der Agent heißt (ZOE, Head …) — vom Aufrufer, weil die Namen der Heads im Katalog der Agenten stehen.
 */
/** Kurzzeile bzw. Satz des Starts eines Prozesses, der zu einem Produkt gehört (Fläche, Panel). */
export const AM_MANDAT_KURZ = 'am Mandat · neues Mandat';
/** Der Name dieses Starts im Kopf des Panels (25.10., Kern-Bau-Test 2: dort stand „Von Hand“ mit Hand-Symbol, Knoten und Satz sagten „am Mandat“). */
export const AM_MANDAT_NAME = 'Am Mandat';
/**
 * Startet der Knoten am Mandat? — der Start (Auslöser „von Hand“ bzw. noch ohne) eines Prozesses, der zu einem Produkt gehört (`amMandat`). EINE Regel für Unterzeile
 * des Knotens, Kopf und Satz des Panels und das Symbol (components/os/prozesse/WerkstattKnoten.tsx `symbolVon`).
 */
export const startAmMandat = (k: Pick<K, 'form' | 'ausloeser'>, amMandat: boolean | undefined): boolean => !!amMandat && k.form === 'ausloeser' && (!k.ausloeser || k.ausloeser.art === 'hand');
export const amMandatSatz = (produkte: readonly string[]): string =>
  `Startet am Mandat: ein neues Mandat ${produkte.length === 1 ? `des Produkts „${produkte[0]}“` : `der Produkte ${produkte.map(x => `„${x}“`).join(', ')}`} startet diesen Ablauf — im Fulfillment über „Fall starten“. Von Hand („Starten“) geht es zusätzlich.`;
export function knotenUnterzeile(k: K, o: { mitSchloss?: boolean; agentName?: string; amMandat?: boolean } = {}): string {
  const e = katalogEintrag(k.katalog?.id);
  const stapel = o.mitSchloss ? ' · Stapel' : '';
  switch (k.form) {
    // Kern-Bau-Test 24.10.: der Start eines Prozesses, der zu einem Produkt gehört, startet am Mandat (neues Mandat bzw. „Fall starten“) — „von Hand“ wäre falsch.
    case 'ausloeser': if (startAmMandat(k, o.amMandat)) return AM_MANDAT_KURZ; return k.ausloeser ? ausloeserKurz(k.ausloeser) : 'wie startet es?';
    case 'agent': return k.agent ? `${o.agentName ?? 'Agent'} · ${k.agent.modellWahl?.modell ?? k.agent.modell}${stapel}` : 'Agent wählen';
    case 'warten': {
      const w = k.warten;
      if (!w) return 'wie lange?';
      if (w.art === 'dauer') {
        if (w.tage === 0 && w.stunden) return `${w.stunden} h${w.arbeitszeit ? ' Arbeitszeit' : ''}`;
        return `${w.tage} ${w.tage === 1 ? 'Tag' : 'Tage'}${w.stunden ? ` ${w.stunden} h` : ''}${w.arbeitszeit ? ' Arbeitszeit' : ''}`;
      }
      const hoechstens = w.art === 'ereignis' && w.hoechstensStunden ? `${w.hoechstensStunden} h` : `${w.hoechstensTage} T.`;
      if (w.art === 'datum') return kurz(`bis ${DATUMS_FELDER.find(x => x.id === w.feld)?.titel ?? 'Datum'} · höchstens ${hoechstens}`);
      return kurz(`auf „${istEreignisArt(w.ereignis) ? EREIGNIS_NAME[w.ereignis] : w.ereignis}“ · höchstens ${hoechstens}`);
    }
    case 'entscheidung': return !k.raute ? 'Mensch entscheidet' : k.raute.art === 'regel' ? 'nach Regel' : k.raute.art === 'score' ? 'nach Score' : 'Modell entscheidet';
    case 'ende': return k.ende?.ergebnis === 'abbruch' ? 'Abbruch' : k.ende?.ergebnis === 'uebergabe' ? 'Übergabe' : 'Ziel erreicht';
    case 'freigabe': return k.schloss ? 'Freigabe · nicht entfernbar' : 'Freigabe im Stapel';
    default: {
      // Mail mit Betreff (gekürzt) — die Einstellung, nicht der Baustein; ohne Betreff wie bisher.
      const betreff = e?.id === 'inbox.mail-entwurf' && typeof k.katalog?.werte?.betreff === 'string' ? k.katalog.werte.betreff.trim() : '';
      if (betreff) return `„${kurz(betreff, 28)}“${stapel}`;
      return `${e ? (e.name !== k.titel ? e.name : e.anbindung) : formWort(k.form)}${stapel}`;
    }
  }
}
/** Kürzen an einer Wortgrenze (Kurzzeile am Knoten). */
function kurz(t: string, max = 42): string {
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max - 1);
  const wort = schnitt.lastIndexOf(' ');
  return `${(wort > max * 0.6 ? schnitt.slice(0, wort) : schnitt).trimEnd()}…`;
}
function ausloeserKurz(a: Ausloeser): string {
  switch (a.art) {
    case 'hand': return 'von Hand';
    case 'zeitplan': return zeitplanKurz(a);
    case 'datum': {
      const d = DATUMS_FELDER.find(x => x.id === a.feld)?.titel ?? 'Datum am Fall';
      const t = Math.abs(a.versatzTage);
      return kurz(a.versatzTage === 0 ? `am Tag: ${d}` : `${t} ${a.werktage ? 'WT' : 'T.'} ${a.versatzTage < 0 ? 'vor' : 'nach'} ${d}`);
    }
    case 'webhook': return 'Webhook';
    case 'loop': return `nach ${LOOP_NAME[a.loop]}`;
    case 'person': return `je Person ab ${a.uhrzeit}`;
    case 'ereignis': return kurz(`${istEreignisArt(a.ereignis) ? EREIGNIS_NAME[a.ereignis] : 'Ereignis'}${a.bedingungen?.length ? ' · nur wenn …' : ''}`);
  }
}
