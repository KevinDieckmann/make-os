// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.): die kleineren Funde als Tests —
//   #8  Kalender-Einstellungen: nur der Haushalt, Build-Kennung, Teil-Änderung (`teil`) mischt statt zu ersetzen.
//   #9  Bestätigungslink: nie beim Seitenaufruf eingelöst — erst der Knopf „E-Mail-Adresse bestätigen“.
//   #10 Sicherung zurückspielen: Build-Kennung.
//   #11 Wiederherstellung: Buchungstermine gesperrt wie Termine mit Gästen; `von`/privat mitgesichert und zurück in den
//       Bezug; der Probelauf nennt beides.
//   #13 Drosselung je Netz: IPv6 auf /64.
// Eigener Datenordner, iCloud gemockt (nie ein Netzaufruf), Zugang über `x-make-user` gemockt, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-rest-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f1-rest-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-f1-rest-nur-im-test-0123456789abcdef';

const ic = vi.hoisted(() => ({ objekte: new Map<string, string>(), angelegt: [] as string[] }));
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const KAL = { id: 'https://p42-caldav.icloud.com/123/calendars/home/', name: 'Gemeinsam', schreibbar: true };
  return {
    ...echt,
    verbunden: () => true,
    ladeStand: async () => ({ at: '2026-10-05T01:00:00Z', kalender: [KAL], objekte: {} }),
    holeAlleObjekte: async () => [...ic.objekte.entries()].map(([uid, ics]) => ({ href: `/${uid}.ics`, etag: 'e', ics })),
    objektWiederherstellen: async (_k: unknown, uid: string, ics: string) => { if (ic.objekte.has(uid)) return 'schon-da'; ic.objekte.set(uid, ics); ic.angelegt.push(uid); return 'angelegt'; },
  };
});
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));

