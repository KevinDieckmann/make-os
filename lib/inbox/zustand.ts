// ─── Inbox 2 — was MAKE OS sich je Person merkt (Server, 06.10.2026) ──────────────────────────────────────────────
// Bestand `inbox-zustand--<person>` (verschlüsselte Hülle). Gelesen/Erledigt leben im POSTFACH (zurückgeschrieben); hier steht nur, was
// es dort nicht gibt:
//   gespraeche[id].spaeter    Wiedervorlage `{ bis, seit }` (eine neue Nachricht nach `seit` holt das Gespräch zurück)
//   gespraeche[id].erledigt   „erledigt bis Nachricht X“ — für „Warten auf“ (da gibt es im Postfach nichts zu archivieren)
//   gespraeche[id].zuordnung  „Zuordnen“ bestätigt → das Gespräch steht im Verlauf der Kontaktakte (lib/inbox/verlauf.ts)
//   absender[adresse]         Screener: `zugelassen` | `geblockt` — je PERSON, gilt für alle ihre Postfächer
// Übernahme aus dem alten Bau (einmal, beim ersten Schreiben der Person; Lesen schreibt nie):
//   · `inbox-status` (eine Karte für alle): nur Gmail-Wiedervorlagen (`gmail-<Nachricht>` mit `snoozed` + `bis` ≥ heute), deren
//     Nachricht im EIGENEN Gmail-Spiegel steht → `spaeter` am Gespräch. Gmail-„erledigt“ lebte schon immer in Gmail (Archiv).
//     Apple-Mail-/M365-Einträge werden verworfen: ihre Kennungen hingen an der Position im Postfach und trafen falsche Mails.
//   · `inbox-absender` (Haushalt): nur für den Inhaber (die Postfächer des alten Baus waren seine) → `absender`.
// Die alten Bestände bleiben liegen (Rückweg), werden aber nicht mehr geschrieben.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { ladeGmailStand } from '@/lib/gmail/stand';
import { adresseGueltig, adresseKlein } from '@/lib/gmail/mime';
import type { GespraechZustand } from './strom';

export interface InboxZustand {
  v: 1;
  gespraeche: Record<string, GespraechZustand>;
  absender: Record<string, { status: 'zugelassen' | 'geblockt'; seit: string }>;
  /** Übernahme aus dem alten Bau erledigt (Zeitpunkt). */
  uebernommen?: string;
}

export const zustandName = (person: string) => `inbox-zustand--${person}`;
const PERSON_OK = /^[a-z0-9-]{1,40}$/;
export const ZUSTAND_GRENZEN = { gespraeche: 5000, absender: 5000 } as const;

const leer = (): InboxZustand => ({ v: 1, gespraeche: {}, absender: {} });

/** Übernahme-Regel (rein, getestet): alter Status + alte Absender → neuer Zustand. */
export function uebernahme(o: {
  alterStatus: Record<string, { status?: string; bis?: string }> | null;
  alteAbsender: Record<string, { status?: string; seit?: string }> | null;
  /** Gmail-Nachricht → Thread, aus dem EIGENEN Spiegel. */
  gmailThreads: Record<string, string>;
  inhaber: boolean;
  heute: string;
  jetzt: string;
}): InboxZustand {
  const z = leer();
  for (const [k, s] of Object.entries(o.alterStatus ?? {})) {
    const m = /^gmail-([A-Za-z0-9]{1,40})$/.exec(k);
    const thread = m ? o.gmailThreads[m[1]] ?? (Object.values(o.gmailThreads).includes(m[1]) ? m[1] : undefined) : undefined;
    if (!thread || s?.status !== 'snoozed' || !s.bis || !/^\d{4}-\d{2}-\d{2}$/.test(s.bis) || s.bis < o.heute) continue;
    z.gespraeche[`gm~${thread}`] = { spaeter: { bis: s.bis, seit: o.jetzt } };
  }
  if (o.inhaber) for (const [a, s] of Object.entries(o.alteAbsender ?? {})) {
    const adr = adresseKlein(a);
    if (!adresseGueltig(adr)) continue;
    z.absender[adr] = { status: s?.status === 'geblockt' ? 'geblockt' : 'zugelassen', seit: /^\d{4}-\d{2}-\d{2}/.test(String(s?.seit ?? '')) ? String(s!.seit).slice(0, 10) : o.heute };
  }
  return { ...z, uebernommen: o.jetzt };
}

