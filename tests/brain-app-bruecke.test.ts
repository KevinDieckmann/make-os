// ─── App → Brain (29.09., B2–B4): Tagesbericht, _App-Spiegel, Such-Index app_chunks, suche_arbeit, gatherBrain ─────
// Leitplanken: nur in einen konfigurierten Server-Vault (hier ein Temp-Ordner, nie der Mac-Vault), keine Art.-18-Kontakte,
// keine „nur ich“-Aufgaben, kein Papierkorb, Privat-Space standardmäßig nur als Zahl, Sicht vor dem Ranking,
// idempotent je Tag, von Hand angelegte Dateien bleiben unberührt. Eigener Datenordner, erfundene Daten, kein Modell.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-bruecke-'));
const vault = path.join(wurzel, 'Make.Claude');
const daten = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-bruecke-daten-'));
await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true }); await fs.mkdir(vault, { recursive: true });
process.env.MAKE_VAULT_DIR = vault; process.env.MAKE_OS_DOKU_WURZEL = 'aus'; process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_BRAIN_INDEX = path.join(daten, 'brain-index.sqlite'); process.env.MAKE_OS_EMBEDDINGS = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-bruecke';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL; delete process.env.ANTHROPIC_API_KEY; delete process.env.MAKE_OS_APP_SPIEGEL; delete process.env.MAKE_OS_ADRESSE;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const { localDay } = await import('@/lib/zeit');
const H = localDay();
const J = new Date().toISOString();
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const aufgabe = (id: string, title: string, x: Record<string, unknown> = {}) => ({ id, projectId: 'p-web', title, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: J, updatedAt: J, spaceId: 'kdv', ...x });   // 05.10.: KD Ventures (die Selbstständigkeit gehört seit 05.10. zu Privat)

let db: typeof import('@/lib/store/local-db');
let B: typeof import('@/lib/brain/app-bericht');
let S: typeof import('@/lib/brain/app-spiegel');
let A: typeof import('@/lib/brain/app-index');
let V: typeof import('@/lib/brain/vault-ziel');
const lesen = (rel: string) => fs.readFile(path.join(vault, rel), 'utf8');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'gast', 'mitglied', 'anders')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-offen-1', vorname: 'Olga', nachname: 'Offen', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' },
    { id: 'c-gesperrt-1', vorname: 'Gero', nachname: 'Gesperrt', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', eingeschraenkt: { seit: '2026-09-10', grund: 'Antrag', von: 'kevin' } },
  ] });
  await db.saveJson('tasks', {
    projects: [
      { id: 'p-web', title: 'Webseite Relaunch', category: 'business', owner: 'kevin', color: '#fff', tags: [], archived: false, spaceId: 'kdv', notiz: 'Leitidee: Zeitlupe als Bildsprache.', createdAt: J, updatedAt: J },
      { id: 'p-haus', title: 'Umzug Keller', category: 'joint', owner: 'kevin', color: '#fff', tags: [], archived: false, spaceId: 'privat', notiz: 'PRIVAT-NOTIZ Kellerschlüssel', createdAt: J, updatedAt: J },
    ],
    tasks: [
      aufgabe('t-fertig', 'Startseite abnehmen', { status: 'done', completedAt: J, description: 'Farbwelt Petrol prüfen', kommentare: [{ id: 'k1', von: 'malin', text: 'Bitte Kontrast Mondlicht beachten', am: J }] }),
      aufgabe('t-offen', 'Impressum ergänzen', { dueDate: '2026-10-15' }),
      aufgabe('t-unter', 'Unteraufgabe Logo', { parentId: 't-offen' }),
      aufgabe('t-privat', 'Keller ausräumen PRIVATTITEL', { projectId: 'p-haus', spaceId: 'privat', status: 'done', completedAt: J }),
      aufgabe('t-art18', 'Anruf GESPERRTTITEL', { status: 'done', completedAt: J, bezug: { kontaktId: 'c-gesperrt-1' } }),
      aufgabe('t-nurich', 'NURICHTITEL Geschenk', { status: 'done', completedAt: J, sichtbarkeit: 'nur-ich' }),
      aufgabe('t-muell', 'PAPIERKORBTITEL alt', { status: 'done', completedAt: J, geloeschtAm: J }),
    ],
    listen: [], statusEigen: [], gruppen: [], vorlagen: [],
  });
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    firmen: [{ id: 'f-probe', name: 'Probe AG', rolle: 'kunde', geaendert: J, zahlung: { weg: 'ueberweisung', iban: 'IBAN-GEHEIM-TEST' } }],
    mandate: [
      { id: 'm-probe', kunde: 'Probe AG', firmaId: 'f-probe', kontaktIds: ['c-offen-1'], titel: 'Strategie-Retainer', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, start: H, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J },
      { id: 'm-gesperrt', kunde: 'Sperr GmbH', kontaktIds: ['c-gesperrt-1'], titel: 'SPERRMANDAT', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, start: H, verlaengerung: 'offen', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J },
    ],
    angebote: [{ id: 'ang-1', gesellschaft: 'kdc', firmaId: 'f-probe', mandatId: 'm-probe', titel: 'Diagnose Zeitlupe', positionen: [], einleitung: 'Wir schlagen eine Diagnose vor.', schluss: '', gueltigBis: '2026-10-31', zahlungszielTage: 14, status: 'gestellt', version: 1, nummer: 'A-2026-001', gestelltAm: J, angelegt: J, geaendert: J }],
  });
  B = await import('@/lib/brain/app-bericht');
  S = await import('@/lib/brain/app-spiegel');
  A = await import('@/lib/brain/app-index');
  V = await import('@/lib/brain/vault-ziel');
  // Eine ZOE-Entscheidung von heute.
  const stapel = await import('@/lib/zoe/stapel');
  const v = await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Fokusblock Mittwoch', nachher: 'x', eingabe: { tag: H }, person: 'kevin' });
  await stapel.entscheide(v.id, 'abgelehnt', { von: 'kevin', grund: 'lieber Donnerstag' });
});
afterAll(async () => { (await import('@/lib/brain/index')).schliesseIndex(); await fs.rm(wurzel, { recursive: true, force: true }); await fs.rm(daten, { recursive: true, force: true }); });

