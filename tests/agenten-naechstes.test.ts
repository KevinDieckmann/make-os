// ─── Wächter: „Als Nächstes“ — dieselben Regeln wie der Takt (Gold-Fälle), Eisenhower, Trennung (09.10., Paket 3) ───────────
// Gold: die Zeiten, die „Als Nächstes“ ansagt, sind GENAU die Minuten, in denen der Takt (`zeitplaeneFaelligRein` bzw. der Heads-Takt
// `faelligeModi`) einreiht — Minute für Minute durchgespielt, mit Feiertag, Zeitumstellung, Business-frei und Nachtruhe.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-naechstes-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-naechstes';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LAUF_AGENT, skillsPersonBestand, type Naechstes } from '@/lib/agenten/typen';
import { TAKT_BIS, TAKT_VON, zeitplaeneFaelligRein, type ZeitRegel, type ZeitplanKandidat, type AuftragSpurAgent } from '@/lib/agenten/zeitplan';
import { zeitplanEintraege, modusZeiten, ausserhalbTakt, naechstesSortieren, eintrag, fristEintraege, freigabeEintraege, zoeAufgabeEintraege, headFuerFrist, naechstesLesen, type ZeitplanPosten } from '@/lib/agenten/naechstes';
import { ausWandzeit, wandzeit } from '@/lib/kalender/zeit';
import { faelligeModi } from '@/lib/heads/takt';
import { leererStand } from '@/lib/heads/stand';
import type { Spanne } from '@/lib/arbeitsrahmen/regel';

const W = (s: string) => ausWandzeit(s);

/** Der Takt, Minute für Minute: was `zeitplaeneFaelligRein` einreiht, wird als Auftrag vermerkt (Riegel) — die Einreihe-Zeiten je Kandidat. */
function taktSimulieren(k: ZeitplanKandidat[], von: Date, bis: Date, frei: (p: string) => readonly Spanne[]): Map<string, string[]> {
  const auftraege: AuftragSpurAgent[] = [];
  const raus = new Map<string, string[]>();
  for (let t = von.getTime(); t < bis.getTime(); t += 60_000) {
    const jetzt = new Date(t);
    for (const f of zeitplaeneFaelligRein(k, { jetzt, kiHintergrund: true, frei, auftraege, faeden: [] })) {
      auftraege.push({ name: LAUF_AGENT, zeit: jetzt.toISOString(), tag: wandzeit(jetzt).slice(0, 10), status: 'fertig', anlass: 'Takt: x', eingabe: f.auftrag.eingabe });
      const id = f.id.replace(/^agenten-(skill|plan)-/, '');
      raus.set(id, [...(raus.get(id) ?? []), jetzt.toISOString()]);
    }
  }
  return raus;
}

const kandidat = (id: string, regel: ZeitRegel, business = false): ZeitplanKandidat => ({
  art: 'skill', id, headId: business ? 'sales' : 'assistenz', bereich: business ? 'business' : 'privat', person: 'person-a', regel,
  eingabe: { art: 'skill', skillId: id, headId: business ? 'sales' : 'assistenz', ausloeser: 'zeitplan' },
});
const posten = (k: ZeitplanKandidat): ZeitplanPosten => ({ art: 'skill', id: k.id, titel: k.id, headId: k.headId, regel: k.regel, business: k.bereich === 'business', wichtig: false });

