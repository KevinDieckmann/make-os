// Zweiter Faktor (26.09.): TOTP nach RFC 6238 (Testvektoren aus dem RFC, SHA-1),
// Base32, Zeitfenster, Wiederholungsschutz, Wiederherstellungscodes.
import { describe, it, expect } from 'vitest';
import { base32, base32Lesen, codeFuer, codePruefen, stufeVon, neuesGeheimnis, otpauthLink, neueWiederherstellungscodes, wiederherstellungHash, wiederherstellungPruefen, type Wiederherstellung } from '../lib/zugang/totp';

// RFC 6238, Anhang B: Geheimnis „12345678901234567890“ (ASCII) → Base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
const RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP', () => {
  it('Base32 hin und zurück', () => {
    expect(base32(Buffer.from('12345678901234567890'))).toBe(RFC);
    expect(Buffer.from(base32Lesen(RFC)).toString()).toBe('12345678901234567890');
    expect(Buffer.from(base32Lesen('gezd gnbv-gy3t')).toString().startsWith('12345')).toBe(true);
  });

  it('liefert die RFC-Vektoren (letzte sechs Stellen der 8-stelligen Referenz)', () => {
    const faelle: [number, string][] = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']];
    for (const [sek, code] of faelle) expect(codeFuer(RFC, Math.floor(sek / 30)), String(sek)).toBe(code);
    expect(codeFuer(RFC, Math.floor(59 / 30), 8)).toBe('94287082');
  });

  it('prüft mit einer Stufe Toleranz, lehnt Wiederholung und Unsinn ab', () => {
    const jetzt = 1111111111 * 1000;
    const stufe = stufeVon(jetzt);
    expect(codePruefen(RFC, '050471', jetzt)).toEqual({ ok: true, stufe });
    expect(codePruefen(RFC, '081804', jetzt)).toEqual({ ok: true, stufe: stufe - 1 });   // vorherige Stufe (1111111109)
    expect(codePruefen(RFC, '050471', jetzt, 1, stufe)).toEqual({ ok: false });         // schon benutzt
    expect(codePruefen(RFC, '005924', jetzt)).toEqual({ ok: false });                   // ganz andere Zeit
    expect(codePruefen(RFC, '05047', jetzt)).toEqual({ ok: false });
    expect(codePruefen(RFC, '05 04 71', jetzt).ok).toBe(true);                          // Leerzeichen sind egal
  });

  it('neues Geheimnis: 32 Base32-Zeichen, jedes Mal anders; Link für die App', () => {
    const a = neuesGeheimnis(), b = neuesGeheimnis();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(a).not.toBe(b);
    expect(otpauthLink('kevin@example.invalid', a)).toBe(`otpauth://totp/MAKE%20OS%3Akevin%40example.invalid?secret=${a}&issuer=MAKE%20OS&algorithm=SHA1&digits=6&period=30`);
  });

  it('Wiederherstellungscodes: acht Stück, nur der Hash wird gespeichert, jeder gilt einmal', () => {
    const codes = neueWiederherstellungscodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    const liste: Wiederherstellung[] = codes.map(c => ({ hash: wiederherstellungHash(c, 'salz') }));
    expect(wiederherstellungPruefen(liste, codes[3].toUpperCase(), 'salz')).toBe(3);
    expect(wiederherstellungPruefen(liste, codes[3].replace('-', ''), 'salz')).toBe(3);
    expect(wiederherstellungPruefen(liste, 'nicht-dabei', 'salz')).toBe(-1);
    liste[3].benutzt = '2026-09-26T12:00:00.000Z';
    expect(wiederherstellungPruefen(liste, codes[3], 'salz')).toBe(-1);
  });
});
