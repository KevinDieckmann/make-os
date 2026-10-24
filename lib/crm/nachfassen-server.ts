// ─── Event-Nachfassen als Prozess (24.10., Paket Ü 2 — Entscheidung „Als neuen Ablauf bauen“; Server) ───────────────────────────────────────────────────
// Der System-Prozess „Event-Nachfassen in 48 Stunden“ (sp-event-nachfassen) schreibt heute nichts: die Glocke „n Danke-Mails bereit — <Event>“ und die Quote
// rechnen Glocke, Heute und Events › Wirkung beim LESEN. Der überführte Prozess (lib/prozesse/ueberfuehrung.ts) hat deshalb zwei Teile:
//   Kern  `nachfassLageBild` — die Nachfass-Lage eines besuchten Events am Tag danach: je Person, die erfasst hat, die Glocke `danke-<event>`, wenn Danke-Mails
//         offen sind. EINE Rechnung mit der Glocke (`dankeAnstehend`, lib/heute/anstehend-server.ts). Der Kern schreibt nie — die Glocke bleibt abgeleitet (nie
//         beide, nie keine). Im Schatten meldet der Morgenlauf (`nachfassLageMorgenlauf`, der alte Einstieg) und der feste Schritt `nachfass-lage` dasselbe Bild.
//   Neu   `nachfassFollowupsKern` (fester Zusatz-Schritt `nachfass-followups`): je Erfassung ohne Nachfassen ein Follow-up `fu-nf-<teilnahme>` „Nachfassen nach …“ —
//         nie, wenn schon eins da ist (`fu-<erfassung>` aus dem Erfassen, irgendein offenes Follow-up der Person an diesem Event), nie bei „Nur Kontakt“/Termin,
//         Verzicht, `followUpAm`, Art. 18 oder Werbesperre. Fällig wie das Erfassen (`followupFrist` mit der Stellschraube „Nachfassen nach einem Event“).
// Nur Kennungen im Wirkungsbild; die Person nur als Fingerabdruck im Vergleich.

import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import type { Wirkungsbild } from '@/lib/prozesse/ueberfuehrung';

/** Das Wirkungsbild der Nachfass-Lage (Kern): je besuchtem Event und Person die Glocke, die heute offen ist. `eventId` = nur dieses Event, sonst alle Events von gestern. */
export async function nachfassLageBild(eventId: string | null, heute: string): Promise<Wirkungsbild[]> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }, { dankeAnstehend }, { istNetzwerkenEvent }] = await Promise.all([
    import('./speicher'), import('./verarbeitung'), import('@/lib/heute/anstehend-server'), import('./marke'),
  ]);
  const [crm, kontakte] = await Promise.all([ladeCrm(), kontakteFuerVerarbeitung()]);
  const gestern = tagPlus(heute, -1);
  const events = new Set(crm.events.filter(e => (eventId ? e.id === eventId : e.datum.slice(0, 10) === gestern) && istNetzwerkenEvent(e) && e.status !== 'abgesagt').map(e => e.id));
  if (!events.size) return [];
  const personen = Array.from(new Set(crm.teilnahmen.filter(t => events.has(t.eventId) && t.netzwerken?.erfasstVon).map(t => t.netzwerken!.erfasstVon))).sort();
  const bild: Wirkungsbild[] = [];
  for (const p of personen) for (const d of dankeAnstehend(crm, kontakte, heute, p)) {
    const id = d.id.slice('danke-'.length);
    if (events.has(id) && d.n > 0) bild.push({ art: 'meldung', ziel: d.id, tag: heute, zustaendig: p });
  }
  return bild;
}

/**
 * Der alte Einstieg (Morgenlauf, app/api/tagesstart): der Kern ist abgeleitet — es gibt nichts abzuschalten. Im Schatten des überführten Prozesses meldet er dem
 * Vergleich, was die Glocke heute für die Events von gestern zeigt. Fragt die Weiche genau einmal. Wirft nie.
 */
export async function nachfassLageMorgenlauf(heute = localDay()): Promise<{ gemeldet: number }> {
  try {
    const ue = await import('@/lib/prozesse/ueberfuehrung-server');
    const weg = await ue.wegFuer('sp-event-nachfassen');
    if (!weg.schatten) return { gemeldet: 0 };
    const bild = await nachfassLageBild(null, heute);
    await ue.vergleichMeldenServer('sp-event-nachfassen', 'alt', heute, bild);
    return { gemeldet: bild.length };
  } catch (err) {
    console.error(`[crm/nachfassen] Lage nicht gemeldet — ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`);
    return { gemeldet: 0 };
  }
}

