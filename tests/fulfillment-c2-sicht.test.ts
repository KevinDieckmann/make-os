// ─── Fulfillment C2 — die Kunden-Sicht: Positivliste, tiefer Schlüssel-Vergleich, Ansicht (10.10.; FULFILLMENT_KONZEPT.md 5.4, 6.4, 12.3) ──────────
// `kundenSicht` bekommt einen Fall VOLLER interner Daten (Stakeholder mit Haltung/Notiz, interne Knoten, ungeteilte Entscheidungen, Mitschriften,
// Termin-Kennungen, Quick Wins, Kick-off-Fragen, Health, Honorar …) und darf nur die Pfade der Positivliste liefern — jeder neue Pfad macht diesen
// Test rot (bewusste Änderung hier UND in lib/fulfillment/kunde/sicht.ts). Dazu: „nur intern“/„vor Verkauf prüfen“ erscheinen nie, Puls-Modus zeigt nur
// den Puls, und die Komponente `KundenAnsicht` zeigt in der Vorschau nichts zum Ausfüllen. Erfundene Daten, rein, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { kundenSicht, kundeHinweis, schluesselPfade, SICHT_SCHLUESSEL, type SichtEingabe } from '@/lib/fulfillment/kunde/sicht';
import { leerKunde } from '@/lib/fulfillment/lesen';
import type { Baustein, Fall } from '@/lib/fulfillment/typen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/kunde' }));

