// ─── MAKE OS — Zeit & Fokus: Zeit je Mandat (28.09.) ────────────────────────
// Kevin: „Mandat an Zielen und Zeit“ — Zeit je Mandat für Abrechnung und Auslastung.
// GET ?zeitraum=woche|monat&stichtag=YYYY-MM-DD → Stunden je Mandat („Firma · Titel“),
// je Person des Haushalts und gesamt; mit Monatshonorar ein grober Hinweis „≈ € je
// Stunde“ (kein Rechnungsbezug). Nur bewusste Business-Blöcke; Rechnung rein in
// lib/zeitmessung/mandate.ts. Auch die Mandatsakte liest hier „Zeit diesen Monat“.
// Zugang wie das CRM: nur im Haushalt des Inhabers mit benannter Person (Mandate
// und Firmennamen sind CRM-Daten). Gemerkt je Haushalt/Zeitraum, Schlüssel mit dem
// Stand der Blöcke (`zeit` ist Memo-Rauschen) und dem Stand des CRM.
// `?sicht=privat|business` (10.10., Fokus-Seite): NUR die Arbeit dieses Bereichs — Business ohne Mandate einer Privat-Einheit, Privat nur
// die Arbeit der Privat-Einheiten; Konto „nur Business“ immer Business (Privat → 403).

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
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';

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
  // Konten ohne Privatzugang: nur Business-Blöcke (die Arbeit der Selbstständigkeit gehört zu Privat, 05.10. abends).
  const nurBusiness = (await planZugangFuer(zugang.person))?.sicht === 'business';
  const sicht = url.searchParams.get('sicht');
  if (sicht !== null && sicht !== 'privat' && sicht !== 'business') return NextResponse.json({ ok: false, error: 'sicht privat|business.' }, { status: 400 });
  if (sicht === 'privat' && nurBusiness) return NextResponse.json({ ok: false, error: 'Mit Business-Zugang gibt es keine Privat-Zeit.' }, { status: 403 });
  const daten = await merken(`zeit-mandate:${schluessel}:${nurBusiness ? 'b' : 'p'}:${sicht ?? '-'}:${zeitraum}:${stichtag}:${zeitBloeckeStand()}:${crmStand}`, 60_000, async () => {
    const [mandate, dateien] = await Promise.all([mandateKurz(), Promise.all(personen.map(p => ladeZeit(p.person)))]);
    return zeitJeMandat(personen.map((p, i) => ({ ...p, datei: dateien[i] })), mandate, zeitraum, stichtag, nurBusiness, sicht ?? undefined);
  });
  return NextResponse.json({ ok: true, ich: zugang.person, ...daten }, { headers: { 'Cache-Control': 'no-store' } });
}
