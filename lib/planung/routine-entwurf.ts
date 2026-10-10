// ─── MAKE OS — Routinen 2: der Entwurf im Editor (rein, client-sicher, 10.10.) ────────────────────────────────────────────────
// Der Routine-Editor (components/os/routinen/RoutineEditor.tsx) arbeitet mit einem flachen Entwurf — eine Wahl je Feld, nichts verschachtelt —
// und schreibt beim Speichern EINE Routine zurück. Die Umrechnung steht nur hier (getestet: tests/routinen-2-entwurf.test.ts): eine Routine aus
// dem Altbestand kommt unverändert zurück, solange niemand etwas ändert; der Rhythmus geht immer als `regel` hinaus — der Schreibweg speichert ihn
// in der alten Form, wo sie reicht (lib/planung/routinen.ts `sauberRoutine`).

import type { IntervallEinheit, NterWochentag, RegelArt, Routine, RoutinePause, RoutineRegel, SpaceId, Wochentag } from './typen';
import { OWNER_BEIDE } from './typen';
import { regelVon, tagesZielVon } from './rhythmus';
import { hatPrivatEinheit, speicherSpace } from './bereich';
import { spaceVonRoutine } from './routinen';

export interface RoutineEntwurf {
  label: string;
  space: SpaceId;
  /** Business-Einheit bzw. Privat-Einheit (Selbstständigkeit) — leer = keine. */
  einheit: string;
  owner: string;
  kategorie: Routine['kategorie'];
  wann: Routine['wann'];
  dauerMin: number;
  art: RegelArt;
  tage: Wochentag[];
  /** wochentage: jede n-te Woche. */
  alleWochen: number;
  /** pro-woche: wie oft. */
  proWoche: number;
  /** intervall: alle n … */
  alle: number;
  einheitIntervall: IntervallEinheit;
  naechstesMal: string;
  monatModus: 'tag' | 'nter';
  monatstag: number;
  nterN: NterWochentag['n'];
  nterTag: Wochentag;
  alleMonate: number;
  /** Ab wann gezählt wird (nur bei „jede n-te Woche“ / „alle n Monate“). */
  start: string;
  tagesZiel: number;
  zaehlWort: string;
  uhrzeiten: string[];
  erinnerung: boolean;
  kalender: boolean;
  von: string;
  bis: string;
  pausen: RoutinePause[];
  zielId: string;
}

/** Der Entwurf einer Routine (oder einer neuen, mit Vorgaben). */
export function entwurfAus(r: Routine | null, vorgabe: Partial<RoutineEntwurf> = {}, heute = ''): RoutineEntwurf {
  const g: RoutineRegel = r ? regelVon(r) : { art: 'taeglich' };
  const space = r ? spaceVonRoutine(r) : 'privat';
  return {
    label: r?.label ?? '',
    space,
    einheit: r?.einheit && (space === 'business' || hatPrivatEinheit(r)) ? r.einheit : '',
    owner: r ? (r.owner || OWNER_BEIDE) : OWNER_BEIDE,
    kategorie: r?.kategorie ?? 'gesundheit',
    wann: r?.wann ?? 'morgen',
    dauerMin: r?.dauerMin ?? 15,
    art: g.art,
    tage: g.art === 'wochentage' ? [...(g.tage ?? [])] : [1],
    alleWochen: g.art === 'wochentage' ? g.alle ?? 1 : 1,
    proWoche: g.art === 'pro-woche' ? g.anzahl ?? 3 : 3,
    alle: g.art === 'intervall' ? g.alle ?? 1 : 2,
    einheitIntervall: g.art === 'intervall' ? g.einheit ?? 'tag' : 'tag',
    naechstesMal: r?.naechstesMal ?? '',
    monatModus: g.art === 'monatlich' && g.nter ? 'nter' : 'tag',
    monatstag: g.art === 'monatlich' && g.monatstag ? g.monatstag : 1,
    nterN: g.art === 'monatlich' && g.nter ? g.nter.n : 1,
    nterTag: g.art === 'monatlich' && g.nter ? g.nter.tag : 1,
    alleMonate: g.art === 'monatlich' ? g.alle ?? 1 : 1,
    start: (g.art === 'wochentage' || g.art === 'monatlich') && g.start ? g.start : heute,
    tagesZiel: r ? tagesZielVon(r) : 1,
    zaehlWort: r?.zaehlWort ?? '',
    uhrzeiten: [...(r?.uhrzeiten ?? [])],
    erinnerung: !!r?.erinnerung,
    kalender: !!r?.kalender,
    von: r?.zeitraum?.von ?? '',
    bis: r?.zeitraum?.bis ?? '',
    pausen: (r?.pausen ?? []).map(p => ({ ...p })),
    zielId: r?.zielId ?? '',
    ...vorgabe,
  };
}

