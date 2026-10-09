// ─── E4-Rest (09.10., Kevin: „Ja, Privates bleibt privat“): „nur Business“ auch in Routinen, Blöcken, Zielen, Fokus, Meilensteinen ─────────
// Wächter „Sicht Business bekommt nichts aus Privat“: ein Konto mit `finanzRecht: 'business'` (Partner) bekommt aus `/api/state/routinen`,
// `/api/state/ziele` und `/api/state/meilensteine` nichts aus dem Privat-Bereich des Haushalts — weder beim Lesen noch in der Antwort eines
// Schreibens noch im 409. Schreiben auf Vorhandenes im Privat-Bereich → 404, Neues/Verschobenes dorthin → 403, die Altwege PUT behalten
// das Ausgeblendete. Dazu die Leser, die dieselbe Regel nehmen (`meilensteineSichtbarFuer`, Gesundheits-Stand, Überblick „Für dich“) und
// die Gegenprobe: volle Mitglieder unverändert, Testkunde/fremder Haushalt bekommen die Planung des Haushalts gar nicht.
// Eigener Datenordner, erfundene Konten (`@example.invalid`) und Marken, kein Netz, kein KI-Aufruf.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-konto-sicht-planung-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_VAULT_DIR: path.join(ordner, 'vault') });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true, maxRetries: 3 });
});

