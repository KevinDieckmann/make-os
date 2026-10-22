// ─── Prozesse · Stellschrauben B (22.10.) — feste Code-Werte als Einstellungen: ohne Einstellung bit-gleich, mit Einstellung wirkt ─────────────────────────────
// Je ausführender Stelle zwei Prüfungen: (1) ohne Einstellung bzw. mit den Werten der Vorgabe rechnet sie GENAU wie vorher (dieselbe Ausgabe), (2) mit einer
// Einstellung wirkt der neue Wert. Dazu der Bestand `prozesse-stellschrauben--<h>` (nur Abweichungen, Grenzen, alles oder nichts), die Route (Rechte, Stand/409,
// Privat 403) und die Wertelisten-Stellschrauben der Markttraktion. Eigener Datenordner, erfundene Konten und Daten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Der Datenordner VOR allen Imports (lib/heads/takt.ts u. a. laden local-db beim Import).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-stellschrauben-b-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-stellschrauben-b', MAKE_OS_OHNE_APPLE: '1' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return o;
});
import {
  WERTE, HEAD_MODI, bestandAus, werteAendern, wert, headModusPlan, abschlussFenster, buchungHalteMin, buchungMailLinkTage, kapaSchwellen, reportTage, leererBestand,
} from '@/lib/prozesse/stellschrauben-werte';
import { CRM_STELLSCHRAUBEN, nachfassWerktage, qualiWiedervorlageTage, verschobenGelbAb } from '@/lib/crm/stellschrauben';
import { wertelistenPruefen, wertelistenVollstaendig } from '@/lib/crm/wertelisten';
import { faelligeModi } from '@/lib/heads/takt';
import { leererStand as headStand } from '@/lib/heads/stand';
import { faelligerModus, dritterWerktag, nterWerktag } from '@/lib/finanzen/chef/plan';
import { leererStand as chefStand } from '@/lib/finanzen/chef/stand';
import { followUpBis, nachfassenRest } from '@/lib/crm/events';
import { besuchFollowupFrist, besuchWirkung, followupQuoteDefinition, FOLLOWUP_QUOTE_DEFINITION, BESUCH_FOLLOWUP_TAGE } from '@/lib/crm/besuche';
import { followupFrist } from '@/lib/crm/netzwerken';
import { brauchtQualifizierung, ruheBis, leereKriterien, QUALI_WIEDERVORLAGE_TAGE, type LeadZeile } from '@/lib/crm/leads';
import { gesundheit, OFFENE_STUFEN, VERSCHOBEN_GELB } from '@/lib/crm/pipeline';
import { reservieren, hinweisFassung, datenschutzHinweis, HINWEIS_FRISTEN_STANDARD, LEER, RESERVIERT_MIN, MAIL_LINK_TAGE, type BuchungsSeite } from '@/lib/kalender/buchung';
import { kapazitaetRechnen } from '@/lib/kapazitaet/modell';
import { MACHBAR_BIS, ENG_BIS, type KapaEingabe, type PostenEingabe } from '@/lib/kapazitaet/typen';
import { kapaVergleich } from '@/lib/crm/planung';
import { reportNaechsterFaellig, reportFaellig, REPORT_TAGE } from '@/lib/crm/treppe';
import { reportAchse } from '@/lib/fulfillment/prozesse/ansichten';
import { werktagePlus } from '@/lib/zeit/kalender-kern';
import { wandAus, ausWandzeit, tagPlus } from '@/lib/kalender/zeit';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import type { Chance, Event, Teilnahme } from '@/lib/crm/typen';


/** Die Vorgaben als ausdrücklich gespeicherte Werte (müssen dasselbe ergeben wie „ohne Einstellung“). */
const VORGABEN = Object.fromEntries(WERTE.map(d => [d.id, d.vorgabe]));

