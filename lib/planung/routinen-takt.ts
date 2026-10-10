// ─── MAKE OS — Routinen 2: Erinnerungen aufs Handy und Kalender-Blöcke (Server, 10.10.) ──────────────────────────────────────
// Rein steht alles in ./routinen-erinnerung.ts — hier nur Lesen, Riegel, Senden, Kalender.
//   • `routinenErinnerungenImTakt` (app/api/zoe/takt, jede Minute): je Person mit eingeschalteter Einstellung „auch aufs Handy“
//     (`routinen-person--<person>.handy`) und Einwilligung (a) die frisch fälligen Erinnerungen (≤ 20 Min. nach der Uhrzeit) — EIN neutraler
//     Satz über den ZOE-Kanal (`anPersonMelden`, Art „erinnerung“), ohne Namen der Routine. Riegel je Tag und `<routine>@<uhr>` IN der Sperre
//     gesetzt, bevor gesendet wird (zwei Takte gleichzeitig senden nie doppelt). Business-Routinen ruhen in einer Business-freien Zeit.
//     Die Glocke braucht keinen Takt: sie leitet beim Lesen ab (lib/meldungen/speicher.ts).
//   • `routineBloeckeAbgleichen` (Morgenlauf je Person, und nach dem Speichern im Editor): die eigenen Routinen mit „Kalender-Block“ für
//     die nächsten zwei Wochen als privater Block im Kalender der Person (lib/planung/bloecke-server.ts `blockAnlegen`, feste UID →
//     idempotent); Blöcke, die nicht mehr passen (Uhrzeit/Rhythmus geändert, Schalter aus), entfernt MAKE OS — nur eigene, nur künftige.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import { wandzeit } from '@/lib/kalender/zeit';
import type { RoutinenDatei } from './typen';
import { routinenSichtbarFuer } from './bereich-sicht-server';
import { personStandSaeubern, riegelAufraeumen, routinenPersonName, type RoutinenPersonStand } from './routinen-person';
import { blockDiff, blockSoll, imFenster, offeneErinnerungen } from './routinen-erinnerung';
import { tagePlus } from './zeitraum';
import { WEG } from '@/lib/wege';

type HealthLog = Record<string, string[]>;

async function lage(person: string) {
  const [f, log, stand] = await Promise.all([
    loadJson<RoutinenDatei>('routinen'),
    loadJson<HealthLog>(speicherFuer('health-log', person)),
    loadJson<unknown>(routinenPersonName(person)),
  ]);
  const s = personStandSaeubern(stand);
  return { routinen: Array.isArray(f?.routinen) ? f!.routinen : [], log: log ?? {}, stand: s };
}

/** Handy-Erinnerungen für alle Personen mit der Einstellung (Takt). Wirft nie; Fehler als eine Zeile `[routinen] …`. */
export async function routinenErinnerungenImTakt(jetzt = new Date()): Promise<{ gesendet: number }> {
  const { alleSpeicher } = await import('@/lib/zugang/konten');
  const heute = localDay(jetzt);
  const uhr = wandzeit(jetzt).slice(11, 16);
  let gesendet = 0;
  for (const person of await alleSpeicher().catch(() => [] as string[])) {
    try {
      const l = await lage(person);
      if (!l.stand.handy) continue;
      const { gesundheitVerarbeitungErlaubt } = await import('@/lib/datenschutz/gesundheit-einwilligung');
      if (!(await gesundheitVerarbeitungErlaubt(person))) continue;
      const sichtbar = await routinenSichtbarFuer(l.routinen, person);
      const schon = new Set(l.stand.erinnert?.[heute] ?? []);
      let offen = offeneErinnerungen(sichtbar, l.log, l.stand.zaehler, heute, uhr).filter(e => imFenster(e.uhr, uhr) && !schon.has(e.schluessel));
      if (offen.some(e => e.business)) {
        const { businessFreiJetzt } = await import('@/lib/arbeitsrahmen/server');
        if ((await businessFreiJetzt(person, jetzt).catch(() => ({ frei: false }))).frei) offen = offen.filter(e => !e.business);
      }
      if (!offen.length) continue;
      // Riegel in der Sperre setzen — nur, was noch nicht gesetzt ist, wird gesendet.
      let neu: string[] = [];
      await updateJson<RoutinenPersonStand>(routinenPersonName(person), cur => {
        const s = personStandSaeubern(cur);
        const da = new Set(s.erinnert?.[heute] ?? []);
        neu = offen.map(e => e.schluessel).filter(k => !da.has(k));
        const erinnert = riegelAufraeumen({ ...(s.erinnert ?? {}), [heute]: [...da, ...neu] }, heute, (t, n) => tagePlus(t, -n));
        return { ...s, ...(erinnert ? { erinnert } : {}) };
      });
      if (!neu.length) continue;
      const [{ anPersonMelden }, { hinweisRoutine, appLink }, { aussenAdresse }] = await Promise.all([import('@/lib/zoe/an-person'), import('@/lib/datenschutz/telegram-text'), import('@/lib/innen')]);
      const link = WEG.routinen();
      const r = await anPersonMelden(person, 'erinnerung', hinweisRoutine(neu.length, appLink(aussenAdresse(), link)), { link });
      if (r.erreicht) gesendet++;
    } catch (e) {
      console.warn(`[routinen] Erinnerung übersprungen: ${e instanceof Error ? e.name : 'Fehler'}`);
    }
  }
  return { gesendet };
}

