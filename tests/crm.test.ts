// ─── CRM: die Regeln der Kundenansprache ────────────────────────────────────
// Jeder Test hier schützt eine Regel, deren Bruch echte Arbeit kosten würde:
// ein Import, der Dubletten anlegt; ein Abgleich, der die Pipeline löscht;
// eine Tagesliste, die Versprechen an Kontakte vergisst.

import { describe, it, expect } from 'vitest';
import {
  schluessel, ausZeile, importieren, zusammenfuehren, tagesliste, ansprechbar,
  kanaele, stufeNach, wiedervorlageNach, massenStufe, MASSEN_GRENZE, pipelineStand, anzeigename,
  type Kontakt,
} from '../lib/make-one/crm';
import { csvLesen, trennerVon } from '../lib/make-one/csv';
import { tagePlus } from '../lib/zeit';

const HEUTE = '2026-09-18';

const zeile = (extra: Record<string, string> = {}): Record<string, string> => ({
  VORNAME: 'Testa', NACHNAME: 'Beispielmann', FIRMA: 'TESTFIRMA-XYZ GmbH', EMAIL: 'testa@testfirma-xyz.example',
  PRIORITAET: 'A', VERTRIEBS_EIGNUNG: 'ja', KONTAKT_TYP: 'Lead', LINKEDIN: 'https://linkedin.example/testa',
  GESPRAECHSAUFHAENGER: 'TESTAUFHÄNGER — nur für den Test', ...extra,
});

describe('Schlüssel', () => {
  it('erkennt denselben Menschen an der Mail, egal wie sie geschrieben ist', () => {
    expect(schluessel({ email: 'A.B@Firma.DE' })).toBe(schluessel({ email: 'a.b@firma.de ' }));
  });

  it('fällt ohne Mail auf Name und Firma zurück — nicht auf nichts', () => {
    const k = schluessel({ vorname: 'Testa', nachname: 'Beispielmann', firma: 'TESTFIRMA-XYZ' });
    expect(k.startsWith('n:')).toBe(true);
    expect(k).not.toBe(schluessel({ vorname: 'Testa', nachname: 'Beispielmann', firma: 'ANDERE-TESTFIRMA' }));
  });

  it('zieht die HubSpot-ID vor Name+Firma, wenn keine Mail da ist', () => {
    expect(schluessel({ hubspotId: '123', vorname: 'X', nachname: 'Y' }).startsWith('h:')).toBe(true);
  });
});

describe('Import', () => {
  it('legt beim zweiten Lauf keine Dubletten an', () => {
    const erst = importieren([], [zeile(), zeile({ VORNAME: 'Testo', EMAIL: 'testo@testfirma-xyz.example' })], HEUTE);
    expect(erst.neu).toBe(2);
    const zweit = importieren(erst.kontakte, [zeile(), zeile({ VORNAME: 'Testo', EMAIL: 'testo@testfirma-xyz.example' })], HEUTE);
    expect(zweit.neu).toBe(0);
    expect(zweit.unveraendert).toBe(2);
    expect(zweit.kontakte).toHaveLength(2);
  });

  it('rührt die Pipeline beim Abgleich nicht an — das ist die Arbeit im CRM', () => {
    const { kontakte } = importieren([], [zeile()], HEUTE);
    const k: Kontakt = { ...kontakte[0], stufe: 'gespraech', wiedervorlage: '2026-09-25', aktivitaeten: [{ am: HEUTE, art: 'mail', von: 'kevin' }] };
    const r = importieren([k], [zeile({ FIRMA_STADT: 'Berlin' })], HEUTE);
    expect(r.aktualisiert).toBe(1);
    expect(r.kontakte[0].stufe).toBe('gespraech');
    expect(r.kontakte[0].wiedervorlage).toBe('2026-09-25');
    expect(r.kontakte[0].aktivitaeten).toHaveLength(1);
    expect(r.kontakte[0].firmaStadt).toBe('Berlin');
  });

  it('löscht keine gefüllte Notiz, nur weil die Excel-Zeile leer ist', () => {
    const alt = ausZeile(zeile({ KEVIN_NOTIZ: 'wichtig' }), HEUTE);
    const neu = ausZeile(zeile({ KEVIN_NOTIZ: '' }), HEUTE);
    expect(zusammenfuehren(alt, neu, HEUTE).kontakt.notiz).toBe('wichtig');
  });

  it('gibt jedem Kontakt eine stabile ID', () => {
    expect(ausZeile(zeile(), HEUTE).id).toBe(ausZeile(zeile(), '2027-01-01').id);
  });

  it('leitet die Stufe aus dem Wenigen ab, das die Liste weiß', () => {
    expect(ausZeile(zeile({ LEAD_STATUS: 'OPEN_DEAL' }), HEUTE).stufe).toBe('angebot');
    expect(ausZeile(zeile({ LIFECYCLE: 'opportunity' }), HEUTE).stufe).toBe('gespraech');
    expect(ausZeile(zeile(), HEUTE).stufe).toBe('neu');
  });
});

