// ─── Fulfillment — Prüf-Funde 11.10. über die Routen und Server-Wege ─────────────────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
//   · Update auf Live-Bestand: keine Flut — der erste Morgenlauf merkt nur den Stichtag, Bestandsmandate ohne Vorschlag/Glocke/Uhr (Funktion 2)
//   · Sicht Business bekommt nichts aus Privat: Mandate der Privat-Einheit (auch ein Fall, dessen Mandat inzwischen privat ist) fehlen in
//     GET /api/fulfillment, /fall → 404, /wirkung → 404 (Fund 4); Lese-Protokoll „fulfillment“ für jede Antwort mit Kunden (Fund 10)
//   · Personenteil: A4/A11–A13 und eigene Tiefenbericht-Frage nur mit Recht; Entwürfe von A11–A13 sonst nur Zähler (Fund 5)
//   · Puls von Hand ≤ Schwelle → Vorschlag (Funktion 3), Art.-14-Vorschlag nur einmal je Frist (Funktion 4), Playbook-Schritt misst nur das
//     Playbook (Funktion 8), letzte Messung weg → Ist am Mandat leer (Funktion 9), Wirkungsbericht per Mail nur EINE Ablage-Kopie (Funktion 13)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Der Datenordner muss VOR allen Imports stehen (die Bausteine unten laden die Datenschicht).
const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const o = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-pruef-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-fulfillment-pruef', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY', 'MAKE_OS_ADRESSE']) delete process.env[k];
  return o;
});

import { localDay, tagePlus } from '@/lib/zeit';
import { PERSONENTEIL_GESPERRT } from '@/lib/fulfillment/zugang';
import { MARKE_FULFILLMENT_SEIT } from '@/lib/fulfillment/regeln';
import { OB_PLAYBOOK_FORMULAR_ID } from '@/lib/fulfillment/prozesse/fall';
import type { Fall, PersonenKarte } from '@/lib/fulfillment/typen';

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown>; text: string }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const text = (r.headers.get('content-type') ?? '').includes('json') ? await r.text() : '';
  return { status: r.status, j: text ? JSON.parse(text) as Record<string, unknown> : {}, text };
}

const J = '2026-09-01T08:00:00.000Z';
const heute = localDay();
const mandat = (id: string, gesellschaft: string, x: Record<string, unknown> = {}) => ({
  id, kunde: `Probe ${id} GmbH`, firmaId: 'f-1', kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', leistungId: 'l-probe', gesellschaft, status: 'aktiv',
  vertragUnterschrieben: true, start: '2026-06-01', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [{ id: 'z-probe', text: 'Mehr Termine' }], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J, ...x,
});

let db: typeof import('@/lib/store/local-db');
let sp: typeof import('@/lib/fulfillment/speicher');
let h = '';
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  sp = await import('@/lib/fulfillment/speicher');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-1', name: 'Beispiel GmbH', domain: 'beispiel-firma.example', branche: 'Software', stadt: 'Musterstadt', geaendert: J }],
    leistungen: [{ id: 'l-probe', name: 'Probe-Paket', typ: 'retainer', status: 'aktiv', lieferumfang: [], geaendert: J }],
    mandate: [mandat('m-biz', 'ug'), mandat('m-zwei', 'ug'), mandat('m-wechsel', 'ug'), mandat('m-privat', 'kdc', { kunde: 'Privat-Kundin Einzel' })],
  });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  h = await sp.fulfillmentHaushalt();
}, 60_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const stapelFulfillment = async () => (await (await import('@/lib/zoe/stapel')).lies('offen')).filter(v => v.bezug?.art === 'fulfillment');

