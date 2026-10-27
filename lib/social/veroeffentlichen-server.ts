// ─── MAKE OS — Social: der Veröffentlicher und die Zahlen (Server) — 27.10.2026 ────────────────────────────────────────────────────
// Kevin 26.10.: Stufe 2 „selbstständig mit Leitplanken“ — die ausdrückliche Ausnahme von der Eisernen Regel 3 für dieses Modul (SOCIAL_PLAN.md),
// die erst mit einer echten Plattform-Verbindung greift. Hier geht es hinaus, und NUR so:
//   1. Je Folge und Plattform entscheidet `postPlan` (veroeffentlichen.ts) — dieselbe Regel, die die Oberfläche zeigt; die Leitplanken
//      fragt sie bei `autonomieFuer` (Prüfer, Stufe, Not-Aus, Format-Freigabe, Tageslimit).
//   2. Not-Aus bzw. „Head aus“ des Head of Marketing hält alles an (`headAngehalten`, fail-closed).
//   3. Vor dem Senden belegt der Schritt `post-start` die Plattform (in der Sperre des Bestands) — ein zweiter Lauf bekommt 409 und lässt es.
//   4. Antwort fehlt (Zeitüberschreitung) → „unklar“: NIE automatisch wiederholen, eine Person sieht bei der Plattform nach und löst es.
//   5. Zugang abgelehnt → Verbindung „getrennt“ + EINE Glocke. Läuft ein Token in 7 Tagen ab → EINE Glocke „neu verbinden“.
// Zahlen (`socialMessenLauf`, einmal am Tag): für automatisch veröffentlichte Beiträge der letzten 30 Tage, wenn der Anbieter sie herausgibt
// (LinkedIn als Person: nein — dann weiter CSV-Import). Nie geschätzt.

import { wandzeit } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { melde } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import { ladeSocial, socialSystemSchreiben } from './server';
import { folgePruefen, kanalPruefen } from './pruefer';
import { autonomieFuer } from './autonomie';
import { postPlan } from './veroeffentlichen';
import { terminVon } from './plan';
import { ladeVerbindungen, aktiveVerbindung, verbindungTrennen, verbindungVermerken, type SocialVerbindung } from './verbindungen';
import { anbieterFuer } from './anbieter';
import { postText, type PostErgebnis } from './anbieter/typen';
import { laufVermerken } from './lauf-stand';
import type { SocialDatei, SocialFolge, SocialKanal, SocialPlattform } from './typen';
import { PLATTFORM_NAME } from './typen';

let laeuft = false;

async function hausKonten(): Promise<string[]> {
  const h = await haushaltDesInhabers().catch(() => null);
  return h ? (await kontenDesHaushalts(h).catch(() => [])).map(k => k.speicher) : [];
}
const empfaenger = async (k: SocialKanal): Promise<string[]> => (k.art === 'person' && k.person ? [k.person] : k.sichtbarkeit === 'person' && k.person ? [k.person] : hausKonten());

/** Heute (Berliner Tag) schon veröffentlicht in diesem Kanal — ohne die Folge selbst (mehrere Plattformen derselben Folge zählen einmal). */
const heutePosts = (d: SocialDatei, kanalId: string, heute: string, ohne: string) =>
  d.folgen.filter(f => f.kanalId === kanalId && f.id !== ohne && f.veroeffentlicht.some(v => v.am === heute)).length;

export interface VeroeffentlichenErgebnis { gepostet: { folgeId: string; plattform: SocialPlattform }[]; fehler: { folgeId: string; plattform: SocialPlattform; text: string }[]; gestoppt?: string }

export async function socialVeroeffentlichenLauf(jetzt = new Date()): Promise<VeroeffentlichenErgebnis> {
  const erg: VeroeffentlichenErgebnis = { gepostet: [], fehler: [] };
  if (laeuft) return erg;
  laeuft = true;
  try {
    const verbindungen = await ladeVerbindungen();
    await ablaufErinnern(verbindungen, jetzt).catch(() => {});
    if (!verbindungen.some(v => v.zustand === 'aktiv')) return erg;
    const { headAngehalten } = await import('@/lib/agenten/einstellung');
    const halt = await headAngehalten('marketing', { haushalt: await haushaltDesInhabers() });
    if (halt) return { ...erg, gestoppt: halt.text };
    const d = await ladeSocial();
    const heute = localDay(jetzt);
    const jetztWand = wandzeit(jetzt).slice(0, 16);
    for (const f of d.folgen) {
      const k = d.kanaele.find(x => x.id === f.kanalId);
      if (!k || !['geplant', 'freigegeben', 'veroeffentlicht'].includes(f.status)) continue;
      const termin = terminVon(f, k);
      if (!termin || termin > jetztWand) continue;
      const format = f.formatId ? d.formate.find(x => x.id === f.formatId) ?? null : null;
      const schritte = await planFuer(f, k, format, d, verbindungen, heute, jetztWand);
      for (const s of schritte.filter(x => x.zustand === 'faellig')) {
        const v = aktiveVerbindung(verbindungen, k.id, s.plattform)!;
        const a = await anbieterFuer(v.anbieter, s.plattform);
        if (!a || !v.geheim) continue;
        const start = await socialSystemSchreiben([{ op: 'post-start', folgeId: f.id, plattform: s.plattform }], jetzt);
        if (!start.ok) continue; // ein anderer Lauf ist schneller, oder die Folge ist weg
        const r: PostErgebnis = await a.posten(v.geheim, { kanal: k, folge: f, format, text: postText(f) }).catch((): PostErgebnis => ({ ok: false, unklar: true, text: 'Unerwarteter Fehler beim Senden.' }));
        if (r.ok) {
          await socialSystemSchreiben([{ op: 'post-ok', folgeId: f.id, plattform: s.plattform, externeId: r.externeId, link: r.link }], jetzt);
          erg.gepostet.push({ folgeId: f.id, plattform: s.plattform });
        } else {
          await socialSystemSchreiben([{ op: 'post-fehler', folgeId: f.id, plattform: s.plattform, text: r.text, unklar: r.unklar === true }], jetzt);
          erg.fehler.push({ folgeId: f.id, plattform: s.plattform, text: r.text });
          if (r.erneuern) await verbindungTrennen(v.id, r.text, jetzt.toISOString());
          for (const p of await empfaenger(k)) {
            await melde({ an: p, art: 'verbindung', titel: r.erneuern ? `Social: Verbindung zu ${PLATTFORM_NAME[s.plattform]} erneuern` : `Social: ein Beitrag auf ${PLATTFORM_NAME[s.plattform]} ging nicht raus`, link: WEG.marketing('social'), von: 'zoe' });
          }
        }
      }
    }
    return erg;
  } finally {
    laeuft = false;
    if (erg.gepostet.length || erg.fehler.length || erg.gestoppt) await laufVermerken('veroeffentlichen', { am: jetzt.toISOString(), gepostet: erg.gepostet.length, fehler: erg.fehler.length, gestoppt: erg.gestoppt }).catch(() => {});
  }
}

