// ─── MAKE OS — Die Auftrags-Warteschlange ───────────────────────────────────
// Baustein 3 (07.09.). Bedingung vom 06.09.: „dass ZOE alle Agents
// mindestens gleichzeitig laufen lassen kann wenn die CPU es hergibt oder auch
// mehrmals nebeneinander, dass es schneller geht."
//
// Vorher steckte jede Ausführung in dem einen HTTP-Aufruf, auf den die Person
// wartete: drei Runden, vier Agentenläufe, 180 Sekunden — und wenn einer hing,
// kippte alles. Jetzt legt ZOE Aufträge ab und ein eigener Arbeiter holt
// sie sich, so viele nebeneinander wie die Maschine trägt.
//
// Drei Dinge machen das verlässlich:
//   • Der Idempotenz-Schlüssel — dieselbe Wirkung zweimal einzureihen ergibt
//     einen Auftrag, nicht zwei. Sonst stünde nach einem Wiederholungslauf die
//     Rechnung doppelt im Buch.
//   • Die Pacht — wer einen Auftrag nimmt, hält ihn befristet. Stirbt der
//     Arbeiter mitten im Lauf, fällt der Auftrag von selbst zurück.
//   • Der Versuchszähler — was dreimal scheitert, bleibt liegen, statt ewig
//     zu kreisen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay, tagePlus } from '@/lib/zeit';
import type { Person } from './raum';
import { neueKennung } from '@/lib/kennung';

export type AuftragStatus = 'offen' | 'laeuft' | 'fertig' | 'fehler';
export type AuftragArt = 'werkzeug' | 'agent';

export interface Auftrag {
  id: string;
  zeit: string;
  tag: string;
  art: AuftragArt;
  /** Werkzeugname oder Agenten-Id. */
  name: string;
  eingabe: Record<string, unknown>;
  /** Bei Agenten: der Auftragstext. */
  auftrag?: string;
  schluessel: string;
  status: AuftragStatus;
  versuche: number;
  pachtBis?: string;
  /**
   * Pacht-Token (29.09., Paket D-A #20): je Übernahme neu. Nur wer den passenden Token hat, darf den Auftrag
   * ausführen und das Ergebnis melden — läuft ein Lauf länger als die Pacht und der Auftrag wird neu vergeben,
   * wirkt der alte Läufer nicht mehr (kein doppeltes Ergebnis, kein Überschreiben).
   */
  pachtToken?: string;
  /**
   * Nicht vor diesem Zeitpunkt wieder übernehmen (09.10., Takt robust): nach einem Fehlschlag, der noch einmal darf, wartet der Auftrag
   * 5 · 3^(n−1) Minuten (dieselbe Regel wie `wartenNachFehler` im Takt) — vorher stand er sofort wieder „offen“, und der Arbeiter nahm ihn
   * 1,2 s später erneut (bei einer Zeitüberschreitung arbeitete der erste Lauf auf dem Server noch: doppelt).
   */
  nichtVor?: string;
  begonnen?: string;
  beendet?: string;
  ergebnis?: string;
  fehler?: string;
  /** Der Satz der Person, aus dem der Auftrag entstand. */
  anlass?: string;
  /**
   * Für wen der Auftrag läuft. Wichtig, weil der Arbeiter ihn später ausführt:
   * ohne das liefe alles unter einer Dienst-Identität, und der Hintergrund
   * würde preisgeben, was die Oberfläche korrekt verbirgt.
   */
  person?: Person;
}

interface Stand {
  auftraege: Auftrag[];
  /** Abgelehnte Aufträge, weil die Warteschlange voll war (09.10., Takt robust) — je Berliner Tag, nur Zähler (Lagebild Head of IT). */
  abgelehnt?: { tag: string; anzahl: number };
}

/**
 * Aufräumen statt Abschneiden (09.10., Takt robust — CLAUDE.md „Nie abschneiden, ablehnen“). Vorher kürzte `reihe` die Liste stumm auf
 * 400 Einträge; an einem vollen Tag fielen damit HEUTIGE Einträge heraus, die der Takt als Riegel liest (Morgen-/Abendlauf, Selbstbild,
 * Fehlerpause, Tageshöchstzahl der Agenten) — die Läufe kamen doppelt, die Pause nach Fehlschlägen war weg.
 * Jetzt: offene/laufende und Einträge von heute und gestern (Berliner Tag) bleiben IMMER; ältere erledigte bleiben `ERLEDIGT_TAGE` Tage,
 * davon höchstens die `GRENZE` jüngsten. Wächst die Liste über `HARTE_GRENZE`, werden NEUE Aufträge abgelehnt (gezählt, Lagebild
 * rot) — nie ein vorhandener weggeschnitten.
 */
