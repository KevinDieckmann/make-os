// ─── Datenschutz-Einrichtung der Instanz (05.10., Paket „DSGVO-Grundlagen im Code“) — rein, client-sicher, getestet ──
// Kevin 05.10.: „Die Software muss auf allen Standards der DSGVO sein, damit wir auch Kundendaten aufnehmen können.“
// EINE Quelle für das, was bisher fest im Code stand oder fehlte:
//   · Verantwortlicher (Art. 13 Abs. 1 lit. a, Art. 30 Abs. 1 lit. a): Name/Firma, Anschrift, Kontakt-Mail, optional Telefon,
//     Vertretung, Datenschutzbeauftragter. Gepflegt unter System › Datenschutz NUR vom Inhaber, serverseitig im Bestand
//     `datenschutz-einrichtung` (lib/datenschutz/einrichtung-server.ts). Rückfall: Umgebungsvariablen
//     (`MAKE_OS_VERANTWORTLICHER_*`, `MAKE_OS_DSB_*`). Steht nichts da, zeigen Auskunft, Verzeichnis und Selbstprüfung
//     deutlich `VERANTWORTLICHER_FEHLT` — nie ein Name aus dem Code (Plattform-Regel: Instanz-fähig, repo-sauber).
//   · Empfänger und Auftragsverarbeiter (Art. 28, 30 Abs. 1 lit. d/e, 44 ff.): Vorgabe-Liste (`EMPFAENGER_START`), danach
//     bearbeitbar; je Eintrag Rolle, Zweck, Datenkategorien, Drittland + Garantie, AVV-Status (offen / bestätigt am + Unterlage).
//     Speist das Verzeichnis (Export), die Auskunft (Art. 15 Abs. 1 lit. c) und die Selbstprüfung.
// Hinweis, keine Rechtsberatung — die Startwerte einmal anwaltlich gegenlesen.

/** Name des Bestands (Server, verschlüsselt wie jeder Bestand). */
export const EINRICHTUNG_SPEICHER = 'datenschutz-einrichtung';

export interface Datenschutzbeauftragter { name?: string; mail?: string }
export interface Verantwortlicher {
  /** Name bzw. Firma (mit Rechtsform). */
  name: string;
  /** Postanschrift (eine Zeile oder mehrere, Zeilenumbruch erlaubt). */
  anschrift: string;
  /** Kontakt für Datenschutzanfragen. */
  mail: string;
  telefon?: string;
  /** Vertretungsberechtigte Person(en), z. B. Geschäftsführung. */
  vertretung?: string;
  dsb?: Datenschutzbeauftragter;
  /** Adresse des Datenschutzhinweises (z. B. „example.de/datenschutz“) — steht in der Danke-Mail (Art. 13). Ohne: Standard der Instanz. */
  seite?: string;
  /**
   * Zuständige Datenschutz-Aufsichtsbehörde (optional, 05.10. „Betroffenenrechte v2“) — steht in jeder Auskunft nach Art. 15 Abs. 1 lit. f
   * neben dem allgemeinen Hinweis auf das Beschwerderecht (Art. 77). Ohne Eintrag nur der allgemeine Hinweis.
   */
  aufsicht?: string;
  /** Wann/wer zuletzt geändert (setzt nur der Server). */
  geaendert?: string;
  von?: string;
}

