// ─── CRM — Eventplanung: Vorlagen, Gästemischung, Checkliste, Budget, Kalender (rein, getestet) ──
// Was ein Event vom Termin unterscheidet (Konzept „Head of Event“,
// docs/konzepte/crm-sales-marketing-events.md):
//   · ein spezifisches, strittiges Ziel (Parker) — „Netzwerken“ ist keins
//   · eine bewusste Mischung: mindestens 40 % Zielkunden, 20 % Kunden und
//     Multiplikatoren (sozialer Beweis)
//   · sechs Wochen Vorlauf mit festen Etappen, Nachfassen binnen 48 Stunden,
//     Wirkung nach 30 Tagen
//   · Einladung zum eigenen Event ist Werbung (§ 7 UWG): per Mail nur mit
//     Grundlage, sonst persönlich. Teilnahme ist KEINE Einwilligung.
// Hier steht nur Rechnen — kein Speicher, kein Versand. Die Oberfläche
// (components/os/crm/events) und die Route (app/api/crm/events) nutzen es.

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event, EventFormat, Firma, SegmentKriterien, Teilnahme } from './typen';
import { kanalStatus, type KanalStatus } from './recht';
import { kontextAus, imSegment } from './segmente';

const plusTage = (datum: string, n: number) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);
const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

// ── Vorlagen ────────────────────────────────────────────────────────────────

export type VorlageId = 'stammtisch' | 'workshop' | 'dinner' | 'webinar';
type Punkt = { id: string; text: string; tageVorher: number };
export interface Vorlage {
  id: VorlageId; label: string; format: EventFormat; beschreibung: string;
  uhrzeit: string; kapazitaet: number; mixZiel: { zielkunden: number; kunden: number };
  ablauf: { zeit: string; punkt: string }[];
  checkliste: Punkt[];
  budget: { id: string; posten: string }[];
}

// Etappen, die jedes Format braucht — gleiche IDs, damit eine zweite Vorlage nichts doppelt anlegt.
const ZIEL: Punkt = { id: 'ziel', text: 'Ziel & Format festlegen — messbar, nicht „Netzwerken“', tageVorher: 42 };
const ORT: Punkt = { id: 'ort', text: 'Ort und Termin fix, Co-Host anfragen', tageVorher: 35 };
const GAESTE: Punkt = { id: 'gaeste', text: 'Gästeliste aus der Kartei — Mischung prüfen', tageVorher: 28 };
const EINLADUNG: Punkt = { id: 'einladung', text: 'Einladungen persönlich (per Mail nur mit Grundlage)', tageVorher: 21 };
const ZUSAGEN: Punkt = { id: 'zusagen', text: 'Zusagen nachhalten, Nachrücker einladen', tageVorher: 14 };
const ERINNERUNG: Punkt = { id: 'erinnerung', text: 'Erinnerung an alle Zugesagten', tageVorher: 7 };
const INTROS: Punkt = { id: 'intros', text: 'Intros für den Abend planen — wer soll wen kennenlernen', tageVorher: 3 };
const TECHNIK: Punkt = { id: 'technik', text: 'Namensschilder und Technik prüfen', tageVorher: 1 };
const NACHFASSEN: Punkt = { id: 'nachfassen', text: 'Nachfassen in 48 h — je Gast mit der Notiz vom Abend', tageVorher: -1 };
const WIRKUNG: Punkt = { id: 'wirkung', text: 'Wirkung prüfen: Folgegespräche, Chancen, Kosten je Gespräch', tageVorher: -30 };
const ZEIT = { id: 'b-zeit', posten: 'Eigene Zeit (Stunden × Satz)' };

