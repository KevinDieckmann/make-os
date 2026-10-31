// ─── Funde — der Abendlauf (Research-Agent „Homepage-Funde“, nur Server) ───────────────────────────────────────────────────
// Fester Ablauf statt freiem Agenten (wie die Heads): OSM fragen (EIN Gebiet je Abend, reihum) → Bekanntes, Ketten, Kartei-Firmen und
// Sperrliste aussortieren → Website prüfen (ohne KI) → nur „schlecht“ oder „keine“ wird ein Fund → Vorschau-Texte über das KI-Tor (sonst
// Regelwerk) → Mail-Entwurf aus der Vorlage → je Fund EIN Vorschlag im ZOE-Stapel (Art `fund`). Es wird NICHTS versendet und nichts in die
// Kartei geschrieben — das geschieht erst bei der Freigabe (lib/funde/uebernehmen.ts).
// Takt: ab 20 Uhr, einmal je Tag, nur mit aktiver Kampagne und Gebieten (lib/zoe/takt.ts, `KI_LAEUFE` → ohne Hintergrund-KI kein Lauf).

import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { ladeCrm } from '@/lib/crm/speicher';
import { betriebBekannt, type BetriebKandidat } from '@/lib/crm/betrieb';
import { betriebGesperrt } from '@/lib/crm/betrieb-sperre';
import { sperrlisteLaden, sperrTreffer } from '@/lib/crm/sperrliste';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { alleAdressen } from '@/lib/crm/emails';
import { aendereFunde, fundeHaushalt, ladeFunde } from './speicher';
import { osmBranche, osmHolen, type OsmRoh } from './osm';
import { bewerten, eigeneWebsite, fremdeUnterseite, websiteNormal } from './bewertung';
import { seitePruefen, pagespeed } from './web';
import { vorschauAusKi, vorschauPrompt, vorschauRegelwerk } from './vorschau';
import { entwurfBauen } from './entwurf';
import { fundKontext } from './kontext';
import { telefonFelder } from './telefon';
import { niveauBerechnen, unterNiveau, type AnalyseMerkmale } from './analyse';
import { BEDARF_AB, PLAYBOOK_ID, type Fund, type FundBewertung } from './typen';

export const FUNDE_LAUF = 'funde';
/** Höchstens so lange je Lauf (PageSpeed kann je Seite bis 60 s brauchen). */
const LAUF_MS = 8 * 60_000;
/** Höchstens so viele Websites prüfen je Fund, der am Ende herauskommt (gute Seiten fallen heraus). */
const PRUEF_FAKTOR = 4;

export interface LaufErgebnis { ok: boolean; grund?: string; gebiet?: string; geholt: number; vorbereitet: number; ohneKi?: string }

/** Ist heute ein Lauf dran? (Takt fragt das; ein Fehler = nein.) */
export async function fundeFaellig(jetzt = new Date()): Promise<boolean> {
  const b = await ladeFunde();
  const e = b.einstellungen;
  if (!e.kampagneId || !e.stadt || !e.gebiete.length || !e.branchen.length) return false;
  if (b.lauf?.tag === localDay(jetzt)) return false;
  const k = (await ladeCrm()).kampagnen.find(x => x.id === e.kampagneId);
  if (!k || k.status !== 'aktiv' || k.geloeschtAm || k.archiviertAm) return false;
  const { resolveAgent } = await import('@/lib/agent-config');
  return (await resolveAgent(FUNDE_LAUF)).enabled;
}

/** Ein Fund bzw. Rohfund als Betrieb (Schlüssel OSM-ID → Domain → Name + Adresse, lib/crm/betrieb.ts) — gleicher Name an anderer Adresse = anderer Betrieb. */
export const alsBetrieb = (x: { id?: string; name: string; osmId?: string; adresse?: BetriebKandidat['adresse']; website?: string | null; email?: string }): BetriebKandidat & { id: string } =>
  ({ id: x.id ?? x.osmId ?? x.name, name: x.name, ...(x.osmId ? { osmId: x.osmId } : {}), ...(x.adresse ? { adresse: x.adresse } : {}), ...(x.website ? { webseite: x.website } : {}), ...(x.email ? { email: x.email } : {}) });

