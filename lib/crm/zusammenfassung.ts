// ─── Kontakt öffnen · Datensatz-Zusammenfassung (rein, getestet, 28.09.) ────
// Kevin 28.09. (HubSpot-Vorbild „Record summary“): oben im Reiter „Über“ zwei
// bis vier Sätze, die sofort sagen, wo wir mit der Person stehen — gerechnet,
// nicht erfunden. Jeder Satz trägt Quellen-Nummern ①②…; ein Klick springt in
// den Reiter Aktivitäten zur Quelle (Anker aus lib/crm/aktivitaeten.ts) oder
// öffnet den Deal bzw. das Mandat.
//   1  letztes echtes Gespräch/Meeting (Datum, Art) — Meetings zählen mit ihrem Zeitpunkt
//      (`wann`, H4), nicht mit dem Tag, an dem sie festgehalten wurden, und nur, wenn er vorbei ist
//   2  jüngste Mail/Antwort — nur, wenn sie nach dem Gespräch kam
//   2b nächstes Meeting („Nächstes Meeting am …“), wenn eins ansteht (28.09.)
//   3  offener Deal (Stufe, Wert) · Mandat (Honorar) — sonst der letzte abgeschlossene
//   4  nächster Schritt · Lifecycle (immer — deshalb gibt es nie null Sätze)
// `kontaktPaket` baut daraus das Datenpaket für „Frage stellen“ (ZOE):
// nie die private Notiz, nie Personen mit Werbesperre, keine Kollegen.

import type { Aktivitaet, Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Mandat } from './typen';
import { echtesGespraech, OFFENE_STUFEN, STUFEN } from './pipeline';
import { ankerListe, berlin, meetingVon, type TerminZeiten } from './aktivitaeten';
import { lifecycleVon, type LifecycleBestand } from './vorschlaege';
import { LIFECYCLE_LABEL, type LifecyclePhase } from './lifecycle';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export type ZfQuelle =
  | { nr: number; art: 'aktivitaet'; anker: string; am: string; label: string }
  | { nr: number; art: 'deal'; id: string; label: string }
  | { nr: number; art: 'mandat'; id: string; label: string }
  | { nr: number; art: 'feld'; feld: 'naechsterSchritt' | 'phase'; label: string };
type OhneNr<T> = T extends unknown ? Omit<T, 'nr'> : never;
export interface ZfSatz { text: string; quellen: number[] }
export interface Zusammenfassung {
  saetze: ZfSatz[];
  quellen: ZfQuelle[];
  /** Nichts festgehalten, kein Deal, kein Mandat, kein nächster Schritt — nur der Lifecycle-Satz. */
  leer: boolean;
}

const NUMMERN = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
/** Die Quellen-Nummer als Zeichen (① …), ab 11 in Klammern. */
export const nummer = (n: number): string => NUMMERN[n - 1] ?? `(${n})`;

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euro = (n: number) => EURO.format(n || 0).replace(/ /g, ' ');
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
/** 12.09. — mit Jahr, wenn es nicht das laufende ist. */
function tag(d: string, heute: string): string {
  const t = `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  return d.slice(0, 4) === heute.slice(0, 4) ? t : `${t}${d.slice(0, 4)}`;
}
function vor(d: string, heute: string): string {
  const n = tageZwischen(d, heute);
  return n === 0 ? 'heute' : n === 1 ? 'gestern' : n > 1 ? `vor ${n} Tagen` : n === -1 ? 'morgen' : `in ${-n} Tagen`;
}
const kurz = (t: string | undefined, n: number) => { const x = (t ?? '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };

const GESPRAECH_ART: Partial<Record<Aktivitaet['art'], string>> = { gespraech: 'Gespräch', termin: 'Meeting', anruf: 'Anruf', mail: 'Mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', event: 'Event', notiz: 'Notiz' };
function gespraechArt(a: Aktivitaet): string {
  if (a.art === 'anruf' && a.ergebnis === 'termin') return 'Anruf, Termin vereinbart';
  if (a.art === 'anruf') return 'Anruf';
  if (a.ergebnis === 'termin' && a.art !== 'termin') return `${GESPRAECH_ART[a.art] ?? a.art}, Termin vereinbart`;
  return GESPRAECH_ART[a.art] ?? a.art;
}
const stufeLabel = (c: Chance) => STUFEN.find(s => s.id === c.stufe)?.label ?? c.stufe;
function wertText(c: Chance): string {
  const { betrag, basis } = c.wert;
  if (!(betrag > 0)) return 'ohne Wert';
  return `${euro(betrag)}${basis === 'monat' ? ' im Monat' : basis === 'jahr' ? ' im Jahr' : ''}`;
}
const honorarText = (m: Mandat) => (m.honorar?.betrag > 0 ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? ' im Monat' : m.honorar.basis === 'tag' ? ' am Tag' : ' einmalig'}` : 'ohne Honorar');

