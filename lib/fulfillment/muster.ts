// ─── Fulfillment — neutrale Muster im Code (C0, 10.10.; FULFILLMENT_KONZEPT.md 2.2–2.5, 2.7 links, 3.2, 5.1) ─────────────────────────
// Vorbild lib/aufgaben/vorlagen-start.ts: Muster stehen NUR im Code, werden nie gespeichert und erst bei „Aus Muster anlegen“ (C1) mit NEUEN
// Kennungen in den Bestand kopiert (Muster-Kennungen `fp-muster-*`, `fk-muster-*`, `fb-muster-*`, `fr-muster-*`).
// Nur Gerüst: neutrale Titel, Zonen, Kreislauf-Stufen, Orte, Freigabe-Punkte, Rollen, Rhythmen. KEINE Inhalte (Texte, Skripte, Agenden,
// Fragen-Kataloge, Preise, Namen) — die sind Instanz-Daten (Import, Editor, Demo-Saat). Wächter: tests/fulfillment-fundament.test.ts
// (keine Eurobeträge, keine Namen). Rein und client-sicher.
//
// Ebenen: je Vorlage genau EIN Wurzelknoten (Ebene 1 = Gesamtprozess), darunter Ebene 2 (Zone/Phase), Ebene 3 (Teilprozess).
// Die Paket-Muster gehen nur bis Ebene 3 — Einzelschritte (4) und Bausteine (5) kommen aus Bibliothek/Import.

import type { ProzessVorlage, ProzessKnoten, Freigabepunkt, Rolle, RitualVorlage, Baustein, Frage, Zone, Zustaendig } from './typen';
import type { KreislaufId } from '@/lib/crm/planung';
import type { OrtId } from './orte';

type K = Omit<ProzessKnoten, 'rang'> & { ort?: OrtId };
/** Knoten der Reihe nach — `rang` lückenlos je Eltern (1, 2, 3 …). */
function reihe(knoten: K[]): ProzessKnoten[] {
  const zaehler = new Map<string, number>();
  return knoten.map(k => {
    const schluessel = k.elternId ?? '';
    const rang = (zaehler.get(schluessel) ?? 0) + 1;
    zaehler.set(schluessel, rang);
    return { ...k, rang };
  });
}
const vorlage = (v: Omit<ProzessVorlage, 'uebergaenge' | 'freigaben' | 'rollen' | 'fassung' | 'herkunft' | 'geaendert' | 'geaendertVon'> & Partial<Pick<ProzessVorlage, 'freigaben' | 'rollen'>>): ProzessVorlage => ({
  uebergaenge: [], freigaben: [], rollen: [], ...v, fassung: 1, herkunft: { art: 'muster', am: '' }, geaendert: '', geaendertVon: '',
});

// ── Landkarte „Hochhaus“ (2.2) ────────────────────────────────────────────────────────────────────────────────────────────────────────