describe('Wohin geschrieben werden darf', () => {
  it('ohne MAKE_VAULT_DIR nichts; nie in einen Vault auf dem Mac; der Spiegel braucht MAKE_OS_APP_SPIEGEL=an', () => {
    const vorher = process.env.MAKE_VAULT_DIR;
    delete process.env.MAKE_VAULT_DIR;
    expect(V.vaultZiel().ok).toBe(false);
    process.env.MAKE_VAULT_DIR = path.join(os.homedir(), 'Desktop', 'MAKE', 'Make.Claude');
    expect(V.vaultZiel()).toMatchObject({ ok: false });
    process.env.MAKE_VAULT_DIR = path.join(os.homedir(), 'Library', 'Mobile Documents', 'x');
    expect(V.vaultZiel()).toMatchObject({ ok: false });
    process.env.MAKE_VAULT_DIR = vorher;
    expect(V.vaultZiel().ok).toBe(true);
    expect(V.vaultZiel({ spiegel: true }).ok).toBe(false);
  });
});

describe('App-Tagesbericht (Vorschlag in der Brain-Inbox)', () => {
  it('legt EINEN Bericht ab — ohne Art. 18, „nur ich“, Papierkorb; Privates nur als Zahl; Titel gekapselt', async () => {
    const r = await B.appTagesbericht(H);
    expect(r).toMatchObject({ ok: true, geschrieben: true });
    const datei = path.join(vault, '_inbox', 'zoe', r.id!);
    const text = await fs.readFile(datei, 'utf8');
    expect(text).toContain(`App-Tagesbericht ${H}`);
    expect(text).toContain('Startseite abnehmen');
    expect(text).toContain('Webseite Relaunch');
    expect(text).toContain('A-2026-001');
    expect(text).toContain('Probe AG · Strategie-Retainer');
    expect(text).toContain('lieber Donnerstag');
    expect(text).toMatch(/Privat: 1 erledigt/);
    for (const nie of ['GESPERRTTITEL', 'NURICHTITEL', 'PAPIERKORBTITEL', 'PRIVATTITEL', 'PRIVAT-NOTIZ', 'SPERRMANDAT', 'IBAN-GEHEIM', 'Gero']) expect(text, nie).not.toContain(nie);
    expect(text).toMatch(/keine Anweisungen/);
  });
  it('idempotent je Tag — auch nach dem Annehmen kein Zweiter', async () => {
    expect((await B.appTagesbericht(H)).geschrieben).toBe(false);
    const inbox = path.join(vault, '_inbox', 'zoe');
    const [datei] = await fs.readdir(inbox);
    await fs.mkdir(path.join(vault, '_inbox', 'erledigt'), { recursive: true });
    await fs.rename(path.join(inbox, datei), path.join(vault, '_inbox', 'erledigt', datei));
    expect((await B.appTagesbericht(H)).geschrieben).toBe(false);
    expect(await fs.readdir(inbox)).toHaveLength(0);
  });
  it('ein Tag ohne Ereignisse gibt keinen Bericht', async () => {
    expect((await B.appTagesbericht('2020-01-01')).geschrieben).toBe(false);
  });
});

