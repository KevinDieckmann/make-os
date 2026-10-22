// ─── Prozesse — Auslöser (Etappe B1, 21.10.; ANALYSE_100.md Punkte 31, 32; Entscheidung 21.10.: Webhook „Ja, abgesichert“) ──────────────────────────────
// Ein Prozess startet über einen Auslöser-Knoten (Form `ausloeser`, im ersten Teil der ersten Phase):
//   ereignis   eine Ereignis-Art (= `SkillEreignis`, lib/agenten/typen.ts — keine zweite Liste) + „nur wenn …“ über Felder (lib/prozesse/bedingung.ts).
//              Nur angebundene Arten (lib/ereignisse/arten.ts); Business-Prozesse hören nie auf Privates (`ausloeserPasst`).
//   zeitplan   Rhythmus + Uhrzeit (dieselbe Prüfung wie die Skills, lib/agenten/zeitplan.ts `wiederkehrendPruefen`).
//   datum      „n Tage vor/nach einem Datum am Fall“ — hier NUR das Modell; gerechnet wird mit dem Motor über die vorhandenen Fristen-Leser (Punkt 34, C).
//   hand       von Hand.
//   webhook    eigene Adresse mit eigenem Schlüssel (lib/prozesse/webhook*.ts); das Schema hier sagt, welche Felder angenommen werden — der Rest wird
//              verworfen; alles Eingehende ist fremder Text.
//   loop       nach einem der vorhandenen Loops (app/api/loop/route.ts: morgen · woche · rueckblick) — „nach dem Morgen-Loop“ (Entscheidung 21.10.).
// Rein und client-sicher; Tests: tests/prozesse-ausloeser.test.ts.

import { EREIGNISSE_ANGEBUNDEN, EREIGNISSE_INTERN, EREIGNIS_NAME, istEreignisArt } from '@/lib/ereignisse/arten';
import type { Ereignis } from '@/lib/ereignisse/typen';
import { wiederkehrendPruefen } from '@/lib/agenten/zeitplan-regeln';
import {
  FELD_KENNUNG, LOOP_ARTEN, PROZESS_GRENZEN, PROZESS_TEXT, WEBHOOK_FELD_ARTEN,
  type Ausloeser, type AusloeserArt, type Befund, type DatumsFeld, type FallArt, type LoopArt, type SkillEreignis, type WebhookFeld, type WebhookFeldArt,
} from './definition';
import { bedingungenAus, bedingungenTreffen, verknuepfungAus } from './bedingung';
import { KG_FALL_FELDER } from './kundengewinnung/felder';

type O = Record<string, unknown>;
const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);

/** Wie die Auslöser-Arten heißen. */
export const AUSLOESER_NAME: Readonly<Record<AusloeserArt, string>> = {
  ereignis: 'Ereignis', zeitplan: 'Zeitplan', datum: 'Datum am Fall', hand: 'von Hand', webhook: 'Webhook von außen', loop: 'nach einem Loop',
};
/** Wie die Loops heißen. */
export const LOOP_NAME: Readonly<Record<LoopArt, string>> = { morgen: 'Morgen-Loop', woche: 'Wochen-Loop', rueckblick: 'Rückblick' };

/** Ereignis-Arten, die einen Prozess starten dürfen: angebunden (eine Quelle speist sie) und nicht intern. `webhook` startet nur über den Webhook-Auslöser. */
export const PROZESS_EREIGNISSE: readonly SkillEreignis[] = EREIGNISSE_ANGEBUNDEN.filter(a => !EREIGNISSE_INTERN.includes(a));
export const ereignisStartetProzess = (a: SkillEreignis): boolean => PROZESS_EREIGNISSE.includes(a);

