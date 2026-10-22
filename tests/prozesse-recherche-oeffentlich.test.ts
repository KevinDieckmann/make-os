// ─── Prozesse · Research „Nur öffentliche Angaben“ (Kevin 22.10. nachts) ────────────────────────────────────────────────────────────────────────────────
// Kevin: „Der Research-Agent bekommt nur Firmenname und Website, keine Notizen oder Kontaktdaten. Dann ist kein Extra-Klick nötig, du bestätigst nur die gefundenen
// Felder im Stapel (einzeln oder alle auf einmal).“ Geprüft:
//   · rein: Rechte-Profil ohne Dreieck (keine privaten Daten, Kategorien nur web + allgemein), kein Schloss; ohne Modus unverändert mit Schloss; nur an
//     Web-Recherche-Fach-Agenten; Säuberer, Maske, Vorlage V01
//   · Motor: an das Modell gehen NUR Name, Website/Domain, Branche — auch wenn die Firma Notizen, Personen, Stadt, Deals hat; Ergebnis bleibt ein Vorschlag
//     (die Karte bleibt unverändert), kein Warten auf eine Freigabe; ohne Firma kein Modellaufruf; ohne Modus wie bisher (Akte, Schloss)
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz; das Modell ist nachgebaut (es merkt sich, was es bekommt).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentSchritt, ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { agentAus, agentSchlossGrund, agentText, ergebnisMussVorschlag, oeffentlichModus, rechteProfil } from '@/lib/prozesse/agent-schritt';
import { oeffentlicheAngaben } from '@/lib/prozesse/agent-felder';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { knotenAus } from '@/lib/prozesse/bestand';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { maskeAnwenden, maskeWerte, neuerKnoten } from '@/lib/prozesse/werkstatt-maske';
import { schloesser } from '@/lib/prozesse/fluss';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-oeffentlich-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-oeffentlich';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// Das Modell — nachgebaut: merkt sich System, Frage und Kategorien jedes Aufrufs; antwortet mit Feldern und einem Fit.
const modell = vi.hoisted(() => ({ aufrufe: [] as { system: string; user: string; kategorien: string[]; web: boolean }[] }));
vi.mock('@/lib/anthropic', async () => {
  const echt = await vi.importActual<typeof import('@/lib/anthropic')>('@/lib/anthropic');
  const antwort = (web: boolean) => async (o: { system?: string; user?: string; ki?: { kategorien?: string[] } }) => {
    modell.aufrufe.push({ system: o.system ?? '', user: o.user ?? '', kategorien: [...(o.ki?.kategorien ?? [])], web });
    return {
      ok: true, status: 200, usage: { ein: 1500, aus: 200, cacheLesen: 0, cacheSchreiben: 0 }, raw: { usage: { server_tool_use: { web_search_requests: 1 } } }, ...(web ? { webUsed: true } : {}),
      text: JSON.stringify({ ergebnis: 'Öffentliche Angaben gefunden.', werte: { fit: 80 }, felder: { 'firma.mitarbeiter': '50–100', 'firma.linkedin': 'https://www.linkedin.com/company/probe-werk' }, quellen: ['https://probe-werk.example.invalid/impressum'] }),
    };
  };
  return { ...echt, askText: vi.fn(antwort(false)), askWithSearch: vi.fn(antwort(true)) };
});

const RESEARCH_ALT: AgentSchritt = {
  wer: { art: 'fach', agentId: 'research' }, auftrag: 'Öffentliche Angaben zur Firma mit Quelle: Mitarbeitende, LinkedIn-Seite; dazu eine Einschätzung des Fit (0–100).',
  modell: 'schnell', budgetCent: 50, gedaechtnis: { brain: false, akte: true }, werkzeuge: [], eingabe: [], ausgabe: [{ id: 'fit', art: 'zahl' }],
  warumKeineRegel: 'Öffentliche Angaben stehen nicht im CRM — eine Regel kann sie nicht kennen.', ergebnis: 'vorschlag', vorschlagFelder: ['firma.mitarbeiter', 'firma.linkedin'],
};
const RESEARCH_OEFF: AgentSchritt = { ...RESEARCH_ALT, nurOeffentlich: true, gedaechtnis: { brain: false, akte: false } };

