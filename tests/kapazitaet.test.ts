// ─── Kapazität (04.10.): Machbarkeit, Kopf & Energie, Rechte, Säule im Business-Index, alte Daten ─
// Rein, erfundene Personen und Zahlen — keine echten Daten.
import { describe, it, expect, vi } from 'vitest';
// 05.10.: Die Index-Fälle unten rechnen mit der Selbstständigkeit als Business-Firma (Grundlage = Consulting) — gültige Instanz-Einstellung
// (`NEXT_PUBLIC_MAKE_OS_EINHEITEN` `{"kdc":{"bereich":"business"}}`); unsere Instanz: tests/selbst-privat.test.ts.
vi.hoisted(() => { process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { bereich: 'business' } }); });
import { kapazitaetRechnen, tageAusVerfuegbarkeit, fuerBetrachter, zielMachbarkeit, erholungFaktor } from '@/lib/kapazitaet/modell';
import { lastJeWoche, engpassWochen } from '@/lib/kapazitaet/last';
import { kapaAendern, sauberKapaDatei } from '@/lib/kapazitaet/aendern';
import type { KapaDatei, KapaEingabe, PersonEingabe, PostenEingabe, TagEingabe } from '@/lib/kapazitaet/typen';
import { sauberMeilenstein } from '@/lib/planung/meilensteine';
import { sauberZiel } from '@/lib/planung/ziele';
import { meilensteineAbleiten } from '@/lib/planung/kaskade';
import { berechne } from '@/lib/business/index';
import { MESSEN, type Bestand } from '@/lib/business/messen';
import { SAEULEN, SAEULEN_TEXT, KENNZAHLEN, kennzahlenFuer } from '@/lib/business/register';
import { berechneModell } from '@/lib/kennzahlen/kern';

const HEUTE = '2026-10-05'; // Montag
const A: PersonEingabe = { id: 'konto-a', name: 'Anna', quelle: 'konto' };
const B: PersonEingabe = { id: 'konto-b', name: 'Bert', quelle: 'konto' };
const datei = (x: Partial<KapaDatei> = {}): KapaDatei => ({ personen: { 'konto-a': { stundenWoche: 40 } }, zuweisungen: [], ...x });
const ms = (id: string, x: Partial<PostenEingabe> = {}): PostenEingabe => ({ art: 'meilenstein', id, titel: `MS ${id}`, termin: '2026-10-16', fortschritt: 0, erledigt: false, ...x });
const rechne = (x: Partial<KapaEingabe> = {}) => kapazitaetRechnen({ heute: HEUTE, wochen: 12, personen: [A], datei: datei(), posten: [], ...x });
const posten = (st: ReturnType<typeof rechne>, id: string) => st.posten.find(p => p.id === id)!;

