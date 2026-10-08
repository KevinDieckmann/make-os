// ─── Aufgaben ↔ CRM und Flächen (28.09. abends) ─────────────────────────────
// Schnellsuche über die Kartei (eine Such-Normalisierung), Bezug setzen/lösen, Aufgaben einer Akte, Links in die Akte;
// Standard-Space je Fläche (nichts Privates auf Business-Flächen). Nur erfundene Daten.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { crmSuchen, bezugSetzen, bezugOhne, bezugName, bezugLink, aufgabenFuer, type CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import { spaceAusFlaeche } from '@/lib/flaeche/space';
import type { Task } from '@/types/tasks';

const v: CrmVerweise = {
  kontakte: [{ id: 'c-anna-mueller', name: 'Anna Müller', firmaId: 'f-beispiel', firma: 'Beispiel GmbH' }, { id: 'c-bert', name: 'Bert Probe' }],
  firmen: [{ id: 'f-beispiel', name: 'Beispiel GmbH' }, { id: 'f-andere', name: 'Andere AG' }],
  mandate: [{ id: 'mandat-1', titel: 'Buchhaltung 2026', kunde: 'Beispiel GmbH', status: 'aktiv', firmaId: 'f-beispiel' }],
  deals: [{ id: 'deal-1', titel: 'Strategie-Workshop', stufe: 'angebot', firmaId: 'f-andere', firma: 'Andere AG' }],
};
const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: id, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, ...extra });

describe('CRM-Verknüpfung', () => {
  it('Schnellsuche: „mueller“ findet „Müller“, Firma findet Personen, Mandate und Deals', () => {
    expect(crmSuchen(v, 'mueller').map(t => [t.art, t.id])).toEqual([['kontaktId', 'c-anna-mueller']]);
    expect(crmSuchen(v, 'beispiel').map(t => t.art)).toEqual(['kontaktId', 'firmaId', 'mandatId']);
    expect(crmSuchen(v, 'workshop')[0]).toMatchObject({ art: 'dealId', id: 'deal-1', unter: 'Andere AG' });
    expect(crmSuchen(v, '  ')).toEqual([]);
    expect(crmSuchen(null, 'anna')).toEqual([]);
  });
  it('Bezug setzen: Mandat/Deal/Kontakt bringen ihre Firma mit (wenn keine gesetzt), lösen entfernt nur ein Feld', () => {
    expect(bezugSetzen(undefined, { art: 'mandatId', id: 'mandat-1' }, v)).toEqual({ mandatId: 'mandat-1', firmaId: 'f-beispiel' });
    expect(bezugSetzen({ firmaId: 'f-x' }, { art: 'dealId', id: 'deal-1' }, v)).toEqual({ firmaId: 'f-x', dealId: 'deal-1' });
    expect(bezugOhne({ kontaktId: 'c-bert', firmaId: 'f-x' }, 'kontaktId')).toEqual({ firmaId: 'f-x' });
    expect(bezugOhne({ kontaktId: 'c-bert' }, 'kontaktId')).toBeUndefined();
    expect(bezugName(v, 'dealId', 'deal-1')).toBe('Strategie-Workshop');
    expect(bezugName(v, 'firmaId', 'f-weg')).toBeUndefined();
  });
  it('Links in die Akte über die eine Adress-Quelle', () => {
    expect(bezugLink('kontaktId', 'c-bert')).toMatch(/^\/os\/markttraktion\?.*k=c-bert/);
    expect(bezugLink('firmaId', 'f-beispiel')).toMatch(/^\/os\/markttraktion\?.*s=firmen.*k=f-beispiel/);
    expect(bezugLink('mandatId', 'mandat-1')).toBe('/os/mandate?k=mandat-1');
    expect(bezugLink('dealId', 'deal-1')).toMatch(/s=deals.*a=akte.*k=deal-1/);
  });
  it('Aufgaben einer Akte: Kontakt direkt; Firma direkt oder über ihre Mandate/Deals', () => {
    const tasks = [aufgabe('a', { bezug: { kontaktId: 'c-bert' } }), aufgabe('b', { bezug: { mandatId: 'mandat-1' } }), aufgabe('c', { bezug: { firmaId: 'f-beispiel' } }), aufgabe('d', { bezug: { dealId: 'deal-1' } }), aufgabe('e')];
    expect(aufgabenFuer(tasks, { kontaktId: 'c-bert' }).map(t => t.id)).toEqual(['a']);
    expect(aufgabenFuer(tasks, { firmaId: 'f-beispiel', mandatIds: ['mandat-1'] }).map(t => t.id)).toEqual(['b', 'c']);
    expect(aufgabenFuer(tasks, { firmaId: 'f-andere', dealIds: ['deal-1'] }).map(t => t.id)).toEqual(['d']);
  });
});

describe('Flächen: Privates auf private, Business auf Business-Flächen', () => {
  it('Standard-Space je Fläche', () => {
    expect(spaceAusFlaeche('uebersicht-privat')).toBe('privat');
    expect(spaceAusFlaeche('gesundheit-heute')).toBe('privat');
    expect(spaceAusFlaeche('ernaehrung')).toBe('privat');
    expect(spaceAusFlaeche('uebersicht-business')).toBe('business');
    expect(spaceAusFlaeche('markttraktion-event')).toBe('business');
    expect(spaceAusFlaeche('home')).toBe('alle');
    expect(spaceAusFlaeche(undefined)).toBe('alle');
  });
  // 08.10. (Aufräumen Etappe 1): Home und die Übersichten je Space sind EINE Seite „Heute“ (components/os/HeuteView.tsx) —
  // die Standards je Sicht stehen dort, die Flächen-Kennungen sind die alten.
  it('Heute je Sicht: Aufgaben-Widgets je Space, keins mischt auf einer Space-Fläche', () => {
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/HeuteView.tsx'), 'utf8');
    const std = quelle.slice(quelle.indexOf('export const HEUTE_STANDARD'));
    const alle = std.slice(std.indexOf('alle: ['), std.indexOf('privat: ['));
    const privat = std.slice(std.indexOf('privat: ['), std.indexOf('business: ['));
    const business = std.slice(std.indexOf('business: ['), std.indexOf('\n};'));
    expect(privat).toMatch(/art: 'aufgaben'[^}]*space: 'privat'/);
    expect(privat).not.toMatch(/space: 'business'/);
    expect(business).toMatch(/art: 'aufgaben'[^}]*space: 'business'/);
    expect(business).not.toMatch(/space: 'privat'/);
    expect(alle).toMatch(/id: 'aufgaben-privat', art: 'aufgaben'[^}]*space: 'privat'/);
    expect(alle).toMatch(/id: 'aufgaben-business', art: 'aufgaben'[^}]*space: 'business'/);
    expect(quelle).toContain("HEUTE_FLAECHE: Record<HeuteSicht, string> = { alle: 'home', privat: 'uebersicht-privat', business: 'uebersicht-business' }");
    // Das Widget nimmt ohne Einstellung den Space seiner Fläche (Flaeche reicht `seite` durch).
    expect(readFileSync(path.join(process.cwd(), 'components/os/flaeche/Flaeche.tsx'), 'utf8')).toContain('seite={seite}');
    expect(readFileSync(path.join(process.cwd(), 'components/os/flaeche/widgets.tsx'), 'utf8')).toContain('str(e.space, spaceAusFlaeche(seite))');
  });
});
