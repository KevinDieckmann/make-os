// ─── Inbox teilen — „In der Inbox suchen“ (Server, 08.10.2026, Lücke 6) ─────────────────────────────────────────────
// Gesucht wird NUR in dem, was die Person ohnehin sieht: ihre eigenen Spiegel (Gmail, IMAP), Team-Postfächer, die sie sehen darf
// (`postfachSichtbar`), die WhatsApp-Business-Nummer (nur mit Zugang) und Übergaben an bzw. von ihr (`uebergabeSichtbar`) — alles
// über den Strom der Person (`stromRoh`) bzw. `uebergabenFuer`, dazu derselbe Bereichsfilter `imBereich`. Es gibt keinen Parameter
// für eine andere Person. Geblockte Absender bleiben draußen.
// Treffer: Betreff, Absender, Empfänger, Text — EINE Such-Regel (`nachrichtTreffer` → lib/text/such-norm.ts). Ergebnis: Gespräche
// (jüngster Treffer zuerst) mit Ort + Ausschnitt; höchstens `SUCHE_GRENZEN.seite` je Seite, dazu `gesamt` — nie still gekürzt
// („mehr …“ lädt die nächste Seite über `ab`). Der Suchbegriff geht NIE in ein Protokoll (die Route notiert nur Bereich + Anzahl).

import { localDay } from '@/lib/zeit';
import { ladeGmailStand, ladeGmailTexte } from '@/lib/gmail/stand';
import { ladeImapStand, ladeImapTexte, type ImapStand, type ImapTexte } from '@/lib/postfach/spiegel';
import type { Adr, GmailKopf } from '@/lib/gmail/typen';
import { imBereich, stromRoh, type StromFilter } from './strom-server';
import { uebergabenFuer } from './uebergaben-speicher';
import { nachrichtTreffer, SUCHE_GRENZEN, type TrefferOrt } from './teilen';
import type { GespraechQuelle, StromKopf } from './strom';

export interface SuchTreffer {
  /** `gespraech`: öffnet das Gespräch; `uebergabe`: öffnet die Kopie. */
  art: 'gespraech' | 'uebergabe';
  id: string;
  quelle: GespraechQuelle;
  bereich: string | null;
  betreff: string;
  /** Name der Gegenseite (Akte, sonst Absendername, sonst Adresse). */
  name: string;
  gegenueber: Adr;
  /** Zeit des jüngsten Treffers. */
  am: string;
  wo: TrefferOrt;
  ausschnitt: string;
  /** In wie vielen Nachrichten des Gesprächs. */
  anzahl: number;
  /** Team-Postfach bzw. Übergabe: von wem (Vorname). */
  von?: string;
}

export interface SuchErgebnis { treffer: SuchTreffer[]; gesamt: number; ab: number; seite: number }

interface Nachricht { am: string; betreff: string; von: Adr; an: Adr[]; cc: Adr[]; text: string }

/** Treffer eines Gesprächs aus seinen Nachrichten (rein). */
function trefferAus(nachrichten: readonly Nachricht[], frage: string): { am: string; wo: TrefferOrt; ausschnitt: string; anzahl: number } | null {
  let best: { am: string; wo: TrefferOrt; ausschnitt: string } | null = null;
  let anzahl = 0;
  for (const n of nachrichten) {
    const t = nachrichtTreffer(n, frage);
    if (!t) continue;
    anzahl++;
    if (!best || n.am > best.am) best = { am: n.am, ...t };
  }
  return best ? { ...best, anzahl } : null;
}

export async function inboxSuchen(person: string, frage: string, f: StromFilter = {}, ab = 0): Promise<SuchErgebnis> {
  const r = await stromRoh(person, localDay());
  const sicht = new Map(r.postfaecher.filter(p => imBereich(p.bereich, f)).map(p => [p.id, p]));
  const gespraeche = r.gespraeche.filter(g => sicht.has(g.postfachId) && g.fach !== 'geblockt');
  // Köpfe + Texte nur aus den Spiegeln, die im Strom der Person stehen (eigene bzw. die Besitzer sichtbarer Team-Postfächer).
  const gmail = gespraeche.some(g => g.quelle === 'gmail') ? await Promise.all([ladeGmailStand(person), ladeGmailTexte(person)]) : null;
  const imap = new Map<string, [ImapStand, ImapTexte]>();
  for (const g of gespraeche.filter(x => x.quelle === 'imap')) {
    const b = sicht.get(g.postfachId)!.besitzer;
    if (!imap.has(b)) imap.set(b, await Promise.all([ladeImapStand(b), ladeImapTexte(b)]));
  }
  const alsNachricht = (k: GmailKopf | StromKopf, text: string): Nachricht => ({ am: k.am, betreff: k.betreff, von: k.von, an: k.an, cc: k.cc, text });
  const treffer: SuchTreffer[] = [];
  for (const g of gespraeche) {
    let n: Nachricht[] = [];
    if (g.quelle === 'gmail' && gmail?.[0]) n = g.nachrichten.map(id => gmail[0]!.koepfe[id]).filter(Boolean).map(k => alsNachricht(k, gmail[1].texte[k.id]?.t ?? k.ausschnitt));
    else if (g.quelle === 'imap') {
      const [st, tx] = imap.get(sicht.get(g.postfachId)!.besitzer)!;
      n = g.nachrichten.map(id => st.koepfe[id]).filter(Boolean).map(k => alsNachricht(k, tx.texte[k.id]?.t ?? k.ausschnitt));
    } else if (g.quelle === 'whatsapp' && g.whatsapp) {
      const { whatsappNachrichtenVon } = await import('@/lib/whatsapp/strom');
      n = ((await whatsappNachrichtenVon(person, g.postfachId, g.whatsapp.nummer))?.koepfe ?? []).map(k => alsNachricht(k, k.ausschnitt));
    }
    const t = trefferAus(n, frage);
    if (!t) continue;
    treffer.push({
      art: 'gespraech', id: g.id, quelle: g.quelle, bereich: g.bereich, betreff: g.betreff, gegenueber: g.gegenueber,
      name: g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email, ...t,
      ...(g.team?.postfach && !g.team.postfach.eigenes ? { von: g.team.postfach.besitzerName } : {}),
    });
  }
  const namen = Object.fromEntries(r.team.map(t => [t.speicher, t.name]));
  for (const u of await uebergabenFuer(person, r.team)) {
    if (!imBereich(u.bereich, f)) continue;
    const t = trefferAus(u.nachrichten, frage);
    if (!t) continue;
    treffer.push({
      art: 'uebergabe', id: u.id, quelle: u.quelle, bereich: u.bereich, betreff: u.betreff, gegenueber: u.gegenueber,
      name: u.gegenueber.name ?? u.gegenueber.email, ...t, von: namen[u.von === person ? u.an : u.von] ?? '',
    });
  }
  treffer.sort((a, b) => b.am.localeCompare(a.am) || a.id.localeCompare(b.id));
  const start = Math.max(0, Math.min(ab, treffer.length));
  return { treffer: treffer.slice(start, start + SUCHE_GRENZEN.seite), gesamt: treffer.length, ab: start, seite: SUCHE_GRENZEN.seite };
}
