// ─── Selbstständigkeit gehört zu Privat (05.10., Paket selbst-privat) ──────────────────────────────────────────────────────
// Kevin 05.10.: „Selbstständigkeit raus aus Business“ — „Ja, überall unter Privat“ — „Ich habe in der Selbstständigkeit einfach ein Gewerbe
// angemeldet“ — „Runway Privat zählt das Konto der Selbstständigkeit mit“. EINE Zuordnung je Einheit (lib/einheiten.ts `bereichVon`), alle
// Bereiche lesen daraus. Diese Datei prüft unsere Instanz (Selbstständigkeit → privat) gegen die Instanz-Einstellung „wie vorher“
// (`NEXT_PUBLIC_MAKE_OS_EINHEITEN` `{"kdc":{"bereich":"business"}}`) — Vorher → Nachher mit ERFUNDENEN Zahlen, nie echte Daten.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Bestand } from '../lib/business/messen';
import type { Mandat, Chance } from '../lib/crm/typen';
import type { Task, TasksState } from '../types/tasks';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const WIE_VORHER = JSON.stringify({ kdc: { bereich: 'business' } });

/** Module frisch laden — mit (`vorher`) oder ohne (`nachher`) die Instanz-Einstellung „Selbstständigkeit im Business“. */
async function mit<T>(vorher: boolean, laden: () => Promise<T>): Promise<T> {
  vi.resetModules();
  if (vorher) vi.stubEnv('NEXT_PUBLIC_MAKE_OS_EINHEITEN', WIE_VORHER); else vi.stubEnv('NEXT_PUBLIC_MAKE_OS_EINHEITEN', '');
  return laden();
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const mandat = (id: string, gesellschaft: string, betrag: number, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft, status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, start: '2025-09-01', ...x } as Mandat);
const chance = (id: string, gesellschaft: string, stufe: Chance['stufe']): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 10000, basis: 'einmalig' }, stufe, historie: [{ stufe: 'erstkontakt', am: '2026-05-01T10:00:00Z' }, { stufe, am: '2026-07-01T10:00:00Z' }], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft, besitzer: 'kevin', angelegt: J, geaendert: J } as unknown as Chance);
const sechs = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

/** Erfundener Bestand: eine gut laufende Selbstständigkeit (Beratung, Grundlage, Tage) und zwei junge Gesellschaften. */
function bestand(): Bestand {
  return {
    heute: HEUTE, scope: 'gesamt', finance: null, traktion: { score: null, text: '' }, termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], mrrVerlauf: {},
    firmen: [{ id: 'kdc', name: 'Beratung', kontostand: 60000, stand: '2026-09-20' }, { id: 'kdv', name: 'Holding', kontostand: 8000, stand: '2026-09-20' }, { id: 'ug', name: 'GmbH', kontostand: 22000, stand: '2026-09-20' }, { id: 'privat', name: 'Privat', kontostand: 5000, stand: '2026-09-20' }],
    rechnungen: [
      { id: 'r1', kunde: 'Nord', titel: 'Beratung', betrag: 11900, status: 'gestellt', datum: '2026-08-01', faellig: '2026-08-15', firmaId: 'kdc' },
      { id: 'r2', kunde: 'Süd', titel: 'Lizenz', betrag: 2380, status: 'gestellt', datum: '2026-09-01', faellig: '2026-10-01', firmaId: 'ug' },
    ],
    zahlungen: [], merkposten: [],
    planposten: [
      { id: 'lp1', titel: 'Büro Beratung', betrag: -1500, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc' },
      { id: 'lp2', titel: 'Software GmbH', betrag: -900, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'ug' },
    ] as Bestand['planposten'],
    grundlageMonate: sechs.map(monat => ({ monat, umsatzNetto: 14000, kostenNetto: 6000 })),
    grundlageFixkosten: { kdc: 1500, kdv: 200 },
    abschluesse: [
      ...sechs.map(monat => ({ firma: 'kdc' as const, monat, umsatz: 15000, kosten: 6500, fakturierteTage: 12 })),
      ...sechs.slice(2).map(monat => ({ firma: 'ug' as const, monat, umsatz: 3000, kosten: 4000, personal: 2500 })),
      ...sechs.map(monat => ({ firma: 'kdv' as const, monat, umsatz: 0, kosten: 300 })),
    ],
    mandate: [mandat('m1', 'kdc', 8000), mandat('m2', 'kdc', 4000), mandat('m3', 'ug', 1500)],
    chancen: [chance('c1', 'kdc', 'gewonnen'), chance('c2', 'kdc', 'verloren'), chance('c3', 'ug', 'gewonnen')],
    fte: { kdc: 1, ug: 1.5 }, kapazitaet: { kdc: 15 }, ziele: { kdc: 180000, ug: 60000 },
  };
}

