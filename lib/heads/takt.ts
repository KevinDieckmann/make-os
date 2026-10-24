// ─── Die Heads im Takt (rein bis auf das Laden) ────────────────────────────
// Head of Sales: werktags ab 7 Uhr die Power Hour vorbereiten, freitags ab
// 14 Uhr Wochenreview, am 1. Werktag des Monats Kundenreview.
// Head of Marketing: montags ab 8 Uhr Wochenplan, am 1. des Monats Review.
// Head of Event: Nachfassen am Tag nach einem Event, Countdown-Planung in
// den 7 Tagen davor (täglich einmal).
// Ausgeschaltet: nie. Ohne Schlüssel läuft der Takt trotzdem — dann liefert
// der Grundlauf (Regelwerk) die Vorschläge. Die Power Hour je Person im Team
// mit Konto (Riegel „power_hour:<person>“). Riegel stehen im eigenen Speicher.
// Business-frei (08.10., Lücke 7, lib/arbeitsrahmen/regel.ts): in einer Business-freien Zeit des Haushalts (gemeinsame Zeiten der
// Familie) ruhen alle Läufe; die Power Hour ruht für eine Person in IHRER Business-freien Zeit. Danach laufen sie von selbst
// („ab Uhrzeit X, einmal am Tag“). Fiel der ganze Rest eines Tages in die freie Zeit, holen die Wochen-/Monats-Läufe und das
// Nachfassen nach einem Event am nächsten freien Takt nach (höchstens 6 Tage zurück) — die täglichen (Power Hour, Vernetzen,
// Countdown) nicht, die kommen am nächsten Tag ohnehin neu.
// Personen (09.10., Agenten-Bereich Paket 4b, PRIVATE_INHALTE_SUCHE.md › E): nie ein festes Kürzel. Die Power Hour bekommt, wer im Team
// (`TEAM`, Instanz-Variable) steht UND ein Konto hat; gibt es niemanden (neue Instanz mit anderen Speichernamen), die Konten im Haushalt
// des Inhabers (Inhaber zuerst). Der alte Riegel „power_hour“ (ohne Person) gilt für den Inhaber — Rolle aus den Konten, kein Name.

import { loadJson } from '@/lib/store/local-db';
import { istNetzwerkenEvent } from '@/lib/crm/marke';
import { resolveAgent } from '@/lib/agent-config';
import type { Faellig } from '@/lib/zoe/takt';
import { ladeCrm } from '@/lib/crm/speicher';
import { AGENT_ID, HEAD_NAME, type HeadId } from './prompt';
import { TEAM } from '@/lib/crm/team';
import { ladeKonten } from '@/lib/zugang/konten';
import { hauptInhaber, kontenImHaushaltDerInhaber, type InhaberKern, type InhaberStand } from '@/lib/zugang/inhaber';
import { leererStand, standName, type HeadStand } from './stand';
import { localDay, tagVon } from '@/lib/zeit';
import { tagPlus, wandAus, wandzeit } from '@/lib/kalender/zeit';
import { wochentag } from '@/lib/zeit/kalender-kern';
import { istBusinessFrei } from '@/lib/arbeitsrahmen/regel';
import { headModusPlan, type Werte } from '@/lib/prozesse/stellschrauben-werte';

// Berliner Wandzeit (09.10., Takt robust): Tag, Wochentag und Stunde kommen aus dem Kalender-Kern — vorher aus getDay()/getHours() der
// Maschine (stimmte nur, weil der Container TZ=Europe/Berlin setzt; ein Skript oder Test ohne TZ verschob Power Hour und Reviews).
// `letzte` ist ein ISO-Zeitstempel (UTC) — sein Tag ist der Berliner Tag (`tagVon`), nie `.slice(0, 10)`.
const liefHeute = (s: HeadStand, modus: string, heute: string) => !!s.letzte[modus] && tagVon(s.letzte[modus]) === heute;
/** Lief der Modus am Tag `ab` oder später? */
const liefSeit = (s: HeadStand, modus: string, ab: string) => !!s.letzte[modus] && tagVon(s.letzte[modus]) >= ab;
/** Wochentag wie getDay(): 0 = Sonntag … 6 = Samstag — aus dem Berliner Tag. */
const wt = (tag: string) => wochentag(tag) % 7;
const istMoFr = (tag: string) => { const w = wt(tag); return w >= 1 && w <= 5; };
/** Erster Werktag (Mo–Fr) des Monats? Rein, über Kalendertage. */
const ersterWerktagVon = (tag: string) => istMoFr(tag) && !Array.from({ length: Number(tag.slice(8, 10)) - 1 }, (_, i) => `${tag.slice(0, 8)}${String(i + 1).padStart(2, '0')}`).some(istMoFr);

