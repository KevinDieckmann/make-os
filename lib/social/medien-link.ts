// ─── MAKE OS — Social: kurzlebiger öffentlicher Link für EIN Medium (28.10.2026, Malin-Paket) ─────────────────────────────────────────
// Instagram holt Bilder und Videos selbst ab: „hosted on a publicly accessible server at the time of the attempt“ (Content Publishing,
// research/social/FAKTEN_VEROEFFENTLICHEN.md › 3) — ein Upload in die API steht unserem Weg (Instagram Login) nicht offen. Deshalb gibt der
// Veröffentlicher JE VERSUCH einen Link heraus, der nur dieses eine Medium liefert:
//   · Adresse `/api/social/medien/sm-<32 hex>` (+ optional `.jpg`/`.mp4`) — 128 Bit Zufall, im Bestand nur der SHA-256-Fingerabdruck;
//   · gilt `LINK_MINUTEN` (Instagram verarbeitet einen Container höchstens einige Minuten; ein Reel kann länger brauchen), danach 404;
//   · liefert nur, solange das Medium für „Social Media“ freigegeben ist (bei jedem Abruf neu geprüft — ein Widerruf wirkt sofort);
//   · handelt für niemanden (die Middleware löscht alle Personen-Köpfe), liefert nie Metadaten, nie eine Liste, drosselt je Adresse;
//   · abgelaufene Einträge räumt `linksAufraeumen` im Takt weg. Antwort für jede Fehlerart gleich (404), damit nichts zu erraten ist.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const LINKS_BESTAND = 'social-medien-links';
/** Gültigkeit eines Links. Reels: Instagram lädt das Video beim Anlegen des Containers — 60 Min. lassen Luft für Wiederholungen bei Meta. */
export const LINK_MINUTEN = 60;
export const LINK_PFAD = /^\/api\/social\/medien\/sm-[a-f0-9]{32}(\.(jpg|mp4))?$/;
const TOKEN = /^sm-[a-f0-9]{32}$/;

interface LinkEintrag { fp: string; mediumId: string; bis: number }
interface LinkDatei { eintraege: LinkEintrag[] }

const fingerabdruck = (t: string) => createHash('sha256').update(`make-os|social-link|${t}`).digest('hex');

/** Einen Link für ein Medium anlegen — gibt den Pfad (ohne Adresse) zurück. */
export async function linkAnlegen(mediumId: string, endung: 'jpg' | 'mp4', jetzt = Date.now()): Promise<string> {
  const token = `sm-${randomBytes(16).toString('hex')}`;
  await updateJson<LinkDatei>(LINKS_BESTAND, cur => ({
    eintraege: [...(cur?.eintraege ?? []).filter(e => e.bis > jetzt), { fp: fingerabdruck(token), mediumId, bis: jetzt + LINK_MINUTEN * 60_000 }],
  }));
  return `/api/social/medien/${token}.${endung}`;
}

/** Das Medium hinter einem Token — null, wenn unbekannt oder abgelaufen (zeitkonstanter Vergleich der Fingerabdrücke). */
export async function linkAufloesen(token: string, jetzt = Date.now()): Promise<string | null> {
  const t = token.replace(/\.(jpg|mp4)$/, '');
  if (!TOKEN.test(t)) return null;
  const fp = Buffer.from(fingerabdruck(t), 'hex');
  const d = await loadJson<LinkDatei>(LINKS_BESTAND);
  let treffer: string | null = null;
  for (const e of d?.eintraege ?? []) {
    const x = Buffer.from(e.fp, 'hex');
    if (x.length === fp.length && timingSafeEqual(x, fp) && e.bis > jetzt) treffer = e.mediumId;
  }
  return treffer;
}

/** Abgelaufene Links weg (Takt). */
export async function linksAufraeumen(jetzt = Date.now()): Promise<number> {
  let weg = 0;
  await updateJson<LinkDatei>(LINKS_BESTAND, cur => {
    if (!cur) return cur as unknown as LinkDatei;
    const rest = (cur.eintraege ?? []).filter(e => e.bis > jetzt);
    weg = (cur.eintraege ?? []).length - rest.length;
    return weg ? { eintraege: rest } : cur;
  });
  return weg;
}