describe('Gold: „Als Nächstes“ sagt genau die Minuten an, in denen der Takt einreiht', () => {
  const REGELN: [string, ZeitRegel, boolean][] = [
    ['taeglich-0800', { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '08:00' }, false],
    ['werktags-0630', { art: 'wiederkehrend', rhythmus: 'werktags', uhrzeit: '06:30' }, false],
    ['woechentlich-mi-sa-1515', { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '15:15', tage: [3, 6] }, false],
    ['monatlich-24-31', { art: 'wiederkehrend', rhythmus: 'monatlich', uhrzeit: '10:00', tage: [24, 31] }, false],
    ['business-0900', { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '09:00' }, true],
    ['business-2130', { art: 'wiederkehrend', rhythmus: 'werktags', uhrzeit: '21:30' }, true],
  ];
  // Business-frei: Di 09:00–10:30 (Lauf kommt 10:30), Mi 21:00–23:00 (Lauf 21:30 fällt aus — Nachtruhe ab 22 Uhr).
  const FREI: Spanne[] = [{ start: '2026-12-22T09:00:00', ende: '2026-12-22T10:30:00' }, { start: '2026-12-23T21:00:00', ende: '2026-12-23T23:00:00' }];
  const faelle: [string, string, string][] = [
    // Woche mit Heiligabend und den Weihnachtsfeiertagen (Fr 25.12. ist Feiertag NRW — „werktags“ läuft nicht).
    ['Weihnachtswoche', '2026-12-21T09:17:00', '2026-12-28T09:17:00'],
    // Zeitumstellung (So 25.10.2026, 3 → 2 Uhr).
    ['Zeitumstellung', '2026-10-23T20:00:00', '2026-10-27T12:00:00'],
    // Start mitten am Tag nach einem schon fälligen, noch nicht eingereihten Slot (08:00 → „jetzt“).
    ['heute schon fällig', '2026-11-02T11:40:00', '2026-11-04T11:40:00'],
  ];
  for (const [name, vonW, bisW] of faelle) {
    it(name, () => {
      const von = W(vonW), bis = W(bisW);
      const k = REGELN.map(([id, r, b]) => kandidat(id, r, b));
      const frei = () => FREI;
      const takt = taktSimulieren(k, von, bis, frei);
      const ansage = zeitplanEintraege(k.map(posten), von, bis, (_p, tag) => FREI.filter(s => s.start.slice(0, 10) <= tag && s.ende.slice(0, 10) >= tag), { auftraege: [], faeden: [] });
      for (const kk of k) {
        const erwartet = takt.get(kk.id) ?? [];
        const angesagt = ansage.filter(a => a.id.startsWith(`zp:skill:${kk.id}:`)).map(a => a.wann).sort();
        expect(angesagt, `${name} · ${kk.id}`).toEqual(erwartet);
      }
      // Stichproben, damit die Regeln selbst stimmen (nicht nur gleich falsch sind):
      const t = (id: string) => (takt.get(id) ?? []).map(x => wandzeit(new Date(x)));
      if (name === 'Weihnachtswoche') {
        expect(t('werktags-0630')).toEqual(['2026-12-21T09:17:00', '2026-12-22T07:00:00', '2026-12-23T07:00:00', '2026-12-24T07:00:00', '2026-12-28T07:00:00']);
        expect(t('business-0900')).toContain('2026-12-22T10:30:00');
        expect(t('business-2130')).not.toContain('2026-12-23T21:30:00');
        expect(t('monatlich-24-31')).toEqual(['2026-12-24T10:00:00']);
        expect(t('woechentlich-mi-sa-1515')).toEqual(['2026-12-23T15:15:00', '2026-12-26T15:15:00']);
      }
      if (name === 'heute schon fällig') expect(t('taeglich-0800')[0]).toBe('2026-11-02T11:40:00');
      if (name === 'Zeitumstellung') expect(t('taeglich-0800')).toContain('2026-10-25T08:00:00');
    });
  }
  it('Takt-Fenster = VON/BIS in lib/zoe/takt.ts (eine Regel)', () => {
    const t = readFileSync(path.resolve(__dirname, '..', 'lib/zoe/takt.ts'), 'utf8');
    expect(t).toMatch(new RegExp(`const VON = ${TAKT_VON};`));
    expect(t).toMatch(new RegExp(`const BIS = ${TAKT_BIS};`));
    expect(t).toMatch(/import\('@\/lib\/agenten\/zeitplan'\)\.then\(m => m\.zeitplaeneFaellig\(jetzt\)\)/);
  });
  it('Heads-Takt: das stündliche Durchspielen trifft genau die Minuten des Takts (faelligeModi, Business-frei, Nachtruhe)', () => {
    const von = W('2026-11-02T06:10:00'), bis = W('2026-11-06T20:00:00'); // Mo bis Fr
    const events = [{ datum: '2026-11-04', status: 'geplant' }];
    const personen = ['person-a', 'person-b'];
    const hh: Spanne[] = [{ start: '2026-11-03T06:00:00', ende: '2026-11-03T11:00:00' }];
    const rahmen = (t: Date) => ({ haushaltFrei: hh.some(s => s.start <= wandzeit(t) && wandzeit(t) < s.ende), personFrei: new Set<string>(), warFrei: () => false });
    for (const head of ['sales', 'marketing', 'event'] as const) {
      // Takt: jede Minute (in der Agenten-Zeit), höchstens ein Modus je Head und Minute; der Lauf schreibt `letzte`.
      const s1 = leererStand();
      const takt: string[] = [];
      for (let t = von.getTime(); t < bis.getTime(); t += 60_000) {
        const d = new Date(t);
        if (ausserhalbTakt(d)) continue;
        const m = faelligeModi(head, d, s1, events, personen, rahmen(d))[0];
        if (!m) continue;
        s1.letzte[m.person ? `${m.modus}:${m.person}` : m.modus] = d.toISOString();
        takt.push(`${m.modus}${m.person ? `:${m.person}` : ''}@${d.toISOString()}`);
      }
      const s2 = leererStand();
      const sim = modusZeiten(von, bis, t => faelligeModi(head, t, s2, events, personen, rahmen(t)), (m, t) => { s2.letzte[m.person ? `${m.modus}:${m.person}` : m.modus] = t.toISOString(); }, ausserhalbTakt)
        .map(x => `${x.modus}${x.person ? `:${x.person}` : ''}@${x.wann.toISOString()}`);
      // Die Reihenfolge innerhalb derselben Stunde darf abweichen (der Takt nimmt je Minute einen), die Stunde nicht.
      const stunde = (x: string) => x.replace(/:\d\d:\d\d\.\d+Z$/, '');
      expect(sim.map(stunde).sort(), head).toEqual(takt.map(stunde).sort());
      expect(takt.length, head).toBeGreaterThan(0);
    }
  });
});

