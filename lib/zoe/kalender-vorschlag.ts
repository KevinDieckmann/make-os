// ─── Kalender-Agent: Vorschläge nur über den Freigabe-Stapel (29.09., Paket R-Z #K2) ──
// Stand bis heute: stand der Kalender-Agent auf „autonom“, schrieb `app/api/kalender/analyse` seine Blöcke über den
// Altweg `/api/apple-calendar/create` selbst nach iCloud — auslösbar über `run_agent kalender` aus dem Gespräch. Das
// verletzte „ZOE schreibt nie nach iCloud“: ein Modell-Vorschlag landete ohne Klick im echten Kalender.
//
// Jetzt: Der Agent legt jeden Block als Vorschlag der Stapel-Art „kalender“ ab (`legeKalenderVorschlaege`). Angelegt
// wird erst per Klick im Stapel — `KALENDER_STAPEL_ART.freigeben` (lib/zoe/stapel-arten.ts) ruft den normalen
// Schreibweg `/api/kalender/termin` (POST) im Prozess auf, mit Dienstschlüssel und der freigebenden Person: dieselben
// Prüfungen wie ein Klick in der Oberfläche (Haushalt, Eingabeprüfung, Bezug „von“, Änderungsprotokoll, nie Teilnehmer).
// Übernehmen ist bewusst KEIN Werkzeug — kein Aufruf aus dem Gespräch kann einen Vorschlag selbst freigeben.
// Steht derselbe Termin (Titel + Beginn) schon im Kalender (z. B. über „Eintragen“ in der Kalender-Sicht), wird nichts
// doppelt angelegt.

import { lege, entscheide, beanspruche, loslassen, type Vorschlag } from './stapel';
import { notiere } from './protokoll';
import { innen } from './crm-vorschlag';
import type { StapelArtFreigabe } from './stapel-arten';
import { localDay, tagePlus } from '@/lib/zeit';
import { EINSTELLUNGEN_LEER, type KalenderEinstellungen } from '@/lib/kalender/einstellungen';

export const KALENDER_VORSCHLAG_WERKZEUG = 'kalender_block';
export const KALENDER_GRUPPE = 'kalender';

/** Ein Block, wie der Kalender-Agent ihn vorschlägt (bereits gesäubert: Tag im Angebot, Dauer 15–240 Min.). */
export interface KalenderBlock { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string }

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const WAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const zwei = (n: number) => String(n).padStart(2, '0');
const kurz = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

/**
 * In welche Kalender der Agent vorschlagen darf (Nachtrag 29.09.): nicht fest verdrahtet, sondern aus den
 * Kalender-Einstellungen (lib/kalender/einstellungen.ts) — der eigene Kalender der fragenden Person (Standard, wie beim
 * Anlegen in /api/kalender/termin) und der gemeinsame. Ohne Einstellungen gelten deren Standardnamen. Rein.
 *
 * Eigener Kalender (09.10., Plattform-Regel — vorher bekam JEDE Person außer einer festen den Kalender der anderen als „eigenen“):
 * zuerst die eigene iCloud-Verbindung der Person (`eigenesIcloud`, Blockkalender — lib/kalender/icloud-person.ts `eigenesBlockZiel`),
 * sonst ihre Zuordnung in den Einstellungen (`kalender.<speicher>`). Ist ihr keiner zugeordnet: `eigen: null` — dann nur der
 * gemeinsame, nie der Kalender einer anderen Person (`KEIN_EIGENER_KALENDER` sagt es der Person).
 */
export function vorschlagsKalender(einst: Pick<KalenderEinstellungen, 'kalender'> | null | undefined, person: string, eigenesIcloud?: string | null): { eigen: string | null; gemeinsam: string; erlaubt: ReadonlySet<string> } {
  const k = (einst ?? EINSTELLUNGEN_LEER).kalender as Record<string, string>;
  const zugeordnet = person !== 'beide' && Object.prototype.hasOwnProperty.call(k, person) ? kurz(k[person], 100) : '';
  const eigen = kurz(eigenesIcloud, 100) || zugeordnet || null;
  return { eigen, gemeinsam: k.beide, erlaubt: new Set(eigen ? [eigen, k.beide] : [k.beide]) };
}

