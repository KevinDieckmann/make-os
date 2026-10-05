// ─── Bilder verschlüsselt und atomar (05.10., Paket „Verschlüsselung lückenlos“) ───────────────────────────────────
// Fotos zu Gerichten (lib/ernaehrung/bilder.ts, `bilder-gerichte/`) und Bildschirmfotos im Bauplan (lib/bauplan/
// speicher.ts, `bauplan-bilder/`) lagen bis 05.10. als Klartext-JPEG/PNG im Datenordner (TOM L9) und wurden mit
// `writeFile` direkt auf den Zielnamen geschrieben. Jetzt wie die Dateiablage:
//   · Hülle der Dateiablage (lib/store/datei-huelle.mjs `binImModus`): kompatibel „MKOSDAT1“, Format v2 „MKOSDAT2“ mit
//     Schlüssel-ID und AAD `make-os|datei|<ordner>/<name>` — ein umbenanntes oder vertauschtes Bild öffnet sich nicht;
//   · atomar und dauerhaft (lib/store/atomar.mjs `atomarSchreiben`), Datei 0600, Ordner 0700;
//   · Lesen über den Schlüsselring (Rotation im laufenden Betrieb), alte Klartext-Bilder werden beim ersten Lesen EINMAL
//     verschlüsselt (Migration beim Lesen; alternativ alle auf einmal: scripts/daten-verschluesselung.mjs --verschluesseln);
//   · ohne Datenschlüssel (lokale Entwicklung) wie bisher Klartext.
// Je Bild eine Warteschlange in diesem Prozess: Speichern, Löschen, Migrieren und Umschlüsseln desselben Bilds laufen
// nacheinander — ein gleichzeitiges Löschen kann so kein Bild „wiederbeleben“.
// Rückweg zum alten Stand: VORHER `scripts/daten-verschluesselung.mjs --entschluesseln` (bei angehaltener App) — der alte
// Code liest die Bilder roh und zeigte sonst Hüllen statt Fotos (UPDATES.md 05.10.).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from './local-db';
import { atomarSchreiben } from './atomar.mjs';
import { schluesselRing, SchluesselFehlt } from './huelle.mjs';
import { binVersion, binOeffnen, binImModus, binAktuell, BILD_ORDNER, BILD_NAME } from './datei-huelle.mjs';

export type BildOrdner = (typeof BILD_ORDNER)[number];
export { BILD_ORDNER };
const NAME_OK = BILD_NAME;

function pfad(ordner: BildOrdner, name: string): string {
  if (!(BILD_ORDNER as readonly string[]).includes(ordner) || !NAME_OK.test(name)) throw new Error('Unzulässiger Bildname.');
  return path.join(datenOrdner(), ordner, name);
}

// Warteschlange je Bild (dieser Prozess — App und Rotation laufen im selben Prozess, das Skript nur bei angehaltener App).
const schlange = new Map<string, Promise<unknown>>();
function nacheinander<T>(schluessel: string, fn: () => Promise<T>): Promise<T> {
  const vorher = schlange.get(schluessel) ?? Promise.resolve();
  const lauf = vorher.catch(() => {}).then(fn);
  const ende = lauf.catch(() => {});
  schlange.set(schluessel, ende);
  void ende.then(() => { if (schlange.get(schluessel) === ende) schlange.delete(schluessel); });
  return lauf;
}

/** Ein Bild ablegen: verschlüsselt (wenn ein Datenschlüssel da ist), atomar, 0600 im Ordner 0700. */
export async function bildAblegen(ordner: BildOrdner, name: string, bytes: Buffer): Promise<void> {
  const p = pfad(ordner, name);
  await nacheinander(`${ordner}/${name}`, async () => {
    await fs.mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
    const aktiv = schluesselRing().aktiv;
    await atomarSchreiben(p, aktiv ? binImModus(bytes, aktiv, ordner, name) : bytes);
  });
}

