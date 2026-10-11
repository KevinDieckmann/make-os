// ─── Kunden-Link — eine Unterlage hochladen (öffentlich; Fulfillment C2, 10.10. — kommt AUSGESCHALTET; FULFILLMENT_KONZEPT.md 5.4) ────────────────
// POST multipart: `datei` (genau eine), `stempel`, `webseite` (Honigtopf, leer), optional `zweck` (register | playbook). Nur mit `x-kunde-token` und Recht
// „Upload“ — sonst dieselbe 404. Entscheidung 10.10., 23:25: nur sichere Typen, am INHALT geprüft (PDF, PNG, JPG, WEBP, HEIC, DOCX/XLSX/PPTX ohne Makros; sonst 415),
// Bilder ohne Exif/GPS, nie geöffnet oder ausgeführt, verschlüsselt abgelegt (`fulfillment-unterlagen`), Status „ungeprüft“ bis ein Mensch freigibt.
// Grenzen: Datei ≤ 25 MB, je Link ≤ 20 Dateien und ≤ 200 MB (413), je Link ≤ 30 Uploads je Stunde (429). Kein Virenscanner (Entscheidung des Inhabers).
// Die zuständige Person bekommt eine NEUTRALE Glocke („Neue Unterlagen zu „<Mandat>“ eingegangen“, ohne Dateinamen).

import { kundeZugriff, antwortOeffentlich } from '@/lib/fulfillment/kunde/oeffentlich';
import { uploadKunde } from '@/lib/fulfillment/kunde/server';
import { formularPruefen } from '@/lib/fulfillment/kunde/token';
import { bremse } from '@/lib/fulfillment/kunde/bremse';
import { UPLOAD_GRENZEN, UMSCHLAG_BYTES } from '@/lib/fulfillment/kunde/upload';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZU_GROSS = `Datei zu groß (höchstens ${UPLOAD_GRENZEN.dateiBytes / 1024 / 1024} MB).`;

export async function POST(req: Request, ctx: { params: Promise<{ link: string }> }) {
  const link = (await ctx?.params?.catch(() => null))?.link;
  const z = await kundeZugriff(req, link, 'upload');
  if (z instanceof Response) return z;
  if (z.art !== 'voll') return antwortOeffentlich({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }, 404);
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return antwortOeffentlich({ ok: false, fehler: 'Bitte die Datei über das Formular senden.' }, 415);
  const b = bremse('upload', z.link.id);
  if (!b.erlaubt) return antwortOeffentlich({ ok: false, fehler: 'Gerade sehr viele Uploads — bitte kurz warten.' }, 429, { 'Retry-After': String(b.warteSek) });
  const roh = await begrenztLesen(req, UPLOAD_GRENZEN.dateiBytes + UMSCHLAG_BYTES);
  if (!roh) return antwortOeffentlich({ ok: false, fehler: ZU_GROSS }, 413);
  let form: FormData;
  try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return antwortOeffentlich({ ok: false, fehler: 'Upload nicht lesbar.' }, 400); }
  const falle = formularPruefen(z.link.id, form.get('stempel'), form.get('webseite'));
  if (falle) return antwortOeffentlich({ ok: false, fehler: falle }, 400);
  const dateien = form.getAll('datei');
  if (dateien.length !== 1 || typeof dateien[0] === 'string') return antwortOeffentlich({ ok: false, fehler: 'Bitte genau eine Datei je Upload.' }, 400);
  const datei = dateien[0] as File;
  if (datei.size > UPLOAD_GRENZEN.dateiBytes) return antwortOeffentlich({ ok: false, fehler: ZU_GROSS }, 413);
  const r = await uploadKunde(z, datei.name, Buffer.from(await datei.arrayBuffer()), form.get('zweck'));
  return antwortOeffentlich(r.body, r.status);
}
