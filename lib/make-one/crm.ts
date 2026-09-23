// ─── MAKE OS — CRM: die Regeln hinter der Kundenansprache ───────────────────
// Kevins Ansage vom 18.09.: „Lass uns das CRM System bauen damit wir Kunden
// ansprechen können." Das Wort ist ANSPRECHEN. Ein CRM, das nur Kontakte
// verwaltet, ist eine Adressliste. Dieses hier beantwortet jeden Morgen eine
// Frage: Wer ist heute dran, und warum?
//
// Quelle ist Kevins fertig angereicherte Masterliste (443 Kontakte, 40
// Spalten, Stand 28.08.). Sie wird IMPORTIERT, nicht gespiegelt: die Felder
// aus der Liste kommen herein, die Pipeline (Stufe, Wiedervorlage,
// Aktivitäten) lebt nur hier. Ein erneuter Import frischt die Stammdaten auf
// und rührt die Pipeline nicht an — sonst würde jeder Abgleich mit der
// Excel-Datei die Arbeit einer Woche löschen.
//
// Alles hier ist reine Logik in einer .ts-Datei, damit vitest es prüfen kann.
// Nichts sendet. Versand bleibt bei Kevin — das ist eiserne Regel 3.

export const STUFEN = [
  'neu', 'ansprechen', 'angesprochen', 'gespraech', 'termin', 'angebot',
  'gewonnen', 'verloren', 'ruht',
] as const;
export type Stufe = typeof STUFEN[number];

export const STUFE_LABEL: Record<Stufe, string> = {
  neu: 'Neu', ansprechen: 'Ansprechen', angesprochen: 'Angesprochen', gespraech: 'Im Gespräch',
  termin: 'Termin', angebot: 'Angebot', gewonnen: 'Gewonnen', verloren: 'Verloren', ruht: 'Ruht',
};

/** Stufen, in denen ein Kontakt für die Tagesliste nicht mehr in Frage kommt. */
export const ABGESCHLOSSEN: readonly Stufe[] = ['gewonnen', 'verloren', 'ruht'];

export type AktivitaetArt = 'mail' | 'linkedin' | 'anruf' | 'antwort' | 'termin' | 'notiz' | 'stufe';
export interface Aktivitaet {
  am: string;
  art: AktivitaetArt;
  text?: string;
  von: string;
}

export type Prio = 'A' | 'B' | 'C' | '';
export type Eignung = 'ja' | 'vielleicht' | 'nein' | '';

export interface Kontakt {
  id: string;
  // ── Person ──
  vorname: string;
  nachname: string;
  email?: string;
  telefon?: string;
  sms?: string;
  jobtitel?: string;
  position?: string;
  senioritaet?: string;
  linkedin?: string;
  personInfo?: string;
  // ── Firma ──
  firma?: string;
  firmaDomain?: string;
  firmaWebseite?: string;
  firmaBranche?: string;
  firmaMitarbeiter?: string;
  firmaUmsatz?: string;
  firmaStadt?: string;
  firmaGegruendet?: string;
  firmaLinkedin?: string;
  firmaTelefon?: string;
  firmaEmail?: string;
  marktinfo?: string;
  signale?: string;
  kiBezug?: string;
  // ── Klassifikation (aus der Anreicherung) ──
  typ?: string;
  eignung: Eignung;
  prio: Prio;
  aufhaenger?: string;
  kategorie?: string;
  owner?: string;
  lifecycle?: string;
  quelle?: string;
  recherche?: string;
  notiz?: string;
  hubspotId?: string;
  steckbrief?: string;
  // ── Pipeline (lebt nur hier) ──
  stufe: Stufe;
  wiedervorlage?: string;
  letzterKontakt?: string;
  aktivitaeten: Aktivitaet[];
  importiertAm: string;
  geaendertAm: string;
}

/** Felder, die der Import NIE anfasst — das ist die Arbeit im CRM. */
const PIPELINE_FELDER: (keyof Kontakt)[] = ['stufe', 'wiedervorlage', 'letzterKontakt', 'aktivitaeten', 'importiertAm'];

const s = (v: unknown, n = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9äöüß@.]/g, '');

