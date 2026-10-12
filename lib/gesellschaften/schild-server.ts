// ─── MAKE OS — Unternehmen › Schild: Lesen und Schreiben (Server, 10.10.) ───────────────────────────────────────────
// EINE Schreibstelle für den Business-Bestand `unternehmen-schild--<haushalt>` (Route /api/gesellschaften/schild, Demo-Saat über die Route,
// Morgenlauf, Konto-Löschen): eine Sperre, Stand je Gesellschaft (Fingerabdruck des Eintrags → 409), Änderungsprotokoll ohne Werte.
// Welche Gesellschaft das Schild führt, sagt das Gesellschafts-Register (nur lesen, lib/gesellschaften/server.ts): nur Business —
// eine Privat-Einheit (`bereichVon` = privat, z. B. die Selbstständigkeit) → 400 `GEHOERT_ZU_PRIVAT`, nie gespeichert, nie ausgeliefert.
// Regeln rein in lib/gesellschaften/schild/*. Zugang entscheidet die Route (Haushalt des Inhabers, Person mit Haushalt).
// Für den Head of Recht (eigenes Paket): `unternehmenLage(haushalt)` — dieselbe Lage wie die Oberfläche, nur lesen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { localDay } from '@/lib/zeit';
import { GEHOERT_ZU_PRIVAT, bereichVon, istGesellschaft, istGesellschaftId, istRegisterKennung, type GesellschaftId } from '@/lib/einheiten';
import { imPapierkorb } from '@/lib/eintraege/sicher';
import { gesellschaftVon, type RegisterDatei, type RegisterFehler, type RegisterGesellschaft } from './modell';
import { ladeRegister } from './server';
import { leererEintrag, schildName, type SchildDatei, type SchildGesellschaft } from './schild/typen';
import { lageAus, schildFristen, faelligeSchildErinnerungen, pflichtTitel, eintragVon, istSchildAufgabe, ALT_PFLICHT_TITEL_PRAEFIX, type Lage, type SchildFrist } from './schild/ampel';
import { schildAufraeumen, schildOhnePerson } from './schild/saeubern';
import { lageBlick } from './schild/blick';
import { verlaufName, verlaufPunkt, verlaufAnhaengen, type VerlaufDatei } from './schild/verlauf';

export { schildName };
export const schildStand = (s: SchildGesellschaft) => fingerabdruck(s as unknown as Record<string, unknown>);

export async function ladeSchild(haushalt: string): Promise<SchildDatei | null> {
  return loadJson<SchildDatei>(schildName(haushalt));
}

/** Der Eintrag einer Gesellschaft (leer, solange nichts erfasst ist). */
export const schildEintrag = (d: SchildDatei | null | undefined, id: GesellschaftId): SchildGesellschaft => eintragVon(d, id) ?? leererEintrag(id);

/**
 * Führt das Schild diese Gesellschaft? Business-Gesellschaft im Register des Haushalts, nicht im Papierkorb. Privat-Einheit → 400 mit
 * Satz, unbekannt → 404. Rein bis auf das übergebene Register.
 */
export function schildZiel(register: RegisterDatei | null | undefined, id: unknown): { g?: RegisterGesellschaft; fehler?: RegisterFehler[]; status?: number } {
  if (!istGesellschaftId(id)) return { fehler: [{ feld: 'id', text: 'id: Kennung einer Gesellschaft.' }], status: 400 };
  if (istGesellschaft(id) && bereichVon(id) !== 'business') return { fehler: [{ feld: 'id', text: GEHOERT_ZU_PRIVAT(id) }], status: 400 };
  const g = gesellschaftVon(register, id);
  if (!g || imPapierkorb(g) || (!istGesellschaft(id) && !istRegisterKennung(id))) return { fehler: [{ feld: 'id', text: 'Gesellschaft nicht gefunden.' }], status: 404 };
  return { g };
}