async function uebernahmeFuer(person: string): Promise<InboxZustand> {
  const [alt, absender, gmail, inhaber] = await Promise.all([
    loadJson<Record<string, { status?: string; bis?: string }>>('inbox-status').catch(() => null),
    loadJson<{ bekannt?: Record<string, { status?: string; seit?: string }> }>('inbox-absender').catch(() => null),
    ladeGmailStand(person).catch(() => null),
    istInhaber(person),
  ]);
  const threads: Record<string, string> = {};
  for (const k of Object.values(gmail?.koepfe ?? {})) threads[k.id] = k.threadId;
  return uebernahme({ alterStatus: alt, alteAbsender: absender?.bekannt ?? null, gmailThreads: threads, inhaber, heute: localDay(), jetzt: new Date().toISOString() });
}

/** Zustand lesen — ohne Bestand die (nicht gespeicherte) Übernahme aus dem alten Bau. Schreibt nie. */
export async function ladeInboxZustand(person: string): Promise<InboxZustand> {
  if (!PERSON_OK.test(person)) return leer();
  const z = await loadJson<InboxZustand>(zustandName(person));
  if (z && z.v === 1) return { v: 1, gespraeche: z.gespraeche ?? {}, absender: z.absender ?? {}, ...(z.uebernommen ? { uebernommen: z.uebernommen } : {}) };
  return uebernahmeFuer(person);
}

export class ZustandFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Zustand ändern (serialisiert). Beim ersten Schreiben wird die Übernahme mitgespeichert. Grenzen → 413, nie still kürzen. */
export async function aendereInboxZustand(person: string, mutate: (z: InboxZustand) => InboxZustand): Promise<InboxZustand> {
  if (!PERSON_OK.test(person)) throw new ZustandFehler('Keine Person.', 403);
  const vorhanden = await loadJson<InboxZustand>(zustandName(person));
  const start = vorhanden && vorhanden.v === 1 ? null : await uebernahmeFuer(person);
  let ergebnis = leer();
  let fehler: ZustandFehler | null = null;
  await updateJson<InboxZustand>(zustandName(person), cur => {
    const basis = cur && cur.v === 1 ? { v: 1 as const, gespraeche: cur.gespraeche ?? {}, absender: cur.absender ?? {}, ...(cur.uebernommen ? { uebernommen: cur.uebernommen } : {}) } : (start ?? leer());
    const neu = mutate(basis);
    if (Object.keys(neu.gespraeche).length > ZUSTAND_GRENZEN.gespraeche || Object.keys(neu.absender).length > ZUSTAND_GRENZEN.absender) { fehler = new ZustandFehler('Zu viele gemerkte Einträge — bitte alte Wiedervorlagen erledigen.', 413); return basis; }
    ergebnis = neu;
    return neu;
  });
  const f = fehler as ZustandFehler | null;
  if (f) throw f;
  return ergebnis;
}

/** Ein Gespräch ändern (Feld setzen bzw. mit `null` entfernen); leere Einträge fallen weg. */
export async function gespraechSetzen(person: string, id: string, teil: { [K in keyof GespraechZustand]?: GespraechZustand[K] | null }): Promise<InboxZustand> {
  return aendereInboxZustand(person, z => {
    const alt = { ...(z.gespraeche[id] ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(teil)) { if (v === null) delete alt[k]; else if (v !== undefined) alt[k] = v; }
    const gespraeche = { ...z.gespraeche };
    if (Object.keys(alt).length) gespraeche[id] = alt as GespraechZustand; else delete gespraeche[id];
    return { ...z, gespraeche };
  });
}

/** Screener-Entscheidung (oder `null` = wieder offen). */
export async function absenderSetzen(person: string, adresse: string, status: 'zugelassen' | 'geblockt' | null): Promise<InboxZustand> {
  const a = adresseKlein(adresse);
  if (!adresseGueltig(a)) throw new ZustandFehler('Keine gültige Adresse.');
  return aendereInboxZustand(person, z => {
    const absender = { ...z.absender };
    if (status) absender[a] = { status, seit: localDay() }; else delete absender[a];
    return { ...z, absender };
  });
}

/** Einträge eines Postfachs entfernen (Trennen). */
export async function zustandOhnePostfach(person: string, praefix: string): Promise<void> {
  const z = await loadJson<InboxZustand>(zustandName(person));
  if (!z || z.v !== 1 || !Object.keys(z.gespraeche ?? {}).some(k => k.startsWith(praefix))) return;
  await aendereInboxZustand(person, cur => ({ ...cur, gespraeche: Object.fromEntries(Object.entries(cur.gespraeche).filter(([k]) => !k.startsWith(praefix))) }));
}
