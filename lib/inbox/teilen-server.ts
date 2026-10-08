// ─── Inbox teilen — Team-Postfächer und gemeinsamer Zustand (Server, 08.10.2026, Lücke 6) ─────────────────────────────
// Ein IMAP-Postfach mit Business-Bereich kann sein Besitzer „mit dem Team teilen“ (`Postfach.geteilt`). Dann:
//   · sehen es alle Konten des Haushalts mit Zugang zum Bereich in IHREM Strom — die Sicht entscheidet EINE Stelle
//     (`postfachSichtbar`, lib/inbox/teilen.ts), angewendet hier beim Einsammeln (`geteiltePostfaecherFuer`) und beim Auflösen
//     einer Kennung (`postfachAufloesen`). Es gibt keinen Parameter für eine andere Person: alles kommt aus der Sitzung.
//   · bleiben Zugang (Passwort), Abgleich und Senden beim Besitzer (sein Register, sein Spiegel) — gesendet wird ALS das Postfach,
//     die sendende Person steht im Änderungsprotokoll.
//   · liegt der Zustand der Gespräche (Wiedervorlage, erledigt, Zuordnung, „wer kümmert sich“) GEMEINSAM im Bestand
//     `inbox-geteilt--<haushalt>` (Stand je Gespräch → 409). WhatsApp nutzt denselben Bestand nur für „wer kümmert sich“.
// Teilen an/aus zieht den bisherigen Zustand des Besitzers mit (`teilenUmschalten`), nichts geht verloren.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { kontenImHaushaltDerInhaber, haushaltDerInhaber } from '@/lib/zugang/inhaber';
import { ladePostfaecher } from '@/lib/postfach/register';
import type { Postfach } from '@/lib/postfach/typen';
import { aendereInboxZustand, ladeInboxZustand } from './zustand';
import { postfachSichtbar, postfachTeilbar, standVon, TeilenFehler, TEAM_GRENZEN, type Betrachter, type TeamZustand } from './teilen';
import type { GespraechZustand } from './strom';

const HAUSHALT_OK = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PERSON_OK = /^[a-z0-9-]{1,40}$/;

export interface TeamPerson extends Betrachter { name: string }

/** Die Konten im Haushalt des Inhabers (dieselbe Regel wie `personImHaushaltDesInhabers`) mit Vornamen und Finanzrecht. */
export async function teamPersonen(): Promise<TeamPerson[]> {
  return kontenImHaushaltDerInhaber(await ladeKonten())
    .map(k => ({ speicher: k.speicher, name: (k.name ?? '').split(/\s+/)[0] || k.speicher, ...(k.finanzRecht === 'business' ? { finanzRecht: 'business' as const } : {}) }));
}

/** Haushalt, unter dem die gemeinsamen Bestände liegen (der des Inhabers; ohne Eintrag ein fester Ersatz). */
export async function teamHaushalt(): Promise<string> {
  const h = haushaltDerInhaber(await ladeKonten());
  return h && HAUSHALT_OK.test(h) ? h : 'haupt';
}

// ── Team-Postfächer ─────────────────────────────────────────────────────────

export interface FremdesPostfach { postfach: Postfach; besitzer: string; besitzerName: string }

/** Team-Postfächer ANDERER Personen, die `person` sehen darf (Haushalt + `postfachSichtbar`). */
export async function geteiltePostfaecherFuer(person: string, team?: TeamPerson[]): Promise<FremdesPostfach[]> {
  if (!PERSON_OK.test(person)) return [];
  const t = team ?? await teamPersonen();
  const ich = t.find(x => x.speicher === person);
  if (!ich) return [];
  const raus: FremdesPostfach[] = [];
  for (const andere of t) {
    if (andere.speicher === person) continue;
    for (const p of await ladePostfaecher(andere.speicher)) if (p.geteilt && postfachSichtbar(p, andere.speicher, ich)) raus.push({ postfach: p, besitzer: andere.speicher, besitzerName: andere.name });
  }
  return raus;
}

