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

// ─── 08.10. (Kevin): Routinen der anderen Person nur „Belegt“, Ernährungsprofile nur selbst (oder geteilt) ─────────────
type Handler3 = { GET: Handler; PATCH: Handler; PUT: Handler };
const schreiben = (h: Handler, methode: string, pfad: string, person: string, body: unknown) =>
  h(new Request(`http://test${pfad}`, { method: methode, headers: sitzung(person), body: JSON.stringify(body) }));
const bestandText = async (name: string) => JSON.stringify(await (await import('@/lib/store/local-db')).loadJson(name));

describe('Messlatte Malin-Sicht 08.10.: Routinen-Planer zeigt Kevins Routine nur als „Belegt“', () => {
  it('GET ohne ?sicht: Kevins eigene Routine nur verdeckt (kein Titel, keine Kategorie), gemeinsame voll', async () => {
    const { GET } = (await import('@/app/api/state/routinen/route')) as unknown as Handler3;
    const r = await holen(GET, '/api/state/routinen', 'malin');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(GEHEIM.routine);
    const d = JSON.parse(r.text) as { routinen: { id: string; label: string; kategorie: string; belegt?: boolean }[] };
    const fremd = d.routinen.find(x => x.id === 'r-kevin')!;
    expect(fremd).toMatchObject({ label: 'Belegt', belegt: true, owner: 'kevin', wann: 'morgen', dauerMin: 10 });
    expect(fremd.kategorie).not.toBe('gesundheit');
    expect(d.routinen.find(x => x.id === 'r-beide')!.label).toBe('Messlatte gemeinsame Routine');
    // Gegenprobe: Kevin sieht seine Routine voll.
    expect((await holen(GET, '/api/state/routinen', 'kevin')).text).toContain(GEHEIM.routine);
  });

  it('Schreiben auf Kevins Routine → 403, der Bestand bleibt bit-gleich (PATCH teil/upsert/delete, neu für Kevin, zuschieben, PUT geändert)', async () => {
    const { PATCH, PUT } = (await import('@/app/api/state/routinen/route')) as unknown as Handler3;
    const vorher = await bestandText('routinen');
    const routine = (id: string, label: string, owner: string) => ({ id, label, wann: 'morgen', kategorie: 'leben', dauerMin: 10, aktiv: true, owner });
    const versuche: [Handler, string, unknown][] = [
      [PATCH, 'PATCH', { ops: [{ op: 'teil', id: 'r-kevin', felder: { label: 'Überschrieben' } }] }],
      [PATCH, 'PATCH', { ops: [{ op: 'upsert', eintrag: routine('r-kevin', 'Belegt', 'kevin') }] }],
      [PATCH, 'PATCH', { ops: [{ op: 'delete', id: 'r-kevin' }] }],
      [PATCH, 'PATCH', { ops: [{ op: 'upsert', eintrag: routine('r-neu-fuer-kevin', 'Für Kevin', 'kevin') }] }],
      [PATCH, 'PATCH', { ops: [{ op: 'teil', id: 'r-beide', felder: { owner: 'kevin' } }] }],
      [PUT, 'PUT', { routinen: [routine('r-kevin', 'Überschrieben', 'kevin'), routine('r-beide', 'Messlatte gemeinsame Routine', 'beide')] }],
    ];
    for (const [h, m, body] of versuche) {
      const r = await schreiben(h, m, '/api/state/routinen', 'malin', body);
      expect(r.status, JSON.stringify(body)).toBe(403);
      expect(await r.text()).not.toContain(GEHEIM.routine);
      expect(await bestandText('routinen')).toBe(vorher);
    }
  });

  it('PUT mit dem verdeckten Stand überschreibt nie die echten Werte (Altweg)', async () => {
    const { GET, PUT } = (await import('@/app/api/state/routinen/route')) as unknown as Handler3;
    const sicht = JSON.parse((await holen(GET, '/api/state/routinen', 'malin')).text) as { routinen: Record<string, unknown>[] };
    const ohneStand = (l: Record<string, unknown>[]) => l.map(x => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'stand')));
    const r = await schreiben(PUT, 'PUT', '/api/state/routinen', 'malin', { routinen: ohneStand(sicht.routinen) });
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain(GEHEIM.routine);
    expect(await bestandText('routinen')).toContain(GEHEIM.routine);
    // Lässt der Browser sie ganz weg, bleibt sie trotzdem stehen.
    const ohne = await schreiben(PUT, 'PUT', '/api/state/routinen', 'malin', { routinen: ohneStand(sicht.routinen.filter(x => x.id !== 'r-kevin')) });
    expect(ohne.status).toBe(200);
    expect(await bestandText('routinen')).toContain(GEHEIM.routine);
  });
});

