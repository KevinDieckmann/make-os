// ─── Wächter: eigener Auftrag an einen Agenten je Person + Gesundheits-Unterlagen (09.10.) ──────────────────────────────────────────
// Auftrag 09.10.: „Ich möchte, dass wir z. B. beim Onboarding im Thema Gesundheit wirklich auch einen Prompt jeweils für den Agenten schreiben
// müssen. Oder eine Datei hochgeladen werden kann.“ Geprüft:
//   1. Regeln rein (Säubern, Kategorie, an die KI ja/nein, Typ am Inhalt, Abschnitte).
//   2. Auftrag: Privat-Heads nur die Person selbst (lesen UND schreiben), Heads des Haushalts schreiben nur volle Mitglieder; „nur Business“ hat keine
//      Privat-Heads; 413 über der Grenze (nie gekürzt), 409 bei altem Stand, Dienstweg 403, Protokoll ohne Inhalt, Konto-Export.
//   3. Prompt (nachgebaute Messages-API, kein Netz): Auftrag im System-Text von Head UND Mitarbeiter, klar gerahmt; der Auftrag eines Heads mit
//      Gesundheitsbezug nur mit Einwilligung (b) — ohne (b) gar nicht im Prompt, mit Hinweis; Speichern nur mit (a).
//   4. Unterlagen: nur die Person selbst (andere 404, Dienstweg 403, ohne Person 401), ohne (a) kein Speichern, Typ am Inhalt (415), verschlüsselt auf
//      der Platte, Text nur an den Gesundheits-Head und nur mit (b) — gekapselt, „Teil x von y“; Business-Heads und ZOE nie.
//   5. Einrichtung: Prüfung `gesundheit-agent` (nur ja/nein). 6. Konto löschen/Export: Unterlagen samt Dateien weg, Liste im Export.
// Erfundene Konten (`@example.invalid`), eigener Datenordner mit Datenschlüssel (Format v2).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agent-auftrag-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agent-auftrag', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel',
    MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault'), MAKE_OS_DATEN_SCHLUESSEL: `test-schluessel-unterlagen-${'u'.repeat(32)}`,
  });
  for (const k of ['ANTHROPIC_MODEL', 'MAKE_OS_KI_ANBIETER_TOR', 'MAKE_OS_KI_BUDGET_MONAT_EURO', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT']) delete process.env[k];
  return o;
});

type KiAufruf = { zweck?: string; system: string; messages?: unknown; ki?: { lauf?: string; person?: string | null; kategorien: string[] }; tools?: { name: string }[] };
const aufrufe = vi.hoisted(() => [] as KiAufruf[]);
vi.mock('@/lib/anthropic', async orig => {
  const o = await orig<typeof import('@/lib/anthropic')>();
  return { ...o, askText: async (opts: Parameters<typeof o.askText>[0]) => { aufrufe.push(opts as unknown as KiAufruf); return o.askText(opts); } };
});

import { kontenSaeen, modellFake, rufe, sitzung, dienst, text, werkzeug, HAUS, type ModellFake } from './fixtures/agenten-kern';
import { auftragAnKi, auftragKategorie, auftragSaeubern, AUFTRAG_MAX } from '@/lib/agenten/auftrag';
import { headDef } from '@/lib/agenten/katalog';
import { abschnitt, unterlageTypErkennen, UNTERLAGEN_ORDNER } from '@/lib/gesundheit/unterlagen';

