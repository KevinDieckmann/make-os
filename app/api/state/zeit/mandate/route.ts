// ─── MAKE OS — Zeit & Fokus: Zeit je Mandat (28.09.) ────────────────────────
// Kevin: „Mandat an Zielen und Zeit“ — Zeit je Mandat für Abrechnung und Auslastung.
// GET ?zeitraum=woche|monat&stichtag=YYYY-MM-DD → Stunden je Mandat („Firma · Titel“),
// je Person des Haushalts und gesamt; mit Monatshonorar ein grober Hinweis „≈ € je
// Stunde“ (kein Rechnungsbezug). Nur bewusste Business-Blöcke; Rechnung rein in
// lib/zeitmessung/mandate.ts. Auch die Mandatsakte liest hier „Zeit diesen Monat“.
// Zugang wie das CRM: nur im Haushalt des Inhabers mit benannter Person (Mandate
// und Firmennamen sind CRM-Daten). Gemerkt je Haushalt/Zeitraum, Schlüssel mit dem
// Stand der Blöcke (`zeit` ist Memo-Rauschen) und dem Stand des CRM.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { speicherStand } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { CRM_SPEICHER } from '@/lib/crm/speicher';
import { ladeZeit, zeitBloeckeStand } from '@/lib/zeitmessung/speicher';
import { berlinTag, type Zeitraum } from '@/lib/zeitmessung/einheiten';
import { zeitJeMandat } from '@/lib/zeitmessung/mandate';
import { zeitPersonenVon } from '@/lib/zeitmessung/personen';
import { mandateKurz } from '@/lib/planung/mandat-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, error: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const url = new URL(req.url);
  const zeitraum: Zeitraum = url.searchParams.get('zeitraum') === 'monat' ? 'monat' : 'woche';
  const s = url.searchParams.get('stichtag');
  const stichtag = s && TAG.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`)) ? s : berlinTag(new Date().toISOString());
  const { schluessel, personen } = await zeitPersonenVon(zugang.person);
  const crmStand = await speicherStand([CRM_SPEICHER]);
  const daten = await merken(`zeit-mandate:${schluessel}:${zeitraum}:${stichtag}:${zeitBloeckeStand()}:${crmStand}`, 60_000, async () => {
    const [mandate, dateien] = await Promise.all([mandateKurz(), Promise.all(personen.map(p => ladeZeit(p.person)))]);
    return zeitJeMandat(personen.map((p, i) => ({ ...p, datei: dateien[i] })), mandate, zeitraum, stichtag);
  });
  return NextResponse.json({ ok: true, ich: zugang.person, ...daten }, { headers: { 'Cache-Control': 'no-store' } });
}
