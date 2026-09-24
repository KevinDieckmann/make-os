// ─── MAKE OS — Performance-Index aus echten Daten ───────────────────────────
// Vorher standen die fünf Säulen als feste Zahlen im Code — ein Index, der sich
// nie bewegt, ist keine Steuerung, sondern Dekoration.
//
// Jetzt rechnet jede Säule aus dem, was wirklich da ist: Vitalwerte, Routinen,
// Aufgaben, Zahlen, Pipeline, Journal. Jede Teilgröße sagt offen, ob sie auf
// echten Daten beruht — fehlt eine Quelle, wird sie NICHT geraten, sondern
// ausgelassen und die Säule aus dem Rest gebildet.

import { loadJson } from '@/lib/store/local-db';
import { resolveVitals } from '@/lib/vitals';
import { computeMetrics, type FinanceState } from '@/lib/make-one/finance-data';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
// `routineQuote` heißt weiter unten schon eine Zahl — deshalb der Alias.
import { hautTrend, streakStand, routineQuote as quoteFuer, type HautLog, type StreakLog } from '@/lib/gesundheit/eintraege';
import { RITUALE } from '@/lib/make-one/team-data';
import type { Prospect } from '@/lib/make-one/prospecting-data';
import { agentenFaktoren, agentenEingabe } from '@/lib/agenten-score';
import { DEPARTMENTS } from '@/lib/make-one/agents-data';
import { ladeStand as ladeTelegram, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { privatFaktoren, finanzSaeule } from '@/lib/finanzen/haushalt/score';

export interface Faktor {
  label: string;
  /** 0–100 */
  wert: number;
  /** Woraus gerechnet — im Klartext, damit die Zahl nachvollziehbar bleibt. */
  quelle: string;
  /** false = keine echten Daten vorhanden, Faktor zählt nicht mit. */
  echt: boolean;
}

export interface Saeule {
  key: string;
  label: string;
  gewicht: number;
  /** 0–100, aus den echten Faktoren gemittelt. null = gar keine Daten. */
  score: number | null;
  faktoren: Faktor[];
  /** Anteil echter Faktoren (0–1) — wie belastbar der Wert ist. */
  abdeckung: number;
  /** true = zu wenig gemessen, zählt NICHT in den Gesamtindex. */
  zuDuenn: boolean;
  hinweis: string;
  /** Nur Finanzen (24.09.): die beiden Hälften einzeln — Business-Modus zeigt nur die Business-Hälfte. */
  teile?: { business: number | null; privat: number | null };
}

/** Unter dieser Abdeckung ist eine Säule kein Urteil, sondern eine Ahnung.
 *  Sie wird angezeigt, fließt aber nicht in den Index — sonst zieht ein
 *  einzelnes schwaches Signal die ganze Bewertung nach unten. */
export const MIN_ABDECKUNG = 0.4;

export interface PerfIndex {
  index: number | null;
  label: string;
  saeulen: Saeule[];
  /** Gesamt-Abdeckung: wie viel des Index auf echten Daten steht. */
  abdeckung: number;
  /** Die Säule mit dem größten Hebel (niedrig × schwer). */
  hebel: string | null;
  stand: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Mittelt nur die Faktoren, die auf echten Daten stehen. */
function verdichte(faktoren: Faktor[]): { score: number | null; abdeckung: number } {
  const echte = faktoren.filter(f => f.echt);
  if (!echte.length) return { score: null, abdeckung: 0 };
  return {
    score: clamp(echte.reduce((s, f) => s + f.wert, 0) / echte.length),
    abdeckung: echte.length / faktoren.length,
  };
}

export function indexLabel(v: number | null): string {
  if (v == null) return 'noch keine Datenbasis';
  if (v >= 80) return 'Souverän';
  if (v >= 60) return 'Solide';
  if (v >= 40) return 'Verbesserungsfähig';
  return 'Kritisch';
}

import { localDay } from '@/lib/zeit';

interface JournalTag { mood?: number; energy?: number; stress?: number; haut?: string; ruecken?: string }
interface CalCache { events: { title?: string; startDate?: string; endDate?: string; allDay?: boolean }[]; at?: string }

/**
 * Kevins Ansage: „Malin und Kevin müssen auch separate Scores haben. Sie hat
 * ein anderes privates Konto, aber auch eine andere Gesundheit und andere
 * Ziele — das muss mit einfließen."
 *
 * Gelöst über personenbezogene Bestände: Kevins Dateien behalten ihren Namen
 * (nichts wird verschoben, nichts geht verloren), Malins bekommen ein Suffix.
 * Wo sie noch nichts gepflegt hat, ist die Datei leer — und die Säule sagt
 * ehrlich „zu wenig Daten", statt Kevins Werte als ihre auszugeben.
 */
export type Person = string;
export const personDatei = (name: string, person: Person) => (person === 'kevin' ? name : `${name}--${person}`);

/** Diese Bestände gehören einer Person. Alles andere teilen sich die beiden. */
const PERSOENLICH = ['health-log', 'journal', 'rituale', 'vitals', 'haut', 'streak'];

export async function computeIndex(today = localDay(), person: Person = 'kevin'): Promise<PerfIndex> {
  const p = (name: string) => (PERSOENLICH.includes(name) ? personDatei(name, person) : name);
  // Haut-Tagebuch und Streak (23.09.) — die zwei Hebel, die Kevin am 29.07.
  // genannt hat und die bis dahin nirgends gemessen wurden.
  const [hautLog, streakLog] = await Promise.all([
    loadJson<HautLog>(p('haut')),
    loadJson<StreakLog>(p('streak')),
  ]);
  const [vitals, healthLog, tasksState, fin, prospectState, journal, cal, ritualLog, routinenF, msF, kundenF, fplanF] = await Promise.all([
    resolveVitals(today, person),
    loadJson<Record<string, string[]>>(p('health-log')),
    loadJson<{ tasks: { status: string; priority: string; dueDate?: string; assignee?: string }[] }>('tasks'),
    loadJson<FinanceState>('finance'),
    loadJson<{ prospects: Prospect[] }>('prospects'),
    loadJson<Record<string, JournalTag>>(p('journal')),
    loadJson<CalCache>('calendar-cache'),
    loadJson<Record<string, string[]>>(p('rituale')),
    loadJson<{ routinen: { aktiv: boolean }[] }>('routinen'),
    loadJson<{ meilensteine: { bereich: string; faellig?: string; fortschritt: number; erledigt: boolean }[] }>('meilensteine'),
    loadJson<{ kunden: { status: string; cashflow?: number }[] }>('kunden'),
    loadJson<{ rechnungen: { status: string; betrag: number; faellig?: string }[]; produkte: { status: string; preis: number }[] }>('finanzplan'),
  ]);

  // Agenten (24.09.): was Jarvis und die Agenten abnehmen — sechste Säule.
  const [agentLogF, auftraegeF, stapelF, tgStand] = await Promise.all([
    loadJson<{ entries: { ts: string }[] }>('agent-log'),
    loadJson<{ auftraege: { zeit: string; status: string }[] }>('jarvis-auftraege'),
    loadJson<{ vorschlaege: { zeit?: string; status: string; entschiedenAm?: string }[] }>('jarvis-stapel'),
    ladeTelegram().catch(() => null),
  ]);

  // ── Meilenstein-Kurs je Bereich: Ø Fortschritt der OFFENEN Meilensteine;
  //    Überfällige zählen als 0 — Ehrlichkeit schlägt Schönrechnen. ──
  const msKurs = (bereich: 'business' | 'gesundheit') => {
    const offene = (msF?.meilensteine ?? []).filter(m => m.bereich === bereich && !m.erledigt);
    if (!offene.length) return { wert: 100, echt: (msF?.meilensteine ?? []).some(m => m.bereich === bereich), quelle: 'alle Meilensteine erledigt' };
    const ueberfaellig = offene.filter(m => m.faellig && m.faellig < today).length;
    const punkte = offene.map(m => (m.faellig && m.faellig < today ? 0 : m.fortschritt));
    const wert = clamp(punkte.reduce((a, b) => a + b, 0) / offene.length);
    return { wert, echt: true, quelle: `Ø Fortschritt ${offene.length} offener Meilensteine${ueberfaellig ? `, ${ueberfaellig} überfällig (zählt 0)` : ''}` };
  };

  // ── Gesundheit & Energie ──
  const log = healthLog ?? {};
  const letzte7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - i);
    return localDay(d);
  });
  const routineTage = letzte7.filter(d => (log[d]?.length ?? 0) > 0).length;
  // Quote gegen die AKTIVEN Routinen aus dem Planer (Fallback: Konstante).
  const routinenAnzahl = Math.max(1, (routinenF?.routinen ?? []).filter(r => r.aktiv).length || ROUTINE_ITEMS.length);
  const routineQuote = letzte7.reduce((s, d) => s + (log[d]?.length ?? 0), 0) / (7 * routinenAnzahl);

  const journalTage = letzte7.filter(d => journal?.[d]);
  const energien = journalTage.map(d => journal![d].energy).filter((n): n is number => typeof n === 'number');
  const stress = journalTage.map(d => journal![d].stress).filter((n): n is number => typeof n === 'number');

  const gesundheit: Faktor[] = [
    { label: 'Recovery', wert: clamp(vitals.rec), echt: vitals.heute || vitals.alterTage <= 2,
      quelle: vitals.heute ? `Whoop heute: ${vitals.rec}%` : `letzter Stand ${vitals.stand}: ${vitals.rec}%` },
    { label: 'Schlaf', wert: clamp((vitals.sleep / 8) * 100), echt: vitals.heute || vitals.alterTage <= 2,
      quelle: `${vitals.sleep}h — 8h = 100` },
    { label: 'Routinen', wert: clamp(routineQuote * 100), echt: routineTage > 0,
      quelle: routineTage > 0 ? `${routineTage}/7 Tage aktiv, ${Math.round(routineQuote * 100)}% der Häkchen` : 'noch keine Routinen abgehakt' },
    { label: 'Energie (Journal)', wert: energien.length ? clamp((energien.reduce((a, b) => a + b, 0) / energien.length / 5) * 100) : 0, echt: energien.length > 0,
      quelle: energien.length ? `Ø ${(energien.reduce((a, b) => a + b, 0) / energien.length).toFixed(1)}/5 aus ${energien.length} Einträgen` : 'kein Journal-Eintrag in 7 Tagen' },
    { label: 'Stress (invers)', wert: stress.length ? clamp(100 - ((stress.reduce((a, b) => a + b, 0) / stress.length / 5) * 100)) : 0, echt: stress.length > 0,
      quelle: stress.length ? `Ø ${(stress.reduce((a, b) => a + b, 0) / stress.length).toFixed(1)}/5 — niedriger ist besser` : 'kein Journal-Eintrag in 7 Tagen' },
    // Haut (23.09.): aus dem Haut-Tagebuch, nicht mehr aus dem Journal-Flag.
    // Juckreiz 0 = 100, Juckreiz 10 = 0. Sieben Tage Schnitt — ein einzelner
    // schlechter Abend kippt die Säule nicht.
    (() => {
      const ht = hautTrend(hautLog ?? {}, today);
      const echt = typeof ht.juckreiz7 === 'number';
      return {
        label: 'Haut (Juckreiz)',
        wert: echt ? clamp(100 - ht.juckreiz7! * 10) : 0,
        echt,
        quelle: echt
          ? `Ø ${ht.juckreiz7}/10 über 7 Tage${ht.richtung !== 'unbekannt' ? `, ${ht.richtung} als die Woche davor` : ''}${ht.schuebe30 ? `, ${ht.schuebe30} Schub-Tage/30` : ''}`
          : 'kein Haut-Eintrag in 7 Tagen',
      };
    })(),
    // Die beiden Hebel gegen die Schübe, einzeln sichtbar — nicht in der
    // Routinen-Quote versteckt, wo sie niemand findet.
    (() => {
      const q = quoteFuer(log, ['essen'], today, 7);
      return { label: 'Regelmäßig gegessen', wert: clamp(q.quote * 100), echt: q.tage > 0, quelle: q.tage ? `${Math.round(q.quote * 7)}/7 Tage abgehakt` : 'noch nicht abgehakt' };
    })(),
    (() => {
      const q = quoteFuer(log, ['reha'], today, 7);
      return { label: 'Reha & Mobilität', wert: clamp(q.quote * 100), echt: q.tage > 0, quelle: q.tage ? `${Math.round(q.quote * 7)}/7 Tage` : 'noch nicht abgehakt' };
    })(),
    // Der Streak zählt nur für die Person, die ihn führt. 30 saubere Tage = 100.
    ...(() => {
      const st = streakStand(streakLog ?? {}, today);
      if (!st.eintraege30) return [] as Faktor[];
      return [{
        label: 'Sauber (Streak)',
        wert: st.aktuell ? clamp((Math.min(30, st.sauberTage) / 30) * 100) : 0,
        echt: st.aktuell,
        quelle: st.aktuell ? `${st.sauberTage} Tage seit dem letzten Rückfall` : 'seit über 3 Tagen kein Eintrag',
      }];
    })(),
    { label: 'Gesundheits-Meilensteine', ...msKurs('gesundheit') },
  ];

  // ── Business-Performance ──
  const prospects = prospectState?.prospects ?? [];
  const qualifiziert = prospects.filter(p => typeof p.score === 'number').length;
  const kontaktiert = prospects.filter(p => p.status === 'kontaktiert').length;
  const hot = prospects.filter(p => (p.score ?? 0) >= 80).length;
  const m = fin ? computeMetrics(fin) : null;
  const hatZahlen = !!m && m.aktiveMonate > 0;

  const business: Faktor[] = [
    { label: 'Umsatz gg. Ziel', wert: hatZahlen ? clamp(m!.fortschritt * 100) : 0, echt: hatZahlen,
      quelle: hatZahlen ? `${Math.round(m!.fortschritt * 100)}% von 1 Mio €` : 'keine Ist-Zahlen im Controlling' },
    { label: 'Run-Rate hält Kurs', wert: hatZahlen && m!.runRateNoetig > 0 ? clamp((m!.runRateAktuell / m!.runRateNoetig) * 100) : 0, echt: hatZahlen,
      quelle: hatZahlen ? `Ø ${Math.round(m!.runRateAktuell / 1000)}k von nötigen ${Math.round(m!.runRateNoetig / 1000)}k` : 'keine Ist-Zahlen' },
    { label: 'Pipeline aufgebaut', wert: clamp((qualifiziert / 20) * 100), echt: prospects.length > 0,
      quelle: prospects.length ? `${qualifiziert} qualifiziert (20 = 100)` : 'Zielliste leer' },
    { label: 'Pipeline in Bewegung', wert: qualifiziert ? clamp((kontaktiert / qualifiziert) * 100) : 0, echt: qualifiziert > 0,
      quelle: qualifiziert ? `${kontaktiert} von ${qualifiziert} kontaktiert${hot && !kontaktiert ? ` — ${hot} starker Fit liegt brach` : ''}` : 'nichts qualifiziert' },
    { label: 'Meilenstein-Kurs', ...msKurs('business') },
    // ── Mandate: zahlende Kunden sind der ehrlichste Business-Beweis. ──
    (() => {
      const kunden = kundenF?.kunden ?? [];
      const aktiv = kunden.filter(k => k.status === 'aktiv').length;
      const gespraech = kunden.filter(k => k.status === 'gespraech').length;
      const cash = kunden.filter(k => k.status === 'aktiv').reduce((s, k) => s + (k.cashflow ?? 0), 0);
      return { label: 'Mandate', wert: clamp(aktiv * 40 + gespraech * 15), echt: kunden.length > 0,
        quelle: kunden.length ? `${aktiv} aktiv${cash ? ` (${Math.round(cash / 1000)}k €/Monat)` : ''} · ${gespraech} im Gespräch` : 'keine Kunden gepflegt' };
    })(),
    // ── Rechnungsfluss: gestellt muss bezahlt werden — Überfälliges drückt. ──
    (() => {
      const re = fplanF?.rechnungen ?? [];
      const gestellt = re.filter(r => r.status === 'gestellt');
      const bezahlt = re.filter(r => r.status === 'bezahlt').length;
      const relevant = gestellt.length + bezahlt;
      const ueberfaellig = gestellt.filter(r => r.faellig && r.faellig < today).length;
      return { label: 'Rechnungsfluss', wert: relevant ? clamp((bezahlt / relevant) * 100 - ueberfaellig * 25) : 0, echt: relevant > 0,
        quelle: relevant ? `${bezahlt} bezahlt, ${gestellt.length} gestellt${ueberfaellig ? ` (${ueberfaellig} überfällig!)` : ''}` : 'noch keine Rechnung gestellt' };
    })(),
    // ── Produkt-Fundament: ohne aktivierte Pakete gibt es nichts zu verkaufen. ──
    (() => {
      const pr = fplanF?.produkte ?? [];
      const aktivMitPreis = pr.filter(p => p.status === 'aktiv' && p.preis > 0).length;
      const entwuerfe = pr.filter(p => p.status !== 'aktiv').length;
      return { label: 'Produkt-Fundament', wert: clamp(aktivMitPreis * 35 + entwuerfe * 5), echt: pr.length > 0,
        quelle: pr.length ? `${aktivMitPreis} aktiv mit Preis · ${entwuerfe} im Entwurf${!aktivMitPreis ? ' — Pakete festzurren' : ''}` : 'keine Produkte definiert' };
    })(),
  ];

  // ── Planung & Ausführung ──
  const alle = tasksState?.tasks ?? [];
  const offen = alle.filter(t => t.status !== 'done');
  const overdue = offen.filter(t => t.dueDate && t.dueDate < today).length;
  const inArbeit = offen.filter(t => t.status === 'in-progress').length;
  const kritisch = offen.filter(t => t.priority === 'critical').length;
  const erledigt = alle.filter(t => t.status === 'done').length;

  // Kalender: geschützte Zeit und Terminkollisionen sagen mehr über die
  // Ausführbarkeit einer Woche als die reine Aufgabenzahl.
  const events = (cal?.events ?? []).filter(e => !e.allDay && e.startDate);
  const woche = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + i); return localDay(d); });
  const wochenEvents = events.filter(e => woche.includes((e.startDate ?? '').slice(0, 10)));
  const calFrisch = !!cal?.at && (Date.now() - new Date(cal.at).getTime()) / 3_600_000 < 48;
  // Kollisionen: zwei Termine, die sich zeitlich überschneiden.
  let kollisionen = 0;
  const sortiert = [...wochenEvents].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  for (let i = 0; i < sortiert.length - 1; i++) {
    const endeA = sortiert[i].endDate ? new Date(sortiert[i].endDate as string).getTime() : 0;
    const startB = sortiert[i + 1].startDate ? new Date(sortiert[i + 1].startDate as string).getTime() : 0;
    if (endeA && startB && startB < endeA) kollisionen++;
  }
  // Vormittage ohne Termin = Raum für Tiefenarbeit.
  const freieVormittage = woche.filter(d =>
    !wochenEvents.some(e => {
      if ((e.startDate ?? '').slice(0, 10) !== d) return false;
      const h = new Date(e.startDate as string).getHours();
      return h >= 8 && h < 12;
    })
  ).length;

  const planung: Faktor[] = [
    { label: 'Vormittage frei', wert: clamp((freieVormittage / 5) * 100), echt: calFrisch,
      quelle: calFrisch ? `${freieVormittage} von 7 Tagen ohne Vormittagstermin — 5 = 100` : 'Kalender-Stand zu alt, /os/kalender öffnen' },
    { label: 'Keine Terminkollisionen', wert: clamp(100 - kollisionen * 25), echt: calFrisch,
      quelle: calFrisch ? `${kollisionen} Überschneidung(en) diese Woche` : 'Kalender-Stand zu alt' },
    { label: 'Nichts überfällig', wert: offen.length ? clamp(100 - (overdue / offen.length) * 100) : 100, echt: alle.length > 0,
      quelle: alle.length ? `${overdue} von ${offen.length} überfällig` : 'keine Aufgaben' },
    { label: 'Last tragbar', wert: clamp(100 - Math.max(0, offen.length - 12) * 6), echt: alle.length > 0,
      quelle: `${offen.length} offen — bis 12 gilt als tragbar` },
    { label: 'Kritisches im Griff', wert: clamp(100 - kritisch * 18), echt: alle.length > 0,
      quelle: `${kritisch} kritische Aufgaben offen` },
    { label: 'Es fließt', wert: offen.length ? clamp((inArbeit / Math.min(offen.length, 5)) * 100) : 0, echt: alle.length > 0,
      quelle: `${inArbeit} in Arbeit, ${erledigt} erledigt` },
  ];

  // ── Finanzen ──
  const finanzen: Faktor[] = [
    { label: 'Runway', wert: m?.runwayMonate != null ? clamp((m.runwayMonate / 12) * 100) : 0, echt: m?.runwayMonate != null,
      quelle: m?.runwayMonate != null ? `${m.runwayMonate.toFixed(1)} Monate — 12 = 100` : 'kein Cash/Burn hinterlegt' },
    { label: 'Gewinn gg. Ziel', wert: hatZahlen && fin!.zielGewinn > 0 ? clamp((m!.istGewinn / fin!.zielGewinn) * 100) : 0, echt: hatZahlen,
      quelle: hatZahlen ? `${Math.round(m!.istGewinn / 1000)}k von ${Math.round(fin!.zielGewinn / 1000)}k` : 'keine Ist-Zahlen' },
    { label: 'Marge', wert: hatZahlen && m!.istUmsatz > 0 ? clamp((m!.istGewinn / m!.istUmsatz) * 100 * 2) : 0, echt: hatZahlen && (m?.istUmsatz ?? 0) > 0,
      quelle: hatZahlen && m!.istUmsatz > 0 ? `${Math.round((m!.istGewinn / m!.istUmsatz) * 100)}% — 50% = 100` : 'keine Ist-Zahlen' },
  ];

  // ── Finanzen, private Hälfte (24.09.) — nur für Personen mit Haushalt ──
  const zugang = await haushaltFuer(person).catch(() => null);
  const privat: Faktor[] = zugang ? privatFaktoren(await ladeHaushalt(zugang.haushalt), today) : [];
  const finanzenGesamt: Faktor[] = [
    ...finanzen.map(f => ({ ...f, label: `Business · ${f.label}` })),
    ...privat.map(f => ({ ...f, label: `Privat · ${f.label}` })),
  ];

  // ── Beziehung & Team ──
  // Bewusst ohne erfundene Messgröße: hier gibt es (noch) keine Datenquelle.
  const sozial: Faktor[] = [
    { label: 'Stimmung (Journal)', wert: 0, echt: false, quelle: 'kommt aus deinen Journal-Einträgen — noch keine da' },
  ];
  // Rituale: gehaltene Verabredungen mit Malin und dem Team — die einzige
  // Größe hier, die Kevin aktiv steuern kann.
  // Die Rituale haben verschiedene Rhythmen (Sunday Dinner wöchentlich, Handy
  // weg täglich). Die ehrliche Frage ist deshalb nicht „wie oft", sondern
  // „welche davon haben diese Woche stattgefunden".
  const rl = ritualLog ?? {};
  const gehalteneRituale = new Set(letzte7.flatMap(d => rl[d] ?? []));
  const ritualTage = letzte7.filter(d => (rl[d]?.length ?? 0) > 0);
  if (ritualTage.length) {
    sozial.push({
      label: 'Rituale gehalten',
      wert: clamp((gehalteneRituale.size / RITUALE.length) * 100),
      echt: true,
      quelle: `${gehalteneRituale.size} von ${RITUALE.length} Ritualen diese Woche`,
    });
  } else {
    sozial.push({ label: 'Rituale gehalten', wert: 0, echt: false, quelle: 'noch keins abgehakt — auf /os/saeule/social' });
  }

    const moods = journalTage.map(d => journal![d].mood).filter((n): n is number => typeof n === 'number');
  if (moods.length) {
    sozial[0] = { label: 'Stimmung (Journal)', wert: clamp((moods.reduce((a, b) => a + b, 0) / moods.length / 5) * 100), echt: true,
      quelle: `Ø ${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)}/5 aus ${moods.length} Einträgen` };
  }

  // ── Agenten ──
  const agenten = agentenFaktoren(agentenEingabe({
    agenten: DEPARTMENTS.flatMap(d => d.agents),
    log: agentLogF?.entries ?? [],
    auftraege: auftraegeF?.auftraege ?? [],
    vorschlaege: stapelF?.vorschlaege ?? [],
    boteKonfiguriert: telegramKonfiguriert(),
    boteGekoppelt: !!tgStand && chatsFuerPerson(tgStand, person).length > 0,
  }, today));

  const roh: { key: string; label: string; gewicht: number; faktoren: Faktor[]; hinweis: string }[] = [
    // Kevin: „Gesundheit macht mindestens 35% aus — ohne sie funktioniert nichts."
    { key: 'health', label: 'Gesundheit & Energie', gewicht: 0.35, faktoren: gesundheit, hinweis: 'Morgen-Check + Routinen + Journal' },
    { key: 'business', label: 'Business-Performance', gewicht: 0.20, faktoren: business, hinweis: 'Umsatz-Kurs + Pipeline' },
    // 24.09.: Agenten als sechste Säule (10 %); Planung und Beziehung geben je 5 % ab.
    { key: 'planning', label: 'Planung & Ausführung', gewicht: 0.10, faktoren: planung, hinweis: 'Aufgabenlage + Kalender' },
    { key: 'finance', label: 'Finanzen', gewicht: 0.15, faktoren: finanzenGesamt, hinweis: privat.length ? 'Business (Runway, Gewinn, Marge) + Privat (Sparquote, Luft, Schuldenabbau) — je zur Hälfte' : 'Runway + Gewinn' },
    { key: 'social', label: 'Beziehung & Ruhe', gewicht: 0.10, faktoren: sozial, hinweis: 'Journal' },
    { key: 'agents', label: 'Agenten', gewicht: 0.10, faktoren: agenten, hinweis: 'Läufe, Aufträge, Stapel, Bote' },
  ];

  const saeulen: Saeule[] = roh.map(s => {
    if (s.key === 'finance') {
      const f = finanzSaeule(finanzen, privat);
      return { ...s, score: f.score, abdeckung: f.abdeckung, teile: f.teile, zuDuenn: f.score != null && f.abdeckung < MIN_ABDECKUNG };
    }
    const { score, abdeckung } = verdichte(s.faktoren);
    return { ...s, score, abdeckung, zuDuenn: score != null && abdeckung < MIN_ABDECKUNG };
  });

  // Nur Säulen mit tragfähiger Datenbasis fließen in den Index.
  const gezaehlt = saeulen.filter(s => s.score != null && !s.zuDuenn);
  const gewichtSumme = gezaehlt.reduce((s, x) => s + x.gewicht, 0);
  const index = gewichtSumme > 0
    ? clamp(gezaehlt.reduce((s, x) => s + (x.score as number) * x.gewicht, 0) / gewichtSumme)
    : null;

  // Größter Hebel: niedriger Score × hohes Gewicht.
  const hebel = gezaehlt.length
    ? gezaehlt.reduce((best, x) =>
        (100 - (x.score as number)) * x.gewicht > (100 - (best.score as number)) * best.gewicht ? x : best
      ).label
    : null;

  // Wie viel Gewicht steht auf tragfaehigen Daten — das ist die ehrliche
  // Aussage darueber, wie belastbar der Index ueberhaupt ist.
  const gesamtGewicht = roh.reduce((s, x) => s + x.gewicht, 0) || 1;
  const abdeckung = saeulen.reduce((s, x) => s + (x.zuDuenn || x.score == null ? 0 : x.abdeckung) * x.gewicht, 0) / gesamtGewicht;

  return { index, label: indexLabel(index), saeulen, abdeckung, hebel, stand: today };
}