/** Ein Postfach zu einer Kennung — das eigene oder ein sichtbares Team-Postfach. `geteilt`: der Zustand liegt gemeinsam. */
export async function postfachAufloesen(person: string, id: string): Promise<{ postfach: Postfach; besitzer: string; besitzerName?: string; geteilt: boolean } | null> {
  const eigen = (await ladePostfaecher(person)).find(p => p.id === id);
  if (eigen) return { postfach: eigen, besitzer: person, geteilt: !!eigen.geteilt && postfachTeilbar(eigen) };
  const f = (await geteiltePostfaecherFuer(person)).find(x => x.postfach.id === id);
  return f ? { postfach: f.postfach, besitzer: f.besitzer, besitzerName: f.besitzerName, geteilt: true } : null;
}

/** Wer ein Team-Postfach sieht (für „wer kümmert sich“): Besitzer + alle mit `postfachSichtbar`. */
export function personenMitBlick(p: Pick<Postfach, 'quelle' | 'bereich' | 'geteilt'>, besitzer: string, team: readonly TeamPerson[]): TeamPerson[] {
  return team.filter(t => postfachSichtbar(p, besitzer, t));
}

// ── Gemeinsamer Zustand ─────────────────────────────────────────────────────

interface GeteiltDatei { v: 1; gespraeche: Record<string, TeamZustand> }
export const geteiltName = (haushalt: string) => `inbox-geteilt--${haushalt}`;
const leer = (): GeteiltDatei => ({ v: 1, gespraeche: {} });

export async function ladeGeteilt(): Promise<Record<string, TeamZustand>> {
  const d = await loadJson<GeteiltDatei>(geteiltName(await teamHaushalt()));
  return d && d.v === 1 && d.gespraeche && typeof d.gespraeche === 'object' ? d.gespraeche : {};
}

/** Stand-Konflikt (409): der aktuelle Zustand geht mit zurück. */
export class TeamKonflikt extends TeilenFehler {
  constructor(public aktuell: { stand: string; zustand: TeamZustand | null }) { super('Jemand hat das gerade geändert — bitte die neue Fassung ansehen.', 409); }
}

/** Den gemeinsamen Bestand ändern (EINE Sperre). Grenzen → 413, nie still gekürzt. */
async function aendereGeteilt(mutate: (g: Record<string, TeamZustand>) => Record<string, TeamZustand>): Promise<Record<string, TeamZustand>> {
  let raus: Record<string, TeamZustand> = {};
  let fehler: Error | null = null;
  await updateJson<GeteiltDatei>(geteiltName(await teamHaushalt()), cur => {
    const basis = cur && cur.v === 1 && cur.gespraeche ? cur : leer();
    try {
      const neu = mutate({ ...basis.gespraeche });
      if (Object.keys(neu).length > TEAM_GRENZEN.gespraeche) throw new TeilenFehler('Zu viele gemerkte Team-Gespräche — bitte alte Wiedervorlagen erledigen.', 413);
      raus = neu;
      return { v: 1, gespraeche: neu };
    } catch (e) { fehler = e as Error; return basis; }
  });
  if (fehler) throw fehler;
  return raus;
}

/**
 * Ein Feld des gemeinsamen Zustands setzen (bzw. mit `null` entfernen). `stand`: nur ändern, wenn der Eintrag noch so aussieht
 * (sonst `TeamKonflikt`, 409). Leere Einträge fallen weg.
 */
