// ─── Lichtfäden-Quelle: Familie & Beziehung — rein ──────────────────────────
// Privat › Familie & Beziehung. Eingang (vom Server, schon mit `sichtFuer` gefiltert — „nur ich“-Einträge der anderen
// Person kommen gar nicht an; eigene „nur ich“ tragen `privat`):
//   · Geburtstage (Familie) aus `geburtstageIm(…, { nur: 'privat' })` — je Vorkommen im Fenster, DIE Quelle für Geburtstage.
//   · Wichtige Tage außer Geburtstagen (Jahrestag, Gedenktag, Sonstiges): jedes Vorkommen im Fenster (MM-TT jährlich,
//     ein volles Datum einmal).
//   · Dates (geplant; stattgefunden leise), Vereinbarungen (offen, mit Fälligkeit).

import { BEIDE, gewichtVon, statusVon, tagAus, themaPfad, type Strang } from '../modell';

export interface BzGeburtstag { id: string; name: string; tag: string; zustaendig?: string; href: string }
export interface BzTag { id: string; titel: string; art: string; datum: string; wer?: string; von: string; nurIch?: boolean; erledigt: number[] }
export interface BzDate { id: string; titel: string; datum: string; status: string; planer?: string; nurIch?: boolean; von: string }
export interface BzVereinbarung { id: string; text: string; faellig: string | null; status: string; wer?: string }
export interface BeziehungDaten { geburtstage: BzGeburtstag[]; tage: BzTag[]; dates: BzDate[]; vereinbarungen: BzVereinbarung[]; von: string; bis: string; heute: string; link: string }

const PFAD = themaPfad('privat', 'beziehung');
const person = (v: string | undefined) => (!v || v === BEIDE || v === 'gemeinsam' ? BEIDE : v);

/** Alle Vorkommen eines wichtigen Tages im Fenster (MM-TT jährlich, JJJJ-MM-TT einmal). */
export function vorkommen(datum: string, von: string, bis: string): string[] {
  if (/^\d{4}-\d{2}-\d{2}$/.test(datum)) return datum >= von && datum <= bis ? [datum] : [];
  const m = /^(\d{2})-(\d{2})$/.exec(datum);
  if (!m) return [];
  const aus: string[] = [];
  for (let j = Number(von.slice(0, 4)); j <= Number(bis.slice(0, 4)); j++) {
    const t = `${j}-${m[1]}-${m[2]}`;
    if (tagAus(t) && t >= von && t <= bis) aus.push(t);
  }
  return aus;
}

export function beziehungStraenge(d: BeziehungDaten): Strang[] {
  const aus: Strang[] = [];
  for (const g of d.geburtstage) {
    const tag = tagAus(g.tag);
    if (!tag) continue;
    const vorbei = tag < d.heute;
    aus.push({ id: `geburtstag:${g.id}:${tag}`, quelle: 'wichtiger-tag', titel: `Geburtstag ${g.name}`, pfad: PFAD, person: BEIDE, zeit: { tag }, gewicht: gewichtVon('wichtiger-tag', { erledigt: vorbei }), status: vorbei ? 'erledigt' : 'offen', link: g.href });
  }
  for (const t of d.tage) {
    if (t.art === 'geburtstag') continue;
    for (const tag of vorkommen(t.datum, d.von, d.bis)) {
      const erledigt = t.erledigt.includes(Number(tag.slice(0, 4))) || tag < d.heute;
      const p = t.nurIch ? t.von : person(t.wer);
      aus.push({ id: `tag:${t.id}:${tag}`, quelle: 'wichtiger-tag', titel: t.titel, pfad: PFAD, person: p, zeit: { tag }, gewicht: gewichtVon('wichtiger-tag', { erledigt }), status: erledigt ? 'erledigt' : 'offen', link: d.link, ...(t.nurIch ? { privat: true } : {}) });
    }
  }
  for (const x of d.dates) {
    const tag = tagAus(x.datum);
    if (!tag || x.status === 'abgesagt') continue;
    const erledigt = x.status === 'stattgefunden' || tag < d.heute;
    aus.push({ id: `date:${x.id}`, quelle: 'date', titel: x.titel, pfad: PFAD, person: x.nurIch ? x.von : BEIDE, zeit: { tag }, gewicht: gewichtVon('date', { erledigt }), status: erledigt ? 'erledigt' : 'offen', link: d.link, ...(x.nurIch ? { privat: true } : {}) });
  }
  for (const v of d.vereinbarungen) {
    const tag = tagAus(v.faellig);
    if (!tag || v.status !== 'offen') continue;
    aus.push({ id: `vereinbarung:${v.id}`, quelle: 'vereinbarung', titel: v.text, pfad: PFAD, person: person(v.wer), zeit: { tag }, gewicht: gewichtVon('vereinbarung'), status: statusVon(false, tag, d.heute), link: d.link });
  }
  return aus;
}
