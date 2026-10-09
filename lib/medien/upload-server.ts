// ─── Medien — Upload in Stücken, Inhalt lesen (Range), Belege (09.10., Paket 5) ─────────────────────────────────────────────
// Kevin 09.10.: „eigener Upload in Stücken (8 MB) über unseren Server, fortsetzbar“ — tus-artig (research/agenten/MEDIEN.md D4):
//   anlegen   POST /api/medien/upload           Sitzung `up-<uuid vom Gerät>` (idempotent; dieselbe UUID einer anderen Person → 409),
//                                               Grenzen (Foto 50 MB, Video 2 GB → 413), Album/Bereich geprüft, Schlüssel je Medium,
//                                               mehrteiliger Upload im Speicher begonnen
//   Stück     PUT  /api/medien/upload/<id>?teil=n  Länge genau, SHA-256 (Kopf `x-make-sha256`) passt, erstes Stück: Typ aus dem Inhalt (415),
//                                               verschlüsselt (Salz je Versuch) → S3-Teil; dasselbe Stück mit gleicher Prüfsumme = 200 ohne
//                                               Arbeit, mit anderer = 409; je Stück nacheinander (in diesem Prozess)
//   Vorschau  PUT  /api/medien/upload/<id>?variante=raster|ansicht|poster   JPEG/PNG ≤ 2 MB, Metadaten raus, verschlüsselt
//   Stand     GET  /api/medien/upload/<id>      welche Stücke fehlen (Weitermachen nach Abbruch/Neuladen)
//   fertig    POST /api/medien/upload/<id>      Prüfsumme über alle Stücke, Zusammenfügen, Eintrag im Katalog (idempotent)
//   abbrechen DELETE /api/medien/upload/<id>
// Sitzungen verfallen nach 7 Tagen (Frist „medien-upload“, lib/medien/pflege.ts). Inhalt: nur, wer das Medium sieht (`mediumFinden`),
// Range-Antworten 206 (Safari spielt Videos nur so), entschlüsselt Segment für Segment als Strom — nie die ganze Datei im Speicher.

import { updateJson, loadJson } from '@/lib/store/local-db';
import { localDay, tagePlus } from '@/lib/zeit';
import {
  GRENZEN, MEDIEN_UPLOADS, BILD_TYPEN, VIDEO_TYPEN, VORSCHAU_VARIANTEN, teileVon, teilLaenge, medienBestand, medienPrivatBestand,
  type UploadSitzung, type MedienTyp, type MedienArt, type Bereich, type Medium, type ObjektVerweis, type Ton,
  type Variante, type GewickelterSchluessel,
} from './typen';
import { neuerSchluessel, schluesselOeffnen, teilVerschluesseln, ganzVerschluesseln, ganzEntschluesseln, neuesSalz, sha256, pruefsummeAusTeilen, chiffratBereich, segmenteEntschluesseln, bereichSchneiden, objektGroesse, SEGMENT } from './krypto';
import { medienSpeicher, medienKonfig, SpeicherFehler, type MedienSpeicher } from './speicher';
import { neuesMedium, text, brauchtOriginal, alsSicht, type Fehler } from './regeln';
import { betrachterFuer, katalogAendern, mediumFinden, ladeKatalog, lageFuer } from './server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SITZUNG_ID = /^up-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OFFEN_JE_PERSON = 20;

interface UploadBestand { v: 1; sitzungen: UploadSitzung[] }
const leer = (): UploadBestand => ({ v: 1, sitzungen: [] });
const F = (status: Fehler['status'] | 415 | 429 | 503 | 507, fehler: string) => ({ ok: false as const, status, fehler });
type Antwort<T> = ({ ok: true } & T) | { ok: false; status: number; fehler: string };

// Je Stück nacheinander (dieser Prozess): ein wiederholtes Stück überholt nie das erste — Salz im Katalog = Salz im Speicher.
const schlange = new Map<string, Promise<unknown>>();
function nacheinander<T>(schluessel: string, fn: () => Promise<T>): Promise<T> {
  const vorher = schlange.get(schluessel) ?? Promise.resolve();
  const lauf = vorher.catch(() => {}).then(fn);
  const ende = lauf.catch(() => {});
  schlange.set(schluessel, ende);
  void ende.then(() => { if (schlange.get(schluessel) === ende) schlange.delete(schluessel); });
  return lauf;
}

// ── Typ aus dem Inhalt ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Inhaltstyp aus den ersten Bytes — `null`, wenn es kein zulässiges Foto/Video ist. HEIC/HEIF/AVIF bewusst nicht (iOS liefert JPEG). */
export function typAusInhalt(b: Uint8Array): MedienTyp | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png';
  if (b.length >= 12) {
    const atom = String.fromCharCode(b[4], b[5], b[6], b[7]);
    if (atom === 'ftyp') {
      const marke = String.fromCharCode(b[8], b[9], b[10], b[11]);
      if (/^(heic|heix|hevc|heim|heis|mif1|msf1|avif|avis)$/.test(marke)) return null;
      return marke === 'qt  ' ? 'video/quicktime' : 'video/mp4';
    }
    if (atom === 'wide' || atom === 'moov' || atom === 'mdat' || atom === 'free') return 'video/quicktime';
  }
  return null;
}
export const istPdf = (b: Uint8Array) => b.length >= 5 && String.fromCharCode(b[0], b[1], b[2], b[3], b[4]) === '%PDF-';

