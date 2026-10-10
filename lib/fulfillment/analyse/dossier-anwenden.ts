// ─── Fulfillment · Analyse — Änderungen am Dossier (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.4/4.6/8.4) — rein ─────────────────────────────────
// EIN Schritt je Aufruf auf der Datei `fulfillment-dossiers--<h>` (Schreibstelle lib/fulfillment/speicher.ts `fulfillmentAendern`):
//   anlegen · eingaben · lia · f1 · uebernehmen (Entwurf eines Laufs → Abschnitte, nur die angehakten) · verwerfen · pruefung (vom Server
//   gerechnet) · ueberstimmen (nur Qualität, mit Grund) · f2 (nur mit bestandener Prüfung) · aussage-hand · aussage-entfernen
//   und die Lauf-Schritte des Servers (lauf-start, lauf-ende, lauf-abbrechen, leseteil).
// Regeln: Schritte einer Person tragen den Stand des Dossiers (`stand`, Fingerabdruck) → fremder Stand 409. Jede inhaltliche Änderung nach F2 nimmt
// F2 und die Prüfung zurück (erneut prüfen). Unsinn 400, Textgrenzen 413 (Listen-Grenzen prüft die Schreibstelle). Rein und client-sicher.

import type { AbschnittId, AnalyseAgentId, AnalyseLauf, Aussage, Dossier, DossierDatei, Quelle, AnwendenErgebnis } from '../typen';
import { ABSCHNITT_IDS, ANALYSE_AGENTEN } from '../lesen';
import { TEXT_MAX, textZuLang } from '../grenzen';
import { domainSaeubern, istGesperrt, urlNormal, domainVon } from './quellen';
import { LIA_FELDER, LIA_MAX } from './dsgvo';
import { alsErgebnis } from './ausgabe';
import { OHNE_QUELLE, pruefungBestanden } from './pruefen';
import { AGENTEN, GRUND_MAX } from './agenten';

export interface DossierEingaben { firma: string; domains: string[]; registerNr?: string; sitz?: string; branche?: string; urls: string[] }

export type DossierOp =
  | { op: 'anlegen'; mandatId: string; firmaId?: string; eingaben: DossierEingaben }
  | { op: 'eingaben'; mandatId: string; stand: string; eingaben: Partial<DossierEingaben> }
  | { op: 'lia'; mandatId: string; stand: string; zweck: string; erforderlichkeit: string; abwaegung: string; schutz: string }
  | { op: 'f1'; mandatId: string; stand: string; umfang: AnalyseAgentId[]; funktionen: string[]; kundeBestaetigtAm?: string; wie?: 'kickoff' | 'mail' }
  | { op: 'uebernehmen'; mandatId: string; stand: string; laufId: string; abschnitte: (AbschnittId | 'diagnose' | 'befunde')[] }
  | { op: 'verwerfen'; mandatId: string; stand: string; laufId: string }
  | { op: 'pruefung'; mandatId: string; pruefung: NonNullable<Dossier['pruefung']>; veraltet: string[] }
  | { op: 'ueberstimmen'; mandatId: string; stand: string; index: number; grund: string }
  | { op: 'f2'; mandatId: string; stand: string }
  | { op: 'aussage-hand'; mandatId: string; stand: string; abschnitt: AbschnittId; text: string; art: Aussage['art']; url?: string; unterlageId?: string; titel?: string }
  | { op: 'aussage-entfernen'; mandatId: string; stand: string; abschnitt: AbschnittId; id: string }
  | { op: 'lauf-start'; mandatId: string; lauf: AnalyseLauf; verwaistVor: string }
  | { op: 'lauf-ende'; mandatId: string; laufId: string; status: 'fertig' | 'fehler' | 'uebernommen'; kostenCent: number; ergebnis?: unknown; fehler?: string }
  | { op: 'lauf-abbrechen'; mandatId: string; laufId: string; grund: string }
  | { op: 'leseteil'; mandatId: string; leseteil: NonNullable<Dossier['leseteil']> }
  | { op: 'geruest'; mandatId: string };

export interface DossierKontext {
  person: string;
  /** ISO-Zeit „jetzt“ (Server). */
  jetzt: string;
  heute: string;
  /** Stand (Fingerabdruck) eines Dossiers — von der Schreibstelle (`eintragStand`). */
  standVon: (d: Dossier) => string;
  kennung: (praefix: 'da' | 'dq') => string;
}

