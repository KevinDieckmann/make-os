// ─── Wächter „Sicht Business zeigt nie Privat-Themen — und Privat keine reinen Business-Themen“ (10.10., Branch `sweep-bereiche`) ──────
// Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat — wir haben im Business-Bereich keinen Bereich, der Familie und
// Partnerschaft heißt. Guck, dass das nicht mehr passiert.“
//
// (1) Reine Regeln: `lib/zugang/sicht-bereich.ts` (Routen nur eines Bereichs), `lib/flaeche/sicht.ts` (welches Widget in welche Sicht — Standard
//     von Heute und der Katalog), `lib/zeitmessung/modell.ts` `bildFuerSicht`.
// (2) Die Middleware sperrt eine Route des anderen Bereichs (`?space=`) mit 403, bevor die Route läuft.
// (3) ALLE lesenden Routen aus dem Routen-Register mit der Sitzung der Inhaberin (sie darf beide Bereiche sehen) — einmal in der Sicht Business
//     (`?space=business`), einmal in der Sicht Privat: keine Antwort in Business trägt eine Privat-Marke (Familie, Gesundheit, Erholung, Haushalt,
//     Privat-Aufgabe, Selbstständigkeit, private Ziele/Routinen/Termine/Mails/Threads …), keine in Privat eine reine Business-Marke (Markttraktion,
//     Business-Aufgaben/-Ziele/-Termine/-Mails/-Threads). Neue Routen und Bestände fallen automatisch darunter: wer eine Route baut, die Inhalte
//     beider Bereiche liefert, filtert mit `?space=` (lib/zugang/sicht-bereich.ts `sichtDerAnfrage`) — oder trägt sie, wenn sie nur EINEM Bereich
//     dient, in `ROUTEN_BEREICH` ein. Gegenprobe: jede Marke kommt in ihrer eigenen Sicht an (die Saat ist lesbar).
// Eigener Datenordner, erfundene Werte (`@example.invalid`), kein Netz, nie der echte Vault.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-sicht-bp-'));
const daten = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_KEY ??= 'pruef-schluessel-sicht-business-privat';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

/** Marken des Privat-Bereichs — keine darf in einer Antwort der Sicht Business stehen. */
const PRIVAT = {
  familie: 'MARKE-PRIVAT-FAMILIE',
  geburtstag: 'MARKE-PRIVAT-GEBURTSTAG',
  gesundheit: 'MARKE-PRIVAT-GESUNDHEIT',
  erholung: 'MARKE-PRIVAT-ERHOLUNG',
  journal: 'MARKE-PRIVAT-JOURNAL',
  haushalt: 'MARKE-PRIVAT-HAUSHALT',
  aufgabe: 'MARKE-PRIVAT-AUFGABE',
  selbst: 'MARKE-PRIVAT-SELBST',
  ziel: 'MARKE-PRIVAT-ZIEL',
  fokus: 'MARKE-PRIVAT-FOKUS',
  meilenstein: 'MARKE-PRIVAT-MEILENSTEIN',
  routine: 'MARKE-PRIVAT-ROUTINE',
  termin: 'MARKE-PRIVAT-TERMIN',
  zoe: 'MARKE-PRIVAT-ZOE',
  head: 'MARKE-PRIVAT-HEAD',
  mail: 'MARKE-PRIVAT-MAIL',
  ernaehrung: 'MARKE-PRIVAT-ERNAEHRUNG',
  zeit: 'MARKE-PRIVAT-ZEIT',
  meldung: 'MARKE-PRIVAT-MELDUNG',
  widget: 'MARKE-PRIVAT-WIDGET',
};
/** Marken des Business-Bereichs — keine darf in einer Antwort der Sicht Privat stehen. */
const BUSINESS = {
  crm: 'MARKE-BUSINESS-CRM',
  aufgabe: 'MARKE-BUSINESS-AUFGABE',
  ziel: 'MARKE-BUSINESS-ZIEL',
  fokus: 'MARKE-BUSINESS-FOKUS',
  meilenstein: 'MARKE-BUSINESS-MEILENSTEIN',
  routine: 'MARKE-BUSINESS-ROUTINE',
  termin: 'MARKE-BUSINESS-TERMIN',
  zoe: 'MARKE-BUSINESS-ZOE',
  head: 'MARKE-BUSINESS-HEAD',
  mail: 'MARKE-BUSINESS-MAIL',
  zeit: 'MARKE-BUSINESS-ZEIT',
  meldung: 'MARKE-BUSINESS-MELDUNG',
  widget: 'MARKE-BUSINESS-WIDGET',
};