/**
 * Der Schlüssel, unter dem ein Kontakt wiedererkannt wird.
 *
 * Reihenfolge: E-Mail vor HubSpot-ID vor Name+Firma. E-Mail ist am stabilsten;
 * die HubSpot-ID kennt nur der HubSpot-Teil der Liste; Name+Firma ist der
 * Notnagel für die 324 Kontakte ohne Mail. Ohne diesen Schlüssel würde jeder
 * Import 443 neue Einträge anlegen.
 */
export function schluessel(k: { email?: string; hubspotId?: string; vorname?: string; nachname?: string; firma?: string }): string {
  const mail = norm(k.email ?? '');
  if (mail.includes('@')) return `m:${mail}`;
  if ((k.hubspotId ?? '').trim()) return `h:${norm(k.hubspotId!)}`;
  return `n:${norm(`${k.vorname ?? ''}${k.nachname ?? ''}`)}|${norm(k.firma ?? '')}`;
}

function prioAus(v: string): Prio {
  const p = v.trim().toUpperCase().charAt(0);
  return p === 'A' || p === 'B' || p === 'C' ? p : '';
}
function eignungAus(v: string): Eignung {
  const e = v.trim().toLowerCase();
  return e === 'ja' || e === 'vielleicht' || e === 'nein' ? e : '';
}

/**
 * Die Stufe beim ersten Import. Die Liste hat kaum Pipeline-Information
 * (LEAD_STATUS bei 11 von 443) — deshalb wird aus dem Wenigen abgeleitet,
 * das da ist, und der Rest startet bei „neu". Das ist ehrlich: niemand hat
 * diese Leute bisher aus dem CRM heraus angesprochen.
 */
export function stufeAusImport(zeile: Record<string, string>): Stufe {
  const status = s(zeile.LEAD_STATUS).toUpperCase();
  if (status === 'OPEN_DEAL') return 'angebot';
  if (status === 'IN_PROGRESS') return 'gespraech';
  if (s(zeile.LIFECYCLE).toLowerCase() === 'opportunity') return 'gespraech';
  return 'neu';
}

/** Eine Zeile der Masterliste wird ein Kontakt. Spaltennamen sind die der Datei. */
export function ausZeile(z: Record<string, string>, heute: string): Kontakt {
  const k: Kontakt = {
    id: '',
    vorname: s(z.VORNAME, 80), nachname: s(z.NACHNAME, 80),
    email: s(z.EMAIL, 160).toLowerCase() || undefined,
    telefon: s(z.TELEFON, 60) || undefined, sms: s(z.SMS, 60) || undefined,
    jobtitel: s(z.JOBTITEL, 120) || undefined, position: s(z.POSITION_AKTUELL, 160) || undefined,
    senioritaet: s(z.SENIORITAET, 60) || undefined, linkedin: s(z.LINKEDIN, 200) || undefined,
    personInfo: s(z.PERSON_INFO, 800) || undefined,
    firma: s(z.FIRMA, 160) || undefined, firmaDomain: s(z.FIRMA_DOMAIN, 120) || undefined,
    firmaWebseite: s(z.FIRMA_WEBSEITE, 200) || undefined, firmaBranche: s(z.FIRMA_BRANCHE, 120) || undefined,
    firmaMitarbeiter: s(z.FIRMA_MITARBEITER, 40) || undefined, firmaUmsatz: s(z.FIRMA_UMSATZ, 60) || undefined,
    firmaStadt: s(z.FIRMA_STADT, 80) || undefined, firmaGegruendet: s(z.FIRMA_GEGRUENDET, 20) || undefined,
    firmaLinkedin: s(z.FIRMA_LINKEDIN, 200) || undefined, firmaTelefon: s(z.FIRMA_TELEFON, 60) || undefined,
    firmaEmail: s(z.FIRMA_EMAIL, 160) || undefined,
    marktinfo: s(z.MARKTINFO, 800) || undefined, signale: s(z.SIGNALE, 600) || undefined,
    kiBezug: s(z.KI_BEZUG, 400) || undefined,
    typ: s(z.KONTAKT_TYP, 40) || undefined, eignung: eignungAus(s(z.VERTRIEBS_EIGNUNG)), prio: prioAus(s(z.PRIORITAET)),
    aufhaenger: s(z.GESPRAECHSAUFHAENGER, 600) || undefined,
    kategorie: s(z.KATEGORIE, 80) || undefined, owner: s(z.OWNER, 60) || undefined,
    lifecycle: s(z.LIFECYCLE, 40) || undefined, quelle: s(z.QUELLE, 120) || undefined,
    recherche: s(z.STATUS_RECHERCHE, 60) || undefined, notiz: s(z.KEVIN_NOTIZ, 800) || undefined,
    hubspotId: s(z.HUBSPOT_ID, 40) || undefined, steckbrief: s(z.STECKBRIEF, 400) || undefined,
    stufe: stufeAusImport(z),
    letzterKontakt: s(z.LETZTER_KONTAKT, 20) || undefined,
    aktivitaeten: [],
    importiertAm: heute, geaendertAm: heute,
  };
  k.id = 'c-' + schluessel(k).replace(/[^a-z0-9]/g, '').slice(0, 40) + '-' + kurzHash(schluessel(k));
  return k;
}

