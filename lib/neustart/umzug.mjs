// ─── Neustart-Umzug: neue leere Instanz — Kartei, Markttraktion und eigene Aufgaben kommen mit (09.10.2026) ──────────────
// Kevin 09.10.: „Wir können alles aus [neu] machen, aber die Kundendaten und Datensätze und Infos werden mit übernommen. Das ist
// der Kern unserer Arbeit … das muss unbedingt passieren: Datensätze, Kontakte etc. mit.“ Entschieden: neuer Datenordner auf dem
// Server, der alte bleibt als Archiv liegen (nie gelöscht, Rückweg offen). Mit kommen Kartei + CRM (Markttraktion komplett) samt
// der rechtlich nötigen Nachweise, die CRM-Dateiablage und die eigenen Aufgaben; alles andere beginnt leer und kommt über die
// Einrichtung. Konten nie (neue Konten, neuer zweiter Faktor).
//
// Dieses Modul ist der REINE Kern (kein Dateizugriff): Entscheidungstabelle je Bestand, Aufgaben-Filter, Dateien der Aufgaben,
// Abbildung von Speicher-/Haushaltsnamen, Zähler, Fingerabdrücke, Verweis-Prüfung. Den Ablauf mit Dateien macht
// lib/neustart/umzug-lauf.mjs, die Kommandozeile scripts/neustart-umzug.mjs (Anleitung: UPDATES.md › 09.10.2026 — Neustart-Umzug).
// Bewusst .mjs (wie lib/store/huelle.mjs): das Skript läuft im Container des Servers — dort gibt es keinen TS-Lader (jiti ist nur
// Entwicklungs-Abhängigkeit, `npm prune --omit=dev` im Dockerfile). Typen: umzug.d.mts. Tests: tests/neustart-umzug.test.ts.
//
// Grundsatz „nichts gekürzt“: Kartei, CRM und alle anderen mitgenommenen Bestände gehen UNVERÄNDERT (Text für Text) in den neuen
// Ordner — einzige Ausnahmen: der Aufgaben-Bestand und die Aufgaben-Dateien (gefiltert, Regeln unten) und, nur wenn ausdrücklich
// verlangt, die Abbildung alter Speicher-/Haushaltsnamen (`--person alt=neu`, `--haushalt alt=neu`).

import { createHash, createHmac, randomUUID } from 'node:crypto';

export const UMZUG_VERSION = 1;
/** Marke im NEUEN Datenordner (Klartext wie system/lage.json: nur Datum, Quelle, Zähler, Bestandsnamen — keine Inhalte). */
export const NEUSTART_MARKE = 'system/neustart.json';
/** Bestandsnamen wie in lib/store/local-db.ts (`NAME_OK`). */
export const BESTAND_NAME = /^[a-z0-9][a-z0-9-]*$/;
/** Speicher- und Haushaltsnamen (lib/finanzen/haushalt/zugriff.ts `HAUSHALT_OK`, lib/zugang/konten.ts `speicherName`). */
export const NAME_OK = /^[a-z0-9][a-z0-9-]{0,39}$/;

// ── Entscheidung je Bestand ───────────────────────────────────────────────────────────────────────────────────────────────
// art: kartei · crm · pflicht · netzwerken · dateien · aufgaben · marke. `bearbeiten` nennt die Bestände, die der Lauf filtert.

/** Was mitkommt — mit Grund (steht so im Bericht). Muster mit `*` wie im Speicher-Register (lib/crm/speicher-register.ts). */
export const MITNEHMEN = Object.freeze([
  { muster: 'kontakte', art: 'kartei', grund: 'Kartei: alle Personen mit Einwilligungen (samt Nachweis), Werbesperren, Einschränkungen (Art. 18), Stationen, E-Mail-Adressen, Aktivitäten und privaten Notizen je Person — unverändert.' },
  { muster: 'crm', art: 'crm', grund: 'Markttraktion komplett: Firmen, Leads, Deals, Mandate, Produkte, Angebote, Follow-ups, Kampagnen, Segmente, Beiträge, Newsletter, Events, Teilnahmen, Power-Hour-Sitzungen, Betroffenenanträge, Verzeichnis (Art. 30), Wertelisten — unverändert.' },
  { muster: 'crm-sperrliste--*', art: 'pflicht', grund: 'Pflicht: Werbesperren und Löschungen (nur Fingerabdrücke) — ohne sie legte ein Import gesperrte oder gelöschte Personen neu an.' },
  { muster: 'crm-loeschprotokoll', art: 'pflicht', grund: 'Pflicht: Nachweis der Löschungen nach Art. 17 (Rechenschaft, Art. 5 Abs. 2) — nur Protokoll-IDs.' },
  { muster: 'kennung-alias--*', art: 'pflicht', grund: 'Pflicht: alte Kontakt-Links (Kennungs-Umzug) leiten weiter.' },
  { muster: 'uebergabe-journal--*', art: 'pflicht', grund: 'Pflicht: Nachweis der Übermittlungen an Kunden (Art. 19), 36 Monate.' },
  { muster: 'events-geloescht', art: 'pflicht', grund: 'Pflicht: wartende Netzwerken-Erfassungen legen bewusst gelöschte Events nicht neu an.' },
  { muster: 'datenschutz-pannen', art: 'pflicht', grund: 'Pflicht: Dokumentation der Datenpannen (Art. 33 Abs. 5) — nur Kategorien und Zahlen, keine Namen.' },
  { muster: 'datenschutz-migration', art: 'pflicht', grund: 'Marke der Umrechnung v1 → v2 je Pepper — gehört zur Sperrliste (sonst rechnet der Löschfristen-Lauf noch einmal um).' },
  { muster: 'crm-dateien--*', art: 'dateien', grund: 'CRM-Dateiablage: Verträge, Angebote, Rechnungs-PDFs, Einwilligungs-Belege, Fotos und Sprachnotizen aus dem Netzwerken — alle Einträge samt Dateien.' },
  { muster: 'crm-import-konflikte', art: 'crm', grund: 'Offene Import-Konflikte und mögliche Dubletten (Entscheidungen von Hand).' },
  { muster: 'crm-import-laeufe--*', art: 'crm', grund: 'Import-Läufe — „rückgängig“ bleibt 30 Tage möglich.' },
  { muster: 'crm-scoring', art: 'crm', grund: 'Scoring-Einstellungen (MQL/SQL) — sonst rechneten Leads mit dem Standard und zeigten andere Zahlen.' },
  { muster: 'crm-loeschfristen', art: 'crm', grund: 'Eingestellte Löschfristen der Kartei (Stammdaten › Datenschutz).' },
  { muster: 'traktion-index', art: 'crm', grund: 'Traktions-Index: Verlauf und eigene Schwellen (nur Zahlen).' },
  { muster: 'traktion-verlauf', art: 'crm', grund: 'Verlauf der Markttraktion je Tag (nur Zahlen).' },
  { muster: 'prospects', art: 'crm', grund: 'Prospecting-Zielliste.' },
  { muster: 'netzwerk', art: 'kartei', grund: 'Kartei-Altbestand (LinkedIn vor der Kartei) — unverändert, damit nichts verloren geht.' },
  { muster: 'kunden', art: 'kartei', grund: 'Kartei-Altbestand (Kunden) — unverändert, damit nichts verloren geht.' },
  { muster: 'stammdaten', art: 'kartei', grund: 'Kartei-Altbestand (Stammdaten-Listen) — unverändert, damit nichts verloren geht.' },
  { muster: 'netzwerken-erfassungen--*', art: 'netzwerken', grund: 'Netzwerken-Journal: ohne es legten Erfassungen, die noch am Handy warten, Personen doppelt an.' },
  { muster: 'visitenkarten--*', art: 'netzwerken', grund: 'Eigene Visitenkarten je Person (Netzwerken).' },
  { muster: 'tasks', art: 'aufgaben', bearbeiten: 'aufgaben', grund: 'Eigene Aufgaben: Projekte, Listen, Aufgaben samt Unteraufgaben, eigene Status, Vorlagen — ohne Papierkorb, ohne „Neu anfangen“-Archiv, ohne Aufgaben der Module, die leer beginnen; Meilenstein-Listen ziehen ins Projekt „Übernommen“ ihres Space.' },
  { muster: 'aufgaben-dateien--*', art: 'aufgaben', bearbeiten: 'aufgaben-dateien', grund: 'Dateien der übernommenen Projekte und Aufgaben (und jede Datei, die eine Einwilligung belegt).' },
  { muster: 'planung-einheiten--*', art: 'aufgaben', grund: 'Werteliste der Einheiten, die die übernommenen Aufgaben tragen.' },
  { muster: 'ordnung', art: 'aufgaben', grund: 'Ort von Hand an Aufgaben (entscheidet Privat/Business bei Altaufgaben) und Reihenfolge der Themen.' },
  { muster: 'datenschutz-grabsteine', art: 'marke', bearbeiten: 'grabstein-marke', grund: 'Marke „Grabsteine angewendet“ — nur, wenn die Kartei nach dem jetzigen Stand der Grabsteine bereinigt ist; sonst wendet die neue Instanz sie an.' },
]);

