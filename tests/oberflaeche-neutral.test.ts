// ─── Wächter: keine festen Namen und keine Betreiber-Texte in der Oberfläche (14.10., Abnahme A1/A2) ─────────────────────────
// Die unabhängige Abnahme (14.10.) sah in einer fremden Instanz feste Namen der Gründer, feste Firmen und Betreiber-Anleitungen
// (Repo-Dateien, Ports, Befehle). Plattform-Regel: nichts Persönliches fest einbauen — eine leere oder fremde Instanz muss sauber aussehen.
// Namen kommen aus Konten, Team, lib/einheiten.ts oder dem Gesellschafts-Register; die Veranstaltungsmarke aus lib/crm/marke.ts
// (`MARKE_EVENTS`, je Instanz `NEXT_PUBLIC_MAKE_OS_EVENT_MARKE`); Betreiber-Schritte der Einrichtung gibt es nur in der Betreiber-Instanz
// (lib/betrieb/betreiber.ts `istBetreiberInstanz`).
//
// Geprüft werden die TEXTE (String-Literale, Vorlagen-Texte, JSX-Text) — Kommentare, Kennungen und Daten-Schlüssel (`'kevin'`, `kdv`)
// bleiben erlaubt. Ausnahmen nur in `ERLAUBT` mit Grund.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Neutrale Namen der festen Gesellschaften VOR allen Imports — sonst trügen die Vorgaben aus lib/einheiten.ts (unsere Instanz) die Treffer.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { label: 'Beispiel Beratung', kurz: 'Beratung' }, kdv: { label: 'Beispiel Holding', kurz: 'Holding' }, ug: { label: 'Beispiel Labs GmbH', kurz: 'Labs' } });
});

import {
  SCHRITTE, ETAPPEN, NEUSTART_ETAPPEN, NEUSTART, ABLAUF, ABLAUF_ALLGEMEIN, ABLAUF_NEUSTART, GRUPPEN, GRUPPEN_ALLGEMEIN, GRUPPEN_NEUSTART, EBENEN,
  ablaufFuer, schritteFuer, sichtbarFuer, betreiberBefundeWeg, BETREIBER_PRUEFUNGEN, einrichtungStand, type Schritt, type Kontext,
} from '@/lib/make-one/onboarding-data';
import { betreiberAus, betreiberNeutral, BETREIBER_WISSEN } from '@/lib/betrieb/betreiber';
import { fachNamen } from '@/lib/make-one/fach-namen';

const wurzel = path.resolve(__dirname, '..');

/** Was nie in einem sichtbaren Text stehen darf. */
const REGELN: { id: string; muster: RegExp; grund: string }[] = [
  { id: 'name', muster: /\b(?:Kevin|Malin)s?\b/, grund: 'Vorname einer Person der Gründer — Namen kommen aus Konten/Team' },
  { id: 'firma', muster: /KD Ventures|KD Management|\bKDV\b/, grund: 'feste Firma — Namen aus lib/einheiten.ts (finanzOrtName/finanzOrtKurz) oder dem Register' },
  { id: 'datei', muster: /\b(?:UPDATES|CLAUDE)\.md\b|\.env\.local\b|localhost:/, grund: 'Repo-Datei, lokale Umgebung oder Port — Betreiber-Wissen' },
  { id: 'befehl', muster: /\bgit\s+[a-z]|\bdocker\s+[a-z]/, grund: 'Server- bzw. Repo-Befehl — Betreiber-Wissen' },
  { id: 'marke', muster: /Make\.One/, grund: 'feste Veranstaltungsmarke — nur über MARKE_EVENTS (lib/crm/marke.ts)' },
];


/** Positivliste: Datei (relativ) + Regel + Ausschnitt des Texts — nur mit Grund. */
const ERLAUBT: { datei: string; regel: string; text: string; grund: string }[] = [
  { datei: 'lib/oauth.ts', regel: 'datei', text: 'http://localhost:3001', grund: 'Rückfall der Rückruf-Adresse nur ohne MAKE_OS_ADRESSE (lokale Entwicklung) — eine Adresse, kein angezeigter Satz; die Anleitung sieht nur die Betreiber-Instanz' },
  { datei: 'app/api/oauth/callback/route.ts', regel: 'datei', text: 'http://localhost:3001', grund: 'Weiterleitung nach dem Anbieter nur ohne öffentliche Adresse (lokale Entwicklung) — kein angezeigter Text' },
];

