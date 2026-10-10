// ─── Wächter: Head of Recht (10.10.) ────────────────────────────────────────────────────────────────────────────────────────────────────
// Entscheidungen 10.10.: Business-Head „Head of Recht“ (Katalog-Kennung `recht`) mit Mitarbeiter-Vorlagen, Chat auf Unternehmen und Datenschutz (Business),
// wöchentlicher Recht-Check (Regelwerk ohne Modell), Risikorunde vorbereiten, neuer Vertrag → Checkliste mit Fundstellen (keine Bewertung), Anwalts-Mappe
// auf Knopfdruck. Geprüft wird:
//   (a) rein: Wochen-Check (Fristen 4 Wochen, Ampel, was fehlt, Vorschläge, Eskalation, Hinweis), Checkliste (Fundstellen, Stichtage, keine Wertung),
//       Risikorunde (Katalog-Kandidaten aus Ereignissen, Prüffrage statt Bewertung), „Als Nächstes“;
//   (b) Katalog, Verträge der Werkzeuge (lesen/vorschlag, Business), Sicht Privat bekommt den Head nicht;
//   (c) Server: fremder Haushalt/Testkunde/„nur Business“ bekommen nichts; kein Schreibweg ohne Freigabe (Stapel, dann Klick); Vertragseingang;
//       Anwalts-Mappe (nur per Sitzung, PDF in der Ablage, verschickt nichts); Werkzeuge des Heads; Kontext.
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten; kein Modellaufruf.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { RegisterDatei } from '@/lib/gesellschaften/modell';
import type { SchildDatei } from '@/lib/gesellschaften/schild/typen';

const { ordner, gemeldet } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-head-recht-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-head-recht';
  process.env.MAKE_OS_DOKU_WURZEL = 'aus';
  process.env.MAKE_OS_BRAIN_INDEX = 'aus';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return { ordner: o, gemeldet: [] as { an: string; art: string; titel: string; bezug?: { art: string; id: string } }[] };
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string; bezug?: { art: string; id: string } }) => { gemeldet.push(m); } }));
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

import { kwVon, wochenCheck, wocheFaellig, neueVorschlaege, checkText } from '@/lib/recht/check';
import { vertragCheckliste, checklisteText, tageIn, kuendigungsfristAus } from '@/lib/recht/vertrag-checkliste';
import { rundeVorbereiten, rundeBrauchtVorbereitung, neueRisikenVon } from '@/lib/recht/risikorunde';
import { themaAus, fragenPruefen } from '@/lib/recht/mappe';
import { CHECKLISTE_HINWEIS, RECHT_MODI, type DatenschutzZahlen } from '@/lib/recht/typen';
import { lageAus } from '@/lib/gesellschaften/schild/ampel';
import { tagePlus } from '@/lib/gesellschaften/schild/zeit';
import { KATALOG, headDef, headVonVorschlag, vorlagenFuer } from '@/lib/agenten/katalog';
import { eingebauteSkills } from '@/lib/agenten/skills';
import { kontextHeadFuer } from '@/lib/agenten/kontext-head';
import { headImBereich } from '@/lib/agenten/sicht';
import { rechtCheckZeiten } from '@/lib/agenten/naechstes';
import { HEAD_TEXTE, MITARBEITER_BEISPIELE } from '@/lib/erklaerungen/agenten';

const HEUTE = '2026-10-12'; // Montag
const G1 = 'g-11111111-1111-4111-8111-111111111111';
const REGISTER: RegisterDatei = { gesellschaften: [
  { id: 'kdc', rechtsform: 'einzel', status: 'eingetragen' },
  { id: 'kdv', rechtsform: 'ug', status: 'eingetragen', rolle: 'holding', gegruendetAm: '2021-06-15', stammkapitalCent: 500_000, firmierung: 'Beispiel Holding UG (haftungsbeschränkt)' },
  { id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, firmierung: 'Beispiel GmbH',
    gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] },
] } as RegisterDatei;
const schildMit = (heute: string, extra: Record<string, unknown> = {}): SchildDatei => ({ gesellschaften: [{
  id: 'ug', profil: { beschaeftigte: 25, groessenklasse: 'klein' },
  ereignisse: [{ id: 'ev-00000000-0000-4000-8000-0000000000e1', art: 'gf-wechsel', datum: tagePlus(heute, -3) }],
  risiken: [{ id: 'rk-00000000-0000-4000-8000-0000000000a1', titel: 'Fristversäumnis bei Steuern, Offenlegung oder Register', kategorie: 'recht', katalogId: 'R5', status: 'offen',
    bewertungen: [{ am: '2026-01-15', von: 'person-a', eintritt: 2, wirkung: 3, art: 'brutto' }], massnahmen: [{ id: 'ms-1', text: 'Pflichten-Kalender' }] }],
  ...extra,
}] } as SchildDatei);

