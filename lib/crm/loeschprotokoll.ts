// ─── Löschprotokoll (Art. 17) ohne Klartext-Kennung (29.09., Paket D-B #30/#69) ─
// Bis 29.09. stand im Löschprotokoll die Kontakt-Kennung — und die trägt die E-Mail-Adresse (`c-<mail>…`). Ab jetzt
// nur eine eigene Protokoll-ID (`lp-<zufall>`), der Tag, der Grund und WER gelöscht hat (Person des Haushalts). Dass
// die gelöschte Person nicht zurückkommt, sichern Sperrliste und Grabstein (nur Fingerabdrücke) — nicht dieses Protokoll.
// Altbestand: Einträge mit Klartext-Kennung werden beim nächsten Schreiben (Löschung oder Löschfristen-Lauf) auf eine
// neue Protokoll-ID umgeschrieben (`ohneKlartext`) — Tag, Grund und Person bleiben.

import { randomUUID } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const LOESCHPROTOKOLL = 'crm-loeschprotokoll';
/**
 * Status (29.09., Paket D-C #21): „laeuft“ = Löschung begonnen (Absicht liegt im Absichtsprotokoll), „vollstaendig“ =
 * alle Bestände bestätigt, „unvollstaendig“ = einzelne Bestände scheiterten (`fehlend`: nur Bestands-/Schrittnamen) —
 * die Wiederaufnahme (lib/store/absichten-fortsetzen.ts) holt sie nach und setzt den Status nach. Fehlt = Altbestand
 * (vor dem 29.09., galt als vollständig).
 */
export type LoeschStatus = 'laeuft' | 'vollstaendig' | 'unvollstaendig';
export interface LoeschEintrag { id: string; datum: string; grund: string; von: string; status?: LoeschStatus; fehlend?: string[] }
export interface LoeschprotokollDatei { eintraege: LoeschEintrag[] }

export const PROTOKOLL_ID = /^lp-[a-z0-9-]{8,60}$/;
export const neueProtokollId = () => `lp-${randomUUID()}`;

/** Einträge mit Klartext-Kennung (Altbestand) bekommen eine Protokoll-ID. Rein bis auf die Zufalls-ID. */
export function ohneKlartext(eintraege: readonly LoeschEintrag[]): { eintraege: LoeschEintrag[]; n: number } {
  let n = 0;
  const neu = eintraege.map(e => (PROTOKOLL_ID.test(String(e?.id ?? '')) ? e : (n++, { ...e, id: neueProtokollId() })));
  return { eintraege: n ? neu : [...eintraege], n };
}

/** Eine Löschung festhalten (und Altbestand dabei bereinigen). Liefert die Protokoll-ID. */
export async function loeschungFesthalten(e: Omit<LoeschEintrag, 'id'>): Promise<string> {
  const id = neueProtokollId();
  await updateJson<LoeschprotokollDatei>(LOESCHPROTOKOLL, cur => ({ eintraege: [...ohneKlartext(Array.isArray(cur?.eintraege) ? cur.eintraege : []).eintraege, { id, ...e }] }));
  return id;
}

/**
 * Eintrag mit fester Protokoll-ID anlegen oder seinen Status nachtragen (idempotent — die Art.-17-Absicht vergibt die ID
 * vorab, jede Wiederaufnahme schreibt denselben Eintrag). `fehlend` nur Schrittnamen, nie Personendaten.
 */
export async function loeschungVermerken(e: LoeschEintrag): Promise<void> {
  if (!PROTOKOLL_ID.test(e.id)) throw new Error('Unzulässige Protokoll-ID.');
  const eintrag: LoeschEintrag = { id: e.id, datum: e.datum, grund: e.grund, von: e.von, ...(e.status ? { status: e.status } : {}), ...(e.fehlend?.length ? { fehlend: e.fehlend.map(x => String(x).slice(0, 60)).slice(0, 40) } : {}) };
  await updateJson<LoeschprotokollDatei>(LOESCHPROTOKOLL, cur => {
    const l = ohneKlartext(Array.isArray(cur?.eintraege) ? cur.eintraege : []).eintraege;
    const i = l.findIndex(x => x.id === e.id);
    if (i < 0) return { eintraege: [...l, eintrag] };
    // Tag, Grund und Person bleiben wie beim ersten Vermerk — nur Status und Fehlendes wandern.
    const neu = { ...l[i], ...(eintrag.status ? { status: eintrag.status } : {}) } as LoeschEintrag;
    if (eintrag.fehlend) neu.fehlend = eintrag.fehlend; else delete neu.fehlend;
    const kopie = [...l]; kopie[i] = neu;
    return { eintraege: kopie };
  });
}

/** Altbestand bereinigen (Löschfristen-Lauf). Liefert die Zahl umgeschriebener Einträge. Legt nie einen leeren Bestand an. */
export async function loeschprotokollBereinigen(): Promise<number> {
  if ((await loadJson<LoeschprotokollDatei>(LOESCHPROTOKOLL)) === null) return 0;
  let n = 0;
  await updateJson<LoeschprotokollDatei>(LOESCHPROTOKOLL, cur => { const r = ohneKlartext(Array.isArray(cur?.eintraege) ? cur.eintraege : []); n = r.n; return n ? { eintraege: r.eintraege } : (cur as LoeschprotokollDatei); });
  return n;
}
