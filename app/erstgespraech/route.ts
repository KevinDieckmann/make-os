// ─── /erstgespraech — die feste Adresse der Website für das Erstgespräch (31.10.) ────────────────────────────────────────────────────
// Die Knöpfe der Website zeigen immer hierher; MAKE OS leitet weiter auf die gewählte Buchungsseite (Markttraktion › Website › Formulare & Termine),
// sonst auf die EINZIGE aktive Buchungsseite mit der Adresse `erstgespraech-…`, sonst eine ruhige Seite „gibt es gerade nicht“ — nie ins Leere, nie ein
// fester Slug im Code. Ohne Sitzung offen (middleware.ts `ERSTGESPRAECH`, nur GET/HEAD), handelt für niemanden, schreibt nichts.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOEPFE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } as const;
const SEITE = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Termin</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0E1116;color:#E8ECEF;font:16px/1.5 system-ui,sans-serif}main{max-width:32rem;padding:24px}</style></head>
<body><main><h1>Gerade sind keine Termine buchbar</h1><p>Bitte versuchen Sie es später noch einmal oder schreiben Sie uns über die Website.</p></main></body></html>`;

export async function GET() {
  const { erstgespraechWohin } = await import('@/lib/website/server');
  const z = await erstgespraechWohin();
  if (z.art === 'buchung') return new Response(null, { status: 302, headers: { ...KOEPFE, Location: z.pfad } });
  return new Response(SEITE, { status: 404, headers: { ...KOEPFE, 'Content-Type': 'text/html; charset=utf-8' } });
}
