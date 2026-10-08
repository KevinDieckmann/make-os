// ─── Wächter: der Vertrag des Agenten-Bereichs (08.10. spät, Paket 0; AGENTEN_KONZEPT.md C11) ────────────────────────────
// Hält fest, worauf die Pakete 1 (Kern), 2 (Oberfläche), 3 (Skills/Läufe) und 5 (Medien) parallel bauen:
//   • Katalog neutral (keine Namen, keine Firmen, keine Farbwerte), Kennungen eindeutig, Kevins Auswahl vollständig;
//   • Werkzeuge ⊆ ZOE-Register und ≤ 20 je Head, KI-Kategorien passen zu den Werkzeugen, Business nie Gesundheit;
//   • Mitarbeiter-Vorlagen ⊆ Werkzeuge ihres Heads, Aushilfe nur im selben Bereich, Fach-Agenten gibt es;
//   • eingebaute Skills = vorhandene Modi, Kennzahlen gibt es in den Index-Registern;
//   • Bestände im Speicher-Register (mit Angaben), für Konto-Export/-Löschen eingeordnet, Art. 17 umgesetzt;
//   • Routen im Routen-Register, Stubs: ohne Sitzung 401/403, nur die Person selbst bzw. der Dienstweg MIT Person.
// Eigener Datenordner, alle Konten erfunden (@example.invalid), kein Modellaufruf.
import { describe, it, expect, vi, afterAll } from 'vitest';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-vertrag-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-vertrag';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import { KATALOG, HEAD_IDS, headDef, vorlageVon, vorlagenFuer } from '@/lib/agenten/katalog';
import {
  AGENTEN_STAPEL_ARTEN, GRENZEN, HEAD_WERKZEUGE, MITARBEITER_WERKZEUGE, TON_SATZ, agentSchluessel, einstellungBestand, fadenBestand,
  medienBestand, medienPrivatBestand, planBestand, skillsHaushaltBestand, skillsPersonBestand, werkstattBestandFuer,
} from '@/lib/agenten/typen';
import { skillsFuerHead, skillLesen, mitarbeiterFuerHead, gedaechtnisFuer, einstellungFuer } from '@/lib/agenten/skills-lesen';
import { REGISTER, gruppeVon } from '@/lib/zoe/register';
import { WERKZEUGE } from '@/lib/zoe/werkzeuge';
import { kategorieVonWerkzeug } from '@/lib/datenschutz/ki-werkzeuge';
import { KI_KATEGORIEN } from '@/lib/datenschutz/ki-einstellungen';
import { AUSFUEHRBAR, SYSTEM_LAEUFE } from '@/lib/zoe/agenten';
import { MODI as HEADS_MODI, HEADS as LIB_HEADS } from '@/lib/heads/prompt';
import { MODI as FINANZCHEF_MODI } from '@/lib/finanzen/chef/prompt';
import { KENNZAHL as BUSINESS_KENNZAHL } from '@/lib/business/register';
import { TRAKTION_KENNZAHLEN } from '@/lib/crm/traktion-index';
import { PRIVAT_KENNZAHLEN } from '@/lib/privat/index';
import { GESUNDHEIT_KENNZAHLEN } from '@/lib/gesundheit/index';
import { LEUCHT } from '@/lib/make-one/design';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { SPEICHER_REGISTER, registerEintrag } from '@/lib/crm/speicher-register';
import { WEITERE_SPEICHER } from '@/lib/crm/person-weitere';
import { PERSON_BESTAENDE, NICHT_PERSOENLICH } from '@/lib/datenschutz/konto-daten';
import { ROUTEN_REGISTER } from '@/lib/zugang/routen-register';
import type { StapelArt } from '@/lib/zoe/stapel';
import * as FIX from './fixtures/agenten-api';

