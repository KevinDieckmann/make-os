// ─── Texte je Produkt mit Platzhaltern — Einleitung, Begleit-Mail, Willkommensmail (rein, client-sicher, 25.10., kleine Bauten) ──────
// Kevin 25.10.: die Unterlagen je Produkt bringen eigene Texte mit (Einleitung im Angebot, Mail zum Angebot, Willkommensmail beim Start). Sie
// schreiben Platzhalter in der MAKE-OS-Form `{{feld}}` — dieselbe Schreibweise wie die Vorlagen der Werkstatt (lib/prozesse/baustein-katalog.ts:
// `{{kontakt.gruss}}` = „Guten Tag Vorname Nachname“ bzw. „Hallo Vorname“, das Komma schreibt der Text). Hier: welche Platzhalter es je Text gibt,
// die Prüfung (unbekannte → Satz, nie still) und das Füllen. Keine Abhängigkeiten — Produkt-Karte, Angebot und Fulfillment lesen von hier.
// Werte aus der Kartei sind fremder Text: gefüllt wird nur ersetzt, nie ausgeführt; wer das Ergebnis an ein Modell gibt, kapselt es (`fremd()`).

/** Grenzen der Produkt-Texte (25.10.) — darüber 413, nie still gekürzt. */
export const PRODUKT_TEXT_GRENZEN = { betreff: 200, text: 4000 } as const;

/** Die Platzhalter je Art des Textes (Name → Erklärung für die Oberfläche). */
export const PLATZHALTER = {
  angebot: {
    'kontakt.gruss': 'Grußzeile — „Guten Tag Vorname Nachname“ bzw. „Hallo Vorname“ (Komma dahinter selbst schreiben)',
    'kontakt.anrede': 'Sie oder Du', 'kontakt.vorname': 'Vorname', 'kontakt.nachname': 'Nachname', 'firma.name': 'Firma des Kunden',
    'angebot.nummer': 'Angebotsnummer', 'angebot.titel': 'Titel des Angebots', 'angebot.gueltigBis': 'gültig bis (TT.MM.JJJJ)',
    'absender.name': 'Gesellschaft (Absender)', 'person.name': 'wer das Angebot sendet', heute: 'heutiges Datum (TT.MM.JJJJ)',
  },
  willkommen: {
    'kontakt.gruss': 'Grußzeile — „Guten Tag Vorname Nachname“ bzw. „Hallo Vorname“ (Komma dahinter selbst schreiben)',
    'kontakt.anrede': 'Sie oder Du', 'kontakt.vorname': 'Vorname', 'kontakt.nachname': 'Nachname', 'kunde.gruss': 'wie kontakt.gruss', 'firma.name': 'Firma des Kunden',
    'mandat.titel': 'Titel des Mandats', 'mandat.start': 'Start (TT.MM.JJJJ)', 'mandat.produkt': 'Produkt des Mandats', heute: 'heutiges Datum (TT.MM.JJJJ)',
    // Die Platzhalter der Onboarding-Vorlage (lib/fulfillment/prozesse/onboarding.ts `willkommenMail`) — füllt sie beim Senden selbst.
    anrede: 'Grußzeile des Onboardings', vorname: 'Vorname', nachname: 'Nachname', kickoff_vorschlaege: 'Terminvorschläge für den Kick-off', playbook_link: 'Link zum Kunden-Playbook (ohne Link fällt der Absatz weg)',
    gruss: 'Gruß und Vorname der sendenden Person', absender: 'Vorname der sendenden Person',
  },
} as const;
/** Die Platzhalter, die erst `willkommenMail` (Onboarding) füllt — beim Vorbereiten bleiben sie stehen. */
export const WILLKOMMEN_ONBOARDING = ['anrede', 'vorname', 'nachname', 'kickoff_vorschlaege', 'playbook_link', 'gruss', 'absender'] as const;
export type PlatzhalterArt = keyof typeof PLATZHALTER;

/** `{{ feld }}` — Kennung klein, mit Punkt; linear (keine Rückverfolgung über lange Texte). */
const MUSTER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]{0,59})\s*\}\}/g;

/** Unbekannte Platzhalter bzw. kaputte Klammern als Sätze (leer = in Ordnung). `wo` = Name des Feldes für den Satz. */
export function platzhalterPruefen(text: string, art: PlatzhalterArt, wo: string): string[] {
  const erlaubt = PLATZHALTER[art] as Record<string, string>;
  const raus: string[] = [];
  for (const m of text.matchAll(MUSTER)) if (!(m[1] in erlaubt)) raus.push(`${wo}: den Platzhalter {{${m[1]}}} gibt es hier nicht — erlaubt sind ${Object.keys(erlaubt).map(k => `{{${k}}}`).join(', ')}. Was von Hand kommt, bitte als „[von Hand: …]“ schreiben.`);
  if (/\{\{|\}\}/.test(text.replace(MUSTER, ''))) raus.push(`${wo}: ein Platzhalter ist nicht lesbar (Form: {{feld}}).`);
  return Array.from(new Set(raus));
}

