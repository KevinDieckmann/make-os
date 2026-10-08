// ─── Einmalige Übernahme des Altbestands in die Daten (08.10. abends, Fragebogen Teil 3, Frage 2) ────────────────────
// WIRD MIT DEM ÜBERNÄCHSTEN UPLOAD GELÖSCHT — samt der Umgebungsvariable MAKE_OS_ALTBESTAND_PERSON
// (UPDATES.md › „08.10. abends — Fragebogen Teil 3“ › offene Einmal-Schritte).
//
// Kevin: „Meine bisherigen Inhalte einmalig in meine Daten übernehmen, dann aus dem Code löschen.“ Bis 08.10. standen
// persönliche Inhalte einer Person im Code (Körper-Profil u. a.). Sie sind jetzt Daten je Person (lib/gesundheit/koerper.ts).
// Damit für die Person nichts verloren geht, liegt der bisherige Inhalt UNVERÄNDERT hier (aus dem Code hierher verschoben)
// und wird genau einmal in IHREN Bestand geschrieben — danach fliegt dieses Modul aus dem Code.
//
// Regeln (Wächter tests/altbestand-uebernahme.test.ts):
//   - Nur mit MAKE_OS_ALTBESTAND_PERSON = Speichername der Person (auf unserem Server). Demo- und Kunden-Instanzen setzen
//     die Variable NIE → dort passiert nichts; mit MAKE_OS_DEMO=1 passiert auch mit Variable nichts.
//   - Die Person braucht ein Konto in dieser Instanz.
//   - Nur wenn das Ziel leer ist (nie über Daten, die die Person schon gepflegt hat), idempotent über die Marke im Bestand.
//   - Gesundheitsteile (Art. 9) nur mit Einwilligung (a) der Person — sonst übersprungen, Log ohne Inhalt.
//   - Neue Teile (z. B. der Nordstern) hängen sich als weiterer `AltbestandTeil` an `altbestandTeile()` an.
// Ausgelöst einmal nach dem Start (lib/store/betrieb.ts, nur wenn die Variable gesetzt ist). Server-Modul — nie im Browser.

import type * as K from '@/lib/gesundheit/koerper';

export const ALTBESTAND_VARIABLE = 'MAKE_OS_ALTBESTAND_PERSON';

export type TeilErgebnis = 'uebernommen' | 'schon-uebernommen' | 'ziel-belegt' | 'ohne-einwilligung' | 'fehler';
export interface AltbestandTeil<T = unknown> {
  /** Kurzname für Log und Bericht (nie Inhalt). */
  name: string;
  /** Gesundheitsdaten (Art. 9) — nur mit Einwilligung (a) der Person. */
  art9: boolean;
  inhalt: T;
  schreiben: (person: string, inhalt: T, tag: string) => Promise<'uebernommen' | 'schon-uebernommen' | 'ziel-belegt'>;
}
export interface UebernahmeBericht { lauf: boolean; grund?: string; teile: { name: string; ergebnis: TeilErgebnis }[] }

/** Teil „Körper-Profil“ — schreibt über die eine Stelle des Bestands (koerperAltbestandSetzen: nur leer, mit Marke). */
export function koerperTeil(inhalt: K.KoerperStand): AltbestandTeil<K.KoerperStand> {
  return {
    name: 'koerper',
    art9: true,
    inhalt,
    schreiben: async (person, k, tag) => (await import('@/lib/gesundheit/koerper-server')).koerperAltbestandSetzen(person, k, tag),
  };
}

/**
 * Die Übernahme. `teile` nur für Tests (erfundener Inhalt) — ohne Angabe der bisherige Inhalt unten. Die Person kommt
 * IMMER aus der Umgebungsvariable, nie aus einem Parameter. Wirft nie.
 */
