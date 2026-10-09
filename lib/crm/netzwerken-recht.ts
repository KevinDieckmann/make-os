// ─── Netzwerken — Recht an einer Stelle (rein, client-sicher, getestet; 03.10., Paket „netz-recht“) ───
// Entscheidung des Inhabers (03.10.): Kontakte, die wir als Interim CSO/Head of Sales für einen Kunden auf einer Veranstaltung kennenlernen,
// „gehören immer auch uns“. MAKE ist EIGENER Verantwortlicher (Art. 6 Abs. 1 lit. f DSGVO, Interessenabwägung `LIA_NETZWERKEN`,
// DATENSCHUTZ_NETZWERKEN.md), es gibt KEINE Sperre für die eigene Akquise. Die Weitergabe an den Kunden ist eine ÜBERMITTLUNG an einen
// Dritten (keine Auftragsverarbeitung): Transparenz (Art. 13 — Empfänger nennen), Protokoll mit Empfänger am Event, Auskunft (Art. 15 —
// Empfänger nennen), Mitteilung bei Löschung/Berichtigung (Art. 19). Hinweis, keine Rechtsberatung — anwaltlich gegenlesen lassen.
//
// Hier steht, was Browser UND Server brauchen:
//   · die Festwerte (Verweis auf die Interessenabwägung, Hinweis- und Rollen-Texte)
//   · `datenschutzHinweisText` — der Art.-13-Block der Danke-Mail (Du/Sie, bei Kunden-Events mit Empfänger)
//   · `werbeWoerter` — Warnung vor Angebot/Einladung/Newsletter/Rabatt in einer Danke-Mail (§ 7 UWG)
//   · `kennengelerntZeilen` — „kennengelernt für <Kunde> bei <Event>“ für die Kontaktakte
//   · `uebergabeHinweisFuer` — „Person wurde am … an <Kunde> übergeben — dort informieren (Art. 19)“ für Art. 15/17
//   · `informationOffen` — Netzwerken-Personen ohne Datenschutzhinweis (Selbstprüfung)

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event, Firma } from './typen';
import { VERANTWORTLICHER_FEHLT } from '@/lib/datenschutz/einrichtung';

// ── Festwerte ───────────────────────────────────────────────────────────────

/** Verweis am Kontakt auf die Interessenabwägung (Stand v1) — `Kontakt.rechtsgrundlageNotiz`. */
export const LIA_NETZWERKEN = 'LIA-Netzwerken v1';
/** Danke-Mails werden so lange angeboten (Glocke, Heute) — danach nicht mehr (der Anlass ist weg, die Mail wäre keine Danke-Mail mehr). */
export const DANKE_FRIST_TAGE = 14;
/** Tage, nach denen eine Person ohne Datenschutzhinweis in der Selbstprüfung als „nicht informiert“ zählt. */
export const INFO_FRIST_TAGE = 3;

/**
 * Kontaktweg für Betroffene (Auskunft, Berichtigung, Löschung, Widerspruch) und die Seite mit den Hinweisen. Plattform-Regel: der
 * Verantwortliche steht NIE fest im Code (08.10./09.10., Paket „neutral-rest“) — die Angaben kommen aus der Datenschutz-Einrichtung
 * (System › Datenschutz, `verantwortlicherWirksam`) bzw. beim Bauen aus `NEXT_PUBLIC_MAKE_DATENSCHUTZ_MAIL` / `…_SEITE` (die Literale stehen
 * so da, damit Next sie einsetzt). Fehlt beides, steht im Entwurf sichtbar `VERANTWORTLICHER_FEHLT` bzw. `KONTAKTWEG_FEHLT` und `fehlt: true`
 * — die Oberfläche zeigt dazu einen Hinweis; nie ein Name oder eine Adresse aus dem Code.
 */
export const KONTAKTWEG_FEHLT = '[Kontaktweg fehlt — unter System › Datenschutz eintragen]';
export interface DatenschutzAngaben { mail: string; seite: string; verantwortlich: string; /** Nichts eingerichtet: Verantwortlicher und/oder Kontaktweg fehlen. */ fehlt?: boolean }
export function datenschutzAngaben(): DatenschutzAngaben {
  const mail = process.env.NEXT_PUBLIC_MAKE_DATENSCHUTZ_MAIL || '';
  const seite = process.env.NEXT_PUBLIC_MAKE_DATENSCHUTZ_SEITE || '';
  return { mail, seite, verantwortlich: VERANTWORTLICHER_FEHLT, fehlt: true };
}

/**
 * Die Angaben aus der Datenschutz-Einrichtung (05.10., EINE Quelle — System › Datenschutz): Verantwortlicher = Name/Firma, Kontaktweg =
 * Datenschutzbeauftragter, sonst die Kontakt-Mail; Seite = Datenschutzhinweis der Einrichtung. Ohne Einrichtung (`v` leer): „fehlt“ —
 * Kunden-Instanzen brauchen dafür KEINE Build-Variable (der Server liest die Einrichtung zur Laufzeit).
 */
