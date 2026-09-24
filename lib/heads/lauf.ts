// ─── Ein Lauf eines Heads ──────────────────────────────────────────────────
// 1. Kartei + CRM laden → Datenpaket (Code rechnet alles).
// 2. Takt-Läufe ohne Arbeit (keine Karten, keine Events) → ohne Modell „ruhig“.
// 3. Modell mit System (gecacht) + <daten> vor <aufgabe>, JSON-Schema.
// 4. Prüfer: streicht, was nicht zulässig ist; bei unbelegten Zahlen oder
//    Vollzug genau eine Korrekturrunde.
// 5. Bericht + Freigabe-Liste speichern. Nichts wird versendet.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { askText, extractJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { SYSTEM, SCHEMA, aufgabe, AGENT_ID, HEAD_NAME, MODI, type HeadId } from './prompt';
import { datenpaket } from './daten';
import { normalisiere, pruefe, korrekturAuftrag } from './pruefer';
import { leererStand, standName, mischen, type HeadStand, type HeadBericht } from './stand';

export interface HeadAuftrag { head: HeadId; modus: string; person: string; frage?: string; ausgeloest: HeadBericht['ausgeloest'] }
export interface HeadErgebnis { ok: boolean; fehler?: string; bericht?: HeadBericht; ohneKi?: boolean; ruhigText?: string; neu?: number }

export async function headLauf(a: HeadAuftrag): Promise<HeadErgebnis> {
  if (!MODI[a.head].some(m => m.id === a.modus)) return { ok: false, fehler: `Unbekannter Modus ${a.modus}.` };
  const start = Date.now();
  const jetzt = new Date().toISOString();
  const name = standName(a.head);
  const alt = { ...leererStand(), ...((await loadJson<HeadStand>(name)) ?? {}) };
  if (a.ausgeloest === 'takt') {
    const vorher = alt.letzte[a.modus], versuch = alt.versuche[a.modus];
    if (vorher && Date.now() - Date.parse(vorher) < 20 * 60_000) return { ok: true, ohneKi: true, ruhigText: 'Lief eben schon.' };
    if (versuch && Date.now() - Date.parse(versuch) < 10 * 60_000 && (!vorher || Date.parse(vorher) < Date.parse(versuch))) return { ok: true, ohneKi: true, ruhigText: 'Läuft gerade schon.' };
  }
  await updateJson<HeadStand>(name, s => ({ ...leererStand(), ...(s ?? {}), versuche: { ...(s?.versuche ?? {}), [a.modus]: jetzt } }));

  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const heute = localDay();
  const daten = datenpaket(a.head, a.modus, kontakte, crm, heute, a.person, alt.vorschlaege.filter(v => v.status !== 'erledigt').map(v => ({ titel: v.titel, status: v.status })));

  // Nichts zu tun → ohne Modell.
  const leer = a.head === 'sales' && a.modus === 'power_hour' ? !(daten as { karten: unknown[] }).karten.length
    : a.head === 'event' && a.modus !== 'frage' ? !(daten as { events: unknown[] }).events.length : false;
  if (leer && a.modus !== 'frage') {
    const ruhigText = a.head === 'event' ? 'Ruhig — kein Event angelegt.' : 'Ruhig — heute ist niemand dran.';
    await updateJson<HeadStand>(name, s => ({ ...leererStand(), ...(s ?? {}), letzte: { ...(s?.letzte ?? {}), [a.modus]: jetzt }, ruhig: { zeit: jetzt, text: ruhigText } }));
    return { ok: true, ohneKi: true, ruhigText };
  }

  if (!hasAnthropicKey()) return { ok: false, fehler: 'Kein Anthropic-Key hinterlegt.' };
  const agent = await resolveAgent(AGENT_ID[a.head]);
  if (!agent.enabled) return { ok: false, fehler: `${HEAD_NAME[a.head]} ist ausgeschaltet (unter Agenten aktivierbar).` };

  const user = `<daten>\n${JSON.stringify(daten, null, 1)}\n</daten>\n\n${aufgabe(a.modus, a.frage)}`;
  const r1 = await askText({ system: SYSTEM[a.head], user, model: agent.model, schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, maxTokens: 8000, timeoutMs: 170_000, zweck: `${AGENT_ID[a.head]}-${a.modus}` });
  if (!r1.ok) return { ok: false, fehler: r1.error ?? 'Modell nicht erreichbar.' };
  let roh = normalisiere(extractJson(r1.text), a.head);
  if (!roh.zusammenfassung && !roh.antwort) return { ok: false, fehler: 'Antwort ohne verwertbares JSON.' };
  let { antwort, pruefung } = pruefe(roh, daten, kontakte, crm);
  let korrigiert = false;
  if (pruefung.unbelegt.length || pruefung.verstoesse.length) {
    const r2 = await askText({ system: SYSTEM[a.head], user: '', messages: [{ role: 'user', content: user }, { role: 'assistant', content: r1.text }, { role: 'user', content: korrekturAuftrag(pruefung) }], model: agent.model, schema: SCHEMA as unknown as Record<string, unknown>, cacheSystem: true, maxTokens: 8000, timeoutMs: 170_000, zweck: `${AGENT_ID[a.head]}-korrektur` });
    const neu = r2.ok ? extractJson(r2.text) : null;
    if (neu) {
      roh = normalisiere(neu, a.head);
      const p2 = pruefe(roh, daten, kontakte, crm);
      const fehler = (p: typeof pruefung) => p.unbelegt.length + p.verstoesse.length * 5;
      if (roh.zusammenfassung && fehler(p2.pruefung) <= fehler(pruefung)) { antwort = p2.antwort; pruefung = { ...p2.pruefung, gestrichen: [...pruefung.gestrichen, ...p2.pruefung.gestrichen] }; korrigiert = true; }
    }
  }

  const bericht: HeadBericht = { id: `hb-${Date.now().toString(36)}`, zeit: jetzt, modus: a.modus, ausgeloest: a.ausgeloest, person: a.person, ...(a.frage ? { frage: a.frage.slice(0, 500) } : {}), antwort, pruefung: { ...pruefung, korrigiert }, modell: agent.model, dauer_ms: Date.now() - start };
  let neu = 0;
  await updateJson<HeadStand>(name, s => {
    const st = { ...leererStand(), ...(s ?? {}) };
    const m = a.ausgeloest === 'jarvis' ? { liste: st.vorschlaege, neu: 0 } : mischen(st.vorschlaege, antwort.vorschlaege, bericht.id, jetzt);
    neu = m.neu;
    return { ...st, berichte: [...st.berichte, bericht].slice(-30), vorschlaege: m.liste, letzte: { ...st.letzte, [a.modus]: jetzt } };
  });
  await logRun(AGENT_ID[a.head], `${MODI[a.head].find(m => m.id === a.modus)?.label} · ${antwort.status}`, { vorschlaege: antwort.vorschlaege.map(v => v.titel), gestrichen: pruefung.gestrichen.length, unbelegt: pruefung.unbelegt.length });
  return { ok: true, bericht, neu };
}
