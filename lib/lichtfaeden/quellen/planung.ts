// ─── Lichtfäden-Quelle: Planung (Ziele, Meilensteine, Aufgaben, Projekte) — rein ─
// Liefert neben den Strängen auch die unteren Knoten des Baums: je Ziel ein Knoten unter seinem Thema, je Meilenstein
// einer unter seinem Ziel (bzw. unter dem Thema, wenn er keinem Ziel gehört). Zuordnung über die vorhandenen Bezüge:
//   Aufgabe → Liste ihres Meilensteins (`meilensteinListeId`) → Meilenstein → Ziel (`zielVonMeilenstein`) → Thema → Space.
//   Aufgabe ohne Meilenstein → Thema „Ziele & Planung“ bzw. „Mandate“ (Mandanten-Space) ihres Space.
//   Ziel-Thema, Meilenstein-Thema, Space ohne Angabe, Wurzel-Ziel: je EINE Regel aus modell.ts (`zielThema`,
//   `meilensteinThema`, `spaceVonZiel`, `zielWurzeln`) — dieselben nutzt der Ziel-Bezug der Seiten.
//   Abgeleitete Ziele (Kaskade) gehören ihrem Jahresziel (`abgeleitetVon`), sie werden kein eigener Knoten; die Route
//   rechnet `ziel:<abgeleitet>` über `zielWurzel` auf das Jahresziel um.
// Farbe je Ziel: NICHT hier gerechnet — sie kommt fertig vom Server (`farbe`, lib/planung/ziel-farben-server.ts, über alle
// Ziele des Haushalts), damit Lichtfäden, Ziel-Chips und Ziel-Bezug dieselbe Farbe zeigen.

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { meilensteinListeId, zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';
import { WEG } from '@/lib/wege';
import { nurIchBesitzer } from '@/lib/aufgaben/sicht';
import type { AufgabenSichtbarkeit } from '@/types/tasks';
import { abstufen } from '../baum';
import {
  BEIDE, SPACE_FADEN, gewichtVon, istWurzelZiel, knotenId, meilensteineJeWurzel, meilensteinThema, spaceVonZiel, statusVon, tagAus,
  themaPfad, zielThema, zielWurzeln, type Knoten, type Strang, type ThemaId,
} from '../modell';

export interface PlanungZiel {
  id: string; titel: string; space?: SpaceId; rang?: number; termin?: string; erledigt?: boolean;
  abgeleitetVon?: string; mandatId?: string; firmaId?: string;
  /** Wem das Ziel gehört: gemeinsame Ziele BEIDE, eigene Ziele die Person. */
  person: string;
  /** Die Ziel-Farbe vom Server (`zielFarben` über alle Ziele des Haushalts). */
  farbe: string;
}
export interface PlanungMeilenstein {
  id: string; titel: string; faellig?: string; erledigt?: boolean; space?: SpaceId; bereich?: string;
  zielId?: string; abgeleitetVon?: string; mandatId?: string; firmaId?: string; rang?: number;
}
export interface PlanungAufgabe {
  id: string; title: string; status: string; priority?: string; dueDate?: string; assignee?: string;
  sichtbarkeit?: AufgabenSichtbarkeit; angelegtVon?: string; listeId?: string; spaceId?: string; space?: SpaceId;
  /** Elternaufgabe — „nur ich“ vererbt sich über die ganze Kette (lib/aufgaben/sicht.ts `nurIchBesitzer`). */
  parentId?: string;
}
export interface PlanungProjekt {
  id: string; title: string; ende?: string; dueDate?: string; spaceId?: string; category?: string; owner?: string;
  archived?: boolean; status?: string; geloeschtAm?: string; archiviertAm?: string;
}
export interface PlanungDaten { ziele: PlanungZiel[]; meilensteine: PlanungMeilenstein[]; aufgaben: PlanungAufgabe[]; projekte: PlanungProjekt[]; heute: string }
/** Pfade für Bezüge anderer Quellen (Deal/Rechnung/Mandat → Ziel mit derselben Firma bzw. demselben Mandat). */
export interface ZielBezuege { firma: ReadonlyMap<string, string[]>; mandat: ReadonlyMap<string, string[]> }
export interface PlanungErgebnis {
  knoten: Knoten[]; straenge: Strang[]; bezuege: ZielBezuege;
  /** Kennung jedes Ziels → Kennung seines Wurzel-Ziels (für `wurzelAufloesen` in der Route). */
  zielWurzel: ReadonlyMap<string, string>;
}

const personVon = (v: string | undefined): string => (!v || v === 'both' || v === BEIDE ? BEIDE : v);
const spaceAusAufgabe = (a: Pick<PlanungAufgabe, 'spaceId' | 'space'>): SpaceId => (a.spaceId ? (a.spaceId === 'privat' ? 'privat' : 'business') : a.space ?? 'business');
const themaAusSpaceId = (spaceId: string | undefined): ThemaId => (spaceId?.startsWith('m-') ? 'mandate' : 'planung');

export function planungStraenge(d: PlanungDaten): PlanungErgebnis {
  const knoten: Knoten[] = [];
  const straenge: Strang[] = [];
  const nachId = new Map(d.ziele.map(z => [z.id, z]));
  const zielWurzel = zielWurzeln(d.ziele);
  /** Das Wurzel-Ziel (Jahresziel) eines Ziels. */
  const wurzelZiel = (id: string | undefined): PlanungZiel | undefined => (id ? nachId.get(zielWurzel.get(id) ?? '') : undefined);
  const msVonZiel = meilensteineJeWurzel(zielWurzel, d.meilensteine);

  // Ziel-Knoten: nur Wurzel-Ziele, Farbe vom Server.
  const wurzeln = d.ziele.filter(z => istWurzelZiel(zielWurzel, z.id))
    .sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.titel.localeCompare(b.titel, 'de') || a.id.localeCompare(b.id));
  const zielPfad = new Map<string, string[]>();
  const bezFirma = new Map<string, string[]>(), bezMandat = new Map<string, string[]>();
  wurzeln.forEach((z, i) => {
    const pfad = [...themaPfad(spaceVonZiel(z), zielThema(z, msVonZiel.get(z.id) ?? [])), knotenId.ziel(z.id)];
    zielPfad.set(z.id, pfad);
    if (!z.erledigt) {
      if (z.firmaId && !bezFirma.has(z.firmaId)) bezFirma.set(z.firmaId, pfad);
      if (z.mandatId && !bezMandat.has(z.mandatId)) bezMandat.set(z.mandatId, pfad);
    }
    knoten.push({ id: knotenId.ziel(z.id), art: 'ziel', name: z.titel, farbe: z.farbe, eltern: pfad[pfad.length - 2], rang: z.rang ?? 1000 + i, link: WEG.ziel(z.id) });
  });

  // Ziel-Fristen: nur wo kein Kaskaden-Meilenstein die Frist vertritt (wie v1).
  const mitKaskade = new Set(d.meilensteine.map(m => m.abgeleitetVon).filter(Boolean));
  for (const z of d.ziele) {
    const tag = tagAus(z.termin);
    const w = wurzelZiel(z.id);
    if (!tag || !w || mitKaskade.has(z.id) || z.abgeleitetVon) continue;
    straenge.push({ id: `ziel:${z.id}`, quelle: 'ziel', titel: z.titel, pfad: zielPfad.get(w.id)!, person: z.person, zeit: { tag }, gewicht: gewichtVon('ziel', { erledigt: !!z.erledigt }), status: statusVon(!!z.erledigt, tag, d.heute), link: WEG.ziel(z.id) });
  }

  // Meilensteine: Knoten unter ihrem Ziel (sonst unter dem Thema), Strang an ihrem eigenen Knoten.
  const msPfad = new Map<string, string[]>();
  const msNachListe = new Map<string, string>();
  const msZaehler = new Map<string, number>();
  const sortiert = [...d.meilensteine].sort((a, b) => (a.faellig ?? '9').localeCompare(b.faellig ?? '9') || a.id.localeCompare(b.id));
  for (const m of sortiert) {
    const z = wurzelZiel(zielVonMeilenstein(m));
    const space: SpaceId = m.space ?? (m.bereich === 'business' ? 'business' : m.bereich === 'gesundheit' ? 'privat' : z ? spaceVonZiel(z) : 'business');
    const oben = z ? zielPfad.get(z.id)! : themaPfad(space, meilensteinThema(m));
    const pfad = [...oben, knotenId.meilenstein(m.id)];
    msPfad.set(m.id, pfad);
    msNachListe.set(meilensteinListeId(m.id), m.id);
    const eltern = oben[oben.length - 1];
    const j = msZaehler.get(eltern) ?? 0;
    msZaehler.set(eltern, j + 1);
    knoten.push({ id: knotenId.meilenstein(m.id), art: 'meilenstein', name: m.titel, farbe: abstufen(z?.farbe ?? SPACE_FADEN[space], j), eltern, rang: j, link: WEG.meilenstein(m.id) });
    const tag = tagAus(m.faellig);
    if (tag) straenge.push({ id: `ms:${m.id}`, quelle: 'meilenstein', titel: m.titel, pfad, person: z?.person ?? BEIDE, zeit: { tag }, gewicht: gewichtVon('meilenstein', { erledigt: !!m.erledigt }), status: statusVon(!!m.erledigt, tag, d.heute), link: WEG.meilenstein(m.id) });
  }

  // Aufgaben: nur terminierte, offene (erledigte/abgebrochene binden nichts mehr). „nur ich“ — an der Aufgabe ODER an
  // einem Vorfahren — macht den Strang privat für genau die Anlegerin (dieselbe Regel wie alle Lesepfade, `darfSehen`);
  // lässt sich niemand bestimmen (Altaufgabe ohne Anlegerin, widersprüchliche Kette), fällt der Strang ganz weg.
  const aufgabeNachId = new Map(d.aufgaben.map(a => [a.id, a]));
  for (const a of d.aufgaben) {
    const tag = tagAus(a.dueDate);
    if (!tag || a.status === 'done' || a.status === 'cancelled') continue;
    const besitzer = nurIchBesitzer(a, aufgabeNachId);
    if (besitzer === null) continue;
    const msId = a.listeId ? msNachListe.get(a.listeId) : undefined;
    const pfad = msId ? msPfad.get(msId)! : themaPfad(spaceAusAufgabe(a), themaAusSpaceId(a.spaceId));
    straenge.push({
      id: `aufgabe:${a.id}`, quelle: 'aufgabe', titel: a.title, pfad, person: besitzer ?? personVon(a.assignee), zeit: { tag },
      gewicht: gewichtVon('aufgabe', { dringend: a.priority === 'high' || a.priority === 'critical' }), status: statusVon(false, tag, d.heute),
      link: WEG.aufgabe(a.id), ...(besitzer !== undefined ? { privat: true } : {}),
    });
  }

  // Projekt-Enden: offene Projekte mit Ende (sonst Deadline).
  for (const p of d.projekte) {
    const tag = tagAus(p.ende ?? p.dueDate);
    if (!tag || p.archived || p.geloeschtAm || p.archiviertAm || p.status === 'abgeschlossen') continue;
    const space: SpaceId = p.spaceId ? (p.spaceId === 'privat' ? 'privat' : 'business') : p.category === 'business' ? 'business' : 'privat';
    straenge.push({ id: `projekt:${p.id}`, quelle: 'projekt', titel: p.title, pfad: themaPfad(space, themaAusSpaceId(p.spaceId)), person: p.category === 'joint' || !p.owner ? BEIDE : personVon(p.owner), zeit: { tag }, gewicht: gewichtVon('projekt'), status: statusVon(false, tag, d.heute), link: p.spaceId ? WEG.aufgaben({ s: p.spaceId, p: p.id }) : WEG.aufgaben() });
  }

  return { knoten, straenge, bezuege: { firma: bezFirma, mandat: bezMandat }, zielWurzel };
}

/** Leere Bezüge (für Quellen, die ohne Planung laufen). */
export const KEINE_BEZUEGE: ZielBezuege = { firma: new Map(), mandat: new Map() };
