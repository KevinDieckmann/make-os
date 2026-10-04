// ─── Wächter: Kapazität → Strahl (04.10.2026) ────────────────────────────────
// Überlast einer Person in einer Woche ist eine Abweichung (Art `ueberlastet`, gleich stark, Stärke = Überlast) — am Strang
// ihres Meilensteins, ohne Zuordnung am Space-Strang Business. Keine Überlast → glatt. Privat-Regel: nie an „Belegt“/privaten
// Strängen der anderen Person, Erholung kommt nur über den gefilterten Stand. Jede Abweichung führt zur Kapazität.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { kapazitaetUeberlastet, ueberlast, postenDerWoche, personVonKapaId } from '@/lib/kapazitaet/abweichung';
import { abweichungenSammeln, ausschlagJeWoche, abweichungGueltig } from '@/lib/lichtfaeden/abweichung';
import { BEIDE, GESAMT, type Strang } from '@/lib/lichtfaeden/modell';
import { WEG } from '@/lib/wege';
import type { KapaStand, Machbarkeit, PersonStand, WochePerson } from '@/lib/kapazitaet/typen';

const HEUTE = '2026-10-05';
const W1 = '2026-10-05'; const W2 = '2026-10-12'; const W3 = '2026-10-19';
const woche = (w: string, belastbar: number, bedarf: number): WochePerson => ({ woche: w, brutto: belastbar, abwesend: 0, termine: 0, termineAnzahl: 0, umschalten: 0, bloecke: 0, netto: belastbar, belastbar, gebunden: 0, bedarf });
const person = (id: string, name: string, wochen: WochePerson[]): PersonStand => ({ id, name, quelle: 'konto', grundwert: 40, grundwertQuelle: 'einstellung', wochen, ausnahmen: [] });
const posten = (id: string, termin: string, personen: string[] = [], titel = `Meilenstein ${id}`): Machbarkeit => ({ art: 'meilenstein', id, titel, termin, aufwand: 40, rest: 20, personen, status: 'eng', text: '' });
const stand = (personen: PersonStand[], p: Machbarkeit[] = []): Pick<KapaStand, 'team' | 'personen' | 'posten'> => ({ personen, posten: p, team: { wochen: [], kopf: { faktor: 1, personen: 0, tage: 14 } } });
const msStrang = (id: string, o: Partial<Strang> = {}): Strang => ({
  id: `ms:${id}`, quelle: 'meilenstein', titel: `Meilenstein ${id}`, pfad: [GESAMT, 'space:business', 'thema:business:planung', 'ziel:z1', `ms:${id}`],
  person: BEIDE, zeit: { tag: '2026-10-30' }, gewicht: 1, status: 'offen', link: WEG.meilenstein(id), ...o,
});
const kontext = (straenge: Strang[] = []) => ({ heute: HEUTE, von: '2026-10-01', bis: '2026-12-31', straenge });

describe('Überlast → Ausschlag', () => {
  it('eine überlastete Woche wird eine gültige Abweichung am Strang des Meilensteins, gleich stark, mit Weg zur Kapazität', () => {
    const s = stand([person('konto-anna', 'Anna', [woche(W1, 30, 20), woche(W2, 30, 45), woche(W3, 30, 28)])], [posten('m1', '2026-10-30', ['konto-anna'])]);
    const aus = kapazitaetUeberlastet(s, 'anna')(kontext([msStrang('m1')]));
    expect(aus).toHaveLength(1);
    const a = aus[0];
    expect(a).toMatchObject({ art: 'ueberlastet', verlauf: 'gleich', von: W2, bis: '2026-10-18', person: 'anna', strang: 'ms:m1', link: WEG.kapazitaet('konto-anna') });
    expect(a.pfad).toEqual([GESAMT, 'space:business', 'thema:business:planung', 'ziel:z1', 'ms:m1']);
    expect(a.staerke).toBe(0.5); // 45 h Bedarf gegen 30 h belastbar = 50 % Überlast
    expect(abweichungGueltig(a)).toBe(true);
    const aussch = ausschlagJeWoche(aus, [W1, W2, W3]);
    expect(aussch[0]).toBe(0);
    expect(aussch[1]).toBe(0.5);
  });
  it('Stärke ist die Überlast, gedeckelt auf 1; ohne belastbare Zeit voll', () => {
    expect(ueberlast(40, 40)).toBe(0);
    expect(ueberlast(40, 50)).toBe(0.25);
    expect(ueberlast(10, 100)).toBe(1);
    expect(ueberlast(0, 5)).toBe(1);
    expect(ueberlast(0, 0)).toBe(0);
  });
  it('ohne Zuordnung bzw. ohne sichtbaren Strang am Space-Strang Business — Titel ohne Posten', () => {
    const s = stand([person('konto-anna', 'Anna', [woche(W1, 20, 30)])]);
    const [a] = kapazitaetUeberlastet(s, 'anna')(kontext([msStrang('m1')]));
    expect(a.pfad).toEqual([GESAMT, 'space:business']);
    expect(a.strang).toBeUndefined();
    expect(a.titel).toBe('Kapazität Anna');
  });
  it('ausdrücklich zugeordnete Posten vor Team-Posten, früherer Termin zuerst; fremde Posten nie', () => {
    const l = [posten('team', '2026-10-20'), posten('spaet', '2026-11-30', ['konto-anna']), posten('frueh', '2026-10-25', ['konto-anna']), posten('fremd', '2026-10-10', ['konto-ben'])];
    expect(postenDerWoche(l, 'konto-anna', W2)?.id).toBe('frueh');
    expect(postenDerWoche(l, 'konto-ben', W1)?.id).toBe('fremd');
    expect(postenDerWoche([posten('team', '2026-10-20')], 'konto-ben', W1)?.id).toBe('team');
    expect(postenDerWoche([posten('alt', '2026-10-01', ['konto-anna'])], 'konto-anna', W2)).toBeNull();
  });
  it('Team-Person ohne Konto gehört dem Haushalt (BEIDE)', () => {
    expect(personVonKapaId('konto-anna')).toBe('anna');
    expect(personVonKapaId('t-extern')).toBe(BEIDE);
  });
});

