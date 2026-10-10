// ─── Werkzeug-Verträge: die EINE Einordnung je Werkzeug (10.10., Paket V3, AGENTEN_KONZEPT_V2.md C3) — rein, Server UND Browser ─────────────
// Was ein Werkzeug darf und was es zurückbringt, stand bis V3 in vier Listen an vier Orten (LESEND in lib/zoe/gespraech-schutz.ts,
// FREMD_WERKZEUGE und SELBST_GEKAPSELT in lib/zoe/fremd.ts, WERKZEUG_KATEGORIE in lib/datenschutz/ki-werkzeuge.ts) — und die Rechteklasse
// stand nirgends. Jetzt steht JE WERKZEUG EINE Zeile hier; die alten Listen werden daraus ABGELEITET (gleiche Namen, gleicher Inhalt —
// Wächter tests/werkzeug-vertraege.test.ts › „abgeleitete Listen“). Was es schon an anderer Stelle gab, bleibt dort und wird nur gelesen:
// Gruppe und Stufe (frei/Freigabe, `risikoFuer`) im Register lib/zoe/register.ts, das Eingabe-Schema in lib/zoe/werkzeug-defs.ts (bzw. den
// Teil-Quellen), die KI-Kategorie einer Gruppe in lib/datenschutz/ki-werkzeuge.ts (`GRUPPE_KATEGORIE`).
//
// Felder:
//   rechte     lesen · vorschlag · intern · aussen · geld · loeschen (lib/werkzeuge/vertrag.ts) — `lesen`/`vorschlag` laufen auch nach fremdem
//              Text (daraus: LESEND), `aussen`/`geld`/`loeschen` wirken NIE ohne Klick.
//   bereich    nur, wo die Gruppe ihn nicht schon sagt (Agenten-Werkzeuge ohne Gruppe) — sonst leitet das Register ihn aus der Gruppe ab
//              (lib/zoe/bereich.ts BUSINESS_GRUPPEN/PRIVAT_GRUPPEN, lib/arbeitsrahmen/regel.ts ZOE_BUSINESS_GRUPPEN).
//   fremd      trägt Text Dritter → Quelle im <fremde_daten>-Rahmen (daraus: FREMD_WERKZEUGE; danach wirkt Schreibendes nur als Vorschlag).
//   gekapselt  kapselt die Antwort selbst (Kopfzeile + eigener Rahmen; ins Protokoll nur die Kopfzeile) (daraus: SELBST_GEKAPSELT).
//   kategorie  Ausnahme zur KI-Kategorie der Gruppe (auch `null` = keine) (daraus: WERKZEUG_KATEGORIE).
//
// Neues Werkzeug = eine Zeile hier + Schema (werkzeug-defs.ts bzw. die Teil-Quelle) + Stufe im Register — sonst wird der Wächter rot.

import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';
import type { Rechteklasse, WerkzeugBereich } from './vertrag';

export interface Einordnung {
  rechte: Rechteklasse;
  /** zoe = Register-Werkzeug · steuerung = run_agent/open_agent im ZOE-Gespräch · agent = nur Heads/Mitarbeiter. */
  herkunft: 'zoe' | 'steuerung' | 'agent';
  bereich?: WerkzeugBereich;
  fremd?: string;
  gekapselt?: true;
  /** Ausnahme zur Kategorie der Gruppe — `null` heißt ausdrücklich „keine“. */
  kategorie?: KiKategorie | null;
}

const z = (rechte: Rechteklasse, x: Omit<Einordnung, 'rechte' | 'herkunft'> = {}): Einordnung => ({ rechte, herkunft: 'zoe', ...x });
const a = (rechte: Rechteklasse, x: Omit<Einordnung, 'rechte' | 'herkunft'> = {}): Einordnung => ({ rechte, herkunft: 'agent', ...x });
const s = (rechte: Rechteklasse, x: Omit<Einordnung, 'rechte' | 'herkunft'> = {}): Einordnung => ({ rechte, herkunft: 'steuerung', ...x });
// Markttraktion lesen (28.09., C7): alle kapseln selbst (Kopfzeile + fremd(), lib/zoe/crm-werkzeuge.ts).
const MT = { fremd: 'markttraktion', gekapselt: true } as const;

