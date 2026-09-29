// ─── Kontakt öffnen · Reiter „Aktivitäten“ — reine Logik (28.09., Paket H3) ──
// Kevin (28.09., HubSpot als Vorbild): „das ganze Thema Aktivitäten sauber
// gemacht“. Diese Datei macht aus allem, was an einer Person passiert ist oder
// ansteht, EINE Liste von Einträgen — ohne Oberfläche, getestet in
// tests/crm-aktivitaeten.test.ts:
//   · der Verlauf am Kontakt (Kontakt.aktivitaeten)
//   · die Follow-ups der Person (echte aus crm.followups, offen und abgeschlossen,
//     plus die virtuellen aus lib/crm/followup.ts `faellige` — nächster Schritt,
//     Wiedervorlage, Deal-Schritt, Nachfassen, Review, Kadenz) = „Aufgaben“
//   · der nächste Kalendertermin aus dem Geschäftskalender (crm.termine)
// Aufgaben im Board haben keinen Kontaktbezug (types/tasks.ts) — sie kommen
// nur über ein Follow-up hierher (FollowUp.aufgabeId).
//
// Zuordnung der Unter-Reiter:
//   Notizen   = notiz
//   E-Mails   = mail · antwort · linkedin   (sichtbar „E-Mails & Nachrichten“)
//   Anrufe    = anruf
//   Meetings  = termin · gespraech · event + kommender Kalendertermin
//   Aufgaben  = Follow-ups der Person
//   System    = stufe · system · uebergabe — nur unter „Alle“, standardmäßig aus
//
// ANKER (für den Sprung aus der Zusammenfassung im Reiter „Über“):
//   Jede Karte trägt `id = <anker>`. Die Adresse ist die Kontakt-Adresse mit dem
//   Reiter Aktivitäten plus `#<anker>` — der Reiter setzt dann die Filter zurück,
//   klappt auf, scrollt hin und hebt die Karte kurz hervor.
//     Verlauf:      `akt-<hash>`        hash = FNV-1a (base36) über am|art|von|bezug;
//                                       bei gleichem Schlüssel `-2`, `-3` … in Log-Reihenfolge.
//                                       Stabil gegen Umsortieren und Bearbeiten des Texts.
//                                       Berechnen: `aktivitaetAnker(k.aktivitaeten, i)`.
//     Follow-up:    `akt-fu-<id>`       (virtuelle Kennung `v:schritt:c-x` → `akt-fu-v-schritt-c-x`)
//     Kalender:     `akt-kal-<kontaktId>`
//
// Zeiten: Aktivitäten tragen ISO-Zeitpunkte (UTC). Tag, Uhrzeit, Monat und
// Zeitraum rechnen in Europe/Berlin — nie `.slice(0, 10)` auf einem UTC-Stempel.
//
// Meetings (28.09., H4): Zeitpunkt und Ort stehen als Felder `wann`/`ort` an der
// Aktivität; `am` bleibt, wann festgehalten wurde. Altbestand trägt das Datum in der
// ersten Textzeile („Meeting am 02.10.2026 um 14:00 Uhr · Ort: …“) — `meetingVon`
// liest beides (Feld vor Text).
//
// Eigene Notizen ändern/löschen (28.09., H4): nur über POST /api/crm/aktivitaet mit
// `aktion: 'aendern' | 'loeschen'`, Anker und Stand (409 bei veraltetem Stand) —
// Logik in `notizAnwenden`. Die alte Fassung bekommt eine Löschmarke
// (lib/crm/aktivitaet-marke.ts), damit sie beim Vereinen nicht zurückkommt.

import type { Aktivitaet, AktivitaetArt, Ergebnis, Kontakt, NotizVorlage } from '@/lib/make-one/crm';
import { NOTIZ_FELDER } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUpArt, FollowUpStatus } from './typen';
import { faellige, FOLLOWUP_ARTEN, tagPlus, type Faellig, type VirtuelleQuelle } from './followup';
import { normiere } from './wahl';
import { kurzHash, grundAnker, aktivitaetMarke, markenMit } from './aktivitaet-marke';

