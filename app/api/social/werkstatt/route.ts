// ─── MAKE OS — Social: Reel-Werkstatt (28.10.2026, Malin-Paket) ───────────────────────────────────────────────────────────────────────
// GET  → Aufträge, die diese Person sieht (wie Social: Haushalt des Inhabers, „nur ich“-Kanäle nur ihre Person), dazu je Quelle Art/Länge/Ton
//        und ob Rendern/Untertitel auf dieser Instanz gehen (nur ja/nein).
// POST { aktion } — nur eine angemeldete Person (Dienstweg 403), Bau-Kennung:
//   anlegen { titel?, ziel, format?, kanalId?, folgeId?, medien[] } · aendern { id, stand, felder } · transkript { id, stand, mediumId, segmente }
//   untertitel { id, stand } (Spracherkennung auf dem Server einreihen) · vorschlagen { id } (KI, `modellSchranke`) · vorschlag-uebernehmen
//   { id, stand } · rendern { id, stand } · weg { id, stand }.
// Ergebnis = neues Medium in der Ablage; rausgehen darf es erst nach der Freigabe eines Menschen (Medien-Ablage, Kanal „Social Media“).
import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { modellSchranke } from '@/lib/zugang/umfang';
import { ladeSocial } from '@/lib/social/server';
import { socialFuerPerson } from '@/lib/social/daten';
import { werkstattPruefen } from '@/lib/social/werkstatt/regeln';
import {
  ladeWerkstatt, auftragSichtbar, quellenLesen, werkstattSchreiben, werkstattAnstossen, werkstattBereit, vorschlagAblegen, auftragStand, type WerkstattOp,
} from '@/lib/social/werkstatt/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (status: number, text: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

async function lage(person: string) {
  const social = await ladeSocial();
  const auftraege = (await ladeWerkstatt()).filter(a => auftragSichtbar(a, social, person));
  const quellen = await quellenLesen(person, auftraege.flatMap(a => [...a.clips.map(c => c.mediumId)]));
  return {
    auftraege: auftraege.map(a => ({ ...a, stand: auftragStand(a), pruefung: werkstattPruefen(a, quellen) })),
    quellen: Object.fromEntries(quellen),
    bereit: await werkstattBereit(),
  };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  return NextResponse.json({ ok: true, ...(await lage(z.person)) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (z.dienst) return fehler(403, 'Die Werkstatt bedient nur eine angemeldete Person — nicht ZOE, nicht der Takt.');
  const bau = bauPruefen(req); if (bau) return bau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 600_000); } catch (e) { return jsonZuGross(e) ?? fehler(400, 'Kein JSON.'); }
  const id = typeof b.id === 'string' ? b.id : '';
  const stand = typeof b.stand === 'string' ? b.stand : '';
  let op: WerkstattOp;
  switch (b.aktion) {
    case 'anlegen': op = { op: 'anlegen', titel: b.titel, ziel: b.ziel, format: b.format, kanalId: b.kanalId, folgeId: b.folgeId, medien: b.medien }; break;
    case 'aendern': op = { op: 'aendern', id, stand, felder: (b.felder && typeof b.felder === 'object' ? b.felder : {}) as Record<string, unknown> }; break;
    case 'transkript': op = { op: 'transkript', id, stand, mediumId: String(b.mediumId ?? ''), segmente: b.segmente, sprache: b.sprache }; break;
    case 'vorschlag-uebernehmen': op = { op: 'vorschlag-uebernehmen', id, stand }; break;
    case 'untertitel': op = { op: 'arbeit', id, stand, art: 'transkript' }; break;
    case 'rendern': op = { op: 'arbeit', id, stand, art: 'render' }; break;
    case 'weg': op = { op: 'weg', id, stand }; break;
    case 'vorschlagen': {
      const schranke = modellSchranke(req); if (schranke) return schranke;
      const social = await ladeSocial();
      const a = (await ladeWerkstatt()).find(x => x.id === id && auftragSichtbar(x, social, z.person));
      if (!a) return fehler(404, 'Auftrag nicht gefunden.');
      const sicht = socialFuerPerson(social, z.person);
      const kanal = sicht.kanaele.find(k => k.id === a.kanalId) ?? null;
      const folge = a.folgeId ? sicht.folgen.find(f => f.id === a.folgeId) : undefined;
      const format = folge?.formatId ? sicht.formate.find(f => f.id === folge.formatId) ?? null : null;
      const { schnittVorschlagen } = await import('@/lib/social/werkstatt/vorschlag');
      const r = await schnittVorschlagen(a, await quellenLesen(z.person, a.clips.map(c => c.mediumId)), kanal, format, z.person);
      if (!r.ok) return fehler(409, r.fehler);
      await vorschlagAblegen(a.id, r.vorschlag);
      return NextResponse.json({ ok: true, ki: true, ...(await lage(z.person)) });
    }
    default: return fehler(400, 'aktion: anlegen, aendern, transkript, untertitel, vorschlagen, vorschlag-uebernehmen, rendern, weg.');
  }
  if (op.op === 'arbeit') {
    // Rendern nur, was renderbar ist — Gründe vorab (dieselbe Prüfung wie der Lauf).
    const social = await ladeSocial();
    const a = (await ladeWerkstatt()).find(x => x.id === id && auftragSichtbar(x, social, z.person));
    if (!a) return fehler(404, 'Auftrag nicht gefunden.');
    const bereit = await werkstattBereit();
    if (op.art === 'render' && !bereit.rendern) return fehler(409, 'Rendern ist auf dieser Instanz noch nicht eingerichtet (ffmpeg fehlt — UPDATES.md).');
    if (op.art === 'transkript' && !bereit.untertitel) return fehler(409, 'Untertitel sind auf dieser Instanz noch nicht eingerichtet (Sprachmodell fehlt — UPDATES.md).');
    if (op.art === 'render') {
      const g = werkstattPruefen(a, await quellenLesen(z.person, a.clips.map(c => c.mediumId)));
      if (g.length) return fehler(400, g[0]);
    }
  }
  const r = await werkstattSchreiben(z.person, op);
  if (!r.ok) return fehler(r.status, r.fehler, r.aktuell ? { aktuell: r.aktuell } : {});
  await protokolliere('social', [{ liste: 'werkstatt', op: op.op === 'anlegen' ? 'neu' : op.op === 'weg' ? 'geloescht' : 'geaendert', id: r.auftrag?.id ?? id }], werAus(req)).catch(() => {});
  if (op.op === 'arbeit') werkstattAnstossen();
  return NextResponse.json({ ok: true, ...(r.auftrag ? { auftrag: r.auftrag.id } : {}), ...(await lage(z.person)) });
}
