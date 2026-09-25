// ─── Ein Lauf eines Heads ──────────────────────────────────────────────────
// 1. Kartei + Bestand laden → volles Datenpaket (Code rechnet alles; dazu
//    Grundlauf, Lernstand, Gedächtnis, Team, Übergaben — lib/heads/paket.ts).
// 2. Takt-Läufe ohne Arbeit (keine Karten, keine Events) → ohne Modell „ruhig“.
// 3. Grundlauf: Vorschläge aus Regeln (lib/heads/grundlauf.ts). Ohne Modell
//    (kein Schlüssel, Guthaben leer, Ausfall) ist er das Ergebnis — der Head
//    liefert immer, gekennzeichnet als „Regelwerk“.
// 4. Mit Modell: System (gecacht) + <daten> vor <aufgabe>, JSON-Schema. Das
//    Modell übernimmt, verwirft (mit Grund) oder ergänzt den Grundlauf und
//    schreibt die Entwürfe (Evaluator-Optimizer).
// 5. Prüfer: streicht Unzulässiges, prüft Zahlen, Vollzug und Qualität; bei
//    Befunden genau eine Korrekturrunde. Danach: dringende Grundlauf-Vorschläge,
//    die das Modell weder übernommen noch begründet verworfen hat, kommen
//    zurück; ein Entwurf, der noch falsch anredet, fliegt raus.
// 6. „fuer“ je Vorschlag (wer es tun soll), Rangfolge nach Priorität und Frist.
// 7. Bericht + Freigabe-Liste speichern. Nichts wird versendet.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { askText, extractJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { SYSTEM, SCHEMA, aufgabe, datenBlock, AGENT_ID, HEAD_NAME, MODI, REVIEW_MODI, type HeadId } from './prompt';
import { vollesPaket, fuerWen } from './paket';
import { grundlauf } from './grundlauf';
import { normalisiere, pruefe, korrekturAuftrag, qualitaet, type Antwort, type Pruefung, type Vorschlag } from './pruefer';
import { leererStand, standName, mischen, type HeadStand, type HeadBericht, type HeadVorschlag } from './stand';
import { automatisch, aufgabeAus, OHNE_AUTO_MODI } from './autonomie';
import { belege } from './belege';
import { BEIDE } from '@/lib/crm/team';
import { MODEL_BY_TIER } from '@/lib/agent-config';

/** Gespeicherte Fälle für Evals (lib/heads/eval.ts, /api/heads/eval). */
export interface ReplayFall { zeit: string; modus: string; person: string; heute: string; quelle: 'ki' | 'regelwerk'; modell: string; daten: Record<string, unknown>; roh: Antwort }
export interface ReplayStand { faelle: ReplayFall[] }

export interface HeadAuftrag { head: HeadId; modus: string; person: string; frage?: string; ausgeloest: HeadBericht['ausgeloest'] }
/** Modi, die das Regelwerk allein trägt (kein Modell nötig). */
const NUR_REGELWERK = new Set(['netzwerk']);

export interface HeadErgebnis { ok: boolean; fehler?: string; bericht?: HeadBericht; ohneKi?: boolean; ruhigText?: string; neu?: number; /** So viele interne Kleinigkeiten hat der Head selbst übernommen. */ auto?: number }

const RANG = { hoch: 0, mittel: 1, niedrig: 2 } as const;
/** Riegel je Modus — die Power Hour je Person, damit Kevins und Malins Vorbereitung sich nicht sperren. */
export const riegel = (modus: string, person: string) => (modus === 'power_hour' ? `${modus}:${person}` : modus);