const artVon = (t: MedienTyp): MedienArt => ((BILD_TYPEN as readonly string[]).includes(t) ? 'bild' : 'video');
const objektVon = (praefix: string, id: string, variante: string) => `${praefix}/${id}/${variante}`;

// ── Sitzungen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

async function sitzungen(): Promise<UploadBestand> { const b = await loadJson<UploadBestand>(MEDIEN_UPLOADS); return b && Array.isArray(b.sitzungen) ? b : leer(); }
const sicht = (s: UploadSitzung) => {
  const da = new Set(s.erhalten.map(t => t.nr));
  return { id: s.id, mediumId: s.mediumId, teile: s.teile, teilGroesse: GRENZEN.teil, erhalten: [...da].sort((a, b) => a - b), fehlend: Array.from({ length: s.teile }, (_, i) => i).filter(i => !da.has(i)), vorschau: Object.keys(s.vorschau), laeuftAb: s.laeuftAb };
};
export type SitzungSicht = ReturnType<typeof sicht>;

const TONE: readonly Ton[] = ['keiner', 'entfernt', 'an', 'nicht-freigegeben'];
const zahl = (v: unknown, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? Math.round(v * 1000) / 1000 : undefined);

/** Upload-Sitzung anlegen (idempotent je UUID und Person). */
export async function uploadAnlegen(person: string, a: Record<string, unknown>): Promise<Antwort<{ sitzung: SitzungSicht } | { fertig: true; medium: unknown }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  const uuid = String(a.id ?? '').toLowerCase();
  if (!UUID.test(uuid)) return F(400, 'Kennung des Uploads fehlt (UUID vom Gerät).');
  const id = `up-${uuid}`, mediumId = `md-${uuid}`;
  const typ = [...BILD_TYPEN, ...VIDEO_TYPEN].find(t => t === a.typ);
  if (!typ) return F(415, 'Nur Fotos (JPEG, PNG) und Videos (MOV, MP4).');
  const art = artVon(typ);
  const bytes = Number(a.bytes);
  if (!Number.isInteger(bytes) || bytes < 1) return F(400, 'Größe fehlt.');
  if (bytes > (art === 'bild' ? GRENZEN.bild : GRENZEN.video)) return F(413, art === 'bild' ? 'Fotos höchstens 50 MB.' : 'Videos höchstens 2 GB — in der Kamera 1080p/30 (HEVC) einstellen oder kürzer aufnehmen.');
  const bereich: Bereich = a.bereich === 'privat' ? 'privat' : 'business';
  if (bereich === 'privat' && !b.voll) return F(403, 'Privat gibt es nur für volle Mitglieder des Haushalts.');
  const breite = zahl(a.breite, 100_000), hoehe = zahl(a.hoehe, 100_000);
  if (art === 'video' && brauchtOriginal(breite, hoehe) && a.original !== true) return F(400, '4K-Video: nur mit „Original“ hochladen — sonst in der Kamera 1080p/30 (HEVC) einstellen.');
  const ton: Ton | undefined = art === 'video' ? (TONE.find(t => t === a.ton) ?? 'nicht-freigegeben') : undefined;
  if (ton === 'an' && a.tonBestaetigt !== true) return F(400, 'Ton behalten nur mit Bestätigung des Hinweises (§ 201 StGB).');
  const name = text(a.name, GRENZEN.name);
  if (name === null) return F(413, 'Name zu lang.');
  const katName = bereich === 'business' ? medienBestand(b.haushalt) : medienPrivatBestand(b.person);
  const kat = await ladeKatalog(katName);
  // Schon fertig (dieselbe UUID)? Dann ist das der Eintrag.
  const fertig = kat.medien.find(m => m.id === mediumId);
  if (fertig) {
    const lage = await lageFuer(bereich === 'business' ? kat : await ladeKatalog(medienBestand(b.haushalt)));
    return { ok: true, fertig: true, medium: alsSicht(fertig, { art: bereich, ...(bereich === 'privat' ? { besitzer: b.person } : {}), katalog: kat }, b, lage) };
  }
  const album = typeof a.album === 'string' && a.album ? a.album : undefined;
  if (album && !kat.alben.some(x => x.id === album && !x.geloeschtAm)) {
    // Unterwegs ohne Netz aufgenommen (Netzwerken „Heute bei …“, Event-Akte): das Event-Album entsteht beim ersten Upload — feste Kennung je
    // Event (idempotent), Titel vom Gerät.
    const neu = (a.albumNeu ?? {}) as { art?: unknown; bezugId?: unknown; titel?: unknown };
    const { albumKennung, albumAnlegen } = await import('./regeln');
    if (bereich !== 'business' || neu.art !== 'event' || typeof neu.bezugId !== 'string' || albumKennung('event', neu.bezugId) !== album) return F(400, 'Album gibt es in diesem Bereich nicht.');
    const r = await katalogAendern(katName, k => albumAnlegen({ b, quelle: { art: 'business', katalog: k }, lage: { heute: localDay(), einwilligungen: [], kontaktSperre: () => null }, jetzt: new Date().toISOString(), neueId: p => `${p}-${uuid}` }, { art: 'event', bezugId: neu.bezugId, titel: typeof neu.titel === 'string' && neu.titel.trim() ? neu.titel : 'Event' }));
    if (!r.ok) return F(r.status, r.fehler);
  }
  let abgeleitetVon: Medium['abgeleitetVon'];
  if (a.abgeleitetVon && typeof a.abgeleitetVon === 'object') {
    const q = a.abgeleitetVon as { id?: unknown; vorschlagId?: unknown };
    const quelle = await mediumFinden(b, String(q.id ?? ''));
    if (!quelle || quelle.medium.art !== 'bild') return F(400, 'Das Ausgangsbild gibt es nicht.');
    abgeleitetVon = { id: quelle.medium.id, art: 'zuschnitt', ...(typeof q.vorschlagId === 'string' && /^v-[a-z0-9-]{4,80}$/.test(q.vorschlagId) ? { vorschlagId: q.vorschlagId } : {}) };
  }
  const s = await medienSpeicher();
  if (!s) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  const konfig = medienKonfig();
  if (s.belegt && konfig.modus === 'ordner' && (await s.belegt()) + objektGroesse(bytes) > konfig.grenze) return F(507, 'Der Medienspeicher ist voll — Object Storage einrichten (deploy/medien-speicher-verbinden.sh) oder Medien löschen.');

  const vorhanden = (await sitzungen()).sitzungen.find(x => x.id === id);
  if (vorhanden) return vorhanden.person === person ? { ok: true, sitzung: sicht(vorhanden) } : F(409, 'Diese Kennung gehört zu einem anderen Upload.');
  const offen = (await sitzungen()).sitzungen.filter(x => x.person === person).length;
  if (offen >= OFFEN_JE_PERSON) return F(429, `Höchstens ${OFFEN_JE_PERSON} offene Uploads — erst abschließen oder abbrechen.`);

  const objekt = objektVon(konfig.praefix, mediumId, 'original');
  const { gewickelt } = neuerSchluessel(mediumId);
  const speicherUpload = await s.beginnen(objekt);
  const jetzt = new Date().toISOString();
  const urh = (a.urheber ?? {}) as { art?: unknown; name?: unknown };
  const urheberName = text(urh.name, GRENZEN.name) ?? undefined;
  const sitzung: UploadSitzung = {
    id, person, haushalt: b.haushalt, mediumId, bereich, ...(album ? { album } : {}), art, typ, bytes, teile: teileVon(bytes), objekt, speicherUpload,
    schluessel: gewickelt, erhalten: [], vorschau: {}, angelegt: jetzt, laeuftAb: tagePlus(localDay(), GRENZEN.sitzungTage),
    meta: {
      ...(name ? { name } : {}),
      ...(typeof a.aufgenommen === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]{5,15}(Z|[+-]\d{2}:\d{2})?)?$/.test(a.aufgenommen) ? { aufgenommen: a.aufgenommen } : {}),
      ...(breite ? { breite } : {}), ...(hoehe ? { hoehe } : {}), ...(zahl(a.dauerSek, 86_400) ? { dauerSek: zahl(a.dauerSek, 86_400) } : {}),
      ...(Number.isInteger(a.drehung) && (a.drehung as number) >= 1 && (a.drehung as number) <= 8 ? { drehung: a.drehung as number } : {}),
      ortsdatenEntfernt: a.ortsdatenEntfernt === true,
      ...(ton ? { ton } : {}), ...(a.original === true ? { original: true } : {}),
      ...(a.erkennbarePersonen === 'ja' || a.erkennbarePersonen === 'nein' || a.erkennbarePersonen === 'unklar' ? { erkennbarePersonen: a.erkennbarePersonen } : {}),
      ...(urh.art === 'extern' ? { urheber: { art: 'extern' as const, ...(urheberName ? { name: urheberName } : {}) } } : {}),
      ...(abgeleitetVon ? { abgeleitetVon } : {}),
    },
  };
  let anders: UploadSitzung | null = null;
  await updateJson<UploadBestand>(MEDIEN_UPLOADS, cur => {
    const st = cur && Array.isArray(cur.sitzungen) ? cur : leer();
    const da = st.sitzungen.find(x => x.id === id);
    if (da) { anders = da; return st; }
    return { ...st, sitzungen: [...st.sitzungen, sitzung] };
  });
  if (anders) {
    await s.abbrechen(objekt, speicherUpload).catch(() => {});
    const x = anders as UploadSitzung;
    return x.person === person ? { ok: true, sitzung: sicht(x) } : F(409, 'Diese Kennung gehört zu einem anderen Upload.');
  }
  return { ok: true, sitzung: sicht(sitzung) };
}