describe('Messlatte Malin-Sicht 08.10.: Ernährungsprofil sieht nur die Person selbst (oder wem sie Gesundheit teilt)', () => {
  const PROFIL = 'MESSLATTE-GEHEIM-PROFIL-KEVIN';
  const pfad = '/api/state/ernaehrung';
  const profil = (person: string, name: string, bedarf: string, konto: boolean) => ({ person, name, bedarf, unvertraeglich: [], nie: [], gern: [], ziel: konto ? bedarf : '', konto, stand: '2026-10-01' });

  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('ernaehrung', {
      grundsaetze: 'Messlatte Grundsätze', plan: {}, planGerichte: {},
      einkauf: [{ id: 'e-1', text: 'Messlatte Hafer', erledigt: false }],
      profile: [profil('kevin', 'Kevin', PROFIL, true), profil('gast-oma', 'Oma', 'Messlatte Gast weich', false)],
      lebensmittel: [], vorrat: [], gerichte: [],
    });
  });

  it('GET: Malin sieht Kevins Profil nicht, Gast und Einkauf schon; Kevin sieht sein eigenes', async () => {
    const { GET } = (await import('@/app/api/state/ernaehrung/route')) as unknown as Handler3;
    const r = await holen(GET, pfad, 'malin');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(PROFIL);
    expect(r.text).toContain('Messlatte Gast weich');
    expect(r.text).toContain('Messlatte Hafer');
    expect((await holen(GET, pfad, 'kevin')).text).toContain(PROFIL);
  });

  it('teilt Kevin Gesundheit mit Malin, sieht sie sein Profil — danach wieder nicht', async () => {
    const db = await import('@/lib/store/local-db');
    const { GET } = (await import('@/app/api/state/ernaehrung/route')) as unknown as Handler3;
    await db.saveJson('konten', { konten: [{ ...konto('k1', 'kevin', 'inhaber'), teilt: { gesundheit: ['malin'] } }, konto('k2', 'malin', 'mitglied')], einladungen: [] });
    try {
      expect((await holen(GET, pfad, 'malin')).text).toContain(PROFIL);
    } finally {
      await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    }
    expect((await holen(GET, pfad, 'malin')).text).not.toContain(PROFIL);
  });

  it('Schreiben auf Kevins Profil → 403, Bestand unverändert; PUT (Altweg) und PATCH-Antworten lassen es weg, löschen es nie', async () => {
    const { PATCH, PUT } = (await import('@/app/api/state/ernaehrung/route')) as unknown as Handler3;
    const vorher = await bestandText('ernaehrung');
    for (const ops of [
      [{ liste: 'profile', op: 'upsert', eintrag: { person: 'kevin', name: 'Kevin', bedarf: 'überschrieben' } }],
      [{ liste: 'profile', op: 'delete', id: 'kevin' }],
      [{ liste: 'profile', op: 'upsert', eintrag: { person: 'kevin', name: 'Kevin', konto: false, bedarf: 'als Gast gekapert' } }],
      [{ liste: 'einkauf', op: 'upsert', eintrag: { text: 'Messlatte mit drin' } }, { liste: 'profile', op: 'delete', id: 'kevin' }],
    ]) {
      const r = await schreiben(PATCH, 'PATCH', pfad, 'malin', { ops });
      expect(r.status, JSON.stringify(ops)).toBe(403);
      expect(await bestandText('ernaehrung')).toBe(vorher);
    }
    // Eigener Schritt: erlaubt, die Antwort ohne Kevins Profil.
    const gut = await schreiben(PATCH, 'PATCH', pfad, 'malin', { ops: [{ liste: 'einkauf', op: 'upsert', eintrag: { text: 'Messlatte Äpfel' } }] });
    expect(gut.status).toBe(200);
    expect(await gut.text()).not.toContain(PROFIL);
    const put = await schreiben(PUT, 'PUT', pfad, 'malin', { profile: [], einkauf: [{ id: 'e-1', text: 'Messlatte Hafer', erledigt: true }] });
    expect(put.status).toBe(200);
    expect(await put.text()).not.toContain(PROFIL);
    expect(await bestandText('ernaehrung')).toContain(PROFIL);
  });
});