export function datenschutzAngabenAus(v: { name: string; mail: string; dsb?: { mail?: string }; seite?: string } | null | undefined): DatenschutzAngaben {
  const basis = datenschutzAngaben();
  return v ? { mail: v.dsb?.mail || v.mail, seite: v.seite || basis.seite, verantwortlich: v.name } : basis;
}

/** Der Hinweis überall dort, wo Kontakte für Kunden entstehen oder übergeben werden (Akte, „Für Kunden“, Dialog, Netzwerken-Auswahl). */
export const UEBERGABE_HINWEIS = 'Kontakte, die wir für einen Kunden kennenlernen, gehören auch uns: wir sind eigener Verantwortlicher (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO). Die Weitergabe an den Kunden ist eine Übermittlung an einen Dritten — die Person wird in der Danke-Mail darüber informiert (Art. 13), die Übergabe steht mit Empfänger im Protokoll (Auskunft Art. 15, Mitteilung bei Löschung Art. 19). Gesperrte Personen (Art. 18, Werbesperre) gehen nie mit.';
/** Dezenter Zusatz: die Rollenverteilung (eigener Verantwortlicher / gemeinsam / Auftrag) hängt vom Einzelfall und der Vereinbarung ab. */
export const ROLLE_HINWEIS = 'Rolle mit dem Kunden und Vertrag einmal mit dem Anwalt klären.';
/** Nach dem Download. */
export const DATEI_LOESCHEN_HINWEIS = 'Nach der Weitergabe die Datei löschen.';
/** Vermerk je Zeile im Export: eine Visitenkarte ist keine Einwilligung (§ 7 UWG). */
export const KEINE_WERBE_EINWILLIGUNG = 'keine (Visitenkarte, § 7 UWG)';

// ── Art. 13: Hinweisblock in der Danke-Mail ────────────────────────────────

/**
 * Der Datenschutzhinweis am Ende der Danke-Mail — kurz und freundlich: wer, wozu, Rechtsgrundlage, Werbung nur mit Einwilligung,
 * Rechte und wohin. Bei einem Kunden-Event zusätzlich der Empfänger der Übermittlung (`kunde` = Name der Firma).
 */
export function datenschutzHinweisText(o: { du: boolean; kunde?: string; angaben?: DatenschutzAngaben; /** `bestand`: die Person war schon in der Kartei — dann steht dort NICHT „von der Visitenkarte notiert“ (Art. 13/14: der Text muss stimmen). Standard `karte`. */ quelle?: 'karte' | 'bestand' }): string {
  const a = o.angaben ?? datenschutzAngaben();
  const dein = o.du ? 'deine' : 'Ihre', deiner = o.du ? 'deiner' : 'Ihrer', dir = o.du ? 'dir' : 'Ihnen', dein2 = o.du ? 'deiner' : 'Ihrer';
  const erste = o.quelle === 'bestand' ? `Ich verarbeite ${dein} Kontaktdaten, um mit ${dir} in Verbindung zu bleiben` : `Ich habe mir ${dein} Kontaktdaten von ${deiner} Visitenkarte notiert, um mit ${dir} in Verbindung zu bleiben`;
  const weg = [a.mail, a.seite].filter(Boolean).join(' · ') || KONTAKTWEG_FEHLT;
  const zeilen = [
    `Datenschutz: ${erste} (Art. 6 Abs. 1 lit. f DSGVO, Verantwortlich: ${a.verantwortlich}). Werbung sende ich nur mit ${dein2} Einwilligung. Auskunft, Berichtigung, Löschung, Widerspruch: ${weg}`,
  ];
  const kunde = (o.kunde ?? '').replace(/\s+/g, ' ').trim();
  if (kunde) zeilen.push(`Wir waren für ${kunde} auf der Veranstaltung und geben ${dein} Kontaktdaten an ${kunde} weiter.`);
  return zeilen.join('\n');
}

/**
 * Darf der Danke-Text die Weitergabe an den Kunden ankündigen? Nur wenn die Person überhaupt übergeben werden kann UND soll:
 * an diesem Event neu angelegt (Bestandspersonen gehen nur mit ausdrücklichem Haken mit — da wird nichts angekündigt), nicht gesperrt.
 */
export const weitergabeAnkuendigen = (k: Pick<Kontakt, 'werbesperre' | 'eingeschraenkt'>, n: { neuAngelegt?: boolean } | undefined): boolean =>
  !!n?.neuAngelegt && !k.werbesperre && !k.eingeschraenkt;

// ── UWG: Werbewörter in einer Danke-Mail ──────────────────────────────────

