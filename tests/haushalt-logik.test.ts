// ─── Haushaltsfinanzen: Malins Testsuite, portiert ──────────────────────────
// Ihre Worte: „Die Testsuite ist die eigentliche Spezifikation.“ Die Prüfungen
// hier sind ihre (tests/test.js im Finanz-Cockpit), übertragen auf Cent und
// einen festen Stichtag. Echte Namen sind durch Beispiele ersetzt. Neu dazu:
// Zeitzone, die eine Einordnung, Regeln vor N26-Kategorie, laufende Nummer.

import { describe, it, expect, afterEach } from 'vitest';
import type { Buchung, Regel, Schuld } from '../lib/finanzen/haushalt/typen';
import { trifft, rueckwirkendTreffer, proMonat, selbsttest, anwenden, normal } from '../lib/finanzen/haushalt/regeln';
import { ausN26Text, ausCsv, fingerabdruck, vorbereiten, importAblauf, katIdFinder, zeilenAusTextItems } from '../lib/finanzen/haushalt/import';
import { sockel, wiederkehrend, luft } from '../lib/finanzen/haushalt/fixkosten';
import { kennzahlen, schuldenbild, bewertungSparquote, aufschluesselung, einnahmebild, istWert, wichtig } from '../lib/finanzen/haushalt/kennzahlen';
import { artVon, istRegelmaessig, einordnen, summen, type KatName } from '../lib/finanzen/haushalt/einordnung';
import { vollMonate, heuteBerlin, monatPlus } from '../lib/finanzen/haushalt/monat';
import { laufzeit } from '../lib/finanzen/haushalt/schulden';

const HEUTE = '2026-09-24';
let n = 0;
function b(teil: Partial<Buchung> & { betrag: number; datum: string }): Buchung {
  n++;
  return {
    id: `b${n}`, stand: 1, konto_id: 'k1', beschreibung: teil.empfaenger ?? 'X', empfaenger: 'X', kategorie_id: null,
    ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: null,
    notiz: null, import_id: null, erfasst_von: null, geaendert: '2026-09-24T00:00:00Z', ...teil,
  };
}
const kat = (namen: Record<string, string>): KatName => id => (id ? namen[id] ?? '' : '');
const monate12 = vollMonate(12, 0, HEUTE);
const tag = (i: number, t = '05') => `${monate12[i]}-${t}`;

describe('Wortgrenzen (der mOBIlity-Fehler aus Version 1)', () => {
  it('trifft ganze Wörter, auch mit Umlaut-Normalisierung', () => {
    expect(trifft('OBI', 'Miles Mobility GmbH')).toBe(false);
    expect(trifft('OBI', 'OBI Markt Berlin')).toBe(true);
    expect(trifft('dm', 'Amsterdam Ticket')).toBe(false);
    expect(trifft('dm', 'dm-drogerie markt')).toBe(true);
    expect(trifft('Müller', 'MUELLER HANDEL GMBH')).toBe(true);
    expect(trifft('Rossmann', 'Grossmannstrasse 4')).toBe(false);
    expect(trifft('obi', 'Miles Mobility', false)).toBe(true);
    expect(selbsttest()).toEqual([]);
  });
});

