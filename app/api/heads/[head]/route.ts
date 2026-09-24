// ─── Die Heads: Sales, Marketing, Event ─────────────────────────────────────
// GET  → Freigabe-Liste, letzte Berichte, Modi
// POST { aktion: 'lauf', modus, frage? } → ein Lauf (Hand oder Jarvis)
// POST { aktion: 'daten', modus } → das Datenpaket, das der Head sähe (ohne Modell)
// POST { aktion: 'entscheiden', id, status } → angenommen: mit Person und
//      Frist wird es deren nächster Schritt (erscheint dann in der Power
//      Hour), sonst eine Aufgabe. Nichts wird versendet.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import type { Kontakt } from '@/lib/make-one/crm';
import { HEADS, HEAD_NAME, MODI, AGENT_ID, type HeadId } from '@/lib/heads/prompt';
import { headLauf } from '@/lib/heads/lauf';
import { datenpaket } from '@/lib/heads/daten';
import { ladeCrm } from '@/lib/crm/speicher';
import { localDay } from '@/lib/zeit';
import { leererStand, standName, type HeadStand, type HeadVorschlag, type Status } from '@/lib/heads/stand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 400;

const headAus = (p: { head: string }) => (HEADS.includes(p.head as HeadId) ? (p.head as HeadId) : null);

export async function GET(_: Request, { params }: { params: { head: string } }) {
  const h = headAus(params);
  if (!h) return NextResponse.json({ ok: false, fehler: 'Unbekannter Head.' }, { status: 404 });
  const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(h))) ?? {}) };
  return NextResponse.json({ ok: true, head: h, name: HEAD_NAME[h], modi: MODI[h], vorschlaege: s.vorschlaege, berichte: s.berichte.slice(-5).reverse(), letzte: s.letzte, ruhig: s.ruhig ?? null });
}

export async function POST(req: Request, { params }: { params: { head: string } }) {
  const h = headAus(params);
  if (!h) return NextResponse.json({ ok: false, fehler: 'Unbekannter Head.' }, { status: 404 });
  let b: { aktion?: string; modus?: string; frage?: string; ausgeloest?: string; id?: string; status?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);

  if (b.aktion === 'lauf') {
    const r = await headLauf({ head: h, modus: String(b.modus ?? 'frage'), person, frage: b.frage ? String(b.frage) : undefined, ausgeloest: b.ausgeloest === 'takt' ? 'takt' : b.ausgeloest === 'jarvis' ? 'jarvis' : 'hand' });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (b.aktion === 'daten') {
    const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    const st = { ...leererStand(), ...((await loadJson<HeadStand>(standName(h))) ?? {}) };
    const d = datenpaket(h, String(b.modus ?? MODI[h][0].id), kontakte, await ladeCrm(), localDay(), person, st.vorschlaege.map(v => ({ titel: v.titel, status: v.status })));
    return NextResponse.json({ ok: true, daten: d, zeichen: JSON.stringify(d).length });
  }

  if (b.aktion === 'entscheiden') {
    const status = (['angenommen', 'abgelehnt', 'erledigt', 'offen'] as Status[]).includes(b.status as Status) ? (b.status as Status) : null;
    if (!status || !b.id) return NextResponse.json({ ok: false, fehler: 'id und status nötig.' }, { status: 400 });
    const jetzt = new Date().toISOString();
    let v: HeadVorschlag | null = null;
    await updateJson<HeadStand>(standName(h), s => {
      const st = { ...leererStand(), ...(s ?? {}) };
      st.vorschlaege = st.vorschlaege.map(x => (x.id === b.id ? (v = { ...x, status, entschieden: jetzt, aktualisiert: jetzt, von: person }) : x));
      return st;
    });
    const t = v as HeadVorschlag | null;
    if (!t) return NextResponse.json({ ok: false, fehler: 'Vorschlag nicht gefunden.' }, { status: 404 });
    let wohin = '';
    if (status === 'angenommen' && t.kontakt_id && t.frist) {
      await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
        const f = cur ?? { kontakte: [] };
        return { ...f, kontakte: f.kontakte.map(k => (k.id === t.kontakt_id && !k.werbesperre ? { ...k, naechsterSchritt: { text: t.titel.slice(0, 300), datum: t.frist! }, geaendertAm: jetzt.slice(0, 10) } : k)) };
      });
      wohin = 'nächster Schritt an der Person';
    } else if (status === 'angenommen' || status === 'erledigt') {
      await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
        const f = cur ?? { tasks: [] };
        const tasks = [...(f.tasks ?? [])];
        const i = tasks.findIndex(x => x.id === `hd-${t.id}`);
        if (status === 'erledigt') { if (i >= 0) tasks[i] = { ...tasks[i], status: 'done', updatedAt: jetzt }; return { ...f, tasks }; }
        if (i >= 0) return f;
        tasks.push({ id: `hd-${t.id}`, title: t.titel.slice(0, 200), description: `Vorschlag des ${HEAD_NAME[h]}: ${t.begruendung}${t.entwurf ? `\n\nEntwurf (${t.entwurf.kanal}):\n${t.entwurf.text}` : ''}`, status: 'todo', priority: t.prioritaet === 'hoch' ? 'high' : t.prioritaet === 'niedrig' ? 'low' : 'medium', assignee: person, tags: [AGENT_ID[h], 'crm'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(t.frist ? { dueDate: t.frist } : {}) });
        return { ...f, tasks };
      });
      wohin = 'Aufgabe';
    }
    return NextResponse.json({ ok: true, vorschlag: t, wohin });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: lauf oder entscheiden.' }, { status: 400 });
}