const LK = 'fk-muster-lk';
const z = (id: string, titel: string, zone: Zone, ort: OrtId, kreislauf?: KreislaufId[]): K => ({ id: `${LK}-${id}`, elternId: `${LK}-wurzel`, titel, zone, ort, ...(kreislauf ? { kreislauf } : {}) });
export const MUSTER_LANDKARTE: ProzessVorlage = vorlage({
  id: 'fp-muster-landkarte', art: 'landkarte', titel: 'Unser Unternehmen',
  knoten: reihe([
    { id: `${LK}-wurzel`, titel: 'Unser Unternehmen' },
    // Dach — Steuerung
    z('ziele', 'Ziele & Planung', 'dach', 'planung.business'),
    z('positionierung', 'Positionierung', 'dach', 'produkte.positionierung'),
    z('rhythmus', 'Führungsrhythmus', 'dach', 'fokus.business'),
    z('kennzahlen', 'Kennzahlen', 'dach', 'business.index'),
    // Etagen 1–6 — Kernprozesse entlang des Kreislaufs (Etage 1 unten)
    z('marketing', 'Marketing & Sichtbarkeit', 'etage', 'markttraktion.marketing', ['kanaele']),
    z('leads', 'Leads & Qualifizierung', 'etage', 'markttraktion.qualifizierung', ['leads']),
    z('sales', 'Sales & Abschluss', 'etage', 'markttraktion.deals', ['deals', 'followup']),
    z('onboarding', 'Onboarding', 'etage', 'fulfillment.onboarding', ['fulfillment']),
    z('fulfillment', 'Fulfillment', 'etage', 'fulfillment.prozesse', ['fulfillment']),
    z('nachher', 'Follow-up, Upsell, Empfehlung', 'etage', 'markttraktion.planung', ['nachher', 'wiederkauf']),
    // Fundament — Unterstützung
    z('crm', 'CRM', 'fundament', 'markttraktion.kontakte'),
    z('team', 'Recruiting & Führung', 'fundament', 'einstellungen.team'),
    z('recht', 'Recht & Datenschutz', 'fundament', 'datenschutz'),
    z('agenten', 'KI-Agenten', 'fundament', 'agenten'),
    z('finanzen', 'Finanzen', 'fundament', 'finanzen.business'),
    // Etage 5: Kinder sind Verweise auf die Paket-Vorlagen (beim Anlegen auf die neuen Kennungen umgeschrieben, C1)
    { id: `${LK}-p1`, elternId: `${LK}-fulfillment`, titel: 'Vertriebsleitung auf Zeit', verweis: 'fp-muster-p1' },
    { id: `${LK}-p2`, elternId: `${LK}-fulfillment`, titel: 'Sales-Systematik', verweis: 'fp-muster-p2' },
    { id: `${LK}-p3`, elternId: `${LK}-fulfillment`, titel: 'Netzwerk-Vertrieb', verweis: 'fp-muster-p3' },
  ]),
});

// ── P1 Vertriebsleitung auf Zeit — Transformationsprozess (2.4), bis Ebene 3 ─────────────────────────────────────────────────────────