describe('EINE Zuordnung je Einheit (lib/einheiten.ts)', () => {
  it('unsere Instanz: Selbstständigkeit → Privat, KD Ventures und MAKE → Business; Register-Gesellschaften und Unbekanntes → Business', async () => {
    const e = await mit(false, () => import('../lib/einheiten'));
    expect(e.RECHTSART.kdc).toBe('einzelunternehmen');
    expect(e.BEREICH_JE_EINHEIT).toEqual({ kdc: 'privat', kdv: 'business', ug: 'business' });
    expect(e.BUSINESS_GESELLSCHAFTEN).toEqual(['kdv', 'ug']);
    expect(e.PRIVAT_GESELLSCHAFTEN).toEqual(['kdc']);
    expect(['privat', 'kdc', 'kdv', 'ug', 'g-abcd1234'].map(e.bereichVon)).toEqual(['privat', 'privat', 'business', 'business', 'business']);
    // Firmen-Posten: ohne Firma bleibt Business (wie seit 24.09. in der Liquidität), Altwerte der Selbstständigkeit werden erkannt.
    expect([undefined, '', 'kdc', 'selbststaendigkeit', 'Consulting', 'kemaris', 'kdv', 'privat'].map(e.bereichVonFirma)).toEqual(['business', 'business', 'privat', 'privat', 'privat', 'business', 'business', 'privat']);
    // CRM: „offen“ bleibt im Business, nur die ausdrücklich gesetzte Selbstständigkeit ist privat.
    expect(['kdc', 'offen', undefined, 'ug'].map(e.bereichVonGesellschaft)).toEqual(['privat', 'business', 'business', 'business']);
    expect(e.BUSINESS_EINHEITEN_NAMEN).toEqual(['KD Ventures', 'MAKE Innovation GmbH']);
  });
  it('Plattform: je Instanz umstellbar (Umgebung) — die Kennungen bleiben, nur der Bereich wechselt', async () => {
    const e = await mit(true, () => import('../lib/einheiten'));
    expect(e.BUSINESS_GESELLSCHAFTEN).toEqual(['kdc', 'kdv', 'ug']);
    expect(e.bereichVon('kdc')).toBe('business');
    expect(e.KERN_EINHEITEN.map(x => x.id)).toEqual(['kdc', 'kdv', 'ug']);
  });
});

