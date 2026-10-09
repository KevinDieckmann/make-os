// ─── Inbox 2 — ein Gespräch öffnen: Nachrichten, Antwort-Daten, Kontext, Vorschläge (Server, 06.10.2026) ──────────
// Nur aus den EIGENEN Spiegeln der Person. Text = reiner Text (nie HTML; die Oberfläche macht nur http(s)-Adressen anklickbar).
// Kontext (Front-Muster „Gespräch + Kontext daneben“): Person/Firma aus der Kartei, offene Deals der Person. Aufgaben und Termine holt
// die Oberfläche über die vorhandenen Wege (Aufgaben-Stand im Browser, /api/kalender/bezug) — keine zweite Lesestelle.
// Vorschläge (ohne Modell, nur Knöpfe — Kevin: „ZOE macht alles nur als Vorschlag + ein Klick“): `vorschlaegeFuer` (rein, getestet).

import { localDay } from '@/lib/zeit';
import { ladeCrm } from '@/lib/crm/speicher';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { ladeGmailStand, ladeGmailTexte } from '@/lib/gmail/stand';
import { antwortEmpfaenger } from '@/lib/gmail/senden';
import { aliaseSicherstellen } from '@/lib/gmail/abgleich';
import type { Adr, Anhang, GmailAlias, Zuordnung } from '@/lib/gmail/typen';
import { ladeImapTexte } from '@/lib/postfach/spiegel';
import { VOREINSTELLUNGEN } from '@/lib/postfach/anbieter';
import { fristAus } from './faecher';
import type { WaKopfInfo } from '@/lib/whatsapp/typen';
import { stromRoh } from './strom-server';
import { nachrichtenVon } from './verlauf';
import { uebergabeEmpfaenger } from './teilen';
import { uebergabenFuer } from './uebergaben-speicher';
import type { Gespraech, StromKopf } from './strom';
import { kontaktAnlegenErlaubt } from './aus-gespraech';

export interface NachrichtAnsicht {
  id: string; am: string; von: Adr; an: Adr[]; cc: Adr[]; betreff: string; text: string; vonUns: boolean; ungelesen: boolean;
  anhaenge: Anhang[]; bilder?: number; gekuerzt?: boolean; automatisch?: boolean;
  /** Nur WhatsApp (07.10.): Art, Zustellstand, Zustand des Mediums (lib/whatsapp/strom.ts `kopfInfo`). */
  wa?: WaKopfInfo;
}

export type VorschlagArt = 'aufgabe' | 'termin' | 'beleg' | 'zuordnen' | 'deal' | 'kontakt' | 'nachfassen';
export interface Vorschlag { art: VorschlagArt; text: string; datum?: string; anhang?: { nachricht: string; teil: string; name: string; typ: string } }

export interface GespraechAnsicht {
  gespraech: Gespraech;
  nachrichten: NachrichtAnsicht[];
  antwort: {
    antwortAuf: string;
    empfaenger: { antworten: { an: Adr[]; cc: Adr[] }; allen: { an: Adr[]; cc: Adr[] } };
    von: { email: string; name?: string }[];
    signatur?: string;
    hinweis?: string;
    postfach: string;
    bereichName: string;
  };
  kontext: {
    kontakt?: { id: string; name: string; firma?: string; firmaId?: string; sperre?: Zuordnung['sperre'] };
    deals: { id: string; titel: string; stufe: string }[];
    /**
     * Nur WhatsApp ohne Zuordnung (07.10. abends): Akten, die diese Nummer tragen, wenn es MEHRERE sind — „Zuordnen zu …“ nur per Klick,
     * nie automatisch. Nur Kennung, Name, Firma (die Person sieht ihre Kartei ohnehin).
     */
    kandidaten?: { id: string; name: string; firma?: string }[];
  };
  vorschlaege: Vorschlag[];
  /**
   * Übergeben (08.10., Lücke 6) — nur bei EIGENEN Gesprächen (Gmail/IMAP, kein Team-Postfach): an wen es gehen kann (Personen des
   * Haushalts mit Zugang zum Bereich) und an wen es schon übergeben ist. Team-Gespräche tragen stattdessen `gespraech.team`.
   */
  uebergabe?: { personen: { speicher: string; name: string }[]; bestehend: { id: string; an: string; anName: string; status: string; kopieAm: string }[] };
}

