// ─── Lichtfäden v2 — alle Quellen serverseitig sammeln (03.10.2026) ─────────
// EINE Stelle, die liest (nie schreibt, nie ein Netzaufruf): je Bereich die vorhandene Lesefunktion, dann der reine
// Adapter aus quellen/*. Jede Quelle ist mit `sicher()` gekapselt — fehlt eine, fehlt sie einfach (wie Heute/Glocke).
// Danach die Personen-/Privat-Regel für den Betrachter (modell.ts `fuerBetrachter`): Private Stränge der ANDEREN Person
// werden zu anonymen „belegt“-Gewichten — ohne Titel, Link, Thema oder Ziel. Keine Personendaten in Logs.
// Gemerkt wird je Betrachter und Fenster (lib/store/memo.ts `merken`, ungültig bei jeder Schreibung, sonst 60 s).

import { loadJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { speicherFuer } from '@/lib/zoe/raum';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { WEG, eventLink } from '@/lib/wege';
import type { Meilenstein, RoutinenDatei } from '@/lib/planung/typen';
import { fuerBetrachter, knotenFuerBetrachter, type Knoten, type Strang } from './modell';
import { planungStraenge, KEINE_BEZUEGE, type PlanungErgebnis, type ZielBezuege } from './quellen/planung';
import { kalenderStraenge, type KalenderTermin } from './quellen/kalender';
import { markttraktionStraenge } from './quellen/markttraktion';
import { finanzStraenge } from './quellen/finanzen';
import { beziehungStraenge } from './quellen/beziehung';
import { gesundheitStraenge } from './quellen/gesundheit';
import { meilensteineFuerBetrachter, verborgeneZielIds, zieleFuerBetrachter } from '@/lib/planung/eigene-ziele-sicht';
import { lesbareEigentuemerFuer } from '@/lib/planung/eigene-ziele-sicht-server';

const sicher = async <T>(p: Promise<T> | (() => Promise<T>), sonst: T): Promise<T> => { try { return await (typeof p === 'function' ? p() : p); } catch { return sonst; } };
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

export interface Person { id: string; name: string }
export interface Sammlung {
  knoten: Knoten[]; straenge: Strang[]; personen: Person[];
  /** Kennung jedes Ziels → Kennung seines Wurzel-Ziels (Route: `wurzelAufloesen`). */
  zielWurzel: ReadonlyMap<string, string>;
}

/** Personen des Haushalts (Speichername + Anzeigename) — Reihenfolge: Inhaber zuerst. */
export async function haushaltsPersonen(): Promise<Person[]> {
  const h = await sicher(haushaltDesInhabers(), null);
  if (!h) return [];
  return (await sicher(kontenDesHaushalts(h), [])).map(k => ({ id: k.speicher, name: k.name }));
}

async function planung(heute: string, betrachter: string): Promise<PlanungErgebnis> {
  const [ziele, ms, aufgaben, lesbar] = await Promise.all([
    // Alle Ziele des Haushalts MIT Farbe — dieselbe Menge und Farbe wie GET /api/state/ziele (lib/planung/ziel-farben-server.ts).
    sicher(async () => (await import('@/lib/planung/ziel-farben-server')).haushaltsZiele(), []),
    sicher(loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'), null),
    sicher(async () => (await import('@/lib/aufgaben/sicht')).ladeAufgabenUngefiltert(), null),
    sicher(lesbareEigentuemerFuer(betrachter), new Set<string>()),
  ]);
  // Eigene Ziele der anderen Person (08.10., Kevin): nicht geteilt → gar nicht erst hinein (kein „Belegt“, auch ihre Meilensteine
  // nicht); geteilt → wie bisher als privat (Knoten weg, Stränge „Belegt“, `fuerBetrachter`).
  const verborgen = verborgeneZielIds(ziele, lesbar);
  return planungStraenge({ ziele: zieleFuerBetrachter(ziele, lesbar), meilensteine: meilensteineFuerBetrachter(ms?.meilensteine ?? [], verborgen), aufgaben: aufgaben?.tasks ?? [], projekte: aufgaben?.projects ?? [], heute });
}

async function kalender(person: string, von: string, bis: string, heute: string): Promise<Strang[]> {
  const [{ termineFuerZoe }, { spaceVonKalender }, { istGesundheitsTermin }] = await Promise.all([
    import('@/lib/kalender/zoe-sicht-server'), import('@/lib/kalender/space'), import('@/lib/kalender/zoe-sicht'),
  ]);
  const k = await termineFuerZoe(person, von, tagPlus(bis, 1));
  const termine: KalenderTermin[] = [...k.termine, ...k.kemaris].map(t => ({
    id: t.id, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags, art: t.art, sichtbarkeit: t.sichtbarkeit,
    wer: t.wer, space: k.kemaris.includes(t) ? 'business' : spaceVonKalender(k.einstellungen, t.kalender),
    gesundheit: !t.maskiert && istGesundheitsTermin(t), ...(t.maskiert ? { maskiert: true } : {}), ...(t.abgesagt ? { abgesagt: true } : {}),
    ...(t.bezug ? { bezug: t.bezug } : {}),
    // Microsoft-365-Spiegel (KEMARIS): Kennung `m365-<Position>` — kein Termin dahinter, den ein Link öffnen könnte.
    ...(k.kemaris.includes(t) ? { ohneLink: true } : {}),
  }));
  return kalenderStraenge({ termine, heute });
}

async function markttraktion(bis: string, heute: string, bezuege: ZielBezuege): Promise<Strang[]> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }, { faellige }, { OFFENE_STUFEN }] = await Promise.all([
    import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung'), import('@/lib/crm/followup'), import('@/lib/crm/pipeline'),
  ]);
  const crm = await ladeCrm();
  const kontakte = await sicher(kontakteFuerVerarbeitung(), []);
  const followups = faellige(kontakte, crm, heute, { horizont: Math.max(0, Math.min(800, tageZwischen(heute, bis))), wertelisten: crm.wertelisten });
  return markttraktionStraenge({
    heute, bezuege,
    followups: followups.map(f => ({ id: f.id, text: f.text, name: f.name, faellig: f.faellig, zustaendig: f.zustaendig, kontaktId: f.kontaktId, bezug: f.bezug })),
    deals: crm.chancen.map(c => ({ id: c.id, titel: c.titel, erwartetAm: c.erwartetAm, offen: OFFENE_STUFEN.includes(c.stufe), besitzer: c.besitzer, firmaId: c.firmaId })),
    events: crm.events.map(e => ({ id: e.id, titel: e.titel, datum: e.datum, bisDatum: e.bisDatum, status: e.status, zustaendig: e.zustaendig, link: eventLink(e), firmaId: e.fuer?.art === 'kunde' ? e.fuer.firmaId : undefined })),
  });
}

