// ─── Selbstprüfung echt (05.10., Paket „DSGVO-Grundlagen im Code“) ─────────
// Vorher meldete „ki“ fest „erfüllt“ und „zugang“ prüfte nur Passwörter. Jetzt: Verantwortlicher, AVV je Auftragsverarbeiter,
// KI-AVV + Agenten-Schalter, zweiter Faktor, Sicherungs-Verschlüsselung — jede offene Prüfung mit Weg zum Beheben.
import { describe, it, expect } from 'vitest';
import { leererBestand } from '@/lib/crm/speicher';
import { selbstpruefung, type DatenschutzUmfeld } from '@/lib/crm/datenschutz';
import { EMPFAENGER_START, type Empfaenger } from '@/lib/datenschutz/einrichtung';

const HEUTE = '2026-10-05';
const bestaetigt = (l: readonly Empfaenger[]): Empfaenger[] => l.map(e => (e.rolle === 'auftragsverarbeiter' ? { ...e, avv: { status: 'bestaetigt', am: '2026-10-05', unterlage: 'avv.pdf' } } : e));
const umfeld = (x: Partial<DatenschutzUmfeld> = {}): DatenschutzUmfeld => ({
  verantwortlicher: { gesetzt: true, quelle: 'einrichtung', luecken: [] },
  empfaenger: bestaetigt(EMPFAENGER_START),
  zweiterFaktor: { konten: 2, mit: 2 },
  sicherung: { verfahren: 'age', zeit: '2026-10-05T03:15:00Z' },
  agenten: { aktiv: 10, gesamt: 12 },
  ...x,
});
const pruefe = (u?: DatenschutzUmfeld) => Object.fromEntries(selbstpruefung([], leererBestand(), HEUTE, { konten: 2, mitPasswort: 2 }, 24, u).map(p => [p.id, p]));

describe('Selbstprüfung — die neuen Punkte', () => {
  it('alles eingerichtet: Verantwortlicher, AVV, KI, Zugang, Sicherung erfüllt', () => {
    const p = pruefe(umfeld());
    for (const id of ['verantwortlicher', 'avv', 'ki', 'zugang', 'sicherung']) expect(p[id]?.status, id).toBe('erfuellt');
    expect(p.ki.befund).toMatch(/AVV Anthropic.*bestätigt am 05\.10\.2026/);
    expect(p.ki.befund).toMatch(/10 von 12 Agenten/);
  });
  it('ohne Einrichtung: „ki“ ist NIE mehr fest erfüllt', () => {
    const p = pruefe();
    expect(p.ki.status).not.toBe('erfuellt');
    expect(p.zugang.status).toBe('teilweise'); // zweiter Faktor nicht geprüft
    expect(p.verantwortlicher).toBeUndefined();
  });
  it('Verantwortlicher fehlt → offen, mit Weg zur Einrichtung', () => {
    const p = pruefe(umfeld({ verantwortlicher: { gesetzt: false, quelle: null, luecken: ['Anschrift'] } }));
    expect(p.verantwortlicher.status).toBe('offen');
    expect(p.verantwortlicher.befund).toContain('Anschrift');
    expect(p.verantwortlicher.weg?.href).toBe('/os/datenschutz#verantwortlicher');
  });
  it('AVV: Vorgabe-Liste (alles offen) → offen; teilweise bestätigt → teilweise; Liste nennt die offenen', () => {
    expect(pruefe(umfeld({ empfaenger: EMPFAENGER_START })).avv.status).toBe('offen');
    const teil = bestaetigt(EMPFAENGER_START).map(e => (e.id === 'github' ? { ...e, avv: { status: 'offen' as const } } : e));
    const p = pruefe(umfeld({ empfaenger: teil }));
    expect(p.avv.status).toBe('teilweise');
    expect(p.avv.befund).toContain('GitHub');
    expect(p.avv.weg?.href).toBe('/os/datenschutz#empfaenger');
  });
  it('KI: AVV des KI-Anbieters offen → offen (Weg: Empfänger); archiviert = nicht in Gebrauch', () => {
    const ohne = bestaetigt(EMPFAENGER_START).map(e => (e.id === 'anthropic' ? { ...e, avv: { status: 'offen' as const } } : e));
    expect(pruefe(umfeld({ empfaenger: ohne })).ki.status).toBe('offen');
    const archiviert = bestaetigt(EMPFAENGER_START).map(e => (e.id === 'anthropic' ? { ...e, archiviert: true } : e));
    expect(pruefe(umfeld({ empfaenger: archiviert })).ki.befund).toMatch(/fehlt im Empfänger-Register/);
  });
  it('Zugang prüft den zweiten Faktor aller Konten im Haushalt', () => {
    const p = pruefe(umfeld({ zweiterFaktor: { konten: 2, mit: 1 } }));
    expect(p.zugang.status).toBe('teilweise');
    expect(p.zugang.befund).toMatch(/1 von 2 Konten im Haushalt mit zweitem Faktor/);
    expect(p.zugang.weg?.href).toBe('/os/konto');
  });
  it('Sicherung: age erfüllt, openssl = Übergang, ohne Statusdatei „unbekannt“', () => {
    expect(pruefe(umfeld({ sicherung: { verfahren: 'openssl' } })).sicherung.befund).toMatch(/Übergangsverfahren/);
    const u = pruefe(umfeld({ sicherung: null })).sicherung;
    expect(u.status).toBe('teilweise');
    expect(u.befund).toMatch(/^unbekannt/);
  });
  it('jede nicht erfüllte Prüfung hat einen Weg zum Beheben', () => {
    const l = selbstpruefung([], leererBestand(), HEUTE, { konten: 2, mitPasswort: 1 }, 24, umfeld({ verantwortlicher: { gesetzt: false, quelle: null, luecken: [] }, empfaenger: EMPFAENGER_START, zweiterFaktor: { konten: 2, mit: 0 }, sicherung: null }));
    for (const p of l.filter(x => x.status !== 'erfuellt')) expect(p.weg?.href, p.id).toBeTruthy();
  });
});
