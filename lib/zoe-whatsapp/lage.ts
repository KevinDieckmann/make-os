// ─── ZOE auf WhatsApp — Lage für den Head of IT (Server, 08.10.2026) ─────────────────────────────────────────────────────
// NUR Zahlen und Zustände (lib/hoi/lage.ts `zoeWhatsappBefunde`), NUR aus den eigenen Beständen — kein Aufruf bei Meta. Nie Nummern,
// Namen oder Texte. Nicht eingerichtet und kein Konflikt → null → kein Befund (die Einrichtung zeigt `einrichtungBefunde`).

import type { ZoeWhatsappLage } from '@/lib/hoi/lage';
import { zoeWhatsappKonfig, zoeWhatsappKonflikt } from './konfig';
import { briefingVorlagePruefen } from './meta';
import { alleKanaele, ladeZoeZustand, type ZoeWaZustand } from './speicher';
import type { ZoeKanal } from './kanal';

const TAG_MS = 24 * 3600_000;

/** Lage aus Zustand und Kanälen (rein, getestet). */
export function zoeWhatsappLageAus(z: ZoeWaZustand, kanaele: readonly ZoeKanal[], vorlage: { name: string; sprache: string } | null, jetzt: number): ZoeWhatsappLage {
  const zuletzt = z.webhook?.zuletzt ? Date.parse(z.webhook.zuletzt) : NaN;
  const abgelehntAm = z.webhook?.zuletztAbgelehnt ? Date.parse(z.webhook.zuletztAbgelehnt) : NaN;
  const v = vorlage && z.vorlagen ? briefingVorlagePruefen(z.vorlagen.liste, vorlage.name, vorlage.sprache) : null;
  return {
    konflikt: false,
    webhookVorMin: Number.isFinite(zuletzt) ? Math.max(0, Math.floor((jetzt - zuletzt) / 60_000)) : null,
    abgelehnt: z.webhook?.abgelehnt ?? 0,
    abgelehntFrisch: Number.isFinite(abgelehntAm) && jetzt - abgelehntAm < TAG_MS,
    token: !!z.token?.fehlerAt && (!z.token.okAt || z.token.fehlerAt > z.token.okAt),
    vorlage: !z.vorlagen ? 'ungeprueft' : v?.ok ? 'ok' : 'fehlt',
    verbunden: kanaele.filter(k => k.status === 'verbunden').length,
    mitInhalten: kanaele.filter(k => k.status === 'verbunden' && !!k.inhalte?.seit).length,
    fremd: z.fremd?.anzahl ?? 0,
    verworfen: z.verworfen ?? 0,
    eingangOffen: kanaele.reduce((n, k) => n + (k.eingang?.length ?? 0), 0),
    fehlgeschlagen7d: (z.fehlgeschlagen ?? []).filter(t => jetzt - Date.parse(t) < 7 * TAG_MS).length,
  };
}

export async function zoeWhatsappLage(jetzt = Date.now()): Promise<ZoeWhatsappLage | null> {
  if (zoeWhatsappKonflikt()) return { konflikt: true, webhookVorMin: null, abgelehnt: 0, abgelehntFrisch: false, token: false, vorlage: 'ungeprueft', verbunden: 0, mitInhalten: 0, fremd: 0, verworfen: 0, eingangOffen: 0, fehlgeschlagen7d: 0 };
  const k = zoeWhatsappKonfig();
  if (!k) return null;
  const [z, kanaele] = await Promise.all([ladeZoeZustand(), alleKanaele()]);
  return zoeWhatsappLageAus(z, kanaele.map(x => x.kanal), k.vorlage, jetzt);
}