export const VORLAGEN: Vorlage[] = [
  {
    id: 'stammtisch', label: 'Stammtisch', format: 'stammtisch', beschreibung: 'Abend mit Impuls, 10–14 Gäste, Gastgeber stellt Leute einander vor.',
    uhrzeit: '18:30', kapazitaet: 12, mixZiel: { zielkunden: 40, kunden: 20 },
    ablauf: [
      { zeit: '18:30', punkt: 'Ankommen, erstes Getränk' }, { zeit: '19:00', punkt: 'Begrüßung und kurze Vorstellungsrunde' },
      { zeit: '19:15', punkt: 'Impuls — zehn Minuten, ein Thema' }, { zeit: '19:30', punkt: 'Offener Austausch — Gastgeber stellt Leute einander vor' },
      { zeit: '21:00', punkt: 'Ausklang' },
    ],
    checkliste: [ZIEL, ORT, GAESTE, EINLADUNG, ZUSAGEN, ERINNERUNG, INTROS, TECHNIK, NACHFASSEN, WIRKUNG],
    budget: [{ id: 'b-location', posten: 'Location & Getränke' }, { id: 'b-material', posten: 'Namensschilder & Material' }, ZEIT],
  },
  {
    id: 'workshop', label: 'Workshop', format: 'workshop', beschreibung: 'Halber Tag mit Arbeit in Gruppen und greifbarem Ergebnis.',
    uhrzeit: '09:30', kapazitaet: 16, mixZiel: { zielkunden: 50, kunden: 20 },
    ablauf: [
      { zeit: '09:30', punkt: 'Ankommen, Kaffee' }, { zeit: '10:00', punkt: 'Begrüßung, Ziel des Tages' }, { zeit: '10:15', punkt: 'Impuls' },
      { zeit: '11:00', punkt: 'Arbeit in Gruppen' }, { zeit: '12:30', punkt: 'Mittagessen' }, { zeit: '13:30', punkt: 'Ergebnisse vorstellen' },
      { zeit: '14:30', punkt: 'Nächste Schritte und Rückmeldung' }, { zeit: '15:00', punkt: 'Ende' },
    ],
    checkliste: [ZIEL, ORT, GAESTE, EINLADUNG, ZUSAGEN, { id: 'unterlagen', text: 'Unterlagen und Übungen vorbereiten', tageVorher: 14 }, ERINNERUNG, INTROS,
      { id: 'druck', text: 'Material drucken, Raum und Technik prüfen', tageVorher: 2 }, TECHNIK, NACHFASSEN, WIRKUNG],
    budget: [{ id: 'b-raum', posten: 'Raum' }, { id: 'b-verpflegung', posten: 'Verpflegung' }, { id: 'b-material', posten: 'Material & Druck' }, { id: 'b-speaker', posten: 'Moderation / Speaker' }, ZEIT],
  },
  {
    id: 'dinner', label: 'Dinner', format: 'dinner', beschreibung: 'Kleiner Tisch, eine Frage für den ganzen Abend, Tischordnung mit Absicht.',
    uhrzeit: '19:00', kapazitaet: 10, mixZiel: { zielkunden: 40, kunden: 30 },
    ablauf: [
      { zeit: '19:00', punkt: 'Aperitif, Ankommen' }, { zeit: '19:30', punkt: 'Begrüßung und die Frage des Abends' }, { zeit: '19:45', punkt: 'Vorspeise' },
      { zeit: '20:30', punkt: 'Hauptgang, Gespräch am Tisch' }, { zeit: '21:30', punkt: 'Dessert, Runde „Was nehme ich mit?“' }, { zeit: '22:30', punkt: 'Ausklang' },
    ],
    checkliste: [ZIEL, ORT, GAESTE, EINLADUNG, ZUSAGEN, { id: 'menue', text: 'Menü festlegen, Unverträglichkeiten abfragen', tageVorher: 10 }, ERINNERUNG,
      { id: 'frage', text: 'Die eine Frage des Abends festlegen', tageVorher: 5 }, INTROS, { id: 'tischordnung', text: 'Tischordnung — wer sitzt neben wem', tageVorher: 2 }, TECHNIK, NACHFASSEN, WIRKUNG],
    budget: [{ id: 'b-location', posten: 'Restaurant / Location' }, { id: 'b-essen', posten: 'Essen & Getränke' }, { id: 'b-material', posten: 'Tischkarten & Deko' }, ZEIT],
  },
  {
    id: 'webinar', label: 'Webinar', format: 'webinar', beschreibung: 'Eine Stunde online: Impuls, Fragen, ein klarer nächster Schritt.',
    uhrzeit: '12:00', kapazitaet: 60, mixZiel: { zielkunden: 50, kunden: 10 },
    ablauf: [
      { zeit: '11:50', punkt: 'Technik-Check, Einlass' }, { zeit: '12:00', punkt: 'Begrüßung' }, { zeit: '12:05', punkt: 'Impuls' },
      { zeit: '12:30', punkt: 'Fragen' }, { zeit: '12:50', punkt: 'Angebot für den nächsten Schritt' }, { zeit: '13:00', punkt: 'Ende' },
    ],
    checkliste: [ZIEL, GAESTE, { id: 'plattform', text: 'Plattform und Link einrichten, Anmeldung testen', tageVorher: 28 }, EINLADUNG, ZUSAGEN, ERINNERUNG,
      { id: 'technik', text: 'Technik-Probe mit Folien und Ton', tageVorher: 1 },
      { id: 'nachfassen', text: 'Nachfassen in 48 h — Aufzeichnung nur an Einwilligende', tageVorher: -1 }, WIRKUNG],
    budget: [{ id: 'b-plattform', posten: 'Plattform / Lizenz' }, { id: 'b-technik', posten: 'Technik' }, ZEIT],
  },
];

