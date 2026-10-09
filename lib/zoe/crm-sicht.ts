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

// ── Bereich erkennen (09.10. spät, lib/zoe/bereich.ts) — nur Kennung, Name zum Vergleichen und Bereich, nie Inhalte ─────────────────
// Die Regel „Privat oder Business“ eines Vorschlags braucht die Namen der Markttraktion (b) und den Bereich eines CRM-Bezugs (a). Gelesen
// wird hier — an der EINEN Stelle, an der ZOE die Kartei liest —, mit denselben Leitplanken: eingeschränkte Kontakte (Art. 18) fehlen ganz.
// Was hier herausgeht, landet nie im Prompt: lib/zoe/bereich-server.ts vergleicht nur und speichert nur Kennungen am Vorschlag.

type BereichOrtKurz = { id: string; name: string };
type BereichKurz = { bereich: 'privat' | 'business'; ort?: BereichOrtKurz };

/**
 * Bereich einer CRM-Firma (rein): Business — außer ALLE ihre laufenden Deals/Mandate liegen bei einer Privat-Einheit (`bereichVonGesellschaft`,
 * lib/einheiten.ts). Mit aktivem Mandat (Business) ist der Ort ihr Mandanten-Space.
 */
export function firmaBereichAus(crm: Pick<CrmBestand, 'firmen' | 'mandate' | 'chancen'>, firmaId: string | undefined, gesellschaftBereich: (g: string) => 'privat' | 'business'): BereichKurz {
  if (!firmaId) return { bereich: 'business' };
  const mandate = crm.mandate.filter(m => m.firmaId === firmaId && m.status !== 'beendet');
  const deals = crm.chancen.filter(c => c.firmaId === firmaId);
  const ges = [...mandate.map(m => m.gesellschaft), ...deals.map(c => c.gesellschaft)];
  if (ges.length && ges.every(g => gesellschaftBereich(g) === 'privat')) return { bereich: 'privat' };
  const f = crm.firmen.find(x => x.id === firmaId);
  return { bereich: 'business', ...(f && mandate.some(m => m.status === 'aktiv') ? { ort: { id: `m-${firmaId}`, name: f.name } } : {}) };
}

/** Namen der Markttraktion zum ERKENNEN (Firmen, Kontakte ohne Art.-18-Personen) — mit ihrem Bereich. Nie an das Modell. */
export async function crmBekannteNamen(): Promise<{ firmen: ({ id: string; name: string } & BereichKurz)[]; kontakte: ({ id: string; name: string } & BereichKurz)[] }> {
  const { bereichVonGesellschaft } = await import('@/lib/einheiten');
  const [roh, crm] = await Promise.all([loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm()]);
  const firmen = crm.firmen.map(f => ({ id: f.id, name: f.name, ...firmaBereichAus(crm, f.id, bereichVonGesellschaft) }));
  const nachFirma = new Map(firmen.map(f => [f.id, f]));
  const kontakte = (roh?.kontakte ?? []).filter(k => !k.eingeschraenkt).map(k => {
    const f = k.firmaId ? nachFirma.get(k.firmaId) : undefined;
    const bereich: 'privat' | 'business' = f?.bereich ?? 'business';
    return { id: k.id, name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim(), bereich, ...(f?.ort ? { ort: f.ort } : {}) };
  });
  return { firmen, kontakte };
}

/**
 * Bereich eines Vorschlags der Stapel-Art „crm“ aus seiner Bezugs-Kennung (`kontakt:c-…`, `firma:f-…`, `deal:…`, `mandat:…`, `angebot:…`,
 * sonst Markttraktion allgemein): Business, außer der Eintrag gehört einer Privat-Einheit. Eingeschränkte Kontakte nennen nichts.
 */
export async function crmBezugBereich(bezugId: string): Promise<BereichKurz & { nennt?: { art: 'firma' | 'kontakt'; id: string }[] }> {
  const { bereichVonGesellschaft } = await import('@/lib/einheiten');
  const i = bezugId.indexOf(':');
  const art = i > 0 ? bezugId.slice(0, i) : bezugId;
  const id = i > 0 ? bezugId.slice(i + 1) : '';
  if (!id || !['kontakt', 'firma', 'deal', 'mandat', 'angebot'].includes(art)) return { bereich: 'business' };
  const crm = await ladeCrm();
  const nachGesellschaft = (g: string | undefined): BereichKurz => ({ bereich: bereichVonGesellschaft(g) });
  if (art === 'deal') return nachGesellschaft(crm.chancen.find(x => x.id === id)?.gesellschaft);
  if (art === 'mandat') return nachGesellschaft(crm.mandate.find(x => x.id === id)?.gesellschaft);
  if (art === 'angebot') return nachGesellschaft((crm.angebote ?? []).find(x => x.id === id)?.gesellschaft);
  if (art === 'firma') return { ...firmaBereichAus(crm, id, bereichVonGesellschaft), nennt: [{ art: 'firma', id }] };
  const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === id);
  if (!k || k.eingeschraenkt) return { bereich: 'business' };
  return { ...firmaBereichAus(crm, k.firmaId, bereichVonGesellschaft), nennt: [{ art: 'kontakt', id }] };
}
