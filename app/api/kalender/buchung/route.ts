// ─── Kalender — Buchungsseiten verwalten (Haushalt, 29.09., Paket K4) ────────
// GET  → { ok, seiten (+ Pfad), buchungen (ohne Token-Hash), vorschlaege }
// POST { aktion: 'seite', seite: {…, id?} }            anlegen/ändern (neue bekommen eine nicht erratbare Adresse)
//      { aktion: 'seite-loeschen', id }                 nur ohne Buchungen (sonst erst deaktivieren — Löschfrist räumt)
//      { aktion: 'freigeben', id, einladen?, einladungBestaetigt?, adresseUnbestaetigt?, trotzKonflikt? }
//                                                       Kontakt + fester Termin + CRM (lib/kalender/buchung-ablauf.ts);
//                                                       `einladen` (K3): Gast als echte Einladung — nur mit Bestätigung,
//                                                       an eine unbestätigte Adresse nur mit `adresseUnbestaetigt` (#76).
//                                                       Platz inzwischen belegt → 409 { konflikt: true } (#73), dann nur
//                                                       mit `trotzKonflikt`. Läuft die Freigabe schon → 409 { laeuft };
//                                                       inzwischen abgesagt/abgelehnt/abgelaufen → 409 { verworfen } (F1).
//      { aktion: 'ablehnen', id, grund? }               Buchender sieht den Status (und den Grund) auf seiner Seite
//      { aktion: 'termin-geloest', id }                 (F1 #12) nach „Termin entfernen“ (DELETE /api/kalender/termin):
//                                                       Verweis auf den Termin an einer NICHT bestätigten Buchung lösen;
//                                                       „Termin vorbereiten“ an diesem Termin wird erledigt (Restpunkte).
//      { aktion: 'mail-link', id }                      (#76) einmaliger Bestätigungslink für die E-Mail-Adresse →
//                                                       { token, pfad, bis } — die Oberfläche baut daraus den Mail-ENTWURF
//                                                       (mailto); verschickt wird nur per Klick in der Mail-App. Ein neuer
//                                                       Link ersetzt den alten.
//      { aktion: 'buchung-auskunft', email }            (S1 #6) Art. 15 für Gäste OHNE CRM-Kontakt: Kopie ihrer Buchungen
//                                                       (ohne Token-/Link-Hashes) + welche Termine in Apple sie nennen.
//      { aktion: 'buchung-loeschen', email, bestaetigt?, notizBereinigen? }
//                                                       (S1 #6) Art. 17 für Gäste ohne CRM-Kontakt. Ohne `bestaetigt` nur
//                                                       die Rückfrage (was gelöscht wird, was in Apple bleibt). Mit
//                                                       `bestaetigt`: Buchungen weg; mit `notizBereinigen` zusätzlich Name
//                                                       und Gastzeilen aus Titel/Notiz der Termine (über den Schreibweg
//                                                       `terminAendernServer`) — was dabei nicht geht, meldet `inApple`.
//                                                       Gäste MIT Kontakt: 409 → Löschen über die Akte (Art. 17 überall).
// Nur der Haushalt des Inhabers (wie der Kalender), nie der Dienstweg für Einladungen/Links, Seiten, Freigaben und
// Gast-Auskunft/-Löschung (S1 #14: 403). Versendet wird nichts — außer der Einladung nach Klick (iCloud).
// S1 (29.09.): Protokoll mit `werAus(req)` (nur Kennungen), Körper höchstens 64 KB (413), Seiten mit Stand (`stand` =
// `geaendert` der gelesenen Fassung, sonst 409), `seite.person` muss im Haushalt des Inhabers sein (#13).

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { aufgabeErledigenNachFollowUp } from '@/lib/crm/followup-aufgabe-server';
import type { FollowUp } from '@/lib/crm/typen';
import { neueKennung } from '@/lib/kennung';
import { seiteSauber, mailLinkMoeglich, mailLinkPfad, vorbereitenErledigen, buchungenDesGasts, gastAdresse, notizOhneGast, titelOhneGast, GRENZEN, OFFEN, MAIL_LINK_TAGE, type Buchung, type BuchungsSeite } from '@/lib/kalender/buchung';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, neuerSlug, neuesToken, mailTokenHash } from '@/lib/kalender/buchung-speicher';
import { buchungFreigeben, folgeVorschlag, FreigabeFehler } from '@/lib/kalender/buchung-ablauf';
import { istDienst } from '@/lib/zugang/dienst';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { buchungKopie } from '@/lib/crm/person-auskunft-kalender';
import { terminLesen, verbunden } from '@/lib/kalender/icloud';
import { terminAendernServer } from '@/lib/kalender/termin-server';
import { localDay } from '@/lib/zeit';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z]{1,4}-[a-z0-9-]{8,80}$/;
const nein = (fehler: string, status = 400) => NextResponse.json({ ok: false, fehler }, { status });
/** Was die Oberfläche von einer Buchung sieht — nie ein Token-Hash (Status und Mail-Link), vom Link nur der Ablauf. */
const sicht = ({ tokenHash: _t, mailLink, ...b }: Buchung) => ({ ...b, ...(mailLink ? { mailLinkBis: mailLink.bis } : {}) });
/** Größter Körper (Byte) — darüber 413 statt still zu kürzen (S1 #15). */
const MAX_BYTES = 64_000;
/** Aktionen, die nie über den Dienstweg laufen (ZOE, Skripte) — nur von Hand (S1 #14). */
const NUR_VON_HAND = new Set(['seite', 'seite-loeschen', 'freigeben', 'mail-link', 'buchung-auskunft', 'buchung-loeschen']);

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const bestand = await ladeBuchungBestand();
  // Folge-Vorschläge (nur Vorschlag): für bestätigte Buchungen mit Kontakt.
  const mitKontakt = bestand.buchungen.filter(b => b.status === 'bestaetigt' && b.kontaktId);
  const vorschlaege: Record<string, ReturnType<typeof folgeVorschlag>> = {};
  if (mitKontakt.length) {
    // Art. 18: eingeschränkte Personen fehlen hier — für sie gibt es keinen Vorschlag.
    const [kartei, crm] = await Promise.all([kontakteFuerVerarbeitung(), ladeCrm()]);
    const kontakte = new Map(kartei.map(k => [k.id, k]));
    for (const b of mitKontakt) {
      const k = kontakte.get(b.kontaktId!);
      const firma = k?.firmaId ? crm.firmen.find(f => f.id === k.firmaId) : undefined;
      const v = folgeVorschlag(k, firma?.lead, crm.chancen);
      if (v) vorschlaege[b.id] = v;
    }
  }
  return NextResponse.json({
    ok: true,
    seiten: bestand.seiten.map(s => ({ ...s, pfad: `/buchen/${s.slug}` })),
    buchungen: [...bestand.buchungen].sort((a, b) => a.start.localeCompare(b.start)).map(sicht),
    vorschlaege,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alt = bauPruefen(req); if (alt) return alt;
  if (zuGross(req, MAX_BYTES)) return ZU_GROSS(MAX_BYTES);
  const person = zugang.person;
  const wer = werAus(req);
  let b: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return ZU_GROSS(MAX_BYTES);
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return nein('Kein JSON.');
    b = j as Record<string, unknown>;
  } catch { return nein('Kein JSON.'); }
  const jetzt = new Date();
  const jetztIso = jetzt.toISOString();
  if (NUR_VON_HAND.has(String(b.aktion)) && istDienst(req)) return nein('Nur von Hand — nie über ZOE oder Skripte.', 403);
  const stand = typeof b.stand === 'string' ? b.stand : null;

  if (b.aktion === 'seite') {
    const roh = (b.seite && typeof b.seite === 'object' ? b.seite : {}) as Record<string, unknown>;
    const id = typeof roh.id === 'string' && ID.test(roh.id) ? roh.id : null;
    // #13: die Seite bucht für eine Person — sie muss zum Haushalt des Inhabers gehören (sonst ginge ihre Belegung/Glocke ins Leere oder nach außen).
    const fuer = typeof roh.person === 'string' ? roh.person.trim() : '';
    if (!(await personImHaushaltDesInhabers(fuer))) return nein('Für wen ist die Seite? Nur für eine Person des Haushalts.', 400);
    let fehler = '', status = 400, gespeichert: BuchungsSeite | null = null;
    await aendereBuchungBestand(bs => {
      const vorher = id ? bs.seiten.find(s => s.id === id) : undefined;
      if (id && !vorher) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      // #15: nur auf der Fassung ändern, die gelesen wurde — sonst 409 (ein anderes Fenster, Kevin und Malin gleichzeitig).
      if (vorher && stand !== vorher.geaendert) { fehler = 'Die Seite wurde inzwischen geändert — bitte neu laden.'; status = 409; return bs; }
      if (!vorher && bs.seiten.length >= GRENZEN.seiten) { fehler = `Höchstens ${GRENZEN.seiten} Buchungsseiten.`; status = 413; return bs; }
      const titel = typeof roh.titel === 'string' ? roh.titel : '';
      const fest = vorher ? { id: vorher.id, slug: vorher.slug, angelegt: vorher.angelegt } : { id: neueKennung('bs'), slug: neuerSlug(titel), angelegt: jetztIso };
      const r = seiteSauber(roh, fest, person, jetztIso);
      if (!r.ok) { fehler = r.fehler; return bs; }
      gespeichert = r.seite;
      return { ...bs, seiten: vorher ? bs.seiten.map(s => (s.id === vorher.id ? r.seite : s)) : [...bs.seiten, r.seite] };
    }, jetzt);
    if (!gespeichert) return nein(fehler || 'Nicht gespeichert.', status);
    const s = gespeichert as BuchungsSeite;
    await buchungProtokoll([{ liste: 'seiten', op: id ? 'geaendert' : 'neu', id: s.id }], wer);
    return NextResponse.json({ ok: true, seite: { ...s, pfad: `/buchen/${s.slug}` } });
  }

  if (b.aktion === 'seite-loeschen') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    let fehler = '', status = 400;
    await aendereBuchungBestand(bs => {
      const vorher = bs.seiten.find(s => s.id === id);
      if (!vorher) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      if (stand !== vorher.geaendert) { fehler = 'Die Seite wurde inzwischen geändert — bitte neu laden.'; status = 409; return bs; }
      if (bs.buchungen.some(x => x.seiteId === id)) { fehler = 'An dieser Seite hängen noch Buchungen — erst deaktivieren; löschen geht, wenn die Löschfrist sie geräumt hat.'; status = 409; return bs; }
      return { ...bs, seiten: bs.seiten.filter(s => s.id !== id) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'seiten', op: 'geloescht', id }], wer);
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'freigeben') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    // K3: Gast als echte Einladung — nur nach der Rückfrage in der Oberfläche (`einladungBestaetigt`), nie über den Dienstweg.
    const einladen = b.einladen === true;
    if (einladen && b.einladungBestaetigt !== true) return nein('Einladung erst nach Bestätigung („Einladung senden?“).', 409);
    try {
      await buchungFreigeben(id, person, jetzt, { einladen, adresseUnbestaetigt: b.adresseUnbestaetigt === true, trotzKonflikt: b.trotzKonflikt === true });
    } catch (e) {
      if (e instanceof FreigabeFehler) return NextResponse.json({ ok: false, fehler: e.message, ...e.extra }, { status: e.status });
      const text = e instanceof Error ? e.message.slice(0, 200) : 'Fehler';
      return nein(`Freigabe nicht vollständig (${text}) — sie wird automatisch fortgesetzt.`, 502);
    }
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'ablehnen') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    const grund = typeof b.grund === 'string' ? b.grund.replace(/\s+/g, ' ').trim() : '';
    if (grund.length > 300) return nein('Grund höchstens 300 Zeichen.', 413);
    let fehler = '', status = 400;
    await aendereBuchungBestand(bs => {
      const x = bs.buchungen.find(y => y.id === id);
      if (!x) { fehler = 'Buchung nicht gefunden.'; status = 404; return bs; }
      if (!OFFEN.includes(x.status)) { fehler = 'Diese Buchung ist nicht mehr offen.'; status = 409; return bs; }
      return { ...bs, buchungen: bs.buchungen.map(y => (y.id === id ? { ...y, status: 'abgelehnt' as const, statusAm: jetztIso, entschiedenAm: jetztIso, entschiedenVon: person, ...(grund ? { grund } : {}) } : y)) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['status'] }], wer);
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'termin-geloest') {
    // F1 #12: Der Termin einer abgesagten/abgelehnten/abgelaufenen Buchung ist aus dem Kalender entfernt — der Verweis
    // fällt weg (sonst zeigt die Leiste weiter „Termin entfernen“ und die Verbindungsprüfung „Termin fehlt in Apple“).
    // Restpunkte 29.09.: dazu wird „Termin vorbereiten“ an diesem Termin erledigt (nicht gelöscht, Notiz „Termin entfernt“)
    // — sonst meldete die Verbindungsprüfung `followup-termin-tot`. Die Glocke „Termin entfernen?“ erledigt sich über
    // ihren Bezug `buchung-termin` (lib/meldungen/regeln.ts `buchungenErledigen`).
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    let fehler = '', status = 400;
    let geloest: { terminUid: string; vorbereitenId?: string } | null = null;
    await aendereBuchungBestand(bs => {
      const x = bs.buchungen.find(y => y.id === id);
      if (!x) { fehler = 'Buchung nicht gefunden.'; status = 404; return bs; }
      if (x.status === 'bestaetigt') { fehler = 'Eine bestätigte Buchung behält ihren Termin — erst absagen.'; status = 409; return bs; }
      if (!x.terminUid) return bs;
      geloest = { terminUid: x.terminUid, ...(x.vorbereitenId ? { vorbereitenId: x.vorbereitenId } : {}) };
      const { terminUid: _u, terminKalender: _k, ...rest } = x;
      return { ...bs, buchungen: bs.buchungen.map(y => (y.id === id ? rest : y)) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    const g = geloest as { terminUid: string; vorbereitenId?: string } | null;
    if (g) {
      await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['terminUid'] }], wer);
      // Der Verweis ist gelöst (die Antwort bleibt ok); ein Fehler hier bleibt im Log — die Verbindungsprüfung fände den Rest.
      try {
        let erledigt: FollowUp[] = [];
        await aendereCrm(c => { const r = vorbereitenErledigen(c.followups ?? [], g, person, jetztIso); erledigt = r.erledigt; return r.erledigt.length ? { ...c, followups: r.followups } : c; }, { art: 'person', person });
        for (const f of erledigt) if (f.aufgabeId) await aufgabeErledigenNachFollowUp(f, person);
      } catch (e) { console.error('[buchung] „Termin vorbereiten“ nicht erledigt:', e instanceof Error ? e.message.slice(0, 160) : e); }
    }
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'mail-link') {
    // Nur von Hand: ein Link führt zu einer Mail an Dritte (auch als Entwurf) — nie über ZOE oder Skripte (NUR_VON_HAND).
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    const token = neuesToken();
    const bis = new Date(jetzt.getTime() + MAIL_LINK_TAGE * 86_400_000).toISOString();
    let fehler = '', status = 400, slug = '';
    await aendereBuchungBestand(bs => {
      const x = bs.buchungen.find(y => y.id === id);
      if (!x) { fehler = 'Buchung nicht gefunden.'; status = 404; return bs; }
      const m = mailLinkMoeglich(x);
      if (!m.ok) { fehler = m.fehler; status = 409; return bs; }
      slug = bs.seiten.find(s => s.id === x.seiteId)?.slug ?? '';
      if (!slug) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      // Nur der Hash liegt im Bestand; ein neuer Link ersetzt den alten (der alte gilt ab jetzt nicht mehr).
      return { ...bs, buchungen: bs.buchungen.map(y => (y.id === id ? { ...y, mailLink: { hash: mailTokenHash(token), bis, am: jetztIso } } : y)) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['mailLink'] }], wer);
    return NextResponse.json({ ok: true, token, pfad: mailLinkPfad(slug, token), bis }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (b.aktion === 'buchung-auskunft' || b.aktion === 'buchung-loeschen') return gastRechte(b, wer, jetztIso);

  return nein('Unbekannte Aktion.');
}

// ── Art. 15 / 17 für Gäste ohne CRM-Kontakt (S1 #6) ────────────────────────────
// Die Person steht nur in der Buchung (Name, Adresse, Firma, Anliegen) und im Termin in Apple (Titel „… · Name“, Notiz
// „Gast: Name <Adresse>“). Das Protokoll nennt nur Kennungen der Buchungen — nie Name oder Adresse. Gäste MIT Kontakt
// laufen über die Akte (GET/POST /api/crm/datenschutz — Art. 15/17 über alle Speicher, auch diese Buchungen).

interface InApple { terminUid: string; kalender?: string; tag: string; grund: string }

async function gastRechte(b: Record<string, unknown>, wer: ReturnType<typeof werAus>, jetztIso: string): Promise<NextResponse> {
  const email = gastAdresse(b.email);
  if (!email) return nein('E-Mail-Adresse des Gasts fehlt oder ist ungültig.');
  const bestand = await ladeBuchungBestand();
  const eigene = buchungenDesGasts(bestand, email);
  if (!eigene.length) return nein('Zu dieser Adresse gibt es keine Buchung.', 404);
  const kontakte = new Set(((await loadJson<{ kontakte?: { id: string }[] }>('kontakte'))?.kontakte ?? []).map(k => k.id));
  if (eigene.some(x => x.kontaktId && kontakte.has(x.kontaktId))) {
    return NextResponse.json({ ok: false, fehler: 'Der Gast ist Geschäftskontakt — Auskunft und Löschung über seine Akte (Datenschutz), dort über alle Speicher.', mitKontakt: true }, { status: 409 });
  }
  const titel = (seiteId: string) => bestand.seiten.find(s => s.id === seiteId)?.titel ?? 'Termin';
  const mitTermin = eigene.filter(x => x.terminUid);

  if (b.aktion === 'buchung-auskunft') {
    await buchungProtokoll(eigene.map(x => ({ liste: 'auskunft', op: 'neu' as const, id: x.id, felder: ['art15'] })), wer);
    return new NextResponse(JSON.stringify({
      erstellt: jetztIso, art: 'Auskunft nach Art. 15 DSGVO — Gast einer Buchungsseite (ohne Geschäftskontakt)',
      buchungen: eigene.map(x => ({ ...buchungKopie(x), seite: titel(x.seiteId) })),
      // Der Termin in Apple trägt Name und Adresse in Titel/Notiz (bis zur Löschung dort bzw. „notizBereinigen“).
      termineInApple: mitTermin.map(x => ({ terminUid: x.terminUid, kalender: x.terminKalender ?? null, start: x.start, ende: x.ende })),
    }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="Auskunft-Art15-Buchung-${localDay()}.json"` } });
  }

  // Löschen: erst die Rückfrage — was weg ist, was in Apple bleibt.
  const bereinigen = b.notizBereinigen === true;
  if (b.bestaetigt !== true) {
    return NextResponse.json({
      ok: true, rueckfrage: true, buchungen: eigene.length,
      termine: mitTermin.map(x => ({ kalender: x.terminKalender ?? null, tag: x.start.slice(0, 10), status: x.status })),
      hinweis: mitTermin.length
        ? `${mitTermin.length} Termin${mitTermin.length === 1 ? '' : 'e'} in Apple nennen den Gast in Titel und Notiz. Mit „Notiz bereinigen“ entfernt MAKE OS Name und Gastzeilen dort; sonst bitte in Apple bearbeiten oder löschen.`
        : 'In Apple steht kein Termin dieses Gasts.',
    });
  }
  const inApple: InApple[] = [];
  for (const x of mitTermin) {
    const tag = x.start.slice(0, 10);
    if (!bereinigen) { inApple.push({ terminUid: x.terminUid!, kalender: x.terminKalender, tag, grund: 'nicht bereinigt (auf Wunsch)' }); continue; }
    if (!verbunden()) { inApple.push({ terminUid: x.terminUid!, kalender: x.terminKalender, tag, grund: 'iCloud nicht verbunden' }); continue; }
    try {
      const t = await terminLesen(x.terminUid!);
      if (!t) continue; // in Apple schon weg
      // Mit Einladung (ATTENDEE) steht die Adresse als Gast im Termin — ändern hieße Post an den Gast: nur in Apple.
      if (t.mitTeilnehmern) { inApple.push({ terminUid: x.terminUid!, kalender: x.terminKalender, tag, grund: 'Einladung mit Gast — bitte in Apple löschen' }); continue; }
      const notiz = notizOhneGast(t.notiz);
      await terminAendernServer(x.terminUid!, { titel: titelOhneGast(t.titel, x.name), notiz: notiz || null }, wer);
    } catch (e) {
      inApple.push({ terminUid: x.terminUid!, kalender: x.terminKalender, tag, grund: e instanceof Error ? e.message.slice(0, 160) : 'nicht geändert' });
    }
  }
  const ids = new Set(eigene.map(x => x.id));
  await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.filter(y => !ids.has(y.id)) }));
  await buchungProtokoll(eigene.map(x => ({ liste: 'buchungen', op: 'geloescht' as const, id: x.id, felder: ['art17-gast'] })), wer);
  const { loeschungFesthalten } = await import('@/lib/crm/loeschprotokoll');
  // Löschprotokoll ohne Klartext (nur Tag, Grund, wer); was in Apple offen bleibt, nur als Zahl im Grund.
  await loeschungFesthalten({ datum: jetztIso.slice(0, 10), grund: `Art. 17 DSGVO — Gast einer Buchungsseite (ohne Geschäftskontakt)${inApple.length ? ` · ${inApple.length} Termin(e) in Apple offen` : ''}`, von: wer.person ?? 'system', status: 'vollstaendig' });
  return NextResponse.json({ ok: true, geloescht: eigene.length, ...(inApple.length ? { inApple } : {}) });
}