describe('Eisenhower und Einträge (rein)', () => {
  const J = new Date('2026-10-09T08:00:00.000Z');
  it('Reihenfolge q1 (Kritisches zuerst) → q2 → q3 → q4, darin nach Zeit', () => {
    const e = (id: string, wichtig: boolean, dringend: boolean, wann: string, kritisch = false): Naechstes =>
      eintrag({ id, art: 'frist', titel: id, wann, link: '/os', wichtig, dringend, ...(kritisch ? { kritisch: true } : {}) });
    const s = naechstesSortieren([e('q4', false, false, '2026-10-09'), e('q2', true, false, '2026-10-10'), e('q1-spaet', true, true, '2026-10-11'), e('q3', false, true, '2026-10-09'), e('q1-kritisch', true, true, '2026-10-12', true), e('q1-frueh', true, true, '2026-10-09')]);
    expect(s.map(x => x.id)).toEqual(['q1-kritisch', 'q1-frueh', 'q1-spaet', 'q2', 'q3', 'q4']);
    expect(s.map(x => x.quadrant)).toEqual(['q1', 'q1', 'q1', 'q2', 'q3', 'q4']);
  });
  it('Freigaben: eine Zeile je Head, wichtig + dringend, kritisch ab 48 h', () => {
    const f = freigabeEintraege([{ headId: 'sales', anzahl: 2, aeltestes: '2026-10-06T08:00:00.000Z' }, { anzahl: 1, aeltestes: '2026-10-09T07:00:00.000Z' }, { headId: 'event', anzahl: 0, aeltestes: '' }], J);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ art: 'freigabe', anzahl: 2, quadrant: 'q1', kritisch: true, headId: 'sales', titel: '2 Freigaben offen' });
    expect(f[1].kritisch).toBeUndefined();
  });
  it('Fristen: fremde Zuständigkeit und Erledigtes fallen weg; kritisch am Tag selbst; Head nach Art', () => {
    const fr = fristEintraege([
      { id: 'a', art: 'zahlung', tag: '2026-10-09', titel: 'Zahlung A', href: '/x', bereich: 'business' },
      { id: 'b', art: 'zahlung', tag: '2026-10-14', titel: 'Zahlung B', href: '/x', bereich: 'privat' },
      { id: 'c', art: 'mandat', tag: '2026-10-10', titel: 'Kündigungsfrist', href: '/x', bereich: 'business', fuer: 'person-b', kuendigung: true },
      { id: 'd', art: 'deal', tag: '2026-10-10', titel: 'Erledigt', href: '/x', bereich: 'business', erledigt: true },
      { id: 'e', art: 'mandat', tag: '2026-10-11', titel: 'Kündigung eigene', href: '/x', bereich: 'business', fuer: 'person-a', kuendigung: true },
    ], 'person-a', '2026-10-09', new Set(['finanzen', 'kundenerfolg']));
    expect(fr.map(x => x.id)).toEqual(['frist:a', 'frist:b', 'frist:e']);
    expect(fr[0]).toMatchObject({ kritisch: true, quadrant: 'q1', headId: 'finanzen' });
    expect(fr[1]).toMatchObject({ quadrant: 'q2' });
    expect(fr[1].headId).toBeUndefined(); // „Finanzen privat“ sieht diese Person hier nicht
    expect(fr[2]).toMatchObject({ kritisch: true, headId: 'kundenerfolg' });
    expect(headFuerFrist({ art: 'meilenstein', bereich: 'privat' })).toBe('assistenz');
  });
  it('ZOE-Aufgaben: nur offen/in Arbeit; wichtig nach Priorität, dringend nach Deadline', () => {
    const z = zoeAufgabeEintraege([
      { id: 't1', title: 'Angebot vorbereiten', priority: 'critical', dueDate: '2026-10-10', zoe: { status: 'offen' } },
      { id: 't2', title: 'Recherche', priority: 'low', zoe: { status: 'in_arbeit' } },
      { id: 't3', title: 'Fertig', priority: 'high', zoe: { status: 'freigegeben' } },
    ], '2026-10-09', J);
    expect(z.map(x => [x.id, x.quadrant, !!x.kritisch])).toEqual([['zoe-aufgabe:t1', 'q1', true], ['zoe-aufgabe:t2', 'q4', false]]);
  });
});