/** Weitere Dateien mit Texten an die Oberfläche (außerhalb von components/ und app/os). */
const WEITERE = ['lib/make-one/seiten.ts', 'lib/make-one/einstellungen.ts', 'lib/datenschutz/nachweise.ts', 'lib/crm/netzwerken.ts', 'lib/crm/besuche.ts',
  'lib/crm/planung.ts', 'lib/zoe/crm-bezug.ts', 'lib/steuern/rechnen.ts', 'lib/oauth.ts', 'lib/zoe-whatsapp/meta.ts', 'lib/make-one/backlog-data.ts',
  'lib/crm/scoring.ts', 'lib/crm/person-anlegen.ts', 'lib/crm/netzwerken-server.ts', 'lib/finanzen/handwerte.ts', 'lib/finanzen/annahmen-felder.ts',
  'lib/business/register.ts', 'lib/zoe/crm-werkzeuge.ts', 'lib/zoe/crm-werkzeug-defs.ts', 'lib/crm/speicher-register.ts', 'lib/datenschutz/einrichtung.ts',
  'lib/crm/loeschfristen.ts', 'lib/brain/vault-ziel.ts', 'lib/betrieb/betreiber.ts', 'lib/make-one/fach-namen.ts'];

function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const e of readdirSync(path.join(wurzel, ordner))) {
    const p = path.join(ordner, e);
    if (statSync(path.join(wurzel, p)).isDirectory()) aus.push(...dateien(p));
    else if (/\.(tsx?|mts)$/.test(e) && !e.endsWith('.d.ts')) aus.push(p);
  }
  return aus;
}

/** Alle sichtbaren Texte einer Datei: String-Literale, Vorlagen-Teile, JSX-Text — ohne Importe und Typ-Literale. */
function texte(datei: string): { text: string; zeile: number }[] {
  const src = readFileSync(path.join(wurzel, datei), 'utf8');
  const sf = ts.createSourceFile(datei, src, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aus: { text: string; zeile: number }[] = [];
  const merke = (n: ts.Node, text: string) => { if (text.trim()) aus.push({ text, zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 }); };
  const besuch = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n) || ts.isExternalModuleReference(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) merke(n, n.text);
    else if (ts.isTemplateExpression(n)) { merke(n.head, n.head.text); for (const s of n.templateSpans) merke(s.literal, s.literal.text); }
    else if (ts.isJsxText(n)) merke(n, n.text);
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return aus;
}

const erlaubt = (datei: string, regel: string, text: string) => ERLAUBT.some(e => e.datei === datei && e.regel === regel && text.includes(e.text));

describe('Oberfläche: keine festen Namen, Firmen, Marken und Betreiber-Texte', () => {
  it('components/, app/os und Texte in lib (Liste WEITERE)', () => {
    const liste = [...dateien('components'), ...dateien('app/os'), ...WEITERE];
    const funde: string[] = [];
    for (const d of liste) {
      for (const t of texte(d)) {
        for (const r of REGELN) if (r.muster.test(t.text) && !erlaubt(d, r.id, t.text)) funde.push(`${d}:${t.zeile} [${r.id}] ${t.text.trim().slice(0, 140)}`);
      }
    }
    expect(funde, `Feste Texte in der Oberfläche:\n${funde.join('\n')}`).toEqual([]);
  });

  it('Antworten der Schnittstellen (app/api): keine Repo-Dateien, lokalen Umgebungen oder Ports in Texten', () => {
    const funde: string[] = [];
    const r = REGELN.find(x => x.id === 'datei')!;
    for (const d of dateien('app/api')) for (const t of texte(d)) if (r.muster.test(t.text) && !erlaubt(d, r.id, t.text)) funde.push(`${d}:${t.zeile} ${t.text.trim().slice(0, 140)}`);
    expect(funde, funde.join('\n')).toEqual([]);
  });

  it('die Positivliste trägt nur Einträge, die es noch gibt (keine toten Ausnahmen)', () => {
    for (const e of ERLAUBT) {
      const r = REGELN.find(x => x.id === e.regel)!;
      expect(texte(e.datei).some(t => r.muster.test(t.text) && t.text.includes(e.text)), `${e.datei}: ${e.text}`).toBe(true);
    }
  });
});

/** Alle Texte eines Schritts (auch die neutrale Fassung). */
const schrittTexte = (s: Schritt): string[] => [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '', s.wartetAuf ?? '', s.beispiel ?? '',
  s.allgemein?.titel ?? '', s.allgemein?.warum ?? '', ...(s.allgemein?.wie ?? []), s.allgemein?.danach ?? ''].filter(Boolean);

