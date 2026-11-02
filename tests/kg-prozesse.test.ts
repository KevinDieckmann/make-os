// ─── Prüfung R2-2 „Prozesse“ (02.11.) — je Fund mindestens ein Fall (vorher rot → nachher grün) ─────────────────────────────────────────────
// Erfundene Daten (@example.invalid), eigener Datenordner, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import type { CrmBestand, Kampagne, FollowUp, Firma } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { sequenzFollowupId, antwortFollowupId } from '../lib/crm/kampagnen-post';
import { firmaErgebnisImCrm, firmenKarten, firmaLeadNachErgebnis } from '../lib/crm/firma-karte';
import { crmDiffKundengewinnung } from '../lib/ereignisse/quellen-kundengewinnung';
import { crmDiff, mqlFingerabdruck } from '../lib/ereignisse/quellen';
import { eingabeSauber } from '../lib/ereignisse/typen';
import { istEreignisArt } from '../lib/ereignisse/arten';
import { fallAusEreignis, ereignisZumFall, startKennungPasst, fallNachEreignis, voran, nachAktion, freigabeEntschieden, wartetAuf, starten, EIGEN_GESENDET, type LaufUmfeld } from '../lib/prozesse/lauf-regeln';
import { ausloeserAus, ereignisTraegtFall } from '../lib/prozesse/ausloeser';
import { leereLaeufe, type ProzessLauf } from '../lib/prozesse/lauf-typen';
import { prozesseMotorBefunde } from '../lib/hoi/lage';
import { SYSTEM_PROZESSE } from '../lib/prozesse/register';
import { KUNDENGEWINNUNG_VORLAGEN } from '../lib/prozesse/kundengewinnung/bibliothek';
import { definitionPruefen } from '../lib/prozesse/definition-pruefen';
import { leads } from '../lib/crm/leads';
import { chanceInQualifizierung } from '../lib/crm/kampagnen-ergebnis';
import { NEUIGKEITEN } from '../lib/neuigkeiten/eintraege';
import { definition, fk, schritt, PZ, J } from './fixtures/prozess-bau';
import { teamWieKonten } from './fixtures/team-konten';
teamWieKonten();

await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kg-prozesse-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-kg-prozesse', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

