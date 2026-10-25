// ─── Kleine Bauten · Punkt 10 (25.10.): `{{absender.name}}` und die festen Formatierer in den Texten je Produkt ────────────────────────────────
// Der Umwandler fand auf den echten Lieferungen: Mails und Willkommensmails nennen die Absender-Gesellschaft (`{{absender.name}}`) und formatieren Daten
// (`{{mandat.start | datum-lang}}`). Hier: Werkstatt (Fall Mandat) kennt und füllt den Platzhalter aus dem Register (Firmierung), Willkommensmail und
// Begleit-Mail ebenso; Formatierer wie in der Werkstatt; `{{fall.termin}}` lehnt die Willkommensmail mit Satz ab (steht beim Versand oft noch nicht fest);
// ohne neue Platzhalter bleibt jeder Text Zeichen für Zeichen gleich. Eigener Datenordner, erfundene Konten @example.invalid, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kleine-bauten-absender-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-kleine-bauten-absender';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MAKE_OS_GRABSTEINE_DIR;
  return o;
});

import { PLATZHALTER_JE_FALL, platzhalterFuer, textvorlagePruefen, textvorlageFuellen, formatieren as katalogFormatieren, FORMATIERER as KATALOG_FORMATIERER } from '@/lib/prozesse/baustein-katalog';
import { FORMATIERER, formatieren } from '@/lib/prozesse/formatierer';
import { platzhalterPruefen, platzhalterFuellen, willkommenWerte, angebotWerte } from '@/lib/crm/vorlage-platzhalter';
import { absenderFirmierung } from '@/lib/gesellschaften/modell';
import { willkommenQuelle } from '@/lib/crm/produkt-willkommen';
import { mailVorlage } from '@/lib/crm/angebote';
import { importPlanen } from '@/lib/crm/produkt-import';
import { BEISPIEL_PLATZHALTER } from '@/lib/prozesse/testdaten';
import type { Leistung } from '@/lib/crm/typen';

const H = 'haus-absender';
const J = '2026-10-01T08:00:00.000Z';
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: H });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber')], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const mandat = (id: string, gesellschaft: string) => ({
    id, kunde: 'Probe Kunde', kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft, status: 'aktiv', zustaendig: 'pia',
    vertragUnterschrieben: true, start: '2026-11-02', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
    ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  });
  await d.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-ug', 'ug'), mandat('m-kdc', 'kdc'), mandat('m-ohne', 'kdv')] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', anrede: 'Sie', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  // Register des Haushalts: Firmierung je Gesellschaft (erfunden); `kdv` ohne Eintrag (→ Name der festen Gesellschaft).
  await d.saveJson(`gesellschaften--${H}`, { gesellschaften: [{ id: 'ug', firmierung: 'Probe Innovation GmbH' }, { id: 'kdc', firmierung: 'Probe Beratung e.K.' }] });
});