export const GRENZE = 400;
export const ERLEDIGT_TAGE = 7;
export const HARTE_GRENZE = 2000;
const MAX_VERSUCHE = 3;
/** Läuft ein Auftrag länger, hält der Herzschlag seine Pacht nicht mehr — er fällt zurück (Arbeiter tot oder Lauf hängt). */
export const LAUF_MAX_MS = 15 * 60_000;

const erledigt = (a: Pick<Auftrag, 'status'>) => a.status === 'fertig' || a.status === 'fehler';

/**
 * Was bleibt (rein, getestet): offen/laufend und alles von heute/gestern immer; ältere erledigte nur `ERLEDIGT_TAGE` Tage und davon die
 * `GRENZE` jüngsten. Die Reihenfolge der Liste bleibt.
 */
export function aufraeumen(liste: readonly Auftrag[], jetzt = new Date()): Auftrag[] {
  const heute = localDay(jetzt), gestern = tagePlus(heute, -1), frist = tagePlus(heute, -ERLEDIGT_TAGE);
  const geschuetzt = (a: Auftrag) => !erledigt(a) || a.tag >= gestern;
  const aeltere = liste.filter(a => !geschuetzt(a) && a.tag >= frist)
    .sort((x, y) => Date.parse(y.beendet ?? y.zeit) - Date.parse(x.beendet ?? x.zeit))
    .slice(0, GRENZE);
  const bleibt = new Set(aeltere);
  return liste.filter(a => geschuetzt(a) || bleibt.has(a));
}

/** Pause nach dem n-ten Fehlversuch eines Auftrags (Minuten) — dieselbe Regel wie `wartenNachFehler` (lib/zoe/takt.ts). */
export const pauseNachVersuch = (versuche: number): number => Math.min(5 * 3 ** (Math.max(1, versuche) - 1), 180);

/** Gleiche Wirkung, gleicher Schlüssel. Bewusst über die Eingabe gebildet und
 *  nicht über die Zeit — sonst wäre jeder Auftrag für sich einzigartig und der
 *  Schutz liefe ins Leere. */
export function schluesselFuer(art: AuftragArt, name: string, eingabe: Record<string, unknown>, auftrag?: string): string {
  const sortiert = Object.keys(eingabe).sort().map(k => `${k}=${JSON.stringify(eingabe[k])}`).join('&');
  return `${art}:${name}:${sortiert}:${(auftrag ?? '').slice(0, 120)}`;
}

export interface NeuerAuftrag {
  art: AuftragArt;
  name: string;
  eingabe?: Record<string, unknown>;
  auftrag?: string;
  anlass?: string;
  person?: Person;
}

/**
 * Mehrere auf einmal einreihen. Gibt zurück, was neu ist, was schon lief und was abgelehnt wurde, weil die Warteschlange voll ist
 * (`HARTE_GRENZE`, 09.10.) — abgelehnt wird nur NEU, nie ein vorhandener Auftrag weggeschnitten.
 */
export async function reihe(neue: NeuerAuftrag[], jetzt = new Date()): Promise<{ angelegt: Auftrag[]; schonDa: number; abgelehnt: number }> {
  const angelegt: Auftrag[] = [];
  let schonDa = 0, abgelehnt = 0;
  await updateJson<Stand>('zoe-auftraege', current => {
    angelegt.length = 0; schonDa = 0; abgelehnt = 0;
    const liste = aufraeumen(current?.auftraege ?? [], jetzt);
    const laufend = new Set(liste.filter(a => !erledigt(a)).map(a => a.schluessel));
    let platz = HARTE_GRENZE - liste.length;
    for (const n of neue) {
      const eingabe = n.eingabe ?? {};
      const schluessel = schluesselFuer(n.art, n.name, eingabe, n.auftrag);
      if (laufend.has(schluessel)) { schonDa++; continue; }
      if (platz <= 0) { abgelehnt++; continue; }
      platz--;
      laufend.add(schluessel);
      angelegt.push({
        id: neueKennung('a'),
        zeit: jetzt.toISOString(), tag: localDay(jetzt),
        art: n.art, name: n.name, eingabe,
        ...(n.auftrag ? { auftrag: n.auftrag } : {}),
        ...(n.anlass ? { anlass: n.anlass } : {}),
        ...(n.person ? { person: n.person } : {}),
        schluessel, status: 'offen', versuche: 0,
      });
    }
    const heute = localDay(jetzt);
    const vorher = current?.abgelehnt?.tag === heute ? current.abgelehnt.anzahl : 0;
    return {
      auftraege: [...angelegt, ...liste.filter(a => !erledigt(a)), ...liste.filter(erledigt)],
      ...(abgelehnt || vorher ? { abgelehnt: { tag: heute, anzahl: vorher + abgelehnt } } : {}),
    };
  });
  if (abgelehnt) console.error(`[Aufträge] Warteschlange voll (${HARTE_GRENZE}) — ${abgelehnt} neue Aufträge abgelehnt, nichts gekürzt.`);
  return { angelegt, schonDa, abgelehnt };
}

