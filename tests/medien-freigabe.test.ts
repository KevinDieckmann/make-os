// ─── Medien: Freigabe fürs Marketing, Personen im Bild, Einwilligung/Widerruf, Art. 18, Ablauf, Heads, Fristen, Konto löschen ────
// Kevin 09.10.: Freigabe nur Marketing-Verantwortliche bzw. volles Mitglied, bei erkennbaren Personen Vier-Augen · Kanäle + bis-Datum, danach
// gesperrt + Aufgabe · fremde Fotografen nur mit Lizenz-Nachweis · Porträts/nicht öffentliche Events nur mit Einwilligung · Minderjährige nie
// ohne Eltern · Widerruf sperrt sofort · Heads nur, was ausdrücklich „an Head gegeben“ ist · Rohmaterial mit Personen → Prüf-Aufgabe nach
// 12 Monaten · Papierkorb 30 Tage · Art. 17 → sperren + Prüfung. Erfundene Konten/Kontakte, eigene Ordner, kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { KONTEN, jpeg, png, rufe, routen, hochladen, type Routen } from './fixtures/medien-hilfen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-medien-freigabe-'));
  process.env.MAKE_OS_DATEN_DIR = p.join(o, 'daten');
  process.env.MAKE_OS_MEDIEN_DIR = p.join(o, 'medien');
  process.env.MAKE_OS_KEY = 'pruef-schluessel-medien-freigabe';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.MAKE_OS_MEDIEN_S3_ENDPUNKT;
  return o;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const K_OFFEN = 'c-11111111-1111-4111-8111-111111111111';
const K_ART18 = 'c-22222222-2222-4222-8222-222222222222';
const K_HAUPT = 'c-33333333-3333-4333-8333-333333333333';

let r: Routen;
const tun = (p: string, j: Record<string, unknown>) => rufe(r.liste, 'POST', '/api/medien', p, { json: j });
const liste = async (p: string) => (await rufe(r.liste, 'GET', '/api/medien', p)).json as { medien: { id: string; marketing: { status: string; wirksam: string; wirksamGrund?: string } }[]; einwilligungen: { id: string }[] };
const heute = () => new Date().toISOString().slice(0, 10);
const inTagen = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    { id: K_OFFEN, vorname: 'Erika', nachname: 'Beispiel', stufe: 'kontakt', aktivitaeten: [] },
    { id: K_ART18, vorname: 'Max', nachname: 'Muster', stufe: 'kontakt', aktivitaeten: [], eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'person-a' } },
    { id: K_HAUPT, vorname: 'Lena', nachname: 'Probe', stufe: 'kontakt', aktivitaeten: [] },
  ] });
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel GmbH', anschrift: 'Musterweg 1, 12345 Musterstadt', mail: 'datenschutz@example.invalid' } });
  r = await routen();
});

async function eventAlbum(oeffentlich: boolean): Promise<string> {
  const a = await tun('person-b', { aktion: 'album-anlegen', bereich: 'business', art: 'event', bezugId: `ev-test-${oeffentlich ? 'oeff' : 'zu'}`, titel: 'Testabend', oeffentlich });
  return String((a.json.album as { id: string }).id);
}

