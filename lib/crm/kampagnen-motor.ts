// ─── Kampagnen-Motor (Server, 31.10., Welle A · KUNDENGEWINNUNG_PLAN.md › S3) ───────────────────────────────────────────────────────
// Kevin 31.10.: „maximal automatisiert und klug — und sauber“. Der Motor taktet die Sequenz je Ziel (lib/crm/sequenz.ts) und erzeugt, was der Schritt
// braucht — ohne je etwas ohne Klick nach außen zu geben (Eiserne Regel 3):
//   · Mail     → Entwurf je Ziel im Mail-Stapel (Bestand `kampagnen-post--<haushalt>`), freigegeben mit EINEM Klick je Stapel (Einzel-Häkchen) per
//                Sitzung (`stapelFreigeben`; ZOE/Dienstweg nie). Danach sendet der Takt gedrosselt (werktags 8–18 Uhr, ≤ Tagesgrenze je Postfach) über
//                dieselbe Sendestelle wie die Inbox (`inboxSenden`) — im Namen der freigebenden Person und ihres Postfachs, mit Abmeldelink im Text,
//                `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058), Absender-/Impressumszeile und Art.-14-Hinweis bei Fremddaten.
//   · Anruf · LinkedIn · Besuch → ein ECHTES Follow-up (`fu-ks-…`, Quelle „kampagne“, Leitfaden in der Notiz) — so stehen sie in der einen Fälligkeitsliste
//                (lib/crm/followup.ts), in der Power Hour (Ergebnis-Knöpfe) und in der Glocke, ohne zweiten Weg; erledigt/abgesagt schaltet weiter.
//   · Brief    → Zeile der Druckliste (derselbe Bestand, Kanal „brief“); „gedruckt“ per Klick schaltet weiter. Serienbrief-PDF: noch nicht.
// Rückfluss (im Takt, idempotent): Antwort vom Ziel (gleiche Adresse/Thread im Gmail-/IMAP-Spiegel der sendenden Person) → „reagiert“, Sequenz stoppt,
// Follow-up „Antwort bearbeiten“; Rückläufer → Adresse ungültig, Sequenz stoppt, Follow-up „Adresse prüfen“; Abmeldelink (lib/datenschutz/abmelden-
// server.ts: Werbesperre an Person bzw. Firma + Sperrliste dort, dann `kampagnenAbmeldung`) → Stopp. Kein Öffnungs-Tracking.
// Leitplanken hart: Art. 18, Werbesperre, Sperrliste → nie im Stapel; Kanal-Ampel rot → nicht im Stapel, AUSSER das Playbook steht in
// `RISIKO_PLAYBOOKS` — dann nur, solange ein Inhaber „eigenes Risiko“ eingeschaltet hat (DERSELBE Schalter wie die Homepage-Funde: Bestand
// `kampagne-funde--<haushalt>` › einstellungen.eigenesRisiko, lib/funde/einrichten.ts `risikoSetzen`). Jeder solche Stapel trägt sichtbar
// „auf eigenes Risiko freigegeben von … am …“. Ohne diesen Modus sperrt eine rote Ampel mit werblichen Wörtern den Versand (nicht nur Rückfrage).

import { createHash, randomBytes } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagePlus, tagVon } from '@/lib/zeit';
import { karteiHaushalt, sperrlisteLaden, sperrPruefer, type SperrEintrag } from './sperrliste';
import { betriebGesperrt } from './betrieb-sperre';
import { ladeCrm, aendereCrm } from './speicher';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { aendereKontakte } from './kartei-schreiben';
import { kanalStatus, firmaKanalStatus, type Kanal, type KanalStatus } from './recht';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { personenDerFirma } from './stationen';
import { ausgenommen } from './einschraenkung';
import { neuesFollowUp } from './followup';
import { zustaendig, nameVon, BEIDE } from './team';
import { weltDerKampagne } from './kampagnen-welt';
import { beenden, erledigtUndBeenden, faelligeStaende, istEnde, schrittVon, staendeStarten, standErsetzen, wartet, weiter, zieleDerKampagne, gleichesZiel, zielSchluessel } from './sequenz';
import {
  antwortFollowupId, bounceFollowupId, einstellungenSaeubern, entwurfFuellen, FUND_SCHRITT, imZeitfenster, JE_LAUF_MAX, mailFertig, platzhalterWerte, postEintragId, POST_GRENZEN,
  rueckflussArt, SENDET_HAENGT_MS, sequenzFollowupId, zaehlerSchluessel, ART14_VORGABE, ERSTANSPRACHE_SPERRE_TAGE, sendefehlerArt, stundenKontingent, berlinStunde, rueckoffMs, VERSUCHE_MAX,
  type MotorEinstellungen, type PostEintrag, type RueckKopf,
} from './kampagnen-post';
import type { CrmBestand, FollowUp, FollowUpArt, Kampagne, KampagnenZiel, SequenzSchritt } from './typen';

// ── Bestand ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PostBestand {
  eintraege: PostEintrag[];
  einstellungen: MotorEinstellungen;
  /** Zähler der Tagesgrenze `tag|person|postfach` → Anzahl (nur die letzten 7 Tage). */
  tage: Record<string, number>;
  /** Fingerabdrücke unzustellbarer Adressen (Rückläufer) — nie Klartext. */
  ungueltig: string[];
  /** Willkommensstrecke: je Kontakt der Start und die gesendeten Stufen (Kennung + Tag), nie Text. */
  willkommen: Record<string, WillkommenEintrag>;
  /** Glocken, die je Tag nur einmal kommen (B-Prüfung, 02.11.): Schlüssel → Tag (YYYY-MM-DD). Nur Kennungen. */
  gemeldet: Record<string, string>;
  /** Willkommensstrecke (B-Prüfung, 02.11.): Stand des letzten Laufs — warum sie nichts tut bzw. wie viele Versuche scheiterten. Nur Zähler/Gründe. */
  willkommenLauf?: { am: string; grund?: string; gesendet: number; gescheitert: number };
}
/** Je Kontakt: Start, gesendete Stufen; seit 02.11. auch gescheiterte Stufen (nie automatisch noch einmal) und die gesendeten Mails (Rückfluss). */
export interface WillkommenEintrag {
  start: string;
  gesendet: number[];
  gescheitert?: { stufe: number; am: string; grund: string }[];
  /** Stufen, die jemand nach einem Fehlschlag in der Karte übersprungen hat (R2-4 Fund 5) — gelten als erledigt. */
  uebersprungen?: number[];
  mails?: { stufe: number; am: string; id?: string; threadId?: string; messageId?: string; von?: string; rueckfluss?: { art: 'antwort' | 'bounce'; am: string } }[];
}
export const kampagnenPostName = (h: string): string => `kampagnen-post--${h}`;
const leer = (): PostBestand => ({ eintraege: [], einstellungen: einstellungenSaeubern({}), tage: {}, ungueltig: [], willkommen: {}, gemeldet: {} });

export class MotorFehler extends Error {
  constructor(public status: 400 | 403 | 404 | 409 | 413, text: string) { super(text); }
}

function saeubern(roh: unknown): PostBestand {
  const o = roh && typeof roh === 'object' ? roh as Partial<PostBestand> : {};
  return {
    eintraege: Array.isArray(o.eintraege) ? o.eintraege.filter((e): e is PostEintrag => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.kampagneId === 'string') : [],
    einstellungen: einstellungenSaeubern(o.einstellungen),
    tage: o.tage && typeof o.tage === 'object' ? Object.fromEntries(Object.entries(o.tage).filter(([, n]) => Number.isInteger(n))) : {},
    ungueltig: Array.isArray(o.ungueltig) ? o.ungueltig.filter((x): x is string => typeof x === 'string') : [],
    willkommen: o.willkommen && typeof o.willkommen === 'object' ? o.willkommen as PostBestand['willkommen'] : {},
    gemeldet: o.gemeldet && typeof o.gemeldet === 'object' ? Object.fromEntries(Object.entries(o.gemeldet).filter(([, t]) => typeof t === 'string')) : {},
    ...(o.willkommenLauf && typeof o.willkommenLauf === 'object' ? { willkommenLauf: o.willkommenLauf } : {}),
  };
}

export async function ladePost(h?: string): Promise<PostBestand> {
  const roh = await loadJson<PostBestand>(kampagnenPostName(h ?? await karteiHaushalt()));
  return roh ? saeubern(roh) : leer();
}

/** In EINER Sperre ändern; über der Grenze → MotorFehler 413 (nichts gespeichert). Protokoll: nur Kennungen + Feldnamen. */
export async function aenderePost(fn: (b: PostBestand) => PostBestand, o: { h?: string; wer?: Wer; felder?: (vorher: PostBestand, nachher: PostBestand) => { id: string; felder: string[]; op?: 'neu' | 'geaendert' | 'geloescht' }[] } = {}): Promise<PostBestand> {
  const name = kampagnenPostName(o.h ?? await karteiHaushalt());
  let vorher = leer();
  const neu = await updateJson<PostBestand>(name, cur => {
    vorher = cur ? saeubern(cur) : leer();
    const n = fn(structuredClone(vorher));
    if (n.eintraege.length > POST_GRENZEN.eintraege) throw new MotorFehler(413, `Mehr als ${POST_GRENZEN.eintraege.toLocaleString('de-DE')} Einträge im Mail-Stapel — erst alte Kampagnen abschließen. Nichts gespeichert.`);
    return n;
  });
  const geaendert = o.felder ? o.felder(vorher, saeubern(neu)) : diffEintraege(vorher, saeubern(neu));
  if (geaendert.length) await protokolliere('kampagnen-post', geaendert.map(g => ({ op: g.op ?? 'geaendert', id: g.id, felder: g.felder })), o.wer ?? { art: 'system' }).catch(() => { /* nur Protokoll */ });
  return saeubern(neu);
}
function diffEintraege(a: PostBestand, b: PostBestand): { id: string; felder: string[]; op: 'neu' | 'geaendert' | 'geloescht' }[] {
  const alt = new Map(a.eintraege.map(e => [e.id, e]));
  const raus: { id: string; felder: string[]; op: 'neu' | 'geaendert' | 'geloescht' }[] = [];
  for (const e of b.eintraege) {
    const x = alt.get(e.id);
    if (!x) { raus.push({ id: e.id, felder: ['status'], op: 'neu' }); continue; }
    const f = (Object.keys({ ...x, ...e }) as (keyof PostEintrag)[]).filter(k => k !== 'geaendert' && JSON.stringify(x[k]) !== JSON.stringify(e[k]));
    if (f.length) raus.push({ id: e.id, felder: f, op: 'geaendert' });
  }
  const da = new Set(b.eintraege.map(e => e.id));
  for (const e of a.eintraege) if (!da.has(e.id)) raus.push({ id: e.id, felder: [], op: 'geloescht' });
  if (JSON.stringify(a.einstellungen) !== JSON.stringify(b.einstellungen)) raus.push({ id: 'einstellungen', felder: Object.keys({ ...a.einstellungen, ...b.einstellungen }).filter(k => JSON.stringify((a.einstellungen as unknown as Record<string, unknown>)[k]) !== JSON.stringify((b.einstellungen as unknown as Record<string, unknown>)[k])), op: 'geaendert' });
  return raus;
}

// ── Eigenes Risiko (derselbe Schalter wie die Homepage-Funde) ───────────────────────────────────────────────────────────────────────

/** Playbooks, in denen eine rote Ampel auf „eigenes Risiko“ freigegeben werden darf (Kevin 30.10.: nur die Homepage-Funde). */
export const RISIKO_PLAYBOOKS: readonly string[] = ['homepage-funde'];
export const risikoPlaybook = (k: Pick<Kampagne, 'playbook'>): boolean => RISIKO_PLAYBOOKS.includes(k.playbook);
/** Der Schalter „eigenes Risiko“ (nur Inhaber setzt ihn, lib/funde/einrichten.ts) — null = aus. Wirft nie (dann: aus). */
export async function eigenesRisiko(): Promise<{ seit: string; von: string } | null> {
  try {
    const { ladeFunde } = await import('@/lib/funde/speicher');
    const r = (await ladeFunde()).einstellungen.eigenesRisiko;
    return r ? { seit: r.seit, von: r.von } : null;
  } catch { return null; }
}

// ── Ziel lesen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ungueltigHash = (email: string) => createHash('sha256').update(`make-os-kampagne-ungueltig|${email.trim().toLowerCase()}`).digest('base64url');
type FundKurz = { id: string; name: string; gebiet?: string; bewertung?: { gruende: string[] }; vorschau?: unknown; firmaId?: string; kontaktId?: string; leitfaden?: string; kampagneId?: string; angeschrieben?: boolean };

