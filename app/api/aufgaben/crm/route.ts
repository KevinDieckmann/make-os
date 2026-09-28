// ─── MAKE OS — Aufgaben: CRM-Verweise für die Schnellsuche (28.09. abends) ──
// Die Aufgaben-Seite verknüpft eine Aufgabe mit Kontakt, Firma, Mandat oder Deal. Dafür braucht sie nur Kennung
// und Namen — nicht die ganze Kartei (keine Adressen, keine Zahlungsdaten, keine Notizen). Eingeschränkte
// Kontakte (Art. 18) erscheinen nicht. Zugang wie Kartei/Aufgaben: Haushalt des Inhabers.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { ladeCrm } from '@/lib/crm/speicher';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const [kartei, crm] = await Promise.all([loadJson<{ kontakte?: Kontakt[] }>('kontakte'), ladeCrm()]);
  const firmenName = new Map(crm.firmen.map(f => [f.id, f.name]));
  const antwort: CrmVerweise = {
    kontakte: (Array.isArray(kartei?.kontakte) ? kartei!.kontakte : []).filter(k => !k.eingeschraenkt).map(k => ({ id: k.id, name: anzeigename(k), ...(k.firmaId ? { firmaId: k.firmaId } : {}), ...(k.firma ? { firma: k.firma } : {}) })),
    firmen: crm.firmen.map(f => ({ id: f.id, name: f.name })),
    mandate: crm.mandate.map(m => ({ id: m.id, titel: m.titel, kunde: (m.firmaId && firmenName.get(m.firmaId)) || m.kunde, status: m.status, ...(m.firmaId ? { firmaId: m.firmaId } : {}) })),
    deals: crm.chancen.map(c => ({ id: c.id, titel: c.titel, stufe: c.stufe, ...(c.firmaId ? { firmaId: c.firmaId } : {}), ...((c.firmaId && firmenName.get(c.firmaId)) || c.firma ? { firma: (c.firmaId && firmenName.get(c.firmaId)) || c.firma } : {}) })),
  };
  return NextResponse.json(antwort);
}
