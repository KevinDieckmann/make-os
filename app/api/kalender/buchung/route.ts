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
// Nur der Haushalt des Inhabers (wie der Kalender), nie der Dienstweg für Einladungen/Links. Versendet wird nichts —
// außer der Einladung nach Klick (iCloud).

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { aufgabeErledigenNachFollowUp } from '@/lib/crm/followup-aufgabe-server';
import type { FollowUp } from '@/lib/crm/typen';
import { neueKennung } from '@/lib/kennung';
import { seiteSauber, mailLinkMoeglich, mailLinkPfad, vorbereitenErledigen, GRENZEN, OFFEN, MAIL_LINK_TAGE, type Buchung, type BuchungsSeite } from '@/lib/kalender/buchung';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, neuerSlug, neuesToken, mailTokenHash } from '@/lib/kalender/buchung-speicher';
import { buchungFreigeben, folgeVorschlag, FreigabeFehler } from '@/lib/kalender/buchung-ablauf';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z]{1,4}-[a-z0-9-]{8,80}$/;
const nein = (fehler: string, status = 400) => NextResponse.json({ ok: false, fehler }, { status });
/** Was die Oberfläche von einer Buchung sieht — nie ein Token-Hash (Status und Mail-Link), vom Link nur der Ablauf. */
const sicht = ({ tokenHash: _t, mailLink, ...b }: Buchung) => ({ ...b, ...(mailLink ? { mailLinkBis: mailLink.bis } : {}) });

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
  const person = zugang.person;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return nein('Kein JSON.'); }
  const jetzt = new Date();
  const jetztIso = jetzt.toISOString();

  if (b.aktion === 'seite') {
    const roh = (b.seite && typeof b.seite === 'object' ? b.seite : {}) as Record<string, unknown>;
    const id = typeof roh.id === 'string' && ID.test(roh.id) ? roh.id : null;
    let fehler = '', status = 400, gespeichert: BuchungsSeite | null = null;
    await aendereBuchungBestand(bs => {
      const vorher = id ? bs.seiten.find(s => s.id === id) : undefined;
      if (id && !vorher) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
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
    await buchungProtokoll([{ liste: 'seiten', op: id ? 'geaendert' : 'neu', id: s.id }], { art: 'person', person });
    return NextResponse.json({ ok: true, seite: { ...s, pfad: `/buchen/${s.slug}` } });
  }

  if (b.aktion === 'seite-loeschen') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    let fehler = '', status = 400;
    await aendereBuchungBestand(bs => {
      if (!bs.seiten.some(s => s.id === id)) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
      if (bs.buchungen.some(x => x.seiteId === id)) { fehler = 'An dieser Seite hängen noch Buchungen — erst deaktivieren; löschen geht, wenn die Löschfrist sie geräumt hat.'; status = 409; return bs; }
      return { ...bs, seiten: bs.seiten.filter(s => s.id !== id) };
    }, jetzt);
    if (fehler) return nein(fehler, status);
    await buchungProtokoll([{ liste: 'seiten', op: 'geloescht', id }], { art: 'person', person });
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'freigeben') {
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
    // K3: Gast als echte Einladung — nur nach der Rückfrage in der Oberfläche (`einladungBestaetigt`), nie über den Dienstweg.
    const einladen = b.einladen === true;
    if (einladen && b.einladungBestaetigt !== true) return nein('Einladung erst nach Bestätigung („Einladung senden?“).', 409);
    if (einladen && istDienst(req)) return nein('Einladungen nur von Hand — nie über ZOE oder Skripte.', 403);
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
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['status'] }], { art: 'person', person });
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
      await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['terminUid'] }], { art: 'person', person });
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
    // Nur von Hand: ein Link führt zu einer Mail an Dritte (auch als Entwurf) — nie über ZOE oder Skripte.
    if (istDienst(req)) return nein('Bestätigungslinks nur von Hand — nie über ZOE oder Skripte.', 403);
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
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['mailLink'] }], { art: 'person', person });
    return NextResponse.json({ ok: true, token, pfad: mailLinkPfad(slug, token), bis }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return nein('Unbekannte Aktion.');
}