export interface ZielLage {
  ziel: KampagnenZiel;
  name: string;
  /** Mail-Adresse des Ziels (Person: Hauptadresse; Firma: Firmen-Mail). */
  email?: string;
  telefon?: string;
  linkedin?: string;
  ort?: string;
  /** Person für Follow-up/Power Hour (bei Firmen: eine laufende Person der Firma, wenn es eine gibt). */
  kontaktId?: string;
  /** Art. 18 · Werbesperre · Sperrliste · aus dem Bestand gefallen — dann nie im Stapel. */
  sperre?: string;
  fremddaten: boolean;
  ampel: (k: Kanal) => KanalStatus;
  werte: ReturnType<typeof platzhalterWerte>;
  fund?: FundKurz;
}

export interface MotorKontext {
  crm: CrmBestand;
  kontakte: Kontakt[];
  sperrliste: SperrEintrag[];
  funde: FundKurz[];
  ungueltig: Set<string>;
  heute: string;
}

async function kontextLaden(ungueltig: readonly string[], jetzt: Date): Promise<MotorKontext> {
  const [crm, kontakte, sperrliste] = await Promise.all([ladeCrm(), kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), sperrlisteLaden().catch(() => [] as SperrEintrag[])]);
  let funde: FundKurz[] = [];
  try {
    const { ladeFunde } = await import('@/lib/funde/speicher');
    const { anrufLeitfaden } = await import('@/lib/funde/entwurf');
    funde = (await ladeFunde()).funde.filter(f => f.firmaId || f.kontaktId).map(f => ({ id: f.id, name: f.name, gebiet: f.gebiet, bewertung: f.bewertung, vorschau: f.vorschau, firmaId: f.firmaId, kontaktId: f.kontaktId, leitfaden: anrufLeitfaden(f), kampagneId: f.kampagneId, angeschrieben: !!(f.gesendet || f.post) }));
  } catch { /* ohne Funde: {{befund}}/{{bezirk}} bleiben leer → Entwurf mit Fehler */ }
  return { crm, kontakte, sperrliste, funde, ungueltig: new Set(ungueltig), heute: localDay(jetzt) };
}

/** Wie ein Ziel heute dasteht (rein auf dem Kontext). */
export function zielLage(z: KampagnenZiel, kx: MotorKontext, absender?: string): ZielLage {
  const mitMandat = (id: string) => kx.crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(id));
  const mitChance = (id: string) => kx.crm.chancen.some(c => c.kontaktIds.includes(id) && !['gewonnen', 'verloren'].includes(c.stufe));
  if (z.art === 'kontakt') {
    const k = kx.kontakte.find(x => x.id === z.id);
    const fund = kx.funde.find(f => f.kontaktId === z.id) ?? (k?.firmaId ? kx.funde.find(f => f.firmaId === k.firmaId) : undefined);
    const firma = k?.firmaId ? kx.crm.firmen.find(f => f.id === k.firmaId) : undefined;
    // Fund 1 (B-Prüfung, 02.11.): auch die Werbesperre bzw. Sperrliste des BETRIEBS der Person — ein „Nein“ des Betriebs gilt für seine Leute mit.
    const sperre = !k ? 'nicht mehr in der Kartei' : k.eingeschraenkt ? 'Verarbeitung eingeschränkt (Art. 18)' : k.werbesperre ? 'Werbesperre' : sperrPruefer(kx.sperrliste)(k) ? 'Sperrliste'
      : firma?.werbesperre ? 'Werbesperre des Betriebs' : firma && betriebGesperrt(kx.sperrliste, firma) ? 'Sperrliste (Betrieb)' : undefined;
    return {
      ziel: z, name: k ? anzeigename(k) : 'Kontakt', ...(k?.email ? { email: k.email.toLowerCase() } : {}), ...(k?.telefon || k?.sms ? { telefon: k.telefon || k.sms } : {}),
      ...(k?.linkedin ? { linkedin: k.linkedin } : {}), ...(k?.firmaStadt || firma?.stadt ? { ort: k?.firmaStadt || firma?.stadt } : {}), ...(k ? { kontaktId: k.id } : {}),
      ...(sperre ? { sperre } : {}), fremddaten: !!k?.fremddaten,
      ampel: kanal => (k ? kanalStatus(k, kanal, { hatMandat: mitMandat(k.id), hatChance: mitChance(k.id) }) : { kanal, farbe: 'rot', grund: 'nicht in der Kartei' }),
      werte: platzhalterWerte({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, betrieb: firma?.name ?? k?.firma, bezirk: fund?.gebiet, befund: fund?.bewertung?.gruende.slice(0, 2).join(', '), absender, heute: kx.heute }),
      ...(fund ? { fund } : {}),
    };
  }
  const f = kx.crm.firmen.find(x => x.id === z.id);
  const fund = kx.funde.find(x => x.firmaId === z.id);
  const email = f?.email?.trim().toLowerCase() || undefined;
  const telefon = f?.mobil || f?.telefon;
  const person = f ? personenDerFirma(kx.kontakte, f.id, { nurAktiv: true }).find(k => !ausgenommen(k)) : undefined;
  // Betriebs-Sperre: Werbesperre an der Firma bzw. ein Merkmal auf der Sperrliste (lib/crm/betrieb-sperre.ts — dieselbe Stelle wie Funde/Import).
  const sperre = !f ? 'nicht mehr bei den Firmen' : f.werbesperre ? 'Werbesperre' : betriebGesperrt(kx.sperrliste, f) ? 'Sperrliste' : undefined;
  const ctx = { hatMandat: kx.crm.mandate.some(m => m.status === 'aktiv' && m.firmaId === z.id), hatChance: kx.crm.chancen.some(c => c.firmaId === z.id && !['gewonnen', 'verloren'].includes(c.stufe)) };
  // Mail/Telefon: die Firmen-Ampel (lib/crm/recht.ts `firmaKanalStatus` — eine Stelle); Brief/Besuch/LinkedIn: die Regeln der Kanal-Ampel mit der Werbesperre der Firma.
  const alsKontakt = { id: z.id, vorname: '', nachname: f?.name ?? '', linkedin: f?.linkedin, stufe: 'neu', aktivitaeten: [], ...(f?.werbesperre ? { werbesperre: f.werbesperre } : {}) } as unknown as Kontakt;
  return {
    ziel: z, name: f?.name ?? 'Firma', ...(email ? { email } : {}), ...(telefon ? { telefon } : {}), ...(f?.linkedin ? { linkedin: f.linkedin } : {}), ...(f?.stadt ? { ort: f.stadt } : {}),
    ...(person ? { kontaktId: person.id } : {}), ...(sperre ? { sperre } : {}), fremddaten: !!f?.fremddaten || !!fund,
    ampel: kanal => (f && (kanal === 'mail' || kanal === 'telefon') ? firmaKanalStatus(f, kanal, ctx) : kanalStatus(alsKontakt, kanal, ctx)),
    werte: platzhalterWerte({ anrede: person?.anrede, vorname: person?.vorname, nachname: person?.nachname, betrieb: f?.name, bezirk: fund?.gebiet ?? f?.bezirk, befund: fund?.bewertung?.gruende.slice(0, 2).join(', '), absender, heute: kx.heute }),
    ...(fund ? { fund } : {}),
  };
}

// ── Takt: Sequenzen fortschreiben ───────────────────────────────────────────────────────────────────────────────────────────────────

const FU_ART: Record<'anruf' | 'linkedin' | 'besuch', FollowUpArt> = { anruf: 'anruf', linkedin: 'linkedin', besuch: 'sonstig' };
const KANAL_AMPEL: Record<SequenzSchritt['kanal'], Kanal | null> = { mail: 'mail', anruf: 'telefon', linkedin: 'linkedin', brief: 'brief', besuch: 'besuch' };

/** Ein Ziel hängt nicht mehr an der Kampagne (aus der Liste genommen). */
const nochZiel = (k: Kampagne, s: KampagnenZiel) => zieleDerKampagne(k).some(z => gleichesZiel(z, s));

/** Mail-Einträge, die schon raus sind bzw. unterwegs (freigegeben, sendet, gesendet, unklar, unzustellbar). */
const RAUS = new Set(['freigegeben', 'sendet', 'gesendet', 'unklar', 'bounce']);
/**
 * Wer in dieser Kampagne schon angeschrieben ist (M1, 01.11., gegen die Doppel-Mail): eine Mail im Stapel, die raus ist bzw. unterwegs, und ein
 * Homepage-Fund dieser Kampagne mit gesendeter bzw. eingestellter Mail — bei einem Fund zählen Firma UND Person. Rein.
 */
export function schonAngeschrieben(k: Pick<Kampagne, 'id'>, eintraege: readonly PostEintrag[], funde: readonly Pick<FundKurz, 'id' | 'kampagneId' | 'firmaId' | 'kontaktId' | 'angeschrieben'>[], heute?: string): Set<string> {
  const raus = new Set<string>();
  const vonFund = (f: Pick<FundKurz, 'firmaId' | 'kontaktId'>) => { if (f.firmaId) raus.add(`firma:${f.firmaId}`); if (f.kontaktId) raus.add(`kontakt:${f.kontaktId}`); };
  // Fund 17 (B-Prüfung, 02.11.): über Kampagnen hinweg — eine Mail einer ANDEREN Kampagne in den letzten `ERSTANSPRACHE_SPERRE_TAGE` Tagen zählt mit.
  const ab = heute ? tagePlus(heute, -ERSTANSPRACHE_SPERRE_TAGE) : null;
  const zaehlt = (x: PostEintrag) => x.kampagneId === k.id || (!!ab && tagVon(x.gesendet?.am ?? x.freigabe?.am ?? x.geaendert) >= ab);
  for (const x of eintraege) {
    if (x.kanal !== 'mail' || !RAUS.has(x.status) || !zaehlt(x)) continue;
    raus.add(zielSchluessel(x.ziel));
    const f = x.fundId ? funde.find(y => y.id === x.fundId) : undefined;
    if (f) vonFund(f);
  }
  for (const f of funde) if (f.kampagneId === k.id && f.angeschrieben) vonFund(f);
  return raus;
}

/** Noch nicht gesendete Einträge (Entwurf, freigegeben, Fehler) — die verwirft das Ende eines Ziels (Fund 2/3, B-Prüfung 02.11.). */
const NOCH_NICHT_RAUS = new Set(['entwurf', 'freigegeben', 'fehler']);
/**
 * Endet ein Ziel in einer Kampagne (reagiert, gestoppt, unzustellbar, abgemeldet, aus der Liste genommen, Schritt entfernt), gehen seine noch nicht
 * gesendeten Einträge dieser Kampagne auf „verworfen“ — sonst ginge eine schon freigegebene Mail trotzdem raus. Rein; `kampagneId` null = alle.
 */
export function zielEintraegeVerwerfen(b: PostBestand, kampagneId: string | null, ziel: KampagnenZiel, grund: string, am: string): PostBestand {
  let n = 0;
  const eintraege = b.eintraege.map(x => {
    if ((kampagneId && x.kampagneId !== kampagneId) || !gleichesZiel(x.ziel, ziel) || !NOCH_NICHT_RAUS.has(x.status)) return x;
    n++;
    const { naechsterVersuch: _n, ...rest } = x;
    return { ...rest, status: 'verworfen' as const, hinweis: grund.slice(0, 200), geaendert: am };
  });
  return n ? { ...b, eintraege } : b;
}

/** Ergebnis eines Laufs: Zähler (nie Namen) und je Grund, warum etwas übersprungen bzw. gestoppt wurde. */
export interface FortschreibenErgebnis { gestartet: number; entwuerfe: number; followups: number; weiter: number; gestoppt: number; gruende: Record<string, number>; kampagne?: { status: Kampagne['status']; mitSequenz: boolean } }

/**
 * Ein Lauf über alle aktiven Kampagnen mit Sequenz — idempotent (feste Kennungen): neue Ziele starten (≤ neuJeTag), fällige Schritte erzeugen ihre
 * Arbeit (Entwurf/Follow-up/Druckliste), Erledigtes schaltet weiter. Liefert Zähler (nie Namen).
 */
