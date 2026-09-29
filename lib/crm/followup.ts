// ─── Follow-up-Ebene (rein, getestet, 27.09.) ───────────────────────────────
// Kevin: „Die ganze Follow-up-Ebene muss sauber eingepflegt werden.“ Bis dahin
// lagen fällige Dinge an acht Stellen. Diese Datei macht daraus EINE Liste:
//   · echte Follow-ups (Bestand crm.followups, Status offen)
//   · und, solange die alten Felder noch leben, „virtuelle“ Einträge daraus:
//     nächster Schritt und Wiedervorlage am Kontakt, nächster Schritt am Deal,
//     Nachfassen nach einem Event (Teilnahme ohne followUpAm), Review am Mandat,
//     die Wiedervorlage am geparkten Deal (K6a, 29.09. — Befund 2 der Kalender-Verbindungskarte: kam nie hoch)
//     und die Kadenz je Kreis (A 30 · B 60 · C 90 · D 180 Tage ohne Kontakt).
// Wer Fälliges zeigt (Follow-up-Liste, Power Hour, Glocke, Heute, Akte), liest NUR hier — nie die alten Felder selbst.
// Virtuelle Einträge haben Kennungen `v:<quelle>:<id>`; erledigt oder verschoben
// werden sie über die Route, die dann das alte Feld ändert oder ein echtes
// Follow-up daraus macht.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename, letzterKontaktVon, KREIS_TAKT } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUp, FollowUpArt, FollowUpBezugArt, Wertelisten } from './typen';
import { OFFENE_STUFEN } from './pipeline';
import { haeltBeziehung, zustaendig, BEIDE } from './team';
import { followUpBis } from './events';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export const FOLLOWUP_ARTEN: { id: FollowUpArt; label: string }[] = [
  { id: 'anruf', label: 'Anruf' }, { id: 'mail', label: 'Mail' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'termin', label: 'Termin' }, { id: 'nachricht', label: 'Nachricht' }, { id: 'sonstig', label: 'Sonstiges' },
];
export const VERSCHIEBEN_TAGE = [1, 3, 7] as const;
/** Wie weit die Liste nach vorn schaut. */
export const HORIZONT_TAGE = 14;

export type Gruppe = 'ueberfaellig' | 'heute' | 'woche' | 'spaeter';
export type VirtuelleQuelle = 'schritt' | 'wiedervorlage' | 'dealschritt' | 'dealwiedervorlage' | 'nachfassen' | 'review' | 'kadenz';

export interface Faellig {
  /** echte Follow-up-Kennung oder `v:<quelle>:<id>` */
  id: string;
  virtuell: boolean;
  quelle: FollowUp['quelle'] | VirtuelleQuelle;
  art: FollowUpArt;
  text: string;
  faellig: string;
  uhrzeit?: string;
  kontaktId?: string;
  name: string;
  firma?: string;
  bezug: { art: FollowUpBezugArt; id: string; titel?: string };
  zustaendig: string;
  /** Tage über dem Termin (positiv = überfällig). */
  tageUeber: number;
  gruppe: Gruppe;
  verschoben?: number;
}

const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);
export const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export function gruppeVon(faellig: string, heute: string): Gruppe {
  const d = tage(heute, faellig);
  if (d < 0) return 'ueberfaellig';
  if (d === 0) return 'heute';
  if (d <= 7) return 'woche';
  return 'spaeter';
}

/** Takt einer Person: eigener Takt, sonst der Kreis, sonst nichts (keine Kadenz ohne Kreis). */
export function taktVon(k: Pick<Kontakt, 'kreis' | 'taktTage'>, wertelisten?: Wertelisten): number | null {
  if (k.taktTage && k.taktTage >= 1) return k.taktTage;
  if (!k.kreis) return null;
  return wertelisten?.kadenzTage?.[k.kreis] ?? KREIS_TAKT[k.kreis];
}

const RUHT = new Set(['ruht', 'verloren']);

