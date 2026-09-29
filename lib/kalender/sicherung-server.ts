// ─── Kalender — tägliche Sicherung und Wiederherstellung (Server, 29.09., R-K1 #K5) ─
// Was, warum, welche Regeln: lib/kalender/sicherung.ts. Hier nur der Weg:
//   täglich    Der Takt (app/api/zoe/takt, gestaffelt über lib/kalender/takt-jobs.ts) ruft `kalenderSicherungTaeglich` —
//              einmal je Berliner Tag zwischen 03:00 und 05:00, frühestens 30 Min. nach dem Start des Prozesses und nie
//              während einer iCloud-Pause (U1 M4). Je Kalender die Termine im Fenster −400 … +800 Tage (U1 H2) als
//              .ics-Text VERSCHLÜSSELT ins Archiv (lib/store/archiv.ts: Hülle mit dem Datenschlüssel, nie Klartext,
//              wenn ein Schlüssel gesetzt ist). 14 Tage je Kalender, ältere Tagesdateien fallen weg; das Nachtarchiv
//              (deploy/sicherung.sh) nimmt sie NICHT mit. Stand (nur Dateinamen, Zahlen, Fehler) im Bestand
//              `kalender-sicherung` — Register: lib/crm/speicher-register.ts.
//   zurück     `kalenderWiederherstellen` — Probelauf ohne `bestaetigt` (zählt nur), mit `bestaetigt` legt es NUR
//              Fehlendes ohne Gäste neu an (PUT If-None-Match, nie überschreiben, Teilnehmer-Sperre), protokolliert
//              je Termin (UID, nie Titel). Aufruf nur von Hand (app/api/kalender/sicherung).
//   F1 (Prüfer 1 #11): Die Sicherung trägt je Termin auch `von` (wer ihn in MAKE OS anlegte) und `privat` aus
//              `kalender-bezug` — beides steht nicht (verlässlich) im Termin selbst. Beim Zurückspielen kommen sie wieder in
//              den Bezug (sonst wäre ein privater Termin für die andere Person plötzlich lesbar); der Probelauf nennt die
//              Zahl (`bezug`) und die gesperrten Buchungstermine (`buchung`).
//   S1 #7 (29.09.): Jede fehlende .ics wird gegen die Grabsteine gelöschter Personen geprüft (Adressen im Objekt →
//              `grabsteinTrifft`, dieselben Merkmals-Fingerabdrücke wie die Sperrliste). Treffer sind gesperrt und stehen im
//              Probelauf (`grabstein`) — eine Sicherung holt eine Art.-17-Löschung nie zurück.

