'use client';

// ─── MAKE OS — Planung: Hinweis mit „Rückgängig“ (30.09.) ───────────────────
// Wie bei den Aufgaben (#87): nach dem Löschen eines Meilensteins oder Ziels steht unten ein Hinweis mit „Rückgängig“ —
// gleiche Dauer, gleiches Aussehen. Seit 04.10. EINE Stelle für alle Listen: components/os/ui/zeile-aktionen.tsx
// (`useRueckgaengig`); hier nur noch durchgereicht, damit die Planung unverändert importiert.

export { useRueckgaengig, type Rueckgaengig } from '../ui';
