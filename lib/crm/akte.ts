// ─── Markttraktion · Kontaktakte (rein, getestet) ────────────────────────────
// Kevin 25.09.: „… dass wir wirklich auf die ganze Matrix kommen … die ganzen
// Daten zu dem einzelnen Kontakt komplett auf einem Bild.“ Die Akte zeigt eine
// Person mit allem, was MAKE OS über sie weiß: jedes Feld der Masterdatei (die
// Matrix), den ganzen Verlauf und jede Verbindung — Lead, Deals, Mandate,
// Events, Kampagnen, Beiträge, Power Hour, Betroffenenanträge, Kollegen.
// Hier stehen nur die Regeln (welche Felder in welcher Gruppe, wie vollständig
// die Akte ist, was womit verbunden ist); die Oberfläche ist
// components/os/crm/Akte.tsx. Die private Notiz gehört nicht in die Matrix —
// sie bleibt bei der Person, die sie schrieb.

import { KREIS_TAKT, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Chance, Mandat, Event, Teilnahme, TeilnahmeStatus, Kampagne, KampagnenErgebnis, Beitrag, Antrag } from './typen';

export interface MatrixFeld<K extends string = string> {
  feld: K; label: string;
  /** Fließtext: mehrzeilig anzeigen und bearbeiten. */
  lang?: boolean;
  /** Adresse, die sich öffnen lässt (Profil, Webseite) — Telefon und Mail nie: die laufen über die Kanal-Ampel. */
  link?: boolean;
}

export const PERSON_FELDER: MatrixFeld<keyof Kontakt>[] = [
  { feld: 'vorname', label: 'Vorname' }, { feld: 'nachname', label: 'Nachname' }, { feld: 'position', label: 'Position' }, { feld: 'jobtitel', label: 'Jobtitel' },
  { feld: 'senioritaet', label: 'Seniorität' }, { feld: 'email', label: 'E-Mail' }, { feld: 'telefon', label: 'Telefon' }, { feld: 'sms', label: 'Mobil / SMS' },
  { feld: 'linkedin', label: 'LinkedIn', link: true }, { feld: 'personInfo', label: 'Über die Person', lang: true },
];
/** Gehört die Person zu einer Firma, kommen die Firmenfelder aus deren Eintrag (Stammdaten an EINER Stelle, lib/crm/firmen.ts). */
export const FIRMA_FELDER: MatrixFeld<keyof Firma>[] = [
  { feld: 'branche', label: 'Branche' }, { feld: 'stadt', label: 'Stadt' }, { feld: 'mitarbeiter', label: 'Mitarbeiter' }, { feld: 'umsatz', label: 'Umsatz' },
  { feld: 'gegruendet', label: 'Gegründet' }, { feld: 'rechtsform', label: 'Rechtsform' }, { feld: 'webseite', label: 'Webseite', link: true }, { feld: 'domain', label: 'Domain' },
  { feld: 'linkedin', label: 'LinkedIn', link: true }, { feld: 'telefon', label: 'Telefon (Zentrale)' }, { feld: 'email', label: 'E-Mail (allgemein)' }, { feld: 'notiz', label: 'Notiz zur Firma', lang: true },
];
/** Ohne Firmeneintrag: die Firmenfelder, wie die Masterdatei sie an der Person mitbringt. */
export const FIRMA_FELDER_IMPORT: MatrixFeld<keyof Kontakt>[] = [
  { feld: 'firmaBranche', label: 'Branche' }, { feld: 'firmaStadt', label: 'Stadt' }, { feld: 'firmaMitarbeiter', label: 'Mitarbeiter' }, { feld: 'firmaUmsatz', label: 'Umsatz' },
  { feld: 'firmaGegruendet', label: 'Gegründet' }, { feld: 'firmaWebseite', label: 'Webseite', link: true }, { feld: 'firmaDomain', label: 'Domain' },
  { feld: 'firmaLinkedin', label: 'LinkedIn', link: true }, { feld: 'firmaTelefon', label: 'Telefon (Zentrale)' }, { feld: 'firmaEmail', label: 'E-Mail (allgemein)' },
];
/** Einordnung aus der Anreicherung. Prio und Eignung sind Auswahlfelder und stehen in der Oberfläche als Pillen davor. */
export const EINORDNUNG_FELDER: MatrixFeld<keyof Kontakt>[] = [
  { feld: 'typ', label: 'Typ' }, { feld: 'kategorie', label: 'Kategorie' }, { feld: 'aufhaenger', label: 'Aufhänger', lang: true }, { feld: 'signale', label: 'Signale', lang: true },
  { feld: 'marktinfo', label: 'Marktinfo', lang: true }, { feld: 'kiBezug', label: 'KI-Bezug', lang: true }, { feld: 'steckbrief', label: 'Steckbrief', lang: true },
  { feld: 'vorgestelltDurch', label: 'Vorgestellt durch' }, { feld: 'notiz', label: 'Notiz', lang: true },
];
/** Woher die Daten stammen — technisch, zählt nicht zur Vollständigkeit. */
export const HERKUNFT_FELDER: MatrixFeld<keyof Kontakt>[] = [
  { feld: 'quelle', label: 'Quelle' }, { feld: 'recherche', label: 'Recherche-Stand' }, { feld: 'owner', label: 'Owner (Import)' }, { feld: 'lifecycle', label: 'Lifecycle (Import)' }, { feld: 'hubspotId', label: 'HubSpot-ID' },
];

