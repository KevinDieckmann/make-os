// ─── Prozesse · Läufe beim Zusammenführen von Personen (Kevin 31.10., Klickrunde) ────────────────────────────────────────────────────────────────
// Werden zwei Personen der Kartei zusammengeführt (Dubletten, lib/crm/person-bestaende.ts `personenUmbiegen`), wandern die Läufe der entfernten Person auf
// die behaltene: Fall `lead:<alt>` → `lead:<neu>` (samt Schlüssel), Kennungen in `daten` (z. B. `bezug.kontaktId`), Listen der CRM-Abfragen, zurückgehaltene
// Starts und Testfälle. Laufen danach zwei OFFENE Läufe mit demselben Schlüssel (gleicher Prozess, gleiche Person) im selben Modus, bleibt der weiter
// fortgeschrittene (mehr erledigte Schritte; bei Gleichstand der ältere) — der andere endet mit Grund `zusammengefuehrt` und dem Verweis
// `zusammengefuehrtMit` (nie gelöscht). Rein und idempotent: ein zweiter Durchgang findet keine alte Kennung und keinen doppelten offenen Lauf mehr.

import { abbrechen } from './lauf-regeln';
import { laufOffen, type LaeufeDatei, type LaufFall, type ProzessLauf } from './lauf-typen';

const umFall = (f: LaufFall, p: ReadonlyMap<string, string>): LaufFall => (f.art === 'lead' && f.id && p.has(f.id) ? { ...f, id: p.get(f.id)! } : f);
const umDaten = (d: Record<string, string>, p: ReadonlyMap<string, string>): { d: Record<string, string>; n: number } => {
  let n = 0;
  const neu = Object.fromEntries(Object.entries(d).map(([k, v]) => (typeof v === 'string' && p.has(v) ? (n++, [k, p.get(v)!]) : [k, v])));
  return { d: n ? neu : d, n };
};
const umSchluessel = (s: string, p: ReadonlyMap<string, string>): string => {
  for (const [a, x] of p) if (s.endsWith(`|lead:${a}`)) return `${s.slice(0, -a.length)}${x}`;
  return s;
};
/** Fortschritt eines Laufs: erledigte Schritte (der Maßstab beim Zusammenführen). */
export const erledigteSchritte = (l: Pick<ProzessLauf, 'schritte'>): number => l.schritte.filter(s => s.status === 'erledigt').length;

/** Welcher von zwei gleichen offenen Läufen bleibt: mehr erledigte Schritte, sonst der ältere (Start, dann Kennung). Rein. */
export function bleibenderLauf(a: ProzessLauf, b: ProzessLauf): ProzessLauf {
  const ea = erledigteSchritte(a), eb = erledigteSchritte(b);
  if (ea !== eb) return ea > eb ? a : b;
  if (a.start !== b.start) return a.start < b.start ? a : b;
  return a.id < b.id ? a : b;
}

export interface ZusammenfuehrenErgebnis { datei: LaeufeDatei; umgebogen: number; beendet: number }

/** Läufe von `alt` auf `neu` (Paare der Kartei-Kennungen) — umbiegen, dann Doppelte beenden. Rein. */
export function laeufeZusammenfuehren(d: LaeufeDatei, paare: ReadonlyMap<string, string>, jetzt: string): ZusammenfuehrenErgebnis {
  const p = new Map(Array.from(paare).filter(([a, n]) => a && n && a !== n));
  if (!p.size) return { datei: d, umgebogen: 0, beendet: 0 };
  let umgebogen = 0;
  const betroffen = new Set<string>();
  let laeufe = d.laeufe.map(l => {
    const fall = umFall(l.fall, p);
    const daten = umDaten(l.daten, p);
    const listen = l.listen ? Object.fromEntries(Object.entries(l.listen).map(([k, li]) => {
      const gesehen = new Set<string>();
      const faelle = li.faelle.map(f => umFall(f, p)).filter(f => { const s = `${f.art}:${f.id ?? ''}`; if (gesehen.has(s)) return false; gesehen.add(s); return true; });
      return [k, faelle.length === li.faelle.length && faelle.every((f, i) => f === li.faelle[i]) ? li : { ...li, faelle }];
    })) : undefined;
    const listenAnders = !!l.listen && Object.keys(l.listen).some(k => listen![k] !== l.listen![k]);
    if (fall === l.fall && !daten.n && !listenAnders) return l;
    umgebogen++;
    const schluessel = fall === l.fall ? l.schluessel : umSchluessel(l.schluessel, p);
    if (fall !== l.fall) betroffen.add(`${schluessel}|${l.modus}`);
    return { ...l, fall, schluessel, daten: daten.d, ...(listen ? { listen } : {}) };
  });
  // Doppelte offene Läufe je Schlüssel und Modus — nur, wo ein Fall umgebogen wurde (Wiederaufnahme: auch die, die schon umgebogen sind).
  for (const l of laeufe) if (laufOffen(l) && l.fall.art === 'lead' && l.fall.id && Array.from(p.values()).includes(l.fall.id)) betroffen.add(`${l.schluessel}|${l.modus}`);
  let beendet = 0;
  for (const gruppe of betroffen) {
    const offen = laeufe.filter(l => laufOffen(l) && `${l.schluessel}|${l.modus}` === gruppe);
    if (offen.length < 2) continue;
    const bleibt = offen.reduce((a, b) => bleibenderLauf(a, b));
    laeufe = laeufe.map(l => {
      if (l === bleibt || !offen.includes(l)) return l;
      const x = abbrechen(l, jetzt, 'zusammengefuehrt');
      if (!x) return l;
      beendet++;
      return { ...x, geaendert: jetzt, zusammengefuehrtMit: bleibt.id };
    });
  }
  let zn = 0;
  const zurueckgehalten = d.zurueckgehalten.map(z => {
    const fall = umFall(z.fall, p); const daten = umDaten(z.daten ?? {}, p);
    if (fall === z.fall && !daten.n) return z;
    zn++;
    return { ...z, fall, daten: daten.d };
  });
  let tn = 0;
  const prozesse = Object.fromEntries(Object.entries(d.prozesse).map(([id, st]) => {
    if (!st.tests?.length) return [id, st];
    const tests = st.tests.map(t => { if (t.fall === 'beispiel') return t; const f = umFall(t.fall, p); if (f === t.fall) return t; tn++; return { ...t, fall: f }; });
    return [id, tests.some((t, i) => t !== st.tests![i]) ? { ...st, tests } : st];
  }));
  if (!umgebogen && !beendet && !zn && !tn) return { datei: d, umgebogen: 0, beendet: 0 };
  return { datei: { ...d, laeufe, zurueckgehalten, prozesse }, umgebogen: umgebogen + zn + tn, beendet };
}
