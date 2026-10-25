// ─── Öffentliche Formular-Seite „Angebot anfordern“ für externe Vertriebler (25.10.2026) ────────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `ANGEBOT_OFFEN`: nur /angebot/<slug> und /api/angebot/<slug>, `<slug>` = `<vorsatz>-<24 hex>`).
// GET  → { ok, seite: { vertriebler, produkte (nur die freigegebenen, aktiven — Katalog-Form), datenschutz: { verantwortlich, seite } }, stempel }
// POST { anfrageId, anfrage, stempel, webseite (Honigtopf, leer) } → { ok, status: 'verschickt' | 'freigabe', text, nummer? }
// Schutz wie die Buchung: unbekannter, widerrufener und abgelaufener Link → DIESELBE 404; Drossel je Netz (jeder Fehlgriff, jedes Lesen mit Budget) und
// je Link (Anfragen); Honigtopf und Zeit-Fehler mit demselben Text; signierter Formular-Stempel (≥ 3 s, ≤ 2 h); Größe → 413. Handelt für niemanden
// (Köpfe löscht die Middleware); die Antwort enthält NIE etwas aus dem Bestand (keine Kunden, keine Kennungen, kein „schon da“).

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { ausfuellZeitOk } from '@/lib/kalender/buchung';
import { einmalig } from '@/lib/store/anfragen';
import { linkSlugOk } from '@/lib/crm/formulare';
import { angebotStempel, angebotStempelZeit } from '@/lib/crm/formulare-speicher';
import { aktiverLink, angebotAnfordern, linkKatalog } from '@/lib/crm/formulare-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 16 * 1024;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
/** Für jede Fehlerart dieselbe Antwort (unbekannt, widerrufen, abgelaufen). */
const NICHT_GEFUNDEN = { ok: false, fehler: 'Diese Seite gibt es nicht (mehr).' };
const NICHT_ANGENOMMEN = 'Anfrage nicht angenommen — bitte die Seite neu laden und in Ruhe ausfüllen.';
/** So viele Aufrufe (GET) je Netz und Viertelstunde frei; je Link so viele Anfragen. */
const LESEN_FREI = 40;
const LINK_FREI = 20;

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const netz = adresseNetz(req);
  const schluessel = `angebot:${netz}`, lesen = `angebot-lesen:${netz}`;
  const zu = gedrosselt(schluessel) ?? gedrosselt(lesen); if (zu) return zu;
  fehlschlag(lesen, Date.now(), LESEN_FREI);
  const link = linkSlugOk(slug) ? await aktiverLink(slug) : null;
  if (!link) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }
  const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const [produkte, ds] = await Promise.all([linkKatalog(link), datenschutzOeffentlichLaden()]);
  return antwort({ ok: true, seite: { vertriebler: link.name, produkte, datenschutz: ds }, stempel: angebotStempel(slug) });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const schluessel = `angebot:${adresseNetz(req)}`;
  const zu = gedrosselt(schluessel); if (zu) return zu;
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > MAX_BYTES) { fehlschlag(schluessel); return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413); }
  const text = await req.text().catch(() => '');
  if (text.length > MAX_BYTES) { fehlschlag(schluessel); return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413); }
  const link = linkSlugOk(slug) ? await aktiverLink(slug) : null;
  if (!link) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }
  const jeLink = `angebot-link:${link.id}`;
  const zuLink = gedrosselt(jeLink); if (zuLink) return zuLink;
  let roh: Record<string, unknown>;
  try { const j = JSON.parse(text); if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(); roh = j; } catch { fehlschlag(schluessel); return antwort({ ok: false, fehler: 'Ungültige Anfrage.' }, 400); }
  // Honigtopf und Zeit: dieselbe Antwort (eine Maschine lernt nichts daraus).
  const geladen = angebotStempelZeit(slug, roh.stempel);
  if (geladen === null) { fehlschlag(schluessel); return antwort({ ok: false, fehler: 'Bitte die Seite neu laden.' }, 400); }
  if ((typeof roh.webseite === 'string' && roh.webseite.trim()) || !ausfuellZeitOk(geladen, Date.now())) { fehlschlag(schluessel); return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400); }
  fehlschlag(jeLink, Date.now(), LINK_FREI);
  const r = await einmalig<Record<string, unknown>>('angebot-link', roh.anfrageId, () => angebotAnfordern(roh.anfrage, { art: 'link', link }, { anfrageId: roh.anfrageId }), undefined, { wer: `link-${link.id}`.slice(0, 80) });
  return antwort(r.body as Record<string, unknown>, r.status);
}