const WERBE = /\b(angebot\w*|einladung\w*|einladen|einlade\w*|newsletter\w*|rabatt\w*|sonderpreis\w*|aktion\w*|gutschein\w*|webinar\w*|produktvorstellung\w*|kostenlos\w*|gratis)\b/gi;
/** Fester Hinweis über dem Text der Danke-Mail. */
export const DANKE_UWG_HINWEIS = 'Nur Dank und Verabredetes. Keine Angebote, Einladungen oder Produktwerbung — ohne Einwilligung wäre das Werbung (§ 7 UWG).';
/**
 * Welche Werbewörter stehen im Text (klein, ohne Doppelte)? Die Datenschutzzeile am Ende zählt nicht („Werbung sende ich nur …“ ist keine
 * Werbung) — sie enthält keines der Wörter; trotzdem wird nur gewarnt, nie blockiert (die Person entscheidet).
 */
export function werbeWoerter(text: string): string[] {
  const treffer = (text.match(WERBE) ?? []).map(w => w.toLowerCase());
  return Array.from(new Set(treffer));
}

// ── Kontaktakte: „kennengelernt für <Kunde> bei <Event>“ ───────────────────

const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Zeilen für die Kontaktakte (nichts, wenn die Person nicht für einen Kunden kennengelernt wurde). */
export function kennengelerntZeilen(k: Pick<Kontakt, 'kennengelerntFuer'>, firmen: readonly Pick<Firma, 'id' | 'name'>[], events: readonly Pick<Event, 'id' | 'titel'>[]): string[] {
  return (k.kennengelerntFuer ?? []).map(x => {
    const kunde = firmen.find(f => f.id === x.firmaId)?.name ?? 'einem Kunden';
    const ev = events.find(e => e.id === x.eventId)?.titel;
    return `kennengelernt für ${kunde}${ev ? ` bei ${ev}` : ''} (${tagDe(x.am)})`;
  });
}

// ── Art. 15 / 17 / 19: an wen wurde die Person übergeben? ──────────────────

export interface UebergabeVermerk { eventId: string; eventTitel: string; am: string; von: string; empfaengerFirmaId?: string; empfaenger: string; dateiname?: string }
/**
 * Alle Übergaben, in denen diese Person stand (Protokoll am Event, `kontaktIds`) — mit Empfänger. Älteres Protokoll ohne Kennungen
 * (vor dem 03.10.) kann die Person nicht benennen; es erscheint hier nie (nur die Anzahl steht im Protokoll).
 */
export function uebergabenVon(crm: Pick<CrmBestand, 'events' | 'firmen'>, kontaktId: string): UebergabeVermerk[] {
  const raus: UebergabeVermerk[] = [];
  for (const e of crm.events ?? []) {
    for (const u of e.uebergaben ?? []) {
      if (!u.kontaktIds?.includes(kontaktId)) continue;
      const firmaId = u.empfaengerFirmaId ?? (e.fuer?.art === 'kunde' ? e.fuer.firmaId : undefined);
      raus.push({ eventId: e.id, eventTitel: e.titel, am: u.am.slice(0, 10), von: u.von, ...(firmaId ? { empfaengerFirmaId: firmaId } : {}), empfaenger: (firmaId ? crm.firmen.find(f => f.id === firmaId)?.name : undefined) ?? 'einem Kunden', ...(u.dateiname ? { dateiname: u.dateiname } : {}) });
    }
  }
  return raus.sort((a, b) => a.am.localeCompare(b.am));
}

/** Auskunft (Art. 15): „übergeben am 03.10.2026 an Muster GmbH (Event …)“. */
export const uebergabeAuskunftText = (u: UebergabeVermerk): string => `übergeben am ${tagDe(u.am)} an ${u.empfaenger} (${u.eventTitel})`;
/** Art. 17 / Berichtigung: die Mitteilungspflicht (Art. 19) an den Empfänger. */
export const uebergabeHinweisText = (u: UebergabeVermerk): string => `Person wurde am ${tagDe(u.am)} an ${u.empfaenger} übergeben (${u.eventTitel}) — dort informieren (Art. 19)`;

// ── Selbstprüfung: Information bei Veranstaltungs-Kontakten ────────────────

/** Ist das eine Person, die über „Netzwerken“ neu angelegt wurde (Verweis auf die Interessenabwägung)? */
export const istNetzwerkenPerson = (k: Pick<Kontakt, 'rechtsgrundlageNotiz'>): boolean => !!k.rechtsgrundlageNotiz && k.rechtsgrundlageNotiz.startsWith('LIA-Netzwerken');

/** Netzwerken-Personen, die seit mehr als `INFO_FRIST_TAGE` Tagen angelegt sind, ohne dass der Datenschutzhinweis vermerkt ist (Art. 13). */
export function informationOffen(kontakte: readonly Kontakt[], heute: string): Kontakt[] {
  const grenze = new Date(`${heute}T12:00:00Z`);
  grenze.setUTCDate(grenze.getUTCDate() - INFO_FRIST_TAGE);
  const g = grenze.toISOString().slice(0, 10);
  return kontakte.filter(k => istNetzwerkenPerson(k) && !k.eingeschraenkt && !k.datenschutzInformiertAm && !!k.importiertAm && k.importiertAm <= g);
}