describe('rein: Rechte-Profil, Schloss, Modus nur für Web-Recherche', () => {
  it('„Nur öffentliche Angaben“: keine privaten Daten → kein Dreieck, keine Pflicht-Freigabe; Kategorien nur web + allgemein; bleibt ein Vorschlag', () => {
    const p = rechteProfil(RESEARCH_OEFF);
    expect(p).toMatchObject({ privateDaten: false, fremderText: true, aussenweg: true, dreieck: false, freigabePflicht: false, ampel: 'gelb' });
    expect(p.lesebereiche).toEqual(['allgemein', 'web']);
    expect(agentSchlossGrund(p)).toBeNull();
    expect(ergebnisMussVorschlag(RESEARCH_OEFF)).toBe(true);
    // Auch wenn (alt gespeichert) „Akte“ an steht: der Modus rechnet wie der Motor — Akte und Brain aus.
    expect(rechteProfil({ ...RESEARCH_OEFF, gedaechtnis: { brain: true, akte: true } })).toMatchObject({ privateDaten: false, dreieck: false });
    expect(agentText(RESEARCH_OEFF)).toMatch(/nur öffentliche Angaben$/);
  });
  it('ohne Modus unverändert: Research mit Akte = tödliches Dreieck, Schloss „dreieck“', () => {
    const p = rechteProfil(RESEARCH_ALT);
    expect(p).toMatchObject({ privateDaten: true, dreieck: true, freigabePflicht: true, ampel: 'rot' });
    expect(p.lesebereiche).toEqual(['brain', 'crm', 'web']);
    expect(agentSchlossGrund(p)).toBe('dreieck');
  });
  it('nur Web-Recherche-Fach-Agenten: an einem Head wirkt der Modus nicht (Hinweis), das Profil bleibt wie es ist', () => {
    const head: AgentSchritt = { ...RESEARCH_ALT, wer: { art: 'head', headId: 'sales' }, nurOeffentlich: true, ergebnis: undefined, vorschlagFelder: undefined };
    expect(oeffentlichModus(head)).toBe(false);
    expect(oeffentlichModus(RESEARCH_OEFF)).toBe(true);
    const r = agentAus(head);
    expect(r.agent?.nurOeffentlich).toBeUndefined();
    expect(r.agent?.gedaechtnis.akte).toBe(true);
    expect(r.befunde.some(b => b.stufe === 'hinweis' && /nur für Web-Recherche/.test(b.text))).toBe(true);
    expect(rechteProfil(head).privateDaten).toBe(true);
  });
  it('agentAus: der Modus bleibt stehen, Akte und Brain sind aus', () => {
    const r = agentAus({ ...RESEARCH_ALT, nurOeffentlich: true, gedaechtnis: { brain: true, akte: true } });
    expect(r.agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false }, ergebnis: 'vorschlag' });
  });
  it('Schloss: im Modus keins hinter der Recherche — wird der Modus an einem alten Schritt eingeschaltet, fällt das alte Schloss weg; ausgeschaltet kommt es wieder', () => {
    const mit = (a: AgentSchritt) => definition([schritt(10, 'Firma recherchieren', 1, { form: 'agent', katalog: { id: 'agent.research' }, agent: a }), schritt(11, 'Danach', 2)], { fallArt: 'firma' });
    const alt = schlossSetzen(mit(RESEARCH_ALT));
    expect(alt.gesetzt).toHaveLength(1);
    expect(schloesser(alt.definition.knoten).has(fk(10))).toBe(true);
    const neu = schlossSetzen({ ...alt.definition, knoten: alt.definition.knoten.map(k => (k.id === fk(10) ? { ...k, agent: RESEARCH_OEFF } : k)) });
    expect(neu.entfernt).toHaveLength(1);
    expect(schloesser(neu.definition.knoten).has(fk(10))).toBe(false);
    expect(schlossSetzen(mit(RESEARCH_OEFF)).gesetzt).toEqual([]);
    expect(schlossSetzen({ ...neu.definition, knoten: neu.definition.knoten.map(k => (k.id === fk(10) ? { ...k, agent: RESEARCH_ALT } : k)) }).gesetzt).toHaveLength(1);
  });
});