/** Ausdrücklich NICHT (CRM-/Kartei-nah — mit Grund). Alles Übrige: `bereichVon`. Mit `--auch` lässt sich jede Zeile hier übernehmen. */
export const NICHT_MITNEHMEN = Object.freeze([
  { muster: 'head-*', grund: 'Head-Vorschläge, Berichte, Lernstand und Gedächtnis der Heads — Agenten beginnen leer.' },
  { muster: 'heads-replay-*', grund: 'Replay-Fälle der Heads — Agenten beginnen leer.' },
  { muster: 'crm-signale', grund: 'Merker des Kalender-Signals (Altbestand) — der Kalender beginnt leer.' },
  { muster: 'kalender-bezug', grund: 'Bezüge Termin ↔ Kontakt/Firma/Deal — der Kalender beginnt leer. Meetings bleiben als Aktivität am Kontakt; mit `--auch kalender-bezug` übernehmbar.' },
  { muster: 'buchung--*', grund: 'Buchungsseiten und Terminbuchungen gehören zum Kalender (beginnt leer) — geteilte Buchungslinks hören damit auf; mit `--auch buchung--<haushalt>` übernehmbar.' },
  { muster: 'gesellschaften--*', grund: 'Gesellschafts-Register (Steckbrief, Absender, Verträge) kommt über die Einrichtung › Unternehmen; mit `--auch gesellschaften--<haushalt>` übernehmbar.' },
  { muster: 'team--*', grund: 'Team des Haushalts kommt über die Einrichtung.' },
  { muster: 'absichten--*', grund: 'Absichtsprotokoll — offene Vorgänge müssen VORHER in der alten Instanz fertig laufen (der Lauf prüft das).' },
  { muster: 'datenschutz-einrichtung', grund: 'Verantwortlicher und Empfänger/AVV kommen über die Einrichtung (System › Datenschutz); mit `--auch datenschutz-einrichtung` übernehmbar.' },
  { muster: 'meldungen--*', grund: 'Glocke beginnt leer.' },
  { muster: 'crm-dateien', grund: 'Altname ohne Haushalt — nicht in Gebrauch.' },
]);

/** Nie — auch nicht mit `--auch`: Konten und Zugänge gehören zu den alten Konten (neue Konten, neuer zweiter Faktor, neu verbinden). */
export const NIE_MITNEHMEN = Object.freeze([
  'konten', 'oauth-tokens', 'oauth-states', 'google-oauth-zustand', 'whoop-oauth-zustand',
  'google-verbindung--*', 'icloud-verbindung--*', 'whoop-verbindung--*', 'postfach-zugang--*', 'demo-instanz',
]);

/** Bereich der übrigen Bestände (nur für den Bericht) — erstes passendes Muster. */
const BEREICHE = Object.freeze([
  [/^(finanz|finance|liquiplan|buchungen|rechnung|grundlage|business-|abschluss|mandate-tabelle|steuern|haushalt-|kontoauszug|konten--|privat-index|finanzchef|beleg)/, 'Finanzen, Steuern, Business-Index'],
  [/^(vitals|haut|streak|health|gesundheit|sport|ernaehrung|whoop|journal|kompass)/, 'Gesundheit, Sport, Ernährung, Journal'],
  [/^(ziele|meilenstein|routinen|wochenplan|nordstern|planung|kapazitaet|zeit|fokus|tageslauf|tagesstart|arbeitsmodus|arbeitsrahmen|gesundheitszeit|performance|anwesenheit|nutzung)/, 'Planung, Ziele, Routinen, Zeit'],
  [/^(kalender|calendar|apple-|kemaris|buchung)/, 'Kalender'],
  [/^(zoe|agent|heads?-|ki-|medien|content|delegation|anfragen-ergebnis|loop|brain|agents)/, 'ZOE, Agenten, KI, Medien'],
  [/^(inbox|gmail|imap|postfaecher|postfach|m365|microsoft|whatsapp|telegram)/, 'Inbox, Postfächer, Nachrichten'],
  [/^(familie)/, 'Familie & Partnerschaft'],
  [/^(aenderungsprotokoll|leseprotokoll|anmeldungen|protokoll-|aenderungen|ereignisse|client-fehler|agent-log|bauzeit)/, 'Protokolle (bleiben als Nachweis im Archiv-Ordner)'],
  [/^(onboarding|flaeche|dashboard|filter|labels|spaces|willkommen|backlog|bauplan|hoi-|hoi$|datenschutz|demo|ki-stand|oauth|google|icloud|konten|team|gesellschaften|absichten|meldungen|crm-signale|head|brain-bruecke)/, 'Einrichtung, Konto, System'],
]);
export function bereichVon(name) {
  for (const [re, b] of BEREICHE) if (re.test(name)) return b;
  return 'Sonstiges';
}

