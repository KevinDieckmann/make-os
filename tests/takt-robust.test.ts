// ─── Takt robust (09.10.): Warteschlange, Not-Aus, Zeitzone, Signale ────────────────────────────────────────────────────
// Funde der Ereignis-Analyse (nur gelesen, agenten-nacht): Warteschlange und Head-Vorschläge still gekürzt, Not-Aus bei Lesefehler offen,
// überlappende Läufe (Pacht 300 s < Laufzeit), ein Engpass am Morgenlauf, CRM-Signale nur im Browser, Heads/Head of Finance in der Zone der
// Maschine, verpasste Wochen-/Monatsläufe nie nachgeholt, Tageslauf im Takt ohne Post. Je Fund ein Wächter. Erfundene Daten, eigener Ordner,
// kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-takt-robust-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-takt-robust';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const tzVorher = process.env.TZ;
afterEach(() => { process.env.TZ = tzVorher; vi.useRealTimers(); });

let db: typeof import('@/lib/store/local-db');
type Auftrag = import('@/lib/zoe/auftraege').Auftrag;

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt: 'probe-haus' });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber'), konto('k2', 'person-b', 'mitglied')], einladungen: [] });
});

const auftrag = (x: Partial<Auftrag> & { id: string; name: string; tag: string; status: Auftrag['status'] }): Auftrag => ({
  zeit: `${x.tag}T08:00:00.000Z`, art: 'agent', eingabe: {}, schluessel: `agent:${x.name}:${x.id}`, versuche: 1, ...x,
});

// ── 1. Warteschlange nie still kürzen ──────────────────────────────────────────────────────────────────────────────────
describe('Warteschlange: aufräumen statt abschneiden', () => {
  it('heutige Riegel-Einträge bleiben, auch wenn es mehr als 400 sind — der Morgenlauf läuft nicht doppelt', async () => {
    const q = await import('@/lib/zoe/auftraege');
    const jetzt = new Date('2026-10-09T10:00:00Z');
    // Der Morgenlauf steht ganz hinten (ältester des Tages), davor 450 erledigte Tageslauf-Pulse von heute.
    const liste = [
      ...Array.from({ length: 450 }, (_, i) => auftrag({ id: `a-puls-${i}`, name: 'tageslauf', tag: '2026-10-09', status: 'fertig' })),
      auftrag({ id: 'a-morgen', name: 'morgen', tag: '2026-10-09', status: 'fertig' }),
    ];
    await db.saveJson('zoe-auftraege', { auftraege: liste });
    const r = await q.reihe([{ art: 'agent', name: 'probe-neu' }], jetzt);
    expect(r.angelegt).toHaveLength(1);
    const danach = await q.lies();
    expect(danach.some(a => a.id === 'a-morgen')).toBe(true);
    expect(danach).toHaveLength(452);
  });

  it('ältere erledigte nach 7 Tagen weg, davon höchstens 400 — offene nie', async () => {
    const { aufraeumen, GRENZE } = await import('@/lib/zoe/auftraege');
    const jetzt = new Date('2026-10-09T10:00:00Z');
    const alt = Array.from({ length: 500 }, (_, i) => auftrag({ id: `a-alt-${i}`, name: 'hoi', tag: '2026-10-05', status: 'fertig', zeit: new Date(Date.parse('2026-10-05T06:00:00Z') + i * 1000).toISOString() }));
    const uralt = auftrag({ id: 'a-uralt', name: 'hoi', tag: '2026-09-20', status: 'fehler' });
    const offen = auftrag({ id: 'a-offen-alt', name: 'research', tag: '2026-09-01', status: 'offen' });
    const r = aufraeumen([...alt, uralt, offen], jetzt);
    expect(r.some(a => a.id === 'a-offen-alt')).toBe(true);
    expect(r.some(a => a.id === 'a-uralt')).toBe(false);
    expect(r.filter(a => a.id.startsWith('a-alt-'))).toHaveLength(GRENZE);
    // die jüngsten bleiben
    expect(r.some(a => a.id === 'a-alt-499')).toBe(true);
    expect(r.some(a => a.id === 'a-alt-0')).toBe(false);
  });

  it('über der harten Grenze werden NEUE abgelehnt (gezählt) — nichts Vorhandenes fällt weg', async () => {
    const q = await import('@/lib/zoe/auftraege');
    const jetzt = new Date('2026-10-09T10:00:00Z');
    const voll = Array.from({ length: q.HARTE_GRENZE }, (_, i) => auftrag({ id: `a-o-${i}`, name: 'research', tag: '2026-10-09', status: 'offen' }));
    await db.saveJson('zoe-auftraege', { auftraege: voll });
    const r = await q.reihe([{ art: 'agent', name: 'tagesstart' }, { art: 'agent', name: 'morgen' }], jetzt);
    expect(r).toMatchObject({ angelegt: [], abgelehnt: 2 });
    expect(await q.lies()).toHaveLength(q.HARTE_GRENZE);
    expect(await q.warteschlangeLage(jetzt)).toMatchObject({ gesamt: q.HARTE_GRENZE, abgelehntHeute: 2 });
    const { taktRobustBefunde } = await import('@/lib/hoi/lage');
    expect(taktRobustBefunde({ warteschlange: await q.warteschlangeLage(jetzt), sperreLesbar: true, tagesstart: null, headsVoll: [] })[0]).toMatchObject({ id: 'warteschlange', ampel: 'rot' });
    await db.saveJson('zoe-auftraege', { auftraege: [] });
  });

  it('POST /api/zoe/auftraege: mehr als 40 auf einmal → 413 statt still gekürzt', async () => {
    const route = await import('@/app/api/zoe/auftraege/route');
    const auftraege = Array.from({ length: 41 }, (_, i) => ({ art: 'agent', name: 'research', auftrag: `Thema ${i}` }));
    const r = await route.POST(new Request('http://t/api/zoe/auftraege', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'person-a' }, body: JSON.stringify({ auftraege }) }));
    expect(r.status).toBe(413);
    expect(await (await import('@/lib/zoe/auftraege')).lies()).toHaveLength(0);
  });
});

