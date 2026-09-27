import { describe, it, expect } from 'vitest';
import { dealRolleVorschlag, kontaktRollenVorschlag, anredeVorschlag, besterEntscheider, warmGrund } from '@/lib/crm/vorschlaege';
import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';

const HEUTE = '2026-09-27';
const k = (extra: Partial<Kontakt> = {}) => ({ id: 'c-a', vorname: 'A', nachname: 'T', stufe: 'neu', eignung: '', prio: '', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, ...extra }) as Kontakt;
const gespraech = (am: string): Aktivitaet => ({ am: `${am}T10:00:00.000Z`, art: 'gespraech', von: 'kevin', ergebnis: 'gespraech' });
const rolle = (extra: Partial<Kontakt>) => dealRolleVorschlag(k(extra), HEUTE);

describe('dealRolleVorschlag — Titel-Varianten', () => {
  it('Geschäftsführung, CEO, Inhaber, Gründer, Vorstand, Managing Partner → Entscheider (deutsch und englisch, Schreibweise egal)', () => {
    for (const position of ['Geschäftsführerin', 'GESCHÄFTSFÜHRER', 'geschaeftsfuehrender Gesellschafter', 'CEO', 'Co-Founder & CTO', 'Inhaberin', 'Gründer', 'Mitgründerin', 'Vorstand Finanzen', 'Managing Partner', 'Managing Director', 'Chief Revenue Officer', 'Owner', 'Präsidentin'])
      expect(rolle({ position })?.id, position).toBe('entscheider');
  });
  it('nennt den Grund im Klartext mit dem Wort aus dem Titel', () => {
    expect(rolle({ position: 'Geschäftsführerin' })).toEqual({ id: 'entscheider', grund: 'Geschäftsführerin laut Position' });
    expect(rolle({ jobtitel: 'CEO' })?.grund).toBe('CEO laut Jobtitel');
  });
  it('Head of / Leitung mit Seniorität C-Level → Entscheider', () => {
    const v = rolle({ position: 'Head of Sales', senioritaet: 'C-Level' });
    expect(v?.id).toBe('entscheider');
    expect(v?.grund).toContain('Head of Sales');
    expect(rolle({ senioritaet: 'c_suite' })?.id).toBe('entscheider');
  });
  it('Assistenz der Geschäftsführung ist keine Geschäftsführung', () => {
    expect(rolle({ position: 'Assistentin der Geschäftsführung' })?.id).toBe('nutzer');
    expect(rolle({ position: 'Executive Assistant to the CEO' })?.id).toBe('nutzer');
    expect(rolle({ position: 'Product Owner' })?.id).not.toBe('entscheider');
    expect(rolle({ position: 'Chief of Staff' })?.id).not.toBe('entscheider');
  });
  it('ehemalige Titel geben keinen Vorschlag', () => {
    expect(rolle({ position: 'ehem. Geschäftsführer' })).toBeNull();
    expect(rolle({ position: 'Former CEO' })).toBeNull();
    expect(rolle({ position: 'Ex-CEO' })).toBeNull();
  });
  it('Referent, Mitarbeiter, Entwickler, Berater, Assistenz → Nutzer', () => {
    for (const position of ['Referentin Marketing', 'Mitarbeiter Vertrieb', 'Softwareentwickler', 'Senior Developer', 'Unternehmensberaterin', 'Consultant', 'Assistenz', 'Werkstudent'])
      expect(rolle({ position })?.id, position).toBe('nutzer');
  });
  it('ohne verwertbaren Titel: kein Vorschlag, nichts erfunden', () => {
    expect(rolle({})).toBeNull();
    expect(rolle({ position: '   ' })).toBeNull();
    expect(rolle({ position: 'Fotografin' })).toBeNull();
  });
});