describe('Funktion 2: Update auf Live-Bestand — keine Flut', () => {
  it('erster Morgenlauf merkt nur den Stichtag; Bestandsmandate bleiben ruhig; ein NEU unterschriebenes bekommt den Vorschlag', async () => {
    const { prozesseMorgenlauf } = await import('@/lib/fulfillment/prozesse/server');
    expect(await prozesseMorgenlauf(h, heute)).toEqual({ vorschlaege: 0 });
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[MARKE_FULFILLMENT_SEIT]).toBe(heute);
    expect(await stapelFulfillment()).toEqual([]);
    expect(((await db.loadJson<{ eintraege: unknown[] }>('meldungen--pia'))?.eintraege ?? []).length).toBe(0);
    // zweiter Lauf: Bestand bleibt ohne Vorschlag
    expect(await prozesseMorgenlauf(h, tagePlus(heute, 1))).toEqual({ vorschlaege: 0 });
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    const k = ue.j.kandidaten as { mandatId: string; bestand?: boolean; uhr: { ueberfaellig: boolean; faellig?: string } }[];
    expect(k.map(x => x.mandatId).sort()).toEqual(['m-biz', 'm-wechsel', 'm-zwei']);
    expect(k.every(x => x.bestand === true && !x.uhr.ueberfaellig && !x.uhr.faellig)).toBe(true);
    // ein neues Mandat (heute unterschrieben) → Vorschlag + Glocke
    await db.updateJson<{ mandate: unknown[] }>('crm', c => ({ ...c!, mandate: [...c!.mandate, mandat('m-neu', 'ug', { start: heute })] }));
    expect(await prozesseMorgenlauf(h, tagePlus(heute, 1))).toEqual({ vorschlaege: 1 });
    expect((await stapelFulfillment()).map(v => v.bezug!.id)).toEqual(['p:onboarding:m-neu']);
    await db.updateJson<{ mandate: { id: string }[] }>('crm', c => ({ ...c!, mandate: c!.mandate.filter(m => m.id !== 'm-neu') }));
  }, 60_000);
});

let paketP2 = '';
describe('Fund 4 + 10: Sicht Business bekommt nichts aus Privat; Lese-Protokoll', () => {
  it('Fälle anlegen, ein Mandat wird privat — es fehlt überall', async () => {
    expect((await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'aus-muster' }] })).status).toBe(200);
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    paketP2 = (ue.j.prozesse as { id: string; art: string; titel: string }[]).find(p => p.art === 'paket' && p.titel === 'Sales-Systematik')!.id;
    for (const m of ['m-biz', 'm-zwei', 'm-wechsel']) {
      const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: m, vorlageId: paketP2, anfrageId: `ff-pruef-${m}` });
      expect(s.status, m).toBe(200);
    }
    // Die Gesellschaft wechselt zur Privat-Einheit (Selbstständigkeit) — der Fall bleibt gespeichert, ist aber nirgends mehr zu sehen.
    await db.updateJson<{ mandate: { id: string; gesellschaft: string }[] }>('crm', c => ({ ...c!, mandate: c!.mandate.map(m => (m.id === 'm-wechsel' ? { ...m, gesellschaft: 'kdc', kunde: 'Jetzt Privat AG' } : m)) }));
    const g = await rufe('fulfillment', 'GET', sitzung('pia'));
    expect(g.status).toBe(200);
    expect(Object.keys(g.j.mandate as object).sort()).toEqual(['m-biz', 'm-zwei']);
    expect(Object.keys(g.j.faelle as object).sort()).toEqual(['m-biz', 'm-zwei']);
    expect(g.text).not.toMatch(/Privat-Kundin Einzel|Jetzt Privat AG|m-privat|m-wechsel/);
    const kurz = await rufe('fulfillment', 'GET', sitzung('pia'), undefined, '?nur=kurz');
    expect(kurz.text).not.toMatch(/Privat-Kundin Einzel|Jetzt Privat AG|m-wechsel/);
    for (const m of ['m-privat', 'm-wechsel']) {
      expect((await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, `?m=${m}`)).status, m).toBe(404);
      expect((await rufe('fulfillment/wirkung', 'GET', sitzung('pia'), undefined, `?m=${m}&vorschau=1`)).status, m).toBe(404);
    }
    const c = await rufe('fulfillment/cockpit', 'GET', sitzung('pia'));
    expect(c.text).not.toMatch(/Jetzt Privat AG|m-wechsel/);
  }, 120_000);

  it('jede Antwort mit Kunden/Kontakten steht im Lese-Protokoll „fulfillment“ (nur Zahlen/Kennungen)', async () => {
    const lp = await import('@/lib/store/leseprotokoll');
    const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
    lp.leseDrosselLeeren();
    await rufe('fulfillment', 'GET', sitzung('olaf'));
    await rufe('fulfillment/cockpit', 'GET', sitzung('olaf'));
    await rufe('fulfillment/fall', 'GET', sitzung('olaf'), undefined, '?m=m-biz');
    await rufe('fulfillment/wirkung', 'GET', sitzung('olaf'), undefined, '?m=m-biz&vorschau=1');
    await lp.leseprotokollWarten();
    const e = (await lp.leseprotokollMonat('haus-ff', monatBerlin(new Date()))).filter(x => x.person === 'olaf' && x.bereich === 'fulfillment');
    expect(new Set(e.map(x => x.weg))).toEqual(new Set(['/api/fulfillment', '/api/fulfillment/cockpit', '/api/fulfillment/fall', '/api/fulfillment/wirkung']));
    expect(JSON.stringify(e)).not.toMatch(/Probe m-biz GmbH|testa@/);
  });
});

