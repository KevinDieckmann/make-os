// ─── Inbox 2 — eigene Postfächer verbinden, einstellen, erneuern, trennen (06.10.2026) ─────────────────────────
// GET  → { ok, postfaecher, bereiche (wählbar), anbieter (Voreinstellungen + Anleitung), demo, absender (Screener), google }
// POST { aktion: 'hinzufuegen', anbieter, adresse, passwort, bereich, anzeigename?, absenderName?, signatur?, imap?, smtp? }
//        → prüft die Anmeldung beim Anbieter ZUERST; nur wenn sie klappt, werden Register + Passwort gespeichert (sonst 409, nichts gespeichert)
//      { aktion: 'einstellen', id, bereich?, anzeigename?, absenderName?, signatur? }   (auch Gmail: Bereich festlegen)
//      { aktion: 'erneuern', id, passwort }        „Verbindung erneuern“ (Apple macht App-Passwörter bei jedem Passwortwechsel ungültig)
//      { aktion: 'trennen', id }                   Spiegel + Zugang + Inbox-Zustand des Postfachs weg (beim Anbieter bleibt alles)
//      { aktion: 'absender', adresse, status }     Screener-Entscheidung ändern (`zugelassen` | `geblockt` | null)
// NUR die eigene Person aus der Sitzung (Dienstweg 403). Passwörter gehen nie zurück an den Browser und nie ins Protokoll.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { anbieterFuerFormular, VOREINSTELLUNGEN } from '@/lib/postfach/anbieter';
import { bereichNamen, RegisterFehler } from '@/lib/postfach/register';
import { demoErlaubt, postfachEinstellen, postfachErneuern, postfachHinzufuegen, postfachTrennen } from '@/lib/postfach/verwalten';
import { PostfachFehler } from '@/lib/postfach/transport';
import { POSTFACH_ID } from '@/lib/postfach/typen';
import { stromRoh } from '@/lib/inbox/strom-server';
import { absenderEntscheiden, absenderListe } from '@/lib/inbox/aktionen';
import { ZustandFehler } from '@/lib/inbox/zustand';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const [roh, namen, absender] = await Promise.all([stromRoh(z.person), bereichNamen(), absenderListe(z.person)]);
  const demo = demoErlaubt();
  return NextResponse.json({
    ok: true,
    postfaecher: roh.postfaecher.map(p => p.oeffentlich),
    bereiche: [{ id: 'privat', name: 'Privat' }, ...KERN_EINHEITEN.map(e => ({ id: e.id, name: e.label })), ...Object.entries(namen).filter(([id]) => id.startsWith('g-')).map(([id, name]) => ({ id, name }))],
    anbieter: anbieterFuerFormular(demo).map(a => { const v = VOREINSTELLUNGEN[a]; return { id: a, name: v.name, passwortWort: v.passwortWort, anleitung: v.anleitung, ...(v.link ? { link: v.link } : {}), ...(v.sendeHinweis ? { sendeHinweis: v.sendeHinweis } : {}), eigeneServer: a === 'eigen' }; }),
    demo, absender, google: roh.google,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 32 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  const id = typeof b.id === 'string' && POSTFACH_ID.test(b.id) ? b.id : null;
  try {
    switch (b.aktion) {
      case 'hinzufuegen': {
        const p = await postfachHinzufuegen(z.person, b);
        await protokolliere('postfaecher', [{ op: 'neu', id: p.id, felder: ['quelle', 'bereich'] }], wer).catch(() => { /* nur Protokoll */ });
        return NextResponse.json({ ok: true, id: p.id, text: 'Verbunden — die letzten 30 Tage werden jetzt gelesen.' });
      }
      case 'einstellen': {
        if (!id) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
        const felder = Object.fromEntries(['bereich', 'anzeigename', 'absenderName', 'signatur'].filter(k => k in b).map(k => [k, b[k]]));
        await postfachEinstellen(z.person, id, felder);
        await protokolliere('postfaecher', [{ op: 'geaendert', id, felder: Object.keys(felder) }], wer).catch(() => { /* nur Protokoll */ });
        return NextResponse.json({ ok: true, text: 'Gespeichert.' });
      }
      case 'erneuern': {
        if (!id) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
        await postfachErneuern(z.person, id, String(b.passwort ?? ''));
        await protokolliere('postfaecher', [{ op: 'geaendert', id, felder: ['zugang'] }], wer).catch(() => { /* nur Protokoll */ });
        return NextResponse.json({ ok: true, text: 'Verbindung erneuert.' });
      }
      case 'trennen': {
        if (!id) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
        const r = await postfachTrennen(z.person, id);
        if (r.war) await protokolliere('postfaecher', [{ op: 'geloescht', id, felder: ['getrennt'] }], wer).catch(() => { /* nur Protokoll */ });
        return NextResponse.json({ ok: true, ...r, text: 'Getrennt — die Kopie in MAKE OS ist gelöscht, beim Anbieter bleibt alles.' });
      }
      case 'absender': {
        const s = b.status === 'zugelassen' || b.status === 'geblockt' ? b.status : null;
        await absenderEntscheiden(z.person, String(b.adresse ?? ''), s);
        return NextResponse.json({ ok: true });
      }
      default: return NextResponse.json({ ok: false, fehler: 'aktion = hinzufuegen | einstellen | erneuern | trennen | absender' }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof RegisterFehler || e instanceof ZustandFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
    if (e instanceof PostfachFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.code === 'ziel' ? 400 : 409 });
    return NextResponse.json({ ok: false, fehler: 'Das ging gerade nicht — bitte noch einmal versuchen.' }, { status: 502 });
  }
}