/** Dringendes aus dem Grundlauf, das das Modell weder übernommen noch begründet verworfen hat, kommt zurück. */
export function pflichtZurueck(ki: Antwort, grund: Vorschlag[], max = 6): Vorschlag[] {
  const da = new Set(ki.vorschlaege.map(v => v.dedup_schluessel));
  const verworfen = new Set((ki.verworfen ?? []).map(w => w.dedup_schluessel));
  const zurueck = grund.filter(g => g.prioritaet === 'hoch' && !da.has(g.dedup_schluessel) && !verworfen.has(g.dedup_schluessel)).map(g => ({ ...g, herkunft: 'regelwerk' as const }));
  return [...ki.vorschlaege.map(v => ({ ...v, herkunft: v.herkunft ?? ('ki' as const) })), ...zurueck].slice(0, max);
}

export async function headLauf(a: HeadAuftrag): Promise<HeadErgebnis> {
  if (!MODI[a.head].some(m => m.id === a.modus)) return { ok: false, fehler: `Unbekannter Modus ${a.modus}.` };
  const start = Date.now();
  const jetzt = new Date().toISOString();
  const name = standName(a.head);
  const r = riegel(a.modus, a.person);
  const alt = { ...leererStand(), ...((await loadJson<HeadStand>(name)) ?? {}) };
  if (a.ausgeloest === 'takt') {
    const vorher = alt.letzte[r], versuch = alt.versuche[r];
    if (vorher && Date.now() - Date.parse(vorher) < 20 * 60_000) return { ok: true, ohneKi: true, ruhigText: 'Lief eben schon.' };
    if (versuch && Date.now() - Date.parse(versuch) < 10 * 60_000 && (!vorher || Date.parse(vorher) < Date.parse(versuch))) return { ok: true, ohneKi: true, ruhigText: 'Läuft gerade schon.' };
  }
  const agent = await resolveAgent(AGENT_ID[a.head]);
  if (!agent.enabled) return { ok: false, fehler: `${HEAD_NAME[a.head]} ist ausgeschaltet (unter Agenten aktivierbar).` };
  await updateJson<HeadStand>(name, s => ({ ...leererStand(), ...(s ?? {}), versuche: { ...(s?.versuche ?? {}), [r]: jetzt } }));

  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const heute = localDay();
  const daten = vollesPaket(a.head, a.modus, kontakte, crm, heute, a.person, alt) as Record<string, unknown>;

  // Nichts zu tun → ohne Modell.
  const leer = a.head === 'sales' && a.modus === 'power_hour' ? !(daten.karten as unknown[]).length
    : a.head === 'event' && a.modus !== 'frage' ? !(daten.events as unknown[]).length : false;
  if (leer && a.modus !== 'frage') {
    const ruhigText = a.head === 'event' ? 'Ruhig — kein Event angelegt.' : 'Ruhig — heute ist niemand dran.';
    await updateJson<HeadStand>(name, s => ({ ...leererStand(), ...(s ?? {}), letzte: { ...(s?.letzte ?? {}), [r]: jetzt }, ruhig: { zeit: jetzt, text: ruhigText } }));
    return { ok: true, ohneKi: true, ruhigText };
  }

  const g = a.modus === 'frage' ? null : grundlauf(a.head, a.modus, daten);
  let antwort: Antwort; let pruefung: Pruefung; let korrigiert = false;
  const art: { quelle: 'ki' | 'regelwerk'; ohneKiGrund?: string; modell?: string; roh?: Antwort } = { quelle: 'ki' };
  // Verbrauch dieses Laufs (beide Aufrufe) — zeigt auch, ob der Prompt-Cache greift.
  const verbrauch = { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0, aufrufe: 0, requestIds: [] as string[] };
  const zaehle = (r: { usage?: { ein: number; aus: number; cacheLesen: number; cacheSchreiben: number }; requestId?: string }) => {
    if (r.usage) { verbrauch.ein += r.usage.ein; verbrauch.aus += r.usage.aus; verbrauch.cacheLesen += r.usage.cacheLesen; verbrauch.cacheSchreiben += r.usage.cacheSchreiben; verbrauch.aufrufe++; }
    if (r.requestId) verbrauch.requestIds.push(r.requestId);
  };

  const regelwerk = (grund: string) => {
    const p = pruefe({ ...g!.antwort, vorschlaege: g!.antwort.vorschlaege.map(v => ({ ...v, herkunft: 'regelwerk' as const })) }, daten, kontakte, crm, heute);
    antwort = { ...p.antwort, zusammenfassung: `${p.antwort.zusammenfassung} (ohne KI: ${grund})` };
    pruefung = p.pruefung; art.quelle = 'regelwerk'; art.ohneKiGrund = grund; art.roh = g!.antwort;
  };

  // Netzwerk ist reine Planung aus Zahlen — das Regelwerk genügt, kein Modellaufruf.
  const kiMoeglich = hasAnthropicKey() && !NUR_REGELWERK.has(a.modus);
  if (!kiMoeglich && !g) return { ok: false, fehler: 'Fragen beantwortet der Head nur mit KI — kein Anthropic-Schlüssel hinterlegt.' };
  if (!kiMoeglich) regelwerk(NUR_REGELWERK.has(a.modus) ? 'Planung aus Zahlen' : 'kein Anthropic-Schlüssel');
  else {
    // Kevin 25.09.: stark für Reviews, sonst ausgewogen — ANTHROPIC_MODEL übersteuert alles.
    const review = REVIEW_MODI.has(a.modus);
    const modell = process.env.ANTHROPIC_MODEL ?? (review ? MODEL_BY_TIER.stark : agent.model);
    art.modell = modell;
    const daten_ = datenBlock(daten);
    const aufg = aufgabe(a.modus, a.frage);
    // Zwei Cache-Punkte: System (stabil) und das Datenpaket — so trifft die Korrekturrunde den Cache.
    const erste = [{ role: 'user', content: [{ type: 'text', text: daten_, cache_control: { type: 'ephemeral' } }, { type: 'text', text: aufg }] }];
    const ruf = (messages: unknown[], zweck: string) => askText({ system: SYSTEM[a.head], user: '', messages, model: modell, effort: review ? 'high' : 'medium', schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, maxTokens: review ? 16000 : 10000, timeoutMs: 200_000, zweck });
    const r1 = await ruf(erste, `${AGENT_ID[a.head]}-${a.modus}`);
    zaehle(r1);
    const roh1 = r1.ok ? normalisiere(extractJson(r1.text), a.head) : null;
    if (!r1.ok || !roh1 || (!roh1.zusammenfassung && !roh1.antwort)) {
      const grund = !r1.ok ? fehlerGrund(r1.status, r1.error ?? '') : r1.stopReason === 'max_tokens' ? 'Antwort abgeschnitten (max_tokens)' : 'Antwort ohne verwertbares JSON';
      if (!g) return { ok: false, fehler: grund };
      regelwerk(grund);
    } else {
      let roh = roh1;
      art.roh = roh1;
      ({ antwort, pruefung } = pruefe(roh, daten, kontakte, crm, heute));
      if (pruefung.unbelegt.length || pruefung.verstoesse.length || pruefung.maengel?.length) {
        const r2 = await ruf([...erste, { role: 'assistant', content: r1.text }, { role: 'user', content: korrekturAuftrag(pruefung) }], `${AGENT_ID[a.head]}-korrektur`);
        zaehle(r2);
        const neu = r2.ok ? extractJson(r2.text) : null;
        if (neu) {
          roh = normalisiere(neu, a.head);
          const p2 = pruefe(roh, daten, kontakte, crm, heute);
          const fehler = (p: Pruefung) => p.unbelegt.length + p.verstoesse.length * 5 + (p.maengel?.length ?? 0);
          if (roh.zusammenfassung && fehler(p2.pruefung) <= fehler(pruefung)) { antwort = p2.antwort; pruefung = { ...p2.pruefung, gestrichen: [...pruefung.gestrichen, ...p2.pruefung.gestrichen] }; korrigiert = true; }
        }
      }
      if (g) antwort = { ...antwort, vorschlaege: pflichtZurueck(antwort, pruefe(g.antwort, daten, kontakte, crm, heute).antwort.vorschlaege) };
    }
  }

  // Entwürfe, die nach der Korrektur noch falsch anreden oder Platzhalter tragen, fliegen raus — der Vorschlag bleibt.
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  antwort = { ...antwort!, vorschlaege: antwort!.vorschlaege.map(v => {
    const q = qualitaet(v, v.kontakt_id ? nachId.get(v.kontakt_id) : undefined, heute);
    const entwurf = q.entwurfUnbrauchbar ? null : v.entwurf;
    const b = belege(daten, v.quelle);
    return { ...v, entwurf, fuer: v.fuer ?? fuerWen(v, a.head, nachId, crm, a.person), belege: b.belege, ...(q.maengel.length || b.insLeere.length ? { maengel: [...q.maengel, ...(q.entwurfUnbrauchbar ? ['Entwurf entfernt'] : []), ...(b.insLeere.length ? [`Quelle ins Leere: ${b.insLeere.join(', ')}`] : [])] } : { maengel: undefined }) };
  }).sort((x, y) => RANG[x.prioritaet] - RANG[y.prioritaet] || (x.frist ?? '9999').localeCompare(y.frist ?? '9999')) };

  const bericht: HeadBericht = { id: `hb-${Date.now().toString(36)}`, zeit: jetzt, modus: a.modus, ausgeloest: a.ausgeloest, person: a.person, ...(a.frage ? { frage: a.frage.slice(0, 500) } : {}), antwort, pruefung: { ...pruefung!, korrigiert }, modell: art.quelle === 'ki' ? art.modell ?? agent.model : 'regelwerk', dauer_ms: Date.now() - start, ...(verbrauch.aufrufe ? { verbrauch } : {}), quelle: art.quelle, ...(art.ohneKiGrund ? { ohneKiGrund: art.ohneKiGrund } : {}) };
  let neu = 0;
  await updateJson<HeadStand>(name, s => {
    const st = { ...leererStand(), ...(s ?? {}) };
    const m = a.ausgeloest === 'jarvis' ? { liste: st.vorschlaege, neu: 0 } : mischen(st.vorschlaege, antwort.vorschlaege, bericht.id, jetzt, a.modus);
    neu = m.neu;
    return { ...st, berichte: [...st.berichte, bericht].slice(-30), vorschlaege: m.liste, letzte: { ...st.letzte, [r]: jetzt } };
  });
  // Fall für Evals ablegen (nur .data, nie im Repo): Datenpaket + erste, ungeprüfte Antwort.
  if (art.roh && a.modus !== 'frage') await updateJson<ReplayStand>(`heads-replay-${a.head}`, s => ({ faelle: [...(s?.faelle ?? []), { zeit: jetzt, modus: a.modus, person: a.person, heute, quelle: art.quelle, modell: bericht.modell, daten, roh: art.roh! }].slice(-25) }));

  // Interne Kleinigkeiten selbst (Kevin 25.09.) — nie bei Jarvis-Fragen, nie wenn ausgeschaltet.
  const auto = a.ausgeloest === 'jarvis' || OHNE_AUTO_MODI.has(a.modus) ? 0 : await autoUebernehmen(a.head, bericht.id, a.person, jetzt);
  await logRun(AGENT_ID[a.head], `${MODI[a.head].find(m => m.id === a.modus)?.label} · ${antwort.status}${art.quelle === 'regelwerk' ? ' · Regelwerk' : ''}`, { vorschlaege: antwort.vorschlaege.map(v => v.titel), gestrichen: pruefung!.gestrichen.length, unbelegt: pruefung!.unbelegt.length, quelle: art.quelle });
  return { ok: true, bericht, neu, ...(auto ? { auto } : {}) };
}

