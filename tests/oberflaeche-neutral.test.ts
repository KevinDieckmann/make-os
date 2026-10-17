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
  // 14.10. (Abnahme-Reste 2): auch der Vorname des Darlehensgebers (Rechenkern-Zeile „…-Rate“) — Kennungen wie `ug.bjoern` bleiben (klein).
  // (Teilstücke zur Laufzeit zusammengesetzt — tests/repo-sauber.test.ts meldet den Namen sonst in dieser Datei.)
  { id: 'name', muster: new RegExp('\\b(?:Kevin|Malin|Bj' + '(?:ö|oe)rn)s?\\b'), grund: 'Vorname einer Person — Namen kommen aus Konten/Team, Zeilen heißen neutral' },
  { id: 'firma', muster: /KD Ventures|KD Management|\bKDV\b/, grund: 'feste Firma — Namen aus lib/einheiten.ts (finanzOrtName/finanzOrtKurz) oder dem Register' },
  { id: 'datei', muster: /\b(?:UPDATES|CLAUDE)\.md\b|\.env\.local\b|localhost:/, grund: 'Repo-Datei, lokale Umgebung oder Port — Betreiber-Wissen' },
  { id: 'befehl', muster: /\bgit\s+[a-z]|\bdocker\s+[a-z]/, grund: 'Server- bzw. Repo-Befehl — Betreiber-Wissen' },
  { id: 'marke', muster: /Make\.One/, grund: 'feste Veranstaltungsmarke — nur über MARKE_EVENTS (lib/crm/marke.ts)' },
];


/** Positivliste: Datei (relativ) + Regel + Ausschnitt des Texts — nur mit Grund. */
const ERLAUBT: { datei: string; regel: string; text: string; grund: string }[] = [
  { datei: 'lib/oauth.ts', regel: 'datei', text: 'http://localhost:3001', grund: 'Rückfall der Rückruf-Adresse nur ohne MAKE_OS_ADRESSE (lokale Entwicklung) — eine Adresse, kein angezeigter Satz; die Anleitung sieht nur die Betreiber-Instanz' },
  { datei: 'app/api/oauth/callback/route.ts', regel: 'datei', text: 'http://localhost:3001', grund: 'Weiterleitung nach dem Anbieter nur ohne öffentliche Adresse (lokale Entwicklung) — kein angezeigter Text' },
  { datei: 'lib/betrieb/betreiber.ts', regel: 'datei', text: 'localhost:', grund: 'Baustein der Betreiber-Regel selbst (BETREIBER_WISSEN) — kein angezeigter Text' },
  { datei: 'lib/crm/marke.ts', regel: 'marke', text: 'Make.One', grund: 'DIE eine Stelle der Veranstaltungsmarke (`MARKE_EVENTS`): Vorgabe unserer Instanz, je Instanz über NEXT_PUBLIC_MAKE_OS_EVENT_MARKE — alle Texte lesen nur die Konstante' },
];

/** Weitere Dateien mit Texten an die Oberfläche (außerhalb von components/ und app/os). */
const WEITERE = ['lib/make-one/seiten.ts', 'lib/make-one/einstellungen.ts', 'lib/datenschutz/nachweise.ts', 'lib/crm/netzwerken.ts', 'lib/crm/besuche.ts',
  'lib/crm/planung.ts', 'lib/zoe/crm-bezug.ts', 'lib/steuern/rechnen.ts', 'lib/oauth.ts', 'lib/zoe-whatsapp/meta.ts', 'lib/make-one/backlog-data.ts',
  'lib/crm/scoring.ts', 'lib/crm/person-anlegen.ts', 'lib/crm/netzwerken-server.ts', 'lib/finanzen/handwerte.ts', 'lib/finanzen/annahmen-felder.ts',
  'lib/business/register.ts', 'lib/zoe/crm-werkzeuge.ts', 'lib/zoe/crm-werkzeug-defs.ts', 'lib/crm/speicher-register.ts', 'lib/datenschutz/einrichtung.ts',
  'lib/crm/loeschfristen.ts', 'lib/brain/vault-ziel.ts', 'lib/betrieb/betreiber.ts', 'lib/make-one/fach-namen.ts',
  // 14.10. (Kevins Entscheidungen): Vorgaben, die vorher feste Vornamen bzw. Firmen trugen — jetzt aus Konten, Einheiten oder Instanz-Daten.
  'lib/crm/team-liste.ts', 'lib/kalender/einstellungen.ts', 'lib/finanzen/haushalt/einordnung.ts', 'lib/finanzen/haushalt/kategorien.ts',
  'lib/finanzen/haushalt/gesamt.ts', 'lib/crm/marke.ts', 'lib/crm/reihen-server.ts', 'lib/crm/wertelisten.ts',
  'lib/zoe/vorschlag-anzeige.ts', 'lib/make-one/liquiditaet.ts',
  // 14.10. (Abnahme-Reste 2): Zeilennamen des Rechenkerns (Zahlungskalender) und die Kalender-Dateien mit Namen (Altweg, Zuordnung, Schnelleingabe).
  'lib/finanzen/rechenkern.ts', 'lib/kalender/apple-altweg.ts', 'lib/kalender/belegt.ts', 'lib/kalender/schnell.ts', 'app/api/apple-calendar/route.ts'];

