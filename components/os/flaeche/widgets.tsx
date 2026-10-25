'use client';

// ─── MAKE OS — Widget-Katalog für die Flächen (26.09.) ──────────────────────
// Kevin: „alle Widgets immer zu bearbeiten, andere hinzufügen können.“ Jedes
// Widget lädt sich selbst, rendert seine eigene Karte und gibt `null`, wenn es
// für diese Person nichts zu zeigen gibt (kein Haushalt, keine Daten) — die
// Fläche blendet es dann aus. Einstellungen kommen aus dem Layout (`e`).
// Katalog „aus dem Bestand“: Aufgaben, Termine, Fokus/Wochenfokus, Körper,
// Routinen & Streak, Essen heute, Index je Säule, Finanzen privat, ZOE &
// Inbox, Wer heute dran ist, Familie, nächste Tage — seit 27.09. dazu
// Kanal-Leistung und Nächstes Event · Make.One (Markttraktion), „Routinen heute“
// (27.09.: heute fällige Routinen je Person, Privat/Business, abhakbar).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { wartetAuf } from '@/lib/aufgaben/abhaengig';
import { parseSchnell, schnellZustaendigkeit } from '@/lib/make-one/schnell-anlegen';
import { usePersonen } from '@/components/os/aufgaben/hilfe';
import type { Owner } from '@/types/common';
import { personLesen } from '@/lib/make-one/arbeitsplatz-browser';
import { WEG } from '@/lib/wege';
import { markttraktion } from '@/lib/crm/adresse';
import { TAGE, MAHLZEITEN, type ErnaehrungFile } from '@/lib/ernaehrung/modell';
import type { Breite, Einstellungen, Wert } from '@/lib/flaeche/modell';
import { spaceVonAufgabe, SPACE_LABEL, SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { spaceVonKalender } from '@/lib/kalender/space';
import { bereicheNachZeit, privatGegenBusiness, zeitText, type ZeitBild } from '@/lib/zeitmessung/modell';
import { ErholungHeuteWidget } from '../gesundheit/ErholungHeute';
import { bereichLabel } from '@/lib/zeitmessung/kennzahlen';
import type { Zeitraum } from '@/lib/zeitmessung/einheiten';
import { EinheitBalken, zeitEinheitenAdresse, type ZeitJeEinheitAntwort } from '../zeit/ZeitJeEinheit';
import { kanalLeistung, type KanalZeile } from '@/lib/crm/score';
import type { LeadZeile } from '@/lib/crm/leads';
import type { Event as CrmEvent } from '@/lib/crm/typen';
import type { EventZahlen } from '@/lib/crm/events';
import { MARKE_EVENTS, markeVon, istNetzwerkenEvent, titelMitReihe } from '@/lib/crm/marke';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, Ring, Fortschritt, Chip, Hinweis, Erklaert, feld, zoneFarbe, prioFarbe } from '../ui';
import { heuteFaellig, istGemeinsam, spaceVonRoutine, erledigtTage, type ZaehlerLog } from '@/lib/planung/routinen';
import { routineRhythmusKurz, routineStatistik } from '@/lib/planung/rhythmus';
import { RoutineSteuer, routineHakenSenden, streakText } from '../routinen/haken';
import type { Routine as PlanungsRoutine } from '@/lib/planung/typen';
import { WhoopImport } from '../WhoopImport';
import { EinheitMarke } from '../aufgaben/Einheit';
import type { Task } from '@/types/tasks';
import { EINHEIT_OHNE, einheitErlaubt, passtEinheitFilter } from '@/lib/aufgaben/einheit';
import { BUSINESS_EINHEITEN_NAMEN, BUSINESS_GESELLSCHAFTEN, KERN_EINHEITEN_NAMEN, bereichVon, gesellschaftAusEinheit } from '@/lib/einheiten';
import { sonstigeProjektId, einheitVonSpace } from '@/lib/aufgaben/struktur';
import { spaceAusFlaeche } from '@/lib/flaeche/space';
import { widgetSpace } from '@/lib/flaeche/sicht';
import { dranOhneZusagen } from '@/lib/heute/anstehend';
import { Anstehend } from '../heute/Anstehend';
import { Top3Karte } from '../heute/Top3';
import { BriefingKarte } from '../heute/Briefing';
import { EisenhowerZeichen } from '../aufgaben/Zeichen';
import { aufgabeEinordnung, quadrantRang } from '@/lib/aufgaben/eisenhower';
import { einrichtungStand, fortschrittVon, restzeitText, schritteFuer, schrittInSicht, texteFuer, zurueckgefallen, type HakenZustand, type Kontext as OnboardingKontext } from '@/lib/make-one/onboarding-data';
import { useZieleSpalten } from '@/lib/planung/ziele-client';
import { useFokus } from '@/lib/planung/fokus-client';
import { FOKUS_FRAGE } from '@/lib/planung/fokus';
import { FokusFeld } from '../planung/FokusTafel';
import { useSpace } from '@/hooks/useSpace';
import { offenErledigt } from '@/lib/planung/rang';
import type { Ziel, ZielHorizont } from '@/lib/planung/typen';
import { indexStatus, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import { TRAKTION_IM_BUSINESS_INDEX } from '@/lib/business/register';
import { vorschlagAnzeige, type VorschlagAnzeige, type VorschlagFuerAnzeige } from '@/lib/zoe/vorschlag-anzeige';
import { useNurBusiness } from '../useInhaber';
import { BeispielMarke } from '../BeispielMarke';
import { HeuteImFulfillment } from '../fulfillment/reise/HeuteListe';
import { ProzesseHeuteZeile } from '../prozesse/HeuteProzesse';

/** `seite` = die Fläche, auf der das Widget steht (28.09. abends) — z. B. für den Standard-Space der Aufgaben. */
export interface WidgetProps { e: Einstellungen; titel?: string; i: number; seite?: string }

export interface EinstellungDef { k: string; label: string; art: 'wahl' | 'text' | 'schalter'; optionen?: { w: Wert; label: string }[]; standard: Wert }
export interface WidgetDef { art: string; label: string; bereich: string; beschreibung: string; breite: Breite; einstellungen?: EinstellungDef[]; Komponente: ComponentType<WidgetProps> }
/** Ein Eintrag im „+ Widget“-Katalog — darf ein Widget mit Voreinstellung sein (Wochenfokus = Fokus mit horizont=woche). */
export interface KatalogEintrag { art: string; label: string; beschreibung: string; bereich: string; breite: Breite; voreinstellung?: Einstellungen }

const link: CSSProperties = { color: C.inkLeise, textDecoration: 'none' };
const str = (v: Wert | undefined, std: string) => (typeof v === 'string' && v ? v : std);
const num = (v: Wert | undefined, std: number) => (typeof v === 'number' ? v : typeof v === 'string' && v && isFinite(Number(v)) ? Number(v) : std);

// Tempo (26.09.): dieselbe Adresse innerhalb von 20 s nur einmal holen — Körper und Routinen teilen sich /api/gesundheit/stand,
// ein Zurückwechseln auf Heute lädt nicht alles neu. Schreibende Seiten setzen den Speicher über `datenVergessen()` zurück.
const datenZwischen = new Map<string, { t: number; p: Promise<unknown> }>();
export function datenVergessen(): void { datenZwischen.clear(); }
function holen(url: string): Promise<unknown> {
  const z = datenZwischen.get(url);
  if (z && Date.now() - z.t < 20_000) return z.p;
  const p = fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  datenZwischen.set(url, { t: Date.now(), p });
  return p;
}
/** Einmal laden; `undefined` = lädt, `null` = nichts/kein Zugang. */
function useDaten<T>(url: string, ok: (d: unknown) => T | null): T | null | undefined {
  const [d, setD] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    holen(url).then(x => { if (aktiv) setD(x == null ? null : ok(x)); });
    return () => { aktiv = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
}
/** Uhrzeit einer Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“ (nie über new Date(wandzeit)). */
const uhr = (wand?: string) => (wand && wand.length >= 16 ? wand.slice(11, 16) : '');
const tagKurz = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// ── Aufgaben ────────────────────────────────────────────────────────────────
function AufgabenWidget({ e, titel, i, seite }: WidgetProps) {
  const router = useRouter();
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const personen = usePersonen();
  const [neu, setNeu] = useState('');
  // Ohne Einstellung gilt der Space der Fläche (28.09. abends) — auf Privat-Flächen nie Business-Aufgaben und umgekehrt.
  // Sicht Privat · Business (10.10.): auf einer Fläche mit Bereich gilt IMMER deren Bereich (lib/flaeche/sicht.ts `widgetSpace`) — auch ein altes „alle“.
  const n = num(e.anzahl, 8), nur = str(e.nur, 'dran'), sp = widgetSpace(seite, e), eh = str(e.einheit, 'alle');
  // Heute sieht beides (Kevin 26.09.); ein Widget kann auf einen Space begrenzt sein —
  // und im Business auf eine Einheit (27.09.): dann zählen nur Business-Aufgaben dieser Einheit.
  // 05.10.: eine Einheit tragen auch die Firmen-Spaces unter Privat (Selbstständigkeit) — `einheitErlaubt` statt „nur Business“.
  const passtEh = (t: Task) => eh === 'alle' || (einheitErlaubt(t) && passtEinheitFilter(t.einheit, eh === 'ohne' ? EINHEIT_OHNE : eh));
  // Unteraufgaben (28.09. abends) nur, wenn sie dran sind (fällig/kritisch) — in „alle offenen“ zählt die Aufgabe selbst.
  // Abgebrochene sind nicht offen (29.09.); wer noch auf eine andere Aufgabe wartet, heißt „wartet“, nicht „überfällig“ (#36).
  const offen = state.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && (sp === 'alle' || spaceVonAufgabe(t) === sp) && passtEh(t) && (!t.parentId || nur !== 'alle'));
  // Eisenhower (10.10., Kevin: „Prioritäten sichtbarer“): zuerst wichtig + dringend, dann wichtig, dringend, später; darin nach Deadline. Das Zeichen rechts
  // zeigt das Feld (lib/aufgaben/eisenhower.ts), kritische pulsieren.
  const einord = (t: Task) => aufgabeEinordnung(t, heute);
  const liste = (nur === 'alle' ? offen : offen.filter(t => (t.dueDate && t.dueDate <= heute) || t.priority === 'critical'))
    .sort((a, b) => quadrantRang(einord(a).quadrant) - quadrantRang(einord(b).quadrant) || ((a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)).slice(0, n);
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title ?? '';
  const anlegen = () => {
    const p = parseSchnell(neu.trim(), state.projects, undefined, personen); if (!p.title) return;
    // @Name aus dem Team, eine Verantwortliche (29.09., F4): ohne @ = ich, „@beide“ = ich + die anderen beteiligt.
    const z = schnellZustaendigkeit(p, personLesen() || personen[0]?.speicher || '', personen.map(x => x.speicher));
    // Die Firma der Einheit bestimmt auch den Bereich (05.10.: Selbstständigkeit → Privat, `bereichVon`).
    const ehFirma = eh !== 'alle' && eh !== 'ohne' ? gesellschaftAusEinheit(eh) : undefined;
    const space = sp === 'privat' || sp === 'business' ? sp : eh !== 'alle' ? (ehFirma ? bereichVon(ehFirma) : 'business') : undefined;
    // Aufgaben-Space (28.09. abends): Privat → privat (bzw. die Privat-Einheit der gewählten Einheit); Business → die Firma der Einheit,
    // sonst die erste Business-Gesellschaft; ohne Projekt → „Sonstige“.
    const spaceId = space === 'privat' ? (ehFirma && bereichVon(ehFirma) === 'privat' ? ehFirma : 'privat') : space === 'business' ? (ehFirma ?? BUSINESS_GESELLSCHAFTEN[0] ?? 'kdv') : undefined;
    const einheit = spaceId ? einheitVonSpace(spaceId) : undefined;
    dispatch({ type: 'ADD_TASK', payload: { projectId: p.projectId ?? (spaceId ? sonstigeProjektId(spaceId) : state.projects[0]?.id ?? ''), ...(space ? { space } : {}), ...(spaceId ? { spaceId } : {}), ...(einheit ? { einheit } : {}), title: p.title, description: '', status: 'todo', priority: p.priority, assignee: z.assignee as Owner, ...(z.beteiligte ? { beteiligte: z.beteiligte } : {}), tags: [], subTasks: [], dependencies: [], sortOrder: 0, dueDate: p.dueDate ?? heute } });
    setNeu('');
  };
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.achtung} erklaerung="heute.eisenhower" rechts={<Link href={sp === 'alle' ? '/os/aufgaben' : `/os/aufgaben?space=${sp}`} style={link}>{offen.length} offen ›</Link>}>{titel ?? `${nur === 'alle' ? 'Aufgaben' : 'Aufgaben heute'}${sp === 'alle' ? '' : ` · ${SPACE_LABEL[sp as 'privat' | 'business']}`}${eh === 'alle' ? '' : eh === 'ohne' ? ' · ohne Einheit' : ` · ${eh}`}`}</Ueberschrift>
      <input value={neu} onChange={x => setNeu(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') anlegen(); }} placeholder="Neue Aufgabe für heute … (!! kritisch · fr · #projekt · @Name)" style={{ ...feld, marginBottom: 6 }} />
      <Liste>
        {liste.length === 0 && <Leer>{offen.length ? 'Nichts fällig, nichts kritisch.' : 'Keine Aufgaben. Eine Zeile oben, Enter — oder ZOE sagen.'}</Leer>}
        {liste.map(t => (
          <Zeile key={t.id} onClick={() => router.push(WEG.aufgabe(t.id))}
            links={<Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />}
            titel={t.title}
            unter={[sp === 'alle' ? <span key="s" style={{ color: SPACE_FARBE[spaceVonAufgabe(t)] }}>{SPACE_LABEL[spaceVonAufgabe(t)]}</span> : null, eh === 'alle' && t.einheit && einheitErlaubt(t) ? <EinheitMarke key="e" name={t.einheit} /> : null, projekt(t.projectId), wartetAuf(t, state.tasks).length ? (sp === 'alle' || spaceVonAufgabe(wartetAuf(t, state.tasks)[0]) === sp ? `wartet auf „${wartetAuf(t, state.tasks)[0].title}“` : 'wartet auf eine andere Aufgabe') : t.dueDate && t.dueDate < heute ? `überfällig seit ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : t.dueDate === heute ? 'heute' : t.dueDate ? `bis ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : ''].filter(Boolean).map((x, k, arr) => <span key={k}>{x}{k < arr.length - 1 ? ' · ' : ''}</span>)}
            rechts={<EisenhowerZeichen q={einord(t).quadrant} kritisch={einord(t).kritisch} />} />
        ))}
      </Liste>
    </Karte>
  );
}

// ── Termine (heute / nächste Tage) ──────────────────────────────────────────
interface Termin { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean; calendarName?: string; quelle?: 'privat' | 'business' }
/**
 * Termine der nächsten Tage — seit 29.09. (K5) über /api/kalender (iCloud, private Termine der anderen Person nur als
 * „Belegt“, K1 `maskieren`) statt über den Altweg /api/apple-calendar (Rohtitel ohne Maskierung) und ohne Beispieldaten
 * einer festen Zweitquelle. Der Space eines Termins kommt aus den Kalender-Einstellungen. (Ein gespeicherter Schalter
 * `business` aus alten Layouts wird ignoriert — er tat seit K5 nichts mehr.)
 */
function useTermine(tage: number, space: 'alle' | 'privat' | 'business' = 'alle'): Termin[] | undefined {
  const heute = localDay();
  const bis = plusTage(heute, tage - 1);
  // Sicht Privat · Business (10.10.): der Server liefert nur Termine aus Kalendern des Bereichs (`?space=`, app/api/kalender).
  const kal = useDaten<{ termine: { id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string }[]; einstellungen?: object }>(`/api/kalender?von=${heute}&bis=${plusTage(heute, tage)}${space === 'alle' ? '' : `&space=${space}`}`, d => {
    const r = d as { ok?: boolean; termine?: unknown };
    return r?.ok && Array.isArray(r.termine) ? d as { termine: { id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string }[]; einstellungen?: object } : null;
  });
  return useMemo(() => {
    if (kal === undefined) return undefined;
    const alle: Termin[] = (kal?.termine ?? []).map(t => ({ id: t.id, title: t.titel, startDate: t.start, endDate: t.ende, allDay: t.ganztags, calendarName: t.kalender, quelle: spaceVonKalender((kal?.einstellungen ?? null) as Parameters<typeof spaceVonKalender>[0], t.kalender) }))
      .filter(t => space === 'alle' || t.quelle === space);
    return alle.filter(t => { const d = (t.startDate ?? '').slice(0, 10); return d >= heute && d <= bis; }).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [kal, heute, bis, space]);
}
function TermineWidget({ e, titel, i, seite }: WidgetProps) {
  const router = useRouter();
  const heute = localDay();
  const tage = num(e.tage, 1);
  // Auf einer Fläche mit Bereich deren Bereich (10.10.) — vorher zeigte „Termine heute“ aus dem Katalog auf Heute › Business auch Privates.
  const sp = widgetSpace(seite, e);
  const termine = useTermine(tage, sp);
  const gruppen = useMemo(() => {
    const m = new Map<string, Termin[]>();
    for (const t of termine ?? []) { const d = (t.startDate ?? '').slice(0, 10); m.set(d, [...(m.get(d) ?? []), t]); }
    return [...m.entries()];
  }, [termine]);
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href={sp === 'alle' ? '/os/kalender' : `/os/kalender?space=${sp}`} style={link}>Kalender ›</Link>}>{titel ?? `${tage === 1 ? 'Termine' : `Nächste ${tage} Tage`}${sp === 'alle' ? '' : ` · ${SPACE_LABEL[sp]}`}`}</Ueberschrift>
      <Liste>
        {termine && termine.length === 0 && <Leer>{tage === 1 ? 'Keine Termine heute — freie Bahn.' : 'Nichts eingetragen — freie Bahn.'}</Leer>}
        {termine === undefined && <Leer>lade …</Leer>}
        {gruppen.map(([d, liste]) => (
          <div key={d}>
            {tage > 1 && <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: d === heute ? LEUCHT.puls : C.inkLeise, fontWeight: 600, padding: '8px 2px 2px' }}>{d === heute ? 'Heute' : tagKurz(d)}</div>}
            {liste.map((t, k) => (
              <Zeile key={t.id ?? `${d}-${k}`} onClick={() => router.push(WEG.kalender(d))}
                links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: t.quelle === 'business' ? LEUCHT.business : LEUCHT.puls, width: 52 }}>{t.allDay ? 'Tag' : uhr(t.startDate)}</span>}
                titel={t.title ?? '—'} unter={t.endDate && !t.allDay ? `bis ${uhr(t.endDate)}${t.quelle === 'business' ? ' · Business' : ''}` : t.quelle === 'business' ? 'Business' : undefined} />
            ))}
          </div>
        ))}
      </Liste>
    </Karte>
  );
}