export type ZfBestand = LifecycleBestand;

/**
 * Die Zusammenfassung einer Person aus echten Daten — rein, ohne KI.
 * Reihenfolge der Sätze fest (Gespräch · Mail/Antwort · Deal/Mandat · Schritt & Lifecycle),
 * Quellen in der Reihenfolge ihres Auftretens nummeriert.
 */
export function zusammenfassung(k: Kontakt, crm: ZfBestand | null | undefined, heute: string, jetzt?: string, termine?: TerminZeiten): Zusammenfassung {
  const quellen: ZfQuelle[] = [];
  const saetze: ZfSatz[] = [];
  const neu = (q: OhneNr<ZfQuelle>): number => { const nr = quellen.length + 1; quellen.push({ ...q, nr } as ZfQuelle); return nr; };
  const liste = k.aktivitaeten ?? [];
  const anker = ankerListe(liste);
  // Zeitpunkt jedes Eintrags als Berliner Wandzeit „YYYY-MM-DDTHH:MM“: Meetings mit ihrem `wann`
  // (Altbestand: erste Textzeile, sonst der Tag des Festhaltens), alles andere mit `am` (28.09.).
  const jetztWand = (() => { if (!jetzt) return `${heute}T23:59`; const b = berlin(jetzt); return `${b.tag}T${b.zeit ?? '23:59'}`; })();
  const zeitpunkt = (a: Aktivitaet): { wand: string; tag: string; meeting: boolean; zeit?: string; unbekannt?: true } => {
    const mt = meetingVon(a, termine);
    // K3: Meeting aus einem Termin, dessen Zeit (noch) nicht geladen ist — weder „letztes“ noch „nächstes“ Meeting raten.
    if (mt && a.terminUid && !termine?.[a.terminUid]) return { wand: `${mt.tag}T00:00`, tag: mt.tag, meeting: true, unbekannt: true };
    if (mt) return { wand: `${mt.tag}T${mt.zeit ?? '00:00'}`, tag: mt.tag, meeting: true, ...(mt.zeit ? { zeit: mt.zeit } : {}) };
    const b = berlin(a.am);
    return { wand: `${b.tag}T${b.zeit ?? '00:00'}`, tag: b.tag, meeting: false };
  };
  // Jüngste zuerst, „System“ zählt nie. Die Position im Log bleibt für den Anker.
  const echt = liste.map((a, i) => ({ a, i, z: zeitpunkt(a) })).filter(({ a }) => a.von !== 'system' && a.art !== 'system' && !!a.am).sort((x, y) => y.z.wand.localeCompare(x.z.wand));
  // Ein Meeting ist vorbei, wenn sein Zeitpunkt nicht in der Zukunft liegt (ohne Uhrzeit: ab seinem Tag).
  const vorbei = (z: { wand: string; tag: string; zeit?: string }) => (z.zeit ? z.wand <= jetztWand : z.tag <= heute);

  // 1 · letztes echtes Gespräch/Meeting — nur, was schon stattgefunden hat
  const g = echt.find(({ a, z }) => echtesGespraech(a) && !z.unbekannt && (!z.meeting || vorbei(z)));
  if (g) {
    const nr = neu({ art: 'aktivitaet', anker: anker[g.i], am: g.a.am, label: `${gespraechArt(g.a)} am ${tag(g.z.tag, heute)}` });
    const zusatz = kurz(g.a.notiz?.erkenntnisse ?? g.a.notiz?.bedarf ?? (g.z.meeting ? meetingVon(g.a, termine)?.notiz : g.a.text), 90);
    saetze.push({ text: `Letztes echtes Gespräch am ${tag(g.z.tag, heute)} (${gespraechArt(g.a)}, ${vor(g.z.tag, heute)})${zusatz ? `: „${zusatz}“` : ''}.`, quellen: [nr] });
  }

  // 2 · jüngste Mail oder Antwort — nur, wenn sie jünger ist als das Gespräch
  const m = echt.find(({ a }) => a.art === 'mail' || a.art === 'antwort');
  if (m && (!g || m.z.wand > g.z.wand)) {
    const was = m.a.art === 'antwort' ? (m.a.text?.startsWith('Anfrage über ') ? 'Anfrage' : 'Antwort') : 'Mail';
    const nr = neu({ art: 'aktivitaet', anker: anker[m.i], am: m.a.am, label: `${was} am ${tag(m.a.am, heute)}` });
    const text = kurz(m.a.text, 90);
    const satz = was === 'Mail' ? `Zuletzt ging am ${tag(m.a.am, heute)} eine Mail raus` : `Am ${tag(m.a.am, heute)} kam eine ${was}`;
    saetze.push({ text: `${satz}${text ? `: „${text}“` : ''}${g ? '' : ' — ein echtes Gespräch gab es noch nicht'}.`, quellen: [nr] });
  }

  // 2b · nächstes Meeting — das früheste, das noch bevorsteht (28.09.)
  const kommend = echt.filter(({ a, z }) => a.art === 'termin' && z.meeting && !z.unbekannt && !vorbei(z)).sort((x, y) => x.z.wand.localeCompare(y.z.wand))[0];
  if (kommend) {
    const mt = meetingVon(kommend.a, termine)!;
    const nr = neu({ art: 'aktivitaet', anker: anker[kommend.i], am: kommend.a.am, label: `Meeting am ${tag(mt.tag, heute)}` });
    saetze.push({ text: `Nächstes Meeting am ${tag(mt.tag, heute)}${mt.zeit ? ` um ${mt.zeit} Uhr` : ''} (${vor(mt.tag, heute)})${mt.ort ? `, ${kurz(mt.ort, 60)}` : ''}.`, quellen: [nr] });
  }

  // 3 · Deal und Mandat
  const chancen = (crm?.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.mandate ?? []).filter(x => x.kontaktIds.includes(k.id));
  const offen = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? ''));
  const aktiv = mandate.filter(x => x.status === 'aktiv');
  const teile: string[] = [];
  const dealQuellen: number[] = [];
  if (offen[0]) {
    const d = offen[0];
    dealQuellen.push(neu({ art: 'deal', id: d.id, label: `Deal „${d.titel}“` }));
    teile.push(`offener Deal „${d.titel}“ in Stufe ${stufeLabel(d)}, ${wertText(d)}${offen.length > 1 ? ` (dazu ${offen.length - 1} weitere${offen.length > 2 ? '' : 'r'})` : ''}`);
  }
  if (aktiv[0]) {
    const a = aktiv[0];
    dealQuellen.push(neu({ art: 'mandat', id: a.id, label: `Mandat „${a.titel}“` }));
    teile.push(`aktives Mandat „${kurz(a.titel, 60)}“${a.start ? ` seit ${tag(a.start, heute)}` : ''}, ${honorarText(a)}`);
  }
  if (!teile.length) {
    // Kein offener Deal, kein aktives Mandat: der jüngste Abschluss, wenn es einen gibt.
    const zu = chancen.filter(c => c.stufe === 'gewonnen' || c.stufe === 'verloren').sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? ''))[0];
    const beendet = mandate.find(x => x.status === 'beendet');
    if (beendet) { dealQuellen.push(neu({ art: 'mandat', id: beendet.id, label: `Mandat „${beendet.titel}“` })); teile.push(`Mandat „${kurz(beendet.titel, 60)}“ ist beendet${beendet.ende ? ` (${tag(beendet.ende, heute)})` : ''}`); }
    else if (zu) { dealQuellen.push(neu({ art: 'deal', id: zu.id, label: `Deal „${zu.titel}“` })); teile.push(`Deal „${zu.titel}“ ${zu.stufe === 'gewonnen' ? 'gewonnen' : 'verloren'}${zu.grund && zu.stufe === 'verloren' ? ` (${kurz(zu.grund, 40)})` : ''}`); }
  }
  if (teile.length) saetze.push({ text: `${teile.join('; ').replace(/^./, c => c.toUpperCase())}.`, quellen: dealQuellen });

  // 4 · nächster Schritt und Lifecycle — immer
  const l = lifecycleVon(k, crm, heute);
  const schritt = k.naechsterSchritt;
  const sQ: number[] = [];
  let sText: string;
  if (schritt) {
    sQ.push(neu({ art: 'feld', feld: 'naechsterSchritt', label: 'Nächster Schritt' }));
    sText = `Nächster Schritt: „${kurz(schritt.text, 80)}“ am ${tag(schritt.datum, heute)}${schritt.datum < heute ? ' — überfällig' : ''}`;
  } else sText = 'Kein nächster Schritt gesetzt';
  sQ.push(neu({ art: 'feld', feld: 'phase', label: `Lifecycle ${LIFECYCLE_LABEL[l.phase]}` }));
  // 28.09. (H4): ohne gesetzte Phase gilt „Lead“ — ein Vorschlag erscheint nur, wenn er höher ist.
  saetze.push({ text: `${sText} · Lifecycle ${LIFECYCLE_LABEL[l.phase]}${l.vonHand ? '' : l.vorschlag ? ` (nicht gesetzt; Vorschlag ${LIFECYCLE_LABEL[l.vorschlag.id]}: ${l.vorschlag.grund})` : ' (nicht gesetzt)'}.`, quellen: sQ });

  const leer = !g && !m && !kommend && !teile.length && !schritt;
  if (leer) saetze[0] = { text: `Noch nichts festgehalten — kein Gespräch, kein Deal, kein nächster Schritt. ${saetze[0].text}`, quellen: saetze[0].quellen };
  return { saetze, quellen, leer };
}