export async function sequenzenFortschreiben(jetzt = new Date(), o: { kampagneId?: string } = {}): Promise<FortschreibenErgebnis> {
  const z: FortschreibenErgebnis = { gestartet: 0, entwuerfe: 0, followups: 0, weiter: 0, gestoppt: 0, gruende: {} };
  // Warum etwas übersprungen bzw. gestoppt wurde — „Jetzt vorbereiten“ zeigt es (M1, 01.11.), statt still nichts zu tun. Nur Gründe, nie Namen.
  const grund = (g: string) => { z.gruende[g] = (z.gruende[g] ?? 0) + 1; };
  const post = await ladePost();
  const risiko = await eigenesRisiko();
  const kx = await kontextLaden(post.ungueltig, jetzt);
  const heute = kx.heute, am = jetzt.toISOString();
  if (o.kampagneId) { const k = kx.crm.kampagnen.find(x => x.id === o.kampagneId && !x.geloeschtAm); if (k) z.kampagne = { status: k.status, mitSequenz: !!k.sequenz?.length }; }
  if (!kx.crm.kampagnen.some(k => k.sequenz?.length)) return z;
  const postNach = new Map(post.eintraege.map(e => [e.id, e]));
  const neuePost: PostEintrag[] = [];
  // Ziele, die in diesem Lauf enden — danach: ihre offenen Einträge verwerfen und offene Follow-ups der Sequenz absagen (Fund 1–3, B-Prüfung 02.11.).
  let beendet: { kampagneId: string; ziel: KampagnenZiel; grund: string; fundId?: string }[] = [];
  await aendereCrm(c => {
    beendet = [];
    const kxc = { ...kx, crm: c };
    const followups = [...(c.followups ?? [])];
    const fuNach = new Map(followups.map(f => [f.id, f]));
    const endenSammeln = (k0: Kampagne, k: Kampagne): Kampagne => {
      const vorher = new Map((k0.zielStaende ?? []).map(s => [zielSchluessel(s), s]));
      for (const s of k.zielStaende ?? []) {
        const alt = vorher.get(zielSchluessel(s));
        if (istEnde(s) && (!alt || !istEnde(alt))) beendet.push({ kampagneId: k.id, ziel: { art: s.art, id: s.id }, grund: s.grund ?? s.status });
      }
      return k;
    };
    const kampagnen = c.kampagnen.map(k0 => {
      if (!k0.sequenz?.length || k0.geloeschtAm) return k0;
      // {{absender}} = Vorname der zuständigen Person (bei „beide“ fehlt er — dann ist eine Vorlage mit {{absender}} ein Fehler, nie eine Lücke).
      const zst = zustaendig(k0.zustaendig, weltDerKampagne(k0));
      const absender = zst && zst !== BEIDE ? nameVon(zst).split(/\s+/)[0] : undefined;
      let k = k0;
      // 0 · Sperre (Fund 1, B-Prüfung 02.11.): Werbesperre, Art. 18, Sperrliste — der Person ODER ihres Betriebs — beendet jedes laufende Ziel sofort,
      // auch bei pausierter Kampagne; die offenen Follow-ups der Sequenz (Anruf, LinkedIn, Besuch) werden unten abgesagt.
      for (const s of k.zielStaende ?? []) {
        if (istEnde(s)) continue;
        const sp = zielLage(s, kxc).sperre;
        if (sp) { k = standErsetzen(k, beenden(s, 'gestoppt', sp, am, 'gestoppt')); z.gestoppt++; grund(`gestoppt: ${sp}`); }
      }
      // 1 · Weiterschalten, was erledigt ist (Mail gesendet, Brief gedruckt, Follow-up erledigt/abgesagt) — auch bei pausierter Kampagne.
      for (const s of k.zielStaende ?? []) {
        if (s.status !== 'wartet') continue;
        const sch = schrittVon(k, s);
        if (!sch) { k = standErsetzen(k, beenden(s, 'gestoppt', 'Schritt gibt es nicht mehr', am, 'gestoppt')); z.gestoppt++; continue; }
        if (sch.kanal === 'mail' || sch.kanal === 'brief') {
          const e = postNach.get(postEintragId(k.id, s, sch.id));
          if (!e) continue;
          if (e.status === 'gesendet' || e.status === 'gedruckt') { k = standErsetzen(k, weiter(k, s, heute, am, e.status === 'gesendet' ? 'gesendet' : 'erledigt', e.freigabe?.von ?? e.gedruckt?.von)); z.weiter++; }
          else if (e.status === 'verworfen' || e.status === 'gesperrt') { k = standErsetzen(k, beenden(s, 'gestoppt', e.status === 'verworfen' ? 'im Stapel verworfen' : (e.fehler ?? 'gesperrt'), am, 'gestoppt')); z.gestoppt++; }
          continue;
        }
        const f = fuNach.get(sequenzFollowupId(k.id, s, sch.id));
        if (f && f.status === 'offen') continue;
        if (f?.status === 'abgesagt') { k = standErsetzen(k, beenden(s, 'gestoppt', 'Follow-up abgesagt', am, 'gestoppt')); z.gestoppt++; continue; }
        if (f?.status === 'erledigt' && (f.ergebnis === 'sperre' || f.ergebnis === 'kein_bedarf')) { k = standErsetzen(k, beenden(s, 'gestoppt', f.ergebnis === 'sperre' ? 'Werbesperre' : 'kein Interesse', am, 'gestoppt')); z.gestoppt++; continue; }
        // M1 (01.11.): erst den Schritt als erledigt vermerken, dann beenden — sonst fehlt der Anruf im Trichter je Schritt.
        if (f?.status === 'erledigt' && (f.ergebnis === 'gespraech' || f.ergebnis === 'termin')) { k = standErsetzen(k, erledigtUndBeenden(k, s, 'reagiert', f.ergebnis === 'termin' ? 'Termin vereinbart' : 'Gespräch geführt', am, 'reagiert', f.zustaendig)); z.weiter++; continue; }
        k = standErsetzen(k, weiter(k, s, heute, am, 'erledigt', f?.zustaendig)); z.weiter++;
      }
      if (k.status !== 'aktiv') return endenSammeln(k0, k);
      // 2 · Ziele aus der Liste genommen → Ende; neue Ziele starten (gesperrte gar nicht erst).
      for (const s of k.zielStaende ?? []) if (!istEnde(s) && !nochZiel(k, s)) { k = standErsetzen(k, beenden(s, 'gestoppt', 'aus der Kampagne genommen', am, 'gestoppt')); z.gestoppt++; }
      // Gesperrte gar nicht erst; schon Angeschriebene (Fund-Mail, gesendete Mail im Stapel) auch nicht — sonst bekämen sie eine zweite Erstansprache.
      const raus = schonAngeschrieben(k, post.eintraege, kx.funde, heute);
      const gestartet = staendeStarten(k, heute, am, ziel => {
        const sp = zielLage(ziel, kxc).sperre;
        if (sp) { grund(`nicht gestartet: ${sp}`); return false; }
        if (raus.has(zielSchluessel(ziel))) { grund('nicht gestartet: schon angeschrieben'); return false; }
        return true;
      });
      k = { ...k, zielStaende: gestartet.staende };
      z.gestartet += gestartet.neu;
      // 3 · Fällige Schritte erzeugen ihre Arbeit.
      for (const s of faelligeStaende(k, heute)) {
        const sch = schrittVon(k, s);
        // Einen Schritt, den es nicht mehr gibt, beendet der nächste Lauf (Schritt 1) — hier nichts erzeugen.
        if (!sch) { k = standErsetzen(k, beenden(s, 'gestoppt', 'Schritt gibt es nicht mehr', am, 'gestoppt')); z.gestoppt++; continue; }
        const lage = zielLage(s, kxc, absender);
        if (lage.sperre) { k = standErsetzen(k, beenden(s, 'gestoppt', lage.sperre, am, 'gestoppt')); z.gestoppt++; grund(`gestoppt: ${lage.sperre}`); continue; }
        const ampelKanal = KANAL_AMPEL[sch.kanal];
        const ampel = ampelKanal ? lage.ampel(ampelKanal) : null;
        const rot = ampel?.farbe === 'rot' && ampel.grund !== 'keine Adresse';
        if (sch.kanal === 'mail' || sch.kanal === 'brief') {
          if (sch.kanal === 'mail' && (!lage.email || kx.ungueltig.has(ungueltigHash(lage.email)))) { k = standErsetzen(k, weiter(k, s, heute, am, 'uebersprungen')); z.weiter++; grund(!lage.email ? 'Mail übersprungen: keine Mail-Adresse' : 'Mail übersprungen: Adresse unzustellbar'); continue; }
          // Rote Ampel: nur im Playbook „eigenes Risiko“ (der Schalter wirkt bei der Freigabe und noch einmal beim Versand) — sonst nicht in den Stapel.
          if (sch.kanal === 'mail' && rot && !risikoPlaybook(k)) { k = standErsetzen(k, weiter(k, s, heute, am, 'uebersprungen')); z.weiter++; grund('Mail übersprungen: Kanal-Ampel rot'); continue; }
          // Gelbe Ampel (M1, 01.11.): Entwurf ja, aber gekennzeichnet — nur einzeln freigebbar (nie in der Sammelfreigabe).
          const gelb = sch.kanal === 'mail' && ampel?.farbe === 'gelb' ? ampel.grund.slice(0, 200) : undefined;
          const id = postEintragId(k.id, s, sch.id);
          if (!postNach.has(id) && !neuePost.some(e => e.id === id)) {
            const f = entwurfFuellen(sch, lage.werte);
            neuePost.push({
              id, kampagneId: k.id, ziel: { art: s.art, id: s.id }, schrittId: sch.id, kanal: sch.kanal, an: { ...(sch.kanal === 'mail' ? { email: lage.email } : {}), name: lage.name, ...(lage.ort ? { ort: lage.ort } : {}) },
              betreff: f.betreff, text: f.text, status: f.fehler ? 'fehler' : 'entwurf', ...(f.fehler ? { fehler: f.fehler } : {}), ...(sch.kanal === 'mail' && rot ? { risiko: true as const } : {}), ...(gelb ? { gelb } : {}), angelegt: am, geaendert: am,
            });
            z.entwuerfe++;
          }
          k = standErsetzen(k, wartet(s, am, 'entwurf', sch.id));
          continue;
        }
        // Anruf / LinkedIn / Besuch: ein echtes Follow-up. Anruf ohne Nummer bzw. rote Ampel außerhalb von „eigenes Risiko“ → übersprungen.
        if (sch.kanal === 'anruf' && (!lage.telefon || (rot && !(risikoPlaybook(k) && risiko)))) { k = standErsetzen(k, weiter(k, s, heute, am, 'uebersprungen')); z.weiter++; grund(!lage.telefon ? 'Anruf übersprungen: keine Nummer' : 'Anruf übersprungen: Kanal-Ampel rot'); continue; }
        const fid = sequenzFollowupId(k.id, s, sch.id);
        if (!fuNach.has(fid)) {
          const kontakt = lage.kontaktId ? kx.kontakte.find(x => x.id === lage.kontaktId) : undefined;
          const was = sch.kanal === 'anruf' ? `Anrufen${lage.telefon ? ` (${lage.telefon})` : ''}` : sch.kanal === 'linkedin' ? (rot ? 'LinkedIn: vernetzen (ohne Werbebotschaft)' : 'LinkedIn-Nachricht') : 'Vor Ort vorbeigehen';
          const notiz = [sch.leitfaden?.trim(), sch.kanal === 'anruf' ? lage.fund?.leitfaden : undefined, ampel ? `Kanal-Ampel: ${ampel.grund}` : undefined, sch.kanal === 'besuch' ? 'Besuch: kein Fernkommunikationsmittel — kurz, nicht zur Stoßzeit, bei „Nein“ sofort Werbesperre setzen.' : undefined].filter(Boolean).join('\n\n');
          const fu: FollowUp = neuesFollowUp({
            id: fid, bezug: lage.kontaktId ? { art: 'kontakt', id: lage.kontaktId } : { art: 'firma', id: s.id }, ...(lage.kontaktId ? { kontaktId: lage.kontaktId } : {}),
            art: FU_ART[sch.kanal], text: `Kampagne „${k.name}“: ${was}${s.art === 'firma' ? ` · ${lage.name}` : ''}`, faellig: heute, zustaendig: zustaendig(k.zustaendig, weltDerKampagne(k)), quelle: 'kampagne', ...(notiz ? { notiz } : {}),
          }, kontakt, 'system', am);
          followups.push(fu); fuNach.set(fid, fu); z.followups++;
        }
        k = standErsetzen(k, wartet(s, am, 'entwurf', sch.id));
      }
      return endenSammeln(k0, k);
    });
    // Ziele, die in diesem Lauf endeten: offene Follow-ups ihrer Sequenz absagen (Anruf/LinkedIn/Besuch eines gesperrten oder beendeten Ziels).
    let neu: CrmBestand = { ...c, kampagnen, followups };
    for (const e of beendet) neu = { ...neu, followups: sequenzFollowupsAbsagen(neu, e.kampagneId, e.ziel, `Die Sequenz endet (${e.grund}).`, am, e.fundId) };
    return neu;
  }, { art: 'system' });
  if (neuePost.length || beendet.length) await aenderePost(b => {
    let n: PostBestand = { ...b, eintraege: [...b.eintraege, ...neuePost.filter(e => !b.eintraege.some(x => x.id === e.id))] };
    for (const e of beendet) n = zielEintraegeVerwerfen(n, e.kampagneId, e.ziel, `Das Ziel läuft in dieser Kampagne nicht mehr (${e.grund}).`, am);
    return n;
  });
  return z;
}