/**
 * Bewusst beide Bereiche (mit Grund) — Route und Marke. Nur Auskünfte/Exporte der eigenen Daten, keine Ansicht, die dem Kopf-Schalter folgt.
 * Neue Einträge nur mit gutem Grund — eine Ansicht gehört nie hierher.
 */
const BEIDE_GEWOLLT: Record<string, string> = {
  'konto/daten': 'Auskunft/Export aller eigenen Daten (Art. 15/20) — kein Blick in eine Sicht, sondern die ganze Person',
  'aufgaben/export': 'Export aller eigenen Aufgaben (Datenübertragbarkeit, Art. 20) — eine Datei, keine Ansicht',
};

type Handler = (r: Request) => Promise<Response>;
type Sicht = 'privat' | 'business';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const schreiben = (h: Handler, methode: string, pfad: string, person: string, body: unknown) =>
  h(new Request(`http://test${pfad}`, { method: methode, headers: sitzung(person), body: JSON.stringify(body) }));
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-sicht' });

const UEBERSPRUNGEN: Record<string, string> = { 'jarvis/[...pfad]': 'nur 308-Weiterleitung auf /api/zoe/* — die Ziele werden selbst geprüft' };
/** Zusätze je Route (Pflicht-Parameter) — je Sicht. */
const zusatz = (pfad: string, sicht: Sicht): string | undefined => ({
  'state/flaeche': `seite=uebersicht-${sicht}`,
  'agenten/skills': `head=${sicht === 'privat' ? 'assistenz' : 'sales'}`,
} as Record<string, string>)[pfad];
const SEGMENTE: Record<string, string | string[]> = { head: 'sales', slug: 'sicht-0123456789abcdef01234567', token: 'x', pfad: ['wissen'] };
type Ctx = { params: Promise<Record<string, string | string[]>> };
type GetHandler = (r: Request, ctx?: Ctx) => Promise<Response>;
const mitFrist = async <T,>(p: Promise<T>, ms: number): Promise<T | 'frist'> => {
  let t: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<'frist'>(res => { t = setTimeout(() => res('frist'), ms); })]); } finally { if (t) clearTimeout(t); }
};
/** Die Sicht geht in allen drei üblichen Schreibweisen mit (`space` — der Kopf-Schalter; `sicht`/`bereich` — ältere Routen). */
const sichtQuery = (s: Sicht) => `?space=${s}&sicht=${s}&bereich=${s}`;
async function rufeGet(pfad: string, sicht: Sicht, person = 'person-a'): Promise<{ status: number; text: string } | 'frist' | { fehler: string }> {
  try {
    const m = (await import(`@/app/api/${pfad}/route`)) as { GET?: GetHandler };
    if (!m.GET) return { fehler: 'kein GET' };
    const params: Record<string, string | string[]> = {};
    for (const [, name] of pfad.matchAll(/\[(?:\.\.\.)?([a-z]+)\]/g)) params[name] = SEGMENTE[name] ?? 'x';
    const z = zusatz(pfad, sicht);
    const r = await mitFrist(m.GET(new Request(`http://test/api/${pfad}${sichtQuery(sicht)}${z ? `&${z}` : ''}`, { headers: sitzung(person) }), { params: Promise.resolve(params) }), 20_000);
    if (r === 'frist') return 'frist';
    const text = await mitFrist(r.text(), 10_000);
    if (text === 'frist') return 'frist';
    return { status: r.status, text };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

// ── (1) Reine Regeln ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Regeln (rein)', () => {
  it('Sicht aus der Adresse; Routen nur eines Bereichs; Sperre nur mit Sicht des anderen Bereichs', async () => {
    const { sichtAus, routenBereich, sichtFremd, ROUTEN_BEREICH } = await import('@/lib/zugang/sicht-bereich');
    expect([sichtAus('privat'), sichtAus('business'), sichtAus(null), sichtAus('alles'), sichtAus('quatsch')]).toEqual(['privat', 'business', null, null, undefined]);
    expect(routenBereich('/api/familie')).toBe('privat');
    expect(routenBereich('gesundheit/erholung')).toBe('privat');
    expect(routenBereich('/api/crm/bestand')).toBe('business');
    expect(routenBereich('/api/privat/abschluss')).toBe('privat');
    expect(routenBereich('/api/state/tasks')).toBeNull();
    expect(routenBereich('/api/familienkasse')).toBeNull(); // Präfix nur ganzer Pfadteile
    expect(sichtFremd('/api/familie', 'business')).toBe(true);
    expect(sichtFremd('/api/familie', 'privat')).toBe(false);
    expect(sichtFremd('/api/familie', null)).toBe(false);
    expect(sichtFremd('/api/crm/lead', 'privat')).toBe(true);
    // Jeder Eintrag zeigt auf eine echte Route (keine toten Einträge).
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    const pfade = Object.keys(ROUTEN_REGISTER);
    for (const k of Object.keys(ROUTEN_BEREICH)) expect(pfade.some(p => p === k || p.startsWith(`${k}/`)), k).toBe(true);
  });

  it('Heute: jeder Standard-Platz passt in seine Sicht — kein Wachstums-Score, keine Familie in Business', async () => {
    const { HEUTE_STANDARD, HEUTE_FLAECHE } = await import('@/components/os/HeuteView');
    const { widgetPasst, widgetSicht } = await import('@/lib/flaeche/sicht');
    for (const s of ['privat', 'business'] as const) {
      for (const p of HEUTE_STANDARD[s]) expect(widgetPasst(HEUTE_FLAECHE[s], p.art ?? 'seite', p.einstellungen ?? {}), `${s}: ${p.id}`).toBe(true);
    }
    expect(HEUTE_STANDARD.business.map(p => p.art)).not.toContain('score');
    expect(HEUTE_STANDARD.business.map(p => p.art)).not.toContain('familie');
    expect(widgetSicht('familie')).toBe('privat');
    expect(widgetSicht('score')).toBe('privat');
    expect(widgetSicht('index', { saeule: 'gesundheit' })).toBe('privat');
    expect(widgetSicht('index', { saeule: 'traktion' })).toBe('business');
    expect(widgetSicht('zeit', { space: 'beide' })).toBe('neutral'); // Entscheidung 09.10.: Privat gegen Business (nur Summen) in beiden Sichten
    expect(widgetSicht('zeit', { nach: 'einheit' })).toBe('business');
  });

  it('Heute: „+ Widget“ bietet in Business nichts Privates an und in Privat nichts reines Business', async () => {
    const { KATALOG } = await import('@/components/os/flaeche/widgets');
    const { widgetPasst, widgetSicht } = await import('@/lib/flaeche/sicht');
    const angebot = (seite: string) => KATALOG.filter(k => widgetPasst(seite, k.art, k.voreinstellung));
    const business = angebot('uebersicht-business');
    const privat = angebot('uebersicht-privat');
    expect(business.filter(k => widgetSicht(k.art, k.voreinstellung) === 'privat').map(k => k.label)).toEqual([]);
    expect(privat.filter(k => widgetSicht(k.art, k.voreinstellung) === 'business').map(k => k.label)).toEqual([]);
    expect(business.map(k => k.label)).not.toContain('Familie & Partnerschaft');
    expect(business.map(k => k.label)).not.toContain('Erholung heute');
    expect(privat.map(k => k.label)).not.toContain('Wer heute dran ist');
    // Gegenprobe: beide Sichten haben ein Angebot, und eine Fläche ohne Bereich bietet alles an.
    expect(business.length).toBeGreaterThan(5);
    expect(privat.length).toBeGreaterThan(5);
    expect(angebot('system').length).toBe(KATALOG.length);
  });

  it('Einrichtung: in Business keine Schritte aus Gesundheit/Familie/Privat-Finanzen, in Privat keine aus Markttraktion/Unternehmen', async () => {
    const { SCHRITTE, schrittInSicht, istPrivatSchritt, modulVon } = await import('@/lib/make-one/onboarding-data');
    const business = SCHRITTE.filter(x => schrittInSicht(x, 'business'));
    const privat = SCHRITTE.filter(x => schrittInSicht(x, 'privat'));
    expect(business.filter(x => istPrivatSchritt(x) || ['gesundheit', 'familie'].includes(modulVon(x)) && x.ebene !== 'instanz').map(x => x.id)).toEqual([]);
    expect(privat.filter(x => ['markttraktion', 'unternehmen'].includes(modulVon(x))).map(x => x.id)).toEqual([]);
    expect(business.length).toBeGreaterThan(10);
    expect(privat.length).toBeGreaterThan(10);
  });

  it('Zeit: das Bild einer Sicht trägt keine Bereiche/Blöcke des anderen — „Privat gegen Business“ nur die Summen', async () => {
    const { bildFuerSicht } = await import('@/lib/zeitmessung/modell');
    const summe = { gesamt: { privat: 100, business: 200, gemeinsam: 0 }, bewusst: { privat: 50, business: 60, gemeinsam: 0 }, jeSchluessel: { 'privat:familie': 100, 'business:fokus': 200 }, bewusstJeSchluessel: { 'privat:familie': 50, 'business:fokus': 60 } };
    const b = { heute: '2026-10-10', tagHeute: summe, sieben: summe, fokusTage: { privat: 1, business: 2, gemeinsam: 0 }, bloecke: [{ von: 'a', bis: 'b', schluessel: 'privat:familie', label: PRIVAT.zeit, sek: 50, tag: '2026-10-10' }, { von: 'a', bis: 'b', schluessel: 'business:fokus', label: BUSINESS.zeit, sek: 60, tag: '2026-10-10' }] };
    const nur = bildFuerSicht(b, 'business');
    expect(JSON.stringify(nur)).not.toContain('familie');
    expect(JSON.stringify(nur)).not.toContain(PRIVAT.zeit);
    expect(nur.sieben.gesamt.privat).toBe(0);
    const summen = bildFuerSicht(b, 'business', { summenBeide: true });
    expect(summen.sieben.gesamt).toEqual({ privat: 100, business: 200, gemeinsam: 0 });
    expect(JSON.stringify(summen)).not.toContain('familie');
    expect(JSON.stringify(summen)).not.toContain(PRIVAT.zeit);
  });
});

