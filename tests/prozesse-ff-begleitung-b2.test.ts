// ─── Fulfillment in die Werkstatt — B2 „Galerie Fulfillment · Kunden-Begleitung“ (22.10.; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › B2) ──────────
// Neun Begleit-Vorlagen (FB1 … FB9) neben den 18 der Kundengewinnung — dieselbe Form, dieselbe Galerie, dieselbe Übernahme:
//   · rein: gültig (speicherbar + veröffentlichbar), ≤ 10 Schritte je Phase, benannte Ausgänge, Schloss vor jeder Nachricht/Einladung, keine Namen/Beträge/Firmen,
//     nur Bausteine, die nie in den Fall schreiben; Erinnerungsketten enden bei `kunde-geliefert`/`abstimmung-bestaetigt` (Warten mit Obergrenze + Raute auf
//     die Lage des Falls); Willkommensmail und Report bleiben im Fall; Erinnerungen nennen nur den vorhandenen Kunden-Link
//   · über die Routen (eigener Datenordner, erfundene Konten @example.invalid, kein Netz): Galerie je Sammlung, „Aus Vorlage“ → Probelauf; FB9 übergibt an V15
//   · Motor mit echtem Fall: jede Raute bekommt ihr Feld (aus der Cockpit-Zeile), `{{kunde.gruss}}` nach Du/Sie, Puls-Gespräch im Stapel → kein Check-in doppelt
//   · Gold: Probelauf aller neun (Beispiel UND echter Fall) — nichts geschrieben, Fall und Paket Byte für Byte gleich
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-begleitung-b2-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-begleitung-b2';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { BEGLEIT_VORLAGEN } from '@/lib/prozesse/begleitung/vorlagen';
import { ALLE_VORLAGEN, KUNDENGEWINNUNG_VORLAGEN, vorlageKurz, vorlageVon, vorlagenDerGruppe } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { vorlagenFiltern, galerieBereiche, VORLAGEN_GRUPPEN } from '@/lib/prozesse/kundengewinnung/galerie';
import { istVorlageRef, vorlageAusRef, type KgVorlage } from '@/lib/prozesse/kundengewinnung/bau';
import { definitionPruefen, laufFremd, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from '@/lib/prozesse/definition-pruefen';
import { kantenVon, alleSchritte, schloesser, phasen, schritteDer, flussPruefen, startKnoten } from '@/lib/prozesse/fluss';
import { schlossFehlt } from '@/lib/prozesse/schloss';
import { ROLLEN_WERTE, POSTFACH_WERTE, GESELLSCHAFT_DES_FALLS, type AuswahlQuelle } from '@/lib/prozesse/baustein-katalog';
import { VORSCHLAG_ARTEN } from '@/lib/zoe/crm-vorschlag';
import { STUFEN } from '@/lib/crm/pipeline';
import { BUSINESS_GESELLSCHAFTEN } from '@/lib/einheiten';
import { PROZESS_EREIGNISSE, DATUMS_FELDER, FALL_FELDER } from '@/lib/prozesse/ausloeser';
import { PROZESS_GRENZEN } from '@/lib/prozesse/definition';
import { kundenGruss } from '@/lib/fulfillment/kunde/bild';

const VORLAGEN_IDS = new Set(ALLE_VORLAGEN.map(v => v.id));
const kontext = (): PruefKontext => {
  const listen: Partial<Record<AuswahlQuelle, string[]>> = {
    'team-person': ['t-probe-eins', ...ROLLEN_WERTE.map(r => r.id)], 'konto-person': ['probe-eins'], 'pipeline-stufe': STUFEN.map(s => s.id), postfach: POSTFACH_WERTE.map(p => p.id),
    gesellschaft: [...BUSINESS_GESELLSCHAFTEN, GESELLSCHAFT_DES_FALLS], head: ['sales', 'marketing', 'event', 'kundenerfolg'], ereignis: [...PROZESS_EREIGNISSE], datumsfeld: DATUMS_FELDER.map(x => x.id),
  };
  return {
    team: [{ id: 't-probe-eins', aktiv: true, speicher: 'probe-eins' }], konten: ['probe-eins'], auswahl: q => listen[q] ?? null, vorschlagArten: VORSCHLAG_ARTEN,
    prozess: id => (istVorlageRef(id) && VORLAGEN_IDS.has(vorlageAusRef(id)) ? { titel: vorlageAusRef(id), veroeffentlicht: true } : null),
  };
};
/** Bausteine, die eine Begleit-Vorlage nutzen darf — keiner schreibt in den Fall, legt Geld an oder löscht. */
const ERLAUBT = new Set(['ausloeser.ereignis', 'ausloeser.datum', 'inbox.mail-entwurf', 'kalender.einladung', 'aufgabe.anlegen', 'glocke.melden', 'warten.ereignis', 'entscheidung.regel', 'entscheidung.mensch', 'freigabe.stapel', 'ende.ziel', 'ende.abbruch', 'ende.uebergabe']);
const BEGLEIT_EREIGNISSE = new Set(['fall-haengt', 'fall-phase', 'fall-wartet-kunde', 'abstimmung-bestaetigt', 'kunde-geliefert', 'ziel-erreicht']);

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Die Sammlung „Fulfillment · Kunden-Begleitung“', () => {
  it('neun Vorlagen FB1 … FB9 neben den 18 der Kundengewinnung (die bleiben unverändert 18)', () => {
    expect(BEGLEIT_VORLAGEN.map(v => v.nr)).toEqual(Array.from({ length: 9 }, (_, i) => `FB${i + 1}`));
    expect(new Set(BEGLEIT_VORLAGEN.map(v => v.id)).size).toBe(9);
    expect(KUNDENGEWINNUNG_VORLAGEN).toHaveLength(18);
    expect(ALLE_VORLAGEN).toHaveLength(27);
    expect(vorlagenDerGruppe('begleitung').map(v => v.id)).toEqual(BEGLEIT_VORLAGEN.map(v => v.id));
    expect(vorlagenDerGruppe('kundengewinnung')).toHaveLength(18);
    expect(vorlageVon('fb-01')?.titel).toMatch(/Unterlagen/);
    for (const v of BEGLEIT_VORLAGEN) expect(vorlageKurz(v).gruppe).toBe('begleitung');
    expect(vorlageKurz(KUNDENGEWINNUNG_VORLAGEN[0]).gruppe).toBe('kundengewinnung');
  });
  it('Galerie: Sammlung filtert, Bereich „Fulfillment“ für die Begleitung; ohne Sammlung wie bisher', () => {
    const kurz = ALLE_VORLAGEN.map(vorlageKurz);
    expect(vorlagenFiltern(kurz, { bereich: 'alle', art: 'alle', gruppe: 'begleitung' })).toHaveLength(9);
    expect(vorlagenFiltern(kurz, { bereich: 'alle', art: 'alle', gruppe: 'kundengewinnung' })).toHaveLength(18);
    expect(vorlagenFiltern(kurz, { bereich: 'alle', art: 'alle' })).toHaveLength(27);
    expect(galerieBereiche(vorlagenFiltern(kurz, { bereich: 'alle', art: 'alle', gruppe: 'begleitung' })).map(b => b.titel)).toEqual(['Fulfillment']);
    expect(VORLAGEN_GRUPPEN.map(g => g.label)).toEqual(['Kundengewinnung', 'Fulfillment · Kunden-Begleitung']);
  });
  it('Grußzeile nach Du/Sie aus der Akte — ohne Namen nur der Gruß', () => {
    expect(kundenGruss('du', 'Testa', 'Probe')).toBe('Hallo Testa');
    expect(kundenGruss('sie', 'Testa', 'Probe')).toBe('Guten Tag Testa Probe');
    expect(kundenGruss('sie')).toBe('Guten Tag');
    expect(kundenGruss('du', ' ')).toBe('Hallo');
  });
});

