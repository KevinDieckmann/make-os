// ─── Kalender — „Belegt“ aus den weiteren Konten in den EIGENEN Google-Hauptkalender spiegeln (Server, 01.11.2026) ──────────
// Kevin 01.11.: „Dort wird alles zentral gesammelt“ — wer für mehrere Firmen arbeitet, plant seine Woche im eigenen Google-Kalender.
// Damit dort (und bei allen, die diesen Kalender bei Google sehen) die Zeiten der anderen Firmen belegt sind, legt MAKE OS für jeden
// Termin der weiteren Konten (lib/kalender/google/zusatz.ts) einen neutralen Block an:
//   · Titel „Belegt · <Gruppe>“ (ohne Gruppe: die Bezeichnung des Kontos) — keine Beschreibung, kein Ort, keine Gäste, keine Erinnerung,
//     `transparency: opaque`, `visibility: private`, Marke `extendedProperties.private.makeOsSpiegel = <Quelle>|<Kennung>`.
//   · Feste Google-ID aus der Spiegel-Kennung (`eventIdFuer`) → idempotent; ändert sich die Quelle, wird der Block ersetzt, verschwindet
//     sie (gelöscht, abgesagt, „frei“, aus dem Fenster, Konto getrennt, Schalter aus), wird er gelöscht. Ganztägige bleiben ganztägig.
//   · Fenster heute − 1 bis heute + 60 Tage; höchstens `SPIEGEL_MAX` Blöcke je Person, höchstens `SCHRITTE_JE_LAUF` Schreibungen je Lauf
//     (der Rest folgt im nächsten Takt — Drossel).
//   · Keine Schleife: Ereignisse mit Spiegel-Marke liest MAKE OS nie als Termin (`objekteAus` in abbilden.ts) — weder im Hauptkalender
//     (die Quelle zählt schon, Verfügbarkeit also einmal) noch in einem weiteren Konto (dort würden sie sonst zurückgespiegelt).
//     Steht dieselbe Einladung schon im Hauptkalender, wird sie nicht gespiegelt.
//   · Geschrieben wird NUR über die Google-Schreibwege (schreiben.ts: `googleSpiegelSetzen/Entfernen`), mit der Verbindung der Person
//     selbst, nie mit Post an Gäste. 429/Überlast → Pause nach Retry-After, sonst 2 → 30 Min.
//   · Schalten darf nur die Person selbst (Route /api/kalender/google/zusatz, `eigenePerson`) — Vorgabe AN.
//   · Bestand `kalender-belegt-spiegel--<person>`: je Block nur Kennungen, Google-ID, ETag und ein Fingerabdruck (keine Titel, keine
//     Zeiten). Änderungsprotokoll nur mit der Google-ID.

