// ─── Nachprüfung 18.10. (L1b): Funde aus dem Durchgang im Browser — je Fund ein Wächter ─────────────────────────────────────────────
// N1 (A): ein Konto „nur Business“ bekam über GET /api/fluss?bereich=kalender einen Termin aus dem Kalender „Privat“ samt Titel.
// N7 (B): die freie-Zeit-Suche (Kick-off-Vorschläge) kannte ohne iCloud/Google keine Termine — der Mac-Stand fehlte.
// N17 (C): der Erklärtext der Einrichtung nannte Konten „nur Business“ Finanzplan, Gesundheit, Familie und den Haushalt.
// Eigener Datenordner, erfundene Personen und Termine (@example.invalid), kein Netz (Mac-Stand).
import { describe, it, expect, vi, beforeEach } from 'vitest';

await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  process.env.MAKE_OS_DATEN_DIR = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-nachpruefung-l1b-'));
  process.env.MAKE_OS_OHNE_APPLE = '1';
  for (const n of ['MAKE_OS_DATEN_SCHLUESSEL', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[n];
});

const HAUS = 'nl-haus';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const KONTEN = [konto('k1', 'lena', 'inhaber'), konto('k2', 'jonas', 'mitglied'), konto('k3', 'ben', 'mitglied', { finanzRecht: 'business' })];

const MARKE = {
  arbeit: 'NL1B-ARBEITSTERMIN',
  privat: 'NL1B-ABENDESSEN-PRIVAT',
  fremd: 'NL1B-JONAS-NUR-PRIVAT',
};

beforeEach(async () => (await import('@/lib/store/memo')).memoLeeren());

async function saat() {
  const db = await import('@/lib/store/local-db');
  const { localDay, tagePlus } = await import('@/lib/zeit');
  const H = tagePlus(localDay(), 2);
  await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
  await db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: [
    { id: 'e-nl-arbeit', title: MARKE.arbeit, startDate: `${H}T09:00:00`, endDate: `${H}T10:00:00`, allDay: false, calendarName: 'Arbeit' },
    { id: 'e-nl-privat', title: MARKE.privat, startDate: `${H}T19:00:00`, endDate: `${H}T21:00:00`, allDay: false, calendarName: 'Privat' },
    { id: 'e-nl-fremd', title: MARKE.fremd, startDate: `${H}T12:00:00`, endDate: `${H}T13:00:00`, allDay: false, calendarName: 'Privat' },
  ] });
  // Der dritte Termin ist ein privater von Jonas (Sicherung in `kalender-bezug`) — für Lena nur „Belegt“.
  await db.saveJson('kalender-bezug', { bezuege: { 'e-nl-fremd': { privat: true, von: 'jonas', geaendert: new Date().toISOString(), tag: H } } });
  return H;
}

type Fluss = { ok: boolean; fluss: { zeilen: { titel: string }[] } | null };
async function fluss(wer: string, space = ''): Promise<{ status: number; text: string; d: Fluss }> {
  const { GET } = await import('@/app/api/fluss/route');
  const r = await GET(new Request(`http://x/api/fluss?bereich=kalender${space ? `&space=${space}` : ''}`, { headers: sitzung(wer) }));
  const text = await r.text();
  return { status: r.status, text, d: JSON.parse(text) as Fluss };
}

