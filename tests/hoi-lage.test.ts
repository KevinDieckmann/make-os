// Head of IT (27.09.): Befunde aus innen, Host und außen — Schwellen, Gesamtampel, Kurzbericht.
import { describe, it, expect } from 'vitest';
import { befundeAus, gesamt, kurzbericht, type InnenLage, type HostLage, type AussenLage } from '../lib/hoi/lage';

const JETZT = '2026-09-27T06:30:00.000Z';
const innen: InnenLage = {
  zeit: JETZT, prozess: { laufzeitStunden: 30, heapMb: 200, rssMb: 620, node: 'v22' },
  bestaende: { anzahl: 40, gesamtMb: 6.2, groesste: [{ name: 'grundlage', mb: 1.5 }, { name: 'kontakte', mb: 0.9 }] },
  takt: { letzterLaufMinuten: 2, fehlerquote24h: 4, wartend: 1, laufend: 0 },
  fehler: { client24h: 0 }, anmeldungen: { fehl24h: 1, neueNetze7d: 0 }, csp: { meldungen7d: 0 }, verschluesselt: true, ki: { schluessel: true, guthabenLeerSeit: null },
};
const host: HostLage = {
  zeit: '2026-09-27T06:27:00.000Z', platte: { frei_gb: 18, belegt_prozent: 41 }, speicher: { frei_mb: 620, gesamt_mb: 1900, swap_belegt_mb: 300 }, last: { m5: 0.4, kerne: 1 },
  container: [{ name: 'app-app-1', status: 'Up 5 hours', gesund: 'healthy', neustarts: 0 }, { name: 'app-arbeiter-1', status: 'Up 5 hours', neustarts: 4 }],
  fail2ban: { gesperrt: 3, versuche_24h: 120 }, zertifikat: { tage: 61 }, sicherung: { alter_stunden: 3.2, groesse_mb: 4 }, vault: { letzter_commit_stunden: 1, konflikt: false },
};
const aussen: AussenLage = { zeit: '2026-09-27T06:00:00.000Z', status: 200, ms: 410, tlsTage: 61, kopfzeilen: { 'strict-transport-security': true, 'content-security-policy': true, 'x-content-type-options': true, 'referrer-policy': true, 'x-frame-options': true, 'permissions-policy': false } };

describe('HOI · Lage', () => {
  it('ohne Host und Außen bleiben diese Teile grau, die App wird trotzdem bewertet', () => {
    const b = befundeAus(innen, null, null, JETZT);
    expect(b.find(x => x.id === 'host')?.ampel).toBe('grau');
    expect(b.find(x => x.id === 'aussen')?.ampel).toBe('grau');
    expect(b.find(x => x.id === 'takt')?.ampel).toBe('gruen');
    expect(b.find(x => x.id === 'verschluesselt')?.ampel).toBe('gruen');
    expect(b.find(x => x.id === 'ki')?.ampel).toBe('gruen');
    expect(befundeAus({ ...innen, ki: { schluessel: true, guthabenLeerSeit: '2026-09-27T09:00:00.000Z' } }, null, null, JETZT).find(x => x.id === 'ki')?.ampel).toBe('rot');
    expect(befundeAus({ ...innen, ki: { schluessel: false, guthabenLeerSeit: null } }, null, null, JETZT).find(x => x.id === 'ki')?.ampel).toBe('grau');
    expect(gesamt(b).ampel).toBe('gruen');
  });
  it('bewertet Host und Außen mit Schwellen', () => {
    const b = befundeAus(innen, host, aussen, JETZT);
    expect(b.find(x => x.id === 'platte')).toMatchObject({ ampel: 'gruen' });
    expect(b.find(x => x.id === 'container:app-arbeiter-1')).toMatchObject({ ampel: 'gelb' });
    expect(b.find(x => x.id === 'sicherung')).toMatchObject({ ampel: 'gruen' });
    expect(b.find(x => x.id === 'kopfzeilen')).toMatchObject({ ampel: 'gelb', wert: 'fehlt: permissions-policy' });
    expect(gesamt(b).ampel).toBe('gelb');
  });
  it('rot schlägt durch: alte Sicherung, toter Container, Klartext, Außen 502', () => {
    const b = befundeAus({ ...innen, verschluesselt: false }, { ...host, sicherung: { alter_stunden: 80 }, container: [{ name: 'app-app-1', status: 'Exited (1)' }] }, { ...aussen, status: 502 }, JETZT);
    expect(b.find(x => x.id === 'sicherung')?.ampel).toBe('rot');
    expect(b.find(x => x.id === 'container:app-app-1')?.ampel).toBe('rot');
    expect(b.find(x => x.id === 'verschluesselt')?.ampel).toBe('rot');
    expect(b.find(x => x.id === 'aussen')?.ampel).toBe('rot');
    const g = gesamt(b);
    expect(g.ampel).toBe('rot');
    expect(g.rot).toBeGreaterThanOrEqual(4);
    const text = kurzbericht(b, JETZT);
    expect(text.split('\n')[0]).toContain('ROT');
    expect(text).toContain('Letzte Sicherung');
  });
  it('alte Meldungen werden gelb, nicht grün', () => {
    const b = befundeAus(innen, { ...host, zeit: '2026-09-27T04:00:00.000Z' }, { ...aussen, zeit: '2026-09-26T06:00:00.000Z' }, JETZT);
    expect(b.find(x => x.id === 'host')?.ampel).toBe('rot');
    expect(b.find(x => x.id === 'aussen')?.ampel).toBe('gelb');
  });
});
