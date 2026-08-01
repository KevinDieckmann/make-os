// ─── MAKE OS — OAuth-Callback ───────────────────────────────────────────────
// Der Anbieter schickt Kevins Browser mit ?code&state hierher zurück.
// state wird eingelöst (CSRF), der Code gegen Tokens getauscht, gespeichert —
// dann zurück auf /os/verbindungen. Tokens verlassen den Server nie.

import { NextResponse } from 'next/server';
import { PROVIDER, REDIRECT_URI, stateEinloesen, tokensSpeichern } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zurueck = (status: string) => NextResponse.redirect(`http://localhost:3001/os/verbindungen?status=${status}`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return zurueck('abgebrochen');

  const providerId = await stateEinloesen(state);
  if (!providerId) return zurueck('state-ungueltig');
  const p = PROVIDER[providerId];
  if (!p) return zurueck('unbekannt');

  try {
    const r = await fetch(p.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: process.env[p.envId]!,
        client_secret: process.env[p.envSecret]!,
        ...(providerId === 'microsoft' ? { scope: p.scope } : {}),
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const d = await r.json();
    if (!r.ok || !d.access_token) return zurueck(`fehler-${p.id}`);
    await tokensSpeichern(p.id, d);
    return zurueck(`verbunden-${p.id}`);
  } catch {
    return zurueck(`fehler-${p.id}`);
  }
}