/**
 * Werbliche Follow-up-Arten (28.09., Integritätsprüfung W8): Mail, LinkedIn, Anruf, Nachricht in der Akquise —
 * also nicht im laufenden Deal oder Mandat (Vertrag/eigene Anfrage) und nicht „Termin“/„Sonstiges“.
 * An Personen mit Werbesperre (Art. 21) stehen sie in keiner Fälligkeitsliste.
 */
export const WERBLICHE_ARTEN: readonly FollowUpArt[] = ['mail', 'linkedin', 'anruf', 'nachricht'];
export const istWerblich = (f: Pick<FollowUp, 'art' | 'bezug'>) => WERBLICHE_ARTEN.includes(f.art) && f.bezug?.art !== 'chance' && f.bezug?.art !== 'mandat';
/** Hinweis für die Oberfläche, wenn Follow-ups wegen Werbesperre ausgeblendet sind (wie `folgeAus` „sperre“ in heute.ts). */
export const werbesperreHinweis = (n: number) => `${n} ${n === 1 ? 'Follow-up an eine Person' : 'Follow-ups an Personen'} mit Werbesperre ausgeblendet — keine Werbung mehr; nur mit Vertrag oder ihrer Anfrage weiterverfolgen (Stammdaten › Datenqualität).`;

/**
 * Alle fälligen und bald fälligen Follow-ups einer Kartei: echte zuerst, dann
 * die virtuellen aus den alten Feldern — ohne Doppelung (hat eine Person am
 * selben Tag schon ein echtes Follow-up, fällt der virtuelle Eintrag weg).
 */
