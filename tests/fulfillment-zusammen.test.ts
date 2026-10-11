// ─── Fulfillment — zusammen (C1 + C2 + C3, 11.10.) — Wächter für die Nähte zwischen den Paketen ─────────────────────────────────────────────
// 1. Keine Schleife über die Paketgrenzen: jede exportierte Funktion der drei Schnittstellen-Module (prozesse/kunde/analyse server.ts) ist
//    umhüllt — ruft eine Kette dieselbe Funktion noch einmal auf (vor dem 11.10.: fallLesen → fallUmfeld → kundeKurzFuer → fallLesen …, ein
//    Speicherfehler), steht der Weg in `W.verstoesse`. Dazu statisch: Kurzfassungen (kundeKurzFuer, dossierKurzFuer) lesen nur rohe Bestände.
// 2. EINE Regel für Kunden-Wege (`fuerKundenFrei`/`kundenGesperrt`): „nur intern“, ungeprüft „vor Verkauf“ bzw. „rechtlich prüfen“ erscheinen nie
//    in Kunden-Sicht, Report, Wirkungsbericht — weder als Formular noch als Schritt; mit Vermerk schon (nur intern nie).
// 3. Kunden-Link-Schalter: EIN Schreibweg (C2), die Willkommen-Karte liest die Antwort von `link-anlegen` über `linkAdresseAus`.
// 4. Playbook im Fall (beide Container-Formen), Antworten → Onboarding-Schritt erfüllt; A2/AP entsperrt mit den C2-Schnittstellen.
// 5. C3 → C1: Quick Wins und Kick-off-Fragen von Ende zu Ende über die Fall-Route.
// 6. Wirkungsbericht-PDF steht im Fall — die Fristen von C2 löschen es nicht; wirklich Verwaistes schon.
// 7. Live-Daten: ein Mandat im Altformat (Ziele als Text) verliert nach Lesen, Fall und Schreiben nichts.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, utimesSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const W = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const als = new AsyncLocalStorage<readonly string[]>();
  const verstoesse: string[] = [];
  const huelle = (modul: string, name: string, f: (...a: unknown[]) => unknown) => (...a: unknown[]) => {
    const kette = als.getStore() ?? [];
    const schluessel = `${modul}.${name}`;
    if (kette.includes(schluessel)) {
      verstoesse.push([...kette, schluessel].join(' → '));
      throw new Error(`Schleife über die Paketgrenzen: ${schluessel}`);
    }
    return als.run([...kette, schluessel], () => f(...a));
  };
  const umhuellen = (modul: string, m: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'function' && /^[a-z]/.test(k) ? huelle(modul, k, v as (...a: unknown[]) => unknown) : v]));
  return { verstoesse, umhuellen };
});
vi.mock('@/lib/fulfillment/prozesse/server', async o => W.umhuellen('prozesse', await o() as Record<string, unknown>));
vi.mock('@/lib/fulfillment/kunde/server', async o => W.umhuellen('kunde', await o() as Record<string, unknown>));
vi.mock('@/lib/fulfillment/analyse/server', async o => W.umhuellen('analyse', await o() as Record<string, unknown>));

const WURZEL = path.resolve(__dirname, '..');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-zusammen-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-fulfillment-zusammen', MAKE_OS_KUNDENLINK: 'an', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY', 'MAKE_OS_ADRESSE']) delete process.env[k];

import { localDay } from '@/lib/zeit';
import { fuerKundenFrei, kundenGesperrt } from '@/lib/fulfillment/prozesse/bausteine';
import { kundenSicht, kundeHinweis } from '@/lib/fulfillment/kunde/sicht';
import { reportZusatz } from '@/lib/fulfillment/kunde/report-zusatz';
import { wirkungsDokument } from '@/lib/fulfillment/prozesse/wirkung';
import { linkAdresseAus } from '@/lib/fulfillment/kunde/link';
import { leerKunde } from '@/lib/fulfillment/lesen';
import { ebeneVon } from '@/lib/fulfillment/regeln';
import { mandatZieleLesen } from '@/lib/crm/mandat-ziele';
import type { Baustein, Fall, FallKnoten } from '@/lib/fulfillment/typen';

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const j = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {};
  return { status: r.status, j };
}