/**
 * Bis zu `anzahl` offene Aufträge übernehmen. Läuft in EINEM updateJson —
 * der Store schreibt je Datei serialisiert, damit kann kein zweiter Arbeiter
 * denselben Auftrag danebengreifen.
 */
export async function nimm(anzahl: number, pachtSekunden = 300): Promise<Auftrag[]> {
  const genommen: Auftrag[] = [];
  const jetzt = Date.now();
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const naechste = liste.map(a => {
      // Abgelaufene Pacht: der Arbeiter ist weg, der Auftrag ist wieder frei.
      if (a.status === 'laeuft' && a.pachtBis && Date.parse(a.pachtBis) < jetzt) {
        return { ...a, status: 'offen' as AuftragStatus, pachtBis: undefined, pachtToken: undefined };
      }
      return a;
    });
    for (const a of naechste) {
      if (genommen.length >= anzahl) break;
      if (a.status !== 'offen') continue;
      // Pause nach einem Fehlversuch (09.10.): erst wieder, wenn sie um ist.
      if (a.nichtVor && Date.parse(a.nichtVor) > jetzt) continue;
      if (a.versuche >= MAX_VERSUCHE) { a.status = 'fehler'; a.fehler = `Nach ${MAX_VERSUCHE} Versuchen aufgegeben.`; continue; }
      delete a.nichtVor;
      a.status = 'laeuft';
      a.versuche += 1;
      a.begonnen = new Date().toISOString();
      a.pachtBis = new Date(jetzt + pachtSekunden * 1000).toISOString();
      a.pachtToken = neueKennung('pacht');
      genommen.push({ ...a });
    }
    return { ...(current ?? {}), auftraege: naechste };
  });
  return genommen;
}

/**
 * Ergebnis eintragen.
 *
 * `endgueltig` unterscheidet zwei Arten von Fehlschlag: „gerade nicht
 * erreichbar" darf es noch einmal versuchen, „ist ausgeschaltet" nicht — das
 * ist eine Entscheidung und kein Aussetzer. Ohne die Unterscheidung hat der
 * Arbeiter einen abgeschalteten Agenten am 07.09. dreimal hintereinander
 * angestoßen.
 */
export async function melde(id: string, pachtToken: string, status: 'fertig' | 'fehler', text: string, endgueltig = false, jetzt = new Date()): Promise<boolean> {
  let angenommen = false;
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    return {
      ...(current ?? {}),
      auftraege: liste.map(a => {
        // Nur der Halter der AKTUELLEN Pacht meldet (Paket D-A #20) — ein abgelaufener Läufer ändert nichts mehr.
        if (a.id !== id || a.status !== 'laeuft' || !a.pachtToken || a.pachtToken !== pachtToken) return a;
        angenommen = true;
        // Ein Fehlschlag darf es nochmal versuchen — außer das Budget ist weg. Seit 09.10. erst nach einer Pause (`nichtVor`):
        // eine Zeitüberschreitung heißt oft, dass der Lauf auf dem Server noch arbeitet.
        const nochmal = status === 'fehler' && !endgueltig && a.versuche < MAX_VERSUCHE;
        return {
          ...a, status,
          beendet: jetzt.toISOString(),
          pachtBis: undefined, pachtToken: undefined,
          ...(status === 'fertig' ? { ergebnis: text.slice(0, 1200) } : { fehler: text.slice(0, 600) }),
          ...(nochmal ? { status: 'offen' as AuftragStatus, nichtVor: new Date(jetzt.getTime() + pauseNachVersuch(a.versuche) * 60_000).toISOString() } : {}),
        };
      }),
    };
  });
  if (!angenommen) console.warn(`[Aufträge] Meldung zu ${id} verworfen — Pacht abgelaufen oder neu vergeben.`);
  return angenommen;
}

