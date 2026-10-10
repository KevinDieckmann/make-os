// ─── Fulfillment C2 — Routen, öffentlicher Weg, Schnittstellen (10.10.; FULFILLMENT_KONZEPT.md 5.2, 5.4, 5.5, 8.1, 11 „C2 Wächter“, 12) ────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), Firmen und Antworten — nie der echte Bestand, kein Netz, kein Modell. Geprüft wird:
//   · Schalter: Umgebung aus ODER Instanz aus → jeder öffentliche Weg dieselbe 404; den Instanz-Schalter legt nur der Inhaber um
//   · Token: genau einmal in der Antwort von „Link anlegen“, nie im Bestand (nur Hash), nie in GET-Antworten; falsches Token, unbekannter Link → dieselbe 404
//   · Link A sieht nie Mandat B; Puls-Token öffnet NUR den Puls; widerrufen → 404; Sicht nur aus der Positivliste (nichts Internes in der Antwort)
//   · Formular: Stempel/Honigtopf derselbe Satz, Stand 409, Größe 413; Upload: Typ am Inhalt (415), Exif weg, „ungeprüft“, KI sieht nur „freigegeben“,
//     20 Dateien je Link (413); Drossel 429; Puls ≤ Schwelle → Glocke ohne Wert + Stapel-Vorschlag → Freigabe = Follow-up
//   · Business only (Privat-Mandat 404, ?space=privat 403, fremder Haushalt 403), Lesen schreibt nie, Fristen (Ende + verwaiste Dateien, Beleg bleibt),
//     Art. 15, Report-Zusatz (ohne Fall null), „So sieht der Kunde es“ = dieselbe Sicht
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-c2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-c2';
process.env.SESSION_SECRET = 'pruef-geheimnis-fulfillment-c2-mindestens-32-zeichen';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM = JSON.stringify([{ id: 'pia', name: 'Pia', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'olaf', name: 'Olaf', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.MAKE_OS_KUNDENLINK;

// C1 (Fall) baut parallel — hier liest `fallLesen` den Fall-Bestand direkt (dieselbe Säuberung), wie C1 es tun wird.
vi.mock('@/lib/fulfillment/prozesse/server', async importOriginal => {
  const orig = await importOriginal<typeof import('@/lib/fulfillment/prozesse/server')>();
  return { ...orig, fallLesen: async (id: string) => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle[id] ?? null };
});

type Handler = (r: Request, ctx?: { params: Promise<{ link: string }> }) => Promise<Response>;
type Mod = Record<string, Handler>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
const H = 'haus-ff';
let intern: Mod, datei: Mod, vorschau: Mod, sicht: Mod, formular: Mod, upload: Mod, puls: Mod;
let db: typeof import('@/lib/store/local-db');
const kopf = (person?: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...extra });
const antw = async (r: Response) => ({ status: r.status, d: await r.clone().json().catch(() => ({})) as J, r });
const ctx = (link: string) => ({ params: Promise.resolve({ link }) });
const iGET = (q: string, person = 'pia') => intern.GET(new Request(`http://test/api/fulfillment/kunde${q}`, { headers: kopf(person) })).then(antw);
const iPOST = (body: unknown, person = 'pia') => intern.POST(new Request('http://test/api/fulfillment/kunde', { method: 'POST', headers: kopf(person), body: JSON.stringify(body) })).then(antw);
const pGET = (link: string, k: Record<string, string> = {}) => sicht.GET(new Request(`http://test/api/kunde/${link}`, { headers: k }), ctx(link)).then(antw);
const pPOST = (m: Mod, weg: string, link: string, body: unknown, k: Record<string, string> = {}) => m.POST(new Request(`http://test/api/kunde/${link}/${weg}`, { method: 'POST', headers: { 'content-type': 'application/json', ...k }, body: JSON.stringify(body) }), ctx(link)).then(antw);
const pUpload = (link: string, k: Record<string, string>, teile: { datei?: [Uint8Array, string]; stempel?: string; webseite?: string; zweck?: string }) => {
  const fd = new FormData();
  if (teile.datei) fd.append('datei', new Blob([new Uint8Array(teile.datei[0])]), teile.datei[1]);
  if (teile.stempel !== undefined) fd.append('stempel', teile.stempel);
  fd.append('webseite', teile.webseite ?? '');
  if (teile.zweck) fd.append('zweck', teile.zweck);
  return upload.POST(new Request(`http://test/api/kunde/${link}/upload`, { method: 'POST', headers: k, body: fd }), ctx(link)).then(antw);
};
const NICHT = { ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' };

const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plus = (n: number) => { const d = new Date(`${heute()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mandat = (id: string, extra: J = {}) => ({
  id, kunde: `Beispiel ${id} GmbH`, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: plus(-30), verlaengerung: 'offen',
  honorar: { betrag: 98765, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [{ id: 'z1', text: 'Neue Termine je Monat', ziel: '12', ist: '4' }],
  health: { beteiligung: 70, umsetzung: 60, wirkung: 50, zahlung: 90, stimmung: 80 }, leistungen: [], offen: ['INTERN-OFFEN'], zustaendig: 'olaf', notiz: 'INTERN-MANDAT-NOTIZ', geaendert: '2026-09-01T00:00:00.000Z', ...extra,
});
const PLAYBOOK = {
  id: 'fb-playbook', art: 'formular', titel: 'Kunden-Playbook', gliederung: [], platzhalter: [], tags: [], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true, fassung: 2, geaendert: '', geaendertVon: 'pia',
  fragen: [{ id: 'q1', abschnitt: 'Ziele', frage: 'Was soll sich ändern?', art: 'langtext' }, { id: 'q2', abschnitt: 'Team', frage: 'Wie viele verkaufen?', art: 'zahl' }],
};
const INTERN_WB = { ...PLAYBOOK, id: 'fb-intern', titel: 'Internes Workbook', urheberPruefen: { seit: '2026-10-01', grund: 'Material Dritter' } };
const fall = (mandatId: string) => ({
  mandatId, vorlageId: 'fp-paket', vorlageFassung: 1, gestartetAm: '2026-09-15T00:00:00.000Z', gestartetVon: 'pia', status: 'laeuft',
  knoten: [
    { id: 'fk-w', titel: 'Paket', rang: 1, status: 'offen' },
    { id: 'fk-p1', elternId: 'fk-w', titel: 'Onboarding', rang: 1, status: 'erledigt', kundeSichtbar: true, erledigtAm: `${plus(-3)}T10:00:00.000Z` },
    { id: 'fk-p2', elternId: 'fk-w', titel: 'Analyse', rang: 2, status: 'in_arbeit', kundeSichtbar: true },
    { id: 'fk-s1', elternId: 'fk-p2', titel: 'INTERNER-SCHRITT Preis kalkulieren', rang: 1, status: 'offen' },
    { id: 'fk-s2', elternId: 'fk-p2', titel: 'Preisliste freigeben', rang: 2, status: 'wartet_kunde', seit: plus(-4) },
    { id: 'fk-b1', elternId: 'fk-p1', titel: 'Playbook', rang: 1, status: 'offen', bausteinId: 'fb-playbook' },
    { id: 'fk-b2', elternId: 'fk-p1', titel: 'Workbook', rang: 2, status: 'offen', bausteinId: 'fb-intern' },
    { id: 'fk-p3', elternId: 'fk-w', titel: 'Diagnose', rang: 3, status: 'offen', kundeSichtbar: true },
  ],
  freigaben: {}, onboarding: {}, stakeholder: [{ id: 'fs-1', kontaktId: 'c-erika', rolle: 'skeptiker', einfluss: 3, haltung: 'kritisch', notiz: 'GEHEIM-NOTIZ' }],
  entscheidungen: [{ id: 'fe-1', am: plus(-2), titel: 'Zielgruppe Maschinenbau', status: 'entschieden', wer: 'beide', geteilt: true, von: 'pia' }, { id: 'fe-2', am: plus(-2), titel: 'INTERN-ENTSCHEIDUNG Preisspielraum', status: 'offen', wer: 'intern', geteilt: false, von: 'pia' }],
  rituale: [{ ritualId: 'fr-woche', terminUids: ['icloud|uid-geheim'], angelegtAm: '2026-09-20' }], mitschriften: [{ id: 'fn-1', am: '2026-09-21', anlass: 'INTERN-MITSCHRIFT', ergebnis: 'x', naechster: 'y', von: 'pia' }],
  quickWins: [], kickoffFragen: [], wertKonto: { z1: { ausgangZahl: 4, zielZahl: 12, festgelegtAm: '2026-09-20', messungen: [{ am: plus(-1), wert: 7, quelle: 'hand' }] } },
  befaehigung: [], marken: {}, geaendert: '2026-09-20T00:00:00.000Z', geaendertVon: 'pia',
});

/** Ein Link wird angelegt; Kennung + Token (nur hier sichtbar) aus dem Pfad. */
async function linkFuer(mandatId: string, rechte?: J): Promise<{ id: string; token: string }> {
  const r = await iPOST({ aktion: 'link-anlegen', mandatId, ...(rechte ? { rechte } : {}) });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  const m = /^\/kunde\/(kl-[a-f0-9]{24})#t=([A-Za-z0-9_-]{43})$/.exec(r.d.pfad);
  expect(m).not.toBeNull();
  expect(r.d.token).toBe(m![2]);
  return { id: m![1], token: m![2] };
}
const stempelAlt = async (linkId: string) => (await import('@/lib/fulfillment/kunde/token')).formularStempel(linkId, Date.now() - 10_000);
const drosselLeeren = async () => { (await import('@/lib/zugang/drossel'))._zuruecksetzen(); (await import('@/lib/fulfillment/kunde/bremse'))._bremseZuruecksetzen(); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  intern = await import('@/app/api/fulfillment/kunde/route') as unknown as Mod;
  datei = await import('@/app/api/fulfillment/kunde/datei/route') as unknown as Mod;
  vorschau = await import('@/app/api/fulfillment/kunde/vorschau/route') as unknown as Mod;
  sicht = await import('@/app/api/kunde/[link]/route') as unknown as Mod;
  formular = await import('@/app/api/kunde/[link]/formular/route') as unknown as Mod;
  upload = await import('@/app/api/kunde/[link]/upload/route') as unknown as Mod;
  puls = await import('@/app/api/kunde/[link]/puls/route') as unknown as Mod;
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: J = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H }), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }), konto('k4', 'kunde', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', {
    firmen: [], chancen: [], leistungen: [{ id: 'l-paket', name: 'Vertriebsleitung auf Zeit', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: '2026-09-01T00:00:00.000Z' }],
    mandate: [mandat('m-a', { leistungId: 'l-paket' }), mandat('m-b'), mandat('m-privat', { gesellschaft: 'kdc' }), mandat('m-ohne')],
    events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [],
  });
  await db.saveJson(`fulfillment--${H}`, {
    version: 1, prozesse: [{ id: 'fp-paket', art: 'paket', titel: 'Paket-Vorlage', knoten: [], uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: '', geaendertVon: '' }],
    bausteine: [PLAYBOOK, INTERN_WB], rituale: [{ id: 'fr-woche', titel: 'Wochen-Check', rhythmus: 'woche', dauerMin: 15, agenda: ['INTERN-AGENDA'], teilnehmende: ['intern'], geaendert: '', geaendertVon: '' }],
    zuordnung: {}, agentZusatz: {}, einstellungen: { kundenLink: { an: false }, pulsSchwelle: 6, willkommenStunden: 24, nachsorgeTage: [14, 45, 90] }, importLaeufe: [], marken: {},
  });
  await db.saveJson(`fulfillment-faelle--${H}`, { version: 1, faelle: { 'm-a': fall('m-a'), 'm-b': fall('m-b'), 'm-privat': fall('m-privat') } });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});
beforeEach(drosselLeeren);

describe('Schalter und Link anlegen (Token genau einmal)', () => {
  it('Schalter: kommt aus; nur der Inhaber legt ihn um; ohne Umgebung kein Link', async () => {
    expect((await iGET('')).d.schalter).toMatchObject({ umgebung: false, instanz: false, an: false, grund: 'betrieb' });
    expect((await iPOST({ aktion: 'schalter', an: true }, 'olaf')).status).toBe(403);
    expect((await iPOST({ aktion: 'schalter', an: true }, 'pia')).d.schalter).toMatchObject({ instanz: true, an: false, grund: 'betrieb' });
    const aus = await iPOST({ aktion: 'link-anlegen', mandatId: 'm-a' });
    expect(aus.status).toBe(409);
    expect(aus.d.aus).toBe(true);
    process.env.MAKE_OS_KUNDENLINK = 'an';
    expect((await iGET('')).d.schalter).toEqual({ umgebung: true, instanz: true, an: true });
  });

  it('Link anlegen: Token nur in DIESER Antwort; Bestand trägt nur den Hash; GET zeigt nie Token oder Hash; ohne Fall / Privat nein', async () => {
    const { id, token } = await linkFuer('m-a');
    const roh = JSON.stringify(await db.loadJson(`fulfillment-kunde--${H}`));
    expect(roh).not.toContain(token);
    expect(roh).toMatch(/"tokenHash":"[a-f0-9]{64}"/);
    const st = await iGET('?m=m-a');
    expect(st.status).toBe(200);
    expect(st.d.link).toMatchObject({ id, status: 'aktiv', rechte: { formular: true, upload: true, puls: true } });
    const text = JSON.stringify(st.d);
    expect(text).not.toContain(token);
    expect(text).not.toContain('tokenHash');
    expect((await iPOST({ aktion: 'link-anlegen', mandatId: 'm-ohne' })).status).toBe(409);
    expect((await iPOST({ aktion: 'link-anlegen', mandatId: 'm-privat' })).status).toBe(404);
    expect((await iGET('?m=m-privat')).status).toBe(404);
  });

  it('Tor: fremder Haushalt und Testkunde 403, Sicht Privat 403, Dienstweg schreibt nie', async () => {
    expect((await iGET('?m=m-a', 'gast')).status).toBe(403);
    expect((await iGET('?m=m-a', 'kunde')).status).toBe(403);
    expect((await iGET('?m=m-a&space=privat')).status).toBe(403);
    const dienst = await intern.POST(new Request('http://test/api/fulfillment/kunde', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' }, body: JSON.stringify({ aktion: 'link-anlegen', mandatId: 'm-a' }) }));
    expect(dienst.status).toBe(403);
  });
});

describe('Öffentlicher Weg: dieselbe 404, Positivliste, Link A ↛ Mandat B', () => {
  it('jede Fehlerart ergibt dieselbe 404 — falsches Token, unbekannt, ohne Token, Umgebung aus, Instanz aus', async () => {
    const { id, token } = await linkFuer('m-a');
    expect((await pGET(id, { 'x-kunde-token': token })).status).toBe(200);
    const faelle = [
      await pGET(id, { 'x-kunde-token': 'A'.repeat(43) }), await pGET('kl-ffffffffffffffffffffffff', { 'x-kunde-token': token }), await pGET(id), await pGET('quatsch', { 'x-kunde-token': token }),
    ];
    await drosselLeeren();
    process.env.MAKE_OS_KUNDENLINK = 'aus';
    faelle.push(await pGET(id, { 'x-kunde-token': token }));
    process.env.MAKE_OS_KUNDENLINK = 'an';
    await iPOST({ aktion: 'schalter', an: false });
    faelle.push(await pGET(id, { 'x-kunde-token': token }));
    await iPOST({ aktion: 'schalter', an: true });
    for (const f of faelle) { expect(f.status).toBe(404); expect(f.d).toEqual(NICHT); }
    // ohne Kontext (wie der Wächter von C0): ebenso
    const ohne = await sicht.GET(new Request(`http://test/api/kunde/${id}`, { headers: { 'x-kunde-token': token } }));
    expect(ohne.status).toBe(404);
  });

  it('die Sicht hat nur Schlüssel der Positivliste und nichts Internes; Vorschau = dieselbe Sicht; Lesen schreibt nie', async () => {
    const { SICHT_SCHLUESSEL } = await import('@/lib/fulfillment/kunde/sicht');
    const { id, token } = await linkFuer('m-a');
    const vorher = JSON.stringify(await db.loadJson(`fulfillment-kunde--${H}`));
    const r = await pGET(id, { 'x-kunde-token': token });
    expect(r.status).toBe(200);
    expect(r.r.headers.get('cache-control')).toBe('no-store');
    expect(r.r.headers.get('x-robots-tag')).toContain('noindex');
    expect(Object.keys(r.d.sicht).every(k => (SICHT_SCHLUESSEL as readonly string[]).includes(k))).toBe(true);
    const text = JSON.stringify(r.d);
    for (const geheim of ['GEHEIM-NOTIZ', 'INTERN-ENTSCHEIDUNG', 'INTERNER-SCHRITT', 'INTERN-MITSCHRIFT', 'INTERN-AGENDA', 'INTERN-OFFEN', 'INTERN-MANDAT-NOTIZ', '98765', 'stimmung', 'skeptiker', 'kritisch', 'uid-geheim', 'fb-playbook', 'fb-intern', 'Internes Workbook', 'tokenHash', 'pia', 'olaf', 'c-erika', 'm-b']) {
      expect(text, geheim).not.toContain(geheim);
    }
    const s = r.d.sicht;
    expect(s.firma).toBe('Beispiel m-a GmbH');
    expect(s.paket).toBe('Vertriebsleitung auf Zeit');
    expect(s.zeitstrahl).toEqual([{ titel: 'Onboarding', stand: 'erledigt' }, { titel: 'Analyse', stand: 'aktuell' }, { titel: 'Diagnose', stand: 'kommt' }]);
    expect(s.wartet.map((w: J) => w.titel)).toEqual(['Preisliste freigeben']);
    expect(s.entscheidungen.map((e: J) => e.titel)).toEqual(['Zielgruppe Maschinenbau']);
    expect(s.rituale).toEqual([{ titel: 'Wochen-Check', rhythmus: 'wöchentlich' }]);
    expect(s.wertKonto[0]).toMatchObject({ name: 'Neue Termine je Monat', vorher: '4', jetzt: '7', ziel: '12' });
    expect(s.formulare.map((f: J) => f.titel)).toEqual(['Kunden-Playbook']);
    expect(s.upload).toEqual({ erlaubt: true, eingegangen: 0, frei: 20 });
    expect(JSON.stringify(await db.loadJson(`fulfillment-kunde--${H}`))).toBe(vorher);
    const v = await vorschau.GET(new Request('http://test/api/fulfillment/kunde/vorschau?m=m-a', { headers: kopf('olaf') })).then(antw);
    expect(v.d.sicht).toEqual(r.d.sicht);
  });

  it('Link A sieht nie Mandat B; widerrufen → 404', async () => {
    const a = await linkFuer('m-a');
    const b = await linkFuer('m-b');
    expect((await pGET(b.id, { 'x-kunde-token': a.token })).status).toBe(404);
    expect((await pGET(a.id, { 'x-kunde-token': b.token })).status).toBe(404);
    expect((await pGET(b.id, { 'x-kunde-token': b.token })).d.sicht.firma).toBe('Beispiel m-b GmbH');
    await iPOST({ aktion: 'widerrufen', linkId: b.id });
    expect((await pGET(b.id, { 'x-kunde-token': b.token })).d).toEqual(NICHT);
  });

  it('Drossel: wiederholte Fehlgriffe → 429', async () => {
    const st: number[] = [];
    for (let i = 0; i < 8; i++) st.push((await pGET('kl-eeeeeeeeeeeeeeeeeeeeeeee', { 'x-kunde-token': 'A'.repeat(43) })).status);
    expect(st.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(st).toContain(429);
  });
});

describe('Formular über den Link', () => {
  it('Stempel zu frisch und Honigtopf: derselbe Satz; Antworten gespeichert; alter Stand 409; zu groß 413; Recht aus → 404', async () => {
    const { id, token } = await linkFuer('m-a');
    const s = (await pGET(id, { 'x-kunde-token': token })).d;
    const f = s.sicht.formulare[0];
    const t = { 'x-kunde-token': token };
    const frisch = await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q1: 'Mehr Termine' }, stand: f.stand, stempel: s.stempel, webseite: '' }, t);
    const falle = await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q1: 'x' }, stand: f.stand, stempel: await stempelAlt(id), webseite: 'http://spam' }, t);
    expect(frisch.status).toBe(400);
    expect(falle.d.fehler).toBe(frisch.d.fehler);
    const ok = await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q1: 'Mehr Termine, weniger Zufall.' }, stand: f.stand, abschnitt: f.abschnitte[0].schluessel, fertig: true, stempel: await stempelAlt(id), webseite: '' }, t);
    expect(ok.status, JSON.stringify(ok.d)).toBe(200);
    expect(ok.d.prozent).toBe(50);
    expect((await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q2: '3' }, stand: f.stand, stempel: await stempelAlt(id) }, t)).status).toBe(409);
    expect((await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q1: 'x'.repeat(70_000) }, stempel: await stempelAlt(id) }, t)).status).toBe(413);
    const intern = await iGET('?m=m-a');
    expect(intern.d.formulare.find((x: J) => x.bausteinId === 'fb-playbook')).toMatchObject({ prozent: 50, quelle: 'kunde', antworten: { q1: 'Mehr Termine, weniger Zufall.' } });
    expect(intern.d.kurz.formularProzent).toBe(50);
    // Rechte: Formular aus → derselbe Weg 404
    await iPOST({ aktion: 'rechte', linkId: id, rechte: { formular: false } });
    expect((await pPOST(formular, 'formular', id, { formular: f.schluessel, antworten: { q2: '3' }, stempel: await stempelAlt(id) }, t)).d).toEqual(NICHT);
    expect((await pGET(id, t)).d.sicht.formulare).toEqual([]);
  });
});

