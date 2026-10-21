// ─── Prozesse B1 — Auslöser und „nur wenn …“ (21.10.; Punkte 31, 32) ─────────────────────────────────────────────────────────────────────────────────
// Ereignis-Arten = `SkillEreignis` (keine zweite Liste), Bedingung per Feldern als reine Auswertung, Zeitplan wie die Skills, Datum relativ (nur Modell),
// von Hand, Webhook (Schema), Loop. Business-Prozesse hören nie auf Privates. Das Ereignis `webhook` ist intern (kein Skill-Auslöser, nicht im Heads-Paket).
import { describe, it, expect } from 'vitest';
import { ausloeserAus, ausloeserPasst, ereignisDaten, ausloeserText, startetNachLoop, PROZESS_EREIGNISSE, ausloeserFelder } from '@/lib/prozesse/ausloeser';
import { bedingungTrifft, bedingungenTreffen, bedingungenAus, bedingungText } from '@/lib/prozesse/bedingung';
import { EREIGNISSE_INTERN, SKILL_EREIGNISSE, EREIGNIS_NAME, istEreignisArt } from '@/lib/ereignisse/arten';
import { eingabeSauber } from '@/lib/ereignisse/typen';
import type { Ereignis } from '@/lib/ereignisse/typen';
import { PZ, PZ2 } from './fixtures/prozess-bau';

const fehler = (r: { befunde: { stufe: string }[] }, stufe = 'offen') => r.befunde.filter(b => b.stufe === stufe).length;

describe('Auslöser prüfen', () => {
  it('von Hand, Zeitplan (wie die Skills), Loop', () => {
    expect(ausloeserAus({ art: 'hand' }, 'deal')).toEqual({ ausloeser: { art: 'hand' }, befunde: [] });
    expect(ausloeserAus({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '07:30' }, 'keiner').ausloeser).toEqual({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '07:30' });
    expect(fehler(ausloeserAus({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '25:00' }, 'keiner'))).toBe(1);
    expect(ausloeserAus({ art: 'loop', loop: 'morgen' }, 'keiner').ausloeser).toEqual({ art: 'loop', loop: 'morgen' });
    expect(fehler(ausloeserAus({ art: 'loop', loop: 'mittag' }, 'keiner'))).toBe(1);
    expect(startetNachLoop({ art: 'loop', loop: 'morgen' }, 'morgen')).toBe(true);
    expect(startetNachLoop({ art: 'loop', loop: 'morgen' }, 'woche')).toBe(false);
  });
  it('Ereignis: nur angebundene Arten, die nicht intern sind; „nur wenn …“ nur über bekannte Felder', () => {
    const ok = ausloeserAus({ art: 'ereignis', ereignis: 'deal-stufe', bedingungen: [{ feld: 'ereignis.stufe', op: 'gleich', wert: 'gewonnen' }] }, 'deal');
    expect(ok.befunde).toEqual([]);
    expect(ok.ausloeser).toEqual({ art: 'ereignis', ereignis: 'deal-stufe', bedingungen: [{ feld: 'ereignis.stufe', op: 'gleich', wert: 'gewonnen' }] });
    expect(fehler(ausloeserAus({ art: 'ereignis', ereignis: 'termin-vorbei' }, 'deal'))).toBe(1); // noch nicht angebunden
    expect(fehler(ausloeserAus({ art: 'ereignis', ereignis: 'webhook' }, 'deal'))).toBe(1); // intern
    expect(fehler(ausloeserAus({ art: 'ereignis', ereignis: 'aufgabe-zoe' }, 'deal'))).toBe(1); // intern
    expect(fehler(ausloeserAus({ art: 'ereignis', ereignis: 'neuer-lead', bedingungen: [{ feld: 'deal.wert', op: 'groesser', wert: 5 }] }, 'lead'), 'fehler')).toBe(1);
    expect(PROZESS_EREIGNISSE).not.toContain('webhook');
    expect(PROZESS_EREIGNISSE).toContain('neuer-lead');
  });
  it('Datum am Fall: nur Datumsfelder der Fall-Art, Versatz in ganzen Tagen', () => {
    expect(ausloeserAus({ art: 'datum', feld: 'mandat.kuendigungsfrist', versatzTage: -14, werktage: true }, 'mandat').ausloeser).toEqual({ art: 'datum', feld: 'mandat.kuendigungsfrist', versatzTage: -14, werktage: true });
    expect(fehler(ausloeserAus({ art: 'datum', feld: 'mandat.kuendigungsfrist', versatzTage: -14 }, 'deal'))).toBe(1);
    expect(fehler(ausloeserAus({ art: 'datum', feld: 'event.datum', versatzTage: 1.5 }, 'event'))).toBe(1);
    expect(fehler(ausloeserAus({ art: 'datum', feld: 'event.datum', versatzTage: 0 }, 'keiner'))).toBe(1);
  });
  it('Webhook: Schema mit eindeutigen Feldern, Auswahl mit Optionen; „nur wenn …“ nur über seine Felder', () => {
    const r = ausloeserAus({ art: 'webhook', felder: [{ id: 'email', art: 'email', pflicht: true }, { id: 'quelle', art: 'auswahl', optionen: ['web', 'messe'] }], bedingungen: [{ feld: 'webhook.quelle', op: 'gleich', wert: 'web' }] }, 'lead');
    expect(r.befunde).toEqual([]);
    expect(ausloeserFelder(r.ausloeser!, 'lead')).toEqual(['webhook.email', 'webhook.quelle']);
    expect(fehler(ausloeserAus({ art: 'webhook', felder: [{ id: 'x', art: 'text' }, { id: 'x', art: 'zahl' }] }, 'lead'), 'fehler')).toBe(1);
    expect(fehler(ausloeserAus({ art: 'webhook', felder: [{ id: 'wahl', art: 'auswahl' }] }, 'lead'), 'fehler')).toBe(1);
    expect(fehler(ausloeserAus({ art: 'webhook', felder: [{ id: 'a', art: 'text' }], bedingungen: [{ feld: 'webhook.b', op: 'gesetzt' }] }, 'lead'), 'fehler')).toBe(1);
  });
  it('Text für Steckbrief und Liste', () => {
    expect(ausloeserText({ art: 'datum', feld: 'mandat.kuendigungsfrist', versatzTage: -14, werktage: true })).toBe('14 Werktage vor: Kündigungsfrist des Mandats');
    expect(ausloeserText({ art: 'loop', loop: 'morgen' })).toBe('nach dem Morgen-Loop');
    expect(ausloeserText({ art: 'ereignis', ereignis: 'deal-stufe' })).toBe(`bei: ${EREIGNIS_NAME['deal-stufe']}`);
  });
});