const esc = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
/** Muster (`*` = beliebig) auf einen Bestandsnamen. */
export function musterTrifft(muster, name) {
  if (!muster.includes('*')) return muster === name;
  return new RegExp(`^${muster.split('*').map(esc).join('.*')}$`).test(name);
}

/**
 * Wie wird dieser Bestand behandelt? `entscheidung`: 'mit' (unverändert), 'gefiltert' (tasks, aufgaben-dateien), 'bedingt'
 * (Grabstein-Marke), 'nicht', 'nie'. `opt.auch` = zusätzliche Muster (`--auch`), `opt.mitBauplan` nimmt `backlog` mit.
 */
export function bestandEinteilen(name, opt = {}) {
  if (NIE_MITNEHMEN.some(m => musterTrifft(m, name))) return { entscheidung: 'nie', grund: 'Konten und Zugänge kommen nie mit — neue Konten, neuer zweiter Faktor, Verbindungen neu.', bereich: 'Einrichtung, Konto, System' };
  const mit = MITNEHMEN.find(r => musterTrifft(r.muster, name));
  if (mit) return { entscheidung: mit.bearbeiten === 'grabstein-marke' ? 'bedingt' : mit.bearbeiten ? 'gefiltert' : 'mit', grund: mit.grund, art: mit.art, bereich: 'Kartei, Markttraktion, Aufgaben', ...(mit.bearbeiten ? { bearbeiten: mit.bearbeiten } : {}) };
  if (opt.mitBauplan && name === 'backlog') return { entscheidung: 'mit', grund: 'Bauplan-Karten (`--mit-bauplan`), samt Bildschirmfotos.', art: 'bauplan', bereich: 'Bauplan' };
  if ((opt.auch ?? []).some(m => musterTrifft(m, name))) return { entscheidung: 'mit', grund: 'Ausdrücklich verlangt (`--auch`).', art: 'auch', bereich: bereichVon(name) };
  const nicht = NICHT_MITNEHMEN.find(r => musterTrifft(r.muster, name));
  if (nicht) return { entscheidung: 'nicht', grund: nicht.grund, bereich: bereichVon(name) };
  return { entscheidung: 'nicht', grund: 'Gehört nicht zu Kartei, Markttraktion oder eigenen Aufgaben — beginnt leer und kommt über die Einrichtung.', bereich: bereichVon(name) };
}

/** `--auch`-Muster prüfen: Form wie ein Bestandsname (mit `*`), nie etwas aus NIE_MITNEHMEN. Liefert Fehlersätze. */
export function auchPruefen(muster) {
  const fehler = [];
  for (const m of muster) {
    if (!/^[a-z0-9*][a-z0-9*-]*$/.test(m) || m === '*') { fehler.push(`--auch „${m}“: nur Bestandsnamen (a-z, 0-9, -, *).`); continue; }
    if (NIE_MITNEHMEN.some(n => musterTrifft(m, n.replace(/\*/g, 'x')) || musterTrifft(n, m.replace(/\*/g, 'x')))) fehler.push(`--auch „${m}“: Konten und Zugänge kommen nie mit.`);
  }
  return fehler;
}

// ── Namen (Speicher-/Haushaltsnamen) abbilden ─────────────────────────────────────────────────────────────────────────────
// Standard: KEINE Abbildung — die neuen Konten bekommen dieselben Speichernamen (erstes Konto: Vorname → Speichername,
// lib/zugang/konten.ts `speicherName`; zweite Person: Einladung mit „Vorname“, der den Speichernamen bindet) und der Inhaber trägt
// denselben Haushalt ein. Nur wenn das nicht gewollt ist: `--person alt=neu` / `--haushalt alt=neu` — ersetzt in JEDEM
// mitgenommenen Bestand jeden Text, der GENAU der alte Name ist (Werte und Schlüssel, z. B. `besitzer`, `angelegtVon`,
// `netzwerk[<person>]`), benennt Bestände `…--<alt>` um und verschlüsselt Dateien mit der neuen AAD (Haushalt/Kennung).
// Teilwörter (`@name` in Texten, Adressen) bleiben, wie sie sind.

/** `alt=neu`-Angaben → Map. Wirft mit klarem Satz bei ungültigen Namen, Doppelten oder Ketten. */
export function abbildungAus(angaben, was = 'Name') {
  const m = new Map();
  for (const a of angaben) {
    const t = String(a).split('=');
    if (t.length !== 2) throw new Error(`${was} „${a}“: Form alt=neu.`);
    const [alt, neu] = t.map(x => x.trim());
    if (!NAME_OK.test(alt) || !NAME_OK.test(neu)) throw new Error(`${was} „${a}“: nur a-z, 0-9 und -, höchstens 40 Zeichen.`);
    if (alt === neu) continue;
    if (m.has(alt)) throw new Error(`${was} „${alt}“ ist doppelt angegeben.`);
    m.set(alt, neu);
  }
  const ziele = Array.from(m.values());
  if (new Set(ziele).size !== ziele.length) throw new Error(`${was}: zwei alte Namen auf denselben neuen.`);
  for (const z of ziele) if (m.has(z)) throw new Error(`${was} „${z}“ ist zugleich alt und neu — keine Ketten.`);
  return m;
}

/** Personen- und Haushalts-Abbildung zu EINER Ersetzungstabelle zusammenführen (gleicher Name, anderes Ziel → Fehler). */
export function abbildungenVereinen(personen, haushalte) {
  const m = new Map(haushalte);
  for (const [a, n] of personen) {
    if (m.has(a) && m.get(a) !== n) throw new Error(`„${a}“ ist als Person und als Haushalt mit verschiedenen Zielen angegeben.`);
    m.set(a, n);
  }
  for (const z of m.values()) if (m.has(z)) throw new Error(`„${z}“ ist zugleich alt und neu — keine Ketten.`);
  return m;
}

