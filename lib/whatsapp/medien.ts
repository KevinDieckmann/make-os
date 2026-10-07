// ─── WhatsApp — Medien nachladen, verschlüsselt ablegen, mit Frist löschen (Server, 07.10.2026) ──────────────────────────
// Meta (https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media, abgerufen 07.10.2026):
//   GET /<Version>/<MEDIA_ID>?phone_number_id=<ID> → { url, mime_type, sha256, file_size, id }; die Adresse gilt 5 Minuten und wird
//   mit dem Zugriffsschlüssel geladen; Medien-IDs aus Webhooks verfallen nach 7 Tagen.
// Abgelegt wird über lib/store/bild-ablage.ts (Ordner `whatsapp-medien`, Hülle der Dateiablage mit AAD, atomar, 0600) — nie Klartext,
// nie `writeFile`. Frist „WhatsApp-Medien“ (Vorgabe 90 Tage) löscht die Datei; die Nachricht bleibt (Zustand „abgelaufen“).
// Größer als `WA_GRENZEN.medium` (25 MB) → nicht geladen („zu groß — in WhatsApp ansehen“).

import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from '@/lib/store/local-db';
import { bildAblegen, bildEntfernen, bildOeffnen } from '@/lib/store/bild-ablage';
import { graph, medienLaden, WhatsappFehler } from './graph';
import type { WaKonfig } from './konfig';
import { aendereWaSpiegel, ladeWaSpiegel } from './spiegel';
import { WA_GRENZEN, type WaMedium } from './typen';

export const MEDIEN_ORDNER = 'whatsapp-medien' as const;
const MEDIEN_ID_GILT_MS = 7 * 24 * 3600_000;

/** Dateiname je Nachricht (rein): Fingerabdruck der WAMID (keine Nummer, keine Kennung im Dateinamen). */
export const dateiFuer = (wamid: string): string => `${createHash('sha256').update(`make-os|wa-medium|${wamid}`).digest('hex').slice(0, 40)}.bin`;

/** Passt die Prüfsumme? Meta beschreibt die Kodierung nicht — hex ODER base64 gelten (Annahme). Ohne Angabe: ja. Rein. */
export function pruefsummeOk(bytes: Buffer, sha256?: string): boolean {
  if (!sha256) return true;
  const d = createHash('sha256').update(bytes).digest();
  return sha256.toLowerCase() === d.toString('hex') || sha256 === d.toString('base64') || sha256.replace(/=+$/, '') === d.toString('base64url');
}

interface MedienAntwort { url?: string; mime_type?: string; sha256?: string; file_size?: number | string }

/** Ein Medium laden und ablegen. Liefert den neuen Zustand (wirft nie). */
export async function mediumHolen(k: WaKonfig, wamid: string, m: WaMedium, am: string, jetzt = Date.now()): Promise<WaMedium> {
  if (jetzt - Date.parse(am) > MEDIEN_ID_GILT_MS) return { ...m, zustand: 'abgelaufen', fehler: 'Bei Meta nicht mehr abrufbar (älter als 7 Tage).' };
  if (m.groesse && m.groesse > WA_GRENZEN.medium) return { ...m, zustand: 'zu-gross' };
  try {
    const info = await graph<MedienAntwort>(k, `/${m.mediaId}`, { query: { phone_number_id: k.telefonnummerId } });
    const groesse = Number(info.file_size);
    if (Number.isFinite(groesse) && groesse > WA_GRENZEN.medium) return { ...m, groesse, zustand: 'zu-gross' };
    if (typeof info.url !== 'string') throw new WhatsappFehler('medien', 'Meta hat keine Adresse geliefert.', 502);
    const bytes = await medienLaden(k, info.url, WA_GRENZEN.medium);
    if (!pruefsummeOk(bytes, m.sha256 ?? (typeof info.sha256 === 'string' ? info.sha256 : undefined))) throw new WhatsappFehler('medien', 'Die Prüfsumme der Datei passt nicht — nicht abgelegt.', 502);
    const datei = dateiFuer(wamid);
    await bildAblegen(MEDIEN_ORDNER, datei, bytes);
    const { fehler: _f, ...rest } = m;
    return { ...rest, groesse: bytes.length, datei, zustand: 'abgelegt' };
  } catch (e) {
    const versuche = (m.versuche ?? 0) + 1;
    const text = e instanceof WhatsappFehler ? e.message : 'Unbekannter Fehler beim Laden.';
    if (e instanceof WhatsappFehler && e.status === 413) return { ...m, zustand: 'zu-gross' };
    return { ...m, versuche, fehler: text, zustand: versuche >= WA_GRENZEN.medienVersuche ? 'fehler' : 'offen' };
  }
}

