// Guthaben-Schalter (lib/anthropic.ts): nach „credit balance too low“ pausieren alle Aufrufe eine halbe Stunde.
import { describe, it, expect } from 'vitest';
import { guthabenLeer, guthabenStand, istGuthabenFehler, _guthabenSetzen, askText } from '@/lib/anthropic';

describe('Guthaben-Schalter', () => {
  it('erkennt die Guthaben-Antwort und nur die', () => {
    expect(istGuthabenFehler(400, '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}')).toBe(true);
    expect(istGuthabenFehler(400, 'max_tokens: must be positive')).toBe(false);
    expect(istGuthabenFehler(429, 'credit balance')).toBe(false);
  });
  it('pausiert 30 Minuten und gibt danach wieder frei', () => {
    const jetzt = Date.now();
    _guthabenSetzen(jetzt - 5 * 60_000);
    expect(guthabenLeer(jetzt)).toBe(true);
    expect(guthabenStand().leerSeit).not.toBeNull();
    expect(guthabenLeer(jetzt + 31 * 60_000)).toBe(false);
    _guthabenSetzen(0);
    expect(guthabenLeer()).toBe(false);
    expect(guthabenStand().leerSeit).toBeNull();
  });
  it('askText bricht bei leerem Guthaben sofort ab — ohne Netz', async () => {
    const alt = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    _guthabenSetzen(Date.now());
    const r = await askText({ system: 'x', user: 'y', zweck: 'test' });
    expect(r.ok).toBe(false); expect(r.status).toBe(402); expect(r.error).toBe('guthaben-leer');
    _guthabenSetzen(0);
    if (alt === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = alt;
  });
});
