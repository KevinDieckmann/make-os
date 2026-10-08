'use client';

// ─── Agenten-Seite: Kürzel-Kugel und ZOE-Kugel (09.10., Paket 2; Fragerunde Teil 1, Antwort 2) ────────────────────────
// Fragerunde 2: „Kürzel-Kugel in Bereichsfarbe · eigene Farbe + Ton je Head · Vorname frei je Instanz · Foto-Avatar möglich ·
// kleine ZOE-Kugel-Variante.“ Die Kugel trägt die Farbe des Heads (Token aus dem Katalog, Rezept TIEF: Farbe mit Tiefe, nie
// grell), der Rand die Bereichsfarbe (Privat/Business). Ein Foto zeigt sie nur, wenn die Route eins liefert (https bzw. eigene
// Route). ZOE ist im Kopf der Mitte die echte Lichtkugel (ZoeKugel, ein WebGL-Lauf), in Listen ein ruhiges Standbild.

import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { FARBE as C, KUGEL, LEUCHT, RADIUS, SCHRIFT, TIEF, TYP } from '@/lib/make-one/design';
import type { Bereich, FarbToken } from '@/lib/agenten/typen';
import { ZoeKugel } from '../kugel';
import { kuerzel } from './regeln';
import { KUGEL_GROESSE } from './masse';

/** Farbe eines Heads aus seinem Token (Katalog: nur Token-Namen aus LEUCHT, nie Farbwerte). */
export const headFarbe = (token: FarbToken | undefined): string => (token ? LEUCHT[token] : C.aktiv);
/** Bereichsfarbe (Privat/Business) — dieselbe wie Kopf-Schalter und Leiste. */
export const bereichFarbe = (b: Bereich): string => SPACE_FARBE[b];

/** Nur ein Foto aus einer sicheren Quelle (https oder eigene Route) — sonst das Kürzel. */
export function fotoVon(o: unknown): string | null {
  const f = o && typeof o === 'object' ? (o as { foto?: unknown }).foto : undefined;
  return typeof f === 'string' && /^(https:\/\/|\/api\/)/.test(f) ? f : null;
}

export function KuerzelKugel({ name, farbe, bereich, groesse = KUGEL_GROESSE.liste, foto, punkt, puls }: {
  name: string;
  farbe: string;
  bereich?: Bereich;
  groesse?: number;
  foto?: string | null;
  /** Kleiner Zustandspunkt unten rechts (läuft, wartet). */
  punkt?: string;
  /** Kritisch pulsiert (Leitbild) — nur für „wartet auf dich“. */
  puls?: boolean;
}) {
  const ring = bereich ? bereichFarbe(bereich) : farbe;
  const klein = groesse <= KUGEL_GROESSE.klein;
  const rahmen = {
    position: 'relative' as const, width: groesse, height: groesse, flex: '0 0 auto', borderRadius: RADIUS.pille,
    border: `1px solid ${TIEF.rand(ring)}`, boxShadow: TIEF.schein(farbe, Math.round(groesse / 2)), boxSizing: 'border-box' as const,
  };
  return (
    <span aria-hidden style={{ ...rahmen, display: 'inline-grid', placeItems: 'center',
      background: foto ? C.flaeche : `radial-gradient(circle at 32% 28%, ${TIEF.rand(farbe)} 0%, ${TIEF.tiefer(farbe, 42)} 58%, ${TIEF.tiefer(farbe, 20)} 100%)` }}>
      {foto
        // eslint-disable-next-line @next/next/no-img-element -- Avatar aus der eigenen Route bzw. https, ohne Next-Bildoptimierung
        ? <img src={foto} alt="" width={groesse} height={groesse} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: RADIUS.pille }} />
        : <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: C.ink, letterSpacing: '.02em', lineHeight: 1,
          fontSize: klein ? TYP.mikro : groesse >= KUGEL_GROESSE.kopf ? TYP.body : TYP.bedien, textTransform: klein ? 'uppercase' : undefined }}>{kuerzel(name)}</span>}
      {punkt && (
        <span className={puls ? 'krit-puls' : undefined} style={{ position: 'absolute', right: -1, bottom: -1, width: Math.max(8, Math.round(groesse / 4)), height: Math.max(8, Math.round(groesse / 4)),
          borderRadius: RADIUS.pille, background: punkt, border: `2px solid ${C.grund}`, boxSizing: 'content-box' }} />
      )}
    </span>
  );
}

/** ZOEs Standbild: das Kugel-Paar (Smaragd → Granat) als ruhige Kugel — für Listen und als Rückfall ohne WebGL. */
export function ZoeStandbild({ groesse = KUGEL_GROESSE.liste, punkt }: { groesse?: number; punkt?: string }) {
  return (
    <span aria-hidden style={{ position: 'relative', width: groesse, height: groesse, flex: '0 0 auto', borderRadius: RADIUS.pille, display: 'inline-block',
      background: `radial-gradient(circle at 34% 30%, ${TIEF.rand(KUGEL.smaragd)} 0%, ${TIEF.tiefer(KUGEL.smaragd, 50)} 46%, ${TIEF.tiefer(KUGEL.granat, 38)} 100%)`,
      border: `1px solid ${TIEF.rand(KUGEL.smaragd)}`, boxShadow: TIEF.schein(KUGEL.granat, Math.round(groesse / 2)), boxSizing: 'border-box' }}>
      {punkt && <span style={{ position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: RADIUS.pille, background: punkt, border: `2px solid ${C.grund}` }} />}
    </span>
  );
}

/** ZOE im Kopf der Mitte: die echte Lichtkugel (klein, 24 Bilder/s, pausiert außer Sicht), ohne WebGL das Standbild. */
export function ZoeKopfKugel({ denkt }: { denkt: boolean }) {
  const g = KUGEL_GROESSE.kopf;
  return (
    <span aria-hidden style={{ position: 'relative', width: g, height: g, flex: '0 0 auto', display: 'inline-block' }}>
      <ZoeKugel groesse="symbol" zustand={denkt ? 'denkt' : 'ruht'} rueckfall={<ZoeStandbild groesse={g} />} />
    </span>
  );
}