/** Vorschau-Texte: Modell über das KI-Tor (Hintergrund, Kategorie crm), sonst Regelwerk. */
async function vorschauFuer(f: Fund, person: string | null): Promise<{ v: Fund['vorschau']; ohneKi?: string }> {
  const { askJson, hasAnthropicKey } = await import('@/lib/anthropic');
  if (!hasAnthropicKey()) return { v: vorschauRegelwerk(f), ohneKi: 'kein Schlüssel' };
  const p = vorschauPrompt(f);
  const r = await askJson<unknown>({
    zweck: 'funde-vorschau', system: p.system, user: p.user, maxTokens: 1200, timeoutMs: 60_000,
    // Kategorie crm: Name/Ort eines Betriebs (bei Einzelunternehmen personenbezogen). Kein Pseudonym nötig — kein Kartei-Kontakt im Prompt.
    ki: { lauf: 'hintergrund', person, kategorien: ['crm'], anzahl: 1 },
  });
  if (!r.ok) return { v: vorschauRegelwerk(f), ohneKi: r.error ?? 'KI nicht verfügbar' };
  return { v: vorschauAusKi(f, r.data) };
}

/**
 * Ein Lauf. `person` = wer ihn von Hand anstößt (null = Takt, Systemlauf). Schreibt Funde, das nächste Gebiet und den Laufstand; legt je
 * vorbereitetem Fund einen Vorschlag in den Stapel (für die Person bzw. ohne Person — den sieht der Haushalt).
 */
