// ─── Fehlende Belege werden zu Aufgaben (24.09.) ────────────────────────────
// Ein Beleg, der der Buchhaltung fehlt, ist eine Aufgabe: „Beleg nachreichen:
// Quittung Hotel München“. Ohne Betrag im Titel — die Aufgabenliste teilen sich
// alle Konten. Gemarkt mit dem Stichwort „haushalt“, damit Agenten, die an
// Dritte berichten (OKR), sie auslassen. Nur echte Haushalte — der Test-
// Haushalt und Probeläufe schreiben nie in die echte Aufgabenliste.

import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { finanzOrtAus, gehoertZuPrivat, istGesellschaft } from '@/lib/einheiten';
import { ladeHaushalt } from './speicher';
import { heuteBerlin } from './monat';

/** Bereich eines Belegs: Privat und Privat-Einheiten (05.10.: Selbstständigkeit, `gehoertZuPrivat`) → privat, sonst Business. */
const spaceVon = (einheit: string | undefined) => (einheit === 'privat' || gehoertZuPrivat(finanzOrtAus(einheit)) ? 'privat' : 'business') as 'privat' | 'business';
/** Aufgaben-Space eines Belegs (29.09.): privat → Privat, eine Gesellschaft → ihr Space (die Selbstständigkeit: ihr Space unter Privat), sonst KD Ventures. */
const spaceIdVon = (einheit: string | undefined): string => {
  if (einheit === 'privat') return 'privat';
  const g = finanzOrtAus(einheit);
  return g && istGesellschaft(g) ? g : 'kdv';
};

export const istEchterHaushalt = (h: string) => h !== 'test' && !h.endsWith('-probe');

export async function belegAufgabenAbgleichen(haushalt: string): Promise<{ neu: number; erledigt: number }> {
  if (!istEchterHaushalt(haushalt)) return { neu: 0, erledigt: 0 };
  const h = await ladeHaushalt(haushalt);
  const heute = heuteBerlin();
  const jetzt = new Date().toISOString();
  const offen = new Map(h.belege.filter(b => b.art === 'beleg' && !b.erledigt).map(b => [`beleg-${b.id}`, b]));
  let neu = 0, erledigt = 0;
  // Über den Schreibweg (29.09., Paket T1 #12): `completedAt`, Verlauf „durch System“, Protokoll — in EINER Sperre.
  await systemAufgabenAendern(stand => {
    neu = 0; erledigt = 0;
    const rest = new Map(offen);
    const teile: { id: string; felder: Record<string, unknown> }[] = [];
    for (const t of stand.tasks) {
      if (!t.id.startsWith('beleg-') || !(t.tags ?? []).map(String).includes('haushalt')) continue;
      const b = rest.get(t.id);
      if (!b) { if (t.status !== 'done' && t.status !== 'cancelled') { erledigt++; teile.push({ id: t.id, felder: { status: 'done' } }); } continue; }
      rest.delete(t.id);
      const titel = `Beleg nachreichen: ${b.bezeichnung}`.slice(0, 200);
      // Nur gültige Tage (sonst lehnt der Schreibweg den ganzen Abgleich ab) — eine schiefe Frist bleibt, wie sie ist.
      const faellig = b.faellig_am && /^\d{4}-\d{2}-\d{2}$/.test(b.faellig_am) ? b.faellig_am : t.dueDate;
      const spaceId = spaceIdVon(b.einheit);
      const felder: Record<string, unknown> = {};
      if (titel !== t.title) felder.title = titel;
      if ((faellig ?? '') !== (t.dueDate ?? '')) felder.dueDate = faellig ?? null;
      // Privat ↔ Business: der Space entscheidet (die Übernahme leitet space/einheit daraus ab).
      if ((spaceId === 'privat') !== (t.spaceId === 'privat')) felder.spaceId = spaceId;
      if (Object.keys(felder).length) teile.push({ id: t.id, felder });
    }
    const neue = Array.from(rest.entries()).map(([id, b]) => {
      neu++;
      const wer = (b.verursacher ?? '').toLowerCase();
      return {
        id, title: `Beleg nachreichen: ${b.bezeichnung}`.slice(0, 200), description: 'Aus den Haushaltsfinanzen: dieser Beleg fehlt der Buchhaltung (sevdesk/Bank).',
        status: 'todo', priority: b.faellig_am && b.faellig_am < heute ? 'high' : 'medium', assignee: wer === 'malin' ? 'malin' : 'kevin',
        tags: ['haushalt', 'beleg'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: spaceVon(b.einheit), spaceId: spaceIdVon(b.einheit), ...(b.faellig_am ? { dueDate: b.faellig_am } : {}),
      };
    });
    return { neu: neue, teile };
  }, { jetzt });
  return { neu, erledigt };
}
