// ─── Konto: der Passwort-Stand (26.09.) — nur für den Dienstweg ───────────────
// Die Middleware fragt hier nach, ob eine Sitzung noch zum aktuellen Passwort
// gehört (lib/zugang/stand-pruefung.ts). Der Stand ist ein Fingerabdruck des
// Salzes, kein Geheimnis — aber die Route bleibt hinter dem Dienstschlüssel,
// damit niemand Kontonamen durchprobieren kann.

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { ladeKonten, aendereKonten, zweiFaktorOffen, leerlaufStunden } from '@/lib/zugang/konten';
import { kontoStand } from '@/lib/zugang/sitzung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ error: 'Nur für den Dienstweg.' }, { status: 403 });
  const speicher = new URL(req.url).searchParams.get('speicher') ?? '';
  const st = await ladeKonten();
  const k = st.konten.find(x => x.speicher === speicher);
  if (!k) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 404 });
  const jetzt = Date.now();
  return NextResponse.json({
    ok: true, stand: await kontoStand(k.salz),
    ab: k.sitzungenAb ? Date.parse(k.sitzungenAb) || 0 : 0,
    widerrufen: (k.widerrufen ?? []).filter(w => w.bis > jetzt).map(w => w.sid),
    // 2FA-Pflicht (05.10.): Sitzungen ab `zfAb` dürfen nur noch den zweiten Faktor einrichten (middleware.ts).
    zfOffen: zweiFaktorOffen(st.einstellungen, k),
    zfAb: st.einstellungen?.zweiFaktorPflichtSeit ? Date.parse(st.einstellungen.zweiFaktorPflichtSeit) || 0 : 0,
    // Leerlauf-Ende der Sitzungen (05.10., Konto › Zugang der Instanz) in Minuten.
    leerlaufMin: leerlaufStunden(st.einstellungen) * 60,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST { speicher, sid, bis } (05.10., nur Dienstweg = die Middleware): ein Zettel ist wegen Leerlauf beendet — wie beim
 * Abmelden in die Widerrufsliste des Kontos (überlebt einen Neustart; höchstens 50, abgelaufene fallen heraus).
 */
export async function POST(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ error: 'Nur für den Dienstweg.' }, { status: 403 });
  let b: { speicher?: unknown; sid?: unknown; bis?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const speicher = typeof b.speicher === 'string' ? b.speicher : '';
  const sid = typeof b.sid === 'string' && /^[a-f0-9]{12}$/.test(b.sid) ? b.sid : '';
  const bis = typeof b.bis === 'number' && Number.isFinite(b.bis) ? b.bis : 0;
  if (!speicher || !sid || !bis) return NextResponse.json({ error: 'speicher, sid, bis fehlen.' }, { status: 400 });
  const jetzt = Date.now();
  await aendereKonten(st => ({ ...st, konten: st.konten.map(k => k.speicher === speicher && !(k.widerrufen ?? []).some(w => w.sid === sid)
    ? { ...k, widerrufen: [...(k.widerrufen ?? []).filter(w => w.bis > jetzt), { sid, bis }].slice(-50) } : k) }));
  return NextResponse.json({ ok: true });
}
