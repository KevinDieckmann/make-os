// ─── Personen-Schranke im CRM-Bestand (28.09. spät, Prüfbefund „Server nimmt Gesperrte an“) ─
// Bis hierher prüfte nur der Browser (Kampagnen-Auswahl, Event-Gästeliste, Deal-Dialog), ob eine
// Person gesperrt ist — `PATCH /api/crm/bestand` nahm jede Kennung an. Jetzt prüft der Server in
// `wendeCrmAn` (lib/crm/speicher.ts) jeden NEU hinzukommenden Personen-Verweis:
//
//   Liste         Art. 18 (eingeschränkt)      Werbesperre (Art. 21)
//   teilnahmen    409 EINGESCHRAENKT_FEHLER    409 — keine Einladung
//   kampagnen     409 (nur aktiv/Entwurf)       409 — keine Kampagne (nur aktiv/Entwurf)
//                 Werblicher Kanal (Mail, LinkedIn, Newsletter; 03.10., netz-recht): auch die AMPEL des Kanals zählt hart —
//                 rot → 409 (Mail ohne Einwilligung ist abmahnfähig, § 7 UWG), gelb → erlaubt, aber mit Hinweis (`kampagnenHinweise`)
//   chancen       409                          erlaubt (Vertragsbeziehung, keine Werbung)
//   mandate       409                          erlaubt (Vertragsbeziehung, keine Werbung)
//   events        409 (Zielpersonen, 03.10.)   erlaubt (Vorbereitung, keine Werbung)
//
// Nur NEUE Verweise: wer schon drinsteht, wird nicht rückwirkend abgelehnt (die Verbindungsprüfung
// meldet solche Altfälle reparierbar). Texte tragen nie Namen oder Kennungen der Person. Rein, getestet.

import type { ListenOp } from '@/lib/sync';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, KampagnenStatus } from './typen';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import { kanalStatus, type Kanal } from './recht';
import { kontextAus } from './segmente';
import { localDay } from '@/lib/zeit';

/** Was die Schranke von einer Person braucht — mehr nicht. */
export type PersonSchranke = Pick<Kontakt, 'id' | 'werbesperre' | 'eingeschraenkt'>;

/** Listen mit Personen-Verweisen, die die Schranke prüft. */
export type SchrankenListe = 'teilnahmen' | 'kampagnen' | 'chancen' | 'mandate' | 'events';
/** Kampagnen in diesen Zuständen sprechen (noch) an — nur dort zählt ein neuer Verweis. */
export const KAMPAGNE_SPRICHT_AN: readonly KampagnenStatus[] = ['aktiv', 'entwurf'];

export interface NeuerVerweis {
  liste: SchrankenListe;
  /** Nur Kampagnen: der Kanal der Kampagne (`mail`, `linkedin`, …) — bei werblichem Kanal zählt die Ampel. */
  kanal?: string;
  /** Kennung des Eintrags (Teilnahme, Kampagne, Deal, Mandat). */
  id: string;
  /** Anzeigename des Eintrags (Kampagnen-Name, Event-Titel …) für den Text — nie der Name der Person. */
  wo: string;
  kontaktIds: string[];
  /** Werbung (Kampagne, Einladung)? Dann sperrt auch die Werbesperre. */
  werbung: boolean;
}

const nurText = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const rohVon = (o: ListenOp): Record<string, unknown> | undefined => (o.op === 'teil' ? o.felder : o.op === 'upsert' ? o.eintrag : undefined);
const idVon = (o: ListenOp): string => String((o.op === 'teil' ? o.id : (o.eintrag as { id?: unknown } | undefined)?.id) ?? '');

/**
 * Die Personen-Verweise, die eine Änderung NEU hinzufügt — gemessen am Bestand vor der Änderung.
 * `teil` auf einen fehlenden Eintrag legt nichts an (`wendeAn`) und zählt deshalb nicht.
 */
