// ─── Medien: reine Regeln, Warteschlange, Lagebild, Nachtsicherung (09.10., Paket 5) ─────────────────────────────────────
// · EINE Filterstelle `medienFuerBetrachter`: Sicht X bekommt nichts aus Y (Privat „nur ich“, „Haushalt“, „nur Business“).
// · Wirksamer Status: Ablauf am Tag nach `bis`, Sperre durch Personen sofort.
// · Warteschlange auf dem Gerät: Stücke, Abbruch (kein Netz) und Wiederaufnahme, Prüfsumme wie der Server, gesendete Stücke weg.
// · Head of IT: Befunde nur aus Zahlen. · Nachtsicherung: der Medien-Ordner bleibt draußen (Wächter).
import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { medienFuerBetrachter, wirksamerStatus, anHeadGruende, medienFuerHeadRein, neuesMedium, albumKennung, type Betrachter, type Quelle, type Lage } from '@/lib/medien/regeln';
import { MedienSchlange, ramGeraet, bewerten, pruefsumme, type MedienSender, type Antwort } from '@/lib/medien/warteschlange';
import { medienBefunde } from '@/lib/medien/hoi';
import { GRENZEN, leererKatalog, type Medium, type Album } from '@/lib/medien/typen';
import { pruefsummeAusTeilen } from '@/lib/medien/krypto';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-medien-regeln-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  return o;
});
afterAll(async () => { (await import('node:fs')).rmSync(ordner, { recursive: true, force: true }); });

const J = '2026-10-09T10:00:00.000Z';
const m = (id: string, x: Partial<Medium> = {}): Medium => ({ ...neuesMedium({ id, art: 'bild', bereich: 'business', von: 'p-a', hochgeladen: J, typ: 'image/jpeg', groesse: 10, ortsdatenEntfernt: true, schluessel: { kid: null, dek: '' }, varianten: {}, jetzt: J }), ...x });
const album = (id: string, x: Partial<Album>): Album => ({ id, bereich: 'privat', art: 'frei', titel: id, sicht: 'nur-ich', von: 'p-a', angelegt: J, ...x });
const lage = (x: Partial<Lage> = {}): Lage => ({ heute: '2026-10-09', einwilligungen: [], kontaktSperre: () => null, ...x });

describe('EINE Filterstelle: Sicht X bekommt nichts aus Y', () => {
  const quellen: Quelle[] = [
    { art: 'business', katalog: { ...leererKatalog(), medien: [m('md-business')] } },
    { art: 'privat', besitzer: 'p-a', katalog: { v: 1, alben: [album('al-haus', { sicht: 'haushalt' }), album('al-ich', { sicht: 'nur-ich' })], medien: [
      m('md-haus', { bereich: 'privat', album: 'al-haus' }), m('md-ich', { bereich: 'privat', album: 'al-ich' }), m('md-unsortiert', { bereich: 'privat' }),
    ] } },
  ];
  const ids = (b: Betrachter) => medienFuerBetrachter(quellen, b).medien.map(s => s.medium.id).sort();
  const alben = (b: Betrachter) => medienFuerBetrachter(quellen, b).alben.map(a => a.album.id).sort();
  it('die Person selbst: alles Eigene', () => {
    expect(ids({ person: 'p-a', haushalt: 'h', voll: true, marketing: false })).toEqual(['md-business', 'md-haus', 'md-ich', 'md-unsortiert']);
  });
  it('volles Mitglied: Business + Alben „Haushalt“ der anderen — nie „nur ich“, nie Unsortiert, nicht einmal das Album', () => {
    const b = { person: 'p-b', haushalt: 'h', voll: true, marketing: false };
    expect(ids(b)).toEqual(['md-business', 'md-haus']);
    expect(alben(b)).toEqual(['al-haus']);
  });
  it('„nur Business“ (finanzRecht business): nur Business — auch nicht als Marketing-Verantwortliche', () => {
    expect(ids({ person: 'p-c', haushalt: 'h', voll: false, marketing: true })).toEqual(['md-business']);
    expect(alben({ person: 'p-c', haushalt: 'h', voll: false, marketing: true })).toEqual([]);
  });
  it('Papierkorb nur, wo man ohnehin sieht', () => {
    const q: Quelle[] = [{ art: 'privat', besitzer: 'p-a', katalog: { ...leererKatalog(), medien: [m('md-weg', { bereich: 'privat', geloeschtAm: J })] } }];
    expect(medienFuerBetrachter(q, { person: 'p-b', haushalt: 'h', voll: true, marketing: false }, { papierkorb: true }).medien).toEqual([]);
    expect(medienFuerBetrachter(q, { person: 'p-a', haushalt: 'h', voll: true, marketing: false }, { papierkorb: true }).medien).toHaveLength(1);
  });
});