async function finanzen(heute: string, bezuege: ZielBezuege): Promise<Strang[]> {
  const h = await sicher(haushaltDesInhabers(), null);
  const [plan, posten, belege, steuer] = await Promise.all([
    sicher(loadJson<{ zahlungen?: { id: string; titel: string; faellig?: string; status: string; firmaId?: string }[]; rechnungen?: { id: string; titel: string; faellig?: string; datum?: string; status: string; firmaId?: string; mandatId?: string }[] }>('finanzplan'), null),
    h ? sicher(async () => (await (await import('@/lib/finanzen/plan/speicher')).ladeFinanzplan(h))?.posten ?? [], []) : Promise.resolve([]),
    h ? sicher(async () => (await (await import('@/lib/finanzen/haushalt/speicher')).ladeHaushalt(h)).belege, []) : Promise.resolve([]),
    sicher(async () => {
      const [{ ladeSteuerEinstellungenMitPlan: ladeSteuerEinstellungen, STEUERN }, { fristen }] = await Promise.all([import('@/lib/steuern/speicher'), import('@/lib/steuern/rechnen')]);
      const [e, d] = await Promise.all([ladeSteuerEinstellungen(), loadJson<{ abgehakt?: Record<string, unknown> }>(STEUERN)]);
      return fristen(e, heute, d?.abgehakt ?? {}).map(f => ({ id: f.id, datum: f.datum, einheit: f.einheit, titel: f.titel, erledigt: f.erledigt, href: f.href }));
    }, []),
  ]);
  return finanzStraenge({ zahlungen: plan?.zahlungen ?? [], rechnungen: plan?.rechnungen ?? [], posten, belege: belege.map(b => ({ id: b.id, bezeichnung: b.bezeichnung, faellig_am: b.faellig_am, einheit: b.einheit, erledigt: b.erledigt })), steuer, heute, bezuege });
}

