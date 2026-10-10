// ─── Inbox — Aufgaben-Vorschläge aus Mails und WhatsApp (Server, 10.10.2026) ────────────────────────────────────────
// ROADMAP_Q4.md › Phase 1 „Aufgaben: Vorschläge aus Mails/WhatsApp“. Kevin: „ZOE macht alles nur als Vorschlag — jede Übernahme braucht
// einen Klick.“ Ablauf:
//   · Lauf je Person (`inboxVorschlaegeLauf`): im Takt alle 15 Minuten (wenn die Person es nicht ausgeschaltet hat) und auf Klick
//     „Vorschläge holen“ in der Inbox. Gelesen wird NUR der eigene Strom der Person (`stromRoh`) — eigene Postfächer und Team-Gespräche,
//     um die SIE sich kümmert (`vorschlagKandidat`). Nie die Gespräche einer anderen Person.
//   · Je Gespräch die jüngste echte Nachricht von außen (keine eigene, keine automatische, höchstens 14 Tage alt) durch das Regelwerk
//     (`handlungAus`, ohne Modell). Treffer → Vorschlag der Stapel-Art „inbox“ für GENAU diese Person (`lege`, `person`, Bereich aus dem
//     Postfach). Idempotent je Nachricht: der Merker (Fingerabdruck aus Gespräch + Nachricht) steht in `inbox-vorschlaege--<person>`, auch
//     wenn kein Auftrag gefunden wurde — dieselbe Nachricht wird nie zweimal geprüft. Höchstens `jeLauf` neue Vorschläge je Lauf.
//   · Freigabe (`INBOX_STAPEL_ART`): nur die Person selbst; das Gespräch muss noch in ihrer Inbox stehen; angelegt über den vorhandenen
//     Aufgaben-Weg `/api/tasks/create` (Duplikat-Schutz, Verlauf, Protokoll) — die Beschreibung trägt den Link zurück ins Gespräch.
// Datenschutz: Der Mailtext geht nie in ein Protokoll und nie ans Modell. Der Titel des Stapel-Eintrags nennt weder Betreff noch Namen (er
// steht dauerhaft in den ZOE-Entscheidungen); Betreff und das gefundene Stück stehen nur im Vorschlag selbst (Stapel, Frist 90 Tage).
// Art. 18: Gespräche mit eingeschränkten Personen bekommen keinen Vorschlag.

import { localDay } from '@/lib/zeit';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { kurzHash } from '@/lib/postfach/rfc822';
import { ladeGmailStand, ladeGmailTexte } from '@/lib/gmail/stand';
import { eigeneAdressen } from '@/lib/gmail/zuordnung';
import { ladeImapStand, ladeImapTexte } from '@/lib/postfach/spiegel';
import { lege, entscheide, beanspruche, loslassen } from '@/lib/zoe/stapel';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import { istAutoNachricht } from './faecher';
import { stromRoh } from './strom-server';
import { raumVon } from './teilen';
import type { Gespraech, StromKopf } from './strom';
import {
  aufgabeAusHandlung, aufgabeEingabe, handlungAus, stapelAnlass, stapelTitel, tagKurz, vorschlagKandidat, INBOX_VORSCHLAG_GRENZEN as G,
} from './aufgaben-vorschlag';

export const INBOX_VORSCHLAG_WERKZEUG = 'inbox_aufgabe';
export const INBOX_GRUPPE = 'inbox';

// ── Bestand je Person ───────────────────────────────────────────────────────

/** `inbox-vorschlaege--<person>`: nur Fingerabdrücke geprüfter Nachrichten (kein Text, keine Adresse, keine Kennung), Schalter, letzter Lauf. */
export interface VorschlagStand { v: 1; /** Automatisch im Takt (Vorgabe an). */ automatisch?: boolean; geprueft: Record<string, string>; letzterLauf?: string }
export const vorschlagName = (person: string) => `inbox-vorschlaege--${person}`;
const leer = (): VorschlagStand => ({ v: 1, geprueft: {} });

