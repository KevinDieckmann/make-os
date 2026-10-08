// ─── Wächter: Anbieter-Tor rein (09.10.2026, Paket 6a) — Stufen, Auswahl, Kosten, Budget, Modelle, Register, Kennzeichnung ───────────
// Rein, ohne Netz und ohne Datenordner. Erfundene Werte. Die Server-Wege (askText über das Tor, Medien, Budget-Sperre) prüft
// tests/ki-anbieter-tor.test.ts mit nachgebauten Anbietern.
import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  anbieterWaehlen, mindestStufeFuer, mindestens, hostErlaubt, KI_ANBIETER, ROUTEN, STUFEN_REIHE, type AnbieterZustand, type AnbieterId,
} from '@/lib/ki/anbieter';
import { MODELLE, stufenModelle, STUFEN_SAETZE, STUFEN_VORGABE, vertexModellId, preiseFuer, STUFE_JE_ROLLE } from '@/lib/ki/modelle';
import { kostenSchaetzen, kostenUsdCent, euroText, usdEurKurs, USD_EUR_VORGABE } from '@/lib/ki/kosten';
import { kostenPruefen, budgetLage, registerZustand, GRENZE_AUFTRAG_VORGABE_CENT } from '@/lib/ki/tor';
import { fuerVertex, vertexClaudeUrl, vertexHost } from '@/lib/ki/adapter/anthropic-vertex';
import { sichtbaresZeichen, herkunftsAngabe, anbieterKennzeichnung } from '@/lib/ki/kennzeichnung';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { wortfehlerrate, werGesamt } from '@/lib/ki/wer';
import { stufenVergleichen } from '@/lib/ki/stufen-vergleich';
import { eintragSaeubern, empfaengerAuskunft, otelAttribute, KI_EMPFAENGER } from '@/lib/datenschutz/ki-protokoll';
import { EMPFAENGER_START, empfaengerHeben, empfaengerNachtragen, empfaengerWirksam, empfaengerPruefen, ANTHROPIC_DRITTLAND, type Empfaenger } from '@/lib/datenschutz/einrichtung';
import { verarbeitungKiNachtragen, verarbeitungKi, VV_KI, VV_KI_ANBIETER } from '@/lib/datenschutz/vvt-ki';
import { verzeichnisVervollstaendigen, verarbeitungenStart, alteFassungenHeben } from '@/lib/crm/datenschutz';
import { dienstkontoAus, istEuRegion, torModus, anbieterEingerichtet } from '@/lib/ki/konfig';
import type { Bewertung } from '@/lib/heads/eval';

const ZUSTAND_ALLE = (z: Partial<AnbieterZustand> = {}): Partial<Record<AnbieterId, AnbieterZustand>> =>
  Object.fromEntries(KI_ANBIETER.map(a => [a.id, { eingerichtet: true, zdr: false, register: 'bestaetigt', ...z }]));

describe('Datenschutzstufen und Mindeststufen', () => {
  it('Reihenfolge lokal > eu-zdr > eu > dpf > scc > keine', () => {
    expect(STUFEN_REIHE).toEqual(['keine', 'scc', 'dpf', 'eu', 'eu-zdr', 'lokal']);
    expect(mindestens('eu-zdr', 'eu')).toBe(true);
    expect(mindestens('scc', 'eu')).toBe(false);
  });
  it('Gesundheit verlangt eu-zdr, Familie und Privat-Finanzen eu, sonst keine Grenze', () => {
    expect(mindestStufeFuer(['gesundheit', 'crm'])).toBe('eu-zdr');
    expect(mindestStufeFuer(['familie'])).toBe('eu');
    expect(mindestStufeFuer(['finanzen', 'finanzen-privat'])).toBe('eu');
    expect(mindestStufeFuer(['crm', 'aufgaben'])).toBe('keine');
  });
});

