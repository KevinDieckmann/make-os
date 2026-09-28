// ─── Einschränkung der Verarbeitung nach Art. 18 DSGVO als echte Sperre (28.09., U2 #51) ─
// Bis U2 war „Einschränkung“ nur eine Antragsart ohne Wirkung. Jetzt ist sie ein Feld an
// der Person — `Kontakt.eingeschraenkt: { seit, grund, von, antragId? }` — und wirkt wie
// die Werbesperre, nur weiter: gespeichert und aufbewahrt wird weiter, VERARBEITET nicht.
//
//   Kanal-Ampel         alles rot (lib/crm/recht.ts)
//   Heads/ZOE-Pakete    raus (lib/heads/*, zusammenfassung, ansprache)
//   Segmente, Kampagnen raus (lib/crm/segmente.ts, Kampagnen-Route)
//   Qualifizierung      raus (lib/crm/leads.ts, runden.ts)
//   Power Hour          raus (lib/crm/followup.ts, heute.ts)
//   Export              nur mit Markierung (Spalte EINGESCHRAENKT)
//   Suche               nur mit Kennzeichnung
//   Stammdaten          Bearbeiten gesperrt (Kartei-Route 409) — nur Aufheben mit Grund
//   Verbindungsprüfung  eingeschränkte Person in laufender Kampagne = Fehler (reparierbar)
//
// Setzen und Aufheben nur über POST /api/crm/datenschutz (auch der Betroffenenantrag
// „einschraenkung“) — nie über die Kartei. Überall, wo bisher `k.werbesperre` jemanden
// aus einer Liste nahm, fragt der Code `ausgenommen(k)`.
// Keine Rechtsberatung — einmal anwaltlich gegenlesen.

import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';

export interface Einschraenkung { seit: string; grund: string; von: string; antragId?: string }

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

/** Säubern (Kartei): nur vollständige Einschränkungen bleiben. */
export function einschraenkungSaeubern(v: unknown): Einschraenkung | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const seit = typeof o.seit === 'string' && TAG.test(o.seit) ? o.seit : undefined;
  const grund = String(o.grund ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!seit || !grund) return undefined;
  const von = typeof o.von === 'string' && PERSON.test(o.von) ? o.von : 'system';
  const antragId = typeof o.antragId === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(o.antragId) ? o.antragId : undefined;
  return { seit, grund, von, ...(antragId ? { antragId } : {}) };
}

/** Ist die Verarbeitung der Person eingeschränkt (Art. 18)? */
export const istEingeschraenkt = (k: Pick<Kontakt, 'eingeschraenkt'> | null | undefined): boolean => !!k?.eingeschraenkt;

/**
 * Nimmt die Person aus jeder Liste, jedem Paket, jeder Ansprache: Werbesperre (Art. 21) ODER Einschränkung (Art. 18).
 * Überall dort, wo bisher `k.werbesperre` gefiltert hat.
 */
export const ausgenommen = (k: Pick<Kontakt, 'werbesperre' | 'eingeschraenkt'> | null | undefined): boolean => !!k?.werbesperre || !!k?.eingeschraenkt;

/** Kurztext für Suche, Kartei, ZOE. */
export const einschraenkungText = (e: Einschraenkung) => `Verarbeitung eingeschränkt (Art. 18) seit ${e.seit}`;

/** Der Satz, mit dem die Kartei-Route ein Bearbeiten ablehnt (409). */
export const EINGESCHRAENKT_FEHLER = 'Die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO) — Stammdaten und Verlauf sind gesperrt. Aufheben nur mit Grund unter Kontakt › Stammdaten › Datenschutz.';

/**
 * Felder, die an einer eingeschränkten Person trotzdem geschrieben werden dürfen: ein Werbewiderspruch (Art. 21)
 * mit dem Leeren von Wiedervorlage und nächstem Schritt. Alles andere ist Bearbeiten → abgelehnt.
 */
const ERLAUBT = new Set(['werbesperre', 'wiedervorlage', 'naechsterSchritt', 'stand', 'id']);

/** Darf dieser `teil` an einer eingeschränkten Person geschrieben werden? */
export function teilBeiEinschraenkungErlaubt(felder: Record<string, unknown>): boolean {
  return Object.keys(felder).every(f => ERLAUBT.has(f));
}

/** Ein ganzer Eintrag ändert eine eingeschränkte Person nur, wenn er inhaltlich gleich bleibt (bis auf Server-Felder). */
export function eintragBeiEinschraenkungErlaubt(alt: Kontakt, neu: Kontakt): boolean {
  const ohne = (k: Kontakt) => { const { stand: _s, geaendertAm: _g, vonHand: _v, eingeschraenkt: _e, ...r } = k; return JSON.stringify(r, Object.keys(r).sort()); };
  return ohne(alt) === ohne(neu);
}

/** Einschränkung setzen — mit System-Aktivität (wer, warum, Antrag). Ist schon eine gesetzt, bleibt die erste. */
export function einschraenkungSetzen(k: Kontakt, e: { grund: string; von: string; antragId?: string }, heute: string, jetztIso: string): Kontakt {
  if (k.eingeschraenkt) return k;
  const eingeschraenkt = einschraenkungSaeubern({ seit: heute, grund: e.grund, von: e.von, antragId: e.antragId });
  if (!eingeschraenkt) return k;
  const vermerk: Aktivitaet = { am: jetztIso, art: 'system', von: eingeschraenkt.von, text: `Verarbeitung eingeschränkt (Art. 18) — ${eingeschraenkt.grund}${eingeschraenkt.antragId ? ` · Antrag ${eingeschraenkt.antragId}` : ''}` };
  return { ...k, eingeschraenkt, wiedervorlage: undefined, naechsterSchritt: undefined, aktivitaeten: [...(k.aktivitaeten ?? []), vermerk], geaendertAm: heute };
}

/** Einschränkung aufheben — nur mit Grund; die System-Aktivität hält fest, seit wann sie galt und wer aufhob. */
export function einschraenkungAufheben(k: Kontakt, e: { grund: string; von: string }, heute: string, jetztIso: string): Kontakt | null {
  const grund = e.grund.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!k.eingeschraenkt || grund.length < 3) return null;
  const von = PERSON.test(e.von) ? e.von : 'system';
  const { eingeschraenkt: alt, ...rest } = k;
  const vermerk: Aktivitaet = { am: jetztIso, art: 'system', von, text: `Einschränkung aufgehoben (galt seit ${alt!.seit}) — ${grund}` };
  return { ...rest, aktivitaeten: [...(k.aktivitaeten ?? []), vermerk], geaendertAm: heute };
}
