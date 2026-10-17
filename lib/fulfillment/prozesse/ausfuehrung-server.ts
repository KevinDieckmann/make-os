// ─── Fulfillment · Ausführung der Abläufe — Server (17.10. abends) ────────────────────────────────────────────────────────────────────────
// Setzt um, was die reinen Regeln (./ausfuehrung.ts `ausfuehrungSoll`) für einen Fall verlangen — immer nur über die VORHANDENEN Schreibwege:
//   · Aufgaben NUR über `systemAufgabenAendern` (Verlauf „durch System“, Protokoll, Zuweisungs-Glocke), Kennung fest aus Fall + Knoten + Runde, im Space des
//     Mandanten (`fallAufgabeOrt`). Erledigte Schritte schließen ihre Aufgabe (erledigt bzw. abgebrochen), nie umgekehrt still.
//   · Nachrichten NUR als Vorschlag im Freigabe-Stapel (`lege`, Gruppe Kunden = Business) — der Entwurf entsteht beim Öffnen im Fall aus dem Mail-Baustein,
//     gesendet wird nur dort per Klick über /api/inbox/senden (§ 7 UWG, Art. 18 wie jede Mail). Art. 18 bzw. Werbesperre der Ansprechperson → kein Vorschlag.
//   · Glocken NUR über `melde()` (eine je Runde bzw. „eskaliert“ einmal).
//   · Fall-Änderungen (Fälligkeit ab Ankunft, „wartet auf Kunde“) und die Marken („schon gemacht“) NUR über `fulfillmentAendern` + `fallAnwenden`.
// Aufgerufen nach jedem Schreiben am Fall (fall-server.ts), beim Start und bei der Übernahme einer Vorlage, im Morgenlauf (alle Fälle) — idempotent. Und in
// die andere Richtung: eine erledigte Aufgabe der Ausführung rückt den Fall weiter (`fulfillmentNachAufgaben`, Haken in lib/aufgaben/speicher.ts).
// KI kommt hier nicht vor (Platzhalter füllt die reine Regel `nachrichtEntwurf`).

import type { Fall, FallKnoten, VorlagenDatei } from '../typen';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { TasksState } from '@/types/tasks';
import { fulfillmentAendern, fulfillmentHaushalt, eintragStand } from '../speicher';
import { fallAufgabeOrt, zusatzJeKnoten } from '../regeln';
import { STAPEL_GRUPPE } from '../grenzen';
import { localDay } from '@/lib/zeit';
import {
  ABLAUF_AUFGABE_PRAEFIX, ABLAUF_WERKZEUG_NACHRICHT, ablaufAktiv, ablaufStand, aktiveKnoten, aufgabeZuKnoten, ausfuehrungSoll, nachrichtEntwurf, opNachAufgabe,
  type AblaufKnotenStand, type AusfuehrungSoll,
} from './ausfuehrung';
import { fallAnwenden } from './fall';
import { fallWirksam } from './onboarding';
import { titelOhneZusatz } from './darstellung';

export interface AblaufLauf { faelle: number; aufgaben: number; geschlossen: number; nachrichten: number; glocken: number; fehler?: string }

type Umfeld = Awaited<ReturnType<typeof import('./fall-server')['fallUmfeld']>>;

/** Der Mail-Baustein eines Knotens (eigener oder einer der Bausteine darunter) — null ohne. */
export function mailBausteinVon(k: Pick<FallKnoten, 'id' | 'bausteinId'>, knoten: readonly FallKnoten[], vorlagen: Pick<VorlagenDatei, 'bausteine'>): VorlagenDatei['bausteine'][number] | null {
  const ids = [k.bausteinId, ...knoten.filter(x => x.elternId === k.id).map(x => x.bausteinId)].filter((x): x is string => !!x);
  return ids.map(id => vorlagen.bausteine.find(b => b.id === id)).find(b => b?.art === 'mail') ?? null;
}

/** Wer die Aufgaben eines Falls bekommt: die zuständige Person des Mandats (im Haushalt), sonst die erste Person des Haushalts; „beide“ → die andere beteiligt. */
async function verantwortung(m: Pick<Mandat, 'zustaendig'>): Promise<{ an: string; beteiligte: string[] } | null> {
  const { haushaltsPersonen } = await import('@/lib/aufgaben/sicht');
  const p = (await haushaltsPersonen()).map(x => x.speicher);
  if (!p.length) return null;
  if (m.zustaendig && p.includes(m.zustaendig)) return { an: m.zustaendig, beteiligte: [] };
  if (m.zustaendig === 'beide') return { an: p[0], beteiligte: p.slice(1) };
  return { an: p[0], beteiligte: [] };
}