/** Die Sätze als Klartext mit Quellen-Nummern — für ZOE und zum Kopieren. */
export const zusammenfassungText = (z: Zusammenfassung): string => z.saetze.map(s => `${s.text} ${s.quellen.map(nummer).join('')}`.trim()).join(' ');

// ── Datenpaket für „Frage stellen“ ──────────────────────────────────────────
export interface KontaktPaket {
  person: { name: string; firma?: string; position?: string; kreis?: string; anrede?: string; lifecycle: { phase: LifecyclePhase; label: string; von_hand: boolean; grund: string }; lebensphase?: string; stufe: string; letzter_kontakt?: string; naechster_schritt?: { text: string; datum: string } };
  zusammenfassung: string;
  quellen: { nr: string; was: string }[];
  verlauf: { am: string; art: string; wann?: string; ort?: string; ergebnis?: string; text?: string; bedarf?: string; zusage?: string; naechster?: string }[];
  deals: { titel: string; stufe: string; wert: string; naechster_schritt?: { text: string; datum: string }; qualifizierung: Chance['qualifizierung'] }[];
  mandate: { titel: string; status: string; honorar: string; start?: string; ende?: string }[];
  lead?: { status: string; kriterien: Record<string, string> };
  team_notiz?: string;
}

/**
 * Was ZOE zu einer Person sehen darf: Arbeitsfelder, die letzten 15 Einträge
 * (gekürzt), Deals, Mandate, Lead. Nie `privatNotiz`, nie Einwilligungs-
 * Nachweise, keine Kollegen. Mit Werbesperre: null — die Person geht an keinen Agenten.
 */
