// ─── Follow-up = Aufgabe (29.09., #99) — Server-Teil ─────────────────────────
// Die reinen Regeln (auch im Browser genutzt) liegen in ./followup-aufgabe.ts. Hier: der Abgleich in beide Richtungen.

import type { TasksState } from '@/types/tasks';
import type { FollowUp } from './typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { neuErledigt, followupsErledigen, aufgabenFuerAktivitaet, type AufgabeAktivitaet } from './followup-aufgabe';

/**
 * Nach jedem Aufgaben-Schreiben: erledigte Aufgaben → ihre offenen Follow-ups erledigt, und (08.10., 4.7) eine Aktivität am Kontakt der
 * Aufgabe (`aufgabenFuerAktivitaet`). Wirft nie (das Schreiben der Aufgabe steht schon).
 */
export async function followupsNachAufgaben(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>, person: string): Promise<number> {
  const fertig = neuErledigt(vorher, nachher);
  if (!fertig.length) return 0;
  const wer = { art: person === 'system' ? 'system' as const : 'person' as const, ...(person !== 'system' ? { person } : {}) };
  let n = 0;
  let followupsVorher: FollowUp[] = [];
  let erledigtJetzt: string[] = [];
  try {
    const { ladeCrm, aendereCrm } = await import('./speicher');
    const c0 = await ladeCrm();
    followupsVorher = c0.followups ?? [];
    if (followupsVorher.some(f => f.aufgabeId && fertig.includes(f.aufgabeId) && f.status === 'offen')) {
      const jetzt = new Date().toISOString();
      await aendereCrm(c => { const r = followupsErledigen(c, fertig, person, jetzt); n = r.erledigt.length; erledigtJetzt = r.erledigt; return r.crm; }, wer);
    }
  } catch (e) {
    console.error('[followup-aufgabe] Follow-ups nicht nachgezogen:', e instanceof Error ? e.message : e);
  }
  await aktivitaetenNachAufgaben(aufgabenFuerAktivitaet(vorher, nachher, followupsVorher, erledigtJetzt), person);
  return n;
}

/**
 * Die Aktivitäten erledigter Aufgaben an den Kontakten (4.7) — EINE Kartei-Sperre, idempotent über `aufgabeId`. Eine Notiz „Aufgabe
 * erledigt: …“ (kein behauptetes Gespräch); die Kadenz läuft ab heute neu (`letzterKontakt`, nie zurück). Nie an eingeschränkten Personen
 * (Art. 18) oder mit Werbesperre. Wirft nie.
 */
export async function aktivitaetenNachAufgaben(liste: readonly AufgabeAktivitaet[], person: string): Promise<number> {
  if (!liste.length) return 0;
  try {
    const [{ aendereKontakte }, { wendeAktivitaetAn }, { localDay, tagePlus }] = await Promise.all([import('./kartei-schreiben'), import('@/lib/make-one/crm'), import('@/lib/zeit')]);
    const heute = localDay();
    const jetzt = new Date().toISOString();
    const von = /^[a-z0-9-]{1,40}$/.test(person) ? person : 'system';
    let n = 0;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      let geaendert = false;
      const kontakte = f.kontakte.map(k => {
        const meine = liste.filter(a => a.kontaktId === k.id && !(k.aktivitaeten ?? []).some(x => x.aufgabeId === a.aufgabeId));
        if (!meine.length || k.eingeschraenkt || k.werbesperre) return k;
        let neu = k;
        for (const a of meine) neu = wendeAktivitaetAn(neu, { art: 'notiz', text: `Aufgabe erledigt: ${a.titel}`.slice(0, 3000), von, aufgabeId: a.aufgabeId }, heute, jetzt, tagePlus);
        // Kadenz zurück: die erledigte Aufgabe war der Anlass an dieser Person — „letzter Kontakt“ ist heute (nie zurück).
        n += meine.length; geaendert = true;
        return { ...neu, letzterKontakt: !k.letzterKontakt || k.letzterKontakt < heute ? heute : k.letzterKontakt, geaendertAm: heute };
      });
      return geaendert ? { ...f, kontakte } : f;
    }, { art: von === 'system' ? 'system' : 'person', ...(von !== 'system' ? { person: von } : {}) });
    return n;
  } catch (e) {
    console.error('[followup-aufgabe] Aktivität nicht festgehalten:', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Follow-up erledigt → die verknüpfte Aufgabe erledigt (über den Aufgaben-Schreibweg, Verlauf „durch System“). Idempotent. */
export async function aufgabeErledigenNachFollowUp(f: Pick<FollowUp, 'aufgabeId'>, person: string): Promise<boolean> {
  if (!f.aufgabeId) return false;
  try {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const id = f.aufgabeId;
    const r = await systemAufgabenAendern(stand => {
      const t = stand.tasks.find(x => x.id === id);
      return t && t.status !== 'done' && t.status !== 'cancelled' && !t.geloeschtAm ? { teile: [{ id, felder: { status: 'done' } }] } : {};
    }, { person });
    return r.ok;
  } catch (e) {
    console.error('[followup-aufgabe] Aufgabe nicht erledigt:', e instanceof Error ? e.message : e);
    return false;
  }
}
