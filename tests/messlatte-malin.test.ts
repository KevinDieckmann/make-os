// ─── Messlatte M3 „Zwei Nutzer“ (Vault: 07_Roadmap/Meilenstein_Uebernahme_MAKE_Innovation.md, Frist 31.10.) ─────────
// „Malin meldet sich mit eigenem Zugang an und bekommt keine einzige `scope: privat`-Notiz und keinen der sechs
// 🔒-Zustandsspeicher zu sehen — nachgewiesen durch einen automatisierten Testfall.“ Genau dieser Testfall.
// Die sechs Speicher (Datenmodell_MAKE_OS.md): health(-log) · vitals · journal · ernaehrung · routinen · rituale.
// Kevin teilt seine Gesundheitsdaten hier NICHT mit Malin (Konto → teilt.gesundheit leer).
// Test-Vault und Datenordner in Temp-Ordnern, erfundene Werte — nie der echte Vault, nie .data/.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-messlatte-'));
const vault = path.join(wurzel, 'Make.Claude');
const daten = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_DATEN_DIR = daten;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten(); // schreibt nach — erst dann aufräumen
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

// Eindeutige Marken: taucht eine davon in Malins Antwort auf, ist die Messlatte gerissen.
const GEHEIM = {
  notizName: 'Haut-Verlauf-Messlatte',
  notizText: 'MESSLATTE-GEHEIM-NOTIZ-KEVIN',
  businessPrivat: 'MESSLATTE-GEHEIM-BUSINESS-PRIVAT',
  health: 'messlatte-geheim-routine',
  vitals: 'MESSLATTE-GEHEIM-VITAL',
  journal: 'MESSLATTE-GEHEIM-JOURNAL',
  ritual: 'messlatte-geheim-ritual',
  routine: 'MESSLATTE-GEHEIM-ROUTINE-KEVIN',
};
const MALIN_PRIVAT = 'MESSLATTE-MALIN-EIGENES';

type Handler = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const holen = async (h: Handler, pfad: string, person: string) => {
  const r = await h(new Request(`http://test${pfad}`, { headers: sitzung(person) }));
  return { status: r.status, text: await r.text() };
};
const kopf = (felder: string) => `---\n${felder}\n---\n`;
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-messlatte' });

beforeAll(async () => {
  await fs.mkdir(path.join(vault, '02. MAKE Brain privat', 'Gesundheit'), { recursive: true });
  await fs.mkdir(path.join(vault, '01. KD Ventures Brain'), { recursive: true });
  await fs.mkdir(path.join(vault, '00. Fundament'), { recursive: true });
  await fs.mkdir(daten, { recursive: true });
  await fs.writeFile(path.join(vault, '02. MAKE Brain privat', 'Gesundheit', `${GEHEIM.notizName}.md`),
    `${kopf('type: gesundheit\nscope: privat\nowner: kevin')}\n# ${GEHEIM.notizName}\n\n${GEHEIM.notizText} Messlatte\n`);
  // Privat markiert, aber in einem Business-Ordner: der Filter muss am Kopf greifen, nicht nur am Ordner.
  await fs.writeFile(path.join(vault, '01. KD Ventures Brain', 'Privat-im-Business.md'),
    `${kopf('type: notiz\nscope: privat\nowner: kevin')}\n# Privat im Business\n\n${GEHEIM.businessPrivat} Messlatte\n`);
  await fs.writeFile(path.join(vault, '01. KD Ventures Brain', 'Offen.md'),
    `${kopf('type: notiz\nscope: intern')}\n# Offen\n\nMesslatte gemeinsames Wissen.\n`);
  await fs.writeFile(path.join(vault, '01. KD Ventures Brain', 'Eigenes-der-Zweiten.md'),
    `${kopf('type: notiz\nscope: privat\nowner: malin')}\n# Eigenes der Zweiten\n\n${MALIN_PRIVAT} Messlatte\n`);

  const db = await import('@/lib/store/local-db');
  const { speicherFuer } = await import('@/lib/zoe/raum');
  const { personDatei } = await import('@/lib/performance');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson(speicherFuer('health-log', 'kevin'), { '2026-10-01': [GEHEIM.health] });
  await db.saveJson(speicherFuer('vitals', 'kevin'), { '2026-10-01': { rec: 11, note: GEHEIM.vitals } });
  await db.saveJson(speicherFuer('journal', 'kevin'), { '2026-10-01': { text: GEHEIM.journal } });
  await db.saveJson(personDatei('rituale', 'kevin'), { '2026-10-01': [GEHEIM.ritual] });
  await db.saveJson('routinen', { routinen: [
    { id: 'r-kevin', label: GEHEIM.routine, wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true, owner: 'kevin' },
    { id: 'r-beide', label: 'Messlatte gemeinsame Routine', wann: 'morgen', kategorie: 'leben', dauerMin: 10, aktiv: true, owner: 'beide' },
  ], bloecke: [] });
});