describe.each(BEGLEIT_VORLAGEN.map(v => [v.nr, v] as const))('%s', (_nr, v: KgVorlage) => {
  const d = v.definition;
  const schritte = alleSchritte(d).map(x => x.schritt);
  it('speicherbar und veröffentlichbar (keine Befunde „fehler“ oder „offen“), nichts offen', () => {
    const b = definitionPruefen(d, kontext());
    expect(sperrtSpeichern(b), b.filter(x => x.stufe === 'fehler').map(x => x.text).join(' | ')).toBe(false);
    expect(sperrtVeroeffentlichen(b), b.filter(x => x.stufe !== 'hinweis').map(x => x.text).join(' | ')).toBe(false);
    expect(v.offen).toEqual([]);
    expect(v.teile).toEqual([]);
  });
  it('Steckbrief: Fulfillment, Fall Mandat, Kundenerfolg, Start-/Endkriterium, Recht, Kennzahlen — kein Eigner als Person', () => {
    expect(d).toMatchObject({ bereich: 'fulfillment', fallArt: 'mandat' });
    expect(d.eigner).toBeUndefined();
    expect(v.eignerRolle).toBe('kundenerfolg');
    expect(v.gruppe).toBe('begleitung');
    expect((d.startKriterium ?? '').length).toBeGreaterThan(10);
    expect((d.endKriterium ?? '').length).toBeGreaterThan(10);
    expect(v.zweck.length).toBeGreaterThan(40);
    expect(v.recht.length).toBeGreaterThan(0);
    expect(v.kennzahlen.length).toBeGreaterThan(0);
    expect(d.herkunft?.quelleIds).toEqual([d.id]);
  });
  it(`Gliederung: höchstens ${PROZESS_GRENZEN.schritteHinweis} Schritte je Phase, kein Hinweis „Teilprozess bilden?“`, () => {
    for (const p of phasen(d)) expect(schritteDer(d, p.id).length, p.titel).toBeLessThanOrEqual(PROZESS_GRENZEN.schritteHinweis);
    expect(flussPruefen(d, PROZESS_GRENZEN.schritteHinweis).filter(b => b.stufe !== 'hinweis' || /Teilprozess/.test(b.text))).toEqual([]);
  });
  it('benannte Ausgänge: jede Raute hat einen Nein-Zweig, jeder Weg endet an einem Ende', () => {
    for (const k of schritte.filter(x => x.form === 'entscheidung')) expect(k.zweige?.nein, `${k.id} ohne Nein-Zweig`).toBeTruthy();
    const nach = new Map(d.knoten.map(k => [k.id, k]));
    expect(kantenVon(d).filter(x => x.nach === null && (x.ausgang === 'weiter' || x.ausgang === 'ja') && nach.get(x.von)?.form !== 'ende').map(x => x.von)).toEqual([]);
  });
  it('Schloss hinter jeder Nachricht und Einladung (nach der EINEN Regel); nur Bausteine, die nie in den Fall schreiben', () => {
    expect(schlossFehlt(d, { laufFremd: laufFremd(d) })).toBe(false);
    const s = schloesser(d.knoten);
    for (const k of schritte) {
      expect(ERLAUBT.has(k.katalog?.id ?? ''), `${k.id}: ${k.katalog?.id}`).toBe(true);
      if (k.katalog?.id === 'inbox.mail-entwurf' || k.katalog?.id === 'kalender.einladung') expect(s.has(k.id), k.id).toBe(true);
    }
  });
  it('Auslöser: Ereignisse des Falls bzw. der nächste Termin; Bedingungen nur auf Ereignis und Fall', () => {
    const st = startKnoten(d);
    expect(st.length).toBe(1);
    const a = st[0].ausloeser!;
    if (a.art === 'ereignis') expect(BEGLEIT_EREIGNISSE.has(a.ereignis), a.ereignis).toBe(true);
    else expect(a).toMatchObject({ art: 'datum', feld: 'fall.termin' });
    for (const b of a.art === 'ereignis' || a.art === 'datum' ? a.bedingungen ?? [] : []) expect(b.feld).toMatch(/^(ereignis|fall)\./);
  });
  it('Erinnerungsketten enden bei der Lieferung bzw. Bestätigung: Warten mit Obergrenze, danach eine Raute auf die Lage des Falls', () => {
    const warten = schritte.filter(k => k.form === 'warten');
    for (const w of warten) {
      expect(w.warten).toMatchObject({ art: 'ereignis' });
      if (w.warten?.art !== 'ereignis') continue;
      expect(['kunde-geliefert', 'abstimmung-bestaetigt']).toContain(w.warten.ereignis);
      expect(w.warten.hoechstensTage).toBeGreaterThan(0);
      const weiter = kantenVon(d).find(x => x.von === w.id && x.ausgang === 'weiter')!.nach!;
      const r = d.knoten.find(k => k.id === weiter)!;
      expect(r.form, `${w.id} → ${weiter}`).toBe('entscheidung');
      expect(r.raute?.art === 'regel' && r.raute.bedingungen.every(b => b.feld.startsWith('fall.'))).toBe(true);
      expect(d.knoten.find(k => k.id === r.zweige!.nein)!.ende?.ergebnis).toBe('erfolg');
    }
  });
  it('Texte: Grußzeile aus der Akte, kein „Sie“/„ihr“ im Rest, nur der vorhandene Kunden-Link; keine Namen, Adressen, Beträge, Firmen', () => {
    for (const k of schritte.filter(x => x.katalog?.id === 'inbox.mail-entwurf')) {
      const t = String(k.katalog?.werte?.text ?? '');
      expect(t.startsWith('{{kunde.gruss}},'), k.id).toBe(true);
      expect(t).not.toMatch(/\b(Sie|Ihnen|Ihr|Ihre|ihr|euch|dich|dir|du)\b/);
      expect(t).not.toMatch(/neue[nr]? (Kunden-)?Link/);
    }
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/@|https?:\/\//);
    expect(text).not.toMatch(/\d[\d.]*\s?(€|EUR\b|Euro\b)/);
    expect(text).not.toMatch(/\b(kevin|malin|lena|jonas|ben|mira)\b/i);
    expect(text).not.toMatch(/\b(GmbH|UG|AG|KG)\b/);
    for (const k of d.knoten) {
      const w = k.katalog?.werte ?? {};
      if (typeof w.wer === 'string') expect(ROLLEN_WERTE.map(r => r.id)).toContain(w.wer);
      if (typeof w.postfach === 'string') expect(POSTFACH_WERTE.map(r => r.id)).toContain(w.postfach);
    }
  });
  it('Einstellbares zeigt auf vorhandene Schritte; Übergaben nur an Vorlagen der Bibliothek', () => {
    const lokal = new Set(d.knoten.map(k => k.id));
    for (const e of v.einstellbar) if (e.knoten) expect(lokal.has(`${v.id}:${e.knoten}`), e.knoten).toBe(true);
    for (const u of v.uebergabeAn) expect(vorlageVon(u)).not.toBeNull();
    for (const k of d.knoten) if (k.ende?.uebergabeAn) expect(VORLAGEN_IDS.has(vorlageAusRef(k.ende.uebergabeAn))).toBe(true);
  });
});

