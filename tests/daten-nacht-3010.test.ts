// ─── Datenprüfung der Nacht 30.10. — Wächter je Fund (DATEN_NACHT_3010.md) ─────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Werte (Kennungen, @example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-daten-nacht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-daten-nacht';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let community: typeof import('@/lib/social/community');
let formular: typeof import('@/lib/crm/formulare-speicher');

const TAG = 86_400_000;
const JETZT = new Date('2026-10-30T08:00:00.000Z');
const vor = (tage: number) => new Date(JETZT.getTime() - tage * TAG).toISOString();

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  community = await import('@/lib/social/community');
  formular = await import('@/lib/crm/formulare-speicher');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

// ── Fund 1: Fristen von Social-Kommentaren/DMs und Formular-Eingängen wirkten nur beim Abholen bzw. Schreiben ──
describe('Fund 1 · Fristen auch ohne Verbindung bzw. ohne neue Anfrage', () => {
  const alt = { id: 'dm-1', art: 'dm' as const, kanalId: 'sk-1', richtung: 'ein' as const, gegen: { id: '111', name: 'erfunden_alt' }, text: 'alt', am: vor(200) };
  const neu = { id: 'dm-2', art: 'dm' as const, kanalId: 'sk-1', richtung: 'ein' as const, gegen: { id: '222', name: 'erfunden_neu' }, text: 'neu', am: vor(10) };
  const datei = () => ({
    eintraege: { [alt.id]: alt, [neu.id]: neu },
    faeden: { 'dm~sk-1~111': { gelesenBis: vor(199) }, 'dm~sk-1~222': { gelesenBis: vor(9) } },
    entwuerfe: { 'dm~sk-1~111': { fuer: alt.id, text: 'Entwurf', am: vor(199), grund: 'g' }, 'dm~sk-1~222': { fuer: neu.id, text: 'Entwurf', am: vor(9), grund: 'g' } },
    fremd: [
      { id: 'fk-1', kanalId: 'sk-1', link: 'https://www.instagram.com/p/AAAAA/', handle: 'fremd', entwurf: 'x', am: vor(300), von: 'p', erledigtAm: vor(250) },
      { id: 'fk-2', kanalId: 'sk-1', link: 'https://www.instagram.com/p/BBBBB/', entwurf: 'y', am: vor(300), von: 'p' },
    ],
  });

  it('communityFrist (rein): alte Einträge, ihr Faden (trägt die Kennung des Gegenübers), ihr Entwurf und erledigte Fremd-Entwürfe fallen; offene bleiben', () => {
    const r = community.communityFrist(datei(), JETZT);
    expect(Object.keys(r.datei.eintraege)).toEqual(['dm-2']);
    expect(Object.keys(r.datei.faeden)).toEqual(['dm~sk-1~222']);
    expect(Object.keys(r.datei.entwuerfe ?? {})).toEqual(['dm~sk-1~222']);
    expect((r.datei.fremd ?? []).map(f => f.id)).toEqual(['fk-2']);
    expect(r.n).toBe(4);
    const nochmal = community.communityFrist(r.datei, JETZT);
    expect(nochmal.n).toBe(0);
    expect(nochmal.datei).toBe(r.datei);
  });

  it('der Löschfristen-Lauf wendet sie an — ohne Instagram-Konfiguration und ohne Verbindung', async () => {
    delete process.env.INSTAGRAM_APP_ID;
    await db.saveJson('social-community--h-nacht', datei());
    await db.saveJson('angebot-formular--h-nacht', {
      v: 1, einstellungen: {}, links: [],
      eingaenge: [
        { id: 'af-alt', am: vor(800), status: 'verschickt', quelle: 'intern', von: 'p' },
        { id: 'af-offen', am: vor(800), status: 'freigabe', quelle: 'intern', von: 'p' },
        { id: 'af-neu', am: vor(30), status: 'verschickt', quelle: 'intern', von: 'p' },
      ],
    });
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(JETZT, true);
    expect(r.bereinigt['social-community']).toBe(4);
    expect(r.bereinigt['angebot-formular']).toBe(1);
    const c = await db.loadJson<{ eintraege: Record<string, unknown> }>('social-community--h-nacht');
    expect(Object.keys(c!.eintraege)).toEqual(['dm-2']);
    const f = await db.loadJson<{ eingaenge: { id: string }[] }>('angebot-formular--h-nacht');
    expect(f!.eingaenge.map(e => e.id)).toEqual(['af-offen', 'af-neu']);
    // idempotent, ohne Bestand nichts
    expect(await community.communityFristAnwenden('social-community--h-nacht', JETZT)).toBe(0);
    expect(await formular.formularFristAnwenden('angebot-formular--h-gibts-nicht', JETZT)).toBe(0);
    expect(await db.loadJson('angebot-formular--h-gibts-nicht')).toBeNull();
  });
});

