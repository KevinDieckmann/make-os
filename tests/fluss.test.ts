// ─── Überblick „Für dich“ je Bereich — Reihen, Prognose nur mit Grundlage, Sicht serverseitig (04.10.2026 abends) ─
// Kevin: „Lass uns so immer den Überblick gestalten und dann den Flow so anzeigen, wie es die letzten 3 Monate war, wie es jetzt
// ist und wie der Forecast ist … für jeden einzelnen Bereich.“ Der Test hält fest: reine Reihen (Ist 3 Monate, Prognose ab der
// laufenden Periode), Prognose NIE ohne Datengrundlage, je Bereich die Sicht-Regel auf dem Server (Privat nie im Business,
// „nur ich“ nie bei der anderen Person, fremder Haushalt/Dienstweg 403), und jede Bereichsseite nutzt den Baustein.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { istReihe, prognoseReihe, mitGrundlage, flussText, flussHatLinie, FLUSS_BEREICHE, FLUSS_FENSTER, type FlussReihe } from '@/lib/fluss/modell';
import { flussAufgaben, flussPlanung, flussMarkttraktion, flussInbox, flussGesundheit, flussFinanzenPrivat, flussFinanzenBusiness, flussKalender, flussNetzwerken } from '@/lib/fluss/bereiche';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fluss-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fluss';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock('@/lib/zeit', async orig => ({ ...(await orig<typeof import('@/lib/zeit')>()), localDay: () => '2026-10-04' }));
vi.mock('@/lib/kalender/zoe-sicht-server', () => ({
  termineFuerZoe: async (person: string) => ({
    stand: null, quelle: 'icloud', kemaris: [], kemarisStand: null, einstellungen: null,
    termine: [
      // Für Kevin ist Malins privater Termin schon maskiert (wie `fuerZoe`) — er darf nie als seine Zeit zählen.
      { id: 'u1', titel: person === 'malin' ? 'Geheimes Treffen' : 'Belegt', start: '2026-10-06T18:00:00', ende: '2026-10-06T20:00:00', ganztags: false, wer: 'malin', ...(person === 'malin' ? {} : { maskiert: true }) },
      { id: 'u2', titel: 'Kundentermin', start: '2026-10-07T10:00:00', ende: '2026-10-07T11:00:00', ganztags: false, wer: 'kevin' },
      { id: 'u3', titel: 'Elternabend', start: '2026-09-22T19:00:00', ende: '2026-09-22T20:30:00', ganztags: false, wer: 'beide' },
    ],
  }),
}));

const HEUTE = '2026-10-04'; // Sonntag
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