/** Business-frei für die Heads (Lücke 7) — ohne Angabe laufen sie wie bisher. */
export interface HeadsRahmen {
  /** Ist der Haushalt JETZT Business-frei? Dann ruhen alle Modi ohne Person. */
  haushaltFrei: boolean;
  /** Personen, die JETZT Business-frei sind — ihre Power Hour ruht. */
  personFrei: ReadonlySet<string>;
  /** War der Haushalt am Tag `tag` (lokal) um `stunde` Uhr Business-frei? Fürs Nachholen verpasster Wochen-/Monatsläufe. */
  warFrei: (tag: string, stunde: number) => boolean;
}

/**
 * Welcher Modus ist jetzt dran? Rein, getestet. `opt.modi` = die Stellschrauben der festen Prozesse (22.10., Bestand `prozesse-stellschrauben--<h>`,
 * lib/prozesse/stellschrauben-werte.ts `headModusPlan`): Uhrzeit, Wochentag, an/aus je Modus — ohne Angabe die Zeiten, die bis 22.10. hier fest standen.
 */
export function faelligeModi(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], personen: string[] = [], rahmen?: HeadsRahmen, opt: { altRiegelPerson?: string | null; modi?: Werte | null } = {}): { modus: string; grund: string; person?: string }[] {
  // Business-frei (Lücke 7): solange der Haushalt frei ist, ruht jeder Head-Lauf — danach kommt er von selbst bzw. holt nach.
  if (rahmen?.haushaltFrei) return [];
  const roh = faelligeModiRoh(head, jetzt, s, alleEvents, personen, rahmen?.personFrei, opt.altRiegelPerson ?? null, opt.modi ?? null);
  if (roh.length) return roh;
  return nachholen(head, jetzt, s, alleEvents, rahmen, opt.modi ?? null).slice(0, 1);
}

/** Tage vor heute (1 … 6, Berliner Tage), an denen `passt(tag)` gilt — jüngster zuerst. */
function letzteTage(heute: string, passt: (tag: string) => boolean): string[] {
  const raus: string[] = [];
  for (let k = 1; k <= 6; k++) { const t = tagPlus(heute, -k); if (passt(t)) raus.push(t); }
  return raus;
}

/**
 * Verpasste Wochen-/Monatsläufe und Nachfassen nach einem Event (höchstens 6 Tage zurück, der jüngste geplante Tag zählt), wenn der Lauf
 * seitdem nicht lief — EINMAL (der Riegel `letzte` des Modus). Zwei Gründe: der geplante Zeitpunkt lag in einer Business-freien Zeit des
 * Haushalts (Lücke 7) ODER — seit 09.10. (Takt robust) — der Lauf ist eingeführt (lief schon einmal) und wurde verpasst, z. B. weil die
 * App nicht lief. Ein nie gelaufener Modus (neue Instanz) wird nicht „nachgeholt“. Rein (der Aufrufer prüft, dass JETZT nicht
 * Business-frei ist).
 */
