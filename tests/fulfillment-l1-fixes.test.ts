// Gesamtprüfung 17.10. — Linse 1 (Ende zu Ende): Funde, die die Regeln betreffen. Erfundene Daten, rein.
import { describe, it, expect } from 'vitest';
import { willkommenUhr } from '@/lib/fulfillment/prozesse/onboarding';
import { tagKurz } from '@/components/os/fulfillment/prozesse/daten';

describe('B2 · Willkommens-Uhr', () => {
  it('nur der Tag der Unterschrift bekannt: die 24 Stunden laufen ab dem Ende dieses Tages', () => {
    const u = willkommenUhr('2026-10-17', 24, undefined, '2026-10-17T19:00:00.000Z');
    expect(u.faellig).toBe('2026-10-18T22:00:00.000Z');
    expect(u.ueberfaellig).toBe(false);
    expect(u.restStunden).toBe(27);
  });
  it('mit Uhrzeit gilt die Uhrzeit', () => {
    expect(willkommenUhr('2026-10-17T18:53:00.000Z', 24, undefined, '2026-10-17T19:00:00.000Z').faellig).toBe('2026-10-18T18:53:00.000Z');
  });
  it('Datum eines Zeitstempels als Berliner Tag — nie der UTC-Tag', () => {
    expect(tagKurz('2026-10-17T22:00:00.000Z')).toBe('18.10.');
    expect(tagKurz('2026-10-17')).toBe('17.10.');
  });
});

describe('B1 · Eine Bestätigung schließt keine Phase mit offenen Schritten', () => {
  it('nur der Bestätigungs-Schritt wird erledigt; die Phase bleibt offen, bis ihre Schritte fertig sind', async () => {
    const { fallAnwenden } = await import('@/lib/fulfillment/prozesse/fall');
    const { phaseFertig } = await import('@/lib/fulfillment/regeln');
    const J = '2026-10-17T10:00:00.000Z';
    const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Record<string, unknown> = {}) => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
    const fall = {
      mandatId: 'm-b1', vorlageId: 'v', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', freigaben: {}, onboarding: {},
      knoten: [k('w', undefined, 'A', 1), k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k('s1', 'p1', 'Kick-off', 1), k('s2', 'p1', 'Zugänge', 2, { status: 'erledigt' }), k('fg', 'p1', 'Abnahme', 3, { freigabe: 'F1' })],
      stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia',
    } as never;
    const ctx = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: () => 's', neueId: (p: string) => `${p}-x`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['F0', 'F1'] };
    const r = fallAnwenden(fall, [{ op: 'freigabe', id: 'F0' }, { op: 'freigabe', id: 'F1' }], ctx as never);
    if (!r.ok) throw new Error(r.fehler);
    const p1 = r.datei.knoten.find(x => x.id === 'p1')!;
    expect(p1.status).toBe('offen');
    expect(phaseFertig(p1, r.datei.knoten)).toBe(false);
    expect(r.datei.knoten.find(x => x.id === 'fg')!.status).toBe('erledigt');
    expect(r.datei.freigaben.F0).toBeDefined();
  });
});

describe('B4 · Angebot aus dem Deal: der Wert des Deals gilt', () => {
  it('Betrag, Basis und Laufzeit kommen vom Deal; ohne Betrag bleibt das Produkt', async () => {
    const { dealWertUebernehmen } = await import('@/lib/crm/angebote');
    const p = { id: 'p-1', titel: 'Begleitung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 350000, ustSatz: 19, basis: 'monat' as const, laufzeitMonate: 12 };
    expect(dealWertUebernehmen(p, { betrag: 4500, basis: 'monat', laufzeitMonate: 6 })).toMatchObject({ einzelpreisCent: 450000, basis: 'monat', laufzeitMonate: 6 });
    expect(dealWertUebernehmen(p, { betrag: 9000, basis: 'einmalig' })).toMatchObject({ einzelpreisCent: 900000, basis: 'einmalig', einheit: 'pauschal' });
    expect('laufzeitMonate' in dealWertUebernehmen(p, { betrag: 9000, basis: 'einmalig' })).toBe(false);
    expect(dealWertUebernehmen(p, { betrag: 0, basis: 'monat' })).toBe(p);
  });
});

describe('B6 · Kick-off ohne eigenen Kalender vermerken', () => {
  it('der Vermerk erfüllt den Kick-off-Schritt, zurücknehmen macht ihn wieder offen; der Säuberer behält ihn', async () => {
    const { fallAnwenden } = await import('@/lib/fulfillment/prozesse/fall');
    const { onboardingStand } = await import('@/lib/fulfillment/prozesse/onboarding');
    const { faelleAus } = await import('@/lib/fulfillment/lesen');
    const J = '2026-10-17T10:00:00.000Z';
    const fall = {
      mandatId: 'm-b6', vorlageId: 'v', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'onboarding', freigaben: {}, onboarding: {},
      knoten: [{ id: 'w', titel: 'A', rang: 1, status: 'offen' }], stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia',
    } as never;
    const ctx = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: () => 's', neueId: (p: string) => `${p}-x`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: [] };
    const abl = { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: J } as never;
    const r = fallAnwenden(fall, [{ op: 'kickoff-vermerkt' }], ctx as never);
    if (!r.ok) throw new Error(r.fehler);
    expect(onboardingStand(r.datei, abl).schritte.find(x => x.schluessel === 'kickoff')?.erfuellt).toBe(true);
    expect(faelleAus(JSON.parse(JSON.stringify({ version: 1, faelle: { 'm-b6': r.datei } }))).faelle['m-b6'].onboarding.kickoffAm).toBe('2026-10-17');
    const z = fallAnwenden(r.datei, [{ op: 'kickoff-vermerkt', zuruecknehmen: true }], ctx as never);
    if (!z.ok) throw new Error(z.fehler);
    expect(onboardingStand(z.datei, abl).schritte.find(x => x.schluessel === 'kickoff')?.erfuellt).toBe(false);
  });
});

