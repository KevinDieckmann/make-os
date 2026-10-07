// ─── Einwilligungs-Kanal „WhatsApp“ (Kevin 07.10.) — lib/crm/recht.ts `kanalStatus(k, 'whatsapp')` ───────────────────────────
import { describe, it, expect } from 'vitest';
import { kanalStatus } from '@/lib/crm/recht';
import { einwilligungSaeubern } from '@/lib/crm/einwilligung';
import type { Kontakt } from '@/lib/make-one/crm';

const k = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c1', vorname: 'Erika', nachname: 'Beispiel', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const ew = (kanal: string, x: Record<string, unknown> = {}) => ({ kanal, grundlage: 'einwilligung', erteiltAm: '2026-10-01', nachweis: 'Formular', zeitpunkt: '2026-10-01T09:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Ja, per WhatsApp.', belegRef: 'd-1', ...x });

describe('kanalStatus WhatsApp', () => {
  it('ohne Nummer: keine Adresse; mit Nummer ohne Einwilligung: rot', () => {
    expect(kanalStatus(k({ email: 'e@example.invalid' }), 'whatsapp').grund).toBe('keine Adresse');
    const s = kanalStatus(k({ telefon: '+49 151 1' }), 'whatsapp');
    expect(s.farbe).toBe('rot'); expect(s.grund).toMatch(/WhatsApp-Werbung ohne Einwilligung/);
  });
  it('Mail-Einwilligung überträgt sich nicht; WhatsApp-Einwilligung mit vollem Nachweis: grün; unvollständig: gelb; Anfrage: gelb', () => {
    expect(kanalStatus(k({ telefon: '+49 151 1', einwilligungen: [ew('mail')] as never }), 'whatsapp').farbe).toBe('rot');
    expect(kanalStatus(k({ sms: '+49 151 1', einwilligungen: [ew('whatsapp')] as never }), 'whatsapp').farbe).toBe('gruen');
    expect(kanalStatus(k({ telefon: '+49 151 1', einwilligungen: [ew('whatsapp', { belegRef: undefined })] as never }), 'whatsapp').farbe).toBe('gelb');
    expect(kanalStatus(k({ telefon: '+49 151 1', einwilligungen: [ew('whatsapp', { grundlage: 'anfrage' })] as never }), 'whatsapp')).toMatchObject({ farbe: 'gelb', grund: expect.stringMatching(/Antwort auf Anfrage/) });
  });
  it('Widerruf und Werbesperre: rot', () => {
    expect(kanalStatus(k({ telefon: '+49 151 1', einwilligungen: [ew('whatsapp', { widerrufenAm: '2026-10-05' })] as never }), 'whatsapp').farbe).toBe('rot');
    expect(kanalStatus(k({ telefon: '+49 151 1', einwilligungen: [ew('whatsapp')] as never, werbesperre: { seit: '2026-10-06', grund: 'Widerspruch' } } as Partial<Kontakt>), 'whatsapp').farbe).toBe('rot');
  });
  it('der Kanal „whatsapp“ ist für Einwilligungen gültig (Säubern)', () => {
    expect(einwilligungSaeubern(ew('whatsapp'))?.kanal).toBe('whatsapp');
  });
});