const J = '2026-10-01T08:00:00.000Z';
const heute = localDay();
const mandat = (id: string, x: Record<string, unknown> = {}) => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', leistungId: 'l-probe', gesellschaft: 'ug', status: 'aktiv',
  vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [{ id: 'z-probe', text: 'Mehr Termine' }], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J, ...x,
});
const ALT_ZIELE = ['Mehr Termine je Monat', 'Planung über zwölf Monate'];

let paketP1 = '', paketP2 = '';
beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  // Roh gespeichert (am Säuberer vorbei) — so liegt ein Altbestand auf der Platte: m-alt trägt seine Ziele als Text.
  await db.saveJson('crm', {
    ...leererBestand(),
    leistungen: [{ id: 'l-probe', name: 'Probe-Paket', typ: 'retainer', status: 'aktiv', lieferumfang: [], geaendert: J }],
    mandate: [mandat('m-biz'), mandat('m-zwei'), mandat('m-alt', { ziele: ALT_ZIELE }), mandat('m-alt2', { ziele: [...ALT_ZIELE] })],
  });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
}, 60_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const starten = async (mandatId: string, vorlageId: string) =>
  rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId, vorlageId, anfrageId: `ff-zusammen-${mandatId}` });

// ── 1. Keine Schleife ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rumpf einer Funktion (bis zur ersten Zeile, die nur `}` ist) — grob, reicht für den Wächter. */
function rumpf(datei: string, name: string): string {
  const s = readFileSync(path.join(WURZEL, datei), 'utf8');
  const i = s.search(new RegExp(`export async function ${name}\\(`));
  expect(i, `${name} in ${datei}`).toBeGreaterThanOrEqual(0);
  return s.slice(i, s.indexOf('\n}\n', i));
}

describe('1 · keine Schleife über die Paketgrenzen', () => {
  it('Kurzfassungen lesen nur rohe Bestände (statisch)', () => {
    const verboten = /\b(fallLesen|fallVon|faelleKurz|fallUmfeld|cockpitDaten|ffKennzahlenFuerIndex|kundeStand|reportZusatzFuer|ladeRoh)\b|prozesse\/server|analyse\/server|kunde\/server/;
    for (const [datei, name] of [['lib/fulfillment/kunde/server.ts', 'kundeKurzFuer'], ['lib/fulfillment/analyse/server.ts', 'dossierKurzFuer']] as const) {
      expect(rumpf(datei, name).replace(/^\s*\/\/.*$/gm, ''), name).not.toMatch(verboten);
    }
  });

  it('Lesen, Cockpit, Index, Report, Kunde, Analyse — ohne und mit Fall: kein Weg ruft sich selbst wieder auf', async () => {
    const lesen = async (mit: string[]) => {
      expect((await rufe('fulfillment', 'GET', sitzung('pia'))).status).toBe(200);
      for (const m of mit) {
        expect((await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, `?m=${m}`)).status, m).toBe(200);
        expect((await rufe('fulfillment/kunde', 'GET', sitzung('pia'), undefined, `?m=${m}`)).status, m).toBe(200);
        expect((await rufe('fulfillment/dossier', 'GET', sitzung('olaf'), undefined, `?m=${m}`)).status, m).toBeLessThan(500);
      }
      expect((await rufe('fulfillment/cockpit', 'GET', sitzung('pia'))).status).toBe(200);
      const p = await import('@/lib/fulfillment/prozesse/server');
      await p.ffKennzahlenFuerIndex(heute); await p.faelleKurz(); for (const m of mit) await p.fallLesen(m);
      const k = await import('@/lib/fulfillment/kunde/server');
      await k.kundeKurzFuer(mit); for (const m of mit) { await k.reportZusatzFuer(m, heute); await k.formularAntwortenFuer(m); await k.unterlagenFuer(m); }
      await (await import('@/lib/fulfillment/analyse/server')).dossierKurzFuer(mit);
      await (await import('@/lib/business/speicher')).ladeRoh(heute);
    };
    await lesen(['m-biz', 'm-zwei']);
    expect((await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'aus-muster' }] })).status).toBe(200);
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    const pakete = (ue.j.prozesse as { id: string; art: string; titel: string }[]).filter(p => p.art === 'paket');
    paketP1 = pakete.find(p => p.titel === 'Vertriebsleitung auf Zeit')!.id;
    paketP2 = pakete.find(p => p.titel === 'Sales-Systematik')!.id;
    expect((await starten('m-biz', paketP1)).status).toBe(200);
    expect((await starten('m-zwei', paketP2)).status).toBe(200);
    await lesen(['m-biz', 'm-zwei']);
    expect(W.verstoesse).toEqual([]);
  }, 60_000);
});

