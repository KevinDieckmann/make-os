// ─── Lichtfäden · Seil — die Adapter (07.10.2026, rein, ohne Server-Importe) ────────────────────────────────────────────
// Aus den vorhandenen Beständen (schmal gefasst) wird der neutrale Eingang des Seil-Modells (seil.ts). Zwei Ebenen:
//   · `seilJahr`      — Planungsjahr: Seile = Ziele (Jahresziele im Fenster, Unterziele münden ein), Stränge = Meilensteine,
//                       Unterziele, Projekte mit Ziel und „Einzelne Karten“ (Aufgaben, die direkt einzahlen).
//   · `seilAufgaben`  — Aufgaben-Zeitstrahl: Stränge = Projekte bzw. Meilenstein-Listen, Karten = ihre Aufgaben; ein Projekt zahlt
//                       auf sein `zielId` ein, sonst auf das Ziel der meisten seiner Karten (wirksames Ziel `zielVonAufgabe`).
// Bezüge NUR über die EINEN Regeln: Ziel eines Meilensteins `zielVonMeilenstein`, Ziel einer Aufgabe `zielVonAufgabe`, Eltern-Ziel
// `zielEltern`, Space eines Ziels `spaceVonZiel`, Bereich einer Aufgabe `aufgabenBereich`. Verbindungen (Termine mit Aufgabe, Deals
// an Aufgaben) werden Marken am Strang ihrer Aufgabe — nichts wird kopiert oder gespeichert. Den Bereich filtert der Aufrufer
// (der Server, lib/lichtfaeden/seil-server.ts) — hier nur die Regel `imBereich`.

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { WEG } from '@/lib/wege';
import { MS_PROJEKT_PRAEFIX, meilensteinListeId, zielVonMeilenstein, istMeilensteinListe } from '@/lib/planung/meilenstein-aufgaben';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import { zielEltern, aufgabenBereich, planBereich } from '@/lib/planung/bezuege';
import { msListeKarte, zielVonAufgabe } from '@/lib/aufgaben/ziel-bezug';
import { spaceVonZiel } from './modell';
import type { KartenStatus, SeilEingang, SeilKarteRoh, SeilMarkeRoh, SeilStrangRoh, SeilZielRoh } from './seil';

export type SeilBereich = SpaceId | 'alle';
export const imBereich = (b: SeilBereich, s: SpaceId): boolean => b === 'alle' || b === s;