// ── (a) rein ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('(a) Wochen-Check — Regelwerk ohne Modell', () => {
  const lage = lageAus(REGISTER, schildMit(HEUTE), HEUTE);
  const ds: DatenschutzZahlen = { erfuellt: 9, gesamt: 12, offen: ['Zweiter Faktor', 'Verzeichnis'], empfaenger: 6, avvOffen: 2, drittlandOhneGarantie: 0, verzeichnis: 14, pannen: { offen: 1, dringend: 0 } };
  const c = wochenCheck({ lage, vertragsFristen: [], datenschutz: ds, heute: HEUTE });

  it('ISO-Woche als Riegel; einmal je Woche fällig', () => {
    expect(kwVon(HEUTE)).toBe('2026-W42');
    expect(kwVon('2026-10-18')).toBe('2026-W42');
    expect(kwVon('2026-10-19')).toBe('2026-W43');
    expect(wocheFaellig(null, HEUTE)).toBe(true);
    expect(wocheFaellig({ woche: { kw: '2026-W42', am: '', check: c } }, '2026-10-15')).toBe(false);
    expect(wocheFaellig({ woche: { kw: '2026-W42', am: '', check: c } }, '2026-10-19')).toBe(true);
  });

  it('nur Business-Gesellschaften (nie die Privat-Einheit), Ampel je Teil aus derselben Lage wie das Schild', () => {
    expect(c.gesellschaften.map(g => g.id)).toEqual(['kdv', 'ug']);
    const ug = c.gesellschaften.find(g => g.id === 'ug')!;
    expect(ug.ampel).toBe(lage.gesellschaften.find(g => g.id === 'ug')!.compliance.ampel);
    expect(c.stand).toBe(lage.stand);
  });

  it('Fristen der nächsten 4 Wochen (sortiert, keine weiter weg), Meldungen aus Ereignissen unter „was fehlt“', () => {
    expect(c.fristen.length).toBeGreaterThan(0);
    for (const f of c.fristen) expect(f.tag <= tagePlus(HEUTE, 28), f.titel).toBe(true);
    expect([...c.fristen].map(f => f.tag)).toEqual([...c.fristen].map(f => f.tag).sort());
    expect(c.fehlt.some(f => f.art === 'meldung')).toBe(true); // GF-Wechsel → Registeranmeldung u. a.
    expect(c.fehlt.some(f => f.art === 'dokument' && f.schwere === 'rot')).toBe(true); // Pflichtdokumente fehlen
    expect(c.fehlt.some(f => f.art === 'schwelle')).toBe(true); // 25 Beschäftigte
    expect(c.fehlt.some(f => f.art === 'datenschutz' && /2 Auftragsverarbeiter/.test(f.text))).toBe(true);
  });

  it('Vorschläge: nur, was nicht schon als Erinnerung kommt (Pflichtdokumente, Schwellen, AVV) — Schlüssel stabil', () => {
    const k = c.vorschlaege.map(v => v.schluessel);
    expect(k).toContain('dok:ug:gesellschafterliste');
    expect(k).toContain('sw:ug:dsb');
    expect(k).toContain('avv');
    expect(new Set(k).size).toBe(k.length);
    expect(wochenCheck({ lage, vertragsFristen: [], datenschutz: ds, heute: HEUTE }).vorschlaege.map(v => v.schluessel)).toEqual(k);
    // Marken: unter 28 Tagen kommt nichts wieder, danach schon; höchstens 8 je Woche.
    expect(neueVorschlaege(c.vorschlaege, { 'dok:ug:gesellschafterliste': tagePlus(HEUTE, -7) }, HEUTE).some(v => v.schluessel === 'dok:ug:gesellschafterliste')).toBe(false);
    const nur = c.vorschlaege.filter(v => v.schluessel === 'dok:ug:gesellschafterliste');
    expect(neueVorschlaege(nur, { 'dok:ug:gesellschafterliste': tagePlus(HEUTE, -30) }, HEUTE)).toHaveLength(1);
    expect(neueVorschlaege(nur, {}, HEUTE, new Set(['dok:ug:gesellschafterliste']))).toHaveLength(0); // Aufgabe gibt es schon
    expect(neueVorschlaege(c.vorschlaege, {}, HEUTE).length).toBeLessThanOrEqual(8);
  });

  it('Eskalation (research › 6b) bei Anzeichen der Zahlungsunfähigkeit → Vorschlag Anwalts-Mappe zuerst; Bericht mit Hinweis, ohne Personen', () => {
    const krise = lageAus(REGISTER, schildMit(HEUTE, { ereignisse: [{ id: 'ev-00000000-0000-4000-8000-0000000000e2', art: 'zahlungsunfaehigkeit', datum: tagePlus(HEUTE, -2) }] }), HEUTE);
    const k = wochenCheck({ lage: krise, vertragsFristen: [], datenschutz: null, heute: HEUTE });
    expect(k.eskalation.length).toBeGreaterThan(0);
    expect(k.eskalation[0]).toMatch(/anwaltliche Einschätzung/);
    expect(k.vorschlaege[0].art).toBe('mappe');
    expect(k.text).toMatch(/keine Rechtsberatung/);
    expect(k.text).toMatch(/ESKALATION/);
    expect(c.text).not.toMatch(/person-a/);
    // Dringende Datenpanne → gesamt rot.
    expect(wochenCheck({ lage, vertragsFristen: [], datenschutz: { ...ds, pannen: { offen: 1, dringend: 1 } }, heute: HEUTE }).ampel).toBe('rot');
    expect(checkText({ ...c })).toBe(c.text);
  });
});