/** Jeden Text, der genau ein alter Name ist, ersetzen — Werte und Objekt-Schlüssel, beliebig tief. Liefert dasselbe Objekt (===), wenn nichts vorkam. */
export function namenErsetzen(wert, paare) {
  if (!paare.size) return { wert, n: 0 };
  let n = 0;
  const geh = v => {
    if (typeof v === 'string') { const x = paare.get(v); if (x === undefined) return v; n++; return x; }
    if (Array.isArray(v)) { let anders = false; const a = v.map(e => { const x = geh(e); if (x !== e) anders = true; return x; }); return anders ? a : v; }
    if (v && typeof v === 'object') {
      let anders = false;
      const o = {};
      for (const [k, e] of Object.entries(v)) {
        const k2 = paare.get(k) ?? k;
        if (k2 !== k) { n++; anders = true; if (Object.prototype.hasOwnProperty.call(v, k2)) throw new Error(`Schlüssel „${k}“ und „${k2}“ stehen im selben Objekt — die Abbildung würde Daten zusammenwerfen.`); }
        const x = geh(e);
        if (x !== e) anders = true;
        o[k2] = x;
      }
      return anders ? o : v;
    }
    return v;
  };
  const neu = geh(wert);
  return { wert: neu, n };
}

/** Bestandsname mit abgebildeten Namensteilen (`visitenkarten--alt` → `visitenkarten--neu`; nur Teile hinter `--`). */
export function bestandsnameAbbilden(name, paare) {
  if (!paare.size) return name;
  return name.split('--').map((t, i) => (i > 0 && paare.has(t) ? paare.get(t) : t)).join('--');
}

// ── Aufgaben ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
// „Eigene Aufgaben“ = alles, was eine Person angelegt, angenommen oder über einen Weg der Markttraktion ausgelöst hat
// (Follow-up-Aufgaben, Übergaben `ueb-`, Netzwerken `nw-`, Event-Checklisten `ev-`, Kampagnen-Schritte `kp-`, übernommene
// Erinnerungen, Serien samt ihren Instanzen — die jüngste Instanz trägt die Serie, ohne sie endete sie). NICHT:
//   · Papierkorb und „Neu anfangen“-Archiv (samt Projekten, Listen und allen Unteraufgaben darunter),
//   · Aufgaben der Module, die leer beginnen bzw. ihre Aufgaben selbst neu anlegen (feste Kennungen, Regel an der Hauptaufgabe —
//     Unteraufgaben folgen ihr): unten SYSTEM_AUFGABEN,
//   · Head-Aufgaben `hd-…` (Agenten beginnen leer) — mit `--mit-head-aufgaben` doch.
// Meilensteine kommen nicht mit (Planung beginnt leer): ihre Listen (`lm-…` im Projekt „Meilensteine“ `pm-<space>`) ziehen mit
// ihren Aufgaben in ein neues Projekt „Übernommen“ desselben Space (Listentitel = Titel des Meilensteins, neue Kennung `l-…`, damit
// die neue Planung sie nie für die Liste eines Meilensteins hält). Eine Meilenstein-Liste OHNE Aufgaben zieht trotzdem mit, wenn an
// ihr (bzw. am Projekt „Meilensteine“) Dateien hängen (`opt.dateiListen`/`opt.dateiProjekte` — Meilenstein › Dateien legt sie mit
// `listeId` und ohne Aufgabe ab; Prüfung mit Daten des Online-Stands 09.10.: sonst blieben sie still im Archiv).
// Ziele kommen nicht mit → `zielId` an Aufgaben und Projekten fällt
// weg. ZOE beginnt leer → ein Auftrag „in Arbeit“/„wartet auf Freigabe“ steht wieder auf „offen“ (sein Vorschlag lag im Stapel).
// Abhängigkeiten auf nicht übernommene Aufgaben fallen weg (sonst wartete eine Aufgabe ewig).

export const SYSTEM_AUFGABEN = Object.freeze([
  { muster: /^steuer-/, grund: 'Steuern (das Modul legt seine Fristen neu an)' },
  { muster: /^beleg-/, grund: 'Belege der Haushaltsfinanzen' },
  { muster: /^mahn-/, grund: 'Mahnungen zu Rechnungen' },
  { muster: /^hof-/, grund: 'Head of Finance' },
  { muster: /^vte-/, grund: 'Vertragsfristen der Gesellschaften' },
  { muster: /^loeschfrist-/, grund: 'Löschfristen-Prüfung (der Lauf legt sie neu an)' },
  { muster: /^md-/, grund: 'Medien-Pflege' },
  { muster: /^hd-/, grund: 'Head-Aufgabe (Agenten beginnen leer)', schalter: 'mitHeadAufgaben' },
]);
export const UEBERNOMMEN_TITEL = 'Übernommen';
const MS_LISTE = 'lm-';
const MS_PROJEKT = 'pm-';

const liste = v => (Array.isArray(v) ? v : []);
const istObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const neueKennungStandard = p => `${p}-${randomUUID()}`;

/** Grund, aus dem eine Hauptaufgabe als Modul-Aufgabe draußen bleibt — oder null. */
export function systemGrund(id, opt = {}) {
  const r = SYSTEM_AUFGABEN.find(x => x.muster.test(String(id)) && !(x.schalter && opt[x.schalter]));
  return r ? r.grund : null;
}

/**
 * Den Aufgaben-Bestand für den Neustart filtern (rein). `opt.kennung(präfix)` für neue Projekte/Listen (Tests), `opt.jetzt`,
 * `opt.dateiListen`/`opt.dateiProjekte` = Listen bzw. Projekte, an denen Aufgaben-Dateien OHNE Aufgabe hängen (`dateiBezuege`).
 * Liefert den neuen Bestand, den Bericht und die Abbildungen (Projekt/Liste alt → neu) samt der Mengen, die Aufgaben-Dateien brauchen.
 */