describe('Tagesliste', () => {
  const basis = () => importieren([], [
    zeile({ VORNAME: 'Anna', EMAIL: 'anna@testfirma-xyz.example', PRIORITAET: 'A', VERTRIEBS_EIGNUNG: 'vielleicht' }),
    zeile({ VORNAME: 'Bernd', EMAIL: 'bernd@testfirma-xyz.example', PRIORITAET: 'B', VERTRIEBS_EIGNUNG: 'ja' }),
    zeile({ VORNAME: 'Clara', EMAIL: 'clara@testfirma-xyz.example', PRIORITAET: 'A', VERTRIEBS_EIGNUNG: 'ja' }),
    zeile({ VORNAME: 'Dirk', EMAIL: 'dirk@testfirma-xyz.example', PRIORITAET: 'C' }),
    zeile({ VORNAME: 'Emil', EMAIL: 'emil@testfirma-xyz.example', PRIORITAET: 'A', GESPRAECHSAUFHAENGER: '' }),
    zeile({ VORNAME: 'Fred', EMAIL: 'fred@testfirma-xyz.example', PRIORITAET: 'A', KONTAKT_TYP: 'Dienstleister' }),
  ], HEUTE).kontakte;

  it('stellt fällige Wiedervorlagen vor alles andere — ein Versprechen geht vor', () => {
    const k = basis();
    const bernd = k.find(x => x.vorname === 'Bernd')!;
    bernd.stufe = 'angesprochen'; bernd.wiedervorlage = '2026-09-10';
    const l = tagesliste(k, HEUTE);
    expect(l[0].kontakt.vorname).toBe('Bernd');
    expect(l[0].grund).toContain('überfällig');
  });

  it('sortiert Prio A vor B und Eignung ja vor vielleicht', () => {
    const namen = tagesliste(basis(), HEUTE).map(p => p.kontakt.vorname);
    expect(namen.slice(0, 3)).toEqual(['Clara', 'Anna', 'Bernd']);
  });

  it('lässt weg, wen man nicht ansprechen kann oder soll', () => {
    const namen = tagesliste(basis(), HEUTE).map(p => p.kontakt.vorname);
    expect(namen).not.toContain('Dirk');   // Prio C
    expect(namen).not.toContain('Emil');   // kein Aufhänger
    expect(namen).not.toContain('Fred');   // Dienstleister
  });

  it('nimmt Abgeschlossene nicht mehr auf', () => {
    const k = basis();
    k.find(x => x.vorname === 'Clara')!.stufe = 'verloren';
    expect(tagesliste(k, HEUTE).map(p => p.kontakt.vorname)).not.toContain('Clara');
  });

  it('hält die Grenze ein', () => {
    expect(tagesliste(basis(), HEUTE, 2)).toHaveLength(2);
  });
});