describe('Entscheidungen 22.10. in den Vorlagen', () => {
  it('Willkommen und Report: nur erinnern — keine Nachricht an den Kunden, die Mail bzw. der Report bleibt im Fall', () => {
    for (const id of ['fb-03', 'fb-06']) {
      const d = vorlageVon(id)!.definition;
      expect(alleSchritte(d).some(x => x.schritt.form === 'nachricht' && x.schritt.katalog?.id !== 'glocke.melden'), id).toBe(false);
      expect(alleSchritte(d).some(x => x.schritt.katalog?.id === 'aufgabe.anlegen' && /im Fall/.test(String(x.schritt.katalog.werte?.titel))), id).toBe(true);
    }
  });
  it('Bestätigung offen: ein neuer Kunden-Link nur nach eigener Entscheidung (Raute „Mensch“), dann im Fall', () => {
    const d = vorlageVon('fb-02')!.definition;
    const n1 = d.knoten.find(k => k.id === 'fb-02:n1')!;
    expect(n1.katalog?.id).toBe('entscheidung.mensch');
    expect(d.knoten.find(k => k.id === n1.zweige!.ja)!.katalog?.id).toBe('aufgabe.anlegen');
  });
  it('Puls: Check-in nur, wenn das Puls-Gespräch des Fulfillments nicht schon im Stapel liegt; FB9 übergibt an V15, FB7 fragt nicht selbst nach Empfehlungen', () => {
    const r = vorlageVon('fb-08')!.definition.knoten.find(k => k.id === 'fb-08:r1')!;
    expect(r.raute).toMatchObject({ art: 'regel', bedingungen: [{ feld: 'fall.puls-gespraech-offen', op: 'gleich', wert: false }] });
    expect(vorlageVon('fb-09')!.definition.knoten.find(k => k.ende?.ergebnis === 'uebergabe')!.ende!.uebergabeAn).toBe('vorlage:kg-v15');
    expect(JSON.stringify(vorlageVon('fb-07')!.definition)).not.toMatch(/Empfehlung (anfragen|fragen)|crm\.followup/);
  });
});