export function aufgabenUebernehmen(stand, opt = {}) {
  const kennung = opt.kennung ?? neueKennungStandard;
  const jetzt = opt.jetzt ?? new Date().toISOString();
  const dateiListen = opt.dateiListen ?? new Set(), dateiProjekte = opt.dateiProjekte ?? new Set();
  const s = istObj(stand) ? stand : {};
  const projekte = liste(s.projects), tasks = liste(s.tasks), listen = liste(s.listen), gruppen = liste(s.gruppen);
  const bericht = {
    alt: { aufgaben: tasks.length, projekte: projekte.length, listen: listen.length },
    neu: { aufgaben: 0, projekte: 0, listen: 0 },
    nicht: { papierkorb: 0, archiv: 0, modul: {}, meilensteinListenLeer: 0, listenArchiv: 0, projektePapierkorb: 0, projekteArchiv: 0 },
    uebernommenProjekte: [], umgehaengt: { listen: 0, aufgaben: 0, nurDateien: 0 },
    geloest: { ziel: 0, zoe: 0, abhaengig: 0, liste: 0 },
  };
  // Projekte, die draußen bleiben (und warum).
  const projektRaus = new Map();
  for (const p of projekte) {
    if (!istObj(p)) continue;
    if (p.geloeschtAm) { projektRaus.set(p.id, 'papierkorb'); bericht.nicht.projektePapierkorb++; }
    else if (p.archiviertAm) { projektRaus.set(p.id, 'archiv'); bericht.nicht.projekteArchiv++; }
  }
  const projektNach = new Map(projekte.filter(istObj).map(p => [p.id, p]));
  const istMsProjekt = id => typeof id === 'string' && id.startsWith(MS_PROJEKT);
  const spaceVon = pid => projektNach.get(pid)?.spaceId ?? (istMsProjekt(pid) ? pid.slice(MS_PROJEKT.length) : undefined);

  // Aufgaben: draußen? (Papierkorb/Archiv der Aufgabe, ihres Projekts oder eines Vorfahren; Modul-Aufgabe an der Hauptaufgabe)
  const nachId = new Map(tasks.filter(istObj).map(t => [t.id, t]));
  const memo = new Map(), unterwegs = new Set();
  const grund = t => {
    if (memo.has(t.id)) return memo.get(t.id);
    if (unterwegs.has(t.id)) return null; // Kreis im Altbestand: wie eine Hauptaufgabe (die Übernahme der App heilt ihn)
    unterwegs.add(t.id);
    let g = null;
    if (t.geloeschtAm) g = 'papierkorb';
    else if (t.archiviertAm) g = 'archiv';
    else if (projektRaus.has(t.projectId)) g = projektRaus.get(t.projectId);
    if (!g) {
      const e = t.parentId && t.parentId !== t.id ? nachId.get(t.parentId) : undefined;
      if (e) g = grund(e);
      else { const sg = systemGrund(t.id, opt); if (sg) g = `modul:${sg}`; }
    }
    unterwegs.delete(t.id);
    memo.set(t.id, g);
    return g;
  };
  const bleiben = [];
  for (const t of tasks) {
    if (!istObj(t) || typeof t.id !== 'string') continue;
    const g = grund(t);
    if (!g) { bleiben.push(t); continue; }
    if (g === 'papierkorb') bericht.nicht.papierkorb++;
    else if (g === 'archiv') bericht.nicht.archiv++;
    else { const k = g.slice('modul:'.length); bericht.nicht.modul[k] = (bericht.nicht.modul[k] ?? 0) + 1; }
  }
  const aufgabenIds = new Set(bleiben.map(t => t.id));

  // Listen: draußen, wenn ihr Projekt draußen ist oder sie im „Neu anfangen“-Archiv liegen. Meilenstein-Listen → „Übernommen“.
  const listeRaus = new Set();
  for (const l of listen) {
    if (!istObj(l)) continue;
    if (projektRaus.has(l.projektId)) listeRaus.add(l.id);
    else if (l.archiviertAm) { listeRaus.add(l.id); bericht.nicht.listenArchiv++; }
  }
  const istMsListe = l => (typeof l.id === 'string' && l.id.startsWith(MS_LISTE)) || istMsProjekt(l.projektId);
  // Wohin? Je Space EIN Projekt „Übernommen“ — nur, wenn wirklich eine Aufgabe dorthin zieht.
  const uebernommen = new Map(); // space → Projekt
  const projektFuerSpace = space => {
    let p = uebernommen.get(space);
    if (!p) {
      p = {
        id: kennung('p'), title: UEBERNOMMEN_TITEL, description: '', category: space === 'privat' ? 'joint' : 'business', owner: 'both',
        color: '#6E7A7D', tags: [], archived: false, spaceId: space, createdAt: jetzt, updatedAt: jetzt,
        beschreibung: 'Aufgaben aus den Meilensteinen der früheren Planung (Neustart-Umzug) — je Meilenstein eine Liste.',
      };
      uebernommen.set(space, p);
    }
    return p;
  };
  const listeUm = new Map(), projektUm = new Map();
  const zieht = new Set(bleiben.map(t => t.listeId).filter(Boolean));
  const msPfade = new Set(bleiben.filter(t => istMsProjekt(t.projectId)).map(t => t.projectId));
  for (const pid of dateiProjekte) if (istMsProjekt(pid) && !projektRaus.has(pid)) msPfade.add(pid);
  for (const l of listen) {
    if (!istObj(l) || listeRaus.has(l.id) || !istMsListe(l)) continue;
    if (!zieht.has(l.id)) {
      if (!dateiListen.has(l.id)) { bericht.nicht.meilensteinListenLeer++; listeRaus.add(l.id); continue; }
      bericht.umgehaengt.nurDateien++;
    }
    const space = spaceVon(l.projektId) ?? 'privat';
    const p = projektFuerSpace(space);
    listeUm.set(l.id, l.id.startsWith(MS_LISTE) ? kennung('l') : l.id);
    if (istMsProjekt(l.projektId)) projektUm.set(l.projektId, p.id);
  }
  for (const pid of msPfade) if (!projektUm.has(pid)) projektUm.set(pid, projektFuerSpace(spaceVon(pid) ?? 'privat').id);
  // Eine Meilenstein-Liste in einem gewöhnlichen Projekt (sollte es nicht geben): sie zieht trotzdem nach „Übernommen“.
  const listeProjekt = new Map();
  for (const l of listen) {
    if (!istObj(l) || !listeUm.has(l.id)) continue;
    listeProjekt.set(listeUm.get(l.id), projektFuerSpace(spaceVon(l.projektId) ?? 'privat').id);
  }

  // Neue Projekte, Listen, Gruppen
  const neueProjekte = [];
  for (const p of projekte) {
    if (!istObj(p) || projektRaus.has(p.id) || istMsProjekt(p.id)) continue;
    if (p.zielId !== undefined) { const { zielId: _z, ...rest } = p; neueProjekte.push(rest); bericht.geloest.ziel++; }
    else neueProjekte.push(p);
  }
  for (const p of uebernommen.values()) { neueProjekte.push(p); bericht.uebernommenProjekte.push({ space: p.spaceId, id: p.id }); }
  const neueListen = [];
  for (const l of listen) {
    if (!istObj(l) || listeRaus.has(l.id)) continue;
    if (listeUm.has(l.id)) {
      const id = listeUm.get(l.id);
      const { gruppeId: _g, ...rest } = l;
      neueListen.push({ ...rest, id, projektId: listeProjekt.get(id) });
      bericht.umgehaengt.listen++;
    } else neueListen.push(l);
  }
  const listenIds = new Set(neueListen.map(l => l.id));
  const projektIds = new Set(neueProjekte.map(p => p.id));
  const neueGruppen = gruppen.filter(g => istObj(g) && !projektRaus.has(g.projektId) && !g.archiviertAm && !istMsProjekt(g.projektId));
  const gruppenIds = new Set(neueGruppen.map(g => g.id));

  // Aufgaben anpassen
  const neueAufgaben = bleiben.map(t => {
    let n = t;
    const setze = (k, v) => { if (n === t) n = { ...t }; if (v === undefined) delete n[k]; else n[k] = v; };
    if (istMsProjekt(t.projectId) && projektUm.has(t.projectId)) { setze('projectId', projektUm.get(t.projectId)); bericht.umgehaengt.aufgaben++; }
    if (t.listeId) {
      if (listeUm.has(t.listeId)) { setze('listeId', listeUm.get(t.listeId)); if (!istMsProjekt(t.projectId)) bericht.umgehaengt.aufgaben++; if (listeProjekt.get(listeUm.get(t.listeId)) !== n.projectId) setze('projectId', listeProjekt.get(listeUm.get(t.listeId))); }
      else if (!listenIds.has(t.listeId)) { setze('listeId', undefined); bericht.geloest.liste++; }
    }
    if (t.gruppeId && !gruppenIds.has(t.gruppeId)) setze('gruppeId', undefined);
    if (t.zielId !== undefined) { setze('zielId', undefined); bericht.geloest.ziel++; }
    if (istObj(t.zoe) && (t.zoe.status === 'in_arbeit' || t.zoe.status === 'wartet_freigabe')) {
      const { stapelId: _s, ...z } = t.zoe;
      setze('zoe', { ...z, status: 'offen' });
      bericht.geloest.zoe++;
    }
    if (Array.isArray(t.abhaengigVon) && t.abhaengigVon.some(id => !aufgabenIds.has(id))) {
      const rest = t.abhaengigVon.filter(id => aufgabenIds.has(id));
      bericht.geloest.abhaengig += t.abhaengigVon.length - rest.length;
      setze('abhaengigVon', rest.length ? rest : undefined);
    }
    if (Array.isArray(t.dependencies) && t.dependencies.some(d => !aufgabenIds.has(d?.blockedByTaskId))) {
      setze('dependencies', t.dependencies.filter(d => aufgabenIds.has(d?.blockedByTaskId)));
    }
    return n;
  });
  // Ein Elternteil, das nicht mitkommt, gibt es nach den Regeln oben nicht (Unteraufgaben folgen ihrer Hauptaufgabe) —
  // nur ein Verweis auf eine Aufgabe, die es schon im alten Bestand nicht gab, bleibt, wie er war.

  const neu = { ...s, projects: neueProjekte, tasks: neueAufgaben, listen: neueListen };
  if (Array.isArray(s.gruppen)) neu.gruppen = neueGruppen;
  bericht.neu = { aufgaben: neueAufgaben.length, projekte: neueProjekte.length, listen: neueListen.length };
  return { stand: neu, bericht, projektUm, listeUm, aufgabenIds, listenIds, projektIds };
}