describe('Einrichtung (lib/make-one/onboarding-data.ts): Texte', () => {
  it('nie Namen oder feste Firmen — auch nicht in Betreiber-Schritten', () => {
    const funde: string[] = [];
    const pruefe = (wo: string, text: string) => { for (const r of REGELN.filter(x => x.id === 'name' || x.id === 'firma' || x.id === 'marke')) if (r.muster.test(text)) funde.push(`${wo} [${r.id}] ${text.slice(0, 140)}`); };
    for (const s of SCHRITTE) for (const t of schrittTexte(s)) pruefe(s.id, t);
    for (const e of [...ETAPPEN, ...NEUSTART_ETAPPEN]) for (const t of [e.titel, e.satz, e.allgemein?.titel ?? '', e.allgemein?.satz ?? '', ...(e.hinweise ?? []).flatMap(h => [h.titel, h.satz, h.wann])]) pruefe(`Etappe ${e.nr}`, t);
    for (const a of [...ABLAUF, ...ABLAUF_ALLGEMEIN, ...ABLAUF_NEUSTART]) pruefe(`Ablauf ${a.wann}`, `${a.wann} ${a.was} ${a.ohneBetreiber ?? ''}`);
    for (const g of [GRUPPEN, GRUPPEN_ALLGEMEIN, GRUPPEN_NEUSTART]) for (const x of Object.values(g)) pruefe('Gruppe', `${x.titel} ${x.satz}`);
    for (const n of NEUSTART) pruefe(`Neustart ${n.id}`, JSON.stringify(n.texte ?? {}));
    for (const e of EBENEN) pruefe(`Ebene ${e.id}`, `${e.titel} ${e.satz}`);
    expect(funde, funde.join('\n')).toEqual([]);
  });

  it('Repo-Dateien, Server-Pfade, Befehle und Ports nur in Betreiber-Schritten (`betreiber: true`)', () => {
    const funde: string[] = [];
    for (const s of SCHRITTE.filter(x => !x.betreiber)) for (const t of schrittTexte(s)) if (BETREIBER_WISSEN.test(t)) funde.push(`${s.id}: ${t.slice(0, 140)}`);
    for (const e of [...ETAPPEN, ...NEUSTART_ETAPPEN]) for (const h of (e.hinweise ?? []).filter(x => !x.nurAltbestand)) if (BETREIBER_WISSEN.test(`${h.titel} ${h.satz}`)) funde.push(`Etappe ${e.nr} · ${h.titel}`);
    for (const a of [...ABLAUF_ALLGEMEIN, ...ABLAUF_NEUSTART]) if (BETREIBER_WISSEN.test(a.ohneBetreiber ?? (a.betreiber ? '' : a.was))) funde.push(`Ablauf ${a.wann}`);
    for (const n of NEUSTART) { const s = SCHRITTE.find(x => x.id === n.id); if (!s?.betreiber && BETREIBER_WISSEN.test(JSON.stringify(n.texte ?? {}))) funde.push(`Neustart ${n.id}`); }
    expect(funde, funde.join('\n')).toEqual([]);
  });

  it('jeder Schritt mit Server-Befehl ist ein Betreiber-Schritt', () => {
    expect(SCHRITTE.filter(s => (s.befehl || s.server) && !s.betreiber).map(s => s.id)).toEqual([]);
  });
});

describe('Betreiber-Instanz: EINE Regel (lib/betrieb/betreiber.ts, rein)', () => {
  const ohne = { demo: false, umgebung: undefined, neustartMarke: false, altbestand: false };
  it('ohne Marke und ohne Einstellung: keine Betreiber-Instanz (neue bzw. fremde Instanz)', () => {
    expect(betreiberAus(ohne)).toBe(false);
  });
  it('die Marke des Neustarts (unsere Live-Instanz) oder ein Altbestand machen sie zur Betreiber-Instanz — ohne neuen Server-Schritt', () => {
    expect(betreiberAus({ ...ohne, neustartMarke: true })).toBe(true);
    expect(betreiberAus({ ...ohne, altbestand: true })).toBe(true);
  });
  it('MAKE_OS_BETREIBER=an|aus übersteuert; alles andere zählt nicht', () => {
    expect(betreiberAus({ ...ohne, umgebung: 'an' })).toBe(true);
    expect(betreiberAus({ ...ohne, neustartMarke: true, umgebung: 'aus' })).toBe(false);
    expect(betreiberAus({ ...ohne, neustartMarke: true, umgebung: ' AUS ' })).toBe(false);
    expect(betreiberAus({ ...ohne, umgebung: 'ja' })).toBe(false);
  });
  it('Demo-Riegel: in der Demo IMMER aus — auch mit Marke und mit MAKE_OS_BETREIBER=an', () => {
    expect(betreiberAus({ demo: true, umgebung: 'an', neustartMarke: true, altbestand: true })).toBe(false);
  });
});

