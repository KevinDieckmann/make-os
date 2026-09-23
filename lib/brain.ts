// ─── MAKE OS — Das Brain ────────────────────────────────────────────────────
// DIE eine Kontextschicht. Vorher sammelten kimmi/liveContext, loop/gather,
// tageslauf und fokus jeweils selbst — vier Inseln mit vier Wahrheiten und
// verschiedenen Frische-Regeln. Jetzt: gatherBrain() holt alles EINMAL,
// promptBrain() baut daraus die Standard-Kontextblöcke für jeden Agenten.
//
// Grundsätze:
//   · Jede Quelle fällt einzeln aus (allSettled) — das Brain liefert immer.
//   · Jede Quelle trägt ihre Frische. Alte Daten werden als alt AUSGEWIESEN,
//     nie als aktuell verkauft.
//   · Feste Wahrheiten (Nordstern, Meilensteine, Team) leben hier, nicht
//     verstreut in Routen.

import { loadJson } from '@/lib/store/local-db';
import { localDay, tagePlus, alterStunden } from '@/lib/zeit';
import { resolveVitals, vitalsHint, type ResolvedVitals } from '@/lib/vitals';
import { computeIndex, type PerfIndex } from '@/lib/performance';
import { computeMetrics, eur, type FinanceState, type FinanceMetrics } from '@/lib/make-one/finance-data';
import { recentRuns, type AgentLogEntry } from '@/lib/agent-log';
import { computeShields, shieldZeilen, type Shield } from '@/lib/risk';
import { schwellen, type Schwellen } from '@/lib/schwellen';
import { MODUS, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import { THEMA, STANDARD_ORDNUNG, themaVon } from '@/lib/make-one/ordnung-data';
import { ORG, orgVon } from '@/lib/make-one/organisation-data';
import { einschaetzen, dauerText } from '@/lib/make-one/umsetzung-data';
import { teamZeilen } from '@/lib/make-one/team-data';
import type { Prospect } from '@/lib/make-one/prospecting-data';

// ── Feste Wahrheiten (client-sicher ausgelagert) ──
export { NORDSTERN, MILESTONES } from '@/lib/make-one/nordstern-data';
import { NORDSTERN, MILESTONES } from '@/lib/make-one/nordstern-data';

// ── Formen ──
interface StoredTask { id: string; title: string; status: string; priority: string; dueDate?: string; projectId?: string; assignee?: string }
interface StoredProject { id: string; title: string }
interface CalEvent { title?: string; startDate?: string; endDate?: string; allDay?: boolean; calendarName?: string }
export interface MsMail { id?: string; subject?: string; senderName?: string; senderEmail?: string; preview?: string; receivedAt?: string; isRead?: boolean; importance?: string }

export interface Brain {
  heute: string;
  vitals: ResolvedVitals;
  index: PerfIndex | null;
  tasks: {
    alle: StoredTask[];
    offen: StoredTask[];
    overdue: StoredTask[];
    dueToday: StoredTask[];
    kritisch: StoredTask[];
    projektName: (id?: string) => string;
  };
  finance: FinanceState | null;
  metrics: FinanceMetrics | null;
  prospects: Prospect[];
  pipeline: { gesamt: number; hot: number; kontaktiert: number };
  kalender: {
    heute: CalEvent[];
    woche: CalEvent[];
    at: string | null;
    alterH: number | null;
    /** > 12 Std. oder unbekannt → als unsicher behandeln. */
    stale: boolean;
    /** Frische je Quelle — der M365-Snapshot altert unabhängig vom Apple-Cache. */
    quellen: { apple: { alterH: number | null; stale: boolean }; kemaris: { alterH: number | null; stale: boolean } };
  };
  /** M365-Postfach-Snapshot (KEMARIS) — Alex' Mails gehören ins Bild. */
  msMails: { ungelesen: MsMail[]; at: string | null; alterH: number | null; stale: boolean };
  laeufe: AgentLogEntry[];
  /** Business-Meilensteine aus dem Store (gesundheit bleibt hier bewusst draußen). */
  meilensteine: string[];
  /** Geldfluss aus der Finanzplanung + Mandate aus dem CRM. */
  geld: { forderungen: number; vorbereitung: number; ueberfaelligeForderungen: number };
  mandate: { aktiv: number; gespraech: number; cashflow: number };
  /** Deterministische Frühwarnungen (lib/risk) — Agenten sprechen sie aktiv an. */
  shields: Shield[];
  /** Die Lage aus dem Kompass — sie bestimmt, wie priorisiert wird. */
  lage: {
    modus: string;
    label: string;
    satz: string;
    /** Reihenfolge der Themen: was zuerst zählt, wenn alles wichtig ist. */
    ordnung: string[];
    schwellen: Schwellen;
  };
}

/** Alles einsammeln — jede Quelle darf einzeln ausfallen. */
/**
 * Der Live-Zustand. `person` entscheidet, WESSEN Körperwerte darin stehen —
 * seit 07.09., weil Jarvis sonst Malin Kevins Recovery vorgelesen hätte.
 * Alles andere (Zahlen, Aufgaben, Kalender) ist gemeinsam und bleibt gleich.
 */
export async function gatherBrain(heute = localDay(), person: string = 'kevin'): Promise<Brain> {
  const [tasksR, finR, prospectsR, calR, kemR, msR, vitalsR, indexR, laeufeR, meilR, fplanR, kundenR, shieldsR, kompassR, ordnungR, schwellenR] = await Promise.allSettled([
    loadJson<{ tasks: StoredTask[]; projects: StoredProject[] }>('tasks'),
    loadJson<FinanceState>('finance'),
    loadJson<{ prospects: Prospect[] }>('prospects'),
    loadJson<{ events: CalEvent[]; at?: string }>('calendar-cache'),
    loadJson<{ events: { title?: string; start?: string; end?: string; isTeams?: boolean }[]; at?: string }>('kemaris-calendar'),
    loadJson<{ emails: MsMail[]; at?: string }>('microsoft-inbox'),
    resolveVitals(heute, person),
    computeIndex(heute, person),
    recentRuns(undefined, 10),
    loadJson<{ meilensteine: { titel: string; bereich: string; faellig?: string; zeitfenster?: string; fortschritt: number; erledigt: boolean }[] }>('meilensteine'),
    loadJson<{ rechnungen: { status: string; betrag: number; faellig?: string }[] }>('finanzplan'),
    loadJson<{ kunden: { status: string; cashflow?: number }[] }>('kunden'),
    computeShields(heute),
    loadJson<{ modus?: string }>('kompass'),
    loadJson<{ reihenfolge?: string[] }>('ordnung'),
    schwellen(),
  ]);
  const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

  const store = val(tasksR);
  const alle = store?.tasks ?? [];
  const projects = store?.projects ?? [];
  const offen = alle.filter(t => t.status !== 'done');
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  offen.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));

  const fin = val(finR);
  const prospects = val(prospectsR)?.prospects ?? [];
  const cal = val(calR);
  const calAlterH = alterStunden(cal?.at ?? null);
  const wocheEnde = tagePlus(heute, 7);

  // KEMARIS-Termine (M365-Snapshot) in den Kalender mergen. Dedupe über
  // Titel+Startminute — „CapOS TownHall" steht sonst doppelt da, weil er
  // in beiden Kalendern gepflegt ist.
  const kem = val(kemR);
  const kemAlterH = alterStunden(kem?.at ?? null);
  const kemEvents: CalEvent[] = (kem?.events ?? []).map(e => ({
    title: e.title, startDate: e.start, endDate: e.end, allDay: false, calendarName: 'KEMARIS (M365)',
  }));
  const schluessel = (e: CalEvent) => `${(e.title ?? '').toLowerCase().trim()}|${(e.startDate ?? '').slice(0, 16)}`;
  const bekannt = new Set((cal?.events ?? []).map(schluessel));
  const events: CalEvent[] = [...(cal?.events ?? []), ...kemEvents.filter(e => !bekannt.has(schluessel(e)))]
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  const ms = val(msR);
  const msAlterH = alterStunden(ms?.at ?? null);

  const vitalsFallback: ResolvedVitals = {
    rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true,
  };

  return {
    heute,
    vitals: val(vitalsR) ?? vitalsFallback,
    index: val(indexR),
    tasks: {
      alle,
      offen,
      overdue: offen.filter(t => t.dueDate && t.dueDate < heute),
      dueToday: offen.filter(t => t.dueDate === heute),
      kritisch: offen.filter(t => t.priority === 'critical'),
      projektName: (id?: string) => projects.find(p => p.id === id)?.title ?? '',
    },
    finance: fin,
    metrics: fin ? computeMetrics(fin) : null,
    prospects,
    pipeline: {
      gesamt: prospects.length,
      hot: prospects.filter(p => (p.score ?? 0) >= 80).length,
      kontaktiert: prospects.filter(p => p.status === 'kontaktiert').length,
    },
    kalender: {
      heute: events.filter(e => (e.startDate ?? '').slice(0, 10) === heute),
      woche: events.filter(e => {
        const d = (e.startDate ?? '').slice(0, 10);
        return d >= heute && d <= wocheEnde;
      }),
      at: cal?.at ?? null,
      alterH: calAlterH == null ? null : Math.round(calAlterH),
      // Unsicher nur, wenn BEIDE Quellen alt sind — eine frische reicht fürs Bild.
      stale: (calAlterH == null || calAlterH > 12) && (kemAlterH == null || kemAlterH > 12),
      quellen: {
        apple: { alterH: calAlterH == null ? null : Math.round(calAlterH), stale: calAlterH == null || calAlterH > 12 },
        kemaris: { alterH: kemAlterH == null ? null : Math.round(kemAlterH), stale: kemAlterH == null || kemAlterH > 12 },
      },
    },
    msMails: {
      ungelesen: (ms?.emails ?? []).filter(m => !m.isRead),
      at: ms?.at ?? null,
      alterH: msAlterH == null ? null : Math.round(msAlterH),
      stale: msAlterH == null || msAlterH > 24,
    },
    laeufe: val(laeufeR) ?? [],
    // Business-Meilensteine aus dem Store — Fallback: alte Konstante.
    meilensteine: (() => {
      const ms = (val(meilR)?.meilensteine ?? []).filter(m => m.bereich === 'business');
      if (!ms.length) return [...MILESTONES];
      return ms.map(m => `${m.titel}${m.erledigt ? ' ✓' : ` (${m.faellig ? m.faellig.slice(8) + '.' + m.faellig.slice(5, 7) + '.' : m.zeitfenster ?? 'offen'}${m.fortschritt ? `, ${m.fortschritt}%` : ''})`}`);
    })(),
    geld: (() => {
      const re = val(fplanR)?.rechnungen ?? [];
      const sum = (l: typeof re) => l.reduce((s, r) => s + (r.betrag || 0), 0);
      const gestellt = re.filter(r => r.status === 'gestellt');
      return {
        forderungen: sum(gestellt),
        vorbereitung: sum(re.filter(r => r.status === 'geplant')),
        ueberfaelligeForderungen: sum(gestellt.filter(r => r.faellig && r.faellig < heute)),
      };
    })(),
    mandate: (() => {
      const k = val(kundenR)?.kunden ?? [];
      return {
        aktiv: k.filter(x => x.status === 'aktiv').length,
        gespraech: k.filter(x => x.status === 'gespraech').length,
        cashflow: k.filter(x => x.status === 'aktiv').reduce((s, x) => s + (x.cashflow ?? 0), 0),
      };
    })(),
    shields: val(shieldsR) ?? [],
    lage: (() => {
      const modusId = val(kompassR)?.modus ?? STANDARD_MODUS;
      const m = MODUS[modusId] ?? MODUS[STANDARD_MODUS];
      const gespeichert = val(ordnungR)?.reihenfolge;
      return {
        modus: modusId,
        label: m.label,
        satz: m.satz,
        ordnung: Array.isArray(gespeichert) && gespeichert.length ? gespeichert : (m.ordnung ?? STANDARD_ORDNUNG),
        schwellen: val(schwellenR) ?? await0Schwellen(),
      };
    })(),
  };
}

