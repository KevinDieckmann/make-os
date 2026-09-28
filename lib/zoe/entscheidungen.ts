// ─── ZOE-Entscheidungen dauerhaft festhalten (29.09., B1) ────────────────────
// Kevin: „Alle Infos müssen immer sauber gespeichert werden — online in unserem Brain. Extrem wichtig.“
// Die Arbeitslisten `zoe-stapel` (200 Erledigte) und `zoe-protokoll` (500 Einträge) werden gekürzt — vorher
// verschwanden damit Freigaben, Ablehnungen und ZOE-Wirkungen samt der Person, die entschieden hat. Jetzt geht
// jede Entscheidung (freigegeben · abgelehnt · fehlgeschlagen · zurück an ZOE) und jede Ausführung eines
// Werkzeugs ZUERST hierher, erst danach darf die Arbeitsliste kürzen (lib/zoe/stapel.ts, lib/zoe/protokoll.ts).
//
// Speicher: `zoe-entscheidungen--<haushalt>--<JJJJ-MM>` (Berliner Monat) — wie das Änderungsprotokoll nur
// anhängend, nie gekürzt, nie überschrieben. Inhalt: Art, Bezug, Person, Grund (eigener Text der entscheidenden
// Person — darf rein), Ergebnis kurz; von Ausführungen nur die Feldnamen der Eingabe, nie die Werte.
// Kontakt-Kennungen (tragen die E-Mail) nur als Fingerabdruck (`protokollKennung`; seit 29.09. HMAC v2 mit Pepper).
// Geprüft 29.09. (Paket D-B #69): Titel, Grund und Ergebnis KÖNNEN Namen tragen („Notiz an …“) — Art. 17 tilgt sie
// (lib/crm/person-weitere.ts, Name → „[gelöscht]“, Fingerabdruck → `c#geloescht`), Art. 15 zählt sie, Frist 36 Monate
// (Löschklasse „zoe-entscheidungen“, Monatsdateien geleert wie das Änderungsprotokoll).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { monatBerlin, protokollKennung } from '@/lib/store/aenderungsprotokoll';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { tagVon } from '@/lib/zeit';

export const ENTSCHEIDUNGEN_PRAEFIX = 'zoe-entscheidungen';
/** Was mit einem Vorschlag geschah — „zurueck“ = abgelehnt und gleich wieder an ZOE gegeben (Aufgaben). */
export type EntscheidungArt = 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen' | 'zurueck';

export interface DauerEintrag {
  /** Wann (ISO). */
  at: string;
  typ: 'entscheidung' | 'ausfuehrung';
  /** Kennung im Stapel (`v-…`) bzw. im Protokoll (`p-…`). */
  quelleId: string;
  werkzeug: string;
  gruppe: string;
  /** Nur bei Entscheidungen. */
  entscheidung?: EntscheidungArt;
  /** Art + Kennung des Bezugs (Aufgabe, CRM-Vorschlag) — Kontakt-Kennungen als Fingerabdruck. */
  bezug?: { art: string; id: string };
  /** Bei CRM-Vorschlägen: welche Art (aktivitaet, followup …). */
  vorschlagArt?: string;
  titel?: string;
  /** Wer entschieden bzw. für wen ZOE gehandelt hat — fehlt = Systemlauf. */
  person?: string;
  /** Für wen der Vorschlag vorbereitet war. */
  fuer?: string;
  grund?: string;
  ergebnis?: string;
  ok?: boolean;
  risiko?: string;
  quelle?: string;
  /** Nur Ausführungen: Namen der Eingabe-Felder — nie Werte. */
  felder?: string[];
  /** Erst beim Kürzen nachgetragen (Altbestand vor dem 29.09. oder ein zuvor fehlgeschlagenes Festhalten). */
  nachgetragen?: true;
}
export interface EntscheidungenDatei { eintraege: DauerEintrag[] }

const PERSON = /^[a-z0-9-]{1,40}$/;
const kurz = (t: unknown, n: number): string | undefined => {
  const s = typeof t === 'string' ? t.replace(/\u0000/g, '').trim() : '';
  return s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : undefined;
};

export function entscheidungenName(haushalt: string, monat: string): string {
  const h = haushalt.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '') || 'ohne-haushalt';
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error(`[zoe-entscheidungen] Monat ungültig: ${monat}`);
  return `${ENTSCHEIDUNGEN_PRAEFIX}--${h}--${monat}`;
}

/** Bezug ohne Klartext-E-Mail: jedes `c-…`-Glied einer Kennung (`aktivitaet:c-anna-1`) wird Fingerabdruck. */
export function bezugFuerProtokoll(b: { art: string; id: string } | undefined): { art: string; id: string } | undefined {
  if (!b) return undefined;
  return { art: String(b.art).slice(0, 40), id: String(b.id).split(':').map(protokollKennung).join(':').slice(0, 160) };
}

