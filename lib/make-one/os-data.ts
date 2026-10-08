// ─── MAKE OS — Farb-Token (THEME) ───────────────────────────────────────────

// „Klar"-Palette · DARK — kühl, präzise, ein Petrol-Akzent. Spiegelt globals.css.
export const THEME = {
  // 24.09. (Kevin: „N26 und Whoop"): dieselben Werte wie das Design-System —
  // weichere Flächen, Haarlinien fast unsichtbar, Zustandsfarben leuchtend,
  // die eingebettete Schrift. Alte Seiten erben das ohne Umbau.
  void: '#0B0E10', panel: '#161B1F', panel2: '#1B2126',
  line: 'rgba(255,255,255,.07)', lineSoft: 'rgba(255,255,255,.05)', lineHot: 'rgba(88,217,205,.34)',
  ink: '#E8ECEA', inkDim: '#A2ADB0', muted: '#6E7A7D',
  accent: '#58D9CD', accentSoft: 'rgba(88,217,205,.14)', accentInk: '#7FE6DC',
  amber: '#FFC93C', crit: '#FF5C5C',
  track: 'rgba(255,255,255,.08)',
  // 24.09.: T.mono trug Labels und Zahlen — als Terminal-Schrift. Jetzt die Display-Schrift.
  mono: 'var(--schrift-display),-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  sans: 'var(--schrift-text),-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif',
};

// 08.10. spät (Datenschutz vor dem Upload): der frühere Datenteil (fester Fokus-Text, Index-Werte, Lebensrad) war
// nirgends mehr importiert und trug private Inhalte — entfernt. Hier steht nur noch das Farb-Token.
