// ─── Ein Lauf des Head of Finance ───────────────────────────────────────────
// Ablauf (Recherche 24.09., Anthropic-Muster „Routing + Evaluator“):
//   1. Daten laden → Finanzbild (Code rechnet alles).
//   2. Tagescheck ohne Neues? → ohne Modellaufruf fertig („ruhig“).
//   3. Modell: System (gecacht) + <daten> vor <aufgabe>, JSON-Schema, wenige
//      Werkzeuge (rechne, buchungen_suchen).
//   4. Prüfer (Code). Fund → genau eine Korrekturrunde, Rest wird markiert.
//   5. Speichern: Bericht, Freigabe-Liste (dedupliziert), letzter Lauf.
// Nichts hier bewegt Geld. Der Agent schlägt vor; Menschen entscheiden.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { askText, extractJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, MODEL_BY_TIER } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { schwellen } from '@/lib/schwellen';
import { lesen, type MalinExport } from '@/lib/make-one/grundlage';
import type { FinanceState } from '@/lib/make-one/finance-data';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { ladeHaushalt } from '../haushalt/speicher';
import { buchungenSuchen } from '../haushalt/jarvis';
import { heuteBerlin, tagPlus, tageZwischen } from '../haushalt/monat';
import { baueFinanzbild, type Finanzbild, type FinanzplanStand } from './finanzbild';
import { SYSTEM, aufgabe, SCHEMA, DEFINITIONEN, MODUS_NAME, type Modus } from './prompt';
import { normalisiere, pruefe, sauber, korrekturAuftrag, type Antwort, type Pruefung } from './pruefer';
import { zahlenImText } from './pruefung';
import { rechne } from './rechne';
import { leererStand, standName, vorschlaegeMischen, vorschlaegeFuerDaten, EINSTELLUNG_NAME, STANDARD_CHEF_EINSTELLUNG, type Bericht, type ChefStand, type ChefEinstellung } from './stand';

export interface LaufAuftrag { modus: Modus; haushalt: string | null; person?: string; frage?: string; monat?: string; ausgeloest: Bericht['ausgeloest'] }
export interface LaufErgebnis { ok: boolean; fehler?: string; bericht?: Bericht; ohneKi?: boolean; ruhigText?: string; neu?: number; aktualisiert?: number }

export async function ladeEinstellung(): Promise<ChefEinstellung> {
  const e = await loadJson<Partial<ChefEinstellung>>(EINSTELLUNG_NAME);
  return { ...STANDARD_CHEF_EINSTELLUNG, ...(e ?? {}), steuer: { ...STANDARD_CHEF_EINSTELLUNG.steuer, ...(e?.steuer ?? {}) }, rechtsform: { ...STANDARD_CHEF_EINSTELLUNG.rechtsform, ...(e?.rechtsform ?? {}) } };
}

