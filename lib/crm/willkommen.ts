// ─── Willkommensstrecke nach Einwilligung (Server, 31.10., Welle A · K2) ──────────────────────────────────────────────────────────────
// Kevin 31.10. (K2): „Willkommens-Mails nach Einwilligung automatisch — nur feste Vorlagen, gedrosselt, Abmeldelink.“ Eine dokumentierte Ausnahme
// von Eiserner Regel 3, genauso eng wie die Website-Wege (lib/oeffentlich/website-post.ts):
//   · nur, wenn ein Inhaber den Instanz-Schalter eingeschaltet hat (Vorgabe AUS für jede neue Instanz) — und nur für Einwilligungen AB diesem Tag
//     (`seit`): wer vorher eingewilligt hat, bekommt nichts nachträglich
//   · nur eine werbliche Einwilligung mit VOLLEM Nachweis (Newsletter-Double-Opt-in bzw. Mail-Einwilligung — wie sie aus Check, Unterlage oder
//     Newsletter-Anmeldung entsteht), nicht widerrufen; nie Art. 18, Werbesperre, Sperrliste
//   · nur feste Texte aus den Kampagnen-Einstellungen (neutrale Vorgabe `WILLKOMMEN_VORGABE`), Platzhalter nur Anrede/Name/Absender/Datum — KEINE KI
//   · gesendet über den Website-Absender (`websiteMailSenden`: Grenze je Adresse und Tag, Sperren, `inboxSenden`), mit Abmeldelink im Text und
//     `List-Unsubscribe`, Fußzeile wie die Kampagnen; je Lauf höchstens `JE_LAUF_MAX`, nur im Zeitfenster werktags 8–18 Uhr
//   · eine Abmeldung widerruft die Einwilligung → die Strecke endet von selbst
// Neustart-fest: die Stufe wird VOR dem Senden als gesendet vermerkt (nie zweimal; scheitert der Versand, steht der Grund im Log, nicht der Text).

import { localDay, tagePlus } from '@/lib/zeit';
import type { Einwilligung, Kontakt } from '@/lib/make-one/crm';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { ausgenommen } from './einschraenkung';
import { nachweisLuecken } from './einwilligung';
import { sperrlisteLaden, sperrPruefer } from './sperrliste';
import { aenderePost, ladePost } from './kampagnen-motor';
import { entwurfFuellen, imZeitfenster, JE_LAUF_MAX, mailFertig, platzhalterWerte, WILLKOMMEN_VORGABE, type MotorEinstellungen } from './kampagnen-post';

/** Die tragende Einwilligung für die Strecke (Newsletter/Mail, voller Nachweis, nicht widerrufen) ab `seit` — rein. */
export function willkommenEinwilligung(k: Pick<Kontakt, 'einwilligungen'>, seit: string): Einwilligung | null {
  const ab = seit.slice(0, 10);
  return (k.einwilligungen ?? []).find(e => (e.kanal === 'newsletter' || e.kanal === 'mail') && e.grundlage === 'einwilligung' && !e.widerrufenAm
    && !nachweisLuecken(e).length && (e.zeitpunkt ?? e.erteiltAm).slice(0, 10) >= ab) ?? null;
}

/** Welche Stufe heute dran ist (die erste fällige, noch nicht gesendete) — rein. */
export function willkommenFaellig(stufen: readonly { tag: number }[], start: string, gesendet: readonly number[], heute: string): number | null {
  for (const [i, s] of stufen.entries()) if (!gesendet.includes(i) && tagePlus(start, s.tag) <= heute) return i;
  return null;
}

export const willkommenStufen = (e: MotorEinstellungen) => (e.willkommenStufen?.length ? e.willkommenStufen : WILLKOMMEN_VORGABE);

/** Ein Lauf (aus dem Kampagnen-Takt). Liefert die Zahl gesendeter Mails (nie Adressen). */
export async function willkommenImTakt(jetzt = new Date()): Promise<number> {
  const post = await ladePost();
  const w = post.einstellungen.willkommen;
  if (!w || !imZeitfenster(jetzt)) return 0;
  const heute = localDay(jetzt);
  const stufen = willkommenStufen(post.einstellungen);
  const [kontakte, sperr] = await Promise.all([kontakteFuerVerarbeitung(), sperrlisteLaden().catch(() => null)]);
  if (!sperr) return 0; // ohne lesbare Sperrliste lieber keine Mail
  const gesperrt = sperrPruefer(sperr);
  const dran: { k: Kontakt; stufe: number; start: string }[] = [];
  for (const k of kontakte) {
    if (dran.length >= JE_LAUF_MAX) break;
    if (ausgenommen(k) || gesperrt(k) || !k.email) continue;
    const e = willkommenEinwilligung(k, w.seit);
    if (!e) continue;
    const st = post.willkommen[k.id] ?? { start: (e.zeitpunkt ?? e.erteiltAm).slice(0, 10), gesendet: [] };
    const i = willkommenFaellig(stufen, st.start, st.gesendet, heute);
    if (i !== null) dran.push({ k, stufe: i, start: st.start });
  }
  if (!dran.length) return 0;
  // Vermerken VOR dem Senden (nie zweimal).
  await aenderePost(b => ({ ...b, willkommen: { ...b.willkommen, ...Object.fromEntries(dran.map(d => [d.k.id, { start: d.start, gesendet: Array.from(new Set([...(b.willkommen[d.k.id]?.gesendet ?? []), d.stufe])) }])) } }), { felder: () => dran.map(d => ({ id: `willkommen:${d.k.id.slice(0, 2)}`, felder: ['willkommen'] })) });
  const { websiteMailSenden, websiteLage } = await import('@/lib/oeffentlich/website-post');
  const { abmeldeLink } = await import('@/lib/datenschutz/abmelden');
  const lage = await websiteLage().catch(() => null);
  if (!lage) return 0;
  const fuss = post.einstellungen.fusszeile?.trim() || `${lage.verantwortlich}${lage.datenschutzLink ? ` · Datenschutz: ${lage.datenschutzLink}` : ''}`;
  let n = 0;
  for (const d of dran) {
    const s = stufen[d.stufe];
    const ab = abmeldeLink(d.k.email);
    if (!ab) { console.warn('[willkommen] ohne Abmeldelink kein Versand (Adresse der Instanz bzw. Pepper fehlt)'); break; }
    const f = entwurfFuellen(s, platzhalterWerte({ anrede: d.k.anrede, vorname: d.k.vorname, nachname: d.k.nachname, absender: lage.marke, heute }));
    if (f.fehler) { console.warn('[willkommen] Vorlage nicht sendbar:', f.fehler.slice(0, 160)); continue; }
    const fertig = mailFertig(f.text, { abmeldeLink: ab.link, fusszeile: fuss });
    if (fertig.fehler) continue;
    const r = await websiteMailSenden({ an: d.k.email!, vorname: d.k.vorname, betreff: f.betreff, text: fertig.text, art: 'willkommen', lage, listeAbmelden: { link: ab.link } }, jetzt);
    if (r.ok) n++;
  }
  return n;
}
