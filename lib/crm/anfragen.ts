// ─── Markttraktion · Anfragen-Eingang (rein, getestet, 27.09.) ──────────────
// Kevin (26.09.): Marketing hatte keinen Anfrage-Eingang — eine Anfrage über die
// Webseite, per Mail, auf LinkedIn, aus einer Empfehlung oder nach einem Event
// landete nirgends als Zahl. Hier entsteht aus EINER Eingabe alles, was dazu
// gehört, ohne selbst zu schreiben (das macht die Route):
//   · die Person — vorhanden, oder neu in der Kartei (herkunft „selbst“,
//     Rechtsgrundlage Vertrag/Anbahnung, Lebensphase Interessent, Stufe angesprochen)
//   · eine Aktivität „Anfrage über <Kanal>: …“ (Art „antwort“) im Verlauf — daran
//     erkennen Trichter und Liste eine Anfrage (lib/crm/marketing.ts, istAnfrage)
//   · eine Einwilligung mit Grundlage „anfrage“ für den Kanal, über den die Person
//     geschrieben hat — antworten ist zulässig, Werbung darüber hinaus nicht
//   · am Beitrag (wenn er der Bezug ist) eine Wirkung „anfrage“
//   · an der Kampagne (wenn sie der Bezug ist) das Ergebnis „reagiert“
//   · ein Follow-up „Anfrage beantworten“, fällig heute — über neuesFollowUp
//     (lib/crm/followup.ts), keine zweite Follow-up-Logik
//   · der Lead (Firma, sonst Person ohne Firma) geht auf „kontaktiert“, wenn er
//     noch „neu“ oder leer ist — Qualifizieren und SQL bleiben bei Sales
// Die Liste offener Anfragen liest die Aktivitäten der letzten 30 Tage und hängt
// das Follow-up derselben Person daran: offen, solange es offen ist.

import { STUFEN, wendeAktivitaetAn, anzeigename, normTelefon, type Kontakt, type Einwilligung, type AktivitaetArt } from '@/lib/make-one/crm';
import type { Beitrag, CrmBestand, FollowUp, FollowUpArt, Kampagne, Lead } from './typen';
import { neuesFollowUp, tagPlus } from './followup';
import { leadSaeubern } from './lead-form';
import { leereKriterien } from './leads';
import { firmaNachName } from './firmen-bezug';
import { ANFRAGE_PRAEFIX, ANFRAGE_FOLLOWUP, istAnfrage, istAnfrageFollowUp } from './marketing';
import { OFFENE_STUFEN } from './pipeline';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { alleAdressen } from './emails';

export type AnfrageKanal = 'website' | 'mail' | 'linkedin' | 'telefon' | 'empfehlung' | 'event' | 'whatsapp';
export type AnfrageBezugArt = 'beitrag' | 'kampagne' | 'event';
export interface AnfrageKanalInfo {
  id: AnfrageKanal; label: string;
  /** Art des Follow-ups „Anfrage beantworten“ — über den Kanal, über den die Person kam. */
  followUp: FollowUpArt;
  /** Kanal der Einwilligung mit Grundlage „anfrage“ — keiner bei Empfehlung und Event. */
  einwilligung?: Einwilligung['kanal'];
}
export const ANFRAGE_KANAELE: AnfrageKanalInfo[] = [
  { id: 'website', label: 'Website', followUp: 'mail', einwilligung: 'mail' },
  { id: 'mail', label: 'Mail', followUp: 'mail', einwilligung: 'mail' },
  { id: 'linkedin', label: 'LinkedIn', followUp: 'linkedin', einwilligung: 'social' },
  { id: 'telefon', label: 'Telefon', followUp: 'anruf', einwilligung: 'telefon' },
  { id: 'empfehlung', label: 'Empfehlung', followUp: 'anruf' },
  { id: 'event', label: 'Event', followUp: 'nachricht' },
  // WhatsApp (07.10.): „Kontakt anlegen“ aus einem WhatsApp-Gespräch der Inbox — Person mit Telefonnummer statt Mail; Dublette über die
  // Nummer. Einwilligung „Antwort auf Anfrage“ im eigenen Kanal „whatsapp“ (Kevin 07.10.) — antworten ja, Werbe-Vorlagen erst mit echter
  // Einwilligung (lib/crm/recht.ts, lib/whatsapp/senden.ts).
  { id: 'whatsapp', label: 'WhatsApp', followUp: 'nachricht', einwilligung: 'whatsapp' },
];
export const kanalInfo = (id: string): AnfrageKanalInfo | undefined => ANFRAGE_KANAELE.find(k => k.id === id);
export const ANFRAGE_TAGE = 30;
export const GRENZEN = { text: 3000, name: 80, firma: 160, email: 160, telefon: 60 } as const;