export type EmpfaengerRolle = 'auftragsverarbeiter' | 'eigener-verantwortlicher' | 'gemeinsam' | 'empfaenger';
export const ROLLEN: { id: EmpfaengerRolle; label: string }[] = [
  { id: 'auftragsverarbeiter', label: 'Auftragsverarbeiter (Art. 28)' },
  { id: 'eigener-verantwortlicher', label: 'eigener Verantwortlicher' },
  { id: 'gemeinsam', label: 'gemeinsam Verantwortliche (Art. 26)' },
  { id: 'empfaenger', label: 'Empfänger (Übermittlung)' },
];
/** Garantie für eine Übermittlung in ein Drittland (Kap. V DSGVO). `eu` = kein Drittland (EU/EWR). */
export type Garantie = 'eu' | 'angemessenheit' | 'dpf' | 'scc' | 'dpf-scc' | 'keine';
export const GARANTIEN: { id: Garantie; label: string }[] = [
  { id: 'eu', label: 'kein Drittland (EU/EWR)' },
  { id: 'angemessenheit', label: 'Angemessenheitsbeschluss (Art. 45)' },
  { id: 'dpf', label: 'EU-US Data Privacy Framework' },
  { id: 'scc', label: 'Standardvertragsklauseln (Art. 46)' },
  { id: 'dpf-scc', label: 'Data Privacy Framework + Standardvertragsklauseln' },
  { id: 'keine', label: 'keine Garantie' },
];
export type AvvStatus = 'offen' | 'bestaetigt' | 'nicht-noetig';
export interface AvvNachweis {
  status: AvvStatus;
  /** Tag der Bestätigung (JJJJ-MM-TT) — Pflicht bei `bestaetigt`. */
  am?: string;
  /** Wo der Nachweis liegt: Dateiname, Ablage-Kennung oder Link. */
  unterlage?: string;
}
export interface Empfaenger {
  id: string;
  name: string;
  rolle: EmpfaengerRolle;
  zweck: string;
  /** Datenkategorien, die dort ankommen. */
  daten: string;
  /** Drittland (leer = EU/EWR). */
  drittland: string;
  garantie: Garantie;
  avv: AvvNachweis;
  notiz?: string;
  /** Kommen dort Daten Dritter (Kontakte, Gäste, Absender) an? → steht in der Auskunft nach Art. 15 Abs. 1 lit. c. */
  dritte: boolean;
  /** Nicht (mehr) in Gebrauch — bleibt als Nachweis sichtbar, zählt nicht in die Selbstprüfung und nicht in die Auskunft. */
  archiviert?: boolean;
  /** Aus der Vorgabe-Liste (Startwert). */
  start?: boolean;
  geaendert?: string;
}

export interface DatenschutzEinrichtung {
  verantwortlicher?: Verantwortlicher;
  /**
   * Vorlage der Information nach Art. 14 (05.10., optional): Betreff und Text mit Platzhaltern (`ART14_PLATZHALTER`, lib/datenschutz/art14.ts).
   * Fehlt das Feld, gilt die Vorlage aus dem Code (`ART14_STANDARD`). Schreibt nur der Inhaber.
   */
  art14?: { betreff: string; text: string; geaendert?: string; von?: string };
  /** Fehlt das Feld, gilt die Vorgabe-Liste (`EMPFAENGER_START`); eine leere Liste ist eine bewusste Entscheidung. */
  empfaenger?: Empfaenger[];
}

// ── Verantwortlicher ────────────────────────────────────────────────────────

/** Was Auskunft, Verzeichnis und Selbstprüfung zeigen, solange niemand eingetragen ist. */
export const VERANTWORTLICHER_FEHLT = 'Verantwortlicher fehlt — unter System › Datenschutz eintragen';
/**
 * Platzhalter im Verzeichnis (Feld `verantwortlich` einer Verarbeitung): „wie in der Einrichtung“. So steht der Name an EINER
 * Stelle; Anzeige und Export lösen ihn mit `verantwortlichAufloesen` auf. Von Hand Eingetragenes bleibt, wie es ist.
 */
export const VERANTWORTLICH_EINRICHTUNG = 'laut Einrichtung (System › Datenschutz)';

const MAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[a-z]{2,}$/i;
const PFLICHT: (keyof Pick<Verantwortlicher, 'name' | 'anschrift' | 'mail'>)[] = ['name', 'anschrift', 'mail'];
const PFLICHT_LABEL: Record<(typeof PFLICHT)[number], string> = { name: 'Name/Firma', anschrift: 'Anschrift', mail: 'Kontakt-Mail' };

const zeile = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u0009\u000B-\u001F]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n + 1);
const mehrzeilig = (v: unknown, n: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F]/g, ' ').split('\n').map(z => z.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, n + 1);

/** Welche Pflichtangaben fehlen (leer = vollständig). */
export function verantwortlicherLuecken(v: Partial<Verantwortlicher> | null | undefined): string[] {
  if (!v) return PFLICHT.map(k => PFLICHT_LABEL[k]);
  return PFLICHT.filter(k => !String(v[k] ?? '').trim()).map(k => PFLICHT_LABEL[k]);
}