/**
 * Ein Bild lesen — null, wenn es fehlt oder sich nicht öffnen lässt (Schlüssel fehlt/falsch: Log, kein Absturz der Seite).
 * Ein altes Klartext-Bild wird bei gesetztem Schlüssel einmal verschlüsselt zurückgeschrieben.
 */
export async function bildOeffnen(ordner: BildOrdner, name: string): Promise<Buffer | null> {
  let p: string;
  try { p = pfad(ordner, name); } catch { return null; }
  return nacheinander(`${ordner}/${name}`, async () => {
    let roh: Buffer;
    try { roh = await fs.readFile(p); } catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null; throw e; }
    const ring = schluesselRing();
    if (binVersion(roh)) {
      try { return binOeffnen(roh, ring, ordner, name).klar; }
      catch (e) { console.error(`[bilder] ${ordner}/${name}: ${e instanceof SchluesselFehlt ? 'Datenschlüssel fehlt' : 'nicht lesbar (verändert oder falscher Name)'}`); return null; }
    }
    if (ring.aktiv) {
      try { await atomarSchreiben(p, binImModus(roh, ring.aktiv, ordner, name)); }
      catch (e) { console.error(`[bilder] ${ordner}/${name}: Klartext nicht verschlüsselt (${e instanceof Error ? e.message.slice(0, 80) : 'unbekannt'}) — beim nächsten Lesen erneut.`); }
    }
    return roh;
  });
}

/** Ein Bild entfernen (fehlt es schon, ist das kein Fehler). */
export async function bildEntfernen(ordner: BildOrdner, name: string): Promise<void> {
  let p: string;
  try { p = pfad(ordner, name); } catch { return; }
  await nacheinander(`${ordner}/${name}`, () => fs.unlink(p).catch(() => {}));
}

/** Rotation/Umstellung: alle Bilder in die Hülle des Modus mit dem aktiven Schlüssel bringen (lib/store/umschluesseln.ts). */
export async function bilderUmschluesseln(): Promise<{ neu: number; schon: number; fehler: string[] }> {
  const ring = schluesselRing();
  const aktiv = ring.aktiv;
  const r = { neu: 0, schon: 0, fehler: [] as string[] };
  if (!aktiv) return r;
  for (const ordner of BILD_ORDNER) {
    for (const name of (await fs.readdir(path.join(datenOrdner(), ordner)).catch(() => [] as string[])).filter(n => NAME_OK.test(n))) {
      try {
        await nacheinander(`${ordner}/${name}`, async () => {
          const p = pfad(ordner, name);
          let b: Buffer;
          try { b = await fs.readFile(p); } catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return; throw e; }
          if (!binVersion(b)) { await atomarSchreiben(p, binImModus(b, aktiv, ordner, name)); r.neu++; return; }
          const o = binOeffnen(b, ring, ordner, name);
          if (binAktuell(o, aktiv)) { r.schon++; return; }
          await atomarSchreiben(p, binImModus(o.klar, aktiv, ordner, name));
          r.neu++;
        });
      } catch (e) { r.fehler.push(`${ordner}/${name}: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`); }
    }
  }
  return r;
}

/** Wie viele Bilder liegen verschlüsselt bzw. noch im Klartext? (Nachweise, Head of IT — nur Zahlen.) */
export async function bilderZaehlen(): Promise<{ verschluesselt: number; klartext: number }> {
  const z = { verschluesselt: 0, klartext: 0 };
  for (const ordner of BILD_ORDNER) {
    for (const name of (await fs.readdir(path.join(datenOrdner(), ordner)).catch(() => [] as string[])).filter(n => NAME_OK.test(n))) {
      try {
        const fh = await fs.open(path.join(datenOrdner(), ordner, name), 'r');
        try { const kopf = Buffer.alloc(64); const { bytesRead } = await fh.read(kopf, 0, 64, 0); if (!bytesRead) continue; if (binVersion(kopf.subarray(0, bytesRead))) z.verschluesselt++; else z.klartext++; }
        finally { await fh.close(); }
      } catch { /* weg */ }
    }
  }
  return z;
}
