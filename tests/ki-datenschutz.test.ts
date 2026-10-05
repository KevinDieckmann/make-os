// ─── Wächter: KI, Gesundheit (Art. 9) und Telegram datenschutzfest (05.10.) ───────────────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte — nie der echte Bestand. Eine NEUE Instanz
// (Vorgabe „sparsam“): Hintergrund-KI und Web-Suche aus, neue Konten brauchen die Einwilligung (a).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ki-ds-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ki';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
process.env.ANTHROPIC_API_KEY = 'sk-ant-nur-test';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let ein: typeof import('@/lib/datenschutz/gesundheit-einwilligung');
let ke: typeof import('@/lib/datenschutz/ki-einstellungen');

const HEUTE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const MODELL_ANTWORT = (text = 'Erledigt.') => new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2 } }), { status: 200 });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  ke = await import('@/lib/datenschutz/ki-einstellungen');
  // Konten NACH der Einführung angelegt — also keine Bestands-Konten (keine stille Verarbeitung ohne (a)).
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['jonas'] }, haushalt: 'h-demo' },
    { id: '2', speicher: 'jonas', email: 'jonas@example.invalid', name: 'Jonas Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: ['lena'] }, haushalt: 'h-demo' },
    { id: '3', speicher: 'gast', email: 'gast@example.invalid', name: 'Gast Fremd', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
  ], einladungen: [] });
  // Erkennbare Gesundheitswerte — sie dürfen ohne Einwilligung (b) NIE in einem Modell-Aufruf stehen.
  await db.saveJson('vitals--lena', { [HEUTE]: { rec: 37, sleep: 6.4, hrv: 41, rhr: 63, note: 'MARKER-KOERPERNOTIZ' } });
  await db.saveJson('ernaehrung', { profile: [{ person: 'lena', name: 'Lena', bedarf: 'MARKER-BEDARF', unvertraeglich: ['MARKER-UNVERTRAEGLICH'], nie: [], gern: [], ziel: '', konto: true, stand: '' }] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid' }] });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Vorgaben einer neuen Instanz', () => {
  it('sparsam: Hintergrund-KI und Web-Suche aus, Bereiche an — einmal festgeschrieben', async () => {
    const d = await ke.ladeKiEinstellungen();
    expect(d.vorgabe).toBe('sparsam');
    const s = await ke.kiSchalterFuer('lena');
    expect(s.hintergrund).toBe(false);
    expect(s.websuche).toBe(false);
    expect(Object.values(s.bereiche).every(Boolean)).toBe(true);
  });
  it('eine Person kann nur einschränken, nie über die Instanz hinaus öffnen', () => {
    const d = { vorgabe: 'sparsam' as const, festgelegtAm: '2026-10-10T00:00:00.000Z', personen: { lena: { hintergrund: true, bereiche: { crm: false } } } };
    const w = ke.wirksameSchalter(d, 'lena');
    expect(w.hintergrund).toBe(false);
    expect(w.bereiche.crm).toBe(false);
    expect(w.bereiche.kalender).toBe(true);
  });
  it('Kevins Instanz (kompatibel): alles an wie bisher; Bestands-Konten verarbeiten ohne Erklärung, aber mit Hinweis', () => {
    expect(ke.vorgabeSchalter('kompatibel')).toMatchObject({ hintergrund: true, websuche: true });
    const d = { vorgabe: 'kompatibel' as const, festgelegtAm: '2026-10-06T00:00:00.000Z' };
    expect(ke.istBestandsKonto(d, '2026-09-01')).toBe(true);
    expect(ke.istBestandsKonto(d, '2026-10-07')).toBe(false);
    const st = ein.gesundheitStand([], 'kevin', true);
    expect(st).toMatchObject({ verarbeitungErlaubt: true, hinweisOffen: true });
    expect(st.ki.an).toBe(false);
    expect(st.partner.an).toBe(false);
  });
});

describe('Schalter aus → kein Hintergrund-Lauf', () => {
  it('askText im Hintergrund: gesperrt, kein Netz, Zeile im Protokoll', async () => {
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-hintergrund', ki: { lauf: 'hintergrund', person: null, kategorien: ['aufgaben'] } });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('ki-gesperrt:hintergrund-aus');
    expect(anthropic.kiGesperrt(r)).toBe(true);
    expect(netz).not.toHaveBeenCalled();
  });
  it('auch wenn der Aufrufer „aufruf“ behauptet: im Hintergrund-Kontext (Arbeiter) zählt Hintergrund', async () => {
    const { imHintergrund } = await import('@/lib/datenschutz/ki-lauf');
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await imHintergrund(() => anthropic.askText({ system: 'x', user: 'y', zweck: 'test-tarnung', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] } }));
    expect(r.error).toBe('ki-gesperrt:hintergrund-aus');
    expect(netz).not.toHaveBeenCalled();
  });
  it('ein Dienstaufruf ohne Person ist ein Systemlauf (Hintergrund); der Kopf x-make-lauf gilt nur mit Dienstschlüssel', async () => {
    const { kiLaufAus } = await import('@/lib/datenschutz/ki-lauf');
    expect(kiLaufAus(new Request('http://t/', { headers: { 'x-make-key': 'pruef-schluessel-ki' } }))).toBe('hintergrund');
    expect(kiLaufAus(new Request('http://t/', { headers: { 'x-make-key': 'pruef-schluessel-ki', 'x-make-person': 'lena', 'x-make-lauf': 'hintergrund' } }))).toBe('hintergrund');
    expect(kiLaufAus(new Request('http://t/', { headers: { 'x-make-user': 'lena', 'x-make-lauf': 'hintergrund' } }))).toBe('aufruf');
  });
  it('Web-Suche aus: askWithSearch läuft ohne Werkzeug', async () => {
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT('Lage.'));
    const r = await anthropic.askWithSearch({ system: 'x', user: 'y', zweck: 'test-web', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] } });
    expect(r.webUsed).toBe(false);
    const body = JSON.parse(String((netz.mock.calls[0][1] as RequestInit).body));
    expect(body.tools).toBeUndefined();
  });
  it('ein für ZOE ausgeschalteter Bereich: kein Modell-Aufruf mit dieser Kategorie, kein Werkzeug', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), jonas: { bereiche: { finanzen: false } } } }));
    const netz = vi.spyOn(globalThis, 'fetch');
    const r = await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-bereich', ki: { lauf: 'gespraech', person: 'jonas', kategorien: ['finanzen'] } });
    expect(r.error).toBe('ki-gesperrt:bereich-finanzen');
    expect(netz).not.toHaveBeenCalled();
    const { werkzeugSperreFuer } = await import('@/lib/datenschutz/ki-werkzeuge');
    expect(await werkzeugSperreFuer('finanzen', 'jonas')).toMatch(/ausgeschaltet/);
    expect(await werkzeugSperreFuer('finanzen', 'lena')).toBeNull();
  });
});