/** Alle Quellen laden und das Finanzbild bauen. Haushalt nur, wenn übergeben. */
export async function ladeFinanzbild(haushalt: string | null, heute = heuteBerlin()): Promise<{ bild: Finanzbild; einstellung: ChefEinstellung }> {
  const [finance, plan, liqui, grund, einstellung] = await Promise.all([
    loadJson<FinanceState>('finance'),
    loadJson<FinanzplanStand>('finanzplan'),
    loadJson<{ posten?: Planposten[] }>('liquiplan'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
    ladeEinstellung(),
  ]);
  const hh = haushalt ? await ladeHaushalt(haushalt) : null;
  const bild = baueFinanzbild({
    heute, finance, plan, planposten: liqui?.posten ?? [],
    grundlage: grund?.roh ? { g: lesen(grund.roh, grund.stand), stand: grund.stand } : null,
    steuer: { ...einstellung.steuer, ruecklageQuote: einstellung.ruecklageQuote },
    haushalt: hh,
  });
  return { bild, einstellung };
}

/** Das Paket, das das Modell sieht — Meta, Einstellungen, Bedeutungen, Bild, frühere Vorschläge. */
export async function datenpaket(bild: Finanzbild, einstellung: ChefEinstellung, stand: ChefStand, modus: Modus) {
  const s = await schwellen();
  return {
    meta: { heute: bild.stichtag, publikum: bild.umfang === 'business' ? 'business' : 'haushalt', modus, letzter_lauf: stand.letzte[modus] ?? null },
    einstellungen: {
      steuer: einstellung.steuer, steuerquote_haushalt_prozent: bild.haushalt ? (bild.haushalt.steuerquote_annahme_prozent ?? null) : undefined,
      rechtsform: einstellung.rechtsform,
      schwellen: {
        sparquote_rot_unter_prozent: 0, sparquote_gelb_unter_prozent: 10, fixkostenquote_gelb_ab_prozent: 50, fixkostenquote_rot_ab_prozent: 60,
        schuldendienst_gelb_ab_prozent: 20, schuldendienst_rot_ab_prozent: 35, runway_rot_monate: s.runwayRot, runway_gelb_monate: s.runwayAmber,
        forderung_mahnen_ab_tage: 14, forderung_hoch_ab_tage: 30, kunde_klumpen_ab_prozent: 50, kunde_rentenversicherung_ab_prozent: 83.3,
      },
    },
    definitionen: DEFINITIONEN,
    ...bild,
    crm: await crmFuerFinanzen(bild.stichtag),
    vorschlaege_offen: vorschlaegeFuerDaten(stand.vorschlaege),
  };
}

/** Die Vertriebsseite fürs Finanzbild (24.09.): wiederkehrender Umsatz, auslaufende
 *  Mandate, Mandate außerhalb des Liquiplans, gewichtete Pipeline (NIE Basisplan). */
async function crmFuerFinanzen(heute: string) {
  try {
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const { mrr, konzentration, mandatLage, planpostenAus } = await import('@/lib/crm/kunden');
    const { prognose } = await import('@/lib/crm/pipeline');
    const crm = await ladeCrm();
    const posten = (await loadJson<{ posten?: Planposten[] }>('liquiplan'))?.posten ?? [];
    const p = prognose(crm.chancen, heute, crm.wahrscheinlichkeiten);
    return {
      hinweis: 'Pipeline ist Szenario, nie Basisplan. Mandate ohne Liquiplan-Posten sind Kandidaten für die Planung (Kevin entscheidet im CRM).',
      mrr_netto: mrr(crm.mandate), konzentration: konzentration(crm.mandate),
      mandate_auslaufend_90_tage: crm.mandate.filter(m => m.status === 'aktiv').map(m => ({ kunde: m.kunde, titel: m.titel.slice(0, 80), ende_in_tagen: mandatLage(m, heute).endeIn })).filter(x => x.ende_in_tagen !== null && x.ende_in_tagen <= 90),
      mandate_ohne_liquiplan: crm.mandate.map(m => ({ m, v: planpostenAus(m, heute) })).filter(x => x.v && !posten.some(pp => pp.id === x.v!.id)).map(x => ({ kunde: x.m.kunde, status: x.m.status, betrag_brutto: x.v!.betrag, rhythmus: x.v!.rhythmus })),
      pipeline: { offen: Math.round(p.offen), gewichtet: Math.round(p.gewichtet), commit: Math.round(p.commit), best_case: Math.round(p.bestCase) },
    };
  } catch { return null; }
}

// ── Werkzeuge (wenige, gebündelt, lesbare Ergebnisse) ──────────────────────
type Werkzeug = { name: string; description: string; input_schema: Record<string, unknown> };
const RECHNE: Werkzeug = { name: 'rechne', description: 'Rechnet einen Ausdruck mit + − * / und Klammern exakt aus (Euro, Prozent). Nutze es für jede neue Zahl, die nicht in <daten> steht. Das Ergebnis gilt dann als belegt.', input_schema: { type: 'object', properties: { ausdruck: { type: 'string', description: 'z. B. "(4200 - 3100) / 4200 * 100"' }, wofuer: { type: 'string', description: 'kurz: was die Zahl bedeutet' } }, required: ['ausdruck', 'wofuer'] } };
const SUCHE: Werkzeug = { name: 'buchungen_suchen', description: 'Sucht Haushaltsbuchungen nach Text (Empfänger/Verwendungszweck), Monat (JJJJ-MM) und/oder Kategorie. Liefert Summen und bis zu 20 Buchungen mit Datum, Empfänger, Betrag, Kategorie.', input_schema: { type: 'object', properties: { suche: { type: 'string' }, monat: { type: 'string' }, kategorie: { type: 'string' } } } };

interface Block { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }

async function frageModell(o: { system: string; user: string; model: string; tools: Werkzeug[]; haushalt: string | null; maxTokens: number }) {
  const messages: { role: string; content: unknown }[] = [{ role: 'user', content: o.user }];
  const werkzeugWerte: number[] = [];
  const werkzeuge: string[] = [];
  let text = '';
  for (let runde = 0; runde < 5; runde++) {
    const r = await askText({ system: o.system, user: '', messages, model: o.model, schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, tools: runde < 4 && o.tools.length ? o.tools : undefined, maxTokens: o.maxTokens, timeoutMs: 170_000, zweck: 'finanzchef' });
    if (!r.ok && r.stopReason !== 'tool_use') return { ok: false as const, fehler: r.error ?? 'Modell antwortet nicht', messages, werkzeugWerte, werkzeuge };
    const bloecke = ((r.raw as { content?: Block[] })?.content ?? []);
    if (r.stopReason === 'tool_use') {
      messages.push({ role: 'assistant', content: bloecke });
      const ergebnisse = [];
      for (const b of bloecke.filter(x => x.type === 'tool_use')) {
        let inhalt = '';
        if (b.name === 'rechne') {
          const v = rechne(String(b.input?.ausdruck ?? ''));
          if (v == null) inhalt = 'Fehler: Ausdruck nicht rechenbar (nur Zahlen, + − * / und Klammern).';
          else { werkzeugWerte.push(v); inhalt = `${String(b.input?.wofuer ?? 'Ergebnis')}: ${v}`; }
          werkzeuge.push('rechne');
        } else if (b.name === 'buchungen_suchen' && o.haushalt) {
          const h = await ladeHaushalt(o.haushalt);
          inhalt = buchungenSuchen(h, { suche: String(b.input?.suche ?? ''), monat: String(b.input?.monat ?? ''), kategorie: String(b.input?.kategorie ?? '') });
          for (const f of zahlenImText(inhalt)) werkzeugWerte.push(f.wert);
          werkzeuge.push('buchungen_suchen');
        } else inhalt = 'Unbekanntes Werkzeug.';
        ergebnisse.push({ type: 'tool_result', tool_use_id: b.id, content: inhalt });
      }
      messages.push({ role: 'user', content: ergebnisse });
      continue;
    }
    text = r.text;
    messages.push({ role: 'assistant', content: bloecke.length ? bloecke : text });
    break;
  }
  return { ok: true as const, text, messages, werkzeugWerte, werkzeuge: Array.from(new Set(werkzeuge)) };
}

/** Der Fingerabdruck der Lage für den Tagescheck. */
function tagesSchluessel(bild: Finanzbild, stand: ChefStand): { schluessel: string; dringend: number } {
  const heute = bild.stichtag;
  const punkte = [
    // Ohne Ziffern: „17 Tage alt“ → „18 Tage alt“ ist nichts Neues.
    ...bild.hinweise.filter(h => h.schwere !== 'niedrig').map(h => h.text.replace(/\d[\d.,]*/g, '#')),
    ...bild.steuern.termine_60_tage.filter(t => tageZwischen(heute, t.datum) <= 7).map(t => `${t.datum} ${t.titel}`),
    ...stand.vorschlaege.filter(v => v.status === 'offen' && v.frist && v.frist <= tagPlus(heute, 3)).map(v => `frist ${v.dedup_schluessel}`),
  ].sort();
  return { schluessel: punkte.join('|'), dringend: punkte.length };
}

export async function chefLauf(a: LaufAuftrag): Promise<LaufErgebnis> {
  const start = Date.now();
  const jetzt = new Date().toISOString();
  const name = standName(a.haushalt);
  // Wiederholung aus der Warteschlange (der Arbeiter bricht nach 280 s ab, die
  // Pacht läuft nach 300 s aus): lief derselbe Modus eben erst, nicht doppelt.
  if (a.ausgeloest === 'takt') {
    const alt = await loadJson<ChefStand>(name);
    const vorher = alt?.letzte?.[a.modus], versuch = alt?.versuche?.[a.modus];
    if (vorher && Date.now() - Date.parse(vorher) < 20 * 60_000) return { ok: true, ohneKi: true, ruhigText: 'Lief eben schon — kein zweiter Lauf.' };
    if (versuch && Date.now() - Date.parse(versuch) < 10 * 60_000 && (!vorher || Date.parse(vorher) < Date.parse(versuch))) return { ok: true, ohneKi: true, ruhigText: 'Läuft gerade schon — kein zweiter Lauf.' };
  }
  await updateJson<ChefStand>(name, s => ({ ...leererStand(), ...(s ?? {}), versuche: { ...(s?.versuche ?? {}), [a.modus]: jetzt } }));
  const stand = { ...leererStand(), ...((await loadJson<ChefStand>(name)) ?? {}) };
  const { bild, einstellung } = await ladeFinanzbild(a.haushalt);

  // Tagescheck: ohne dringende Punkte oder ohne Neues kein Modellaufruf.
  if (a.modus === 'tagescheck' && a.ausgeloest === 'takt') {
    const t = tagesSchluessel(bild, stand);
    const letzter = stand.letzte.tagescheck ?? stand.letzte.wochenreview;
    if (!t.dringend || (t.schluessel === stand.tagesSchluessel && letzter)) {
      const ruhigText = t.dringend ? 'Nichts Neues seit dem letzten Check.' : 'Ruhig — nichts Dringendes in den nächsten 7 Tagen.';
      await updateJson<ChefStand>(name, s => ({ ...leererStand(), ...(s ?? {}), letzte: { ...(s?.letzte ?? {}), tagescheck: jetzt }, tagesSchluessel: t.schluessel, ruhig: { zeit: jetzt, text: ruhigText } }));
      return { ok: true, ohneKi: true, ruhigText };
    }
  }

  if (!hasAnthropicKey()) return { ok: false, fehler: 'Kein Anthropic-Key hinterlegt.' };
  const agent = await resolveAgent('finanzchef');
  if (!agent.enabled) return { ok: false, fehler: 'Der Head of Finance ist ausgeschaltet (unter Agenten aktivierbar).' };

  const daten = await datenpaket(bild, einstellung, stand, a.modus);
  const user = `<daten>\n${JSON.stringify(daten, null, 1)}\n</daten>\n\n${aufgabe(a.modus, { frage: a.frage, person: a.person, monat: a.monat, haushalt: !!a.haushalt })}`;
  const tools = a.modus === 'tagescheck' ? [] : a.haushalt && a.modus !== 'steuercheck' ? [RECHNE, SUCHE] : [RECHNE];
  const maxTokens = a.modus === 'tagescheck' || a.modus === 'frage' ? 6000 : 12000;

  // Der tägliche Check braucht kein Reasoning-Modell; die großen Läufe schon.
  const modell = a.modus === 'tagescheck' && /opus/.test(agent.model) && !process.env.ANTHROPIC_MODEL ? MODEL_BY_TIER.ausgewogen : agent.model;
  const r1 = await frageModell({ system: SYSTEM, user, model: modell, tools, haushalt: a.haushalt, maxTokens });
  if (!r1.ok) return { ok: false, fehler: r1.fehler };
  let antwort: Antwort = normalisiere(extractJson(r1.text), a.modus);
  if (!antwort.zusammenfassung && !antwort.antwort) return { ok: false, fehler: 'Antwort ohne verwertbares JSON.' };
  let pruefung: Pruefung = pruefe(antwort, daten, r1.werkzeugWerte, r1.werkzeuge);
  let korrigiert = false;
  let werkzeuge = r1.werkzeuge;
  if (!sauber(pruefung)) {
    // Genau eine Korrekturrunde mit konkreter Fehlerliste.
    const r2 = await askText({ system: SYSTEM, user: '', messages: [...r1.messages, { role: 'user', content: korrekturAuftrag(pruefung) }], model: modell, schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, maxTokens, timeoutMs: 170_000, zweck: 'finanzchef-korrektur' });
    const neu = r2.ok ? extractJson(r2.text) : null;
    if (neu) {
      const a2 = normalisiere(neu, a.modus);
      const p2 = pruefe(a2, daten, r1.werkzeugWerte, r1.werkzeuge);
      const fehler = (p: Pruefung) => p.unbelegt.length + p.quellenFehlen.length + p.betraegeUnbelegt.length + p.fristenUnbelegt.length + p.verstoesse.length * 5;
      if (a2.zusammenfassung && fehler(p2) <= fehler(pruefung)) { antwort = a2; pruefung = p2; korrigiert = true; werkzeuge = r1.werkzeuge; }
    }
  }

  const bericht: Bericht = {
    id: `hb-${Date.now().toString(36)}`, zeit: jetzt, modus: a.modus, umfang: bild.umfang,
    ausgeloest: a.ausgeloest, ...(a.person ? { person: a.person } : {}), ...(a.frage ? { frage: a.frage.slice(0, 500) } : {}), ...(a.monat ? { monat: a.monat } : {}),
    antwort, pruefung: { ...pruefung, korrigiert }, modell, dauer_ms: Date.now() - start, werkzeuge,
  };
  let neu = 0, aktualisiert = 0;
  await updateJson<ChefStand>(name, s => {
    const st = { ...leererStand(), ...(s ?? {}) };
    // Fragen über Jarvis (nur Business, ohne Person) füllen die Freigabe-Liste nicht —
    // die sieht dort niemand; Jarvis gibt die Vorschläge im Gespräch weiter.
    const m = a.ausgeloest === 'jarvis' ? { liste: st.vorschlaege, neu: 0, aktualisiert: 0 } : vorschlaegeMischen(st.vorschlaege, antwort.vorschlaege, bericht.id, jetzt);
    neu = m.neu; aktualisiert = m.aktualisiert;
    const t = a.modus === 'tagescheck' ? tagesSchluessel(bild, st).schluessel : st.tagesSchluessel;
    return { ...st, berichte: [...st.berichte, bericht].slice(-30), vorschlaege: m.liste, letzte: { ...st.letzte, [a.modus]: jetzt }, tagesSchluessel: t };
  });
  // Das Agenten-Protokoll teilen sich alle Konten — für den Haushalt nur Zähler, keine Beträge.
  await logRun('finanzchef', `${MODUS_NAME[a.modus]}${a.haushalt ? ' · Haushalt' : ''} · ${antwort.status}`,
    a.haushalt ? { befunde: antwort.befunde.length, vorschlaege: antwort.vorschlaege.length, neu, geprueft: pruefung.geprueft, unbelegt: pruefung.unbelegt.length }
      : { zusammenfassung: antwort.zusammenfassung, vorschlaege: antwort.vorschlaege.map(v => v.titel), geprueft: pruefung.geprueft, unbelegt: pruefung.unbelegt.length });
  return { ok: true, bericht, neu, aktualisiert };
}