// ── 2. EINE Regel für Kunden-Wege ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('2 · EINE Regel für Kunden-Wege (fuerKundenFrei)', () => {
  const B = (id: string, x: Partial<Baustein> = {}): Baustein => ({
    id, art: 'formular', titel: `FORM-${id}`, gliederung: [], platzhalter: [], tags: [], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true, fassung: 1, geaendert: '', geaendertVon: '',
    fragen: [{ id: 'q1', abschnitt: 'A', frage: `Frage ${id}?`, art: 'text' }], ...x,
  });
  const bausteine = [
    B('fb-intern', { tags: ['nur-intern'] }), B('fb-kauf', { tags: ['pruefen-vor-verkauf'] }), B('fb-fremd', { urheberPruefen: { seit: '2026-10-01', grund: 'Material Dritter' } }),
    B('fb-recht', { rechtPruefen: { seit: '2026-10-01', grund: 'UWG' } }), B('fb-ok'),
  ];
  const kn = (id: string, eltern: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, elternId: eltern, titel: `TITEL-${id}`, rang, status: 'offen', kundeSichtbar: true, ...x });
  const gestern = new Date(Date.now() - 86_400_000).toISOString();
  const fall: Fall = {
    mandatId: 'm-x', vorlageId: 'fp-x', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft',
    knoten: [
      { id: 'w', titel: 'Wurzel', rang: 1, status: 'offen' }, kn('p', 'w', 1), kn('t', 'p', 1), kn('s', 't', 1),
      kn('fb-intern', 's', 1, { bausteinId: 'fb-intern', status: 'erledigt', erledigtAm: gestern }),
      kn('fb-kauf', 's', 2, { bausteinId: 'fb-kauf', status: 'wartet_kunde', seit: '2026-10-05' }),
      kn('fb-fremd', 's', 3, { bausteinId: 'fb-fremd', status: 'erledigt', erledigtAm: gestern }),
      kn('fb-recht', 's', 4, { bausteinId: 'fb-recht' }), kn('fb-ok', 's', 5, { bausteinId: 'fb-ok', status: 'erledigt', erledigtAm: gestern }),
    ],
    freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia',
  };
  const m = { id: 'm-x', titel: 'Mandat X', kunde: 'Probe X GmbH', ziele: [], start: '2026-09-01' };
  const alleWege = (marken: Record<string, string>, bs = bausteine) => {
    const sicht = kundenSicht({
      modus: 'voll', heute, mandat: m, fall, bausteine: bs, marken, rituale: [], kunde: leerKunde(), rechte: { formular: true, upload: false, puls: false },
      standVon: () => 's', datenschutz: kundeHinweis({ verantwortlich: 'Erfundene Firma, Musterweg 1, 12345 Musterstadt', seite: null, mandatsdatenMonate: 12, unterlagenTage: 90 }), uploadFrei: 0,
    });
    const report = reportZusatz(fall, m, leerKunde(), heute, false, kundenGesperrt(bs, { marken }));
    const wirkung = wirkungsDokument({ fall, mandat: m, heute, bausteine: bs, marken });
    return JSON.stringify({ sicht, report, wirkung });
  };

  it('ohne Vermerk: nur „ok“ erscheint — als Formular, Schritt, „wartet“ und Lieferobjekt', () => {
    const text = alleWege({});
    expect(text).toContain('FORM-fb-ok');
    expect(text).toContain('TITEL-fb-ok');
    for (const id of ['fb-intern', 'fb-kauf', 'fb-fremd', 'fb-recht']) {
      expect(text, id).not.toContain(`FORM-${id}`);
      expect(text, id).not.toContain(`TITEL-${id}`);
    }
  });

  it('mit Vermerk („vor Verkauf geprüft“, „rechtlich geprüft“) erscheinen sie — „nur intern“ nie', () => {
    const marken = { 'urheber-geprueft:fb-kauf': '2026-10-09|pia', 'urheber-geprueft:fb-fremd': '2026-10-09|pia', 'urheber-geprueft:fb-intern': '2026-10-09|pia' };
    const bs = bausteine.map(b => (b.id === 'fb-recht' ? { ...b, rechtGeprueft: { am: '2026-10-09', von: 'pia', notiz: 'ok' } } : b));
    const text = alleWege(marken, bs);
    for (const id of ['fb-kauf', 'fb-fremd', 'fb-recht', 'fb-ok']) expect(text, id).toContain(`TITEL-${id}`);
    expect(text).not.toContain('FORM-fb-intern');
    expect(text).not.toContain('TITEL-fb-intern');
    expect(fuerKundenFrei(bausteine[0], { marken })).toMatchObject({ frei: false });
  });

  it('kein Kunden-Weg liest die Marken selbst (nur über bausteine.ts)', () => {
    const dateien = [...readdirSync(path.join(WURZEL, 'lib/fulfillment/kunde')).map(n => `lib/fulfillment/kunde/${n}`), 'lib/fulfillment/prozesse/wirkung.ts', 'lib/fulfillment/prozesse/wirkung-pdf.ts']
      .filter(f => existsSync(path.join(WURZEL, f)) && f.endsWith('.ts'));
    for (const f of dateien) {
      const s = readFileSync(path.join(WURZEL, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
      expect(s, f).not.toMatch(/nur_intern|pruefen_vor_verkauf|vorVerkaufGeprueft|TAG_NUR_INTERN|TAG_VOR_VERKAUF|\bnurIntern\(|urheberGeprueft\(/);
    }
  });
});

// ── 3. Kunden-Link-Schalter und Willkommen ────────────────────────────────────────────────────────────────────────────────────────────

describe('3 · Kunden-Link: EIN Schalter, die Willkommen-Karte liest die echte Antwort', () => {
  it('Schalter nur über C2 (Inhaber); link-anlegen → linkAdresseAus', async () => {
    expect((await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'einstellungen', felder: { kundenLink: { an: true } } }] })).status).toBe(400);
    expect((await rufe('fulfillment/kunde', 'POST', sitzung('olaf'), { aktion: 'schalter', an: true })).status).toBe(403);
    expect((await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'schalter', an: true })).status).toBe(200);
    const a = await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'link-anlegen', mandatId: 'm-biz' });
    expect(a.status).toBe(200);
    const url = linkAdresseAus(a.j, 'https://instanz.example');
    expect(url).toMatch(/^https:\/\/instanz\.example\/kunde\/kl-[a-f0-9]{24}#t=[A-Za-z0-9_-]+$/);
    process.env.MAKE_OS_ADRESSE = 'https://app.example';
    try {
      const b = await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'link-anlegen', mandatId: 'm-biz' });
      expect(linkAdresseAus(b.j, 'https://anders.example')).toMatch(/^https:\/\/app\.example\/kunde\/kl-/);
    } finally { delete process.env.MAKE_OS_ADRESSE; }
    expect(linkAdresseAus({ pfad: 'javascript:alert(1)' }, 'https://x.example')).toBeNull();
    expect(linkAdresseAus({ url: 'https://boese.example/anders' }, 'https://x.example')).toBeNull();
    // Rückweg in den ausgelieferten Zustand: Schalter wieder aus.
    expect((await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'schalter', an: false })).status).toBe(200);
  });
});