describe('Bestand (rein): nur Abweichungen, Grenzen, alles oder nichts', () => {
  it('Kennungen eindeutig, jede gehört zu einem System-Prozess, Vorgabe in den Grenzen; jeder Head-Modus hat an/aus und Stunde', () => {
    expect(new Set(WERTE.map(d => d.id)).size).toBe(WERTE.length);
    const ids = new Set(SYSTEM_PROZESSE.map(p => p.id));
    for (const d of WERTE) {
      expect(ids.has(d.prozess), d.id).toBe(true);
      if (d.art !== 'schalter') expect((d.vorgabe as number) >= d.min! && (d.vorgabe as number) <= d.max!, d.id).toBe(true);
    }
    for (const m of HEAD_MODI) for (const k of ['an', 'stunde']) expect(WERTE.some(d => d.id === `head.${m.head}.${m.modus}.${k}`), `${m.modus}.${k}`).toBe(true);
  });
  it('Säuberer: unbekannte, ungültige und Vorgabe-Werte fallen weg; Kreuzfehler (machbar ≥ eng) gilt nie', () => {
    expect(bestandAus({ werte: { ...VORGABEN, 'gibt.es.nicht': 3, 'buchung.halteMin': 2, 'treppe.reportTage': 21 } }).werte).toEqual({ 'treppe.reportTage': 21 });
    expect(bestandAus({ werte: { 'kapa.machbarBis': 95, 'kapa.engBis': 90 } }).werte).toEqual({});
    expect(bestandAus(null)).toEqual(leererBestand());
  });
  it('ändern: 404 unbekannt, 400 ungültig/Kreuz, 413 zu viele — dann nichts; Vorgabe bzw. null = nicht gespeichert', () => {
    const k = { person: 'pia', jetzt: '2026-10-22T09:00:00.000Z' };
    expect(werteAendern(leererBestand(), [{ id: 'x.y', wert: 1 }], k)).toMatchObject({ ok: false, status: 404 });
    expect(werteAendern(leererBestand(), [{ id: 'buchung.halteMin', wert: 1000 }], k)).toMatchObject({ ok: false, status: 400 });
    expect(werteAendern(leererBestand(), [{ id: 'head.sales.wochenreview.an', wert: 'ja' }], k)).toMatchObject({ ok: false, status: 400 });
    expect(werteAendern(leererBestand(), [{ id: 'kapa.machbarBis', wert: 95 }], k)).toMatchObject({ ok: false, status: 400 });
    expect(werteAendern(leererBestand(), Array.from({ length: 61 }, () => ({ id: 'buchung.halteMin', wert: 40 })), k)).toMatchObject({ ok: false, status: 413 });
    const a = werteAendern(leererBestand(), [{ id: 'buchung.halteMin', wert: 45 }, { id: 'treppe.reportTage', wert: 14 }], k);
    expect(a).toMatchObject({ ok: true, geaendert: ['buchung.halteMin'] });
    if (!a.ok) return;
    expect(a.bestand.werte).toEqual({ 'buchung.halteMin': 45 });
    const b = werteAendern(a.bestand, [{ id: 'buchung.halteMin', wert: null }], k);
    expect(b.ok && b.bestand.werte).toEqual({});
  });
  it('jede Lesefunktion: ohne Bestand = die Vorgabe des Codes', () => {
    expect(abschlussFenster({})).toEqual({ abWerktag: 3, bisTag: 20 });
    expect(buchungHalteMin(undefined)).toBe(RESERVIERT_MIN);
    expect(buchungMailLinkTage(null)).toBe(MAIL_LINK_TAGE);
    expect(kapaSchwellen({})).toEqual({ machbarBis: MACHBAR_BIS, engBis: ENG_BIS });
    expect(reportTage({})).toBe(REPORT_TAGE);
    expect(headModusPlan({}, 'sales', 'wochenreview')).toEqual({ an: true, stunde: 14, wochentag: 5 });
    expect(() => wert({}, 'gibt.es.nicht')).toThrow();
  });
});

