// ─── Agenten-Bereich: Threads der Person (09.10., Paket 1 „Kern“) ──────────────────────────────────────────────────────────────
// GET `?id=` → `FadenAntwort` (eigener oder geteilter Business-Thread, den die Person sieht), `?gedaechtnis=<agent>` → eigene
// persönliche Merksätze dieses Agenten, sonst `FadenListeAntwort` (`?agent=head:<id>` filtert). POST `FadenAnfrage` (+ Kern-Aktionen):
// ZOE-Threads (Agent `zoe`, Paket 4a) stehen hier mit in der Liste (`?agent=zoe`); geschrieben werden sie über /api/kimmi (`zoeFaden`).
//   senden          Head-/Mitarbeiter-Chat synchron (Modell; `modellSchranke`) bzw. mit `hintergrund: true` als Lauf — mit
//                   `Accept: text/event-stream` als Strom (09.10.: Text-Stücke, Werkzeug-Stände, am Ende `ende` = die JSON-Antwort;
//                   lib/http/sse.ts). Alle Prüfungen davor antworten wie bisher mit JSON und Status.
//   umbenennen · gelesen · loeschen · teilen (nur Business, nur Besitzer) · plan (Plan-Freigabe per Klick) · abbrechen ·
//   zweite-meinung (zwei Entwürfe, der Prüfer wählt) · gedaechtnis-weg (persönlichen Merksatz löschen)
//   bewerten (Paket 4b: Daumen an einer Agenten-Antwort bzw. einem Bericht — nur die Besitzerin, nur Metadaten)
// Paket 4b: Not-Aus (für alle bzw. je Head), ausgeschalteter Head und erreichtes Head-Budget sperren Senden an Heads/Mitarbeiter und die
// zweite Meinung (409, ruhiger Satz; lib/agenten/einstellung.ts `laufSperre`). Offene Plan-Freigaben stehen zusätzlich im Stapel (Art `plan`).
// Verlauf NUR aus dem Bestand `agenten-faeden--<person>` (nie vom Browser), Stand → 409, Grenzen → 413, `jsonBegrenzt`, `bauPruefen`
// (über `eigenePerson(req, true)`). Nur die Person selbst (Dienstweg 403), keine Personen-Parameter.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { modellSchranke } from '@/lib/zugang/umfang';
import { einmalig } from '@/lib/store/anfragen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { innenAdresse } from '@/lib/innen';
import { AGENTEN_NUR_SELBST, type FadenAntwort, type FadenListeAntwort } from '@/lib/agenten/typen';
import { headDef } from '@/lib/agenten/katalog';
import { bestandAendern, bestandLesen, fadenAendern, sichtbareFaeden, sichtLaden } from '@/lib/agenten/faeden-server';
import { fadenStand, istFadenId, kurz, merksatzWeg, passtAgent, textPruefen, titelAus, type FadenKern } from '@/lib/agenten/faeden';
import { headSichtbar, teilenErlaubt, type KontoSicht } from '@/lib/agenten/sicht';
import { senden, type SendenAnfrage } from '@/lib/agenten/gespraech';
import { zoeVerlaufUebernehmen } from '@/lib/agenten/zoe-faden';
import { willStrom } from '@/lib/http/sse';
import { sseAntwort, type StromArbeit } from '@/lib/http/sse-antwort';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, error: fehler, ...extra }, { status });
const AGENT_SCHLUESSEL = /^(zoe|head:[a-z0-9-]{1,40}|mitarbeiter:[a-z0-9-]{1,40}:[a-z0-9-]{1,80})$/;

