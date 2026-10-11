// Inbox-Flows (09.10.): der Ziel-Vorschlag aus einem Gespräch (rein) — Kontakt → Firma → aktives Mandat → Mandanten-Space/Kundenprojekt,
// Privat bleibt Privat, Art. 18 ohne Person, frühere Aufgabe aus demselben Gespräch gewinnt; Ablage-Vorschlag und -Bezüge.
import { describe, it, expect } from 'vitest';
import {
  ablageLink, ablageVorschlag, aufgabenAusGespraech, aufgabenZiel, bereichWechsel, bezugFuer, crmAblageBezug, crmTypPasst, dateiArtAusName,
  mailAlsText, projektFuer, raumVonPostfach, spaceFuer, type ZielEingabe,
} from '@/lib/inbox/flows';
import { BUSINESS_VORGABE_SPACE } from '@/lib/einheiten';

const G = 'im~pf-0b2c4d6e-0000-4000-8000-000000000001~0123456789abcdef0123';
const LINK = `/os/inbox?offen=${G}`;
const basis = (x: Partial<ZielEingabe> = {}): ZielEingabe => ({
  gespraechId: G, bereich: 'kdv', zuordnung: { kontaktId: 'c-anna', firmaId: 'f-kunde', dealId: 'd-1' },
  mandate: [{ id: 'm-alt', firmaId: 'f-kunde', status: 'beendet' }, { id: 'm1', firmaId: 'f-kunde', status: 'aktiv' }],
  spaces: [{ id: 'privat' }, { id: 'kdc' }, { id: 'kdv' }, { id: 'ug' }, { id: 'm-f-kunde' }],
  tasks: [], projects: [], listen: [], ...x,
});
const t = (id: string, x: Partial<ZielEingabe['tasks'][number]>) => ({ id, spaceId: 'kdv', projectId: 'sonstige-kdv', createdAt: '2026-10-01T10:00:00Z', status: 'todo' as const, ...x });

describe('Space-Vorschlag', () => {
  it('Business-Postfach + Firma mit AKTIVEM Mandat → Mandanten-Space, Bezug mit Mandat', () => {
    expect(spaceFuer(basis())).toEqual({ spaceId: 'm-f-kunde', grund: 'aktives Mandat der Firma' });
    expect(bezugFuer(basis())).toEqual({ kontaktId: 'c-anna', firmaId: 'f-kunde', mandatId: 'm1', dealId: 'd-1' });
  });
  it('ohne aktives Mandat → Gesellschaft des Postfachs; ohne feste Gesellschaft → Business-Vorgabe der Instanz', () => {
    expect(spaceFuer(basis({ mandate: [{ id: 'm-alt', firmaId: 'f-kunde', status: 'beendet' }] })).spaceId).toBe('kdv');
    expect(spaceFuer(basis({ bereich: null, zuordnung: null })).spaceId).toBe('privat'); // ohne Bereich = Privat (EINE Regel, Prüf-Fund 11.10.)
    expect(spaceFuer(basis({ bereich: 'g-0b2c4d6e-0000-4000-8000-000000000009', zuordnung: null })).spaceId).toBe(BUSINESS_VORGABE_SPACE);
    expect(bezugFuer(basis({ mandate: [] }))).toEqual({ kontaktId: 'c-anna', firmaId: 'f-kunde', dealId: 'd-1' });
  });
  it('Mandanten-Space nur, wenn es ihn (nicht im Archiv) gibt', () => {
    expect(spaceFuer(basis({ spaces: [{ id: 'kdv' }, { id: 'm-f-kunde', archiv: true }] })).spaceId).toBe('kdv');
  });
  it('Privat-Postfach bleibt Privat — auch mit Firma + Mandat; Privat-Einheit (Selbstständigkeit) → ihr Space', () => {
    expect(spaceFuer(basis({ bereich: 'privat' })).spaceId).toBe('privat');
    expect(spaceFuer(basis({ bereich: 'kdc' })).spaceId).toBe('kdc');
    expect(raumVonPostfach('privat')).toBe('privat');
    expect(raumVonPostfach(null)).toBe('privat'); // EINE Regel (Prüf-Fund 11.10.): ohne Bereich Privat
  });
  it('Art. 18: der Bezug nennt die Person nicht (nur Firma/Deal/Mandat)', () => {
    expect(bezugFuer(basis({ zuordnung: { kontaktId: 'c-eva', firmaId: 'f-kunde', sperre: 'eingeschraenkt' } }))).toEqual({ firmaId: 'f-kunde', mandatId: 'm1' });
    expect(bezugFuer(basis({ zuordnung: { kontaktId: 'c-eva', sperre: 'eingeschraenkt' } }))).toBeUndefined();
  });
});