export function neuePersonenVerweise(b: CrmBestand, ops: ListenOp[]): NeuerVerweis[] {
  const raus: NeuerVerweis[] = [];
  for (const o of ops) {
    const roh = rohVon(o);
    if (!roh) continue;
    const id = idVon(o);
    if (o.liste === 'teilnahmen') {
      const alt = (b.teilnahmen ?? []).find(t => t.id === id);
      if (o.op === 'teil' && !alt) continue;
      if (!('kontaktId' in roh)) continue;
      const k = String(roh.kontaktId ?? '');
      if (!k || k === alt?.kontaktId) continue;
      const eventId = String(roh.eventId ?? alt?.eventId ?? '');
      const titel = (b.events ?? []).find(e => e.id === eventId)?.titel ?? 'Event';
      // Eine Einladung ist Werbung; wer „da“ war, nicht gekommen ist oder abgesagt hat, wird nicht eingeladen (Art. 18 sperrt trotzdem — 29.10. Netzwerken: Begegnung mit Werbesperre bleibt erfassbar).
      const status = String(roh.status ?? alt?.status ?? 'vorgemerkt');
      raus.push({ liste: 'teilnahmen', id, wo: titel, kontaktIds: [k], werbung: !['da', 'no_show', 'abgesagt'].includes(status) });
    } else if (o.liste === 'kampagnen') {
      const alt = (b.kampagnen ?? []).find(k => k.id === id);
      if (o.op === 'teil' && !alt) continue;
      const status = String(roh.status ?? alt?.status ?? 'entwurf') as KampagnenStatus;
      if (!KAMPAGNE_SPRICHT_AN.includes(status) || !('kontaktIds' in roh)) continue;
      const vorher = new Set(alt?.kontaktIds ?? []);
      const neu = nurText(roh.kontaktIds).filter(k => !vorher.has(k));
      if (neu.length) raus.push({ liste: 'kampagnen', id, wo: String(roh.name ?? alt?.name ?? 'Kampagne'), kontaktIds: neu, werbung: true, kanal: String(roh.kanal ?? alt?.kanal ?? 'persoenlich') });
    } else if (o.liste === 'events') {
      // Besuchte Events (03.10.): „wen wollen wir treffen“ — eine eingeschränkte Person (Art. 18) kommt nie neu auf die Liste.
      const alt = (b.events ?? []).find(e => e.id === id);
      if (o.op === 'teil' && !alt) continue;
      if (!('zielpersonen' in roh) || !Array.isArray(roh.zielpersonen)) continue;
      const vorher = new Set((alt?.zielpersonen ?? []).map(z => z.kontaktId).filter((k): k is string => !!k));
      const neu = Array.from(new Set((roh.zielpersonen as unknown[]).map(z => (z && typeof z === 'object' ? String((z as { kontaktId?: unknown }).kontaktId ?? '') : '')).filter(k => k && !vorher.has(k))));
      if (neu.length) raus.push({ liste: 'events', id, wo: String(roh.titel ?? alt?.titel ?? 'Event'), kontaktIds: neu, werbung: false });
    } else if (o.liste === 'chancen' || o.liste === 'mandate') {
      const alt = o.liste === 'chancen' ? (b.chancen ?? []).find(c => c.id === id) : (b.mandate ?? []).find(m => m.id === id);
      if (o.op === 'teil' && !alt) continue;
      const vorher = new Set<string>([...(alt?.kontaktIds ?? []), ...Object.keys((alt as { personenRollen?: Record<string, string> } | undefined)?.personenRollen ?? {})]);
      const kandidaten = [...nurText(roh.kontaktIds), ...(roh.personenRollen && typeof roh.personenRollen === 'object' ? Object.keys(roh.personenRollen as Record<string, unknown>) : [])];
      const neu = Array.from(new Set(kandidaten.filter(k => !vorher.has(k))));
      const wo = o.liste === 'chancen' ? String(roh.titel ?? (alt as { titel?: string } | undefined)?.titel ?? 'Deal') : String(roh.titel ?? (alt as { titel?: string } | undefined)?.titel ?? 'Mandat');
      if (neu.length) raus.push({ liste: o.liste, id, wo, kontaktIds: neu, werbung: false });
    }
  }
  return raus;
}

const personenWort = (n: number) => (n === 1 ? 'eine Person' : `${n} Personen`);

/**
 * Lehnt die GANZE Änderung ab (Texte für 409), wenn ein neuer Verweis auf eine gesperrte Person zeigt.
 * Personen, die die Kartei nicht kennt, prüft die Schranke nicht (die Verbindungsprüfung meldet tote Verweise).
 */