describe('Ohne Einwilligung (b) erreicht kein Gesundheitswert den Modell-Aufruf', () => {
  it('das Brain liest die Vitalwerte gar nicht erst; der Prompt trägt nichts davon', async () => {
    const { gatherBrain, promptBrain, brainKategorien } = await import('@/lib/brain');
    const b = await gatherBrain(HEUTE, 'lena');
    expect(b.gesundheitFrei).toBe(false);
    expect(b.vitals.rec).toBe(0);
    const p = promptBrain(b);
    expect(p).not.toMatch(/Recovery 37|MARKER-KOERPERNOTIZ|KÖRPER/);
    expect(brainKategorien(b)).not.toContain('gesundheit');
  });
  it('kein Gesundheits-Kontext aus dem Profil, Ernährungs-Profile nur als neutrale Küchenregel', async () => {
    const { eigenerGesundheitsKontext } = await import('@/lib/gesundheit/kontext');
    expect(await eigenerGesundheitsKontext('lena')).toBe('');
    const { profileFuerKi } = await import('@/lib/datenschutz/gesundheit-ki');
    const r = await profileFuerKi([{ person: 'lena', name: 'Lena', bedarf: 'MARKER-BEDARF', unvertraeglich: ['MARKER-UNVERTRAEGLICH'], nie: [], gern: [], ziel: 'Z', konto: true, stand: '' }]);
    expect(r.mitGesundheit).toBe(false);
    expect(r.profile[0].bedarf).toBe('');
    expect(r.profile[0].unvertraeglich).toEqual([]);
    expect(r.profile[0].nie).toEqual(['MARKER-UNVERTRAEGLICH']); // als Küchenregel, ohne Gesundheitsbezug
  });
  it('askText mit Kategorie „gesundheit“ ohne (b): gesperrt, kein Netz — Systemlauf ohne Person immer', async () => {
    const netz = vi.spyOn(globalThis, 'fetch');
    expect((await anthropic.askText({ system: 'x', user: 'Recovery 37', zweck: 'test-g', ki: { lauf: 'aufruf', person: 'lena', kategorien: ['gesundheit'] } })).error).toBe('ki-gesperrt:einwilligung-gesundheit');
    expect((await anthropic.askText({ system: 'x', user: 'y', zweck: 'test-g2', ki: { lauf: 'aufruf', person: null, kategorien: ['gesundheit'] } })).error).toBe('ki-gesperrt:einwilligung-gesundheit');
    expect(netz).not.toHaveBeenCalled();
  });
  it('ZOEs Gesundheits-Werkzeuge: gesperrt ohne (b); fremde Werte nur mit (b)+(c) des Eigentümers', async () => {
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const r = await fuehreAus('gesundheits_index', {}, 'http://test', { person: 'lena' });
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/Einwilligung/);
    expect(r.text).not.toMatch(/37/);
    // Lena willigt in (a) und (b) ein — Jonas ebenfalls (seine ZOE trägt die Antwort). Ohne Lenas (c) liest Jonas' ZOE nichts.
    for (const p of ['lena', 'jonas']) {
      expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
      expect((await ein.gesundheitErklaeren(p, 'ki', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    }
    const fremd = await fuehreAus('gesundheits_index', { person: 'lena' }, 'http://test', { person: 'jonas' });
    expect(fremd.text).toMatch(/nicht an deine ZOE frei/);
    expect(await ein.gesundheitFuerZoe('lena', 'jonas')).toBe(false);
    expect((await ein.gesundheitErklaeren('lena', 'partner', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
    expect(await ein.gesundheitFuerZoe('lena', 'jonas')).toBe(true);
    expect(await ein.gesundheitFuerZoe('lena', 'gast')).toBe(false); // teilt nicht mit dem Gast
  });
  it('mit (b): Werte gehen mit, die Kategorie steht im Protokoll — Widerruf von (a) beendet (b) und (c)', async () => {
    const { gatherBrain, promptBrain } = await import('@/lib/brain');
    const b = await gatherBrain(HEUTE, 'lena');
    expect(b.gesundheitFrei).toBe(true);
    expect(promptBrain(b)).toMatch(/Recovery 37%/);
    const w = await ein.gesundheitErklaeren('lena', 'verarbeiten', false, ein.GESUNDHEIT_FASSUNG);
    expect(w.ok && w.stand).toMatchObject({ verarbeiten: { an: false }, ki: { an: false }, partner: { an: false }, verarbeitungErlaubt: false });
    expect((await gatherBrain(HEUTE, 'lena')).gesundheitFrei).toBe(false);
    // Nachweis unveränderlich: der Widerruf ist ein neues Ereignis, die alten bleiben.
    const n = await ein.gesundheitNachweis('lena');
    expect(n.filter(e => e.zweck === 'verarbeiten').map(e => e.an)).toEqual([true, false]);
    expect(n.some(e => e.folge === 'widerruf-verarbeiten')).toBe(true);
  });
});

describe('Einwilligung: nur die Person selbst, Regeln der Zwecke', () => {
  it('(b) ohne (a), (c) ohne (b), falsche Fassung → abgelehnt; Neues Konto ohne (a) schreibt keine Gesundheitsdaten (403)', async () => {
    expect(ein.erklaeren([], 'p', false, 'ki', true, ein.GESUNDHEIT_FASSUNG, 'x')).toEqual({ fehler: 'voraussetzung' });
    expect(ein.erklaeren([], 'p', false, 'verarbeiten', true, 'alt', 'x')).toEqual({ fehler: 'fassung' });
    const vitals = (await import('@/app/api/state/vitals/route')) as unknown as { PUT: (r: Request) => Promise<Response> };
    const r = await vitals.PUT(new Request('http://t/api/state/vitals', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-make-user': 'gast' }, body: JSON.stringify({ vitals: { rec: 50 } }) }));
    expect(r.status).toBe(403);
    expect((await r.json()).einwilligung).toBe('gesundheit');
  });
  it('Route: Dienstweg und fremde Person → 403; die Person selbst erklärt', async () => {
    const route = (await import('@/app/api/datenschutz/gesundheit/route')) as unknown as { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
    const post = (h: Record<string, string>, body: unknown) => new Request('http://t/api/datenschutz/gesundheit', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
    expect((await route.POST(post({ 'x-make-key': 'pruef-schluessel-ki', 'x-make-person': 'gast' }, { zweck: 'verarbeiten', an: true, fassung: ein.GESUNDHEIT_FASSUNG }))).status).toBe(403);
    expect((await route.POST(post({ 'x-make-user': 'lena' }, { person: 'gast', zweck: 'verarbeiten', an: true, fassung: ein.GESUNDHEIT_FASSUNG }))).status).toBe(403);
    const ok = await route.POST(post({ 'x-make-user': 'gast' }, { zweck: 'verarbeiten', an: true, fassung: ein.GESUNDHEIT_FASSUNG }));
    expect(ok.status).toBe(200);
    const g = await (await route.GET(new Request('http://t/', { headers: { 'x-make-user': 'gast' } }))).json();
    expect(g.stand.verarbeiten.an).toBe(true);
    expect(g.nachweis.every((e: { person: string }) => e.person === 'gast')).toBe(true);
  });
  it('KI-Schalter der Instanz stellt nur der Inhaber; der Dienstweg nichts', async () => {
    const route = (await import('@/app/api/datenschutz/ki/route')) as unknown as { PUT: (r: Request) => Promise<Response> };
    const put = (h: Record<string, string>, body: unknown) => new Request('http://t/api/datenschutz/ki', { method: 'PUT', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
    expect((await route.PUT(put({ 'x-make-user': 'jonas' }, { ebene: 'instanz', schalter: { hintergrund: true } }))).status).toBe(403);
    expect((await route.PUT(put({ 'x-make-key': 'pruef-schluessel-ki' }, { ebene: 'person', schalter: { hintergrund: false } }))).status).toBe(403);
    expect((await route.PUT(put({ 'x-make-user': 'jonas' }, { ebene: 'person', person: 'lena', schalter: { websuche: false } }))).status).toBe(403);
  });
  it('Kompass: ein Konto aus einem anderen Haushalt → 403; der Regler „Körperdaten an Agenten“ ist weg', async () => {
    const route = (await import('@/app/api/state/kompass/route')) as unknown as { GET: (r: Request) => Promise<Response>; PUT: (r: Request) => Promise<Response> };
    expect((await route.GET(new Request('http://t/', { headers: { 'x-make-user': 'gast' } }))).status).toBe(403);
    expect((await route.PUT(new Request('http://t/', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-make-user': 'gast' }, body: '{}' }))).status).toBe(403);
    const { REGLER } = await import('@/lib/make-one/kompass-data');
    expect(REGLER.some(r => (r.id as string) === 'koerper-an-agenten')).toBe(false);
  });
});

describe('Pseudonymisierung in automatischen Läufen', () => {
  it('rein: ersetzt Vor-+Nachname, „Nachname, Vorname“ und Adresse — und übersetzt zurück', async () => {
    const { pseudonymisierer } = await import('@/lib/datenschutz/pseudonym');
    const p = pseudonymisierer([{ id: 'c-b', vorname: 'Bert', nachname: 'Muster' }, { id: 'c-a', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid' }]);
    const t = p.ersetze('Anna Beispiel (anna@example.invalid) trifft Muster, Bert. Annabeispiel bleibt.');
    expect(t).toBe('[K1] ([K1-mail]) trifft [K2]. Annabeispiel bleibt.');
    expect(p.zurueck('Ruf [K1] an, schreib an [K1-mail].')).toBe('Ruf Anna Beispiel an, schreib an anna@example.invalid.');
    expect(p.ersetzt()).toBe(2);
  });
  it('im Hintergrund-Lauf verlässt kein Kontaktname den Server — die Antwort kommt mit Namen zurück', async () => {
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), hintergrund: true } }));
    const { pseudonymVergessen } = await import('@/lib/datenschutz/ki-tor');
    pseudonymVergessen();
    const netz = vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT('Heute zuerst [K1] anrufen.'));
    const r = await anthropic.askText({ system: 'Lage', user: 'Anna Beispiel wartet seit Freitag.', zweck: 'test-pseudo', ki: { lauf: 'hintergrund', person: null, kategorien: ['crm'] } });
    expect(r.ok).toBe(true);
    const gesendet = String((netz.mock.calls[0][1] as RequestInit).body);
    expect(gesendet).not.toContain('Anna Beispiel');
    expect(gesendet).toContain('[K1]');
    expect(r.text).toBe('Heute zuerst Anna Beispiel anrufen.');
  });
});

describe('KI-Protokoll ohne Inhalte', () => {
  it('je Aufruf eine Zeile mit Metadaten — nie Prompt, Antwort, Namen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(MODELL_ANTWORT('ANTWORT-GEHEIM'));
    await anthropic.askText({ system: 'SYSTEM-GEHEIM', user: 'FRAGE-GEHEIM Anna Beispiel', zweck: 'test-protokoll', ki: { lauf: 'gespraech', person: 'lena', kategorien: ['crm'], anzahl: 1 } });
    const { kiProtokollLesen } = await import('@/lib/datenschutz/ki-protokoll');
    await new Promise(r => setTimeout(r, 50));
    const zeilen = await kiProtokollLesen({ person: 'lena', monate: 1 });
    const z = zeilen.find(x => x.zweck === 'test-protokoll');
    expect(z).toMatchObject({ lauf: 'gespraech', person: 'lena', kategorien: ['crm'], anzahl: 1, ergebnis: 'ok' });
    // Auch die gesperrten Aufrufe von oben stehen drin — mit Grund, ohne Inhalt.
    expect(zeilen.some(x => x.ergebnis === 'gesperrt' && x.grund === 'einwilligung-gesundheit')).toBe(true);
    const roh = readdirSync(ordner).filter(f => f.startsWith('ki-protokoll--') && f.endsWith('.json')).map(f => db.rohOeffnen(readFileSync(path.join(ordner, f), 'utf8'), f.replace(/\.json$/, '')).text).join('\n');
    for (const geheim of ['GEHEIM', 'Anna', 'Beispiel', 'MARKER', 'Recovery 37']) expect(roh).not.toContain(geheim);
  });
  it('was wie Inhalt aussieht, fällt beim Säubern weg', async () => {
    const { eintragSaeubern } = await import('@/lib/datenschutz/ki-protokoll');
    const z = eintragSaeubern({ zweck: 'Bitte schreib Anna Beispiel eine Mail', lauf: 'aufruf', person: 'lena', kategorien: ['crm', 'quatsch' as never], modell: 'claude-x', ergebnis: 'ok' });
    expect(z.zweck).toBe('unbenannt');
    expect(z.kategorien).toEqual(['crm']);
  });
  it('Art. 15: Empfänger und Kategorien aus dem Protokoll', async () => {
    const { empfaengerAuskunft, kiProtokollLesen } = await import('@/lib/datenschutz/ki-protokoll');
    const a = empfaengerAuskunft(await kiProtokollLesen({ person: 'lena', monate: 12 }));
    expect(a.empfaenger).toMatch(/Anthropic/);
    expect(a.kategorien.find(k => k.kategorie === 'crm')?.aufrufe).toBeGreaterThan(0);
  });
});

describe('Telegram-Text enthält keine Gesundheits-/CRM-Inhalte', () => {
  it('Gesundheits-Takt ohne Ausnahme: nur ein neutraler Hinweis mit Link — für jeden Slot', async () => {
    await db.saveJson('vitals--jonas', { [HEUTE]: { rec: 22, sleep: 5.1 } });
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    const { telegramInhalteFinden } = await import('@/lib/datenschutz/telegram-text');
    for (const slot of ['morgen', 'mittag', 'abend', 'woche'] as const) {
      const t = await nachrichtFuer('jonas', slot, 'http://test');
      expect(telegramInhalteFinden(t)).toEqual([]);
      expect(t).not.toMatch(/22|5\.1|Haut|Schub|Verlangen|gegessen/);
      expect(t).toMatch(/MAKE OS/);
    }
  });
  it('mit ausdrücklicher Ausnahme wie früher — und das Sicherheitsnetz fängt vergessene Absender', async () => {
    const { telegramSicher } = await import('@/lib/telegram');
    expect(await telegramSicher('jonas', 'Recovery 22 %, Schlaf 5 h.')).toMatch(/^Neue Nachricht in MAKE OS/);
    expect(await telegramSicher('jonas', 'Rechnung über 1.200 € offen')).toMatch(/^Neue Nachricht in MAKE OS/);
    expect(await telegramSicher('jonas', 'Eine Vertragsfrist naht — Details in MAKE OS')).toBe('Eine Vertragsfrist naht — Details in MAKE OS');
    await ke.aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), jonas: { ...(d.personen?.jonas ?? {}), telegramVoll: { seit: new Date().toISOString(), fassung: 'telegram-voll-2026-10-05' } } } }));
    expect(await telegramSicher('jonas', 'Recovery 22 %')).toBe('Recovery 22 %');
    const { nachrichtFuer } = await import('@/lib/gesundheit/lauf');
    expect(await nachrichtFuer('jonas', 'mittag', 'http://test')).toMatch(/gegessen/);
  });
  it('der Satz für fremde Chats nennt keine Personen', async () => {
    const { TELEGRAM_FREMD } = await import('@/lib/datenschutz/telegram-text');
    expect(TELEGRAM_FREMD).not.toMatch(/Kevin|Malin/);
    const quelle = readFileSync(path.resolve(__dirname, '../app/api/telegram/eingang/route.ts'), 'utf8');
    expect(quelle).not.toMatch(/gehört Kevin und Malin/);
  });
});

describe('Jeder Modell-Aufruf sagt, was er schickt', () => {
  it('askText/askJson/askWithSearch tragen überall ein `ki` (Lauf, Person, Kategorien)', () => {
    const fehlt: string[] = [];
    const lauf = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') lauf(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || p.endsWith(path.join('lib', 'anthropic.ts'))) continue;
        const s = readFileSync(p, 'utf8');
        for (const m of s.matchAll(/\b(askText|askJson|askWithSearch)\s*(<[^()]*?>)?\s*\(/g)) {
          let i = (m.index ?? 0) + m[0].length, tiefe = 1;
          while (tiefe && i < s.length) { if (s[i] === '(') tiefe++; else if (s[i] === ')') tiefe--; i++; }
          const rumpf = s.slice((m.index ?? 0) + m[0].length, i);
          if (!/\bki\s*[:,}]|\bki\b\s*\)/.test(rumpf)) fehlt.push(`${path.relative(path.resolve(__dirname, '..'), p)}:${s.slice(0, m.index).split('\n').length}`);
        }
      }
    };
    for (const o of ['app', 'lib']) lauf(path.resolve(__dirname, '..', o));
    // Kommentare zählen nicht (aufgaben-lauf erwähnt askText im Kopf).
    expect(fehlt.filter(f => !f.startsWith(path.join('lib', 'zoe', 'aufgaben-lauf.ts') + ':11'))).toEqual([]);
  });
});