// ── Wer heute dran ist (Markttraktion) ──────────────────────────────────────
// ── Heute im Fulfillment (17.10. spät, Branch `ff-einfach`) ─────────────────────────────────────────────────────────────────────────
// Kevin: „Das Fulfillment soll maximal einfach für uns sein.“ Was in den Fällen jetzt dran ist — dieselbe Liste wie oben auf dem Fulfillment-Start
// (lib/fulfillment/prozesse/heute.ts), mit dem Handgriff in der Zeile (abhaken, Ja/Nein, Entwurf öffnen, Fall starten). Nur Business; ohne Punkt keine Karte.
// Auf Heute › Business (25.10.) ohne Fälle der Privat-Arbeits-Einheit (die Fläche bestimmt die Sicht, `spaceAusFlaeche`) — unter „Alles“ mit Kennzeichen.
function FulfillmentWidget({ titel, i, seite }: WidgetProps) { return <HeuteImFulfillment kompakt i={i} {...(titel ? { titel } : {})} {...(spaceAusFlaeche(seite) === 'business' ? { sicht: 'business' as const } : {})} />; }
// ── Prozesse heute (22.10., ANALYSE_100.md Punkt 69): „n gelaufen, m warten auf dich“ als eine Zeile mit Link zu Prozesse — nur Business; ohne Lauf keine Karte.
function ProzesseWidget({ titel, i }: WidgetProps) { return <ProzesseHeuteZeile i={i} {...(titel ? { titel } : {})} />; }

function DranWidget({ titel, i }: WidgetProps) {
  const router = useRouter();
  // 4.10 (08.10.): Zusagen/Follow-ups stehen in „Steht an“ — hier nur die übrigen Karten der Power Hour (kein Doppel), die Zusagen als Zahl.
  const d = useDaten<{ n: number; zusagen: number; karten: { id: string; name: string; firma?: string; kategorie: string; gruende: string[] }[] }>('/api/crm/heute?n=12', x => { const r = x as { ok?: boolean; karten?: { id: string; name: string; firma?: string; kategorie: string; gruende: string[] }[] }; if (!r?.ok) return null; const o = dranOhneZusagen(r.karten ?? []); return o.karten.length ? { n: o.karten.length, zusagen: o.zusagen, karten: o.karten.slice(0, 3) } : null; });
  if (!d) return null;
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.business} rechts={<Link href={WEG.powerHour()} style={link}>Power Hour ›</Link>}>{titel ?? 'Wer heute dran ist'} · {d.n}</Ueberschrift>
      <Liste>
        {d.karten.map(k => <Zeile key={k.id} onClick={() => router.push(markttraktion('kontakte', undefined, k.id))} links={<Punkt farbe={k.kategorie === 'signale' ? LEUCHT.achtung : LEUCHT.business} />} titel={<>{k.name}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.gruende[0]} />)}
      </Liste>
      {d.zusagen > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Dazu {d.zusagen} {d.zusagen === 1 ? 'Zusage' : 'Zusagen'} — stehen unter „Steht an“.</div>}
    </Karte>
  );
}