describe('Werkstatt (Fall Mandat): {{absender.name}} gibt es und der Motor füllt ihn', () => {
  it('erlaubt im Fall Mandat, nicht im Fall Lead; die Formatierer sind dieselbe Liste (eine Stelle)', () => {
    expect(PLATZHALTER_JE_FALL.mandat).toContain('absender.name');
    expect(textvorlagePruefen('{{kontakt.gruss}}, … Ihr Team von {{absender.name}} · {{mandat.start | datum-lang}}', platzhalterFuer('mandat'))).toEqual([]);
    expect(textvorlagePruefen('{{absender.name}}', platzhalterFuer('lead'))).toEqual(['den Platzhalter {{absender.name}} gibt es hier nicht.']);
    expect(KATALOG_FORMATIERER).toBe(FORMATIERER);
    expect(katalogFormatieren).toBe(formatieren);
    expect(formatieren('datum', '2026-11-02')).toBe('02.11.2026');
    expect(formatieren('datum-lang', '2026-11-02')).toMatch(/2\. November 2026$/);
    // Probelauf mit dem Beispiel-Fall: ein erfundener Wert, nie leer.
    expect(textvorlageFuellen('Ihr Team von {{absender.name}}', BEISPIEL_PLATZHALTER)).toEqual({ text: 'Ihr Team von Beispiel Beratung GmbH', fehlend: [] });
  });
  it('Firmierung als Absender: eingetragene Firmierung → Name der festen Gesellschaft → Name im Register — nie eine Kennung', () => {
    expect(absenderFirmierung({ id: 'ug', firmierung: '  Probe Innovation GmbH ' })).toBe('Probe Innovation GmbH');
    expect(absenderFirmierung({ id: 'kdv' })).not.toBe('');
    expect(absenderFirmierung({ id: 'kdv' })).not.toBe('kdv');
    expect(absenderFirmierung({ id: 'g-00000000-0000-4000-8000-000000000001', name: 'Probe Holding' })).toBe('Probe Holding');
    expect(absenderFirmierung({ id: 'g-00000000-0000-4000-8000-000000000002' })).toBe('');
  });
  it('aus dem Register des Haushalts: je Gesellschaft des Mandats; ohne Haushalt, „offen“ oder unbekannt → leer', async () => {
    const { absenderFirmierungLaden } = await import('@/lib/gesellschaften/server');
    expect(await absenderFirmierungLaden(H, 'ug')).toBe('Probe Innovation GmbH');
    expect(await absenderFirmierungLaden(H, 'kdc')).toBe('Probe Beratung e.K.');
    expect(await absenderFirmierungLaden(H, 'kdv')).toBe(absenderFirmierung({ id: 'kdv' }));
    expect(await absenderFirmierungLaden(H, 'offen')).toBe('');
    expect(await absenderFirmierungLaden(null, 'ug')).toBe(absenderFirmierung({ id: 'ug' }));
    expect(await absenderFirmierungLaden(H, undefined)).toBe('');
  });
  it('der Motor legt ihn in die Platzhalter des Falls (je Mandat seine Gesellschaft)', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const { BEGLEIT_VORLAGEN } = await import('@/lib/prozesse/begleitung/vorlagen');
    const kx = await S.kontextLaden(new Date(), H);
    const lauf = (mandatId: string) => ({
      id: 'pl-00000000-0000-4000-8000-000000000010', prozessId: 'pz-00000000-0000-4000-8000-000000000010', version: 1, fall: { art: 'mandat' as const, id: mandatId }, bereich: 'fulfillment' as const,
      schluessel: 'x', durchgang: 1, modus: 'scharf' as const, status: 'laeuft' as const, person: 'pia', ausloeser: { art: 'hand' as const }, tiefe: 0, daten: { 'bezug.mandatid': mandatId },
      start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0,
    });
    const def = BEGLEIT_VORLAGEN[0].definition;
    const ug = await S.umfeldFuer(lauf('m-ug') as never, def, kx);
    expect(ug.platzhalter?.['absender.name']).toBe('Probe Innovation GmbH');
    expect(textvorlageFuellen('{{kontakt.gruss}}, Start am {{mandat.start | datum-lang}}. Ihr Team von {{absender.name}}', ug.platzhalter ?? {}).text)
      .toBe(`Guten Tag Testa Probe, Start am ${formatieren('datum-lang', '2026-11-02')}. Ihr Team von Probe Innovation GmbH`);
    expect((await S.umfeldFuer(lauf('m-kdc') as never, def, kx)).platzhalter?.['absender.name']).toBe('Probe Beratung e.K.');
  });
});

