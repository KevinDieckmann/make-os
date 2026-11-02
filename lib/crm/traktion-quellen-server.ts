// ─── Traktions-Index — Quellen laden (Server, 02.11., Marketing-Projekt M3) ─────────────────────────────────────────────────────────
// EINE Lesestelle für alle Aufrufer des Traktions-Index (Überblick, Business-Index, ZOE, Agenten-Kontext) — eine Zahl überall:
//   webseite  Schalter + abgeschlossene Checks (lib/crm/webseite-zahlen-server.ts)
//   social    veröffentlichte Social-Folgen — in der Systemsicht (`socialFuerPerson(…, null)`: ohne „nur ich“-Kanäle einer Personenmarke), so
//             sieht jede Person dieselbe Zahl und nie Titel eines fremden „nur ich“-Kanals
//   motor     gesendete Mails des Mail-Stapels (Tag, Kampagne, ob geantwortet) — nie Adressen, Betreffe oder Texte
// Jede Quelle für sich in `sicher()`: scheitert eine oder ist sie leer, fehlt nur sie (undefined) — der Index ist dann der bisherige.

import { tagVon } from '@/lib/zeit';
import type { WebseiteStand } from './webseite-zahlen';
import type { SocialStand, MotorStand } from './traktion-quellen';
import type { SocialVeroeffentlichung } from './marketing';

async function sicher<T>(f: () => Promise<T>): Promise<T | undefined> {
  try { return await f(); } catch (e) { console.error('[traktion] Quelle nicht lesbar:', e instanceof Error ? e.message.slice(0, 160) : e); return undefined; }
}

export async function socialStandLaden(): Promise<SocialStand | undefined> {
  return sicher(async () => {
    const { ladeSocial } = await import('@/lib/social/server');
    const { socialFuerPerson } = await import('@/lib/social/daten');
    const d = socialFuerPerson(await ladeSocial(), null);
    if (!d.kanaele.length) return undefined;
    const name = new Map(d.kanaele.map(k => [k.id, k.name]));
    const posts: SocialVeroeffentlichung[] = d.folgen.filter(f => f.veroeffentlicht.length > 0 && name.has(f.kanalId)).map(f => ({
      folgeId: f.id, kanalName: name.get(f.kanalId)!, titel: f.titel,
      tag: f.veroeffentlicht.map(v => v.am.slice(0, 10)).sort()[0],
      plattformen: Array.from(new Set(f.veroeffentlicht.map(v => v.plattform))),
      ...(f.beitragId ? { beitragId: f.beitragId } : {}),
    }));
    return { posts };
  });
}

export async function motorStandLaden(): Promise<MotorStand | undefined> {
  return sicher(async () => {
    const { ladePost } = await import('./kampagnen-motor');
    const mails = (await ladePost()).eintraege.filter(e => e.kanal === 'mail' && e.gesendet?.am)
      .map(e => ({ kampagneId: e.kampagneId, tag: tagVon(e.gesendet!.am), antwort: e.rueckfluss?.art === 'antwort' }));
    return mails.length ? { mails } : undefined;
  });
}

/** Alles, was der Index außerhalb von Kartei und CRM braucht — als Teil des `TraktionBestand` (ausbreiten: `...await traktionQuellenLaden()`). */
export async function traktionQuellenLaden(): Promise<{ webseite?: WebseiteStand; social?: SocialStand; motor?: MotorStand }> {
  const [webseite, social, motor] = await Promise.all([
    (async () => (await import('./webseite-zahlen-server')).webseiteStandLaden())(),
    socialStandLaden(), motorStandLaden(),
  ]);
  return { ...(webseite ? { webseite } : {}), ...(social ? { social } : {}), ...(motor ? { motor } : {}) };
}