type H = (r: Request) => Promise<Response>;
let agenten: { GET: H; POST: H };
let faden: { POST: H };
let unterlagen: { GET: H; POST: H; DELETE: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex')]);
const MARKE = {
  privatA: 'AUFTRAG-A-PRIVAT-ASSISTENZ',
  sales: 'AUFTRAG-HAUSHALT-SALES',
  ernaehrung: 'AUFTRAG-ERNAEHRUNG-A',
  gesundheitB: 'AUFTRAG-GESUNDHEIT-B',
  unterlageB: 'UNTERLAGE-B-BEFUNDTEXT',
};

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const z of ['verarbeiten', 'ki'] as const) expect((await gesundheitErklaeren('person-b', z, true, GESUNDHEIT_FASSUNG)).ok).toBe(true);
  agenten = (await import('@/app/api/agenten/route')) as unknown as typeof agenten;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  unterlagen = (await import('@/app/api/gesundheit/unterlagen/route')) as unknown as typeof unterlagen;
  m = modellFake();
});
afterAll(async () => {
  m?.zurueck();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

const einwilligen = async (person: string, zweck: 'verarbeiten' | 'ki', an: boolean) => {
  const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  expect((await gesundheitErklaeren(person, zweck, an, GESUNDHEIT_FASSUNG)).ok).toBe(true);
};
type Karte = { id: string; einstellung?: { stand: string; aendern: boolean; auftrag?: { text: string | null; anKi: boolean; grund?: string; kategorie: string; ebene: string } } };
const karten = async (person: string): Promise<{ status: number; heads: Karte[]; roh: string }> => {
  const r = await rufe(agenten.GET, '/api/agenten', sitzung(person));
  return { status: r.status, heads: (r.d.heads as Karte[] | undefined) ?? [], roh: JSON.stringify(r.d) };
};
const karte = async (person: string, headId: string) => (await karten(person)).heads.find(h => h.id === headId);
const auftragSetzen = async (person: string, headId: string, auftrag: unknown, stand?: string) => {
  const s = stand ?? (await karte(person, headId))?.einstellung?.stand ?? 'es-unbekannt';
  return rufe(agenten.POST, '/api/agenten', sitzung(person), { aktion: 'einstellung', headId, teil: { auftrag }, stand: s });
};
const chat = async (person: string, agent: Record<string, unknown>, ...antworten: ReturnType<typeof text>[]) => {
  aufrufe.length = 0;
  m.antworten.push(...(antworten.length ? antworten : [text('Antwort.')]));
  const r = await rufe(faden.POST, '/api/agenten/faden', sitzung(person), { aktion: 'senden', agent, text: 'Was steht an?' });
  m.antworten.length = 0;
  return r;
};
const hochladen = async (person: string, name: string, inhalt: Buffer | string, kopf: Record<string, string> = { 'x-make-user': person }) => {
  const form = new FormData();
  form.append('datei', new Blob([typeof inhalt === 'string' ? Buffer.from(inhalt) : new Uint8Array(inhalt)]), name);
  const r = await unterlagen.POST(new Request('http://test/api/gesundheit/unterlagen', { method: 'POST', headers: kopf, body: form }));
  return { status: r.status, d: await r.json() as Record<string, unknown> };
};
const liste = async (person: string) => {
  const r = await unterlagen.GET(new Request('http://test/api/gesundheit/unterlagen', { headers: { 'x-make-user': person } }));
  return { status: r.status, d: await r.json() as { unterlagen?: { id: string; name: string }[]; ki?: { an: boolean } } };
};

// ── 1 · Regeln (rein) ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('1 · Regeln', () => {
  it('Säubern: leer = entfernen, Steuerzeichen weg, über der Grenze 413 (nie gekürzt), kein Text 400', () => {
    expect(auftragSaeubern(null)).toEqual({ ok: true, text: null });
    expect(auftragSaeubern('   ')).toEqual({ ok: true, text: null });
    expect(auftragSaeubern(' Hallo\u0007 Welt\r\nZeile 2 ')).toEqual({ ok: true, text: 'Hallo Welt\nZeile 2' });
    expect(auftragSaeubern('x'.repeat(AUFTRAG_MAX))).toMatchObject({ ok: true });
    expect(auftragSaeubern('x'.repeat(AUFTRAG_MAX + 1))).toMatchObject({ ok: false, status: 413 });
    expect(auftragSaeubern(42)).toMatchObject({ ok: false, status: 400 });
  });
  it('Kategorie aus dem Katalog: Gesundheit (auch „nur mit Einwilligung“) → gesundheit, Familie → familie, Finanzen privat, Business → allgemein', () => {
    expect(auftragKategorie(headDef('gesundheit')!)).toBe('gesundheit');
    expect(auftragKategorie(headDef('ernaehrung')!)).toBe('gesundheit');
    expect(auftragKategorie(headDef('familie')!)).toBe('familie');
    expect(auftragKategorie(headDef('finanzen-privat')!)).toBe('finanzen-privat');
    for (const id of ['sales', 'marketing', 'finanzen', 'it', 'assistenz']) expect(auftragKategorie(headDef(id)!), id).toBe('allgemein');
  });
  it('an die KI: nur mit aktiver Kategorie und offenem Weg — sonst mit Grund', () => {
    const g = headDef('gesundheit')!;
    expect(auftragAnKi(g, { aktiv: ['allgemein'], moeglich: true })).toMatchObject({ an: false, kategorie: 'gesundheit' });
    expect(auftragAnKi(g, { aktiv: ['gesundheit'], moeglich: false })).toMatchObject({ an: false });
    expect(auftragAnKi(g, { aktiv: ['gesundheit'], moeglich: true })).toEqual({ an: true, kategorie: 'gesundheit' });
    expect(auftragAnKi(headDef('sales')!, { aktiv: [], moeglich: false })).toEqual({ an: true, kategorie: 'allgemein' });
  });
  it('Unterlagen: Typ am INHALT (Endung muss passen), nur PDF/Bild/Text; Abschnitte zu 30.000 Zeichen', () => {
    expect(unterlageTypErkennen('befund.pdf', Buffer.from('%PDF-1.4 …'))).toBe('application/pdf');
    expect(unterlageTypErkennen('foto.png', PNG)).toBe('image/png');
    expect(unterlageTypErkennen('notiz.txt', Buffer.from('Hallo'))).toBe('text/plain');
    expect(unterlageTypErkennen('falsch.pdf', Buffer.from('nur Text'))).toBeNull();
    expect(unterlageTypErkennen('getarnt.txt', PNG)).toBeNull();
    expect(unterlageTypErkennen('tabelle.xlsx', Buffer.from('PK\u0003\u0004'))).toBeNull();
    expect(unterlageTypErkennen('programm.exe', Buffer.from('MZ'))).toBeNull();
    const t = 'a'.repeat(65_000);
    expect(abschnitt(t, 1)).toMatchObject({ teil: 1, teile: 3 });
    expect(abschnitt(t, 3)!.text.length).toBe(5_000);
    expect(abschnitt(t, 4)).toBeNull();
  });
});

