// ─── Übernahme der Wochenplan-Blöcke — Server (29.09., Paket K5) ─────────────
// Was übernommen wird und warum: lib/planung/wochenplan-uebernahme.ts. Ablauf (einmal nach dem Upload, von Hand über
// die Karte im Modus „Planen“ oder `POST /api/planung/uebernahme { aktion: 'ausfuehren' }`):
//   1. Vorschau (GET) — je Person: zukünftige Blöcke (davon mit Apple-Kopie), vergangene (bleiben Archiv), schon übernommen.
//   2. Absicht `wochenplan-uebernahme` (lib/store/absichten.ts) VOR dem ersten Schreiben: Schritte `archiv`, je Block
//      `b:<person>:<id>`, `abschluss`. Daten = nur Kennungen (Titel liest jeder Schritt aus dem alten Bestand).
//   3. `archiv`: Kopie aller alten Bestände → `archiv/wochenplan-vor-uebernahme-<zeit>.json` (verschlüsselt wie alles).
//   4. je Block: Termin mit fester UID anlegen bzw. die Apple-Kopie zur Art „Block/Fokus“ machen (lib/kalender/
//      termin-server.ts: iCloud → kalender-bezug → Änderungsprotokoll), dann Kennung → UID in `wochenplan-uebernahme`.
//      Jeder Schritt ist idempotent (feste UID; schon übernommen → nichts).
//   5. `abschluss`: je Person `am` setzen. Abbruch irgendwo → die Wiederaufnahme (Start/Takt/Durchsicht) macht weiter.
// Der alte Bestand wird nie geändert. Außer dieser Datei liest ihn niemand mehr (Leser: planBloeckeLesen).

