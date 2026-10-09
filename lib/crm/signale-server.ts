// ─── CRM-Signale: der EINE Lauf (Route und Takt) ───────────────────────────────
// 09.10. (Takt robust): Der Signal-Lauf (vergangene Termine bekannter Personen → Verlauf, Meetings mit Bezug, „letzter Kontakt“) lief nur,
// wenn jemand die Markttraktion öffnete (components/os/crm/daten.ts) — die Heads sahen sonst einen veralteten „letzten Kontakt“ und schlugen
// Nachfassen bei jemandem vor, der gerade ein Meeting hatte. Jetzt ist er EIN Lauf (`signaleLauf`), den die Route (Browser) und der Takt
// (`crmSignaleImTakt`, Systemlauf ohne Person) gleich aufrufen — idempotent (Signal-Kennungen, eine Aktivität je Termin-Vorkommen).
// Der Lauf liest nur den Kalender-Spiegel (`calendar-cache`, `kalender-bezug`) und die Kartei — kein iCloud-Aufruf, keine KI. Darum gilt
// der Not-Aus der Agenten nicht (er ist Datenpflege wie der Kalender-Abgleich); im Takt läuft er nur, wenn in diesem Takt kein iCloud-Job
// startet oder läuft und iCloud nicht in einer Pause ist (die Kalender-Jobs sind gestaffelt, lib/kalender/takt-jobs.ts).

import { loadJson, saveJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import { terminSignale, signaleAnwenden, type TerminEin } from '@/lib/crm/signale';
import { terminAktivitaeten, terminKontaktNachziehen, terminVorbei, type TerminFuerCrm } from '@/lib/crm/termin-aktivitaet';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import { kontakteVon, bezugVon as bezugFuer, altSchluessel, type BezugBestand } from '@/lib/kalender/bezug';
import { localDay, tagePlus } from '@/lib/zeit';
import type { TaktJob } from '@/lib/kalender/takt-jobs';

export interface SignaleStand { letzter?: string; neu?: number }
export const SIGNALE_BESTAND = 'crm-signale';
/** Aus der Oberfläche höchstens alle 5 Minuten (wie bisher). */
export const SIGNALE_ABSTAND_MIN = 5;
/** Im Takt alle 10 Minuten — reicht für „letzter Kontakt“ und hält die eine CPU frei. */
export const SIGNALE_TAKT_MIN = 10;

export type SignaleErgebnis = { frisch: true; neu: 0 } | { frisch?: false; neu: number; termine: number };

/** Der Lauf (Route und Takt). `abstandMin` = Riegel aus `crm-signale.letzter`; `erzwingen` übergeht ihn. */
export async function signaleLauf(o: { wer: Wer; erzwingen?: boolean; abstandMin?: number; jetzt?: Date }): Promise<SignaleErgebnis> {
  const jetztD = o.jetzt ?? new Date();
  const alt = (await loadJson<SignaleStand>(SIGNALE_BESTAND)) ?? {};
  const abstand = (o.abstandMin ?? SIGNALE_ABSTAND_MIN) * 60_000;
  if (!o.erzwingen && alt.letzter && jetztD.getTime() - Date.parse(alt.letzter) < abstand) return { frisch: true, neu: 0 };

  const kalender = await loadJson<{ events?: { id: string; uid?: string; title?: string; startDate?: string; category?: string; privat?: boolean; abgesagt?: boolean }[] }>('calendar-cache');
  const bezuege: BezugBestand | null = await ladeBezuege().catch(() => null);
  const bezugVon = (e: { id: string; uid?: string }) => bezugFuer(bezuege, e);
  // Abgesagt/abgelehnt (R-K1 #100): fand nicht statt — weder Signal noch Meeting noch „letzter Kontakt“.
  const kalTermine = (kalender?.events ?? []).filter(t => t.title && t.startDate && !t.abgesagt);
  const termine: TerminEin[] = [
    // KEMARIS/M365: bis zur echten Anbindung keine Termine (die Beispieldaten sind seit 29.09., K5, raus).
    // Apple-Kalender: mit Bezug aus jedem Kalender; über den Namen im Titel nur die geschäftliche Kategorie (Holding).
    ...kalTermine.map(t => ({ t, k: kontakteVon(bezugVon(t)) })).filter(({ t, k }) => k.length || t.category === 'holding')
      .map(({ t, k }) => ({ id: k.length ? t.id : `ac-${altSchluessel(t.id)}`, titel: t.title!, start: t.startDate!, ...(t.uid ? { uid: t.uid } : {}), ...(k.length ? { kontaktIds: k } : {}), ...(t.privat ? { privat: true } : {}) })),
  ];
  // Termine mit Bezug → Meeting-Aktivitäten (eine je Vorkommen) und Kontaktpflege für vergangene Meetings.
  const mitBezug: TerminFuerCrm[] = kalTermine.flatMap(t => {
    const b = bezugVon(t), k = kontakteVon(b);
    return k.length ? [{ id: t.id, uid: t.uid ?? t.id, titel: t.title!, start: t.startDate!, ...(t.privat ? { privat: true } : {}), kontaktIds: k, ...(b?.dealId ? { dealId: b.dealId } : {}), von: b?.von ?? 'system' }] : [];
  });
  const jetzt = jetztD.toISOString();
  const heute = localDay(jetztD);
  let neu = 0;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const t = terminSignale(f.kontakte, termine, jetzt);
    const r = signaleAnwenden(f.kontakte, t.vergangen);
    let kontakte = r.kontakte;
    let n = r.neu;
    for (const m of mitBezug) {
      if (!terminVorbei(m.start, jetzt)) continue;
      const x = terminAktivitaeten(kontakte, m, heute, jetzt, tagePlus);
      kontakte = x.kontakte; n += x.neu.length;
    }
    // Zeiten je Schlüssel — auch unter der alten Form (Aktivitäten vor R-K1 tragen `uid` bzw. `uid::RID`).
    const zeiten = new Map<string, { start: string }>();
    for (const m of mitBezug) { zeiten.set(m.id, { start: m.start }); if (!zeiten.has(altSchluessel(m.id))) zeiten.set(altSchluessel(m.id), { start: m.start }); }
    const nach = terminKontaktNachziehen(kontakte, zeiten, heute, jetzt);
    neu = n;
    return n || nach.geaendert ? { ...f, kontakte: nach.kontakte } : f;
  }, o.wer);
  await saveJson<SignaleStand>(SIGNALE_BESTAND, { letzter: jetzt, neu });
  return { neu, termine: termine.length };
}