describe('Keine Überlast → glatt', () => {
  it('eng (bis 100 %) ist keine Abweichung; leere Wochen und Personen ohne Kapa auch nicht', () => {
    const s = stand([
      person('konto-anna', 'Anna', [woche(W1, 30, 30), woche(W2, 30, 10)]),
      { ...person('t-x', 'Extern', [woche(W1, 0, 20)]), quelle: 'team', ohneKapa: true },
    ], [posten('m1', '2026-10-30')]);
    expect(kapazitaetUeberlastet(s, 'anna')(kontext([msStrang('m1')]))).toEqual([]);
    expect(kapazitaetUeberlastet(null, 'anna')(kontext())).toEqual([]);
  });
  it('Wochen außerhalb des Fensters zählen nicht', () => {
    const s = stand([person('konto-anna', 'Anna', [woche('2027-03-01', 10, 40)])]);
    expect(kapazitaetUeberlastet(s, 'anna')(kontext())).toEqual([]);
  });
});

describe('Privat-Regel', () => {
  it('nie am privaten Strang der anderen Person oder an „Belegt“ — dann am Space-Strang', () => {
    const s = stand([person('konto-anna', 'Anna', [woche(W1, 20, 30)])], [posten('m1', '2026-10-30', ['konto-anna'])]);
    const privatBen = msStrang('m1', { privat: true, person: 'ben' });
    const [a] = kapazitaetUeberlastet(s, 'anna')(kontext([privatBen]));
    expect(a.pfad).toEqual([GESAMT, 'space:business']);
    expect(a.strang).toBeUndefined();
    expect(a.titel).toBe('Kapazität Anna');
    const belegt: Strang = { id: 'belegt:x', quelle: 'belegt', titel: 'Belegt', pfad: [GESAMT, 'space:business', 'ms:m1'], person: 'ben', zeit: { tag: '2026-10-30' }, gewicht: 1, status: 'offen', privat: true };
    expect(kapazitaetUeberlastet(s, 'anna')(kontext([belegt]))[0].pfad).toEqual([GESAMT, 'space:business']);
    // Der eigene private Strang ist erlaubt.
    expect(kapazitaetUeberlastet(s, 'ben')(kontext([privatBen]))[0].strang).toBe('ms:m1');
  });
  it('angedockt über abweichungenSammeln: gültig, Link bleibt; der Lader liest nur den gefilterten Stand', () => {
    const s = stand([person('konto-anna', 'Anna', [woche(W1, 20, 30)])]);
    const l = abweichungenSammeln(kontext(), 'ben', [kapazitaetUeberlastet(s, 'ben')]);
    expect(l.filter(a => a.art === 'ueberlastet')).toHaveLength(1);
    expect(l[0].link).toBe(WEG.kapazitaet('konto-anna'));
    const lader = readFileSync(path.resolve(__dirname, '..', 'lib/lichtfaeden/abweichung-quellen-server.ts'), 'utf8');
    expect(lader).toContain('kapaStandFuer(betrachter');
    expect(lader).not.toMatch(/kapaStandRoh|kapazitaetRechnen/);
  });
  it('Abweichungen aus Strängen tragen den Link des Strangs; „Belegt“ der anderen Person keinen', () => {
    const l = abweichungenSammeln({ ...kontext([msStrang('m9', { zeit: { tag: '2026-09-20' } })]), heute: HEUTE }, 'anna');
    expect(l[0].link).toBe(WEG.meilenstein('m9'));
  });
});
