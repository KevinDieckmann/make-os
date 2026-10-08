// ─── Inbox teilen — „An <Person> übergeben“ (Server, 08.10.2026, Lücke 6) ───────────────────────────────────────────
// Kevin 08.10.: „Mail nicht übergebbar … → ‚An <Person> übergeben‘ (freigegebene Kopie)“. Eine Person übergibt ein Gespräch aus
// IHREM Postfach (Gmail oder IMAP, kein Team-Postfach — dort gilt „wer kümmert sich“) an eine Person des Haushalts, die den Bereich
// des Postfachs sehen darf. Der Server legt eine KOPIE an: Köpfe + Texte der Nachrichten bis jetzt, Anhänge nur als Liste (laden
// kann sie nur die übergebende Person aus ihrem Spiegel), dazu die Notiz und „wer kümmert sich“. Neue Nachrichten im Original wandern
// NICHT mit — „Kopie aktualisieren“ (nur die übergebende Person). Die Empfängerin antwortet nur über ein EIGENES Postfach (bzw. ein
// Team-Postfach, das sie sieht) desselben Raums, oder gibt „zurück an …“ mit Notiz. „Erledigt“ gilt für beide.
// Glocke an die andere Person über `melde()` — neutraler Titel ohne Betreff. Protokoll nur Kennung + Feldnamen, nie Text.

import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { melde } from '@/lib/meldungen/melden';
import { ladeGmailTexte } from '@/lib/gmail/stand';
import { ladeImapTexte } from '@/lib/postfach/spiegel';
import { stromRoh } from './strom-server';
import { nachrichtenVon } from './verlauf';
import { teamPersonen } from './teilen-server';
import { aendereUebergaben, standPruefen, uebergabenFuer } from './uebergaben-speicher';
import {
  kopiePruefen, notizSauber, raumVon, TeilenFehler, uebergabeAnwenden, uebergabeEmpfaenger,
  type Uebergabe, type UebergabeAktion, type UebergabeNachricht,
} from './teilen';

const TITEL = {
  uebergeben: (n: string) => `${n} hat dir ein Gespräch übergeben.`,
  zurueck: (n: string) => `${n} hat dir ein übergebenes Gespräch zurückgegeben.`,
  erledigt: (n: string) => `${n} hat ein übergebenes Gespräch erledigt.`,
  wieder: (n: string) => `${n} hat dir ein Gespräch erneut übergeben.`,
  kuemmert: (n: string) => `${n} bittet dich, dich um ein übergebenes Gespräch zu kümmern.`,
};
export const uebergabeLink = (id: string) => `/os/inbox?offen=${id}`;

/** Die Kopie eines EIGENEN Gesprächs (Gmail/IMAP der Person) — Köpfe + Texte, Anhänge nur als Liste. Wirft `TeilenFehler`. */
export async function kopieBauen(person: string, gespraech: string): Promise<UebergabeNachricht[]> {
  const n = await nachrichtenVon(person, gespraech);
  if (!n) throw new TeilenFehler('Dieses Gespräch gibt es in deinem Postfach nicht (mehr).', 404);
  const texte = gespraech.startsWith('gm~') ? (await ladeGmailTexte(person)).texte : (await ladeImapTexte(person)).texte;
  const kopie: UebergabeNachricht[] = n.koepfe.map(k => {
    const vonUns = k.labels.includes('SENT') || k.ordner === 'g' || n.eigene.includes(k.von.email);
    return {
      id: k.id, am: k.am, von: k.von, an: k.an, cc: k.cc, ...(k.antwortAn ? { antwortAn: k.antwortAn } : {}), betreff: k.betreff,
      text: texte[k.id]?.t ?? k.ausschnitt, vonUns, ...(k.automatisch ? { automatisch: true } : {}),
      ...(k.messageId ? { messageId: k.messageId } : {}), ...(k.references?.length ? { references: k.references } : {}),
      anhaenge: k.anhaenge.filter(a => !a.eingebettet).map(a => ({ teil: a.teil, name: a.name, typ: a.typ, groesse: a.groesse })),
    };
  });
  kopiePruefen(kopie);
  return kopie;
}