const vcal = (uid: string, titel: string, extra: string[] = []) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20261005T090000\r\nDTEND;TZID=Europe/Berlin:20261005T100000\r\nSUMMARY:${titel}\r\n${extra.map(x => `${x}\r\n`).join('')}END:VEVENT\r\nEND:VCALENDAR`;
let db: typeof import('@/lib/store/local-db');
const req = (url: string, methode: string, body?: unknown, kopf: Record<string, string> = {}) =>
  new Request(url, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': 'kevin', ...kopf }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T06:00:00Z'));
  db = await import('@/lib/store/local-db');
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('#8 Kalender-Einstellungen', () => {
  const URL_E = 'http://localhost/api/state/kalender-einstellungen';
  it('ohne Haushalt 403; Teil-Änderung mischt verschachtelte Felder statt sie zu ersetzen', async () => {
    const r = await import('@/app/api/state/kalender-einstellungen/route');
    expect((await r.GET(req(URL_E, 'GET', undefined, { 'x-make-user': 'gast' }))).status).toBe(403);
    expect((await r.PUT(req(URL_E, 'PUT', { vonStunde: 7 }, { 'x-make-user': 'gast' }))).status).toBe(403);
    await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Kevin K', malin: 'Malin M', beide: 'Gemeinsam' }, belegt: { Arbeit: true } });
    // Malin ändert nur „belegt“ eines Kalenders — die übrigen Einträge und die Zuordnung bleiben.
    const a = await r.PUT(req(URL_E, 'PUT', { teil: { belegt: { Sport: false } } }, { 'x-make-user': 'malin' }));
    expect(a.status).toBe(200);
    const e = await (await r.GET(req(URL_E, 'GET'))).json();
    expect(e.belegt).toEqual({ Arbeit: true, Sport: false });
    expect(e.kalender).toEqual({ kevin: 'Kevin K', malin: 'Malin M', beide: 'Gemeinsam' });
    // Nur ein Kalender umbenannt → die anderen beiden bleiben.
    await r.PUT(req(URL_E, 'PUT', { teil: { kalender: { malin: 'Malin Neu' } } }));
    expect((await (await r.GET(req(URL_E, 'GET'))).json()).kalender).toEqual({ kevin: 'Kevin K', malin: 'Malin Neu', beide: 'Gemeinsam' });
    expect((await r.PUT(req(URL_E, 'PUT', { teil: [1, 2] }))).status).toBe(400);
  });
  it('alter Bau (fremde Build-Kennung) → 409 neuLaden, nichts geschrieben', async () => {
    const r = await import('@/app/api/state/kalender-einstellungen/route');
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const a = await r.PUT(req(URL_E, 'PUT', { teil: { vonStunde: 6 } }, { 'x-make-bau': 'bau-alt' }));
    expect(a.status).toBe(409);
    expect((await a.json()).neuLaden).toBe(true);
    vi.unstubAllEnvs();
    expect((await (await r.GET(req(URL_E, 'GET'))).json()).vonStunde).not.toBe(6);
  });
});

describe('#9 Bestätigungslink erst per Knopf', () => {
  it('Fragment wird nur gelesen; die Seite zeigt den Knopf, nicht „bestätigt“', async () => {
    const { fragmentLesen, MailBestaetigen } = await import('@/components/buchen/BuchungStatus');
    const tok = 'A'.repeat(43);
    expect(fragmentLesen(`#mail=${tok}`)).toEqual({ art: 'mail', token: tok });
    expect(fragmentLesen(`#${tok}`)).toEqual({ art: 'status', token: tok });
    expect(fragmentLesen('#mail=kurz')).toEqual({ art: 'kaputt', mail: true });
    let geklickt = 0;
    const html = renderToStaticMarkup(h(MailBestaetigen, { sicht: null, fehler: '', laeuft: false, bereit: true, onBestaetigen: () => { geklickt++; } }));
    expect(html).toContain('E-Mail-Adresse bestätigen</button>');
    expect(html).not.toContain('ist bestätigt');
    expect(geklickt).toBe(0);
    const fertig = renderToStaticMarkup(h(MailBestaetigen, { sicht: { status: 'angefragt', titel: 'Kennenlernen', start: '2026-10-06T10:00:00', ende: '2026-10-06T10:30:00' }, fehler: '', laeuft: false, bereit: false, onBestaetigen: () => {} }));
    expect(fertig).toContain('Danke — Ihre E-Mail-Adresse ist bestätigt.');
    expect(fertig).not.toContain('</button>');
  });
});

describe('#10/#11 Sicherung', () => {
  const URL_S = 'http://localhost/api/kalender/sicherung';
  it('#10 Zurückspielen aus einem alten Bau → 409 neuLaden', async () => {
    const r = await import('@/app/api/kalender/sicherung/route');
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const a = await r.POST(req(URL_S, 'POST', { aktion: 'probelauf', kalender: 'Gemeinsam' }, { 'x-make-bau': 'bau-alt' }));
    expect(a.status).toBe(409);
    expect((await a.json()).neuLaden).toBe(true);
  });

  it('#11 Buchungstermine gesperrt; `von`/privat mitgesichert und zurück in den Bezug; Probelauf nennt beides', async () => {
    const sv = await import('@/lib/kalender/sicherung-server');
    const { buchungTerminUid, terminMarke } = await import('@/lib/kalender/buchung');
    const WER = { art: 'person' as const, person: 'kevin' };
    const bu = buchungTerminUid('bu-0000-probe');
    ic.objekte.set('p', vcal('p', 'Arzt Malin', ['CLASS:PRIVATE']));
    ic.objekte.set(bu, vcal(bu, 'Kennenlernen · Testa Gast'));
    ic.objekte.set('alt-bu', vcal('alt-bu', 'Erstgespräch', [`DESCRIPTION:Gebucht.\\n${terminMarke('bu-alt-1')}`]));
    await db.saveJson('kalender-bezug', { bezuege: { 'home|p': { von: 'malin', privat: true } } });
    expect(await sv.kalenderSicherungTaeglich(new Date('2026-10-05T01:30:00Z'))).toEqual({ gesichert: 1, fehler: 0 });
    // In Apple gelöscht — und der Bezug ist weg (Termin gelöscht).
    ic.objekte.clear();
    await db.saveJson('kalender-bezug', { bezuege: {} });
    const probe = await sv.kalenderWiederherstellen('Gemeinsam', { wer: WER });
    expect(probe.plan).toMatchObject({ fehlt: 1, gesperrt: 2, buchung: 2, bezug: 1 });
    const echt = await sv.kalenderWiederherstellen('Gemeinsam', { wer: WER, bestaetigt: true });
    expect(echt).toMatchObject({ angelegt: 1, fehler: 0 });
    expect(ic.angelegt).toEqual(['p']);
    const b = await db.loadJson<{ bezuege: Record<string, { von?: string; privat?: boolean }> }>('kalender-bezug');
    expect(b?.bezuege['home|p']).toMatchObject({ von: 'malin', privat: true });
  });
});