describe('Machbarkeit je Meilenstein', () => {
  it('der „30 h/Tag“-Fall: 300 h in zwei Wochen für eine Person mit 40 h → nicht machbar, bräuchte 30 h/Tag', () => {
    const p = posten(rechne({ posten: [ms('gross', { aufwand: 300, personen: ['konto-a'] })] }), 'gross');
    expect(p.status).toBe('nicht-machbar');
    expect(p.arbeitstage).toBe(10);
    expect(p.braeuchteStdTag).toBe(30);
    expect(p.freiStdTag).toBe(8);
    expect(p.text).toContain('bräuchte 30 h/Tag');
    expect(p.text).toContain('mehr, als ein Tag Stunden hat');
  });
  it('machbar bis 70 % der freien Zeit, eng bis 90 %, darüber nicht machbar (Kevin 04.10.)', () => {
    const st = rechne({ posten: [ms('klein', { aufwand: 40 })] });
    expect(posten(st, 'klein')).toMatchObject({ status: 'machbar', braeuchteStdTag: 4, freiStdTag: 8 });
    expect(posten(rechne({ posten: [ms('mittel', { aufwand: 70 })] }), 'mittel').status).toBe('eng');
    expect(posten(rechne({ posten: [ms('voll', { aufwand: 73 })] }), 'voll').status).toBe('nicht-machbar');
  });
  it('Rest = Aufwand × (1 − Fortschritt): 100 h zu 60 % fertig → 40 h Rest → machbar', () => {
    expect(posten(rechne({ posten: [ms('halb', { aufwand: 100, fortschritt: 60 })] }), 'halb')).toMatchObject({ rest: 40, status: 'machbar' });
  });
  it('ohne Aufwand „Aufwand fehlt“, ohne Termin „Termin fehlt“ — nie geraten; Erledigtes zählt nicht', () => {
    const st = rechne({ posten: [ms('ohne'), ms('frei', { aufwand: 10, termin: undefined }), ms('fertig', { aufwand: 10, erledigt: true, fortschritt: 100 })] });
    expect(posten(st, 'ohne').status).toBe('aufwand-fehlt');
    expect(posten(st, 'frei').status).toBe('termin-fehlt');
    expect(posten(st, 'fertig').status).toBe('erledigt');
    expect(st.kennzahlen.machbarAnteil).toBeNull();
    expect(st.kennzahlen.last4).toBeNull();
  });
  it('„nicht schon verplante Kapa“: was früher dran ist (Rang), nimmt die Zeit — der zweite wird nicht machbar', () => {
    const st = rechne({ posten: [ms('zwei', { aufwand: 50, rang: 2 }), ms('eins', { aufwand: 50, rang: 1 })] });
    expect(posten(st, 'eins').status).toBe('machbar');
    expect(posten(st, 'zwei').status).toBe('nicht-machbar');
    expect(posten(st, 'zwei').frei).toBe(30);
  });
  it('überfällig: Status ehrlich, der Rest liegt sofort als Last in der Woche', () => {
    const st = rechne({ posten: [ms('alt', { aufwand: 20, termin: '2026-10-01' })] });
    expect(posten(st, 'alt').status).toBe('ueberfaellig');
    expect(st.team.wochen[0].bedarf).toBe(20);
  });
  it('Ziel: der schlechteste Status aus eigenem Aufwand und seinen Meilensteinen', () => {
    const st = rechne({ posten: [ms('m-z', { aufwand: 300, zielId: 'z1' }), { art: 'ziel', id: 'z1', titel: 'Ziel', termin: '2026-12-31', aufwand: 5, fortschritt: 0, erledigt: false }] });
    expect(zielMachbarkeit(st, 'z1')?.status).toBe('nicht-machbar');
    expect(zielMachbarkeit(st, 'gibtsnicht')).toBeNull();
  });
});

