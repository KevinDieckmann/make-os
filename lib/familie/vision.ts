// ─── Familie › Vision: Einträge gehören ihrer Anlegerin (08.10., Kevin, Phase 0) — rein ─────────────────────────────────
// Kevin 08.10.: Träume/Vision-Einträge darf nur die Person ändern oder löschen, die sie angelegt hat (sonst 403); lesen wie bisher
// (alle im Haushalt). Die Vision eines Jahres hat drei Teile:
//   · `leitbild`  ein gemeinsamer Text („Unsere Vision“) — ohne Anlegerin, beide dürfen ihn wie bisher ändern;
//   · `ziele[]`   Einträge mit Kennung — `von` (Anlegerin) setzt NUR der Server beim Anlegen, nie aus dem Browser; Text, „erreicht“
//                 und Löschen nur durch sie. Altbestand ohne `von`: bleibt für alle änderbar (niemand lässt sich sicher zuordnen);
//   · `traeume[]` Einträge ohne Kennung, `person` = wessen Traum (= wer ihn angelegt hat). Die Träume einer anderen Person bleiben,
//                 wie sie sind; im Namen einer anderen Person anlegen geht nicht. Ein Traum ohne Person (Altbestand) bleibt frei.
// Der Browser schickt die Vision weiter als Ganzes (`felder.vision`) — der Server vergleicht mit dem gespeicherten Stand und lehnt
// JEDE Änderung an einem fremden Eintrag ab (dann wird gar nichts gespeichert). Das schützt nebenbei vor einem veralteten Browser,
// der einen inzwischen angelegten fremden Eintrag sonst still löschen würde.

import type { Vision } from './typen';

export const VISION_FREMD = 'Diesen Eintrag hat eine andere Person angelegt — nur sie kann ihn ändern oder löschen.';
export const VISION_FREMDER_TRAUM = 'Träume einer anderen Person kann nur sie selbst ändern oder löschen — und niemand legt einen Traum im Namen einer anderen Person an.';

/** Geworfen aus `setzeFelder` (lib/familie/speicher.ts), wenn ein fremder Eintrag geändert würde — die Route antwortet 403. */
export class VisionVerboten extends Error { readonly status = 403; }

const text = (v: unknown, n: number) => String(v ?? '').slice(0, n);
type VisionZiel = Vision['ziele'][number];
type Traum = Vision['traeume'][number];

/** Darf `person` diesen Vision-Eintrag ändern oder löschen? Eigene immer, Altbestand ohne Anlegerin auch. */
export const visionEintragFrei = (e: { von?: string }, person: string): boolean => !e.von || e.von === person;

/**
 * Die neue Vision eines Jahres aus dem, was der Browser schickt, gegen die gespeicherte prüfen (rein). `ok: false` = mindestens eine
 * Änderung an einem fremden Eintrag → die Route antwortet 403 und speichert nichts.
 */
export function visionSetzen(alt: Vision | undefined, v: Partial<Vision>, person: string, jahr: number): { ok: true; vision: Vision } | { ok: false; fehler: string } {
  // Ziele (mit Kennung): `von` aus dem Bestand, neue bekommen die schreibende Person — nie ein `von` aus dem Browser.
  let ziele: VisionZiel[] = alt?.ziele ?? [];
  if (Array.isArray(v.ziele)) {
    const altNachId = new Map((alt?.ziele ?? []).map(z => [z.id, z]));
    const neu: VisionZiel[] = v.ziele.slice(0, 12).map((z, i) => {
      const id = text(z?.id, 40) || `z${i}`;
      const vorher = altNachId.get(id);
      const von = vorher ? vorher.von : person;
      return { id, text: text(z?.text, 300), erreicht: !!z?.erreicht, ...(von ? { von } : {}) };
    });
    const neuNachId = new Map(neu.map(z => [z.id, z]));
    for (const z of alt?.ziele ?? []) {
      if (visionEintragFrei(z, person)) continue;
      const n = neuNachId.get(z.id);
      if (!n || n.text !== z.text || n.erreicht !== z.erreicht) return { ok: false, fehler: VISION_FREMD };
    }
    ziele = neu;
  }
  // Träume (ohne Kennung): je fremder Person muss ihre Liste unverändert bleiben (als Menge mit Anzahl).
  let traeume: Traum[] = alt?.traeume ?? [];
  if (Array.isArray(v.traeume)) {
    const altOhnePerson = (alt?.traeume ?? []).filter(t => !t.person).map(t => t.text);
    const neu: Traum[] = v.traeume.slice(0, 12).map(t => {
      const tx = text(t?.text, 500);
      let p = text(t?.person, 40);
      // Ohne Person: ein unveränderter Altbestand-Traum bleibt ohne Person, alles andere gehört der schreibenden Person.
      if (!p) { const i = altOhnePerson.indexOf(tx); if (i >= 0) altOhnePerson.splice(i, 1); else p = person; }
      return { person: p, text: tx };
    });
    const zaehlen = (l: readonly Traum[], p: string) => l.filter(t => t.person === p).map(t => t.text).sort().join('\u0000');
    const fremde = new Set([...(alt?.traeume ?? []), ...neu].map(t => t.person).filter(p => p && p !== person));
    for (const p of fremde) if (zaehlen(alt?.traeume ?? [], p) !== zaehlen(neu, p)) return { ok: false, fehler: VISION_FREMDER_TRAUM };
    traeume = neu;
  }
  return { ok: true, vision: { jahr, leitbild: text(v.leitbild ?? alt?.leitbild, 1500), ziele, traeume } };
}
