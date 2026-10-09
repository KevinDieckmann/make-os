// ─── Inbox 2 — der Strom einer Person, serverseitig gefiltert (Server, 06.10.2026) ───────────────────────────────
// `stromFuer(person, filter)` liest NUR die Bestände dieser Person (Register, Gmail-Spiegel, IMAP-Spiegel, Inbox-Zustand) und baut
// daraus Gespräche, Lagebild und ZOE-Satz. Die Bereichstrennung passiert HIER, vor der Antwort (Plattform-Regel „Trennung
// serverseitig, nie nur versteckt“) — EINE reine Filterstelle `imBereich`, getestet:
//   · `bereich=<id>`        nur Postfächer genau dieses Bereichs
//   · `space=business`      nur Postfächer mit einem Business-Bereich (feste Business-Gesellschaften, Register `g-…`)
//   · `space=privat`        nur Postfächer im Privat-Bereich (`privat` und Privat-Einheiten wie die Selbstständigkeit)
//   · ohne Filter („Alle“)   alle EIGENEN Postfächer; ein Postfach ohne Bereich nur hier
// Eine andere Person sieht nie etwas davon: es gibt keinen Parameter für die Person — sie kommt aus der Sitzung.
// Team (08.10., Lücke 6): dazu kommen Team-Postfächer ANDERER Personen, die diese Person sehen darf — entschieden an EINER Stelle neben
// `imBereich`: `postfachSichtbar` (lib/inbox/teilen.ts, eingesammelt über `geteiltePostfaecherFuer`). Ihr Zustand (Wiedervorlage, erledigt,
// Zuordnung, „wer kümmert sich“) kommt aus dem gemeinsamen Bestand `inbox-geteilt--<haushalt>` — für den Besitzer genauso. Übergaben
// (Kopien, `uebergaben`) stehen getrennt neben den Gesprächen und laufen durch denselben Bereichsfilter.

import { localDay } from '@/lib/zeit';
import { bereichVon } from '@/lib/einheiten';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { googleStatus } from '@/lib/google/verbindung';
import { gmailAlter, gmailBereit } from '@/lib/gmail/abgleich';
import { ladeGmailStand } from '@/lib/gmail/stand';
import { adressIndex, eigeneAdressen, zuordnen } from '@/lib/gmail/zuordnung';
import type { Zuordnung } from '@/lib/gmail/typen';
import { bereichNamen, bereichWahlLaden, ladePostfaecher, postfaecherUnzugeordnet } from '@/lib/postfach/register';
import { ladeImapStand, type ImapStand } from '@/lib/postfach/spiegel';
import { kurzHash } from '@/lib/postfach/rfc822';
import { abgleichAlter } from '@/lib/kalender/icloud';
import { bereichName, GMAIL_POSTFACH, type Postfach, type PostfachOeffentlich, type PostfachZustand } from '@/lib/postfach/typen';
import { whatsappImStrom } from '@/lib/whatsapp/strom';
import { whatsappFuer } from '@/lib/whatsapp/server';
import { absenderSchluessel, ladeInboxZustand, type InboxZustand } from './zustand';
import { gespraecheBauen, lageBauen, zoeSatz, type Gespraech, type GespraechZustand, type LageZeile, type PostfachKurz, type StromKopf, type ZoeSatz } from './strom';
import { geteiltePostfaecherFuer, ladeGeteilt, personenMitBlick, teamPersonen, type TeamPerson } from './teilen-server';
import { postfachTeilbar, standVon, type GespraechTeam, type TeamZustand, type UebergabeZeile } from './teilen';
import { uebergabeZeilenFuer } from './uebergaben-speicher';
import { leisteBauen, type LeisteEintrag } from './ansicht';

/**
 * Filter einer Sicht. `space` = Privat/Business (die harte Grenze), `bereich` = genau ein Bereich, `ohne` = Bereiche, die unter „Alle“
 * ausgeblendet sind (Mehrfach-Auswahl, Merker je Browser, 09.10. — als Ausschluss, damit ein NEUER Bereich sofort erscheint), `postfach` =
 * genau ein Postfach (der Bereichsfilter gilt immer zuerst).
 */
export interface StromFilter { bereich?: string; space?: 'privat' | 'business'; ohne?: string[]; postfach?: string }

/**
 * Gehört ein Postfach-Bereich in diese Sicht? EINE Filterstelle (rein, getestet). Seit 09.10. gelten `space` UND `bereich` zugleich:
 * `?space=business&bereich=privat` liefert nichts (vorher hätte `bereich` die Sicht überstimmt). Ohne Bereich (`null`) nur ohne `space`.
 */
