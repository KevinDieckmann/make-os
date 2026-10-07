// ─── WhatsApp im Strom der Inbox — Gespräche je Gesprächspartner (07.10.2026) ──────────────────────────────────────────
// Der Adapter liefert der Inbox (lib/inbox/strom-server.ts `stromRoh`) dieselbe Form wie Gmail und IMAP:
//   · EIN Postfach `pf-<uuid aus der Telefonnummer-ID>` mit dem Bereich der Nummer (immer Business) — der Strom filtert danach, die
//     Sicht „Privat“ bekommt es nie;
//   · je wa_id EIN Gespräch `wa~<postfach>~<wa_id>` (stabil), Fach wie bei Mail (lib/inbox/faecher.ts — der Text der Nachricht zählt
//     für Termine/Geld, weil es keinen Betreff gibt), dazu `whatsapp: { nummer, fenster }` mit dem 24-h-Fenster;
//   · Nachrichten als Köpfe (`StromKopf`) — damit Gespräch öffnen, Verlauf der Akte nach „Zuordnen“, ZOE-Entwurf und Vorschläge
//     ohne Sonderweg laufen.
// „Neue Absender“ (Screener, seit 07.10. abends auch für WhatsApp): eine Nummer ohne Akte, nie zugelassen und nie von uns angeschrieben
// landet dort (Zulassen · Blocken je Person, Schlüssel „+<Ziffern>“ in lib/inbox/zustand.ts) — dieselbe Regel wie bei Mail-Adressen.
// Zuordnung: eindeutige Nummer der Akte (Anzeige) — oder die Person, die jemand per Klick „Zuordnen“ gewählt hat (gewinnt; so lässt
// sich auch eine Nummer zuordnen, die mehrere Akten tragen — nie automatisch).

import { ladeCrm } from '@/lib/crm/speicher';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { fachVon, fristAus, type FachNachricht } from '@/lib/inbox/faecher';
import type { Gespraech, GespraechZustand, StromKopf } from '@/lib/inbox/strom';
import type { Zuordnung } from '@/lib/gmail/typen';
import type { PostfachOeffentlich, Postfach } from '@/lib/postfach/typen';
import { whatsappFuer } from './server';
import { ladeWaSpiegel, ladeWaZustand, type WaSpiegel, type WaZustand } from './spiegel';
import { fensterBerechnen, nummerAnzeige, WA_ART_WORT, WA_GRENZEN, type WaKontakt, type WaKopfInfo, type WaNachricht } from './typen';
import { telefonIndex, telefonSchluessel, waZuordnen, zuordnungAus } from './zuordnung';

export const BETREFF = 'WhatsApp';
export const gespraechIdFuer = (postfachId: string, nummer: string): string => `wa~${postfachId}~${nummer}`;

/** Eine Nachricht als Kopf im Strom (rein). `ausschnitt` trägt den GANZEN Text (höchstens 4096 Zeichen) — es gibt keinen Textkörper daneben. */
export function kopfAus(n: WaNachricht, k: WaKontakt | undefined, eigene: string, postfachId: string): StromKopf {
  const gegen = { ...(k?.name ? { name: k.name } : {}), email: nummerAnzeige(n.nummer) };
  const ich = { email: eigene ? nummerAnzeige(eigene) : 'WhatsApp Business' };
  const ungelesen = n.richtung === 'ein' && (!k?.gelesenBis || n.am > k.gelesenBis);
  const text = n.text || (n.medium ? `[${WA_ART_WORT[n.art]}]` : WA_ART_WORT[n.art]);
  return {
    id: n.id, threadId: gespraechIdFuer(postfachId, n.nummer), am: n.am, postfachId,
    von: n.richtung === 'ein' ? gegen : ich, an: n.richtung === 'ein' ? [ich] : [gegen], cc: [],
    betreff: BETREFF, ausschnitt: text,
    labels: n.richtung === 'aus' ? ['SENT'] : ['INBOX', ...(ungelesen ? ['UNREAD'] : [])],
    anhaenge: n.medium ? [{ teil: 'wa', name: n.medium.name || WA_ART_WORT[n.art], typ: n.medium.mime, groesse: n.medium.groesse ?? 0 }] : [],
    wa: kopfInfo(n),
  };
}

