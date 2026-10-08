// ─── Medien — Ort und Ton aus MOV/MP4 entfernen, OHNE Neukodierung (09.10., Paket 5; rein, getestet) ────────────────────────
// Ein iPhone-Video trägt den Aufnahmeort in `moov/meta` (mdta-Schlüssel `com.apple.quicktime.location.ISO6709`) bzw. `moov/udta/©xyz`
// (Apple QuickTime-Doku; research/agenten/MEDIEN.md B5). Neu zu kodieren geht auf dem schwachen Server nicht und am iPhone erst ab iOS 26 —
// deshalb wird IM BROWSER gepatcht, ohne die Datei zu verschieben:
//   · Ort: die Atome `udta` und `meta` unter `moov` und unter jeder Spur werden zu `free` (gleiche Größe, Inhalt genullt) — kein Offset
//     ändert sich, die Bild- und Tondaten bleiben Byte für Byte.
//   · Ton (Kevin 09.10.: „Ton standardmäßig aus“, § 201 StGB): jede Tonspur (`hdlr` = `soun`) und jede Metadaten-Spur (`meta`) verschwindet —
//     ihre Abtastwerte im `mdat` werden genullt (Bereiche aus `stco`/`co64`, `stsc`, `stsz`), das Spur-Atom wird zu `free`. Was nicht sicher
//     geht (fragmentierte Datei, unbekannter Aufbau), meldet `ton: 'nicht-freigegeben'` — dann spielt MAKE OS das Video nie ab und teilt es nie.
// Ergebnis = Liste von Patches (Bereich + Bytes, ohne Bytes = Nullen), die der Upload beim Lesen der Stücke anwendet — die Datei wird nie
// ganz in den Speicher gelesen (nur `moov`, höchstens 64 MiB). [A] Am Gerät mit exiftool/ffprobe prüfen (UPDATES.md › iPhone-Prüfliste).

export interface Patch { von: number; laenge: number; bytes?: Uint8Array }
export interface Mp4Ergebnis {
  /** `moov` gefunden und alle Orts-Atome neutralisiert. */
  ortEntfernt: boolean;
  /** keiner = keine Tonspur · entfernt = genullt und entfernt · an = bewusst behalten · nicht-freigegeben = ließ sich nicht entfernen. */
  ton: 'keiner' | 'entfernt' | 'an' | 'nicht-freigegeben';
  patches: Patch[];
  /** Für die Anzeige: was gemacht wurde (Atome, Spuren). */
  bericht: string[];
}

export type Leser = (von: number, laenge: number) => Promise<Uint8Array>;

const MOOV_MAX = 64 * 1024 * 1024;
const typ = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);

interface Atom { typ: string; start: number; kopf: number; groesse: number }

/** Kinder eines Container-Atoms im Puffer `b` (Bereich [von, bis)). `basis` = Lage von b[0] in der Datei. */
function kinder(b: Uint8Array, von: number, bis: number): Atom[] {
  const raus: Atom[] = [];
  let o = von;
  while (o + 8 <= bis) {
    let groesse = u32(b, o), kopf = 8;
    if (groesse === 1) { if (o + 16 > bis) throw new Error('Atom abgeschnitten'); groesse = u64(b, o + 8); kopf = 16; }
    else if (groesse === 0) groesse = bis - o;
    if (groesse < kopf || o + groesse > bis) throw new Error('Atom-Größe ungültig');
    raus.push({ typ: typ(b, o + 4), start: o, kopf, groesse });
    o += groesse;
  }
  if (o !== bis) throw new Error('Rest nach dem letzten Atom');
  return raus;
}

/** Ein Atom neutralisieren: Typ `free`, Inhalt genullt (Größe gleich). `basis` = Dateilage von b[0]. */
function freiPatch(b: Uint8Array, a: Atom, basis: number): Patch {
  const bytes = new Uint8Array(a.groesse);
  bytes.set(b.subarray(a.start, a.start + a.kopf), 0);
  bytes.set([0x66, 0x72, 0x65, 0x65], 4); // 'free'
  return { von: basis + a.start, laenge: a.groesse, bytes };
}