// ─── 08.10. „Sicht-Prüfung Malin“ (Kevin: „noch tiefer ausbauen“) — systematisch über das Routen-Register ─────────────
// Jede lesende Schnittstelle, die Personendaten tragen kann (alle GET außer `offen`/`dienst`), wird mit Malins Sitzung
// aufgerufen — einmal ohne Parameter, einmal mit allen Personen-Parametern auf Kevin (`fuer`, `person`, `wer`, `owner`,
// `von`, `auskunft`) und einmal mit den Sicht-Schaltern (`sicht`, `space`, `papierkorb`, `archiv`, `alle`). Keine Antwort
// (gleich welcher Status) darf eine der Marken aus Kevins privaten Beständen enthalten. Gegenprobe: dieselben Marken
// kommen bei Kevin an — die Saat ist also wirklich lesbar. Netz ist gesperrt (fetch wirft), Modelle sind aus.
const SYS = {
  termin: 'MESSLATTE-SYS-TERMIN-PRIVAT',
  terminOrt: 'MESSLATTE-SYS-TERMIN-ORT',
  aufgabe: 'MESSLATTE-SYS-AUFGABE-NURICH',
  unteraufgabe: 'MESSLATTE-SYS-UNTERAUFGABE-NURICH',
  ziel: 'MESSLATTE-SYS-ZIEL-EIGEN',
  zeit: 'MESSLATTE-SYS-FOKUS-PRIVAT',
  laufend: 'MESSLATTE-SYS-FOKUS-LAUFEND',
  thema: 'MESSLATTE-SYS-FAMILIE-NURICH',
  reflexion: 'MESSLATTE-SYS-FAMILIE-REFLEXION',
  meldung: 'MESSLATTE-SYS-MELDUNG',
  verlauf: 'MESSLATTE-SYS-ZOE-VERLAUF',
  stapel: 'MESSLATTE-SYS-ZOE-STAPEL',
  protokoll: 'MESSLATTE-SYS-ZOE-PROTOKOLL',
  kapa: 'MESSLATTE-SYS-KAPA-URLAUB',
  karte: 'MESSLATTE-SYS-VISITENKARTE',
  mail: 'MESSLATTE-SYS-MAIL-BETREFF',
  postfach: 'MESSLATTE-SYS-POSTFACH-NAME',
  haut: 'MESSLATTE-SYS-HAUT',
  // Körper-Profil (08.10. abends, Fragebogen Teil 3): nur die Person selbst — auch geteilt nie für andere.
  koerper: 'MESSLATTE-SYS-KOERPER',
  // Onboarding (08.10. spät): persönliche Häkchen je Person — die Marke steckt im Zeitstempel (nur der wird ausgeliefert).
  onboarding: '2001-02-03T04:05:06.789Z',
  // Datenschutz vor dem Upload (08.10. spät): Tageslauf je Person (Ausrichtung mit Gesundheitskontext), persönliche Kennungen der Stammdaten.
  tageslauf: 'MESSLATTE-SYS-TAGESLAUF',
  steuerId: 'MESSLATTE-SYS-STEUERID',
  // Business-frei (08.10., Lücke 7): die eigene Ergänzung des Arbeitsrahmens je Person — die Marke steckt im Zeitstempel.
  arbeitsrahmen: '2001-02-03T04:05:10.123Z',

  // Inbox teilen (08.10., Lücke 6): eine Übergabe von Kevin an eine DRITTE Person des Haushalts — Malin ist nicht beteiligt.
  uebergabe: 'MESSLATTE-SYS-UEBERGABE-NOTIZ',

  // ZOE auf WhatsApp (08.10.): der Kanal je Person — die Marke steckt im Zeitpunkt „verbunden seit“ (nur der geht maskiert-frei hinaus).
  zoeKanal: '2002-03-04T05:06:07.891Z',

  // Agenten-Bereich Paket 1 (09.10.): Threads je Person (`agenten-faeden--<person>`) — ein Business- und ein Privat-Thread von Kevin
  // (nicht geteilt); die zweite Person sieht keinen davon.
  agentenFaden: 'MESSLATTE-SYS-AGENTEN-FADEN',

  // Medien unterwegs (09.10., Paket 5): ein privates Medium „nur ich“ von Kevin samt Album „nur ich“ — Malin sieht nicht einmal das Album.
  medium: 'MESSLATTE-SYS-MEDIUM-NURICH',
  medienAlbum: 'MESSLATTE-SYS-MEDIEN-ALBUM',

  // Agenten-Bereich (09.10., Paket 3): Werkstatt der Privat-Heads und geplante Hintergrundaufgaben je Person — nur die Person selbst.
  agentenSkill: 'MESSLATTE-SYS-AGENTEN-SKILL',
  agentenPlan: 'MESSLATTE-SYS-AGENTEN-PLAN',

  // Agenten-Bereich Paket 4b (09.10.): der Abschnitt der Privat-Heads einer Person in `agenten-einstellung--<haushalt>` — nur sie selbst.
  agentenEinstellung: 'MESSLATTE-SYS-AGENTEN-EINSTELLUNG',
};
const ALLE_MARKEN: Record<string, string> = { ...GEHEIM, ...SYS };