export interface AnfrageEingabe {
  /** Vorhandene Person — oder `neu` mit Name/E-Mail/Firma. */
  kontaktId?: string;
  neu?: { vorname?: string; nachname?: string; email?: string; firma?: string; telefon?: string; linkedin?: string };
  kanal: AnfrageKanal;
  bezug?: { art: AnfrageBezugArt; id: string };
  text: string;
  /** Tag der Anfrage (YYYY-MM-DD), Standard heute. */
  datum?: string;
}
export interface AnfrageKontext {
  kontakte: Kontakt[]; crm: CrmBestand;
  /** Wer erfasst (Team-Kürzel) — schreibt die Aktivität, hält bei neuen Personen die Beziehung. */
  person: string;
  heute: string; jetzt: string;
  ids: { kontakt: string; followUp: string };
  /**
   * Sperrliste (28.09., Ablaufprüfung i): bei einer NEUEN Person — Werbesperre setzen und den Hinweis liefern
   * (lib/crm/sperrliste.ts `neuanlageSperre`, nur Server). Nicht blockieren: die Anfrage wird festgehalten.
   */
  sperre?: (k: Kontakt) => { kontakt: Kontakt; hinweis?: string };
}
export interface AnfrageBau {
  /** Die Person nach der Anfrage — neu oder mit Aktivität, Einwilligung, Stufe (und Lead, wenn sie keine Firma hat). */
  kontakt: Kontakt;
  neuePerson: boolean;
  /** Warum eine „neue“ Person doch eine vorhandene ist (gleiche Mail). */
  hinweis?: string;
  aktivitaetText: string;
  followUp: FollowUp;
  /** Wirkung „anfrage“ am Beitrag — wenn er der Bezug ist und der Eintrag noch fehlt. */
  wirkung?: { beitragId: string; eintrag: Beitrag['wirkung'][number] };
  /** Kampagne als Bezug: Person dabei, Ergebnis „reagiert“. */
  kampagne?: { id: string; kontaktIds: string[]; ergebnis: Kampagne['ergebnisse'][number] };
  /** Lead der Firma geht auf „kontaktiert“ (Person ohne Firma: schon in `kontakt.lead`). */
  firmaLead?: { firmaId: string; lead: Lead };
}
export type AnfrageErgebnis = { ok: true; bau: AnfrageBau } | { ok: false; fehler: string };

const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const mailNorm = (v: unknown) => { const m = txt(v, GRENZEN.email).toLowerCase(); return m.includes('@') ? m : ''; };
/** Telefonnummer als Vergleichsschlüssel (Ziffern international, wie die wa_id von WhatsApp) — leer, wenn zu kurz. */
const telSchluessel = (v: unknown) => normTelefon(String(v ?? '')).replace(/^\+/, '');
/** Vor der Anfrage „neu“, „ansprechen“ oder abgelegt (verloren/ruht) — jetzt angesprochen. Wer weiter ist, bleibt, wo er ist. */
export function stufeNachAnfrage(stufe: Kontakt['stufe']): Kontakt['stufe'] {
  return STUFEN.indexOf(stufe) < STUFEN.indexOf('angesprochen') || stufe === 'verloren' || stufe === 'ruht' ? 'angesprochen' : stufe;
}
/** Text der Aktivität — die Marke, an der eine Anfrage erkannt wird. */
export const anfrageText = (kanal: AnfrageKanal, text: string) => `${ANFRAGE_PRAEFIX}${kanalInfo(kanal)?.label ?? kanal}: ${text}`.slice(0, GRENZEN.text);
/** Höchstlänge der Lead-Notiz (wie `leadSaeubern`). */
export const LEAD_NOTIZ_MAX = 2000;
const GEKUERZT = '[ältere Notiz gekürzt] …';
/**
 * Eine Zeile an eine Notiz hängen, ohne das Neueste zu verlieren (28.09., Ablaufprüfung i): wird es zu lang, fällt
 * der ÄLTESTE Teil vorne weg (markiert „[ältere Notiz gekürzt]“) — vorher schnitt `slice(0, 2000)` die neue Zeile ab.
 */