export const gefuellt = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : typeof v === 'number' ? Number.isFinite(v) : v !== undefined && v !== null);

export interface Vollstaendigkeit { gefuellt: number; gesamt: number; anteil: number; gruppen: { person: [number, number]; firma: [number, number]; einordnung: [number, number] } }

/** Wie voll ist die Akte? Person, Firma (aus dem Firmeneintrag, sonst aus dem Import) und Einordnung samt Prio und Eignung. */
export function vollstaendigkeit(k: Kontakt, firma?: Firma): Vollstaendigkeit {
  const zaehle = <T,>(felder: MatrixFeld<string>[], quelle: T): [number, number] => [felder.filter(f => gefuellt((quelle as Record<string, unknown>)[f.feld])).length, felder.length];
  const person = zaehle(PERSON_FELDER, k);
  const fz = firma ? zaehle(FIRMA_FELDER, firma) : zaehle(FIRMA_FELDER_IMPORT, k);
  // Firmenname zählt mit: ohne Firma bleibt die Gruppe leer.
  const fname = firma || gefuellt(k.firma) ? 1 : 0;
  const firmaGruppe: [number, number] = [fz[0] + fname, fz[1] + 1];
  const e = zaehle(EINORDNUNG_FELDER, k);
  const einordnung: [number, number] = [e[0] + (k.prio ? 1 : 0) + (k.eignung ? 1 : 0), e[1] + 2];
  const g = person[0] + firmaGruppe[0] + einordnung[0];
  const n = person[1] + firmaGruppe[1] + einordnung[1];
  return { gefuellt: g, gesamt: n, anteil: n ? g / n : 0, gruppen: { person, firma: firmaGruppe, einordnung } };
}