/** Notnagel, falls das Laden der Schwellen ausfällt — Werte der Standard-Lage. */
function await0Schwellen(): Schwellen {
  const m = MODUS[STANDARD_MODUS];
  return {
    fokusSchwelle: m.werte['fokus-schwelle'], tageslast: m.werte.tageslast, wochenlast: m.werte.wochenlast,
    kritischGrenze: m.werte['kritisch-grenze'], vorschauTage: m.werte['vorschau-tage'],
    recoveryGruen: m.werte['recovery-gruen'], recoveryGelb: Math.max(20, m.werte['recovery-gruen'] - 26),
    runwayRot: m.werte['runway-warnung'], runwayAmber: m.werte['runway-warnung'] * 2,
    nachtruheAb: m.werte['nachtruhe-ab'],
    tagesstartAuto: m.werte['tagesstart-auto'] >= 50,
    koerperAnAgenten: m.werte['koerper-an-agenten'] >= 50,
  };
}

// ── Prompt-Blöcke — die eine Sprache, in der alle Agenten die Lage sehen ──

/**
 * Die Lage — der wichtigste Block. Er sagt jedem Agenten, wonach überhaupt
 * priorisiert wird. Ohne ihn erfindet jeder Agent seine eigene Rangfolge.
 */
export function blockLage(b: Brain): string {
  const s = b.lage.schwellen;
  const ordnung = b.lage.ordnung.map((id, i) => `${i + 1}. ${THEMA[id]?.label ?? id}`).join(' → ');
  return [
    `LAGE: „${b.lage.label}" — ${b.lage.satz}`,
    `REIHENFOLGE (so wird priorisiert, wenn alles wichtig ist): ${ordnung}.`,
    'Nur KRITISCHE Aufgaben brechen diese Reihenfolge — sie blockieren alles andere.',
    `GRENZEN: höchstens ${s.tageslast} h Arbeit am Tag · Alarm ab ${s.kritischGrenze} kritischen Aufgaben · Vorausschau ${s.vorschauTage} Tage · Runway unter ${s.runwayRot} Monaten ist rot.`,
    'Halte dich an diese Reihenfolge und diese Grenzen. Plane niemals mehr in einen Tag, als die Tageslast hergibt — sag lieber, was dafür weichen muss.',
  ].join('\n');
}

