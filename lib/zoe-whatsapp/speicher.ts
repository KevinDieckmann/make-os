// ─── ZOE auf WhatsApp — Bestände (Server, 08.10.2026) ────────────────────────────────────────────────────────────────────
//   `zoe-kanal--<person>`   der Kanal JE PERSON (lib/zoe-whatsapp/kanal.ts `ZoeKanal`): Nummer (nur solange verbunden), Einwilligung
//                           (Nachweis, nur anhängend), Fenster, Ausstehendes, kurzlebiger Eingang, Verweise auf Vorschläge,
//                           Sprachnachrichten (Metadaten — die Dateien liegen verschlüsselt in `<daten>/zoe-whatsapp-medien`).
//                           Speicher-Register mit Angaben; Konto-Export und Konto löschen (PERSON_BESTAENDE).
//   `zoe-whatsapp-zustand`  Zustand der ZOE-Nummer (je Instanz): Webhook-Zähler, Nachrichten fremder Nummern (NUR die Zahl), Schlüssel-
//                           Zustand, Vorlagen- und Telefon-Cache, „nicht zugestellt“-Zeitpunkte — keine Personendaten.
// Fremde Nummern: nichts gespeichert außer dem Zähler (kein WAMID, keine Nummer, kein Text).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { alleSpeicher } from '@/lib/zugang/konten';
import type { Vorlage } from '@/lib/whatsapp/typen';
import { KANAL_GRENZEN, leererKanal, type ZoeKanal } from './kanal';

export const ZOE_WA_ZUSTAND = 'zoe-whatsapp-zustand';
/** Name des Bestands je Person — IMMER mit Suffix (auch beim Erstkonto). */
export const kanalName = (person: string) => `zoe-kanal--${person}`;

const PERSON = /^[a-z0-9-]{1,40}$/;

export interface ZoeWaZustand {
  v: 1;
  webhook?: { zuletzt?: string; anzahl: number; abgelehnt: number; zuletztAbgelehnt?: string };
  /** Nachrichten von Nummern, die keiner Person gehören — nur gezählt. */
  fremd?: { anzahl: number; zuletzt?: string };
  /** Nachrichten verbundener Personen, die nicht angenommen wurden (Eingang voll) bzw. nach drei Versuchen aufgegeben. */
  verworfen?: number;
  token?: { fehlerAt?: string; gemeldet?: boolean; okAt?: string };
  vorlagen?: { at: string; liste: Vorlage[] };
  telefon?: { at: string; nummer?: string; anzeigename?: string; qualitaet?: string };
  /** Zeitpunkte gesendeter Nachrichten, die Meta als „nicht zugestellt“ meldete (letzte 7 Tage). */
  fehlgeschlagen?: string[];
  /** Registrierung der ZOE-Nummer aus MAKE OS (nur Zeitpunkt + Speicherort — nie die PIN). */
  registriert?: { am: string; speicherort: 'DE' | 'ohne' };
}

/** Einen gelesenen Kanal säubern (rein): Form prüfen, Abgelaufenes bleibt — es wird nur beim Schreiben aufgeräumt. */
export function kanalAus(roh: unknown): ZoeKanal {
  const k = roh as Partial<ZoeKanal> | null;
  if (!k || k.v !== 1 || typeof k.status !== 'string') return leererKanal();
  return { ...k, v: 1, status: k.status, ereignisse: Array.isArray(k.ereignisse) ? k.ereignisse : [] } as ZoeKanal;
}

/** Aufräumen beim Schreiben (rein): Idempotenz-Fenster, abgelaufene Codes, alte Verweise. Nie die Ereignisse. */
export function kanalAufraeumen(k: ZoeKanal, jetzt: number): ZoeKanal {
  const tag = 86_400_000;
  const gesehen = Object.fromEntries(Object.entries(k.gesehen ?? {}).filter(([, am]) => jetzt - Date.parse(am) < KANAL_GRENZEN.gesehenTage * tag));
  const vorschlaege = Object.fromEntries(Object.entries(k.vorschlaege ?? {}).filter(([, v]) => jetzt - Date.parse(v.am) < KANAL_GRENZEN.vorschlagTage * tag));
  const raus: ZoeKanal = { ...k, gesehen, vorschlaege };
  if (k.status === 'wartet' && k.code && Date.parse(k.code.bis) <= jetzt) { const { code: _c, nummer: _n, ...rest } = raus; return { ...rest, status: 'aus' }; }
  return raus;
}

export async function ladeKanal(person: string): Promise<ZoeKanal> {
  if (!PERSON.test(person)) return leererKanal();
  return kanalAus(await loadJson<unknown>(kanalName(person)));
}

/** In der Sperre ändern. `mutate` liefert null = nichts schreiben. Gibt den Stand danach zurück. */
export async function aendereKanal(person: string, mutate: (k: ZoeKanal) => ZoeKanal | null, jetzt = Date.now()): Promise<ZoeKanal> {
  if (!PERSON.test(person)) throw new Error('Unzulässige Person.');
  let ergebnis = leererKanal();
  await updateJson<ZoeKanal>(kanalName(person), cur => {
    const k = kanalAus(cur);
    const neu = mutate(k);
    ergebnis = neu ? kanalAufraeumen(neu, jetzt) : k;
    // Nichts zu tun: der alte Stand bleibt (ohne Bestand ein leerer Kanal — nie „null“ auf die Platte).
    return neu ? ergebnis : ((cur as ZoeKanal | null) ?? k);
  });
  return ergebnis;
}

/** Alle Personen (Konten) mit ihrem Kanal — nur die mit Bestand. Wenige Konten je Instanz. */
export async function alleKanaele(): Promise<{ person: string; kanal: ZoeKanal }[]> {
  const raus: { person: string; kanal: ZoeKanal }[] = [];
  for (const p of await alleSpeicher().catch(() => [] as string[])) {
    if (!PERSON.test(p)) continue;
    const roh = await loadJson<unknown>(kanalName(p)).catch(() => null);
    if (roh) raus.push({ person: p, kanal: kanalAus(roh) });
  }
  return raus;
}

/** Wem gehört diese Nummer (verbunden oder wartend auf den Code)? Eine Nummer gehört höchstens einer Person (Verbinden prüft das). */
export async function personFuerNummer(nummer: string, jetzt = Date.now()): Promise<{ person: string; kanal: ZoeKanal } | null> {
  for (const x of await alleKanaele()) {
    const k = x.kanal;
    if (k.nummer !== nummer) continue;
    if (k.status === 'verbunden') return x;
    if (k.status === 'wartet' && k.code && Date.parse(k.code.bis) > jetzt) return x;
  }
  return null;
}

export async function ladeZoeZustand(): Promise<ZoeWaZustand> {
  const z = await loadJson<ZoeWaZustand>(ZOE_WA_ZUSTAND);
  return z && z.v === 1 ? z : { v: 1 };
}

export async function aendereZoeZustand(mutate: (z: ZoeWaZustand) => ZoeWaZustand): Promise<ZoeWaZustand> {
  let ergebnis: ZoeWaZustand = { v: 1 };
  await updateJson<ZoeWaZustand>(ZOE_WA_ZUSTAND, cur => { ergebnis = mutate(cur && cur.v === 1 ? cur : { v: 1 }); return ergebnis; });
  return ergebnis;
}