// ── Freigabe (EIN Klick je Stapel, nur per Sitzung) ─────────────────────────────────────────────────────────────────────────────────

/**
 * Die ausgewählten Entwürfe einer Kampagne freigeben — die Person der SITZUNG (der Aufrufer schließt Dienstweg/ZOE aus, 403) über eines IHRER
 * Postfächer im Business-Bereich. Geprüft: Einträge gehören zur Kampagne, sind Mail-Entwürfe ohne Fehler; mit roter Ampel nur im Playbook „eigenes
 * Risiko“ UND eingeschaltetem Schalter — dann trägt die Freigabe sichtbar „auf eigenes Risiko freigegeben von … am …“. Alles oder nichts.
 */
export async function stapelFreigeben(e: { person: string; kampagneId: string; ids: readonly string[]; postfach: string; wer: Wer }, jetzt = new Date()): Promise<{ freigegeben: number; eigenesRisiko: { seit: string; von: string } | null }> {
  const ids = Array.from(new Set(e.ids));
  if (!ids.length) throw new MotorFehler(400, 'Keine Mail ausgewählt.');
  if (ids.length > 200) throw new MotorFehler(413, 'Höchstens 200 Mails je Freigabe.');
  const crm = await ladeCrm();
  const k = crm.kampagnen.find(x => x.id === e.kampagneId && !x.geloeschtAm);
  if (!k) throw new MotorFehler(404, 'Diese Kampagne gibt es nicht (mehr).');
  if (k.status !== 'aktiv') throw new MotorFehler(409, 'Die Kampagne ist nicht aktiv — erst auf „Aktiv“ stellen.');
  const { ladePostfach } = await import('@/lib/postfach/register');
  const { formularPostfachBereichOk } = await import('./formulare');
  const p = await ladePostfach(e.person, e.postfach);
  if (!p || p.quelle === 'whatsapp') throw new MotorFehler(403, 'Freigegeben wird über eines deiner eigenen Postfächer.');
  if (!formularPostfachBereichOk(p.bereich)) throw new MotorFehler(403, 'Kampagnen-Mails gehen nur über ein Postfach im Business-Bereich — nie aus einem Privat-Postfach.');
  const risiko = await eigenesRisiko();
  const am = jetzt.toISOString();
  // Fund 15 (B-Prüfung, 02.11.): die Ampel gilt, wie sie JETZT steht — nicht, wie sie beim Anlegen des Entwurfs stand (Einwilligung widerrufen,
  // Sperre, neue Adresse). Ebenso: das Ziel muss noch an diesem Schritt stehen (sonst ginge eine Mail an ein beendetes Ziel).
  const kx = await kontextLaden((await ladePost()).ungueltig, jetzt);
  const jetztLage = new Map<string, { risiko: boolean; gelb?: string }>();
  let n = 0, mitRisiko = false;
  await aenderePost(b => {
    const gewaehlt = b.eintraege.filter(x => ids.includes(x.id));
    if (gewaehlt.length !== ids.length) throw new MotorFehler(404, 'Ein Entwurf ist nicht (mehr) da — bitte neu laden.');
    for (const x of gewaehlt) {
      if (x.kampagneId !== k.id || x.kanal !== 'mail') throw new MotorFehler(400, 'Nur Mail-Entwürfe dieser Kampagne.');
      if (x.status !== 'entwurf') throw new MotorFehler(409, `„${x.an.name}“: ${x.status === 'fehler' ? `nicht freigebbar — ${x.fehler ?? 'Fehler im Entwurf'}` : 'ist nicht mehr im Entwurf'}.`);
      const lage = zielLage(x.ziel, kx);
      if (lage.sperre) throw new MotorFehler(409, `„${x.an.name}“: ${lage.sperre} — nicht freigebbar. Nichts freigegeben.`);
      if (!lage.email || lage.email !== x.an.email) throw new MotorFehler(409, `„${x.an.name}“: die Mail-Adresse hat sich geändert — bitte neu laden bzw. neu vorbereiten. Nichts freigegeben.`);
      const st = (k.zielStaende ?? []).find(y => gleichesZiel(y, x.ziel));
      if (x.schrittId !== FUND_SCHRITT && (!nochZiel(k, x.ziel) || !st || st.status !== 'wartet' || schrittVon(k, st)?.id !== x.schrittId)) throw new MotorFehler(409, `„${x.an.name}“: das Ziel läuft an diesem Schritt nicht mehr — nicht freigebbar. Nichts freigegeben.`);
      const a = lage.ampel('mail');
      const rot = a.farbe === 'rot' && a.grund !== 'keine Adresse';
      const gelb = a.farbe === 'gelb' ? a.grund.slice(0, 200) : undefined;
      if (rot && !risikoPlaybook(k)) throw new MotorFehler(409, `„${x.an.name}“: Kanal-Ampel inzwischen rot (${a.grund}) — nicht freigebbar. Nichts freigegeben.`);
      if (rot && !risiko) throw new MotorFehler(409, `„${x.an.name}“: Kanal-Ampel rot — freigeben nur, wenn ein Inhaber „eigenes Risiko“ eingeschaltet hat (Homepage-Funde).`);
      if (rot) mitRisiko = true;
      // Gelbe Ampel (M1, 01.11.): nur einzeln — wer freigibt, soll den Grund gesehen haben. Seit 02.11. nach der Ampel von JETZT.
      if (gelb && ids.length > 1) throw new MotorFehler(409, `„${x.an.name}“: Kanal-Ampel gelb (${gelb}) — bitte einzeln freigeben, nicht in der Sammelfreigabe. Nichts freigegeben.`);
      jetztLage.set(x.id, { risiko: rot, ...(gelb ? { gelb } : {}) });
    }
    n = gewaehlt.length;
    return { ...b, eintraege: b.eintraege.map(x => {
      if (!ids.includes(x.id)) return x;
      const l = jetztLage.get(x.id)!;
      const { risiko: _r, gelb: _g, hinweis: _h, versuche: _v, naechsterVersuch: _n, ...rest } = x;
      return { ...rest, ...(l.risiko ? { risiko: true as const } : {}), ...(l.gelb ? { gelb: l.gelb } : {}), status: 'freigegeben' as const, freigabe: { von: e.person, am, postfach: p.id, ...(l.risiko && risiko ? { eigenesRisiko: risiko } : {}) }, geaendert: am };
    }) };
  }, { wer: e.wer, felder: () => ids.map(id => ({ id, felder: ['status', 'freigabe', ...(mitRisiko ? ['eigenes-risiko'] : [])] })) });
  // Die Sammelfreigabe zusätzlich als ZOE-Entscheidung festhalten (dauerhaft, nur Kennung + Anzahl, nie Texte/Adressen).
  await import('@/lib/zoe/entscheidungen').then(m => m.haltFest([m.entscheidungEintrag(
    { id: `ks-${k.id}-${jetzt.getTime()}`, werkzeug: 'kampagnen_stapel', gruppe: 'markttraktion', titel: `Mail-Stapel freigegeben (${n})`, person: e.person, bezug: { art: 'kampagne', id: k.id } },
    { entscheidung: 'freigegeben', von: e.person, ergebnis: `${n} ${n === 1 ? 'Mail' : 'Mails'}${mitRisiko && risiko ? ` · auf eigenes Risiko (Schalter seit ${risiko.seit.slice(0, 10)})` : ''}`, at: am },
  )])).catch(() => { /* das Änderungsprotokoll trägt die Freigabe schon */ });
  return { freigegeben: n, eigenesRisiko: mitRisiko ? risiko : null };
}

/**
 * Die Mail eines Homepage-Funds in den Stapel der Funde-Kampagne legen (M1, 01.11.) — EIN Versandweg: Drossel, Zeitfenster, Fußzeile, Abmeldelink,
 * `List-Unsubscribe` und Rückfluss wie jede Kampagnen-Mail. Die Freigabe ist der Klick im ZOE-Stapel (lib/funde/uebernehmen.ts) „auf eigenes Risiko“
 * — sie steht hier sichtbar am Eintrag: gesendet wird im Namen und Postfach des Absenders der Funde, `durch` = wer geklickt hat. Idempotent über die
 * feste Kennung (Kampagne + Ziel + Schritt `fund`): ein zweiter Aufruf legt nichts doppelt an.
 */
export async function fundMailInStapel(e: {
  fundId: string; kampagneId: string; ziel: KampagnenZiel; an: { email: string; name: string; ort?: string }; betreff: string; text: string;
  absender: { person: string; postfach: string }; durch: string; eigenesRisiko: { seit: string; von: string }; wer: Wer;
}, jetzt = new Date()): Promise<{ id: string; neu: boolean }> {
  const id = postEintragId(e.kampagneId, e.ziel, FUND_SCHRITT);
  const am = jetzt.toISOString();
  let neu = false;
  await aenderePost(b => {
    if (b.eintraege.some(x => x.id === id)) return b;
    neu = true;
    const x: PostEintrag = {
      id, kampagneId: e.kampagneId, ziel: { art: e.ziel.art, id: e.ziel.id }, schrittId: FUND_SCHRITT, kanal: 'mail', fundId: e.fundId,
      an: { email: e.an.email.trim().toLowerCase(), name: e.an.name.slice(0, 160), ...(e.an.ort ? { ort: e.an.ort } : {}) },
      betreff: e.betreff.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200), text: e.text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim(),
      status: 'freigegeben', risiko: true,
      freigabe: { von: e.absender.person, am, postfach: e.absender.postfach, eigenesRisiko: e.eigenesRisiko, ...(e.durch !== e.absender.person ? { durch: e.durch } : {}) },
      angelegt: am, geaendert: am,
    };
    return { ...b, eintraege: [...b.eintraege, x] };
  }, { wer: e.wer, felder: () => [{ id, felder: ['status', 'freigabe', 'eigenes-risiko', 'fund'], op: 'neu' }] });
  return { id, neu };
}

/** Einen Entwurf bearbeiten (Betreff/Text) — nur im Entwurf bzw. Fehler; danach erneut geprüft (unbekannte Platzhalter = Fehler). */
export async function entwurfAendern(e: { person: string; id: string; betreff: string; text: string; zoe?: boolean; wer: Wer }, jetzt = new Date()): Promise<PostEintrag> {
  const { platzhalterPruefen } = await import('./vorlage-platzhalter');
  const betreff = e.betreff.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const text = e.text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  if (betreff.length > 200 || text.length > 4000) throw new MotorFehler(413, 'Betreff höchstens 200, Text höchstens 4.000 Zeichen — nichts gespeichert.');
  const fehler = [...platzhalterPruefen(betreff, 'kampagne', 'Betreff'), ...platzhalterPruefen(text, 'kampagne', 'Text')];
  const offen = Array.from(`${betreff}\n${text}`.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]{0,59})/g)).map(m => m[1]).filter(x => x !== 'vorschauLink' && x !== 'abmeldeLink');
  if (offen.length) fehler.push(`Noch nicht gefüllt: ${Array.from(new Set(offen)).map(x => `{{${x}}}`).join(', ')}.`);
  const am = jetzt.toISOString();
  let raus: PostEintrag | undefined;
  await aenderePost(b => {
    const x = b.eintraege.find(y => y.id === e.id);
    if (!x) throw new MotorFehler(404, 'Diesen Entwurf gibt es nicht (mehr).');
    // Ein Brief braucht keinen Betreff (B-Prüfung 02.11., Fund 6: Briefe mit Fehler sind jetzt bearbeitbar).
    if (!text || (!betreff && x.kanal === 'mail')) fehler.push(x.kanal === 'mail' ? 'Betreff und Text dürfen nicht leer sein.' : 'Der Text darf nicht leer sein.');
    if (x.status !== 'entwurf' && x.status !== 'fehler') throw new MotorFehler(409, 'Nur Entwürfe lassen sich bearbeiten.');
    const sperre = x.status === 'fehler' && x.fehler && /Sperr|Art\. 18|Werbesperre/.test(x.fehler);
    raus = { ...x, betreff, text, bearbeitet: { von: e.person, am, ...(e.zoe ? { zoe: true as const } : {}) }, status: fehler.length || sperre ? 'fehler' : 'entwurf', ...(fehler.length ? { fehler: fehler.join(' ') } : sperre ? {} : { fehler: undefined }), geaendert: am };
    if (!fehler.length && !sperre) delete raus.fehler;
    delete raus.hinweis;
    return { ...b, eintraege: b.eintraege.map(y => (y.id === e.id ? raus! : y)) };
  }, { wer: e.wer });
  return raus!;
}