export interface SchildErgebnis { s?: SchildGesellschaft; konflikt?: SchildGesellschaft; fehler?: RegisterFehler[]; status?: number; extra?: Record<string, unknown> }
export type SchildAenderung = (alt: SchildGesellschaft, g: RegisterGesellschaft) => { s?: SchildGesellschaft; fehler?: RegisterFehler[]; status?: number; extra?: Record<string, unknown> };

/**
 * Den Eintrag einer Gesellschaft ändern — in EINER Sperre, mit Stand (409 + aktueller Eintrag bei veraltetem Stand). Andere Einträge und
 * unbekannte Felder bleiben, wie sie sind. Ohne Änderung wird nichts geschrieben.
 */
export async function schildAendern(haushalt: string, person: string, id: unknown, stand: unknown, wer: Wer, mut: SchildAenderung): Promise<SchildErgebnis> {
  const ziel = schildZiel(await ladeRegister(haushalt), id);
  if (!ziel.g) return { fehler: ziel.fehler, status: ziel.status };
  const gid = ziel.g.id;
  let vorher: SchildDatei | null = null;
  let ergebnis: SchildErgebnis = {};
  const nachher = await updateJson<SchildDatei>(schildName(haushalt), cur => {
    vorher = cur;
    const l = cur?.gesellschaften ?? [];
    const alt = schildEintrag(cur, gid);
    if (typeof stand !== 'string' || schildStand(alt) !== stand) { ergebnis = { konflikt: alt }; return cur ?? { gesellschaften: [] }; }
    const r = mut(alt, ziel.g!);
    if (r.fehler?.length || !r.s) { ergebnis = { fehler: r.fehler ?? [{ feld: 'id', text: 'Nichts geändert.' }], status: r.status ?? 400 }; return cur ?? { gesellschaften: [] }; }
    const neu: SchildGesellschaft = { ...r.s, id: gid, geaendert: new Date().toISOString(), geaendertVon: person };
    ergebnis = { s: neu, ...(r.extra ? { extra: r.extra } : {}) };
    const i = l.findIndex(x => x.id === gid);
    return { ...(cur ?? {}), gesellschaften: i >= 0 ? l.map(x => (x.id === gid ? neu : x)) : [...l, neu] };
  });
  if (ergebnis.s) await protokolliereBestand(schildName(haushalt), vorher, nachher, wer);
  return ergebnis;
}

/** Die Lage aller Business-Gesellschaften des Haushalts — Überblick, Head of Recht, Erinnerungen. Nur lesen. */
export async function unternehmenLage(haushalt: string, heute = localDay()): Promise<Lage> {
  const [register, schild] = await Promise.all([ladeRegister(haushalt), ladeSchild(haushalt)]);
  return lageAus(register, schild, heute);
}

/**
 * Stichtage für die Fristen-Ebene des Kalenders (lib/kalender/fristen-server.ts) — nur für eine Person mit Zugang zur Firmen-Akte
 * (`rechtZugangFuer`: Haushalt des Inhabers, voller Haushaltszugang; Prüf-Fund 11.10. — ein Konto „nur Business“ sah sonst „Pflicht: …“ in
 * Kalender, Heute und Glocke). `betrachter` Pflicht; ohne Person nichts. Wirft nie.
 */
export async function schildFristenLesen(betrachter: string | null): Promise<SchildFrist[]> {
  try {
    const { rechtZugangFuer } = await import('@/lib/recht/server');
    const z = await rechtZugangFuer(betrachter);
    return z ? schildFristen(await unternehmenLage(z.haushalt)) : [];
  } catch { return []; }
}