/** Wem diese Person dieses Gespräch übergeben kann (Personen des Haushalts mit Zugang zum Bereich, ohne sie selbst). */
export async function uebergabePersonen(person: string, bereich: string | null): Promise<{ speicher: string; name: string }[]> {
  return uebergabeEmpfaenger(await teamPersonen(), person, bereich).map(p => ({ speicher: p.speicher, name: p.name }));
}

/** Übergeben. Wirft `TeilenFehler` (400/403/404/409/413). */
export async function uebergeben(person: string, gespraech: string, an: string, notizRoh?: unknown, jetzt = new Date()): Promise<Uebergabe> {
  const team = await teamPersonen();
  const ich = team.find(t => t.speicher === person);
  if (!ich) throw new TeilenFehler('Nur im Haushalt.', 403);
  const g = (await stromRoh(person)).gespraeche.find(x => x.id === gespraech);
  if (!g) throw new TeilenFehler('Dieses Gespräch gibt es nicht (mehr).', 404);
  if (g.quelle === 'whatsapp' || g.team) throw new TeilenFehler('Dieses Gespräch sieht das Team schon — dort „Wer kümmert sich“ wählen statt übergeben.', 400);
  if (g.quelle !== 'gmail' && g.quelle !== 'imap') throw new TeilenFehler('Dieses Gespräch lässt sich nicht übergeben.', 400);
  const empf = uebergabeEmpfaenger(team, person, g.bereich).find(p => p.speicher === an);
  if (!empf) throw new TeilenFehler(an === person ? 'An dich selbst geht keine Übergabe.' : 'An diese Person geht keine Übergabe aus diesem Bereich (Privat nur an volle Mitglieder des Haushalts).', 403);
  const notiz = notizSauber(notizRoh);
  const nachrichten = await kopieBauen(person, gespraech);
  const am = jetzt.toISOString();
  const u: Uebergabe = {
    id: neueKennung('ub'), von: person, an, gespraech, quelle: g.quelle, postfachId: g.postfachId, bereich: g.bereich,
    betreff: g.betreff, gegenueber: g.gegenueber, ...(notiz ? { notiz } : {}), kuemmert: an, status: 'offen',
    angelegtAm: am, kopieAm: am, geaendertAm: am, nachrichten, verlauf: [{ am, von: person, was: 'uebergeben', wer: an, ...(notiz ? { notiz } : {}) }],
  };
  await aendereUebergaben(l => {
    if (l.some(x => x.von === person && x.an === an && x.gespraech === gespraech && x.status !== 'erledigt')) throw new TeilenFehler(`Schon an ${empf.name} übergeben — dort „Kopie aktualisieren“.`, 409);
    return { liste: [...l, u], wert: null };
  }, jetzt);
  await melde({ an, art: 'postfach', titel: TITEL.uebergeben(ich.name), link: uebergabeLink(u.id), von: person });
  return u;
}

/** Eine Übergabe, die diese Person sehen darf — sonst null. */
export async function uebergabeFinden(person: string, id: string): Promise<Uebergabe | null> {
  return (await uebergabenFuer(person)).find(u => u.id === id) ?? null;
}

export type UebergabeBefehl = 'zurueck' | 'erledigt' | 'wieder' | 'kuemmert' | 'aktualisieren';
export const UEBERGABE_BEFEHLE: readonly UebergabeBefehl[] = ['zurueck', 'erledigt', 'wieder', 'kuemmert', 'aktualisieren'];