describe('(a) Vertrag → Checkliste — Fundstellen mit Zitat, keine Bewertung', () => {
  const TEXT = [
    '— Seite 1 —',
    'Kooperationsvertrag',
    '§ 3 Laufzeit Der Vertrag beginnt am 01.01.2027 und endet am 31.12.2027. Er verlängert sich um jeweils ein Jahr.',
    '§ 7 Haftung Die Haftung ist auf den Auftragswert begrenzt. Eine Vertragsstrafe ist nicht vereinbart.',
    '§ 9 Kündigung Die Kündigungsfrist beträgt 3 Monate zum Jahresende. Kündigung bis zum 30.09.2027 in Textform.',
    '— Seite 2 —',
    '§ 12 Gerichtsstand Gerichtsstand ist der Sitz des Auftragnehmers. Es gilt deutsches Recht.',
    '§ 14 Nutzungsrechte Der Auftraggeber erhält ein einfaches Nutzungsrecht an den Ergebnissen.',
  ].join('\n');
  const c = vertragCheckliste(TEXT);

  it('die sechs Punkte mit Fundstelle und Stelle (§ · Seite) — Datenschutz ohne Stelle bleibt offen', () => {
    expect(c.punkte.map(p => p.id)).toEqual(['laufzeit', 'kuendigung', 'haftung', 'datenschutz', 'gerichtsstand', 'ip']);
    const p = (id: string) => c.punkte.find(x => x.id === id)!;
    expect(p('kuendigung').fundstellen[0]).toMatchObject({ stelle: '§ 9 · Seite 1' });
    expect(p('kuendigung').fundstellen.some(f => f.zitat.includes('Kündigungsfrist beträgt 3 Monate'))).toBe(true);
    expect(p('haftung').fundstellen[0].stelle).toBe('§ 7 · Seite 1');
    expect(p('gerichtsstand').fundstellen[0].stelle).toBe('§ 12 · Seite 2');
    expect(p('ip').fundstellen.length).toBeGreaterThan(0);
    expect(p('datenschutz').fundstellen).toEqual([]);
  });

  it('Stichtage nach Art (Beginn, Ende, Kündigung) und die Kündigungsfrist als Text', () => {
    expect(c.fristen).toEqual(expect.arrayContaining([
      expect.objectContaining({ datum: '2027-01-01', art: 'beginn' }),
      expect.objectContaining({ datum: '2027-12-31', art: 'ende' }),
      expect.objectContaining({ datum: '2027-09-30', art: 'kuendigung' }),
    ]));
    expect(c.kuendigungsfrist).toBe('3 Monate zum Jahresende');
    expect(tageIn('am 31.02.2027 oder 2027-02-30')).toEqual([]);
    expect(tageIn('zum 1. März 2027')).toEqual(['2027-03-01']);
    expect(kuendigungsfristAus('Die Laufzeit beträgt 3 Monate.')).toBeUndefined();
    // Ohne Wort unmittelbar davor: der ganze Satz entscheidet (hier: kein Hinweis → „Stichtag“).
    expect(vertragCheckliste('Die Frist ist der 15.03.2027 laut Anlage.').fristen).toEqual([expect.objectContaining({ datum: '2027-03-15', art: 'sonstig' })]);
  });

  it('der Text bewertet nie — Hinweis „keine rechtliche Bewertung“, offene Punkte „selbst nachsehen“', () => {
    const t = checklisteText(c, 'Checkliste: Kooperationsvertrag', CHECKLISTE_HINWEIS);
    expect(t).toMatch(/keine rechtliche Bewertung/);
    expect(t).toMatch(/□ Datenschutz \/ AVV/);
    expect(t).toMatch(/Keine Stelle gefunden — selbst nachsehen/);
    expect(t).not.toMatch(/riskant|unwirksam|empfehle|gefährlich|zulässig|nachteilig|\bgut\b/i);
  });

  it('ein Scan ohne Text: nichts erfunden, Hinweis', () => {
    const leer = vertragCheckliste('— Seite 1 —\n');
    expect(leer.punkte.every(p => !p.fundstellen.length)).toBe(true);
    expect(leer.fristen).toEqual([]);
    expect(leer.hinweis).toMatch(/Kein Text gefunden/);
  });
});

describe('(a) Risikorunde vorbereiten — Prüffrage je Risiko, Kandidaten aus Ereignissen; bewertet wird im Schild', () => {
  const s = schildMit(HEUTE, { ereignisse: [{ id: 'ev-00000000-0000-4000-8000-0000000000e3', art: 'neuer-vertrag', datum: tagePlus(HEUTE, -20) }] });
  const g = lageAus(REGISTER, s, HEUTE).gesellschaften.find(x => x.id === 'ug')!;
  const e = s.gesellschaften[0];
  const r = rundeVorbereiten(g, e, HEUTE);

  it('fällig (Prüftermin erreicht), einmal je Quartal', () => {
    expect(rundeBrauchtVorbereitung(g, e, undefined)).toBe(true);
    expect(rundeBrauchtVorbereitung(g, e, { quartal: r.quartal })).toBe(false);
    expect(r.quartal).toBe('2026-Q4');
    expect(r.seit).toBe('2026-01-15');
  });

  it('neue Risiken aus dem Startkatalog (nicht die erfassten), je Risiko eine Prüffrage — nie eine neue Bewertung', () => {
    const ids = r.neueRisiken.map(x => x.katalogId);
    expect(ids).toEqual(expect.arrayContaining(['R10', 'R17', 'R15', 'R4']));
    expect(ids).not.toContain('R5'); // schon im Register
    expect(neueRisikenVon(g, e, HEUTE).map(x => x.katalogId)).toEqual(ids);
    expect(r.jeRisiko).toHaveLength(1);
    expect(r.jeRisiko[0].vorschlag).toMatch(/Seit der letzten Bewertung/);
    expect(r.jeRisiko[0].letzte).toMatchObject({ eintritt: 2, wirkung: 3 });
    expect(e.risiken![0].bewertungen).toHaveLength(1); // nichts dazugeschrieben
    expect(r.text).toMatch(/bewertet wird im Schild/);
    expect(r.text).toMatch(/keine Rechtsberatung/);
  });
});