export const EINORDNUNG: Readonly<Record<string, Einordnung>> = {
  // ── Aufgaben, Planung, Kalender ─────────────────────────────────────────────────────────────────────────────────────────
  create_task: z('intern'),
  aufgabe_an_zoe: z('intern'),
  // 28.09. (C4): Titel der eigenen ZOE-Aufgaben.
  meine_aufgaben: z('lesen', { fremd: 'aufgaben' }),
  // 28.09. (C2): Projekt-/Aufgaben-Dateien und Notizen — kapseln selbst.
  projekt_unterlagen: z('lesen', { fremd: 'projekt-unterlagen', gekapselt: true }),
  datei_lesen: z('lesen', { fremd: 'projekt-unterlagen', gekapselt: true }),
  // 29.09. (B3): eine Suche über Brain und App — kapselt selbst.
  suche_arbeit: z('lesen', { fremd: 'arbeitsbestaende', gekapselt: true }),
  setze_meilenstein: z('intern'),
  setze_fokus: z('intern'),
  // K6a (29.09.): freie Zeit — nur Zeiten, nichts wird angelegt.
  freie_zeit: z('lesen'),
  // F2 M8 (29.09.): ein Block ist ein Termin — nur über den Stapel. #K1: bei einer Kollision nennt die Antwort den Titel des festen Termins —
  // Titel können aus Einladungen Dritter stammen.
  plan_block: z('intern', { fremd: 'kalender' }),
  starte_auftraege: z('intern'),
  // ── Wissen, Gedächtnis, Bauplan ─────────────────────────────────────────────────────────────────────────────────────────
  suche_wissen: z('lesen', { fremd: 'notizen' }),
  lies_notiz: z('lesen', { fremd: 'notizen' }),
  notiz_anlegen: z('intern'),
  notiz_ergaenzen: z('intern'),
  fakt_merken: z('intern'),
  frag_gedaechtnis: z('lesen', { fremd: 'gedaechtnis' }),
  bauplan_notieren: z('intern'),
  // ── Postfach ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  lies_postfach: z('lesen', { fremd: 'postfach' }),
  // ── Gesundheit, Einkauf (Privat) ────────────────────────────────────────────────────────────────────────────────────────
  gesundheits_index: z('lesen'),
  trainingsplan_lesen: z('lesen'),
  // Gespeichert wird erst nach der Freigabe der Person (Stufe „freigabe“) — dann schreibt es ihre Vorlage.
  trainingsplan_vorschlagen: z('intern'),
  setze_vitalwerte: z('intern'),
  // Routinen abhaken (09.10., Funde klein): neutral statt „Gesundheit“ — eine Business-Routine braucht keine Gesundheits-Einwilligung. Das Werkzeug
  // prüft je Routine selbst (lib/zoe/werkzeuge.ts `hakeRoutine`): Einwilligung (a) zum Schreiben (`health-log` ist Art. 9, wie in der Oberfläche),
  // Business-Routinen nur mit eingeschaltetem Bereich „Aufgaben & Ziele“, Privat-Routinen nur mit (b) „an die KI“ (ihre Namen gehen an das Modell).
  // Neutral, damit der Gesundheits-Head (Kategorie Gesundheit) das Werkzeug behält; kimmi nennt die Kategorien im Protokoll.
  // Bereich „beide“ (nicht der der Gruppe „gesundheit“): es gibt Business-Routinen — welche Routine es trifft, entscheidet das Werkzeug je Routine.
  hake_routine: z('intern', { kategorie: null, bereich: 'beide' }),
  haut_eintrag: z('intern'),
  journal_eintrag: z('intern'),
  streak_eintrag: z('intern'),
  // Die Einkaufsliste steht in der Gruppe „gesundheit“, ist aber keine Gesundheitsangabe.
  einkauf_setzen: z('intern', { kategorie: null }),
  // ── Haushaltsfinanzen (Privat) ──────────────────────────────────────────────────────────────────────────────────────────
  haushalt_stand: z('lesen'),
  haushalt_buchungen: z('lesen', { fremd: 'bank' }),
  haushalt_zuordnen: z('geld'),
  haushalt_rechnung_bezahlt: z('geld'),
  haushalt_rechnung_erfassen: z('geld'),
  // ── Finanzen, Business, Gesellschaften ──────────────────────────────────────────────────────────────────────────────────
  business_index: z('lesen'),
  gesellschaften_lesen: z('lesen'),
  monatsabschluss_erfassen: z('geld'),
  setze_kontostand: z('geld'),
  erfasse_rechnung: z('geld'),
  erfasse_zahlung: z('geld'),
  erfasse_planposten: z('geld'),
  setze_ziele: z('geld'),
  // 26.09.: Honorare landen im MRR und im Business-Index — Geld.
  setze_kunde: z('geld'),
  // ── Markttraktion ───────────────────────────────────────────────────────────────────────────────────────────────────────
  suche_kontakt: z('lesen', { fremd: 'kontakte', gekapselt: true }),
  crm_lage: z('lesen', { fremd: 'crm', gekapselt: true }),
  notiere_kontakt: z('intern'),
  chance_anlegen: z('intern'),
  uebergeben: z('intern'),
  // Ein Entwurf für draußen (Mail, LinkedIn) — verschickt nichts, schreibt nichts; nach fremdem Text trotzdem nur als Vorschlag (kein `lesen`).
  entwurf_ansprache: z('intern'),
  crm_suche: z('lesen', MT), kontakt_akte: z('lesen', MT), firma_akte: z('lesen', MT), pipeline: z('lesen', MT), mandate_lage: z('lesen', MT),
  angebote_lage: z('lesen', MT), kampagnen_lage: z('lesen', MT), events_lage: z('lesen', MT), besuche_lage: z('lesen', MT), marketing_lage: z('lesen', MT),
  kennzahlen: z('lesen', MT), sales_lage: z('lesen', MT), qualifizierung_lage: z('lesen', MT), stammdaten_lage: z('lesen', MT), datenqualitaet: z('lesen', MT),
  crm_datei_lesen: z('lesen', { fremd: 'crm-ablage', gekapselt: true }), heads_lage: z('lesen', MT),
  // Legt NUR in den Stapel (Art „crm“) — übernommen wird erst per Klick.
  crm_vorschlag: z('vorschlag'),
  // ── Heads (Paket 4a, 09.10.) ────────────────────────────────────────────────────────────────────────────────────────────
  // an_head reiht nur ein (Thread + Warteschlange) — keine feste Kategorie: der Head läuft mit SEINEN aktiven Kategorien durch das KI-Tor.
  an_head: z('intern', { kategorie: null }),
  // head_fragen liest nur (der Head bekommt nur lesende Werkzeuge); die Antwort ist Text eines anderen Agenten (er liest Kartei, Postfach,
  // Notizen seines Bereichs) und trägt die Kategorien, mit denen der Head lief (lib/agenten/zoe-heads.ts `headFrageKategorien`).
  head_fragen: z('lesen', { fremd: 'agent', kategorie: null }),

  // ── ZOE-Steuerung im Gespräch (nicht im Register; app/api/kimmi) ────────────────────────────────────────────────────────
  // Ein Fach-Agent läuft und liefert sein Ergebnis — nach fremdem Text bzw. vertraulichem Lesen nur als Auftrag im Stapel (`agentNurVorschlag`).
  run_agent: s('intern', { bereich: 'beide' }),
  // Nur ein Verweis in die Oberfläche (Antwort `handoffs`) — kein Lauf.
  open_agent: s('lesen', { bereich: 'beide' }),

  // ── Agenten-Werkzeuge (nur Heads/Mitarbeiter, lib/agenten/werkzeuge.ts `agentenDefs`, nie im ZOE-Register) ──────────────
  an_mitarbeiter: a('intern', { bereich: 'beide' }),
  skill_laden: a('lesen', { bereich: 'beide' }),
  // Persönlich legt der Agent selbst ab (sichtbar, löschbar), für den Haushalt nur als Vorschlag — beides schreibt eigene Bestände.
  merksatz_vorschlagen: a('intern', { bereich: 'beide' }),
  skill_vorschlagen: a('vorschlag', { bereich: 'beide' }),
  mitarbeiter_vorschlagen: a('vorschlag', { bereich: 'beide' }),
  brett_antworten: a('intern', { bereich: 'beide' }),
  brett_eintragen: a('intern', { bereich: 'beide' }),
  hilfe_anfragen: a('intern', { bereich: 'beide' }),
  rat_holen: a('lesen', { bereich: 'beide' }),
  fach_agent: a('intern', { bereich: 'beide' }),
  // Paket 4c: Medien-Werkzeuge der Business-Heads (lib/agenten/medien-werkzeuge.ts). `bild_bearbeiten` schickt die PIXEL eines Fotos hinaus
  // (Kategorie `medien`, Schalter „Bilder an die KI“); suchen, erzeugen (aus Text) und Vorschläge lesen keine Bildinhalte. Nachschliff 09.10.:
  // `medien_suchen` kapselt selbst (Dateinamen, Album-Titel, Notizen im eigenen Rahmen). Bilder kosten Geld (Budget prüft der Server) — das ist
  // keine Geldbewegung, deshalb `intern`; ein Video startet nie selbst (`vorschlag`).
  medien_suchen: a('lesen', { bereich: 'business', gekapselt: true, kategorie: null }),
  medien_vorschlagen: a('vorschlag', { bereich: 'business', kategorie: null }),
  bild_erzeugen: a('intern', { bereich: 'business', kategorie: null }),
  bild_bearbeiten: a('intern', { bereich: 'business', kategorie: 'medien' }),
  video_starten: a('vorschlag', { bereich: 'business', kategorie: null }),
  // 09.10.: Wissen des Business-Heads im Brain (lib/agenten/wissen-werkzeug.ts) — Privat-Heads haben dort nie Wissen.
  wissen_suchen: a('lesen', { bereich: 'business' }),
  // 09.10.: Gesundheits-Unterlagen der Person (nur der Gesundheits-Head, lib/agenten/unterlagen-werkzeug.ts) — Kopfzeile + eigener Rahmen.
  gesundheit_unterlagen: a('lesen', { bereich: 'privat', gekapselt: true }),
};