async function eigeneSitzung(person: string, id: string): Promise<UploadSitzung | null> {
  if (!SITZUNG_ID.test(id)) return null;
  const s = (await sitzungen()).sitzungen.find(x => x.id === id);
  return s && s.person === person ? s : null;
}

export async function uploadStand(person: string, id: string): Promise<Antwort<{ sitzung: SitzungSicht }>> {
  const s = await eigeneSitzung(person, id);
  return s ? { ok: true, sitzung: sicht(s) } : F(404, 'Upload nicht gefunden (abgelaufen oder schon fertig).');
}

/** Ein Stück annehmen (Länge, Prüfsumme, Typ aus dem Inhalt) und verschlüsselt weiterreichen. */
export async function teilAnnehmen(person: string, id: string, nr: number, klar: Buffer, shaKopf: string | null): Promise<Antwort<{ sitzung: SitzungSicht; schon?: true }>> {
  const s0 = await eigeneSitzung(person, id);
  if (!s0) return F(404, 'Upload nicht gefunden (abgelaufen oder schon fertig).');
  if (!Number.isInteger(nr) || nr < 0 || nr >= s0.teile) return F(400, 'Stück außerhalb der Datei.');
  if (klar.length !== teilLaenge(s0.bytes, nr)) return F(400, `Stück ${nr} muss ${teilLaenge(s0.bytes, nr)} Byte haben.`);
  const sha = sha256(klar);
  if (!shaKopf || shaKopf.toLowerCase() !== sha) return F(400, 'Prüfsumme des Stücks stimmt nicht — bitte erneut senden.');
  let metadatenUebrig = false;
  if (nr === 0) {
    const t = typAusInhalt(klar.subarray(0, 64));
    if (!t || artVon(t) !== s0.art || (s0.art === 'bild' && t !== s0.typ)) return F(415, 'Der Inhalt ist kein zulässiges Foto bzw. Video (oder passt nicht zum angegebenen Typ).');
    // Der Server traut der Meldung „Ortsdaten entfernt“ nicht blind: trägt das JPEG noch Exif/XMP/IPTC, gilt es als nicht gesäubert.
    if (t === 'image/jpeg') metadatenUebrig = (await import('./exif')).jpegMetadatenUebrig(klar);
  }
  return nacheinander(`${id}#${nr}`, async () => {
    const s = await eigeneSitzung(person, id);
    if (!s) return F(404, 'Upload nicht gefunden.');
    const da = s.erhalten.find(t => t.nr === nr);
    if (da) return da.sha256 === sha ? { ok: true as const, sitzung: sicht(s), schon: true as const } : F(409, `Stück ${nr} kam schon mit anderem Inhalt.`);
    const speicher = await medienSpeicher();
    if (!speicher) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
    const dek = schluesselOeffnen(s.schluessel, s.mediumId);
    const salz = neuesSalz();
    let etag: string;
    try { etag = await speicher.teil(s.objekt, s.speicherUpload, nr, teilVerschluesseln(dek, { mediumId: s.mediumId, variante: 'original' }, nr, klar, s.bytes, salz)); }
    catch (e) { return F(e instanceof SpeicherFehler && e.status === 507 ? 507 : 503, e instanceof Error ? e.message : 'Speicher nicht erreichbar.'); }
    let neu: UploadSitzung | null = null;
    await updateJson<UploadBestand>(MEDIEN_UPLOADS, cur => {
      const st = cur && Array.isArray(cur.sitzungen) ? cur : leer();
      return { ...st, sitzungen: st.sitzungen.map(x => {
        if (x.id !== id) return x;
        neu = { ...x, erhalten: [...x.erhalten.filter(t => t.nr !== nr), { nr, sha256: sha, salz, etag }].sort((p, q) => p.nr - q.nr), ...(metadatenUebrig ? { meta: { ...x.meta, ortsdatenEntfernt: false } } : {}) };
        return neu;
      }) };
    });
    return neu ? { ok: true as const, sitzung: sicht(neu) } : F(404, 'Upload nicht gefunden.');
  });
}