/** Eingabe prüfen und säubern (Server und Formular). Leere optionale Felder fallen weg. */
export function verantwortlicherPruefen(roh: unknown): { ok: true; v: Verantwortlicher } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'Verantwortlicher: Objekt erwartet.' };
  const r = roh as Record<string, unknown>;
  const name = zeile(r.name, 200), anschrift = mehrzeilig(r.anschrift, 300), mail = zeile(r.mail, 160).toLowerCase();
  const telefon = zeile(r.telefon, 40), vertretung = zeile(r.vertretung, 200), seite = zeile(r.seite, 200).replace(/^https?:\/\//i, ''), aufsicht = mehrzeilig(r.aufsicht, 300);
  if (seite && (seite.length > 200 || /\s/.test(seite) || !/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(seite))) return { ok: false, fehler: 'Datenschutzhinweis: eine Adresse wie „example.de/datenschutz“.' };
  const d = r.dsb && typeof r.dsb === 'object' ? r.dsb as Record<string, unknown> : {};
  const dsbName = zeile(d.name, 200), dsbMail = zeile(d.mail, 160).toLowerCase();
  if (aufsicht.length > 300) return { ok: false, fehler: 'Aufsichtsbehörde: höchstens 300 Zeichen.' };
  if (name.length > 200 || anschrift.length > 300 || mail.length > 160 || telefon.length > 40 || vertretung.length > 200 || dsbName.length > 200 || dsbMail.length > 160) return { ok: false, fehler: 'Eine Angabe ist zu lang (Name 200, Anschrift 300, Mail 160, Telefon 40 Zeichen).' };
  const luecken = verantwortlicherLuecken({ name, anschrift, mail });
  if (luecken.length) return { ok: false, fehler: `Es fehlt: ${luecken.join(', ')}.` };
  if (!MAIL.test(mail)) return { ok: false, fehler: 'Die Kontakt-Mail sieht nicht wie eine Adresse aus.' };
  if (dsbMail && !MAIL.test(dsbMail)) return { ok: false, fehler: 'Die Mail des Datenschutzbeauftragten sieht nicht wie eine Adresse aus.' };
  if (telefon && !/^[+\d][\d\s/()-]{3,39}$/.test(telefon)) return { ok: false, fehler: 'Telefon: nur Ziffern, Leerzeichen, +, /, ( ) und -.' };
  const dsb = dsbName || dsbMail ? { ...(dsbName ? { name: dsbName } : {}), ...(dsbMail ? { mail: dsbMail } : {}) } : undefined;
  return { ok: true, v: { name, anschrift, mail, ...(telefon ? { telefon } : {}), ...(vertretung ? { vertretung } : {}), ...(dsb ? { dsb } : {}), ...(seite ? { seite } : {}), ...(aufsicht ? { aufsicht } : {}) } };
}

/** Rückfall aus der Umgebung (Instanz ohne Einrichtung, z. B. Kunden-Instanz per Deploy) — nur, wenn die Pflichtangaben da sind. */
export function verantwortlicherAusUmgebung(env: Record<string, string | undefined> = process.env): Verantwortlicher | null {
  const r = verantwortlicherPruefen({
    name: env.MAKE_OS_VERANTWORTLICHER_NAME, anschrift: (env.MAKE_OS_VERANTWORTLICHER_ANSCHRIFT ?? '').replace(/\\n/g, '\n'), mail: env.MAKE_OS_VERANTWORTLICHER_MAIL,
    telefon: env.MAKE_OS_VERANTWORTLICHER_TELEFON, vertretung: env.MAKE_OS_VERANTWORTLICHER_VERTRETUNG, seite: env.MAKE_OS_VERANTWORTLICHER_SEITE,
    aufsicht: (env.MAKE_OS_AUFSICHTSBEHOERDE ?? '').replace(/\\n/g, '\n'),
    dsb: { name: env.MAKE_OS_DSB_NAME, mail: env.MAKE_OS_DSB_MAIL },
  });
  return r.ok ? r.v : null;
}