/** Kleiner, deterministischer Hash — damit die ID stabil bleibt und lesbar ist. */
function kurzHash(t: string): string {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).slice(0, 6);
}

/**
 * Bestehenden Kontakt mit frischen Stammdaten zusammenführen.
 * Die Pipeline-Felder bleiben, wie sie sind. Leere Felder im Import
 * überschreiben keine gefüllten — eine Excel-Zeile mit gelöschter Notiz soll
 * nicht die Notiz im CRM löschen.
 */
export function zusammenfuehren(alt: Kontakt, neu: Kontakt, heute: string): { kontakt: Kontakt; geaendert: boolean } {
  const out: Kontakt = { ...alt };
  let geaendert = false;
  for (const f of Object.keys(neu) as (keyof Kontakt)[]) {
    if (PIPELINE_FELDER.includes(f) || f === 'id' || f === 'geaendertAm') continue;
    const v = neu[f];
    if (v === undefined || v === '' ) continue;
    if (JSON.stringify(out[f]) !== JSON.stringify(v)) { (out as unknown as Record<string, unknown>)[f] = v; geaendert = true; }
  }
  if (geaendert) out.geaendertAm = heute;
  return { kontakt: out, geaendert };
}

export interface ImportErgebnis { kontakte: Kontakt[]; neu: number; aktualisiert: number; unveraendert: number }

/** Ein Import über den ganzen Bestand — idempotent: zweimal laufen ändert nichts. */
export function importieren(bestand: Kontakt[], zeilen: Record<string, string>[], heute: string): ImportErgebnis {
  const nachSchluessel = new Map(bestand.map(k => [schluessel(k), k]));
  let neu = 0, aktualisiert = 0, unveraendert = 0;
  for (const z of zeilen) {
    const k = ausZeile(z, heute);
    if (!k.vorname && !k.nachname && !k.firma) continue;   // leere Zeile
    const key = schluessel(k);
    const alt = nachSchluessel.get(key);
    if (!alt) { nachSchluessel.set(key, k); neu++; continue; }
    const r = zusammenfuehren(alt, k, heute);
    nachSchluessel.set(key, r.kontakt);
    if (r.geaendert) aktualisiert++; else unveraendert++;
  }
  return { kontakte: Array.from(nachSchluessel.values()), neu, aktualisiert, unveraendert };
}

// ── Die Tagesliste ──────────────────────────────────────────────────────────

export interface Kanal { art: 'mail' | 'linkedin' | 'anruf'; ziel: string }

/** Über welche Wege der Kontakt erreichbar ist — in der Reihenfolge, in der
 *  Kevin sie nutzen sollte. LinkedIn zuerst bei kaltem Kontakt (§7 UWG),
 *  Mail zuerst, wenn es schon einen Draht gibt. */