describe('Freigabe fürs Marketing', () => {
  it('ohne Personen: ein volles Mitglied gibt frei (Kanäle + bis-Datum Pflicht); „nur Business“ ohne Marketing-Rolle darf nicht', async () => {
    const { medium } = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein' } });
    expect((await tun('person-b', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: [], bis: inTagen(30) })).status).toBe(400);
    expect((await tun('person-b', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['website'], bis: heute() })).status).toBe(400);
    expect((await tun('partner', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['website'], bis: inTagen(30) })).status).toBe(403);
    const ok = await tun('person-b', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['website', 'social'], bis: inTagen(30) });
    expect(ok.status).toBe(200);
    expect((ok.json.medium as { marketing: { wirksam: string; freigegebenVon: string } }).marketing).toMatchObject({ wirksam: 'freigegeben', freigegebenVon: 'person-b' });
  });

  it('Pflichtfrage „erkennbare Personen“; „unklar“ geht nie hinaus; Ortsdaten nicht entfernt → nie', async () => {
    const { medium } = await hochladen(r, 'person-b');
    const f = (id: unknown) => tun('person-a', { aktion: 'freigabe', id, schritt: 'freigeben', kanaele: ['website'], bis: inTagen(30) });
    expect((await f(medium.id)).json.fehler).toMatch(/erkennbar/);
    await tun('person-b', { aktion: 'aendern', id: medium.id, erkennbarePersonen: 'unklar' });
    expect((await f(medium.id)).json.fehler).toMatch(/unklar/);
    const gps = await hochladen(r, 'person-b', { bytes: jpeg(3000, { exif: true }), anlegen: { erkennbarePersonen: 'nein' } });
    expect((await f(gps.medium.id)).json.fehler).toMatch(/Ortsdaten/);
  });

  it('Vier-Augen bei erkennbaren Personen: anfragen, und eine ANDERE Person gibt frei (öffentliches Event, Beiwerk)', async () => {
    const album = await eventAlbum(true);
    const { medium } = await hochladen(r, 'person-b', { album });
    expect((await tun('person-b', { aktion: 'person-markieren', id: medium.id, person: { art: 'kontakt', kontaktId: K_OFFEN, rolle: 'beiwerk' } })).status).toBe(200);
    const frei = (p: string) => tun(p, { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['website'], bis: inTagen(60) });
    expect((await frei('person-b')).status).toBe(409); // erst anfragen
    expect((await tun('person-b', { aktion: 'freigabe', id: medium.id, schritt: 'anfragen', kanaele: ['website'], bis: inTagen(60) })).status).toBe(200);
    expect((await frei('person-b')).status).toBe(403); // nie allein, wer angefragt hat
    expect((await frei('person-a')).status).toBe(200);
  });

  it('Porträt / nicht öffentliche Veranstaltung nur mit Einwilligung; Minderjährige nur mit Sorgeberechtigten; Widerruf sperrt sofort + Aufgabe', async () => {
    const album = await eventAlbum(false);
    const { medium } = await hochladen(r, 'person-b', { album });
    await tun('person-b', { aktion: 'person-markieren', id: medium.id, person: { art: 'kontakt', kontaktId: K_HAUPT, rolle: 'haupt' } });
    await tun('person-b', { aktion: 'freigabe', id: medium.id, schritt: 'anfragen', kanaele: ['website', 'social'], bis: inTagen(60) });
    const frei = () => tun('person-a', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['website', 'social'], bis: inTagen(60) });
    expect((await frei()).json.fehler).toMatch(/Einwilligung/);
    // Einwilligung festhalten (Unterschrift am Handy, Wortlaut vom Server, Fassung geprüft).
    const v = await rufe(r.liste, 'GET', '/api/medien?vorlage=einwilligung&zwecke=website', 'person-a');
    expect(v.json.wortlaut).toContain('Beispiel GmbH');
    const nurWebsite = await tun('person-a', { aktion: 'einwilligung-anlegen', person: { kontaktId: K_HAUPT }, zwecke: ['website'], fassung: v.json.fassung, unterschrift: png().toString('base64') });
    expect(nurWebsite.status).toBe(200);
    expect((await tun('person-a', { aktion: 'einwilligung-anlegen', person: { kontaktId: K_HAUPT }, zwecke: ['website'], fassung: 'alt', unterschrift: png().toString('base64') })).status).toBe(409);
    expect((await tun('person-a', { aktion: 'einwilligung-anlegen', person: { kontaktId: K_ART18 }, zwecke: ['website'], fassung: v.json.fassung, unterschrift: png().toString('base64') })).status).toBe(409);
    const ewId = String((nurWebsite.json.einwilligung as { id: string }).id);
    const pid = String(((await liste('person-a')).medien.find(x => x.id === medium.id) as unknown as { personen: { id: string }[] }).personen[0].id);
    await tun('person-b', { aktion: 'person-aendern', id: medium.id, personId: pid, einwilligungId: ewId });
    expect((await frei()).json.fehler).toMatch(/deckt nicht alle Kanäle/);
    const beides = await tun('person-a', { aktion: 'einwilligung-anlegen', person: { kontaktId: K_HAUPT }, zwecke: ['website', 'social'], fassung: v.json.fassung, unterschrift: png().toString('base64') });
    await tun('person-b', { aktion: 'person-aendern', id: medium.id, personId: pid, einwilligungId: (beides.json.einwilligung as { id: string }).id });
    // Minderjährig ohne Sorgeberechtigte → nie.
    await tun('person-b', { aktion: 'person-aendern', id: medium.id, personId: pid, minderjaehrig: true });
    expect((await frei()).json.fehler).toMatch(/Sorgeberechtigten/);
    await tun('person-b', { aktion: 'person-aendern', id: medium.id, personId: pid, minderjaehrig: false });
    expect((await frei()).status).toBe(200);
    // Die Unterschrift sieht nur, wer freigeben darf.
    expect((await rufe(r.beleg, 'GET', `/api/medien/beleg?art=unterschrift&id=${ewId}`, 'partner')).status).toBe(403);
    expect((await rufe(r.beleg, 'GET', `/api/medien/beleg?art=unterschrift&id=${ewId}`, 'person-a')).status).toBe(200);
    // Widerruf: sofort gesperrt, Aufgabe an die freigebende Person (ohne Namen im Titel).
    expect((await tun('person-a', { aktion: 'einwilligung-widerrufen', id: (beides.json.einwilligung as { id: string }).id })).status).toBe(200);
    expect((await liste('person-b')).medien.find(x => x.id === medium.id)!.marketing).toMatchObject({ status: 'gesperrt', wirksam: 'gesperrt' });
    const { loadJson } = await import('@/lib/store/local-db');
    const t = ((await loadJson<{ tasks: { id: string; title: string; assignee: string }[] }>('tasks'))?.tasks ?? []).find(x => x.id.startsWith('md-widerruf-'));
    expect(t).toMatchObject({ assignee: 'person-a' });
    expect(t!.title).not.toMatch(/Lena|Probe/);
    expect((await tun('person-a', { aktion: 'freigabe', id: medium.id, schritt: 'entsperren' })).status).toBe(409);
  });

  it('Art. 18: eine eingeschränkte Person wird nicht markiert; fremde Fotografen nur mit Lizenz-Nachweis', async () => {
    const { medium } = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein', urheber: { art: 'extern', name: 'Fotostudio' } } });
    expect((await tun('person-b', { aktion: 'person-markieren', id: medium.id, person: { art: 'kontakt', kontaktId: K_ART18, rolle: 'beiwerk' } })).status).toBe(409);
    const frei = () => tun('person-a', { aktion: 'freigabe', id: medium.id, schritt: 'freigeben', kanaele: ['druck'], bis: inTagen(10) });
    expect((await frei()).json.fehler).toMatch(/Lizenz/);
    const pdf = Buffer.from('%PDF-1.4\n% Testlizenz\n');
    expect((await rufe(r.beleg, 'POST', `/api/medien/beleg?id=${medium.id}&name=lizenz.pdf`, 'person-b', { roh: pdf })).status).toBe(200);
    expect((await rufe(r.beleg, 'POST', `/api/medien/beleg?id=${medium.id}&name=x.exe`, 'person-b', { roh: Buffer.from('MZ....') })).status).toBe(415);
    expect((await frei()).status).toBe(200);
    expect((await rufe(r.beleg, 'GET', `/api/medien/beleg?art=lizenz&id=${medium.id}`, 'partner')).bytes.equals(pdf)).toBe(true);
  });
});

