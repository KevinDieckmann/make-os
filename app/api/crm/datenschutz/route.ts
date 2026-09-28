// ─── CRM — Betroffenenrechte ────────────────────────────────────────────────
// GET  ?id=…  → Auskunft nach Art. 15: alles, was wir über die Person haben
//              (Kartei, Firma, alle CRM-Listen, Dateiablage nur als Metadaten,
//              Import-Konflikte, Head-Vorschläge, Termine, Aufgaben) als JSON-Datei.
// POST { id, grund } → Löschen nach Art. 17: Person raus aus ALLEN Speichern
//              (lib/crm/person-bestaende.ts, 28.09.). Ins Löschprotokoll kommt nur Kennung,
//              Datum und Grund — keine Personendaten. Eine Werbesperre ist
//              meist die bessere Wahl (Art. 21): dann bleibt „nicht anschreiben“
//              erhalten. Deshalb fragt die Oberfläche das vorher ab.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { fuerPerson } from '@/lib/make-one/crm';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { personAufzaehlen, personEntfernen } from '@/lib/crm/person-bestaende';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === id);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  const crm = await ladeCrm();
  const auskunft = {
    erstellt: new Date().toISOString(), verantwortlich: 'Kevin Dieckmann (KD Ventures / Kevin Dieckmann Consulting)',
    // Private Notizen sieht nur, wer sie schrieb — auch in der Auskunft (26.09.).
    // IBAN (Entscheidung 28.09., H4): Die Auskunft nach Art. 15 enthält die volle IBAN, wenn sie zur Person
    // gehört (Kontakt.zahlung — nur bei Personen ohne Firma). Die IBAN einer Firma ist kein Datum der Person:
    // sie steht hier nur maskiert, wie überall sonst im Browser.
    person: fuerPerson(k, personStreng(req) ?? '', { ibanVoll: true }), firma: (() => { const f = k.firmaId ? crm.firmen.find(x => x.id === k.firmaId) : undefined; return f ? { ...f, ...(f.zahlung ? { zahlung: zahlungMaskiert(f.zahlung) } : {}) } : null; })(),
    // Alle Speicher aus einer Stelle (28.09., lib/crm/person-bestaende.ts): CRM-Listen, Dateiablage (nur Metadaten),
    // Import-Konflikte, Head-Vorschläge, kommender Termin, eindeutig zugeordnete Aufgaben.
    ...(await personAufzaehlen(id)),
  };
  return new Response(JSON.stringify(auskunft, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Auskunft-Art15-${id}-${localDay()}.json"` } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  // Regel 5 (28.09., K1): Das Löschprotokoll nennt, WER gelöscht hat — nur mit ausdrücklicher Person, nie „kevin“ als Rückfall.
  const von = personStreng(req);
  if (!von) return NextResponse.json({ ok: false, fehler: 'Löschen nur mit angemeldeter Person.' }, { status: 401 });
  let b: { id?: string; grund?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '');
  if (!id) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  // Aus ALLEN Speichern — eine Stelle kennt sie (lib/crm/person-bestaende.ts, 28.09.). Idempotent: ein zweiter Lauf
  // (etwa nach einem Abbruch) räumt Reste auf, auch wenn die Kartei die Person schon nicht mehr kennt.
  const bericht = await personEntfernen(id);
  if (!Object.keys(bericht.speicher).length) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  await updateJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll', cur => ({ eintraege: [...(cur?.eintraege ?? []), { id, datum: localDay(), grund: String(b.grund ?? 'Art. 17 DSGVO').slice(0, 200), von }] }));
  return NextResponse.json({ ok: true, speicher: bericht.speicher, aufgabenPruefen: bericht.aufgabenPruefen });
}
