// ─── CRM — Kampagnen ────────────────────────────────────────────────────────
// GET  → Playbooks (mit Größe der Zielgruppe heute), Kundenprofil, „Kunden wie
//        unsere besten“, Zahlen je Kampagne
// POST { aktion: 'planen', playbook, segmentId? }        → Kampagne als Entwurf
// POST { aktion: 'aufgaben', id }                       → offene Schritte als Aufgaben
// POST { aktion: 'ergebnis', id, kontaktId, ergebnis }   → Ergebnis + Verlauf der Person
//        (bei „chance“ entsteht eine Chance in der Pipeline mit Quelle Kampagne)
// Versendet wird nichts.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { localDay, tagePlus } from '@/lib/zeit';
import { anzeigename, wendeAktivitaetAn, type Kontakt, type AktivitaetArt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { PLAYBOOKS, planen, zielgruppe, kundenprofil, aehnlicheFirmen, kampagnenZahlen } from '@/lib/crm/kampagnen';
import type { Kampagne, KampagnenErgebnis } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

export async function GET() {
  const heute = localDay();
  const kontakte = await kontakteLaden();
  const crm = await ladeCrm();
  const profil = kundenprofil(crm, heute);
  const personenJeFirma = new Map<string, Kontakt[]>();
  for (const k of kontakte) if (k.firmaId && !k.werbesperre) personenJeFirma.set(k.firmaId, [...(personenJeFirma.get(k.firmaId) ?? []), k]);
  return NextResponse.json({
    ok: true, heute,
    playbooks: PLAYBOOKS.map(p => ({ ...p, anzahl: zielgruppe(kontakte, crm, p, heute).length })),
    profil: { kunden: profil.firmen.map(f => ({ id: f.id, name: f.name, branche: f.branche, stadt: f.stadt })), branchen: profil.branchen, staedte: profil.staedte, groesse: profil.groesse, mrrJeKunde: profil.mrrJeKunde },
    aehnliche: aehnlicheFirmen(crm, heute, 15).map(a => ({ id: a.firma.id, name: a.firma.name, branche: a.firma.branche, stadt: a.firma.stadt, punkte: a.punkte, gruende: a.gruende, personen: (personenJeFirma.get(a.firma.id) ?? []).map(k => ({ id: k.id, name: anzeigename(k) })) })),
    zahlen: Object.fromEntries(crm.kampagnen.map(k => [k.id, kampagnenZahlen(k, heute)])),
  });
}

export async function POST(req: Request) {
  let b: { aktion?: string; playbook?: string; segmentId?: string; id?: string; kontaktId?: string; ergebnis?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const heute = localDay();
  const person = personAus(req);

  if (b.aktion === 'planen') {
    const kontakte = await kontakteLaden();
    const crm = await ladeCrm();
    const seg = b.segmentId ? crm.segmente.find(s => s.id === b.segmentId) : undefined;
    const pb = PLAYBOOKS.find(p => p.id === b.playbook);
    const basis = pb ?? { id: 'eigen', name: seg ? `Kampagne: ${seg.name}` : 'Eigene Kampagne', kurz: '', warum: '', zielgruppe: seg?.kriterien ?? {}, kanal: 'persoenlich' as const, schritte: [{ text: 'Anlass und Botschaft festlegen', tag: 0 }, { text: 'Personen ansprechen', tag: 2 }, { text: 'Nachfassen', tag: 9 }], kennzahl: 'Gespräche', recht: '', fuer: [] };
    const plan = planen(seg ? { ...basis, zielgruppe: seg.kriterien, zusatz: undefined } : basis, kontakte, crm, heute, `kp-${Date.now().toString(36)}`, 'hand');
    const k: Kampagne = seg ? { ...plan, segmentId: seg.id, name: pb ? `${pb.name} · ${seg.name}` : plan.name } : plan;
    await aendereCrm(c => ({ ...c, kampagnen: [...c.kampagnen, k] }));
    return NextResponse.json({ ok: true, kampagne: k });
  }

  if (b.aktion === 'aufgaben') {
    const crm = await ladeCrm();
    const k = crm.kampagnen.find(x => x.id === b.id);
    if (!k) return NextResponse.json({ ok: false, fehler: 'Kampagne nicht gefunden.' }, { status: 404 });
    const start = k.start ?? heute;
    const neu = k.schritte.filter(s => !s.erledigt && !s.aufgabeId);
    const jetzt = new Date().toISOString();
    await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      const tasks = [...(f.tasks ?? [])];
      for (const s of neu) {
        const id = `kp-${k.id}-${s.id}`;
        if (tasks.some(t => t.id === id)) continue;
        tasks.push({ id, title: `${s.text} — ${k.name}`.slice(0, 200), description: `Schritt der Kampagne „${k.name}“ (${k.kontaktIds.length} Personen). Versand und Ansprache bleiben bei dir.`, status: 'todo', priority: 'medium', assignee: person, tags: ['crm', 'kampagne'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, dueDate: tagePlus(start, s.tag) });
      }
      return { ...f, tasks };
    });
    await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, schritte: x.schritte.map(s => (neu.some(n => n.id === s.id) ? { ...s, aufgabeId: `kp-${k.id}-${s.id}` } : s)), geaendert: jetzt } : x)) }));
    return NextResponse.json({ ok: true, angelegt: neu.length });
  }

  if (b.aktion === 'ergebnis') {
    const ERG: KampagnenErgebnis[] = ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'];
    const erg = ERG.includes(b.ergebnis as KampagnenErgebnis) ? (b.ergebnis as KampagnenErgebnis) : null;
    const crm = await ladeCrm();
    const k = crm.kampagnen.find(x => x.id === b.id);
    if (!k || !erg || !b.kontaktId) return NextResponse.json({ ok: false, fehler: 'id, kontaktId und ergebnis nötig.' }, { status: 400 });
    const kanalArt: AktivitaetArt = k.kanal === 'telefon' ? 'anruf' : k.kanal === 'mail' ? 'mail' : k.kanal === 'linkedin' ? 'linkedin' : k.kanal === 'event' ? 'event' : 'notiz';
    const art: AktivitaetArt = erg === 'angesprochen' ? kanalArt : erg === 'reagiert' ? 'antwort' : erg === 'gespraech' || erg === 'chance' ? 'gespraech' : 'notiz';
    const text = `Kampagne „${k.name}“: ${({ angesprochen: 'angesprochen', reagiert: 'hat reagiert', gespraech: 'Gespräch', chance: 'Chance entstanden', kein_interesse: 'kein Interesse' } as const)[erg]}`;
    let kontakt: Kontakt | null = null;
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
      const f = cur ?? { kontakte: [] };
      const i = f.kontakte.findIndex(x => x.id === b.kontaktId);
      if (i < 0) return f;
      kontakt = wendeAktivitaetAn(f.kontakte[i], { art, text, von: person, bezug: k.id }, heute, new Date().toISOString(), tagePlus);
      f.kontakte[i] = kontakt;
      return f;
    });
    const kt = kontakt as Kontakt | null;
    if (!kt) return NextResponse.json({ ok: false, fehler: 'Person nicht gefunden.' }, { status: 404 });
    const jetzt = new Date().toISOString();
    await aendereCrm(c => {
      const neu = { ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, ergebnisse: [...x.ergebnisse, { kontaktId: kt.id, ergebnis: erg, am: heute }], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt } : x)) };
      if (erg === 'chance' && !c.chancen.some(ch => ch.kontaktIds.includes(kt.id) && ch.quelleBezug === k.id)) {
        neu.chancen = [...c.chancen, {
          id: `ch-${Date.now().toString(36)}`, titel: `${kt.firma ?? anzeigename(kt)} — ${k.name}`.slice(0, 160), kontaktIds: [kt.id], ...(kt.firma ? { firma: kt.firma } : {}),
          art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [{ stufe: 'qualifiziert', am: jetzt, von: person }], quelle: 'outreach', quelleBezug: k.id,
          qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: person, angelegt: jetzt, geaendert: jetzt, letzteAktivitaet: heute,
        }];
      }
      return neu;
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });
}
