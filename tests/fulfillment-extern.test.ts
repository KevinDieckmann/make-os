// ─── Fulfillment extern (12.10.) — EIN Bild für Kunden-Seite, 2-Wochen-Report, Wirkungsbericht und Präsentation ───────────────────────────────────
// Rückmeldung 12.10.: „Das ganze Fulfillment massiv überarbeiten — intern wie extern muss alles sauber sein.“ Geprüft wird, was der Kunde sieht:
//   · keine internen Begriffe (Freigabe-Kürzel → „Abstimmungspunkt“, Zusätze „(nur …)“ weg), Abstimmungen ohne Kunde nie
//   · Lage: Ampel nach dem, was hakt (beim Kunden / bei uns), drei Sätze, Du/Sie
//   · dieselben Modelle für Oberfläche und PDF (Strahl, Wert-Balken), Formular-Zählung
//   · Report mit Fall: Seite 1 Zusammenfassung (Ampel, drei Sätze, Strahl, Ziele, erledigt · als Nächstes · wartet, erste Erfolge, Puls), dann Details;
//     gleiche Eingabe → gleiche Bytes; Mail kurz und persönlich; ohne Fall unverändert (Schnappschuss in tests/fulfillment-c2-rein.test.ts)
//   · Wirkungsbericht: Vorher/Nachher je Ziel, Meilensteine, Zitat NUR mit Einwilligung, nächste Stufe ohne Preis
//   · Willkommensmail und Puls-Mail: ohne Platzhalter, Du/Sie
// Erfundene Daten, rein, kein Netz, keine Platte.
import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { kundenText, kundenLage, kundenTeile, strahlModell, wertModell, formularZaehlung, fragenText, uploadText, anredeAus, WORTE, type KundenPhase } from '@/lib/fulfillment/kunde/bild';
import { reportZusatz } from '@/lib/fulfillment/kunde/report-zusatz';
import { pulsMail } from '@/lib/fulfillment/kunde/puls';
import { mitZusatz, mailVorlage, hatZusatz, PULS_PLATZHALTER, type ReportDokument } from '@/lib/crm/treppe-report';
import { reportPdf } from '@/lib/crm/treppe-pdf';
import { wirkungsDokument } from '@/lib/fulfillment/prozesse/wirkung';
import { wirkungPdf } from '@/lib/fulfillment/prozesse/wirkung-pdf';
import { willkommenMail, WILLKOMMEN_GERUEST } from '@/lib/fulfillment/prozesse/onboarding';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