describe('N26-Text, Dubletten, CSV', () => {
  const n26 = ['Telekom Deutschland GmbH · Mobilfunk 01.06.2026 -111,40€', 'REWE Markt GmbH 03.06.2026 -47,82€', 'Bundesagentur für Arbeit 15.06.2026 +1.234,56€', 'Lange Beschreibung die über', 'mehrere Zeilen geht 20.06.2026 -9,99€', 'Zeile ohne alles'].join('\n');
  const g = ausN26Text(n26).buchungen;
  it('liest vier Buchungen mit Datum, Vorzeichen, Tausenderpunkt, Mehrzeiligkeit', () => {
    expect(g.length).toBe(4);
    expect([g[0].beschreibung, g[0].datum, g[0].betrag]).toEqual(['Telekom Deutschland GmbH · Mobilfunk', '2026-06-01', -11140]);
    expect(g[2].betrag).toBe(123456);
    expect(g[3].beschreibung).toBe('Lange Beschreibung die über mehrere Zeilen geht');
    expect(g[1].datum).toBe('2026-06-03');
  });
  it('Fingerabdruck: gleiche Zeile gleich, anderer Betrag oder anderes Konto anders', () => {
    const a = fingerabdruck('k1', '2026-06-01', -11140, 'Telekom Deutschland GmbH');
    expect(fingerabdruck('k1', '2026-06-01', -11140, 'telekom   deutschland gmbh')).toBe(a);
    expect(fingerabdruck('k1', '2026-06-01', -11141, 'Telekom Deutschland GmbH')).not.toBe(a);
    expect(fingerabdruck('k2', '2026-06-01', -11140, 'Telekom Deutschland GmbH')).not.toBe(a);
  });
  it('Fingerabdruck ist Zeichen für Zeichen Malins Formel (Euro mit zwei Stellen)', () => {
    // Nachgerechnet mit ihrer JS-Funktion für ('k1','2026-06-01',-111.40,'Telekom Deutschland GmbH').
    const roh = ['k1', '2026-06-01', (-111.4).toFixed(2), normal('Telekom Deutschland GmbH').slice(0, 80)].join('|');
    let h = 0; for (let i = 0; i < roh.length; i++) { h = ((h << 5) - h) + roh.charCodeAt(i); h |= 0; }
    expect(fingerabdruck('k1', '2026-06-01', -11140, 'Telekom Deutschland GmbH')).toBe(`fp${(h >>> 0).toString(36)}-${roh.length.toString(36)}`);
  });
  it('CSV: Komma im Feld überlebt, deutscher Betrag, ISO-Datum', () => {
    const cg = ausCsv('Datum,Empfänger,Verwendungszweck,Betrag\n"01.09.2026","REWE","Einkauf, Berlin","-23,45"\n"02.09.2026","Gehalt","Lohn","2.500,00"').buchungen;
    expect(cg.length).toBe(2);
    expect(cg[0].beschreibung).toBe('Einkauf, Berlin');
    expect(cg[1].betrag).toBe(250000);
    expect(cg[0].datum).toBe('2026-09-01');
  });
});

describe('Fixkosten-Erkennung und Sockel', () => {
  const liste: Buchung[] = [];
  for (let i = 0; i < 6; i++) liste.push(b({ empfaenger: 'Vermieter Beispiel', betrag: -125000, datum: tag(i), kategorie_id: 'k1' }));
  [-3999, -3999, -4150, -3999].forEach((x, i) => liste.push(b({ empfaenger: 'Telekom Deutschland', betrag: x, datum: tag(i), kategorie_id: 'k1' })));
  [-2340, -8710, -14000, -1250, -9990, -4500].forEach((x, i) => liste.push(b({ empfaenger: 'REWE Markt', betrag: x, datum: tag(i), kategorie_id: 'k1' })));
  liste.push(b({ empfaenger: 'Zahnarzt Beispiel', betrag: -8000, datum: tag(0) }), b({ empfaenger: 'Zahnarzt Beispiel', betrag: -8000, datum: tag(1) }));
  for (let i = 0; i < 6; i++) liste.push(b({ empfaenger: 'An Kevin & Malin', betrag: -50000, datum: tag(i, '01'), ist_umbuchung: true }));
  const katName = kat({ k1: 'Wohnen' });
  const schulden = [{ rate: 30000 }] as Schuld[];

  it('erkennt Miete und Handy, nicht REWE, nicht zu Seltenes, nicht Umbuchungen', () => {
    const w = wiederkehrend(liste, katName, HEUTE);
    const namen = w.map(x => x.name);
    expect(namen).toContain('Vermieter Beispiel');
    expect(namen).toContain('Telekom Deutschland');
    expect(namen).not.toContain('REWE Markt');
    expect(namen).not.toContain('Zahnarzt Beispiel');
    expect(namen).not.toContain('An Kevin & Malin');
    expect(Math.round(w.find(x => x.name === 'Vermieter Beispiel')!.mittel)).toBe(125000);
    expect(w[0].name).toBe('Vermieter Beispiel');
  });
  it('Sockel = markierte Fixkosten + Kreditraten', () => {
    expect(Math.round(sockel(liste, schulden, HEUTE).gesamt)).toBe(30000);
    const markiert = liste.map(x => (x.empfaenger === 'Vermieter Beispiel' ? { ...x, ist_fixkosten: true } : x));
    expect(Math.round(sockel(markiert, schulden, HEUTE).gesamt)).toBe(155000);
  });
});