/** Vorschau/Raster/Poster annehmen (JPEG/PNG ≤ 2 MB, Metadaten raus), verschlüsselt ablegen. */
export async function vorschauAnnehmen(person: string, id: string, variante: string, klar: Buffer): Promise<Antwort<{ sitzung: SitzungSicht }>> {
  const v = VORSCHAU_VARIANTEN.find(x => x === variante);
  if (!v) return F(400, 'Variante: raster, ansicht oder poster.');
  const s = await eigeneSitzung(person, id);
  if (!s) return F(404, 'Upload nicht gefunden.');
  if (v === 'poster' && s.art !== 'video') return F(400, 'Ein Poster gibt es nur für Videos.');
  if (klar.length > GRENZEN.vorschau) return F(413, 'Vorschau höchstens 2 MB.');
  const t = typAusInhalt(klar);
  if (t !== 'image/jpeg' && t !== 'image/png') return F(415, 'Vorschau nur als JPEG oder PNG.');
  const { jpegOhneMetadaten, pngOhneMetadaten } = await import('@/lib/netzwerken/bild-bereinigen');
  const sauber = t === 'image/jpeg' ? jpegOhneMetadaten(klar) : pngOhneMetadaten(klar);
  if (!sauber) return F(415, 'Vorschau beschädigt.');
  const verweis = await kleinAblegen(s.mediumId, v, Buffer.from(sauber), t, s.schluessel);
  if (!verweis.ok) return verweis;
  let neu: UploadSitzung | null = null;
  await updateJson<UploadBestand>(MEDIEN_UPLOADS, cur => {
    const st = cur && Array.isArray(cur.sitzungen) ? cur : leer();
    return { ...st, sitzungen: st.sitzungen.map(x => (x.id === id ? (neu = { ...x, vorschau: { ...x.vorschau, [v]: verweis.verweis } }) : x)) };
  });
  return neu ? { ok: true, sitzung: sicht(neu) } : F(404, 'Upload nicht gefunden.');
}