/** iCloud in einer Pause nach einem Fehler (nicht „gerade frisch“)? Rein. */
export function icloudInPause(s: { at?: string; fehlerAt?: string; pauseBis?: string; fehlerAnmeldung?: boolean }, jetzt: number, faellig: (s: { at?: string; fehlerAt?: string; pauseBis?: string; fehlerAnmeldung?: boolean }, jetzt: number) => boolean): boolean {
  return !!s.fehlerAt && (!s.at || s.fehlerAt > s.at) && !faellig(s, jetzt);
}

let laeuft = false;

/**
 * Der Signal-Lauf im Takt (Systemlauf, Dienstweg): nur, wenn der Kalender-Job dieses Takts nichts mit iCloud angefangen hat (`spiegel`
 * bzw. `nichts`) und iCloud nicht pausiert — höchstens alle `SIGNALE_TAKT_MIN` Minuten, ein Lauf je Prozess. Liefert, was geschah (Tests,
 * Protokoll). Nie werfend.
 */
export async function crmSignaleImTakt(kalenderJob: TaktJob, jetzt = new Date()): Promise<'gelaufen' | 'frisch' | 'wartet' | 'pause' | 'laeuft' | 'fehler'> {
  if (kalenderJob !== 'spiegel' && kalenderJob !== 'nichts') return 'wartet';
  if (laeuft) return 'laeuft';
  laeuft = true;
  try {
    const { verbunden, ladeStandIcloud, naechsterVersuchFaellig } = await import('@/lib/kalender/icloud');
    if (verbunden() && icloudInPause(await ladeStandIcloud(), jetzt.getTime(), naechsterVersuchFaellig)) return 'pause';
    const r = await signaleLauf({ wer: { art: 'system' }, abstandMin: SIGNALE_TAKT_MIN, jetzt });
    return r.frisch ? 'frisch' : 'gelaufen';
  } catch (e) {
    console.warn(`[crm-signale] Takt: ${e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler'}`);
    return 'fehler';
  } finally {
    laeuft = false;
  }
}