export function personenSchranke(b: CrmBestand, ops: ListenOp[], personen: readonly PersonSchranke[]): string[] {
  const verweise = neuePersonenVerweise(b, ops);
  if (!verweise.length) return [];
  const je = new Map(personen.map(p => [p.id, p]));
  const raus: string[] = [];
  let eingeschraenkt = false;
  for (const v of verweise) {
    const ps = v.kontaktIds.map(k => je.get(k)).filter((p): p is PersonSchranke => !!p);
    if (ps.some(p => p.eingeschraenkt)) { eingeschraenkt = true; continue; }
    if (!v.werbung) continue;
    const gesperrt = ps.filter(p => p.werbesperre).length;
    // Werblicher Kanal: die Ampel zählt hart — rot (ohne Werbesperre, die unten schon abgelehnt wird) kommt nicht in die Kampagne.
    if (v.liste === 'kampagnen') {
      const a = kampagnenAmpel(v.kanal, v.kontaktIds, personen, b, localDay());
      const rot = a.rot.filter(x => !je.get(x.id)?.werbesperre);
      if (rot.length) raus.push(`Kampagne „${v.wo}“ (${KANAL_TEXT[v.kanal ?? ''] ?? v.kanal}): ${personenWort(rot.length)} mit roter Ampel ${rot.length === 1 ? 'kommt' : 'kommen'} nicht hinein — ${gruende(rot)} — nichts gespeichert.`);
    }
    if (!gesperrt) continue;
    raus.push(v.liste === 'teilnahmen'
      ? `Event „${v.wo}“: ${personenWort(gesperrt)} mit Werbesperre (Widerspruch, Art. 21 DSGVO) ${gesperrt === 1 ? 'bekommt' : 'bekommen'} keine Einladung — nichts gespeichert.`
      : `Kampagne „${v.wo}“: ${personenWort(gesperrt)} mit Werbesperre (Widerspruch, Art. 21 DSGVO) ${gesperrt === 1 ? 'kommt' : 'kommen'} in keine Kampagne — nichts gespeichert.`);
  }
  return eingeschraenkt ? [EINGESCHRAENKT_FEHLER, ...raus] : raus;
}

/** Eine Funktions-Änderung (`aendereCrm(b => …)`) wurde von der Personen-Schranke abgelehnt — 409 mit Texten, nichts geschrieben. */
export class PersonenSchrankeFehler extends Error {
  status = 409;
  constructor(public texte: string[]) { super(texte.join(' · ')); this.name = 'PersonenSchrankeFehler'; }
}

/**
 * Was eine Funktions-Änderung an Teilnahmen und Kampagnen NEU hinzugefügt hat, als Einzel-Ops — damit auch sie durch die Schranke laufen
 * (der Ops-Weg prüft in `wendeCrmAn`; Server-Funktionen wie „Netzwerken erfassen“ schrieben bisher an der Schranke vorbei).
 * Gemessen wird am Stand VOR der Änderung; nur neue Einträge bzw. neue Personen in einer Kampagne zählen.
 */
export function funktionsOps(vorher: CrmBestand, nachher: CrmBestand): ListenOp[] {
  const ops: ListenOp[] = [];
  const tAlt = new Map((vorher.teilnahmen ?? []).map(t => [t.id, t]));
  for (const t of nachher.teilnahmen ?? []) { const a = tAlt.get(t.id); if (!a || a.kontaktId !== t.kontaktId || a.status !== t.status) ops.push({ liste: 'teilnahmen', op: 'upsert', eintrag: { ...t } as unknown as Record<string, unknown> }); }
  const kAlt = new Map((vorher.kampagnen ?? []).map(k => [k.id, k]));
  for (const k of nachher.kampagnen ?? []) {
    const a = kAlt.get(k.id);
    if (!a || k.kontaktIds.some(x => !a.kontaktIds.includes(x)) || a.status !== k.status) ops.push({ liste: 'kampagnen', op: 'upsert', eintrag: { ...k } as unknown as Record<string, unknown> });
  }
  const eAlt = new Map((vorher.events ?? []).map(x => [x.id, x]));
  for (const x of nachher.events ?? []) {
    const a = eAlt.get(x.id);
    const neu = (x.zielpersonen ?? []).some(z => z.kontaktId && !(a?.zielpersonen ?? []).some(y => y.kontaktId === z.kontaktId));
    if (neu) ops.push({ liste: 'events', op: 'upsert', eintrag: { id: x.id, titel: x.titel, zielpersonen: x.zielpersonen } });
  }
  return ops;
}

// ── Ampel bei werblichen Kampagnen (03.10., netz-recht) ─────────────────────

/** Kanäle einer Kampagne, in denen sie wirbt — dort entscheidet die Ampel des Kanals (lib/crm/recht.ts), nicht nur die Sperre. */
export const WERBLICHE_KANAELE: Readonly<Record<string, Kanal>> = { mail: 'mail', linkedin: 'linkedin', newsletter: 'newsletter' };
const KANAL_TEXT: Record<string, string> = { mail: 'Mail', linkedin: 'LinkedIn', newsletter: 'Newsletter' };
const gruende = (l: readonly { grund: string }[]): string => Array.from(new Set(l.map(x => x.grund))).slice(0, 3).join(' · ');

/** Ein ganzer Kontakt (nicht nur die Sperr-Felder)? Nur dann lässt sich die Ampel rechnen — Teil-Objekte (Tests, Auszüge) bleiben bei Sperre/Einschränkung. */
const istVoll = (p: PersonSchranke): p is PersonSchranke & Kontakt => 'aktivitaeten' in p && 'stufe' in p;

export interface AmpelBefund { rot: { id: string; grund: string }[]; gelb: { id: string; grund: string }[] }
/**
 * Ampel der Personen für den Kanal einer Kampagne. Ohne werblichen Kanal (persönlich, Telefon, Event, Mix) bleibt es leer: dort gelten
 * die bestehenden Regeln. Personen, die die Kartei nicht (voll) kennt, zählen nicht.
 */