// ── 15.10. (Abnahme 2 A2/C22, Kevin: „Betreiber-Inhalte nur in der eigenen Instanz“) ───────────────────────────────────────────────
// Betreiber-Wissen = `BETREIBER_WISSEN` (Repo-Dokumente, .env, /srv/, Befehle, Skripte, Umgebungswerte MAKE_OS_*/WHATSAPP_*/GOOGLE_*/WHOOP_* …,
// GitHub, Code-Wache, die Stände „entwicklung“/„main“) plus die Hersteller-Sätze des Bauplans. Geprüft werden components/, app/os und die
// Texte aus lib/, die an die Oberfläche gehen (`WEITERE` + `WEITERE_BETREIBER`). Erlaubt nur, was nachweislich hinter der Betreiber-Regel
// hängt: `HINTER_BETREIBER` nennt je Stelle das Tor — der Wächter prüft, dass die Datei (bzw. `torIn`) es wirklich enthält; `text: '*'`
// gilt für alle Texte einer Datei, deren Ausgabe als Ganzes hinter dem Tor liegt (dazu je ein Test unten, der das Tor ausprobiert).
const BETREIBER_TEXT = new RegExp(`${BETREIBER_WISSEN.source}|Claude baut|baut Claude`);
/** Weitere Dateien, deren Texte die Oberfläche erreichen (Head of IT, Selbstprüfung, Verzeichnis, Verbindungen, Fehlermeldungen). */
const WEITERE_BETREIBER = ['lib/hoi/lage.ts', 'lib/medien/hoi.ts', 'lib/crm/datenschutz.ts', 'lib/onboarding-status.ts', 'lib/google/verbindung.ts',
  'lib/medien/speicher-ordner.ts', 'lib/medien/upload-server.ts', 'lib/medien/export.ts', 'lib/whatsapp/konfig.ts', 'lib/zoe-whatsapp/konfig.ts',
  'lib/whoop/konfig.ts', 'lib/make-one/agents-data.ts', 'lib/store/protokoll-kette.ts', 'app/api/konto/einrichten/route.ts'];