export async function altbestandUebernehmen(opts: { teile?: AltbestandTeil[]; tag?: string } = {}): Promise<UebernahmeBericht> {
  const person = (process.env[ALTBESTAND_VARIABLE] ?? '').trim();
  if (!person) return { lauf: false, grund: 'keine Variable', teile: [] };
  if (process.env.MAKE_OS_DEMO === '1') return { lauf: false, grund: 'Demo-Instanz', teile: [] };
  if (!/^[a-z0-9-]{1,40}$/.test(person)) { console.error('[MAKE OS] Altbestand: Variable ungültig — nichts übernommen.'); return { lauf: false, grund: 'Variable ungültig', teile: [] }; }
  try {
    const { ladeKonten } = await import('@/lib/zugang/konten');
    const { istHauptInhaber } = await import('@/lib/zugang/inhaber');
    const st = await ladeKonten();
    const konto = st.konten.find(k => k.speicher === person);
    if (!konto) { console.error('[MAKE OS] Altbestand: kein Konto zur Variable — nichts übernommen.'); return { lauf: false, grund: 'kein Konto', teile: [] }; }
    // Zusätzliche Schranke: der Altbestand stammt aus dem Code des Inhabers — nur dessen Konto kann ihn bekommen. Eine falsch
    // gesetzte Variable (Speichername einer anderen Person) legt so nie Art.-9-Inhalte in ein fremdes Profil. Seit 09.10. (mehrere
    // Inhaber): nur der Haupt-Inhaber (lib/zugang/inhaber.ts) — ein weiterer Inhaber bekommt den Altbestand nie.
    if (konto.rolle !== 'inhaber' || !istHauptInhaber(st, person)) { console.error('[MAKE OS] Altbestand: die Variable nennt nicht den Inhaber — nichts übernommen.'); return { lauf: false, grund: 'nicht Inhaber', teile: [] }; }
  } catch {
    console.error('[MAKE OS] Altbestand: Konten nicht lesbar — nichts übernommen (läuft beim nächsten Start erneut).');
    return { lauf: false, grund: 'Konten nicht lesbar', teile: [] };
  }

  const { localDay } = await import('@/lib/zeit');
  const tag = opts.tag ?? localDay();
  const teile = opts.teile ?? altbestandTeile();
  const bericht: UebernahmeBericht = { lauf: true, teile: [] };
  for (const t of teile) {
    let ergebnis: TeilErgebnis;
    try {
      if (t.art9) {
        const { gesundheitVerarbeitungErlaubt } = await import('@/lib/datenschutz/gesundheit-einwilligung');
        if (!(await gesundheitVerarbeitungErlaubt(person))) { bericht.teile.push({ name: t.name, ergebnis: 'ohne-einwilligung' }); console.log(`[MAKE OS] Altbestand „${t.name}“: übersprungen — keine Einwilligung (a).`); continue; }
      }
      ergebnis = await t.schreiben(person, t.inhalt, tag);
    } catch (e) {
      ergebnis = 'fehler';
      console.error(`[MAKE OS] Altbestand „${t.name}“: Fehler —`, e instanceof Error ? e.name : 'unbekannt');
    }
    bericht.teile.push({ name: t.name, ergebnis });
    console.log(`[MAKE OS] Altbestand „${t.name}“: ${ergebnis}.`);
  }
  return bericht;
}

/** Die Teile mit dem bisherigen Inhalt (unten). */
export function altbestandTeile(): AltbestandTeil[] {
  return [koerperTeil(koerperAusAltbestand()) as AltbestandTeil];
}

// ── Der bisherige Inhalt — UNVERÄNDERT aus dem Code hierher verschoben (lib/make-one/health-data.ts, GesundheitView) ──
// Nicht ändern, nicht woanders verwenden: er geht genau einmal in die Daten der Person und wird dann gelöscht.
// Bewusst NICHT übernommen: die festen Zahlen je Eintrag (`sev` je Beschwerde, `score` je Hebel). Sie wurden nie angezeigt
// und waren Schätzwerte eines Tages — den Wert eines Hebels liefert jetzt live die Kennzahl des Gesundheits-Index, die
// Einschätzung einer Beschwerde steht im Ton. Wer sie braucht: Git-Historie dieser Datei.

