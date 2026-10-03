// ─── Gmail — eine Mail mit Thread und Text (03.10.2026) ──────────────────────
// GET ?id=<Nachrichten-Kennung> → { ok, thread: [{ kopf, text }], zuordnung, empfaenger: { an, cc }, aliase }
// Nur aus dem EIGENEN Spiegel; der Text ist reiner Text (nie HTML), der Aufrufer rendert ihn als Text (React maskiert). Anhänge nur als
// Metadaten (Abruf: /api/gmail/anhang). Bilder aus HTML werden nie geladen. Dienstweg und andere Konten: 403.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { ladeGmailStand, ladeGmailTexte, threadVon } from '@/lib/gmail/stand';
import { zuordnungenFuer, eigeneAdressen } from '@/lib/gmail/zuordnung';
import { antwortEmpfaenger } from '@/lib/gmail/senden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9]{6,40}$/.test(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  const stand = await ladeGmailStand(z.person);
  const kopf = stand?.koepfe[id];
  if (!stand || !kopf) return NextResponse.json({ ok: false, fehler: 'Diese Mail gibt es nicht (mehr).' }, { status: 404 });
  const thread = threadVon(stand.koepfe, kopf.threadId);
  const texte = (await ladeGmailTexte(z.person)).texte;
  const zuordnung = await zuordnungenFuer(thread, stand);
  const letzte = thread[thread.length - 1];
  const eigene = eigeneAdressen(stand);
  return NextResponse.json({
    ok: true,
    thread: thread.map(k => ({ kopf: k, text: texte[k.id]?.t ?? k.ausschnitt, ...(zuordnung[k.id] ? { zuordnung: zuordnung[k.id] } : {}) })),
    // Antwort bezieht sich auf die gewählte Nachricht (Standard: die jüngste im Thread).
    antwortAuf: kopf.id,
    empfaenger: { antworten: antwortEmpfaenger(kopf, eigene, false), allen: antwortEmpfaenger(kopf, eigene, true) },
    juengste: letzte?.id,
    aliase: (stand.aliase ?? []).filter(a => a.verifiziert), eigene: stand.email,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
