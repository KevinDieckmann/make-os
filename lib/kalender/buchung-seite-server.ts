// ─── Kalender — eine Buchungsseite anlegen oder ändern: die EINE Schreibstelle (Server; Restpunkte 24.10., herausgelöst aus app/api/kalender/buchung) ────────
// Bis 24.10. stand diese Logik nur in der Route (Aktion `seite`). Seit die Maske im Steckbrief der Prozesse (lib/prozesse/stellschrauben-weiter-server.ts)
// einzelne Felder einer Seite ändert, gibt es EINE Funktion für beide — gleiche Prüfungen, gleiche Sperre, gleiches Protokoll:
//   · `seite.person` muss im Haushalt des Inhabers sein (S1 #13), sonst 400
//   · ändern nur auf der gelesenen Fassung (`stand` = `geaendert`, S1 #15), sonst 409; unbekannte Seite 404; höchstens `GRENZEN.seiten` Seiten (413)
//   · `seiteSauber` (Titel, Fenster, Zielkalender, Verantwortlicher — Einrichtung zählt) — ein Satz bei 400
//   · Protokoll `buchungProtokoll` mit `wer` (nur Kennungen)
// Rechte (Haushalt des Inhabers, nie Dienstweg) prüft der AUFRUFER (Route bzw. Weiterleiter) vorher — hier nur die Fachregeln.

import { neueKennung } from '@/lib/kennung';
import { seiteSauber, GRENZEN, type BuchungsSeite } from './buchung';
import { aendereBuchungBestand, buchungProtokoll, neuerSlug } from './buchung-speicher';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { datenschutzOeffentlichLaden } from '@/lib/datenschutz/einrichtung-server';
import type { Wer } from '@/lib/store/aenderungsprotokoll';

const ID = /^[a-z]{1,4}-[a-z0-9-]{8,80}$/;

export type SeiteErgebnis = { ok: true; seite: BuchungsSeite; neu: boolean } | { ok: false; status: 400 | 404 | 409 | 413; fehler: string };

/** Eine Seite anlegen (`roh.id` fehlt) oder ändern (`roh.id` + `stand`). `person` = wer ändert (aus dem Zugang des Aufrufers). */
export async function seiteSpeichern(roh: Record<string, unknown>, o: { stand: string | null; person: string; wer: Wer; jetzt?: Date }): Promise<SeiteErgebnis> {
  const jetzt = o.jetzt ?? new Date();
  const jetztIso = jetzt.toISOString();
  const id = typeof roh.id === 'string' && ID.test(roh.id) ? roh.id : null;
  // #13: die Seite bucht für eine Person — sie muss zum Haushalt des Inhabers gehören (sonst ginge ihre Belegung/Glocke ins Leere oder nach außen).
  const fuer = typeof roh.person === 'string' ? roh.person.trim() : '';
  if (!(await personImHaushaltDesInhabers(fuer))) return { ok: false, status: 400, fehler: 'Für wen ist die Seite? Nur für eine Person des Haushalts.' };
  let fehler = '', status: 400 | 404 | 409 | 413 = 400, gespeichert: BuchungsSeite | null = null;
  // Verantwortlicher (05.10.): steht er in der Einrichtung (System › Datenschutz), ist das Feld der Seite nur noch eine Abweichung.
  const einrichtung = !!(await datenschutzOeffentlichLaden()).verantwortlich;
  await aendereBuchungBestand(bs => {
    const vorher = id ? bs.seiten.find(s => s.id === id) : undefined;
    if (id && !vorher) { fehler = 'Buchungsseite nicht gefunden.'; status = 404; return bs; }
    // #15: nur auf der Fassung ändern, die gelesen wurde — sonst 409 (ein anderes Fenster, zwei Personen gleichzeitig).
    if (vorher && o.stand !== vorher.geaendert) { fehler = 'Die Seite wurde inzwischen geändert — bitte neu laden.'; status = 409; return bs; }
    if (!vorher && bs.seiten.length >= GRENZEN.seiten) { fehler = `Höchstens ${GRENZEN.seiten} Buchungsseiten.`; status = 413; return bs; }
    const titel = typeof roh.titel === 'string' ? roh.titel : '';
    const fest = vorher ? { id: vorher.id, slug: vorher.slug, angelegt: vorher.angelegt } : { id: neueKennung('bs'), slug: neuerSlug(titel), angelegt: jetztIso };
    const r = seiteSauber(roh, fest, o.person, jetztIso, { einrichtung });
    if (!r.ok) { fehler = r.fehler; return bs; }
    gespeichert = r.seite;
    return { ...bs, seiten: vorher ? bs.seiten.map(s => (s.id === vorher.id ? r.seite : s)) : [...bs.seiten, r.seite] };
  }, jetzt);
  if (!gespeichert) return { ok: false, status, fehler: fehler || 'Nicht gespeichert.' };
  const s = gespeichert as BuchungsSeite;
  await buchungProtokoll([{ liste: 'seiten', op: id ? 'geaendert' : 'neu', id: s.id }], o.wer);
  return { ok: true, seite: s, neu: !id };
}