/**
 * Listen und Projekte, an denen Aufgaben-Dateien OHNE Aufgabe hängen (rein) — für `aufgabenUebernehmen` (`dateiListen`,
 * `dateiProjekte`): eine Meilenstein-Liste ohne Aufgaben, aber mit Dateien, zieht dann nach „Übernommen“ statt wegzufallen.
 * `eintraege` = alle Einträge aller `aufgaben-dateien--*` des alten Ordners.
 */
export function dateiBezuege(eintraege) {
  const dateiListen = new Set(), dateiProjekte = new Set();
  for (const e of liste(eintraege)) {
    if (!istObj(e) || e.aufgabeId) continue;
    if (typeof e.listeId === 'string' && e.listeId) dateiListen.add(e.listeId);
    else if (typeof e.projektId === 'string' && e.projektId) dateiProjekte.add(e.projektId);
  }
  return { dateiListen, dateiProjekte };
}

/** Datei-Kennungen („d-…“), die eine Einwilligung der Kartei als Beleg nennt (Art. 7 Abs. 1: der Nachweis muss bleiben). */
export function belegKennungen(kartei) {
  const raus = new Set();
  for (const k of liste(kartei?.kontakte)) for (const e of liste(k?.einwilligungen)) {
    for (const m of String(e?.belegRef ?? '').matchAll(/(?<![A-Za-z0-9_-])d-[a-z0-9-]{4,60}(?![A-Za-z0-9_-])/g)) raus.add(m[0]);
  }
  return raus;
}

/**
 * Aufgaben-Dateien filtern (rein): mit kommt ein Eintrag, dessen Aufgabe (bzw. Liste/Projekt, wenn er an keiner Aufgabe hängt)
 * mitkommt — und jeder, den eine Einwilligung als Beleg nennt. Projekt/Liste werden wie die Aufgaben umgehängt.
 */
export function aufgabenDateienUebernehmen(datei, ctx) {
  const eintraege = liste(datei?.eintraege);
  const raus = [];
  const bericht = { alt: eintraege.length, neu: 0, nicht: 0, beleg: 0 };
  for (const e of eintraege) {
    if (!istObj(e)) continue;
    const projekt = e.projektId ? (ctx.projektUm.get(e.projektId) ?? e.projektId) : undefined;
    const listeId = e.listeId ? (ctx.listeUm.get(e.listeId) ?? e.listeId) : undefined;
    const mit = e.aufgabeId ? ctx.aufgabenIds.has(e.aufgabeId)
      : listeId ? ctx.listenIds.has(listeId)
      : projekt ? ctx.projektIds.has(projekt) : false;
    const beleg = ctx.belege.has(e.id);
    if (!mit && !beleg) { bericht.nicht++; continue; }
    if (!mit && beleg) bericht.beleg++;
    raus.push({ ...e, ...(projekt !== undefined ? { projektId: projekt } : {}), ...(listeId !== undefined ? { listeId } : {}) });
  }
  bericht.neu = raus.length;
  return { datei: { ...(istObj(datei) ? datei : {}), eintraege: raus }, bericht };
}

