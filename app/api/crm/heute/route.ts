// ─── CRM — Wer ist heute dran? (Power Hour) ─────────────────────────────────
// GET ?n=12 → Karten für die anfragende Person (Kevin oder Malin): Kategorie,
// Gründe mit Punkten, bester zulässiger Kanal, die ganze Kanal-Ampel, die
// letzten Interaktionen. Reine Regel (lib/crm/heute.ts), kein Modell.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { werIstDran, KATEGORIEN } from '@/lib/crm/heute';
import { ampel } from '@/lib/crm/recht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const n = Math.max(3, Math.min(30, Number(new URL(req.url).searchParams.get('n')) || 12));
  const person = personAus(req);
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const a = werIstDran(kontakte, crm, heute, person, n);
  const mandatJe = new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds));
  return NextResponse.json({
    ok: true, heute, person, kategorien: KATEGORIEN, ausgefiltert: a.ausgefiltert,
    karten: a.karten.map(c => {
      const k = c.kontakt;
      return {
        id: k.id, name: anzeigename(k), firma: k.firma, position: k.position ?? k.jobtitel, kategorie: c.kategorie, punkte: c.punkte, gruende: c.gruende,
        kanal: c.kanal, ampel: ampel(k, { hatMandat: mandatJe.has(k.id), hatChance: !!c.chance }),
        telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin, aufhaenger: k.aufhaenger, kreis: k.kreis, stufe: k.stufe,
        anrede: k.anrede, naechsterSchritt: k.naechsterSchritt, letzterKontakt: k.letzterKontakt,
        letzte: (k.aktivitaeten ?? []).slice(-3).reverse(), chance: c.chance ? { id: c.chance.id, titel: c.chance.titel, stufe: c.chance.stufe } : undefined, bezug: c.bezug,
      };
    }),
    // Die Sitzungen der letzten Wochen — für Serie und Zähler.
    sitzungen: crm.sitzungen.filter(s => s.person === person).slice(-30),
  });
}