export function faellige(kontakte: Kontakt[], crm: CrmBestand, heute: string, opts: { horizont?: number; wertelisten?: Wertelisten; /** Wird je wegen Werbesperre ausgeblendetem Follow-up gerufen (für den Hinweis). */ beiSperre?: (f: FollowUp) => void } = {}): Faellig[] {
  const horizont = opts.horizont ?? HORIZONT_TAGE;
  const bis = tagPlus(heute, horizont);
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  const raus: Faellig[] = [];
  const belegt = new Set<string>(); // `${kontaktId}|${faellig}` — echte Follow-ups schlagen virtuelle
  const nameVon = (id?: string) => { const k = id ? nachId.get(id) : undefined; return k ? anzeigename(k) : ''; };
  const firmaVon = (id?: string) => { const k = id ? nachId.get(id) : undefined; return k ? (k.firmaId ? firmen.get(k.firmaId)?.name : undefined) ?? k.firma : undefined; };
  const mach = (f: Omit<Faellig, 'tageUeber' | 'gruppe'>): Faellig => ({ ...f, tageUeber: tage(f.faellig, heute), gruppe: gruppeVon(f.faellig, heute) });

  // 1 · echte Follow-ups
  for (const f of crm.followups ?? []) {
    if (f.status !== 'offen' || f.faellig > bis) continue;
    if (f.kontaktId) belegt.add(`${f.kontaktId}|${f.faellig}`);
    const k = f.kontaktId ? nachId.get(f.kontaktId) : undefined;
    // Art. 18 (U2): eingeschränkte Personen stehen in keiner Fälligkeitsliste (Power Hour, „Für dich“).
    if (k?.eingeschraenkt) continue;
    // Werbesperre (Art. 21, W8 28.09.): werbliche Arten fallen heraus — mit Hinweis über `beiSperre`.
    if (k?.werbesperre && istWerblich(f)) { opts.beiSperre?.(f); continue; }
    const titel = f.bezug.art === 'chance' ? crm.chancen.find(c => c.id === f.bezug.id)?.titel : f.bezug.art === 'mandat' ? crm.mandate.find(m => m.id === f.bezug.id)?.kunde : f.bezug.art === 'event' ? crm.events.find(e => e.id === f.bezug.id)?.titel : f.bezug.art === 'firma' ? firmen.get(f.bezug.id)?.name : undefined;
    raus.push(mach({ id: f.id, virtuell: false, quelle: f.quelle, art: f.art, text: f.text, faellig: f.faellig, ...(f.uhrzeit ? { uhrzeit: f.uhrzeit } : {}), ...(f.kontaktId ? { kontaktId: f.kontaktId } : {}),
      name: k ? anzeigename(k) : titel ?? f.text, ...(firmaVon(f.kontaktId) ? { firma: firmaVon(f.kontaktId) } : {}), bezug: { ...f.bezug, ...(titel ? { titel } : {}) }, zustaendig: f.zustaendig, ...(f.verschoben ? { verschoben: f.verschoben } : {}) }));
  }
  const frei = (kontaktId: string, faellig: string) => !belegt.has(`${kontaktId}|${faellig}`);

  // 2 · nächster Schritt und Wiedervorlage am Kontakt
  for (const k of kontakte) {
    if (ausgenommen(k) || RUHT.has(k.stufe)) continue;
    const z = haeltBeziehung(k);
    if (k.naechsterSchritt && k.naechsterSchritt.datum <= bis && frei(k.id, k.naechsterSchritt.datum)) {
      raus.push(mach({ id: `v:schritt:${k.id}`, virtuell: true, quelle: 'schritt', art: 'sonstig', text: k.naechsterSchritt.text, faellig: k.naechsterSchritt.datum, kontaktId: k.id, name: anzeigename(k), ...(firmaVon(k.id) ? { firma: firmaVon(k.id) } : {}), bezug: { art: 'kontakt', id: k.id }, zustaendig: z }));
      belegt.add(`${k.id}|${k.naechsterSchritt.datum}`);
    }
    if (k.wiedervorlage && k.wiedervorlage <= bis && frei(k.id, k.wiedervorlage)) {
      raus.push(mach({ id: `v:wiedervorlage:${k.id}`, virtuell: true, quelle: 'wiedervorlage', art: 'anruf', text: 'Wiedervorlage', faellig: k.wiedervorlage, kontaktId: k.id, name: anzeigename(k), ...(firmaVon(k.id) ? { firma: firmaVon(k.id) } : {}), bezug: { art: 'kontakt', id: k.id }, zustaendig: z }));
      belegt.add(`${k.id}|${k.wiedervorlage}`);
    }
  }
  // 3 · nächster Schritt am offenen Deal
  for (const c of crm.chancen) {
    if (!OFFENE_STUFEN.includes(c.stufe) || !c.naechsterSchritt || c.naechsterSchritt.datum > bis) continue;
    const kid = c.kontaktIds[0];
    if (kid && !frei(kid, c.naechsterSchritt.datum)) continue;
    raus.push(mach({ id: `v:dealschritt:${c.id}`, virtuell: true, quelle: 'dealschritt', art: 'sonstig', text: c.naechsterSchritt.text, faellig: c.naechsterSchritt.datum, ...(kid ? { kontaktId: kid } : {}), name: kid ? nameVon(kid) : c.titel, firma: c.firma ?? (c.firmaId ? firmen.get(c.firmaId)?.name : undefined), bezug: { art: 'chance', id: c.id, titel: c.titel }, zustaendig: zustaendig(c.besitzer, 'sales') }));
    if (kid) belegt.add(`${kid}|${c.naechsterSchritt.datum}`);
  }
  // 3b · Wiedervorlage am geparkten Deal (K6a) — Pflicht beim Parken (pipeline.ts), kam aber nirgends mehr hoch.
  for (const c of dealWiedervorlagen(crm, bis)) {
    const kid = c.kontaktIds.find(id => nachId.has(id));
    if (kid && nachId.get(kid)?.eingeschraenkt) continue;
    raus.push(mach({ id: `v:dealwiedervorlage:${c.id}`, virtuell: true, quelle: 'dealwiedervorlage', art: 'sonstig', text: `Wiedervorlage: geparkter Deal „${c.titel}“${c.grund ? ` (${c.grund.slice(0, 80)})` : ''}`, faellig: c.wiedervorlage!, ...(kid ? { kontaktId: kid } : {}), name: kid ? nameVon(kid) : c.titel, firma: c.firma ?? (c.firmaId ? firmen.get(c.firmaId)?.name : undefined), bezug: { art: 'chance', id: c.id, titel: c.titel }, zustaendig: zustaendig(c.besitzer, 'sales') }));
  }
  // 4 · Nachfassen nach einem Event (binnen 48 h)
  for (const t of crm.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && !t.nachfassenVerzichtet)) {
    const ev = crm.events.find(e => e.id === t.eventId);
    if (!ev || ev.datum > heute || nachId.get(t.kontaktId)?.eingeschraenkt) continue;
    const f = followUpBis(ev);
    if (!frei(t.kontaktId, f)) continue;
    // Ein echtes Event-Follow-up zu diesem Gast (etwa nach „+3 Tage“) ersetzt den virtuellen Eintrag.
    if ((crm.followups ?? []).some(x => x.status === 'offen' && x.bezug.art === 'event' && x.bezug.id === ev.id && x.kontaktId === t.kontaktId)) continue;
    raus.push(mach({ id: `v:nachfassen:${t.id}`, virtuell: true, quelle: 'nachfassen', art: 'nachricht', text: `Nachfassen nach „${ev.titel}“`, faellig: f, kontaktId: t.kontaktId, name: nameVon(t.kontaktId), ...(firmaVon(t.kontaktId) ? { firma: firmaVon(t.kontaktId) } : {}), bezug: { art: 'event', id: ev.id, titel: ev.titel }, zustaendig: t.einladenDurch ?? zustaendig(ev.zustaendig, 'event') }));
  }
  // 5 · Review am Mandat
  for (const m of crm.mandate.filter(m => m.status === 'aktiv' && m.naechstesReview && m.naechstesReview <= bis)) {
    const kid = m.kontaktIds[0];
    raus.push(mach({ id: `v:review:${m.id}`, virtuell: true, quelle: 'review', art: 'termin', text: `Review „${m.kunde}“`, faellig: m.naechstesReview!, ...(kid ? { kontaktId: kid } : {}), name: kid ? nameVon(kid) : m.kunde, firma: m.kunde, bezug: { art: 'mandat', id: m.id, titel: m.kunde }, zustaendig: zustaendig(m.zustaendig, 'sales') }));
  }
  // 6 · Kadenz je Kreis: zu lange nichts gehört
  // Ein eingetragenes Meeting zählt ab seinem Tag (`wann`) — geplant setzt es „letzter Kontakt“ nicht (28.09., F1).
  for (const k of kontakte) {
    const letzter = letzterKontaktVon(k, heute);
    if (ausgenommen(k) || RUHT.has(k.stufe) || !letzter) continue;
    const takt = taktVon(k, opts.wertelisten);
    if (!takt) continue;
    const f = tagPlus(letzter, takt);
    if (f > bis || tage(f, heute) > 365) continue;
    // Hat die Person schon irgendein offenes Follow-up, braucht es keinen Kadenz-Eintrag.
    if (raus.some(x => x.kontaktId === k.id)) continue;
    raus.push(mach({ id: `v:kadenz:${k.id}`, virtuell: true, quelle: 'kadenz', art: 'anruf', text: `Kreis ${k.kreis ?? '—'}: seit ${tage(letzter, heute)} Tagen kein Kontakt (Takt ${takt} Tage)`, faellig: f, kontaktId: k.id, name: anzeigename(k), ...(firmaVon(k.id) ? { firma: firmaVon(k.id) } : {}), bezug: { art: 'kontakt', id: k.id }, zustaendig: haeltBeziehung(k) }));
  }
  const rang: Record<Gruppe, number> = { ueberfaellig: 0, heute: 1, woche: 2, spaeter: 3 };
  return raus.sort((a, b) => rang[a.gruppe] - rang[b.gruppe] || a.faellig.localeCompare(b.faellig) || (a.uhrzeit ?? '99').localeCompare(b.uhrzeit ?? '99') || a.name.localeCompare(b.name));
}