import { promises as fs } from 'fs';
import { loadJson, updateJson, datenOrdner } from '@/lib/store/local-db';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { absichtBeginnen, absichtAbschliessen, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { verbunden, ladeStand, objekteKurz } from '@/lib/kalender/icloud';
import { wandzeit } from '@/lib/kalender/zeit';
import { terminAnlegenServer, terminAendernServer } from '@/lib/kalender/termin-server';
import { icsVonPlanArt, blockAnfrage } from './bloecke';
import {
  UEBERNAHME_SPEICHER, UEBERNAHME_ARCHIV_PRAEFIX, LEER_STAND, altName, altBloecke, standSauber, uebernahmePlanen, archivBloecke, uidFuerBlock,
  type AltDatei, type UebernahmeStand, type UebernahmePlan, type ArchivBlock,
} from './wochenplan-uebernahme';

const PERSON = /^[a-z0-9-]{1,40}$/;
/** Wer spricht im Protokoll: die Person, die die Übernahme ausgelöst hat (bei der Wiederaufnahme: System). */
type WerP = { art: 'person' | 'system'; person?: string };

/** Personen mit einem alten Bestand (aus den Dateinamen, ohne Inhalte zu lesen). */
export async function altPersonen(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  const raus = new Set<string>();
  for (const n of namen) {
    if (n === 'wochenplan.json') raus.add('kevin');
    const m = /^wochenplan--([a-z0-9-]{1,40})\.json$/.exec(n);
    if (m) raus.add(m[1]);
  }
  return Array.from(raus).sort();
}

export async function ladeAlt(person: string): Promise<AltDatei | null> {
  if (!PERSON.test(person)) return null;
  return loadJson<AltDatei>(altName(person));
}

export async function ladeUebernahme(): Promise<UebernahmeStand> {
  return standSauber(await loadJson<UebernahmeStand>(UEBERNAHME_SPEICHER));
}

const jetztWand = (jetzt = new Date()) => wandzeit(jetzt);

// ── Lesen (Archiv) ───────────────────────────────────────────────────────────

/** Nicht übernommene Blöcke einer Person im Zeitraum (vergangene = Archiv; vor der Übernahme auch zukünftige, `wartet`). */
export async function archivFuer(person: string, von: string, bis: string, jetzt = new Date()): Promise<ArchivBlock[]> {
  const [datei, stand] = await Promise.all([ladeAlt(person), ladeUebernahme()]);
  return archivBloecke(person, datei, stand, von, bis, jetztWand(jetzt));
}

// ── Vorschau ────────────────────────────────────────────────────────────────

export interface VorschauPerson { person: string; zukuenftig: number; mitApple: number; vergangen: number; schon: number; beispiele: { tag: string; zeit: string; titel: string; art: string }[] }
export interface Vorschau { icloud: boolean; personen: VorschauPerson[]; offen: number; laeuft: boolean; archiv?: string }

async function plaene(jetzt: Date): Promise<UebernahmePlan[]> {
  const [personen, stand] = await Promise.all([altPersonen(), ladeUebernahme()]);
  const uids = verbunden() ? new Set(objekteKurz(await ladeStand()).map(o => o.uid)) : new Set<string>();
  const raus: UebernahmePlan[] = [];
  for (const p of personen) raus.push(uebernahmePlanen(p, await ladeAlt(p), stand, jetztWand(jetzt), uid => uids.has(uid)));
  return raus;
}

const zeitText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export async function uebernahmeVorschau(jetzt = new Date()): Promise<Vorschau> {
  const [ps, stand] = await Promise.all([plaene(jetzt), ladeUebernahme()]);
  const personen = ps.map(p => ({
    person: p.person, zukuenftig: p.offen.length, mitApple: p.offen.filter(e => e.weg === 'apple').length, vergangen: p.vergangen, schon: p.schon,
    beispiele: p.offen.slice(0, 5).map(e => ({ tag: e.block.date, zeit: zeitText(e.block.startMin), titel: e.block.titel, art: e.block.art })),
  }));
  return { icloud: verbunden(), personen, offen: personen.reduce((s, p) => s + p.zukuenftig, 0), laeuft: laufend !== null, ...(stand.archiv ? { archiv: stand.archiv } : {}) };
}

// ── Ausführen ───────────────────────────────────────────────────────────────

export const UEBERNAHME_SCHLUESSEL = 'wochenplan';
let laufend: Promise<UebernahmeErgebnis> | null = null;
export interface UebernahmeErgebnis { ok: boolean; uebernommen: number; archiv?: string; fehler?: string }

/** Die Übernahme ausführen (idempotent). `h` = Haushalt des Inhabers (Absichtsprotokoll). */
export async function uebernahmeAusfuehren(h: string, ausloeser: string | null, jetzt = new Date()): Promise<UebernahmeErgebnis> {
  if (!verbunden()) return { ok: false, uebernommen: 0, fehler: 'iCloud ist nicht verbunden — ohne iCloud gibt es nichts zu übernehmen.' };
  if (laufend) return laufend;
  laufend = (async () => {
    const ps = await plaene(jetzt);
    const bloecke = ps.flatMap(p => p.offen.map(e => ({ person: e.person, id: e.block.id })));
    const { absicht } = await absichtBeginnen(h, {
      art: 'wochenplan-uebernahme', schluessel: UEBERNAHME_SCHLUESSEL,
      schritte: ['archiv', ...bloecke.map(b => schrittName(b.person, b.id)), 'abschluss'],
      daten: { bloecke, jetzt: jetzt.toISOString() }, ...(ausloeser ? { person: ausloeser } : {}),
    });
    return lauf(h, absicht, ausloeser ? { art: 'person', person: ausloeser } : { art: 'system' });
  })().finally(() => { laufend = null; });
  return laufend;
}

const schrittName = (person: string, id: string) => `b:${person}:${id}`.slice(0, 200);

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts). */
export async function wochenplanUebernahmeFortsetzen(h: string, a: Absicht): Promise<void> {
  await lauf(h, a, a.person ? { art: 'person', person: a.person } : { art: 'system' });
}