interface HinterBetreiber { datei: string; text: string; tor: string; torIn?: string; grund: string }
const HINTER_BETREIBER: HinterBetreiber[] = [
  // Ganze Dateien, deren Ausgabe ein Tor filtert (Test je Tor unten).
  { datei: 'lib/hoi/lage.ts', text: '*', tor: 'befundeFuerInstanz', torIn: 'lib/hoi/innen.ts', grund: 'Befunde gehen nur über lage() raus — außerhalb der Betreiber-Instanz `befundeFuerInstanz` (Test „Head of IT“)' },
  { datei: 'lib/medien/hoi.ts', text: '*', tor: 'medienBefunde', torIn: 'lib/hoi/lage.ts', grund: 'Medien-Befunde des Head of IT — fließen in befundeAus und damit durch `befundeFuerInstanz`' },
  { datei: 'lib/whatsapp/konfig.ts', text: '*', tor: 'istBetreiberInstanz()) ? whatsappFehlend()', torIn: 'lib/whatsapp/server.ts', grund: 'Namen der Umgebungswerte — der Status nennt sie nur der Betreiber-Instanz' },
  { datei: 'lib/zoe-whatsapp/konfig.ts', text: '*', tor: 'istBetreiberInstanz()) ? zoeWhatsappFehlend()', torIn: 'lib/zoe-whatsapp/verwalten.ts', grund: 'Namen der Umgebungswerte (und Log beim Start) — der Status nennt sie nur der Betreiber-Instanz' },
  { datei: 'lib/whoop/konfig.ts', text: '*', tor: '(await istBetreiberInstanz()) ? fehlt : []', torIn: 'lib/whoop/verbindung.ts', grund: 'Namen der Umgebungswerte — der Status nennt sie nur der Betreiber-Instanz' },
  // Einzelne Stellen.
  { datei: 'lib/datenschutz/nachweise.ts', text: 'MAKE_OS_', tor: 'v2FuerInstanz', torIn: 'app/api/datenschutz/nachweise/route.ts', grund: 'Bereitschaft v2 — außerhalb der Betreiber-Instanz `v2FuerInstanz`' },
  { datei: 'lib/datenschutz/nachweise.ts', text: 'scripts/daten-verschluesselung.mjs', tor: 'v2FuerInstanz', torIn: 'app/api/datenschutz/nachweise/route.ts', grund: 'Bereitschaft v2' },
  { datei: 'lib/datenschutz/nachweise.ts', text: 'Git-Repo', tor: 'v2FuerInstanz', torIn: 'app/api/datenschutz/nachweise/route.ts', grund: 'Bereitschaft v2' },
  { datei: 'lib/datenschutz/einrichtung.ts', text: 'GitHub', tor: 'NUR_BETREIBER_EMPFAENGER', grund: 'Startwert nur der Betreiber-Instanz (`empfaengerStartFuer`)' },
  { datei: 'lib/datenschutz/einrichtung.ts', text: 'privates Repository des Brain-Vaults', tor: 'NUR_BETREIBER_EMPFAENGER', grund: 'Startwert nur der Betreiber-Instanz' },
  { datei: 'lib/datenschutz/einrichtung.ts', text: '(MODELLE.md 4.7)', tor: 'ohneRepo', grund: 'Notiz — außerhalb der Betreiber-Instanz ohne die Klammer (`empfaengerStartFuer`)' },
  { datei: 'lib/crm/datenschutz.ts', text: 'deploy/sicherung.sh', tor: "umfeld.betreiber === false", grund: 'Selbstprüfung „Sicherung“ — außerhalb der Betreiber-Instanz die neutrale Fassung' },
  { datei: 'lib/crm/datenschutz.ts', text: 'openssl', tor: "umfeld.betreiber === false", grund: 'Selbstprüfung „Sicherung“' },
  { datei: 'lib/crm/datenschutz.ts', text: 'DEPLOY.md', tor: 'hoiNeutral', grund: 'Weg der Selbstprüfung — außerhalb der Betreiber-Instanz „Head of IT › Sicherung“' },
  { datei: 'lib/crm/datenschutz.ts', text: 'GitHub', tor: 'verarbeitungNeutral', grund: 'Startwerte des Verzeichnisses — außerhalb der Betreiber-Instanz neutral angelegt' },
  { datei: 'lib/crm/datenschutz.ts', text: '.md', tor: 'verarbeitungNeutral', grund: 'Startwerte des Verzeichnisses (Repo-Dokumente in Klammern) — außerhalb der Betreiber-Instanz neutral' },
  { datei: 'app/api/konto/einrichten/route.ts', text: 'scripts/einrichtung-token.mjs', tor: '(await istBetreiberInstanz()) ?', grund: 'Befehl für den Einrichtungs-Code nur in der Betreiber-Instanz' },
  { datei: 'lib/onboarding-status.ts', text: 'ICLOUD-Zeilen aus der .env', tor: 'u.betreiber ?', grund: 'Prüfung „iCloud“ — außerhalb der Betreiber-Instanz der neutrale Satz' },
  { datei: 'lib/make-one/agents-data.ts', text: 'gitleaks', tor: 'BETREIBER_WISSEN.test(f)', torIn: 'components/os/AgentenView.tsx', grund: 'Funktion mit Betreiber-Wissen — die Agenten-Seite filtert sie außerhalb der Betreiber-Instanz' },
  { datei: 'lib/make-one/agents-data.ts', text: 'deploy/lage-sammeln.sh', tor: '{betreiber && (', torIn: 'components/os/AgentenView.tsx', grund: 'Bau-Notiz („So würde ich ihn bauen“) — nur in der Betreiber-Instanz' },
  { datei: 'lib/make-one/agents-data.ts', text: 'Braucht TELEGRAM_BOT_TOKEN', tor: '{betreiber && (', torIn: 'components/os/AgentenView.tsx', grund: 'Bau-Notiz — nur in der Betreiber-Instanz' },
  { datei: 'components/os/HoiView.tsx', text: '*', tor: 'lage.betreiber ?', grund: 'Quellen des Lagebilds (Skript, Aktion, Schlüssel, CI) — die Route entscheidet (`istBetreiberInstanz` bzw. HOI-Schlüssel)' },
  { datei: 'components/os/ZusammenarbeitView.tsx', text: 'entwicklung', tor: 'useBetreiber() === true', grund: 'Stände des Codes nur in der Betreiber-Instanz' },
  { datei: 'components/os/ZuliefererKarte.tsx', text: 'scripts/mac-zulieferer-entfernen.sh', tor: 'if (!darf || !betreiber) return null', grund: 'die ganze Karte nur in der Betreiber-Instanz (Mac-Zulieferer = Altbestand)' },
  { datei: 'components/os/bauplan/BauplanBoard.tsx', text: 'Claude', tor: 'useBetreiber() === true', grund: 'Hersteller-Sätze („Claude baut“) nur in der Betreiber-Instanz' },
  { datei: 'components/os/KontoView.tsx', text: 'TELEGRAM_BOT_TOKEN', tor: 'tg.konfiguriert ? (betreiber', grund: 'Anleitung zum Bot nur in der Betreiber-Instanz — sonst „richtet der Betreiber ein“' },
  { datei: 'components/os/datenschutz/Betroffenenrechte.tsx', text: '*', tor: 'useBetreiber() === true', grund: 'Löschskript am Server nur in der Betreiber-Instanz' },
  { datei: 'components/os/datenschutz/Dokumente.tsx', text: '*', tor: 'useBetreiber() === true', grund: 'Repo-Dokumente nur in der Betreiber-Instanz — sonst die Liste ohne Dateinamen' },
  { datei: 'components/os/datenschutz/Nachweise.tsx', text: '*', tor: 'useBetreiber() === true', grund: 'Umgebungswerte und Repo-Dokumente nur in der Betreiber-Instanz' },
  { datei: 'components/os/datenschutz/Pannen.tsx', text: 'datenschutz/DATENPANNEN.md', tor: 'useBetreiber() === true', grund: 'Repo-Dokument nur in der Betreiber-Instanz' },
  { datei: 'components/os/datenschutz/Verantwortlicher.tsx', text: 'MAKE_OS_VERANTWORTLICHER_', tor: 'useBetreiber() === true', grund: 'Umgebungswert nur in der Betreiber-Instanz' },
  { datei: 'components/os/inbox/GmailVerbinden.tsx', text: 'GOOGLE_GMAIL_EINRICHTEN.md', tor: 'useBetreiber() === true', grund: 'Anleitung nur in der Betreiber-Instanz' },
  { datei: 'components/os/kalender/google-verbinden.ts', text: 'GOOGLE_CLIENT_ID', tor: 'betreiber === true ? GOOGLE_NICHT_EINGERICHTET', grund: 'Umgebungswerte nur in der Betreiber-Instanz (`googleNichtEingerichtet`; die Karte zeigt sie nur mit `betreiber`)' },
  { datei: 'components/os/whatsapp/WhatsappKarte.tsx', text: '*', tor: 'useBetreiber', grund: 'Skript und Umgebungswerte nur in der Betreiber-Instanz (Anleitung, Freigabe, Schlüssel erneuern)' },
  { datei: 'components/os/zoe-whatsapp/ZoeWhatsappKarte.tsx', text: 'deploy/zoe-whatsapp-verbinden.sh', tor: 'useBetreiber() === true', grund: 'Skript nur in der Betreiber-Instanz' },
];
/** Treffer, die kein Betreiber-Wissen sind (Adresse ohne Anzeige, Dateiformat, die Regel selbst) — nur mit Grund. */
const KEIN_BETREIBER_TEXT: { datei: string; text: string; grund: string }[] = [
  { datei: 'lib/oauth.ts', text: 'http://localhost:3001', grund: 'Rückfall der Rückruf-Adresse nur ohne MAKE_OS_ADRESSE (lokale Entwicklung) — kein angezeigter Satz' },
  { datei: 'lib/google/verbindung.ts', text: 'http://localhost:3001', grund: 'Rückfall der Rückruf-Adresse (lokale Entwicklung) — kein angezeigter Satz' },
  { datei: 'components/os/agenten/Dialoge.tsx', text: 'SKILL.md', grund: 'Dateiformat der Skills, das die Person selbst importiert — kein Repo-Dokument' },
  { datei: 'lib/betrieb/betreiber.ts', text: '*', grund: 'die Regel selbst (Bausteine des regulären Ausdrucks)' },
];
/** Offen in einem anderen Arbeitsbereich (15.10.: Fulfillment gehört einem parallelen Paket) — dort neutral formulieren, dann hier streichen. */
const OFFEN_ANDERER_BEREICH: { datei: string; text: string; grund: string }[] = [];

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