/** Entwürfe verwerfen (das Ziel stoppt für diese Kampagne) bzw. Briefe als gedruckt markieren bzw. „unklar“/Fehler zurück in den Entwurf. */
export async function eintraegeSetzen(e: { person: string; kampagneId: string; ids: readonly string[]; aktion: 'verwerfen' | 'gedruckt' | 'erneut'; wer: Wer }, jetzt = new Date()): Promise<number> {
  const am = jetzt.toISOString();
  let n = 0;
  await aenderePost(b => ({
    ...b, eintraege: b.eintraege.map(x => {
      if (!e.ids.includes(x.id) || x.kampagneId !== e.kampagneId) return x;
      if (e.aktion === 'verwerfen' && (x.status === 'entwurf' || x.status === 'fehler' || x.status === 'freigegeben')) { n++; return { ...x, status: 'verworfen' as const, geaendert: am }; }
      if (e.aktion === 'gedruckt' && x.kanal === 'brief' && (x.status === 'entwurf')) { n++; return { ...x, status: 'gedruckt' as const, gedruckt: { von: e.person, am }, geaendert: am }; }
      // „Unklar“ (Versand begann, Ende unbekannt) bzw. ein Sendefehler: erst nach Blick in „Gesendet“ zurück in den Entwurf — nie automatisch.
      if (e.aktion === 'erneut' && (x.status === 'unklar' || (x.status === 'fehler' && !!x.freigabe))) { n++; const { freigabe: _f, sendetSeit: _s, ...rest } = x; return { ...rest, status: 'entwurf' as const, fehler: undefined, geaendert: am }; }
      return x;
    }),
  }), { wer: e.wer });
  return n;
}

// ── Versand (Takt) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Vorschau-Link eines Funds frisch erzeugen (nur der Fingerabdruck bleibt am Fund) — null ohne Vorschau oder ohne Adresse der Instanz. */
async function vorschauLinkNeu(fundId: string | undefined, heute: string): Promise<string | null> {
  if (!fundId) return null;
  try {
    const { instanzAdresse } = await import('@/lib/datenschutz/abmelden');
    const basis = instanzAdresse();
    if (!basis) return null;
    const { aendereFunde, vorschauTokenHash } = await import('@/lib/funde/speicher');
    const { VORSCHAU_TAGE } = await import('@/lib/funde/typen');
    const token = `v1-${randomBytes(16).toString('hex')}`;
    let ok = false;
    await aendereFunde(x => ({ ...x, funde: x.funde.map(f => { if (f.id !== fundId || !f.vorschau) return f; ok = true; return { ...f, vorschau: { ...f.vorschau, tokenHash: vorschauTokenHash(token), gueltigBis: tagePlus(heute, VORSCHAU_TAGE) } }; }) }));
    return ok ? `${basis}/vorschau/${token}` : null;
  } catch { return null; }
}

/**
 * Wer senden darf, prüft der Lauf erneut — die Lage kann sich seit der Freigabe geändert haben (Werbesperre, Abmeldung, Schalter aus, Antwort,
 * Ziel herausgenommen). B-Prüfung (02.11.): drei Arten statt einer —
 *   sperre      echte Sperre (Werbesperre, Art. 18, Sperrliste, unzustellbar) → „gesperrt“, das Ziel endet
 *   veraltet    das Ziel läuft an diesem Schritt nicht mehr (Antwort kam, gestoppt, herausgenommen, Schritt entfernt) → „verworfen“
 *   vorlaeufig  Adresse geändert, Ampel inzwischen rot, „eigenes Risiko“ aus → zurück in den Entwurf mit Hinweis (neu prüfen, neu freigeben)
 */
export type SendeSperre = { art: 'sperre' | 'veraltet' | 'vorlaeufig'; text: string };
export function sendeSperre(x: PostEintrag, k: Kampagne | undefined, lage: ZielLage, risiko: { seit: string; von: string } | null, ungueltig: Set<string>): SendeSperre | null {
  if (!k || k.geloeschtAm) return { art: 'veraltet', text: 'Die Kampagne gibt es nicht mehr.' };
  if (k.status !== 'aktiv') return null; // pausiert: bleibt freigegeben, geht weiter, sobald sie wieder aktiv ist (der Aufrufer überspringt)
  if (lage.sperre) return { art: 'sperre', text: `Versand gesperrt: ${lage.sperre}.` };
  const st = (k.zielStaende ?? []).find(y => gleichesZiel(y, x.ziel));
  if (x.schrittId === FUND_SCHRITT) {
    if (st && istEnde(st)) return { art: 'veraltet', text: `Nicht gesendet: das Ziel läuft in dieser Kampagne nicht mehr (${st.grund ?? st.status}).` };
  } else {
    if (!nochZiel(k, x.ziel)) return { art: 'veraltet', text: 'Nicht gesendet: das Ziel wurde aus der Kampagne genommen.' };
    if (!st || st.status !== 'wartet' || schrittVon(k, st)?.id !== x.schrittId) return { art: 'veraltet', text: `Nicht gesendet: das Ziel steht nicht mehr an diesem Schritt${st && istEnde(st) ? ` (${st.grund ?? st.status})` : ''}.` };
  }
  if (lage.email && ungueltig.has(ungueltigHash(lage.email))) return { art: 'sperre', text: 'Die Adresse ist als unzustellbar vermerkt.' };
  if (!lage.email || lage.email !== x.an.email) return { art: 'vorlaeufig', text: 'Die Mail-Adresse des Ziels hat sich geändert — bitte prüfen und erneut freigeben.' };
  const a = lage.ampel('mail');
  if (a.farbe === 'rot' && a.grund !== 'keine Adresse') {
    // Die Mail eines Homepage-Funds trägt ihre Freigabe „auf eigenes Risiko“ aus dem ZOE-Stapel (wie bis 01.11. der direkte Weg) — für jedes Funde-Profil.
    if (!risikoPlaybook(k) && !x.fundId) return { art: 'vorlaeufig', text: `Nicht gesendet: Kanal-Ampel inzwischen rot (${a.grund}) — erst klären, dann erneut freigeben.` };
    if (!risiko) return { art: 'vorlaeufig', text: 'Nicht gesendet: „eigenes Risiko“ ist inzwischen ausgeschaltet — erst wieder einschalten, dann erneut freigeben.' };
    if (!x.freigabe?.eigenesRisiko) return { art: 'vorlaeufig', text: 'Nicht gesendet: Kanal-Ampel rot, die Freigabe war nicht auf eigenes Risiko — bitte erneut freigeben.' };
  }
  return null;
}

/**
 * Freigegebene Mails senden — nur im Zeitfenster, je Postfach höchstens die Tagesgrenze, über die Fensterstunden verteilt (`stundenKontingent`) und
 * je Lauf `JE_LAUF_MAX`. Neustart-fest: der Eintrag wird VOR dem Senden als „sendet“ markiert (in der Sperre, mit Zähler); hängt er länger als
 * `SENDET_HAENGT_MS`, wird er „unklar“ und nie automatisch noch einmal gesendet. Was nicht rausging (gesperrt, verworfen, Fehler, vorübergehend
 * gescheitert), gibt sein Kontingent zurück. Vorübergehende Fehler (Verbindung, Anmeldung, 429, 5xx) bleiben freigegeben und kommen mit Rückoff
 * wieder; die freigebende Person bekommt dazu höchstens EINE Glocke am Tag.
 */
