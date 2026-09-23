// ─── MAKE OS — Inbox-Status persistieren (lokal) ────────────────────────────
// Map messageId → Status ("offen" | "erledigt" | "aufgabe" | "delegiert" | "snoozed").
// snoozed trägt ein bis-Datum: bis dahin unsichtbar, danach taucht die Mail
// als ⏰ Wiedervorlage wieder oben auf. So bleibt die Triage über Reloads.

import { NextResponse } from 'next/server';
import { loadJson, saveJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type InboxStatusMap = Record<string, { status: string; at: string; bis?: string }>;

export async function GET() {
  const status = (await loadJson<InboxStatusMap>('inbox-status')) ?? {};
  return NextResponse.json({ status });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const map = body as InboxStatusMap;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Status-Map.' }, { status: 400 });
  }
  await saveJson('inbox-status', map);
  return NextResponse.json({ ok: true });
}

/**
 * Einzelne Mails ändern statt der ganzen Karte.
 *
 * Zwei-Fenster-Fundament: Post zu zweit wegzuarbeiten ist der eigentliche
 * Zweck der Inbox — vorher schrieb aber jedes Häkchen die KOMPLETTE Status-
 * Karte zurück. Wer zuletzt klickte, machte die Triage des anderen rückgängig.
 *
 * Format: { ops: [{ id: 'apple-mail-18', status: 'erledigt', bis?: '2026-08-09' }] }
 * status: null entfernt den Eintrag (= wieder offen).
 */
const ERLAUBT = ['offen', 'erledigt', 'aufgabe', 'delegiert', 'snoozed'];

export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ops) ? body.ops.slice(0, 300) : null;
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });

  interface Op { id: string; status: string | null; bis?: string }
  const ops: Op[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    const id = String(o?.id ?? '').slice(0, 120);
    if (!id) continue;
    if (o.status === null || o.status === 'offen') { ops.push({ id, status: null }); continue; }
    const st = String(o.status ?? '');
    if (!ERLAUBT.includes(st)) continue;
    ops.push({ id, status: st, bis: /^\d{4}-\d{2}-\d{2}$/.test(String(o.bis ?? '')) ? String(o.bis) : undefined });
  }
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  const next = await updateJson<InboxStatusMap>('inbox-status', current => {
    const map: InboxStatusMap = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
    const at = new Date().toISOString();
    for (const o of ops) {
      if (o.status === null) { if (map[o.id]) { delete map[o.id]; angewandt++; } }
      else { map[o.id] = { status: o.status, at, ...(o.bis ? { bis: o.bis } : {}) }; angewandt++; }
    }
    return map;
  });
  return NextResponse.json({ ok: true, angewandt, anzahl: Object.keys(next).length });
}
