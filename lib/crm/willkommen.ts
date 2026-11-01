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
// Neustart-fest: die Stufe wird VOR dem Senden als gesendet vermerkt (nie zweimal; scheitert der Versand, steht der Grund im Log, nicht der Text) —
// seit M1 (01.11.) erst NACH der Vorprüfung (Abmeldelink, Vorlage, Fußzeile): was nie sendbar war, gilt nicht als gesendet.

import { localDay, tagePlus, tagVon } from '@/lib/zeit';
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

/** Welche Stufe heute dran ist (die erste fällige, noch nicht gesendete und nicht gescheiterte) — rein. */
export function willkommenFaellig(stufen: readonly { tag: number }[], start: string, gesendet: readonly number[], heute: string, gescheitert: readonly number[] = []): number | null {
  for (const [i, s] of stufen.entries()) if (!gesendet.includes(i) && !gescheitert.includes(i) && tagePlus(start, s.tag) <= heute) return i;
  return null;
}

export const willkommenStufen = (e: MotorEinstellungen) => (e.willkommenStufen?.length ? e.willkommenStufen : WILLKOMMEN_VORGABE);

/** Den Stand des Laufs festhalten (für die Karte) — nur, wenn er sich ändert (der Takt läuft alle 2 Minuten). */
async function laufVermerken(l: { grund?: string; gesendet: number; gescheitert: number }, jetzt: Date): Promise<void> {
  const post = await ladePost();
  const alt = post.willkommenLauf;
  if (alt && alt.grund === l.grund && !l.gesendet && !l.gescheitert && tagVon(alt.am) === localDay(jetzt)) return;
  await aenderePost(b => ({ ...b, willkommenLauf: { am: jetzt.toISOString(), ...(l.grund ? { grund: l.grund.slice(0, 300) } : {}), gesendet: l.gesendet, gescheitert: l.gescheitert } }), { felder: () => [{ id: 'willkommen-lauf', felder: ['willkommenLauf'] }] });
}

/**
 * Ein Lauf (aus dem Kampagnen-Takt). Liefert die Zahl gesendeter Mails (nie Adressen). B-Prüfung (02.11.): erst ALLE Fälligen prüfen, DANN auf
 * `JE_LAUF_MAX` deckeln (sonst blockierten nicht sendbare die sendbaren); warum die Strecke nichts tut, steht im Bestand (`willkommenLauf`, Karte);
 * scheitert der Versand, wird der Vermerk zurückgenommen und die Stufe als „gescheitert“ markiert (nie automatisch noch einmal, sichtbar in der Karte).
 */