type E = AnwendenErgebnis<DossierDatei>;
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): E => ({ ok: false, status, fehler });
const istText = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Eingaben säubern (rein) — Domains ohne Schema/`www.`, URLs nur http(s) und nicht gesperrt. Fehler als Satz. */
export function eingabenSaeubern(e: Partial<DossierEingaben>, alt?: DossierEingaben): { ok: true; eingaben: DossierEingaben } | { ok: false; status: 400 | 413; fehler: string } {
  const firma = typeof e.firma === 'string' ? e.firma.trim() : alt?.firma ?? '';
  if (!firma) return { ok: false, status: 400, fehler: 'Firma fehlt.' };
  const lang = textZuLang('titel', firma, 'Firma') ?? textZuLang('titel', e.sitz, 'Sitz') ?? textZuLang('titel', e.branche, 'Branche') ?? textZuLang('titel', e.registerNr, 'Registernummer');
  if (lang) return { ok: false, status: 413, fehler: lang };
  const domainsRoh = Array.isArray(e.domains) ? e.domains : alt?.domains ?? [];
  if (domainsRoh.length > 5) return { ok: false, status: 413, fehler: 'Höchstens 5 Domains.' };
  const domains: string[] = [];
  for (const d of domainsRoh) {
    const s = typeof d === 'string' ? domainSaeubern(d) : null;
    if (!s) return { ok: false, status: 400, fehler: `Keine gültige Domain: „${String(d).slice(0, 60)}“.` };
    if (istGesperrt(s)) return { ok: false, status: 400, fehler: `Diese Domain liest kein Agent (${s}).` };
    if (!domains.includes(s)) domains.push(s);
  }
  const urlsRoh = Array.isArray(e.urls) ? e.urls : alt?.urls ?? [];
  if (urlsRoh.length > 10) return { ok: false, status: 413, fehler: 'Höchstens 10 Adressen.' };
  const urls: string[] = [];
  for (const u of urlsRoh) {
    const n = typeof u === 'string' ? urlNormal(u.trim()) : null;
    if (!n) return { ok: false, status: 400, fehler: `Keine gültige Adresse: „${String(u).slice(0, 60)}“.` };
    if (istGesperrt(n)) return { ok: false, status: 400, fehler: `Diese Adresse liest kein Agent (${domainVon(n)}).` };
    if (!urls.includes(n)) urls.push(n);
  }
  const opt = (k: 'registerNr' | 'sitz' | 'branche') => { const v = k in e ? e[k] : alt?.[k]; return typeof v === 'string' && v.trim() ? v.trim() : undefined; };
  return { ok: true, eingaben: { firma, domains, urls, ...(opt('registerNr') ? { registerNr: opt('registerNr') } : {}), ...(opt('sitz') ? { sitz: opt('sitz') } : {}), ...(opt('branche') ? { branche: opt('branche') } : {}) } };
}

/** Inhalt geändert → F2 und Prüfung zurück, geänderte Abschnitte wieder „Entwurf“. */
function inhaltGeaendert(d: Dossier): Dossier {
  const { f2: _f2, pruefung: _p, ...rest } = d;
  const abschnitte = Object.fromEntries(Object.entries(d.abschnitte).map(([k, a]) => [k, a && a.status === 'geprueft' ? { ...a, status: 'entwurf' as const } : a])) as Dossier['abschnitte'];
  return { ...rest, abschnitte };
}

const leererAbschnitt = (id: AbschnittId) => ({ id, aussagen: [] as Aussage[], status: 'leer' as const });