const F = (id: string, titel: string, wer: Zustaendig): Freigabepunkt => ({ id, titel, wer });
/** Freigabe-Gerüst F0–F7 (2.4) — Titel neutral; F1/F2 sind zusätzlich harte Regeln der Analyse (4.4, C3). */
export const MUSTER_FREIGABEN: Freigabepunkt[] = [
  F('F0', 'Mandatsrahmen & Zugänge', 'beide'),
  F('F1', 'Analyse-Umfang & Personenliste', 'beide'),
  F('F2', 'Dossier geprüft', 'intern'),
  F('F3', 'Diagnose-Abnahme', 'beide'),
  F('F4', 'Playbook & Rechtsprüfung der Ansprache-Texte', 'beide'),
  F('F5', 'Profil & Vergütungsmodell', 'kunde'),
  F('F6', 'Go-live Ansprache & Preisfreigaben', 'beide'),
  F('F7', 'Übergabe-Freigabe', 'beide'),
];
const P1 = 'fk-muster-p1';
const phase = (id: string, titel: string, freigabe?: string, kreislauf: KreislaufId[] = ['fulfillment'], warum?: string): K => ({ id: `${P1}-${id}`, elternId: `${P1}-wurzel`, titel, kreislauf, kundeSichtbar: true, ...(freigabe ? { freigabe } : {}), ...(warum ? { warum } : {}) });
const teil = (eltern: string, id: string, titel: string): K => ({ id: `${P1}-${eltern}-${id}`, elternId: `${P1}-${eltern}`, titel });
export const MUSTER_P1: ProzessVorlage = vorlage({
  id: 'fp-muster-p1', art: 'paket', titel: 'Vertriebsleitung auf Zeit',
  freigaben: MUSTER_FREIGABEN,
  knoten: reihe([
    { id: `${P1}-wurzel`, titel: 'Vertriebsleitung auf Zeit' },
    phase('vorlauf', 'Vorlauf / Onboarding', 'F0'),
    phase('analyse', 'Analyse', 'F2'),
    phase('diagnose', 'Diagnose', 'F3'),
    phase('aufbau', 'Aufbau', 'F4'),
    // 14.10. (Abnahme B20): der Zusatz „nur Prozess“ ist eine Erklärung, kein Titel — er steht im „Warum“ (früher „Recruiting (nur Prozess)“).
    phase('recruiting', 'Recruiting', 'F5', undefined, 'Nur der Prozess: Profil, Vergütungsmodell und Auswahl — eingestellt wird beim Kunden.'),
    phase('umsetzung', 'Umsetzung', 'F6'),
    phase('fuehrung', 'Führung'),
    phase('uebergabe', 'Follow-up / Übergabe', 'F7', ['nachher', 'wiederkauf']),
    teil('vorlauf', 'onboarding', 'Onboarding'),
    teil('analyse', 'umfang', 'Analyse-Umfang'),
    teil('analyse', 'dossier', 'Dossier'),
    teil('diagnose', 'bericht', 'Diagnosebericht'),
    teil('diagnose', 'quickwins', 'Quick Wins'),
    teil('aufbau', 'prozess', 'Prozess'),
    teil('aufbau', 'crm', 'CRM'),
    teil('aufbau', 'skripte', 'Skripte'),
    teil('aufbau', 'einwaende', 'Einwände'),
    teil('aufbau', 'kennzahlen', 'Kennzahlen'),
    teil('aufbau', 'zielgruppe', 'Zielgruppe & Leads'),
    teil('uebergabe', 'befaehigung', 'Befähigung „läuft ohne uns“'),
    teil('uebergabe', 'wirkung', 'Wirkungsbericht'),
  ]),
});

// ── P2 Sales-Systematik (2.5), bis Ebene 3 ────────────────────────────────────────────────────────────────────────────────────────────

const P2 = 'fk-muster-p2';
const R = (id: string, titel: string): Rolle => ({ id, titel });
export const MUSTER_P2: ProzessVorlage = vorlage({
  id: 'fp-muster-p2', art: 'paket', titel: 'Sales-Systematik',
  rollen: [R('opener', 'Opener'), R('setter', 'Setter'), R('closer', 'Closer'), R('fuehrung', 'Führung')],
  knoten: reihe([
    { id: `${P2}-wurzel`, titel: 'Sales-Systematik' },
    { id: `${P2}-einfuehrung`, elternId: `${P2}-wurzel`, titel: 'Einführung', kundeSichtbar: true },
    { id: `${P2}-skripte`, elternId: `${P2}-wurzel`, titel: 'Skripte & Workbooks', kundeSichtbar: true },
    { id: `${P2}-kennzahlen`, elternId: `${P2}-wurzel`, titel: 'Kennzahlen-Board', kundeSichtbar: true },
    { id: `${P2}-crm`, elternId: `${P2}-wurzel`, titel: 'CRM-Workflow', kundeSichtbar: true },
    { id: `${P2}-training`, elternId: `${P2}-wurzel`, titel: 'Training & Abnahme', kundeSichtbar: true },
    { id: `${P2}-uebergabe`, elternId: `${P2}-wurzel`, titel: 'Übergabe', kundeSichtbar: true },
    { id: `${P2}-einfuehrung-status`, elternId: `${P2}-einfuehrung`, titel: 'Statusmodell' },
    { id: `${P2}-einfuehrung-rollen`, elternId: `${P2}-einfuehrung`, titel: 'Rollen' },
    { id: `${P2}-einfuehrung-pipeline`, elternId: `${P2}-einfuehrung`, titel: 'Pipeline' },
  ]),
});

// ── P3 Netzwerk-Vertrieb (2.5), bis Ebene 3 ───────────────────────────────────────────────────────────────────────────────────────────

