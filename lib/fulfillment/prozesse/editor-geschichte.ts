// ─── Fulfillment · Prozesse — Rückgängig und Wiederholen im Prozess-Editor (Sitzung, 17.10.) ────────────────────────────────────────────
// Jede Änderung im Editor ist ein Stapel Ops (lib/fulfillment/prozesse/editor.ts). Hier steht rein, wie man sie zurücknimmt und wiederholt — gerechnet gegen
// den Stand der Vorlage VOR der Änderung (der Browser hat ihn):
//   · Anlegen (Phase, Schritt, Erinnerung am Nein-Zweig, Baustein) → zurück = in den Papierkorb, still (kein bewusstes Löschen, die Liste zeigt ihn nicht);
//     wiederholen = aus dem Papierkorb zurückholen (dieselbe Kennung, dieselben Zweige).
//   · Löschen → zurück = zurückholen; wiederholen = wieder löschen.
//   · Ändern, Verschieben, Zweige, Abstimmungspunkt → zurück = die alten Werte bzw. der alte Platz (`positionVon`).
//   · Fläche (17.10.): Lage → zurück = die alten Lagen (ohne Lage = wieder automatisch); Pfeil-Beschriftung → der alte Text; „verbinden“ → der alte Zweig bzw.
//     der alte Platz des umgehängten Schritts (samt Lage). Verschiebt eine Änderung Schritte bzw. Phasen, kommen ihre Lagen mit zurück.
//   · „Papierkorb leeren“ ist endgültig — kein Rückgängig (null; die Oberfläche fragt vorher).
// Rückgängig/Wiederholen gehen über denselben Schreibweg wie jede Änderung (Stand, 409, Grenzen) — nichts wird lokal geraten.
// Tests: tests/fulfillment-editor-modell.test.ts.

import type { ProzessVorlage } from '../typen';
import { kinderVon, wurzelVon } from '../regeln';
import { positionVon, type EditorOp } from './editor';

export interface GeschichteEintrag { rueck: EditorOp[]; wieder: EditorOp[] }

const ANLEGEN = new Set(['phase-neu', 'schritt-neu', 'nein-erinnerung', 'baustein-dazu']);
const alt = (w: unknown) => (w === undefined ? null : w);
/** Die Lagen (Fläche) der genannten Knoten, wie sie vorher waren — als Op `lage` (ohne Lage = null). Leer, wenn keiner eine hatte und `immer` fehlt. */
function lagenVorher(kn: ProzessVorlage['knoten'], ids: readonly string[], immer = false): EditorOp[] {
  const da = ids.map(id => kn.find(x => x.id === id)).filter((x): x is ProzessVorlage['knoten'][number] => !!x);
  if (!immer && !da.some(x => x.pos)) return [];
  return da.length ? [{ op: 'lage', eintraege: da.map(x => ({ id: x.id, pos: x.pos ?? null })) }] : [];
}