describe('Server: nur, was die Person sehen darf', () => {
  beforeAll(async () => {
    globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }), konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' })], einladungen: [] });
    await db.saveJson(skillsPersonBestand('person-a'), { v: 1, mitarbeiter: [], gedaechtnis: {}, skills: [{
      id: 'sk-privat-a', headId: 'assistenz', name: 'privat-marke-a', beschreibung: 'x', anleitung: 'x', werkzeuge: [], ausloeser: { art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '08:00' },
      eingabeFelder: [], freigabePflicht: false, ergebnis: 'faden', stufe: 'schnell', tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-a',
    }] });
    const { lege } = await import('@/lib/zoe/stapel');
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'A', nachher: 'A', eingabe: { title: 'A' }, person: 'person-a', quelle: 'gespraech' });
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'B', nachher: 'B', eingabe: { title: 'B' }, person: 'person-b', quelle: 'gespraech' });
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'B2', nachher: 'B2', eingabe: { title: 'B2' }, person: 'person-b', quelle: 'gespraech' });
  });
  it('die Privat-Skills der anderen Person und ihre Freigaben erscheinen nie; die eigenen schon', async () => {
    const b = await naechstesLesen('person-b');
    expect(JSON.stringify(b)).not.toContain('privat-marke-a');
    expect(b.find(x => x.art === 'freigabe' && !x.headId)?.anzahl).toBe(2);
    const a = await naechstesLesen('person-a');
    expect(a.find(x => x.art === 'freigabe' && !x.headId)?.anzahl).toBe(1);
    expect(a.some(x => x.art === 'skill' && x.titel === 'privat-marke-a')).toBe(true);
    expect(a.every((x, i) => i === 0 || ['q1', 'q2', 'q3', 'q4'].indexOf(a[i - 1].quadrant) <= ['q1', 'q2', 'q3', 'q4'].indexOf(x.quadrant))).toBe(true);
  });
});
