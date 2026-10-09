// ─── Übernahme aus dem Altsystem (früheres Finanz-Cockpit): Probelauf und Übernahme ──────────────────────
// Seit dem Rundgang 09.10. nur, wenn für die Instanz ein Altsystem eingerichtet ist (`altsystemFuer`, lib/finanzen/haushalt/altsystem.ts) —
// eine neue Instanz bekommt 404 statt eines Probelaufs (die Seite zeigt die Übernahme dann gar nicht).
// POST { schritt: 'probe', email, passwort }
//   liest ALLES aus Supabase (blätternd, exakt gezählt), legt die Rohdaten
//   als Archiv ab (.data/archiv, 0600, mit Datenschlüssel verschlüsselt) und schreibt
//   in einen PROBE-Haushalt — der echte bleibt unberührt. Antwort: Bericht.
// POST { schritt: 'uebernehmen' }
//   übernimmt genau das Geprüfte in den echten Haushalt. In MAKE OS schon
//   Bearbeitetes wird nicht überschrieben, nur in MAKE OS Angelegtes bleibt.
// GET → Stand: gibt es einen Probelauf, was sagt sein Bericht.
//
// Das Passwort geht nur an Supabase. Es wird weder gespeichert noch geloggt.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt, setzeHaushalt, aendereMeta } from '@/lib/finanzen/haushalt/speicher';
import { verbindungAusUmgebung, ausSupabaseLesen, zusammenfuehren, type Umzugsbericht } from '@/lib/finanzen/haushalt/supabase-umzug';
import { umwandeln } from '@/lib/finanzen/haushalt/supabase-umzug';
import { ausDateien, v1Nacharbeiten, type Sicherung, type V1Export, type DateiBericht } from '@/lib/finanzen/haushalt/datei-umzug';
import { belegAufgabenAbgleichen } from '@/lib/finanzen/haushalt/aufgaben';
import { altsystemFuer, umzugStandName } from '@/lib/finanzen/haushalt/altsystem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { bericht: Umzugsbericht; datei?: DateiBericht & { regelTreffer: number; sonstiges: number; offenEin: number }; quelle?: 'supabase' | 'dateien'; zeit: string; wer: string; archiv: string; uebernommen?: { zeit: string; wer: string; ergebnis: Record<string, Record<string, number>> } }
const KEIN_ALTSYSTEM = { ok: false, fehler: 'Für diese Instanz ist kein Altsystem eingerichtet.' };
const probe = (h: string) => `${h}-probe`;

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const s = await loadJson<Stand>(umzugStandName(z.haushalt));
  return NextResponse.json({ ok: true, verbunden: !!verbindungAusUmgebung(), altsystem: await altsystemFuer(z.haushalt, (await ladeHaushalt(z.haushalt)).meta), stand: s });
}

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: { schritt?: unknown; email?: unknown; passwort?: unknown; sicherung?: Sicherung; v1?: V1Export | null };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if ((b.schritt === 'probe' || b.schritt === 'dateien') && !(await altsystemFuer(z.haushalt, (await ladeHaushalt(z.haushalt)).meta))) return NextResponse.json(KEIN_ALTSYSTEM, { status: 404 });

  if (b.schritt === 'probe') {
    const v = verbindungAusUmgebung();
    if (!v) return NextResponse.json({ ok: false, fehler: 'Die Adresse des Altsystems fehlt in der Umgebung (MAKE_ORGA_URL, MAKE_ORGA_KEY).' }, { status: 400 });
    const email = String(b.email ?? '').trim(), passwort = String(b.passwort ?? '');
    if (!email || !passwort) return NextResponse.json({ ok: false, fehler: 'E-Mail und Passwort für das Altsystem fehlen.' }, { status: 400 });
    try {
      const { roh, haushalt, bericht } = await ausSupabaseLesen(v, email, passwort);
      const zeit = new Date().toISOString();
      // Archiv verschlüsselt wie die Bestände (28.09., F2 — lib/store/archiv.ts).
      const archiv = await archivSchreiben(`make-orga-supabase-${archivZeit(zeit)}.json`, { _quelle: 'Supabase MAKE.ORGA', _gelesen: zeit, _von: z.person, ...roh }, 1);
      await setzeHaushalt(probe(z.haushalt), haushalt);
      await saveJson<Stand>(umzugStandName(z.haushalt), { bericht, zeit, wer: z.person, archiv });
      return NextResponse.json({ ok: true, bericht });
    } catch (err) {
      return NextResponse.json({ ok: false, fehler: err instanceof Error ? err.message : 'Lesen aus Supabase fehlgeschlagen.' }, { status: 400 });
    }
  }

  // Aus Dateien (24.09.: „nicht mit dem alten Board verbinden — die Daten aus
  // der Datei holen“): Sicherung des Altsystems + V1-Export, zusammengesetzt an der Naht.
  // Danach derselbe Weg: Probe-Haushalt, Bericht, Übernahme.
  if (b.schritt === 'dateien') {
    if (!b.sicherung || !Array.isArray(b.sicherung.buchungen)) return NextResponse.json({ ok: false, fehler: 'Die Sicherung des Altsystems (MAKE-ORGA-Sicherung-….json) fehlt.' }, { status: 400 });
    try {
      const { roh, bericht: datei } = ausDateien(b.sicherung, b.v1 ?? null);
      const zeit = new Date().toISOString();
      const { haushalt: roherHaushalt, bericht } = umwandeln(roh, zeit);
      const n = v1Nacharbeiten(roherHaushalt);
      bericht.hinweise.unshift(...datei.hinweise);
      // Archiv verschlüsselt wie die Bestände (28.09., F2 — lib/store/archiv.ts).
      const archiv = await archivSchreiben(`make-orga-dateien-${archivZeit(zeit)}.json`, { _quelle: 'Dateien (Sicherung + V1)', _gelesen: zeit, _von: z.person, sicherung: b.sicherung, v1: b.v1 ?? null }, 1);
      await setzeHaushalt(probe(z.haushalt), n.haushalt);
      const detail = { ...datei, regelTreffer: n.regelTreffer, sonstiges: n.sonstiges, offenEin: n.offenEin };
      await saveJson<Stand>(umzugStandName(z.haushalt), { bericht, datei: detail, quelle: 'dateien', zeit, wer: z.person, archiv });
      return NextResponse.json({ ok: true, bericht, datei: detail });
    } catch (err) {
      return NextResponse.json({ ok: false, fehler: err instanceof Error ? err.message : 'Dateien nicht lesbar.' }, { status: 400 });
    }
  }

  if (b.schritt === 'uebernehmen') {
    const s = await loadJson<Stand>(umzugStandName(z.haushalt));
    if (!s) return NextResponse.json({ ok: false, fehler: 'Erst einen Probelauf machen.' }, { status: 400 });
    const p = await ladeHaushalt(probe(z.haushalt));
    const e = await ladeHaushalt(z.haushalt);
    const ergebnis: Record<string, Record<string, number>> = {};
    const zf = <T extends { id: string; stand: number }>(name: string, echt: T[], neu: T[]) => { const r = zusammenfuehren(echt, neu); ergebnis[name] = { neu: r.neu, ersetzt: r.ersetzt, behalten: r.behalten, nurMakeOs: r.nurMakeOs }; return r.liste; };
    await setzeHaushalt(z.haushalt, {
      stamm: { konten: zf('konten', e.stamm.konten, p.stamm.konten), kategorien: zf('kategorien', e.stamm.kategorien, p.stamm.kategorien), regeln: zf('regeln', e.stamm.regeln, p.stamm.regeln), aliase: e.stamm.aliase },
      buchungen: zf('buchungen', e.buchungen, p.buchungen), schulden: zf('schulden', e.schulden, p.schulden),
      belege: zf('belege', e.belege, p.belege), planwerte: zf('planwerte', e.planwerte, p.planwerte),
    });
    const zeit = new Date().toISOString();
    await aendereMeta(z.haushalt, m => ({ ...m, umzug: { zeit, wer: z.person, ziel: z.haushalt, zaehlung: Object.fromEntries(Object.entries(ergebnis).map(([k, v]) => [k, v.neu + v.ersetzt + v.behalten + v.nurMakeOs])), supabase: Object.fromEntries(Object.entries(s.bericht.zaehlung).map(([k, v]) => [k, v.supabase])) } }));
    await saveJson<Stand>(umzugStandName(z.haushalt), { ...s, uebernommen: { zeit, wer: z.person, ergebnis } });
    await belegAufgabenAbgleichen(z.haushalt).catch(() => null);
    return NextResponse.json({ ok: true, ergebnis });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannter Schritt.' }, { status: 400 });
}
