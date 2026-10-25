// ─── MAKE OS — Aufgaben: CRM-Verweise für die Schnellsuche (28.09. abends) ──
// Die Aufgaben-Seite verknüpft eine Aufgabe mit Kontakt, Firma, Mandat oder Deal. Dafür braucht sie nur Kennung
// und Namen — nicht die ganze Kartei (keine Adressen, keine Zahlungsdaten, keine Notizen). Eingeschränkte
// Kontakte (Art. 18) erscheinen nicht. Zugang wie Kartei/Aufgaben: Haushalt des Inhabers.
// Werkstatt Runde 4 (25.10., Bau-Test 3: „Echtes Mandat“ zeigte das Produkt nicht): mit `?fall=1` (Probelauf, Tests, Läufe) je Eintrag ein Merkmal zum passenden
// Wählen — Mandat: Produkt, Deal: Stufe, Lead: Status (nur Namen, nie mehr). Ohne den Parameter bleibt die Antwort, wie sie war.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { ladeCrm } from '@/lib/crm/speicher';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import { STUFEN } from '@/lib/crm/pipeline';
import { leads, statusLabel } from '@/lib/crm/leads';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const [kartei, crm] = await Promise.all([loadJson<{ kontakte?: Kontakt[] }>('kontakte'), ladeCrm()]);
  const firmenName = new Map(crm.firmen.map(f => [f.id, f.name]));
  if (new URL(req.url).searchParams.get('fall') === '1') return NextResponse.json(mitMerkmal(alleVerweise(kartei?.kontakte, crm, firmenName), kartei?.kontakte, crm));
  return NextResponse.json(alleVerweise(kartei?.kontakte, crm, firmenName));
}

function alleVerweise(kontakte: Kontakt[] | undefined, crm: Awaited<ReturnType<typeof ladeCrm>>, firmenName: Map<string, string>): CrmVerweise {
  return {
    kontakte: (Array.isArray(kontakte) ? kontakte : []).filter(k => !k.eingeschraenkt).map(k => ({ id: k.id, name: anzeigename(k), ...(k.firmaId ? { firmaId: k.firmaId } : {}), ...(k.firma ? { firma: k.firma } : {}) })),
    firmen: crm.firmen.map(f => ({ id: f.id, name: f.name })),
    mandate: crm.mandate.map(m => ({ id: m.id, titel: m.titel, kunde: (m.firmaId && firmenName.get(m.firmaId)) || m.kunde, status: m.status, ...(m.firmaId ? { firmaId: m.firmaId } : {}), ...(m.zustaendig ? { zustaendig: m.zustaendig } : {}) })),
    deals: crm.chancen.map(c => ({ id: c.id, titel: c.titel, stufe: c.stufe, ...(c.firmaId ? { firmaId: c.firmaId } : {}), ...((c.firmaId && firmenName.get(c.firmaId)) || c.firma ? { firma: (c.firmaId && firmenName.get(c.firmaId)) || c.firma } : {}) })),
  };
}

/** Das Merkmal je Fall (nur Namen): Produkt des Mandats, Stufe des Deals, Status des Leads (wie der Motor ihn liest — `leads`, ohne eingeschränkte Personen). */
function mitMerkmal(v: CrmVerweise, kontakte: Kontakt[] | undefined, crm: Awaited<ReturnType<typeof ladeCrm>>): CrmVerweise {
  const produkt = new Map(crm.leistungen.map(l => [l.id, l.name]));
  const stufe = new Map(STUFEN.map(s => [s.id as string, s.label]));
  const status = new Map(leads((Array.isArray(kontakte) ? kontakte : []).filter(k => !k.eingeschraenkt), crm, localDay()).map(z => [z.id, statusLabel(z.status)]));
  return {
    kontakte: v.kontakte.map(k => (status.has(k.id) ? { ...k, leadStatus: status.get(k.id)! } : k)),
    firmen: v.firmen.map(f => (status.has(f.id) ? { ...f, leadStatus: status.get(f.id)! } : f)),
    mandate: v.mandate.map(m => { const x = crm.mandate.find(y => y.id === m.id)?.leistungId; return x && produkt.has(x) ? { ...m, produkt: produkt.get(x)! } : m; }),
    deals: v.deals.map(d => (stufe.has(d.stufe) ? { ...d, stufeName: stufe.get(d.stufe)! } : d)),
  };
}
