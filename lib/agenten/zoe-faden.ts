// ─── ZOE auf Threads (09.10., Paket 4a; AGENTEN_KONZEPT.md C8 „ZoePanel und Empfang laufen auf Threads“, A12) ───────────────
// Das ZOE-Gespräch ist jetzt ein Thread der Person (`agenten-faeden--<person>`, Agent `zoe`) — ZoePanel, Empfang und die
// Agenten-Seite zeigen DENSELBEN Thread (den jüngsten ZOE-Thread der Person), und der Prompt liest den Verlauf NUR vom Server.
// Damit stehen „fremd gelesen“ und „vertraulich“ am Thread (vorher hingen sie an Angaben aus dem Browser, A12).
//
//   zoeFadenFuer         eigenen ZOE-Thread holen bzw. neu anlegen (`'neu'`), die neue Nachricht der Person anhängen
//   zoeAntwortAnhaengen  Antwort von ZOE anhängen (KI-Marke, gelaufene Werkzeuge) und die Marken des Zugs übernehmen
//   zoeVerlaufUebernehmen  EINMALIGE Übernahme des alten Bestands `zoe-verlauf` (beim ersten Lesen, idempotent, der alte Bestand
//                        bleibt liegen). Altbestand ohne Person gehört dem Inhaber der Instanz (Erstkonto) — nie ein fester Name.
//   zoeKanalZug          Frage + Antwort aus Telegram/WhatsApp in den Thread des Kanals für den Tag (statt in `zoe-verlauf`).

import { fremd } from '@/lib/anthropic';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { loadJson } from '@/lib/store/local-db';
import { FREMD_AGENTEN, FREMD_WERKZEUGE } from '@/lib/zoe/fremd';
import { verlaufFremd, verlaufVertraulich } from '@/lib/zoe/gespraech-schutz';
import { GRENZEN, type AgentRef, type Bereich } from './typen';
import { anhaengen, fadenHinzu, fehler, fuerPrompt, istFadenId, textAbdruck, titelAus, zugLaeuft, ZUG_LAEUFT, type Fehler, type FadenKern, type NachrichtKern, type PromptNachricht } from './faeden';
import { bestandAendern, bestandLesen, fadenAendern } from './faeden-server';

export const ZOE: AgentRef = { art: 'zoe' };
const iso = () => new Date().toISOString();
const quelleVon = (n: string) => FREMD_WERKZEUGE[n] ?? FREMD_AGENTEN[n] ?? null;

/** Eine Nachricht der Person bzw. von ZOE (Thread-Form). */
const personNachricht = (person: string, text: string, zeit: string): NachrichtKern => ({ id: neueKennung('nr'), rolle: 'person', von: person, text, zeit });
/**
 * Eine Antwort von ZOE im Thread. `kostenCent` (09.10. „Agenten live“): gemessene Kosten des Zugs in US-Cent (wie `ki-verbrauch`) — die Oberfläche
 * zeigt sie in Euro an der Antwort, wie bei Heads und Mitarbeitern (vorher stand an ZOEs Antworten keine Zahl).
 */
const zoeNachricht = (text: string, zeit: string, o: { ki?: boolean; werkzeuge?: NachrichtKern['werkzeuge']; kostenCent?: number } = {}): NachrichtKern => ({
  id: neueKennung('nr'), rolle: 'agent', von: 'zoe', text, zeit, ...(o.ki ? { ki: true as const } : {}), ...(o.werkzeuge?.length ? { werkzeuge: o.werkzeuge } : {}),
  ...(o.kostenCent && o.kostenCent > 0 ? { kosten: { cent: Math.round(o.kostenCent * 100) / 100 } } : {}),
});

/** Text auf die Thread-Grenze — darüber 413 im Schreibweg (nie gekürzt); hier nur für Altbestand/Kanal, der schon begrenzt war. */
const grenze = (t: string) => t.slice(0, GRENZEN.nachrichtZeichen);

