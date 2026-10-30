// ─── MAKE OS — Social: Reel-Werkstatt — Bestand, Schreibweg, Arbeit im Hintergrund (Server) — 28.10.2026, Malin-Paket ─────────────────────
// Bestand `social-werkstatt--<haushalt>` (verschlüsselt wie jeder Bestand): Aufträge mit Clips (nur Kennungen der Medien-Ablage), Transkripten,
// Einblendungen und Stand. Sicht: wie Social (Haushalt des Inhabers, Markttraktion) — ein Auftrag eines „nur ich“-Kanals nur für dessen Person
// (`auftragSichtbar`). Schreiben nur per Sitzung (die Route), Einzeländerungen mit Stand (409), Grenzen 413.
// Arbeit (Transkript, Rendern) läuft im App-Prozess nacheinander (EIN Lauf zur Zeit — der Server ist klein): angestoßen von der Route und
// vom Takt (`werkstattJobsImTakt`, falls ein Anstoß verloren ging). Ergebnis = neues Medium in der Ablage (lib/medien/schnitt-ablage.ts),
// gehört der auftraggebenden Person; rausgehen darf es erst nach der Freigabe eines Menschen (Ablage-Regel). Hängt der Auftrag an einem
// Beitrag, wird das Ergebnis dort angehängt (die Freigabe des Beitrags fällt damit zurück — neuer Inhalt, neuer Blick).

import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebStrom } from 'node:stream/web';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { ladeSocial } from '../server';
import { kanalSichtbar } from '../daten';
import type { SocialDatei } from '../typen';
import {
  auftragAus, clipsAus, einblendungenAus, transkriptAus, werkstattPruefen, assDatei, reelArgumente, bildArgumente, posterArgumente,
  wavArgumente, whisperSegmente, gesamtDauer, WerkstattAbgelehnt, WERKSTATT_GRENZEN, WERKSTATT_FORMATE,
  type WerkstattAuftrag, type QuellInfo, type WerkstattFormat, type RenderEingabe, type Transkript,
} from './regeln';
import { ausfuehren, ffmpegPfad, whisperPfad, whisperModell, werkstattThreads, imArbeitsordner, werkzeugStand, arbeitsordnerAufraeumen } from './werkzeuge';

export const werkstattSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `social-werkstatt--${h}` : 'social-werkstatt--inhaber');
export async function werkstattSpeicher(): Promise<string> { return werkstattSpeicherFuer(await haushaltDesInhabers()); }
interface Datei { auftraege: WerkstattAuftrag[] }

/** Stand eines Auftrags (Fingerabdruck der gespeicherten Fassung) — wie Social: `geaendert` reicht, der Server stempelt ihn. */
export const auftragStand = (a: Pick<WerkstattAuftrag, 'geaendert'>) => a.geaendert;

export async function ladeWerkstatt(): Promise<WerkstattAuftrag[]> {
  const d = await loadJson<Datei>(await werkstattSpeicher());
  return (d?.auftraege ?? []).map(auftragAus).filter((a): a is WerkstattAuftrag => !!a);
}

/** Sieht diese Person den Auftrag? Ohne Kanal: jede Person im Haushalt (die Route prüft den Haushalt); mit Kanal: wie der Kanal. Rein. */
export function auftragSichtbar(a: WerkstattAuftrag, social: SocialDatei, person: string | null): boolean {
  if (!a.kanalId) return true;
  const k = social.kanaele.find(x => x.id === a.kanalId);
  return !k || person === null || kanalSichtbar(k, person);
}

// ── Quellen aus der Medien-Ablage ────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Quellen (nur Business-Ablage, nur was die Person sieht) als `QuellInfo`. */
export async function quellenLesen(person: string, ids: readonly string[]): Promise<Map<string, QuellInfo | null>> {
  const raus = new Map<string, QuellInfo | null>();
  const { betrachterFuer, mediumFinden } = await import('@/lib/medien/server');
  const b = await betrachterFuer(person);
  for (const id of new Set(ids)) {
    const f = b ? await mediumFinden(b, id) : null;
    const m = f?.medium;
    raus.set(id, m && m.bereich === 'business' && !m.geloeschtAm ? { id: m.id, art: m.art, dauerSek: m.dauerSek, ton: m.ton, name: m.name, breite: m.breite, hoehe: m.hoehe } : null);
  }
  return raus;
}

