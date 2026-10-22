// ─── Prozesse · Werkstatt — die Ausgabe eines Schritts als Vorschau (22.10., „Werkstatt bau-fertig“ Punkte 7–8) ──────────────────────────────────────────
// Rechte Spalte des großen Einstellungsfensters: „würde …“ — was dieser Schritt mit den Testwerten (Beispiel bzw. eigene Testdaten, lib/prozesse/testdaten.ts)
// täte: gefüllte Texte (`textvorlageFuellen`), Empfänger, das Freigabe-Schloss, Fristen, bei einer Raute nach Regel jede Bedingung mit „erfüllt / nicht erfüllt“.
// Rein und client-sicher — die Vorschau fragt nie den Server; „Schritt testen“ spielt denselben Schritt im Motor (POST /api/prozesse/probelauf `nur`).
// NIE wird hier etwas gesendet: Außenwirkungen heißen ausdrücklich „würde senden … — erst nach der Freigabe“.
// Tests: tests/prozesse-werkstatt-testdaten.test.ts.

import type { ProzessDefinition, ProzessForm, ProzessKnoten } from './definition';
import { katalogEintrag, klasseVonEintrag, brauchtSchloss, maskeVorgaben, textvorlageFuellen, ROLLE_EIGNER, ROLLE_ZUSTAENDIG } from './baustein-katalog';
import { bedingungText, bedingungTrifft, bedingungenTreffen } from './bedingung';
import { feldTitelVon } from './ausloeser';
import type { TestWert } from './testdaten';

type K = ProzessKnoten<ProzessForm>;
export interface VorschauZeile { feld: string; wert: string }
export interface AusgabeVorschau {
  /** Der Satz oben: „würde senden …“, „würde eine Aufgabe anlegen …“. */
  satz: string;
  zeilen: VorschauZeile[];
  /** Platzhalter ohne Testwert (bleiben im Text leer). */
  fehlend: string[];
  /** Hinter dem Schritt steht ein Freigabe-Schloss (die Wirkung geschieht erst nach dem Klick). */
  schloss: boolean;
}

const wer = (v: unknown, namen: ReadonlyMap<string, string>): string => {
  if (v === ROLLE_ZUSTAENDIG) return 'Zuständig im Fall';
  if (v === ROLLE_EIGNER) return 'Eigner des Prozesses';
  return typeof v === 'string' && v ? namen.get(v) ?? v : 'die zuständige Person des Falls';
};

/**
 * Was dieser Schritt mit den Testwerten täte (rein). `werte` = Platzhalter, Felder, Empfänger (lib/prozesse/testdaten.ts `testWerte`), `namen` = Team-Kennung → Name
 * (zur Laufzeit aus der Instanz), `mitSchloss` = hinter dem Knoten steht ein Schloss.
 */