// ── Heads: Uhrzeit, Wochentag, an/aus je Modus ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Woche Stunde für Stunde durchspielen (Mo 05.10. – So 11.10., Berliner Zeit) — wie der Takt: höchstens ein Lauf, der Riegel `letzte` wird gesetzt. */
function woche(head: 'sales' | 'marketing' | 'event', modi?: Record<string, number | boolean>, events: { datum: string; status: string }[] = []): string[] {
  const s = headStand();
  const raus: string[] = [];
  for (let t = 0; t < 7; t++) for (let h = 0; h < 24; h++) {
    const tag = tagPlus('2026-10-05', t);
    const jetzt = ausWandzeit(wandAus(tag, h * 60 + 5));
    for (const m of faelligeModi(head, jetzt, s, events, ['person-a'], undefined, modi ? { modi } : {})) {
      raus.push(`${tag} ${h}h ${m.modus}`);
      s.letzte[m.person ? `${m.modus}:${m.person}` : m.modus] = jetzt.toISOString();
    }
  }
  return raus;
}

describe('Heads-Takt (lib/heads/takt.ts `faelligeModi`)', () => {
  const ev = [{ datum: '2026-10-06', status: 'durchgefuehrt' }, { datum: '2026-10-10', status: 'geplant' }];
  it('ohne Einstellung bit-gleich: dieselben Läufe zu denselben Stunden — auch mit den Vorgaben ausdrücklich gespeichert', () => {
    for (const head of ['sales', 'marketing', 'event'] as const) {
      const ohne = woche(head, undefined, ev);
      expect(ohne.length, head).toBeGreaterThan(0);
      expect(woche(head, {}, ev)).toEqual(ohne);
      expect(woche(head, VORGABEN, ev)).toEqual(ohne);
    }
    expect(woche('sales')).toContain('2026-10-09 14h wochenreview');
    expect(woche('sales')).toContain('2026-10-05 7h power_hour');
  });
  it('mit Einstellung wirkt: anderer Wochentag und Stunde, Modus aus, spätere Stunde', () => {
    const s = woche('sales', { 'head.sales.wochenreview.wochentag': 4, 'head.sales.wochenreview.stunde': 16, 'head.sales.power_hour.an': false });
    expect(s).toContain('2026-10-08 16h wochenreview');
    expect(s.some(x => x.includes('2026-10-09') && x.endsWith('wochenreview'))).toBe(false);
    expect(s.some(x => x.endsWith('power_hour'))).toBe(false);
    const m = woche('marketing', { 'head.marketing.netzwerk.stunde': 11 });
    expect(m.filter(x => x.endsWith('netzwerk')).every(x => x.includes(' 11h '))).toBe(true);
    expect(woche('event', { 'head.event.nachfassen.an': false }, ev).some(x => x.endsWith('nachfassen'))).toBe(false);
  });
});

// ── Head of Finance: Fenster des Monatsabschlusses ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('Monatsabschluss (lib/finanzen/chef/plan.ts `faelligerModus`)', () => {
  const lauf = (heute: string, fenster?: { abWerktag: number; bisTag: number }) => faelligerModus(chefStand(), heute, 3, 10, [], ausWandzeit(`${heute}T10:00:00`), fenster)?.modus ?? null;
  it('ohne Einstellung bit-gleich (ab dem 3. Werktag bis zum 20.) — jeder Tag des Monats', () => {
    expect(nterWerktag('2026-10', 3)).toBe(dritterWerktag('2026-10'));
    for (let d = 1; d <= 31; d++) {
      const tag = `2026-10-${String(d).padStart(2, '0')}`;
      expect(lauf(tag, abschlussFenster({})), tag).toBe(lauf(tag));
    }
    expect(lauf('2026-10-05')).toBe('monatsabschluss');
    expect(lauf('2026-10-21')).not.toBe('monatsabschluss');
  });
  it('mit Einstellung wirkt: ab dem 1. Werktag bis zum 10.', () => {
    const f = abschlussFenster({ 'abschluss.abWerktag': 1, 'abschluss.bisTag': 10 });
    expect(lauf('2026-10-01', f)).toBe('monatsabschluss');
    expect(lauf('2026-10-01')).not.toBe('monatsabschluss');
    expect(lauf('2026-10-12', f)).not.toBe('monatsabschluss');
  });
});

// ── Markttraktion: Nachfassfrist (EIN Wert für drei Stellen), Wiedervorlage, Deal-Ampel ────────────────────────────────────────────────────────────