describe('Ansprechbar', () => {
  it('braucht einen Weg UND einen Grund', () => {
    const ohneWeg = ausZeile(zeile({ EMAIL: '', LINKEDIN: '', TELEFON: '', SMS: '' }), HEUTE);
    const ohneGrund = ausZeile(zeile({ GESPRAECHSAUFHAENGER: '' }), HEUTE);
    expect(ansprechbar(ohneWeg)).toBe(false);
    expect(ansprechbar(ohneGrund)).toBe(false);
    expect(ansprechbar(ausZeile(zeile(), HEUTE))).toBe(true);
  });

  it('empfiehlt bei kaltem Kontakt LinkedIn vor Mail (§7 UWG), bei warmem Mail zuerst', () => {
    const kalt = ausZeile(zeile(), HEUTE);
    expect(kanaele(kalt)[0].art).toBe('linkedin');
    const warm = { ...kalt, stufe: 'gespraech' as const };
    expect(kanaele(warm)[0].art).toBe('mail');
  });
});

describe('Nach einer Aktivität', () => {
  it('geht die Stufe nur vorwärts, nie zurück', () => {
    expect(stufeNach('mail', 'neu')).toBe('angesprochen');
    expect(stufeNach('mail', 'gespraech')).toBe('gespraech');
    expect(stufeNach('antwort', 'angesprochen')).toBe('gespraech');
    expect(stufeNach('mail', 'verloren')).toBe('verloren');
  });

  it('legt nach einer Ansprache fünf Tage Wiedervorlage an, nach einem Termin keine', () => {
    expect(wiedervorlageNach('linkedin', HEUTE, tagePlus)).toBe('2026-09-23');
    expect(wiedervorlageNach('termin', HEUTE, tagePlus)).toBeUndefined();
  });
});

describe('Massen-Wache', () => {
  it('zählt Stufenwechsel, nicht Längen — die Lehre vom 06.09.', () => {
    const alt = importieren([], Array.from({ length: 20 }, (_, i) => zeile({ VORNAME: `T${i}`, EMAIL: `t${i}@testfirma-xyz.example` })), HEUTE).kontakte;
    const neu = alt.map(k => ({ ...k, stufe: 'verloren' as const }));
    expect(massenStufe(alt, neu)).toBe(20);
    expect(massenStufe(alt, neu)).toBeGreaterThan(MASSEN_GRENZE);
    expect(massenStufe(alt, alt)).toBe(0);
  });
});

describe('Stand', () => {
  it('zählt je Stufe und die Ansprechbaren', () => {
    const k = importieren([], [zeile(), zeile({ VORNAME: 'X', EMAIL: 'x@testfirma-xyz.example', LEAD_STATUS: 'OPEN_DEAL' })], HEUTE).kontakte;
    const st = pipelineStand(k);
    expect(st.gesamt).toBe(2); expect(st.neu).toBe(1); expect(st.angebot).toBe(1); expect(st.ansprechbar).toBe(2);
  });

  it('lässt keinen Namen leer', () => {
    expect(anzeigename({ vorname: '', nachname: '', firma: 'TESTFIRMA-XYZ' })).toBe('TESTFIRMA-XYZ');
    expect(anzeigename({ vorname: '', nachname: '' })).toBe('Unbekannt');
  });
});

describe('CSV', () => {
  it('zerreißt kein Feld mit Semikolon oder Zeilenumbruch in Anführungszeichen', () => {
    const t = 'A;B;C\n1;"x; y\nz";3\n"sagt ""hallo""";2;3\n';
    const r = csvLesen(t, ';');
    expect(r).toHaveLength(2);
    expect(r[0].B).toBe('x; y\nz');
    expect(r[1].A).toBe('sagt "hallo"');
  });

  it('nimmt das Excel-BOM weg, sonst heißt die erste Spalte falsch', () => {
    expect(Object.keys(csvLesen('﻿NAME;X\na;b\n')[0])[0]).toBe('NAME');
  });

  it('errät das Trennzeichen aus der Kopfzeile', () => {
    expect(trennerVon('A;B;C\n')).toBe(';');
    expect(trennerVon('A,B,C\n')).toBe(',');
  });
});