describe('Auswahl: Gesundheit nie unter eu-zdr, Rückfall nie schwächer', () => {
  it('Gesundheit: Vertex EU ohne ZDR reicht nicht → gesperrt (nie Anthropic direkt)', () => {
    const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: ['gesundheit'], zustand: ZUSTAND_ALLE() });
    expect(w).toMatchObject({ ok: false, grund: 'anbieter-stufe', mindestStufe: 'eu-zdr' });
  });
  it('Gesundheit: Vertex EU mit bestätigter ZDR → dorthin', () => {
    const z = ZUSTAND_ALLE(); z['anthropic-vertex-eu'] = { eingerichtet: true, zdr: true, register: 'bestaetigt' };
    const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: ['gesundheit'], zustand: z });
    expect(w).toMatchObject({ ok: true, anbieter: 'anthropic-vertex-eu', stufe: 'eu-zdr' });
  });
  it('für keine Kategorie und keinen Zustand landet Gesundheit unter eu-zdr (Durchlauf aller Kombinationen)', () => {
    const regs: AnbieterZustand['register'][] = ['fehlt', 'archiviert', 'avv-offen', 'bestaetigt'];
    for (const ein of [true, false]) for (const zdr of [true, false]) for (const reg of regs) for (const streng of [true, false]) for (const extra of [[], ['crm'], ['familie'], ['web']] as const) {
      const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: ['gesundheit', ...extra], zustand: ZUSTAND_ALLE({ eingerichtet: ein, zdr, register: reg }), streng });
      if (w.ok) expect(mindestens(w.stufe, 'eu-zdr'), JSON.stringify({ ein, zdr, reg, streng, extra })).toBe(true);
    }
    for (const f of ['bild', 'video', 'tiefenbericht', 'transkript'] as const) {
      const w = anbieterWaehlen({ faehigkeit: f, kategorien: ['gesundheit'], zustand: ZUSTAND_ALLE({ zdr: true }) });
      if (w.ok) expect(mindestens(w.stufe, 'eu-zdr')).toBe(true);
    }
  });
  it('Familie: Vertex EU (eu) genügt; ist er archiviert, gibt es KEINEN Rückfall auf Anthropic direkt', () => {
    const z = ZUSTAND_ALLE();
    expect(anbieterWaehlen({ faehigkeit: 'text', kategorien: ['familie'], zustand: z })).toMatchObject({ ok: true, anbieter: 'anthropic-vertex-eu' });
    z['anthropic-vertex-eu'] = { eingerichtet: true, zdr: false, register: 'archiviert' };
    expect(anbieterWaehlen({ faehigkeit: 'text', kategorien: ['familie'], zustand: z })).toMatchObject({ ok: false, grund: 'avv-offen' });
  });
  it('eigene Reihenfolge „Vertex zuerst“: fällt Vertex aus, nie zurück auf das schwächere Anthropic direkt', () => {
    const route: AnbieterId[] = ['anthropic-vertex-eu', 'anthropic'];
    const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: ['crm'], zustand: ZUSTAND_ALLE(), route, ausgefallen: ['anthropic-vertex-eu'] });
    expect(w).toMatchObject({ ok: false, grund: 'anbieter-ausgefallen' });
    const z = ZUSTAND_ALLE(); z['anthropic-vertex-eu'] = { eingerichtet: false, zdr: false, register: 'bestaetigt' };
    expect(anbieterWaehlen({ faehigkeit: 'text', kategorien: ['crm'], zustand: z, route }).ok).toBe(false);
  });
  it('Rückfall in eine STÄRKERE Stufe ist erlaubt (Anthropic ausgefallen → Vertex EU)', () => {
    const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: ['crm'], zustand: ZUSTAND_ALLE(), ausgefallen: ['anthropic'] });
    expect(w).toMatchObject({ ok: true, anbieter: 'anthropic-vertex-eu', rueckfall: true });
  });
  it('AVV: neue Anbieter nur mit bestätigtem AVV; Anthropic direkt (Bestand) nur im Modus „streng“', () => {
    const z = ZUSTAND_ALLE({ register: 'avv-offen' });
    expect(anbieterWaehlen({ faehigkeit: 'text', kategorien: ['crm'], zustand: z })).toMatchObject({ ok: true, anbieter: 'anthropic' });
    expect(anbieterWaehlen({ faehigkeit: 'text', kategorien: ['crm'], zustand: z, streng: true })).toMatchObject({ ok: false, grund: 'avv-offen' });
    expect(anbieterWaehlen({ faehigkeit: 'bild', kategorien: ['allgemein'], zustand: z })).toMatchObject({ ok: false, grund: 'avv-offen' });
  });
  it('Medien-Zugänge nehmen nur „allgemein“/„web“ — keine CRM- oder Gesundheitsdaten', () => {
    expect(anbieterWaehlen({ faehigkeit: 'bild', kategorien: ['crm'], zustand: ZUSTAND_ALLE() })).toMatchObject({ ok: false, grund: 'kategorie-nicht-erlaubt' });
    expect(anbieterWaehlen({ faehigkeit: 'bild', kategorien: ['allgemein'], zustand: ZUSTAND_ALLE() })).toMatchObject({ ok: true, anbieter: 'google-vertex' });
  });
  it('jeder Katalog-Zugang hat Routen, Empfänger im Register und Hosts nur über https', () => {
    for (const a of KI_ANBIETER) {
      expect(EMPFAENGER_START.some(e => e.id === a.empfaengerId), a.id).toBe(true);
      expect(Object.values(ROUTEN).some(r => r.includes(a.id)), a.id).toBe(true);
    }
    expect(hostErlaubt('anthropic-vertex-eu', 'https://aiplatform.eu.rep.googleapis.com/v1/x')).toBe(true);
    expect(hostErlaubt('anthropic-vertex-eu', 'https://us-central1-aiplatform.googleapis.com/v1/x')).toBe(false); // nie außerhalb der EU
    expect(hostErlaubt('google-vertex', 'http://aiplatform.googleapis.com/')).toBe(false);
    expect(hostErlaubt('mistral', 'https://api.mistral.ai/v1/audio/transcriptions')).toBe(false); // nur der EU-Endpunkt
    expect(hostErlaubt('mistral', 'https://api.eu.mistral.ai/v1/audio/transcriptions')).toBe(true);
    expect(hostErlaubt('anthropic', 'https://evil.example/@api.anthropic.com')).toBe(false);
  });
});