/**
 * Vorlage auf ein Event legen — ergänzt, überschreibt nie: Checkliste und
 * Budget bekommen nur fehlende Punkte (gleiche ID oder gleicher Text zählt
 * als vorhanden), Ablauf nur, wenn noch keiner steht (zwei Abläufe ineinander
 * ergäben keinen Abend), Rahmenwerte nur, wenn sie fehlen.
 */
export function vorlageAnwenden(e: Event, vorlageId: string): Event {
  const v = VORLAGEN.find(x => x.id === vorlageId);
  if (!v) return e;
  const cl = [...(e.checkliste ?? [])];
  const clIds = new Set(cl.map(c => c.id)), clTexte = new Set(cl.map(c => norm(c.text)));
  for (const p of v.checkliste) if (!clIds.has(p.id) && !clTexte.has(norm(p.text))) cl.push({ ...p, erledigt: false });
  const bu = [...(e.budget ?? [])];
  const buIds = new Set(bu.map(b => b.id)), buPosten = new Set(bu.map(b => norm(b.posten)));
  for (const b of v.budget) if (!buIds.has(b.id) && !buPosten.has(norm(b.posten))) bu.push({ ...b, betrag: 0 });
  return {
    ...e,
    format: e.format === 'sonstig' ? v.format : e.format,
    uhrzeit: e.uhrzeit ?? v.uhrzeit,
    kapazitaet: e.kapazitaet ?? v.kapazitaet,
    mixZiel: e.mixZiel ?? { ...v.mixZiel },
    ablauf: e.ablauf?.length ? e.ablauf : v.ablauf.map(a => ({ ...a })),
    checkliste: cl,
    budget: bu,
    vorlage: e.vorlage ?? v.id,
  };
}

/** Parker: ein Ziel ist spezifisch und strittig. Liefert einen Hinweis, solange es das nicht ist. */
export function zielHinweis(ziel: string | undefined): string | null {
  const z = (ziel ?? '').trim();
  if (!z) return 'Noch kein Ziel. Messbar und strittig, z. B. „drei Folgegespräche mit Inhabern aus dem Maschinenbau binnen 30 Tagen“.';
  const zahl = /\d|\b(ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf)\b/i.test(z);
  if (/netzwerk|kennenlernen|austausch|sichtbarkeit/i.test(z) && !zahl) return '„Netzwerken“ ist kein Ziel — was soll danach passiert sein? Mit Zahl und Zielgruppe.';
  if (!zahl) return 'Messbar machen: eine Zahl hinein (z. B. drei Folgegespräche binnen 30 Tagen).';
  return null;
}

// ── Gästemischung ───────────────────────────────────────────────────────────

export type MixGruppe = 'zielkunde' | 'kunde' | 'sonstig';
/** Startwerte aus dem Konzept, nach drei Events kalibrieren. */
export const MIX_STANDARD = { zielkunden: 40, kunden: 20 } as const;

/**
 * Kunden und Multiplikatoren (sozialer Beweis) zuerst — Kunde, Multiplikator,
 * Partner als Lebensphase oder Firmenrolle. Zielkunde: Interessent, Kontakt
 * einer Zielkunden-Firma oder Priorität A/B. Der Rest ist „Sonstige“.
 */
export function mixGruppe(k: Kontakt, f?: Firma): MixGruppe {
  const phase = k.lebensphase ?? 'kontakt';
  if (phase === 'kunde' || phase === 'multiplikator' || phase === 'partner' || f?.rolle === 'kunde' || f?.rolle === 'partner') return 'kunde';
  if (phase === 'interessent' || (phase === 'kontakt' && f?.rolle === 'zielkunde') || k.prio === 'A' || k.prio === 'B') return 'zielkunde';
  return 'sonstig';
}

