// ─── Lichtfäden · Seil — serverseitig sammeln (07.10.2026) ───────────────────────────────────────────────────────────────
// EINE Stelle, die liest (nie schreibt, nie ein Netzaufruf): Ziele (geteilter Bestand, mit Farbe vom Server), Meilensteine,
// Aufgaben IN DER SICHT DER PERSON (`ladeAufgabenSicht` — fremde „nur ich“-Aufgaben, Papierkorb und Archiv kommen gar nicht erst an),
// Termine mit Aufgabe (`termineFuerZoe` — maskierte Termine der anderen Person ohne Titel bleiben draußen) und offene Deals, wenn eine
// Aufgabe einen nennt. Dann die reinen Adapter (seil-quellen.ts) und das Modell (seil.ts).
// Bereich SERVERSEITIG: `bereich` aus der Anfrage (privat | business | alle); ein Konto mit `finanzRecht: 'business'` bekommt IMMER
// nur Business (`planZugangFuer`) — Privates verlässt den Server nicht. Eigene Ziele einer Person (`ziele-eigen--…`) gehören nicht
// hinein (Bezüge gehen nur auf geteilte Ziele). Gemerkt je Person, Ebene, Bereich, Fenster und Tag (60 s, ungültig bei jeder Schreibung).

import { loadJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import type { Meilenstein } from '@/lib/planung/typen';
import { BEIDE } from './modell';
import { meilensteineFuerBetrachter, verborgeneZielIds } from '@/lib/planung/eigene-ziele-sicht';
import { lesbareEigentuemerFuer } from '@/lib/planung/eigene-ziele-sicht-server';
import { seilRechnen, type SeilAnsicht } from './seil';
import { seilAufgaben, seilJahr, type QDeal, type QTermin, type SeilBereich, type SeilDaten } from './seil-quellen';

const sicher = async <T>(p: () => Promise<T>, sonst: T): Promise<T> => { try { return await p(); } catch { return sonst; } };
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export type SeilEbene = 'jahr' | 'aufgaben';

/** Welcher Bereich gilt für die Person? Konten ohne Privatzugang immer Business. */
export async function seilBereichFuer(person: string, gewuenscht: SeilBereich): Promise<SeilBereich> {
  const { planZugangFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  const z = await sicher(() => planZugangFuer(person), null);
  return z?.sicht === 'business' ? 'business' : gewuenscht;
}

/** Alle Daten für das Seil — gelesen mit den vorhandenen Lesewegen. */
export async function seilDatenLaden(person: string, bereich: SeilBereich, von: string, bis: string, heute: string): Promise<SeilDaten> {
  const [{ haushaltsZiele }, { ladeAufgabenSicht }] = await Promise.all([import('@/lib/planung/ziel-farben-server'), import('@/lib/aufgaben/sicht')]);
  const [ziele, ms0, aufgaben, lesbar] = await Promise.all([
    sicher(haushaltsZiele, []),
    sicher(() => loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'), null),
    sicher(() => ladeAufgabenSicht(person), null),
    sicher(() => lesbareEigentuemerFuer(person), new Set<string>()),
  ]);
  // Altbestand (08.10., Kevin „eigene Ziele nur geteilt“): Meilensteine, die noch an einem nicht geteilten eigenen Ziel der anderen
  // Person hängen, kommen gar nicht erst hinein (lib/planung/eigene-ziele-sicht.ts).
  const ms = ms0 ? { ...ms0, meilensteine: meilensteineFuerBetrachter(ms0.meilensteine ?? [], verborgeneZielIds(ziele, lesbar)) } : null;
  const tasks = aufgaben?.tasks ?? [];
  const ids = new Set(tasks.map(t => t.id));
  // Termine mit Aufgabe (nur die eigenen bzw. gemeinsamen — maskierte bleiben draußen).
  const termine: QTermin[] = await sicher(async () => {
    const { termineFuerZoe } = await import('@/lib/kalender/zoe-sicht-server');
    const k = await termineFuerZoe(person, tagPlus(von, -1), tagPlus(bis, 1));
    return k.termine
      .filter(t => !t.maskiert && !t.abgesagt && !!t.bezug?.aufgabeId && ids.has(t.bezug.aufgabeId))
      .map(t => ({ id: t.id, titel: t.titel, tag: String(t.start).slice(0, 10), aufgabeId: t.bezug!.aufgabeId! }));
  }, []);
  // Deals nur, wenn eine Aufgabe einen nennt (Markttraktion bleibt ein eigenes Modul — nur gelesen).
  const deals: QDeal[] = tasks.some(t => t.bezug?.dealId) ? await sicher(async () => {
    const [{ ladeCrm }, { OFFENE_STUFEN }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/pipeline')]);
    const crm = await ladeCrm();
    return crm.chancen.map(c => ({ id: c.id, titel: c.titel, erwartetAm: c.erwartetAm, offen: OFFENE_STUFEN.includes(c.stufe) }));
  }, []) : [];
  return {
    heute, von, bis, bereich,
    ziele: ziele.filter(z => z.person === BEIDE).map(z => ({
      id: z.id, titel: z.titel, farbe: z.farbe, horizont: z.horizont, space: z.space, einheit: z.einheit, rang: z.rang, termin: z.termin, jahr: z.jahr,
      erledigt: z.erledigt, erledigtAm: z.erledigtAm, fortschritt: z.fortschritt, oberzielId: z.oberzielId, abgeleitetVon: z.abgeleitetVon, archiviertAm: z.archiviertAm,
    })),
    meilensteine: (ms?.meilensteine ?? []).map(m => ({
      id: m.id, titel: m.titel, faellig: m.faellig, erledigt: !!m.erledigt, erledigtAm: m.erledigtAm, fortschritt: m.fortschritt, space: m.space, bereich: m.bereich,
      einheit: m.einheit, zielId: m.zielId, abgeleitetVon: m.abgeleitetVon, wartetAuf: m.wartetAuf, rang: m.rang, archiviertAm: m.archiviertAm,
    })),
    aufgaben: tasks.map(t => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, startDate: t.startDate, completedAt: t.completedAt, listeId: t.listeId,
      projectId: t.projectId, spaceId: t.spaceId, space: t.space, parentId: t.parentId, zielId: t.zielId, abhaengigVon: t.abhaengigVon, ...(t.bezug?.dealId ? { bezug: { dealId: t.bezug.dealId } } : {}),
    })),
    projekte: (aufgaben?.projects ?? []).map(p => ({ id: p.id, title: p.title, spaceId: p.spaceId, start: p.start, ende: p.ende, dueDate: p.dueDate, zielId: p.zielId, status: p.status, archived: p.archived, color: p.color })),
    termine, deals,
  };
}

/** Die Seil-Ansicht einer Ebene (gemerkt). */
export function seilAnsichtFuer(o: { person: string; ebene: SeilEbene; bereich: SeilBereich; von: string; bis: string; heute: string }): Promise<SeilAnsicht> {
  return merken(`seil:${o.person}:${o.ebene}:${o.bereich}:${o.von}:${o.bis}:${o.heute}`, 60_000, async () => {
    const d = await seilDatenLaden(o.person, o.bereich, o.von, o.bis, o.heute);
    return seilRechnen(o.ebene === 'jahr' ? seilJahr(d) : seilAufgaben(d));
  });
}