export function ausgabeVorschau(k: K, d: Pick<ProzessDefinition, 'knoten'>, werte: { platzhalter: Readonly<Record<string, TestWert>>; felder: Readonly<Record<string, TestWert>>; empfaenger: { name: string; email?: string; telefon?: string } },
  o: { namen?: ReadonlyMap<string, string>; mitSchloss?: boolean } = {}): AusgabeVorschau {
  const namen = o.namen ?? new Map<string, string>();
  const e = katalogEintrag(k.katalog?.id);
  const w = { ...(e ? maskeVorgaben(e) : {}), ...(k.katalog?.werte ?? {}) } as Record<string, unknown>;
  const fehlend = new Set<string>();
  const fuell = (v: unknown): string => {
    if (typeof v !== 'string' || !v) return '';
    const r = textvorlageFuellen(v, werte.platzhalter);
    r.fehlend.forEach(x => fehlend.add(x));
    return r.text.trim();
  };
  const klasse = e ? klasseVonEintrag(e) : null;
  const schloss = !!o.mitSchloss || d.knoten.some(x => x.schloss?.fuer === k.id) || brauchtSchloss(klasse);
  const z: VorschauZeile[] = [];
  const an = werte.empfaenger;
  let satz = '';
  const f = k.form ?? 'schritt';
  if (k.deaktiviert) return { satz: 'ist ausgeschaltet — der Lauf überspringt diesen Schritt (ein Schloss dahinter mit).', zeilen: [], fehlend: [], schloss };
  if (e?.id === 'inbox.mail-entwurf') {
    satz = 'würde senden (Mail) — erst nach der Freigabe im Stapel (Schloss)';
    z.push({ feld: 'An', wert: `${an.name} <${an.email ?? '—'}>` }, { feld: 'Betreff', wert: fuell(w.betreff) }, { feld: 'Text', wert: fuell(w.text) });
  } else if (e?.id === 'whatsapp.entwurf') {
    satz = 'würde senden (WhatsApp) — erst nach der Freigabe im Stapel (Schloss)';
    z.push({ feld: 'An', wert: `${an.name} (${an.telefon ?? '—'})` });
    if (typeof w.vorlage === 'string' && w.vorlage) z.push({ feld: 'Vorlage', wert: w.vorlage });
    z.push({ feld: 'Text', wert: fuell(w.text) });
  } else if (e?.id === 'kalender.einladung') {
    satz = 'würde einen Termin mit Einladung vorbereiten — die Einladung geht erst nach der Freigabe raus';
    z.push({ feld: 'Titel', wert: fuell(w.titel) }, { feld: 'Gast', wert: `${an.name} <${an.email ?? '—'}>` }, { feld: 'Dauer', wert: `${w.dauerMin ?? 30} Minuten` });
  } else if (f === 'entscheidung' && k.raute?.art === 'regel') {
    const ja = bedingungenTreffen(k.raute.bedingungen, werte.felder, k.raute.verknuepfung);
    satz = `entscheidet nach Regel → ${ja ? 'ja' : 'nein'} (mit den Testwerten)`;
    for (const b of k.raute.bedingungen) z.push({ feld: bedingungText(b, feldTitelVon), wert: bedingungTrifft(b, werte.felder) ? 'erfüllt' : 'nicht erfüllt' });
  } else if (f === 'entscheidung' && k.raute?.art === 'score') {
    satz = 'entscheidet nach dem Lead-Score (aus der Scoring-Rechnung)';
    z.push({ feld: 'Prüfung', wert: k.raute.pruefung }, { feld: 'Score (Test)', wert: String(werte.felder['lead.score'] ?? '—') });
  } else if (f === 'entscheidung') {
    satz = 'würde eine Person entscheiden lassen (Stapel: freigeben = ja, ablehnen = nein)';
    z.push({ feld: 'Frage', wert: typeof w.frage === 'string' ? w.frage : k.titel }, { feld: 'Wer', wert: wer(w.wer, namen) });
  } else if (f === 'freigabe') {
    satz = k.schloss ? 'Freigabe-Schloss: die Wirkung davor geschieht erst nach dem Klick im Stapel' : 'würde zur Freigabe in den Stapel legen';
    z.push({ feld: 'Wer gibt frei', wert: wer(w.wer, namen) });
  } else if (f === 'warten') {
    const x = k.warten;
    satz = !x ? 'wartet — wie lange, steht noch aus' : x.art === 'dauer' ? `würde ${x.tage} ${x.tage === 1 ? 'Tag' : 'Tage'}${x.stunden ? ` ${x.stunden} h` : ''} warten` : x.art === 'datum' ? `würde bis zum Datum am Fall warten (höchstens ${x.hoechstensTage} Tage)` : `würde auf das Ereignis warten (höchstens ${x.hoechstensStunden ? `${x.hoechstensStunden} Stunden` : `${x.hoechstensTage} Tage`})`;
  } else if (f === 'agent') {
    satz = 'würde den Agenten fragen — das Ergebnis wäre nur ein Vorschlag (kein Modell in der Vorschau)';
    if (k.agent) z.push({ feld: 'Stufe', wert: k.agent.modell }, { feld: 'Budget je Schritt', wert: `${k.agent.budgetCent} ct` }, { feld: 'Auftrag', wert: k.agent.auftrag.slice(0, 400) });
  } else if (f === 'ausloeser') {
    satz = 'startet den Lauf';
  } else if (f === 'ende') {
    satz = 'beendet den Lauf';
  } else if (e && (e.id.startsWith('aufgabe.') || e.id === 'crm.outreach-aufgabe' || e.id === 'kalender.block' || e.id === 'crm.uebergeben' || e.id === 'erinnerung.runde')) {
    satz = 'würde eine Aufgabe anlegen (Abhaken treibt den Lauf weiter)';
    z.push({ feld: 'Titel', wert: fuell(w.titel) || k.titel }, { feld: 'Für', wert: wer(w.wer, namen) });
    if (typeof w.fristTage === 'number') z.push({ feld: 'Fällig', wert: `in ${w.fristTage} ${w.fristTage === 1 ? 'Tag' : 'Tagen'}` });
    if (w.beschreibung || w.notiz || w.hinweis) z.push({ feld: 'Beschreibung', wert: fuell(w.beschreibung ?? w.notiz ?? w.hinweis) });
  } else if (e?.id === 'glocke.melden') {
    satz = 'würde in der Glocke melden (nur intern)';
    z.push({ feld: 'An', wert: wer(w.wer, namen) }, { feld: 'Text', wert: fuell(w.text) });
  } else if (e) {
    satz = schloss ? `bereitet vor: ${e.name} — die Wirkung geschieht erst nach der Freigabe (Schloss)` : `würde: ${e.name}`;
    for (const m of e.maske) if (m.typ === 'textvorlage' && typeof w[m.id] === 'string') z.push({ feld: m.label, wert: fuell(w[m.id]) });
  } else satz = `würde: ${k.titel}`;
  return { satz, zeilen: z, fehlend: [...fehlend], schloss };
}