export function imBereich(bereich: string | null, f: Pick<StromFilter, 'bereich' | 'space' | 'ohne'>): boolean {
  if (f.space && (bereich === null || bereichVon(bereich) !== f.space)) return false;
  if (f.bereich) return bereich === f.bereich;
  if (f.ohne && bereich !== null && f.ohne.includes(bereich)) return false;
  return true;
}

export interface Strom {
  postfaecher: PostfachOeffentlich[];
  gespraeche: Gespraech[];
  lage: LageZeile[];
  zoe: ZoeSatz;
  bereiche: { id: string; name: string }[];
  google: { konfiguriert: boolean; verbunden: boolean; bereit: boolean; konto?: string; getrennt?: boolean };
  heute: string;
  /** Übergaben (Kopien) an bzw. von dieser Person — ohne Texte, im selben Bereichsfilter. */
  uebergaben: UebergabeZeile[];
  /**
   * Bereichs-Leiste (09.10., Kevin: „auf das Postfach klicken … MAKE Innovation oder KD Ventures“): je Bereich DER SICHT (nur `space`, nicht
   * der gewählte Bereich — die Leiste zeigt alle Reiter) ein Eintrag mit Ungelesen/offen und den Postfächern. Nur Zahlen und Namen.
   */
  leiste: LeisteEintrag[];
  /**
   * EIGENE Postfächer ohne Bereich (z. B. Gmail verbunden, aber noch nicht zugeordnet) — in JEDER Sicht, nur Kennung, Name, Quelle und die
   * maskierte Adresse, nie eine Nachricht. Daraus macht die Inbox die Karte „… ist noch keinem Bereich zugeordnet — jetzt zuordnen“.
   */
  unzugeordnet: { id: string; quelle: string; anzeigename: string; adresse: string; nachrichten?: number }[];
  /** Bereiche, die diese Sicht zum Zuordnen anbietet (nur wenn etwas unzugeordnet ist). */
  waehlbar: { id: string; name: string }[];
}

/** Zum Zuordnen wählbare Bereiche einer Sicht (rein): Privat + alle bekannten Gesellschaften/Register-Bereiche, gefiltert nach `space`. */
export function waehlbareBereiche(namen: Readonly<Record<string, string>>, space?: 'privat' | 'business'): { id: string; name: string }[] {
  const ids = ['privat', ...Object.keys(namen).filter(id => id !== 'privat')];
  return ids.filter(id => imBereich(id, space ? { space } : {})).map(id => ({ id, name: bereichName(id, namen) }));
}

/** Zustand eines IMAP-Postfachs für die Leiste (rein). */
export function imapZustand(s: ImapStand, id: string, jetzt = Date.now()): PostfachZustand {
  const z = s.postfaecher[id];
  const n = Object.values(s.koepfe).filter(k => k.postfachId === id).length;
  if (!z) return { stufe: 'neu', nachrichten: n };
  if (z.fehlerAnmeldung) return { stufe: 'anmeldung', ...(z.at ? { at: z.at } : {}), fehler: z.fehler, nachrichten: n };
  const a = abgleichAlter({ at: z.at, fehler: z.fehler, fehlerAt: z.fehlerAt, fehlerAnmeldung: z.fehlerAnmeldung, pauseBis: z.pauseBis }, jetzt);
  const stufe: PostfachZustand['stufe'] = !z.at ? (z.fehlerAt ? 'fehler' : 'neu') : z.fehlerAt && z.fehlerAt > z.at ? 'fehler' : a.veraltet ? 'verzoegert' : 'aktuell';
  return { stufe, ...(z.at ? { at: z.at } : {}), vorMin: a.vorMin, ...(z.fehler && stufe === 'fehler' ? { fehler: z.fehler } : {}), ...(z.idleSeit ? { idle: true } : {}), nachrichten: n };
}

/** Zuordnungen für alle Köpfe (Anzeige, auch eingeschränkte Personen — gekennzeichnet). */
async function zuordnungen(koepfe: Record<string, StromKopf[]>, eigene: Record<string, string[]>): Promise<Record<string, Zuordnung>> {
  const alle = Object.values(koepfe).flat();
  if (!alle.length) return {};
  const [kontakte, crm] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm()]);
  const index = adressIndex(kontakte);
  const raus: Record<string, Zuordnung> = {};
  for (const [p, l] of Object.entries(koepfe)) for (const k of l) { const z = zuordnen(k, eigene[p] ?? [], index, crm); if (z) raus[k.id] = z; }
  return raus;
}

