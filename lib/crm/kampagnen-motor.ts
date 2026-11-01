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
import { localDay, tagePlus } from '@/lib/zeit';
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
  rueckflussArt, SENDET_HAENGT_MS, sequenzFollowupId, zaehlerSchluessel, ART14_VORGABE,
  type MotorEinstellungen, type PostEintrag, type RueckKopf,
} from './kampagnen-post';
import type { CrmBestand, FollowUp, FollowUpArt, Kampagne, KampagnenZiel, SequenzSchritt, ZielStand } from './typen';

// ── Bestand ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PostBestand {
  eintraege: PostEintrag[];
  einstellungen: MotorEinstellungen;
  /** Zähler der Tagesgrenze `tag|person|postfach` → Anzahl (nur die letzten 7 Tage). */
  tage: Record<string, number>;
  /** Fingerabdrücke unzustellbarer Adressen (Rückläufer) — nie Klartext. */
  ungueltig: string[];
  /** Willkommensstrecke: je Kontakt der Start und die gesendeten Stufen (Kennung + Tag), nie Text. */
  willkommen: Record<string, { start: string; gesendet: number[] }>;
}
export const kampagnenPostName = (h: string): string => `kampagnen-post--${h}`;
const leer = (): PostBestand => ({ eintraege: [], einstellungen: einstellungenSaeubern({}), tage: {}, ungueltig: [], willkommen: {} });

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
    const sperre = !k ? 'nicht mehr in der Kartei' : k.eingeschraenkt ? 'Verarbeitung eingeschränkt (Art. 18)' : k.werbesperre ? 'Werbesperre' : sperrPruefer(kx.sperrliste)(k) ? 'Sperrliste' : undefined;
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
const nochZiel = (k: Kampagne, s: ZielStand) => zieleDerKampagne(k).some(z => gleichesZiel(z, s));

/** Mail-Einträge, die schon raus sind bzw. unterwegs (freigegeben, sendet, gesendet, unklar, unzustellbar). */
const RAUS = new Set(['freigegeben', 'sendet', 'gesendet', 'unklar', 'bounce']);
/**
 * Wer in dieser Kampagne schon angeschrieben ist (M1, 01.11., gegen die Doppel-Mail): eine Mail im Stapel, die raus ist bzw. unterwegs, und ein
 * Homepage-Fund dieser Kampagne mit gesendeter bzw. eingestellter Mail — bei einem Fund zählen Firma UND Person. Rein.
 */