// ── Fokus (heute / Woche / Monat) ───────────────────────────────────────────
// Seit 09.10. (Kevin: „dass wir selber alle immer Fokusse einstellen können“): aus den getrennten Fokus-Beständen (lib/planung/fokus-client.ts)
// — Unser Fokus und Mein Fokus des Bereichs; fehlt der Satz, fragt die Karte direkt („Worauf kommt es diesen Monat an?“) mit einem Feld,
// Enter speichert (Stand/409). Der Bereich: Einstellung, sonst der Space der Fläche bzw. der aktive Space.
function FokusWidget({ e, titel, i, seite }: WidgetProps) {
  const h = str(e.horizont, 'auto');
  const spE = str(e.space, spaceAusFlaeche(seite));
  const { space } = useSpace();
  const bereich: 'privat' | 'business' = spE === 'privat' || spE === 'business' ? spE : space;
  const { sicht, fehler, schreiben } = useFokus(bereich);
  const reihe: ('tag' | 'woche' | 'monat')[] = h === 'tag' || h === 'woche' || h === 'monat' ? [h] : ['tag', 'woche', 'monat'];
  const gesetzt = sicht ? reihe.find(x => sicht.horizonte[x].unser.text || sicht.horizonte[x].mein.text) : undefined;
  // Ohne gesetzten Satz fragt die Karte nach dem längsten Horizont der Reihe (auto: der Monat).
  const frage = (gesetzt ?? reihe[reihe.length - 1]);
  const wann = frage === 'tag' ? 'heute' : frage === 'woche' ? 'diese Woche' : 'diesen Monat';
  const v = sicht?.horizonte[frage];
  const wessen = sicht?.darfUnser ? 'unser' : 'mein';
  return (
    <Karte i={i} akzent={gesetzt ? LEUCHT.schlaf : undefined}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href={WEG.fokus('fokus')} style={link}>Fokus ›</Link>}>{titel ?? `${h === 'woche' ? 'Wochenfokus' : h === 'monat' ? 'Monatsfokus' : 'Fokus'} · ${SPACE_LABEL[bereich]}`} {gesetzt && h === 'auto' ? wann : ''}</Ueberschrift>
      {!sicht ? <Leer>{fehler ?? 'lade …'}</Leer> : gesetzt && v ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {v.unser.text && <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>{v.unser.text}</div>}
          {v.mein.text && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}><span style={{ color: LEUCHT.schlaf, fontWeight: 600 }}>Mein Fokus:</span> {v.mein.text}</div>}
          {v.partner.map(p => <div key={p.speicher} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}><span style={{ color: LEUCHT.beziehung, fontWeight: 600 }}>{p.vorname}:</span> {p.text}</div>)}
        </div>
      ) : v ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Noch kein Fokus {wann} — {FOKUS_FRAGE[frage]}</span>
          <FokusFeld wert="" label={`${wessen === 'unser' ? 'Unser' : 'Mein'} Fokus ${wann}`} platzhalter={FOKUS_FRAGE[frage]} onSpeichern={text => schreiben(wessen, frage, { text })} />
        </div>
      ) : <Leer>{fehler ?? 'lade …'}</Leer>}
    </Karte>
  );
}

// ── Ziele: Unsere · Meine · <Name> (09.10.) ─────────────────────────────────
// Kevin 09.10.: „Irgendwie müssen wir das Ganze ja sehen, sonst macht es keinen Sinn.“ Dieselben drei Spalten wie in der Planung, nur lesen:
// gemeinsam (Privat), eigen, je Partner NUR das Geteilte (der Server filtert, lib/planung/ziele-client.ts `useZieleSpalten`). Anlegen/Teilen
// in Planung › Jahr (bzw. dem gewählten Horizont).
const ZIELE_HORIZONT_WORT: Record<string, string> = { jahr: 'Jahr', quartal: 'Quartal', monat: 'Monat', woche: 'Woche' };
/** So viele Ziele zeigt jede Spalte (10.10.: vier statt drei — die Jahresziele sind der Fortschritt, der auf Heute zählt). */
const ZIELE_JE_SPALTE = 4;
function ZieleWidget({ e, titel, i, seite }: WidgetProps) {
  const h = str(e.horizont, 'jahr') as ZielHorizont;
  const laufend = Number(localDay().slice(0, 4));
  // Sicht Privat · Business (10.10.): alle drei Spalten nur aus dem Bereich der Fläche (Server, `?space=`); ohne Bereich wie bisher Privat.
  const ws = widgetSpace(seite, e);
  const bereich: 'privat' | 'business' = ws === 'business' ? 'business' : 'privat';
  const d = useZieleSpalten(h, laufend, true, bereich);
  const planung = `/os/planung/${h === 'woche' ? 'jahr' : h}?space=${bereich}`;
  const spalte = (name: string, farbe: string, ziele: Ziel[], leer: ReactNode) => {
    const { offen } = offenErledigt(ziele);
    const schnitt = ziele.length ? Math.round(ziele.reduce((a, z) => a + (z.erledigt ? 100 : z.fortschritt), 0) / ziele.length) : null;
    return (
      <div key={name} style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: farbe, marginBottom: 4 }}>
          <span>{name}</span>{schnitt != null && <span style={{ color: C.inkLeise }}>Ø {schnitt} %</span>}
        </div>
        {offen.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {offen.slice(0, ZIELE_JE_SPALTE).map(z => (
              <div key={z.id} style={{ display: 'grid', gap: 3 }}>
                {/* Jedes Ziel führt in sein Detail (WEG.ziel); die Zahl ist der wirksame Fortschritt (der Server rechnet ihn aus den Meilensteinen nach). */}
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: TYP.bedien, minWidth: 0 }}>
                  <Link href={WEG.ziel(z.id)} style={{ color: C.ink, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{z.titel}</Link>
                  <span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{Math.round(z.fortschritt)} %</span>
                </span>
                <Fortschritt anteil={z.fortschritt / 100} farbe={farbe} />
              </div>
            ))}
            {offen.length > ZIELE_JE_SPALTE && <Link href={planung} style={{ ...link, fontSize: TYP.bedien }}>+ {offen.length - ZIELE_JE_SPALTE} weitere ›</Link>}
          </div>
        ) : <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{leer}</div>}
      </div>
    );
  };
  return (
    <Karte i={i} akzent={SPACE_FARBE[bereich]}>
      <Ueberschrift farbe={SPACE_FARBE[bereich]} erklaerung="heute.jahresziele" rechts={<Link href={planung} style={link}>Planung ›</Link>}>{titel ?? (h === 'jahr' ? `Jahresziele ${laufend} · ${SPACE_LABEL[bereich]}` : `Ziele · ${ZIELE_HORIZONT_WORT[h] ?? 'Jahr'} · ${SPACE_LABEL[bereich]}`)}</Ueberschrift>
      {!d ? <Leer>lade …</Leer> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14 }}>
          {spalte('Unsere', SPACE_FARBE[bereich], d.unsere, <Link href={planung} style={{ color: C.inkDim }}>Noch kein gemeinsames Ziel — eintragen ›</Link>)}
          {spalte('Meine', LEUCHT.planung, d.meine, <Link href={planung} style={{ color: C.inkDim }}>Noch kein eigenes Ziel — eintragen ›</Link>)}
          {d.partner.map(x => spalte(x.person.vorname, LEUCHT.schlaf, x.ziele, x.nichtGeteilt ? `${x.person.vorname} hat noch nichts geteilt.` : `Für dieses ${ZIELE_HORIZONT_WORT[h] ?? 'Jahr'} nichts geteilt.`))}
        </div>
      )}
    </Karte>
  );
}

// ── Körper (Recovery + Routinen) ────────────────────────────────────────────
interface Stand { vitals?: { rec?: number; heute?: boolean; alterTage?: number; fallback?: boolean }; routinen?: { liste?: { id: string; label: string; heute: boolean }[]; quote7?: number }; streak?: { sauberTage: number; aktuell: boolean }; module?: { serie?: boolean } }
function KoerperWidget({ titel, i }: WidgetProps) {
  const d = useDaten<Stand>('/api/gesundheit/stand', x => ((x as { vitals?: unknown }).vitals ? (x as Stand) : null));
  const v = d?.vitals;
  const frisch = !!v && (v.heute || ((v.alterTage ?? 99) <= 1 && !v.fallback));
  const liste = d?.routinen?.liste ?? [];
  const heuteN = liste.filter(r => r.heute).length;
  const farbe = frisch ? zoneFarbe(v?.rec) : C.inkLeise;
  return (
    <Karte i={i} akzent={frisch ? farbe : undefined}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit" style={link}>Gesundheit ›</Link>}>{titel ?? 'Körper'}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/os/gesundheit" style={{ textDecoration: 'none', color: 'inherit' }}><Ring groesse="klein" label="Recovery" wert={frisch && v?.rec != null ? String(v.rec) : undefined} einheit="%" farbe={farbe} anteil={frisch && v?.rec != null ? v.rec / 100 : undefined} /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{frisch && v?.rec != null ? (v.rec >= 66 ? 'Grün — heute darf es Druck sein.' : v.rec >= 40 ? 'Gelb — fokussiert, mit Puffer.' : 'Rot — heute nur das Nötige.') : d === undefined ? 'lade …' : 'Noch keine Werte von heute'}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '6px 0 8px' }}>{d ? <Link href="/os/gesundheit#routinen" style={{ color: C.inkDim }}>{heuteN} von {liste.length} Routinen ›</Link> : '—'}</div>
          {d && !frisch && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}><WhoopImport kurz /><Link href="/os/ritual?modus=morgen" style={{ fontSize: TYP.bedien, color: C.inkDim }}>von Hand eintragen ›</Link></div>}
          {d && liste.length > 0 && <Fortschritt anteil={heuteN / liste.length} farbe={LEUCHT.gut} />}
        </div>
      </div>
    </Karte>
  );
}

// ── Erholung heute (10.10.) ─────────────────────────────────────────────────
function ErholungWidget({ titel, i }: WidgetProps) { return <ErholungHeuteWidget titel={titel} i={i} />; }

// ── Routinen & Streak ───────────────────────────────────────────────────────
function RoutinenWidget({ titel, i }: WidgetProps) {
  const d = useDaten<Stand>('/api/gesundheit/stand', x => ((x as { routinen?: unknown }).routinen ? (x as Stand) : null));
  const liste = d?.routinen?.liste ?? [];
  const heuteN = liste.filter(r => r.heute).length;
  // Der Zähler nur, wenn die Person das Modul führt (lib/gesundheit/module.ts, 09.10.) — sonst nur die Routinen.
  const streak = d?.module?.serie ? d.streak : undefined;
  return (
    <Karte i={i} akzent={liste.length && heuteN === liste.length ? LEUCHT.gut : undefined}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href={WEG.gesundheit('routinen')} style={link}>{liste.length ? `${heuteN}/${liste.length} heute ›` : 'Routinen ›'}</Link>}>{titel ?? 'Routinen & Streak'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && !liste.length && <Leer>Noch keine Routinen — unter Planung → Routinen anlegen.</Leer>}
      <Liste>
        {liste.slice(0, 8).map(r => <Zeile key={r.id} links={<Punkt farbe={r.heute ? LEUCHT.gut : C.inkLeise} />} titel={<span style={{ color: r.heute ? C.ink : C.inkDim }}>{r.label}</span>} />)}
      </Liste>
      {d && streak && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 10 }}>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 26, letterSpacing: '-.03em', color: streak.aktuell ? LEUCHT.gut : C.inkLeise }}>{streak.sauberTage}</span>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Tage Streak{d.routinen?.quote7 != null ? ` · 7-Tage-Quote ${Math.round(d.routinen.quote7 * 100)} %` : ''}</span>
        </div>
      )}
      {d && !streak && d.routinen?.quote7 != null && liste.length > 0 && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 10 }}>7-Tage-Quote {Math.round(d.routinen.quote7 * 100)} %</div>
      )}
    </Karte>
  );
}

