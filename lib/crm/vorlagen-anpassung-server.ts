// ─── Markttraktion — Playbooks und Event-Vorlagen je Haushalt: die EINE Lese- und Schreibstelle (Server; Restpunkte 24.10.) ───────────────────────────────
// Bestände `kampagnen-vorlagen--<haushalt>` (Playbooks) und `event-vorlagen--<haushalt>` (Vorlagen eigener Abende) — Haushalt der Kartei (`karteiHaushalt`,
// der des Inhabers). Nur Abweichungen von der Vorgabe im Code und eigene Kopien; keine Personendaten (wer geändert hat, steht nur im Änderungsprotokoll).
// JEDER Leser nimmt `playbooksFuer(haushalt)` bzw. `eventVorlagenFuer(haushalt)` (Kampagnen planen, Heads und ZOE `kampagne`, Event anlegen, Stellschrauben) —
// nie `PLAYBOOKS`/`VORLAGEN` direkt, sonst sähe er die Anpassungen nicht. Ohne Bestand = die Vorgabe, bit-gleich. Schreiben mit Stand (409) in EINER Sperre.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung, zufallsUuid } from '@/lib/kennung';
import type { Playbook } from './kampagnen';
import type { Vorlage } from './eventplanung';
import { playbooksAus, eventVorlagenAus, bestandAus, vorlagenAendern, vorlagenAnzahl, type VorlagenOp } from './vorlagen-anpassung';
import type { EventVorlagenBestand, PlaybookBestand, VorlagenArt } from './vorlagen-regeln';

const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,60}$/;
/** Der Name des Bestands je Art und Haushalt (unzulässiger Haushalt wirft — nie ein Pfad aus Eingaben). */
export function vorlagenBestandName(art: VorlagenArt, haushalt: string): string {
  if (!HAUSHALT.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `${art === 'playbook' ? 'kampagnen-vorlagen' : 'event-vorlagen'}--${haushalt}`;
}
/** Der Haushalt der Markttraktion (der Kartei des Inhabers). */
export async function vorlagenHaushalt(): Promise<string> {
  return (await import('./sperrliste')).karteiHaushalt();
}

export async function playbookBestandLesen(haushalt: string): Promise<PlaybookBestand> {
  return bestandAus('playbook', await loadJson<unknown>(vorlagenBestandName('playbook', haushalt)));
}
export async function eventBestandLesen(haushalt: string): Promise<EventVorlagenBestand> {
  return bestandAus('event', await loadJson<unknown>(vorlagenBestandName('event', haushalt)));
}

/** Die Playbooks dieses Haushalts (Vorgaben mit Abweichungen + eigene). Ohne Bestand genau `PLAYBOOKS`. */
export async function playbooksFuer(haushalt: string): Promise<Playbook[]> {
  return playbooksAus(await playbookBestandLesen(haushalt));
}
/** Die Event-Vorlagen dieses Haushalts. Ohne Bestand genau `VORLAGEN`. */
export async function eventVorlagenFuer(haushalt: string): Promise<Vorlage[]> {
  return eventVorlagenAus(await eventBestandLesen(haushalt));
}
/** Kurzform für die Leser der Markttraktion (Haushalt der Kartei). */
export const playbooksDesHaushalts = async (): Promise<Playbook[]> => playbooksFuer(await vorlagenHaushalt());
export const eventVorlagenDesHaushalts = async (): Promise<Vorlage[]> => eventVorlagenFuer(await vorlagenHaushalt());

/** Stand eines Bestands (409) — Fingerabdruck der Abweichungen und eigenen Vorlagen. */
export const vorlagenStand = (b: { geaendert: unknown; eigene: unknown }): string => fingerabdruck({ geaendert: b.geaendert as Record<string, unknown>, eigene: b.eigene as unknown as Record<string, unknown> });

/** Wie viele Playbooks bzw. Event-Vorlagen angepasst oder eigen sind (Stellschraube „Vorlagen“ im Steckbrief der Prozesse). */
export async function vorlagenZaehler(haushalt?: string): Promise<{ playbooks: number; events: number }> {
  const h = haushalt ?? await vorlagenHaushalt();
  const [p, e] = await Promise.all([playbookBestandLesen(h), eventBestandLesen(h)]);
  return { playbooks: vorlagenAnzahl(p), events: vorlagenAnzahl(e) };
}

export type VorlagenSchreibErgebnis =
  | { ok: true; id: string; geaendert: boolean; stand: string }
  | { ok: false; status: 400 | 404 | 409 | 413; fehler: string; stand?: string };

/**
 * Eine Änderung schreiben — in EINER Sperre: Stand prüfen (409 mit dem aktuellen Stand), anwenden (rein, ./vorlagen-anpassung.ts), nur bei echter Änderung
 * schreiben, Änderungsprotokoll mit `wer` (Werte nie). `segmente` = gespeicherte, nicht gelöschte Segmente (Segment-Vorschlag).
 */
export async function vorlagenSchreiben(art: VorlagenArt, haushalt: string, o: { stand: unknown; op: VorlagenOp; wer: Wer; segmente?: ReadonlySet<string>; jetzt?: string }): Promise<VorlagenSchreibErgebnis> {
  const name = vorlagenBestandName(art, haushalt);
  let raus: VorlagenSchreibErgebnis = { ok: false, status: 409, fehler: 'Nicht gespeichert.' };
  let vorher: unknown = null;
  const nachher = await updateJson<unknown>(name, cur => {
    const b = bestandAus(art, cur);
    vorher = cur ?? null;
    const st = vorlagenStand(b);
    if (typeof o.stand !== 'string' || o.stand !== st) { raus = { ok: false, status: 409, fehler: 'Die Vorlagen wurden inzwischen geändert — bitte neu laden.', stand: st }; return cur; }
    const ctx = { zufall: () => zufallsUuid().replace(/-/g, ''), neueId: (p: string) => neueKennung(p), ...(o.segmente ? { segmente: o.segmente } : {}) };
    const r = art === 'playbook' ? vorlagenAendern('playbook', b as PlaybookBestand, o.op, ctx) : vorlagenAendern('event', b as EventVorlagenBestand, o.op, ctx);
    if (!r.ok) { raus = { ok: false, status: r.status, fehler: r.fehler, stand: st }; return cur; }
    if (!r.geaendert) { raus = { ok: true, id: r.id, geaendert: false, stand: st }; return cur; }
    const neu = { ...r.bestand, geaendertAm: o.jetzt ?? new Date().toISOString() };
    raus = { ok: true, id: r.id, geaendert: true, stand: vorlagenStand(neu) };
    return neu;
  });
  const e = raus as VorlagenSchreibErgebnis;
  if (e.ok && e.geaendert) await protokolliereBestand(name, vorher, nachher, o.wer).catch(() => {});
  return e;
}
