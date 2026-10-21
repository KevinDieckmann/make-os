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
import { katalogEintrag, maskeSaeubern, maskeVorgaben, type KatalogEintrag, type MaskenKontext } from './baustein-katalog';
import { modellSchluessel, stufeVorgabe, type ModellOption } from './modell-wahl';

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
  if (!e.feld) return { ...(k.katalog?.werte ?? {}) };
  // Noch ohne Feld (das Nötigste fehlt): die bisher eingegebenen Werte stehen solange in `katalog.werte` — nichts geht verloren.
  if (k[e.feld] === undefined) return { ...(k.katalog?.werte ?? {}) };
  switch (e.feld) {
    case 'ausloeser': {
      const a = k.ausloeser;
      if (!a) return {};
      if (a.art === 'ereignis') return ohneLeere({ ereignis: a.ereignis, bedingungen: a.bedingungen ?? [], verknuepfung: a.verknuepfung });
      if (a.art === 'zeitplan') return ohneLeere({ rhythmus: a.rhythmus, uhrzeit: a.uhrzeit, tage: a.tage ?? [] });
      if (a.art === 'datum') return ohneLeere({ feld: a.feld, versatzTage: a.versatzTage, werktage: a.werktage ?? false, uhrzeit: a.uhrzeit });
      if (a.art === 'webhook') return ohneLeere({ felder: a.felder, bedingungen: a.bedingungen ?? [], verknuepfung: a.verknuepfung });
      if (a.art === 'loop') return { loop: a.loop };
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
      if (w.art === 'dauer') return ohneLeere({ tage: w.tage, stunden: w.stunden });
      if (w.art === 'datum') return ohneLeere({ feld: w.feld, versatzTage: w.versatzTage, hoechstensTage: w.hoechstensTage || undefined });
      return ohneLeere({ ereignis: w.ereignis, bedingungen: w.bedingungen ?? [], verknuepfung: w.verknuepfung, hoechstensTage: w.hoechstensTage || undefined });
    }
    case 'schleife': return k.schleife ? ohneLeere({ liste: k.schleife.liste, prozessId: k.schleife.prozessId, hoechstens: k.schleife.hoechstens || undefined }) : {};
    case 'teilprozess': return k.teilprozess ? ohneLeere({ prozessId: k.teilprozess.prozessId, warten: k.teilprozess.warten }) : {};
    case 'ende': return k.ende?.uebergabeAn ? { uebergabeAn: k.ende.uebergabeAn } : {};
    case 'abfrage': {
      const q = k.abfrage;
      return q ? ohneLeere({ art: q.art, status: q.status, temperatur: q.temperatur, bean: q.bean, lifecycle: q.lifecycle, tage: q.tage, hoechstens: q.hoechstens || undefined }) : {};
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
      else if (e.id === 'ausloeser.datum') a = text(w.feld) && zahl(w.versatzTage) !== undefined ? sauber<Ausloeser>({ art: 'datum', feld: w.feld, versatzTage: zahl(w.versatzTage), werktage: w.werktage === true ? true : undefined, uhrzeit: text(w.uhrzeit) || undefined }) : undefined;
      else if (e.id === 'ausloeser.webhook') a = sauber<Ausloeser>({ art: 'webhook', felder: liste<WebhookFeld>(w.felder), bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung) });
      else if (e.id === 'ausloeser.loop') a = text(w.loop) ? { art: 'loop', loop: w.loop as 'morgen' } : undefined;
      return { ausloeser: a };
    }
    case 'agent': {
      const wer = agentWer(e, w, alt.agent?.wer);
      // Head bzw. Skill noch nicht gewählt: noch kein Agenten-Schritt (sonst wäre der Entwurf nicht speicherbar) — die Werte warten in `katalog.werte`.
      if ((wer.art === 'head' && !wer.headId) || (wer.art === 'skill' && !wer.skillId)) return { agent: undefined };
      const vorschlag = e.agentFest?.ergebnis === 'vorschlag' || alt.agent?.ergebnis === 'vorschlag';
      const vf = texte(w.vorschlagFelder);
      const a: AgentSchritt = sauber<AgentSchritt>({
        wer, auftrag: text(w.auftrag), modell: stufe(w.modell, stufeVorgabe(wer)), modellWahl: modellWahlVon(w.modellWahl, kx),
        budgetCent: zahl(w.budgetCent) ?? 0, gedaechtnis: { brain: w.brain === true, akte: w.akte !== false },
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
      if (e.id === 'warten.dauer') x = sauber<WartenRegel>({ art: 'dauer', tage: zahl(w.tage) ?? 0, stunden: zahl(w.stunden) });
      else if (e.id === 'warten.datum') x = text(w.feld) ? sauber<WartenRegel>({ art: 'datum', feld: w.feld, versatzTage: zahl(w.versatzTage), hoechstensTage: zahl(w.hoechstensTage) ?? 0 }) : undefined;
      else if (e.id === 'warten.ereignis') x = text(w.ereignis) ? sauber<WartenRegel>({ art: 'ereignis', ereignis: w.ereignis, bedingungen: bedingungen(w.bedingungen).length ? bedingungen(w.bedingungen) : undefined, verknuepfung: verkn(w.verknuepfung), hoechstensTage: zahl(w.hoechstensTage) ?? 0 }) : undefined;
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
      return { abfrage: text(w.art) ? sauber<CrmAbfrage>({ art: w.art, status: l(w.status), temperatur: l(w.temperatur), bean: l(w.bean), lifecycle: l(w.lifecycle), tage: zahl(w.tage), hoechstens: zahl(w.hoechstens) ?? 0 }) : undefined };
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
    for (const [f, v] of Object.entries(teil)) { if (v === undefined) delete (n as O)[f]; else (n as O)[f] = v; }
    // Fehlt das Nötigste noch, warten die einfachen Werte (Text, Zahl, ja/nein, Auswahl) in `katalog.werte` — beim nächsten Wert entsteht das Feld.
    if (n[e.feld] === undefined) {
      const w: W = {};
      for (const f of e.maske) { const v = werte[f.id]; if (!leer(v) && (typeof v !== 'object' || (Array.isArray(v) && v.every(x => typeof x === 'string' || typeof x === 'number')))) w[f.id] = v; }
      if (Object.keys(w).length) n.katalog = { id: e.id, werte: w };
    }
    return n;
  }
  const w: W = {};
  for (const f of e.maske) { const v = werte[f.id]; if (!leer(v)) w[f.id] = v; }
  return { ...k, katalog: Object.keys(w).length ? { id: e.id, werte: w } : { id: e.id } };
}

/** Ein neuer Knoten aus dem Katalog (rein): Form, Bahn, Name, Vorgaben der Maske. Agenten mit festem Agenten bekommen ihn gleich. */
export function neuerKnoten(e: KatalogEintrag, id: string, titel?: string): K {
  const k: K = { id, titel: titel?.trim() || e.name, rang: 0, form: e.form, bahn: e.bahn, katalog: { id: e.id } };
  return maskeAnwenden(k, e, maskeVorgaben(e));
}

/** Die Befunde der Maske eines Knotens (nur die Felder ohne eigenes Feld — die mit eigenem Feld prüft die Regel ihres Felds, lib/prozesse/definition-pruefen.ts). */
export function maskeBefunde(k: K, kx: MaskenKontext = {}): Befund[] {
  const e = katalogEintrag(k.katalog?.id);
  return e && !e.feld ? maskeSaeubern(e, k.katalog?.werte, kx, k.id).befunde : [];
}

/** Die Formauswahl (Punkt 17): Bausteine einer Form zuerst, dann der Rest — gefiltert nach Suchtext (Name, Satz, Anbindung). Auslöser nur am Anfang. */
export function formauswahl(katalog: readonly KatalogEintrag[], o: { suche?: string; form?: ProzessForm; ohneAusloeser?: boolean } = {}): KatalogEintrag[] {
  const q = (o.suche ?? '').normalize('NFC').trim().toLowerCase();
  const passt = (e: KatalogEintrag) => !q || `${e.name} ${e.satz} ${e.anbindung}`.normalize('NFC').toLowerCase().includes(q);
  return katalog.filter(e => !(o.ohneAusloeser && e.form === 'ausloeser') && passt(e))
    .sort((a, b) => Number(b.form === o.form) - Number(a.form === o.form));
}