describe('N1 — Fluss „Für dich“ im Kalender: Sicht X bekommt nichts aus Y (serverseitig)', () => {
  it('Konto „nur Business“: kein Termin aus einem Privat-Kalender — weder Titel noch Zeile; nur die Business-Termine', async () => {
    await saat();
    for (const space of ['', 'business']) {
      const ben = await fluss('ben', space);
      expect(ben.status).toBe(200);
      expect(ben.text, `space=${space}`).not.toContain(MARKE.privat);
      expect(ben.text, `space=${space}`).not.toContain(MARKE.fremd);
      expect(ben.text, `space=${space}`).not.toContain('Belegt');
      expect(ben.d.fluss?.zeilen.map(z => z.titel), `space=${space}`).toEqual([MARKE.arbeit]);
    }
    // Die Privat-Sicht gibt es für dieses Konto gar nicht.
    expect((await fluss('ben', 'privat')).d.fluss).toBeNull();
  }, 60_000);

  it('dieselbe Regel wie GET /api/kalender: Ben bekommt dort dieselben Titel', async () => {
    const H = await saat();
    const { GET } = await import('@/app/api/kalender/route');
    const r = await GET(new Request(`http://x/api/kalender?von=${H}&bis=${H}`, { headers: sitzung('ben') }));
    const titel = ((await r.json()) as { termine: { titel: string }[] }).termine.map(t => t.titel);
    expect(titel).toEqual([MARKE.arbeit]);
    expect((await fluss('ben')).d.fluss?.zeilen.map(z => z.titel)).toEqual(titel);
  }, 60_000);

  it('andere Person: der private Termin von Jonas erscheint bei Lena nie mit Titel (höchstens „Belegt“ — im Fluss gar nicht)', async () => {
    await saat();
    const lena = await fluss('lena');
    expect(lena.text).not.toContain(MARKE.fremd);
    expect(lena.d.fluss?.zeilen.map(z => z.titel)).toEqual([MARKE.arbeit, MARKE.privat]);
    // Gegenprobe: Jonas sieht seinen eigenen privaten Termin.
    expect((await fluss('jonas')).text).toContain(MARKE.fremd);
  }, 60_000);

  it('volle Mitglieder mit Sicht Business bzw. Privat: nur Termine aus Kalendern dieses Bereichs', async () => {
    await saat();
    expect((await fluss('lena', 'business')).d.fluss?.zeilen.map(z => z.titel)).toEqual([MARKE.arbeit]);
    expect((await fluss('lena', 'privat')).d.fluss?.zeilen.map(z => z.titel)).toEqual([MARKE.privat]);
  }, 60_000);

  it('der EINE Lesepfad für Modelle (`termineFuerZoe`): „nur Business“ ohne Privat-Kalender — auch nicht als „Belegt“', async () => {
    const H = await saat();
    const { tagePlus } = await import('@/lib/zeit');
    const { termineFuerZoe } = await import('@/lib/kalender/zoe-sicht-server');
    const ben = await termineFuerZoe('ben', H, tagePlus(H, 1));
    expect(ben.termine.map(t => t.kalender)).toEqual(['Arbeit']);
    const lena = await termineFuerZoe('lena', H, tagePlus(H, 1));
    expect(lena.termine.map(t => t.titel).sort()).toEqual([MARKE.arbeit, 'Belegt', MARKE.privat].sort());
  }, 60_000);
});

// Dieselbe Lücke in „Steht an“ (Heute + Glocke): die Messlatte fand sie über die neue Haushalts-Marke im Kalender „Privat“.
describe('N1-Rest — Heute „Steht an“: „nur Business“ ohne Termin aus einem Privat-Kalender', () => {
  it('GET /api/heute/anstehend: Ben nur der Business-Termin; Lena beide, Jonas’ privater nur „Belegt“', async () => {
    const db = await import('@/lib/store/local-db');
    const { localDay, tagePlus } = await import('@/lib/zeit');
    const H = localDay(), M = tagePlus(H, 1);
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    // Ganztägig: „Steht an“ zeigt sie den ganzen Tag (unabhängig von der Uhrzeit des Testlaufs).
    const ganz = (id: string, title: string, calendarName: string) => ({ id, title, startDate: `${H}T00:00:00`, endDate: `${M}T00:00:00`, allDay: true, calendarName });
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: [
      ganz('e-nl-a', MARKE.arbeit, 'Arbeit'), ganz('e-nl-p', MARKE.privat, 'Privat'), ganz('e-nl-f', MARKE.fremd, 'Privat'),
    ] });
    await db.saveJson('kalender-bezug', { bezuege: { 'e-nl-f': { privat: true, von: 'jonas', geaendert: new Date().toISOString(), tag: H } } });
    const { GET } = await import('@/app/api/heute/anstehend/route');
    const lies = async (wer: string) => { const r = await GET(new Request('http://x/api/heute/anstehend', { headers: sitzung(wer) })); expect(r.status).toBe(200); return r.text(); };
    const ben = await lies('ben');
    expect(ben).toContain(MARKE.arbeit);
    expect(ben).not.toContain(MARKE.privat);
    expect(ben).not.toContain(MARKE.fremd);
    expect(ben).not.toContain('Belegt');
    const lena = await lies('lena');
    expect(lena).toContain(MARKE.privat);
    expect(lena).not.toContain(MARKE.fremd);
  }, 60_000);
});