export async function teamZustandSetzen(id: string, teil: { [K in keyof TeamZustand]?: TeamZustand[K] | null }, stand?: string): Promise<{ zustand: TeamZustand | null; stand: string }> {
  let ergebnis: TeamZustand | null = null;
  await aendereGeteilt(g => {
    const alt = g[id];
    if (stand !== undefined && standVon(alt) !== stand) throw new TeamKonflikt({ stand: standVon(alt), zustand: alt ?? null });
    const neu = { ...(alt ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(teil)) { if (v === null) delete neu[k]; else if (v !== undefined) neu[k] = v; }
    if (Object.keys(neu).length) { g[id] = neu as TeamZustand; ergebnis = g[id]; } else { delete g[id]; ergebnis = null; }
    return g;
  });
  return { zustand: ergebnis, stand: standVon(ergebnis ?? undefined) };
}

/** Alle Einträge eines Postfachs (Präfix der Gesprächs-Kennungen) entfernen — Trennen, Teilen aus, Konto löschen. Liefert sie. */
export async function teamOhnePostfach(praefix: string): Promise<Record<string, TeamZustand>> {
  const vorher = await ladeGeteilt();
  if (!Object.keys(vorher).some(k => k.startsWith(praefix))) return {};
  let weg: Record<string, TeamZustand> = {};
  await aendereGeteilt(g => {
    weg = Object.fromEntries(Object.entries(g).filter(([k]) => k.startsWith(praefix)));
    return Object.fromEntries(Object.entries(g).filter(([k]) => !k.startsWith(praefix)));
  });
  return weg;
}

/**
 * Teilen an/aus — der Zustand wandert mit (nichts geht verloren):
 *   an   die Einträge des Besitzers (`inbox-zustand--<besitzer>`, Präfix `im~<postfach>~`) gehen in den gemeinsamen Bestand
 *        (vorhandene gemeinsame gewinnen) und fallen beim Besitzer weg
 *   aus  die gemeinsamen gehen zurück zum Besitzer (ohne „wer kümmert sich“ — das gibt es allein nicht) und fallen gemeinsam weg
 */
export async function teilenUmschalten(besitzer: string, postfach: string, an: boolean): Promise<void> {
  const praefix = `im~${postfach}~`;
  if (an) {
    const eigen = Object.entries((await ladeInboxZustand(besitzer)).gespraeche).filter(([k]) => k.startsWith(praefix));
    if (!eigen.length) return;
    await aendereGeteilt(g => { for (const [k, v] of eigen) if (!g[k]) g[k] = v; return g; });
    await aendereInboxZustand(besitzer, z => ({ ...z, gespraeche: Object.fromEntries(Object.entries(z.gespraeche).filter(([k]) => !k.startsWith(praefix))) }));
    return;
  }
  const gemeinsam = await ladeGeteilt();
  const eintraege = Object.entries(gemeinsam).filter(([k]) => k.startsWith(praefix));
  if (!eintraege.length) return;
  await aendereInboxZustand(besitzer, z => {
    const gespraeche = { ...z.gespraeche };
    for (const [k, v] of eintraege) { const { kuemmert: _k, ...rest } = v; if (Object.keys(rest).length && !gespraeche[k]) gespraeche[k] = rest as GespraechZustand; }
    return { ...z, gespraeche };
  });
  await teamOhnePostfach(praefix);
}

/** Konto löschen (Art. 17): „wer kümmert sich“ der Person fällt weg, ihre Team-Postfächer verlieren den gemeinsamen Zustand. Liefert die Zahl. */
export async function teamOhnePerson(speicher: string, postfaecher: readonly string[]): Promise<number> {
  const vorher = await ladeGeteilt();
  const praefixe = postfaecher.map(id => `im~${id}~`);
  const betroffen = Object.entries(vorher).filter(([k, v]) => praefixe.some(p => k.startsWith(p)) || v.kuemmert?.person === speicher || v.kuemmert?.von === speicher).length;
  if (!betroffen) return 0;
  await aendereGeteilt(g => {
    const raus: Record<string, TeamZustand> = {};
    for (const [k, v] of Object.entries(g)) {
      if (praefixe.some(p => k.startsWith(p))) continue;
      if (v.kuemmert?.person === speicher) { const { kuemmert: _k, ...rest } = v; if (Object.keys(rest).length) raus[k] = rest; continue; }
      // Wer es gesetzt hat, ist nur ein Vermerk — die Kennung wird getilgt, die Zuständigkeit der anderen Person bleibt.
      raus[k] = v.kuemmert?.von === speicher ? { ...v, kuemmert: { ...v.kuemmert, von: '[gelöscht]' } } : v;
    }
    return raus;
  });
  return betroffen;
}