describe('Verfügbare Kapa: Grundwert, Urlaub, Blöcke, Termine, Zuweisungen', () => {
  it('Urlaub nimmt die Tage ganz heraus', () => {
    const st = rechne({ datei: datei({ personen: { 'konto-a': { stundenWoche: 40, ausnahmen: [{ id: 'u', art: 'urlaub', von: '2026-10-05', bis: '2026-10-09', titel: 'Erfundene Reise' }] } } }), posten: [ms('x', { aufwand: 40 })] });
    expect(st.personen[0].wochen[0]).toMatchObject({ abwesend: 40, netto: 0 });
    expect(posten(st, 'x')).toMatchObject({ status: 'nicht-machbar', arbeitstage: 5, braeuchteStdTag: 8 });
  });
  it('fester Block und Zuweisung (Mandat, h/Woche) binden Zeit', () => {
    const st = rechne({ datei: datei({
      personen: { 'konto-a': { stundenWoche: 40, ausnahmen: [{ id: 'b', art: 'block', von: '2026-10-01', stundenWoche: 5 }] } },
      zuweisungen: [{ id: 'z', person: 'konto-a', art: 'mandat', bezugId: 'm-1', stundenWoche: 15 }],
    }), posten: [ms('x', { aufwand: 35 })], bezugNamen: { 'm-1': 'Beispiel GmbH · Beratung' } });
    expect(st.personen[0].wochen[0]).toMatchObject({ bloecke: 5, netto: 35, gebunden: 15 });
    expect(posten(st, 'x').frei).toBe(40);
    expect(posten(st, 'x').status).toBe('eng');
    expect(st.zuweisungen[0].label).toBe('Beispiel GmbH · Beratung');
  });
  it('Termine und Umschalten (15 min je Termin) aus dem Kalender', () => {
    const tage: TagEingabe[] = Array.from({ length: 14 }, (_, i) => {
      const tag = new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10);
      return { tag, vorlageStunden: null, frei: false, terminStunden: 4, terminAnzahl: 2 };
    });
    const st = kapazitaetRechnen({ heute: HEUTE, wochen: 4, personen: [{ ...A, tage, hatVorlage: false }], datei: { personen: {}, zuweisungen: [] }, posten: [ms('x', { aufwand: 30 })] });
    expect(st.personen[0]).toMatchObject({ grundwert: 40, grundwertQuelle: 'annahme' });
    expect(st.personen[0].wochen[0]).toMatchObject({ termine: 20, umschalten: 2.5, netto: 17.5, termineAnzahl: 10 });
    expect(posten(st, 'x').status).toBe('eng');
  });
  it('Wochenvorlage als Grundwert; Kalender-Termine werden überlappungsfrei und im Arbeitsfenster gezählt, Fokus nicht', () => {
    const v = { tage: [{
      tag: '2026-10-05', wochenende: false, abwesend: [], ganzAbwesend: false,
      arbeitszeit: [{ start: '2026-10-05T09:00:00', ende: '2026-10-05T13:00:00' }, { start: '2026-10-05T14:00:00', ende: '2026-10-05T18:00:00' }],
      beschaeftigt: [
        { start: '2026-10-05T10:00:00', ende: '2026-10-05T11:00:00', art: 'termin' as const, ganztags: false },
        { start: '2026-10-05T10:30:00', ende: '2026-10-05T11:30:00', art: 'termin' as const, ganztags: false },
        { start: '2026-10-05T12:30:00', ende: '2026-10-05T14:30:00', art: 'termin' as const, ganztags: false },
        { start: '2026-10-05T15:00:00', ende: '2026-10-05T17:00:00', art: 'fokus' as const, ganztags: false },
      ],
    }] };
    const t = tageAusVerfuegbarkeit(v);
    expect(t.hatVorlage).toBe(true);
    expect(t.tage[0]).toMatchObject({ vorlageStunden: 8, terminStunden: 2.5, terminAnzahl: 3, frei: false });
  });
  it('Team-Person ohne Grundwert zählt nicht (keine geratene Kapa) — mit Grundwert schon', () => {
    const extern: PersonEingabe = { id: 'extern-1', name: 'Extern', quelle: 'team' };
    expect(rechne({ personen: [A, extern] }).personen[1]).toMatchObject({ ohneKapa: true, grundwert: 0 });
    const mit = rechne({ personen: [A, extern], datei: datei({ personen: { 'konto-a': { stundenWoche: 40 }, 'extern-1': { stundenWoche: 10 } } }) });
    expect(mit.personen[1].ohneKapa).toBeUndefined();
    expect(mit.team.wochen[0].belastbar).toBe(50);
  });
});

describe('Kopf & Energie — nur als Team-Faktor, Einzelwerte nur für die Person selbst', () => {
  const st = rechne({ personen: [{ ...A, erholung: 20 }, B], datei: datei({ personen: { 'konto-a': { stundenWoche: 40, ausnahmen: [{ id: 'u', art: 'urlaub', von: '2026-12-01', bis: '2026-12-02', titel: 'Erfundener Grund' }] }, 'konto-b': { stundenWoche: 40 } } }) });
  it('rote Erholung → Faktor 0,75 auf die nächsten 14 Tage, danach voll', () => {
    expect(erholungFaktor(80)).toBe(1); expect(erholungFaktor(50)).toBe(0.9); expect(erholungFaktor(20)).toBe(0.75);
    expect(st.team.kopf).toMatchObject({ faktor: 0.75, personen: 1, tage: 14 });
    expect(st.personen[1].wochen[0].belastbar).toBe(30); // auch Bert: ein Team-Faktor, kein Einzelwert
    expect(st.personen[1].wochen[2].belastbar).toBe(40);
    expect(st.kennzahlen.erholung).toBe(75);
  });
  it('der andere sieht weder den Erholungswert noch Ausnahme-Titel; die Person selbst schon; der Index niemand', () => {
    const fuerB = fuerBetrachter(st, 'konto-b');
    expect(fuerB.personen[0]).not.toHaveProperty('erholung');
    expect(JSON.stringify(fuerB)).not.toContain('Erfundener Grund');
    expect(JSON.stringify(fuerB)).not.toMatch(/"wert":20\b/);
    const fuerA = fuerBetrachter(st, 'konto-a');
    expect(fuerA.personen[0].erholung).toEqual({ wert: 20, faktor: 0.75 });
    expect(fuerA.personen[0].ausnahmen[0].titel).toBe('Erfundener Grund');
    expect(fuerBetrachter(st, null).personen.some(p => 'erholung' in p)).toBe(false);
  });
});