async function lauf(h: string, absicht: Absicht, wer: WerP): Promise<UebernahmeErgebnis> {
  let uebernommen = 0;
  const r = await mitVorgang(h, absicht, async v => {
    // 1. Archivkopie aller alten Bestände (einmal; ein Abbruch danach legt höchstens eine zweite Kopie ab).
    await v.schritt('archiv', async () => {
      const personen = await altPersonen();
      const inhalt: Record<string, AltDatei | null> = {};
      for (const p of personen) inhalt[altName(p)] = await ladeAlt(p);
      const datei = await archivSchreiben(`${UEBERNAHME_ARCHIV_PRAEFIX}${archivZeit(new Date().toISOString())}.json`, inhalt);
      await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => ({ ...standSauber(cur ?? LEER_STAND), archiv: datei }));
      return datei;
    });
    // 2. je Block ein Termin (fest: UID; schon übernommen → nichts).
    const liste = v.daten<{ person: string; id: string }[]>('bloecke') ?? [];
    for (const b of liste) {
      await v.schritt(schrittName(b.person, b.id), async () => {
        if (await blockUebernehmen(b.person, b.id, wer)) uebernommen++;
      });
    }
    // 3. Abschluss je Person.
    await v.schritt('abschluss', async () => {
      const am = new Date().toISOString();
      const personen = Array.from(new Set(liste.map(b => b.person)));
      await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => {
        const s = standSauber(cur ?? LEER_STAND);
        for (const p of personen) s.personen[p] = { ...(s.personen[p] ?? { bloecke: {} }), am };
        return s;
      });
    });
    return (await ladeUebernahme()).archiv;
  });
  await absichtAbschliessen(h, absicht.id, 'fertig');
  return { ok: true, uebernommen, ...(r ? { archiv: r } : {}) };
}

/** Einen Block übernehmen (idempotent). true = in diesem Aufruf übernommen. */
async function blockUebernehmen(person: string, blockId: string, wer: WerP): Promise<boolean> {
  const stand = await ladeUebernahme();
  if (stand.personen[person]?.bloecke[blockId]) return false;
  const b = altBloecke(await ladeAlt(person)).find(x => x.id === blockId);
  if (!b) return false; // im alten Bestand nicht mehr da — nichts zu tun
  const kalenderWer = person === 'malin' ? 'malin' : person === 'kevin' ? 'kevin' : null;
  if (!kalenderWer) return false;
  const uids = new Set(objekteKurz(await ladeStand()).map(o => o.uid));
  let uid: string;
  const { art, blockArt } = icsVonPlanArt(b.art);
  if (b.appleUid && uids.has(b.appleUid)) {
    // Die Apple-Kopie wird DER Block (keine zweite): Art/Unterart setzen, Bezug nachziehen.
    uid = b.appleUid;
    await terminAendernServer(uid, { art, ...(blockArt ? { blockArt } : {}) }, wer, { ...(b.taskId ? { aufgabeId: b.taskId } : {}), von: person } as Record<string, string | null>);
  } else {
    const a = blockAnfrage(b, kalenderWer);
    const r = await terminAnlegenServer({
      titel: String(a.titel), start: String(a.start), ende: String(a.ende), wer: kalenderWer, art, ...(blockArt ? { blockArt } : {}), beschaeftigt: true,
      uid: uidFuerBlock(person, b.id), von: person, ...(b.taskId ? { bezug: { aufgabeId: b.taskId } } : {}),
      notiz: 'Aus dem MAKE-OS-Wochenplan übernommen.',
    }, wer);
    uid = r.uid;
  }
  await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => {
    const s = standSauber(cur ?? LEER_STAND);
    const p = s.personen[person] ?? { bloecke: {} };
    return { ...s, personen: { ...s.personen, [person]: { ...p, bloecke: { ...p.bloecke, [blockId]: uid } } } };
  });
  return true;
}