// ── 4. Playbook im Fall, A2/AP ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('4 · Playbook-Formular im Fall; Antworten und Registerauszug entsperren AP und A2', () => {
  it('beide Container-Formen: Schritte auf Ebene 4, das Formular auf Ebene 5', async () => {
    for (const m of ['m-biz', 'm-zwei']) {
      const f = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, `?m=${m}`);
      const knoten = (f.j.fall as Fall).knoten;
      const pb = knoten.find(k => k.id === 'fk-ob-playbook')!;
      const form = knoten.find(k => k.id === 'fk-obf-playbook');
      expect(ebeneVon(pb, knoten), m).toBe(4);
      expect(form?.bausteinId, m).toBeTruthy();
      expect(ebeneVon(form!, knoten), m).toBe(5);
    }
  });

  it('Antworten → Onboarding-Schritt „Kunden-Playbook“ erfüllt; laufDaten sieht Playbook und Register', async () => {
    const st = await rufe('fulfillment/kunde', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    const f = (st.j.formulare as { bausteinId: string; titel: string; stand: string; abschnitte: { schluessel: string; fragen: { id: string }[] }[] }[])[0];
    expect(f.titel).toBe('Kunden-Playbook');
    let stand = f.stand;
    for (const a of f.abschnitte) {
      const r = await rufe('fulfillment/kunde', 'POST', sitzung('olaf'), { aktion: 'formular-intern', mandatId: 'm-biz', bausteinId: f.bausteinId, antworten: Object.fromEntries(a.fragen.map(q => [q.id, 'Erfundene Antwort.'])), stand, abschnitt: a.schluessel, fertig: true });
      expect(r.status, a.schluessel).toBe(200);
      stand = String(r.j.stand);
    }
    const fall = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    expect((fall.j.onboarding as { schritte: { schluessel: string; erfuellt: boolean }[] }).schritte.find(s => s.schluessel === 'playbook')!.erfuellt).toBe(true);

    // Registerauszug intern ablegen (multipart, Typ am Inhalt), freigeben — erst dann sieht ihn die Analyse.
    const form = new FormData();
    form.set('mandatId', 'm-biz'); form.set('zweck', 'register');
    form.set('datei', new File([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')], 'auszug.pdf', { type: 'application/pdf' }));
    const { POST } = await import('@/app/api/fulfillment/kunde/datei/route');
    const up = await POST(new Request('http://test/api/fulfillment/kunde/datei', { method: 'POST', headers: { 'x-make-user': 'pia' }, body: form }));
    const upj = await up.json() as { unterlage?: { id: string } };
    expect(up.status).toBe(200);
    const { laufDaten } = await import('@/lib/fulfillment/analyse/lauf');
    expect(await laufDaten('m-biz')).toMatchObject({ playbook: true, register: false });
    const id = upj.unterlage!.id;
    expect((await rufe('fulfillment/kunde', 'POST', sitzung('pia'), { aktion: 'unterlage-status', id, status: 'freigegeben' })).status).toBe(200);
    const daten = await laufDaten('m-biz');
    expect(daten).toMatchObject({ playbook: true, register: true, unterlagen: [id] });
    const { sperrGruende } = await import('@/lib/fulfillment/analyse/agenten');
    const d = { eingaben: { firma: 'Probe', domains: [] }, laeufe: [], abschnitte: {}, quellen: [] } as unknown as Parameters<typeof sperrGruende>[0];
    expect(sperrGruende(d, 'ap', { ...daten, jetztMs: Date.now() })).toEqual([]);
    expect(sperrGruende(d, 'a2', { ...daten, jetztMs: Date.now() }).join(' ')).not.toMatch(/Registerauszug/);
  }, 60_000);
});

// ── 5. C3 → C1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('5 · Quick Wins und Kick-off-Fragen aus der Analyse in den Fall', () => {
  it('nach-fall liefert die Form der Fall-Route — PATCH nimmt sie an', async () => {
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-biz' })).status).toBe(200);
    const sp = await import('@/lib/fulfillment/speicher');
    await sp.fulfillmentAendern('dossiers', d => ({ ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-biz': { ...d.dossiers['m-biz'], f2: { am: '2026-10-10', von: 'pia' }, diagnose: {
      top5: [], quickWins: ['Nachfass-Liste der offenen Angebote', 'Wochen-Zahlen auf einer Seite'], fragen: [{ frage: 'Wer entscheidet über das Budget?', an: 'entscheider', warum: 'Für die Planung.' }],
    } } } }, geaendert: ['m-biz'] }));
    for (const was of ['quickwins', 'fragen'] as const) {
      const n = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'nach-fall', mandatId: 'm-biz', was });
      expect(n.status, was).toBe(200);
      expect(n.j.ziel).toBe('/api/fulfillment/fall');
      const p = await rufe('fulfillment/fall', String(n.j.methode), sitzung('pia'), n.j.body);
      expect(p.status, `${was}: ${String(p.j.fehler ?? '')}`).toBe(200);
    }
    const f = (await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz')).j.fall as Fall;
    expect(f.quickWins.filter(q => q.quelle === 'analyse').map(q => q.text)).toEqual(['Nachfass-Liste der offenen Angebote', 'Wochen-Zahlen auf einer Seite']);
    expect(f.kickoffFragen.filter(q => q.quelle === 'analyse').map(q => q.frage)).toEqual(['Wer entscheidet über das Budget?']);
  }, 60_000);
});

