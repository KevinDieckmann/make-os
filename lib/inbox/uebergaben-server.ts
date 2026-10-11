// ─── Inbox teilen — „An <Person> übergeben“ (Server, 08.10.2026, Lücke 6) ───────────────────────────────────────────
// Kevin 08.10.: „Mail nicht übergebbar … → ‚An <Person> übergeben‘ (freigegebene Kopie)“. Eine Person übergibt ein Gespräch aus
// IHREM Postfach (Gmail oder IMAP, kein Team-Postfach — dort gilt „wer kümmert sich“) an eine Person des Haushalts, die den Bereich
// des Postfachs sehen darf. Der Server legt eine KOPIE an: Köpfe + Texte der Nachrichten bis jetzt, Anhänge als Liste (als Datei nur die
// ausdrücklich angehakten, siehe unten — die übrigen lädt nur die übergebende Person aus ihrem Spiegel), dazu die Notiz und „wer kümmert sich“. Neue Nachrichten im Original wandern
// NICHT mit — „Kopie aktualisieren“ (nur die übergebende Person). Die Empfängerin antwortet nur über ein EIGENES Postfach (bzw. ein
// Team-Postfach, das sie sieht) desselben Raums, oder gibt „zurück an …“ mit Notiz. „Erledigt“ gilt für beide.
// Glocke an die andere Person über `melde()` — neutraler Titel ohne Betreff. Protokoll nur Kennung + Feldnamen, nie Text.
// 10.10. (Roadmap Lücke 6, Nachtrag): Anhänge AUSDRÜCKLICH angehakt → verschlüsselte Kopie der Bytes in der Ablage (`ua-<uuid>.bin`, Ordner
// `inbox-uebergaben`), die Empfängerin lädt sie über GET /api/inbox/uebergaben?id=…&anhang=… herunter; „Zurückziehen“ (nur die übergebende
// Person) entfernt die Kopie samt Dateien; die Kennzeichen der Gegenseite (Werbesperre, Art. 18) wandern mit (`sperre`).

import { randomUUID } from 'crypto';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { bildAblegen, bildEntfernen, bildOeffnen } from '@/lib/store/bild-ablage';
import { melde } from '@/lib/meldungen/melden';
import { ladeGmailTexte } from '@/lib/gmail/stand';
import { ladeImapTexte } from '@/lib/postfach/spiegel';
import { stromRoh } from './strom-server';
import { nachrichtenVon } from './verlauf';
import { teamPersonen } from './teilen-server';
import { aendereUebergaben, standPruefen, uebergabenFuer } from './uebergaben-speicher';
import {
  ablageUebernehmen, anhangWahlSauber, kopiePruefen, notizSauber, raumVon, TeilenFehler, uebergabeAnwenden, uebergabeEmpfaenger, zurueckziehenPruefen,
  UEBERGABE_ABLAGE_NAME, UEBERGABE_ABLAGE_ORDNER, UEBERGABE_GRENZEN, type Uebergabe, type UebergabeAktion, type UebergabeNachricht,
} from './teilen';

