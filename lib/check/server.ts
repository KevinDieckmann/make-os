// ─── Checks — Server-Hilfen der öffentlichen Strecke (24.10., Innovations-Check) ────────────────────────────────
// Zoes Kontext (Marke, Gastgeber — aus der Instanz), der Datenschutzhinweis (Verantwortlicher aus der Einrichtung), die Antwort-
// Nutzlast für den Browser (Schritt, Fortschritt, eigene Antworten — nie Punkte, Token-Hash, CRM-Verweis) und der Lead ins CRM über
// den EINEN Anfrage-Weg (lib/crm/anfrage-anlegen.ts: Kanal „Website“ → Herkunft Website-Anfrage, Follow-up für den Gastgeber).

import { UG_NAME } from '@/lib/einheiten';
import { firmaOhneRechtsform } from '@/lib/kalender/verbinden-anzeige';
import { vornameVon } from '@/lib/zoe/grundauftrag';
import { datenschutzOeffentlichLaden } from '@/lib/datenschutz/einrichtung-server';
import { datenschutzLink } from '@/lib/kalender/buchung';
import { naechsterSchritt, fortschritt, type AblaufStand } from './ablauf';
import { checkHinweis } from './datenschutz';
import type { CheckSitzung, CheckEinstellungen } from './speicher';
import type { ZoeKontext } from './zoe-texte';
import type { CheckVorlage } from './typen';
import type { ErgebnisAnsicht } from './ergebnis';

/**
 * Wer die Leads der Website empfängt (Check, Kontaktformular, Unterlagen, Bausteine): die Einstellung, sonst (02.11., Prüfung D) die/der
 * Marketing-Verantwortliche (lib/crm/verantwortung-server.ts — nur ein Konto im Haushalt der Inhaber, sonst Rückfall auf den Haupt-Inhaber).
 */
export async function gastgeberVon(e: CheckEinstellungen): Promise<string | null> {
  if (e.gastgeber) return e.gastgeber;
  const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
  return verantwortlichePerson('marketing');
}

export async function zoeKontext(e: CheckEinstellungen): Promise<ZoeKontext> {
  const g = await gastgeberVon(e);
  const vorname = g ? await vornameVon(g).catch(() => '') : '';
  return { marke: e.marke || firmaOhneRechtsform(UG_NAME), gastgeber: vorname || 'uns' };
}

/**
 * Datenschutzhinweis — null, solange es keinen Verantwortlichen gibt (dann bleibt der Check zu). Abweichung in den Check-Einstellungen
 * (30.10.: die Website gehört einer anderen Gesellschaft als die Instanz) geht vor der Einrichtung der Instanz.
 */
export async function hinweisLaden(e?: Pick<CheckEinstellungen, 'verantwortlich' | 'datenschutzLink'>): Promise<{ zeilen: string[]; link: string | null } | null> {
  if (e?.verantwortlich?.trim()) return { zeilen: checkHinweis(e.verantwortlich.trim(), e.datenschutzLink ?? null), link: e.datenschutzLink ?? null };
  const ds = await datenschutzOeffentlichLaden();
  const v = (ds.verantwortlich ?? '').trim();
  if (!v) return null;
  const link = datenschutzLink(ds);
  return { zeilen: checkHinweis(v, link), link };
}

export const ablaufStand = (s: CheckSitzung): AblaufStand => ({ antworten: s.antworten, uebersprungen: s.uebersprungen, kontakt: s.kontaktStand, ...(s.wahl ? { wahl: s.wahl } : {}), ...(s.umfang ? { umfang: s.umfang } : {}) });

/** Was der Browser nach jedem Schritt bekommt — nur eigene Angaben, nie Punkte, Bewertungen, Hash oder CRM-Verweis. */
export function stromFuerBrowser(v: CheckVorlage, s: CheckSitzung) {
  const stand = ablaufStand(s);
  const antworten: Record<string, { optionIds?: string[]; freitext?: string; zusatz?: boolean; optionText?: string; anmerkung?: string }> = {};
  for (const [id, a] of Object.entries(s.antworten)) antworten[id] = { ...(a.optionIds ? { optionIds: a.optionIds } : {}), ...(a.freitext ? { freitext: a.freitext } : {}), ...(typeof a.zusatz === 'boolean' ? { zusatz: a.zusatz } : {}), ...(a.optionText ? { optionText: a.optionText } : {}), ...(a.anmerkung ? { anmerkung: a.anmerkung } : {}) };
  return {
    schritt: naechsterSchritt(v, stand),
    fortschritt: fortschritt(v, stand),
    antworten,
    uebersprungen: s.uebersprungen,
    kontakt: s.kontaktStand,
    ...(s.kontakt ? { vorname: s.kontakt.vorname } : {}),
    ...(s.wahl ? { wahl: s.wahl } : {}),
    ...(s.umfang ? { umfang: s.umfang } : {}),
  };
}

/**
 * Lead ins CRM (nach der Kontakt-Frage): Anfrage über die Website mit einem Satz zum Stand. Lehnt der Anfrage-Weg ab (Art. 18,
 * eingeschränkte Person …), entsteht nichts — der Grund steht nur intern an der Sitzung, nie beim Teilnehmer.
 */
export async function leadAnlegen(s: CheckSitzung, e: CheckEinstellungen, text: string): Promise<CheckSitzung['crm']> {
  const am = new Date().toISOString();
  if (!s.kontakt) return { status: 'fehler', am, grund: 'kein Kontakt' };
  const person = (await gastgeberVon(e)) ?? 'system';
  try {
    const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
    const r = await anfrageAnlegen(
      { neu: { vorname: s.kontakt.vorname, email: s.kontakt.email, firma: s.kontakt.firma, ...(s.kontakt.telefon ? { telefon: s.kontakt.telefon } : {}) }, kanal: 'website', text },
      // Öffentliche Strecke (Kevin 31.10.): trifft die Mail eine vorhandene Person, nur „Adresse unbestätigt“ anhängen — nichts auslösen.
      { person, wer: { art: 'system' }, oeffentlich: true, webseite: 'check' },
    );
    return r.ok ? { status: 'ok', am, kontaktId: r.bau.kontakt.id, followUpId: r.bau.followUp.id, ...(r.bau.unbestaetigt ? { unbestaetigt: true as const } : {}) } : { status: 'abgelehnt', am, grund: r.fehler.slice(0, 200) };
  } catch (x) {
    return { status: 'fehler', am, grund: String((x as Error)?.message ?? x).slice(0, 200) };
  }
}

/**
 * Zu jedem nächsten Schritt das Angebot der Instanz (Einstellungen, je Bereich) — nur Titel, Satz und Link, und jedes Angebot nur einmal (im
 * Vertriebscheck zeigen alle Bereiche auf das Vertriebs-Angebot). EINE Stelle für Ergebnis-Ansicht und Bericht per Mail.
 */
export function schritteMitAngeboten(schritte: ErgebnisAnsicht['schritte'], e: Pick<CheckEinstellungen, 'angebote'>) {
  const gezeigt = new Set<string>();
  return schritte.map(({ angebot: bereich, ...x }) => {
    const a = bereich && !gezeigt.has(bereich) ? e.angebote?.[bereich] : undefined;
    if (a && bereich) gezeigt.add(bereich);
    return { ...x, ...(a ? { angebot: a } : {}) };
  });
}