/** Der Haushalt einer Person — ohne Person (Systemlauf) der des Inhabers. */
export async function haushaltFuer(person: string | undefined | null): Promise<string> {
  const eigener = person && PERSON.test(person) ? (await ladeKonten()).konten.find(k => k.speicher === person)?.haushalt : undefined;
  return eigener ?? (await haushaltDesInhabers()) ?? 'ohne-haushalt';
}

/** Eine Stapel-Entscheidung als dauerhafter Eintrag (rein). */
export function entscheidungEintrag(v: {
  id: string; werkzeug: string; gruppe: string; titel?: string; person?: string; bezug?: { art: string; id: string }; eingabe?: Record<string, unknown>;
}, e: { entscheidung: EntscheidungArt; von?: string | null; grund?: string; ergebnis?: string; at: string; nachgetragen?: boolean }): DauerEintrag {
  const art = v.bezug?.art === 'crm' && typeof v.eingabe?.art === 'string' ? String(v.eingabe.art).slice(0, 40) : undefined;
  return {
    at: e.at, typ: 'entscheidung', quelleId: v.id, werkzeug: v.werkzeug, gruppe: v.gruppe, entscheidung: e.entscheidung,
    ...(v.bezug ? { bezug: bezugFuerProtokoll(v.bezug) } : {}), ...(art ? { vorschlagArt: art } : {}),
    ...(kurz(v.titel, 200) ? { titel: kurz(v.titel, 200) } : {}),
    ...(e.von && PERSON.test(e.von) ? { person: e.von } : {}), ...(v.person && PERSON.test(v.person) ? { fuer: v.person } : {}),
    ...(kurz(e.grund, 2000) ? { grund: kurz(e.grund, 2000) } : {}), ...(kurz(e.ergebnis, 300) ? { ergebnis: kurz(e.ergebnis, 300) } : {}),
    ...(e.nachgetragen ? { nachgetragen: true as const } : {}),
  };
}

/** Eine Werkzeug-Ausführung (ZOE-Protokoll) als dauerhafter Eintrag — nur Feldnamen, nie Werte (rein). */
export function ausfuehrungEintrag(p: {
  id: string; zeit: string; werkzeug: string; gruppe: string; risiko: string; eingabe: Record<string, unknown>; felder?: string[]; ergebnis: string; ok: boolean; quelle: string; person?: string;
}, nachgetragen = false): DauerEintrag {
  return {
    at: p.zeit, typ: 'ausfuehrung', quelleId: p.id, werkzeug: p.werkzeug, gruppe: p.gruppe, risiko: p.risiko, quelle: p.quelle, ok: p.ok,
    ...(p.person && PERSON.test(p.person) ? { person: p.person } : {}),
    felder: (p.felder ?? Object.keys(p.eingabe ?? {})).slice(0, 40).map(k => k.slice(0, 40)),
    ...(kurz(p.ergebnis, 300) ? { ergebnis: kurz(p.ergebnis, 300) } : {}),
    ...(nachgetragen ? { nachgetragen: true as const } : {}),
  };
}

/**
 * Einträge dauerhaft anhängen — in die Monatsdatei ihres Zeitpunkts, im Haushalt der Person (sonst des Inhabers).
 * WIRFT bei einem Fehler: wer danach kürzen will, darf es dann nicht (lib/zoe/stapel.ts, lib/zoe/protokoll.ts).
 */
export async function haltFest(eintraege: readonly DauerEintrag[]): Promise<void> {
  if (!eintraege.length) return;
  const gruppen = new Map<string, DauerEintrag[]>();
  for (const e of eintraege) {
    const haushalt = await haushaltFuer(e.person ?? e.fuer);
    const t = Date.parse(e.at);
    const name = entscheidungenName(haushalt, monatBerlin(Number.isFinite(t) ? new Date(t) : new Date()));
    gruppen.set(name, [...(gruppen.get(name) ?? []), e]);
  }
  for (const [name, neu] of gruppen) {
    await updateJson<EntscheidungenDatei>(name, cur => ({ eintraege: [...(Array.isArray(cur?.eintraege) ? cur.eintraege : []), ...neu] }));
  }
}

/** Die Einträge eines Monats (älteste zuerst). */
export async function entscheidungenMonat(haushalt: string, monat: string): Promise<DauerEintrag[]> {
  const f = await loadJson<EntscheidungenDatei>(entscheidungenName(haushalt, monat));
  return Array.isArray(f?.eintraege) ? f.eintraege : [];
}

/** Die Entscheidungen (ohne Ausführungen) eines Berliner Tages. */
export async function entscheidungenAmTag(haushalt: string, tag: string): Promise<DauerEintrag[]> {
  const alle = await entscheidungenMonat(haushalt, tag.slice(0, 7));
  return alle.filter(e => e.typ === 'entscheidung' && tagVon(e.at) === tag);
}