describe('Turnus: Quartal und Jahr auf den Monat', () => {
  it('rechnet um', () => {
    expect(proMonat(10000, 'monatlich')).toBe(10000);
    expect(Math.round(proMonat(30000, 'quartal'))).toBe(10000);
    expect(Math.round(proMonat(120000, 'jahr'))).toBe(10000);
    expect(proMonat(5000, 'quatsch')).toBe(5000);
  });
  const liste: Buchung[] = [];
  for (let i = 0; i < 12; i++) liste.push(b({ empfaenger: 'Vermieter', betrag: -100000, datum: tag(i), ist_fixkosten: true }));
  [0, 3, 6, 9].forEach(i => liste.push(b({ empfaenger: 'Allianz Versicherung', betrag: -30000, datum: tag(i), ist_fixkosten: true, turnus: 'quartal' })));
  liste.push(b({ empfaenger: 'Hauptzollamt', betrag: -120000, datum: tag(5), ist_fixkosten: true, turnus: 'jahr' }));
  it('Sockel rechnet den Turnus ein (1000 + 100 + 100)', () => {
    const s = sockel(liste, [], HEUTE);
    expect(Math.round(s.gesamt)).toBe(120000);
    expect(s.posten.length).toBe(3);
    expect(Math.round(s.posten.find(x => /Allianz/.test(x.name))!.proMonat)).toBe(10000);
    expect(Math.round(s.posten.find(x => /Hauptzoll/.test(x.name))!.proMonat)).toBe(10000);
  });
  it('erkennt den Rhythmus, Jahreszahlung als unsicher', () => {
    const w = wiederkehrend(liste, () => '', HEUTE);
    expect(w.find(x => /Vermieter/.test(x.name))?.vorschlag).toBe('monatlich');
    expect(w.find(x => /Allianz/.test(x.name))?.vorschlag).toBe('quartal');
    expect(w.find(x => /Hauptzoll/.test(x.name))?.unsicher).toBe(true);
  });
});

describe('Aufschlüsselung: Bereiche mit Empfängern', () => {
  const liste = [
    b({ empfaenger: 'EDEKA', betrag: -4000, kategorie_id: 'k-lebens', datum: '2026-08-05' }),
    b({ empfaenger: 'EDEKA', betrag: -2000, kategorie_id: 'k-lebens', datum: '2026-08-05' }),
    b({ empfaenger: 'REWE Markt', betrag: -4000, kategorie_id: 'k-lebens', datum: '2026-08-05' }),
    b({ empfaenger: 'Flink SE', betrag: -10000, kategorie_id: 'k-essen', datum: '2026-08-05' }),
    b({ empfaenger: 'Lieferando', betrag: -10000, kategorie_id: 'k-essen', datum: '2026-08-05' }),
    b({ empfaenger: 'Unbekannt GmbH', betrag: -5000, datum: '2026-08-05' }),
    b({ empfaenger: 'Gehalt', betrag: 200000, kategorie_id: 'k-ein', datum: '2026-08-05' }),
    b({ empfaenger: 'An Sparziel', betrag: -50000, kategorie_id: 'k-umb', ist_umbuchung: true, datum: '2026-08-05' }),
  ];
  const a = aufschluesselung(liste, kat({ 'k-lebens': 'Lebensmittel', 'k-essen': 'Essen auswärts', 'k-ein': 'Gehalt' }));
  it('nur Ausgaben, größter Bereich zuerst, Nicht-Zugeordnetes sichtbar', () => {
    expect(a.gesamt).toBe(35000);
    expect(a.bereiche.map(x => x.name)).toEqual(['Essen auswärts', 'Lebensmittel', 'Noch nicht zugeordnet']);
    expect(a.bereiche.flatMap(x => x.haendler.map(h => h.name))).not.toContain('Gehalt');
    expect(a.bereiche.flatMap(x => x.haendler.map(h => h.name))).not.toContain('An Sparziel');
    expect(a.bereiche[1].haendler[0]).toMatchObject({ name: 'EDEKA', anzahl: 2 });
  });
});