function nachholen(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], r?: HeadsRahmen, modi: Werte | null = null): { modus: string; grund: string }[] {
  const raus: { modus: string; grund: string }[] = [];
  const heute = localDay(jetzt), monat = heute.slice(0, 7);
  const P = (modus: string) => headModusPlan(modi, head, modus);
  const pruefe = (modus: string, grund: string, tage: string[], stunde: number) => {
    if (!P(modus).an) return; // Stellschraube „aus“: weder laufen noch nachholen
    const eingefuehrt = !!s.letzte[modus];
    const d = tage.find(t => eingefuehrt || !!r?.warFrei(t, stunde));
    if (!d || liefSeit(s, modus, d)) return;
    raus.push({ modus, grund: `${grund} (${r?.warFrei(d, stunde) ? 'nachgeholt nach Business-frei' : 'nachgeholt — verpasst'})` });
  };
  if (head === 'sales') {
    pruefe('wochenreview', 'Wochenreview Vertrieb', letzteTage(heute, t => wt(t) === P('wochenreview').wochentag), P('wochenreview').stunde);
    pruefe('lead_review', 'Leads qualifizieren (Wochenstart)', letzteTage(heute, t => wt(t) === P('lead_review').wochentag), P('lead_review').stunde);
    pruefe('kundenreview', 'Kundenreview zum Monatsanfang', letzteTage(heute, t => ersterWerktagVon(t) && t.slice(0, 7) === monat), P('kundenreview').stunde);
  }
  if (head === 'marketing') {
    pruefe('wochenplan', 'Wochenplan Marketing', letzteTage(heute, t => wt(t) === P('wochenplan').wochentag), P('wochenplan').stunde);
    pruefe('monatsreview', 'Monatsreview Marketing', letzteTage(heute, t => ersterWerktagVon(t) && t.slice(0, 7) === monat), P('monatsreview').stunde);
  }
  if (head === 'event') {
    const events = alleEvents.filter(e => !istNetzwerkenEvent(e) && e.status !== 'abgesagt');
    const tageNachEvent = letzteTage(heute, t => events.some(e => e.datum === tagPlus(t, -1)));
    pruefe('nachfassen', 'Nachfassen nach dem Event (48 h)', tageNachEvent, P('nachfassen').stunde);
  }
  return raus;
}

function faelligeModiRoh(head: HeadId, jetzt: Date, s: HeadStand, alleEvents: { datum: string; status: string; marke?: string }[], personen: string[], personFrei: ReadonlySet<string> = new Set(), altRiegelPerson: string | null = null, modi: Werte | null = null): { modus: string; grund: string; person?: string }[] {
  // Fremde Veranstaltungen aus „Netzwerken“ (Marke „Netzwerken“) sind keine Make.One-Events: kein Nachfassen/Countdown dafür.
  const events = alleEvents.filter(e => !istNetzwerkenEvent(e));
  const heute = localDay(jetzt), w = wt(heute), h = Number(wandzeit(jetzt).slice(11, 13)), werktag = w >= 1 && w <= 5;
  const raus: { modus: string; grund: string; person?: string }[] = [];
  const ersterWerktag = Number(heute.slice(8, 10)) <= 3 && ersterWerktagVon(heute);
  // Stellschrauben (22.10.): je Modus an/aus, ab Stunde, Wochentag — ohne Eintrag genau die Zeiten von vorher (lib/prozesse/stellschrauben-werte.ts HEAD_MODI).
  const P = (modus: string) => headModusPlan(modi, head, modus);
  /** Ist der Modus jetzt dran (an, Stunde erreicht, ggf. der Wochentag)? */
  const dran = (modus: string) => { const p = P(modus); return p.an && h >= p.stunde && (p.wochentag === undefined || w === p.wochentag); };
  if (head === 'sales') {
    for (const p of personen) if (werktag && dran('power_hour') && !personFrei.has(p) && !liefHeute(s, `power_hour:${p}`, heute) && !(p === altRiegelPerson && liefHeute(s, 'power_hour', heute))) raus.push({ modus: 'power_hour', grund: `Power Hour vorbereiten (${p.charAt(0).toUpperCase() + p.slice(1)})`, person: p });
    if (dran('wochenreview') && !liefHeute(s, 'wochenreview', heute)) raus.push({ modus: 'wochenreview', grund: 'Wochenreview Vertrieb' });
    if (dran('lead_review') && !liefHeute(s, 'lead_review', heute)) raus.push({ modus: 'lead_review', grund: 'Leads qualifizieren (Wochenstart)' });
    if (ersterWerktag && dran('kundenreview') && !liefHeute(s, 'kundenreview', heute)) raus.push({ modus: 'kundenreview', grund: 'Kundenreview zum Monatsanfang' });
  }
  if (head === 'marketing') {
    if (dran('wochenplan') && !liefHeute(s, 'wochenplan', heute)) raus.push({ modus: 'wochenplan', grund: 'Wochenplan Marketing' });
    // LinkedIn (25.09.): werktags ab 8 Uhr die Vernetzen-Portion planen — reines Regelwerk, kostet kein Guthaben.
    if (werktag && dran('netzwerk') && !liefHeute(s, 'netzwerk', heute)) raus.push({ modus: 'netzwerk', grund: 'Netzwerk: Vernetzen-Runde für heute planen' });
    if (ersterWerktag && dran('monatsreview') && !liefHeute(s, 'monatsreview', heute)) raus.push({ modus: 'monatsreview', grund: 'Monatsreview Marketing' });
  }
  if (head === 'event') {
    const gestern = tagPlus(heute, -1);
    const bald = events.some(e => e.status !== 'abgesagt' && e.datum > heute && e.datum <= tagPlus(heute, 7));
    if (dran('nachfassen') && events.some(e => e.datum === gestern && e.status !== 'abgesagt') && !liefHeute(s, 'nachfassen', heute)) raus.push({ modus: 'nachfassen', grund: 'Nachfassen nach dem Event (48 h)' });
    if (dran('planung') && bald && !liefHeute(s, 'planung', heute)) raus.push({ modus: 'planung', grund: 'Countdown bis zum Event' });
  }
  return raus.slice(0, 1); // höchstens ein Lauf je Head und Takt — die nächste Person kommt im nächsten Takt
}

