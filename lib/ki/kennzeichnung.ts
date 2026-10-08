// ─── KI-VO Art. 50 für erzeugte Medien (09.10.2026, Paket 6a) — rein, Server UND Browser ──────────────────────────────────
// Kevin 08.10. (Antwort 21): „Kennzeichnung nie entfernen · sichtbares Zeichen bei realistischen Personen/Orten“.
// Recherche (MODELLE.md 2.8, 4.6): Art. 50 gilt seit 02.08.2026; die Übergangsfrist bis 02.12.2026 (Digital Omnibus, VO (EU) 2026/1744)
// gilt nur für Systeme, die vor dem 02.08.2026 auf dem Markt waren — NEUE Funktionen kennzeichnen sofort. Der Verhaltenskodex verlangt,
// wo nötig, mindestens ZWEI maschinenlesbare Schichten: (1) die Kennzeichnung des Anbieters in der Datei (SynthID in den Pixeln/Frames,
// C2PA in den Metadaten — nie entfernen, nie umkodieren, nie durch lib/netzwerken/bild-bereinigen.ts), (2) unsere Herkunftsangabe am
// Medium (`KiMedium.kennzeichnung`, `herkunftsAngabe`) plus `kiKennzeichen` in jeder Antwort. Sichtbar zusätzlich bei realistischen
// Personen oder Orten (Deepfake, Art. 50 Abs. 4) — die Oberfläche fragt das beim Erzeugen ab und zeigt `sichtbaresZeichen`.
// Hinweis, keine Rechtsberatung — Umfang einmal anwaltlich gegenlesen (KI_VO.md K7).

import { anbieterVon, type AnbieterId, type Kennzeichnung } from './anbieter';

export interface SichtbarAngabe {
  /** Wirkt das Medium wie eine echte Aufnahme (fotorealistisch, Video, Ton)? */
  realistisch: boolean;
  /** Zeigt es (erkennbare) Menschen? */
  personen?: boolean;
  /** Zeigt es echte bzw. echt wirkende Orte? */
  orte?: boolean;
}
export interface SichtbaresZeichen { noetig: boolean; text: string; grund: string }

export const SICHTBAR_TEXT = 'KI-generiert';

/** Braucht das Medium ein sichtbares Zeichen? (Kevin 08.10.: bei realistischen Personen/Orten — sonst genügt die maschinenlesbare Kennzeichnung.) */
export function sichtbaresZeichen(a: SichtbarAngabe): SichtbaresZeichen {
  const noetig = !!a.realistisch && (!!a.personen || !!a.orte);
  return {
    noetig,
    text: SICHTBAR_TEXT,
    grund: noetig ? 'realistische Darstellung von Personen oder Orten (KI-VO Art. 50 Abs. 4) — beim Veröffentlichen sichtbar „KI-generiert“ zeigen' : 'maschinenlesbare Kennzeichnung des Anbieters genügt; in MAKE OS trotzdem mit KI-Marke',
  };
}

/** Was der Anbieter in die Datei einbettet (für `KiMedium.kennzeichnung`). */
export function anbieterKennzeichnung(anbieter: AnbieterId): Record<Kennzeichnung, boolean> {
  const k = anbieterVon(anbieter).kennzeichnung;
  return { synthid: k.includes('synthid'), c2pa: k.includes('c2pa') };
}

/** Zweite Schicht beim Export/Download: eine kleine Herkunftsangabe (JSON-Begleitdatei bzw. Metadatenfeld). */
export function herkunftsAngabe(m: { anbieter: AnbieterId; modell: string; erzeugtAm: string; art: 'bild' | 'video' | 'audio'; sichtbar?: SichtbarAngabe }): Record<string, unknown> {
  return {
    ki_generiert: true,
    hinweis: `${SICHTBAR_TEXT} (${anbieterVon(m.anbieter).name}, ${m.modell}, ${m.erzeugtAm.slice(0, 10)})`,
    art: m.art, anbieter: m.anbieter, modell: m.modell, erzeugt_am: m.erzeugtAm,
    eingebettet: anbieterKennzeichnung(m.anbieter),
    sichtbares_zeichen: m.sichtbar ? sichtbaresZeichen(m.sichtbar).noetig : false,
    rechtsgrundlage: 'KI-VO Art. 50 Abs. 2 und 4',
  };
}