describe('rein: öffentliche Angaben, Säuberer, Maske, Vorlage', () => {
  it('oeffentlicheAngaben: nur Name, Webseite (als Adresse), Domain, Branche — Notiz, Marktinfo, Stadt, Lead, Zahlung fallen weg; Text im Feld „Webseite“ auch', () => {
    const f = { id: 'f-1', name: 'Probe Werk GmbH', webseite: 'https://probe-werk.example.invalid', domain: 'probe-werk.example.invalid', branche: 'Maschinenbau', stadt: 'Beispielstadt', notiz: 'ruft nur dienstags an', marktinfo: 'intern', lead: { status: 'kontaktiert' }, zahlung: { iban: 'DE00' } };
    expect(oeffentlicheAngaben(f)).toEqual({ name: 'Probe Werk GmbH', webseite: 'https://probe-werk.example.invalid', domain: 'probe-werk.example.invalid', branche: 'Maschinenbau' });
    expect(oeffentlicheAngaben({ name: 'Probe AG', webseite: 'bitte nicht anrufen, nur Mail', domain: 'kein host' })).toEqual({ name: 'Probe AG' });
    expect(oeffentlicheAngaben({ name: 'Müller Bau', webseite: 'müller-bau.example' })).toEqual({ name: 'Müller Bau', webseite: 'müller-bau.example' });
    expect(oeffentlicheAngaben({ name: '' })).toBeNull();
    expect(oeffentlicheAngaben(undefined)).toBeNull();
  });
  it('Säuberer des Bestands: der Modus bleibt am Research stehen (Akte/Brain aus), an einem Head fällt er weg — alte Schritte ohne Feld bleiben wie sie sind', () => {
    const k = (agent: unknown) => knotenAus({ id: fk(10), elternId: fk(2), titel: 'Recherche', rang: 1, form: 'agent', katalog: { id: 'agent.research' }, agent });
    expect(k({ ...RESEARCH_ALT, nurOeffentlich: true })!.agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false } });
    expect(k({ ...RESEARCH_ALT, wer: { art: 'head', headId: 'sales' }, nurOeffentlich: true })!.agent!.nurOeffentlich).toBeUndefined();
    const alt = k(RESEARCH_ALT)!.agent!;
    expect(alt.nurOeffentlich).toBeUndefined();
    expect(alt.gedaechtnis.akte).toBe(true);
  });
  it('Maske: ein neuer Research-Knoten hat „Nur öffentliche Angaben“ an (Akte aus); ein alter ohne Feld zeigt „aus“; ausschalten lässt die Akte aus, bis man sie wählt', () => {
    const e = katalogEintrag('agent.research')!;
    const f = e.maske.find(m => m.id === 'nurOeffentlich')!;
    expect(f).toMatchObject({ typ: 'ja-nein', vorgabe: true });
    expect((f.hilfe ?? '').length).toBeGreaterThan(80);
    expect(f.hilfe).toMatch(/Beispiel/);
    const neu = neuerKnoten(e, fk(20));
    expect(neu.agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false }, ergebnis: 'vorschlag' });
    expect(maskeWerte(neu, e).nurOeffentlich).toBe(true);
    const alt = { id: fk(21), titel: 'Recherche', rang: 1, form: 'agent' as const, katalog: { id: e.id }, agent: RESEARCH_ALT };
    expect(maskeWerte(alt, e).nurOeffentlich).toBe(false);
    const aus = maskeAnwenden(neu, e, { ...maskeWerte(neu, e), nurOeffentlich: false });
    expect(aus.agent!.nurOeffentlich).toBeUndefined();
    expect(aus.agent!.gedaechtnis.akte).toBe(false);
    const an = maskeAnwenden(alt, e, { ...maskeWerte(alt, e), nurOeffentlich: true });
    expect(an.agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false } });
  });
  it('Vorlage V01 (Teilprozess „Account anreichern“): die Recherche läuft „nur öffentlich“ — dahinter steht kein Schloss mehr, kein offener Punkt „Schloss“', async () => {
    const { KUNDENGEWINNUNG_VORLAGEN } = await import('@/lib/prozesse/kundengewinnung/bibliothek');
    const v01 = KUNDENGEWINNUNG_VORLAGEN.find(v => v.id === 'kg-v01')!;
    const teil = v01.teile.find(t => t.id === 'kg-v01a')!;
    const research = teil.definition.knoten.filter(k => k.form === 'agent' && k.agent?.wer.art === 'fach');
    expect(research).toHaveLength(1);
    expect(research[0].agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false }, ergebnis: 'vorschlag' });
    expect(schloesser(teil.definition.knoten).has(research[0].id)).toBe(false);
    expect(teil.offen.some(o => o.punkt === 'Schloss')).toBe(false);
    // Jede Web-Recherche in allen 18 Vorlagen (und ihren Teilprozessen) läuft „nur öffentlich“ und ohne Schloss.
    for (const v of KUNDENGEWINNUNG_VORLAGEN) for (const d of [v.definition, ...v.teile.map(t => t.definition)]) {
      for (const k of d.knoten.filter(x => x.form === 'agent' && x.agent?.wer.art === 'fach')) {
        expect(oeffentlichModus(k.agent!), `${d.id} · ${k.titel}`).toBe(true);
        expect(schloesser(d.knoten).has(k.id), `${d.id} · ${k.titel}`).toBe(false);
      }
    }
  });
});

