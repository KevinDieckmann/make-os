// ─── Einrichtung für einen „komplett neuen Kunden“: Neustart, je Person, Gesundheit komplett, Business online (09.10.) ─────────────────
// Kevin 09.10.: „Wir fangen bei 0 an … Wir sind ein komplett ‚neuer‘ Kunde und wollen als Paar geonboardet werden. Jeder für sich.“ —
// Nachtrag: erst Zugang, dann ALLES eingeben, dann die Schnittstellen, dann die Agenten. Wächter:
//   (1) Modus: ohne Marke bleibt alles, wie es war (dieselben Objekte); mit Marke (Datei oder Einstellung) der Neustart-Ablauf, kein Altbestand.
//   (2) Reihenfolge Zugang → eingeben → Schnittstellen → Agenten; der Kern sind Zugang + eingeben; Kosten, Kontostände, Kontoauszüge und offene
//       Posten sind Kern; Nummern eindeutig, Verweise in den Texten zeigen auf echte Nummern, keine Daten der gewachsenen Instanz.
//   (3) Je Person getrennt: eigene Ziele und Gesundheit nur für die Person selbst (Prüfung UND Häkchen); ein Konto „nur Business“ hat keine
//       Privat-Schritte und bekommt keine Privat-Befunde.
//   (4) Heute: die Karte bleibt, bis jeder nicht-optionale Schritt fertig ist.
//   (5) Der Plan „Business online“ legt über die echten Routen EINMAL an — ein zweiter Lauf nichts Doppeltes.
//   (6) Leere Instanz (nur Konten + Marke): keine Fehler, kein „nicht prüfbar“, kein Befund aus Altdaten.
// Eigener Datenordner, erfundene Konten und Werte — nie .data/, kein Modell, kein Netz.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-einrichtung-neu-'));
const DATEN = path.join(wurzel, 'daten');
process.env.MAKE_OS_DATEN_DIR = DATEN;
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-einrichtung-neu-0123456789';
process.env.MAKE_OS_ADRESSE = 'https://instanz-neu.example.invalid';
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DEMO', 'MAKE_OS_EINRICHTUNG', 'ANTHROPIC_API_KEY', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT']) delete process.env[k];
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const D = await import('@/lib/make-one/onboarding-data');
const { SCHRITTE, NEUSTART, NEUSTART_ETAPPEN, NEUSTART_ENTFAELLT, ABLAUF_NEUSTART, GRUPPEN_NEUSTART, schritteFuer, fassungFuer, neustartSchritte, neustartEtappeVon,
  fortschrittVon, istFertig, gruppeVon, samstagMinuten, nummernUmschreiben, schrittMitId, sichtbarFuer, istPrivatSchritt } = D;
type Schritt = import('@/lib/make-one/onboarding-data').Schritt;
const { pruefeAlles, kontextFuer, PERSOENLICHE_PRUEFUNGEN, ALLE_PRUEFUNGEN } = await import('@/lib/onboarding-status');
const { neustartAusText, neustartSatz } = await import('@/lib/onboarding-neustart');

const HAUS = 'haus-neu';
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp[0].toUpperCase()}${sp.slice(1)} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const KONTEN = { konten: [konto('k1', 'erste', 'inhaber'), konto('k2', 'zweite', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] };

const INHABER_N = { inhaber: true, haupt: true, eingeladen: false, personen: 3, privatFinanzen: true, altbestand: false, neustart: true };
const ZWEITE_N = { inhaber: false, haupt: false, eingeladen: true, personen: 3, privatFinanzen: true, altbestand: false, neustart: true };
const PARTNER_N = { ...ZWEITE_N, privatFinanzen: false, nurBusiness: true };
const INHABER_ALT = { ...INHABER_N, altbestand: true, neustart: false };

const ids = (l: readonly Schritt[]) => l.map(s => s.id);
const finde = (l: readonly Schritt[], id: string) => l.find(s => s.id === id)!;
const texte = (s: Schritt) => [s.titel, s.warum, ...s.wie, s.danach ?? ''].join(' \n ');
const lies = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8');
const MARKE = path.join(DATEN, 'system', 'neustart.json');
const markeSetzen = async (inhalt: unknown) => { await fs.mkdir(path.dirname(MARKE), { recursive: true }); await fs.writeFile(MARKE, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt)); };
const markeWeg = () => fs.rm(MARKE, { force: true });

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  await fs.mkdir(DATEN, { recursive: true });
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', KONTEN);
});