describe('Modelle, Stufen, Preise', () => {
  afterEach(() => { delete process.env.MAKE_OS_KI_STUFEN; delete process.env.MAKE_OS_KI_MODELL_SCHNELL; });
  it('jede Zeile trägt Stand und Quelle; keine Personennamen im Katalog', () => {
    for (const m of MODELLE) { expect(m.stand, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(m.quelle.length, m.id).toBeGreaterThan(10); }
    // Plattform-Regel: die DATEN des Katalogs nennen keine Personen und keine festen Firmen der Instanz (Kommentare zitieren Entscheidungen).
    const daten = JSON.stringify(MODELLE) + JSON.stringify(KI_ANBIETER.map(a => ({ ...a, hosts: a.hosts.map(String) })));
    expect(daten).not.toMatch(/\b(Kevin|Malin|Dieckmann|KEMARIS|POINCAP)\b/);
  });
  it('Vorgabe „bisher“ = Stand vor dem Paket; „neu“ = 5.5; Umgebung schlägt Einstellung; Einzelstufe nur aus dem Katalog', () => {
    expect(STUFEN_VORGABE).toBe('bisher');
    expect(stufenModelle({})).toEqual({ schnell: 'claude-haiku-4-5-20251001', ausgewogen: 'claude-sonnet-5', stark: 'claude-opus-5-5' });
    expect(stufenModelle({}, 'neu')).toEqual(STUFEN_SAETZE.neu);
    expect(stufenModelle({ MAKE_OS_KI_STUFEN: 'bisher' }, 'neu')).toEqual(STUFEN_SAETZE.bisher);
    expect(stufenModelle({ MAKE_OS_KI_MODELL_SCHNELL: 'claude-haiku-5-5' }).schnell).toBe('claude-haiku-5-5');
    expect(stufenModelle({ MAKE_OS_KI_MODELL_SCHNELL: 'gpt-irgendwas' }).schnell).toBe('claude-haiku-4-5-20251001');
    expect(STUFE_JE_ROLLE).toEqual({ mitarbeiter: 'schnell', head: 'ausgewogen', review: 'stark' });
  });
  it('MODEL_BY_TIER folgt dem wirksamen Satz (Getter)', async () => {
    const { MODEL_BY_TIER, _modellStufenSetzen } = await import('@/lib/agent-config');
    _modellStufenSetzen(null);
    expect(MODEL_BY_TIER.schnell).toBe('claude-haiku-4-5-20251001');
    _modellStufenSetzen('neu');
    expect(MODEL_BY_TIER.ausgewogen).toBe('claude-sonnet-5-5');
    process.env.MAKE_OS_KI_STUFEN = 'bisher';
    expect(MODEL_BY_TIER.ausgewogen).toBe('claude-sonnet-5');
    expect('stark' in MODEL_BY_TIER).toBe(true);
    _modellStufenSetzen(null);
  });
  it('Preise: 5.5 im Katalog, Haiku-Staffel, unbekanntes Modell = teuerster der Fähigkeit, Vertex EU +10 %', () => {
    expect(kostenUsdCent('claude-haiku-5-5', { 'token-ein': 50_000, 'token-aus': 1e6 })).toBeCloseTo(50.5, 6); // bis 100k Prompt: 0,10/0,50 $
    expect(kostenUsdCent('claude-haiku-5-5', { 'token-ein': 200_000 })).toBeCloseTo(10, 6); // über 100k: 0,50 $/Mio
    expect(kostenUsdCent('claude-sonnet-5-5', { 'token-ein': 1e6 }, { anbieter: 'anthropic-vertex-eu' })).toBeCloseTo(220, 6);
    expect(preiseFuer('claude-unbekannt')['token-aus']).toBe(25);
    expect(preiseFuer('bild-unbekannt', 'bild')['bild@4k']).toBe(0.24);
    expect(vertexModellId('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5@20251001');
    expect(vertexModellId('claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
  });
  it('Schätzung in Euro: Bild ~3 ct, Video nach Sekunden, „ca.“ bei geschätzten Preisen', () => {
    const kurs = usdEurKurs({});
    expect(kurs).toBe(USD_EUR_VORGABE);
    expect(usdEurKurs({ MAKE_OS_KI_USD_EUR: '0,9' })).toBe(0.9);
    const b = kostenSchaetzen({ faehigkeit: 'bild', modell: 'gemini-nano-banana-2.1' }, 1);
    expect(b.euroCent).toBeCloseTo(3.4, 6);
    expect(b.ca).toBe(false);
    const v = kostenSchaetzen({ faehigkeit: 'video', modell: 'veo-3.1-generate-001', sekunden: 8 }, 1);
    expect(v.euroCent).toBeCloseTo(320, 6);
    expect(kostenSchaetzen({ faehigkeit: 'video', modell: 'gemini-omni-1.1-flash', sekunden: 10 }, 1).text).toBe('ca. 1,50 €');
    expect(euroText(0.4)).toBe('< 0,01 €');
  });
});

describe('Kosten, Klick, Budget (rein)', () => {
  const ohne = { monatGrenzeCent: null, verbrauchtCent: 0, auftragGrenzeCent: GRENZE_AUFTRAG_VORGABE_CENT };
  it('Video und Tiefenbericht nur mit bestätigter Schätzung; teurer als bestätigt → erneut fragen', () => {
    const s = kostenSchaetzen({ faehigkeit: 'video', modell: 'veo-3.1-generate-001', sekunden: 8 }, 1);
    expect(kostenPruefen({ budget: ohne, faehigkeit: 'video', schaetzung: s })).toBe('kosten-rueckfrage');
    expect(kostenPruefen({ budget: ohne, faehigkeit: 'video', schaetzung: s, bestaetigtCent: 100 })).toBe('kosten-rueckfrage');
    expect(kostenPruefen({ budget: ohne, faehigkeit: 'video', schaetzung: s, bestaetigtCent: 320 })).toBeNull();
    expect(kostenPruefen({ budget: ohne, faehigkeit: 'bild', schaetzung: kostenSchaetzen({ faehigkeit: 'bild', modell: 'gemini-nano-banana-2.1' }) })).toBeNull();
  });
  it('Grenze je Auftrag und Instanz-Budget wirken (zusätzlich zueinander)', () => {
    const s = kostenSchaetzen({ faehigkeit: 'video', modell: 'gemini-omni-1.1-flash', sekunden: 40, aufloesung: '1080p' }, 1); // 6 €
    expect(kostenPruefen({ budget: { ...ohne, auftragGrenzeCent: 500 }, faehigkeit: 'video', schaetzung: s, bestaetigtCent: 600 })).toBe('grenze-auftrag');
    expect(kostenPruefen({ budget: { monatGrenzeCent: 5000, verbrauchtCent: 5000, auftragGrenzeCent: 1000 }, faehigkeit: 'text' })).toBe('budget');
    expect(kostenPruefen({ budget: { monatGrenzeCent: 5000, verbrauchtCent: 4900, auftragGrenzeCent: 1000 }, faehigkeit: 'video', schaetzung: s, bestaetigtCent: 600 })).toBe('budget');
    expect(kostenPruefen({ budget: { monatGrenzeCent: 5000, verbrauchtCent: 4900, auftragGrenzeCent: 1000 }, faehigkeit: 'text' })).toBeNull();
  });
  it('budgetLage: Warnstufen 80/95/100, ohne Grenze nur messen', () => {
    expect(budgetLage({ monatGrenzeCent: null, verbrauchtCent: 1234 })).toMatchObject({ stufe: 0, grenzeCent: null, prozent: null });
    expect(budgetLage({ monatGrenzeCent: 5000, verbrauchtCent: 3999 }).stufe).toBe(0);
    expect(budgetLage({ monatGrenzeCent: 5000, verbrauchtCent: 4000 }).stufe).toBe(80);
    expect(budgetLage({ monatGrenzeCent: 5000, verbrauchtCent: 4750 }).stufe).toBe(95);
    expect(budgetLage({ monatGrenzeCent: 5000, verbrauchtCent: 5000 })).toMatchObject({ stufe: 100, text: '50,00 € von 50,00 € (100 %)' });
  });
  it('Register-Zustand: archiviert, fehlt, AVV offen, bestätigt', () => {
    const l = EMPFAENGER_START.map(e => ({ ...e }));
    expect(registerZustand(l, 'google-vertex')).toBe('archiviert');
    expect(registerZustand(l, 'gibt-es-nicht')).toBe('fehlt');
    expect(registerZustand(l, 'anthropic')).toBe('avv-offen');
    expect(registerZustand(l.map(e => (e.id === 'anthropic' ? { ...e, avv: { status: 'bestaetigt' as const, am: '2026-10-09' } } : e)), 'anthropic')).toBe('bestaetigt');
  });
});

describe('Vertex-Adapter (rein)', () => {
  it('Körper: model raus, anthropic_version rein; Adresse je Region', () => {
    expect(fuerVertex({ model: 'claude-sonnet-5-5', max_tokens: 10, messages: [] })).toEqual({ anthropic_version: 'vertex-2023-10-16', max_tokens: 10, messages: [] });
    expect(vertexHost('eu')).toBe('aiplatform.eu.rep.googleapis.com');
    expect(vertexHost('europe-west4')).toBe('europe-west4-aiplatform.googleapis.com');
    expect(vertexClaudeUrl({ projekt: 'mein-projekt', claudeRegion: 'eu' }, 'claude-haiku-4-5-20251001')).toBe('https://aiplatform.eu.rep.googleapis.com/v1/projects/mein-projekt/locations/eu/publishers/anthropic/models/claude-haiku-4-5%4020251001:rawPredict');
  });
  it('Einrichtung: nur EU-Regionen, Dienstkonto nur mit Google-Token-Adresse, ohne Umgebung aus', () => {
    expect(istEuRegion('eu')).toBe(true);
    expect(istEuRegion('europe-west3')).toBe(true);
    expect(istEuRegion('us-central1')).toBe(false);
    expect(torModus({})).toBe('aus');
    expect(torModus({ MAKE_OS_KI_ANBIETER_TOR: 'an' })).toBe('an');
    for (const id of ['anthropic-vertex-eu', 'google-vertex', 'mistral'] as const) expect(anbieterEingerichtet(id, {})).toBe(false);
    const fremd = Buffer.from(JSON.stringify({ type: 'service_account', client_email: 'x@y.iam.gserviceaccount.com', private_key: '-- PRIVATE KEY --', token_uri: 'https://boese.example/token' })).toString('base64');
    expect(dienstkontoAus({ GOOGLE_VERTEX_DIENSTKONTO: fremd })).toBeNull();
  });
});

describe('Kennzeichnung (KI-VO Art. 50)', () => {
  it('kiKennzeichen nennt den tatsächlichen Anbieter; ohne Angabe Anthropic; alte Aufrufform bleibt gültig', () => {
    expect(kiKennzeichen().durch).toBe('ZOE (KI-Modell von Anthropic)');
    expect(kiKennzeichen(new Date('2026-10-09T10:00:00Z')).zeit).toBe('2026-10-09T10:00:00.000Z');
    expect(kiKennzeichen({ anbieter: 'anthropic-vertex-eu', modell: 'claude-sonnet-5-5' })).toMatchObject({ durch: 'ZOE (KI-Modell von Anthropic über Google Vertex (EU))', anbieter: 'anthropic-vertex-eu', modell: 'claude-sonnet-5-5' });
    expect(kiKennzeichen({ anbieter: 'quatsch' }).anbieter).toBe('anthropic');
  });
  it('sichtbares Zeichen nur bei realistischen Personen/Orten; Herkunftsangabe als zweite Schicht', () => {
    expect(sichtbaresZeichen({ realistisch: true, personen: true }).noetig).toBe(true);
    expect(sichtbaresZeichen({ realistisch: true, orte: true }).noetig).toBe(true);
    expect(sichtbaresZeichen({ realistisch: false, personen: true }).noetig).toBe(false);
    expect(sichtbaresZeichen({ realistisch: true }).noetig).toBe(false);
    expect(anbieterKennzeichnung('google-vertex')).toEqual({ synthid: true, c2pa: true });
    expect(herkunftsAngabe({ anbieter: 'google-vertex', modell: 'gemini-nano-banana-2.1', erzeugtAm: '2026-10-09T08:00:00Z', art: 'bild' })).toMatchObject({ ki_generiert: true, eingebettet: { synthid: true, c2pa: true } });
  });
  it('KI-Medien laufen nie durch den Exif-Säuberer (lib/netzwerken/bild-bereinigen.ts)', () => {
    const dateien = (d: string): string[] => readdirSync(d).flatMap(x => { const p = path.join(d, x); return statSync(p).isDirectory() ? dateien(p) : [p]; });
    for (const p of dateien(path.resolve(__dirname, '../lib/ki'))) expect(readFileSync(p, 'utf8'), p).not.toMatch(/(from|import\()\s*['"][^'"]*bild-bereinigen|bildBereinigen\(/);
  });
});

describe('Protokoll und Auskunft je Anbieter', () => {
  it('neue Felder werden gesäubert; Altbestand ohne Feld zählt als Anthropic', () => {
    const z = eintragSaeubern({ zweck: 'ki-bild', lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'], modell: 'gemini-nano-banana-2.1', ergebnis: 'ok', anbieter: 'google-vertex', faehigkeit: 'bild', region: 'global / us-central1 (Google)', stufe: 'dpf', kostenCent: 3.4 });
    expect(z).toMatchObject({ anbieter: 'google-vertex', faehigkeit: 'bild', stufe: 'dpf', kostenCent: 3 });
    expect(eintragSaeubern({ zweck: 'x', lauf: 'aufruf', person: null, kategorien: [], modell: 'm', ergebnis: 'ok', anbieter: 'boese' as never, stufe: 'egal' as never })).not.toHaveProperty('anbieter');
    const a = empfaengerAuskunft([
      { at: '2026-10-01T10:00:00Z', zweck: 'a', lauf: 'aufruf', person: 'lena', kategorien: ['crm'], modell: 'claude-sonnet-5', ergebnis: 'ok' },
      { ...z, at: '2026-10-02T10:00:00Z' },
    ]);
    expect(a.empfaengerJeAnbieter.map(x => x.anbieter).sort()).toEqual(['anthropic', 'google-vertex']);
    expect(a.empfaenger).toMatch(/Anthropic/);
    expect(a.empfaenger).toMatch(/Google Cloud/);
    expect(empfaengerAuskunft([]).empfaenger).toBe(KI_EMPFAENGER);
    expect(KI_EMPFAENGER).not.toMatch(/Data Privacy Framework/);
    expect(otelAttribute(z)).toMatchObject({ 'gen_ai.provider.name': 'google-vertex', 'gen_ai.operation.name': 'generate_content', 'gen_ai.request.model': 'gemini-nano-banana-2.1' });
  });
});

describe('Register: SCC statt DPF, Hebung nur unveränderter Altfassungen', () => {
  const ALT_ANTHROPIC: Empfaenger = { id: 'anthropic', name: 'Anthropic (KI, ZOE)', rolle: 'auftragsverarbeiter', zweck: 'KI-Auswertung und Entwürfe (ZOE, Heads, automatische Läufe) — nur gekapselte Arbeitsfelder', daten: 'Ausschnitte', drittland: 'USA', garantie: 'dpf-scc', dritte: true, avv: { status: 'offen' }, notiz: 'Data Processing Addendum der kommerziellen Bedingungen (API) — Annahme mit Tag und Unterlage hier bestätigen.', start: true };
  it('Vorgabe: Anthropic mit SCC; neue Anbieter archiviert und gültig', () => {
    const a = EMPFAENGER_START.find(e => e.id === 'anthropic')!;
    expect(a.garantie).toBe('scc');
    expect(a.drittland).toBe(ANTHROPIC_DRITTLAND);
    for (const id of ['google-vertex', 'mistral']) {
      const e = EMPFAENGER_START.find(x => x.id === id)!;
      expect(e.archiviert, id).toBe(true);
      expect(empfaengerPruefen(e).ok, id).toBe(true);
    }
  });
  it('unveränderte alte Fassung wird gehoben — auch wenn der AVV inzwischen bestätigt ist (anderes Feld)', () => {
    const l = empfaengerHeben([{ ...ALT_ANTHROPIC, avv: { status: 'bestaetigt', am: '2026-10-01' } }]);
    expect(l[0]).toMatchObject({ garantie: 'scc', drittland: ANTHROPIC_DRITTLAND, avv: { status: 'bestaetigt', am: '2026-10-01' } });
  });
  it('was die Instanz selbst geändert hat, bleibt', () => {
    const eigen = { ...ALT_ANTHROPIC, garantie: 'pruefen' as const, drittland: 'USA (eigene Angabe)', notiz: 'Eigene Notiz' };
    const l = empfaengerHeben([eigen]);
    expect(l[0]).toEqual(eigen);
    expect(empfaengerHeben([eigen])).toEqual([eigen]);
    const schon = EMPFAENGER_START.map(e => ({ ...e }));
    expect(empfaengerHeben(schon)).toBe(schon); // nichts zu tun → dieselbe Liste
  });
  it('gespeicherte Listen bekommen die neuen Anbieter (archiviert) nachgetragen; Vorgabe-Liste unverändert', () => {
    const l = empfaengerNachtragen([ALT_ANTHROPIC]);
    expect(l.map(e => e.id)).toEqual(['anthropic', 'google-vertex', 'mistral']);
    expect(l.slice(1).every(e => e.archiviert)).toBe(true);
    expect(empfaengerWirksam({ empfaenger: [ALT_ANTHROPIC] })[0].garantie).toBe('scc');
    expect(empfaengerWirksam(null).length).toBe(EMPFAENGER_START.length);
  });
  it('Verzeichnis: vv-ki und reine Anthropic-Sätze werden gehoben, Handarbeit bleibt, vv-ki-anbieter nur mit eingerichtetem Zugang', () => {
    const J = '2026-10-09T10:00:00.000Z';
    const vvAlt = { ...verarbeitungKi(J), empfaenger: 'Anthropic PBC, San Francisco (USA) — KI-Modell (Drittland; EU-US Data Privacy Framework bzw. Standardvertragsklauseln) als Auftragsverarbeiter; Web-Suche nur, wenn eingeschaltet', drittland: 'USA — EU-US Data Privacy Framework bzw. Standardvertragsklauseln (Anthropic); Telegram nur für neutrale Hinweise (Inhalte nur mit ausdrücklicher Ausnahme der Person)' };
    const neu = verarbeitungKiNachtragen([vvAlt], J);
    expect(neu[0].drittland).not.toMatch(/Data Privacy Framework bzw/);
    expect(neu[0].empfaenger).not.toMatch(/Data Privacy Framework/);
    const hand = { ...vvAlt, drittland: 'eigene Angabe' };
    expect(verarbeitungKiNachtragen([hand], J)[0].drittland).toBe('eigene Angabe');
    const fertig = verarbeitungKiNachtragen([], J);
    expect(verarbeitungKiNachtragen(fertig, J)).toBe(fertig); // gleiche Referenz = nichts zu tun
    expect(fertig.some(v => v.id === VV_KI_ANBIETER)).toBe(false);
    const mit = verarbeitungKiNachtragen(fertig, J, ['anthropic', 'mistral']);
    expect(mit.find(v => v.id === VV_KI_ANBIETER)?.empfaenger).toMatch(/Mistral/);
    expect(mit.find(v => v.id === VV_KI)).toBeTruthy();
    // Startbestand und ZOE (lib/crm/datenschutz.ts): unverändert gehoben, idempotent
    const start = verarbeitungenStart(J).map(v => ({ ...v, drittland: 'Anthropic (USA) nur für KI-Auswertung: Standardvertragsklauseln / Data Privacy Framework — prüfen' }));
    expect(alteFassungenHeben(start).every(v => /nicht im EU-US Data Privacy Framework/.test(v.drittland))).toBe(true);
    const voll = verzeichnisVervollstaendigen([], J).liste;
    expect(voll.find(v => v.id === 'vv-zoe')?.drittland).toMatch(/Standardvertragsklauseln/);
    expect(verzeichnisVervollstaendigen(voll, J).geaendert).toBe(false);
  });
});

describe('Wortfehlerrate und Stufen-Vergleich (rein)', () => {
  it('WER zählt Ersetzungen, Auslassungen, Einfügungen nach Normalisierung', () => {
    expect(wortfehlerrate('Guten Morgen, Frau Muster!', 'guten morgen frau muster').wer).toBe(0);
    const w = wortfehlerrate('der Termin ist am Montag', 'der Termin war Montag früh');
    expect(w.woerter).toBe(5);
    expect(w.ersetzt + w.ausgelassen + w.eingefuegt).toBe(3);
    expect(w.wer).toBeCloseTo(3 / 5, 6);
    expect(wortfehlerrate('eins zwei drei', 'eins drei')).toMatchObject({ ausgelassen: 1, ersetzt: 0, eingefuegt: 0 });
    expect(wortfehlerrate('eins drei', 'eins zwei drei')).toMatchObject({ eingefuegt: 1, ersetzt: 0, ausgelassen: 0 });
    expect(werGesamt([w, wortfehlerrate('a b', 'a b')])).toBeCloseTo(3 / 7, 6);
  });
  it('Empfehlung: zu wenige Fälle, schlechter, oder umstellen', () => {
    const fall = (alle: boolean): Bewertung => ({ punkte: ['ids', 'kanal', 'vollzug', 'zahlen', 'umfang', 'frist', 'belege', 'signal', 'entwurf'].map(id => ({ id, label: id, bestanden: alle || id !== 'frist' })), bestanden: alle ? 9 : 8, von: 9 });
    const gut = Array.from({ length: 6 }, () => [fall(true)]);
    const schlecht = Array.from({ length: 6 }, () => [fall(false)]);
    expect(stufenVergleichen({ faelle: gut.slice(0, 2), kostenCent: 10, fehler: 0 }, { faelle: gut.slice(0, 2), kostenCent: 5, fehler: 0 }).empfehlung).toBe('mehr-faelle');
    expect(stufenVergleichen({ faelle: gut, kostenCent: 10, fehler: 0 }, { faelle: schlecht, kostenCent: 1, fehler: 0 }).empfehlung).toBe('nicht-umstellen');
    const v = stufenVergleichen({ faelle: gut, kostenCent: 10, fehler: 0 }, { faelle: gut, kostenCent: 2, fehler: 0 });
    expect(v.empfehlung).toBe('umstellen');
    expect(v.grund).toMatch(/günstiger/);
  });
});

describe('Kein Schlüssel im Code, kein Anbieter-Host außerhalb der Adapter', () => {
  const WURZEL = path.resolve(__dirname, '..');
  const lauf = (d: string, raus: string[] = []): string[] => {
    for (const x of readdirSync(d)) {
      if (x === 'node_modules' || x.startsWith('.')) continue;
      const p = path.join(d, x);
      if (statSync(p).isDirectory()) lauf(p, raus); else if (/\.(ts|tsx|mjs|js|sh)$/.test(x)) raus.push(p);
    }
    return raus;
  };
  const dateien = ['lib', 'app', 'components', 'scripts', 'deploy'].filter(o => existsSync(path.join(WURZEL, o))).flatMap(o => lauf(path.join(WURZEL, o)));
  it('keine Schlüssel-Muster (Anthropic, Google, privater Schlüssel) in Code und Skripten', () => {
    const MUSTER = [/sk-ant-[A-Za-z0-9_-]{20,}/, /AIza[0-9A-Za-z_-]{30,}/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /ya29\.[0-9A-Za-z_-]{20,}/];
    const funde = dateien.filter(p => MUSTER.some(m => m.test(readFileSync(p, 'utf8')))).map(p => path.relative(WURZEL, p));
    expect(funde).toEqual([]);
  });
  it('lib/ki setzt keine Umgebungsvariablen und kennt keine Werte — nur Namen', () => {
    for (const p of lauf(path.join(WURZEL, 'lib/ki'))) expect(readFileSync(p, 'utf8'), p).not.toMatch(/process\.env\.[A-Z_]+\s*=[^=]/);
  });
  it('Vertex- und Mistral-Hosts nur in lib/ki (Adapter + Katalog)', () => {
    const fremd = dateien.filter(p => !p.includes(`${path.sep}lib${path.sep}ki${path.sep}`) && /aiplatform\.|mistral\.ai/.test(readFileSync(p, 'utf8'))).map(p => path.relative(WURZEL, p));
    expect(fremd).toEqual([]);
  });
});