describe('Last je Woche — die Andock-Stelle für den Strahl', () => {
  const st = rechne({ posten: [ms('gross', { aufwand: 100, termin: '2026-10-09' })] });
  it('Wochen im Fenster mit Lage 0–1, Engpass markiert; außerhalb des Rechenfensters nichts', () => {
    const w = lastJeWoche(st, { von: '2026-10-01', bis: '2026-10-31' });
    expect(w.map(x => x.woche)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(w[0]).toMatchObject({ stufe: 'ueber', engpass: true, kapa: 40, bedarf: 100 });
    expect(w[0].anteilVon).toBeCloseTo(4 / 31, 5);
    expect(w[3].anteilBis).toBe(1);
    expect(engpassWochen(st, { von: '2026-10-01', bis: '2026-10-31' }).map(x => x.woche)).toEqual(['2026-10-05']);
    expect(lastJeWoche(st, { von: '2028-01-01', bis: '2028-12-31' })).toEqual([]);
    expect(lastJeWoche(null, { von: '2026-10-01', bis: '2026-10-31' })).toEqual([]);
    expect(lastJeWoche(st, { von: '2026-10-01', bis: '2026-10-31' }, 'konto-a')[0].bedarf).toBe(100);
  });
  it('Kennzahlen: Last, Puffer, Plan-Treue aus gemessener Zeit', () => {
    const k = rechne({ posten: [ms('x', { aufwand: 40 })], ist: [{ person: 'konto-a', tag: '2026-09-30', stunden: 10 }] }).kennzahlen;
    expect(k.last4).toBe(25); // 40 h ÷ 160 h
    expect(k.pufferStdWoche).toBe(30);
    expect(k.planStdWoche).toBe(10);
    expect(k.istStdWoche).toBe(2.5);
    expect(k.planTreue).toBe(25);
  });
});

describe('Schreibweg und Rechte', () => {
  const team = new Set(['konto-a', 'konto-b', 'extern-1']);
  const anna = { ich: 'konto-a', inhaber: false };
  const chef = { ich: 'konto-b', inhaber: true };
  it('die eigene Kapa: ja · fremde: 403 · Inhaber: ja · Team-Person ohne Konto: nur Inhaber · unbekannt: 404', () => {
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'konto-a', stundenWoche: 32 }], anna, team)).toMatchObject({ ok: true, datei: { personen: { 'konto-a': { stundenWoche: 32 } } } });
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'konto-b', stundenWoche: 32 }], anna, team)).toMatchObject({ ok: false, status: 403 });
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'extern-1', stundenWoche: 10 }], anna, team)).toMatchObject({ ok: false, status: 403 });
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'extern-1', stundenWoche: 10 }], chef, team)).toMatchObject({ ok: true });
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'konto-x', stundenWoche: 10 }], chef, team)).toMatchObject({ ok: false, status: 404 });
    // Zuweisung einer anderen Person: 403 — auch das Umhängen einer fremden auf sich selbst.
    const mitB = kapaAendern(null, [{ op: 'zuweisung', zuweisung: { id: 'z1', person: 'konto-b', art: 'mandat', bezugId: 'm-1', stundenWoche: 5 } }], chef, team);
    expect(mitB.ok).toBe(true);
    const d = mitB.ok ? mitB.datei : null;
    expect(kapaAendern(d, [{ op: 'zuweisung', zuweisung: { id: 'z1', person: 'konto-a', art: 'mandat', bezugId: 'm-1', stundenWoche: 5 } }], anna, team)).toMatchObject({ ok: false, status: 403 });
    expect(kapaAendern(d, [{ op: 'zuweisung-weg', id: 'z1' }], anna, team)).toMatchObject({ ok: false, status: 403 });
    expect(kapaAendern(d, [{ op: 'zuweisung-weg', id: 'z1' }], chef, team)).toMatchObject({ ok: true, datei: { zuweisungen: [] } });
  });
  it('Unsinn → 400, zu viel → 413, alles oder nichts', () => {
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'konto-a', stundenWoche: 200 }], anna, team)).toMatchObject({ ok: false, status: 400 });
    expect(kapaAendern(null, [{ op: 'ausnahme', person: 'konto-a', ausnahme: { art: 'urlaub', von: '2026-10-10' } }], anna, team)).toMatchObject({ ok: false, status: 400 });
    expect(kapaAendern(null, [{ op: 'zuweisung', zuweisung: { person: 'konto-a', art: 'mandat', bezugId: 'm 1 ;', stundenWoche: 5 } }], anna, team)).toMatchObject({ ok: false, status: 400 });
    expect(kapaAendern(null, Array.from({ length: 51 }, () => ({ op: 'grundwert', person: 'konto-a', stundenWoche: 1 })), anna, team)).toMatchObject({ ok: false, status: 413 });
    expect(kapaAendern(null, [{ op: 'grundwert', person: 'konto-a', stundenWoche: 30 }, { op: 'grundwert', person: 'konto-b', stundenWoche: 30 }], anna, team)).toMatchObject({ ok: false, status: 403 });
  });
  it('alter/fremder Bestand wird beim Lesen gesäubert (leer ist gültig)', () => {
    expect(sauberKapaDatei(null)).toEqual({ personen: {}, zuweisungen: [] });
    expect(sauberKapaDatei({ personen: { 'BÖSE id': { stundenWoche: 10 }, 'konto-a': { stundenWoche: 'x' } }, zuweisungen: [{ person: 'konto-a' }] })).toEqual({ personen: {}, zuweisungen: [] });
  });
});

