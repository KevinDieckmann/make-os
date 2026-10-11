// ─── Wächter „Firma und Privat liegen getrennt — auch in der Datenhaltung“ (09.10. spät, Plan TRENNUNG_PRIVAT_BUSINESS.md) ──
// Kevin: „Höchster Datenschutz, Firma und Privat müssen immer getrennt liegen, auch von den Daten, sonst kriegen wir es nachher
// nicht in Firmen implementiert.“ Heute noch KEINE Verhaltensänderung — der Wächter hält nur fest, wo wir stehen:
//   (a) jeder Bestand im Speicher-Register trägt einen Bereich (privat · business · person · instanz · gemischt),
//   (b) die Liste der gemischten Bestände wird nur KÜRZER (Altbestand unten; ein getrennter Bestand fliegt dort raus),
//   (c) ein NEUER Bestand ist nie gemischt — je Bereich ein eigener Bestand (Muster wie `<name>--privat` / `<name>--business`
//       bzw. ein Bestand, der nur einem Bereich dient).
// Dass jeder Bestandsname im Code im Register steht, prüft schon tests/datenschutz-register.test.ts (Scanner).
import { describe, it, expect } from 'vitest';
import {
  SPEICHER_REGISTER, SPEICHER_BEREICHE, GEMISCHT, BEREICH_MUSTER, bereichNennungen, bereichVonBestand, registerEintrag,
} from '@/lib/crm/speicher-register';

// Gemischte Bestände am 09.10.2026 (Inventur). NUR KÜRZER WERDEN LASSEN: wer einen Bestand trennt (oder Kevin entscheidet, wohin
// er gehört), nimmt ihn hier heraus und gibt ihm im Register seinen Bereich. Neue Einträge hier nur auf Kevins ausdrückliches Wort.
const ALTBESTAND_GEMISCHT: readonly string[] = [
  // Kartei und Markttraktion
  'kontakte', 'crm', 'crm-dateien--*', 'gesellschaften--*', 'mandate-tabelle-laeufe',
  // Aufgaben und Planung
  'tasks', 'aufgaben-dateien--*', 'ordnung', 'zoe-chargen--*', 'ziele', 'ziele-eigen', 'ziele-eigen--*', 'meilensteine', 'meilenstein-raum--*', 'routinen',
  'wochenplan', 'wochenplan--*', 'kapazitaet--*', 'kapazitaet-plan--*', 'zeit', 'zeit--*', 'performance', 'performance--*',
  'tageslauf', 'tageslauf--*',
  // Kalender
  'calendar-cache', 'kalender-icloud', 'kalender-bezug', 'meetings', 'apple-reminders-cache', 'apple-contacts-cache',
  // Postfächer
  'imap-stand--*', 'imap-text--*', 'inbox-zustand--*', 'inbox-uebergaben--*', 'inbox-geteilt--*', 'inbox-absender', 'inbox-triage',
  'inbox-status', 'apple-mail-cache',
  // Kein neuer Bestand: der Datei-Ordner der Übergaben (seit 10.10.) — erst am 11.10. im Register eingetragen (Prüf-Fund N11), folgt inbox-uebergaben--*.
  'inbox-uebergaben',
  // Finanzen und Steuern
  'finanzplan', 'rechnungswesen', 'finanzen-plan--*', 'liquiplan', 'buchungen', 'grundlage', 'business-abschluesse', 'abschluss-laeufe',
  'business-einstellungen', 'business-verlauf', 'finanzchef-einstellung', 'steuern', 'haushalt-*--*', 'haushalt-umzug--*', 'konten--*',
  'kontoauszug-laeufe--*',
  // ZOE, Agenten, KI, Medien
  'zoe-verlauf', 'zoe-gedaechtnis', 'zoe-protokoll', 'zoe-stapel', 'zoe-entscheidungen--*', 'zoe-auftraege', 'zoe-empfang',
  'agenten-faeden--*', 'agenten-faden--*', 'agenten-skills--*', 'agenten-plan--*', 'agenten-einstellung--*', 'agent-log', 'meldungen--*',
  'ereignisse--*', 'ki-medien--*', 'ki-medien', 'medien', 'medien-uploads',
  // Protokolle, deren Einträge je einem Bestand/Bereich gehören
  'aenderungsprotokoll--*', 'leseprotokoll--*', 'aenderungen',
];

// Art.-9-Inhalte in gemischten Beständen (Stand 09.10.) — nur kürzer werden lassen. Gesundheit gehört zur Person, nie ins Business.
const ART9_GEMISCHT_ALTBESTAND: readonly string[] = ['agenten-einstellung--*', 'tageslauf', 'tageslauf--*'];