// ── Unter-Reiter und Kategorien ──────────────────────────────────────────────
export type Unter = 'alle' | 'notizen' | 'emails' | 'anrufe' | 'aufgaben' | 'meetings';
export type Kategorie = Exclude<Unter, 'alle'> | 'system';

export const UNTER_REITER: readonly { id: Unter; label: string }[] = [
  { id: 'alle', label: 'Alle Aktivitäten' }, { id: 'notizen', label: 'Notizen' }, { id: 'emails', label: 'E-Mails & Nachrichten' },
  { id: 'anrufe', label: 'Anrufe' }, { id: 'aufgaben', label: 'Aufgaben' }, { id: 'meetings', label: 'Meetings' },
];
/** Die fünf Arten, nach denen „Alle“ filtern kann (System hat einen eigenen Schalter). */
export const FILTER_ARTEN: readonly { id: Exclude<Kategorie, 'system'>; label: string }[] = [
  { id: 'notizen', label: 'Notizen' }, { id: 'emails', label: 'E-Mails & Nachrichten' }, { id: 'anrufe', label: 'Anrufe' },
  { id: 'aufgaben', label: 'Aufgaben' }, { id: 'meetings', label: 'Meetings' },
];

export const KATEGORIE_VON_ART: Record<AktivitaetArt, Kategorie> = {
  notiz: 'notizen', mail: 'emails', antwort: 'emails', linkedin: 'emails', anruf: 'anrufe',
  termin: 'meetings', gespraech: 'meetings', event: 'meetings', stufe: 'system', system: 'system', uebergabe: 'system',
};

/** Unter-Reiter aus der Adresse — Unbekanntes wird „alle“. */
export function unterAus(s?: string | null): Unter {
  return UNTER_REITER.some(u => u.id === s) ? (s as Unter) : 'alle';
}

// ── Beschriftung ─────────────────────────────────────────────────────────────
export const ART_TITEL: Record<AktivitaetArt, string> = {
  notiz: 'Notiz', mail: 'E-Mail', antwort: 'Antwort erhalten', linkedin: 'LinkedIn-Nachricht', anruf: 'Anruf',
  termin: 'Meeting', gespraech: 'Gespräch', event: 'Event', stufe: 'Stufe geändert', system: 'Systemereignis', uebergabe: 'Übergabe',
};
/** Ergebnis im Titel („Anruf · Gespräch geführt“). */
export const ERGEBNIS_TITEL: Record<Ergebnis, string> = {
  gespraech: 'Gespräch geführt', termin: 'Termin vereinbart', mailbox: 'Mailbox', nicht_erreicht: 'Nicht erreicht',
  rueckruf: 'Rückruf vereinbart', kein_bedarf: 'Kein Bedarf', sperre: 'Werbesperre',
};
/** Ergebnis als kurzer Chip. */
export const ERGEBNIS_KURZ: Record<Ergebnis, string> = {
  gespraech: 'Gespräch', termin: 'Termin', mailbox: 'Mailbox', nicht_erreicht: 'nicht erreicht', rueckruf: 'Rückruf', kein_bedarf: 'kein Bedarf', sperre: 'Sperre',
};
/** Ergebnisse, die man beim „+ Anruf festhalten“ wählen kann (Sperre läuft über Datenschutz). */
export const ANRUF_ERGEBNISSE: readonly Ergebnis[] = ['gespraech', 'termin', 'mailbox', 'nicht_erreicht', 'rueckruf', 'kein_bedarf'];

const QUELLE_HINWEIS: Record<VirtuelleQuelle, string> = {
  schritt: 'Nächster Schritt am Kontakt', wiedervorlage: 'Wiedervorlage', dealschritt: 'Nächster Schritt am Deal',
  nachfassen: 'Nachfassen nach dem Event', review: 'Review am Mandat', kadenz: 'Takt des Kreises',
};
export const STATUS_LABEL: Record<FollowUpStatus, string> = { offen: 'offen', erledigt: 'erledigt', verpasst: 'verpasst', abgesagt: 'abgesagt' };
const artLabel = (a: FollowUpArt) => FOLLOWUP_ARTEN.find(x => x.id === a)?.label ?? 'Aufgabe';

