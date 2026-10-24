// ─── Markttraktion — Playbooks und Event-Vorlagen bearbeiten (Restpunkte 24.10.) ────────────────────────────────────────────────────────────────────────────
// GET  ?art=playbook|event → { vorlagen (wirksam: Vorgaben mit Abweichungen + eigene, je Vorlage `angepasst`/`eigen`), standard (die Vorgaben im Code), stand,
//      hinweise (je Playbook: werbliche Wörter in eigenen Texten, § 7 UWG), grenzen } — nur Haushalt des Inhabers; Lesen schreibt nie.
// POST { art, stand, op: 'speichern' (id, vorlage) | 'kopieren' (id, name?) | 'standard' (id) | 'loeschen' (id) } → Stand/409 mit dem aktuellen Stand,
//      unbekannt 404, ungültig 400 (Rechtshinweis, Filter, Zuständigkeit sind nie bearbeitbar), zu groß/zu viele 413 — nie gekürzt; nur eine angemeldete Person
//      des Haushalts, die volles Mitglied ist (Rolle „nur Business“ liest nur — Kevin 13.10. „Nur lesen + Entwürfe“; Dienstweg 403), Bau-Kennung. Bestände `kampagnen-vorlagen--<h>` / `event-vorlagen--<h>` (lib/crm/vorlagen-anpassung-server.ts).
// Wirkung: Kampagnen planen, Heads/ZOE `kampagne`, Event anlegen und die Stellschrauben im Steckbrief der Prozesse lesen sofort die neuen Vorlagen.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { kontoSicht } from '@/lib/zugang/konto-sicht-server';
import { NUR_LESEN } from '@/lib/crm/nur-business';
import { PLAYBOOKS } from '@/lib/crm/kampagnen';
import { VORLAGEN } from '@/lib/crm/eventplanung';
import { VORLAGEN_GRENZEN, EVENT_RECHT, playbookHinweise, type VorlagenArt } from '@/lib/crm/vorlagen-regeln';
import { playbooksAus, eventVorlagenAus, type VorlagenOp } from '@/lib/crm/vorlagen-anpassung';
import { playbookBestandLesen, eventBestandLesen, vorlagenHaushalt, vorlagenSchreiben, vorlagenStand } from '@/lib/crm/vorlagen-anpassung-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });
const artAus = (v: unknown): VorlagenArt | null => (v === 'playbook' || v === 'event' ? v : null);

async function antwort(art: VorlagenArt) {
  const h = await vorlagenHaushalt();
  if (art === 'playbook') {
    const b = await playbookBestandLesen(h);
    const vorlagen = playbooksAus(b);
    return { art, vorlagen, standard: PLAYBOOKS, stand: vorlagenStand(b), hinweise: Object.fromEntries(vorlagen.map(p => [p.id, playbookHinweise(p)]).filter(([, l]) => (l as string[]).length)), grenzen: VORLAGEN_GRENZEN };
  }
  const b = await eventBestandLesen(h);
  return { art, vorlagen: eventVorlagenAus(b), standard: VORLAGEN, stand: vorlagenStand(b), recht: EVENT_RECHT, grenzen: VORLAGEN_GRENZEN };
}

/** Darf diese Person die Vorlagen ändern? Volle Mitglieder per Sitzung — die Rolle „nur Business“ liest nur. */
const darfAendern = async (z: { person?: string | null; dienst?: boolean }) => !z.dienst && !!(await kontoSicht(z.person ?? null))?.vollesMitglied;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nein(403, 'Nur im Haushalt des Inhabers.');
  const art = artAus(new URL(req.url).searchParams.get('art'));
  if (!art) return nein(400, 'art: playbook oder event.');
  return NextResponse.json({ ok: true, ...(await antwort(art)), aendern: await darfAendern(zugang) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nein(403, 'Nur im Haushalt des Inhabers.');
  if (zugang.dienst) return nein(403, 'Vorlagen ändert nur eine angemeldete Person von Hand.');
  if (!(await darfAendern(zugang))) return nein(403, NUR_LESEN);
  const alt = bauPruefen(req);
  if (alt) return alt;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const art = artAus(b?.art);
  if (!art) return nein(400, 'art: playbook oder event.');
  const op = { op: b.op, id: b.id, vorlage: b.vorlage, name: b.name } as VorlagenOp;
  if (!['speichern', 'kopieren', 'standard', 'loeschen'].includes(String(b.op))) return nein(400, 'op: speichern, kopieren, standard oder loeschen.');
  // Segment-Vorschlag: nur ein gespeichertes, nicht gelöschtes Segment (die Zielgruppe kommt dann aus ihm).
  const segmente = art === 'playbook' && b.op === 'speichern'
    ? new Set((await (await import('@/lib/crm/speicher')).ladeCrm()).segmente.filter(s => !s.geloeschtAm).map(s => s.id))
    : undefined;
  const r = await vorlagenSchreiben(art, await vorlagenHaushalt(), { stand: b.stand, op, wer: werAus(req), ...(segmente ? { segmente } : {}) });
  if (!r.ok) return nein(r.status, r.fehler, r.stand ? { stand: r.stand } : {});
  return NextResponse.json({ ok: true, id: r.id, geaendert: r.geaendert, ...(await antwort(art)), aendern: true });
}