/**
 * Frühere Werkzeug-Namen, die in alten Verläufen (`ran`) noch stehen können — sie zählen weiter als Leser mit Text Dritter (S1 #4: ein Gespräch
 * bleibt „fremd gelesen“). Es gibt sie nicht mehr als Werkzeug, deshalb keinen Vertrag.
 */
export const ALT_NAMEN: Readonly<Record<string, Einordnung>> = {
  finde_kontakt: z('lesen', { fremd: 'kontakte' }),
  lies_kontakt: z('lesen', { fremd: 'kontakte' }),
};

const ALLE: readonly [string, Einordnung][] = [...Object.entries(EINORDNUNG), ...Object.entries(ALT_NAMEN)];

/** Register-Werkzeuge, die nur lesen bzw. nur vorschlagen — sie laufen auch nach Fremdtext frei (→ lib/zoe/gespraech-schutz.ts `LESEND`). */
export const LESEND_ABGELEITET: ReadonlySet<string> = new Set(ALLE.filter(([, e]) => e.herkunft === 'zoe' && (e.rechte === 'lesen' || e.rechte === 'vorschlag')).map(([n]) => n));
/** Register-Werkzeug → Fremd-Quelle (→ lib/zoe/fremd.ts `FREMD_WERKZEUGE`). */
export const FREMD_ABGELEITET: Readonly<Record<string, string>> = Object.fromEntries(ALLE.filter(([, e]) => e.herkunft === 'zoe' && e.fremd).map(([n, e]) => [n, e.fremd!]));
/** Werkzeuge, die ihre Antwort selbst kapseln (→ lib/zoe/fremd.ts `SELBST_GEKAPSELT`). */
export const GEKAPSELT_ABGELEITET: ReadonlySet<string> = new Set(ALLE.filter(([, e]) => e.gekapselt).map(([n]) => n));
/** Ausnahmen zur Kategorie der Gruppe (→ lib/datenschutz/ki-werkzeuge.ts `WERKZEUG_KATEGORIE`). */
export const KATEGORIE_ABGELEITET: Readonly<Record<string, KiKategorie | null>> = Object.fromEntries(ALLE.filter(([, e]) => 'kategorie' in e).map(([n, e]) => [n, e.kategorie ?? null]));