/** Platzhalter füllen: bekannte aus `werte` (fehlt der Wert → leer), unbekannte — und alle, die `werte` nicht kennt — bleiben stehen (die Vorschau zeigt sie). Rein. */
export function platzhalterFuellen(text: string, werte: Readonly<Record<string, string | undefined>>): string {
  return text.replace(MUSTER, (g, feld: string) => (feld in werte ? werte[feld] ?? '' : g));
}

const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
/** Die Grußzeile ohne Komma — dieselbe Regel wie die Werkstatt (`kundenGruss`): Du → „Hallo Vorname“, Sie → „Guten Tag Vorname Nachname“. */
export function grussZeile(anrede: 'Sie' | 'Du' | undefined, vorname?: string, nachname?: string): string {
  const v = (vorname ?? '').trim(), n = (nachname ?? '').trim();
  return anrede === 'Du' ? ['Hallo', v || n].filter(Boolean).join(' ') : ['Guten Tag', v, n].filter(Boolean).join(' ');
}
/** Hat der Text eine eigene Grußzeile (dann setzt die Einleitung keine davor)? */
export const hatGruss = (text: string) => /\{\{\s*(kontakt|kunde)\.gruss\s*\}\}/.test(text);

export interface PersonWerte { anrede?: 'Sie' | 'Du'; vorname?: string; nachname?: string; firma?: string }
/** Werte der Platzhalter für Texte zum Angebot (Einleitung, Begleit-Mail). */
export function angebotWerte(e: PersonWerte & { nummer?: string; titel?: string; gueltigBis?: string; absender?: string; person?: string; heute?: string }): Record<string, string> {
  return {
    'kontakt.gruss': grussZeile(e.anrede, e.vorname, e.nachname), 'kontakt.anrede': e.anrede === 'Du' ? 'Du' : 'Sie', 'kontakt.vorname': e.vorname?.trim() ?? '',
    'kontakt.nachname': e.nachname?.trim() ?? '', 'firma.name': e.firma?.trim() ?? '', 'angebot.nummer': e.nummer ?? '', 'angebot.titel': e.titel ?? '',
    'angebot.gueltigBis': datumDe(e.gueltigBis), 'absender.name': e.absender ?? '', 'person.name': e.person ?? '', heute: datumDe(e.heute),
  };
}
/** Werte der Platzhalter für die Willkommensmail (Fulfillment-Onboarding). */
export function willkommenWerte(e: PersonWerte & { mandatTitel?: string; start?: string; produkt?: string; heute?: string }): Record<string, string> {
  const g = grussZeile(e.anrede, e.vorname, e.nachname);
  return {
    'kontakt.gruss': g, 'kunde.gruss': g, 'kontakt.anrede': e.anrede === 'Du' ? 'Du' : 'Sie', 'kontakt.vorname': e.vorname?.trim() ?? '', 'kontakt.nachname': e.nachname?.trim() ?? '',
    'firma.name': e.firma?.trim() ?? '', 'mandat.titel': e.mandatTitel ?? '', 'mandat.start': datumDe(e.start), 'mandat.produkt': e.produkt ?? '', heute: datumDe(e.heute),
  };
}

/** Eine Mail-Vorlage { betreff?, text? } säubern (Zeilenenden, Länge auf die Grenze — die Prüfung lehnt vorher ab). Leer → undefined. */
export function mailTexteSaeubern(v: unknown): { betreff?: string; text?: string } | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const betreff = typeof o.betreff === 'string' ? o.betreff.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PRODUKT_TEXT_GRENZEN.betreff) : '';
  const text = typeof o.text === 'string' ? o.text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, PRODUKT_TEXT_GRENZEN.text) : '';
  return betreff || text ? { ...(betreff ? { betreff } : {}), ...(text ? { text } : {}) } : undefined;
}
/** Eine Mail-Vorlage prüfen: Form, Grenzen (413), Platzhalter (400). Leer = in Ordnung. */
export function mailTextePruefen(v: unknown, art: PlatzhalterArt, wo: string): { status: 400 | 413; text: string }[] {
  if (v === undefined || v === null) return [];
  if (typeof v !== 'object' || Array.isArray(v)) return [{ status: 400, text: `${wo}: { betreff, text }.` }];
  const o = v as Record<string, unknown>;
  const f: { status: 400 | 413; text: string }[] = [];
  for (const [k, max, name] of [['betreff', PRODUKT_TEXT_GRENZEN.betreff, 'Betreff'], ['text', PRODUKT_TEXT_GRENZEN.text, 'Text']] as const) {
    const w = o[k];
    if (w === undefined || w === null) continue;
    if (typeof w !== 'string') { f.push({ status: 400, text: `${wo}, ${name}: Text.` }); continue; }
    if (w.trim().length > max) f.push({ status: 413, text: `${wo}, ${name} ist zu lang (höchstens ${max.toLocaleString('de-DE')} Zeichen) — nichts gespeichert.` });
    f.push(...platzhalterPruefen(w, art, `${wo}, ${name}`).map(t => ({ status: 400 as const, text: t })));
  }
  return f;
}