/** Geparkte Deals mit Wiedervorlage bis `bis` (einschließlich) — die EINE Regel für Follow-ups und „Wer ist dran“ (K6a). */
export function dealWiedervorlagen(crm: Pick<CrmBestand, 'chancen'>, bis: string): CrmBestand['chancen'] {
  return crm.chancen.filter(c => c.stufe === 'geparkt' && !!c.wiedervorlage && /^\d{4}-\d{2}-\d{2}$/.test(c.wiedervorlage) && c.wiedervorlage <= bis);
}

/** Für den Filter „Alle · Meins · Malin“: gemeinsame („beide“) zählen bei jedem. */
export function fuerPerson(liste: Faellig[], person: string | null): Faellig[] {
  if (!person) return liste;
  return liste.filter(f => f.zustaendig === person || f.zustaendig === BEIDE);
}

export function zaehlen(liste: Faellig[]): Record<Gruppe, number> & { gesamt: number } {
  const z = { ueberfaellig: 0, heute: 0, woche: 0, spaeter: 0, gesamt: liste.length };
  for (const f of liste) z[f.gruppe]++;
  return z;
}

/** Pünktlichkeit: erledigte echte Follow-ups der letzten `tage` — wie viele am oder vor dem Termin? Erst ab 5 eine Quote. */
export function puenktlichkeit(followups: FollowUp[], heute: string, tageZurueck = 30): { erledigt: number; puenktlich: number; verpasst: number; quote: number | null } {
  const ab = tagPlus(heute, -tageZurueck);
  const erl = followups.filter(f => f.status === 'erledigt' && (f.erledigtAm ?? '').slice(0, 10) >= ab);
  const puenktlich = erl.filter(f => (f.erledigtAm ?? '').slice(0, 10) <= f.faellig).length;
  const verpasst = followups.filter(f => f.status === 'verpasst' && f.faellig >= ab).length;
  const n = erl.length + verpasst;
  return { erledigt: erl.length, puenktlich, verpasst, quote: n >= 5 ? Math.round((puenktlich / n) * 100) : null };
}

