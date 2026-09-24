// ─── Fehlende Belege werden zu Aufgaben (24.09.) ────────────────────────────
// Ein Beleg, der der Buchhaltung fehlt, ist eine Aufgabe: „Beleg nachreichen:
// Quittung Hotel München“. Ohne Betrag im Titel — die Aufgabenliste teilen sich
// alle Konten. Gemarkt mit dem Stichwort „haushalt“, damit Agenten, die an
// Dritte berichten (OKR), sie auslassen. Nur echte Haushalte — der Test-
// Haushalt und Probeläufe schreiben nie in die echte Aufgabenliste.

import { updateJson } from '@/lib/store/local-db';
import { ladeHaushalt } from './speicher';
import { heuteBerlin } from './monat';

interface Aufgabe {
  id: string; title: string; description?: string; status: string; priority: string; assignee?: string;
  tags?: string[]; subTasks?: unknown[]; dependencies?: unknown[]; sortOrder?: number; createdAt?: string; updatedAt?: string; dueDate?: string; projectId?: string;
}

export const istEchterHaushalt = (h: string) => h !== 'test' && !h.endsWith('-probe');

export async function belegAufgabenAbgleichen(haushalt: string): Promise<{ neu: number; erledigt: number }> {
  if (!istEchterHaushalt(haushalt)) return { neu: 0, erledigt: 0 };
  const h = await ladeHaushalt(haushalt);
  const heute = heuteBerlin();
  const jetzt = new Date().toISOString();
  const offen = new Map(h.belege.filter(b => b.art === 'beleg' && !b.erledigt).map(b => [`beleg-${b.id}`, b]));
  let neu = 0, erledigt = 0;
  await updateJson<{ tasks: Aufgabe[]; projects?: unknown[] }>('tasks', cur => {
    const f = cur ?? { tasks: [] };
    const tasks = (f.tasks ?? []).map(t => {
      if (!t.id.startsWith('beleg-') || !(t.tags ?? []).includes('haushalt')) return t;
      const b = offen.get(t.id);
      if (!b) { if (t.status !== 'done') { erledigt++; return { ...t, status: 'done', updatedAt: jetzt }; } return t; }
      offen.delete(t.id);
      const titel = `Beleg nachreichen: ${b.bezeichnung}`.slice(0, 200);
      return titel === t.title && (b.faellig_am ?? undefined) === t.dueDate ? t : { ...t, title: titel, dueDate: b.faellig_am ?? undefined, updatedAt: jetzt };
    });
    for (const [id, b] of Array.from(offen.entries())) {
      neu++;
      const wer = (b.verursacher ?? '').toLowerCase();
      tasks.push({
        id, title: `Beleg nachreichen: ${b.bezeichnung}`.slice(0, 200), description: 'Aus den Haushaltsfinanzen: dieser Beleg fehlt der Buchhaltung (sevdesk/Vivid).',
        status: 'todo', priority: b.faellig_am && b.faellig_am < heute ? 'high' : 'medium', assignee: wer === 'malin' ? 'malin' : 'kevin',
        tags: ['haushalt', 'beleg'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(b.faellig_am ? { dueDate: b.faellig_am } : {}),
      });
    }
    return { ...f, tasks };
  });
  return { neu, erledigt };
}