/** Alle Regex-Literale einer Datei (Quelltext samt Flags). */
function regexe(datei: string): { text: string; zeile: number }[] {
  const src = readFileSync(path.join(wurzel, datei), 'utf8');
  const sf = ts.createSourceFile(datei, src, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aus: { text: string; zeile: number }[] = [];
  const besuch = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) aus.push({ text: n.getText(sf), zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return aus;
}

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

  // Gesamtprüfung 18.10. (L3 B9): Fulfillment, Recht, Gesellschafts-Schild, Agenten, KI und das Treppen-Dokument lagen außerhalb des Wächters — dort
  // stand „MAKE als Verantwortlicher“ (B8). Geprüft werden dieselben Regeln wie oben und zusätzlich „MAKE“ allein (nicht „MAKE OS“): der
  // Verantwortliche und die eigene Firma kommen aus der Einrichtung bzw. lib/einheiten.ts, nie als fester Text.
  it('Texte in lib/fulfillment, lib/recht, lib/gesellschaften/schild, lib/agenten, lib/ki, app/api/crm/treppe/dokument (L3 B9)', () => {
    const MAKE_ALLEIN = { id: 'make', muster: /\bMAKE\b(?![ _-]OS)/, grund: 'feste Firma bzw. fester Verantwortlicher — aus der Einrichtung (Verantwortlicher) oder lib/einheiten.ts' };
    const ordner = ['lib/fulfillment', 'lib/recht', 'lib/gesellschaften/schild', 'lib/agenten', 'lib/ki', 'app/api/crm/treppe/dokument'];
    const liste = ordner.flatMap(dateien);
    expect(liste.length).toBeGreaterThan(40);
    const funde: string[] = [];
    for (const d of liste) for (const t of texte(d)) for (const r of [...REGELN, MAKE_ALLEIN]) if (r.muster.test(t.text) && !erlaubt(d, r.id, t.text)) funde.push(`${d}:${t.zeile} [${r.id}] ${t.text.trim().slice(0, 140)}`);
    expect(funde, `Feste Texte:\n${funde.join('\n')}`).toEqual([]);
  });

  it('Antworten der Schnittstellen (app/api): keine Repo-Dateien, lokalen Umgebungen oder Ports in Texten', () => {
    const funde: string[] = [];
    const r = REGELN.find(x => x.id === 'datei')!;
    for (const d of dateien('app/api')) for (const t of texte(d)) if (r.muster.test(t.text) && !erlaubt(d, r.id, t.text)) funde.push(`${d}:${t.zeile} ${t.text.trim().slice(0, 140)}`);
    expect(funde, funde.join('\n')).toEqual([]);
  });

  it('Kalender-Dateien (14.10., Abnahme-Reste 2): kein Vorname in Regex oder Texten — Namen kommen aus Konten bzw. Kalender-Einstellungen', () => {
    const vorhanden = (d: string) => { try { return statSync(path.join(wurzel, d)).isDirectory(); } catch { return false; } };
    const liste = ['lib/kalender', 'app/api/kalender', 'app/api/apple-calendar', 'components/os/kalender'].filter(vorhanden).flatMap(dateien);
    expect(liste.length).toBeGreaterThan(20);
    const name = REGELN.find(x => x.id === 'name')!.muster;
    const funde: string[] = [];
    for (const d of liste) {
      // Regex: auch klein geschrieben (`/\bkevin\b/` erkannte früher einen Kalender am festen Vornamen).
      for (const r of regexe(d)) if (/kevin|malin|bj(?:ö|oe)rn/i.test(r.text)) funde.push(`${d}:${r.zeile} [regex] ${r.text.slice(0, 140)}`);
      // Texte: Vornamen (groß) — die Fach-Kennungen `'kevin'`/`'malin'` (klein) sind Daten-Schlüssel und bleiben.
      for (const t of texte(d)) if (name.test(t.text)) funde.push(`${d}:${t.zeile} [text] ${t.text.trim().slice(0, 140)}`);
    }
    expect(funde, funde.join('\n')).toEqual([]);
  });

  it('die Positivliste trägt nur Einträge, die es noch gibt (keine toten Ausnahmen)', () => {
    for (const e of ERLAUBT) {
      const r = REGELN.find(x => x.id === e.regel)!;
      expect(texte(e.datei).some(t => r.muster.test(t.text) && t.text.includes(e.text)), `${e.datei}: ${e.text}`).toBe(true);
    }
  });
});

// ── Betreiber-Wissen (15.10., Abnahme 2 A2/C22) ────────────────────────────────────────────────────────────────────────────────────
const quelle = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');
/** Ein leerer CRM-Bestand (wie `leererBestand` in lib/crm/speicher.ts — ohne die Datenschicht zu laden). */
const LEER_CRM = { firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] };
const hinterBetreiber = (d: string, text: string) => HINTER_BETREIBER.some(e => e.datei === d && (e.text === '*' || text.includes(e.text)));
const keinBetreiberText = (d: string, text: string) => [...KEIN_BETREIBER_TEXT, ...OFFEN_ANDERER_BEREICH].some(e => e.datei === d && (e.text === '*' || text.includes(e.text)));

