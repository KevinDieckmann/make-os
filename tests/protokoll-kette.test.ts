// ─── Hash-Kette über die Protokolle (05.10., Paket „Protokolle nachweisfest“) ──────────────────────────────────────
// Eigener Datenordner, Datenschlüssel und Pepper nur für den Test. Prüft: Anhängen verkettet und siegelt; die Prüfung
// erkennt veränderte, eingeschobene, gelöschte und abgeschnittene Einträge, vertauschte Monatsdateien und eine entfernte
// Kette — rechtmäßige Änderungen (Art. 17 tilgen, Fingerabdruck-Umrechnung, Löschfrist, rollendes Anmeldeprotokoll)
// bleiben „unverändert“. Altbestand ohne Kette wird nachversiegelt.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kette-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'test-schluessel-kette-' + 'k'.repeat(30);
process.env.MAKE_OS_PEPPER = 'test-pepper-kette-' + 'p'.repeat(40);

let db: typeof import('@/lib/store/local-db');
let k: typeof import('@/lib/store/protokoll-kette');
type Datei = import('@/lib/store/protokoll-kette').KettenDatei;
const H = 'haus-kette';
const name = (monat: string) => `aenderungsprotokoll--${H}--${monat}`;
const eintrag = (n: number, extra: Record<string, unknown> = {}) => ({ at: `2026-09-${String(10 + (n % 15)).padStart(2, '0')}T10:00:00.000Z`, wer: 'person', person: 'kevin', bestand: 'kontakte', op: 'geaendert', id: `c2#${'a'.repeat(15)}${n % 10}`, felder: ['notiz'], ...extra });
const befund = (p: import('@/lib/store/protokoll-kette').KettenPruefung, n: string) => p.befunde.find(b => b.name === n);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  k = await import('@/lib/store/protokoll-kette');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Kette anhängen und prüfen', () => {
  it('verkettet je Eintrag, siegelt und verbindet die Monate', async () => {
    await k.anhaengenVerkettet(name('2026-08'), [eintrag(1), eintrag(2)]);
    await k.anhaengenVerkettet(name('2026-09'), [eintrag(3)]);
    await k.anhaengenVerkettet(name('2026-09'), [eintrag(4), eintrag(5)]);
    const aug = (await db.loadJson<Datei>(name('2026-08')))!;
    const sep = (await db.loadJson<Datei>(name('2026-09')))!;
    expect(aug.kette).toMatchObject({ v: 1, alg: 'hmac-sha256', vor: 'anfang' });
    expect(sep.kette!.vor).toBe(aug.eintraege[1].h);
    expect(sep.eintraege.map(e => typeof e.h)).toEqual(['string', 'string', 'string']);
    const p = await k.kettenPruefen();
    expect(p.ok).toBe(true);
    expect(p.eintraege).toBe(5);
    expect(p.befunde).toEqual([]);
  });

  it('Kette erkennt Manipulation: geänderter Eintrag', async () => {
    const d = (await db.loadJson<Datei>(name('2026-09')))!;
    await db.saveJson(name('2026-09'), { ...d, eintraege: d.eintraege.map((e, i) => (i === 1 ? { ...e, felder: ['stufe'] } : e)) });
    const p = await k.kettenPruefen();
    expect(p.ok).toBe(false);
    expect(befund(p, name('2026-09'))).toMatchObject({ stand: 'fehler', brueche: [1] });
    await db.saveJson(name('2026-09'), d); // zurück
    expect((await k.kettenPruefen()).ok).toBe(true);
  });

  it('Kette erkennt Manipulation: gelöschter Eintrag in der Mitte und abgeschnittenes Ende', async () => {
    const d = (await db.loadJson<Datei>(name('2026-09')))!;
    await db.saveJson(name('2026-09'), { ...d, eintraege: [d.eintraege[0], d.eintraege[2]] });
    expect(befund(await k.kettenPruefen(), name('2026-09'))?.stand).toBe('fehler');
    await db.saveJson(name('2026-09'), { ...d, eintraege: d.eintraege.slice(0, 2) }); // Ende weg — die Kette allein sähe es nicht
    const p = await k.kettenPruefen();
    expect(befund(p, name('2026-09'))).toMatchObject({ stand: 'fehler', siegel: 'gekuerzt' });
    await db.saveJson(name('2026-09'), d);
  });

  it('Kette erkennt Manipulation: eingeschobener Eintrag ohne Hash, vertauschter Monat, entfernte Kette', async () => {
    const d = (await db.loadJson<Datei>(name('2026-09')))!;
    await db.saveJson(name('2026-09'), { ...d, eintraege: [d.eintraege[0], eintrag(9), ...d.eintraege.slice(1)] });
    expect(befund(await k.kettenPruefen(), name('2026-09'))?.stand).toBe('fehler');
    await db.saveJson(name('2026-09'), d);
    // August-Protokoll unter einem anderen Monat zurückgelegt: der Anfang bindet den Dateinamen.
    const aug = (await db.loadJson<Datei>(name('2026-08')))!;
    await db.saveJson(name('2026-07'), aug);
    const p = await k.kettenPruefen();
    expect(befund(p, name('2026-07'))?.brueche).toContain(-1);
    rmSync(path.join(ordner, `${name('2026-07')}.json`));
    // Kette entfernt (alte Form vorgetäuscht): das Siegel kennt die Datei.
    await db.saveJson(name('2026-08'), { eintraege: aug.eintraege.map(({ h: _h, ...e }) => e) });
    expect(befund(await k.kettenPruefen(), name('2026-08'))?.stand).toBe('fehler');
    await db.saveJson(name('2026-08'), aug);
    expect((await k.kettenPruefen()).ok).toBe(true);
  });

  it('eine gelöschte Monatsdatei fällt über das Siegel auf', async () => {
    const aug = (await db.loadJson<Datei>(name('2026-08')))!;
    rmSync(path.join(ordner, `${name('2026-08')}.json`));
    const p = await k.kettenPruefen();
    expect(p.ok).toBe(false);
    expect(befund(p, name('2026-08'))?.hinweis).toMatch(/Datei fehlt/);
    await db.saveJson(name('2026-08'), aug);
  });

  it('rechtmäßige Änderungen bleiben unverändert: Art. 17, Umrechnung der Fingerabdrücke, Name getilgt', async () => {
    const d = (await db.loadJson<Datei>(name('2026-09')))!;
    // Art. 17: Fingerabdruck → c#geloescht; Umrechnung v1 → v2: c#… → c2#…
    await db.saveJson(name('2026-09'), { ...d, eintraege: d.eintraege.map((e, i) => (i === 0 ? { ...e, id: 'c#geloescht' } : i === 1 ? { ...e, id: 'c#0123456789ab' } : e)) });
    let p = await k.kettenPruefen();
    expect(p.ok).toBe(true);
    // Name in einem Feld → „[gelöscht]“ (tilgeTief): zählt als getilgt, nicht als Bruch.
    await db.saveJson(name('2026-09'), { ...d, eintraege: d.eintraege.map((e, i) => (i === 2 ? { ...e, bestand: 'Projekt [gelöscht]' } : e)) });
    p = await k.kettenPruefen();
    expect(p.ok).toBe(true);
    expect(p.getilgt).toBe(1);
    await db.saveJson(name('2026-09'), d);
  });

  it('Löschfrist: ein geleerter Monat unterbricht die Kette erlaubt', async () => {
    const aug = (await db.loadJson<Datei>(name('2026-08')))!;
    await db.saveJson(name('2026-08'), { eintraege: [], bereinigt: { am: '2026-10-01T00:00:00.000Z', eintraege: 2, grund: 'Löschfrist' } });
    const p = await k.kettenPruefen();
    expect(p.ok).toBe(true);
    expect(befund(p, name('2026-09'))).toBeUndefined();
    await db.saveJson(name('2026-08'), aug);
  });
});