/** Ein neues Follow-up aus einer Eingabe — Zuständig: Angabe, sonst wer die Beziehung hält, sonst die Person, die anlegt. */
export function neuesFollowUp(e: { id: string; bezug: { art: FollowUpBezugArt; id: string }; kontaktId?: string; art?: FollowUpArt; text: string; faellig: string; uhrzeit?: string; zustaendig?: string; quelle?: FollowUp['quelle']; notiz?: string; aufgabeId?: string }, kontakt: Kontakt | undefined, person: string, jetzt: string): FollowUp {
  return {
    id: e.id, bezug: e.bezug, ...(e.kontaktId ? { kontaktId: e.kontaktId } : {}), art: e.art ?? 'sonstig', text: e.text.trim().slice(0, 300), faellig: e.faellig,
    ...(e.uhrzeit ? { uhrzeit: e.uhrzeit } : {}), zustaendig: e.zustaendig ?? (kontakt ? haeltBeziehung(kontakt) : person), status: 'offen', quelle: e.quelle ?? 'hand',
    ...(e.notiz ? { notiz: e.notiz.slice(0, 1000) } : {}), ...(e.aufgabeId ? { aufgabeId: e.aufgabeId } : {}), angelegt: jetzt, geaendert: jetzt,
  };
}

/** Kennung eines virtuellen Eintrags zerlegen. */
export function virtuell(id: string): { quelle: VirtuelleQuelle; ziel: string } | null {
  const m = /^v:(schritt|wiedervorlage|dealschritt|dealwiedervorlage|nachfassen|review|kadenz):(.+)$/.exec(id);
  return m ? { quelle: m[1] as VirtuelleQuelle, ziel: m[2] } : null;
}
