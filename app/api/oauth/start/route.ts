// ─── MAKE OS — OAuth-Start ──────────────────────────────────────────────────
// GET ?provider=whoop|microsoft → leitet zur Anmeldeseite des Anbieters.
// state gegen CSRF wird serverseitig gemerkt (15-Minuten-Fenster).

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { PROVIDER, REDIRECT_URI, konfiguriert, stateMerken } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = PROVIDER[url.searchParams.get('provider') ?? ''];
  if (!p) return NextResponse.json({ error: 'Unbekannter Anbieter.' }, { status: 400 });
  if (!konfiguriert(p)) {
    return NextResponse.json({ error: `${p.name} ist nicht konfiguriert — ${p.envId}/${p.envSecret} fehlen in .env.local.` }, { status: 400 });
  }
  const state = randomBytes(24).toString('hex');
  await stateMerken(state, p.id);
  const ziel = new URL(p.authUrl);
  ziel.searchParams.set('response_type', 'code');
  ziel.searchParams.set('client_id', process.env[p.envId]!);
  ziel.searchParams.set('redirect_uri', REDIRECT_URI);
  ziel.searchParams.set('scope', p.scope);
  ziel.searchParams.set('state', state);
  return NextResponse.redirect(ziel.toString());
}
