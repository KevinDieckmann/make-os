// ─── Neustart: einzelne Bestände aus dem Archiv NACHHOLEN — der reine Kern (09.10.2026 spät) ─────────────────────────────────────────
// Beim Neustart-Umzug (lib/neustart/umzug.mjs) begannen die Agenten leer: `head-*` blieb im Archiv-Ordner. Kevin 09.10. spät: „Pack bitte
// schon die vorgefertigten Bots bei ZOE ein … Ich habe keinen Bock, die alle nochmal neu einzutragen.“ — und (neue Regel): „Firma und Privat
// liegen getrennt — auch in der Datenhaltung.“ Deshalb holt dieses Werkzeug NUR ausdrücklich genannte Bestände der BUSINESS-Heads nach:
//   head-sales · head-marketing · head-event  →  Gedächtnis (Merksätze), entschiedene Vorschläge (Lernstand: Annahmequote, Muster,
//   Ablehngründe, Wirkung) und die Autonomie-Einstellung. NICHT: Berichte (Inhalte der alten Läufe), offene Vorschläge (veraltet),
//   Zeitstempel des Takts (`letzte`, `versuche`, `ruhig`, `voll`).
// Alles andere bleibt im Archiv — mit Grund (`NICHT_NACHHOLBAR`, `NIE_MITNEHMEN` aus dem Umzug); nie Konten/Zugänge, nie Gesundheit, nie Finanzen,
// nie etwas, das Business und Privat mischt (z. B. `agents-config`, `agenten-skills--*`), nie Verläufe/Protokolle/Stapel.
// Ziel vorhanden (der Takt hat den Head seit dem Neustart schon laufen lassen) → zusammenführen: das ZIEL gewinnt, aus dem Archiv kommt nur, was
// fehlt (Merksätze und Vorschläge nach Kennung). Rein, ohne Dateizugriff — der Ablauf steht in nachholen-lauf.mjs, die Kommandozeile in
// scripts/neustart-nachholen.mjs. Typen: nachholen.d.mts. Tests: tests/neustart-nachholen.test.ts.

import { NIE_MITNEHMEN, musterTrifft } from './umzug.mjs';

/** Was nachgeholt werden darf — genau diese Namen (keine Muster), je mit Grund. */
export const NACHHOLBAR = Object.freeze([
  { name: 'head-sales', art: 'head', grund: 'Head of Sales (Business): Merksätze, entschiedene Vorschläge (Lernstand) und Autonomie.' },
  { name: 'head-marketing', art: 'head', grund: 'Head of Marketing (Business): Merksätze, entschiedene Vorschläge (Lernstand) und Autonomie.' },
  { name: 'head-event', art: 'head', grund: 'Head of Event (Business): Merksätze, entschiedene Vorschläge (Lernstand) und Autonomie.' },
]);

/** Ausdrücklich NICHT (häufig gefragt) — mit Grund. Muster mit `*` wie im Speicher-Register. */
export const NICHT_NACHHOLBAR = Object.freeze([
  { muster: 'agents-config', grund: 'Schalter aller früheren Agenten — mischt Business und Privat (Gesundheit, Fokus, Ernährung); Firma und Privat liegen getrennt.' },
  { muster: 'agenten-skills--*', grund: 'Werkstatt der Heads des Haushalts — mischt Business und Familie.' },
  { muster: 'agenten-skills-privat--*', grund: 'Privat — jede Person richtet ihre Agenten selbst ein.' },
  { muster: 'agenten-einstellung--*', grund: 'Einstellungen mischen Business- und Privat-Heads — neu über die Einrichtung bzw. „Aus dem Brain übernehmen“.' },
  { muster: 'zoe-gedaechtnis', grund: 'ZOEs Fakten können Gesundheit, Finanzen und Persönliches enthalten und sind nicht nach Bereich getrennt.' },
  { muster: 'zoe-*', grund: 'Verläufe, Aufträge, Stapel, Protokolle und Empfang von ZOE beginnen leer.' },
  { muster: 'heads-replay-*', grund: 'Replay-Fälle der Heads enthalten ganze Datenpakete (Kontakte) — beginnen leer.' },
  { muster: 'agent-log', grund: 'Protokoll der Agenten-Läufe (Inhalte) — bleibt als Nachweis im Archiv.' },
  { muster: 'kompass', grund: 'Gesundheit — nie.' },
  { muster: 'brain-konsolidierung', grund: 'Merker des Nachtlaufs — beginnt neu, ohne Nutzen.' },
  { muster: 'finanzchef', grund: 'Finanzen — nie.' },
  { muster: 'haushalt-chef--*', grund: 'Finanzen (privat) — nie.' },
]);