describe('Meilenstein/Ziel: Aufwand + Personen — nur optional (Kompatibilität alter Daten)', () => {
  it('alte Einträge bleiben ohne die Felder; Business säubert, Privat verwirft', () => {
    const alt = sauberMeilenstein({ id: 'ms-1', titel: 'Alt', fortschritt: 20, erledigt: false, bereich: 'business' })!;
    expect(alt).not.toHaveProperty('aufwand');
    expect(alt).not.toHaveProperty('personen');
    expect(sauberMeilenstein({ titel: 'Neu', fortschritt: 0, space: 'business', aufwand: '12.34', personen: ['konto-a', 'konto-a', 'BÖSE', 3] })).toMatchObject({ aufwand: 12.3, personen: ['konto-a'] });
    expect(sauberMeilenstein({ titel: 'Privat', fortschritt: 0, space: 'privat', aufwand: 12, personen: ['konto-a'] })).not.toHaveProperty('aufwand');
    expect(sauberMeilenstein({ titel: 'Null', fortschritt: 0, space: 'business', aufwand: 0 })).not.toHaveProperty('aufwand');
    expect(sauberZiel({ titel: 'Ziel', space: 'business', aufwand: 40, personen: ['konto-b'] })).toMatchObject({ aufwand: 40, personen: ['konto-b'] });
    expect(sauberZiel({ titel: 'Ziel', space: 'privat', aufwand: 40 })).not.toHaveProperty('aufwand');
    expect(sauberZiel({ titel: 'Ziel alt' })).not.toHaveProperty('aufwand');
  });
  it('die Kaskade lässt Aufwand und Personen eines abgeleiteten Meilensteins stehen', () => {
    const z = { id: 'z-t', titel: 'Termin-Ziel', fortschritt: 0, space: 'business' as const, termin: '2026-11-30' };
    const vorher = meilensteineAbleiten([z], []);
    const mit = vorher.map(m => ({ ...m, aufwand: 25, personen: ['konto-a'] }));
    expect(meilensteineAbleiten([z], mit)[0]).toMatchObject({ aufwand: 25, personen: ['konto-a'] });
  });
});