// ── Gespräch (kimmi) ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ZoeZug {
  faden: FadenKern;
  /** Der Verlauf fürs Modell — aus dem gespeicherten Thread, inklusive der neuen Nachricht. */
  prompt: PromptNachricht[];
  /** Gab es vor dieser Nachricht schon Züge? */
  fortsetzung: boolean;
  /** Die eben angehängte Nachricht der Person — bei einem abgebrochenen Strom geht sie wieder heraus (faeden.ts `zugZuruecknehmen`). */
  nachrichtId: string;
}

/**
 * Den ZOE-Thread der Person für diesen Zug: `wunsch` = Kennung eines EIGENEN ZOE-Threads oder `'neu'`. Die neue Nachricht der Person
 * wird zuerst angehängt (was ZOE im Zug an den Thread schreibt — „An Head … gesendet“ — steht dann dahinter). Ist der Thread voll
 * (400 Nachrichten), entsteht eine Fortsetzung — nie gekürzt.
 */
export async function zoeFadenFuer(person: string, wunsch: unknown, text: string, o: { bereich: Bereich }): Promise<ZoeZug | Fehler> {
  const jetzt = iso();
  const n = personNachricht(person, text, jetzt);
  const neu = async (titel: string): Promise<ZoeZug | Fehler> => {
    const f0: FadenKern = { id: neueKennung('fd'), besitzer: person, agent: ZOE, bereich: o.bereich, titel: titelAus(titel), status: 'offen', fremdGelesen: false, vertraulich: false, nachrichten: [], erstellt: jetzt, aktualisiert: jetzt, gelesenAm: jetzt, kette: ['zoe'] };
    const x = anhaengen(f0, [n], jetzt);
    if (!x.ok) return x;
    const r = await bestandAendern<FadenKern>(person, b => { const y = fadenHinzu(b, x.faden); return y.ok ? { bestand: y.bestand, e: x.faden } : y; });
    if (!r.ok) return r;
    return { faden: r.e, prompt: fuerPrompt(r.e, ZOE, fremd), fortsetzung: false, nachrichtId: n.id };
  };
  if (wunsch === 'neu') return neu(text);
  if (!istFadenId(wunsch)) return fehler(400, 'Thread-Kennung ungültig.');
  let voll = false;
  const r = await fadenAendern(person, wunsch, f => {
    if (f.agent.art !== 'zoe' || f.besitzer !== person) return fehler(404, 'Diesen ZOE-Thread gibt es nicht.');
    // Ein Zug je Thread (Härtetest 09.10.): steht die letzte Nachricht der Person noch unbeantwortet da, läuft ihr Zug gerade (zweiter Tab,
    // Doppelklick) — sonst liefen zwei Züge über denselben Verlauf und die Antworten überkreuzten sich. Nach `ZUG_SPERRE_MS` gilt sie als
    // liegen geblieben (Neustart mitten im Zug) und sperrt nicht mehr.
    if (zugLaeuft(f, Date.parse(jetzt))) return fehler(409, ZUG_LAEUFT);
    const x = anhaengen(f, [n], jetzt);
    if (!x.ok) { voll = x.status === 413; return x; }
    return { ...x.faden, status: 'offen', gelesenAm: jetzt };
  });
  if (!r.ok) return voll ? neu(`Fortsetzung: ${text}`) : r;
  return { faden: r.faden, prompt: fuerPrompt(r.faden, ZOE, fremd), fortsetzung: r.faden.nachrichten.length > 1, nachrichtId: n.id };
}

/** Die Antwort von ZOE anhängen und die Marken des Zugs („fremd gelesen“, „vertraulich“) am Thread festhalten — nur ODER, nie zurück. */
export async function zoeAntwortAnhaengen(person: string, fadenId: string, text: string, o: { ki: boolean; werkzeuge?: NachrichtKern['werkzeuge']; fremdGelesen: boolean; vertraulich: boolean; kostenCent?: number }): Promise<FadenKern | null> {
  const jetzt = iso();
  const r = await fadenAendern(person, fadenId, f => {
    const x = anhaengen(f, [zoeNachricht(grenze(text), jetzt, o)], jetzt);
    return x.ok ? { ...x.faden, fremdGelesen: f.fremdGelesen || o.fremdGelesen, vertraulich: f.vertraulich || o.vertraulich, gelesenAm: jetzt } : x;
  });
  return r.ok ? r.faden : null;
}