const JPEG_EXIF = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0c, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x21, 0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0x03, 0xff, 0xd9]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('Upload über den Link', () => {
  it('Typ am Inhalt (415), Exif weg, „ungeprüft“, neutrale Glocke; Analyse sieht nur „freigegeben“; Download nur als Anhang', async () => {
    const { id, token } = await linkFuer('m-a');
    const t = { 'x-kunde-token': token };
    expect((await pUpload(id, t, { datei: [SVG, 'bild.svg'], stempel: await stempelAlt(id) })).status).toBe(415);
    expect((await pUpload(id, t, { datei: [JPEG_EXIF, 'getarnt.pdf'], stempel: await stempelAlt(id) })).status).toBe(415);
    expect((await pUpload(id, t, { datei: [JPEG_EXIF, 'foto.jpg'], stempel: await stempelAlt(id), webseite: 'x' })).status).toBe(400);
    const ok = await pUpload(id, t, { datei: [JPEG_EXIF, 'Foto vom Lager.jpg'], stempel: await stempelAlt(id), zweck: 'register' });
    expect(ok.status, JSON.stringify(ok.d)).toBe(200);
    const st = await iGET('?m=m-a');
    const u = st.d.unterlagen[0];
    expect(u).toMatchObject({ name: 'Foto vom Lager.jpg', typ: 'image/jpeg', status: 'ungeprueft', herkunft: 'kunde', zweck: 'register', linkId: id });
    const { bildOeffnen } = await import('@/lib/store/bild-ablage');
    const roh = await bildOeffnen('fulfillment-unterlagen', `${u.id}.bin`);
    expect(roh!.includes(Buffer.from('Exif'))).toBe(false);
    const glocke = JSON.stringify(await db.loadJson('meldungen--olaf'));
    expect(glocke).toContain('Neue Unterlagen zu „Mandat m-a“ eingegangen');
    expect(glocke).not.toContain('Lager');
    const k = await import('@/lib/fulfillment/kunde/server');
    expect(await k.unterlagenFuer('m-a')).toEqual([]);
    expect(await k.unterlageText('m-a', u.id)).toMatchObject({ ok: false });
    await iPOST({ aktion: 'unterlage-status', id: u.id, status: 'freigegeben' });
    expect((await k.unterlagenFuer('m-a')).map(x => x.id)).toEqual([u.id]);
    const dl = await datei.GET(new Request(`http://test/api/fulfillment/kunde/datei?id=${u.id}`, { headers: kopf('pia') }));
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toBe('application/octet-stream');
    expect(dl.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
    expect(dl.headers.get('content-security-policy')).toContain('sandbox');
    // Die Kunden-Seite zählt nur — keine Liste
    const s = (await pGET(id, t)).d.sicht;
    expect(s.upload).toEqual({ erlaubt: true, eingegangen: 1, frei: 19 });
    expect(JSON.stringify(s)).not.toContain('Lager');
  });

  it('20 Dateien je Link → 413; Datei > 25 MB → 413; Recht aus → 404; Beleg lässt sich nicht entfernen', async () => {
    const { id, token } = await linkFuer('m-b');
    const t = { 'x-kunde-token': token };
    const sp = await import('@/lib/fulfillment/speicher');
    await sp.fulfillmentAendern('kunde', d => ({ ok: true, datei: { ...d, unterlagen: [...d.unterlagen, ...Array.from({ length: 20 }, (_, i) => ({ id: `ud-voll-${i}`, mandatId: 'm-b', name: `x${i}.pdf`, typ: 'application/pdf', groesse: 10, am: '2026-10-01', herkunft: 'kunde' as const, linkId: id, zweck: 'sonstig' as const, status: 'ungeprueft' as const }))] }, geaendert: [] }));
    const voll = await pUpload(id, t, { datei: [JPEG_EXIF, 'noch.jpg'], stempel: await stempelAlt(id) });
    expect(voll.status).toBe(413);
    expect(readdirSync(path.join(ordner, 'fulfillment-unterlagen')).filter(n => n.startsWith('ud-')).length).toBe(1); // nur die Datei aus dem Test davor
    const gross = await pUpload(id, t, { datei: [new Uint8Array(25 * 1024 * 1024 + 70 * 1024), 'riesig.pdf'], stempel: await stempelAlt(id) });
    expect(gross.status).toBe(413);
    await iPOST({ aktion: 'rechte', linkId: id, rechte: { upload: false } });
    expect((await pUpload(id, t, { datei: [JPEG_EXIF, 'x.jpg'], stempel: await stempelAlt(id) })).d).toEqual(NICHT);
    await iPOST({ aktion: 'unterlage-status', id: 'ud-voll-0', beleg: true });
    const weg = await datei.DELETE(new Request('http://test/api/fulfillment/kunde/datei?id=ud-voll-0', { method: 'DELETE', headers: kopf('pia') })).then(antw);
    expect(weg.status).toBe(409);
    expect((await datei.DELETE(new Request('http://test/api/fulfillment/kunde/datei?id=ud-voll-1', { method: 'DELETE', headers: kopf('pia') })).then(antw)).status).toBe(200);
  });
});

describe('Kunden-Puls', () => {
  it('Puls-Token öffnet NUR den Puls; Wert ≤ Schwelle → Glocke ohne Wert + Stapel-Vorschlag → Freigabe legt ein Follow-up an; eine Antwort je Anfrage', async () => {
    const { id, token } = await linkFuer('m-a');
    const a = await iPOST({ aktion: 'puls-anfrage', mandatId: 'm-a' });
    expect(a.status).toBe(200);
    const p = /#p=([A-Za-z0-9_-]{43})$/.exec(a.d.pfad)![1];
    expect(a.d.pfad.startsWith(`/kunde/${id}#p=`)).toBe(true);
    expect(JSON.stringify(await db.loadJson(`fulfillment-kunde--${H}`))).not.toContain(p);
    const tp = { 'x-kunde-puls': p };
    const s = await pGET(id, tp);
    expect(s.d.sicht.modus).toBe('puls');
    expect(s.d.sicht.puls).toEqual({ offen: true });
    for (const k of ['zeitstrahl', 'erledigt', 'naechstes', 'wartet', 'wertKonto', 'rituale', 'entscheidungen', 'formulare']) expect(s.d.sicht[k], k).toEqual([]);
    expect(s.d.sicht.upload).toBeNull();
    expect((await pPOST(formular, 'formular', id, { formular: 'fo-x', antworten: {}, stempel: await stempelAlt(id) }, tp)).d).toEqual(NICHT);
    expect((await pUpload(id, tp, { datei: [JPEG_EXIF, 'x.jpg'], stempel: await stempelAlt(id) })).d).toEqual(NICHT);
    expect((await pGET(id, { 'x-kunde-token': p })).status).toBe(404);
    expect((await pGET(id, { 'x-kunde-puls': token })).status).toBe(404);
    const antwort = await pPOST(puls, 'puls', id, { wert: 4, satz: 'Zu wenig Rückmeldung.', stempel: await stempelAlt(id), webseite: '' }, tp);
    expect(antwort.status, JSON.stringify(antwort.d)).toBe(200);
    expect((await pPOST(puls, 'puls', id, { wert: 9, stempel: await stempelAlt(id) }, tp)).status).toBe(409);
    expect((await pGET(id, tp)).d.sicht.puls).toEqual({ offen: false });
    const glocke = JSON.stringify(await db.loadJson('meldungen--olaf'));
    expect(glocke).toContain('Kunden-Puls zu „Mandat m-a“ braucht Aufmerksamkeit');
    expect(glocke).not.toMatch(/\b4\b.*Puls|Puls.*\b4\b/);
    const stapel = (await db.loadJson<{ vorschlaege: J[] }>('zoe-stapel'))!.vorschlaege.filter(v => v.bezug?.art === 'fulfillment' && String(v.bezug.id).startsWith('k:puls:'));
    expect(stapel).toHaveLength(1);
    expect(stapel[0].person).toBe('olaf');
    expect(JSON.stringify([stapel[0].titel, stapel[0].nachher, stapel[0].anlass])).not.toContain('4');
    // Morgenlauf legt keinen zweiten an (Marke)
    const { kundeMorgenlauf, KUNDE_STAPEL } = await import('@/lib/fulfillment/kunde/server');
    expect((await kundeMorgenlauf(H, heute())).vorschlaege).toBe(0);
    const f = await KUNDE_STAPEL.freigeben(stapel[0] as never, 'olaf', {});
    expect(f.ok, JSON.stringify(f)).toBe(true);
    const crm = await db.loadJson<{ followups: J[] }>('crm');
    expect(crm!.followups.filter(x => x.bezug?.id === 'm-a' && x.text === 'Gespräch anbieten (Kunden-Puls)')).toHaveLength(1);
    // In die Health übernehmen (nur per Klick, CRM-Schreibweg)
    const pulsId = (await iGET('?m=m-a')).d.puls.liste[0].id;
    expect((await iPOST({ aktion: 'puls-uebernehmen', mandatId: 'm-a', pulsId })).d).toMatchObject({ ok: true, stimmung: 40 });
    expect((await db.loadJson<{ mandate: J[] }>('crm'))!.mandate.find(m => m.id === 'm-a')!.health.stimmung).toBe(40);
    // Report: mit Fall + aktivem Link → Puls-Frage; ohne Fall null
    const z = await (await import('@/lib/fulfillment/kunde/server')).reportZusatzFuer('m-a', heute());
    expect(z).toMatchObject({ pulsFrage: true, puls: { wert: 4 } });
    expect(await (await import('@/lib/fulfillment/kunde/server')).reportZusatzFuer('m-ohne', heute())).toBeNull();
  });
});

describe('Fristen, Auskunft, Schnittstellen', () => {
  it('Art. 15: Antworten und Puls-Sätze, die die Person nennen', async () => {
    const sp = await import('@/lib/fulfillment/speicher');
    await sp.fulfillmentAendern('kunde', d => ({ ok: true, datei: { ...d, formulare: [...d.formulare, { mandatId: 'm-b', bausteinId: 'fb-playbook', fassung: 2, antworten: { q1: 'Entscheidet: Erika Beispiel' }, fertig: [], geaendertAm: '2026-10-01T00:00:00.000Z', quelle: 'kunde' }] }, geaendert: [] }));
    const { kundeAuskunft } = await import('@/lib/fulfillment/kunde/server');
    const { merkmaleVon } = await import('@/lib/crm/person-weitere');
    const a = await kundeAuskunft(merkmaleVon('c-erika', { vorname: 'Erika', nachname: 'Beispiel' }));
    expect(a).toEqual([{ mandatId: 'm-b', art: 'formular', am: '2026-10-01T00:00:00.000Z', text: 'Entscheidet: Erika Beispiel' }]);
  });

  it('Fristen: Mandat beendet → Antworten und Unterlagen weg (Datei mit), Beleg bleibt; verwaiste alte Datei weg; leeres CRM löscht nie', async () => {
    const crm = (await db.loadJson<J>('crm'))!;
    crm.mandate = crm.mandate.map((m: J) => (m.id === 'm-b' ? { ...m, status: 'beendet', ende: '2025-01-15' } : m));
    await db.saveJson('crm', crm);
    const { bildAblegen } = await import('@/lib/store/bild-ablage');
    await bildAblegen('fulfillment-unterlagen', 'ud-verwaist-alt.bin', Buffer.from('x'));
    await bildAblegen('fulfillment-unterlagen', 'ud-verwaist-neu.bin', Buffer.from('x'));
    const alt = new Date(Date.now() - 3 * 86_400_000);
    utimesSync(path.join(ordner, 'fulfillment-unterlagen', 'ud-verwaist-alt.bin'), alt, alt);
    const { kundeFristen } = await import('@/lib/fulfillment/kunde/server');
    const z = await kundeFristen({ heute: heute(), jetzt: new Date(), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } });
    expect(z['fulfillment-antworten']).toBe(1);
    expect(z['fulfillment-unterlagen']).toBeGreaterThanOrEqual(18);
    expect(z['fulfillment-unterlagen-verwaist']).toBe(1);
    const k = (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('kunde'));
    expect(k.unterlagen.filter(u => u.mandatId === 'm-b').map(u => u.id)).toEqual(['ud-voll-0']);
    expect(k.formulare.some(f => f.mandatId === 'm-b')).toBe(false);
    const namen = readdirSync(path.join(ordner, 'fulfillment-unterlagen'));
    expect(namen).toContain('ud-verwaist-neu.bin');
    expect(namen).not.toContain('ud-verwaist-alt.bin');
    // Ohne ein einziges Mandat im CRM gilt nichts als verwaist (nie alles löschen, weil das CRM nicht lesbar war).
    const vorher = JSON.stringify(k);
    await db.saveJson('crm', { ...crm, mandate: [] });
    await kundeFristen({ heute: heute(), jetzt: new Date(), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } });
    expect(JSON.stringify(await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('kunde'))).toBe(vorher);
    await db.saveJson('crm', crm);
  });

  it('Kurzform für das Cockpit; Antworten nur für Business-Mandate; Export als Anhang', async () => {
    const { kundeKurzFuer, formularAntwortenFuer } = await import('@/lib/fulfillment/kunde/server');
    const k = await kundeKurzFuer(['m-a', 'm-ohne']);
    expect(k['m-a']).toMatchObject({ link: 'aktiv', formularProzent: 50 });
    expect(k['m-ohne']).toMatchObject({ link: 'keiner', formularProzent: null });
    expect(await formularAntwortenFuer('m-privat')).toEqual([]);
    const csv = await intern.GET(new Request('http://test/api/fulfillment/kunde?m=m-a&export=csv', { headers: kopf('pia') }));
    expect(csv.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(await csv.text()).toContain('Mehr Termine, weniger Zufall.');
    const pdf = await intern.GET(new Request('http://test/api/fulfillment/kunde?m=m-a&export=pdf', { headers: kopf('pia') }));
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    process.env.MAKE_OS_KUNDENLINK = 'aus';
    expect((await kundeKurzFuer(['m-a']))['m-a'].link).toBe('aus');
    process.env.MAKE_OS_KUNDENLINK = 'an';
  });
});