const B = (id: string, extra: Partial<Baustein> & Record<string, unknown> = {}): Baustein => ({
  id, art: 'formular', titel: `Formular ${id.slice(3)}`, gliederung: ['GLIEDERUNG-INTERN'], text: 'TEXT-INTERN', platzhalter: [], tags: ['TAG-INTERN'], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true,
  hinweis: 'HINWEIS-INTERN', warum: 'WARUM-INTERN', fassung: 1, geaendert: '', geaendertVon: 'person-intern', fragen: [{ id: 'q1', abschnitt: 'A', frage: 'Frage eins?', art: 'text', hilfe: 'Hilfe' }], ...extra,
} as Baustein);
const FALL: Fall = {
  mandatId: 'm-1', vorlageId: 'fp-x', vorlageFassung: 3, gestartetAm: '2026-09-01T00:00:00Z', gestartetVon: 'person-intern', status: 'laeuft',
  knoten: [
    { id: 'w', titel: 'Wurzel', rang: 1, status: 'offen' },
    { id: 'p1', elternId: 'w', titel: 'Phase sichtbar', rang: 1, status: 'in_arbeit', kundeSichtbar: true, ziel: 'ZIEL-INTERN', ergebnis: 'ERGEBNIS-INTERN', kennzahl: 'KENNZAHL-INTERN', zustaendig: 'intern', freigabe: 'F3', phaseId: 'ph-1' },
    { id: 'p2', elternId: 'w', titel: 'PHASE-INTERN', rang: 2, status: 'offen' },
    { id: 's1', elternId: 'p1', titel: 'SCHRITT-INTERN', rang: 1, status: 'erledigt', erledigtAm: '2026-10-08T10:00:00Z', erledigtVon: 'person-intern' },
    { id: 's2', elternId: 'p1', titel: 'Schritt sichtbar', rang: 2, status: 'offen', kundeSichtbar: true, faelligAm: '2026-10-20' },
    { id: 's3', elternId: 'p1', titel: 'Wartet', rang: 3, status: 'wartet_kunde', seit: '2026-10-01', grund: 'GRUND-INTERN' },
    { id: 'b1', elternId: 's2', titel: 'Baustein', rang: 1, status: 'offen', bausteinId: 'fb-ok' },
    { id: 'b2', elternId: 's2', titel: 'Baustein', rang: 2, status: 'offen', bausteinId: 'fb-nurintern' },
    { id: 'b3', elternId: 's2', titel: 'Baustein', rang: 3, status: 'offen', bausteinId: 'fb-vorverkauf' },
    { id: 'b4', elternId: 's2', titel: 'Baustein', rang: 4, status: 'offen', bausteinId: 'fb-urheber' },
    { id: 'b5', elternId: 's2', titel: 'Baustein', rang: 5, status: 'offen', bausteinId: 'fb-intern-fuellt' },
  ],
  freigaben: { F0: { am: '2026-09-02', von: 'person-intern', notiz: 'FREIGABE-NOTIZ' } }, onboarding: { willkommenGesendetAm: '2026-09-01', willkommenVon: 'person-intern' },
  vereinbarung: { rollen: 'VEREINBARUNG-INTERN', eskalation: 'ESKALATION-INTERN' },
  stakeholder: [{ id: 'fs-1', kontaktId: 'c-geheim', rolle: 'skeptiker', einfluss: 3, haltung: 'kritisch', notiz: 'STAKEHOLDER-NOTIZ' }],
  entscheidungen: [{ id: 'fe-1', am: '2026-10-02', titel: 'Geteilt', inhalt: 'Inhalt geteilt', status: 'entschieden', wer: 'beide', geteilt: true, von: 'person-intern' }, { id: 'fe-2', am: '2026-10-02', titel: 'ENTSCHEIDUNG-INTERN', status: 'offen', wer: 'intern', geteilt: false, von: 'person-intern' }],
  rituale: [{ ritualId: 'fr-1', terminUids: ['TERMIN-UID-INTERN'], angelegtAm: '2026-09-02' }],
  mitschriften: [{ id: 'fn-1', am: '2026-10-01', anlass: 'MITSCHRIFT-INTERN', ergebnis: 'x', naechster: 'y', von: 'person-intern' }],
  quickWins: [{ id: 'fq-1', text: 'QUICKWIN-INTERN', bis: '2026-10-30', quelle: 'analyse' }], kickoffFragen: [{ id: 'fx-1', frage: 'KICKOFF-INTERN', an: 'gruender', quelle: 'analyse' }],
  wertKonto: { z1: { ausgang: 'wenig', zielZahl: 10, festgelegtAm: '2026-09-02', messungen: [{ am: '2026-10-01', wert: 5, quelle: 'hand' }] } },
  befaehigung: [{ id: 'bf-1', text: 'BEFAEHIGUNG-INTERN', erfuellt: false }], wirkung: { erstelltAm: '2026-10-01', zitat: { text: 'ZITAT-INTERN', einwilligungAm: '2026-10-01', wie: 'mail' } },
  marken: { m: 'MARKE-INTERN' }, geaendert: '2026-10-01T00:00:00Z', geaendertVon: 'person-intern',
};
const EINGABE = (extra: Partial<SichtEingabe> = {}): SichtEingabe => ({
  modus: 'voll', heute: '2026-10-10',
  mandat: { id: 'm-1', titel: 'Mandat Eins', kunde: 'Erfundene Werke GmbH', ziele: [{ id: 'z1', text: 'Termine', ziel: '10', ist: '4' }], honorar: { betrag: 77777 }, health: { stimmung: 12 }, notiz: 'MANDAT-NOTIZ' } as never,
  paket: 'Paket Eins', fall: FALL,
  bausteine: [B('fb-ok'), B('fb-nurintern', { nur_intern: true }), B('fb-vorverkauf', { pruefen_vor_verkauf: true }), B('fb-urheber', { urheberPruefen: { seit: '2026-10-01', grund: 'x' } }), B('fb-intern-fuellt', { kundeFuellt: false })],
  rituale: [{ id: 'fr-1', titel: 'Wochen-Check', rhythmus: 'woche', dauerMin: 15, agenda: ['AGENDA-INTERN'], teilnehmende: ['intern'], geaendert: '', geaendertVon: '' }],
  kunde: { ...leerKunde(), formulare: [{ mandatId: 'm-1', bausteinId: 'fb-ok', fassung: 1, antworten: { q1: 'Antwort eins', 'q-fremd': 'ANTWORT-FREMDE-FRAGE' }, fertig: [], geaendertAm: '2026-10-05', quelle: 'kunde' }, { mandatId: 'm-2', bausteinId: 'fb-ok', fassung: 1, antworten: { q1: 'ANTWORT-ANDERES-MANDAT' }, fertig: [], geaendertAm: '2026-10-05', quelle: 'kunde' }],
    unterlagen: [{ id: 'ud-1', mandatId: 'm-1', name: 'DATEINAME-INTERN.pdf', typ: 'application/pdf', groesse: 1, am: '2026-10-01', herkunft: 'kunde', zweck: 'sonstig', status: 'ungeprueft' }] },
  rechte: { formular: true, upload: true, puls: true }, standVon: () => 'stand-1',
  datenschutz: kundeHinweis({ verantwortlich: 'Erfundene Firma, Musterweg 1, 12345 Musterstadt', seite: null, mandatsdatenMonate: 12, unterlagenTage: 90 }), uploadFrei: 19,
  ...extra,
});

/** Die erlaubten Pfade (tief) — eine neue Angabe auf der Kunden-Seite verlangt eine bewusste Änderung hier. */
const ERLAUBT = new Set([
  'modus', 'firma', 'mandat', 'paket', 'stand',
  'zeitstrahl', 'zeitstrahl[].titel', 'zeitstrahl[].stand', 'erledigt', 'naechstes', 'wartet', 'wartet[].titel', 'wartet[].seit',
  'wertKonto', 'wertKonto[].name', 'wertKonto[].vorher', 'wertKonto[].jetzt', 'wertKonto[].ziel', 'wertKonto[].bis', 'rituale', 'rituale[].titel', 'rituale[].rhythmus',
  'entscheidungen', 'entscheidungen[].titel', 'entscheidungen[].am', 'entscheidungen[].status', 'entscheidungen[].inhalt',
  'formulare', 'formulare[].schluessel', 'formulare[].titel', 'formulare[].zweck', 'formulare[].prozent', 'formulare[].stand', 'formulare[].antworten',
  'formulare[].abschnitte', 'formulare[].abschnitte[].schluessel', 'formulare[].abschnitte[].titel', 'formulare[].abschnitte[].fertig', 'formulare[].abschnitte[].fragen',
  'formulare[].abschnitte[].fragen[].id', 'formulare[].abschnitte[].fragen[].frage', 'formulare[].abschnitte[].fragen[].art', 'formulare[].abschnitte[].fragen[].optionen',
  'formulare[].abschnitte[].fragen[].pflicht', 'formulare[].abschnitte[].fragen[].hilfe',
  'upload', 'upload.erlaubt', 'upload.eingegangen', 'upload.frei', 'puls', 'puls.offen',
  'datenschutz', 'datenschutz.verantwortlich', 'datenschutz.seite', 'datenschutz.fassung', 'datenschutz.absaetze',
]);