/** Der Rahmen für die Heads (Lücke 7) — Fehler beim Lesen → kein Rahmen (wie bisher). */
async function headsRahmen(jetzt: Date, personen: readonly string[]): Promise<HeadsRahmen | undefined> {
  try {
    const { haushaltBusinessFreiJetzt, haushaltFensterFuer, businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
    const heute = localDay(jetzt);
    const [hf, spannen, frei] = await Promise.all([
      haushaltBusinessFreiJetzt(jetzt),
      haushaltFensterFuer(tagPlus(heute, -7), tagPlus(heute, 1)),
      Promise.all(personen.map(async p => ((await businessFreiJetzt(p, jetzt)).frei ? p : null))),
    ]);
    return { haushaltFrei: hf.frei, personFrei: new Set(frei.filter((p): p is string => !!p)), warFrei: (t, stunde) => istBusinessFrei(spannen, wandAus(t, stunde * 60)) };
  } catch { return undefined; }
}

/**
 * Wer eine Power Hour bekommt (rein): Team-Mitglieder (`TEAM`) mit Konto; gibt es keines, die Konten im Haushalt des Inhabers (Inhaber
 * zuerst) — so läuft der Takt auch in einer neuen Instanz mit anderen Speichernamen. Nie ein festes Kürzel.
 */
export function powerHourPersonen(team: readonly { id: string }[], konten: readonly { speicher: string; rolle?: string; haushalt?: string }[], einstellungen?: InhaberStand['einstellungen']): string[] {
  const mitKonto = new Set(konten.map(k => k.speicher));
  const ausTeam = team.map(t => t.id).filter(id => mitKonto.has(id));
  if (ausTeam.length) return ausTeam;
  // Nahtstellen-Prüfung Punkt 9: der Haupt-Inhaber und sein Haushalt aus der zentralen Regel (lib/zugang/inhaber.ts) — mit zwei Inhabern zählt
  // die ausdrückliche Wahl, sonst das älteste Inhaber-Konto (dieselbe Wahl wie vorher).
  const st: InhaberStand = { konten: konten.map(k => ({ speicher: k.speicher, rolle: (k.rolle ?? 'mitglied') as InhaberKern['rolle'], ...(k.haushalt ? { haushalt: k.haushalt } : {}) })), einstellungen };
  const haupt = hauptInhaber(st);
  if (!haupt) return [];
  return [haupt.speicher, ...kontenImHaushaltDerInhaber(st).filter(k => k.speicher !== haupt.speicher).map(k => k.speicher)];
}

/**
 * Der Auftrag „Power Hour vorbereiten“ für eine Person — EINE Stelle für den Takt der Heads und den festen Schritt der Werkstatt (Paket Ü 2, Kennungs-Brücke): derselbe
 * Auftrag, derselbe Schlüssel der Warteschlange (`schluesselFuer`) — umgeschaltet mitten am Tag reiht nie doppelt ein.
 */
export function powerHourFaellig(person: string): Faellig {
  const grund = `Power Hour vorbereiten (${person.charAt(0).toUpperCase() + person.slice(1)})`;
  return { id: `${AGENT_ID.sales}-power_hour-${person}`, grund: `${HEAD_NAME.sales}: ${grund}`, auftrag: { art: 'agent', name: AGENT_ID.sales, auftrag: `modus:power_hour person:${person}`, anlass: `Takt: ${HEAD_NAME.sales} (${grund})` } };
}

/** Der Teil von „Follow-up & Power Hour“, der in die Werkstatt umziehen kann (lib/prozesse/ueberfuehrung.ts `UEBERFUEHRBAR`). */
const UEBERFUEHRT_SP = 'sp-followup';

export async function headsFaellig(jetzt: Date): Promise<Faellig[]> {
  const crm = await ladeCrm();
  // Nur Personen mit Konto bekommen eine vorbereitete Power Hour (Team der Instanz, sonst der Haushalt des Inhabers).
  const kst = await ladeKonten();
  const personen = powerHourPersonen(TEAM, kst.konten, kst.einstellungen);
  const altRiegelPerson = hauptInhaber(kst)?.speicher ?? null;
  const rahmen = await headsRahmen(jetzt, personen);
  // Stellschrauben der festen Prozesse (22.10.): Uhrzeit, Wochentag, an/aus je Modus — nicht lesbar = die Zeiten von vorher.
  const modi = await (await import('@/lib/prozesse/stellschrauben-werte-server')).stellschraubenWerte();
  // Ablöse-Weiche (Paket Ü 2): arbeitet der überführte Prozess scharf, bereitet ER die Power Hour vor — der Takt der Heads lässt sie aus (die übrigen Modi bleiben).
  // Nicht lesbar → alter Weg (nie keiner, nie beide).
  const weg = await (await import('@/lib/prozesse/ueberfuehrung-server')).wegFuer('sp-followup');
  const raus: Faellig[] = [];
  for (const head of ['sales', 'marketing', 'event'] as HeadId[]) {
    if (!(await resolveAgent(AGENT_ID[head])).enabled) continue;
    const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(head))) ?? {}) };
    for (const m of faelligeModi(head, jetzt, s, crm.events, head === 'sales' && weg.weg === 'neu' ? [] : personen, rahmen, { altRiegelPerson, modi })) {
      raus.push(m.modus === 'power_hour' && m.person ? powerHourFaellig(m.person)
        : { id: `${AGENT_ID[head]}-${m.modus}${m.person ? `-${m.person}` : ''}`, grund: `${HEAD_NAME[head]}: ${m.grund}`, auftrag: { art: 'agent', name: AGENT_ID[head], auftrag: `modus:${m.modus}${m.person ? ` person:${m.person}` : ''}`, anlass: `Takt: ${HEAD_NAME[head]} (${m.grund})` } });
    }
  }
  return raus;
}