const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 864e5);
const plus = (d: string, n: number) => { const x = new Date(`${d.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Beziehungstakt: nur mit Kreis oder eigenem Takt. Ohne vermerkten Kontakt ist die Person sofort dran (wie in der Pflege-Liste, lib/crm/heute.ts). */
export function takt(k: Kontakt, heute: string): { tage: number; seit: number | null; faelligAm: string; ueberfaellig: boolean } | null {
  if (!k.kreis && !k.taktTage) return null;
  const t = k.taktTage ?? KREIS_TAKT[k.kreis ?? 'B'];
  const seit = k.letzterKontakt ? tage(k.letzterKontakt, heute) : null;
  const faelligAm = k.letzterKontakt ? plus(k.letzterKontakt, t) : heute;
  return { tage: t, seit, faelligAm, ueberfaellig: seit === null || seit >= t };
}

/** Was im Verlauf steht: Einträge, echte Gespräche (Gespräch, Termin oder Ergebnis „Gespräch/Termin“), der jüngste Eintrag. */
export function verlaufZahlen(k: Kontakt): { eintraege: number; gespraeche: number; zuletzt?: string } {
  const l = k.aktivitaeten ?? [];
  const gespraeche = l.filter(a => a.art === 'gespraech' || a.art === 'termin' || a.ergebnis === 'gespraech' || a.ergebnis === 'termin').length;
  const zuletzt = l.filter(a => a.art !== 'system').map(a => a.am).sort().pop();
  return { eintraege: l.length, gespraeche, ...(zuletzt ? { zuletzt } : {}) };
}

export const TEILNAHME_LABEL: Record<TeilnahmeStatus, string> = { vorgemerkt: 'vorgemerkt', eingeladen: 'eingeladen', zugesagt: 'zugesagt', abgesagt: 'abgesagt', da: 'war da', no_show: 'nicht gekommen' };
export const KAMPAGNEN_ERGEBNIS_LABEL: Record<KampagnenErgebnis, string> = { angesprochen: 'angesprochen', reagiert: 'reagiert', gespraech: 'Gespräch', chance: 'Interesse → Lead', kein_interesse: 'kein Interesse' };
const WIRKUNG_LABEL: Record<Beitrag['wirkung'][number]['art'], string> = { reaktion: 'Reaktion', gespraech: 'Gespräch', anfrage: 'Anfrage' };

export interface AkteVerbindungen {
  /** Deals mit dieser Person — `ueberFirma`: ein Deal der Firma, an dem sie (noch) nicht hängt. */
  deals: (Chance & { ueberFirma?: boolean })[];
  mandate: Mandat[];
  events: { event: Event; teilnahme: Teilnahme }[];
  kampagnen: { kampagne: Kampagne; ergebnis?: KampagnenErgebnis; am?: string }[];
  beitraege: { beitrag: Beitrag; art: string; am: string }[];
  powerHour: { datum: string; person: string; ergebnis?: string; notiz?: string }[];
  antraege: Antrag[];
  kollegen: Kontakt[];
}

/** Alles, was mit der Person verbunden ist — jüngstes zuerst. */
export function verbindungen(k: Kontakt, kontakte: Kontakt[], stand: CrmBestand): AkteVerbindungen {
  const firma = k.firmaId ? stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const direkt = stand.chancen.filter(c => c.kontaktIds.includes(k.id));
  const ueberFirma = firma ? stand.chancen.filter(c => !c.kontaktIds.includes(k.id) && c.firma === firma.name).map(c => ({ ...c, ueberFirma: true })) : [];
  const neu = (a?: string, b?: string) => (b ?? '').localeCompare(a ?? '');
  const eventNach = new Map(stand.events.map(e => [e.id, e]));
  const rang = (x: Kontakt) => (x.lebensphase === 'kunde' ? 0 : x.kreis === 'A' ? 1 : x.kreis === 'B' ? 2 : x.prio === 'A' ? 3 : 4);
  return {
    deals: [...direkt, ...ueberFirma].sort((a, b) => neu(a.geaendert ?? a.angelegt, b.geaendert ?? b.angelegt)),
    mandate: stand.mandate.filter(m => m.kontaktIds.includes(k.id)),
    events: stand.teilnahmen.filter(t => t.kontaktId === k.id && eventNach.has(t.eventId)).map(t => ({ event: eventNach.get(t.eventId)!, teilnahme: t })).sort((a, b) => neu(a.event.datum, b.event.datum)),
    kampagnen: stand.kampagnen.filter(kp => kp.kontaktIds.includes(k.id) || kp.ergebnisse.some(e => e.kontaktId === k.id)).map(kp => {
      const e = kp.ergebnisse.filter(x => x.kontaktId === k.id).sort((a, b) => neu(a.am, b.am))[0];
      return { kampagne: kp, ...(e ? { ergebnis: e.ergebnis, am: e.am } : {}) };
    }).sort((a, b) => neu(a.am ?? a.kampagne.start, b.am ?? b.kampagne.start)),
    beitraege: stand.beitraege.flatMap(b => b.wirkung.filter(w => w.kontaktId === k.id).map(w => ({ beitrag: b, art: WIRKUNG_LABEL[w.art] ?? w.art, am: w.am }))).sort((a, b) => neu(a.am, b.am)),
    powerHour: stand.sitzungen.flatMap(s => s.karten.filter(c => c.kontaktId === k.id).map(c => ({ datum: s.datum, person: s.person, ...(c.ergebnis ? { ergebnis: c.ergebnis } : {}), ...(c.notiz ? { notiz: c.notiz } : {}) }))).sort((a, b) => neu(a.datum, b.datum)),
    antraege: stand.antraege.filter(a => a.kontaktId === k.id).sort((a, b) => neu(a.eingang, b.eingang)),
    kollegen: k.firmaId ? kontakte.filter(x => x.firmaId === k.firmaId && x.id !== k.id).sort((a, b) => rang(a) - rang(b) || `${a.nachname}${a.vorname}`.localeCompare(`${b.nachname}${b.vorname}`)) : [],
  };
}