describe('Nachfassen nach einem Event — EIN Wert für eigene Abende, besuchte Events und die Erfassung', () => {
  const w4 = { stellschrauben: { nachfassWerktage: 4 } };
  it('ohne Einstellung bit-gleich: zwei Werktage überall, derselbe Text', () => {
    for (const datum of ['2026-10-02', '2026-10-05', '2026-12-24']) {
      expect(followUpBis({ datum })).toBe(werktagePlus(datum, 2));
      expect(followUpBis({ datum }, {})).toBe(followUpBis({ datum }));
      expect(besuchFollowupFrist(datum)).toBe(followUpBis({ datum }));
      expect(followupFrist(datum)).toBe(followUpBis({ datum }));
    }
    expect(BESUCH_FOLLOWUP_TAGE).toBe(2);
    expect(followupQuoteDefinition()).toBe(FOLLOWUP_QUOTE_DEFINITION);
    expect(nachfassenRest({ datum: '2026-10-05' }, Date.parse('2026-10-05T10:00:00Z'), {})).toBe(nachfassenRest({ datum: '2026-10-05' }, Date.parse('2026-10-05T10:00:00Z')));
  });
  it('mit Einstellung wirkt an allen drei Stellen gleich', () => {
    const t = nachfassWerktage(w4);
    expect(t).toBe(4);
    expect(followUpBis({ datum: '2026-10-05' }, w4)).toBe(werktagePlus('2026-10-05', 4));
    expect(besuchFollowupFrist('2026-10-05', t)).toBe(followUpBis({ datum: '2026-10-05' }, w4));
    expect(followupFrist('2026-10-05', t)).toBe(followUpBis({ datum: '2026-10-05' }, w4));
    expect(followupQuoteDefinition(t)).toContain('4 Werktagen');
    // Follow-up-Quote eines besuchten Events: am 4. Werktag nachgefasst zählt erst mit der Einstellung als rechtzeitig.
    const e = { id: 'ev-1', titel: 'Messe', datum: '2026-10-05', status: 'durchgefuehrt', marke: 'Netzwerken' } as unknown as Event;
    const t1 = { id: 't-1', eventId: 'ev-1', kontaktId: 'c-1', status: 'da', followUpAm: werktagePlus('2026-10-05', 4) } as unknown as Teilnahme;
    const ctx = { teilnahmen: [t1], kontakte: [], chancen: [], heute: '2026-10-20' };
    expect(besuchWirkung(e, ctx).nachgefasst).toBe(0);
    expect(besuchWirkung(e, { ...ctx, nachfassWerktage: 4 }).nachgefasst).toBe(1);
  });
});

describe('Wiedervorlage in der Qualifizierung (lib/crm/leads.ts)', () => {
  const zeile = (o: Partial<LeadZeile>): LeadZeile => ({
    id: 'c-x', art: 'person', name: 'X', personen: [], status: 'neu', gesetzt: false, kriterien: leereKriterien(), besitzer: 'pia', ohneBesitzer: false, bean: 'N',
    score: { punkte: 40, temperatur: 'lau', teile: [] }, kanal: 'bestand', ...o,
  } as LeadZeile);
  it('ohne Einstellung bit-gleich (60 Tage), mit Einstellung wirkt', () => {
    const z = zeile({ geprueftAm: '2026-08-10' } as Partial<LeadZeile>);
    const heute = '2026-10-15'; // 66 Tage nach der Prüfung
    expect(brauchtQualifizierung(z, heute)).toBe(brauchtQualifizierung(z, heute, QUALI_WIEDERVORLAGE_TAGE));
    expect(brauchtQualifizierung(z, heute, qualiWiedervorlageTage({}))).toBe(true);
    expect(brauchtQualifizierung(z, heute, qualiWiedervorlageTage({ stellschrauben: { qualiWiedervorlageTage: 90 } }))).toBe(false);
    expect(ruheBis(z)).toBe('2026-10-09');
    expect(ruheBis(z, 90)).toBe('2026-11-08');
  });
});