export interface VerantwortlicherWirksam { v: Verantwortlicher | null; quelle: 'einrichtung' | 'umgebung' | null; luecken: string[] }
/** Der wirksame Verantwortliche: Einrichtung (vollständig) → Umgebung → keiner. */
export function verantwortlicherWirksam(e: DatenschutzEinrichtung | null | undefined, env: Record<string, string | undefined> = process.env): VerantwortlicherWirksam {
  const eigen = e?.verantwortlicher;
  if (eigen && !verantwortlicherLuecken(eigen).length) return { v: eigen, quelle: 'einrichtung', luecken: [] };
  const u = verantwortlicherAusUmgebung(env);
  if (u) return { v: u, quelle: 'umgebung', luecken: [] };
  return { v: null, quelle: null, luecken: verantwortlicherLuecken(eigen) };
}

/** Eine Zeile für Verzeichnis, Hinweise und Auskunft: „Name, Anschrift (einzeilig), Mail“. */
export function verantwortlicherText(v: Verantwortlicher | null | undefined): string {
  if (!v) return VERANTWORTLICHER_FEHLT;
  return [v.name, v.anschrift.replace(/\n/g, ', '), v.mail].filter(Boolean).join(', ');
}

/** Das Feld `verantwortlich` einer Verarbeitung zur Anzeige: Platzhalter → Einrichtung (oder „fehlt“), sonst wie eingetragen. */
export function verantwortlichAufloesen(feld: string | undefined, v: Verantwortlicher | null | undefined): string {
  const f = (feld ?? '').trim();
  return !f || f === VERANTWORTLICH_EINRICHTUNG ? verantwortlicherText(v) : f;
}

/** Für die Auskunft nach Art. 15 (Datei an die Person): die Angaben — oder ein deutlicher Vermerk, dass sie fehlen. */
export function verantwortlicherAuskunft(v: Verantwortlicher | null | undefined): Record<string, unknown> {
  if (!v) return { fehlt: true, hinweis: VERANTWORTLICHER_FEHLT };
  return {
    name: v.name, anschrift: v.anschrift, kontakt: v.mail, ...(v.telefon ? { telefon: v.telefon } : {}), ...(v.vertretung ? { vertretung: v.vertretung } : {}),
    ...(v.dsb?.name || v.dsb?.mail ? { datenschutzbeauftragter: { ...(v.dsb.name ? { name: v.dsb.name } : {}), ...(v.dsb.mail ? { kontakt: v.dsb.mail } : {}) } } : {}),
  };
}

// ── Empfänger und Auftragsverarbeiter ───────────────────────────────────────

const start = (e: Omit<Empfaenger, 'start' | 'avv'> & { avv?: AvvNachweis }): Empfaenger => ({ ...e, avv: e.avv ?? { status: 'offen' }, start: true });

/**
 * Vorgabe-Liste (Startwerte) — so, wie MAKE OS heute Dienste anbindet. Jede Instanz pflegt danach ihre eigene Liste
 * (bearbeiten, archivieren = nicht in Gebrauch, löschen). AVV-Status startet immer „offen“: bestätigt wird von Hand mit Tag
 * und Unterlage. Hinweis, keine Rechtsberatung — Rollen und Garantien einmal anwaltlich gegenlesen.
 */