const NORTHSTAR = 'Mehr Ruhe — den Körper planbar aufbauen, den Kopf runterfahren.';

// tone: 'good' (Stärke), 'watch' (dranbleiben), 'crit' (akut)
interface Beschwerde { name: string; sev: number; tone: 'good' | 'watch' | 'crit'; status: string; note: string; }
const BESCHWERDEN: Beschwerde[] = [
  { name: 'Schuppenflechte (Psoriasis)', sev: 70, tone: 'crit', status: 'aktiver Schub',
    note: 'Beine ~60 %, Rücken 3–4 Stellen, beide Ellbogen (links schlimmer). Zyklus: Anspannung → Kratzen → Juckreiz.' },
  { name: 'Bandscheibenvorfall', sev: 65, tone: 'crit', status: 'Reha-Phase',
    note: 'Diagnose bestätigt (30.07.), Spritze 31.07. Jetzt: Physio, Mobilität, wirbelsäulen-sicherer Aufbau in Stufen — kein Ego-Training.' },
  { name: 'Nagelpilz', sev: 25, tone: 'watch', status: 'klein',
    note: 'Hautarzt-Termin für Diagnose + Antimykotikum, dann dranbleiben bis weg.' },
  { name: 'Epilepsie', sev: 20, tone: 'good', status: 'anfallsfrei · stabil',
    note: 'Haupt-Trigger = Schlafmangel, gut gemanagt. Anfall kam nach ~12 Wochen Dauerstress → Warnsignal ernst nehmen.' },
];

interface Hebel { name: string; score: number; tone: 'good' | 'watch' | 'crit'; note: string; }
const HEBEL: Hebel[] = [
  { name: 'Ernährung', score: 38, tone: 'crit', note: 'Dein aktiver Hebel gegen Psoriasis: regelmäßig + anti-entzündlich (mediterran). Isst aktuell unregelmäßig.' },
  { name: 'Stress', score: 45, tone: 'crit', note: 'Der Master-Hebel — triggert Psoriasis UND Epilepsie. Anspannung früh bemerken statt aushalten.' },
  { name: 'Bewegung & Ergonomie', score: 55, tone: 'watch', note: 'Für die Bandscheibe: spine-safe Reha + Sitzpausen. Du bewegst dich mehr, als dein Selbstbild sagt.' },
  { name: 'Schlaf', score: 76, tone: 'good', note: 'STÄRKE — Ø 7,8 h, fest. Schützt die Epilepsie. Hebel ist Konstanz, nicht Erholungsfähigkeit.' },
  { name: 'Alkohol', score: 82, tone: 'good', note: 'Kein Thema — nur ~2×/Monat.' },
  { name: 'Cannabis-Cut', score: 40, tone: 'watch', note: 'Ziel: sauberer Ausstieg — mit dem Neurologen (Schlaf schützen, Anfallsschwelle). Ersatz für die Stress-Funktion aufbauen.' },
];

// Aufbau-Stufenplan (Kevins eigener Weg — NICHT Hyrox/Marathon, das ist Malin)
interface Stufe { phase: string; name: string; desc: string; state: 'now' | 'next' | 'later'; }
const AUFBAU: Stufe[] = [
  { phase: '0', name: 'Reha & Mobilität', desc: 'Nach der Spritze — schonen, Physio, Gehen, Mobilität', state: 'now' },
  { phase: '1', name: 'Core & Stabilität', desc: 'Rumpf aufbauen, wirbelsäulen-sicher', state: 'next' },
  { phase: '2', name: 'Kraft-Fundament', desc: '22 J. Handball & Kraft — zurück zur Basis', state: 'later' },
  { phase: '3', name: 'Conditioning · Navy', desc: 'Ausdauer & Kondition, „aus mir eine Maschine"', state: 'later' },
  { phase: '4', name: 'Boxen · Paddeln', desc: 'Kampf/Skill + Draußen, mit Team/Connect', state: 'later' },
];