describe('Einrichtung: Betreiber-Schritte nur in der Betreiber-Instanz, EINE Zählung', () => {
  const inhaber = (betreiber: boolean, extra: Partial<Kontext> = {}): Kontext => ({ inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, betreiber, ...extra });
  it('ohne Betreiber-Instanz: kein Betreiber-Schritt sichtbar oder zählbar — auch nicht im Neustart', () => {
    for (const k of [inhaber(false), inhaber(false, { neustart: true }), inhaber(false, { altbestand: true })]) {
      const ids = schritteFuer(k).map(s => s.id);
      expect(ids.filter(id => SCHRITTE.find(s => s.id === id)?.betreiber)).toEqual([]);
      expect(SCHRITTE.filter(s => s.betreiber).every(s => !sichtbarFuer(s, k))).toBe(true);
    }
  });
  it('in der Betreiber-Instanz bleiben sie (Inhaber)', () => {
    expect(schritteFuer(inhaber(true)).some(s => s.betreiber)).toBe(true);
  });
  it('Ablauf ohne Betreiber: keine Zeile „am Server“, neutrale Texte', () => {
    for (const neustart of [false, true]) {
      const l = ablaufFuer(false, neustart, false);
      expect(l.some(a => /Server/.test(a.wann))).toBe(false);
      expect(l.map(a => a.was).filter(t => BETREIBER_WISSEN.test(t))).toEqual([]);
    }
    expect(ablaufFuer(false, false, true).some(a => /Server/.test(a.wann))).toBe(true);
  });
  it('Befunde der Betreiber-Schritte gehen an eine fremde Instanz gar nicht erst raus', () => {
    expect(BETREIBER_PRUEFUNGEN.length).toBeGreaterThan(0);
    const befunde = Object.fromEntries([...BETREIBER_PRUEFUNGEN, 'zwei-faktor', 'hoi'].map(k => [k, { erfuellt: true, wert: 'ja' }]));
    expect(Object.keys(betreiberBefundeWeg(befunde, inhaber(false))).sort()).toEqual(['hoi', 'zwei-faktor']);
    expect(Object.keys(betreiberBefundeWeg(befunde, inhaber(true))).length).toBe(Object.keys(befunde).length);
  });
  it('„Einrichtung x von y“: EINE Zählung je Person, unabhängig vom Bereich (Heute Privat/Business, Einrichtungsseite, Startfläche)', () => {
    const k = inhaber(false);
    const z = { erledigt: {}, befunde: {} };
    const a = einrichtungStand(k, z);
    expect(a.gesamt).toBe(schritteFuer(k).filter(s => !s.optional).length);
    expect(einrichtungStand(k, z)).toEqual(a);
  });
});

describe('Head of IT in einer fremden Instanz: der Weg am Server wird neutral', () => {
  it('Sätze mit Repo-Datei, Pfad oder Befehl → „richtet der Betreiber ein“; andere bleiben', () => {
    expect(betreiberNeutral('Object Storage einrichten (deploy/medien-speicher-verbinden.sh, UPDATES.md 09.10.)')).toMatch(/Betreiber/);
    expect(betreiberNeutral('Variable entfernen, docker compose up -d')).toMatch(/Betreiber/);
    expect(betreiberNeutral('Speicher fast voll — alte Medien aus dem Papierkorb löschen')).toBe('Speicher fast voll — alte Medien aus dem Papierkorb löschen');
  });
});

describe('Fächer der Daten (`kevin`/`malin` als Kennung) → Namen aus den Konten', () => {
  it('gleicher Speichername gewinnt, sonst die Reihenfolge; ohne Person ein neutraler Platzhalter', () => {
    expect(fachNamen([{ id: 'malin', name: 'Mia' }, { id: 'kevin', name: 'Kai' }])).toMatchObject({ kevin: 'Kai', malin: 'Mia', belegt: ['kevin', 'malin'] });
    expect(fachNamen([{ id: 'lena', name: 'Lena' }, { id: 'jonas', name: 'Jonas' }])).toMatchObject({ kevin: 'Lena', malin: 'Jonas' });
    expect(fachNamen([{ id: 'lena', name: 'Lena' }])).toMatchObject({ kevin: 'Lena', malin: 'Person 2', belegt: ['kevin'] });
    expect(fachNamen([])).toMatchObject({ kevin: 'Person 1', malin: 'Person 2', belegt: [] });
  });
});