const gemischt = () => SPEICHER_REGISTER.filter(e => e.bereich === 'gemischt').map(e => e.muster);

describe('Bereich je Bestand (Firma und Privat getrennt)', () => {
  it('(a) jeder Eintrag des Speicher-Registers trägt einen gültigen Bereich', () => {
    const ohne = SPEICHER_REGISTER.filter(e => !e.bereich || !SPEICHER_BEREICHE.includes(e.bereich)).map(e => e.muster);
    expect(ohne, `Bestand ohne Bereich — in lib/crm/speicher-register.ts (IN_PRIVAT, IN_BUSINESS, JE_PERSON, INSTANZ) eintragen: ${ohne.join(', ')}`).toEqual([]);
  });

  it('jedes Muster steht genau einmal in den Bereichs-Listen, und keins ist tot', () => {
    const register = new Set(SPEICHER_REGISTER.map(e => e.muster));
    const tot = BEREICH_MUSTER.filter(m => !register.has(m));
    expect(tot, `Bereichs-Liste nennt Muster, die es im Register nicht gibt: ${tot.join(', ')}`).toEqual([]);
    const doppelt = Array.from(new Set(BEREICH_MUSTER.filter(m => bereichNennungen(m) !== 1)));
    expect(doppelt, `Muster in mehreren Bereichs-Listen: ${doppelt.join(', ')}`).toEqual([]);
  });

  it(`(b) die gemischten Bestände werden nur weniger (Altbestand ${ALTBESTAND_GEMISCHT.length})`, () => {
    const jetzt = gemischt();
    expect(jetzt.length).toBeLessThanOrEqual(ALTBESTAND_GEMISCHT.length);
    const getrennt = ALTBESTAND_GEMISCHT.filter(m => !jetzt.includes(m));
    expect(getrennt, `Nicht mehr gemischt (gut!) — bitte aus ALTBESTAND_GEMISCHT in tests/trennung-bereiche.test.ts nehmen: ${getrennt.join(', ')}`).toEqual([]);
  });

  it('(c) ein neuer Bestand ist nie gemischt — je Bereich ein eigener Bestand', () => {
    const neu = gemischt().filter(m => !ALTBESTAND_GEMISCHT.includes(m));
    expect(neu, `Neuer gemischter Bestand: ${neu.join(', ')} — Privat und Business getrennt ablegen (TRENNUNG_PRIVAT_BUSINESS.md › Regel für Neues)`).toEqual([]);
  });

  it('gemischte Bestände sagen, was heute trennt — die übrigen nicht', () => {
    for (const e of SPEICHER_REGISTER) {
      if (e.bereich === 'gemischt') expect(e.trennung?.length ?? 0, e.muster).toBeGreaterThan(10);
      else expect(e.trennung, e.muster).toBeUndefined();
    }
    expect(Object.keys(GEMISCHT).sort()).toEqual(gemischt().sort());
  });

  it('Gesundheit (Art. 9) liegt nie im Business oder in der Instanz; gemischt nur im Altbestand', () => {
    const art9 = SPEICHER_REGISTER.filter(e => e.kategorie?.includes('art9'));
    expect(art9.length).toBeGreaterThan(10);
    for (const e of art9) expect(['person', 'privat', 'gemischt'], e.muster).toContain(e.bereich);
    const art9Gemischt = art9.filter(e => e.bereich === 'gemischt').map(e => e.muster);
    for (const m of art9Gemischt) expect(ART9_GEMISCHT_ALTBESTAND, `${m}: Art.-9-Inhalt in einem gemischten Bestand`).toContain(m);
  });

  it('Stichproben: Bereich laut Inventur (bereichVonBestand löst Namen mit Suffix auf)', () => {
    expect(bereichVonBestand('vitals--h-pruef')).toBe('person');
    expect(bereichVonBestand('gesundheit-unterlagen--h-pruef')).toBe('person');
    expect(bereichVonBestand('familie--h-pruef')).toBe('privat');
    expect(bereichVonBestand('crm-sperrliste--h-pruef')).toBe('business');
    expect(bereichVonBestand('kalender-google--h-pruef')).toBe('business');
    expect(bereichVonBestand('konten')).toBe('instanz');
    expect(bereichVonBestand('tasks')).toBe('gemischt');
    expect(bereichVonBestand('finanzen-plan--h-pruef')).toBe('gemischt');
    expect(bereichVonBestand('gibt-es-nicht')).toBeNull();
    expect(registerEintrag('buchungen')?.trennung).toMatch(/ort/);
  });
});