/**
 * Erinnerungen des Schilds (Muster `vertragsErinnerungen`): je fälliger Pflicht, ablaufendem Dokument, Marken-/Domain-/Versicherungsfrist,
 * Quartals-Runde und Neubewertungs-Anlass EINE Aufgabe mit fester Kennung (`usp-…`, `usd-…`, `usm-…`, `usr-…`; Business, beide) — gibt es sie
 * schon (auch erledigt oder im Papierkorb), passiert nichts. Eine inzwischen als erledigt VERMERKTE Pflicht schließt ihre offene Aufgabe.
 * Nur für NEU angelegte eine Meldung (vorhandene Art `vertrag` — eine neue Art bräche den Rückweg der Glocke; Telegram neutral über die Kennung) an jede Person des Haushalts. Läuft im Morgenlauf und nach Änderungen.
 * Seit 12.10. trägt die Pflicht-Aufgabe die Pflicht im Klartext (`pflichtTitel`, ohne Norm/Folge; Glocke weiter neutral): offene Aufgaben mit dem
 * früheren neutralen Titel (`ALT_PFLICHT_TITEL_PRAEFIX`) zieht derselbe Lauf nach — nur den Titel, nur unerledigte, nie einen von Hand geänderten,
 * idempotent (danach passt der Titel nicht mehr zum Präfix).
 * Wirft nie.
 */