export function blockAufgaben(b: Brain, max = 20): string {
  if (!b.tasks.offen.length) return 'OFFENE AUFGABEN: keine im Store — wenn das überrascht, sag es Kevin, statt Aufgaben zu erfinden.';
  // Jede Aufgabe trägt jetzt Thema, Ort und Umsetzungs-Einschätzung — damit
  // Agenten nach derselben Logik priorisieren wie die Oberfläche.
  const zeilen = b.tasks.offen.slice(0, max).map(t => {
    const zuordnung = { ...t, projectId: t.projectId ?? '' };
    const thema = THEMA[themaVon(zuordnung)]?.label.split(' ')[0] ?? '—';
    const ort = ORG[orgVon(zuordnung)]?.kurz ?? '—';
    const e = einschaetzen(t);
    const wer = e.wer === 'jarvis' ? 'DU KANNST DAS' : e.wer === 'gemeinsam' ? 'du bereitest vor' : 'nur Kevin/Malin';
    return `• ${t.title} [${t.priority}${t.dueDate ? `, fällig ${t.dueDate}` : ''}, ${thema}, ${ort}, ${t.assignee ?? '—'} · ${wer}, ~${dauerText(e.dauer)}]`;
  });
  const jarvisBar = b.tasks.offen.filter(t => einschaetzen(t).wer === 'jarvis');
  const hinweis = jarvisBar.length
    ? `\n${jarvisBar.length} dieser Aufgaben kannst DU selbst erledigen (mit „DU KANNST DAS" markiert) — biete das aktiv an, statt sie nur aufzuzählen.`
    : '';
  return `OFFENE AUFGABEN (${b.tasks.offen.length}, davon ${b.tasks.kritisch.length} kritisch, ${b.tasks.overdue.length} überfällig, ${b.tasks.dueToday.length} heute fällig):\n${zeilen.join('\n')}${hinweis}`;
}