export async function versenden(jetzt = new Date()): Promise<{ gesendet: number; fehler: number; gesperrt: number; spaeter: number }> {
  const z = { gesendet: 0, fehler: 0, gesperrt: 0, spaeter: 0 };
  const am = jetzt.toISOString();
  // Hängende Versuche zuerst (auch außerhalb des Fensters).
  await aenderePost(b => ({ ...b, eintraege: b.eintraege.map(x => (x.status === 'sendet' && x.sendetSeit && jetzt.getTime() - Date.parse(x.sendetSeit) > SENDET_HAENGT_MS
    ? { ...x, status: 'unklar' as const, fehler: UNKLAR_TEXT, geaendert: am } : x)) }));
  if (!imZeitfenster(jetzt)) return z;
  const vorher = await ladePost();
  if (!vorher.eintraege.some(x => x.status === 'freigegeben')) return z;
  const crm = await ladeCrm();
  const aktiv = new Set(crm.kampagnen.filter(k => k.status === 'aktiv' && !k.geloeschtAm).map(k => k.id));
  const tag = localDay(jetzt);
  const stunde = berlinStunde(jetzt);
  // M1 (01.11.): erst prüfen, dann zählen — ohne Absender-/Impressumszeile bzw. Abmeldelink geht nichts raus, und das Tageskontingent bleibt frei.
  const fuss = await fusszeileFuer(vorher.einstellungen);
  const { abmeldeLink } = await import('@/lib/datenschutz/abmelden');
  const ohneFuss = 'Absender-/Impressumszeile fehlt (Kampagnen-Einstellungen) — ohne sie geht keine Kampagnen-Mail raus.';
  const ohneAbmelden = 'Ohne Abmeldelink kein Versand (Adresse der Instanz bzw. Pepper fehlt).';
  const nichtAktiv = 'Die Kampagne ist nicht aktiv — die Mail wartet freigegeben, bis die Kampagne wieder aktiv ist.';
  // In dieser Stunde schon gesendet bzw. unterwegs — je Person|Postfach (für die Verteilung über das Fenster, Fund 16).
  const dieseStunde = new Map<string, number>();
  for (const x of vorher.eintraege) {
    const wann = x.gesendet?.am ?? (x.status === 'sendet' || x.status === 'unklar' ? x.sendetSeit : undefined);
    if (!x.freigabe || !wann || localDay(new Date(wann)) !== tag || berlinStunde(new Date(wann)) !== stunde) continue;
    const s = zaehlerSchluessel(tag, x.freigabe.von, x.freigabe.postfach);
    dieseStunde.set(s, (dieseStunde.get(s) ?? 0) + 1);
  }
  // Beanspruchen: je Person|Postfach bis zur Grenze, Zähler sofort hoch.
  let geholt: PostEintrag[] = [];
  await aenderePost(b => {
    const tage: Record<string, number> = Object.fromEntries(Object.entries(b.tage).filter(([s]) => s.slice(0, 10) >= tagePlus(tag, -7)));
    const jeLauf = new Map<string, number>();
    const eintraege = [...b.eintraege].sort((a, c) => (a.freigabe?.am ?? '').localeCompare(c.freigabe?.am ?? '')).map(x => {
      if (x.status !== 'freigegeben' || !x.freigabe) return x;
      // Fund 12 (B-Prüfung, 02.11.): eine freigegebene Mail einer nicht aktiven Kampagne liegt nicht still — sie trägt den Grund.
      if (!aktiv.has(x.kampagneId)) return x.hinweis === nichtAktiv ? x : { ...x, hinweis: nichtAktiv, geaendert: am };
      if (x.naechsterVersuch && x.naechsterVersuch > am) return x;
      const vorab = !fuss ? ohneFuss : !abmeldeLink(x.an.email) ? ohneAbmelden : null;
      if (vorab) { if (vorab !== x.fehler) z.fehler++; return x.fehler === vorab ? x : { ...x, fehler: vorab, geaendert: am }; }
      const s = zaehlerSchluessel(tag, x.freigabe.von, x.freigabe.postfach);
      const lauf = jeLauf.get(s) ?? 0;
      const proStunde = stundenKontingent({ tagesgrenze: b.einstellungen.tagesgrenze, heuteGesendet: tage[s] ?? 0, dieseStunde: dieseStunde.get(s) ?? 0, stunde });
      if ((tage[s] ?? 0) >= b.einstellungen.tagesgrenze || lauf >= Math.min(JE_LAUF_MAX, proStunde)) return x;
      tage[s] = (tage[s] ?? 0) + 1; jeLauf.set(s, lauf + 1);
      const { hinweis: _h, ...rest } = x;
      const n = { ...rest, status: 'sendet' as const, sendetSeit: am, geaendert: am };
      geholt.push(n);
      return n;
    });
    return { ...b, eintraege: b.eintraege.map(x => eintraege.find(y => y.id === x.id) ?? x), tage };
  });
  if (!geholt.length) return z;
  geholt = geholt.sort((a, c) => (a.freigabe?.am ?? '').localeCompare(c.freigabe?.am ?? ''));
  const risiko = await eigenesRisiko();
  const kx = await kontextLaden(vorher.ungueltig, jetzt);
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  const hakt = new Map<string, { kampagneId: string; n: number }>(); // freigebende Person → vorübergehend gescheiterte Mails (Glocke)
  for (const x of geholt) {
    const k = kx.crm.kampagnen.find(y => y.id === x.kampagneId);
    const lage = zielLage(x.ziel, kx);
    const s = zaehlerSchluessel(tag, x.freigabe!.von, x.freigabe!.postfach);
    // Was nicht rausging, verbraucht kein Kontingent (Fund 16): der Zähler geht in derselben Sperre zurück.
    const ergebnis = async (teil: Partial<PostEintrag>, zurueck = true) => aenderePost(b => ({
      ...b, eintraege: b.eintraege.map(y => (y.id === x.id ? { ...y, ...teil, geaendert: new Date().toISOString() } : y)),
      ...(zurueck && (b.tage[s] ?? 0) > 0 ? { tage: { ...b.tage, [s]: b.tage[s] - 1 } } : {}),
    }), { wer: { art: 'person', person: x.freigabe!.von } });
    const sperre = sendeSperre(x, k, lage, risiko, kx.ungueltig);
    if (sperre?.art === 'sperre') { await ergebnis({ status: 'gesperrt', fehler: sperre.text, sendetSeit: undefined }); z.gesperrt++; continue; }
    if (sperre?.art === 'veraltet') { await ergebnis({ status: 'verworfen', hinweis: sperre.text, sendetSeit: undefined }); z.gesperrt++; continue; }
    if (sperre?.art === 'vorlaeufig') {
      // Zurück in den Entwurf (Fund 7): eine geänderte Adresse kommt gleich mit — freigeben muss wieder jemand.
      await ergebnis({ status: lage.email ? 'entwurf' : 'fehler', ...(lage.email ? { an: { ...x.an, email: lage.email }, hinweis: sperre.text } : { fehler: 'Das Ziel hat keine Mail-Adresse mehr.' }), freigabe: undefined, sendetSeit: undefined });
      z.spaeter++; continue;
    }
    if (!fuss) { await ergebnis({ status: 'freigegeben', sendetSeit: undefined, fehler: ohneFuss }); z.fehler++; continue; }
    const ab = abmeldeLink(x.an.email);
    if (!ab) { await ergebnis({ status: 'freigegeben', sendetSeit: undefined, fehler: ohneAbmelden }); z.fehler++; continue; }
    const vorschau = /\{\{\s*vorschauLink/.test(x.text) ? await vorschauLinkNeu(lage.fund?.id, kx.heute) : null;
    const fertig = mailFertig(x.text, { abmeldeLink: ab.link, vorschauLink: vorschau, fusszeile: fuss, art14: lage.fremddaten ? (vorher.einstellungen.art14Text || ART14_VORGABE) : null });
    if (fertig.fehler) { await ergebnis({ status: 'fehler', fehler: fertig.fehler, sendetSeit: undefined }); z.fehler++; continue; }
    const person = x.freigabe!.von;
    let r: { status: number; body: Record<string, unknown> };
    try {
      // `uwgBestaetigt` nur auf eigenes Risiko — ohne den Modus sperrt `pruefeEmpfaenger` eine rote Ampel mit werblichen Wörtern (409 uwg → gesperrt).
      r = await inboxSenden(person, { neu: { postfach: x.freigabe!.postfach, betreff: x.betreff }, an: [{ email: x.an.email!, name: x.an.name }], text: fertig.text, uwgBestaetigt: !!x.freigabe!.eigenesRisiko }, { art: 'person', person }, { listeAbmelden: { link: ab.link }, automatisch: true });
    } catch (err) {
      r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.', geworfen: true, ...(err instanceof Error && err.name === 'GoogleUeberlastet' ? { ueberlastet: true } : {}) } };
    }
    if (r.status !== 200 || r.body.ok !== true) {
      const art = sendefehlerArt(r);
      const grund = String(r.body.fehler ?? `Fehler ${r.status}`).slice(0, 240);
      if (art === 'sperre') { await ergebnis({ status: 'gesperrt', fehler: `Versand gesperrt: ${String(r.body.fehler ?? '§ 7 UWG / Art. 18')}`, sendetSeit: undefined }); z.gesperrt++; continue; }
      if (art === 'unklar') { await ergebnis({ status: 'unklar', fehler: UNKLAR_TEXT }, false); z.fehler++; continue; }
      if (art === 'vorlaeufig') {
        const n = (x.versuche ?? 0) + 1;
        if (n >= VERSUCHE_MAX) { await ergebnis({ status: 'fehler', fehler: `Nicht gesendet: ${n}-mal vorübergehend gescheitert (zuletzt: ${grund}) — Verbindung prüfen, dann „Erneut vorbereiten“.`, sendetSeit: undefined, versuche: n, naechsterVersuch: undefined }); z.fehler++; }
        else { const ab = new Date(jetzt.getTime() + rueckoffMs(n)); await ergebnis({ status: 'freigegeben', hinweis: `Versand vorübergehend gescheitert (${grund}) — neuer Versuch ab ${ab.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr.`, sendetSeit: undefined, versuche: n, naechsterVersuch: ab.toISOString() }); z.spaeter++; }
        const h = hakt.get(person) ?? { kampagneId: x.kampagneId, n: 0 };
        hakt.set(person, { kampagneId: h.kampagneId, n: h.n + 1 });
        continue;
      }
      await ergebnis({ status: 'fehler', fehler: `Nicht gesendet: ${grund}`, sendetSeit: undefined }); z.fehler++;
      continue;
    }
    const gesendet = { am: new Date().toISOString(), ...(typeof r.body.id === 'string' ? { id: r.body.id } : {}), ...(typeof r.body.threadId === 'string' ? { threadId: r.body.threadId } : {}), ...(typeof r.body.messageId === 'string' ? { messageId: r.body.messageId } : {}) };
    await ergebnis({ status: 'gesendet', gesendet, sendetSeit: undefined, fehler: undefined, hinweis: undefined, naechsterVersuch: undefined }, false);
    z.gesendet++;
    await nachDemSenden(x, k!, person, gesendet.am, typeof r.body.von === 'string' ? r.body.von : '').catch(e => console.error('[kampagnen] nach dem Senden:', e instanceof Error ? e.message.slice(0, 160) : e));
  }
  if (hakt.size) await versandHaktMelden(hakt, tag);
  return z;
}

const UNKLAR_TEXT = 'Der Versand wurde unterbrochen — bitte im Postfach unter „Gesendet“ nachsehen; erst dann „erneut vorbereiten“.';

/** EINE Glocke je freigebender Person und Tag, wenn ihr Versand vorübergehend hakt (Fund 4) — neutral, ohne Namen und Adressen. Wirft nie. */
async function versandHaktMelden(hakt: Map<string, { kampagneId: string; n: number }>, tag: string): Promise<void> {
  try {
    const post = await ladePost();
    const offen = Array.from(hakt).filter(([person]) => post.gemeldet[`versand-hakt|${person}`] !== tag);
    if (!offen.length) return;
    const { melde } = await import('@/lib/meldungen/melden');
    const { WEG } = await import('@/lib/wege');
    for (const [person, h] of offen) await melde({ an: person, art: 'postfach', titel: `Kampagnen-Versand hakt gerade — ${h.n === 1 ? 'eine freigegebene Mail wartet' : `${h.n} freigegebene Mails warten`} auf einen neuen Versuch (Postfach-Verbindung prüfen).`, link: WEG.kampagne(h.kampagneId) });
    await aenderePost(b => ({ ...b, gemeldet: { ...Object.fromEntries(Object.entries(b.gemeldet).filter(([, t]) => t >= tagePlus(tag, -7))), ...Object.fromEntries(offen.map(([person]) => [`versand-hakt|${person}`, tag])) } }));
  } catch (e) { console.warn('[kampagnen] Glocke Versand:', e instanceof Error ? e.message.slice(0, 120) : e); }
}

/** Nach dem Senden: Stand weiter, Ergebnis „angesprochen“ an der Kampagne, Aktivität an der Akte (Betreff, nie Text). */
async function nachDemSenden(x: PostEintrag, k: Kampagne, person: string, am: string, ueber = ''): Promise<void> {
  const heute = localDay(new Date(am));
  await aendereCrm(c => ({
    ...c, kampagnen: c.kampagnen.map(y => {
      if (y.id !== k.id) return y;
      const s = (y.zielStaende ?? []).find(st => gleichesZiel(st, x.ziel));
      const mit = s && s.status === 'wartet' && schrittVon(y, s)?.id === x.schrittId ? standErsetzen(y, weiter(y, s, heute, am, 'gesendet', person)) : y;
      if (x.ziel.art === 'kontakt') return !y.ergebnisse.some(e => e.kontaktId === x.ziel.id && e.ergebnis === 'angesprochen')
        ? { ...mit, ergebnisse: [...mit.ergebnisse, { kontaktId: x.ziel.id, ergebnis: 'angesprochen' as const, am: heute, von: person }], geaendert: am, geaendertVon: person } : mit;
      // Betrieb ohne Person (M1, 01.11.): das Ergebnis steht in `firmenErgebnisse` — die Personen-Liste bleibt, wie sie ist.
      return !(y.firmenErgebnisse ?? []).some(e => e.firmaId === x.ziel.id && e.ergebnis === 'angesprochen')
        ? { ...mit, firmenErgebnisse: [...(mit.firmenErgebnisse ?? []), { firmaId: x.ziel.id, ergebnis: 'angesprochen' as const, am: heute, von: person }], geaendert: am, geaendertVon: person } : mit;
    }),
    // Die Mail eines Homepage-Funds: der Lead des Betriebs ist jetzt „kontaktiert“ (wie bis 01.11. der direkte Weg).
    ...(x.fundId ? { firmen: c.firmen.map(f => {
      const zielFirma = x.ziel.art === 'firma' ? x.ziel.id : undefined;
      return (f.id === zielFirma || (!zielFirma && f.lead?.hauptKontaktId === x.ziel.id)) && f.lead?.status === 'neu' ? { ...f, lead: { ...f.lead, status: 'kontaktiert' as const } } : f;
    }) } : {}),
  }), { art: 'person', person });
  if (x.fundId) {
    const { aendereFunde } = await import('@/lib/funde/speicher');
    const { adresseMaskiert } = await import('@/lib/zugang/konten');
    const id = x.fundId;
    await aendereFunde(b => ({ ...b, funde: b.funde.map(f => (f.id === id && !f.gesendet ? { ...f, status: 'gesendet' as const, gesendet: { am, ueber: adresseMaskiert(ueber), von: person, eigenesRisiko: true as const }, geaendert: am } : f)) }), { wer: { art: 'person', person } });
  }
  if (x.ziel.art !== 'kontakt') return;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const l = cur ?? { kontakte: [] };
    return { ...l, kontakte: l.kontakte.map(y => (y.id === x.ziel.id ? { ...y, aktivitaeten: [...(y.aktivitaeten ?? []), { am, art: 'mail' as const, text: `Mail: ${x.betreff} (Kampagne „${k.name}“${x.fundId ? ', auf eigenes Risiko freigegeben' : ''})`, von: person }], letzterKontakt: heute } : y)) };
  }, { art: 'person', person });
}

/** Absender-/Impressumszeile: Einstellung der Kampagnen, sonst der Verantwortliche aus der Einrichtung der Instanz — sonst null (kein Versand). */
async function fusszeileFuer(e: MotorEinstellungen): Promise<string | null> {
  if (e.fusszeile?.trim()) return e.fusszeile.trim();
  try {
    const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
    const ds = await datenschutzOeffentlichLaden();
    const v = (ds.verantwortlich ?? '').trim();
    return v ? `${v}${ds.seite ? ` · Impressum & Datenschutz: ${ds.seite}` : ''}` : null;
  } catch { return null; }
}

// ── Rückfluss ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Köpfe eines Spiegels für den Rückfluss. `alles` = die sendende Person (ihr ganzer Spiegel, wie bis 02.11.); sonst (Fund 8, B-Prüfung 02.11.) nur
 * Business-Postfächer einer anderen Person des Haushalts — antwortet das Ziel an eine andere Adresse des Teams, zählt das auch. Aus diesen Spiegeln
 * geht NUR das Signal „Antwort von Ziel X“ in die Kampagne, nie ein Inhalt, und nie etwas aus einem Privat-Postfach.
 */