/**
 * Ein Hinweis der Software in den ZOE-Thread (Härtetest 09.10.): der Zug brach ab bzw. scheiterte, NACHDEM schon Werkzeuge gewirkt hatten — die
 * Frage bleibt dann stehen, und der Thread sagt, was passiert ist (nie still, nie eine erfundene Antwort). Marken nur ODER.
 */
export async function zoeHinweisAnhaengen(person: string, fadenId: string, text: string, o: { fremdGelesen: boolean; vertraulich: boolean; werkzeuge?: NachrichtKern['werkzeuge'] }): Promise<boolean> {
  const jetzt = iso();
  const r = await fadenAendern(person, fadenId, f => {
    const x = anhaengen(f, [{ id: neueKennung('nr'), rolle: 'system', von: 'system', text: grenze(text), zeit: jetzt, ...(o.werkzeuge?.length ? { werkzeuge: o.werkzeuge } : {}) }], jetzt);
    return x.ok ? { ...x.faden, fremdGelesen: f.fremdGelesen || o.fremdGelesen, vertraulich: f.vertraulich || o.vertraulich } : x;
  });
  return r.ok;
}

/** Ein EIGENER ZOE-Thread (für Werkzeuge im Zug: an_head hängt „gesendet“ an). */
export async function eigenerZoeFaden(person: string, id: unknown): Promise<FadenKern | null> {
  if (!istFadenId(id)) return null;
  const f = (await bestandLesen(person)).faeden.find(x => x.id === id);
  return f && f.agent.art === 'zoe' && f.besitzer === person ? f : null;
}

// ── Übernahme des alten Verlaufs (einmalig) ─────────────────────────────────────────────────────────────────────────────

interface AltNachricht { rolle?: string; text?: string; zeit?: string; ran?: { agent?: string; ok?: boolean }[] }
interface AltGespraech { id?: string; begonnen?: string; zuletzt?: string; titel?: string; nachrichten?: AltNachricht[]; person?: string }

/** Kennung des Threads, der aus einem alten Gespräch entsteht — fest (zweimal übernehmen legt nichts doppelt an). */
export const uebernahmeId = (gespraechId: string): string => `fd-zv-${textAbdruck(gespraechId)}`;

/** Ein altes Gespräch als ZOE-Thread (rein). Rollen: `zoe` → ZOE, alles andere (`nutzer`, Altbestand) → die Person. */
export function fadenAusGespraech(g: AltGespraech, person: string, jetzt: string): FadenKern | null {
  const nachrichten = (Array.isArray(g.nachrichten) ? g.nachrichten : []).filter(n => typeof n?.text === 'string' && n.text.trim()).slice(-GRENZEN.fadenNachrichten);
  if (!g.id || !nachrichten.length) return null;
  const zeitVon = (z: unknown) => (typeof z === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(z) ? z : jetzt);
  const ns: NachrichtKern[] = nachrichten.map(n => n.rolle === 'zoe'
    ? zoeNachricht(grenze(String(n.text)), zeitVon(n.zeit), { ki: true, werkzeuge: (n.ran ?? []).filter(r => typeof r?.agent === 'string').map(r => ({ name: String(r.agent).slice(0, 40), ok: !!r.ok })) })
    : personNachricht(person, grenze(String(n.text)), zeitVon(n.zeit)));
  const erstellt = zeitVon(g.begonnen ?? ns[0].zeit);
  const f0: FadenKern = {
    id: uebernahmeId(String(g.id)), besitzer: person, agent: ZOE, bereich: 'privat', titel: titelAus(String(g.titel ?? '') || ns[0].text), status: 'offen',
    fremdGelesen: verlaufFremd(nachrichten, quelleVon), vertraulich: verlaufVertraulich(nachrichten, quelleVon),
    nachrichten: [], erstellt, aktualisiert: erstellt, gelesenAm: zeitVon(g.zuletzt ?? jetzt), kette: ['zoe'],
  };
  const x = anhaengen(f0, ns, zeitVon(g.zuletzt ?? ns[ns.length - 1].zeit));
  return x.ok ? x.faden : null;
}

