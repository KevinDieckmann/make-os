// ─── Kalender — Termin anlegen, ändern, löschen (iCloud) ────────────────────
// POST   { titel, kalender? | wer?, start, ende, ganztags?, ort?, notiz?,
//          art?, farbe?, beschaeftigt?, sichtbarkeit?, zone?, wiederholung?, erinnerungenMin?, arbeitsort?, blockArt?, bezug?,
//          gaeste?: [{ email, name?, kontaktId? }], einladungBestaetigt? }
//                                         → { uid, kalender, gaeste?, crm?, werbesperre? }
// PATCH  { uid, stand?, titel?, start?, ende?, ort?, notiz?, art?, farbe?, beschaeftigt?, sichtbarkeit?, bezug?,
//          gaeste?, antwort?: 'zugesagt'|'abgesagt'|'vielleicht', einladungBestaetigt? }
//          Termin-Felder nur für Einzeltermine; `bezug` (nur Kennungen) geht auch bei Serien —
//          (K5: Art „block“ + blockArt = ein Block aus dem Modus „Planen“)
//          er liegt nie im Termin, nur im Bestand `kalender-bezug` (lib/kalender/bezug.ts).
//          `stand` = ETag, den der Browser zuletzt sah → veraltet: 409 { konflikt, aktuell } („Deine Fassung“ bleibt im Browser).
// DELETE ?uid=…&stand=…&einladungBestaetigt=1   (dito — die Oberfläche fragt vorher)
// Seit R-K1 (29.09.): `uid` bei PATCH/DELETE ist der Schlüssel `kalender|uid` (`objektSchluessel(termin)`) — alte reine
// UIDs gehen weiter, solange sie in genau einem Kalender stehen (sonst 409). Bezug und Protokoll laufen über den
// Schlüssel; POST liefert ihn mit (`schluessel`). Fremd-private Termine (privat, gehören der anderen Person) lehnen
// PATCH/DELETE mit 403 ab (#96). POST nimmt `endZone` (Zone des Endes, #13).
// Zeiten als Wandzeit „YYYY-MM-DDTHH:mm(:ss)“ — beim Anlegen in `zone` (Standard Europe/Berlin), sonst Berlin;
// ganztags: Tag, Ende exklusiv. Eingaben prüft lib/kalender/eingabe.ts.
// Seit 29.09. (K1): Build-Kennung (409 `neuLaden`), jede Schreibaktion im Änderungsprotokoll (wer, UID, Aktion,
// Feldnamen — nie Titel), Bezug + Sicherung (Art, privat, wer angelegt hat) im Neben-Bestand.
// Seit 30.09. (K3, Kevin: „Echte Einladung nach Klick“):
//   · Gäste → ATTENDEE (ORGANIZER = das iCloud-Konto, SCHEDULE-AGENT=SERVER) — iCloud verschickt. Jede Schreibaktion,
//     die Post an Gäste auslöst (Einladung, Änderung, Absage, eigene Antwort als Gast), braucht `einladungBestaetigt:
//     true`, sonst 409 { einladung, anzahl, adressen } und NICHTS wird geschrieben. Art. 18: eingeschränkte Personen
//     nie (auch nicht per frei eingegebener Adresse); Werbesperre erlaubt (1:1), die Antwort nennt die Zahl.
//   · Protokoll der Einladungen: Liste „einladungen“/„antworten“, UID + Anzahl der Gäste — NIE Adressen.
//   · Nur von Hand (KALENDER_FEHLER_PRUEFLISTE #K2/#59): Der Dienstweg (ZOE, Takt, Skripte) darf weder Gäste schreiben
//     noch bestätigen noch antworten → 403. Ohne Bestätigung lehnt schon lib/kalender/icloud.ts jede Schreibaktion an
//     einem Termin mit Gästen ab (Teilnehmer-Sperre für alle anderen Schreibwege).
//   · CRM: Kontakt + Gäste aus dem CRM am Termin → je Kontakt EINE Aktivität „Meeting“ mit `terminUid` (Zeit liest die
//     Akte aus dem Termin, lib/crm/termin-aktivitaet.ts). Kontakt gelöst oder Termin gelöscht, solange er in der Zukunft
//     lag → die Meeting-Aktivität fällt weg (mit Löschmarke). Serien: die Vorkommen legt der Signal-Lauf an.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, anlegen, aendern, loeschen, antwortSenden, terminAufloesen, terminLesen, KalenderFehler, KalenderKonflikt, EinladungNoetig } from '@/lib/kalender/icloud';
import { ladeEinstellungen, wemGehoert, type Wer } from '@/lib/kalender/einstellungen';
import { anlegenPruefen, aendernPruefen, text } from '@/lib/kalender/eingabe';
import { bezugSetzen, ladeBezuege, BezugZuGross } from '@/lib/kalender/bezug-server';
import { mitBezug, maskieren, kontakteVon, fremdPrivat, bezugVon, objektSchluessel, type TerminBezug } from '@/lib/kalender/bezug';
import type { Termin } from '@/lib/kalender/ics';
import { gaestePruefenCrm } from '@/lib/kalender/gaeste-server';
import { wandzeit } from '@/lib/kalender/zeit';
import { ausWandzeitIn, STANDARD_ZONE } from '@/lib/kalender/zeitzone';
import { bauPruefen } from '@/lib/bau/pruefen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { terminAktivitaetenSetzen, terminAktivitaetenLoeschen } from '@/lib/crm/termin-aktivitaet-server';
import { terminVorbei } from '@/lib/crm/termin-aktivitaet';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function antwortFehler(e: unknown, person: string) {
  if (e instanceof EinladungNoetig) {
    // Rückfrage in der Oberfläche: „Einladung an n Personen über iCloud senden?“ — die Adressen nur hier, nie im Protokoll.
    return NextResponse.json({ ok: false, einladung: e.was, anzahl: e.adressen.length, adressen: e.adressen, fehler: e.message }, { status: 409 });
  }
  if (e instanceof KalenderKonflikt) {
    // Der aktuelle Termin (mit Bezug, für die Person maskiert) — der Browser behält die eigene Fassung daneben.
    const [einst, bezuege] = await Promise.all([ladeEinstellungen(), ladeBezuege().catch(() => null)]);
    const aktuell = e.aktuell ? maskieren({ ...mitBezug(e.aktuell, bezuege), wer: wemGehoert(einst, e.aktuell.kalender) }, person) : null;
    return NextResponse.json({ ok: false, konflikt: true, fehler: e.message, aktuell }, { status: 409 });
  }
  if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  if (e instanceof BezugZuGross) return NextResponse.json({ ok: false, fehler: e.message }, { status: 413 });
  return NextResponse.json({ ok: false, fehler: 'iCloud nicht erreichbar.' }, { status: 502 });
}