// ── Motor ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const H = 'haus-oeff';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OEFF = pz(31), ALT = pz(32), OHNE = pz(33);
const TAG = '2026-10-22T08:00:00.000Z';
let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

const eintrag = (id: string, def: ProzessDefinition): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status: 'aktiv', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 5000, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const ablauf = (a: AgentSchritt, fallArt: ProzessDefinition['fallArt']) => schlossSetzen(definition([
  schritt(30, 'Firma recherchieren', 1, { form: 'agent', katalog: { id: 'agent.research' }, agent: a }),
  schritt(31, 'Fit stark?', 2, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'agent.fit', op: 'groesser', wert: 69 }] }, zweige: { nein: fk(34) } }),
  schritt(32, 'Outreach vorbereiten', 3, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Outreach vorbereiten', wer: 'rolle:zustaendig' } } }),
  schritt(33, 'Ende', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }), schritt(34, 'Bleibt in der Pflege', 5, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
], { laeuftAls: 'pia', eigner: 'konto-pia', fallArt })).definition;

async function start(prozessId: string, fall: ProzessLauf['fall']): Promise<ProzessLauf> {
  const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
  const e = (await prozesseLesen(H)).prozesse.find(p => p.id === prozessId)!;
  const r = await S.prozessLaufStarten({
    id: (await import('@/lib/kennung')).neueKennung('pl'), prozessId, version: 1, def: e.versionen[0].definition, fall, modus: 'scharf', person: 'pia',
    ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode: `p-${prozessId}-${fall.id}`, jetzt: TAG,
  }, H);
  if (!r.ok) throw new Error(r.grund);
  return (await S.laufVoran(r.lauf.id, await S.kontextLaden(new Date(TAG), H)))!;
}
const schrittVon = (l: ProzessLauf, knoten: string) => [...l.schritte].reverse().find(s => s.knoten === knoten);
async function stapel(): Promise<{ id: string; person?: string; anlass?: string; bezug?: { art: string; id: string }; eingabe: Record<string, unknown> }[]> {
  return ((await db.loadJson<{ vorschlaege: never[] }>('zoe-stapel'))?.vorschlaege ?? []);
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id, email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    // Eine Person an der Firma — mit Notiz, Telefon und einer Aktivität: nichts davon darf an das Modell.
    k('c-p1', { vorname: 'Paula', nachname: 'Geheimname', email: 'paula.geheim@example.invalid', telefon: '+49 000 1234567', firmaId: 'f-p1', firma: 'Probe Werk GmbH', notiz: 'GEHEIM-KONTAKTNOTIZ',
      aktivitaeten: [{ art: 'notiz', am: '2026-10-01T09:00:00.000Z', text: 'GEHEIM-AKTIVITAET', von: 'pia' }] }),
    k('c-p2', { firmaId: 'f-p2', firma: 'Probe Zwei GmbH' }),
    k('c-ohne'),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [
      { id: 'f-p1', name: 'Probe Werk GmbH', rolle: 'interessent', webseite: 'https://probe-werk.example.invalid', branche: 'Maschinenbau', stadt: 'Beispielstadt', notiz: 'GEHEIM-FIRMENNOTIZ', marktinfo: 'GEHEIM-MARKTINFO' },
      { id: 'f-p2', name: 'Probe Zwei GmbH', rolle: 'interessent', webseite: 'https://probe-zwei.example.invalid', notiz: 'ZWEI-NOTIZ' },
    ],
    chancen: [{ id: 'ch-p1', titel: 'GEHEIM-DEAL', kontaktIds: ['c-p1'], firmaId: 'f-p1', stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01' }],
  });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(OEFF, ablauf(RESEARCH_OEFF, 'firma')), eintrag(ALT, ablauf(RESEARCH_ALT, 'firma')), eintrag(OHNE, ablauf(RESEARCH_OEFF, 'lead'))] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: Object.fromEntries([OEFF, ALT, OHNE].map(id => [id, scharf()])) });
  S = await import('@/lib/prozesse/lauf-server');
  S._agentKostenSetzen({ schnell: 2, ausgewogen: 3, stark: 5 });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Motor: „Nur öffentliche Angaben“ wird serverseitig erzwungen', () => {
  it('an das Modell gehen NUR Name, Webseite, Branche — keine Notiz, keine Person, keine Stadt, kein Deal, keine Kennung; Kategorien nur allgemein + web', async () => {
    const l = await start(OEFF, { art: 'firma', id: 'f-p1' });
    expect(modell.aufrufe).toHaveLength(1);
    const a = modell.aufrufe[0];
    expect(a.web).toBe(true);
    expect(a.kategorien.sort()).toEqual(['allgemein', 'web']);
    expect(a.user).toContain('<daten quelle="firma">{"name":"Probe Werk GmbH","webseite":"https://probe-werk.example.invalid","branche":"Maschinenbau"}</daten>');
    expect(a.user).not.toContain('<daten quelle="fall">');
    const alles = `${a.system}\n${a.user}`;
    for (const geheim of ['GEHEIM', 'Geheimname', 'Paula', 'paula.geheim', '1234567', 'Beispielstadt', 'f-p1', 'c-p1', 'ch-p1', 'kontaktiert']) expect(alles, geheim).not.toContain(geheim);
    expect(a.system).toMatch(/nie nach Personen/);
    // Ergebnis: nur ein Vorschlag im Stapel (Häkchen je Feld) — die Karte bleibt unverändert; der Lauf wartet NICHT auf eine Freigabe, er geht weiter.
    expect(schrittVon(l, fk(30))).toMatchObject({ status: 'erledigt', recherche: true });
    expect(l).toMatchObject({ fremd: true, daten: { 'agent.fit': '80', 'agent.felder': '2' } });
    expect(l.status).toBe('wartet');
    expect(l.wartet?.art).toBe('aufgabe');
    expect(l.schritte.some(s => s.knoten !== fk(30) && s.knoten !== fk(31) && s.knoten !== fk(32) && s.knoten !== fk(3))).toBe(false);
    const v = (await stapel()).find(x => x.bezug?.art === 'crm' && x.eingabe.art === 'firma_felder' && x.eingabe.firmaId === 'f-p1')!;
    expect(v.eingabe).toMatchObject({ felder: { mitarbeiter: '50–100', linkedin: 'https://www.linkedin.com/company/probe-werk' }, _uebernahme: 'je-feld' });
    expect(v.person).toBe('pia');
    const crm = await db.loadJson<{ firmen: { id: string; mitarbeiter?: string; linkedin?: string }[] }>('crm');
    expect(crm!.firmen.find(f => f.id === 'f-p1')).not.toHaveProperty('mitarbeiter');
  });
  it('ohne Firma mit Namen (Person als Lead): kein Modellaufruf, keine Kosten — Hinweis am Schritt, der Lauf geht in den harmlosen Ast', async () => {
    const vorher = modell.aufrufe.length;
    const l = await start(OHNE, { art: 'lead', id: 'c-ohne' });
    expect(modell.aufrufe.length).toBe(vorher);
    expect(schrittVon(l, fk(30))).toMatchObject({ status: 'erledigt', grund: 'oeffentlich-leer' });
    expect(schrittVon(l, fk(30))!.kostenCent ?? 0).toBe(0);
    expect(l).toMatchObject({ status: 'fertig' });
    expect(l.schritte.map(s => s.knoten)).toContain(fk(34));
    expect(l.fremd).not.toBe(true);
  });
  it('ohne Modus wie bisher: der Fall (Kennungen, CRM) geht mit, Kategorien crm + web, dahinter wartet das Freigabe-Schloss (tödliches Dreieck)', async () => {
    const vorher = modell.aufrufe.length;
    const l = await start(ALT, { art: 'firma', id: 'f-p2' });
    expect(modell.aufrufe.length).toBe(vorher + 1);
    const a = modell.aufrufe.at(-1)!;
    expect(a.kategorien.sort()).toEqual(['crm', 'web']);
    expect(a.user).toContain('<daten quelle="fall">');
    expect(a.user).toContain('f-p2');
    expect(l.status).toBe('wartet');
    expect(l.wartet?.art).toBe('freigabe');
  });
});
