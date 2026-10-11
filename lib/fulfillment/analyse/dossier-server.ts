// ─── Fulfillment · Analyse — Lesen und Schritte des Dossiers (C3, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9) — nur Server ─────────────────
// Was die Route `/api/fulfillment/dossier` tut, an einer Stelle: GET-Lage (Dossier OHNE Personenteil, Deckblatt, Vorschlag fürs Anlegen aus der
// CRM-Firmenakte) und die POST-Schritte (anlegen · eingaben · lia · f1 · uebernehmen · verwerfen · pruefen · ueberstimmen · f2 · aussage-hand ·
// aussage-entfernen · firma-uebernehmen · nach-fall). Geschrieben wird nur über `fulfillmentAendern` (EINE Schreibstelle, Sperre, Protokoll ohne
// Werte). `firma-uebernehmen` und `nach-fall` schreiben NICHT selbst: sie liefern dem Browser den Schritt für den vorhandenen Schreibweg
// (`/api/crm/bestand` PATCH `teil` mit Stand bzw. `/api/fulfillment/fall` PATCH) — ein Klick der Person, nie automatisch, und erst nach F2.

import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { AbschnittId, AnalyseAgentId, Dossier } from '../typen';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '../speicher';
import { MANDAT_ID } from '../grenzen';
import { ABSCHNITT_IDS, ANALYSE_AGENTEN } from '../lesen';
import { mandatsEnde } from '../regeln';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { dossierAnwenden, type DossierOp, type DossierEingaben } from './dossier-anwenden';
import { personenAnwenden } from './personen-anwenden';
import { pruefeDossier, pruefungZusammen, belegQuote, type Befund } from './pruefen';
import { alsErgebnis, STECKBRIEF_FELDER, type SteckbriefFeld } from './ausgabe';
import { dossierFuerAntwort } from './sicht';
import { domainSaeubern } from './quellen';
import { LIA_MUSTER, RECHT_HINWEIS, loeschAmFuer } from './dsgvo';
import { VERALTET_TAGE } from './agenten';
import { mandatFuer, personenTage, tiefenberichtFrage } from './lauf';
import { personenteilErlaubt } from './zoe-werkzeug';

export type Antwort = { status: number; body: Record<string, unknown> };
const nein = (status: number, fehler: string, mehr: Record<string, unknown> = {}): Antwort => ({ status, body: { ok: false, fehler, ...mehr } });
const ctx = (person: string) => ({ person, jetzt: new Date().toISOString(), heute: localDay(), standVon: (d: Dossier) => eintragStand(d), kennung: (p: 'da' | 'dq') => neueKennung(p) });

/** Vorschlag fürs Anlegen aus der CRM-Firmenakte (Firma, Domain, Branche, Stadt) — nur ein Vorschlag, die Person ändert ihn. */
async function vorschlagAusCrm(m: import('@/lib/crm/typen').Mandat): Promise<DossierEingaben> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const crm = await ladeCrm();
  const f = m.firmaId ? crm.firmen.find(x => x.id === m.firmaId) : undefined;
  const domain = f?.domain ? domainSaeubern(f.domain) : f?.webseite ? domainSaeubern(f.webseite) : null;
  return { firma: f?.name ?? m.kunde, domains: domain ? [domain] : [], urls: [], ...(f?.branche ? { branche: f.branche } : {}), ...(f?.stadt ? { sitz: f.stadt } : {}) };
}

/** GET: Lage des Dossiers eines Mandats (ohne Personenteil). */
export async function dossierLage(mandatId: string, person: string): Promise<Antwort> {
  if (!MANDAT_ID.test(mandatId)) return nein(400, 'Mandat fehlt (?m=).');
  const mandat = await mandatFuer(mandatId);
  if (!mandat.ok) return nein(mandat.status, mandat.fehler);
  const [datei, personen, tage, darf] = await Promise.all([fulfillmentLesen('dossiers'), fulfillmentLesen('personen'), personenTage(), personenteilErlaubt(person)]);
  const d = datei.dossiers[mandatId];
  const m = mandat.mandat;
  const ende = mandatsEnde(m) ?? (m.ende ? m.ende.slice(0, 10) : null);
  const basis = {
    ok: true, mandat: { id: m.id, titel: m.titel, kunde: m.kunde, status: m.status, ...(m.firmaId ? { firmaId: m.firmaId } : {}) },
    personenteil: darf, liaMuster: LIA_MUSTER, rechtHinweis: RECHT_HINWEIS, loeschRegelTage: tage,
  };
  if (!d) return { status: 200, body: { ...basis, dossier: null, vorschlag: await vorschlagAusCrm(m) } };
  const quellenStand = d.quellen.map(q => q.abgerufenAm).sort().at(-1) ?? null;
  return {
    status: 200, body: {
      ...basis, dossier: dossierFuerAntwort(d, person, Date.now(), darf), stand: eintragStand(d),
      deckblatt: { version: d.version, stand: d.geaendert, quellenStand, loeschAm: loeschAmFuer(ende, tage), kartenAnzahl: personen.karten.filter(k => k.mandatId === mandatId).length, geloescht: d.personenGeloescht ?? [] },
      belegQuote: belegQuote(d), tiefenberichtFrage: tiefenberichtFrage(d),
    },
  };
}