export async function schildErinnerungen(haushalt: string, heute = localDay()): Promise<{ neu: number; geschlossen: number; umbenannt?: number }> {
  try {
    const lage = await unternehmenLage(haushalt, heute);
    const alle = faelligeSchildErinnerungen(lage);
    const titelJe = pflichtTitel(lage);
    if (!alle.length && !titelJe.size) return { neu: 0, geschlossen: 0 };
    const [{ systemAufgabenAendern }, { WEG }, { rechtPersonen }] = await Promise.all([import('@/lib/aufgaben/system-schreiben'), import('@/lib/wege'), import('@/lib/recht/server')]);
    // Zuständig und beteiligt NUR Konten mit Zugang zur Firmen-Akte (Prüf-Fund 11.10.) — „beide“ machte jedes Konto des Haushalts (auch
    // „nur Business“) zum Beteiligten samt Glocke.
    const personen = await rechtPersonen(haushalt);
    const zustaendig = personen.length ? { assignee: personen[0], ...(personen.length > 1 ? { beteiligte: personen.slice(1) } : {}) } : { assignee: 'both' };
    const jetzt = new Date().toISOString();
    let neu: typeof alle = [];
    let geschlossen = 0;
    let umbenannt = 0;
    await systemAufgabenAendern(stand => {
      const nachId = new Map(stand.tasks.map(t => [t.id, t]));
      const offen = (t: (typeof stand.tasks)[number] | undefined): t is (typeof stand.tasks)[number] => !!t && !t.geloeschtAm && t.status !== 'done' && t.status !== 'cancelled';
      neu = alle.filter(e => !e.erledigt && !nachId.has(e.aufgabeId));
      const schliessen = alle.filter(e => e.erledigt).map(e => nachId.get(e.aufgabeId)).filter(offen);
      geschlossen = schliessen.length;
      // Früherer neutraler Titel → Klartext (nur offene, nur solange der Titel noch der neutrale ist — eine Änderung von Hand bleibt).
      const umbenennen = [...titelJe].map(([id, title]) => ({ t: nachId.get(id), title }))
        .filter(x => offen(x.t) && typeof x.t.title === 'string' && x.t.title.startsWith(ALT_PFLICHT_TITEL_PRAEFIX) && x.t.title !== x.title);
      umbenannt = umbenennen.length;
      return {
        neu: neu.map(e => ({
          id: e.aufgabeId, title: e.titel, description: e.beschreibung, status: 'todo', priority: 'high', ...zustaendig, dueDate: e.dueDate,
          notiz: `[Im Bereich Unternehmen öffnen](${WEG.schild(e.reiter, e.gesellschaftId)})`,
          tags: ['unternehmen', 'pflicht'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: 'business',
          ...(istGesellschaft(e.gesellschaftId) ? { spaceId: e.gesellschaftId } : {}),
        })),
        teile: [
          ...schliessen.map(t => ({ id: t.id, felder: { status: 'done' } })),
          ...umbenennen.map(x => ({ id: x.t!.id, felder: { title: x.title } })),
        ],
      };
    }, { jetzt });
    if (neu.length) {
      // Glocke NUR an Konten mit Zugang zur Firmen-Akte (Prüf-Fund 11.10.): ein Konto „nur Business“ sieht das Schild nicht (toter Link, Inhalte).
      // Titel der Glocke neutral (`glocke`, Pflichten) — Telegram nennt ohnehin nur „Eine Unternehmens-Pflicht naht“ (Kennung `usp-…`).
      const { melde } = await import('@/lib/meldungen/melden');
      for (const e of neu) for (const an of personen) await melde({ an, art: 'vertrag', titel: e.glocke ?? e.titel, link: WEG.schild(e.reiter, e.gesellschaftId), bezug: { art: 'aufgabe', id: e.aufgabeId } });
    }
    return { neu: neu.length, geschlossen, ...(umbenannt ? { umbenannt } : {}) };
  } catch (e) {
    console.error('[schild] Erinnerungen nicht angelegt:', e instanceof Error ? e.message : e);
    return { neu: 0, geschlossen: 0 };
  }
}

/** Morgenlauf: Papierkorb des Schilds (30 Tage) aufräumen — liest erst ohne Sperre, schreibt nur, wenn etwas fällig ist. */
export async function schildPapierkorbAufraeumen(haushalt: string, jetzt = new Date()): Promise<{ eintraege: number }> {
  const iso = jetzt.toISOString();
  if (!schildAufraeumen(await ladeSchild(haushalt), iso).n) return { eintraege: 0 };
  let n = 0;
  let vorher: SchildDatei | null = null;
  const nachher = await updateJson<SchildDatei>(schildName(haushalt), cur => {
    vorher = cur;
    const r = schildAufraeumen(cur, iso);
    n = r.n;
    return (r.d ?? cur) as SchildDatei;
  });
  if (n) await protokolliereBestand(schildName(haushalt), vorher, nachher, { art: 'system' } as Wer);
  return { eintraege: n };
}

/** Konto gelöscht (Art. 17): „wer“ → „[gelöscht]“, Einträge bleiben. Gibt die Zahl der Umschreibungen zurück. */
export async function schildKontoLoeschen(haushalt: string, speicher: string): Promise<number> {
  let n = 0;
  await updateJson<SchildDatei>(schildName(haushalt), cur => {
    if (!cur?.gesellschaften) return cur as SchildDatei;
    const r = schildOhnePerson(cur, speicher);
    n = r.n;
    return n ? r.neu : cur;
  });
  return n;
}

// ── Gesundheits-Verlauf (11.10.) ─────────────────────────────────────────────────────────────────────────────────

/** Der Verlauf des Schilds (Ton und vier Dimensionen je Tag und Business-Gesellschaft) — nur lesen; gefiltert wird in der Route. */
export async function ladeVerlauf(haushalt: string): Promise<VerlaufDatei | null> {
  return loadJson<VerlaufDatei>(verlaufName(haushalt));
}

/**
 * Morgenlauf: den heutigen Punkt des Gesundheits-Verlaufs merken (idempotent — ein Tag wird höchstens ersetzt, ohne Änderung nichts geschrieben).
 * Nur Zahlen und Kennungen der Business-Gesellschaften. Wirft nie.
 */
export async function schildVerlaufMerken(haushalt: string, heute = localDay()): Promise<boolean> {
  try {
    const [register, schild] = await Promise.all([ladeRegister(haushalt), ladeSchild(haushalt)]);
    const p = verlaufPunkt(lageBlick(lageAus(register, schild, heute), schild?.gesellschaften), heute);
    if (!Object.keys(p.je).length || !verlaufAnhaengen(await ladeVerlauf(haushalt), p).geaendert) return false;
    let neu = false;
    await updateJson<VerlaufDatei>(verlaufName(haushalt), cur => { const r = verlaufAnhaengen(cur, p); neu = r.geaendert; return r.geaendert ? r.d : (cur ?? { tage: [] }); });
    return neu;
  } catch (e) {
    console.error('[schild] Verlauf nicht gemerkt:', e instanceof Error ? e.message : e);
    return false;
  }
}

/** Ist diese Aufgaben-Kennung eine Erinnerung des Schilds? (Telegram-Text neutral.) */
export { istSchildAufgabe };