describe('dealRolleVorschlag — warm oder kalt', () => {
  it('Teamleitung/Bereichsleitung/Head of ist Fürsprecher nur, wenn warm (Gespräch ≤ 90 Tage)', () => {
    const v = rolle({ position: 'Teamleiterin Einkauf', aktivitaeten: [gespraech('2026-09-01')] });
    expect(v?.id).toBe('fuersprecher');
    expect(v?.grund).toContain('Gespräch vor 26 Tagen');
    expect(rolle({ position: 'Bereichsleiter', kreis: 'B' })).toEqual({ id: 'fuersprecher', grund: 'Bereichsleiter laut Position · Kreis B' });
  });
  it('kalt → Nutzer (auch wenn das letzte Gespräch älter als 90 Tage ist)', () => {
    expect(rolle({ position: 'Head of Marketing' })?.id).toBe('nutzer');
    expect(rolle({ position: 'Head of Marketing', aktivitaeten: [gespraech('2026-05-01')] })?.id).toBe('nutzer');
  });
  it('Mailbox und Systemeinträge machen nicht warm', () => {
    const a: Aktivitaet[] = [{ am: '2026-09-20T09:00:00Z', art: 'anruf', von: 'kevin', ergebnis: 'mailbox' }, { am: '2026-09-21T09:00:00Z', art: 'system', von: 'system' }];
    expect(warmGrund(k({ aktivitaeten: a }), HEUTE)).toBeNull();
    expect(rolle({ position: 'Abteilungsleiterin', aktivitaeten: a })?.id).toBe('nutzer');
  });
  it('stellvertretende Geschäftsführung zählt als Leitung, nicht als Entscheider', () => {
    expect(rolle({ position: 'Stellv. Geschäftsführer', kreis: 'A' })?.id).toBe('fuersprecher');
  });
});

describe('dealRolleVorschlag — nie Bremst', () => {
  it('„blocker“ kommt in keiner Variante vor', () => {
    const titel = ['CEO', 'Head of IT', 'Einkauf', 'Datenschutzbeauftragter', 'Betriebsrat', 'Compliance Officer', 'Referent', '', 'Leiter Recht'];
    for (const position of titel) for (const kreis of [undefined, 'A'] as const) expect(rolle({ position, kreis })?.id).not.toBe('blocker');
  });
});

describe('besterEntscheider', () => {
  it('erste Person ohne Rolle mit Vorschlag Entscheider', () => {
    const p = [k({ id: 'a', position: 'Referent' }), k({ id: 'b', position: 'CEO' }), k({ id: 'c', position: 'Inhaberin' })];
    expect(besterEntscheider(p, { personenRollen: {} }, HEUTE)?.kontakt.id).toBe('b');
    expect(besterEntscheider(p, { personenRollen: { b: 'nutzer' } }, HEUTE)?.kontakt.id).toBe('c');
    expect(besterEntscheider([k({ position: 'Referent' })], {}, HEUTE)).toBeNull();
  });
});