export function schonAngeschrieben(k: Pick<Kampagne, 'id'>, eintraege: readonly PostEintrag[], funde: readonly Pick<FundKurz, 'id' | 'kampagneId' | 'firmaId' | 'kontaktId' | 'angeschrieben'>[]): Set<string> {
  const raus = new Set<string>();
  const vonFund = (f: Pick<FundKurz, 'firmaId' | 'kontaktId'>) => { if (f.firmaId) raus.add(`firma:${f.firmaId}`); if (f.kontaktId) raus.add(`kontakt:${f.kontaktId}`); };
  for (const x of eintraege) {
    if (x.kampagneId !== k.id || x.kanal !== 'mail' || !RAUS.has(x.status)) continue;
    raus.add(zielSchluessel(x.ziel));
    const f = x.fundId ? funde.find(y => y.id === x.fundId) : undefined;
    if (f) vonFund(f);
  }
  for (const f of funde) if (f.kampagneId === k.id && f.angeschrieben) vonFund(f);
  return raus;
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
  await aendereCrm(c => {
    const kxc = { ...kx, crm: c };
    const followups = [...(c.followups ?? [])];
    const fuNach = new Map(followups.map(f => [f.id, f]));
    const kampagnen = c.kampagnen.map(k0 => {
      if (!k0.sequenz?.length || k0.geloeschtAm) return k0;
      // {{absender}} = Vorname der zuständigen Person (bei „beide“ fehlt er — dann ist eine Vorlage mit {{absender}} ein Fehler, nie eine Lücke).
      const zst = zustaendig(k0.zustaendig, weltDerKampagne(k0));
      const absender = zst && zst !== BEIDE ? nameVon(zst).split(/\s+/)[0] : undefined;
      let k = k0;
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
      if (k.status !== 'aktiv') return k;
      // 2 · Ziele aus der Liste genommen → Ende; neue Ziele starten (gesperrte gar nicht erst).
      for (const s of k.zielStaende ?? []) if (!istEnde(s) && !nochZiel(k, s)) { k = standErsetzen(k, beenden(s, 'gestoppt', 'aus der Kampagne genommen', am, 'gestoppt')); z.gestoppt++; }
      // Gesperrte gar nicht erst; schon Angeschriebene (Fund-Mail, gesendete Mail im Stapel) auch nicht — sonst bekämen sie eine zweite Erstansprache.
      const raus = schonAngeschrieben(k, post.eintraege, kx.funde);
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
        const sch = schrittVon(k, s)!;
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
      return k;
    });
    return { ...c, kampagnen, followups };
  }, { art: 'system' });
  if (neuePost.length) await aenderePost(b => ({ ...b, eintraege: [...b.eintraege, ...neuePost.filter(e => !b.eintraege.some(x => x.id === e.id))] }));
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
  let n = 0, mitRisiko = false;
  await aenderePost(b => {
    const gewaehlt = b.eintraege.filter(x => ids.includes(x.id));
    if (gewaehlt.length !== ids.length) throw new MotorFehler(404, 'Ein Entwurf ist nicht (mehr) da — bitte neu laden.');
    for (const x of gewaehlt) {
      if (x.kampagneId !== k.id || x.kanal !== 'mail') throw new MotorFehler(400, 'Nur Mail-Entwürfe dieser Kampagne.');
      if (x.status !== 'entwurf') throw new MotorFehler(409, `„${x.an.name}“: ${x.status === 'fehler' ? `nicht freigebbar — ${x.fehler ?? 'Fehler im Entwurf'}` : 'ist nicht mehr im Entwurf'}.`);
      if (x.risiko && !(risikoPlaybook(k) && risiko)) throw new MotorFehler(409, `„${x.an.name}“: Kanal-Ampel rot — freigeben nur, wenn ein Inhaber „eigenes Risiko“ eingeschaltet hat (Homepage-Funde).`);
      if (x.risiko) mitRisiko = true;
      // Gelbe Ampel (M1, 01.11.): nur einzeln — wer freigibt, soll den Grund gesehen haben.
      if (x.gelb && ids.length > 1) throw new MotorFehler(409, `„${x.an.name}“: Kanal-Ampel gelb (${x.gelb}) — bitte einzeln freigeben, nicht in der Sammelfreigabe. Nichts freigegeben.`);
    }
    n = gewaehlt.length;
    return { ...b, eintraege: b.eintraege.map(x => (ids.includes(x.id) ? { ...x, status: 'freigegeben' as const, freigabe: { von: e.person, am, postfach: p.id, ...(x.risiko && risiko ? { eigenesRisiko: risiko } : {}) }, geaendert: am } : x)) };
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
  if (!betreff || !text) fehler.push('Betreff und Text dürfen nicht leer sein.');
  const am = jetzt.toISOString();
  let raus: PostEintrag | undefined;
  await aenderePost(b => {
    const x = b.eintraege.find(y => y.id === e.id);
    if (!x) throw new MotorFehler(404, 'Diesen Entwurf gibt es nicht (mehr).');
    if (x.status !== 'entwurf' && x.status !== 'fehler') throw new MotorFehler(409, 'Nur Entwürfe lassen sich bearbeiten.');
    const sperre = x.status === 'fehler' && x.fehler && /Sperr|Art\. 18|Werbesperre/.test(x.fehler);
    raus = { ...x, betreff, text, bearbeitet: { von: e.person, am, ...(e.zoe ? { zoe: true as const } : {}) }, status: fehler.length || sperre ? 'fehler' : 'entwurf', ...(fehler.length ? { fehler: fehler.join(' ') } : sperre ? {} : { fehler: undefined }), geaendert: am };
    if (!fehler.length && !sperre) delete raus.fehler;
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

/** Wer senden darf, prüft der Lauf erneut — die Lage kann sich seit der Freigabe geändert haben (Werbesperre, Abmeldung, Schalter aus). */
function sendeSperre(x: PostEintrag, k: Kampagne | undefined, lage: ZielLage, risiko: { seit: string; von: string } | null, ungueltig: Set<string>): string | null {
  if (!k || k.geloeschtAm) return 'Die Kampagne gibt es nicht mehr.';
  if (k.status !== 'aktiv') return null; // pausiert: bleibt freigegeben, geht weiter, sobald sie wieder aktiv ist (der Aufrufer überspringt)
  if (lage.sperre) return `Versand gesperrt: ${lage.sperre}.`;
  if (!lage.email || lage.email !== x.an.email) return 'Die Adresse des Ziels hat sich geändert — bitte neu vorbereiten.';
  if (ungueltig.has(ungueltigHash(lage.email))) return 'Die Adresse ist als unzustellbar vermerkt.';
  const a = lage.ampel('mail');
  if (a.farbe === 'rot' && a.grund !== 'keine Adresse') {
    // Die Mail eines Homepage-Funds trägt ihre Freigabe „auf eigenes Risiko“ aus dem ZOE-Stapel (wie bis 01.11. der direkte Weg) — für jedes Funde-Profil.
    if (!risikoPlaybook(k) && !x.fundId) return `Versand gesperrt: Kanal-Ampel rot (${a.grund}).`;
    if (!risiko) return 'Versand gesperrt: „eigenes Risiko“ ist inzwischen ausgeschaltet.';
    if (!x.freigabe?.eigenesRisiko) return 'Versand gesperrt: Kanal-Ampel rot, die Freigabe war nicht auf eigenes Risiko.';
  }
  return null;
}

/**
 * Freigegebene Mails senden — nur im Zeitfenster, je Postfach höchstens die Tagesgrenze und je Lauf `JE_LAUF_MAX`. Neustart-fest: der Eintrag wird
 * VOR dem Senden als „sendet“ markiert (in der Sperre, mit Zähler); hängt er länger als `SENDET_HAENGT_MS`, wird er „unklar“ und nie automatisch
 * noch einmal gesendet. Fehler stehen am Eintrag.
 */
export async function versenden(jetzt = new Date()): Promise<{ gesendet: number; fehler: number; gesperrt: number }> {
  const z = { gesendet: 0, fehler: 0, gesperrt: 0 };
  const am = jetzt.toISOString();
  // Hängende Versuche zuerst (auch außerhalb des Fensters).
  await aenderePost(b => ({ ...b, eintraege: b.eintraege.map(x => (x.status === 'sendet' && x.sendetSeit && jetzt.getTime() - Date.parse(x.sendetSeit) > SENDET_HAENGT_MS
    ? { ...x, status: 'unklar' as const, fehler: 'Der Versand wurde unterbrochen — bitte im Postfach unter „Gesendet“ nachsehen; erst dann „erneut vorbereiten“.', geaendert: am } : x)) }));
  if (!imZeitfenster(jetzt)) return z;
  const vorher = await ladePost();
  if (!vorher.eintraege.some(x => x.status === 'freigegeben')) return z;
  const crm = await ladeCrm();
  const aktiv = new Set(crm.kampagnen.filter(k => k.status === 'aktiv' && !k.geloeschtAm).map(k => k.id));
  const tag = localDay(jetzt);
  // M1 (01.11.): erst prüfen, dann zählen — ohne Absender-/Impressumszeile bzw. Abmeldelink geht nichts raus, und das Tageskontingent bleibt frei.
  const fuss = await fusszeileFuer(vorher.einstellungen);
  const { abmeldeLink } = await import('@/lib/datenschutz/abmelden');
  const ohneFuss = 'Absender-/Impressumszeile fehlt (Kampagnen-Einstellungen) — ohne sie geht keine Kampagnen-Mail raus.';
  const ohneAbmelden = 'Ohne Abmeldelink kein Versand (Adresse der Instanz bzw. Pepper fehlt).';
  // Beanspruchen: je Person|Postfach bis zur Grenze, Zähler sofort hoch.
  let geholt: PostEintrag[] = [];
  await aenderePost(b => {
    const tage: Record<string, number> = Object.fromEntries(Object.entries(b.tage).filter(([s]) => s.slice(0, 10) >= tagePlus(tag, -7)));
    const jeLauf = new Map<string, number>();
    const eintraege = [...b.eintraege].sort((a, c) => (a.freigabe?.am ?? '').localeCompare(c.freigabe?.am ?? '')).map(x => {
      if (x.status !== 'freigegeben' || !x.freigabe || !aktiv.has(x.kampagneId)) return x;
      const vorab = !fuss ? ohneFuss : !abmeldeLink(x.an.email) ? ohneAbmelden : null;
      if (vorab) { if (vorab !== x.fehler) z.fehler++; return x.fehler === vorab ? x : { ...x, fehler: vorab, geaendert: am }; }
      const s = zaehlerSchluessel(tag, x.freigabe.von, x.freigabe.postfach);
      const lauf = jeLauf.get(s) ?? 0;
      if ((tage[s] ?? 0) >= b.einstellungen.tagesgrenze || lauf >= JE_LAUF_MAX) return x;
      tage[s] = (tage[s] ?? 0) + 1; jeLauf.set(s, lauf + 1);
      const n = { ...x, status: 'sendet' as const, sendetSeit: am, geaendert: am };
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
  for (const x of geholt) {
    const k = kx.crm.kampagnen.find(y => y.id === x.kampagneId);
    const lage = zielLage(x.ziel, kx);
    const ergebnis = async (teil: Partial<PostEintrag>) => aenderePost(b => ({ ...b, eintraege: b.eintraege.map(y => (y.id === x.id ? { ...y, ...teil, geaendert: new Date().toISOString() } : y)) }), { wer: { art: 'person', person: x.freigabe!.von } });
    const sperre = sendeSperre(x, k, lage, risiko, kx.ungueltig);
    if (sperre) { await ergebnis({ status: 'gesperrt', fehler: sperre, sendetSeit: undefined }); z.gesperrt++; continue; }
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
      r = await inboxSenden(person, { neu: { postfach: x.freigabe!.postfach, betreff: x.betreff }, an: [{ email: x.an.email!, name: x.an.name }], text: fertig.text, uwgBestaetigt: !!x.freigabe!.eigenesRisiko }, { art: 'person', person }, { listeAbmelden: { link: ab.link } });
    } catch (err) { r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.' } }; }
    if (r.status !== 200 || r.body.ok !== true) {
      const uwg = r.body.code === 'uwg' || r.body.code === 'eingeschraenkt';
      await ergebnis({ status: uwg ? 'gesperrt' : 'fehler', fehler: uwg ? `Versand gesperrt: ${String(r.body.fehler ?? '§ 7 UWG / Art. 18')}` : `Nicht gesendet: ${String(r.body.fehler ?? `Fehler ${r.status}`).slice(0, 240)}`, sendetSeit: undefined });
      if (uwg) z.gesperrt++; else z.fehler++;
      continue;
    }
    const gesendet = { am: new Date().toISOString(), ...(typeof r.body.id === 'string' ? { id: r.body.id } : {}), ...(typeof r.body.threadId === 'string' ? { threadId: r.body.threadId } : {}), ...(typeof r.body.messageId === 'string' ? { messageId: r.body.messageId } : {}) };
    await ergebnis({ status: 'gesendet', gesendet, sendetSeit: undefined, fehler: undefined });
    z.gesendet++;
    await nachDemSenden(x, k!, person, gesendet.am, typeof r.body.von === 'string' ? r.body.von : '').catch(e => console.error('[kampagnen] nach dem Senden:', e instanceof Error ? e.message.slice(0, 160) : e));
  }
  return z;
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

async function spiegelVon(person: string): Promise<{ koepfe: RueckKopf[]; eigene: string[] }> {
  const koepfe: RueckKopf[] = [];
  const eigene: string[] = [];
  try {
    const { ladeGmailStand } = await import('@/lib/gmail/stand');
    const g = await ladeGmailStand(person);
    if (g) { koepfe.push(...Object.values(g.koepfe) as RueckKopf[]); eigene.push(g.email.toLowerCase(), ...(g.aliase ?? []).map(a => a.email.toLowerCase())); }
  } catch { /* ohne Gmail */ }
  try {
    const { ladeImapStand } = await import('@/lib/postfach/spiegel');
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    const s = await ladeImapStand(person);
    koepfe.push(...Object.values(s.koepfe) as unknown as RueckKopf[]);
    eigene.push(...(await ladePostfaecher(person)).map(p => p.adresse.toLowerCase()));
  } catch { /* ohne IMAP */ }
  return { koepfe: koepfe.sort((a, b) => a.am.localeCompare(b.am)), eigene };
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

/**
 * Antworten und Rückläufer gesendeter Mails erkennen (Spiegel der sendenden Person) — idempotent über `rueckfluss` am Eintrag. Nur die letzten 60 Tage.
 */
export async function rueckfluss(jetzt = new Date()): Promise<{ antworten: number; ruecklaeufer: number }> {
  const z = { antworten: 0, ruecklaeufer: 0 };
  const post = await ladePost();
  const ab = new Date(jetzt.getTime() - 60 * 864e5).toISOString();
  const offen = post.eintraege.filter(x => x.status === 'gesendet' && !x.rueckfluss && x.gesendet && x.gesendet.am >= ab && x.freigabe);
  if (!offen.length) return z;
  const jePerson = new Map<string, PostEintrag[]>();
  for (const x of offen) jePerson.set(x.freigabe!.von, [...(jePerson.get(x.freigabe!.von) ?? []), x]);
  const treffer: { x: PostEintrag; art: 'antwort' | 'bounce'; am: string }[] = [];
  for (const [person, liste] of Array.from(jePerson)) {
    const sp = await spiegelVon(person);
    for (const x of liste) {
      // Gmail: die Message-ID der gesendeten Nachricht steht im Spiegel (gesendet → gespiegelt).
      const g = x.gesendet!;
      const mid = g.messageId ?? (g.id ? sp.koepfe.find(k => k.id === g.id)?.messageId : undefined);
      const mitMid = { ...x, gesendet: { ...g, ...(mid ? { messageId: mid } : {}) } };
      const k = sp.koepfe.find(kopf => kopf.id !== g.id && rueckflussArt(mitMid, kopf, sp.eigene));
      if (k) treffer.push({ x, art: rueckflussArt(mitMid, k, sp.eigene)!, am: k.am });
    }
  }
  if (!treffer.length) return z;
  const am = jetzt.toISOString(), heute = localDay(jetzt);
  await aenderePost(b => ({
    ...b,
    eintraege: b.eintraege.map(y => { const t = treffer.find(q => q.x.id === y.id); return t && !y.rueckfluss ? { ...y, ...(t.art === 'bounce' ? { status: 'bounce' as const } : {}), rueckfluss: { art: t.art, am: t.am }, geaendert: am } : y; }),
    ungueltig: Array.from(new Set([...b.ungueltig, ...treffer.filter(t => t.art === 'bounce' && t.x.an.email).map(t => ungueltigHash(t.x.an.email!))])),
  }));
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
          faellig: heute, zustaendig: t.x.freigabe!.von, quelle: 'kampagne',
        }, undefined, 'system', am));
      }
      const kampagne = s ? standErsetzen(k, t.art === 'antwort' ? beenden(s, 'reagiert', 'Antwort erhalten', am, 'reagiert') : beenden(s, 'gestoppt', 'Adresse unzustellbar', am, 'bounce')) : k;
      const ergebnisse = t.art === 'antwort' && kontaktId && !kampagne.ergebnisse.some(e => e.kontaktId === kontaktId && e.ergebnis === 'reagiert')
        ? [...kampagne.ergebnisse, { kontaktId, ergebnis: 'reagiert' as const, am: heute }] : kampagne.ergebnisse;
      const firmaId = t.x.ziel.art === 'firma' ? t.x.ziel.id : undefined;
      const firmenErgebnisse = t.art === 'antwort' && firmaId && !(kampagne.firmenErgebnisse ?? []).some(e => e.firmaId === firmaId && e.ergebnis === 'reagiert')
        ? [...(kampagne.firmenErgebnisse ?? []), { firmaId, ergebnis: 'reagiert' as const, am: heute }] : kampagne.firmenErgebnisse;
      neu = { ...neu, followups, kampagnen: neu.kampagnen.map(y => (y.id === k.id ? { ...kampagne, ergebnisse, ...(firmenErgebnisse ? { firmenErgebnisse } : {}) } : y)) };
      if (t.art === 'antwort') z.antworten++; else z.ruecklaeufer++;
    }
    return neu;
  }, { art: 'system' });
  return z;
}

/**
 * Abmeldelink (lib/datenschutz/abmelden-server.ts ruft das nach jeder Abmeldung): jede Adresse aus dem Stapel, die zum Token passt → Sequenz gestoppt, offene Entwürfe gesperrt, Follow-ups der Sequenz abgesagt. Idempotent.
 */
export async function kampagnenAbmeldung(token: string, jetzt = new Date()): Promise<number> {
  const { tokenPasst } = await import('@/lib/datenschutz/abmelden');
  const post = await ladePost();
  const adressen = Array.from(new Set(post.eintraege.map(x => x.an.email).filter((x): x is string => !!x && tokenPasst(token, [x]))));
  if (!adressen.length) return 0;
  const am = jetzt.toISOString();
  const betroffen = post.eintraege.filter(x => x.an.email && adressen.includes(x.an.email));
  await aenderePost(b => ({
    ...b, eintraege: b.eintraege.map(x => {
      if (!x.an.email || !adressen.includes(x.an.email)) return x;
      if (x.status === 'entwurf' || x.status === 'freigegeben' || x.status === 'fehler') return { ...x, status: 'gesperrt' as const, fehler: 'Abgemeldet (Abmeldelink)', geaendert: am };
      return x.status === 'gesendet' && !x.rueckfluss ? { ...x, rueckfluss: { art: 'abmeldung' as const, am }, geaendert: am } : x;
    }),
  }));
  await aendereCrm(c => {
    let neu = c;
    for (const x of betroffen) {
      const k = neu.kampagnen.find(y => y.id === x.kampagneId);
      const s = k?.zielStaende?.find(st => gleichesZiel(st, x.ziel));
      // Die Mail eines Homepage-Funds hat oft keinen Stand in einer Sequenz — ihr „Anrufen …“ wird trotzdem abgesagt (M1, 01.11.).
      if (!k || ((!s || istEnde(s)) && !x.fundId)) continue;
      const followups = sequenzFollowupsAbsagen(neu, k.id, x.ziel, 'Abgemeldet — die Sequenz endet.', am, x.fundId);
      neu = { ...neu, followups, kampagnen: s && !istEnde(s) ? neu.kampagnen.map(y => (y.id === k.id ? standErsetzen(k, beenden(s, 'gestoppt', 'Abmeldung', am, 'abgemeldet')) : y)) : neu.kampagnen };
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

let laeuft = false;
let zuletzt = 0;
/** Alle 2 Minuten aus dem Takt (/api/zoe/takt) — ein Lauf je Prozess, Fehler nur als eine Zeile im Log. */
export async function motorImTakt(jetzt = new Date(), o: { sofort?: boolean } = {}): Promise<void> {
  if (laeuft || (!o.sofort && jetzt.getTime() - zuletzt < 2 * 60_000)) return;
  laeuft = true; zuletzt = jetzt.getTime();
  try {
    await sequenzenFortschreiben(jetzt);
    await rueckfluss(jetzt);
    await versenden(jetzt);
    await postAufraeumen(jetzt);
    await import('./willkommen').then(m => m.willkommenImTakt(jetzt)).catch(e => console.error('[kampagnen] Willkommen:', e instanceof Error ? e.message.slice(0, 160) : e));
  } catch (e) {
    console.error('[kampagnen] Motor:', e instanceof Error ? e.message.slice(0, 200) : e);
  } finally { laeuft = false; }
}
/** Nur für Tests. */
export function _motorZuruecksetzen(): void { laeuft = false; zuletzt = 0; }