// ── Routinen heute (27.09.) ─────────────────────────────────────────────────
// Was heute für diese Person dran ist — eigene und gemeinsame Routinen, nach
// Rhythmus fällig (täglich, Werktage, feste Tage, x-mal pro Woche, alle n …,
// monatlich; Pausen und Zeitraum), Privat oder Business je Einstellung. `null`,
// wenn nichts fällig ist. Das Widget „Routinen & Streak“ (Gesundheit) bleibt daneben.
// Routinen 2 (10.10.): Zähler („5 von 8“) und mehrmals täglich zählen mit „− +“; jeder Tipp ist EIN PATCH auf /api/state/health — nie mehr
// der ganze Log aus dem Browser (zwei Geräte überschreiben sich so nicht). Darunter Rhythmus und Streak der Routine.
function RoutinenHeuteWidget({ e, titel, i, seite }: WidgetProps) {
  const heute = localDay();
  // Sicht Privat · Business (10.10.): auf einer Fläche mit Bereich gilt deren Bereich — der Server liefert nur ihn (`?space=`).
  const sp = widgetSpace(seite, e);
  const routinen = useDaten<PlanungsRoutine[]>(`/api/state/routinen${sp === 'alle' ? '' : `?space=${sp}`}`, x => (Array.isArray((x as { routinen?: unknown }).routinen) ? (x as { routinen: PlanungsRoutine[] }).routinen : null));
  const ich = useDaten<string>('/api/konto/ich', x => ((x as { ich?: { speicher?: string } }).ich?.speicher ?? null));
  const geladen = useDaten<{ log: Record<string, string[]>; zaehler: ZaehlerLog }>('/api/state/health', x => ({ log: (x as { log?: Record<string, string[]> }).log ?? {}, zaehler: (x as { zaehler?: ZaehlerLog }).zaehler ?? {} }));
  const [stand, setStand] = useState<{ log: Record<string, string[]>; zaehler: ZaehlerLog } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { if (geladen) setStand(geladen); }, [geladen]);
  if (routinen === undefined || ich === undefined || geladen === undefined) return null;
  if (!routinen || !ich) return null;
  const s = stand ?? geladen ?? { log: {}, zaehler: {} };
  const liste = heuteFaellig(routinen, ich, s.log, heute, sp, s.zaehler);
  if (!liste.length) return null;
  const offen = liste.filter(x => !x.heuteErledigt).length;
  /** Sofort sichtbar, dann EIN PATCH; die Antwort des Servers gewinnt. */
  const schritt = async (id: string, ziel: number, ist: number, art: { erledigt: boolean } | { zaehler: 'plus' | 'minus' }) => {
    const neuIst = 'erledigt' in art ? (art.erledigt ? Math.max(ist, ziel) : 0) : Math.max(0, ist + (art.zaehler === 'plus' ? 1 : -1));
    const tagListe = new Set(s.log[heute] ?? []);
    if (neuIst >= ziel) tagListe.add(id); else tagListe.delete(id);
    setStand({ log: { ...s.log, [heute]: [...tagListe] }, zaehler: { ...s.zaehler, [heute]: { ...(s.zaehler[heute] ?? {}), [id]: neuIst } } });
    const a = await routineHakenSenden(id, art);
    if (!a.ok) { setFehler(a.error ?? 'Nicht gespeichert.'); setStand(s); return; }
    setFehler(null);
    setStand(alt => {
      const b = alt ?? s;
      return { log: { ...b.log, [heute]: a.erledigt ?? [] }, zaehler: { ...b.zaehler, [heute]: { ...(b.zaehler[heute] ?? {}), [id]: a.ist ?? neuIst } } };
    });
    datenVergessen();
  };
  const farbe = sp === 'business' ? SPACE_FARBE.business : sp === 'privat' ? SPACE_FARBE.privat : LEUCHT.gut;
  return (
    <Karte i={i} akzent={!offen ? LEUCHT.gut : undefined}>
      <Ueberschrift farbe={farbe} rechts={<Link href="/os/planung/routinen" style={link}>{offen ? `${offen} offen ›` : 'alle erledigt ›'}</Link>}>{titel ?? `Routinen heute${sp !== 'alle' ? ` · ${SPACE_LABEL[sp]}` : ''}`}</Ueberschrift>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      <Liste>
        {liste.slice(0, 10).map(({ routine: r, f, heuteErledigt, ziel, ist }) => {
          const st = routineStatistik(r, erledigtTage(s.log, r.id), heute);
          return (
            <Zeile key={r.id} onClick={ziel <= 1 ? () => void schritt(r.id, ziel, ist, { erledigt: !heuteErledigt }) : undefined}
              links={ziel <= 1 ? <Haken an={heuteErledigt} farbe={SPACE_FARBE[spaceVonRoutine(r)]} onChange={() => void schritt(r.id, ziel, ist, { erledigt: !heuteErledigt })} /> : undefined}
              titel={<span style={{ color: heuteErledigt ? C.inkLeise : C.ink, textDecoration: heuteErledigt && ziel <= 1 ? 'line-through' : 'none' }}>{r.label}</span>}
              unter={[
                sp === 'alle' ? SPACE_LABEL[spaceVonRoutine(r)] : '',
                spaceVonRoutine(r) === 'business' ? r.einheit ?? '' : '',
                istGemeinsam(r) ? 'gemeinsam' : '',
                routineRhythmusKurz(r),
                f.ueberfaellig ? `seit ${f.naechstes.slice(8)}.${f.naechstes.slice(5, 7)}.` : '',
                f.proWoche ? `${f.dieseWoche ?? 0}/${f.proWoche} diese Woche` : '',
                streakText(st.streak, st.einheit),
              ].filter(Boolean).join(' · ') || undefined}
              rechts={ziel > 1
                ? <RoutineSteuer label={r.label} ziel={ziel} ist={ist} erledigt={heuteErledigt} farbe={SPACE_FARBE[spaceVonRoutine(r)]} onHaken={() => void schritt(r.id, ziel, ist, { erledigt: !heuteErledigt })} onZaehlen={z => void schritt(r.id, ziel, ist, { zaehler: z })} />
                : f.ueberfaellig && !heuteErledigt ? <Chip farbe={LEUCHT.achtung}>überfällig</Chip> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>{r.uhrzeiten?.[0] ?? `${r.dauerMin} min`}</span>} />
          );
        })}
      </Liste>
      {liste.length > 10 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>+ {liste.length - 10} weitere in der Tagesplanung</div>}
    </Karte>
  );
}

