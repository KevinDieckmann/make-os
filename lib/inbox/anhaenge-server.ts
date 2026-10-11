// ─── Inbox — Anhänge aus der eigenen Ablage an eine ausgehende Mail (Server, 10.10., Fortschritts-Report) ──────────────
// Der Browser schickt NIE Bytes, nur Kennungen von Dateien der CRM-Ablage (`{ datei: 'd-…' }`): ein Report-PDF am Mandat, ein Angebot …
// Geladen wird nur, was (a) zum Haushalt des Inhabers gehört und die sendende Person VOLLES Mitglied dieses Haushalts ist (`haushaltFuer` —
// Prüf-Fund 11.10.: ein Konto „nur Business“ hätte sonst jede Datei der Ablage versenden können → 403), (b) einen CRM-Bezug trägt
// (Kontakt, Firma, Mandat, Deal, Angebot — keine Gesellschafts-Logos, keine Aufgaben-Dateien), (c) einen der Ablage-Typen hat (PDF, PNG,
// JPG, DOCX — geprüft beim Ablegen am Inhalt), (d) keinen Privat-Bezug hat (Datei mit Bereich Privat bzw. aus der Aufgaben-Ablage, Unterlage
// einer Privat-Einheit → 403). Höchstens drei, zusammen 4 MB (lib/gmail/mime.ts `ANHANG_GRENZEN`) — darüber 413, nie gekürzt.

import { SendenFehler } from '@/lib/gmail/senden';
import { ANHANG_GRENZEN, type MailAnhang } from '@/lib/gmail/mime';
import { DATEI_ID, ERLAUBTE_TYPEN, istAufgabenDatei, type DateiEintrag } from '@/lib/dateien/regeln';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { bereichVonGesellschaft } from '@/lib/einheiten';
import { haushaltDesInhabers, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

/** Die Kennungen aus dem Körper — `[{ datei }]`; Unsinn → 400, zu viele → 413. Leer/fehlend → []. */
export function anhangKennungen(roh: unknown): string[] {
  if (roh === undefined || roh === null) return [];
  if (!Array.isArray(roh)) throw new SendenFehler('versand', 'anhaenge: eine Liste von { datei }.', 400);
  if (roh.length > ANHANG_GRENZEN.anzahl) throw new SendenFehler('zu-viele', `Höchstens ${ANHANG_GRENZEN.anzahl} Anhänge — nichts gesendet.`, 413);
  return roh.map(x => {
    const id = x && typeof x === 'object' ? (x as { datei?: unknown }).datei : undefined;
    if (typeof id !== 'string' || !DATEI_ID.test(id)) throw new SendenFehler('versand', 'Ein Anhang hat keine gültige Datei-Kennung — nichts gesendet.', 400);
    return id;
  }).filter((x, i, l) => l.indexOf(x) === i);
}

/**
 * Hat ein Ablage-Eintrag einen Privat-Bezug? Bereich Privat bzw. eine Datei der Aufgaben-Ablage (gehört nie in die CRM-Ablage), Unterlage
 * einer Privat-Einheit (`bereichVonGesellschaft`). Rein, getestet.
 */
export function anhangPrivat(e: Pick<DateiEintrag, 'bereich' | 'gesellschaft' | 'projektId' | 'aufgabeId'>): boolean {
  if (e.bereich === 'privat' || istAufgabenDatei(e)) return true;
  return !!e.gesellschaft && bereichVonGesellschaft(e.gesellschaft) === 'privat';
}

/** Lädt die Anhänge (entschlüsselt) — wirft `SendenFehler` (403/404/413), bevor irgendetwas gesendet wird. */
export async function anhaengeLaden(person: string, roh: unknown): Promise<MailAnhang[]> {
  const ids = anhangKennungen(roh);
  if (!ids.length) return [];
  if (!(await personImHaushaltDesInhabers(person))) throw new SendenFehler('versand', 'Anhänge aus der Ablage nur im Haushalt des Inhabers.', 403);
  // Volles Mitglied (nicht „nur Business“) UND der Haushalt des Inhabers — dort liegt die Ablage.
  const [h, eigen] = await Promise.all([haushaltDesInhabers(), haushaltFuer(person)]);
  if (!h || !eigen || eigen.haushalt !== h) throw new SendenFehler('versand', 'Anhänge aus der Ablage nur für volle Mitglieder des Haushalts.', 403);
  const { lesen } = await import('@/lib/dateien/ablage');
  const raus: MailAnhang[] = [];
  let summe = 0;
  for (const id of ids) {
    const d = await lesen(h, id).catch(() => null);
    const e = d?.eintrag;
    const bezug = !!e && !!(e.kontaktId || e.firmaId || e.mandatId || e.dealId || e.angebotId);
    if (!d || !e?.datei || !bezug || !(e.datei.typ in ERLAUBTE_TYPEN)) throw new SendenFehler('nicht-gefunden', 'Diesen Anhang gibt es in der Ablage nicht (mehr) — nichts gesendet.', 404);
    if (anhangPrivat(e)) throw new SendenFehler('versand', 'Dieser Anhang gehört zum Bereich Privat — er geht nicht als Anhang aus der Ablage hinaus. Nichts gesendet.', 403);
    summe += d.bytes.length;
    if (summe > ANHANG_GRENZEN.bytes) throw new SendenFehler('zu-lang', `Die Anhänge sind zusammen größer als ${ANHANG_GRENZEN.bytes / 1024 / 1024} MB — nichts gesendet.`, 413);
    raus.push({ name: e.datei.name, typ: e.datei.typ, bytes: new Uint8Array(d.bytes) });
  }
  return raus;
}