/**
 * Einmal je Person: die alten ZOE-Gespräche (`zoe-verlauf`) werden ZOE-Threads. Läuft beim ersten Lesen der Threads (GET
 * /api/agenten/faden) und vor dem ersten ZOE-Zug auf Threads — danach nie wieder (Marke `zoeUebernahme` im Bestand der Person).
 * Altbestand ohne Person gehört dem Inhaber der Instanz (wie bisher das Erstkonto). Der alte Bestand bleibt unverändert liegen.
 */
export async function zoeVerlaufUebernehmen(person: string): Promise<number> {
  const b = await bestandLesen(person);
  if (b.zoeUebernahme) return 0;
  const [v, { inhaberSpeicher }] = await Promise.all([loadJson<{ gespraeche?: AltGespraech[] }>('zoe-verlauf'), import('@/lib/zugang/haushalt-inhaber')]);
  const alt = await inhaberSpeicher();
  const meine = (Array.isArray(v?.gespraeche) ? v!.gespraeche : []).filter(g => (g?.person ?? alt) === person);
  const jetzt = iso();
  const r = await bestandAendern<number>(person, best => {
    if (best.zoeUebernahme) return { bestand: best, e: 0 };
    let neu = best, n = 0;
    for (const g of meine) {
      const f = fadenAusGespraech(g, person, jetzt);
      if (!f || neu.faeden.some(x => x.id === f.id)) continue;
      const y = fadenHinzu(neu, f);
      if (y.ok) { neu = y.bestand; n++; }
    }
    return { bestand: { ...neu, zoeUebernahme: { am: jetzt, anzahl: n } }, e: n };
  });
  return r.ok ? r.e : 0;
}

// ── Telegram / WhatsApp ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Frage und Antwort aus einem Kanal (Telegram, WhatsApp) in den ZOE-Thread des Kanals für diesen Tag — dort liest die Person die
 * Antwort (über den Kanal geht nur ein neutraler Hinweis). Text kam von außen: der Thread gilt als „fremd gelesen“.
 */
export async function zoeKanalZug(person: string, kanal: 'telegram' | 'whatsapp', frage: string, antwort: string, jetzt = new Date()): Promise<string> {
  const id = `fd-${kanal === 'telegram' ? 'tg' : 'wa'}-${localDay(jetzt)}`;
  const zeit = jetzt.toISOString();
  const neu = [personNachricht(person, grenze(frage), zeit), zoeNachricht(grenze(antwort), zeit, { ki: true })];
  const r = await bestandAendern<string>(person, b => {
    const f = b.faeden.find(x => x.id === id);
    if (f) {
      const x = anhaengen(f, neu, zeit);
      if (!x.ok) return x;
      return { bestand: { ...b, faeden: b.faeden.map(y => (y.id === id ? { ...x.faden, fremdGelesen: true } : y)) }, e: id };
    }
    const f0: FadenKern = { id, besitzer: person, agent: ZOE, bereich: 'privat', titel: titelAus(`${kanal === 'telegram' ? 'Telegram' : 'WhatsApp'} · ${frage}`), status: 'offen', fremdGelesen: true, vertraulich: false, nachrichten: [], erstellt: zeit, aktualisiert: zeit, kette: ['zoe'] };
    const x = anhaengen(f0, neu, zeit);
    if (!x.ok) return x;
    const y = fadenHinzu(b, x.faden);
    return y.ok ? { bestand: y.bestand, e: id } : y;
  });
  return r.ok ? r.e : id;
}