describe('Heads: nur, was ausdrücklich „an Head gegeben“ ist', () => {
  it('Lesefunktion, Vorschlag über den Stapel, Freigabe per Klick — Privates, Minderjährige und fremde Aufträge nie', async () => {
    const { medienFuerHead, medienVorschlagAblegen, MEDIEN_STAPEL_ART } = await import('@/lib/medien/heads');
    const a = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein' } });
    const b = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein' } });
    const privat = await hochladen(r, 'person-b', { bereich: 'privat', anlegen: { erkennbarePersonen: 'nein' } });
    expect((await tun('person-b', { aktion: 'an-head', id: privat.medium.id, head: 'marketing', auftrag: ['auswahl'] })).status).toBe(400);
    expect((await tun('person-b', { aktion: 'an-head', id: a.medium.id, head: 'gesundheit', auftrag: ['auswahl'] })).status).toBe(400);
    const gegeben = await tun('person-b', { aktion: 'an-head', id: a.medium.id, head: 'marketing', auftrag: ['auswahl', 'zuschnitt', 'text'] });
    expect(gegeben.status).toBe(200);
    const auftragId = String((gegeben.json.medium as { heads: { auftragId: string }[] }).heads[0].auftragId);
    // Minderjährige nie an Bild-KI.
    await tun('person-b', { aktion: 'person-markieren', id: b.medium.id, person: { art: 'unbekannt', anzahl: 1, rolle: 'beiwerk', minderjaehrig: true } });
    expect((await tun('person-b', { aktion: 'an-head', id: b.medium.id, head: 'marketing', auftrag: ['auswahl'], auftragId })).status).toBe(400);

    const sicht = await medienFuerHead('person-b', 'marketing', auftragId);
    expect(sicht.map(m => m.id)).toEqual([a.medium.id]);
    expect(await medienFuerHead('person-b', 'sales', auftragId)).toEqual([]);
    expect(await medienFuerHead('gast', 'marketing', auftragId)).toEqual([]);
    const bild = await sicht[0].vorschauLaden();
    expect(bild?.typ).toBe('image/jpeg');

    const v = await medienVorschlagAblegen({ person: 'person-b', headId: 'marketing', auftragId, titel: 'Auswahl für den Post', auswahl: [{ mediumId: String(a.medium.id), begruendung: 'scharf, gutes Licht' }, { mediumId: String(privat.medium.id), begruendung: 'x' }], zuschnitte: [{ mediumId: String(a.medium.id), format: '4:5', rechteck: { x: 0.1, y: 0, b: 0.8, h: 1 } }], texte: [{ mediumId: String(a.medium.id), alt: 'Bühne mit Publikum', post: 'Danke für den Abend!' }] });
    expect(v.ok).toBe(true);
    const { loadJson } = await import('@/lib/store/local-db');
    const vorschlag = ((await loadJson<{ vorschlaege: { id: string; bezug?: { art: string }; eingabe: { auswahl: { mediumId: string }[] } }[] }>('zoe-stapel'))?.vorschlaege ?? []).find(x => x.id === (v as { vorschlagId: string }).vorschlagId)!;
    expect(vorschlag.bezug?.art).toBe('medien');
    expect(vorschlag.eingabe.auswahl.map(x => x.mediumId)).toEqual([a.medium.id]); // Privates fällt heraus
    // Bis zum Klick ändert sich nichts.
    expect((await liste('person-b')).medien.find(x => x.id === a.medium.id) as unknown as { texte?: unknown }).not.toHaveProperty('texte');
    const fr = await MEDIEN_STAPEL_ART.freigeben(vorschlag as never, 'person-b', {});
    expect(fr.ok).toBe(true);
    const nachher = (await liste('person-b')).medien.find(x => x.id === a.medium.id) as unknown as { texte: { herkunft: string; alt: string }; vorschlaege: { zuschnitte: unknown[] }[] };
    expect(nachher.texte).toMatchObject({ herkunft: 'ki', alt: 'Bühne mit Publikum' });
    expect(nachher.vorschlaege[0].zuschnitte).toHaveLength(1);
    // Zuschnitt = neues Medium „abgeleitet von“ — am Ausgangsbild als ausgeführt vermerkt.
    const z = await hochladen(r, 'person-b', { anlegen: { abgeleitetVon: { id: a.medium.id, vorschlagId: (v as { vorschlagId: string }).vorschlagId } } });
    expect(z.medium.abgeleitetVon).toMatchObject({ id: a.medium.id, art: 'zuschnitt' });
    const ausgangs = (await liste('person-b')).medien.find(x => x.id === a.medium.id) as unknown as { vorschlaege: { ausgefuehrt?: string[] }[] };
    expect(ausgangs.vorschlaege[0].ausgefuehrt).toEqual([z.medium.id]);
  });
});