async function vorab(req: Request): Promise<{ person: string } | NextResponse> {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  if (!verbunden()) return NextResponse.json({ ok: false, fehler: 'iCloud ist noch nicht verbunden (deploy/icloud-verbinden.sh).' }, { status: 409 });
  return { person: z.person };
}

/**
 * Rechte (R-K1 #96): ein privater Termin der ANDEREN Person (in geteilten Sichten nur „Belegt“) lässt sich über die API
 * weder ändern noch löschen — auch nicht mit bekannter UID. Der Bezug (Kennungen) zählt mit (`von` = Eigentümer).
 */
async function fremdPrivatFuer(t: Termin | null, person: string): Promise<boolean> {
  if (!t) return false;
  const [einst, bezuege] = await Promise.all([ladeEinstellungen(), ladeBezuege().catch(() => null)]);
  return fremdPrivat({ ...mitBezug(t, bezuege), wer: wemGehoert(einst, t.kalender) }, person);
}
const nichtDeiner = () => NextResponse.json({ ok: false, fehler: 'Privater Termin der anderen Person — nur sie kann ihn ändern oder löschen.' }, { status: 403 });

/** Einladungen, Post an Gäste und Antworten nur von Hand — nie über den Dienstweg (ZOE, Takt, Skripte). */
const nurVonHand = () => NextResponse.json({ ok: false, fehler: 'Einladungen, Änderungen an Gäste und Antworten nur von Hand — nie über ZOE oder Skripte.' }, { status: 403 });

