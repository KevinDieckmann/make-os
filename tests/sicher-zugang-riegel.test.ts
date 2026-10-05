// ─── Zugang & Schlüssel härten, Punkt 2 (05.10.): Start-Riegel ──────────────
// Öffentliche Instanz (production + https) ohne MAKE_OS_KEY, SESSION_SECRET oder Datenschlüssel startet nicht; „streng“
// verlangt zusätzlich Länge ≥ 32 und Pepper. Entwicklung, Prüfbau (ohne https) und „aus“ warnen nur. Nur Test-Werte.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { riegelModus, startPruefung, sitzungsGeheimnisFehlt, mangelSatz } from '@/lib/zugang/start-riegel';
import { startRiegel } from '@/lib/zugang/start-riegel-lauf';
import { zugangBefunde } from '@/lib/hoi/lage';

const L = 'x'.repeat(64);
const SERVER = { NODE_ENV: 'production', MAKE_OS_ADRESSE: 'https://app.example.invalid', MAKE_OS_KEY: L, SESSION_SECRET: L };
const voll = { datenSchluessel: 64, pepper: 64 };

afterEach(() => { vi.restoreAllMocks(); });

describe('Start-Riegel: Modus', () => {
  it('leitet den Modus aus Umgebung und Adresse ab', () => {
    expect(riegelModus({ NODE_ENV: 'development' })).toBe('entwicklung');
    expect(riegelModus({ NODE_ENV: 'test', MAKE_OS_START_RIEGEL: 'streng' })).toBe('entwicklung');
    expect(riegelModus({ NODE_ENV: 'production' })).toBe('lokal');
    expect(riegelModus({ NODE_ENV: 'production', MAKE_OS_ADRESSE: 'http://localhost:3011' })).toBe('lokal');
    expect(riegelModus(SERVER)).toBe('scharf');
    expect(riegelModus({ ...SERVER, MAKE_OS_START_RIEGEL: 'streng' })).toBe('streng');
    expect(riegelModus({ NODE_ENV: 'production', MAKE_OS_START_RIEGEL: 'STRENG' })).toBe('streng');
    expect(riegelModus({ ...SERVER, MAKE_OS_START_RIEGEL: 'aus' })).toBe('aus');
  });
});

describe('Start-Riegel: Prüfung', () => {
  it('scharf: alles da → läuft; nur Pepper fehlt → läuft mit Warnung (laufende Instanz)', () => {
    expect(startPruefung(SERVER, voll)).toEqual({ modus: 'scharf', maengel: [], blockiert: false });
    const p = startPruefung(SERVER, { datenSchluessel: 64, pepper: 0 });
    expect(p.blockiert).toBe(false);
    expect(p.maengel).toEqual([{ was: 'Pepper', art: 'fehlt', hart: false }]);
  });
  it('scharf: ohne Datenschlüssel, SESSION_SECRET oder MAKE_OS_KEY kein Start', () => {
    expect(startPruefung(SERVER, { datenSchluessel: 0, pepper: 64 }).blockiert).toBe(true);
    expect(startPruefung({ ...SERVER, SESSION_SECRET: '' }, voll).blockiert).toBe(true);
    expect(startPruefung({ ...SERVER, MAKE_OS_KEY: ' ' }, voll).blockiert).toBe(true);
  });
  it('scharf: zu kurz nur Warnung; streng: zu kurz und fehlender Pepper brechen ab', () => {
    const kurz = { ...SERVER, SESSION_SECRET: 'k'.repeat(20) };
    expect(startPruefung(kurz, voll).blockiert).toBe(false);
    expect(startPruefung({ ...kurz, MAKE_OS_START_RIEGEL: 'streng' }, voll).blockiert).toBe(true);
    expect(startPruefung({ ...SERVER, MAKE_OS_START_RIEGEL: 'streng' }, { datenSchluessel: 64, pepper: 0 }).blockiert).toBe(true);
    expect(startPruefung({ ...SERVER, MAKE_OS_START_RIEGEL: 'streng' }, { datenSchluessel: 31, pepper: 64 }).blockiert).toBe(true);
    expect(startPruefung({ ...SERVER, MAKE_OS_START_RIEGEL: 'streng' }, voll).blockiert).toBe(false);
  });
  it('Entwicklung, Prüfbau und „aus“ blockieren nie — sie melden nur', () => {
    for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'production' }, { NODE_ENV: 'production', MAKE_OS_ADRESSE: 'https://x.example.invalid', MAKE_OS_START_RIEGEL: 'aus' }]) {
      const p = startPruefung(env, { datenSchluessel: 0, pepper: 0 });
      expect(p.blockiert, JSON.stringify(env)).toBe(false);
      expect(p.maengel.length).toBe(4);
    }
  });
  it('Sätze nennen nur Namen, nie Werte', () => {
    const p = startPruefung({ ...SERVER, SESSION_SECRET: 'geheim-kurz' }, voll);
    const text = p.maengel.map(mangelSatz).join(' ');
    expect(text).toContain('SESSION_SECRET');
    expect(text).not.toContain('geheim-kurz');
  });
});

