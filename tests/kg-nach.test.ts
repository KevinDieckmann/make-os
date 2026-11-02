// ─── Gegenprüfung R2-4 der Kundengewinnung (02.11.) — je Fund mindestens ein Fall ─────────────────────────────────────────────────────────
// Erfundene Daten (@example.invalid), eigener Datenordner, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand, FollowUp, Firma, Mandat } from '../lib/crm/typen';
import { teamWieKonten } from './fixtures/team-konten';
teamWieKonten();

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kg-nach-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-kg-nach', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
const gemeldet = vi.hoisted(() => [] as { an: string; titel: string; bezug?: { id: string } }[]);
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; titel: string; bezug?: { id: string } }) => { gemeldet.push(m); } }));
vi.mock('@/lib/hoi/zugang', () => ({ hoiSehen: async () => true, hoiSiehtPerson: async (p: string) => p === 'kevin' }));

const { leererBestand, wendeCrmAn } = await import('../lib/crm/speicher');
const { faellige, istWerblich, keineWerbung } = await import('../lib/crm/followup');
const { firmenWerbesperreFolgen } = await import('../lib/crm/bestand-folgen');
const { firmenKarten } = await import('../lib/crm/firma-karte');
const { anfrageBauen } = await import('../lib/crm/anfragen');
const { willkommenFaellig, willkommenEntscheiden } = await import('../lib/crm/willkommen');
const { kampagnenMotorBefunde } = await import('../lib/hoi/lage');
const { personEntfernen, personVerweise } = await import('../lib/crm/person-verweise');
const { laufzeitAnstehend } = await import('../lib/heute/anstehend');
const { laufzeitAufgabeId, mandatFristen } = await import('../lib/crm/kunden');
const { eingangAufraeumen, eingaengeOffen, eingangBrauchtHand } = await import('../lib/oeffentlich/eingang');
const { NEUIGKEITEN } = await import('../lib/neuigkeiten/eintraege');
const { ROUTEN_REGISTER: ROUTEN } = await import('../lib/zugang/routen-register');