import { createHash } from 'node:crypto';
import { loadJson, updateJson, bestandEntfernen } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { protokolliere, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { ladeZusatz, gruppeVon, spiegeltBelegt, type ZusatzKonto } from '@/lib/google/zusatz';
import { GoogleUeberlastet } from '@/lib/google/http';
import { GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { tagPlus } from '../zeit';
import { termineAus, uidVon, type Termin } from '../ics';
import { STANDARD_ZONE } from '../zeitzone';
import { ladeGoogleStand } from './stand';
import { objekteAus, eventIdFuer, gZeitAus, uidVonEvent, SPIEGEL_MARKE, type GBody, type GEvent } from './abbilden';
import { ladeZusatzSpiegel, kalenderIdVon, pauseNach, type ZusatzKalenderStand } from './zusatz';

const PERSON = /^[a-z0-9-]{1,40}$/;
export const SPIEGEL_ZURUECK = 1;
export const SPIEGEL_VOR = 60;
export const SPIEGEL_MAX = 500;
export const SCHRITTE_JE_LAUF = 60;
export const belegtSpiegelName = (person: string) => `kalender-belegt-spiegel--${person}`;

export interface SpiegelBlock { id: string; etag?: string; hash: string; konto: string }
export interface BelegtSpiegelBestand {
  v: 1;
  bloecke: Record<string, SpiegelBlock>;
  at?: string;
  /** Noch nicht geschriebene Änderungen (Drossel) — der Takt holt sie nach. */
  offen?: number;
  /** Mehr als `SPIEGEL_MAX` Quell-Termine im Fenster: die spätesten sind nicht gespiegelt. */
  gekappt?: number;
  fehler?: string;
  fehlerFolge?: number;
  pauseBis?: string;
}

/** Ein gewünschter Block (rein). `schluessel` = Fingerabdruck aus Quelle + Termin-Kennung (stabil bei Verschieben). */
export interface SollBlock { schluessel: string; konto: string; quelle: string; titel: string; start: string; ende: string; ganztags: boolean; hash: string }

const kurz = (t: string, n = 24) => createHash('sha256').update(t).digest('hex').slice(0, n);
export const spiegelUid = (schluessel: string) => `makeos-belegt-${schluessel}`;

/**
 * Welche Blöcke soll der Hauptkalender tragen? Rein. `konten` = die weiteren Konten der Person, `kalender` = ihr Spiegel (Kennung →
 * Stand), `vorhanden` = UIDs im Hauptkalender (dieselbe Einladung dort → kein Block). Nur verbundene Konten mit Schalter an, nur gewählte
 * Kalender, nur Termine, die belegen (nicht abgesagt, nicht „frei“). Dieselbe Einladung in zwei Konten → ein Block.
 */
export function sollBloecke(konten: readonly ZusatzKonto[], kalender: Readonly<Record<string, ZusatzKalenderStand>>, vorhanden: ReadonlySet<string>, heute: string): { bloecke: SollBlock[]; gekappt: number } {
  const von = tagPlus(heute, -SPIEGEL_ZURUECK), bis = tagPlus(heute, SPIEGEL_VOR + 1);
  const raus: SollBlock[] = [];
  const gesehen = new Set<string>();
  for (const konto of konten) {
    if (konto.status !== 'verbunden' || !spiegeltBelegt(konto)) continue;
    const titel = `Belegt · ${gruppeVon(konto) ?? konto.label}`.slice(0, 120);
    for (const [kennung, k] of Object.entries(kalender)) {
      if (k.konto !== konto.id || !konto.kalender.includes(k.kalenderId)) continue;
      const info = { id: kalenderIdVon(kennung), name: k.name };
      for (const o of objekteAus(k.events, kennung).objekte) {
        const u = uidVon(o.ics);
        if (u && vorhanden.has(u)) continue;
        for (const t of termineAus(o, info, von, bis) as Termin[]) {
          if (t.abgesagt || t.beschaeftigt === false) continue;
          const doppel = `${t.uid}|${t.start}|${t.ende}`;
          if (gesehen.has(doppel)) continue;
          gesehen.add(doppel);
          const schluessel = kurz(`${kennung}|${t.id}`);
          raus.push({ schluessel, konto: konto.id, quelle: kennung, titel, start: t.start, ende: t.ende, ganztags: t.ganztags, hash: kurz(`${titel}|${t.start}|${t.ende}|${t.ganztags ? 1 : 0}`, 16) });
        }
      }
    }
  }
  raus.sort((a, b) => a.start.localeCompare(b.start) || a.schluessel.localeCompare(b.schluessel));
  return { bloecke: raus.slice(0, SPIEGEL_MAX), gekappt: Math.max(0, raus.length - SPIEGEL_MAX) };
}

/** Der Google-Körper eines Blocks — neutral, ohne Inhalte der Quelle. Rein. */
export function blockBody(b: SollBlock): GBody & { id: string } {
  const uid = spiegelUid(b.schluessel);
  return {
    id: eventIdFuer(uid),
    summary: b.titel,
    start: gZeitAus(b.start, b.ganztags, STANDARD_ZONE),
    end: gZeitAus(b.ganztags && b.ende <= b.start ? tagPlus(b.start.slice(0, 10), 1) : b.ende, b.ganztags, STANDARD_ZONE),
    transparency: 'opaque', visibility: 'private',
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { makeOsId: uid, [SPIEGEL_MARKE]: `${b.quelle}|${b.schluessel}` } },
  };
}

export interface SpiegelPlan { setzen: SollBlock[]; entfernen: { schluessel: string; block: SpiegelBlock }[] }
/** Unterschied zwischen Soll und Gespeichertem. Rein. */
export function spiegelPlan(soll: readonly SollBlock[], ist: Readonly<Record<string, SpiegelBlock>>): SpiegelPlan {
  const s = new Map(soll.map(b => [b.schluessel, b]));
  return {
    setzen: soll.filter(b => ist[b.schluessel]?.hash !== b.hash),
    entfernen: Object.entries(ist).filter(([k]) => !s.has(k)).map(([schluessel, block]) => ({ schluessel, block })),
  };
}

export async function ladeBelegtSpiegel(person: string): Promise<BelegtSpiegelBestand | null> {
  if (!PERSON.test(person)) return null;
  const b = await loadJson<BelegtSpiegelBestand>(belegtSpiegelName(person));
  return b && b.v === 1 && b.bloecke && typeof b.bloecke === 'object' ? b : null;
}

export interface SpiegelErgebnis { neu: number; geaendert: number; geloescht: number; offen: number; aus?: 'kein-hauptkalender' | 'pause' }
const laeuft = new Map<string, Promise<SpiegelErgebnis>>();

/**
 * Den Hauptkalender der Person auf den Stand der weiteren Konten bringen. Je Person nie doppelt. Ohne schreibbaren Google-Hauptkalender
 * passiert nichts (die gemerkten Blöcke bleiben gemerkt, bis er wieder da ist). Nach Fehlern erst nach der Pause (`erzwingen` übergeht sie).
 */
export function belegtSpiegeln(person: string, opt: { erzwingen?: boolean } = {}): Promise<SpiegelErgebnis> {
  if (!PERSON.test(person)) return Promise.resolve({ neu: 0, geaendert: 0, geloescht: 0, offen: 0 });
  const l = laeuft.get(person);
  if (l) return l;
  const p = lauf(person, !!opt.erzwingen).finally(() => laeuft.delete(person));
  laeuft.set(person, p);
  return p;
}

async function lauf(person: string, erzwingen: boolean): Promise<SpiegelErgebnis> {
  const leer: SpiegelErgebnis = { neu: 0, geaendert: 0, geloescht: 0, offen: 0 };
  const [haupt, z, zs, alt] = await Promise.all([ladeGoogleStand(person), ladeZusatz(person), ladeZusatzSpiegel(person), ladeBelegtSpiegel(person)]);
  if (!haupt || !haupt.schreibbar) return { ...leer, aus: 'kein-hauptkalender' };
  if (!erzwingen && alt?.pauseBis && Date.parse(alt.pauseBis) > Date.now()) return { ...leer, aus: 'pause' };
  const ist = alt?.bloecke ?? {};
  // Dieselbe Einladung im Hauptkalender → kein Block (UID wie MAKE OS sie kennt, dazu Googles iCalUID).
  const vorhanden = new Set<string>();
  for (const e of Object.values(haupt.events) as GEvent[]) { if (e.privat?.[SPIEGEL_MARKE]) continue; vorhanden.add(uidVonEvent(e)); if (e.iCalUID) vorhanden.add(e.iCalUID); }
  const { bloecke: soll, gekappt } = sollBloecke(z.konten, zs?.kalender ?? {}, vorhanden, localDay());
  const plan = spiegelPlan(soll, ist);
  if (!plan.setzen.length && !plan.entfernen.length) {
    if (alt && (alt.offen || alt.fehler || alt.pauseBis || (alt.gekappt ?? 0) !== gekappt)) await speichern(person, cur => ({ ...cur, offen: 0, gekappt, fehler: undefined, fehlerFolge: undefined, pauseBis: undefined, at: new Date().toISOString() }));
    if (!Object.keys(ist).length && alt) await bestandEntfernen(belegtSpiegelName(person), { tageskopien: true }).catch(() => { /* nächster Lauf */ });
    return leer;
  }
  const { googleSpiegelSetzen, googleSpiegelEntfernen, googleSpiegelAnwenden } = await import('./schreiben');
  const neuEv: GEvent[] = [], wegIds: string[] = [];
  const geschrieben: Record<string, SpiegelBlock> = {}, entfernt: string[] = [];
  const protokoll: Aenderung[] = [];
  let schritte = 0, fehler: unknown = null;
  // Erst löschen (gibt Platz frei, wenn Termine verschoben wurden), dann setzen — beides gedrosselt.
  for (const e of plan.entfernen) {
    if (schritte >= SCHRITTE_JE_LAUF) break;
    try { await googleSpiegelEntfernen(person, e.block.id, e.block.etag); } catch (err) { fehler = err; break; }
    schritte++; entfernt.push(e.schluessel); wegIds.push(e.block.id); protokoll.push({ liste: 'belegt-spiegel', op: 'geloescht', id: e.block.id });
  }
  if (!fehler) for (const b of plan.setzen) {
    if (schritte >= SCHRITTE_JE_LAUF) break;
    const body = blockBody(b);
    let ev: GEvent;
    try { ev = await googleSpiegelSetzen(person, body, ist[b.schluessel]?.etag); } catch (err) { fehler = err; break; }
    schritte++; neuEv.push(ev);
    geschrieben[b.schluessel] = { id: ev.id, ...(ev.etag ? { etag: ev.etag } : {}), hash: b.hash, konto: b.konto };
    protokoll.push({ liste: 'belegt-spiegel', op: ist[b.schluessel] ? 'geaendert' : 'neu', id: ev.id });
  }
  const offen = plan.setzen.length + plan.entfernen.length - schritte;
  const jetzt = Date.now();
  await speichern(person, cur => {
    const bloecke = { ...cur.bloecke, ...geschrieben };
    for (const k of entfernt) delete bloecke[k];
    if (!fehler) return { v: 1, bloecke, offen, gekappt, at: new Date(jetzt).toISOString() };
    const folge = (cur.fehlerFolge ?? 0) + 1;
    const anmeldung = fehler instanceof GoogleVerbindungsFehler;
    const sekunden = fehler instanceof GoogleUeberlastet ? fehler.sekunden : undefined;
    return { ...cur, bloecke, offen, gekappt, fehler: fehler instanceof Error ? fehler.message.slice(0, 200) : 'Google nicht erreichbar.', fehlerFolge: folge, pauseBis: new Date(jetzt + pauseNach(folge, anmeldung, sekunden)).toISOString() };
  });
  // Nichts mehr gespiegelt (Schalter aus, Konto getrennt) → kein leerer Bestand bleibt liegen.
  const rest = await ladeBelegtSpiegel(person).catch(() => null);
  if (rest && !Object.keys(rest.bloecke).length && !rest.fehler && !rest.offen) await bestandEntfernen(belegtSpiegelName(person), { tageskopien: true }).catch(() => { /* nächster Lauf */ });
  await googleSpiegelAnwenden(person, neuEv, wegIds).catch(() => { /* der nächste Abgleich holt sie */ });
  if (protokoll.length) await protokolliere('kalender', protokoll, { art: 'system', person }).catch(() => { /* nur Protokoll */ });
  const neu = protokoll.filter(x => x.op === 'neu').length, geaendert = protokoll.filter(x => x.op === 'geaendert').length;
  return { neu, geaendert, geloescht: entfernt.length, offen };
}

async function speichern(person: string, mutate: (cur: BelegtSpiegelBestand) => BelegtSpiegelBestand): Promise<void> {
  await updateJson<BelegtSpiegelBestand>(belegtSpiegelName(person), cur => mutate(cur && cur.v === 1 && cur.bloecke ? cur : { v: 1, bloecke: {} }));
}

/** Muss der Takt noch einmal (Drossel-Rest oder Fehler nach der Pause)? Rein. */
export function spiegelNachholen(s: BelegtSpiegelBestand | null, jetzt: number): boolean {
  if (!s) return false;
  if (s.pauseBis && Date.parse(s.pauseBis) > jetzt) return false;
  return (s.offen ?? 0) > 0 || !!s.fehler;
}

/** Für die Statusanzeige: wie viele Blöcke je Konto stehen im Hauptkalender — keine Inhalte. */
export async function belegtSpiegelStatus(person: string): Promise<{ je: Record<string, number>; offen: number; fehler?: string; gekappt?: number }> {
  const s = await ladeBelegtSpiegel(person);
  const je: Record<string, number> = {};
  for (const b of Object.values(s?.bloecke ?? {})) je[b.konto] = (je[b.konto] ?? 0) + 1;
  return { je, offen: s?.offen ?? 0, ...(s?.fehler ? { fehler: s.fehler } : {}), ...(s?.gekappt ? { gekappt: s.gekappt } : {}) };
}

/**
 * Die Haupt-Verbindung wird getrennt (lib/google/trennen.ts, solange das Token noch gilt): alle Blöcke bei Google löschen, dann den Bestand.
 * Scheitert ein Löschen, bleibt der Rest bei Google stehen (Marke „Belegt“, ohne Inhalte) — gelöscht wird der Bestand trotzdem.
 */
export async function belegtSpiegelAufloesen(person: string): Promise<{ geloescht: number; uebrig: number }> {
  const s = await ladeBelegtSpiegel(person);
  if (!s) return { geloescht: 0, uebrig: 0 };
  const { googleSpiegelEntfernen } = await import('./schreiben');
  let geloescht = 0;
  const bloecke = Object.values(s.bloecke);
  for (const b of bloecke) {
    try { await googleSpiegelEntfernen(person, b.id, b.etag); geloescht++; } catch { break; }
  }
  await bestandEntfernen(belegtSpiegelName(person), { tageskopien: true });
  return { geloescht, uebrig: bloecke.length - geloescht };
}
