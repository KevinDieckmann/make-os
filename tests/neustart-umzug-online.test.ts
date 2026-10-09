/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen beliebige Bestände als JSON */
// ─── Neustart-Umzug mit Daten im Format des Online-Stands (09.10.2026, Prüfung vor dem Abend) ────────────────────────────────
// Die Generalprobe hat den Umzug nur mit Daten getestet, die der NEUE Code geschrieben hat. Hier: Aufgaben-Bestand und Aufgaben-
// Ablage so, wie origin/main (1de19d8c) sie schreibt (tests/fixtures/neustart-online-0910.ts), Format „kompatibel“ (v1-Hüllen,
// „MKOSDAT1“) wie auf dem Server, ohne Pepper. Fund: Dateien „am Meilenstein“ (Meilenstein › Dateien: `listeId`, keine Aufgabe) an
// einem Meilenstein ohne Aufgaben blieben still im Archiv, weil seine Liste als „leer“ wegfiel — jetzt zieht die Liste samt Datei
// nach „Übernommen“ (`dateiBezuege`). Eine wirklich leere Meilenstein-Liste fällt weiter weg.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { schluesselRing, huelleImModus, huelleOeffnen, huellenVersion } from '@/lib/store/huelle.mjs';
import { binImModus, binOeffnen, binVersion } from '@/lib/store/datei-huelle.mjs';
import { umzugLaufen } from '@/lib/neustart/umzug-lauf.mjs';
import * as K from '@/lib/neustart/umzug.mjs';
import { ONLINE_TASKS, ONLINE_AUFGABEN_DATEIEN, ONLINE_DATEI_INHALT } from './fixtures/neustart-online-0910';

const H = 'demo';
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'make-os-neustart-online-'));
const alt = path.join(wurzel, 'daten'), neu = path.join(wurzel, 'daten-neu');
// Wie der Server heute: Datenschlüssel, KEIN Pepper, Format kompatibel (ohne MAKE_OS_FORMAT).
const ENV = { MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-online-0910-nicht-echt', MAKE_OS_GRABSTEINE_DIR: path.join(wurzel, 'grabsteine') } as unknown as NodeJS.ProcessEnv;
const ring = schluesselRing(ENV);
const SCHLUESSEL = ring.aktiv!;

async function schreibe(name: string, wert: unknown) {
  await fs.writeFile(path.join(alt, `${name}.json`), huelleImModus(JSON.stringify(wert), SCHLUESSEL, name, ENV));
}
async function lies<T = any>(ordner: string, name: string): Promise<T> {
  const o = JSON.parse(await fs.readFile(path.join(ordner, `${name}.json`), 'utf8'));
  return JSON.parse(huellenVersion(o) ? huelleOeffnen(o, ring, name).text : JSON.stringify(o));
}

let bericht: Awaited<ReturnType<typeof umzugLaufen>>;
let nr = 0;
const kennung = (p: string) => `${p}-00000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`;

beforeAll(async () => {
  await fs.mkdir(path.join(alt, 'dateien', H), { recursive: true });
  await schreibe('tasks', ONLINE_TASKS);
  await schreibe(`aufgaben-dateien--${H}`, ONLINE_AUFGABEN_DATEIEN);
  for (const [id, inhalt] of Object.entries(ONLINE_DATEI_INHALT)) {
    await fs.writeFile(path.join(alt, 'dateien', H, `${id}.bin`), binImModus(Buffer.from(inhalt), SCHLUESSEL, H, id, ENV));
  }
  bericht = await umzugLaufen({ von: alt, nach: neu, ausfuehren: true, env: ENV, kennung, jetzt: new Date('2026-10-09T18:00:00Z') });
}, 60_000);
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true }); });