describe('Altbestand und rollende Dateien', () => {
  it('Altbestand ohne Kette: Prüfung warnt, Versiegeln holt nach (sichtbar „nachversiegelt“), danach erkennt sie Änderungen', async () => {
    const alt = `aenderungsprotokoll--haus-alt--2026-09`;
    await db.saveJson(alt, { eintraege: [eintrag(1), eintrag(2)] });
    expect(befund(await k.kettenPruefen(), alt)?.stand).toBe('warnung');
    expect(await k.protokolleVersiegeln()).toBeGreaterThanOrEqual(1);
    const d = (await db.loadJson<Datei>(alt))!;
    expect(d.kette?.nachversiegelt).toBeTruthy();
    expect(d.kette?.nachversiegeltAnzahl).toBe(2);
    expect((await k.kettenPruefen()).ok).toBe(true);
    // Ein danach angehängter Eintrag des alten Stands (ohne Hash) wird beim nächsten Anhängen nachversiegelt.
    await db.saveJson(alt, { ...d, eintraege: [...d.eintraege, eintrag(3)] });
    expect(befund(await k.kettenPruefen(), alt)?.stand).toBe('warnung');
    await k.anhaengenVerkettet(alt, [eintrag(4)]);
    const d2 = (await db.loadJson<Datei>(alt))!;
    expect(d2.kette?.nachversiegeltAnzahl).toBe(3);
    expect((await k.kettenPruefen()).ok).toBe(true);
  });

  it('Anmeldeprotokoll: rollend über die Grenze — vorne fällt heraus, die Kette bleibt prüfbar', async () => {
    for (let i = 0; i < 7; i++) await k.anhaengenVerkettet('anmeldungen', [{ zeit: `2026-10-0${1 + (i % 5)}T08:00:00.000Z`, speicher: 'kevin', art: 'anmelden', ok: true, adresse: '10.0.0.x' }], { max: 5 });
    const d = (await db.loadJson<Datei>('anmeldungen'))!;
    expect(d.eintraege).toHaveLength(5);
    expect(d.kette?.verworfen).toBe(2);
    const p = await k.kettenPruefen();
    expect(p.ok).toBe(true);
    // Den ältesten verbliebenen Eintrag still entfernen → Anfang passt nicht mehr bzw. Siegel zählt mehr.
    await db.saveJson('anmeldungen', { ...d, eintraege: d.eintraege.slice(1) });
    expect(befund(await k.kettenPruefen(), 'anmeldungen')?.stand).toBe('fehler');
    await db.saveJson('anmeldungen', d);
  });

  it('kettePruefenUndMerken merkt das Ergebnis für den Head of IT', async () => {
    const p = await k.kettePruefenUndMerken();
    expect(p.ok).toBe(true);
    expect((await k.letztePruefung())?.zeit).toBe(p.zeit);
  });

  it('kanonisch: Reihenfolge der Schlüssel egal, `h` zählt nicht, Fingerabdrücke normalisiert', () => {
    expect(k.kanon({ b: 1, a: 'c2#0123456789abcdef', h: 'x' })).toBe(k.kanon({ a: 'c#geloescht', b: 1 }));
    expect(k.kanon({ a: 'c2#0123456789abcdef:y' })).toBe('{"a":"c#:y"}');
  });
});