/** Fehlerbild nach Status statt Textsuche (Anthropic-Doku „errors“). */
export function fehlerGrund(status: number, text: string): string {
  if (status === 402 || (status === 400 && /credit|balance|billing/i.test(text))) return 'Guthaben aufgebraucht';
  if (status === 400 && /spend|limit/i.test(text)) return 'Ausgabenlimit erreicht';
  if (status === 429) return 'Rate- oder Ausgabenlimit (429)';
  if (status === 529 || status >= 500) return 'Anthropic überlastet — KI-Lauf später erneut';
  if (status === 401 || status === 403) return 'Schlüssel ungültig';
  if (status === 0) return `nicht erreichbar (${text.slice(0, 60)})`;
  return `Modellfehler ${status} (${text.slice(0, 60)})`;
}

/** Offene Vorschläge dieses Berichts, die intern bleiben, selbst übernehmen — mit Rücknahme-Angabe. */
async function autoUebernehmen(head: HeadId, berichtId: string, person: string, jetzt: string): Promise<number> {
  const name = standName(head);
  const st = { ...leererStand(), ...((await loadJson<HeadStand>(name)) ?? {}) };
  if (st.autonomie === 'aus') return 0;
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const plan = st.vorschlaege.filter(v => v.berichtId === berichtId && v.status === 'offen').map(v => ({ v, w: automatisch(v, v.kontakt_id ? nachId.get(v.kontakt_id) : undefined) })).filter((x): x is { v: HeadVorschlag; w: 'schritt' | 'aufgabe' } => !!x.w);
  if (!plan.length) return 0;
  const erledigt = new Map<string, HeadVorschlag['auto']>();
  const schritte = plan.filter(p => p.w === 'schritt');
  if (schritte.length) {
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
      const f = cur ?? { kontakte: [] };
      return { ...f, kontakte: f.kontakte.map(k => {
        const p = schritte.find(x => x.v.kontakt_id === k.id);
        // Nie überschreiben: steht inzwischen ein nächster Schritt da, bleibt der Vorschlag zur Freigabe.
        if (!p || k.naechsterSchritt || k.werbesperre || !p.v.frist) return k;
        erledigt.set(p.v.id, { am: jetzt, wirkung: `nächster Schritt an ${k.vorname} ${k.nachname}`.trim(), rueckgaengig: { art: 'schritt', kontaktId: k.id, vorher: null } });
        return { ...k, naechsterSchritt: { text: p.v.titel.slice(0, 300), datum: p.v.frist }, geaendertAm: jetzt.slice(0, 10) };
      }) };
    });
  }
  const aufgaben = plan.filter(p => p.w === 'aufgabe');
  if (aufgaben.length) {
    await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      const tasks = [...(f.tasks ?? [])];
      for (const { v } of aufgaben) {
        const bearbeiter = !v.fuer || v.fuer === BEIDE ? person : v.fuer;
        const t = aufgabeAus(v, HEAD_NAME[head], AGENT_ID[head], bearbeiter, jetzt);
        if (!tasks.some(x => x.id === t.id)) tasks.push(t);
        erledigt.set(v.id, { am: jetzt, wirkung: `Aufgabe für ${bearbeiter.charAt(0).toUpperCase() + bearbeiter.slice(1)}`, rueckgaengig: { art: 'aufgabe', aufgabeId: String(t.id) } });
      }
      return { ...f, tasks };
    });
  }
  if (!erledigt.size) return 0;
  await updateJson<HeadStand>(name, s => {
    const x = { ...leererStand(), ...(s ?? {}) };
    return { ...x, vorschlaege: x.vorschlaege.map(v => (erledigt.has(v.id) && v.status === 'offen' ? { ...v, status: 'angenommen' as const, entschieden: jetzt, aktualisiert: jetzt, von: 'auto', auto: erledigt.get(v.id) } : v)) };
  });
  return erledigt.size;
}