// ── 2 · Auftrag schreiben und lesen ─────────────────────────────────────────────────────────────────────────────────────

describe('2 · Auftrag: wer liest, wer schreibt', () => {
  it('Privat-Head (Ebene Person): nur die Person selbst — die andere sieht ihn nicht, „nur Business“ hat keine Privat-Heads', async () => {
    const r = await auftragSetzen('person-a', 'assistenz', MARKE.privatA);
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const a = await karte('person-a', 'assistenz');
    expect(a?.einstellung?.auftrag).toMatchObject({ text: MARKE.privatA, ebene: 'person', anKi: true, kategorie: 'allgemein' });
    const b = await karten('person-b');
    expect(b.heads.find(h => h.id === 'assistenz')?.einstellung?.auftrag?.text ?? null).toBeNull();
    expect(b.roh).not.toContain(MARKE.privatA);
    // „nur Business“ (Konto-Sicht): keine Privat-Heads — weder in der Liste noch beim Schreiben.
    const c = await karten('team-c');
    expect(c.heads.some(h => h.id === 'assistenz')).toBe(false);
    expect(c.roh).not.toContain(MARKE.privatA);
    expect((await auftragSetzen('team-c', 'assistenz', 'FREMD', 'es-x')).status).toBe(403);
  });

  it('Head des Haushalts: schreiben nur volle Mitglieder, lesen alle, die den Head sehen; fremder Haushalt und Dienstweg 403', async () => {
    const r = await auftragSetzen('person-a', 'sales', MARKE.sales);
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect((await karte('person-b', 'sales'))?.einstellung?.auftrag?.text).toBe(MARKE.sales);
    const c = await karte('team-c', 'sales');
    expect(c?.einstellung?.auftrag?.text).toBe(MARKE.sales);
    expect(c?.einstellung?.aendern).toBe(false);
    expect((await auftragSetzen('team-c', 'sales', 'TEAM-C-AENDERT', c!.einstellung!.stand)).status).toBe(403);
    expect((await auftragSetzen('gast', 'sales', 'GAST', 'es-x')).status).toBe(403);
    const d = await rufe(agenten.POST, '/api/agenten', dienst('person-a'), { aktion: 'einstellung', headId: 'sales', teil: { auftrag: 'DIENST' }, stand: c!.einstellung!.stand });
    expect(d.status).toBe(403);
    expect((await karte('person-a', 'sales'))?.einstellung?.auftrag?.text).toBe(MARKE.sales);
  });

  it('über der Grenze 413 (nichts gespeichert), alter Stand 409; leer entfernt', async () => {
    const vorher = await karte('person-a', 'marketing');
    const zuLang = await auftragSetzen('person-a', 'marketing', 'y'.repeat(AUFTRAG_MAX + 1), vorher!.einstellung!.stand);
    expect(zuLang.status).toBe(413);
    expect((await karte('person-a', 'marketing'))?.einstellung?.auftrag?.text ?? null).toBeNull();
    expect((await auftragSetzen('person-a', 'marketing', 'Erster Auftrag', vorher!.einstellung!.stand)).status).toBe(200);
    expect((await auftragSetzen('person-a', 'marketing', 'Zweiter Auftrag', vorher!.einstellung!.stand)).status).toBe(409);
    expect((await auftragSetzen('person-a', 'marketing', '')).status).toBe(200);
    expect((await karte('person-a', 'marketing'))?.einstellung?.auftrag?.text ?? null).toBeNull();
  });

  it('Protokoll ohne Inhalt: nur Feldname „auftrag“, nie der Text', async () => {
    const namen = readdirSync(ordner).filter(n => n.startsWith(`aenderungsprotokoll--${HAUS}--`)).map(n => n.replace(/\.json$/, ''));
    expect(namen.length).toBeGreaterThan(0);
    const alles = JSON.stringify(await Promise.all(namen.map(n => db.loadJson(n))));
    expect(alles).toContain('auftrag');
    for (const x of Object.values(MARKE)) expect(alles, x).not.toContain(x);
  });

  it('Konto-Export: der eigene Privat-Abschnitt mit Auftrag und der selbst geschriebene Auftrag an einen Head des Haushalts', async () => {
    const { kontoExport } = await import('@/lib/datenschutz/konto-daten');
    const a = JSON.stringify(await kontoExport('person-a'));
    expect(a).toContain(MARKE.privatA);
    expect(a).toContain(MARKE.sales);
    const b = JSON.stringify(await kontoExport('person-b'));
    expect(b).not.toContain(MARKE.privatA);
    expect(b).not.toContain(MARKE.sales);
  });
});