async function kleinAblegen(mediumId: string, variante: string, klar: Buffer, typ: string, schluessel: GewickelterSchluessel): Promise<{ ok: true; verweis: ObjektVerweis } | { ok: false; status: number; fehler: string }> {
  const speicher = await medienSpeicher();
  if (!speicher) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  const dek = schluesselOeffnen(schluessel, mediumId);
  const { bytes, salz } = ganzVerschluesseln(dek, { mediumId, variante }, klar);
  const objekt = objektVon(medienKonfig().praefix, mediumId, variante);
  try { await speicher.schreiben(objekt, bytes); }
  catch (e) { return F(e instanceof SpeicherFehler && e.status === 507 ? 507 : 503, e instanceof Error ? e.message : 'Speicher nicht erreichbar.'); }
  return { ok: true, verweis: { objekt, bytes: klar.length, typ, salze: [salz], sha256: sha256(klar) } };
}

/** Abschließen: Prüfsumme über alle Stücke, Zusammenfügen im Speicher, Eintrag im Katalog (EINE Schreibstelle). Idempotent. */
export async function uploadFertig(person: string, id: string, a: Record<string, unknown>): Promise<Antwort<{ medium: unknown }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  const s = await eigeneSitzung(person, id);
  if (!s) {
    // Schon fertig? Dann den Eintrag zurückgeben (Wiederholung nach abgerissener Antwort).
    const f = SITZUNG_ID.test(id) ? await mediumFinden(b, `md-${id.slice(3)}`) : null;
    if (f) { const lage = await lageFuer(f.quelle.art === 'business' ? f.quelle.katalog : await ladeKatalog(medienBestand(b.haushalt))); return { ok: true, medium: alsSicht(f.medium, f.quelle, b, lage) }; }
    return F(404, 'Upload nicht gefunden (abgelaufen oder abgebrochen).');
  }
  const fehlend = Array.from({ length: s.teile }, (_, i) => i).filter(i => !s.erhalten.some(t => t.nr === i));
  if (fehlend.length) return F(409, `Es fehlen noch ${fehlend.length} Stück(e).`);
  if (!s.vorschau.raster) return F(409, 'Das Vorschaubild fehlt noch.');
  const pruef = pruefsummeAusTeilen(s.erhalten.map(t => t.sha256));
  if (typeof a.pruefsumme !== 'string' || a.pruefsumme.toLowerCase() !== pruef) return F(400, 'Prüfsumme der ganzen Datei stimmt nicht — Upload abbrechen und neu senden.');
  const speicher = await medienSpeicher();
  if (!speicher) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  try { await speicher.abschliessen(s.objekt, s.speicherUpload, s.erhalten.map(t => ({ nr: t.nr, etag: t.etag }))); }
  catch (e) {
    // Schon zusammengefügt (Wiederholung)? Dann ist das Objekt lesbar.
    const da = await speicher.lesen(s.objekt, { von: 0, bis: 15 }).catch(() => null);
    if (!da) return F(503, e instanceof Error ? e.message : 'Speicher nicht erreichbar.');
  }
  const jetzt = new Date().toISOString();
  const medium = neuesMedium({
    id: s.mediumId, art: s.art, bereich: s.bereich, von: s.person, ...(s.album ? { album: s.album } : {}), hochgeladen: jetzt, typ: s.typ, groesse: s.bytes,
    ...(s.meta.name ? { name: s.meta.name } : {}), ...(s.meta.aufgenommen ? { aufgenommen: s.meta.aufgenommen } : {}),
    ...(s.meta.breite ? { breite: s.meta.breite } : {}), ...(s.meta.hoehe ? { hoehe: s.meta.hoehe } : {}), ...(s.meta.dauerSek ? { dauerSek: s.meta.dauerSek } : {}),
    ...(s.meta.drehung ? { drehung: s.meta.drehung } : {}), ortsdatenEntfernt: s.meta.ortsdatenEntfernt, ...(s.meta.ton ? { ton: s.meta.ton } : {}),
    ...(s.meta.original ? { original: true } : {}), ...(s.meta.erkennbarePersonen ? { erkennbarePersonen: s.meta.erkennbarePersonen } : {}),
    ...(s.meta.abgeleitetVon ? { abgeleitetVon: s.meta.abgeleitetVon } : {}),
    schluessel: s.schluessel,
    varianten: { original: { objekt: s.objekt, bytes: s.bytes, typ: s.typ, salze: s.erhalten.map(t => t.salz), sha256: pruef }, ...s.vorschau },
    urheber: s.meta.urheber ?? { art: 'team' }, jetzt,
  });
  const katName = s.bereich === 'business' ? medienBestand(s.haushalt) : medienPrivatBestand(s.person);
  const r = await katalogAendern(katName, kat => {
    if (kat.medien.some(m => m.id === medium.id)) return { ok: true as const, katalog: kat };
    const album = medium.album && kat.alben.some(x => x.id === medium.album && !x.geloeschtAm) ? medium.album : undefined;
    const m: Medium = album ? medium : (() => { const { album: _a, ...rest } = medium; return rest; })();
    // Zuschnitt aus einem Head-Vorschlag: am Ausgangsbild vermerken, was ausgeführt ist.
    const medien = kat.medien.map(x => (m.abgeleitetVon?.vorschlagId && x.id === m.abgeleitetVon.id && x.vorschlaege
      ? { ...x, vorschlaege: x.vorschlaege.map(v => (v.vorschlagId === m.abgeleitetVon!.vorschlagId ? { ...v, ausgefuehrt: Array.from(new Set([...(v.ausgefuehrt ?? []), m.id])) } : v)) }
      : x));
    return { ok: true as const, katalog: { ...kat, medien: [...medien, m] } };
  });
  if (!r.ok) return r;
  await updateJson<UploadBestand>(MEDIEN_UPLOADS, cur => { const st = cur && Array.isArray(cur.sitzungen) ? cur : leer(); return { ...st, sitzungen: st.sitzungen.filter(x => x.id !== id) }; });
  const f = await mediumFinden(b, medium.id);
  if (!f) return { ok: true, medium: null };
  const lage = await lageFuer(f.quelle.art === 'business' ? f.quelle.katalog : await ladeKatalog(medienBestand(b.haushalt)));
  return { ok: true, medium: alsSicht(f.medium, f.quelle, b, lage) };
}

