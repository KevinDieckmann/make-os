// ─── Medien — KI-Bilder und -Videos in der EINEN Ablage (09.10., Paket 4c) — Server ──────────────────────────────────────────────
// Kevin 08.10. spät: Fotos/Videos unterwegs → nach Freigabe ins Marketing → „gehen dann direkt an die Head ofs … wenn gewollt“; andere KIs für
// andere Aufgaben (Nano Banana für Bilder, Veo für Video). Bis Paket 4c gab es ZWEI Ablagen: `ki-medien--<haushalt>` (Paket 6a, KI-erzeugt) und
// `medien--<haushalt>`/`medien-privat--<person>` (Paket 5, hochgeladen). Ab jetzt ist ein KI-Medium ein Medium wie jedes andere:
//   · dieselbe Verschlüsselung (Schlüssel je Medium, Segmente, Medienspeicher — lib/medien/krypto.ts), dieselbe Freigabe, dieselbe Filterstelle
//     (`medienFuerBetrachter`), derselbe Papierkorb; Herkunft in `urheber: { art: 'ki', ki: KiHerkunft }` (nie änderbar)
//   · die Bytes des Anbieters UNVERÄNDERT als Original (SynthID/C2PA bleiben — nie umkodieren, nie lib/netzwerken/bild-bereinigen.ts); Vorschauen
//     sind dieselben Bytes (kleine Bilder), sonst gibt es keine (keine Bild-Bibliothek auf dem Server)
//   · „abgeleitet von“ ein Foto (Bild bearbeiten): Album, „erkennbare Personen“, Markierungen und Einwilligungen gehen mit — die Freigabe-Regeln
//     gelten für das Ergebnis wie für das Original
//   · Vorschlag eines Agenten (`ki.vorschlag = 'offen'`): liegt im Freigabe-Stapel (Art `medien`); bis ein Mensch übernimmt, ist es nicht freigebbar
//     und geht an keinen Head; „verworfen“ = Papierkorb (30 Tage)
// `ki-medien--<haushalt>` bleibt nur als Auftragsbuch laufender Video-Aufträge (bis der Takt sie abholt) und als Lese-Übergang des Altbestands:
// `kiMedienUebernehmen` übernimmt fertige Einträge EINMAL (idempotent über die feste Kennung md-<uuid des km-…>, Marke `uebernommenAls` im
// Auftragsbuch) — im täglichen Medien-Lauf und beim Abholen, nie beim Lesen. Der alte Bestand und seine Dateien bleiben liegen (Rückweg).

import { loadJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import {
  medienBestand, GRENZEN, BILD_TYPEN, TEXTE,
  type Bereich, type KiHerkunft, type Medium, type MedienTyp, type ObjektVerweis, type GewickelterSchluessel, type PersonImBild,
} from './typen';
import { neuesMedium, anKiGruende, type Fehler } from './regeln';
import { betrachterFuer, katalogAendern, katalogName, ladeKatalog, lageFuer, mediumFinden, objekteLoeschen } from './server';
import { neuerSchluessel, schluesselOeffnen, teilVerschluesseln, neuesSalz, sha256, pruefsummeAusTeilen, ganzEntschluesseln } from './krypto';
import { medienSpeicher, medienKonfig, SpeicherFehler, type MedienSpeicher } from './speicher';
import { typAusInhalt, variantenBytes } from './upload-server';
import { bildMasse } from './bildmasse';

const F = (status: Fehler['status'] | 415 | 503 | 507, fehler: string) => ({ ok: false as const, status, fehler });
type Antwort<T> = ({ ok: true } & T) | { ok: false; status: number; fehler: string };
const PERSON = /^[a-z0-9-]{1,40}$/;
const objektVon = (id: string, variante: string) => `${medienKonfig().praefix}/${id}/${variante}`;
/** Größte Vorlage, die als Referenz an den Bild-Anbieter geht (Base64 im Körper; der Adapter nimmt Antworten bis 15 MB). */
export const REFERENZ_MAX_BYTES = 7 * 1024 * 1024;

export interface KiAblageEingabe {
  /** Wer ausgelöst hat (Speichername aus der Sitzung bzw. dem Lauf) — wird `von` des Mediums. */
  person: string;
  bereich: Bereich;
  bytes: Buffer;
  herkunft: Omit<KiHerkunft, 'erzeugtAm'> & { erzeugtAm?: string };
  album?: string;
  name?: string;
  /** Bild bearbeiten: das Ausgangsfoto (Album, Personen, Einwilligungen gehen mit). */
  quelle?: Medium;
  /** Feste Kennung (Übernahme aus `ki-medien`) — dann idempotent. */
  id?: string;
}

/** Ein Objekt verschlüsselt in den Medienspeicher — klein am Stück, groß in Stücken (8 MiB, je Stück ein Salz). */
async function originalAblegen(s: MedienSpeicher, dek: Buffer, id: string, klar: Buffer, typ: string): Promise<ObjektVerweis> {
  const objekt = objektVon(id, 'original');
  const z = { mediumId: id, variante: 'original' };
  const teile = Math.max(1, Math.ceil(klar.length / GRENZEN.teil));
  const salze: string[] = [];
  const hashes: string[] = [];
  if (teile === 1) {
    const salz = neuesSalz();
    await s.schreiben(objekt, teilVerschluesseln(dek, z, 0, klar, klar.length, salz));
    salze.push(salz); hashes.push(sha256(klar));
  } else {
    const upload = await s.beginnen(objekt);
    const erhalten: { nr: number; etag: string }[] = [];
    try {
      for (let nr = 0; nr < teile; nr++) {
        const stueck = klar.subarray(nr * GRENZEN.teil, Math.min(klar.length, (nr + 1) * GRENZEN.teil));
        const salz = neuesSalz();
        erhalten.push({ nr, etag: await s.teil(objekt, upload, nr, teilVerschluesseln(dek, z, nr, stueck, klar.length, salz)) });
        salze.push(salz); hashes.push(sha256(stueck));
      }
      await s.abschliessen(objekt, upload, erhalten);
    } catch (e) { await s.abbrechen(objekt, upload).catch(() => {}); throw e; }
  }
  return { objekt, bytes: klar.length, typ, salze, sha256: pruefsummeAusTeilen(hashes) };
}

async function kleinAblegen(s: MedienSpeicher, dek: Buffer, id: string, variante: string, klar: Buffer, typ: string): Promise<ObjektVerweis> {
  const objekt = objektVon(id, variante);
  const salz = neuesSalz();
  await s.schreiben(objekt, teilVerschluesseln(dek, { mediumId: id, variante }, 0, klar, klar.length, salz));
  return { objekt, bytes: klar.length, typ, salze: [salz], sha256: sha256(klar) };
}

/** Markierungen des Ausgangsfotos für das abgeleitete Medium (neue Kennungen, Einwilligungen bleiben dieselben). */
const personenKopie = (p: readonly PersonImBild[], jetzt: string): PersonImBild[] => p.map(x => ({ ...x, id: neueKennung('pb'), am: jetzt }));

/**
 * Ein von der KI erzeugtes Bild/Video als Medium ablegen (EINE Schreibstelle der Kataloge: `katalogAendern`). Nur Personen im Haushalt des
 * Inhabers; Privat nur für volle Mitglieder (dann im eigenen Privat-Bestand, „Unsortiert“ = nur die Person). Typ aus dem INHALT (JPEG/PNG bzw.
 * MP4/MOV), sonst 415 — die Bytes werden nie umgewandelt.
 */
export async function kiMediumAblegen(e: KiAblageEingabe): Promise<Antwort<{ medium: Medium; schon?: true }>> {
  if (!PERSON.test(e.person)) return F(400, 'Person ungültig.');
  const b = await betrachterFuer(e.person);
  if (!b) return F(403, 'Medien gibt es nur im Haushalt des Inhabers.');
  if (e.bereich === 'privat' && !b.voll) return F(403, 'Privat gibt es nur für volle Mitglieder des Haushalts.');
  if (e.herkunft.prompt.length > 4000) return F(413, 'Auftragstext zu lang (höchstens 4.000 Zeichen).');
  const typ = typAusInhalt(e.bytes.subarray(0, 64)) as MedienTyp | null;
  if (!typ) return F(415, 'Das Ergebnis des Anbieters ist kein JPEG, PNG oder MP4 — so lässt es sich nicht als Medium ablegen.');
  const art = (BILD_TYPEN as readonly string[]).includes(typ) ? 'bild' as const : 'video' as const;
  if (e.bytes.length > (art === 'bild' ? GRENZEN.bild : GRENZEN.video)) return F(413, art === 'bild' ? 'Bild zu groß (höchstens 50 MB).' : 'Video zu groß (höchstens 2 GB).');
  const name = katalogName(e.bereich, e.bereich === 'business' ? b.haushalt : e.person);
  const id = e.id && /^md-[0-9a-f-]{36}$/.test(e.id) ? e.id : neueKennung('md');
  if (e.id) {
    const da = (await ladeKatalog(name)).medien.find(m => m.id === id);
    if (da) return { ok: true, medium: da, schon: true };
  }
  const s = await medienSpeicher();
  if (!s) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  const { dek, gewickelt } = neuerSchluessel(id);
  const masse = art === 'bild' ? bildMasse(e.bytes) : null;
  let varianten: Medium['varianten'];
  try {
    const original = await originalAblegen(s, dek, id, e.bytes, typ);
    varianten = { original };
    // Vorschauen = dieselben Bytes (ohne Umwandlung): Raster bis 2 MB, Ansicht nur bis 1568 px (das sieht ein Head).
    if (art === 'bild' && e.bytes.length <= GRENZEN.vorschau) {
      varianten.raster = await kleinAblegen(s, dek, id, 'raster', e.bytes, typ);
      if (masse && Math.max(masse.breite, masse.hoehe) <= GRENZEN.ansichtPx) varianten.ansicht = await kleinAblegen(s, dek, id, 'ansicht', e.bytes, typ);
    }
  } catch (x) {
    await objekteLoeschen({ varianten: { original: { objekt: objektVon(id, 'original') } as ObjektVerweis, raster: { objekt: objektVon(id, 'raster') } as ObjektVerweis, ansicht: { objekt: objektVon(id, 'ansicht') } as ObjektVerweis }, urheber: { art: 'ki' } }).catch(() => 0);
    return F(x instanceof SpeicherFehler && x.status === 507 ? 507 : 503, x instanceof Error ? x.message : 'Speicher nicht erreichbar.');
  }
  const jetzt = new Date().toISOString();
  const q = e.quelle;
  const herkunft: KiHerkunft = { ...e.herkunft, erzeugtAm: e.herkunft.erzeugtAm ?? jetzt };
  const medium: Medium = {
    ...neuesMedium({
      id, art, bereich: e.bereich, von: e.person, hochgeladen: jetzt, typ, groesse: e.bytes.length,
      ...(e.name ? { name: e.name.slice(0, GRENZEN.name) } : {}),
      ...(masse ? { breite: masse.breite, hoehe: masse.hoehe } : {}),
      // Erzeugte Bytes tragen keine Orts- oder Kameradaten (nur die Kennzeichnung des Anbieters).
      ortsdatenEntfernt: true,
      ...(art === 'video' ? { ton: 'an' as const } : {}),
      // Echte Personen nur über das Ausgangsfoto; zeigt ein erzeugtes Bild realistische Personen, entscheidet ein Mensch („unklar“ bis dahin).
      erkennbarePersonen: q ? (q.erkennbarePersonen ?? 'unklar') : herkunft.sichtbar?.personen ? 'unklar' : 'nein',
      schluessel: gewickelt as GewickelterSchluessel, varianten,
      urheber: { art: 'ki', ki: herkunft }, jetzt,
      ...(q ? { abgeleitetVon: { id: q.id, art: 'ki' as const } } : {}),
    }),
    ...(q?.personen.length ? { personen: personenKopie(q.personen, jetzt) } : {}),
  };
  const zielAlbum = e.album ?? q?.album;
  const r = await katalogAendern(name, kat => {
    if (kat.medien.some(m => m.id === id)) return { ok: true as const, katalog: kat, schon: true };
    const album = zielAlbum && kat.alben.some(a => a.id === zielAlbum && !a.geloeschtAm && a.bereich === e.bereich) ? zielAlbum : undefined;
    return { ok: true as const, katalog: { ...kat, medien: [...kat.medien, album ? { ...medium, album } : medium] }, schon: false };
  });
  if (!r.ok) { await objekteLoeschen(medium).catch(() => 0); return F(r.status, r.fehler); }
  const gespeichert = r.katalog.medien.find(m => m.id === id)!;
  return { ok: true, medium: gespeichert, ...(r.schon ? { schon: true as const } : {}) };
}

/** Das Original eines Mediums ganz (Tests, Übernahme-Prüfung) — nur, wer es sieht. */
export async function kiMediumOeffnen(person: string, id: string): Promise<{ medium: Medium; bytes: Buffer } | null> {
  const b = await betrachterFuer(person);
  if (!b) return null;
  const f = await mediumFinden(b, id);
  const v = f?.medium.varianten.original;
  if (!f || !v) return null;
  const s = await medienSpeicher();
  const roh = s ? await s.lesen(v.objekt) : null;
  if (!roh) return null;
  return { medium: f.medium, bytes: ganzEntschluesseln(schluesselOeffnen(f.medium.schluessel, f.medium.id), { mediumId: f.medium.id, variante: 'original' }, v.salze, v.bytes, roh) };
}

/**
 * Ein Foto als Vorlage für die Bild-KI laden (Bild bearbeiten; ein Head sieht ein Bild) — DIE Prüfstelle am Medium: nur Business, nur sichtbar,
 * mit `headId` nur, wenn es diesem Head ausdrücklich gegeben wurde; dann `anKiGruende` (Personen nur mit Einwilligung „KI“, nie Minderjährige,
 * nie Unbekannte, nichts Gesperrtes). Den Schalter „Bilder an die KI“ prüft danach das KI-Tor (Kategorie `medien`).
 */
export async function kiVorlageLaden(person: string, mediumId: string, o: { headId?: string } = {}): Promise<Antwort<{ medium: Medium; bytes: Buffer; typ: string }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Medien gibt es nur im Haushalt des Inhabers.');
  const f = typeof mediumId === 'string' && /^md-[0-9a-f-]{36}$/.test(mediumId) ? await mediumFinden(b, mediumId) : null;
  if (!f) return F(404, TEXTE.fehlt);
  const m = f.medium;
  if (f.quelle.art !== 'business') return F(403, 'Private Medien gehen nie an die KI der Heads — Privates bleibt im Haushalt.');
  if (o.headId && !m.heads.some(h => h.head === o.headId)) return F(403, 'Dieses Medium wurde diesem Head nicht gegeben („An Head geben …“ in der Detailansicht).');
  const gruende = anKiGruende(m, await lageFuer(f.quelle.katalog));
  if (gruende.length) return F(409, gruende[0]);
  const v = m.varianten.ansicht ?? (m.varianten.original && m.varianten.original.bytes <= REFERENZ_MAX_BYTES ? m.varianten.original : undefined);
  const variante = m.varianten.ansicht ? 'ansicht' : 'original';
  if (!v) return F(413, 'Das Foto ist zu groß für eine Vorlage (keine Ansicht ≤ 1568 px vorhanden).');
  const bytes = await variantenBytes(m, variante, v).catch(() => null);
  if (!bytes) return F(404, 'Das Foto lässt sich gerade nicht öffnen.');
  return { ok: true, medium: m, bytes, typ: v.typ };
}

