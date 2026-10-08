// ─── CRM — Wer ist heute dran? (Power Hour) ─────────────────────────────────
// GET ?n=12 → Karten für die anfragende Person (Kevin oder Malin): Kategorie,
// Gründe mit Punkten, bester zulässiger Kanal, die ganze Kanal-Ampel, die
// letzten Interaktionen. Reine Regel (lib/crm/heute.ts), kein Modell.
// Zu zweit (25.09.): ?fuer=malin zeigt die Liste der anderen Person — nur zum
// Ansehen (beide sehen alles; festhalten kann jede/r nur in der eigenen Liste).
// Je Karte steht, wem sie gehört; dazu die Team-Zeile (Power Hours und echte
// Gespräche je Person, heute und sieben Tage).

import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { personAus } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import { anzeigename } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { werIstDran, karteGehoert, KATEGORIEN } from '@/lib/crm/heute';
import { teamZahlen } from '@/lib/crm/pipeline';
import { wer, BEIDE, haeltBeziehung, verantwortlich } from '@/lib/crm/team';
import { ampel } from '@/lib/crm/recht';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { aufgabenFuerPowerHour } from '@/lib/crm/followup-aufgabe';

/** Eine Nebenquelle darf die Power Hour nie umwerfen — ohne Aufgaben läuft sie wie bisher. */
async function sicher<T>(f: () => Promise<T>, ersatz: T): Promise<T> { try { return await f(); } catch { return ersatz; } }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const n = Math.max(3, Math.min(30, Number(q.get('n')) || 12));
  const ich = personAus(req);
  // Nur ein Team-Kürzel — „beide“ hat keine eigene Liste.
  const gewuenscht = wer(q.get('fuer'));
  const person = gewuenscht && gewuenscht !== BEIDE ? gewuenscht : ich;
  const heute = localDay();
  const kontakte = await kontakteFuerVerarbeitung(); // Art. 18 zentral (29.09.)
  const crm = await ladeCrm();
  // Fällige Aufgaben mit Kontakt-Bezug (08.10., 4.7) — aus der Aufgaben-Sicht der ANFRAGENDEN Person (fremde „nur ich“ nie).
  const aufgaben = await sicher(async () => aufgabenFuerPowerHour((await ladeAufgabenSicht(ich)).tasks, heute), []);
  const a = werIstDran(kontakte, crm, heute, person, n, aufgaben);
  const mandatJe = new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds));
  const bezugArt = (bezug?: string) => !bezug ? undefined
    : crm.mandate.some(m => m.id === bezug) ? 'mandat' as const
    : (crm.kampagnen ?? []).some(k => k.id === bezug) ? 'kampagne' as const
    : crm.events.some(e => e.id === bezug) ? 'event' as const : undefined;
  return NextResponse.json({
    ok: true, heute, person, ich, nurLesen: person !== ich, verantwortlich: verantwortlich('sales'),
    kategorien: KATEGORIEN, ausgefiltert: a.ausgefiltert,
    karten: a.karten.map(c => {
      const k = c.kontakt;
      return {
        id: k.id, name: anzeigename(k), firma: k.firma, position: k.position ?? k.jobtitel, kategorie: c.kategorie, punkte: c.punkte, gruende: c.gruende,
        kanal: c.kanal, ampel: ampel(k, { hatMandat: mandatJe.has(k.id), hatChance: !!c.chance }),
        telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin, aufhaenger: k.aufhaenger, kreis: k.kreis, stufe: k.stufe,
        anrede: k.anrede, naechsterSchritt: k.naechsterSchritt, letzterKontakt: k.letzterKontakt,
        letzte: (k.aktivitaeten ?? []).slice(-3).reverse(), chance: c.chance ? { id: c.chance.id, titel: c.chance.titel, stufe: c.chance.stufe } : undefined, bezug: c.bezug,
        // Wem die Karte gehört (Chance → Mandat → Kampagne → Einladung → Beziehung) und wer die Beziehung hält.
        gehoert: karteGehoert(c, crm), beziehung: haeltBeziehung(k), bezugArt: bezugArt(c.bezug),
        // Das echte Follow-up hinter der Karte (08.10., 4.1) — der Ergebnis-Knopf erledigt es mit.
        ...(c.followupId ? { followupId: c.followupId } : {}),
        // Die Aufgabe hinter der Karte (4.7) — der Ergebnis-Knopf erledigt sie mit.
        ...(c.aufgabe ? { aufgabeId: c.aufgabe.id } : {}),
      };
    }),
    // Die Sitzungen der letzten Wochen — für Serie und Zähler (der Person, deren Liste es ist).
    sitzungen: crm.sitzungen.filter(s => s.person === person).slice(-30),
    team: teamZahlen(kontakte, crm.sitzungen, heute),
  });
}