/** Abbrechen: Stücke im Speicher und Vorschauen weg, Sitzung weg. */
export async function uploadAbbrechen(person: string, id: string): Promise<Antwort<{ abgebrochen: true }>> {
  const s = await eigeneSitzung(person, id);
  if (!s) return F(404, 'Upload nicht gefunden.');
  await sitzungEntsorgen(s);
  return { ok: true, abgebrochen: true };
}

/** Sitzung samt Resten entsorgen (Abbrechen, Ablauf nach 7 Tagen, Konto löschen). */
export async function sitzungEntsorgen(s: UploadSitzung, speicher?: MedienSpeicher | null): Promise<void> {
  const sp = speicher === undefined ? await medienSpeicher() : speicher;
  if (sp) {
    await sp.abbrechen(s.objekt, s.speicherUpload).catch(e => console.error('[medien] Abbrechen im Speicher:', e instanceof Error ? e.message : e));
    for (const v of Object.values(s.vorschau)) if (v) await sp.loeschen(v.objekt).catch(() => {});
  }
  await updateJson<UploadBestand>(MEDIEN_UPLOADS, cur => { const st = cur && Array.isArray(cur.sitzungen) ? cur : leer(); return { ...st, sitzungen: st.sitzungen.filter(x => x.id !== s.id) }; });
}

/** Offene Sitzungen (Pflege, Konto löschen, HOI). */
export async function alleSitzungen(): Promise<UploadSitzung[]> { return (await sitzungen()).sitzungen; }

// ── Inhalt lesen (Range, Strom) ────────────────────────────────────────────────────────────────────────────────────────

export interface InhaltAntwort { status: 200 | 206 | 304 | 416; kopf: Record<string, string>; strom: ReadableStream<Uint8Array> | null }

/** Range-Kopf → [von, bis] (inklusive) — `null` = ganze Datei, `'ungueltig'` = 416. Nur ein Bereich (Safari fragt einen). */
export function rangeLesen(kopf: string | null, gesamt: number): { von: number; bis: number } | null | 'ungueltig' {
  if (!kopf) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(kopf.trim());
  if (!m || (!m[1] && !m[2])) return 'ungueltig';
  if (!m[1]) { const n = Number(m[2]); if (!n) return 'ungueltig'; return { von: Math.max(0, gesamt - n), bis: gesamt - 1 }; }
  const von = Number(m[1]), bis = m[2] ? Math.min(Number(m[2]), gesamt - 1) : gesamt - 1;
  if (von >= gesamt || bis < von) return 'ungueltig';
  return { von, bis };
}