// Alle Bereiche des Flusses mit der Business-Rolle und mit der jeweils anderen Person (Nachprüfung 18.10.: „gleiche Lücke woanders?“).
describe('N1 — alle Bereiche von /api/fluss: „nur Business“ und die andere Person bekommen nichts Privates', () => {
  const PRIVAT = {
    familie: 'NL1B-FAMILIE-DATE',
    aufgabe: 'NL1B-AUFGABE-PRIVAT',
    nurIch: 'NL1B-AUFGABE-NUR-ICH-JONAS',
    ziel: 'NL1B-ZIEL-PRIVAT',
    routine: 'NL1B-ROUTINE-PRIVAT',
  };
  async function saatAlle() {
    const H = await saat();
    const db = await import('@/lib/store/local-db');
    const T0 = '2026-10-01T08:00:00.000Z';
    const a = (id: string, title: string, x: Record<string, unknown> = {}) => ({ id, projectId: 'p-nl', title, status: 'todo', priority: 'high', assignee: 'lena', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', dueDate: H, ...x });
    await db.saveJson('tasks', {
      projects: [{ id: 'p-nl', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' }],
      listen: [], statusEigen: [], vorlagen: [],
      tasks: [a('t-nl-privat', PRIVAT.aufgabe), a('t-nl-nurich', PRIVAT.nurIch, { assignee: 'jonas', angelegtVon: 'jonas', sichtbarkeit: 'nur-ich' })],
    });
    await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], fokus: {}, jahr: [{ id: 'z-nl-privat', titel: PRIVAT.ziel, fortschritt: 10, space: 'privat', rang: 1, termin: H }] });
    await db.saveJson('routinen', { routinen: [{ id: 'r-nl', label: PRIVAT.routine, wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true, owner: 'beide', naechstesMal: H }], bloecke: [] });
    await db.saveJson(`familie--${HAUS}`, {
      dates: [{ id: 'd-nl', von: 'lena', am: T0, titel: PRIVAT.familie, datum: H, planer: 'lena', status: 'geplant', neuesErlebnis: false, nachklang: [], ideeId: null }],
      gespraeche: [], vereinbarungen: [], wertschaetzungen: [], tage: [],
    });
  }

  it('Konto „nur Business“: in keinem Bereich und keiner Sicht eine private Marke (auch nicht der Kalender)', async () => {
    await saatAlle();
    const { FLUSS_BEREICHE } = await import('@/lib/fluss/modell');
    const { GET } = await import('@/app/api/fluss/route');
    const lecks: string[] = [];
    for (const b of FLUSS_BEREICHE) for (const sp of ['', '&space=privat', '&space=business']) {
      const r = await GET(new Request(`http://x/api/fluss?bereich=${b}${sp}`, { headers: sitzung('ben') }));
      const text = await r.text();
      for (const [name, m] of Object.entries({ ...PRIVAT, privat: MARKE.privat, fremd: MARKE.fremd })) if (text.includes(m)) lecks.push(`${b}${sp} → ${name}`);
    }
    expect(lecks).toEqual([]);
    // Aufgaben zeigt nur Zahlen — dort zählt die private Aufgabe des Haushalts für dieses Konto nicht mit.
    const auf = JSON.parse(await (await GET(new Request('http://x/api/fluss?bereich=aufgaben', { headers: sitzung('ben') }))).text()) as { fluss: { prognose: number[] } };
    expect(auf.fluss.prognose.reduce((x, y) => x + y, 0)).toBe(0);
  }, 120_000);

  it('andere Person: Jonas’ „nur ich“ und sein privater Termin nie bei Lena — Gegenprobe: Lena sieht das Private des Haushalts', async () => {
    await saatAlle();
    const { FLUSS_BEREICHE } = await import('@/lib/fluss/modell');
    const { GET } = await import('@/app/api/fluss/route');
    let alles = '';
    for (const b of FLUSS_BEREICHE) {
      const text = await (await GET(new Request(`http://x/api/fluss?bereich=${b}`, { headers: sitzung('lena') }))).text();
      expect(text, b).not.toContain(PRIVAT.nurIch);
      expect(text, b).not.toContain(MARKE.fremd);
      alles += text;
    }
    for (const m of [PRIVAT.familie, PRIVAT.ziel, PRIVAT.routine, MARKE.privat]) expect(alles, m).toContain(m);
    // Aufgaben (nur Zahlen): Lena zählt die gemeinsame private Aufgabe, nicht Jonas’ „nur ich“ — Jonas zählt beide.
    const summe = async (wer: string) => (JSON.parse(await (await GET(new Request('http://x/api/fluss?bereich=aufgaben', { headers: sitzung(wer) }))).text()) as { fluss: { prognose: number[] } }).fluss.prognose.reduce((x, y) => x + y, 0);
    expect(await summe('lena')).toBe(1);
    expect(await summe('jonas')).toBe(2);
  }, 120_000);
});

describe('N7 — freie Zeit ohne iCloud/Google: der Mac-Stand zählt (mit „zählt als belegt“ je Kalender)', () => {
  /** Der nächste Montag nach heute (Werktag, kein Feiertag im Testzeitraum nötig — die Vorlage Mo–Fr 9–18 gilt). */
  async function montag(): Promise<string> {
    const { localDay, tagePlus } = await import('@/lib/zeit');
    let d = tagePlus(localDay(), 1);
    while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 1) d = tagePlus(d, 1);
    // Feiertage NRW fallen nie auf einen Montag außer Ostern/Pfingsten — dann eine Woche weiter.
    const { feiertag } = await import('@/lib/zeit/kalender-kern');
    return feiertag(d) ? tagePlus(d, 7) : d;
  }

  async function mitTermin(tag: string, belegt: boolean) {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), quelle: 'mac', events: [
      { id: 'e-nl-team', title: 'Wochenstart Team', startDate: `${tag}T09:00:00`, endDate: `${tag}T09:45:00`, allDay: false, calendarName: 'Arbeit' },
    ] });
    await db.saveJson('kalender-bezug', { bezuege: {} });
    await db.saveJson('kalender-einstellungen', { belegt: { Arbeit: belegt } });
  }

  it('Termin im Mac-Stand in einem Kalender „zählt als belegt“ → beschäftigt, kein Vorschlag überschneidet ihn', async () => {
    const tag = await montag();
    const { tagePlus } = await import('@/lib/zeit');
    await mitTermin(tag, true);
    const { verfuegbarkeitFuer } = await import('@/lib/kalender/verfuegbarkeit');
    const v = await verfuegbarkeitFuer('lena', tag, tagePlus(tag, 1));
    expect(v.tage[0].beschaeftigt.map(b => [b.start, b.ende])).toEqual([[`${tag}T09:00:00`, `${tag}T09:45:00`]]);
    const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
    const r = await freieZeitFuer({ personen: ['lena'], dauerMin: 90, von: tag, tage: 1, vorlaufMin: 0, rasterMin: 30, grenze: 20, jetzt: new Date(`${tagePlus(tag, -3)}T08:00:00Z`) });
    expect(r.vorschlaege.length).toBeGreaterThan(0);
    for (const s of r.vorschlaege) expect(s.ende <= `${tag}T09:00:00` || s.start >= `${tag}T09:45:00`, `${s.start}–${s.ende}`).toBe(true);
  }, 60_000);

  it('Gegenprobe: derselbe Kalender ohne „zählt als belegt“ belegt niemanden', async () => {
    const tag = await montag();
    const { tagePlus } = await import('@/lib/zeit');
    await mitTermin(tag, false);
    const { verfuegbarkeitFuer } = await import('@/lib/kalender/verfuegbarkeit');
    expect((await verfuegbarkeitFuer('lena', tag, tagePlus(tag, 1))).tage[0].beschaeftigt).toEqual([]);
  }, 60_000);
});

