// ─── Agenten-Bereich: Wissen der Business-Heads im Brain — Bestand und Schreibweg (09.10.) ─────────────────────────────────────────────
// Regel 09.10. spät: „Firma und Privat liegen getrennt — auch in der Datenhaltung.“ Deshalb ein EIGENER Business-Bestand
// `agenten-wissen--<haushalt>` (`WissenBestand`, lib/agenten/typen.ts) — nie in `agenten-einstellung--<haushalt>` (dort liegen auch Familie und
// die Abschnitte der Privat-Heads). Darin NUR:
//   • je Business-Head sein Wissen im Brain (Ordner/Notizen, Modus) — z. B. das Sales-Brain für den Head of Sales;
//   • der Agenten-Ordner des (Firmen-)Brains für „Aus dem Brain übernehmen“.
// Regeln: EINE Schreibstelle (`wissenAendern`, `agentenOrdnerSetzen`), Stand je Head → 409, Prüfung rein (lib/agenten/wissen.ts) + ob es die Pfade
// in der Agenten-Sicht gibt (nie `privat`), Protokoll nur Kennung + Feldnamen. Rechte wie die Einstellungen eines Haushalts-Heads (volle
// Mitglieder, die den Head sehen); Privat-Heads → 400 (sie bekommen ihr Wissen nie aus diesem Bestand). Lesen für Läufe: `wissenFuerHead`
// (Lesefehler = kein Wissen — das Werkzeug fehlt dann, gesperrt wird nichts).

import { headDef } from './katalog';
import { wissenSaeubern } from './wissen';
import { wissenBestand, type HeadDef, type HeadWissen, type WissenBestand } from './typen';

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; [k: string]: unknown };
const fehler = (status: Fehler['status'], text: string, extra: Record<string, unknown> = {}): Fehler => ({ ok: false, status, fehler: text, ...extra });
export const GELOESCHT = '[gelöscht]';
const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Abbruch in der Sperre ohne Schreiben (updateJson schreibt nicht, wenn `mutate` wirft). */
const HALT = Symbol('halt');

/** Der Bestand (rein) säubern: nur Business-Heads des Katalogs mit Pfaden. */
export function wissenBestandLesen(roh: unknown): WissenBestand {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<WissenBestand>;
  const heads: WissenBestand['heads'] = {};
  for (const [id, w] of Object.entries(r.heads && typeof r.heads === 'object' ? r.heads : {})) {
    if (headDef(id)?.bereich !== 'business' || !w || !Array.isArray(w.pfade) || !w.pfade.length) continue;
    heads[id] = w;
  }
  return { v: 1, heads, ...(r.brainAgenten && typeof r.brainAgenten.ordner === 'string' ? { brainAgenten: r.brainAgenten } : {}) };
}

/** Stand des Wissens eines Heads (409) — auch ohne Eintrag. Rein. */
export function wissenStand(w: HeadWissen | null | undefined): string {
  const s = w ? JSON.stringify([w.modus, [...w.pfade].sort()]) : 'leer';
  let a = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return `ws-${a.toString(16).padStart(8, '0')}`;
}

/** Nur das Wissen (ohne Vermerke) — für Läufe und Anzeige. Rein. */
export const nurWissen = (w: WissenBestand['heads'][string] | undefined): HeadWissen | null => (w?.pfade?.length ? { pfade: [...w.pfade], modus: w.modus === 'nur' ? 'nur' : 'bevorzugt' } : null);

/** Den Bestand eines Haushalts lesen (Server). Lesefehler → wirft (der Aufrufer entscheidet: Lauf = kein Wissen, Schreiben = 409). */
export async function wissenLesen(haushalt: string | null): Promise<WissenBestand> {
  if (!haushalt || !HAUSHALT.test(haushalt)) return { v: 1, heads: {} };
  const { loadJson } = await import('@/lib/store/local-db');
  return wissenBestandLesen(await loadJson<WissenBestand>(wissenBestand(haushalt)));
}