// ── 6. Wirkungsbericht und Fristen ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('6 · Wirkungsbericht-PDF steht im Fall — die Fristen von C2 lassen es liegen', () => {
  it('erstellt, gealtert, Fristenlauf: Bericht bleibt, Verwaistes geht', async () => {
    const w = await rufe('fulfillment/wirkung', 'POST', sitzung('pia'), { aktion: 'erstellen', mandatId: 'm-biz' });
    expect(w.status).toBe(200);
    const name = String(w.j.dateiName);
    // Ablage-Name nach `BILD_NAME` (vorher `….pdf` — von der Ablage abgelehnt), kein Kundenname auf der Platte.
    expect(name).toMatch(/^wirkung-[a-f0-9]{16}-\d{4}-\d{2}-\d{2}\.bin$/);
    const fall = (await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz')).j.fall as Fall;
    expect(fall.wirkung?.dateiName).toBe(name);
    const { GET } = await import('@/app/api/fulfillment/wirkung/route');
    const pdf = await GET(new Request('http://test/api/fulfillment/wirkung?m=m-biz', { headers: { 'x-make-user': 'pia' } }));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toMatch(/filename="Wirkungsbericht-\d{4}-\d{2}-\d{2}\.pdf"/);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const ort = path.join(ordner, 'fulfillment-unterlagen');
    expect(existsSync(path.join(ort, name))).toBe(true);
    mkdirSync(ort, { recursive: true });
    writeFileSync(path.join(ort, 'ud-verwaist-probe.bin'), 'x');
    writeFileSync(path.join(ort, 'Fremd.txt'), 'x');
    const alt = new Date(Date.now() - 3 * 86_400_000);
    for (const n of [name, 'ud-verwaist-probe.bin', 'Fremd.txt']) utimesSync(path.join(ort, n), alt, alt);
    const { kundeFristen } = await import('@/lib/fulfillment/kunde/server');
    const z = await kundeFristen({ heute, jetzt: new Date(), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } });
    expect(existsSync(path.join(ort, name))).toBe(true);
    expect(existsSync(path.join(ort, 'ud-verwaist-probe.bin'))).toBe(false);
    expect(existsSync(path.join(ort, 'Fremd.txt'))).toBe(true); // nicht von der Ablage vergeben — bleibt, der Lauf scheitert nicht daran
    expect(z['fulfillment-unterlagen-verwaist']).toBe(1);
  }, 60_000);
});

