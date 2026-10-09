// ─── MAKE OS — Tageslauf ausführen ──────────────────────────────────────────
// GET            → letzte Läufe + was heute schon lief
// POST { art }   → Kette ausführen ('voll' | 'kurz' | 'puls')
//
// Jeder Schritt ist gekapselt: fällt einer aus, laufen die anderen weiter und
// der Ausfall wird ehrlich ausgewiesen statt still verschluckt.
//
// 08.10. spät (Datenschutz vor dem Upload, Art. 9): die Läufe liegen JE PERSON (`tageslauf--<person>`, der Altbestand ohne
// Suffix nur beim Inhaber — `eigenerSpeicher`). Die Ausrichtung entsteht mit dem Gesundheitskontext der Person, für die der
// Lauf rechnet (`fuer`), und gehört nur ihr: GET liefert nur die eigenen Läufe. Prompts ohne feste Namen und Firmen.

import { jsonBegrenzt, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, askWithSearch, hasAnthropicKey, fremd, FREMD_REGEL, extractJson, kiGesperrt, kiSperrText } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { vitalsHint, vitalsKurz } from '@/lib/vitals';
import { gatherBrain, blockIndex } from '@/lib/brain';
import { resolveAgent } from '@/lib/agent-config';
import {
  schritteFuer, tagKey, MAX_LAEUFE, artFuerStunde,
  type LaufArt, type Lauf, type LaufFile, type SchrittErgebnis,
} from '@/lib/tageslauf';
import { innenAdresse } from '@/lib/innen';
import { personStreng, laufPerson } from '@/lib/finanzen/haushalt/zugriff';
import { eigenerSpeicher } from '@/lib/zoe/raum';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { vornameVon, gesellschaftenSatz } from '@/lib/zoe/grundauftrag';

import { eigenerGesundheitsKontext, KONTEXT_REGEL } from '@/lib/gesundheit/kontext';
import { stromFuer } from '@/lib/inbox/strom-server';
import { lageText } from '@/lib/inbox/zoe-sicht';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { nordsternSatz } from '@/lib/planung/nordstern';