// ── Zeit in Europe/Berlin ────────────────────────────────────────────────────
const BERLIN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * Tag und Uhrzeit in Berlin. Ein reiner Tag bleibt, wie er ist; eine Zeit ohne
 * Zonenangabe („2026-09-30T14:00“) gilt schon als Berliner Zeit; alles mit Z
 * oder Versatz wird umgerechnet.
 */
export function berlin(iso: string): { tag: string; zeit?: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { tag: iso };
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(iso);
    if (m) return { tag: m[1], zeit: m[2] };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { tag: iso.slice(0, 10) };
  const p = Object.fromEntries(BERLIN.formatToParts(d).map(x => [x.type, x.value]));
  return { tag: `${p.year}-${p.month}-${p.day}`, zeit: `${p.hour}:${p.minute}` };
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const monatLabel = (monat: string) => `${MONATE[Number(monat.slice(5, 7)) - 1] ?? monat} ${monat.slice(0, 4)}`;

// ── Meeting festhalten: Zeitpunkt und Ort als Felder (28.09., H4) ─────────────
// Seit H4 schreibt „+ Meeting“ `wann` (Tag bzw. Tag + Uhrzeit, Berliner Zeit) und
// `ort` an die Aktivität, der Text ist nur noch die Notiz. Früher stand das Datum
// in einer festen ersten Textzeile (`meetingText`) — die wird für den Altbestand
// weiter gelesen. Keine Kalendereinladung, keine Teilnehmer: MAKE OS verschickt nichts.
export interface MeetingDaten { tag: string; zeit?: string; ort?: string; notiz?: string }

/** `wann` für die Aktivität aus Tag und optionaler Uhrzeit (Berliner Zeit, ohne Zone). */
export const meetingWann = (tag: string, zeit?: string): string => (zeit && /^\d{2}:\d{2}$/.test(zeit) ? `${tag}T${zeit}` : tag);

/** Zeit eines Kalendertermins für ein Meeting mit `terminUid` (K3) — aus /api/kalender/bezug, je Schlüssel. */
export interface TerminZeit { start: string; ende?: string; ganztags?: boolean; ort?: string; titel?: string }
export type TerminZeiten = Readonly<Record<string, TerminZeit>>;

/**
 * Datum, Uhrzeit, Ort und Notiz eines Meetings. Mit `terminUid` (K3) kommen Zeit und Ort aus dem TERMIN (`termine`,
 * über den Verweis gelesen — verschiebt sich der Termin, zeigt das Meeting die neue Zeit); fehlt er (noch nicht geladen,
 * in Apple gelöscht), steht das Meeting am Tag, an dem es festgehalten wurde. Sonst aus den Feldern, Altbestand aus
 * der ersten Textzeile.
 */
export function meetingVon(a: Pick<Aktivitaet, 'art' | 'text' | 'wann' | 'ort'> & Partial<Pick<Aktivitaet, 'terminUid' | 'am'>>, termine?: TerminZeiten): MeetingDaten | null {
  if (a.art !== 'termin') return null;
  if (a.terminUid) {
    const t = termine?.[a.terminUid];
    if (t) return { tag: t.start.slice(0, 10), ...(!t.ganztags && t.start.length > 10 ? { zeit: t.start.slice(11, 16) } : {}), ...(t.ort ? { ort: t.ort } : {}), ...(a.text?.trim() ? { notiz: a.text.trim() } : {}) };
    if (a.am) return { tag: berlin(a.am).tag, ...(a.text?.trim() ? { notiz: a.text.trim() } : {}) };
  }
  if (a.wann) {
    const b = berlin(a.wann);
    return { tag: b.tag, ...(b.zeit && a.wann.length > 10 ? { zeit: b.zeit } : {}), ...(a.ort ? { ort: a.ort } : {}), ...(a.text?.trim() ? { notiz: a.text.trim() } : {}) };
  }
  const alt = meetingAusText(a.text);
  return alt ? { ...alt, ...(a.ort && !alt.ort ? { ort: a.ort } : {}) } : null;
}

export function meetingText(e: MeetingDaten): string {
  const [j, m, t] = e.tag.split('-');
  const kopf = `Meeting am ${t}.${m}.${j}${e.zeit ? ` um ${e.zeit} Uhr` : ''}${e.ort?.trim() ? ` · Ort: ${e.ort.trim().replace(/\s+/g, ' ')}` : ''}`;
  return e.notiz?.trim() ? `${kopf}\n${e.notiz.trim()}` : kopf;
}

export function meetingAusText(text?: string): MeetingDaten | null {
  const m = /^Meeting am (\d{2})\.(\d{2})\.(\d{4})(?: um (\d{2}:\d{2}) Uhr)?(?: · Ort: ([^\n]+))?(?:\n([\s\S]*))?$/.exec(text ?? '');
  if (!m) return null;
  return { tag: `${m[3]}-${m[2]}-${m[1]}`, ...(m[4] ? { zeit: m[4] } : {}), ...(m[5] ? { ort: m[5].trim() } : {}), ...(m[6]?.trim() ? { notiz: m[6].trim() } : {}) };
}

// ── Anker ────────────────────────────────────────────────────────────────────
// FNV-Hash und Grundanker liegen in lib/crm/aktivitaet-marke.ts (auch für die Löschmarken).
export { kurzHash };

/** Anker aller Einträge des Verlaufs, in Log-Reihenfolge (gleiche Schlüssel bekommen -2, -3 …). */
export function ankerListe(liste: readonly Aktivitaet[]): string[] {
  const gesehen = new Map<string, number>();
  return liste.map(a => {
    const g = grundAnker(a);
    const n = (gesehen.get(g) ?? 0) + 1;
    gesehen.set(g, n);
    return n > 1 ? `${g}-${n}` : g;
  });
}
/** Anker des i-ten Eintrags im Verlauf eines Kontakts — für die Quellen-Nummern der Zusammenfassung. */
export const aktivitaetAnker = (liste: readonly Aktivitaet[], i: number): string | null => ankerListe(liste)[i] ?? null;
export const followupAnker = (id: string) => `akt-fu-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
export const kalenderAnker = (kontaktId: string) => `akt-kal-${kontaktId}`;
export const istAktAnker = (s?: string | null) => !!s && /^akt-[a-z0-9-]+$/i.test(s);

// ── Einträge ─────────────────────────────────────────────────────────────────
export interface Eintrag {
  anker: string;
  quelle: 'aktivitaet' | 'followup' | 'kalender';
  kategorie: Kategorie;
  /** Art der Aktivität bzw. „aufgabe“/„kalender“ — bestimmt das Symbol. */
  art: AktivitaetArt | 'aufgabe' | 'kalender';
  /** Tag (Berlin) und Uhrzeit, wann es war bzw. ansteht. */
  tag: string;
  zeit?: string;
  /** Sortierschlüssel `YYYY-MM-DDTHH:MM` in Berliner Zeit + Log-Nummer. */
  sortier: string;
  titel: string;
  text?: string;
  notiz?: NotizVorlage;
  ergebnis?: Ergebnis;
  /** Wer: `von` der Aktivität bzw. Zuständig beim Follow-up (kevin | malin | beide | zoe | system). */
  person?: string;
  /** Kennung eines Deals, Mandats, Events oder einer Kampagne. */
  bezug?: string;
  /** Oben unter „Kommend“: kommender Termin/Meeting, offenes Follow-up. */
  kommend: boolean;
  ueberfaellig?: boolean;
  status?: FollowUpStatus;
  /** Follow-up-Kennung (echt oder `v:…`) — zum Erledigen über /api/crm/followup. */
  followupId?: string;
  /** Leiser Zusatz (z. B. „aus: Nächster Schritt am Deal“, „festgehalten am …“). */
  hinweis?: string;
  ort?: string;
  /** Anlass eines Anrufs (U2 #58) — bei gelber Telefon-Ampel Pflicht. */
  anlass?: string;
  /** Stelle im Verlauf des Kontakts (nur Aktivitäten). */
  index?: number;
  /** Die Aktivität selbst (Bearbeiten/Löschen eigener Notizen). */
  aktivitaet?: Aktivitaet;
}

const sortierVon = (tag: string, zeit: string | undefined, nr = 0) => `${tag}T${zeit ?? '00:00'}#${String(nr).padStart(5, '0')}`;

/** Jetzt in Berlin als vergleichbarer Schlüssel. */
const jetztSchluessel = (jetzt: string) => { const b = berlin(jetzt); return `${b.tag}T${b.zeit ?? '00:00'}`; };

export interface AufbereitenOpts {
  /** Heutiger Tag (lokal, vom Server). */
  heute: string;
  /** Jetzt als ISO-Zeitpunkt. */
  jetzt: string;
  /** Nächster Termin der Person aus dem Geschäftskalender (crm.termine[k.id]). */
  termin?: { titel: string; start: string } | null;
  /** Zeiten der verknüpften Termine je `terminUid` (K3) — Meetings zeigen die Zeit ihres Termins. */
  termine?: TerminZeiten;
}

/**
 * Alles an einer Person als Einträge. Reihenfolge ist egal — `gruppieren`
 * sortiert. Systemereignisse sind dabei; ausgeblendet werden sie im Filter.
 */
export function aufbereiten(k: Kontakt, crm: CrmBestand | null | undefined, o: AufbereitenOpts): Eintrag[] {
  const raus: Eintrag[] = [];
  const jetzt = jetztSchluessel(o.jetzt);
  const log = k.aktivitaeten ?? [];
  const anker = ankerListe(log);

  // 1 · Verlauf
  log.forEach((a, i) => {
    const b = berlin(a.am);
    const kategorie = KATEGORIE_VON_ART[a.art] ?? 'system';
    const meeting = meetingVon(a, o.termine);
    // Ereigniszeit (U2 #46): auch ein nachgetragener Anruf / eine Mail steht an ihrem Tag (`wann ?? am`).
    const ereignis = !meeting && a.wann ? berlin(a.wann) : null;
    const tag = meeting?.tag ?? ereignis?.tag ?? b.tag;
    const zeit = meeting ? meeting.zeit : ereignis ? (a.wann!.length > 10 ? ereignis.zeit : undefined) : b.zeit;
    const kommend = !!meeting && `${meeting.tag}T${meeting.zeit ?? '23:59'}` > jetzt;
    raus.push({
      anker: anker[i], quelle: 'aktivitaet', kategorie, art: a.art, tag, ...(zeit ? { zeit } : {}), sortier: sortierVon(tag, zeit, i),
      titel: `${ART_TITEL[a.art] ?? a.art}${a.ergebnis ? ` · ${ERGEBNIS_TITEL[a.ergebnis]}` : ''}`,
      ...(meeting ? (meeting.notiz ? { text: meeting.notiz } : {}) : a.text ? { text: a.text } : {}),
      ...(a.notiz && Object.keys(a.notiz).length ? { notiz: a.notiz } : {}), ...(a.ergebnis ? { ergebnis: a.ergebnis } : {}),
      person: a.von, ...(a.bezug ? { bezug: a.bezug } : {}), kommend,
      ...(meeting ? { hinweis: `festgehalten am ${datumKurz(b.tag)}`, ...(meeting.ort ? { ort: meeting.ort } : {}) } : ereignis && ereignis.tag !== b.tag ? { hinweis: `nachgetragen am ${datumKurz(b.tag)}` } : {}),
      ...(a.anlass ? { anlass: a.anlass } : {}),
      index: i, aktivitaet: a,
    });
  });

  // 2 · Follow-ups: offene (echte + virtuelle) über die Follow-up-Ebene, abgeschlossene echte aus dem Bestand
  if (crm) {
    const offen: Faellig[] = faellige([k], crm, o.heute, { horizont: 3650, wertelisten: crm.wertelisten }).filter(f => f.kontaktId === k.id);
    for (const f of offen) {
      const v = f.virtuell ? (f.quelle as VirtuelleQuelle) : null;
      raus.push({
        anker: followupAnker(f.id), quelle: 'followup', kategorie: 'aufgaben', art: 'aufgabe', tag: f.faellig, ...(f.uhrzeit ? { zeit: f.uhrzeit } : {}),
        sortier: sortierVon(f.faellig, f.uhrzeit), titel: `Aufgabe · ${artLabel(f.art)}`, text: f.text, person: f.zustaendig,
        ...(f.bezug.art !== 'kontakt' ? { bezug: f.bezug.id } : {}), kommend: true, ueberfaellig: f.tageUeber > 0, status: 'offen', followupId: f.id,
        ...(v ? { hinweis: `aus: ${QUELLE_HINWEIS[v]}` } : {}),
      });
    }
    for (const f of crm.followups ?? []) {
      const gehoert = f.kontaktId === k.id || (f.bezug.art === 'kontakt' && f.bezug.id === k.id);
      if (!gehoert || f.status === 'offen') continue;
      const b = berlin(f.erledigtAm ?? f.geaendert ?? f.faellig);
      raus.push({
        anker: followupAnker(f.id), quelle: 'followup', kategorie: 'aufgaben', art: 'aufgabe', tag: b.tag, ...(b.zeit ? { zeit: b.zeit } : {}),
        sortier: sortierVon(b.tag, b.zeit), titel: `Aufgabe · ${artLabel(f.art)}`, text: f.text, person: f.zustaendig,
        ...(f.bezug.art !== 'kontakt' ? { bezug: f.bezug.id } : {}), kommend: false, status: f.status, followupId: f.id,
        ...(f.ergebnis && ERGEBNIS_KURZ[f.ergebnis as Ergebnis] ? { ergebnis: f.ergebnis as Ergebnis } : {}),
        hinweis: `fällig war ${datumKurz(f.faellig)}${f.notiz ? ` · ${f.notiz}` : ''}`,
      });
    }
  }

  // 3 · Nächster Kalendertermin (nur, wenn er noch kommt) — steht er schon als Meeting mit `terminUid` im Verlauf (K3), nicht doppelt.
  const alsMeeting = (start: string) => log.some(a => !!a.terminUid && o.termine?.[a.terminUid]?.start.slice(0, 16) === start.slice(0, 16));
  if (o.termin?.start && !alsMeeting(o.termin.start)) {
    const b = berlin(o.termin.start);
    if (`${b.tag}T${b.zeit ?? '23:59'}` > jetzt) {
      raus.push({ anker: kalenderAnker(k.id), quelle: 'kalender', kategorie: 'meetings', art: 'kalender', tag: b.tag, ...(b.zeit ? { zeit: b.zeit } : {}),
        sortier: sortierVon(b.tag, b.zeit), titel: 'Termin im Kalender', text: o.termin.titel, kommend: true, hinweis: 'aus dem Geschäftskalender' });
    }
  }
  return raus;
}

const datumKurz = (tag: string) => { const [j, m, t] = tag.split('-'); return t && m && j ? `${Number(t)}.${Number(m)}.${j}` : tag; };

// ── Filter ───────────────────────────────────────────────────────────────────
export type Zeitraum = 'beginn' | '7' | '30' | '90' | 'jahr';
export const ZEITRAEUME: readonly { id: Zeitraum; label: string }[] = [
  { id: 'beginn', label: 'Seit Beginn' }, { id: '7', label: 'Letzte 7 Tage' }, { id: '30', label: 'Letzte 30 Tage' },
  { id: '90', label: 'Letzte 90 Tage' }, { id: 'jahr', label: 'Dieses Jahr' },
];
export type PersonFilter = 'kevin' | 'malin' | 'beide';
export const PERSONEN_FILTER: readonly { id: PersonFilter; label: string }[] = [{ id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Beide' }];

export interface AktFilter {
  suche: string;
  /** Leer = alle Arten (nur unter „Alle“ wirksam). */
  arten: Exclude<Kategorie, 'system'>[];
  zeitraum: Zeitraum;
  /** null = alle Personen. */
  person: PersonFilter | null;
  /** Systemereignisse (Stufe, System, Übergabe) unter „Alle“ zeigen. */
  system: boolean;
}
export const FILTER_START: AktFilter = { suche: '', arten: [], zeitraum: 'beginn', person: null, system: false };

/** Weicht der Filter vom Start ab? (Dann steht „Filter zurücksetzen“ da.) Die Suche zählt mit. */
export const filterGesetzt = (f: AktFilter) => !!f.suche.trim() || f.arten.length > 0 || f.zeitraum !== 'beginn' || f.person !== null || f.system;

/** Zeitraum rückwärts ab heute (Berlin). Kommendes liegt nie „außerhalb“ — der Zeitraum schaut zurück. */
export function passtZeitraum(e: Pick<Eintrag, 'tag' | 'kommend'>, z: Zeitraum, heute: string): boolean {
  if (z === 'beginn' || e.kommend) return true;
  if (z === 'jahr') return e.tag >= `${heute.slice(0, 4)}-01-01`;
  return e.tag >= tagPlus(heute, -Number(z));
}

/**
 * Person: Kevin bzw. Malin findet, was sie/er tat oder wofür sie/er zuständig ist —
 * gemeinsame Follow-ups („beide“) zählen bei jedem. „Beide“ zeigt nur die gemeinsamen.
 */
export function passtPerson(e: Pick<Eintrag, 'person'>, p: PersonFilter | null): boolean {
  if (!p) return true;
  if (p === 'beide') return e.person === 'beide';
  return e.person === p || e.person === 'beide';
}

/** Suche über Titel, Text, Felder der Notizvorlage, Ergebnis, Ort und Hinweis — Umlaute egal. */
export function passtSuche(e: Eintrag, suche: string): boolean {
  const s = normiere(suche);
  if (!s) return true;
  const teile = [e.titel, e.text, e.ort, e.hinweis, e.ergebnis ? ERGEBNIS_TITEL[e.ergebnis] : undefined, e.ergebnis ? ERGEBNIS_KURZ[e.ergebnis] : undefined,
    ...(e.notiz ? NOTIZ_FELDER.map(f => e.notiz?.[f.id]) : [])];
  const heu = normiere(teile.filter(Boolean).join(' \u0001 '));
  return s.split(' ').every(w => heu.includes(w));
}

/** Was im Unter-Reiter sichtbar ist. */
export function filtern(liste: readonly Eintrag[], unter: Unter, f: AktFilter, heute: string): Eintrag[] {
  return liste.filter(e => {
    if (unter === 'alle') {
      if (e.kategorie === 'system') { if (!f.system) return false; }
      else if (f.arten.length && !f.arten.includes(e.kategorie)) return false;
    } else if (e.kategorie !== unter) return false;
    return passtZeitraum(e, f.zeitraum, heute) && passtPerson(e, f.person) && passtSuche(e, f.suche);
  });
}

/** Zähler je Unter-Reiter — mit denselben Filtern (Suche, Zeitraum, Person; Arten und System nur bei „Alle“). */
export function zaehlen(liste: readonly Eintrag[], f: AktFilter, heute: string): Record<Unter, number> {
  const z = { alle: 0, notizen: 0, emails: 0, anrufe: 0, aufgaben: 0, meetings: 0 } as Record<Unter, number>;
  for (const u of UNTER_REITER) z[u.id] = filtern(liste, u.id, f, heute).length;
  return z;
}

// ── Gruppieren ───────────────────────────────────────────────────────────────
export interface AktGruppe { id: string; label: string; eintraege: Eintrag[] }

/** „Kommend“ oben (nächstes zuerst), darunter je Monat (neuester Monat, neuester Eintrag zuerst). */
export function gruppieren(liste: readonly Eintrag[]): AktGruppe[] {
  const kommend = liste.filter(e => e.kommend).sort((a, b) => a.sortier.localeCompare(b.sortier));
  const monate = new Map<string, Eintrag[]>();
  for (const e of liste) {
    if (e.kommend) continue;
    const m = e.tag.slice(0, 7);
    (monate.get(m) ?? monate.set(m, []).get(m)!).push(e);
  }
  const raus: AktGruppe[] = kommend.length ? [{ id: 'kommend', label: 'Kommend', eintraege: kommend }] : [];
  for (const m of [...monate.keys()].sort().reverse()) {
    raus.push({ id: m, label: monatLabel(m), eintraege: monate.get(m)!.sort((a, b) => b.sortier.localeCompare(a.sortier)) });
  }
  return raus;
}

// ── Eigene Notizen bearbeiten und löschen (28.09., H4) ───────────────────────
// Schreibweg: POST /api/crm/aktivitaet mit `aktion: 'aendern' | 'loeschen'`, Kontakt-Id,
// Anker und Stand — hat inzwischen jemand anders geschrieben, kommt 409 mit dem
// aktuellen Kontakt; nichts wird still überschrieben. Nur Notizen, nur die eigenen
// (`von` = angemeldete Person). Die entfernte Fassung bekommt eine Löschmarke.

export const darfBearbeiten = (a: Pick<Aktivitaet, 'art' | 'von'>, ich: string | null | undefined) => a.art === 'notiz' && !!ich && a.von === ich;

export type NotizAktion = 'aendern' | 'loeschen';
export type NotizErgebnis = { ok: true; kontakt: Kontakt; unveraendert?: boolean } | { ok: false; status: 400 | 403 | 404; fehler: string };

/**
 * Eine eigene Notiz ändern oder löschen — rein, für die Route. `heute` ist der lokale Tag
 * (geaendertAm), `jetzt` der ISO-Zeitpunkt (`bearbeitet`).
 */
export function notizAnwenden(k: Kontakt, e: { aktion: NotizAktion; anker: string; text?: string }, ich: string | null | undefined, heute: string, jetzt: string): NotizErgebnis {
  const liste = k.aktivitaeten ?? [];
  const i = ankerListe(liste).indexOf(e.anker);
  if (i < 0) return { ok: false, status: 404, fehler: 'Diese Notiz gibt es nicht mehr — Stand neu laden.' };
  const a = liste[i];
  if (a.art !== 'notiz') return { ok: false, status: 403, fehler: 'Ändern und Löschen gibt es nur für Notizen.' };
  if (!ich || a.von !== ich) return { ok: false, status: 403, fehler: 'Nur eigene Notizen lassen sich ändern oder löschen.' };
  if (e.aktion === 'loeschen') {
    const marken = markenMit(k.geloeschteAktivitaeten, [aktivitaetMarke(a)]);
    return { ok: true, kontakt: { ...k, aktivitaeten: liste.filter((_, j) => j !== i), ...(marken ? { geloeschteAktivitaeten: marken } : {}), geaendertAm: heute } };
  }
  const t = String(e.text ?? '').trim().slice(0, 3000);
  if (!t) return { ok: false, status: 400, fehler: 'Eine Notiz braucht Text — zum Entfernen „Löschen“ nehmen.' };
  if (t === a.text) return { ok: true, kontakt: k, unveraendert: true };
  const neu: Aktivitaet = { ...a, text: t, bearbeitet: jetzt };
  // Alte Fassung markieren; kehrt der Text zu einer früher markierten Fassung zurück, gilt sie wieder.
  const marken = markenMit(k.geloeschteAktivitaeten, [aktivitaetMarke(a)], [aktivitaetMarke(neu)]);
  return { ok: true, kontakt: { ...k, aktivitaeten: liste.map((x, j) => (j === i ? neu : x)), ...(marken ? { geloeschteAktivitaeten: marken } : {}), geaendertAm: heute } };
}

// ── Bezug (Deal, Mandat, Event, Kampagne) ────────────────────────────────────
export interface BezugInfo { art: 'deal' | 'mandat' | 'event' | 'kampagne' | 'firma'; id: string; titel: string }

export function bezugAufloesen(id: string | undefined, crm: CrmBestand | null | undefined): BezugInfo | null {
  if (!id || !crm) return null;
  const c = crm.chancen.find(x => x.id === id);
  if (c) return { art: 'deal', id, titel: c.titel };
  const m = crm.mandate.find(x => x.id === id);
  if (m) return { art: 'mandat', id, titel: m.titel ? `${m.kunde} · ${m.titel}` : m.kunde };
  const e = crm.events.find(x => x.id === id);
  if (e) return { art: 'event', id, titel: e.titel };
  const kp = crm.kampagnen.find(x => x.id === id);
  if (kp) return { art: 'kampagne', id, titel: kp.name };
  const f = crm.firmen.find(x => x.id === id);
  if (f) return { art: 'firma', id, titel: f.name };
  return null;
}