async function json(req: Request): Promise<Record<string, unknown> | null> {
  try { const b = await req.json(); return b && typeof b === 'object' ? b as Record<string, unknown> : null; } catch { return null; }
}

/** Einladungen protokollieren: wer, UID, Anzahl der Gäste — nie Adressen (K3). */
const einladungProtokoll = (req: Request, uid: string, op: 'neu' | 'geaendert' | 'geloescht', anzahl: number) =>
  anzahl ? protokolliere('kalender', [{ liste: 'einladungen', op, id: uid, felder: [`gaeste:${anzahl}`] }], werAus(req)) : Promise.resolve();

export async function POST(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const b = await json(req);
  if (!b) return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 });
  const p = anlegenPruefen(b);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler }, { status: 400 });
  const e = p.e;
  if ((e.gaeste.length || e.einladungBestaetigt) && istDienst(req)) return nurVonHand();
  // Gäste gegen die Kartei (Art. 18 → 409, Werbesperre zählen, Adresse → Kontakt-Kennung).
  const g = await gaestePruefenCrm(e.gaeste);
  if (!g.ok) return NextResponse.json({ ok: false, fehler: g.fehler, eingeschraenkt: true }, { status: 409 });
  const einst = await ladeEinstellungen();
  // Ohne Angabe: der Kalender der anlegenden Person (Kevin/Malin), sonst Kevins.
  const wer: Wer = e.wer ?? (z.person === 'malin' ? 'malin' : 'kevin');
  const kalender = e.kalender || einst.kalender[wer];
  try {
    const r = await anlegen({
      titel: e.titel, kalender, start: e.start, ende: e.ende, ganztags: e.ganztags,
      ...(e.ort ? { ort: e.ort } : {}), ...(e.notiz ? { notiz: e.notiz } : {}), ...(e.wiederholung ? { wiederholung: e.wiederholung } : {}),
      erinnerungenMin: e.erinnerungenMin, art: e.art, ...(e.farbe ? { farbe: e.farbe } : {}), beschaeftigt: e.beschaeftigt,
      sichtbarkeit: e.sichtbarkeit, zone: e.zone, ...(e.endZone ? { endZone: e.endZone } : {}), ...(e.arbeitsort ? { arbeitsort: e.arbeitsort } : {}), ...(e.blockArt ? { blockArt: e.blockArt } : {}),
      ...(g.gaeste.length ? { gaeste: g.gaeste.map(x => ({ email: x.email, ...(x.name ? { name: x.name } : {}) })) } : {}),
    }, { einladungBestaetigt: e.einladungBestaetigt });
    // Starttag in Berlin (für die Verbindungsprüfung) — bei einer anderen Zone umgerechnet, nie über new Date(wandzeit).
    const startBerlin = e.ganztags || e.zone === STANDARD_ZONE ? e.start : wandzeit(ausWandzeitIn(e.start, e.zone));
    const tag = startBerlin.slice(0, 10);
    const gastKontakte = g.gaeste.map(x => x.kontaktId).filter((x): x is string => !!x);
    let hinweis: string | undefined;
    let bezug: TerminBezug | null = null;
    try {
      bezug = await bezugSetzen(r.schluessel, { ...e.bezug, ...(gastKontakte.length ? { gastKontakte } : {}), von: z.person, tag, ...(e.art !== 'termin' ? { art: e.art } : {}), ...(e.sichtbarkeit === 'privat' ? { privat: true } : {}), ...(e.farbe ? { farbe: e.farbe } : {}) });
    } catch { hinweis = 'Termin angelegt — der Bezug zu MAKE OS ließ sich gerade nicht speichern (Art und Sichtbarkeit stehen im Termin).'; }
    await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.schluessel, felder: ['art', ...(Object.keys(e.bezug)), ...(gastKontakte.length ? ['gastKontakte'] : [])] }], werAus(req));
    await einladungProtokoll(req, r.schluessel, 'neu', r.gaeste);
    // CRM: der Termin wird zur Aktivität „Meeting“ (nur echte Termine; Serien → Signal-Lauf je Vorkommen).
    let crm: { neu: number; eingeschraenkt: number } | undefined;
    const kontakte = kontakteVon(bezug);
    if (e.art === 'termin' && !e.wiederholung && kontakte.length) {
      crm = await terminAktivitaetenSetzen({ id: r.schluessel, uid: r.uid, titel: e.titel, start: startBerlin, ...(e.sichtbarkeit === 'privat' ? { privat: true } : {}), kontaktIds: kontakte, ...(bezug?.dealId ? { dealId: bezug.dealId } : {}), von: z.person }, werAus(req))
        .catch(() => { hinweis = 'Termin angelegt — die Aktivität im CRM entsteht beim nächsten Abgleich.'; return undefined; });
    }
    return NextResponse.json({ ok: true, uid: r.uid, schluessel: r.schluessel, kalender: r.kalender, ...(r.gaeste ? { gaeste: r.gaeste } : {}), ...(g.werbesperre ? { werbesperre: g.werbesperre } : {}), ...(crm ? { crm } : {}), ...(hinweis ? { hinweis } : {}) });
  } catch (err) { return antwortFehler(err, z.person); }
}

