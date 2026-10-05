// ─── Datenschutz-Selbstprüfung der Instanz (05.10.) ─────────────────────────
// GET → { selbstpruefung: Pruefpunkt[] } — dieselbe Prüfung wie unter Stammdaten › Übersicht (lib/crm/datenschutz.ts
// `selbstpruefung`), mit dem Umfeld außerhalb des CRM (lib/datenschutz/umfeld.ts). Nur im Haushalt des Inhabers. Liest nur.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { loadJson } from '@/lib/store/local-db';
import { ladeCrm } from '@/lib/crm/speicher';
import { ladeKonten } from '@/lib/zugang/konten';
import { selbstpruefung } from '@/lib/crm/datenschutz';
import { LOESCHFRISTEN_SPEICHER, fristenWirksam, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { datenschutzUmfeld } from '@/lib/datenschutz/umfeld';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const fristen = fristenWirksam(((await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {}).fristen);
  const konten = (await ladeKonten()).konten;
  const p = selbstpruefung(kontakte, crm, localDay(), { konten: konten.length, mitPasswort: konten.filter(k => !!k.hash).length }, fristen.kontakte, await datenschutzUmfeld());
  return NextResponse.json({ ok: true, selbstpruefung: p }, { headers: { 'Cache-Control': 'no-store' } });
}