/** Was die Gesprächsansicht zusätzlich braucht (rein): Art, Zustellstand + Fehlersatz, Zustand des Mediums, Vorlagen-Name. */
export function kopfInfo(n: WaNachricht): WaKopfInfo {
  return {
    art: n.art,
    ...(n.richtung === 'aus' && n.status ? { status: n.status } : {}),
    ...(n.richtung === 'aus' && n.fehler ? { fehler: n.fehler.text } : {}),
    ...(n.medium ? { medium: n.medium.zustand } : {}),
    ...(n.vorlage ? { vorlage: n.vorlage.name } : {}),
  };
}

export interface WaStromEingabe {
  spiegel: WaSpiegel;
  postfachId: string;
  bereich: string;
  /** Eigene Nummer (Ziffern) — nur Anzeige. */
  eigene: string;
  zuordnung: Record<string, Zuordnung>;
  zustand: Record<string, GespraechZustand>;
  /** Screener-Entscheidungen der Person (Schlüssel „+<Ziffern>“, lib/inbox/zustand.ts). */
  absender?: Record<string, { status: 'zugelassen' | 'geblockt' }>;
  heute: string;
  jetzt: number;
}

/**
 * „Betreff“ eines Chats (rein): der Anfang der jüngsten Nachricht der Gegenseite (sonst der jüngsten überhaupt), höchstens 60 Zeichen —
 * so lesen sich Liste und ZOE-Satz („Erika braucht „Können wir bis Freitag …“ bis Freitag“) statt eines leeren „WhatsApp“.
 */