async function spiegelVon(person: string, alles = true): Promise<{ koepfe: RueckKopf[]; eigene: string[] }> {
  const koepfe: RueckKopf[] = [];
  const eigene: string[] = [];
  let register: { id: string; quelle: string; bereich?: string | null; adresse: string }[] = [];
  let business: (b: string | null | undefined) => boolean = () => false;
  try {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    const { formularPostfachBereichOk } = await import('./formulare');
    register = await ladePostfaecher(person) as typeof register;
    business = b => !!b && formularPostfachBereichOk(b as never);
  } catch { /* ohne Register: nur die eigene Person, wie bisher */ }
  try {
    const { ladeGmailStand } = await import('@/lib/gmail/stand');
    const g = await ladeGmailStand(person);
    const gmailBusiness = register.some(p => p.quelle === 'gmail' && business(p.bereich));
    if (g) { eigene.push(g.email.toLowerCase(), ...(g.aliase ?? []).map(a => a.email.toLowerCase())); if (alles || gmailBusiness) koepfe.push(...Object.values(g.koepfe) as RueckKopf[]); }
  } catch { /* ohne Gmail */ }
  try {
    const { ladeImapStand } = await import('@/lib/postfach/spiegel');
    const s = await ladeImapStand(person);
    const erlaubt = new Set(register.filter(p => p.quelle === 'imap' && business(p.bereich)).map(p => p.id));
    koepfe.push(...(Object.values(s.koepfe) as unknown as (RueckKopf & { postfachId?: string })[]).filter(k => alles || (!!k.postfachId && erlaubt.has(k.postfachId))));
    eigene.push(...register.filter(p => p.quelle !== 'whatsapp' && p.adresse).map(p => p.adresse.toLowerCase()));
  } catch { /* ohne IMAP */ }
  return { koepfe: koepfe.sort((a, b) => a.am.localeCompare(b.am)), eigene };
}

/** Die Spiegel für den Rückfluss: die sendende Person ganz, die übrigen Personen des Haushalts nur mit ihren Business-Postfächern (Fund 8). */
export async function rueckflussSpiegel(sender: string, cache: Map<string, { koepfe: RueckKopf[]; eigene: string[] }>): Promise<{ koepfe: RueckKopf[]; eigene: string[] }> {
  const key = `sender:${sender}`;
  const da = cache.get(key);
  if (da) return da;
  let personen: string[] = [];
  try { personen = await (await import('@/lib/aufgaben/sicht')).haushaltsSpeicher(); } catch { /* nur die sendende Person */ }
  const teile = await Promise.all([spiegelVon(sender, true), ...personen.filter(p => p !== sender).map(p => spiegelVon(p, false))]);
  const r = { koepfe: teile.flatMap(t => t.koepfe).sort((a, b) => a.am.localeCompare(b.am)), eigene: Array.from(new Set(teile.flatMap(t => t.eigene))) };
  cache.set(key, r);
  return r;
}

/**
 * Offene Follow-ups der Sequenz zu einem Ziel absagen (die Sequenz endet) — rein. Mit `fundId` auch das „Anrufen … nur ohne Antwort/Abmeldung“ des
 * Homepage-Funds (`fu-<fund>`, lib/funde/uebernehmen.ts) — M1, 01.11.: es stand bis dahin trotz Antwort weiter da.
 */
export function sequenzFollowupsAbsagen(c: CrmBestand, kampagneId: string, ziel: KampagnenZiel, grund: string, am: string, fundId?: string): FollowUp[] {
  const k = c.kampagnen.find(x => x.id === kampagneId);
  const ids = new Set([...(k?.sequenz ?? []).map(s => sequenzFollowupId(kampagneId, ziel, s.id)), ...(fundId ? [`fu-${fundId}`] : [])]);
  return (c.followups ?? []).map(f => (ids.has(f.id) && f.status === 'offen' ? { ...f, status: 'abgesagt' as const, notiz: `${f.notiz ? `${f.notiz}\n\n` : ''}${grund}`.slice(0, 1000), geaendert: am } : f));
}

/** Gesendete Kopie eines „unklar“ gebliebenen Eintrags im Spiegel (Fund 18): an die Adresse, mit dem Betreff, nach Beginn des Versuchs. Rein. */
export function gesendeteKopie(x: Pick<PostEintrag, 'an' | 'betreff' | 'sendetSeit' | 'geaendert'>, koepfe: readonly RueckKopf[]): RueckKopf | null {
  const an = x.an.email?.toLowerCase();
  if (!an) return null;
  const ab = new Date(Date.parse(x.sendetSeit ?? x.geaendert) - 60_000).toISOString();
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  return koepfe.find(k => (k.labels.includes('SENT') || k.ordner === 'g') && k.am >= ab && norm(k.betreff) === norm(x.betreff) && (k.an ?? []).some(a => a.email?.toLowerCase() === an)) ?? null;
}

/**
 * Antworten und Rückläufer gesendeter Mails erkennen (Spiegel der sendenden Person + Business-Postfächer des Haushalts) — idempotent über
 * `rueckfluss` am Eintrag. Nur die letzten 60 Tage. Seit 02.11. (B-Prüfung): „unklar“ gebliebene Versuche werden zu „gesendet“, sobald die Kopie in
 * „Gesendet“ bzw. eine Antwort auftaucht (Fund 18); eine Antwort beendet das Ziel in ALLEN Kampagnen (Fund 17), verwirft seine noch nicht
 * gesendeten Einträge (Fund 2) und steht als Aktivität „Antwort“ an der Akte der Person (Fund 9).
 */
export async function rueckfluss(jetzt = new Date()): Promise<{ antworten: number; ruecklaeufer: number; geklaert: number }> {
  const z = { antworten: 0, ruecklaeufer: 0, geklaert: 0 };
  const post = await ladePost();
  const ab = new Date(jetzt.getTime() - 60 * 864e5).toISOString();
  const offen = post.eintraege.filter(x => (x.status === 'gesendet' || x.status === 'unklar') && !x.rueckfluss && x.freigabe && (x.gesendet?.am ?? x.sendetSeit ?? '') >= ab);
  if (!offen.length) return z;
  const cache = new Map<string, { koepfe: RueckKopf[]; eigene: string[] }>();
  const treffer: { x: PostEintrag; art: 'antwort' | 'bounce'; am: string; betreff: string }[] = [];
  const geklaert: { x: PostEintrag; gesendet: NonNullable<PostEintrag['gesendet']> }[] = [];
  for (const x of offen) {
    const sp = await rueckflussSpiegel(x.freigabe!.von, cache);
    let g = x.gesendet;
    if (x.status === 'unklar') {
      const kopie = gesendeteKopie(x, sp.koepfe);
      const pseudo = { am: x.sendetSeit ?? x.geaendert };
      const antwort = !kopie ? sp.koepfe.find(kopf => rueckflussArt({ an: x.an, gesendet: pseudo }, kopf, sp.eigene) === 'antwort') : undefined;
      if (!kopie && !antwort) continue;
      g = kopie ? { am: kopie.am, id: kopie.id, ...(kopie.threadId ? { threadId: kopie.threadId } : {}), ...(kopie.messageId ? { messageId: kopie.messageId } : {}) } : pseudo;
      geklaert.push({ x, gesendet: g });
    }
    if (!g) continue;
    // Gmail: die Message-ID der gesendeten Nachricht steht im Spiegel (gesendet → gespiegelt).
    const mid = g.messageId ?? (g.id ? sp.koepfe.find(k => k.id === g!.id)?.messageId : undefined);
    const mitMid = { ...x, gesendet: { ...g, ...(mid ? { messageId: mid } : {}) } };
    const k = sp.koepfe.find(kopf => kopf.id !== g!.id && rueckflussArt(mitMid, kopf, sp.eigene));
    if (k) treffer.push({ x: { ...x, gesendet: mitMid.gesendet }, art: rueckflussArt(mitMid, k, sp.eigene)!, am: k.am, betreff: k.betreff });
  }
  if (!treffer.length && !geklaert.length) return z;
  const am = jetzt.toISOString(), heute = localDay(jetzt);
  // „Unklar“ → „gesendet“ (die Kopie bzw. die Antwort zeigt: sie ging raus) — mit den Folgen des Sendens (Stand weiter, Aktivität).
  if (geklaert.length) {
    await aenderePost(b => ({ ...b, eintraege: b.eintraege.map(y => { const g = geklaert.find(q => q.x.id === y.id); return g && y.status === 'unklar' ? { ...y, status: 'gesendet' as const, gesendet: g.gesendet, fehler: undefined, sendetSeit: undefined, geaendert: am } : y; }) }));
    for (const g of geklaert) {
      const k = (await ladeCrm()).kampagnen.find(y => y.id === g.x.kampagneId);
      if (k) await nachDemSenden(g.x, k, g.x.freigabe!.von, g.gesendet.am).catch(e => console.error('[kampagnen] nach dem Senden (unklar):', e instanceof Error ? e.message.slice(0, 160) : e));
      z.geklaert++;
    }
  }
  if (!treffer.length) return z;
  await aendereCrm(c => {
    let neu = c;
    for (const t of treffer) {
      const k = neu.kampagnen.find(y => y.id === t.x.kampagneId);
      if (!k) continue;
      const s = (k.zielStaende ?? []).find(st => gleichesZiel(st, t.x.ziel));
      const fuId = t.art === 'antwort' ? antwortFollowupId(t.x.id) : bounceFollowupId(t.x.id);
      const kontaktId = t.x.ziel.art === 'kontakt' ? t.x.ziel.id : undefined;
      const followups = sequenzFollowupsAbsagen(neu, k.id, t.x.ziel, t.art === 'antwort' ? 'Antwort kam — die Sequenz endet.' : 'Mail kam zurück — die Sequenz endet.', am, t.x.fundId);
      if (!followups.some(f => f.id === fuId)) {
        followups.push(neuesFollowUp({
          id: fuId, bezug: kontaktId ? { art: 'kontakt', id: kontaktId } : { art: 'firma', id: t.x.ziel.id }, ...(kontaktId ? { kontaktId } : {}), art: t.art === 'antwort' ? 'mail' : 'sonstig',
          text: t.art === 'antwort' ? `Antwort bearbeiten: Kampagne „${k.name}“${t.x.ziel.art === 'firma' ? ` · ${t.x.an.name}` : ''}` : `Mail kam zurück — Adresse prüfen (Kampagne „${k.name}“${t.x.ziel.art === 'firma' ? ` · ${t.x.an.name}` : ''})`,
          faellig: heute, zustaendig: t.x.freigabe!.von, quelle: 'kampagne', anlass: 'antwort',
        }, undefined, 'system', am));
      }
      const kampagne = s && !istEnde(s) ? standErsetzen(k, t.art === 'antwort' ? beenden(s, 'reagiert', 'Antwort erhalten', am, 'reagiert') : beenden(s, 'gestoppt', 'Adresse unzustellbar', am, 'bounce')) : k;
      const ergebnisse = t.art === 'antwort' && kontaktId && !kampagne.ergebnisse.some(e => e.kontaktId === kontaktId && e.ergebnis === 'reagiert')
        ? [...kampagne.ergebnisse, { kontaktId, ergebnis: 'reagiert' as const, am: heute }] : kampagne.ergebnisse;
      const firmaId = t.x.ziel.art === 'firma' ? t.x.ziel.id : undefined;
      const firmenErgebnisse = t.art === 'antwort' && firmaId && !(kampagne.firmenErgebnisse ?? []).some(e => e.firmaId === firmaId && e.ergebnis === 'reagiert')
        ? [...(kampagne.firmenErgebnisse ?? []), { firmaId, ergebnis: 'reagiert' as const, am: heute }] : kampagne.firmenErgebnisse;
      neu = { ...neu, followups, kampagnen: neu.kampagnen.map(y => (y.id === k.id ? { ...kampagne, ergebnisse, ...(firmenErgebnisse ? { firmenErgebnisse } : {}) } : y)) };
      // Fund 17: eine Antwort beendet dasselbe Ziel auch in jeder ANDEREN laufenden Kampagne (keine zweite Erstansprache nach einer Antwort).
      if (t.art === 'antwort') for (const andere of neu.kampagnen) {
        if (andere.id === k.id) continue;
        const st = (andere.zielStaende ?? []).find(y => gleichesZiel(y, t.x.ziel));
        if (!st || istEnde(st)) continue;
        neu = { ...neu, followups: sequenzFollowupsAbsagen(neu, andere.id, t.x.ziel, 'Antwort in einer anderen Kampagne — die Sequenz endet.', am), kampagnen: neu.kampagnen.map(y => (y.id === andere.id ? standErsetzen(andere, beenden(st, 'gestoppt', `Antwort in Kampagne „${k.name}“`, am, 'gestoppt')) : y)) };
      }
      if (t.art === 'antwort') z.antworten++; else z.ruecklaeufer++;
    }
    return neu;
  }, { art: 'system' });
  // Fund 9: die Antwort steht in der Akte (Score, Lead, letzter Kontakt) — über den Kartei-Schreibweg, Art. 18 → nichts.
  // R2-4 Fund 2: Follow-up (oben, feste Kennung) und Akte (idempotent über Kampagne + Betreff) ZUERST, dann der Haken `rueckfluss` — scheitert die Akte,
  // bleibt der Haken für diese Antworten weg und der nächste Lauf holt sie nach (vorher stand der Haken schon, und die Antwort fehlte still).
  const antworten = treffer.filter(t => t.art === 'antwort' && t.x.ziel.art === 'kontakt');
  const akteOk = !antworten.length || await antwortAnAkte(antworten.map(t => ({ kontaktId: t.x.ziel.id, kampagneId: t.x.kampagneId, betreff: t.betreff, am: t.am })), heute).then(() => true, e => { console.error('[kampagnen] Antwort an die Akte:', e instanceof Error ? e.message.slice(0, 160) : e); return false; });
  // Was zu diesem Ziel noch nicht raus ist, wird trotzdem sofort verworfen (sonst ginge die nächste Stufe hinaus) — nur der Haken wartet.
  const fertig = new Set((akteOk ? treffer : treffer.filter(t => !(t.art === 'antwort' && t.x.ziel.art === 'kontakt'))).map(t => t.x.id));
  {
    await aenderePost(b => {
      let n: PostBestand = {
        ...b,
        eintraege: b.eintraege.map(y => { const t = treffer.find(q => q.x.id === y.id && fertig.has(y.id)); return t && !y.rueckfluss ? { ...y, ...(t.art === 'bounce' ? { status: 'bounce' as const } : {}), rueckfluss: { art: t.art, am: t.am }, geaendert: am } : y; }),
        ungueltig: Array.from(new Set([...b.ungueltig, ...treffer.filter(t => t.art === 'bounce' && t.x.an.email).map(t => ungueltigHash(t.x.an.email!))])),
      };
      // Fund 2/17: was zu diesem Ziel noch nicht raus ist, geht nicht mehr raus — bei einer Antwort in JEDER Kampagne, beim Rückläufer in dieser.
      for (const t of treffer) n = zielEintraegeVerwerfen(n, t.art === 'antwort' ? null : t.x.kampagneId, t.x.ziel, t.art === 'antwort' ? 'Antwort kam — die Sequenz endet.' : 'Mail kam zurück — die Sequenz endet.', am);
      return n;
    });
  }
  return z;
}