describe('Reihen (rein)', () => {
  it('Ist: 13 Wochen bzw. 4 Monate bis einschließlich der laufenden, Künftiges zählt nicht', () => {
    const r = istReihe([{ tag: '2026-10-04' }, { tag: '2026-09-28' }, { tag: '2026-09-27', wert: 2 }, { tag: '2026-06-01' }, { tag: '2026-10-05' }, { tag: 'kaputt' }], HEUTE, 'woche');
    expect(r).toHaveLength(FLUSS_FENSTER.woche);
    expect(r.at(-1)).toBe(2); expect(r.at(-2)).toBe(2);
    expect(r.reduce((a, v) => a + v, 0)).toBe(4);
    expect(istReihe([{ tag: '2026-07-15', wert: 10 }, { tag: '2026-10-01', wert: 5 }], HEUTE, 'monat')).toEqual([10, 0, 0, 5]);
  });
  it('Prognose: ab der laufenden Periode, Überfälliges zählt jetzt (oder gar nicht), danach nichts', () => {
    const r = prognoseReihe([{ tag: '2026-10-01' }, { tag: '2026-10-05' }, { tag: '2026-12-21' }, { tag: '2026-12-28' }, { tag: '2027-06-01' }], HEUTE, 'woche');
    expect(r[0]).toBe(1); expect(r[1]).toBe(1); expect(r[12]).toBe(1);
    expect(r.reduce((a, v) => a + v, 0)).toBe(3);
    expect(prognoseReihe([{ tag: '2026-10-01' }], HEUTE, 'woche', { ueberfaelligHeute: false }).every(v => v === 0)).toBe(true);
  });
  it('Prognose NIE ohne Grundlage: ohne terminierten Eintrag leer und `null`', () => {
    expect(mitGrundlage([0, 0], 0, 'aus Fälligkeiten')).toEqual({ prognose: [], prognoseGrundlage: null });
    expect(mitGrundlage([1, 0], 1, 'aus Fälligkeiten').prognoseGrundlage).toBe('aus Fälligkeiten');
  });
  it('Bereiche: ohne Fälligkeiten/Pipeline/Plan keine Prognose — mit ihnen eine aus genau diesen Daten', () => {
    const a = flussAufgaben({ heute: HEUTE, aufgaben: [{ id: 't1', titel: 'x', erledigt: true, erledigtAm: '2026-09-30' }] });
    expect(a.prognoseGrundlage).toBeNull(); expect(a.prognose).toEqual([]);
    expect(a.ist.at(-1)).toBe(1);
    const b = flussAufgaben({ heute: HEUTE, aufgaben: [{ id: 't1', titel: 'x', erledigt: false, faellig: '2026-10-10' }, { id: 't2', titel: 'y', erledigt: false, faellig: '2026-09-20' }] });
    expect(b.prognose[0]).toBe(1); expect(b.prognose[1]).toBe(1);
    expect(b.zeilen[0]).toMatchObject({ id: 'ueberfaellig', ton: 'kritisch' });
    const m = flussMarkttraktion({ heute: HEUTE, deals: [
      { id: 'd1', titel: 'Retainer', wert: 36000, gewichtet: 18000, stufe: 'angebot', erwartetAm: '2026-11-10', offen: true },
      { id: 'd2', titel: 'Sprint', wert: 9000, gewichtet: 9000, stufe: 'gewonnen', gewonnenAm: '2026-08-20', offen: false },
    ] });
    expect(m.ist).toEqual([0, 9000, 0, 0]); expect(m.prognose).toEqual([0, 18000, 0, 0]);
    expect(m.prognoseGrundlage).toContain('Wahrscheinlichkeit');
    expect(flussMarkttraktion({ heute: HEUTE, deals: [] }).prognoseGrundlage).toBeNull();
    expect(flussGesundheit({ heute: HEUTE, einheiten: ['2026-10-01'], planJeWoche: 0, termine: [] }).prognoseGrundlage).toBeNull();
    expect(flussGesundheit({ heute: HEUTE, einheiten: [], planJeWoche: 3, termine: [] }).prognose.slice(0, 2)).toEqual([3, 3]);
    expect(flussInbox({ heute: HEUTE, eingang: [], wiedervorlagen: [], offen: 0, verbunden: false }).leer).toContain('Kein Postfach');
    expect(flussPlanung({ heute: HEUTE, punkte: [] }).prognoseGrundlage).toBeNull();
    expect(flussFinanzenPrivat({ heute: HEUTE, ausgaben: [], bekannt: [] }).prognose).toEqual([]);
    const raten = flussFinanzenPrivat({ heute: HEUTE, ausgaben: [], bekannt: [10, 11, 12].map(m => ({ titel: 'Kredit', tag: `2026-${m}-16`, wert: 320, art: 'rate' as const })) });
    expect(raten.zeilen.map(z => z.titel)).toEqual(['Kredit']); // je Posten nur die nächste Rate
    expect(raten.prognose.slice(0, 3)).toEqual([320, 320, 320]);
  });
  it('Text für Vorleser nennt Ist und Prognose bzw. „Keine Prognose“', () => {
    const a = flussAufgaben({ heute: HEUTE, aufgaben: [{ id: 't1', titel: 'x', erledigt: true, erledigtAm: '2026-09-30' }] });
    expect(flussText(a)).toContain('Keine Prognose');
    expect(flussHatLinie(a)).toBe(true);
  });
});

