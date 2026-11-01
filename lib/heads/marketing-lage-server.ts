// ─── Head of Marketing: die neuen Teile einsammeln (nur Server — 02.11., Marketing-Projekt M2 K2) ───────────────────────────────────────
// Liest nur über die vorhandenen Lesestellen (Social, Community, Website-Lage, Homepage-Funde, Mail-Stapel des Kampagnen-Motors) und gibt
// sie an lib/heads/marketing-lage.ts (rein) zum Verdichten. Jede Quelle für sich in `sicher()` — scheitert eine, fehlt nur sie (null), der
// Lauf geht weiter. Social nur mit den Kanälen, die die Person des Laufs sieht (`socialFuerPerson`; Systemlauf ohne Person: keine „nur ich“-
// Kanäle einer Personenmarke). Nie Texte Dritter — der Rückgabewert trägt nur Zahlen, Kennungen und eigene Kanal-/Kampagnennamen.

import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import type { CrmBestand } from '@/lib/crm/typen';
import { socialLage, websiteLage, fundeLage, mailStapelLage, type MarketingLage } from './marketing-lage';

async function sicher<T>(f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch (e) { console.error('[head-marketing] Quelle nicht lesbar:', e instanceof Error ? e.message.slice(0, 160) : e); return null; }
}

export async function marketingLageLaden(person: string | null, crm: CrmBestand, jetzt = new Date()): Promise<MarketingLage> {
  const heute = localDay(jetzt);
  const bis = tagPlus(heute, 6);
  const social = await sicher(async () => {
    const { ladeSocial } = await import('@/lib/social/server');
    const { socialFuerPerson } = await import('@/lib/social/daten');
    const { planLuecken } = await import('@/lib/social/plan');
    const { wandzeit } = await import('@/lib/kalender/zeit');
    const d = socialFuerPerson(await ladeSocial(), person);
    const ids = new Set(d.kanaele.map(k => k.id));
    const faeden = await sicher(async () => {
      const { ladeCommunity, faedenAus } = await import('@/lib/social/community');
      return faedenAus(await ladeCommunity(), ids, jetzt.getTime()).map(f => ({ kanalId: f.kanalId, art: f.art, offen: f.offen }));
    }) ?? [];
    const jetztWand = wandzeit(jetzt).slice(0, 16);
    const luecken = Object.fromEntries(d.kanaele.filter(k => k.status === 'aktiv' && !k.archiviertAm).map(k => [k.id, planLuecken(k, d.formate, d.folgen, jetztWand)]));
    return socialLage(d, faeden, luecken, heute, bis);
  });
  const website = await sicher(async () => {
    const { websiteEingaenge, websiteZahlen, wegeLage } = await import('@/lib/website/lage-server');
    const [e, z, w] = await Promise.all([websiteEingaenge(heute, 30), websiteZahlen(heute), wegeLage()]);
    return websiteLage(e, z, w);
  });
  const funde = await sicher(async () => {
    const { ladeFunde } = await import('@/lib/funde/speicher');
    return fundeLage((await ladeFunde()).funde);
  });
  const mail_stapel = await sicher(async () => {
    const { ladePost } = await import('@/lib/crm/kampagnen-motor');
    const { antwortFollowupId } = await import('@/lib/crm/kampagnen-post');
    return mailStapelLage((await ladePost()).eintraege, crm.followups ?? [], crm.kampagnen ?? [], heute, tagPlus(heute, -6), antwortFollowupId);
  });
  return { social, website, funde, mail_stapel };
}
