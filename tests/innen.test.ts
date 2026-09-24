// Der Server ruft sich selbst immer direkt an — nie über die Adresse aus der
// Anfrage. Sonst ginge der Dienstschlüssel an einen Host, den die Anfrage
// benennt (etwa hinter Tailscale oder mit gefälschtem Host-Kopf).
import { describe, it, expect, afterEach } from 'vitest';
import { innenAdresse, aussenAdresse } from '../lib/innen';

const alt = { ...process.env };
afterEach(() => { process.env = { ...alt }; });

describe('Eigene Adresse', () => {
  it('nimmt von außen nie den Host der Anfrage', () => {
    delete process.env.MAKE_OS_INTERN; delete process.env.PORT;
    expect(innenAdresse(new Request('https://macbook.tail1234.ts.net/api/kimmi'))).toBe('http://localhost:3001');
    expect(innenAdresse(new Request('http://boese.example/api/kimmi'))).toBe('http://localhost:3001');
  });
  it('bleibt bei localhost, wie es war', () => {
    delete process.env.MAKE_OS_INTERN;
    expect(innenAdresse(new Request('http://localhost:3001/api/kimmi'))).toBe('http://localhost:3001');
  });
  it('folgt einer festen Einstellung (Server)', () => {
    process.env.MAKE_OS_INTERN = 'http://app:3000/';
    expect(innenAdresse(new Request('https://make.example/x'))).toBe('http://app:3000');
  });
  it('Einladungsadresse nur, wenn eingetragen', () => {
    delete process.env.MAKE_OS_ADRESSE;
    expect(aussenAdresse()).toBeNull();
    process.env.MAKE_OS_ADRESSE = 'https://macbook.tail1234.ts.net/';
    expect(aussenAdresse()).toBe('https://macbook.tail1234.ts.net');
  });
});
