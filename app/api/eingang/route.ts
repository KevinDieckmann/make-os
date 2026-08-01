// ─── MAKE OS — Eingang aus dem geteilten Ordner ─────────────────────────────
// Bis das System auf dem Server läuft, ist der gemeinsame iCloud-Ordner der
// Weg, auf dem Malin etwas ins System bringt: Sie schreibt in eine einfache
// Textdatei, hier wird daraus eine Aufgabe oder eine Notiz.
//
// GET  → lesen und zeigen, was ankäme (nichts wird angelegt)
// POST → wirklich anlegen; verarbeitete Zeilen werden in der Datei abgehakt
//
// Format je Zeile — bewusst so einfach, dass man es am iPhone tippen kann:
//   - Etwas erledigen                → Aufgabe für Malin
//   - !! Dringendes                  → kritisch
//   - @kevin Etwas für Kevin         → Aufgabe für Kevin
//   - ? Anmerkung oder Idee          → Notiz in den Bauplan
// Erledigte Zeilen beginnen mit „- [x]" und werden übersprungen.

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { randomUUID } from 'crypto';
import type { TasksState, Task } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDNER = path.join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Make Privat ❤️');
const DATEI = path.join(ORDNER, 'MAKE-OS Eingang.md');

const VORLAGE = `# MAKE OS · Eingang

Alles, was hier steht, holt sich das System beim nächsten Abgleich.
Eine Sache pro Zeile, mit Bindestrich davor.

**So geht's:**
- Ganz normal aufschreiben → wird eine Aufgabe für Malin
- \`!!\` davor → kritisch, kommt sofort nach oben
- \`@kevin\` davor → Aufgabe für Kevin
- \`@beide\` davor → für euch zusammen
- \`?\` davor → Anmerkung oder Idee, landet im Bauplan

Verarbeitete Zeilen werden automatisch abgehakt — einfach stehen lassen.

## Neu

-

`;

interface Zeile { roh: string; text: string; art: 'aufgabe' | 'notiz'; owner: Owner; prio: Priority }

function lies(inhalt: string): Zeile[] {
  const raus: Zeile[] = [];
  for (const z of inhalt.split(/\r?\n/)) {
    const m = z.match(/^\s*[-*]\s+(.*)$/);
    if (!m) continue;
    let t = m[1].trim();
    // Schon abgehakt oder leer? Überspringen.
    if (!t || /^\[x\]/i.test(t)) continue;
    t = t.replace(/^\[\s?\]\s*/, '').trim();
    if (!t || t.length < 3) continue;
    // Zeilen aus der Anleitung nicht als Aufgabe missverstehen.
    if (/^`|^\\?`|→/.test(t)) continue;

    let art: Zeile['art'] = 'aufgabe';
    let owner: Owner = 'malin';
    let prio: Priority = 'medium';

    if (/^\?\s*/.test(t)) { art = 'notiz'; t = t.replace(/^\?\s*/, ''); }
    if (/^!!\s*/.test(t)) { prio = 'critical'; t = t.replace(/^!!\s*/, ''); }
    else if (/^!\s*/.test(t)) { prio = 'high'; t = t.replace(/^!\s*/, ''); }
    const at = t.match(/^@(kevin|malin|beide)\s+/i);
    if (at) {
      owner = at[1].toLowerCase() === 'beide' ? 'both' : at[1].toLowerCase() as Owner;
      t = t.replace(at[0], '');
    }
    t = t.trim();
    if (t.length >= 3) raus.push({ roh: z, text: t.slice(0, 300), art, owner, prio });
  }
  return raus;
}

async function datei(): Promise<string | null> {
  try { return await fs.readFile(DATEI, 'utf8'); } catch { return null; }
}

export async function GET() {
  const inhalt = await datei();
  if (inhalt === null) {
    return NextResponse.json({ da: false, ordner: ORDNER, zeilen: [], hinweis: 'Datei noch nicht angelegt — POST mit {anlegen:true} erstellt sie.' });
  }
  return NextResponse.json({ da: true, zeilen: lies(inhalt), datei: DATEI });
}

export async function POST(req: Request) {
  let body: { anlegen?: boolean } = {};
  try { body = await req.json(); } catch { /* ohne Body ist ok */ }

  // Datei erstmalig anlegen
  if (body.anlegen) {
    try {
      await fs.mkdir(ORDNER, { recursive: true });
      await fs.writeFile(DATEI, VORLAGE, 'utf8');
      return NextResponse.json({ ok: true, angelegt: true, datei: DATEI });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Konnte nicht anlegen.' }, { status: 200 });
    }
  }

  const inhalt = await datei();
  if (inhalt === null) return NextResponse.json({ ok: false, error: 'Eingangs-Datei nicht gefunden.' }, { status: 200 });

  const zeilen = lies(inhalt);
  if (!zeilen.length) return NextResponse.json({ ok: true, aufgaben: 0, notizen: 0, hinweis: 'Nichts Neues im Eingang.' });

  const state = (await loadJson<TasksState>('tasks')) ?? { projects: [], tasks: [] };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const offen = new Set(state.tasks.filter(t => t.status !== 'done').map(t => norm(t.title)));
  const now = new Date().toISOString();
  const neue: Task[] = [];
  let notizen = 0;

  for (const z of zeilen) {
    if (z.art === 'notiz') {
      // Anmerkungen landen im Bauplan — dort gehören Ideen zum System hin.
      try {
        await fetch(`http://127.0.0.1:${process.env.PORT ?? 3001}/api/state/backlog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
          body: JSON.stringify({ titel: z.text, warum: 'Von Malin über den gemeinsamen Ordner notiert.', kategorie: 'qualitaet', prio: 2, block: 'frei', quelle: 'Eingang · Malin' }),
        });
        notizen++;
      } catch { /* Bauplan nicht erreichbar — Zeile bleibt offen */ }
      continue;
    }
    if (offen.has(norm(z.text))) continue;
    offen.add(norm(z.text));
    neue.push({
      id: `eing-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
      projectId: state.projects.some(p => p.id === 'proj-kdm') ? 'proj-kdm' : (state.projects[0]?.id ?? ''),
      title: z.text,
      description: 'Aus dem gemeinsamen Ordner übernommen.',
      status: 'todo',
      priority: z.prio,
      assignee: z.owner,
      tags: [], subTasks: [], dependencies: [],
      sortOrder: state.tasks.reduce((mx, t) => Math.max(mx, t.sortOrder ?? 0), -1) + 1 + neue.length,
      createdAt: now, updatedAt: now,
    });
  }

  if (neue.length) await saveJson<TasksState>('tasks', { projects: state.projects, tasks: [...state.tasks, ...neue] });

  // Verarbeitete Zeilen abhaken, damit nichts doppelt ankommt.
  let neuerInhalt = inhalt;
  for (const z of zeilen) {
    neuerInhalt = neuerInhalt.replace(z.roh, z.roh.replace(/^(\s*[-*]\s+)/, '$1[x] '));
  }
  try { await fs.writeFile(DATEI, neuerInhalt, 'utf8'); } catch { /* Datei gerade in Bearbeitung */ }

  return NextResponse.json({ ok: true, aufgaben: neue.length, notizen, gelesen: zeilen.length });
}
