// ─── Markttraktion · „Person anlegen“ — der Schreibweg (09.10., Woche 2 · 1.8) ─────────────────────────────────────────────────
// `personAnlegen(eingabe, { weg, person })` — EINE Server-Funktion für Kartei, Firmenkarte, „+ Aktivität“, Prospecting und Make.One-Abend
// (Route POST /api/crm/person). Die Entscheidungen stehen in lib/crm/person-anlegen.ts (`ANLEGE_REGELN` je Weg). Reihenfolge (nie
// verschachtelt — erst crm, dann kontakte, dann crm):
//   1. Art. 18: trifft die Eingabe eine eingeschränkte Person (dieselbe Regel wie Netzwerken) → 409, nichts angelegt, kein Name in der Meldung
//   2. Dublette: gleiche Mail, oder Nummer UND Nachname → 409 mit der vorhandenen Person (nie doppelt); Name + Firma → angelegt, mit Hinweis
//   3. Firma: vorhanden verknüpfen, sonst neu (wenn der Weg Firmen anlegt); im Papierkorb → zurückgeholt (1.6)
//   4. Kontakt: idempotent über die Kennung; Sperrliste (Werbesperre bei Neuanlage, nicht blockiert), Datenschutz-Stempel, Bezüge, Server-Stempel
//   5. Follow-up aus dem „Nächsten Schritt“ (1.12), zuständig = wer die Beziehung hält
// Die Firma wird auch für die Anfrage gebraucht (`firmaSichern`, /api/crm/anfrage) — derselbe Weg.

