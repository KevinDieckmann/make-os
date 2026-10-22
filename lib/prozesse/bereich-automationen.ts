// ─── Prozesse — „Automationen & Head“ eines Bereichs (22.10., Werkzeug-Muster; Rückmeldung: „Jeder Bereich hat einen eigenen Automation & Head of Bereich, wo wir
// die Automatisierungen dem jeweiligen Bereich bauen können wie mit den Prozessen — also eigentlich die Prozesse.“) ─────────────────────────────────────
// EINE Wahrheit: dieselbe Landkarte wie das Werkzeug Prozesse (`landkarteAnsicht` — die angepasste Fassung mit eigenen Bereichen und Zuordnungen) und dieselben
// Zahlen der Läufe (GET /api/prozesse/laeufe ohne Parameter). Hier wird nur gefiltert und beschriftet — rein und client-sicher
// (components/os/werkzeug/BereichAutomationen.tsx zeichnet es, die Tests prüfen es ohne Netz).

import { WEG } from '@/lib/wege';
import type { LandkarteAnsicht, LandkarteBereich } from './landkarte-anpassung';
import type { ProzessDef } from './typen';
import { werkstattZustand, ZUSTAND_NAME, ZUSTAND_BEDEUTUNG, type WerkstattZustand } from './laeufe-ansicht';
import type { ProzessLaufStand } from './lauf-typen';
import type { Bedeutung } from '@/lib/make-one/design';

/** Je Prozess die Zahlen der Läufe (GET /api/prozesse/laeufe ohne Parameter) — nur Zahlen und ob er scharf ist. */
export interface LaufZahlen { offen: number; wartend: number; fehler: number; zurueckgehalten: number; scharf: boolean; pause?: string }

export type AutomationArt = 'werkstatt' | 'paket' | 'system';
export interface AutomationZeile {
  id: string;
  titel: string;
  art: AutomationArt;
  /** Nur eigene Prozesse der Werkstatt: Entwurf · Probelauf · scharf · pausiert · archiviert (dieselbe Regel wie die Kopfzeile der Werkstatt). */
  zustand: WerkstattZustand | null;
  zustandName: string;
  bedeutung: Bedeutung;
  /** Die Zeile darunter: was es ist, Version/Schritte, offene Läufe. */
  satz: string;
  /** Öffnen: eigener Prozess bzw. Paket in die Werkstatt, System-Prozess ins Bild (dort Steckbrief und Stellschrauben). */
  href: string;
  linkText: string;
  /** Auf der Landkarte ausgeblendet (Landkarte anpassen) — die Automation läuft trotzdem. */
  ausgeblendet: boolean;
  p: ProzessDef;
}
export interface AutomationGruppe { bereich: LandkarteBereich; zeilen: AutomationZeile[] }