describe('Wirksamer Status und Heads', () => {
  it('Ablauf am Tag nach „bis“; Art. 18/Widerruf/Art. 17 sperren sofort; gesperrt geht an keinen Head', () => {
    const frei = m('md-1', { marketing: { status: 'freigegeben', kanaele: ['website'], bis: '2026-10-09', verlauf: [] } });
    expect(wirksamerStatus(frei, lage()).status).toBe('freigegeben');
    expect(wirksamerStatus(frei, lage({ heute: '2026-10-10' }))).toEqual({ status: 'abgelaufen', grund: 'ablauf' });
    const mitPerson = { ...frei, personen: [{ id: 'pb-1', art: 'kontakt' as const, kontaktId: 'c-x', rolle: 'beiwerk' as const, markiertVon: 'p-a', am: J }] };
    expect(wirksamerStatus(mitPerson, lage({ kontaktSperre: () => 'art18' }))).toEqual({ status: 'gesperrt', grund: 'art18' });
    expect(wirksamerStatus({ ...mitPerson, personen: [{ ...mitPerson.personen[0], kontaktId: '[gelöscht]' }] }, lage())).toEqual({ status: 'gesperrt', grund: 'art17' });
    expect(wirksamerStatus({ ...mitPerson, personen: [{ ...mitPerson.personen[0], einwilligungId: 'ew-1' }] }, lage({ einwilligungen: [{ id: 'ew-1', am: J, erfasstVon: 'p-a', person: {}, zwecke: ['website'], wortlaut: 'x', fassung: 'f', widerruf: { am: J, von: 'p-a' } }] }))).toEqual({ status: 'gesperrt', grund: 'widerruf' });
    expect(anHeadGruende({ ...mitPerson, erkennbarePersonen: 'ja' }, lage({ kontaktSperre: () => 'art18' })).length).toBeGreaterThan(0);
  });
  it('medienFuerHeadRein: nur Business, nur genau dieser Auftrag', () => {
    const z = { head: 'marketing', auftragId: 'ha-1', auftrag: ['auswahl' as const], von: 'p-a', am: J };
    const kat = { ...leererKatalog(), medien: [m('md-a', { erkennbarePersonen: 'nein', heads: [z] }), m('md-b', { erkennbarePersonen: 'nein', heads: [{ ...z, auftragId: 'ha-2' }] }), m('md-c', { erkennbarePersonen: 'nein', bereich: 'privat', heads: [z] })] };
    expect(medienFuerHeadRein(kat, 'marketing', 'ha-1', lage()).map(x => x.medium.id)).toEqual(['md-a']);
    expect(medienFuerHeadRein(kat, 'sales', 'ha-1', lage())).toEqual([]);
  });
  it('Event-Album: feste Kennung je Event', () => {
    expect(albumKennung('event', 'ev-123')).toBe('al-ev-ev-123');
    expect(albumKennung('event', '../x')).toBeNull();
    expect(albumKennung('frei', 'x')).toBeNull();
  });
});

describe('Warteschlange auf dem Gerät', () => {
  /** Ein Server im Speicher, der wie die Routen antwortet (Stücke, Prüfsummen, fertig) — und auf Wunsch „kein Netz“ meldet. */
  function server() {
    const s = { teile: new Map<number, string>(), vorschau: new Set<string>(), fertig: false, keinNetzAb: Infinity, aufrufe: 0, teilGroesse: GRENZEN.teil, anzahl: 0 };
    const netz = (): Antwort | null => (++s.aufrufe > s.keinNetzAb ? { status: 0, daten: null } : null);
    const sender: MedienSender = {
      anlegen: async (_id, k) => netz() ?? (s.fertig ? { status: 200, daten: { ok: true, fertig: true } } : (s.anzahl = Math.ceil(Number(k.bytes) / GRENZEN.teil), { status: 200, daten: { ok: true, sitzung: { fehlend: Array.from({ length: s.anzahl }, (_, i) => i).filter(i => !s.teile.has(i)), vorschau: [...s.vorschau] } } })),
      vorschau: async (_id, v) => netz() ?? (s.vorschau.add(v), { status: 200, daten: { ok: true } }),
      teil: async (_id, nr, b, h) => netz() ?? (createHash('sha256').update(b).digest('hex') !== h ? { status: 400, daten: { ok: false, fehler: 'Prüfsumme' } } : (s.teile.set(nr, h), { status: 200, daten: { ok: true } })),
      fertig: async (_id, p) => netz() ?? (p === pruefsummeAusTeilen([...s.teile.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1])) ? (s.fertig = true, { status: 200, daten: { ok: true } }) : { status: 400, daten: { ok: false, fehler: 'Prüfsumme der Datei' } }),
    };
    return { s, sender };
  }

  it('legt verschlüsselte Stücke ab, bricht ohne Netz ab, macht danach weiter und räumt das Gerät', async () => {
    const geraet = ramGeraet();
    const { s, sender } = server();
    const q = new MedienSchlange(geraet, sender);
    q.person = 'p-a';
    const daten = randomBytes(GRENZEN.teil * 2 + 10);
    await q.ablegen({ id: '55555555-5555-4555-8555-555555555555', person: 'p-a', anlegen: { typ: 'image/jpeg', bytes: daten.length }, bytes: daten.length, daten, datei: null, patches: [], vorschau: { raster: new Blob([new Uint8Array([1, 2, 3])]) }, anzeige: { name: 'x', art: 'bild' } });
    expect((await geraet.stueck('55555555-5555-4555-8555-555555555555', '2'))!.length).toBe(10);
    s.keinNetzAb = 3; // anlegen, Vorschau, Stück 0 — dann ist das Netz weg
    const r1 = await q.senden();
    expect(r1.wartend).toBe(1);
    expect([...s.teile.keys()]).toEqual([0]);
    expect(await geraet.stueck('55555555-5555-4555-8555-555555555555', '0')).toBeNull(); // gesendet → vom Gerät gelöscht
    s.keinNetzAb = Infinity;
    const r2 = await q.senden();
    expect(r2).toMatchObject({ fertig: 1, wartend: 0 });
    expect(s.fertig).toBe(true);
    expect(await q.alle()).toEqual([]);
  });

  it('Medien einer anderen angemeldeten Person werden nicht gesendet; Bewertung der Antworten', async () => {
    const { s, sender } = server();
    const q = new MedienSchlange(ramGeraet(), sender);
    q.person = 'p-b';
    await q.ablegen({ id: '66666666-6666-4666-8666-666666666666', person: 'p-a', anlegen: { bytes: 5 }, bytes: 5, daten: new Uint8Array(5), datei: null, patches: [], vorschau: {}, anzeige: { name: 'x', art: 'bild' } });
    await q.senden();
    expect(s.aufrufe).toBe(0);
    expect(bewerten(0, null).art).toBe('stopp');
    expect(bewerten(507, { fehler: 'voll' }).art).toBe('stopp');
    expect(bewerten(500, null).art).toBe('wiederholen');
    expect(bewerten(415, { fehler: 'x' })).toEqual({ art: 'fehler', text: 'x' });
    expect(bewerten(409, { neuLaden: true }).art).toBe('neuladen');
    expect(await pruefsumme(['00'.repeat(32)])).toBe(pruefsummeAusTeilen(['00'.repeat(32)]));
  });
});