describe('Bedingungen (reine Auswertung, kein Code)', () => {
  const d = { 'deal.stufe': 'gewonnen', 'deal.wert': 1200, 'lead.temperatur': 'warm', 'liste': ['a', 'b'], 'datum': '2026-10-21' };
  it('alle Vergleiche', () => {
    expect(bedingungTrifft({ feld: 'deal.stufe', op: 'gleich', wert: 'Gewonnen' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'deal.stufe', op: 'ungleich', wert: 'verloren' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'deal.wert', op: 'groesser', wert: '1000' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'deal.wert', op: 'kleiner', wert: 1000 }, d)).toBe(false);
    expect(bedingungTrifft({ feld: 'datum', op: 'kleiner', wert: '2026-11-01' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'lead.temperatur', op: 'einer-von', wert: ['warm', 'heiss'] }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'liste', op: 'enthaelt', wert: 'b' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'deal.stufe', op: 'beginnt', wert: 'gew' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'fehlt', op: 'leer' }, d)).toBe(true);
    expect(bedingungTrifft({ feld: 'fehlt', op: 'gleich', wert: '' }, d)).toBe(false);
    expect(bedingungTrifft({ feld: 'fehlt', op: 'ungleich', wert: 'x' }, d)).toBe(true);
  });
  it('und / oder; ohne Bedingung trifft es immer', () => {
    const a = { feld: 'deal.stufe', op: 'gleich' as const, wert: 'gewonnen' }, b = { feld: 'deal.wert', op: 'groesser' as const, wert: 5000 };
    expect(bedingungenTreffen([a, b], d)).toBe(false);
    expect(bedingungenTreffen([a, b], d, 'oder')).toBe(true);
    expect(bedingungenTreffen(undefined, d)).toBe(true);
    expect(bedingungText(a)).toBe('deal.stufe ist gewonnen');
  });
  it('säubern: unbekanntes Feld, Vergleich, fehlender Wert, Grenze', () => {
    const r = bedingungenAus([{ feld: 'deal.stufe', op: 'gleich', wert: 'x' }, { feld: 'nicht.da', op: 'gleich', wert: 'x' }, { feld: 'deal.stufe', op: 'eval' }, { feld: 'deal.stufe', op: 'gleich' }], ['deal.stufe']);
    expect(r.bedingungen).toHaveLength(1);
    expect(r.befunde).toHaveLength(3);
    expect(bedingungenAus(Array.from({ length: 21 }, () => ({ feld: 'a', op: 'gesetzt' }))).befunde.some(b => /höchstens 20/.test(b.text))).toBe(true);
  });
});