export async function PATCH(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const b = await json(req);
  if (!b) return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 });
  const p = aendernPruefen(b);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler }, { status: 400 });
  const { uid, stand, termin, bezug, gaeste, antwort, einladungBestaetigt } = p.e;
  if ((gaeste || antwort || einladungBestaetigt) && istDienst(req)) return nurVonHand();
  try {
    // Rechte zuerst (R-K1 #96): fremd-private Termine gibt es für diese Person nur als „Belegt“.
    const bisher = await terminLesen(uid).catch(() => null);
    if (await fremdPrivatFuer(bisher, z.person)) return nichtDeiner();
    // Als Gast antworten (K3): nur PARTSTAT, nach Bestätigung — sonst nichts an diesem Aufruf.
    if (antwort) {
      await antwortSenden(uid, antwort, { ...(stand ? { stand } : {}), einladungBestaetigt });
      await protokolliere('kalender', [{ liste: 'antworten', op: 'geaendert', id: bisher ? objektSchluessel(bisher) : uid, felder: [antwort] }], werAus(req));
      return NextResponse.json({ ok: true });
    }
    const g = gaeste ? await gaestePruefenCrm(gaeste) : null;
    if (g && !g.ok) return NextResponse.json({ ok: false, fehler: g.fehler, eingeschraenkt: true }, { status: 409 });
    const felder = Object.keys(termin);
    if (!felder.length && !bezug && !g) return NextResponse.json({ ok: true });
    // Schlüssel (Kalender + UID) des Objekts — alte reine UIDs werden hier aufgelöst (R-K1 #46).
    let ziel = await terminAufloesen(uid);
    if (!ziel) return NextResponse.json({ ok: false, fehler: 'Termin nicht gefunden — vielleicht gerade in Apple gelöscht.' }, { status: 404 });
    const bestand = await ladeBezuege().catch(() => null);
    const alt = bezugVon(bestand, { id: ziel.schluessel });
    if (felder.length || g) {
      const r = await aendern(uid, { ...termin, ...(g ? { gaeste: g.gaeste.map(x => ({ email: x.email, ...(x.name ? { name: x.name } : {}) })) } : {}) }, { ...(stand ? { stand } : {}), einladungBestaetigt });
      ziel = { schluessel: r.schluessel, uid: r.uid, eindeutig: r.eindeutig };
      await einladungProtokoll(req, ziel.schluessel, 'geaendert', r.gaeste);
    }
    const schluessel = ziel.schluessel;
    // Sicherung (Art, privat) und Bezüge nachziehen — Kennungen nie in den Termin.
    const teil: Record<string, unknown> = {
      ...(bezug ?? {}),
      ...(g ? { gastKontakte: g.gaeste.map(x => x.kontaktId).filter(Boolean) } : {}),
      ...(termin.art !== undefined ? { art: termin.art === 'termin' ? null : termin.art } : {}),
      ...(termin.sichtbarkeit !== undefined ? { privat: termin.sichtbarkeit === 'privat' ? true : null } : {}),
      // Farbe gespiegelt (R-K1 #47): Apple verliert COLOR beim Bearbeiten — die Sicherung füllt sie beim Lesen nach.
      ...(termin.farbe !== undefined ? { farbe: termin.farbe ?? null } : {}),
      ...(termin.start ? { tag: termin.start.slice(0, 10) } : {}),
    };
    const neu = Object.keys(teil).length ? await bezugSetzen(schluessel, teil, undefined, { altSchluessel: ziel.uid, altBehalten: !ziel.eindeutig }) : alt ?? null;
    await protokolliere('kalender', [{ liste: 'termine', op: 'geaendert', id: schluessel, felder: [...felder, ...Object.keys(bezug ?? {}), ...(g ? ['gaeste'] : [])] }], werAus(req));
    // CRM-Folgen einer Bezug-Änderung: neue Kontakte → Meeting-Aktivität, gelöste (Termin noch in der Zukunft) → weg.
    const vorher = new Set(kontakteVon(alt)), nachher = kontakteVon(neu);
    const dazu = nachher.filter(k => !vorher.has(k)), weg = [...vorher].filter(k => !nachher.includes(k));
    let hinweis: string | undefined;
    if (dazu.length || weg.length) {
      const t = await terminLesen(schluessel).catch(() => null);
      if (t && !t.serie && t.art !== 'abwesend' && t.art !== 'fokus' && t.art !== 'arbeitsort') {
        if (dazu.length) await terminAktivitaetenSetzen({ id: t.id, uid: t.uid, titel: t.titel, start: t.start, ...(t.sichtbarkeit === 'privat' || neu?.privat ? { privat: true } : {}), kontaktIds: dazu, ...(neu?.dealId ? { dealId: neu.dealId } : {}), von: z.person }, werAus(req)).catch(() => { hinweis = 'Die Aktivität im CRM entsteht beim nächsten Abgleich.'; });
        if (weg.length && !terminVorbei(t.start, new Date().toISOString())) await terminAktivitaetenLoeschen(schluessel, werAus(req), weg).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, ...(g?.ok && g.werbesperre ? { werbesperre: g.werbesperre } : {}), ...(hinweis ? { hinweis } : {}) });
  } catch (err) { return antwortFehler(err, z.person); }
}