/** Ein Postfach im Rohstrom: das Register-Postfach + was der Browser sieht; bei Team-Postfächern der Besitzer. */
export type RohPostfach = Postfach & { oeffentlich: PostfachOeffentlich; besitzer: string };

/** Alles, was der Strom einer Person braucht (ohne Filter) — auch für Aktionen, Kontext, Suche und ZOE. */
export async function stromRoh(person: string, heute = localDay(), zustand?: InboxZustand): Promise<{ gespraeche: Gespraech[]; postfaecher: RohPostfach[]; google: Strom['google']; namen: Record<string, string>; team: TeamPerson[] }> {
  const [register, gs, imap, z, namen, team, gemeinsam] = await Promise.all([ladePostfaecher(person), googleStatus(person), ladeImapStand(person), zustand ? Promise.resolve(zustand) : ladeInboxZustand(person), bereichNamen(), teamPersonen(), ladeGeteilt()]);
  const fremde = await geteiltePostfaecherFuer(person, team);
  const bereit = gs.verbunden && await gmailBereit(person).catch(() => false);
  const gmail = bereit ? await ladeGmailStand(person).catch(() => null) : null;
  const liste: Postfach[] = register.filter(p => p.quelle !== 'gmail' || bereit);
  if (bereit && !liste.some(p => p.id === GMAIL_POSTFACH)) liste.push({ id: GMAIL_POSTFACH, quelle: 'gmail', bereich: null, anzeigename: 'Google Workspace', adresse: '', angelegtAm: '' });
  const koepfe: Record<string, StromKopf[]> = {};
  const eigene: Record<string, string[]> = {};
  const kurz: PostfachKurz[] = [];
  const mitOeffentlich: RohPostfach[] = [];
  /** Team-Postfächer (eigene geteilte + sichtbare fremde): Postfach-Kennung → Besitzer. Ihr Zustand liegt gemeinsam. */
  const teamPf = new Map<string, { p: Postfach; besitzer: string; besitzerName: string }>();
  const jetzt = Date.now();
  for (const p of liste) {
    let zustandP: PostfachZustand;
    if (p.quelle === 'gmail') {
      koepfe[p.id] = Object.values(gmail?.koepfe ?? {});
      eigene[p.id] = gmail ? eigeneAdressen(gmail) : [];
      const a = gmail ? gmailAlter(gmail, jetzt) : null;
      zustandP = gs.getrennt ? { stufe: 'anmeldung', fehler: 'Die Google-Verbindung ist getrennt.' } : !a ? { stufe: 'neu' } : a.anmeldung ? { stufe: 'anmeldung', fehler: a.fehler } : { stufe: a.fehler ? 'fehler' : a.veraltet ? 'verzoegert' : 'aktuell', ...(a.letzter ? { at: a.letzter } : {}), vorMin: a.vorMin, ...(a.fehler ? { fehler: a.fehler } : {}), nachrichten: koepfe[p.id].length };
    } else if (p.quelle === 'imap') {
      koepfe[p.id] = Object.values(imap.koepfe).filter(k => k.postfachId === p.id);
      eigene[p.id] = [p.adresse];
      zustandP = imapZustand(imap, p.id, jetzt);
    } else {
      koepfe[p.id] = [];
      eigene[p.id] = [];
      zustandP = { stufe: 'vorbereitet' };
    }
    const geteilt = !!p.geteilt && postfachTeilbar(p);
    if (geteilt) teamPf.set(p.id, { p, besitzer: person, besitzerName: team.find(t => t.speicher === person)?.name ?? person });
    kurz.push({ id: p.id, quelle: p.quelle, bereich: p.bereich, anzeigename: p.anzeigename, eigene: eigene[p.id] });
    mitOeffentlich.push({ ...p, besitzer: person, oeffentlich: {
      id: p.id, quelle: p.quelle, bereich: p.bereich, bereichName: bereichName(p.bereich, namen), anzeigename: p.anzeigename,
      adresse: p.quelle === 'gmail' ? (gs.konto ?? '') : p.adresse, ...(p.absenderName ? { absenderName: p.absenderName } : {}), ...(p.signatur ? { signatur: p.signatur } : {}),
      ...(p.anbieter ? { anbieter: p.anbieter } : {}), zustand: zustandP, ...(geteilt ? { geteilt: true } : {}),
    } });
  }
  // Team-Postfächer anderer Personen (nur sichtbare — `postfachSichtbar`): Köpfe aus dem Spiegel des BESITZERS.
  const fremdeStaende = new Map<string, ImapStand>();
  for (const f of fremde) {
    const st = fremdeStaende.get(f.besitzer) ?? await ladeImapStand(f.besitzer);
    fremdeStaende.set(f.besitzer, st);
    const p = f.postfach;
    koepfe[p.id] = Object.values(st.koepfe).filter(k => k.postfachId === p.id);
    eigene[p.id] = [p.adresse];
    teamPf.set(p.id, { p, besitzer: f.besitzer, besitzerName: f.besitzerName });
    kurz.push({ id: p.id, quelle: p.quelle, bereich: p.bereich, anzeigename: p.anzeigename, eigene: eigene[p.id] });
    mitOeffentlich.push({ ...p, besitzer: f.besitzer, oeffentlich: {
      id: p.id, quelle: p.quelle, bereich: p.bereich, bereichName: bereichName(p.bereich, namen), anzeigename: p.anzeigename, adresse: p.adresse,
      ...(p.absenderName ? { absenderName: p.absenderName } : {}), ...(p.signatur ? { signatur: p.signatur } : {}),
      zustand: imapZustand(st, p.id, jetzt), geteilt: true, fremd: { besitzerName: f.besitzerName },
    } });
  }
  // Zustand: eigener je Person — für Team-Postfächer ersetzt durch den gemeinsamen (für alle derselbe, auch für den Besitzer).
  const teamPraefix = Array.from(teamPf.keys()).map(id => `im~${id}~`);
  const imTeam = (k: string) => teamPraefix.some(x => k.startsWith(x));
  const gespraechZustand: Record<string, GespraechZustand> = Object.fromEntries(Object.entries(z.gespraeche).filter(([k]) => !imTeam(k)));
  for (const [k, v] of Object.entries(gemeinsam)) if (imTeam(k)) { const { kuemmert: _k, ...rest } = v; gespraechZustand[k] = rest; }
  const zu = await zuordnungen(koepfe, eigene);
  const gespraeche = gespraecheBauen({ postfaecher: kurz, koepfe, zuordnung: zu, zustand: gespraechZustand, absender: z.absender, heute, hash: kurzHash });
  const namenTeam = Object.fromEntries(team.map(t => [t.speicher, t.name]));
  const teamVon = (id: string, personen: TeamPerson[], extra?: GespraechTeam['postfach']): GespraechTeam => {
    const v: TeamZustand | undefined = gemeinsam[id];
    return {
      ...(extra ? { postfach: extra } : {}),
      ...(v?.kuemmert ? { kuemmert: { person: v.kuemmert.person, name: namenTeam[v.kuemmert.person] ?? v.kuemmert.person, seit: v.kuemmert.seit } } : {}),
      personen: personen.map(t => ({ speicher: t.speicher, name: t.name })), stand: standVon(v),
    };
  };
  for (const g of gespraeche) {
    const t = teamPf.get(g.postfachId);
    if (t) g.team = teamVon(g.id, personenMitBlick(t.p, t.besitzer, team), { besitzer: t.besitzer, besitzerName: t.besitzerName, eigenes: t.besitzer === person });
  }
  // WhatsApp (07.10., lib/whatsapp/strom.ts): die Business-Nummer der INSTANZ — nur für Personen mit Zugang (Haushalt des Inhabers,
  // ggf. WHATSAPP_PERSONEN), Bereich immer Business; der Filter `imBereich` unten gilt genauso (Sicht „Privat“ sieht sie nie).
  // „Wer kümmert sich“ (08.10.) kommt aus dem gemeinsamen Bestand; wählbar sind nur Personen mit WhatsApp-Zugang.
  const wa = await whatsappImStrom(person, z.gespraeche, heute, namen, Date.now(), z.absender).catch(e => { console.warn(`[whatsapp] Strom: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); return null; });
  if (wa) {
    const waPersonen = (await Promise.all(team.map(async t => ((await whatsappFuer(t.speicher).catch(() => null)) ? t : null)))).filter((t): t is TeamPerson => !!t);
    for (const g of wa.gespraeche) g.team = teamVon(g.id, waPersonen);
    mitOeffentlich.push({ ...wa.postfach, besitzer: person });
    gespraeche.push(...wa.gespraeche);
  }
  return { gespraeche, postfaecher: mitOeffentlich, google: { konfiguriert: gs.konfiguriert, verbunden: gs.verbunden, bereit, ...(gs.konto ? { konto: gs.konto } : {}), ...(gs.getrennt ? { getrennt: true } : {}) }, namen, team };
}

/**
 * Die Postfach-Verwaltung in einer Sicht (rein, getestet; 07.10. abends, Kevin-Regel „Business sieht nie Privat“): unter `business` nur
 * Postfächer mit Business-Bereich (wie der Strom: `imBereich`, ein Postfach ohne Bereich zählt nicht), nur Business-Bereiche zur Wahl und
 * nur Absender-Entscheidungen, deren Adresse/Nummer in einem Gespräch dieser Postfächer vorkommt — ein Privat-Absender bleibt draußen.
 * Ohne Sicht (`null`): alles Eigene.
 */
export function postfaecherSicht<P extends { id: string; bereich: string | null }, A extends { adresse: string }>(
  d: { postfaecher: P[]; gespraeche: readonly Pick<Gespraech, 'postfachId' | 'absender'>[]; bereiche: { id: string; name: string }[]; absender: A[] },
  space: 'business' | null,
): { postfaecher: P[]; bereiche: { id: string; name: string }[]; absender: A[] } {
  if (space !== 'business') return { postfaecher: d.postfaecher, bereiche: d.bereiche, absender: d.absender };
  const postfaecher = d.postfaecher.filter(p => imBereich(p.bereich, { space }));
  const ids = new Set(postfaecher.map(p => p.id));
  const bekannt = new Set(d.gespraeche.filter(g => ids.has(g.postfachId)).map(g => absenderSchluessel(g.absender)).filter(Boolean));
  return { postfaecher, bereiche: d.bereiche.filter(b => imBereich(b.id, { space })), absender: d.absender.filter(a => bekannt.has(absenderSchluessel(a.adresse))) };
}

/** Der Strom für die Oberfläche — serverseitig nach Bereich gefiltert. */
export async function stromFuer(person: string, f: StromFilter = {}): Promise<Strom> {
  const heute = localDay();
  const r = await stromRoh(person, heute);
  // Die Sicht (nur `space`): daraus Leiste und Bereichs-Umschalter. Erst danach der gewählte Bereich / die Auswahl / das Postfach.
  const sichtSpace = f.space ? { space: f.space } : {};
  const inSicht = r.postfaecher.filter(p => imBereich(p.bereich, sichtSpace));
  const sicht = inSicht.filter(p => imBereich(p.bereich, f) && (!f.postfach || p.id === f.postfach));
  const ids = new Set(sicht.map(p => p.id));
  const gespraeche = r.gespraeche.filter(g => ids.has(g.postfachId));
  const idsSicht = new Set(inSicht.map(p => p.id));
  const bereicheDa = Array.from(new Set(r.postfaecher.map(p => p.bereich).filter((b): b is string => !!b)));
  // Unzugeordnet: nur EIGENE Postfächer (nie ein Team-Postfach einer anderen Person), nur Angaben zum Postfach — keine Nachricht.
  // EINE Regel mit der Postfächer-Seite (postfaecherUnzugeordnet): auch ein Name, der die Adresse ist, nur maskiert.
  const unzugeordnet = postfaecherUnzugeordnet(r.postfaecher.map(p => ({
    id: p.id, quelle: p.quelle, bereich: p.bereich, anzeigename: p.anzeigename, adresse: p.oeffentlich.adresse ?? '', zustand: p.oeffentlich.zustand, fremd: p.oeffentlich.fremd,
  })));
  // Wählbar wie auf der Postfächer-Seite (bereichWahlLaden: nur Kunden mit AKTIVEM Mandat — sonst lehnte der Server das Zuordnen ab), nach Sicht gefiltert.
  const waehlbar = unzugeordnet.length ? (await bereichWahlLaden()).filter(e => imBereich(e.id, sichtSpace)).map(e => ({ id: e.id, name: e.name })) : [];
  return {
    postfaecher: sicht.map(p => p.oeffentlich),
    gespraeche,
    lage: lageBauen(gespraeche),
    zoe: zoeSatz(gespraeche),
    // Für den Umschalter: nur die Bereiche der EIGENEN Postfächer (und alle wählbaren Namen für „Postfach hinzufügen“ liefert /api/inbox/postfaecher).
    bereiche: bereicheDa.filter(b => imBereich(b, sichtSpace)).map(b => ({ id: b, name: bereichName(b, r.namen) })),
    google: r.google,
    heute,
    uebergaben: (await uebergabeZeilenFuer(person, r.team)).filter(u => imBereich(u.bereich, f)),
    leiste: leisteBauen(inSicht.map(p => p.oeffentlich), r.gespraeche.filter(g => idsSicht.has(g.postfachId)), b => bereichName(b, r.namen)),
    unzugeordnet,
    waehlbar,
  };
}