// ── (1b) Die Oberfläche schickt die Sicht mit (statisch — der Server filtert, die Ansicht fragt richtig) ──────────────────────────────────

describe('Oberfläche schickt die Sicht des Kopf-Schalters mit', () => {
  const lies = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('ZOE-Chat, Glocke, Inbox, Tagesplanung, Kalender, Brain-Kugel, Heute-Widgets', () => {
    const zoe = lies('components/os/ZoePanel.tsx');
    expect(zoe).toContain('/api/agenten/faden?agent=zoe&space=${space}');
    expect(zoe).toContain('/api/agenten/faden?id=${encodeURIComponent(id)}&space=${space}');
    expect(zoe).not.toMatch(/fetch\('\/api\/agenten\/faden\?agent=zoe'\)/);
    expect(lies('components/os/Glocke.tsx')).toContain('/api/meldungen${sichtJetzt ? `?space=${sichtJetzt}` : \'\'}');
    expect(lies('components/os/inbox/InboxZwei.tsx')).toContain('useSpace().space');
    expect(lies('components/os/TagesplanView.tsx')).toContain('useKalender(heute, tagPlus(heute, 1), bereich, { belegt: true })');
    expect(lies('components/os/kalender/Kalender.tsx')).toContain('useKalender(von, bis, bereich)');
    expect(lies('components/os/kugel/BrainKugel.tsx')).toContain('/api/brain/punkte?space=${space}');
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain('widgetSpace(seite, e)');
    expect(w).toContain('`/api/inbox${sicht === \'alle\' ? \'\' : `?space=${sicht}`}`');
    expect(lies('components/os/flaeche/Flaeche.tsx')).toContain('KATALOG.filter(k => widgetPasst(seite, k.art, k.voreinstellung))');
  });
});