const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Eine Zeile je Prozess — Zustand aus dem Status der Werkstatt und dem Laufzeit-Stand (scharf, Pause). */
export function automationZeile(p: ProzessDef, z?: LaufZahlen): AutomationZeile {
  const ausgeblendet = !!p.aus;
  const titel = p.beschriftung ?? p.titel;
  if (p.quelle === 'werkstatt') {
    const w = p.werkstatt;
    const st = z ? ({ einstellung: { scharf: z.scharf }, ...(z.pause === 'budget' || z.pause === 'notbremse' ? { pause: { grund: z.pause, am: '' } } : {}) } as unknown as Pick<ProzessLaufStand, 'einstellung' | 'pause'>) : null;
    const zu = werkstattZustand(w?.status ?? 'entwurf', st, w?.version != null).art;
    const teile = [
      w?.version != null ? `Version ${w.version}` : 'noch nicht veröffentlicht',
      w ? mehrzahl(w.schritte, 'Schritt', 'Schritte') : null,
      z?.offen ? mehrzahl(z.offen, 'Lauf offen', 'Läufe offen') : null,
      z?.fehler ? mehrzahl(z.fehler, 'Fehler', 'Fehler') : null,
    ].filter(Boolean);
    return { id: p.id, titel, art: 'werkstatt', zustand: zu, zustandName: ZUSTAND_NAME[zu], bedeutung: z?.fehler ? 'kritisch' : ZUSTAND_BEDEUTUNG[zu], satz: teile.join(' · '), href: WEG.prozesse({ p: p.id, ansicht: 'werkstatt' }), linkText: 'In der Werkstatt öffnen ›', ausgeblendet, p };
  }
  if (p.quelle === 'vorlage') {
    return { id: p.id, titel, art: 'paket', zustand: null, zustandName: 'Paket', bedeutung: 'neutral', satz: 'Paket des Fulfillments — läuft im Fall des Kunden', href: p.editor ? WEG.prozesse({ p: p.id, ansicht: 'werkstatt' }) : WEG.prozesse({ p: p.id }), linkText: 'Öffnen ›', ausgeblendet, p };
  }
  const n = p.stellschrauben?.length ?? 0;
  return { id: p.id, titel, art: 'system', zustand: null, zustandName: 'System', bedeutung: 'neutral', satz: `Im Code gebaut${n ? ` · ${mehrzahl(n, 'Stellschraube', 'Stellschrauben')}` : ' · nur lesbar'}`, href: WEG.prozesse({ p: p.id }), linkText: 'Ansehen ›', ausgeblendet, p };
}

/**
 * Die Prozesse der Bereiche eines Werkzeugs, in der Reihenfolge der Bereiche und der Landkarte (angepasst: eigene Zuordnung und Reihenfolge gelten). Unbekannte
 * Bereiche fallen weg; ein Bereich ohne Prozesse bleibt (mit leerer Liste) — dort steht dann „+ Prozess“. `prozesse` = einzelne Prozesse, die zum Werkzeug
 * gehören, ohne dass ihr ganzer Bereich dazugehört (Kalender: Terminbuchung) — sie stehen unter dem Bereich, in dem sie auf der Landkarte liegen, nach den
 * ganzen Bereichen; Unbekanntes fällt weg, nichts doppelt.
 */
export function automationenFuer(ansicht: LandkarteAnsicht, bereiche: readonly string[], laeufe: Readonly<Record<string, LaufZahlen>> = {}, prozesse: readonly string[] = []): AutomationGruppe[] {
  const nachId = new Map(ansicht.bereiche.map(b => [b.id, b]));
  const ganze = bereiche.flatMap(id => {
    const b = nachId.get(id);
    return b ? [{ bereich: b, zeilen: (ansicht.jeBereich[id] ?? []).map(p => automationZeile(p, laeufe[p.id])) }] : [];
  });
  if (!prozesse.length) return ganze;
  const schon = new Set(ganze.flatMap(g => g.zeilen.map(z => z.id)));
  const einzeln = ansicht.bereiche.flatMap(b => {
    const zeilen = (ansicht.jeBereich[b.id] ?? []).filter(p => prozesse.includes(p.id) && !schon.has(p.id)).map(p => automationZeile(p, laeufe[p.id]));
    return zeilen.length ? [{ bereich: b, zeilen }] : [];
  });
  return [...ganze, ...einzeln];
}

/** Die Lage in Zahlen (Kopf des Bausteins): wie viele eigene Prozesse scharf, im Probelauf, pausiert, als Entwurf; dazu System und Pakete. */
export function automationLage(g: readonly AutomationGruppe[]): { scharf: number; probelauf: number; pausiert: number; entwurf: number; system: number; pakete: number } {
  const z = g.flatMap(x => x.zeilen);
  const zaehle = (f: (x: AutomationZeile) => boolean) => z.filter(f).length;
  return {
    scharf: zaehle(x => x.zustand === 'scharf'), probelauf: zaehle(x => x.zustand === 'probelauf'), pausiert: zaehle(x => x.zustand === 'pausiert'),
    entwurf: zaehle(x => x.zustand === 'entwurf'), system: zaehle(x => x.art === 'system'), pakete: zaehle(x => x.art === 'paket'),
  };
}