describe('(a) Anwalts-Mappe: Thema und Fragen geprüft', () => {
  it('Thema nur mit gültigen Kennungen; Fragen ≤ 20 und ≤ 500 Zeichen — nie still gekürzt', () => {
    expect(themaAus({ art: 'gesellschaft', gesellschaftId: 'ug' })).toEqual({ art: 'gesellschaft', gesellschaftId: 'ug' });
    expect(themaAus({ art: 'vertrag', gesellschaftId: 'ug', vertragId: 'kaputt' })).toBeNull();
    expect(themaAus({ art: 'irgendwas', gesellschaftId: 'ug' })).toBeNull();
    expect(fragenPruefen(['  Frage eins ', '', 'Zwei'])).toEqual({ fragen: ['Frage eins', 'Zwei'] });
    expect('fehler' in fragenPruefen(Array.from({ length: 21 }, (_, i) => `F${i}`))).toBe(true);
    expect('fehler' in fragenPruefen(['x'.repeat(501)])).toBe(true);
  });
});

describe('(a) Als Nächstes: der Recht-Check montags ab 7 Uhr — dieselbe Regel wie der Morgenlauf', () => {
  it('diese Woche schon gelaufen → der nächste Montag; noch nicht → jetzt', () => {
    const mittwoch = new Date('2026-10-14T08:00:00.000Z'); // 10:00 Berlin
    const bis = new Date(mittwoch.getTime() + 7 * 864e5);
    const z = rechtCheckZeiten(mittwoch, bis, '2026-W42', kwVon);
    expect(z.map(d => d.toISOString())).toEqual(['2026-10-19T05:00:00.000Z']); // Mo 19.10. 07:00 Berlin
    expect(rechtCheckZeiten(mittwoch, bis, '2026-W41', kwVon)[0].getTime()).toBe(mittwoch.getTime());
  });
});

// ── (b) Katalog, Verträge, Sicht ───────────────────────────────────────────────────────────────────────────────────────────

describe('(b) Katalog: Head of Recht mit Mitarbeiter-Vorlagen und eingebauten Abläufen', () => {
  it('Business-Head mit drei Vorlagen, Hinweis „keine Rechtsberatung“, Kennung unverändert `recht`', () => {
    const h = headDef('recht')!;
    expect(h).toMatchObject({ name: 'Head of Recht', bereich: 'business', ebene: 'haushalt' });
    expect(h.hinweis).toMatch(/keine Rechtsberatung/);
    expect(h.mitarbeiter.map(m => m.id)).toEqual(['recht-fristen', 'recht-vertraege', 'recht-datenschutz']);
    expect(h.kategorien).not.toContain('gesundheit');
    // Aushilfe „Gesellschaften & Verträge“ (CEO-Office) hilft weiter.
    expect(vorlagenFuer('recht').some(v => v.vorlage.id === 'strategie-gesellschaften' && v.aushilfe)).toBe(true);
    expect(KATALOG.filter(x => x.id === 'recht')).toHaveLength(1);
  });
  it('alte Vorschläge („Recht & Datenschutz: …“) zählen weiter zum Head; neue „Head of Recht: …“ ebenso', () => {
    expect(headVonVorschlag({ anlass: 'Recht & Datenschutz: Frist prüfen' })).toBe('recht');
    expect(headVonVorschlag({ anlass: 'Head of Recht · Verträge: Checkliste' })).toBe('recht');
  });
  it('eingebaute Abläufe = RECHT_MODI, der Recht-Check montags im Zeitplan', () => {
    const s = eingebauteSkills(headDef('recht')!);
    expect(s.map(x => x.id)).toEqual(RECHT_MODI.map(m => `eingebaut:recht:${m}`));
    expect(s[0].ausloeser).toMatchObject({ art: 'zeitplan', rhythmus: 'woechentlich', tage: [1] });
  });
  it('Erklärungen: tut / tut nie / Beispiel — auch für die neue Vorlage', () => {
    expect(HEAD_TEXTE.recht.nie).toMatch(/keine Rechtsberatung/);
    for (const id of ['recht-fristen', 'recht-vertraege', 'recht-datenschutz']) expect(MITARBEITER_BEISPIELE[id]?.length, id).toBeGreaterThan(40);
  });
});

describe('(b) Werkzeuge mit Vertrag: lesen/vorschlag, nur Business, nur im Bereich des Head of Recht', () => {
  it('Verträge: Rechteklasse, Bereich, Kategorie, Fremd-Quelle', async () => {
    const { vertragVon } = await import('@/lib/werkzeuge/register');
    const { bereichPasst, wirkungsEntscheid } = await import('@/lib/werkzeuge/vertrag');
    expect(vertragVon('recht_lage')).toMatchObject({ herkunft: 'agent', rechteklasse: 'lesen', bereich: 'business', kategorie: 'finanzen' });
    expect(vertragVon('vertrag_checkliste')).toMatchObject({ rechteklasse: 'lesen', bereich: 'business', fremd: 'crm-ablage', gekapselt: true });
    expect(vertragVon('recht_vorschlag')).toMatchObject({ rechteklasse: 'vorschlag', bereich: 'business' });
    for (const n of ['recht_lage', 'vertrag_checkliste', 'recht_vorschlag']) {
      expect(bereichPasst(vertragVon(n)!.bereich, 'privat'), n).toBe(false);
      // kein Schreibweg ohne Freigabe: auch nach fremdem Text wirkt keins schreibend (lesen/vorschlag)
      expect(['ausfuehren']).toContain(wirkungsEntscheid(vertragVon(n)!, { fremdGelesen: true }));
    }
  });
  it('Angebot: nur der Head of Recht und sein Bereich, nur mit Kategorie „finanzen“, nie bei „nur lesen“, Helfer nur lesend', async () => {
    const { rechtWerkzeugeFuer, rechtSystemSatz, rechtAngebotErgaenzen } = await import('@/lib/agenten/recht-werkzeuge');
    const recht = headDef('recht')!, sales = headDef('sales')!;
    const kats = ['allgemein', 'finanzen'] as const;
    expect(rechtWerkzeugeFuer({ art: 'head', head: recht, kategorien: kats })).toEqual(['recht_lage', 'vertrag_checkliste', 'recht_vorschlag']);
    expect(rechtWerkzeugeFuer({ art: 'head', head: sales, kategorien: kats })).toEqual([]);
    expect(rechtWerkzeugeFuer({ art: 'head', head: recht, kategorien: ['allgemein'] })).toEqual([]);
    expect(rechtWerkzeugeFuer({ art: 'head', head: recht, kategorien: kats, nurLesen: true })).toEqual([]);
    expect(rechtWerkzeugeFuer({ art: 'head', head: recht, kategorien: kats, helfer: true })).toEqual(['recht_lage', 'vertrag_checkliste']);
    expect(rechtWerkzeugeFuer({ art: 'mitarbeiter', head: recht, mitarbeiter: { id: 'recht-datenschutz' }, kategorien: kats })).toEqual(['recht_lage']);
    const a = rechtAngebotErgaenzen({ tools: [], register: new Set(), agenten: new Set() }, { art: 'head', head: recht, kategorien: kats });
    expect(rechtSystemSatz(a)).toMatch(/Rechtsdienstleistungsgesetz/);
    expect(rechtSystemSatz({ tools: [], register: new Set(), agenten: new Set() })).toBe('');
  });
});