export const EMPFAENGER_START: readonly Empfaenger[] = [
  start({ id: 'hetzner', name: 'Hetzner (Hosting)', rolle: 'auftragsverarbeiter', zweck: 'Betrieb des Servers in Deutschland, nächtliche Sicherungen, Server-Abbilder', daten: 'alle Bestände der Instanz (auf der Platte verschlüsselt), Sicherungen (verschlüsselt), Server-Protokolle (IP-Adressen)', drittland: '', garantie: 'eu', dritte: true, notiz: 'AVV in der Hetzner-Konsole abschließen und als PDF ablegen.' }),
  start({ id: 'google-workspace', name: 'Google Workspace (Kalender, Gmail)', rolle: 'auftragsverarbeiter', zweck: 'Business-Kalender und E-Mail-Postfach, Abgleich mit MAKE OS', daten: 'Termine samt Teilnehmer-Adressen, E-Mails (Absender, Empfänger, Text), Zugriffstoken', drittland: 'USA (Konzern, Unterauftragsverarbeiter)', garantie: 'dpf-scc', dritte: true, notiz: 'Datenverarbeitungszusatz (Cloud Data Processing Addendum) in der Admin-Konsole bestätigen.' }),
  start({ id: 'microsoft-365', name: 'Microsoft 365 (Postfach, Kalender)', rolle: 'auftragsverarbeiter', zweck: 'Postfach und Firmenkalender (Zulieferung über den Rechner des Inhabers bzw. Graph)', daten: 'E-Mails (Absender, Betreff, Vorschau), Termine samt Teilnehmern', drittland: 'USA (Konzern, Unterauftragsverarbeiter)', garantie: 'dpf-scc', dritte: true, notiz: 'Data Protection Addendum (DPA) im Microsoft-Kundenvertrag — Nachweis ablegen.' }),
  start({ id: 'apple-icloud', name: 'Apple iCloud (Kalender, Erinnerungen, Kontakte)', rolle: 'auftragsverarbeiter', zweck: 'Privat- und Altkalender, Erinnerungen, Adressbuch (Abgleich alle 5 Minuten)', daten: 'Termine samt Teilnehmern, Erinnerungen, Kontakte des Adressbuchs', drittland: 'USA (Konzern)', garantie: 'dpf', dritte: true, notiz: 'Für private iCloud-Konten bietet Apple keinen AVV an — Geschäftsdaten möglichst über Google Workspace bzw. Microsoft 365 führen; Entscheidung hier vermerken.' }),
  // Inbox 2 (06.10.): eigene Postfächer per IMAP/SMTP.
  start({ id: 'ionos', name: 'IONOS (E-Mail-Postfach)', rolle: 'auftragsverarbeiter', zweck: 'E-Mail-Postfach einer Gesellschaft bzw. Person — MAKE OS holt die Post per IMAP ab und sendet Antworten per SMTP (nur auf Klick)', daten: 'E-Mails (Absender, Empfänger, Betreff, Text, Anhänge), Zugangsdaten des Postfachs', drittland: '', garantie: 'eu', dritte: true, notiz: 'AVV im IONOS-Kundenbereich abschließen und als PDF ablegen.' }),
  start({ id: 'apple-icloud-mail', name: 'Apple iCloud Mail', rolle: 'auftragsverarbeiter', zweck: 'Privates E-Mail-Postfach — MAKE OS holt die Post per IMAP ab (App-spezifisches Passwort) und sendet Antworten 1:1 per SMTP (nur auf Klick)', daten: 'E-Mails (Absender, Empfänger, Betreff, Text, Anhänge)', drittland: 'USA (Konzern)', garantie: 'dpf', dritte: true, notiz: 'Für private iCloud-Konten bietet Apple keinen AVV an — nur private Post über iCloud führen; Entscheidung hier vermerken.' }),
  start({ id: 'anthropic', name: 'Anthropic (KI, ZOE)', rolle: 'auftragsverarbeiter', zweck: 'KI-Auswertung und Entwürfe (ZOE, Heads, automatische Läufe) — nur gekapselte Arbeitsfelder', daten: 'Ausschnitte aus Aufgaben, Kalender, CRM-Arbeitsfeldern, Mails (nie private Notizen, nie gesperrte Personen, IBAN maskiert)', drittland: 'USA', garantie: 'dpf-scc', dritte: true, notiz: 'Data Processing Addendum der kommerziellen Bedingungen (API) — Annahme mit Tag und Unterlage hier bestätigen.' }),
  start({ id: 'telegram', name: 'Telegram (Hinweise aufs Telefon)', rolle: 'eigener-verantwortlicher', zweck: 'Neutrale Hinweise an die Personen des Haushalts („Eine Vertragsfrist naht — Details in MAKE OS“)', daten: 'Chat-Kennung der Person, neutrale Hinweistexte ohne Namen Dritter', drittland: 'außerhalb der EU', garantie: 'keine', dritte: false, avv: { status: 'nicht-noetig' }, notiz: 'Kein AVV möglich — deshalb nie Daten Dritter in Telegram-Texten (im Code erzwungen).' }),
  start({ id: 'github', name: 'GitHub (Code, Brain-Vault, Außenprüfung)', rolle: 'auftragsverarbeiter', zweck: 'Quellcode, privates Repository des Brain-Vaults (Notizen), Außenprüfung per Actions', daten: 'Notizen des Vaults (können Personen nennen), Erreichbarkeit der App', drittland: 'USA', garantie: 'dpf-scc', dritte: true, notiz: 'GitHub Data Protection Agreement (Teil der Kundenbedingungen) — Nachweis ablegen.' }),
  start({ id: 'healthchecks', name: 'Healthchecks (Wächter der Sicherung)', rolle: 'auftragsverarbeiter', zweck: 'Alarm, wenn die nächtliche Sicherung ausbleibt (Dead-Man-Ping)', daten: 'Zeitpunkt des Pings, IP-Adresse des Servers — keine Inhalte', drittland: '', garantie: 'eu', dritte: false, notiz: 'Anbieter in der EU; AVV über die Kontoeinstellungen.' }),
  start({ id: 'newsletter', name: 'Newsletter-Werkzeug (Massenversand)', rolle: 'auftragsverarbeiter', zweck: 'Versand von Newslettern und Kampagnen an Personen mit Einwilligung (Double-Opt-in)', daten: 'Name, E-Mail, Einwilligungs-Nachweis, Öffnungen/Klicks', drittland: '', garantie: 'eu', dritte: true, archiviert: true, notiz: 'Noch nicht in Gebrauch: Anbieter wählen (EU bevorzugt), AVV vor dem ersten Versand — dann „Zurückholen“.' }),
  start({ id: 'whoop', name: 'WHOOP (Gesundheitswerte)', rolle: 'eigener-verantwortlicher', zweck: 'Die Person verbindet ihr eigenes WHOOP-Konto; MAKE OS holt ihre Werte ab', daten: 'Gesundheitsdaten der Person selbst (Art. 9): Erholung, Schlaf, Belastung', drittland: 'USA', garantie: 'dpf', dritte: false, avv: { status: 'nicht-noetig' }, notiz: 'Eigener Vertrag der Person mit WHOOP; Abholen nur mit ihrer Verbindung (Einwilligung, Art. 9 Abs. 2 lit. a).' }),
];

