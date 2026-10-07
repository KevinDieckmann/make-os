// ─── Übernahme der Wochenplan-Blöcke — Server (29.09., Paket K5) ─────────────
// Was übernommen wird und warum: lib/planung/wochenplan-uebernahme.ts. Ablauf (einmal nach dem Upload, von Hand über
// die Karte im Modus „Planen“ oder `POST /api/planung/uebernahme { aktion: 'ausfuehren' }`):
//   1. Vorschau (GET) — je Person: zukünftige Blöcke (davon mit Apple-Kopie), vergangene (bleiben Archiv), schon übernommen.
//   2. Absicht `wochenplan-uebernahme` (lib/store/absichten.ts) VOR dem ersten Schreiben: Schritte `archiv`, je Block
//      `b:<person>:<id>`, `abschluss`. Daten = nur Kennungen (Titel liest jeder Schritt aus dem alten Bestand).
//   3. `archiv`: Kopie aller alten Bestände → `archiv/wochenplan-vor-uebernahme-<zeit>.json` (verschlüsselt wie alles).
//   4. je Block: Termin mit fester UID anlegen bzw. die Apple-Kopie zur Art „Block/Fokus“ machen (lib/kalender/
//      termin-server.ts: iCloud → kalender-bezug → Änderungsprotokoll), dann Kennung → UID in `wochenplan-uebernahme`.
//      Jeder Schritt ist idempotent (feste UID; schon übernommen → nichts). F1 (Prüfer 1 #3/#4): die Apple-Kopie nur,
//      wenn sie ein änderbarer Einzeltermin ist — passt sie nicht mehr zum Block, werden Start/Ende/Titel des Blocks
//      mitgeschrieben; sonst Rückfall auf den neuen Termin mit fester UID; scheitert auch das → „übersprungen“ mit Grund
//      (Stand, nie Titel) und weiter mit dem nächsten Block. Ein Block hält die Übernahme nie auf.
//   5. `abschluss`: je Person `am` setzen. Abbruch irgendwo → die Wiederaufnahme (Start/Takt/Durchsicht) macht weiter.
//      U1 M1: ein vorübergehender Fehler (Netz, Überlast, nicht verbunden — `voruebergehenderFehler`) überspringt NICHT,
//      sondern lässt den Schritt scheitern; die Wiederaufnahme prüft zuerst `verbunden()`.
// Zurücknehmen (U1 H1, `uebernahmeZuruecknehmen`, POST { aktion: 'zuruecknehmen' }): Probelauf zählt, erst mit
// `bestaetigt` löscht es genau die Termine mit UID-Präfix `makeos-wochenplan-` (Teilnehmer-Sperre: mit Gästen nie) und
// setzt den Stand zurück — für den Rückweg zur alten Version (GO_LIVE_CHECKLISTE.md › Rückweg).
// Der alte Bestand wird nie geändert. Außer dieser Datei liest ihn niemand mehr (Leser: planBloeckeLesen).

