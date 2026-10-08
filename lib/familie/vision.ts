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
// Gegenprüfung 08.10.: (1) Eine Anlegerin ohne Konto im Haushalt (Konto gelöscht, umgezogen) sperrt nichts — ihr Eintrag gilt wie
// Altbestand ohne Anlegerin (frei) und verliert den Namen beim nächsten Schreiben; `kontoLoeschen` tilgt ihn sofort (`visionOhnePerson`).
// (2) Doppelte Kennungen bei den Zielen → abgelehnt (400), sonst ließe sich mit zwei gleichen Kennungen ein Eintrag „im Namen“ der
// anderen Person unterschieben.

import type { Vision } from './typen';

export const VISION_FREMD = 'Diesen Eintrag hat eine andere Person angelegt — nur sie kann ihn ändern oder löschen.';
export const VISION_FREMDER_TRAUM = 'Träume einer anderen Person kann nur sie selbst ändern oder löschen — und niemand legt einen Traum im Namen einer anderen Person an.';

export const VISION_DOPPELT = 'Zwei Vision-Einträge mit derselben Kennung — abgelehnt, nichts gespeichert. Bitte neu laden.';

/** Geworfen aus `setzeFelder` (lib/familie/speicher.ts), wenn ein fremder Eintrag geändert würde — die Route antwortet 403 (doppelte Kennungen: 400). */
export class VisionVerboten extends Error { constructor(m: string, readonly status: 400 | 403 = 403) { super(m); } }

const text = (v: unknown, n: number) => String(v ?? '').slice(0, n);
type VisionZiel = Vision['ziele'][number];
type Traum = Vision['traeume'][number];

/**
 * Darf `person` diesen Vision-Eintrag ändern oder löschen? Eigene immer, Altbestand ohne Anlegerin auch — und (08.10.) Einträge einer
 * Anlegerin, die kein Konto im Haushalt mehr hat (`personen` = Speichernamen der Konten des Haushalts; ohne Angabe gilt jede Anlegerin).
 */
export const visionEintragFrei = (e: { von?: string }, person: string, personen?: ReadonlySet<string>): boolean =>
  !e.von || e.von === person || (!!personen && !personen.has(e.von));

/**
 * Anlegerinnen ohne Konto im Haushalt entfernen (rein) — ihre Einträge werden zu Altbestand ohne Anlegerin (frei, ohne Namen).
 * Ohne `personen` unverändert.
 */
export function visionOhneUnbekannte(v: Vision, personen: ReadonlySet<string> | undefined, person?: string): Vision {
  if (!personen) return v;
  const bekannt = (p?: string) => !!p && (personen.has(p) || p === person);
  if (v.ziele.every(z => !z.von || bekannt(z.von)) && v.traeume.every(t => !t.person || bekannt(t.person))) return v;
  return {
    ...v,
    ziele: v.ziele.map(z => (z.von && !bekannt(z.von) ? (({ von: _v, ...rest }) => rest)(z) : z)),
    traeume: v.traeume.map(t => (t.person && !bekannt(t.person) ? { ...t, person: '' } : t)),
  };
}

/** Konto gelöscht (Art. 17, lib/datenschutz/konto-daten.ts): die Person aus allen Visionen tilgen — Einträge bleiben, ohne Namen. Rein. */
export function visionOhnePerson(visionen: readonly Vision[], speicher: string): { visionen: Vision[]; anzahl: number } {
  let anzahl = 0;
  const neu = visionen.map(v => {
    const n = v.ziele.filter(z => z.von === speicher).length + v.traeume.filter(t => t.person === speicher).length;
    if (!n) return v;
    anzahl += n;
    return {
      ...v,
      ziele: v.ziele.map(z => (z.von === speicher ? (({ von: _v, ...rest }) => rest)(z) : z)),
      traeume: v.traeume.map(t => (t.person === speicher ? { ...t, person: '' } : t)),
    };
  });
  return { visionen: anzahl ? neu : [...visionen], anzahl };
}

/**
 * Die neue Vision eines Jahres aus dem, was der Browser schickt, gegen die gespeicherte prüfen (rein). `ok: false` = mindestens eine
 * Änderung an einem fremden Eintrag → die Route antwortet 403 und speichert nichts (doppelte Kennungen: `status` 400).
 * `personen` = Speichernamen der Konten des Haushalts — eine Anlegerin ohne Konto dort sperrt nichts (08.10.).
 */
export function visionSetzen(altRoh: Vision | undefined, v: Partial<Vision>, person: string, jahr: number, personen?: ReadonlySet<string>): { ok: true; vision: Vision } | { ok: false; fehler: string; status?: 400 } {
  const alt = altRoh ? visionOhneUnbekannte(altRoh, personen, person) : altRoh;
  // Ziele (mit Kennung): `von` aus dem Bestand, neue bekommen die schreibende Person — nie ein `von` aus dem Browser.
  let ziele: VisionZiel[] = alt?.ziele ?? [];
  if (Array.isArray(v.ziele)) {
    const altNachId = new Map((alt?.ziele ?? []).map(z => [z.id, z]));
    const ids = v.ziele.slice(0, 12).map((z, i) => text(z?.id, 40) || `z${i}`);
    if (new Set(ids).size !== ids.length) return { ok: false, fehler: VISION_DOPPELT, status: 400 };
    const neu: VisionZiel[] = v.ziele.slice(0, 12).map((z, i) => {
      const id = ids[i];
      const vorher = altNachId.get(id);
      const von = vorher ? vorher.von : person;
      return { id, text: text(z?.text, 300), erreicht: !!z?.erreicht, ...(von ? { von } : {}) };
    });
    const neuNachId = new Map(neu.map(z => [z.id, z]));
    for (const z of alt?.ziele ?? []) {
      if (visionEintragFrei(z, person, personen)) continue;
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
      // Eine Person ohne Konto im Haushalt (08.10.) zählt wie „ohne Person“ — niemand legt einen Traum in ihrem Namen an.
      if (p && personen && p !== person && !personen.has(p)) p = '';
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