/** Die Regel des Entwurfs (ungeprüft — der Schreibweg prüft und kürzt auf die alte Form, wo sie reicht). */
export function regelAusEntwurf(e: RoutineEntwurf): RoutineRegel {
  switch (e.art) {
    case 'taeglich': case 'werktage': return { art: e.art };
    case 'wochentage': return { art: 'wochentage', tage: [...e.tage].sort((a, b) => a - b), ...(e.alleWochen > 1 ? { alle: e.alleWochen, ...(e.start ? { start: e.start } : {}) } : {}) };
    case 'pro-woche': return { art: 'pro-woche', anzahl: e.proWoche };
    case 'intervall': return { art: 'intervall', alle: e.alle, ...(e.einheitIntervall !== 'tag' ? { einheit: e.einheitIntervall } : {}) };
    case 'monatlich': return {
      art: 'monatlich', ...(e.monatModus === 'nter' ? { nter: { n: e.nterN, tag: e.nterTag } } : { monatstag: e.monatstag }),
      ...(e.alleMonate > 1 ? { alle: e.alleMonate, ...(e.start ? { start: e.start } : {}) } : {}),
    };
  }
}

/** Was am Entwurf fehlt bzw. nicht passt — ein Satz je Fund (leer = speicherbar). */
export function entwurfFehler(e: RoutineEntwurf): string[] {
  const f: string[] = [];
  if (!e.label.trim()) f.push('Bitte einen Namen eintragen.');
  if (e.art === 'wochentage' && !e.tage.length) f.push('Bitte mindestens einen Wochentag wählen.');
  if (e.von && e.bis && e.bis < e.von) f.push('Der Zeitraum endet vor seinem Beginn.');
  if (e.pausen.some(p => !p.von || !p.bis || p.bis < p.von)) f.push('Eine Pause braucht Beginn und Ende (Ende nicht vor dem Beginn).');
  if (e.kalender && e.owner === OWNER_BEIDE) f.push('Kalender-Blöcke gibt es nur für die Routine einer Person — bei „gemeinsam“ bitte ausschalten.');
  return f;
}

/**
 * Die Routine aus dem Entwurf — auf `basis` (Kennung, Rang, aktiv, angelegt) gelegt. Alte Rhythmus-Felder fallen weg (die Regel führt);
 * „nächstes Mal am“ nur bei „alle n …“. Leere Zusätze fehlen ganz (kein Feld mit leerem Wert).
 */
export function routineAusEntwurf(e: RoutineEntwurf, basis: Pick<Routine, 'id' | 'aktiv'> & Partial<Pick<Routine, 'rang' | 'angelegtAm' | 'owner'>>): Routine {
  const privatEinheit = e.space === 'privat' && !!e.einheit;
  const space = privatEinheit ? speicherSpace('privat', e.einheit) : e.space;
  const regel = regelAusEntwurf(e);
  const uhrzeiten = [...new Set(e.uhrzeiten.filter(u => /^([01]\d|2[0-3]):[0-5]\d$/.test(u)))].sort();
  const ziel = Math.max(e.tagesZiel, uhrzeiten.length >= 2 ? uhrzeiten.length : 1);
  return {
    id: basis.id,
    label: e.label.trim(),
    wann: e.wann,
    kategorie: e.kategorie,
    dauerMin: e.dauerMin,
    aktiv: basis.aktiv,
    ...(space && space !== 'privat' ? { space } : {}),
    // Altbestand ohne Besitz (= gemeinsam) bleibt ohne Feld, solange „gemeinsam“ gewählt ist.
    ...(basis.owner === undefined && e.owner === OWNER_BEIDE ? {} : { owner: e.owner }),
    ...(regel.art === 'intervall' && e.naechstesMal ? { naechstesMal: e.naechstesMal } : {}),
    ...(basis.rang ? { rang: basis.rang } : {}),
    ...(e.einheit && (e.space === 'business' || privatEinheit) ? { einheit: e.einheit } : {}),
    regel,
    ...(ziel > 1 ? { tagesZiel: ziel } : {}),
    ...(ziel > 1 && e.zaehlWort.trim() ? { zaehlWort: e.zaehlWort.trim() } : {}),
    ...(uhrzeiten.length ? { uhrzeiten } : {}),
    ...(e.von || e.bis ? { zeitraum: { ...(e.von ? { von: e.von } : {}), ...(e.bis ? { bis: e.bis } : {}) } } : {}),
    ...(e.pausen.length ? { pausen: e.pausen } : {}),
    ...(e.zielId ? { zielId: e.zielId } : {}),
    ...(e.erinnerung ? { erinnerung: true as const } : {}),
    ...(e.kalender && e.owner !== OWNER_BEIDE ? { kalender: true as const } : {}),
    // „Angelegt am“ nur bei neuen Routinen (setzt der Editor) — der Altbestand misst weiter ab dem ersten Haken.
    ...(basis.angelegtAm ? { angelegtAm: basis.angelegtAm } : {}),
  };
}