// ── (1)/(2) Daten ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Neustart-Ablauf (Daten, rein)', () => {
  it('ohne Neustart bleibt alles, wie es war: dieselben Objekte, keine Neustart-Schritte', () => {
    const alt = schritteFuer(INHABER_ALT);
    expect(alt.some(s => s.nurNeustart)).toBe(false);
    for (const s of SCHRITTE) expect(fassungFuer(s, INHABER_ALT)).toBe(s);
    for (const s of alt) expect(SCHRITTE).toContain(s);
    expect(alt.some(s => s.id === 'altbestand')).toBe(true);
  });

  it('Reihenfolge: Zugang → eigene Ziele → Gesundheit → gemeinsam → Finanzen → Business online → Schnittstellen → Agenten', () => {
    const l = schritteFuer(INHABER_N);
    const etappe = (id: string) => finde(l, id).etappe;
    const reihe = ['ich-zwei-faktor', 'ich-ziele', 'ich-koerper', 'jahresziele', 'ich-privatkonten', 'steckbrief', 'kartei', 'ich-icloud', 'agenten', 'hoi-gruen'];
    for (let i = 1; i < reihe.length; i++) expect(etappe(reihe[i]), `${reihe[i - 1]} vor ${reihe[i]}`).toBeGreaterThan(etappe(reihe[i - 1]));
    // Etappen-Reihenfolge der Liste selbst
    for (let i = 1; i < l.length; i++) expect(l[i].etappe).toBeGreaterThanOrEqual(l[i - 1].etappe);
    expect(NEUSTART_ETAPPEN.map(e => e.nr)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(NEUSTART_ETAPPEN.find(e => e.nr === 3)!.titel).toBe('Meine Gesundheit');
  });

  it('Kern = Zugang + alles eingeben; Schnittstellen, Agenten, Abschluss danach; Verbindungen nie im Kern', () => {
    for (const k of [INHABER_N, ZWEITE_N]) {
      const l = schritteFuer(k);
      for (const s of l.filter(x => x.samstag)) { expect(s.etappe, s.id).toBeGreaterThanOrEqual(1); expect(s.etappe, s.id).toBeLessThanOrEqual(7); }
      for (const s of l.filter(x => x.etappe >= 8)) expect(gruppeVon(s), s.id).toBe('spaeter');
      const verbindungen = ['whoop-app', 'google-app', 'ich-icloud', 'ich-google', 'ich-gmail', 'ich-postfaecher', 'kalender-zuordnen', 'ich-whoop', 'mail-umzug', 'whatsapp'];
      for (const s of l.filter(x => verbindungen.includes(x.id))) { expect(s.samstag, s.id).toBeFalsy(); expect(s.etappe, s.id).toBe(8); }
    }
    const l = schritteFuer(INHABER_N);
    for (const id of ['ich-privatkonten', 'privat-fixkosten', 'finanzplan', 'eroeffnung', 'kontostaende', 'offene-posten', 'finanzplan-business', 'konten-business', 'steckbrief', 'absender', 'produkte', 'kartei', 'angebot-entwurf', 'kampagne-start', 'powerhour', 'business-online'])
      expect(finde(l, id).samstag, id).toBe(true);
    for (const id of ['agenten', 'ich-zoe', 'brain']) expect(finde(l, id).etappe, id).toBe(9);
    expect(gruppeVon(finde(l, 'update'))).toBe('freitag');
  });

  it('Altbestand-Schritte entfallen oder ändern sich; Kartei heißt „sichten“, Stichtag „wählen“', () => {
    const l = schritteFuer(INHABER_N);
    for (const id of NEUSTART_ENTFAELLT) expect(ids(l), id).not.toContain(id);
    expect(finde(l, 'stichtag').titel).toBe('Stichtag des 0-Punkts wählen');
    expect(finde(l, 'kartei').titel).toMatch(/Übernommene Kartei sichten/);
    expect(finde(l, 'ich-privatkonten').titel).toMatch(/Kontoauszug hochladen/);
    expect(finde(l, 'selbststaendigkeit').titel).not.toMatch(/Januar bis September/);
  });

  it('Nummern eindeutig und passend zur Etappe; Verweise in Texten zeigen auf echte Nummern; keine Daten der gewachsenen Instanz', () => {
    const alle = neustartSchritte();
    expect(new Set(alle.map(s => s.nr)).size).toBe(alle.length);
    for (const s of alle) expect(s.nr.startsWith(`${s.etappe}.`), s.id).toBe(true);
    const nummern = new Set(alle.map(s => s.nr));
    for (const s of alle) {
      const t = texte(s);
      for (const m of t.matchAll(/Schritt (\d{1,2}\.\d{1,2}[a-z]?)|\((\d{1,2}\.\d{1,2}[a-z]?)\)/g)) expect(nummern.has(m[1] ?? m[2]), `${s.id}: ${m[0]}`).toBe(true);
      expect(t, s.id).not.toMatch(/01\.10\.2026|16\.10\.|08\.10\.|\bSamstag\b|\bFreitag\b|Altbestand|\b0\.5\b|Januar bis September/);
      expect(t, s.id).not.toMatch(/\b(Kevin|Malin)\b/);
    }
    for (const t of [...NEUSTART_ETAPPEN.flatMap(e => [e.titel, e.satz, ...(e.hinweise ?? []).flatMap(h => [h.titel, h.satz, h.wann])]), ...ABLAUF_NEUSTART.flatMap(a => [a.wann, a.was]), ...Object.values(GRUPPEN_NEUSTART).flatMap(g => [g.titel, g.satz])])
      expect(t).not.toMatch(/\b(Kevin|Malin)\b|01\.10\.2026|16\.10\./);
    // Datenschutz verweist auf die Kartei — im Neustart mit deren neuer Nummer.
    const kartei = finde(alle, 'kartei');
    expect(texte(finde(alle, 'datenschutz'))).toContain(`Schritt ${kartei.nr}`);
    // Daten und Mengen bleiben unangetastet.
    expect(nummernUmschreiben('am 08.10. · 1.000 Zeichen · Schritt 3.6', new Map([['3.6', '6.5'], ['8.1', 'x'], ['1.0', 'y']]))).toBe('am 08.10. · 1.000 Zeichen · Schritt 6.5');
  });

  it('ehrlich: Google Drive nicht angebunden, keine Bank-Anbindung (nur Hinweis, kein Schritt)', () => {
    const hinweise = NEUSTART_ETAPPEN.flatMap(e => e.hinweise ?? []).map(h => `${h.titel} ${h.satz}`).join(' ');
    expect(hinweise).toMatch(/Google Drive/);
    expect(hinweise).toMatch(/Kontoauszug/);
    expect(hinweise).toMatch(/Konten-Register/);
    for (const s of neustartSchritte()) expect(s.id).not.toMatch(/finapi|bank|drive/i);
  });

  it('je Person: Ziele, Alltag und Gesundheit sind „ich“; Gesundheit ist eine eigene Etappe; jede Person hat ihre eigenen Schritte', () => {
    const l = schritteFuer(ZWEITE_N);
    const gesundheit = l.filter(s => s.etappe === 3);
    expect(ids(gesundheit)).toEqual(expect.arrayContaining(['ich-koerper', 'ich-ernaehrung', 'ich-sport', 'ich-gesundheit-routinen', 'ich-gesundheit-agent']));
    for (const s of gesundheit) expect(s.ebene, s.id).toBe('ich');
    // Der Schritt des Pakets „Auftrag an Agenten“: am Ende der Gesundheits-Schritte, im Kern, Prüfung unverändert.
    const agent = finde(l, 'ich-gesundheit-agent');
    expect(agent).toMatchObject({ samstag: true, pruefung: 'gesundheit-agent' });
    expect(gesundheit.filter(s => !s.optional).at(-1)?.id).toBe('ich-gesundheit-agent');
    expect(texte(agent)).toContain(`Schritt ${finde(l, 'ich-gesundheit').nr}`);
    for (const id of ['ich-ziele', 'ich-routinen', 'ich-arbeitsrahmen', 'ich-aufgaben']) expect(finde(l, id).etappe, id).toBe(2);
    // Einwilligung zuerst (Zugang), die Gesundheits-Schritte warten auf sie.
    expect(finde(l, 'ich-gesundheit').etappe).toBe(1);
    for (const s of gesundheit.filter(x => x.nurNeustart)) expect(s.nach, s.id).toContain('ich-gesundheit');
    // Ein Schritt eines anderen Pakets (Gesundheit, „ich“, nicht in der Tabelle) landet ohne Umbau in „Meine Gesundheit“.
    expect(neustartEtappeVon({ etappe: 6, ebene: 'ich', modul: 'gesundheit' })).toBe(3);
    expect(neustartEtappeVon({ etappe: 6, ebene: 'gemeinsam', modul: 'familie' })).toBe(4);
    expect(neustartEtappeVon({ etappe: 2, ebene: 'ich', modul: 'kalender' })).toBe(8);
    expect(neustartEtappeVon({ etappe: 7, ebene: 'gemeinsam', modul: 'zoe' })).toBe(9);
  });

  it('Konto „nur Business“: keine Privat-Schritte (Gesundheit, Familie, eigene Ziele, Privat-Finanzen) — auch nicht abhakbar', () => {
    const l = schritteFuer(PARTNER_N);
    for (const s of l) expect(istPrivatSchritt(s), s.id).toBe(false);
    for (const id of ['ich-ziele', 'ich-koerper', 'ich-gesundheit', 'familie-menschen', 'ich-privatkonten', 'finanzplan']) expect(ids(l), id).not.toContain(id);
    expect(ids(l)).toEqual(expect.arrayContaining(['konten-business', 'angebot-entwurf', 'ich-zwei-faktor']));
    expect(sichtbarFuer(schrittMitId('ich-koerper')!, PARTNER_N)).toBe(false);
  });

  it('kein Kern-Schritt wartet auf einen späteren („danach“) — „Als Nächstes“ bleibt im Kern', () => {
    for (const k of [INHABER_N, ZWEITE_N]) {
      const l = schritteFuer(k);
      const nachher = new Set(l.filter(s => gruppeVon(s) === 'spaeter').map(s => s.id));
      for (const s of l.filter(x => x.samstag)) for (const v of s.nach ?? []) expect(nachher.has(v), `${s.id} → ${v}`).toBe(false);
    }
    // Jeder Eintrag der Tabelle ist ein Schritt.
    for (const e of NEUSTART) expect(schrittMitId(e.id), e.id).not.toBeNull();
  });

  it('Heute: die Karte bleibt, bis jeder nicht-optionale Schritt fertig ist — „Als Nächstes“ zuerst aus dem Kern', () => {
    const l = schritteFuer(ZWEITE_N);
    const fertig = (filter: (s: Schritt) => boolean) => {
      const befunde = Object.fromEntries(l.filter(s => s.pruefung && filter(s)).map(s => [s.pruefung!, { erfuellt: true, wert: 'x' }]));
      return { erledigt: Object.fromEntries(l.filter(filter).map(s => [s.id, { at: 'x', von: 'dir' }])), befunde };
    };
    const kernFertig = fertig(s => gruppeVon(s) !== 'spaeter');
    const f1 = fortschrittVon(l, kernFertig, { alle: true });
    expect(f1.fertig).toBeLessThan(f1.gesamt); // Schnittstellen offen → die Karte bleibt
    expect(f1.naechster?.spaeter).toBe(true); // der Kern ist durch — jetzt kommt „danach“
    expect(fortschrittVon(l, kernFertig).fertig).toBe(fortschrittVon(l, kernFertig).gesamt); // ohne `alle` wäre sie weg
    const alles = fertig(s => !s.optional);
    const f2 = fortschrittVon(l, alles, { alle: true });
    expect(f2.fertig).toBe(f2.gesamt); // Optionales hält die Karte nie auf
    const leer = fortschrittVon(l, { erledigt: {}, befunde: {} }, { alle: true });
    expect(leer.naechster?.samstag).toBe(true);
    expect(leer.gesamt).toBe(l.filter(s => !s.optional).length);
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain('fortschrittVon(meine, d.z, { alle: true, kernZuerst: !!d.ich.neustart })');
    expect(w).toContain('zurueckgefallen(meine, d.z)');
  });

  it('Dauer des Kerns je Person (ohne Optionales) — die Inhaberin mehr, weitere Personen deutlich weniger', () => {
    const inhaber = samstagMinuten(INHABER_N), zweite = samstagMinuten(ZWEITE_N), partner = samstagMinuten(PARTNER_N);
    expect(inhaber).toBeGreaterThan(zweite);
    expect(zweite).toBeGreaterThan(partner);
    expect(inhaber).toBeLessThanOrEqual(16 * 60);
    // Nur der persönliche Teil (Ebene „ich“) — das, was jede Person für sich braucht.
    const ich = (k: typeof INHABER_N) => schritteFuer(k).filter(s => s.samstag && !s.optional && s.ebene === 'ich').reduce((n, s) => n + s.minuten, 0);
    expect(ich(ZWEITE_N)).toBe(ich(INHABER_N)); // jede Person hat denselben eigenen Kern (die Konten kamen mit — keine Einladung)
    expect(ids(schritteFuer(ZWEITE_N))).not.toContain('zweite-einladung');
  });
});