const TITEL = {
  uebergeben: (n: string) => `${n} hat dir ein Gespräch übergeben.`,
  zurueck: (n: string) => `${n} hat dir ein übergebenes Gespräch zurückgegeben.`,
  erledigt: (n: string) => `${n} hat ein übergebenes Gespräch erledigt.`,
  wieder: (n: string) => `${n} hat dir ein Gespräch erneut übergeben.`,
  kuemmert: (n: string) => `${n} bittet dich, dich um ein übergebenes Gespräch zu kümmern.`,
  zurueckgezogen: (n: string) => `${n} hat ein übergebenes Gespräch zurückgezogen.`,
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

/**
 * Die angehakten Anhänge aus dem EIGENEN Spiegel holen und verschlüsselt ablegen (Ordner `inbox-uebergaben`). Nur Anhänge, die in der Kopie
 * stehen (also aus diesem Gespräch, nicht eingebettet); zusammen höchstens `UEBERGABE_GRENZEN.anhaengeBytes` → sonst 413, nichts abgelegt.
 * Liefert die Kopie mit `ablage` an den gewählten Anhängen. Scheitert etwas, sind schon abgelegte Dateien wieder weg.
 */
async function anhaengeMitgeben(person: string, quelle: 'gmail' | 'imap', kopie: UebergabeNachricht[], wahl: { nachricht: string; teil: string }[]): Promise<{ kopie: UebergabeNachricht[]; dateien: string[] }> {
  if (!wahl.length) return { kopie, dateien: [] };
  const dateien: string[] = [];
  const zuordnung = new Map<string, string>();
  let summe = 0;
  try {
    for (const w of wahl) {
      const meta = kopie.find(n => n.id === w.nachricht)?.anhaenge.find(a => a.teil === w.teil);
      if (!meta) throw new TeilenFehler('Einen gewählten Anhang gibt es in diesem Gespräch nicht — nichts übergeben.', 404);
      summe += meta.groesse;
      if (summe > UEBERGABE_GRENZEN.anhaengeBytes) throw new TeilenFehler(`Die gewählten Anhänge sind zusammen größer als ${UEBERGABE_GRENZEN.anhaengeBytes / 1048576} MB — nichts übergeben.`, 413);
      let bytes: Buffer;
      try {
        bytes = quelle === 'gmail'
          ? Buffer.from((await (await import('@/lib/gmail/aktion')).gmailAnhang(person, w.nachricht, w.teil)).bytes)
          : (await (await import('@/lib/postfach/aktion')).imapAnhang(person, w.nachricht, w.teil)).bytes;
      } catch (e) {
        const st = (e as { status?: number }).status;
        throw new TeilenFehler(`Der Anhang „${meta.name}“ ließ sich gerade nicht holen${st === 413 ? ' (zu groß)' : ''} — nichts übergeben.`, st === 413 ? 413 : 409);
      }
      const name = `ua-${randomUUID()}.bin`;
      await bildAblegen(UEBERGABE_ABLAGE_ORDNER, name, bytes);
      dateien.push(name);
      zuordnung.set(`${w.nachricht}|${w.teil}`, name);
    }
  } catch (e) {
    for (const d of dateien) await bildEntfernen(UEBERGABE_ABLAGE_ORDNER, d).catch(() => {});
    throw e;
  }
  return { kopie: kopie.map(n => ({ ...n, anhaenge: n.anhaenge.map(a => { const ab = zuordnung.get(`${n.id}|${a.teil}`); return ab ? { ...a, ablage: ab } : a; }) })), dateien };
}

/** Anhänge als Datei mitgeben bei Art. 18 → 409 (rein, getestet). Ohne gewählte Anhänge bleibt die Übergabe (Kopie mit Kennzeichen) möglich. */
export function anhaengeBeiSperrePruefen(sperre: string | null | undefined, gewaehlt: number): void {
  if (sperre === 'eingeschraenkt' && gewaehlt > 0) throw new TeilenFehler('Die Verarbeitung dieser Person ist eingeschränkt (Art. 18) — Anhänge gehen nicht als Datei mit. Ohne Anhänge übergeben oder nichts tun.', 409);
}

/**
 * Übergeben. Wirft `TeilenFehler` (400/403/404/409/413). `anhaengeRoh` (10.10.): ausdrücklich angehakte Anhänge `[{ nachricht, teil }]` —
 * nur diese gehen als (verschlüsselte) Datei mit, alle anderen stehen nur als Name in der Kopie.
 */
export async function uebergeben(person: string, gespraech: string, an: string, notizRoh?: unknown, jetzt = new Date(), anhaengeRoh?: unknown): Promise<Uebergabe> {
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
  const wahl = anhangWahlSauber(anhaengeRoh);
  // Art. 18 (Prüf-Fund 11.10.): bei eingeschränkter Verarbeitung keine Datei-Kopien in die Ablage — 409, nichts abgelegt, nichts übergeben.
  anhaengeBeiSperrePruefen(g.zuordnung?.sperre, wahl.length);
  const schonDa = (l: readonly Uebergabe[]) => l.some(x => x.von === person && x.an === an && x.gespraech === gespraech && x.status !== 'erledigt');
  // Vorab prüfen (bevor Anhänge geholt werden) — in der Sperre unten noch einmal.
  if (schonDa(await uebergabenFuer(person, team))) throw new TeilenFehler(`Schon an ${empf.name} übergeben — dort „Kopie aktualisieren“.`, 409);
  const mit = await anhaengeMitgeben(person, g.quelle, await kopieBauen(person, gespraech), wahl);
  const am = jetzt.toISOString();
  const u: Uebergabe = {
    id: neueKennung('ub'), von: person, an, gespraech, quelle: g.quelle, postfachId: g.postfachId, bereich: g.bereich,
    betreff: g.betreff, gegenueber: g.gegenueber, ...(g.zuordnung?.sperre ? { sperre: g.zuordnung.sperre } : {}), ...(notiz ? { notiz } : {}), kuemmert: an, status: 'offen',
    angelegtAm: am, kopieAm: am, geaendertAm: am, nachrichten: mit.kopie, verlauf: [{ am, von: person, was: 'uebergeben', wer: an, ...(notiz ? { notiz } : {}) }],
  };
  try {
    await aendereUebergaben(l => {
      if (schonDa(l)) throw new TeilenFehler(`Schon an ${empf.name} übergeben — dort „Kopie aktualisieren“.`, 409);
      return { liste: [...l, u], wert: null };
    }, jetzt);
  } catch (e) {
    for (const d of mit.dateien) await bildEntfernen(UEBERGABE_ABLAGE_ORDNER, d).catch(() => {});
    throw e;
  }
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
  let sperre: Uebergabe['sperre'] | null | undefined;
  if (befehl === 'aktualisieren') {
    if (person !== sichtbar.von) throw new TeilenFehler('Die Kopie aktualisiert nur die Person, die übergeben hat.', 403);
    // Mitgegebene Anhänge bleiben, solange ihre Nachricht in der Kopie steht; das Kennzeichen der Gegenseite wird neu gelesen.
    aktion = { art: 'aktualisiert', nachrichten: ablageUebernehmen(sichtbar.nachrichten, await kopieBauen(person, sichtbar.gespraech)) };
    const g = (await stromRoh(person).catch(() => null))?.gespraeche.find(x => x.id === sichtbar.gespraech);
    sperre = g ? (g.zuordnung?.sperre ?? null) : undefined;
  } else if (befehl === 'kuemmert') aktion = { art: 'kuemmert', wer: String(o.wer ?? '') };
  else if (befehl === 'zurueck' || befehl === 'wieder') aktion = { art: befehl, ...(o.notiz !== undefined ? { notiz: String(o.notiz ?? '') } : {}) };
  else aktion = { art: 'erledigt' };
  const am = jetzt.toISOString();
  const neu = await aendereUebergaben(l => {
    const i = l.findIndex(x => x.id === id);
    if (i < 0) throw new TeilenFehler('Diese Übergabe gibt es nicht (mehr).', 404);
    standPruefen(l[i], o.stand);
    let n = uebergabeAnwenden(l[i], aktion, person, am);
    if (sperre !== undefined) { const { sperre: _s, ...rest } = n; n = sperre ? { ...rest, sperre } : rest; }
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

/**
 * Zurückziehen (10.10.): NUR die übergebende Person entfernt die Kopie ganz — bei der Empfängerin ist sie danach weg (samt mitgegebener
 * Dateien, die `aendereUebergaben` löscht). Mit optionalem Stand (409). Die Empfängerin bekommt eine neutrale Glocke (ohne Betreff).
 */
export async function zurueckziehen(person: string, id: string, stand?: string, jetzt = new Date()): Promise<{ an: string }> {
  const sichtbar = await uebergabeFinden(person, id);
  if (!sichtbar) throw new TeilenFehler('Diese Übergabe gibt es nicht (mehr).', 404);
  zurueckziehenPruefen(sichtbar, person);
  const an = await aendereUebergaben(l => {
    const i = l.findIndex(x => x.id === id);
    if (i < 0) throw new TeilenFehler('Diese Übergabe gibt es nicht (mehr).', 404);
    standPruefen(l[i], stand);
    zurueckziehenPruefen(l[i], person);
    const wer = l[i].an;
    return { liste: l.filter(x => x.id !== id), wert: wer };
  }, jetzt);
  const name = (await teamPersonen()).find(t => t.speicher === person)?.name ?? person;
  await melde({ an, art: 'postfach', titel: TITEL.zurueckgezogen(name), link: '/os/inbox', von: person });
  return { an };
}

/**
 * Ein mitgegebener Anhang einer sichtbaren Übergabe (beide Beteiligten) — Bytes aus der verschlüsselten Ablage. Wirft `TeilenFehler` (404),
 * wenn die Übergabe nicht sichtbar ist oder der Anhang nicht mitgegeben wurde.
 */
export async function uebergabeAnhang(person: string, id: string, ablage: string): Promise<{ name: string; bytes: Buffer; u: Uebergabe }> {
  if (!UEBERGABE_ABLAGE_NAME.test(ablage)) throw new TeilenFehler('anhang ist ungültig.', 400);
  const u = await uebergabeFinden(person, id);
  const a = u?.nachrichten.flatMap(n => n.anhaenge).find(x => x.ablage === ablage);
  if (!u || !a) throw new TeilenFehler('Diesen Anhang gibt es in der Übergabe nicht.', 404);
  const bytes = await bildOeffnen(UEBERGABE_ABLAGE_ORDNER, ablage);
  if (!bytes) throw new TeilenFehler('Die Datei dieses Anhangs fehlt — bitte neu übergeben lassen.', 404);
  return { name: a.name, bytes, u };
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