/** Wissen eines Heads für einen Lauf — nur Business-Heads; nicht lesbar = keins (das Werkzeug fehlt dann, nichts wird gesperrt). */
export async function wissenFuerHead(haushalt: string | null, head: Pick<HeadDef, 'id' | 'bereich'>): Promise<HeadWissen | null> {
  if (head.bereich !== 'business') return null;
  try { return nurWissen((await wissenLesen(haushalt)).heads[head.id]); } catch { return null; }
}

/** Anzeige je Head (GET /api/agenten): nur Business-Heads; Privat-Heads bekommen nichts. */
export async function wissenSichtFuer(haushalt: string | null, head: Pick<HeadDef, 'id' | 'bereich'>, bestand?: WissenBestand): Promise<{ wert: HeadWissen | null; stand: string } | undefined> {
  if (head.bereich !== 'business') return undefined;
  const b = bestand ?? await wissenLesen(haushalt).catch(() => null);
  if (!b) return undefined;
  const wert = nurWissen(b.heads[head.id]);
  return { wert, stand: wissenStand(wert) };
}

/**
 * Wissen eines Business-Heads setzen bzw. entfernen (`null`) — Person aus der Sitzung. Rechte: Head sichtbar + volles Mitglied
 * (`einstellungDarf`); Privat-Heads → 400. Pfade müssen im Brain in der Agenten-Sicht existieren (Schreibweise des Vaults). Stand → 409.
 */
