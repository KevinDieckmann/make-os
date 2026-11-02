// ─── Markttraktion › Kampagne › Sequenz & Mail-Stapel (31.10., Welle A · Kampagnen-Motor, lib/crm/kampagnen-motor.ts) ────────────────────
// GET  ?kampagneId=…  → { ok, istInhaber, sequenz, neuJeTag, zahlen, schritte (Kennzahlen je Schritt), staende (ohne Namen der Verläufe), eintraege
//                        (Mail-Stapel + Druckliste dieser Kampagne), einstellungen (Grenze, Fußzeile, Art.-14, Willkommen), eigenesRisiko, risikoPlaybook,
//                        postfaecher (eigene Business-Postfächer der Sitzung) }
// POST { aktion: 'sequenz', kampagneId, sequenz, neuJeTag? }    → Sequenz speichern (geprüft: Platzhalter 400, Grenzen 413)
//      { aktion: 'vorbereiten', kampagneId }                     → jetzt fortschreiben (Ziele starten, Entwürfe/Follow-ups erzeugen) — wie der Takt
//      { aktion: 'entwurf', id, betreff, text }                   → einen Entwurf bearbeiten (danach erneut geprüft)
//      { aktion: 'feinschliff', id }                              → ZOE überarbeitet EINEN Entwurf (KI-Tor, Kategorie crm) — nur auf Klick, kein Versand
//      { aktion: 'freigeben', kampagneId, ids, postfach }         → EIN Klick je Stapel (Einzel-Häkchen); gesendet wird danach gedrosselt im Takt
//      { aktion: 'verwerfen' | 'gedruckt' | 'erneut', kampagneId, ids }
//      { aktion: 'stoppen', kampagneId, ziel: { art, id } }       → Sequenz für ein Ziel von Hand beenden (offene Entwürfe verworfen, Follow-ups abgesagt)
//      { aktion: 'als-lead', followupId }                          → am Follow-up „Antwort bearbeiten“: das Ziel als Lead übernehmen (Ergebnis „Interesse
//                                                                    → Lead“, lib/crm/kampagnen-ergebnis.ts — eine Stelle mit der Kampagnen-Seite)
// GET  ?teil=willkommen → Willkommensstrecke: Schalter, Texte, und wer welche Stufe bekam (nur Namen + Stufen, nie Adressen) — Karte unter Website › Formulare
// M1 (01.11.): „vorbereiten“ liefert Zähler UND Gründe (übersprungen, nicht gestartet) und sagt, wenn die Kampagne nicht aktiv ist; „sequenz“ übersetzt
// laufende Stände vorher auf die Schritt-Kennung (`standMitKennung`) und nennt, wie viele Ziele gerade laufen.
//      { aktion: 'einstellungen', tagesgrenze?, fusszeile?, art14Text?, willkommen?: boolean, willkommenStufen? } → nur Inhaber
// Zugang: Haushalt des Inhabers (Modul Markttraktion). Schreiben nur per Sitzung (Dienstweg/ZOE 403) mit Bau-Kennung — die Freigabe ist der Klick
// nach Eiserner Regel 3; senden tut der Takt im Namen der freigebenden Person und ihres Postfachs.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { darfSteuern, NUR_STEUERN } from '@/lib/zugang/steuern';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { kennzahlenJeSchritt, sequenzPruefen, sequenzSaeubern, staendeZaehlen, beenden, standErsetzen, standMitKennung, laufendeZiele, schrittIndex, gleichesZiel, SEQUENZ_GRENZEN } from '@/lib/crm/sequenz';
import { aenderePost, eigenesRisiko, eintraegeSetzen, entwurfAendern, ladePost, MotorFehler, risikoPlaybook, sequenzenFortschreiben, sequenzFollowupsAbsagen, stapelFreigeben } from '@/lib/crm/kampagnen-motor';
import { einstellungenPruefen, einstellungenSaeubern, postIdAusAntwort, ART14_VORGABE, TAGESGRENZE_MAX, WILLKOMMEN_VORGABE } from '@/lib/crm/kampagnen-post';
import { namenVon } from '@/lib/zugang/konten';
import type { KampagnenZiel } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const KENNUNG = /^[a-z0-9][a-z0-9-]{1,63}$/;
const idsAus = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^km-[0-9a-f]{16}$/.test(x)) : []);

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (new URL(req.url).searchParams.get('teil') === 'willkommen') return willkommenLage(req, z.person);
  const kampagneId = new URL(req.url).searchParams.get('kampagneId') ?? '';
  if (!KENNUNG.test(kampagneId)) return fehler('kampagneId fehlt.', 400);
  const [crm, post, risiko, inhaber, namen] = await Promise.all([ladeCrm(), ladePost(), eigenesRisiko(), darfSteuern(z.person), namenVon().catch(() => ({} as Record<string, string>))]);
  const k = crm.kampagnen.find(x => x.id === kampagneId);
  if (!k) return fehler('Diese Kampagne gibt es nicht (mehr).', 404);
  const eintraege = post.eintraege.filter(x => x.kampagneId === k.id).sort((a, b) => a.angelegt.localeCompare(b.angelegt));
  leseZugriff(req, 'kontakte', { anzahl: eintraege.length });
  let postfaecher: { id: string; name: string }[] = [];
  if (!z.dienst) {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    const { formularPostfachBereichOk } = await import('@/lib/crm/formulare');
    const { adresseMaskiert } = await import('@/lib/zugang/konten');
    postfaecher = (await ladePostfaecher(z.person)).filter(p => p.quelle !== 'whatsapp' && formularPostfachBereichOk(p.bereich)).map(p => ({ id: p.id, name: `${p.anzeigename} · ${adresseMaskiert(p.adresse)}` }));
  }
  const e = post.einstellungen;
  const name = (p?: string) => (p ? namen[p] ?? p : undefined);
  return NextResponse.json({
    ok: true, istInhaber: inhaber, sequenz: k.sequenz ?? [], neuJeTag: k.neuJeTag ?? null, status: k.status,
    zahlen: staendeZaehlen(k), schritte: kennzahlenJeSchritt(k),
    // Schritt als Index in der heutigen Sequenz (an der Kennung, M1 01.11.) — -1 = den Schritt gibt es nicht mehr (der Lauf beendet das Ziel).
    staende: (k.zielStaende ?? []).map(s => ({ art: s.art, id: s.id, schritt: schrittIndex(k, s), faelligAm: s.faelligAm, status: s.status, ...(s.grund ? { grund: s.grund } : {}) })),
    eintraege: eintraege.map(x => ({ ...x, ...(x.freigabe ? { freigabe: { ...x.freigabe, von: name(x.freigabe.von), ...(x.freigabe.eigenesRisiko ? { eigenesRisiko: { ...x.freigabe.eigenesRisiko, von: name(x.freigabe.eigenesRisiko.von) } } : {}) } } : {}) })),
    einstellungen: { tagesgrenze: e.tagesgrenze, tagesgrenzeMax: TAGESGRENZE_MAX, fusszeile: e.fusszeile ?? '', art14Text: e.art14Text ?? '', art14Vorgabe: ART14_VORGABE,
      willkommen: e.willkommen ? { seit: e.willkommen.seit, von: name(e.willkommen.von) } : null, willkommenStufen: e.willkommenStufen ?? WILLKOMMEN_VORGABE },
    eigenesRisiko: risiko ? { seit: risiko.seit, von: name(risiko.von) } : null, risikoPlaybook: risikoPlaybook(k), postfaecher,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  // Eiserne Regel 3: freigeben, bearbeiten, verwerfen nur per Klick einer Person — ZOE, Takt und Skripte nie.
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);
  const kampagneId = typeof b.kampagneId === 'string' && KENNUNG.test(b.kampagneId) ? b.kampagneId : '';
  try {
    switch (b.aktion) {
      case 'sequenz': {
        if (!kampagneId) return fehler('kampagneId fehlt.', 400);
        const f = sequenzPruefen(b.sequenz);
        const n = b.neuJeTag === undefined || b.neuJeTag === null ? null : Number(b.neuJeTag);
        if (n !== null && (!Number.isInteger(n) || n < 1 || n > SEQUENZ_GRENZEN.neuJeTag)) f.push({ status: 400, text: `Neue Ziele je Tag: 1 bis ${SEQUENZ_GRENZEN.neuJeTag}.` });
        if (f.length) return fehler(f.map(x => x.text).join(' '), f.some(x => x.status === 413) ? 413 : 400);
        const sequenz = sequenzSaeubern(b.sequenz);
        let da = false, laufen = 0;
        await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(k => {
          if (k.id !== kampagneId) return k;
          da = true;
          laufen = laufendeZiele(k);
          // M1 (01.11.): Altstand (Index) VOR der Änderung auf die Schritt-Kennung der bisherigen Sequenz übersetzen — so verschiebt ein eingefügter
          // oder entfernter Schritt keinen laufenden Stand; ein entfernter Schritt beendet sein Ziel beim nächsten Lauf („Schritt gibt es nicht mehr“).
          const { sequenz: _s, neuJeTag: _n, zielStaende, ...rest } = k;
          const staende = (zielStaende ?? []).map(st => standMitKennung(k, st));
          return { ...rest, ...(sequenz ? { sequenz } : {}), ...(n !== null ? { neuJeTag: n } : {}), ...(staende.length ? { zielStaende: staende } : {}), geaendert: new Date().toISOString(), geaendertVon: z.person };
        }) }), wer);
        if (!da) return fehler('Diese Kampagne gibt es nicht (mehr).', 404);
        return NextResponse.json({ ok: true, schritte: sequenz?.length ?? 0, laufen,
          text: laufen ? `Sequenz gespeichert. ${laufen === 1 ? 'Ein Ziel läuft' : `${laufen} Ziele laufen`} gerade — sie bleiben an ihrem Schritt; wer an einem entfernten Schritt steht, endet beim nächsten Lauf.` : 'Sequenz gespeichert.' });
      }
      case 'vorbereiten': {
        const r = await sequenzenFortschreiben(new Date(), kampagneId ? { kampagneId } : {});
        return NextResponse.json({ ok: true, ...r, text: vorbereitetText(r) });
      }
      case 'als-lead': {
        const postId = typeof b.followupId === 'string' ? postIdAusAntwort(b.followupId) : null;
        if (!postId) return fehler('followupId eines Follow-ups „Antwort bearbeiten“ nötig.', 400);
        const x = (await ladePost()).eintraege.find(y => y.id === postId);
        if (!x) return fehler('Die Kampagnen-Mail zu dieser Antwort gibt es nicht (mehr).', 404);
        const { ergebnisFesthalten } = await import('@/lib/crm/kampagnen-ergebnis');
        const { localDay } = await import('@/lib/zeit');
        // B-Prüfung (02.11., Fund 14): das Follow-up „Antwort bearbeiten“ wird in DERSELBEN Sperre beansprucht und erledigt — ein Doppelklick bzw. ein
        // zweiter Aufruf hält das Ergebnis nicht zweimal fest; scheitert das Festhalten, ist das Follow-up wieder offen.
        const fuId = b.followupId as string, jetzt = new Date().toISOString();
        let lage = 'fehlt' as 'neu' | 'schon' | 'fehlt';
        await aendereCrm(c => {
          const f = (c.followups ?? []).find(y => y.id === fuId);
          if (!f) { lage = 'fehlt'; return c; }
          if (f.status !== 'offen') { lage = 'schon'; return c; }
          lage = 'neu';
          return { ...c, followups: (c.followups ?? []).map(y => (y.id === fuId ? { ...y, status: 'erledigt' as const, ergebnis: 'chance', erledigtAm: jetzt, geaendert: jetzt, geaendertVon: z.person } : y)) };
        }, wer);
        if (lage === 'schon') return NextResponse.json({ ok: true, schon: true, text: 'Diese Antwort ist schon bearbeitet — nichts doppelt festgehalten.' });
        const r = await ergebnisFesthalten({ kampagneId: x.kampagneId, ziel: x.ziel, ergebnis: 'chance', von: z.person, person: z.person, wer, heute: localDay() });
        if (r.status !== 200 && lage === 'neu') await aendereCrm(c => ({ ...c, followups: (c.followups ?? []).map(y => (y.id === fuId && y.status === 'erledigt' && y.erledigtAm === jetzt ? { ...y, status: 'offen' as const, ergebnis: undefined, erledigtAm: undefined, geaendert: new Date().toISOString() } : y)) }), wer);
        // Ehrlich (02.11., R2-2 · B): ein Kunde mit laufendem Mandat bzw. ein Lead mit offenem Deal geht NICHT in die Qualifizierung — die Meldung sagt, wo es weitergeht.
        const inQuali = r.body.qualifizierung !== false;
        return NextResponse.json(r.status === 200 ? { ...r.body, text: inQuali ? `Als Lead übernommen — ${x.an.name} steht jetzt in der Qualifizierung.${r.body.hinweis ? ` ${String(r.body.hinweis)}` : ''}` : `Antwort festgehalten — ${x.an.name}: ${String(r.body.hinweis ?? 'nicht in die Qualifizierung.')}` } : r.body, { status: r.status });
      }
      case 'entwurf': {
        if (typeof b.id !== 'string' || typeof b.betreff !== 'string' || typeof b.text !== 'string') return fehler('id, betreff und text.', 400);
        const x = await entwurfAendern({ person: z.person, id: b.id, betreff: b.betreff, text: b.text, wer });
        return NextResponse.json({ ok: true, eintrag: x });
      }
      case 'feinschliff': {
        if (typeof b.id !== 'string') return fehler('id fehlt.', 400);
        const { modellSchranke } = await import('@/lib/zugang/umfang');
        const schranke = modellSchranke(req); if (schranke) return schranke;
        const post = await ladePost();
        const x = post.eintraege.find(y => y.id === b.id);
        if (!x || x.kanal !== 'mail' || (x.status !== 'entwurf' && x.status !== 'fehler')) return fehler('Nur Mail-Entwürfe lassen sich überarbeiten.', 409);
        const { askText, extractJson, fremd, FREMD_REGEL } = await import('@/lib/anthropic');
        const { kiAus } = await import('@/lib/datenschutz/ki-lauf');
        const { kiKennzeichen } = await import('@/lib/datenschutz/ki-kennzeichnung');
        const r = await askText({
          system: [FREMD_REGEL, 'Du überarbeitest eine kurze, persönliche Geschäfts-Mail (Erstansprache einer Kampagne). Ton und Länge bleiben, Fakten bleiben — erfinde nichts dazu (keine Zahlen, Termine, Preise). Platzhalter in doppelten geschweiften Klammern ({{…}}) bleiben unverändert stehen. Keine Werbefloskeln, keine Superlative. Antworte nur als JSON: {"betreff": "…", "text": "…"}.'].join('\n'),
          user: fremd('entwurf', JSON.stringify({ betreff: x.betreff, text: x.text })), maxTokens: 1500, timeoutMs: 60_000, zweck: 'kampagne-feinschliff', effort: 'low', ki: kiAus(req, ['crm'], { anzahl: 1 }),
        });
        if (!r.ok) return fehler((await import('@/lib/anthropic')).modellFehlerText(r), 502);
        const j = extractJson<{ betreff?: unknown; text?: unknown }>(r.text);
        if (typeof j?.betreff !== 'string' || typeof j?.text !== 'string' || !j.betreff.trim() || !j.text.trim()) return fehler('Die Antwort von ZOE war nicht lesbar — der Entwurf bleibt, wie er ist.', 502);
        const neu = await entwurfAendern({ person: z.person, id: x.id, betreff: j.betreff.slice(0, 200), text: j.text.slice(0, 4000), zoe: true, wer });
        return NextResponse.json({ ok: true, eintrag: neu, ki: kiKennzeichen() });
      }
      case 'freigeben': {
        if (!kampagneId || typeof b.postfach !== 'string') return fehler('kampagneId, ids und postfach.', 400);
        const r = await stapelFreigeben({ person: z.person, kampagneId, ids: idsAus(b.ids), postfach: b.postfach, wer });
        const namen = await namenVon().catch(() => ({} as Record<string, string>));
        return NextResponse.json({ ok: true, freigegeben: r.freigegeben, ...(r.eigenesRisiko ? { eigenesRisiko: { seit: r.eigenesRisiko.seit, von: namen[r.eigenesRisiko.von] ?? r.eigenesRisiko.von } } : {}),
          text: `${r.freigegeben} ${r.freigegeben === 1 ? 'Mail' : 'Mails'} freigegeben — gesendet wird werktags zwischen 8 und 18 Uhr, gedrosselt je Postfach.` });
      }
      case 'verwerfen': case 'gedruckt': case 'erneut': {
        if (!kampagneId) return fehler('kampagneId fehlt.', 400);
        // B-Prüfung (02.11., Fund 18): „unklar“ heißt, die Mail ist womöglich schon raus — erneut vorbereiten nur nach ausdrücklicher Rückfrage.
        if (b.aktion === 'erneut' && b.bestaetigt !== true && (await ladePost()).eintraege.some(y => idsAus(b.ids).includes(y.id) && y.status === 'unklar')) {
          return NextResponse.json({ ok: false, rueckfrage: true, fehler: 'Erst im Postfach unter „Gesendet“ nachsehen, ob die Mail schon raus ist — sonst bekommt das Ziel sie zweimal. Dann noch einmal mit Bestätigung.' }, { status: 409 });
        }
        const n = await eintraegeSetzen({ person: z.person, kampagneId, ids: idsAus(b.ids), aktion: b.aktion, wer });
        return NextResponse.json({ ok: true, geaendert: n });
      }
      case 'stoppen': {
        const ziel = b.ziel as KampagnenZiel | undefined;
        if (!kampagneId || !ziel || (ziel.art !== 'kontakt' && ziel.art !== 'firma') || typeof ziel.id !== 'string') return fehler('kampagneId und ziel.', 400);
        let da = false;
        await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(k => {
          const s = k.id === kampagneId ? (k.zielStaende ?? []).find(x => gleichesZiel(x, ziel)) : undefined;
          if (!s) return k;
          da = true;
          return standErsetzen(k, beenden(s, 'gestoppt', 'von Hand gestoppt', new Date().toISOString(), 'gestoppt', z.person));
        }), ...(c.kampagnen.some(k => k.id === kampagneId) ? { followups: sequenzFollowupsAbsagen(c, kampagneId, ziel, 'Von Hand gestoppt — die Sequenz endet.', new Date().toISOString()) } : {}) }), wer);
        if (!da) return fehler('Dieses Ziel läuft in der Kampagne nicht.', 404);
        await aenderePost(p => ({ ...p, eintraege: p.eintraege.map(x => (x.kampagneId === kampagneId && gleichesZiel(x.ziel, ziel) && (x.status === 'entwurf' || x.status === 'freigegeben' || x.status === 'fehler') ? { ...x, status: 'verworfen' as const, geaendert: new Date().toISOString() } : x)) }), { wer });
        return NextResponse.json({ ok: true });
      }
      case 'einstellungen': {
        // Marketing steuern (02.11., Prüfung D): Inhaber ODER volles Mitglied des Haushalts — eine Regel (lib/zugang/steuern.ts).
        if (!(await darfSteuern(z.person))) return fehler(NUR_STEUERN, 403);
        const f = einstellungenPruefen(b);
        if (f.length) return fehler(f.map(x => x.text).join(' '), f.some(x => x.status === 413) ? 413 : 400);
        const jetzt = new Date().toISOString();
        const e = await aenderePost(p => {
          const alt = p.einstellungen;
          const willkommen = b.willkommen === true ? (alt.willkommen ?? { an: true as const, seit: jetzt, von: z.person }) : b.willkommen === false ? undefined : alt.willkommen;
          return { ...p, einstellungen: einstellungenSaeubern({
            ...alt, ...(b.tagesgrenze !== undefined ? { tagesgrenze: b.tagesgrenze } : {}), ...(typeof b.fusszeile === 'string' ? { fusszeile: b.fusszeile } : {}),
            ...(typeof b.art14Text === 'string' ? { art14Text: b.art14Text } : {}), ...(Array.isArray(b.willkommenStufen) ? { willkommenStufen: b.willkommenStufen } : {}), willkommen,
          }) };
        }, { wer });
        return NextResponse.json({ ok: true, einstellungen: { tagesgrenze: e.einstellungen.tagesgrenze, willkommen: !!e.einstellungen.willkommen } });
      }
      default: return fehler('aktion: sequenz, vorbereiten, entwurf, feinschliff, freigeben, verwerfen, gedruckt, erneut, stoppen, als-lead oder einstellungen.', 400);
    }
  } catch (e) {
    if (e instanceof MotorFehler) return fehler(e.message, e.status);
    console.error('[crm/kampagnen/motor]', (e as Error)?.message);
    return fehler('Nicht gespeichert — interner Fehler.', 500);
  }
}