describe('Business-Index: Vorher → Nachher (erfundene Zahlen)', () => {
  it('Sichten, Gesamt-Index und die Kennzahlen, die sich ändern — ohne Datenbasis ehrlich „keine Daten“', async () => {
    const rechne = (vorher: boolean) => mit(vorher, async () => {
      const [{ berechne }, reg] = await Promise.all([import('../lib/business/index'), import('../lib/business/register')]);
      const g = berechne(bestand());
      const k = Object.fromEntries(g.saeulen.flatMap(s => s.kennzahlen.map(x => [x.id, x.gemessen ? Math.round((x.wert as number) * 100) / 100 : 'keine Daten'])));
      return { sichten: reg.SCOPES.map(s => s.id), index: g.index, saeulen: Object.fromEntries(g.saeulen.map(s => [s.id, s.score])), k };
    });
    const vorher = await rechne(true), nachher = await rechne(false);
    // Vorher → Nachher (im Bericht 05.10. und UPDATES.md): Index 78 → 64 · FH 73 → 64 · Personal 85 → 33 · Markttraktion 100 → 86;
    // Liquidität 8,33 → 6,98 Monate · Runway 99 (kein Verbrauch) → 23,08 · Kostenquote 55,7 → 148,3 % · Break-even 75,8 → −100 % ·
    // Umsatz je Kopf 81.600 → 16.000 € · Auslastung 80 % → keine Daten · Tagessatz 1.250 € → keine Daten.
    expect([vorher.index, nachher.index]).toEqual([78, 64]);
    expect(vorher.saeulen).toMatchObject({ fh: 73, ud: 85, mt: 100 });
    expect(nachher.saeulen).toMatchObject({ fh: 64, ud: 33, mt: 86 });
    expect([vorher.k.runway, nachher.k.runway, nachher.k.break_even, nachher.k.umsatz_kopf]).toEqual([99, 23.08, -100, 16000]);
    expect(vorher.sichten).toEqual(['gesamt', 'kdc', 'kdv', 'ug']);
    expect(nachher.sichten).toEqual(['gesamt', 'kdv', 'ug']);
    // Auslastung und Tagessatz hatten nur die Selbstständigkeit als Datenbasis → jetzt „keine Daten“, nie 0.
    expect(typeof vorher.k.auslastung).toBe('number');
    expect(nachher.k.auslastung).toBe('keine Daten');
    expect(nachher.k.tagessatz).toBe('keine Daten');
    // Liquidität ohne die 60.000 € der Selbstständigkeit: 30.000 € Kasse (KD Ventures + MAKE), Privat zählt nie.
    expect(nachher.k.liquiditaet).not.toBe(vorher.k.liquiditaet);
    // Kundenkonzentration: nur noch das MAKE-Mandat (100 %), vorher 8.000 von 13.500.
    expect(vorher.k.konzentration).toBeCloseTo(8000 / 13500 * 100, 1);
    expect(nachher.k.konzentration).toBe(100);
    // Überfällige Forderungen: die überfällige Rechnung der Selbstständigkeit zählt nicht mehr.
    expect(nachher.k.ueberfaellig).toBe(0);
    expect(nachher.index).not.toBe(vorher.index);
  });
  it('serverseitig: der Bestand des Business-Bereichs trägt nichts der Selbstständigkeit (Konten, Posten, Abschlüsse, Mandate)', async () => {
    const { MESSEN } = await mit(false, () => import('../lib/business/messen'));
    const b = bestand();
    const l = MESSEN.liquiditaet(b);
    expect('details' in l && JSON.stringify(l.details)).not.toContain('60.000');
    const k = MESSEN.konzentration(b);
    expect(JSON.stringify(k)).not.toMatch(/Kunde m1|Kunde m2/);
  });
});