const P3 = 'fk-muster-p3';
export const MUSTER_P3: ProzessVorlage = vorlage({
  id: 'fp-muster-p3', art: 'paket', titel: 'Netzwerk-Vertrieb',
  knoten: reihe([
    { id: `${P3}-wurzel`, titel: 'Netzwerk-Vertrieb' },
    { id: `${P3}-partner`, elternId: `${P3}-wurzel`, titel: 'Partner- und Empfehlungsprogramm', kundeSichtbar: true },
    { id: `${P3}-messen`, elternId: `${P3}-wurzel`, titel: 'Messen & Events', kundeSichtbar: true, ort: 'markttraktion.events' },
    { id: `${P3}-rhythmus`, elternId: `${P3}-wurzel`, titel: 'Netzwerk-Rhythmus', kundeSichtbar: true, ort: 'netzwerken' },
    { id: `${P3}-messung`, elternId: `${P3}-wurzel`, titel: 'Messung', kundeSichtbar: true },
    { id: `${P3}-messen-vor`, elternId: `${P3}-messen`, titel: 'Vor der Messe' },
    { id: `${P3}-messen-waehrend`, elternId: `${P3}-messen`, titel: 'Während der Messe', ort: 'netzwerken' },
    { id: `${P3}-messen-nach`, elternId: `${P3}-messen`, titel: 'Nach der Messe' },
  ]),
});

export const MUSTER_PAKETE: readonly ProzessVorlage[] = [MUSTER_P1, MUSTER_P2, MUSTER_P3];
/** Alle Muster-Vorlagen (Landkarte zuerst). */
export const MUSTER_VORLAGEN: readonly ProzessVorlage[] = [MUSTER_LANDKARTE, ...MUSTER_PAKETE];

// ── Onboarding-Checkliste (3.2) — Einzelschritte (Ebene 4) unter dem Teilprozess „Onboarding“ ──────────────────────────────────────────

/** Woraus der Status eines Schritts abgeleitet wird (C1). */
export type OnboardingSchluessel = 'willkommen' | 'kickoff' | 'vereinbarung' | 'playbook' | 'stakeholder' | 'wertkonto' | 'entscheidungslog' | 'f0';
export interface OnboardingSchritt { schluessel: OnboardingSchluessel; id: string; titel: string; zustaendig: Zustaendig; freigabe?: string; zaehltFuerFertig: boolean }
const ob = (schluessel: OnboardingSchluessel, titel: string, zustaendig: Zustaendig, zaehltFuerFertig = true, freigabe?: string): OnboardingSchritt =>
  ({ schluessel, id: `fk-muster-ob-${schluessel}`, titel, zustaendig, zaehltFuerFertig, ...(freigabe ? { freigabe } : {}) });
/** Das Onboarding ist fertig, wenn alle Schritte mit `zaehltFuerFertig` erfüllt sind — das Playbook (4) darf noch laufen. */
export const MUSTER_ONBOARDING: readonly OnboardingSchritt[] = [
  ob('willkommen', 'Willkommen in 24 Stunden', 'intern'),
  ob('kickoff', 'Kick-off terminieren', 'intern'),
  ob('vereinbarung', 'Zusammenarbeits-Vereinbarung', 'beide'),
  ob('playbook', 'Kunden-Playbook', 'kunde', false),
  ob('stakeholder', 'Stakeholder-Karte', 'intern'),
  ob('wertkonto', 'Wert-Konto festlegen', 'beide'),
  ob('entscheidungslog', 'Entscheidungs-Log eröffnet', 'intern'),
  ob('f0', 'F0 bestätigt', 'beide', true, 'F0'),
];

// ── Rituale-Gerüst (5.1) — Agenden sind Instanz-Daten; nur das Huddle trägt die neutrale Zahlenrunde ─────────────────────────────