// ── Schreiben ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type WerkstattOp =
  | { op: 'anlegen'; titel?: unknown; ziel?: unknown; format?: unknown; kanalId?: unknown; folgeId?: unknown; medien?: unknown }
  | { op: 'aendern'; id: string; stand: string; felder: Record<string, unknown> }
  | { op: 'transkript'; id: string; stand: string; mediumId: string; segmente: unknown; sprache?: unknown }
  | { op: 'vorschlag-uebernehmen'; id: string; stand: string }
  | { op: 'arbeit'; id: string; stand: string; art: 'transkript' | 'render' }
  | { op: 'weg'; id: string; stand: string };

export type WerkstattAntwort = { ok: true; auftrag?: WerkstattAuftrag; weg?: true } | { ok: false; status: number; fehler: string; aktuell?: WerkstattAuftrag };

const MEDIUM = /^md-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** EINE Schreibstelle der Werkstatt (Person der Sitzung). Quellen werden VOR der Sperre gelesen (Medien-Ablage), geprüft wird in der Sperre. */
export async function werkstattSchreiben(person: string, op: WerkstattOp, jetzt = new Date()): Promise<WerkstattAntwort> {
  const social = await ladeSocial();
  const iso = jetzt.toISOString();
  // Quellen, die diese Änderung braucht.
  const neueIds: string[] = op.op === 'anlegen' && Array.isArray(op.medien) ? op.medien.filter((x): x is string => typeof x === 'string' && MEDIUM.test(x))
    : op.op === 'aendern' && Array.isArray(op.felder.clips) ? (op.felder.clips as { mediumId?: unknown }[]).map(c => String(c?.mediumId ?? '')).filter(x => MEDIUM.test(x)) : [];
  const quellen = await quellenLesen(person, neueIds);
  let raus: WerkstattAntwort = { ok: false, status: 404, fehler: 'Auftrag nicht gefunden.' };
  try {
    await updateJson<Datei>(await werkstattSpeicher(), cur => {
      const liste = (cur?.auftraege ?? []).map(auftragAus).filter((a): a is WerkstattAuftrag => !!a);
      const finde = (id: string, stand: string) => {
        const i = liste.findIndex(a => a.id === id && auftragSichtbar(a, social, person));
        if (i < 0) throw new WerkstattAbgelehnt(404, 'Auftrag nicht gefunden.');
        if (auftragStand(liste[i]) !== stand) { raus = { ok: false, status: 409, fehler: 'Jemand hat den Auftrag inzwischen geändert — neu geladen.', aktuell: liste[i] }; throw new WerkstattAbgelehnt(409, 'Stand'); }
        if (liste[i].status === 'arbeitet' && op.op !== 'weg') throw new WerkstattAbgelehnt(409, 'Der Auftrag wird gerade bearbeitet — gleich noch einmal.');
        return i;
      };
      const stempel = { geaendert: iso, geaendertVon: person };
      if (op.op === 'anlegen') {
        if (liste.length >= 500) throw new WerkstattAbgelehnt(413, 'Höchstens 500 Aufträge in der Werkstatt — alte entfernen.');
        const kanal = typeof op.kanalId === 'string' ? social.kanaele.find(k => k.id === op.kanalId && kanalSichtbar(k, person)) : undefined;
        if (op.kanalId !== undefined && !kanal) throw new WerkstattAbgelehnt(404, 'Kanal nicht gefunden.');
        const folge = typeof op.folgeId === 'string' ? social.folgen.find(f => f.id === op.folgeId && f.kanalId === kanal?.id) : undefined;
        if (op.folgeId !== undefined && !folge) throw new WerkstattAbgelehnt(404, 'Beitrag nicht gefunden (er gehört zum Kanal).');
        const ziel = op.ziel === 'bild' ? 'bild' as const : 'reel' as const;
        const format: WerkstattFormat = (WERKSTATT_FORMATE as readonly unknown[]).includes(op.format) ? op.format as WerkstattFormat : ziel === 'bild' ? '4:5' : '9:16';
        const clips = neueIds.map(id => {
          const q = quellen.get(id);
          if (!q) throw new WerkstattAbgelehnt(404, 'Ein Medium gibt es nicht in der Business-Ablage.');
          return { id: neueKennung('wc'), mediumId: id, von: 0, bis: q.art === 'bild' ? WERKSTATT_GRENZEN.bildClipVorgabe : Math.max(0.5, q.dauerSek ?? 10) };
        });
        if (clips.length > WERKSTATT_GRENZEN.clips) throw new WerkstattAbgelehnt(413, `Höchstens ${WERKSTATT_GRENZEN.clips} Clips je Auftrag.`);
        const titel = typeof op.titel === 'string' && op.titel.trim() ? op.titel.trim().slice(0, WERKSTATT_GRENZEN.titel) : folge?.titel ?? (ziel === 'bild' ? 'Neues Bild' : 'Neues Reel');
        const a = auftragAus({
          id: neueKennung('wk'), kanalId: kanal?.id, folgeId: folge?.id, titel, ziel, format, clips, transkripte: {}, untertitel: { an: true, stil: 'klar' },
          einblendungen: folge?.hooks.length ? [{ id: neueKennung('we'), text: (folge.hooks.find(h => h.id === folge.hookId) ?? folge.hooks[0]).text, von: 0, bis: 3, lage: 'oben' }] : [],
          laut: true, status: 'entwurf', von: person, angelegt: iso, ...stempel,
        })!;
        liste.push(a);
        raus = { ok: true, auftrag: a };
      } else if (op.op === 'aendern') {
        const i = finde(op.id, op.stand);
        const alt = liste[i];
        const f = op.felder;
        const clips = f.clips !== undefined ? clipsAus(f.clips, () => neueKennung('wc')) : alt.clips;
        for (const c of clips) if (!alt.clips.some(x => x.mediumId === c.mediumId) && !quellen.get(c.mediumId)) throw new WerkstattAbgelehnt(404, 'Ein Medium gibt es nicht in der Business-Ablage.');
        const neu = auftragAus({
          ...alt, clips,
          ...(typeof f.titel === 'string' ? { titel: f.titel } : {}),
          ...((WERKSTATT_FORMATE as readonly unknown[]).includes(f.format) ? { format: f.format } : {}),
          ...(f.einblendungen !== undefined ? { einblendungen: einblendungenAus(f.einblendungen, () => neueKennung('we')) } : {}),
          ...(f.untertitel && typeof f.untertitel === 'object' ? { untertitel: { ...alt.untertitel, ...(f.untertitel as object) } } : {}),
          ...(typeof f.laut === 'boolean' ? { laut: f.laut } : {}),
          // Neuer Inhalt → das alte Ergebnis bleibt als Medium, gilt aber nicht mehr als Stand dieses Auftrags.
          status: 'entwurf', fehler: undefined, ...stempel,
        })!;
        liste[i] = neu;
        raus = { ok: true, auftrag: neu };
      } else if (op.op === 'transkript') {
        const i = finde(op.id, op.stand);
        if (!liste[i].clips.some(c => c.mediumId === op.mediumId)) throw new WerkstattAbgelehnt(404, 'Diese Quelle gehört nicht zum Auftrag.');
        const t = transkriptAus(op.segmente, op.sprache, iso);
        liste[i] = auftragAus({ ...liste[i], transkripte: { ...liste[i].transkripte, [op.mediumId]: t }, status: 'entwurf', ...stempel })!;
        raus = { ok: true, auftrag: liste[i] };
      } else if (op.op === 'vorschlag-uebernehmen') {
        const i = finde(op.id, op.stand);
        const v = liste[i].vorschlag;
        if (!v) throw new WerkstattAbgelehnt(404, 'Kein Vorschlag da.');
        liste[i] = auftragAus({
          ...liste[i], clips: v.clips.map(c => ({ ...c, id: neueKennung('wc') })), einblendungen: v.einblendungen.map(e => ({ ...e, id: neueKennung('we') })),
          vorschlag: undefined, status: 'entwurf', ...stempel,
        })!;
        raus = { ok: true, auftrag: liste[i] };
      } else if (op.op === 'arbeit') {
        const i = finde(op.id, op.stand);
        liste[i] = auftragAus({ ...liste[i], status: 'arbeitet', fehler: undefined, arbeit: { art: op.art, seit: iso, versuche: 0 }, ...stempel })!;
        raus = { ok: true, auftrag: liste[i] };
      } else {
        const i = liste.findIndex(a => a.id === op.id && auftragSichtbar(a, social, person));
        if (i < 0) throw new WerkstattAbgelehnt(404, 'Auftrag nicht gefunden.');
        if (auftragStand(liste[i]) !== op.stand) { raus = { ok: false, status: 409, fehler: 'Jemand hat den Auftrag inzwischen geändert — neu geladen.', aktuell: liste[i] }; throw new WerkstattAbgelehnt(409, 'Stand'); }
        if (liste[i].status === 'arbeitet' && liste[i].arbeit?.gestartet) throw new WerkstattAbgelehnt(409, 'Der Auftrag wird gerade bearbeitet — erst danach entfernen.');
        liste.splice(i, 1);
        raus = { ok: true, weg: true };
      }
      return { auftraege: liste };
    });
  } catch (e) {
    if (e instanceof WerkstattAbgelehnt) return raus.ok === false && raus.status === 409 && e.message === 'Stand' ? raus : { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
  return raus;
}

/** Ein Feld des Auftrags vom Server setzen (Arbeit, Ergebnis, Vorschlag) — ohne Stand-Prüfung, nur hier im Modul. */
export async function auftragServer(id: string, fn: (a: WerkstattAuftrag) => Partial<WerkstattAuftrag> | null): Promise<WerkstattAuftrag | null> {
  let neu: WerkstattAuftrag | null = null;
  await updateJson<Datei>(await werkstattSpeicher(), cur => {
    const liste = (cur?.auftraege ?? []).map(auftragAus).filter((a): a is WerkstattAuftrag => !!a);
    const i = liste.findIndex(a => a.id === id);
    if (i < 0) return cur as Datei;
    const teil = fn(liste[i]);
    if (!teil) return cur as Datei;
    liste[i] = auftragAus({ ...liste[i], ...teil, geaendert: new Date().toISOString() })!;
    neu = liste[i];
    return { auftraege: liste };
  });
  return neu;
}

/** Vorschlag der KI am Auftrag ablegen (die Route rechnet ihn, lib/social/werkstatt/vorschlag.ts). */
export const vorschlagAblegen = (id: string, v: NonNullable<WerkstattAuftrag['vorschlag']>) => auftragServer(id, () => ({ vorschlag: v }));

// ── Arbeit im Hintergrund ────────────────────────────────────────────────────────────────────────────────────────────────────────

let laeuft = false;
export const werkstattLaeuft = () => laeuft;
/** Nach so vielen Minuten gilt ein gestarteter Lauf als abgebrochen (Neustart) — höchstens zwei Wiederholungen. */
const ABGEBROCHEN_MIN = 30;
const VERSUCHE_MAX = 3;

/** Die nächste Arbeit anstoßen (nicht warten) — von der Route nach dem Einreihen und vom Takt. */
export function werkstattAnstossen(): void {
  if (laeuft) return;
  void werkstattJobsImTakt().catch(e => console.error('[werkstatt]', e instanceof Error ? e.message : e));
}

export async function werkstattJobsImTakt(jetzt = new Date()): Promise<{ erledigt: number }> {
  if (laeuft) return { erledigt: 0 };
  laeuft = true;
  let erledigt = 0;
  try {
    await arbeitsordnerAufraeumen(jetzt.getTime()).catch(() => 0);
    for (let runde = 0; runde < 5; runde++) {
      const liste = await ladeWerkstatt();
      const naechste = liste
        .filter(a => a.status === 'arbeitet' && a.arbeit && (!a.arbeit.gestartet || Date.parse(a.arbeit.gestartet) < jetzt.getTime() - ABGEBROCHEN_MIN * 60_000))
        .sort((x, y) => (x.arbeit!.seit).localeCompare(y.arbeit!.seit))[0];
      if (!naechste) break;
      if ((naechste.arbeit!.versuche ?? 0) >= VERSUCHE_MAX) {
        await auftragServer(naechste.id, () => ({ status: 'fehler', arbeit: undefined, fehler: 'Mehrfach abgebrochen — bitte neu starten.' }));
        continue;
      }
      const a = await auftragServer(naechste.id, x => ({ arbeit: { ...x.arbeit!, gestartet: new Date().toISOString(), versuche: (x.arbeit!.versuche ?? 0) + 1 } }));
      if (!a) continue;
      const r = a.arbeit!.art === 'transkript' ? await transkriptLauf(a) : await renderLauf(a);
      erledigt++;
      if (!r.ok) await auftragServer(a.id, () => ({ status: 'fehler', arbeit: undefined, fehler: r.fehler }));
    }
    // Auto-Reel (28.10.): Aufträge ohne Klick einen Schritt weiter (Schnitt, Rendern einreihen, Beitrag anlegen). Reiht es neue Arbeit ein,
    // läuft sie in der nächsten Runde dieses Laufs bzw. im nächsten Takt.
    const { autoWeiter } = await import('./auto');
    await autoWeiter(jetzt).catch(e => console.warn(`[werkstatt] Auto-Reel: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`));
  } finally { laeuft = false; }
  return { erledigt };
}

/** Eine Quelle entschlüsselt in den Arbeitsordner (nur, was die Person sieht; Video mit nicht freigegebenem Ton nie). */
async function quelleLaden(person: string, mediumId: string, ziel: string): Promise<{ ok: true; typ: string } | { ok: false; fehler: string }> {
  const { inhaltLesen } = await import('@/lib/medien/upload-server');
  const r = await inhaltLesen(person, mediumId, 'original', null, null);
  if (!r.ok) return { ok: false, fehler: r.fehler };
  if (!r.inhalt.strom) return { ok: false, fehler: 'Quelle leer.' };
  await pipeline(Readable.fromWeb(r.inhalt.strom as unknown as WebStrom<Uint8Array>), createWriteStream(ziel, { mode: 0o600 }));
  return { ok: true, typ: r.inhalt.kopf['Content-Type'] };
}

type LaufR = { ok: true } | { ok: false; fehler: string };

async function transkriptLauf(a: WerkstattAuftrag): Promise<LaufR> {
  const w = await werkzeugStand();
  if (!w.ffmpeg) return { ok: false, fehler: 'ffmpeg fehlt auf dieser Instanz — Untertitel gehen erst nach der Einrichtung (UPDATES.md).' };
  if (!w.whisper) return { ok: false, fehler: w.modell ? 'whisper.cpp fehlt auf dieser Instanz.' : 'Das Sprachmodell für Untertitel fehlt (deploy/whisper-modell.sh).' };
  const quellen = await quellenLesen(a.von, a.clips.map(c => c.mediumId));
  const social = await ladeSocial();
  const sprache = social.kanaele.find(k => k.id === a.kanalId)?.sprache ?? 'de';
  const neu: Record<string, Transkript> = {};
  const r = await imArbeitsordner(async ordner => {
    for (const [id, q] of quellen) {
      if (!q || q.art !== 'video' || q.ton !== 'an') continue; // ohne freigegebenen Ton keine Untertitel
      const v = path.join(ordner, `${id}.bin`), wav = path.join(ordner, `${id}.wav`), aus = path.join(ordner, id);
      const l = await quelleLaden(a.von, id, v);
      if (!l.ok) return { ok: false as const, fehler: l.fehler };
      const x = await ausfuehren(ffmpegPfad(), wavArgumente(v, wav), { zeitMs: 10 * 60_000, ordner });
      if (!x.ok) return { ok: false as const, fehler: 'Ton ließ sich nicht lesen.' };
      const y = await ausfuehren(whisperPfad(), ['-m', whisperModell(), '-f', wav, '-l', sprache, '-oj', '-of', aus, '-ml', '42', '-sow', '-t', String(werkstattThreads()), '-np'], { zeitMs: 20 * 60_000, ordner });
      if (!y.ok) return { ok: false as const, fehler: y.zeitUeber ? 'Untertitel: Zeitlimit überschritten.' : 'Untertitel: whisper.cpp brach ab.' };
      const roh = await fs.readFile(`${aus}.json`, 'utf8').then(t => JSON.parse(t) as unknown).catch(() => null);
      neu[id] = { segmente: whisperSegmente(roh), sprache, am: new Date().toISOString() };
    }
    return { ok: true as const };
  });
  if (!r.ok) return r;
  await auftragServer(a.id, x => ({ transkripte: { ...x.transkripte, ...neu }, status: 'entwurf', arbeit: undefined }));
  if (!Object.keys(neu).length) await auftragServer(a.id, () => ({ fehler: 'Keine Quelle mit freigegebenem Ton — Untertitel gibt es nur bei Videos mit Ton „an“.' }));
  return { ok: true };
}

async function renderLauf(a: WerkstattAuftrag): Promise<LaufR> {
  const w = await werkzeugStand();
  if (!w.ffmpeg) return { ok: false, fehler: 'ffmpeg fehlt auf dieser Instanz — Rendern geht erst nach der Einrichtung (UPDATES.md).' };
  const quellen = await quellenLesen(a.von, a.clips.map(c => c.mediumId));
  const gruende = werkstattPruefen(a, quellen);
  if (gruende.length) return { ok: false, fehler: gruende[0] };
  const ergebnis = await imArbeitsordner(async ordner => {
    const ein: RenderEingabe[] = [];
    const geladen = new Map<string, string>();
    for (const c of a.clips) {
      const q = quellen.get(c.mediumId)!;
      let p = geladen.get(c.mediumId);
      if (!p) {
        p = path.join(ordner, `${c.mediumId}.bin`);
        const l = await quelleLaden(a.von, c.mediumId, p);
        if (!l.ok) return { ok: false as const, fehler: l.fehler };
        geladen.set(c.mediumId, p);
      }
      ein.push({ pfad: p, art: q.art, ton: q.art === 'video' && q.ton === 'an' });
    }
    const assText = assDatei(a);
    const ass = assText ? path.join(ordner, 'text.ass') : null;
    if (ass && assText) await fs.writeFile(ass, assText, { mode: 0o600 });
    const aus = path.join(ordner, a.ziel === 'bild' ? 'ergebnis.jpg' : 'ergebnis.mp4');
    const args = a.ziel === 'bild' ? bildArgumente(a, ein[0].pfad, ass, aus) : reelArgumente(a, ein, ass, aus, werkstattThreads());
    const x = await ausfuehren(ffmpegPfad(), args, { zeitMs: 30 * 60_000, ordner });
    if (!x.ok) return { ok: false as const, fehler: x.zeitUeber ? 'Rendern: Zeitlimit überschritten.' : `Rendern brach ab${x.fehler ? ` (${x.fehler.split('\n').pop()?.slice(0, 160)})` : ''}.` };
    const bytes = await fs.readFile(aus);
    if (bytes.length > WERKSTATT_GRENZEN.bytesMax) return { ok: false as const, fehler: 'Das Ergebnis ist größer als 300 MB (Instagram-Grenze) — kürzer schneiden.' };
    let poster: Buffer | undefined, raster: Buffer | undefined;
    if (a.ziel === 'reel') {
      const p = path.join(ordner, 'poster.jpg'), r = path.join(ordner, 'raster.jpg');
      const t = Math.min(1, gesamtDauer(a.clips) / 2);
      if ((await ausfuehren(ffmpegPfad(), posterArgumente(aus, t, 1568, p), { zeitMs: 60_000, ordner })).ok) poster = await fs.readFile(p).catch(() => undefined);
      if ((await ausfuehren(ffmpegPfad(), posterArgumente(aus, t, 480, r), { zeitMs: 60_000, ordner })).ok) raster = await fs.readFile(r).catch(() => undefined);
    }
    const { schnittMediumAblegen } = await import('@/lib/medien/schnitt-ablage');
    const { FORMAT_MASSE } = await import('./regeln');
    const m = await schnittMediumAblegen({
      person: a.von, quellen: Array.from(new Set(a.clips.map(c => c.mediumId))), bytes, poster, raster, name: `${a.titel} · ${a.format}`,
      ...(a.ziel === 'reel' ? { dauerSek: gesamtDauer(a.clips), ...FORMAT_MASSE[a.format] } : {}),
    });
    return m.ok ? { ok: true as const, id: m.medium.id } : { ok: false as const, fehler: m.fehler };
  });
  if (!ergebnis.ok) return ergebnis;
  await auftragServer(a.id, () => ({ status: 'fertig', arbeit: undefined, ergebnis: ergebnis.id, fehler: undefined }));
  if (a.folgeId) {
    const { socialSystemSchreiben } = await import('../server');
    await socialSystemSchreiben([{ op: 'medien-setzen', folgeId: a.folgeId, medien: [ergebnis.id] }], new Date()).catch(() => null);
  }
  // Auto-Reel meldet sich selbst, wenn der Beitrag steht (lib/social/werkstatt/auto.ts) — hier nur von Hand angestoßene Aufträge.
  if (!a.auto) await melde({ an: a.von, art: 'medien', titel: `Werkstatt: „${a.titel}“ ist fertig — ansehen und freigeben`, link: WEG.marketing('social'), von: 'zoe' }).catch(() => {});
  return { ok: true };
}

/** Für die Oberfläche: stehen die Werkzeuge? (nur ja/nein, nie Pfade) */
export async function werkstattBereit(): Promise<{ rendern: boolean; untertitel: boolean }> {
  const w = await werkzeugStand().catch(() => ({ ffmpeg: false, whisper: false, modell: false }));
  return { rendern: w.ffmpeg, untertitel: w.ffmpeg && w.whisper };
}