/** Eine Aktion auf eine sichtbare Übergabe (mit optionalem Stand → 409). Meldet der anderen Person. */
export async function uebergabeAktion(person: string, id: string, befehl: UebergabeBefehl, o: { notiz?: unknown; wer?: string; stand?: string } = {}, jetzt = new Date()): Promise<Uebergabe> {
  const sichtbar = await uebergabeFinden(person, id);
  if (!sichtbar) throw new TeilenFehler('Diese Übergabe gibt es nicht (mehr).', 404);
  let aktion: UebergabeAktion;
  if (befehl === 'aktualisieren') {
    if (person !== sichtbar.von) throw new TeilenFehler('Die Kopie aktualisiert nur die Person, die übergeben hat.', 403);
    aktion = { art: 'aktualisiert', nachrichten: await kopieBauen(person, sichtbar.gespraech) };
  } else if (befehl === 'kuemmert') aktion = { art: 'kuemmert', wer: String(o.wer ?? '') };
  else if (befehl === 'zurueck' || befehl === 'wieder') aktion = { art: befehl, ...(o.notiz !== undefined ? { notiz: String(o.notiz ?? '') } : {}) };
  else aktion = { art: 'erledigt' };
  const am = jetzt.toISOString();
  const neu = await aendereUebergaben(l => {
    const i = l.findIndex(x => x.id === id);
    if (i < 0) throw new TeilenFehler('Diese Übergabe gibt es nicht (mehr).', 404);
    standPruefen(l[i], o.stand);
    const n = uebergabeAnwenden(l[i], aktion, person, am);
    l[i] = n;
    return { liste: l, wert: n };
  }, jetzt);
  const andere = person === neu.von ? neu.an : neu.von;
  const name = (await teamPersonen()).find(t => t.speicher === person)?.name ?? person;
  if (befehl === 'zurueck') await melde({ an: andere, art: 'postfach', titel: TITEL.zurueck(name), link: uebergabeLink(id), von: person });
  else if (befehl === 'erledigt') await melde({ an: andere, art: 'postfach', titel: TITEL.erledigt(name), link: uebergabeLink(id), von: person });
  else if (befehl === 'wieder') await melde({ an: andere, art: 'postfach', titel: TITEL.wieder(name), link: uebergabeLink(id), von: person });
  else if (befehl === 'kuemmert' && neu.kuemmert !== person) await melde({ an: neu.kuemmert, art: 'postfach', titel: TITEL.kuemmert(name), link: uebergabeLink(id), von: person });
  return neu;
}

/** Nach einer Antwort der Empfängerin: Vermerk „geantwortet“ (ohne Text). Fehler hier halten nichts auf. */
export async function uebergabeGeantwortet(person: string, id: string): Promise<void> {
  await aendereUebergaben(l => {
    const i = l.findIndex(x => x.id === id);
    if (i >= 0) l[i] = uebergabeAnwenden(l[i], { art: 'geantwortet' }, person, new Date().toISOString());
    return { liste: l, wert: null };
  }).catch(e => console.warn(`[uebergabe] Vermerk: ${e instanceof Error ? e.message.slice(0, 80) : 'Fehler'}`));
}

/**
 * Aus welchen Postfächern die Empfängerin antworten darf: ihre eigenen (Gmail/IMAP) und Team-Postfächer, die sie sieht — nur im
 * selben Raum (Privat ↔ Privat, Business ↔ Business), nie WhatsApp, nie mit abgelehnter Anmeldung.
 */
export async function antwortPostfaecher(person: string, u: Pick<Uebergabe, 'bereich'>): Promise<{ id: string; name: string; adresse: string }[]> {
  const r = await stromRoh(person, localDay());
  return r.postfaecher
    .filter(p => p.quelle !== 'whatsapp' && p.oeffentlich.zustand.stufe !== 'anmeldung' && raumVon(p.bereich) === raumVon(u.bereich))
    .map(p => ({ id: p.id, name: `${p.anzeigename} · ${p.oeffentlich.bereichName}`, adresse: p.oeffentlich.adresse }));
}

/** Neuere Nachrichten im Original seit der Kopie (nur für die übergebende Person, aus ihrem Spiegel). */
export async function neuerAlsKopie(person: string, u: Uebergabe): Promise<number> {
  if (person !== u.von) return 0;
  const n = await nachrichtenVon(person, u.gespraech).catch(() => null);
  if (!n) return 0;
  const da = new Set(u.nachrichten.map(x => x.id));
  return n.koepfe.filter(k => !da.has(k.id)).length;
}