/**
 * Einen KI-Vorschlag (Medium mit `ki.vorschlag = 'offen'`) entscheiden — aus dem Freigabe-Stapel (Klick eines Menschen). Übernommen bleibt es
 * (dann freigebbar wie jedes Medium); verworfen geht es in den Papierkorb (30 Tage wiederherstellbar). Idempotent: schon entschieden → 409.
 */
export async function kiVorschlagEntscheiden(person: string, mediumId: string, entscheidung: 'uebernommen' | 'verworfen'): Promise<Antwort<{ medium: Medium }>> {
  const b = await betrachterFuer(person);
  if (!b) return F(403, 'Nur im Haushalt des Inhabers.');
  const jetzt = new Date().toISOString();
  let raus: Medium | null = null;
  const r = await katalogAendern(medienBestand(b.haushalt), kat => {
    const i = kat.medien.findIndex(m => m.id === mediumId);
    if (i < 0) return F(404, TEXTE.fehlt) as Fehler;
    const m = kat.medien[i];
    if (m.urheber.art !== 'ki' || m.urheber.ki?.vorschlag !== 'offen') return F(409, 'Dieser Vorschlag ist schon entschieden.') as Fehler;
    const neu: Medium = {
      ...m, urheber: { ...m.urheber, ki: { ...m.urheber.ki, vorschlag: entscheidung } },
      ...(entscheidung === 'verworfen' ? { geloeschtAm: jetzt, geloeschtVon: person, heads: [] } : {}), geaendert: jetzt, geaendertVon: person,
    };
    raus = neu;
    const medien = kat.medien.slice(); medien[i] = neu;
    return { ok: true as const, katalog: { ...kat, medien } };
  });
  return r.ok && raus ? { ok: true, medium: raus } : (r as { ok: false; status: number; fehler: string });
}

