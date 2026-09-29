// ─── Kalender — Anlege-Dialog: Formular → Anfrage (rein, getestet, 29.09., K1) ─
// Der Dialog (components/os/kalender/NeuerTermin.tsx) hält nur diesen Zustand; was
// daraus wird, steht hier: eine Anfrage an /api/kalender/termin (Termin, Abwesend,
// Fokuszeit, Arbeitsort) oder eine NEUE AUFGABE im Aufgaben-Modell (Art „Aufgabe“ —
// kein iCloud-Termin, Deadline = Tag, optional Uhrzeit). Der Entwurf liegt bis zur
// Bestätigung des Servers im Sitzungsspeicher (ENTWURF_SCHLUESSEL).

import { tagPlus } from './zeit';
import { ART_INFO, erinnerungenSauber, type TerminArt, type Sichtbarkeit, type Arbeitsort } from './arten';
import { STANDARD_ZONE } from './zeitzone';
import type { Wiederholung } from './wiederholung';
import type { Wer } from './einstellungen';
import type { GastWahl } from './gaeste';

export const ENTWURF_SCHLUESSEL = 'make-kalender-entwurf';

export interface Formular {
  art: TerminArt;
  titel: string;
  /** Starttag YYYY-MM-DD */
  tag: string;
  /** HH:mm */
  von: string;
  bis: string;
  /** Letzter Tag bei ganztägig (inklusiv), sonst = tag. */
  bisTag: string;
  ganztags: boolean;
  zone: string;
  wiederholung: Wiederholung | null;
  ort: string;
  notiz: string;
  wer: Wer;
  /** Kalendername; leer = Standard der Person. */
  kalender: string;
  /** Farb-Kennung (TERMIN_FARBEN) oder leer = Kalenderfarbe. */
  farbe: string;
  /** null = Standard der Art. */
  beschaeftigt: boolean | null;
  sichtbarkeit: Sichtbarkeit;
  erinnerungen: number[];
  arbeitsort: Arbeitsort;
  /** Fokuszeit: Aufgabe/Mandat (nur Kennungen → `kalender-bezug`). */
  fokus: { aufgabeId?: string; mandatId?: string };
  /** Aufgabe: wohin (Space, Projekt, Liste) und ob mit Uhrzeit. */
  aufgabe: { spaceId: string; projectId?: string; listeId?: string; mitZeit: boolean };
  /** K3: Kontakt/Firma/Mandat/Deal am Termin (nur Kennungen → `kalender-bezug`; wird im CRM zum Meeting). */
  crm: { kontaktId?: string; firmaId?: string; mandatId?: string; dealId?: string };
  /** K3: Gäste — gehen erst nach der Rückfrage „Einladung an n Personen senden?“ an iCloud. */
  gaeste: GastWahl[];
  /**
   * F1 #6: feste UID des neuen Termins — entsteht beim ersten Senden im Browser und bleibt im Entwurf. Ein zweites
   * Senden (Verbindung weg, Antwort verloren) legt so nie einen zweiten Termin an (Server: `schonDa` = Erfolg).
   */
  uid?: string;
}

export interface Vorgabe {
  tag: string; von?: string; bis?: string; ganztags?: boolean; wer?: Wer; titel?: string; art?: TerminArt; spaceId?: string;
  /** K3: vorbelegt aus einer CRM-Akte („+ Meeting“). */
  crm?: Formular['crm']; gaeste?: GastWahl[];
}

const plusMin = (hhmm: string, min: number) => { const [h, m] = hhmm.split(':').map(Number); const g = Math.min(23 * 60 + 59, h * 60 + m + min); return `${String(Math.floor(g / 60)).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`; };
export { plusMin };

/**
 * Neue Anfangszeit (Nachtrag F1, wie bei Google): die Dauer bleibt, das Ende wandert mit. Ohne gültige Dauer (Ende vor dem
 * Anfang) die Standarddauer. Höchstens bis 23:59 desselben Tages (`plusMin`).
 */