export async function DELETE(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const uid = text(q.get('uid'), 300);
  if (!uid) return NextResponse.json({ ok: false, fehler: 'uid fehlt.' }, { status: 400 });
  const stand = text(q.get('stand'), 200);
  const einladungBestaetigt = q.get('einladungBestaetigt') === '1';
  if (einladungBestaetigt && istDienst(req)) return nurVonHand();
  try {
    const vorher = await terminLesen(uid).catch(() => null);
    if (await fremdPrivatFuer(vorher, z.person)) return nichtDeiner();
    const r = await loeschen(uid, { ...(stand ? { stand } : {}), einladungBestaetigt });
    const schluessel = r.schluessel ?? uid;
    // Bezug weg — unter dem Schlüssel und (UID nur in diesem Kalender) auch der alte Eintrag ohne Kalender.
    await bezugSetzen(schluessel, null, undefined, r.uid ? { altSchluessel: r.uid, altBehalten: !r.eindeutig } : {}).catch(() => { /* die Verbindungsprüfung meldet den Rest (termin-uid-tot) */ });
    await protokolliere('kalender', [{ liste: 'termine', op: 'geloescht', id: schluessel }], werAus(req));
    await einladungProtokoll(req, schluessel, 'geloescht', r.gaeste);
    // Ein Termin in der Zukunft fand nicht statt → seine Meeting-Aktivitäten fallen weg (vergangene bleiben: es gab ihn).
    if (vorher && !terminVorbei(vorher.start, new Date().toISOString())) await terminAktivitaetenLoeschen(schluessel, werAus(req)).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) { return antwortFehler(err, z.person); }
}
