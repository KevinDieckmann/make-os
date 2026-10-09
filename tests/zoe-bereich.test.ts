// ─── ZOE: Bereich erkennen — die reine Regel (09.10. spät, lib/zoe/bereich.ts) ─────────────────────────────────────────
// Befund live: unter „Privat“ stand „Fakt merken — … gibt es nicht mehr“ über eine Firma aus dem Business. Die EINE Regel ordnet jeden
// Vorschlag zu: (a) Bezug → (b) bekannte Namen im Inhalt → (c) Gespräch → (d) unklar. Erfundene Namen, keine echten Daten.
import { describe, it, expect } from 'vitest';
import {
  bereichFuerVorschlag, bereichVonVorschlag, passtZurSicht, faktPasstZuBereich, eingabeBereich, namensSchluessel, genannteNamen, textSchluessel,
  vorschlagTexte, bereichAus, bereichGrund, type BekannterName,
} from '@/lib/zoe/bereich';
import { zoeWerkzeugWahl, ZOE_KERN, ZOE_BEREICHE } from '@/lib/zoe/werkzeug-wahl';
import { stapelOrtSatz, crmWegSatz } from '@/lib/zoe/ausfuehren';
import { vorschlagPrivat } from '@/lib/zoe/stapel';
import { MERKEN_WOHIN } from '@/lib/zoe/grundauftrag';

const firma = (id: string, name: string, bereich: 'privat' | 'business' = 'business'): BekannterName => ({ art: 'firma', id, schluessel: namensSchluessel(name, 'firma'), bereich });
const kontakt = (id: string, name: string, bereich: 'privat' | 'business' = 'business'): BekannterName => ({ art: 'kontakt', id, schluessel: namensSchluessel(name, 'kontakt'), bereich });
const NAMEN: BekannterName[] = [
  firma('f-pelikan', 'Pelikanwerk GmbH'), firma('f-garten', 'Gartenhof Selbst', 'privat'), kontakt('c-zora', 'Dr. Zora Probestein'),
  { art: 'gesellschaft', id: 'g-holz', schluessel: namensSchluessel('Holzbrücke Beteiligungen UG (haftungsbeschränkt)', 'gesellschaft'), bereich: 'business', ort: { id: 'g-holz', name: 'Holzbrücke Beteiligungen' } },
];
const fakt = (satz: string, thema = 'Notiz') => ({ werkzeug: 'fakt_merken', gruppe: 'gedaechtnis', titel: 'Fakt merken', nachher: `${thema}: ${satz}`, eingabe: { thema, satz } });

describe('Regel (a): fachlicher Bezug', () => {
  it('der aufgelöste Bezug gewinnt vor allem anderen (auch vor Namen und Gespräch)', () => {
    const r = bereichFuerVorschlag(fakt('Pelikanwerk gibt es nicht mehr'), { bezug: { bereich: 'privat', ort: { id: 'kdc', name: 'Selbstständigkeit' } }, namen: NAMEN, gespraech: 'business' });
    expect(r).toMatchObject({ bereich: 'privat', quelle: 'bezug', ort: { id: 'kdc' } });
    expect(r.nennt).toEqual([{ art: 'firma', id: 'f-pelikan' }]); // der Weg in die Markttraktion bleibt sichtbar
  });
  it('CRM-Bezug und Business-Gruppen → Business, Gesundheit/Haushalt/Familie → Privat', () => {
    expect(bereichFuerVorschlag({ gruppe: 'crm', bezug: { art: 'crm' } }, { gespraech: 'privat' }).bereich).toBe('business');
    for (const g of ['markttraktion', 'kontakte', 'kunden', 'business', 'bauplan']) expect(bereichFuerVorschlag({ gruppe: g }, { gespraech: 'privat' }).bereich, g).toBe('business');
    for (const g of ['gesundheit', 'haushalt', 'familie']) expect(bereichFuerVorschlag({ gruppe: g }, { gespraech: 'business', namen: NAMEN }).bereich, g).toBe('privat');
  });
  it('ausdrückliche Angabe der Eingabe: space/bereich, spaceId/einheit über den Bereich der Einheit, Mandant → Business', () => {
    expect(bereichFuerVorschlag({ gruppe: 'aufgaben', eingabe: { title: 'Pelikanwerk anrufen', space: 'privat' } }, { namen: NAMEN }).bereich).toBe('privat');
    expect(bereichFuerVorschlag({ gruppe: 'aufgaben', eingabe: { spaceId: 'kdv' } }, { gespraech: 'privat' })).toMatchObject({ bereich: 'business', quelle: 'bezug', ort: { id: 'kdv' } });
    expect(bereichFuerVorschlag({ gruppe: 'aufgaben', eingabe: { spaceId: 'kdc' } }, { gespraech: 'business' }).bereich).toBe('privat'); // Selbstständigkeit = Privat
    expect(eingabeBereich({ einheit: 'Selbstständigkeit' })?.bereich).toBe('privat');
    expect(eingabeBereich({ spaceId: 'm-f-pelikan' })?.bereich).toBe('business');
    expect(eingabeBereich({ firma: 'irgendwas Unbekanntes' })).toBeNull();
    expect(eingabeBereich({})).toBeNull();
  });
  it('der Bereich eines Heads zählt wie ein Bezug — nach der ausdrücklichen Angabe', () => {
    expect(bereichFuerVorschlag({ gruppe: 'aufgaben', eingabe: {} }, { head: 'business', gespraech: 'privat' })).toMatchObject({ bereich: 'business', quelle: 'bezug' });
    expect(bereichFuerVorschlag({ gruppe: 'aufgaben', eingabe: { space: 'privat' } }, { head: 'business' }).bereich).toBe('privat');
  });
});