// ── 1b. Head-Vorschläge: offene nie wegschneiden ───────────────────────────────────────────────────────────────────────
describe('Freigabe-Liste der Heads: offene bleiben, neue werden über der Grenze abgelehnt', () => {
  it('200 offene + 5 neue → alle offenen bleiben, die 5 neuen sind abgelehnt; entschiedene nur die 120 jüngsten', async () => {
    const { mischen, OFFEN_MAX, ENTSCHIEDEN_MAX } = await import('@/lib/heads/stand');
    const jetzt = '2026-10-09T10:00:00.000Z';
    const v = (id: string, status: 'offen' | 'abgelehnt', tageAlt: number) => ({ id, art: 'aufgabe', titel: `Vorschlag ${id} eindeutig`, begruendung: 'b', prioritaet: 'mittel', dedup_schluessel: id, status, erstellt: jetzt, aktualisiert: new Date(Date.parse(jetzt) - tageAlt * 864e5).toISOString(), berichtId: 'b0' });
    const alt = [
      ...Array.from({ length: OFFEN_MAX }, (_, i) => v(`o${i}`, 'offen', 100)),
      ...Array.from({ length: 150 }, (_, i) => v(`e${i}`, 'abgelehnt', 1 + i / 1000)),
    ] as unknown as Parameters<typeof mischen>[0];
    const neu = Array.from({ length: 5 }, (_, i) => ({ art: 'aufgabe', titel: `Ganz neu Nummer ${i} xyz`, begruendung: 'b', prioritaet: 'mittel', dedup_schluessel: `n${i}` })) as unknown as Parameters<typeof mischen>[1];
    const m = mischen(alt, neu, 'b1', jetzt);
    expect(m.abgelehnt).toBe(5);
    expect(m.neu).toBe(0);
    expect(m.liste.filter(x => x.status === 'offen')).toHaveLength(OFFEN_MAX);
    expect(m.liste.filter(x => x.status === 'abgelehnt')).toHaveLength(ENTSCHIEDEN_MAX);
    expect(m.liste.some(x => x.id === 'e0')).toBe(true); // jüngste entschiedene bleiben
  });
});