describe('Deal-Ampel gelb ab Verschiebungen (lib/crm/pipeline.ts `gesundheit`)', () => {
  const deal = (x: Partial<Chance> = {}): Chance => ({
    id: 'ch-1', titel: 'Beispiel AG · Retainer', kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: OFFENE_STUFEN[0],
    historie: [{ stufe: OFFENE_STUFEN[0], am: '2026-09-01T09:00:00.000Z', von: 'pia' }], naechsterSchritt: { text: 'Angebot schicken', datum: '2026-10-05' },
    qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
    gesellschaft: 'offen', besitzer: 'pia', angelegt: '2026-09-01T09:00:00.000Z', geaendert: '2026-09-01T09:00:00.000Z', letzteAktivitaet: '2026-09-27', ...x,
  } as Chance);
  it('ohne Einstellung bit-gleich (ab 2), mit Einstellung wirkt (ab 3)', () => {
    const c = deal({ erwartetVerschoben: 2, erwartetUrsprung: '2026-10-01' });
    expect(gesundheit(c, '2026-09-28')).toEqual(gesundheit(c, '2026-09-28', {}));
    expect(gesundheit(c, '2026-09-28').ampel).toBe('gelb');
    expect(VERSCHOBEN_GELB).toBe(verschobenGelbAb({}));
    expect(gesundheit(c, '2026-09-28', { stellschrauben: { verschobenGelb: 3 } }).ampel).toBe('gruen');
  });
});

describe('Wertelisten: Stellschrauben der Markttraktion prüfen (Schreibweg /api/crm/stammdaten)', () => {
  it('Grenzen, Vorgabe nicht gespeichert, null = zurück; die volle Sicht nennt die wirksamen Werte', () => {
    expect(wertelistenPruefen({ stellschrauben: { nachfassWerktage: 0 } }, {}).ok).toBe(false);
    expect(wertelistenPruefen({ stellschrauben: { gibtsnicht: 3 } }, {}).ok).toBe(false);
    const a = wertelistenPruefen({ stellschrauben: { nachfassWerktage: 3, verschobenGelb: 2 } }, {});
    expect(a.ok && a.wertelisten.stellschrauben).toEqual({ nachfassWerktage: 3 });
    const b = wertelistenPruefen({ stellschrauben: { nachfassWerktage: null } }, a.wertelisten);
    expect(b.ok && b.wertelisten.stellschrauben).toBeUndefined();
    expect(wertelistenVollstaendig(a.wertelisten).stellschrauben).toEqual(Object.fromEntries(CRM_STELLSCHRAUBEN.map(d => [d.id, d.id === 'nachfassWerktage' ? 3 : d.vorgabe])));
  });
});

// ── Buchung: Haltezeit und Mail-Link ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Buchung (lib/kalender/buchung.ts)', () => {
  const JETZT = new Date('2026-10-05T06:00:00Z'); // Mo 08:00 Berlin
  const SEITE: BuchungsSeite = {
    id: 'bs-test-seite-1', slug: '30-min-mit-test-0123456789abcdef01234567', titel: '30 min mit Test', dauerMin: 30, person: 'pia',
    fenster: [{ tage: [1, 2, 3, 4, 5], von: '10:00', bis: '12:00' }], tageVoraus: 3, vorlaufMin: 60, maxJeTag: 3, pufferMin: 0, rasterMin: 30,
    zielKalender: 'Testkalender', ort: 'Videolink folgt', fragen: { firma: true, anliegen: true }, verantwortlich: 'Test GmbH, test@example.invalid', aktiv: true,
    angelegt: '2026-09-29T10:00:00Z', geaendert: '2026-09-29T10:00:00Z',
  };
  const EIN = { start: '2026-10-05T10:00:00', name: 'Testa Gast', email: 'testa@example.invalid', einwilligung: true as const };
  const ctx = { id: 'bu-test-1', tokenHash: 'a'.repeat(64), jetzt: JETZT, heute: '2026-10-05' };
  it('Haltezeit: ohne Einstellung bit-gleich (30 Minuten), mit Einstellung wirkt', () => {
    const a = reservieren({ ...LEER, seiten: [SEITE] }, SEITE.id, EIN, [], {}, ctx);
    const b = reservieren({ ...LEER, seiten: [SEITE] }, SEITE.id, EIN, [], {}, { ...ctx, halteMin: buchungHalteMin({}) });
    expect(a).toEqual(b);
    const c = reservieren({ ...LEER, seiten: [SEITE] }, SEITE.id, EIN, [], {}, { ...ctx, halteMin: 90 });
    expect(a.ok && c.ok && Date.parse(c.buchung.reserviertBis!) - Date.parse(a.buchung.reserviertBis!)).toBe(60 * 60_000);
  });
  it('Mail-Link: Hinweis und Fassung ohne Einstellung bit-gleich; mit Einstellung nennt der Hinweis den Wert und es gibt eine neue Fassung', () => {
    expect(hinweisFassung({ ...HINWEIS_FRISTEN_STANDARD, mailLinkTage: MAIL_LINK_TAGE })).toBe(hinweisFassung(HINWEIS_FRISTEN_STANDARD));
    expect(datenschutzHinweis({ ...HINWEIS_FRISTEN_STANDARD, mailLinkTage: 7 })).toEqual(datenschutzHinweis(HINWEIS_FRISTEN_STANDARD));
    expect(hinweisFassung({ ...HINWEIS_FRISTEN_STANDARD, mailLinkTage: 14 })).toBe(`${hinweisFassung(HINWEIS_FRISTEN_STANDARD)}-m14`);
    expect(datenschutzHinweis({ ...HINWEIS_FRISTEN_STANDARD, mailLinkTage: 14 }).join(' ')).toContain('gilt 14 Tage und nur einmal');
  });
});