export async function ladeVorschlagStand(person: string): Promise<VorschlagStand> {
  const d = await loadJson<VorschlagStand>(vorschlagName(person));
  return d && d.v === 1 && d.geprueft && typeof d.geprueft === 'object' ? d : leer();
}

/** Merker älter als `merkerTage` fallen weg (rein) — die Nachricht ist dann ohnehin älter als das Prüf-Fenster. */
export function merkerAufraeumen(geprueft: Readonly<Record<string, string>>, heute: string): Record<string, string> {
  const grenze = new Date(Date.parse(`${heute}T12:00:00Z`) - G.merkerTage * 86_400_000).toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(geprueft).filter(([, tag]) => tag >= grenze));
}

/** Schalter „automatisch vorschlagen“ der Person (nur sie selbst — die Route nimmt die Person aus der Sitzung). */
export async function automatischSetzen(person: string, an: boolean): Promise<void> {
  await updateJson<VorschlagStand>(vorschlagName(person), cur => {
    const s = cur && cur.v === 1 ? cur : leer();
    const { automatisch: _a, ...rest } = s;
    return an ? rest : { ...rest, automatisch: false };
  });
}

/** Fingerabdruck einer Nachricht in einem Gespräch (Merker + Bezug des Vorschlags) — trägt keine Nummer, Adresse oder Kennung. */
export const nachrichtMerker = (gespraech: string, nachricht: string): string => kurzHash(`inbox-vorschlag|${gespraech}|${nachricht}`);

// ── Der Lauf ────────────────────────────────────────────────────────────────

type Quelle = { koepfe: StromKopf[]; eigene: string[]; texte: Record<string, { t: string }> };

export interface LaufErgebnis { geprueft: number; gelegt: number; uebersprungen?: string }

