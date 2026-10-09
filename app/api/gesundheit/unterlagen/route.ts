// ─── MAKE OS — Gesundheit › Unterlagen: eigene Gesundheits-Unterlagen (09.10.; Auftrag: „… oder eine Datei hochgeladen werden kann.“) ──────
// Art. 9 DSGVO — NUR die Person der Sitzung (personStreng), kein `?fuer`, kein Dienstweg (403): auch wer seine Gesundheit teilt, teilt die
// Unterlagen nicht, und der Inhaber sieht sie nie. Regeln: lib/gesundheit/unterlagen.ts, Ablage: lib/gesundheit/unterlagen-server.ts.
// GET              → { ok, unterlagen, ki: { an }, grenzen } — nur Metadaten (Lese-Protokoll Art. 9). `ki.an` = der Gesundheits-Head darf den
//                    Text lesen (Einwilligung (b) und ein offener KI-Weg) — sonst bleiben sie bei ihm draußen.
// GET ?id=gu-…     → Datei herunterladen (attachment, nosniff, CSP-Sandbox, no-store) — Lese-Protokoll mit Kennung.
// POST multipart   → `datei` (PDF, PNG, JPG, HEIC, TXT, MD; Typ am INHALT, Endung muss passen; ≤ 15 MB) + optional `notiz` (≤ 300 Zeichen):
//                    nur mit Einwilligung (a) (403 `einwilligung: 'gesundheit'`); gleiche Datei schon da → 409; mehr als 200 → 413; falscher Typ → 415.
// DELETE ?id=gu-…  → entfernen (Eintrag, dann Datei) — geht immer, auch ohne Einwilligung (Art. 17).

import { NextResponse } from 'next/server';
import { istDienst, personStreng, ohnePerson } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitAnKi, gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { dateinameAscii, dateinameSaeubern, endung } from '@/lib/dateien/regeln';
import { MAX_UNTERLAGE_BYTES, NOTIZ_MAX, UNTERLAGE_ID, UNTERLAGEN_MAX, UNTERLAGEN_ZEICHEN, unterlageTypErkennen } from '@/lib/gesundheit/unterlagen';
import { UnterlagenFehler, unterlageAblegen, unterlageEntfernen, unterlageLesen, unterlagenLaden } from '@/lib/gesundheit/unterlagen-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Umschlag für multipart (Grenzen, Feldnamen, Notiz) — großzügig, aber begrenzt. */
const UMSCHLAG = 64 * 1024;
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, error: text, ...extra }, { status });
/** 403 für den Dienstweg (ZOE, Takt, Skripte): Gesundheits-Unterlagen sieht und ändert nur die Person selbst. */
const NUR_SELBST = () => fehler('Gesundheits-Unterlagen sieht und ändert nur die Person selbst — angemeldet, nie über den Dienstweg.', 403);
const ZU_GROSS = () => fehler(`Datei zu groß (höchstens ${MAX_UNTERLAGE_BYTES / 1024 / 1024} MB). Nichts gespeichert.`, 413);
const FALSCHER_TYP = () => fehler('Nur PDF, Bilder (PNG, JPG, HEIC), TXT oder Markdown — und der Inhalt muss zur Endung passen. Nichts gespeichert.', 415);

function ausFehler(e: unknown) {
  if (e instanceof UnterlagenFehler) return fehler(e.message, e.status, e.extra);
  console.error('[gesundheit/unterlagen]', e instanceof Error ? e.message.slice(0, 160) : e);
  return fehler('Ablage gerade nicht erreichbar — nichts geändert.', 500);
}

export async function GET(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  const id = new URL(req.url).searchParams.get('id');
  try {
    if (id !== null) {
      if (!UNTERLAGE_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
      const d = await unterlageLesen(person, id);
      if (!d) return fehler('Nicht gefunden.', 404);
      leseZugriff(req, 'gesundheit', { betroffen: person, ids: [id] }); // Lese-Protokoll (Art. 9) — nur Kennung, nie Inhalt
      const name = d.eintrag.name;
      return new Response(new Uint8Array(d.bytes), {
        headers: {
          'Content-Type': d.eintrag.typ,
          'Content-Length': String(d.bytes.length),
          'Content-Disposition': `attachment; filename="${dateinameAscii(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'no-store, private',
        },
      });
    }
    leseZugriff(req, 'gesundheit', { betroffen: person });
    const [unterlagen, an] = await Promise.all([unterlagenLaden(person), gesundheitAnKi(person).catch(() => false)]);
    return NextResponse.json({ ok: true, unterlagen, ki: { an }, grenzen: { bytes: MAX_UNTERLAGE_BYTES, anzahl: UNTERLAGEN_MAX, notiz: NOTIZ_MAX, zeichen: UNTERLAGEN_ZEICHEN } }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (e) { return ausFehler(e); }
}

export async function POST(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  // Art. 9: abgelegt wird nur mit Einwilligung (a) der Person.
  { const sperre = await gesundheitSchreibSperre(person); if (sperre) return sperre; }
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return FALSCHER_TYP();
  try {
    const roh = await begrenztLesen(req, MAX_UNTERLAGE_BYTES + UMSCHLAG);
    if (!roh) return ZU_GROSS();
    let form: FormData;
    try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
    const datei = form.get('datei');
    if (!datei || typeof datei === 'string') return fehler('Datei fehlt.', 400);
    if (datei.size > MAX_UNTERLAGE_BYTES) return ZU_GROSS();
    if (!datei.size) return fehler('Die Datei ist leer.', 400);
    const name = dateinameSaeubern(datei.name, endung(datei.name) || 'txt');
    const bytes = Buffer.from(await datei.arrayBuffer());
    const typ = unterlageTypErkennen(name, bytes);
    if (!typ) return FALSCHER_TYP();
    const notiz = form.get('notiz');
    const eintrag = await unterlageAblegen(person, { name, typ, bytes, notiz: typeof notiz === 'string' ? notiz : undefined });
    return NextResponse.json({ ok: true, unterlage: eintrag });
  } catch (e) { return ausFehler(e); }
}

export async function DELETE(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UNTERLAGE_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  try {
    return (await unterlageEntfernen(person, id)) ? NextResponse.json({ ok: true }) : fehler('Nicht gefunden.', 404);
  } catch (e) { return ausFehler(e); }
}