import { promises as fs } from 'fs';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { archivSchreiben, archivLesen, archivOrdner } from '@/lib/store/archiv';
import { protokolliere, type Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';
import { verbunden, ladeStand, holeSicherungsObjekte, objektWiederherstellen, KalenderFehler, type KalenderEintrag, type IcloudStand } from './icloud';
import { kalenderKennung, terminSchluessel } from './bezug';
import { ladeBezuege, bezugSetzen } from './bezug-server';
import { uidVon } from './ics';
import { wandzeit, tagPlus } from './zeit';
import { exportIcs, objekteAusIcs, wiederherstellPlan, exportDatei, exportDateiTeile, abgelaufen, sicherungFaellig, buchungsTermin, type WiederherstellPlan } from './sicherung';
import { grabsteineLesen, grabsteinTrifft } from '@/lib/datenschutz/grabsteine';

export const SICHERUNG_SPEICHER = 'kalender-sicherung';

export interface SicherungStand {
  /** Berliner Tag der letzten vollständigen Runde. */
  letzterTag?: string;
  letzter?: string;
  dateien: { kalender: string; kennung: string; datei: string; at: string; termine: number }[];
  /** Kalender, deren Sicherung zuletzt scheiterte (Name + Grund) — der HOI zeigt sie. */
  fehler?: { kalender: string; grund: string }[];
}
/** Je UID: wer den Termin in MAKE OS anlegte und ob er privat ist (aus `kalender-bezug`, F1 #11) — nur, wo bekannt. */
type BezugSicherung = Record<string, { von?: string; privat?: true }>;
interface ArchivInhalt { kalender: string; id: string; at: string; termine: number; ics: string; bezug?: BezugSicherung }

/**
 * Der Stand der Sicherung. Ein Lesefehler (beschädigt, falscher Schlüssel) wird NICHT verschluckt (U1 N2, CLAUDE.md:
 * nie „leer lesen und dann überschreiben“) — er geht an den Aufrufer; die Tagessicherung bricht dann ab, statt den
 * Stand mit einer leeren Liste zu ersetzen. Nur „gibt es noch nicht“ ergibt den leeren Stand.
 */
export async function ladeSicherungStand(): Promise<SicherungStand> {
  const s = await loadJson<SicherungStand>(SICHERUNG_SPEICHER);
  return s && Array.isArray(s.dateien) ? s : { dateien: [] };
}

let laeuft = false;
/** Start des Prozesses (U1 M4: die Sicherung wartet mindestens 30 Min. nach einem Start/Upload). */
const PROZESS_START = Date.now();
/** Läuft gerade eine Tagessicherung? (die übrigen Kalender-Jobs im Takt warten dann — lib/kalender/takt-jobs.ts) */
export const sicherungLaeuft = (): boolean => laeuft;

/** `pauseBis` nur, wenn der letzte Abgleich gescheitert ist (sonst ist eine alte Pause bedeutungslos). */
const aktivePause = (s: Pick<IcloudStand, 'at' | 'fehlerAt' | 'pauseBis'>): string | undefined => (s.fehlerAt && (!s.at || s.fehlerAt > s.at) ? s.pauseBis : undefined);

/** Fällig im Takt? (ohne zu sichern) — Tag, Nachtfenster, Laufzeit, iCloud-Pause. Wirft bei unlesbarem Stand. */
export async function kalenderSicherungFaellig(jetzt = new Date(), prozessStart = PROZESS_START): Promise<boolean> {
  if (laeuft || !verbunden()) return false;
  const [alt, stand] = await Promise.all([ladeSicherungStand(), ladeStand()]);
  return !!stand.at && sicherungFaellig(alt.letzterTag, wandzeit(jetzt), { laufzeitMs: jetzt.getTime() - prozessStart, pauseBis: aktivePause(stand), jetztMs: jetzt.getTime() });
}

/** Einmal je Tag (nachts): je Kalender alle Termine verschlüsselt ins Archiv. Fehler je Kalender halten die anderen nicht auf. */
export async function kalenderSicherungTaeglich(jetzt = new Date(), opt: { erzwingen?: boolean; prozessStart?: number } = {}): Promise<{ gesichert: number; fehler: number } | null> {
  if (laeuft || !verbunden()) return null;
  // F2 N6: der Riegel sitzt VOR dem ersten `await` — sonst kamen zwei Takte gleichzeitig durch (beide lasen „fällig“).
  laeuft = true;
  try {
    const alt = await ladeSicherungStand();
    const wand = wandzeit(jetzt);
    const stand = await ladeStand();
    if (!opt.erzwingen && !sicherungFaellig(alt.letzterTag, wand, { laufzeitMs: jetzt.getTime() - (opt.prozessStart ?? PROZESS_START), pauseBis: aktivePause(stand), jetztMs: jetzt.getTime() })) return null;
    if (!stand.at) return null;
    const bezuege = await ladeBezuege().catch(() => null);
    const tag = wand.slice(0, 10), at = jetzt.toISOString();
    const dateien: SicherungStand['dateien'] = [];
    const fehler: NonNullable<SicherungStand['fehler']> = [];
    for (const k of stand.kalender) {
      try {
        const objekte = await holeSicherungsObjekte(k);
        const x = exportIcs(objekte, k.name);
        const kennung = kalenderKennung(k.id);
        // `von` und `privat` je UID mitsichern (F1 #11) — unter dem Schlüssel Kalender + UID, alte Einträge unter der UID.
        const bezug: BezugSicherung = {};
        for (const o of objekte) {
          const uid = uidVon(o.ics);
          const b = uid ? bezuege?.bezuege[terminSchluessel(kennung, uid)] ?? bezuege?.bezuege[uid] : undefined;
          if (uid && b && (b.von || b.privat)) bezug[uid] = { ...(b.von ? { von: b.von } : {}), ...(b.privat ? { privat: true as const } : {}) };
        }
        const datei = await archivSchreiben(exportDatei(kennung, tag), { kalender: k.name, id: k.id, at, termine: x.termine, ics: x.ics, ...(Object.keys(bezug).length ? { bezug } : {}) } satisfies ArchivInhalt);
        dateien.push({ kalender: k.name, kennung, datei, at, termine: x.termine });
      } catch (e) { fehler.push({ kalender: k.name, grund: (e instanceof Error ? e.message : 'unbekannt').slice(0, 200) }); }
    }
    await aufraeumen(tag).catch(() => { /* nächste Nacht */ });
    // Ältere Einträge anderer Tage bleiben im Stand, solange ihre Datei noch liegt (für die Auswahl beim Zurückspielen).
    const behalten = alt.dateien.filter(d => !dateien.some(n => n.datei === d.datei) && (exportDateiTeile(d.datei)?.tag ?? '') >= tagPlus(tag, -14));
    await saveJson<SicherungStand>(SICHERUNG_SPEICHER, { letzterTag: tag, letzter: at, dateien: [...dateien, ...behalten], ...(fehler.length ? { fehler } : {}) });
    return { gesichert: dateien.length, fehler: fehler.length };
  } finally { laeuft = false; }
}

/** Tagesdateien älter als 14 Tage entfernen — nur `kalender-export-*` im Archiv, nichts sonst. */
async function aufraeumen(heute: string): Promise<number> {
  const liste = await fs.readdir(archivOrdner()).catch(() => [] as string[]);
  const weg = abgelaufen(liste, heute, tagPlus);
  for (const d of weg) await fs.unlink(`${archivOrdner()}/${d}`).catch(() => {});
  return weg.length;
}

/** `plan.buchung`: davon gesperrt, weil Termin einer Buchung · `plan.bezug`: so viele der fehlenden bekommen `von`/privat zurück (F1 #11). */
export interface WiederherstellErgebnis { kalender: string; datei: string; probelauf: boolean; plan: { fehlt: number; gesperrt: number; buchung: number; grabstein: number; geaendert: number; gleich: number; neu: number; bezug: number }; angelegt?: number; schonDa?: number; fehler?: number }

/**
 * Eine Sicherung eines Kalenders zurückspielen. Ohne `bestaetigt`: nur Probelauf (zählt, schreibt nichts). Mit
 * `bestaetigt`: legt die fehlenden Termine OHNE Gäste neu an — geänderte und Termine mit Gästen bleiben (nie
 * überschreiben, Teilnehmer-Sperre). `datei` fehlt → die neueste Sicherung dieses Kalenders.
 */
export async function kalenderWiederherstellen(kalenderName: string, opt: { datei?: string; bestaetigt?: boolean; wer: ProtokollWer }): Promise<WiederherstellErgebnis> {
  if (!verbunden()) throw new KalenderFehler('iCloud ist noch nicht verbunden.', 409);
  const stand = await ladeStand();
  const kal: KalenderEintrag | undefined = stand.kalender.find(k => k.name.trim().toLowerCase() === kalenderName.trim().toLowerCase());
  if (!kal) throw new KalenderFehler(`Kalender „${kalenderName}“ gibt es in iCloud nicht.`, 404);
  const kennung = kalenderKennung(kal.id);
  const s = await ladeSicherungStand();
  const eintrag = opt.datei
    ? s.dateien.find(d => d.datei === opt.datei && d.kennung === kennung)
    : s.dateien.filter(d => d.kennung === kennung).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!eintrag) throw new KalenderFehler('Keine Sicherung dieses Kalenders gefunden.', 404);
  const inhalt = await archivLesen<ArchivInhalt>(eintrag.datei);
  if (inhalt.id !== kal.id && kalenderKennung(inhalt.id) !== kennung) throw new KalenderFehler('Die Sicherung gehört zu einem anderen Kalender.', 409);
  const gesichert = objekteAusIcs(inhalt.ics);
  const ist = (await holeSicherungsObjekte(kal)).map(o => ({ uid: uidVon(o.ics) ?? '', ics: o.ics })).filter(o => o.uid);
  // S1 #7: Grabsteine gelöschter Personen — nie mit dem Datenordner zurückgespielt, darum hier maßgeblich.
  const grabsteine = await grabsteineLesen();
  const plan: WiederherstellPlan = wiederherstellPlan(gesichert, ist, adresse => !!grabsteinTrifft(grabsteine, { id: '', email: adresse }));
  const nachUid = new Map(gesichert.map(o => [o.uid, o.ics] as const));
  const bezug = inhalt.bezug ?? {};
  const kurz = {
    fehlt: plan.fehlt.length, gesperrt: plan.gesperrt.length, buchung: plan.gesperrt.filter(u => buchungsTermin(nachUid.get(u) ?? '')).length, grabstein: plan.grabstein.length,
    geaendert: plan.geaendert.length, gleich: plan.gleich, neu: plan.neu, bezug: plan.fehlt.filter(u => bezug[u]).length,
  };
  if (!opt.bestaetigt) return { kalender: kal.name, datei: eintrag.datei, probelauf: true, plan: kurz };
  let angelegt = 0, schonDa = 0, fehler = 0;
  for (const uid of plan.fehlt) {
    try {
      const r = await objektWiederherstellen(kal, uid, nachUid.get(uid)!);
      if (r === 'angelegt') {
        angelegt++;
        // `von`/privat zurück in den Bezug (F1 #11) — ohne sie wäre ein privater Termin für die andere Person lesbar.
        const b = bezug[uid];
        if (b) await bezugSetzen(terminSchluessel(kennung, uid), { ...(b.von ? { von: b.von } : {}), ...(b.privat ? { privat: true } : {}) }).catch(() => { /* die Verbindungsprüfung meldet den Rest */ });
        await protokolliere('kalender', [{ liste: 'wiederherstellung', op: 'neu', id: `${kennung}|${uid}`, felder: [eintrag.datei, ...(b ? Object.keys(b) : [])] }], opt.wer);
      } else schonDa++;
    } catch { fehler++; }
  }
  return { kalender: kal.name, datei: eintrag.datei, probelauf: false, plan: kurz, angelegt, schonDa, fehler };
}