/** Vorschläge zu einem Gespräch (rein): höchstens drei, in fester Rangfolge. */
export function vorschlaegeFuer(g: Gespraech, nachrichten: readonly NachrichtAnsicht[], heute: string): Vorschlag[] {
  const raus: Vorschlag[] = [];
  const letzteFremd = [...nachrichten].reverse().find(n => !n.vonUns && !n.automatisch);
  const frist = letzteFremd ? fristAus(`${letzteFremd.betreff}\n${letzteFremd.text}`, heute) : null;
  if (g.fach === 'warten' && g.nachfassen) raus.push({ art: 'nachfassen', text: `Nachfassen — seit ${g.wartetTage} Tagen keine Antwort` });
  if (frist) raus.push({ art: 'aufgabe', text: `Aufgabe bis ${frist.datum.slice(8, 10)}.${frist.datum.slice(5, 7)}. („${frist.text}“)`, datum: frist.datum });
  if (g.fach === 'termine') raus.push({ art: 'termin', text: 'Termin vorschlagen' });
  const pdf = g.fach === 'geld' ? nachrichten.flatMap(n => n.anhaenge.filter(a => !a.eingebettet && /pdf|image\//i.test(a.typ)).map(a => ({ nachricht: n.id, teil: a.teil, name: a.name, typ: a.typ }))).pop() : undefined;
  if (pdf) raus.push({ art: 'beleg', text: `Beleg ablegen (${pdf.name})`, anhang: pdf });
  if (g.zuordnung && !g.zugeordnet && !g.zuordnung.sperre) raus.push({ art: 'zuordnen', text: `${g.zuordnung.name} zuordnen (Verlauf der Akte)` });
  if (g.zuordnung?.dealId && !g.zuordnung.sperre) raus.push({ art: 'deal', text: `Deal „${g.zuordnung.dealTitel}“: Nachfassen planen` });
  // „Kontakt anlegen“ macht einen Business-Lead — nur aus Business-Postfächern (Markttraktion 1.9, 09.10.).
  if (!g.zuordnung && g.fach !== 'info' && g.fach !== 'warten' && kontaktAnlegenErlaubt(g.bereich)) raus.push({ art: 'kontakt', text: 'Kontakt anlegen' });
  if (!frist && g.fach === 'antworten' && raus.length < 3) raus.push({ art: 'aufgabe', text: 'Aufgabe daraus machen' });
  return raus.slice(0, 3);
}

const ohneIntern = (k: StromKopf, text: string, vonUns: boolean): NachrichtAnsicht => ({
  id: k.id, am: k.am, von: k.von, an: k.an, cc: k.cc, betreff: k.betreff, text, vonUns, ungelesen: k.labels.includes('UNREAD') && !vonUns,
  anhaenge: k.anhaenge, ...(k.bilder ? { bilder: k.bilder } : {}), ...(k.gekuerzt ? { gekuerzt: true } : {}), ...(k.automatisch ? { automatisch: true } : {}),
  ...(k.wa ? { wa: k.wa } : {}),
});

/** Ein Gespräch der Person öffnen — `null`, wenn es das (für diese Person) nicht gibt. */
export async function gespraechLesen(person: string, id: string): Promise<GespraechAnsicht | null> {
  const heute = localDay();
  const roh = await stromRoh(person, heute);
  const g = roh.gespraeche.find(x => x.id === id);
  const p = roh.postfaecher.find(x => x.id === g?.postfachId);
  if (!g || !p) return null;
  const n = await nachrichtenVon(person, id);
  if (!n) return null;
  // WhatsApp: der ganze Text steht schon im Kopf (`ausschnitt`) — kein Textbestand daneben. Team-Postfach: Texte aus dem Spiegel des Besitzers.
  const besitzer = g.team?.postfach?.besitzer ?? person;
  const texte: Record<string, { t: string }> = g.quelle === 'gmail' ? (await ladeGmailTexte(person)).texte : g.quelle === 'imap' ? (await ladeImapTexte(besitzer)).texte : {};
  const vonUns = (k: StromKopf) => k.labels.includes('SENT') || k.ordner === 'g' || n.eigene.includes(k.von.email);
  const nachrichten = n.koepfe.map(k => ohneIntern(k, texte[k.id]?.t ?? k.ausschnitt, vonUns(k)));
  // Antwort bezieht sich auf die jüngste echte Nachricht von außen (sonst die jüngste überhaupt).
  const auf = [...n.koepfe].reverse().find(k => !vonUns(k) && !k.automatisch) ?? n.koepfe[n.koepfe.length - 1];
  let von: { email: string; name?: string }[] = [];
  if (g.quelle === 'gmail') {
    const s = await ladeGmailStand(person);
    const aliase: GmailAlias[] = s ? await aliaseSicherstellen(person).catch(() => s.aliase ?? []) : [];
    const eigen = s?.email ?? '';
    von = [{ email: eigen }, ...aliase.filter(a => a.verifiziert && a.email !== eigen).map(a => ({ email: a.email, ...(a.name ? { name: a.name } : {}) }))].filter(a => a.email);
  } else von = [{ email: p.adresse || p.anzeigename, ...(p.absenderName ? { name: p.absenderName } : {}) }];
  const crm = g.zuordnung ? await ladeCrm() : null;
  const deals = g.zuordnung && crm ? crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(g.zuordnung!.kontaktId)).map(c => ({ id: c.id, titel: c.titel, stufe: c.stufe })) : [];
  // WhatsApp ohne Zuordnung: trägt die Nummer mehr als eine Akte, wählt die Person (nie automatisch).
  const kandidaten = g.quelle === 'whatsapp' && !g.zuordnung && g.whatsapp ? await waKandidaten(g.whatsapp.nummer) : [];
  const vorschlaege = vorschlaegeFuer(g, nachrichten, heute).filter(v => !(kandidaten.length && v.art === 'kontakt'));
  const eigenes = !g.team && (g.quelle === 'gmail' || g.quelle === 'imap');
  const namenTeam = Object.fromEntries(roh.team.map(t => [t.speicher, t.name]));
  const uebergabe = eigenes ? {
    personen: uebergabeEmpfaenger(roh.team, person, g.bereich).map(t => ({ speicher: t.speicher, name: t.name })),
    bestehend: (await uebergabenFuer(person, roh.team)).filter(u => u.von === person && u.gespraech === id).map(u => ({ id: u.id, an: u.an, anName: namenTeam[u.an] ?? u.an, status: u.status, kopieAm: u.kopieAm })),
  } : undefined;
  return {
    gespraech: g,
    nachrichten,
    antwort: {
      antwortAuf: auf.id,
      empfaenger: { antworten: antwortEmpfaenger(auf, n.eigene, false), allen: antwortEmpfaenger(auf, n.eigene, true) },
      von, ...(p.signatur ? { signatur: p.signatur } : {}),
      ...(p.anbieter && VOREINSTELLUNGEN[p.anbieter].sendeHinweis ? { hinweis: VOREINSTELLUNGEN[p.anbieter].sendeHinweis } : {}),
      postfach: p.anzeigename, bereichName: p.oeffentlich.bereichName,
    },
    kontext: {
      ...(g.zuordnung ? { kontakt: { id: g.zuordnung.kontaktId, name: g.zuordnung.name, ...(g.zuordnung.firma ? { firma: g.zuordnung.firma } : {}), ...(g.zuordnung.firmaId ? { firmaId: g.zuordnung.firmaId } : {}), ...(g.zuordnung.sperre ? { sperre: g.zuordnung.sperre } : {}) } } : {}),
      deals,
      ...(kandidaten.length ? { kandidaten } : {}),
    },
    vorschlaege,
    ...(uebergabe ? { uebergabe } : {}),
  };
}

/** Mehrere Akten mit dieser Nummer → Auswahl „Zuordnen zu …“ (nur, wenn es mindestens zwei sind; eine eindeutige ordnet der Strom zu). */
async function waKandidaten(nummer: string): Promise<{ id: string; name: string; firma?: string }[]> {
  const [{ kontakteFuerVerarbeitung }, { telefonKandidaten }, { anzeigename }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/whatsapp/zuordnung'), import('@/lib/make-one/crm')]);
  const l = telefonKandidaten(nummer, await kontakteFuerVerarbeitung());
  return l.length > 1 ? l.map(k => ({ id: k.id, name: anzeigename(k), ...(k.firma ? { firma: k.firma } : {}) })) : [];
}

/** Die Gespräch-Kennung zu einer Gmail-Nachricht (Link `?offen=gmail-<Nachricht>` aus dem alten Verlauf). */
export async function gespraechZuGmailNachricht(person: string, nachricht: string): Promise<string | null> {
  const s = await ladeGmailStand(person);
  const k = s?.koepfe[nachricht];
  return k ? `gm~${k.threadId}` : null;
}