export function notizAnhaengen(alt: string | undefined, neu: string, max = LEAD_NOTIZ_MAX): { text: string; gekuerzt: boolean } {
  const ganz = `${alt ? `${alt}\n` : ''}${neu}`;
  if (ganz.length <= max) return { text: ganz, gekuerzt: false };
  if (neu.length + GEKUERZT.length + 1 >= max) return { text: neu.slice(0, max), gekuerzt: true };
  return { text: `${GEKUERZT}${ganz.slice(ganz.length - (max - GEKUERZT.length))}`, gekuerzt: true };
}
/** Lead auf „kontaktiert“, wenn er noch neu oder leer ist — sonst unverändert (undefined). `gekuerzt`: ältere Notiz gekürzt. */
export function leadNachAnfrage(alt: Lead | undefined, notiz: string, jetzt: string, person: string): (Lead & { gekuerzt?: boolean }) | undefined {
  if (alt && alt.status !== 'neu') return undefined;
  const n = notizAnhaengen(alt?.notiz, notiz);
  const l = leadSaeubern({ ...(alt ?? { kriterien: leereKriterien() }), status: 'kontaktiert', notiz: n.text, geaendert: jetzt, geaendertVon: person });
  return l && n.gekuerzt ? Object.assign(l, { gekuerzt: true }) : l;
}