describe('kontaktRollenVorschlag', () => {
  it('Typ, Kategorie und Firmen-Rolle → Rollen mit Grund', () => {
    expect(kontaktRollenVorschlag(k({ typ: 'Partner' }))).toEqual([{ id: 'partner', grund: 'Typ „Partner“' }]);
    expect(kontaktRollenVorschlag(k({ typ: 'multiplikator' }))[0]?.id).toBe('multiplikator');
    expect(kontaktRollenVorschlag(k({ kategorie: 'Freunde & Familie' }))[0]).toEqual({ id: 'freund', grund: 'Kategorie „Freunde & Familie“' });
    expect(kontaktRollenVorschlag(k({ kategorie: 'Investor' }))[0]?.id).toBe('investor');
    expect(kontaktRollenVorschlag(k({ typ: 'Service Provider' }))[0]?.id).toBe('dienstleister');
    expect(kontaktRollenVorschlag(k({}), { rolle: 'netzwerk' })).toEqual([{ id: 'netzwerk', grund: 'Firma ist als Netzwerk geführt' }]);
  });
  it('bereits gesetzte Rollen (auch über die alte Lebensphase) werden nicht erneut vorgeschlagen', () => {
    expect(kontaktRollenVorschlag(k({ typ: 'Partner', rollen: ['partner'] }))).toEqual([]);
    expect(kontaktRollenVorschlag(k({ typ: 'Multiplikator', lebensphase: 'multiplikator' }))).toEqual([]);
    expect(kontaktRollenVorschlag(k({ typ: 'Partner', kategorie: 'Investor', rollen: ['investor'] })).map(v => v.id)).toEqual(['partner']);
  });
  it('jede Rolle höchstens einmal; Kunde/Zielkunde/Privat ergeben nichts', () => {
    expect(kontaktRollenVorschlag(k({ typ: 'Partner' }), { rolle: 'partner' })).toHaveLength(1);
    expect(kontaktRollenVorschlag(k({ typ: 'Zielkunde', kategorie: 'Mittelstand' }), { rolle: 'kunde' })).toEqual([]);
    expect(kontaktRollenVorschlag(k({ typ: 'Privat' }))).toEqual([]);
  });
});

describe('anredeVorschlag', () => {
  const nachricht = (text: string, art: Aktivitaet['art'] = 'mail'): Aktivitaet => ({ am: '2026-09-10T10:00:00Z', art, von: 'kevin', text });
  it('Freunde & Familie oder Rolle Freund → Du', () => {
    expect(anredeVorschlag(k({ kategorie: 'Freunde & Familie' }))).toEqual({ id: 'Du', grund: 'Kategorie „Freunde & Familie“' });
    expect(anredeVorschlag(k({ rollen: ['freund'] }))?.id).toBe('Du');
  });
  it('eigene Nachrichten entscheiden nur, wenn eindeutig', () => {
    expect(anredeVorschlag(k({ aktivitaeten: [nachricht('Hallo Max, hast du nächste Woche Zeit?')] }))?.id).toBe('Du');
    expect(anredeVorschlag(k({ aktivitaeten: [nachricht('Guten Tag Frau T, darf ich Ihnen etwas schicken?', 'linkedin')] }))?.id).toBe('Sie');
    expect(anredeVorschlag(k({ aktivitaeten: [nachricht('Hast du Zeit?'), nachricht('Wann passt es Ihnen?')] }))).toBeNull();
  });
  it('Gesprächsnotizen und Systemeinträge zählen nicht; gesetzte Anrede → kein Vorschlag', () => {
    expect(anredeVorschlag(k({ aktivitaeten: [{ am: '2026-09-10', art: 'gespraech', von: 'kevin', text: 'Sie hat Interesse, du weißt schon' }] }))).toBeNull();
    expect(anredeVorschlag(k({ aktivitaeten: [{ am: '2026-09-10', art: 'mail', von: 'system', text: 'Hast du Zeit?' }] }))).toBeNull();
    expect(anredeVorschlag(k({ anrede: 'Sie', kategorie: 'Freunde & Familie' }))).toBeNull();
    expect(anredeVorschlag(k({}))).toBeNull();
  });
});

describe('dealRolleVorschlag — deutsche Zusammensetzungen', () => {
  it('Finanzvorstand, Vertriebsleiterin, Vorstandsreferentin', () => {
    expect(rolle({ position: 'Finanzvorstand' })?.id).toBe('entscheider');
    expect(rolle({ position: 'Vertriebsleiterin', kreis: 'C' })).toEqual({ id: 'fuersprecher', grund: 'Vertriebsleiterin laut Position · Kreis C' });
    expect(rolle({ position: 'Vorstandsreferentin' })?.id).toBe('nutzer');
    expect(rolle({ position: 'Director of Engineering' })?.id).toBe('nutzer');
    expect(rolle({ position: 'Director of Engineering', aktivitaeten: [gespraech('2026-09-26')] })?.grund).toContain('Gespräch gestern');
  });
});