describe('Regel (b): der Inhalt nennt bekannte Namen aus dem Bestand', () => {
  it('Befund: im Gespräch „Privat“ nennt der Fakt eine Business-Firma → Business (b schlägt c), mit Kennung für den CRM-Weg', () => {
    const r = bereichFuerVorschlag({ ...fakt('nein pelikanwerk gibts nicht mehr', 'Pelikanwerk'), anlass: 'nein pelikanwerk gibts nicht mehr' }, { namen: NAMEN, gespraech: 'privat' });
    expect(r).toMatchObject({ bereich: 'business', quelle: 'inhalt', nennt: [{ art: 'firma', id: 'f-pelikan' }] });
  });
  it('Rechtsform zählt nicht, Groß/klein und Umlaute egal, Genitiv-s trifft; Teilwörter treffen nicht', () => {
    const t = (s: string) => genannteNamen(textSchluessel([s]), NAMEN).map(n => n.id);
    expect(t('Das PELIKANWERK zieht um')).toEqual(['f-pelikan']);
    expect(t('Pelikanwerks Büro ist zu')).toEqual(['f-pelikan']);
    expect(t('die Pelikanwerkstatt')).toEqual([]);
    expect(t('Holzbruecke Beteiligungen hat einen neuen Sitz')).toEqual(['g-holz']);
  });
  it('Kontakte nur mit vollem Namen (Titel zählt nicht) — ein Vorname allein trifft nie', () => {
    expect(namensSchluessel('Zora', 'kontakt')).toBe('');
    expect(genannteNamen(textSchluessel(['Zora hat angerufen']), NAMEN)).toEqual([]);
    expect(genannteNamen(textSchluessel(['Zora Probestein hat gewechselt']), NAMEN).map(n => n.id)).toEqual(['c-zora']);
  });
  it('zu kurze Namen werden nie verglichen', () => {
    expect(namensSchluessel('ABC GmbH', 'firma')).toBe('');
    expect(namensSchluessel('Pelikanwerk GmbH & Co. KG', 'firma')).toBe('pelikanwerk');
  });
  it('widersprechen sich die Treffer, entscheidet das Gespräch (c); ohne Gespräch unklar', () => {
    const beide = fakt('Pelikanwerk und Gartenhof Selbst teilen sich ein Büro');
    expect(bereichFuerVorschlag(beide, { namen: NAMEN, gespraech: 'privat' })).toMatchObject({ bereich: 'privat', quelle: 'gespraech' });
    expect(bereichFuerVorschlag(beide, { namen: NAMEN }).bereich).toBe('unklar');
  });
  it('eine Firma einer Privat-Einheit macht den Vorschlag privat; Ort nur, wenn eindeutig', () => {
    expect(bereichFuerVorschlag(fakt('Gartenhof Selbst zahlt jetzt per Lastschrift'), { namen: NAMEN, gespraech: 'business' })).toMatchObject({ bereich: 'privat', quelle: 'inhalt' });
    expect(bereichFuerVorschlag(fakt('Holzbrücke Beteiligungen zieht um'), { namen: NAMEN })).toMatchObject({ bereich: 'business', ort: { id: 'g-holz' } });
  });
  it('vorschlagTexte: Titel, Vorher/Nachher, Anlass und Text-Werte der Eingabe — nie `_`-Felder', () => {
    const t = vorschlagTexte({ titel: 'T', nachher: 'N', anlass: 'A', eingabe: { satz: 'S', liste: ['L1', 2], _stand: 'geheim', zahl: 4 } });
    expect(t).toEqual(['T', '', 'N', 'A', 'S', 'L1']);
  });
});

describe('Regel (c) und (d)', () => {
  it('ohne Bezug und ohne Namen: der Bereich des Gesprächs', () => {
    expect(bereichFuerVorschlag(fakt('keine Termine vor 10'), { namen: NAMEN, gespraech: 'privat' })).toMatchObject({ bereich: 'privat', quelle: 'gespraech' });
    expect(bereichFuerVorschlag(fakt('keine Termine vor 10'), { namen: NAMEN, gespraech: 'business' }).bereich).toBe('business');
  });
  it('sonst unklar — und ein Altbestand ohne Feld liest sich ebenso', () => {
    expect(bereichFuerVorschlag(fakt('keine Termine vor 10'), { namen: NAMEN })).toEqual({ bereich: 'unklar' });
    expect(bereichFuerVorschlag(fakt('x'))).toEqual({ bereich: 'unklar' });
    expect(bereichVonVorschlag({})).toBe('unklar');
    expect(bereichVonVorschlag({ bereich: 'irgendwas' })).toBe('unklar');
    expect(bereichVonVorschlag({ bereich: 'business' })).toBe('business');
  });
  it('bereichAus prüft nur die Form', () => {
    expect(bereichAus('privat')).toBe('privat');
    expect(bereichAus('alles')).toBeNull();
    expect(bereichAus({ bereich: 'privat' })).toBeNull();
  });
});