/** Aus einer Eingabe alles bauen, was zu einer Anfrage gehört — ohne zu schreiben. */
export function anfrageBauen(e: AnfrageEingabe, ctx: AnfrageKontext): AnfrageErgebnis {
  const info = kanalInfo(e.kanal);
  if (!info) return { ok: false, fehler: 'Kanal: website, mail, linkedin, telefon, empfehlung oder event.' };
  const text = txt(e.text, GRENZEN.text);
  if (!text) return { ok: false, fehler: 'Was wurde angefragt? Der Text ist Pflicht.' };
  const datum = tagOk(e.datum) && e.datum! <= ctx.heute ? e.datum! : ctx.heute;
  const jetztAm = datum === ctx.heute ? ctx.jetzt : `${datum}T12:00:00.000Z`;

  // Person: vorhanden — oder neu, aber nie doppelt (gleiche Mail = dieselbe Person).
  let basis: Kontakt | undefined = idOk(e.kontaktId) ? ctx.kontakte.find(k => k.id === e.kontaktId) : undefined;
  if (e.kontaktId && !basis) return { ok: false, fehler: 'Person nicht gefunden.' };
  let neuePerson = false, hinweis: string | undefined;
  if (!basis) {
    const n = e.neu ?? {};
    const vorname = txt(n.vorname, GRENZEN.name), nachname = txt(n.nachname, GRENZEN.name), firma = txt(n.firma, GRENZEN.firma), email = mailNorm(n.email);
    if (!vorname && !nachname && !firma && !email && !(e.kanal === 'whatsapp' && telSchluessel(n.telefon))) return { ok: false, fehler: 'Wer hat angefragt? Name, Firma oder E-Mail.' };
    // Dublette über ALLE Adressen der Person (28.09., Ablaufprüfung i) — nicht nur die Haupt-Adresse.
    const doppelt = email ? ctx.kontakte.find(k => alleAdressen(k).includes(email)) : undefined;
    // WhatsApp (07.10. abends) und Telefon (Kevin 07.10.): die NUMMER ist ein zweiter Schlüssel (Telefon oder SMS/Mobil der Akte) —
    // greift, wenn keine Akte mit gleicher Mail gefunden wurde. Eine Akte → dort anhängen; mehrere → ablehnen (nie raten).
    const tel = (e.kanal === 'whatsapp' || e.kanal === 'telefon') && !doppelt ? telSchluessel(n.telefon) : '';
    const gleicheNummer = tel ? ctx.kontakte.filter(k => telSchluessel(k.telefon) === tel || telSchluessel(k.sms) === tel) : [];
    if (gleicheNummer.length > 1) return { ok: false, fehler: e.kanal === 'whatsapp' ? 'Diese Nummer steht bei mehreren Personen in der Kartei — bitte im Gespräch „Zuordnen zu …“ die richtige wählen.' : 'Diese Nummer steht bei mehreren Personen in der Kartei — bitte die Person oben auswählen statt neu anzulegen.' };
    if (doppelt) { basis = doppelt; hinweis = `${anzeigename(doppelt)} steht schon in der Kartei (gleiche Mail) — die Anfrage hängt jetzt dort.`; }
    else if (gleicheNummer.length === 1) { basis = gleicheNummer[0]; hinweis = `${anzeigename(gleicheNummer[0])} steht schon in der Kartei (gleiche Nummer) — die Anfrage hängt jetzt dort.`; }
    else {
      const f = firmaNachName(ctx.crm.firmen, firma);
      neuePerson = true;
      basis = {
        id: ctx.ids.kontakt, vorname, nachname, ...(email ? { email } : {}), ...(txt(n.telefon, GRENZEN.telefon) ? { telefon: txt(n.telefon, GRENZEN.telefon) } : {}),
        ...(txt(n.linkedin, 200) ? { linkedin: txt(n.linkedin, 200) } : {}),
        ...(firma ? { firma: f?.name ?? firma, ...(f ? { firmaId: f.id } : {}) } : {}),
        eignung: '', prio: '', stufe: 'neu', lebensphase: 'interessent', anrede: 'Sie', besitzer: ctx.person,
        // Von der Person selbst (Art. 14 greift nicht), Grundlage: Anbahnung eines Vertrags (Art. 6 Abs. 1 lit. b).
        herkunft: 'selbst', rechtsgrundlage: 'vertrag',
        quelle: `Anfrage über ${info.label}`, aktivitaeten: [], importiertAm: datum, geaendertAm: ctx.heute,
      };
      // Sperrliste: nicht blockieren — Werbesperre setzen, Hinweis zeigen (die Anfrage selbst wird beantwortet).
      const s = ctx.sperre?.(basis);
      if (s) { basis = s.kontakt; if (s.hinweis) hinweis = s.hinweis; }
    }
  }
  if (basis.eingeschraenkt) return { ok: false, fehler: `${anzeigename(basis)}: Verarbeitung eingeschränkt (Art. 18) — nichts festhalten, erst unter Kontakt › Datenschutz klären.` };
  if (basis.werbesperre && !neuePerson) return { ok: false, fehler: `${anzeigename(basis)} hat eine Werbesperre. Antworten ja — aber in der Karteikarte, nicht über den Eingang.` };

  // Bezug prüfen — nur, was es gibt.
  const bz = e.bezug && idOk(e.bezug.id) ? e.bezug : undefined;
  const beitrag = bz?.art === 'beitrag' ? (ctx.crm.beitraege ?? []).find(b => b.id === bz.id) : undefined;
  const kampagne = bz?.art === 'kampagne' ? (ctx.crm.kampagnen ?? []).find(k => k.id === bz.id) : undefined;
  const event = bz?.art === 'event' ? (ctx.crm.events ?? []).find(x => x.id === bz.id) : undefined;
  if (bz && !beitrag && !kampagne && !event) return { ok: false, fehler: 'Bezug nicht gefunden.' };
  const bezugId = beitrag?.id ?? kampagne?.id ?? event?.id;
  const bezugText = beitrag ? ` (Beitrag „${beitrag.titel}“)` : kampagne ? ` (Kampagne „${kampagne.name}“)` : event ? ` (Event „${event.titel}“)` : '';

  // Aktivität im Verlauf — die Marke „Anfrage über …“; letzter Kontakt ist der Tag der Anfrage.
  const aktivitaetText = anfrageText(e.kanal, text);
  const art: AktivitaetArt = 'antwort';
  // „antwort“ setzt keine Regel-Wiedervorlage — das Follow-up unten ist der Termin.
  let kontakt: Kontakt = { ...wendeAktivitaetAn(basis, { art, text: aktivitaetText, von: ctx.person, bezug: bezugId, stufe: stufeNachAnfrage(basis.stufe) }, datum, jetztAm, tagPlus), geaendertAm: ctx.heute };

  // Einwilligung „Antwort auf Anfrage“ für den Kanal, über den die Person geschrieben hat — nur, wenn dort noch keine gültige steht.
  if (info.einwilligung) {
    const hat = (kontakt.einwilligungen ?? []).some(x => x.kanal === info.einwilligung && !x.widerrufenAm);
    const erreichbar = info.einwilligung === 'mail' ? !!kontakt.email : info.einwilligung === 'telefon' ? !!(kontakt.telefon || kontakt.sms) : true;
    if (!hat && erreichbar) kontakt = { ...kontakt, einwilligungen: [...(kontakt.einwilligungen ?? []), { kanal: info.einwilligung, grundlage: 'anfrage', erteiltAm: datum, nachweis: `Anfrage über ${info.label} am ${datum}${bezugText}` }] };
  }

  // Lead: Firma, sonst die Person selbst.
  const leadNotiz = `Anfrage über ${info.label} (${datum})${bezugText}`;
  let firmaLead: AnfrageBau['firmaLead'];
  if (kontakt.firmaId) {
    const f = ctx.crm.firmen.find(x => x.id === kontakt.firmaId);
    const l = f ? leadNachAnfrage(f.lead, leadNotiz, ctx.jetzt, ctx.person) : undefined;
    if (f && l) { const { gekuerzt, ...lead } = l; firmaLead = { firmaId: f.id, lead }; if (gekuerzt) hinweis = [hinweis, 'Die Lead-Notiz war zu lang — der älteste Teil wurde gekürzt, die neue Zeile steht.'].filter(Boolean).join(' '); }
  } else {
    const l = leadNachAnfrage(kontakt.lead, leadNotiz, ctx.jetzt, ctx.person);
    if (l) { const { gekuerzt, ...lead } = l; kontakt = { ...kontakt, lead }; if (gekuerzt) hinweis = [hinweis, 'Die Lead-Notiz war zu lang — der älteste Teil wurde gekürzt, die neue Zeile steht.'].filter(Boolean).join(' '); }
  }

  // Wirkung am Beitrag — je Person und Art einmal.
  const wirkung = beitrag && !beitrag.wirkung.some(w => w.kontaktId === kontakt.id && w.art === 'anfrage')
    ? { beitragId: beitrag.id, eintrag: { kontaktId: kontakt.id, art: 'anfrage' as const, am: datum, notiz: text.slice(0, 300) } } : undefined;
  // Kampagne: die Person ist dabei und hat reagiert.
  const kp = kampagne ? { id: kampagne.id, kontaktIds: kampagne.kontaktIds.includes(kontakt.id) ? kampagne.kontaktIds : [...kampagne.kontaktIds, kontakt.id], ergebnis: { kontaktId: kontakt.id, ergebnis: 'reagiert' as const, am: datum, von: ctx.person } } : undefined;

  // Follow-up „Anfrage beantworten“ — fällig heute, über die eine Follow-up-Logik.
  const followUp = neuesFollowUp({
    id: ctx.ids.followUp, bezug: { art: 'kontakt', id: kontakt.id }, kontaktId: kontakt.id, art: info.followUp,
    text: `${ANFRAGE_FOLLOWUP} — ${info.label}${beitrag ? `, „${beitrag.titel.slice(0, 60)}“` : kampagne ? `, „${kampagne.name.slice(0, 60)}“` : event ? `, „${event.titel.slice(0, 60)}“` : ''}`,
    faellig: ctx.heute, quelle: kampagne ? 'kampagne' : 'hand', notiz: text.slice(0, 1000),
  }, kontakt, ctx.person, ctx.jetzt);

  return { ok: true, bau: { kontakt, neuePerson, ...(hinweis ? { hinweis } : {}), aktivitaetText, followUp, ...(wirkung ? { wirkung } : {}), ...(kp ? { kampagne: kp } : {}), ...(firmaLead ? { firmaLead } : {}) } };
}

