// ─── MAKE OS — Performance-Index aus echten Daten ───────────────────────────
// Vorher standen die fünf Säulen als feste Zahlen im Code — ein Index, der sich
// nie bewegt, ist keine Steuerung, sondern Dekoration.
//
// Jetzt rechnet jede Säule aus dem, was wirklich da ist: Vitalwerte, Routinen,
// Aufgaben, Zahlen, Pipeline, Journal. Jede Teilgröße sagt offen, ob sie auf
// echten Daten beruht — fehlt eine Quelle, wird sie NICHT geraten, sondern
// ausgelassen und die Säule aus dem Rest gebildet.

import { loadJson } from '@/lib/store/local-db';
import { gesundheitsIndexFuer } from '@/lib/gesundheit/speicher';
import { RITUALE } from '@/lib/make-one/team-data';
import { agentenFaktoren, agentenEingabe } from '@/lib/agenten-score';
import { DEPARTMENTS } from '@/lib/make-one/agents-data';
import { ladeStand as ladeTelegram, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { finanzSaeule } from '@/lib/finanzen/haushalt/score';
import { privatIndexFuer } from '@/lib/privat/speicher';
import { ladeFamilie } from '@/lib/familie/speicher';
import { berechne } from '@/lib/business/index';
import { ladeRoh as ladeBusinessRoh, bestandFuer } from '@/lib/business/speicher';
import { pflegeRhythmus, type Rhythmus } from '@/lib/familie/logik';

export interface Faktor {
  label: string;
  /** 0–100 */
  wert: number;
  /** Woraus gerechnet — im Klartext, damit die Zahl nachvollziehbar bleibt. */
  quelle: string;
  /** false = keine echten Daten vorhanden, Faktor zählt nicht mit. */
  echt: boolean;
  /** Wohin ein Klick führt — dorthin, wo man den Faktor bewegt (26.09.). */
  href?: string;
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
  hebelKey?: string | null;
  stand: string;
  /** Der Business-Index (Gesamtsicht) — die Business-Säule im Detail (25.09.). */
  business?: { index: number | null; label: string; saeulen: { label: string; score: number | null }[]; rot: string[]; luecken: number; hebel: string | null };
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
  const [tasksState, journal, cal, ritualLog] = await Promise.all([
    loadJson<{ tasks: { status: string; priority: string; dueDate?: string; assignee?: string }[] }>('tasks'),
    loadJson<Record<string, JournalTag>>(p('journal')),
    loadJson<CalCache>('calendar-cache'),
    loadJson<Record<string, string[]>>(p('rituale')),
  ]);

  // Agenten (24.09.): was Jarvis und die Agenten abnehmen — sechste Säule.
  const [agentLogF, auftraegeF, stapelF, tgStand] = await Promise.all([
    loadJson<{ entries: { ts: string }[] }>('agent-log'),
    loadJson<{ auftraege: { zeit: string; status: string }[] }>('jarvis-auftraege'),
    loadJson<{ vorschlaege: { zeit?: string; status: string; entschiedenAm?: string }[] }>('jarvis-stapel'),
    ladeTelegram().catch(() => null),
  ]);

  const letzte7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - i); return localDay(d); });
  const journalTage = letzte7.filter(d => journal?.[d]);

  // ── Gesundheit & Energie = Gesundheits-Index (26.09., „eine Wahrheit“) ──
  // Erholung & Schlaf 40 · Bewegung & Aufbau 30 · Ernährung & Körper 30
  // (lib/gesundheit). Die Säule IST dieser Index; die Faktoren zeigen seine
  // drei Säulen. Recovery, Schlaf, Routinen, Haut, Streak und Journal stecken
  // jetzt dort als Kennzahlen — mit Schwellen, Verlauf und den Punkten dahinter.
  const gi = await gesundheitsIndexFuer(person, today).catch(() => null);
  const gesundheit: Faktor[] = (gi?.saeulen ?? []).map(s => ({
    label: s.label, wert: s.score ?? 0, echt: s.score != null && !s.zuDuenn, href: `/os/gesundheit?s=index${person !== 'kevin' ? `&fuer=${person}` : ''}`,
    quelle: s.score == null ? 'noch nichts gemessen' : `${s.kennzahlen.filter(k => k.gemessen).length} von ${s.kennzahlen.length} Kennzahlen gemessen${s.zuDuenn ? ' — zu wenig, zählt noch nicht' : ''}`,
  }));

  // ── Business-Performance = Business-Index (25.09., „eine Wahrheit“) ──
  // Unsere KSI-Logik — Finanzielle Gesundheit 50 · Unternehmer-DNA 30 ·
  // Markttraktion 20 — in der Gesamtsicht (lib/business). Die Säule IST dieser
  // Index; die Faktoren zeigen seine drei Säulen. Umsatz-Kurs, Traktion,
  // Meilensteine, Forderungen und Kunden stecken jetzt dort als Kennzahlen.
  const bi = berechne(bestandFuer(await ladeBusinessRoh(today), 'gesamt'));
  const fh = bi.saeulen.find(s => s.id === 'fh')!;
  const business: Faktor[] = bi.saeulen.map(s => ({
    label: `${s.label} (${Math.round(s.gewicht * 100)} %)`, wert: s.score ?? 0, echt: s.score != null && !s.zuDuenn, href: '/os/finanzen?s=business',
    quelle: s.score == null ? 'noch nichts gemessen' : `${s.kennzahlen.filter(k => k.gemessen).length} von ${s.kennzahlen.length} Kennzahlen gemessen${s.zuDuenn ? ' — zu wenig, zählt noch nicht' : ''}`,
  }));

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
    { label: 'Vormittage frei', wert: clamp((freieVormittage / 5) * 100), echt: calFrisch, href: '/os/planung/woche',
      quelle: calFrisch ? `${freieVormittage} von 7 Tagen ohne Vormittagstermin — 5 = 100` : 'Kalender-Stand zu alt, /os/kalender öffnen' },
    { label: 'Keine Terminkollisionen', wert: clamp(100 - kollisionen * 25), echt: calFrisch, href: '/os/planung/woche',
      quelle: calFrisch ? `${kollisionen} Überschneidung(en) diese Woche` : 'Kalender-Stand zu alt' },
    { label: 'Nichts überfällig', href: '/os/aufgaben', wert: offen.length ? clamp(100 - (overdue / offen.length) * 100) : 100, echt: alle.length > 0,
      quelle: alle.length ? `${overdue} von ${offen.length} überfällig` : 'keine Aufgaben' },
    { label: 'Last tragbar', href: '/os/aufgaben', wert: clamp(100 - Math.max(0, offen.length - 12) * 6), echt: alle.length > 0,
      quelle: `${offen.length} offen — bis 12 gilt als tragbar` },
    { label: 'Kritisches im Griff', href: '/os/aufgaben', wert: clamp(100 - kritisch * 18), echt: alle.length > 0,
      quelle: `${kritisch} kritische Aufgaben offen` },
    { label: 'Es fließt', href: '/os/aufgaben', wert: offen.length ? clamp((inArbeit / Math.min(offen.length, 5)) * 100) : 0, echt: alle.length > 0,
      quelle: `${inArbeit} in Arbeit, ${erledigt} erledigt` },
  ];

  // ── Finanzen, Business-Hälfte = Finanzielle Gesundheit des Business-Index (25.09.) ──
  const finanzen: Faktor[] = [{
    label: 'Finanzielle Gesundheit', wert: fh.score ?? 0, echt: fh.score != null && !fh.zuDuenn, href: '/os/finanzen?s=business',
    quelle: fh.score == null ? 'noch nichts gemessen' : `Business-Index · ${fh.kennzahlen.filter(k => k.gemessen).length} von ${fh.kennzahlen.length} Kennzahlen (Liquidität, Forderungen, Ausgaben, Kapital)`,
  }];

  // ── Finanzen, private Hälfte = Privat-Index (25.09.) — nur für Personen mit Haushalt ──
  // Veraltete Buchungen (> 45 Tage) sind eine Lücke, kein schlechter Wert.
  const zugang = await haushaltFuer(person).catch(() => null);
  const pIdx = zugang ? await privatIndexFuer(zugang.haushalt, today).catch(() => null) : null;
  const privat: Faktor[] = pIdx ? [{
    label: 'Privat-Index', wert: pIdx.pi.index ?? 0, echt: pIdx.pi.index != null && pIdx.frisch, href: '/os/finanzen?s=privat#index',
    quelle: pIdx.pi.index == null ? 'noch nichts gemessen' : `${pIdx.pi.label} · ${pIdx.pi.saeulen.map(s => `${s.label} ${s.score ?? '—'}`).join(' · ')}${pIdx.frisch ? '' : ' — Buchungen älter als 45 Tage, zählt nicht'}`,
  }] : [];
  const finanzenGesamt: Faktor[] = [
    ...finanzen.map(f => ({ ...f, label: `Business · ${f.label}` })),
    ...privat.map(f => ({ ...f, label: `Privat · ${f.label}` })),
  ];

  // ── Familie & Partnerschaft (24.09.) ──
  // Mit Haushalt zählt der Pflege-Rhythmus des Paares (lib/familie/logik.ts):
  // gemeinsame Rhythmen über 28 Tage, nie eine Person, nie Gefühle. Ohne
  // Haushalt bleibt der alte Weg (Journal-Stimmung + Rituale).
  const rhythmus: Rhythmus | null = zugang ? pflegeRhythmus(await ladeFamilie(zugang.haushalt), today) : null;
  const familie: Faktor[] | null = rhythmus && rhythmus.score != null
    ? rhythmus.bausteine.map(b => ({ label: b.titel, wert: clamp(b.wert * 100), echt: true, quelle: `${b.text} · Gewicht ${b.gewicht}` }))
    : null;
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
    sozial.push({ label: 'Rituale gehalten', wert: 0, echt: false, quelle: 'noch keins abgehakt — auf /os/familie' });
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
    { key: 'business', label: 'Business-Performance', gewicht: 0.20, faktoren: business, hinweis: 'Business-Index: Finanzielle Gesundheit · Unternehmer-DNA · Markttraktion' },
    // 24.09.: Agenten als sechste Säule (10 %); Planung und Beziehung geben je 5 % ab.
    { key: 'planning', label: 'Planung & Ausführung', gewicht: 0.10, faktoren: planung, hinweis: 'Aufgabenlage + Kalender' },
    { key: 'finance', label: 'Finanzen', gewicht: 0.15, faktoren: finanzenGesamt, hinweis: privat.length ? 'Business (Finanzielle Gesundheit) + Privat (Sparquote, Luft, Schuldenabbau) — je zur Hälfte' : 'Finanzielle Gesundheit (Business-Index)' },
    { key: 'social', label: 'Familie & Partnerschaft', gewicht: 0.10, faktoren: familie ?? sozial, hinweis: familie ? 'Pflege-Rhythmus des Paares · 28 Tage' : rhythmus?.stufe === 'pause' ? 'Ausnahmezeit — pausiert' : 'Journal + Rituale, bis der Pflege-Rhythmus läuft' },
    { key: 'agents', label: 'Agenten', gewicht: 0.10, faktoren: agenten, hinweis: 'Läufe, Aufträge, Stapel, Bote' },
  ];

  const saeulen: Saeule[] = roh.map(s => {
    // Business: die Zahl des Business-Index, nicht der Schnitt seiner drei Säulen (50/30/20).
    if (s.key === 'business') return { ...s, score: bi.index, abdeckung: bi.abdeckung, zuDuenn: bi.index != null && bi.abdeckung < MIN_ABDECKUNG };
    if (s.key === 'finance') {
      const f = finanzSaeule(finanzen, privat);
      return { ...s, score: f.score, abdeckung: f.abdeckung, teile: f.teile, zuDuenn: f.score != null && f.abdeckung < MIN_ABDECKUNG };
    }
    // Pflege-Rhythmus: gewichtete Summe statt Mittelwert — so wie auf /os/familie.
    if (s.key === 'social' && familie && rhythmus?.score != null) return { ...s, score: rhythmus.score, abdeckung: 1, zuDuenn: false };
    // Ausnahmezeit: die Säule zählt nicht, statt zu strafen.
    if (s.key === 'social' && rhythmus?.stufe === 'pause') return { ...s, faktoren: [], score: null, abdeckung: 0, zuDuenn: false };
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

  const businessDetail = {
    index: bi.index, label: bi.label, luecken: bi.luecken, hebel: bi.hebel?.label ?? null,
    saeulen: bi.saeulen.map(x => ({ label: x.label, score: x.zuDuenn ? null : x.score })),
    rot: bi.saeulen.flatMap(x => x.kennzahlen.filter(k => k.ampel === 'rot').map(k => `${k.label} ${k.anzeige}`)),
  };
  const hebelKey = hebel ? saeulen.find(s => s.label === hebel)?.key ?? null : null;
  return { index, label: indexLabel(index), saeulen, abdeckung, hebel, hebelKey, stand: today, business: businessDetail };
}