/**
 * Bewusst erlaubt (Kevins frühere Entscheidungen) — die Marke darf in genau dieser Route auftauchen. Leer seit 08.10. (Phase 0):
 * eigene Ziele/Fokus (`ziele-eigen`) der anderen Person gibt es über `?fuer=` nur noch, wenn sie sie ausdrücklich teilt (Konto ›
 * `teilt.ziele`, Vorgabe „nicht geteilt“, lib/planung/eigene-ziele-sicht.ts) — in der Saat teilt Kevin nicht.
 */
const ERLAUBT: { route: string; marke: string; warum: string }[] = [];

/** Übersprungen (mit Grund). Alles andere wird aufgerufen. */
const UEBERSPRUNGEN: Record<string, string> = {
  'jarvis/[...pfad]': 'nur 308-Weiterleitung auf /api/zoe/* — die Ziele werden selbst geprüft',
};

const VARIANTEN = [
  '',
  '?fuer=kevin&person=kevin&wer=kevin&owner=kevin&von=kevin&auskunft=kevin',
  '?sicht=privat&space=privat&papierkorb=1&archiv=1&alle=1&fuer=kevin',
  // Suchwege (Wissen, Schnellsuche, CRM-Suche …) mit den Marken als Suchbegriff.
  '?frage=Messlatte&q=MESSLATTE&suche=MESSLATTE&text=MESSLATTE',
];
/** Zusätze je Route, damit sie überhaupt etwas liefert (Pflicht-Parameter). */
const ZUSATZ: Record<string, string> = {
  'state/flaeche': 'seite=heute',
  'aufgaben/zeit': 'ids=t-messlatte-geheim',
};
/** Werte für dynamische Segmente. */
const SEGMENTE: Record<string, string | string[]> = { head: 'sales', slug: 'messlatte-0123456789abcdef01234567', token: 'x', pfad: ['wissen'] };

type Ctx = { params: Promise<Record<string, string | string[]>> };
type GetHandler = (r: Request, ctx?: Ctx) => Promise<Response>;
const mitFrist = async <T,>(p: Promise<T>, ms: number): Promise<T | 'frist'> => {
  let t: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<'frist'>(res => { t = setTimeout(() => res('frist'), ms); })]); } finally { if (t) clearTimeout(t); }
};

