// „<Firma> verbinden“ im Business-Kalender und iCloud im Privat-Kalender (06.10.2026, Kevin): die Karte erscheint dort, wo sie
// hingehört, nur für die eigene Person, verschwindet nach dem Verbinden (kleiner Hinweis bleibt), kennt die Fehlerzustände wie die
// Einstellungen (nicht eingerichtet, getrennt → „Neu verbinden“) und startet DENSELBEN Google-Weg wie die Einstellungen.
// Serverseitig gerendert, ohne Browser und ohne Netz.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verbindenAnzeige, firmaOhneRechtsform } from '@/lib/kalender/verbinden-anzeige';
import { GoogleVerbindenKarte, VerbundenHinweis, FIRMA } from '@/components/os/kalender/VerbindenKarten';
import { IcloudVerbindung } from '@/components/os/kalender/IcloudVerbindung';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const quelle = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');
const noop = () => undefined;

describe('welche Anzeige wo (rein)', () => {
  const offen = { konfiguriert: true, verbunden: false };
  const da = { konfiguriert: true, verbunden: true, konto: 'k***@example.invalid' };
  it('Business: nicht verbunden → Karte, verbunden → Hinweis; iCloud nie unter Business', () => {
    expect(verbindenAnzeige('business', offen, { verbunden: false })).toEqual({ google: 'karte', icloud: null });
    expect(verbindenAnzeige('business', da, null)).toEqual({ google: 'hinweis', icloud: null });
    expect(verbindenAnzeige('business', { konfiguriert: false, verbunden: false }, null).google).toBe('karte');
    expect(verbindenAnzeige('business', { ...offen, getrennt: { grund: 'Zugriff widerrufen' } }, null).google).toBe('karte');
  });
  it('Privat: nicht verbunden oder App-Passwort ungültig → Karte, verbunden → Hinweis; Google nie unter Privat', () => {
    expect(verbindenAnzeige('privat', offen, { verbunden: false })).toEqual({ google: null, icloud: 'karte' });
    expect(verbindenAnzeige('privat', null, { verbunden: true, anmeldung: true }).icloud).toBe('karte');
    expect(verbindenAnzeige('privat', null, { verbunden: true }).icloud).toBe('hinweis');
  });
  it('„Alles“ und fehlender Stand (lädt, Fehler) → keine Karte', () => {
    expect(verbindenAnzeige('alle', offen, { verbunden: false })).toEqual({ google: null, icloud: null });
    expect(verbindenAnzeige('business', null, null)).toEqual({ google: null, icloud: null });
  });
  it('Firmenname aus der Instanz, ohne Rechtsform — nie fest im Code', () => {
    expect(firmaOhneRechtsform('MAKE Innovation GmbH')).toBe('MAKE Innovation');
    expect(firmaOhneRechtsform('Nordlicht Labs GmbH')).toBe('Nordlicht Labs');
    expect(firmaOhneRechtsform('Hartmann Holding UG (haftungsbeschränkt)')).toBe('Hartmann Holding');
    expect(firmaOhneRechtsform('GmbH')).toBe('GmbH');
    expect(FIRMA).toBe('MAKE Innovation');
    expect(quelle('components/os/kalender/VerbindenKarten.tsx')).not.toMatch(/'MAKE Innovation/);
  });
});

describe('Karte „<Firma> verbinden“', () => {
  it('nicht verbunden: Titel, Erklärung (nur Kalender), Knopf „<Firma> verbinden“', () => {
    const m = html(createElement(GoogleVerbindenKarte, { stand: { konfiguriert: true, verbunden: false }, firma: 'MAKE Innovation', onVerbinden: noop }));
    expect(m).toContain('MAKE Innovation verbinden');
    expect(m).toContain('Business-Termine von MAKE Innovation erscheinen hier');
    expect(m).toContain('nur die Freigabe für den Kalender');
    expect(m).toMatch(/<button[^>]*>MAKE Innovation verbinden<\/button>/);
  });
  it('getrennt: Grund + „Neu verbinden“', () => {
    const m = html(createElement(GoogleVerbindenKarte, { stand: { konfiguriert: true, verbunden: false, getrennt: { grund: 'Zugriff bei Google widerrufen' } }, firma: 'MAKE Innovation', onVerbinden: noop }));
    expect(m).toContain('Zugriff bei Google widerrufen');
    expect(m).toMatch(/<button[^>]*>Neu verbinden<\/button>/);
  });
  it('nicht eingerichtet: Hinweis statt Knopf (wie in den Einstellungen)', () => {
    const m = html(createElement(GoogleVerbindenKarte, { stand: { konfiguriert: false, verbunden: false }, firma: 'MAKE Innovation', onVerbinden: noop }));
    expect(m).toContain('GOOGLE_CLIENT_ID');
    expect(m).not.toContain('<button');
  });
  it('verbunden: nur ein kleiner Hinweis', () => {
    expect(html(createElement(VerbundenHinweis, { text: 'MAKE Innovation · Google verbunden' }))).toContain('MAKE Innovation · Google verbunden');
  });
});

describe('ein Weg, an der richtigen Stelle', () => {
  it('Business-Karte und Einstellungen starten Google über DIESELBE Funktion (funktionen: kalender)', () => {
    const gemeinsam = quelle('components/os/kalender/google-verbinden.ts');
    expect(gemeinsam).toContain("funktionen: ['kalender']");
    expect(quelle('components/os/kalender/VerbindenKarten.tsx')).toContain('googleKalenderVerbinden()');
    expect(quelle('components/os/kalender/GoogleVerbindung.tsx')).toContain('googleKalenderVerbinden()');
    expect(quelle('components/os/kalender/GoogleVerbindung.tsx')).not.toContain("'/api/google/verbinden'");
  });
  it('Kalender zeigt die Karten nur in Business bzw. Privat, und nur aus den Status-Routen der eigenen Person', () => {
    expect(quelle('components/os/kalender/Kalender.tsx')).toMatch(/\(bereich === 'business' \|\| bereich === 'privat'\) && <BereichVerbindungen/);
    const k = quelle('components/os/kalender/VerbindenKarten.tsx');
    expect(k).toContain("'/api/kalender/icloud'");
    expect(k).toContain('googleKalenderStandLaden');
    expect(k).not.toMatch(/fuer=|person=/);
  });
  it('iCloud-Karte (nicht verbunden, beim ersten Rendern): Erklärung, ohne vorbelegtes Passwort', () => {
    const m = html(createElement(IcloudVerbindung, {}));
    expect(m).toContain('iCloud Kalender');
    expect(m).toContain('lädt');
  });
});