/**
 * Einen Auftrag von Hand abbrechen (09.10., Agenten-Bereich Paket 4b — vorher schrieb lib/agenten/laeufe.ts selbst in die Warteschlange):
 * nur offene bzw. — mit `auchLaufend` — laufende; die Pacht fällt weg (ein laufender Läufer meldet danach ins Leere), `versuche` auf das
 * Maximum (kein neuer Versuch). `pruefe` sieht den Auftrag in der Sperre (Person, Art) und liefert einen Grund zum Ablehnen.
 */
export async function abbrechen(id: string, o: { text: string; pruefe?: (a: Auftrag) => string | null }): Promise<{ ok: true; auftrag: Auftrag } | { ok: false; grund: 'fehlt' | 'beendet' | 'abgelehnt'; text?: string }> {
  let raus: { ok: true; auftrag: Auftrag } | { ok: false; grund: 'fehlt' | 'beendet' | 'abgelehnt'; text?: string } = { ok: false, grund: 'fehlt' };
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const i = liste.findIndex(a => a.id === id);
    if (i < 0) { raus = { ok: false, grund: 'fehlt' }; return current as Stand; }
    const a = liste[i];
    const nein = o.pruefe?.(a);
    if (nein) { raus = { ok: false, grund: 'abgelehnt', text: nein }; return current as Stand; }
    if (a.status !== 'offen' && a.status !== 'laeuft') { raus = { ok: false, grund: 'beendet' }; return current as Stand; }
    const { pachtBis: _p, pachtToken: _t, ...rest } = a;
    const neu: Auftrag = { ...rest, status: 'fehler', fehler: o.text.slice(0, 600), beendet: new Date().toISOString(), versuche: MAX_VERSUCHE };
    raus = { ok: true, auftrag: neu };
    return { ...(current as Stand), auftraege: liste.map((x, j) => (j === i ? neu : x)) };
  });
  return raus;
}

/** Alle Aufträge, auf die `passt` zutrifft (nur offene bzw. laufende), abbrechen — z. B. beim Not-Aus. Liefert die Kennungen. */
export async function abbrechenWo(passt: (a: Auftrag) => boolean, text: string): Promise<string[]> {
  const ids: string[] = [];
  if ((await loadJson<Stand>('zoe-auftraege')) === null) return ids;
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const jetzt = new Date().toISOString();
    let n = 0;
    const neu = liste.map(a => {
      if ((a.status !== 'offen' && a.status !== 'laeuft') || !passt(a)) return a;
      n++; ids.push(a.id);
      const { pachtBis: _p, pachtToken: _t, ...rest } = a;
      return { ...rest, status: 'fehler' as AuftragStatus, fehler: text.slice(0, 600), beendet: jetzt, versuche: MAX_VERSUCHE };
    });
    return n ? { ...(current as Stand), auftraege: neu } : (current as Stand);
  });
  return ids;
}

/** Hält der Aufrufer die aktuelle Pacht dieses Auftrags? (vor dem Ausführen prüfen) */
export async function pachtGueltig(id: string, pachtToken: unknown): Promise<Auftrag | null> {
  if (typeof pachtToken !== 'string' || !pachtToken) return null;
  const a = (await lies()).find(x => x.id === id);
  return a && a.status === 'laeuft' && a.pachtToken === pachtToken && (!a.pachtBis || Date.parse(a.pachtBis) >= Date.now()) ? a : null;
}

/**
 * Pacht verlängern (09.10., Takt robust): solange ein Lauf lebt, hält die Lauf-Route seine Pacht im Minutentakt frisch — vorher lief die
 * Pacht (300 s) ab, während Heads, Head of Finance und Agenten-Läufe bis 330–400 s rechnen durften, und ein zweiter Arbeiter nahm denselben
 * Auftrag (doppelter Lauf, doppelte KI-Kosten). Nur der aktuelle Halter, nur solange der Auftrag läuft und höchstens `LAUF_MAX_MS` nach
 * Beginn — danach fällt er zurück. Liefert, ob verlängert wurde.
 */
