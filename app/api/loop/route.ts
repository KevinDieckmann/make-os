// ─── MAKE OS — Loops (Morgen · Woche · Rückblick) ───────────────────────────
// Die Loops sind das, was aus einzelnen Agenten ein Betriebssystem macht:
// sie ziehen die echten Daten mehrerer Bereiche zusammen, lassen MAKE daraus
// EINE Handlung ableiten und schreiben das Ergebnis ins Agenten-Gedächtnis
// (agent-log), damit der nächste Loop darauf aufbauen kann.
//
// POST { loop: 'morgen' | 'woche' | 'rueckblick' }

import { NextResponse } from 'next/server';
import { sperren } from '@/lib/lauf-sperre';
import { logRun, recentRuns } from '@/lib/agent-log';
import { askJson } from '@/lib/anthropic';
import { personAus } from '@/lib/jarvis/raum';
import { gatherBrain } from '@/lib/brain';
import { vitalsHint } from '@/lib/vitals';
import { computeMetrics, eur } from '@/lib/make-one/finance-data';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

import { localDay as localKey } from '@/lib/zeit';

// ── Gemeinsame Datensammlung: kommt jetzt aus dem Brain ──
// Gleiche Rückgabeform wie früher, damit die Loop-Zweige unverändert bleiben.
async function gather(today: string, person: string) {
  const b = await gatherBrain(today, person);
  // Für den Rückblick brauchen wir die vollen Payloads der Loop-Läufe.
  const loopLog = await recentRuns(undefined, 30, 'loop-').then(l => [...l].reverse());
  return {
    open: b.tasks.offen,
    overdue: b.tasks.overdue,
    dueToday: b.tasks.dueToday,
    critical: b.tasks.kritisch,
    fin: b.finance,
    prospects: b.prospects,
    todaysEvents: b.kalender.heute,
    weekEvents: b.kalender.woche,
    perf: b.index ?? { index: null, label: 'noch keine Datenbasis', saeulen: [], abdeckung: 0, hebel: null, stand: today },
    vitals: b.vitals,
    calAt: b.kalender.at ?? undefined,
    calAgeH: b.kalender.alterH,
    calStale: b.kalender.stale,
    log: b.laeufe,
    loopLog,
    geld: b.geld,
    mandate: b.mandate,
    shields: b.shields,
  };
}

const fmtTask = (t: { title: string; priority: string; dueDate?: string }) => `- [${t.priority}${t.dueDate ? `, fällig ${t.dueDate}` : ''}] ${t.title}`;
const fmtEvent = (e: { title?: string; startDate?: string; allDay?: boolean }) => {
  const d = e.startDate ? new Date(e.startDate) : null;
  const time = e.allDay || !d ? 'ganztägig' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `- ${time} ${e.title ?? ''}`;
};