/** Satz, wenn der Person kein eigener Kalender zugeordnet ist — statt still in einen fremden Kalender vorzuschlagen. */
export const KEIN_EIGENER_KALENDER = 'Dir ist noch kein eigener Kalender zugeordnet (Kalender › Einstellungen: Zuordnung oder eigene iCloud-Verbindung) — Blöcke schlage ich deshalb nur im gemeinsamen Kalender vor.';

/** Server: die Vorschlags-Kalender einer Person — Einstellungen + eigene iCloud-Verbindung (wirft nie). */
export async function vorschlagsKalenderFuer(person: string, einst?: Pick<KalenderEinstellungen, 'kalender'> | null): Promise<ReturnType<typeof vorschlagsKalender>> {
  const e = einst ?? await import('@/lib/kalender/einstellungen').then(m => m.ladeEinstellungen()).catch(() => null);
  const eigen = await import('@/lib/kalender/icloud-person').then(m => m.eigenesBlockZiel(person)).catch(() => undefined);
  return vorschlagsKalender(e, person, eigen ?? null);
}

/** Wandzeit „YYYY-MM-DDTHH:mm:00“ aus Tag + Minuten ab Mitternacht (über Mitternacht → Folgetag). Rein. */
export function wandzeitAus(tag: string, minuten: number): string {
  const tage = Math.floor(minuten / 1440);
  const rest = minuten - tage * 1440;
  return `${tage ? tagePlus(tag, tage) : tag}T${zwei(Math.floor(rest / 60))}:${zwei(rest % 60)}:00`;
}

/** Block → Eingabe für den Termin-Schreibweg (POST /api/kalender/termin). Null, wenn unbrauchbar. Rein. */
export function blockAlsTermin(b: KalenderBlock): { titel: string; kalender: string; start: string; ende: string } | null {
  const titel = kurz(b.title, 300);
  const kalender = kurz(b.calendar, 100);
  if (!titel || !kalender || !TAG.test(b.date)) return null;
  const startMin = Math.round(Number(b.startHour) * 60 + Number(b.startMin ?? 0));
  const dauer = Math.max(15, Math.min(240, Math.round(Number(b.durationMin) || 60)));
  if (!Number.isFinite(startMin) || startMin < 0 || startMin >= 1440) return null;
  return { titel, kalender, start: wandzeitAus(b.date, startMin), ende: wandzeitAus(b.date, startMin + dauer) };
}

/**
 * Die Vorschläge des Kalender-Agenten in den Stapel legen (einer je Block; dieselbe Wirkung liegt nie doppelt offen —
 * `lege` erkennt sie). Schreibt NICHTS in den Kalender. Liefert die Kennungen der abgelegten Vorschläge.
 */
export async function legeKalenderVorschlaege(bloecke: readonly KalenderBlock[], person: string, quelle: 'gespraech' | 'lauf' = 'lauf'): Promise<string[]> {
  const ids: string[] = [];
  for (const b of bloecke) {
    const t = blockAlsTermin(b);
    if (!t) continue;
    const v = await lege({
      werkzeug: KALENDER_VORSCHLAG_WERKZEUG, gruppe: KALENDER_GRUPPE,
      titel: `Kalender: „${kurz(t.titel, 80)}“ eintragen`,
      nachher: `${t.start.slice(8, 10)}.${t.start.slice(5, 7)}. ${t.start.slice(11, 16)}–${t.ende.slice(11, 16)} · ${t.kalender}`,
      eingabe: t, person, quelle, bezug: { art: 'kalender', id: t.start },
      ...(kurz(b.grund, 300) ? { anlass: kurz(b.grund, 300) } : {}),
    });
    ids.push(v.id);
  }
  return ids;
}

/** Die gespeicherte Eingabe eines Kalender-Vorschlags prüfen (sie kommt aus dem Bestand, nicht vom Modell). Rein. */
export function vorschlagEingabe(v: Pick<Vorschlag, 'eingabe'>): { titel: string; kalender: string; start: string; ende: string } | null {
  const e = v.eingabe ?? {};
  const titel = kurz(e.titel, 300), kalender = kurz(e.kalender, 100), start = String(e.start ?? ''), ende = String(e.ende ?? '');
  if (!titel || !kalender || !WAND.test(start) || !WAND.test(ende) || ende <= start) return null;
  return { titel, kalender, start, ende };
}