/** Was „Jetzt vorbereiten“ bewirkt hat — in einfachen Sätzen (M1, 01.11.): Zähler, Gründe, und ob die Kampagne erst aktiv werden muss. */
function vorbereitetText(r: Awaited<ReturnType<typeof sequenzenFortschreiben>>): string {
  const teile: string[] = [];
  if (r.kampagne && !r.kampagne.mitSequenz) return 'Diese Kampagne hat noch keine Sequenz — erst eine Sequenz anlegen.';
  if (r.kampagne && r.kampagne.status !== 'aktiv') teile.push('Die Kampagne ist nicht aktiv — erst den Status auf „Aktiv“ stellen. Dann starten Ziele und Entwürfe entstehen.');
  const z = (n: number, eins: string, viele: string) => (n === 1 ? `1 ${eins}` : `${n} ${viele}`);
  if (r.gestartet) teile.push(`${z(r.gestartet, 'Ziel', 'Ziele')} gestartet.`);
  if (r.entwuerfe) teile.push(`${z(r.entwuerfe, 'neuer Entwurf', 'neue Entwürfe')} im Mail-Stapel bzw. in der Druckliste.`);
  if (r.followups) teile.push(`${z(r.followups, 'Follow-up', 'Follow-ups')} angelegt.`);
  if (r.weiter) teile.push(`${z(r.weiter, 'Ziel', 'Ziele')} einen Schritt weiter.`);
  const gruende = Object.entries(r.gruende);
  if (gruende.length) teile.push(`Nicht vorbereitet: ${gruende.map(([g, n]) => `${g} (${n})`).join(' · ')}.`);
  return teile.length ? teile.join(' ') : 'Nichts zu tun — kein Schritt ist heute fällig, und das Tageskontingent für neue Ziele ist ausgeschöpft bzw. alle Ziele laufen schon.';
}

