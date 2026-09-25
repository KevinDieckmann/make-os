// ─── Privat-Index — Speicher (Server) ───────────────────────────────────────
// Je Haushalt: die Rücklage (Notgroschen, von euch eingetragen), eigene
// Schwellen und ein Schnappschuss am Tag für Verlauf und Ampel-Wechsel.
// Gelesen wird nur der Haushalt der anfragenden Person — nie Business, nie
// ein anderer Haushalt.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { heuteBerlin, tagPlus } from '@/lib/finanzen/haushalt/monat';
import type { Ampel, Schwelle } from '@/lib/kennzahlen/kern';
import { berechnePrivat, privatFrisch, PRIVAT_KENNZAHLEN, type PrivatIndex } from './index';

export interface PrivatTag { index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null>; ampeln: Record<string, Ampel> }
export interface PrivatDatei {
  ruecklage: { betrag: number; stand: string; von: string } | null;
  schwellen: Record<string, Schwelle>;
  tage: Record<string, PrivatTag>;
}

const name = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `privat-index--${haushalt}`;
};
const leer = (): PrivatDatei => ({ ruecklage: null, schwellen: {}, tage: {} });

export async function ladePrivatDatei(haushalt: string): Promise<PrivatDatei> {
  return { ...leer(), ...((await loadJson<PrivatDatei>(name(haushalt))) ?? {}) };
}

function tag(pi: PrivatIndex): PrivatTag {
  const werte: Record<string, number | null> = {}, ampeln: Record<string, Ampel> = {};
  for (const s of pi.saeulen) for (const k of s.kennzahlen) { werte[k.id] = k.wert; ampeln[k.id] = k.ampel; }
  return { index: pi.index, saeulen: Object.fromEntries(pi.saeulen.map(s => [s.id, s.score])), werte, ampeln };
}

export interface PrivatStand {
  pi: PrivatIndex;
  frisch: boolean;
  ruecklage: PrivatDatei['ruecklage'];
  verlauf: { tag: string; index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null> }[];
  vor30: number | null;
  wechsel: { id: string; von: Ampel; nach: Ampel; seit: string }[];
}

/** Rechnet den Index des Haushalts, schreibt einmal am Tag den Schnappschuss (400 Tage). */
export async function privatStand(haushalt: string, heute = heuteBerlin()): Promise<PrivatStand> {
  const [h, d] = await Promise.all([ladeHaushalt(haushalt), ladePrivatDatei(haushalt)]);
  const bestand = { heute, haushalt: h, ruecklage: d.ruecklage, schwellen: d.schwellen };
  const pi = berechnePrivat(bestand);
  if (!d.tage[heute] && h.buchungen.length) {
    await updateJson<PrivatDatei>(name(haushalt), alt => {
      const neu = { ...leer(), ...(alt ?? {}) };
      neu.tage = { ...neu.tage, [heute]: tag(pi) };
      const tage = Object.keys(neu.tage).sort();
      for (const t of tage.slice(0, Math.max(0, tage.length - 400))) delete neu.tage[t];
      return neu;
    }).catch(() => null);
  }
  const frueher = Object.keys(d.tage).filter(t => t < heute).sort();
  const vorher = frueher.at(-1);
  const t30 = frueher.filter(t => t <= tagPlus(heute, -30)).at(-1) ?? frueher[0];
  const wechsel: PrivatStand['wechsel'] = [];
  if (vorher) for (const s of pi.saeulen) for (const k of s.kennzahlen) {
    const a = d.tage[vorher].ampeln[k.id];
    if (a && a !== k.ampel && a !== 'grau' && k.ampel !== 'grau') wechsel.push({ id: k.id, von: a, nach: k.ampel, seit: vorher });
  }
  const verlauf = frueher.slice(-90).map(t => ({ tag: t, index: d.tage[t].index, saeulen: d.tage[t].saeulen, werte: d.tage[t].werte }));
  verlauf.push({ tag: heute, ...tag(pi) });
  return { pi, frisch: privatFrisch(bestand), ruecklage: d.ruecklage, verlauf, vor30: t30 ? d.tage[t30].index : null, wechsel };
}

/** Nur rechnen, nichts schreiben — für den Wachstums-Score. */
export async function privatIndexFuer(haushalt: string, heute = heuteBerlin()): Promise<{ pi: PrivatIndex; frisch: boolean }> {
  const [h, d] = await Promise.all([ladeHaushalt(haushalt), ladePrivatDatei(haushalt)]);
  const bestand = { heute, haushalt: h, ruecklage: d.ruecklage, schwellen: d.schwellen };
  return { pi: berechnePrivat(bestand), frisch: privatFrisch(bestand) };
}

const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);

/** Rücklage (Euro) oder eigene Schwelle setzen/zurücksetzen. */
export async function speicherePrivat(haushalt: string, roh: Record<string, unknown>, von: string): Promise<{ ok: true } | { ok: false; fehler: string }> {
  let fehler: string | null = null;
  await updateJson<PrivatDatei>(name(haushalt), alt => {
    const neu = { ...leer(), ...(alt ?? {}) };
    if ('ruecklage' in roh) {
      if (roh.ruecklage === null || roh.ruecklage === '') neu.ruecklage = null;
      else {
        const n = zahl(roh.ruecklage);
        if (!Number.isFinite(n) || n < 0 || n > 1e8) { fehler = 'Rücklage bitte als Betrag in Euro, z. B. 12.000.'; return alt ?? neu; }
        neu.ruecklage = { betrag: Math.round(n * 100), stand: heuteBerlin(), von };
      }
    }
    if (roh.schwelle && typeof roh.schwelle === 'object') {
      const s = roh.schwelle as Record<string, unknown>;
      const k = PRIVAT_KENNZAHLEN.find(x => x.id === s.id);
      if (!k) { fehler = 'Unbekannte Kennzahl.'; return alt ?? neu; }
      const liste = { ...neu.schwellen };
      if (s.zuruecksetzen === true) delete liste[k.id];
      else {
        const gruen = zahl(s.gruen), rot = zahl(s.rot);
        if (!Number.isFinite(gruen) || !Number.isFinite(rot)) { fehler = 'Grün und Rot bitte als Zahl.'; return alt ?? neu; }
        if (k.richtung === 'hoch' ? gruen <= rot : gruen >= rot) { fehler = k.richtung === 'hoch' ? 'Mehr ist besser: Grün muss über Rot liegen.' : 'Weniger ist besser: Grün muss unter Rot liegen.'; return alt ?? neu; }
        liste[k.id] = { gruen, rot };
      }
      neu.schwellen = liste;
    }
    return neu;
  });
  return fehler ? { ok: false, fehler } : { ok: true };
}