// ══ Power Hour als fester Schritt (24.10., Paket Ü 2 — lib/prozesse/system-schritte-server.ts) ═════════════════════════════════════════════════════════

const POWER_HOUR_AUFTRAG = /^modus:power_hour person:([a-z0-9][a-z0-9_-]{0,63})$/;

/** Wirkungsbild einer vorbereiteten Power Hour (nur Kennungen: Fingerabdruck der Person, Tag) — alter und neuer Weg bauen es mit DIESER Funktion. */
export async function powerHourBild(person: string, tag: string): Promise<import('@/lib/prozesse/ueberfuehrung').Wirkungsbild> {
  const { personSchluessel } = await import('@/lib/prozesse/ausloeser');
  return { art: 'auftrag', ziel: `power_hour:${personSchluessel(person)}`, tag, zustaendig: person };
}

export type PowerHourStatus = 'eingereiht' | 'schon' | 'nicht-dran' | 'gesperrt' | 'voll';
/**
 * Der Kern der Power-Hour-Vorbereitung für EINE Person (der feste Schritt `power-hour`): DIESELBE Regel wie der Takt der Heads (`faelligeModi` mit genau dieser
 * Person — an/aus und Stunde aus den Stellschrauben, Mo–Fr, Business-frei, Riegel `power_hour:<person>`), danach dieselben Sperren (`sperrenFiltern`: Not-Aus,
 * Head-Budget, Pause nach Fehlern) und derselbe Auftrag (`powerHourFaellig`). `schreiben` reiht ein; ohne rechnet er nur — und zählt einen Riegel von HEUTE nicht
 * (das Soll des Tages: hätte der alte Weg heute vorbereitet?).
 */
