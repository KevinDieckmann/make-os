// LinkedIn-Netzwerk (25.09.): anreichern, vernetzen, anschreiben — je Profil, modular je Kampagne.
import { describe, it, expect } from 'vitest';
import { kontaktVereinen, type Kontakt } from '../lib/make-one/crm';
import { leererBestand } from '../lib/crm/speicher';
import { PLAYBOOKS, planen } from '../lib/crm/kampagnen';
import {
  profilSchluessel, profilAdresse, suchLink, netzStufe, netzRunde, textFuer, vernetzenAmpel, vernetzenStandard, vorlage,
  exportLesen, exportAbgleich, exportAnwenden, exportDatum, netzwerkSaeubern, netzwerkVereinen, vernetzenSaeubern, ANFRAGE_TAGE,
} from '../lib/crm/netzwerk';

const HEUTE = '2026-09-25';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: 'Anna', nachname: `Test${id}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const LI = 'https://www.linkedin.com/in/anna-test';

describe('Profile', () => {
  it('erkennt Personenprofile in jeder Schreibweise — Firmenseiten und Fremdes nicht', () => {
    expect(profilSchluessel('https://de.linkedin.com/in/Tim-Jeske/')).toBe('linkedin.com/in/tim-jeske');
    expect(profilAdresse('linkedin.com/in/tim-jeske?trk=x')).toBe('https://www.linkedin.com/in/tim-jeske');
    expect(profilAdresse('https://www.linkedin.com/company/acme')).toBeNull();
    expect(profilAdresse('https://evil.example/in/x')).toBeNull();
  });
  it('Suchlink mit Name und Firma ohne Rechtsform', () => {
    expect(suchLink({ vorname: 'Florens', nachname: 'Greßner', firma: 'neurocat GmbH' })).toBe(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent('Florens Greßner neurocat')}`);
  });
});

describe('Stufe je Profil', () => {
  it('anreichern → anfragen → warten → zurückziehen', () => {
    expect(netzStufe(k('a'), 'kevin', HEUTE).stufe).toBe('anreichern');
    expect(netzStufe(k('a', { linkedinNichtGefunden: HEUTE }), 'kevin', HEUTE).stufe).toBe('raus');
    expect(netzStufe(k('a', { linkedin: LI }), 'kevin', HEUTE).stufe).toBe('anfragen');
    expect(netzStufe(k('a', { linkedin: LI, netzwerk: { kevin: { status: 'angefragt', angefragtAm: '2026-09-20' } } }), 'kevin', HEUTE).stufe).toBe('warten');
    expect(netzStufe(k('a', { linkedin: LI, netzwerk: { kevin: { status: 'angefragt', angefragtAm: '2026-09-01' } } }), 'kevin', HEUTE)).toMatchObject({ stufe: 'zurueckziehen' });
    expect(ANFRAGE_TAGE).toBe(21);
  });
  it('vernetzt → schreiben → fertig (in der Frist) → nachfassen; Reaktion beendet den Flow', () => {
    const v = (x: object) => k('a', { linkedin: LI, netzwerk: { kevin: { status: 'vernetzt', vernetztAm: '2026-09-10', ...x } } });
    expect(netzStufe(v({}), 'kevin', HEUTE).stufe).toBe('schreiben');
    expect(netzStufe(v({ geschriebenAm: '2026-09-22' }), 'kevin', HEUTE).stufe).toBe('fertig');
    expect(netzStufe(v({ geschriebenAm: '2026-09-15' }), 'kevin', HEUTE).stufe).toBe('nachfassen');
    const mitAntwort = { ...v({ geschriebenAm: '2026-09-15' }), aktivitaeten: [{ am: '2026-09-18T10:00:00Z', art: 'antwort' as const, von: 'kevin' }] };
    expect(netzStufe(mitAntwort, 'kevin', HEUTE)).toMatchObject({ stufe: 'fertig', grund: 'Reaktion nach der Nachricht' });
  });
  it('je Profil getrennt: mit Kevin vernetzt heißt nicht mit Malin', () => {
    const p = k('a', { linkedin: LI, netzwerk: { kevin: { status: 'vernetzt', vernetztAm: '2026-09-10' } } });
    expect(netzStufe(p, 'malin', HEUTE).stufe).toBe('anfragen');
    expect(netzStufe({ ...p, werbesperre: { seit: HEUTE, grund: 'x' } }, 'kevin', HEUTE).stufe).toBe('raus');
  });
});