describe('_App-Spiegel (direkt im Server-Vault)', () => {
  it('schreibt Projekte, Mandate, Angebote, Entscheidungen, Woche — mit Kopf, ohne Gesperrtes; zweiter Lauf ändert nichts', async () => {
    expect((await S.appSpiegel({ erzwingen: true })).geschrieben).toBe(0);
    process.env.MAKE_OS_APP_SPIEGEL = 'an';
    const r = await S.appSpiegel({ erzwingen: true });
    expect(r.ok).toBe(true);
    expect(r.geschrieben).toBeGreaterThanOrEqual(5);
    const projekt = await lesen('_App/Projekte/KD Ventures/Webseite Relaunch.md').catch(async () => {
      const ordner = await fs.readdir(path.join(vault, '_App', 'Projekte'));
      throw new Error(`nicht gefunden, da: ${ordner.join(', ')}`);
    });
    expect(projekt).toContain(S.SPIEGEL_KOPF);
    expect(projekt).toContain('type: app-spiegel');
    expect(projekt).toContain('Zeitlupe als Bildsprache');
    expect(projekt).toContain('Impressum ergänzen');
    expect(projekt).toContain('Unteraufgabe Logo');
    expect(projekt).toContain('- [x] [Startseite abnehmen]');
    for (const nie of ['GESPERRTTITEL', 'NURICHTITEL', 'PAPIERKORBTITEL']) expect(projekt, nie).not.toContain(nie);
    const privat = await lesen('_App/Projekte/Privat.md');
    expect(privat).toMatch(/Projekte: 1/);
    expect(privat).not.toContain('PRIVATTITEL');
    await expect(fs.access(path.join(vault, '_App', 'Projekte', 'Privat', 'Umzug Keller.md'))).rejects.toThrow();
    const mandat = await lesen('_App/Mandate/Probe AG.md');
    expect(mandat).toContain('Strategie-Retainer');
    expect(mandat).toContain('A-2026-001');
    expect(mandat).not.toContain('IBAN');
    const alle = JSON.stringify(await Promise.all((await fs.readdir(path.join(vault, '_App', 'Mandate'))).map(f => lesen(`_App/Mandate/${f}`))));
    expect(alle).not.toContain('SPERRMANDAT');
    expect(await lesen('_App/Angebote.md')).toContain('Diagnose Zeitlupe');
    expect(await lesen(`_App/Entscheidungen/${H.slice(0, 7)}.md`)).toContain('lieber Donnerstag');
    const woche = (await fs.readdir(path.join(vault, '_App', 'Woche')))[0];
    expect(await lesen(`_App/Woche/${woche}`)).toContain('Startseite abnehmen');
    // F2 H1: ohne Einwilligung steht von keiner Person Zeit im gemeinsamen Vault.
    expect(await lesen(`_App/Woche/${woche}`)).not.toContain('# Zeit —');
    const { zeitFreigabeSetzen, einstellungLesen } = await import('@/lib/brain/app-material');
    await zeitFreigabeSetzen('haus', 'kevin', true);
    // Der Riegel kennt die Einwilligung (brain-bruecke) — ohne `erzwingen` läuft der Spiegel neu.
    expect((await S.appSpiegel()).text).not.toBe('Spiegel aktuell.');
    expect(await lesen(`_App/Woche/${woche}`)).toContain('# Zeit — kevin');
    expect(await lesen(`_App/Woche/${woche}`)).not.toContain('# Zeit — malin');
    // Neuer Fokus-Block von Kevin (Bestand `zeit`) → Riegel ändert sich; Malins Zeit ändert ihn nicht (keine Einwilligung).
    expect((await S.appSpiegel()).text).toBe('Spiegel aktuell.');
    await db.saveJson('zeit--malin', { tage: {} });
    expect((await S.appSpiegel()).text).toBe('Spiegel aktuell.');
    await db.saveJson('zeit', { tage: {} });
    expect((await S.appSpiegel()).text).not.toBe('Spiegel aktuell.');
    await zeitFreigabeSetzen('haus', 'malin', true);
    await S.appSpiegel();
    // Die Privat-Stufe ändern lässt die Einwilligungen stehen.
    const { einstellungSetzen } = await import('@/lib/brain/app-material');
    await einstellungSetzen('haus', 'anzahl', 'kevin');
    expect((await einstellungLesen('haus')).zeitFreigabe).toEqual(['kevin', 'malin']);
    // K6a (29.09.): Zeit der Woche je Person aus `auswertungMarkdown` — nur Zahlen, keine Kontakte.
    const wocheText = await lesen(`_App/Woche/${woche}`);
    expect(wocheText).toContain('# Zeit — kevin');
    expect(wocheText).toContain('# Zeit — malin');
    expect(wocheText).toMatch(/- Meetings: 0 h/);
    expect(wocheText).not.toContain('Meistbesuchte Kontakte');
    expect(wocheText).not.toContain('# Zeit — gast');
    const nochmal = await S.appSpiegel({ erzwingen: true });
    expect(nochmal.geschrieben).toBe(0);
    expect((await S.appSpiegel()).text).toBe('Spiegel aktuell.');
  });
  it('von Hand angelegte Dateien bleiben; verwaiste Spiegel fallen weg; Privat „voll“ legt Privat-Projekte an', async () => {
    await fs.writeFile(path.join(vault, '_App', 'Angebote.md'), '# Meine eigene Notiz\n', 'utf8');
    await fs.writeFile(path.join(vault, '_App', 'Projekte', 'KD Ventures', 'Alt.md'), '---\ntype: app-spiegel\n---\n# Alt\n', 'utf8');
    const { einstellungSetzen } = await import('@/lib/brain/app-material');
    await einstellungSetzen('haus', 'voll', 'kevin');
    const r = await S.appSpiegel({ erzwingen: true });
    // Alt.md (verwaist) und Privat.md (bei „voll“ gibt es statt der Zahlen die Projekte selbst).
    expect(r.entfernt).toBe(2);
    await expect(fs.access(path.join(vault, '_App', 'Projekte', 'KD Ventures', 'Alt.md'))).rejects.toThrow();
    expect(await lesen('_App/Angebote.md')).toBe('# Meine eigene Notiz\n');
    const privat = await lesen('_App/Projekte/Privat/Umzug Keller.md');
    expect(privat).toContain('scope: privat');
    expect(privat).toContain('PRIVATTITEL');
    await einstellungSetzen('haus', 'anzahl', 'kevin');
    await fs.unlink(path.join(vault, '_App', 'Angebote.md'));
    await S.appSpiegel({ erzwingen: true });
    await expect(fs.access(path.join(vault, '_App', 'Projekte', 'Privat', 'Umzug Keller.md'))).rejects.toThrow();
    delete process.env.MAKE_OS_APP_SPIEGEL;
  });
});