// ── 2. Not-Aus fail-closed ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Not-Aus fail-closed: unlesbare Einstellungen = angehalten', () => {
  const datei = () => path.join(ordner, 'agenten-einstellung--probe-haus.json');
  const aufraeumenDatei = () => { for (const f of readdirSync(ordner)) if (f.startsWith('agenten-einstellung--probe-haus.json')) unlinkSync(path.join(ordner, f)); };
  afterEach(aufraeumenDatei);

  it('kaputter Bestand: Takt reiht nur Wartung ein, Arbeiter und Lauf sperren, HOI rot', async () => {
    writeFileSync(datei(), '{ kaputt');
    const e = await import('@/lib/agenten/einstellung');
    const faellig = [{ auftrag: { name: 'head-sales' } }, { auftrag: { name: 'research' } }, { auftrag: { name: 'durchsicht' } }, { auftrag: { name: 'tagesstart' } }];
    expect((await e.taktSperreFiltern(faellig)).map(f => f.auftrag.name)).toEqual(['durchsicht', 'tagesstart']);
    expect(await e.auftragGesperrt({ name: 'research' })).toBe(e.ANGEHALTEN_UNLESBAR);
    expect(await e.auftragGesperrt({ name: 'durchsicht' })).toBeNull();
    expect((await e.laufSperre(null, 'sales'))?.grund).toBe('not-aus');
    expect(await e.agentenEinstellungLesbar()).toBe(false);
    const { taktRobustBefunde } = await import('@/lib/hoi/lage');
    expect(taktRobustBefunde({ warteschlange: { gesamt: 0, aktiv: 0, grenze: 2000, abgelehntHeute: 0 }, sperreLesbar: false, tagesstart: null, headsVoll: [] }).find(b => b.id === 'agenten-sperre')).toMatchObject({ ampel: 'rot' });
  });

  it('fehlt der Bestand, ist nichts gesperrt (wie bisher)', async () => {
    const e = await import('@/lib/agenten/einstellung');
    expect(await e.auftragGesperrt({ name: 'research' })).toBeNull();
    expect(await e.agentenEinstellungLesbar()).toBe(true);
  });
});