// ── Essen heute (Ernährung) ─────────────────────────────────────────────────
function EssenWidget({ titel, i }: WidgetProps) {
  const d = useDaten<ErnaehrungFile>('/api/state/ernaehrung', x => ((x as { plan?: unknown }).plan ? (x as ErnaehrungFile) : null));
  if (d === null) return null;
  const tag = TAGE[(new Date().getDay() + 6) % 7];
  const offen = d?.einkauf.filter(p => !p.erledigt).length ?? 0;
  const gericht = (k: string) => { const id = d?.planGerichte[tag]?.[k as 'fruehstueck']; return id ? d?.gerichte.find(g => g.id === id) : undefined; };
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href={WEG.ernaehrung()} style={link}>{offen ? `${offen} auf der Liste ›` : 'Ernährung ›'}</Link>}>{titel ?? 'Essen heute'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && (
        <Liste>
          {MAHLZEITEN.map(m => {
            const text = d.plan[tag][m.k], g = gericht(m.k);
            return <Zeile key={m.k} onClick={g ? () => { window.location.href = WEG.gericht(g.id); } : undefined}
              links={g?.bild
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/ernaehrung/bild?name=${encodeURIComponent(g.bild)}`} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
                : <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, width: 52 }}>{m.label}</span>}
              titel={text ? <span>{g?.bild ? <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{m.label} · </span> : ''}{text}</span> : <span style={{ color: C.inkLeise }}>noch nichts geplant</span>}
              unter={g ? [g.dauerMin ? `${g.dauerMin} Min` : '', 'Rezept ›'].filter(Boolean).join(' · ') : undefined} />;
          })}
        </Liste>
      )}
    </Karte>
  );
}

// ── Index je Säule ──────────────────────────────────────────────────────────
// 14.10. (Abnahme B1): der Status steht nur noch aus `indexStatus` (lib/kennzahlen/kern.ts) da — derselbe Satz wie im Cockpit und auf den Fachseiten.
type IndexKurz = Pick<IndexErgebnis, 'index' | 'label' | 'abdeckung' | 'luecken'> & Partial<Pick<IndexErgebnis, 'teil' | 'vorlaeufig'>> & { saeulen: { id: string; label: string; score: number | null; zuDuenn?: boolean }[] };
const indexKurz = (r: Partial<IndexKurz> | null | undefined): IndexKurz | null => (r && Array.isArray(r.saeulen) ? {
  index: r.index ?? null, label: r.label ?? '', abdeckung: typeof r.abdeckung === 'number' ? r.abdeckung : 0, luecken: typeof r.luecken === 'number' ? r.luecken : 0,
  ...(r.teil ? { teil: r.teil } : {}), ...(r.vorlaeufig ? { vorlaeufig: r.vorlaeufig } : {}), saeulen: r.saeulen,
} : null);
const INDEX_QUELLEN: Record<string, { url: string; label: string; farbe: string; ziel: string; lies: (d: unknown) => IndexKurz | null; hinweis?: string }> = {
  business: { url: '/api/business?scope=gesamt&kompakt=1', label: 'Business-Index', farbe: LEUCHT.business, ziel: WEG.score('business'), lies: d => indexKurz((d as { bi?: Partial<IndexKurz> }).bi) },
  privat: { url: '/api/privat?kompakt=1', label: 'Privat-Index', farbe: LEUCHT.geld, ziel: WEG.privatIndex(), lies: d => { const r = d as { ok?: boolean } & Partial<IndexKurz>; return r?.ok ? indexKurz({ ...r, saeulen: r.saeulen ?? [] }) : null; } },
  gesundheit: { url: '/api/gesundheit/index?kompakt=1', label: 'Gesundheits-Index', farbe: LEUCHT.gut, ziel: WEG.gesundheit('index'), lies: d => { const r = d as { ok?: boolean } & Partial<IndexKurz>; return r?.ok ? indexKurz({ ...r, saeulen: r.saeulen ?? [] }) : null; } },
  // B2 (14.10.): der Traktions-Score ist EINE Kennzahl der Business-Säule „Markt & Kunden“ — der Satz darunter sagt, warum die Säule eine andere Zahl trägt.
  traktion: { url: '/api/crm/traktion', label: 'Traktions-Score', farbe: LEUCHT.business, ziel: markttraktion(), lies: d => indexKurz((d as { index?: Partial<IndexKurz> }).index), hinweis: TRAKTION_IM_BUSINESS_INDEX },
};
function IndexWidget({ e, titel, i, seite }: WidgetProps) {
  const saeule = str(e.saeule, 'business');
  const q = INDEX_QUELLEN[saeule] ?? INDEX_QUELLEN.business;
  // Auf Heute › Business steht der Business-Score schon oben (Kevin 21.10.: nur zwei Scores) — eine gespeicherte Karte
  // „Business-Index“ wäre dieselbe Zahl doppelt. Fläche `uebersicht-business` = HEUTE_FLAECHE.business (HeuteView.tsx).
  const doppelt = seite === 'uebersicht-business' && saeule === 'business';
  const d = useDaten(q.url, q.lies);
  if (doppelt || d === null) return null;
  const farbe = d?.index == null ? C.inkLeise : zoneFarbe(d.index);
  const status = d ? indexStatus(d) : null;
  return (
    <Karte i={i} akzent={d?.index != null ? farbe : undefined}>
      <Ueberschrift farbe={q.farbe} rechts={<Link href={q.ziel} style={link}>öffnen ›</Link>}>{titel ?? q.label}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring groesse="klein" label="Index" wert={d?.index != null ? String(Math.round(d.index)) : undefined} farbe={farbe} anteil={d?.index != null ? d.index / 100 : undefined} />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
          {/* Ein Status für alle Orte (indexStatus): Label bzw. „Vorläufig“/„Noch keine Daten“ — und ein Satz, wie viel gemessen ist. */}
          <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{status ? status.titel : 'lade …'}</div>
          {/* C18 (15.10.): „Fokus & Zeit“ ist persönlich — darum weicht „gemessen“ je Person ab; die Erklärung sagt es (index.abdeckung). */}
          {status && <Erklaert erklaerung="index.abdeckung" name="Abdeckung"><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 }}>{status.satz}</div></Erklaert>}
          {(d?.saeulen ?? []).slice(0, 4).map(s => {
            // Nie eine Null (C18, 15.10.): eine Säule ohne Wert oder mit zu wenig Messung (unter 40 %) steht als Leerzustand mit Weg — „messen ›“
            // führt zum Index, wo jede Kachel sagt, was fehlt. Vorher stand „Personal 0“ (eine einzige gemessene Kennzahl bei 0).
            const offen = s.score == null || !!s.zuDuenn;
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                {offen
                  ? <Link href={q.ziel} style={{ ...link, fontSize: TYP.bedien }} title="Noch zu wenig gemessen — im Index steht je Kennzahl, was fehlt">messen ›</Link>
                  : <span style={{ fontVariantNumeric: 'tabular-nums', color: zoneFarbe(s.score!) }}>{Math.round(s.score!)}</span>}
                {!offen && <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={s.score! / 100} farbe={zoneFarbe(s.score!)} /></div>}
              </div>
            );
          })}
          {(d?.saeulen.length ?? 0) > 4 && <Link href={q.ziel} style={{ ...link, fontSize: TYP.bedien }}>+ {(d?.saeulen.length ?? 0) - 4} weitere Säulen ›</Link>}
          {q.hinweis && d && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>{q.hinweis}</div>}
        </div>
      </div>
    </Karte>
  );
}

// ── Finanzen privat ─────────────────────────────────────────────────────────
function FinanzenPrivatWidget({ titel, i }: WidgetProps) {
  const router = useRouter();
  const d = useDaten<string[]>('/api/haushalt?nur=signale', x => { const r = x as { ok?: boolean; leer?: boolean; punkte?: string[] }; return r?.ok && !r.leer ? r.punkte ?? [] : null; });
  if (d === null) return null;
  const rot = (t: string) => /Überfällig|kein Kontoauszug/.test(t);
  return (
    <Karte i={i} akzent={d?.some(rot) ? LEUCHT.kritisch : undefined}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={<Link href={WEG.zahlen('privat')} style={link}>Privat ›</Link>}>{titel ?? 'Finanzen · privat'}</Ueberschrift>
      <Liste>
        {d === undefined && <Leer>lade …</Leer>}
        {d && !d.length && <Leer>Nichts fällig. Alles bezahlt.</Leer>}
        {(d ?? []).slice(0, 4).map(t => <Zeile key={t} onClick={() => router.push(/Rechnung|Rate/.test(t) ? WEG.privat('schulden') : /Kontoauszug/.test(t) ? WEG.privat('buchungen') : WEG.privatIndex())} links={<Punkt farbe={rot(t) ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={<span style={{ whiteSpace: 'normal' }}>{t}</span>} />)}
      </Liste>
    </Karte>
  );
}

// ── ZOE: offene Freigaben (+ Inbox) ──────────────────────────────────────────────────────────────────────────────
// Seit 10.10. (Kevin 08.10.: „offene Freigaben von ZOE“): die Zahl UND die ersten drei Vorschläge mit dem, was die Freigabe bewirken würde, dazu der
// Weg in die Freigaben. Quelle ist der Stapel selbst (GET /api/zoe/stapel?space=) — er liefert der Person nur ihre eigenen Vorschläge und die des
// Systems, auf Heute nur die des Bereichs der Fläche (und die „unklaren“); nichts anderes steht hier.
// B10 (14.10.): jede Zeile zeigt Titel · Was · Wofür und den Bezug — aus EINER Stelle (`vorschlagAnzeige`), nie nur „Einzelheiten in der Inbox“.
interface FreigabeKurz { id: string; anzeige: VorschlagAnzeige }
function ZoeWidget({ e, titel, i, seite }: WidgetProps) {
  const router = useRouter();
  // Je Sicht der Fläche (09.10. spät): Heute › Privat zählt nur Vorschläge aus Privat, › Business nur aus Business — der Server filtert.
  const sicht = spaceAusFlaeche(seite);
  const stapel = useDaten<{ n: number; erste: FreigabeKurz[] }>(`/api/zoe/stapel${sicht === 'alle' ? '' : `?space=${sicht}`}`, x => {
    const d = x as { offen?: number | unknown[]; vorschlaege?: (VorschlagFuerAnzeige & { id: string; status?: string })[] };
    const offen = (d.vorschlaege ?? []).filter(v => !v.status || v.status === 'offen');
    const n = typeof d.offen === 'number' ? d.offen : Array.isArray(d.offen) ? d.offen.length : offen.length;
    return { n, erste: offen.slice(0, 3).map(v => ({ id: v.id, anzeige: vorschlagAnzeige(v) })) };
  });
  const mitInbox = e.inbox === true;
  // Inbox 2 (06.10.): offen = Gespräche in Arbeit ohne Rundschreiben (EIN Strom, nur die eigenen Postfächer, /api/inbox).
  // Inbox nur des Bereichs (10.10.): `?space=` — der Server filtert die Postfächer (lib/inbox/strom-server.ts `imBereich`).
  const inbox = useDaten<number>(mitInbox ? `/api/inbox${sicht === 'alle' ? '' : `?space=${sicht}`}` : '/api/zoe/stapel', x => (mitInbox ? ((x as { gespraeche?: { inArbeit?: boolean; fach?: string }[] }).gespraeche ?? []).filter(g => g.inArbeit && g.fach !== 'info' && g.fach !== 'warten').length : null));
  const n = stapel?.n ?? null;
  const freigaben = sicht === 'privat' || sicht === 'business' ? WEG.freigaben(undefined, sicht) : WEG.freigaben();
  return (
    <Karte i={i} akzent={n ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={n ? LEUCHT.achtung : C.inkLeise} erklaerung="heute.freigaben" rechts={<Link href={freigaben} style={link}>Freigaben ›</Link>}>{titel ?? (mitInbox ? 'Freigaben von ZOE & Inbox' : 'Freigaben von ZOE')}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href={freigaben} style={{ textDecoration: 'none', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(34px,4vw,44px)', letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: n ? LEUCHT.achtung : C.inkLeise, textShadow: n ? `0 0 24px ${LEUCHT.achtung}33` : undefined }}>{n == null ? '—' : n}</Link>
        <div style={{ fontSize: TYP.body, fontWeight: 600, lineHeight: 1.35 }}>
          {n == null ? 'ZOE' : n === 0 ? 'Nichts vorbereitet — alles erledigt.' : `Vorschl${n === 1 ? 'ag wartet' : 'äge warten'} auf dich`}
          {mitInbox && <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 500, marginTop: 4 }}><Link href={sicht === 'alle' ? '/os/inbox' : `/os/inbox?space=${sicht}`} style={{ color: C.inkDim }}>{inbox ? `${inbox} in der Inbox offen ›` : 'Inbox ›'}</Link></div>}
        </div>
      </div>
      {stapel && stapel.erste.length > 0 && (
        <Liste>
          {stapel.erste.map(({ id, anzeige: a }) => <Zeile key={id} onClick={() => { router.push(freigaben); }} links={<Punkt farbe={LEUCHT.achtung} />} titel={a.beispiel ? <>{a.titel} <BeispielMarke /></> : a.titel} unter={`${a.was} · ${a.wofuer}`}
            rechts={a.link ? <Link href={a.link.href} onClick={ev => ev.stopPropagation()} style={{ ...link, whiteSpace: 'nowrap' }}>{a.link.text} ›</Link> : undefined} />)}
          {stapel.n > stapel.erste.length && <Zeile onClick={() => { router.push(freigaben); }} titel={<span style={{ color: C.inkDim }}>+ {stapel.n - stapel.erste.length} weitere</span>} />}
        </Liste>
      )}
    </Karte>
  );
}

// ── Familie & Partnerschaft ─────────────────────────────────────────────────
interface FamilieStand { gespraech?: { datum: string }; tage?: { id: string; titel: string; wer: string; am: string; inTagen: number; erledigt: boolean }[]; frage?: string | { text?: string }; kontakte?: { id: string; name: string; faellig: boolean; seit: number | null }[]; heute?: string }
function FamilieWidget({ titel, i }: WidgetProps) {
  const d = useDaten<FamilieStand>('/api/familie', x => ((x as { ok?: boolean }).ok ? (x as FamilieStand) : null));
  if (d === null) return null;
  const tage = (d?.tage ?? []).filter(t => !t.erledigt).slice(0, 2);
  const faellig = (d?.kontakte ?? []).filter(k => k.faellig).slice(0, 2);
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Link href="/os/familie" style={link}>Familie ›</Link>}>{titel ?? 'Familie & Partnerschaft'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && (
        <Liste>
          {d.gespraech && <Zeile links={<Punkt farbe={LEUCHT.beziehung} />} titel="Paar-Gespräch" unter={d.gespraech.datum === d.heute ? 'heute' : `am ${tagKurz(d.gespraech.datum)}`} />}
          {tage.map(t => <Zeile key={t.id} links={<Punkt farbe={t.inTagen <= 7 ? LEUCHT.achtung : C.inkLeise} />} titel={`${t.titel} · ${t.wer}`} unter={t.inTagen === 0 ? 'heute!' : t.inTagen === 1 ? 'morgen' : `in ${t.inTagen} Tagen`} />)}
          {faellig.map(k => <Zeile key={k.id} links={<Punkt farbe={LEUCHT.achtung} />} titel={`${k.name} anrufen`} unter={k.seit == null ? 'noch nie' : `zuletzt vor ${k.seit} Tagen`} />)}
          {(() => { const frage = typeof d.frage === 'string' ? d.frage : d.frage?.text; return frage ? <Zeile links={<span style={{ color: LEUCHT.beziehung }}>?</span>} titel={<span style={{ whiteSpace: 'normal', fontWeight: 500 }}>{frage}</span>} unter="Frage der Woche" /> : null; })()}
        </Liste>
      )}
    </Karte>
  );
}

// ── Wachstums-Score: entfallen (21.10.) ─────────────────────────────────────
// Kevin 21.10.: nur noch zwei Scores — Privat-Score und Business-Score stehen oben auf Heute (components/os/scores/BereichScores.tsx). Das Widget
// `score` gibt es nicht mehr; ein gespeicherter Platz mit dieser Art zeigt nichts (Flaeche.tsx überspringt unbekannte Arten), nichts wird gelöscht.

// ── Register + Katalog ──────────────────────────────────────────────────────
const TAGE_WAHL: EinstellungDef = { k: 'tage', label: 'Zeitraum', art: 'wahl', optionen: [{ w: 1, label: 'heute' }, { w: 3, label: '3 Tage' }, { w: 7, label: '7 Tage' }, { w: 14, label: '14 Tage' }], standard: 1 };
// ── Zeit & Fokus (26.09. spät) ──────────────────────────────────────────────
// Wo die Zeit hingeht: heute, die letzten 7 Tage und der bewusste Anteil je Modus,
// darunter die Bereiche nach Zeit. Quelle: Anwesenheit + Fokus-Zähler (/api/state/zeit).
// 27.09. spät: Einstellung „nach Einheit“ — bewusste Business-Zeit dieser Woche je Selbstständigkeit · KD Ventures ·
// MAKE Innovation GmbH · eigene · ohne Einheit (gleiche Rechnung wie die Karte auf der Seite Fokus).
// 09.10. (Kevin: „Die Zeit wird jedes Mal im Hintergrund gemessen, und dann sehen wir das Ganze.“): Modus „Privat und Business“
// (`space: 'beide'`) — beide Bereiche nebeneinander, heute und 7 Tage, dazu der Anteil als Balken. Steht auf Heute in beiden Sichten.
function ZeitWidget(p: WidgetProps) {
  if (str(p.e.nach, 'bereich') === 'einheit') return <ZeitEinheitWidget {...p} />;
  return str(p.e.space, 'privat') === 'beide' ? <ZeitBeideWidget {...p} /> : <ZeitBereichWidget {...p} />;
}
function ZeitBeideWidget({ titel, i, seite }: WidgetProps) {
  // Sicht Privat · Business (10.10.): auf einer Fläche mit Bereich nur Summen beider Bereiche — Bereiche und Blöcke des anderen liefert der
  // Server nicht mit (`?space=`, lib/zeitmessung/modell.ts `bildFuerSicht`). Die Karte zeigt ohnehin nur die Summen (Kevin 09.10.).
  const fs = spaceAusFlaeche(seite);
  // Sicht Business (15.10., Abnahme 2 C13 — „Business zeigt nur Business“): nur die Business-Zeit, ohne die Privat-Summe (der Server liefert sie
  // ohne `summen=beide` gar nicht). Die Sicht Privat und die gemeinsame Fläche zeigen weiter beide Summen (Entscheidung 09.10.).
  const d = useDaten<ZeitBild>(`/api/state/zeit${fs === 'alle' ? '' : fs === 'business' ? '?sicht=business' : `?sicht=${fs}&summen=beide`}`, x => ((x as { bild?: ZeitBild }).bild ?? null));
  // Konto „nur Business“ (B17, 14.10.): der Server liefert keine Privat-Zeit — die Karte heißt dann nur „Zeit“, ohne Privat-Spalte und
  // ohne den Hinweis auf einen Privat-Schalter, den es für dieses Konto nicht gibt.
  const nurBusiness = useNurBusiness() === true || fs === 'business';
  if (d === null) return null;
  const heute = d ? privatGegenBusiness(d.tagHeute) : null;
  const sieben = d ? privatGegenBusiness(d.sieben) : null;
  const anteil = sieben?.anteilBusiness ?? null;
  const spalte = (space: 'privat' | 'business') => {
    const h = heute?.[space] ?? 0, w = sieben?.[space] ?? 0;
    const bewusst = space === 'privat' ? sieben?.bewusstPrivat ?? 0 : sieben?.bewusstBusiness ?? 0;
    return (
      <div key={space} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: SPACE_FARBE[space], textTransform: 'uppercase', letterSpacing: '.06em' }}>{SPACE_LABEL[space]}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 18, color: h ? C.ink : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{zeitText(h)}<span style={{ fontFamily: SCHRIFT.text, fontWeight: 500, fontSize: TYP.bedien, color: C.inkLeise }}> heute</span></span>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{zeitText(w)} in 7 Tagen{bewusst ? ` · ${zeitText(bewusst)} bewusst` : ''}</span>
      </div>
    );
  };
  return (
    <Karte i={i} akzent={anteil !== null ? C.aktiv : undefined}>
      <Ueberschrift rechts={<Link href={WEG.fokus('zeit')} style={link}>Zeit ›</Link>}>{titel ?? (nurBusiness ? 'Zeit' : 'Zeit · Privat und Business')}</Ueberschrift>
      {d === undefined ? <div style={{ fontSize: TYP.body, color: C.inkLeise }}>lade …</div> : nurBusiness ? (
        (sieben?.business ?? 0) > 0 || (heute?.business ?? 0) > 0
          ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>{spalte('business')}</div>
          : <Leer>Noch nichts gemessen — die Zeit läuft im Hintergrund mit, sobald du in MAKE OS arbeitest.</Leer>
      ) : anteil === null ? (
        <Leer>Noch nichts gemessen — die Zeit läuft im Hintergrund mit, sobald du in MAKE OS arbeitest: oben Privat oder Business wählen.</Leer>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>{spalte('privat')}{spalte('business')}</div>
          {/* Anteil der letzten 7 Tage: links Privat, rechts Business — Farbe der Bereiche, Text daneben (nie nur Farbe). */}
          <div role="img" aria-label={`7 Tage: ${Math.round((1 - anteil) * 100)} % Privat, ${Math.round(anteil * 100)} % Business`} style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
            <span style={{ flex: `${1 - anteil} 1 0`, background: SPACE_FARBE.privat }} />
            <span style={{ flex: `${anteil} 1 0`, background: SPACE_FARBE.business }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
            <span>{Math.round((1 - anteil) * 100)} % Privat</span>
            <span>{Math.round(anteil * 100)} % Business</span>
          </div>
          {sieben && sieben.ohne > 0 && <div style={{ marginTop: 6, fontSize: TYP.bedien, color: C.inkLeise }}>dazu {zeitText(sieben.ohne)} ohne Bereich (ältere Messung)</div>}
        </>
      )}
    </Karte>
  );
}
function ZeitEinheitWidget({ e, titel, i }: WidgetProps) {
  const zeitraum: Zeitraum = str(e.zeitraum, 'woche') === 'monat' ? 'monat' : 'woche';
  // Business-Widget (10.10.): nur die Business-Einheiten — die Selbstständigkeit gehört zu Privat (Server, `space=business`).
  const d = useDaten<ZeitJeEinheitAntwort>(zeitEinheitenAdresse(zeitraum, undefined, 'business'), x => ((x as ZeitJeEinheitAntwort)?.ok ? (x as ZeitJeEinheitAntwort) : null));
  if (d === null) return null;
  const eigene = d?.personen.find(p => p.person === d.ich)?.auswertung;
  const a = str(e.wer, 'ich') === 'gesamt' ? d?.gesamt : eigene ?? d?.gesamt;
  const farbe = SPACE_FARBE.business;
  return (
    <Karte i={i} akzent={a?.sek ? farbe : undefined}>
      <Ueberschrift farbe={farbe} rechts={<Link href={WEG.fokus('zeit')} style={link}>Zeit ›</Link>}>{titel ?? `Zeit je Einheit · ${d?.label ?? (zeitraum === 'monat' ? 'Monat' : 'Woche')}`}</Ueberschrift>
      {!a ? <div style={{ fontSize: TYP.body, color: C.inkLeise }}>lade …</div> : <EinheitBalken a={a} kompakt />}
    </Karte>
  );
}
function ZeitBereichWidget({ e, titel, i, seite }: WidgetProps) {
  // Auf einer Fläche mit Bereich deren Bereich (10.10.); sonst die Einstellung (Vorgabe Privat). Der Server liefert nur diesen Bereich.
  const ws = widgetSpace(seite, e);
  const space = (ws === 'business' || (ws === 'alle' && str(e.space, 'privat') === 'business') ? 'business' : 'privat') as 'privat' | 'business';
  const d = useDaten<ZeitBild>(`/api/state/zeit?sicht=${space}`, x => ((x as { bild?: ZeitBild }).bild ?? null));
  if (d === null) return null;
  const farbe = SPACE_FARBE[space];
  const heute = d?.tagHeute.gesamt[space] ?? 0, sieben = d?.sieben.gesamt[space] ?? 0, bewusst = d?.sieben.bewusst[space] ?? 0;
  const bereiche = d ? bereicheNachZeit(d.sieben, space, 5) : [];
  const max = bereiche[0]?.sek || 1;
  const zahl = (label: string, sek: number, unter?: string) => (
    <div key={label} style={{ display: 'grid', gap: 2 }}>
      <span style={{ fontSize: 11, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 18, color: sek ? C.ink : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{zeitText(sek)}</span>
      {unter && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{unter}</span>}
    </div>
  );
  return (
    <Karte i={i} akzent={sieben ? farbe : undefined}>
      <Ueberschrift farbe={farbe} rechts={<Link href={WEG.heute(space)} style={link}>{SPACE_LABEL[space]} ›</Link>}>{titel ?? `Zeit & Fokus · ${SPACE_LABEL[space]}`}</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
        {zahl('Heute', heute)}
        {zahl('7 Tage', sieben)}
        {zahl('Bewusst', bewusst, sieben ? `${Math.round((bewusst / sieben) * 100)} % Fokus` : undefined)}
      </div>
      {d === undefined ? <div style={{ fontSize: TYP.body, color: C.inkLeise }}>lade …</div>
        : bereiche.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {bereiche.map(b => (
              <div key={b.bereich} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bereichLabel(b.bereich)}{b.bewusst ? <span style={{ color: C.inkLeise }}> · {zeitText(b.bewusst)} bewusst</span> : null}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink }}>{zeitText(b.sek)}</span>
                <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={b.sek / max} farbe={farbe} /></div>
              </div>
            ))}
          </div>
        ) : <Leer>Noch nichts gemessen — im {SPACE_LABEL[space]}-Modus arbeiten oder oben „Fokus“ starten.</Leer>}
    </Karte>
  );
}

// ── Kanal-Leistung (Markttraktion, 27.09.) ──────────────────────────────────
// Welcher Herkunftskanal warme Leads und SQLs bringt — dieselbe Rechnung wie
// unter Sales › Auswertung (lib/crm/score.ts kanalLeistung), aus /api/crm/lead.
function KanalWidget({ titel, i }: WidgetProps) {
  const d = useDaten<KanalZeile[]>('/api/crm/lead', x => { const r = x as { ok?: boolean; leads?: LeadZeile[] }; if (!r?.ok || !r.leads?.length) return null; const z = kanalLeistung(r.leads); return z.length ? z : null; });
  if (d === null) return null;
  const zeilen = (d ?? []).slice(0, 5);
  const max = Math.max(1, ...zeilen.map(z => z.anzahl));
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.business} rechts={<Link href={markttraktion('deals', 'auswertung')} style={link}>Auswertung ›</Link>}>{titel ?? 'Kanal-Leistung'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {zeilen.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 120px) 1fr auto', gap: '6px 10px', alignItems: 'center', fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>
          {zeilen.map(z => (
            <div key={z.kanal} style={{ display: 'contents' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.label}</span>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(100 * z.warm) / max}%`, background: LEUCHT.business }} />
                <div style={{ width: `${(100 * (z.anzahl - z.warm)) / max}%`, background: 'rgba(255,255,255,.14)' }} />
              </div>
              <span style={{ color: C.inkDim, whiteSpace: 'nowrap' }}>{z.anzahl} · <span style={{ color: z.warm ? C.ink : C.inkLeise }}>{z.warm} warm+</span> · <span style={{ color: z.sql ? LEUCHT.gut : C.inkLeise }}>{z.sql} SQL</span></span>
            </div>
          ))}
        </div>
      )}
      {d && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Leads je Kanal, davon warm oder heiß, davon SQL oder Kunde.</div>}
    </Karte>
  );
}

