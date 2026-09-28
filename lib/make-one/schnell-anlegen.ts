// ─── MAKE OS — Schnell-Anlegen-Kürzel ───────────────────────────────────────
// Reine Logik, aus der Aufgaben-Ansicht herausgelöst (Härtung 04.08.), damit
// sie testbar ist: „!! kritisch · @malin · morgen · 15.08. · #capos" wird zu
// einer fertigen Aufgabe. Ein Tippfehler hier landet direkt im Board — genau
// die Sorte Code, die Tests verdient.
// Seit 29.09. (#21): Wochentags-Kürzel (mo … so) nur als LETZTES Wort oder mit Präfix („am fr“, „bis mo“) — „so schnell
// wie möglich“ bekam vorher Sonntag als Frist. Ausgeschriebene Wochentage („freitag“) gelten überall. Datum „TT.MM.“ bzw.
// „TT.MM.JJJJ“ nur, wenn es den Kalendertag gibt („31.02.“ bleibt im Titel, mit Hinweis). `schnellVorschau` zeigt vor dem
// Speichern, was erkannt wurde („Fr 02.10.“).

import { localDay } from '@/lib/zeit';
import { istTag, kurzTag, tagPlus, wochentag } from '@/lib/aufgaben/wiederholung';
import type { Owner } from '@/types/common';
import type { Priority } from '@/types/common';

// ── Datums-Kurzhelfer fürs Schnellanlegen und die Zeilen-Aktionen ──
export const tagInT = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
export const naechsterWochentag = (idx: number) => { // 0=So … 6=Sa (JS getDay)
  const d = new Date();
  d.setDate(d.getDate() + (((idx - d.getDay()) % 7 + 7) % 7 || 7));
  return localDay(d);
};

const KURZ: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
const LANG: Record<string, number> = { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6 };
/** Nächster Tag mit diesem Wochentag NACH `heute` (heute selbst zählt nicht — „fr“ am Freitag = nächste Woche). */
const naechsterAb = (heute: string, wt: number) => tagPlus(heute, ((wt - wochentag(heute)) % 7 + 7) % 7 || 7);

export interface SchnellErgebnis {
  title: string;
  priority: Priority;
  dueDate?: string;
  projectId?: string;
  assignee: Owner | 'both';
  /** Wurde die Zuständigkeit ausdrücklich getippt (@…)? Sonst ist `assignee` nur der alte Standard. */
  zustaendigGetippt: boolean;
  /** Ein getipptes Datum, das es nicht gibt (z. B. „31.02.“) — bleibt im Titel. */
  datumUngueltig?: string;
}

/** Schnell-Anlegen mit Kürzeln: !! kritisch · ! hoch · heute/morgen/übermorgen · [am|bis] mo–so · freitag · TT.MM.[JJJJ] · #projekt · @malin/@beide */
export function parseSchnell(rein: string, projekte: { id: string; title: string }[], heute: string = localDay()): SchnellErgebnis {
  let s = ` ${rein.trim()} `;
  let priority: Priority = 'medium';
  if (s.includes('!!')) { priority = 'critical'; s = s.replace('!!', ' '); }
  else if (s.includes('!')) { priority = 'high'; s = s.replace('!', ' '); }
  let assignee: Owner | 'both' = 'kevin';
  let zustaendigGetippt = false;
  s = s.replace(/\s@(malin|beide|kevin)\b/i, (_, w) => { zustaendigGetippt = true; assignee = w.toLowerCase() === 'beide' ? 'both' : (w.toLowerCase() as Owner); return ' '; });
  let projectId: string | undefined;
  s = s.replace(/\s#(\S+)/, (_, w) => {
    const p = projekte.find(x => x.title.toLowerCase().includes(String(w).toLowerCase()));
    if (p) { projectId = p.id; return ' '; }
    return ` #${w}`;
  });
  let dueDate: string | undefined;
  let datumUngueltig: string | undefined;
  s = s.replace(/\s(heute|morgen|übermorgen)(?=\s)/i, (_, w) => { const x = w.toLowerCase(); dueDate = tagPlus(heute, x === 'heute' ? 0 : x === 'morgen' ? 1 : 2); return ' '; });
  // Wochentag: mit Präfix irgendwo, ausgeschrieben irgendwo, Kürzel nur als letztes Wort.
  if (!dueDate) s = s.replace(/\s(?:am|bis|ab|nächsten|naechsten|kommenden)\s(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\.?(?=\s)/i, (_, w) => { const k = w.toLowerCase(); dueDate = naechsterAb(heute, KURZ[k] ?? LANG[k]); return ' '; });
  if (!dueDate) s = s.replace(/\s(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?=\s)/i, (_, w) => { dueDate = naechsterAb(heute, LANG[w.toLowerCase()]); return ' '; });
  if (!dueDate) s = s.replace(/\s(mo|di|mi|do|fr|sa|so)\.?\s*$/i, (_, w) => { dueDate = naechsterAb(heute, KURZ[w.toLowerCase()]); return ' '; });
  if (!dueDate) s = s.replace(/\s(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?=\s)/, (ganz, tt, mm, jj) => {
    const zwei = (x: string) => String(x).padStart(2, '0');
    const j = Number(heute.slice(0, 4));
    if (jj) {
      const jahr = jj.length === 2 ? 2000 + Number(jj) : Number(jj);
      const kand = `${jahr}-${zwei(mm)}-${zwei(tt)}`;
      if (!istTag(kand)) { datumUngueltig = ganz.trim(); return ganz; }
      dueDate = kand; return ' ';
    }
    // Vergangen → nächstes Jahr; den Tag muss es im gewählten Jahr geben (29.02. → das nächste Schaltjahr).
    let wahl: string | null = null;
    for (let k = 0; k <= 4 && !wahl; k++) { const kand = `${j + k}-${zwei(mm)}-${zwei(tt)}`; if (istTag(kand) && kand >= heute) wahl = kand; }
    if (!wahl) { datumUngueltig = ganz.trim(); return ganz; }
    dueDate = wahl; return ' ';
  });
  return { title: s.replace(/\s+/g, ' ').trim(), priority, dueDate, projectId, assignee, zustaendigGetippt, ...(datumUngueltig ? { datumUngueltig } : {}) };
}

const PRIO_TEXT: Record<Priority, string> = { critical: 'kritisch', high: 'hoch', medium: '', low: 'niedrig' };

/** Was vor dem Speichern angezeigt wird: „Fr 02.10. · kritisch · @malin · #Projekt“ (leer, wenn nichts erkannt). */
export function schnellVorschau(p: SchnellErgebnis, projekte: { id: string; title: string }[], namen: Record<string, string> = {}): string[] {
  const teile: string[] = [];
  if (p.dueDate) teile.push(kurzTag(p.dueDate));
  if (PRIO_TEXT[p.priority]) teile.push(PRIO_TEXT[p.priority]);
  if (p.zustaendigGetippt) teile.push(p.assignee === 'both' ? '@beide' : `@${namen[p.assignee] ?? p.assignee}`);
  if (p.projectId) teile.push(`#${projekte.find(x => x.id === p.projectId)?.title ?? p.projectId}`);
  return teile;
}