describe('Fristen und Konto löschen', () => {
  it('Ablauf → abgelaufen + Aufgabe; Papierkorb nach 30 Tagen samt Dateien; alte Uploads weg; Rohmaterial mit Personen → EINE Prüf-Aufgabe; Art. 17 → gesperrt', async () => {
    const { medienPflege } = await import('@/lib/medien/pflege');
    const { loadJson, saveJson } = await import('@/lib/store/local-db');
    const frei = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein' } });
    await tun('person-a', { aktion: 'freigabe', id: frei.medium.id, schritt: 'freigeben', kanaele: ['website'], bis: inTagen(3) });
    const roh = await hochladen(r, 'person-b');
    await tun('person-b', { aktion: 'person-markieren', id: roh.medium.id, person: { art: 'kontakt', kontaktId: K_OFFEN, rolle: 'beiwerk' } });
    const weg = await hochladen(r, 'person-b', { anlegen: { erkennbarePersonen: 'nein' } });
    await tun('person-b', { aktion: 'loeschen', id: weg.medium.id });
    // Unfertiger Upload.
    const u = await rufe(r.upload, 'POST', '/api/medien/upload', 'person-b', { json: { id: '44444444-4444-4444-8444-444444444444', typ: 'image/jpeg', bytes: 500, bereich: 'business', ortsdatenEntfernt: true } });
    expect(u.status).toBe(200);
    // 13 Monate später.
    const spaeter = new Date(Date.now() + 400 * 864e5);
    const e = await medienPflege({ uploadTage: 7, papierkorbTage: 30, rohMonate: 12 }, spaeter);
    expect(e).toMatchObject({ papierkorb: 1, sitzungen: 1 });
    expect(e.abgelaufen).toBeGreaterThanOrEqual(1); // auch die früher freigegebenen sind nach 400 Tagen abgelaufen
    expect(e.roh).toBeGreaterThanOrEqual(1);
    const kat = await loadJson<{ medien: { id: string; marketing: { status: string } }[] }>('medien--haus-a');
    expect(kat!.medien.find(m => m.id === frei.medium.id)!.marketing.status).toBe('abgelaufen');
    expect(kat!.medien.some(m => m.id === weg.medium.id)).toBe(false);
    const dateien = readdirSync(process.env.MAKE_OS_MEDIEN_DIR!, { recursive: true }).map(String);
    expect(dateien.some(d => d.includes(String(weg.medium.id)) && d.endsWith('.mkm'))).toBe(false);
    const tasks = (await loadJson<{ tasks: { id: string; title: string; assignee?: string }[] }>('tasks'))!.tasks;
    expect(tasks.some(t => t.id.startsWith('md-ablauf-') && t.assignee === 'person-a')).toBe(true);
    expect(tasks.filter(t => t.id === 'md-roh-pruefen')).toHaveLength(1);
    // Ein zweiter Lauf legt nichts doppelt an.
    const ablaufAufgaben = tasks.filter(t => t.id.startsWith('md-ablauf-')).length;
    expect(ablaufAufgaben).toBe(e.abgelaufen);
    await medienPflege({ uploadTage: 7, papierkorbTage: 30, rohMonate: 12 }, spaeter);
    expect((await loadJson<{ tasks: { id: string }[] }>('tasks'))!.tasks.filter(t => t.id.startsWith('md-ablauf-'))).toHaveLength(ablaufAufgaben);
    // Art. 17: der allgemeine Weg tilgt die Kennung → das Medium ist sofort gesperrt, der Lauf schreibt es fest + Prüf-Aufgabe.
    const k = await loadJson<{ medien: { id: string; personen: { kontaktId?: string }[] }[] }>('medien--haus-a');
    await saveJson('medien--haus-a', { ...k, medien: k!.medien.map(m => (m.id === roh.medium.id ? { ...m, personen: m.personen.map(p => ({ ...p, kontaktId: '[gelöscht]' })) } : m)) });
    expect((await liste('person-b')).medien.find(x => x.id === roh.medium.id)!.marketing.wirksam).toBe('gesperrt');
    const e2 = await medienPflege({ uploadTage: 7, papierkorbTage: 30, rohMonate: 12 });
    expect(e2.art17).toBe(1);
    expect((await loadJson<{ tasks: { id: string }[] }>('tasks'))!.tasks.some(t => t.id === 'md-art17-pruefen')).toBe(true);
  });

  it('Art. 15: die Auskunft nennt Medien und Einwilligungen der Person', async () => {
    const { medienAuskunft } = await import('@/lib/medien/datenschutz');
    const a = await medienAuskunft(K_HAUPT);
    expect(a.medien.length).toBeGreaterThanOrEqual(1);
    expect(a.einwilligungen.length).toBe(2);
    expect(a.einwilligungen.some(e => e.widerrufen)).toBe(true);
  });

  it('Konto löschen: private Medien samt Dateien weg, im Business bleiben sie mit „[gelöscht]“', async () => {
    const privat = await hochladen(r, 'person-b', { bereich: 'privat' });
    const business = await hochladen(r, 'person-b');
    const { kontoLoeschen } = await import('@/lib/datenschutz/konto-daten');
    const bericht = await kontoLoeschen('person-b', { grabstein: false });
    expect(bericht?.bestaende).toContain('medien-privat--person-b');
    const dateien = readdirSync(process.env.MAKE_OS_MEDIEN_DIR!, { recursive: true }).map(String);
    expect(dateien.some(d => d.includes(String(privat.medium.id)) && d.endsWith('.mkm'))).toBe(false);
    const { loadJson } = await import('@/lib/store/local-db');
    const m = (await loadJson<{ medien: { id: string; von: string }[] }>('medien--haus-a'))!.medien.find(x => x.id === business.medium.id);
    expect(m!.von).toBe('[gelöscht]');
    expect(JSON.stringify(await loadJson('medien--haus-a'))).not.toContain('"person-b"');
    expect(path.isAbsolute(process.env.MAKE_OS_MEDIEN_DIR!)).toBe(true);
  });
});