import { promises as fs } from 'fs';
import { loadJson, updateJson, datenOrdner } from '@/lib/store/local-db';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { absichtBeginnen, absichtAbschliessen, absichtenLaden, istOffen, mitVorgang, fehlerGrund, type Absicht } from '@/lib/store/absichten';
import { verbunden, ladeStand, objekteKurz, findeObjekt, voruebergehenderFehler, KalenderFehler, HOLEN_VON, HOLEN_BIS, type IcloudStand } from '@/lib/kalender/icloud';
import { termineAus, type Termin } from '@/lib/kalender/ics';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import { terminAnlegenServer, terminAendernServer, terminLoeschenServer } from '@/lib/kalender/termin-server';
import { icsVonPlanArt, blockAnfrage } from './bloecke';
import {
  UEBERNAHME_SPEICHER, UEBERNAHME_ARCHIV_PRAEFIX, LEER_STAND, altName, altBloecke, standSauber, uebernahmePlanen, archivBloecke, uidFuerBlock,
  istUebernahmeUid, uebersprungeneFreigeben, ruecknahmeStand,
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

export interface VorschauPerson { person: string; zukuenftig: number; mitApple: number; vergangen: number; schon: number; uebersprungen: number; beispiele: { tag: string; zeit: string; titel: string; art: string }[] }
/**
 * `uebersprungen` (M1): Blöcke, die nicht übernommen werden konnten (Grund im Stand) — „Erneut versuchen“ gibt sie frei.
 * `unterbrochen`: eine Übernahme ist offen (Netz/Überlast) und wird fortgesetzt. `zuruecknehmbar` (H1): so viele Termine
 * der Übernahme (UID-Präfix) stehen im Kalender.
 */
export interface Vorschau { icloud: boolean; personen: VorschauPerson[]; offen: number; laeuft: boolean; uebersprungen: number; unterbrochen: boolean; zuruecknehmbar: number; archiv?: string }

async function plaene(jetzt: Date): Promise<UebernahmePlan[]> {
  const [personen, stand] = await Promise.all([altPersonen(), ladeUebernahme()]);
  const uids = verbunden() ? new Set(objekteKurz(await ladeStand()).map(o => o.uid)) : new Set<string>();
  const raus: UebernahmePlan[] = [];
  for (const p of personen) raus.push(uebernahmePlanen(p, await ladeAlt(p), stand, jetztWand(jetzt), uid => uids.has(uid)));
  return raus;
}

const zeitText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Ist eine Übernahme angefangen und nicht fertig (Absicht offen)? `h` fehlt → unbekannt (false). */
async function unterbrochen(h: string | null | undefined): Promise<boolean> {
  if (!h) return false;
  return (await absichtenLaden(h)).some(a => a.art === 'wochenplan-uebernahme' && istOffen(a));
}

/** Die Termine der Übernahme im Kalender (UID-Präfix, je Schlüssel einmal). */
const uebernahmeTermine = (s: IcloudStand) => Array.from(new Map(objekteKurz(s).filter(o => istUebernahmeUid(o.uid)).map(o => [o.schluessel, o] as const)).values());

export async function uebernahmeVorschau(jetzt = new Date(), h?: string | null): Promise<Vorschau> {
  const [ps, stand, offen] = await Promise.all([plaene(jetzt), ladeUebernahme(), unterbrochen(h)]);
  const personen = ps.map(p => ({
    person: p.person, zukuenftig: p.offen.length, mitApple: p.offen.filter(e => e.weg === 'apple').length, vergangen: p.vergangen, schon: p.schon, uebersprungen: p.uebersprungen,
    beispiele: p.offen.slice(0, 5).map(e => ({ tag: e.block.date, zeit: zeitText(e.block.startMin), titel: e.block.titel, art: e.block.art })),
  }));
  const zuruecknehmbar = verbunden() ? uebernahmeTermine(await ladeStand()).length : 0;
  return {
    icloud: verbunden(), personen, offen: personen.reduce((s, p) => s + p.zukuenftig, 0), laeuft: laufend !== null,
    uebersprungen: personen.reduce((s, p) => s + p.uebersprungen, 0), unterbrochen: offen, zuruecknehmbar, ...(stand.archiv ? { archiv: stand.archiv } : {}),
  };
}

/** „Erneut versuchen“ (M1): übersprungene Blöcke freigeben und die Übernahme (bzw. ihre Wiederaufnahme) starten. */
export async function uebernahmeErneut(h: string, ausloeser: string | null, jetzt = new Date()): Promise<UebernahmeErgebnis> {
  if (!verbunden()) return { ok: false, uebernommen: 0, fehler: 'iCloud ist nicht verbunden — erneut versuchen, sobald es wieder geht.' };
  await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => uebersprungeneFreigeben(standSauber(cur ?? LEER_STAND)).stand);
  return uebernahmeAusfuehren(h, ausloeser, jetzt);
}

// ── Ausführen ───────────────────────────────────────────────────────────────

export const UEBERNAHME_SCHLUESSEL = 'wochenplan';
let laufend: Promise<UebernahmeErgebnis> | null = null;
export interface UebernahmeErgebnis { ok: boolean; uebernommen: number; archiv?: string; fehler?: string; /** F1 #4: Blöcke, die nicht übernommen werden konnten (Grund im Stand). */ uebersprungen?: number }

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

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts). M1: ohne iCloud gar nicht erst anfangen (zählt als Fehlversuch, Rückzug). */
export async function wochenplanUebernahmeFortsetzen(h: string, a: Absicht): Promise<void> {
  if (!verbunden()) throw new KalenderFehler('iCloud ist nicht verbunden — die Übernahme wartet.', 503);
  await lauf(h, a, a.person ? { art: 'person', person: a.person } : { art: 'system' });
}