describe('Willkommensmail und Begleit-Mail: {{absender.name}} und die festen Formatierer', () => {
  it('Prüfung: {{absender.name}} und Formatierer erlaubt; {{fall.termin}} mit klarem Satz abgelehnt; unbekannter Formatierer bzw. am Onboarding-Platzhalter abgelehnt', () => {
    expect(platzhalterPruefen('{{kontakt.gruss}}, willkommen bei {{absender.name}} — Start {{mandat.start | datum-lang}}, Stand {{heute | datum}}.', 'willkommen', 'W')).toEqual([]);
    expect(platzhalterPruefen('Gültig bis {{angebot.gueltigBis | datum-lang}} · {{absender.name}}', 'angebot', 'A')).toEqual([]);
    const termin = platzhalterPruefen('Dein Termin ist am {{fall.termin | datum-lang}}.', 'willkommen', 'W');
    expect(termin).toHaveLength(1);
    expect(termin[0]).toMatch(/fall\.termin.*nicht.*Versand.*kickoff_vorschlaege.*mandat\.start \| datum-lang/);
    expect(platzhalterPruefen('{{mandat.start | fett}}', 'willkommen', 'W')[0]).toMatch(/Formatierer „fett“ gibt es nicht — erlaubt sind datum, datum-lang, betrag, zahl/);
    expect(platzhalterPruefen('{{vorname | gross}}', 'willkommen', 'W')[0]).toMatch(/füllt das Onboarding beim Senden selbst/);
    expect(platzhalterPruefen('{{mandat.start | }}', 'willkommen', 'W')[0]).toMatch(/nicht lesbar/);
  });
  it('Füllen: Datum ohne Formatierer TT.MM.JJJJ wie bisher, mit Formatierer formatiert; unbekannte bleiben stehen', () => {
    const w = willkommenWerte({ anrede: 'Du', vorname: 'Testa', start: '2026-11-02', heute: '2026-10-25', absender: 'Probe Innovation GmbH' });
    expect(platzhalterFuellen('{{mandat.start}} · {{mandat.start | datum-lang}} · {{heute | datum}} · {{absender.name}} · {{kickoff_vorschlaege}}', w))
      .toBe(`02.11.2026 · ${formatieren('datum-lang', '2026-11-02')} · 25.10.2026 · Probe Innovation GmbH · {{kickoff_vorschlaege}}`);
    expect(platzhalterFuellen('{{angebot.gueltigBis}}', angebotWerte({ gueltigBis: '2026-12-01' }))).toBe('01.12.2026');
    expect(platzhalterFuellen('{{angebot.gueltigBis | datum-lang}}', angebotWerte({}))).toBe('');
  });
  it('Willkommensmail des Produkts: Absender aus der Gesellschaft des Mandats; ohne Angabe bleibt sein Platz leer', () => {
    const produkt = { id: 'l-1', name: 'Beispiel-Begleitung', willkommen: { betreff: 'Willkommen bei {{absender.name}}', text: '{{kontakt.gruss}},\n\nwir starten am {{mandat.start | datum-lang}}.\n\nDein Team von {{absender.name}}' } } as Pick<Leistung, 'id' | 'name' | 'willkommen'>;
    const p = { bausteine: [], prozesse: [], produkt, mandat: { titel: 'Mandat', start: '2026-11-02' }, anrede: 'Du' as const, kontakt: { vorname: 'Testa' }, heute: '2026-10-25' };
    const mit = willkommenQuelle({ ...p, absender: 'Probe Innovation GmbH' })!;
    expect(mit.text).toBe(`Betreff: Willkommen bei Probe Innovation GmbH\n\nHallo Testa,\n\nwir starten am ${formatieren('datum-lang', '2026-11-02')}.\n\nDein Team von Probe Innovation GmbH`);
    const ohne = willkommenQuelle(p)!.text;
    expect(ohne.startsWith('Betreff: Willkommen bei\n\n')).toBe(true);
    expect(ohne.endsWith('Dein Team von ')).toBe(true);
  });
  it('Begleit-Mail des Produkts: {{absender.name}} = die Firmierung des Absenders; ohne Produkt-Text Zeichen für Zeichen wie bisher', () => {
    const e = { anrede: 'Sie' as const, vorname: 'Testa', nachname: 'Probe', titel: 'Beispiel', nummer: 'BSP-A-2026-0001', gueltigBis: '2026-12-01', absender: 'Probe Innovation GmbH' };
    const m = mailVorlage(e, { mail: { betreff: 'Angebot {{angebot.nummer}}', text: '{{kontakt.gruss}},\n\nbis {{angebot.gueltigBis | datum-lang}}.\n\n{{absender.name}}' } });
    expect(m.betreff).toBe('Angebot BSP-A-2026-0001');
    expect(m.text).toBe(`Guten Tag Testa Probe,\n\nbis ${formatieren('datum-lang', '2026-12-01')}.\n\nProbe Innovation GmbH`);
  });
  it('Import: Willkommensmail und Begleit-Mail mit {{absender.name}} und Formatierer gehen durch (200, zweiter Lauf „gleich“); {{fall.termin}} 400 mit Satz', () => {
    const k = () => ({ neueId: () => 'l-neu-10' });
    const roh = { name: 'Beispiel-Begleitung', leistungstext: 'x', gesellschaft: 'ug', angebot: { mail: { betreff: 'Angebot von {{absender.name}}', text: '{{kontakt.gruss}},\n\nbis {{angebot.gueltigBis | datum}}.' } },
      willkommen: { betreff: 'Willkommen bei {{absender.name}}', text: '{{kontakt.gruss}},\n\nStart am {{mandat.start | datum-lang}}.\n\n{{absender.name}}' } };
    const p = importPlanen({ leistungen: [] }, [roh], k());
    expect(p.status, JSON.stringify(p.zeilen[0].fehler)).toBe(200);
    const e = (p.ops[0] as { eintrag: Record<string, unknown> }).eintrag;
    const zweiter = importPlanen({ leistungen: [{ id: 'l-neu-10', name: 'Beispiel-Begleitung', status: 'entwurf', ...(e as object) } as unknown as Leistung] }, [roh], k());
    expect(zweiter.zeilen[0].art, JSON.stringify(zweiter.zeilen[0].felder)).toBe('gleich');
    const termin = importPlanen({ leistungen: [] }, [{ ...roh, willkommen: { text: 'Dein Termin: {{fall.termin | datum-lang}}' } }], k());
    expect(termin.status).toBe(400);
    expect(JSON.stringify(termin.zeilen[0].fehler)).toMatch(/fall\.termin/);
  });
});
