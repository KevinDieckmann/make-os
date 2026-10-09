// ─── Agenten-Bereich: Hintergrundaufgaben — EIN Lesemodell „Läuft / Fertig / Fehler“ (09.10., Paket 3; AGENTEN_KONZEPT.md C4/C11) ──
// Entscheidung 08.10. (Antwort 8): „Läuft/Fertig/Fehler mit Dauer · Ergebnis als Thread · abbrechen/neu starten · einmalig/geplant/wiederkehrend ·
// Fortschritt in Schritten · Kostengrenze je Aufgabe · auch Takt-Läufe.“
//
// Nie gespeichert — gebaut aus den vorhandenen Quellen (kein zweiter Hintergrund-Mechanismus, C7):
//   Warteschlange `zoe-auftraege` (lib/zoe/auftraege.ts) · Threads der Person (`agenten-faeden--<person>`, nur lesend — Paket 1 schreibt
//   den Lauf-Zustand) · Berichte der Heads (`head-<id>`) und des Finanzchefs (`finanzchef`, `haushalt-chef--<h>`) · Agenten-Log.
// Trennung SERVERSEITIG (Plattform-Regel), EINE Filterstelle `laeufeBauen`:
//   • eigene Läufe voll (Titel, Schritte, Kosten, Aktionen);
//   • Systemläufe (ohne Person, z. B. Takt) nur NEUTRAL: fester Titel aus `NEUTRAL`, keine Ergebnisse, keine Fehlertexte, keine Aktionen;
//   • Läufe einer ANDEREN Person nie — auch nicht als Zahl;
//   • Berichte von Heads/Finanzchef nur, wenn die Person den Head sehen darf (der Aufrufer reicht nur solche herein).
// Aktionen (abbrechen, neu starten) nur für eigene Agenten-Läufe; Business-Heads ruhen in Business-freien Zeiten (lib/arbeitsrahmen).

import { headDef } from './katalog';
import { LAUF_AGENT, type FadenKopf, type Hintergrundaufgabe, type Lauf, type LaufQuelle, type LaufStatus } from './typen';
import { WEG } from '@/lib/wege';
import { inEuroCent } from '@/lib/ki/kosten';

/** Fehlertext eines von Hand abgebrochenen Auftrags in der Warteschlange — ohne Namen (die Warteschlange ist geteilt). */
export const ABGEBROCHEN = 'Abgebrochen von Hand.';
/** Fertige/Fehler-Läufe so lange zurück (Tage). */
export const LAEUFE_TAGE = 7;
/** Höchstens so viele Läufe in der Antwort (Laufende immer). */
export const LAEUFE_MAX = 60;

/** Neutrale Titel für Läufe, deren Inhalt die Person nicht sehen soll (Systemläufe) — und als Rückfall für eigene. */
export const NEUTRAL: Readonly<Record<string, string>> = {
  tagesstart: 'Morgenlauf vorbereiten', morgen: 'Vorschläge für heute', abend: 'Tagesabschluss', tageslauf: 'Tageslauf',
  selbstbild: 'Selbstbild', verbesserung: 'Verbesserungs-Loop', gesundheit: 'Gesundheits-Takt', markttraktion: 'Markttraktion-Nachricht',
  hoi: 'Head of IT', konsolidierung: 'Brain verdichten', loeschfristen: 'Löschfristen', 'zoe-aufgaben': 'ZOE-Aufgaben', durchsicht: 'Durchsicht der Bestände',
  absichten: 'Abgebrochene Vorgänge fertigstellen', 'ki-medien': 'KI-Medien abholen',
  'head-sales': 'Head of Sales', 'head-marketing': 'Head of Marketing', 'head-event': 'Head of Event', finanzchef: 'Head of Finance',
  research: 'Research', board: 'Board-Bericht', okr: 'Ziele (OKR)', controlling: 'Controlling', fokus: 'Fokus', kalender: 'Kalender',
  inbox: 'Inbox', task: 'Aufgaben', prospect: 'Prospecting', planung: 'Planung', ernaehrung: 'Ernährung', performance: 'Leistung',
  content: 'Content', meeting: 'Meeting', outreach: 'Ansprache', crm: 'Markttraktion',
  [LAUF_AGENT]: 'Agenten-Lauf',
};
export const neutralerTitel = (name: string): string => NEUTRAL[name] ?? 'Hintergrund-Lauf';
/** Systemläufe aus dem Privat-Bereich (Gesundheit, Ernährung, Leistung mit Körperwerten) — nur für Konten mit Privat-Bereich (Gegenprüfung 09.10.). */
export const PRIVAT_SYSTEMLAEUFE: ReadonlySet<string> = new Set(['gesundheit', 'ernaehrung', 'performance']);