export function blockZahlen(b: Brain): string {
  // Geldfluss + Mandate gibt es auch ohne gefülltes Controlling.
  const extra = [
    b.geld.forderungen ? `Offene Forderungen ${eur(b.geld.forderungen)}${b.geld.ueberfaelligeForderungen ? ` (davon ${eur(b.geld.ueberfaelligeForderungen)} ÜBERFÄLLIG)` : ''}` : '',
    b.geld.vorbereitung ? `Rechnungen in Vorbereitung ${eur(b.geld.vorbereitung)}` : '',
    b.mandate.aktiv + b.mandate.gespraech > 0 ? `Mandate: ${b.mandate.aktiv} aktiv${b.mandate.cashflow ? ` (${eur(b.mandate.cashflow)}/Monat)` : ''}, ${b.mandate.gespraech} im Gespräch` : '',
  ].filter(Boolean).join('. ');
  if (!b.finance || !b.metrics) return `ZAHLEN: kein Finanzstand hinterlegt. Nordstern (${NORDSTERN.split('.')[0]}) ist damit nicht messbar — sag das offen.${extra ? ` ${extra}.` : ''}`;
  const m = b.metrics;
  const kern = m.aktiveMonate > 0
    ? `ZAHLEN: Ist-Umsatz ${eur(m.istUmsatz)} (${Math.round(m.fortschritt * 100)}% vom Ziel ${eur(b.finance.zielUmsatz)}), Gewinn ${eur(m.istGewinn)}, nötige Run-Rate ${eur(m.runRateNoetig)}/Monat, Runway ${m.runwayMonate != null ? m.runwayMonate.toFixed(1) + ' Monate' : 'n/a'}.`
    : `ZAHLEN: Controlling ist leer (Ziel ${eur(b.finance.zielUmsatz)} / ${eur(b.finance.zielGewinn)} Gewinn) — der Nordstern ist nicht messbar. Sag das offen.`;
  return extra ? `${kern} ${extra}.` : kern;
}