export async function willkommenImTakt(jetzt = new Date()): Promise<number> {
  const post = await ladePost();
  const w = post.einstellungen.willkommen;
  if (!w || !imZeitfenster(jetzt)) return 0;
  const heute = localDay(jetzt);
  const stufen = willkommenStufen(post.einstellungen);
  const [kontakte, sperr] = await Promise.all([kontakteFuerVerarbeitung(), sperrlisteLaden().catch(() => null)]);
  if (!sperr) { await laufVermerken({ grund: 'Die Sperrliste ließ sich nicht lesen — zur Sicherheit keine Mail.', gesendet: 0, gescheitert: 0 }, jetzt); return 0; }
  const gesperrt = sperrPruefer(sperr);
  const dran: { k: Kontakt; stufe: number; start: string }[] = [];
  for (const k of kontakte) {
    if (ausgenommen(k) || gesperrt(k) || !k.email) continue;
    const e = willkommenEinwilligung(k, w.seit);
    if (!e) continue;
    const st = post.willkommen[k.id] ?? { start: (e.zeitpunkt ?? e.erteiltAm).slice(0, 10), gesendet: [] };
    const i = willkommenFaellig(stufen, st.start, st.gesendet, heute, (st.gescheitert ?? []).map(g => g.stufe));
    if (i !== null) dran.push({ k, stufe: i, start: st.start });
  }
  if (!dran.length) return 0;
  const { websiteMailSenden, websiteLagePruefen } = await import('@/lib/oeffentlich/website-post');
  const { abmeldeLink } = await import('@/lib/datenschutz/abmelden');
  const { lage, gruende } = await websiteLagePruefen().catch(() => ({ lage: null, gruende: ['Die Website-Lage ließ sich nicht prüfen.'] }));
  if (!lage) { await laufVermerken({ grund: `Willkommens-Mails warten: ${gruende.join(' ') || 'kein Website-Absender eingerichtet.'}`, gesendet: 0, gescheitert: 0 }, jetzt); return 0; }
  const fuss = post.einstellungen.fusszeile?.trim() || `${lage.verantwortlich}${lage.datenschutzLink ? ` · Datenschutz: ${lage.datenschutzLink}` : ''}`;
  // M1 (01.11.): erst prüfen (Abmeldelink, Vorlage, Fußzeile), DANN vermerken — eine Stufe, die nie sendbar war, gilt nicht als „gesendet“ und kommt
  // nach der Korrektur der Vorlage. Vermerkt wird weiter VOR dem Senden (neustart-fest, nie zweimal).
  const bereit: { d: typeof dran[number]; betreff: string; text: string; ab: string }[] = [];
  let grund: string | undefined;
  for (const d of dran) {
    if (bereit.length >= JE_LAUF_MAX) break;
    const s = stufen[d.stufe];
    const ab = abmeldeLink(d.k.email);
    if (!ab) { grund = 'Ohne Abmeldelink kein Versand (Adresse der Instanz bzw. Pepper fehlt).'; break; }
    const f = entwurfFuellen(s, platzhalterWerte({ anrede: d.k.anrede, vorname: d.k.vorname, nachname: d.k.nachname, absender: lage.marke, heute }));
    if (f.fehler) { grund = `Vorlage ${d.stufe + 1} nicht sendbar: ${f.fehler.slice(0, 160)}`; continue; }
    const fertig = mailFertig(f.text, { abmeldeLink: ab.link, fusszeile: fuss });
    if (fertig.fehler) { grund = `Vorlage ${d.stufe + 1} nicht sendbar: ${fertig.fehler.slice(0, 160)}`; continue; }
    bereit.push({ d, betreff: f.betreff, text: fertig.text, ab: ab.link });
  }
  if (!bereit.length) { await laufVermerken({ ...(grund ? { grund } : {}), gesendet: 0, gescheitert: 0 }, jetzt); return 0; }
  await aenderePost(b => ({ ...b, willkommen: { ...b.willkommen, ...Object.fromEntries(bereit.map(({ d }) => [d.k.id, { ...(b.willkommen[d.k.id] ?? {}), start: d.start, gesendet: Array.from(new Set([...(b.willkommen[d.k.id]?.gesendet ?? []), d.stufe])) }])) } }), { felder: () => bereit.map(({ d }) => ({ id: `willkommen:${d.k.id.slice(0, 2)}`, felder: ['willkommen'] })) });
  let n = 0, gescheitert = 0;
  for (const x of bereit) {
    const r = await websiteMailSenden({ an: x.d.k.email!, vorname: x.d.k.vorname, betreff: x.betreff, text: x.text, art: 'willkommen', lage, listeAbmelden: { link: x.ab } }, jetzt);
    const id = x.d.k.id, stufe = x.d.stufe, am = new Date().toISOString();
    if (r.ok) {
      n++;
      // Für den Rückfluss (Fund 11): die Kennungen der gesendeten Mail — nie Text, nie Adresse.
      await aenderePost(b => ({ ...b, willkommen: { ...b.willkommen, [id]: { ...b.willkommen[id], mails: [...(b.willkommen[id]?.mails ?? []), { stufe, am, ...(r.id ? { id: r.id } : {}), ...(r.threadId ? { threadId: r.threadId } : {}), ...(r.messageId ? { messageId: r.messageId } : {}), von: lage.absender.person }].slice(-20) } } }), { felder: () => [{ id: `willkommen:${id.slice(0, 2)}`, felder: ['willkommen'] }] });
    } else {
      gescheitert++;
      grund = `Versand gescheitert (${r.text.slice(0, 160)})`;
      await aenderePost(b => {
        const e = b.willkommen[id];
        if (!e) return b;
        return { ...b, willkommen: { ...b.willkommen, [id]: { ...e, gesendet: e.gesendet.filter(g => g !== stufe), gescheitert: [...(e.gescheitert ?? []).filter(g => g.stufe !== stufe), { stufe, am, grund: r.text.slice(0, 200) }] } } };
      }, { felder: () => [{ id: `willkommen:${id.slice(0, 2)}`, felder: ['willkommen'] }] });
    }
  }
  await laufVermerken({ ...(grund ? { grund } : {}), gesendet: n, gescheitert }, jetzt);
  return n;
}