/** Steht derselbe Termin (Titel + Beginn auf die Minute) schon im Kalender? */
async function schonImKalender(t: { titel: string; start: string }): Promise<boolean> {
  const { ladeEinstellungen } = await import('@/lib/kalender/einstellungen');
  const { termineLesen } = await import('@/lib/kalender/termine-lesen');
  const tag = t.start.slice(0, 10);
  const g = await termineLesen(await ladeEinstellungen(), tag, tagePlus(tag, 1)).catch(() => null);
  const titel = t.titel.toLowerCase();
  return !!g?.termine.some(x => x.titel.trim().toLowerCase() === titel && x.start.slice(0, 16) === t.start.slice(0, 16));
}

/**
 * Stapel-Art „kalender“: Freigabe per Klick — beanspruchen (in der Sperre), anlegen über den Termin-Schreibweg,
 * entscheiden (mit Person, dauerhaft). Scheitert es, bleibt der Vorschlag offen. „Ändern & freigeben“ gibt es hier
 * nicht: angelegt wird genau, was vorgeschlagen und gezeigt wurde (Zeit ändern → danach im Kalender verschieben).
 */
export const KALENDER_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!person || !(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'kalender' || v.werkzeug !== KALENDER_VORSCHLAG_WERKZEUG) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die ZOE ihn vorbereitet hat, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v = a.v;
    const t = vorschlagEingabe(v);
    if (!t) { await loslassen(v.id); return { ok: false, status: 400, fehler: 'Der Vorschlag ist unvollständig — nichts angelegt.' }; }
    if (t.start.slice(0, 10) < localDay()) { await loslassen(v.id); return { ok: false, status: 409, fehler: 'Der Termin liegt inzwischen in der Vergangenheit — nichts angelegt. Bitte ablehnen.' }; }
    // Nur in einen Kalender, der der freigebenden Person zusteht (09.10.): ihr eigener oder der gemeinsame — nie der einer anderen Person.
    if (!(await vorschlagsKalenderFuer(person)).erlaubt.has(t.kalender)) { await loslassen(v.id); return { ok: false, status: 403, fehler: `„${t.kalender}“ ist nicht dein Kalender — nichts angelegt. Bitte ablehnen.` }; }
    let text: string;
    let angelegt = false;
    try {
      if (await schonImKalender(t)) text = `„${t.titel}“ stand schon im Kalender — nichts doppelt angelegt.`;
      else {
        angelegt = true;
        const r = await innen('/api/kalender/termin', 'POST', { titel: t.titel, kalender: t.kalender, start: t.start, ende: t.ende }, person);
        if (r.status >= 400 || r.json.ok === false) {
          await loslassen(v.id);
          const s = r.status;
          return { ok: false, status: s === 400 || s === 403 || s === 404 || s === 413 ? s : 409, fehler: String(r.json.fehler ?? r.json.error ?? `Abgelehnt (${s}).`) };
        }
        text = `Im Kalender „${t.kalender}“ eingetragen: ${t.start.slice(8, 10)}.${t.start.slice(5, 7)}. ${t.start.slice(11, 16)}–${t.ende.slice(11, 16)}.`;
      }
    } catch (e) { await loslassen(v.id); throw e; }
    await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
    // Protokoll: nur Kennungen und Feldnamen (eingabeKurz) — nie der Titel.
    await notiere({ werkzeug: KALENDER_VORSCHLAG_WERKZEUG, gruppe: KALENDER_GRUPPE, risiko: 'freigabe', eingabe: { vorschlagId: v.id }, felder: ['titel', 'kalender', 'start', 'ende'], ergebnis: angelegt ? 'Termin angelegt (Freigabe)' : 'Termin stand schon da — nichts angelegt', ok: true, quelle: 'stapel', person, ruecknahme: null });
    return { ok: true, text };
  },
};