export function kanaele(k: Kontakt): Kanal[] {
  const warm = k.stufe !== 'neu' && k.stufe !== 'ansprechen' || (k.kategorie ?? '').startsWith('Apple') || k.typ === 'Netzwerk';
  const l: Kanal[] = [];
  if (k.linkedin) l.push({ art: 'linkedin', ziel: k.linkedin });
  if (k.email) l.push({ art: 'mail', ziel: k.email });
  if (k.telefon || k.sms) l.push({ art: 'anruf', ziel: (k.telefon ?? k.sms)! });
  if (warm && k.email) { const i = l.findIndex(x => x.art === 'mail'); if (i > 0) l.unshift(...l.splice(i, 1)); }
  return l;
}

/** Ansprechbar = es gibt einen Weg UND einen Grund. Ohne Aufhänger wäre die
 *  Ansprache Kaltakquise ohne Anlass, und die macht Kevin nicht. */
export function ansprechbar(k: Kontakt): boolean {
  return kanaele(k).length > 0 && !!(k.aufhaenger ?? '').trim();
}

const PRIO_RANG: Record<Prio, number> = { A: 0, B: 1, C: 2, '': 3 };
const EIGNUNG_RANG: Record<Eignung, number> = { ja: 0, vielleicht: 1, '': 2, nein: 3 };

export interface Tagesposten { kontakt: Kontakt; grund: string }

/**
 * Wer ist heute dran?
 *
 * 1. Fällige Wiedervorlagen — ein Versprechen an den Kontakt geht vor.
 * 2. Prio A, ansprechbar, noch nicht angesprochen — nach Vertriebseignung.
 * 3. Prio B, dito.
 * Abgeschlossene bleiben draußen, „Dienstleister" und „Investor" auch — die
 * sind Kontakte, keine Kunden.
 */
export function tagesliste(kontakte: Kontakt[], heute: string, n = 10): Tagesposten[] {
  const offen = kontakte.filter(k => !ABGESCHLOSSEN.includes(k.stufe));
  const faellig = offen
    .filter(k => k.wiedervorlage && k.wiedervorlage <= heute)
    .sort((a, b) => (a.wiedervorlage! < b.wiedervorlage! ? -1 : 1))
    .map(k => ({ kontakt: k, grund: k.wiedervorlage! < heute ? `Wiedervorlage überfällig seit ${k.wiedervorlage}` : 'Wiedervorlage heute' }));
  const schonDrin = new Set(faellig.map(p => p.kontakt.id));
  const frisch = offen
    .filter(k => !schonDrin.has(k.id))
    .filter(k => (k.stufe === 'neu' || k.stufe === 'ansprechen') && ansprechbar(k))
    .filter(k => k.typ !== 'Dienstleister' && k.typ !== 'Investor')
    .filter(k => k.prio === 'A' || k.prio === 'B')
    .sort((a, b) =>
      PRIO_RANG[a.prio] - PRIO_RANG[b.prio]
      || EIGNUNG_RANG[a.eignung] - EIGNUNG_RANG[b.eignung]
      || (a.nachname || '').localeCompare(b.nachname || ''))
    .map(k => ({ kontakt: k, grund: `Prio ${k.prio}${k.eignung ? ` · Eignung ${k.eignung}` : ''} · noch nicht angesprochen` }));
  return [...faellig, ...frisch].slice(0, n);
}

/**
 * Wann der Kontakt wieder auf die Liste soll, nachdem etwas passiert ist.
 * Nach einer Ansprache fünf Tage — kürzer wirkt drängend, länger vergisst man
 * es. Nach einer Antwort oder einem Termin entscheidet Kevin selbst.
 */
export function wiedervorlageNach(art: AktivitaetArt, heute: string, tagePlus: (d: string, n: number) => string): string | undefined {
  if (art === 'mail' || art === 'linkedin') return tagePlus(heute, 5);
  if (art === 'anruf') return tagePlus(heute, 3);
  return undefined;
}