// ── Felder für „nur wenn …“ ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FeldDef { id: string; titel: string; art: 'text' | 'zahl' | 'datum' | 'kennung' | 'ja-nein' }
/** Felder jedes Ereignisses (aus dem Ereignis selbst — nur Kennungen, Art, Quelle, Bereich, Stufe). */
export const EREIGNIS_FELDER: readonly FeldDef[] = [
  { id: 'ereignis.quelle', titel: 'Quelle', art: 'text' },
  { id: 'ereignis.stufe', titel: 'Stufe (Deal)', art: 'text' },
  { id: 'bezug.kontaktid', titel: 'Kontakt', art: 'kennung' },
  { id: 'bezug.firmaid', titel: 'Firma', art: 'kennung' },
  { id: 'bezug.dealid', titel: 'Deal', art: 'kennung' },
  { id: 'bezug.mandatid', titel: 'Mandat', art: 'kennung' },
  { id: 'bezug.rechnungid', titel: 'Rechnung', art: 'kennung' },
  { id: 'bezug.aufgabeid', titel: 'Aufgabe', art: 'kennung' },
  // C1 (21.10., M3): der Termin als Feld (Termin vorbei, Termin abgesagt) und der Schritt eines Fulfillment-Falls (Fall-Schritt erledigt).
  { id: 'bezug.terminuid', titel: 'Termin', art: 'kennung' },
  { id: 'bezug.knotenid', titel: 'Schritt (Fall)', art: 'kennung' },
  // Kundengewinnung (22.10.): Ereignisse zu Events, Kampagnen, Angeboten und Buchungsseiten (lib/ereignisse/quellen-kundengewinnung.ts).
  { id: 'bezug.eventid', titel: 'Event', art: 'kennung' },
  { id: 'bezug.kampagneid', titel: 'Kampagne', art: 'kennung' },
  { id: 'bezug.angebotid', titel: 'Angebot', art: 'kennung' },
  { id: 'bezug.terminbuchungid', titel: 'Buchung (Buchungsseite)', art: 'kennung' },
  // Prozesse × Fulfillment (22.10.): das Produkt eines gebuchten Zusatzmoduls.
  { id: 'bezug.leistungid', titel: 'Produkt (Zusatzmodul)', art: 'kennung' },
];
/** Felder des Falls (der Motor lädt den Fall über die vorhandenen Lesewege, Etappe C) — je Fall-Art. Nie Namen oder Freitext Dritter. */
export const FALL_FELDER: Readonly<Record<FallArt, readonly FeldDef[]>> = {
  lead: [
    { id: 'lead.status', titel: 'Lead-Status', art: 'text' }, { id: 'lead.temperatur', titel: 'Temperatur', art: 'text' },
    { id: 'lead.score', titel: 'Score', art: 'zahl' }, { id: 'lead.bean', titel: 'Kundengruppe (BEAN)', art: 'text' },
    { id: 'lead.herkunft', titel: 'Herkunft', art: 'text' }, { id: 'lead.zustaendig', titel: 'Zuständig', art: 'kennung' },
    { id: 'lead.lifecycle', titel: 'Lifecycle', art: 'text' }, { id: 'lead.sql-bereit', titel: 'SQL-bereit', art: 'ja-nein' },
    { id: 'lead.mql', titel: 'MQL erreicht', art: 'ja-nein' }, { id: 'lead.tage-ohne-kontakt', titel: 'Tage ohne Kontakt', art: 'zahl' },
    // Kundengewinnung (22.10.): Felder der 18 Vorlagen — ein Block in ./kundengewinnung/felder.ts (mit dem Leser, aus dem der Motor den Wert holt).
    ...KG_FALL_FELDER.lead,
  ],
  deal: [
    { id: 'deal.stufe', titel: 'Stufe', art: 'text' }, { id: 'deal.wert', titel: 'Wert', art: 'zahl' },
    { id: 'deal.gesellschaft', titel: 'Gesellschaft', art: 'kennung' }, { id: 'deal.zustaendig', titel: 'Zuständig', art: 'kennung' },
    { id: 'deal.entscheidung', titel: 'Entscheidung bis', art: 'datum' },
    ...KG_FALL_FELDER.deal,
  ],
  mandat: [
    { id: 'mandat.status', titel: 'Status', art: 'text' }, { id: 'mandat.gesellschaft', titel: 'Gesellschaft', art: 'kennung' },
    { id: 'mandat.produkt', titel: 'Produkt', art: 'kennung' }, { id: 'mandat.zustaendig', titel: 'Zuständig', art: 'kennung' },
    ...KG_FALL_FELDER.mandat,
  ],
  event: [
    { id: 'event.reihe', titel: 'Reihe', art: 'text' }, { id: 'event.marke', titel: 'Marke', art: 'text' },
    { id: 'event.anmeldung', titel: 'Anmeldung', art: 'text' }, { id: 'event.datum', titel: 'Datum', art: 'datum' },
    ...KG_FALL_FELDER.event,
  ],
  firma: [
    { id: 'firma.bean', titel: 'Kundengruppe (BEAN)', art: 'text' }, { id: 'firma.lead-status', titel: 'Lead-Status', art: 'text' },
    ...KG_FALL_FELDER.firma,
  ],
  // C1 (21.10., M3): Kampagnen-Playbooks als Prozesse.
  kampagne: [
    { id: 'kampagne.status', titel: 'Status', art: 'text' }, { id: 'kampagne.playbook', titel: 'Playbook', art: 'text' }, { id: 'kampagne.kanal', titel: 'Kanal', art: 'text' },
    ...KG_FALL_FELDER.kampagne,
  ],
  keiner: [...KG_FALL_FELDER.keiner],
};
/** Datumsfelder am Fall (Auslöser „Datum“, Warten bis Datum) — je Fall-Art. */
export const DATUMS_FELDER: readonly { id: DatumsFeld; titel: string; fall: FallArt }[] = [
  { id: 'mandat.kuendigungsfrist', titel: 'Kündigungsfrist des Mandats', fall: 'mandat' },
  { id: 'mandat.review', titel: 'Nächstes Review', fall: 'mandat' },
  { id: 'mandat.start', titel: 'Start des Mandats', fall: 'mandat' },
  { id: 'mandat.ende', titel: 'Ende des Mandats', fall: 'mandat' },
  { id: 'deal.entscheidung', titel: 'Entscheidung bis', fall: 'deal' },
  { id: 'angebot.gueltig-bis', titel: 'Angebot gültig bis', fall: 'deal' },
  { id: 'rechnung.faellig', titel: 'Rechnung fällig', fall: 'mandat' },
  { id: 'event.datum', titel: 'Tag des Events', fall: 'event' },
  { id: 'lead.wiedervorlage', titel: 'Wiedervorlage des Leads', fall: 'lead' },
];
export const datumsFelderFuer = (fall: FallArt): readonly DatumsFeld[] => DATUMS_FELDER.filter(d => d.fall === fall).map(d => d.id);