describe('B7 · Mails aus dem Fall im Verlauf der Akte', () => {
  it('MailSenden trägt die Mail nach dem Senden als Aktivität ein — nur an die bekannte Person (Kontakt-Kennung aus dem Entwurf)', async () => {
    const { readFileSync } = await import('node:fs');
    const q = readFileSync('components/os/fulfillment/prozesse/MailSenden.tsx', 'utf8');
    expect(q).toMatch(/\/api\/crm\/aktivitaet/);
    expect(q).toMatch(/entwurf\.an\?\.kontaktId && entwurf\.an\.email === an\.trim\(\)/);
    for (const d of ['app/api/fulfillment/fall/route.ts', 'app/api/fulfillment/wirkung/route.ts', 'lib/fulfillment/prozesse/ausfuehrung-server.ts']) expect(readFileSync(d, 'utf8'), d).toMatch(/kontaktId: k{1,2}\.id/);
  });
});

describe('Ein neuer Fall startet grün', () => {
  it('in den ersten 14 Tagen ist „kein Termin“ kein Warnzeichen (der Kick-off legt ihn fest)', async () => {
    const { kundenAmpel } = await import('@/lib/crm/treppe');
    const mandat = (start: string) => ({ id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
      start, verlaengerung: 'auto', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: '2026-10-15T00:00:00.000Z' }) as never;
    expect(kundenAmpel({ m: mandat('2026-10-15'), stufe: null, f: undefined, heute: '2026-10-17' }).teile.find(t => t.id === 'termine')?.farbe).toBeNull();
    expect(kundenAmpel({ m: mandat('2026-09-01'), stufe: null, f: undefined, heute: '2026-10-17' }).teile.find(t => t.id === 'termine')?.farbe).toBe('gelb');
  });
});

describe('EIN Prädikat „Business-Mandat“ (18.10.: alle Business-Mandate ins Fulfillment)', () => {
  it('feste Business-Gesellschaften, Register-Gesellschaften und „offen“ ja — die Selbstständigkeit (Privat) nein; dieselbe Regel wie das CRM', async () => {
    const { istBusinessMandat } = await import('@/lib/fulfillment/regeln');
    const { imBusiness } = await import('@/lib/crm/treppe');
    for (const g of ['ug', 'kdv', 'offen', 'g-00000000-0000-4000-8000-000000000001', 'kdc']) expect(istBusinessMandat(g), g).toBe(imBusiness({ gesellschaft: g }));
    expect(istBusinessMandat('ug')).toBe(true);
    expect(istBusinessMandat('offen')).toBe(true);
    expect(istBusinessMandat('g-00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(istBusinessMandat('kdc')).toBe(false);
  });
});

describe('B10 · Kapazität am Fall vorschlagen', () => {
  it('Vorschlag für die Zuständige, nur ohne Zuweisung und mit Aufwand; EINE Stunden-Rechnung mit der Treppe', async () => {
    const { kapaVorschlag } = await import('@/lib/fulfillment/prozesse/kapazitaet-vorschlag');
    const { stufeStundenWoche } = await import('@/lib/crm/treppe');
    const personen = [{ id: 'konto-pia' }, { id: 'konto-olaf' }];
    expect(kapaVorschlag({ mandatId: 'm-1', zustaendig: 'olaf', stundenWoche: 8.77, zuweisungen: [], personen })).toEqual({ person: 'konto-olaf', stundenWoche: 8.8 });
    expect(kapaVorschlag({ mandatId: 'm-1', zustaendig: 'olaf', stundenWoche: 8, zuweisungen: [{ art: 'mandat', bezugId: 'm-1' }], personen })).toBeNull();
    expect(kapaVorschlag({ mandatId: 'm-1', zustaendig: 'olaf', stundenWoche: 0, zuweisungen: [], personen })).toBeNull();
    expect(kapaVorschlag({ mandatId: 'm-1', zustaendig: 'beide', stundenWoche: 4, zuweisungen: [], personen })?.person).toBe('konto-pia');
    expect(stufeStundenWoche({ aufwandStunden: 20, preis: { art: 'monat' } as never })).toEqual({ stunden: (20 * 12) / 52, annahme: false });
    expect(stufeStundenWoche({ aufwandStunden: 20, preis: { art: 'fest' } as never })).toEqual({ stunden: 5, annahme: true });
  });
});