export async function wissenAendern(person: string, headId: unknown, wissenRoh: unknown, stand: unknown): Promise<{ ok: true; headId: string; wissen: HeadWissen | null; stand: string; geaendert: boolean } | Fehler> {
  const head = typeof headId === 'string' ? headDef(headId) : null;
  if (!head) return fehler(404, 'Diesen Head gibt es nicht.');
  if (head.bereich !== 'business') return fehler(400, 'Wissen aus dem Brain gibt es nur für Business-Heads (Firma und Privat liegen getrennt).');
  const [{ sichtLaden }, { headSichtbar }, { einstellungDarf }, { umfangFuer }] = await Promise.all([import('./faeden-server'), import('./sicht'), import('./einstellung'), import('./skills-server')]);
  const sicht = await sichtLaden(person);
  const sichtbar = headSichtbar(sicht, head.id);
  if (!sichtbar) return fehler(403, 'Diesen Head siehst du nicht.');
  if (!einstellungDarf(sicht, head, sichtbar)) return fehler(403, 'Das Wissen eines Heads ändern nur volle Mitglieder des Haushalts.');
  if (typeof stand !== 'string') return fehler(400, 'Stand fehlt.');
  const w = wissenSaeubern(wissenRoh);
  if (!w.ok) return fehler(w.status, w.fehler);
  let neu: HeadWissen | null = w.wert;
  if (neu) {
    const { wissenPfadeAufloesen } = await import('./wissen-werkzeug');
    const r = await wissenPfadeAufloesen(head, person, neu.pfade).catch(() => null);
    if (!r) return fehler(409, 'Das Brain ist gerade nicht lesbar — Wissen nicht gespeichert, bitte später noch einmal.');
    if (r.fehlen.length) return fehler(400, `Im Brain nicht gefunden (oder nur privat): ${r.fehlen.slice(0, 3).map(p => `„${p}“`).join(', ')}${r.fehlen.length > 3 ? ` (+${r.fehlen.length - 3})` : ''}. Nichts gespeichert.`);
    neu = { pfade: Array.from(new Set(r.pfade)), modus: neu.modus };
  }
  const { haushalt } = await umfangFuer(person);
  if (!haushalt) return fehler(409, 'Ohne Haushalt gibt es kein Wissen je Head.');
  const [{ updateJson }, { protokolliere }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll')]);
  const jetzt = new Date().toISOString();
  let raus: { ok: true; headId: string; wissen: HeadWissen | null; stand: string; geaendert: boolean } | Fehler = fehler(409, 'Nicht gespeichert.');
  try {
    await updateJson<WissenBestand>(wissenBestand(haushalt), cur => {
      const b = wissenBestandLesen(cur);
      const alt = nurWissen(b.heads[head.id]);
      // Nichts zu schreiben (Konflikt bzw. unverändert) → abbrechen, damit kein leerer Bestand entsteht.
      if (stand !== wissenStand(alt)) { raus = fehler(409, 'Das Wissen dieses Heads hat sich inzwischen geändert — bitte neu laden.', { stand: wissenStand(alt) }); throw HALT; }
      if (wissenStand(alt) === wissenStand(neu)) { raus = { ok: true, headId: head.id, wissen: alt, stand: wissenStand(alt), geaendert: false }; throw HALT; }
      const heads = { ...b.heads };
      if (neu) heads[head.id] = { ...neu, geaendertAm: jetzt, geaendertVon: person }; else delete heads[head.id];
      raus = { ok: true, headId: head.id, wissen: neu, stand: wissenStand(neu), geaendert: true };
      return { ...b, heads };
    });
  } catch (err) { if (err !== HALT) throw err; }
  const e = raus as Awaited<ReturnType<typeof wissenAendern>>;
  if (e.ok && e.geaendert) await protokolliere(wissenBestand(haushalt), [{ liste: 'heads', op: 'geaendert', id: head.id, felder: ['wissen'] }], { art: 'person', person }).catch(() => {});
  return e;
}

/** Den Agenten-Ordner des (Firmen-)Brains festhalten (`null` = wieder automatisch über `_Agenten_Index`). Rechte prüft die Route (Inhaber). */
export async function agentenOrdnerSetzen(person: string, haushalt: string, pfad: string | null): Promise<boolean> {
  const [{ updateJson }, { protokolliere }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll')]);
  const jetzt = new Date().toISOString();
  let geaendert = false;
  try {
    await updateJson<WissenBestand>(wissenBestand(haushalt), cur => {
      const b = wissenBestandLesen(cur);
      if ((b.brainAgenten?.ordner ?? null) === pfad) throw HALT;
      geaendert = true;
      const { brainAgenten: _b, ...rest } = b;
      return pfad ? { ...b, brainAgenten: { ordner: pfad, am: jetzt, von: person } } : rest;
    });
  } catch (err) { if (err !== HALT) throw err; }
  if (geaendert) await protokolliere(wissenBestand(haushalt), [{ liste: 'instanz', op: 'geaendert', id: 'brain-agenten', felder: ['brainAgenten'] }], { art: 'person', person }).catch(() => {});
  return geaendert;
}

// ── Konto: Export und Löschen (rein) ───────────────────────────────────────────────────────────────────────────────────────

/** Was den Speichernamen der Person trägt — für den Konto-Export (Art. 15/20): wann sie welches Wissen bzw. den Agenten-Ordner gesetzt hat. */
export function wissenEintraegeVon(b: WissenBestand, speicher: string): unknown[] {
  const raus: unknown[] = [];
  for (const [id, w] of Object.entries(b.heads)) if (w?.geaendertVon === speicher) raus.push({ art: 'wissen', head: id, pfade: w.pfade, modus: w.modus, am: w.geaendertAm });
  if (b.brainAgenten?.von === speicher) raus.push({ art: 'brain-agenten', ordner: b.brainAgenten.ordner, am: b.brainAgenten.am });
  return raus;
}

/** Konto löschen (rein): das Wissen bleibt (Arbeitsweise des Haushalts), der Speichername wird „[gelöscht]“. */
export function wissenOhnePerson(b: WissenBestand, speicher: string): { neu: WissenBestand; n: number } {
  let n = 0;
  const heads: WissenBestand['heads'] = {};
  for (const [id, w] of Object.entries(b.heads)) {
    if (!w) continue;
    if (w.geaendertVon === speicher) { heads[id] = { ...w, geaendertVon: GELOESCHT }; n++; } else heads[id] = w;
  }
  const neu: WissenBestand = { ...b, heads };
  if (b.brainAgenten?.von === speicher) { neu.brainAgenten = { ...b.brainAgenten, von: GELOESCHT }; n++; }
  return { neu, n };
}
