// ─── MAKE OS — Schnell-Anlegen-Kürzel ───────────────────────────────────────
// Reine Logik, aus der Aufgaben-Ansicht herausgelöst (Härtung 04.08.), damit
// sie testbar ist: „!! kritisch · @malin · morgen · 15.08. · #capos" wird zu
// einer fertigen Aufgabe. Ein Tippfehler hier landet direkt im Board — genau
// die Sorte Code, die Tests verdient.

import { localDay } from '@/lib/zeit';
import type { Owner } from '@/types/common';
import type { Priority } from '@/types/common';

// ── Datums-Kurzhelfer fürs Schnellanlegen und die Zeilen-Aktionen ──
export const tagInT = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
export const naechsterWochentag = (idx: number) => { // 0=So … 6=Sa (JS getDay)
  const d = new Date();
  d.setDate(d.getDate() + (((idx - d.getDay()) % 7 + 7) % 7 || 7));
  return localDay(d);
};

/** Schnell-Anlegen mit Kürzeln: !! kritisch · ! hoch · heute/morgen/mo–so/TT.MM. · #projekt · @malin/@beide */
export function parseSchnell(rein: string, projekte: { id: string; title: string }[]): { title: string; priority: Priority; dueDate?: string; projectId?: string; assignee: Owner | 'both' } {
  let s = ` ${rein.trim()} `;
  let priority: Priority = 'medium';
  if (s.includes('!!')) { priority = 'critical'; s = s.replace('!!', ' '); }
  else if (s.includes('!')) { priority = 'high'; s = s.replace('!', ' '); }
  let assignee: Owner | 'both' = 'kevin';
  s = s.replace(/\s@(malin|beide|kevin)\b/i, (_, w) => { assignee = w.toLowerCase() === 'beide' ? 'both' : (w.toLowerCase() as Owner); return ' '; });
  let dueDate: string | undefined;
  s = s.replace(/\s(heute|morgen|übermorgen)\b/i, (_, w) => { dueDate = tagInT(w.toLowerCase() === 'heute' ? 0 : w.toLowerCase() === 'morgen' ? 1 : 2); return ' '; });
  if (!dueDate) s = s.replace(/\s(mo|di|mi|do|fr|sa|so)\b/i, (_, w) => { dueDate = naechsterWochentag(['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'].indexOf(w.toLowerCase())); return ' '; });
  if (!dueDate) s = s.replace(/\s(\d{1,2})\.(\d{1,2})\.?(?=\s)/, (_, tt, mm) => {
    const j = new Date().getFullYear();
    const kand = `${j}-${String(mm).padStart(2, '0')}-${String(tt).padStart(2, '0')}`;
    dueDate = kand < localDay() ? `${j + 1}${kand.slice(4)}` : kand;
    return ' ';
  });
  let projectId: string | undefined;
  s = s.replace(/\s#(\S+)/, (_, w) => {
    const p = projekte.find(x => x.title.toLowerCase().includes(String(w).toLowerCase()));
    if (p) { projectId = p.id; return ' '; }
    return ` #${w}`;
  });
  return { title: s.replace(/\s+/g, ' ').trim(), priority, dueDate, projectId, assignee };
}

