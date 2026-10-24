// ─── Einpassen — „Alles zeigen“ mit Rand für die schwebenden Leisten (Feinschliff 1, 23.10.; Sichtprüfung 22.10. im Vollbild) ─────────────────────────
// Befund: im Werkzeugmodus schweben Kopfzeile (oben), Werkzeugleiste (links), Zoom und „Head fragen“ (unten) und das Seitenfeld (rechts) ÜBER der Fläche —
// „Alles zeigen“ setzte den Inhalt mittig in die ganze Bühne, linke Kacheln lagen unter der Werkzeugleiste, Phase 3 unter dem Seitenfeld. Hier steht EINE
// Rechnung für beides (Landkarte: components/os/ui/flaeche/kamera.ts `allesZeigen`; Werkstatt: lib/prozesse/werkstatt-lage.ts `einpassKamera` usw.):
//   · `raenderAus`   aus den Rechtecken der schwebenden Leisten die Ränder je Seite — jede Leiste zählt an der Seite, an der sie am wenigsten Platz kostet
//                    (eine Ecke unten links zählt unten, das Seitenfeld rechts zählt rechts). Leisten außerhalb der Bühne zählen nicht.
//   · `freiesFeld`   der freie Teil der Bühne; bleibt in einer Richtung zu wenig Platz (`FREI_MIN_ANTEIL`), gilt dort die ganze Bühne (lieber etwas verdeckt
//                    als winzig).
//   · `einpassen`    die Kamera, die eine Box mit Rand mittig in das freie Feld setzt (Zoom zwischen `min` und `max`).
// Rein, ohne DOM (Server UND Browser); das Messen der Leisten macht components/os/ui/flaeche/schwebe.ts. Tests: tests/feinschliff-1.test.ts.

export interface Raender { links: number; oben: number; rechts: number; unten: number }
export interface Feld { x: number; y: number; b: number; h: number }
export interface KameraWert { s: number; x: number; y: number }

export const OHNE_RAENDER: Readonly<Raender> = Object.freeze({ links: 0, oben: 0, rechts: 0, unten: 0 });
/** Eine Leiste zählt nur an einer Seite, der sie höchstens so nahe ist (Bildschirm-px) — eine Leiste mitten im Bild verschiebt nichts. */
export const SCHWEBE_NAEHE = 120;
/** Luft zwischen einer Leiste und dem Inhalt (Bildschirm-px). */
export const SCHWEBE_LUFT = 8;
/** Bleibt weniger als dieser Anteil der Bühne frei, zählen die Ränder dieser Richtung nicht. */
export const FREI_MIN_ANTEIL = 0.35;

const endlich = (v: number) => (Number.isFinite(v) ? v : 0);
const schneidet = (a: Feld, b: Feld) => a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h;

/** Die Ränder aus den schwebenden Leisten (alles Bildschirm-Rechtecke; rein). */
export function raenderAus(buehne: Feld, leisten: readonly Feld[], o: { naehe?: number; luft?: number } = {}): Raender {
  const naehe = o.naehe ?? SCHWEBE_NAEHE, luft = o.luft ?? SCHWEBE_LUFT;
  const r: Raender = { ...OHNE_RAENDER };
  for (const l of leisten) {
    if (!(l.b > 0 && l.h > 0) || !schneidet(l, buehne)) continue;
    // Je Seite: wie weit die Leiste vom Rand weg ist und wie viel Rand sie bräuchte.
    const seiten: { seite: keyof Raender; abstand: number; bedarf: number }[] = [
      { seite: 'links', abstand: l.x - buehne.x, bedarf: l.x + l.b - buehne.x + luft },
      { seite: 'oben', abstand: l.y - buehne.y, bedarf: l.y + l.h - buehne.y + luft },
      { seite: 'rechts', abstand: buehne.x + buehne.b - (l.x + l.b), bedarf: buehne.x + buehne.b - l.x + luft },
      { seite: 'unten', abstand: buehne.y + buehne.h - (l.y + l.h), bedarf: buehne.y + buehne.h - l.y + luft },
    ];
    const nah = seiten.filter(s => s.abstand <= naehe);
    if (!nah.length) continue;
    const beste = nah.reduce((a, b) => (b.bedarf < a.bedarf ? b : a));
    r[beste.seite] = Math.max(r[beste.seite], Math.round(endlich(beste.bedarf)));
  }
  return r;
}

/** Der freie Teil der Bühne (rein). In einer Richtung mit zu wenig Platz gilt dort die ganze Bühne. */
export function freiesFeld(buehne: { b: number; h: number }, r: Raender = OHNE_RAENDER): Feld {
  const B = Math.max(1, buehne.b), H = Math.max(1, buehne.h);
  const quer = B - r.links - r.rechts >= B * FREI_MIN_ANTEIL;
  const hoch = H - r.oben - r.unten >= H * FREI_MIN_ANTEIL;
  return {
    x: quer ? r.links : 0, y: hoch ? r.oben : 0,
    b: quer ? B - r.links - r.rechts : B, h: hoch ? H - r.oben - r.unten : H,
  };
}

/** Die Kamera, die `box` (Welt) mit `rand` mittig ins freie Feld der Bühne setzt — Zoom zwischen `min` und `max` (rein). */
export function einpassen(box: Feld, buehne: { b: number; h: number }, o: { raender?: Raender; rand?: number; min?: number; max?: number } = {}): KameraWert {
  const f = freiesFeld(buehne, o.raender);
  const rand = o.rand ?? 40, min = o.min ?? 0.15, max = o.max ?? 1;
  const b = Math.max(1, box.b), h = Math.max(1, box.h);
  const s = Math.max(min, Math.min(max, (f.b - 2 * rand) / b, (f.h - 2 * rand) / h));
  return { s, x: Math.round(f.x + (f.b - b * s) / 2 - box.x * s), y: Math.round(f.y + (f.h - h * s) / 2 - box.y * s) };
}