export function betreffAus(n: readonly WaNachricht[]): string {
  const m = [...n].reverse().find(x => x.richtung === 'ein' && x.text.trim()) ?? [...n].reverse().find(x => x.text.trim()) ?? n[n.length - 1];
  const t = (m?.text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return m ? `${BETREFF} · ${WA_ART_WORT[m.art]}` : BETREFF;
  return t.length > 60 ? `${t.slice(0, 59).replace(/\s+\S*$/, '')}…` : t;
}

const tageZwischen = (iso: string, heute: string) => Math.max(0, Math.floor((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T12:00:00Z`)) / 86_400_000));

/** Gespräche aus dem Spiegel (rein, getestet). */
export function waGespraecheBauen(e: WaStromEingabe): Gespraech[] {
  const je = new Map<string, WaNachricht[]>();
  for (const n of Object.values(e.spiegel.nachrichten)) (je.get(n.nummer) ?? je.set(n.nummer, []).get(n.nummer)!).push(n);
  const raus: Gespraech[] = [];
  for (const [nummer, roh] of je) {
    const n = [...roh].sort((a, b) => a.am.localeCompare(b.am) || a.id.localeCompare(b.id));
    const k = e.spiegel.kontakte[nummer];
    const id = gespraechIdFuer(e.postfachId, nummer);
    const koepfe = n.map(x => kopfAus(x, k, e.eigene, e.postfachId));
    const fachN: FachNachricht[] = n.map((x, i) => ({ am: x.am, von: koepfe[i].von, betreff: koepfe[i].ausschnitt.slice(0, 200), ausschnitt: koepfe[i].ausschnitt, labels: koepfe[i].labels, anhaenge: koepfe[i].anhaenge, vonUns: x.richtung === 'aus' }));
    const z = e.zuordnung[nummer];
    // Screener wie bei Mail: unbekannte Nummer (keine Akte, nie zugelassen, nie von uns angeschrieben) → „Neue Absender“.
    const f = fachVon({ nachrichten: fachN, zugeordnet: !!z && !z.sperre, absender: e.absender?.[nummerAnzeige(nummer)]?.status, angeschrieben: false, ohneScreener: true, heute: e.heute });
    const massgeblich = n[f.massgeblich] ?? n[n.length - 1];
    const juengste = n[n.length - 1];
    const st = e.zustand[id] ?? {};
    const neuerAlsSpaeter = !!st.spaeter && n.some(x => x.am > st.spaeter!.seit);
    const wiedervorlage = st.spaeter && !neuerAlsSpaeter ? (st.spaeter.bis <= e.heute ? 'faellig' as const : st.spaeter.bis) : undefined;
    const erledigt = !!st.erledigt && st.erledigt.bis === juengste.id;
    const ruht = !!wiedervorlage && wiedervorlage !== 'faellig';
    const vonUns = massgeblich.richtung === 'aus';
    const frist = vonUns ? null : fristAus(massgeblich.text, e.heute);
    const fenster = fensterBerechnen(k?.zuletztEingehend, e.jetzt);
    const ausschnitt = koepfe[koepfe.length - 1].ausschnitt.replace(/\s+/g, ' ').slice(0, WA_GRENZEN.ausschnitt);
    raus.push({
      id, quelle: 'whatsapp', postfachId: e.postfachId, bereich: e.bereich, betreff: betreffAus(n),
      gegenueber: { ...(z?.name ? { name: z.name } : k?.name ? { name: k.name } : {}), email: nummerAnzeige(nummer) },
      anzahl: n.length, am: juengste.am, ausschnitt, vonUns, ungelesen: koepfe.some(x => x.labels.includes('UNREAD')), offen: !erledigt,
      anhaenge: n.filter(x => x.medium).length, fach: f.fach,
      ...(f.wartetTage !== undefined ? { wartetTage: f.wartetTage } : {}), ...(f.nachfassen ? { nachfassen: true } : {}), ...(f.verjaehrt ? { verjaehrt: true } : {}),
      ...(f.fach !== 'warten' && f.fach !== 'info' && !vonUns ? { wartetAufUns: tageZwischen(massgeblich.am, e.heute) } : {}),
      ...(wiedervorlage ? { wiedervorlage } : {}), ...(z ? { zuordnung: z } : {}), ...(st.zuordnung ? { zugeordnet: true } : {}),
      absender: nummerAnzeige(nummer), ...(frist ? { frist } : {}), juengste: juengste.id, nachrichten: n.map(x => x.id),
      inArbeit: f.fach !== 'geblockt' && !ruht && !erledigt && (f.fach !== 'warten' || !f.verjaehrt),
      whatsapp: { nummer, fenster, ...(k?.name ? { profilname: k.name } : {}) },
    });
  }
  return raus;
}

/** Zustand des WhatsApp-Postfachs für die Postfach-Leiste (rein). */
export function waPostfachZustand(z: WaZustand, nachrichten: number): PostfachOeffentlich['zustand'] {
  const tokenKaputt = !!z.token?.fehlerAt && (!z.token.okAt || z.token.fehlerAt > z.token.okAt);
  if (tokenKaputt) return { stufe: 'anmeldung', fehler: 'Meta hat den Zugriffsschlüssel abgelehnt — „Verbindung erneuern“ unter Verbindungen.', nachrichten };
  if (!z.webhook?.zuletzt) return { stufe: 'neu', nachrichten };
  return { stufe: 'aktuell', at: z.webhook.zuletzt, nachrichten };
}

/**
 * Zuordnungen aller Nummern des Spiegels (Anzeige — auch eingeschränkte Personen, gekennzeichnet). `bestaetigt` (Nummer → Kontakt aus
 * „Zuordnen“ der Person) gewinnt vor dem Telefon-Index — so steht auch eine mehrdeutige Nummer nach dem Klick bei der gewählten Person.
 */
async function zuordnungen(s: WaSpiegel, bestaetigt: Record<string, string>): Promise<Record<string, Zuordnung>> {
  const nummern = Object.keys(s.kontakte);
  if (!nummern.length) return {};
  const [kontakte, crm] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm()]);
  const index = telefonIndex(kontakte);
  const je = new Map(kontakte.map(k => [k.id, k]));
  const raus: Record<string, Zuordnung> = {};
  for (const n of nummern) {
    const gewaehlt = bestaetigt[n] ? je.get(bestaetigt[n]) : undefined;
    const z = gewaehlt ? zuordnungAus(gewaehlt, crm) : waZuordnen(n, index, crm);
    if (z) raus[n] = z;
  }
  return raus;
}

/** Nummer → bestätigter Kontakt aus dem Inbox-Zustand der Person (rein): nur Gespräche dieses Postfachs. */
export function bestaetigteNummern(zustand: Record<string, GespraechZustand>, postfachId: string): Record<string, string> {
  const raus: Record<string, string> = {};
  const vor = `wa~${postfachId}~`;
  for (const [id, z] of Object.entries(zustand)) if (id.startsWith(vor) && z.zuordnung?.kontaktId) raus[id.slice(vor.length)] = z.zuordnung.kontaktId;
  return raus;
}

/**
 * Für `stromRoh`: das Postfach der Business-Nummer und seine Gespräche — null, wenn WhatsApp nicht eingerichtet ist oder diese
 * Person keinen Zugang hat (fremder Haushalt, nicht in WHATSAPP_PERSONEN).
 */
export async function whatsappImStrom(person: string, gespraechZustand: Record<string, GespraechZustand>, heute: string, namen: Record<string, string>, jetzt = Date.now(), absender: Record<string, { status: 'zugelassen' | 'geblockt' }> = {}): Promise<{ postfach: Postfach & { oeffentlich: PostfachOeffentlich }; gespraeche: Gespraech[] } | null> {
  const k = await whatsappFuer(person);
  if (!k) return null;
  const [s, z] = await Promise.all([ladeWaSpiegel(), ladeWaZustand()]);
  const eigene = telefonSchluessel(z.telefon?.nummer);
  const zu = await zuordnungen(s, bestaetigteNummern(gespraechZustand, k.postfachId));
  const gespraeche = waGespraecheBauen({ spiegel: s, postfachId: k.postfachId, bereich: k.bereich, eigene, zuordnung: zu, zustand: gespraechZustand, absender, heute, jetzt });
  const anzeigename = `WhatsApp · ${z.telefon?.anzeigename ?? 'Business'}`;
  const adresse = eigene ? nummerAnzeige(eigene) : '';
  return {
    postfach: {
      id: k.postfachId, quelle: 'whatsapp', bereich: k.bereich, anzeigename, adresse, angelegtAm: '',
      oeffentlich: { id: k.postfachId, quelle: 'whatsapp', bereich: k.bereich, bereichName: namen[k.bereich] ?? k.bereich, anzeigename, adresse, zustand: waPostfachZustand(z, Object.keys(s.nachrichten).length) },
    },
    gespraeche,
  };
}

/** Für `nachrichtenVon` (lib/inbox/verlauf.ts): die Köpfe eines WhatsApp-Gesprächs — nur mit Zugang und für die eigene Nummer. */
export async function whatsappNachrichtenVon(person: string, postfach: string, nummer: string): Promise<{ koepfe: StromKopf[]; eigene: string[]; postfach: string } | null> {
  const k = await whatsappFuer(person);
  if (!k || postfach !== k.postfachId) return null;
  const [s, z] = await Promise.all([ladeWaSpiegel(), ladeWaZustand()]);
  const kontakt = s.kontakte[nummer];
  const eigene = telefonSchluessel(z.telefon?.nummer);
  const koepfe = Object.values(s.nachrichten).filter(n => n.nummer === nummer).sort((a, b) => a.am.localeCompare(b.am) || a.id.localeCompare(b.id)).map(n => kopfAus(n, kontakt, eigene, k.postfachId));
  return koepfe.length ? { koepfe, eigene: [eigene ? nummerAnzeige(eigene) : 'WhatsApp Business'], postfach: k.postfachId } : null;
}