// ── (1)/(3)/(6) Server ──────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Neustart am Server: Marke, leere Instanz, je Person getrennt', () => {
  beforeEach(async () => { await markeWeg(); delete process.env.MAKE_OS_EINRICHTUNG; });

  it('Marke lesen: Datei (auch unlesbar) oder Einstellung → Neustart, dann nie Altbestand; ohne Marke wie bisher', async () => {
    expect((await kontextFuer('erste'))).toMatchObject({ altbestand: true });
    expect((await kontextFuer('erste'))?.neustart).toBeUndefined();
    await markeSetzen({ am: '2026-10-09T08:00:00Z', zaehler: { kontakte: 3, aufgaben: 5, firmen: 1 }, geheim: 'nie-gelesen' });
    expect(await kontextFuer('erste')).toMatchObject({ neustart: true, altbestand: false });
    await markeSetzen('{ kaputt');
    expect((await kontextFuer('erste'))?.neustart).toBe(true);
    await markeWeg();
    process.env.MAKE_OS_EINRICHTUNG = 'neustart';
    expect((await kontextFuer('zweite'))?.neustart).toBe(true);
    expect(await kontextFuer('partner')).toMatchObject({ neustart: true, nurBusiness: true, privatFinanzen: false });
  });

  it('Marke rein: nur Tag und Zähler (≥ 0, gültige Namen), nie andere Felder', () => {
    const m = neustartAusText(JSON.stringify({ datum: '2026-10-09', zaehler: { kontakte: 412, aufgaben: 87, 'boese name': 3, minus: -1, text: 'x' }, notiz: 'Geheim' }));
    expect(m).toEqual({ am: '2026-10-09', zaehler: { kontakte: 412, aufgaben: 87 } });
    expect(neustartSatz(m)).toBe('Neustart vom 09.10.2026 · 412 Kontakte · 87 Aufgaben übernommen');
    expect(neustartSatz({ am: null, zaehler: { kontakte: 1 } })).toBe('Neustart · 1 Kontakt übernommen');
    expect(neustartAusText('nicht json')).toEqual({ am: null, zaehler: {} });
  });

  it('leere Instanz (nur Konten + Marke): kein Fehler, kein „nicht prüfbar“, kein Befund aus Altdaten, Neustart-Satz als Info', async () => {
    await markeSetzen({ am: '2026-10-09', zaehler: { kontakte: 3, aufgaben: 5 } });
    for (const p of ['erste', 'zweite', 'partner']) {
      const b = await pruefeAlles(p);
      for (const [k, v] of Object.entries(b)) expect(v.wert, `${p} ${k}`).not.toBe('nicht prüfbar');
      expect(b.altbestand, p).toBeUndefined();
      expect(JSON.stringify(b), p).not.toMatch(/Altbestand|01\.10\.2026/);
      expect(b.neustart, p).toEqual({ erfuellt: false, wert: 'Neustart vom 09.10.2026 · 3 Kontakte · 5 Aufgaben übernommen', leer: true });
      expect(b.posten?.leer, p).toBe(true); // gar kein offener Posten ist „nichts zu prüfen“, nicht „alles erledigt“
    }
    const erste = await pruefeAlles('erste');
    for (const k of ['ziele-ich', 'koerper', 'ernaehrung', 'sport', 'routinen-gesundheit']) expect(erste[k], k).toMatchObject({ erfuellt: false });
    for (const k of ['konten-business', 'angebote', 'business-vorlage']) expect(erste[k], k).toBeDefined();
    // Jede Kennung hat ihren Schritt und steht in den Listen (Ebene passt).
    for (const s of SCHRITTE.filter(x => x.nurNeustart && x.pruefung)) {
      expect(ALLE_PRUEFUNGEN, s.id).toContain(s.pruefung);
      expect((PERSOENLICHE_PRUEFUNGEN as readonly string[]).includes(s.pruefung!), s.id).toBe(s.ebene === 'ich');
    }
    // Die Einrichtung selbst: im Kern ist nichts ohne Arbeit fertig — außer dem, was mit den Konten mitkam (alle Konten da und im Haushalt).
    const k = await kontextFuer('erste');
    const vonSelbst = schritteFuer(k).filter(s => s.samstag && istFertig(s, { erledigt: {}, befunde: erste }));
    expect(ids(vonSelbst).sort()).toEqual(['einladen', 'haushalt']);
  });

  it('je Person getrennt: eigene Ziele und Gesundheit zählen nur für die Person selbst; „nur Business“ bekommt keinen dieser Befunde', async () => {
    await markeSetzen({ am: '2026-10-09' });
    const jahr = Number((await import('@/lib/zeit')).localDay().slice(0, 4));
    await db.saveJson('ziele-eigen--erste', { jahr: [{ id: 'z-eigen-1', titel: 'Geheimes eigenes Ziel', fortschritt: 0, space: 'privat', jahr }], fokus: {} });
    await db.saveJson('gesundheit-einwilligungen', { ereignisse: [{ zeit: '2026-10-09T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'erste' }] });
    await db.saveJson('gesundheit-koerper--erste', { v: 1, leitsatz: 'Geheimer Leitsatz', beschwerden: [], hebel: [], stufen: [], zusammenhaenge: [], hinweis: '', symptom: null, sauberZaehler: false, routinenHinweise: [] });
    await db.saveJson('sport--erste', { version: 1, einstieg: { fertig: true }, ziele: [{ id: 'sz-1' }] });
    await db.saveJson('ernaehrung', { profile: [{ person: 'erste', name: 'E', bedarf: 'Geheimer Bedarf', unvertraeglich: [], nie: [], gern: [], ziel: '', konto: true, stand: 'x' }] });
    await db.saveJson('routinen', { routinen: [{ id: 'r-1', label: 'Geheime Routine', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true, owner: 'erste' }] });
    try {
      const e = await pruefeAlles('erste'), z = await pruefeAlles('zweite'), p = await pruefeAlles('partner');
      for (const k of ['ziele-ich', 'koerper', 'ernaehrung', 'sport', 'routinen-gesundheit']) {
        expect(e[k]?.erfuellt, `erste ${k}`).toBe(true);
        expect(z[k]?.erfuellt, `zweite ${k}`).toBe(false);
        expect(p[k], `partner ${k}`).toBeUndefined();
      }
      expect(JSON.stringify([e, z, p])).not.toMatch(/Geheim/);
      // Widerruf der Einwilligung → das Körper-Profil zählt nicht mehr.
      await db.saveJson('gesundheit-einwilligungen', { ereignisse: [
        { zeit: '2026-10-09T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'erste' },
        { zeit: '2026-10-09T09:00:00Z', person: 'erste', zweck: 'verarbeiten', an: false, fassung: 'x', wortlaut: 'y', von: 'erste' },
      ] });
      expect((await pruefeAlles('erste')).koerper).toMatchObject({ erfuellt: false, wert: 'erst die Einwilligung (a) zur Gesundheit erklären' });
    } finally {
      for (const n of ['ziele-eigen--erste', 'gesundheit-einwilligungen', 'gesundheit-koerper--erste', 'sport--erste', 'ernaehrung', 'routinen']) await db.bestandEntfernen(n);
    }
  });

  it('Route: GET meldet den Neustart; Neustart-Schritte nur im Neustart abhakbar; Altbestand und „nur Business“ → 403', async () => {
    const { GET, POST } = await import('@/app/api/onboarding/route');
    const setze = (p: string, id: string) => POST(new Request('http://test/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': p }, body: JSON.stringify({ id, an: true }) }));
    expect((await setze('zweite', 'ich-ziele')).status).toBe(403); // ohne Marke gibt es den Schritt nicht
    await markeSetzen({ am: '2026-10-09' });
    const g = await (await GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': 'zweite' } }))).json() as { ich: { neustart?: boolean; altbestand?: boolean } };
    expect(g.ich).toMatchObject({ neustart: true, altbestand: false });
    expect((await setze('zweite', 'ich-ziele')).status).toBe(200);
    expect((await setze('erste', 'altbestand')).status).toBe(403);
    expect((await setze('partner', 'ich-koerper')).status).toBe(403);
    expect((await setze('partner', 'kampagne-start')).status).toBe(200);
    expect((await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding--zweite'))?.erledigt['ich-ziele']).toBeTruthy();
    expect((await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding'))?.erledigt['ich-ziele']).toBeUndefined();
  });
});

// ── (5) Plan „Business online“ ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Plan „Business online“: über die echten Routen, genau einmal', () => {
  it('feste Kennungen, Kette ohne Kreis, keine Namen im Code', async () => {
    const { businessOnlineFuer, BUSINESS_ONLINE_SCHRITTE, BUSINESS_ONLINE_PRAEFIX } = await import('@/lib/planung/vorlage-business-online');
    const a = businessOnlineFuer('ug', 'Probe GmbH', 'Probe GmbH', '2026-10-09'), b = businessOnlineFuer('ug', 'Probe GmbH', 'Probe GmbH', '2026-10-09');
    expect(a).toEqual(b);
    expect(a.ziel.id.startsWith(BUSINESS_ONLINE_PRAEFIX)).toBe(true);
    expect(a.meilensteine.length).toBe(BUSINESS_ONLINE_SCHRITTE.length);
    const keys = new Set(BUSINESS_ONLINE_SCHRITTE.map(s => s.key));
    BUSINESS_ONLINE_SCHRITTE.forEach((s, i) => { for (const w of s.wartetAuf) { expect(keys.has(w), w).toBe(true); expect(BUSINESS_ONLINE_SCHRITTE.findIndex(x => x.key === w), `${s.key} → ${w}`).toBeLessThan(i); } });
    const ohneKommentare = (t: string) => t.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
    const q = ohneKommentare(lies('lib/planung/vorlage-business-online.ts') + lies('components/os/BusinessOnlineVorlage.tsx') + lies('lib/planung/vorlage-anlegen.ts'));
    expect(q).not.toMatch(/\b(Kevin|Malin|kevin|malin)\b/);
    expect(q).not.toMatch(/KD Ventures|MAKE Innovation|Dieckmann/);
  });

  it('legt Ziel, Meilensteine und Aufgaben einmal an; ein zweiter Lauf legt nichts doppelt an; die Prüfung wird grün', async () => {
    await markeSetzen({ am: '2026-10-09' });
    const { businessOnlineFuer, businessOnlineZielId } = await import('@/lib/planung/vorlage-business-online');
    const { planVorlageAnlegen } = await import('@/lib/planung/vorlage-anlegen');
    const { BUSINESS_GESELLSCHAFTEN, einheitAusGesellschaft, finanzOrtName } = await import('@/lib/einheiten');
    const g = BUSINESS_GESELLSCHAFTEN[0];
    const ziele = await import('@/app/api/state/ziele/route');
    const ms = await import('@/app/api/state/meilensteine/route');
    const tasks = await import('@/app/api/tasks/create/route');
    const holen = async (pfad: string, init?: RequestInit): Promise<Response> => {
      const req = new Request(`http://test${pfad}`, { ...init, headers: { ...(init?.headers as Record<string, string> ?? {}), 'x-make-user': 'erste' } });
      const m = (init?.method ?? 'GET') as 'GET' | 'PATCH' | 'POST';
      const r = pfad === '/api/state/ziele' ? ziele : pfad === '/api/state/meilensteine' ? ms : pfad === '/api/tasks/create' ? tasks : null;
      const f = (r as Record<string, unknown> | null)?.[m] as ((q: Request) => Promise<Response>) | undefined;
      if (!f) throw new Error(`keine Route ${m} ${pfad}`);
      return f(req);
    };
    expect((await pruefeAlles('erste'))['business-vorlage']).toMatchObject({ erfuellt: false });
    const plan = businessOnlineFuer(g, finanzOrtName(g), einheitAusGesellschaft(g) ?? finanzOrtName(g), '2026-10-09');
    const erst = await planVorlageAnlegen(plan, holen);
    expect(erst).toMatchObject({ ziel: true, meilensteine: plan.meilensteine.length, aufgaben: plan.aufgaben.length, schonDa: 0 });
    const zweit = await planVorlageAnlegen(plan, holen);
    expect(zweit).toEqual({ ziel: false, meilensteine: 0, aufgaben: 0, schonDa: plan.aufgaben.length });
    const zd = await db.loadJson<{ jahr: { id: string }[] }>('ziele');
    expect(zd!.jahr.filter(z => z.id === businessOnlineZielId(g)).length).toBe(1);
    const md = await db.loadJson<{ meilensteine: { id: string; zielId?: string; wartetAuf?: string[] }[] }>('meilensteine');
    expect(md!.meilensteine.filter(m => m.zielId === businessOnlineZielId(g)).length).toBe(plan.meilensteine.length);
    const td = await db.loadJson<{ tasks: { title: string; listeId?: string }[] }>('tasks');
    expect(td!.tasks.filter(t => plan.aufgaben.some(a => a.titel === t.title)).length).toBe(plan.aufgaben.length);
    expect((await pruefeAlles('erste'))['business-vorlage']).toMatchObject({ erfuellt: true });
  });
});