/** Webhook-Felder heißen im Lauf `webhook.<id>`. */
export const webhookFeldSchluessel = (id: string): string => `webhook.${id}`;

/** Welche Felder ein Auslöser in „nur wenn …“ nennen darf (rein). */
export function ausloeserFelder(a: Ausloeser | { art: AusloeserArt; felder?: readonly WebhookFeld[] }, fall: FallArt): string[] {
  if (a.art === 'webhook') return (a.felder ?? []).map(f => webhookFeldSchluessel(f.id));
  if (a.art === 'ereignis') return [...EREIGNIS_FELDER, ...FALL_FELDER[fall]].map(f => f.id);
  return [];
}

// ── Prüfen (Eingaben aus der Werkstatt) ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const UHRZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Das Schema eines Webhooks säubern und prüfen (rein): eindeutige Feld-Kennungen, bekannte Arten, Auswahl mit Optionen, Textlänge, Anzahl. */
export function webhookFelderAus(roh: unknown): { felder: WebhookFeld[]; befunde: Befund[] } {
  const befunde: Befund[] = [];
  if (roh === undefined || roh === null) return { felder: [], befunde };
  if (!Array.isArray(roh)) return { felder: [], befunde: [{ stufe: 'fehler', text: 'Webhook-Felder: als Liste.' }] };
  if (roh.length > PROZESS_GRENZEN.webhookFelder) befunde.push({ stufe: 'fehler', text: `Webhook: höchstens ${PROZESS_GRENZEN.webhookFelder} Felder (jetzt ${roh.length}).` });
  const felder: WebhookFeld[] = [];
  const ids = new Set<string>();
  roh.forEach((x, i) => {
    const nr = `Webhook-Feld ${i + 1}`;
    if (!istObj(x)) { befunde.push({ stufe: 'fehler', text: `${nr}: unlesbar.` }); return; }
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    if (!FELD_KENNUNG.test(id)) { befunde.push({ stufe: 'fehler', text: `${nr}: Kennung aus a–z, 0–9, Punkt, Bindestrich oder Unterstrich.` }); return; }
    if (ids.has(id)) { befunde.push({ stufe: 'fehler', text: `${nr}: „${id}“ gibt es schon.` }); return; }
    const art = (WEBHOOK_FELD_ARTEN as readonly string[]).includes(x.art as string) ? x.art as WebhookFeldArt : null;
    if (!art) { befunde.push({ stufe: 'fehler', text: `${nr}: Art ${WEBHOOK_FELD_ARTEN.join(', ')}.` }); return; }
    ids.add(id);
    const f: WebhookFeld = { id, art };
    if (x.pflicht === true) f.pflicht = true;
    if (art === 'auswahl') {
      const o = Array.isArray(x.optionen) ? Array.from(new Set(x.optionen.filter((y): y is string => typeof y === 'string' && !!y.trim()).map(y => y.trim()))) : [];
      if (!o.length) { befunde.push({ stufe: 'fehler', text: `${nr}: eine Auswahl braucht Optionen.` }); return; }
      if (o.length > PROZESS_GRENZEN.optionen || o.some(y => y.length > PROZESS_TEXT.feldText)) { befunde.push({ stufe: 'fehler', text: `${nr}: höchstens ${PROZESS_GRENZEN.optionen} kurze Optionen.` }); return; }
      f.optionen = o;
    }
    if (art === 'text' && x.max !== undefined) {
      const m = x.max;
      if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > PROZESS_TEXT.webhookText) { befunde.push({ stufe: 'fehler', text: `${nr}: Länge 1 bis ${PROZESS_TEXT.webhookText} Zeichen.` }); return; }
      f.max = m;
    }
    felder.push(f);
  });
  return { felder, befunde };
}