describe('Sichten', () => {
  it('passtZurSicht: unter Privat nur Privat, unter Business nur Business, „unklar“ nur unter Alles', () => {
    const p = { bereich: 'privat' }, b = { bereich: 'business' }, u = {};
    expect([p, b, u].filter(v => passtZurSicht(v, 'privat'))).toEqual([p]);
    expect([p, b, u].filter(v => passtZurSicht(v, 'business'))).toEqual([b]);
    expect([p, b, u].filter(v => passtZurSicht(v, null))).toEqual([p, b, u]);
  });
  it('Merksätze: im Gespräch eines Bereichs nur dessen und die neutralen; ohne Bereich alle', () => {
    const p = { bereich: 'privat' }, b = { bereich: 'business' }, n = {};
    expect([p, b, n].filter(f => faktPasstZuBereich(f, 'privat'))).toEqual([p, n]);
    expect([p, b, n].filter(f => faktPasstZuBereich(f, 'business'))).toEqual([b, n]);
    expect([p, b, n].filter(f => faktPasstZuBereich(f, null))).toEqual([p, b, n]);
  });
  it('vorschlagPrivat (Konto „nur Business“): Bereich Privat verschärft, Business allein öffnet nichts', () => {
    expect(vorschlagPrivat({ gruppe: 'markttraktion', bereich: 'privat' })).toBe(true);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: {}, bereich: 'business' })).toBe(true); // im Zweifel weiter privat
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: { space: 'business' }, bereich: 'business' })).toBe(false);
    expect(vorschlagPrivat({ gruppe: 'familie' })).toBe(true);
  });
  it('bereichGrund nennt die Quelle, nie einen Namen', () => {
    expect(bereichGrund({})).toMatch(/bitte wählen/);
    expect(bereichGrund({ bereich: 'business', bereichQuelle: 'inhalt', bereichNennt: [{ art: 'firma', id: 'f-x' }] })).toMatch(/nennt eine Firma/);
    expect(bereichGrund({ bereich: 'privat', bereichQuelle: 'hand' })).toMatch(/von Hand/);
  });
});

describe('ZOE: Werkzeug-Wahl und Hinweise', () => {
  const alle = new Set([...ZOE_KERN, ...ZOE_BEREICHE.flatMap(b => b.werkzeuge)]);
  it('nennt die Frage einen Eintrag der Markttraktion, ist crm_vorschlag dabei — sonst nicht', () => {
    const ohne = zoeWerkzeugWahl({ text: 'nein, die gibts nicht mehr', verfuegbar: alle });
    expect(ohne.namen).not.toContain('crm_vorschlag');
    const mit = zoeWerkzeugWahl({ text: 'nein, die gibts nicht mehr', verfuegbar: alle, crmGenannt: true });
    expect(mit.namen).toContain('crm_vorschlag');
    expect(mit.namen).toContain('fakt_merken');
    expect(mit.namen.length).toBeLessThanOrEqual(20);
    // Auch neben anderen Bereichen kommt crm_vorschlag zuerst in den Vertrieb.
    const voll = zoeWerkzeugWahl({ text: 'Rechnung, Kontostand, Termin, Aufgabe, Ziel, Notiz, Mail — und die Firma gibts nicht mehr', verfuegbar: alle, crmGenannt: true });
    expect(voll.namen).toContain('crm_vorschlag');
  });
  it('stapelOrtSatz: nur, wenn der Vorschlag nicht im Bereich des Gesprächs liegt', () => {
    expect(stapelOrtSatz('business', 'privat')).toMatch(/unter „Business“ \(nicht unter „Privat“\)/);
    expect(stapelOrtSatz('privat', 'privat')).toBe('');
    expect(stapelOrtSatz(null, 'privat')).toMatch(/„Alles“/);
    expect(stapelOrtSatz(null, null)).toBe('');
  });
  it('crmWegSatz: nur Kennungen, kein Name; schlägt crm_vorschlag vor, nie automatisch', () => {
    const t = crmWegSatz([{ art: 'firma', id: 'f-pelikan' }]);
    expect(t).toMatch(/crm_vorschlag/);
    expect(t).toContain('f-pelikan');
    expect(t).not.toMatch(/Pelikanwerk/i);
    expect(t).toMatch(/ohne Klick/);
  });
  it('die Regel im Prompt ist neutral (keine Namen, keine Firmen)', () => {
    expect(MERKEN_WOHIN).toMatch(/crm_vorschlag/);
    expect(MERKEN_WOHIN).not.toMatch(/\b(Kevin|Malin)\b|GmbH|UG\b/);
  });
});