// ── 3 · Prompt ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('3 · Prompt: Auftrag im System-Text, Gesundheit nur mit (b)', () => {
  it('Head des Haushalts: Auftrag im System-Text von Head UND Mitarbeiter — klar gerahmt', async () => {
    expect((await chat('person-b', { art: 'head', headId: 'sales' })).status).toBe(200);
    const h = aufrufe.find(x => x.zweck === 'agent-sales')!;
    expect(h.system).toContain('AUFTRAG DES HAUSHALTS FÜR DIESEN AGENTEN');
    expect(h.system).toContain(MARKE.sales);
    expect(h.system).toMatch(/Regeln oben zu Wirkung, Freigabe, Datenschutz und deinem Bereich gehen immer vor/);
    expect((await chat('person-b', { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-crm-pflege' })).status).toBe(200);
    expect(aufrufe.find(x => x.zweck === 'agent-sales')!.system).toContain(MARKE.sales);
  });

  it('Privat-Head: der Auftrag geht nur in die Läufe der Person selbst', async () => {
    expect((await chat('person-a', { art: 'head', headId: 'assistenz' })).status).toBe(200);
    const a = aufrufe.find(x => x.zweck === 'agent-assistenz')!;
    expect(a.system).toContain('AUFTRAG DER PERSON FÜR DIESEN AGENTEN');
    expect(a.system).toContain(MARKE.privatA);
    expect((await chat('person-b', { art: 'head', headId: 'assistenz' })).status).toBe(200);
    expect(aufrufe.map(x => x.system).join('\n')).not.toContain(MARKE.privatA);
  });

  it('Auftrag mit Gesundheitsbezug (Ernährung): ohne (a) nicht gespeichert (403); mit (a) gespeichert, aber ohne (b) NIE im Prompt (Hinweis); mit (b) im Prompt + Kategorie gesundheit', async () => {
    await einwilligen('person-a', 'verarbeiten', false);
    const ohneA = await auftragSetzen('person-a', 'ernaehrung', MARKE.ernaehrung);
    expect(ohneA.status).toBe(403);
    expect(ohneA.d.einwilligung).toBe('gesundheit');
    expect((await karte('person-a', 'ernaehrung'))?.einstellung?.auftrag?.text ?? null).toBeNull();

    await einwilligen('person-a', 'verarbeiten', true);
    expect((await auftragSetzen('person-a', 'ernaehrung', MARKE.ernaehrung)).status).toBe(200);
    const k = await karte('person-a', 'ernaehrung');
    expect(k?.einstellung?.auftrag).toMatchObject({ text: MARKE.ernaehrung, anKi: false, kategorie: 'gesundheit' });
    expect(k?.einstellung?.auftrag?.grund).toMatch(/An die KI geben/);
    const r = await chat('person-a', { art: 'head', headId: 'ernaehrung' });
    expect(r.status).toBe(200);
    expect(aufrufe.map(x => x.system).join('\n')).not.toContain(MARKE.ernaehrung);
    expect(JSON.stringify(m.anfragen)).not.toContain(MARKE.ernaehrung);
    expect(String(r.d.hinweis ?? '')).toMatch(/ging nicht mit/);

    await einwilligen('person-a', 'ki', true);
    expect((await chat('person-a', { art: 'head', headId: 'ernaehrung' })).status).toBe(200);
    const e = aufrufe.find(x => x.zweck === 'agent-ernaehrung')!;
    expect(e.system).toContain(MARKE.ernaehrung);
    expect(e.ki!.kategorien).toContain('gesundheit');
    await einwilligen('person-a', 'ki', false);
  });

  it('Gesundheits-Head: Auftrag mit (a)+(b) im Prompt (Kategorie gesundheit); (b) widerrufen → Head weg, nichts mehr an das Modell', async () => {
    expect((await auftragSetzen('person-b', 'gesundheit', MARKE.gesundheitB)).status).toBe(200);
    expect((await chat('person-b', { art: 'head', headId: 'gesundheit' })).status).toBe(200);
    const g = aufrufe.find(x => x.zweck === 'agent-gesundheit')!;
    expect(g.system).toContain(MARKE.gesundheitB);
    expect(g.ki!.kategorien).toContain('gesundheit');
    // Ein Business-Head sieht den Gesundheits-Auftrag nie.
    await chat('person-b', { art: 'head', headId: 'marketing' });
    expect(aufrufe.map(x => x.system).join('\n')).not.toContain(MARKE.gesundheitB);

    await einwilligen('person-b', 'ki', false);
    const vorher = m.anfragen.length;
    const r = await chat('person-b', { art: 'head', headId: 'gesundheit' });
    expect(r.status).toBe(403);
    expect(m.anfragen.length).toBe(vorher);
    expect((await karten('person-b')).heads.some(h => h.id === 'gesundheit')).toBe(false);
    await einwilligen('person-b', 'ki', true);
  });
});

// ── 4 · Gesundheits-Unterlagen ──────────────────────────────────────────────────────────────────────────────────────────

describe('4 · Unterlagen: nur die Person selbst, (a) zum Speichern, (b) für den Agenten', () => {
  let idB = '';
  it('hochladen (mit (a)): verschlüsselt auf der Platte; nur die Person selbst liest, lädt herunter, löscht', async () => {
    const r = await hochladen('person-b', 'befund.txt', `Befund\n${MARKE.unterlageB}\nWerte unauffällig (Beispiel).`);
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    idB = (r.d.unterlage as { id: string }).id;
    expect(idB).toMatch(/^gu-/);
    // Platte: nur die Hülle (Format v2), nie der Text.
    const roh = readFileSync(path.join(ordner, UNTERLAGEN_ORDNER, `${idB}.bin`));
    expect(roh.subarray(0, 8).toString('ascii')).toBe('MKOSDAT2');
    expect(roh.toString('latin1')).not.toContain(MARKE.unterlageB);
    const b = await liste('person-b');
    expect(b.d.unterlagen?.map(u => u.id)).toContain(idB);
    expect(b.d.ki?.an).toBe(true);
    // Download: attachment, nosniff, Sandbox — der Inhalt kommt zurück.
    const dl = await unterlagen.GET(new Request(`http://test/api/gesundheit/unterlagen?id=${idB}`, { headers: { 'x-make-user': 'person-b' } }));
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-disposition')).toMatch(/^attachment/);
    expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
    expect(dl.headers.get('content-security-policy')).toMatch(/sandbox/);
    expect(await dl.text()).toContain(MARKE.unterlageB);
    // Gleiche Datei noch einmal → 409.
    expect((await hochladen('person-b', 'befund-kopie.txt', `Befund\n${MARKE.unterlageB}\nWerte unauffällig (Beispiel).`)).status).toBe(409);
  });

  it('andere Personen: Liste ohne fremde Unterlagen, Download/Löschen 404; Dienstweg 403; ohne Person 401', async () => {
    const a = await liste('person-a');
    expect(JSON.stringify(a.d)).not.toContain(idB);
    for (const p of ['person-a', 'team-c', 'gast', 'kunde']) {
      const g = await unterlagen.GET(new Request(`http://test/api/gesundheit/unterlagen?id=${idB}`, { headers: { 'x-make-user': p } }));
      expect(g.status, p).toBe(404);
      const d = await unterlagen.DELETE(new Request(`http://test/api/gesundheit/unterlagen?id=${idB}`, { method: 'DELETE', headers: { 'x-make-user': p } }));
      expect(d.status, p).toBe(404);
    }
    expect((await unterlagen.GET(new Request(`http://test/api/gesundheit/unterlagen?id=${idB}`, { headers: dienst('person-b') }))).status).toBe(403);
    expect((await hochladen('person-b', 'x.txt', 'Dienstweg', dienst('person-b'))).status).toBe(403);
    expect((await unterlagen.GET(new Request('http://test/api/gesundheit/unterlagen'))).status).toBe(401);
    expect((await liste('person-b')).d.unterlagen?.map(u => u.id)).toContain(idB);
  });

  it('ohne Einwilligung (a): nichts gespeichert (403); Typ am Inhalt: getarntes PDF 415, echtes PNG ok', async () => {
    await einwilligen('person-a', 'verarbeiten', false);
    const r = await hochladen('person-a', 'notiz.txt', 'OHNE-EINWILLIGUNG');
    expect(r.status).toBe(403);
    expect(r.d.einwilligung).toBe('gesundheit');
    expect(JSON.stringify((await liste('person-a')).d)).not.toContain('notiz.txt');
    await einwilligen('person-a', 'verarbeiten', true);
    expect((await hochladen('person-a', 'scan.pdf', 'nur Text, kein PDF')).status).toBe(415);
    expect((await hochladen('person-a', 'tabelle.xlsx', PNG)).status).toBe(415);
    expect((await hochladen('person-a', 'bild.png', PNG)).status).toBe(200);
    expect((await liste('person-a')).d.unterlagen?.length).toBe(1);
  });

  it('Text nur an den Gesundheits-Head (mit (b)) — gekapselt, Kategorie gesundheit; Business-Heads und ZOE bekommen das Werkzeug nie', async () => {
    const r = await chat('person-b', { art: 'head', headId: 'gesundheit' },
      werkzeug(['gesundheit_unterlagen', {}]), werkzeug(['gesundheit_unterlagen', { id: idB }]), text('Gelesen.'));
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const g = aufrufe.filter(x => x.zweck === 'agent-gesundheit');
    expect(g.length).toBeGreaterThanOrEqual(3);
    expect((g[0].tools ?? []).map(t => t.name)).toContain('gesundheit_unterlagen');
    const letzte = JSON.stringify(g.at(-1)!.messages);
    expect(letzte).toContain('fremde_daten quelle=\\"gesundheit-unterlagen\\"');
    expect(letzte).toContain(MARKE.unterlageB);
    expect(letzte).toContain('Teil 1 von 1');
    expect(g.at(-1)!.ki!.kategorien).toContain('gesundheit');
    // Kein Business-Head, kein Privat-Head ohne Gesundheit und kein ZOE-Werkzeug.
    for (const id of ['marketing', 'assistenz']) {
      await chat('person-b', { art: 'head', headId: id });
      for (const a of aufrufe) expect((a.tools ?? []).map(t => t.name), id).not.toContain('gesundheit_unterlagen');
    }
    const { REGISTER } = await import('@/lib/zoe/register');
    expect((REGISTER as Record<string, unknown>).gesundheit_unterlagen).toBeUndefined();
  });

  it('ohne (b): das Werkzeug liest nichts (auch wenn es aufgerufen würde); lange Texte in Teilen (nie still gekürzt)', async () => {
    const { unterlagenWerkzeugAusfuehren } = await import('@/lib/agenten/unterlagen-werkzeug');
    const ohneB = await unterlagenWerkzeugAusfuehren({}, { person: 'person-a', head: headDef('gesundheit')! });
    expect(ohneB.ok).toBe(false);
    expect(ohneB.text).toMatch(/^Nicht ausgeführt/);
    // Business-Head als Ziel → abgelehnt.
    expect((await unterlagenWerkzeugAusfuehren({}, { person: 'person-b', head: headDef('marketing')! })).ok).toBe(false);
    const lang = await hochladen('person-b', 'trainingsplan.md', `# Plan\n${'Lauf locker 5 km. '.repeat(4_000)}`);
    expect(lang.status).toBe(200);
    const id = (lang.d.unterlage as { id: string }).id;
    const t1 = await unterlagenWerkzeugAusfuehren({ id }, { person: 'person-b', head: headDef('gesundheit')! });
    expect(t1.text).toMatch(/Teil 1 von 3/);
    expect(t1.text).toMatch(/Weitere Teile/);
    const t3 = await unterlagenWerkzeugAusfuehren({ id, teil: 3 }, { person: 'person-b', head: headDef('gesundheit')! });
    expect(t3.text).toMatch(/Teil 3 von 3/);
    expect(t3.quelle).toBe('gesundheit-unterlagen');
  });
});

// ── 5 · Einrichtung ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('5 · Einrichtung: Prüfung „gesundheit-agent“ (nur ja/nein, nie Inhalt)', () => {
  it('erfüllt mit Auftrag oder Unterlage; sonst offen — der Befund nennt keinen Inhalt', async () => {
    const { pruefeAlles } = await import('@/lib/onboarding-status');
    const b = (await pruefeAlles('person-b'))['gesundheit-agent'];
    expect(b?.erfuellt).toBe(true);
    const c = (await pruefeAlles('team-c'))['gesundheit-agent'];
    expect(c?.erfuellt).toBe(false);
    for (const x of Object.values(MARKE)) { expect(JSON.stringify(b)).not.toContain(x); expect(JSON.stringify(c)).not.toContain(x); }
    const { SCHRITTE } = await import('@/lib/make-one/onboarding-data');
    const s = SCHRITTE.find(x => x.pruefung === 'gesundheit-agent')!;
    expect(s).toMatchObject({ ebene: 'ich', modul: 'gesundheit' });
    expect(s.wo?.href).toBe('/os/agenten?h=gesundheit&r=auftrag');
  });
});

