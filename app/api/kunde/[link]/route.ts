// ─── Kunden-Link — Kunden-Sicht (öffentlich; Fulfillment C2, 10.10. — kommt AUSGESCHALTET; FULFILLMENT_KONZEPT.md 5.4, 6.4) ────────────────────────
// Offen nur über die enge Regex der Middleware (`KUNDE_OFFEN`, nur GET), handelt für niemanden (Köpfe gelöscht). Das Token kommt als Kopf
// `x-kunde-token` (alles, was der Link darf) bzw. `x-kunde-puls` (NUR der Puls) — nie in der Adresse. Unbekannter Link, falsches Token, abgelaufen,
// Schalter aus (Umgebung `MAKE_OS_KUNDENLINK` ODER Instanz) ergeben DIESELBE Antwort: 404 „Dieser Link ist nicht (mehr) gültig.“
// Antwort: `{ ok, sicht, stempel }` — `sicht` ist die Positivliste aus lib/fulfillment/kunde/sicht.ts (dieselbe wie die interne Vorschau), `stempel`
// der signierte Formular-Stempel. Lesen schreibt nie (auch nicht „zuletzt gesehen“ — das vermerken die POST-Wege).

import { kundeZugriff, antwortOeffentlich } from '@/lib/fulfillment/kunde/oeffentlich';
import { sichtFuer } from '@/lib/fulfillment/kunde/server';
import { formularStempel } from '@/lib/fulfillment/kunde/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ link: string }> }) {
  // Ohne Kontext (Aufruf außerhalb von Next, z. B. im Wächter von C0) gibt es keine Kennung → dieselbe 404.
  const link = (await ctx?.params?.catch(() => null))?.link;
  const z = await kundeZugriff(req, link, 'lesen');
  if (z instanceof Response) return z;
  const sicht = await sichtFuer({ mandat: z.mandat, modus: z.art, link: z.link, kunde: z.kunde, vorlagen: z.vorlagen, crm: z.crm, heute: z.heute, ...(z.anfrage ? { anfrage: z.anfrage } : {}) });
  return antwortOeffentlich({ ok: true, sicht, stempel: formularStempel(z.link.id) });
}