export async function pachtVerlaengern(id: string, pachtToken: string, pachtSekunden = 300, jetzt = new Date()): Promise<boolean> {
  let ok = false;
  await updateJson<Stand>('zoe-auftraege', current => {
    ok = false;
    const liste = current?.auftraege ?? [];
    const i = liste.findIndex(a => a.id === id && a.status === 'laeuft' && a.pachtToken === pachtToken);
    if (i < 0) return current as Stand;
    const a = liste[i];
    if (a.begonnen && jetzt.getTime() - Date.parse(a.begonnen) > LAUF_MAX_MS) return current as Stand;
    ok = true;
    return { ...(current as Stand), auftraege: liste.map((x, j) => (j === i ? { ...x, pachtBis: new Date(jetzt.getTime() + pachtSekunden * 1000).toISOString() } : x)) };
  });
  return ok;
}

/** Herzschlag eines Laufs: verlängert die Pacht alle `alleMs`, bis `stop()` (im `finally` der Lauf-Route) oder bis es nicht mehr geht. */
export function pachtHalten(id: string, pachtToken: string, alleMs = 60_000): { stop: () => void } {
  const t = setInterval(() => {
    void pachtVerlaengern(id, pachtToken).then(ok => { if (!ok) clearInterval(t); }).catch(() => {});
  }, alleMs);
  (t as { unref?: () => void }).unref?.();
  return { stop: () => clearInterval(t) };
}

export async function lies(): Promise<Auftrag[]> {
  const s = await loadJson<Stand>('zoe-auftraege');
  return s?.auftraege ?? [];
}

/** Für das Lagebild (Head of IT): Größe der Warteschlange und heute abgelehnte Aufträge — nur Zahlen. */
export async function warteschlangeLage(jetzt = new Date()): Promise<{ gesamt: number; aktiv: number; grenze: number; abgelehntHeute: number }> {
  const s = await loadJson<Stand>('zoe-auftraege');
  const liste = s?.auftraege ?? [];
  return { gesamt: liste.length, aktiv: liste.filter(a => !erledigt(a)).length, grenze: HARTE_GRENZE, abgelehntHeute: s?.abgelehnt?.tag === localDay(jetzt) ? s.abgelehnt.anzahl : 0 };
}

/** Systemläufe, deren Ergebnis nur Zahlen trägt — bleiben für alle lesbar (der Taktgeber liest „n Vorschläge“ des Verbesserungs-Loops). */
const SYSTEM_ERGEBNIS_LESBAR: ReadonlySet<string> = new Set(['verbesserung']);

/**
 * Die Warteschlange, wie eine Person sie sieht (rein — Sicherheitsprüfung 09.10.). Systemläufe des Takts (ohne Person) laufen oft FÜR die
 * Inhaberin (Morgen-/Abendlauf, Tageslauf, Leistung über `laufPerson`) — ihr Ergebnis ist deren Bericht. Deshalb: eigene Aufträge voll, die des
 * Systems nur neutral (Kennung, Name, Status, Zeiten — ohne Eingabe, Auftragstext, Ergebnis, Fehler; dieselbe Regel wie das Lesemodell der
 * Läufe, lib/agenten/laeufe.ts), private Systemläufe für Konten ohne Privat-Bereich gar nicht, die anderer Personen nie, nie ein Pacht-Token.
 * `person` null = Systemlauf (Takt, Dienstweg ohne Person) — sieht alles.
 */
export function auftraegeFuerBetrachter(liste: readonly Auftrag[], person: string | null, o: { privat: boolean; privatSystem: ReadonlySet<string>; titel?: (name: string) => string }): Auftrag[] {
  if (!person) return [...liste];
  const raus: Auftrag[] = [];
  for (const a of liste) {
    const { pachtToken: _t, pachtBis: _b, ...ohne } = a;
    if (a.person) { if (a.person === person) raus.push(ohne); continue; }
    if (!o.privat && o.privatSystem.has(a.name)) continue;
    const { eingabe: _e, auftrag: _a, ergebnis, fehler: _f, anlass, ...neutral } = ohne;
    raus.push({
      ...neutral, eingabe: {},
      ...(o.titel ? { auftrag: o.titel(a.name) } : {}),
      ...(anlass && /^Takt:/.test(anlass) ? { anlass } : {}),
      ...(SYSTEM_ERGEBNIS_LESBAR.has(a.name) && ergebnis ? { ergebnis } : {}),
    });
  }
  return raus;
}

export async function stand(): Promise<{ offen: number; laeuft: number; fertig: number; fehler: number }> {
  const liste = await lies();
  return {
    offen: liste.filter(a => a.status === 'offen').length,
    laeuft: liste.filter(a => a.status === 'laeuft').length,
    fertig: liste.filter(a => a.status === 'fertig').length,
    fehler: liste.filter(a => a.status === 'fehler').length,
  };
}
