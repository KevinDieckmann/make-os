// ─── Inbox 2 — der Strom einer Person, serverseitig gefiltert (Server, 06.10.2026) ───────────────────────────────
// `stromFuer(person, filter)` liest NUR die Bestände dieser Person (Register, Gmail-Spiegel, IMAP-Spiegel, Inbox-Zustand) und baut
// daraus Gespräche, Lagebild und ZOE-Satz. Die Bereichstrennung passiert HIER, vor der Antwort (Plattform-Regel „Trennung
// serverseitig, nie nur versteckt“) — EINE reine Filterstelle `imBereich`, getestet:
//   · `bereich=<id>`        nur Postfächer genau dieses Bereichs
//   · `space=business`      nur Postfächer mit einem Business-Bereich (feste Business-Gesellschaften, Register `g-…`)
//   · `space=privat`        nur Postfächer im Privat-Bereich (`privat` und Privat-Einheiten wie die Selbstständigkeit)
//   · ohne Filter („Alle“)   alle EIGENEN Postfächer; ein Postfach ohne Bereich nur hier
// Eine andere Person sieht nie etwas davon: es gibt keinen Parameter für die Person — sie kommt aus der Sitzung.

import { localDay } from '@/lib/zeit';
import { bereichVon } from '@/lib/einheiten';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { googleStatus } from '@/lib/google/verbindung';
import { gmailAlter, gmailBereit } from '@/lib/gmail/abgleich';
import { ladeGmailStand } from '@/lib/gmail/stand';
import { adressIndex, eigeneAdressen, zuordnen } from '@/lib/gmail/zuordnung';
import type { Zuordnung } from '@/lib/gmail/typen';
import { bereichNamen, ladePostfaecher } from '@/lib/postfach/register';
import { ladeImapStand, type ImapStand } from '@/lib/postfach/spiegel';
import { kurzHash } from '@/lib/postfach/rfc822';
import { abgleichAlter } from '@/lib/kalender/icloud';
import { bereichName, GMAIL_POSTFACH, type Postfach, type PostfachOeffentlich, type PostfachZustand } from '@/lib/postfach/typen';
import { whatsappImStrom } from '@/lib/whatsapp/strom';
import { ladeInboxZustand, type InboxZustand } from './zustand';
import { gespraecheBauen, lageBauen, zoeSatz, type Gespraech, type LageZeile, type PostfachKurz, type StromKopf, type ZoeSatz } from './strom';

export interface StromFilter { bereich?: string; space?: 'privat' | 'business' }

/** Gehört ein Postfach-Bereich in diese Sicht? EINE Filterstelle (rein, getestet). */
export function imBereich(bereich: string | null, f: StromFilter): boolean {
  if (f.bereich) return bereich === f.bereich;
  if (f.space) return bereich !== null && bereichVon(bereich) === f.space;
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

/** Alles, was der Strom einer Person braucht (ohne Filter) — auch für Aktionen, Kontext und ZOE. */
export async function stromRoh(person: string, heute = localDay(), zustand?: InboxZustand): Promise<{ gespraeche: Gespraech[]; postfaecher: (Postfach & { oeffentlich: PostfachOeffentlich })[]; google: Strom['google']; namen: Record<string, string> }> {
  const [register, gs, imap, z, namen] = await Promise.all([ladePostfaecher(person), googleStatus(person), ladeImapStand(person), zustand ? Promise.resolve(zustand) : ladeInboxZustand(person), bereichNamen()]);
  const bereit = gs.verbunden && await gmailBereit(person).catch(() => false);
  const gmail = bereit ? await ladeGmailStand(person).catch(() => null) : null;
  const liste: Postfach[] = register.filter(p => p.quelle !== 'gmail' || bereit);
  if (bereit && !liste.some(p => p.id === GMAIL_POSTFACH)) liste.push({ id: GMAIL_POSTFACH, quelle: 'gmail', bereich: null, anzeigename: 'Google Workspace', adresse: '', angelegtAm: '' });
  const koepfe: Record<string, StromKopf[]> = {};
  const eigene: Record<string, string[]> = {};
  const kurz: PostfachKurz[] = [];
  const mitOeffentlich: (Postfach & { oeffentlich: PostfachOeffentlich })[] = [];
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
    kurz.push({ id: p.id, quelle: p.quelle, bereich: p.bereich, anzeigename: p.anzeigename, eigene: eigene[p.id] });
    mitOeffentlich.push({ ...p, oeffentlich: {
      id: p.id, quelle: p.quelle, bereich: p.bereich, bereichName: bereichName(p.bereich, namen), anzeigename: p.anzeigename,
      adresse: p.quelle === 'gmail' ? (gs.konto ?? '') : p.adresse, ...(p.absenderName ? { absenderName: p.absenderName } : {}), ...(p.signatur ? { signatur: p.signatur } : {}),
      ...(p.anbieter ? { anbieter: p.anbieter } : {}), zustand: zustandP,
    } });
  }
  const zu = await zuordnungen(koepfe, eigene);
  const gespraeche = gespraecheBauen({ postfaecher: kurz, koepfe, zuordnung: zu, zustand: z.gespraeche, absender: z.absender, heute, hash: kurzHash });
  // WhatsApp (07.10., lib/whatsapp/strom.ts): die Business-Nummer der INSTANZ — nur für Personen mit Zugang (Haushalt des Inhabers,
  // ggf. WHATSAPP_PERSONEN), Bereich immer Business; der Filter `imBereich` unten gilt genauso (Sicht „Privat“ sieht sie nie).
  const wa = await whatsappImStrom(person, z.gespraeche, heute, namen).catch(e => { console.warn(`[whatsapp] Strom: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); return null; });
  if (wa) { mitOeffentlich.push(wa.postfach); gespraeche.push(...wa.gespraeche); }
  return { gespraeche, postfaecher: mitOeffentlich, google: { konfiguriert: gs.konfiguriert, verbunden: gs.verbunden, bereit, ...(gs.konto ? { konto: gs.konto } : {}), ...(gs.getrennt ? { getrennt: true } : {}) }, namen };
}

/** Der Strom für die Oberfläche — serverseitig nach Bereich gefiltert. */
export async function stromFuer(person: string, f: StromFilter = {}): Promise<Strom> {
  const heute = localDay();
  const r = await stromRoh(person, heute);
  const sicht = r.postfaecher.filter(p => imBereich(p.bereich, f));
  const ids = new Set(sicht.map(p => p.id));
  const gespraeche = r.gespraeche.filter(g => ids.has(g.postfachId));
  const bereicheDa = Array.from(new Set(r.postfaecher.map(p => p.bereich).filter((b): b is string => !!b)));
  return {
    postfaecher: sicht.map(p => p.oeffentlich),
    gespraeche,
    lage: lageBauen(gespraeche),
    zoe: zoeSatz(gespraeche),
    // Für den Umschalter: nur die Bereiche der EIGENEN Postfächer (und alle wählbaren Namen für „Postfach hinzufügen“ liefert /api/inbox/postfaecher).
    bereiche: bereicheDa.filter(b => imBereich(b, f.space ? { space: f.space } : {})).map(b => ({ id: b, name: bereichName(b, r.namen) })),
    google: r.google,
    heute,
  };
}
