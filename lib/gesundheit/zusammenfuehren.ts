// ─── Gesundheits-Log und Journal: PUT des Altwegs zusammenführen statt ersetzen (rein, getestet) ─────────────────────────────────
// Prüf-Fund 11.10.: Die Online-Version vor dem 09.10. (und alte PWA-Tabs) schreibt Gesundheits-Log und Journal per PUT als GANZEN Bestand.
// Seit dem 09.10. setzen die neuen Oberflächen Haken, Zähler und Tages-Check-Antworten einzeln per PATCH — ein alter Tab überschrieb sie mit
// seinem veralteten Stand. Die Routen lehnen fremde Bau-Kennungen jetzt mit 409 „neu laden“ ab (`bauPruefen`); was trotzdem per PUT kommt
// (Tests, Läufe ohne Kennung, lokaler Entwicklungsmodus), wird hier TAGESWEISE zusammengeführt:
//   Gesundheits-Log → je Tag die Vereinigung — ein Haken geht über PUT nie verloren (lösen nur per PATCH);
//   Journal         → je Tag Feld für Feld (geschickte Felder gewinnen), `check`-Antworten werden vereint — eine Antwort, die nur der
//                     Server kennt, bleibt stehen.
// Tage, die der Körper nicht nennt, bleiben unverändert; nichts wird beim Lesen oder Schreiben verworfen.

export type HakenLog = Record<string, string[]>;

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Gesundheits-Log: je Tag die Vereinigung aus gespeichertem und geschicktem Stand (Reihenfolge: gespeichert, dann neu). */
export function logZusammenfuehren(bisher: HakenLog, neu: Record<string, unknown>): HakenLog {
  const aus: HakenLog = { ...bisher };
  for (const [tag, liste] of Object.entries(neu)) {
    if (!Array.isArray(liste)) continue; // kein Tagesstand — gespeicherter bleibt
    const alt = Array.isArray(bisher[tag]) ? bisher[tag] : [];
    const dazu = liste.filter((x): x is string => typeof x === 'string' && !!x && !alt.includes(x));
    if (!alt.length && !dazu.length && !(tag in bisher)) continue; // kein leerer Tag aus dem Nichts
    aus[tag] = [...alt, ...[...new Set(dazu)]];
  }
  return aus;
}

/** Journal: je Tag Feld für Feld zusammenführen; `check` (Tages-Check) wird vereint — nie eine gespeicherte Antwort verlieren. */
export function journalZusammenfuehren<E extends Record<string, unknown>>(bisher: Record<string, E>, neu: Record<string, unknown>): Record<string, E> {
  const aus: Record<string, E> = { ...bisher };
  for (const [tag, eintrag] of Object.entries(neu)) {
    if (!istObjekt(eintrag)) continue;
    const alt = istObjekt(bisher[tag]) ? bisher[tag] : ({} as E);
    const tagNeu: Record<string, unknown> = { ...alt, ...eintrag };
    const checkAlt = istObjekt(alt.check) ? alt.check : null;
    const checkNeu = istObjekt(eintrag.check) ? eintrag.check : null;
    if (checkAlt || checkNeu) tagNeu.check = { ...(checkAlt ?? {}), ...(checkNeu ?? {}) };
    aus[tag] = tagNeu as E;
  }
  return aus;
}

/** Die Felder, die PATCH /api/state/journal annimmt (Text, Zahlen 1–5, Tages-Check). Client-sicher. */
export const JOURNAL_PATCH_FELDER = ['text', 'gut', 'dankbar', 'hart', 'mood', 'energy', 'stress', 'tagesnote', 'check'] as const;

/**
 * Aus einer Änderung im Browser den Körper für PATCH /api/state/journal machen (Ritual, 11.10.): nur bekannte Felder, `at` setzt der Server;
 * ein geleertes Textfeld geht als '' mit (der Server entfernt es dann), statt still liegen zu bleiben.
 */
export function journalPatchFelder(patch: object): Record<string, unknown> {
  const p = patch as Record<string, unknown>;
  const aus: Record<string, unknown> = {};
  for (const f of JOURNAL_PATCH_FELDER) if (f in p) aus[f] = p[f] === undefined ? null : p[f];
  return aus;
}