export interface Mix {
  /** Worauf sich die Quote bezieht: Zusagen (inkl. „da“) oder — solange keine da sind — die Gästeliste (vorgemerkt + eingeladen). */
  basis: 'zugesagt' | 'gaesteliste' | 'leer';
  n: number;
  anzahl: Record<MixGruppe, number>;
  /** Prozent, gerundet. */
  anteil: Record<MixGruppe, number>;
  ziel: { zielkunden: number; kunden: number };
  /** null bei weniger als drei Gästen — dann zählen absolute Zahlen, keine Quote. */
  ampel: 'gruen' | 'gelb' | 'rot' | null;
  /** So viele aus der Gruppe fehlen (bei sonst gleicher Liste), um das Soll zu erreichen. */
  fehlen: { zielkunden: number; kunden: number };
  hinweis: string;
}

export function mix(e: Pick<Event, 'id' | 'mixZiel'>, teilnahmen: Teilnahme[], kontakte: Kontakt[], firmen: Firma[]): Mix {
  const eigene = teilnahmen.filter(t => t.eventId === e.id);
  const zugesagt = eigene.filter(t => t.status === 'zugesagt' || t.status === 'da');
  const liste = zugesagt.length ? zugesagt : eigene.filter(t => t.status === 'vorgemerkt' || t.status === 'eingeladen');
  const basis: Mix['basis'] = zugesagt.length ? 'zugesagt' : liste.length ? 'gaesteliste' : 'leer';
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const firmaVon = new Map(firmen.map(f => [f.id, f]));
  const anzahl: Record<MixGruppe, number> = { zielkunde: 0, kunde: 0, sonstig: 0 };
  for (const t of liste) {
    const k = nachId.get(t.kontaktId);
    if (k) anzahl[mixGruppe(k, k.firmaId ? firmaVon.get(k.firmaId) : undefined)]++;
  }
  const n = anzahl.zielkunde + anzahl.kunde + anzahl.sonstig;
  const ziel = { zielkunden: e.mixZiel?.zielkunden ?? MIX_STANDARD.zielkunden, kunden: e.mixZiel?.kunden ?? MIX_STANDARD.kunden };
  const pz = (a: number) => (n ? (a / n) * 100 : 0);
  const anteil = { zielkunde: Math.round(pz(anzahl.zielkunde)), kunde: Math.round(pz(anzahl.kunde)), sonstig: Math.round(pz(anzahl.sonstig)) };
  // x zusätzliche Gäste der Gruppe, bis (a + x) / (n + x) ≥ p
  const noetig = (p: number, a: number) => { const q = Math.min(95, Math.max(0, p)); return q <= 0 ? 0 : Math.max(0, Math.ceil((q * n - 100 * a) / (100 - q) - 1e-9)); };
  const fehlen = { zielkunden: noetig(ziel.zielkunden, anzahl.zielkunde), kunden: noetig(ziel.kunden, anzahl.kunde) };
  let ampel: Mix['ampel'] = null;
  if (n >= 3) {
    const lueckeZ = ziel.zielkunden - pz(anzahl.zielkunde), lueckeK = ziel.kunden - pz(anzahl.kunde);
    ampel = lueckeZ <= 0 && lueckeK <= 0 ? 'gruen' : lueckeZ <= 10 && lueckeK <= 10 ? 'gelb' : 'rot';
  }
  const wer = basis === 'zugesagt' ? 'Zusagen' : 'Gästeliste';
  const hinweis = !n ? 'Noch keine Gäste auf der Liste.'
    : n < 3 ? `${anzahl.zielkunde} Zielkunden, ${anzahl.kunde} Kunden/Multiplikatoren — zu wenige für eine Quote.`
    : ampel === 'gruen' ? `Mischung passt (${wer}): ${anzahl.zielkunde} Zielkunden, ${anzahl.kunde} Kunden/Multiplikatoren von ${n}.`
    : `Für das Soll fehlen ${[fehlen.zielkunden ? `${fehlen.zielkunden} Zielkunden` : '', fehlen.kunden ? `${fehlen.kunden} Kunden/Multiplikatoren` : ''].filter(Boolean).join(' und ')} (${wer}).`;
  return { basis, n, anzahl, anteil, ziel, ampel, fehlen, hinweis };
}

// ── Checkliste ──────────────────────────────────────────────────────────────