// ── Fund 2: Social (Instagram, LinkedIn) ohne Verarbeitung im Verzeichnis und ohne Empfänger im Register ──
describe('Fund 2 · Social im Verzeichnis (Art. 30) und im Empfänger-Register (Art. 28/44)', () => {
  it('verzeichnisVervollstaendigen trägt „Social Media“ nach, sobald ein Anbieter eingerichtet ist — sonst nicht', async () => {
    const { verzeichnisVervollstaendigen, VV_SOCIAL_ID } = await import('@/lib/crm/datenschutz');
    const J = '2026-10-30T08:00:00.000Z';
    expect(verzeichnisVervollstaendigen([], J).liste.some(v => v.id === VV_SOCIAL_ID)).toBe(false);
    const mit = verzeichnisVervollstaendigen([], J, { social: true }).liste;
    const v = mit.find(x => x.id === VV_SOCIAL_ID)!;
    expect(v).toBeTruthy();
    const { EMPFAENGER_START } = await import('@/lib/datenschutz/einrichtung');
    const ids = new Set(EMPFAENGER_START.map(e => e.id));
    for (const id of v.empfaengerIds ?? []) expect(ids.has(id), id).toBe(true);
    // idempotent: ein zweiter Lauf ändert nichts
    expect(verzeichnisVervollstaendigen(mit, J, { social: true }).geaendert).toBe(false);
  });

  it('Instagram und LinkedIn stehen im Empfänger-Register (archiviert, gültig) und kommen in gespeicherte Listen nach', async () => {
    const { EMPFAENGER_START, empfaengerPruefen, empfaengerWirksam } = await import('@/lib/datenschutz/einrichtung');
    for (const id of ['meta-instagram', 'linkedin']) {
      const e = EMPFAENGER_START.find(x => x.id === id)!;
      expect(e, id).toBeTruthy();
      expect(e.archiviert).toBe(true);
      expect(empfaengerPruefen(e).ok, id).toBe(true);
    }
    const gespeichert = [EMPFAENGER_START.find(x => x.id === 'hetzner')!];
    const w = empfaengerWirksam({ empfaenger: gespeichert });
    expect(w.map(x => x.id)).toEqual(expect.arrayContaining(['hetzner', 'meta-instagram', 'linkedin']));
  });
});

// ── Fund 3: Art. 15 zählte Check-Sitzungen, Formular-Eingänge und Social-Einträge, nannte aber ihre Verarbeitung nicht ──
describe('Fund 3 · Kontakt-Auskunft nennt die Verarbeitungen der neuen Bestände', () => {
  it('kontaktBereiche/verarbeitungenFuer', async () => {
    const { kontaktBereiche, verarbeitungenFuer } = await import('@/lib/datenschutz/art15');
    const b = kontaktBereiche({ weitereSpeicher: { 'check-sitzungen': 1, 'angebot-formular--h-x': 2, 'social-community--h-x': 1 } });
    expect(b).toEqual(expect.arrayContaining(['check', 'formular', 'social']));
    expect(verarbeitungenFuer('kontakt', b)).toEqual(expect.arrayContaining(['vv-innovations-check', 'vv-angebot-formular', 'vv-social']));
    expect(kontaktBereiche({ weitereSpeicher: { 'agent-log': 1 } })).not.toEqual(expect.arrayContaining(['check']));
  });
});

// ── Fund 4: Zusammenführen (Dubletten) ließ Kontakt-Kennungen an Rechnungen, Formular-Eingängen und Check-Sitzungen tot zurück ──
describe('Fund 4 · Zusammenführen biegt die neuen Kontakt-Verweise um', () => {
  it('Rechnung, Formular-Eingang und Check-Sitzung zeigen danach auf die behaltene Person; Art. 15 findet die Rechnung', async () => {
    const ALT = 'c-00000000-0000-4000-8000-0000000000a1', NEU = 'c-00000000-0000-4000-8000-0000000000b2', ANDERE = 'c-00000000-0000-4000-8000-0000000000c3';
    await db.saveJson('finanzplan', { rechnungen: [
      { id: 're-1', titel: 'Erfunden', status: 'gestellt', betrag: 119, kontaktId: ALT, firmaId: 'kdv' },
      { id: 're-2', titel: 'Andere', status: 'entwurf', betrag: 10, kontaktId: ANDERE, firmaId: 'kdv' },
    ] });
    await db.saveJson('angebot-formular--h-um', { v: 1, einstellungen: {}, links: [], eingaenge: [{ id: 'af-1', am: vor(1), status: 'verschickt', quelle: 'intern', von: 'p', kontaktId: ALT }] });
    await db.saveJson('check-sitzungen', { sitzungen: [{ id: 'ck-1', geaendert: vor(1), crm: { status: 'ok', am: vor(1), kontaktId: ALT } }] });
    const { personenUmbiegen } = await import('@/lib/crm/person-bestaende');
    const r = await personenUmbiegen(new Map([[ALT, NEU]]));
    expect(r.speicher).toMatchObject({ finanzplan: 1, 'angebot-formular--h-um': 1, 'check-sitzungen': 1 });
    const f = await db.loadJson<{ rechnungen: { id: string; kontaktId?: string }[] }>('finanzplan');
    expect(f!.rechnungen.map(x => x.kontaktId)).toEqual([NEU, ANDERE]);
    expect((await db.loadJson<{ eingaenge: { kontaktId?: string }[] }>('angebot-formular--h-um'))!.eingaenge[0].kontaktId).toBe(NEU);
    expect((await db.loadJson<{ sitzungen: { crm?: { kontaktId?: string } }[] }>('check-sitzungen'))!.sitzungen[0].crm?.kontaktId).toBe(NEU);
    const { rechnungenAuskunft } = await import('@/lib/finanzen/rechnung/server');
    expect((await rechnungenAuskunft(NEU)).map(x => x.id)).toEqual(['re-1']);
    // idempotent
    const zweiter = await personenUmbiegen(new Map([[ALT, NEU]]));
    expect(zweiter.speicher.finanzplan).toBeUndefined();
  });
});