// ── Kapazität: Schwellen machbar / eng ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Kapazität (lib/kapazitaet/modell.ts, lib/crm/planung.ts `kapaVergleich`)', () => {
  const ms = (id: string, x: Partial<PostenEingabe> = {}): PostenEingabe => ({ art: 'meilenstein', id, titel: `MS ${id}`, termin: '2026-10-16', fortschritt: 0, erledigt: false, ...x });
  const rechne = (x: Partial<KapaEingabe> = {}) => kapazitaetRechnen({ heute: '2026-10-05', wochen: 12, personen: [{ id: 'konto-a', name: 'Probe', quelle: 'konto' }], datei: { personen: { 'konto-a': { stundenWoche: 40 } }, zuweisungen: [] }, posten: [ms('klein', { aufwand: 40 })], ...x });
  it('ohne Einstellung bit-gleich — dieselbe Ausgabe, kein Feld „schwellen“; mit den Werten der Vorgabe ebenso', () => {
    const ohne = rechne();
    expect(JSON.stringify(rechne({ schwellen: kapaSchwellen({}) }))).toBe(JSON.stringify(ohne));
    expect(ohne.schwellen).toBeUndefined();
    expect(kapaVergleich([{ person: 'pia', stunden: 8 } as never], { pia: 10 })).toEqual(kapaVergleich([{ person: 'pia', stunden: 8 } as never], { pia: 10 }, kapaSchwellen({})));
  });
  it('mit Einstellung wirkt: strengere Schwelle macht „machbar“ zu „eng“; die Ausgabe nennt die Schwellen', () => {
    const s = rechne({ schwellen: kapaSchwellen({ 'kapa.machbarBis': 40, 'kapa.engBis': 95 }) });
    expect(s.posten.find(p => p.id === 'klein')!.status).toBe('eng');
    expect(s.schwellen).toEqual({ machbarBis: 0.4, engBis: 0.95 });
    expect(rechne().posten.find(p => p.id === 'klein')!.status).toBe('machbar');
    expect(kapaVergleich([{ person: 'pia', stunden: 8 } as never], { pia: 10 }, { machbarBis: 0.9, engBis: 1 })[0].status).toBe('machbar');
    expect(kapaVergleich([{ person: 'pia', stunden: 8 } as never], { pia: 10 })[0].status).toBe('eng');
  });
});

// ── Leistungstreppe: Abstand der Fortschritts-Reports ──────────────────────────────────────────────────────────────────────────────────────────────

