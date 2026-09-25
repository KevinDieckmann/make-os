// ─── Markttraktion — Übergabe an Kevin oder Malin (Server) ──────────────────
// Genutzt von /api/crm/uebergabe und Jarvis (Werkzeug uebergeben). Wirkung:
// Zuständigkeit wechselt (Kontakt: „Hält die Beziehung“, Chance: besitzer,
// sonst zustaendig), am Kontakt steht die Übergabe im Verlauf, mit Notiz und
// Frist wird sie dort zum nächsten Schritt (→ Power Hour der anderen Person),
// und die andere Person bekommt eine Aufgabe mit Link. Nichts wird versendet.

import { updateJson } from '@/lib/store/local-db';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from './speicher';
import { wer, nameVon, BEIDE } from './team';
import { markttraktion } from './adresse';
import type { CrmBestand, CrmListe } from './typen';

export const UEBERGABE_ARTEN = ['kontakt', 'kontakte', 'chance', 'mandat', 'event', 'kampagne', 'beitrag', 'newsletter'] as const;
type Art = typeof UEBERGABE_ARTEN[number];
const LISTE: Partial<Record<Art, CrmListe>> = { chance: 'chancen', mandat: 'mandate', event: 'events', kampagne: 'kampagnen', beitrag: 'beitraege', newsletter: 'newsletter' };
const ZIEL: Partial<Record<Art, [string, string?]>> = { chance: ['sales', 'pipeline'], mandat: ['sales', 'kunden'], event: ['event'], kampagne: ['sales', 'kampagnen'], beitrag: ['marketing', 'redaktion'], newsletter: ['marketing', 'newsletter'] };
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export interface UebergabeEingabe { art?: string; id?: string; ids?: string[]; an?: string; notiz?: string; frist?: string }
export type UebergabeErgebnis = { ok: true; anzahl: number; an: string; aufgabe: boolean; text: string } | { ok: false; fehler: string; status: number };

export async function uebergeben(b: UebergabeEingabe, person: string): Promise<UebergabeErgebnis> {
  const art = UEBERGABE_ARTEN.includes(b.art as Art) ? (b.art as Art) : null;
  const an = wer(b.an);
  const notiz = String(b.notiz ?? '').trim().slice(0, 600);
  const frist = tagOk(b.frist);
  if (!art || !an) return { ok: false, fehler: 'art und an (kevin, malin, beide) nötig.', status: 400 };
  const jetzt = new Date().toISOString();
  const vonName = nameVon(person);
  let titel = '';
  let link = '';
  let anzahl = 0;

  if (art === 'kontakt' || art === 'kontakte') {
    const ids = new Set((art === 'kontakt' ? [b.id] : (b.ids ?? [])).map(String).filter(x => /^c-[a-z0-9-]{4,60}$/.test(x)).slice(0, 300));
    if (!ids.size) return { ok: false, fehler: 'Keine gültigen Kontakte.', status: 400 };
    const namen: string[] = [];
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
      const f = cur ?? { kontakte: [] };
      return { ...f, kontakte: f.kontakte.map(k => {
        if (!ids.has(k.id) || k.werbesperre) return k;
        anzahl++; namen.push(anzeigename(k));
        const eintrag = { am: jetzt, art: 'uebergabe' as const, von: person, text: `an ${nameVon(an)}${notiz ? `: ${notiz}` : ''}` };
        return { ...k, besitzer: an, aktivitaeten: [...(k.aktivitaeten ?? []), eintrag], geaendertAm: jetzt.slice(0, 10),
          ...(art === 'kontakt' && notiz && frist ? { naechsterSchritt: { text: notiz.slice(0, 300), datum: frist } } : {}) };
      }) };
    });
    if (!anzahl) return { ok: false, fehler: 'Nichts übergeben — gesperrt oder nicht gefunden.', status: 404 };
    titel = anzahl === 1 ? namen[0] : `${anzahl} Kontakte`;
    link = art === 'kontakt' ? markttraktion('kontakte', undefined, Array.from(ids)[0]) : `${markttraktion('kontakte')}&wer=${an}`;
  } else {
    const liste = LISTE[art]!;
    const id = String(b.id ?? '');
    const feld = art === 'chance' ? 'besitzer' : 'zustaendig';
    await aendereCrm(c => {
      const l = c[liste] as unknown as ({ id: string; titel?: string; name?: string; kunde?: string } & Record<string, unknown>)[];
      const i = l.findIndex(x => x.id === id);
      if (i < 0) return c;
      const x = l[i];
      anzahl = 1; titel = String(x.titel ?? x.name ?? x.kunde ?? id);
      const neu = [...l]; neu[i] = { ...x, [feld]: an, geaendert: jetzt, geaendertVon: person };
      // Schreibt jetzt die Stimme selbst, braucht es keine Freigabe mehr.
      if (liste === 'beitraege' && x.freigabe && x.stimme === an) delete (neu[i] as Record<string, unknown>).freigabe;
      return { ...c, [liste]: neu } as CrmBestand;
    });
    if (!anzahl) return { ok: false, fehler: 'Eintrag nicht gefunden.', status: 404 };
    const [s, a] = ZIEL[art]!;
    link = markttraktion(s, a);
  }

  // Die andere Person bekommt eine Aufgabe — nicht, wer sich selbst etwas gibt, und nicht bei „beide“.
  let aufgabe = false;
  if (an !== person && an !== BEIDE) {
    await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      const t = { id: `ueb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: `Von ${vonName}: ${titel}`.slice(0, 200),
        description: `${vonName} hat dir ${art === 'kontakte' ? `${anzahl} Kontakte` : titel} in der Markttraktion übergeben.${notiz ? `\n\n„${notiz}“` : ''}\n\n${link}`,
        status: 'todo', priority: 'medium', assignee: an, tags: ['markttraktion', 'uebergabe'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(frist ? { dueDate: frist } : {}) };
      return { ...f, tasks: [...(f.tasks ?? []), t] };
    });
    aufgabe = true;
  }
  return { ok: true, anzahl, an, aufgabe, text: `${titel} → ${nameVon(an)}${aufgabe ? ' · Aufgabe angelegt' : ''}` };
}
