// ─── Instanz-Export bei Vertragsende (05.10., Paket „Betroffenenrechte v2“; AVV § 11 Rückgabe) ─────────────────────────────
// Der Inhaber bekommt ALLES, was die Instanz hält, entschlüsselt in EINER JSON-Datei: jeden Bestand (`<daten>/*.json` über loadJson —
// also entschlüsselt mit dem Schlüsselring), die Dateiablage (`<daten>/dateien/<haushalt>/<id>.bin`, Base64) und die Bilder-Ordner
// (`BILD_ORDNER`, Base64). Geschrieben wird als Strom, Bestand für Bestand — der Server (1,9 GB) hält nie alles auf einmal.
// Nicht enthalten (mit Grund im Kopf der Datei): Tagessicherungen (`backup/`), Archiv-Kopien (`archiv/`), Grabsteine (nur Fingerabdrücke,
// liegen außerhalb), Schlüssel/Pepper (nie in einer Datei). Der Weg dorthin: nur Inhaber-Sitzung + Passwort/zweiter Faktor
// (app/api/datenschutz/instanz-export), Lese-Protokoll + Anmeldeprotokoll. Löschen danach: scripts/instanz-loeschen.mjs (nie automatisch).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, loadJson } from '@/lib/store/local-db';
import { inhaltLaden } from '@/lib/dateien/ablage';
import { BILD_ORDNER, bildOeffnen, type BildOrdner } from '@/lib/store/bild-ablage';

export const INSTANZ_EXPORT_HINWEIS = 'Vollständiger Export dieser MAKE-OS-Instanz (entschlüsselt). Enthält Personendaten — nur verschlüsselt aufbewahren bzw. übergeben und nach der Übergabe löschen.';
export const NICHT_IM_EXPORT = [
  { was: 'backup/ (Tagessicherungen je Bestand)', grund: 'Kopien derselben Bestände von den letzten 14 Tagen' },
  { was: 'archiv/ (Umzugs- und Aufräum-Kopien)', grund: 'Kopien älterer Stände; laufen nach ihrer Frist ab' },
  { was: 'Grabsteine', grund: 'nur Fingerabdrücke gelöschter Personen/Konten, außerhalb des Datenordners' },
  { was: 'Datenschlüssel, Pepper, Sitzungsgeheimnis', grund: 'nie in einer Datei — liegen beim Betreiber (Passwort-Manager)' },
];

const NAME = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

async function bestandsNamen(): Promise<string[]> {
  return (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(n => NAME.test(n)).sort();
}

/** Was im Export stehen wird (für die Oberfläche und das Protokoll) — nur Zahlen. */
export async function instanzUmfang(): Promise<{ bestaende: number; dateien: number; bilder: number }> {
  const bestaende = (await bestandsNamen()).length;
  let dateien = 0, bilder = 0;
  const d = path.join(datenOrdner(), 'dateien');
  for (const h of await fs.readdir(d).catch(() => [] as string[])) dateien += (await fs.readdir(path.join(d, h)).catch(() => [] as string[])).filter(n => n.endsWith('.bin')).length;
  for (const o of BILD_ORDNER) bilder += (await fs.readdir(path.join(datenOrdner(), o)).catch(() => [] as string[])).length;
  return { bestaende, dateien, bilder };
}

/**
 * Der Export als Folge von Textstücken (gültiges JSON zusammengesetzt). Ein nicht lesbarer Bestand bricht nicht ab — er steht unter
 * `fehler` (Name + Grund), damit der Inhaber weiß, was fehlt.
 */
export async function* instanzExportTeile(kopf: Record<string, unknown>): AsyncGenerator<string> {
  const fehler: { was: string; grund: string }[] = [];
  yield `{"kopf":${JSON.stringify({ ...kopf, hinweis: INSTANZ_EXPORT_HINWEIS, nichtEnthalten: NICHT_IM_EXPORT })},"bestaende":{`;
  let erst = true;
  for (const n of await bestandsNamen()) {
    let inhalt: unknown;
    try { inhalt = await loadJson<unknown>(n); } catch (e) { fehler.push({ was: n, grund: e instanceof Error ? e.message.slice(0, 160) : 'nicht lesbar' }); continue; }
    yield `${erst ? '' : ','}${JSON.stringify(n)}:${JSON.stringify(inhalt)}`;
    erst = false;
  }
  yield '},"dateien":{';
  erst = true;
  const d = path.join(datenOrdner(), 'dateien');
  for (const h of (await fs.readdir(d).catch(() => [] as string[])).sort()) {
    for (const f of (await fs.readdir(path.join(d, h)).catch(() => [] as string[])).filter(x => x.endsWith('.bin')).sort()) {
      const id = f.slice(0, -4);
      try {
        const b = await inhaltLaden(h, id);
        if (!b) continue;
        yield `${erst ? '' : ','}${JSON.stringify(`${h}/${id}`)}:${JSON.stringify(b.toString('base64'))}`;
        erst = false;
      } catch (e) { fehler.push({ was: `dateien/${h}/${id}`, grund: e instanceof Error ? e.message.slice(0, 160) : 'nicht lesbar' }); }
    }
  }
  yield '},"bilder":{';
  erst = true;
  for (const o of BILD_ORDNER as readonly BildOrdner[]) {
    for (const f of (await fs.readdir(path.join(datenOrdner(), o)).catch(() => [] as string[])).sort()) {
      try {
        const b = await bildOeffnen(o, f);
        if (!b) continue;
        yield `${erst ? '' : ','}${JSON.stringify(`${o}/${f}`)}:${JSON.stringify(b.toString('base64'))}`;
        erst = false;
      } catch (e) { fehler.push({ was: `${o}/${f}`, grund: e instanceof Error ? e.message.slice(0, 160) : 'nicht lesbar' }); }
    }
  }
  yield `},"fehler":${JSON.stringify(fehler)}}`;
}

/** Als Web-Strom für die Route. */
export function instanzExportStrom(kopf: Record<string, unknown>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const it = instanzExportTeile(kopf);
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const n = await it.next();
        if (n.done) c.close(); else c.enqueue(enc.encode(n.value));
      } catch (e) { c.error(e); }
    },
    async cancel() { await it.return(undefined); },
  });
}