/** Der Plan einer Folge (Server): Prüfer → Leitplanken → `postPlan` mit den Verbindungen. Auch für die Lage. */
export async function planFuer(f: SocialFolge, k: SocialKanal, format: SocialDatei['formate'][number] | null, d: SocialDatei, verbindungen: readonly SocialVerbindung[], heute: string, jetztWand: string) {
  const befunde = folgePruefen(f, { kanal: k, format, andere: d.folgen });
  const weg = autonomieFuer(f.status === 'veroeffentlicht' ? { ...f, status: 'geplant' } : f, { kanal: k, format, befunde, kanalBefunde: kanalPruefen(k), heutePosts: heutePosts(d, k.id, heute, f.id) });
  const kann = new Map<SocialPlattform, { kann: { ok: true } | { ok: false; grund: string } } | null>();
  for (const p of k.plattformen) {
    const v = aktiveVerbindung(verbindungen, k.id, p);
    const a = v ? await anbieterFuer(v.anbieter, p) : null;
    kann.set(p, v && a ? { kann: a.kann(f, format) } : null);
  }
  return postPlan(f, { termin: terminVon(f, k), jetzt: jetztWand, weg, plattformen: k.plattformen, verbindung: p => kann.get(p) ?? null });
}

/** EINE Glocke, wenn ein Token in 7 Tagen abläuft (LinkedIn: 60 Tage, kein Refresh) — je Token einmal. */
async function ablaufErinnern(l: readonly SocialVerbindung[], jetzt: Date): Promise<void> {
  const d = await ladeSocial();
  for (const v of l) {
    const ab = v.geheim?.ablauf;
    if (v.zustand !== 'aktiv' || !ab || v.erinnertAblauf === ab || ab - jetzt.getTime() > 7 * 86_400_000) continue;
    const k = d.kanaele.find(x => x.id === v.kanalId);
    await verbindungVermerken(v.id, { erinnertAblauf: ab });
    const an = k?.art === 'person' && k.person ? [k.person] : [v.verbundenVon];
    for (const p of an) await melde({ an: p, art: 'verbindung', titel: `Social: Verbindung zu ${PLATTFORM_NAME[v.plattform]} bald neu bestätigen`, link: WEG.marketing('social'), von: 'zoe' });
  }
}

/** Zahlen automatisch veröffentlichter Beiträge holen (einmal am Tag, die letzten 30 Tage) — nur, was der Anbieter wirklich liefert. */
export async function socialMessenLauf(jetzt = new Date()): Promise<{ gemessen: number }> {
  let gemessen = 0;
  const verbindungen = await ladeVerbindungen();
  if (!verbindungen.some(v => v.zustand === 'aktiv')) return { gemessen };
  const d = await ladeSocial();
  const heute = localDay(jetzt);
  const ab = tagPlus(heute, -30);
  for (const f of d.folgen) {
    for (const ve of f.veroeffentlicht) {
      if (ve.durch !== 'automatik' || !ve.externeId || ve.am < ab) continue;
      if (f.messungen.some(m => m.plattform === ve.plattform && m.am === heute && m.quelle === 'api')) continue;
      const v = aktiveVerbindung(verbindungen, f.kanalId, ve.plattform);
      const a = v ? await anbieterFuer(v.anbieter, ve.plattform) : null;
      if (!v?.geheim || !a?.messen) continue;
      const z = await a.messen(v.geheim, ve.externeId).catch(() => null);
      if (!z || typeof z.views !== 'number') continue;
      const w = await socialSystemSchreiben([{ op: 'messung', folgeId: f.id, messung: { ...z, plattform: ve.plattform, am: heute, quelle: 'api' } }], jetzt);
      if (w.ok) gemessen++;
    }
  }
  await laufVermerken('messen', { am: jetzt.toISOString(), gemessen }).catch(() => {});
  return { gemessen };
}