describe('Fund 5: Personenteil — Start, eigene Frage, Entwürfe', () => {
  beforeAll(async () => {
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-zwei' })).status).toBe(200);
    const a0 = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-zwei', agent: 'a0', bestaetigtCent: 0, anfrageId: 'ff-pruef-a0' });
    expect(a0.status, String(a0.j.fehler ?? '')).toBe(200);
    const karte: PersonenKarte = {
      id: 'pp-probe-1', mandatId: 'm-zwei', funktion: 'Geschäftsführung', name: 'Jörg Muster', werdegang: [], themen: [], auftritte: [], aufhaenger: [], identitaet: 'hoch', ausgelassen: [], quellen: [],
      art14: { faelligAm: tagePlus(heute, -5) }, erfasstAm: tagePlus(heute, -40), status: 'entwurf',
    };
    await sp.fulfillmentAendern('personen', d => ({ ok: true, datei: { ...d, karten: [...d.karten, karte] }, geaendert: [karte.id] }));
  }, 60_000);

  it('A4 und A11–A13 starten nur mit Recht auf den Personenteil (403), andere Agenten wie bisher', async () => {
    for (const agent of ['a4', 'a11', 'a12', 'a13']) {
      const r = await rufe('fulfillment/analyse', 'POST', sitzung('partnerin'), { aktion: 'starten', mandatId: 'm-zwei', agent, bestaetigtCent: 100, funktion: 'Geschäftsführung', anfrageId: `ff-p-${agent}` });
      expect(r.status, agent).toBe(403);
      expect(r.j.fehler).toBe(PERSONENTEIL_GESPERRT);
      const o = await rufe('fulfillment/analyse', 'POST', sitzung('olaf'), { aktion: 'starten', mandatId: 'm-zwei', agent, bestaetigtCent: 100, funktion: 'Geschäftsführung', anfrageId: `ff-o-${agent}` });
      expect(o.status, `olaf ${agent}`).not.toBe(403);
    }
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('partnerin'), { aktion: 'starten', mandatId: 'm-zwei', agent: 'a2', bestaetigtCent: 100, anfrageId: 'ff-p-a2' })).status).not.toBe(403);
    const lage = await rufe('fulfillment/analyse', 'GET', sitzung('partnerin'), undefined, '?m=m-zwei');
    const a12 = (lage.j.agenten as { id: string; gruende: string[]; zustand: string }[]).find(a => a.id === 'a12')!;
    expect(a12.zustand).toBe('gesperrt');
    expect(a12.gruende).toContain(PERSONENTEIL_GESPERRT);
  });

  it('Tiefenbericht: eigene Frage nur mit Recht; Negativliste und Kartennamen → 400; die Vorgabe-Frage geht bis zum KI-Schalter', async () => {
    const tb = (wer: string, frage?: string) => rufe('fulfillment/analyse', 'POST', sitzung(wer), { aktion: 'tiefenbericht', mandatId: 'm-zwei', ...(frage ? { frage } : {}), bestaetigtCent: 100, anfrageId: `ff-tb-${wer}-${frage ?? 'vorgabe'}`.slice(0, 60) });
    expect((await tb('partnerin', 'Wie ist der Markt für Software?')).status).toBe(403);
    expect((await tb('partnerin')).status).toBe(409); // Vorgabe-Frage: Gate passiert, der Tiefenbericht ist in dieser Instanz aus
    expect((await tb('pia', 'Ist die Geschäftsführung verheiratet?')).status).toBe(400);
    expect((await tb('pia', 'Was macht Herr Muster beruflich?')).status).toBe(400);
    expect((await tb('pia', 'Wie ist der Markt für Software?')).status).toBe(409);
  });

  it('Entwürfe von A11–A13 sieht ein Konto ohne Recht nur als Zähler', async () => {
    await sp.fulfillmentAendern('dossiers', d => {
      const x = d.dossiers['m-zwei'];
      const lauf = { id: 'al-probe-a12', agent: 'a12' as const, status: 'fertig' as const, schaetzungCent: 1, bestaetigtCent: 1, grenzeCent: 1, gestartetAm: J, gestartetVon: 'pia', fertigAm: J, versuch: 1,
        ergebnis: { abschnitte: { fazit: [{ id: 'da-x', text: 'Herr Muster entscheidet allein', quellen: [], art: 'hypothese', stand: heute }] }, quellen: [], zaehler: { verworfen: 0, ohneQuelle: 0, gesperrt: 0, gekuerzt: 0, negativ: 0, namen: 0 }, ausgelassen: [] } };
      return { ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-zwei': { ...x, laeufe: [...x.laeufe, lauf] } } }, geaendert: ['m-zwei'] };
    });
    const p = await rufe('fulfillment/dossier', 'GET', sitzung('partnerin'), undefined, '?m=m-zwei');
    expect(p.status).toBe(200);
    expect(p.text).not.toContain('Herr Muster');
    const lage = await rufe('fulfillment/analyse', 'GET', sitzung('partnerin'), undefined, '?m=m-zwei');
    expect(lage.text).not.toContain('Herr Muster');
    expect((await rufe('fulfillment/dossier', 'GET', sitzung('olaf'), undefined, '?m=m-zwei')).text).toContain('Herr Muster');
  });
});