/** GET `?alle=1`: alle Dossiers der Business-Mandate — Freigaben, Läufe, Kosten, Art.-14-Fristen (nur Zahlen, keine Namen). */
export async function dossierListe(): Promise<Antwort> {
  const [{ ladeCrm }, { bereichVonGesellschaft }, { dossierKurzFuer }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/einheiten'), import('./server')]);
  const mandate = (await ladeCrm()).mandate.filter(m => bereichVonGesellschaft(m.gesellschaft) === 'business');
  const kurz = await dossierKurzFuer(mandate.map(m => m.id));
  const liste = mandate.filter(m => kurz[m.id]?.vorhanden).map(m => ({ mandatId: m.id, titel: m.titel, kunde: m.kunde, status: m.status, ...kurz[m.id] }));
  const ohne = mandate.filter(m => !kurz[m.id]?.vorhanden && (m.status === 'aktiv' || m.status === 'angebot' || m.status === 'verhandlung')).map(m => ({ mandatId: m.id, titel: m.titel, kunde: m.kunde, status: m.status }));
  return { status: 200, body: { ok: true, dossiers: liste, ohneDossier: ohne, kostenCent: liste.reduce((s, x) => s + x.kostenCent, 0) } };
}

/** Prüfung rechnen und speichern (in DERSELBEN Sperre wie das Dossier): deterministisch + Befunde des Modell-Prüfers (A13, übernommen). */
async function pruefen(mandatId: string, person: string, wer: Wer, m: import('@/lib/crm/typen').Mandat): Promise<Antwort> {
  const heute = localDay();
  const tage = await personenTage();
  const ende = mandatsEnde(m) ?? (m.ende ? m.ende.slice(0, 10) : null);
  // Löschtag der Karten nachziehen, sobald das Mandatsende feststeht (Plan: Mandatsende + Frist).
  await fulfillmentAendern('personen', p => personenAnwenden(p, { op: 'loeschtage', mandatId, loeschAm: loeschAmFuer(ende, tage) }, { person, heute, standVon: k => eintragStand(k) }), wer);
  const { mitKontaktArt14 } = await import('./personen-server');
  const karten = await mitKontaktArt14((await fulfillmentLesen('personen')).karten.filter(k => k.mandatId === mandatId));
  const k = ctx(person);
  const grenze = tagPlus(heute, -VERALTET_TAGE);
  const r = await fulfillmentAendern('dossiers', cur => {
    const d = cur.dossiers[mandatId];
    if (!d) return { ok: false, status: 404, fehler: 'Für dieses Mandat gibt es noch kein Dossier.' };
    const neu = pruefeDossier(d, karten, heute, { mandatsEnde: ende });
    const a13 = [...d.laeufe].reverse().find(l => l.agent === 'a13' && l.status === 'uebernommen');
    const modell: Befund[] = alsErgebnis(a13?.ergebnis)?.befunde ?? [];
    const ids = new Set([...Object.values(d.abschnitte).flatMap(a => a?.aussagen.map(x => x.id) ?? []), ...d.quellen.map(q => q.id), ...karten.map(x => x.id), ...karten.flatMap(x => [...x.werdegang, ...x.themen, ...x.auftritte, ...x.aufhaenger].map(a => a.id))]);
    const pruefung = pruefungZusammen(neu, d.pruefung, modell, b => ids.has(b), k.jetzt);
    const veraltet = Object.values(d.abschnitte).flatMap(a => a?.aussagen.filter(x => x.stand < grenze).map(x => x.id) ?? []);
    return dossierAnwenden(cur, { op: 'pruefung', mandatId, pruefung, veraltet }, k);
  }, wer);
  return r.ok ? antwort(mandatId, person) : nein(r.status, r.fehler);
}

async function antwort(mandatId: string, person: string, mehr: Record<string, unknown> = {}): Promise<Antwort> {
  const [datei, darf] = await Promise.all([fulfillmentLesen('dossiers'), personenteilErlaubt(person)]);
  const d = datei.dossiers[mandatId];
  return { status: 200, body: { ok: true, ...mehr, dossier: d ? dossierFuerAntwort(d, person, Date.now(), darf) : null, stand: d ? eintragStand(d) : null } };
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const abschnittAus = (v: unknown): AbschnittId | null => (typeof v === 'string' && (ABSCHNITT_IDS as readonly string[]).includes(v) ? (v as AbschnittId) : null);

/** POST: ein Schritt am Dossier. */
export async function dossierAktion(b: Record<string, unknown>, person: string, wer: Wer): Promise<Antwort> {
  const mandatId = text(b.mandatId);
  if (!MANDAT_ID.test(mandatId)) return nein(400, 'Mandat fehlt.');
  const mandat = await mandatFuer(mandatId);
  if (!mandat.ok) return nein(mandat.status, mandat.fehler);
  const aktion = text(b.aktion);
  const stand = text(b.stand);
  let op: DossierOp | null = null;
  switch (aktion) {
    case 'anlegen': {
      const vorschlag = await vorschlagAusCrm(mandat.mandat);
      const e = (b.eingaben && typeof b.eingaben === 'object' ? b.eingaben : {}) as Partial<DossierEingaben>;
      op = { op: 'anlegen', mandatId, ...(mandat.mandat.firmaId ? { firmaId: mandat.mandat.firmaId } : {}), eingaben: { ...vorschlag, ...e } as DossierEingaben };
      break;
    }
    case 'eingaben': op = { op: 'eingaben', mandatId, stand, eingaben: (b.eingaben ?? {}) as Partial<DossierEingaben> }; break;
    case 'lia': op = { op: 'lia', mandatId, stand, zweck: text(b.zweck), erforderlichkeit: text(b.erforderlichkeit), abwaegung: text(b.abwaegung), schutz: text(b.schutz) }; break;
    case 'f1': {
      const umfang = Array.isArray(b.umfang) ? b.umfang.filter((x): x is AnalyseAgentId => typeof x === 'string' && (ANALYSE_AGENTEN as readonly string[]).includes(x)) : [];
      if (!Array.isArray(b.umfang) || umfang.length !== b.umfang.length) return nein(400, 'F1: unbekannter Agent im Umfang.');
      const funktionen = Array.isArray(b.funktionen) ? b.funktionen.map(text) : [];
      op = { op: 'f1', mandatId, stand, umfang, funktionen, ...(text(b.kundeBestaetigtAm) ? { kundeBestaetigtAm: text(b.kundeBestaetigtAm) } : {}), ...(b.wie === 'kickoff' || b.wie === 'mail' ? { wie: b.wie } : {}) };
      break;
    }
    case 'uebernehmen': {
      const abschnitte = Array.isArray(b.abschnitte) ? b.abschnitte.filter((x): x is AbschnittId | 'diagnose' | 'befunde' => typeof x === 'string' && (x === 'diagnose' || x === 'befunde' || !!abschnittAus(x))) : [];
      op = { op: 'uebernehmen', mandatId, stand, laufId: text(b.laufId), abschnitte };
      break;
    }
    case 'verwerfen': op = { op: 'verwerfen', mandatId, stand, laufId: text(b.laufId) }; break;
    case 'pruefen': return pruefen(mandatId, person, wer, mandat.mandat);
    case 'ueberstimmen': op = { op: 'ueberstimmen', mandatId, stand, index: typeof b.index === 'number' ? b.index : -1, grund: text(b.grund) }; break;
    case 'f2': op = { op: 'f2', mandatId, stand }; break;
    case 'aussage-hand': {
      const abschnitt = abschnittAus(b.abschnitt);
      if (!abschnitt) return nein(400, 'Unbekannter Abschnitt.');
      const art = b.art === 'fakt' || b.art === 'schaetzung' || b.art === 'hypothese' ? b.art : null;
      if (!art) return nein(400, 'Art: Fakt, Schätzung oder Hypothese.');
      op = { op: 'aussage-hand', mandatId, stand, abschnitt, text: text(b.text), art, ...(text(b.url) ? { url: text(b.url) } : {}), ...(text(b.unterlageId) ? { unterlageId: text(b.unterlageId) } : {}), ...(text(b.titel) ? { titel: text(b.titel) } : {}) };
      break;
    }
    case 'aussage-entfernen': {
      const abschnitt = abschnittAus(b.abschnitt);
      if (!abschnitt) return nein(400, 'Unbekannter Abschnitt.');
      op = { op: 'aussage-entfernen', mandatId, stand, abschnitt, id: text(b.id) };
      break;
    }
    case 'firma-uebernehmen': return firmaUebernehmen(mandatId, text(b.laufId), text(b.feld), mandat.mandat);
    case 'nach-fall': return nachFall(mandatId, text(b.was), mandat.mandat);
    default: return nein(400, 'Unbekannte Aktion.');
  }
  const k = ctx(person);
  const r = await fulfillmentAendern('dossiers', cur => dossierAnwenden(cur, op!, k), wer);
  if (r.ok) return antwort(mandatId, person, aktion === 'anlegen' ? { angelegt: true } : {});
  if (r.status === 409 && r.konflikte) { const a = await antwort(mandatId, person); return { status: 409, body: { ...a.body, ok: false, fehler: r.fehler, konflikt: true } }; }
  return nein(r.status, r.fehler);
}

/** Ein Steckbrief-Feld (A1, nach F2) für die CRM-Firmenakte vorbereiten — der Browser schickt es an `/api/crm/bestand` (Stand, 409). */
async function firmaUebernehmen(mandatId: string, laufId: string, feld: string, m: import('@/lib/crm/typen').Mandat): Promise<Antwort> {
  if (!(STECKBRIEF_FELDER as readonly string[]).includes(feld)) return nein(400, 'Unbekanntes Feld.');
  const d = (await fulfillmentLesen('dossiers')).dossiers[mandatId];
  if (!d) return nein(404, 'Kein Dossier.');
  if (!d.f2) return nein(409, 'Erst F2 — in die Firmenakte kommt nur, was geprüft ist.');
  const l = d.laeufe.find(x => x.id === laufId && x.agent === 'a1');
  const wert = alsErgebnis(l?.ergebnis)?.steckbrief?.[feld as SteckbriefFeld]?.wert;
  if (!l || !wert) return nein(404, 'Diesen Steckbrief-Wert gibt es nicht (mehr).');
  const firmaId = d.firmaId ?? m.firmaId;
  if (!firmaId) return nein(409, 'Das Mandat ist mit keiner Firma verknüpft.');
  const [{ ladeCrm }, { crmMitStand }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/crm-stand')]);
  const f = crmMitStand(await ladeCrm()).firmen.find(x => x.id === firmaId) as (import('@/lib/crm/typen').Firma & { stand?: string }) | undefined;
  if (!f) return nein(404, 'Die Firma gibt es nicht (mehr).');
  const vorher = (f as unknown as Record<string, unknown>)[feld];
  return { status: 200, body: { ok: true, vorher: typeof vorher === 'string' ? vorher : null, op: { liste: 'firmen', op: 'teil', id: firmaId, felder: { [feld]: wert }, stand: f.stand } } };
}

/** Quick Wins bzw. Kick-off-Fragen (A12, nach F2) als Schritte für die Route des Falls (C1) — der Browser schickt sie. Form = die der Fall-Route: `{ mandatId, ops }` (Ende-zu-Ende-Test tests/fulfillment-zusammen.test.ts). */
async function nachFall(mandatId: string, was: string, m: import('@/lib/crm/typen').Mandat): Promise<Antwort> {
  const d = (await fulfillmentLesen('dossiers')).dossiers[mandatId];
  if (!d) return nein(404, 'Kein Dossier.');
  if (!d.f2) return nein(409, 'Erst F2 — in den Fall kommt nur, was geprüft ist.');
  if (!d.diagnose) return nein(409, 'Noch kein Diagnose-Entwurf übernommen.');
  const { fallLesen } = await import('../prozesse/server');
  const fall = await fallLesen(mandatId).catch(() => null);
  const basis = (fall?.gestartetAm ?? m.start ?? localDay()).slice(0, 10);
  const bis = tagPlus(basis < localDay() ? localDay() : basis, 30);
  if (was === 'quickwins') return { status: 200, body: { ok: true, ziel: '/api/fulfillment/fall', methode: 'PATCH', body: { mandatId, ops: [{ op: 'quickwins-setzen', quickWins: d.diagnose.quickWins.slice(0, 3).map(text => ({ text, bis, quelle: 'analyse' })) }] } } };
  if (was === 'fragen') return { status: 200, body: { ok: true, ziel: '/api/fulfillment/fall', methode: 'PATCH', body: { mandatId, ops: [{ op: 'kickoff-fragen', fragen: d.diagnose.fragen.map(f => ({ frage: f.frage, an: f.an, warum: f.warum, quelle: 'analyse' })) }] } } };
  return nein(400, 'Was: quickwins oder fragen.');
}
