// ─── ZOE sieht die Markttraktion — die eine Sicht mit den Leitplanken (28.09., Paket C7) ───
// Vorgabe 28.09. ~22:50: „ZOE soll nachher alles sehen und unterstützen können.“ Alles, was die CRM-Werkzeuge
// (lib/zoe/crm-werkzeuge.ts) und die Vorschläge (lib/zoe/crm-vorschlag.ts) lesen, geht durch DIESE Sicht — damit
// die drei Leitplanken an genau einer Stelle sitzen und kein Werkzeug sie vergessen kann:
//
//   1. Art. 18: Kontakte mit `eingeschraenkt` fehlen ganz (gezählt als „n eingeschränkte Kontakte ausgeblendet“);
//      wo ein Deal/Mandat/Event auf sie zeigt, steht „eingeschränkter Kontakt“ statt des Namens.
//   2. Private Notizen: `fuerPerson(k, person)` — die eigene private Notiz der handelnden Person bleibt, die der
//      anderen fällt weg. Ohne Person gibt es keine Sicht (Regel 5).
//   3. IBAN: Kontakte über `fuerPerson` maskiert, Firmen hier beim Laden maskiert (`zahlungMaskiert`); ausgegeben
//      wird Zahlung nur über `zahlungFuerAnzeige`.
// Fremder Text (Notizen, Mails, Dateiinhalte, Aktivitäten Dritter) steht in den Antworten nur im `fremd()`-Block
// (`crmAntwort`); davor eine eigene Kopfzeile mit Kennungen und Zahlen — nur sie geht ins ZOE-Protokoll.

import { fremd } from '@/lib/anthropic';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { ladeCrm } from '@/lib/crm/speicher';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { fuerPerson, anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { abschnittWaehlen } from '@/lib/dateien/aufgaben-regeln';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import type { CrmBestand } from '@/lib/crm/typen';

/** Quellenname im `<fremde_daten>`-Rahmen für alles aus der Markttraktion. */
export const CRM_QUELLE = 'markttraktion';
/** Quellenname für Dateiinhalte aus der CRM-Dateiablage. */
export const ABLAGE_QUELLE = 'crm-ablage';
/** Platzhalter für Personen mit eingeschränkter Verarbeitung (Art. 18) — nie ihr Name. */
export const EINGESCHRAENKT_NAME = 'eingeschränkter Kontakt';
export const NICHT_IM_HINTERGRUND = 'Nicht ausgeführt: Die Markttraktion liest ZOE nur im Gespräch mit einer Person im Haushalt des Inhabers — nicht im Hintergrund und nicht für andere Konten.';

export interface CrmSicht {
  person: string;
  /** Haushalt der Person (für die Dateiablage) — null, wenn keiner gesetzt ist. */
  haushalt: string | null;
  heute: string;
  /** Nur Kontakte OHNE Einschränkung, in der Sicht der Person (fremde private Notiz weg, IBAN maskiert). */
  kontakte: Kontakt[];
  /** Kennungen der ausgeblendeten (eingeschränkten) Kontakte — nur zum Erkennen, nie zum Zeigen. */
  eingeschraenkt: ReadonlySet<string>;
  crm: CrmBestand;
  kontakt: (id: string | undefined) => Kontakt | undefined;
  /** Anzeigename einer Kennung: Name, „eingeschränkter Kontakt“ oder die Kennung selbst. */
  name: (id: string | undefined) => string;
}

/** Firmen mit maskierter IBAN — die volle IBAN verlässt den Speicher nie Richtung ZOE. */
function crmMaskiert(b: CrmBestand): CrmBestand {
  return { ...b, firmen: b.firmen.map(f => (f.zahlung?.iban ? { ...f, zahlung: zahlungMaskiert(f.zahlung) } : f)) };
}

/** Rein (getestet): aus Rohdaten die Sicht einer Person bauen. */
export function sichtAus(person: string, roh: Kontakt[], crm: CrmBestand, heute: string, haushalt: string | null = null): CrmSicht {
  const eingeschraenkt = new Set(roh.filter(k => k.eingeschraenkt).map(k => k.id));
  const kontakte = roh.filter(k => !k.eingeschraenkt).map(k => fuerPerson(k, person));
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  return {
    person, haushalt, heute, kontakte, eingeschraenkt, crm: crmMaskiert(crm),
    kontakt: id => (id ? nachId.get(id) : undefined),
    name: id => {
      if (!id) return '—';
      if (eingeschraenkt.has(id)) return EINGESCHRAENKT_NAME;
      const k = nachId.get(id);
      return k ? anzeigename(k) : id;
    },
  };
}

/**
 * Die ROHE Kartei — einzig erlaubter direkter Kartei-Leser in lib/zoe (Wächtertest, 29.09. #92). Nur für PRÜFUNGEN
 * (Stände beim Vorschlagen, Art. 18/Werbesperre beim Freigeben, „verknüpft — gesperrt“ in der Kurzinfo) — nie als
 * Inhalt an das Modell; dafür gibt es `crmSicht`.
 */
export async function karteiFuerPruefung(): Promise<Kontakt[]> {
  return (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
}

/** Die Sicht für eine Person im Haushalt des Inhabers — sonst null (Hintergrund, fremdes Konto). */
export async function crmSicht(person: string | undefined): Promise<CrmSicht | null> {
  if (!person || !(await personImHaushaltDesInhabers(person))) return null;
  const [roh, crm, h] = await Promise.all([
    loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm(), haushaltFuer(person),
  ]);
  return sichtAus(person, roh?.kontakte ?? [], crm, localDay(), h?.haushalt ?? null);
}

/** „2 eingeschränkte Kontakte ausgeblendet (Art. 18)“ — oder nichts. */
export function ausgeblendetText(n: number): string {
  return n ? ` · ${n} eingeschränkte${n === 1 ? 'r Kontakt' : ' Kontakte'} ausgeblendet (Art. 18)` : '';
}

/**
 * Antwort eines lesenden Werkzeugs: Kopfzeile (eigene Worte — Kennungen, Zahlen) + gekapselter Körper.
 * Über `ZOE_ZEICHEN` (30.000) hinaus: Hinweis mit Teil x von y und wie es weitergeht — nie still gekürzt.
 */
export function crmAntwort(kopf: string, koerper: string, teil: unknown, weiter: (t: number) => string, quelle = CRM_QUELLE): string {
  const a = abschnittWaehlen(koerper, Number(teil ?? 1) || 1);
  const mehr = a.teile > 1
    ? ` · Teil ${a.teil} von ${a.teile} (Zeichen ${a.von + 1}–${a.bis} von ${a.gesamt})${a.teil < a.teile ? ` — für mehr: ${weiter(a.teil + 1)}` : ''}`
    : '';
  return `${kopf}${mehr}\n${fremd(quelle, a.text)}`;
}

/** Kennung genau, sonst eindeutiger Name (normalisiert) — für Werkzeug-Eingaben „Name oder Kennung“. */
export function eindeutig<T extends { id: string }>(liste: readonly T[], suche: string, texte: (x: T) => readonly (string | undefined)[], passt: (felder: readonly (string | undefined)[], frage: string) => boolean): T | T[] | null {
  const s = suche.trim();
  if (!s) return null;
  const genau = liste.find(x => x.id === s);
  if (genau) return genau;
  const treffer = liste.filter(x => passt(texte(x), s));
  if (treffer.length === 1) return treffer[0];
  return treffer.length ? treffer.slice(0, 8) : null;
}
