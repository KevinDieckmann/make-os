// ─── Medien: Ergebnis der Reel-Werkstatt ablegen (28.10.2026, Malin-Paket) — Server ─────────────────────────────────────────────────────
// Die Reel-Werkstatt (lib/social/werkstatt) rendert aus einem oder mehreren Medien der Ablage ein neues Video bzw. Bild. Es landet als
// NEUES Medium in derselben Ablage (EINE Schreibstelle der Kataloge: `katalogAendern`), nie als Ersatz der Quellen:
//   · Bereich Business (Social gehört zur Markttraktion), Album = das der ersten Quelle;
//   · Herkunft `abgeleitetVon: { art: 'schnitt', id: <erste Quelle>, quellen }` — die Werkstatt-Regel „Videos nur aus der Werkstatt“ liest das;
//   · Personen und Einwilligungen ALLER Quellen gehen mit (neue Markierungs-Kennungen, dieselben Einwilligungen) — ein Schnitt löst keine
//     Einwilligung auf; „erkennbare Personen“ = der strengste Wert der Quellen;
//   · Ton: „an“ nur, wenn eine Quelle Ton „an“ hatte (dort wurde er bewusst behalten), sonst „keiner“ (die Werkstatt legt Stille unter);
//   · Freigabe fürs Marketing: wie jedes neue Medium „intern“ — rausgehen darf es erst nach der Freigabe eines Menschen (Ablage-Regel).
// Bytes: das Ergebnis von ffmpeg (keine Orts- oder Kameradaten), dazu Poster/Raster als JPEG für Galerie und Vorschau.

import { neueKennung } from '@/lib/kennung';
import { GRENZEN, type Medium, type MedienTyp, type PersonImBild, type GewickelterSchluessel, type ObjektVerweis } from './typen';
import { neuesMedium, type Fehler } from './regeln';
import { betrachterFuer, katalogAendern, katalogName, mediumFinden, objekteLoeschen } from './server';
import { neuerSchluessel } from './krypto';
import { medienSpeicher, SpeicherFehler } from './speicher';
import { typAusInhalt } from './upload-server';
import { bildMasse } from './bildmasse';
import { originalAblegen, kleinAblegen, objektVon } from './ki-ablage';

type SchnittFehler = { ok: false; status: number; fehler: string };
type Antwort<T> = ({ ok: true } & T) | SchnittFehler | Fehler;
const F = (status: number, fehler: string): SchnittFehler => ({ ok: false, status, fehler });

export interface SchnittAblageEingabe {
  /** Wer gerendert hat (Speichername der auftraggebenden Person). */
  person: string;
  quellen: string[];
  bytes: Buffer;
  /** Poster (JPEG) für Videos bzw. verkleinerte Vorschau. */
  poster?: Buffer;
  raster?: Buffer;
  name?: string;
  dauerSek?: number;
  breite?: number; hoehe?: number;
  /** Feste Kennung (idempotent je Werkstatt-Auftrag + Stand). */
  id?: string;
}

const STRENG: Record<string, number> = { nein: 0, unklar: 1, ja: 2 };

/** Personen aller Quellen — je Kontakt/Konto einmal, Unbekannte als Summe; neue Markierungs-Kennungen (Einwilligungen bleiben dieselben). */
export function personenAusQuellen(quellen: readonly Pick<Medium, 'personen'>[], jetzt: string): PersonImBild[] {
  const raus: PersonImBild[] = [];
  let unbekannt = 0;
  for (const q of quellen) for (const p of q.personen) {
    if (p.art === 'unbekannt') { unbekannt += p.anzahl ?? 1; continue; }
    if (raus.some(x => x.art === p.art && x.kontaktId === p.kontaktId && x.konto === p.konto)) continue;
    raus.push({ ...p, id: neueKennung('pb'), am: jetzt });
  }
  if (unbekannt) raus.push({ id: neueKennung('pb'), art: 'unbekannt', anzahl: unbekannt, rolle: 'beiwerk', markiertVon: 'system', am: jetzt });
  return raus;
}