/** Offene Medien nachladen (höchstens `max` je Lauf; Webhook im Hintergrund und Takt). Liefert die Zahl der abgelegten. */
export async function medienNachladen(k: WaKonfig, max: number = WA_GRENZEN.medienJeLauf, nur?: readonly string[]): Promise<number> {
  const s = await ladeWaSpiegel();
  const offen = Object.values(s.nachrichten).filter(n => n.medium?.zustand === 'offen' && (!nur || nur.includes(n.id))).sort((a, b) => b.am.localeCompare(a.am)).slice(0, max);
  let abgelegt = 0;
  for (const n of offen) {
    const neu = await mediumHolen(k, n.id, n.medium!, n.am);
    if (neu.zustand === 'abgelegt') abgelegt++;
    await aendereWaSpiegel(cur => {
      const alt = cur.nachrichten[n.id];
      if (!alt?.medium) return null; // inzwischen gelöscht (Art. 17/Frist) — die Datei räumt `medienWaisenEntfernen`
      return { ...cur, nachrichten: { ...cur.nachrichten, [n.id]: { ...alt, medium: neu } } };
    });
  }
  return abgelegt;
}

/** Den Inhalt eines abgelegten Mediums (für die Route — die prüft vorher den Zugang). */
export async function mediumOeffnen(wamid: string): Promise<{ bytes: Buffer; mime: string; name: string } | null> {
  const n = (await ladeWaSpiegel()).nachrichten[wamid];
  if (!n?.medium?.datei || n.medium.zustand !== 'abgelegt') return null;
  const bytes = await bildOeffnen(MEDIEN_ORDNER, n.medium.datei);
  if (!bytes) return null;
  const endung = n.medium.mime.split(';')[0].split('/')[1]?.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return { bytes, mime: n.medium.mime, name: n.medium.name || `whatsapp-${n.art}-${n.am.slice(0, 10)}.${endung}` };
}

/**
 * Frist „WhatsApp-Medien“: Dateien älter als `grenzeTag` löschen (Nachricht bleibt, Zustand „abgelaufen“) und Dateien, auf die keine
 * Nachricht mehr zeigt (Art. 17, Frist des Spiegels), sofort entfernen. Liefert die Zahl gelöschter Dateien.
 */
export async function medienAufraeumen(grenzeTag: string | null): Promise<number> {
  let n = 0;
  if (grenzeTag) {
    const weg: string[] = [];
    await aendereWaSpiegel(cur => {
      let anders = false;
      const nachrichten = { ...cur.nachrichten };
      for (const [id, m] of Object.entries(cur.nachrichten)) {
        if (m.medium?.zustand !== 'abgelegt' || m.am.slice(0, 10) >= grenzeTag) continue;
        if (m.medium.datei) weg.push(m.medium.datei);
        const { datei: _d, ...rest } = m.medium;
        nachrichten[id] = { ...m, medium: { ...rest, zustand: 'abgelaufen' } };
        anders = true;
      }
      return anders ? { ...cur, nachrichten } : null;
    });
    for (const d of weg) { await bildEntfernen(MEDIEN_ORDNER, d); n++; }
  }
  return n + await medienWaisenEntfernen();
}

/** Dateien ohne Nachricht entfernen (nach Art. 17 oder Frist des Spiegels). */
export async function medienWaisenEntfernen(): Promise<number> {
  const dateien = await fs.readdir(path.join(datenOrdner(), MEDIEN_ORDNER)).catch(() => [] as string[]);
  if (!dateien.length) return 0;
  const s = await ladeWaSpiegel();
  const da = new Set(Object.values(s.nachrichten).map(m => m.medium?.datei).filter(Boolean));
  let n = 0;
  for (const d of dateien) {
    if (!/^[0-9a-f]{40}\.bin$/.test(d) || da.has(d)) continue;
    // Gerade erst abgelegt, Spiegel noch nicht nachgezogen (mediumHolen → aendereWaSpiegel)? Dann beim nächsten Lauf.
    const st = await fs.stat(path.join(datenOrdner(), MEDIEN_ORDNER, d)).catch(() => null);
    if (st && Date.now() - st.mtimeMs < 10 * 60_000) continue;
    await bildEntfernen(MEDIEN_ORDNER, d); n++;
  }
  return n;
}