describe('Report-Abstand (lib/crm/treppe.ts, lib/fulfillment/prozesse/ansichten.ts)', () => {
  it('ohne Einstellung bit-gleich (14 Tage) — Treppe, Fälligkeit und Zeitachse', () => {
    expect(reportNaechsterFaellig('2026-09-01', '2026-10-01')).toBe(reportNaechsterFaellig('2026-09-01', '2026-10-01', reportTage({})));
    const m = { status: 'aktiv' as const, start: '2026-09-01' };
    expect(reportFaellig(m, { erstelltAm: '2026-10-01' } as never, '2026-10-15')).toEqual(reportFaellig(m, { erstelltAm: '2026-10-01' } as never, '2026-10-15', REPORT_TAGE));
    const e = { start: '2026-09-01', heute: '2026-10-20', reports: [{ am: '2026-09-20' }, { am: '2026-10-05' }] };
    expect(reportAchse({ ...e, reportTage: 14 })).toEqual(reportAchse(e));
  });
  it('mit Einstellung wirkt: alle 21 Tage', () => {
    expect(reportNaechsterFaellig('2026-09-01', '2026-10-01', 21)).toBe('2026-10-22');
    const m = { status: 'aktiv' as const, start: '2026-09-01' };
    expect(reportFaellig(m, { erstelltAm: '2026-10-01' } as never, '2026-10-16').faellig).toBe(true);
    expect(reportFaellig(m, { erstelltAm: '2026-10-01' } as never, '2026-10-16', 21).faellig).toBe(false);
    const a = reportAchse({ start: '2026-09-01', heute: '2026-10-20', reports: [{ am: '2026-10-05' }], reportTage: 21 });
    expect(a.naechsterFaellig).toBe('2026-10-26');
    expect(a.takt[0].tag).toBe('2026-09-22');
  });
});