const HAUS = 'haus-ksp';
/** Marken aus dem Privat-Bereich des Haushalts — keine darf je beim Partner ankommen. */
const PRIVAT = {
  routine: 'KSP-PRIVAT-ROUTINE',
  routineSelbst: 'KSP-SELBST-ROUTINE',
  routinePartnerAlt: 'KSP-PARTNER-ALT-PRIVAT',
  block: 'KSP-PRIVAT-BLOCK',
  blockSelbst: 'KSP-SELBST-BLOCK',
  ziel: 'KSP-PRIVAT-ZIEL',
  zielSelbst: 'KSP-SELBST-ZIEL',
  zielQuartal: 'KSP-PRIVAT-QUARTAL',
  fokus: 'KSP-PRIVAT-FOKUS',
  fokusGemeinsam: 'KSP-GEMEINSAM-FOKUS',
  meilenstein: 'KSP-PRIVAT-MEILENSTEIN',
  meilensteinAlt: 'KSP-GESUNDHEIT-MEILENSTEIN',
  meilensteinSelbst: 'KSP-SELBST-MEILENSTEIN',
};
const BUSINESS = { routine: 'KSP-BUSINESS-ROUTINE', block: 'KSP-BUSINESS-BLOCK', ziel: 'KSP-BUSINESS-ZIEL', zielOhne: 'KSP-OHNE-SPACE-ZIEL', fokus: 'KSP-BUSINESS-FOKUS', meilenstein: 'KSP-BUSINESS-MEILENSTEIN' };
const lecks = (text: string) => Object.entries(PRIVAT).filter(([, m]) => text.includes(m)).map(([n]) => n);

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
const KONTEN = [
  konto('k1', 'inhaberin', 'inhaber', { haushalt: HAUS }),
  konto('k2', 'zweite', 'mitglied', { haushalt: HAUS }),
  konto('k3', 'partner', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' }),
  konto('k4', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
  konto('k5', 'kunde', 'mitglied'),
];
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
type H = (r: Request, ctx?: unknown) => Promise<Response>;
type R3 = { GET: H; PUT: H; PATCH: H };
async function rufe(h: H, pfad: string, person: string, method = 'GET', body?: unknown): Promise<{ status: number; text: string; d: Record<string, unknown> }> {
  const r = await h(new Request(`http://test${pfad}`, { method, headers: sitzung(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { params: Promise.resolve({}) });
  const text = await r.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(text) as Record<string, unknown>; } catch { /* kein JSON */ }
  return { status: r.status, text, d };
}

let db: typeof import('@/lib/store/local-db');
let SELBST = '';
let H0 = '';
let routinenR: R3, zieleR: R3, msR: R3;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const { localDay, tagePlus } = await import('@/lib/zeit');
  H0 = localDay();
  SELBST = (await import('@/lib/einheiten')).PRIVAT_EINHEITEN_NAMEN[0] ?? '';
  expect(SELBST, 'Die Instanz kennt eine Privat-Einheit (Selbstständigkeit)').not.toBe('');
  routinenR = (await import('@/app/api/state/routinen/route')) as unknown as R3;
  zieleR = (await import('@/app/api/state/ziele/route')) as unknown as R3;
  msR = (await import('@/app/api/state/meilensteine/route')) as unknown as R3;
  await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
  const r = (id: string, label: string, extra: Record<string, unknown> = {}) => ({ id, label, wann: 'morgen', kategorie: 'leben', dauerMin: 15, aktiv: true, owner: 'beide', ...extra });
  const bl = (id: string, owner: string, art: 'privat' | 'business', titel: string, extra: Record<string, unknown> = {}) => ({ id, owner, wochentag: 2, von: '09:00', bis: '10:00', art, titel, ...extra });
  await db.saveJson('routinen', {
    routinen: [
      r('r-privat', PRIVAT.routine, { space: 'privat', kategorie: 'gesundheit' }),
      r('r-selbst', PRIVAT.routineSelbst, { space: 'business', einheit: SELBST }),
      r('r-partner-alt', PRIVAT.routinePartnerAlt, { owner: 'partner' }), // Altbestand: ohne Space = Privat
      r('r-biz', BUSINESS.routine, { space: 'business' }),
    ],
    bloecke: [
      bl('bl-privat', 'inhaberin', 'privat', PRIVAT.block),
      bl('bl-selbst', 'inhaberin', 'business', PRIVAT.blockSelbst, { einheit: SELBST }),
      bl('bl-biz', 'partner', 'business', BUSINESS.block),
      bl('bl-biz-inhaberin', 'inhaberin', 'business', 'KSP-BUSINESS-BLOCK-INHABERIN'),
    ],
  });
  const z = (id: string, titel: string, extra: Record<string, unknown> = {}) => ({ id, titel, fortschritt: 10, ...extra });
  await db.saveJson('ziele', {
    tag: [], woche: [], monat: [],
    quartal: [z('zq-privat', PRIVAT.zielQuartal, { space: 'privat' })],
    jahr: [z('z-privat', PRIVAT.ziel, { space: 'privat' }), z('z-selbst', PRIVAT.zielSelbst, { space: 'business', einheit: SELBST }), z('z-biz', BUSINESS.ziel, { space: 'business' }), z('z-ohne', BUSINESS.zielOhne)],
    fokus: { jahr: PRIVAT.fokusGemeinsam, 'privat:jahr': PRIVAT.fokus, 'business:jahr': BUSINESS.fokus },
  });
  const m = (id: string, titel: string, extra: Record<string, unknown> = {}) => ({ id, titel, faellig: tagePlus(H0, 5), fortschritt: 0, erledigt: false, ...extra });
  await db.saveJson('meilensteine', { meilensteine: [
    m('ms-privat', PRIVAT.meilenstein, { space: 'privat', bereich: 'gesundheit' }),
    m('ms-alt', PRIVAT.meilensteinAlt, { bereich: 'gesundheit' }), // Altbestand ohne `space`
    m('ms-selbst', PRIVAT.meilensteinSelbst, { space: 'business', bereich: 'business', einheit: SELBST }),
    m('ms-biz', BUSINESS.meilenstein, { space: 'business', bereich: 'business' }),
  ] });
}, 60_000);

describe('Die reine Regel (lib/planung/bereich-sicht.ts)', () => {
  it('Bereich über die vorhandenen Regeln: Selbstständigkeit = Privat, Routine ohne Space = Privat, Ziel ohne Space = Business, Fokus nur `business:`', async () => {
    const b = await import('@/lib/planung/bereich-sicht');
    expect(b.routineImPrivat({})).toBe(true);
    expect(b.routineImPrivat({ space: 'business', einheit: SELBST })).toBe(true);
    expect(b.routineImPrivat({ space: 'business' })).toBe(false);
    expect(b.blockImPrivat({ art: 'business', einheit: SELBST })).toBe(true);
    expect(b.blockImPrivat({ art: 'business' })).toBe(false);
    expect(b.zielImPrivat({})).toBe(false);
    expect(b.zielImPrivat({ space: 'business', einheit: SELBST })).toBe(true);
    expect(b.meilensteinImPrivat({ bereich: 'gesundheit' })).toBe(true);
    expect(b.meilensteinImPrivat({ bereich: 'business' })).toBe(false);
    expect(Object.keys(b.fokusOhnePrivat({ jahr: 'a', 'privat:jahr': 'b', 'business:jahr': 'c', 'prio:x': 'd', 'business:prio:x': 'e' }))).toEqual(['business:jahr', 'business:prio:x']);
    // Schreiben: vorhanden + privat → 404-Satz; neu/verschoben nach privat → 403-Satz; Business bleibt frei.
    type Z = { id: string; space?: 'privat' | 'business' };
    const liste: Z[] = [{ id: 'a', space: 'privat' }, { id: 'b', space: 'business' }];
    expect(b.privatSchreibPruefen<Z>(liste, [{ op: 'delete', id: 'a' }], b.zielImPrivat)).toBe(b.PLANUNG_NICHT_GEFUNDEN);
    expect(b.privatSchreibPruefen<Z>(liste, [{ op: 'teil', id: 'b', felder: { space: 'privat' } }], b.zielImPrivat)).toBe(b.NUR_BUSINESS_PRIVAT);
    expect(b.privatSchreibPruefen<Z>(liste, [{ op: 'upsert', eintrag: { id: 'c', space: 'privat' } }], b.zielImPrivat)).toBe(b.NUR_BUSINESS_PRIVAT);
    expect(b.privatSchreibPruefen<Z>(liste, [{ op: 'upsert', eintrag: { id: 'b', space: 'business' } }], b.zielImPrivat)).toBeNull();
    expect(b.privatStatus(b.PLANUNG_NICHT_GEFUNDEN)).toBe(404);
    expect(b.privatStatus(b.NUR_BUSINESS_PRIVAT)).toBe(403);
    // Vollschreiben behält das Ausgeblendete.
    expect(b.privatBehalten<Z>(liste, [{ id: 'b', space: 'business' }], b.zielImPrivat)).toEqual({ liste: [{ id: 'b', space: 'business' }, { id: 'a', space: 'privat' }] });
    expect(b.privatBehalten<Z>(liste, [{ id: 'a', space: 'business' }], b.zielImPrivat)).toEqual({ fehler: b.PLANUNG_NICHT_GEFUNDEN });
  });

  it('Umfang je Person (Server): volles Mitglied alles, Partner Business, Testkunde/fremder Haushalt nichts, Systemlauf alles', async () => {
    const { planungsUmfangFuer } = await import('@/lib/planung/bereich-sicht-server');
    expect(await planungsUmfangFuer('zweite')).toBe('alles');
    expect(await planungsUmfangFuer('inhaberin')).toBe('alles');
    expect(await planungsUmfangFuer('partner')).toBe('business');
    expect(await planungsUmfangFuer('kunde')).toBe('nichts');
    expect(await planungsUmfangFuer('gast')).toBe('nichts');
    expect(await planungsUmfangFuer(null)).toBe('alles');
  });
});

describe('Lesen: Partner bekommt nichts aus Privat — volle Mitglieder alles', () => {
  it('GET /api/state/routinen (auch ?sicht=ich): keine Routine/kein Block des Privat-Bereichs, auch kein „Belegt“', async () => {
    for (const q of ['', '?sicht=ich']) {
      const p = await rufe(routinenR.GET, `/api/state/routinen${q}`, 'partner');
      expect(p.status).toBe(200);
      expect(lecks(p.text), q).toEqual([]);
      expect(p.text).toContain(BUSINESS.routine);
      const bloecke = p.d.bloecke as { id: string; belegt?: boolean }[];
      expect(bloecke.map(b => b.id).sort(), q).toEqual(['bl-biz', 'bl-biz-inhaberin']);
      expect(bloecke.find(b => b.id === 'bl-biz-inhaberin')?.belegt).toBe(true); // fremde Business-Blöcke weiter nur „Belegt“
      expect((p.d.routinen as { id: string }[]).map(r => r.id)).toEqual(['r-biz']);
    }
    const z = await rufe(routinenR.GET, '/api/state/routinen', 'zweite');
    // Volles Mitglied: die gemeinsamen Privat-Routinen voll; Routinen und Blöcke einer anderen Person nur „Belegt“ (ohne Titel, 08.10.).
    expect(lecks(z.text).sort()).toEqual(['routine', 'routineSelbst']);
    expect((z.d.bloecke as unknown[]).length).toBe(4);
  });

  it('GET /api/state/ziele (wir, ich): keine Privat-Ziele (auch Selbstständigkeit, alle Horizonte), Fokus nur `business:`', async () => {
    const p = await rufe(zieleR.GET, '/api/state/ziele', 'partner');
    expect(p.status).toBe(200);
    expect(lecks(p.text)).toEqual([]);
    expect(p.text).toContain(BUSINESS.ziel);
    expect(p.text).toContain(BUSINESS.zielOhne);
    expect(p.d.fokus).toEqual({ 'business:jahr': BUSINESS.fokus });
    const ich = await rufe(zieleR.GET, '/api/state/ziele?fuer=ich', 'partner');
    expect(ich.status).toBe(200);
    expect(lecks(ich.text)).toEqual([]);
    const z = await rufe(zieleR.GET, '/api/state/ziele', 'zweite');
    expect(lecks(z.text).sort()).toEqual(['fokus', 'fokusGemeinsam', 'ziel', 'zielQuartal', 'zielSelbst'].sort());
  });

  it('GET /api/state/meilensteine: keine Privat-Meilensteine (Privat, Altbestand Gesundheit, Selbstständigkeit)', async () => {
    const p = await rufe(msR.GET, '/api/state/meilensteine', 'partner');
    expect(p.status).toBe(200);
    expect(lecks(p.text)).toEqual([]);
    expect((p.d.meilensteine as { id: string }[]).map(m => m.id)).toEqual(['ms-biz']);
    const z = await rufe(msR.GET, '/api/state/meilensteine', 'zweite');
    expect((z.d.meilensteine as unknown[]).length).toBe(4);
  });

  it('Leser über `meilensteineSichtbarFuer`: Partner nur Business, Testkunde/fremder Haushalt nichts, volles Mitglied alles', async () => {
    const { meilensteineSichtbarFuer } = await import('@/lib/planung/eigene-ziele-sicht-server');
    const alle = (await db.loadJson<{ meilensteine: { id: string; zielId?: string }[] }>('meilensteine'))!.meilensteine;
    expect((await meilensteineSichtbarFuer(alle, 'partner')).map(m => m.id)).toEqual(['ms-biz']);
    expect(await meilensteineSichtbarFuer(alle, 'kunde')).toEqual([]);
    expect(await meilensteineSichtbarFuer(alle, 'gast')).toEqual([]);
    expect((await meilensteineSichtbarFuer(alle, 'zweite')).length).toBe(4);
    expect((await meilensteineSichtbarFuer(alle, null)).length).toBe(4); // Systemlauf wie bisher
  });

  it('Meilenstein-Seite (/api/planung/meilenstein): Partner öffnet Business (vorher 403 — kein Haushalt), Privat gibt es für ihn nicht (404)', async () => {
    const M = (await import('@/app/api/planung/meilenstein/route')) as unknown as { GET: H };
    const biz = await rufe(M.GET, '/api/planung/meilenstein?id=ms-biz', 'partner');
    expect(biz.status, biz.text).toBe(200);
    expect(biz.text).toContain(BUSINESS.meilenstein);
    for (const id of ['ms-privat', 'ms-alt', 'ms-selbst']) {
      const r = await rufe(M.GET, `/api/planung/meilenstein?id=${id}`, 'partner');
      expect(r.status, id).toBe(404);
      expect(lecks(r.text), id).toEqual([]);
    }
    expect((await rufe(M.GET, '/api/planung/meilenstein?id=ms-privat', 'zweite')).status).toBe(200);
    expect((await rufe(M.GET, '/api/planung/meilenstein?id=ms-biz', 'kunde')).status).toBe(403);
  });

  it('Gesundheits-Stand: Partner ohne Privat-Routinen, Testkunde und fremder Haushalt ohne die Routinen des Haushalts', async () => {
    const G = (await import('@/app/api/gesundheit/stand/route')) as unknown as { GET: H };
    for (const wer of ['partner', 'kunde', 'gast']) {
      const r = await rufe(G.GET, '/api/gesundheit/stand', wer);
      expect(r.status, wer).toBe(200);
      expect(lecks(r.text), wer).toEqual([]);
    }
    expect((await rufe(G.GET, '/api/gesundheit/stand', 'zweite')).text).toContain(PRIVAT.routine);
  });

  it('Überblick „Für dich“ (lib/fluss): Partner — Planung nur Business, Familie und private Finanzen gar nicht', async () => {
    const { flussLaden } = await import('@/lib/fluss/server');
    const p = await flussLaden({ bereich: 'planung', person: 'partner', heute: H0 });
    expect(lecks(JSON.stringify(p))).toEqual([]);
    expect(JSON.stringify(p)).toContain(BUSINESS.meilenstein);
    expect(await flussLaden({ bereich: 'planung', person: 'partner', heute: H0, space: 'privat' })).toBeNull();
    expect(await flussLaden({ bereich: 'familie', person: 'partner', heute: H0 })).toBeNull();
    expect(await flussLaden({ bereich: 'finanzen-privat', person: 'partner', heute: H0 })).toBeNull();
    const z = await flussLaden({ bereich: 'planung', person: 'zweite', heute: H0 });
    expect(JSON.stringify(z)).toContain(PRIVAT.meilenstein);
  });
});

describe('Schreiben: Privat 404/403, Antworten ohne Privat — volle Mitglieder unverändert', () => {
  it('Routinen PATCH: vorhandene Privat-Routine 404 (ändern, löschen, auch die eigene Alt-Routine), neu/verschoben nach Privat 403, Business frei', async () => {
    const vorher = JSON.stringify(await db.loadJson('routinen'));
    const fall = async (ops: unknown[], status: number) => {
      const r = await rufe(routinenR.PATCH, '/api/state/routinen', 'partner', 'PATCH', { ops });
      expect(r.status, JSON.stringify(ops)).toBe(status);
      expect(lecks(r.text), JSON.stringify(ops)).toEqual([]);
      return r;
    };
    await fall([{ op: 'teil', id: 'r-privat', felder: { dauerMin: 30 } }], 404);
    await fall([{ op: 'delete', id: 'r-privat' }], 404);
    await fall([{ op: 'delete', id: 'r-partner-alt' }], 404);
    await fall([{ op: 'teil', id: 'r-biz', felder: { space: 'privat' } }], 403);
    await fall([{ op: 'teil', id: 'r-biz', felder: { einheit: SELBST } }], 403);
    await fall([{ op: 'upsert', eintrag: { id: 'r-neu-privat', label: 'Neu', wann: 'abend', kategorie: 'leben', dauerMin: 15, aktiv: true, owner: 'partner', space: 'privat' } }], 403);
    await fall([{ op: 'upsert', eintrag: { id: 'r-neu-ohne', label: 'Neu', wann: 'abend', kategorie: 'leben', dauerMin: 15, aktiv: true, owner: 'partner' } }], 403); // ohne Space = Privat
    expect(JSON.stringify(await db.loadJson('routinen'))).toBe(vorher); // nichts geschrieben
    const ok = await fall([{ op: 'upsert', eintrag: { id: 'r-neu-biz', label: 'KSP-NEU-BUSINESS', wann: 'tag', kategorie: 'business', dauerMin: 15, aktiv: true, owner: 'partner', space: 'business' } }], 200);
    expect(ok.text).toContain('KSP-NEU-BUSINESS');
    // 409 (veralteter Stand an einer Business-Routine): die Antwort trägt nichts aus Privat.
    await fall([{ op: 'teil', id: 'r-biz', felder: { dauerMin: 20 }, stand: 'veraltet' }], 409);
    // Volles Mitglied ändert Privat wie bisher.
    const z = await rufe(routinenR.PATCH, '/api/state/routinen', 'zweite', 'PATCH', { ops: [{ op: 'teil', id: 'r-privat', felder: { dauerMin: 25 } }] });
    expect(z.status).toBe(200);
  });

  it('Routinen PUT (Altweg): die Privat-Routinen bleiben in ihrer gespeicherten Fassung, eine davon nennen → 404', async () => {
    const g = await rufe(routinenR.GET, '/api/state/routinen', 'partner');
    const sicht = (g.d.routinen as Record<string, unknown>[]).map(({ stand: _s, ...r }) => r);
    const ok = await rufe(routinenR.PUT, '/api/state/routinen', 'partner', 'PUT', { routinen: sicht.map(r => (r.id === 'r-biz' ? { ...r, dauerMin: 45 } : r)) });
    expect(ok.status, ok.text).toBe(200);
    expect(lecks(ok.text)).toEqual([]);
    const gespeichert = (await db.loadJson<{ routinen: { id: string; dauerMin: number }[] }>('routinen'))!.routinen;
    expect(gespeichert.map(r => r.id)).toEqual(expect.arrayContaining(['r-privat', 'r-selbst', 'r-partner-alt']));
    expect(gespeichert.find(r => r.id === 'r-biz')?.dauerMin).toBe(45);
    const nein = await rufe(routinenR.PUT, '/api/state/routinen', 'partner', 'PUT', { routinen: [...sicht, { id: 'r-privat', label: 'Übernommen', wann: 'morgen', kategorie: 'leben', dauerMin: 15, aktiv: true, owner: 'beide', space: 'business' }] });
    expect(nein.status).toBe(404);
  });

  it('Blöcke PATCH: fremder Privat-Block 404 (vor „nur eigene“), eigener neuer Privat-Block 403, Business frei', async () => {
    const fall = async (bloecke: unknown[], status: number) => {
      const r = await rufe(routinenR.PATCH, '/api/state/routinen', 'partner', 'PATCH', { bloecke });
      expect(r.status, JSON.stringify(bloecke)).toBe(status);
      expect(lecks(r.text)).toEqual([]);
    };
    await fall([{ op: 'delete', id: 'bl-privat' }], 404);
    await fall([{ op: 'delete', id: 'bl-selbst' }], 404);
    await fall([{ op: 'upsert', eintrag: { id: 'bl-neu-privat', owner: 'partner', wochentag: 3, von: '18:00', bis: '19:00', art: 'privat' } }], 403);
    await fall([{ op: 'upsert', eintrag: { id: 'bl-neu-selbst', owner: 'partner', wochentag: 3, von: '18:00', bis: '19:00', art: 'business', einheit: SELBST } }], 403);
    await fall([{ op: 'upsert', eintrag: { id: 'bl-neu-biz', owner: 'partner', wochentag: 3, von: '08:00', bis: '09:00', art: 'business' } }], 200);
    await fall([{ op: 'delete', id: 'bl-biz-inhaberin' }], 403); // fremder Business-Block: wie bisher „nur eigene“
  });

  it('Ziele PATCH/PUT: Privat 404/403, Fokus nur `business:`, 409 ohne Privat — volles Mitglied unverändert', async () => {
    const vorher = JSON.stringify(await db.loadJson('ziele'));
    const fall = async (horizont: string, ops: unknown[], status: number) => {
      const r = await rufe(zieleR.PATCH, '/api/state/ziele', 'partner', 'PATCH', { horizont, ops });
      expect(r.status, JSON.stringify(ops)).toBe(status);
      expect(lecks(r.text), JSON.stringify(ops)).toEqual([]);
      return r;
    };
    await fall('jahr', [{ op: 'teil', id: 'z-privat', felder: { fortschritt: 50 } }], 404);
    await fall('jahr', [{ op: 'delete', id: 'z-selbst' }], 404);
    await fall('quartal', [{ op: 'delete', id: 'zq-privat' }], 404);
    await fall('jahr', [{ op: 'teil', id: 'z-biz', felder: { space: 'privat' } }], 403);
    await fall('jahr', [{ op: 'upsert', eintrag: { id: 'z-neu-privat', titel: 'Neu', space: 'privat' } }], 403);
    expect(JSON.stringify(await db.loadJson('ziele'))).toBe(vorher);
    await fall('jahr', [{ op: 'upsert', eintrag: { id: 'z-biz', titel: BUSINESS.ziel, space: 'business' }, stand: 'veraltet' }], 409);
    const ok = await fall('jahr', [{ op: 'upsert', eintrag: { id: 'z-neu-biz', titel: 'KSP-NEU-ZIEL', space: 'business' } }], 200);
    expect(ok.text).toContain('KSP-NEU-ZIEL');
    for (const h of ['privat:jahr', 'jahr', 'tag']) {
      const f = await rufe(zieleR.PUT, '/api/state/ziele', 'partner', 'PUT', { horizont: h, fokus: 'Übernommen' });
      expect(f.status, h).toBe(403);
    }
    const fb = await rufe(zieleR.PUT, '/api/state/ziele', 'partner', 'PUT', { horizont: 'business:jahr', fokus: 'KSP-NEU-FOKUS' });
    expect(fb.status).toBe(200);
    expect(lecks(fb.text)).toEqual([]);
    expect(fb.d.fokus).toMatchObject({ 'business:jahr': 'KSP-NEU-FOKUS' });
    const gespeichert = (await db.loadJson<{ fokus: Record<string, string> }>('ziele'))!.fokus;
    expect(gespeichert['privat:jahr']).toBe(PRIVAT.fokus); // Privat unberührt
    const z = await rufe(zieleR.PATCH, '/api/state/ziele', 'zweite', 'PATCH', { horizont: 'jahr', ops: [{ op: 'teil', id: 'z-privat', felder: { fortschritt: 40 } }] });
    expect(z.status).toBe(200);
    expect(z.text).toContain(PRIVAT.ziel);
  });

  it('Bezüge zurücksetzen (/api/planung/bezuege): Partner setzt nichts im Privat-Bereich — Privat-Ziel 404, Privat-Meilenstein bleibt', async () => {
    const B = (await import('@/app/api/planung/bezuege/route')) as unknown as { POST: H };
    const leer = { ziele: [], meilensteine: [], aufgaben: [], projekte: [] };
    const p = await rufe(B.POST, '/api/planung/bezuege', 'partner', 'POST', { art: 'zurueck', geloest: { ...leer, zielId: 'z-privat' } });
    expect(p.status).toBe(404);
    const vorher = JSON.stringify(await db.loadJson('meilensteine'));
    const b = await rufe(B.POST, '/api/planung/bezuege', 'partner', 'POST', { art: 'zurueck', geloest: { ...leer, zielId: 'z-biz', meilensteine: ['ms-privat', 'ms-alt'] } });
    expect(b.status, b.text).toBe(200);
    expect((b.d.gesetzt as { meilensteine: number }).meilensteine).toBe(0);
    expect(JSON.stringify(await db.loadJson('meilensteine'))).toBe(vorher);
  });

  it('Meilensteine PATCH/PUT: Privat 404/403, 409 ohne Privat, PUT behält das Ausgeblendete', async () => {
    const vorher = JSON.stringify(await db.loadJson('meilensteine'));
    const fall = async (ops: unknown[], status: number) => {
      const r = await rufe(msR.PATCH, '/api/state/meilensteine', 'partner', 'PATCH', { ops });
      expect(r.status, JSON.stringify(ops)).toBe(status);
      expect(lecks(r.text), JSON.stringify(ops)).toEqual([]);
      return r;
    };
    await fall([{ op: 'teil', id: 'ms-privat', felder: { fortschritt: 50 } }], 404);
    await fall([{ op: 'delete', id: 'ms-alt' }], 404);
    await fall([{ op: 'delete', id: 'ms-selbst' }], 404);
    await fall([{ op: 'teil', id: 'ms-biz', felder: { space: 'privat' } }], 403);
    await fall([{ op: 'upsert', eintrag: { id: 'ms-neu', titel: 'Neu', space: 'privat', faellig: H0 } }], 403);
    expect(JSON.stringify(await db.loadJson('meilensteine'))).toBe(vorher);
    await fall([{ op: 'teil', id: 'ms-biz', felder: { fortschritt: 30 }, stand: 'veraltet' }], 409);
    await fall([{ op: 'teil', id: 'ms-biz', felder: { fortschritt: 30 } }], 200);
    const put = await rufe(msR.PUT, '/api/state/meilensteine', 'partner', 'PUT', { meilensteine: [{ id: 'ms-biz', titel: BUSINESS.meilenstein, space: 'business', faellig: H0, fortschritt: 35, erledigt: false }] });
    expect(put.status, put.text).toBe(200);
    expect(lecks(put.text)).toEqual([]);
    const gespeichert = (await db.loadJson<{ meilensteine: { id: string }[] }>('meilensteine'))!.meilensteine.map(m => m.id);
    expect(gespeichert).toEqual(expect.arrayContaining(['ms-privat', 'ms-alt', 'ms-selbst', 'ms-biz']));
    const nein = await rufe(msR.PUT, '/api/state/meilensteine', 'partner', 'PUT', { meilensteine: [{ id: 'ms-privat', titel: 'Übernommen', space: 'business', faellig: H0, fortschritt: 0, erledigt: false }] });
    expect(nein.status).toBe(404);
    const z = await rufe(msR.PATCH, '/api/state/meilensteine', 'zweite', 'PATCH', { ops: [{ op: 'teil', id: 'ms-privat', felder: { fortschritt: 20 } }] });
    expect(z.status).toBe(200);
  });
});
