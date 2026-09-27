// Alte Schnittstelle /api/jarvis/* → /api/zoe/* (Umbenennung 27.09.). 308 behält Methode und Körper —
// ein noch laufender alter Arbeiter oder Bote landet damit weiter an der richtigen Stelle.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function weiter(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  return ctx.params.then(p => {
    const url = new URL(req.url);
    url.pathname = `/api/zoe${p.pfad?.length ? `/${p.pfad.join('/')}` : ''}`;
    return NextResponse.redirect(url, 308);
  });
}
export const GET = weiter; export const POST = weiter; export const PUT = weiter; export const PATCH = weiter; export const DELETE = weiter;