export function kontaktPaket(k: Kontakt, crm: Pick<CrmBestand, 'chancen' | 'mandate' | 'firmen'> & Partial<Pick<CrmBestand, 'teilnahmen'>>, heute: string): KontaktPaket | null {
  // Werbesperre und Einschränkung (Art. 18, U2): die Person geht an keinen Agenten.
  if (ausgenommen(k)) return null;
  const z = zusammenfassung(k, crm, heute);
  const l = lifecycleVon(k, crm, heute);
  const firma = k.firmaId ? crm.firmen.find(f => f.id === k.firmaId) : undefined;
  const lead = firma?.lead ?? k.lead;
  return {
    person: {
      name: `${k.vorname} ${k.nachname}`.trim(), firma: firma?.name ?? k.firma, position: kurz(k.position ?? k.jobtitel, 80) || undefined, kreis: k.kreis, anrede: k.anrede,
      lifecycle: { phase: l.phase, label: LIFECYCLE_LABEL[l.phase], von_hand: l.vonHand, grund: l.grund }, lebensphase: k.lebensphase, stufe: k.stufe,
      letzter_kontakt: k.letzterKontakt, naechster_schritt: k.naechsterSchritt,
    },
    zusammenfassung: zusammenfassungText(z),
    quellen: z.quellen.map(q => ({ nr: nummer(q.nr), was: q.label })),
    verlauf: (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && a.von !== 'system').slice(-15).map(a => ({
      am: a.am.slice(0, 10), art: a.art, ...(a.wann ? { wann: a.wann } : {}), ...(a.ort ? { ort: kurz(a.ort, 120) } : {}), ...(a.ergebnis ? { ergebnis: a.ergebnis } : {}), ...(a.text ? { text: kurz(a.text, 300) } : {}),
      ...(a.notiz?.bedarf ? { bedarf: kurz(a.notiz.bedarf, 200) } : {}), ...(a.notiz?.zusage ? { zusage: kurz(a.notiz.zusage, 160) } : {}), ...(a.notiz?.naechster ? { naechster: kurz(a.notiz.naechster, 160) } : {}),
    })),
    deals: crm.chancen.filter(c => c.kontaktIds.includes(k.id)).slice(0, 8).map(c => ({ titel: c.titel, stufe: stufeLabel(c), wert: wertText(c), ...(c.naechsterSchritt ? { naechster_schritt: c.naechsterSchritt } : {}), qualifizierung: c.qualifizierung })),
    mandate: crm.mandate.filter(m => m.kontaktIds.includes(k.id)).slice(0, 5).map(m => ({ titel: kurz(m.titel, 120), status: m.status, honorar: honorarText(m), ...(m.start ? { start: m.start } : {}), ...(m.ende ? { ende: m.ende } : {}) })),
    ...(lead ? { lead: { status: lead.status, kriterien: { ...lead.kriterien } } } : {}),
    ...(k.notiz ? { team_notiz: kurz(k.notiz, 600) } : {}),
  };
}