describe('(b) Sicht: Privat bekommt den Head of Recht nicht', () => {
  it('Chat je Bereich: Unternehmen und Datenschutz → Head of Recht nur in Business; Route nur Business', async () => {
    expect(kontextHeadFuer('/os/unternehmen', '?s=pflichten', 'business')).toBe('recht');
    expect(kontextHeadFuer('/os/unternehmen', '', 'privat')).toBeNull();
    expect(kontextHeadFuer('/os/datenschutz', '', 'privat')).toBeNull();
    expect(headImBereich('recht', 'privat')).toBe(false);
    const { sichtFremd, routenBereich } = await import('@/lib/zugang/sicht-bereich');
    expect(routenBereich('/api/gesellschaften/recht')).toBe('business');
    expect(sichtFremd('/api/gesellschaften/recht', 'privat')).toBe(true);
  });
});

// ── (c) Server ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('(c) Server: Zugang, Morgenlauf, Freigabe, Vertragseingang, Anwalts-Mappe, Werkzeuge', () => {
  type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  let route: Route;
  let db: typeof import('@/lib/store/local-db');
  let S: typeof import('@/lib/recht/server');
  let stapel: typeof import('@/lib/zoe/stapel');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string, x: Record<string, unknown> = {}) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...x });
  const get = (p: string, q = '') => route.GET(new Request(`http://test/api/gesellschaften/recht${q}`, { headers: kopf(p) }));
  const post = (h: Record<string, string>, body: unknown) => route.POST(new Request('http://test/api/gesellschaften/recht', { method: 'POST', headers: h, body: JSON.stringify(body) }));
  const offeneRecht = async () => (await stapel.lies('offen')).filter(v => v.bezug?.art === 'recht');
  let heute = '';
  async function pdf(zeilen: string[]): Promise<Buffer> {
    const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
    const s = d.addPage(); zeilen.forEach((z, i) => s.drawText(z, { x: 40, y: 780 - i * 16, font: f, size: 11 }));
    return Buffer.from(await d.save());
  }
  const VERTRAG = ['Kooperationsvertrag', '§ 3 Laufzeit. Der Vertrag beginnt am 01.01.2027.', '§ 7 Haftung. Die Haftung ist auf den Auftragswert begrenzt.',
    '§ 9 Kündigung. Die Kündigungsfrist beträgt 3 Monate zum Jahresende.', 'Kündigung bis zum 30.09.2027 in Textform.', '§ 12 Gerichtsstand. Gerichtsstand ist der Sitz.'];

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    heute = (await import('@/lib/zeit')).localDay();
    await db.saveJson('konten', { konten: [
      konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k5', 'nur-business', 'mitglied', 'haus', { finanzRecht: 'business' }),
      konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], umbauVersion: 2 });
    await db.saveJson('gesellschaften--haus', REGISTER);
    await db.saveJson('unternehmen-schild--haus', schildMit(heute));
    await db.saveJson('gesellschaften--kunde-haus', { gesellschaften: [{ id: G1, name: 'Fremde GmbH', rechtsform: 'gmbh' }] });
    await db.saveJson('unternehmen-schild--kunde-haus', { gesellschaften: [{ id: G1, risiken: [{ id: 'rk-fremd-0001', titel: 'FREMDES-RISIKO', kategorie: 'recht', status: 'offen', bewertungen: [] }] }] });
    route = (await import('@/app/api/gesellschaften/recht/route')) as unknown as Route;
    S = await import('@/lib/recht/server');
    stapel = await import('@/lib/zoe/stapel');
  });

  it('Testkunde, Partner (fremder Haushalt), Konto „nur Business“, ohne Person, Dienstweg ohne Person → 403 (lesen und Mappe)', async () => {
    for (const p of ['testkunde', 'partner', 'nur-business']) {
      expect((await get(p)).status, p).toBe(403);
      expect((await get(p, '?jetzt=1')).status, p).toBe(403);
      expect((await post(kopf(p), { aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: 'ug' } })).status, p).toBe(403);
    }
    expect((await route.GET(new Request('http://test/api/gesellschaften/recht'))).status).toBe(403);
    expect((await route.GET(new Request('http://test/api/gesellschaften/recht', { headers: { 'x-make-key': 'pruef-schluessel-head-recht' } }))).status).toBe(403);
    expect(await S.rechtZugangFuer('nur-business')).toBeNull();
    expect(await S.rechtZugangFuer('partner')).toBeNull();
    expect(await S.rechtZugangFuer('person-b')).toEqual({ person: 'person-b', haushalt: 'haus' });
  });

  it('Sicht X bekommt nichts aus Y: der Check jetzt kennt nur die eigenen Business-Gesellschaften', async () => {
    const r = await get('person-b', '?jetzt=1');
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.check.gesellschaften.map((g: { id: string }) => g.id)).toEqual(['kdv', 'ug']);
    expect(JSON.stringify(d)).not.toMatch(/FREMDES-RISIKO|Fremde GmbH/);
    expect(d.hinweis).toMatch(/ersetzt keine Rechts- oder Steuerberatung/);
    expect((await (await get('person-b')).json()).check).toBeNull(); // noch kein Wochen-Check gespeichert
  });

  it('Morgenlauf: Bericht + Vorschläge NUR im Stapel (Business, Anlass „Head of Recht: …“), Glocke nur mit Zugang, idempotent', async () => {
    const vorher = (await db.loadJson<{ tasks: { id: string }[] }>('tasks'))!.tasks.length;
    const r = await S.rechtMorgenlauf('haus', heute);
    expect(r.check).toBe(true);
    expect(r.vorschlaege).toBeGreaterThan(0);
    expect(r.runden).toBe(2); // ug (Prüftermin erreicht) und kdv (aktiv, noch kein Risiko erfasst)
    const offen = await offeneRecht();
    expect(offen.length).toBe(r.vorschlaege);
    for (const v of offen) {
      expect(v.gruppe).toBe('business');
      expect(v.person).toBeUndefined();
      expect(v.anlass).toMatch(/^Head of Recht: /);
      expect(headVonVorschlag(v)).toBe('recht');
      expect(v.bereich).toBe('business');
    }
    // Kein Schreibweg ohne Freigabe: keine Aufgabe, kein Risiko im Register.
    expect((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))!.tasks.length).toBe(vorher);
    expect((await db.loadJson<SchildDatei>('unternehmen-schild--haus'))!.gesellschaften[0].risiken).toHaveLength(1);
    // Glocke: Art „vertrag“ (Business), nur Personen mit Zugang zur Firmen-Akte.
    const an = new Set(gemeldet.map(m => m.an));
    expect(an.has('person-a') && an.has('person-b')).toBe(true);
    expect(an.has('nur-business')).toBe(false);
    expect(gemeldet.every(m => m.art === 'vertrag' && /^rck-/.test(m.bezug?.id ?? ''))).toBe(true);
    const { telegramText } = await import('@/lib/meldungen/speicher');
    expect(telegramText(gemeldet[0] as never)).toBe('Der Head of Recht hat etwas vorbereitet — Details in MAKE OS');
    // Ein zweiter Lauf in derselben Woche: nichts Neues.
    expect(await S.rechtMorgenlauf('haus', heute)).toEqual({ check: false, vorschlaege: 0, runden: 0 });
    expect((await offeneRecht()).length).toBe(offen.length);
    const g = await (await get('person-a')).json();
    expect(g.check.kw).toBe(kwVon(heute));
    expect(g.runden.map((x: { gesellschaftId: string }) => x.gesellschaftId).sort()).toEqual(['kdv', 'ug']);
  });

  it('Freigabe: nur mit Zugang zur Firmen-Akte; Aufgabe idempotent; Katalog-Risiko über die Schreibstelle des Schilds', async () => {
    const offen = await offeneRecht();
    const aufgabe = offen.find(v => v.werkzeug === 'recht_aufgabe')!;
    expect(await S.RECHT_STAPEL_ART.freigeben(aufgabe, 'nur-business', {})).toMatchObject({ ok: false, status: 403 });
    expect(await S.RECHT_STAPEL_ART.freigeben(aufgabe, 'partner', {})).toMatchObject({ ok: false, status: 403 });
    const ok = await S.RECHT_STAPEL_ART.freigeben(aufgabe, 'person-b', {});
    expect(ok.ok).toBe(true);
    const tasks = (await db.loadJson<{ tasks: { id: string; space?: string; spaceId?: string; assignee?: string }[] }>('tasks'))!.tasks;
    const t = tasks.find(x => x.id === S.checkAufgabeId(String(aufgabe.eingabe.schluessel)))!;
    expect(t).toMatchObject({ space: 'business', assignee: 'person-b' });
    expect((await S.RECHT_STAPEL_ART.freigeben(aufgabe, 'person-b', {})).ok).toBe(false); // schon entschieden
    const risiko = offen.find(v => v.werkzeug === 'recht_risiko')!;
    expect((await S.RECHT_STAPEL_ART.freigeben(risiko, 'person-a', {})).ok).toBe(true);
    const rs = (await db.loadJson<SchildDatei>('unternehmen-schild--haus'))!.gesellschaften.find(x => x.id === 'ug')!.risiken!;
    expect(rs.map(x => x.katalogId)).toContain(risiko.eingabe.katalogId);
    expect(rs.find(x => x.katalogId === risiko.eingabe.katalogId)!.bewertungen).toEqual([]); // bewertet wird im Schild
  });

  it('Vertragseingang: Checkliste + erkannte Stichtage als Vorschläge NUR für die hochladende Person; einmal je Datei; Privat-Einheit nie', async () => {
    const { ablegen } = await import('@/lib/dateien/ablage');
    const e = await ablegen('haus', 'person-a', { art: 'vertrag', titel: 'Kooperationsvertrag' }, { bytes: await pdf(VERTRAG), name: 'kooperation.pdf', typ: 'application/pdf' }, new Date().toISOString(), { gesellschaft: 'ug' });
    const r = await S.vertragEingang('haus', 'person-a', e.id);
    expect(r.vorschlaege).toBeGreaterThanOrEqual(2);
    const meine = (await offeneRecht()).filter(v => v.eingabe.dateiId === e.id);
    expect(meine.every(v => v.person === 'person-a')).toBe(true);
    expect(meine.every(v => !stapel.vorschlagSichtbar(v, 'person-b', true))).toBe(true);
    const cl = meine.find(v => v.werkzeug === 'recht_checkliste')!;
    expect(String(cl.eingabe.text)).toMatch(/Kündigungsfrist beträgt 3 Monate/);
    expect(String(cl.eingabe.text)).toMatch(/keine rechtliche Bewertung/);
    expect((await S.vertragEingang('haus', 'person-a', e.id)).uebersprungen).toBe('schon geprüft');
    // Freigabe der Checkliste → Entwurf in der Firmen-Akte.
    expect((await S.RECHT_STAPEL_ART.freigeben(cl, 'person-a', {})).ok).toBe(true);
    const ew = (await db.loadJson<SchildDatei>('unternehmen-schild--haus'))!.gesellschaften.find(x => x.id === 'ug')!.entwuerfe!;
    expect(ew.some(x => x.titel.startsWith('Checkliste: ') && x.text.includes('Kündigung'))).toBe(true);
    // Stichtag: solange die Datei an keinem Vertrag hängt → 409, Vorschlag bleibt offen; danach am Vertrag (Kalender, „kündigen bis“).
    const frist = meine.find(v => v.werkzeug === 'recht_frist' && v.eingabe.datum === '2027-09-30')!;
    expect(frist).toBeTruthy();
    expect(await S.RECHT_STAPEL_ART.freigeben(frist, 'person-a', {})).toMatchObject({ ok: false, status: 409 });
    expect((await offeneRecht()).some(v => v.id === frist.id)).toBe(true);
    const reg = await import('@/lib/gesellschaften/server');
    const g = (await reg.ladeRegister('haus'))!.gesellschaften.find(x => x.id === 'ug')!;
    const neu = await reg.registerAendern('haus', 'person-a', 'ug', reg.standVon(g), { art: 'person', person: 'person-a' }, reg.eintragSchreiben('vertraege', { art: 'kooperation', titel: 'Kooperationsvertrag', status: 'unterschrieben', parteien: [], dateiIds: [e.id] }));
    expect(neu.g).toBeTruthy();
    expect((await S.RECHT_STAPEL_ART.freigeben(frist, 'person-a', {})).ok).toBe(true);
    const vt = (await reg.ladeRegister('haus'))!.gesellschaften.find(x => x.id === 'ug')!.vertraege!.find(x => x.dateiIds?.includes(e.id))!;
    expect(vt.kuendigenBis).toBe('2027-09-30');
    expect(vt.fristen!.some(f => f.datum === '2027-09-30')).toBe(true);
    // Privat-Einheit (Selbstständigkeit) und Konto „nur Business“: nichts.
    const p = await ablegen('haus', 'person-a', { art: 'vertrag' }, { bytes: await pdf(VERTRAG), name: 'privat.pdf', typ: 'application/pdf' }, new Date().toISOString(), { gesellschaft: 'kdc' });
    expect((await S.vertragEingang('haus', 'person-a', p.id)).vorschlaege).toBe(0);
    expect((await S.vertragEingang('haus', 'nur-business', e.id)).uebersprungen).toBe('kein Zugang zur Firmen-Akte');
  });

  it('Upload über Unternehmen › Verträge stößt die Checkliste an (nach der Antwort)', async () => {
    const unterlagen = (await import('@/app/api/gesellschaften/unterlagen/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const f = new FormData();
    f.set('id', 'ug'); f.set('art', 'vertrag'); f.set('titel', 'Rahmenvertrag'); f.set('datei', new File([new Uint8Array(await pdf(VERTRAG))], 'rahmen.pdf', { type: 'application/pdf' }));
    const r = await unterlagen.POST(new Request('http://test/api/gesellschaften/unterlagen', { method: 'POST', headers: { 'x-make-user': 'person-b' }, body: f }));
    expect(r.status).toBe(200);
    const id = (await r.json()).eintrag.id as string;
    let gefunden = false;
    for (let i = 0; i < 50 && !gefunden; i++) { gefunden = (await offeneRecht()).some(v => v.eingabe.dateiId === id && v.person === 'person-b'); if (!gefunden) await new Promise(res => setTimeout(res, 100)); }
    expect(gefunden).toBe(true);
  });

  it('Anwalts-Mappe: nur per Sitzung (Dienstweg 403), PDF verschlüsselt in der Ablage der Gesellschaft, mit Fragen und Anlagen — verschickt nichts', async () => {
    expect((await post({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-head-recht', 'x-make-person': 'person-a' }, { aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: 'ug' } })).status).toBe(403);
    expect((await post(kopf('person-a'), { aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: 'kdc' } })).status).toBe(400); // Privat-Einheit
    expect((await post(kopf('person-a'), { aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: G1 } })).status).toBe(404); // fremder Haushalt
    expect((await post(kopf('person-a'), { aktion: 'mappe', thema: { art: 'vertrag', gesellschaftId: 'ug', vertragId: 'vt-gibt-es-nicht' } })).status).toBe(404);
    expect((await post(kopf('person-a'), { aktion: 'mappe', thema: { art: 'gesellschaft', gesellschaftId: 'ug' }, fragen: Array.from({ length: 21 }, () => 'F') })).status).toBe(413);
    const vt = (await (await import('@/lib/gesellschaften/server')).ladeRegister('haus'))!.gesellschaften.find(x => x.id === 'ug')!.vertraege![0];
    const r = await post(kopf('person-a'), { aktion: 'mappe', thema: { art: 'vertrag', gesellschaftId: 'ug', vertragId: vt.id }, fragen: ['Ist die Haftungsbegrenzung ausreichend?'] });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.eingebunden).toBe(1); // die Vertragsdatei als Anlage
    const { lesen } = await import('@/lib/dateien/ablage');
    const x = (await lesen('haus', d.datei.id))!;
    expect(x.eintrag.gesellschaft).toBe('ug');
    expect(x.bytes.subarray(0, 4).toString()).toBe('%PDF');
    const { textAuslesen } = await import('@/lib/dateien/text-auslesen');
    const t = (await textAuslesen(x.bytes, 'application/pdf'))!.text;
    expect(t).toMatch(/Sachverhalt/i);
    expect(t).toMatch(/Offene Fragen/i);
    expect(t).toMatch(/Ist die Haftungsbegrenzung ausreichend/);
    expect(t).toMatch(/Kündigungsfrist beträgt 3 Monate/); // Anlage eingebunden
    expect(t).toMatch(/Keine Rechtsberatung/i);
    expect(t).not.toMatch(/FREMDES-RISIKO/);
    expect(((await db.loadJson<{ mappen?: { dateiId: string }[] }>('recht-check--haus'))!.mappen ?? [])[0].dateiId).toBe(d.datei.id);
  });

  it('Werkzeuge des Heads: Lage, Checkliste gekapselt, Vorschlag nur im Stapel; ohne Zugang zur Firmen-Akte abgelehnt', async () => {
    const { rechtWerkzeugAusfuehren } = await import('@/lib/agenten/recht-werkzeuge');
    const recht = headDef('recht')!;
    const lage = await rechtWerkzeugAusfuehren('recht_lage', {}, { person: 'person-b', head: recht });
    expect(lage.ok).toBe(true);
    expect(lage.text).toMatch(/RECHT-CHECK/);
    expect(lage.text).not.toMatch(/FREMDES-RISIKO/);
    expect(await rechtWerkzeugAusfuehren('recht_lage', {}, { person: 'nur-business', head: recht })).toMatchObject({ ok: false, klasse: 'rechte' });
    expect(await rechtWerkzeugAusfuehren('recht_lage', {}, { person: 'person-b', head: headDef('sales')! })).toMatchObject({ ok: false, klasse: 'rechte' });
    const runde = await rechtWerkzeugAusfuehren('recht_lage', { gesellschaft: 'ug', ansicht: 'runde' }, { person: 'person-b', head: recht });
    expect(runde.text).toMatch(/RISIKORUNDE/);
    const vt = (await (await import('@/lib/gesellschaften/server')).ladeRegister('haus'))!.gesellschaften.find(x => x.id === 'ug')!.vertraege![0];
    const cl = await rechtWerkzeugAusfuehren('vertrag_checkliste', { vertrag: vt.id }, { person: 'person-b', head: recht });
    expect(cl.ok).toBe(true);
    expect(cl.quelle).toBe('crm-ablage');
    expect(cl.text).toMatch(/<fremde_daten quelle="crm-ablage">/);
    expect(cl.text).toMatch(/keine Rechtsberatung/);
    // Vorschlag: ein Stichtag, der nicht im Text steht → abgelehnt (nichts erfunden); ein Katalog-Risiko → nur Stapel.
    const datei = vt.dateiIds![0];
    expect(await rechtWerkzeugAusfuehren('recht_vorschlag', { art: 'frist', gesellschaft: 'ug', datei, datum: '2030-01-01' }, { person: 'person-b', head: recht })).toMatchObject({ ok: false, klasse: 'eingabe' });
    const vorher = (await db.loadJson<SchildDatei>('unternehmen-schild--haus'))!.gesellschaften.find(x => x.id === 'ug')!.risiken!.length;
    const vs = await rechtWerkzeugAusfuehren('recht_vorschlag', { art: 'risiko', gesellschaft: 'ug', katalog: 'R9', begruendung: 'AVV offen' }, { person: 'person-b', head: recht });
    expect(vs).toMatchObject({ ok: true, gestapelt: true });
    expect((await stapel.hole(vs.vorschlagId!))).toMatchObject({ werkzeug: 'recht_risiko', person: 'person-b', bezug: { art: 'recht' } });
    expect((await db.loadJson<SchildDatei>('unternehmen-schild--haus'))!.gesellschaften.find(x => x.id === 'ug')!.risiken!.length).toBe(vorher);
    expect(await rechtWerkzeugAusfuehren('recht_vorschlag', { art: 'risiko', gesellschaft: 'kdc', katalog: 'R9' }, { person: 'person-b', head: recht })).toMatchObject({ ok: false });
  });

  it('Kontext des Heads: Firmen-Akte nur mit Kategorie „finanzen“ und Zugang — „nur Business“ sieht nur Datenschutz-Zähler', async () => {
    const { rechtTeil } = await import('@/lib/agenten/kontext');
    const voll = await rechtTeil('person-b', heute, new Set(['allgemein', 'finanzen']));
    expect(voll.finanzen).toBe(true);
    expect(voll.text).toMatch(/FIRMEN-AKTE/);
    expect(voll.text).not.toMatch(/FREMDES-RISIKO/);
    const ohneKat = await rechtTeil('person-b', heute, new Set(['allgemein']));
    expect(ohneKat.finanzen).toBe(false);
    expect(ohneKat.text).not.toMatch(/FIRMEN-AKTE/);
    const nb = await rechtTeil('nur-business', heute, new Set(['allgemein', 'finanzen']));
    expect(nb.text).not.toMatch(/FIRMEN-AKTE/);
    expect(nb.hinweis).toMatch(/nicht freigegeben/);
  });
});
