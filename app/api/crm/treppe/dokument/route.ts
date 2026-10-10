// ─── Produkte & Mandate · „Aus Dokument übernehmen“ (10.10.) ─────────────────────────────────────────────────────────
// POST multipart `datei` (PDF, DOCX, Markdown/Text; ≤ 10 MB) → der Head of Sales liest das Dokument (Text als `fremd()`, KI nur über
// `askText` mit Kategorie „crm“) und schlägt Treppe, Kundenreise und Positionierung vor → Freigabe-Stapel (Art `produkte`, nur für die
// hochladende Person). Die Datei wird NICHT gespeichert — nur der gesäuberte Vorschlag liegt im Stapel. Übernommen wird erst per Klick (mit
// Feld-Häkchen) über POST /api/zoe/stapel. Ohne KI (kein Schlüssel, Guthaben, KI gesperrt) → 409 `ohneKi` mit dem Hinweis auf die leere Vorlage.
// Nur eine angemeldete Person im Haushalt des Inhabers (Dienstweg 403).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { modellSchranke } from '@/lib/zugang/umfang';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { aufgabenTypErkennen, typGruppe } from '@/lib/dateien/aufgaben-regeln';
import { dateinameSaeubern } from '@/lib/dateien/regeln';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DATEI = 10 * 1024 * 1024;
const UMSCHLAG = 64 * 1024;
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return fehler('Dokumente liest der Head of Sales nur für eine angemeldete Person.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Bitte eine Datei hochladen (PDF, Word oder Text).', 415);
  const roh = await begrenztLesen(req, MAX_DATEI + UMSCHLAG);
  if (!roh) return fehler(`Datei zu groß (höchstens ${MAX_DATEI / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string') return fehler('Datei fehlt.', 400);
  if (!datei.size) return fehler('Die Datei ist leer.', 400);
  if (datei.size > MAX_DATEI) return fehler(`Datei zu groß (höchstens ${MAX_DATEI / 1024 / 1024} MB).`, 413);
  const bytes = Buffer.from(await datei.arrayBuffer());
  const name = dateinameSaeubern(datei.name, 'pdf');
  const typ = aufgabenTypErkennen(name, bytes);
  const gruppe = typ ? typGruppe(typ) : null;
  if (!typ || !gruppe || !['pdf', 'word', 'text', 'praesentation'].includes(gruppe)) return fehler('Nur PDF, Word, PowerPoint oder Text/Markdown — und der Inhalt muss zur Endung passen.', 415);

  const { hasAnthropicKey, guthabenLeer } = await import('@/lib/anthropic');
  if (!hasAnthropicKey() || guthabenLeer()) return fehler('Ohne KI liest niemand das Dokument — nimm die leere Vorlage und fülle sie aus.', 409, { ohneKi: true });
  const schranke = modellSchranke(req); if (schranke) return schranke;

  const { textAuslesen } = await import('@/lib/dateien/text-auslesen');
  let text = '';
  try { text = (await textAuslesen(bytes, typ))?.text ?? ''; } catch { return fehler('Das Dokument ließ sich nicht lesen (beschädigt oder geschützt).', 422); }
  const { treppeAusDokument } = await import('@/lib/crm/treppe-ki');
  const r = await treppeAusDokument(text, kiAus(req, ['crm'], { anzahl: 1, person: zugang.person }));
  if (!r.ok) return fehler(r.text, r.grund === 'leer' ? 422 : 409, r.grund === 'ki' ? { ohneKi: true } : {});
  const { dokumentVorschlagAblegen, TreppeFehler } = await import('@/lib/crm/treppe-server');
  try {
    const v = await dokumentVorschlagAblegen(zugang.person, r.wert, name);
    return NextResponse.json({ ok: true, vorschlagId: v.id, vorschlag: v.vorschlag, gekuerzt: r.gekuerzt, ki: kiKennzeichen({ anbieter: r.anbieter }) });
  } catch (e) {
    if (e instanceof TreppeFehler) return fehler(e.message, e.status);
    throw e;
  }
}
