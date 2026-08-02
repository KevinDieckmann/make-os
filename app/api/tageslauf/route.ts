// ─── MAKE OS — Tageslauf ausführen ──────────────────────────────────────────
// GET            → letzte Läufe + was heute schon lief
// POST { art }   → Kette ausführen ('voll' | 'kurz' | 'puls')
//
// Jeder Schritt ist gekapselt: fällt einer aus, laufen die anderen weiter und
// der Ausfall wird ehrlich ausgewiesen statt still verschluckt.

import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, askWithSearch, hasAnthropicKey, fremd, FREMD_REGEL, extractJson } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { vitalsHint } from '@/lib/vitals';
import { gatherBrain, blockIndex } from '@/lib/brain';
import { resolveAgent } from '@/lib/agent-config';
import {
  schritteFuer, tagKey, MAX_LAEUFE, artFuerStunde,
  type LaufArt, type Lauf, type LaufFile, type SchrittErgebnis,
} from '@/lib/tageslauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Mail { id: string; account?: string; sender?: string; subject?: string; receivedAt?: string; isRead?: boolean }

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export async function GET() {
  const f = await loadJson<LaufFile>('tageslauf');
  const laeufe = Array.isArray(f?.laeufe) ? f.laeufe : [];
  const heute = tagKey();
  return NextResponse.json({
    laeufe: laeufe.slice(-12).reverse(),
    heute: laeufe.filter(l => l.gestartet.slice(0, 10) === heute).length,
    letzterVoll: laeufe.filter(l => l.art === 'voll').slice(-1)[0] ?? null,
    empfohlen: artFuerStunde(new Date().getHours()),
  });
}

