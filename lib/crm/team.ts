// ─── Markttraktion — zu zweit arbeiten (rein, getestet) ─────────────────────
// Kevin (25.09.): „Malin muss auch Sales machen, ich habe dafür aber die
// Verantwortung.“ Deshalb zwei Begriffe:
//   verantwortlich  je Welt — Sales: Kevin · Marketing und Event: Malin.
//                   Sie/er sieht alles der Welt, verteilt und bekommt, was
//                   niemandem sonst gehört.
//   zuständig       je Eintrag (Kontakt „Hält die Beziehung“, Chance, Mandat,
//                   Event, Kampagne, Beitrag, Newsletter): wer es bearbeitet —
//                   kevin, malin oder „beide“. Fehlt es, gilt die/der
//                   Verantwortliche der Welt.
// Beide sehen alles (Kevins Entscheidung); nur die private Notiz an einer
// Person sieht allein, wer sie geschrieben hat.
//
// MAKE OS ist Kevins und Malins System — das Team steht deshalb hier fest.
// Kommt jemand dazu, wird er hier eingetragen (Kürzel = Speichername des Kontos).

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { CrmBestand, CrmListe } from './typen';
import type { Welt } from './traktion';
import { leads, salesBereit } from './leads';
import { nachbereitung } from './erfassen';
import { faellige, fuerPerson as faelligeFuer } from './followup';
import { istNetzwerkenEvent } from './marke';

export interface Mitglied { id: string; name: string; farbe: string; verantwortet: Welt[] }
export const TEAM: Mitglied[] = [
  { id: 'kevin', name: 'Kevin', farbe: '#58D9CD', verantwortet: ['sales'] },
  { id: 'malin', name: 'Malin', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] },
];
export const BEIDE = 'beide';

export const verantwortlich = (w: Welt): string => TEAM.find(t => t.verantwortet.includes(w))?.id ?? TEAM[0].id;
export const mitglied = (id?: string | null) => TEAM.find(t => t.id === id);
export const nameVon = (id?: string | null) => (id === BEIDE ? 'Beide' : mitglied(id)?.name ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : '—'));
/** Die andere Person im Team — für „an Malin übergeben“ / „an Kevin übergeben“. */
export const anderer = (person: string) => TEAM.find(t => t.id !== person)?.id ?? person;

/** Zuständigkeit säubern: Team-Kürzel oder „beide“, sonst nichts. */
export function wer(v: unknown): string | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  return s === BEIDE || TEAM.some(t => t.id === s) ? s : undefined;
}

/** Welche Welt eine Liste hat — für die Standard-Zuständigkeit. */
export const WELT_DER_LISTE: Partial<Record<CrmListe, Welt>> = {
  chancen: 'sales', mandate: 'sales', sitzungen: 'sales', kampagnen: 'sales',
  beitraege: 'marketing', newsletter: 'marketing', segmente: 'marketing',
  events: 'event', teilnahmen: 'event',
};

/** Wer tatsächlich zuständig ist — die Eintragung, sonst die/der Verantwortliche. */
export const zustaendig = (z: string | undefined, w: Welt) => wer(z) ?? verantwortlich(w);
/** Gehört das der Person? „beide“ gehört beiden. */
export function istMeins(z: string | undefined, w: Welt, person: string): boolean {
  const e = zustaendig(z, w);
  return e === person || e === BEIDE;
}
/** Kontakt: „Hält die Beziehung“ — ohne Eintrag liegt er bei der Sales-Verantwortung. */
export const haeltBeziehung = (k: Pick<Kontakt, 'besitzer'>) => zustaendig(k.besitzer, 'sales');

// ── Zuletzt im Team ────────────────────────────────────────────────────────
export interface TeamEreignis { person: string; zeit: string; text: string; welt: Welt | null; ziel: { s: string; a?: string; k?: string } }

const ART_TEXT: Record<string, string> = { mail: 'Mail an', linkedin: 'LinkedIn mit', anruf: 'Anruf bei', antwort: 'Antwort von', termin: 'Termin mit', notiz: 'Notiz zu', gespraech: 'Gespräch mit', event: 'Event mit' };
const ERGEBNIS_TEXT: Record<string, string> = { gespraech: 'Gespräch', termin: 'Termin vereinbart', mailbox: 'Mailbox', nicht_erreicht: 'nicht erreicht', rueckruf: 'Rückruf vereinbart', kein_bedarf: 'kein Bedarf', sperre: 'Sperre' };