describe('Neustart-Umzug · Online-Format (origin/main) · Format kompatibel, ohne Pepper', () => {
  it('dateiBezuege: nur Einträge ohne Aufgabe — Liste vor Projekt', () => {
    const b = K.dateiBezuege(ONLINE_AUFGABEN_DATEIEN.eintraege);
    expect([...b.dateiListen].sort()).toEqual(['lm-ms-demo-cockpit-m6hvxf', 'lm-ms-demo-rollout-tsbb93']);
    expect([...b.dateiProjekte]).toEqual(['pm-kdv']);
    expect(K.dateiBezuege(undefined)).toEqual({ dateiListen: new Set(), dateiProjekte: new Set() });
  });

  it('jede Datei kommt mit — auch die am Meilenstein ohne Aufgaben; Liste und Projekt zeigen auf „Übernommen“', async () => {
    const st = await lies(neu, 'tasks');
    const ad = await lies(neu, `aufgaben-dateien--${H}`);
    expect(ad.eintraege.map((e: { id: string }) => e.id).sort()).toEqual(Object.keys(ONLINE_DATEI_INHALT).sort());
    const uebKdv = st.projects.find((p: any) => p.title === K.UEBERNOMMEN_TITEL && p.spaceId === 'kdv');
    const uebLumen = st.projects.find((p: any) => p.title === K.UEBERNOMMEN_TITEL && p.spaceId === 'm-f-demo-lumen');
    expect(uebKdv && uebLumen).toBeTruthy();
    expect(st.projects.map((p: any) => p.id)).not.toContain('pm-kdv');
    const listeVon = (titel: string) => st.listen.find((l: any) => l.titel === titel);
    const rollout = listeVon('Rollout bei Lumen (5 Standorte)');
    expect(rollout).toMatchObject({ projektId: uebLumen.id });
    expect(rollout.id).toMatch(/^l-/);
    const e = (id: string) => ad.eintraege.find((x: any) => x.id === id);
    expect(e('d-1f7ed76d-9d53-44e6-b0db-7e376c129e0c')).toMatchObject({ projektId: uebLumen.id, listeId: rollout.id });
    expect(e('d-b1287ce6-a47f-418f-b739-c2c7b1d3588d')).toMatchObject({ projektId: uebKdv.id, listeId: listeVon('Cockpit 2.0 Beta fertig').id });
    expect(e('d-08ee5817-2f30-40cf-aba4-a64a02f56495')).toMatchObject({ projektId: uebKdv.id, aufgabeId: 'mtg-20261009162337-89bc7da7' });
    expect(e('d-5a5a5a5a-1111-4222-8333-444444444444')).toMatchObject({ projektId: uebKdv.id });
    // Eine wirklich leere Meilenstein-Liste (keine Aufgabe, keine Datei) fällt weiter weg.
    expect(listeVon('Meilenstein ohne Aufgaben und Dateien')).toBeUndefined();
    expect(bericht.aufgaben).toMatchObject({ umgehaengt: { listen: 3, aufgaben: 4, nurDateien: 1 }, nicht: { meilensteinListenLeer: 1 } });
    expect(bericht.dateien).toMatchObject({ aufgaben: { mitDatei: 4, fehlen: 0, groesseAbweichend: 0 }, nichtUebernommen: 0, ohneEintrag: 0 });
  });

  it('Unteraufgaben bleiben unter ihrer Aufgabe, in derselben (neuen) Liste', async () => {
    const st = await lies(neu, 'tasks');
    const t = new Map(st.tasks.map((x: any) => [x.id, x])) as Map<string, any>;
    const pipeline = st.listen.find((l: any) => l.titel === 'Pipeline: 10 qualifizierte Gespräche');
    for (const id of ['mtg-20261009162337-89bc7da7', 'mtg-20261009162558-4b3b7591', 'mtg-20261009162558-45525f23']) expect(t.get(id)).toMatchObject({ listeId: pipeline.id, projectId: pipeline.projektId });
    expect(t.get('mtg-20261009162558-45525f23').parentId).toBe('mtg-20261009162558-4b3b7591');
  });

  it('geschrieben im Modus des Servers: v1-Hüllen und „MKOSDAT1“ — Inhalt Byte für Byte gleich; kein toter Verweis', async () => {
    const roh = JSON.parse(await fs.readFile(path.join(neu, 'tasks.json'), 'utf8'));
    expect(huellenVersion(roh)).toBe(1);
    for (const [id, inhalt] of Object.entries(ONLINE_DATEI_INHALT)) {
      const b = await fs.readFile(path.join(neu, 'dateien', H, `${id}.bin`));
      expect(binVersion(b)).toBe(1);
      expect(binOeffnen(b, ring, H, id).klar.toString()).toBe(inhalt);
    }
    const { alt: a, neu: n } = bericht.verweise!;
    for (const k of Object.keys(n) as (keyof typeof n)[]) expect(n[k], k).toBeLessThanOrEqual(a[k]);
    expect(bericht.pepper).toBe('fehlt');
    expect(bericht.format).toBe('kompatibel');
  });
});