export function kampagnenAmpel(kanal: string | undefined, kontaktIds: readonly string[], personen: readonly PersonSchranke[], crm: CrmBestand, heute: string): AmpelBefund {
  const rechtKanal = kanal ? WERBLICHE_KANAELE[kanal] : undefined;
  const raus: AmpelBefund = { rot: [], gelb: [] };
  if (!rechtKanal) return raus;
  const je = new Map(personen.map(p => [p.id, p]));
  const ctx = kontextAus(crm, heute);
  for (const id of kontaktIds) {
    const p = je.get(id);
    if (!p || !istVoll(p)) continue;
    const st = kanalStatus(p, rechtKanal, { hatMandat: ctx.mitMandat.has(id), hatChance: ctx.mitChance.has(id) });
    if (st.farbe === 'rot') raus.rot.push({ id, grund: st.grund });
    else if (st.farbe === 'gelb') raus.gelb.push({ id, grund: st.grund });
  }
  return raus;
}

/**
 * Hinweise zu NEUEN Personen mit gelber Ampel in einer werblichen Kampagne — die Änderung gilt, aber der Mensch soll es wissen
 * (persönliche Nachricht ja, Werbung erst mit Einwilligung / Nachweis ergänzen). Nie ein Name oder eine Kennung im Text.
 */
export function kampagnenHinweise(b: CrmBestand, ops: ListenOp[], personen: readonly PersonSchranke[]): string[] {
  const raus: string[] = [];
  for (const v of neuePersonenVerweise(b, ops)) {
    if (v.liste !== 'kampagnen') continue;
    const a = kampagnenAmpel(v.kanal, v.kontaktIds, personen, b, localDay());
    if (a.gelb.length) raus.push(`Kampagne „${v.wo}“ (${KANAL_TEXT[v.kanal ?? ''] ?? v.kanal}): ${personenWort(a.gelb.length)} mit gelber Ampel — ${gruende(a.gelb)}. Gelb heißt: nur persönlich oder nach Klärung, keine Werbung ohne Einwilligung.`);
  }
  return raus;
}

/**
 * Kanal einer Kampagne wird NACHTRÄGLICH werblich (Mail, LinkedIn, Newsletter — 08.10., Markttraktion Woche 2 · 5.4): vorher prüfte die
 * Schranke nur NEUE Personen, wer schon drin war und für den neuen Kanal rot ist, blieb. Jetzt gilt beim Kanalwechsel einer bestehenden,
 * noch ansprechenden Kampagne (Entwurf/aktiv) die Ampel für ALLE: rote Personen fallen aus `kontaktIds` heraus (Ergebnisse bleiben im
 * Verlauf), dazu ein Hinweis ohne Namen. Neue Kampagnen prüft wie bisher `personenSchranke` (409 für neue rote Personen). Rein.
 */
export function kanalWechselBereinigen(b: CrmBestand, ops: ListenOp[], personen: readonly PersonSchranke[], heute: string): { ops: ListenOp[]; hinweise: string[] } {
  const hinweise: string[] = [];
  const neu = ops.map(o => {
    if (o.liste !== 'kampagnen') return o;
    const roh = rohVon(o);
    if (!roh || !('kanal' in roh)) return o;
    const alt = (b.kampagnen ?? []).find(k => k.id === idVon(o));
    const kanal = String(roh.kanal ?? '');
    if (!alt || alt.kanal === kanal || !WERBLICHE_KANAELE[kanal]) return o;
    const status = String(roh.status ?? alt.status) as KampagnenStatus;
    if (!KAMPAGNE_SPRICHT_AN.includes(status)) return o;
    const ids = 'kontaktIds' in roh ? nurText(roh.kontaktIds) : alt.kontaktIds;
    const a = kampagnenAmpel(kanal, ids, personen, b, heute);
    if (!a.rot.length) return o;
    const rot = new Set(a.rot.map(x => x.id));
    const bleiben = ids.filter(x => !rot.has(x));
    hinweise.push(`Kampagne „${String(roh.name ?? alt.name)}“ jetzt über ${KANAL_TEXT[kanal] ?? kanal}: ${personenWort(rot.size)} mit roter Ampel ${rot.size === 1 ? 'ist' : 'sind'} herausgenommen — ${gruende(a.rot)}. Persönlich ansprechen geht weiter.`);
    return o.op === 'teil' ? { ...o, felder: { ...o.felder, kontaktIds: bleiben } } : { ...o, eintrag: { ...(o.eintrag as Record<string, unknown>), kontaktIds: bleiben } };
  });
  return { ops: neu, hinweise };
}
