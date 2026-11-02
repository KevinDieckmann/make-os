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
import type { CheckVorlage, CheckAntworten, DimKey } from './typen';
import type { ErgebnisAnsicht } from './ergebnis';
import { eigeneWorte } from './ablauf';
import { auswerten, profilAus, saeulenAuswerten } from './auswertung';
import { dimensionName } from './zoe-texte';

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

/** Der Satz zum Stand nach dem Kurzcheck (Werte je Säule bzw. Bereich und die eigenen Worte) — EINE Stelle für Strecke und Nachholen. */
export function kurzcheckText(v: CheckVorlage, antworten: CheckAntworten): string {
  const profil = profilAus(v.katalog, antworten);
  const inno = auswerten(v.katalog, v.regeln, profil, antworten);
  const vorl = saeulenAuswerten(v.katalog, v.regeln, antworten, inno);
  const namen = Object.fromEntries((v.regeln.saeulen ?? []).map(sa => [sa.key, sa.name]));
  // Mit Säulen deren Werte; der Innovations-Check (nur Innovation, 30.10.) nennt seine Bereiche.
  const teile = (v.regeln.saeulen?.length ? Object.entries(vorl.werte).map(([sk, w]) => `${namen[sk] ?? sk} ${w}`)
    : (Object.entries(inno.dimensionen) as [DimKey, number][]).map(([d, w]) => `${dimensionName(d)} ${w}`)).join(', ');
  const worte = eigeneWorte(v, antworten);
  return `${v.name} auf der Website: Kurzcheck ausgefüllt, vorläufige Stufe ${vorl.stufe} (${vorl.stufe_name}, ${vorl.gesamt} von 100${teile ? `; ${teile}` : ''}).${worte ? ` ${worte}` : ''}`;
}

/** Herkunft `quelle` (Link-Parameter des Checks) → bekannte Kampagne (dann „reagiert“ an ihr) bzw. nur als Unterkanal im Text (Prüfung A, Fund 9). */
async function quelleBezug(quelle: string | undefined): Promise<{ bezug?: { art: 'kampagne'; id: string }; zusatz: string }> {
  if (!quelle) return { zusatz: '' };
  try {
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const k = ((await ladeCrm()).kampagnen ?? []).find(x => x.id === quelle);
    if (k) return { bezug: { art: 'kampagne', id: k.id }, zusatz: '' };
  } catch { /* CRM nicht lesbar: nur als Unterkanal */ }
  return { zusatz: ` Herkunft: ${quelle}.` };
}

/**
 * Lead ins CRM (nach der Kontakt-Frage): Anfrage über die Website mit einem Satz zum Stand. Lehnt der Anfrage-Weg ab (Art. 18,
 * eingeschränkte Person …), entsteht nichts — der Grund steht nur intern an der Sitzung, nie beim Teilnehmer.
 * 02.11. (Prüfung A): feste Kennungen der Sitzung (`anfrageIds`, kein Doppel beim Nachholen) · Herkunft → Kampagne (Fund 9) · Art. 18 → Betroffenenantrag +
 * Glocke an den Inhaber (Fund 5) · technischer Fehler → EINE neutrale Glocke an die Marketing-Verantwortliche (Fund 3; der Morgenlauf holt nach).
 */
export async function leadAnlegen(s: CheckSitzung, e: CheckEinstellungen, text: string): Promise<CheckSitzung['crm']> {
  const am = new Date().toISOString();
  if (!s.kontakt) return { status: 'fehler', am, grund: 'kein Kontakt' };
  const person = (await gastgeberVon(e)) ?? 'system';
  try {
    const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
    const q = await quelleBezug(s.quelle);
    const r = await anfrageAnlegen(
      { neu: { vorname: s.kontakt.vorname, email: s.kontakt.email, firma: s.kontakt.firma, ...(s.kontakt.telefon ? { telefon: s.kontakt.telefon } : {}) }, kanal: 'website', text: `${text}${q.zusatz}`, ...(q.bezug ? { bezug: q.bezug } : {}) },
      // Öffentliche Strecke (Kevin 31.10.): trifft die Mail eine vorhandene Person, nur „Adresse unbestätigt“ anhängen — nichts auslösen.
      { person, wer: { art: 'system' }, oeffentlich: true, webseite: 'check', ...(s.anfrageIds ? { ids: s.anfrageIds } : {}) },
    );
    if (r.ok) return { status: 'ok', am, kontaktId: r.bau.kontakt.id, followUpId: r.bau.followUp.id, ...(r.bau.unbestaetigt ? { unbestaetigt: true as const } : {}) };
    if (r.eingeschraenkt) {
      const { eingeschraenktMelden } = await import('@/lib/oeffentlich/eingang-server');
      await eingeschraenktMelden({ ...r.eingeschraenkt, email: s.kontakt.email, weg: 'Check', text, schluessel: s.id });
      return { status: 'abgelehnt', am, grund: r.fehler.slice(0, 200), eingeschraenkt: true };
    }
    return { status: 'abgelehnt', am, grund: r.fehler.slice(0, 200) };
  } catch (x) {
    const { websiteHinweisMelden } = await import('@/lib/oeffentlich/eingang-server');
    await websiteHinweisMelden('eingang').catch(() => null);
    return { status: 'fehler', am, grund: String((x as Error)?.message ?? x).slice(0, 200) };
  }
}

/**
 * Morgenlauf (Prüfung A, Fund 3): Sitzungen mit Kontakt, deren Lead nicht ins CRM kam (technischer Fehler bzw. abgebrochen — nie „abgelehnt“), noch
 * einmal anlegen — mit den festen Kennungen der Sitzung, also ohne Doppel. Erst nach 10 Minuten. Liefert: nachgeholt, weiter offen. Wirft nie.
 */
export async function checkLeadsNachholen(jetzt = new Date()): Promise<{ nachgeholt: number; offen: number }> {
  const { ladeCheckBestand, ladeCheckEinstellungen, sitzungIntern } = await import('./speicher');
  const { vorlageVon } = await import('./katalog');
  const alt = jetzt.getTime() - 10 * 60_000;
  const kandidaten = (await ladeCheckBestand().catch(() => ({ sitzungen: [] as CheckSitzung[] }))).sitzungen.filter(x => checkLeadFehlt(x, alt));
  if (!kandidaten.length) return { nachgeholt: 0, offen: 0 };
  const e = await ladeCheckEinstellungen();
  let nachgeholt = 0, offen = 0;
  for (const x of kandidaten) {
    const v = vorlageVon(x.vorlage);
    const text = v ? kurzcheckText(v, x.antworten) : 'Check auf der Website: Kurzcheck ausgefüllt.';
    const crm = await leadAnlegen(x, e, text).catch(() => null);
    if (crm) await sitzungIntern(x.id, y => ({ ...y, crm })).catch(() => null);
    if (crm?.status === 'ok') nachgeholt++; else if (crm?.status !== 'abgelehnt') offen++;
  }
  return { nachgeholt, offen };
}
/** Fehlt der Lead dieser Sitzung im CRM? Kontakt erfasst, älter als `alt`, kein „ok“ und kein „abgelehnt“. Rein. */
export const checkLeadFehlt = (x: CheckSitzung, altMs: number): boolean =>
  !!x.kontakt && x.kontaktStand === 'erfasst' && Date.parse(x.kontakt.am) <= altMs && (!x.crm || x.crm.status === 'fehler');

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
