// ─── Fixture: Beispiel-Antworten der Agenten-Schnittstellen (08.10. spät, Paket 0 „Vertrag“) ───────────────────────────
// Die Oberfläche (Paket 2) baut gegen diese Antworten, solange die Routen noch 501 antworten (Pakete 1/3/5). Alles erfunden und
// neutral: Speichernamen `person-a`/`person-b`, „Kunde A“, „Beispiel GmbH“, „Anna Beispiel“ — keine echten Namen, Firmen, Beträge.
// Typen aus lib/agenten/typen.ts (`satisfies`) — ändert sich der Vertrag, wird tsc hier rot. Heads aus dem Katalog (Name, Farbe …).

import { headDef } from '@/lib/agenten/katalog';
import { WEG } from '@/lib/wege';
import type {
  AgentenAntwort, FadenAntwort, FadenKurz, FadenListeAntwort, FadenSendenAntwort, HeadKarte, LaeufeAntwort, MedienAntwort,
  Mitarbeiter, Nachricht, Faden, Skill, SkillAntwort, SkillKurz, SkillsAntwort,
} from '@/lib/agenten/typen';

export const ICH = 'person-a';
const T = (stunde: number, minute = 0) => `2026-10-08T${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const KI = { erzeugt: true as const, durch: 'ZOE (KI-Modell)', hinweis: 'Von einer KI erzeugt — bitte prüfen.', zeit: T(7, 30) };

// ── Threads ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const FADEN_HEAD_ID = 'fd-00000000-0000-4000-8000-000000000001';
export const FADEN_MITARBEITER_ID = 'fd-00000000-0000-4000-8000-000000000002';

const nachrichtenHead: Nachricht[] = [
  { id: 'nr-1', rolle: 'person', von: ICH, text: 'Wie sieht die Pipeline diese Woche aus — und wer ist heute dran?', zeit: T(7, 31) },
  { id: 'nr-2', rolle: 'agent', von: 'head:sales', ki: true, zeit: T(7, 32),
    text: 'Drei Deals hängen seit über 30 Tagen, zwei davon bei Kunde A. Heute sind vier Gespräche dran. Ich lasse die Ansprache für Kunde A vorbereiten.',
    werkzeuge: [{ name: 'pipeline', ok: true }, { name: 'sales_lage', ok: true }] },
  { id: 'nr-3', rolle: 'system', von: 'system', text: 'An Thread „Nachfassen Kunde A“ gesendet', zeit: T(7, 32),
    verweis: { art: 'gesendet', fadenId: FADEN_MITARBEITER_ID, titel: 'Nachfassen Kunde A' } },
  { id: 'nr-4', rolle: 'system', von: 'system', text: 'Bericht aus Thread „Nachfassen Kunde A“: zwei Entwürfe liegen zur Freigabe bereit.', zeit: T(7, 41),
    verweis: { art: 'bericht', fadenId: FADEN_MITARBEITER_ID, titel: 'Nachfassen Kunde A' } },
];

export const FADEN_HEAD: Faden = {
  id: FADEN_HEAD_ID, besitzer: ICH, agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: 'Pipeline diese Woche',
  status: 'offen', fremdGelesen: false, vertraulich: false, nachrichten: nachrichtenHead, erstellt: T(7, 31), aktualisiert: T(7, 41),
};

export const FADEN_MITARBEITER: Faden = {
  id: FADEN_MITARBEITER_ID, besitzer: ICH, agent: { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-nachfassen' }, bereich: 'business',
  elternId: FADEN_HEAD_ID, titel: 'Nachfassen Kunde A', status: 'fertig', fremdGelesen: true, vertraulich: false,
  nachrichten: [
    { id: 'nr-5', rolle: 'agent', von: 'head:sales', zeit: T(7, 32),
      text: 'Ziel: Nachfassen bei Kunde A vorbereiten. Format: zwei kurze Entwürfe mit Anlass. Grenzen: nichts senden, nur Vorschläge. Quellen: Deal-Verlauf, letzte Aktivitäten.' },
    { id: 'nr-6', rolle: 'agent', von: 'mitarbeiter:sales:sales-nachfassen', ki: true, zeit: T(7, 40),
      text: 'Zwei Entwürfe für Anna Beispiel liegen im Stapel: eine kurze Mail mit Bezug auf das letzte Gespräch und ein Gesprächsleitfaden für die Power Hour.',
      werkzeuge: [{ name: 'kontakt_akte', ok: true }, { name: 'crm_vorschlag', ok: true, gestapelt: true, vorschlagId: 'v-beispiel-1' }, { name: 'crm_vorschlag', ok: true, gestapelt: true, vorschlagId: 'v-beispiel-2' }],
      kosten: { cent: 4 } },
  ],
  lauf: {
    auftragId: 'a-00000000-0000-4000-8000-000000000003', status: 'fertig', start: T(7, 33), ende: T(7, 40), kostenCent: 4, kostenGrenzeCent: 50,
    schritte: [
      { id: 's1', titel: 'Deal und Verlauf lesen', status: 'fertig', start: T(7, 33), ende: T(7, 35) },
      { id: 's2', titel: 'Entwürfe schreiben', status: 'fertig', start: T(7, 35), ende: T(7, 39) },
      { id: 's3', titel: 'In den Stapel legen', status: 'fertig', start: T(7, 39), ende: T(7, 40) },
    ],
  },
  erstellt: T(7, 32), aktualisiert: T(7, 41),
};

const kurz = (f: Faden): FadenKurz => ({ id: f.id, titel: f.titel, agent: f.agent, status: f.status, aktualisiert: f.aktualisiert, ...(f.elternId ? { elternId: f.elternId } : {}) });

export const FADEN_ZOE_KURZ: FadenKurz = { id: 'fd-00000000-0000-4000-8000-000000000004', titel: 'Tages-Briefing', agent: { art: 'zoe' }, status: 'offen', aktualisiert: T(7, 0) };

export const FADEN_ANTWORT = { ok: true, faden: FADEN_HEAD, stand: 'stand-beispiel-1', kinder: [kurz(FADEN_MITARBEITER)] } satisfies FadenAntwort;
export const FADEN_LISTE = { ok: true, faeden: [FADEN_ZOE_KURZ, kurz(FADEN_HEAD), kurz(FADEN_MITARBEITER)] } satisfies FadenListeAntwort;
export const FADEN_SENDEN = {
  ok: true, faden: FADEN_HEAD, stand: 'stand-beispiel-2', antwort: nachrichtenHead[1], stapelOffen: 2, ki: KI,
} satisfies FadenSendenAntwort;

// ── Skills und Mitarbeiter ──────────────────────────────────────────────────────────────────────────────────────────────

export const SKILL: Skill = {
  id: 'sk-00000000-0000-4000-8000-000000000005', headId: 'sales', mitarbeiterId: 'sales-nachfassen', name: 'angebot-nachfassen',
  beschreibung: 'Bereitet das Nachfassen zu offenen Angeboten vor. Wird genutzt, wenn ein Angebot länger als sieben Tage ohne Antwort ist.',
  anleitung: '1. Offene Angebote ohne Antwort seit sieben Tagen lesen.\n2. Je Angebot einen kurzen Entwurf mit Bezug auf das Gespräch schreiben.\n3. Nur als Vorschlag in den Stapel legen — nie senden.',
  beispiele: [{ eingabe: 'Angebot an Kunde A seit 9 Tagen offen', ergebnis: 'Entwurf: kurze Mail mit Frage nach offenen Punkten' }],
  werkzeuge: ['angebote_lage', 'kontakt_akte', 'crm_vorschlag'],
  ausloeser: { art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' },
  eingabeFelder: [{ id: 'tage', label: 'Ab wie vielen Tagen', art: 'zahl', pflicht: true }],
  freigabePflicht: true, ergebnis: 'stapel', stufe: 'schnell', kostenGrenzeCent: 20,
  tests: [
    { eingabe: 'Ein Angebot seit 9 Tagen offen', erwartet: ['ein Entwurf', 'kein Versand'] },
    { eingabe: 'Kein Angebot offen', erwartet: ['nichts zu tun'] },
    { eingabe: 'Angebot an eine gesperrte Person', erwartet: ['kein Entwurf'] },
  ],
  testlauf: { am: T(6, 50), von: ICH, ok: true, ergebnisse: [{ test: 0, ok: true }, { test: 1, ok: true }, { test: 2, ok: true }] },
  erfolg: { laeufe: 12, angenommen: 9, abgelehnt: 2, fehler: 1, zuletzt: T(7, 0) },
  aktiv: true, version: 2, quelle: 'gespraech', angelegtVon: ICH, geaendertAm: T(6, 50),
};

const skillKurz = (s: Skill): SkillKurz => ({ id: s.id, headId: s.headId, ...(s.mitarbeiterId ? { mitarbeiterId: s.mitarbeiterId } : {}), name: s.name, beschreibung: s.beschreibung, ausloeser: s.ausloeser, aktiv: s.aktiv, erfolg: s.erfolg });
const EINGEBAUT_POWER_HOUR: SkillKurz = {
  id: 'eingebaut:heads:power_hour', headId: 'sales', name: 'power-hour', beschreibung: 'Bereitet die Power Hour vor: wer heute dran ist, mit Grund, Aufhänger und Kanal.',
  ausloeser: { art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '07:00' }, aktiv: true, eingebaut: true,
};

const MITARBEITER_NACHFASSEN: Mitarbeiter = {
  id: 'sales-nachfassen', headId: 'sales', vorlageId: 'sales-nachfassen', name: 'Nachfassen & Power Hour',
  rolle: 'Stellt die Power-Hour-Liste zusammen und schlägt Reihenfolge, Anlass und Gesprächsleitfaden vor.',
  werkzeuge: ['sales_lage', 'pipeline', 'kontakt_akte', 'entwurf_ansprache', 'crm_vorschlag', 'freie_zeit'], auchFuer: [], agentId: 'crm', stufe: 'ausgewogen',
  aktiv: true, quelle: 'vorlage',
  gedaechtnis: [{ id: 'ms-1', text: 'Anrufe nie vor 9 Uhr vorschlagen.', am: T(6, 0), von: ICH, quelle: 'hand' }],
};
const MITARBEITER_EIGEN: Mitarbeiter = {
  id: 'ma-00000000-0000-4000-8000-000000000006', headId: 'sales', name: 'Empfehlungen', rolle: 'Bittet zufriedene Kunden um Empfehlungen — als Entwurf.',
  anleitung: 'Nach einem erfolgreichen Projektabschluss einen kurzen Entwurf für eine Empfehlungsbitte schreiben.',
  werkzeuge: ['mandate_lage', 'kontakt_akte', 'crm_vorschlag'], auchFuer: ['kundenerfolg'], stufe: 'schnell', aktiv: true, gedaechtnis: [],
  quelle: 'hand', angelegtVon: ICH,
};

export const SKILLS = {
  ok: true, skills: [EINGEBAUT_POWER_HOUR, skillKurz(SKILL)], mitarbeiter: [MITARBEITER_NACHFASSEN, MITARBEITER_EIGEN],
  gedaechtnis: [{ id: 'ms-2', text: 'Deals unter Mindestwert nur in der Wochenrunde ansprechen.', am: T(6, 0), von: 'head:sales', quelle: 'vorschlag', freigegebenVon: ICH }],
} satisfies SkillsAntwort;
export const SKILL_ANTWORT = { ok: true, skill: SKILL, stand: 'stand-beispiel-3' } satisfies SkillAntwort;

// ── Heads und Überblick ─────────────────────────────────────────────────────────────────────────────────────────────────

function karte(id: string, rest: Partial<HeadKarte> = {}): HeadKarte {
  const h = headDef(id);
  if (!h) throw new Error(`Fixture: Head ${id} fehlt im Katalog`);
  return {
    id: h.id, name: h.name, kurz: h.kurz, auftrag: h.auftrag, bereich: h.bereich, ebene: h.ebene, farbe: h.farbe, ...(h.hinweis ? { hinweis: h.hinweis } : {}),
    aktiv: true, kennzahlen: [],
    mitarbeiter: h.mitarbeiter.map(m => ({ id: m.id, name: m.name, rolle: m.rolle, aktiv: true, auchFuer: [...(m.auchFuer ?? [])] })),
    skills: [], zaehler: { freigaben: 0, laufend: 0, faeden: 0 }, letzteFaeden: [],
    ...rest,
  };
}

export const HEADS: HeadKarte[] = [
  karte('sales', {
    kennzahlen: [{ id: 'gespraeche', label: 'Echte Gespräche · 7 Tage', wert: '6', ampel: 'gelb' }, { id: 'win_rate', label: 'Win Rate · 180 Tage', wert: '28 %', ampel: 'gruen' }, { id: 'ueberfaellig', label: 'Überfällige Follow-ups', wert: '3', ampel: 'gelb' }],
    skills: SKILLS.skills, zaehler: { freigaben: 2, laufend: 0, faeden: 2 }, letzteFaeden: [kurz(FADEN_HEAD), kurz(FADEN_MITARBEITER)],
  }),
  karte('marketing', { zaehler: { freigaben: 0, laufend: 1, faeden: 1 } }),
  karte('finanzen', { kennzahlen: [{ id: 'liquiditaet', label: 'Liquidität', wert: '4,2 Monate', ampel: 'gruen' }, { id: 'runway', label: 'Runway', wert: null, ampel: 'grau' }] }),
  karte('it', { gesperrt: { grund: 'business-frei', text: 'Business-frei bis 18:00 — Hintergrundläufe ruhen.' } }),
  karte('gesundheit', { aktiv: false, gesperrt: { grund: 'einwilligung', text: 'Erscheint mit der Einwilligung „An die KI geben“ (System › Datenschutz).' } }),
  karte('familie'),
  karte('assistenz', { zaehler: { freigaben: 0, laufend: 0, faeden: 0 } }),
];

export const AGENTEN = {
  ok: true,
  zoe: { letzteFaeden: [FADEN_ZOE_KURZ] },
  heads: HEADS,
  ueberblick: {
    briefing: 'Ruhiger Tag: zwei Entwürfe warten auf Freigabe, die Monatsabschluss-Frist läuft Freitag ab.',
    seit: T(18, 0).replace('10-08', '10-07'),
    passiert: [
      { id: 'p1', text: 'Head of Sales hat zwei Entwürfe zur Freigabe vorgelegt.', zeit: T(7, 41), headId: 'sales', link: WEG.freigaben() },
      { id: 'p2', text: 'Board-Bericht der Woche ist fertig.', zeit: T(6, 30), headId: 'strategie' },
    ],
    inArbeit: [{ id: 'w1', text: 'Kampagnen: Herbst-Kampagne wird geplant.', headId: 'marketing' }],
    freigaben: { anzahl: 2, link: WEG.freigaben() },
    ziele: [{ id: 'z-beispiel', titel: 'Jahresziel Umsatz', fortschritt: 62, link: WEG.ziel('z-beispiel') }],
  },
  notAus: false,
  ki: KI,
} satisfies AgentenAntwort;

// ── Hintergrund und Als Nächstes ────────────────────────────────────────────────────────────────────────────────────────

export const LAEUFE = {
  ok: true,
  laeufe: [
    { id: 'l1', quelle: 'faden', art: 'einmalig', titel: 'Kampagnen: Herbst-Kampagne', headId: 'marketing', mitarbeiterId: 'marketing-kampagnen', status: 'laeuft', start: T(7, 50),
      schritte: { gesamt: 4, fertig: 1, aktuell: 'Segment prüfen' }, kosten: { cent: 2, grenzeCent: 50 }, link: WEG.agenten({ f: 'fd-beispiel-l1' }), fadenId: 'fd-beispiel-l1', aktionen: ['abbrechen'] },
    { id: 'l2', quelle: 'faden', art: 'einmalig', titel: 'Nachfassen Kunde A', headId: 'sales', mitarbeiterId: 'sales-nachfassen', status: 'fertig', start: T(7, 33), ende: T(7, 40), dauerMs: 420_000,
      schritte: { gesamt: 3, fertig: 3 }, kosten: { cent: 4, grenzeCent: 50 }, link: WEG.agenten({ f: FADEN_MITARBEITER_ID }), fadenId: FADEN_MITARBEITER_ID, aktionen: ['neu-starten'] },
    { id: 'l3', quelle: 'skill', art: 'wiederkehrend', titel: 'angebot-nachfassen', headId: 'sales', status: 'fehler', start: T(6, 0), ende: T(6, 1), dauerMs: 60_000,
      link: WEG.agenten({ h: 'sales' }), aktionen: ['neu-starten'] },
    { id: 'l4', quelle: 'takt', art: 'wiederkehrend', titel: 'Morgenlauf', status: 'fertig', start: T(5, 0), ende: T(5, 2), dauerMs: 120_000, link: WEG.freigaben(), aktionen: [] },
  ],
  naechstes: [
    { id: 'n1', art: 'freigabe', titel: 'Freigaben offen', wann: T(8, 0), link: WEG.freigaben(), wichtig: true, dringend: true, quadrant: 'q1', kritisch: true, anzahl: 2 },
    { id: 'n2', art: 'frist', titel: 'Monatsabschluss eintragen', wann: '2026-10-10', headId: 'finanzen', link: '/os/finanzen?space=business', wichtig: true, dringend: false, quadrant: 'q2' },
    { id: 'n3', art: 'zeitplan', titel: 'Power Hour vorbereiten', wann: '2026-10-09T05:00:00.000Z', headId: 'sales', link: WEG.agenten({ h: 'sales' }), wichtig: false, dringend: true, quadrant: 'q3' },
    { id: 'n4', art: 'skill', titel: 'angebot-nachfassen', wann: '2026-10-09T06:00:00.000Z', headId: 'sales', link: WEG.agenten({ h: 'sales' }), wichtig: false, dringend: false, quadrant: 'q4' },
  ],
  plan: [{
    id: 'hg-00000000-0000-4000-8000-000000000007', besitzer: ICH, agent: { art: 'head', headId: 'strategie' }, titel: 'Wochenbericht',
    auftrag: 'Fasse jeden Freitag die Woche zusammen: Ziele, Zahlen, offene Risiken — drei Absätze.', zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '15:00', tage: [5] },
    kostenGrenzeCent: 30, aktiv: true, erstellt: T(6, 0),
  }],
} satisfies LaeufeAntwort;

// ── Medien (Paket 5, Entwurf) ───────────────────────────────────────────────────────────────────────────────────────────

export const MEDIEN = {
  ok: true,
  medien: [{
    id: 'md-00000000-0000-4000-8000-000000000008', art: 'bild', bereich: 'business', von: ICH, aufgenommen: T(19, 30).replace('10-08', '10-07'), hochgeladen: T(19, 31).replace('10-08', '10-07'),
    typ: 'image/jpeg', groesse: 245_760, bezug: { art: 'event', id: 'ev-beispiel' }, freigabe: { marketing: false }, anHeads: ['marketing'],
  }],
} satisfies MedienAntwort;