export async function POST(req: Request) {
  let body: { loop?: string; today?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const loop = body.loop ?? 'morgen';
  if (!sperren('loop-' + loop)) return NextResponse.json({ error: 'Dieser Loop läuft gerade schon — einen Moment.' }, { status: 200 });
  const today = body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : localKey(new Date());
  const wd = WD[new Date(`${today}T12:00:00`).getDay()];

  const g = await gather(today, personAus(req));

  // ───────────────────────────────── MORGEN-LOOP ─────────────────────────────
  if (loop === 'morgen') {
    const vit = g.vitals;
    const system = [
      'Du bist JARVIS, Kevins zentrale Intelligenz und Chief of Staff. Erzeuge den MORGEN-LOOP: eine ruhige, konkrete Tagesausrichtung.',
      'Kevin: Bandscheibenvorfall in Reha (Rücken schonen), Nordstern 1 Mio € Umsatz KD Ventures → 300k Gewinn. Ziel „mehr Ruhe".',
      'Regeln: max 3 echte Prioritäten für heute (nicht mehr — Überladung ist das Problem). Berücksichtige Recovery UND die echten Termine (freie Zeit realistisch einschätzen). Wenn Recovery niedrig oder der Tag voll ist: weniger vornehmen, das offen sagen.',
      'Gesundheitsdaten sind privat — nur für Kevin, nie als Business-Aussage.',
      'Kein Startup-Sprech. Deutsch, direkt, warm aber knapp.',
      'Antworte NUR als JSON: {"gruss":"<1 Satz Lage heute>","tagesform":"<gruen|gelb|rot>","warum":"<1 Satz warum diese Tagesform>","prioritaeten":[{"titel":"<Aufgabe>","warum":"<1 kurzer Satz>","wann":"<z.B. Vormittag / nach dem Termin>"}],"schutz":"<1 Satz: was du heute für Rücken/Ruhe empfiehlst>","warnung":"<optional: was heute kippt, sonst leer>"}',
    ].join('\n');

    const user = [
      `Heute: ${wd}, ${today}.`,
      `Recovery ${vit.rec}%, Ruhepuls ${vit.rhr}, HRV ${vit.hrv}, Schlaf letzte Nacht ${vit.sleep}h${vitalsHint(vit)}.${vit.note ? ` Kevin notiert: "${vit.note}"` : ""}`,
      '',
      // Ehrlich über die Datenlage: der Kalender-Cache wird nur beim Öffnen von
      // /os/kalender erneuert. Ohne diesen Hinweis behauptet der Loop „dein Tag
      // ist frei", obwohl in Wahrheit nur der Cache alt ist.
      `TERMINE HEUTE (${g.todaysEvents.length})${g.calStale ? ` — ACHTUNG: Kalender-Stand ist ${g.calAgeH} Std. alt, also womöglich unvollständig. Sag das offen und rate Kevin, /os/kalender einmal zu öffnen, statt den Tag als frei zu bezeichnen.` : ''}:`,
      g.todaysEvents.map(fmtEvent).join('\n') || (g.calStale ? '(nichts im veralteten Stand — nicht als „frei" werten)' : '(keine)'),
      '',
      `ÜBERFÄLLIG (${g.overdue.length}):`, g.overdue.map(fmtTask).join('\n') || '(keine)',
      `HEUTE FÄLLIG (${g.dueToday.length}):`, g.dueToday.map(fmtTask).join('\n') || '(keine)',
      `KRITISCH OFFEN (${g.critical.length}):`, g.critical.slice(0, 8).map(fmtTask).join('\n') || '(keine)',
      `Weitere offene Aufgaben: ${g.open.length}`,
      '',
      // Verbindung zum Index: der Morgen soll auf die schwächste Säule einzahlen.
      g.perf.index != null
        ? `PERFORMANCE-INDEX: ${g.perf.index} (${g.perf.label}), Datenbasis ${Math.round(g.perf.abdeckung * 100)}%. Schwächste tragende Säule: ${g.perf.hebel ?? '—'}. Wenn Recovery und Termine es hergeben, lass EINE Priorität auf diese Säule einzahlen — sonst lass es bewusst weg und sag warum.`
        : 'PERFORMANCE-INDEX: noch nicht berechenbar — sag Kevin, was ihm dafür fehlt.',
    ].join('\n');

    const r = await askJson<Record<string, unknown>>({ zweck: 'loop', system, user, maxTokens: 3000 });
    if (!r.ok) return NextResponse.json({ error: r.error ?? 'Loop fehlgeschlagen', loop, stats: { open: g.open.length, termine: g.todaysEvents.length } });
    await logRun('loop-morgen', `Morgen-Loop ${today}`, r.data);
    return NextResponse.json({ loop, today, ...r.data, stats: { open: g.open.length, overdue: g.overdue.length, dueToday: g.dueToday.length, termine: g.todaysEvents.length } });
  }

  // ───────────────────────────────── WOCHEN-LOOP ─────────────────────────────
  if (loop === 'woche') {
    const m = g.fin ? computeMetrics(g.fin) : null;
    const hot = g.prospects.filter(p => (p.score ?? 0) >= 80).length;
    const kontaktiert = g.prospects.filter(p => p.status === 'kontaktiert').length;

    // Rückkopplung: Was hatte ich letzte Woche als „die eine Sache" benannt?
    const letzte = g.loopLog.filter(e => e.agent === 'loop-woche').slice(-1)[0];
    const letzteSache = (letzte?.payload as { eineSache?: string } | undefined)?.eineSache;

    const system = [
      'Du bist JARVIS, Kevins zentrale Intelligenz und Chief of Staff. Erzeuge den WOCHEN-LOOP: Rückblick + Ausrichtung für die kommende Woche.',
      'Nordstern: 1 Mio € Umsatz KD Ventures → min. 300k € Gewinn (Kevin & Malin).',
      'Du bekommst FERTIGE Kennzahlen — rechne nicht neu, erfinde nichts. Sei ehrlich, auch wenn der Kurs nicht reicht.',
      'Verknüpfe die Bereiche: Was bedeutet die Pipeline für den Umsatz? Was blockiert die Ausführung? Wo ist der eine Hebel?',
      letzteSache
        ? `RÜCKKOPPLUNG — letzte Woche hast DU als „die eine Sache" benannt: „${letzteSache}". Prüfe an den Daten, ob das passiert ist, und sag es offen im Feld "vorwocheStatus". Wenn es NICHT passiert ist: wiederhole die Empfehlung NICHT wortgleich, sondern brich sie auf eine kleinere, konkretere Teilhandlung herunter (z. B. „Nachricht an Firma X entwerfen" statt „kontaktieren") und benenne, was die Hürde sein könnte.`
        : 'Es gibt noch keinen Vorwochen-Vergleich — lass "vorwocheStatus" leer.',
      'Antworte NUR als JSON: {"lage":"<2-3 Sätze ehrliche Wochenlage>","vorwocheStatus":"<wurde die letzte „eine Sache" erledigt? ehrlich, sonst leer>","fortschritt":["<was diese Woche wirklich vorwärts ging>"],"stillstand":["<wo nichts passiert ist und warum das teuer ist>"],"eineSache":"<DIE eine Sache, die nächste Woche zählt — klein und konkret genug, dass sie wirklich passiert>","fokus":[{"titel":"<konkreter Fokus>","warum":"<1 Satz>"}],"schutz":"<1 Satz: was Kevin sich nächste Woche freihalten muss>"}',
    ].join('\n');

    const user = [
      `Stichtag: ${wd}, ${today}.`,
      '',
      'CONTROLLING:',
      m && m.aktiveMonate > 0
        ? `Ist ${eur(m.istUmsatz)} (${Math.round(m.fortschritt * 100)}% vom Ziel), Gewinn ${eur(m.istGewinn)}, nötige Run-Rate ${eur(m.runRateNoetig)}/Monat, Runway ${m.runwayMonate != null ? m.runwayMonate.toFixed(1) + ' Monate' : 'n/a'}.`
        : 'Keine Ist-Zahlen gepflegt — der Nordstern ist damit nicht messbar.',
      '',
      `PIPELINE: ${g.prospects.length} Firmen, ${hot} starker Fit (80+), ${kontaktiert} kontaktiert.`,
      '',
      g.perf.index != null
        ? `PERFORMANCE-INDEX: ${g.perf.index} (${g.perf.label}). Säulen: ${g.perf.saeulen.map(s => `${s.label} ${s.score ?? '—'}${s.zuDuenn ? ' (zu dünn)' : ''}`).join(', ')}. Größter Hebel: ${g.perf.hebel ?? '—'}.`
        : 'PERFORMANCE-INDEX: nicht berechenbar.',
      '',
      `AUSFÜHRUNG: ${g.open.length} offen, ${g.critical.length} kritisch, ${g.overdue.length} überfällig.`,
      'Kritische Aufgaben:', g.critical.slice(0, 10).map(fmtTask).join('\n') || '(keine)',
      '',
      `KOMMENDE 7 TAGE — TERMINE (${g.weekEvents.length}):`,
      g.weekEvents.slice(0, 25).map(fmtEvent).join('\n') || '(keine)',
      '',
      g.loopLog.length ? `FRÜHERE LOOP-ERGEBNISSE (zum Vergleich, neueste zuletzt):\n${g.loopLog.slice(-4).map(e => `- ${e.ts.slice(0, 10)} ${e.title}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');

    const r = await askJson<Record<string, unknown>>({ zweck: 'loop', system, user, maxTokens: 4000 });
    if (!r.ok) return NextResponse.json({ error: r.error ?? 'Loop fehlgeschlagen', loop });
    await logRun('loop-woche', `Wochen-Loop ${today}`, r.data);
    return NextResponse.json({ loop, today, ...r.data, stats: { open: g.open.length, critical: g.critical.length, pipeline: g.prospects.length, hot } });
  }

  // ──────────────────────────────── RÜCKBLICK-LOOP ───────────────────────────
  // Selbst-Verbesserung: schaut auf die Historie der Loops und fragt, was das
  // System besser machen muss (nicht Kevin — das System).
  if (loop === 'rueckblick') {
    if (g.loopLog.length < 2) {
      return NextResponse.json({ loop, hinweis: 'Noch zu wenig Historie — lass Morgen-/Wochen-Loop erst ein paar Mal laufen, dann kann ich Muster erkennen.', anzahl: g.loopLog.length });
    }
    const system = [
      'Du bist JARVIS im Selbst-Rückblick. Du siehst die Historie deiner eigenen Loop-Ergebnisse für Kevin.',
      'Frage dich ehrlich: Welche Empfehlungen wiederholen sich (= wurden nie umgesetzt)? Wo hat das System danebengelegen? Was fehlt dir an Daten, um besser zu werden?',
      'Kritisiere DICH und das System, nicht Kevin. Konkret, keine Floskeln.',
      'Antworte NUR als JSON: {"muster":["<wiederkehrendes Muster in den Empfehlungen>"],"blindeFlecken":["<was dem System an Daten/Fähigkeit fehlt>"],"verbesserungen":[{"was":"<konkrete Verbesserung am System>","warum":"<1 Satz>"}]}',
    ].join('\n');
    const user = g.loopLog.slice(-12).map(e => `[${e.ts.slice(0, 16)}] ${e.agent} — ${e.title}\n${JSON.stringify(e.payload).slice(0, 900)}`).join('\n\n');
    const r = await askJson<Record<string, unknown>>({ zweck: 'loop', system, user, maxTokens: 3000 });
    if (!r.ok) return NextResponse.json({ error: r.error ?? 'Loop fehlgeschlagen', loop });
    await logRun('loop-rueckblick', `Rückblick ${today}`, r.data);
    return NextResponse.json({ loop, today, ...r.data, anzahl: g.loopLog.length });
  }

  // ─────────────────── BEREICHS-LOOPS (einheitliches Ergebnis-Format) ────────
  // Finanzen · Sales · Marketing · Operations · Kunden · Gesundheit — jeder
  // zieht seine echten Stores zusammen und liefert {lage, punkte, eineSache,
  // warnung}. Ein Format, ein Renderer, beliebig erweiterbar.
  const BEREICHS_LOOPS = ['finanzen', 'sales', 'marketing', 'operations', 'kunden', 'gesundheit'];
  if (BEREICHS_LOOPS.includes(loop)) {
    const [fplan, kundenF, msF, journalF, wplanF] = await Promise.all([
      loadJson<{ rechnungen: { kunde: string; titel: string; betrag: number; status: string; faellig?: string }[]; zahlungen: { an: string; betrag: number; status: string; faellig?: string }[]; produkte: { name: string; preis: number; status: string; einheit: string }[]; uhrwerk?: { letztesMeeting: string | null } }>('finanzplan'),
      loadJson<{ kunden: { name: string; status: string; mandat?: string; cashflow?: number; naechsterSchritt?: string }[] }>('kunden'),
      loadJson<{ meilensteine: { titel: string; bereich: string; faellig?: string; zeitfenster?: string; fortschritt: number; erledigt: boolean; messlatte?: string }[] }>('meilensteine'),
      loadJson<Record<string, { energy?: number; stress?: number; haut?: string; ruecken?: string; tagesnote?: number }>>('journal'),
      loadJson<Record<string, { date: string; dauerMin: number }[]>>('wochenplan'),
    ]);
    const m = g.fin ? computeMetrics(g.fin) : null;
    const msBiz = (msF?.meilensteine ?? []).filter(x => x.bereich === 'business' && !x.erledigt);
    const msGes = (msF?.meilensteine ?? []).filter(x => x.bereich === 'gesundheit' && !x.erledigt);
    const formatJson = 'Antworte NUR als JSON: {"lage":"<2-3 Sätze ehrliche Lage>","punkte":[{"titel":"<konkret>","warum":"<1 Satz>"}],"eineSache":"<DIE eine Handlung — klein genug, dass sie wirklich passiert>","warnung":"<optional, sonst leer>"} — maximal 4 punkte.';
    const kopf = 'Du bist JARVIS, Kevins Chief of Staff. Du bekommst FERTIGE Zahlen aus echten Stores — rechne nicht neu, erfinde nichts, sei ehrlich auch wenn es unbequem ist. Deutsch, knapp, kein Startup-Sprech.';

    let system = '', user = '', label = '';
    if (loop === 'finanzen') {
      label = 'Finanz-Loop';
      system = [kopf, 'FINANZ-LOOP: die komplette Geld-Lage — Forderungen eintreiben, Rechnungen stellen, Takt halten. punkte = Geld-Moves.', formatJson].join('\n');
      const zahlOffen = (fplan?.zahlungen ?? []).filter(z => z.status === 'offen');
      user = [
        `Stichtag ${wd}, ${today}. Nordstern 1 Mio € / 300k Gewinn.`,
        m && m.aktiveMonate > 0 ? `CONTROLLING: Ist ${eur(m.istUmsatz)} (${Math.round(m.fortschritt * 100)}%), Run-Rate nötig ${eur(m.runRateNoetig)}/Monat, Runway ${m.runwayMonate?.toFixed(1) ?? 'n/a'} Monate.` : 'CONTROLLING: leer — Nordstern nicht messbar.',
        `FORDERUNGEN: ${eur(g.geld.forderungen)} offen${g.geld.ueberfaelligeForderungen ? ` (davon ${eur(g.geld.ueberfaelligeForderungen)} ÜBERFÄLLIG)` : ''} · in Vorbereitung ${eur(g.geld.vorbereitung)}.`,
        `RECHNUNGEN: ${(fplan?.rechnungen ?? []).map(r2 => `${r2.kunde} „${r2.titel}" ${eur(r2.betrag)} [${r2.status}${r2.faellig ? `, fällig ${r2.faellig}` : ''}]`).join(' · ') || 'keine'}`,
        `EIGENE ZAHLUNGEN (Prioritätenliste, oben zuerst): ${zahlOffen.slice(0, 6).map(z => `${z.an} ${eur(z.betrag)}${z.faellig ? ` (${z.faellig})` : ''}`).join(' · ') || 'leer'}`,
        `MANDATE: ${g.mandate.aktiv} aktiv (${eur(g.mandate.cashflow)}/Monat), ${g.mandate.gespraech} im Gespräch.`,
        `PRODUKTE: ${(fplan?.produkte ?? []).map(p => `${p.name} ${p.preis ? eur(p.preis) : 'ohne Preis'} [${p.status}]`).join(' · ') || 'keine'}`,
        `FINANZ-UHRWERK: letztes Meeting ${fplan?.uhrwerk?.letztesMeeting ?? 'noch nie'} (Takt: 2× im Monat).`,
      ].join('\n');
    } else if (loop === 'sales') {
      label = 'Sales-Loop';
      const hot = g.prospects.filter(p => (p.score ?? 0) >= 80 && p.status !== 'kontaktiert' && p.status !== 'verworfen');
      system = [kopf, 'SALES-LOOP: Pipeline in Bewegung bringen. punkte = die nächsten konkreten Kontakte/Bewegungen (mit Firmenname).', formatJson].join('\n');
      user = [
        `Stichtag ${wd}, ${today}.`,
        `PIPELINE: ${g.prospects.length} Firmen · ${hot.length} heiß & unkontaktiert · ${g.prospects.filter(p => p.status === 'kontaktiert').length} kontaktiert.`,
        `HEISSE UNKONTAKTIERTE: ${hot.slice(0, 4).map(p => `${p.company} (${p.score})${(p as { angle?: string }).angle ? ` — Aufhänger: ${(p as { angle?: string }).angle}` : ''}`).join('\n') || 'keine'}`,
        `MANDATE: ${g.mandate.aktiv} aktiv (${eur(g.mandate.cashflow)}/Monat), ${g.mandate.gespraech} im Gespräch — ${(kundenF?.kunden ?? []).filter(k => k.status === 'gespraech').map(k => `${k.name}: ${k.naechsterSchritt ?? 'nächster Schritt unklar'}`).join(' · ')}`,
        `PRODUKTE (Angebot): ${(fplan?.produkte ?? []).filter(p => p.status === 'aktiv').map(p => `${p.name} ${eur(p.preis)}/${p.einheit}`).join(' · ') || 'KEINS aktiv — ohne Angebot kein Abschluss'}`,
        `MEILENSTEINE: ${msBiz.slice(0, 3).map(x => `${x.titel} (${x.fortschritt}%${x.faellig ? `, ${x.faellig}` : ''})`).join(' · ') || 'keine'}`,
        'Der Outreach-Agent kann je Prospect fertige Erstansprachen entwerfen (E-Mail + LinkedIn) — beziehe das ein.',
      ].join('\n');
    } else if (loop === 'marketing') {
      label = 'Marketing-Loop';
      const contentLaeufe = g.log.filter(l => l.agent === 'content').slice(0, 3);
      system = [kopf,
        'MARKETING-LOOP: Sichtbarkeit für KEMARIS/POINCAP aufbauen. punkte = konkrete Content-/Sichtbarkeits-Ideen (Format + Thema).',
        'SPRACHREGELN: NIEMALS Dashboard, Tool, Disruption, Unicorn, Game Changer, Reporting. Stattdessen wo passend: Steuerungslücke, Echtzeit-Finanzbild, Kapitalstau, Souveränität, Capital Readiness.',
        formatJson].join('\n');
      user = [
        `Stichtag ${wd}, ${today}.`,
        `SICHTBARKEITS-MEILENSTEINE: ${msBiz.filter(x => /podcast|magazin|launch|presse|landing/i.test(x.titel)).map(x => `${x.titel} (${x.fortschritt}%${x.faellig ? `, ${x.faellig}` : x.zeitfenster ? `, ${x.zeitfenster}` : ''})`).join(' · ') || 'keine gepflegt'}`,
        `LETZTE CONTENT-LÄUFE: ${contentLaeufe.map(l => l.title).join(' · ') || 'keine — der Content-Agent liegt brach'}`,
        `ZIELGRUPPE: inhaber-/familiengeführter Mittelstand DACH (50–500 MA), Entscheider GF/CFO/Leitung Controlling. Kanäle bisher: LinkedIn, Landingpage F&F.`,
        `KONTEXT: F&F-Launch ${msBiz.find(x => /F&F|Launch/i.test(x.titel))?.faellig ?? '01.08'} · Volllaunch + Pressekonferenz 01.10.`,
      ].join('\n');
    } else if (loop === 'operations') {
      label = 'Operations-Loop';
      const blocked = g.open.filter(t => (t as { status?: string }).status === 'blocked');
      const delegiert = g.open.filter(t => /— Delegiert an /.test((t as { description?: string }).description ?? ''));
      const wochenMin = Object.values(wplanF ?? {}).flat().reduce((s, b2) => s + (b2?.dauerMin || 0), 0);
      system = [kopf, 'OPERATIONS-LOOP: Ausführung entstopfen und Kevin entlasten. punkte = Entlastungs-Moves (was, und WER es übernimmt — Team: Malin, Frank, Lisa, Clemens, Jan, Björn, Alex).', formatJson].join('\n');
      user = [
        `Stichtag ${wd}, ${today}.`,
        `AUSFÜHRUNG: ${g.open.length} offen · ${g.overdue.length} überfällig · ${g.critical.length} kritisch · ${blocked.length} blockiert · ${delegiert.length} bereits delegiert.`,
        `ÜBERFÄLLIG: ${g.overdue.slice(0, 6).map(t => t.title).join(' · ') || 'nichts'}`,
        `BLOCKIERT: ${blocked.slice(0, 4).map(t => t.title).join(' · ') || 'nichts'}`,
        `KAPAZITÄT: ${(wochenMin / 60).toFixed(1)} h in Plan-Blöcken über alle gespeicherten Wochen.`,
        `RISK-SHIELDS: ${g.shields.map(s => s.text).join(' · ') || 'keine aktiven Warnungen'}`,
        `FINANZ-UHRWERK: letztes Meeting ${fplan?.uhrwerk?.letztesMeeting ?? 'noch nie'}.`,
        'Die Delegations-Runde in /os/aufgaben erzeugt fertige Übergabetexte — beziehe das ein.',
      ].join('\n');
    } else if (loop === 'kunden') {
      label = 'Kunden-Loop';
      const kliste = kundenF?.kunden ?? [];
      const reVon = (name: string) => (fplan?.rechnungen ?? []).filter(r2 => r2.kunde.toLowerCase() === name.toLowerCase());
      system = [kopf, 'KUNDEN-LOOP: jedes Mandat gesund halten — Wert liefern, Rechnungen im Fluss, nächste Schritte klar. punkte = je Kunde der nächste Schritt (Kundenname in den Titel).', formatJson].join('\n');
      user = [
        `Stichtag ${wd}, ${today}.`,
        ...kliste.map(k => {
          const re = reVon(k.name);
          const offenSum = re.filter(r2 => r2.status !== 'bezahlt').reduce((s, r2) => s + r2.betrag, 0);
          return `KUNDE ${k.name} [${k.status}]: Mandat: ${k.mandat ?? '—'} · Cashflow ${k.cashflow ? eur(k.cashflow) + '/Monat' : '—'} · Rechnungen: ${re.length ? `${re.length} (${eur(offenSum)} offen)` : 'keine'} · nächster Schritt lt. CRM: ${k.naechsterSchritt ?? 'unklar'}`;
        }),
        kliste.length ? '' : 'Keine Kunden gepflegt.',
      ].filter(Boolean).join('\n');
    } else {
      label = 'Gesundheits-Loop';
      const j7 = Object.entries(journalF ?? {}).sort(([a], [b2]) => a.localeCompare(b2)).slice(-7).map(([, v]) => v);
      const energie = j7.map(x => x.energy).filter((x): x is number => typeof x === 'number');
      const stress = j7.map(x => x.stress).filter((x): x is number => typeof x === 'number');
      system = [kopf,
        'GESUNDHEITS-LOOP (PRIVAT — nur für Kevin, niemals Business-Kontext): Trend ehrlich lesen, die Etappen im Blick, Schutz vor Überlastung. punkte = die 1-2 Gesundheits-Hebel der Woche.',
        'Kevin: Bandscheibenvorfall (Reha täglich, spine-safe), Psoriasis (anti-entzündlich essen), Cannabis-Cut seit 31.07. Kein Medizinrat — Alltag und Verhalten.',
        formatJson].join('\n');
      user = [
        `Stichtag ${wd}, ${today}.`,
        `AKTUELL: Recovery ${g.vitals.rec}%, Schlaf ${g.vitals.sleep}h, HRV ${g.vitals.hrv}, Puls ${g.vitals.rhr}${vitalsHint(g.vitals)}.`,
        `JOURNAL (7 Tage): Energie Ø ${energie.length ? (energie.reduce((a, b2) => a + b2, 0) / energie.length).toFixed(1) : '—'}/5 · Stress Ø ${stress.length ? (stress.reduce((a, b2) => a + b2, 0) / stress.length).toFixed(1) : '—'}/5 · ${j7.length} Einträge.`,
        `GESUNDHEITS-ETAPPEN: ${msGes.map(x => `${x.titel} (${x.fortschritt}%${x.messlatte ? ` — Messlatte: ${x.messlatte}` : ''})`).join(' · ') || 'keine'}`,
      ].join('\n');
    }

    const r = await askJson<Record<string, unknown>>({ zweck: 'loop', system, user, maxTokens: 3500 });
    if (!r.ok) return NextResponse.json({ error: r.error ?? 'Loop fehlgeschlagen', loop });
    await logRun(`loop-${loop}`, `${label} ${today}`, r.data);
    return NextResponse.json({ loop, today, ...r.data });
  }

  return NextResponse.json({ error: `Unbekannter Loop: ${loop}` }, { status: 400 });
}
