// ─── ZOE auf WhatsApp — Sprachnachrichten sicher ablegen (Server, 08.10.2026) ────────────────────────────────────────────
// Fragebogen Teil 3: „Sprachnachricht an ZOE → Aufgabe/Notiz; Transkription.“ Die Transkription bleibt AUS (Server-Schalter
// `ZOE_TRANSKRIPTION_AN=1`, Vorgabe aus — wie `TRANSKRIPTION_AN` beim Netzwerken; ein Dienst dafür ist nicht gewählt): bis dahin legt
// MAKE OS die Sprachnachricht verschlüsselt ab und antwortet „bitte als Text schicken oder in MAKE OS anhören“.
// Laden wie bei der Business-Nummer (lib/whatsapp/medien.ts, Meta: GET /<MEDIA_ID>?phone_number_id → url, mit dem Schlüssel laden;
// https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media) — mit dem Zugang der ZOE-Nummer.
// Abgelegt über lib/store/bild-ablage.ts im EIGENEN Ordner `zoe-whatsapp-medien` (Hülle mit AAD, atomar, 0600) — nie Klartext. Nur die
// Person selbst hört sie (Route /api/zoe/whatsapp/sprachnachricht). Aufbewahrung `sprachTage` (30), „Trennen“ und Konto löschen
// entfernen sie sofort; Dateien ohne Verweis räumt der Takt weg.

import { createHash } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { bildAblegen, bildEntfernen, bildOeffnen } from '@/lib/store/bild-ablage';
import { graph, medienLaden, WhatsappFehler } from '@/lib/whatsapp/graph';
import { pruefsummeOk } from '@/lib/whatsapp/medien';
import { WA_AUDIO_TYPEN, WA_GRENZEN } from '@/lib/whatsapp/typen';
import type { ZoeWaKonfig } from './konfig';
import { KANAL_GRENZEN, type EingangEintrag, type Sprachnachricht } from './kanal';
import { zoeZugang } from './meta';
import { aendereKanal, alleKanaele, ladeKanal } from './speicher';

export const ZOE_MEDIEN_ORDNER = 'zoe-whatsapp-medien' as const;

/** Server-Schalter: Transkription nur mit `ZOE_TRANSKRIPTION_AN=1` — Vorgabe AUS (es ist kein Dienst dafür gewählt). */
export const zoeTranskriptionAn = (): boolean => process.env.ZOE_TRANSKRIPTION_AN === '1';

/** Dateiname je Nachricht (rein): Fingerabdruck der WAMID — keine Nummer, keine Person im Namen. */
export const zoeDateiFuer = (wamid: string): string => `${createHash('sha256').update(`make-os|zoe-wa-medium|${wamid}`).digest('hex').slice(0, 40)}.bin`;

interface MedienAntwort { url?: string; mime_type?: string; sha256?: string; file_size?: number | string }

const grundTyp = (mime: string) => mime.split(';')[0].trim().toLowerCase();

/** Eine Sprachnachricht laden und ablegen (wirft nie) — liefert den Eintrag für den Kanal. */
export async function sprachnachrichtHolen(k: ZoeWaKonfig, e: EingangEintrag): Promise<Sprachnachricht> {
  const basis = { id: neueKennung('sn'), am: e.am, mime: grundTyp(e.medium?.mime ?? 'application/octet-stream') };
  if (!e.medium) return { ...basis, zustand: 'fehler' };
  if (e.medium.groesse && e.medium.groesse > WA_GRENZEN.medium) return { ...basis, groesse: e.medium.groesse, zustand: 'zu-gross' };
  try {
    const info = await graph<MedienAntwort>(zoeZugang(k), `/${e.medium.mediaId}`, { query: { phone_number_id: k.telefonnummerId } });
    if (typeof info.url !== 'string') throw new WhatsappFehler('medien', 'Meta hat keine Adresse geliefert.', 502);
    const bytes = await medienLaden(zoeZugang(k), info.url, WA_GRENZEN.medium);
    if (!pruefsummeOk(bytes, e.medium.sha256 ?? (typeof info.sha256 === 'string' ? info.sha256 : undefined))) throw new WhatsappFehler('medien', 'Prüfsumme passt nicht.', 502);
    const datei = zoeDateiFuer(e.wamid);
    await bildAblegen(ZOE_MEDIEN_ORDNER, datei, bytes);
    return { ...basis, groesse: bytes.length, datei, zustand: 'abgelegt' };
  } catch (x) {
    if (x instanceof WhatsappFehler && x.status === 413) return { ...basis, zustand: 'zu-gross' };
    return { ...basis, zustand: 'fehler' };
  }
}

