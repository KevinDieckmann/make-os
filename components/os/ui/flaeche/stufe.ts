// ─── Standard · Fläche — semantischer Zoom: EINE Regel neben der Kamera (21.10.; research/prozesse/ANALYSE_100.md Punkt 14) ────────────────────
// Weit weg Form und Zahl, nah dran Details — zoombare Kartenbilder werden so besser verstanden und behalten. Die Stufe kommt NUR aus dem Zoomwert der
// Kamera (./kamera.ts); kein Knoten entscheidet das selbst. Die Ansicht wechselt ihre Zeichnung nur, wenn die Stufe wechselt (kein React-Zustand je Bild).
// Rein (Tests: tests/prozesse-modell.test.ts).

export type ZoomStufe = 'fern' | 'mittel' | 'nah';
/** Unter `fernUnter` ist es „fern“ (Form, Kurztitel, Zahl), ab `nahAb` „nah“ (Details); dazwischen „mittel“ (Titel und Zahl). */
export const ZOOM_STUFEN = { fernUnter: 0.55, nahAb: 1.15 } as const;
export const zoomStufe = (s: number): ZoomStufe => (!(s > 0) ? 'mittel' : s < ZOOM_STUFEN.fernUnter ? 'fern' : s >= ZOOM_STUFEN.nahAb ? 'nah' : 'mittel');