export async function fundeLauf(o: { person: string | null; jetzt?: Date; holen?: typeof osmHolen } = { person: null }): Promise<LaufErgebnis> {
  const start = Date.now();
  const jetzt = o.jetzt ?? new Date();
  const heute = localDay(jetzt), am = jetzt.toISOString();
  const h = await fundeHaushalt();
  const b = await ladeFunde(h);
  const e = b.einstellungen;
  if (!e.kampagneId) return { ok: false, grund: 'Keine Kampagne eingerichtet (Markttraktion › Marketing › Homepage-Funde).', geholt: 0, vorbereitet: 0 };
  if (!e.stadt || !e.gebiete.length) return { ok: false, grund: 'Keine Stadt/Gebiete eingestellt.', geholt: 0, vorbereitet: 0 };
  const gebiet = e.gebiete[e.gebietIndex % e.gebiete.length];
  const holen = o.holen ?? osmHolen;

  // 1 · OSM je Branche (nacheinander — schont die öffentliche Instanz).
  const roh: OsmRoh[] = [];
  let fehler: string | undefined;
  for (const br of e.branchen) {
    if (!osmBranche(br)) continue; // Start-ups: kein OSM-Profil
    try { for (const x of await holen(e.stadt, gebiet, br)) if (!roh.some(y => y.osmId === x.osmId)) roh.push(x); }
    catch (err) { fehler = err instanceof Error ? err.message.slice(0, 200) : 'OpenStreetMap nicht erreichbar.'; }
  }

  // 2 · Aussortieren: schon bekannt (Fund, verworfen, gesperrt), Betrieb steht schon in der Kartei (OSM-ID/Domain/Name + Adresse — nie nur der
  //     Name, 01.11.), Betrieb oder Adresse auf der Sperrliste.
  const [crm, kontakte, sperre] = await Promise.all([ladeCrm(), kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), sperrlisteLaden()]);
  const bekannt = new Set([...b.bekannt, ...b.funde.map(f => f.osmId).filter((x): x is string => !!x)]);
  const adressen = new Set(kontakte.flatMap(k => alleAdressen(k)));
  const fundBetriebe = b.funde.map(alsBetrieb);
  const kartei = crm.firmen.filter(f => !f.geloeschtAm);
  const kandidaten = roh.filter(r => {
    if (e.arten?.length && !e.arten.includes(r.kategorie ?? '')) return false; // Persona: nur diese Arten
    const k = alsBetrieb(r);
    if (bekannt.has(r.osmId) || betriebBekannt(fundBetriebe, k)) return false;
    if (betriebBekannt(kartei, k)) return false;
    if (r.email && adressen.has(r.email)) return false;
    // Sperrliste: Betriebs-Merkmale (OSM-ID, Domain, Name + Adresse) und die Adresse als Personen-Merkmal.
    if (betriebGesperrt(sperre, k) || sperrTreffer(sperre, { firma: r.name, ...(r.email ? { email: r.email } : {}) } as never)) return false;
    return true;
  });

  // 3 · Prüfen und vorbereiten — höchstens `jeAbend` Funde, höchstens LAUF_MS.
  const ctx = await fundKontext(e, h);
  const neu: Fund[] = [];
  const gut: string[] = [];
  let ohneKi: string | undefined;
  let geprueft = 0;
  for (const r of kandidaten) {
    if (neu.length >= e.jeAbend || geprueft >= e.jeAbend * PRUEF_FAKTOR || Date.now() - start > LAUF_MS) break;
    geprueft++;
    const site = websiteNormal(r.website);
    if (fremdeUnterseite(site)) { gut.push(r.osmId); continue; } // Teil eines Hauses mit eigener Website (Hotel, Museum …)
    const eigen = eigeneWebsite(site);
    let merkmale: AnalyseMerkmale | null = null, lcpMs: number | undefined;
    const signale = eigen && site ? await seitePruefen(site, { name: r.name, merkmale: m => { merkmale = m; } }) : null;
    const ps = eigen && site && signale?.erreichbar ? await pagespeed(site, { lcp: ms => { lcpMs = ms; } }) : null;
    const bew: FundBewertung = bewerten({ website: eigen, signale, pagespeed: ps, jahrHeute: Number(heute.slice(0, 4)), gemessenAm: am });
    // Erreichbare Seite: zusätzlich gegen UNSER Niveau (Gäste-Funktionen, Auffindbarkeit, Recht) — „unter Niveau“ ist auch ein Fund (31.10.).
    const analyse = merkmale ? { ...niveauBerechnen(merkmale, { ...(lcpMs != null ? { leistung: { lcpMs, quelle: 'pagespeed' as const } } : {}), jahrHeute: Number(heute.slice(0, 4)), gemessenAm: am }), ...(lcpMs != null ? { leistung: { lcpMs, quelle: 'pagespeed' } } : {}) } : undefined;
    if (bew.punkte < BEDARF_AB && !(analyse && unterNiveau(analyse))) { gut.push(r.osmId); continue; }
    const email = r.email ?? signale?.email;
    if (e.nurMitMail && !email) continue; // Persona: ohne veröffentlichte Mail-Adresse kein Fund (nicht „bekannt“ — die Mail kann später dazukommen)
    const nummern = telefonFelder(r.telefon, signale?.telefon);
    if (e.nurMitTelefon && !nummern.mobil && !nummern.telefon) continue; // Persona: ohne veröffentlichte Nummer kein Fund
    const f: Fund = {
      id: neueKennung('fd'), kampagneId: e.kampagneId, quelle: 'osm', osmId: r.osmId, name: r.name, branche: r.branche,
      ...(r.kategorie ? { kategorie: r.kategorie } : {}), ...(r.adresse ? { adresse: r.adresse } : {}), gebiet,
      ...(r.oeffnungszeiten ? { oeffnungszeiten: r.oeffnungszeiten } : {}), ...(site ? { website: site } : {}),
      ...(email && !adressen.has(email) ? { email } : {}), ...nummern,
      bewertung: bew, ...(analyse ? { analyse } : {}), status: 'neu', angelegt: am, geaendert: am,
    };
    const vs = await vorschauFuer(f, o.person);
    if (vs.ohneKi) ohneKi = vs.ohneKi;
    f.vorschau = vs.v;
    f.entwurf = entwurfBauen(f, ctx);
    f.status = 'vorbereitet';
    neu.push(f);
  }

  // 4 · Speichern (gute Seiten als „bekannt“ — sie kommen nie wieder), dann je Fund ein Vorschlag.
  await aendereFunde(x => ({
    ...x, funde: [...x.funde, ...neu], bekannt: [...new Set([...x.bekannt, ...gut])],
    einstellungen: { ...x.einstellungen, gebietIndex: (x.einstellungen.gebietIndex + 1) % Math.max(1, x.einstellungen.gebiete.length) },
    lauf: { tag: heute, gebiet, geholt: roh.length, neu: kandidaten.length, vorbereitet: neu.length, ...(fehler ? { fehler } : {}), am },
  }), { h, wer: o.person ? { art: 'person', person: o.person } : { art: 'system' } });
  const { fundVorschlagLegen } = await import('./uebernehmen');
  for (const f of neu) await fundVorschlagLegen(f, o.person).catch(err => console.error('[funde] Vorschlag nicht gelegt:', err instanceof Error ? err.message.slice(0, 120) : err));
  return { ok: !fehler || roh.length > 0, ...(fehler && !roh.length ? { grund: fehler } : {}), gebiet, geholt: roh.length, vorbereitet: neu.length, ...(ohneKi ? { ohneKi } : {}) };
}

export { PLAYBOOK_ID };