/** Gesundheit und Finanzen — auch wenn jemand sie ausdrücklich nennt, nie (wie die Bereiche des Umzug-Berichts). */
const NIE_BEREICH = /^(vitals|haut|streak|health|gesundheit|sport|ernaehrung|whoop|journal|kompass|finanz|finance|liquiplan|buchungen|rechnung|grundlage|business-|abschluss|steuern|haushalt-|kontoauszug|konten--|privat-index|finanzchef|beleg)/;

/** Ist der Name erlaubt? Liefert null (ja) oder den Grund (nein). Rein. */
export function nachholenGrund(name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) return 'kein gültiger Bestandsname';
  if (NIE_MITNEHMEN.some(m => musterTrifft(m, name))) return 'Konten und Zugänge kommen nie mit';
  if (NIE_BEREICH.test(name)) return 'Gesundheit und Finanzen kommen nie mit';
  if (NACHHOLBAR.some(e => e.name === name)) return null;
  const nicht = NICHT_NACHHOLBAR.find(e => musterTrifft(e.muster, name));
  return nicht ? nicht.grund : 'nicht in der Liste der nachholbaren Bestände (nur Business-Heads: head-sales, head-marketing, head-event)';
}

/** Die genannten Bestände prüfen: Gründe für die abgelehnten (leer = alle erlaubt). Rein. */
export function nachholenPruefen(namen) {
  if (!Array.isArray(namen) || !namen.length) return ['Bitte die Bestände ausdrücklich nennen: --bestand head-sales,head-marketing,head-event'];
  const gruende = [];
  for (const n of namen) { const g = nachholenGrund(n); if (g) gruende.push(`„${n}“: ${g}.`); }
  return gruende;
}

const istObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const ENTSCHIEDEN = new Set(['angenommen', 'abgelehnt', 'erledigt']);
const liste = v => (Array.isArray(v) ? v.filter(istObj) : []);

/**
 * Stand eines Heads (lib/heads/stand.ts `HeadStand`) filtern: Gedächtnis, entschiedene Vorschläge, Autonomie. `berichte` und Takt-Zeiten leer
 * (die Form bleibt, damit der Head sie lesen kann). Unbekannte Felder fallen weg. Rein.
 */
export function headStandFiltern(stand) {
  const s = istObj(stand) ? stand : {};
  const raus = { berichte: [], vorschlaege: liste(s.vorschlaege).filter(v => ENTSCHIEDEN.has(v.status)), letzte: {}, versuche: {} };
  const ged = liste(s.gedaechtnis).filter(m => typeof m.id === 'string' && typeof m.text === 'string');
  if (ged.length) raus.gedaechtnis = ged;
  if (s.autonomie === 'intern' || s.autonomie === 'aus') raus.autonomie = s.autonomie;
  if (typeof s._v === 'number') raus._v = s._v;
  return raus;
}

/**
 * Zusammenführen, wenn der Head im laufenden Ordner schon einen Stand hat: das ZIEL gewinnt; aus dem (gefilterten) Archiv kommen nur
 * Merksätze und Vorschläge, deren Kennung fehlt, und die Autonomie, wenn das Ziel keine hat. `neu` = Anzahl dazugekommener Einträge. Rein.
 */
export function headStandZusammenfuehren(ziel, archiv) {
  const z = istObj(ziel) ? ziel : {};
  const a = headStandFiltern(archiv);
  const vorschlagIds = new Set(liste(z.vorschlaege).map(v => v.id));
  const merkIds = new Set(liste(z.gedaechtnis).map(m => m.id));
  const neueVorschlaege = a.vorschlaege.filter(v => !vorschlagIds.has(v.id));
  const neueMerk = (a.gedaechtnis ?? []).filter(m => !merkIds.has(m.id));
  const raus = { ...z };
  if (neueVorschlaege.length) raus.vorschlaege = [...liste(z.vorschlaege), ...neueVorschlaege];
  if (neueMerk.length) raus.gedaechtnis = [...liste(z.gedaechtnis), ...neueMerk];
  let autonomie = 0;
  if (z.autonomie === undefined && a.autonomie) { raus.autonomie = a.autonomie; autonomie = 1; }
  return { wert: raus, neu: neueVorschlaege.length + neueMerk.length + autonomie };
}

/** Zähler eines Head-Stands für den Bericht (nie Inhalte). Rein. */
export function headZaehler(stand) {
  const s = istObj(stand) ? stand : {};
  const v = liste(s.vorschlaege);
  return {
    merksaetze: liste(s.gedaechtnis).length,
    entschieden: v.filter(x => ENTSCHIEDEN.has(x.status)).length,
    offen: v.filter(x => x.status === 'offen').length,
    berichte: liste(s.berichte).length,
    autonomie: s.autonomie === 'intern' || s.autonomie === 'aus' ? s.autonomie : null,
  };
}