/** Ein Medium (Variante) als Antwort — nur, wer es sieht. Video mit nicht freigegebenem Ton: nie das Original. */
export async function inhaltLesen(person: string, id: string, variante: Variante, range: string | null, wennNicht: string | null): Promise<Antwort<{ inhalt: InhaltAntwort; mitPersonen: boolean; ki: boolean }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  const f = await mediumFinden(b, id);
  if (!f) return F(404, 'Medium nicht gefunden.');
  const m = f.medium;
  if (m.geloeschtAm && variante === 'original') return F(409, 'Das Medium liegt im Papierkorb.');
  if (variante === 'original' && m.art === 'video' && m.ton === 'nicht-freigegeben') return F(403, 'Ton nicht freigegeben — das Video wird nicht abgespielt und nicht geteilt. Ton freigeben (nur mit Zustimmung aller) oder ohne Ton neu hochladen.');
  const v = m.varianten[variante];
  if (!v) return F(404, 'Diese Ansicht gibt es nicht.');
  const etag = `"${v.sha256.slice(0, 40)}"`;
  const mitPersonen = m.erkennbarePersonen === 'ja' || m.personen.length > 0;
  // KI-generiert (Paket 4c, KI-VO Art. 50): die Datei trägt SynthID/C2PA unverändert; der Kopf sagt es zusätzlich (zweite Schicht).
  const ki = m.urheber.art === 'ki';
  const grund: Record<string, string> = {
    'Content-Type': v.typ, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
    ETag: etag, 'Accept-Ranges': variante === 'original' ? 'bytes' : 'none',
    ...(ki ? { 'X-KI-Generiert': '1' } : {}),
    // Kevin 09.10.: Vorschaubilder verschlüsselt + privater Zwischenspeicher im Browser; das Original nie zwischengespeichert.
    'Cache-Control': variante === 'original' ? 'private, no-store' : 'private, max-age=604800',
  };
  if (wennNicht && wennNicht === etag && variante !== 'original') return { ok: true, mitPersonen, ki, inhalt: { status: 304, kopf: grund, strom: null } };
  const speicher = await medienSpeicher();
  if (!speicher) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  const dek = schluesselOeffnen(m.schluessel, m.id);
  const r = variante === 'original' ? rangeLesen(range, v.bytes) : null;
  if (r === 'ungueltig') return { ok: true, mitPersonen, ki, inhalt: { status: 416, kopf: { ...grund, 'Content-Range': `bytes */${v.bytes}` }, strom: null } };
  const von = r ? r.von : 0, bis = r ? r.bis : v.bytes - 1;
  const strom = entschluesselterStrom(speicher, dek, { mediumId: m.id, variante }, v, von, bis);
  return {
    ok: true, mitPersonen, ki,
    inhalt: { status: r ? 206 : 200, kopf: { ...grund, 'Content-Length': String(bis - von + 1), ...(r ? { 'Content-Range': `bytes ${von}-${bis}/${v.bytes}` } : {}) }, strom },
  };
}

/** Strom über [von, bis]: je Fenster (16 Segmente = 1 MiB) die Bytes aus dem Speicher holen, entschlüsseln, schneiden. */
export function entschluesselterStrom(speicher: MedienSpeicher, dek: Buffer, z: { mediumId: string; variante: string }, v: ObjektVerweis, von: number, bis: number): ReadableStream<Uint8Array> {
  const FENSTER = 16 * SEGMENT;
  let pos = von;
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      if (pos > bis) { c.close(); return; }
      const ende = Math.min(bis, Math.floor(pos / FENSTER) * FENSTER + FENSTER - 1);
      try {
        const cb = chiffratBereich(pos, ende, v.bytes);
        const roh = await speicher.lesen(v.objekt, { von: cb.von, bis: cb.bis });
        if (!roh) throw new Error('Objekt fehlt im Speicher.');
        const klar = segmenteEntschluesseln(dek, z, v.salze, v.bytes, roh, cb.ersterSeg);
        c.enqueue(new Uint8Array(bereichSchneiden(klar, pos, ende, cb.ersterSeg)));
        pos = ende + 1;
      } catch (e) {
        console.error('[medien] Inhalt nicht lesbar:', e instanceof Error ? e.message : e);
        c.error(e);
      }
    },
  });
}

/** Eine kleine Variante ganz entschlüsselt (Heads, Belege) — `null`, wenn sie fehlt. */
export async function variantenBytes(m: Pick<Medium, 'id' | 'schluessel'>, variante: string, v: ObjektVerweis | undefined): Promise<Buffer | null> {
  if (!v) return null;
  const speicher = await medienSpeicher();
  if (!speicher) return null;
  const roh = await speicher.lesen(v.objekt);
  if (!roh) return null;
  return ganzEntschluesseln(schluesselOeffnen(m.schluessel, m.id), { mediumId: m.id, variante }, v.salze, v.bytes, roh);
}

// ── Belege: Unterschrift (Einwilligung) und Lizenz-Nachweis (fremde Fotografen) ──────────────────────────────────────────