/** Was das Lesemodell aus der Warteschlange braucht. */
export interface AuftragRoh {
  id: string; zeit: string; art: string; name: string; status: string; eingabe?: Record<string, unknown>;
  begonnen?: string; beendet?: string; fehler?: string; anlass?: string; person?: string;
  /** Rückmeldung des Arbeiters (nur gelesen, um „hat nur gewartet“ zu erkennen — nie ausgegeben). */
  ergebnis?: string;
}
/** Bericht eines Heads bzw. des Finanzchefs (nur Zeit, Modus, Auslöser, Person, Dauer). */
export interface BerichtRoh { id: string; zeit: string; modus: string; ausgeloest: string; person?: string; dauer_ms?: number }
/** Eintrag im Agenten-Log (nur Kopf). */
export interface LogRoh { id: string; agent: string; title: string; ts: string; person?: string }

export interface LaufQuellen {
  auftraege: readonly AuftragRoh[];
  /** NUR die Threads der Person. */
  faeden: readonly FadenKopf[];
  /** NUR die Hintergrundaufgaben der Person. */
  plan: readonly Hintergrundaufgabe[];
  /** Skills, die die Person sehen darf (Kennung → Name/Head/Auslöser). */
  skills: ReadonlyMap<string, { name: string; headId: string; zeitplan: boolean }>;
  /** Berichte nur sichtbarer Heads (`headId` = Head im Katalog). */
  berichte: readonly { headId: string; quelle: 'head' | 'finanzchef'; berichte: readonly BerichtRoh[] }[];
  /** Agenten-Log, schon auf eigene + Systemläufe gefiltert (`laeufeFuer`). */
  log: readonly LogRoh[];
}

const MODUS_TITEL: Readonly<Record<string, string>> = {
  power_hour: 'Power Hour vorbereiten', lead_review: 'Leads qualifizieren', deal_review: 'Deal-Review', kundenreview: 'Kundenreview',
  kampagne: 'Kampagne planen', wochenreview: 'Wochenreview', wochenplan: 'Wochenplan', netzwerk: 'Vernetzen-Runde', monatsreview: 'Monatsreview',
  planung: 'Event-Countdown', einladung: 'Gästeliste', nachfassen: 'Nachfassen', wirkung: 'Wirkung', frage: 'Frage',
  tagescheck: 'Tagescheck', monatsabschluss: 'Monatsabschluss', steuercheck: 'Steuercheck',
};
export const modusTitel = (m: string): string => MODUS_TITEL[m] ?? 'Lauf';