/** Welche Stufe eine Aktivität nach sich zieht — nur vorwärts, nie zurück. */
export function stufeNach(art: AktivitaetArt, aktuell: Stufe): Stufe {
  const rang = (st: Stufe) => STUFEN.indexOf(st);
  let ziel: Stufe = aktuell;
  if (art === 'mail' || art === 'linkedin' || art === 'anruf') ziel = 'angesprochen';
  if (art === 'antwort') ziel = 'gespraech';
  if (art === 'termin') ziel = 'termin';
  return rang(ziel) > rang(aktuell) && !ABGESCHLOSSEN.includes(aktuell) ? ziel : aktuell;
}

/**
 * Massen-Wache für Stufen — dieselbe Lehre wie bei den Aufgaben am 06.09.:
 * mehr als zwölf Kontakte auf einmal in eine andere Stufe zu schieben ist
 * nie ein Klick, sondern ein Fehler.
 */
export const MASSEN_GRENZE = 12;
export function massenStufe(alt: Kontakt[], neu: Kontakt[]): number {
  const vorher = new Map(alt.map(k => [k.id, k.stufe]));
  return neu.filter(k => vorher.has(k.id) && vorher.get(k.id) !== k.stufe).length;
}

/** Zusammenfassung für Jarvis und die Kopfzeile. */
export function pipelineStand(kontakte: Kontakt[]): Record<Stufe, number> & { gesamt: number; ansprechbar: number } {
  const r = Object.fromEntries(STUFEN.map(st => [st, 0])) as Record<Stufe, number>;
  for (const k of kontakte) r[k.stufe] = (r[k.stufe] ?? 0) + 1;
  return { ...r, gesamt: kontakte.length, ansprechbar: kontakte.filter(k => !ABGESCHLOSSEN.includes(k.stufe) && ansprechbar(k)).length };
}