/**
 * Was Kevin und Malin zuletzt getan haben — aus Verlauf, Chancen-Historie und
 * „geaendertVon“ an Events, Kampagnen, Beiträgen, Newsletter und Mandaten.
 * System-Einträge (Import, Signale) zählen nicht.
 */
export function teamFeed(kontakte: Kontakt[], crm: CrmBestand, seit: string, max = 20): TeamEreignis[] {
  const r: TeamEreignis[] = [];
  const mensch = (p?: string) => !!p && p !== 'system' && TEAM.some(t => t.id === p);
  for (const k of kontakte) {
    for (const a of k.aktivitaeten ?? []) {
      if (a.am < seit || !mensch(a.von) || a.art === 'system') continue;
      const was = a.art === 'uebergabe' ? `hat ${anzeigename(k)} übergeben${a.text ? `: ${a.text}` : ''}`
        : a.ergebnis ? `${anzeigename(k)}: ${ERGEBNIS_TEXT[a.ergebnis] ?? a.ergebnis}`
        : a.art === 'stufe' ? `${anzeigename(k)}: Stufe${a.text ? ` ${a.text}` : ' geändert'}`
        : `${ART_TEXT[a.art] ?? a.art} ${anzeigename(k)}`;
      r.push({ person: a.von, zeit: a.am, text: was, welt: 'sales', ziel: { s: 'kontakte', k: k.id } });
    }
  }
  for (const c of crm.chancen) {
    for (const h of c.historie.slice(1)) if (h.am >= seit && mensch(h.von)) r.push({ person: h.von, zeit: h.am, text: `Deal „${c.titel}“ → ${h.stufe}`, welt: 'sales', ziel: { s: 'deals', a: 'akte', k: c.id } });
  }
  const geaendert = <T extends { geaendert: string; geaendertVon?: string }>(liste: T[], text: (x: T) => string, welt: Welt, ziel: TeamEreignis['ziel']) => {
    for (const x of liste) if (x.geaendert >= seit && mensch(x.geaendertVon)) r.push({ person: x.geaendertVon!, zeit: x.geaendert, text: text(x), welt, ziel });
  };
  geaendert(crm.events, e => `Event „${e.titel}“ bearbeitet`, 'event', { s: 'event' });
  geaendert(crm.kampagnen ?? [], k => `Kampagne „${k.name}“ bearbeitet`, 'sales', { s: 'marketing', a: 'kampagnen' });
  geaendert(crm.beitraege ?? [], b => `Beitrag „${b.titel}“ · ${b.status}`, 'marketing', { s: 'marketing', a: 'redaktion' });
  geaendert(crm.newsletter ?? [], n => `Newsletter „${n.titel}“ · ${n.status}`, 'marketing', { s: 'marketing', a: 'newsletter' });
  geaendert(crm.mandate, m => `Mandat ${m.kunde} bearbeitet`, 'sales', { s: 'deals', a: 'kunden' });
  return r.sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, max);
}

// ── Für dich ────────────────────────────────────────────────────────────────
export interface FuerDich { id: string; welt: Welt; titel: string; anzahl: number; text: string; ziel: { s: string; a?: string } }