const STATUS_AUFTRAG: Readonly<Record<string, LaufStatus>> = { offen: 'wartet', laeuft: 'laeuft', fertig: 'fertig', fehler: 'fehler' };
/** Fehlertext eines vom Not-Aus angehaltenen Auftrags (lib/agenten/einstellung.ts `ANGEHALTEN`) — zählt wie „abgebrochen“. */
const NOT_AUS_TEXT = 'Angehalten (Not-Aus).';
const auftragStatus = (a: AuftragRoh): LaufStatus => (a.status === 'fehler' && (a.fehler === ABGEBROCHEN || a.fehler === NOT_AUS_TEXT) ? 'abgebrochen' : STATUS_AUFTRAG[a.status] ?? 'wartet');
const dauer = (start?: string, ende?: string): number | undefined => {
  const a = Date.parse(start ?? ''), b = Date.parse(ende ?? '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : undefined;
};
const offen = (s: LaufStatus) => s === 'wartet' || s === 'laeuft';

/** Was für ein Agenten-Lauf (Auftrag `faden`) — aus der Eingabe, mit Titel und Art aus den eigenen Beständen. */
function agentenLauf(a: AuftragRoh, q: LaufQuellen): Pick<Lauf, 'quelle' | 'art' | 'titel' | 'headId' | 'mitarbeiterId' | 'fadenId' | 'link'> {
  const e = a.eingabe ?? {};
  if (e.art === 'skill' && typeof e.skillId === 'string') {
    const s = q.skills.get(e.skillId);
    const headId = s?.headId ?? (typeof e.headId === 'string' ? e.headId : undefined);
    return { quelle: 'skill', art: e.ausloeser === 'zeitplan' ? 'wiederkehrend' : 'einmalig', titel: s?.name ?? 'Skill', ...(headId ? { headId } : {}), link: WEG.agenten(headId ? { h: headId } : {}) };
  }
  if (e.art === 'plan' && typeof e.planId === 'string') {
    const p = q.plan.find(x => x.id === e.planId);
    const headId = p && p.agent.art !== 'zoe' ? p.agent.headId : undefined;
    return { quelle: 'plan', art: p?.zeitplan.art === 'einmalig' ? 'geplant' : 'wiederkehrend', titel: p?.titel ?? 'Hintergrundaufgabe', ...(headId ? { headId } : {}), ...(p?.agent.art === 'mitarbeiter' ? { mitarbeiterId: p.agent.mitarbeiterId } : {}), link: WEG.agenten(headId ? { h: headId } : {}) };
  }
  const fadenId = typeof e.fadenId === 'string' ? e.fadenId : undefined;
  const f = fadenId ? q.faeden.find(x => x.id === fadenId) : undefined;
  const headId = f && f.agent.art !== 'zoe' ? f.agent.headId : undefined;
  return { quelle: 'faden', art: 'einmalig', titel: f?.titel ?? 'Agenten-Lauf', ...(headId ? { headId } : {}), ...(f?.agent.art === 'mitarbeiter' ? { mitarbeiterId: f.agent.mitarbeiterId } : {}), ...(fadenId ? { fadenId } : {}), link: WEG.agenten(fadenId ? { f: fadenId } : {}) };
}

/** Thread, der zu einem Auftrag gehört (Lauf-Zustand trägt die Auftrags-Kennung) — oder über Skill/Plan/Thread in der Eingabe. */
const fadenZu = (a: AuftragRoh, q: LaufQuellen): FadenKopf | undefined =>
  q.faeden.find(f => f.lauf?.auftragId === a.id) ?? (typeof a.eingabe?.fadenId === 'string' ? q.faeden.find(f => f.id === a.eingabe!.fadenId) : undefined);

/** Lauf-Zustand eines Threads ins Lesemodell (Schritte, Kosten, Status). */
function ausFaden(f: FadenKopf, basis: Partial<Lauf>): Partial<Lauf> {
  const l = f.lauf!;
  return {
    ...basis,
    status: l.status, start: l.start, ...(l.ende ? { ende: l.ende } : {}),
    ...(dauer(l.start, l.ende) !== undefined ? { dauerMs: dauer(l.start, l.ende) } : {}),
    ...(l.schritte.length ? { schritte: { gesamt: l.schritte.length, fertig: l.schritte.filter(s => s.status === 'fertig' || s.status === 'uebersprungen').length, ...(l.schritte.find(s => s.status === 'laeuft') ? { aktuell: l.schritte.find(s => s.status === 'laeuft')!.titel } : {}) } } : {}),
    // Euro-Cent wie die Grenze (der Thread misst US-Cent — umgerechnet über lib/ki/kosten.ts, Feinschliff 09.10.).
    kosten: { cent: Math.round(inEuroCent(l.kostenCent) * 100) / 100, ...(l.kostenGrenzeCent ? { grenzeCent: l.kostenGrenzeCent } : {}) },
    // Durchstich 09.10.: warum ein Lauf wartet (Not-Aus, Business-frei, Budget, Head aus, Hilfe-Frage) steht am Thread — jetzt auch in „Läuft“.
    ...(l.status === 'wartet' && l.fehler ? { hinweis: l.fehler } : {}),
    fadenId: f.id, link: WEG.agenten({ f: f.id }),
  };
}

/** Ab wie vielen Minuten ohne Meldung des Arbeiters ein wartender Agenten-Lauf den Hinweis bekommt (der Arbeiter fragt jede Minute). */
export const ARBEITER_STILL_MIN = 5;
/** Ab wie vielen Minuten Warten der Hinweis erscheint (frisch eingereihte Läufe holt der Arbeiter binnen einer Minute). */
export const WARTET_HINWEIS_MIN = 2;
/** Der Satz, wenn niemand die Warteschlange abholt (z. B. nur `next start` ohne `worker.mjs`, Container „arbeiter“ steht). */
export const arbeiterStillText = (minuten: number | null): string =>
  `Der Hintergrund-Arbeiter meldet sich nicht (${minuten === null ? 'noch nie gemeldet' : `zuletzt vor ${minuten.toLocaleString('de-DE')} Min.`}) — der Lauf startet, sobald er wieder läuft.`;

/**
 * Das Lesemodell (rein) — die EINE Filterstelle. `person` = die Person der Sitzung. Eigene Läufe voll, Systemläufe neutral,
 * fremde nie. Laufende zuerst, dann die jüngsten fertigen der letzten `LAEUFE_TAGE` Tage, höchstens `LAEUFE_MAX`.
 */
export function laeufeBauen(q: LaufQuellen, person: string, jetzt: Date = new Date(), opt: { privat?: boolean; /** Minuten seit der letzten Meldung des Arbeiters (null = nie); fehlt = nicht prüfen. */ arbeiterMinuten?: number | null } = {}): Lauf[] {
  const grenze = new Date(jetzt.getTime() - LAEUFE_TAGE * 864e5).toISOString();
  // Gegenprüfung 09.10.: Konten ohne Privat-Bereich („nur Business“) sehen Systemläufe aus Privat nicht einmal neutral.
  const privatSehen = opt.privat !== false;
  const systemSichtbar = (name: string) => privatSehen || !PRIVAT_SYSTEMLAEUFE.has(name);
  const raus: Lauf[] = [];
  const gesehen = new Set<string>();
  const headNamen = new Set(['head-sales', 'head-marketing', 'head-event', 'finanzchef']);

  for (const a of q.auftraege) {
    if (a.person && a.person !== person) continue; // fremde Läufe nie
    const eigen = a.person === person;
    const status = auftragStatus(a);
    const start = a.begonnen ?? a.zeit;
    const ende = offen(status) ? undefined : a.beendet;
    if (!offen(status) && (ende ?? start) < grenze) continue;
    // Fertige Head-/Finanzchef-Läufe stehen als Bericht da (mit Modus) — aus der Warteschlange nur, was wartet, läuft oder scheiterte.
    if (headNamen.has(a.name) && status === 'fertig') continue;
    const basis: Lauf = {
      id: a.id, quelle: (/^Takt:/.test(a.anlass ?? '') ? 'takt' : 'auftrag') as LaufQuelle, art: /^Takt:/.test(a.anlass ?? '') ? 'wiederkehrend' : 'einmalig',
      titel: neutralerTitel(a.name), status, start, ...(ende ? { ende } : {}), ...(dauer(start, ende) !== undefined ? { dauerMs: dauer(start, ende) } : {}),
      link: WEG.agenten(), aktionen: [],
    };
    if (!eigen) { if (systemSichtbar(a.name)) raus.push(basis); gesehen.add(a.id); continue; } // Systemlauf: neutral, ohne Aktionen
    if (a.art === 'agent' && a.name === LAUF_AGENT) {
      const l: Lauf = { ...basis, ...agentenLauf(a, q) };
      const f = fadenZu(a, q);
      // Nachschliff 09.10.: ein Versuch, der nur wartete (z. B. Head aus) und danach als NEUER Auftrag weiterlief („Head an“), ist kein eigener Lauf —
      // der neue Auftrag am Thread steht für ihn. Vorher stand der alte Versuch zusätzlich als „Fertig“ da, obwohl er nie lief.
      if (status === 'fertig' && /^AGENTEN-LAUF: wartet/.test(a.ergebnis ?? '') && f?.lauf?.auftragId && f.lauf.auftragId !== a.id) { gesehen.add(a.id); continue; }
      const voll = f?.lauf && (f.lauf.auftragId === a.id || !f.lauf.auftragId) ? { ...l, ...ausFaden(f, l) } as Lauf : l;
      // Die Warteschlange ist beendet (fertig, Fehler, abgebrochen), der Thread sagt noch „wartet/läuft“: die Warteschlange gilt — außer der Thread
      // wartet MIT Grund (Not-Aus, Business-frei, Budget, Head aus, Hilfe-Frage): dann wartet er wirklich (Durchstich 09.10.; vorher stand so ein
      // Lauf in „Fertig“, obwohl er nie lief).
      if (!offen(status) && offen(voll.status) && !(voll.status === 'wartet' && f?.lauf?.fehler)) { voll.status = status; if (ende) voll.ende = ende; delete voll.hinweis; }
      if (voll.fadenId) gesehen.add(`fd:${voll.fadenId}`);
      voll.aktionen = offen(voll.status) ? ['abbrechen'] : ['neu-starten'];
      raus.push(voll); gesehen.add(a.id);
      continue;
    }
    const kopf = a.name.startsWith('head-') ? headDef(a.name.slice(5)) : a.name === 'finanzchef' ? headDef('finanzen') : null;
    raus.push({ ...basis, ...(kopf ? { headId: kopf.id, link: WEG.agenten({ h: kopf.id }) } : {}), aktionen: status === 'wartet' ? ['abbrechen'] : [] });
    gesehen.add(a.id);
  }

  // Threads mit Lauf-Zustand, deren Auftrag nicht (mehr) in der Warteschlange steht.
  for (const f of q.faeden) {
    if (!f.lauf || f.besitzer !== person || gesehen.has(`fd:${f.id}`) || (f.lauf.auftragId && gesehen.has(f.lauf.auftragId))) continue;
    if (!offen(f.lauf.status) && (f.lauf.ende ?? f.lauf.start) < grenze) continue;
    const headId = f.agent.art !== 'zoe' ? f.agent.headId : undefined;
    const quelle: LaufQuelle = f.skillId ? 'skill' : f.planId ? 'plan' : 'faden';
    const p = f.planId ? q.plan.find(x => x.id === f.planId) : undefined;
    const art: Lauf['art'] = f.skillId ? (q.skills.get(f.skillId)?.zeitplan ? 'wiederkehrend' : 'einmalig') : p ? (p.zeitplan.art === 'einmalig' ? 'geplant' : 'wiederkehrend') : 'einmalig';
    const l = ausFaden(f, { id: `fd:${f.id}`, quelle, art, titel: f.titel, ...(headId ? { headId } : {}), ...(f.agent.art === 'mitarbeiter' ? { mitarbeiterId: f.agent.mitarbeiterId } : {}) }) as Lauf;
    l.aktionen = offen(l.status) ? ['abbrechen'] : ['neu-starten'];
    raus.push(l);
  }

  // Berichte der Heads und des Finanzchefs (nur sichtbare Heads — der Aufrufer filtert): eigene und Takt, nie die einer anderen Person.
  for (const b of q.berichte) {
    for (const r of b.berichte) {
      if (r.person && r.person !== person) continue;
      if (r.zeit < grenze) continue;
      const ende = r.zeit, start = r.dauer_ms && Number.isFinite(r.dauer_ms) ? new Date(Date.parse(r.zeit) - r.dauer_ms).toISOString() : r.zeit;
      raus.push({
        id: `${b.quelle === 'head' ? 'hb' : 'fb'}:${b.headId}:${r.id}`, quelle: b.quelle, art: r.ausgeloest === 'takt' ? 'wiederkehrend' : 'einmalig',
        titel: modusTitel(r.modus), headId: b.headId, status: 'fertig', start, ende, ...(r.dauer_ms ? { dauerMs: r.dauer_ms } : {}),
        link: WEG.agenten({ h: b.headId }), aktionen: [],
      });
    }
  }

  // Agenten-Log: Läufe ohne eigenen Auftrag (direkt aus einer Seite gestartet) — eigene mit Titel, Systemläufe neutral.
  const beendete = q.auftraege.filter(a => a.beendet).map(a => ({ name: a.name, t: Date.parse(a.beendet!) }));
  for (const e of q.log) {
    if (e.person && e.person !== person) continue;
    if (e.ts < grenze || headNamen.has(e.agent) || e.agent === LAUF_AGENT || e.agent.startsWith('faden')) continue;
    if (!e.person && !systemSichtbar(e.agent)) continue;
    const t = Date.parse(e.ts);
    if (beendete.some(b => b.name === e.agent && Math.abs(b.t - t) < 120_000)) continue;
    raus.push({ id: `log:${e.id}`, quelle: e.person ? 'auftrag' : 'takt', art: 'einmalig', titel: e.person ? (e.title || neutralerTitel(e.agent)).slice(0, 140) : neutralerTitel(e.agent), status: 'fertig', start: e.ts, ende: e.ts, link: WEG.agenten(), aktionen: [] });
  }

  // Durchstich 09.10.: ohne Arbeiter (nur `next start`) bleibt ein Agenten-Lauf ewig „wartet“ — das steht jetzt dabei.
  if (opt.arbeiterMinuten !== undefined && (opt.arbeiterMinuten === null || opt.arbeiterMinuten > ARBEITER_STILL_MIN)) {
    for (const l of raus) {
      if (l.status !== 'wartet' || l.hinweis || !(l.quelle === 'faden' || l.quelle === 'skill' || l.quelle === 'plan' || l.quelle === 'auftrag' || l.quelle === 'takt')) continue;
      if (jetzt.getTime() - Date.parse(l.start) >= WARTET_HINWEIS_MIN * 60_000) l.hinweis = arbeiterStillText(opt.arbeiterMinuten);
    }
  }
  const laufend = raus.filter(l => offen(l.status)).sort((a, b) => b.start.localeCompare(a.start));
  const fertig = raus.filter(l => !offen(l.status)).sort((a, b) => (b.ende ?? b.start).localeCompare(a.ende ?? a.start));
  return [...laufend, ...fertig.slice(0, Math.max(0, LAEUFE_MAX - laufend.length))];
}

// ── Server: Quellen laden ────────────────────────────────────────────────────────────────────────────────────────────────

/** Läufe der Person (nur Heads, die sie sieht). */
export async function laeufeLesen(person: string, jetzt: Date = new Date()): Promise<Lauf[]> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { lies } = await import('@/lib/zoe/auftraege');
  const { laeufeFuer } = await import('@/lib/agent-log');
  const { planBestand } = await import('./typen');
  const { indexLesen } = await import('./faeden-ablage');
  const { sichtbareHeads, sichtbareSkills, umfangFuer } = await import('./skills-server');
  const { standName: chefStand } = await import('@/lib/finanzen/chef/stand');
  const sicher = async <T,>(p: Promise<T>, leer: T): Promise<T> => p.catch(e => { console.error('[agenten-laeufe] Quelle nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return leer; });
  const heads = await sichtbareHeads(person);
  const sicht = new Set(heads.map(h => h.id));
  const { sichtLaden } = await import('./faeden-server');
  const privat = (await sichtLaden(person).catch(() => null))?.vollesMitglied === true;
  const umfang = await umfangFuer(person);
  const [auftraege, faedenRoh, planRoh, log, skills] = await Promise.all([
    sicher(lies(), []),
    sicher(indexLesen(person), null), // nur der Index (E3, 09.10.) — „Läuft“ fragt alle 30 s und braucht nur Köpfe
    sicher(loadJson<{ aufgaben?: Hintergrundaufgabe[] }>(planBestand(person)), null),
    sicher(laeufeFuer(person), []),
    sicher(sichtbareSkills(person, heads, umfang), []),
  ]);
  const berichte: LaufQuellen['berichte'][number][] = [];
  for (const h of ['sales', 'marketing', 'event']) {
    if (!sicht.has(h)) continue;
    const s = await sicher(loadJson<{ berichte?: BerichtRoh[] }>(`head-${h}`), null);
    if (s?.berichte?.length) berichte.push({ headId: h, quelle: 'head', berichte: s.berichte });
  }
  if (sicht.has('finanzen')) {
    const s = await sicher(loadJson<{ berichte?: BerichtRoh[] }>(chefStand(null)), null);
    if (s?.berichte?.length) berichte.push({ headId: 'finanzen', quelle: 'finanzchef', berichte: s.berichte });
  }
  if (sicht.has('finanzen-privat') && umfang.haushalt) {
    const s = await sicher(loadJson<{ berichte?: BerichtRoh[] }>(chefStand(umfang.haushalt)), null);
    if (s?.berichte?.length) berichte.push({ headId: 'finanzen-privat', quelle: 'finanzchef', berichte: s.berichte });
  }
  const { letzterTakt } = await import('@/lib/hoi/innen');
  const arbeiterMinuten = await letzterTakt(jetzt.toISOString()).catch(() => null);
  return laeufeBauen({
    auftraege: auftraege as AuftragRoh[],
    faeden: (faedenRoh?.faeden ?? []).filter(f => f.besitzer === person),
    plan: (planRoh?.aufgaben ?? []).filter(p => p.besitzer === person),
    skills: new Map(skills.map(s => [s.id, { name: s.name, headId: s.headId, zeitplan: s.ausloeser.art === 'zeitplan' }])),
    berichte,
    log,
  }, person, jetzt, { privat, arbeiterMinuten });
}

// ── Server: abbrechen, neu starten ───────────────────────────────────────────────────────────────────────────────────────

export type LaufAktionErgebnis = { ok: true; text: string; auftragId?: string } | { ok: false; status: 400 | 403 | 404 | 409; fehler: string; [k: string]: unknown };

/** Einen laufenden Thread-Lauf anhalten (Status `abgebrochen` am Thread, vor jeder Runde geprüft — R15). */
export type FadenAbbruch = (person: string, fadenId: string) => Promise<boolean>;

/**
 * Seit Paket 4b verdrahtet: der Kern (lib/agenten/faeden-server.ts) setzt „abgebrochen“ am eigenen Thread (Lauf wartet/läuft). Die Schleife
 * (lib/agenten/delegation.ts) prüft den Status vor jeder Runde und hält an. Tests können über `abbruchVerdrahten` ersetzen.
 */
export const fadenAbbruchKern: FadenAbbruch = async (person, fadenId) => {
  const { fadenAendern } = await import('./faeden-server');
  const jetzt = new Date().toISOString();
  const r = await fadenAendern(person, fadenId, f => {
    if (f.besitzer !== person || !f.lauf || (f.lauf.status !== 'wartet' && f.lauf.status !== 'laeuft')) return { ok: false, status: 409, fehler: 'Hier läuft nichts.' };
    return { ...f, status: 'abgebrochen', lauf: { ...f.lauf, status: 'abgebrochen', ende: jetzt, abgebrochenVon: person } };
  });
  return r.ok;
};
let fadenAbbruchImpl: FadenAbbruch = fadenAbbruchKern;
/** Für Tests: den Abbruch am Thread ersetzen. */
export function abbruchVerdrahten(f: FadenAbbruch): void { fadenAbbruchImpl = f; }

/**
 * Abbrechen — nur eigene Läufe. Ein wartender Auftrag wird nie mehr ausgeführt; ein laufender Agenten-Lauf verliert seine Pacht (sein
 * Ergebnis zählt nicht mehr) und bekommt `abgebrochen` am Thread. Geschrieben wird die Warteschlange NUR über lib/zoe/auftraege.ts
 * (`abbrechen`, seit Paket 4b).
 */
export async function laufAbbrechen(person: string, laufId: unknown): Promise<LaufAktionErgebnis> {
  if (typeof laufId !== 'string' || !laufId) return { ok: false, status: 400, fehler: 'Lauf fehlt.' };
  if (laufId.startsWith('fd:')) {
    const fadenId = laufId.slice(3);
    return (await fadenAbbruchImpl(person, fadenId)) ? { ok: true, text: 'Angehalten.' } : { ok: false, status: 404, fehler: 'Lauf nicht gefunden.' };
  }
  const { abbrechen } = await import('@/lib/zoe/auftraege');
  const r = await abbrechen(laufId, {
    text: ABGEBROCHEN,
    pruefe: a => {
      if (a.person !== person) return 'fremd';
      if (a.status === 'laeuft' && !(a.art === 'agent' && a.name === LAUF_AGENT)) return 'laeuft';
      return null;
    },
  });
  if (!r.ok) {
    if (r.grund === 'beendet') return { ok: false, status: 409, fehler: 'Der Lauf ist schon beendet.' };
    if (r.grund === 'abgelehnt' && r.text === 'laeuft') return { ok: false, status: 409, fehler: 'Läuft schon — anhalten lassen sich nur Agenten-Läufe.' };
    return { ok: false, status: 404, fehler: 'Lauf nicht gefunden.' };
  }
  const fadenId = typeof r.auftrag.eingabe?.fadenId === 'string' ? r.auftrag.eingabe.fadenId : null;
  if (fadenId) await fadenAbbruchImpl(person, fadenId).catch(() => false);
  return { ok: true, text: 'Abgebrochen.', auftragId: r.auftrag.id };
}

/**
 * Neu starten — nur eigene Agenten-Läufe (Thread, Skill, Plan) nach Ende/Fehler/Abbruch: derselbe Auftrag wird wieder eingereiht (von
 * Hand, also kein Takt-Lauf). Business-Heads in einer Business-freien Zeit nur mit `trotzdem` (409 sonst); über `GROSS_AB_CENT` nur mit
 * `kostenBestaetigt` (409 mit Schätzung).
 */
export async function laufNeuStarten(person: string, laufId: unknown, opt: { trotzdem?: boolean; kostenBestaetigt?: boolean } = {}): Promise<LaufAktionErgebnis> {
  if (typeof laufId !== 'string' || !laufId) return { ok: false, status: 400, fehler: 'Lauf fehlt.' };
  const { lies, reihe } = await import('@/lib/zoe/auftraege');
  const { indexLesen } = await import('./faeden-ablage');
  let eingabe: Record<string, unknown> | null = null;
  if (laufId.startsWith('fd:')) {
    const f = (await indexLesen(person)).faeden.find(x => x.id === laufId.slice(3) && x.besitzer === person);
    if (!f?.lauf) return { ok: false, status: 404, fehler: 'Lauf nicht gefunden.' };
    if (offen(f.lauf.status)) return { ok: false, status: 409, fehler: 'Der Lauf läuft noch.' };
    eingabe = f.skillId && f.agent.art !== 'zoe' ? { art: 'skill', skillId: f.skillId, headId: f.agent.headId, ausloeser: 'hand' } : f.planId ? { art: 'plan', planId: f.planId } : { art: 'faden', fadenId: f.id };
  } else {
    const a = (await lies()).find(x => x.id === laufId);
    if (!a || a.person !== person) return { ok: false, status: 404, fehler: 'Lauf nicht gefunden.' };
    if (!(a.art === 'agent' && a.name === LAUF_AGENT)) return { ok: false, status: 409, fehler: 'Neu starten geht hier nur für Agenten-Läufe.' };
    if (a.status === 'offen' || a.status === 'laeuft') return { ok: false, status: 409, fehler: 'Der Lauf läuft noch.' };
    const { batch: _b, ...rest } = a.eingabe as Record<string, unknown>;
    eingabe = rest.art === 'skill' ? { ...rest, ausloeser: 'hand' } : rest;
  }
  const pruef = await neuStartPruefen(person, eingabe!, opt);
  if (!pruef.ok) return pruef;
  const { angelegt, schonDa } = await reihe([{ art: 'agent', name: LAUF_AGENT, auftrag: JSON.stringify(eingabe), eingabe: eingabe!, person, anlass: 'Neu gestartet von Hand' }]);
  if (!angelegt.length && schonDa) return { ok: false, status: 409, fehler: 'Derselbe Lauf wartet schon.' };
  // Durchstich 09.10.: ein Thread-Lauf bekommt seinen neuen Auftrag am Thread („wartet“) — vorher blieb ein abgebrochener Thread „abgebrochen“,
  // der Arbeiter übersprang ihn („abgebrochen — nicht gelaufen“) und „Neu starten“ tat still nichts (auch nach dem Not-Aus).
  if (eingabe!.art === 'faden' && typeof eingabe!.fadenId === 'string' && angelegt[0]) {
    const { fadenAendern } = await import('./faeden-server');
    const { laufWartet } = await import('./faeden');
    const neuId = angelegt[0].id;
    await fadenAendern(person, eingabe!.fadenId, f => ({ ...f, status: 'wartet', lauf: laufWartet(new Date().toISOString(), neuId, f.lauf?.kostenGrenzeCent) })).catch(() => null);
  }
  return { ok: true, text: 'Neu gestartet.', auftragId: angelegt[0]?.id };
}

/** Gibt es Skill/Plan/Thread noch, sieht die Person den Head, ist Business-frei, wie teuer wird es? */
async function neuStartPruefen(person: string, e: Record<string, unknown>, opt: { trotzdem?: boolean; kostenBestaetigt?: boolean }): Promise<LaufAktionErgebnis> {
  const { headSichtbar, skillMitStand } = await import('./skills-server');
  const { loadJson } = await import('@/lib/store/local-db');
  const { planBestand } = await import('./typen');
  const { indexLesen } = await import('./faeden-ablage');
  const { kostenSchaetzen, gemesseneKosten, GROSS_AB_CENT } = await import('./leistung');
  let headId: string | null = null;
  let stufe: 'schnell' | 'ausgewogen' | 'stark' = 'ausgewogen';
  if (e.art === 'skill') {
    const s = await skillMitStand(person, String(e.skillId ?? ''));
    if (!s.ok) return { ok: false, status: 404, fehler: 'Den Skill gibt es nicht mehr.' };
    if (!s.skill.aktiv) return { ok: false, status: 409, fehler: 'Der Skill ist aus — erst einschalten.' };
    headId = s.skill.headId; stufe = s.skill.stufe;
  } else if (e.art === 'plan') {
    const p = (await loadJson<{ aufgaben?: Hintergrundaufgabe[] }>(planBestand(person)))?.aufgaben?.find(x => x.id === e.planId);
    if (!p) return { ok: false, status: 404, fehler: 'Die Hintergrundaufgabe gibt es nicht mehr.' };
    headId = p.agent.art === 'zoe' ? null : p.agent.headId;
  } else {
    const f = (await indexLesen(person)).faeden.find(x => x.id === e.fadenId);
    if (!f) return { ok: false, status: 404, fehler: 'Den Thread gibt es nicht mehr.' };
    headId = f.agent.art === 'zoe' ? null : f.agent.headId;
    if (f.agent.art === 'mitarbeiter') stufe = 'schnell';
  }
  const head = headId ? headDef(headId) : null;
  if (headId && (!head || !(await headSichtbar(person, headId)))) return { ok: false, status: 403, fehler: 'Diesen Head siehst du nicht.' };
  if (head?.bereich === 'business' && !opt.trotzdem) {
    const { businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
    const frei = await businessFreiJetzt(person).catch(() => ({ frei: false } as { frei: boolean; bisWand?: string }));
    if (frei.frei) return { ok: false, status: 409, fehler: 'Business-frei — trotzdem? Business-Läufe ruhen gerade.', businessFrei: true, ...(frei.bisWand ? { bis: frei.bisWand } : {}) };
  }
  if (!opt.kostenBestaetigt) {
    const s = kostenSchaetzen({ stufe: head && e.art !== 'skill' && stufe === 'ausgewogen' ? head.stufe : stufe, art: 'lauf', gemessenCent: headId ? await gemesseneKosten(person, headId) : [] });
    if (s.cent > GROSS_AB_CENT) return { ok: false, status: 409, fehler: `Der Lauf kostet ${s.text} — bitte bestätigen.`, kostenBestaetigen: true, schaetzung: s };
  }
  return { ok: true, text: '' };
}