/** Interner Hop: nur eine ausdrücklich benannte Person (S1, Regel 5/7) — ohne sie ein Systemlauf, nie „kevin“. */
const personKopf = (req: Request): Record<string, string> => { const p = personStreng(req); return p ? { 'x-make-person': p } : {}; };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Mail { id: string; account?: string; sender?: string; subject?: string; receivedAt?: string; isRead?: boolean }

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Der Bestand der Läufe einer Person (08.10. spät) — der Altbestand ohne Suffix nur beim Inhaber. */
const tageslaufBestand = async (person: string): Promise<string> => eigenerSpeicher('tageslauf', person, await inhaberSpeicher());

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  // Nur die EIGENEN Läufe (Sitzung bzw. Dienstweg mit Person) — die Ausrichtung trägt Gesundheitskontext (Art. 9).
  const f = await loadJson<LaufFile>(await tageslaufBestand(z.person));
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
  // Inbox 2 (06.10.): vorher hing die einzige Prüfung am Mac-Postfach (nurInhaber) — jetzt ausdrücklich: Haushalt bzw. Systemlauf
  // (Takt); die Post liest der Lauf nur für die Person, für die er läuft (Schritt „postfach“).
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { art?: LaufArt } = {};
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch { /* ohne Body ok */ }
  const art: LaufArt = (['voll', 'kurz', 'puls'] as const).includes(body.art as never) ? body.art! : 'voll';
  if (!sperren('tageslauf-' + art)) return NextResponse.json({ error: 'Dieser Lauf ist gerade eben schon gestartet — einen Moment.' }, { status: 200 });

  const heute = tagKey();
  const jetzt = new Date();
  const wd = WD[jetzt.getDay()];
  const origin = innenAdresse(req);
  const geplant = schritteFuer(art);
  const schritte: SchrittErgebnis[] = [];
  // EIN Brain-Zug für die ganze Kette — statt dass jeder Schritt selbst liest.
  // Für wen der Lauf rechnet = unter wem er im Agenten-Log steht (08.10.): benannte Person, im Systemlauf der Inhaber — nie als Systemlauf
  // für alle, wenn er aus der Sicht einer Person rechnet (ihre Aufgaben samt „nur ich“, ihre Ausrichtung).
  const fuer = await laufPerson(req);
  const b = await gatherBrain(heute, fuer);

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
  // Inbox 2 (06.10.): der EINE Strom der eigenen Postfächer (Gmail + IMAP, lib/inbox/zoe-sicht.ts) — nur für die Person, für die der
  // Lauf läuft; ein Systemlauf ohne Person liest keine Post. Nur Kopf + Betreff (KI-Grundsatz: Volltext nur beim Entwurf auf Klick).
  let neueMails: Mail[] = [];
  await schritt('postfach', async () => {
    const person = personStreng(req);
    if (!person) return { stand: 'uebersprungen' as const, kurz: 'Die Inbox gehört je Person — ohne Person keine Post' };
    const s = await stromFuer(person);
    if (!s.postfaecher.length) return { stand: 'leer' as const, kurz: 'Noch kein Postfach verbunden' };
    const namen = Object.fromEntries(s.bereiche.map(x => [x.id, x.name]));
    const wichtig = s.gespraeche.filter(g => g.inArbeit && (g.fach === 'antworten' || g.fach === 'termine' || g.fach === 'geld')).sort((a, c) => c.am.localeCompare(a.am));
    neueMails = wichtig.slice(0, 25).map(g => ({ id: g.id, account: g.bereich ? namen[g.bereich] ?? g.bereich : 'Ohne Bereich', sender: g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email, subject: g.betreff, receivedAt: g.am, isRead: !g.ungelesen }));
    const lage = s.lage.map(l => lageText(l, l.bereich ? namen[l.bereich] ?? l.bereich : 'Ohne Bereich'));
    return {
      stand: wichtig.length ? ('ok' as const) : ('leer' as const),
      kurz: wichtig.length ? `${wichtig.length} offen · ${s.zoe.text}` : 'Nichts offen — die Inbox ist im Griff',
      detail: [...lage.map(l => ({ lage: l })), ...wichtig.slice(0, 12).map(m => ({ von: m.zuordnung?.name ?? m.gegenueber.name ?? m.gegenueber.email, betreff: m.betreff, konto: m.bereich ? namen[m.bereich] ?? m.bereich : 'Ohne Bereich' }))],
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
    const firmen = await gesellschaftenSatz();
    const r = await askWithSearch({ zweck: 'tageslauf',
      system: [
        'Du bist der Research-Agent in MAKE OS. Liefere die Lage von heute in drei Blöcken — je GENAU DREI Meldungen, nicht mehr.',
        // Kontext aus den Gesellschaften der Instanz (08.10. spät) — vorher fest: ein Produktname und eine Holding im Code.
        firmen,
        'welt = weltweite Lage mit möglicher Auswirkung auf deutsche Unternehmen. business = KI/Software/Mittelstand/Finanzierung. wettbewerb = konkrete Anbieter im Umfeld der eigenen Gesellschaften (DACH).',
        'Jede Meldung: ein Satz Sachverhalt + ein Halbsatz, warum es die eigenen Gesellschaften angeht. Keine Floskeln, kein Startup-Sprech. Wenn du zu einem Block nichts Belastbares findest, gib weniger — erfinde nichts.',
        'Antworte NUR als JSON: {"welt":["…"],"business":["…"],"wettbewerb":["…"]}',
      ].join('\n'),
      user: `Heute ist ${wd}, ${heute}. Was ist die Lage?`,
      maxTokens: 5000,
      timeoutMs: 150_000,
      ki: kiAus(req, ['allgemein']),
    });
    if (kiGesperrt(r)) return { stand: 'uebersprungen' as const, kurz: kiSperrText(r) };
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
    const r = await askJson<{ vorziehen?: { was: string; warum: string; statt?: string }[]; ruhig?: boolean; satz?: string }>({ zweck: 'tageslauf',
      system: [
        'Du bist der Prioritäten-Wächter in MAKE OS. Deine EINZIGE Frage: Ist etwas hereingekommen, das die geplante Reihenfolge des Tages umwirft?',
        FREMD_REGEL,
        'Sei streng. Die meisten Mails sind KEIN Grund, etwas vorzuziehen. Nur wenn ein Termin, ein Kunde, eine Frist oder Geld wirklich davon abhängt.',
        'Wenn du etwas vorziehst, sag auch, was dafür weichen soll — sonst wird der Tag nur voller.',
        'Antworte NUR als JSON: {"ruhig": true|false, "satz":"<1 Satz Lage>", "vorziehen":[{"was":"…","warum":"…","statt":"<was dafür wartet>"}]}',
      ].join('\n'),
      user: [
        `Heute ${wd}, ${heute}.`,
        `OFFENE GESPRÄCHE IN DER INBOX (${neueMails.length}, nur Absender und Betreff):`,
        fremd('postfach', neueMails.slice(0, 15).map(m => `- [${m.account ?? ''}] ${m.sender ?? ''}: ${m.subject ?? ''}`).join('\n') || '(keine)'),
        '',
        `ÜBERFÄLLIG: ${overdue.map(t => t.title).join(' · ') || '(keine)'}`,
        `HEUTE FÄLLIG: ${dueToday.map(t => t.title).join(' · ') || '(keine)'}`,
        `KRITISCH OFFEN: ${kritisch.map(t => t.title).join(' · ') || '(keine)'}`,
        `TERMINE HEUTE: ${heutigeTermine.map(e => e.title).join(' · ') || '(keine)'}`,
      ].join('\n'),
      maxTokens: 3000,
      ki: kiAus(req, ['postfach', 'aufgaben', 'kalender']),
    });
    if (kiGesperrt(r)) return { stand: 'uebersprungen' as const, kurz: kiSperrText(r) };
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
    // S1 #9: Gesundheitskontext nur aus dem eigenen Profil der ausdrücklich benannten Person (Systemlauf: keiner).
    const eigeneAngaben = await eigenerGesundheitsKontext(personStreng(req));
    // Vitalwerte nur mit Einwilligung (b) der Person, deren Lage das Brain trägt (`b.gesundheitFrei`) — das Protokoll
    // nennt deshalb genau diese Person, auch im Systemlauf.
    const mitGesundheit = b.gesundheitFrei;
    // Name aus dem Konto der Person, für die der Lauf rechnet (08.10. spät) — vorher fest auf eine Person geschrieben.
    const name = await vornameVon(fuer);

    const r = await askJson<Record<string, unknown>>({ zweck: 'tageslauf',
      system: [
        `Du bist ZOE, die zentrale Intelligenz und Chief of Staff in MAKE OS. Du schließt den Tageslauf für ${name} ab: aus allem, was die Kette gefunden hat, wird EINE ruhige Ausrichtung.`,
        FREMD_REGEL,
        `Sprich ${name} mit dem Vornamen an — einmal, nicht in jedem Satz. Du duzt.`,
        // Nordstern aus den Daten des Haushalts (08.10. abends) — vorher fest im Code, samt eines persönlichen Ziels.
        nordsternSatz(b.nordstern),
        KONTEXT_REGEL,
        'Regeln: max 3 Prioritäten. Bei niedriger Recovery oder vollem Tag: weniger, und sag es offen. Gesundheitsdaten sind privat.',
        'Wenn die Kette Ausfälle hatte (Kalender alt, kein Postfach-Zugriff), benenne das — lieber ehrlich unvollständig als falsch zuversichtlich.',
        'Kein Startup-Sprech. Deutsch, direkt, warm aber knapp.',
        'Antworte NUR als JSON: {"gruss":"<1-2 Sätze Lage heute>","tagesform":"<gruen|gelb|rot>","warum":"<1 Satz>","prioritaeten":[{"titel":"…","warum":"…","wann":"…"}],"schutz":"<1 Satz für Pausen und Ruhe>","warnung":"<optional, sonst leer>"}',
      ].join('\n'),
      user: [
        `Heute ${wd}, ${heute}, ${jetzt.getHours()}:${String(jetzt.getMinutes()).padStart(2, '0')} Uhr. Lauf-Art: ${art}.`,
        // Art. 9 (05.10.): nur mit Einwilligung (b) — sonst steht in `b.vitals` ohnehin nichts (gatherBrain).
        mitGesundheit ? `${vitalsKurz(vit)}${vitalsHint(vit)}.${vit.note ? ` Notiz: "${vit.note}"` : ''}` : 'Keine Gesundheitswerte (keine Einwilligung) — Tagesform „gelb“ annehmen.',
        eigeneAngaben,
        blockIndex(b),
        '',
        'WAS DIE KETTE GEFUNDEN HAT:',
        vorher,
        '',
        alarm ? `WÄCHTER SCHLÄGT AN: ${alarm}` : 'Der Wächter meldet nichts Dringendes.',
      ].filter(Boolean).join('\n'),
      maxTokens: 3500,
      ki: kiAus(req, mitGesundheit || eigeneAngaben ? ['aufgaben', 'finanzen', 'kalender', 'postfach', 'gesundheit'] : ['aufgaben', 'finanzen', 'kalender', 'postfach'], { person: fuer }),
    });
    if (kiGesperrt(r)) return { stand: 'uebersprungen' as const, kurz: kiSperrText(r) };
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
            headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', ...(personKopf(req)) },
            body: JSON.stringify({
              title: p.titel,
              description: [p.warum, p.wann ? `Wann: ${p.wann}` : '', 'Automatisch aus der Tages-Ausrichtung (Task-Agent: autonom).'].filter(Boolean).join(' · '),
              priority: 'high', space: 'business', // ohne festes Projekt → „Sonstige“ im Business (09.10.: keine Altprojekt-Kennung)
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
  // Je Person (08.10. spät): in den Bestand der Person, für die der Lauf rechnet — nur sie liest ihn (GET).
  const file = await updateJson<LaufFile>(await tageslaufBestand(fuer), current => {
    const l = Array.isArray(current?.laeufe) ? current.laeufe : [];
    // Gespeichert ohne `detail` (Absender, Betreffe) — seit 08.10. spät liegt der Bestand ohnehin je Person.
    const ohneDetail = { ...lauf, schritte: lauf.schritte.map(s => ({ ...s, detail: undefined })) };
    return { laeufe: [...l, ohneDetail].slice(-MAX_LAEUFE) };
  });
  await logRun(`tageslauf-${art}`, `Tageslauf ${art} ${heute}`, {
    schritte: schritte.map(s => ({ name: s.name, stand: s.stand, kurz: s.kurz })),
    alarm,
  }, { person: fuer });

  return NextResponse.json({ lauf, heute: file.laeufe.filter(l => l.gestartet.slice(0, 10) === heute).length });
}