export interface BloeckeErgebnis { angelegt: number; entfernt: number; fehler?: string }

/**
 * Kalender-Blöcke der eigenen Routinen nachziehen (Morgenlauf, Editor). Schreibt über den vorhandenen Block-Weg; ohne Kalender bzw. bei einem
 * Fehler bleibt der Bestand, wie er ist (`fehler` mit Satz). Idempotent: feste UIDs, ein zweiter Lauf legt nichts doppelt an.
 */
export async function routineBloeckeAbgleichen(person: string, jetzt = new Date()): Promise<BloeckeErgebnis> {
  const heute = localDay(jetzt);
  const l = await lage(person);
  const soll = blockSoll(person, await routinenSichtbarFuer(l.routinen, person), l.log, heute);
  const d = blockDiff(soll, l.stand.bloecke ?? {}, heute);
  if (!d.anlegen.length && !d.entfernen.length && Object.keys(d.behalten).length === Object.keys(l.stand.bloecke ?? {}).length) return { angelegt: 0, entfernt: 0 };
  const [{ blockAnlegen }, { terminLoeschenServer }] = await Promise.all([import('./bloecke-server'), import('@/lib/kalender/termin-server')]);
  const wer = { art: 'system' as const, person };
  const angelegt: Record<string, { r: string; tag: string }> = {};
  const weg: string[] = [];
  let fehler: string | undefined;
  for (const b of d.anlegen) {
    try {
      const startMin = Number(b.uhr.slice(0, 2)) * 60 + Number(b.uhr.slice(3, 5));
      await blockAnlegen(person, { date: b.tag, startMin, dauerMin: b.dauerMin, titel: b.titel, art: b.erholung ? 'erholung' : 'routine', uid: b.uid, privat: true }, wer);
      angelegt[b.uid] = { r: b.routineId, tag: b.tag };
    } catch (e) { fehler = e instanceof Error ? e.message.slice(0, 200) : 'Kalender nicht erreichbar'; break; }
  }
  if (!fehler) {
    for (const uid of d.entfernen) {
      try { await terminLoeschenServer(uid, wer); weg.push(uid); } catch (e) { fehler = e instanceof Error ? e.message.slice(0, 200) : 'Kalender nicht erreichbar'; break; }
    }
  }
  // Festhalten, was wirklich geschah — auch nach einem Fehler mitten drin (die festen UIDs machen den nächsten Lauf sicher).
  await updateJson<RoutinenPersonStand>(routinenPersonName(person), cur => {
    const s = personStandSaeubern(cur);
    const alt = s.bloecke ?? {};
    const bloecke: Record<string, { r: string; tag: string }> = {};
    for (const [uid, x] of Object.entries(alt)) if (x.tag >= heute && !weg.includes(uid)) bloecke[uid] = x;
    Object.assign(bloecke, angelegt);
    const { bloecke: _b, ...rest } = s;
    return { ...rest, ...(Object.keys(bloecke).length ? { bloecke } : {}) };
  });
  return { angelegt: Object.keys(angelegt).length, entfernt: weg.length, ...(fehler ? { fehler } : {}) };
}
