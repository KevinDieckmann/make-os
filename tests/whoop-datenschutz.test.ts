// WHOOP je Person — Datenschutz (Art. 9): Register, Konto-Export ohne Token, Verzeichnis, Empfänger ohne behauptete Garantie.
import { describe, it, expect } from 'vitest';
import { SPEICHER_REGISTER } from '@/lib/crm/speicher-register';
import { PERSON_BESTAENDE, personBestandNamen } from '@/lib/datenschutz/konto-daten';
import { verzeichnisVervollstaendigen, VV_WHOOP_ID } from '@/lib/crm/datenschutz';
import { EMPFAENGER_START, drittlandOhneGarantie } from '@/lib/datenschutz/einrichtung';
import { KONTO_VERARBEITUNGEN } from '@/lib/datenschutz/art15';

describe('WHOOP im Speicher-Register', () => {
  it('Verbindung und Spiegel je Person mit Pflicht-Angaben, Kategorie Art. 9; Anmelde-Zustand ohne Personendaten', () => {
    const e = (m: string) => SPEICHER_REGISTER.find(x => x.muster === m);
    for (const m of ['whoop-verbindung--*', 'whoop-stand--*']) {
      expect(e(m), m).toMatchObject({ bezug: 'haushalt', kategorie: ['art9'] });
      expect(e(m)?.rechtsgrundlage, m).toContain('Art. 9');
      expect(e(m)?.loeschfrist, m).toBeTruthy();
    }
    expect(e('whoop-oauth-zustand')).toMatchObject({ bezug: 'kein' });
  });
});

describe('Konto: Export und Löschen', () => {
  it('Spiegel geht in den Export, der Zugang (Token) nie', () => {
    expect(PERSON_BESTAENDE.find(b => b.basis === 'whoop-stand')?.export).toBeUndefined();
    expect(PERSON_BESTAENDE.find(b => b.basis === 'whoop-verbindung')?.export).toBe(false);
    expect(personBestandNamen('malin', ['whoop-stand--malin', 'whoop-verbindung--malin', 'whoop-stand--kevin'])).toEqual([
      { name: 'whoop-stand--malin', export: true }, { name: 'whoop-verbindung--malin', export: false },
    ]);
  });
});

describe('Verzeichnis und Empfänger', () => {
  it('„WHOOP je Person“ wird nachgetragen, sobald WHOOP eingerichtet ist — sonst nicht; Konto-Auskunft nennt es', () => {
    const jetzt = '2026-10-08T08:00:00.000Z';
    const ohne = verzeichnisVervollstaendigen([], jetzt).liste;
    expect(ohne.some(v => v.id === VV_WHOOP_ID)).toBe(false);
    const mit = verzeichnisVervollstaendigen(ohne, jetzt, { whoop: true });
    expect(mit.geaendert).toBe(true);
    expect(mit.liste.find(v => v.id === VV_WHOOP_ID)).toMatchObject({ empfaengerIds: ['whoop', 'hetzner'] });
    expect(verzeichnisVervollstaendigen(mit.liste, jetzt, { whoop: true }).geaendert).toBe(false); // idempotent
    expect(KONTO_VERARBEITUNGEN).toContain(VV_WHOOP_ID);
  });
  it('WHOOP (USA): die Garantie ist „zu prüfen“ — nicht behauptet', () => {
    const w = EMPFAENGER_START.find(e => e.id === 'whoop')!;
    expect(w.garantie).toBe('pruefen');
    expect(w.notiz).toMatch(/prüfen/);
    expect(drittlandOhneGarantie([{ ...w, dritte: true }])).toHaveLength(1);
  });
});