// ── Liste der Anfragen ─────────────────────────────────────────────────────
export interface AnfrageZeile {
  /** Schlüssel: Person + Zeitpunkt der Aktivität. */
  id: string;
  kontaktId: string; name: string; firma?: string; firmaId?: string;
  am: string; kanal: string; text: string; von: string;
  bezug?: { art: AnfrageBezugArt; id: string; titel: string };
  /** Das Follow-up „Anfrage beantworten“ dieser Person — offen oder erledigt. */
  followUp?: { id: string; faellig: string; status: FollowUp['status'] };
  offen: boolean;
  /** Offener Deal mit dieser Person — die Anfrage ist schon übergeben. */
  deal?: { id: string; titel: string };
  leadStatus?: Lead['status'];
}

/** Anfragen der letzten `tage` Tage aus den Verläufen, jüngste zuerst — mit Follow-up-Stand und Deal derselben Person. */
export function anfragenListe(kontakte: Kontakt[], crm: CrmBestand, heute: string, tage = ANFRAGE_TAGE): AnfrageZeile[] {
  const von = new Date(`${heute}T12:00:00Z`); von.setUTCDate(von.getUTCDate() - (tage - 1));
  const ab = von.toISOString().slice(0, 10);
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  const raus: AnfrageZeile[] = [];
  for (const k of kontakte) {
    if (ausgenommen(k)) continue;
    const anfragen = (k.aktivitaeten ?? []).filter(a => istAnfrage(a) && a.am.slice(0, 10) >= ab && a.am.slice(0, 10) <= heute);
    if (!anfragen.length) continue;
    const fus = (crm.followups ?? []).filter(f => f.kontaktId === k.id && istAnfrageFollowUp(f)).sort((a, b) => b.angelegt.localeCompare(a.angelegt));
    const offenes = fus.find(f => f.status === 'offen');
    const deal = crm.chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id));
    const firma = k.firmaId ? firmen.get(k.firmaId) : undefined;
    for (const a of anfragen) {
      const rest = (a.text ?? '').slice(ANFRAGE_PRAEFIX.length);
      const i = rest.indexOf(':');
      const kanal = i > 0 ? rest.slice(0, i).trim() : 'unbekannt';
      const text = i > 0 ? rest.slice(i + 1).trim() : rest.trim();
      const bezug = a.bezug ? bezugVon(a.bezug, crm) : undefined;
      // Das Follow-up desselben Tages, sonst das jüngste — bei mehreren Anfragen derselben Person eine Näherung.
      const fu = fus.find(f => f.angelegt.slice(0, 10) === a.am.slice(0, 10)) ?? fus[0];
      raus.push({
        id: `${k.id}|${a.am}`, kontaktId: k.id, name: anzeigename(k), ...(firma?.name ?? k.firma ? { firma: firma?.name ?? k.firma } : {}), ...(k.firmaId ? { firmaId: k.firmaId } : {}),
        am: a.am, kanal, text, von: a.von, ...(bezug ? { bezug } : {}),
        ...(fu ? { followUp: { id: fu.id, faellig: fu.faellig, status: fu.status } } : {}),
        offen: !!offenes && (fu ? fu.status === 'offen' : true),
        ...(deal ? { deal: { id: deal.id, titel: deal.titel } } : {}),
        ...((firma?.lead?.status ?? k.lead?.status) ? { leadStatus: firma?.lead?.status ?? k.lead?.status } : {}),
      });
    }
  }
  return raus.sort((a, b) => b.am.localeCompare(a.am));
}

function bezugVon(id: string, crm: CrmBestand): AnfrageZeile['bezug'] {
  const b = (crm.beitraege ?? []).find(x => x.id === id); if (b) return { art: 'beitrag', id, titel: b.titel };
  const k = (crm.kampagnen ?? []).find(x => x.id === id); if (k) return { art: 'kampagne', id, titel: k.name };
  const e = (crm.events ?? []).find(x => x.id === id); if (e) return { art: 'event', id, titel: e.titel };
  return undefined;
}
