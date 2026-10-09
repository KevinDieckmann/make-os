// ─── Agenten-Bereich: der eigene Auftrag an einen Head (09.10.; Auftrag: „Ich möchte, dass wir z. B. beim Onboarding im Thema Gesundheit
// wirklich auch einen Prompt jeweils für den Agenten schreiben müssen. Oder eine Datei hochgeladen werden kann.“) ─────────────────────────
// Rein (Server UND Browser). Gespeichert wird der Auftrag als Feld `auftrag` der Head-Einstellung (lib/agenten/einstellung.ts — die EINE
// Schreibstelle, Stand/409, Protokoll nur Feldnamen); hier stehen nur die Regeln:
//   • Säubern: Freitext, Steuerzeichen weg (Zeilenumbruch und Tab bleiben), höchstens `GRENZEN.headAuftragZeichen` — darüber 413, nie gekürzt.
//   • Kategorie: welche KI-Kategorie der Auftrag trägt — der Gesundheits-Head (und jeder Head, der Gesundheit mit Einwilligung bekommt) `gesundheit`
//     (Art. 9: Speichern nur mit Einwilligung (a), an das Modell nur mit (b)); Familie `familie`; Finanzen privat `finanzen-privat`; sonst
//     `allgemein`. Daten des Katalogs, keine Kennung eines Heads im Code.
//   • An das Modell: nur, wenn die Kategorie für diesen Head gerade aktiv ist (Schalter, Einwilligung — `aktiveKategorien`) UND ein KI-Weg für
//     sie offen ist (Anbieter-Tor, Mindeststufe EU). Sonst bleibt er draußen — nie wird deshalb der ganze Aufruf gesperrt — und die Oberfläche
//     sagt warum.
//   • Rahmen im System-Text: ein Mensch hat ihn geschrieben (kein Text Dritter), aber er steht UNTER den festen Regeln der Software (Wirkung nur als
//     Vorschlag, Datenschutz, Bereich) — er kann sie nicht lockern.

import { GRENZEN, type Ebene, type HeadDef, type KiKategorie } from './typen';

export const AUFTRAG_MAX = GRENZEN.headAuftragZeichen;

export type AuftragFehler = { ok: false; status: 400 | 413; fehler: string };

/** Den Auftrag aus einer Anfrage säubern: `null`/leer = entfernen. Nie gekürzt — über der Grenze 413. Rein. */
export function auftragSaeubern(v: unknown): { ok: true; text: string | null } | AuftragFehler {
  if (v === null || v === undefined) return { ok: true, text: null };
  if (typeof v !== 'string') return { ok: false, status: 400, fehler: 'Auftrag: ein Text (oder leer zum Entfernen).' };
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen (Zeilenumbruch und Tab bleiben)
  const t = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!t) return { ok: true, text: null };
  if (t.length > AUFTRAG_MAX) {
    return { ok: false, status: 413, fehler: `Dein Auftrag hat ${t.length.toLocaleString('de-DE')} Zeichen — höchstens ${AUFTRAG_MAX.toLocaleString('de-DE')}. Nichts gespeichert; bitte kürzen.` };
  }
  return { ok: true, text: t };
}

/** Welche KI-Kategorie trägt der Auftrag an diesen Head? Aus den Kategorien des Katalogs — die empfindlichste gewinnt. Rein. */
export function auftragKategorie(head: Pick<HeadDef, 'kategorien' | 'kategorienMitEinwilligung' | 'bereich'>): KiKategorie {
  const alle = new Set<KiKategorie>([...head.kategorien, ...(head.kategorienMitEinwilligung ?? [])]);
  // Business-Heads tragen nie Gesundheit (Wächter des Katalogs) — hier zur Sicherheit noch einmal.
  if (head.bereich === 'privat' && alle.has('gesundheit')) return 'gesundheit';
  if (alle.has('familie')) return 'familie';
  if (alle.has('finanzen-privat')) return 'finanzen-privat';
  return 'allgemein';
}

/** Braucht das Speichern des Auftrags die Einwilligung (a) in Gesundheitsdaten? (Art. 9 — der Auftrag kann Gesundheitsangaben tragen.) */
export const auftragBrauchtEinwilligung = (head: Pick<HeadDef, 'kategorien' | 'kategorienMitEinwilligung' | 'bereich'>): boolean => auftragKategorie(head) === 'gesundheit';

