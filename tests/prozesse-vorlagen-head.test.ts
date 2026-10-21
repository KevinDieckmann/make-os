// ─── Prozesse · Kundengewinnung — „Head fragen“ (22.10.) ───────────────────────────────────────────────────────────────────────────────────────────
// Rein: Anfrage prüfen (413/400), Antwort des Modells in einen gültigen Entwurf übersetzen (Rauten nur als Feldregel, Ende am Schluss, Schloss an der Mail),
// der Prompt trägt nur Struktur (nie Masken-Werte), Regelwerk ohne KI (passende Vorlage ohne Teile; fehlende Schritte + fehlendes Ende), Bausteine einfügen
// ohne bestehende Knoten zu ändern, Unterschied zum Entwurf.
// Route + Stapel: der Vorschlag liegt NUR im Stapel (der Prozess bleibt unverändert), nur die anfragende Person übernimmt (aus der Sitzung, Dienstweg 403),
// ein ganzer Entwurf wird ein NEUER Prozess, Bausteine kommen auf den AKTUELLEN Entwurf (eine Änderung dazwischen bleibt), Ablehnen über den Stapel.
// Mit nachgebautem Modell (askText gemockt) und ohne KI. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  headAnfrageAus, headProzessAus, headBausteineAus, headPrompt, regelwerkVorschlag, bausteineEinfuegen, headDiff, headZusammenfassung, passendeVorlage, strukturText,
  type HeadAnfrage,
} from '@/lib/prozesse/kundengewinnung/head';
import { definitionPruefen, sperrtSpeichern } from '@/lib/prozesse/definition-pruefen';
import { schlossFehlt } from '@/lib/prozesse/schloss';
import { phasen } from '@/lib/prozesse/fluss';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { definition, schritt, fk, konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-head-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-head';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

// Nachgebautes Modell: nur wenn `modell.an`, sonst gilt „kein Schlüssel“. Die Aufrufe werden mitgeschrieben (Prompt + KI-Kontext prüfen).
const modell = vi.hoisted(() => ({ an: false, antwort: '' as string, aufrufe: [] as { system: string; user: string; ki?: unknown; model?: string }[] }));
vi.mock('@/lib/anthropic', async orig => {
  const echt = await orig<typeof import('@/lib/anthropic')>();
  return {
    ...echt,
    hasAnthropicKey: () => modell.an,
    guthabenLeer: () => false,
    askText: async (o: { system: string; user: string; ki?: unknown; model?: string }) => { modell.aufrufe.push(o); return { ok: true, status: 200, text: modell.antwort }; },
  };
});

const ANFRAGE: HeadAnfrage = { art: 'prozess', ziel: 'Neue Anfragen am selben Tag beantworten und qualifizieren', bereich: 'sales', fallArt: 'lead' };
const ANTWORT = {
  titel: 'Anfrage schnell beantworten', beschreibung: 'Jede neue Anfrage bekommt am selben Tag eine Antwort.', startKriterium: 'Eine neue Anfrage', endKriterium: 'Antwort raus und qualifiziert',
  ausloeser: { art: 'ereignis', ereignis: 'neuer-lead' },
  phasen: [
    { titel: 'Antworten', schritte: [
      { art: 'mail', titel: 'Antwort entwerfen', betreff: 'Ihre Anfrage', text: 'Danke für Ihre Anfrage {{kontakt.vorname}} {{geheim.feld}} — wir melden uns.' },
      { art: 'warten', titel: 'Zwei Tage warten', tage: 2 },
      { art: 'regel', titel: 'Hat geantwortet?', feld: 'lead.status', op: 'gleich', wert: 'im_gespraech' },
      { art: 'regel', titel: 'Das Modell entscheidet', feld: 'modell.bauchgefuehl', op: 'gleich', wert: 'ja' },
      { art: 'ziel', titel: 'Zu früh zu Ende' },
    ] },
    { titel: 'Qualifizieren', schritte: [
      { art: 'frage', titel: 'Passt der Lead?', text: 'Passt der Lead zu uns?' },
      { art: 'aufgabe', titel: 'Gespräch führen', text: 'Erstgespräch führen', tage: 3 },
    ] },
  ],
};

describe('Head (rein)', () => {
  it('Anfrage: Ziel zu lang → 413, ganzer Entwurf ohne Ziel/Bereich → 400, Bausteine ohne Prozess → 400', () => {
    expect(headAnfrageAus({ art: 'prozess', ziel: 'x'.repeat(1001), bereich: 'sales', fallArt: 'lead' })).toMatchObject({ ok: false, status: 413 });
    expect(headAnfrageAus({ art: 'prozess', ziel: '', bereich: 'sales', fallArt: 'lead' })).toMatchObject({ ok: false, status: 400 });
    expect(headAnfrageAus({ art: 'prozess', ziel: 'Leads pflegen' })).toMatchObject({ ok: false, status: 400 });
    expect(headAnfrageAus({ art: 'baustein', ziel: '' })).toMatchObject({ ok: false, status: 400 });
    expect(headAnfrageAus({ art: 'irgendwas' })).toMatchObject({ ok: false, status: 400 });
    expect(headAnfrageAus({ art: 'baustein', ziel: '', prozessId: 'pz-1' })).toMatchObject({ ok: true });
  });
  it('Antwort → gültiger Entwurf: Ereignis-Auslöser, Schloss hinter der Mail, Raute nur als Feldregel (Modell-Raute weg), Ende nur am Schluss, Platzhalter nur bekannte', () => {
    const r = headProzessAus(ANTWORT, ANFRAGE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.definition;
    expect(sperrtSpeichern(definitionPruefen(d, {}))).toBe(false);
    expect(schlossFehlt(d)).toBe(false);
    expect(d.knoten.some(k => k.ausloeser?.art === 'ereignis' && k.ausloeser.ereignis === 'neuer-lead')).toBe(true);
    expect(d.knoten.some(k => k.katalog?.id === 'entscheidung.modell')).toBe(false);
    expect(d.knoten.filter(k => k.raute?.art === 'regel')).toHaveLength(1);
    expect(r.hinweise.join(' ')).toMatch(/Feldregel/);
    // „Zu früh zu Ende“ (mitten im Ablauf) fällt weg; am Schluss steht ein Ende.
    expect(d.knoten.some(k => k.titel === 'Zu früh zu Ende')).toBe(false);
    const letzte = phasen(d).at(-1)!;
    expect(d.knoten.filter(k => k.elternId === letzte.id).some(k => k.form === 'ende')).toBe(true);
    // Jede Raute endet bei „nein“ mit „Nicht weiter“.
    for (const k of d.knoten.filter(x => x.form === 'entscheidung')) expect(d.knoten.find(x => x.id === k.zweige?.nein)?.ende?.ergebnis).toBe('abbruch');
    const mail = d.knoten.find(k => k.katalog?.id === 'inbox.mail-entwurf')!;
    expect(String(mail.katalog?.werte?.text)).not.toMatch(/geheim/);
    expect(d.herkunft).toMatchObject({ art: 'hand', quelleIds: ['head'] });
  });
  it('Unlesbares bzw. nicht Speicherbares → ok: false (dann gilt das Regelwerk)', () => {
    expect(headProzessAus(null, ANFRAGE)).toMatchObject({ ok: false });
    expect(headProzessAus('Text statt JSON', ANFRAGE)).toMatchObject({ ok: false });
  });
  it('Fall ohne Kontakt: Mail wird eine Aufgabe (keine Nachricht ohne Empfänger)', () => {
    const r = headProzessAus({ titel: 'Monatsblick', phasen: [{ titel: 'Ablauf', schritte: [{ art: 'mail', titel: 'Mail an alle', betreff: 'x', text: 'y' }] }] }, { ...ANFRAGE, fallArt: 'keiner' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.definition.knoten.some(k => k.katalog?.id === 'inbox.mail-entwurf')).toBe(false); expect(r.definition.knoten.some(k => k.katalog?.id === 'aufgabe.anlegen')).toBe(true); }
  });
  it('der Prompt trägt nur Struktur — nie Masken-Werte (z. B. Text einer Mail) — und nennt die erlaubten Felder', () => {
    const offen = definition([
      schritt(10, 'Mail schreiben', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { text: 'Hallo Erika Beispielname, Ihre Nummer 0170 1234567' } } }),
      schritt(11, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' }, katalog: { id: 'ende.ziel' } }),
    ], { fallArt: 'deal' });
    const p = headPrompt({ art: 'baustein', ziel: '', bereich: 'sales', fallArt: 'deal', prozessId: offen.id }, offen);
    expect(p.user).toMatch(/Mail schreiben/);
    expect(p.user).not.toMatch(/Erika|0170/);
    expect(p.user).toMatch(/deal\.stufe/);
    expect(strukturText(offen)).not.toMatch(/Erika/);
  });
  it('Regelwerk ganzer Prozess: die passende Vorlage ohne Teile (Fall-Art + Bereich + Wörter)', () => {
    const v = passendeVorlage({ ziel: 'Angebot nachfassen', bereich: 'sales', fallArt: 'deal', ohneTeile: true });
    expect(v?.fallArt).toBe('deal');
    expect(v?.teile).toHaveLength(0);
    const r = regelwerkVorschlag({ art: 'prozess', ziel: 'Angebot nachfassen', bereich: 'sales', fallArt: 'deal' });
    expect(r?.art).toBe('prozess');
    if (r?.art === 'prozess') { expect(r.quelle).toBe('regelwerk'); expect(r.vorlage).toBe(v?.id); expect(r.hinweise[0]).toMatch(/Ohne KI/); }
  });
  it('Regelwerk Bausteine: fehlende Schritte der passenden Vorlage und ein fehlendes Ende — nie ein Auslöser, nie eine Raute', () => {
    const offen = definition([schritt(10, 'Notiz', 1, { katalog: { id: 'crm.kontakt-notiz', werte: { text: 'x' } } })], { fallArt: 'deal', titel: 'Angebot nachfassen' });
    const r = regelwerkVorschlag({ art: 'baustein', ziel: '', bereich: 'sales', fallArt: 'deal', prozessId: offen.id }, offen);
    expect(r?.art).toBe('baustein');
    if (r?.art !== 'baustein') return;
    expect(r.knoten.length).toBeGreaterThan(0);
    expect(r.knoten.some(k => k.form === 'ausloeser' || k.form === 'entscheidung')).toBe(false);
    expect(r.knoten.at(-1)?.ende?.ergebnis).toBe('erfolg');
    expect(r.knoten.some(k => k.katalog?.id === 'crm.kontakt-notiz')).toBe(false);
  });
  it('Bausteine einfügen: vor dem Ende der Phase, bestehende Knoten unverändert (nur der Rang rückt), Seitenziel daneben; Phase weg → Grund', () => {
    const offen = definition([
      schritt(10, 'Anrufen', 1, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Anrufen' } } }),
      schritt(11, 'Fertig', 2, { form: 'ende', ende: { ergebnis: 'erfolg' }, katalog: { id: 'ende.ziel' } }),
    ], { fallArt: 'deal' });
    const b = headBausteineAus({ phase: 'Ablauf', schritte: [{ art: 'warten', titel: 'Drei Tage warten', tage: 3 }, { art: 'regel', titel: 'Noch offen?', feld: 'deal.offen', op: 'gleich', wert: true }, { art: 'ziel', titel: 'Ende' }] }, offen);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.vorschlag.hinweise.join(' ')).toMatch(/Ende/);
    let n = 100;
    const ins = bausteineEinfuegen(offen, b.vorschlag, () => fk(++n));
    expect(ins.ok).toBe(true);
    if (!ins.ok) return;
    for (const alt of offen.knoten) {
      const neu = ins.knoten.find(k => k.id === alt.id)!;
      const { rang: _a, ...ohneRangAlt } = alt; const { rang: _b, ...ohneRangNeu } = neu; void _a; void _b;
      expect(ohneRangNeu, alt.titel).toEqual(ohneRangAlt);
    }
    const reihe = ins.knoten.filter(k => k.elternId === fk(2)).sort((a, c) => a.rang - c.rang).map(k => k.titel);
    expect(reihe.indexOf('Drei Tage warten')).toBeLessThan(reihe.indexOf('Fertig'));
    expect(reihe.indexOf('Noch offen?')).toBeLessThan(reihe.indexOf('Fertig'));
    expect(ins.wo).toMatch(/vor „Fertig“/);
    const d: ProzessDefinition = { ...offen, knoten: ins.knoten };
    expect(sperrtSpeichern(definitionPruefen(d, {}))).toBe(false);
    expect(bausteineEinfuegen(offen, { ...b.vorschlag, phaseId: fk(99) }, () => fk(++n))).toMatchObject({ ok: false });
  });
  it('Unterschied und Zusammenfassung: Bausteine mit Ort und „bestehende bleiben“, ganzer Entwurf als Phasen', () => {
    const offen = definition([schritt(11, 'Fertig', 1, { form: 'ende', ende: { ergebnis: 'erfolg' }, katalog: { id: 'ende.ziel' } })], { fallArt: 'deal' });
    const b = headBausteineAus({ schritte: [{ art: 'glocke', titel: 'Hinweis an den Eigner', text: 'Bitte ansehen' }] }, offen);
    if (!b.ok) throw new Error(b.grund);
    const v = { art: 'baustein' as const, quelle: 'ki' as const, prozessId: offen.id, ...b.vorschlag };
    const diff = headDiff(v, offen);
    expect(diff).toMatchObject({ art: 'baustein', phase: 'Ablauf', wo: 'vor „Fertig“' });
    expect(headZusammenfassung(v, diff)).toMatch(/Bestehende Schritte bleiben/);
    expect(headDiff(v, { knoten: offen.knoten.filter(k => k.id !== fk(2)) })).toMatchObject({ fehlt: expect.any(String) });
    const p = headProzessAus(ANTWORT, ANFRAGE);
    if (!p.ok) throw new Error(p.grund);
    const dp = headDiff({ art: 'prozess', quelle: 'ki', definition: p.definition, hinweise: [] });
    expect(dp.art).toBe('prozess');
    if (dp.art === 'prozess') { expect(dp.phasen).toHaveLength(2); expect(dp.freigaben).toBeGreaterThan(0); }
  });
});

// ── Route + Stapel ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROUTEN: Record<string, () => Promise<unknown>> = {
  'prozesse/head': () => import('@/app/api/prozesse/head/route'),
  'prozesse/werkstatt': () => import('@/app/api/prozesse/werkstatt/route'),
  'zoe/stapel': () => import('@/app/api/zoe/stapel/route'),
};
async function route(pfad: string, methode: 'GET' | 'POST', kopf: Record<string, string>, body?: Record<string, unknown>, suche = '') {
  const m = await ROUTEN[pfad]() as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(body ? { body: JSON.stringify(body) } : {}) }));
  return { status: r.status, j: await r.json() as J };
}
const head = (kopf: Record<string, string>, body: Record<string, unknown>) => route('prozesse/head', 'POST', kopf, body, '?space=business');
const werkstatt = (kopf: Record<string, string>, body: Record<string, unknown>) => route('prozesse/werkstatt', 'POST', kopf, body, '?space=business');
const prozessLesen = async (id: string) => (await route('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, `?id=${id}&space=business`)).j;

describe('„Head fragen“ über die Route — nur Vorschlag, Übernahme per Klick', () => {
  let pid = '';
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: 'haus-hd' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-hd' }), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer' })], einladungen: [] });
    const a = await werkstatt(sitzung('pia'), { aktion: 'anlegen', titel: 'Angebot nachfassen', bereich: 'sales', fallArt: 'deal', anfrageId: 'pza-00000000-0000-4000-8000-0000000000a1' });
    pid = a.j.eintrag.id;
  });
  it('GET: ohne Schlüssel „ohne KI“ (kostenlos), fremder Haushalt und Sicht Privat → 403', async () => {
    const g = await route('prozesse/head', 'GET', sitzung('pia'), undefined, '?space=business');
    expect(g.status).toBe(200);
    expect(g.j).toMatchObject({ ki: false, grund: 'schluessel' });
    expect(g.j.vorschlaege).toEqual([]);
    expect((await route('prozesse/head', 'GET', sitzung('gast'), undefined, '')).status).toBe(403);
    expect((await route('prozesse/head', 'GET', sitzung('pia'), undefined, '?space=privat')).status).toBe(403);
  });
  it('Bausteine ohne KI: Vorschlag liegt im Stapel, der Prozess bleibt unverändert; Dienstweg darf nicht fragen', async () => {
    const vorher = await prozessLesen(pid);
    const r = await head(sitzung('pia'), { aktion: 'fragen', art: 'baustein', ziel: '', prozessId: pid, anfrageId: 'pzh-00000000-0000-4000-8000-0000000000b1' });
    expect(r.status).toBe(200);
    expect(r.j.quelle).toBe('regelwerk');
    expect(r.j.diff.art).toBe('baustein');
    const nachher = await prozessLesen(pid);
    expect(nachher.stand).toBe(vorher.stand);
    const { lies } = await import('@/lib/zoe/stapel');
    const offen = (await lies('offen')).filter(v => v.bezug?.art === 'prozess-entwurf');
    expect(offen).toHaveLength(1);
    expect(offen[0]).toMatchObject({ person: 'pia', bezug: { id: pid }, bereich: 'business' });
    expect((await head({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' }, { aktion: 'fragen', art: 'baustein', prozessId: pid })).status).toBe(403);
    // Die eigene Liste zeigt ihn mit Unterschied — eine andere Person sieht ihn nicht.
    const g = await route('prozesse/head', 'GET', sitzung('pia'), undefined, `?prozess=${pid}&space=business`);
    expect(g.j.vorschlaege).toHaveLength(1);
    expect(g.j.vorschlaege[0].diff.neu.length).toBeGreaterThan(0);
    expect((await route('prozesse/head', 'GET', sitzung('olaf'), undefined, `?prozess=${pid}&space=business`)).j.vorschlaege).toEqual([]);
  });
  it('Übernehmen: nur die anfragende Person; auf den AKTUELLEN Entwurf (eine Änderung dazwischen bleibt), nie überschrieben', async () => {
    const g = await route('prozesse/head', 'GET', sitzung('pia'), undefined, `?prozess=${pid}&space=business`);
    const vid = g.j.vorschlaege[0].id as string;
    // Eine andere Person darf ihn nicht übernehmen (für sie gibt es ihn nicht).
    expect((await head(sitzung('olaf'), { aktion: 'uebernehmen', id: vid })).status).toBe(404);
    // Dazwischen ändert jemand den Steckbrief — diese Änderung bleibt nach der Übernahme stehen.
    const p = await prozessLesen(pid);
    const s = await werkstatt(sitzung('olaf'), { aktion: 'steckbrief', id: pid, stand: p.stand, felder: { beschreibung: 'Von Hand ergänzt' } });
    expect(s.status).toBe(200);
    const vorherKnoten = (await prozessLesen(pid)).eintrag.entwurf.knoten as J[];
    const u = await head(sitzung('pia'), { aktion: 'uebernehmen', id: vid });
    expect(u.status).toBe(200);
    expect(u.j.prozessId).toBe(pid);
    const nach = (await prozessLesen(pid)).eintrag.entwurf;
    expect(nach.beschreibung).toBe('Von Hand ergänzt');
    for (const k of vorherKnoten) {
      const n = (nach.knoten as J[]).find(x => x.id === k.id);
      expect(n, k.titel).toBeTruthy();
      expect({ ...n, rang: 0 }).toEqual({ ...k, rang: 0 });
    }
    expect(nach.knoten.length).toBeGreaterThan(vorherKnoten.length);
    const { hole } = await import('@/lib/zoe/stapel');
    expect((await hole(vid))?.status).toBe('freigegeben');
    // Zweimal geht nicht.
    expect((await head(sitzung('pia'), { aktion: 'uebernehmen', id: vid })).status).toBe(409);
  });
  it('ganzer Entwurf mit nachgebautem Modell: nur Struktur ans Modell (Kategorie „allgemein“, Stufe des Heads) — Übernehmen legt einen NEUEN Prozess an', async () => {
    modell.an = true; modell.antwort = JSON.stringify(ANTWORT); modell.aufrufe = [];
    try {
      const vorher = (await route('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?space=business')).j.prozesse.filter((x: J) => x.quelle === 'werkstatt').length;
      const r = await head(sitzung('pia'), { aktion: 'fragen', art: 'prozess', ziel: ANFRAGE.ziel, bereich: 'sales', fallArt: 'lead', anfrageId: 'pzh-00000000-0000-4000-8000-0000000000b2' });
      expect(r.status).toBe(200);
      expect(r.j.quelle).toBe('ki');
      expect(modell.aufrufe).toHaveLength(1);
      expect(modell.aufrufe[0].ki).toMatchObject({ person: 'pia', kategorien: ['allgemein'] });
      expect(modell.aufrufe[0].user).toMatch(/Ziel des Prozesses/);
      // Nichts angelegt, bevor jemand übernimmt.
      expect((await route('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?space=business')).j.prozesse.filter((x: J) => x.quelle === 'werkstatt')).toHaveLength(vorher);
      const g = await route('prozesse/head', 'GET', sitzung('pia'), undefined, '?space=business');
      const v = g.j.vorschlaege.find((x: J) => x.art === 'prozess');
      expect(v.diff.phasen.length).toBe(2);
      // Freigabe über den Stapel (derselbe Weg wie in den Freigaben) — aus der Sitzung.
      const f = await route('zoe/stapel', 'POST', sitzung('pia'), { id: v.id });
      expect(f.status).toBe(200);
      const liste = (await route('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?space=business')).j.prozesse.filter((x: J) => x.quelle === 'werkstatt');
      expect(liste).toHaveLength(vorher + 1);
      const neu = liste.find((x: J) => x.titel === 'Anfrage schnell beantworten');
      expect(neu).toBeTruthy();
      const e = (await prozessLesen(neu.id)).eintrag;
      expect(e.status).toBe('entwurf');
      expect(e.entwurf.herkunft).toMatchObject({ art: 'hand', quelleIds: ['head'] });
      expect(e.entwurf.startKriterium).toBe('Eine neue Anfrage');
      expect(e.entwurf.knoten.every((k: J) => /^fk-/.test(k.id))).toBe(true);
    } finally { modell.an = false; }
  });
  it('Ablehnen über den Stapel; Dienstweg übernimmt nie', async () => {
    const r = await head(sitzung('pia'), { aktion: 'fragen', art: 'prozess', ziel: 'Kunden um eine Empfehlung bitten', bereich: 'ausbau', fallArt: 'mandat', ki: false, anfrageId: 'pzh-00000000-0000-4000-8000-0000000000b3' });
    expect(r.status).toBe(200);
    expect(r.j.quelle).toBe('regelwerk');
    const vid = r.j.vorschlag.id as string;
    expect((await head({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' }, { aktion: 'uebernehmen', id: vid })).status).toBe(403);
    const { hole } = await import('@/lib/zoe/stapel');
    const v = await hole(vid);
    const { PROZESS_ENTWURF_STAPEL_ART } = await import('@/lib/prozesse/kundengewinnung/head-server');
    expect(await PROZESS_ENTWURF_STAPEL_ART.freigeben(v!, 'pia', { sitzung: false })).toMatchObject({ ok: false, status: 403 });
    const a = await route('zoe/stapel', 'POST', sitzung('pia'), { id: vid, entscheidung: 'ablehnen', grund: 'passt nicht' });
    expect(a.status).toBe(200);
    expect((await hole(vid))?.status).toBe('abgelehnt');
  });
});