// ── Nächstes Event · Make.One (27.09.) ──────────────────────────────────────
// Das nächste Event unter unserer Veranstaltungsmarke (lib/crm/marke.ts) mit
// Zusagen und offenem Nachfassen — aus /api/crm/bestand (einmal je Anzeige,
// gzip + ETag serverseitig), ohne zweite Rechnung: die Zahlen je Event kommen
// vom Server (eventZahlen).
interface EventBild { heute: string; e: CrmEvent | null; z?: EventZahlen; nachfassenOffen: number }
function EventWidget({ titel, i }: WidgetProps) {
  const router = useRouter();
  const d = useDaten<EventBild>('/api/crm/bestand', x => {
    const r = x as { ok?: boolean; heute?: string; stand?: { events?: CrmEvent[] }; events?: Record<string, EventZahlen> };
    if (!r?.ok || !r.stand?.events?.length) return null;
    const heute = r.heute ?? localDay();
    // Nur unsere eigenen Abende (Make.One) — besuchte Events (Netzwerken) stehen im Reiter „Events“ (03.10.).
    const eigene = r.stand.events.filter(x => !istNetzwerkenEvent(x));
    const kommend = eigene.filter(e => e.datum >= heute && e.status !== 'abgesagt').sort((a, b) => a.datum.localeCompare(b.datum));
    const nachfassenOffen = eigene.filter(e => e.datum <= heute).reduce((a, e) => a + (r.events?.[e.id]?.nachfassenOffen ?? 0), 0);
    const e = kommend[0] ?? null;
    return e || nachfassenOffen ? { heute, e, z: e ? r.events?.[e.id] : undefined, nachfassenOffen } : null;
  });
  if (d === null) return null;
  const e = d?.e ?? null;
  const tage = e ? Math.round((Date.parse(`${e.datum}T12:00:00Z`) - Date.parse(`${d!.heute}T12:00:00Z`)) / 864e5) : null;
  return (
    <Karte i={i} akzent={e ? LEUCHT.beziehung : undefined}>
      <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Link href={WEG.event()} style={link}>{MARKE_EVENTS} ›</Link>}>{titel ?? `Nächstes Event · ${MARKE_EVENTS}`}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {e && (
        <Zeile onClick={() => router.push(WEG.event(e.id))}
          links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 18, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: tage !== null && tage <= 7 ? LEUCHT.achtung : LEUCHT.beziehung, width: 52 }}>{tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `${tage} T`}</span>}
          titel={titelMitReihe(e)}
          unter={[markeVon(e), tagKurz(e.datum), e.uhrzeit ? `${e.uhrzeit} Uhr` : '', e.ort, d?.z ? (d.z.zugesagt ? `${d.z.zugesagt} zugesagt` : d.z.eingeladen ? `${d.z.eingeladen} eingeladen` : '') : ''].filter(Boolean).join(' · ')} />
      )}
      {d && !e && <Leer>Kein Event geplant — sechs Wochen Vorlauf, Ziel zuerst.</Leer>}
      {d && d.nachfassenOffen > 0 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 6 }}><Link href={WEG.event()} style={{ color: LEUCHT.achtung }}>{d.nachfassenOffen} {d.nachfassenOffen === 1 ? 'Gast' : 'Gäste'} nachfassen — binnen 48 Stunden ›</Link></div>}
    </Karte>
  );
}

