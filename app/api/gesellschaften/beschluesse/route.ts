// ─── MAKE OS — Unternehmen › Beschlüsse & Satzung (/os/unternehmen?s=beschluesse, 10.10.) ───────────────────────────────────────────────
// Kevin 10.10.: „Unternehmen wird extrem spannend, wenn ich da alle Gesellschafterbeschlüsse, den Gegenstand und alles dazu gesammelt habe.“
// Geschrieben wird das Beschluss-Buch NUR über das Register (PATCH /api/gesellschaften, Listen `beschluesse` und `fassungen` — eine Schreibstelle).
// Diese Route liest nur bzw. legt Vorschläge in den Stapel:
// GET  ?id=<gesellschaft>&pdf=1[&jahr=JJJJ]       → das Beschluss-Buch als PDF (Download; verschickt nichts)
// GET  ?id=<gesellschaft>&datei=<d-…>             → Vorschlag aus einer Unterlage der Gesellschaft (Regelwerk ohne Modell: Felder + wörtliche
//                                                   Fundstellen mit Seite; Beteiligte nur als Text) — übernommen wird erst per Klick im Formular
// GET  ?id=<gesellschaft>&b=<bs-…>                → Folgen des Beschlusses jetzt (Pflichten, Fassung, Cap-Table) samt Hinweisen und ob sie schon
//                                                   im Stapel lagen
// POST { aktion: 'folgen', id, beschlussId }      → die Folgen (noch einmal) als Vorschläge in den Stapel — nur per Sitzung, je Folge höchstens einmal
// Zugang wie das Register: NUR der Haushalt des Inhabers mit Person am Konto (Testkunde, fremder Haushalt, Konto „nur Business“ ohne Haushaltszugang,
// Dienstweg ohne Person → 403). Die Route liegt unter `gesellschaften` = Business (lib/zugang/sicht-bereich.ts). Hinweis, keine Rechtsberatung.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { dateinameAscii } from '@/lib/dateien/regeln';
import { istGesellschaftId } from '@/lib/einheiten';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { gesellschaftVon, aktiveEintraege } from '@/lib/gesellschaften/modell';
import { BESCHLUSS_HINWEIS } from '@/lib/gesellschaften/beschluesse';
import { BeschlussFehler, buchPdfErstellen, importVorschlag, folgenJetzt, beschlussFolgenLegen, folgeMarke } from '@/lib/gesellschaften/beschluss-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Das Beschluss-Buch gehört zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const KOPF = { headers: { 'Cache-Control': 'no-store' } };
const BESCHLUSS_ID = /^bs-[a-z0-9][a-z0-9-]{3,62}$/;

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (!istGesellschaftId(id)) return fehler('id: kdc, kdv, ug oder g-….', 400);
  leseZugriff(req, 'gesellschaften', { ids: [id] }); // Lese-Protokoll (Gesellschafts-Register)
  try {
    if (q.get('pdf') === '1') {
      const jahrRoh = q.get('jahr');
      const jahr = jahrRoh && /^\d{4}$/.test(jahrRoh) ? Number(jahrRoh) : undefined;
      const { bytes, name } = await buchPdfErstellen(z.haushalt, id, { ...(jahr ? { jahr } : {}) });
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length),
          'Content-Disposition': `attachment; filename="${dateinameAscii(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store, private',
        },
      });
    }
    const datei = q.get('datei');
    if (datei) {
      const r = await importVorschlag(z.haushalt, id, datei);
      return NextResponse.json({ ok: true, hinweis: BESCHLUSS_HINWEIS, ...r }, KOPF);
    }
    const bid = q.get('b');
    if (bid) {
      if (!BESCHLUSS_ID.test(bid)) return fehler('b: Kennung bs-….', 400);
      const register = await ladeRegister(z.haushalt);
      const g = gesellschaftVon(register, id);
      const b = aktiveEintraege(g?.beschluesse).find(x => x.id === bid);
      if (!g || !b) return fehler('Beschluss nicht gefunden.', 404);
      const { folgen, hinweise } = await folgenJetzt(z.haushalt, register, g, b);
      const marken = (await (await import('@/lib/recht/server')).ladeRechtStand(z.haushalt)).marken ?? {};
      return NextResponse.json({ ok: true, hinweis: BESCHLUSS_HINWEIS, folgen: folgen.map(f => ({ ...f, imStapel: !!marken[folgeMarke(f.schluessel)] })), hinweise }, KOPF);
    }
    return fehler('Was soll gelesen werden? (pdf=1, datei=d-… oder b=bs-…)', 400);
  } catch (e) {
    if (e instanceof BeschlussFehler) return fehler(e.message, e.status);
    console.error('[gesellschaften/beschluesse]', e instanceof Error ? e.message : e);
    return fehler('Nicht gelesen.', 500);
  }
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  // Folgen entstehen nur per Klick einer Person (Sitzung) — nie über den Dienstweg (ZOE, Takt, Skripte).
  if (istDienst(req)) return fehler('Folgen eines Beschlusses legt nur der Klick in der Oberfläche in den Stapel.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try {
    const roh = await jsonBegrenzt(req, 16 * 1024);
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return fehler('Kein gültiges JSON.', 400);
    b = roh as Record<string, unknown>;
  } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (b.aktion !== 'folgen') return fehler('aktion: folgen.', 400);
  if (!istGesellschaftId(b.id)) return fehler('id: kdc, kdv, ug oder g-….', 400);
  if (typeof b.beschlussId !== 'string' || !BESCHLUSS_ID.test(b.beschlussId)) return fehler('beschlussId: Kennung bs-….', 400);
  const g = gesellschaftVon(await ladeRegister(z.haushalt), b.id);
  if (!g || !aktiveEintraege(g.beschluesse).some(x => x.id === b.beschlussId)) return fehler('Beschluss nicht gefunden.', 404);
  const r = await beschlussFolgenLegen(z.haushalt, z.person, b.id, b.beschlussId);
  return NextResponse.json({ ok: true, ...r });
}