export interface FaelligerPunkt {
  id: string; text: string; tageVorher: number; erledigt: boolean; aufgabeId?: string;
  /** Datum des Events minus Vorlauf (negativer Vorlauf = nach dem Event). */
  faelligAm: string;
  /** Tage von heute bis zur Fälligkeit — negativ = überfällig. */
  tage: number;
  ueberfaellig: boolean;
}

export function checklisteFaellig(e: Pick<Event, 'datum' | 'checkliste'>, heute: string): FaelligerPunkt[] {
  return (e.checkliste ?? []).map(p => {
    const faelligAm = plusTage(e.datum, -p.tageVorher);
    return { ...p, faelligAm, tage: tageZwischen(heute, faelligAm), ueberfaellig: !p.erledigt && faelligAm < heute };
  }).sort((a, b) => a.faelligAm.localeCompare(b.faelligAm) || a.text.localeCompare(b.text));
}

/** Kurzstand für Liste, Überblick und das Datenpaket des Head of Event. */
export function checklisteStand(e: Pick<Event, 'datum' | 'checkliste'>, heute: string, baldTage = 3) {
  const l = checklisteFaellig(e, heute);
  const offen = l.filter(p => !p.erledigt);
  return {
    gesamt: l.length, erledigt: l.length - offen.length, offen: offen.length,
    ueberfaellig: offen.filter(p => p.ueberfaellig).length,
    bald: offen.filter(p => !p.ueberfaellig && p.tage <= baldTage).length,
    ohneAufgabe: offen.filter(p => !p.aufgabeId).length,
    naechste: offen.slice(0, 3).map(p => ({ id: p.id, text: p.text, faelligAm: p.faelligAm, ueberfaellig: p.ueberfaellig })),
  };
}