/** Die wirksame Liste: gespeichert oder die Vorgabe. */
export const empfaengerWirksam = (e: DatenschutzEinrichtung | null | undefined): Empfaenger[] => (Array.isArray(e?.empfaenger) ? e!.empfaenger! : EMPFAENGER_START.map(x => ({ ...x })));

const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ROLLE_IDS = new Set(ROLLEN.map(r => r.id));
const GARANTIE_IDS = new Set(GARANTIEN.map(g => g.id));

/** Einen Eintrag prüfen und säubern. */
export function empfaengerPruefen(roh: unknown): { ok: true; e: Empfaenger } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'Empfänger: Objekt erwartet.' };
  const r = roh as Record<string, unknown>;
  const id = zeile(r.id, 41);
  if (!ID.test(id)) return { ok: false, fehler: 'Kennung: 2–41 Zeichen a–z, 0–9, Bindestrich.' };
  const name = zeile(r.name, 120);
  if (name.length < 2 || name.length > 120) return { ok: false, fehler: 'Name: 2–120 Zeichen.' };
  const rolle = String(r.rolle ?? '') as EmpfaengerRolle;
  if (!ROLLE_IDS.has(rolle)) return { ok: false, fehler: 'Rolle unbekannt.' };
  const garantie = String(r.garantie ?? 'eu') as Garantie;
  if (!GARANTIE_IDS.has(garantie)) return { ok: false, fehler: 'Garantie unbekannt.' };
  const zweck = zeile(r.zweck, 400), daten = zeile(r.daten, 400), drittland = zeile(r.drittland, 120), notiz = zeile(r.notiz, 600);
  if (zweck.length > 400 || daten.length > 400 || drittland.length > 120 || notiz.length > 600) return { ok: false, fehler: 'Ein Text ist zu lang (Zweck/Daten 400, Drittland 120, Notiz 600 Zeichen).' };
  const a = r.avv && typeof r.avv === 'object' ? r.avv as Record<string, unknown> : {};
  const status = (['offen', 'bestaetigt', 'nicht-noetig'] as const).find(s => s === a.status) ?? 'offen';
  const am = zeile(a.am, 10), unterlage = zeile(a.unterlage, 300);
  if (status === 'bestaetigt' && !TAG.test(am)) return { ok: false, fehler: 'AVV bestätigt: Tag der Bestätigung (JJJJ-MM-TT) fehlt.' };
  if (am && !TAG.test(am)) return { ok: false, fehler: 'AVV: Tag als JJJJ-MM-TT.' };
  if (unterlage.length > 300) return { ok: false, fehler: 'Unterlage: höchstens 300 Zeichen.' };
  if (rolle === 'auftragsverarbeiter' && status === 'nicht-noetig') return { ok: false, fehler: 'Ein Auftragsverarbeiter braucht einen AVV (Art. 28 Abs. 3) — Status „offen“ oder „bestätigt“.' };
  const avv: AvvNachweis = { status, ...(status === 'bestaetigt' && am ? { am } : {}), ...(status === 'bestaetigt' && unterlage ? { unterlage } : {}) };
  return { ok: true, e: { id, name, rolle, zweck, daten, drittland, garantie: drittland ? garantie : 'eu', avv, ...(notiz ? { notiz } : {}), dritte: r.dritte === true, ...(r.archiviert === true ? { archiviert: true } : {}), ...(r.start === true ? { start: true } : {}) } };
}