export function vonAendern(f: Pick<Formular, 'von' | 'bis'>, von: string, standardDauer: number): { von: string; bis: string } {
  const min = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const dauer = min(f.bis) - min(f.von);
  return { von, bis: plusMin(von, dauer > 0 ? dauer : standardDauer) };
}

/**
 * Fehlertext nach einem gescheiterten Speichern (Schlussprüfung 29.09.): bei 409, verlorener Verbindung (0) und 5xx
 * der Hinweis, dass der Entwurf gemerkt bleibt — genau einmal (der Text für „Keine Verbindung“ trägt ihn schon).
 */
export function speicherFehlerText(fehler: string | undefined, status: number): string {
  const text = fehler ?? 'Nicht angelegt.';
  const merken = status === 409 || status === 0 || status >= 500;
  return merken && !/Entwurf bleibt gemerkt/i.test(text) ? `${text} Dein Entwurf bleibt gemerkt.` : text;
}

/** Startzustand aus einer Vorgabe (Klick, Aufziehen, Erstellen-Menü). */
export function formularStart(v: Vorgabe, standardDauer: number, fokusDauer = 90): Formular {
  const art = v.art ?? 'termin';
  const von = v.von ?? '09:00';
  const ganztags = v.ganztags ?? (art === 'abwesend' || art === 'arbeitsort');
  const dauer = art === 'fokus' ? fokusDauer : standardDauer;
  return {
    art, titel: v.titel ?? '', tag: v.tag, von, bis: v.bis ?? plusMin(von, dauer), bisTag: v.tag, ganztags,
    zone: STANDARD_ZONE, wiederholung: null, ort: '', notiz: '', wer: v.wer ?? 'kevin', kalender: '', farbe: '',
    beschaeftigt: null, sichtbarkeit: 'standard', erinnerungen: ganztags ? [] : [10],
    arbeitsort: { art: 'home' }, fokus: {}, aufgabe: { spaceId: v.spaceId ?? 'privat', mitZeit: !ganztags && !!v.von },
    crm: { ...(v.crm ?? {}) }, gaeste: [...(v.gaeste ?? [])],
  };
}

/** Formular aus dem Sitzungsspeicher (Entwurf vor K3 ohne `crm`/`gaeste`) — fehlende Felder ergänzen. */
export const formularErgaenzen = (f: Formular): Formular => ({ ...f, crm: f.crm ?? {}, gaeste: Array.isArray(f.gaeste) ? f.gaeste : [] });

/** Art wechseln (Reiter): ganztags-Standard und Dauer folgen der Art, Eingetipptes bleibt. */
export function artWechseln(f: Formular, art: TerminArt, standardDauer: number, fokusDauer = 90): Formular {
  if (art === f.art) return f;
  const ganztags = art === 'arbeitsort' ? true : art === 'fokus' ? false : art === 'abwesend' ? f.ganztags || ART_INFO.abwesend.ganztags : f.ganztags;
  const bis = art === 'fokus' && !f.ganztags ? plusMin(f.von, fokusDauer) : art !== 'fokus' && f.art === 'fokus' ? plusMin(f.von, standardDauer) : f.bis;
  return { ...f, art, ganztags, bis, beschaeftigt: null, ...(art === 'arbeitsort' ? { wiederholung: f.wiederholung } : {}) };
}

/** Was fehlt oder nicht passt — null = speicherbar. */
export function formularFehler(f: Formular): string | null {
  if (f.art !== 'arbeitsort' && !f.titel.trim()) return 'Ein Titel fehlt.';
  if (f.art === 'arbeitsort' && f.arbeitsort.art === 'frei' && !f.arbeitsort.text?.trim()) return 'Welcher Ort?';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.tag)) return 'Der Tag fehlt.';
  if (f.art === 'aufgabe') return null;
  if ((f.gaeste?.length ?? 0) && f.art !== 'termin') return 'Gäste gibt es nur an Terminen.';
  if (f.ganztags) return f.bisTag < f.tag ? 'Der letzte Tag liegt vor dem ersten.' : null;
  return f.bis <= f.von ? 'Das Ende liegt vor dem Anfang.' : null;
}