describe('Aufgaben und Spaces: Umzug mit Altbestand — nichts geht verloren, alles steht unter Privat', () => {
  const T = '2026-09-01T10:00:00.000Z';
  const t = (id: string, x: Partial<Task> = {}): Task => ({ id, projectId: 'p-buch', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T, updatedAt: T, ...x } as Task);
  const alt: TasksState = {
    projects: [{ id: 'p-buch', title: 'Buchhaltung', category: 'business', owner: 'kevin', color: '#fff', tags: [], archived: false, spaceId: 'kdc', createdAt: T, updatedAt: T } as TasksState['projects'][number]],
    tasks: [
      t('a1', { spaceId: 'kdc', space: 'business', einheit: 'Selbstständigkeit' }),                     // gespeichert vor dem 05.10.
      t('a2', { spaceId: 'kdc', space: 'business', parentId: 'a1' }),                                     // Unteraufgabe
      t('a3', { projectId: 'proj-kdm', title: 'Selbständigkeit: Buchhaltung' }),                          // ganz alt, ohne Space
      t('a4', { spaceId: 'kdv', space: 'business', einheit: 'KD Ventures' }),
      t('a5', { spaceId: 'privat', space: 'privat' }),
    ],
  } as TasksState;
  it('Kennungen, Einheit und Unteraufgaben bleiben; Bereich der Selbstständigkeit wird privat; Business behält KD Ventures', async () => {
    const [{ uebernehmen, FESTE_SPACES, bereichVonSpace }, { spaceVonAufgabe }] = await mit(false, () => Promise.all([import('../lib/aufgaben/struktur'), import('../lib/make-one/space-regeln')]));
    const { state } = uebernehmen(alt);
    expect(state.tasks.map(x => x.id).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);   // nichts gelöscht
    const by = Object.fromEntries(state.tasks.map(x => [x.id, x]));
    expect(by.a1).toMatchObject({ spaceId: 'kdc', space: 'privat', einheit: 'Selbstständigkeit', projectId: 'p-buch' });
    expect(by.a2).toMatchObject({ spaceId: 'kdc', space: 'privat', parentId: 'a1' });
    expect(by.a3).toMatchObject({ spaceId: 'kdc', space: 'privat' });
    expect(by.a4).toMatchObject({ spaceId: 'kdv', space: 'business', einheit: 'KD Ventures' });
    expect(['a1', 'a2', 'a3', 'a5'].map(id => spaceVonAufgabe(by[id]))).toEqual(['privat', 'privat', 'privat', 'privat']);
    expect(spaceVonAufgabe(by.a4)).toBe('business');
    expect(FESTE_SPACES.map(s => [s.id, s.bereich])).toEqual([['privat', 'privat'], ['kdc', 'privat'], ['kdv', 'business'], ['ug', 'business']]);
    expect(bereichVonSpace('m-firma-x')).toBe('business');
    // Idempotent: ein zweiter Lauf ändert nichts mehr.
    expect(uebernehmen(state).geaendert).toBe(false);
  });
  it('wie vorher (Instanz-Einstellung): der Space der Selbstständigkeit bleibt Business', async () => {
    const { uebernehmen } = await mit(true, () => import('../lib/aufgaben/struktur'));
    expect(uebernehmen(alt).state.tasks.find(x => x.id === 'a1')).toMatchObject({ spaceId: 'kdc', space: 'business' });
  });
  it('Einheit an einer Aufgabe der Selbstständigkeit bleibt erlaubt, Business-Filter bieten sie nicht mehr an', async () => {
    const { einheitErlaubt, einheitFilterOptionen } = await mit(false, () => import('../lib/aufgaben/einheit'));
    expect(einheitErlaubt({ id: 'x', title: 'x', projectId: 'p', spaceId: 'kdc' })).toBe(true);
    expect(einheitErlaubt({ id: 'x', title: 'x', projectId: 'p', spaceId: 'privat' })).toBe(false);
    expect(einheitFilterOptionen([]).map(o => o.label)).toEqual(['Alle', 'KD Ventures', 'MAKE Innovation GmbH', 'ohne Einheit']);
  });
});