/** Willkommensstrecke (M1, 01.11.): Schalter, Texte und wer welche Stufe bekam — nur Name und Stufen, nie Adressen. Lesen: Haushalt des Inhabers. */
async function willkommenLage(req: Request, person: string): Promise<Response> {
  const [post, inhaber, namen] = await Promise.all([ladePost(), darfSteuern(person), namenVon().catch(() => ({} as Record<string, string>))]);
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const { anzeigename } = await import('@/lib/make-one/crm');
  const kontakte = new Map((await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).map(k => [k.id, k]));
  const e = post.einstellungen;
  const stufen = e.willkommenStufen ?? WILLKOMMEN_VORGABE;
  const empfaenger = Object.entries(post.willkommen).map(([id, w]) => ({ id, name: kontakte.get(id) ? anzeigename(kontakte.get(id)!) : 'Kontakt (nicht mehr in der Kartei)', start: w.start, gesendet: [...w.gesendet].sort((a, b) => a - b),
    // B-Prüfung (02.11., Fund 10/11): gescheiterte Stufen (mit Grund, ohne Adresse) und ob geantwortet wurde.
    ...(w.gescheitert?.length ? { gescheitert: w.gescheitert.map(g => ({ stufe: g.stufe, am: g.am, grund: g.grund })) } : {}), ...((w.mails ?? []).some(m => m.rueckfluss?.art === 'antwort') ? { geantwortet: true } : {}) }))
    .sort((a, b) => b.start.localeCompare(a.start));
  leseZugriff(req, 'kontakte', { anzahl: empfaenger.length });
  return NextResponse.json({
    ok: true, istInhaber: inhaber, willkommen: e.willkommen ? { seit: e.willkommen.seit, von: namen[e.willkommen.von] ?? e.willkommen.von } : null,
    stufen, vorgabe: WILLKOMMEN_VORGABE, empfaenger, lauf: post.willkommenLauf ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
