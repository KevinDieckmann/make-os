// ─── Familie: eine Person aus dem Bestand tilgen, wenn ihr Konto gelöscht wird (Art. 17) — rein, 08.10. abends ───────────
// Kevin (Fragebogen Teil 3, Frage 11): „Dates/Vereinbarungen einer gelöschten Person: bleiben ohne Namen“ — „Träume einer gelöschten
// Person: Text bleibt ohne Namen“. Die Familie ist gemeinsames Leben des Haushalts: was die Person mit angelegt hat, bleibt für die
// anderen stehen — nur ihr Speichername (Personenbezug) verschwindet. Vorbild: `visionOhnePerson` (lib/familie/vision.ts).
//
// Regeln je Eintrag (alle Listen mit Kennung, LISTEN in lib/familie/typen.ts):
//   · „nur ich“-Einträge der gelöschten Person fallen WEG. Grund: nur sie durfte sie sehen (Sichtfilter `sichtFuer`: „nur ich“ zeigt
//     nur der Anlegerin) — ohne Namen sähe sie niemand mehr, sie lägen verwaist und unlöschbar im Bestand; sie sind ihre privaten
//     Daten, keine gemeinsamen.
//   · sonst bleibt der Inhalt; `von` (Anlegerin) wird leer — der Eintrag gilt dann wie Altbestand ohne Anlegerin (für alle änderbar).
//   · Namen IN Einträgen werden leer: Wertschätzungen/Wünsche im Gespräch (`von`), Vereinbarung (`wer`), Wertschätzung (`an`),
//     Date (`planer`, Nachklang `von`), Love-Map-Antwort (`person`), Wichtiger Tag (`wer`); Aufgabenkarte: `inhaber` → niemand (null),
//     dann steht sie wie jede unverteilte Karte zur Übernahme an.
//   · Reparatur: ungeteilte Reflexionen der Person fallen weg (sah nur sie — wie „nur ich“), geteilte bleiben ohne Namen.
//   · Profil der Person (Stress, Träume, was ihr guttut) fällt weg: es beschreibt nur sie, steht nur unter ihrem Namen und wäre ohne
//     sie verwaist (niemand sonst kann es pflegen).
//   · Vision: `visionOhnePerson` (Ziele ohne `von`, Träume ohne Person).
// Werte „beide“, „system“ und andere Personen bleiben, wie sie sind. Ergebnis: neuer Bestand + Änderungen fürs Protokoll (nur Liste,
// Kennung, Feldnamen — nie Werte) + Anzahl.

import type { Aenderung } from '@/lib/store/aenderungsprotokoll';
import { LISTEN, type Familie } from './typen';
import { visionOhnePerson } from './vision';

type Obj = Record<string, unknown>;

/** Felder, die direkt eine Person nennen (je Liste) — leer statt Name. `null` = Feld ganz auf „niemand“. */
const PERSON_FELDER: Partial<Record<(typeof LISTEN)[number], { feld: string; leer: '' | null }[]>> = {
  vereinbarungen: [{ feld: 'wer', leer: '' }],
  wertschaetzungen: [{ feld: 'an', leer: '' }],
  dates: [{ feld: 'planer', leer: '' }],
  lovemap: [{ feld: 'person', leer: '' }],
  tage: [{ feld: 'wer', leer: '' }],
  karten: [{ feld: 'inhaber', leer: null }],
};
/** Unterlisten mit `von` (je Liste). */
const UNTER_VON: Partial<Record<(typeof LISTEN)[number], string[]>> = {
  gespraeche: ['wertschaetzungen', 'wuensche'],
  dates: ['nachklang'],
};

export interface FamilieTilgung { familie: Familie; aenderungen: Aenderung[]; anzahl: number }

/** Die Person `speicher` aus dem Familien-Bestand tilgen (rein). Nichts zu tun → derselbe Bestand, `anzahl` 0. */
export function familieOhnePerson(f: Familie, speicher: string): FamilieTilgung {
  if (!speicher) return { familie: f, aenderungen: [], anzahl: 0 };
  const aenderungen: Aenderung[] = [];
  let anzahl = 0;
  const neu = { ...f } as Familie & Record<string, unknown>;

  for (const liste of LISTEN) {
    const alt = (Array.isArray(f[liste]) ? f[liste] : []) as unknown as Obj[];
    let geaendert = false;
    const raus: Obj[] = [];
    for (const e of alt) {
      if (e.sichtbarkeit === 'nur-ich' && e.von === speicher) {
        geaendert = true; anzahl++;
        aenderungen.push({ liste, op: 'geloescht', id: String(e.id) });
        continue;
      }
      const felder: string[] = [];
      let x: Obj = e;
      const setze = (feld: string, wert: unknown) => { if (x === e) x = { ...e }; x[feld] = wert; felder.push(feld); };
      if (e.von === speicher) setze('von', '');
      for (const p of PERSON_FELDER[liste] ?? []) if (e[p.feld] === speicher) setze(p.feld, p.leer);
      for (const u of UNTER_VON[liste] ?? []) {
        const l = Array.isArray(e[u]) ? (e[u] as Obj[]) : null;
        if (l?.some(y => y?.von === speicher)) setze(u, l.map(y => (y?.von === speicher ? { ...y, von: '' } : y)));
      }
      if (liste === 'reparaturen' && Array.isArray(e.reflexionen)) {
        const r = e.reflexionen as Obj[];
        if (r.some(y => y?.person === speicher)) {
          setze('reflexionen', r.filter(y => y?.person !== speicher || y.geteilt === true).map(y => (y?.person === speicher ? { ...y, person: '' } : y)));
        }
      }
      if (felder.length) { geaendert = true; anzahl++; aenderungen.push({ liste, op: 'geaendert', id: String(e.id), felder }); }
      raus.push(x);
    }
    if (geaendert) (neu as Record<string, unknown>)[liste] = raus;
  }

  // Profil: beschreibt nur die Person — fällt weg.
  const profile = Array.isArray(f.profile) ? f.profile : [];
  if (profile.some(p => p.person === speicher)) {
    neu.profile = profile.filter(p => p.person !== speicher);
    anzahl++;
    aenderungen.push({ liste: 'profile', op: 'geloescht', id: 'profil' });
  }

  // Vision: Einträge bleiben, ohne Namen (wie bisher, eine Stelle).
  if (Array.isArray(f.visionen)) {
    const v = visionOhnePerson(f.visionen, speicher);
    if (v.anzahl) {
      neu.visionen = v.visionen;
      anzahl += v.anzahl;
      aenderungen.push({ op: 'geaendert', id: 'visionen', felder: ['von'] });
    }
  }

  return anzahl ? { familie: neu, aenderungen, anzahl } : { familie: f, aenderungen: [], anzahl: 0 };
}