async function lauf(h: string, absicht: Absicht, wer: WerP): Promise<UebernahmeErgebnis> {
  let uebernommen = 0, uebersprungen = 0;
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
        const e = await blockUebernehmen(b.person, b.id, wer);
        if (e === 'uebernommen') uebernommen++;
        else if (e === 'uebersprungen') uebersprungen++;
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
  }).catch(e => {
    // M1: offen lassen — die Wiederaufnahme (Takt/Start/Durchsicht) macht weiter. Nur der Grund, nie Titel.
    console.warn(`[wochenplan-uebernahme] unterbrochen (${fehlerGrund(e)}) — wird später fortgesetzt`);
    throw e;
  });
  await absichtAbschliessen(h, absicht.id, 'fertig');
  console.info(`[wochenplan-uebernahme] fertig: ${uebernommen} übernommen${uebersprungen ? `, ${uebersprungen} übersprungen` : ''}`);
  if (uebersprungen) console.warn(`[wochenplan-uebernahme] ${uebersprungen} Block/Blöcke übersprungen (Grund im Stand wochenplan-uebernahme)`);
  return { ok: true, uebernommen, ...(uebersprungen ? { uebersprungen } : {}), ...(r ? { archiv: r } : {}) };
}

/** Die Apple-Kopie eines Blocks im Stand (erstes Vorkommen) — mit `eindeutig` (UID in genau einem Kalender). */
function appleKopie(s: IcloudStand, uid: string): { t: Termin | null; eindeutig: boolean } | null {
  const f = findeObjekt(s, uid);
  if (!f) return null;
  const heute = localDay();
  return { t: termineAus(f.obj, f.kal, tagPlus(heute, HOLEN_VON), tagPlus(heute, HOLEN_BIS))[0] ?? null, eindeutig: f.eindeutig };
}

/** Warum die Apple-Kopie nicht DER Block werden kann (null = sie kann). Nur technische Gründe, nie Titel. */
function kopieHindernis(k: { t: Termin | null; eindeutig: boolean }): string | null {
  if (!k.eindeutig) return 'Apple-Kopie steht in mehreren Kalendern';
  if (!k.t) return 'Apple-Kopie liegt außerhalb des Kalenderfensters';
  if (k.t.serie) return 'Apple-Kopie ist ein Serientermin';
  if (k.t.mitTeilnehmern) return 'Apple-Kopie hat Gäste';
  if (!k.t.bearbeitbar) return 'Apple-Kopie ist nur lesbar';
  return null;
}

/**
 * Einen Block übernehmen (idempotent). `uebernommen` = in diesem Aufruf übernommen, `schon` = nichts zu tun,
 * `uebersprungen` = ging nicht (Grund steht im Stand). Wirft nur, wenn der Stand selbst nicht geschrieben werden kann.
 */
async function blockUebernehmen(person: string, blockId: string, wer: WerP): Promise<'uebernommen' | 'schon' | 'uebersprungen'> {
  const stand = await ladeUebernahme();
  if (stand.personen[person]?.bloecke[blockId] || stand.personen[person]?.uebersprungen?.[blockId]) return 'schon';
  const b = altBloecke(await ladeAlt(person)).find(x => x.id === blockId);
  if (!b) return 'schon'; // im alten Bestand nicht mehr da — nichts zu tun
  const kalenderWer = person === 'malin' ? 'malin' : person === 'kevin' ? 'kevin' : null;
  if (!kalenderWer) return 'schon';
  const s = await ladeStand();
  const uids = new Set(objekteKurz(s).map(o => o.uid));
  const { art, blockArt } = icsVonPlanArt(b.art);
  // Der Block ist die Wahrheit (F1 #3): Titel und Zeit, wie der Planer sie zuletzt hatte.
  const a = blockAnfrage(b, kalenderWer);
  const soll = { titel: String(a.titel), start: String(a.start), ende: String(a.ende) };
  let uid: string | null = null;
  const gruende: string[] = [];
  if (b.appleUid && uids.has(b.appleUid)) {
    const k = appleKopie(s, b.appleUid);
    const hindernis = k ? kopieHindernis(k) : 'Apple-Kopie nicht mehr da';
    if (hindernis) gruende.push(hindernis);
    else {
      try {
        // Die Apple-Kopie wird DER Block (keine zweite): Art/Unterart setzen, Bezug nachziehen — und, wenn sie beim
        // Verschieben im alten Planer stehen blieb (Befund 5), Zeit und Titel des Blocks mitschreiben.
        const t = k!.t!;
        const passt = t.start.slice(0, 16) === soll.start.slice(0, 16) && t.ende.slice(0, 16) === soll.ende.slice(0, 16) && t.titel === soll.titel;
        await terminAendernServer(b.appleUid, { art, ...(blockArt ? { blockArt } : {}), ...(passt ? {} : soll) }, wer, { ...(b.taskId ? { aufgabeId: b.taskId } : {}), von: person } as Record<string, string | null>);
        uid = b.appleUid;
      } catch (e) {
        if (voruebergehenderFehler(e, verbunden())) throw e; // M1: später noch einmal, nicht überspringen
        gruende.push(`Apple-Kopie: ${fehlerGrund(e)}`);
      }
    }
  }
  if (!uid) {
    // Neuer Termin mit fester UID — auch als Rückfall, wenn die Apple-Kopie nicht der Block werden kann.
    try {
      const r = await terminAnlegenServer({
        ...soll, wer: kalenderWer, art, ...(blockArt ? { blockArt } : {}), beschaeftigt: true,
        uid: uidFuerBlock(person, b.id), von: person, eigenesIcloud: true, ...(b.taskId ? { bezug: { aufgabeId: b.taskId } } : {}),
        notiz: 'Aus dem MAKE-OS-Wochenplan übernommen.',
      }, wer);
      uid = r.uid;
    } catch (e) {
      if (voruebergehenderFehler(e, verbunden())) throw e; // M1: später noch einmal, nicht überspringen
      gruende.push(`Neuer Termin: ${fehlerGrund(e)}`);
    }
  }
  const fertig = uid;
  await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => {
    const st = standSauber(cur ?? LEER_STAND);
    const p = st.personen[person] ?? { bloecke: {} };
    if (fertig) return { ...st, personen: { ...st.personen, [person]: { ...p, bloecke: { ...p.bloecke, [blockId]: fertig } } } };
    return { ...st, personen: { ...st.personen, [person]: { ...p, uebersprungen: { ...(p.uebersprungen ?? {}), [blockId]: gruende.join(' · ').slice(0, 160) } } } };
  });
  return fertig ? 'uebernommen' : 'uebersprungen';
}