export async function POST(req: Request) {
  let body: { art?: LaufArt } = {};
  try { body = await req.json(); } catch { /* ohne Body ok */ }
  const art: LaufArt = (['voll', 'kurz', 'puls'] as const).includes(body.art as never) ? body.art! : 'voll';
  if (!sperren('tageslauf-' + art)) return NextResponse.json({ error: 'Dieser Lauf ist gerade eben schon gestartet — einen Moment.' }, { status: 200 });

  const heute = tagKey();
  const jetzt = new Date();
  const wd = WD[jetzt.getDay()];
  const origin = new URL(req.url).origin;
  const geplant = schritteFuer(art);
  const schritte: SchrittErgebnis[] = [];
  // EIN Brain-Zug für die ganze Kette — statt dass jeder Schritt selbst liest.
  const b = await gatherBrain(heute);

  /** Kapselt einen Schritt: Fehler beenden nie die Kette. */
  async function schritt(id: string, fn: () => Promise<Omit<SchrittErgebnis, 'id' | 'name' | 'ms'>>) {
    const def = geplant.find(s => s.id === id);
    if (!def) return null;
    const t0 = Date.now();
    try {
      const r = await fn();
      const erg: SchrittErgebnis = { id, name: def.name, ...r, ms: Date.now() - t0 };
      schritte.push(erg);
      return erg;
    } catch (err) {
      const erg: SchrittErgebnis = {
        id, name: def.name, stand: 'fehler',
        kurz: err instanceof Error ? err.message.slice(0, 120) : 'Fehler',
        ms: Date.now() - t0,
      };
      schritte.push(erg);
      return erg;
    }
  }

  // ── 1. Postfächer ──
  let neueMails: Mail[] = [];
  await schritt('postfach', async () => {
    const r = await fetch(`${origin}/api/apple-mail`, { headers: { 'x-make-key': process.env.MAKE_OS_KEY ?? '' }, signal: AbortSignal.timeout(70_000) });
    const d = await r.json();
    // Beide Postfächer: Apple live + KEMARIS/M365 aus dem Brain-Snapshot.
    const apple = Array.isArray(d) ? (d as Mail[]).filter(m => !m.isRead) : [];
    const m365: Mail[] = b.msMails.ungelesen.map(m => ({
      id: m.id ?? 'ms', account: 'KEMARIS (M365)', sender: `${m.senderName ?? ''} <${m.senderEmail ?? ''}>`,
      subject: m.subject, receivedAt: m.receivedAt, isRead: false,
    }));
    if (!Array.isArray(d) && !m365.length) return { stand: 'fehler' as const, kurz: 'Kein Zugriff auf Apple Mail, kein M365-Snapshot' };
    const ungelesen = [...m365, ...apple]; // M365 zuerst — dort liegt das Geschäft.
    neueMails = ungelesen.slice(0, 25);
    const alterHinweis = b.msMails.stale ? ` · M365-Snapshot ${b.msMails.alterH ?? '?'} Std. alt` : '';
    return {
      stand: ungelesen.length ? ('ok' as const) : ('leer' as const),
      kurz: ungelesen.length
        ? `${ungelesen.length} ungelesen (${m365.length} KEMARIS/M365, ${apple.length} Apple)${alterHinweis}`
        : `Alles gelesen${alterHinweis}`,
      detail: ungelesen.slice(0, 12).map(m => ({ von: m.sender, betreff: m.subject, konto: m.account })),
    };
  });

  // ── 2. Termine (aus dem Brain) ──
  let heutigeTermine: { title?: string; startDate?: string; allDay?: boolean }[] = [];
  await schritt('kalender', async () => {
    heutigeTermine = b.kalender.heute;
    if (b.kalender.stale) {
      return { stand: 'fehler' as const, kurz: `Stand ${b.kalender.alterH == null ? 'unbekannt' : b.kalender.alterH + ' Std.'} alt — /os/kalender öffnen` };
    }
    return {
      stand: heutigeTermine.length ? ('ok' as const) : ('leer' as const),
      kurz: heutigeTermine.length ? `${heutigeTermine.length} Termine heute` : 'Keine Termine heute',
      detail: heutigeTermine.map(e => ({
        zeit: e.allDay ? 'ganztägig' : new Date(e.startDate as string).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        was: e.title,
      })),
    };
  });

  // ── 3. Aufgaben validieren (aus dem Brain) ──
  const offen = b.tasks.offen, overdue = b.tasks.overdue, dueToday = b.tasks.dueToday, kritisch = b.tasks.kritisch;
  await schritt('aufgaben', async () => {
    const brennt = overdue.length + dueToday.length;
    return {
      stand: brennt ? ('ok' as const) : ('leer' as const),
      kurz: `${offen.length} offen · ${overdue.length} überfällig · ${dueToday.length} heute fällig · ${kritisch.length} kritisch`,
      detail: [...overdue, ...dueToday].slice(0, 10).map(t => ({ was: t.title, prio: t.priority, faellig: t.dueDate })),
    };
  });

  // ── 4. Transkripte ──
  await schritt('transkripte', async () => ({
    stand: 'uebersprungen' as const,
    kurz: 'Noch keine Quelle verbunden — der Transkript-Agent steht in Phase 2 der Roadmap',
  }));

  // ── 5. Lage draußen ──
  await schritt('news', async () => {
    if (!hasAnthropicKey()) return { stand: 'uebersprungen' as const, kurz: 'Kein Anthropic-Key' };
    const r = await askWithSearch({
      system: [
        'Du bist der Research-Agent in Kevins MAKE OS. Liefere die Lage von heute in drei Blöcken — je GENAU DREI Meldungen, nicht mehr.',
        'Kontext: Kevin baut POINCAP (Controlling-/Liquiditäts-Plattform für den Mittelstand) unter der Holding KD Ventures, Sitz OWL/Deutschland.',
        'welt = weltweite Lage mit möglicher Auswirkung auf deutsche Unternehmen. business = KI/Software/Mittelstand/Finanzierung. wettbewerb = konkrete Anbieter im Umfeld Controlling/Liquidität/KI-Beratung (DACH).',
        'Jede Meldung: ein Satz Sachverhalt + ein Halbsatz, warum es Kevin angeht. Keine Floskeln, kein Startup-Sprech. Wenn du zu einem Block nichts Belastbares findest, gib weniger — erfinde nichts.',
        'Antworte NUR als JSON: {"welt":["…"],"business":["…"],"wettbewerb":["…"]}',
      ].join('\n'),
      user: `Heute ist ${wd}, ${heute}. Was ist die Lage?`,
      maxTokens: 5000,
      timeoutMs: 150_000,
    });
    if (!r.ok || !r.text) return { stand: 'fehler' as const, kurz: r.error ?? 'Keine Antwort' };
    const d = extractJson<{ welt?: string[]; business?: string[]; wettbewerb?: string[] }>(r.text);
    if (!d) return { stand: 'fehler' as const, kurz: 'Keine strukturierte Antwort' };
    const n = (d.welt?.length ?? 0) + (d.business?.length ?? 0) + (d.wettbewerb?.length ?? 0);
    return { stand: n ? ('ok' as const) : ('leer' as const), kurz: `${n} Meldungen${r.webUsed ? ' (mit Web-Suche)' : ''}`, detail: d };
  });

  // ── 6. Prioritäten-Wächter ──
  let alarm: string | undefined;
  await schritt('prioritaet', async () => {
    if (!hasAnthropicKey()) return { stand: 'uebersprungen' as const, kurz: 'Kein Anthropic-Key' };
    if (!neueMails.length && !overdue.length && !dueToday.length) {
      return { stand: 'leer' as const, kurz: 'Nichts, was den Tag umwirft' };
    }
    const r = await askJson<{ vorziehen?: { was: string; warum: string; statt?: string }[]; ruhig?: boolean; satz?: string }>({
      system: [
        'Du bist der Prioritäten-Wächter in Kevins MAKE OS. Deine EINZIGE Frage: Ist etwas hereingekommen, das die geplante Reihenfolge des Tages umwirft?',
        FREMD_REGEL,
        'Sei streng. Die meisten Mails sind KEIN Grund, etwas vorzuziehen. Nur wenn ein Termin, ein Kunde, eine Frist oder Geld wirklich davon abhängt.',
        'Wenn du etwas vorziehst, sag auch, was dafür weichen soll — sonst wird der Tag nur voller.',
        'Antworte NUR als JSON: {"ruhig": true|false, "satz":"<1 Satz Lage>", "vorziehen":[{"was":"…","warum":"…","statt":"<was dafür wartet>"}]}',
      ].join('\n'),
      user: [
        `Heute ${wd}, ${heute}.`,
        `NEUE, UNGELESENE NACHRICHTEN (${neueMails.length}):`,
        fremd('apple-mail', neueMails.slice(0, 15).map(m => `- [${m.account ?? ''}] ${m.sender ?? ''}: ${m.subject ?? ''}`).join('\n') || '(keine)'),
        '',
        `ÜBERFÄLLIG: ${overdue.map(t => t.title).join(' · ') || '(keine)'}`,
        `HEUTE FÄLLIG: ${dueToday.map(t => t.title).join(' · ') || '(keine)'}`,
        `KRITISCH OFFEN: ${kritisch.map(t => t.title).join(' · ') || '(keine)'}`,
        `TERMINE HEUTE: ${heutigeTermine.map(e => e.title).join(' · ') || '(keine)'}`,
      ].join('\n'),
      maxTokens: 3000,
    });
    if (!r.ok || !r.data) return { stand: 'fehler' as const, kurz: r.error ?? 'Keine Antwort' };
    const v = r.data.vorziehen ?? [];
    if (v.length) alarm = r.data.satz ?? `${v.length} Sache(n) sollten vorgezogen werden`;
    return {
      stand: v.length ? ('ok' as const) : ('leer' as const),
      kurz: v.length ? `${v.length} vorziehen: ${v.map(x => x.was).join(' · ').slice(0, 90)}` : (r.data.satz ?? 'Nichts muss vorgezogen werden'),
      detail: r.data,
    };
  });

  // ── 7. Ausrichtung ──
  let ausrichtung: Record<string, unknown> | undefined;
  await schritt('ausrichtung', async () => {
    if (!hasAnthropicKey()) return { stand: 'uebersprungen' as const, kurz: 'Kein Anthropic-Key' };
    const vit = b.vitals;
    const vorher = schritte.map(s => `- ${s.name}: ${s.kurz}`).join('\n');

    const r = await askJson<Record<string, unknown>>({
      system: [
        'Du bist JARVIS, Kevins zentrale Intelligenz und Chief of Staff. Du schließt den Tageslauf ab: aus allem, was die Kette gefunden hat, wird EINE ruhige Ausrichtung.',
        FREMD_REGEL,
        'Sprich Kevin mit „Sir" an — einmal, nicht in jedem Satz.',
        'Kevin: Bandscheibenvorfall in Reha, Ziel „mehr Ruhe". Nordstern: 1 Mio € Umsatz KD Ventures → min. 300k € Gewinn.',
        'Regeln: max 3 Prioritäten. Bei niedriger Recovery oder vollem Tag: weniger, und sag es offen. Gesundheitsdaten sind privat.',
        'Wenn die Kette Ausfälle hatte (Kalender alt, kein Postfach-Zugriff), benenne das — lieber ehrlich unvollständig als falsch zuversichtlich.',
        'Kein Startup-Sprech. Deutsch, direkt, warm aber knapp.',
        'Antworte NUR als JSON: {"gruss":"<1-2 Sätze Lage heute>","tagesform":"<gruen|gelb|rot>","warum":"<1 Satz>","prioritaeten":[{"titel":"…","warum":"…","wann":"…"}],"schutz":"<1 Satz für Rücken/Ruhe>","warnung":"<optional, sonst leer>"}',
      ].join('\n'),
      user: [
        `Heute ${wd}, ${heute}, ${jetzt.getHours()}:${String(jetzt.getMinutes()).padStart(2, '0')} Uhr. Lauf-Art: ${art}.`,
        `Recovery ${vit.rec}%, Schlaf ${vit.sleep}h${vitalsHint(vit)}.${vit.note ? ` Kevin notiert: "${vit.note}"` : ''}`,
        blockIndex(b),
        '',
        'WAS DIE KETTE GEFUNDEN HAT:',
        vorher,
        '',
        alarm ? `WÄCHTER SCHLÄGT AN: ${alarm}` : 'Der Wächter meldet nichts Dringendes.',
      ].filter(Boolean).join('\n'),
      maxTokens: 3500,
    });
    if (!r.ok || !r.data) return { stand: 'fehler' as const, kurz: r.error ?? 'Keine Antwort' };
    ausrichtung = r.data;

    // AUTONOMIE WIRKT: Steht der Task-Agent auf „autonom", legt die Kette die
    // Prioritäten direkt als Aufgaben an (Duplikat-Schutz greift). Auf
    // „entwurf"/„freigabe" bleiben es Knöpfe — genau das stellt /os/agenten ein.
    try {
      const taskAgent = await resolveAgent('task');
      const prios = Array.isArray((r.data as { prioritaeten?: { titel?: string; warum?: string; wann?: string }[] }).prioritaeten)
        ? (r.data as { prioritaeten: { titel?: string; warum?: string; wann?: string }[] }).prioritaeten.slice(0, 3)
        : [];
      if (taskAgent.autonomy === 'autonom' && prios.length) {
        const auto: { titel: string; stand: string }[] = [];
        for (const p of prios) {
          if (!p.titel) continue;
          const res = await fetch(`${origin}/api/tasks/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
            body: JSON.stringify({
              title: p.titel,
              description: [p.warum, p.wann ? `Wann: ${p.wann}` : '', 'Automatisch aus der Tages-Ausrichtung (Task-Agent: autonom).'].filter(Boolean).join(' · '),
              priority: 'high', projectId: 'proj-kdm',
            }),
            signal: AbortSignal.timeout(15_000),
          });
          const d2 = await res.json();
          auto.push({ titel: p.titel, stand: d2.ok ? (d2.duplikat ? 'gab es schon' : 'angelegt') : 'fehler' });
        }
        (ausrichtung as Record<string, unknown>).autoAufgaben = auto;
      }
    } catch { /* Autonomie-Anlage darf die Kette nie brechen */ }

    return { stand: 'ok' as const, kurz: String(r.data.gruss ?? '').slice(0, 120), detail: r.data };
  });

  // ── Lauf festhalten ──
  const lauf: Lauf = {
    id: `lauf-${jetzt.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`,
    art,
    gestartet: jetzt.toISOString(),
    fertig: new Date().toISOString(),
    schritte,
    ausrichtung,
    alarm,
  };
  const file = await updateJson<LaufFile>('tageslauf', current => {
    const l = Array.isArray(current?.laeufe) ? current.laeufe : [];
    return { laeufe: [...l, lauf].slice(-MAX_LAEUFE) };
  });
  await logRun(`tageslauf-${art}`, `Tageslauf ${art} ${heute}`, {
    schritte: schritte.map(s => ({ name: s.name, stand: s.stand, kurz: s.kurz })),
    alarm,
  });

  return NextResponse.json({ lauf, heute: file.laeufe.filter(l => l.gestartet.slice(0, 10) === heute).length });
}