import { anzeigename, saeubereKontakt, serverStempel, bezuegeSynchron, fuerPerson, type Kontakt } from '@/lib/make-one/crm';
import type { Firma, FollowUp } from './typen';
import { ladeCrm, aendereCrm } from './speicher';
import { aendereKontakte } from './kartei-schreiben';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { trifftEingeschraenkte } from './netzwerken';
import { sperrlisteLaden, neuanlageSperre, sperren } from './sperrliste';
import { datenschutzStempeln } from './datenschutz-stempel';
import { neuesFollowUp } from './followup';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import { ANLEGE_REGELN, personEntwurf, dublettePruefen, dublettenText, firmaPlanen, type PersonEingabe, type PersonWeg, type FirmaPlan } from './person-anlegen';
import { neueKennung, neueKontaktKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import type { Wer } from '@/lib/store/aenderungsprotokoll';

export type PersonAnlegenErgebnis =
  | { ok: true; kontaktId: string; neu: boolean; kontakt: Kontakt; firmaId?: string; firmaNeu?: boolean; followUpId?: string; hinweise: string[] }
  | { ok: false; status: number; fehler: string; dublette?: { id: string; name: string }; eingeschraenkt?: true };

/**
 * Die Firma zu einem Namen sichern (Anfrage, Person anlegen): vorhanden → verknüpfen; neu → anlegen; im Papierkorb → zurückholen (1.6).
 * Schreibt in EINER CRM-Sperre auf dem frischen Stand (zwei gleichzeitige Anlagen ergeben eine Firma). `null` ohne Namen.
 */
export async function firmaSichern(name: string | undefined, kontakt: { email?: string; webseite?: string }, wer?: Wer, zusatz: Partial<Pick<Firma, 'branche' | 'stadt' | 'mitarbeiter'>> = {}): Promise<FirmaPlan | null> {
  if (!(name ?? '').trim()) return null;
  const heute = localDay(), jetzt = new Date().toISOString();
  let plan: FirmaPlan | null = null;
  // `aendereCrm` arbeitet auf dem gespeicherten Bestand MIT Papierkorb (crmSchreiben) — die Sicht ohne Papierkorb ist, was alle sehen.
  await aendereCrm(b => {
    const sicht = b.firmen.filter(f => !f.geloeschtAm);
    plan = firmaPlanen(sicht, b.firmen, name, kontakt, heute, jetzt);
    if (!plan || plan.art === 'vorhanden') return b;
    const p = plan;
    // Zusatzangaben (Prospecting: Branche, Größe, Region) nur an einer NEUEN Firma — eine vorhandene behält, was dort steht.
    if (p.art === 'neu') p.firma = { ...p.firma, ...Object.fromEntries(Object.entries(zusatz).filter(([, v]) => typeof v === 'string' && v.trim())) };
    return { ...b, firmen: p.art === 'zurueck' ? b.firmen.map(f => (f.id === p.firma.id ? p.firma : f)) : [...b.firmen, p.firma] };
  }, wer);
  return plan as FirmaPlan | null;
}

/** Eine Person anlegen — der EINE Weg (siehe Kopf). `id`: feste Kennung (wiederholbar), sonst neu. */
export async function personAnlegen(e: PersonEingabe, o: { weg: PersonWeg; person: string | null; wer?: Wer; id?: string }): Promise<PersonAnlegenErgebnis> {
  const regel = ANLEGE_REGELN[o.weg];
  const heute = localDay(), jetzt = new Date().toISOString();
  const id = o.id ?? neueKontaktKennung();
  const hinweise: string[] = [];

  // 1 · Art. 18 — vor jeder Wirkung (auch keine Firma).
  const alle = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
  const schon = alle.find(k => k.id === id);
  // Wiederholung: steht schon. Die Antwort läuft wie jede andere durch `fuerPerson` (Nahtstellen 09.10.: vorher roh — fremde private Notiz
  // und volle IBAN gingen an den Browser, wenn die Kennung einer vorhandenen Person kam).
  if (schon) return { ok: true, kontaktId: id, neu: false, kontakt: fuerPerson(schon, o.person ?? ''), hinweise: [] };
  const merkmale = { vorname: e.vorname, nachname: e.nachname, firma: e.firma, email: e.email, telefon: e.telefon, mobil: e.mobil };
  if (trifftEingeschraenkte({ kontakt: merkmale }, alle, id)) return { ok: false, status: 409, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true };
  // 2 · Dublette (gleiche Mail oder Nummer + Nachname) — nie doppelt anlegen.
  const d = dublettePruefen(merkmale, alle, id);
  if (d.gleich) return { ok: false, status: 409, fehler: dublettenText(d.gleich), dublette: { id: d.gleich.kontakt.id, name: anzeigename(d.gleich.kontakt) } };
  if (d.vermutlich) hinweise.push(`Gibt es vermutlich schon: ${anzeigename(d.vermutlich.kontakt)}${d.vermutlich.kontakt.firma ? ` (${d.vermutlich.kontakt.firma})` : ''} — ${d.vermutlich.grund}. Bitte bei Gelegenheit prüfen.`);

  // 3 · Firma.
  let firma: Firma | undefined;
  let firmaNeu = false;
  if (e.firmaId) {
    firma = (await ladeCrm()).firmen.find(f => f.id === e.firmaId);
    if (!firma) return { ok: false, status: 404, fehler: 'Die gewählte Firma gibt es nicht (mehr) — bitte neu wählen.' };
  } else if (e.firma && regel.firmaAnlegen) {
    const plan = await firmaSichern(e.firma, { email: e.email, webseite: e.webseite }, o.wer);
    if (plan) {
      firma = plan.firma; firmaNeu = plan.art !== 'vorhanden';
      if (plan.art === 'zurueck') hinweise.push(`Die Firma „${plan.firma.name}“ lag im Papierkorb — sie ist zurückgeholt (Vermerk in der Notiz).`);
    }
  }

  // 4 · Kontakt — in der Sperre noch einmal auf Dublette prüfen (zwei Fenster gleichzeitig).
  const entwurf = personEntwurf(e, o.weg, { id, heute, jetzt, person: o.person, ...(firma ? { firma: { id: firma.id, name: firma.name } } : {}) });
  const sauber = saeubereKontakt(entwurf);
  if (!sauber) return { ok: false, status: 400, fehler: 'Die Angaben ergeben keinen gültigen Kontakt.' };
  const sperrEintraege = await sperrlisteLaden();
  let fertig: Kontakt | null = null;
  let fehler: PersonAnlegenErgebnis | null = null;
  // Zwei gleiche Anfragen gleichzeitig: die zweite findet die Person erst IN der Sperre — dann ist es eine Wiederholung (kein zweites Follow-up).
  let schonInSperre = false;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const da = f.kontakte.find(k => k.id === id);
    if (da) { fertig = da; schonInSperre = true; return f; }
    const dd = dublettePruefen(merkmale, f.kontakte, id);
    if (dd.gleich) { fehler = { ok: false, status: 409, fehler: dublettenText(dd.gleich), dublette: { id: dd.gleich.kontakt.id, name: anzeigename(dd.gleich.kontakt) } }; return f; }
    const s = neuanlageSperre(sauber, sperrEintraege, heute);
    if (s.hinweis) hinweise.push(s.hinweis);
    const namen = (fid: string) => (firma && firma.id === fid ? firma.name : undefined);
    const k = serverStempel(bezuegeSynchron(datenschutzStempeln(s.kontakt, undefined, o.person ?? 'system', jetzt, heute), undefined, heute, namen), undefined, heute);
    fertig = k;
    return { ...f, kontakte: [...f.kontakte, k] };
  }, o.wer);
  const abgelehnt = fehler as PersonAnlegenErgebnis | null;
  if (abgelehnt) return abgelehnt;
  const k = fertig as Kontakt | null;
  if (!k) return { ok: false, status: 500, fehler: 'Nicht angelegt.' };
  if (schonInSperre) return { ok: true, kontaktId: k.id, neu: false, kontakt: fuerPerson(k, o.person ?? ''), hinweise: [] };
  if (k.werbesperre) await sperren([k], 'werbesperre', heute); // Sperrliste trägt die neue Person (idempotent)

  // 5 · Follow-up aus dem nächsten Schritt.
  let followUpId: string | undefined;
  if (e.naechsterSchritt && regel.followUp !== 'nie') {
    const fu: FollowUp = neuesFollowUp({ id: neueKennung('fu'), bezug: { art: 'kontakt', id: k.id }, kontaktId: k.id, text: e.naechsterSchritt.text, faellig: e.naechsterSchritt.datum, quelle: 'hand' }, k, o.person ?? 'system', jetzt);
    await aendereCrm(b => ({ ...b, followups: [...(b.followups ?? []), { ...fu, geaendertVon: o.person ?? 'system' }] }), o.wer);
    followUpId = fu.id;
  }
  return { ok: true, kontaktId: k.id, neu: true, kontakt: fuerPerson(k, o.person ?? ''), ...(firma ? { firmaId: firma.id, ...(firmaNeu ? { firmaNeu: true } : {}) } : {}), ...(followUpId ? { followUpId } : {}), hinweise };
}