describe('Passt ein Ereignis zum Auslöser? (Motor, schon hier rein getestet)', () => {
  const e = (x: Partial<Ereignis>): Ereignis => ({ nr: 1, id: 'crm:deal:d1:gewonnen', art: 'deal-stufe', quelle: 'crm', bezug: { dealId: 'd1' }, bereich: 'business', stufe: 'gewonnen', am: '2026-10-21T08:00:00.000Z', ...x });
  it('Art und Bedingung über die Felder des Ereignisses', () => {
    const a = { art: 'ereignis' as const, ereignis: 'deal-stufe' as const, bedingungen: [{ feld: 'ereignis.stufe', op: 'gleich' as const, wert: 'gewonnen' }] };
    expect(ausloeserPasst(a, PZ, e({}), ereignisDaten(e({})))).toBe(true);
    expect(ausloeserPasst(a, PZ, e({ stufe: 'angebot' }), ereignisDaten(e({ stufe: 'angebot' })))).toBe(false);
    expect(ereignisDaten(e({}))).toMatchObject({ 'ereignis.art': 'deal-stufe', 'bezug.dealid': 'd1' });
  });
  it('nie ein privates Ereignis (Prozesse sind Business)', () => {
    const a = { art: 'ereignis' as const, ereignis: 'zahlungseingang' as const };
    expect(ausloeserPasst(a, PZ, e({ art: 'zahlungseingang', bereich: 'privat' }), {})).toBe(false);
    expect(ausloeserPasst(a, PZ, e({ art: 'zahlungseingang', bereich: 'business' }), {})).toBe(true);
  });
  it('Webhook nur für den eigenen Prozess', () => {
    const a = { art: 'webhook' as const, felder: [] };
    const w = e({ art: 'webhook', quelle: 'webhook', bezug: { prozessId: PZ, eingangId: 'we-x' } });
    expect(ausloeserPasst(a, PZ, w, {})).toBe(true);
    expect(ausloeserPasst(a, PZ2, w, {})).toBe(false);
  });
});

describe('Ereignis-Art `webhook` im Ereignis-System (additiv)', () => {
  it('angebunden, intern — kein Skill-Auslöser; Kennungen Prozess und Eingang im Bezug', () => {
    expect(istEreignisArt('webhook')).toBe(true);
    expect(EREIGNISSE_INTERN).toContain('webhook');
    expect(SKILL_EREIGNISSE).not.toContain('webhook');
    const s = eingabeSauber({ id: 'webhook:pz-x:we-y', art: 'webhook', quelle: 'webhook', bezug: { prozessId: 'pz-x', eingangId: 'we-y' }, bereich: 'business' }, istEreignisArt);
    expect(s).toMatchObject({ art: 'webhook', quelle: 'webhook', bezug: { prozessId: 'pz-x', eingangId: 'we-y' }, bereich: 'business' });
  });
  it('alte Ereignisse lesen sich unverändert (nur neue Union-Glieder)', () => {
    const alt = { id: 'gmail:abc', art: 'neue-mail' as const, quelle: 'gmail' as const, bezug: { kontaktId: 'c-1', gespraech: 'gm~t' }, bereich: 'business' as const, person: 'pia' };
    expect(eingabeSauber(alt, istEreignisArt)).toEqual(alt);
  });
});