describe('Einnahmen: planbar, einmalig, durchlaufend, geliehen', () => {
  const namen = { g: 'Gehalt', s: 'Selbstständigkeit', a: 'Aktien & Krypto', e: 'Erstattung', k: 'Kredit erhalten', u: 'Umbuchung' };
  const liste = [
    b({ empfaenger: 'Arbeitgeber GmbH', betrag: 240000, kategorie_id: 'g', datum: '2026-08-10' }),
    b({ empfaenger: 'Kunde Meier', betrag: 80000, kategorie_id: 's', datum: '2026-08-10' }),
    b({ empfaenger: 'Trade Republic', betrag: 35000, kategorie_id: 'a', datum: '2026-08-10' }),
    b({ empfaenger: 'Finanzamt', betrag: 12000, kategorie_id: 'e', datum: '2026-08-10' }),
    b({ empfaenger: 'Oma', betrag: 20000, datum: '2026-08-10' }),
    b({ empfaenger: 'Sparkasse', betrag: 500000, kategorie_id: 'k', datum: '2026-08-10' }),
    b({ empfaenger: 'Von Sparziel', betrag: 30000, kategorie_id: 'u', ist_umbuchung: true, datum: '2026-08-10' }),
    b({ empfaenger: 'EDEKA', betrag: -5000, datum: '2026-08-10' }),
  ];
  it('Einteilung in Töpfe nach Malins Tabelle', () => {
    expect(istRegelmaessig('Gehalt')).toBe(true);
    expect(istRegelmaessig('Aktien & Krypto')).toBe(false);
    expect(istRegelmaessig('Kredit erhalten')).toBe(false);
    expect(artVon('Entnahme Kevin (Selbstständigkeit)')).toBe('planbar');
    expect(artVon('Kindergeld & Sozialleistung')).toBe('planbar');
    expect(artVon('Geschenk & Familie')).toBe('einmalig');
    expect(artVon('Verkauf privat')).toBe('einmalig');
    expect(artVon('Rücküberweisung / Auslage')).toBe('durchlauf');
    expect(artVon('Erstattung / Retoure')).toBe('durchlauf');
    expect(artVon('Kredit erhalten')).toBe('schuld');
    expect(artVon('Selbstständigkeit')).toBe('planbar');
    expect(artVon('Irgendwas Neues')).toBe('einmalig');
    expect(artVon('Noch einzuordnen')).toBe('offen');
    expect(artVon('Einnahmen')).toBe('offen');
  });
  it('Aufteilung: 3.200 € planbar, Kredit 5.000 € gesondert, Offenes gemeldet', () => {
    const e = einnahmebild(liste, kat(namen));
    expect(e.toepfe.planbar).toBe(320000);
    expect(e.toepfe.schuld).toBe(500000);
    expect(e.toepfe.offen).toBe(20000);
    expect(e.toepfe.offeneZeilen).toBe(1);
    expect(e.arten.length).toBe(6);
    expect(e.arten[0].name).toBe('Kredit erhalten');
    expect(e.gesamt).toBe(887000);
  });
});