// ── Zähler, Fingerabdrücke, Verweise ─────────────────────────────────────────────────────────────────────────────────────

export const LISTEN_NAMEN = Object.freeze({
  kontakte: 'Kontakte', firmen: 'Firmen', chancen: 'Deals', mandate: 'Mandate', leistungen: 'Produkte', events: 'Events', teilnahmen: 'Teilnahmen',
  sitzungen: 'Power-Hour-Sitzungen', antraege: 'Betroffenenanträge', verarbeitungen: 'Verarbeitungen (Art. 30)', segmente: 'Segmente',
  beitraege: 'Beiträge', newsletter: 'Newsletter', kampagnen: 'Kampagnen', followups: 'Follow-ups', angebote: 'Angebote',
  tasks: 'Aufgaben', projects: 'Projekte', listen: 'Listen', vorlagen: 'Vorlagen', statusEigen: 'Eigene Status', eintraege: 'Einträge',
});

const sha = t => createHash('sha256').update(t).digest('hex');

/** Zähler je Liste (oberste Ebene: Arrays) und Fingerabdruck über `<liste>:<id>` aller Einträge mit Kennung — rein, ohne Inhalte. */
export function fingerabdruck(wert) {
  const anzahl = {};
  const zeilen = [];
  if (istObj(wert)) {
    for (const [k, v] of Object.entries(wert)) {
      if (!Array.isArray(v)) continue;
      anzahl[k] = v.length;
      for (const e of v) if (istObj(e) && (typeof e.id === 'string' || typeof e.id === 'number')) zeilen.push(`${k}:${e.id}`);
    }
  } else if (Array.isArray(wert)) anzahl['(liste)'] = wert.length;
  zeilen.sort();
  return { anzahl, kennungen: zeilen.length, hash: sha(zeilen.join('\n')).slice(0, 16) };
}

/** Inhalt-Fingerabdruck (16 hex) eines Klartexts — für „unverändert übernommen“. */
export const textFingerabdruck = t => sha(String(t)).slice(0, 16);

/**
 * Verweise prüfen (rein, nur Zahlen): Aufgaben → CRM/Kartei/Aufgaben, CRM → Aufgaben, Dateien → Bezug und Datei, Einwilligungs-
 * Belege → Ablage. Läuft über den alten und den neuen Stand — der Bericht zeigt, dass der Umzug keinen Verweis zerbrochen hat
 * (außer CRM → Aufgaben, die bewusst nicht mitkamen; die zählt `crmAufgabeNichtUebernommen`).
 * `d` = { kartei, crm, tasks, crmDateien: Eintrag[], aufgabenDateien: Eintrag[], dateienDa: Set<id>, nichtUebernommen?: Set<taskId> }
 */
export function verweisePruefen(d) {
  const kontakte = new Set(liste(d.kartei?.kontakte).map(k => k?.id));
  const crm = istObj(d.crm) ? d.crm : {};
  const ids = l => new Set(liste(crm[l]).map(x => x?.id));
  const firmen = ids('firmen'), mandate = ids('mandate'), deals = ids('chancen'), angebote = ids('angebote');
  const tasks = liste(d.tasks?.tasks);
  const aufgaben = new Set(tasks.map(t => t?.id));
  const projekte = new Set(liste(d.tasks?.projects).map(p => p?.id));
  const listen = new Set(liste(d.tasks?.listen).map(l => l?.id));
  const z = {
    aufgabeKontaktTot: 0, aufgabeFirmaTot: 0, aufgabeMandatTot: 0, aufgabeDealTot: 0, aufgabeElternTot: 0, aufgabeProjektTot: 0, aufgabeListeTot: 0, aufgabeAbhaengigTot: 0,
    crmAufgabeTot: 0, crmAufgabeNichtUebernommen: 0,
    crmDateiBezugTot: 0, crmDateiFehlt: 0, aufgabenDateiBezugTot: 0, aufgabenDateiFehlt: 0, einwilligungBelegTot: 0,
  };
  for (const t of tasks) {
    if (!istObj(t)) continue;
    const b = istObj(t.bezug) ? t.bezug : {};
    if (b.kontaktId && !kontakte.has(b.kontaktId)) z.aufgabeKontaktTot++;
    if (b.firmaId && !firmen.has(b.firmaId)) z.aufgabeFirmaTot++;
    if (b.mandatId && !mandate.has(b.mandatId)) z.aufgabeMandatTot++;
    if (b.dealId && !deals.has(b.dealId)) z.aufgabeDealTot++;
    if (t.parentId && !aufgaben.has(t.parentId)) z.aufgabeElternTot++;
    if (t.projectId && !projekte.has(t.projectId) && !String(t.projectId).startsWith('sonstige-')) z.aufgabeProjektTot++;
    if (t.listeId && !listen.has(t.listeId)) z.aufgabeListeTot++;
    for (const a of liste(t.abhaengigVon)) if (!aufgaben.has(a)) z.aufgabeAbhaengigTot++;
  }
  const aufgabeVerweis = id => {
    if (!id || aufgaben.has(id)) return;
    if (d.nichtUebernommen?.has(id)) z.crmAufgabeNichtUebernommen++; else z.crmAufgabeTot++;
  };
  for (const f of liste(crm.followups)) aufgabeVerweis(f?.aufgabeId);
  for (const e of liste(crm.events)) for (const p of liste(e?.checkliste)) aufgabeVerweis(p?.aufgabeId);
  for (const k of liste(crm.kampagnen)) for (const s of liste(k?.schritte)) aufgabeVerweis(s?.aufgabeId);
  const dateiDa = id => d.dateienDa?.has(id);
  for (const e of liste(d.crmDateien)) {
    if (!istObj(e)) continue;
    if ((e.kontaktId && !kontakte.has(e.kontaktId)) || (e.firmaId && !firmen.has(e.firmaId)) || (e.mandatId && !mandate.has(e.mandatId))
      || (e.dealId && !deals.has(e.dealId)) || (e.angebotId && !angebote.has(e.angebotId))) z.crmDateiBezugTot++;
    if (e.datei && !dateiDa(e.id)) z.crmDateiFehlt++;
  }
  for (const e of liste(d.aufgabenDateien)) {
    if (!istObj(e)) continue;
    if ((e.aufgabeId && !aufgaben.has(e.aufgabeId)) || (e.projektId && !projekte.has(e.projektId))) z.aufgabenDateiBezugTot++;
    if (e.datei && !dateiDa(e.id)) z.aufgabenDateiFehlt++;
  }
  const ablage = new Set([...liste(d.crmDateien), ...liste(d.aufgabenDateien)].map(e => e?.id));
  for (const id of belegKennungen(d.kartei)) if (!ablage.has(id)) z.einwilligungBelegTot++;
  return z;
}