/** Text des AVV-Status: „bestätigt am 05.10.2026 (Unterlage)“ · „offen“ · „nicht nötig“. */
export function avvText(a: AvvNachweis): string {
  if (a.status === 'bestaetigt') return `bestätigt am ${a.am ? `${a.am.slice(8, 10)}.${a.am.slice(5, 7)}.${a.am.slice(0, 4)}` : '?'}${a.unterlage ? ` (${a.unterlage})` : ''}`;
  return a.status === 'nicht-noetig' ? 'nicht nötig' : 'offen';
}
export const garantieText = (g: Garantie): string => GARANTIEN.find(x => x.id === g)?.label ?? g;
export const rolleText = (r: EmpfaengerRolle): string => ROLLEN.find(x => x.id === r)?.label ?? r;

/** Auftragsverarbeiter in Gebrauch, deren AVV noch nicht bestätigt ist. */
export const avvOffen = (liste: readonly Empfaenger[]): Empfaenger[] => liste.filter(e => !e.archiviert && e.rolle === 'auftragsverarbeiter' && e.avv.status !== 'bestaetigt');
/** In Gebrauch, mit Daten Dritter, in einem Drittland ohne Garantie. */
export const drittlandOhneGarantie = (liste: readonly Empfaenger[]): Empfaenger[] => liste.filter(e => !e.archiviert && e.dritte && !!e.drittland && (e.garantie === 'keine' || e.garantie === 'eu'));

/** Für die Auskunft nach Art. 15 Abs. 1 lit. c: Empfänger in Gebrauch, bei denen Daten Dritter ankommen (ohne interne Notizen). */
export function empfaengerAuskunft(liste: readonly Empfaenger[]): { name: string; rolle: string; zweck: string; drittland: string | null; garantie: string | null }[] {
  return liste.filter(e => !e.archiviert && e.dritte).map(e => ({ name: e.name, rolle: rolleText(e.rolle), zweck: e.zweck, drittland: e.drittland || null, garantie: e.drittland ? garantieText(e.garantie) : null }));
}

/** Einen Eintrag einfügen oder ersetzen (nach `id`); die Reihenfolge bleibt. */
export function empfaengerSetzen(liste: readonly Empfaenger[], e: Empfaenger, jetzt: string): Empfaenger[] {
  const neu = { ...e, geaendert: jetzt };
  const i = liste.findIndex(x => x.id === e.id);
  if (i < 0) return [...liste, neu];
  const raus = [...liste]; raus[i] = { ...neu, ...(liste[i].start ? { start: true } : {}) };
  return raus;
}

/** Archivieren (nicht in Gebrauch) bzw. zurückholen — ohne `archiviert: false` im Bestand. */
export function empfaengerArchivieren(liste: readonly Empfaenger[], id: string, an: boolean, jetzt: string): Empfaenger[] {
  return liste.map(x => {
    if (x.id !== id) return x;
    const { archiviert: _alt, ...rest } = x;
    return { ...rest, ...(an ? { archiviert: true } : {}), geaendert: jetzt };
  });
}