/** Aktivität „Antwort“ an der Akte (Betreff, nie Text) — idempotent über Kampagne + Betreff; eingeschränkte Personen (Art. 18) bleiben unberührt. */
export async function antwortAnAkte(liste: { kontaktId: string; kampagneId: string; betreff: string; am: string }[], heute: string, vorsatz = 'Antwort auf Kampagnen-Mail'): Promise<void> {
  const { wendeAktivitaetAn } = await import('@/lib/make-one/crm');
  const jetzt = new Date().toISOString();
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const l = cur ?? { kontakte: [] };
    let geaendert = false;
    const kontakte = l.kontakte.map(k => {
      let neu = k;
      for (const a of liste.filter(x => x.kontaktId === k.id)) {
        if (neu.eingeschraenkt) continue;
        const text = `${vorsatz}: ${a.betreff.replace(/\s+/g, ' ').trim().slice(0, 160) || '(ohne Betreff)'}`;
        if ((neu.aktivitaeten ?? []).some(x => x.art === 'antwort' && x.bezug === a.kampagneId && x.text === text)) continue;
        neu = wendeAktivitaetAn(neu, { art: 'antwort', text, von: 'system', bezug: a.kampagneId, wann: a.am }, heute, jetzt, tagePlus);
        geaendert = true;
      }
      return neu;
    });
    return geaendert ? { ...l, kontakte } : l;
  }, { art: 'system' });
}

/**
 * Abmeldelink (lib/datenschutz/abmelden-server.ts ruft das nach jeder Abmeldung): jede Adresse aus dem Stapel, die zum Token passt → Sequenz gestoppt,
 * offene Entwürfe gesperrt, Follow-ups der Sequenz abgesagt — seit 02.11. (Fund 1) in JEDER Kampagne mit diesem Ziel, nicht nur in der der Mail.
 * Idempotent.
 */
export async function kampagnenAbmeldung(token: string, jetzt = new Date()): Promise<number> {
  const { tokenPasst } = await import('@/lib/datenschutz/abmelden');
  const post = await ladePost();
  const adressen = Array.from(new Set(post.eintraege.map(x => x.an.email).filter((x): x is string => !!x && tokenPasst(token, [x]))));
  if (!adressen.length) return 0;
  const am = jetzt.toISOString();
  const betroffen = post.eintraege.filter(x => x.an.email && adressen.includes(x.an.email));
  const ziele = Array.from(new Map(betroffen.map(x => [zielSchluessel(x.ziel), x.ziel])).values());
  const trifft = (x: PostEintrag) => (!!x.an.email && adressen.includes(x.an.email)) || ziele.some(z => gleichesZiel(z, x.ziel));
  await aenderePost(b => ({
    ...b, eintraege: b.eintraege.map(x => {
      if (!trifft(x)) return x;
      if (x.status === 'entwurf' || x.status === 'freigegeben' || x.status === 'fehler') return { ...x, status: 'gesperrt' as const, fehler: 'Abgemeldet (Abmeldelink)', geaendert: am };
      return x.status === 'gesendet' && !x.rueckfluss && x.an.email && adressen.includes(x.an.email) ? { ...x, rueckfluss: { art: 'abmeldung' as const, am }, geaendert: am } : x;
    }),
  }));
  await aendereCrm(c => {
    let neu = c;
    // Die Mail eines Homepage-Funds hat oft keinen Stand in einer Sequenz — ihr „Anrufen …“ wird trotzdem abgesagt (M1, 01.11.).
    for (const x of betroffen.filter(y => y.fundId)) neu = { ...neu, followups: sequenzFollowupsAbsagen(neu, x.kampagneId, x.ziel, 'Abgemeldet — die Sequenz endet.', am, x.fundId) };
    for (const ziel of ziele) for (const k of neu.kampagnen) {
      const s = k.zielStaende?.find(st => gleichesZiel(st, ziel));
      if (!s || istEnde(s)) continue;
      neu = { ...neu, followups: sequenzFollowupsAbsagen(neu, k.id, ziel, 'Abgemeldet — die Sequenz endet.', am), kampagnen: neu.kampagnen.map(y => (y.id === k.id ? standErsetzen(k, beenden(s, 'gestoppt', 'Abmeldung', am, 'abgemeldet')) : y)) };
    }
    return neu;
  }, { art: 'system' });
  return adressen.length;
}

// ── Aufräumen (Frist 12 Monate) ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ABGESCHLOSSEN_POST = new Set(['gesendet', 'verworfen', 'gesperrt', 'bounce', 'gedruckt']);
export const POST_FRIST_TAGE = 365;
/** Abgeschlossene Einträge älter als die Frist entfernen (Speicherbegrenzung, Art. 5 Abs. 1 lit. e) — nach Frist, nie nach Anzahl. */
export async function postAufraeumen(jetzt = new Date()): Promise<number> {
  const grenze = new Date(jetzt.getTime() - POST_FRIST_TAGE * 864e5).toISOString();
  const vorher = await ladePost();
  if (!vorher.eintraege.some(x => ABGESCHLOSSEN_POST.has(x.status) && x.geaendert < grenze)) return 0;
  let n = 0;
  await aenderePost(b => { const rest = b.eintraege.filter(x => !(ABGESCHLOSSEN_POST.has(x.status) && x.geaendert < grenze)); n = b.eintraege.length - rest.length; return { ...b, eintraege: rest }; });
  return n;
}

// ── Takt ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Herzschlag des Motors (Fund 5, B-Prüfung 02.11.) — je Teil der letzte gute Lauf und die Fehler in Folge. Nur Zeiten und Zähler, nie Inhalte. */
export const MOTOR_LAUF = 'kampagnen-motor-lauf';
export const MOTOR_TEILE = ['fortschreiben', 'rueckfluss', 'versand', 'aufraeumen', 'willkommen', 'willkommen-rueckfluss'] as const;
export type MotorTeil = typeof MOTOR_TEILE[number];
export interface MotorLauf { zuletzt: string; teile: Partial<Record<MotorTeil, { ok?: string; fehler?: { seit: string; n: number } }>> }

/** Lagebild für den HOI (lib/hoi/lage.ts `kampagnenMotorBefunde`): Herzschlag, Fehler je Teil, offene Freigaben/Fehler — nur Zahlen. */
export interface KampagnenMotorLage { zuletzt: string | null; minutenSeit: number | null; fehlerTeile: { teil: string; n: number }[]; freigegeben: number; fehler: number; unklar: number; sequenzen: number; /** R2-4 Fund 5: Personen, deren Willkommensstrecke nach einer gescheiterten Stufe wartet. */ willkommenGescheitert?: number }
export async function kampagnenMotorLage(jetzt = Date.now()): Promise<KampagnenMotorLage | null> {
  const [lauf, post, crm] = await Promise.all([loadJson<MotorLauf>(MOTOR_LAUF).catch(() => null), ladePost().catch(() => null), ladeCrm().catch(() => null)]);
  const sequenzen = (crm?.kampagnen ?? []).filter(k => k.status === 'aktiv' && !k.geloeschtAm && k.sequenz?.length).length;
  const e = post?.eintraege ?? [];
  const willkommenGescheitert = Object.values(post?.willkommen ?? {}).filter(w => (w.gescheitert ?? []).length).length;
  if (!lauf && !sequenzen && !e.length && !willkommenGescheitert) return null;
  return {
    zuletzt: lauf?.zuletzt ?? null, minutenSeit: lauf?.zuletzt ? Math.round((jetzt - Date.parse(lauf.zuletzt)) / 60_000) : null,
    fehlerTeile: Object.entries(lauf?.teile ?? {}).filter(([, t]) => (t?.fehler?.n ?? 0) > 0).map(([teil, t]) => ({ teil, n: t!.fehler!.n })),
    freigegeben: e.filter(x => x.status === 'freigegeben').length, fehler: e.filter(x => x.status === 'fehler').length, unklar: e.filter(x => x.status === 'unklar').length, sequenzen,
    ...(willkommenGescheitert ? { willkommenGescheitert } : {}),
  };
}

let laeuft = false;
let zuletzt = 0;
/**
 * Alle 2 Minuten aus dem Takt (/api/zoe/takt) — ein Lauf je Prozess. Seit 02.11. (Fund 5) läuft JEDER Teil für sich: ein Fehler im Rückfluss hält den
 * Versand nicht an; Herzschlag und Fehler in Folge stehen im Bestand `kampagnen-motor-lauf` (HOI-Befund).
 */
export async function motorImTakt(jetzt = new Date(), o: { sofort?: boolean } = {}): Promise<void> {
  if (laeuft || (!o.sofort && jetzt.getTime() - zuletzt < 2 * 60_000)) return;
  laeuft = true; zuletzt = jetzt.getTime();
  const ergebnis: Partial<Record<MotorTeil, boolean>> = {};
  const teil = async (name: MotorTeil, fn: () => Promise<unknown>) => {
    try { await fn(); ergebnis[name] = true; }
    catch (e) { ergebnis[name] = false; console.error(`[kampagnen] Motor › ${name}:`, e instanceof Error ? e.message.slice(0, 200) : e); }
  };
  try {
    await teil('fortschreiben', () => sequenzenFortschreiben(jetzt));
    await teil('rueckfluss', () => rueckfluss(jetzt));
    await teil('versand', () => versenden(jetzt));
    await teil('aufraeumen', () => postAufraeumen(jetzt));
    const w = await import('./willkommen');
    await teil('willkommen', () => w.willkommenImTakt(jetzt));
    await teil('willkommen-rueckfluss', () => w.willkommenRueckfluss(jetzt));
    const am = jetzt.toISOString();
    await updateJson<MotorLauf>(MOTOR_LAUF, cur => {
      const teile = { ...(cur?.teile ?? {}) };
      for (const [n, ok] of Object.entries(ergebnis) as [MotorTeil, boolean][]) {
        const alt = teile[n] ?? {};
        teile[n] = ok ? { ok: am } : { ...(alt.ok ? { ok: alt.ok } : {}), fehler: { seit: alt.fehler?.seit ?? am, n: (alt.fehler?.n ?? 0) + 1 } };
      }
      return { zuletzt: am, teile };
    }).catch(e => console.error('[kampagnen] Herzschlag:', e instanceof Error ? e.message.slice(0, 160) : e));
  } finally { laeuft = false; }
}
/** Nur für Tests. */
export function _motorZuruecksetzen(): void { laeuft = false; zuletzt = 0; }