async function rufeGet(pfad: string, query: string, person: string): Promise<{ status: number; text: string } | 'frist' | { fehler: string }> {
  try {
    const m = (await import(`@/app/api/${pfad}/route`)) as { GET?: GetHandler };
    if (!m.GET) return { fehler: 'kein GET' };
    const params: Record<string, string | string[]> = {};
    for (const [, name] of pfad.matchAll(/\[(?:\.\.\.)?([a-z]+)\]/g)) params[name] = SEGMENTE[name] ?? 'x';
    const zusatz = ZUSATZ[pfad];
    const q = zusatz ? (query ? `${query}&${zusatz}` : `?${zusatz}`) : query;
    const r = await mitFrist(m.GET(new Request(`http://test/api/${pfad}${q}`, { headers: sitzung(person) }), { params: Promise.resolve(params) }), 20_000);
    if (r === 'frist') return 'frist';
    const text = await mitFrist(r.text(), 10_000);
    if (text === 'frist') return 'frist';
    return { status: r.status, text };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

describe('Messlatte Sicht-Prüfung 08.10.: alle lesenden Routen mit Malins Sitzung (Register)', () => {
  const echtesFetch = globalThis.fetch;
  let routen: string[] = [];

  beforeAll(async () => {
    // Kein Netz: externe Dienste (iCloud, Google, Meta, Modell) und interne Hops scheitern sofort.
    globalThis.fetch = (async () => { throw new Error('Netz im Messlatte-Test gesperrt'); }) as typeof fetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ICLOUD_APPLE_ID;
    delete process.env.ICLOUD_APP_PASSWORT;
    const db = await import('@/lib/store/local-db');
    const { localDay, tagePlus } = await import('@/lib/zeit');
    const H = localDay();
    const J = new Date().toISOString();
    // Dritte Person des Haushalts (08.10., Inbox teilen): Empfängerin einer Übergabe, an der Malin nicht beteiligt ist.
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'dritte', 'mitglied')], einladungen: [] });

    // Kalender (Mac-Stand): ein privater Termin von Kevin — für Malin nur „Belegt“.
    await db.saveJson('calendar-cache', { at: J, quelle: 'mac', events: [
      { id: 'e-messlatte-privat', title: SYS.termin, location: SYS.terminOrt, startDate: `${H}T10:00:00`, endDate: `${H}T11:00:00`, allDay: false, calendarName: 'Privat Kevin' },
      { id: 'e-messlatte-offen', title: 'Messlatte offener Termin', startDate: `${H}T12:00:00`, endDate: `${H}T13:00:00`, allDay: false, calendarName: 'Privat Kevin' },
    ] });
    await db.saveJson('kalender-bezug', { bezuege: { 'e-messlatte-privat': { privat: true, von: 'kevin', geaendert: J, tag: H } } });

    // Aufgaben: „nur ich“ von Kevin samt Unteraufgabe, dazu eine gemeinsame.
    const T0 = '2026-10-01T08:00:00.000Z';
    const a = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-messlatte', title, status: 'todo', priority: 'high', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', dueDate: H, ...extra });
    await db.saveJson('tasks', {
      projects: [{ id: 'p-messlatte', title: 'Messlatte Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' }],
      listen: [], statusEigen: [], vorlagen: [],
      tasks: [
        a('t-messlatte-geheim', SYS.aufgabe, { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', description: SYS.aufgabe }),
        a('t-messlatte-geheim-u', SYS.unteraufgabe, { parentId: 't-messlatte-geheim' }),
        a('t-messlatte-offen', 'Messlatte gemeinsame Aufgabe'),
      ],
    });

    // Eigenes Ziel (ziele-eigen) von Kevin.
    const ziele = (await import('@/app/api/state/ziele/route')) as unknown as Handler3;
    const zr = await schreiben(ziele.PATCH, 'PATCH', '/api/state/ziele', 'kevin', { horizont: 'jahr', fuer: 'ich', ops: [{ op: 'upsert', eintrag: { id: 'z-messlatte-eigen', titel: SYS.ziel, fortschritt: 10, space: 'privat' } }] });
    expect(zr.status, await zr.clone().text()).toBe(200);

    // Zeit: ein privater Fokus-Block und ein laufender Fokus.
    const zeit = (await import('@/app/api/state/zeit/route')) as unknown as { POST: Handler };
    const von = new Date(Date.now() - 2 * 3_600_000), bis = new Date(Date.now() - 3_600_000);
    const zb = await schreiben(zeit.POST, 'POST', '/api/state/zeit', 'kevin', { aktion: 'fokus', von: von.toISOString(), bis: bis.toISOString(), schluessel: 'privat:fokus', label: SYS.zeit });
    expect(zb.status, await zb.clone().text()).toBe(200);
    const fokus = (await import('@/app/api/state/fokus/route')) as unknown as { POST: Handler };
    const fl = await schreiben(fokus.POST, 'POST', '/api/state/fokus', 'kevin', { laufend: { von: new Date(Date.now() - 600_000).toISOString(), schluessel: 'privat:fokus', label: SYS.laufend } });
    expect(fl.status, await fl.clone().text()).toBe(200);

    // Familie: ein „nur ich“-Thema und eine ungeteilte Reflexion.
    const familie = (await import('@/app/api/familie/route')) as unknown as { PATCH: Handler };
    const fa = await schreiben(familie.PATCH, 'PATCH', '/api/familie', 'kevin', { ops: [
      { liste: 'themen', op: 'upsert', eintrag: { id: 'ft-messlatte', titel: SYS.thema, art: 'unklar', status: 'offen', hut: 'privat', sichtbarkeit: 'nur-ich' } },
      { liste: 'reparaturen', op: 'upsert', eintrag: { id: 'fr-messlatte', datum: H, pauseBis: null, reflexionen: [{ person: 'kevin', gefuehle: SYS.reflexion, meineSicht: SYS.reflexion, meinAnteil: '', wunsch: '', geteilt: false }], abgeschlossen: null, vereinbarung: '' } },
    ] });
    expect(fa.status, await fa.clone().text()).toBe(200);

    // Glocke, ZOE-Verlauf, Stapel, Protokoll — alles Kevin.
    const { meldungAblegen } = await import('@/lib/meldungen/speicher');
    await meldungAblegen({ an: 'kevin', art: 'kommentar', titel: SYS.meldung, link: '/os', von: 'malin' } as Parameters<typeof meldungAblegen>[0]);
    await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g-messlatte', person: 'kevin', begonnen: J, zuletzt: J, titel: SYS.verlauf, nachrichten: [{ rolle: 'kevin', text: SYS.verlauf, zeit: J }] }] });
    const { lege } = await import('@/lib/zoe/stapel');
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: SYS.stapel, nachher: SYS.stapel, eingabe: { title: SYS.stapel }, anlass: SYS.stapel, person: 'kevin', quelle: 'gespraech' } as Parameters<typeof lege>[0]);
    const { notiere } = await import('@/lib/zoe/protokoll');
    await notiere({ werkzeug: 'create_task', gruppe: 'aufgaben', risiko: 'frei', eingabe: {}, ergebnis: SYS.protokoll, ok: true, quelle: 'zoe', person: 'kevin' } as Parameters<typeof notiere>[0]);

    // Kapazität: Urlaub mit Titel (der Titel gehört nur der Person selbst).
    const kapa = (await import('@/app/api/kapazitaet/route')) as unknown as { PATCH: Handler };
    const ka = await schreiben(kapa.PATCH, 'PATCH', '/api/kapazitaet', 'kevin', { ops: [
      { op: 'grundwert', person: 'konto-kevin', stundenWoche: 40 },
      { op: 'ausnahme', person: 'konto-kevin', ausnahme: { id: 'ka-messlatte', art: 'urlaub', von: tagePlus(H, 3), bis: tagePlus(H, 5), titel: SYS.kapa } },
    ] });
    expect(ka.status, await ka.clone().text()).toBe(200);

    // Visitenkarte, Postfach + Mail-Kopf, Haut.
    await db.saveJson('visitenkarten--kevin', { karten: [{ id: 'vk-messlatte', bezeichnung: SYS.karte, vorname: 'Kevin', firma: SYS.karte }] });
    const PF = 'pf-11111111-2222-4333-8444-555555555555';
    // `geteilt: true` an einem PRIVAT-Postfach (Inbox teilen, 08.10.) — so stünde es nur nach einer Manipulation im Bestand; die Sicht
    // (`postfachSichtbar`) darf es trotzdem nie zu Malin bringen.
    await db.saveJson('postfaecher--kevin', { v: 1, postfaecher: [{ id: PF, quelle: 'imap', bereich: 'privat', anzeigename: SYS.postfach, adresse: 'kevin.messlatte@example.invalid', anbieter: 'icloud', angelegtAm: '2026-10-06', geteilt: true }] });
    await db.saveJson('imap-stand--kevin', { v: 1, person: 'kevin', postfaecher: { [PF]: { at: J } }, koepfe: {
      [`${PF}:e:1:1`]: { id: `${PF}:e:1:1`, threadId: 'x', am: J, von: { name: 'Freundin', email: 'freundin@example.invalid' }, an: [{ email: 'kevin.messlatte@example.invalid' }], cc: [], betreff: SYS.mail, ausschnitt: SYS.mail, labels: ['INBOX'], anhaenge: [], postfachId: PF, ordner: 'e', uidValidity: '1', uid: 1, wurzel: '<m1@x>', messageId: '<m1@x>' },
    } });
    await db.saveJson('inbox-uebergaben--haus-messlatte', { v: 1, uebergaben: [{
      id: 'ub-11111111-2222-4333-8444-555555555555', von: 'kevin', an: 'dritte', gespraech: `im~${PF}~0123456789abcdef0123`, quelle: 'imap', postfachId: PF, bereich: 'privat',
      betreff: SYS.mail, gegenueber: { email: 'freundin@example.invalid' }, notiz: SYS.uebergabe, kuemmert: 'dritte', status: 'offen',
      angelegtAm: J, kopieAm: J, geaendertAm: J, nachrichten: [{ id: `${PF}:e:1:1`, am: J, von: { email: 'freundin@example.invalid' }, an: [], cc: [], betreff: SYS.mail, text: SYS.uebergabe, vonUns: false, anhaenge: [] }], verlauf: [],
    }] });
    await db.saveJson('haut', { [H]: { juckreiz: 3, schub: false, ausloeser: SYS.haut, am: J } });
    const { speicherFuer: sf } = await import('@/lib/zoe/raum');
    await db.saveJson(sf('gesundheit-koerper', 'kevin'), { v: 1, leitsatz: SYS.koerper, beschwerden: [{ id: 'kb-messlatte', name: SYS.koerper, status: '', notiz: SYS.koerper, ton: 'achtung' }], hebel: [], stufen: [], zusammenhaenge: [], hinweis: SYS.koerper, symptom: { name: SYS.koerper }, sauberZaehler: true, routinenHinweise: [] });
    // Onboarding: Kevins persönliches Häkchen (die Marke steckt im Zeitstempel) und alte Häkchen seiner früheren Spur im gemeinsamen
    // Bestand — die zählen nie und erscheinen höchstens als Kennung „früher abgehakt“, nie mit Zeitstempel.
    await db.saveJson('onboarding--kevin', { erledigt: { 'ich-rundgang': { at: SYS.onboarding, von: 'kevin' } } });
    await db.saveJson('onboarding', { erledigt: { 'kevin-sicht-alt': { at: '2000-01-01T00:00:00.000Z', von: 'Kevin' }, 'kevin-zwei-faktor': { at: '2001-02-03T04:05:07.891Z', von: 'Kevin' } } });

    // Tageslauf (Altbestand ohne Suffix = Inhaber) und Stammdaten mit persönlicher Kennung von Kevin (08.10. spät).
    await db.saveJson('tageslauf', { laeufe: [{ id: 'lauf-messlatte', art: 'kurz', gestartet: J, fertig: J, schritte: [{ id: 'aufgaben', name: 'Aufgaben', stand: 'ok', kurz: SYS.tageslauf }], ausrichtung: { gruss: SYS.tageslauf } }] });
    await db.saveJson('stammdaten', { firmen: [], konten: [], partner: [], personen: [{ id: 'p-messlatte', name: 'kevin', person: 'kevin', steuerId: SYS.steuerId, svNummer: SYS.steuerId }] });
    // Arbeitsrahmen (Business-frei, Lücke 7): Kevins eigene Ergänzung — nur er selbst sieht sie.
    await db.saveJson('arbeitsrahmen--kevin', { businessFrei: [{ tage: [2], von: '05:17', bis: '06:43' }], geaendertAm: SYS.arbeitsrahmen });

    await db.saveJson('zoe-kanal--kevin', { v: 1, status: 'verbunden', nummer: '491700000001', verbundenSeit: SYS.zoeKanal, ereignisse: [{ zeit: SYS.zoeKanal, art: 'bestaetigt', von: 'kevin', quelle: 'whatsapp' }] });

    // Agenten-Bereich Paket 1 (09.10.): Kevins Threads (Business + Privat, nicht geteilt).
    {
      const fd = (id: string, headId: string, bereich: 'business' | 'privat', titel: string) => ({ id, besitzer: 'kevin', agent: { art: 'head', headId }, bereich, titel, status: 'offen', fremdGelesen: false, vertraulich: false, erstellt: J, aktualisiert: J,
        nachrichten: [{ id: `nr-${id}`, rolle: 'person', von: 'kevin', text: titel, zeit: J }] });
      await db.saveJson('agenten-faeden--kevin', { v: 1, faeden: [
        fd('fd-00000000-0000-4000-8000-00000000ab01', 'sales', 'business', `${SYS.agentenFaden} Business`),
        fd('fd-00000000-0000-4000-8000-00000000ab02', 'assistenz', 'privat', `${SYS.agentenFaden} Privat`),
      ] });
    }

    // Medien unterwegs (09.10., Paket 5): privates Album „nur ich“ mit einem Medium (Name trägt die Marke) — nur Kevin sieht es.
    await db.saveJson('medien-privat--kevin', { v: 1, alben: [{ id: 'al-messlatte', bereich: 'privat', art: 'frei', titel: SYS.medienAlbum, sicht: 'nur-ich', von: 'kevin', angelegt: J }], medien: [{
      id: 'md-00000000-0000-4000-8000-0000000000aa', art: 'bild', bereich: 'privat', von: 'kevin', album: 'al-messlatte', hochgeladen: J, typ: 'image/jpeg', groesse: 10, name: SYS.medium,
      ortsdatenEntfernt: true, schluessel: { kid: null, dek: Buffer.alloc(32).toString('base64') }, varianten: {}, personen: [], urheber: { art: 'team' }, marketing: { status: 'intern', verlauf: [] }, heads: [], geaendert: J,
    }] });

    // Agenten-Bereich (Paket 3): Kevins Privat-Skill (Head „Persönliche Assistenz“) und seine geplante Hintergrundaufgabe.
    await db.saveJson('agenten-skills-privat--kevin', { v: 1, mitarbeiter: [], gedaechtnis: {}, skills: [{
      id: 'sk-messlatte', headId: 'assistenz', name: 'messlatte-skill', beschreibung: SYS.agentenSkill, anleitung: SYS.agentenSkill, werkzeuge: [], ausloeser: { art: 'hand' },
      eingabeFelder: [], freigabePflicht: false, ergebnis: 'faden', stufe: 'schnell', tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: false, version: 1, quelle: 'hand', angelegtVon: 'kevin',
    }] });
    // Agenten-Bereich (Paket 4b): Kevins Einstellungen seines Privat-Heads (eigener Abschnitt im Bestand des Haushalts).
    await db.saveJson('agenten-einstellung--haus-messlatte', { v: 1, heads: {}, personen: { kevin: { heads: { assistenz: { zustaendig: SYS.agentenEinstellung, budgetCentMonat: 1234, geaendertVon: 'kevin', geaendertAm: J } } } } });
    await db.saveJson('agenten-plan--kevin', { v: 1, aufgaben: [{ id: 'hg-messlatte', besitzer: 'kevin', agent: { art: 'head', headId: 'assistenz' }, titel: SYS.agentenPlan, auftrag: SYS.agentenPlan, zeitplan: { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '08:00' }, aktiv: true, erstellt: J }] });

    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    routen = Object.entries(ROUTEN_REGISTER)
      .filter(([pfad, e]) => e.methoden.GET && e.methoden.GET !== 'offen' && e.methoden.GET !== 'dienst' && !UEBERSPRUNGEN[pfad])
      .map(([pfad]) => pfad).sort();
  }, 120_000);
  afterAll(() => { globalThis.fetch = echtesFetch; });

  it('keine Antwort an Malin enthält eine Marke aus Kevins privaten Beständen', async () => {
    expect(routen.length).toBeGreaterThan(100);
    const lecks: string[] = [];
    const ohneAntwort: string[] = [];
    for (const pfad of routen) {
      for (const v of VARIANTEN) {
        const r = await rufeGet(pfad, v, 'malin');
        if (r === 'frist' || 'fehler' in r) { ohneAntwort.push(`${pfad}${v}: ${r === 'frist' ? 'Zeitüberschreitung' : r.fehler}`); continue; }
        for (const [name, marke] of Object.entries(ALLE_MARKEN)) {
          if (!r.text.includes(marke)) continue;
          if (ERLAUBT.some(x => x.route === pfad && x.marke === marke)) continue;
          lecks.push(`${pfad}${v} (${r.status}) → ${name}`);
        }
      }
    }
    // Was gar nicht antwortete, steht im Ausgabeprotokoll — kein Leck, aber sichtbar.
    if (ohneAntwort.length) console.warn(`[messlatte] ohne Antwort (${ohneAntwort.length}):\n${ohneAntwort.join('\n')}`);
    expect(lecks).toEqual([]);
  }, 900_000);

  it('Gegenprobe: jede Marke kommt bei Kevin selbst an (die Saat ist lesbar)', async () => {
    const gefunden = new Map<string, string>();
    for (const pfad of routen) {
      for (const v of ['', VARIANTEN[3]]) {
        const r = await rufeGet(pfad, v, 'kevin');
        if (r === 'frist' || 'fehler' in r) continue;
        for (const [name, marke] of Object.entries(ALLE_MARKEN)) if (r.text.includes(marke) && !gefunden.has(name)) gefunden.set(name, pfad);
      }
    }
    const fehlt = Object.keys(ALLE_MARKEN).filter(n => !gefunden.has(n));
    expect(fehlt).toEqual([]);
  }, 900_000);

  // ─── 09.10. (R9): die zweite Person als gleichwertige INHABERIN ─────────────────────────────────────────────────────────
  // Inhaber heißt Verwaltung, nicht Einsicht: auch mit Inhaber-Rechten (jetzt kommen auch die Inhaber-Routen an) darf keine Antwort
  // eine Marke aus Kevins privaten Beständen tragen — Gesundheit, „nur ich“, private Notizen, persönliche Bestände.
  it('zweite Inhaberin: keine Antwort an Malin enthält eine Marke aus Kevins privaten Beständen', async () => {
    const db = await import('@/lib/store/local-db');
    const vorher = await db.loadJson('konten');
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'inhaber'), konto('k3', 'dritte', 'mitglied')], einladungen: [], einstellungen: { hauptInhaber: 'kevin' } });
    try {
      const { istInhaber, inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
      expect(await istInhaber('malin')).toBe(true);
      expect(await inhaberSpeicher()).toBe('kevin');
      const lecks: string[] = [];
      for (const pfad of routen) {
        for (const v of VARIANTEN) {
          const r = await rufeGet(pfad, v, 'malin');
          if (r === 'frist' || 'fehler' in r) continue;
          for (const [name, marke] of Object.entries(ALLE_MARKEN)) {
            if (!r.text.includes(marke)) continue;
            if (ERLAUBT.some(x => x.route === pfad && x.marke === marke)) continue;
            lecks.push(`${pfad}${v} (${r.status}) → ${name}`);
          }
        }
      }
      // Das Werkzeug der Einzel-Wiederherstellung (Inhaber) öffnet keine persönlichen Bestände der anderen Person.
      for (const q of ['?bestand=gesundheit-koerper--kevin&tag=2026-10-01&liste=beschwerden&ids=kb-messlatte', '?bestand=tageslauf', '?bestand=vitals', '?bestand=ziele-eigen--kevin']) {
        const r = await rufeGet('intern/wiederherstellen', q, 'malin');
        if (r === 'frist' || 'fehler' in r) { lecks.push(`intern/wiederherstellen${q}: keine Antwort`); continue; }
        if (r.status !== 403) lecks.push(`intern/wiederherstellen${q}: ${r.status} statt 403`);
      }
      expect(lecks).toEqual([]);
    } finally { await db.saveJson('konten', vorher); }
  }, 900_000);
});