/** Prüft die Gespräche EINER Person und legt Vorschläge in IHREN Stapel. Wirft nie; Fehler als eine Zeile `[inbox-vorschlag] …`. */
export async function inboxVorschlaegeLauf(person: string, o: { jetzt?: Date; quelle?: 'takt' | 'klick' } = {}): Promise<LaufErgebnis> {
  const jetzt = o.jetzt ?? new Date();
  const heute = localDay(jetzt);
  try {
    const stand = await ladeVorschlagStand(person);
    if (o.quelle === 'takt' && stand.automatisch === false) return { geprueft: 0, gelegt: 0, uebersprungen: 'aus' };
    const r = await stromRoh(person, heute);
    const grenze = jetzt.getTime() - G.tage * 86_400_000;
    const kandidaten = r.gespraeche.filter(g => vorschlagKandidat(g, person) && Date.parse(g.am) >= grenze).sort((a, b) => b.am.localeCompare(a.am));
    const cache = new Map<string, Promise<[unknown, Record<string, { t: string }>]>>();
    const quelleVon = async (g: Gespraech): Promise<Quelle | null> => {
      if (g.quelle === 'gmail') {
        const c = cache.get('gmail') ?? Promise.all([ladeGmailStand(person), ladeGmailTexte(person).then(x => x.texte)]) as Promise<[unknown, Record<string, { t: string }>]>;
        cache.set('gmail', c);
        const [st, texte] = await c as [Awaited<ReturnType<typeof ladeGmailStand>>, Record<string, { t: string }>];
        if (!st) return null;
        return { koepfe: g.nachrichten.map(id => st.koepfe[id]).filter(Boolean) as StromKopf[], eigene: eigeneAdressen(st), texte };
      }
      if (g.quelle === 'imap') {
        const besitzer = g.team?.postfach?.besitzer ?? person;
        const c = cache.get(`imap:${besitzer}`) ?? Promise.all([ladeImapStand(besitzer), ladeImapTexte(besitzer).then(x => x.texte)]) as Promise<[unknown, Record<string, { t: string }>]>;
        cache.set(`imap:${besitzer}`, c);
        const [st, texte] = await c as [Awaited<ReturnType<typeof ladeImapStand>>, Record<string, { t: string }>];
        const p = r.postfaecher.find(x => x.id === g.postfachId);
        return { koepfe: g.nachrichten.map(id => st.koepfe[id]).filter(Boolean) as StromKopf[], eigene: p?.adresse ? [p.adresse] : [], texte };
      }
      if (g.quelle === 'whatsapp' && g.whatsapp) {
        const { whatsappNachrichtenVon } = await import('@/lib/whatsapp/strom');
        const n = await whatsappNachrichtenVon(person, g.postfachId, g.whatsapp.nummer);
        return n ? { koepfe: n.koepfe, eigene: n.eigene, texte: {} } : null;
      }
      return null;
    };
    const neu: Record<string, string> = {};
    let geprueft = 0, gelegt = 0;
    for (const g of kandidaten) {
      if (gelegt >= G.jeLauf || geprueft >= G.pruefenJeLauf) break;
      const q = await quelleVon(g).catch(() => null);
      if (!q) continue;
      const vonUns = (k: StromKopf) => k.labels.includes('SENT') || k.ordner === 'g' || q.eigene.includes(k.von.email);
      const k = [...q.koepfe].sort((a, b) => a.am.localeCompare(b.am)).reverse().find(x => !vonUns(x) && !istAutoNachricht(x));
      if (!k || Date.parse(k.am) < grenze) continue;
      const merker = nachrichtMerker(g.id, k.id);
      if (stand.geprueft[merker] || neu[merker]) continue;
      geprueft++;
      neu[merker] = heute;
      const h = handlungAus({ betreff: k.betreff, text: q.texte[k.id]?.t ?? k.ausschnitt, anhaenge: k.anhaenge }, heute);
      if (!h) continue;
      const kurzG = { id: g.id, betreff: g.betreff, gegenueber: g.gegenueber, zuordnung: g.zuordnung ?? null, bereich: g.bereich, ...(g.whatsapp ? { whatsapp: { nummer: g.whatsapp.nummer, ...(g.whatsapp.profilname ? { profilname: g.whatsapp.profilname } : {}) } } : {}) };
      const aufgabe = aufgabeAusHandlung(kurzG, h);
      const name = g.zuordnung?.name ?? g.gegenueber.name ?? (g.whatsapp ? 'WhatsApp' : g.gegenueber.email);
      const raum = raumVon(g.bereich);
      await lege({
        werkzeug: INBOX_VORSCHLAG_WERKZEUG, gruppe: INBOX_GRUPPE,
        titel: stapelTitel(h),
        nachher: `„${aufgabe.title}“ · ${name}${aufgabe.dueDate ? ` · fällig ${tagKurz(aufgabe.dueDate)}` : ''}`,
        anlass: stapelAnlass(h),
        // `space` = Bereich des Postfachs (die EINE Bereichs-Regel liest ihn aus der Eingabe); `gespraech` für den Sprung zurück.
        eingabe: { gespraech: g.id, space: raum, aufgabe },
        person, quelle: 'lauf', bezug: { art: 'inbox', id: merker },
      }, { gespraech: raum });
      gelegt++;
    }
    await updateJson<VorschlagStand>(vorschlagName(person), cur => {
      const s = cur && cur.v === 1 ? cur : leer();
      return { ...s, geprueft: merkerAufraeumen({ ...s.geprueft, ...neu }, heute), letzterLauf: jetzt.toISOString() };
    });
    return { geprueft, gelegt };
  } catch (e) {
    console.warn(`[inbox-vorschlag] Lauf: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return { geprueft: 0, gelegt: 0, uebersprungen: 'fehler' };
  }
}

// ── Im Takt ─────────────────────────────────────────────────────────────────

const TAKT_KEY = Symbol.for('make-os.inbox-vorschlag-takt');

/**
 * Im Takt (app/api/zoe/takt): höchstens alle 5 Minuten ein Durchgang; je Person höchstens alle `taktMinuten` ein Lauf — nur Personen im
 * Haushalt des Inhabers (nur dort kann eine Freigabe eine Aufgabe anlegen) und nur, wenn sie es nicht ausgeschaltet haben. Ohne Modell.
 */
export async function inboxVorschlaegeImTakt(jetzt = new Date()): Promise<number> {
  const g = globalThis as unknown as Record<symbol, number | undefined>;
  if ((g[TAKT_KEY] ?? 0) > jetzt.getTime() - 5 * 60_000) return 0;
  g[TAKT_KEY] = jetzt.getTime();
  const [{ alleSpeicher }, { personImHaushaltDesInhabers }] = await Promise.all([import('@/lib/zugang/konten'), import('@/lib/zugang/haushalt-inhaber')]);
  let n = 0;
  for (const person of await alleSpeicher().catch(() => [] as string[])) {
    if (!(await personImHaushaltDesInhabers(person).catch(() => false))) continue;
    const s = await ladeVorschlagStand(person).catch(() => null);
    if (!s || s.automatisch === false) continue;
    if (s.letzterLauf && Date.parse(s.letzterLauf) > jetzt.getTime() - G.taktMinuten * 60_000) continue;
    n += (await inboxVorschlaegeLauf(person, { jetzt, quelle: 'takt' })).gelegt;
  }
  return n;
}

// ── Freigabe ────────────────────────────────────────────────────────────────

/**
 * Stapel-Art „inbox“: Freigabe per Klick — nur die Person, für die der Vorschlag liegt; das Gespräch muss noch in ihrer Inbox stehen;
 * angelegt über `/api/tasks/create` (Duplikat-Schutz: gibt es die Aufgabe schon offen, wird nichts doppelt angelegt). Scheitert es, bleibt
 * der Vorschlag offen. Protokoll nur Kennung + Feldnamen.
 */
export const INBOX_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!person || !(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'inbox' || v.werkzeug !== INBOX_VORSCHLAG_WERKZEUG) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person !== person) return { status: 403, fehler: 'Nur die Person, in deren Inbox die Nachricht liegt, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v = a.v;
    const aufgabe = aufgabeEingabe(v.eingabe?.aufgabe);
    const gespraech = typeof v.eingabe?.gespraech === 'string' ? v.eingabe.gespraech : '';
    if (!aufgabe || !gespraech) { await loslassen(v.id); return { ok: false, status: 400, fehler: 'Der Vorschlag ist unvollständig — nichts angelegt.' }; }
    let text: string;
    try {
      const da = (await stromRoh(person)).gespraeche.some(g => g.id === gespraech);
      if (!da) { await loslassen(v.id); return { ok: false, status: 409, fehler: 'Dieses Gespräch steht nicht mehr in deiner Inbox — nichts angelegt. Bitte ablehnen.' }; }
      const { innen } = await import('@/lib/zoe/innen');
      const r = await innen('/api/tasks/create', 'POST', aufgabe, person);
      if (r.status >= 400 || r.json.ok === false) {
        await loslassen(v.id);
        const s = r.status;
        return { ok: false, status: s === 400 || s === 403 || s === 404 || s === 413 ? s : 409, fehler: String(r.json.fehler ?? r.json.error ?? `Abgelehnt (${s}).`) };
      }
      text = r.json.duplikat ? 'Gab es schon als offene Aufgabe — nichts doppelt angelegt.' : `Aufgabe angelegt${aufgabe.dueDate ? ` (fällig ${tagKurz(aufgabe.dueDate)})` : ''} — mit Link zurück ins Gespräch.`;
    } catch (e) { await loslassen(v.id); throw e; }
    await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
    const { notiere } = await import('@/lib/zoe/protokoll');
    await notiere({ werkzeug: INBOX_VORSCHLAG_WERKZEUG, gruppe: INBOX_GRUPPE, risiko: 'freigabe', eingabe: { vorschlagId: v.id }, felder: ['title', 'description', 'dueDate', 'bezug'], ergebnis: 'Aufgabe aus der Inbox (Freigabe)', ok: true, quelle: 'stapel', person, ruecknahme: null });
    return { ok: true, text };
  },
};