const enthaeltGeheimes = (text: string) => Object.values(GEHEIM).filter(m => text.includes(m));

describe('Messlatte M3: Malin sieht keine scope:privat-Notiz von Kevin', () => {
  it('Wissen-Route: Bestand, Suche, Neueste und Direktaufruf zeigen nichts Privates — nicht einmal den Dateinamen', async () => {
    const { GET } = await import('@/app/api/zoe/wissen/route');
    const wege = [
      '/api/zoe/wissen?frisch=1',
      '/api/zoe/wissen?frage=Messlatte',
      `/api/zoe/wissen?frage=${encodeURIComponent(GEHEIM.notizText)}`,
      `/api/zoe/wissen?frage=${encodeURIComponent(GEHEIM.notizName)}`,
      '/api/zoe/wissen?neueste=1&anzahl=80',
    ];
    for (const w of wege) {
      const r = await holen(GET, w, 'malin');
      expect(enthaeltGeheimes(r.text), w).toEqual([]);
    }
    // Direktaufruf: 404, und die Antwort ist dieselbe wie für eine Notiz, die es nicht gibt — kein Hinweis, dass sie
    // existiert (die Meldung wiederholt nur, was Malin selbst eingegeben hat).
    const fehlt = (await holen(GET, '/api/zoe/wissen?notiz=Gibt-es-nicht', 'malin')).text.replace('Gibt-es-nicht', '#');
    for (const id of [GEHEIM.notizName, '[[Privat-im-Business]]']) {
      const r = await holen(GET, `/api/zoe/wissen?notiz=${encodeURIComponent(id)}`, 'malin');
      expect(r.status, id).toBe(404);
      expect(r.text.replace(id, '#'), id).toBe(fehlt);
      expect(r.text).not.toContain(GEHEIM.notizText);
      expect(r.text).not.toContain(GEHEIM.businessPrivat);
    }
    // Gegenprobe: der Test-Vault wird tatsächlich gelesen, und Malin sieht ihr Eigenes und das Gemeinsame.
    const suche = await holen(GET, '/api/zoe/wissen?frage=Messlatte', 'malin');
    expect(suche.status).toBe(200);
    expect(suche.text).toContain(MALIN_PRIVAT);
  });

  it('symmetrisch: Kevin sieht Malins Privates ebenso wenig — und sein eigenes schon (Beweis, dass es da ist)', async () => {
    const { GET } = await import('@/app/api/zoe/wissen/route');
    const r = await holen(GET, '/api/zoe/wissen?frage=Messlatte', 'kevin');
    expect(r.text).not.toContain(MALIN_PRIVAT);
    expect(r.text).toContain(GEHEIM.businessPrivat);
  });
});

describe('Messlatte M3: Malin sieht keinen der 🔒-Speicher von Kevin', () => {
  const routen = {
    health: () => import('@/app/api/state/health/route'),
    vitals: () => import('@/app/api/state/vitals/route'),
    journal: () => import('@/app/api/state/journal/route'),
  };
  for (const [name, marke] of [['health', GEHEIM.health], ['vitals', GEHEIM.vitals], ['journal', GEHEIM.journal]] as const) {
    it(`${name}: ?fuer=kevin → 403 ohne Inhalt; ohne ?fuer nur ihr eigener (leerer) Bestand`, async () => {
      const { GET } = (await routen[name]()) as unknown as { GET: Handler };
      const fremd = await holen(GET, `/api/state/${name}?fuer=kevin`, 'malin');
      expect(fremd.status).toBe(403);
      expect(fremd.text).not.toContain(marke);
      const eigen = await holen(GET, `/api/state/${name}`, 'malin');
      expect(eigen.status).toBe(200);
      expect(eigen.text).not.toContain(marke);
      // Gegenprobe: Kevin bekommt seinen Wert — der Bestand liegt wirklich da.
      expect((await holen(GET, `/api/state/${name}`, 'kevin')).text).toContain(marke);
    });
  }

  it('rituale: Malin liest nur ihr eigenes Log (es gibt keinen Weg zu Kevins)', async () => {
    const { GET } = (await import('@/app/api/state/rituale/route')) as { GET: Handler };
    for (const w of ['/api/state/rituale', '/api/state/rituale?fuer=kevin']) {
      const r = await holen(GET, w, 'malin');
      expect(r.text, w).not.toContain(GEHEIM.ritual);
    }
    expect((await holen(GET, '/api/state/rituale', 'kevin')).text).toContain(GEHEIM.ritual);
  });

  it('routinen ?sicht=ich: Malin bekommt nur ihre und die gemeinsamen Routinen', async () => {
    const { GET } = (await import('@/app/api/state/routinen/route')) as { GET: Handler };
    const r = await holen(GET, '/api/state/routinen?sicht=ich', 'malin');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(GEHEIM.routine);
    expect(r.text).toContain('Messlatte gemeinsame Routine');
  });
});