export async function schnittMediumAblegen(e: SchnittAblageEingabe): Promise<Antwort<{ medium: Medium; schon?: true }>> {
  const b = await betrachterFuer(e.person);
  if (!b) return F(403, 'Medien gibt es nur im Haushalt des Inhabers.');
  if (!e.quellen.length) return F(400, 'Ohne Quelle kein Schnitt.');
  const quellen: Medium[] = [];
  for (const id of e.quellen) {
    const f = await mediumFinden(b, id);
    if (!f || f.medium.bereich !== 'business') return F(404, 'Eine Quelle gibt es nicht (mehr) in der Business-Ablage.');
    quellen.push(f.medium);
  }
  const typ = typAusInhalt(e.bytes.subarray(0, 64)) as MedienTyp | null;
  if (!typ) return F(415, 'Das Ergebnis ist kein JPEG oder MP4.');
  const art = typ.startsWith('image/') ? 'bild' as const : 'video' as const;
  if (e.bytes.length > (art === 'bild' ? GRENZEN.bild : GRENZEN.video)) return F(413, 'Ergebnis zu groß.');
  const name = katalogName('business', b.haushalt);
  const id = e.id && /^md-[0-9a-f-]{36}$/.test(e.id) ? e.id : neueKennung('md');
  const s = await medienSpeicher();
  if (!s) return F(503, 'Medien sind auf dieser Instanz ausgeschaltet.');
  const { dek, gewickelt } = neuerSchluessel(id);
  const masse = art === 'bild' ? bildMasse(e.bytes) : null;
  let varianten: Medium['varianten'];
  try {
    const original = await originalAblegen(s, dek, id, e.bytes, typ);
    varianten = { original };
    if (e.poster && e.poster.length <= GRENZEN.vorschau) varianten.poster = await kleinAblegen(s, dek, id, 'poster', e.poster, 'image/jpeg');
    if (e.raster && e.raster.length <= GRENZEN.vorschau) varianten.raster = await kleinAblegen(s, dek, id, 'raster', e.raster, 'image/jpeg');
    if (art === 'bild' && !varianten.raster && e.bytes.length <= GRENZEN.vorschau) varianten.raster = await kleinAblegen(s, dek, id, 'raster', e.bytes, typ);
  } catch (x) {
    const weg = (v: string) => ({ objekt: objektVon(id, v) }) as unknown as ObjektVerweis;
    await objekteLoeschen({ varianten: { original: weg('original'), poster: weg('poster'), raster: weg('raster') }, urheber: { art: 'team' } }).catch(() => 0);
    return F(x instanceof SpeicherFehler && x.status === 507 ? 507 : 503, x instanceof Error ? x.message : 'Speicher nicht erreichbar.');
  }
  const jetzt = new Date().toISOString();
  const erkennbar = quellen.reduce<'ja' | 'nein' | 'unklar'>((acc, q) => (STRENG[q.erkennbarePersonen ?? 'unklar'] > STRENG[acc] ? (q.erkennbarePersonen ?? 'unklar') : acc), 'nein');
  const personen = personenAusQuellen(quellen, jetzt);
  const medium: Medium = {
    ...neuesMedium({
      id, art, bereich: 'business', von: e.person, hochgeladen: jetzt, typ, groesse: e.bytes.length,
      ...(e.name ? { name: e.name.slice(0, GRENZEN.name) } : {}),
      ...(masse ? { breite: masse.breite, hoehe: masse.hoehe } : e.breite && e.hoehe ? { breite: e.breite, hoehe: e.hoehe } : {}),
      ...(art === 'video' && e.dauerSek ? { dauerSek: Math.round(e.dauerSek * 10) / 10 } : {}),
      ortsdatenEntfernt: true,
      ...(art === 'video' ? { ton: quellen.some(q => q.ton === 'an') ? 'an' as const : 'keiner' as const } : {}),
      erkennbarePersonen: erkennbar,
      schluessel: gewickelt as GewickelterSchluessel, varianten,
      abgeleitetVon: { id: quellen[0].id, art: 'schnitt', quellen: quellen.map(q => q.id) },
      jetzt,
    }),
    ...(personen.length ? { personen } : {}),
  };
  const album = quellen[0].album;
  const r = await katalogAendern(name, kat => {
    if (kat.medien.some(m => m.id === id)) return { ok: true as const, katalog: kat, schon: true };
    const da = album && kat.alben.some(a => a.id === album && !a.geloeschtAm && a.bereich === 'business') ? album : undefined;
    return { ok: true as const, katalog: { ...kat, medien: [...kat.medien, da ? { ...medium, album: da } : medium] }, schon: false };
  });
  if (!r.ok) { await objekteLoeschen(medium).catch(() => 0); return F(r.status, r.fehler); }
  return { ok: true, medium: r.katalog.medien.find(m => m.id === id)!, ...(r.schon ? { schon: true as const } : {}) };
}