/**
 * Einen Auslöser säubern und prüfen (rein). `fehler` = unlesbar (nicht speicherbar), `offen` = unvollständig (Entwurf ja, Veröffentlichen nein).
 * Ohne brauchbare Art: kein Auslöser (null) und ein Befund.
 */
export function ausloeserAus(roh: unknown, fall: FallArt, knotenId?: string): { ausloeser: Ausloeser | null; befunde: Befund[] } {
  const b = (stufe: Befund['stufe'], text: string): Befund => ({ stufe, text, ...(knotenId ? { knotenId } : {}) });
  if (!istObj(roh)) return { ausloeser: null, befunde: [b('offen', 'Auslöser: wähle Ereignis, Zeitplan, Datum, von Hand, Webhook oder Loop.')] };
  switch (roh.art) {
    case 'hand': return { ausloeser: { art: 'hand' }, befunde: [] };
    case 'zeitplan': {
      const w = wiederkehrendPruefen(roh);
      return w.ok ? { ausloeser: { art: 'zeitplan', ...w.wert }, befunde: [] } : { ausloeser: null, befunde: [b(w.status === 413 ? 'fehler' : 'offen', `Zeitplan: ${w.fehler}`)] };
    }
    case 'ereignis': {
      if (!istEreignisArt(roh.ereignis)) return { ausloeser: null, befunde: [b('offen', 'Ereignis: welches?')] };
      const e = roh.ereignis as SkillEreignis;
      const { bedingungen, befunde } = bedingungenAus(roh.bedingungen, ausloeserFelder({ art: 'ereignis' }, fall), 'Nur wenn');
      const v = verknuepfungAus(roh.verknuepfung);
      const raus: Befund[] = befunde.map(x => ({ ...x, ...(knotenId ? { knotenId } : {}) }));
      if (!ereignisStartetProzess(e)) raus.push(b('offen', `„${EREIGNIS_NAME[e]}“ startet keinen Prozess${EREIGNISSE_INTERN.includes(e) ? '' : ' — noch nicht angebunden'}.`));
      return { ausloeser: { art: 'ereignis', ereignis: e, ...(bedingungen.length ? { bedingungen } : {}), ...(v && bedingungen.length > 1 ? { verknuepfung: v } : {}) }, befunde: raus };
    }
    case 'datum': {
      const erlaubt = datumsFelderFuer(fall);
      const feld = roh.feld as DatumsFeld;
      const raus: Befund[] = [];
      if (!erlaubt.includes(feld)) raus.push(b('offen', erlaubt.length ? `Datum: eines von ${DATUMS_FELDER.filter(d => d.fall === fall).map(d => d.titel).join(', ')}.` : 'Datum am Fall gibt es nur mit einem Fall (Lead, Deal, Mandat, Event).'));
      const vt = roh.versatzTage;
      const versatz = typeof vt === 'number' && Number.isInteger(vt) && Math.abs(vt) <= 365 ? vt : null;
      if (versatz === null) raus.push(b('offen', 'Datum: Versatz in ganzen Tagen (−365 bis 365).'));
      const uhr = typeof roh.uhrzeit === 'string' && UHRZEIT.test(roh.uhrzeit) ? roh.uhrzeit : undefined;
      if (roh.uhrzeit !== undefined && roh.uhrzeit !== null && !uhr) raus.push(b('fehler', 'Datum: Uhrzeit als „HH:MM“.'));
      if (raus.length) return { ausloeser: null, befunde: raus };
      return { ausloeser: { art: 'datum', feld, versatzTage: versatz!, ...(roh.werktage === true ? { werktage: true } : {}), ...(uhr ? { uhrzeit: uhr } : {}) }, befunde: [] };
    }
    case 'webhook': {
      const { felder, befunde } = webhookFelderAus(roh.felder);
      const bed = bedingungenAus(roh.bedingungen, felder.map(f => webhookFeldSchluessel(f.id)), 'Nur wenn');
      const v = verknuepfungAus(roh.verknuepfung);
      const raus = [...befunde, ...bed.befunde].map(x => ({ ...x, ...(knotenId ? { knotenId } : {}) }));
      return {
        ausloeser: { art: 'webhook', felder, ...(bed.bedingungen.length ? { bedingungen: bed.bedingungen } : {}), ...(v && bed.bedingungen.length > 1 ? { verknuepfung: v } : {}) },
        befunde: raus,
      };
    }
    case 'loop': {
      const l = (LOOP_ARTEN as readonly string[]).includes(roh.loop as string) ? roh.loop as LoopArt : null;
      return l ? { ausloeser: { art: 'loop', loop: l }, befunde: [] } : { ausloeser: null, befunde: [b('offen', `Loop: ${LOOP_ARTEN.map(x => LOOP_NAME[x]).join(', ')}.`)] };
    }
    default: return { ausloeser: null, befunde: [b('offen', 'Auslöser: wähle Ereignis, Zeitplan, Datum, von Hand, Webhook oder Loop.')] };
  }
}

