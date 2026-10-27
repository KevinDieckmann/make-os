// ─── MAKE OS — Social: Prüfer vor jeder Veröffentlichung (rein, Regelwerk ohne Modell) — 26.10.2026 ─────────────────────────────────
// SOCIAL_PLAN.md › 4: „Fällt ein Punkt durch, geht der Inhalt in den Stapel statt online.“ Zwei Stufen:
//   stopp    — so darf es nie raus (auch nicht per Klick, bis es behoben ist): Platzhalter `{{…}}` offen, kein Hook, Wörter aus „sagen wir nie“,
//              KI-Kanal behauptet Gefühle/Bewusstsein, fast gleich wie eine der letzten Folgen (YouTube „inauthentic content“).
//   mensch   — eine Person muss es sehen, bevor es rausgeht (bremst Stufe 2): Beratungsthemen Gesundheit/Finanzen/Recht, Zahlen oder Fälle
//              ohne Quelle, Angebot/Preis, Kritik an realen Personen/Firmen (Name + Wertung), Länge weit weg vom Format.
//   hinweis  — nur anzeigen: KI-Label setzen, CTA fehlt.
// Hinweis, keine Rechtsberatung. Die Wortlisten sind bewusst klein und sprechen beide Sprachen; ein Treffer heißt „anschauen“, nicht „verboten“.

import type { SocialFolge, SocialKanal, SocialFormat } from './typen';
import { ZIEL_MIT_LINIE } from './typen';

export type BefundStufe = 'stopp' | 'mensch' | 'hinweis';
export interface Befund { stufe: BefundStufe; code: string; text: string }

const klein = (s: string) => s.toLocaleLowerCase('de-DE');
const enthaeltWort = (hay: string, wort: string) => {
  const w = klein(wort).trim();
  if (!w) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(klein(hay));
};