/** Einen Schritt anwenden (rein). */
export function dossierAnwenden(datei: DossierDatei, op: DossierOp, k: DossierKontext): E {
  const m = op.mandatId;
  const vorhanden = datei.dossiers[m];
  const mit = (d: Dossier): E => ({ ok: true, datei: { ...datei, dossiers: { ...datei.dossiers, [m]: { ...d, geaendert: k.jetzt, geaendertVon: k.person } } }, geaendert: [m] });

  if (op.op === 'anlegen') {
    if (vorhanden) return nein(409, 'Für dieses Mandat gibt es schon ein Dossier.');
    const e = eingabenSaeubern(op.eingaben);
    if (!e.ok) return nein(e.status, e.fehler);
    return mit({ mandatId: m, ...(op.firmaId ? { firmaId: op.firmaId } : {}), version: 1, eingaben: e.eingaben, abschnitte: {}, quellen: [], laeufe: [], geaendert: k.jetzt, geaendertVon: k.person });
  }
  if (!vorhanden) return nein(404, 'Für dieses Mandat gibt es noch kein Dossier.');
  const d = vorhanden;
  if ('stand' in op && op.stand !== k.standVon(d)) return { ok: false, status: 409, fehler: 'Inzwischen hat jemand das Dossier geändert — neu geladen, bitte noch einmal.', konflikte: [{ id: m, stand: k.standVon(d) }] };

  switch (op.op) {
    case 'eingaben': {
      const e = eingabenSaeubern(op.eingaben, d.eingaben);
      return e.ok ? mit({ ...d, eingaben: e.eingaben }) : nein(e.status, e.fehler);
    }
    case 'lia': {
      for (const f of LIA_FELDER) {
        const v = op[f];
        if (typeof v !== 'string' || !v.trim()) return nein(400, 'Interessenabwägung: alle vier Felder ausfüllen (Zweck, Erforderlichkeit, Abwägung, Schutzmaßnahmen).');
        if (v.length > LIA_MAX) return nein(413, `Interessenabwägung: höchstens ${LIA_MAX} Zeichen je Feld.`);
      }
      return mit({ ...d, interessenabwaegung: { zweck: op.zweck.trim(), erforderlichkeit: op.erforderlichkeit.trim(), abwaegung: op.abwaegung.trim(), schutz: op.schutz.trim(), am: k.jetzt, von: k.person } });
    }
    case 'f1': {
      if (!d.interessenabwaegung) return nein(400, 'Erst die Interessenabwägung eintragen — sie ist Pflicht für F1.');
      const umfang = [...new Set(op.umfang)].filter(a => (ANALYSE_AGENTEN as readonly string[]).includes(a)) as AnalyseAgentId[];
      if (umfang.length !== new Set(op.umfang).size) return nein(400, 'Unbekannter Agent im Umfang.');
      if (!umfang.length) return nein(400, 'F1: mindestens einen Agenten wählen.');
      const funktionen = [...new Set(op.funktionen.map(f => (typeof f === 'string' ? f.trim() : '')).filter(Boolean))];
      if (funktionen.length > 10) return nein(413, 'F1: höchstens 10 Funktionen.');
      if (funktionen.some(f => f.length > TEXT_MAX.titel)) return nein(413, `F1: eine Funktion hat höchstens ${TEXT_MAX.titel} Zeichen.`);
      if (umfang.some(a => AGENTEN[a].personen === 'karten') && !funktionen.length) return nein(400, 'F1: Für die Personenrecherche mindestens eine Funktion nennen (keine Namen).');
      if (op.kundeBestaetigtAm && !/^\d{4}-\d{2}-\d{2}$/.test(op.kundeBestaetigtAm)) return nein(400, 'F1: Datum der Bestätigung als JJJJ-MM-TT.');
      return mit({ ...d, f1: { am: k.jetzt, von: k.person, umfang, funktionen, ...(op.kundeBestaetigtAm ? { kundeBestaetigtAm: op.kundeBestaetigtAm } : {}), ...(op.wie ? { wie: op.wie } : {}) } });
    }
    case 'geruest': {
      const abschnitte = { ...d.abschnitte };
      for (const id of ABSCHNITT_IDS) if (id !== 'recht' && !abschnitte[id]) abschnitte[id] = leererAbschnitt(id);
      return mit({ ...d, abschnitte });
    }
    case 'uebernehmen': {
      const l = d.laeufe.find(x => x.id === op.laufId);
      if (!l) return nein(404, 'Diesen Lauf gibt es nicht.');
      if (l.status !== 'fertig') return nein(409, 'Nur ein fertiger Lauf kann übernommen werden.');
      const e = alsErgebnis(l.ergebnis);
      const ziel = new Set(op.abschnitte);
      let neu: Dossier = { ...d };
      if (e) {
        const abschnitte = { ...neu.abschnitte };
        const genutzt = new Set<string>();
        for (const [id, aussagen] of Object.entries(e.abschnitte) as [AbschnittId, Aussage[]][]) {
          if (!ziel.has(id) || !aussagen?.length) continue;
          const alt = abschnitte[id] ?? leererAbschnitt(id);
          // Ein späterer Lauf desselben Agenten ersetzt seine früheren Aussagen in diesem Abschnitt; Handeinträge bleiben.
          abschnitte[id] = { ...alt, aussagen: [...alt.aussagen.filter(a => a.agent !== l.agent), ...aussagen], status: 'entwurf', stand: k.heute };
          for (const a of aussagen) for (const q of a.quellen) genutzt.add(q);
        }
        const bekannt = new Set(neu.quellen.map(q => q.id));
        neu = { ...neu, abschnitte, quellen: [...neu.quellen, ...e.quellen.filter(q => genutzt.has(q.id) && !bekannt.has(q.id))] };
        if (ziel.has('diagnose') && e.diagnose) neu = { ...neu, diagnose: e.diagnose };
      }
      const laeufe = neu.laeufe.map(x => (x.id === l.id ? { ...x, status: 'uebernommen' as const } : x));
      return mit(inhaltGeaendert({ ...neu, laeufe }));
    }
    case 'verwerfen': {
      const l = d.laeufe.find(x => x.id === op.laufId);
      if (!l) return nein(404, 'Diesen Lauf gibt es nicht.');
      if (l.status === 'laeuft') return nein(409, 'Ein laufender Lauf wird erst abgebrochen.');
      if (l.status === 'uebernommen' || l.status === 'verworfen') return nein(409, 'Dieser Lauf ist schon erledigt.');
      const funktion = (l.ergebnis as { funktion?: unknown } | undefined)?.funktion;
      const laeufe = d.laeufe.map(x => (x.id === l.id ? { ...entwurfOhne(x), status: 'verworfen' as const, ...(typeof funktion === 'string' ? { ergebnis: { funktion } } : {}) } : x));
      return mit({ ...d, laeufe });
    }
    case 'pruefung': {
      const veraltet = new Set(op.veraltet);
      const abschnitte = Object.fromEntries(Object.entries(d.abschnitte).map(([id, a]) => [id, a ? { ...a, aussagen: a.aussagen.map(x => {
        const { veraltet: _v, ...rest } = x;
        return veraltet.has(x.id) ? { ...rest, veraltet: true as const } : rest;
      }) } : a])) as Dossier['abschnitte'];
      return mit({ ...d, abschnitte, pruefung: op.pruefung });
    }
    case 'ueberstimmen': {
      const p = d.pruefung;
      const b = p?.befunde[op.index];
      if (!p || !b) return nein(404, 'Diesen Befund gibt es nicht.');
      if (b.art !== 'qualitaet') return nein(403, b.art === 'dsgvo' ? 'Datenschutz-Befunde werden nie überstimmt — die Angabe muss raus.' : 'Quellen-Befunde werden nicht überstimmt — Quelle ergänzen oder Aussage entfernen.');
      const grund = typeof op.grund === 'string' ? op.grund.trim() : '';
      if (grund.length < 10) return nein(400, 'Bitte einen Grund nennen (mindestens 10 Zeichen).');
      if (grund.length > GRUND_MAX) return nein(413, `Grund: höchstens ${GRUND_MAX} Zeichen.`);
      const befunde = p.befunde.map((x, i) => (i === op.index ? { ...x, ueberstimmt: { von: k.person, grund } } : x));
      return mit({ ...d, pruefung: { ...p, befunde, bestanden: pruefungBestanden(befunde) } });
    }
    case 'f2': {
      if (!d.pruefung) return nein(409, 'Erst prüfen — F2 geht nur mit bestandener Prüfung.');
      if (!d.pruefung.bestanden) return nein(409, 'Die Prüfung ist nicht bestanden: Datenschutz- und Quellen-Befunde müssen behoben, Qualitäts-Befunde behoben oder mit Grund überstimmt sein.');
      const abschnitte = Object.fromEntries(Object.entries(d.abschnitte).map(([id, a]) => [id, a && a.aussagen.length ? { ...a, status: 'geprueft' as const } : a])) as Dossier['abschnitte'];
      return mit({ ...d, abschnitte, f2: { am: k.jetzt, von: k.person } });
    }
    case 'aussage-hand': {
      if (op.abschnitt === 'recht' || !(ABSCHNITT_IDS as readonly string[]).includes(op.abschnitt)) return nein(400, 'Unbekannter Abschnitt.');
      if (!istText(op.text, Number.MAX_SAFE_INTEGER)) return nein(400, 'Text fehlt.');
      const lang = textZuLang('aussage', op.text, 'Aussage') ?? textZuLang('titel', op.titel, 'Titel der Quelle');
      if (lang) return nein(413, lang);
      if (!['fakt', 'schaetzung', 'hypothese'].includes(op.art)) return nein(400, 'Art: Fakt, Schätzung oder Hypothese.');
      let quelle: Quelle | null = null;
      if (op.url) {
        const n = urlNormal(op.url.trim());
        if (!n) return nein(400, 'Keine gültige Adresse (nur http/https).');
        if (istGesperrt(n)) return nein(400, 'Von dieser Domain nehmen wir keine Quelle.');
        quelle = { id: k.kennung('dq'), url: n, domain: domainVon(n) ?? undefined, ...(op.titel?.trim() ? { titel: op.titel.trim() } : {}), abgerufenAm: k.heute } as Quelle;
      } else if (op.unterlageId) {
        if (!/^ud-[a-z0-9][a-z0-9-]{0,99}$/.test(op.unterlageId)) return nein(400, 'Unbekannte Unterlage.');
        quelle = { id: k.kennung('dq'), unterlageId: op.unterlageId, ...(op.titel?.trim() ? { titel: op.titel.trim() } : {}), abgerufenAm: k.heute };
      }
      if (!quelle && !OHNE_QUELLE.includes(op.abschnitt)) return nein(400, 'Eine Aussage braucht eine Quelle (Adresse oder Unterlage) — ohne Quelle gehört sie zu den offenen Fragen.');
      const a: Aussage = { id: k.kennung('da'), text: op.text.trim(), art: op.art, quellen: quelle ? [quelle.id] : [], stand: k.heute, agent: 'hand' };
      const alt = d.abschnitte[op.abschnitt] ?? leererAbschnitt(op.abschnitt);
      return mit(inhaltGeaendert({ ...d, abschnitte: { ...d.abschnitte, [op.abschnitt]: { ...alt, aussagen: [...alt.aussagen, a], status: 'entwurf', stand: k.heute } }, quellen: quelle ? [...d.quellen, quelle] : d.quellen }));
    }
    case 'aussage-entfernen': {
      const alt = d.abschnitte[op.abschnitt];
      if (!alt || !alt.aussagen.some(a => a.id === op.id)) return nein(404, 'Diese Aussage gibt es nicht.');
      const aussagen = alt.aussagen.filter(a => a.id !== op.id);
      const abschnitte = { ...d.abschnitte, [op.abschnitt]: { ...alt, aussagen, status: aussagen.length ? 'entwurf' as const : 'leer' as const } };
      const genutzt = new Set(Object.values(abschnitte).flatMap(a => a?.aussagen.flatMap(x => x.quellen) ?? []));
      return mit(inhaltGeaendert({ ...d, abschnitte, quellen: d.quellen.filter(q => genutzt.has(q.id)) }));
    }
    case 'lauf-start': {
      // Verwaiste Läufe (Pacht abgelaufen) werden hier — in derselben Sperre wie der neue Start — zu „abgebrochen“.
      const laeufe = d.laeufe.map(x => (x.status === 'laeuft' && (!x.laeuftSeit || x.laeuftSeit < op.verwaistVor) ? { ...x, status: 'abgebrochen' as const, fehler: 'Neustart des Servers? Der Lauf hat sich nicht mehr gemeldet.' } : x));
      return mit({ ...d, laeufe: [...laeufe, op.lauf] });
    }
    case 'lauf-ende': {
      const l = d.laeufe.find(x => x.id === op.laufId);
      if (!l) return nein(404, 'Diesen Lauf gibt es nicht.');
      const laeufe = d.laeufe.map(x => {
        if (x.id !== op.laufId) return x;
        const kosten = { kostenCent: Math.round(op.kostenCent * 100) / 100, fertigAm: k.jetzt };
        // Wurde der Lauf inzwischen abgebrochen, bleibt er abgebrochen (die Kosten zählen trotzdem).
        if (x.status !== 'laeuft') return { ...x, ...kosten };
        const { laeuftSeit: _l, ...rest } = x;
        return { ...rest, ...kosten, status: op.status, ...(op.ergebnis !== undefined ? { ergebnis: op.ergebnis } : {}), ...(op.fehler ? { fehler: op.fehler.slice(0, TEXT_MAX.notiz) } : {}) };
      });
      return mit({ ...d, laeufe });
    }
    case 'lauf-abbrechen': {
      const l = d.laeufe.find(x => x.id === op.laufId);
      if (!l) return nein(404, 'Diesen Lauf gibt es nicht.');
      if (l.status !== 'laeuft') return nein(409, 'Dieser Lauf läuft nicht.');
      return mit({ ...d, laeufe: d.laeufe.map(x => (x.id === op.laufId ? { ...x, status: 'abgebrochen' as const, fehler: op.grund.slice(0, TEXT_MAX.notiz) } : x)) });
    }
    case 'leseteil':
      return mit({ ...d, leseteil: op.leseteil });
  }
  return nein(400, 'Unbekannter Schritt.');
}

/** Der Lauf ohne Entwurf (Frist „Entwürfe 90 Tage“, Verwerfen) — Zähler bleiben nicht, der Lauf bleibt als Zeile mit Kosten. */
export function entwurfOhne(l: AnalyseLauf): AnalyseLauf {
  const { ergebnis: _e, ...rest } = l;
  return rest;
}
