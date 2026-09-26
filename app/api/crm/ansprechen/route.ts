// ─── MAKE OS — Wer ist heute dran? ──────────────────────────────────────────
// Die eine Frage, die das CRM beantwortet. Reine Regel, kein Modell:
// fällige Wiedervorlagen zuerst, dann Prio A, dann B — nur, wer erreichbar
// ist und einen Aufhänger hat.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { pipelineStand, type Kontakt } from '@/lib/make-one/crm';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/jarvis/raum';
import { ladeCrm } from '@/lib/crm/speicher';
import { werIstDran } from '@/lib/crm/heute';
import { ampel } from '@/lib/crm/recht';
import { fuerPerson } from '@/lib/make-one/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 24.09.: dieselbe Auswahl wie die Power Hour (lib/crm/heute.ts) — mit
// Kanal-Ampel statt der alten Kanalreihenfolge (die LinkedIn-Nachrichten bei
// Kaltkontakten vorschlug; die zählen als elektronische Post). Antwortform
// bleibt für Jarvis und den Crm-Agenten gleich.
export async function GET(req: Request) {
  const n = Math.max(1, Math.min(30, Number(new URL(req.url).searchParams.get('n')) || 10));
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const heute = localDay();
  const crm = await ladeCrm();
  const a = werIstDran(kontakte, crm, heute, personAus(req), n);
  const ziel = (k: Kontakt, kanal: string) => (kanal === 'telefon' ? k.telefon ?? k.sms : kanal === 'mail' ? k.email : k.linkedin) ?? '';
  const liste = a.karten.map(c => ({
    kontakt: fuerPerson(c.kontakt, personAus(req)), grund: c.gruende.join(' · '), kategorie: c.kategorie,
    kanaele: ampel(c.kontakt).filter(x => x.farbe !== 'rot').map(x => ({ art: x.kanal, ziel: ziel(c.kontakt, x.kanal), farbe: x.farbe, grund: x.grund })),
  }));
  return NextResponse.json({ heute, liste, stand: pipelineStand(kontakte), ausgefiltert: a.ausgefiltert });
}