/** Lese-Protokoll für Threads mit Daten aus Gesundheit, Finanzen oder der Kartei (nie Inhalte). */
function protokoll(req: Request, f: FadenKern) {
  if (f.agent.art === 'zoe') return;
  const h = headDef(f.agent.headId);
  if (!h) return;
  if (h.kategorien.includes('gesundheit') || h.kategorienMitEinwilligung?.includes('gesundheit')) leseZugriff(req, 'gesundheit', { betroffen: f.besitzer });
  if (h.kategorien.includes('finanzen')) leseZugriff(req, h.bereich === 'privat' ? 'haushalt' : 'finanzplan');
  if (h.kategorien.includes('crm')) leseZugriff(req, 'kontakte');
}

/**
 * Paket 4b: Not-Aus, ausgeschalteter Head, Head-Budget — gesperrt ist das Senden an einen Head bzw. Mitarbeiter (der Agent aus der Anfrage
 * oder aus dem eigenen Thread). ZOE regelt Paket 4a. 409 mit ruhigem Satz und dem Grund, nie ein Fehler.
 */
async function sperreFuerSenden(person: string, body: Record<string, unknown>): Promise<NextResponse | null> {
  let headId: string | null = null;
  const agent = body.agent && typeof body.agent === 'object' ? body.agent as Record<string, unknown> : null;
  if (agent && (agent.art === 'head' || agent.art === 'mitarbeiter') && typeof agent.headId === 'string') headId = agent.headId;
  else if (istFadenId(body.fadenId)) {
    const f = (await bestandLesen(person)).faeden.find(x => x.id === body.fadenId);
    if (f && f.agent.art !== 'zoe') headId = f.agent.headId;
  }
  if (!headId || !headDef(headId)) return null;
  const { laufSperre } = await import('@/lib/agenten/einstellung');
  const s = await laufSperre(person, headId).catch(() => null);
  return s ? nein(409, s.text, { gesperrt: s.grund, hinweis: s.text }) : null;
}

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const sicht = await sichtLaden(z.person);
  // Erststart (Paket 4a): der alte ZOE-Verlauf wird beim ersten Lesen EINMAL zu ZOE-Threads der Person (lib/agenten/zoe-faden.ts,
  // idempotent, Marke im Bestand; der alte Bestand bleibt liegen) — begründete Ausnahme von „Lesen schreibt nicht“.
  if (sicht.imHaushalt) await zoeVerlaufUebernehmen(z.person).catch(() => 0);
  const id = q.get('id');
  if (id) {
    if (!istFadenId(id)) return nein(400, 'Thread-Kennung ungültig.');
    const alle = await sichtbareFaeden(sicht);
    const f = alle.find(x => x.id === id);
    if (!f) return nein(404, 'Diesen Thread gibt es nicht.');
    protokoll(req, f);
    const kinder = alle.filter(x => x.elternId === f.id).map(x => kurz(x, z.person));
    return NextResponse.json({ ok: true, faden: f, stand: fadenStand(f), kinder } satisfies FadenAntwort, { headers: { 'Cache-Control': 'no-store' } });
  }
  const g = q.get('gedaechtnis');
  if (g) {
    if (!AGENT_SCHLUESSEL.test(g)) return nein(400, 'Agent ungültig.');
    const teile = g.split(':');
    if (teile[0] !== 'zoe' && !headSichtbar(sicht, teile[1])) return nein(403, 'Diesen Head siehst du nicht.');
    const b = await bestandLesen(z.person);
    return NextResponse.json({ ok: true, gedaechtnis: b.gedaechtnis?.[g] ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const filter = q.get('agent');
  if (filter && !AGENT_SCHLUESSEL.test(filter)) return nein(400, 'Filter ungültig.');
  const faeden = (await sichtbareFaeden(sicht)).filter(f => passtAgent(f, filter)).sort((a, b) => b.aktualisiert.localeCompare(a.aktualisiert));
  return NextResponse.json({ ok: true, faeden: faeden.map(f => kurz(f, z.person)) } satisfies FadenListeAntwort, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let body: Record<string, unknown>;
  try { body = await jsonBegrenzt(req, 256_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  if (!body || typeof body !== 'object') return nein(400, 'Kein gültiges JSON.');
  const person = z.person;
  const aktion = String(body.aktion ?? '');
  const fadenId = body.fadenId;
  const stand = typeof body.stand === 'string' ? body.stand : undefined;
  const sicht: KontoSicht = await sichtLaden(person);
  const ergebnis = (r: { ok: true; faden: FadenKern; stand: string } | { ok: false; status: number; fehler: string; aktuell?: FadenKern }) =>
    (r.ok ? NextResponse.json({ ok: true, faden: r.faden, stand: r.stand }) : nein(r.status, r.fehler, r.aktuell ? { faden: r.aktuell, stand: fadenStand(r.aktuell) } : {}));

  if (aktion === 'senden') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const gesperrt = await sperreFuerSenden(person, body);
    if (gesperrt) return gesperrt;
    // Derselbe Weg mit und ohne Streaming — `strom` reicht nur Stücke und den Abbruch des Browsers durch (gespeichert wird das Endergebnis).
    const arbeit = async (strom?: StromArbeit) => {
      const a = await einmalig('agenten-faden', body.anfrageId, async () => {
        const r = await senden({ sicht, anfrage: body as unknown as SendenAnfrage, origin: innenAdresse(req), ...(strom ? { strom: { ereignis: strom.sende, signal: strom.signal } } : {}) });
        return { status: r.status, body: r.body };
      });
      // Offene Plan-Freigaben des Threads auch in den Stapel (Art `plan`, idempotent) — ein Fehler hält die Antwort nie auf.
      const fid = (a.body as { faden?: { id?: unknown } } | null)?.faden?.id;
      if (a.status === 200 && istFadenId(fid)) await import('@/lib/agenten/plan-stapel').then(m => m.planStapeln(person, fid)).catch(() => 0);
      return a;
    };
    // Streaming (09.10.): nur, wenn der Browser es will und der Chat synchron antwortet (eine Hintergrundaufgabe hat nichts zu zeigen).
    if (willStrom(req) && body.hintergrund !== true) return sseAntwort(req, arbeit);
    const a = await arbeit();
    return NextResponse.json(a.body, { status: a.status });
  }
  if (aktion === 'zweite-meinung') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    if (!istFadenId(fadenId)) return nein(400, 'Thread-Kennung ungültig.');
    const gesperrt = await sperreFuerSenden(person, { fadenId });
    if (gesperrt) return gesperrt;
    const { zweiteMeinung } = await import('@/lib/agenten/delegation');
    const r = await zweiteMeinung({ person, sicht, fadenId, origin: innenAdresse(req) });
    return r.ok ? NextResponse.json({ ok: true, faden: r.faden, stand: fadenStand(r.faden), antwort: r.antwort }) : nein(r.status, r.fehler);
  }
  if (aktion === 'gedaechtnis-weg') {
    const agent = String(body.agent ?? ''), id = String(body.id ?? '');
    if (!AGENT_SCHLUESSEL.test(agent) || !/^ms-[a-z0-9-]{8,60}$/.test(id)) return nein(400, 'Merksatz ungültig.');
    const r = await bestandAendern(person, b => { const x = merksatzWeg(b, agent, id); return x.ok ? { bestand: x.bestand, e: true } : x; });
    return r.ok ? NextResponse.json({ ok: true, gedaechtnis: r.bestand.gedaechtnis?.[agent] ?? [] }) : nein(r.status, r.fehler);
  }

  if (!istFadenId(fadenId)) return nein(400, 'Thread-Kennung ungültig.');
  const eigen = (await bestandLesen(person)).faeden.find(f => f.id === fadenId);
  if (!eigen) return nein(404, 'Diesen Thread gibt es nicht (oder er gehört dir nicht).');
  const jetzt = new Date().toISOString();
  switch (aktion) {
    case 'umbenennen': {
      const t = textPruefen(body.titel, 120, 'Titel');
      if (!t.ok) return nein(t.status, t.fehler);
      return ergebnis(await fadenAendern(person, fadenId, f => ({ ...f, titel: titelAus(t.text) }), { stand }));
    }
    case 'gelesen':
      return ergebnis(await fadenAendern(person, fadenId, f => ({ ...f, gelesenAm: jetzt })));
    case 'teilen': {
      if (!teilenErlaubt(eigen, person)) return nein(403, 'Teilen gibt es nur für eigene Business-Threads.');
      // Geteilt (bzw. zurückgenommen) wird der Thread samt seiner Mitarbeiter-Threads — ein Gespräch, eine Sichtbarkeit.
      const geteilt = body.geteilt === true ? { am: jetzt, von: person } : null;
      const r = await bestandAendern<FadenKern>(person, b => {
        const f = b.faeden.find(x => x.id === fadenId);
        if (!f) return { ok: false, status: 404, fehler: 'Diesen Thread gibt es nicht (mehr).' };
        if (stand !== undefined && fadenStand(f) !== stand) return { ok: false, status: 409, fehler: 'Der Thread hat sich inzwischen geändert — bitte neu laden.' };
        const faeden = b.faeden.map(x => (x.id === fadenId || x.elternId === fadenId ? { ...x, geteilt } : x));
        return { bestand: { ...b, faeden }, e: faeden.find(x => x.id === fadenId)! };
      });
      return r.ok ? NextResponse.json({ ok: true, faden: r.e, stand: fadenStand(r.e) }) : nein(r.status, r.fehler);
    }
    case 'abbrechen': {
      if (!eigen.lauf || (eigen.lauf.status !== 'wartet' && eigen.lauf.status !== 'laeuft')) return nein(409, 'Hier läuft nichts.');
      return ergebnis(await fadenAendern(person, fadenId, f => ({ ...f, status: 'abgebrochen', lauf: { ...f.lauf!, status: 'abgebrochen', ende: jetzt, abgebrochenVon: person } })));
    }
    case 'plan': {
      const entscheidung = body.entscheidung === 'freigeben' ? 'freigeben' : body.entscheidung === 'ablehnen' ? 'ablehnen' : null;
      if (!entscheidung || typeof body.planId !== 'string') return nein(400, 'Plan und Entscheidung (freigeben | ablehnen) fehlen.');
      const { planEntscheiden } = await import('@/lib/agenten/delegation');
      const r = await planEntscheiden({ person, fadenId, planId: body.planId, entscheidung, ...(stand !== undefined ? { stand } : {}) });
      if (r.ok) await import('@/lib/agenten/plan-stapel').then(m => m.planStapelErledigen(person, fadenId, body.planId as string, entscheidung)).catch(() => {});
      return r.ok ? NextResponse.json({ ok: true, faden: r.faden, stand: fadenStand(r.faden), gestartet: r.gestartet }) : nein(r.status, r.fehler);
    }
    case 'loeschen': {
      if (stand === undefined) return nein(400, 'Stand fehlt.');
      let geloescht = new Set<string>();
      const r = await bestandAendern<boolean>(person, b => {
        const f = b.faeden.find(x => x.id === fadenId);
        if (!f) return { ok: false, status: 404, fehler: 'Diesen Thread gibt es nicht (mehr).' };
        if (fadenStand(f) !== stand) return { ok: false, status: 409, fehler: 'Der Thread hat sich inzwischen geändert — bitte neu laden.' };
        // Der Thread samt ALLEN Threads darunter (ein Gespräch: ZOE → Head → Mitarbeiter); laufende Läufe zuerst abbrechen.
        // Durchstich 09.10.: vorher gingen nur die direkten Kinder — beim Löschen eines ZOE-Gesprächs blieben die Mitarbeiter-Threads der Heads
        // verwaist stehen, und ihre wartenden Läufe liefen (und kosteten) trotzdem.
        const weg = new Set([f.id]);
        for (let neu = true; neu;) { neu = false; for (const x of b.faeden) if (x.elternId && weg.has(x.elternId) && !weg.has(x.id)) { weg.add(x.id); neu = true; } }
        if (b.faeden.some(x => weg.has(x.id) && x.lauf?.status === 'laeuft')) return { ok: false, status: 409, fehler: 'Ein Lauf in diesem Thread läuft noch — erst abbrechen.' };
        geloescht = weg;
        return { bestand: { ...b, faeden: b.faeden.filter(x => !weg.has(x.id)) }, e: true };
      });
      // Wartende Läufe dieser Threads verlassen die Warteschlange (sie fänden ihren Thread nicht mehr).
      if (r.ok && geloescht.size) {
        const { abbrechenWo } = await import('@/lib/zoe/auftraege');
        const { LAUF_AGENT } = await import('@/lib/agenten/typen');
        const ids = geloescht;
        await abbrechenWo(a => a.name === LAUF_AGENT && a.person === person && typeof a.eingabe?.fadenId === 'string' && ids.has(a.eingabe.fadenId), 'Thread gelöscht.').catch(() => []);
        // Offene Plan-Freigaben dieser Threads im Stapel entfallen (sonst blieben sie offen und ließen sich nie mehr freigeben).
        try {
          const { lies, entscheide } = await import('@/lib/zoe/stapel');
          const { planAusBezug } = await import('@/lib/agenten/plan-stapel');
          for (const v of await lies('offen')) {
            const b = v.bezug?.art === 'plan' ? planAusBezug(v.bezug.id) : null;
            if (b && v.person === person && ids.has(b.fadenId)) await entscheide(v.id, 'fehlgeschlagen', { ergebnis: 'Thread gelöscht — der Plan entfällt.', von: person });
          }
        } catch { /* der Thread ist gelöscht — ein offener Plan-Eintrag lässt sich noch ablehnen */ }
      }
      return r.ok ? NextResponse.json({ ok: true, geloescht: fadenId }) : nein(r.status, r.fehler);
    }
    case 'bewerten': {
      // Paket 4b: Daumen an einer Agenten-Antwort bzw. einem Bericht — nur Metadaten (Wert, Zeit, optional ein Grund aus der festen Liste).
      const wert = body.wert === 'hoch' || body.wert === 'runter' ? body.wert : body.wert === null ? null : undefined;
      const nachrichtId = typeof body.nachrichtId === 'string' ? body.nachrichtId : '';
      if (wert === undefined || !nachrichtId) return nein(400, 'Bewertung: Nachricht und Daumen (hoch | runter | null) fehlen.');
      const { ABLEHNGRUENDE } = await import('@/lib/heads/lernen');
      const grund = body.grund === undefined || body.grund === null ? undefined : String(body.grund);
      if (grund !== undefined && (wert !== 'runter' || !ABLEHNGRUENDE.some(g => g.id === grund))) return nein(400, 'Grund nur beim Daumen runter und nur aus der Liste.');
      const { daumenSetzen } = await import('@/lib/agenten/leistung');
      return ergebnis(await fadenAendern(person, fadenId, f => {
        const i = f.nachrichten.findIndex(n => n.id === nachrichtId);
        if (i < 0) return { ok: false, status: 404, fehler: 'Diese Nachricht gibt es in dem Thread nicht.' };
        const n = daumenSetzen(f.nachrichten[i], wert ? { wert, am: jetzt, ...(grund ? { grund } : {}) } : null);
        if (!n) return { ok: false, status: 400, fehler: 'Bewerten lassen sich nur Antworten von Agenten und Berichte.' };
        return { ...f, nachrichten: f.nachrichten.map((x, j) => (j === i ? n : x)) };
      }));
    }
    default:
      return nein(400, `Unbekannte Aktion „${aktion.slice(0, 40)}“.`);
  }
}
