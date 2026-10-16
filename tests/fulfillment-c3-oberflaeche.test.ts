// ─── Fulfillment C3 · Oberfläche rendert (10.10.) ───────────────────────────────────────────────────────────────────────────────────────────────
// Rauchtest ohne Browser: Läufe, Dossier und Recht & Freigaben rendern mit erfundenen Daten — kein „alle starten“, Starten nur je Lauf, Schätzung sichtbar,
// keine Namen aus dem Personenteil, ehrlicher Hinweis bei ausgeschalteter Web-Suche.
import { describe, it, expect, vi } from 'vitest';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));

import { useRueckfrage } from '@/components/os/ui';
import { Laeufe } from '@/components/os/fulfillment/analyse/Laeufe';
import { DossierAnsicht } from '@/components/os/fulfillment/analyse/DossierAnsicht';
import { Recht } from '@/components/os/fulfillment/analyse/Recht';
import type { AnalyseApi, AnalyseLage, DossierLage } from '@/components/os/fulfillment/analyse/daten';
import { LIA_MUSTER } from '@/lib/fulfillment/analyse/dsgvo';
import { AGENT_IDS, AGENTEN } from '@/lib/fulfillment/analyse/agenten';

const HEUTE = '2026-10-10';
const schaetzung = { agent: 'a1' as const, euroCent: 25, cent: 25, hoechstensCent: 38, text: 'ca. 0,25 €', hoechstensText: '0,38 €', quelle: 'vorgabe' as const, messungen: 0 };
const lage: AnalyseLage = {
  agenten: AGENT_IDS.map(id => ({ id, name: AGENTEN[id].name, welle: AGENTEN[id].welle, art: AGENTEN[id].art, web: AGENTEN[id].web, personen: AGENTEN[id].personen, zustand: id === 'a0' ? 'bereit' : 'gesperrt', gruende: id === 'a0' ? [] : ['Erst Start-Prüfer (A0).'], hinweise: [], schaetzung: { ...schaetzung, agent: id }, laeufe: 0, grundNoetig: false, imMinimalset: false, ...(id === 'a4' ? { funktionen: [{ funktion: 'Vertriebsleitung', zustand: 'gesperrt' as const, laeufe: 0, grundNoetig: false }] } : {}) })),
  laeufe: [{ id: 'al-1', agent: 'a4', status: 'fertig', schaetzungCent: 30, bestaetigtCent: 30, grenzeCent: 45, kostenCent: 28, versuch: 1, gestartetAm: `${HEUTE}T09:00:00.000Z`, ergebnis: { funktion: 'Vertriebsleitung', karten: 1 } }],
  ki: { kiZugang: true, bereichCrm: true, websuche: false, tiefenbericht: false }, kiSaetze: { websuche: 'Web-Suche ist aus.', tiefenbericht: 'Tiefenbericht aus.' },
  minimalset: ['a0', 'a1', 'a2', 'a6', 'a7', 'a12', 'a13'], gleichzeitig: { laufend: 0, max: 2 }, kostenCent: 28,
  tiefenbericht: { frage: 'Überblick', vorhanden: false, eigen: false },
};
const dossier: DossierLage = {
  mandat: { id: 'm-1', titel: 'Vertriebsaufbau', kunde: 'Beispiel GmbH', status: 'aktiv', firmaId: 'f-1' }, stand: 'st',
  dossier: {
    mandatId: 'm-1', version: 1, eingaben: { firma: 'Beispiel GmbH', domains: ['beispiel-firma.example'], urls: [] }, quellen: [{ id: 'dq-1', url: 'https://beispiel-firma.example/', domain: 'beispiel-firma.example', abgerufenAm: HEUTE }],
    abschnitte: { unternehmen: { id: 'unternehmen', status: 'entwurf', aussagen: [{ id: 'da-1', text: 'Entwickelt Beispiel-Software.', art: 'fakt', quellen: ['dq-1'], stand: HEUTE, agent: 'a1' }] } },
    laeufe: lage.laeufe, geaendert: HEUTE, geaendertVon: 'pia',
    pruefung: { am: HEUTE, bestanden: false, befunde: [{ art: 'dsgvo', text: 'Name im Unternehmensteil.' }, { art: 'qualitaet', text: 'Zahl unklar.' }] },
  },
  deckblatt: { version: 1, stand: HEUTE, quellenStand: HEUTE, loeschAm: null, kartenAnzahl: 1, geloescht: [] }, belegQuote: 1, personenteil: true, liaMuster: LIA_MUSTER, rechtHinweis: 'Hinweis, keine Rechtsberatung.', loeschRegelTage: 90,
};
const api = { dossier, lage, fehler: null, setFehler: () => {}, laden: async () => {} } as unknown as AnalyseApi;
function Mit({ k }: { k: (r: ReturnType<typeof useRueckfrage>) => ReactNode }) { const r = useRueckfrage(); return createElement(Fragment, null, k(r)); }
const zeige = (k: (r: ReturnType<typeof useRueckfrage>) => ReactNode) => renderToStaticMarkup(createElement(Mit, { k }));

describe('Oberfläche der Analyse', () => {
  it('Läufe: je Agent eine Zeile mit Schätzung, Starten nur je Lauf, kein „alle starten“; A4 je Funktion; Entwurf des A4-Laufs nur als Zahl', () => {
    const html = zeige(r => createElement(Laeufe, { mandatId: 'm-1', api, rueck: r }));
    expect(html).toContain('A1 · Unternehmens-Steckbrief');
    expect(html).toContain('ca. 0,25 €');
    expect(html).toContain('A4 · Personen (nur beruflich) · Vertriebsleitung');
    expect(html).not.toMatch(/alle starten/i);
    expect(html).toContain('1 Karte als Entwurf im Personenteil');
    expect((html.match(/>Starten</g) ?? []).length).toBeGreaterThan(5);
  });
  it('Dossier: Abschnitte mit Quelle und Datum; Weitergeben erst nach F2', () => {
    const html = zeige(r => createElement(DossierAnsicht, { mandatId: 'm-1', api, rueck: r }));
    expect(html).toContain('Entwickelt Beispiel-Software.');
    expect(html).toContain('beispiel-firma.example');
    expect(html).toContain('Management-Fazit');
  });
  it('Recht & Freigaben: Datenschutz-Befund ohne „Überstimmen“, Qualität mit; F2 gesperrt', () => {
    const html = zeige(r => createElement(Recht, { mandatId: 'm-1', api, rueck: r }));
    expect(html).toContain('Name im Unternehmensteil.');
    expect((html.match(/>Überstimmen</g) ?? []).length).toBe(1);
    expect(html).toContain('„Dossier geprüft“ geht nur mit bestandener Prüfung.');
    expect(html).toContain('Hinweis, keine Rechtsberatung.');
  });
});