const HEUTE = '2026-11-02', JETZT = `${HEUTE}T09:00:00.000Z`;
const D = 'example.invalid';
const SPERRE = { seit: HEUTE, grund: 'Werbewiderspruch' };
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Betrieb ${id}`, rolle: 'offen', geaendert: JETZT, ...x } as Firma);
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Erika', nachname: `Probe${id.slice(-2)}`, email: `${id}@${D}`, stufe: 'kontaktiert', aktivitaeten: [], firmaId: 'f-nein', ...x } as unknown as Kontakt);
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'kontakt', id: 'c-p1' }, kontaktId: 'c-p1', art: 'mail', text: 'Nachfassen', faellig: HEUTE, zustaendig: 'malin', status: 'offen', quelle: 'hand', angelegt: JETZT, geaendert: JETZT, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const ids = (l: { id: string }[]) => l.map(x => x.id).sort();

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Fund 1 · Werbesperre (Person oder Betrieb) blendet NUR aus, was wir werblich anstoßen', () => {
  const crm = bestand({
    firmen: [firma('nein', { werbesperre: SPERRE })],
    followups: [
      fu('fu-ks-sequenz', { art: 'anruf', quelle: 'kampagne' }), // Sequenz → werblich
      fu('fu-hand-mail'), // Ansprache per Mail → werblich
      fu('fu-anfrage-neu', { anlass: 'anfrage', text: 'Anfrage beantworten — Website' }),
      fu('fu-kr-1234567890', { text: 'Antwort bearbeiten: Kampagne „X“', quelle: 'kampagne' }), // Antwort einer Kampagnen-Mail (Altbestand ohne Feld)
      fu('fu-kw-1234567890', { text: 'Antwort bearbeiten: Willkommens-Mail', quelle: 'kampagne' }),
      fu('fu-vtr-abc', { art: 'anruf', quelle: 'deal', text: 'Unterschrift zu Vertrag nachfassen' }), // Fund 4
      fu('fu-alt-anfrage', { text: 'Anfrage beantworten — Mail', angelegt: '2026-10-20T08:00:00.000Z' }), // Altbestand am Text
      fu('fu-termin', { art: 'termin', text: 'Termin vorbereiten' }),
    ],
  });
  it('Betriebs-Werbesperre: Antworten, Anfragen, Vertrag, Termin bleiben; Sequenz und Ansprache fallen heraus', () => {
    const l = faellige([person('c-p1')], crm, HEUTE);
    expect(ids(l)).toEqual(['fu-alt-anfrage', 'fu-anfrage-neu', 'fu-kr-1234567890', 'fu-kw-1234567890', 'fu-termin', 'fu-vtr-abc']);
  });
  it('dieselbe Regel bei Werbesperre der PERSON', () => {
    const l = faellige([person('c-p1', { firmaId: undefined, werbesperre: SPERRE })], { ...crm, firmen: [] }, HEUTE);
    expect(l.map(x => x.id)).not.toContain('fu-ks-sequenz');
    expect(l.map(x => x.id)).not.toContain('fu-hand-mail');
    expect(l.map(x => x.id)).toContain('fu-anfrage-neu');
  });
  it('der Text allein macht ein NEUES Follow-up nicht zur Antwort (nur Altbestand vor dem Feld)', () => {
    expect(keineWerbung({ id: 'fu-neu', art: 'mail', bezug: { art: 'kontakt', id: 'c' }, text: 'Anfrage beantworten — frei', angelegt: '2026-11-05T09:00:00.000Z' })).toBe(false);
    expect(istWerblich({ id: 'fu-neu', art: 'sonstig', bezug: { art: 'kontakt', id: 'c' }, quelle: 'kampagne' })).toBe(true);
  });
  it('die Anfrage an einer Person eines Betriebs mit Werbesperre trägt den Anlass und steht an', () => {
    const k = person('c-p1');
    const r = anfrageBauen({ kontaktId: k.id, kanal: 'mail', text: 'Bitte um Rückruf' }, { kontakte: [k], crm: bestand({ firmen: [firma('nein', { werbesperre: SPERRE })] }), person: 'kevin', heute: HEUTE, jetzt: JETZT, ids: { kontakt: 'c-x', followUp: 'fu-anf-1' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.followUp.anlass).toBe('anfrage');
    expect(faellige([r.bau.kontakt], bestand({ firmen: [firma('nein', { werbesperre: SPERRE })], followups: [r.bau.followUp] }), HEUTE).map(x => x.id)).toEqual(['fu-anf-1']);
  });
  it('neue Betriebs-Sperre sagt nur Werbliches ab (eine Regel, auch in firmenWerbesperreFolgen)', () => {
    const vorher = bestand({ firmen: [firma('a')], followups: [fu('fu-ks-x', { bezug: { art: 'firma', id: 'f-a' }, kontaktId: undefined, art: 'sonstig', quelle: 'kampagne' }), fu('fu-kr-x', { bezug: { art: 'firma', id: 'f-a' }, kontaktId: undefined, anlass: 'antwort' })] });
    const nachher = firmenWerbesperreFolgen(vorher, { ...vorher, firmen: [firma('a', { werbesperre: SPERRE })] }, JETZT, 'kevin');
    expect(nachher.followups!.find(f => f.id === 'fu-ks-x')!.status).toBe('abgesagt');
    expect(nachher.followups!.find(f => f.id === 'fu-kr-x')!.status).toBe('offen');
  });
  it('den Anlass setzt nur der Server — über den Bestand-Weg weder setzen noch entfernen', () => {
    const b = bestand({ followups: [fu('fu-da', { anlass: 'antwort' })] });
    const r = wendeCrmAn(b, [
      { liste: 'followups', op: 'upsert', eintrag: { ...fu('fu-neu-browser'), anlass: 'antwort' } } as never,
      { liste: 'followups', op: 'teil', id: 'fu-da', teil: { text: 'geändert' } } as never,
    ], JETZT, 'malin');
    expect(r.bestand.followups!.find(f => f.id === 'fu-neu-browser')?.anlass).toBeUndefined();
    expect(r.bestand.followups!.find(f => f.id === 'fu-da')?.anlass).toBe('antwort');
  });
});

describe('Fund 2 · Rückfluss: erst Follow-up + Akte, dann der Haken', () => {
  it('Willkommen: `rueckfluss` wird NACH Follow-up und Akte gesetzt', () => {
    const t = readFileSync('lib/crm/willkommen.ts', 'utf8');
    const f = t.slice(t.indexOf('export async function willkommenRueckfluss'));
    const crm = f.indexOf('await aendereCrm('), akte = f.indexOf('await antwortAnAkte('), haken = f.indexOf('rueckfluss: { art: t.art');
    expect(crm).toBeGreaterThan(0);
    expect(akte).toBeGreaterThan(crm);
    expect(haken).toBeGreaterThan(akte);
  });
  it('Kampagne: der Haken nach Follow-up und Akte; scheitert die Akte, bleibt er weg', () => {
    const t = readFileSync('lib/crm/kampagnen-motor.ts', 'utf8');
    const f = t.slice(t.indexOf('export async function rueckfluss('), t.indexOf('export async function antwortAnAkte'));
    const crm = f.indexOf('await aendereCrm('), akte = f.indexOf('antwortAnAkte('), haken = f.indexOf("rueckfluss: { art: t.art");
    expect(akte).toBeGreaterThan(crm);
    expect(haken).toBeGreaterThan(akte);
    expect(f).toContain('fertig.has(y.id)');
  });
});

describe('Fund 3 · Website-Eingänge, die nicht ankamen', () => {
  const alt = { id: 'we-0000-alt1', art: 'unterlage' as const, am: '2026-09-01T08:00:00.000Z', status: 'fehler' as const, versuche: 3, grund: 'Error: kein Absender', daten: { email: `gast@${D}`, vorname: 'Gast' } };
  const fertig = { id: 'we-0000-fertig', art: 'newsletter' as const, am: '2026-09-01T08:00:00.000Z', status: 'fertig' as const, versuche: 0, fertigAm: '2026-09-01T09:00:00.000Z' };
  it('gescheiterte Zeilen verfallen nie still — nur fertige nach 7 Tagen', () => {
    const l = eingangAufraeumen([alt, fertig], Date.parse(JETZT));
    expect(l.map(x => x.id)).toEqual([alt.id]);
  });
  it('Marketing › Anfragen zeigt sie (mit Adresse), sie brauchen einen Menschen', () => {
    const o = eingaengeOffen([alt, fertig], Date.parse(JETZT));
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ id: alt.id, email: `gast@${D}`, brauchtHand: true });
    expect(eingangBrauchtHand(alt, Date.parse(JETZT))).toBe(true);
  });
  it('Route im Register; Aufgabe fest, Verwerfen leert die Daten, die Aufgabe schließt', async () => {
    expect(ROUTEN['website/eingang']).toBeTruthy();
    const db = await import('../lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Kevin Probe', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' }], einladungen: [] });
    await db.saveJson('website-eingang', { eintraege: [alt] });
    const S = await import('../lib/oeffentlich/eingang-server');
    expect((await S.websiteEingaengeOffen(new Date(JETZT))).map(x => x.id)).toEqual([alt.id]);
    const a = await S.eingangAufgabenNachziehen(new Date(JETZT));
    expect(a.neu).toBe(1);
    expect((await S.eingangAufgabenNachziehen(new Date(JETZT))).neu).toBe(0); // idempotent
    await S.eingangVerwerfen(alt.id, new Date(JETZT));
    const z = ((await db.loadJson<{ eintraege: { id: string; status: string; daten?: unknown }[] }>('website-eingang'))!.eintraege).find(x => x.id === alt.id)!;
    expect(z.status).toBe('fertig');
    expect(z.daten).toBeUndefined();
    const tasks = (await db.loadJson<{ tasks: { id: string; status: string }[] }>('tasks'))!.tasks;
    expect(tasks.find(t => t.id === 'we-0000-alt1')?.status).toBe('done');
  });
});

describe('Fund 5 · gescheiterte Willkommens-Mail hält die Strecke an', () => {
  const stufen = [{ tag: 0 }, { tag: 3 }];
  it('nach einer gescheiterten Stufe kommt keine Folgestufe, bis entschieden ist', () => {
    expect(willkommenFaellig(stufen, '2026-10-20', [], HEUTE, [0])).toBeNull();
    const e = { start: '2026-10-20', gesendet: [], gescheitert: [{ stufe: 0, am: JETZT, grund: 'x' }] };
    const weiter = willkommenEntscheiden(e, 0, 'ueberspringen')!;
    expect(weiter.uebersprungen).toEqual([0]);
    expect(willkommenFaellig(stufen, weiter.start, weiter.gesendet, HEUTE, [], weiter.uebersprungen)).toBe(1);
    const nochmal = willkommenEntscheiden(e, 0, 'erneut')!;
    expect(willkommenFaellig(stufen, nochmal.start, nochmal.gesendet, HEUTE, [], nochmal.uebersprungen)).toBe(0);
    expect(willkommenEntscheiden(e, 1, 'erneut')).toBeNull();
  });
  it('HOI zählt sie (gelb)', () => {
    const b = kampagnenMotorBefunde({ zuletzt: JETZT, minutenSeit: 1, fehlerTeile: [], freigegeben: 0, fehler: 0, unklar: 0, sequenzen: 0, willkommenGescheitert: 2 });
    expect(b[0].ampel).toBe('gelb');
    expect(b[0].wert).toContain('2 Personen');
  });
});

describe('Fund 8 · Art. 17 tilgt den Nachrichtentext eines Antrags, Art. 15 nennt ihn', () => {
  it('nachricht → [gelöscht]', () => {
    const crm = bestand({ antraege: [{ id: 'an-1', art: 'einschraenkung', name: 'Erika Probe', kontaktId: 'c-p1', eingang: HEUTE, frist: '2026-12-02', status: 'offen', geaendert: JETZT, nachricht: 'Über Unterlage (Website): Bitte nicht mehr' }] });
    expect(personVerweise(crm, 'c-p1').antraege[0].nachricht).toContain('Bitte nicht mehr');
    const weg = personEntfernen(crm, 'c-p1');
    expect(weg.antraege[0].nachricht).toBe('[gelöscht]');
    expect(weg.antraege[0].kontaktId).toBeUndefined();
  });
});

describe('Fund 10 · Sperrliste des Betriebs in den Fälligkeiten und der Power Hour', () => {
  it('faellige und firmenKarten nehmen `firmaGesperrt`', () => {
    const crm = bestand({ firmen: [firma('a')], followups: [fu('fu-ks-a', { bezug: { art: 'firma', id: 'f-a' }, kontaktId: undefined, art: 'anruf', quelle: 'kampagne', zustaendig: 'kevin' })] });
    expect(faellige([], crm, HEUTE).length).toBe(1);
    expect(faellige([], crm, HEUTE, { firmaGesperrt: id => id === 'f-a' }).length).toBe(0);
    expect(firmenKarten(crm, HEUTE, 'kevin').karten.length).toBe(1);
    expect(firmenKarten(crm, HEUTE, 'kevin', 12, id => id === 'f-a').karten.length).toBe(0);
  });
  it('die Server-Leser geben den Prüfer mit', () => {
    for (const d of ['app/api/crm/followup/route.ts', 'app/api/crm/heute/route.ts', 'lib/heute/anstehend-server.ts']) expect(readFileSync(d, 'utf8'), d).toContain('betriebSperrPrueferLaden');
  });
});

describe('Fund 11 · nie still kürzen', () => {
  it('ein langer Vermerk kürzt die Notiz nicht', () => {
    const lang = 'x'.repeat(990);
    const vorher = bestand({ firmen: [firma('a')], followups: [fu('fu-ks-l', { bezug: { art: 'firma', id: 'f-a' }, kontaktId: undefined, art: 'anruf', quelle: 'kampagne', notiz: lang })] });
    const f = firmenWerbesperreFolgen(vorher, { ...vorher, firmen: [firma('a', { werbesperre: SPERRE })] }, JETZT).followups![0];
    expect(f.status).toBe('abgesagt');
    expect(f.notiz).toBe(lang);
    expect(f.ergebnis).toBe('Werbewiderspruch des Betriebs');
    expect(readFileSync('lib/crm/bestand-folgen.ts', 'utf8')).not.toMatch(/firmenWerbesperreFolgen[\s\S]*?\.slice\(0, 1000\)[\s\S]*?\n}\n/);
  });
});

describe('Fund 12 · Laufzeit abgelaufen: nur EIN Weg meldet', () => {
  it('liegt die Aufgabe `mlz-…` offen, keine abgeleitete Frist', () => {
    const m = { id: 'm-1', titel: 'Retainer', kunde: 'Betrieb', status: 'aktiv', verlaengerung: 'offen', start: '2026-01-01', ende: '2026-10-01', zustaendig: 'kevin', kontaktIds: [], gesellschaft: 'ug' } as unknown as Mandat;
    expect(laufzeitAnstehend([m], 'kevin', HEUTE)).toHaveLength(1);
    const id = laufzeitAufgabeId(m.id, mandatFristen(m, HEUTE).endeAm!);
    expect(laufzeitAnstehend([m], 'kevin', HEUTE, new Set([id]))).toHaveLength(0);
  });
});

describe('Fund 13 · Morgenlauf-Glocke nur an Personen, die den HOI sehen', () => {
  it('ein Konto ohne HOI bekommt sie nicht', async () => {
    const db = await import('../lib/store/local-db');
    await db.saveJson('konten', { konten: [
      { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Kevin Probe', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
      { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Malin Probe', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h', finanzRecht: 'business' },
    ], einladungen: [] });
    gemeldet.length = 0;
    const { morgenlaufFehlerMelden } = await import('../lib/tagesstart/fehler');
    await morgenlaufFehlerMelden(HEUTE, { tag: HEUTE, anzahl: 1, schritte: ['x'] });
    expect(gemeldet.map(g => g.an)).toEqual(['kevin']);
  });
});

describe('Fund 6/14 · Texte zu den Rechten stimmen', () => {
  it('keine veralteten „nur der Inhaber“-Sätze an den Stellen, die `darfSteuern` prüfen', () => {
    expect(readFileSync('components/os/crm/quali/Zusammenfuehren.tsx', 'utf8')).not.toContain('Zurücknehmen kann sie nur der Inhaber');
    expect(readFileSync('components/os/fulfillment/kunde/FallKunde.tsx', 'utf8')).not.toContain('nur die Inhaberin bzw. der Inhaber');
    expect(readFileSync('lib/fulfillment/kunde/server.ts', 'utf8')).not.toContain('Instanz-Schalter umlegen — nur der Inhaber');
    expect(readFileSync('components/os/crm/stammdaten/KennungenUmzug.tsx', 'utf8')).not.toContain('// Nur der Inhaber (die Route');
  });
});

describe('Fund 9/15 · Rückweg dokumentiert, Neuigkeiten absteigend', () => {
  it('Rückweg nennt die neuen Absicht-Arten und Felder', () => {
    const t = readFileSync('GO_LIVE_CHECKLISTE.md', 'utf8');
    expect(t).toContain('`vertrag-unterschrieben`');
    expect(t).toContain('`FollowUp.anlass`');
    expect(t).toContain('`Antrag.nachricht`');
  });
  it('u-2026-11-02-… stehen absteigend', () => {
    const nr = NEUIGKEITEN.map(n => n.id).filter(id => id.startsWith('u-2026-11-02-')).map(id => Number(id.split('-').pop()));
    expect(nr).toEqual([...nr].sort((a, b) => b - a));
    expect(NEUIGKEITEN[0].id).toBe('u-2026-11-02-15');
  });
});

beforeAll(() => { /* Datenordner steht (vi.hoisted) */ });