describe('Säule „Kapazität“ im Business-Index', () => {
  const leer = (x: Partial<Bestand> = {}): Bestand => ({
    heute: '2026-09-25', scope: 'gesamt', firmen: [], rechnungen: [], zahlungen: [], merkposten: [], planposten: [], finance: null,
    grundlageMonate: [], grundlageFixkosten: {}, abschluesse: [], mandate: [], chancen: [], traktion: { score: null, text: '' },
    termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [], fte: {}, mrrVerlauf: {}, ...x,
  });
  const monate = (u: number, k: number) => Array.from({ length: 8 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatzNetto: u, kostenNetto: k }));
  const ALT = [
    { id: 'fh', label: 'Finanzielle Gesundheit', gewicht: 0.45, satz: '' }, { id: 'ud', label: 'Personal', gewicht: 0.27, satz: '' },
    { id: 'mt', label: 'Markttraktion', gewicht: 0.18, satz: '' }, { id: 'fz', label: 'Fokus & Zeit', gewicht: 0.1, satz: '' },
  ];
  const alterIndex = (b: Bestand) => berechneModell({ saeulen: ALT, kennzahlen: kennzahlenFuer(b.scope).filter(k => k.saeule !== 'kp'), messen: MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.scope });

  it('15 %, die übrigen ×0,85 im alten Verhältnis; Gewichte summieren 1; der Text kommt aus derselben Quelle', () => {
    const g = Object.fromEntries(SAEULEN.map(s => [s.id, s.gewicht]));
    expect(g.kp).toBe(0.15);
    expect(g.fh).toBeCloseTo(0.45 * 0.85, 10); expect(g.ud).toBeCloseTo(0.27 * 0.85, 10); expect(g.mt).toBeCloseTo(0.18 * 0.85, 10); expect(g.fz).toBeCloseTo(0.1 * 0.85, 10);
    expect(Math.round(SAEULEN.reduce((s, x) => s + x.gewicht, 0) * 1e9) / 1e9).toBe(1);
    expect(SAEULEN_TEXT).toContain('Kapazität 15 %');
    expect(KENNZAHLEN.filter(k => k.saeule === 'kp').every(k => k.nurGesamt)).toBe(true);
    expect(kennzahlenFuer('kdc').some(k => k.saeule === 'kp')).toBe(false);
  });
  it('ohne Messung zählt die Säule nicht — der Index ist EXAKT der bisherige (auch an der Abdeckungs-Grenze)', () => {
    const faelle: Bestand[] = [
      leer(),
      leer({ firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }, { id: 'kdv', name: 'V', kontostand: 0, stand: null }], grundlageMonate: monate(20000, 10000), traktion: { score: 50, text: 'x' } }),
      // nur Finanzielle Gesundheit misst (0,45 von 1 — knapp über der Mindestabdeckung): darf nicht kippen
      leer({ firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }], grundlageMonate: monate(20000, 10000) }),
      leer({ traktion: { score: 70, text: 'x' } }),
      leer({ kapa: null }),
      leer({ kapa: { last4: null, bedarf4: 0, belastbar4: 160, machbar: { machbar: 0, eng: 0, nicht: 0, ueberfaellig: 0, ohneAufwand: 3, ohneTermin: 0, bewertet: 0 }, machbarAnteil: null, planTreue: null, istStdWoche: null, planStdWoche: 0, pufferStdWoche: null, erholung: 90, erholungPersonen: 1, engpassWochen: [], kritisch: [] } }),
    ];
    for (const b of faelle) {
      const neu = berechne(b), alt = alterIndex(b);
      expect(neu.saeulen.find(s => s.id === 'kp')!.score == null || neu.saeulen.find(s => s.id === 'kp')!.zuDuenn).toBe(true);
      expect(neu.index).toBe(alt.index);
      expect(neu.label).toBe(alt.label);
      expect(neu.teil).toEqual(alt.teil);
      expect(neu.abdeckung).toBeCloseTo(alt.abdeckung, 6);
    }
  });
  it('mit Messung zählt sie mit 15 %', () => {
    const b = leer({
      firmen: [{ id: 'kdc', name: 'C', kontostand: 60000, stand: null }], grundlageMonate: monate(20000, 10000),
      kapa: { last4: 120, bedarf4: 192, belastbar4: 160, machbar: { machbar: 1, eng: 0, nicht: 1, ueberfaellig: 0, ohneAufwand: 0, ohneTermin: 0, bewertet: 2 }, machbarAnteil: 50, planTreue: 60, istStdWoche: 24, planStdWoche: 48, pufferStdWoche: -8, erholung: 90, erholungPersonen: 1, engpassWochen: ['2026-10-05'], kritisch: [{ id: 'm', art: 'meilenstein', titel: 'Groß', status: 'nicht-machbar', text: 'nicht machbar — bräuchte 30 h/Tag' }] },
    });
    const g = berechne(b);
    const kp = g.saeulen.find(s => s.id === 'kp')!;
    expect(kp.score).not.toBeNull();
    expect(kp.zuDuenn).toBe(false);
    expect(kp.kennzahlen.find(k => k.id === 'kp_machbar')!.details[0]).toMatchObject({ titel: 'Groß', href: '/os/planung/meilenstein/m' });
    expect(g.index).not.toBe(alterIndex(b).index);
  });
});