const WURZEL = path.resolve(__dirname, '..');
const BUSINESS = ['sales', 'marketing', 'event', 'finanzen', 'it', 'operations', 'kundenerfolg', 'strategie', 'produkt', 'recht', 'research'];
const PRIVAT = ['gesundheit', 'ernaehrung', 'familie', 'finanzen-privat', 'assistenz'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const kategorieVon = (w: string) => kategorieVonWerkzeug(w, gruppeVon(w));

describe('Katalog: Kennungen und Auswahl', () => {
  it('genau Kevins Auswahl: 11 Business-Heads, 5 Privat-Heads — in dieser Reihenfolge', () => {
    expect(KATALOG.filter(h => h.bereich === 'business').map(h => h.id)).toEqual(BUSINESS);
    expect(KATALOG.filter(h => h.bereich === 'privat').map(h => h.id)).toEqual(PRIVAT);
  });
  it('jede Head-Id eindeutig und kebab; Kurznamen eindeutig (Ansprache per @)', () => {
    expect(new Set(HEAD_IDS).size).toBe(HEAD_IDS.length);
    for (const id of HEAD_IDS) expect(id, id).toMatch(KEBAB);
    const kurz = KATALOG.map(h => h.kurz.toLocaleLowerCase('de-DE'));
    expect(new Set(kurz).size).toBe(kurz.length);
    expect(headDef('gibt-es-nicht')).toBeNull();
  });
  it('Mitarbeiter-Ids im ganzen Katalog eindeutig, kebab, mit dem Head als Präfix; Namen je Head eindeutig', () => {
    const ids = KATALOG.flatMap(h => h.mitarbeiter.map(m => m.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of KATALOG) {
      for (const m of h.mitarbeiter) {
        expect(m.id, m.id).toMatch(KEBAB);
        expect(m.id.startsWith(`${h.id}-`), m.id).toBe(true);
        expect(vorlageVon(m.id)?.head.id).toBe(h.id);
      }
      const namen = h.mitarbeiter.map(m => m.name.toLocaleLowerCase('de-DE'));
      expect(new Set(namen).size, h.id).toBe(namen.length);
      expect(h.mitarbeiter.length, h.id).toBeLessThanOrEqual(GRENZEN.mitarbeiterJeHead);
    }
  });
  it('Kevins „zuerst“: Marketing, Sales und Finance sind ausgestattet', () => {
    const namen = (id: string) => headDef(id)!.mitarbeiter.map(m => m.name);
    expect(namen('marketing')).toEqual(expect.arrayContaining(['Design', 'Kampagnen', 'Social Media & LinkedIn']));
    expect(namen('sales')).toEqual(expect.arrayContaining(['Recherche & Prospecting', 'Qualifizierung', 'Angebote', 'Nachfassen & Power Hour', 'CRM-Pflege']));
    expect(namen('finanzen')).toEqual(expect.arrayContaining(['Rechnungen & Mahnungen', 'Liquidität & Planung']));
    for (const h of KATALOG) expect(h.mitarbeiter.length, `${h.id}: 1–3 Vorlagen (mehr nur bei den ersten drei)`).toBeGreaterThan(0);
  });
  it('Ton, Farbe (nur Token aus LEUCHT), Ebene und Voraussetzungen passen', () => {
    for (const h of KATALOG) {
      expect(TON_SATZ[h.ton], h.id).toBeTruthy();
      expect(h.farbe in LEUCHT, `${h.id}: ${h.farbe}`).toBe(true);
      if (h.bereich === 'business') expect(h.ebene, h.id).toBe('haushalt');
    }
    expect(headDef('familie')!.ebene).toBe('haushalt');
    for (const id of ['gesundheit', 'ernaehrung', 'finanzen-privat', 'assistenz']) expect(headDef(id)!.ebene, id).toBe('person');
    expect(headDef('gesundheit')!.voraussetzung).toBe('gesundheit-ki');
    expect(headDef('finanzen-privat')!.voraussetzung).toBe('privat-finanzen');
    expect(headDef('recht')!.hinweis).toMatch(/keine Rechtsberatung/);
  });
});

describe('Katalog: Werkzeuge und KI-Kategorien', () => {
  it('die Agenten-Werkzeuge kollidieren nicht mit dem ZOE-Register; Mitarbeiter-Werkzeuge ⊆ Head-Werkzeuge', () => {
    for (const w of HEAD_WERKZEUGE) { expect(REGISTER[w], w).toBeUndefined(); expect(WERKZEUGE[w], w).toBeUndefined(); }
    for (const w of MITARBEITER_WERKZEUGE) expect((HEAD_WERKZEUGE as readonly string[]).includes(w), w).toBe(true);
    expect(MITARBEITER_WERKZEUGE).not.toContain('an_mitarbeiter'); // Tiefe ≤ 2: Mitarbeiter delegieren nicht weiter
  });
  it('Werkzeuge ⊆ Register, ohne Doppel, je Head ≤ 20 (mit den Agenten-Werkzeugen)', () => {
    for (const h of KATALOG) {
      for (const w of h.werkzeuge) expect(REGISTER[w], `${h.id}: ${w} fehlt im Register`).toBeTruthy();
      expect(new Set(h.werkzeuge).size, h.id).toBe(h.werkzeuge.length);
      expect(h.werkzeuge.length + HEAD_WERKZEUGE.length, h.id).toBeLessThanOrEqual(GRENZEN.werkzeugeJeHead);
    }
  });
  it('werkzeugGruppen sind genau die Gruppen der Werkzeuge', () => {
    for (const h of KATALOG) expect([...h.werkzeugGruppen].sort(), h.id).toEqual([...new Set(h.werkzeuge.map(gruppeVon))].sort());
  });
  it('jede Datenkategorie eines Werkzeugs steht beim Head (KI-Tor) — und nur bekannte Kategorien', () => {
    for (const h of KATALOG) {
      const darf = new Set([...h.kategorien, ...(h.kategorienMitEinwilligung ?? [])]);
      for (const k of darf) expect(KI_KATEGORIEN, `${h.id}: ${k}`).toContain(k);
      for (const w of h.werkzeuge) { const k = kategorieVon(w); if (k) expect(darf.has(k), `${h.id}: ${w} liest ${k}`).toBe(true); }
    }
  });
  it('Business nie Gesundheit (Kategorien, Werkzeuge, Gruppen, Kennzahlen); Gesundheit nur mit Einwilligung und je Person', () => {
    for (const h of KATALOG.filter(x => x.bereich === 'business')) {
      expect(h.kategorien, h.id).not.toContain('gesundheit');
      expect(h.kategorienMitEinwilligung ?? [], h.id).not.toContain('gesundheit');
      expect(h.werkzeugGruppen, h.id).not.toContain('gesundheit');
      for (const w of [...h.werkzeuge, ...h.mitarbeiter.flatMap(m => m.werkzeuge)]) expect(kategorieVon(w), `${h.id}: ${w}`).not.toBe('gesundheit');
      for (const k of h.kennzahlen) expect(['gesundheit', 'privat'], `${h.id}: ${k.index}`).not.toContain(k.index);
      expect(h.voraussetzung, h.id).not.toBe('gesundheit-ki');
    }
    for (const h of KATALOG.filter(x => x.kategorien.includes('gesundheit'))) {
      expect(h.bereich, h.id).toBe('privat');
      expect(h.ebene, h.id).toBe('person');
      expect(h.voraussetzung, h.id).toBe('gesundheit-ki');
    }
  });
});

describe('Katalog: Mitarbeiter-Vorlagen', () => {
  it('Werkzeuge ⊆ Werkzeuge des Heads, ≤ 20 mit den Mitarbeiter-Werkzeugen, Fach-Agent ausführbar (kein Systemlauf)', () => {
    for (const h of KATALOG) for (const m of h.mitarbeiter) {
      for (const w of m.werkzeuge) expect(h.werkzeuge, `${m.id}: ${w}`).toContain(w);
      expect(m.werkzeuge.length + MITARBEITER_WERKZEUGE.length, m.id).toBeLessThanOrEqual(GRENZEN.werkzeugeJeHead);
      if (m.agentId) {
        expect(AUSFUEHRBAR as readonly string[], `${m.id}: ${m.agentId}`).toContain(m.agentId);
        expect(SYSTEM_LAEUFE as readonly string[], `${m.id}: ${m.agentId}`).not.toContain(m.agentId);
      }
    }
  });
  it('Aushilfe (`auchFuer`) nur bei anderen Heads desselben Bereichs — mit gemeinsamen Werkzeugen', () => {
    for (const h of KATALOG) for (const m of h.mitarbeiter) for (const f of m.auchFuer ?? []) {
      const ziel = headDef(f);
      expect(ziel, `${m.id} → ${f}`).not.toBeNull();
      expect(f, m.id).not.toBe(h.id);
      expect(ziel!.bereich, `${m.id} → ${f}`).toBe(h.bereich);
      if (m.werkzeuge.length) expect(m.werkzeuge.some(w => ziel!.werkzeuge.includes(w)), `${m.id} → ${f}: keine gemeinsamen Werkzeuge`).toBe(true);
    }
  });
  it('vorlagenFuer: eigene und Aushilfen — die Lese-Schnittstelle (Stub) liefert dieselben', async () => {
    const v = vorlagenFuer('sales');
    expect(v.filter(x => !x.aushilfe).map(x => x.vorlage.id)).toEqual(headDef('sales')!.mitarbeiter.map(m => m.id));
    expect(v.filter(x => x.aushilfe).map(x => x.vorlage.id)).toEqual(expect.arrayContaining(['event-nachfassen', 'kundenerfolg-ausbau']));
    const u = { person: 'person-a', haushalt: 'haus-a' };
    const m = await mitarbeiterFuerHead('sales', u);
    expect(m.map(x => x.id)).toEqual(v.map(x => x.vorlage.id));
    expect(m.find(x => x.id === 'event-nachfassen')?.headId).toBe('event');
    expect(await mitarbeiterFuerHead('gibt-es-nicht', u)).toEqual([]);
    expect(await skillsFuerHead('sales', u)).toEqual([]);
    expect(await skillLesen('sk-x', u)).toBeNull();
    expect(await gedaechtnisFuer({ art: 'head', headId: 'sales' }, u)).toEqual([]);
    expect(await einstellungFuer('haus-a')).toEqual({ v: 1, heads: {} });
  });
});

describe('Katalog: eingebaute Skills und Kennzahlen', () => {
  it('eingebaute Skills = vorhandene Modi (ohne „frage“ — die Frage ist jetzt der Chat)', () => {
    for (const h of KATALOG.filter(x => x.eingebaut)) {
      const e = h.eingebaut!;
      expect(e.modi, h.id).not.toContain('frage');
      if (e.quelle === 'heads') {
        expect(LIB_HEADS as readonly string[], h.id).toContain(h.id);
        const modi = HEADS_MODI[h.id as keyof typeof HEADS_MODI].map(m => m.id);
        for (const m of e.modi) expect(modi, `${h.id}: ${m}`).toContain(m);
        expect(h.kontext).toBe('heads');
      } else {
        for (const m of e.modi) expect(FINANZCHEF_MODI as readonly string[], `${h.id}: ${m}`).toContain(m);
        expect(h.kontext).toBe('finanzchef');
      }
    }
    // Die drei vorhandenen Heads tragen alle ihre Modi.
    for (const id of LIB_HEADS) expect(headDef(id)?.eingebaut?.modi.length, id).toBe(HEADS_MODI[id].filter(m => m.id !== 'frage').length);
  });
  it('Kennzahlen gibt es im jeweiligen Index-Register (höchstens 5 je Head)', () => {
    const da: Record<string, Set<string>> = {
      business: new Set(Object.keys(BUSINESS_KENNZAHL)),
      traktion: new Set(TRAKTION_KENNZAHLEN.map(k => k.id)),
      privat: new Set(PRIVAT_KENNZAHLEN.map(k => k.id)),
      gesundheit: new Set(GESUNDHEIT_KENNZAHLEN.map(k => k.id)),
    };
    for (const h of KATALOG) {
      expect(h.kennzahlen.length, h.id).toBeLessThanOrEqual(5);
      for (const k of h.kennzahlen) expect(da[k.index].has(k.id), `${h.id}: ${k.index}/${k.id}`).toBe(true);
      if (h.kennzahlen.some(k => k.index === 'gesundheit')) expect(h.kategorien, h.id).toContain('gesundheit');
    }
  });
});

describe('Plattform: nichts Persönliches im Agenten-Bereich', () => {
  const dateien = [
    ...readdirSync(path.join(WURZEL, 'lib/agenten')).map(n => `lib/agenten/${n}`),
    'app/api/agenten/route.ts', 'app/api/agenten/faden/route.ts', 'app/api/agenten/faden/lauf/route.ts', 'app/api/agenten/skills/route.ts',
    'app/api/agenten/laeufe/route.ts', 'app/api/medien/route.ts', 'tests/fixtures/agenten-api.ts',
  ];
  const FIRMEN = KERN_EINHEITEN.filter(e => e.id !== 'kdc').flatMap(e => [e.label, e.kurz]);
  it('keine Personennamen, kein fester Speichername, keine Firmen, keine Farbwerte im Katalog', () => {
    for (const d of dateien) {
      const t = readFileSync(path.join(WURZEL, d), 'utf8');
      expect(t, d).not.toMatch(/kevin|malin|marlene|kemaris|capos|dieckmann|make\.one/i);
      for (const f of FIRMEN) expect(new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t), `${d}: ${f}`).toBe(false);
    }
    expect(readFileSync(path.join(WURZEL, 'lib/agenten/katalog.ts'), 'utf8')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('Bestände: Namen, Speicher-Register, Konto-Export/-Löschen, Art. 17', () => {
  const NAMEN = {
    faeden: fadenBestand('p-x'), skills: skillsHaushaltBestand('h-x'), skillsPrivat: skillsPersonBestand('p-x'), plan: planBestand('p-x'),
    einstellung: einstellungBestand('h-x'), medien: medienBestand('h-x'), medienPrivat: medienPrivatBestand('p-x'),
  };
  const MUSTER: Record<keyof typeof NAMEN, string> = {
    faeden: 'agenten-faeden--*', skills: 'agenten-skills--*', skillsPrivat: 'agenten-skills-privat--*', plan: 'agenten-plan--*',
    einstellung: 'agenten-einstellung--*', medien: 'medien--*', medienPrivat: 'medien-privat--*',
  };
  it('jeder Name trifft GENAU sein Muster im Register — mit Rechtsgrundlage, Art.-15-Weg und Löschfrist', () => {
    for (const [k, name] of Object.entries(NAMEN) as [keyof typeof NAMEN, string][]) {
      const e = registerEintrag(name);
      expect(e?.muster, name).toBe(MUSTER[k]);
      expect(e?.rechtsgrundlage, name).toMatch(/Art\. 6/);
      expect(e?.art15?.length, name).toBeGreaterThan(20);
      expect(e?.loeschfrist?.length, name).toBeGreaterThan(10);
    }
    for (const m of Object.values(MUSTER)) expect(SPEICHER_REGISTER.filter(e => e.muster === m), m).toHaveLength(1);
  });
  it('Werkstatt: Ebene Person → Bestand der Person, Ebene Haushalt → der des Haushalts (ohne Haushalt keiner)', () => {
    expect(werkstattBestandFuer('person', { person: 'p-x', haushalt: 'h-x' })).toBe('agenten-skills-privat--p-x');
    expect(werkstattBestandFuer('haushalt', { person: 'p-x', haushalt: 'h-x' })).toBe('agenten-skills--h-x');
    expect(werkstattBestandFuer('haushalt', { person: 'p-x', haushalt: null })).toBeNull();
  });
  it('Bestände je Person gehören zu Konto-Export/-Löschen (immer mit Suffix), die des Haushalts sind begründet eingeordnet', () => {
    for (const basis of ['agenten-faeden', 'agenten-skills-privat', 'agenten-plan', 'medien-privat']) {
      expect(PERSON_BESTAENDE.find(b => b.basis === basis)?.nurMitSuffix, basis).toBe(true);
    }
    for (const m of ['agenten-skills--*', 'agenten-einstellung--*', 'medien--*']) expect(NICHT_PERSOENLICH[m]?.length, m).toBeGreaterThan(10);
  });
  it('Art. 17: Threads, Werkstatt, Hintergrundaufgaben und Medien werden getilgt (person-weitere.ts)', () => {
    for (const [k, name] of Object.entries(NAMEN) as [keyof typeof NAMEN, string][]) {
      if (k === 'einstellung') continue; // keine Inhalte, keine Dritten (Speichername → Konto-Löschen, Paket 4)
      const w = WEITERE_SPEICHER.filter(s => s.muster.test(name));
      expect(w.map(s => s.name), name).toEqual([MUSTER[k]]);
      expect(w[0].behandlung).toBe('tilgen');
    }
  });
});

describe('Routen: Register und Stubs', () => {
  const ERWARTET: Record<string, Record<string, string>> = {
    'agenten': { GET: 'person' },
    'agenten/faden': { GET: 'person', POST: 'person' },
    'agenten/faden/lauf': { POST: 'dienst' },
    'agenten/skills': { GET: 'person', POST: 'person' },
    'agenten/laeufe': { GET: 'person', POST: 'person' },
    'medien': { GET: 'person', POST: 'person' },
  };
  it('alle Agenten-Routen stehen mit festen Methoden und Klassen im Register', () => {
    for (const [pfad, m] of Object.entries(ERWARTET)) {
      expect(existsSync(path.join(WURZEL, 'app/api', pfad, 'route.ts')), pfad).toBe(true);
      expect(ROUTEN_REGISTER[pfad]?.methoden, pfad).toEqual(m);
    }
  });

  type H = (r: Request) => Promise<Response>;
  const route = async (pfad: string) => await import(`@/app/api/${pfad}/route`) as unknown as Record<string, H>;
  const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
  const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
  const rufe = async (pfad: string, m: string, kopf: Record<string, string>) =>
    (await (await route(pfad))[m](new Request(`http://test/api/${pfad}`, { method: m, headers: kopf, ...(m === 'GET' ? {} : { body: '{}' }) }))).status;

  /** Routen, deren Paket den Stub schon ersetzt hat. */
  const GEBAUT = new Set(['medien']);
  it('Stubs: ohne Sitzung, fremder Haushalt, Testkunde, Dienstweg → 401/403; im Haushalt → 501', async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [
      konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }),
      konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' }),
      konto('k3', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
      konto('k4', 'kunde', 'mitglied'),
    ], einladungen: [] });

    for (const [pfad, methoden] of Object.entries(ERWARTET)) for (const [m, klasse] of Object.entries(methoden)) {
      const ohne = await rufe(pfad, m, { 'content-type': 'application/json' });
      expect([401, 403], `${pfad} ${m} ohne Sitzung`).toContain(ohne);
      expect(await rufe(pfad, m, sitzung('gast')), `${pfad} ${m} fremder Haushalt`).toBe(403);
      expect(await rufe(pfad, m, sitzung('kunde')), `${pfad} ${m} Testkunde`).toBe(403);
      if (klasse === 'person') {
        expect(await rufe(pfad, m, dienst('person-a')), `${pfad} ${m} Dienstweg mit Person`).toBe(403);
        expect(await rufe(pfad, m, dienst()), `${pfad} ${m} Dienstweg ohne Person`).toBe(403);
        // Gebaute Pakete ersetzen ihren Stub (Paket 5 „Medien“, 09.10.): im Haushalt dann eine echte Antwort, nie 401/403/501.
        if (GEBAUT.has(pfad)) expect([401, 403, 501], `${pfad} ${m} im Haushalt (gebaut)`).not.toContain(await rufe(pfad, m, sitzung('person-b')));
        else expect(await rufe(pfad, m, sitzung('person-b')), `${pfad} ${m} im Haushalt`).toBe(501);
      } else {
        expect(await rufe(pfad, m, sitzung('person-a')), `${pfad} ${m} Sitzung statt Dienstweg`).toBe(403);
        expect(await rufe(pfad, m, dienst()), `${pfad} ${m} Dienstweg ohne Person`).toBe(401);
        expect(await rufe(pfad, m, dienst('gast')), `${pfad} ${m} Dienstweg mit fremder Person`).toBe(403);
        expect(await rufe(pfad, m, dienst('person-b')), `${pfad} ${m} Dienstweg mit Person im Haushalt`).toBe(501);
      }
    }
  });
});

describe('Vertrag: Stapel-Arten, Agenten-Schlüssel, Fixture', () => {
  it('die Stapel-Arten des Agenten-Bereichs gehören zu StapelArt (Freigabe baut Paket 3)', () => {
    const arten: StapelArt[] = [...AGENTEN_STAPEL_ARTEN];
    expect(arten).toEqual(['skill', 'mitarbeiter', 'merksatz']);
  });
  it('agentSchluessel ist eindeutig je Agent', () => {
    expect(agentSchluessel({ art: 'zoe' })).toBe('zoe');
    expect(agentSchluessel({ art: 'head', headId: 'sales' })).toBe('head:sales');
    expect(agentSchluessel({ art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-angebote' })).toBe('mitarbeiter:sales:sales-angebote');
  });
  it('das Fixture passt zum Katalog: Heads, Mitarbeiter, Threads, Läufe, Als Nächstes', () => {
    for (const h of FIX.AGENTEN.heads) {
      const def = headDef(h.id)!;
      expect(def, h.id).toBeTruthy();
      for (const m of h.mitarbeiter) expect(def.mitarbeiter.map(x => x.id), `${h.id}: ${m.id}`).toContain(m.id);
    }
    expect(FIX.FADEN_MITARBEITER.elternId).toBe(FIX.FADEN_HEAD.id);
    expect(FIX.FADEN_HEAD.nachrichten.map(n => n.verweis?.art).filter(Boolean)).toEqual(['gesendet', 'bericht']);
    expect(FIX.SKILL.tests.length).toBeGreaterThanOrEqual(GRENZEN.skillTestsMin);
    for (const w of FIX.SKILL.werkzeuge) expect(headDef(FIX.SKILL.headId)!.werkzeuge, w).toContain(w);
    expect(new Set(FIX.LAEUFE.laeufe.map(l => l.status))).toEqual(new Set(['laeuft', 'fertig', 'fehler']));
    expect(FIX.LAEUFE.naechstes.map(n => n.quadrant)).toEqual(['q1', 'q2', 'q3', 'q4']);
    for (const f of [FIX.FADEN_HEAD, FIX.FADEN_MITARBEITER]) for (const n of f.nachrichten) expect(n.text.length).toBeLessThanOrEqual(GRENZEN.nachrichtZeichen);
  });
});