export async function powerHourKern(person: string, jetzt: Date, o: { schreiben: boolean }): Promise<{ status: PowerHourStatus; bild: import('@/lib/prozesse/ueberfuehrung').Wirkungsbild[]; auftragId?: string }> {
  const tag = localDay(jetzt);
  if (!(await resolveAgent(AGENT_ID.sales)).enabled) return { status: 'nicht-dran', bild: [] };
  const kst = await ladeKonten();
  if (!powerHourPersonen(TEAM, kst.konten, kst.einstellungen).includes(person)) return { status: 'nicht-dran', bild: [] };
  const altRiegelPerson = hauptInhaber(kst)?.speicher ?? null;
  const rahmen = await headsRahmen(jetzt, [person]);
  const modi = await (await import('@/lib/prozesse/stellschrauben-werte-server')).stellschraubenWerte();
  const s0 = { ...leererStand(), ...((await loadJson<HeadStand>(standName('sales'))) ?? {}) };
  const schonHeute = liefHeute(s0, `power_hour:${person}`, tag) || (person === altRiegelPerson && liefHeute(s0, 'power_hour', tag));
  // Im Schatten zählt ein Riegel von heute nicht (sonst sähe der neue Weg „nichts zu tun“, wo der alte heute schon vorbereitet hat).
  const s = o.schreiben ? s0 : { ...s0, letzte: Object.fromEntries(Object.entries(s0.letzte).filter(([k, v]) => !((k === `power_hour:${person}` || k === 'power_hour') && tagVon(v) === tag))) };
  const dran = faelligeModi('sales', jetzt, s, [], [person], rahmen, { altRiegelPerson, modi }).some(m => m.modus === 'power_hour' && m.person === person);
  if (!dran) return { status: o.schreiben && schonHeute ? 'schon' : 'nicht-dran', bild: o.schreiben && schonHeute ? [await powerHourBild(person, tag)] : [] };
  const f = powerHourFaellig(person);
  const { sperrenFiltern } = await import('@/lib/zoe/takt');
  if (!(await sperrenFiltern([f], jetzt)).length) return { status: 'gesperrt', bild: [] };
  if (!o.schreiben) return { status: 'eingereiht', bild: [await powerHourBild(person, tag)] };
  const r = await (await import('@/lib/zoe/auftraege')).reihe([f.auftrag], jetzt);
  if (r.abgelehnt) return { status: 'voll', bild: [] };
  return { status: r.angelegt.length ? 'eingereiht' : 'schon', bild: [await powerHourBild(person, tag)], ...(r.angelegt[0] ? { auftragId: r.angelegt[0].id } : {}) };
}

/**
 * Der alte Weg meldet dem Schatten-Vergleich, was er WIRKLICH eingereiht hat (Paket Ü 2; aus der Takt-Route nach `reihe` — GET schaut nur voraus und meldet nie):
 * je neu eingereihtem Auftrag „Power Hour vorbereiten“ das Wirkungsbild. Nur, solange der überführte Prozess im Schatten läuft. Wirft nie.
 */
export async function powerHourEingereihtMelden(angelegt: readonly { name: string; auftrag?: string; zeit: string }[]): Promise<void> {
  try {
    const ph = angelegt.map(a => (a.name === AGENT_ID.sales ? POWER_HOUR_AUFTRAG.exec(a.auftrag ?? '')?.[1] : undefined) ? { person: POWER_HOUR_AUFTRAG.exec(a.auftrag ?? '')![1], tag: localDay(new Date(a.zeit)) } : null).filter((x): x is { person: string; tag: string } => !!x);
    if (!ph.length) return;
    const { wegFuer, vergleichMeldenServer } = await import('@/lib/prozesse/ueberfuehrung-server');
    if (!(await wegFuer(UEBERFUEHRT_SP)).schatten) return;
    for (const tag of Array.from(new Set(ph.map(x => x.tag)))) await vergleichMeldenServer(UEBERFUEHRT_SP, 'alt', tag, await Promise.all(ph.filter(x => x.tag === tag).map(x => powerHourBild(x.person, tag))));
  } catch (err) {
    console.error(`[heads/takt] Schatten-Meldung der Power Hour ausgefallen — ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`);
  }
}
