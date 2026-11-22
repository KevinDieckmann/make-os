// MAKE Innovation · kleinere Bildvarianten (WebP) für die Fotos und Vorlagenblätter (21.11.2026).
// Aufruf:  node bildvarianten.mjs            (legt <name>-<breite>.webp neben jede Quelle; schon aktuelle Dateien bleiben)
// Die Originale (JPG) werden nie verändert und bleiben als Rückfall im Bild-Tag; bauen.mjs nimmt die Varianten, die es gibt.
// Braucht „sharp“ aus dem Repo (node_modules im Hauptordner), keine Installation hier.
import { createRequire } from 'node:module';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(join(ORDNER, '..', '..', 'package.json'))('sharp');
const QUALITAET = 78;

/** Regeln: Ordner (relativ), Namensmuster, gewünschte Breiten (nie über die Breite der Quelle hinaus). */
const REGELN = [
  { ordner: 'assets/team', muster: /^(kevin|malin|malin-2|kevin-malin)\.jpg$/, breiten: [320, 480, 700] },
  { ordner: 'assets/team', muster: /^kevin-malin-quer\.jpg$/, breiten: [640, 1000, 1400] },
  { ordner: 'assets/bild/bausteine', muster: /-seite\.jpg$/, breiten: [480, 900] },
  { ordner: 'assets/bild/vorlagen', muster: /-seite\.jpg$/, breiten: [480, 900] },
  { ordner: 'assets/bild/bausteine', muster: /-titel\.jpg$/, breiten: [320, 640] },
  { ordner: 'assets/bild/vorlagen', muster: /-titel\.jpg$/, breiten: [320, 640] },
  { ordner: 'assets/bild/arbeitsprobe', muster: /^rechner\.jpg$/, breiten: [720, 1440] },
  { ordner: 'assets/bild/arbeitsprobe', muster: /^handy\.jpg$/, breiten: [390, 780] },
];

let neu = 0, uebersprungen = 0, vorher = 0, nachher = 0;
for (const r of REGELN) {
  for (const name of readdirSync(join(ORDNER, r.ordner)).filter((n) => r.muster.test(n)).sort()) {
    const quelle = join(ORDNER, r.ordner, name), meta = await sharp(quelle).metadata();
    for (const b of r.breiten) {
      if (b > meta.width) continue;
      const ziel = join(ORDNER, r.ordner, name.replace(/\.jpg$/, `-${b}.webp`));
      if (existsSync(ziel) && statSync(ziel).mtimeMs >= statSync(quelle).mtimeMs) { uebersprungen++; continue; }
      await sharp(quelle).resize({ width: b }).webp({ quality: QUALITAET, effort: 5 }).toFile(ziel);
      neu++; vorher += statSync(quelle).size; nachher += statSync(ziel).size;
    }
  }
}
console.log(`${neu} neue Varianten, ${uebersprungen} aktuell. (Summe der Originale für die neuen: ${(vorher / 1024).toFixed(0)} KB, Varianten: ${(nachher / 1024).toFixed(0)} KB)`);