export function blockPipeline(b: Brain): string {
  if (!b.pipeline.gesamt) return 'PIPELINE: leer.';
  return `PIPELINE: ${b.pipeline.gesamt} Firmen, ${b.pipeline.hot} starker Fit (80+), ${b.pipeline.kontaktiert} kontaktiert${b.pipeline.hot > 0 && b.pipeline.kontaktiert === 0 ? ' — der starke Fit liegt brach' : ''}.`;
}

export function blockTermine(b: Brain): string {
  const q = b.kalender.quellen;
  const alt: string[] = [];
  if (q.apple.stale) alt.push(`Apple ${q.apple.alterH == null ? 'unbekannt' : q.apple.alterH + ' Std.'} alt`);
  if (q.kemaris.stale) alt.push(`KEMARIS/M365 ${q.kemaris.alterH == null ? 'unbekannt' : q.kemaris.alterH + ' Std.'} alt`);
  const quellenHinweis = alt.length && !b.kalender.stale ? ` (Teilquelle veraltet: ${alt.join(', ')})` : '';
  const stale = b.kalender.stale
    ? ` — ACHTUNG: Kalender-Stand ${b.kalender.alterH == null ? 'unbekannt' : b.kalender.alterH + ' Std.'} alt, womöglich unvollständig. Nicht als „frei" werten; Kevin soll /os/kalender öffnen.`
    : '';
  const heute = b.kalender.heute.map(e => {
    const d = e.startDate ? new Date(e.startDate) : null;
    const zeit = e.allDay || !d ? 'ganztägig' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${zeit} ${e.title ?? ''}`;
  });
  return `TERMINE HEUTE (${b.kalender.heute.length})${stale}${quellenHinweis}:\n${heute.join('\n') || '(keine im Stand)'}`;
}

export function blockIndex(b: Brain): string {
  if (!b.index || b.index.index == null) return 'PERFORMANCE-INDEX: noch nicht berechenbar — sag Kevin, was dafür fehlt.';
  const saeulen = b.index.saeulen.map(x => `${x.label} ${x.score ?? '—'}${x.zuDuenn ? ' (zu dünn, zählt nicht)' : ''}`).join(' · ');
  return `PERFORMANCE-INDEX: ${b.index.index} (${b.index.label}), Datenbasis ${Math.round(b.index.abdeckung * 100)}%. ${saeulen}. Größter Hebel: ${b.index.hebel ?? '—'}. ` +
    'Eine niedrige Säule mit dünner Datenbasis ist KEIN schlechter Wert, sondern eine Messlücke — sag dann, was Kevin eintragen müsste, statt ihn zu bewerten. Säulen-Seiten: /os/saeule/<key>.';
}

export function blockVitals(b: Brain, person: string = 'kevin'): string {
  const v = b.vitals;
  const wer = person === 'malin' ? 'Malin' : 'Kevin';
  // „privat" heißt hier zweierlei: nie in Business-Aussagen — und nie über
  // die andere Person. Die Werte kommen aus dem Speicher der Person, mit der
  // gerade geredet wird (siehe gatherBrain).
  return `KÖRPER (privat, nie in Business-Aussagen, nie über die andere Person): Recovery ${v.rec}%, Schlaf ${v.sleep}h${vitalsHint(v)}.${v.note ? ` ${wer} notiert: "${v.note}"` : ''}`;
}

export function blockGedaechtnis(b: Brain, max = 6): string {
  if (!b.laeufe.length) return '';
  return `LETZTE AGENTEN-LÄUFE (dein Gedächtnis — beziehe dich darauf, statt neu zu raten):\n${b.laeufe.slice(0, max).map(r => `• [${r.ts.slice(0, 16).replace('T', ' ')}] ${r.agent}: ${r.title}`).join('\n')}`;
}

export function blockZiele(b?: Brain): string {
  const ms = b?.meilensteine?.length ? b.meilensteine : [...MILESTONES];
  return `NORDSTERN-ZIEL: ${NORDSTERN}\n\nMEILENSTEINE (pflegbar unter /os/planung/jahr):\n${ms.map(m => `- ${m}`).join('\n')}\n\nTEAM & VERANTWORTUNG (für Delegations-Vorschläge die richtige Person nennen):\n${teamZeilen().map(t => `- ${t}`).join('\n')}`;
}

/** Der Standard-Kontext für Agenten — wähl ab, was der Agent braucht. */
/**
 * Der Auftrag. Steht vor allem anderen, weil er alles andere einordnet.
 *
 * Kevin am 02.08.2026, wörtlich sinngemäß: „Das soll unsere Familien-KI
 * werden, die uns bei allem im Leben unterstützt, mit der wir sprechen und
 * vieles teilen, damit sie uns optimal hilft. Ein treuer Begleiter, der alles
 * im Hintergrund für uns steuert. In drei, vier Jahren haben wir Roboter, die
 * auch gemanagt werden wollen. Die ganze Welt verändert sich — und wir bauen
 * uns jetzt schon unabhängig eine eigene KI. Dazu werden wir Dutzende Firmen
 * kaufen, verkaufen, aufbauen und skalieren."
 *
 * Das ist kein Werbetext, sondern eine Anweisung: Es begründet, warum Jarvis
 * langfristig denkt, warum er Wissen sammelt statt Antworten wegzuwerfen, und
 * warum Gesundheit und Beziehung genauso zählen wie Umsatz.
 */
export function blockAuftrag(): string {
  return [
    'DEIN AUFTRAG — das steht über allem anderen:',
    'Du bist nicht ein Werkzeug in einer Software. Du bist die KI von Kevin und Malin — für ihr ganzes Leben, nicht nur fürs Geschäft. Ihr Ziel ist ein treuer Begleiter, der im Hintergrund steuert, mit dem sie sprechen und dem sie viel anvertrauen, damit du wirklich helfen kannst.',
    'DARAUS FOLGT, wie du arbeitest:',
    '- LANGFRISTIG DENKEN. Die beiden bauen über Jahre. Bewerte Entscheidungen danach, was in einem Jahr trägt, nicht nur was diese Woche löst. Sag es, wenn ein schneller Weg später teuer wird.',
    '- MITSCHREIBEN STATT VERGESSEN. Was du erfährst, gehört ins System — Zusammenhänge, Namen, Muster, Entscheidungen und warum sie so fielen. Ein Begleiter, der jedes Mal bei null anfängt, ist keiner.',
    '- DAS GANZE LEBEN. Gesundheit, Beziehung und Ruhe zählen gleichrangig mit Umsatz. Kevins Rücken und die Beziehung zu Malin sind keine Nebenbedingungen, sondern das, wofür das Geschäft überhaupt da ist. Ein Vorschlag, der Umsatz bringt und den Menschen ruiniert, ist ein schlechter Vorschlag.',
    '- UNABHÄNGIG BLEIBEN. Alles läuft auf ihren eigenen Rechnern, mit ihren eigenen Daten. Bevorzuge Lösungen, die ihnen gehören, vor Abhängigkeiten von fremden Diensten. Wenn etwas nach außen geht, sag es dazu.',
    '- SKALIEREN VORBEREITEN. Die Absicht ist, Firmen zu kaufen, zu verkaufen, aufzubauen und zu skalieren — und in wenigen Jahren auch Maschinen und Roboter zu steuern. Baue und rate so, dass aus einem Fall zehn werden können: Struktur vor Einzellösung, Regel vor Handgriff, Wiederholbares vor Einmaligem.',
    '- EHRLICH SEIN. Ein Begleiter, der schönredet, ist gefährlicher als einer, der schweigt. Nenne Lücken, unsichere Daten und schlechte Nachrichten zuerst und beim Namen.',
  ].join('\n');
}

export function promptBrain(b: Brain, teile?: { koerper?: boolean; ziele?: boolean; gedaechtnis?: boolean }): string {
  const t = { koerper: true, ziele: true, gedaechtnis: true, ...teile };
  // Der Kompass-Schalter schlägt den Wunsch des Aufrufers: steht er auf
  // „bleiben privat", sehen Agenten die Körperdaten gar nicht erst.
  const koerper = t.koerper && b.lage.schwellen.koerperAnAgenten;
  return [
    blockAuftrag(),
    blockLage(b),
    shieldZeilen(b.shields),
    blockAufgaben(b),
    blockZahlen(b),
    blockPipeline(b),
    blockTermine(b),
    blockIndex(b),
    koerper ? blockVitals(b) : '',
    t.gedaechtnis ? blockGedaechtnis(b) : '',
    t.ziele ? blockZiele(b) : '',
  ].filter(Boolean).join('\n\n');
}