// ── 3. Überlappende Läufe: Herzschlag, Pause nach Fehlschlag, Riegel des Morgenlaufs ──────────────────────────────────────
describe('Überlappende Läufe', () => {
  it('ein Fehlschlag steht nicht sofort wieder zur Übernahme bereit (Pause 5 · 3^(n−1) Min.)', async () => {
    const q = await import('@/lib/zoe/auftraege');
    await db.saveJson('zoe-auftraege', { auftraege: [] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T08:00:00Z'));
    await q.reihe([{ art: 'agent', name: 'probe-pause' }]);
    const [a] = await q.nimm(1, 300);
    expect(await q.melde(a.id, a.pachtToken!, 'fehler', 'Zeitüberschreitung')).toBe(true);
    const nach = (await q.lies()).find(x => x.id === a.id)!;
    expect(nach.status).toBe('offen');
    expect(nach.nichtVor).toBe('2026-10-09T08:05:00.000Z');
    expect(await q.nimm(1, 300)).toHaveLength(0);
    vi.setSystemTime(new Date('2026-10-09T08:05:01Z'));
    const [b] = await q.nimm(1, 300);
    expect(b.id).toBe(a.id);
    expect(b.nichtVor).toBeUndefined();
  });

  it('Herzschlag hält die Pacht eines lebenden Laufs frisch — nur der Halter, höchstens 15 Min. nach Beginn', async () => {
    const q = await import('@/lib/zoe/auftraege');
    await db.saveJson('zoe-auftraege', { auftraege: [] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T09:00:00Z'));
    await q.reihe([{ art: 'agent', name: 'probe-herz' }]);
    const [a] = await q.nimm(1, 300);
    expect(await q.pachtVerlaengern(a.id, 'falsch', 300, new Date('2026-10-09T09:04:00Z'))).toBe(false);
    expect(await q.pachtVerlaengern(a.id, a.pachtToken!, 300, new Date('2026-10-09T09:04:00Z'))).toBe(true);
    // 4:30 nach Beginn: ohne Herzschlag wäre die Pacht abgelaufen und ein zweiter Arbeiter hätte übernommen.
    vi.setSystemTime(new Date('2026-10-09T09:06:00Z'));
    expect(await q.nimm(1, 300)).toHaveLength(0);
    expect(await q.pachtGueltig(a.id, a.pachtToken)).not.toBeNull();
    expect(await q.pachtVerlaengern(a.id, a.pachtToken!, 300, new Date('2026-10-09T09:16:00Z'))).toBe(false); // > 15 Min.
  });

  it('Morgenlauf: ein zweiter Start, während der erste läuft, tut nichts doppelt', async () => {
    const { localDay } = await import('@/lib/zeit');
    const heute = localDay();
    await db.saveJson('tagesstart', { lastRun: '2026-01-01', laeuft: { tag: heute, seit: new Date(Date.now() - 60_000).toISOString() } });
    const route = await import('@/app/api/tagesstart/route');
    const r = await (await route.POST(new Request('http://t/api/tagesstart', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY! } }))).json();
    expect(r).toMatchObject({ uebersprungen: true, laeuft: true });
    expect((await db.loadJson<{ lastRun?: string }>('tagesstart'))?.lastRun).toBe('2026-01-01');
  });

  it('Riegel und Engpass rein: läuft = kein zweiter Start; 3 Fehlversuche bzw. ab Mittag einer → übrige laufen', async () => {
    const t = await import('@/lib/zoe/takt');
    const heute = '2026-10-09';
    const jetzt = new Date('2026-10-09T08:00:00Z');
    expect(t.tagesstartLaeuft({ laeuft: { tag: heute, seit: '2026-10-09T07:50:00Z' } }, heute, jetzt)).toBe(true);
    expect(t.tagesstartLaeuft({ laeuft: { tag: heute, seit: '2026-10-09T07:40:00Z' } }, heute, jetzt)).toBe(false); // 20 Min. = abgebrochen
    const f = (n: number, status = 'fehler') => ({ name: 'tagesstart', tag: heute, status, zeit: '2026-10-09T06:00:00Z', versuche: n });
    expect(t.tagesstartLage([f(2)], heute, 10, false).umgehen).toBe(false);
    expect(t.tagesstartLage([f(3)], heute, 10, false).umgehen).toBe(true);
    expect(t.tagesstartLage([f(1)], heute, 12, false).umgehen).toBe(true);
    expect(t.tagesstartLage([f(3)], heute, 12, true).umgehen).toBe(false); // läuft gerade
    expect(t.tagesstartLage([f(3), f(1, 'laeuft')], heute, 12, false).umgehen).toBe(false);
  });
});

// ── 4. + 8. Der Takt selbst: Engpass umgehen, Tageslauf mit Person ────────────────────────────────────────────────────
describe('Takt: hakt der Morgenlauf, laufen die übrigen Läufe; der Tageslauf trägt die Person', () => {
  it('drei Fehlversuche heute → Morgen-Lauf wird trotzdem eingereiht (vorher: den ganzen Tag nichts)', async () => {
    const { faellig } = await import('@/lib/zoe/takt');
    const jetzt = new Date('2026-10-09T08:30:00Z'); // 10:30 Berlin
    await db.saveJson('tagesstart', { lastRun: '2026-10-08' });
    await db.saveJson('zoe-auftraege', { auftraege: [auftrag({ id: 'a-ts', name: 'tagesstart', tag: '2026-10-09', status: 'fehler', versuche: 3, beendet: '2026-10-09T05:00:00.000Z' })] });
    const ids = (await faellig(jetzt)).map(f => f.id);
    expect(ids).toContain('morgen');
    expect(ids).toContain('tagesstart'); // er selbst wird weiter versucht
    const lage = await (await import('@/lib/hoi/innen')).taktRobustLage(jetzt);
    expect(lage.tagesstart).toMatchObject({ fehlversuche: 3, umgangen: true });
  });

  it('auch beim Umgehen gilt der Not-Aus: nur Wartung (Morgenlauf selbst) wird eingereiht', async () => {
    const { faellig } = await import('@/lib/zoe/takt');
    const jetzt = new Date('2026-10-09T08:30:00Z');
    await db.saveJson('tagesstart', { lastRun: '2026-10-08' });
    await db.saveJson('zoe-auftraege', { auftraege: [auftrag({ id: 'a-ts', name: 'tagesstart', tag: '2026-10-09', status: 'fehler', versuche: 3, beendet: '2026-10-09T05:00:00.000Z' })] });
    await db.saveJson('agenten-einstellung--probe-haus', { v: 1, heads: {}, notAus: { seit: '2026-10-09T05:00:00.000Z', von: 'person-a' } });
    try {
      const ids = (await faellig(jetzt)).map(f => f.id);
      expect(ids).toContain('tagesstart');
      expect(ids).not.toContain('morgen');
      expect(ids.some(i => i.startsWith('tageslauf'))).toBe(false);
    } finally {
      await db.saveJson('agenten-einstellung--probe-haus', { v: 1, heads: {} });
    }
  });

  it('läuft der Morgenlauf gerade (Riegel), wird er nicht noch einmal eingereiht', async () => {
    const { faellig } = await import('@/lib/zoe/takt');
    const jetzt = new Date('2026-10-09T05:30:00Z'); // 07:30 Berlin
    await db.saveJson('tagesstart', { lastRun: '2026-10-08', laeuft: { tag: '2026-10-09', seit: '2026-10-09T05:25:00Z' } });
    await db.saveJson('zoe-auftraege', { auftraege: [] });
    expect((await faellig(jetzt)).map(f => f.id)).not.toContain('tagesstart');
  });

  it('der Tageslauf des Takts läuft für den Inhaber (aus den Konten) — sonst übersprang er die Post', async () => {
    const { faellig } = await import('@/lib/zoe/takt');
    const jetzt = new Date('2026-10-09T09:30:00Z'); // 11:30 Berlin
    await db.saveJson('tagesstart', { lastRun: '2026-10-09' });
    await db.saveJson('zoe-auftraege', { auftraege: [] });
    const tl = (await faellig(jetzt)).find(f => f.auftrag.name === 'tageslauf');
    expect(tl?.auftrag.person).toBe('person-a');
  });
});

// ── 5. CRM-Signale im Takt ─────────────────────────────────────────────────────────────────────────────────────────────
describe('CRM-Signale laufen im Takt (Systemlauf), gestaffelt und idempotent', () => {
  it('ohne iCloud-Job im Takt: läuft, hängt den Termin an, zweiter Takt „frisch“, erneuter Lauf legt nichts doppelt an', async () => {
    const { crmSignaleImTakt, signaleLauf } = await import('@/lib/crm/signale-server');
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe-walter', vorname: 'Walter', nachname: 'Probemann', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
    await db.saveJson('calendar-cache', { at: '2026-10-09T08:00:00Z', events: [{ id: 'k1|t-probe', uid: 't-probe', title: 'Walter Probemann Review', startDate: '2026-10-08T09:00:00Z', category: 'holding' }] });
    const jetzt = new Date('2026-10-09T08:30:00Z');
    expect(await crmSignaleImTakt('abgleich', jetzt)).toBe('wartet'); // iCloud-Job in diesem Takt → nicht auch noch das
    expect(await crmSignaleImTakt('wartet', jetzt)).toBe('wartet');
    expect(await crmSignaleImTakt('spiegel', jetzt)).toBe('gelaufen');
    const k = (await db.loadJson<{ kontakte: { id: string; aktivitaeten: unknown[]; letzterKontakt?: string }[] }>('kontakte'))!.kontakte[0];
    expect(k.aktivitaeten).toHaveLength(1);
    expect(k.letzterKontakt).toBe('2026-10-08');
    expect(await crmSignaleImTakt('spiegel', new Date('2026-10-09T08:35:00Z'))).toBe('frisch');
    const r = await signaleLauf({ wer: { art: 'system' }, erzwingen: true, jetzt: new Date('2026-10-09T08:50:00Z') });
    expect(r).toMatchObject({ neu: 0 });
  });
  it('der Takt (Route) stößt den Lauf an — und die Route der Oberfläche nimmt DENSELBEN Lauf', () => {
    const takt = readFileSync(path.resolve(__dirname, '..', 'app/api/zoe/takt/route.ts'), 'utf8');
    expect(takt).toMatch(/crmSignaleImTakt\(kalenderJob\)/);
    const route = readFileSync(path.resolve(__dirname, '..', 'app/api/crm/signale/route.ts'), 'utf8');
    expect(route).toMatch(/signaleLauf\(/);
    expect(route).not.toMatch(/aendereKontakte/); // kein zweiter Lauf daneben
  });
});

// ── 6. Zeitzone: Heads und Head of Finance in Berliner Wandzeit ─────────────────────────────────────────────────────────
describe('Heads und Head of Finance rechnen in Berliner Wandzeit — auch auf einer Maschine in UTC', () => {
  it('Freitag 14:30 Berlin (12:30 UTC) ist Wochenreview-Zeit, Montag 00:30 Berlin ist Montag', async () => {
    process.env.TZ = 'UTC';
    const { faelligeModi } = await import('@/lib/heads/takt');
    const { leererStand } = await import('@/lib/heads/stand');
    expect(faelligeModi('sales', new Date('2026-10-16T12:30:00Z'), leererStand(), []).map(m => m.modus)).toEqual(['wochenreview']);
    // Sonntag 23:30 UTC = Montag 01:30 Berlin: kein Wochenreview, kein Lead-Review vor 9 Uhr
    expect(faelligeModi('sales', new Date('2026-10-18T23:30:00Z'), leererStand(), [])).toEqual([]);
  });

  it('„lief heute“ zählt den Berliner Tag des Zeitstempels (00:30 MESZ ist schon der neue Tag)', async () => {
    const { faelligeModi } = await import('@/lib/heads/takt');
    const { leererStand } = await import('@/lib/heads/stand');
    const s = { ...leererStand(), letzte: { wochenreview: '2026-10-15T22:30:00Z' } }; // = Fr 16.10. 00:30 Berlin
    expect(faelligeModi('sales', new Date('2026-10-16T13:00:00Z'), s, [])).toEqual([]);
  });

  it('Head of Finance: Wochentag/Stunde aus Berlin, „heute schon“ nach Berliner Tag', async () => {
    process.env.TZ = 'UTC';
    const { berlinerUhr } = await import('@/lib/finanzen/chef/takt');
    expect(berlinerUhr(new Date('2026-10-05T22:30:00Z'))).toEqual({ wochentag: 2, stunde: 0 }); // Di 00:30 Berlin
    expect(berlinerUhr(new Date('2026-12-31T23:30:00Z'))).toEqual({ wochentag: 5, stunde: 0 }); // Fr 01.01.2027 00:30 (Winterzeit)
    const { faelligerModus } = await import('@/lib/finanzen/chef/plan');
    const { leererStand } = await import('@/lib/finanzen/chef/stand');
    const s = { ...leererStand(), berichte: [{ modus: 'monatsabschluss', monat: '2026-09' }] as unknown as ReturnType<typeof leererStand>['berichte'], letzte: { wochenreview: '2026-10-05T08:00:00Z', tagescheck: '2026-10-05T22:30:00Z' } };
    expect(faelligerModus(s, '2026-10-06', 2, 9, [], new Date('2026-10-06T07:00:00Z'))).toBeNull();
  });
});

// ── 7. Verpasste Läufe einmal nachholen ────────────────────────────────────────────────────────────────────────────────
describe('Verpasste Wochen-/Monatsläufe: einmal nachholen', () => {
  it('Heads: Wochenreview verpasst (App aus) → Samstag einmal nachgeholt; nie gelaufen (neue Instanz) → nicht', async () => {
    const { faelligeModi } = await import('@/lib/heads/takt');
    const { leererStand } = await import('@/lib/heads/stand');
    const sa = new Date('2026-10-17T08:00:00Z'); // Sa 10:00 Berlin
    const eingefuehrt = { ...leererStand(), letzte: { wochenreview: '2026-10-09T13:00:00Z' } };
    expect(faelligeModi('sales', sa, eingefuehrt, [])).toEqual([{ modus: 'wochenreview', grund: 'Wochenreview Vertrieb (nachgeholt — verpasst)' }]);
    expect(faelligeModi('sales', sa, { ...eingefuehrt, letzte: { wochenreview: '2026-10-17T08:05:00Z' } }, [])).toEqual([]);
    expect(faelligeModi('sales', sa, leererStand(), [])).toEqual([]);
  });

  it('Skill wöchentlich (Mo 09:00): Montag verpasst → Mittwoch einmal; täglich/neu/geändert → nicht', async () => {
    const z = await import('@/lib/agenten/zeitplan');
    const k = (id: string, regel: import('@/lib/agenten/zeitplan').ZeitRegel, seit?: string) => ({
      art: 'skill' as const, id, headId: 'assistenz', bereich: 'privat' as const, person: 'person-a', regel,
      eingabe: { art: 'skill' as const, skillId: id, headId: 'assistenz', ausloeser: 'zeitplan' as const }, ...(seit ? { seit } : {}),
    });
    const woche = { art: 'wiederkehrend' as const, rhythmus: 'woechentlich' as const, uhrzeit: '09:00', tage: [1] };
    const lauf = (id: string, zeit: string) => ({ name: 'faden', zeit, tag: zeit.slice(0, 10), status: 'fertig', anlass: 'Takt: Agenten-Zeitplan', eingabe: { art: 'skill', skillId: id } });
    const lage = (auftraege: ReturnType<typeof lauf>[]) => ({ jetzt: new Date('2026-10-14T08:00:00Z'), kiHintergrund: true, frei: () => [], auftraege, faeden: [] });
    // Vorwoche lief (eingeführt), Mo 12.10. verpasst → Mi 14.10. 10:00 Berlin einmal nachgeholt
    const r = z.zeitplaeneFaelligRein([k('sk-w', woche)], lage([lauf('sk-w', '2026-10-05T07:01:00Z')]));
    expect(r).toHaveLength(1);
    expect(r[0].grund).toContain('nachgeholt');
    // schon nachgeholt → nicht noch einmal
    expect(z.zeitplaeneFaelligRein([k('sk-w', woche)], lage([lauf('sk-w', '2026-10-05T07:01:00Z'), lauf('sk-w', '2026-10-13T08:00:00Z')]))).toEqual([]);
    // nie gelaufen (neuer Skill) → nichts „nachholen“
    expect(z.zeitplaeneFaelligRein([k('sk-neu', woche)], lage([]))).toEqual([]);
    // Zeitplan nach dem Slot geändert → nicht
    expect(z.zeitplaeneFaelligRein([k('sk-w', woche, '2026-10-13T10:00:00Z')], lage([lauf('sk-w', '2026-10-05T07:01:00Z')]))).toEqual([]);
    // täglich holt wie bisher nur am selben Tag nach
    const taeglich = { art: 'wiederkehrend' as const, rhythmus: 'taeglich' as const, uhrzeit: '21:00' };
    expect(z.zeitplaeneFaelligRein([k('sk-t', taeglich)], lage([lauf('sk-t', '2026-10-12T19:01:00Z')]))).toEqual([]);
  });
});

// ── 9. Lagebild: Morgenlauf und Freigabe-Listen ────────────────────────────────────────────────────────────────────────
describe('Head of IT: Befunde für die neuen Riegel', () => {
  it('Morgenlauf hakt → rot, scheitert → gelb; Freigabe-Liste voll → rot', async () => {
    const { taktRobustBefunde } = await import('@/lib/hoi/lage');
    const w = { gesamt: 10, aktiv: 1, grenze: 2000, abgelehntHeute: 0 };
    expect(taktRobustBefunde({ warteschlange: w, sperreLesbar: true, tagesstart: { fehlversuche: 3, laeuft: false, umgangen: true }, headsVoll: [] }).find(b => b.id === 'morgenlauf')?.ampel).toBe('rot');
    expect(taktRobustBefunde({ warteschlange: w, sperreLesbar: true, tagesstart: { fehlversuche: 1, laeuft: false, umgangen: false }, headsVoll: [] }).find(b => b.id === 'morgenlauf')?.ampel).toBe('gelb');
    expect(taktRobustBefunde({ warteschlange: w, sperreLesbar: true, tagesstart: null, headsVoll: [{ head: 'sales', abgelehnt: 3 }] }).find(b => b.id === 'heads-voll:sales')?.ampel).toBe('rot');
    expect(taktRobustBefunde({ warteschlange: w, sperreLesbar: true, tagesstart: null, headsVoll: [] }).map(b => b.id)).toEqual(['warteschlange']);
  });
});