describe('Analyse: Durchschnitte, Quoten, Schuldenabbau', () => {
  const liste: Buchung[] = [];
  for (let i = 0; i < 12; i++) {
    liste.push(b({ betrag: 300000, datum: tag(i, '10'), kategorie_id: 'k-gehalt' }));
    liste.push(b({ betrag: -100000, datum: tag(i, '10'), ist_fixkosten: true }));
    liste.push(b({ betrag: -50000, datum: tag(i, '10') }));
  }
  for (let i = 0; i < 6; i++) liste.push(b({ betrag: -20000, datum: tag(i, '10'), kategorie_id: 'k-tilgung' }));
  liste.push(b({ betrag: 25000, datum: tag(0, '10'), kategorie_id: 'k-rueck' }));
  liste.push(b({ betrag: 90000, datum: tag(0, '10'), ist_umbuchung: true }));
  liste.push(b({ betrag: -999900, datum: `${HEUTE.slice(0, 7)}-05` }));
  const katName = kat({ 'k-gehalt': 'Gehalt', 'k-tilgung': 'Tilgung', 'k-rueck': 'Rücküberweisung / Auslage' });

  it('zwölf volle Monate, der laufende bleibt draußen', () => {
    expect(monate12.length).toBe(12);
    expect(monate12).not.toContain('2026-09');
    expect(monate12[0]).toBe('2026-08');
  });
  it('Kennzahlen wie bei Malin', () => {
    const k = kennzahlen(liste, monate12, katName);
    expect(Math.round(k.einProMonat)).toBe(300000);
    expect(Math.round(k.fixProMonat)).toBe(100000);
    expect(Math.round(k.varProMonat)).toBe(60000);
    expect(Math.round(k.saldoProMonat)).toBe(140000);
    expect(Math.round(k.sparquote)).toBe(47);
    expect(k.ein).toBe(3600000);
    expect(k.durchlauf).toBe(25000);
    expect(k.anzahl).toBe(12 * 3 + 6 + 1);
  });
  it('Schulden: getilgt, Tempo, Prognose — keine Prognose ohne Tilgung', () => {
    const schulden = [{ startbetrag: 1000000, restbetrag: 880000, rate: 20000 }] as Schuld[];
    const s = schuldenbild(liste, schulden, monate12, katName);
    expect(s.getilgt).toBe(120000);
    expect(Math.round(s.proMonat)).toBe(10000);
    expect(s.rest).toBe(880000);
    expect(Math.round(s.abgebaut)).toBe(12);
    expect(s.restMonate).toBe(88);
    expect(schuldenbild(liste, schulden, ['1999-01'], katName).restMonate).toBeNull();
  });
  it('„Kredit & Raten“ zählt jetzt auch als Tilgung (bei Malin nur in Ist gegen Soll)', () => {
    const l = [b({ betrag: -20000, datum: tag(0), kategorie_id: 'kr' })];
    expect(schuldenbild(l, [], monate12, kat({ kr: 'Kredit & Raten' })).getilgt).toBe(20000);
  });
  it('Sparquote wird eingeordnet', () => {
    expect(bewertungSparquote(-5).stufe).toBe('rot');
    expect(bewertungSparquote(25).text).toBe('sehr gut');
  });
});

describe('Die eine Einordnung (neu, behebt Malins drei Definitionen)', () => {
  const katName = kat({ k: 'Kredit erhalten', r: 'Rücküberweisung / Auslage', g: 'Gehalt', s: 'Sparen' });
  it('ordnet jede Buchung genau einmal ein', () => {
    expect(einordnen(b({ betrag: 100, datum: HEUTE, ist_umbuchung: true }), katName)).toBe('umbuchung');
    expect(einordnen(b({ betrag: 500000, datum: HEUTE, kategorie_id: 'k' }), katName)).toBe('geliehen');
    expect(einordnen(b({ betrag: 2500, datum: HEUTE, kategorie_id: 'r' }), katName)).toBe('durchlauf');
    expect(einordnen(b({ betrag: 2500, datum: HEUTE }), katName)).toBe('einnahme-offen');
    expect(einordnen(b({ betrag: -2500, datum: HEUTE, ist_fixkosten: true }), katName)).toBe('ausgabe-fix');
  });
  it('„Luft pro Monat“ zählt einen Kredit nicht als Einkommen', () => {
    const l = [0, 1, 2].flatMap(i => [b({ betrag: 300000, datum: tag(i), kategorie_id: 'g' })]);
    const ohne = luft(l, [], katName, HEUTE).einnahmenSchnitt;
    const mit = luft([...l, b({ betrag: 900000, datum: tag(0), kategorie_id: 'k' })], [], katName, HEUTE).einnahmenSchnitt;
    expect(mit).toBe(ohne);
  });
  it('Ist gegen Soll: „Umsatz“ ohne Kredit und Rückzahlung, „Ausgaben“ ohne Sparen und Tilgung', () => {
    const m = monate12[0];
    const l = [b({ betrag: 300000, datum: tag(0), kategorie_id: 'g' }), b({ betrag: 900000, datum: tag(0), kategorie_id: 'k' }), b({ betrag: -10000, datum: tag(0), kategorie_id: 's' }), b({ betrag: -5000, datum: tag(0) })];
    expect(istWert('Umsatz', l, m, katName)).toBe(300000);
    expect(istWert('Ausgaben', l, m, katName)).toBe(5000);
    expect(istWert('Sparrate', l, m, katName)).toBe(10000);
  });
  it('summen: Umbuchungen zählen nirgends', () => {
    const s = summen([b({ betrag: -50000, datum: HEUTE, ist_umbuchung: true })], katName);
    expect([s.aus, s.ein, s.anzahl]).toEqual([0, 0, 0]);
  });
});

