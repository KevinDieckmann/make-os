// ─── Prüfung R2-3 „Produkte“ (02.11.) — je Fund ein Fall, vorher rot → nachher grün ─────────────────────────────────────────────
// Kevin: „Alles muss sauber laufen und sauber verbunden sein — auch Prozesse und Produkte.“ Erfundene Produkte, Preise und Firmen; eigener Datenordner für den
// Routen-Fall (Sicht Business bekommt nichts aus Privat).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const o = mkdtempSync(path.join(tmpdir(), 'make-os-kg-produkte-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-kg-produkte', MAKE_OS_OHNE_APPLE: '1' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'NEXT_PUBLIC_MAKE_BAU', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_MAKE_OS_EINHEITEN']) delete process.env[k];
  return o;
});
import { angebotPositionenAusProdukt, preisAenderung, zusatzAusTeil, type PreisTeil } from '@/lib/crm/produkt-karte';
import { mandatVorbelegung, angebotEinmalRest } from '@/lib/crm/angebote';
import { automatikStart, mandatAusDeal } from '@/lib/crm/mandat-aus-deal';
import { monatsPositionen, abrechnenPositionen, zusatzDeckel } from '@/lib/crm/mandat-zusatz';
import { jahresHonorarVon } from '@/lib/crm/mandat-laufzeit';
import { produkteAbgelaufen, produktVerweise, produktZahlen } from '@/lib/crm/produkte';
import { loeschSperren } from '@/lib/crm/crm-stand';
import { mrr, mandatPosten } from '@/lib/crm/kunden';
import { saeubern } from '@/lib/crm/speicher';
import { vorbereitenFaellig, einmalTeilPositionen } from '@/lib/finanzen/rechnung/kreislauf-regeln';
import { crmFuerNurBusiness, crmOpsNurBusiness } from '@/lib/crm/nur-business';
import { linkOhneAktivesProdukt, linkProdukteInaktiv, linksMitProdukt } from '@/lib/crm/formulare';
import { formularLinksAbleiten } from '@/lib/meldungen/regeln';
import { preisAbgleich } from '@/lib/website/regeln';
import { istBasisVorschlaege } from '@/lib/finanzen/produkte';
import { ratenCent } from '@/lib/crm/angebote';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import type { Angebot, Chance, CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';
import type { RechnungPosition } from '@/lib/finanzen/rechnung/typen';

const J = '2026-10-24T08:00:00.000Z';
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const produkt = (x: Partial<Leistung>): Leistung => ({ id: 'l-x', name: 'Beispiel', typ: 'sprint', stufe: 'kern', preis: { betrag: 0, einheit: '' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, angebot: { leistungstext: 'x' }, ...x } as unknown as Leistung);
const angebotAus = (pos: Angebot['positionen'], x: Partial<Angebot> = {}): Angebot => ({ id: 'a1', nummer: 'N', gesellschaft: 'ug', dealId: 'ch-1', titel: 't', positionen: pos, einleitung: '', schluss: '', gueltigBis: '2026-11-30', zahlungszielTage: 14, status: 'angenommen', version: 1, angelegt: J, geaendert: J, ...x } as unknown as Angebot);
const deal = (x: Partial<Chance>): Chance => ({ id: 'ch-1', titel: 'D', kontaktIds: [], art: 'retainer', wert: { betrag: 900, basis: 'monat' }, stufe: 'gewonnen', historie: [], gesellschaft: 'ug', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as unknown as Chance);
const ctx = (leistungen: Leistung[], angebote: Angebot[]) => ({ leistungen, angebote, firmen: [], id: 'm-1', jetzt: J, heute: '2026-11-01', person: 'kevin', start: '2026-11-01' });
const summe = (l: RechnungPosition[]) => l.reduce((a, p) => a + p.einzelpreisCent * p.menge, 0);
const KOMBI = produkt({ id: 'l-s', name: 'Sprint', preise: [teil({ id: 'pt-1', art: 'fest', betragCent: 600_000 }), teil({ id: 'pt-2', art: 'monatlich', betragCent: 90_000 })], vertrag: { mindestlaufzeitMonate: 6 } } as Partial<Leistung>);

describe('Fund 1 — Kombi mit Raten/Anzahlung im Angebot', () => {
  it('Raten liegen am Zusatzmodul: drei Rechnungen wie im PDF, kein leeres Versprechen', () => {
    const a = angebotAus(angebotPositionenAusProdukt(KOMBI, []), { zahlweise: { art: 'raten', anzahl: 3, abstandMonate: 1 } });
    const v = mandatVorbelegung(a, [KOMBI]);
    const z = v.zusatz?.find(x => x.honorar?.basis === 'einmalig');
    expect(z?.raten).toEqual({ anzahl: 3, abstandMonate: 1 });
    expect(z?.zahlplan).toBeUndefined();
    expect(angebotEinmalRest(a, [KOMBI])).toEqual([]);
    expect((v.offen ?? []).some(o => /Morgenlauf/.test(o))).toBe(false);
    const { mandat } = mandatAusDeal(deal({ leistungId: 'l-s' }), ctx([KOMBI], [a]));
    const k = { katalog: [KOMBI], nettoAusBrutto };
    const je = ['2026-11', '2026-12', '2027-01', '2027-02'].map(mo => monatsPositionen(mandat, mo, k).filter(p => /Rate/.test(p.titel)).map(p => p.einzelpreisCent));
    expect(je).toEqual([[200_000], [200_000], [200_000], []]);
  });
  it('Anzahlung des Angebots gilt auch für den Festpreis der Kombination', () => {
    const a = angebotAus(angebotPositionenAusProdukt(KOMBI, []), { zahlweise: { art: 'anzahlung', prozent: 30, rest: 'bei Abnahme' } });
    const z = mandatVorbelegung(a, [KOMBI]).zusatz?.find(x => x.honorar?.basis === 'einmalig');
    expect(z?.zahlplan).toEqual({ anzahlungProzent: 30 });
  });
  it('Säuberer behält die Raten am Modul (sonst fielen sie beim Speichern weg)', () => {
    const m = saeubern('mandate', { id: 'm-1', kunde: 'K', titel: 'T', status: 'aktiv', honorar: { betrag: 900, basis: 'monat', netto: true }, zusatz: [{ id: 'mz-e-1', leistungId: 'l-s', preisTeilId: 'pt-1', honorar: { betragCent: 600000, basis: 'einmalig' }, raten: { anzahl: 3, abstandMonate: 1 } }], geaendert: J }, J, 'kevin') as unknown as Mandat;
    expect(m.zusatz?.[0].raten).toEqual({ anzahl: 3, abstandMonate: 1 });
  });
});

describe('Fund 2 — Produkt nur als Zusatzmodul, Rechnungsposition oder Regel-Ziel', () => {
  const Z = produkt({ id: 'l-z', name: 'Support', geloeschtAm: '2026-09-01T00:00:00.000Z' });
  const m2 = { id: 'm-2', leistungId: 'l-j', status: 'aktiv', zusatz: [{ id: 'mz-1', leistungId: 'l-z', honorar: { betragCent: 10_000, basis: 'stunde' } }] } as unknown as Mandat;
  it('Zusatzmodul: nie endgültig löschen, Löschsperre greift', () => {
    const b = { leistungen: [Z], mandate: [m2], chancen: [], angebote: [] } as unknown as CrmBestand;
    expect(produkteAbgelaufen(b, '2026-11-01T00:00:00.000Z')).toEqual([]);
    expect(loeschSperren(b, [{ liste: 'leistungen', op: 'delete', id: 'l-z' }]).length).toBe(1);
  });
  it('Rechnungsposition und Regel eines anderen Produkts zählen ebenso', () => {
    const b = { leistungen: [Z, produkt({ id: 'l-a', regeln: { anrechnung: { auf: ['l-z'], anteilProzent: 100 } } } as Partial<Leistung>)], mandate: [], chancen: [], angebote: [] } as unknown as CrmBestand;
    expect(produktVerweise('l-z', b).regeln).toBe(1);
    const nurRechnung = { ...b, leistungen: [Z] };
    expect(produkteAbgelaufen(nurRechnung, '2026-11-01T00:00:00.000Z', [{ positionen: [{ leistungId: 'l-z' }] }])).toEqual([]);
    expect(produkteAbgelaufen(nurRechnung, '2026-11-01T00:00:00.000Z', [])).toEqual(['l-z']);
  });
});

describe('Fund 3 — Jahresprodukt bleibt eine Jahresrechnung', () => {
  const L = produkt({ id: 'l-j', name: 'Lizenz', typ: 'software', preise: [teil({ id: 'pt-1', art: 'jaehrlich', betragCent: 1_000_000 })], vertrag: { mindestlaufzeitMonate: 12 } } as Partial<Leistung>);
  const a = angebotAus(angebotPositionenAusProdukt(L, []));
  const { mandat } = mandatAusDeal(deal({ art: 'software', leistungId: 'l-j', wert: { betrag: 10000, basis: 'jahr' } }), ctx([L], [a]));
  it('eine Rechnung über den vollen Jahresbetrag, sonst keine — Summe auf den Cent', () => {
    expect(mandat.jahresHonorar).toBe(10000);
    expect(mandat.honorar).toEqual({ betrag: 833.33, basis: 'monat', netto: true });
    const k = { katalog: [L], nettoAusBrutto };
    const monate = Array.from({ length: 12 }, (_, i) => `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, '0')}`);
    const je = monate.map(mo => summe(monatsPositionen(mandat, mo, k)));
    expect(je[0]).toBe(1_000_000);
    expect(je.slice(1).every(x => x === 0)).toBe(true);
  });
  it('Morgenlauf bereitet nur das Vertragsjahr vor, Liquidität jährlich, MRR = Jahr ÷ 12', () => {
    const f = vorbereitenFaellig({ ...mandat, status: 'aktiv' }, '2027-02-10', new Set(), '2026-11');
    expect(f.map(x => x.monat)).toEqual(['2026-11']);
    const p = mandatPosten({ ...mandat, vertragUnterschrieben: true }, '2026-10-30');
    expect(p.map(x => [x.rhythmus, x.betrag])).toEqual([['jaehrlich', 11900]]);
    expect(mrr([{ ...mandat, status: 'aktiv' }])).toBe(833.33);
  });
  it('Säuberer: das Jahr gilt nur, solange es zum Monatshonorar passt (Hand-Änderung → Monatshonorar)', () => {
    const roh = { id: 'm-1', kunde: 'K', titel: 'T', status: 'aktiv', honorar: { betrag: 833.33, basis: 'monat', netto: true }, jahresHonorar: 10000, geaendert: J };
    expect((saeubern('mandate', roh, J, 'kevin') as unknown as Mandat).jahresHonorar).toBe(10000);
    const geaendert = saeubern('mandate', { ...roh, honorar: { betrag: 900, basis: 'monat', netto: true } }, J, 'kevin') as unknown as Mandat;
    expect(geaendert.jahresHonorar).toBeUndefined();
    expect(jahresHonorarVon(geaendert)).toBeNull();
  });
});

describe('Fund 4 — Sicht Business bekommt nichts aus Privat (rein)', () => {
  const b = {
    chancen: [deal({ id: 'ch-b', gesellschaft: 'ug' }), deal({ id: 'ch-p', gesellschaft: 'kdc' })],
    mandate: [{ id: 'm-b', gesellschaft: 'ug' }, { id: 'm-p', gesellschaft: 'kdc' }] as unknown as Mandat[],
    angebote: [{ id: 'a-p', gesellschaft: 'kdc' }] as unknown as Angebot[],
    leistungen: [produkt({ id: 'l-b', gesellschaft: 'ug' }), produkt({ id: 'l-p', gesellschaft: 'kdc' })],
    followups: [{ id: 'fu-p', bezug: { art: 'mandat', id: 'm-p' } }, { id: 'fu-b', bezug: { art: 'chance', id: 'ch-b' } }] as unknown as CrmBestand['followups'],
  };
  it('Filter nimmt Deals, Mandate, Angebote, Produkte und Follow-ups der Privat-Einheit heraus', () => {
    const s = crmFuerNurBusiness(b);
    expect(JSON.stringify(s)).not.toMatch(/"(ch-p|m-p|a-p|l-p|fu-p)"/);
    expect(s.mandate.map(m => m.id)).toEqual(['m-b']);
  });
  it('Schreiben auf Privates → abgelehnt', () => {
    expect(crmOpsNurBusiness(b, [{ liste: 'mandate', op: 'teil', id: 'm-p', felder: { titel: 'x' } }])).toBeTruthy();
    expect(crmOpsNurBusiness(b, [{ liste: 'leistungen', op: 'teil', id: 'l-b', felder: { gesellschaft: 'kdc' } }])).toBeTruthy();
    expect(crmOpsNurBusiness(b, [{ liste: 'followups', op: 'teil', id: 'fu-p', felder: { status: 'erledigt' } }])).toBeTruthy();
    expect(crmOpsNurBusiness(b, [{ liste: 'mandate', op: 'teil', id: 'm-b', felder: { titel: 'x' } }])).toBeNull();
  });
});

describe('Fund 5 — Annahme liest das Angebot, nicht das heutige Produkt', () => {
  it('Zahlplan und Deckel aus dem Angebot festgeschrieben', () => {
    const vorher = produkt({ id: 'l-f', preise: [teil({ id: 'pt-1', art: 'fest', betragCent: 500_000, zahlplan: { anzahlungProzent: 50 } })] } as Partial<Leistung>);
    const a = angebotAus(angebotPositionenAusProdukt(vorher, []));
    expect(a.positionen[0].vereinbart).toEqual({ anzahlungProzent: 50 });
    const nachher = produkt({ id: 'l-f', preise: [teil({ id: 'pt-1', art: 'fest', betragCent: 500_000, zahlplan: { anzahlungProzent: 30 } })] } as Partial<Leistung>);
    expect(mandatVorbelegung(a, [nachher]).zahlplan).toEqual({ anzahlungProzent: 50 });
    const std = teil({ id: 'pt-s', art: 'stundensatz', betragCent: 10_000, deckel: { stundenJeMonat: 10 } } as Partial<PreisTeil>);
    const z = zusatzAusTeil({ id: 'l-z' }, std)!;
    expect(z.deckelStunden).toBe(10);
    // Das Produkt hebt den Deckel später an — das Modul rechnet weiter mit 10.
    const neu = produkt({ id: 'l-z', preise: [{ ...std, deckel: { stundenJeMonat: 40 } }] } as Partial<Leistung>);
    expect(zusatzDeckel(z, [neu])).toBe(10);
    const r = abrechnenPositionen({ start: '2026-11-01', ustSatz: 19, zusatz: [z] } as unknown as Mandat, '2026-11', [{ zusatzId: z.id, menge: 30 }], { katalog: [neu] });
    expect(r.ok && r.positionen[0].menge).toBe(10);
  });
});

describe('Fund 6 — gewünschter Start aus „Angebot anfordern“ trägt bis zum Mandat', () => {
  it('Start der Automatik: Wunsch, frühestens heute, sonst der Erste des Folgemonats', () => {
    expect(automatikStart('2026-12-15', '2026-11-02')).toBe('2026-12-15');
    expect(automatikStart('2026-10-01', '2026-11-02')).toBe('2026-11-02');
    expect(automatikStart(undefined, '2026-11-02')).toBe('2026-12-01');
    expect(automatikStart('kaputt', '2026-12-20')).toBe('2027-01-01');
  });
  it('der Säuberer behält startWunsch am Deal (sonst fiele er beim Speichern weg), Unsinn fällt weg', () => {
    const roh = { id: 'ch-1', titel: 'T', firma: 'F', stufe: 'angebot', wert: 0, kontaktIds: [], gesellschaft: 'offen', angelegt: J, geaendert: J };
    expect((saeubern('chancen', { ...roh, startWunsch: '2027-01-01' }, J, 'kevin') as unknown as Chance).startWunsch).toBe('2027-01-01');
    expect((saeubern('chancen', { ...roh, startWunsch: 'bald' }, J, 'kevin') as unknown as Chance).startWunsch).toBeUndefined();
  });
});

describe('Fund 7 — Vertriebler-Link ohne aktives Produkt', () => {
  const links = [{ id: 'fl-1', name: 'Vertrieb A', produkte: ['l-1'] }, { id: 'fl-2', name: 'Vertrieb B', produkte: ['l-1', 'l-2'] }];
  const leistungen = [{ id: 'l-1', status: 'eingestellt' as const }, { id: 'l-2', status: 'aktiv' as const }];
  it('erkennt inaktive Produkte, leere Links und erzeugt eine Glocke', () => {
    expect(linkProdukteInaktiv(links[1], leistungen)).toEqual(['l-1']);
    expect(linkOhneAktivesProdukt(links[0], leistungen, '2026-11-02')).toBe(true);
    expect(linkOhneAktivesProdukt(links[1], leistungen, '2026-11-02')).toBe(false);
    expect(linksMitProdukt(links, 'l-1', '2026-11-02')).toBe(2);
    const m = formularLinksAbleiten([{ id: 'fl-1', name: 'Vertrieb A', href: '/os/markttraktion?s=formulare' }], { heute: '2026-11-02', am: J });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ art: 'angebot', business: true, virtuell: true });
  });
});

describe('Fund 8 / 12 — Website und Katalog', () => {
  it('eingestelltes Produkt → „nicht aktiv“; Website-Preis geht über den Hauptpreis-Teil', () => {
    expect(preisAbgleich({ produktId: 'l-1', preisNetto: 100 }, [{ id: 'l-1', name: 'x', preisNetto: 100, status: 'eingestellt' }]).art).toBe('nicht-aktiv');
    const l = produkt({ preise: [teil({ id: 'pt-1', art: 'monatlich', betragCent: 90_000 }), teil({ id: 'pt-2', art: 'fest', betragCent: 1000 })] } as Partial<Leistung>);
    const a = preisAenderung(l, 95_000);
    expect(a.preis).toBeUndefined();
    expect(a.preise?.find(t => t.id === 'pt-1')?.betragCent).toBe(95_000);
  });
});

describe('Fund 9 — EINE Monatswert-Regel mit Zusatzmodulen', () => {
  it('MRR und Produkt-Zahlen zählen Zusatzmodule und geplante Sätze', () => {
    const m = { id: 'm-1', kunde: 'K', status: 'aktiv', leistungId: 'l-h', honorar: { betrag: 900, basis: 'monat', netto: true },
      zusatz: [{ id: 'mz-1', leistungId: 'l-z', honorar: { betragCent: 20_000, basis: 'monat' } }, { id: 'mz-2', leistungId: 'l-z2', honorar: { betragCent: 10_000, basis: 'stunde' }, stundenJeMonat: 5 }] } as unknown as Mandat;
    expect(mrr([m])).toBe(1600);
    expect(produktZahlen({ id: 'l-z' }, { mandate: [m], chancen: [] }).mrr).toBe(200);
    expect(produktZahlen({ id: 'l-h' }, { mandate: [m], chancen: [] }).mrr).toBe(900);
  });
});

describe('Fund 10 — Raten wie im PDF auf die Summe gerundet', () => {
  it('Rate i der Summe, Rest auf der letzten', () => {
    const p = (id: string, c: number): RechnungPosition => ({ id, titel: id, text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: c, ustSatz: 19 });
    const je = [1, 2, 3].map(nr => summe(einmalTeilPositionen([p('a', 1000), p('b', 1000)], { nr, von: 3, monat: '2026-11', art: 'rate' })));
    expect(je).toEqual(ratenCent(2000, 3));
  });
});

describe('Fund 13 — Raten mit Abstand > 1 in der Ist-Basis', () => {
  it('je Rate ein Eintrag im Monat ihrer Fälligkeit', () => {
    const m = { id: 'm-1', kunde: 'K', titel: 'T', status: 'aktiv', gesellschaft: 'ug', start: '2026-11-01', honorar: { betrag: 3000, basis: 'einmalig', netto: true }, raten: { anzahl: 3, abstandMonate: 2 } } as unknown as Mandat;
    const v = istBasisVorschlaege({ mandate: [m], chancen: [], leistungen: [] }, '2026-11-01');
    expect(v.map(x => [x.rhythmus, x.betrag])).toEqual([['einmalig', 1000], ['einmalig', 1000], ['einmalig', 1000]]);
    expect(new Set(v.map(x => x.start)).size).toBe(3);
  });
});

// ── Fund 4 an der Route: GET/PATCH /api/crm/bestand mit einem Konto „nur Business“ ─────────────────────────────────────────────
describe('Fund 4 — Route /api/crm/bestand: Sicht Business bekommt nichts aus Privat', () => {
  const HAUS = 'kp-haus';
  const MARKE = 'PRIVAT-MARKE-KG-PRODUKTE';
  let route: Record<string, (r: Request) => Promise<Response>>;
  const rufe = async (person: string, init: RequestInit = {}) => {
    const r = await route[init.method ?? 'GET'](new Request('http://test/api/crm/bestand', { ...init, headers: { 'content-type': 'application/json', 'x-make-user': person } }));
    return { status: r.status, text: await r.text() };
  };
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const speicher = await import('@/lib/crm/speicher');
    const konto = (id: string, s: string, rolle: string, extra: Record<string, unknown> = {}) => ({ id, speicher: s, email: `${s}@example.invalid`, name: `${s} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
    await db.saveJson('konten', { konten: [konto('k1', 'inh', 'inhaber'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    const mandat = (id: string, g: string, titel: string) => ({ id, kunde: 'Beispiel Werke', kontaktIds: [], titel, art: 'retainer', gesellschaft: g, status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J });
    await db.saveJson('crm', { ...speicher.leererBestand(),
      mandate: [mandat('m-b', 'ug', 'Business Retainer'), mandat('m-p', 'kdc', MARKE)],
      leistungen: [produkt({ id: 'l-p', name: MARKE, gesellschaft: 'kdc' }), produkt({ id: 'l-b', name: 'Business Produkt', gesellschaft: 'ug' })],
      chancen: [deal({ id: 'ch-p', titel: MARKE, gesellschaft: 'kdc', stufe: 'bedarf' })],
    });
    route = (await import('@/app/api/crm/bestand/route')) as unknown as typeof route;
  }, 60_000);
  afterAll(() => { rmSync(ordner, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  it('GET: das Konto „nur Business“ sieht nichts der Privat-Einheit, der Inhaber alles', async () => {
    const p = await rufe('partner');
    expect(p.status).toBe(200);
    expect(p.text).not.toContain(MARKE);
    expect(p.text).toContain('Business Retainer');
    const i = await rufe('inh');
    expect(i.text).toContain(MARKE);
  });
  it('PATCH auf Privates → 403, nichts gespeichert', async () => {
    const r = await rufe('partner', { method: 'PATCH', body: JSON.stringify({ ops: [{ liste: 'leistungen', op: 'teil', id: 'l-p', felder: { status: 'eingestellt' } }] }) });
    expect(r.status).toBe(403);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrmMitPapierkorb();
    expect(crm.leistungen.find(l => l.id === 'l-p')?.status).toBe('aktiv');
  });
});