/** Unterschrift (PNG als Base64, ≤ 300 KB, ohne Metadaten) mit eigenem Schlüssel ablegen. */
export async function unterschriftAblegen(einwilligungId: string, base64: string): Promise<{ ok: true; verweis: ObjektVerweis & { schluessel: GewickelterSchluessel } } | { ok: false; status: number; fehler: string }> {
  let b: Buffer;
  try { b = Buffer.from(base64.replace(/^data:image\/png;base64,/, ''), 'base64'); } catch { return F(400, 'Unterschrift nicht lesbar.'); }
  if (b.length > 300 * 1024) return F(413, 'Unterschrift zu groß.');
  if (typAusInhalt(b) !== 'image/png') return F(415, 'Unterschrift nur als PNG.');
  const { pngOhneMetadaten } = await import('@/lib/netzwerken/bild-bereinigen');
  const sauber = pngOhneMetadaten(b);
  if (!sauber) return F(415, 'Unterschrift beschädigt.');
  const { gewickelt } = neuerSchluessel(einwilligungId);
  const r = await kleinAblegen(einwilligungId, 'unterschrift', Buffer.from(sauber), 'image/png', gewickelt);
  if (!r.ok) return r;
  return { ok: true, verweis: { ...r.verweis, schluessel: gewickelt } };
}

/** Lizenz-Nachweis (PDF/JPEG/PNG ≤ 8 MB) zu einem Medium ablegen — nur, wer das Medium ändern darf. */
export async function lizenzAblegen(person: string, mediumId: string, name: string, klar: Buffer): Promise<Antwort<{ text: string }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  if (klar.length > GRENZEN.beleg) return F(413, 'Nachweis höchstens 8 MB.');
  const t = typAusInhalt(klar);
  const typ = istPdf(klar) ? 'application/pdf' : t === 'image/jpeg' || t === 'image/png' ? t : null;
  if (!typ) return F(415, 'Nachweis als PDF, JPEG oder PNG.');
  let inhalt = klar;
  if (typ !== 'application/pdf') {
    const { jpegOhneMetadaten, pngOhneMetadaten } = await import('@/lib/netzwerken/bild-bereinigen');
    const s = typ === 'image/jpeg' ? jpegOhneMetadaten(klar) : pngOhneMetadaten(klar);
    if (!s) return F(415, 'Nachweis beschädigt.');
    inhalt = Buffer.from(s);
  }
  const f = await mediumFinden(b, mediumId);
  if (!f) return F(404, 'Medium nicht gefunden.');
  if (f.quelle.art !== 'business') return F(400, 'Lizenz-Nachweise braucht es nur im Business.');
  const dateiname = (text(name, 120) || 'nachweis').replace(/[^\p{L}\p{N} ._-]/gu, '_');
  const r = await kleinAblegen(mediumId, 'lizenz', inhalt, typ, f.medium.schluessel);
  if (!r.ok) return r;
  const jetzt = new Date().toISOString();
  const w = await katalogAendern(f.name, kat => {
    const i = kat.medien.findIndex(x => x.id === mediumId);
    if (i < 0 || kat.medien[i].geloeschtAm) return { ok: false, status: 404, fehler: 'Medium nicht gefunden.' } as Fehler;
    const medien = kat.medien.slice();
    medien[i] = { ...medien[i], urheber: { ...medien[i].urheber, art: 'extern', lizenz: { ...r.verweis, name: dateiname, am: jetzt, von: person, schluessel: medien[i].schluessel } }, geaendert: jetzt, geaendertVon: person };
    return { ok: true as const, katalog: { ...kat, medien } };
  });
  return w.ok ? { ok: true, text: 'Lizenz-Nachweis abgelegt.' } : w;
}

/** Beleg lesen: Lizenz (wer das Medium sieht) bzw. Unterschrift (nur wer freigeben darf). */
export async function belegLesen(person: string, art: string, id: string): Promise<Antwort<{ bytes: Buffer; typ: string; name: string }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  if (art === 'lizenz') {
    const f = await mediumFinden(b, id);
    const l = f?.medium.urheber.lizenz;
    if (!f || !l) return F(404, 'Nachweis nicht gefunden.');
    const bytes = await variantenBytes({ id: f.medium.id, schluessel: l.schluessel }, 'lizenz', l);
    return bytes ? { ok: true, bytes, typ: l.typ, name: l.name } : F(404, 'Nachweis nicht gefunden.');
  }
  if (art === 'unterschrift') {
    const { darfFreigeben } = await import('./regeln');
    if (!darfFreigeben(b)) return F(403, 'Unterschriften sehen die Marketing-Verantwortliche und volle Mitglieder.');
    const e = ((await ladeKatalog(medienBestand(b.haushalt))).einwilligungen ?? []).find(x => x.id === id);
    if (!e?.unterschrift) return F(404, 'Unterschrift nicht gefunden.');
    const bytes = await variantenBytes({ id: e.id, schluessel: e.unterschrift.schluessel }, 'unterschrift', e.unterschrift);
    return bytes ? { ok: true, bytes, typ: 'image/png', name: `unterschrift-${e.id}.png` } : F(404, 'Unterschrift nicht gefunden.');
  }
  return F(400, 'Art: lizenz oder unterschrift.');
}