/**
 * Antworten auf Willkommens-Mails (Fund 11, B-Prüfung 02.11.): wie der Kampagnen-Rückfluss — Spiegel des Website-Absenders (+ Business-Postfächer
 * des Haushalts) — eine Antwort wird ein Follow-up „Antwort bearbeiten“ an die Marketing-Verantwortliche und steht als Aktivität an der Akte.
 * Idempotent über `rueckfluss` an der Mail. Nur die letzten 60 Tage.
 */
export async function willkommenRueckfluss(jetzt = new Date()): Promise<number> {
  const post = await ladePost();
  const ab = new Date(jetzt.getTime() - 60 * 864e5).toISOString();
  const offen = Object.entries(post.willkommen).flatMap(([kontaktId, e]) => (e.mails ?? []).filter(m => !m.rueckfluss && m.am >= ab && m.von).map(m => ({ kontaktId, m })));
  if (!offen.length) return 0;
  const kontakte = new Map((await kontakteFuerVerarbeitung()).map(k => [k.id, k]));
  const { rueckflussSpiegel, antwortAnAkte } = await import('./kampagnen-motor');
  const { rueckflussArt, fnv } = await import('./kampagnen-post');
  const cache = new Map<string, Awaited<ReturnType<typeof rueckflussSpiegel>>>();
  const treffer: { kontaktId: string; m: (typeof offen)[number]['m']; art: 'antwort' | 'bounce'; am: string; betreff: string }[] = [];
  for (const { kontaktId, m } of offen) {
    const k = kontakte.get(kontaktId);
    if (!k?.email) continue;
    const sp = await rueckflussSpiegel(m.von!, cache);
    const mid = m.messageId ?? (m.id ? sp.koepfe.find(x => x.id === m.id)?.messageId : undefined);
    const g = { am: m.am, ...(m.threadId ? { threadId: m.threadId } : {}), ...(mid ? { messageId: mid } : {}) };
    const e = { an: { email: k.email.toLowerCase(), name: '' }, gesendet: g };
    const kopf = sp.koepfe.find(x => x.id !== m.id && rueckflussArt(e, x, sp.eigene));
    if (kopf) treffer.push({ kontaktId, m, art: rueckflussArt(e, kopf, sp.eigene)!, am: kopf.am, betreff: kopf.betreff });
  }
  if (!treffer.length) return 0;
  const am = jetzt.toISOString(), heute = localDay(jetzt);
  await aenderePost(b => {
    const willkommen = { ...b.willkommen };
    for (const t of treffer) { const e = willkommen[t.kontaktId]; if (e) willkommen[t.kontaktId] = { ...e, mails: (e.mails ?? []).map(m => (m.stufe === t.m.stufe && m.am === t.m.am ? { ...m, rueckfluss: { art: t.art, am: t.am } } : m)) }; }
    return { ...b, willkommen };
  }, { felder: () => treffer.map(t => ({ id: `willkommen:${t.kontaktId.slice(0, 2)}`, felder: ['rueckfluss'] })) });
  const { verantwortlichePerson } = await import('./verantwortung-server');
  const zustaendigFuer = (await verantwortlichePerson('marketing')) ?? treffer[0].m.von!;
  const { aendereCrm } = await import('./speicher');
  const { neuesFollowUp } = await import('./followup');
  await aendereCrm(c => {
    const followups = [...(c.followups ?? [])];
    for (const t of treffer) {
      const id = `fu-kw-${fnv(`${t.kontaktId}|${t.m.stufe}|${t.m.am}`)}${fnv(`w${t.kontaktId}|${t.m.stufe}|${t.m.am}`)}`;
      if (followups.some(f => f.id === id)) continue;
      followups.push(neuesFollowUp({ id, bezug: { art: 'kontakt', id: t.kontaktId }, kontaktId: t.kontaktId, art: t.art === 'antwort' ? 'mail' : 'sonstig',
        text: t.art === 'antwort' ? 'Antwort bearbeiten: Willkommens-Mail' : 'Willkommens-Mail kam zurück — Adresse prüfen', faellig: heute, zustaendig: zustaendigFuer, quelle: 'kampagne' }, kontakte.get(t.kontaktId), 'system', am));
    }
    return { ...c, followups };
  }, { art: 'system' });
  const antworten = treffer.filter(t => t.art === 'antwort');
  if (antworten.length) await antwortAnAkte(antworten.map(t => ({ kontaktId: t.kontaktId, kampagneId: 'willkommen', betreff: t.betreff, am: t.am })), heute, 'Antwort auf Willkommens-Mail');
  return treffer.length;
}
