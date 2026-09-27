import { describe, it, expect } from 'vitest';
import { KERN_EINHEITEN_NAMEN, einheitAusGesellschaft, gesellschaftAusEinheit, einheitName } from '@/lib/einheiten';

describe('Business-Einheiten — eine Quelle', () => {
  it('drei Kerneinheiten in fester Reihenfolge', () => {
    expect(KERN_EINHEITEN_NAMEN).toEqual(['Selbstständigkeit', 'KD Ventures', 'MAKE OS UG']);
  });
  it('Gesellschaft ↔ Einheit, alte Namen werden erkannt', () => {
    expect(einheitAusGesellschaft('kdc')).toBe('Selbstständigkeit');
    expect(einheitAusGesellschaft('ug')).toBe('MAKE OS UG');
    expect(einheitAusGesellschaft('offen')).toBeUndefined();
    expect(gesellschaftAusEinheit('Neue UG')).toBe('ug');
    expect(gesellschaftAusEinheit('kdv')).toBe('kdv');
    expect(gesellschaftAusEinheit('KD Ventures')).toBe('kdv');
    expect(gesellschaftAusEinheit('Kunden')).toBeUndefined();
    expect(einheitName('neue ug')).toBe('MAKE OS UG');
    expect(einheitName('Kunden')).toBe('Kunden');
    expect(einheitName('  ')).toBeUndefined();
  });
});