const rit = (id: string, titel: string, rhythmus: RitualVorlage['rhythmus'], dauerMin: number, teilnehmende: RitualVorlage['teilnehmende']): RitualVorlage =>
  ({ id: `fr-muster-${id}`, titel, rhythmus, dauerMin, agenda: [], teilnehmende, geaendert: '', geaendertVon: '' });
export const MUSTER_RITUALE: readonly RitualVorlage[] = [
  rit('kickoff', 'Kick-off', 'einmal', 90, ['intern', 'entscheider', 'tagesverantwortlich']),
  // Entscheidung 10.10., 23:30: tägliches Vertriebs-Huddle, kurz, MIT Zahlenrunde (ersetzt das frühere Huddle ohne Zahlen) — Methode, keine Instanz-Inhalte.
  { ...rit('huddle', 'Vertriebs-Huddle mit Zahlenrunde', 'werktags', 15, ['tagesverantwortlich', 'team']), agenda: ['Zahlen von gestern', 'Ziel für heute', 'Wo hängt es?'] },
  rit('wochencheck', 'Wochen-Check', 'woche', 15, ['intern', 'tagesverantwortlich']),
  rit('steering', 'Steuerungskreis', 'monat', 60, ['intern', 'entscheider']),
  rit('quartal', 'Quartals-Review', 'quartal', 120, ['intern', 'entscheider', 'team']),
];

// ── Playbook-Formular-Gerüst (2.7: neun Abschnitte, je eine offene Frage) ────────────────────────────────────────────────────────────

const frage = (n: number, abschnitt: string, f: string): Frage => ({ id: `pb-${n}`, abschnitt, frage: f, art: 'langtext' });
export const MUSTER_PLAYBOOK: Baustein = {
  id: 'fb-muster-playbook', art: 'formular', titel: 'Kunden-Playbook',
  gliederung: [], platzhalter: [], tags: ['muster'], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true,
  fragen: [
    frage(1, 'Unternehmen & Ziele', 'Was macht euer Unternehmen, und was soll sich in den nächsten zwölf Monaten im Vertrieb ändern?'),
    frage(2, 'Angebot & Preise', 'Was verkauft ihr, und wie ist es heute bepreist?'),
    frage(3, 'Zielkunden & Wettbewerb', 'Wer sind eure besten Kunden, und gegen wen tretet ihr meistens an?'),
    frage(4, 'Vertriebsprozess heute', 'Wie wird aus einer ersten Anfrage heute ein Auftrag — Schritt für Schritt?'),
    frage(5, 'Team & Rollen', 'Wer verkauft heute, mit welchen Aufgaben und wie viel Zeit dafür?'),
    frage(6, 'Tools & Daten', 'Mit welchen Werkzeugen und Daten arbeitet der Vertrieb (CRM, Listen, Auswertungen)?'),
    frage(7, 'Entscheider & Gesellschafter', 'Welche Funktionen entscheiden über Vertrieb und Budget (nur Funktionen, keine Namen)?'),
    frage(8, 'Bisherige Versuche', 'Was habt ihr im Vertrieb schon ausprobiert — und was hat funktioniert, was nicht?'),
    frage(9, 'Randbedingungen', 'Welche Grenzen gelten (Recht, Marke, Kapazität), die wir kennen müssen?'),
  ],
  fassung: 1, herkunft: { art: 'muster', am: '' }, geaendert: '', geaendertVon: '',
};

// ── Befähigung „läuft ohne uns“ (5.3, Abschnitt 13 Frage 3: Vorschlag als Vorgabe, je Fall änderbar) ─────────────────────────────────

export const MUSTER_BEFAEHIGUNG: readonly string[] = [
  'Mindestens zwei Abschlüsse ohne Gründerteilnahme',
  'Pipeline-Abdeckung über vier Wochen mindestens auf Zielwert',
  'Rhythmen vier Wochen ohne uns gelaufen',
  'Pflichtfeldquote im CRM mindestens auf Zielwert',
];
