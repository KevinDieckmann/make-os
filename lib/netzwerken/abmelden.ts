// ─── Netzwerken — Abmelden räumt auf (Browser, 03.10.) ───────────────────────
// Auf einem gemeinsam genutzten Gerät (Messe-iPad, das Handy des Partners) bleiben nach dem Abmelden weder Erfassungen noch Merker der
// letzten Person liegen — und nichts geht verloren:
//   1. Warten noch Erfassungen dieser Person (kein Netz auf dem Weg nach Hause?): „Es warten noch n Erfassungen — erst senden?“
//      OK sendet jetzt; klappt es nicht, fragt eine zweite Frage, ob trotzdem abgemeldet werden soll (sie bleiben dann auf dem Gerät und
//      gehen raus, sobald sich DIESE Person wieder anmeldet — unter anderem Namen sendet der Server sie nie, 409). Abbrechen = nicht abmelden.
//   2. Ist die Warteschlange leer: IndexedDB `make-os-netzwerken` und alle `make-os-netzwerken-*` im localStorage weg (Event-Wahl, Kontext).
//      Liegt noch etwas für jemand anderen: nur der Kontext-Merker („wer bin ich“) fällt weg — er gehört der abgemeldeten Person.
// Die Fragen stellt `ui` (im Browser `window.confirm`) — so lässt sich der Ablauf ohne Browser testen.

import { geteilteWarteschlange, offenFuer, type Warteschlange } from './warteschlange';

export const DB_NAME = 'make-os-netzwerken';
export const SPEICHER_PRAEFIX = 'make-os-netzwerken-';
export const KONTEXT_KEY = 'make-os-netzwerken-kontext';

export interface AbmeldeUi { bestaetigen(text: string): boolean }
export interface Speicherzugang {
  /** localStorage-ähnlich (Schlüssel auflisten, löschen) — im Test ein Attrappen-Speicher. */
  schluessel(): string[];
  entferne(k: string): void;
  /** IndexedDB löschen (im Test mitgezählt). */
  loescheDb(name: string): Promise<void>;
}

export const browserSpeicher = (): Speicherzugang => ({
  schluessel: () => { try { return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i) ?? '').filter(Boolean); } catch { return []; } },
  entferne: k => { try { window.localStorage.removeItem(k); } catch { /* ohne Speicher */ } },
  loescheDb: name => new Promise<void>(ok => {
    if (typeof indexedDB === 'undefined') { ok(); return; }
    try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); }
  }),
});

/** Merker und — bei leerer Warteschlange — die Datenbank wegräumen. */
export async function netzwerkenAufraeumen(q: Warteschlange, z: Speicherzugang): Promise<{ komplett: boolean }> {
  let leer = true;
  try { leer = (await q.alle()).length === 0; } catch { leer = false; } // nicht lesbar: lieber nichts löschen
  if (leer) {
    for (const k of z.schluessel()) if (k.startsWith(SPEICHER_PRAEFIX)) z.entferne(k);
    await z.loescheDb(DB_NAME);
  } else z.entferne(KONTEXT_KEY);
  return { komplett: leer };
}

/**
 * Vor dem Abmelden: warnen, senden, aufräumen. `true` = es darf abgemeldet werden, `false` = die Person bricht ab.
 * `person`: Kennung der angemeldeten Person (zählt nur ihre Erfassungen); `q`/`z` nur für Tests.
 */
export async function vorAbmelden(person: string | null, ui: AbmeldeUi, q: Warteschlange = geteilteWarteschlange(), z: Speicherzugang = browserSpeicher()): Promise<boolean> {
  let offen = 0;
  try { offen = offenFuer(await q.alle(), person); } catch { /* nicht lesbar: ohne Warnung weiter */ }
  if (offen > 0) {
    const n = (x: number) => `${x} ${x === 1 ? 'Erfassung' : 'Erfassungen'}`;
    if (!ui.bestaetigen(`Es ${offen === 1 ? 'wartet' : 'warten'} noch ${n(offen)} — erst senden?`)) return false;
    q.person = person;
    try { await q.senden(); } catch { /* unten zählt, was übrig ist */ }
    let rest = offen;
    try { rest = offenFuer(await q.alle(), person); } catch { /* ungewiss: wie unversendet behandeln */ }
    if (rest > 0 && !ui.bestaetigen(`${n(rest)} ${rest === 1 ? 'ließ' : 'ließen'} sich nicht senden (kein Netz?). Trotzdem abmelden? ${rest === 1 ? 'Sie bleibt' : 'Sie bleiben'} auf diesem Gerät und ${rest === 1 ? 'geht' : 'gehen'} raus, sobald du dich wieder anmeldest.`)) return false;
  }
  await netzwerkenAufraeumen(q, z);
  return true;
}
