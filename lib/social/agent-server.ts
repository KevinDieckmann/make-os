// ─── MAKE OS — Social: Redaktions-Agent — der Lauf (Server) — 27.10.2026 ───────────────────────────────────────────────────────────
// Kevin 27.10.: „Es soll voll automatisiert laufen.“ Je Kanal mit eingeschaltetem Agenten (`plan.agent`) füllt der Lauf die freien Plätze
// des Redaktionsplans (plan.ts) mit Entwürfen — EIN Modellaufruf je Platz, ohne Werkzeuge (nur JSON). Danach entscheidet dieselbe Regel wie
// überall: Prüfer (pruefer.ts) + Leitplanken (autonomie.ts). Darf der Agent selbst (Stufe 2, freigegebenes Format, Prüfung sauber), wird
// der Entwurf eingeplant („geplant“) und der Veröffentlicher postet ihn zum Termin; sonst bleibt er „Entwurf“ und die zuständige Person
// bekommt EINE neutrale Glocke je Lauf.
//   · Wer: Takt (Systemlauf, `lauf: 'hintergrund'`) — Hintergrund-KI, Not-Aus/Budget des Head of Marketing (`laufSperre`) gelten; von Hand
//     („Jetzt Entwürfe schreiben“) als die auslösende Person (`lauf: 'aufruf'`), nur Kanäle, die sie sieht.
//   · Person des KI-Aufrufs: die auslösende Person, im Systemlauf die Person der Marke bzw. der Inhaber — nie ein fester Name.
//   · Ohne KI (kein Schlüssel, Guthaben leer, KI aus): nichts geschrieben, Grund im Lauf-Stand — nie ein Platzhalter-Text, der live ginge.
//   · Idempotent: der Schritt `entwurf` füllt jeden Platz höchstens einmal (zweiter Lauf, gleichzeitiger Knopf → nichts doppelt).