export interface QZiel {
  id: string; titel: string; farbe: string; horizont: string; space?: SpaceId; einheit?: string; rang?: number; termin?: string; jahr?: number;
  erledigt?: boolean; erledigtAm?: string; fortschritt: number; oberzielId?: string; abgeleitetVon?: string; archiviertAm?: string;
}
export interface QMeilenstein {
  id: string; titel: string; faellig?: string; erledigt: boolean; erledigtAm?: string; fortschritt: number; space?: SpaceId; bereich?: string;
  einheit?: string; zielId?: string; abgeleitetVon?: string; wartetAuf?: string[]; rang?: number; archiviertAm?: string;
}
export interface QAufgabe {
  id: string; title: string; status: string; priority?: string; dueDate?: string; startDate?: string; completedAt?: string;
  listeId?: string; projectId: string; spaceId?: string; space?: SpaceId; parentId?: string; zielId?: string; abhaengigVon?: string[];
  bezug?: { dealId?: string };
}
export interface QProjekt { id: string; title: string; spaceId?: string; start?: string; ende?: string; dueDate?: string; zielId?: string; status?: string; archived?: boolean; color?: string }
export interface QTermin { id: string; titel: string; tag: string; aufgabeId: string }
export interface QDeal { id: string; titel: string; erwartetAm?: string; offen: boolean }
export interface SeilDaten {
  heute: string; von: string; bis: string; bereich: SeilBereich;
  ziele: readonly QZiel[]; meilensteine: readonly QMeilenstein[]; aufgaben: readonly QAufgabe[]; projekte: readonly QProjekt[];
  termine?: readonly QTermin[]; deals?: readonly QDeal[];
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const tag = (v: unknown): string | undefined => (typeof v === 'string' && TAG.test(v.slice(0, 10)) ? v.slice(0, 10) : undefined);
const kartenStatus = (s: string): KartenStatus => (s === 'done' ? 'erledigt' : s === 'cancelled' ? 'abgebrochen' : 'offen');
const plusTage = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Karte aus einer Aufgabe. */
function karte(t: QAufgabe, strang: string): SeilKarteRoh {
  return {
    id: t.id, strang, titel: t.title, ...(tag(t.dueDate) ? { tag: tag(t.dueDate) } : {}), ...(tag(t.startDate) ? { start: tag(t.startDate) } : {}),
    status: kartenStatus(t.status), ...(t.status === 'done' && tag(t.completedAt) ? { erledigtAm: tag(t.completedAt) } : {}),
    ...(t.abhaengigVon?.length ? { wartetAuf: [...t.abhaengigVon] } : {}), link: WEG.aufgabe(t.id),
    ...(t.priority === 'high' || t.priority === 'critical' ? { dringend: true } : {}),
  };
}

/** Ziel → Eingang des Modells (Anker: Frist; Jahresziele ohne Frist am Jahresende; sonst ohne). */
function zielRoh(z: QZiel, nachId: ReadonlyMap<string, QZiel>, laufend: number): SeilZielRoh {
  const frist = tag(z.termin);
  const anker = frist ?? (z.horizont === 'jahr' ? `${zielJahr(z, laufend)}-12-31` : undefined);
  const eltern = zielEltern(z, nachId);
  return {
    id: z.id, titel: z.titel, farbe: z.farbe, ...(z.rang !== undefined ? { rang: z.rang } : {}), space: spaceVonZiel(z),
    ...(anker ? { anker, ankerArt: frist ? 'frist' as const : 'jahresende' as const } : {}),
    ...(z.erledigt ? { erledigt: true } : {}), ...(tag(z.erledigtAm) ? { erledigtAm: tag(z.erledigtAm) } : {}),
    fortschritt: z.erledigt ? 100 : z.fortschritt, ...(eltern ? { elternId: eltern } : {}), link: WEG.ziel(z.id),
  };
}

/** Verbindungen: Termine (mit Aufgabe) und Deals (an Aufgaben) als Marken am Strang ihrer Aufgabe. */
function marken(d: SeilDaten, strangVonAufgabe: ReadonlyMap<string, string>, aufgaben: ReadonlyMap<string, QAufgabe>): SeilMarkeRoh[] {
  const aus: SeilMarkeRoh[] = [];
  for (const t of d.termine ?? []) {
    const s = strangVonAufgabe.get(t.aufgabeId);
    if (s && tag(t.tag)) aus.push({ id: `termin:${t.id}`, strang: s, karte: t.aufgabeId, tag: tag(t.tag)!, art: 'termin', titel: t.titel });
  }
  const deals = new Map((d.deals ?? []).filter(x => x.offen && tag(x.erwartetAm)).map(x => [x.id, x]));
  const gesehen = new Set<string>();
  for (const [aid, s] of strangVonAufgabe) {
    const dealId = aufgaben.get(aid)?.bezug?.dealId;
    const deal = dealId ? deals.get(dealId) : undefined;
    if (!deal || gesehen.has(`${s}|${deal.id}`)) continue;
    gesehen.add(`${s}|${deal.id}`);
    aus.push({ id: `deal:${deal.id}:${s}`, strang: s, karte: aid, tag: tag(deal.erwartetAm)!, art: 'deal', titel: `Deal „${deal.titel}“ — erwarteter Abschluss`, link: WEG.aufgabe(aid) });
  }
  return aus;
}

/** Ziele, die das Modell braucht: die genannten samt ihrer Eltern-Kette (für die Wurzel). */
function mitEltern(ids: Iterable<string>, nachId: ReadonlyMap<string, QZiel>): Set<string> {
  const aus = new Set<string>();
  for (const id of ids) {
    let z = nachId.get(id);
    for (let i = 0; z && i < 16 && !aus.has(z.id); i++) { aus.add(z.id); const e = zielEltern(z, nachId); z = e ? nachId.get(e) : undefined; }
  }
  return aus;
}

// ── Planungsjahr ─────────────────────────────────────────────────────────────

/**
 * Planungsjahr: Jahresziele des Bereichs, deren Jahr das Fenster berührt (plus ihre Unterziele und abgeleiteten Ziele), nicht
 * archiviert. Stränge: Meilensteine (auch ohne Ziel → Bündel „Ohne Ziel“, wenn sie im Fenster fällig sind), Unterziele (von Hand),
 * Projekte mit eigenem Ziel, „Einzelne Karten“ je Ziel (Aufgaben, die direkt oder über eine Hauptaufgabe einzahlen).
 */
export function seilJahr(d: SeilDaten): SeilEingang {
  const laufend = Number(d.heute.slice(0, 4));
  const jahrVon = Number(d.von.slice(0, 4)), jahrBis = Number(d.bis.slice(0, 4));
  const aktiv = d.ziele.filter(z => !z.archiviertAm);
  const nachId = new Map(aktiv.map(z => [z.id, z]));
  const imFenster = (z: QZiel) => { const j = zielJahr(z, laufend); return j >= jahrVon && j <= jahrBis; };
  // Wurzeln (Jahresziele im Fenster, im Bereich) und alles, was darauf einzahlt.
  const wurzelIds = new Set(aktiv.filter(z => z.horizont === 'jahr' && !zielEltern(z, nachId) && imFenster(z) && imBereich(d.bereich, spaceVonZiel(z))).map(z => z.id));
  const drin = new Set(wurzelIds);
  for (let runde = 0; runde < 16; runde++) {
    let neu = false;
    for (const z of aktiv) { const e = zielEltern(z, nachId); if (e && drin.has(e) && !drin.has(z.id) && imBereich(d.bereich, spaceVonZiel(z))) { drin.add(z.id); neu = true; } }
    if (!neu) break;
  }
  const ziele = aktiv.filter(z => drin.has(z.id)).map(z => zielRoh(z, nachId, laufend));
  const straenge: SeilStrangRoh[] = [];
  const karten: SeilKarteRoh[] = [];
  const strangVonAufgabe = new Map<string, string>();
  const aufgabeNach = new Map(d.aufgaben.map(t => [t.id, t]));
  const projektNach = new Map(d.projekte.map(p => [p.id, p]));

  // Unterziele (von Hand) als Strang ihres Oberziels.
  for (const z of aktiv) {
    if (!drin.has(z.id) || !z.oberzielId || !drin.has(z.oberzielId)) continue;
    straenge.push({ id: `ziel:${z.id}`, art: 'unterziel', titel: z.titel, zielId: z.oberzielId, ...(tag(z.termin) ? { ende: tag(z.termin) } : {}), fortschritt: (z.erledigt ? 100 : z.fortschritt) / 100, ...(z.erledigt ? { erledigt: true } : {}), ...(tag(z.erledigtAm) ? { erledigtAm: tag(z.erledigtAm) } : {}), link: WEG.ziel(z.id), ...(z.rang !== undefined ? { rang: z.rang } : {}) });
  }
  // Meilensteine: mit Ziel im Seil; ohne Ziel (im Bereich, fällig im Fenster) im Bündel „Ohne Ziel“.
  const msDrin = new Set<string>();
  for (const m of d.meilensteine) {
    if (m.archiviertAm) continue;
    const zid = zielVonMeilenstein(m);
    const mitZiel = !!zid && drin.has(zid);
    const f = tag(m.faellig);
    // Bereich IMMER am Meilenstein selbst (ein Altbestand-Bezug über den Bereich hinweg verrät sonst seinen Titel).
    if (!imBereich(d.bereich, meilensteinSpace(m)) || (!mitZiel && (!f || f < d.von || f > d.bis))) continue;
    msDrin.add(m.id);
    straenge.push({
      id: `ms:${m.id}`, art: 'meilenstein', titel: m.titel, zielId: mitZiel ? zid! : null, ...(f ? { ende: f } : {}),
      fortschritt: m.erledigt ? 1 : Math.max(0, Math.min(1, m.fortschritt / 100)), ...(m.erledigt ? { erledigt: true } : {}), ...(tag(m.erledigtAm) ? { erledigtAm: tag(m.erledigtAm) } : {}),
      ...(m.wartetAuf?.length ? { wartetAuf: m.wartetAuf.map(w => `ms:${w}`) } : {}), link: WEG.meilenstein(m.id), ...(m.rang !== undefined ? { rang: m.rang } : {}),
    });
  }
  // Karten der Meilensteine (Hauptaufgaben ihrer Liste).
  const listeZuMs = new Map(d.meilensteine.filter(m => msDrin.has(m.id)).map(m => [meilensteinListeId(m.id), m.id]));
  for (const t of d.aufgaben) {
    const ms = t.listeId ? listeZuMs.get(t.listeId) : undefined;
    if (!ms || t.parentId || !imBereich(d.bereich, aufgabenBereich(t))) continue;
    karten.push(karte(t, `ms:${ms}`)); strangVonAufgabe.set(t.id, `ms:${ms}`);
  }
  // Projekte mit eigenem Ziel (offen, im Bereich).
  for (const p of d.projekte) {
    if (!p.zielId || !drin.has(p.zielId) || p.archived || p.status === 'abgeschlossen' || p.id.startsWith(MS_PROJEKT_PRAEFIX) || !imBereich(d.bereich, aufgabenBereich(p))) continue;
    straenge.push({ id: `projekt:${p.id}`, art: 'projekt', titel: p.title, zielId: p.zielId, ...(tag(p.start) ? { start: tag(p.start) } : {}), ...(tag(p.ende ?? p.dueDate) ? { ende: tag(p.ende ?? p.dueDate) } : {}), link: WEG.aufgaben({ s: p.spaceId, p: p.id }) });
    for (const t of d.aufgaben) {
      if (t.projectId !== p.id || t.parentId || (t.listeId && istMeilensteinListe(t.listeId)) || !imBereich(d.bereich, aufgabenBereich(t))) continue;
      karten.push(karte(t, `projekt:${p.id}`)); strangVonAufgabe.set(t.id, `projekt:${p.id}`);
    }
  }
  // „Einzelne Karten“: Aufgaben, die direkt (oder über ihre Hauptaufgabe) einzahlen und noch keinen Strang haben.
  const lebt = (id: string) => drin.has(id);
  const k = { msListe: msListeKarte(d.meilensteine), nachId: aufgabeNach, projekte: projektNach, lebt };
  const lose = new Map<string, QAufgabe[]>();
  for (const t of d.aufgaben) {
    if ((t.parentId && !aufgabeNach.has(t.parentId)) || !imBereich(d.bereich, aufgabenBereich(t))) continue;
    if (strangVonAufgabe.has(t.id) || (t.parentId && strangVonAufgabe.has(t.parentId))) continue;
    const w = zielVonAufgabe(t, k);
    if (!w || (w.ueber !== 'aufgabe' && w.ueber !== 'eltern')) continue;
    lose.set(w.zielId, [...(lose.get(w.zielId) ?? []), t]);
  }
  for (const [zid, l] of lose) {
    const id = `karten:${zid}`;
    straenge.push({ id, art: 'karten', titel: 'Einzelne Karten', zielId: zid });
    for (const t of l) { karten.push(karte(t, id)); strangVonAufgabe.set(t.id, id); }
  }
  return { heute: d.heute, von: d.von, bis: d.bis, ziele, straenge, karten, marken: marken(d, strangVonAufgabe, aufgabeNach) };
}

// ── Aufgaben-Zeitstrahl ──────────────────────────────────────────────────────

/**
 * Aufgaben-Zeitstrahl: je Projekt (des Bereichs) ein Strang, je Meilenstein-Liste einer (Titel des Meilensteins, dessen Ziel). Nur
 * Projekte/Listen mit mindestens einer Karte im Fenster (± 60 Tage Rand) oder offenen Karten ohne Datum. Ein Projekt zahlt auf sein
 * `zielId` ein, sonst auf das wirksame Ziel der Mehrheit seiner Karten — ohne beides ins Bündel „Ohne Ziel“.
 */
export function seilAufgaben(d: SeilDaten): SeilEingang {
  const laufend = Number(d.heute.slice(0, 4));
  // Ziele im Bereich (ein Ziel ohne Space ist gemeinsam und passt zu beiden) — andere gibt es für diese Sicht nicht.
  const aktiv = d.ziele.filter(z => { const b = planBereich(z); return !z.archiviertAm && (b === null || imBereich(d.bereich, b)); });
  const zielNach = new Map(aktiv.map(z => [z.id, z]));
  const aufgabeNach = new Map(d.aufgaben.map(t => [t.id, t]));
  const projektNach = new Map(d.projekte.map(p => [p.id, p]));
  const msNach = new Map(d.meilensteine.filter(m => !m.archiviertAm).map(m => [meilensteinListeId(m.id), m]));
  const lebt = (id: string) => zielNach.has(id);
  const k = { msListe: msListeKarte(d.meilensteine.filter(m => !m.archiviertAm)), nachId: aufgabeNach, projekte: projektNach, lebt };
  const randVon = plusTage(d.von, -60), randBis = plusTage(d.bis, 60);
  const relevant = (t: QAufgabe) => { const f = tag(t.dueDate); return f ? f >= randVon && f <= randBis : t.status !== 'done' && t.status !== 'cancelled'; };

  // Hauptaufgaben je Strang (Projekt oder Meilenstein-Liste), nur im Bereich.
  const je = new Map<string, QAufgabe[]>();
  for (const t of d.aufgaben) {
    if (t.parentId || !imBereich(d.bereich, aufgabenBereich(t))) continue;
    const s = t.listeId && msNach.has(t.listeId) ? `liste:${t.listeId}` : `projekt:${t.projectId}`;
    je.set(s, [...(je.get(s) ?? []), t]);
  }
  const straenge: SeilStrangRoh[] = [];
  const karten: SeilKarteRoh[] = [];
  const strangVonAufgabe = new Map<string, string>();
  const zieleNoetig = new Set<string>();
  for (const [s, l] of je) {
    if (!l.some(relevant)) continue;
    let zielId: string | null = null;
    let roh: Omit<SeilStrangRoh, 'zielId'>;
    if (s.startsWith('liste:')) {
      const m = msNach.get(s.slice(6))!;
      const z = zielVonMeilenstein(m);
      zielId = z && lebt(z) ? z : null;
      roh = { id: s, art: 'liste', titel: m.titel, ...(tag(m.faellig) ? { ende: tag(m.faellig) } : {}), ...(m.erledigt ? { erledigt: true, fortschritt: 1 } : {}), link: WEG.meilenstein(m.id) };
    } else {
      const p = projektNach.get(s.slice(8));
      if (!p || p.archived) continue;
      if (p.zielId && lebt(p.zielId)) zielId = p.zielId;
      else {
        // Mehrheit der wirksamen Ziele seiner Karten (mindestens die Hälfte).
        const zaehl = new Map<string, number>();
        for (const t of l) { const w = zielVonAufgabe(t, k); if (w) zaehl.set(w.zielId, (zaehl.get(w.zielId) ?? 0) + 1); }
        const best = [...zaehl].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        if (best && best[1] * 2 >= l.length) zielId = best[0];
      }
      roh = { id: s, art: 'projekt', titel: p.title, ...(tag(p.start) ? { start: tag(p.start) } : {}), ...(tag(p.ende ?? p.dueDate) ? { ende: tag(p.ende ?? p.dueDate) } : {}), link: WEG.aufgaben({ s: p.spaceId, p: p.id }) };
    }
    if (zielId) zieleNoetig.add(zielId);
    straenge.push({ ...roh, zielId });
    for (const t of l) { karten.push(karte(t, s)); strangVonAufgabe.set(t.id, s); }
  }
  const drin = mitEltern(zieleNoetig, zielNach);
  const ziele = aktiv.filter(z => drin.has(z.id)).map(z => zielRoh(z, zielNach, laufend));
  return { heute: d.heute, von: d.von, bis: d.bis, ziele, straenge, karten, marken: marken(d, strangVonAufgabe, aufgabeNach) };
}