export type Anfrage =
  | { art: 'aufgabe'; neu: { title: string; dueDate: string; dueTime?: string; description?: string }; ziel: { spaceId: string; projectId?: string; listeId?: string } }
  | { art: 'termin'; koerper: Record<string, unknown> };

/** Formular → Anfrage (für /api/kalender/termin POST bzw. `aufgabeAnlegen`). */
export function formularAnfrage(f: Formular): Anfrage {
  if (f.art === 'aufgabe') {
    return {
      art: 'aufgabe',
      neu: { title: f.titel.trim(), dueDate: f.tag, ...(f.aufgabe.mitZeit && !f.ganztags ? { dueTime: f.von } : {}), ...(f.notiz.trim() ? { description: f.notiz.trim() } : {}) },
      ziel: { spaceId: f.aufgabe.spaceId, ...(f.aufgabe.projectId ? { projectId: f.aufgabe.projectId } : {}), ...(f.aufgabe.listeId ? { listeId: f.aufgabe.listeId } : {}) },
    };
  }
  // Fokuszeit zählt auf Aufgabe/Mandat; ein Termin trägt den CRM-Bezug (K3). Nur Kennungen.
  const crm = f.art === 'termin' ? Object.fromEntries(Object.entries(f.crm ?? {}).filter(([, v]) => !!v)) : {};
  const bezug = f.art === 'fokus' ? { ...(f.fokus.aufgabeId ? { aufgabeId: f.fokus.aufgabeId } : {}), ...(f.fokus.mandatId ? { mandatId: f.fokus.mandatId } : {}) } : crm;
  const gaeste = f.art === 'termin' ? (f.gaeste ?? []).map(g => ({ email: g.email, ...(g.name ? { name: g.name } : {}), ...(g.kontaktId ? { kontaktId: g.kontaktId } : {}) })) : [];
  const erinnerungen = erinnerungenSauber(f.erinnerungen);
  return {
    art: 'termin',
    koerper: {
      art: f.art, titel: f.titel.trim(), ganztags: f.ganztags,
      start: f.ganztags ? f.tag : `${f.tag}T${f.von}`,
      ende: f.ganztags ? tagPlus(f.bisTag < f.tag ? f.tag : f.bisTag, 1) : `${f.tag}T${f.bis}`,
      ...(f.kalender ? { kalender: f.kalender } : { wer: f.wer }),
      ...(f.ort.trim() && f.art !== 'arbeitsort' ? { ort: f.ort.trim() } : {}),
      ...(f.notiz.trim() ? { notiz: f.notiz.trim() } : {}),
      ...(f.wiederholung ? { wiederholung: f.wiederholung } : {}),
      ...(erinnerungen.length ? { erinnerungenMin: erinnerungen } : {}),
      ...(f.farbe ? { farbe: f.farbe } : {}),
      ...(f.beschaeftigt !== null && f.art !== 'abwesend' && f.art !== 'fokus' ? { beschaeftigt: f.beschaeftigt } : {}),
      sichtbarkeit: f.sichtbarkeit,
      ...(!f.ganztags && f.zone !== STANDARD_ZONE ? { zone: f.zone } : {}),
      ...(f.art === 'arbeitsort' ? { arbeitsort: f.arbeitsort } : {}),
      ...(Object.keys(bezug).length ? { bezug } : {}),
      ...(gaeste.length ? { gaeste } : {}),
      ...(f.uid ? { uid: f.uid } : {}),
    },
  };
}

/** Hat der Entwurf Inhalt, der verloren gehen könnte? */
export const entwurfWertvoll = (f: Formular | null | undefined): boolean => !!f && (!!f.titel.trim() || !!f.notiz.trim() || !!f.ort.trim());