// ── Übernahme des Altbestands `ki-medien--<haushalt>` (Lese-Übergang, einmal je Eintrag) ────────────────────────────────────────

/** km-<uuid> → md-<uuid>: dieselbe UUID, damit die Übernahme idempotent ist. */
export const kennungAusAlt = (km: string): string | null => (/^km-[0-9a-f-]{36}$/.test(km) ? `md-${km.slice(3)}` : null);

/**
 * Fertige Einträge aus `ki-medien--<haushalt>` einmal in die EINE Ablage übernehmen (Business; „nur ich“ → Privat der auslösenden Person).
 * Nie beim Lesen — im täglichen Medien-Lauf (lib/medien/pflege.ts) und beim Abholen (lib/ki/aufruf.ts). Der Altbestand bleibt liegen
 * (Rückweg); der Eintrag bekommt nur die Marke `uebernommenAls`. Wirft nie; Zähler für den Bericht.
 */
export async function kiMedienUebernehmen(haushalt: string): Promise<{ uebernommen: number; offen: number }> {
  const raus = { uebernommen: 0, offen: 0 };
  try {
    const { medienSpeicher: kiBestand, mediumAbschliessen } = await import('@/lib/ki/medien');
    const { bildOeffnen } = await import('@/lib/store/bild-ablage');
    const alt = (await loadJson<{ medien?: import('@/lib/ki/medien').KiMedium[] }>(kiBestand(haushalt)).catch(() => null))?.medien ?? [];
    for (const m of alt) {
      if (m.status !== 'fertig' || m.geloeschtAm || m.uebernommenAls) continue;
      const id = kennungAusAlt(m.id);
      const bytes = id ? await bildOeffnen('ki-medien', `${m.id}.bin`).catch(() => null) : null;
      if (!id || !bytes) { raus.offen++; continue; }
      const r = await kiMediumAblegen({
        person: m.person, bereich: m.ziel?.bereich ?? (m.sichtbarkeit === 'nur-ich' ? 'privat' : 'business'), bytes, id,
        ...(m.ziel?.album ? { album: m.ziel.album } : {}), ...(m.ziel?.name ? { name: m.ziel.name } : {}),
        herkunft: { anbieter: m.anbieter, modell: m.modell, erzeugtAm: m.erzeugtAm, kennzeichnung: m.kennzeichnung, ...(m.sichtbar ? { sichtbar: m.sichtbar } : {}), zeichenNoetig: m.zeichenNoetig, prompt: m.prompt, kosten: m.kosten, ...(m.ziel?.agent ? { agent: m.ziel.agent } : {}), alt: m.id },
      });
      if (!r.ok) { raus.offen++; continue; }
      await mediumAbschliessen(haushalt, m.id, { uebernommenAls: r.medium.id });
      raus.uebernommen++;
    }
  } catch (e) { console.error('[medien] KI-Übernahme:', e instanceof Error ? e.message : e); }
  return raus;
}

/** Herkunftsangabe eines KI-Mediums (zweite Schicht der Kennzeichnung, KI-VO Art. 50) — nur, wer es sieht; sonst null. */
export async function kiHerkunftFuer(person: string, id: string): Promise<Record<string, unknown> | null> {
  const b = await betrachterFuer(person);
  const f = b ? await mediumFinden(b, id) : null;
  const k = f?.medium.urheber.art === 'ki' ? f.medium.urheber.ki : undefined;
  if (!f || !k) return null;
  const { herkunftsAngabe } = await import('@/lib/ki/kennzeichnung');
  return { ...herkunftsAngabe({ anbieter: k.anbieter, modell: k.modell, erzeugtAm: k.erzeugtAm, art: f.medium.art, ...(k.sichtbar ? { sichtbar: k.sichtbar } : {}) }), medium: f.medium.id };
}