describe('Projekt- und Listen-Vorschlag', () => {
  const projekte = [
    { id: 'p-kunde', title: 'Einführung', spaceId: 'm-f-kunde', archived: false },
    { id: 'p-zu', title: 'Alt', spaceId: 'm-f-kunde', archived: false, status: 'abgeschlossen' as const },
    { id: 'p-a', title: 'Vertrieb', spaceId: 'kdv', archived: false }, { id: 'p-b', title: 'Intern', spaceId: 'kdv', archived: false },
  ];
  it('im Mandanten-Space mit genau EINEM laufenden Projekt → das Kundenprojekt', () => {
    expect(projektFuer(basis({ projects: projekte }), 'm-f-kunde')).toEqual({ projectId: 'p-kunde', grund: 'das Kundenprojekt' });
  });
  it('wo schon die meisten Aufgaben zu Person/Firma liegen — mit der häufigsten Liste', () => {
    const e = basis({
      projects: projekte, listen: [{ id: 'l1', projektId: 'p-a' }, { id: 'l2', projektId: 'p-a', archiviert: true }],
      tasks: [t('1', { projectId: 'p-a', listeId: 'l1', bezug: { kontaktId: 'c-anna' } }), t('2', { projectId: 'p-a', listeId: 'l2', bezug: { firmaId: 'f-kunde' } }), t('3', { projectId: 'p-b', bezug: { kontaktId: 'c-anna' } }), t('4', { projectId: 'p-b', bezug: { kontaktId: 'c-fremd' } }), t('5', { projectId: 'p-b' })],
    });
    expect(projektFuer(e, 'kdv')).toMatchObject({ projectId: 'p-a', listeId: 'l1' });
  });
  it('sonst „Sonstige“ des Space', () => {
    expect(projektFuer(basis({ projects: projekte }), 'kdv')).toEqual({ projectId: 'sonstige-kdv' });
  });
  it('ganzer Vorschlag: Mandant + Kundenprojekt + Bezug', () => {
    expect(aufgabenZiel(basis({ projects: projekte }))).toEqual({ spaceId: 'm-f-kunde', projectId: 'p-kunde', bezug: { kontaktId: 'c-anna', firmaId: 'f-kunde', mandatId: 'm1', dealId: 'd-1' }, grund: 'aktives Mandat der Firma · das Kundenprojekt' });
  });
  it('eine frühere Aufgabe aus DIESEM Gespräch gewinnt (gleicher Ort) — aber nie über die Bereichsgrenze', () => {
    const frueher = t('alt', { spaceId: 'kdv', projectId: 'p-b', description: `Aus der Inbox · Anna <anna@example.invalid>\n${LINK}` });
    expect(aufgabenZiel(basis({ projects: projekte, tasks: [frueher] }))).toMatchObject({ spaceId: 'kdv', projectId: 'p-b', grund: 'wie die letzte Aufgabe aus diesem Gespräch' });
    const privat = t('alt2', { spaceId: 'privat', projectId: 'sonstige-privat', description: LINK });
    expect(aufgabenZiel(basis({ projects: projekte, tasks: [privat] })).spaceId).toBe('m-f-kunde');
  });
  it('Link-Erkennung trifft genau dieses Gespräch (kein Präfix eines anderen)', () => {
    const a = t('a', { description: `x\n${LINK}` }), b = t('b', { description: `x\n${LINK}9` }), c = t('c', { description: `https://os.example.invalid${LINK}` });
    expect(aufgabenAusGespraech([a, b, c], G).map(x => x.id).sort()).toEqual(['a', 'c']);
  });
});