const HEUTE = '2026-11-02', JETZT = `${HEUTE}T09:00:00.000Z`;
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Betrieb ${id}`, rolle: 'offen', telefon: '+49 30 0000001', geaendert: JETZT, ...x } as Firma);
const SCHRITT = { id: 'sch-anruf', tagAbstand: 0, kanal: 'anruf' as const, leitfaden: 'Kurz vorstellen.' };
const kp = (id: string, x: Partial<Kampagne> = {}): Kampagne => ({ id: `kp-${id}`, name: `Kampagne ${id}`, playbook: 'homepage-funde', ziel: '', zielgruppe: {}, kanal: 'telefon', status: 'aktiv', start: HEUTE, schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: JETZT, ...x } as Kampagne);
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'firma', id: 'f-a' }, art: 'anruf', text: 'Kampagne: Anrufen', faellig: HEUTE, zustaendig: 'malin', status: 'offen', quelle: 'kampagne', angelegt: JETZT, geaendert: JETZT, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
function motorBestand(f: Partial<Firma> = {}): { crm: CrmBestand; id: string } {
  const k = kp('m', { firmaIds: ['f-a'], sequenz: [SCHRITT] });
  const id = sequenzFollowupId(k.id, { art: 'firma', id: 'f-a' }, SCHRITT.id);
  return { crm: bestand({ firmen: [firma('a', f)], kampagnen: [k], followups: [fu(id)] }), id };
}

describe('Fund 1 · Power Hour, Betrieb ohne Person: Gespräch/Termin führen weiter', () => {
  it('Gespräch → Lead „im Gespräch“ + Folge-Follow-up in 5 Werktagen; Termin → „Qualifizierung“, „Termin vorbereiten“, Kampagnen-Ergebnis „Chance“', () => {
    const { crm, id } = motorBestand();
    const g = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'gespraech', heute: HEUTE, jetzt: JETZT, von: 'malin', folge: { id: 'fu-folge-1', faellig: '2026-11-09' } });
    if (!('crm' in g)) throw new Error('erwartet');
    expect(g.crm.firmen[0].lead?.status).toBe('im_gespraech');
    expect(g.folge).toMatchObject({ id: 'fu-folge-1', bezug: { art: 'firma', id: 'f-a' }, faellig: '2026-11-09', text: 'Nach dem Gespräch nachfassen', status: 'offen', zustaendig: 'malin' });
    expect(g.erledigt?.status).toBe('erledigt');
    const t = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'termin', heute: HEUTE, jetzt: JETZT, von: 'malin', folge: { id: 'fu-folge-2', faellig: '2026-11-03' } });
    if (!('crm' in t)) throw new Error('erwartet');
    expect(t.crm.firmen[0].lead?.status).toBe('qualifizierung');
    expect(t.folge?.text).toBe('Termin vorbereiten');
    expect(t.crm.kampagnen[0].firmenErgebnisse).toEqual([{ firmaId: 'f-a', ergebnis: 'chance', am: HEUTE, von: 'malin' }]);
  });
  it('nie über Kein Fit, SQL oder Kunde hinweg; nicht erreicht → kein Folge-Follow-up', () => {
    for (const status of ['kein_fit', 'sql', 'kunde'] as const) {
      expect(firmaLeadNachErgebnis(bestand(), { id: 'f-a', name: 'x', lead: { status, kriterien: {} as never } }, [], 'termin', JETZT, 'malin')).toBeNull();
    }
    const { crm, id } = motorBestand();
    const n = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'nicht_erreicht', heute: HEUTE, jetzt: JETZT, von: 'malin', nochmalAm: '2026-11-04', folge: { id: 'fu-x', faellig: HEUTE } });
    if (!('crm' in n)) throw new Error('erwartet');
    expect(n.folge).toBeUndefined();
    expect(n.crm.firmen[0].lead).toBeUndefined();
  });
  it('ein neues Ergebnis am Betrieb meldet sich als `kampagnen-ergebnis` (vorher nicht im Diff)', () => {
    const k = { id: 'kp-1', name: 'x', status: 'aktiv', ergebnisse: [], firmenErgebnisse: [] } as unknown as Kampagne;
    const l = crmDiffKundengewinnung({ kampagnen: [k] }, { kampagnen: [{ ...k, firmenErgebnisse: [{ firmaId: 'f-1', ergebnis: 'gespraech', am: HEUTE }] }] });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ art: 'kampagnen-ergebnis', stufe: 'gespraech', bezug: { kampagneId: 'kp-1', firmaId: 'f-1' } });
    expect(crmDiffKundengewinnung({ kampagnen: [{ ...k, firmenErgebnisse: [{ firmaId: 'f-1', ergebnis: 'gespraech', am: HEUTE }] }] }, { kampagnen: [{ ...k, firmenErgebnisse: [{ firmaId: 'f-1', ergebnis: 'gespraech', am: HEUTE }] }] })).toHaveLength(0);
  });
  it('A · Betrieb ohne Person mit Lead bzw. Kampagnen-Antwort steht in den Leads (Werbesperre nie)', () => {
    const k = kp('m', { firmaIds: ['f-a', 'f-b', 'f-c'], zustaendig: 'malin', firmenErgebnisse: [{ firmaId: 'f-b', ergebnis: 'gespraech', am: HEUTE }, { firmaId: 'f-c', ergebnis: 'chance', am: HEUTE }] });
    const crm = bestand({ firmen: [firma('a', { lead: { status: 'qualifizierung', kriterien: {} as never } }), firma('b'), firma('c', { werbesperre: { seit: HEUTE, grund: 'x' } }), firma('d')], kampagnen: [k] });
    const z = leads([], crm, HEUTE);
    expect(z.map(x => x.id).sort()).toEqual(['f-a', 'f-b']);
    const b = z.find(x => x.id === 'f-b')!;
    expect(b).toMatchObject({ personen: [], ohnePerson: true, status: 'im_gespraech', besitzer: 'malin', naechsterSchritt: { text: 'Ansprechpartner anlegen' } });
    expect(z.find(x => x.id === 'f-a')!.status).toBe('qualifizierung');
  });
  it('B · „Interesse“ bei SQL/Kunde: ohne offenen Deal und Mandat wieder Qualifizierung, sonst ehrlich nein', () => {
    const f = { id: 'f-a', name: 'Betrieb a' };
    expect(chanceInQualifizierung('kunde', bestand(), { firma: f, kontaktIds: [] })).toEqual({ ja: true });
    expect(chanceInQualifizierung('kunde', bestand({ mandate: [{ id: 'ma-1', firmaId: 'f-a', kunde: 'Betrieb a', status: 'aktiv', kontaktIds: [] } as never] }), { firma: f, kontaktIds: [] }).ja).toBe(false);
    expect(chanceInQualifizierung('sql', bestand({ chancen: [{ id: 'ch-1', firmaId: 'f-a', firma: 'Betrieb a', stufe: 'bedarf', kontaktIds: [] } as never] }), { firma: f, kontaktIds: [] }).ja).toBe(false);
  });
  it('C · „Antwort bearbeiten“ an einem Betrieb trägt `antwort` (Knopf „Als Lead übernehmen“)', () => {
    const id = antwortFollowupId('km-0123456789abcdef');
    const crm = bestand({ firmen: [firma('a')], followups: [fu(id, { text: 'Antwort bearbeiten' })] });
    expect(firmenKarten(crm, HEUTE, null).karten[0]).toMatchObject({ followupId: id, antwort: true });
  });
});

describe('Fund 2 · Kampagne/Event/Buchung starten Läufe; Werkstatt meldet unpassende Auslöser', () => {
  it('Fall aus Kampagne und Event; Buchung → vorläufiger Lead, an die Buchung gebunden, übernimmt die Person', () => {
    expect(fallAusEreignis('kampagne', { kampagneId: 'kp-1' })).toEqual({ art: 'kampagne', id: 'kp-1' });
    expect(fallAusEreignis('event', { eventId: 'ev-1' })).toEqual({ art: 'event', id: 'ev-1' });
    expect(ereignisZumFall({ art: 'kampagne', id: 'kp-1' }, { kampagneId: 'kp-1' })).toBe(true);
    expect(ereignisZumFall({ art: 'kampagne', id: 'kp-1' }, { kampagneId: 'kp-2' })).toBe(false);
    expect(fallAusEreignis('lead', { terminBuchungId: 'b-1' })).toEqual({ art: 'lead' });
    const daten = { 'bezug.terminbuchungid': 'b-1' };
    expect(startKennungPasst({ art: 'lead' }, daten, { terminBuchungId: 'b-1', kontaktId: 'c-1' })).toBe(true);
    expect(startKennungPasst({ art: 'lead' }, daten, { terminBuchungId: 'b-2', kontaktId: 'c-2' })).toBe(false);
    expect(startKennungPasst({ art: 'lead' }, daten, { kontaktId: 'c-2' })).toBe(false);
    const l = { fall: { art: 'lead' }, daten } as unknown as ProzessLauf;
    expect(fallNachEreignis({ ...l, schritte: [] } as ProzessLauf, { terminBuchungId: 'b-1', kontaktId: 'c-1' }).fall).toEqual({ art: 'lead', id: 'c-1' });
  });
  it('Werkstatt: Ereignis und Fall-Art passen nie zusammen → Befund; die Vorlagen sind frei davon', () => {
    expect(ereignisTraegtFall('kampagne-aktiv', 'deal')).toBe(false);
    expect(ausloeserAus({ art: 'ereignis', ereignis: 'kampagne-aktiv' }, 'deal').befunde.some(b => /trägt keinen Fall/.test(b.text))).toBe(true);
    expect(ausloeserAus({ art: 'ereignis', ereignis: 'kampagne-aktiv' }, 'kampagne').befunde).toHaveLength(0);
    for (const v of KUNDENGEWINNUNG_VORLAGEN) for (const d of [v.definition, ...v.teile.map(t => t.definition)]) {
      expect(definitionPruefen(d).filter(b => /trägt keinen Fall/.test(b.text)), d.id).toEqual([]);
    }
  });
});

describe('Fund 3 · eigene Antwort über das Schloss stoppt die Uhr; automatische zählt nicht', () => {
  const DEF = definition([
    schritt(10, 'Antwort bereitlegen', 1, { form: 'entscheidung' }),
    schritt(11, 'Uhr: Antwort gesendet', 2, { form: 'warten', warten: { art: 'ereignis', ereignis: 'antwort-gesendet', hoechstensTage: 1 } }),
    schritt(12, 'Beantwortet', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ]);
  const umfeld = (extra: Partial<LaufUmfeld> = {}): LaufUmfeld => ({ jetzt: J, titel: 'Probe', daten: {}, ...extra });
  const lid = 'pl-00000000-0000-4000-8000-000000000001';
  function bisFreigabe(): { l: ProzessLauf; kennung: string } {
    const r = starten(leereLaeufe(), { id: lid, prozessId: PZ, version: 1, def: DEF, fall: { art: 'deal', id: 'ch-probe' }, modus: 'scharf', person: 'pia', ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, jetzt: J });
    if (!r.ok) throw new Error(r.grund);
    const a = voran(r.lauf, DEF, umfeld());
    return { l: nachAktion(a.lauf, DEF, a.aktion!, { ok: true }, J), kennung: a.aktion!.kennung };
  }
  it('mit Sendung freigegeben → das direkt folgende Warten gilt als eingetreten (vorher Alarm nach Ablauf)', () => {
    const { l, kennung } = bisFreigabe();
    const n = freigabeEntschieden(l, DEF, kennung, 'ja', J, { gesendet: true });
    expect(n.daten[EIGEN_GESENDET]).toBeTruthy();
    const v = voran(n, DEF, umfeld());
    expect(v.lauf).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    expect(v.lauf.daten[EIGEN_GESENDET]).toBeUndefined();
    // Ohne Sendung wartet der Lauf wie bisher.
    expect(voran(freigabeEntschieden(l, DEF, kennung, 'ja', J), DEF, umfeld()).lauf.status).toBe('wartet');
  });
  it('eine automatische Sendung weckt kein Warten; das Feld überlebt die Ereignisstelle nur an „Antwort gesendet“', () => {
    const { l, kennung } = bisFreigabe();
    const w = voran(freigabeEntschieden(l, DEF, kennung, 'ja', J), DEF, umfeld()).lauf;
    const e = { art: 'antwort-gesendet' as const, bezug: { dealId: 'ch-probe' }, bereich: 'business' as const };
    expect(wartetAuf(w, DEF, e, {})).toBe(true);
    expect(wartetAuf(w, DEF, { ...e, automatisch: true }, {})).toBe(false);
    expect(eingabeSauber({ id: 'x:1', art: 'antwort-gesendet', quelle: 'gmail', bezug: {}, bereich: 'business', automatisch: true }, istEreignisArt)?.automatisch).toBe(true);
    expect(eingabeSauber({ id: 'x:2', art: 'neue-mail', quelle: 'gmail', bezug: {}, bereich: 'business', automatisch: true }, istEreignisArt)?.automatisch).toBeUndefined();
  });
});

describe('Fund 3 · Wächter: jede automatische Sendung trägt `automatisch`', () => {
  it('Kampagnen-Motor, Website-Post, Newsletter-Bestätigung, Angebots-Formular, Lieferung/Download-Links — jeder Aufruf von inboxSenden mit `automatisch: true`', async () => {
    const fs = await import('node:fs');
    for (const datei of ['lib/crm/kampagnen-motor.ts', 'lib/oeffentlich/website-post.ts', 'lib/newsletter/versand.ts', 'lib/crm/angebot-versand.ts', 'lib/bausteine/server.ts']) {
      const teile = fs.readFileSync(datei, 'utf8').split('inboxSenden(').slice(1);
      expect(teile.length, datei).toBeGreaterThan(0);
      // Bis zum Ende des Aufrufs (die nächste Zeile mit `.catch` bzw. `} catch` bzw. Semikolon am Zeilenende) muss `automatisch: true` stehen.
      for (const t of teile) expect(t.slice(0, 700).split(/\n\s*(?:if |const |\} catch|return )/)[0], datei).toMatch(/automatisch: true/);
    }
  });
});

describe('Fund 4 · Herzschlag des Lauf-Motors im HOI', () => {
  it('beschädigt → rot; steht bei offenen Läufen → rot; übersprungene Meldungen → gelb; sonst grün', () => {
    const basis = { zuletzt: JETZT, minutenSeit: 2, fehlerInFolge: 0, ereignisFehler: 0, laufFehler: 0, verworfenHeute: 0 };
    expect(prozesseMotorBefunde(null)).toEqual([]);
    expect(prozesseMotorBefunde({ ...basis, beschaedigt: true })[0].ampel).toBe('rot');
    expect(prozesseMotorBefunde({ ...basis, minutenSeit: 90 }, { offen: 3 } as never)[0].ampel).toBe('rot');
    expect(prozesseMotorBefunde({ ...basis, fehlerInFolge: 3 })[0].ampel).toBe('rot');
    expect(prozesseMotorBefunde({ ...basis, verworfenHeute: 4 })[0].ampel).toBe('gelb');
    expect(prozesseMotorBefunde(basis)[0].ampel).toBe('gruen');
    expect(JSON.stringify(prozesseMotorBefunde({ ...basis, verworfenHeute: 4 }))).not.toMatch(/@|c-|f-/);
  });
});

describe('Fund 5 · Prozesslandkarte zeigt den heutigen Stand', () => {
  it('Kampagnen ohne „versendet nichts“, mit Sequenz, Stapel, Druckliste, Rückfluss, Willkommensstrecke; Anfrage, Rechnung, Übergabe nachgetragen', () => {
    const p = (id: string) => SYSTEM_PROZESSE.find(x => x.id === id)!;
    const text = (id: string) => JSON.stringify(p(id));
    expect(text('sp-kampagnen')).not.toMatch(/versendet nichts/);
    for (const w of ['Mail-Stapel', 'Druckliste', 'Rückläufer', 'Willkommen', 'Funde']) expect(text('sp-kampagnen'), w).toContain(w);
    expect(text('sp-anfrage')).toContain('Adresse unbestätigt');
    for (const w of ['Mahnstufen', 'Morgenlauf', 'Storno', 'Raten']) expect(text('sp-rechnung'), w).toContain(w);
    for (const w of ['Vertrag versendet', 'Unterschrift nachfassen', 'Unterschrieben']) expect(text('sp-uebergabe'), w).toContain(w);
    expect(text('sp-deal')).toContain('Mandat gleich an');
    expect(text('sp-wiederkauf')).toContain('Laufzeit endet');
  });
});

describe('Fund 6 · Vertrag unterschrieben weckt die Übergabe — eine Erinnerung', () => {
  it('V12 wartet auf „vertrag-unterschrieben“ statt eine zweite Aufgabe anzulegen; das Ereignis ist angebunden', () => {
    const v12 = KUNDENGEWINNUNG_VORLAGEN.find(v => v.id === 'kg-v12')!;
    const a4v = v12.definition.knoten.find(k => k.id.endsWith(':a4v'))!;
    expect(a4v.form).toBe('warten');
    expect(a4v.warten).toMatchObject({ art: 'ereignis', ereignis: 'vertrag-unterschrieben' });
    expect(v12.definition.knoten.some(k => k.titel === 'Vertrag unterschreiben lassen')).toBe(false);
    expect(istEreignisArt('vertrag-unterschrieben')).toBe(true);
    expect(eingabeSauber({ id: 'vertrag:v-1:unterschrieben', art: 'vertrag-unterschrieben', quelle: 'crm', bezug: { vertragId: 'v-1', dealId: 'ch-1' }, bereich: 'business' }, istEreignisArt)?.bezug).toEqual({ vertragId: 'v-1', dealId: 'ch-1' });
  });
});

describe('Fund 7 · MQL-Stand als Fingerabdruck (nicht umkehrbar, stabil)', () => {
  it('derselbe Fingerabdruck je Kennung, keine Kennung im Klartext', () => {
    expect(mqlFingerabdruck('c-anna')).toBe(mqlFingerabdruck('c-anna'));
    expect(mqlFingerabdruck('c-anna')).not.toBe(mqlFingerabdruck('c-bert'));
    expect(mqlFingerabdruck('c-anna')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('Fund 8 · deal-stufe trägt den Tag', () => {
  it('dieselbe Stufe an einem anderen Tag ist ein neues Ereignis', () => {
    const ch = (stufe: string) => ({ id: 'ch-1', titel: 'Deal', stufe, kontaktIds: [], gesellschaft: 'ug' });
    const a = crmDiff({ chancen: [ch('bedarf')], firmen: [] } as never, { chancen: [ch('angebot')], firmen: [] } as never, '2026-11-02');
    const b = crmDiff({ chancen: [ch('bedarf')], firmen: [] } as never, { chancen: [ch('angebot')], firmen: [] } as never, '2026-11-20');
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe('Neuigkeit', () => {
  it('u-2026-11-02-16 steht vor den älteren Einträgen', () => { const i = NEUIGKEITEN.findIndex(n => n.id === 'u-2026-11-02-16'); expect(i).toBeGreaterThanOrEqual(0); expect(NEUIGKEITEN.findIndex(n => n.id === 'u-2026-11-02-15')).toBeGreaterThan(i); });
});
