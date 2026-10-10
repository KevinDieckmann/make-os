// ─── MAKE OS — Fokus je Bereich und Horizont: Unser · Mein · geteilt (09.10.) ───────────────────────────────────────────────────
// Kevin 09.10. spät: „dass wir selber alle immer Fokusse einstellen können … Muss ja auch wieder individuell sein.“ Bestände getrennt nach
// Privat und Business (lib/planung/fokus.ts), Lesen/Schreiben NUR über lib/planung/fokus-server.ts.
//   GET  ?bereich=privat|business[&einheit=<gesellschaft>][&jahr=JJJJ] → je Horizont Unser, Mein (+ geteilt), Partner (NUR Geteiltes).
//        Ohne Haushalt 403, Privat mit Konto „nur Business“ 403, ohne Person 401.
//   PUT  { bereich, wessen: 'unser'|'mein', horizont, jahr?, einheit?, text?, geteilt?, stand } — Stand/409 (die aktuelle Zelle kommt mit),
//        über FOKUS_MAX 413 (nie gekürzt). Unser nur volle Mitglieder; Mein nur für sich selbst. Der Dienstweg schreibt nur MIT Person
//        (ZOE `setze_fokus` nach der Freigabe) — für genau diese Person.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ohnePerson, personStreng, planZugangVon } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { fokusTextPruefen, istFokusBereich, istFokusHorizont } from '@/lib/planung/fokus';
import { fokusSchreiben, fokusSichtFuer } from '@/lib/planung/fokus-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OHNE_HAUSHALT = () => NextResponse.json({ ok: false, error: 'Der Fokus gehört zu einem Haushalt — dieses Konto hat keinen.' }, { status: 403 });
const fehler = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request) {
  const person = personStreng(req);
  if (!person) return ohnePerson();
  if (!(await planZugangVon(req))) return OHNE_HAUSHALT();
  const q = new URL(req.url).searchParams;
  const bereich = q.get('bereich') ?? 'privat';
  if (!istFokusBereich(bereich)) return fehler('bereich privat|business nötig.', 400);
  const jahr = q.get('jahr') ? Number(q.get('jahr')) : undefined;
  const s = await fokusSichtFuer(person, bereich, { einheit: q.get('einheit') ?? undefined, ...(jahr && Number.isInteger(jahr) ? { jahr } : {}) });
  if ('fehler' in s) return fehler(s.fehler, s.status);
  return NextResponse.json({ ok: true, ...s });
}

export async function PUT(req: Request) {
  const person = personStreng(req);
  if (!person) return ohnePerson();
  if (!(await planZugangVon(req))) return OHNE_HAUSHALT();
  const bau = bauPruefen(req); if (bau) return bau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (!istFokusBereich(b.bereich) || (b.wessen !== 'unser' && b.wessen !== 'mein') || !istFokusHorizont(b.horizont)) return fehler('bereich, wessen (unser|mein) und horizont nötig.', 400);
  if (typeof b.stand !== 'string' || !b.stand) return fehler('Stand fehlt — Seite neu laden.', 400);
  let text: string | undefined;
  if (b.text !== undefined) { const t = fokusTextPruefen(b.text); if (!t.ok) return fehler(t.fehler, t.status); text = t.text; }
  if (text === undefined && typeof b.geteilt !== 'boolean') return fehler('text oder geteilt nötig.', 400);
  const r = await fokusSchreiben(person, {
    bereich: b.bereich, wessen: b.wessen, horizont: b.horizont, stand: b.stand,
    ...(typeof b.jahr === 'number' ? { jahr: b.jahr } : {}), ...(typeof b.einheit === 'string' && b.einheit ? { einheit: b.einheit } : {}),
    ...(text !== undefined ? { text } : {}), ...(typeof b.geteilt === 'boolean' ? { geteilt: b.geteilt } : {}),
  }, werAus(req));
  if (!r.ok && 'konflikt' in r) {
    const satz = 'Der Fokus wurde inzwischen geändert — die neue Fassung ist geladen, deine Eingabe ist nicht gespeichert.';
    return NextResponse.json({ ok: false, konflikt: true, error: satz, zelle: r.zelle }, { status: 409 });
  }
  if (!r.ok) return fehler(r.fehler, r.status);
  return NextResponse.json({ ok: true, geaendert: r.geaendert, zelle: r.zelle });
}