describe('Head of IT: nur Zahlen', () => {
  it('Ordner auf dem Server gelb, fast voll gelb/rot, alte Schlüssel gelb, halb eingerichtet gelb; nichts → kein Befund', () => {
    expect(medienBefunde(null)).toEqual([]);
    expect(medienBefunde({ modus: 'ordner', s3Halb: false, belegt: 0, grenze: 100, medien: 0, altSchluessel: 0, uploadsAlt: 0 }, true)).toEqual([]);
    expect(medienBefunde({ modus: 'ordner', s3Halb: false, belegt: 1, grenze: 100, medien: 3, altSchluessel: 0, uploadsAlt: 0 }, true).map(b => [b.id, b.ampel])).toEqual([['medien-ordner', 'gelb']]);
    expect(medienBefunde({ modus: 'ordner', s3Halb: false, belegt: 96, grenze: 100, medien: 3, altSchluessel: 0, uploadsAlt: 0 }, true)[0]).toMatchObject({ id: 'medien-voll', ampel: 'rot' });
    expect(medienBefunde({ modus: 's3', s3Halb: false, medien: 3, altSchluessel: 2, uploadsAlt: 1 }).map(b => b.id)).toEqual(['medien-schluessel', 'medien-uploads']);
    for (const b of medienBefunde({ modus: 'ordner', s3Halb: true, belegt: 90, grenze: 100, medien: 1, altSchluessel: 1, uploadsAlt: 1 }, true)) expect(b.wert).not.toMatch(/@|md-/);
  });
});

describe('Nachtsicherung: Medien nie im Archiv des Datenordners (Wächter)', () => {
  it('deploy/sicherung.sh schließt daten/medien aus', () => {
    const sh = readFileSync(path.resolve(__dirname, '..', 'deploy', 'sicherung.sh'), 'utf8');
    const tar = sh.split('\n').filter(z => /--exclude/.test(z)).join(' ');
    expect(tar).toContain("--exclude='daten/medien'");
  });
  it('der Ordner-Speicher liegt (ohne eigene Angabe) genau dort: <daten>/medien', async () => {
    const { medienKonfig } = await import('@/lib/medien/speicher');
    const k = medienKonfig({ MAKE_OS_MEDIEN_DIR: '' } as unknown as NodeJS.ProcessEnv);
    if (k.modus !== 'ordner') throw new Error('Ordner erwartet');
    expect(path.basename(k.ordner)).toBe('medien');
  });
});

describe('Skript: Medienspeicher verbinden', () => {
  it('fragt das Geheimnis verdeckt, schreibt nur MEDIEN-Zeilen, gibt es nie aus', () => {
    const sh = readFileSync(path.resolve(__dirname, '..', 'deploy', 'medien-speicher-verbinden.sh'), 'utf8');
    expect(sh).toContain('read -rsp');
    expect(sh).toMatch(/grep -v -E '\^MAKE_OS_MEDIEN_S3_/);
    expect(sh).not.toMatch(/echo[^\n]*\$GEHEIM/);
    expect(sh).toContain('unset GEHEIM ZEILEN');
  });
});
