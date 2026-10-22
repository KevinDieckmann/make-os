// ─── Prozesse — die Landkarte (Etappe A, 21.10.; research/prozesse/ANALYSE_100.md Punkte 1–4, 27, 74) ─────────────────────────────────────
// GET → alle Prozesse der Landkarte (System-Prozesse aus dem Register + Vorlagen aus dem Fulfillment) mit Steckbrief, Phasen, Schritten, Übergaben und
//       der Zahl der Fälle, wo es echte Daten gibt; dazu (22.10.) die gespeicherten Abweichungen „Landkarte anpassen“ (`anpassung`, `anpassungStand`).
//       Nur Business (Sicht Privat → 403), nur Haushalt des Inhabers (auch „nur Business“ liest), nur lesen — schreibt nie. ETag aus dem Inhalt
//       (304, wenn sich nichts geändert hat). Gerechnet in lib/prozesse/server.ts. Seit 22.10. tragen die System-Prozesse ihre Stellschrauben
//       (Werte aus den vorhandenen Beständen) und die Antwort `stellschraubenRechte` (was diese Person je Weg ändern darf — im ETag).
// POST { stand, ops } (22.10.) → „Landkarte anpassen“: Bereiche umbenennen/färben/anlegen, Kacheln zuordnen/beschriften/ausblenden, Reihenfolge, „Auf Vorgabe
//       zurück“ (lib/prozesse/landkarte-anpassung.ts). Tor wie die Werkstatt: nur per Sitzung (Dienstweg 403) mit Bau-Kennung, nur wer Entwürfe bauen darf
//       (403), Stand/409 mit der aktuellen Fassung, Grenzen 413 (nie gekürzt). Gespeichert werden nur Abweichungen (Bestand `prozesse-landkarte--<h>`).

import { NextResponse } from 'next/server';
import { prozesseZugang } from '@/lib/prozesse/zugang';
import { landkarteLesen } from '@/lib/prozesse/server';
import { stellschraubenRechte } from '@/lib/prozesse/stellschrauben-server';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { anpassungSchreiben, anpassungStand } from '@/lib/prozesse/landkarte-anpassung-server';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await prozesseZugang(req);
  if (z instanceof Response) return z;
  const daten = await landkarteLesen();
  // Stellschrauben (22.10.): was DIESE Person je Weg ändern darf — außerhalb des Merkers (der gilt je Haushalt), darum auch im ETag.
  const rechte = await stellschraubenRechte(req, z);
  // Fingerabdruck statt JSON (Kommas trennen If-None-Match — der ETag wäre nie wiedererkannt worden).
  const etag = etagAus('prozesse', `${daten.stand}-${fingerabdruck(rechte)}`);
  return unveraendert(req, etag) ?? jsonAntwort(req, { ok: true, ...daten, stellschraubenRechte: rechte }, etag);
}

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });

export async function POST(req: Request) {
  const z = await prozesseZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  if (!z.rechte.entwurf) return nein(403, 'Die Landkarte passen nur Personen im Haushalt an, die Prozesse bauen.');
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  // Die Kacheln der Vorgabe (ohne Anpassung) — nur über sie prüft der Schreibweg, was abweicht.
  const { prozesse } = await landkarteLesen();
  const r = await anpassungSchreiben(z.haushalt, { stand: b.stand, ops: b.ops, prozesse, person: z.person, jetzt: new Date().toISOString(), wer: werAus(req) });
  if (!r.ok) {
    const aktuell = 'aktuell' in r ? r.aktuell : null;
    return nein(r.status, r.fehler, aktuell ? { anpassung: aktuell, anpassungStand: anpassungStand(aktuell) } : {});
  }
  return NextResponse.json({ ok: true, geaendert: r.geaendert, anpassung: r.anpassung, anpassungStand: anpassungStand(r.anpassung) });
}