describe('Such-Index app_chunks + suche_arbeit', () => {
  it('Sicht vor dem Ranking: Haushalt, Privat nur mit Recht; Gesperrtes gar nicht im Index', async () => {
    const l = await A.appIndexAktualisieren(true);
    expect(l.neu).toBeGreaterThan(0);
    expect(A.appSuche('Zeitlupe', { haushalt: 'haus', privat: true }).treffer.map(t => t.art).sort()).toEqual(['angebot', 'projekt']);
    expect(A.appSuche('Mondlicht', { haushalt: 'haus', privat: true }).treffer[0]).toMatchObject({ art: 'kommentar', refId: 't-fertig' });
    expect(A.appSuche('Kellerschlüssel', { haushalt: 'haus', privat: true }).treffer).toHaveLength(1);
    expect(A.appSuche('Kellerschlüssel', { haushalt: 'haus', privat: false }).treffer).toHaveLength(0);
    expect(A.appSuche('Zeitlupe', { haushalt: 'anders', privat: true }).treffer).toHaveLength(0);
    for (const nie of ['GESPERRTTITEL', 'NURICHTITEL', 'PAPIERKORBTITEL', 'SPERRMANDAT']) expect(A.appSuche(nie, { haushalt: 'haus', privat: true }).treffer, nie).toHaveLength(0);
  });
  it('inkrementell: unverändert → übersprungen; eine geänderte Aufgabe → genau eine Zeile neu; Neubau jederzeit', async () => {
    expect((await A.appIndexAktualisieren()).uebersprungen).toBe(true);
    await db.updateJson<{ tasks: { id: string; notiz?: string }[] }>('tasks', c => ({ ...c!, tasks: c!.tasks.map(t => (t.id === 't-offen' ? { ...t, notiz: 'Handelsregister Nummer Bergkristall' } : t)) }));
    const l = await A.appIndexAktualisieren();
    expect(l).toMatchObject({ uebersprungen: false, geaendert: 1, neu: 0, entfernt: 0 });
    expect(A.appSuche('Bergkristall', { haushalt: 'haus', privat: false }).treffer[0].link).toBe('/os/aufgaben?offen=t-offen');
    const n = await A.appIndexNeuBauen();
    expect(n.neu).toBe(A.appIndexStand().zeilen);
  });
  it('suche_arbeit: eine Suche über App und Brain, gekapselt, nur im Haushalt', async () => {
    await fs.mkdir(path.join(vault, '03. Protokolle'), { recursive: true });
    await fs.writeFile(path.join(vault, '03. Protokolle', 'Bergkristall Treffen.md'), '---\ntype: protokoll\nscope: intern\n---\n# Bergkristall Treffen\n\nWir sprachen über Bergkristall.\n', 'utf8');
    (await import('@/lib/zoe/vault')).bestandVergessen();
    await (await import('@/lib/brain/index')).aktualisieren(true);
    const W = await import('@/lib/zoe/werkzeuge');
    const aus = await W.WERKZEUGE.suche_arbeit.lauf({ frage: 'Bergkristall' }, 'http://test', 'malin');
    expect(aus.split('\n')[0]).toMatch(/^SUCHE · 2 Treffer/);
    expect(aus).toContain('<fremde_daten');
    expect(aus).toContain('/os/aufgaben?offen=t-offen');
    expect(aus).toContain('[Brain] Bergkristall Treffen');
    // Der generierte Spiegel steht nicht im Vault-Index (sonst doppelt).
    expect(aus).not.toContain('_App/');
    expect(await W.WERKZEUGE.suche_arbeit.lauf({ frage: 'Bergkristall' }, 'http://test', 'gast')).toMatch(/^Nicht ausgeführt/);
    expect(await W.WERKZEUGE.suche_arbeit.lauf({ frage: 'Bergkristall' }, 'http://test')).toMatch(/^Nicht ausgeführt/);
    const { REGISTER } = await import('@/lib/zoe/register');
    expect(REGISTER.suche_arbeit.risiko).toBe('frei');
  });
});