describe('Kunden-Sicht: nur die Positivliste', () => {
  it('oberste Schlüssel ⊆ SICHT_SCHLUESSEL, tiefe Pfade ⊆ erlaubt — bei einem Fall voller interner Daten', () => {
    const s = kundenSicht(EINGABE());
    expect(Object.keys(s).every(k => (SICHT_SCHLUESSEL as readonly string[]).includes(k))).toBe(true);
    const pfade = schluesselPfade(s);
    expect(pfade.filter(p => !ERLAUBT.has(p))).toEqual([]);
  });
  it('kein interner Inhalt, keine Kennungen anderer Bestände, keine Dateiliste, nichts aus anderen Mandaten', () => {
    const text = JSON.stringify(kundenSicht(EINGABE()));
    for (const x of ['INTERN', 'STAKEHOLDER', 'skeptiker', 'kritisch', 'c-geheim', 'person-intern', '77777', 'stimmung', 'MANDAT-NOTIZ', 'fb-', 'fp-x', 'fk-', 'TERMIN-UID', 'DATEINAME', 'ANDERES-MANDAT', 'FREMDE-FRAGE', 'm-2', 'Hilfe-intern']) {
      expect(text, x).not.toContain(x);
    }
  });
  it('Inhalt: sichtbare Phasen, sichtbare offene Schritte, „wartet auf euch“, geteilte Entscheidungen, nur taugliche Formulare, Upload zählt', () => {
    const s = kundenSicht(EINGABE());
    expect(s.zeitstrahl).toEqual([{ titel: 'Phase sichtbar', stand: 'aktuell' }]);
    expect(s.erledigt).toEqual([]);
    expect(s.naechstes).toEqual(['Schritt sichtbar — bis 20.10.2026']);
    expect(s.wartet).toEqual([{ titel: 'Wartet', seit: '01.10.2026' }]);
    expect(s.entscheidungen).toEqual([{ titel: 'Geteilt', am: '02.10.2026', status: 'entschieden', inhalt: 'Inhalt geteilt' }]);
    expect(s.formulare.map(f => f.titel)).toEqual(['Formular ok']);
    expect(s.formulare[0].antworten).toEqual({ q1: 'Antwort eins' });
    expect(s.upload).toEqual({ erlaubt: true, eingegangen: 1, frei: 19 });
    expect(s.rituale).toEqual([{ titel: 'Wochen-Check', rhythmus: 'wöchentlich' }]);
  });
  it('Rechte aus → kein Formular, kein Upload, kein Puls; Puls-Modus zeigt nur Kopf, Puls und Hinweis', () => {
    const ohne = kundenSicht(EINGABE({ rechte: { formular: false, upload: false, puls: false } }));
    expect([ohne.formulare, ohne.upload, ohne.puls]).toEqual([[], null, null]);
    const p = kundenSicht(EINGABE({ modus: 'puls' }));
    expect(p).toMatchObject({ modus: 'puls', firma: 'Erfundene Werke GmbH', zeitstrahl: [], wartet: [], formulare: [], upload: null, puls: { offen: false } });
    expect(p.mandat).toBeUndefined();
  });
  it('Datenschutzhinweis: Verantwortlicher aus der Einrichtung, Fristen, Fassung; ohne Eintrag ein ehrlicher Satz', () => {
    const d = kundeHinweis({ verantwortlich: null, seite: 'https://example.invalid/datenschutz', mandatsdatenMonate: 12, unterlagenTage: 90 });
    expect(d.verantwortlich).toMatch(/noch nicht eingetragen/);
    expect(d.absaetze.join(' ')).toContain('12 Monate');
    expect(d.absaetze.join(' ')).toContain('90 Tage');
    expect(d.fassung).toBe('k1-12m-90t');
  });
});

describe('KundenAnsicht (dieselbe Komponente für Seite und Vorschau)', () => {
  it('rendert am Server, zeigt die Teile, in der Vorschau ohne Speichern und mit gesperrten Feldern', async () => {
    const { KundenAnsicht } = await import('@/components/os/fulfillment/kunde/KundenAnsicht');
    const s = kundenSicht(EINGABE());
    const html = renderToStaticMarkup(createElement(KundenAnsicht, { sicht: s, vorschau: true }));
    for (const x of ['Erfundene Werke GmbH', 'Wartet auf euch', 'Phase sichtbar', 'Wert-Konto', 'Formular ok', 'Unterlagen', 'Datenschutz', 'Vorschau']) expect(html, x).toContain(x);
    expect(html).not.toContain('Hochladen</');
    expect(html).not.toContain('INTERN');
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled/);
  });
});