/** Wörter, die auf Beratung in Gesundheit, Geld oder Recht hindeuten (YouTube: KI-Personas zu diesen Themen nicht monetarisierbar). */
const BERATUNG = [
  'diagnose', 'heilt', 'heilung', 'therapie', 'medikament', 'symptom', 'abnehmen garantiert', 'cure', 'diagnosis', 'medication', 'treatment',
  'investier', 'aktie', 'aktien', 'rendite', 'krypto', 'bitcoin', 'steuern sparen', 'steuertipp', 'invest in', 'stocks', 'crypto', 'returns', 'financial advice',
  'rechtsberatung', 'abmahnung', 'verklagen', 'anwalt sagt', 'legal advice', 'sue',
  // Fitness/Ernährung (Heilmittelwerberecht § 3 HWG: keine Heil- oder sicheren Erfolgsversprechen) — 27.10., Vorlage Sportler:in.
  'nahrungsergänzung', 'supplement', 'fatburner', 'entgiften', 'detox', 'garantiert abnehmen',
];
/** Eigenes Erlebnis in erster Person — bei einer Personenmarke bestätigt nur die Person selbst, dass es so war (der Agent erfindet nie ein „ich habe …“). */
const ICH_ERLEBNIS = /(^|[^\p{L}])(ich (habe|hab|hatte|war|bin gestern|bin letzte)|mir ist|letzte woche habe ich|bei mir war|mein(e|em|en)? (kunde|kundin|team|fehler|erster|erste|größter|größte)|i (have|had|was|did|made|learned|lost|built|failed)|my (client|team|first|biggest|mistake))([^\p{L}]|$)/iu;
/** KI-Hinweis in einer Bio (Art. 50 KI-VO, „Antworten teils von KI“). */
const KI_HINWEIS = /(\bKI\b|\bAI\b|künstlich|artificial|automatisiert|automated)/iu;
/** Angebot/Preis/Werbung → immer eine Person (Leitplanke). */
const ANGEBOT = /(\d[\d.,]*\s?(€|eur|euro|\$|usd)|(€|\$)\s?\d|\b(rabatt|gutschein|angebot|preis|kaufen|discount|coupon|price|buy now|promo code)\b)/iu;
/** KI-Kanal: keine Behauptung von Leben, Gefühl oder Bewusstsein. */
const KI_BEHAUPTUNG = /\b(i('| a)m (alive|conscious|sentient)|i (feel|felt) |my feelings|ich (bin lebendig|fühle)|bewusstsein habe|ich lebe)\b/iu;
/** Belegpflichtige Aussagen: Prozent, Jahreszahlen, große Zahlen, Geldbeträge. */
const BELEGPFLICHT = /(\d+([.,]\d+)?\s?(%|prozent|percent))|\b(19|20)\d{2}\b|\b\d{1,3}([.,]\d{3})+\b|\b\d+\s?(mio|millionen|million|milliarden|billion)\b/iu;
const PLATZHALTER = /\{\{[^}]*\}\}/;

/** Wörter → Menge der Dreiwort-Folgen (für die Ähnlichkeit). */
function dreier(s: string): Set<string> {
  const w = klein(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const m = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) m.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return m;
}
/** Jaccard-Ähnlichkeit zweier Skripte (0–1). */
export function aehnlichkeit(a: string, b: string): number {
  const x = dreier(a), y = dreier(b);
  if (!x.size || !y.size) return 0;
  let gleich = 0;
  for (const t of x) if (y.has(t)) gleich++;
  return gleich / (x.size + y.size - gleich);
}
export const AEHNLICH_STOPP = 0.5;

/** Gesprochene Länge grob aus der Wortzahl (≈ 2,5 Wörter je Sekunde). */
export const sekundenAus = (skript: string) => Math.round(skript.split(/\s+/).filter(Boolean).length / 2.5);

export interface PruefKontext {
  kanal: SocialKanal;
  format?: SocialFormat | null;
  /** Andere Folgen desselben Kanals (die jüngsten 20 werden verglichen). */
  andere: SocialFolge[];
}

export function folgePruefen(f: SocialFolge, k: PruefKontext): Befund[] {
  const b: Befund[] = [];
  const hookText = f.hooks.find(h => h.id === f.hookId)?.text ?? f.hooks[0]?.text ?? '';
  const alles = [f.titel, hookText, f.skript, f.cta ?? '', ...f.hooks.map(h => `${h.text} ${h.bildschirm ?? ''}`)].join('\n');

  if (!f.skript.trim()) b.push({ stufe: 'stopp', code: 'skript-leer', text: 'Das Skript ist leer.' });
  if (!f.hooks.length) b.push({ stufe: 'stopp', code: 'kein-hook', text: 'Kein Hook — die ersten Sekunden entscheiden, ob jemand bleibt.' });
  if (PLATZHALTER.test(alles)) b.push({ stufe: 'stopp', code: 'platzhalter', text: 'Offene Platzhalter {{…}} — erst echte Werte einsetzen. Nie geschätzte Zahlen.' });
  for (const w of k.kanal.marke.nieSagen) if (enthaeltWort(alles, w)) b.push({ stufe: 'stopp', code: 'nie-sagen', text: `„${w}“ steht auf der Liste „sagen wir nie“.` });
  if (k.kanal.kiKanal && KI_BEHAUPTUNG.test(alles)) b.push({ stufe: 'stopp', code: 'ki-behauptung', text: 'Die KI-Persona behauptet Gefühle oder Bewusstsein — das sagen wir nie.' });

  const vergleich = k.andere.filter(x => x.id !== f.id && x.kanalId === f.kanalId && x.status !== 'verworfen')
    .sort((x, y) => (y.geaendert ?? '').localeCompare(x.geaendert ?? '')).slice(0, 20);
  let max = 0, aehnlichste: SocialFolge | null = null;
  for (const x of vergleich) { const s = aehnlichkeit(f.skript, x.skript); if (s > max) { max = s; aehnlichste = x; } }
  if (aehnlichste && max >= AEHNLICH_STOPP) b.push({ stufe: 'stopp', code: 'wiederholung', text: `Fast gleich wie „${aehnlichste.titel}“ (${Math.round(max * 100)} %) — Plattformen werten Wiederholung ab.` });

  const beratung = BERATUNG.filter(w => enthaeltWort(alles, w));
  if (beratung.length) b.push({ stufe: 'mensch', code: 'beratung', text: `Klingt nach Beratung (${beratung.slice(0, 3).join(', ')}) — eine Person schaut drüber.` });
  if (ANGEBOT.test(alles)) b.push({ stufe: 'mensch', code: 'angebot', text: 'Angebot, Preis oder Werbung — geht nie ohne Person raus (und ist als Werbung zu kennzeichnen).' });
  if (BELEGPFLICHT.test(f.skript) && !f.quellen.length) b.push({ stufe: 'mensch', code: 'ohne-quelle', text: 'Zahlen oder Jahreszahlen ohne Quelle — Quelle eintragen oder Aussage entschärfen.' });
  const soll = !k.format?.art || k.format.art === 'video' ? k.format?.laengeSek : undefined;
  const ist = sekundenAus(f.skript);
  if (soll && f.skript.trim() && (ist > soll * 1.6 || ist < soll * 0.4)) b.push({ stufe: 'mensch', code: 'laenge', text: `Gesprochen etwa ${ist} s, das Format sieht ${soll} s vor.` });
  if (k.kanal.art === 'person' && ICH_ERLEBNIS.test(alles) && (!k.kanal.person || f.freigegebenVon !== k.kanal.person)) {
    b.push({ stufe: 'mensch', code: 'erlebnis', text: 'Erzählt ein eigenes Erlebnis — nur die Person der Marke bestätigt, dass es so war (ihre Freigabe).' });
  }
  if (f.personenImBild === 'offen') b.push({ stufe: 'mensch', code: 'personen', text: 'Erkennbare Personen im Bild — erst mit ihrer Einwilligung (KUG § 22, DSGVO).' });
  if (f.werbung) b.push({ stufe: 'mensch', code: 'werbung', text: 'Werbung oder Kooperation — geht nie ohne Person raus und wird beim Hochladen gekennzeichnet (§ 5a UWG).' });

  if (f.kiInhalt) b.push({ stufe: 'hinweis', code: 'ki-label', text: 'Beim Hochladen das KI-Label der Plattform setzen (KI-Bild oder KI-Stimme).' });
  if (!f.cta?.trim()) b.push({ stufe: 'hinweis', code: 'ohne-cta', text: 'Kein Aufruf am Ende (Kommentar, Speichern, Folgen).' });
  if (f.personenImBild === 'einwilligung') b.push({ stufe: 'hinweis', code: 'einwilligung', text: 'Einwilligung der gezeigten Personen ablegen — sie ist jederzeit widerruflich.' });
  return b;
}

/** Befunde, die eine Freigabe durch eine Person NICHT auflöst — sie bremsen auch eine freigegebene Folge. */
export const BLEIBT_NACH_FREIGABE: readonly string[] = ['erlebnis', 'personen'];

/**
 * Einrichtung eines Kanals (27.10.): was am Account selbst fehlt. „stopp“/„mensch“ bremsen die Stufe 2 für ALLE Folgen des Kanals
 * (autonomie.ts), „hinweis“ zeigt nur an. Hinweis, keine Rechtsberatung.
 */
export function kanalPruefen(k: SocialKanal): Befund[] {
  const b: Befund[] = [];
  if (!k.plattformen.length) b.push({ stufe: 'mensch', code: 'ohne-plattform', text: 'Noch keine Plattform gewählt.' });
  if (k.art === 'person' && !k.person) b.push({ stufe: 'mensch', code: 'ohne-person', text: 'Personenmarke ohne Person — wessen Marke ist das? Ohne sie gibt niemand frei.' });
  if (k.art === 'firma' && !k.gesellschaft) b.push({ stufe: 'mensch', code: 'ohne-absender', text: 'Firmenaccount ohne Gesellschaft — Absender und Impressum fehlen.' });
  else if (!k.gesellschaft) b.push({ stufe: 'hinweis', code: 'impressum', text: 'Absender fürs Impressum wählen — auch ein geschäftlicher Account ohne Gesicht braucht einen Impressum-Link in der Bio (§ 5 DDG).' });
  if (k.kiKanal && !KI_HINWEIS.test(k.marke.bio ?? '')) b.push({ stufe: 'mensch', code: 'ki-bio', text: 'Die Bio sagt nicht, dass hier eine KI spricht (Art. 50 KI-VO) — Instagram verlangt dafür auch das Label „KI-generiertes Profil“.' });
  else if (k.leitplanken.autonomie === 2 && !k.leitplanken.antwortenAus && !KI_HINWEIS.test(k.marke.bio ?? '')) b.push({ stufe: 'hinweis', code: 'antworten-ki', text: 'Antwortet der Agent selbst, gehört „Antworten teils von KI“ in die Bio (Art. 50 KI-VO).' });
  if (!k.ziele.length) b.push({ stufe: 'hinweis', code: 'ohne-ziel', text: 'Noch kein Ziel — ohne Ziel misst die Analyse nur gegen den eigenen Schnitt.' });
  else if (!k.ziele.some(z => (ZIEL_MIT_LINIE as readonly string[]).includes(z.metrik))) b.push({ stufe: 'hinweis', code: 'ohne-zahlziel', text: 'Kein Ziel mit Termin (Follower oder Aufrufe bis …) — nur Takt und Qualität.' });
  return b;
}

export const hatStopp = (b: Befund[]) => b.some(x => x.stufe === 'stopp');
export const brauchtMensch = (b: Befund[]) => b.some(x => x.stufe === 'stopp' || x.stufe === 'mensch');