// ── 7. Live-Daten: Mandat im Altformat ────────────────────────────────────────────────────────────────────────────────────────────────

describe('7 · Mandat im Altformat (Ziele als Text) — nichts geht verloren', () => {
  it('mandatZieleLesen: Objekte wie der Säuberer bis 10.10., Texte erhalten', () => {
    // Der Ausdruck des Säuberers bis 10.10. (wörtlich, nur für Objekte) — für Objekte muss das Ergebnis gleich bleiben.
    const txt = (v: unknown, n = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
    const opt = (v: unknown, n = 300) => { const t = txt(v, n); return t || undefined; };
    const alt = (v: Record<string, unknown>[]) => v.slice(0, 500).map((z, i) => ({ id: txt(z.id, 40) || `z${i}`, text: txt(z.text, 300), ...(opt(z.ziel, 80) ? { ziel: opt(z.ziel, 80) } : {}), ...(opt(z.ist, 80) ? { ist: opt(z.ist, 80) } : {}) })).filter(z => z.text);
    const objekte = [{ id: 'z-1', text: ' Termine ', ziel: '12', ist: '' }, { text: 'ohne Kennung' }, { id: 'x', text: '' }, { id: 'y'.repeat(60), text: 'lang', ist: '4 Termine' }];
    expect(mandatZieleLesen(objekte)).toEqual(alt(objekte));
    expect(mandatZieleLesen(ALT_ZIELE)).toEqual([{ id: 'z0', text: ALT_ZIELE[0] }, { id: 'z1', text: ALT_ZIELE[1] }]);
    expect(mandatZieleLesen([{ id: 'z1', text: 'A' }, 'B', null, 7])).toEqual([{ id: 'z1', text: 'A' }, { id: 'z1-t', text: 'B' }]);
    expect(mandatZieleLesen(undefined)).toEqual([]);
  });

  it('Lesen ohne Fall ändert nichts; Fall + Wert-Konto + Nachzug: beide Ziele bleiben am Mandat', async () => {
    const db = await import('@/lib/store/local-db');
    const roh = () => db.loadJson('crm') as Promise<{ mandate: { id: string; ziele: unknown[] }[] }>;
    const vorher = JSON.stringify((await roh()).mandate.find(m => m.id === 'm-alt'));
    const g = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-alt');
    expect((g.j.mandat as { ziele: unknown }).ziele).toEqual([{ id: 'z0', text: ALT_ZIELE[0] }, { id: 'z1', text: ALT_ZIELE[1] }]);
    expect(JSON.stringify((await roh()).mandate.find(m => m.id === 'm-alt'))).toBe(vorher);

    expect((await starten('m-alt', paketP1)).status).toBe(200);
    const p = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-alt', ops: [
      { op: 'wert-ziel', zielId: 'z0', felder: { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine', zielBis: '2026-12-31', richtung: 'hoch', festlegen: true } },
      { op: 'wert-messung', zielId: 'z0', wert: 7, am: heute },
    ] });
    expect(p.status, String(p.j.fehler ?? '')).toBe(200);
    const nachher = (await roh()).mandate.find(m => m.id === 'm-alt')!.ziele as { id: string; text: string; ist?: string }[];
    expect(nachher.map(z => z.text)).toEqual(ALT_ZIELE);
    expect(nachher.map(z => z.id)).toEqual(['z0', 'z1']);
    expect(nachher[0].ist).toMatch(/^7/);
    const wk = (await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-alt')).j.wertKonto as { name: string; jetzt: string }[];
    expect(wk.map(z => z.name)).toEqual(ALT_ZIELE);
  }, 60_000);

  it('jede Teil-Änderung am Mandat (CRM-Schreibweg) erhält die Text-Ziele', async () => {
    const { aendereCrm, wendeCrmAn } = await import('@/lib/crm/speicher');
    await aendereCrm(b => wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-alt2', felder: { notiz: 'Probe-Notiz' } }], new Date().toISOString(), 'pia').bestand, { art: 'person', person: 'pia' });
    const db = await import('@/lib/store/local-db');
    const m = ((await db.loadJson('crm')) as { mandate: { id: string; ziele: { id: string; text: string }[]; notiz?: string }[] }).mandate.find(x => x.id === 'm-alt2')!;
    expect(m.notiz).toBe('Probe-Notiz');
    expect(m.ziele).toEqual([{ id: 'z0', text: ALT_ZIELE[0] }, { id: 'z1', text: ALT_ZIELE[1] }]);
  });
});

// ── 8. Wünsche aus dem Konzept: Kreis-Form, Rhythmus täglich/werktags ─────────────────────────────────────────────────────────────────

describe('8 · Ablauf als Kreis (Sales Circle); Rituale täglich/werktags', () => {
  it('Kreis: Stufen im Uhrzeigersinn ab 12 Uhr, Bögen auf dem Kreis, Ergänzung auf dem gestrichelten Außenring; deterministisch', async () => {
    const { ablaufLage, ablaufListe } = await import('@/lib/fulfillment/prozesse/ablauf-bild');
    const { formAus } = await import('@/lib/fulfillment/prozesse/import');
    expect(formAus('Kreis im Uhrzeigersinn')).toBe('kreis');
    expect(formAus('Sales Circle')).toBe('kreis');
    expect(formAus('drei Spalten mit Weichen')).toBe('fluss');
    const k = (id: string, rang: number, x: Record<string, unknown> = {}) => ({ id, elternId: 'w', titel: `Stufe ${id}`, rang, ...x });
    const v = {
      form: 'kreis' as const,
      knoten: [{ id: 'w', titel: 'Kreis', rang: 1 }, k('a', 1, { art: 'einstieg' }), k('b', 2), k('c', 3), k('d', 4), k('e', 5, { beleg: 'ergaenzung' }), k('x', 6, { art: 'ausstieg' })],
      uebergaenge: [
        { von: 'a', nach: 'b', art: 'weiter' as const }, { von: 'b', nach: 'c', art: 'weiter' as const }, { von: 'c', nach: 'd', art: 'weiter' as const },
        { von: 'd', nach: 'a', art: 'kreislauf' as const }, { von: 'c', nach: 'b', art: 'rueckweg' as const, weiche: 'Einwand' },
        { von: 'd', nach: 'e', art: 'weiter' as const, beleg: 'ergaenzung' as const }, { von: 'e', nach: 'a', art: 'weiter' as const, beleg: 'ergaenzung' as const },
        { von: 'b', nach: 'x', art: 'ausstieg' as const },
      ],
    } as unknown as Parameters<typeof ablaufLage>[0];
    const l = ablaufLage(v, 900);
    expect(ablaufLage(v, 900)).toEqual(l);
    expect(l.form).toBe('kreis');
    const ringe = l.ringe ?? [];
    expect(ringe).toHaveLength(2);
    expect(ringe[1]).toMatchObject({ gestrichelt: true, titel: 'Empfehlungen' });
    const mitte = (id: string) => { const s = l.stufen.find(x => x.id === id)!; return { x: s.x + s.b / 2, y: s.y + s.h / 2 }; };
    const { cx, cy, r } = ringe[0];
    // a oben (12 Uhr), b rechts, c unten, d links — im Uhrzeigersinn
    expect(Math.abs(mitte('a').x - cx)).toBeLessThan(1);
    expect(mitte('a').y).toBeLessThan(cy);
    expect(mitte('b').x).toBeGreaterThan(cx);
    expect(mitte('c').y).toBeGreaterThan(cy);
    expect(mitte('d').x).toBeLessThan(cx);
    for (const id of ['a', 'b', 'c', 'd']) expect(Math.abs(Math.hypot(mitte(id).x - cx, mitte(id).y - cy) - r)).toBeLessThan(1);
    expect(Math.abs(Math.hypot(mitte('e').x - cx, mitte('e').y - cy) - ringe[1].r)).toBeLessThan(1);
    expect(l.stufen.find(s => s.id === 'e')!.gestrichelt).toBe(true);
    const kante = (von: string, nach: string) => l.kanten.find(x => x.von === von && x.nach === nach)!;
    expect(kante('a', 'b').pfad).toMatch(/ A [\d.]+ [\d.]+ 0 [01] 1 /);
    expect(kante('d', 'a').pfad).toMatch(/ A /);
    expect(kante('c', 'b').pfad).toMatch(/ Q /);
    expect(kante('d', 'e').gestrichelt).toBe(true);
    expect(kante('b', 'x').gestrichelt).toBe(true);
    expect(l.hoehe).toBeGreaterThan(2 * ringe[1].r);
    expect(ablaufListe(v).map(s => s.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'x']);
  });

  it('Rhythmus täglich/werktags: Säuberer behält ihn, Vorlagen-Op nimmt ihn an, Text dazu', async () => {
    const { vorlagenAus, leerVorlagen } = await import('@/lib/fulfillment/lesen');
    const { vorlagenAnwenden } = await import('@/lib/fulfillment/prozesse/vorlagen-anwenden');
    const { RHYTHMUS_TEXT } = await import('@/lib/fulfillment/prozesse/rituale');
    let n = 0;
    const r = vorlagenAnwenden(leerVorlagen(), [
      { op: 'ritual', eintrag: { titel: 'Huddle', rhythmus: 'werktags', dauerMin: 15, agenda: ['Zahlen von gestern'] } },
      { op: 'ritual', eintrag: { titel: 'Tagesblick', rhythmus: 'taeglich', dauerMin: 10 } },
    ], { person: 'pia', jetzt: J, heute: '2026-10-11', standVon: () => 's', neueId: p => `${p}-${++n}` });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(vorlagenAus(JSON.parse(JSON.stringify(r.datei))).rituale.map(x => x.rhythmus)).toEqual(['werktags', 'taeglich']);
    expect([RHYTHMUS_TEXT.werktags, RHYTHMUS_TEXT.taeglich]).toEqual(['werktags (Mo–Fr)', 'täglich']);
  });
});