const HEUTE = '2026-10-10';
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const FALL: Fall = {
  mandatId: 'm-1', vorlageId: 'fp-x', vorlageFassung: 1, gestartetAm: '2026-09-01T08:00:00Z', gestartetVon: 'pia', status: 'laeuft',
  knoten: [
    k('w', undefined, 'Paket', 1),
    k('p1', 'w', 'Vorlauf / Onboarding', 1, { kundeSichtbar: true, freigabe: 'F0', status: 'erledigt' }), k('p1-a', 'p1', 'Kick-off', 1, { status: 'erledigt', erledigtAm: '2026-10-02T10:00:00Z', kundeSichtbar: true }),
    k('p2', 'w', 'Analyse', 2, { kundeSichtbar: true, freigabe: 'F2' }),
    k('p2-a', 'p2', 'Interviews', 1, { status: 'erledigt', erledigtAm: '2026-10-06T10:00:00Z', kundeSichtbar: true }),
    k('p2-b', 'p2', 'Wettbewerb sichten', 2, { kundeSichtbar: true, faelligAm: '2026-10-20' }),
    k('p2-c', 'p2', 'Preisliste freigeben', 3, { status: 'wartet_kunde', seit: '2026-10-01', kundeSichtbar: true }),
    k('p2-d', 'p2', 'INTERNER Abgleich', 4),
    k('p3', 'w', 'Recruiting (nur Prozess)', 3, { kundeSichtbar: true, freigabe: 'F3' }), k('p3-a', 'p3', 'F3 bestätigt', 1, { freigabe: 'F3', kundeSichtbar: true }),
  ],
  freigaben: { F0: { am: '2026-09-05', von: 'pia' } }, onboarding: {}, stakeholder: [], entscheidungen: [{ id: 'fe-1', am: '2026-10-05', titel: 'Budget freigeben', status: 'offen', wer: 'kunde', geteilt: true, frist: '2026-10-08', von: 'pia' }],
  rituale: [{ ritualId: 'fr-w', terminUids: ['uid-1'], angelegtAm: '2026-09-02' }], mitschriften: [],
  quickWins: [{ id: 'q1', text: 'Angebotsvorlage vereinheitlicht', bis: '2026-10-05', erledigtAm: '2026-10-04T09:00:00Z', quelle: 'hand' }, { id: 'q2', text: 'Nachfass-Rhythmus einführen', bis: '2026-10-30', quelle: 'analyse' }],
  kickoffFragen: [], wertKonto: { z1: { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine', zielBis: '2026-12-31', festgelegtAm: '2026-09-05', messungen: [{ am: '2026-10-08', wert: 7, quelle: 'hand' }] } },
  befaehigung: [{ id: 'b1', text: 'Team führt das Huddle selbst', erfuellt: true }, { id: 'b2', text: 'Kennzahlen-Board ohne uns', erfuellt: false }], marken: {}, geaendert: '2026-10-08T10:00:00Z', geaendertVon: 'pia',
};
const MANDAT = { id: 'm-1', titel: 'Vertrieb neu aufstellen', kunde: 'Beispiel Werkzeugbau GmbH', ziele: [{ id: 'z1', text: 'Neue Termine je Monat', ziel: '12', ist: '4' }], start: '2026-09-01' };
const FREIGABEN = [{ id: 'F0', titel: 'Rahmen & Zugänge', wer: 'beide' as const }, { id: 'F2', titel: 'Dossier geprüft', wer: 'intern' as const }, { id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide' as const }];
const teile = (anrede: 'du' | 'sie' = 'du') => kundenTeile({ fall: FALL, mandat: MANDAT, heute: HEUTE, anrede, gesperrt: new Set(), freigaben: FREIGABEN, rituale: [{ id: 'fr-w', titel: 'Wochen-Check', rhythmus: 'woche' }], terminTage: [{ uid: 'uid-1', tag: '2026-10-14' }, { uid: 'uid-1', tag: '2026-10-07' }] });

/** Text der Seiten eines PDFs (pdf-lib schreibt Text als Hex-Strings in komprimierte Ströme) — je Seite ein String. */
async function pdfTexte(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map(p => {
    const inhalt = p.node.Contents();
    const stroeme = inhalt && 'size' in inhalt ? Array.from({ length: (inhalt as unknown as { size(): number }).size() }, (_, i) => (inhalt as unknown as { lookup(i: number): unknown }).lookup(i)) : [inhalt];
    return stroeme.map(s => {
      const roh = (s as { getContents(): Uint8Array }).getContents();
      let klar: string;
      try { klar = inflateSync(Buffer.from(roh)).toString('latin1'); } catch { klar = Buffer.from(roh).toString('latin1'); }
      return Array.from(klar.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)).map(m => Buffer.from(m[1], 'hex').toString('latin1')).join(' ');
    }).join(' ');
  });
}

describe('Kunden-Texte: keine internen Begriffe', () => {
  it('Freigabe-Kürzel → „Abstimmungspunkt“ bzw. der Titel der Abstimmung; „(nur …)“/„(intern)“ fallen weg', () => {
    expect(kundenText('F0 bestätigt', 'Rahmen & Zugänge')).toBe('Abstimmung: Rahmen & Zugänge');
    expect(kundenText('F0 bestätigt')).toBe('Abstimmungspunkt bestätigt');
    expect(kundenText('Abnahme F5 vorbereiten')).toBe('Abnahme Abstimmungspunkt vorbereiten');
    expect(kundenText('Recruiting (nur Prozess)')).toBe('Recruiting');
    expect(kundenText('Leitfaden (intern) schärfen')).toBe('Leitfaden schärfen');
    expect(kundenText('Formular F10')).toBe('Formular Abstimmungspunkt');
    expect(kundenText('Fahrplan 2026')).toBe('Fahrplan 2026');
  });
  it('Anrede: nur ein ausdrückliches „Du“ duzt', () => {
    expect([anredeAus('Du'), anredeAus('Sie'), anredeAus(undefined), anredeAus('irgendwas')]).toEqual(['du', 'sie', 'sie', 'sie']);
    expect(WORTE.du.braucht).toBe('Das braucht es von euch');
    expect(WORTE.sie.braucht).toBe('Das brauchen wir von Ihnen');
  });
});

describe('Teile und Lage', () => {
  it('Phasen mit Anteil und Abstimmungspunkt (nur mit Kunde), erledigt der letzten 14 Tage, als Nächstes, wartet mit Frist, Ziel mit Anteil, Termin', () => {
    const t = teile();
    expect(t.phasen).toEqual([
      { titel: 'Vorlauf / Onboarding', stand: 'erledigt', anteil: 1, abstimmung: { titel: 'Rahmen & Zugänge', erledigt: true } },
      { titel: 'Analyse', stand: 'aktuell', anteil: 0.25 },
      { titel: 'Recruiting', stand: 'kommt', anteil: 0, abstimmung: { titel: 'Diagnose-Abnahme', erledigt: false } },
    ]);
    expect(t.erledigt).toEqual(['Kick-off (02.10.2026)', 'Interviews (06.10.2026)']);
    expect(t.naechstes).toEqual(['Wettbewerb sichten — bis 20.10.2026', 'Danach in „Recruiting“: Abstimmung „Diagnose-Abnahme“']);
    expect(t.wartet).toEqual([{ titel: 'Preisliste freigeben', seit: '01.10.2026' }, { titel: 'Budget freigeben', seit: '05.10.2026', frist: '08.10.2026', ueberfaellig: true }]);
    expect(t.wertKonto).toEqual([{ name: 'Neue Termine je Monat', vorher: '4 Termine', jetzt: '7 Termine', ziel: '12 Termine', bis: '31.12.2026', anteil: 38 }]);
    expect(t.quickWins.map(q => [q.text, q.erledigt])).toEqual([['Angebotsvorlage vereinheitlicht', true], ['Nachfass-Rhythmus einführen', false]]);
    expect(t.naechsterTermin).toEqual({ titel: 'Wochen-Check', am: 'Mi, 14.10.2026' });
    expect(JSON.stringify(t)).not.toMatch(/INTERN|Dossier|\bF\d\b|nur Prozess/);
  });
  it('Lage: NUR die Übersetzung der internen Hänger (15.10., Abnahme B1) — wartet beim Kunden gelb/rot, interne Punkte „Wir sind dran“, sonst grün; drei Sätze, Du/Sie', () => {
    // Ohne Hänger: grün — auch wenn etwas wartet (die Wartezeit steht im dritten Satz, die Schwelle rechnet nur das Cockpit).
    const t = teile('du');
    expect(t.lage.ampel).toBe('gruen');
    expect(t.lage.titel).toBe('Wir liegen im Plan');
    expect(t.lage.saetze).toEqual([
      'Wir sind in Phase 2 von 3 („Analyse“) — insgesamt sind 33 % des Weges geschafft.',
      'In den letzten zwei Wochen haben wir 2 Schritte abgeschlossen.',
      'Von euch brauchen wir 2 Dinge — die älteste wartet seit 9 Tagen.',
    ]);
    // Mit dem Hänger des Cockpits („wartet“ > 7 Tage, der Kunde sieht den Punkt): gelb „Wir warten …“.
    const mitHaenger = kundenTeile({ fall: FALL, mandat: MANDAT, heute: HEUTE, anrede: 'du', gesperrt: new Set(), freigaben: FREIGABEN, haengt: [{ art: 'wartet', schwere: 'gelb', tage: 9, kundeSieht: true }] });
    expect(mitHaenger.lage).toMatchObject({ ampel: 'gelb', titel: 'Wir warten auf euren Input' });
    const basis = { phasen: [] as KundenPhase[], fortschritt: null, erledigt: 0, quickWinsErledigt: 0, naechstes: [], wertKonto: [] };
    expect(kundenLage({ ...basis, wartetTage: [], anrede: 'sie' })).toMatchObject({ ampel: 'gruen', titel: 'Wir liegen im Plan' });
    expect(kundenLage({ ...basis, wartetTage: [21], anrede: 'sie', haengt: [{ art: 'wartet', schwere: 'rot', tage: 21 }] })).toMatchObject({ ampel: 'rot', titel: 'Wir kommen gerade nur mit Ihnen weiter' });
    // Interne Punkte (Willkommensmail, überfälliger Schritt, Report …) — auch rote — heißen beim Kunden „Wir sind dran“ (gelb), nie rot.
    expect(kundenLage({ ...basis, wartetTage: [], anrede: 'du', haengt: [{ art: 'willkommen', schwere: 'rot' }] })).toMatchObject({ ampel: 'gelb', titel: 'Wir sind dran' });
    expect(kundenLage({ ...basis, wartetTage: [], anrede: 'du', haengt: [{ art: 'faellig', schwere: 'gelb', tage: 20 }] })).toMatchObject({ ampel: 'gelb', titel: 'Wir sind dran' });
    // Ein wartender Punkt, den der Kunde nicht sieht (ungeteilte Entscheidung), ist für ihn kein „Wir warten …“.
    expect(kundenLage({ ...basis, wartetTage: [], anrede: 'sie', haengt: [{ art: 'wartet', schwere: 'gelb', tage: 9, kundeSieht: false }] })).toMatchObject({ ampel: 'gelb', titel: 'Wir sind dran' });
    expect(kundenLage({ ...basis, wartetTage: [1], anrede: 'sie' }).saetze[2]).toBe('Von Ihnen brauchen wir eine Sache — sie wartet seit 1 Tag.');
    expect(kundenLage({ ...basis, wartetTage: [], anrede: 'sie' }).saetze).toEqual(['Wir haben gemeinsam gestartet.', 'Die nächsten Schritte stimmen wir im nächsten Termin ab.', 'Von Ihnen brauchen wir gerade nichts — vielen Dank!']);
  });
  it('Modelle für Oberfläche und PDF: Strahl (gleich breit, laufend mit Anteil, „hier stehen wir“), Wert-Balken, Formular-Zählung, Upload-Text', () => {
    const m = strahlModell(teile().phasen);
    expect(m.segmente.map(s => [s.von, s.bis, s.fuellung])).toEqual([[0, 1 / 3, 1], [1 / 3, 2 / 3, 0.25], [2 / 3, 1, 0]]);
    expect([m.jetzt, m.text]).toEqual([1, 'Phase 2 von 3 · Analyse']);
    expect(strahlModell([{ titel: 'A', stand: 'aktuell', anteil: 0 }]).segmente[0].fuellung).toBe(0.08);
    expect(wertModell({ name: 'x', vorher: '4', jetzt: '12', ziel: '12', anteil: 100 })).toMatchObject({ anteil: 1, erreicht: true });
    expect(wertModell({ name: 'x', vorher: 'wenig', jetzt: '—', ziel: 'viel' })).toEqual({ anteil: null, erreicht: false, zeile: 'wenig → — → viel' });
    const z = formularZaehlung([{ id: 'a', frage: 'Eins?', pflicht: true }, { id: 'b', frage: 'Zwei?' }, { id: 'c', frage: 'Drei?', pflicht: true }], { a: 'ja', b: '  ' });
    expect(z).toEqual({ beantwortet: 1, gesamt: 3, pflichtOffen: ['Drei?'] });
    expect(fragenText(z)).toBe('1 von 3 Fragen beantwortet');
    expect(uploadText({ eingegangen: 3, geprueft: 2, offen: 1 })).toBe('3 Dateien eingegangen · 2 geprüft · 1 wird geprüft.');
  });
});

/** Was das Cockpit für diesen Fall hängen sieht (`wasHaengt`): die Preisliste wartet seit 9 Tagen beim Kunden (> 7 → gelb), der Kunde sieht sie. */
const HAENGT = [{ art: 'wartet', schwere: 'gelb' as const, tage: 9, kundeSieht: true }];
describe('2-Wochen-Report mit Fall: Seite 1 Zusammenfassung, dann Details', () => {
  const basis: ReportDokument = { titel: 'Fortschrittsbericht', kunde: MANDAT.kunde, mandat: MANDAT.titel, paket: 'Stufe Zwei', stand: '10.10.2026', absender: 'Erfundene Gesellschaft', schritt: 'Analyse (Schritt 2 von 5)', erreicht: ['Kick-off (02.10.2026)'], naechste: ['Diagnose vorstellen — bis 20.10.2026'], kennzahlen: [{ name: 'Woran wir es messen', wert: 'Abschlussquote' }], hinweis: 'Dieser Bericht fasst den Stand aus unserer Projektarbeit zusammen.' };
  const zusatz = (pulsFrage = true) => reportZusatz(FALL, MANDAT, { puls: [{ id: 'pu-1', mandatId: 'm-1', am: '2026-10-09T10:00:00.000Z', wert: 8, quelle: 'link' }] }, HEUTE, pulsFrage, new Set(), { anrede: 'du', freigaben: FREIGABEN, rituale: [{ id: 'fr-w', titel: 'Wochen-Check', rhythmus: 'woche' }], terminTage: [{ uid: 'uid-1', tag: '2026-10-14' }], haengt: HAENGT })!;
  it('Zusatz trägt dieselben Teile wie die Kunden-Seite; Erledigt/als Nächstes zuerst aus dem Fall, ohne Doppelte', () => {
    const z = zusatz();
    expect(z).toMatchObject({ anrede: 'du', fortschritt: 33, lage: { ampel: 'gelb' }, naechsterTermin: { titel: 'Wochen-Check', am: 'Mi, 14.10.2026' } });
    expect(z.phasen).toHaveLength(3);
    expect(z.wertKonto[0]).toMatchObject({ name: 'Neue Termine je Monat', anteil: 38 });
    const d = mitZusatz(basis, z);
    expect(hatZusatz(d)).toBe(true);
    expect(d.erreicht).toEqual(['Kick-off (02.10.2026)', 'Interviews (06.10.2026)']);
    // Mit Fall nur die Schritte des Falls (15.10., Abnahme B1) — derselbe nächste Schritt wie Fall-Kopf und Kunden-Seite.
    expect(d.naechste).toEqual(['Wettbewerb sichten — bis 20.10.2026', 'Danach in „Recruiting“: Abstimmung „Diagnose-Abnahme“']);
    expect(JSON.stringify(d)).not.toMatch(/\bF\d\b|Dossier|nur Prozess/);
  });
  it('PDF: Seite 1 = Zusammenfassung (Ampel-Titel, drei Sätze, „hier stehen wir“, Ziel, Spalten, erste Erfolge, Puls), ab Seite 2 Details; gleiche Eingabe → gleiche Bytes', async () => {
    const d = mitZusatz(basis, zusatz());
    const erstellt = new Date('2026-10-10T08:00:00Z');
    const a = await reportPdf(d, { erstellt });
    const b = await reportPdf(d, { erstellt });
    expect(createHash('sha256').update(a).digest('hex')).toBe(createHash('sha256').update(b).digest('hex'));
    const seiten = await pdfTexte(a);
    expect(seiten.length).toBeGreaterThanOrEqual(2);
    for (const x of ['Fortschrittsbericht', 'Wir warten auf euren Input', 'HIER STEHEN WIR', 'EUER ZIEL', 'Neue Termine je Monat', 'ERLEDIGT', 'ALS NÄCHSTES', 'WARTET AUF EUCH', 'ERSTE ERFOLGE', 'Wie zufrieden seid ihr?', 'Nächster Termin: Wochen-Check']) expect(seiten[0], x).toContain(x);
    expect(seiten.slice(1).join(' ')).toContain('Im Detail');
    expect(seiten.join(' ')).not.toMatch(/\bF\d\b|Dossier|INTERN/);
  });
  it('Mail mit Fall: kurz und persönlich (Hey …, wollte dich gerade updaten), Lage, Listen, Ziel, Termin, Puls nur mit Link; Sie ohne Puls-Platzhalter', () => {
    const d = mitZusatz(basis, zusatz());
    const m = mailVorlage({ anrede: 'Du', vorname: 'Erika', doc: d, absender: 'Max Probe' });
    expect(m.text.startsWith('Hey Erika,\n\nich wollte dich gerade updaten — kurz der Stand: Wir warten auf euren Input.')).toBe(true);
    for (const x of ['Erledigt:\n- Kick-off', 'Wartet auf euch:\n- Preisliste freigeben (seit 9 Tagen)', 'Euer Ziel (vorher → jetzt → Ziel):\n- Neue Termine je Monat: 4 Termine → 7 Termine → 12 Termine', 'Nächster Termin: Wochen-Check, Mi, 14.10.2026.', PULS_PLATZHALTER, 'Viele Grüße\nMax Probe']) expect(m.text, x).toContain(x);
    const s = mailVorlage({ anrede: 'Sie', nachname: 'Beispiel', doc: mitZusatz(basis, zusatz(false)) });
    expect(s.text).toContain('Ihr Ziel (vorher → jetzt → Ziel):');
    expect(s.text).toContain('Wartet auf Sie:');
    expect(s.text).not.toContain(PULS_PLATZHALTER);
  });
});

describe('Wirkungsbericht', () => {
  it('Vorher/Nachher je Ziel mit Anteil, Meilensteine, Erfolge, Befähigung; Zitat nur mit Einwilligung; nächste Stufe ohne Preis; gleiche Bytes', async () => {
    const mit = wirkungsDokument({ fall: FALL, mandat: MANDAT, heute: HEUTE, bausteine: [], freigaben: FREIGABEN, zitat: { text: 'Endlich Ruhe im Vertrieb.', einwilligungAm: '2026-10-09', wie: 'per Mail' }, naechsteStufe: { name: 'Stufe Drei', text: 'Das Team führt selbst.' }, absender: 'Erfundene Gesellschaft' });
    expect(mit.wertKonto[0]).toMatchObject({ anteil: 38 });
    expect(mit.phasen?.map(p => p.titel)).toEqual(['Vorlauf / Onboarding', 'Analyse', 'Recruiting']);
    expect(mit.erfolge?.map(q => q.text)).toEqual(['Angebotsvorlage vereinheitlicht']);
    expect(mit.naechsteStufe).toEqual({ name: 'Stufe Drei', text: 'Das Team führt selbst.' });
    const ohne = wirkungsDokument({ fall: FALL, mandat: MANDAT, heute: HEUTE, bausteine: [], zitat: { text: 'GEHEIM', einwilligungAm: '', wie: '' } });
    expect(ohne.zitat).toBeUndefined();
    const erstellt = new Date('2026-10-10T08:00:00Z');
    const a = await wirkungPdf(mit, { erstellt });
    expect(Buffer.from(a).equals(Buffer.from(await wirkungPdf(mit, { erstellt })))).toBe(true);
    const text = (await pdfTexte(a)).join(' ');
    for (const x of ['Wirkungsbericht', 'VORHER UND NACHHER', 'Neue Termine je Monat', 'MEILENSTEINE', 'ERSTE ERFOLGE', 'LÄUFT OHNE UNS', 'STIMME DES KUNDEN', 'Endlich Ruhe im Vertrieb.', 'Wie es weitergehen kann', 'Stufe Drei']) expect(text, x).toContain(x);
    expect(text).not.toMatch(/\bF\d\b|Dossier|€/);
    expect((await pdfTexte(await wirkungPdf(ohne, { erstellt }))).join(' ')).not.toContain('GEHEIM');
  });
});

describe('Mails an den Kunden', () => {
  it('Willkommensmail: ohne Platzhalter; ohne Link fällt der Absatz zur Projektseite weg; Du und Sie', () => {
    const sie = willkommenMail(WILLKOMMEN_GERUEST.Sie, { anrede: 'Sie', nachname: 'Probe', kickoffVorschlaege: ['Di, 14.10., 10:00–11:30 Uhr'], playbookLink: 'https://example.invalid/kunde/kl-x#t=y' });
    expect(sie.betreff).toBe('Willkommen — so starten wir gemeinsam');
    expect(sie.text).toContain('Guten Tag Probe,');
    expect(sie.text).toContain('– Di, 14.10., 10:00–11:30 Uhr');
    expect(sie.text).toContain('https://example.invalid/kunde/kl-x#t=y');
    expect(sie.text).not.toMatch(/\{\{/);
    const du = willkommenMail(WILLKOMMEN_GERUEST.Du, { anrede: 'Du', vorname: 'Erika', kickoffVorschlaege: [] });
    expect(du.text).toContain('Hallo Erika,');
    expect(du.text).not.toContain('Projektseite');
    expect(du.text).not.toMatch(/\{\{|\bSie\b/);
  });
  it('Puls-Mail: ein Satz, ein Klick; Du/Sie; der Link steht genau einmal', () => {
    const du = pulsMail({ anrede: 'Du', vorname: 'Erika', link: 'https://example.invalid/kunde/kl-x#p=y', absender: 'Max' });
    expect(du.text.startsWith('Hey Erika,')).toBe(true);
    expect(du.text).toContain('Wie zufrieden bist du');
    expect(du.text.split('https://example.invalid/kunde/kl-x#p=y')).toHaveLength(2);
    const sie = pulsMail({ link: 'L' });
    expect(sie.text.startsWith('Guten Tag,')).toBe(true);
    expect(sie.text).toContain('Wie zufrieden sind Sie');
    expect(sie.betreff).toBe('Eine kurze Frage zu unserer Zusammenarbeit');
  });
});