describe('Liquiplan, Lichtfäden, Kalender: die Selbstständigkeit steht unter Privat', () => {
  it('Liquidität: Business-Vorschau ohne Konto und Posten der Selbstständigkeit — ausdrücklich gewählt bleibt sie rechenbar', async () => {
    const { vorschau, nurBusiness, businessFirmen } = await mit(false, () => import('../lib/make-one/liquiditaet'));
    const firmen = [{ id: 'kdc', name: 'Beratung', kontostand: 60000, stand: null }, { id: 'ug', name: 'GmbH', kontostand: 22000, stand: null }];
    const posten = [{ id: 'lp1', titel: 'Büro', betrag: -1500, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc' }, { id: 'lp2', titel: 'Ohne Firma', betrag: -100, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true }] as NonNullable<Parameters<typeof vorschau>[7]>;
    expect(businessFirmen(firmen).map(f => f.id)).toEqual(['ug']);
    expect(nurBusiness(posten).map(p => p.id)).toEqual(['lp2']);   // ohne Firma: Business wie bisher
    expect(vorschau(firmen, [], [], [], HEUTE, 4, false, posten, 'real', undefined, true).start).toBe(22000);
    expect(vorschau(firmen, [], [], [], HEUTE, 4, false, posten, 'real', 'kdc', true).start).toBe(60000);
  });
  it('Lichtfäden: Posten, Zahlungen und Fristen der Selbstständigkeit laufen unter Privat › Finanzen (Gegenprüfung Fund 14)', async () => {
    const { finanzStraenge } = await mit(false, () => import('../lib/lichtfaeden/quellen/finanzen'));
    const s = finanzStraenge({
      heute: HEUTE,
      zahlungen: [{ id: 'z1', titel: 'Büro', faellig: '2026-10-01', status: 'offen', firmaId: 'kdc' }, { id: 'z2', titel: 'GmbH', faellig: '2026-10-01', status: 'offen', firmaId: 'ug' }, { id: 'z3', titel: 'ohne', faellig: '2026-10-01', status: 'offen' }],
      steuer: [{ id: 'kdc-gewst-2026-11-16', datum: '2026-11-16', einheit: 'kdc', titel: 'GewSt', erledigt: false, href: '/x' }],
    });
    const pfad = (id: string) => s.find(x => x.id === id)!.pfad.join('/');
    expect(pfad('zahlung:z1')).toContain('privat');
    expect(pfad('zahlung:z2')).toContain('business');
    expect(pfad('zahlung:z3')).toContain('business');
  });
  it('Kalender: Zahlungen der Selbstständigkeit sind privat (Konten ohne Privat-Recht sehen sie nicht)', async () => {
    const { bereichVonFirma } = await mit(false, () => import('../lib/einheiten'));
    expect([bereichVonFirma('kdc'), bereichVonFirma('ug')]).toEqual(['privat', 'business']);
  });
});

describe('Steuern: gewerblich, gemeinsame Einkommensteuer aus der Finanzplanung (EINE Rechenquelle), Bereichs-Sicht', () => {
  it('estGemeinsamFuer liest genau das Jahr aus estJahre der Finanzplanung (keine zweite Rechnung)', async () => {
    const [{ estGemeinsamFuer }, { estJahre }, { rechneMit, arbeitsplanVon }, { pruefPlan }] = await mit(false, () => Promise.all([
      import('../lib/finanzen/est-gemeinsam'), import('../lib/finanzen/rechenkern'), import('../lib/finanzen/szenarien'), import('./fixtures/finanz-plan'),
    ]));
    const d = pruefPlan();
    const g = rechneMit(d, arbeitsplanVon(d));
    const j = estJahre(g.d, g.kdc, g.ug).find(x => x.jahr === 2026)!;
    const e = estGemeinsamFuer(d, 2026)!;
    expect(e).toMatchObject({ ...j, gewerbe: true });
    expect(e.freibetrag).toBe(24500);
    // Prüfstand finanzplan-5: EINE Steuer 2026 = 8.559 € (zvE 44.170, Gewerbesteuer 1.246 voll angerechnet) — dieselbe Zahl im Steuern-Bereich.
    expect([Math.round(e.summe), Math.round(e.gewst), Math.round(e.zve)]).toEqual([8559, 1246, 44170]);
    expect(estGemeinsamFuer(d, 2040)).toBeNull();
    expect(estGemeinsamFuer(null, 2026)).toBeNull();
  });
  it('Business-Sicht: nur KD Ventures und MAKE — Privates und die Selbstständigkeit werden weder geliefert noch geschrieben', async () => {
    const r = await mit(false, () => import('../lib/steuern/rechnen'));
    const e = { ...r.STANDARD_STEUERN, steuerquote: 30, vorauszahlung: { est: 1000, kst: 200, gewstKdc: 100 }, ruecklageIst: { privat: 1, kdc: 2, kdv: 3 } };
    const f = r.fristen(e, HEUTE);
    const p = r.prognose(e, HEUTE, { kdc: null, kdv: null }, { kdc: 50, kdv: 60 });
    const st = r.steuernNurBusiness({ einstellungen: e, fristen: f, ust: [], prognose: p, gewinn: { kdc: null, kdv: null }, uebergabe: { monat: '2026-08', punkte: [], jahr: 2025, jahresPunkte: r.uebergabeJahr(2025, {}) } });
    expect(new Set(st.fristen.map(x => x.einheit))).toEqual(new Set(['kdv']));
    expect(st.prognose.zeilen.every(z => z.einheit === 'kdv' || z.einheit === 'ug')).toBe(true);
    expect(st.einstellungen).toMatchObject({ steuerquote: null, vorauszahlung: { kst: 200 }, ruecklageIst: { kdv: 3 } });
    expect(JSON.stringify(st.einstellungen.vorauszahlung)).not.toMatch(/est|gewstKdc/);
    expect(st.uebergabe.jahresPunkte.every(x => x.einheit === 'kdv')).toBe(true);
    expect(r.businessSchreibenErlaubt({ einstellungen: { kdc: { ust: 'monatlich' } } })).toMatch(/Privat/);
    expect(r.businessSchreibenErlaubt({ einstellungen: { vorauszahlung: { est: 1 } } })).toMatch(/Privat/);
    expect(r.businessSchreibenErlaubt({ abhaken: { key: 'f:kdc-ust-2026-10-12' } })).toMatch(/Privat/);
    expect(r.businessSchreibenErlaubt({ abhaken: { key: 'j:2025:versicherungen' } })).toMatch(/Privat/);
    expect(r.businessSchreibenErlaubt({ einstellungen: { kdv: { ust: 'monatlich' }, vorauszahlung: { kst: 5 } } })).toBeNull();
    expect(r.businessSchreibenErlaubt({ abhaken: { key: 'f:kdv-kst-2026-12-10' } })).toBeNull();
  });
});

// Kevin hat das am 05.10. abends ausdrücklich BESTÄTIGT (selbst-privat-2, offene Frage 4) — gewollt, kein Zufallsbefund.
describe('Runway Privat zählt das freie Geld der Selbstständigkeit mit (von Kevin bestätigt 05.10.)', () => {
  it('Privatkonto + aufgelaufene Luft + frei der Selbstständigkeit (Monat für Monat)', async () => {
    const [{ rechneMit, arbeitsplanVon, auswertung }, { planFix }] = await mit(false, () => Promise.all([import('../lib/finanzen/szenarien'), import('./fixtures/finanz-plan')]));
    const d = planFix();
    const g = rechneMit(d, arbeitsplanVon(d));
    const aw = auswertung(g.d, g.ug, g.pr, g.kdc);
    // Unabhängig nachgerechnet: erster Monat ab jetzt, in dem Privat + Selbstständigkeit unter null fallen.
    const m0 = aw.m0, N = g.ug.length;
    let kum = 0, nachher = null as number | null, vorher = null as number | null;
    for (let m = 1; m <= N; m++) {
      if (m >= m0) kum += g.pr[m - 1].luft;
      const basis = aw.frei.privatKonten + kum;
      if (m >= m0 && nachher === null && basis + g.kdc[m - 1].frei < -0.5) nachher = m - m0;
      if (m >= m0 && vorher === null && basis < -0.5) vorher = m - m0;
    }
    expect(aw.runway.privat).toBe(nachher);
    // planFix: Privat allein fällt sofort unter null (Runway 0), mit dem freien Geld der Selbstständigkeit im Planzeitraum nie (null).
    expect([vorher, nachher]).toEqual([0, null]);
  });
});