describe('Runde', () => {
  it('erst schreiben, dann die Tagesportion (abzüglich heute gestellter), dann anreichern — Wichtige zuerst', () => {
    const kontakte = [
      k('a', { linkedin: LI }), k('b', { linkedin: 'linkedin.com/in/b', prio: 'A' }), k('c', { linkedin: 'linkedin.com/in/c' }),
      k('d', { linkedin: 'linkedin.com/in/d', netzwerk: { kevin: { status: 'vernetzt', vernetztAm: '2026-09-20' } } }),
      k('e', { linkedin: 'linkedin.com/in/e', netzwerk: { kevin: { status: 'angefragt', angefragtAm: HEUTE } } }),
      k('f'), k('g', { typ: 'Dienstleister', linkedin: 'linkedin.com/in/g' }),
    ];
    const r = netzRunde(kontakte, 'kevin', HEUTE, { proTag: 3 });
    expect(r.karten.map(x => [x.kontakt.id, x.stufe])).toEqual([['c-d', 'schreiben'], ['c-b', 'anfragen'], ['c-a', 'anfragen'], ['c-f', 'anreichern']]);
    expect(r.zahlen).toMatchObject({ heuteAngefragt: 1, restHeute: 2, warten: 1, schreiben: 1, anreichern: 1, anfragen: 3, vernetzt: 1 });
  });
  it('mit Kampagne nur deren Personen', () => {
    const r = netzRunde([k('a', { linkedin: LI }), k('b', { linkedin: 'linkedin.com/in/b' })], 'kevin', HEUTE, { kampagne: { kontaktIds: ['c-b'], vernetzen: vernetzenStandard() } });
    expect(r.karten.map(x => x.kontakt.id)).toEqual(['c-b']);
  });
});

describe('Texte (modular je Kampagne)', () => {
  it('Sie/Du nach der Anrede, Platzhalter gefüllt, fehlende Firma sinnvoll ersetzt', () => {
    const e = { ...vernetzenStandard('KI im Vertrieb'), vorlage: 'ankuendigung' as const, nachricht: { ...vorlage('ankuendigung').nachricht } };
    expect(textFuer(e.nachricht, { vorname: 'Anna', nachname: 'Muster', firma: 'Acme', anrede: 'Sie' }, e.thema, 'Kevin')).toBe('Hallo Anna Muster, danke fürs Vernetzen! Ich melde mich in den nächsten Tagen kurz bei Ihnen — ich glaube, KI im Vertrieb ist für Acme gerade spannend. Viele Grüße, Kevin');
    expect(textFuer(e.nachricht, { vorname: 'Anna', nachname: 'Muster', anrede: 'Du' }, e.thema, 'Malin')).toContain('bei dir — ich glaube, KI im Vertrieb ist für dein Unternehmen');
  });
  it('Ampel: Erlaubnisfrage grün, Ankündigung gelb, veränderter grüner Text gelb', () => {
    const s = vernetzenStandard();
    expect(vernetzenAmpel(s).ampel).toBe('gruen');
    expect(vernetzenAmpel({ ...s, vorlage: 'ankuendigung', nachricht: vorlage('ankuendigung').nachricht }).ampel).toBe('gelb');
    expect(vernetzenAmpel({ ...s, nachricht: { ...s.nachricht, sie: `${s.nachricht.sie} Wir haben ein Angebot.` } }).ampel).toBe('gelb');
  });
  it('das Playbook „vernetzen“ bringt die grüne Standard-Einstellung mit', () => {
    const pb = PLAYBOOKS.find(p => p.id === 'vernetzen')!;
    const kp = planen(pb, [k('a', { prio: 'A' })], leererBestand(), HEUTE, 'kp-x');
    expect(kp.vernetzen).toMatchObject({ vorlage: 'erlaubnis', proTag: 15, folgeTage: 7 });
    expect(pb.fuer).toEqual(['head-marketing']);
  });
});