// Zusammenhänge (was worauf wirkt) — für das „Ich sehe, warum"-Gefühl
const ZUSAMMENHAENGE = [
  'Stress ↑ → Kratzen → Psoriasis-Schub  (und: Stress ↑ → Epilepsie-Risiko ↑)',
  'Schlaf fest → Epilepsie stabil  (deine größte Schutz-Stärke)',
  'Unregelmäßig essen → Entzündung ↑ → Haut schlechter',
  'Bandscheibe → Bewegung spine-safe, kein Ego-Training — Aufbau in Stufen',
];

// Bis 23.09. stand hier noch „Morgen (31.07.) ist ein großer medizinischer
// Tag" — acht Wochen lang. Ein Satz mit Datum gehört nicht in eine Konstante.
const CARE_NOTE = 'Struktur & Tracking, keine ärztliche Beratung — deine Ärzte führen. Beim Cannabis-Schnitt: mit dem Neurologen, weil Schlaf deine Anfallsschwelle schützt.';

/** Welche Kennzahl des Gesundheits-Index hinter einem Hebel steht (26.09.). */
const HEBEL_KENNZAHL: Record<string, string> = { Ernährung: 'essen', Stress: 'stress', Bewegung: 'reha', Schlaf: 'schlaf', Cannabis: 'streak', Haut: 'haut' };

/** Name des Symptom-Reglers auf „Heute“ (vorher fest in der Ansicht). */
const SYMPTOM_NAME = "Haut · Juckreiz";
/** Satz unter einer Routine der Tagesliste (vorher fest in der Ansicht). */
const ROUTINE_HINWEIS = { routine: 'essen', text: 'dein Hebel gegen die Schübe' };

/** Kennzahl zu einem Hebel: genauer Name, sonst der Name beginnt mit dem Schlüssel (zwei Hebel tragen einen längeren Namen —
 *  die frühere Zuordnung fand sie nicht; die Übernahme setzt die gemeinte Kennzahl gleich richtig). */
export function hebelKennzahl(name: string): string | undefined {
  return HEBEL_KENNZAHL[name] ?? Object.entries(HEBEL_KENNZAHL).find(([k]) => name.startsWith(k))?.[1];
}

const TON_ALT: Record<string, K.KoerperTon> = { good: 'gut', watch: 'achtung', crit: 'kritisch' };
const ZUSTAND_ALT: Record<string, K.StufenZustand> = { now: 'jetzt', next: 'danach', later: 'spaeter' };

/** Der bisherige Inhalt in der Form des Körper-Profils (Symptom-Regler und Zähler AN — wie bisher für diese Person). */
function koerperAusAltbestand(): K.KoerperStand {
  return {
    v: 1,
    leitsatz: NORTHSTAR,
    beschwerden: BESCHWERDEN.map((b, i) => ({ id: `kb-alt-${i + 1}`, name: b.name, status: b.status, notiz: b.note, ton: TON_ALT[b.tone] ?? 'achtung' })),
    hebel: HEBEL.map((h, i) => { const kennzahl = hebelKennzahl(h.name); return { id: `kh-alt-${i + 1}`, name: h.name, notiz: h.note, ...(kennzahl ? { kennzahl } : {}) }; }),
    stufen: AUFBAU.map((s, i) => ({ id: `ks-alt-${i + 1}`, phase: s.phase, name: s.name, beschreibung: s.desc, zustand: ZUSTAND_ALT[s.state] ?? 'spaeter' })),
    zusammenhaenge: ZUSAMMENHAENGE.map((t, i) => ({ id: `kz-alt-${i + 1}`, text: t })),
    hinweis: CARE_NOTE,
    symptom: { name: SYMPTOM_NAME },
    sauberZaehler: true,
    routinenHinweise: [{ id: 'kr-alt-1', routine: ROUTINE_HINWEIS.routine, text: ROUTINE_HINWEIS.text }],
  };
}