/** Sätze, warum ein Auftrag gerade nicht an das Modell geht (Oberfläche und Hinweis im Chat). */
export const AUFTRAG_GRUND: Readonly<Record<'gesundheit' | 'gesundheit-weg' | 'familie' | 'familie-weg' | 'finanzen-privat' | 'aus', string>> = {
  gesundheit: 'Geht erst an die KI, wenn du zur Gesundheit „An die KI geben“ (b) erklärt hast (System › Datenschutz) — er kann Gesundheitsangaben enthalten.',
  'gesundheit-weg': 'Gesundheitsangaben gehen nur über einen KI-Weg in der EU an das Modell — der ist noch nicht eingerichtet (System › Datenschutz › KI).',
  familie: 'Familie & Partnerschaft ist für die KI ausgeschaltet (System › Datenschutz) — der Auftrag bleibt solange draußen.',
  'familie-weg': 'Familien-Angaben gehen nur über einen KI-Weg in der EU an das Modell — der ist noch nicht eingerichtet (System › Datenschutz › KI).',
  'finanzen-privat': 'Private Finanzen gehen gerade nicht an die KI (Schalter oder KI-Weg) — der Auftrag bleibt solange draußen.',
  aus: 'Dieser Bereich ist für die KI ausgeschaltet (System › Datenschutz) — der Auftrag bleibt solange draußen.',
};

export interface AuftragKiLage { an: boolean; kategorie: KiKategorie; grund?: string }

/**
 * Geht der Auftrag an das Modell? `aktiv` = die aktiven KI-Kategorien des Heads für diese Person (lib/agenten/werkzeuge.ts `aktiveKategorien` —
 * Schalter und Einwilligung (a)+(b) schon eingerechnet); `moeglich` = ein KI-Weg für die Kategorie ist offen (lib/ki/tor.ts `kategorienMoeglich`,
 * ohne Anbieter-Tor immer ja). Rein.
 */
export function auftragAnKi(head: Pick<HeadDef, 'kategorien' | 'kategorienMitEinwilligung' | 'bereich'>, o: { aktiv: readonly KiKategorie[]; moeglich: boolean }): AuftragKiLage {
  const kategorie = auftragKategorie(head);
  if (kategorie === 'allgemein') return { an: true, kategorie };
  if (!o.aktiv.includes(kategorie)) {
    return { an: false, kategorie, grund: kategorie === 'gesundheit' ? AUFTRAG_GRUND.gesundheit : kategorie === 'familie' ? AUFTRAG_GRUND.familie : kategorie === 'finanzen-privat' ? AUFTRAG_GRUND['finanzen-privat'] : AUFTRAG_GRUND.aus };
  }
  if (!o.moeglich) {
    return { an: false, kategorie, grund: kategorie === 'gesundheit' ? AUFTRAG_GRUND['gesundheit-weg'] : kategorie === 'familie' ? AUFTRAG_GRUND['familie-weg'] : AUFTRAG_GRUND['finanzen-privat'] };
  }
  return { an: true, kategorie };
}

/** Überschrift des Auftrags im System-Text — Ebene Person: „der Person“, Ebene Haushalt: „des Haushalts“. */
export const auftragTitel = (ebene: Ebene): string => (ebene === 'person' ? 'AUFTRAG DER PERSON FÜR DIESEN AGENTEN' : 'AUFTRAG DES HAUSHALTS FÜR DIESEN AGENTEN');

/**
 * Der Abschnitt im System-Text (Head UND seine Mitarbeiter). Von einem Menschen geschrieben — kein Text Dritter, also nicht in `<fremde_daten>`;
 * er gilt aber nur INNERHALB der festen Regeln (Wirkung, Freigabe, Datenschutz, Bereich). Rein.
 */
export function auftragBlock(head: Pick<HeadDef, 'ebene'>, text: string): string {
  return `${auftragTitel(head.ebene)} (von einem Menschen geschrieben — richte deine Arbeit danach aus; die Regeln oben zu Wirkung, Freigabe, Datenschutz und deinem Bereich gehen immer vor und lassen sich damit nicht lockern):\n${text}`;
}