// ── Route: Sicht serverseitig ────────────────────────────────────────────────
let route: { GET: (r: Request) => Promise<Response> };
const sitzung = (p: string) => ({ 'x-make-user': p });
const hole = async (bereich: string, wer: Record<string, string>, extra = '') => {
  const r = await route.GET(new Request(`http://test/api/fluss?bereich=${bereich}${extra}`, { headers: wer }));
  return { status: r.status, d: (await r.json()) as { ok: boolean; fluss: FlussReihe | null } };
};
const summe = (r: number[]) => r.reduce((a, v) => a + v, 0);
const alles = (f: FlussReihe | null) => JSON.stringify(f);

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, name: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus', 'Kevin'), k('k2', 'malin', 'mitglied', 'test-haus', 'Malin'), k('k3', 'gast', 'mitglied', 'anderer-haus', 'Gast')], einladungen: [] });
  // Aufgaben: eine eigene erledigte, eine gemeinsame fällige, Malins „nur ich“ (samt Unteraufgabe).
  const t = (id: string, x: Record<string, unknown>) => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01', updatedAt: '2026-09-01', ...x });
  await db.saveJson('tasks', { projects: [], listen: [], tasks: [
    t('t-1', { status: 'done', completedAt: '2026-09-30T10:00:00Z' }),
    t('t-2', { dueDate: '2026-10-08', title: 'Angebot schreiben' }),
    t('t-geheim', { dueDate: '2026-10-09', title: 'Geschenk für Kevin', assignee: 'malin', angelegtVon: 'malin', sichtbarkeit: 'nur-ich', spaceId: 'privat' }),
    t('t-geheim-kind', { dueDate: '2026-10-10', title: 'Geschenk einpacken', assignee: 'malin', parentId: 't-geheim' }),
  ] });
  // Planung: gemeinsames Business-Ziel, gemeinsames Privat-Ziel, Malins eigenes Ziel mit Meilenstein.
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], fokus: {}, jahr: [
    { id: 'z-biz', titel: 'Zwölf Mandate', fortschritt: 40, space: 'business', rang: 1, termin: '2026-12-15' },
    { id: 'z-priv', titel: 'Rücklage', fortschritt: 20, space: 'privat', rang: 1, termin: '2026-12-20' },
  ] });
  await db.saveJson('ziele-eigen--malin', { tag: [], woche: [], monat: [], quartal: [], fokus: {}, jahr: [{ id: 'z-malin', titel: 'Spanisch B1', fortschritt: 10, space: 'privat', termin: '2026-11-30' }] });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'm-biz', titel: 'Neun Mandate', faellig: '2026-10-30', zielId: 'z-biz', space: 'business', fortschritt: 50, erledigt: false },
    { id: 'm-malin', titel: 'Sprachkurs A2', faellig: '2026-10-20', zielId: 'z-malin', space: 'privat', fortschritt: 0, erledigt: false },
  ] });
  // Finanzen: Business-Buchungen (Gesellschaft) + eine private ohne `ort`; Haushalt mit privat und Firmen-Einheit.
  await db.saveJson('buchungen', { buchungen: [
    { id: 'b1', datum: '2026-09-29', wer: 'kevin', betrag: 1200, kategorie: 'Umsatz', ort: 'kdv' },
    { id: 'b2', datum: '2026-09-30', wer: 'kevin', betrag: -777, kategorie: 'Privat' },
  ] });
  await db.saveJson('finanzplan', { firmen: [{ id: 'kdv', name: 'Beispiel', kontostand: 5000 }], rechnungen: [{ id: 'r1', firmaId: 'kdv', kunde: 'Beispiel', titel: 'Mandat', betrag: 3000, status: 'gestellt', faellig: '2026-10-20' }], zahlungen: [], merkposten: [] });
  const bu = (id: string, datum: string, betrag: number, einheit: string) => ({ id, konto_id: 'k', datum, betrag, beschreibung: 'x', empfaenger: 'Laden', kategorie_id: null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'unregelmaessig', einheit, zeilen_hash: null, notiz: null });
  await db.saveJson('haushalt-buchungen--test-haus', { einheiten: 2, buchungen: [bu('h1', '2026-09-10', -5000, 'privat'), bu('h2', '2026-09-11', -99900, 'kdv')] });
  // Familie: gemeinsames Date, Malins „nur ich“-Date.
  const basis = (id: string, von: string, x: Record<string, unknown>) => ({ id, von, am: '2026-09-01T10:00:00Z', ...x });
  await db.saveJson('familie--test-haus', {
    dates: [basis('d1', 'kevin', { titel: 'Kino', datum: '2026-10-14', planer: 'kevin', status: 'geplant', neuesErlebnis: false, nachklang: [], ideeId: null }),
            basis('d2', 'malin', { titel: 'Überraschung', datum: '2026-10-15', planer: 'malin', status: 'geplant', neuesErlebnis: false, nachklang: [], ideeId: null, sichtbarkeit: 'nur-ich' })],
    gespraeche: [], vereinbarungen: [], wertschaetzungen: [], tage: [],
  });
  // Gesundheit: Sport je Person.
  await db.saveJson('sport--malin', { version: 1, einstieg: { fertig: true }, ziele: [{ id: 's1', titel: 'Hyrox Hamburg', datum: '2026-11-21' }], hyrox: [{ id: 'h1', datum: '2026-09-30' }], laeufe: [], gym: { einheiten: [] }, woche: { mo: { art: 'lauf' }, di: { art: 'ruhe' }, mi: { art: 'gym' }, do: { art: 'ruhe' }, fr: { art: 'hyrox' }, sa: { art: 'ruhe' }, so: { art: 'ruhe' } } });
  // Inbox: nur Kevin hat Gmail.
  await db.saveJson('gmail-stand--kevin', { v: 1, person: 'kevin', email: 'kevin@example.invalid', koepfe: { m1: { id: 'm1', threadId: 'th1', am: '2026-10-01T09:00:00Z', von: { email: 'a@example.invalid' }, an: [], cc: [], betreff: 'Hallo', labels: ['INBOX', 'UNREAD'] } } });
  await db.saveJson('inbox-status', { 'gmail-th1': { status: 'snoozed', at: '2026-10-01T10:00:00Z', bis: '2026-10-09' }, 'gmail-fremd': { status: 'snoozed', at: '2026-10-01T10:00:00Z', bis: '2026-10-10' } });
  route = (await import('@/app/api/fluss/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('Route GET /api/fluss — Zugang', () => {
  it('ohne Sitzung, fremder Haushalt, Dienstweg → 403; unbekannter Bereich → 400', async () => {
    expect((await hole('aufgaben', {})).status).toBe(403);
    expect((await hole('aufgaben', sitzung('gast'))).status).toBe(403);
    expect((await hole('aufgaben', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' })).status).toBe(403);
    expect((await hole('wissen', sitzung('kevin'))).status).toBe(400);
  });
  it('jeder Bereich antwortet für eine Person des Haushalts', async () => {
    for (const b of FLUSS_BEREICHE) {
      const { status, d } = await hole(b, sitzung('kevin'));
      expect(status, b).toBe(200);
      expect(d.ok, b).toBe(true);
    }
  });
});

describe('Sicht X bekommt nichts aus Y (je Bereich, serverseitig)', () => {
  it('Aufgaben: Malins „nur ich“ (samt Unteraufgabe) nie bei Kevin', async () => {
    const k = (await hole('aufgaben', sitzung('kevin'))).d.fluss!;
    const m = (await hole('aufgaben', sitzung('malin'))).d.fluss!;
    expect(summe(k.prognose)).toBe(1);
    expect(summe(m.prognose)).toBe(3);
    expect(alles(k)).not.toContain('Geschenk');
  });
  it('Planung: Malins eigenes Ziel und sein Meilenstein nie bei Kevin; Business-Sicht ohne Privates', async () => {
    const k = (await hole('planung', sitzung('kevin'))).d.fluss!;
    expect(alles(k)).not.toContain('Sprachkurs'); expect(alles(k)).not.toContain('Spanisch');
    expect(alles((await hole('planung', sitzung('malin'))).d.fluss)).toContain('Sprachkurs');
    const biz = (await hole('planung', sitzung('kevin'), '&space=business')).d.fluss!;
    expect(alles(biz)).toContain('Neun Mandate'); expect(alles(biz)).not.toContain('Rücklage');
    const priv = (await hole('planung', sitzung('kevin'), '&space=privat')).d.fluss!;
    expect(alles(priv)).not.toContain('Neun Mandate'); expect(alles(priv)).not.toContain('Zwölf Mandate');
  });
  it('Finanzen: Privates nie im Business, Firmen-Einheiten nie im Privaten', async () => {
    const biz = (await hole('finanzen-business', sitzung('kevin'))).d.fluss!;
    expect(summe(biz.ist)).toBe(1200);
    const priv = (await hole('finanzen-privat', sitzung('kevin'))).d.fluss!;
    expect(summe(priv.ist)).toBe(50);
  });
  it('Familie: Malins „nur ich“-Date nie bei Kevin', async () => {
    const k = (await hole('familie', sitzung('kevin'))).d.fluss!;
    expect(alles(k)).not.toContain('Überraschung');
    expect(summe(k.prognose)).toBe(1);
    expect(alles((await hole('familie', sitzung('malin'))).d.fluss)).toContain('Überraschung');
  });
  it('Kalender: ein maskierter Termin der anderen Person zählt nie als eigene Zeit', async () => {
    const k = (await hole('kalender', sitzung('kevin'))).d.fluss!;
    expect(alles(k)).not.toContain('Geheimes'); expect(alles(k)).not.toContain('Belegt');
    expect(summe(k.prognose)).toBe(1);
  });
  it('Gesundheit: nur die eigene Person — Malins Training nie bei Kevin', async () => {
    const k = (await hole('gesundheit', sitzung('kevin'))).d.fluss!;
    expect(summe(k.ist)).toBe(0); expect(alles(k)).not.toContain('Hyrox');
    const m = (await hole('gesundheit', sitzung('malin'))).d.fluss!;
    expect(summe(m.ist)).toBe(1); expect(m.prognose[1]).toBe(3);
  });
  it('Inbox: nur das eigene Postfach — Wiedervorlagen fremder Nachrichten zählen nicht', async () => {
    const k = (await hole('inbox', sitzung('kevin'))).d.fluss!;
    expect(summe(k.ist)).toBe(1); expect(summe(k.prognose)).toBe(1);
    const m = (await hole('inbox', sitzung('malin'))).d.fluss!;
    expect(summe(m.ist)).toBe(0); expect(m.prognose).toEqual([]);
  });
});

describe('Baustein & Wächter', () => {
  it('FlussKarte: Fokus-Karte, Linie mit Text, Prognose gestrichelt, Achse „−3 M · heute · +3 M“; ohne Grundlage Leerzustand', async () => {
    const { FlussKarte } = await import('@/components/os/ui');
    const f = flussAufgaben({ heute: HEUTE, aufgaben: [{ id: 't1', titel: 'x', erledigt: true, erledigtAm: '2026-09-30' }, { id: 't2', titel: 'y', erledigt: false, faellig: '2026-10-12' }] });
    const html = renderToStaticMarkup(createElement(FlussKarte, { fluss: f }));
    expect(html).toContain('ui-karte-fokus'); expect(html).toContain('data-flusskarte');
    expect(html).toContain('stroke-dasharray="5 4"'); expect(html).toContain('−3 M'); expect(html).toContain('heute'); expect(html).toContain('+3 M');
    expect(html).toContain('role="img"'); expect(html).toContain('Prognose aus Fälligkeiten');
    const ohne = renderToStaticMarkup(createElement(FlussKarte, { fluss: { ...f, prognose: [], prognoseGrundlage: null } }));
    expect(ohne).toContain('Keine Prognose'); expect(ohne).not.toContain('stroke-dasharray="5 4"');
  });
  it('jede Bereichsseite nutzt den Baustein (mit ihrem Bereich) — und hat daneben keine zweite Fokus-Karte', () => {
    const seiten: [string, string][] = [
      ['components/os/crm/Ueberblick.tsx', 'fluss='], ['components/os/haushalt/HaushaltView.tsx', 'bereich="finanzen-privat"'],
      ['components/os/business/BusinessCockpit.tsx', 'bereich="finanzen-business"'], ['components/os/HorizontView.tsx', 'bereich="planung"'],
      ['components/os/aufgaben/Ueberblick.tsx', 'bereich="aufgaben"'], ['components/os/kalender/Kalender.tsx', 'bereich="kalender"'],
      ['components/os/GesundheitView.tsx', 'bereich="gesundheit"'], ['components/os/familie/FamilieView.tsx', 'bereich="familie"'],
      ['components/os/netzwerken/Netzwerken.tsx', 'bereich="netzwerken"'], ['components/os/InboxSchlank.tsx', 'bereich="inbox"'],
    ];
    for (const [f, bereich] of seiten) {
      const t = lies(f);
      expect(t, f).toMatch(/<FlussKarte\b/);
      expect(t, f).toContain(bereich);
      expect(t.match(/\bton=(?:"fokus"|\{[^}]*['"]fokus['"][^}]*\})/g) ?? [], `${f}: zweite Fokus-Karte`).toHaveLength(0);
    }
    // Die Markttraktion bekommt ihre Reihe serverseitig aus /api/crm/traktion.
    expect(lies('app/api/crm/traktion/route.ts')).toContain('flussAusCrm');
  });
  it('nie eine fest eingetippte Reihe: FlussKarte bekommt `fluss` nur aus Daten, Seiten rechnen keine Reihen', () => {
    for (const f of ['components/os/crm/Ueberblick.tsx', 'components/os/HorizontView.tsx', 'components/os/aufgaben/Ueberblick.tsx']) {
      expect(lies(f), f).not.toMatch(/<FlussKarte[^>]*fluss=\{\{/);
      expect(lies(f), f).not.toMatch(/\b(istReihe|prognoseReihe)\(/);
    }
  });
});

describe('Jede Zeile führt zum Ort des Handelns (Prüfung 04.10.)', () => {
  it('Zeilen tragen ihren eigenen Weg (Rechnung, Tag, Akte) vor dem Bereich', () => {
    const h = '2026-10-04';
    const b = flussFinanzenBusiness({ heute: h, saldo: [], vorschau: [], link: '/bereich', faellig: [{ id: 'r:1', titel: 'R', tag: '2026-10-10', wert: 100, eingang: true, link: '/os/finanzen/planung?r=1' }, { id: 'z:2', titel: 'Z', tag: '2026-10-11', wert: 50, eingang: false }] });
    expect(b.zeilen.map(z => z.link)).toEqual(['/os/finanzen/planung?r=1', '/bereich']);
    const k = flussKalender({ heute: h, link: '/os/kalender', termine: [{ id: 't', titel: 'T', start: '2026-10-06T09:00:00', ende: '2026-10-06T10:00:00', link: '/os/kalender?tag=2026-10-06' }] });
    expect(k.zeilen[0].link).toBe('/os/kalender?tag=2026-10-06');
    const n = flussNetzwerken({ heute: h, erfasst: [], link: '/os/netzwerken', nachfassen: [{ id: 'nf:1', titel: 'A', tag: '2026-10-08', link: '/akte' }] });
    expect(n.zeilen[0].link).toBe('/akte');
  });
  it('alle Lader verlinken über WEG — keine festen Pfade', () => {
    const quelle = readFileSync(path.resolve(__dirname, '..', 'lib/fluss/server.ts'), 'utf8');
    expect(quelle).not.toMatch(/link: ['`]\/os/);
  });
});