describe('Ablage', () => {
  it('Bezüge: Art. 18 nie; Werbesperre nicht an der Person (Firma ja, ohne Firma gar nicht)', () => {
    expect(crmAblageBezug(null).ok).toBe(false);
    expect(crmAblageBezug({ kontaktId: 'c-eva', firmaId: 'f', sperre: 'eingeschraenkt' }).ok).toBe(false);
    expect(crmAblageBezug({ kontaktId: 'c-w', firmaId: 'f', sperre: 'werbesperre' })).toEqual({ ok: true, bezug: { firmaId: 'f' } });
    expect(crmAblageBezug({ kontaktId: 'c-w', sperre: 'werbesperre' }).ok).toBe(false);
    expect(crmAblageBezug({ kontaktId: 'c-anna', firmaId: 'f', dealId: 'd' })).toEqual({ ok: true, bezug: { kontaktId: 'c-anna', firmaId: 'f', dealId: 'd' } });
  });
  it('Vorschlag: Beleg (Geld & Papier, Gesellschaft), an die Aufgabe aus dem Gespräch, an Firma/Kontakt, sonst Projekt', () => {
    const z = { kontaktId: 'c-anna', firmaId: 'f' };
    expect(ablageVorschlag({ fach: 'geld', bereich: 'kdv', zuordnung: z, anhang: { name: 'Rechnung.pdf', typ: 'application/pdf' }, ausGespraech: 0 })).toBe('beleg');
    expect(ablageVorschlag({ fach: 'geld', bereich: 'privat', zuordnung: z, anhang: { name: 'Rechnung.pdf', typ: 'application/pdf' }, ausGespraech: 0 })).toBe('projekt');
    expect(ablageVorschlag({ fach: 'antworten', bereich: 'kdv', zuordnung: z, anhang: { name: 'Vertrag.pdf', typ: 'application/pdf' }, ausGespraech: 1 })).toBe('projekt');
    expect(ablageVorschlag({ fach: 'antworten', bereich: 'kdv', zuordnung: z, anhang: { name: 'Vertrag.pdf', typ: 'application/pdf' }, ausGespraech: 0 })).toBe('crm');
    expect(ablageVorschlag({ fach: 'antworten', bereich: 'kdv', zuordnung: z, anhang: { name: 'Liste.xlsx', typ: 'application/vnd.ms-excel' }, ausGespraech: 0 })).toBe('projekt');
    expect(ablageVorschlag({ fach: 'antworten', bereich: 'privat', zuordnung: z, ausGespraech: 0 })).toBe('projekt');
  });
  it('Art aus dem Namen, CRM-Typen, Bereichswechsel, Link', () => {
    expect(dateiArtAusName('Rahmenvertrag_2026.pdf')).toBe('vertrag');
    expect(dateiArtAusName('Angebot A-17.pdf')).toBe('angebot');
    expect(dateiArtAusName('Invoice 12.pdf')).toBe('rechnung');
    expect(dateiArtAusName('Foto.jpg')).toBe('sonstig');
    expect(crmTypPasst('a.PDF')).toBe(true); expect(crmTypPasst('a.xlsx')).toBe(false);
    expect(bereichWechsel('privat', 'business')).toBe(true); expect(bereichWechsel('kdv', 'business')).toBe(false); expect(bereichWechsel(null, 'privat')).toBe(false); expect(bereichWechsel(null, 'business')).toBe(true); // ohne Bereich = Privat (Prüf-Fund 11.10.)
    expect(ablageLink({ art: 'crm', firmaId: 'f' })).toContain('firmen');
    expect(ablageLink({ art: 'projekt', spaceId: 'kdv', projektId: 'p-a' })).toContain('t=dateien');
    expect(ablageLink({ art: 'projekt', spaceId: 'kdv', projektId: 'p-a', aufgabeId: 't1' })).toContain('offen=t1');
  });
  it('Mail als Text: Kopf + Text, ohne Steuerzeichen, sprechender Name', () => {
    const m = mailAlsText({ von: { email: 'anna@example.invalid', name: 'Anna' }, an: [{ email: 'ich@example.invalid' }], cc: [], am: '2026-10-09T08:00:00Z', betreff: 'Re: Vertrag/Entwurf', text: 'Hallo\u0007 Welt' });
    expect(m.name).toBe('Mail 2026-10-09 Re Vertrag Entwurf.txt');
    expect(m.text).toContain('Von: Anna <anna@example.invalid>');
    expect(m.text).toContain('Betreff: Re: Vertrag/Entwurf');
    expect(m.text).not.toContain('\u0007');
  });
});
