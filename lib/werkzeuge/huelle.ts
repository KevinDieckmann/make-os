// ─── Werkzeug-Verträge: die Hülle um jeden Aufruf (10.10., Paket V3, AGENTEN_KONZEPT_V2.md C3/T1–T3) — nur Server ───────────────────────────
// Die Bausteine, die JEDER Werkzeug-Aufruf durchläuft — Register-Werkzeuge in `fuehreAus` (lib/zoe/ausfuehren.ts, die EINE Stelle zur Wirkung),
// Agenten-Werkzeuge im Agenten-Kern (lib/agenten/gespraech.ts), die ZOE-Steuerung (run_agent, open_agent) im Gespräch (app/api/kimmi):
//   1. `vertragsPruefung`  Vertrag vorhanden? Bereich passt zur Sicht? Eingabe passt zum Schema? → sonst ein typisiertes Nein (nichts läuft).
//   2. das Werkzeug läuft (bzw. landet nach `wirkungsEntscheid` im Stapel — das entscheidet `fuehreAus`).
//   3. `ausgangVermerken`  das Ergebnis in die feste Form (`ergebnisAus`: typisiert, bloßer Text = Erfolg, Rückfall `ausAltText` mit Zähler),
//                          Ausgang in die Lauf-Spur (V1), Kennungen des Abschnitts ans Ergebnis.

import { bereichAbgelehntText, ergebnisAus, vertragPasstZurSicht, fehlschlag, type Sicht, type WerkzeugErgebnis, type WerkzeugRueckgabe, type WerkzeugVertrag } from './vertrag';
import { eingabeFehlerText, pruefeEingabe, type Schema } from './schema';
import { vertragVon } from './register';
import { spurJetzt, werkzeugAusgangVermerken } from '@/lib/ki/spur-kontext';

export interface PruefungOk { ok: true; vertrag: WerkzeugVertrag }
export interface PruefungNein { ok: false; ergebnis: WerkzeugErgebnis }

/**
 * Vor dem Lauf (rein bis auf das Nachschlagen des Vertrags): ohne Vertrag → `intern` (das Werkzeug läuft nicht — fail-closed); Bereich passt nicht
 * zur Sicht → `rechte` (Business nie in Privat und umgekehrt, serverseitig); Eingabe passt nicht zum Schema → `eingabe` (mit einem Satz je Fund,
 * nichts wird still geklemmt). `schema` = das Schema, das dem Modell in DIESEM Lauf angeboten war (Agenten-Bereich) — sonst das des Vertrags.
 */
export function vertragsPruefung(name: string, eingabe: unknown, o: { sicht?: Sicht | null; schema?: Record<string, unknown> | null; ohneBereich?: boolean } = {}): PruefungOk | PruefungNein {
  const vertrag = vertragVon(name);
  if (!vertrag) return { ok: false, ergebnis: fehlschlag('intern', `Nicht ausgeführt: „${name}“ hat keinen Werkzeug-Vertrag und läuft deshalb nicht.`) };
  if (!o.ohneBereich && o.sicht && vertrag.bereich !== 'beide' && !vertragPasstZurSicht(vertrag, o.sicht)) {
    return { ok: false, ergebnis: fehlschlag('rechte', bereichAbgelehntText(name, vertrag.bereich, o.sicht)) };
  }
  const p = pruefeEingabe((o.schema ?? vertrag.eingabe) as Schema, eingabe);
  if (!p.ok) return { ok: false, ergebnis: fehlschlag('eingabe', eingabeFehlerText(name, p.fehler)) };
  return { ok: true, vertrag };
}

/**
 * Nach dem Lauf: Ergebnis in die feste Form, Ausgang in die Lauf-Spur (Art, Fehlerklasse, Rückfall), Kennungen des Abschnitts ans Ergebnis.
 * Ein bloßer Text, den nur der Rückfall als Fehlschlag erkennt, zählt als `rueckfall` (Ziel 0) und wird einmal im Server-Log genannt (nur der Name).
 */
export function ausgangVermerken(name: string, r: WerkzeugRueckgabe | WerkzeugErgebnis | null | undefined): WerkzeugErgebnis {
  const e = ergebnisAus(r);
  const rueckfall = e.herkunft === 'alttext';
  if (rueckfall) console.warn(`[werkzeug-vertrag] ${name}: Fehlschlag nur am Text erkannt — das Werkzeug soll fehlschlag(…) melden.`);
  try { werkzeugAusgangVermerken(e.art, { ...(e.klasse ? { klasse: e.klasse } : {}), rueckfall }); } catch { /* die Spur stört nie */ }
  const k = spurJetzt();
  return k ? { ...e, spur: { kette: k.kette, lauf: k.lauf } } : e;
}