describe('Regeln: rückwirkend und mit Vorrang vor N26', () => {
  const liste = [
    b({ id: 'r1', empfaenger: 'Flink SE', beschreibung: 'Flink SE', betrag: -100, datum: HEUTE }),
    b({ id: 'r2', empfaenger: 'Flink SE', beschreibung: 'Lieferung Flink SE', betrag: -100, datum: HEUTE }),
    b({ id: 'r3', empfaenger: 'REWE Markt', beschreibung: 'REWE Markt', betrag: -100, datum: HEUTE }),
  ];
  it('trifft nur die anderen passenden Buchungen', () => {
    expect(rueckwirkendTreffer('Flink SE', true, liste, 'r1')).toEqual(['r2']);
  });
  it('eigene Regel schlägt die N26-Kategorie (bei Malin war es umgekehrt)', () => {
    const regel = { id: 'x', stand: 1, muster: 'REWE', empfaenger: 'REWE', kategorie_id: 'eigene', ist_umbuchung: false, ist_fixkosten: true, turnus: 'quartal', ganzes_wort: true, prioritaet: 100, treffer_zaehler: 0 } as Regel;
    const r = anwenden({ empfaenger: 'REWE Markt', beschreibung: 'REWE Markt', kategorie_id: 'n26', ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich' as const }, [regel]);
    expect([r.kategorie_id, r.ist_fixkosten, r.turnus]).toEqual(['eigene', true, 'quartal']);
  });
});

describe('Import-Ablauf', () => {
  const stamm = { konten: [{ id: 'konto-1', einheit: 'privat' as const }], kategorien: [{ id: 'k3', name: 'Mobilitaet' }], regeln: [] as Regel[] };
  const text = 'Kaffee Bar 02.09.2026 -3,20€\nKaffee Bar 02.09.2026 -3,20€\nMiete Beispiel 01.09.2026 -900,00€';
  it('leeres oder falsches Konto wird abgefangen', () => {
    for (const k of ['', '   ', 'abc', undefined, null]) {
      const e = importAblauf(ausN26Text(text), k, stamm, new Set(), 'imp', null);
      expect(e.ok).toBe(false);
      if (!e.ok) expect(e.fehler).toBe('Kein Konto gewählt');
    }
  });
  it('zwei gleiche Kaffees am selben Tag bleiben zwei Buchungen — und ein zweiter Import erkennt beide', () => {
    const e = importAblauf(ausN26Text(text), 'konto-1', stamm, new Set(), 'imp', 'kevin');
    expect(e.ok && e.neu.length).toBe(3);
    const hashes = new Set(e.ok ? e.neu.map(x => `konto-1|${x.zeilen_hash}`) : []);
    const zweiter = importAblauf(ausN26Text(text), 'konto-1', stamm, hashes, 'imp2', 'kevin');
    expect(zweiter.ok && [zweiter.neu.length, zweiter.schonVorhanden]).toEqual([0, 3]);
  });
  it('jede Zeile hat dieselben Felder und einen Turnus', () => {
    const v = vorbereiten(ausN26Text(text).buchungen, 'konto-1', [], () => null, 'privat', 'imp', null);
    const soll = Object.keys(v[0]).sort().join(',');
    expect(v.filter(x => Object.keys(x).sort().join(',') !== soll).length).toBe(0);
    expect(v.every(x => x.turnus === 'monatlich' && x.konto_id === 'konto-1')).toBe(true);
  });
  it('Umlaut-Kategorie findet ihr Gegenstück', () => {
    expect(katIdFinder(stamm.kategorien)('Mobilität')).toBe('k3');
  });
  it('PDF-Zeilen aus Koordinaten: gleiche Höhe = eine Zeile, links nach rechts', () => {
    const items = [{ str: '-3,20€', transform: [0, 0, 0, 0, 400, 700] }, { str: 'Kaffee Bar', transform: [0, 0, 0, 0, 50, 700.8] }, { str: '02.09.2026', transform: [0, 0, 0, 0, 250, 699.5] }, { str: 'Kopf', transform: [0, 0, 0, 0, 50, 760] }];
    expect(zeilenAusTextItems(items)).toEqual(['Kopf', 'Kaffee Bar 02.09.2026 -3,20€']);
  });
});

describe('Zeitzone (Malins Monats-Fehler)', () => {
  const alt = process.env.TZ;
  afterEach(() => { process.env.TZ = alt; });
  it('„letzter Monat“ am 24.09. ist der August — in Berlin, UTC und am anderen Ende der Welt', () => {
    for (const tz of ['Europe/Berlin', 'UTC', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      expect(vollMonate(1, 0, HEUTE)).toEqual(['2026-08']);
      expect(vollMonate(3, 0, HEUTE)).toEqual(['2026-08', '2026-07', '2026-06']);
      expect(vollMonate(1, 1, HEUTE)).toEqual(['2026-07']);
    }
  });
  it('„heute“ kommt aus Berlin, auch wenn der Server in UTC läuft', () => {
    process.env.TZ = 'UTC';
    expect(heuteBerlin(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01');
    expect(heuteBerlin(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
  it('Monatsrechnung über den Jahreswechsel', () => {
    expect(monatPlus('2026-01', -1)).toBe('2025-12');
    expect(monatPlus('2025-12', 1)).toBe('2026-01');
    expect(monatPlus('2026-03', -15)).toBe('2024-12');
  });
});

describe('Schulden: Laufzeit', () => {
  it('rechnet mit Zins und meldet ehrlich, wenn die Rate nicht reicht', () => {
    expect(laufzeit(120000, 10000, 0).monate).toBe(12);
    expect(laufzeit(120000, 0, 5).grund).toBe('Keine Rate hinterlegt');
    expect(laufzeit(1200000, 1000, 12).grund).toBe('Die Rate deckt nicht einmal die Zinsen');
  });
});

describe('Wichtig diese Woche', () => {
  it('Überfälliges zuerst, alter Import wird gemeldet', () => {
    const p = wichtig({
      buchungen: [b({ betrag: -100, datum: '2026-07-01' })],
      schulden: [{ bezeichnung: 'Kredit Beispiel', rate: 9000, naechste_faelligkeit: '2026-09-20' } as Schuld],
      belege: [],
    }, () => '', HEUTE);
    expect(p[0].dringend).toBe(true);
    expect(p.map(x => x.art)).toEqual(expect.arrayContaining(['rate', 'import', 'zuordnen']));
  });
});

describe('Sockel: Kreditrate zählt nur einmal (Fund beim Umzug)', () => {
  const katName = kat({ t: 'Tilgung', w: 'Wohnen' });
  const liste: Buchung[] = [];
  for (let i = 0; i < 6; i++) {
    liste.push(b({ empfaenger: 'Vermieter', betrag: -100000, datum: tag(i), ist_fixkosten: true, kategorie_id: 'w' }));
    liste.push(b({ empfaenger: 'Ratenkredit Beispiel', betrag: -15000, datum: tag(i), ist_fixkosten: true, kategorie_id: 't' }));
  }
  it('als Fixkosten markierte Rate + Schuld mit Rate = einmal gezählt', () => {
    const s = sockel(liste, [{ rate: 15000 }] as Schuld[], HEUTE, katName);
    expect(Math.round(s.gesamt)).toBe(115000);
    expect(s.posten.map(p => p.name)).toEqual(['Vermieter']);
  });
  it('ohne erfasste Schuld fehlt die Rate trotzdem nicht', () => {
    expect(Math.round(sockel(liste, [], HEUTE, katName).gesamt)).toBe(115000);
  });
});