// ── Marke für die neue Instanz ───────────────────────────────────────────────────────────────────────────────────────────
// `<daten>/system/neustart.json` — Klartext-JSON wie system/sicherung.json (NICHT über local-db): die Einrichtung erkennt daran den
// Neustart (lib/onboarding-neustart.ts, Branch `einrichtung-neu`) und zeigt `zaehler`. Nur Zeitpunkt, Zahlen und Fingerabdrücke —
// keine Namen (auch keine Speicher-/Haushaltsnamen, keine Bestandsnamen mit Namensteil), keine Inhalte.

/**
 * Zähler-Namen der Marke ← Liste im Bestand (Kartei, CRM, Aufgaben); `dateien` = geschriebene Dateien. Reihenfolge mit Absicht: die
 * Einrichtung zeigt die ersten sechs (lib/onboarding-neustart.ts `neustartSatz`) — das Wichtigste vorn.
 */
export const MARKE_ZAEHLER = Object.freeze({
  kontakte: ['kontakte', 'kontakte'], firmen: ['crm', 'firmen'], deals: ['crm', 'chancen'], mandate: ['crm', 'mandate'], aufgaben: ['tasks', 'tasks'],
  dateien: null, angebote: ['crm', 'angebote'], events: ['crm', 'events'], projekte: ['tasks', 'projects'], followups: ['crm', 'followups'],
  kampagnen: ['crm', 'kampagnen'],
});

/**
 * Die Marke bauen (rein). `neu` = Bestandsname → neuer Wert (Kartei, CRM, Aufgaben), `dateien` = Zahl der geschriebenen Dateien.
 * Liefert nur Zahlen, Zeitpunkt, Format und Fingerabdrücke.
 */
export function markeBauen(o) {
  const zaehler = {};
  for (const [k, quelle] of Object.entries(MARKE_ZAEHLER)) {
    if (!quelle) { zaehler[k] = Number(o.dateien) || 0; continue; }
    const w = o.neu?.[quelle[0]];
    zaehler[k] = Array.isArray(w?.[quelle[1]]) ? w[quelle[1]].length : 0;
  }
  return {
    version: UMZUG_VERSION,
    am: o.am,
    quelle: o.quelle,
    format: o.format,
    verschluesselt: !!o.verschluesselt,
    zaehler,
    fingerabdruecke: {
      kontakte: o.neu?.kontakte ? fingerabdruck(o.neu.kontakte).hash : null,
      crm: o.neu?.crm ? fingerabdruck(o.neu.crm).hash : null,
    },
    grabsteine: { anzahl: Number(o.grabsteine?.anzahl) || 0, markeUebernommen: !!o.grabsteine?.markeUebernommen },
    nichtUebernommen: Number(o.nichtUebernommen) || 0,
  };
}

// ── Prüfungen vor dem Lauf ────────────────────────────────────────────────────────────────────────────────────────────────

/** Arten im Absichtsprotokoll, die Kartei, CRM oder Aufgaben schreiben — offen oder gescheitert halten sie den Umzug an. */
export const ABSICHTEN_KERN = Object.freeze(['art17', 'zusammenfuehren', 'import', 'kennungen-umzug', 'kennungen-rueckweg', 'crm-folgen', 'angebot-stellen', 'buchung', 'firma-umhaengen', 'erinnerungen-uebernahme']);
const NICHT_FERTIG = new Set(['offen', 'unvollstaendig', 'gescheitert']);
/** Nicht fertige Absichten (nur Art + Status + Zahl, nie Daten). `kern` = die, die den Umzug anhalten. */
export function absichtenOffen(datei) {
  const raus = { kern: {}, sonst: {} };
  for (const a of liste(datei?.absichten)) {
    if (!istObj(a) || !NICHT_FERTIG.has(a.status)) continue;
    const ziel = ABSICHTEN_KERN.includes(a.art) ? raus.kern : raus.sonst;
    const k = `${a.art} (${a.status})`;
    ziel[k] = (ziel[k] ?? 0) + 1;
  }
  return raus;
}

/** Stand der Grabsteine wie lib/datenschutz/grabsteine.ts `grabsteinStand` (sha256 der Datei, 16 hex; '' ohne Datei). */
export const grabsteinStandAus = roh => (roh && roh.length ? createHash('sha256').update(roh).digest('hex').slice(0, 16) : '');

/** Pepper-Fingerabdruck wie lib/datenschutz/pepper.ts `pepperFingerabdruck` — `lesen(pfad)` liefert die erste Zeile der Datei. */
export function pepperFingerabdruck(env = process.env, lesen = () => null) {
  const ausEnv = String(env.MAKE_OS_PEPPER ?? '').trim();
  const datei = env.MAKE_OS_PEPPER_DATEI?.trim() ? String(lesen(env.MAKE_OS_PEPPER_DATEI.trim()) ?? '').trim() : '';
  const p = ausEnv.length >= 32 ? ausEnv : datei.length >= 32 ? datei : null;
  return p ? createHmac('sha256', p).update('make-os-pepper-fingerabdruck|v2').digest('hex').slice(0, 12) : null;
}

/**
 * Pfade prüfen (rein bis auf `path`-Rechnung): beide absolut gerechnet, verschieden, nicht ineinander, nie ein `.data`-Glied
 * (so heißt der echte Datenordner am Mac — Vorbild lib/demo/schutz.ts). Liefert Gründe; leer = in Ordnung.
 */
export function pfadeGruende(von, nach, pfad, cwd) {
  const g = [];
  if (!von || !nach) { g.push('Aufruf: --von <alter Datenordner> --nach <neuer, leerer Ordner>.'); return g; }
  const a = pfad.resolve(cwd, von), n = pfad.resolve(cwd, nach);
  for (const [was, p] of [['--von', a], ['--nach', n]]) {
    if (p.split(pfad.sep).some(t => t === '.data')) g.push(`${was} enthält „.data“ (${p}) — so heißt der echte Datenordner am Mac; der Umzug läuft nur auf dem Server mit eigenen Ordnernamen.`);
  }
  if (a === n) g.push('--von und --nach sind derselbe Ordner.');
  else if (n.startsWith(a + pfad.sep) || a.startsWith(n + pfad.sep)) g.push('--von und --nach liegen ineinander.');
  return g;
}