describe('#13 Drosselung je Netz', () => {
  it('IPv6 auf /64, IPv4 (auch als ::ffff:) unverändert', async () => {
    const { netzVon } = await import('@/lib/zugang/drossel');
    expect(netzVon('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(netzVon('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(netzVon('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(netzVon('[2001:DB8:1:2:3:4:5:6]')).toBe('2001:db8:1:2::/64');
    expect(netzVon('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(netzVon('203.0.113.7')).toBe('203.0.113.7');
    expect(netzVon('direkt')).toBe('direkt');
  });
});

describe('Nachträge F1', () => {
  it('(1) neue Anfangszeit behält die Dauer, das Ende wandert mit (wie Google)', async () => {
    const { vonAendern } = await import('@/lib/kalender/formular');
    expect(vonAendern({ von: '09:00', bis: '10:30' }, '14:00', 60)).toEqual({ von: '14:00', bis: '15:30' });
    expect(vonAendern({ von: '09:00', bis: '08:00' }, '11:00', 45)).toEqual({ von: '11:00', bis: '11:45' }); // keine gültige Dauer → Standard
    expect(vonAendern({ von: '09:00', bis: '10:00' }, '23:30', 60)).toEqual({ von: '23:30', bis: '23:59' }); // nie über Mitternacht
  });

  it('(2) Terminanfrage-Meldung gilt als erledigt, sobald die Buchung entschieden ist', async () => {
    const { buchungenErledigen, pruefeEingabe, leererBestand, ungelesenZahl } = await import('@/lib/meldungen/regeln');
    expect(pruefeEingabe({ an: 'kevin', art: 'buchung', titel: 'Neue Terminanfrage', link: '/os/kalender?buchungen=1', bezug: { art: 'buchung', id: 'bu-1' } })).toEqual({ ok: true });
    const b = { ...leererBestand(), eintraege: [
      { id: 'm1', art: 'buchung' as const, titel: 'Neue Terminanfrage A', link: '/os/kalender', am: '2026-10-05T06:00:00Z', bezug: { art: 'buchung' as const, id: 'bu-offen' } },
      { id: 'm2', art: 'buchung' as const, titel: 'Neue Terminanfrage B', link: '/os/kalender', am: '2026-10-05T06:01:00Z', bezug: { art: 'buchung' as const, id: 'bu-entschieden' } },
      { id: 'm3', art: 'buchung' as const, titel: 'Termin entfernen?', link: '/os/kalender', am: '2026-10-05T06:02:00Z' },
    ] };
    const e = buchungenErledigen(b, { offen: new Set(['bu-offen']), mitTermin: new Set() });
    expect(e.eintraege.map(x => [x.id, !!x.gelesen])).toEqual([['m1', false], ['m2', true], ['m3', false]]);
    expect(ungelesenZahl(e.eintraege)).toBe(2);
    expect(buchungenErledigen(b, null)).toBe(b); // Bestand nicht lesbar → nichts ausblenden
  });
});