// ── (2) Middleware ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Middleware: Route des anderen Bereichs → 403', () => {
  it('Familie/Gesundheit mit ?space=business, Markttraktion mit ?space=privat → 403 (auch für den Dienstweg); sonst durch', async () => {
    const { middleware } = await import('@/middleware');
    const dienst = { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-forwarded-for': '127.0.0.1' };
    const lauf = (pfad: string) => middleware(new NextRequest(`http://localhost:3001${pfad}`, { headers: dienst } as never));
    for (const p of ['/api/familie?space=business', '/api/gesundheit/erholung?space=business', '/api/state/vitals?space=business', '/api/haushalt?space=business', '/api/crm/bestand?space=privat', '/api/business?space=privat']) {
      const r = await lauf(p);
      expect(r.status, p).toBe(403);
      const d = await r.json() as { andererBereich?: boolean; error?: string };
      expect(d.andererBereich, p).toBe(true);
      expect(d.error ?? '', p).not.toMatch(/MARKE/);
    }
    for (const p of ['/api/familie?space=privat', '/api/familie', '/api/crm/bestand?space=business', '/api/state/tasks?space=business']) {
      expect((await lauf(p)).headers.get('x-middleware-next'), p).toBe('1');
    }
  });
});

// ── (3) Alle lesenden Routen ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('Alle lesenden Routen: Sicht Business ohne Privat, Sicht Privat ohne Business', () => {
  const echtesFetch = globalThis.fetch;
  let routen: string[] = [];

  beforeAll(async () => {
    globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ICLOUD_APPLE_ID;
    delete process.env.ICLOUD_APP_PASSWORT;
    await fs.mkdir(daten, { recursive: true });
    const db = await import('@/lib/store/local-db');
    const { localDay, tagePlus } = await import('@/lib/zeit');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    const H = localDay();
    const J = new Date().toISOString();
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber'), konto('k2', 'person-b', 'mitglied')], einladungen: [] });

    // Aufgaben: Privat, Selbstständigkeit (Privat-Einheit), Business — alle heute fällig (Glocke, Heute, Kalender).
    const T0 = '2026-10-01T08:00:00.000Z';
    const a = (id: string, title: string, spaceId: string, projectId: string) => ({ id, projectId, title, description: title, status: 'todo', priority: 'high', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId, dueDate: H });
    await db.saveJson('tasks', {
      projects: [
        { id: 'p-privat', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
        { id: 'p-business', title: 'Vertrieb', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'ug' },
      ],
      listen: [], statusEigen: [], vorlagen: [],
      tasks: [
        a('t-privat', PRIVAT.aufgabe, 'privat', 'p-privat'),
        a('t-selbst', PRIVAT.selbst, 'kdc', 'sonstige-kdc'),
        a('t-business', BUSINESS.aufgabe, 'ug', 'p-business'),
      ],
    });

    // Ziele, Fokus-Sätze, Meilensteine über die Schreibwege; Routinen je Bereich (gemeinsam).
    const ziele = (await import('@/app/api/state/ziele/route')) as unknown as { PATCH: Handler; PUT: Handler };
    for (const [id, titel, space] of [['z-privat', PRIVAT.ziel, 'privat'], ['z-business', BUSINESS.ziel, 'business']] as const) {
      const r = await schreiben(ziele.PATCH, 'PATCH', '/api/state/ziele', 'person-a', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id, titel, fortschritt: 10, space } }] });
      expect(r.status, await r.clone().text()).toBe(200);
    }
    for (const [horizont, fokus] of [['privat:jahr', PRIVAT.fokus], ['business:jahr', BUSINESS.fokus]] as const) {
      const r = await schreiben(ziele.PUT, 'PUT', '/api/state/ziele', 'person-a', { horizont, fokus });
      expect(r.status, await r.clone().text()).toBe(200);
    }
    const ms = (await import('@/app/api/state/meilensteine/route')) as unknown as { PATCH: Handler };
    for (const [id, titel, space] of [['ms-privat', PRIVAT.meilenstein, 'privat'], ['ms-business', BUSINESS.meilenstein, 'business']] as const) {
      const r = await schreiben(ms.PATCH, 'PATCH', '/api/state/meilensteine', 'person-a', { ops: [{ op: 'upsert', eintrag: { id, titel, space, faellig: tagePlus(H, 4), fortschritt: 0, erledigt: false } }] });
      expect(r.status, await r.clone().text()).toBe(200);
    }
    await db.saveJson('routinen', { routinen: [
      { id: 'r-privat', label: PRIVAT.routine, wann: 'abend', kategorie: 'leben', dauerMin: 20, aktiv: true, owner: 'beide', space: 'privat' },
      { id: 'r-business', label: BUSINESS.routine, wann: 'morgen', kategorie: 'arbeit', dauerMin: 20, aktiv: true, owner: 'beide', space: 'business' },
    ], bloecke: [] });

    // Zeit: ein privater und ein Business-Fokus-Block.
    const zeit = (await import('@/app/api/state/zeit/route')) as unknown as { POST: Handler };
    const von = new Date(Date.now() - 3 * 3_600_000), mitte = new Date(Date.now() - 2 * 3_600_000), bis = new Date(Date.now() - 3_600_000);
    for (const [v, b, schluessel, label] of [[von, mitte, 'privat:fokus', PRIVAT.zeit], [mitte, bis, 'business:fokus', BUSINESS.zeit]] as const) {
      const r = await schreiben(zeit.POST, 'POST', '/api/state/zeit', 'person-a', { aktion: 'fokus', von: v.toISOString(), bis: b.toISOString(), schluessel, label });
      expect(r.status, await r.clone().text()).toBe(200);
    }

    // Familie (Thema des Haushalts + ein Mensch mit Geburtstag heute), Gesundheit, Journal, Erholung, Ernährung, Haushaltsbuchung.
    const familie = (await import('@/app/api/familie/route')) as unknown as { PATCH: Handler };
    const fa = await schreiben(familie.PATCH, 'PATCH', '/api/familie', 'person-a', { ops: [
      { liste: 'themen', op: 'upsert', eintrag: { id: 'ft-sicht', titel: PRIVAT.familie, art: 'unklar', status: 'offen', hut: 'privat' } },
      { liste: 'menschen', op: 'upsert', eintrag: { id: 'fm-sicht', name: PRIVAT.geburtstag, rolle: 'freund', geburtstag: `${H.slice(8, 10)}.${H.slice(5, 7)}.`, kontaktAlleTage: null, letzterKontakt: null, notiz: '' } },
    ] });
    expect(fa.status, await fa.clone().text()).toBe(200);
    await db.saveJson(speicherFuer('health-log', 'person-a'), { [H]: [PRIVAT.gesundheit] });
    await db.saveJson(speicherFuer('vitals', 'person-a'), { [H]: { rec: 33, note: PRIVAT.gesundheit } });
    await db.saveJson(speicherFuer('journal', 'person-a'), { [H]: { text: PRIVAT.journal } });
    await db.saveJson('erholung--person-a', { v: 1, programme: [{ id: 'ep-sicht', name: PRIVAT.erholung, art: 'mobility', uebungen: [], proWoche: 3, tage: [], status: 'aktiv', angelegt: J }], einheiten: [], behandlungen: [], ziele: [], fokus: PRIVAT.erholung, einstellungen: {} });
    await db.saveJson('ernaehrung', { grundsaetze: '', plan: {}, planGerichte: {}, einkauf: [{ id: 'e-1', text: PRIVAT.ernaehrung, erledigt: false }], profile: [], lebensmittel: [], vorrat: [], gerichte: [] });
    await db.saveJson('haushalt-buchungen--haus-sicht', { einheiten: 2, buchungen: [{ id: 'hb-sicht', stand: J, konto_id: 'hk-sicht', datum: H, betrag: -1234, beschreibung: PRIVAT.haushalt, empfaenger: PRIVAT.haushalt, kategorie_id: null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'einmalig', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: 'person-a', geaendert: J }] });
    await db.saveJson('haushalt-stamm--haus-sicht', { einheiten: 2, konten: [{ id: 'hk-sicht', stand: J, name: 'Giro', inhaber: 'gemeinsam', einheit: 'privat', iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true }], kategorien: [], regeln: [], aliase: {} });

    // Markttraktion (Business): ein Deal.
    const crm: Record<string, unknown> = Object.fromEntries((await import('@/lib/crm/typen')).CRM_LISTEN.map(l => [l, []]));
    const offen = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' };
    crm.chancen = [{ id: 'd-sicht', titel: BUSINESS.crm, kontaktIds: [], art: 'projekt', wert: { betrag: 1000, basis: 'einmalig' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'person-a' }],
      naechsterSchritt: { text: 'Angebot nachfassen', datum: H }, qualifizierung: offen, erwartetAm: tagePlus(H, 30), gesellschaft: 'ug', besitzer: 'person-a', angelegt: J, geaendert: J }];
    await db.saveJson('crm', crm);

    // Kalender (Stand vom Mac): ein Termin in einem Familien-Kalender (Privat), einer in einem Arbeits-Kalender (Business) — heute, in einer Stunde.
    const inStunde = (n: number) => { const d = new Date(Date.now() + n * 3_600_000); const p = (x: number) => String(x).padStart(2, '0'); return `${H}T${p(d.getHours())}:${p(d.getMinutes())}:00`; };
    await db.saveJson('calendar-cache', { at: J, quelle: 'mac', events: [
      { id: 'e-privat', title: PRIVAT.termin, startDate: inStunde(1), endDate: inStunde(2), allDay: false, calendarName: 'Familie' },
      { id: 'e-business', title: BUSINESS.termin, startDate: inStunde(1), endDate: inStunde(2), allDay: false, calendarName: 'Arbeit' },
    ] });

    // ZOE- und Head-Threads je Bereich.
    const fd = (id: string, agent: Record<string, unknown>, bereich: Sicht, titel: string) => ({ id, besitzer: 'person-a', agent, bereich, titel, status: 'offen', fremdGelesen: false, vertraulich: false, erstellt: J, aktualisiert: J,
      nachrichten: [{ id: `nr-${id}`, rolle: 'person', von: 'person-a', text: titel, zeit: J }, { id: `nr-${id}-a`, rolle: 'agent', von: agent.art === 'zoe' ? 'zoe' : `head:${String(agent.headId)}`, text: 'Erledigt.', zeit: J }] });
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [
      { ...fd('fd-00000000-0000-4000-8000-0000000000b1', { art: 'zoe' }, 'privat', PRIVAT.zoe), kette: ['zoe'] },
      { ...fd('fd-00000000-0000-4000-8000-0000000000b2', { art: 'zoe' }, 'business', BUSINESS.zoe), kette: ['zoe'] },
      fd('fd-00000000-0000-4000-8000-0000000000b3', { art: 'head', headId: 'assistenz' }, 'privat', PRIVAT.head),
      fd('fd-00000000-0000-4000-8000-0000000000b4', { art: 'head', headId: 'sales' }, 'business', BUSINESS.head),
    ] });

    // Postfächer je Bereich + je ein Mail-Kopf.
    const PFP = 'pf-11111111-2222-4333-8444-555555555551';
    const PFB = 'pf-11111111-2222-4333-8444-555555555552';
    await db.saveJson('postfaecher--person-a', { v: 1, postfaecher: [
      { id: PFP, quelle: 'imap', bereich: 'privat', anzeigename: 'Zuhause', adresse: 'privat@example.invalid', anbieter: 'icloud', angelegtAm: '2026-10-06' },
      { id: PFB, quelle: 'imap', bereich: 'ug', anzeigename: 'Firma', adresse: 'firma@example.invalid', anbieter: 'ionos', angelegtAm: '2026-10-06' },
    ] });
    const kopf = (pf: string, betreff: string, n: number) => ({ id: `${pf}:e:1:${n}`, threadId: `x${n}`, am: J, von: { name: 'Absender', email: `absender${n}@example.invalid` }, an: [{ email: 'a@example.invalid' }], cc: [], betreff, ausschnitt: betreff, labels: ['INBOX', 'UNREAD'], anhaenge: [], postfachId: pf, ordner: 'e', uidValidity: '1', uid: n, wurzel: `<m${n}@x>`, messageId: `<m${n}@x>` });
    await db.saveJson('imap-stand--person-a', { v: 1, person: 'person-a', postfaecher: { [PFP]: { at: J }, [PFB]: { at: J } }, koepfe: {
      [`${PFP}:e:1:1`]: kopf(PFP, PRIVAT.mail, 1),
      [`${PFB}:e:1:2`]: kopf(PFB, BUSINESS.mail, 2),
    } });

    // Glocke: eine gespeicherte Meldung je Bereich (Gesundheit = Privat, Netzwerken = Business).
    const { meldungAblegen } = await import('@/lib/meldungen/speicher');
    expect((await meldungAblegen({ an: 'person-a', art: 'gesundheit', titel: PRIVAT.meldung, link: '/os/gesundheit', von: 'person-b' })).ok).toBe(true);
    expect((await meldungAblegen({ an: 'person-a', art: 'netzwerken', titel: BUSINESS.meldung, link: '/os/netzwerken', von: 'person-b' })).ok).toBe(true);

    // Heute: gespeicherte Layouts mit einem Widget aus dem jeweils ANDEREN Bereich (so stand es vor dem 10.10. noch im Bestand).
    await db.saveJson(speicherFuer('flaeche', 'person-a'), { seiten: {
      'uebersicht-business': { plaetze: [{ id: 'familie-x', art: 'familie', breite: 2, titel: PRIVAT.widget, einstellungen: {} }, { id: 'dran', art: 'dran', breite: 2, einstellungen: {} }], versteckt: [], stand: J },
      'uebersicht-privat': { plaetze: [{ id: 'dran-x', art: 'dran', breite: 2, titel: BUSINESS.widget, einstellungen: {} }, { id: 'familie', art: 'familie', breite: 2, einstellungen: {} }], versteckt: [], stand: J },
    } });

    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    routen = Object.entries(ROUTEN_REGISTER)
      .filter(([pfad, e]) => e.methoden.GET && e.methoden.GET !== 'offen' && e.methoden.GET !== 'dienst' && !UEBERSPRUNGEN[pfad])
      .map(([pfad]) => pfad).sort();
  }, 120_000);
  afterAll(() => { globalThis.fetch = echtesFetch; });

  const pruefen = async (sicht: Sicht, marken: Record<string, string>) => {
    const { sichtFremd } = await import('@/lib/zugang/sicht-bereich');
    const lecks: string[] = [];
    const ohne: string[] = [];
    let gesperrt = 0;
    for (const pfad of routen) {
      // Route nur des anderen Bereichs: die Middleware antwortet 403, bevor die Route läuft (Test oben).
      if (sichtFremd(pfad, sicht)) { gesperrt++; continue; }
      const r = await rufeGet(pfad, sicht);
      if (r === 'frist' || 'fehler' in r) { ohne.push(`${pfad}: ${r === 'frist' ? 'Zeitüberschreitung' : r.fehler}`); continue; }
      if (BEIDE_GEWOLLT[pfad]) continue;
      for (const [name, marke] of Object.entries(marken)) if (r.text.includes(marke)) lecks.push(`${pfad}?space=${sicht} (${r.status}) → ${name}`);
    }
    if (ohne.length) console.warn(`[sicht-business-privat] ohne Antwort (${sicht}, ${ohne.length}):\n${ohne.join('\n')}`);
    if (process.env.SICHT_OHNE) await fs.appendFile(process.env.SICHT_OHNE, `${sicht}: ${ohne.length}\n${ohne.join('\n')}\n`);
    return { lecks, gesperrt };
  };

  it('Sicht Business: keine Antwort trägt eine Privat-Marke', async () => {
    expect(routen.length).toBeGreaterThan(100);
    const { lecks, gesperrt } = await pruefen('business', PRIVAT);
    expect(gesperrt).toBeGreaterThan(10);
    expect(lecks).toEqual([]);
  }, 900_000);

  it('Sicht Privat: keine Antwort trägt eine reine Business-Marke', async () => {
    const { lecks, gesperrt } = await pruefen('privat', BUSINESS);
    expect(gesperrt).toBeGreaterThan(10);
    expect(lecks).toEqual([]);
  }, 900_000);

  it('ZOE: ein Thread des anderen Bereichs wird nie fortgesetzt — es beginnt ein neuer in der Sicht; ohne Sicht (Telegram) wie bisher', async () => {
    const { zoeFadenFuer } = await import('@/lib/agenten/zoe-faden');
    const PRIV = 'fd-00000000-0000-4000-8000-0000000000b1';
    const z = await zoeFadenFuer('person-a', PRIV, 'Frage aus der Sicht Business', { bereich: 'business', sicht: 'business' });
    expect('faden' in z).toBe(true);
    if (!('faden' in z)) return;
    expect(z.faden.id).not.toBe(PRIV);
    expect(z.faden.bereich).toBe('business');
    expect(JSON.stringify(z.prompt)).not.toContain(PRIVAT.zoe);
    const w = await zoeFadenFuer('person-a', PRIV, 'Weiter ohne Sicht', { bereich: 'privat' });
    expect('faden' in w && w.faden.id).toBe(PRIV);
  });

  it('Gegenprobe: jede Marke kommt in ihrer eigenen Sicht an (die Saat ist lesbar, die Filter lassen das Eigene durch)', async () => {
    const gefunden = { privat: new Set<string>(), business: new Set<string>() };
    for (const pfad of routen) {
      for (const [sicht, marken] of [['privat', PRIVAT], ['business', BUSINESS]] as const) {
        const r = await rufeGet(pfad, sicht);
        if (r === 'frist' || 'fehler' in r) continue;
        for (const [name, marke] of Object.entries(marken)) if (r.text.includes(marke)) gefunden[sicht].add(name);
      }
    }
    // Ohne Netz und ohne Modell zeigen manche Wege ihre Marke nicht (Geburtstag erst über die Glocke/Heute) — alle übrigen müssen ankommen.
    expect(Object.keys(PRIVAT).filter(n => !gefunden.privat.has(n))).toEqual([]);
    expect(Object.keys(BUSINESS).filter(n => !gefunden.business.has(n))).toEqual([]);
  }, 900_000);
});