describe('gatherBrain + mandate_lage (B4)', () => {
  it('nur Hauptaufgaben, ohne Papierkorb; fremder Haushalt bekommt keine Aufgaben', async () => {
    const brain = await import('@/lib/brain');
    const b = await brain.gatherBrain(H, 'kevin');
    const ids = b.tasks.alle.map(t => t.id);
    expect(ids).toContain('t-offen');
    expect(ids).not.toContain('t-unter');
    expect(ids).not.toContain('t-muell');
    expect((await brain.gatherBrain(H, 'gast')).tasks.alle).toHaveLength(0);
  });
  it('mandate_lage zeigt die Zeit je Mandat der Woche', async () => {
    const { speicherFuer } = await import('@/lib/zoe/raum');
    const von = new Date(Date.now() - 2 * 3600_000).toISOString(), bis = new Date(Date.now() - 3600_000).toISOString();
    await db.saveJson(speicherFuer('zeit', 'kevin'), { tage: { [H]: { auto: {}, bewusst: { 'business:crm': 5400 }, bloecke: [{ von, bis, schluessel: 'business:crm', label: 'CRM', sek: 5400, mandatId: 'm-probe', firmaId: 'f-probe', einheit: 'kdc' }] } } });
    const W = await import('@/lib/zoe/werkzeuge');
    const aus = await W.WERKZEUGE.mandate_lage.lauf({}, 'http://test', 'kevin');
    expect(aus).toMatch(/Zeit KW \d+ \(.+\): 1,5 h mit Mandat/);
    expect(aus).toContain('Zeit diese Woche: 1,5 h (1 Blöcke)');
  });
});
