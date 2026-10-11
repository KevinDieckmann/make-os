// ─── Fulfillment · Analyse — Ausgabe eines Agenten säubern (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.3 Schritt 4) — rein ────────────────────────
// `ausgabePruefen(agent, roh, kontext)` macht aus dem JSON des Modells einen ENTWURF, der erst per Klick ins Dossier kommt:
//   · unbekannte Abschnitte und Felder fallen weg (gezählt)
//   · eine Aussage ohne gültige Quelle (URL, die in DIESEM Lauf gelesen bzw. gefunden wurde, oder eine freigegebene Unterlage) wandert nach
//     „Offene Fragen“ [FT §9.1.1] — erfundene Adressen zählen nicht als Beleg
//   · URLs nur http(s), nie aus `GESPERRTE_DOMAINS`
//   · Texte über den Grenzen werden abgeschnitten UND markiert (`gekuerzt` — Ausnahme vom „nie kürzen“: Modell-Ausgabe, kein Bestand)
//   · Negativliste: Treffer fallen weg, vermerkt wird nur die KATEGORIE (`ausgelassen`); Namen aus Personenkarten im Unternehmensteil → Funktion
//   · Personen-Agent (A4): eine Karte je Lauf, Funktion = die gewählte, Identität „niedrig“ → verworfen [FT §9.1.4]
// Rein und client-sicher; Kennungen kommen vom Aufrufer (`kennung`), damit Tests deterministisch sind.

import type { AbschnittId, AnalyseAgentId, Aussage, Dossier, Massnahme, PersonenKarte, Quelle } from '../typen';
import { ABSCHNITT_IDS } from '../lesen';
import { TEXT_MAX } from '../grenzen';
import { AGENTEN } from './agenten';
import { hostVon, domainVon, istGesperrt, urlNormal } from './quellen';
import { negativTreffer } from './dsgvo';
import { namenErsetzen, OHNE_QUELLE, type Befund } from './pruefen';

type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Felder des Steckbriefs, die in die CRM-Firmenakte übernommen werden können (nur per Klick). */
export const STECKBRIEF_FELDER = ['domain', 'webseite', 'branche', 'mitarbeiter', 'stadt', 'gegruendet', 'rechtsform'] as const;
export type SteckbriefFeld = (typeof STECKBRIEF_FELDER)[number];
export const STECKBRIEF_LABEL: Readonly<Record<SteckbriefFeld, string>> = {
  domain: 'Domain', webseite: 'Webseite', branche: 'Branche', mitarbeiter: 'Mitarbeiter', stadt: 'Stadt', gegruendet: 'Gegründet', rechtsform: 'Rechtsform',
};

/** Höchstwerte der Ausgabe (darüber sichtbar gekürzt bzw. weggelassen und gezählt). */
export const AUSGABE_MAX = { aussagenJeAbschnitt: 40, quellen: 60, offeneFragen: 20, angabenJeListe: 20, befunde: 40, top5: 5, quickWins: 3, fragen: 15, feld: 200 } as const;

export interface KartenEntwurf {
  funktion: string; name: string; rolleSeit?: string; identitaet: PersonenKarte['identitaet'];
  werdegang: Aussage[]; themen: Aussage[]; auftritte: Aussage[]; aufhaenger: Aussage[]; quellen: Quelle[]; ausgelassen: string[];
}

export interface AnalyseErgebnis {
  abschnitte: Partial<Record<AbschnittId, Aussage[]>>;
  quellen: Quelle[];
  steckbrief?: Partial<Record<SteckbriefFeld, { wert: string; quelle: string }>>;
  karte?: KartenEntwurf;
  diagnose?: NonNullable<Dossier['diagnose']>;
  befunde?: Befund[];
  zaehler: { verworfen: number; ohneQuelle: number; gesperrt: number; gekuerzt: number; negativ: number; namen: number };
  /** Kategorien der Negativliste, die ausgelassen wurden (nie der Wortlaut). */
  ausgelassen: string[];
}

export interface AusgabeKontext {
  heute: string;
  /** Adressen, die in diesem Lauf gelesen (`web_lesen`) bzw. im Such-Schritt gefunden wurden, und Quellen, die das Dossier schon hat. */
  belegbareUrls: ReadonlySet<string>;
  /** Kennungen freigegebener Unterlagen dieses Mandats. */
  unterlagen: ReadonlySet<string>;
  /** Personenkarten dieses Mandats (Namen → Funktion im Unternehmensteil; gültige Verweise `pp-…`). */
  karten: readonly Pick<PersonenKarte, 'id' | 'name' | 'funktion'>[];
  /** Funktion des A4-Laufs. */
  funktion?: string;
  kennung: (praefix: 'da' | 'dq') => string;
}