const CSV = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Anna,Testa,https://www.linkedin.com/in/anna-test,,Acme GmbH,CEO,25 Sep 2026
Bernd,Beispiel,https://www.linkedin.com/in/bernd-b,bernd@b.de,"Beispiel, Söhne & Co KG",GF,03 Mar 2025
Clara,Neu,https://www.linkedin.com/in/clara,,Irgendwas,CTO,01 Jan 2024
Dora,Doppel,https://www.linkedin.com/in/dora-anders,,Firma X,CEO,01 Jan 2024
`;

describe('LinkedIn-Export', () => {
  it('liest Connections.csv mit Vorspann, Anführungszeichen und englischem Datum', () => {
    const z = exportLesen(CSV);
    expect(z).toHaveLength(4);
    expect(z[1]).toMatchObject({ vorname: 'Bernd', firma: 'Beispiel, Söhne & Co KG', email: 'bernd@b.de', vernetztAm: '2025-03-03', url: 'https://www.linkedin.com/in/bernd-b' });
    expect(exportDatum('25. Sep. 2026')).toBe('2026-09-25');
    expect(exportLesen('irgendwas,anderes\n1,2')).toEqual([]);
  });
  it('gleicht über Profil, Name + Firma und eindeutigen Namen ab — nie gegen ein anderes Profil, nie Fremde', () => {
    const kontakte = [
      k('a', { vorname: 'Anna', nachname: 'Testa', linkedin: 'linkedin.com/in/anna-test' }),
      k('b', { vorname: 'Bernd', nachname: 'Beispiel', firma: 'Beispiel Söhne' }),
      k('d', { vorname: 'Dora', nachname: 'Doppel', linkedin: 'https://www.linkedin.com/in/dora-original' }),
    ];
    const p = exportAbgleich(kontakte, exportLesen(CSV), 'kevin');
    expect(p.treffer.map(t => [t.kontaktId, t.wie, t.neuesProfil])).toEqual([['c-a', 'profil', false], ['c-b', 'name_firma', true]]);
    expect(p.ohneTreffer).toBe(2);
  });
  it('anwenden: Profil ergänzen, eine laufende Anfrage gilt als angenommen, Geschriebenes bleibt', () => {
    const kontakte = [k('b', { vorname: 'Bernd', nachname: 'Beispiel', netzwerk: { kevin: { status: 'angefragt', angefragtAm: '2026-09-01', kampagneId: 'kp-x' } } })];
    const t = exportAbgleich(kontakte, exportLesen(CSV), 'kevin').treffer[0];
    const n = exportAnwenden(kontakte[0], t, 'kevin', HEUTE);
    expect(n.linkedin).toBe('https://www.linkedin.com/in/bernd-b');
    expect(n.netzwerk?.kevin).toMatchObject({ status: 'vernetzt', vernetztAm: '2025-03-03', kampagneId: 'kp-x', quelle: 'export' });
    const schon = { ...kontakte[0], netzwerk: { kevin: { status: 'vernetzt' as const, vernetztAm: '2026-09-02', geschriebenAm: '2026-09-03' } } };
    expect(exportAnwenden(schon, t, 'kevin', HEUTE).netzwerk?.kevin?.geschriebenAm).toBe('2026-09-03');
  });
});

describe('Speichern', () => {
  it('säubert Stand und Einstellung', () => {
    expect(netzwerkSaeubern({ kevin: { status: 'vernetzt', vernetztAm: '2026-09-10T08:00:00Z', kampagneId: 'kp-a' }, 'b ö': { status: 'vernetzt' }, malin: { status: 'quatsch' } })).toEqual({ kevin: { status: 'vernetzt', vernetztAm: '2026-09-10', kampagneId: 'kp-a' } });
    expect(vernetzenSaeubern({ vorlage: 'x', proTag: 500, folgeTage: 0, nachricht: { sie: 'a' } })).toMatchObject({ vorlage: 'erlaubnis', proTag: 40, folgeTage: 1, nachricht: { sie: 'a', du: '' } });
  });
  it('ein älterer Stand wischt „vernetzt“ und „geschrieben“ nie weg (Kevin und Malin gleichzeitig)', () => {
    const alt = { kevin: { status: 'vernetzt' as const, vernetztAm: '2026-09-20', geschriebenAm: '2026-09-22' } };
    const neu = { kevin: { status: 'angefragt' as const, angefragtAm: '2026-09-18' }, malin: { status: 'angefragt' as const, angefragtAm: '2026-09-24' } };
    expect(netzwerkVereinen(neu, alt)).toEqual({ kevin: alt.kevin, malin: neu.malin });
    const server = k('a', { netzwerk: alt });
    const oberflaeche = k('a', { netzwerk: { kevin: { status: 'angefragt', angefragtAm: '2026-09-18' } }, notiz: 'neu' });
    expect(kontaktVereinen(oberflaeche, server).netzwerk?.kevin?.status).toBe('vernetzt');
  });
});

import { faelligeModi } from '../lib/heads/takt';
import { leererStand } from '../lib/heads/stand';
import { grundlauf } from '../lib/heads/grundlauf';
import { belege } from '../lib/heads/belege';

describe('Head of Marketing — Netzwerk ausbauen', () => {
  it('werktags ab 8 Uhr einmal am Tag, am Wochenende nicht', () => {
    expect(faelligeModi('marketing', new Date('2026-09-29T09:00:00'), leererStand(), []).map(m => m.modus)).toContain('netzwerk');
    expect(faelligeModi('marketing', new Date('2026-09-27T09:00:00'), leererStand(), []).map(m => m.modus)).not.toContain('netzwerk');
    expect(faelligeModi('marketing', new Date('2026-09-29T09:00:00'), { ...leererStand(), letzte: { netzwerk: '2026-09-29T07:30:00' } }, []).map(m => m.modus)).not.toContain('netzwerk');
  });
  it('plant je Profil: Annahmen schreiben, Tagesportion, anreichern — mit Beleg und für die Person des Profils', () => {
    const z = (x: object) => ({ schreiben: 0, nachfassen: 0, anfragen: 0, restHeute: 0, anreichern: 0, zurueckziehen: 0, warten: 0, vernetzt: 0, heuteAngefragt: 0, ...x });
    const daten = { meta: { heute: HEUTE }, netzwerk: [
      { profil: 'kevin', name: 'Kevin', kampagne: null, zahlen: z({ schreiben: 2, anfragen: 40, restHeute: 15, anreichern: 300, vernetzt: 12 }), als_naechstes: [{ id: 'c-a', name: 'Anna Test', stufe: 'schreiben' }] },
      { profil: 'malin', name: 'Malin', kampagne: null, zahlen: z({ anfragen: 5, restHeute: 15 }), als_naechstes: [] },
    ] };
    const g = grundlauf('marketing', 'netzwerk', daten).antwort;
    expect(g.vorschlaege.map(v => [v.titel, v.fuer])).toEqual([
      ['LinkedIn: 2 Annahmen — Nachricht schreiben (Kevin)', 'kevin'], ['Vernetzen heute: 15 Anfragen (Kevin)', 'kevin'], ['Profile anreichern: 300 ohne LinkedIn (Kevin)', 'kevin'], ['Vernetzen heute: 5 Anfragen (Malin)', 'malin'],
    ]);
    expect(g.vorschlaege.every(v => v.art === 'vernetzen_runde' && belege(daten, v.quelle).insLeere.length === 0)).toBe(true);
    expect(g.vorschlaege[0].begruendung).toContain('Anna Test');
  });
});