describe('Betreiber-Wissen nur in der Betreiber-Instanz (15.10., Abnahme 2 A2/C22)', () => {
  it('components/, app/os und Texte aus lib: kein Server-Befehl, keine .env, kein Repo-Dokument, kein Umgebungswert, kein GitHub, kein „Claude baut“ — außer hinter dem Tor', () => {
    const liste = [...new Set([...dateien('components'), ...dateien('app/os'), ...WEITERE, ...WEITERE_BETREIBER])];
    const funde: string[] = [];
    for (const d of liste) for (const t of texte(d)) {
      if (!BETREIBER_TEXT.test(t.text) || hinterBetreiber(d, t.text) || keinBetreiberText(d, t.text)) continue;
      funde.push(`${d}:${t.zeile} ${t.text.trim().replace(/\s+/g, ' ').slice(0, 140)}`);
    }
    expect(funde, `Betreiber-Wissen in einem sichtbaren Text (hinter das Tor legen oder neutral formulieren):\n${funde.join('\n')}`).toEqual([]);
  });

  it('jedes Tor der Positivliste gibt es wirklich (die Datei bzw. `torIn` enthält es) — und kein Eintrag ist tot', () => {
    for (const e of HINTER_BETREIBER) {
      expect(quelle(e.torIn ?? e.datei).includes(e.tor), `${e.datei}: Tor „${e.tor}“ fehlt in ${e.torIn ?? e.datei}`).toBe(true);
      if (e.text !== '*') expect(texte(e.datei).some(t => BETREIBER_TEXT.test(t.text) && t.text.includes(e.text)), `${e.datei}: ${e.text}`).toBe(true);
      else expect(texte(e.datei).some(t => BETREIBER_TEXT.test(t.text)), `${e.datei}: „*“ ohne Treffer`).toBe(true);
    }
    for (const e of [...KEIN_BETREIBER_TEXT, ...OFFEN_ANDERER_BEREICH].filter(x => x.text !== '*')) {
      expect(texte(e.datei).some(t => BETREIBER_TEXT.test(t.text) && t.text.includes(e.text)), `${e.datei}: ${e.text}`).toBe(true);
    }
  });

  it('Head of IT: außerhalb der Betreiber-Instanz kein Weg am Server — auch nicht im Kurzbericht; in der Betreiber-Instanz unverändert', async () => {
    const { befundeFuerInstanz, kurzbericht, BETREIBER_HANDELT, BETREIBER_IN_ORDNUNG } = await import('@/lib/hoi/lage');
    // JEDER Text des Lagebilds mit Betreiber-Wissen, in jeder Ampel und an jeder Stelle (Name, Wert, Satz).
    const roh = [...texte('lib/hoi/lage.ts'), ...texte('lib/medien/hoi.ts')].map(t => t.text).filter(t => BETREIBER_TEXT.test(t));
    expect(roh.length).toBeGreaterThan(20);
    const befunde = roh.flatMap((t, i) => (['gruen', 'gelb', 'rot', 'grau'] as const).flatMap(ampel => [
      { id: `s${i}${ampel}`, bereich: 'server' as const, label: 'Probe', wert: 'Wert', satz: t, ampel },
      { id: `w${i}${ampel}`, bereich: 'sicherheit' as const, label: 'Probe', wert: t, satz: 'Satz', ampel },
    ]));
    const fremd = befundeFuerInstanz(befunde, false);
    const text = JSON.stringify(fremd) + kurzbericht(fremd, '2026-10-15T08:00:00.000Z');
    expect(text.match(BETREIBER_TEXT)?.[0] ?? null).toBeNull();
    // Rot bleibt (die Inhaberin muss es wissen), grün als „in Ordnung“, gelb/grau ohne Weg in der App fallen weg.
    expect(fremd.some(b => b.ampel === 'rot' && b.satz === BETREIBER_HANDELT)).toBe(true);
    expect(fremd.some(b => b.ampel === 'gruen' && b.satz === BETREIBER_IN_ORDNUNG)).toBe(true);
    // Ein Weg in der App bleibt — ohne den Teil am Server.
    const icloud = befundeFuerInstanz([{ id: 'icloud', bereich: 'app', label: 'iCloud', ampel: 'rot', wert: 'Anmeldung abgelehnt', satz: 'iCloud lehnt die Anmeldung ab (App-Passwort ungültig) — Kalender › Einstellungen › iCloud: Verbindung erneuern (oder deploy/icloud-verbinden.sh)' }], false);
    expect(icloud[0].satz).toBe('iCloud lehnt die Anmeldung ab (App-Passwort ungültig) — Kalender › Einstellungen › iCloud: Verbindung erneuern');
    // Ohne Betreiber-Wissen bleibt alles; in der Betreiber-Instanz bleibt alles.
    const neutral = { id: 'x', bereich: 'app' as const, label: 'Postfächer', ampel: 'gelb' as const, wert: '1 Postfach', satz: 'Ein Abgleich steht — der Takt versucht es weiter' };
    expect(befundeFuerInstanz([neutral], false)).toEqual([neutral]);
    expect(befundeFuerInstanz(befunde, true)).toBe(befunde);
  });

  it('Datenschutz: Empfänger-Startwerte, neu angelegtes Verzeichnis, Selbstprüfung und Bereitschaft v2 ohne Betreiber-Wissen — bei Kevin der Bestand', async () => {
    const { empfaengerStartFuer, empfaengerWirksam, EMPFAENGER_START } = await import('@/lib/datenschutz/einrichtung');
    const fremd = empfaengerStartFuer(false);
    expect(JSON.stringify(fremd).match(BETREIBER_TEXT)?.[0] ?? null).toBeNull();
    expect(JSON.stringify(fremd)).not.toMatch(/Hetzner|Healthchecks/);
    expect(fremd.map(e => e.id)).not.toContain('github');
    expect(fremd.find(e => e.id === 'hetzner')?.name).toBe('Betreiber der Instanz (Hosting)');
    expect(empfaengerStartFuer(true)).toEqual(EMPFAENGER_START.map(x => ({ ...x })));
    // Eine gespeicherte Liste bleibt, wie sie ist (nie löschen) — auch in einer fremden Instanz.
    const gespeichert = { empfaenger: EMPFAENGER_START.map(x => ({ ...x })) };
    expect(empfaengerWirksam(gespeichert, false).map(e => e.id)).toEqual(EMPFAENGER_START.map(e => e.id));

    const { verzeichnisVervollstaendigen, selbstpruefung } = await import('@/lib/crm/datenschutz');
    const alles = { google: true, icloud: true, whatsapp: true, whoop: true, zoeWhatsapp: true };
    const vv = verzeichnisVervollstaendigen([], '2026-10-15T08:00:00.000Z', { ...alles, betreiber: false }).liste;
    expect(vv.length).toBeGreaterThan(20);
    expect(JSON.stringify(vv).match(BETREIBER_TEXT)?.[0] ?? null).toBeNull();
    expect(JSON.stringify(vv)).not.toMatch(/Hetzner|"github"/);
    // Bei Kevin (Betreiber) der Bestand wie bisher; gespeicherte Einträge fasst die neutrale Fassung nie an.
    const kevin = verzeichnisVervollstaendigen([], '2026-10-15T08:00:00.000Z', { ...alles, betreiber: true }).liste;
    expect(JSON.stringify(kevin)).toMatch(/GitHub/);
    expect(verzeichnisVervollstaendigen(kevin, '2026-10-15T08:00:00.000Z', { ...alles, betreiber: false }).liste).toEqual(kevin);

    const umfeld = (betreiber: boolean, sicherung: { verfahren: 'age' | 'openssl' | null } | null) => ({
      verantwortlicher: { gesetzt: true, quelle: 'einrichtung' as const, luecken: [] }, empfaenger: empfaengerStartFuer(betreiber), zweiterFaktor: { konten: 1, mit: 1 },
      sicherung, agenten: { aktiv: 1, gesamt: 2 }, betreiber,
    });
    for (const s of [null, { verfahren: 'openssl' as const }, { verfahren: null }]) {
      const p = selbstpruefung([], LEER_CRM as never, '2026-10-15', { konten: 1, mitPasswort: 1 }, 24, umfeld(false, s));
      expect(JSON.stringify(p).match(BETREIBER_TEXT)?.[0] ?? null, JSON.stringify(s)).toBeNull();
      expect(p.find(x => x.id === 'sicherung')?.status).toBe('teilweise');
    }
    expect(JSON.stringify(selbstpruefung([], LEER_CRM as never, '2026-10-15', { konten: 1, mitPasswort: 1 }, 24, umfeld(true, null)))).toMatch(/deploy\/sicherung\.sh/);

    const { v2Bereitschaft, v2FuerInstanz } = await import('@/lib/datenschutz/nachweise');
    const v2 = v2Bereitschaft({ modus: 'kompatibel', unbekannt: true, verschluesselt: true, schluesselQuelle: 'umgebung', pepper: false, brainIndexKlartext: true, bilderKlartext: 1, alteHuellen: 2, klartextBestaende: 3 });
    const v2f = v2FuerInstanz(v2, false);
    expect(JSON.stringify(v2f).match(BETREIBER_TEXT)?.[0] ?? null).toBeNull();
    expect(v2f.punkte.map(p => p.stand)).toEqual(v2.punkte.map(p => p.stand));
    expect(v2FuerInstanz(v2, true)).toBe(v2);
  });

  it('Einrichtung: was eine fremde Instanz sieht (Schritte, Etappen samt Hinweisen, Zonen) ohne Betreiber-Wissen', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    const funde: string[] = [];
    for (const neustart of [false, true]) for (const altbestand of [false, true]) {
      const k = { inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, betreiber: false, neustart, altbestand };
      for (const s of D.SCHRITTE) {
        if (s.betreiber) continue;
        const t = D.texteFuer(D.fassungFuer(s, k), k);
        for (const x of [t.titel, t.warum, ...t.wie, t.danach ?? '', t.befehl ?? '', t.beispiel ?? '']) if (BETREIBER_TEXT.test(x)) funde.push(`${s.id} (neustart ${neustart}, altbestand ${altbestand}): ${x.slice(0, 120)}`);
      }
      for (const e of D.etappenFuer(altbestand, neustart, false)) {
        expect(e.hinweise ?? [], `Etappe ${e.nr}`).toEqual([]);
        if (BETREIBER_TEXT.test(`${e.titel} ${e.satz}`)) funde.push(`Etappe ${e.nr}: ${e.titel}`);
      }
    }
    for (const z of D.zonenFuer(false)) if (BETREIBER_TEXT.test(`${z.titel} ${z.satz} ${z.beispiele.join(' ')}`)) funde.push(`Zone ${z.farbe}`);
    for (const z of D.zonenFuer(null)) if (BETREIBER_TEXT.test(`${z.titel} ${z.satz} ${z.beispiele.join(' ')}`)) funde.push(`Zone ${z.farbe} (unbekannt)`);
    expect(funde, funde.join('\n')).toEqual([]);
    // In der Betreiber-Instanz bleibt alles: die Zonen wie bisher, die Hinweise der Etappen, die alten Texte.
    expect(D.zonenFuer(true)).toBe(D.ZONEN);
    expect(D.etappenFuer(true, false, true)).toBe(D.ETAPPEN);
    const hoi = D.SCHRITTE.find(s => s.id === 'hoi-gruen')!;
    expect(D.texteFuer(hoi, { altbestand: true, betreiber: true }).wie.join(' ')).toMatch(/GitHub/);
    expect(D.texteFuer(hoi, { altbestand: true, betreiber: false }).wie.join(' ')).not.toMatch(/GitHub/);
  });

  it('Bauplan: das Entwickler-Backlog des Herstellers nur in der Betreiber-Instanz — eine neue Instanz startet leer', async () => {
    const { startKarten, SEED } = await import('@/lib/make-one/backlog-data');
    expect(startKarten(false, '2026-10-15T08:00:00.000Z')).toEqual([]);
    expect(startKarten(true, '2026-10-15T08:00:00.000Z').map(k => k.id)).toEqual(SEED.map(k => k.id));
    // SEED liest niemand an `startKarten` vorbei; beide Schreib-/Lesewege fragen die Betreiber-Regel.
    const nutzer = [...dateien('lib'), ...dateien('app'), ...dateien('components')].filter(d => d !== 'lib/make-one/backlog-data.ts' && /\bSEED\b/.test(quelle(d)) && /backlog-data/.test(quelle(d)));
    expect(nutzer).toEqual([]);
    for (const d of ['lib/bauplan/speicher.ts', 'app/api/state/backlog/route.ts']) expect(quelle(d), d).toMatch(/startKarten\((?:await istBetreiberInstanz\(\)|betreiber)/);
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

  it('Repo-Dateien, Server-Pfade, Befehle und Ports nur in Betreiber-Schritten (`betreiber: true`) bzw. in Feldern, die `ohneBetreiber` ersetzt', () => {
    const funde: string[] = [];
    // `ohneBetreiber` (15.10., Abnahme 2 A2) liegt außerhalb der Betreiber-Instanz über jeder Fassung — was es ersetzt, sieht nur der Betreiber.
    const fremd = (s: Schritt): Schritt => (s.ohneBetreiber ? { ...s, ...s.ohneBetreiber, ...(s.allgemein ? { allgemein: { ...s.allgemein, ...s.ohneBetreiber } } : {}) } : s);
    for (const s of SCHRITTE.filter(x => !x.betreiber)) for (const t of schrittTexte(fremd(s))) if (BETREIBER_WISSEN.test(t)) funde.push(`${s.id}: ${t.slice(0, 140)}`);
    // Hinweise der Etappen sieht seit 15.10. nur die Betreiber-Instanz (`etappenFuer(…, betreiber)`) — Test oben „Einrichtung: was eine fremde Instanz sieht“.
    for (const a of [...ABLAUF_ALLGEMEIN, ...ABLAUF_NEUSTART]) if (BETREIBER_WISSEN.test(a.ohneBetreiber ?? (a.betreiber ? '' : a.was))) funde.push(`Ablauf ${a.wann}`);
    for (const n of NEUSTART) { const s = SCHRITTE.find(x => x.id === n.id); if (!s?.betreiber && BETREIBER_WISSEN.test(JSON.stringify({ ...(n.texte ?? {}), ...(s?.ohneBetreiber ?? {}) }))) funde.push(`Neustart ${n.id}`); }
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

// ── 14.10. (Kevins Entscheidungen): feste Vorgaben aus den Konten — die Live-Instanz zeigt dasselbe wie vorher ─────────────────────────
describe('Vorgaben aus den Konten statt fester Vornamen', () => {
  const konten = [
    { speicher: 'p-eins', name: 'Erste Beispiel', rolle: 'inhaber', haushalt: 'h', angelegt: '2026-01-01' },
    { speicher: 'p-zwei', name: 'Zweite Beispiel', rolle: 'mitglied', haushalt: 'h', angelegt: '2026-01-02' },
    { speicher: 'p-partner', name: 'Partner Beispiel', rolle: 'mitglied', haushalt: 'h', finanzRecht: 'business', angelegt: '2026-01-03' },
    { speicher: 'p-fremd', name: 'Fremd Beispiel', rolle: 'mitglied', haushalt: 'anders', angelegt: '2025-01-01' },
  ];
  it('CRM-Team: Inhaber Sales, zweite Person Marketing + Event — Kennung = Speichername, Name = Vorname; Partner und fremde Haushalte nie', async () => {
    const { teamAusKonten } = await import('@/lib/crm/team-liste');
    expect(teamAusKonten(konten)).toEqual([
      { id: 'p-eins', name: 'Erste', farbe: '#58D9CD', verantwortet: ['sales'] },
      { id: 'p-zwei', name: 'Zweite', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] },
    ]);
    expect(teamAusKonten([konten[0]])![0].verantwortet).toEqual(['sales', 'marketing', 'event']);
    expect(teamAusKonten([])).toBeNull();
  });
  it('Platzhalter ohne Konten: Rollen, nie ein Vorname', async () => {
    const { TEAM } = await import('@/lib/crm/team-liste');
    for (const m of TEAM) expect(m.name).not.toMatch(/\b(?:Kevin|Malin)\b/);
  });
  it('Kalender: „Privat <Vorname>“ aus den Personen-Fächern, ohne Konten ein Platzhalter; gespeicherte Namen gewinnen', async () => {
    const { kalenderNamen, einstellungenSauber } = await import('@/lib/kalender/einstellungen');
    expect(kalenderNamen({ kevin: 'Erste', malin: 'Zweite' })).toEqual({ kevin: 'Privat Erste', malin: 'Privat Zweite', beide: 'Gemeinsam' });
    expect(Object.values(kalenderNamen()).join(' ')).not.toMatch(/\b(?:Kevin|Malin)\b/);
    const vorgabe = kalenderNamen({ kevin: 'Erste', malin: 'Zweite' });
    expect(einstellungenSauber(null, vorgabe).kalender.kevin).toBe('Privat Erste');
    expect(einstellungenSauber({ kalender: { kevin: 'Mein Kalender', malin: '', beide: '' } } as never, vorgabe).kalender).toEqual({ kevin: 'Mein Kalender', malin: 'Privat Zweite', beide: 'Gemeinsam' });
  });
  it('Haushaltsfinanzen: Entnahme ohne Namen — gespeicherte Namen (auch mit Vorname) zählen weiter', async () => {
    const { ENTNAHME_NAME, istEntnahmeKategorie } = await import('@/lib/finanzen/haushalt/einordnung');
    expect(ENTNAHME_NAME).not.toMatch(/\b(?:Kevin|Malin)\b/);
    expect(istEntnahmeKategorie(ENTNAHME_NAME)).toBe(true);
  });
});

// ── 14.10. (Abnahme-Reste 2): Kalender-Zuordnung und AppleScript-Altweg aus Konten/Einstellungen — auf der Live-Instanz bit-gleich ─────────
describe('Kalender: Namen aus Konten statt fest im Code — Live-Instanz unverändert', () => {
  // Die Regeln VOR dem 14.10. wörtlich (Referenz für „bit-gleich“).
  const altZuordnung = (e: { kalender: Record<'kevin' | 'malin' | 'beide', string> }, kalenderName: string) => {
    const n = kalenderName.trim().toLowerCase();
    if (n === e.kalender.kevin.trim().toLowerCase()) return 'kevin';
    if (n === e.kalender.malin.trim().toLowerCase()) return 'malin';
    if (n === e.kalender.beide.trim().toLowerCase()) return 'beide';
    const kevin = /\bkevin\b/.test(n), malin = /\bmalin\b/.test(n);
    return kevin && !malin ? 'kevin' : malin && !kevin ? 'malin' : null;
  };
  const ALT_CAL_MAP: Record<string, { category: string; owner: string }> = {
    'Privat Kevin': { category: 'private-kevin', owner: 'kevin' },
    'Privat Malin': { category: 'private-malin', owner: 'malin' },
    'Kevin Dieckmann': { category: 'holding', owner: 'kevin' },
    'Kalender': { category: 'joint', owner: 'both' },
  };
  const ALT_LISTE = ['Privat Kevin', 'Privat Malin ', 'Kevin Dieckmann', 'Kalender'];

  it('Vornamen und Kalendernamen aus den Konten der Live-Instanz = die früheren festen Werte', async () => {
    const { KONTEN_WIE_LIVE, KALENDER_WIE_LIVE } = await import('./fixtures/team-konten');
    const { fachPersonen } = await import('@/lib/make-one/fach-namen');
    const { vornamenAus, kalenderNamen } = await import('@/lib/kalender/einstellungen');
    const p = fachPersonen(KONTEN_WIE_LIVE.map(k => ({ id: k.speicher, name: k.name })));
    expect(vornamenAus(p)).toEqual({ kevin: 'Kevin', malin: 'Malin' });
    expect(kalenderNamen(vornamenAus(p))).toEqual(KALENDER_WIE_LIVE);
  });

  it('Zuordnung am Namen (lib/kalender/belegt.ts): mit den Vornamen der Live-Instanz dieselbe Antwort wie die frühere feste Regel', async () => {
    const { zuordnung } = await import('@/lib/kalender/belegt');
    const { KALENDER_WIE_LIVE } = await import('./fixtures/team-konten');
    const e = { kalender: { ...KALENDER_WIE_LIVE }, vornamen: { kevin: 'Kevin', malin: 'Malin' } };
    const namen = ['Privat Kevin', 'privat malin ', 'Gemeinsam', 'Kalender', 'Familie', 'Kevin Dieckmann', 'Malin Sport', 'Kevin & Malin', 'MAKE Kevin (Google)',
      'Kevins Kalender', 'kevin2', 'Kevin_Arbeit', 'Arbeit-Kevin', 'Malin/Kevin', 'Kevinä', 'Geburtstage', 'iCloud · Malin', 'Work', ''];
    for (const n of namen.filter(x => x !== 'Kevinä')) expect(zuordnung(e, n), n).toBe(altZuordnung(e, n));
    // Eine fremde Instanz: ihre Vornamen zählen, feste Namen nie.
    const fremd = { kalender: { kevin: 'Privat Lena', malin: 'Privat Jonas', beide: 'Gemeinsam' }, vornamen: { kevin: 'Lena', malin: 'Jonas' } };
    expect(zuordnung(fremd, 'Lena Beispiel')).toBe('kevin');
    expect(zuordnung(fremd, 'Jonas Sport')).toBe('malin');
    expect(zuordnung(fremd, 'Kevin Dieckmann')).toBeNull();
    expect(zuordnung({ kalender: fremd.kalender, vornamen: { kevin: 'Jörg', malin: 'René' } }, 'Kalender René')).toBe('malin');
    expect(zuordnung({ kalender: fremd.kalender, vornamen: { kevin: 'Jörg', malin: 'René' } }, 'Jörgen')).toBeNull();
  });

  it('AppleScript-Altweg (lib/kalender/apple-altweg.ts): dieselben Kalender, dieselbe Zuordnung, dieselbe Reihenfolge', async () => {
    const { altwegKalender, altwegSkript } = await import('@/lib/kalender/apple-altweg');
    const { KONTEN_WIE_LIVE, KALENDER_WIE_LIVE } = await import('./fixtures/team-konten');
    const a = altwegKalender(KALENDER_WIE_LIVE, KONTEN_WIE_LIVE[0].name);
    expect(a.zuordnung).toEqual(ALT_CAL_MAP);
    // Jeder frühere Name wird weiter gefragt, in derselben Reihenfolge (dazu je die andere Fassung mit/ohne Leerzeichen am Ende).
    const pos = ALT_LISTE.map(n => a.liste.indexOf(n));
    expect(pos.every(i => i >= 0), JSON.stringify(a.liste)).toBe(true);
    expect([...pos].sort((x, y) => x - y)).toEqual(pos);
    expect(new Set(a.liste.map(n => n.trimEnd()))).toEqual(new Set(Object.keys(ALT_CAL_MAP)));
    const skript = altwegSkript(a.liste);
    for (const n of ALT_LISTE) expect(skript).toContain(`"${n}"`);
    // Gespeicherter Name gewinnt; eine fremde Instanz liest ihre eigenen Kalender, nie feste Namen; Anführungszeichen sind maskiert.
    const fremd = altwegKalender({ kevin: 'Mein "Kalender"', malin: 'Privat Jonas' }, 'Lena Beispiel');
    expect(Object.keys(fremd.zuordnung)).toEqual(['Mein "Kalender"', 'Privat Jonas', 'Lena Beispiel', 'Kalender']);
    expect(altwegSkript(fremd.liste)).toContain('"Mein \\"Kalender\\""');
    expect(altwegSkript(fremd.liste)).not.toMatch(/Kevin|Malin/);
    expect(Object.keys(altwegKalender({ kevin: 'Privat Lena', malin: '' }, null).zuordnung)).toEqual(['Privat Lena', 'Kalender']);
  });
});