// ── Zurücknehmen (U1 H1) ────────────────────────────────────────────────────

export interface RuecknahmeErgebnis {
  ok: boolean; probelauf: boolean;
  /** Termine der Übernahme im Kalender (UID-Präfix) — davon mit Gästen/Serie/nur lesbar gesperrt. */
  termine: number; gesperrt: number;
  geloescht?: number; fehler?: number; grund?: string;
}

/**
 * „Übernahme zurücknehmen“ — für den Rückweg zur alten Version. Ohne `bestaetigt`: Probelauf (zählt nur). Mit
 * `bestaetigt`: löscht genau die Termine mit UID-Präfix `makeos-wochenplan-` (über den Server-Schreibweg: iCloud →
 * kalender-bezug → Änderungsprotokoll; Teilnehmer-Sperre: mit Gästen, Serie oder nur lesbar nie) und setzt den Stand
 * zurück (`ruecknahmeStand`). Apple-Kopien, die zum Block wurden, bleiben (der alte Stand kennt sie). Nie während
 * einer laufenden oder unterbrochenen Übernahme.
 */
export async function uebernahmeZuruecknehmen(h: string, wer: WerP, bestaetigt: boolean): Promise<RuecknahmeErgebnis> {
  if (!verbunden()) return { ok: false, probelauf: !bestaetigt, termine: 0, gesperrt: 0, grund: 'iCloud ist nicht verbunden.' };
  if (laufend || await unterbrochen(h)) return { ok: false, probelauf: !bestaetigt, termine: 0, gesperrt: 0, grund: 'Die Übernahme läuft noch oder ist unterbrochen — erst fertig werden lassen.' };
  const s = await ladeStand();
  const heute = localDay();
  const liste = uebernahmeTermine(s).map(o => {
    const f = findeObjekt(s, o.schluessel);
    const t = f ? termineAus(f.obj, f.kal, tagPlus(heute, HOLEN_VON), tagPlus(heute, HOLEN_BIS))[0] : undefined;
    return { ...o, gesperrt: !!t && (t.mitTeilnehmern || t.serie || !t.bearbeitbar) };
  });
  const gesperrt = liste.filter(x => x.gesperrt).length;
  if (!bestaetigt) return { ok: true, probelauf: true, termine: liste.length, gesperrt };
  const geloescht = new Set<string>();
  let fehler = 0;
  for (const o of liste) {
    if (o.gesperrt) continue;
    try { await terminLoeschenServer(o.schluessel, wer); geloescht.add(o.uid); } catch { fehler++; }
  }
  const vollstaendig = !gesperrt && !fehler;
  await updateJson<UebernahmeStand>(UEBERNAHME_SPEICHER, cur => ruecknahmeStand(standSauber(cur ?? LEER_STAND), geloescht, vollstaendig));
  console.info(`[wochenplan-uebernahme] zurückgenommen: ${geloescht.size} Termin(e) gelöscht${gesperrt ? `, ${gesperrt} gesperrt` : ''}${fehler ? `, ${fehler} Fehler` : ''}`);
  return { ok: vollstaendig, probelauf: false, termine: liste.length, gesperrt, geloescht: geloescht.size, fehler };
}
