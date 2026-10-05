// ─── Instanz-Export bei Vertragsende — nur Inhaber (05.10., Betroffenenrechte v2; AVV § 11) ──────────────────────────────────
// GET  → Umfang (Zahlen: Bestände, Dateien, Bilder) für die Oberfläche — nur Inhaber.
// POST { passwort, code? } → ALLE Bestände, Dateien und Bilder entschlüsselt als EINE JSON-Datei (Strom, lib/datenschutz/instanz-export.ts).
// Nur die Inhaber-SITZUNG (x-make-user, Rolle inhaber) — nie der Dienstweg, nie ZOE, nie ein Mitglied (403). Dazu Passwort und, wenn an,
// der zweite Faktor (lib/zugang/erneut.ts). Jeder Export steht im Lese-Protokoll (Bereich „export“, Umfang) und im Anmeldeprotokoll.
// Löschen der Instanz danach: scripts/instanz-loeschen.mjs (Trockenlauf als Vorgabe, Bestätigungs-Code) — nie aus der App.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { istDienst } from '@/lib/zugang/dienst';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { erneutPruefen } from '@/lib/zugang/erneut';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';
import { adresse } from '@/lib/zugang/drossel';
import { protokolliereLesen } from '@/lib/store/leseprotokoll';
import { instanzExportStrom, instanzUmfang } from '@/lib/datenschutz/instanz-export';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (fehler: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });

/** Die Inhaber-Sitzung — oder null (Dienstweg, fremde Rolle, ohne Sitzung). */
async function inhaber(req: Request) {
  if (istDienst(req)) return null;
  const p = req.headers.get('x-make-user');
  if (!p || !/^[a-z0-9-]{1,40}$/.test(p) || !(await istInhaber(p))) return null;
  return (await ladeKonten()).konten.find(x => x.speicher === p) ?? null;
}

export async function GET(req: Request) {
  if (!(await inhaber(req))) return nein('Nur der Inhaber.', 403);
  return NextResponse.json({ ok: true, umfang: await instanzUmfang() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const k = await inhaber(req);
  if (!k) return nein('Nur der Inhaber — mit eigener Sitzung.', 403);
  let b: { passwort?: unknown; code?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? nein('Kein gültiges JSON.', 400); }
  const p = await erneutPruefen(req, k, { passwort: b?.passwort, code: b?.code }, 'instanz-export');
  if (!p.ok) {
    const res = nein(p.fehler, p.status, p.zweiterFaktor ? { zweiterFaktor: true } : {});
    if (p.warteSek) res.headers.set('Retry-After', String(p.warteSek));
    return res;
  }
  const umfang = await instanzUmfang();
  await protokolliereLesen(req, 'export', { anzahl: umfang.bestaende + umfang.dateien + umfang.bilder });
  await notiere({ speicher: k.speicher, art: 'instanz-export', ok: true, adresse: adresseGekuerzt(adresse(req)) });
  const kopf = { erstellt: new Date().toISOString(), von: k.speicher, umfang, adresse: process.env.MAKE_OS_ADRESSE?.trim() || null };
  return new Response(instanzExportStrom(kopf), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="MAKE-OS-Instanz-Export-${localDay()}.json"` },
  });
}