/** Aufgaben-ID je Checklistenpunkt — gleich bei jedem Lauf, damit nichts doppelt entsteht. */
export const aufgabenId = (eventId: string, punktId: string) => `ev-${eventId}-${punktId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80);

/** Form wie im Speicher „tasks“ (vgl. app/api/heads/[head]/route.ts). Als type, damit sie in Record<string, unknown> passt. */
export type EventAufgabe = {
  id: string; title: string; description: string; status: 'todo'; priority: 'medium'; assignee: string;
  tags: string[]; subTasks: unknown[]; dependencies: unknown[]; sortOrder: number; createdAt: string; updatedAt: string; dueDate: string;
};

const vorlaufText = (t: number) => (t > 0 ? `${t} Tage vorher` : t === 0 ? 'am Tag selbst' : `${-t} Tage danach`);

/**
 * Offene Checklistenpunkte ohne Aufgabe → Aufgaben im Speicher „tasks“.
 * `vorhanden` sind die IDs, die dort schon stehen: die werden nur verknüpft,
 * nicht neu angelegt (wiederholbar). Ergebnis: neue Aufgaben + Punkt → Aufgaben-ID.
 */
export function checklisteAlsAufgaben(e: Event, vorhanden: Set<string>, person: string, jetzt: string): { neu: EventAufgabe[]; verknuepft: Record<string, string> } {
  const neu: EventAufgabe[] = [];
  const verknuepft: Record<string, string> = {};
  const schon = new Set(Array.from(vorhanden));
  for (const p of e.checkliste ?? []) {
    if (p.erledigt || p.aufgabeId) continue;
    const id = aufgabenId(e.id, p.id);
    verknuepft[p.id] = id;
    if (schon.has(id)) continue;
    schon.add(id);
    neu.push({
      id, title: `${p.text} — ${e.titel}`.slice(0, 200),
      description: `Checkliste zum Event „${e.titel}“ am ${e.datum}${e.uhrzeit ? ` um ${e.uhrzeit}` : ''}${e.ort ? ` (${e.ort})` : ''} — ${vorlaufText(p.tageVorher)}. Aus dem CRM · Events.`,
      status: 'todo', priority: 'medium', assignee: person, tags: ['crm', 'event'], subTasks: [], dependencies: [], sortOrder: 0,
      createdAt: jetzt, updatedAt: jetzt, dueDate: plusTage(e.datum, -p.tageVorher),
    });
  }
  return { neu, verknuepft };
}

// ── Budget ──────────────────────────────────────────────────────────────────

/** Summe der Kostenpositionen; solange die (noch) 0 ist, die Pauschale kostenEuro. */
export function budgetSumme(e: Pick<Event, 'budget' | 'kostenEuro'>): number {
  const s = Math.round((e.budget ?? []).reduce((a, b) => a + (Number.isFinite(b.betrag) ? b.betrag : 0), 0) * 100) / 100;
  return s > 0 ? s : e.kostenEuro ?? 0;
}

// ── Gäste-Vorschläge ────────────────────────────────────────────────────────

export interface GastVorschlag {
  kontakt: Kontakt; punkte: number; gruende: string[]; gruppe: MixGruppe;
  /** Einladungsweg: 'mail' nur bei grüner Ampel (Einwilligung oder Bestandskunde), sonst persönlich. */
  weg: 'mail' | 'persoenlich'; ampel: KanalStatus;
}

/**
 * Wen einladen? Kreis A/B, Kunden, Multiplikatoren, Priorität A zuerst — und
 * wer in der Mischung gerade fehlt, rückt vor. Nie: Gesperrte (Art. 21) und
 * wer schon auf der Liste steht. Mit Segment nur dessen Mitglieder.
 */
export function gaesteVorschlag(kontakte: Kontakt[], crm: CrmBestand, e: Event, heute: string, segment?: SegmentKriterien, n = 12): GastVorschlag[] {
  const ctx = kontextAus(crm, heute);
  const schon = new Set(crm.teilnahmen.filter(t => t.eventId === e.id).map(t => t.kontaktId));
  const warDa = new Map<string, number>(), nichtGekommen = new Map<string, number>();
  for (const t of crm.teilnahmen) {
    if (t.eventId === e.id) continue;
    if (t.status === 'da') warDa.set(t.kontaktId, (warDa.get(t.kontaktId) ?? 0) + 1);
    if (t.status === 'no_show') nichtGekommen.set(t.kontaktId, (nichtGekommen.get(t.kontaktId) ?? 0) + 1);
  }
  const m = mix(e, crm.teilnahmen, kontakte, crm.firmen);
  const raus: GastVorschlag[] = [];
  for (const k of kontakte) {
    if (k.werbesperre || schon.has(k.id)) continue;
    if (segment && !imSegment(k, segment, ctx)) continue;
    const f = k.firmaId ? ctx.firmen.get(k.firmaId) : undefined;
    const gruppe = mixGruppe(k, f);
    let punkte = 0;
    const gruende: string[] = [];
    const plus = (p: number, g: string) => { punkte += p; gruende.push(g); };
    if (k.kreis === 'A') plus(30, 'Kreis A'); else if (k.kreis === 'B') plus(20, 'Kreis B'); else if (k.kreis === 'C') punkte += 5;
    const phase = k.lebensphase;
    if (phase === 'kunde') plus(25, 'Kunde'); else if (phase === 'multiplikator') plus(25, 'Multiplikator'); else if (phase === 'partner') plus(15, 'Partner'); else if (phase === 'interessent') plus(10, 'Interessent');
    if (gruppe === 'zielkunde' && f?.rolle === 'zielkunde') plus(10, 'Zielkunden-Firma');
    if (k.prio === 'A') plus(20, 'Prio A'); else if (k.prio === 'B') plus(10, 'Prio B');
    if (ctx.mitChance.has(k.id)) plus(10, 'offene Chance');
    if ((gruppe === 'zielkunde' && m.fehlen.zielkunden > 0) || (gruppe === 'kunde' && m.fehlen.kunden > 0)) plus(15, 'fehlt in der Mischung');
    if (warDa.get(k.id)) plus(5, 'war schon bei einem Event');
    else if (nichtGekommen.get(k.id)) plus(-10, 'letztes Mal nicht gekommen');
    if (k.eignung === 'nein') plus(-15, 'Eignung: nein');
    if (!segment && punkte <= 0) continue;
    const ampel = kanalStatus(k, 'einladung', { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) });
    raus.push({ kontakt: k, punkte, gruende, gruppe, weg: ampel.farbe === 'gruen' ? 'mail' : 'persoenlich', ampel });
  }
  return raus.sort((a, b) => b.punkte - a.punkte || anzeigename(a.kontakt).localeCompare(anzeigename(b.kontakt), 'de')).slice(0, n);
}

// ── Kalender-Datei (RFC 5545) ───────────────────────────────────────────────
// Die Datei ist gästetauglich: Titel, Ort, Format und Ablauf — kein internes
// Ziel, keine Gästeliste, keine Notizen. Teilnehmerlisten gibt MAKE OS nie an
// andere Gäste weiter (Regel 4 des Head of Event).

const DAUER: Record<EventFormat, number> = { stammtisch: 150, workshop: 330, dinner: 210, webinar: 60, messe: 480, sonstig: 120 };
const FORMAT_LABEL: Record<EventFormat, string> = { stammtisch: 'Stammtisch', workshop: 'Workshop', dinner: 'Dinner', webinar: 'Webinar', messe: 'Messe', sonstig: 'Event' };

const VTIMEZONE_BERLIN = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

const p2 = (n: number) => String(n).padStart(2, '0');
const minuten = (hhmm?: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
/** Lokale Wanduhrzeit (Europe/Berlin) als JJJJMMTTTHHMMSS — Minuten über Mitternacht rollen ins nächste Datum. */
function lokal(datum: string, min: number): string {
  const [y, m, d] = datum.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 0, min));
  return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}T${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}00`;
}
function utcStempel(iso: string): string {
  const t = Number.isFinite(Date.parse(iso)) ? new Date(iso) : new Date();
  return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}T${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}${p2(t.getUTCSeconds())}Z`;
}
/** TEXT-Werte nach RFC 5545 3.3.11: Backslash, Semikolon, Komma, Zeilenumbruch. */
export const icsEscape = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const oktette = (ch: string) => { const c = ch.codePointAt(0) ?? 0; return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
/** Zeilen über 75 Oktette falten (CRLF + Leerzeichen), ohne ein UTF-8-Zeichen zu zerschneiden. */
function falten(zeile: string): string {
  const teile: string[] = [];
  let akt = '', laenge = 0;
  for (const ch of Array.from(zeile)) {
    const b = oktette(ch);
    if (laenge + b > (teile.length ? 74 : 75)) { teile.push(akt); akt = ''; laenge = 0; }
    akt += ch; laenge += b;
  }
  teile.push(akt);
  return teile.join('\r\n ');
}

/** Dauer: bis zum letzten Ablaufpunkt + 30 Minuten, sonst typisch fürs Format. */
function dauerMinuten(e: Event, start: number): number {
  const letzte = Math.max(-1, ...(e.ablauf ?? []).map(a => minuten(a.zeit) ?? -1));
  return letzte > start ? letzte - start + 30 : DAUER[e.format] ?? 120;
}

export function icsText(e: Event, jetzt: string = new Date().toISOString()): string {
  const start = minuten(e.uhrzeit);
  const z: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAKE OS//CRM Events//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (start !== null) z.push(...VTIMEZONE_BERLIN);
  z.push('BEGIN:VEVENT', `UID:${e.id}@makeos`, `DTSTAMP:${utcStempel(jetzt)}`);
  if (start !== null) z.push(`DTSTART;TZID=Europe/Berlin:${lokal(e.datum, start)}`, `DTEND;TZID=Europe/Berlin:${lokal(e.datum, start + dauerMinuten(e, start))}`);
  else z.push(`DTSTART;VALUE=DATE:${e.datum.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${plusTage(e.datum, 1).replace(/-/g, '')}`);
  z.push(`SUMMARY:${icsEscape(e.titel)}`);
  if (e.ort) z.push(`LOCATION:${icsEscape(e.ort)}`);
  const ablauf = [...(e.ablauf ?? [])].sort((a, b) => a.zeit.localeCompare(b.zeit)).map(a => `${a.zeit} ${a.punkt}`.trim());
  const text = [FORMAT_LABEL[e.format] ?? 'Event', e.coHost ? `gemeinsam mit ${e.coHost}` : '', ablauf.length ? `\nAblauf:\n${ablauf.join('\n')}` : ''].filter(Boolean).join('\n');
  z.push(`DESCRIPTION:${icsEscape(text)}`);
  z.push(`STATUS:${e.status === 'abgesagt' ? 'CANCELLED' : e.status === 'idee' ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR');
  return z.map(falten).join('\r\n') + '\r\n';
}

/** Dateiname ohne Umlaute und Sonderzeichen: „2026-11-05-stammtisch-maschinenbau.ics“. */
export function icsDateiname(e: Pick<Event, 'datum' | 'titel'>): string {
  const slug = e.titel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `${e.datum}-${slug || 'event'}.ics`;
}