// ── Route: lesen, schreiben, Rechte, Stand; die ausführenden Stellen lesen den Wert ─────────────────────────────────────────────────────────────────

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json', ...(person ? { 'x-make-person': person } : {}) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
async function hole(kopf: Record<string, string>, suche = '?space=business'): Promise<{ status: number; j: J }> {
  const { GET } = await import('@/app/api/prozesse/stellschrauben/route');
  const r = await GET(new Request(`http://test/api/prozesse/stellschrauben${suche}`, { headers: kopf }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
async function sende(kopf: Record<string, string>, koerper: unknown, suche = '?space=business'): Promise<{ status: number; j: J }> {
  const { POST } = await import('@/app/api/prozesse/stellschrauben/route');
  const r = await POST(new Request(`http://test/api/prozesse/stellschrauben${suche}`, { method: 'POST', headers: kopf, body: JSON.stringify(koerper) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-sb' }),
    konto('k2', 'partnerin', 'mitglied', { haushalt: 'haus-sb', finanzRecht: 'business' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route /api/prozesse/stellschrauben', () => {
  it('lesen: ohne Bestand die Vorgaben; Sicht Privat, fremder Haushalt → 403', async () => {
    const r = await hole(sitzung('partnerin'));
    expect(r.status).toBe(200);
    expect(r.j.gespeichert).toEqual({});
    expect(r.j.wirksam['buchung.halteMin']).toBe(30);
    expect((await hole(sitzung('pia'), '?space=privat')).status).toBe(403);
    expect((await hole(sitzung('gast'))).status).toBe(403);
  });
  it('schreiben nur volle Mitglieder per Sitzung; Stand/409, 404, 400 — nichts gespeichert; danach lesen die ausführenden Stellen den Wert', async () => {
    const s0 = (await hole(sitzung('pia'))).j.stand;
    const ops = [{ id: 'treppe.reportTage', wert: 21 }];
    for (const k of [sitzung('partnerin'), dienst('pia'), sitzung('gast')]) expect((await sende(k, { stand: s0, ops })).status).toBe(403);
    expect((await sende(sitzung('pia'), { stand: s0, ops }, '?space=privat')).status).toBe(403);
    expect((await sende(sitzung('pia'), { stand: s0, ops: [{ id: 'gibt.es.nicht', wert: 1 }] })).status).toBe(404);
    expect((await sende(sitzung('pia'), { stand: s0, ops: [{ id: 'treppe.reportTage', wert: 2 }] })).status).toBe(400);
    const db = await import('@/lib/store/local-db');
    expect(await db.loadJson('prozesse-stellschrauben--haus-sb')).toBeNull();
    const a = await sende(sitzung('pia'), { stand: s0, ops: [...ops, { id: 'head.sales.wochenreview.an', wert: false }] });
    expect(a.status).toBe(200);
    expect(a.j.gespeichert).toEqual({ 'treppe.reportTage': 21, 'head.sales.wochenreview.an': false });
    // veralteter Stand → 409 mit der aktuellen Fassung
    const k = await sende(sitzung('pia'), { stand: s0, ops: [{ id: 'buchung.halteMin', wert: 45 }] });
    expect(k.status).toBe(409);
    expect(k.j.gespeichert['treppe.reportTage']).toBe(21);
    // Die ausführenden Stellen lesen über die EINE Lesefunktion.
    const { stellschraubenWerte, reportTageWirksam } = await import('@/lib/prozesse/stellschrauben-werte-server');
    expect(await reportTageWirksam()).toBe(21);
    expect(headModusPlan(await stellschraubenWerte(), 'sales', 'wochenreview').an).toBe(false);
    // Zurück auf die Vorgabe: nichts mehr gespeichert.
    const z = await sende(sitzung('pia'), { stand: a.j.stand, ops: [{ id: 'treppe.reportTage', wert: null }, { id: 'head.sales.wochenreview.an', wert: true }] });
    expect(z.status).toBe(200);
    expect(z.j.gespeichert).toEqual({});
    expect(await reportTageWirksam()).toBe(14);
  });
  it('die Landkarte zeigt die neuen Stellschrauben mit Wert, Weg und Stand; Rechte: nur volle Mitglieder dürfen sie ändern', async () => {
    const s = (await hole(sitzung('pia'))).j.stand;
    expect((await sende(sitzung('pia'), { stand: s, ops: [{ id: 'buchung.mailLinkTage', wert: 10 }] })).status).toBe(200);
    const { GET } = await import('@/app/api/prozesse/landkarte/route');
    const r = await GET(new Request('http://test/api/prozesse/landkarte?space=business', { headers: sitzung('pia') }));
    const j = await r.json() as J;
    const p = (id: string) => (j.prozesse as J[]).find(x => x.id === id)!;
    expect(p('sp-buchung').stellschrauben.find((x: J) => x.id === 'buchung.mailLinkTage')).toMatchObject({ wert: 10, vorgabe: 7, weg: { art: 'prozesse', id: 'buchung.mailLinkTage' } });
    expect(p('sp-head-takt').stellschrauben.filter((x: J) => x.weg?.art === 'prozesse').length).toBe(WERTE.filter(d => d.prozess === 'sp-head-takt').length);
    expect(p('sp-vertriebsplanung').stellschrauben.some((x: J) => x.id === 'kapa.machbarBis')).toBe(true);
    expect(p('sp-event-nachfassen').stellschrauben.find((x: J) => x.id === 'crm-nachfassWerktage')).toMatchObject({ wert: 2, weg: { art: 'wertelisten', feld: 'stellschrauben' } });
    expect(j.stellschraubenStand).toBe((await hole(sitzung('pia'))).j.stand);
    expect(j.stellschraubenRechte.prozesse).toBe(true);
    const r2 = await GET(new Request('http://test/api/prozesse/landkarte?space=business', { headers: sitzung('partnerin') }));
    expect(((await r2.json()) as J).stellschraubenRechte.prozesse).toBe(false);
    // Der Hinweis der Buchungsseite nennt den neuen Wert (EINE Quelle).
    const { hinweisFristenLaden } = await import('@/lib/kalender/buchung-speicher');
    expect((await hinweisFristenLaden()).mailLinkTage).toBe(10);
  });
  it('Konto löschen tilgt den Speichernamen („[gelöscht]“), die Werte bleiben', async () => {
    const { stellschraubenKontoLoeschen, stellschraubenLesen } = await import('@/lib/prozesse/stellschrauben-werte-server');
    expect(await stellschraubenKontoLoeschen('haus-sb', 'pia')).toBe(1);
    const b = await stellschraubenLesen('haus-sb');
    expect(b.geaendertVon).toBe('[gelöscht]');
    expect(b.werte['buchung.mailLinkTage']).toBe(10);
  });
});