/** Rückweg und Wiederholung eines Op-Stapels gegen die Vorlage davor — null, wenn er sich nicht zurücknehmen lässt. */
export function geschichteFuer(v: ProzessVorlage, ops: readonly EditorOp[]): GeschichteEintrag | null {
  const kn = v.knoten;
  const knoten = (id: unknown) => kn.find(x => x.id === id);
  const neu = new Set<string>();
  const rueckJe: EditorOp[][] = [];
  const wieder: EditorOp[] = [];
  for (const o of ops) {
    if (ANLEGEN.has(o.op)) {
      const id = String(o.id);
      // Ein Baustein an einem Schritt, der im selben Stapel entsteht, geht mit dem Schritt (sein Teilbaum) — kein eigener Rückweg.
      if (o.op === 'baustein-dazu' && neu.has(String(o.schrittId))) { neu.add(id); continue; }
      neu.add(id);
      rueckJe.push([{ op: 'weg', id, still: true }]);
      wieder.push({ op: 'zurueck', id });
      continue;
    }
    wieder.push(o);
    switch (o.op) {
      case 'titel': rueckJe.push([{ op: 'titel', titel: v.titel }]); break;
      case 'zusatz': rueckJe.push([{ op: 'zusatz', an: !!v.zusatz }]); break;
      case 'phase': {
        const p = knoten(o.id);
        if (!p) return null;
        rueckJe.push([{ op: 'phase', id: p.id, ...(o.titel !== undefined ? { titel: p.titel } : {}), ...(o.kundeSichtbar !== undefined ? { kundeSichtbar: alt(p.kundeSichtbar) } : {}) }]);
        break;
      }
      case 'phase-schieben': {
        const w = wurzelVon(kn);
        const phasen = w ? kinderVon(w.id, kn) : [];
        const i = phasen.findIndex(p => p.id === o.id);
        if (i < 0) return null;
        // Die Rahmen rücken dabei in die Reihe (Fläche) — zurück kommen auch ihre Lagen.
        rueckJe.push([{ op: 'phase-schieben', id: o.id, nach: i > 0 ? phasen[i - 1].id : null }, ...lagenVorher(kn, phasen.map(p => p.id))]);
        break;
      }
      case 'abstimmung': {
        const p = knoten(o.phaseId);
        if (!p) return null;
        const fg = p.freigabe ? v.freigaben.find(f => f.id === p.freigabe) : undefined;
        rueckJe.push([p.freigabe ? { op: 'abstimmung', phaseId: p.id, an: true, id: p.freigabe, ...(fg ? { titel: fg.titel, wer: fg.wer } : {}) } : { op: 'abstimmung', phaseId: p.id, an: false }]);
        break;
      }
      case 'schritt': {
        const x = knoten(o.id);
        if (!x) return null;
        const r: EditorOp = { op: 'schritt', id: x.id };
        for (const f of ['titel', 'form', 'frist', 'zustaendig', 'kundeSichtbar'] as const) if (o[f] !== undefined) r[f] = alt(x[f]);
        // Eine andere Form kann Zweige lösen (die eigenen und die „Zurück“-Zweige von Erinnerungen) — zurück kommen sie mit, nach der Form.
        const zweige: EditorOp[] = o.form === undefined ? [] : [
          ...(x.zweige ? [{ op: 'zweig', id: x.id, ja: alt(x.zweige.ja), nein: alt(x.zweige.nein) }] : []),
          ...kn.filter(y => y.zweige?.ja === x.id).map(y => ({ op: 'zweig', id: y.id, ja: x.id })),
        ];
        rueckJe.push([r, ...zweige]);
        break;
      }
      case 'schritt-schieben': {
        const ziel = positionVon(kn, String(o.id));
        if (!ziel) return null;
        rueckJe.push([{ op: 'schritt-schieben', id: o.id, ziel }, ...lagenVorher(kn, [String(o.id)])]);
        break;
      }
      case 'lage': {
        const ids = Array.isArray(o.eintraege) ? (o.eintraege as { id?: unknown }[]).map(e => String(e?.id)) : [];
        if (!ids.length || ids.some(id => !knoten(id))) return null;
        // Rahmen, die danach in die Reihe rücken, kommen mit ihrer alten Lage zurück.
        const w = wurzelVon(kn);
        const phasen = w ? kinderVon(w.id, kn).map(p => p.id) : [];
        rueckJe.push(lagenVorher(kn, [...new Set([...ids, ...phasen.filter(p => kn.find(x => x.id === p)?.pos)])], true));
        break;
      }
      case 'pfeil-text': {
        const x = knoten(o.id);
        const art = o.art as 'weiter' | 'ja' | 'nein';
        if (!x || !['weiter', 'ja', 'nein'].includes(art)) return null;
        rueckJe.push([{ op: 'pfeil-text', id: x.id, art, text: alt(x.pfeilText?.[art]) }]);
        break;
      }
      case 'verbinden': {
        const a = knoten(o.von), b = knoten(o.nach);
        if (!a || !b) return null;
        if (a.form === 'entscheidung' || a.form === 'erinnerung') {
          const art = a.form === 'entscheidung' && o.zweig === 'nein' ? 'nein' : 'ja';
          rueckJe.push([{ op: 'zweig', id: a.id, [art]: alt(a.zweige?.[art]) }]);
          break;
        }
        const ziel = positionVon(kn, b.id);
        if (!ziel) return null;
        rueckJe.push([{ op: 'schritt-schieben', id: b.id, ziel }, ...lagenVorher(kn, [b.id])]);
        break;
      }
      case 'zweig': {
        const x = knoten(o.id);
        if (!x) return null;
        rueckJe.push([{ op: 'zweig', id: x.id, ...(o.ja !== undefined ? { ja: alt(x.zweige?.ja) } : {}), ...(o.nein !== undefined ? { nein: alt(x.zweige?.nein) } : {}) }]);
        break;
      }
      case 'gruppe': {
        const g = knoten(o.id);
        if (!g) return null;
        rueckJe.push([{ op: 'gruppe', id: g.id, titel: g.titel }]);
        break;
      }
      case 'weg': rueckJe.push([{ op: 'zurueck', id: o.id }]); break;
      case 'zurueck': {
        const e = v.papierkorb?.find(x => x.id === o.id);
        rueckJe.push([{ op: 'weg', id: o.id, ...(e?.still ? { still: true } : {}) }]);
        break;
      }
      default: return null; // papierkorb-leeren u. a.: endgültig
    }
  }
  return { rueck: rueckJe.reverse().flat(), wieder };
}