describe('Funktion 4: Art.-14-Vorschlag je Karte und Frist nur einmal', () => {
  it('abgelehnt → am nächsten Morgen nicht wieder', async () => {
    const { analyseMorgenlauf } = await import('@/lib/fulfillment/analyse/server');
    const stapel = await import('@/lib/zoe/stapel');
    expect((await analyseMorgenlauf(h, heute)).vorschlaege).toBe(1);
    const v = (await stapelFulfillment()).find(x => x.bezug!.id === 'a:art14:pp-probe-1')!;
    await stapel.entscheide(v.id, 'abgelehnt', { von: 'pia', grund: 'später' });
    expect((await analyseMorgenlauf(h, tagePlus(heute, 1))).vorschlaege).toBe(0);
  });
});

describe('Funktion 3/8/9/13 am laufenden Fall', () => {
  it('Puls von Hand unter der Schwelle → Vorschlag „Gespräch anbieten“ (einmal)', async () => {
    const { pulsHandEintragen } = await import('@/lib/fulfillment/kunde/server');
    const r = await pulsHandEintragen('m-biz', 2, '', 'pia');
    expect(r.status).toBe(200);
    const id = (r.body as { puls: { id: string } }).puls.id;
    expect((await stapelFulfillment()).some(v => v.bezug!.id === `k:puls:${id}`)).toBe(true);
    const { kundeMorgenlauf } = await import('@/lib/fulfillment/kunde/server');
    await kundeMorgenlauf(h, heute);
    expect((await stapelFulfillment()).filter(v => v.bezug!.id === `k:puls:${id}`)).toHaveLength(1);
  });

  it('der Schritt „Kunden-Playbook“ misst nur das Playbook, nicht andere Formulare', async () => {
    const v = await sp.fulfillmentLesen('vorlagen');
    const neu = await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'baustein', eintrag: { art: 'formular', titel: 'Zweites Formular', kundeFuellt: true, kundeSichtbar: true, wer: 'kunde', fragen: [{ id: 'q1', frage: 'Was noch?', art: 'text' }] } }] });
    expect(neu.status, String(neu.j.fehler ?? '')).toBe(200);
    const zweit = (await sp.fulfillmentLesen('vorlagen')).bausteine.find(b => b.titel === 'Zweites Formular')!;
    const f0 = (await sp.fulfillmentLesen('faelle')).faelle['m-biz'];
    const pbId = f0.knoten.find(k => k.id === OB_PLAYBOOK_FORMULAR_ID)!.bausteinId!;
    const pb = v.bausteine.find(b => b.id === pbId)!;
    await sp.fulfillmentAendern('faelle', d => ({ ok: true, datei: { ...d, faelle: { ...d.faelle, 'm-biz': { ...d.faelle['m-biz'], knoten: [...d.faelle['m-biz'].knoten, { id: 'fk-zweit', elternId: d.faelle['m-biz'].knoten.find(k => !k.elternId)!.id, titel: 'Zweites', rang: 99, status: 'offen', extra: true, bausteinId: zweit.id }] } } }, geaendert: ['m-biz'] }));
    await sp.fulfillmentAendern('kunde', d => ({ ok: true, datei: { ...d, formulare: [...d.formulare, { mandatId: 'm-biz', bausteinId: pb.id, fassung: pb.fassung, antworten: Object.fromEntries((pb.fragen ?? []).map(q => [q.id, 'beantwortet'])), fertig: [], geaendertAm: J, quelle: 'kunde' as const }] }, geaendert: ['m-biz'] }));
    const { kundeKurzFuer } = await import('@/lib/fulfillment/kunde/server');
    const k = (await kundeKurzFuer(['m-biz']))['m-biz'];
    expect(k.playbookProzent).toBe(100);
    expect(k.formularProzent).toBe(50);
    const fall = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    const st = (fall.j.onboarding as { schritte: { schluessel: string; erfuellt: boolean }[] }).schritte.find(s => s.schluessel === 'playbook')!;
    expect(st.erfuellt).toBe(true);
  });

  it('letzte Messung gelöscht → der Ist-Wert am Mandat wird wieder leer (ein Wert von Hand bliebe)', async () => {
    const ist = async () => ((await db.loadJson<{ mandate: { id: string; ziele: { id: string; ist?: string }[] }[] }>('crm'))!.mandate.find(m => m.id === 'm-biz')!.ziele[0].ist);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-biz', ops: [{ op: 'wert-messung', zielId: 'z-probe', wert: 7 }] })).status).toBe(200);
    expect(await ist()).toMatch(/7/);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-biz', ops: [{ op: 'wert-messung', zielId: 'z-probe', weg: true }] })).status).toBe(200);
    expect(await ist()).toBeUndefined();
  });

  it('Wirkungsbericht „per Mail senden“ zweimal → EINE Kopie in der Ablage', async () => {
    expect((await rufe('fulfillment/wirkung', 'POST', sitzung('pia'), { aktion: 'erstellen', mandatId: 'm-biz' })).status).toBe(200);
    const a = await rufe('fulfillment/wirkung', 'POST', sitzung('pia'), { aktion: 'fuer-mail', mandatId: 'm-biz' });
    const b = await rufe('fulfillment/wirkung', 'POST', sitzung('pia'), { aktion: 'fuer-mail', mandatId: 'm-biz' });
    expect(a.status).toBe(200);
    expect((b.j.datei as { id: string }).id).toBe((a.j.datei as { id: string }).id);
    const { ablageListe } = await import('@/lib/dateien/ablage');
    expect((await ablageListe(h)).filter(e => (e as { mandatId?: string }).mandatId === 'm-biz')).toHaveLength(1);
    const f = (await sp.fulfillmentLesen('faelle')).faelle['m-biz'] as Fall;
    expect(Object.keys(f.marken).some(k => k.startsWith('wirkung-mail:'))).toBe(true);
  }, 60_000);
});