describe('Client-sicher', () => {
  it('die Begleit-Vorlagen laden keine Bestände, keine Node-Module, kein KI-Tor', () => {
    const o = path.join(__dirname, '../lib/prozesse/begleitung');
    for (const f of readdirSync(o).filter(x => x.endsWith('.ts'))) expect(readFileSync(path.join(o, f), 'utf8'), f).not.toMatch(/from\s+['"](node:|fs|path|crypto|next\/server)['"]|local-db|lib\/anthropic|-server['"]/);
  });
});

// ══ Über die Routen und den Motor ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

type Hd = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, Hd>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const H = 'haus-b2';
const J = '2026-10-01T08:00:00.000Z';
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const roh = (name: string) => readFileSync(path.join(ordner, `${name}.json`), 'utf8');
const prozessVon: Record<string, string> = {};
let heute = '';

beforeAll(async () => {
  heute = (await import('@/lib/zeit')).localDay();
  const { tagPlus } = await import('@/lib/kalender/zeit');
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', { ...leererBestand(), mandate: [{
    id: 'm-b2', kunde: 'Probe Kunde', firmaId: 'f-b2', kontaktIds: ['c-probe'], titel: 'Mandat Probe', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf',
    vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
    ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
  }] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', anrede: 'Du', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await d.saveJson('postfaecher--pia', { v: 1, postfaecher: [{ id: 'pf-00000000-0000-4000-8000-000000000001', quelle: 'imap', bereich: 'ug', anzeigename: 'Probe', adresse: 'pia@example.invalid' }] });
  // Ein Paket mit einem Kunden-Schritt, einer Bestätigung und zwei Etappen; der Fall läuft seit 20 Tagen, das Onboarding entfällt (der Kunde ist dran).
  const neu = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Probe-Begleitung', phase: 'Start', anfrageId: 'b2-neu' });
  const vorlageId = neu.j.vorlageId as string;
  const kn = (neu.j.vorlage as { knoten: { id: string; elternId?: string }[] }).knoten;
  const start = kn.find(x => x.elternId === kn.find(y => !y.elternId)!.id)!.id;
  const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId, stand: neu.j.stand, ops: [
    { op: 'schritt-neu', id: u(1), ziel: { phaseId: start }, form: 'schritt', titel: 'Unterlagen schicken', zustaendig: 'kunde', frist: 3 },
    { op: 'abstimmung', phaseId: start, an: true, titel: 'Freigabe', wer: 'kunde' },
    { op: 'phase-neu', id: u(3), titel: 'Umsetzung', nach: start },
    { op: 'schritt-neu', id: u(4), ziel: { phaseId: u(3) }, form: 'schritt', titel: 'Umsetzen' },
  ] });
  if (r.status !== 200) throw new Error(`Editor: ${r.status} ${JSON.stringify(r.j)}`);
  const st = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-b2', vorlageId, start: tagPlus(heute, -20), anfrageId: 'b2-start' });
  if (st.status !== 200) throw new Error(`Start: ${st.status} ${JSON.stringify(st.j)}`);
  const { MUSTER_ONBOARDING } = await import('@/lib/fulfillment/muster');
  const { obKnotenId } = await import('@/lib/fulfillment/prozesse/onboarding');
  const ob = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b2', ops: MUSTER_ONBOARDING.map(s => ({ op: 'knoten-status', id: obKnotenId(s.schluessel), status: 'entfaellt', grund: 'Probe ohne Onboarding' })) });
  if (ob.status !== 200) throw new Error(`Onboarding: ${ob.status} ${JSON.stringify(ob.j)}`);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Galerie und Übernahme über die Route', () => {
  it('GET ?vorlagen=1 bleibt die Kundengewinnung (18); &gruppe=begleitung die neun, &gruppe=alle beide; Vorschau einer Begleit-Vorlage', async () => {
    const k = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?vorlagen=1&space=business');
    expect(k.status).toBe(200);
    expect(k.j.vorlagen).toHaveLength(18);
    const b = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?vorlagen=1&gruppe=begleitung&space=business');
    expect((b.j.vorlagen as { id: string; gruppe: string }[]).map(v => v.gruppe)).toEqual(Array(9).fill('begleitung'));
    expect((await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?vorlagen=1&gruppe=alle&space=business')).j.vorlagen).toHaveLength(27);
    const v = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?vorlage=fb-01&space=business');
    expect(v.status).toBe(200);
    expect((v.j.vorlage as { vorschau: unknown[] }).vorschau.length).toBe(3);
    expect((await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?vorlagen=1&gruppe=begleitung&space=privat')).status).toBe(403);
  });
  it('„Aus Vorlage“: jede Begleit-Vorlage steht danach im Probelauf; FB9 ohne V15 endet mit Hinweis, mit V15 übergibt es an den eigenen Prozess', async () => {
    const paketVorher = roh(`fulfillment--${H}`);
    let n = 0;
    for (const v of BEGLEIT_VORLAGEN) {
      const a = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: v.id, eigner: 'konto-pia', anfrageId: `pza-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });
      expect(a.status, `${v.id}: ${JSON.stringify(a.j)}`).toBe(200);
      expect((a.j.eintrag as { status: string }).status, v.id).toBe('probelauf');
      prozessVon[v.id] = (a.j.eintrag as { id: string }).id;
      if (v.id === 'fb-09') expect((a.j.hinweise as string[]).join(' ')).toMatch(/Bestandskunden-Ausbau/);
    }
    const v15 = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'kg-v15', eigner: 'konto-pia', anfrageId: 'pza-00000000-0000-4000-8000-000000000100' });
    expect(v15.status).toBe(200);
    const fb9 = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'fb-09', eigner: 'konto-pia', anfrageId: 'pza-00000000-0000-4000-8000-000000000101' });
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const def = (await prozesseLesen(H)).prozesse.find(p => p.id === (fb9.j.eintrag as { id: string }).id)!.entwurf;
    expect(def.knoten.find(k => k.ende?.ergebnis === 'uebergabe')!.ende!.uebergabeAn).toBe((v15.j.eintrag as { id: string }).id);
    // Gold „Paket vorher = Paket nachher“: Übernehmen fasst den Fulfillment-Bestand nie an.
    expect(roh(`fulfillment--${H}`)).toBe(paketVorher);
  });
});

describe('Motor mit echtem Fall', () => {
  it('die Lage des Falls aus der Cockpit-Zeile: Etappe, wartet auf den Kunden, Hänger, Puls; Puls-Gespräch im Stapel wird erkannt', async () => {
    const { faelleFuerProzesse } = await import('@/lib/fulfillment/prozesse/server');
    const f = (await faelleFuerProzesse(heute))['m-b2'];
    expect(f).toMatchObject({ status: 'laeuft', phase: 'Start', bestaetigungOffen: expect.any(Boolean), willkommenOffen: false, reportFaellig: expect.any(Boolean), pulsKritisch: false, pulsGespraechOffen: false });
    expect(f.wartetKunde).toBeGreaterThan(0);
    const { lege } = await import('@/lib/zoe/stapel');
    await lege({ werkzeug: 'fulfillment_puls_gespraech', gruppe: 'fulfillment', titel: 'Gespräch anbieten', nachher: 'Follow-up', eingabe: { mandatId: 'm-b2', pulsId: 'pu-probe' }, quelle: 'lauf', bezug: { art: 'fulfillment', id: 'k:puls:pu-probe' } });
    expect((await faelleFuerProzesse(heute))['m-b2'].pulsGespraechOffen).toBe(true);
  });
  it('jede Raute der neun Vorlagen bekommt ihr Feld (bekannt + geliefert); die Grußzeile kommt nach Du/Sie aus der Akte', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const { gelesenFelder, istLaufFeld } = await import('@/lib/prozesse/kundengewinnung/raute-felder');
    const kx = await S.kontextLaden(new Date(), H);
    const bekannt = new Set(FALL_FELDER.mandat.map(x => x.id));
    const funde: string[] = [];
    for (const v of BEGLEIT_VORLAGEN) {
      const l = {
        id: 'pl-00000000-0000-4000-8000-000000000099', prozessId: 'pz-00000000-0000-4000-8000-000000000099', version: 1, fall: { art: 'mandat' as const, id: 'm-b2' }, bereich: 'fulfillment' as const,
        schluessel: 'x', durchgang: 1, modus: 'scharf' as const, status: 'laeuft' as const, person: 'pia', ausloeser: { art: 'hand' as const }, tiefe: 0, daten: { 'bezug.mandatid': 'm-b2' },
        start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0,
      };
      const umfeld = await S.umfeldFuer(l as never, v.definition, kx);
      for (const g of gelesenFelder(v.definition)) {
        if (istLaufFeld(g.feld)) continue;
        if (!bekannt.has(g.feld)) { funde.push(`${v.id}: ${g.feld} unbekannt`); continue; }
        if (g.op === 'leer' || g.op === 'gesetzt') continue;
        if (umfeld.daten[g.feld] === undefined) funde.push(`${v.id}: ${g.feld} fehlt`);
      }
      expect(umfeld.platzhalter?.['kunde.gruss']).toBe('Hallo Testa');
      expect(umfeld.platzhalter?.['fall.phase']).toBe('Start');
    }
    expect(funde).toEqual([]);
  });
  it('Gold: Probelauf aller neun — mit dem Beispiel-Fall UND dem echten Fall — kommt ans Ende, schreibt keinen Lauf, Fall und Paket Byte für Byte gleich', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const vorherLaeufe = JSON.stringify(await S.laeufeLesen(H));
    const fallVorher = roh(`fulfillment-faelle--${H}`), paketVorher = roh(`fulfillment--${H}`);
    const halt: string[] = [];
    for (const v of BEGLEIT_VORLAGEN) {
      for (const fall of ['beispiel', { art: 'mandat', id: 'm-b2' }] as const) {
        const r = await S.probelauf({ prozessId: prozessVon[v.id], quelle: 'version', fall, person: 'pia' });
        if (!r.ok) { halt.push(`${v.id}: ${r.fehler}`); continue; }
        for (const z of r.schritte.filter(y => y.status === 'fehler')) halt.push(`${v.id}: ${z.text}`);
        const letzte = r.schritte.at(-1);
        if (!letzte || !/^endet|würde|startet|entscheidet/.test(letzte.text)) halt.push(`${v.id} (${typeof fall === 'string' ? fall : fall.id}): endet nicht (${letzte?.text ?? 'leer'})`);
      }
    }
    expect(halt).toEqual([]);
    expect(JSON.stringify(await S.laeufeLesen(H))).toBe(vorherLaeufe);
    expect(roh(`fulfillment-faelle--${H}`)).toBe(fallVorher);
    expect(roh(`fulfillment--${H}`)).toBe(paketVorher);
  });
});