// ── Einrichtung · x von y (08.10. spät, Onboarding B5) ─────────────────────
// Vorne auf Heute, solange die eigene Einrichtung offen ist: die eigenen Schritte („Meine Einrichtung“), die gemeinsamen und — beim
// Inhaber — die der Instanz (lib/make-one/onboarding-data.ts `schritteFuer`, im Neustart in dessen Fassung). Seit 09.10. (Kevin: „Dieser
// Onboarding-Reiter ist auch immer auf dem Heute-Bildschirm zu sehen, bis wir alles abgeschlossen haben“): gezählt wird JEDER nicht-optionale
// Schritt (`alle`) — die Karte verschwindet erst, wenn alles steht. „Als Nächstes“ = erster offener Kern-Schritt, danach der Rest.
// Daten aus /api/onboarding (persönliche Befunde nur der Person der Sitzung). Fertig oder ohne Zugang → keine Karte.
// B10 (Update 2, „dauerhafte Ampel“): fällt ein Schritt zurück, der schon einmal grün war (`zurueckgefallen` — dieselbe Regel wie die
// Einrichtung), steht hier „1 Punkt braucht dich“ — auch wenn die Einrichtung sonst fertig ist. Keine zweite Glocke.
interface EinrichtungBild { z: HakenZustand; ich: OnboardingKontext }
function EinrichtungWidget({ titel, i, seite }: WidgetProps) {
  const d = useDaten<EinrichtungBild>('/api/onboarding', x => {
    const r = x as { erledigt?: HakenZustand['erledigt']; befunde?: HakenZustand['befunde']; gruen?: HakenZustand['gruen']; ich?: OnboardingKontext | null };
    return r?.ich ? { z: { erledigt: r.erledigt ?? {}, befunde: r.befunde ?? {}, gruen: r.gruen ?? {} }, ich: r.ich } : null;
  });
  if (!d) return null;
  // Sicht Privat · Business (10.10.): auf Heute › Business keine Schritte des Privat-Bereichs (Gesundheit, Familie, Privat-Finanzen), auf
  // Heute › Privat keine aus Markttraktion/Unternehmen (`schrittInSicht`, lib/make-one/onboarding-data.ts).
  const fs = spaceAusFlaeche(seite);
  const meine = schritteFuer(d.ich).filter(s => schrittInSicht(s, fs === 'alle' ? null : fs));
  const zurueck = zurueckgefallen(meine, d.z);
  if (zurueck.length) {
    return (
      <Karte i={i} akzent={LEUCHT.kritisch}>
        <Ueberschrift farbe={LEUCHT.kritisch} rechts={<Link href="/os/onboarding" style={link}>Einrichtung ›</Link>}>{titel ?? (zurueck.length === 1 ? '1 Punkt braucht dich' : `${zurueck.length} Punkte brauchen dich`)}</Ueberschrift>
        <div style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}>
          {zurueck.slice(0, 3).map(s => (
            <Link key={s.id} href={s.wo?.href ?? '/os/onboarding'} style={{ color: C.ink, textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{s.nr} · {texteFuer(s, d.ich).titel} ›</span>
              {s.pruefung && d.z.befunde[s.pruefung] && <span style={{ color: LEUCHT.achtung }}>{d.z.befunde[s.pruefung].wert}</span>}
            </Link>
          ))}
          {zurueck.length > 3 && <Link href="/os/onboarding" style={link}>und {zurueck.length - 3} weitere ›</Link>}
        </div>
      </Karte>
    );
  }
  // „x von y“ (14.10., Abnahme B4): EINE Zählung je Person (`einrichtungStand`) — dieselbe Zahl auf Heute › Privat, Heute › Business, in der
  // Einrichtung und auf der Startfläche. Nur „Als Nächstes“ folgt der Sicht der Fläche (kein Privat-Schritt auf Heute › Business).
  const f = einrichtungStand(d.ich, d.z);
  if (!f.gesamt || f.fertig >= f.gesamt) return null;
  const naechster = fortschrittVon(meine, d.z, { alle: true, kernZuerst: !!d.ich.neustart }).naechster;
  return (
    <Karte i={i} akzent={LEUCHT.schlaf}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/onboarding" style={link}>alle Schritte ›</Link>}>{titel ?? `Einrichtung · ${f.fertig} von ${f.gesamt}`}</Ueberschrift>
      <Fortschritt anteil={f.fertig / f.gesamt} farbe={LEUCHT.schlaf} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>
        {naechster && <span style={{ flex: '1 1 220px', minWidth: 0 }}>Als Nächstes: <Link href="/os/onboarding" style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>{naechster.nr} · {texteFuer(naechster, d.ich).titel} ›</Link></span>}
        <span style={{ color: C.inkLeise }}>noch {restzeitText(f.offeneMinuten)}</span>
      </div>
    </Karte>
  );
}

// Steht an (08.10., Heute): Nachbereiten, Fristen, Follow-ups, Buchungsanfragen, ZOE-Kalender-Vorschläge, Geburtstage — dieselbe Quelle wie die Glocke; leer → keine Karte.
// 4.10 (08.10.): die Sicht der Fläche (Heute › Privat/Business) geht an den Server — Privat zeigt keine CRM-Follow-ups/Business-Fristen.
function AnstehendWidget({ i, seite }: WidgetProps) { return <Anstehend i={i} space={spaceAusFlaeche(seite)} />; }

// ── Top 3 des Tages und Tages-Briefing (10.10., Branch `heute-top3`) ────────────────────────────────────────────────
// Beide gehören zu EINEM Bereich: dem der Fläche (Heute › Privat bzw. Business); auf einer Fläche ohne Bereich dem aktiven Bereich im Kopf. Der Server
// liefert nie den anderen (app/api/heute/top3, app/api/heute/briefing).
function useKartenSicht(seite: string | undefined, e: Einstellungen): 'privat' | 'business' {
  const ws = widgetSpace(seite, e);
  const { space } = useSpace();
  return ws === 'alle' ? space : ws;
}
function Top3Widget({ e, titel, i, seite }: WidgetProps) { const sicht = useKartenSicht(seite, e); return <Top3Karte i={i} sicht={sicht} titel={titel} />; }
function BriefingWidget({ e, titel, i, seite }: WidgetProps) { const sicht = useKartenSicht(seite, e); return <BriefingKarte i={i} sicht={sicht} titel={titel} />; }

export const WIDGETS: Record<string, WidgetDef> = {
  einrichtung: { art: 'einrichtung', label: 'Einrichtung', bereich: 'Tag', beschreibung: 'Wie weit deine Einrichtung ist und was als Nächstes kommt — verschwindet, wenn alles steht', breite: 6, Komponente: EinrichtungWidget },
  briefing: { art: 'briefing', label: 'Tages-Briefing', bereich: 'Tag', beschreibung: 'Drei bis fünf Sätze zum Tag: was ansteht, was brennt, was auf deine Freigabe wartet, deine Top 3 und ein Hinweis zum Fokus', breite: 4, Komponente: BriefingWidget },
  top3: { art: 'top3', label: 'Top 3 des Tages', bereich: 'Tag', beschreibung: 'Die drei wichtigsten Aufgaben des Tages — ZOE schlägt vor, du übernimmst, tauschst oder legst selbst fest; mit Eisenhower-Zeichen', breite: 4, Komponente: Top3Widget },
  anstehend: { art: 'anstehend', label: 'Steht an', bereich: 'Tag', beschreibung: 'Nachbereiten, Fristen, Follow-ups, Buchungsanfragen und Geburtstage — dieselbe Quelle wie die Glocke', breite: 4, Komponente: AnstehendWidget },
  aufgaben: { art: 'aufgaben', label: 'Aufgaben', bereich: 'Tag', beschreibung: 'Fällige und kritische Aufgaben, Schnellanlage', breite: 4, Komponente: AufgabenWidget,
    einstellungen: [{ k: 'nur', label: 'Zeigt', art: 'wahl', optionen: [{ w: 'dran', label: 'fällig & kritisch' }, { w: 'alle', label: 'alle offenen' }], standard: 'dran' }, { k: 'space', label: 'Space', art: 'wahl', optionen: [{ w: 'alle', label: 'Privat und Business' }, { w: 'privat', label: 'nur Privat' }, { w: 'business', label: 'nur Business' }], standard: 'alle' }, { k: 'einheit', label: 'Einheit', art: 'wahl', optionen: [{ w: 'alle', label: 'alle' }, ...KERN_EINHEITEN_NAMEN.map(n => ({ w: n, label: `nur ${n}` })), { w: 'ohne', label: 'Business ohne Einheit' }], standard: 'alle' }, { k: 'anzahl', label: 'Anzahl', art: 'wahl', optionen: [{ w: 5, label: '5' }, { w: 8, label: '8' }, { w: 12, label: '12' }], standard: 8 }] },
  termine: { art: 'termine', label: 'Termine', bereich: 'Tag', beschreibung: 'Heute oder die nächsten Tage aus dem Kalender', breite: 4, Komponente: TermineWidget,
    einstellungen: [TAGE_WAHL, { k: 'space', label: 'Space', art: 'wahl', optionen: [{ w: 'alle', label: 'Privat und Business' }, { w: 'privat', label: 'nur Privat' }, { w: 'business', label: 'nur Business' }], standard: 'alle' }] },
  fokus: { art: 'fokus', label: 'Fokus', bereich: 'Tag', beschreibung: 'Worauf es heute, diese Woche oder diesen Monat ankommt', breite: 2, Komponente: FokusWidget,
    einstellungen: [{ k: 'horizont', label: 'Horizont', art: 'wahl', optionen: [{ w: 'auto', label: 'der nächste gesetzte' }, { w: 'tag', label: 'heute' }, { w: 'woche', label: 'Woche' }, { w: 'monat', label: 'Monat' }], standard: 'auto' }, { k: 'space', label: 'Bereich', art: 'wahl', optionen: [{ w: 'alle', label: 'der Fläche bzw. der aktive' }, { w: 'privat', label: 'Privat' }, { w: 'business', label: 'Business' }], standard: 'alle' }] },
  ziele: { art: 'ziele', label: 'Jahresziele · Fortschritt', bereich: 'Tag', beschreibung: 'Fortschritt der Ziele des Bereichs: gemeinsame, deine eigenen und was dein Gegenüber mit dir teilt — jedes Ziel führt in sein Detail', breite: 4, Komponente: ZieleWidget,
    einstellungen: [{ k: 'horizont', label: 'Horizont', art: 'wahl', optionen: [{ w: 'jahr', label: 'Jahr' }, { w: 'quartal', label: 'Quartal' }, { w: 'monat', label: 'Monat' }], standard: 'jahr' }] },
  koerper: { art: 'koerper', label: 'Körper', bereich: 'Gesundheit', beschreibung: 'Recovery und Routinen von heute', breite: 2, Komponente: KoerperWidget },
  // Erholung (10.10.): die EIGENE Erholung — Vorschlag, fällige Programme, Ziele, Fokus, Pausen (components/os/gesundheit/ErholungHeute.tsx).
  erholung: { art: 'erholung', label: 'Erholung heute', bereich: 'Gesundheit', beschreibung: 'Vorschlag aus deinen Körperwerten, heute fällige Programme, Erholungs-Ziele und die nächste Pause — nur deine', breite: 2, Komponente: ErholungWidget },
  routinen: { art: 'routinen', label: 'Routinen & Streak', bereich: 'Gesundheit', beschreibung: 'Welche Routinen heute schon stehen, dein Streak', breite: 2, Komponente: RoutinenWidget },
  'routinen-heute': { art: 'routinen-heute', label: 'Routinen heute', bereich: 'Tag', beschreibung: 'Was heute dran ist — eigene und gemeinsame Routinen nach Rhythmus, abhakbar', breite: 2, Komponente: RoutinenHeuteWidget,
    einstellungen: [{ k: 'space', label: 'Bereich', art: 'wahl', optionen: [{ w: 'alle', label: 'Privat und Business' }, { w: 'privat', label: 'nur Privat' }, { w: 'business', label: 'nur Business' }], standard: 'alle' }] },
  essen: { art: 'essen', label: 'Essen heute', bereich: 'Gesundheit', beschreibung: 'Die drei Mahlzeiten von heute mit Rezept und die offene Einkaufsliste', breite: 2, Komponente: EssenWidget },
  index: { art: 'index', label: 'Index je Säule', bereich: 'Finanzen', beschreibung: 'Business-, Privat-, Gesundheits-Index oder Traktions-Score mit Säulen', breite: 2, Komponente: IndexWidget,
    einstellungen: [{ k: 'saeule', label: 'Säule', art: 'wahl', optionen: [{ w: 'business', label: 'Business' }, { w: 'privat', label: 'Privat' }, { w: 'gesundheit', label: 'Gesundheit' }, { w: 'traktion', label: 'Traktion' }], standard: 'business' }] },
  'finanzen-privat': { art: 'finanzen-privat', label: 'Finanzen · privat', bereich: 'Finanzen', beschreibung: 'Fällige Raten, Rechnungen, fehlende Kontoauszüge', breite: 2, Komponente: FinanzenPrivatWidget },
  zoe: { art: 'zoe', label: 'Freigaben von ZOE & Inbox', bereich: 'ZOE', beschreibung: 'Offene Freigaben von ZOE — Zahl und die ersten drei —, dazu die offene Inbox', breite: 2, Komponente: ZoeWidget,
    einstellungen: [{ k: 'inbox', label: 'Inbox dazu', art: 'schalter', standard: false }] },
  dran: { art: 'dran', label: 'Wer heute dran ist', bereich: 'Business', beschreibung: 'Die wichtigsten Kontakte der Power Hour', breite: 4, Komponente: DranWidget },
  fulfillment: { art: 'fulfillment', label: 'Heute im Fulfillment', bereich: 'Business', beschreibung: 'Was in den Fällen jetzt dran ist — abhaken, Ja/Nein, Entwurf öffnen oder Fall starten direkt in der Zeile', breite: 4, Komponente: FulfillmentWidget },
  prozesse: { art: 'prozesse', label: 'Prozesse heute', bereich: 'Business', beschreibung: 'Wie viele Läufe heute gelaufen sind und wie viele auf dich warten — ein Klick führt zu Prozesse', breite: 2, Komponente: ProzesseWidget },
  kanal: { art: 'kanal', label: 'Kanal-Leistung', bereich: 'Business', beschreibung: 'Welcher Herkunftskanal warme Leads und SQLs bringt', breite: 2, Komponente: KanalWidget },
  event: { art: 'event', label: `Nächstes Event · ${MARKE_EVENTS}`, bereich: 'Business', beschreibung: 'Das nächste Event unter unserer Marke — Datum, Zusagen, offenes Nachfassen', breite: 2, Komponente: EventWidget },
  familie: { art: 'familie', label: 'Familie & Partnerschaft', bereich: 'Familie', beschreibung: 'Paar-Gespräch, wichtige Tage, wer einen Anruf verdient, Frage der Woche', breite: 2, Komponente: FamilieWidget },
  zeit: { art: 'zeit', label: 'Zeit & Fokus', bereich: 'Tag', beschreibung: 'Wo deine Zeit hingeht: heute, 7 Tage, bewusster Fokus und die Bereiche', breite: 2, Komponente: ZeitWidget,
    einstellungen: [
      { k: 'space', label: 'Modus', art: 'wahl', optionen: [{ w: 'privat', label: 'Privat' }, { w: 'business', label: 'Business' }, { w: 'beide', label: 'Privat und Business' }], standard: 'privat' },
      { k: 'nach', label: 'Aufteilung', art: 'wahl', optionen: [{ w: 'bereich', label: 'nach Bereich' }, { w: 'einheit', label: 'nach Einheit (Business)' }], standard: 'bereich' },
      { k: 'zeitraum', label: 'Zeitraum (nach Einheit)', art: 'wahl', optionen: [{ w: 'woche', label: 'diese Woche' }, { w: 'monat', label: 'dieser Monat' }], standard: 'woche' },
      { k: 'wer', label: 'Wessen Zeit (nach Einheit)', art: 'wahl', optionen: [{ w: 'ich', label: 'meine' }, { w: 'gesamt', label: 'Haushalt gesamt' }], standard: 'ich' },
    ] },
};
export const KATALOG: KatalogEintrag[] = [
  { art: 'einrichtung', label: 'Einrichtung', beschreibung: WIDGETS.einrichtung.beschreibung, bereich: 'Tag', breite: 6 },
  { art: 'briefing', label: 'Tages-Briefing', beschreibung: WIDGETS.briefing.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'top3', label: 'Top 3 des Tages', beschreibung: WIDGETS.top3.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'anstehend', label: 'Steht an', beschreibung: WIDGETS.anstehend.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'aufgaben', label: 'Aufgaben', beschreibung: WIDGETS.aufgaben.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'termine', label: 'Termine heute', beschreibung: 'Die Termine von heute', bereich: 'Tag', breite: 4 },
  { art: 'termine', label: 'Nächste 7 Tage', beschreibung: 'Was in der Woche ansteht — privat und Business', bereich: 'Tag', breite: 4, voreinstellung: { tage: 7 } },
  { art: 'fokus', label: 'Fokus', beschreibung: 'Der nächste gesetzte Fokus', bereich: 'Tag', breite: 2 },
  { art: 'fokus', label: 'Wochenfokus', beschreibung: 'Worauf es diese Woche ankommt', bereich: 'Tag', breite: 2, voreinstellung: { horizont: 'woche' } },
  { art: 'zeit', label: 'Zeit & Fokus · Privat', beschreibung: WIDGETS.zeit.beschreibung, bereich: 'Tag', breite: 2, voreinstellung: { space: 'privat' } },
  { art: 'zeit', label: 'Zeit & Fokus · Business', beschreibung: WIDGETS.zeit.beschreibung, bereich: 'Tag', breite: 2, voreinstellung: { space: 'business' } },
  { art: 'zeit', label: 'Zeit · Privat und Business', beschreibung: 'Wo die Zeit hingeht — Privat gegen Business, heute und 7 Tage, mit Anteil', bereich: 'Tag', breite: 2, voreinstellung: { space: 'beide' } },
  { art: 'zeit', label: 'Zeit je Einheit', beschreibung: `Bewusste Business-Zeit je ${BUSINESS_EINHEITEN_NAMEN.join(' · ')} · ohne Einheit`, bereich: 'Business', breite: 2, voreinstellung: { space: 'business', nach: 'einheit' } },
  { art: 'ziele', label: 'Jahresziele · Fortschritt', beschreibung: WIDGETS.ziele.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'koerper', label: 'Körper', beschreibung: WIDGETS.koerper.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'erholung', label: 'Erholung heute', beschreibung: WIDGETS.erholung.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'routinen', label: 'Routinen & Streak', beschreibung: WIDGETS.routinen.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'routinen-heute', label: 'Routinen heute · Privat', beschreibung: 'Heute fällige private Routinen — eigene und gemeinsame, abhakbar', bereich: 'Tag', breite: 2, voreinstellung: { space: 'privat' } },
  { art: 'routinen-heute', label: 'Routinen heute · Business', beschreibung: 'Heute fällige Business-Routinen — eigene und gemeinsame, abhakbar', bereich: 'Business', breite: 2, voreinstellung: { space: 'business' } },
  { art: 'essen', label: 'Essen heute', beschreibung: WIDGETS.essen.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'index', label: 'Business-Index', beschreibung: 'Der Index mit seinen Säulen', bereich: 'Finanzen', breite: 2, voreinstellung: { saeule: 'business' } },
  { art: 'index', label: 'Privat-Index', beschreibung: 'Der Privat-Index mit seinen Säulen', bereich: 'Finanzen', breite: 2, voreinstellung: { saeule: 'privat' } },
  { art: 'index', label: 'Gesundheits-Index', beschreibung: 'Der Gesundheits-Index mit seinen Säulen', bereich: 'Gesundheit', breite: 2, voreinstellung: { saeule: 'gesundheit' } },
  { art: 'index', label: 'Traktions-Score', beschreibung: 'Der Traktions-Score der Markttraktion', bereich: 'Business', breite: 2, voreinstellung: { saeule: 'traktion' } },
  { art: 'finanzen-privat', label: 'Finanzen · privat', beschreibung: WIDGETS['finanzen-privat'].beschreibung, bereich: 'Finanzen', breite: 2 },
  { art: 'zoe', label: 'Freigaben von ZOE & Inbox', beschreibung: WIDGETS.zoe.beschreibung, bereich: 'ZOE', breite: 2, voreinstellung: { inbox: true } },
  { art: 'dran', label: 'Wer heute dran ist', beschreibung: WIDGETS.dran.beschreibung, bereich: 'Business', breite: 4 },
  { art: 'fulfillment', label: 'Heute im Fulfillment', beschreibung: WIDGETS.fulfillment.beschreibung, bereich: 'Business', breite: 4 },
  { art: 'prozesse', label: 'Prozesse heute', beschreibung: WIDGETS.prozesse.beschreibung, bereich: 'Business', breite: 2 },
  { art: 'kanal', label: 'Kanal-Leistung', beschreibung: WIDGETS.kanal.beschreibung, bereich: 'Business', breite: 2 },
  { art: 'event', label: WIDGETS.event.label, beschreibung: WIDGETS.event.beschreibung, bereich: 'Business', breite: 2 },
  { art: 'familie', label: 'Familie & Partnerschaft', beschreibung: WIDGETS.familie.beschreibung, bereich: 'Familie', breite: 2 },
];
export const widgetDef = (art: string): WidgetDef | undefined => WIDGETS[art];
export type { ReactNode };