async function beziehung(person: string, von: string, bis: string, heute: string): Promise<Strang[]> {
  const h = await sicher(haushaltDesInhabers(), null);
  if (!h) return [];
  const [{ familieName }, { sichtFuer }, { geburtstageIm }] = await Promise.all([
    import('@/lib/familie/speicher'), import('@/lib/familie/logik'), import('@/lib/kalender/quellen-geburtstage-server'),
  ]);
  const [fam, geb] = await Promise.all([
    // Nur lesen (ladeFamilie legte bei fehlender Datei einen Start-Bestand an).
    sicher(loadJson<import('@/lib/familie/typen').Familie>(familieName(h)), null),
    geburtstageIm({ von, bis: tagPlus(bis, 1) }, person, { nur: 'privat' }),
  ]);
  const nurIch = (x: { sichtbarkeit?: string }) => x.sichtbarkeit === 'nur-ich';
  return beziehungStraenge({
    von, bis, heute, link: '/os/familie',
    geburtstage: geb.map(g => ({ id: g.id, name: g.name, tag: g.tag, zustaendig: g.zustaendig, href: g.href })),
    tage: sichtFuer(fam?.tage ?? [], person).map(t => ({ id: t.id, titel: t.titel, art: t.art, datum: t.datum, wer: t.wer, von: t.von, nurIch: nurIch(t), erledigt: t.erledigt ?? [] })),
    dates: sichtFuer(fam?.dates ?? [], person).map(x => ({ id: x.id, titel: x.titel, datum: x.datum, status: x.status, planer: x.planer, von: x.von, nurIch: nurIch(x) })),
    vereinbarungen: sichtFuer(fam?.vereinbarungen ?? [], person).map(v => ({ id: v.id, text: v.text, faellig: v.faellig, status: v.status, wer: v.wer, von: v.von, nurIch: nurIch(v) })),
  });
}

async function gesundheit(personen: readonly Person[], heute: string): Promise<Strang[]> {
  const [r, sport] = await Promise.all([
    sicher(loadJson<RoutinenDatei>('routinen'), null),
    Promise.all(personen.map(p => sicher(loadJson<{ ziele?: { id: string; titel: string; datum?: string; erledigt?: boolean }[] }>(speicherFuer('sport', p.id)), null).then(s => ({ person: p.id, ziele: s?.ziele ?? [] })))),
  ]);
  return gesundheitStraenge({ routinen: r?.routinen ?? [], sport, heute, links: { routinen: WEG.routinen(), sport: WEG.sport() } });
}

/**
 * Alle Stränge des Haushalts für den Betrachter im Fenster [von, bis] (inkl. Glättungsrand: 8 Wochen davor/danach),
 * plus die Knoten (Ziele, Meilensteine) und die Personen. Privat-Regel schon angewandt.
 */
export async function straengeSammeln(betrachter: string, von: string, bis: string, heute: string): Promise<Sammlung> {
  const randVon = tagPlus(von, -56), randBis = tagPlus(bis, 56);
  const personen = await haushaltsPersonen();
  const plan = await sicher(planung(heute, betrachter), { knoten: [], straenge: [], bezuege: KEINE_BEZUEGE, zielWurzel: new Map<string, string>() });
  const teile = await Promise.all([
    sicher(kalender(betrachter, randVon, randBis, heute), []),
    sicher(markttraktion(randBis, heute, plan.bezuege), []),
    sicher(finanzen(heute, plan.bezuege), []),
    sicher(beziehung(betrachter, randVon, randBis, heute), []),
    sicher(gesundheit(personen, heute), []),
  ]);
  const straenge = [...plan.straenge, ...teile.flat()].map(s => fuerBetrachter(s, betrachter));
  return { knoten: knotenFuerBetrachter(plan.knoten, betrachter), straenge, personen, zielWurzel: plan.zielWurzel };
}

/** Gemerkt je Betrachter, Fenster und Tag (60 s; jede Schreibung in einen Bestand macht es ungültig). */
export function straengeGemerkt(betrachter: string, von: string, bis: string, heute: string): Promise<Sammlung> {
  return merken(`lichtfaeden:${betrachter}:${von}:${bis}:${heute}`, 60_000, () => straengeSammeln(betrachter, von, bis, heute));
}