const ARTEN = ['fakt', 'schaetzung', 'hypothese'] as const;
const HEBEL = ['zufluss', 'umwandlung', 'zyklus', 'dealwert', 'bindung'] as const;
const AUFWAND = ['klein', 'mittel', 'gross'] as const;
const EVIDENZ = ['A', 'B', 'C'] as const;
const AN = ['gruender', 'entscheider', 'vertrieb'] as const;
const wahl = <T extends string>(v: unknown, l: readonly T[]): T | undefined => (typeof v === 'string' && (l as readonly string[]).includes(v) ? (v as T) : undefined);

/** Text begrenzen: zu lang → abgeschnitten und markiert. */
function begrenzt(t: string, max: number): { text: string; gekuerzt: boolean } {
  return t.length > max ? { text: `${t.slice(0, max - 1)}…`, gekuerzt: true } : { text: t, gekuerzt: false };
}

/** Die Ausgabe eines Agenten säubern (rein). `roh` = das geparste JSON der letzten Runde (oder null). */
export function ausgabePruefen(agent: AnalyseAgentId, roh: unknown, k: AusgabeKontext): AnalyseErgebnis {
  const def = AGENTEN[agent];
  const o = obj(roh) ?? {};
  const z: AnalyseErgebnis['zaehler'] = { verworfen: 0, ohneQuelle: 0, gesperrt: 0, gekuerzt: 0, negativ: 0, namen: 0 };
  const ausgelassen = new Set<string>();

  // ── Quellen: Verweis „ref“ → neue Kennung; nur belegbare URLs bzw. freigegebene Unterlagen ──
  const quellen: Quelle[] = [];
  const ref = new Map<string, string>();
  for (const q of liste(o.quellen).slice(0, AUSGABE_MAX.quellen)) {
    const x = obj(q);
    const r = text(x?.ref) || text(x?.id);
    if (!x || !r) { z.verworfen++; continue; }
    const url = text(x.url), unterlage = text(x.unterlage) || text(x.unterlageId);
    const titel = text(x.titel).slice(0, TEXT_MAX.titel) || undefined;
    if (url) {
      const n = urlNormal(url);
      if (!n) { z.verworfen++; continue; }
      if (istGesperrt(n)) { z.gesperrt++; continue; }
      if (!k.belegbareUrls.has(n)) { z.verworfen++; continue; }
      const id = k.kennung('dq');
      quellen.push({ id, url: n, ...(titel ? { titel } : {}), domain: domainVon(n) ?? undefined, abgerufenAm: k.heute } as Quelle);
      ref.set(r, id);
    } else if (unterlage && k.unterlagen.has(unterlage)) {
      const id = k.kennung('dq');
      quellen.push({ id, unterlageId: unterlage, ...(titel ? { titel } : {}), abgerufenAm: k.heute });
      ref.set(r, id);
    } else z.verworfen++;
  }
  const karteIds = new Set(k.karten.map(x => x.id));

  /** Eine Aussage säubern — null = verworfen (gezählt). `ort` steuert Negativliste und Namen. */
  const aussage = (roh: unknown, ort: 'unternehmen' | 'person'): Aussage | null => {
    const x = obj(roh);
    const t0 = text(x?.text) || (typeof roh === 'string' ? roh.trim() : '');
    if (!t0) { z.verworfen++; return null; }
    const personRef = typeof x?.person === 'string' && karteIds.has(x.person) ? x.person : undefined;
    const neg = negativTreffer(t0, ort, !!personRef);
    if (neg) { z.negativ++; ausgelassen.add(neg); return null; }
    let t1 = t0;
    if (ort === 'unternehmen') { const n = namenErsetzen(t0, k.karten); if (n.ersetzt) { z.namen += n.ersetzt; t1 = n.text; } }
    const b = begrenzt(t1, TEXT_MAX.aussage);
    if (b.gekuerzt) z.gekuerzt++;
    const qs = liste(x?.quellen).map(q => ref.get(String(q))).filter((q): q is string => !!q);
    return {
      id: k.kennung('da'), text: b.text, art: wahl(x?.art, ARTEN) ?? 'hypothese', quellen: [...new Set(qs)], stand: k.heute, agent,
      ...(personRef ? { personRef } : {}), ...(b.gekuerzt ? { gekuerzt: true as const } : {}),
    };
  };

  // ── Abschnitte ──
  const erlaubt = new Set<AbschnittId>([...def.abschnitte, 'fragen']);
  const abschnitte: AnalyseErgebnis['abschnitte'] = {};
  const dazu = (id: AbschnittId, a: Aussage) => { (abschnitte[id] ??= []).push(a); };
  for (const [key, wert] of Object.entries(obj(o.abschnitte) ?? {})) {
    const id = wahl(key, ABSCHNITT_IDS);
    if (!id || !erlaubt.has(id) || id === 'recht') { z.verworfen += liste(wert).length || 1; continue; }
    for (const r of liste(wert).slice(0, AUSGABE_MAX.aussagenJeAbschnitt)) {
      const a = aussage(r, 'unternehmen');
      if (!a) continue;
      if (!OHNE_QUELLE.includes(id) && !a.quellen.length) { z.ohneQuelle++; dazu('fragen', { ...a, art: 'hypothese', text: begrenzt(`Ohne Beleg: ${a.text}`, TEXT_MAX.aussage).text }); continue; }
      dazu(id, a);
    }
    if (liste(wert).length > AUSGABE_MAX.aussagenJeAbschnitt) z.verworfen += liste(wert).length - AUSGABE_MAX.aussagenJeAbschnitt;
  }
  for (const f of liste(o.offeneFragen).slice(0, AUSGABE_MAX.offeneFragen)) {
    const a = aussage(typeof f === 'string' ? { text: f, art: 'hypothese' } : f, 'unternehmen');
    if (a) dazu('fragen', { ...a, art: 'hypothese' });
  }

  const ergebnis: AnalyseErgebnis = { abschnitte, quellen, zaehler: z, ausgelassen: [] };

  // ── A1: Steckbrief-Felder (nur belegt) ──
  if (agent === 'a1') {
    const s = obj(o.steckbrief) ?? {};
    const sb: NonNullable<AnalyseErgebnis['steckbrief']> = {};
    for (const f of STECKBRIEF_FELDER) {
      const x = obj(s[f]);
      const wert = text(x?.wert ?? (typeof s[f] === 'string' ? s[f] : '')), q = ref.get(text(x?.quelle));
      if (!wert) continue;
      if (!q) { z.ohneQuelle++; continue; }
      if (negativTreffer(wert, 'unternehmen')) { z.negativ++; continue; }
      const w = f === 'webseite' ? (urlNormal(wert) ?? '') : f === 'domain' ? (hostVon(wert.includes('://') ? wert : `https://${wert}`)?.replace(/^www\./, '') ?? '') : wert.slice(0, AUSGABE_MAX.feld);
      if (w) sb[f] = { wert: w, quelle: q };
    }
    if (Object.keys(sb).length) ergebnis.steckbrief = sb;
  }

  // ── A4: eine berufliche Personenkarte ──
  if (agent === 'a4') {
    const p = obj(liste(o.personen)[0]) ?? obj(o.person);
    const name = text(p?.name).slice(0, TEXT_MAX.titel);
    const identitaet = wahl(p?.identitaet, ['hoch', 'mittel', 'niedrig'] as const) ?? 'niedrig';
    if (p && name && identitaet !== 'niedrig' && !negativTreffer(name, 'person')) {
      const teil = (v: unknown) => liste(v).slice(0, AUSGABE_MAX.angabenJeListe).map(x => aussage(x, 'person')).filter((x): x is Aussage => !!x && x.quellen.length > 0);
      const roh = { werdegang: teil(p.werdegang), themen: teil(p.themen), auftritte: teil(p.auftritte), aufhaenger: teil(p.aufhaenger) };
      const benutzt = new Set(Object.values(roh).flat().flatMap(a => a.quellen));
      const rolleSeit = text(p.rolleSeit).slice(0, 40);
      ergebnis.karte = {
        funktion: (k.funktion ?? text(p.funktion)).slice(0, TEXT_MAX.titel), name, identitaet, ...roh,
        ...(rolleSeit && !negativTreffer(rolleSeit, 'person') ? { rolleSeit } : {}),
        quellen: quellen.filter(q => benutzt.has(q.id)), ausgelassen: [],
      };
    } else if (p) { z.verworfen++; if (identitaet === 'niedrig') ausgelassen.add('Identität unsicher'); }
    // Aussagen des Personen-Agenten gehören nie in den Unternehmensteil.
    ergebnis.abschnitte = {};
    ergebnis.quellen = ergebnis.karte?.quellen ?? [];
  }

  // ── A12: Diagnose-Entwurf ──
  if (agent === 'a12') {
    const d = obj(o.diagnose) ?? {};
    let i = 0;
    const top5: Massnahme[] = liste(d.top5).slice(0, AUSGABE_MAX.top5).flatMap(m => {
      const x = obj(m); const t = text(x?.text);
      const hebel = wahl(x?.hebel, HEBEL), aufwand = wahl(x?.aufwand, AUFWAND), evidenz = wahl(x?.evidenz, EVIDENZ);
      if (!x || !t || !hebel || !aufwand || !evidenz || negativTreffer(t, 'unternehmen')) { z.verworfen++; return []; }
      i++;
      return [{ id: `m${i}`, text: begrenzt(namenErsetzen(t, k.karten).text, TEXT_MAX.ziel).text, hebel, wirkung: text(x.wirkung).slice(0, TEXT_MAX.kurz), aufwand, evidenz, ...(text(x.abhaengig) ? { abhaengig: text(x.abhaengig).slice(0, TEXT_MAX.kurz) } : {}) }];
    });
    const quickWins = liste(d.quickWins).slice(0, AUSGABE_MAX.quickWins).map(q => text(obj(q)?.text ?? q)).filter(t => t && !negativTreffer(t, 'unternehmen')).map(t => begrenzt(namenErsetzen(t, k.karten).text, TEXT_MAX.kurz).text);
    const fragen = liste(d.fragen).slice(0, AUSGABE_MAX.fragen).flatMap(f => {
      const x = obj(f); const fr = text(x?.frage), an = wahl(x?.an, AN);
      if (!fr || !an || negativTreffer(fr, 'unternehmen')) { z.verworfen++; return []; }
      return [{ frage: begrenzt(namenErsetzen(fr, k.karten).text, TEXT_MAX.frage).text, an, warum: text(x?.warum).slice(0, TEXT_MAX.kurz) }];
    });
    if (top5.length || quickWins.length || fragen.length) ergebnis.diagnose = { top5, quickWins, fragen };
  }

  // ── A13: Befunde (nur Hinweise; ändern nichts) ──
  if (agent === 'a13') {
    ergebnis.befunde = liste(o.befunde).slice(0, AUSGABE_MAX.befunde).flatMap(b => {
      const x = obj(b); const art = wahl(x?.art, ['qualitaet', 'quelle', 'dsgvo'] as const); const t = text(x?.text).slice(0, TEXT_MAX.notiz);
      if (!art || !t) { z.verworfen++; return []; }
      const bezug = text(x?.bezug);
      return [{ art, text: namenErsetzen(t, k.karten).text, ...(/^(da|dq|pp)-[a-z0-9-]{1,100}$/.test(bezug) ? { bezug } : {}) }];
    });
    ergebnis.abschnitte = {};
    ergebnis.quellen = [];
  }

  // Nur Quellen behalten, auf die etwas verweist (Abschnitte, Steckbrief).
  if (agent !== 'a4') {
    const benutzt = new Set([...Object.values(ergebnis.abschnitte).flat().flatMap(a => a!.quellen), ...Object.values(ergebnis.steckbrief ?? {}).map(s => s!.quelle)]);
    ergebnis.quellen = ergebnis.quellen.filter(q => benutzt.has(q.id));
  }
  ergebnis.ausgelassen = [...ausgelassen];
  return ergebnis;
}

/** Zahl der Aussagen eines Entwurfs je Abschnitt (für die Häkchen „übernehmen“). */
export const entwurfZaehler = (e: Pick<AnalyseErgebnis, 'abschnitte'>): Partial<Record<AbschnittId, number>> =>
  Object.fromEntries(Object.entries(e.abschnitte).map(([k, v]) => [k, v?.length ?? 0])) as Partial<Record<AbschnittId, number>>;

/** Ist das ein gespeicherter Entwurf (für Leser aus dem Bestand)? */
export function alsErgebnis(v: unknown): AnalyseErgebnis | null {
  const o = obj(v);
  return o && obj(o.abschnitte) && Array.isArray(o.quellen) && obj(o.zaehler) ? (o as unknown as AnalyseErgebnis) : null;
}