/** Den Inhalt einer eigenen Sprachnachricht (die Route prüft vorher die Person). Nur Audio-Typen gehen als Audio hinaus. */
export async function sprachnachrichtOeffnen(person: string, id: string): Promise<{ bytes: Buffer; mime: string; name: string } | null> {
  if (!/^sn-[0-9a-f-]{36}$/.test(id)) return null;
  const s = (await ladeKanal(person)).sprachnachrichten?.find(x => x.id === id);
  if (!s?.datei || s.zustand !== 'abgelegt') return null;
  const bytes = await bildOeffnen(ZOE_MEDIEN_ORDNER, s.datei);
  if (!bytes) return null;
  const audio = (WA_AUDIO_TYPEN as readonly string[]).includes(s.mime);
  return { bytes, mime: audio ? s.mime : 'application/octet-stream', name: `sprachnachricht-${s.am.slice(0, 10)}.${audio ? (s.mime.split('/')[1] ?? 'ogg').replace(/[^a-z0-9]/g, '') : 'bin'}` };
}

/** Alle Sprachnachrichten einer Person entfernen (Trennen, Konto löschen) — Dateien und Verweise. Liefert die Zahl der Dateien. */
export async function sprachnachrichtenEntfernen(person: string): Promise<number> {
  const k = await ladeKanal(person);
  const dateien = (k.sprachnachrichten ?? []).map(s => s.datei).filter((d): d is string => !!d);
  for (const d of dateien) await bildEntfernen(ZOE_MEDIEN_ORDNER, d);
  if ((k.sprachnachrichten ?? []).length) await aendereKanal(person, cur => ({ ...cur, sprachnachrichten: [] }));
  return dateien.length;
}

/**
 * Aufbewahrung (Takt): Sprachnachrichten älter als `sprachTage` fallen weg (Datei + Verweis); Dateien, auf die kein Kanal mehr zeigt
 * (Konto gelöscht, Trennen unterbrochen), werden nach 10 Minuten entfernt. Liefert die Zahl gelöschter Dateien.
 */
export async function sprachnachrichtenAufraeumen(jetzt = Date.now()): Promise<number> {
  const grenze = new Date(jetzt - KANAL_GRENZEN.sprachTage * 86_400_000).toISOString();
  let n = 0;
  const bekannt = new Set<string>();
  for (const { person, kanal } of await alleKanaele()) {
    const alt = (kanal.sprachnachrichten ?? []).filter(s => s.am < grenze);
    for (const s of kanal.sprachnachrichten ?? []) if (s.datei && s.am >= grenze) bekannt.add(s.datei);
    if (!alt.length) continue;
    for (const s of alt) if (s.datei) { await bildEntfernen(ZOE_MEDIEN_ORDNER, s.datei); n++; }
    const weg = new Set(alt.map(s => s.id));
    await aendereKanal(person, cur => ({ ...cur, sprachnachrichten: (cur.sprachnachrichten ?? []).filter(s => !weg.has(s.id)) }), jetzt);
  }
  const ordner = path.join(datenOrdner(), ZOE_MEDIEN_ORDNER);
  for (const d of await fs.readdir(ordner).catch(() => [] as string[])) {
    if (!/^[0-9a-f]{40}\.bin$/.test(d) || bekannt.has(d)) continue;
    const st = await fs.stat(path.join(ordner, d)).catch(() => null);
    if (st && jetzt - st.mtimeMs < 10 * 60_000) continue; // gerade abgelegt, Verweis kommt gleich
    await bildEntfernen(ZOE_MEDIEN_ORDNER, d); n++;
  }
  return n;
}