/**
 * Die Ansprechperson für eine Nachricht (EINE Regel für Vorschlag und Entwurf): erst die Entscheider der Stakeholder-Karte, dann die Kontakte des Mandats —
 * die erste mit Adresse. Ist sie eingeschränkt (Art. 18) oder hat sie eine Werbesperre: kein Entwurf, nur ein Hinweis.
 */
export function nachrichtEmpfaenger(f: Pick<Fall, 'stakeholder'>, m: Pick<Mandat, 'kontaktIds'>, kontakte: readonly Kontakt[]): { kontakt: Kontakt | null; gesperrt?: string } {
  const kandidaten = [...f.stakeholder.filter(s => s.rolle === 'entscheider').map(s => s.kontaktId), ...m.kontaktIds];
  const k = kandidaten.map(id => kontakte.find(x => x.id === id)).find(x => !!x?.email) ?? null;
  if (k?.eingeschraenkt) return { kontakt: null, gesperrt: 'Die Ansprechperson ist eingeschränkt (Art. 18) — es gibt keinen Entwurf. Bitte in der Akte prüfen, wer angeschrieben wird.' };
  if (k?.werbesperre) return { kontakt: null, gesperrt: 'Für die Ansprechperson gilt eine Werbesperre — es gibt keinen Entwurf. Bitte persönlich klären.' };
  return { kontakt: k };
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** Ein Termin als Text: „Di, 14.10., 10:00 Uhr“ (ohne Uhrzeit ohne „Uhr“). */
export function terminText(t: { tag: string; von?: string }): string {
  const [j, mo, d] = t.tag.split('-').map(Number);
  const wt = WOCHENTAG[new Date(Date.UTC(j, mo - 1, d)).getUTCDay()];
  return `${wt}, ${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${t.von ? `, ${t.von.slice(0, 5)} Uhr` : ''}`;
}

/** Text einer Aufgabe der Ausführung (Beschreibung) — ohne Namen von Personen. */
function aufgabeText(a: AusfuehrungSoll['aufgaben'][number], vorlage: string | undefined, entscheidung?: string, mitMail?: boolean): string {
  const ablauf = vorlage ? ` im Ablauf „${vorlage}“` : '';
  if (a.art === 'erinnerung') {
    return [`Erinnerung${ablauf}: ${entscheidung ? `„${entscheidung}“ ist noch offen. ` : ''}Nachfassen, dann abhaken — danach fragt der Fall wieder nach.`,
      mitMail ? 'Den Mail-Entwurf öffnest du im Fall (bzw. unter ZOE › Freigaben) — gesendet wird nur per Klick.' : ''].filter(Boolean).join(' ');
  }
  return [`Schritt${ablauf}. Erledigt ihr die Aufgabe, rückt der Fall weiter — hakt ihr den Schritt im Fall ab, schließt sich die Aufgabe.`,
    a.kunde ? 'Den Schritt macht der Kunde — die Aufgabe hält nach, bis es da ist.' : '',
    a.art === 'termin' ? 'Den Termin legt ihr im Fall unter „Menschen & Termine“ an.' : ''].filter(Boolean).join(' ');
}

/** Vorschläge für Nachrichten, die nicht mehr dran sind, aus dem Stapel nehmen (gesendet bzw. Schritt entfällt) — idempotent. */
async function stapelAufraeumen(laufend: ReadonlyMap<string, { aktiv: Set<string>; fall: Fall }>): Promise<void> {
  if (!laufend.size) return;
  const { lies, entscheide } = await import('@/lib/zoe/stapel');
  for (const v of await lies('offen')) {
    const m = /^p:nachricht:([^:]+):([^:]+):(\d+)$/.exec(v.bezug?.art === 'fulfillment' ? v.bezug.id : '');
    if (!m) continue;
    const l = laufend.get(m[1]);
    if (!l || l.aktiv.has(`${m[2]}:${m[3]}`)) continue;
    const k = l.fall.knoten.find(x => x.id === m[2]);
    if (k?.status === 'entfaellt') await entscheide(v.id, 'abgelehnt', { grund: 'Der Schritt entfällt im Fall — die Nachricht ist nicht mehr nötig.', von: null });
    else await entscheide(v.id, 'freigegeben', { ergebnis: 'Im Fall erledigt (gesendet bzw. abgehakt) — nichts mehr zu tun.', von: null });
  }
}

/**
 * Die Ausführung für einen Fall (bzw. alle laufenden Fälle) nachziehen — idempotent. `person` = wer gerade am Fall gearbeitet hat (Verlauf der Aufgaben, keine
 * Glocke an sich selbst); ohne Person ein Systemlauf (Morgenlauf). Wirft nie: Fehler stehen in `fehler`.
 */
export async function ablaufNachziehen(o: { mandatId?: string; person?: string | null; wer?: Wer; jetzt?: Date; heute?: string; umfeld?: Umfeld } = {}): Promise<AblaufLauf> {
  const lauf: AblaufLauf = { faelle: 0, aufgaben: 0, geschlossen: 0, nachrichten: 0, glocken: 0 };
  try {
    const jetzt = o.jetzt ?? new Date();
    const iso = jetzt.toISOString(), heute = o.heute ?? localDay(jetzt);
    const { fallUmfeld, ableitungFuer } = await import('./fall-server');
    const u = o.umfeld ?? await fallUmfeld(o.mandatId ? [o.mandatId] : undefined);
    const { istBusinessGesellschaft } = await import('@/lib/einheiten');
    const arbeit: { f: Fall; w: Fall; m: Mandat; soll: AusfuehrungSoll; an: { an: string; beteiligte: string[] } | null }[] = [];
    for (const f of Object.values(u.faelle.faelle)) {
      if (o.mandatId && f.mandatId !== o.mandatId) continue;
      if (f.status === 'abgeschlossen') continue;
      const m = u.crm.mandate.find(x => x.id === f.mandatId && !x.geloeschtAm);
      if (!m || !istBusinessGesellschaft(m.gesellschaft)) continue;
      const w = fallWirksam(f, ableitungFuer(f, m, u.crm, u.vorlagen, u.kunde[m.id], iso, u.termine[m.id]));
      if (!ablaufAktiv(w)) continue;
      const soll = ausfuehrungSoll(w, heute, k => !!mailBausteinVon(k, w.knoten, u.vorlagen));
      arbeit.push({ f, w, m, soll, an: await verantwortung(m) });
    }
    lauf.faelle = arbeit.length;
    if (!arbeit.length) return lauf;
    const neueMarken = new Map<string, Record<string, string>>();
    const marke = (mid: string, k: string) => { const x = neueMarken.get(mid) ?? {}; x[k] = heute; neueMarken.set(mid, x); };

    // 1) Aufgaben anlegen und schließen — EIN Schreibvorgang über den Server-Schreiber der Aufgaben.
    const sollAufgaben = arbeit.flatMap(a => a.soll.aufgaben.map(x => ({ a, x })));
    const abschluss = arbeit.flatMap(a => a.soll.abschluss);
    if (sollAufgaben.length || abschluss.length) {
      const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
      const { WEG } = await import('@/lib/wege');
      let vorhanden = new Set<string>();
      const r = await systemAufgabenAendern(stand => {
        const ids = new Map(stand.tasks.map(t => [t.id, t]));
        const neu: Record<string, unknown>[] = [];
        for (const { a, x } of sollAufgaben) {
          if (ids.has(x.id) || !a.an) continue;
          const ort = fallAufgabeOrt(a.m);
          // Ein Schritt eines angehängten Zusatzmoduls (17.10. spät) nennt dessen Ablauf, nicht den des Pakets.
          const v = u.vorlagen.prozesse.find(p => p.id === (zusatzJeKnoten(a.w.knoten).get(x.knotenId) ?? a.f.vorlageId));
          const e = x.art === 'erinnerung' ? a.w.knoten.find(k => k.zweige?.nein === x.knotenId) : undefined;
          const kn = a.w.knoten.find(k => k.id === x.knotenId);
          neu.push({
            id: x.id, title: ort.titel(x.titel), status: 'todo', priority: x.art === 'erinnerung' ? 'high' : 'medium', assignee: a.an.an,
            ...(a.an.beteiligte.length ? { beteiligte: a.an.beteiligte } : {}), ...(x.faellig ? { dueDate: x.faellig } : {}),
            description: aufgabeText(x, v ? titelOhneZusatz(v.titel) : undefined, e ? titelOhneZusatz(e.titel) : undefined, !!(kn && mailBausteinVon(kn, a.w.knoten, u.vorlagen))),
            notiz: `[Fall öffnen](${WEG.fall(a.m.id, 'reise', `schritt-${x.knotenId}`)})`, tags: ['fulfillment', 'ablauf'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: iso, updatedAt: iso,
            space: ort.space, ...(ort.spaceId ? { spaceId: ort.spaceId } : {}), bezug: ort.bezug,
          });
        }
        const teile = abschluss.filter(z => { const t = ids.get(z.id); return !!t && !t.geloeschtAm && t.status !== 'done' && t.status !== 'cancelled'; })
          .map(z => ({ id: z.id, felder: { status: z.status } as Record<string, unknown> }));
        vorhanden = new Set([...ids.keys(), ...neu.map(x => String(x.id))]);
        lauf.aufgaben = neu.length; lauf.geschlossen = teile.length;
        return { neu, teile };
      }, { person: o.person ?? null, ...(o.wer ? { wer: o.wer } : {}), jetzt: iso });
      if (r.ok) {
        for (const { a, x } of sollAufgaben) if (vorhanden.has(x.id)) marke(a.f.mandatId, x.marke);
        for (const a of arbeit) for (const z of a.soll.abschluss) marke(a.f.mandatId, z.marke);
      } else { lauf.aufgaben = 0; lauf.geschlossen = 0; lauf.fehler = r.fehler ?? 'Aufgaben nicht geschrieben'; }
    }

    // 2) Nachrichten als Vorschlag in den Stapel (nie gesendet) — nicht für eingeschränkte Personen bzw. mit Werbesperre.
    const mitNachricht = arbeit.filter(a => a.soll.nachrichten.length);
    if (mitNachricht.length) {
      const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
      const kontakte = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
      const { lege } = await import('@/lib/zoe/stapel');
      for (const a of mitNachricht) {
        const em = nachrichtEmpfaenger(a.w, a.m, kontakte);
        if (em.gesperrt) continue;
        for (const x of a.soll.nachrichten) {
          await lege({
            werkzeug: ABLAUF_WERKZEUG_NACHRICHT, gruppe: STAPEL_GRUPPE, titel: `Nachricht bereit: ${x.titel} — ${a.m.kunde}`.slice(0, 200),
            nachher: 'Entwurf im Fall öffnen, prüfen und per Klick senden — gesendet wird nichts von selbst',
            eingabe: { mandatId: a.m.id, knotenId: x.knotenId, runde: x.runde }, anlass: x.runde ? `Erinnerung im Ablauf (Runde ${x.runde})` : 'Der Ablauf ist bei dieser Nachricht angekommen',
            quelle: 'lauf', bezug: { art: 'fulfillment', id: x.bezugId }, ...(a.an ? { person: a.an.an } : {}),
          });
          marke(a.f.mandatId, x.marke);
          lauf.nachrichten++;
        }
      }
    }

    // 3) Glocken — eine je Runde (Entscheidung nach der Frist offen) bzw. einmal „eskaliert“. Nur im Systemlauf (Morgenlauf): arbeitet gerade jemand am
    //    Fall, sieht er die Frage selbst — und die Glocke an sich selbst gäbe es nicht (`melde`); die Marke bliebe dann ohne Glocke stehen.
    const { melde } = await import('@/lib/meldungen/melden');
    const { WEG } = await import('@/lib/wege');
    for (const a of o.person ? [] : arbeit) {
      for (const g of a.soll.glocken) {
        if (a.an) await melde({
          an: a.an.an, art: 'produkte', link: WEG.fall(a.m.id, 'reise', `schritt-${g.knotenId}`),
          titel: g.art === 'eskaliert' ? `Eskaliert: „${g.titel}“ — alle Erinnerungen ohne Antwort, bitte entscheiden` : `Entscheidung offen: „${g.titel}“ — ja oder nein?`,
        });
        marke(a.f.mandatId, g.marke);
        lauf.glocken++;
      }
    }

    // 4) Fall: Fälligkeiten ab Ankunft, „wartet auf Kunde“ und die Marken — EIN Schreibvorgang.
    const mitOps = arbeit.filter(a => a.soll.ops.length || neueMarken.has(a.f.mandatId));
    if (mitOps.length) {
      await fulfillmentAendern('faelle', d => {
        const faelle = { ...d.faelle };
        const geaendert: string[] = [];
        for (const a of mitOps) {
          let f = faelle[a.f.mandatId];
          if (!f) continue;
          if (a.soll.ops.length) {
            const r = fallAnwenden(f, a.soll.ops, {
              person: o.person ?? 'system', jetzt: iso, heute, standVon: eintragStand, neueId: () => 'fk-x',
              ziele: [], kontaktErlaubt: () => false, ritualIds: [], freigaben: [],
            });
            if (r.ok) f = r.datei;
          }
          const mk = neueMarken.get(a.f.mandatId);
          if (mk) f = { ...f, marken: { ...f.marken, ...mk } };
          if (f !== faelle[a.f.mandatId]) { faelle[a.f.mandatId] = f; geaendert.push(a.f.mandatId); }
        }
        return { ok: true, datei: { ...d, faelle }, geaendert };
      }, o.wer ?? { art: 'system', ...(o.person ? { person: o.person } : {}) }, u.h ?? await fulfillmentHaushalt());
    }

    // 5) Vorschläge für Nachrichten, die nicht mehr dran sind, aus dem Stapel nehmen.
    await stapelAufraeumen(new Map(arbeit.map(a => [a.m.id, {
      fall: a.w, aktiv: new Set(aktiveKnoten(a.w).filter(x => x.art === 'nachricht' || x.art === 'erinnerung').map(x => `${x.knoten.id}:${x.art === 'nachricht' ? 0 : x.runde}`)),
    }])));
  } catch (e) {
    lauf.fehler = e instanceof Error ? e.message.slice(0, 200) : 'Ausführung nicht nachgezogen';
    console.error('[fulfillment/ausfuehrung] nicht nachgezogen —', lauf.fehler);
  }
  return lauf;
}

/**
 * Haken nach jedem Aufgaben-Schreiben (lib/aufgaben/speicher.ts): eine Aufgabe der Ausführung wurde erledigt → ihr Knoten im Fall ist erledigt (über den
 * Schreibweg des Falls, als die Person, die abgehakt hat). Nur, wenn der Knoten gerade dran ist — sonst nichts (idempotent, kein Ping-Pong). Wirft nie.
 */
export async function fulfillmentNachAufgaben(vorher: Pick<TasksState, 'tasks'>, nachher: Pick<TasksState, 'tasks'>, person: string): Promise<number> {
  const alt = new Map(vorher.tasks.map(t => [t.id, t.status]));
  const fertig = nachher.tasks.filter(t => t.id.startsWith(ABLAUF_AUFGABE_PRAEFIX) && t.status === 'done' && alt.get(t.id) !== 'done');
  if (!fertig.length) return 0;
  let n = 0;
  try {
    const { fallUmfeld, ableitungFuer, fallSchreiben } = await import('./fall-server');
    for (const t of fertig) {
      const mid = typeof t.bezug?.mandatId === 'string' ? t.bezug.mandatId : undefined;
      if (!mid) continue;
      const u = await fallUmfeld([mid]);
      const f = u.faelle.faelle[mid];
      const m = u.crm.mandate.find(x => x.id === mid);
      if (!f || !m) continue;
      const ziel = aufgabeZuKnoten(f, t.id);
      if (!ziel) continue;
      const w = fallWirksam(f, ableitungFuer(f, m, u.crm, u.vorlagen, u.kunde[mid], new Date().toISOString(), u.termine[mid]));
      const op = opNachAufgabe(w, ziel.knotenId, ziel.runde);
      if (!op) continue;
      const wer: Wer = person && person !== 'system' ? { art: 'person', person } : { art: 'system' };
      await fallSchreiben(mid, [op], person || 'system', wer);
      n++;
    }
  } catch (e) {
    console.error('[fulfillment/ausfuehrung] Fall nicht weitergerückt —', e instanceof Error ? e.message : e);
  }
  return n;
}

/** Der Morgenlauf-Teil der Ausführung: alle laufenden Fälle nachziehen (Erinnerungen nach Frist, Glocken, Aufgaben). */
export async function ablaufMorgenlauf(heute: string): Promise<AblaufLauf> {
  return ablaufNachziehen({ heute });
}

// ── Für die Route des Falls: Stand und Entwurf ─────────────────────────────────────────────────────────────────────────────────────────

/** Stand der Ausführung je Knoten — mit dem Stand der Aufgaben (gibt es sie, ist sie erledigt). Ohne Ausführung: `aktiv: false`. */
export async function ablaufAnsicht(w: Fall, heute: string, person: string): Promise<{ aktiv: boolean; knoten: Record<string, AblaufKnotenStand & { aufgabeStatus?: string }> }> {
  const st = ablaufStand(w, heute);
  if (!st.aktiv) return st;
  const ids = new Set(Object.values(st.knoten).map(k => k.aufgabe).filter((x): x is string => !!x));
  let tasks: { id: string; status: string; geloeschtAm?: string }[] = [];
  // Über die Sicht der Person (nie roh): ohne Papierkorb, „nur ich“ der anderen fehlt.
  try { tasks = ids.size ? (await (await import('@/lib/aufgaben/sicht')).ladeAufgabenSicht(person)).tasks.filter(t => ids.has(t.id)) : []; } catch { tasks = []; }
  const nach = new Map(tasks.map(t => [t.id, t]));
  return {
    aktiv: true,
    knoten: Object.fromEntries(Object.entries(st.knoten).map(([id, k]) => {
      const t = k.aufgabe ? nach.get(k.aufgabe) : undefined;
      const { aufgabe: _a, ...rest } = k;
      return [id, t && !t.geloeschtAm ? { ...rest, aufgabe: t.id, aufgabeStatus: t.status } : rest];
    })),
  };
}

/** Grundlage des Entwurfs einer Nachricht (Fall › Knoten „Nachricht“ bzw. Erinnerung mit Mail-Baustein) — gefüllt ohne KI; gesendet wird nur per Klick. */
export async function nachrichtGrundlage(u: Umfeld, w: Fall, m: Mandat, knotenId: string, person: string, heute: string): Promise<
  { ok: true; entwurf: { betreff: string; text: string; an: { email: string; name?: string } | null; gesellschaft: string } | null; gesperrt?: string; hinweis?: string; baustein?: { id: string; titel: string } }
  | { ok: false; status: 400 | 404; fehler: string }
> {
  const k = w.knoten.find(x => x.id === knotenId);
  if (!k) return { ok: false, status: 404, fehler: 'Diesen Schritt gibt es im Fall nicht (mehr).' };
  const b = mailBausteinVon(k, w.knoten, u.vorlagen);
  if (k.form !== 'nachricht' && !b) return { ok: false, status: 400, fehler: 'Zu diesem Schritt gibt es keine Nachricht.' };
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const em = nachrichtEmpfaenger(w, m, await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }));
  if (em.gesperrt) return { ok: true, entwurf: null, gesperrt: em.gesperrt };
  const { naechsterFallTermin } = await import('./rituale');
  const t = naechsterFallTermin({ fallRituale: w.rituale, terminTage: u.termine[m.id] ?? [], heute, rituale: u.vorlagen.rituale });
  const { vornameVon } = await import('@/lib/zoe/grundauftrag');
  const kk = em.kontakt;
  const mail = nachrichtEntwurf(b?.text, {
    anrede: kk?.anrede === 'Du' ? 'Du' : 'Sie', ...(kk?.vorname ? { vorname: kk.vorname } : {}), ...(kk?.nachname ? { nachname: kk.nachname } : {}),
    kunde: m.kunde, ...(t ? { termin: terminText(t) } : {}), absender: await vornameVon(person),
  }, titelOhneZusatz(k.titel));
  return {
    ok: true, entwurf: { ...mail, an: kk?.email ? { email: kk.email, ...(kk.vorname || kk.nachname ? { name: `${kk.vorname ?? ''} ${kk.nachname ?? ''}`.trim() } : {}) } : null, gesellschaft: m.gesellschaft },
    ...(kk ? {} : { hinweis: m.kontaktIds.length ? 'Keine Ansprechperson mit Mail-Adresse — bitte die Adresse eintragen.' : 'Am Mandat ist keine Ansprechperson eingetragen.' }),
    ...(b ? { baustein: { id: b.id, titel: b.titel } } : { hinweis: 'Ohne Mail-Baustein am Schritt — der Entwurf hat nur Gruß und Unterschrift. Einen Baustein hängt ihr im Ablauf an.' }),
  };
}

export type { CrmBestand };