describe('N17 — Einrichtung für ein Konto „nur Business“: der Erklärtext nennt keine Privat-Themen', () => {
  const PRIVAT_WORTE = /Gesundheit|Familie|Haushalt|WHOOP/;
  const varianten = [false, true].flatMap(alt => [false, true].flatMap(neustart => [false, true].map(betreiber => ({ alt, neustart, betreiber }))));

  it('„So läuft die Einrichtung“ (`ablaufFuer`): in jeder Fassung ohne Gesundheit, Familie, Haushalt — volle Mitglieder unverändert', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    for (const v of varianten) {
      for (const a of D.ablaufFuer(v.alt, v.neustart, v.betreiber, true)) expect(`${a.wann} ${a.was}`, JSON.stringify(v)).not.toMatch(PRIVAT_WORTE);
      // Gleiche Zeilen (nur der Satz wechselt).
      expect(D.ablaufFuer(v.alt, v.neustart, v.betreiber, true).map(a => a.wann)).toEqual(D.ablaufFuer(v.alt, v.neustart, v.betreiber).map(a => a.wann));
    }
    // Ohne „nur Business“: dieselben Objekte wie bisher (Fahrplan der gewachsenen Instanz).
    expect(D.ablaufFuer(true)).toBe(D.ABLAUF);
    expect(D.ablaufFuer(false, false, true).some(a => /Gesundheit und Familie/.test(a.was))).toBe(true);
  });

  it('Etappen mit Schritten dieses Kontos (`etappenFuer` + `schritteFuer`): Titel, Satz und Hinweise ohne Privat-Themen', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    for (const v of varianten) {
      const k = { inhaber: false, personen: 3, nurBusiness: true, privatFinanzen: false, altbestand: v.alt, neustart: v.neustart, betreiber: v.betreiber };
      const schritte = D.schritteFuer(k);
      const etappen = D.etappenFuer(v.alt, v.neustart, v.betreiber, true).filter(e => schritte.some(s => s.etappe === e.nr));
      for (const e of etappen) {
        expect(`${e.titel} ${e.satz}`, `${JSON.stringify(v)} Etappe ${e.nr}`).not.toMatch(PRIVAT_WORTE);
        for (const h of e.hinweise ?? []) expect(`${h.titel} ${h.satz}`, `${JSON.stringify(v)} Etappe ${e.nr}`).not.toMatch(/Haushalt/);
      }
    }
    expect(D.etappenFuer(true)).toBe(D.ETAPPEN);
  });

  it('die Übersicht gibt „nur Business“ an Ablauf, Etappen und den Satz zu den drei Ebenen weiter', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('components/os/OnboardingView.tsx', 'utf8');
    expect(src).toContain('ablaufFuer(alt, neustart, betreiber, !!z?.ich?.nurBusiness)');
    expect(src).toContain('z?.ich?.betreiber, !!z?.ich?.nurBusiness)');
    expect(src).toContain("{z?.ich?.nurBusiness ? 'die Firmen' : 'Haushalt und Firmen'}");
    expect(readFileSync('lib/make-one/onboarding-bild.ts', 'utf8')).toContain('k?.betreiber, !!k?.nurBusiness)');
  });
});