describe('Start-Riegel: Lauf beim Start', () => {
  it('blockiert → Meldung ohne Werte und Beenden mit Code 1', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ende = vi.fn();
    const b = startRiegel({ ...SERVER, SESSION_SECRET: '', MAKE_OS_DATEN_SCHLUESSEL: 'd'.repeat(64) } as NodeJS.ProcessEnv, ende);
    expect(b.blockiert).toBe(true);
    expect(ende).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toContain('SESSION_SECRET fehlt');
    expect(err.mock.calls.flat().join(' ')).not.toContain('d'.repeat(64));
  });
  it('alles da → kein Beenden; liest Datenschlüssel und Pepper nur als Länge', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ende = vi.fn();
    const b = startRiegel({ ...SERVER, MAKE_OS_DATEN_SCHLUESSEL: 'd'.repeat(64), MAKE_OS_PEPPER: 'p'.repeat(64) } as NodeJS.ProcessEnv, ende);
    expect(b).toEqual({ modus: 'scharf', maengel: [], blockiert: false });
    expect(ende).not.toHaveBeenCalled();
  });
});

describe('Start-Riegel: Middleware-Teil (SESSION_SECRET)', () => {
  it('Produktion ohne SESSION_SECRET immer 503; streng zusätzlich bei < 32 Zeichen', () => {
    expect(sitzungsGeheimnisFehlt({ NODE_ENV: 'production' })).toMatch(/fehlt/);
    expect(sitzungsGeheimnisFehlt({ NODE_ENV: 'production', SESSION_SECRET: 'kurz' })).toBeNull();
    expect(sitzungsGeheimnisFehlt({ NODE_ENV: 'production', SESSION_SECRET: 'kurz', MAKE_OS_START_RIEGEL: 'streng' })).toMatch(/kürzer/);
    expect(sitzungsGeheimnisFehlt({ NODE_ENV: 'development' })).toBeNull();
  });
});

describe('HOI: Start-Riegel-Befund', () => {
  const j = '2026-10-05T12:00:00.000Z';
  const basis = { zuliefererSchluessel: false, zuliefererAltZuletzt: null };
  it('aus → rot; scharf mit Mängeln → gelb; scharf ohne → grün; streng → grün; Entwicklung → nichts', () => {
    expect(zugangBefunde({ ...basis, riegel: { modus: 'aus', maengel: [] } }, j)[0]).toMatchObject({ id: 'start-riegel', ampel: 'rot' });
    expect(zugangBefunde({ ...basis, riegel: { modus: 'scharf', maengel: [{ was: 'Pepper', art: 'fehlt', hart: false }] } }, j)[0]).toMatchObject({ ampel: 'gelb', wert: 'scharf: Pepper fehlt' });
    expect(zugangBefunde({ ...basis, riegel: { modus: 'scharf', maengel: [] } }, j)[0]).toMatchObject({ ampel: 'gruen' });
    expect(zugangBefunde({ ...basis, riegel: { modus: 'streng', maengel: [] } }, j)[0]).toMatchObject({ ampel: 'gruen', wert: 'streng' });
    expect(zugangBefunde({ ...basis, riegel: { modus: 'entwicklung', maengel: [] } }, j)).toEqual([]);
  });
});