/** Ein Follow-up, das der neue Weg sichern würde (nur Kennungen). */
export interface NachfassSoll { id: string; teilnahmeId: string; kontaktId: string; zustaendig?: string }

/**
 * Neu gegenüber dem alten Weg (fester Zusatz-Schritt `nachfass-followups`): je Erfassung des Events ohne Nachfassen ein Follow-up — feste Kennung `fu-nf-<teilnahme>`
 * (ein zweiter Lauf, ein Umschalten mitten am Tag legt nichts doppelt an). `schreiben` legt an (in derselben Sperre noch einmal geprüft), sonst nur rechnen.
 */
export async function nachfassFollowupsKern(eventId: string, heute: string, o: { schreiben: boolean; person: string | null }): Promise<{ soll: NachfassSoll[]; neu: string[]; bild: Wirkungsbild[] }> {
  const [{ ladeCrm, aendereCrm }, { kontakteFuerVerarbeitung }, { ausgenommen }, { istNetzwerkenEvent, nachfassText }, { followupFrist }, { nachfassWerktage }, { neuesFollowUp }] = await Promise.all([
    import('./speicher'), import('./verarbeitung'), import('./einschraenkung'), import('./marke'), import('./netzwerken'), import('./stellschrauben'), import('./followup'),
  ]);
  const [crm, kontakte] = await Promise.all([ladeCrm(), kontakteFuerVerarbeitung()]);
  const ev = crm.events.find(e => e.id === eventId);
  if (!ev || !istNetzwerkenEvent(ev) || ev.status === 'abgesagt') return { soll: [], neu: [], bild: [] };
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const sollAus = (b: typeof crm): NachfassSoll[] => {
    const raus: NachfassSoll[] = [];
    for (const t of b.teilnahmen) {
      const n = t.netzwerken;
      if (t.eventId !== eventId || !n || t.followUpAm || t.nachfassenVerzichtet || n.schritt === 'nur-kontakt' || n.schritt === 'termin') continue;
      const k = nachId.get(t.kontaktId);
      if (!k || ausgenommen(k)) continue;
      const id = `fu-nf-${t.id}`;
      // Das Follow-up des Erfassens heißt `fu-<erfassung>` (lib/crm/netzwerken-server.ts) — gleich welcher Status: dann hat das Erfassen schon nachgefasst.
      if ((b.followups ?? []).some(f => f.id === id || f.id === `fu-${n.erfassungId}` || (f.status === 'offen' && f.kontaktId === t.kontaktId && f.bezug.art === 'event' && f.bezug.id === eventId))) continue;
      raus.push({ id, teilnahmeId: t.id, kontaktId: t.kontaktId, ...(n.zustaendig ? { zustaendig: n.zustaendig } : {}) });
    }
    return raus.sort((a, b) => a.id.localeCompare(b.id));
  };
  const soll = sollAus(crm);
  const bild = (l: readonly NachfassSoll[]): Wirkungsbild[] => l.map(s => ({ art: 'followup', ziel: s.id, tag: heute, ...(s.zustaendig ? { zustaendig: s.zustaendig } : {}) }));
  if (!o.schreiben || !soll.length) return { soll, neu: [], bild: bild(soll) };
  const frist = followupFrist(ev.datum.slice(0, 10), nachfassWerktage(crm.wertelisten));
  const faellig = frist < heute ? heute : frist;
  const jetzt = new Date().toISOString();
  const neu: string[] = [];
  await aendereCrm(b => {
    neu.length = 0;
    const offen = sollAus(b);
    if (!offen.length) return b;
    const dazu = offen.map(s => {
      neu.push(s.id);
      const f = neuesFollowUp({ id: s.id, bezug: { art: 'event', id: eventId }, kontaktId: s.kontaktId, art: 'nachricht', text: nachfassText(ev), faellig, quelle: 'event', ...(s.zustaendig ? { zustaendig: s.zustaendig } : {}) }, nachId.get(s.kontaktId), o.person ?? 'system', jetzt);
      return { ...f, geaendertVon: o.person ?? 'system' };
    });
    return { ...b, followups: [...(b.followups ?? []), ...dazu] };
  }, { art: 'system' });
  return { soll, neu, bild: bild(soll) };
}
