// ─── Netzwerken — Erfassen (02.10.) ──────────────────────────────────────────
// GET                                → { ok, ich, heute, personen: [{ id, name, kalender }] } — wer im Haushalt ist (für „zuständig“)
// GET  ?frei=<person>&dauer=30|45|60 → { ok, tage: [{ tag, zeiten: [{ start, ende }] }] } — freie Zeiten der Person, nächste
//                                      10 Werktage (nur Zeiten, nie Titel — dieselbe Lesefunktion wie /api/kalender/frei)
// POST { aktion: 'erfassen', … }     → eine Erfassung: Kontakt + Firma + Fotos + Teilnahme + nächster Schritt (+ Termin, Meldung).
//                                      Idempotent über `erfassungId` (UUID aus dem Browser): derselbe Körper zweimal tut nichts
//                                      doppelt, ein abgebrochener Lauf macht beim ersten offenen Schritt weiter (lib/crm/netzwerken-server.ts).
// POST { aktion: 'danke-raus', eventId, kontaktId, anrede? } → die Danke-Mail wurde im Mail-Programm geschickt (Einzelklick) — vermerken.
//
// Zugang: eine angemeldete Person im Haushalt des Inhabers. Der Dienstweg (ZOE, Takt, Skripte) darf hier nie schreiben — eine
// Erfassung ist eine menschliche Handlung (Kontakt anlegen, Termin buchen, Meldung an die andere Person) — und ohne Person
// gar nichts: 403. Nichts wird versendet; die Danke-Mail öffnet nur das Mail-Programm des Geräts.

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng, haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { zuGross } from '@/lib/zugang/umfang';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { localDay } from '@/lib/zeit';
import { istKontaktKennung } from '@/lib/kennung';
import { erfassungPruefen, KOERPER_MAX, DAUERN } from '@/lib/crm/netzwerken';
import { erfassungAusfuehren, dankeRausVermerken, freieVorschlaege, ErfassungFehler } from '@/lib/crm/netzwerken-server';
import { PersonenSchrankeFehler } from '@/lib/crm/personen-schranke';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Netzwerken gibt es nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

/** Die eigene Person — nur von Hand angemeldet, im Haushalt. Kein Dienstweg, kein Rückfall. */
async function eigene(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (istDienst(req)) return null;
  const w = await imHaushaltDesInhabers(req);
  if (!w || personStreng(req) !== w.person) return null;
  const h = await haushaltFuer(w.person);
  return h ? { person: w.person, haushalt: h.haushalt } : null;
}

export async function GET(req: Request) {
  const z = await eigene(req);
  if (!z) return NextResponse.json(GESPERRT, { status: 403 });
  const q = new URL(req.url).searchParams;
  const frei = q.get('frei');
  if (frei !== null) {
    if (!(await personImHaushaltDesInhabers(frei))) return fehler('Nur Personen des Haushalts.', 400);
    const dauer = Math.round(Number(q.get('dauer') ?? 45));
    if (!(DAUERN as readonly number[]).includes(dauer)) return fehler('Die Dauer muss 30, 45 oder 60 Minuten sein.', 400);
    try {
      const tage = await freieVorschlaege({ person: frei, dauer });
      return NextResponse.json({ ok: true, tage }, { headers: { 'Cache-Control': 'no-store' } });
    } catch { return fehler('Die freien Zeiten ließen sich gerade nicht lesen — bitte eine Zeit selbst eintragen.', 502); }
  }
  const [konten, einst] = await Promise.all([kontenDesHaushalts(z.haushalt), ladeEinstellungen().catch(() => null)]);
  const kalender = (id: string) => !!einst && id !== 'beide' && !!(einst.kalender as Record<string, string | undefined>)[id];
  return NextResponse.json({ ok: true, ich: z.person, heute: localDay(), personen: konten.map(k => ({ id: k.speicher, name: k.name, kalender: kalender(k.speicher) })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigene(req);
  if (!z) return NextResponse.json(GESPERRT, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen: bleibt in der Warteschlange
  if (alterBau) return alterBau;
  if (zuGross(req, KOERPER_MAX)) return fehler('Die Erfassung ist zu groß — bitte weniger oder kleinere Fotos.', 413);
  let body: Record<string, unknown>;
  try { const b = await req.json(); if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('kein Objekt'); body = b as Record<string, unknown>; } catch { return fehler('Kein gültiges JSON.', 400); }

  if (body.aktion === 'danke-raus') {
    const eventId = typeof body.eventId === 'string' ? body.eventId : '', kontaktId = typeof body.kontaktId === 'string' ? body.kontaktId : '';
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(eventId) || !istKontaktKennung(kontaktId)) return fehler('Event oder Person fehlt.', 400);
    const r = await dankeRausVermerken({ eventId, kontaktId, person: z.person, wer: werAus(req), ...(body.anrede === 'Du' || body.anrede === 'Sie' ? { anrede: body.anrede } : {}) });
    return r.ok ? NextResponse.json(r) : fehler(r.fehler, r.status);
  }
  if (body.aktion !== undefined && body.aktion !== 'erfassen') return fehler('aktion: erfassen oder danke-raus.', 400);

  const p = erfassungPruefen(body, { heute: localDay() });
  if (!p.ok) return fehler(p.fehler, p.status);
  try {
    const r = await erfassungAusfuehren(p.wert, { person: z.person, haushalt: z.haushalt, wer: werAus(req) });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ErfassungFehler) return fehler(e.message, e.status, e.extra);
    // Die Personen-Schranke des CRM-Bestands (Art. 18, Werbesperre in Einladung/Kampagne) — nie als 500 mit Wiederholung.
    if (e instanceof PersonenSchrankeFehler) return fehler(e.message, 409);
    console.error('[netzwerken]', e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : 'Fehler');
    // 500: der Browser behält die Erfassung in der Warteschlange und versucht es wieder — jeder Schritt ist wiederholbar.
    return fehler('Gerade nicht möglich — die Erfassung bleibt auf dem Gerät und wird erneut gesendet.', 500);
  }
}
