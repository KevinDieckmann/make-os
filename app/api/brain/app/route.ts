// ─── /api/brain/app — Brücke App → Brain (29.09., B2) ────────────────────────
// GET: Einstellung des Haushalts (Privat-Space: nur Zahlen oder voll), Ziel (Server-Vault konfiguriert? Spiegel an?),
//      letzter _App-Spiegel-Lauf, Stand des Such-Index der Arbeitsbestände.
// POST { privat: 'anzahl' | 'voll' }: Einstellung ändern (Person im Haushalt, wer/wann wird festgehalten).
// POST { aktion: 'jetzt' }: Tagesbericht ablegen und den Spiegel abgleichen — sonst macht das der nächtliche Lauf.
// Nur im Haushalt des Inhabers (Aufgaben und CRM gehören ihm).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const hh = await haushaltDesInhabers();
  if (!hh) return KEIN_ZUGANG();
  const [{ einstellungLesen }, { vaultZiel }, S, A] = await Promise.all([import('@/lib/brain/app-material'), import('@/lib/brain/vault-ziel'), import('@/lib/brain/app-spiegel'), import('@/lib/brain/app-index')]);
  const bericht = vaultZiel(), spiegel = vaultZiel({ spiegel: true });
  let arbeit: { zeilen: number; letzterLauf: string | null } | null = null;
  try { arbeit = A.appIndexStand(); } catch { arbeit = null; }
  return NextResponse.json({
    ok: true, einstellung: await einstellungLesen(hh),
    ziel: { bericht: bericht.ok ? 'an' : bericht.grund, spiegel: spiegel.ok ? 'an' : spiegel.grund },
    spiegelLauf: (await loadJson<import('@/lib/brain/app-spiegel').SpiegelStand>(S.RIEGEL)) ?? null, arbeit,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return KEIN_ZUGANG();
  const hh = await haushaltDesInhabers();
  if (!hh) return KEIN_ZUGANG();
  let b: { privat?: unknown; aktion?: unknown } = {};
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion === 'jetzt') {
    const [{ appTagesbericht }, { appSpiegel }] = await Promise.all([import('@/lib/brain/app-bericht'), import('@/lib/brain/app-spiegel')]);
    const bericht = await appTagesbericht();
    const spiegel = await appSpiegel({ erzwingen: true });
    return NextResponse.json({ ok: bericht.ok && spiegel.ok, bericht, spiegel });
  }
  if (b.privat === 'anzahl' || b.privat === 'voll') {
    const { einstellungSetzen } = await import('@/lib/brain/app-material');
    return NextResponse.json({ ok: true, einstellung: await einstellungSetzen(hh, b.privat, zugang.person) });
  }
  return NextResponse.json({ ok: false, fehler: "privat ('anzahl' | 'voll') oder aktion: 'jetzt'." }, { status: 400 });
}