/** Anzeigename — nie leer, damit keine Zeile ohne Namen dasteht. */
export function anzeigename(k: Pick<Kontakt, 'vorname' | 'nachname' | 'firma' | 'email'>): string {
  const n = `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim();
  return n || k.firma || k.email || 'Unbekannt';
}

/**
 * Einen Kontakt aus dem Netz prüfen. Alles, was nicht passt, fällt weg —
 * unbekannte Stufen, überlange Texte, fremde Felder. Was durchkommt, ist
 * genau das, was auch der Import erzeugt hätte.
 */
export function saeubereKontakt(e: unknown): Kontakt | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  if (!/^c-[a-z0-9-]{4,60}$/.test(id)) return null;
  const st = String(o.stufe ?? 'neu') as Stufe;
  if (!STUFEN.includes(st)) return null;
  const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const txt = (v: unknown, n: number) => { const t = String(v ?? '').trim().slice(0, n); return t || undefined; };
  const akt = Array.isArray(o.aktivitaeten) ? (o.aktivitaeten as unknown[]).slice(0, 400).map(a => {
    const x = (a ?? {}) as Record<string, unknown>;
    const art = String(x.art ?? '') as AktivitaetArt;
    if (!['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'stufe'].includes(art)) return null;
    const von = ['kevin', 'malin', 'jarvis'].includes(String(x.von)) ? (String(x.von) as Aktivitaet['von']) : 'kevin';
    return { am: String(x.am ?? '').slice(0, 25), art, ...(txt(x.text, 1200) ? { text: txt(x.text, 1200) } : {}), von } as Aktivitaet;
  }).filter((a): a is Aktivitaet => !!a) : [];
  const k: Kontakt = {
    id, vorname: String(o.vorname ?? '').trim().slice(0, 80), nachname: String(o.nachname ?? '').trim().slice(0, 80),
    email: txt(o.email, 160)?.toLowerCase(), telefon: txt(o.telefon, 60), sms: txt(o.sms, 60),
    jobtitel: txt(o.jobtitel, 120), position: txt(o.position, 160), senioritaet: txt(o.senioritaet, 60),
    linkedin: txt(o.linkedin, 200), personInfo: txt(o.personInfo, 800),
    firma: txt(o.firma, 160), firmaDomain: txt(o.firmaDomain, 120), firmaWebseite: txt(o.firmaWebseite, 200),
    firmaBranche: txt(o.firmaBranche, 120), firmaMitarbeiter: txt(o.firmaMitarbeiter, 40), firmaUmsatz: txt(o.firmaUmsatz, 60),
    firmaStadt: txt(o.firmaStadt, 80), firmaGegruendet: txt(o.firmaGegruendet, 20), firmaLinkedin: txt(o.firmaLinkedin, 200),
    firmaTelefon: txt(o.firmaTelefon, 60), firmaEmail: txt(o.firmaEmail, 160),
    marktinfo: txt(o.marktinfo, 800), signale: txt(o.signale, 600), kiBezug: txt(o.kiBezug, 400),
    typ: txt(o.typ, 40), eignung: (['ja', 'vielleicht', 'nein'].includes(String(o.eignung)) ? String(o.eignung) : '') as Eignung,
    prio: (['A', 'B', 'C'].includes(String(o.prio)) ? String(o.prio) : '') as Prio,
    aufhaenger: txt(o.aufhaenger, 600), kategorie: txt(o.kategorie, 80), owner: txt(o.owner, 60),
    lifecycle: txt(o.lifecycle, 40), quelle: txt(o.quelle, 120), recherche: txt(o.recherche, 60),
    notiz: txt(o.notiz, 2000), hubspotId: txt(o.hubspotId, 40), steckbrief: txt(o.steckbrief, 400),
    stufe: st, wiedervorlage: tag(o.wiedervorlage), letzterKontakt: tag(o.letzterKontakt),
    aktivitaeten: akt,
    importiertAm: String(o.importiertAm ?? '').slice(0, 10) || '', geaendertAm: String(o.geaendertAm ?? '').slice(0, 10) || '',
  };
  if (!k.vorname && !k.nachname && !k.firma) return null;
  return k;
}

export interface AktivitaetEingabe {
  art: AktivitaetArt;
  text?: string;
  von: Aktivitaet['von'];
  /** Ausdrückliche Stufe gewinnt über die Regel. */
  stufe?: Stufe;
  wiedervorlage?: string;
}

/**
 * Eine Aktivität auf einen Kontakt anwenden — die eine Stelle, an der die
 * Regeln zusammenkommen: protokollieren, letzter Kontakt, Stufe vorwärts,
 * Wiedervorlage. Route und Jarvis-Werkzeug rufen beide genau das hier.
 */
export function wendeAktivitaetAn(
  k: Kontakt, e: AktivitaetEingabe, heute: string, jetztIso: string,
  tagePlus: (d: string, n: number) => string,
): Kontakt {
  const out: Kontakt = { ...k, aktivitaeten: [...(k.aktivitaeten ?? []), { am: jetztIso, art: e.art, ...(e.text ? { text: e.text } : {}), von: e.von }] };
  if (e.art !== 'notiz' && e.art !== 'stufe') out.letzterKontakt = heute;
  out.stufe = e.stufe ?? stufeNach(e.art, k.stufe);
  const wv = e.wiedervorlage ?? wiedervorlageNach(e.art, heute, tagePlus);
  if (wv) out.wiedervorlage = wv;
  else if (e.art === 'antwort' || e.art === 'termin') out.wiedervorlage = undefined;
  out.geaendertAm = heute;
  return out;
}

/** Kontakt nach Name, Firma, Mail oder Branche finden — für Jarvis und die Suche. */
export function findeKontakte(kontakte: Kontakt[], frage: string, n = 5): Kontakt[] {
  const w = frage.toLowerCase().split(/\s+/).filter(Boolean);
  if (!w.length) return [];
  const punkte = (k: Kontakt) => {
    const name = anzeigename(k).toLowerCase();
    const felder = [name, k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? ''].map(x => x.toLowerCase());
    let p = 0;
    for (const t of w) {
      if (name.includes(t)) p += 6;
      if ((k.firma ?? '').toLowerCase().includes(t)) p += 5;
      if ((k.email ?? '').includes(t)) p += 5;
      if (felder.some(f => f.includes(t))) p += 1;
    }
    return p;
  };
  return kontakte.map(k => ({ k, p: punkte(k) })).filter(x => x.p > 0)
    .sort((a, b) => b.p - a.p || PRIO_RANG[a.k.prio] - PRIO_RANG[b.k.prio]).slice(0, n).map(x => x.k);
}
