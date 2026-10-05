// ─── Datenschlüssel im laufenden Betrieb rotieren (29.09., Paket D-A #52) ──────
// Vorher (deploy/datenschluessel-rotieren.sh, bleibt als Notweg): App anhalten, alles auf die Platte
// ENTschlüsseln, neu verschlüsseln — eine Minute Ausfall und ein Klartext-Fenster (am 26.09. brach ein
// Lauf genau dort ab). Jetzt:
//   1. neuer Schlüssel = aktiv (…_DATEI), der alte = …_ALT_DATEI — beide lesbar (Schlüsselring, huelle.mjs);
//   2. diese Funktion geht Bestand für Bestand durch, jeweils IN dessen Schreibsperre: öffnen (alt oder neu),
//      mit dem neuen Schlüssel im Schreibformat MAKE_OS_FORMAT neu schreiben (kompatibel = v1 wie aeb4964, sonst v2;
//      atomar) — nie Klartext auf der Platte;
//      dazu die Tagessicherungen je Bestand, das Archiv und die Dateiablage (.bin, unter der Sperre der
//      Ablage-Metadaten beider Ablagen — ein gleichzeitiges Löschen kann keine Datei „wiederbeleben“);
//   3. erst wenn alles `fehler: []` meldet, den alten Schlüssel vom Server nehmen (Passwort-Manager behält ihn
//      für ältere Sicherungen).
// Aufruf: POST /api/intern/umschluesseln (Dienstweg) — deploy/datenschluessel-rotieren-live.sh macht alles.
// Die Dateiablage liest .bin seit 29.09. (Paket D-C) über den Schlüsselring (lib/store/datei-huelle.mjs) — auch
// zwischen Schritt 1 und dem Umschlüsseln der Ablage bleibt jede Datei abrufbar. Umgeschrieben wird in die Hülle des
// Modus (kompatibel „MKOSDAT1“, v2 „MKOSDAT2“ mit Schlüssel-ID + AAD Haushalt/Kennung).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, bestandUmschluesseln, mitBestandSperre } from './local-db';
import { atomarSchreiben } from './atomar.mjs';
import { schluesselRing, schluesselNeuLaden, huellenVersion, huelleOeffnen, huelleImModus, huelleAktuell } from './huelle.mjs';
import { binOeffnen, binImModus, binAktuell, binVersion } from './datei-huelle.mjs';

const NAME_OK = /^[a-z0-9][a-z0-9-]*$/;
const HAUSHALT_OK = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface UmschluesselErgebnis {
  aktivKid: string;
  ring: number;
  bestaende: { neu: number; schon: number };
  sicherungen: number;
  archiv: { neu: number; schon: number };
  ablage: { neu: number; schon: number };
  /** Bilder (05.10., lib/store/bild-ablage.ts). */
  bilder?: { neu: number; schon: number };
  fehler: string[];
}

/** Alles in die Hülle des Modus (kompatibel v1, sonst v2) mit dem aktiven Schlüssel bringen. `neuLaden` liest die Schlüsseldateien sofort neu. */
export async function allesUmschluesseln(neuLaden = true): Promise<UmschluesselErgebnis> {
  if (neuLaden) schluesselNeuLaden();
  const ring = schluesselRing();
  if (!ring.aktiv) throw new Error('Kein aktiver Datenschlüssel.');
  const aktiv = ring.aktiv;
  const ordner = datenOrdner();
  const r: UmschluesselErgebnis = { aktivKid: aktiv.kid, ring: ring.alle.length, bestaende: { neu: 0, schon: 0 }, sicherungen: 0, archiv: { neu: 0, schon: 0 }, ablage: { neu: 0, schon: 0 }, fehler: [] };

  // 1. Bestände (+ ihre Tagessicherungen), auch solche, von denen nur noch Sicherungen da sind.
  const haupt = (await fs.readdir(ordner).catch(() => [] as string[])).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(n => NAME_OK.test(n));
  const ausSicherung = (await fs.readdir(path.join(ordner, 'backup')).catch(() => [] as string[]))
    .map(f => /^([a-z0-9][a-z0-9-]*)-\d{4}-\d{2}-\d{2}\.json$/.exec(f)?.[1]).filter((n): n is string => !!n);
  for (const name of Array.from(new Set([...haupt, ...ausSicherung])).sort()) {
    try {
      const e = await bestandUmschluesseln(name);
      if (e.bestand === 'neu') r.bestaende.neu++; else if (e.bestand === 'schon') r.bestaende.schon++;
      r.sicherungen += e.sicherungen;
      r.fehler.push(...e.fehler);
    } catch (e) { r.fehler.push(`${name}: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`); }
  }

  // 2. Archiv (AAD archiv/<datei>) — Namen sind einmalig, niemand schreibt dieselbe Datei nochmal.
  for (const n of (await fs.readdir(path.join(ordner, 'archiv')).catch(() => [] as string[])).filter(f => f.endsWith('.json'))) {
    const p = path.join(ordner, 'archiv', n);
    try {
      const roh = await fs.readFile(p, 'utf8');
      const o: unknown = JSON.parse(roh);
      const v = huellenVersion(o);
      if (huelleAktuell(o, ring, `archiv/${n}`)) { r.archiv.schon++; continue; }
      const text = v ? huelleOeffnen(o, ring, `archiv/${n}`).text : roh;
      await atomarSchreiben(p, huelleImModus(text, aktiv, `archiv/${n}`));
      r.archiv.neu++;
    } catch (e) { r.fehler.push(`archiv/${n}: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`); }
  }

  // 3. Dateiablage (.bin) je Haushalt — unter den Sperren BEIDER Metadaten-Bestände (CRM- und Aufgaben-Ablage).
  for (const h of (await fs.readdir(path.join(ordner, 'dateien')).catch(() => [] as string[])).filter(x => HAUSHALT_OK.test(x))) {
    await mitBestandSperre(`crm-dateien--${h}`, () => mitBestandSperre(`aufgaben-dateien--${h}`, async () => {
      const dir = path.join(ordner, 'dateien', h);
      for (const n of (await fs.readdir(dir).catch(() => [] as string[])).filter(f => /^d-[a-z0-9-]+\.bin$/.test(f))) {
        const p = path.join(dir, n);
        const id = n.slice(0, -4);
        try {
          const b = await fs.readFile(p);
          if (!binVersion(b)) { await atomarSchreiben(p, binImModus(b, aktiv, h, id)); r.ablage.neu++; continue; }
          let o: { klar: Buffer; version: 1 | 2; kid: string };
          try { o = binOeffnen(b, ring, h, id); } catch { r.fehler.push(`dateien/${h}/${n}: kein Schlüssel passt`); continue; }
          if (binAktuell(o, aktiv)) { r.ablage.schon++; continue; }
          await atomarSchreiben(p, binImModus(o.klar, aktiv, h, id));
          r.ablage.neu++;
        } catch (e) { if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') r.fehler.push(`dateien/${h}/${n}: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`); }
      }
    }));
  }
  // 4. Bilder (05.10.): Fotos zu Gerichten und Bauplan-Bildschirmfotos — je Bild in dessen Warteschlange.
  const { bilderUmschluesseln } = await import('./bild-ablage');
  const b = await bilderUmschluesseln();
  r.bilder = { neu: b.neu, schon: b.schon };
  r.fehler.push(...b.fehler);
  return r;
}
