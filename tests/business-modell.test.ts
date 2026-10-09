// Business-Modell (25.09.): Geschäftsmodell-Kennzahlen, die Punkte hinter jeder
// Kachel (2–3, verlinkt) und dass kein Link ins Leere zeigt.
import { describe, it, expect, vi } from 'vitest';
// 05.10. (Selbstständigkeit → Privat): Diese Datei prüft die MECHANIK des Business-Index mit der Selbstständigkeit als Business-Firma —
// das ist weiter eine gültige Instanz-Einstellung (`NEXT_PUBLIC_MAKE_OS_EINHEITEN` `{"kdc":{"bereich":"business"}}`, lib/einheiten.ts). Unsere
// Instanz (Selbstständigkeit unter Privat) prüft tests/selbst-privat.test.ts mit Vorher → Nachher.
vi.hoisted(() => { process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { bereich: 'business' } }); });

import { berechne } from '../lib/business/index';
import { MESSEN, type Bestand } from '../lib/business/messen';
import { kennzahlenFuer, KENNZAHLEN } from '../lib/business/register';
import { FINANZ_S } from '../lib/finanzen/navigation';
import { geschaeftsmodell } from '../lib/business/modell';
import { WEG } from '../lib/wege';
import type { Mandat, Chance, Leistung } from '../lib/crm/typen';
import type { Planposten } from '../lib/make-one/liquiditaet';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const leer = (x: Partial<Bestand> = {}): Bestand => ({
  heute: HEUTE, scope: 'gesamt', firmen: [], rechnungen: [], zahlungen: [], merkposten: [], planposten: [], finance: null,
  grundlageMonate: [], grundlageFixkosten: {}, abschluesse: [], mandate: [], chancen: [], traktion: { score: null, text: '' },
  termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], fte: {}, mrrVerlauf: {}, ...x,
});
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const chance = (id: string, stufe: Chance['stufe'], x: Partial<Chance> = {}): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 10000, basis: 'einmalig' }, stufe, historie: [{ stufe: 'angebot', am: '2026-03-01T10:00:00Z', von: 'k' }, { stufe, am: '2026-05-01T10:00:00Z', von: 'k' }], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as Chance);
const posten = (id: string, betrag: number, x: Partial<Planposten> = {}): Planposten => ({ id, titel: id, betrag, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc', ...x } as Planposten);
const monate = (von: number, bis: number, u: number, k: number) => Array.from({ length: bis - von + 1 }, (_, i) => ({ monat: `2026-${String(von + i).padStart(2, '0')}`, umsatzNetto: u, kostenNetto: k }));
const wert = (id: string, b: Bestand) => { const m = MESSEN[id](b); if ('luecke' in m) throw new Error(`${id}: ${m.luecke}`); return m.wert; };

describe('Geschäftsmodell-Kennzahlen', () => {
  it('Break-even-Abstand: Fixkosten ÷ Deckungsbeitragsquote gegen den Ø-Umsatz', () => {
    const b = leer({ scope: 'kdc', grundlageMonate: monate(3, 8, 10000, 6000), planposten: [posten('miete', -3000)] });
    // variabel = 6.000 − 3.000; DB-Quote 70 %; Break-even 4.286 €; Abstand (10.000 − 4.286) ÷ 10.000
    expect(wert('break_even', b)).toBeCloseTo(57.14, 1);
    expect(MESSEN.break_even(b).details?.[2]).toMatchObject({ href: WEG.planposten() });
  });
  it('Auslastung und effektiver Tagessatz aus fakturierten Tagen, Kapazität aus den Einstellungen', () => {
    const b = leer({ scope: 'kdc', kapazitaet: { kdc: 15 }, abschluesse: [
      { firma: 'kdc', monat: '2026-07', umsatz: 12000, kosten: 5000, fakturierteTage: 12 },
      { firma: 'kdc', monat: '2026-08', umsatz: 9000, kosten: 5000, fakturierteTage: 9 },
    ] });
    expect(wert('auslastung', b)).toBeCloseTo(70, 5);
    expect(wert('tagessatz', b)).toBeCloseTo(1000, 5);
    expect(MESSEN.auslastung(leer({ scope: 'kdc' }))).toMatchObject({ luecke: expect.stringContaining('Kapazität'), details: [{ href: WEG.einstellungen() }] });
  });
  it('Wiederkehrender Umsatz, Kundenwert und LTV ÷ CAC', () => {
    const b = leer({ scope: 'kdc', grundlageMonate: monate(1, 8, 10000, 5000), mandate: [
      mandat('a', { kunde: 'Acme', honorar: { betrag: 3000, basis: 'monat', netto: true }, start: '2026-01-25' }),
      mandat('b', { kunde: 'Beta', status: 'beendet', start: '2025-09-25', ende: '2026-03-25' }),
    ], abschluesse: [{ firma: 'kdc', monat: '2026-08', umsatz: 10000, kosten: 5000, marketingVertrieb: 500 }] });
    expect(wert('recurring', b)).toBeCloseTo(30, 5); // 3.000 × 12 ÷ 120.000
    const laufzeit = ((Date.parse('2026-09-25') - Date.parse('2026-01-25')) + (Date.parse('2026-03-25') - Date.parse('2025-09-25'))) / 2 / (30.44 * 86_400_000);
    expect(wert('ltv', b)).toBeCloseTo(((3000 + 1000) / 2) * laufzeit, 0);
    // CAC: 500 × 12 ÷ 2 neue Kunden (Acme 01/26, Beta 09/25 — im 12-Monats-Fenster)
    expect(wert('ltv_cac', b)).toBeCloseTo(wert('ltv', b) / 3000, 5);
  });
  it('Holding: KD Ventures ohne Vertriebs- und Beratungskennzahlen', () => {
    const ids = kennzahlenFuer('kdv').map(k => k.id);
    for (const x of ['win_rate', 'pipeline', 'auslastung', 'tagessatz', 'recurring', 'ltv', 'ltv_cac', 'konzentration']) expect(ids).not.toContain(x);
    expect(ids).toEqual(expect.arrayContaining(['liquiditaet', 'break_even', 'run_rate']));
  });
});

describe('Punkte hinter den Kacheln', () => {
  it('Überfällige Forderungen: jede überfällige Rechnung mit Link, danach die nächsten fälligen', () => {
    const b = leer({ scope: 'kdc', rechnungen: [
      { id: 'r1', kunde: 'Acme', titel: 'Aug', betrag: 4000, status: 'gestellt', faellig: '2026-09-01', nummer: 'RE-7', firmaId: 'kdc' },
      { id: 'r2', kunde: 'Beta', titel: 'Sep', betrag: 1000, status: 'gestellt', faellig: '2026-10-10', firmaId: 'kdc' },
    ] });
    const d = MESSEN.ueberfaellig(b).details!;
    expect(d[0]).toMatchObject({ titel: 'Acme · RE-7', href: '/os/finanzen?s=rechnungen&space=business&r=r1', ampel: 'rot', unter: expect.stringContaining('seit 24 Tagen') });
    expect(d[1]).toMatchObject({ titel: 'Beta', href: '/os/finanzen?s=rechnungen&space=business&r=r2', ampel: 'gruen' });
  });
  it('Kundenkonzentration: die größten Kunden mit Anteil, Link aufs Mandat', () => {
    const b = leer({ mandate: [mandat('a', { kunde: 'Acme', honorar: { betrag: 3000, basis: 'monat', netto: true } }), mandat('b', { kunde: 'Beta' })] });
    expect(MESSEN.konzentration(b).details).toEqual([
      expect.objectContaining({ titel: 'Acme', wert: '75 %', href: '/os/mandate?k=a', ampel: 'rot' }),
      expect.objectContaining({ titel: 'Beta', wert: '25 %', href: '/os/mandate?k=b', ampel: 'gruen' }),
    ]);
  });
  it('Kündigungsrate: beendete Mandate und bald endende, je mit Link', () => {
    const b = leer({ mandate: [mandat('a', { start: '2025-01-01' }), mandat('x', { kunde: 'Ex', start: '2025-01-01', status: 'beendet', ende: '2026-06-30' }), mandat('c', { kunde: 'Bald', start: '2025-01-01', ende: '2026-11-30' })] });
    expect(MESSEN.churn(b).details).toEqual([
      expect.objectContaining({ titel: 'Ex', href: '/os/mandate?k=x', ampel: 'rot' }),
      expect.objectContaining({ titel: 'Bald', href: '/os/mandate?k=c', ampel: 'gelb' }),
    ]);
  });
  it('Win Rate und Pipeline führen zu den Deals', () => {
    const b = leer({ chancen: [chance('g', 'gewonnen'), chance('v', 'verloren', { grund: 'Budget' }), chance('o', 'angebot')] });
    expect(MESSEN.win_rate(b).details?.map(d => d.href)).toEqual(expect.arrayContaining(['/os/markttraktion?s=deals&a=akte&k=g', '/os/markttraktion?s=deals&a=akte&k=v']));
    expect(MESSEN.pipeline(b).details?.[0]).toMatchObject({ titel: 'o', href: '/os/markttraktion?s=deals&a=akte&k=o' });
  });
  it('Fokuszeit: vier Wochen, jede verlinkt auf ihre Woche im Kalender', () => {
    const b = leer({ bloecke: [{ date: '2026-09-22', dauerMin: 240, art: 'fokus' }] });
    const d = MESSEN.fokuszeit(b).details!;
    expect(d).toHaveLength(4);
    // K5 (29.09.): die Woche ist der Modus „Planen“ im Kalender.
    expect(d[0]).toMatchObject({ titel: 'Woche ab 18.09.', wert: '4 h', href: '/os/kalender?modus=planen&tag=2026-09-18' });
  });

  it('kein Link endet im Leeren: jeder Punkt und jedes „so schließen“ zeigt auf eine echte Seite', () => {
    // 08.10. (Aufräumen Etappe 2): Finanzen hat keine Nebenseiten mehr — alles unter /os/finanzen, `s` muss ein echter Ort sein.
    const ERLAUBT_PFAD = /^\/os\/(finanzen|mandate|markttraktion|planung\/(woche|jahr|kapazitaet|meilenstein\/[A-Za-z0-9_~:.-]+|ziel\/[A-Za-z0-9_~:.-]+)|kalender|agenten|aufgaben)(\?[a-z]+=[^&#\s]+(&[a-z]+=[^&#\s]+)*)?(#(abschluss|einstellungen|modell|verlauf|kontostaende|fristen|ruecklage|ust|uebergabe|index|gesamt|altbestand))?$/;
    const ERLAUBT = { test: (h: string) => ERLAUBT_PFAD.test(h) && (!h.startsWith('/os/finanzen') || (FINANZ_S as readonly string[]).includes(new URLSearchParams(h.split(/[?#]/)[1] ?? '').get('s') ?? 'privat')) };
    const b = leer({
      firmen: [{ id: 'kdc', name: 'Consulting', kontostand: 20000, stand: '2026-09-01' }, { id: 'kdv', name: 'KD Ventures', kontostand: null, stand: null }],
      grundlageMonate: monate(1, 8, 10000, 7000), planposten: [posten('miete', -2000), posten('kredit', -500, { kategorie: 'kredite' })],
      rechnungen: [{ id: 'r1', kunde: 'Acme', titel: 'x', betrag: 4000, status: 'bezahlt', datum: '2026-06-01', bezahltAm: '2026-07-20', faellig: '2026-06-15', firmaId: 'kdc' },
        { id: 'r2', kunde: 'Beta', titel: 'y', betrag: 2000, status: 'bezahlt', datum: '2026-07-01', bezahltAm: '2026-07-25', firmaId: 'kdc' },
        { id: 'r3', kunde: 'Gamma', titel: 'z', betrag: 3000, status: 'gestellt', datum: '2026-08-01', faellig: '2026-08-20', firmaId: 'kdc' }],
      mandate: [mandat('a', { kunde: 'Acme', start: '2026-02-01' }), mandat('x', { kunde: 'Ex', start: '2025-01-01', status: 'beendet', ende: '2026-06-30' })],
      chancen: [chance('g', 'gewonnen'), chance('o', 'angebot')],
      traktion: { score: 55, text: 't', welten: [{ id: 'sales', label: 'Sales', score: 55 }] },
      bloecke: [{ date: '2026-09-22', dauerMin: 120, art: 'fokus' }],
      termine: [{ start: '2026-09-21T10:00:00', ende: '2026-09-21T11:00:00' }],
      auftraege: [{ status: 'fertig', beendet: '2026-09-20T10:00:00', name: 'recherche', auftrag: 'Markt prüfen' }],
      meilensteine: [{ titel: 'Launch', bereich: 'business', faellig: '2026-09-01', fortschritt: 40, erledigt: false }],
      abschluesse: [{ firma: 'kdc', monat: '2026-08', umsatz: 10000, kosten: 7000, personal: 3000, marketingVertrieb: 400, eigenkapital: 20000, bilanzsumme: 50000, kurzfrVerbindlichkeiten: 8000, fakturierteTage: 10 }],
      fte: { kdc: 1 }, ziele: { kdc: 150000 }, kapazitaet: { kdc: 15 },
      // Kapazität (04.10.): gemessen, damit auch ihre Punkte geprüft werden.
      kapa: { last4: 90, bedarf4: 144, belastbar4: 160, machbar: { machbar: 1, eng: 1, nicht: 0, ueberfaellig: 0, ohneAufwand: 0, ohneTermin: 0, bewertet: 2 }, machbarAnteil: 75, planTreue: 80, istStdWoche: 29, planStdWoche: 36, pufferStdWoche: 4, erholung: 90, erholungPersonen: 1, engpassWochen: [], kritisch: [{ id: 'ms-1', art: 'meilenstein', titel: 'Launch', status: 'eng', text: 'eng' }, { id: 'z-1', art: 'ziel', titel: 'Ziel', status: 'eng', text: 'eng' }] },
    });
    const hrefs: string[] = [];
    for (const scope of ['gesamt', 'kdc', 'kdv'] as const) {
      const bi = berechne({ ...b, scope });
      for (const k of bi.saeulen.flatMap(s => s.kennzahlen)) {
        if (k.pflegen) hrefs.push(k.pflegen.href);
        for (const d of k.details) if (d.href) hrefs.push(d.href);
      }
    }
    expect(hrefs.length).toBeGreaterThan(60);
    expect(hrefs.filter(h => !ERLAUBT.test(h))).toEqual([]);
    // Jede gemessene Kennzahl der Gesamtsicht hat mindestens einen Punkt dahinter.
    const ohne = berechne(b).saeulen.flatMap(s => s.kennzahlen).filter(k => k.gemessen && !k.details.length).map(k => k.id);
    expect(ohne).toEqual([]);
    expect(KENNZAHLEN.every(k => !k.pflegen || ERLAUBT.test(k.pflegen.href))).toBe(true);
  });
});

describe('Geschäftsmodell-Karte', () => {
  it('Umsatz je Linie und Produkt, Mandate mit Fixkosten-Deckung, Links auf Produkt und Mandat', () => {
    const l = (id: string, typ: Leistung['typ']): Leistung => ({ id, name: `Produkt ${id}`, typ, stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'kdc', status: 'aktiv', geaendert: J });
    const m = geschaeftsmodell([
      mandat('a', { kunde: 'Acme', leistungId: 'l1', honorar: { betrag: 3000, basis: 'monat', netto: true } }),
      mandat('b', { kunde: 'Beta' }),
      mandat('c', { kunde: 'Gamma', leistungId: 'l2', honorar: { betrag: 6000, basis: 'einmalig', netto: true } }),
      mandat('d', { kunde: 'Holding', gesellschaft: 'kdv' }),
    ], [l('l1', 'retainer'), l('l2', 'workshop')], 'kdc', 4000);
    expect(m.mrr).toBe(4000);
    expect(m.einmalig).toBe(6000);
    expect(m.fixDeckung).toBe(1);
    expect(m.linien.map(x => x.titel)).toEqual(['Beratung & Begleitung', 'Ohne Produkt', 'Workshops & Formate']);
    expect(m.linien[0].produkte[0]).toMatchObject({ titel: 'Produkt l1', href: '/os/mandate?s=produkte&k=l1', anteil: 3000 / 4500 });
    expect(m.mandate[0]).toMatchObject({ titel: 'Acme', href: '/os/mandate?k=a', fixDeckung: 0.75 });
    expect(m.ohneProdukt).toBe(1);
  });
});

// ── Nahtstellen 09.10.: „kein Link ins Leere“ auch für die Stellen der Nacht (Markttraktion W1/W2, Onboarding U2) ─────────────────────
// Sprungziele der Markttraktion (`ziel: { s, a }` in Für dich, Zuletzt im Team, Übergaben, Trichter, Befunde) lösen über `aufloesen` auf
// einen echten Bereich mit einer echten Ansicht auf; jede Adresse (Onboarding-Schritte, Datenkarte, Ebenen, `href` der Ziele) zeigt auf
// eine Seite unter app/os.
describe('Nahtstellen: Sprungziele der Markttraktion und des Onboardings zeigen auf echte Orte', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const path = await import('node:path');
  const A = await import('../lib/crm/adresse');
  /** Alle Seiten unter app/os als Muster (dynamische Segmente = ein Pfadstück). */
  const seiten: RegExp[] = [];
  const lauf = (dir: string) => { for (const n of readdirSync(dir)) { const p = path.join(dir, n); if (statSync(p).isDirectory()) lauf(p); else if (n === 'page.tsx') seiten.push(new RegExp(`^${p.replace(/^app/, '').replace(/[\\/]page\.tsx$/, '').replace(/\\/g, '/').replace(/\[[^\]]+\]/g, '[^/]+')}$`)); } };
  lauf('app/os');
  const seiteDa = (href: string) => { const pfad = href.split(/[?#]/)[0].replace(/\/$/, '') || '/os'; return seiten.some(r => r.test(pfad)); };
  /** Gültige Ansichten je Bereich (die Listen aus lib/crm/adresse.ts; Kontakte/Firmen/Stammdaten: die Ansichten der Kartei bzw. Unterreiter). */
  const KARTEI = ['akte', 'runde-kreis', 'runde-vernetzen', 'alle', 'kunden', 'kreis', 'prio', 'chancen', 'mail', 'anreichern', 'art14', 'gesperrt', 'dubletten', 'dublette-pruefen', 'lead-pruefen', 'archiv'];
  const ANSICHTEN: Record<string, readonly string[]> = {
    deals: A.DEALS_ANSICHTEN, followup: A.FOLLOWUP_ANSICHTEN, qualifizierung: A.QUALI_ANSICHTEN, marketing: A.MARKETING_ANSICHTEN, besuche: A.BESUCHE_ANSICHTEN,
    kontakte: KARTEI, firmen: KARTEI, stammdaten: ['uebersicht', 'qualitaet', 'wertelisten', 'gesellschaften', 'datenschutz', 'austausch'], event: [], ueberblick: [], angebot: [],
  };
  const zielOk = (s: string, a?: string): string | null => {
    const z = A.aufloesen(s, a);
    if (!(A.BEREICHE as string[]).includes(z.s)) return `${s}/${a ?? ''}: kein Bereich`;
    if (z.a && !(ANSICHTEN[z.s] ?? []).includes(z.a)) return `${s}/${a ?? ''} → ${z.s}/${z.a}: keine Ansicht`;
    return null;
  };

  it('jedes Sprungziel `{ s, a }` in Für dich, Zuletzt im Team, Übergaben, Trichter und Befunde löst auf eine echte Ansicht auf', () => {
    const quellen = ['lib/crm/team.ts', 'lib/crm/traktion.ts', 'lib/crm/leads.ts'].map(f => readFileSync(f, 'utf8')).join('\n');
    const ziele = Array.from(quellen.matchAll(/ziel: \{ s: '([a-z]+)'(?:, a: '([a-z-]+)')?/g)).map(m => ({ s: m[1], a: m[2] }));
    const befunde = Array.from(readFileSync('lib/crm/befunde.ts', 'utf8').matchAll(/bereich: '([a-z]+)'(?:, ansicht: '([a-z-]+)')?/g)).map(m => ({ s: m[1], a: m[2] }));
    expect(ziele.length).toBeGreaterThan(20);
    expect(befunde.length).toBeGreaterThan(15);
    expect([...ziele, ...befunde].map(z => zielOk(z.s, z.a)).filter(Boolean)).toEqual([]);
  });

  it('Onboarding: jede Adresse der Schritte, Etappen, Ebenen und der Datenkarte zeigt auf eine echte Seite', async () => {
    const O = await import('../lib/make-one/onboarding-data');
    const hrefs: string[] = [];
    const sammeln = (x: unknown): void => {
      if (typeof x === 'string') { if (x.startsWith('/os')) hrefs.push(x); return; }
      if (Array.isArray(x)) { x.forEach(sammeln); return; }
      if (x && typeof x === 'object') Object.values(x).forEach(sammeln);
    };
    sammeln([O.SCHRITTE, O.ETAPPEN, O.EBENEN, O.DATENKARTE]);
    expect(hrefs.length).toBeGreaterThan(50);
    expect(hrefs.filter(h => !seiteDa(h))).toEqual([]);
    // Sprünge in die Markttraktion: echte Ansicht.
    const mt = hrefs.filter(h => h.startsWith(A.PFAD)).map(h => new URLSearchParams(h.split('?')[1] ?? '')).map(q => zielOk(q.get('s') ?? 'ueberblick', q.get('a') ?? undefined));
    expect(mt.filter(Boolean)).toEqual([]);
  });

  it('`href` der Ziele (Mandat, „Nicht zugeordnet“, Kreis-Runde) und WEG-Sprünge der Nacht zeigen auf echte Seiten', () => {
    const neu = [WEG.mandat(), WEG.mandat('m-1'), WEG.nichtZugeordnet(), WEG.kreisRunde(), WEG.followup('woche'), WEG.qualifizierung(), WEG.akte('c-1'), WEG.deal('ch-1'), WEG.netzwerken({}), WEG.netzwerkenKarte()];
    expect(neu.filter(h => !seiteDa(h))).toEqual([]);
    for (const h of neu.filter(x => x.startsWith(A.PFAD))) {
      const q = new URLSearchParams(h.split('?')[1] ?? '');
      expect(zielOk(q.get('s') ?? 'ueberblick', q.get('a') ?? undefined), h).toBeNull();
    }
  });
});