// ── Auswerten (Motor, Etappe C — rein und schon hier getestet) ─────────────────────────────────────────────────────────────────────────────────────

/** Ein Ereignis als flache Felder für „nur wenn …“ (nur Kennungen, Art, Quelle, Bereich, Stufe — so steht es im Bestand). Schlüssel klein. */
export function ereignisDaten(e: Pick<Ereignis, 'art' | 'quelle' | 'bezug' | 'bereich' | 'stufe'>): Record<string, string> {
  const raus: Record<string, string> = { 'ereignis.art': e.art, 'ereignis.quelle': e.quelle };
  if (e.bereich) raus['ereignis.bereich'] = e.bereich;
  if (e.stufe) raus['ereignis.stufe'] = e.stufe;
  for (const [k, v] of Object.entries(e.bezug ?? {})) if (typeof v === 'string' && v) raus[`bezug.${k.toLowerCase()}`] = v;
  return raus;
}

/**
 * Passt ein Ereignis zu einem Auslöser? (rein) — Art gleich, NIE ein privates Ereignis (Prozesse sind Business, Punkt 38), Webhook nur für den eigenen
 * Prozess, dann „nur wenn …“ über `daten` (Ereignis-Felder, vom Motor um Fall-Felder bzw. die Felder des Webhook-Eingangs ergänzt).
 */
export function ausloeserPasst(a: Ausloeser, prozessId: string, e: Pick<Ereignis, 'art' | 'bereich' | 'bezug'>, daten: Readonly<Record<string, unknown>>): boolean {
  if (e.bereich === 'privat') return false;
  if (a.art === 'ereignis') return e.art === a.ereignis && ereignisStartetProzess(a.ereignis) && bedingungenTreffen(a.bedingungen, daten, a.verknuepfung);
  if (a.art === 'webhook') return e.art === 'webhook' && e.bezug?.prozessId === prozessId && bedingungenTreffen(a.bedingungen, daten, a.verknuepfung);
  return false;
}

/** Startet dieser Auslöser nach dem Loop `loop`? (rein — der Motor fragt nach jedem Loop-Lauf.) */
export const startetNachLoop = (a: Ausloeser, loop: LoopArt): boolean => a.art === 'loop' && a.loop === loop;

/** Der Auslöser als Satz (Steckbrief, Liste, Vorlesen). */
export function ausloeserText(a: Ausloeser): string {
  switch (a.art) {
    case 'hand': return 'von Hand';
    case 'zeitplan': return `${{ taeglich: 'täglich', werktags: 'werktags', woechentlich: 'wöchentlich', monatlich: 'monatlich' }[a.rhythmus]} um ${a.uhrzeit}`;
    case 'ereignis': return `bei: ${EREIGNIS_NAME[a.ereignis]}${a.bedingungen?.length ? ` (nur wenn ${a.bedingungen.length === 1 ? 'eine Bedingung' : `${a.bedingungen.length} Bedingungen`} erfüllt)` : ''}`;
    case 'datum': {
      const d = DATUMS_FELDER.find(x => x.id === a.feld)?.titel ?? a.feld;
      const t = Math.abs(a.versatzTage);
      return a.versatzTage === 0 ? `am Tag: ${d}` : `${t} ${a.werktage ? 'Werktage' : 'Tage'} ${a.versatzTage < 0 ? 'vor' : 'nach'}: ${d}`;
    }
    case 'webhook': return `Webhook von außen${a.felder.length ? ` (${a.felder.length} Felder)` : ''}`;
    case 'loop': return `nach dem ${LOOP_NAME[a.loop]}`;
  }
}