/** Bereiche der Abtastwerte einer Spur (aus stbl) in der Datei. */
function spurBereiche(b: Uint8Array, stbl: Atom): { von: number; laenge: number }[] {
  const k = kinder(b, stbl.start + stbl.kopf, stbl.start + stbl.groesse);
  const finde = (t: string) => k.find(x => x.typ === t);
  const stsz = finde('stsz'), stsc = finde('stsc'), stco = finde('stco'), co64 = finde('co64');
  if (!stsz || !stsc || (!stco && !co64)) throw new Error('Tabellen der Spur fehlen');
  // stsz: FullBox(4) sample_size(4) sample_count(4) [entry_size × count]
  const zO = stsz.start + stsz.kopf;
  const feste = u32(b, zO + 4), anzahl = u32(b, zO + 8);
  const groesse = (i: number) => (feste ? feste : u32(b, zO + 12 + 4 * i));
  // stsc: FullBox(4) entry_count(4) [first_chunk, samples_per_chunk, sdi] × n
  const cO = stsc.start + stsc.kopf, cN = u32(b, cO + 4);
  const stscE = Array.from({ length: cN }, (_, i) => ({ erster: u32(b, cO + 8 + 12 * i), je: u32(b, cO + 12 + 12 * i) }));
  // stco/co64: FullBox(4) entry_count(4) [offset × n]
  const t = (stco ?? co64)!, tO = t.start + t.kopf, tN = u32(b, tO + 4);
  const offsets = Array.from({ length: tN }, (_, i) => (stco ? u32(b, tO + 8 + 4 * i) : u64(b, tO + 8 + 8 * i)));
  const raus: { von: number; laenge: number }[] = [];
  let probe = 0;
  for (let c = 0; c < tN; c++) {
    const e = [...stscE].reverse().find(x => x.erster <= c + 1);
    if (!e) throw new Error('stsc ohne Eintrag');
    let laenge = 0;
    for (let s = 0; s < e.je && probe < anzahl; s++, probe++) laenge += groesse(probe);
    if (laenge) raus.push({ von: offsets[c], laenge });
  }
  if (probe !== anzahl) throw new Error('Abtastwerte passen nicht zu den Blöcken');
  return raus;
}

function handler(b: Uint8Array, trak: Atom): string | null {
  const mdia = kinder(b, trak.start + trak.kopf, trak.start + trak.groesse).find(x => x.typ === 'mdia');
  if (!mdia) return null;
  const hdlr = kinder(b, mdia.start + mdia.kopf, mdia.start + mdia.groesse).find(x => x.typ === 'hdlr');
  return hdlr ? typ(b, hdlr.start + hdlr.kopf + 8) : null;
}

function stblVon(b: Uint8Array, trak: Atom): Atom {
  const pfad = ['mdia', 'minf', 'stbl'];
  let a = trak;
  for (const t of pfad) {
    const k = kinder(b, a.start + a.kopf, a.start + a.groesse).find(x => x.typ === t);
    if (!k) throw new Error(`${t} fehlt`);
    a = k;
  }
  return a;
}

/**
 * Patches für eine MOV/MP4-Datei der Größe `gesamt`. `tonBehalten` = der Ton-Schalter (mit Hinweis § 201 StGB) war an.
 * Wirft nie — ein unbekannter Aufbau ergibt `ortEntfernt: false` bzw. `ton: 'nicht-freigegeben'`.
 */
