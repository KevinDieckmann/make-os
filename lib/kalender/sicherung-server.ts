// ─── Kalender — tägliche Voll-Sicherung und Wiederherstellung (Server, 29.09., R-K1 #K5) ─
// Was, warum, welche Regeln: lib/kalender/sicherung.ts. Hier nur der Weg:
//   täglich    Der Takt (app/api/zoe/takt) ruft `kalenderSicherungTaeglich` — einmal je Berliner Tag ab 03:00 holt
//              sie je Kalender ALLE Termine (ohne Zeitfenster) und legt sie als .ics-Text VERSCHLÜSSELT ins Archiv
//              (lib/store/archiv.ts: Hülle mit dem Datenschlüssel, nie Klartext, wenn ein Schlüssel gesetzt ist).
//              14 Tage je Kalender, ältere Tagesdateien fallen weg. Stand (nur Dateinamen, Zahlen, Fehler) im
//              Bestand `kalender-sicherung` — Register: lib/crm/speicher-register.ts.
//   zurück     `kalenderWiederherstellen` — Probelauf ohne `bestaetigt` (zählt nur), mit `bestaetigt` legt es NUR
//              Fehlendes ohne Gäste neu an (PUT If-None-Match, nie überschreiben, Teilnehmer-Sperre), protokolliert
//              je Termin (UID, nie Titel). Aufruf nur von Hand (app/api/kalender/sicherung).

import { promises as fs } from 'fs';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { archivSchreiben, archivLesen, archivOrdner } from '@/lib/store/archiv';
import { protokolliere, type Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';
import { verbunden, ladeStand, holeAlleObjekte, objektWiederherstellen, KalenderFehler, type KalenderEintrag } from './icloud';
import { kalenderKennung } from './bezug';
import { uidVon } from './ics';
import { wandzeit, tagPlus } from './zeit';
import { exportIcs, objekteAusIcs, wiederherstellPlan, exportDatei, exportDateiTeile, abgelaufen, sicherungFaellig, type WiederherstellPlan } from './sicherung';

export const SICHERUNG_SPEICHER = 'kalender-sicherung';

export interface SicherungStand {
  /** Berliner Tag der letzten vollständigen Runde. */
  letzterTag?: string;
  letzter?: string;
  dateien: { kalender: string; kennung: string; datei: string; at: string; termine: number }[];
  /** Kalender, deren Sicherung zuletzt scheiterte (Name + Grund) — der HOI zeigt sie. */
  fehler?: { kalender: string; grund: string }[];
}
interface ArchivInhalt { kalender: string; id: string; at: string; termine: number; ics: string }

export async function ladeSicherungStand(): Promise<SicherungStand> {
  const s = await loadJson<SicherungStand>(SICHERUNG_SPEICHER).catch(() => null);
  return s && Array.isArray(s.dateien) ? s : { dateien: [] };
}

let laeuft = false;

/** Einmal je Tag (nachts): je Kalender alle Termine verschlüsselt ins Archiv. Fehler je Kalender halten die anderen nicht auf. */
export async function kalenderSicherungTaeglich(jetzt = new Date(), opt: { erzwingen?: boolean } = {}): Promise<{ gesichert: number; fehler: number } | null> {
  if (laeuft || !verbunden()) return null;
  const alt = await ladeSicherungStand();
  const wand = wandzeit(jetzt);
  if (!opt.erzwingen && !sicherungFaellig(alt.letzterTag, wand)) return null;
  laeuft = true;
  try {
    const stand = await ladeStand();
    if (!stand.at) return null;
    const tag = wand.slice(0, 10), at = jetzt.toISOString();
    const dateien: SicherungStand['dateien'] = [];
    const fehler: NonNullable<SicherungStand['fehler']> = [];
    for (const k of stand.kalender) {
      try {
        const objekte = await holeAlleObjekte(k);
        const x = exportIcs(objekte, k.name);
        const kennung = kalenderKennung(k.id);
        const datei = await archivSchreiben(exportDatei(kennung, tag), { kalender: k.name, id: k.id, at, termine: x.termine, ics: x.ics } satisfies ArchivInhalt);
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

export interface WiederherstellErgebnis { kalender: string; datei: string; probelauf: boolean; plan: { fehlt: number; gesperrt: number; geaendert: number; gleich: number; neu: number }; angelegt?: number; schonDa?: number; fehler?: number }

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
  const ist = (await holeAlleObjekte(kal)).map(o => ({ uid: uidVon(o.ics) ?? '', ics: o.ics })).filter(o => o.uid);
  const plan: WiederherstellPlan = wiederherstellPlan(gesichert, ist);
  const kurz = { fehlt: plan.fehlt.length, gesperrt: plan.gesperrt.length, geaendert: plan.geaendert.length, gleich: plan.gleich, neu: plan.neu };
  if (!opt.bestaetigt) return { kalender: kal.name, datei: eintrag.datei, probelauf: true, plan: kurz };
  let angelegt = 0, schonDa = 0, fehler = 0;
  const nachUid = new Map(gesichert.map(o => [o.uid, o.ics] as const));
  for (const uid of plan.fehlt) {
    try {
      const r = await objektWiederherstellen(kal, uid, nachUid.get(uid)!);
      if (r === 'angelegt') { angelegt++; await protokolliere('kalender', [{ liste: 'wiederherstellung', op: 'neu', id: `${kennung}|${uid}`, felder: [eintrag.datei] }], opt.wer); }
      else schonDa++;
    } catch { fehler++; }
  }
  return { kalender: kal.name, datei: eintrag.datei, probelauf: false, plan: kurz, angelegt, schonDa, fehler };
}