import { askText, extractJson, kiGesperrt, kiSperrText } from '@/lib/anthropic';
import { wandzeit } from '@/lib/kalender/zeit';
import { inhaberSpeicher, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { ladeSocial, socialSystemSchreiben } from './server';
import { kanalSichtbar, folgeAus } from './daten';
import { planLuecken, planVon } from './plan';
import { REDAKTION_SYSTEM, REDAKTION_SCHEMA, redaktionAuftrag, entwurfAus } from './agent';
import { folgePruefen, kanalPruefen } from './pruefer';
import { autonomieFuer } from './autonomie';
import { kanalAnalyse } from './analyse';
import { laufVermerken } from './lauf-stand';
import type { SocialDatei, SocialFormat, SocialKanal } from './typen';

/** Höchstens so viele Entwürfe je Lauf (alle Kanäle) — Kosten und Last bleiben klein, der nächste Lauf macht weiter. */
export const REDAKTION_MAX = 6;

export interface RedaktionErgebnis {
  geschrieben: { kanalId: string; folgeId: string; platz: string; geplant: boolean }[];
  uebersprungen: { kanalId: string; grund: string }[];
  gestoppt?: string;
}

let laeuft = false;
export const redaktionLaeuft = () => laeuft;

export async function socialRedaktionLauf(opt: { person: string | null; kanalId?: string; max?: number; jetzt?: Date } = { person: null }): Promise<RedaktionErgebnis> {
  const erg: RedaktionErgebnis = { geschrieben: [], uebersprungen: [] };
  if (laeuft) return { ...erg, gestoppt: 'Ein Lauf schreibt gerade — gleich noch einmal.' };
  laeuft = true;
  const jetzt = opt.jetzt ?? new Date();
  const max = Math.max(1, Math.min(opt.max ?? REDAKTION_MAX, REDAKTION_MAX));
  try {
    const { laufSperre } = await import('@/lib/agenten/einstellung');
    const sperre = await laufSperre(opt.person, 'marketing', jetzt);
    if (sperre) return { ...erg, gestoppt: sperre.text };
    let d = await ladeSocial();
    const inhaber = await inhaberSpeicher().catch(() => null);
    const kanaele = d.kanaele.filter(k => !k.archiviertAm && k.status === 'aktiv'
      && (opt.kanalId ? k.id === opt.kanalId : planVon(k).agent)
      && (!opt.person || kanalSichtbar(k, opt.person)));
    const jetztWand = wandzeit(jetzt).slice(0, 16);
    const stapel = new Map<string, number>();
    outer: for (const k of kanaele) {
      const luecken = planLuecken(k, d.formate, d.folgen, jetztWand);
      if (!luecken.length) { erg.uebersprungen.push({ kanalId: k.id, grund: 'Alle Termine im Plan sind belegt.' }); continue; }
      const analyse = kanalAnalyse(d.folgen, k.id, { formatName: id => d.formate.find(f => f.id === id)?.name ?? id });
      for (const l of luecken) {
        if (erg.geschrieben.length >= max) break outer;
        const format = l.formatId ? d.formate.find(f => f.id === l.formatId) ?? null : null;
        const kiPerson = opt.person ?? k.person ?? inhaber;
        const r = await askText({
          system: REDAKTION_SYSTEM, systemStabil: REDAKTION_SYSTEM, cacheSystem: true, user: redaktionAuftrag(k, l, format, d.folgen, analyse),
          schema: REDAKTION_SCHEMA as unknown as Record<string, unknown>, maxTokens: 2500, zweck: 'social-redaktion', timeoutMs: 90_000, retries: 1,
          // Nur eigene Daten des Haushalts (Markenprofil, Formate, eigene Zahlen) — Bereich Markttraktion.
          ki: { lauf: opt.person ? 'aufruf' : 'hintergrund', person: kiPerson, kategorien: ['crm'] },
        });
        if (!r.ok) {
          const grund = kiGesperrt(r) ? kiSperrText(r) : r.error === 'no-key' ? 'Kein KI-Schlüssel in dieser Instanz — der Agent schreibt nichts.' : r.error === 'guthaben-leer' ? 'KI-Guthaben leer.' : `Modell: ${(r.error ?? 'nicht erreichbar').slice(0, 120)}`;
          if (r.error === 'no-key' || r.error === 'guthaben-leer' || kiGesperrt(r)) { erg.gestoppt = grund; break outer; }
          erg.uebersprungen.push({ kanalId: k.id, grund });
          continue;
        }
        const eintrag = entwurfAus(extractJson<Record<string, unknown>>(r.text), k, l, format?.art);
        if (!eintrag) { erg.uebersprungen.push({ kanalId: k.id, grund: 'Antwort ohne verwertbaren Entwurf.' }); continue; }
        const geplant = darfEinplanen(k, eintrag, format, d, l.platz);
        const w = await socialSystemSchreiben([{ op: 'entwurf', kanalId: k.id, platz: l.platz, eintrag: { ...eintrag, status: geplant ? 'geplant' : 'entwurf' } }], jetzt);
        if (!w.ok) { erg.uebersprungen.push({ kanalId: k.id, grund: w.fehler }); continue; }
        const folgeId = w.geaendert[0];
        if (!folgeId) continue; // Platz war inzwischen belegt
        erg.geschrieben.push({ kanalId: k.id, folgeId, platz: l.platz, geplant });
        // Der nächste Entwurf wird gegen den gerade geschriebenen geprüft (Wiederholung, Säulen) — nie nur gegen den Stand vom Laufbeginn.
        d = w.datei;
        if (!geplant) stapel.set(k.id, (stapel.get(k.id) ?? 0) + 1);
      }
    }
    await glocken(stapel, kanaele, opt.person, inhaber);
    return erg;
  } finally {
    laeuft = false;
    await laufVermerken('redaktion', { am: jetzt.toISOString(), von: opt.person ?? 'takt', geschrieben: erg.geschrieben.length, eingeplant: erg.geschrieben.filter(g => g.geplant).length, gestoppt: erg.gestoppt, uebersprungen: erg.uebersprungen.slice(0, 20) }).catch(() => {});
  }
}

/** Würde der Agent diesen Entwurf selbst posten? Dieselbe Prüfung wie die Lage (nur mit einer Probe-Folge). */
function darfEinplanen(k: SocialKanal, eintrag: Record<string, unknown>, format: SocialFormat | null, d: SocialDatei, platz: string): boolean {
  const probe = folgeAus({ ...eintrag, id: 'sv-probe', kanalId: k.id, status: 'entwurf', hooks: (eintrag.hooks as object[]).map((h, i) => ({ ...h, id: `hk-probe${i}` })), geplantAm: platz.slice(0, 10), geaendert: '' });
  if (!probe) return false;
  const befunde = folgePruefen(probe, { kanal: k, format, andere: d.folgen });
  return autonomieFuer(probe, { kanal: k, format, befunde, kanalBefunde: kanalPruefen(k), heutePosts: 0 }).weg === 'selbst';
}

/** EINE neutrale Glocke je Kanal mit wartenden Entwürfen — an die Person der Marke, sonst an alle Konten des Haushalts. */
async function glocken(stapel: Map<string, number>, kanaele: readonly SocialKanal[], von: string | null, inhaber: string | null): Promise<void> {
  if (!stapel.size) return;
  const h = await haushaltDesInhabers().catch(() => null);
  const konten = h ? (await kontenDesHaushalts(h).catch(() => [])).map(k => k.speicher) : inhaber ? [inhaber] : [];
  for (const [kanalId, n] of stapel) {
    const k = kanaele.find(x => x.id === kanalId);
    if (!k) continue;
    const an = k.sichtbarkeit === 'person' && k.person ? [k.person] : k.art === 'person' && k.person ? [k.person] : konten;
    for (const p of an) {
      await melde({ an: p, art: 'agenten', titel: `Social: ${n === 1 ? 'ein neuer Entwurf wartet' : `${n} neue Entwürfe warten`} auf euren Blick`, link: WEG.marketing('social'), von: von ?? 'zoe' });
    }
  }
}