export async function ortUndTonEntfernen(lesen: Leser, gesamt: number, tonBehalten: boolean): Promise<Mp4Ergebnis> {
  const bericht: string[] = [];
  let moov: Atom | null = null, fragmentiert = false;
  try {
    let o = 0;
    while (o + 8 <= gesamt) {
      const k = await lesen(o, Math.min(16, gesamt - o));
      let groesse = u32(k, 0), kopf = 8;
      if (groesse === 1) { groesse = u64(k, 8); kopf = 16; } else if (groesse === 0) groesse = gesamt - o;
      if (groesse < kopf || o + groesse > gesamt) throw new Error('Atom-Größe ungültig');
      const t = typ(k, 4);
      if (t === 'moov') moov = { typ: t, start: o, kopf, groesse };
      if (t === 'moof') fragmentiert = true;
      o += groesse;
    }
  } catch (e) { bericht.push(`Aufbau nicht lesbar: ${e instanceof Error ? e.message : 'Fehler'}`); }
  if (!moov || moov.groesse > MOOV_MAX) return { ortEntfernt: false, ton: tonBehalten ? 'an' : 'nicht-freigegeben', patches: [], bericht: [...bericht, moov ? 'moov zu groß' : 'kein moov gefunden'] };

  const b = await lesen(moov.start, moov.groesse);
  const basis = moov.start;
  const lokal: Atom = { ...moov, start: 0 };
  const patches: Patch[] = [];
  let ortEntfernt = true;
  let tonDa = false, tonWeg = true;
  try {
    for (const a of kinder(b, lokal.kopf, lokal.groesse)) {
      if (a.typ === 'udta' || a.typ === 'meta') { patches.push(freiPatch(b, a, basis)); bericht.push(`moov/${a.typ} entfernt`); continue; }
      if (a.typ === 'cmov') { ortEntfernt = false; bericht.push('komprimiertes moov — nicht geprüft'); continue; }
      if (a.typ !== 'trak') continue;
      const h = handler(b, a);
      const entfernen = h === 'meta' || (h === 'soun' && !tonBehalten);
      if (h === 'soun') tonDa = true;
      if (entfernen) {
        try {
          if (fragmentiert) throw new Error('fragmentierte Datei');
          for (const r of spurBereiche(b, stblVon(b, a))) {
            if (r.von + r.laenge > gesamt || (r.von < basis + lokal.groesse && r.von + r.laenge > basis)) throw new Error('Abtastwerte außerhalb der Daten');
            patches.push({ von: r.von, laenge: r.laenge });
          }
          patches.push(freiPatch(b, a, basis));
          bericht.push(`${h === 'soun' ? 'Tonspur' : 'Metadaten-Spur'} entfernt`);
        } catch (e) {
          if (h === 'soun') tonWeg = false;
          else ortEntfernt = false;
          bericht.push(`${h === 'soun' ? 'Tonspur' : 'Metadaten-Spur'} nicht entfernbar: ${e instanceof Error ? e.message : 'Fehler'}`);
        }
        continue;
      }
      for (const k of kinder(b, a.start + a.kopf, a.start + a.groesse)) {
        if (k.typ === 'udta' || k.typ === 'meta') { patches.push(freiPatch(b, k, basis)); bericht.push(`trak/${k.typ} entfernt`); }
      }
    }
  } catch (e) {
    return { ortEntfernt: false, ton: tonBehalten ? 'an' : 'nicht-freigegeben', patches: [], bericht: [...bericht, `moov nicht lesbar: ${e instanceof Error ? e.message : 'Fehler'}`] };
  }
  const ton: Mp4Ergebnis['ton'] = !tonDa ? 'keiner' : tonBehalten ? 'an' : tonWeg ? 'entfernt' : 'nicht-freigegeben';
  return { ortEntfernt, ton, patches: patches.sort((x, y) => x.von - y.von), bericht };
}

/** Patches auf ein Stück anwenden, das bei `von` in der Datei beginnt (gibt eine geänderte Kopie zurück, wenn etwas passt). */
export function patchesAnwenden(stueck: Uint8Array, von: number, patches: readonly Patch[]): Uint8Array {
  const bis = von + stueck.length;
  let raus: Uint8Array | null = null;
  for (const p of patches) {
    if (p.von >= bis || p.von + p.laenge <= von) continue;
    raus ??= new Uint8Array(stueck);
    const a = Math.max(p.von, von), e = Math.min(p.von + p.laenge, bis);
    if (p.bytes) raus.set(p.bytes.subarray(a - p.von, e - p.von), a - von);
    else raus.fill(0, a - von, e - von);
  }
  return raus ?? stueck;
}