// ── 6 · Konto: Export und Löschen ───────────────────────────────────────────────────────────────────────────────────────

describe('6 · Konto: Unterlagen im Export (Liste), beim Löschen samt Dateien weg — die der anderen Person bleiben', () => {
  it('Export und Löschen', async () => {
    const { kontoExport, kontoLoeschen } = await import('@/lib/datenschutz/konto-daten');
    const ex = await kontoExport('person-b');
    expect(Object.keys(ex!.bestaende)).toContain('gesundheit-unterlagen--person-b');
    expect(ex!.nichtEnthalten.some(n => n.bestand.startsWith('gesundheit-unterlagen'))).toBe(true);
    expect(JSON.stringify(ex)).toContain(MARKE.gesundheitB); // eigener Auftrag an den Gesundheits-Head (Abschnitt der Person)
    const dateienVorher = readdirSync(path.join(ordner, UNTERLAGEN_ORDNER));
    expect(dateienVorher.length).toBe(3); // 2 von person-b, 1 von person-a
    const bericht = await kontoLoeschen('person-b');
    expect(bericht?.bestaende).toContain('gesundheit-unterlagen--person-b');
    expect(bericht?.eintraege['gesundheit-unterlagen-dateien']).toBe(2);
    expect(existsSync(path.join(ordner, 'gesundheit-unterlagen--person-b.json'))).toBe(false);
    expect(readdirSync(path.join(ordner, UNTERLAGEN_ORDNER)).length).toBe(1);
    expect((await liste('person-a')).d.unterlagen?.length).toBe(1);
    // Der Abschnitt der Person (mit ihrem Gesundheits-Auftrag) ist weg.
    const e = JSON.stringify(await db.loadJson(`agenten-einstellung--${HAUS}`));
    expect(e).not.toContain(MARKE.gesundheitB);
    expect(e).toContain(MARKE.sales);
  });
});