const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Was heute bei dieser Person liegt — über alle drei Welten, nur das Eigene. */
export function fuerDich(person: string, kontakte: Kontakt[], crm: CrmBestand, heute: string): FuerDich[] {
  const l: FuerDich[] = [];
  const bald = tagPlus(heute, 7);
  // Follow-up-Ebene führt (27.09.): alles Fällige aus EINER Liste — echte Follow-ups und die virtuellen aus den alten Feldern (Prüfbericht, Punkt 1).
  const meineFaelligen = faelligeFuer(faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten }), person).filter(f => f.faellig <= heute);
  if (meineFaelligen.length) l.push({ id: 'zusagen', welt: 'sales', titel: 'Follow-ups fällig', anzahl: meineFaelligen.length, text: `${meineFaelligen.filter(f => f.gruppe === 'ueberfaellig').length} überfällig — oben in deiner Power Hour`, ziel: { s: 'followup', a: 'faellig' } });
  // „Wie lief's?“ (25.09.): Termine aus dem Geschäftskalender, nach denen noch nichts festgehalten ist (lib/crm/erfassen.ts).
  const nachbereiten = nachbereitung(kontakte, heute, person).length;
  if (nachbereiten) l.push({ id: 'nachbereiten', welt: 'sales', titel: 'Termine nachbereiten', anzahl: nachbereiten, text: 'wie lief es? ein Tipp in der Power Hour', ziel: { s: 'followup', a: 'powerhour' } });
  const offen = crm.chancen.filter(c => ['qualifiziert', 'bedarf', 'diagnose', 'angebot', 'abschluss'].includes(c.stufe) && istMeins(c.besitzer, 'sales', person));
  const ohneSchritt = offen.filter(c => !c.naechsterSchritt).length;
  if (ohneSchritt) l.push({ id: 'chancen-ohne-schritt', welt: 'sales', titel: 'Deine Deals ohne nächsten Schritt', anzahl: ohneSchritt, text: `von ${offen.length} offenen`, ziel: { s: 'deals' } });
  const reviews = crm.mandate.filter(m => m.status === 'aktiv' && m.naechstesReview && m.naechstesReview <= bald && istMeins(m.zustaendig, 'sales', person)).length;
  if (reviews) l.push({ id: 'reviews', welt: 'sales', titel: 'Kundenreviews in 7 Tagen', anzahl: reviews, text: 'Health bewerten, offene Punkte klären', ziel: { s: 'deals', a: 'kunden' } });
  // Eine Beitrags-Freigabe zählt nur, solange sie nötig ist: an die jetzige Stimme, und die schreibt nicht selbst (lib/crm/marketing.ts freigabeStand).
  const beitragFreigabe = (b: NonNullable<CrmBestand['beitraege']>[number]) => b.status !== 'veroeffentlicht' && b.freigabe?.status === 'offen' && b.freigabe.an === person && b.stimme === person && zustaendig(b.zustaendig, 'marketing') !== person && zustaendig(b.zustaendig, 'marketing') !== BEIDE;
  const freigaben = (crm.beitraege ?? []).filter(beitragFreigabe).length + (crm.newsletter ?? []).filter(n => n.status !== 'versendet' && n.freigabe?.status === 'offen' && n.freigabe.an === person).length;
  if (freigaben) l.push({ id: 'freigaben', welt: 'marketing', titel: 'Warten auf deine Freigabe', anzahl: freigaben, text: 'Beiträge oder Newsletter in deinem Namen', ziel: { s: 'marketing', a: 'redaktion' } });
  const aenderungen = [...(crm.beitraege ?? []), ...(crm.newsletter ?? [])].filter(x => x.freigabe?.status === 'aenderung' && istMeins(x.zustaendig, 'marketing', person)).length;
  if (aenderungen) l.push({ id: 'aenderungen', welt: 'marketing', titel: 'Änderungswünsche zu deinen Texten', anzahl: aenderungen, text: 'die Stimme hat zurückgegeben', ziel: { s: 'marketing', a: 'redaktion' } });
  const beitraege = (crm.beitraege ?? []).filter(b => b.status === 'geplant' && b.datum && b.datum <= bald && istMeins(b.zustaendig, 'marketing', person)).length;
  if (beitraege) l.push({ id: 'beitraege', welt: 'marketing', titel: 'Beiträge in den nächsten 7 Tagen', anzahl: beitraege, text: 'geplant und von dir', ziel: { s: 'marketing', a: 'redaktion' } });
  const eventsMein = crm.events.filter(e => e.status !== 'abgesagt' && e.datum >= heute && istMeins(e.zustaendig, 'event', person));
  const punkte = eventsMein.flatMap(e => (e.checkliste ?? []).filter(c => !c.erledigt && tagPlus(e.datum, -c.tageVorher) <= heute && (wer(c.wer) ?? zustaendig(e.zustaendig, 'event')) === person)).length;
  if (punkte) l.push({ id: 'checkliste', welt: 'event', titel: 'Event-Checkliste fällig', anzahl: punkte, text: 'Punkte, die bei dir liegen', ziel: { s: 'event' } });
  const eventIds = new Set(crm.events.map(e => e.id));
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  // Wer nachfasst: wer eingeladen hat, sonst wer die Beziehung hält — bei „beide“ die Zuständigkeit des Events (wie in der Event-Ansicht).
  const eventVon = new Map(crm.events.map(e => [e.id, e]));
  const nachfasser = (t: CrmBestand['teilnahmen'][number]) => { const e = wer(t.einladenDurch); if (e && e !== BEIDE) return e; const k = nachId.get(t.kontaktId); const h = k ? haeltBeziehung(k) : BEIDE; return h !== BEIDE ? h : zustaendig(eventVon.get(t.eventId)?.zustaendig, 'event'); };
  // Besuchte Events (Reiter „Events“) zählen getrennt von den Make.One-Gästen und führen in IHREN Reiter (M1/M2); bewusst Ausgelassene
  // (`nachfassenVerzichtet`) und Personen mit einem offenen echten Follow-up zum Event zählen nirgends — dort steht es schon.
  const offeneFu = new Set((crm.followups ?? []).filter(f => f.status === 'offen' && f.bezug.art === 'event' && f.kontaktId).map(f => `${f.bezug.id}|${f.kontaktId}`));
  const nachzufassen = crm.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && !t.nachfassenVerzichtet && eventIds.has(t.eventId) && nachfasser(t) === person && !offeneFu.has(`${t.eventId}|${t.kontaktId}`));
  const nachfassen = nachzufassen.filter(t => !istNetzwerkenEvent(eventVon.get(t.eventId)!)).length;
  const begegnungen = nachzufassen.length - nachfassen;
  if (nachfassen) l.push({ id: 'nachfassen', welt: 'event', titel: 'Gäste nachfassen', anzahl: nachfassen, text: 'die du eingeladen hast oder deren Beziehung du hältst', ziel: { s: 'event' } });
  if (begegnungen) l.push({ id: 'begegnungen', welt: 'event', titel: 'Begegnungen bei Events nachfassen', anzahl: begegnungen, text: 'kennengelernt auf besuchten Veranstaltungen, noch ohne nächsten Schritt', ziel: { s: 'besuche' } });
  // Ebene 1 → 2: Leads, die SQL-bereit sind, aber noch keinen Deal haben — und Leads in Qualifizierung.
  const meineLeads = leads(kontakte, crm, heute).filter(z => z.besitzer === person || z.besitzer === BEIDE);
  const sqlOffen = meineLeads.filter(z => salesBereit(z) && !z.deal?.offen && z.status !== 'kunde' && z.status !== 'kein_fit' && z.status !== 'ruht').length;
  if (sqlOffen) l.push({ id: 'sql_bereit', welt: 'sales', titel: 'SQL-bereit — Deal anlegen', anzahl: sqlOffen, text: 'Schmerz, Entscheider und Budget/Zeitpunkt geklärt', ziel: { s: 'firmen', a: 'leads' } });
  const inQuali = meineLeads.filter(z => z.status === 'qualifizierung' && !salesBereit(z)).length;
  if (inQuali) l.push({ id: 'qualifizierung', welt: 'sales', titel: 'Leads in Qualifizierung', anzahl: inQuali, text: 'eine Kernfrage klären bringt sie zum SQL', ziel: { s: 'firmen', a: 'leads' } });
  const kampagnen = (crm.kampagnen ?? []).filter(k => k.status === 'aktiv' && istMeins(k.zustaendig, 'sales', person));
  const kpOffen = kampagnen.reduce((a, k) => { const e = new Set(k.ergebnisse.map(x => x.kontaktId)); return a + k.kontaktIds.filter(id => !e.has(id)).length; }, 0);
  if (kpOffen) l.push({ id: 'kampagnen', welt: 'sales', titel: 'Personen aus deinen Kampagnen', anzahl: kpOffen, text: 'noch nicht angesprochen', ziel: { s: 'marketing', a: 'kampagnen' } });
  return l;
}
