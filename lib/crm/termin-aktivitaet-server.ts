// ─── CRM — Termin → Aktivität „Meeting“ schreiben (Server, 30.09., Paket K3) ─
// Regeln: lib/crm/termin-aktivitaet.ts. Geschrieben wird die Kartei NUR über `aendereKontakte` (lib/crm/kartei-schreiben.ts,
// protokolliert ohne Werte), die Deal-Ampel über `aktivitaetImCrm` in EINER CRM-Sperre (Reihenfolge crm → kontakte:
// erst die Kartei, dann — außerhalb ihrer Sperre — das CRM). Aufgerufen aus /api/kalender/termin (Anlegen, Bezug
// ändern, Löschen) und aus dem Signal-Lauf (/api/crm/signale: Vorkommen von Serien, vergangene Meetings).

import { aendereKontakte } from './kartei-schreiben';
import { aendereCrm, ladeCrm } from './speicher';
import { aktivitaetImCrm } from './aktivitaet-folgen';
import { terminAktivitaeten, terminAktivitaetenEntfernen, terminVorbei, type TerminFuerCrm } from './termin-aktivitaet';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagePlus } from '@/lib/zeit';

/** Meeting-Aktivitäten zu einem Termin anlegen (idempotent). Liefert die Zahl neuer Aktivitäten und übersprungener (Art. 18). */
export async function terminAktivitaetenSetzen(t: TerminFuerCrm, wer: Wer, jetzt = new Date()): Promise<{ neu: number; eingeschraenkt: number }> {
  if (!t.kontaktIds.length) return { neu: 0, eingeschraenkt: 0 };
  const jetztIso = jetzt.toISOString(), heute = localDay(jetzt);
  let neu: string[] = [], eingeschraenkt: string[] = [];
  let geschrieben: Kontakt[] = [];
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const r = terminAktivitaeten(f.kontakte ?? [], t, heute, jetztIso, tagePlus);
    neu = r.neu; eingeschraenkt = r.eingeschraenkt;
    geschrieben = r.kontakte.filter(k => r.neu.includes(k.id));
    return r.neu.length ? { ...f, kontakte: r.kontakte } : f;
  }, wer);
  // Deal-Ampel (letzte Aktivität am Deal) — nur, wenn das Meeting schon stattfand.
  const geplant = !terminVorbei(t.start, jetztIso);
  if (geschrieben.length && !geplant) {
    const von = t.von;
    const vorab = await ladeCrm();
    const folgen = geschrieben.map(k => ({ kontakt: k, ...(t.dealId ? { bezug: t.dealId } : {}), von, heute, jetzt: jetztIso, geplant }));
    if (folgen.some(e => aktivitaetImCrm(vorab, e).geaendert)) await aendereCrm(c => folgen.reduce((acc, e) => aktivitaetImCrm(acc, e).crm, c), wer);
  }
  return { neu: neu.length, eingeschraenkt: eingeschraenkt.length };
}

/** Meeting-Aktivitäten eines Termins entfernen (Termin fand nicht statt) — optional nur für einige Kontakte. */
export async function terminAktivitaetenLoeschen(id: string, wer: Wer, nur?: readonly string[]): Promise<number> {
  let weg = 0;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const r = terminAktivitaetenEntfernen(f.kontakte ?? [], id, nur ? new Set(nur) : undefined);
    weg = r.weg;
    return r.weg ? { ...f, kontakte: r.kontakte } : f;
  }, wer);
  return weg;
}
