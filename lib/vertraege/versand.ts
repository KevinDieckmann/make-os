// ─── Verträge · „Vertrag senden“ aus dem eigenen Postfach (nur Server, 02.11.) ───────────────────────────────────────────────────────
// Kevin 02.11.: Verträge gehen per Mail aus dem Postfach hinaus — NUR per Klick einer Person (Route /api/vertraege `senden`, Sitzung; Dienstweg/ZOE
// und Konten „nur Business“ → 403). Gesendet wird über den EINEN Inbox-Weg (`inboxSenden`: § 7 UWG, Art. 18, Absender = Postfach, Spiegel), mit dem
// Beleg `{ art: 'vertrag' }` — dort wird VOR dem Senden geprüft, dass der einzige Anhang GENAU das PDF dieses Vertrags ist (lib/inbox/beleg-versand.ts).
// Hier zusätzlich, bevor etwas gesendet wird:
//   · Vertrag fertig bzw. schon versendet, mit festgeschriebenem PDF, Gesellschaft im Business-Bereich, Stand (409)
//   · Empfänger = eine Adresse des Vertragspartners (Kontakt am Vertrag) — sonst 400; Art. 18 → 409; Werbesperre ist kein Grund (1:1-Vertragspost)
//   · Postfach = ein EIGENES Postfach im Business-Bereich (nie Privat, nie ohne Bereich) — sonst 400
// Nach dem Senden (`vertragVersendetVermerken`, wirft nie): Status „versendet“ (+ `versendetAm`, `versendetUeber` maskiert), Mail-Aktivität in der Akte,
// Follow-up „Unterschrift nachfassen“ in 7 Tagen (`fu-<vertrag>`, idempotent), Änderungsprotokoll (nur Kennungen/Feldnamen über `vertragAendern`).
// Der Weg „Ist versendet“ (Status von Hand) bleibt.

import { localDay, tagePlus } from '@/lib/zeit';
import { bereichVonFirma, istBusinessGesellschaft } from '@/lib/einheiten';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { mitStand, vertraegeLaden, VertragFehler, vertragAendernIntern } from './server';
import type { Vertrag } from './modell';

export const VERSAND_GRENZEN = { betreff: 300, text: 20_000 } as const;
export const NACHFASSEN_TAGE = 7;
export const NACHFASSEN_TEXT = 'Unterschrift nachfassen';
const ZUM_SENDEN: readonly Vertrag['status'][] = ['fertig', 'versendet'];

/** Kopf der Mail-Aktivität in der Akte (je Vertragsnummer EINE — wiederholtes Senden schreibt keinen zweiten Vermerk). */
export const vertragVermerkKopf = (nummer: string) => `Vertrag ${nummer} versendet`;
/** Kennung des Follow-ups „Unterschrift nachfassen“ — aus dem Vertrag abgeleitet (idempotent). */
export const vertragFollowUpId = (vertragId: string) => `fu-${vertragId}`;

/** Text der Begleit-Mail (Vorgabe im Dialog; die Person kann ihn ändern). */
export function vertragMailVorgabe(v: Pick<Vertrag, 'titel' | 'nummer' | 'anrede' | 'absender'>): { betreff: string; text: string } {
  const du = v.anrede === 'Du';
  return {
    betreff: `${v.titel} ${v.nummer ?? ''}`.trim(),
    text: `${du ? 'Hallo' : 'Guten Tag'},\n\nanbei ${du ? 'dein' : 'Ihr'} Vertrag ${v.nummer ?? ''} zur Unterschrift.\n\nViele Grüße\n${v.absender?.firmierung ?? ''}`,
  };
}

export interface VertragSendenEingabe {
  haushalt: string; person: string; id: string; stand: unknown;
  postfach: unknown; an: unknown; betreff: unknown; text: unknown; uwgBestaetigt?: boolean;
  wer: Wer;
}

/** Senden — wirft `VertragFehler` (Status) bzw. liefert die Antwort des Inbox-Wegs (UWG-Rückfrage 409 `code: 'uwg'`). */
export async function vertragSenden(p: VertragSendenEingabe): Promise<{ status: number; body: Record<string, unknown> }> {
  const v = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id);
  if (!v) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  if (!ZUM_SENDEN.includes(v.status)) throw new VertragFehler(v.status === 'entwurf' ? 'Erst fertigstellen — ein Entwurf geht nicht hinaus. Nichts gesendet.' : `Ein Vertrag im Status „${v.status}“ wird nicht mehr zur Unterschrift gesendet.`, 409);
  if (typeof p.stand !== 'string' || mitStand(v).stand !== p.stand) throw new VertragFehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal. Nichts gesendet.', 409, { aktuell: mitStand(v), grund: 'stand' });
  if (!v.pdfDateiId || !v.nummer) throw new VertragFehler('Der Vertrag hat kein festgeschriebenes PDF — nichts gesendet.', 409);
  if (!istBusinessGesellschaft(v.gesellschaft)) throw new VertragFehler('Verträge gehen nur für eine Gesellschaft im Business-Bereich hinaus — nichts gesendet.', 400);
  if (!v.kontaktId) throw new VertragFehler('Am Vertrag steht keine Person als Vertragspartner — ohne Empfänger nichts gesendet.', 400);

  // Empfänger: eine Adresse des Kontakts am Vertrag. Art. 18 → 409 (vor jedem Senden; der Inbox-Weg prüft es noch einmal).
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const { alleAdressen } = await import('@/lib/crm/emails');
  const { EINGESCHRAENKT_FEHLER } = await import('@/lib/crm/einschraenkung');
  const k = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === v.kontaktId);
  if (!k) throw new VertragFehler('Der Vertragspartner steht nicht (mehr) in der Kartei — nichts gesendet.', 404);
  if (k.eingeschraenkt) throw new VertragFehler(`${EINGESCHRAENKT_FEHLER} Nichts gesendet.`, 409, { grund: 'eingeschraenkt' });
  const an = typeof p.an === 'string' ? p.an.trim().toLowerCase() : '';
  const adresse = alleAdressen(k).find(x => x.toLowerCase() === an);
  if (!adresse) throw new VertragFehler('Empfänger: bitte eine Adresse des Vertragspartners wählen — nichts gesendet.', 400);

  // Postfach: ein eigenes, im Business-Bereich.
  if (typeof p.postfach !== 'string' || !p.postfach) throw new VertragFehler('Postfach: bitte ein eigenes Postfach wählen.', 400);
  const { ladePostfach } = await import('@/lib/postfach/register');
  const pf = await ladePostfach(p.person, p.postfach);
  if (!pf || pf.quelle === 'whatsapp') throw new VertragFehler('Dieses Postfach gibt es bei dir nicht — nichts gesendet.', 400);
  if (!pf.bereich || pf.bereich === 'privat' || bereichVonFirma(pf.bereich) !== 'business') throw new VertragFehler('Verträge gehen nur aus einem Postfach im Business-Bereich hinaus — nie aus einem privaten oder einem ohne Bereich. Nichts gesendet.', 400);

  const betreff = typeof p.betreff === 'string' ? p.betreff.trim() : '';
  const text = typeof p.text === 'string' ? p.text : '';
  if (!betreff || !text.trim()) throw new VertragFehler('Betreff und Text dürfen nicht leer sein — nichts gesendet.', 400);
  if (betreff.length > VERSAND_GRENZEN.betreff || text.length > VERSAND_GRENZEN.text) throw new VertragFehler(`Betreff höchstens ${VERSAND_GRENZEN.betreff}, Text höchstens ${VERSAND_GRENZEN.text} Zeichen — nichts gesendet.`, 413);

  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  const r = await inboxSenden(p.person, {
    neu: { postfach: pf.id, betreff }, an: [{ email: adresse, name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() }], text,
    anhaenge: [{ datei: v.pdfDateiId }], beleg: { art: 'vertrag', id: v.id }, uwgBestaetigt: p.uwgBestaetigt === true,
  }, p.wer);
  if (r.status !== 200 || r.body.ok !== true) return r;
  const nach = (await vertraegeLaden(p.haushalt)).find(x => x.id === p.id) ?? v;
  const { adresseMaskiert } = await import('@/lib/zugang/konten');
  return { status: 200, body: { ok: true, vertrag: mitStand(nach), an: adresseMaskiert(adresse), ueber: adresseMaskiert(String(r.body.von ?? pf.adresse)) } };
}

/**
 * Nach dem Senden (aus `belegVermerken`): Status, Akte, Follow-up — jeder Teil für sich, wirft nie. `ueber` = Postfach maskiert.
 * Idempotent: der Akten-Vermerk je Vertragsnummer einmal, das Follow-up `fu-<vertrag>` einmal.
 */
export async function vertragVersendetVermerken(p: { haushalt: string; id: string; ueber: string; person: string; wer: Wer; jetzt?: Date }): Promise<void> {
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  let v: Vertrag | null = null;
  try {
    v = await vertragAendernIntern(p.haushalt, p.id, a => (a.status === 'fertig' || a.status === 'versendet'
      ? { ...a, status: 'versendet', versendetAm: jetzt.toISOString(), versendetUeber: p.ueber.slice(0, 160), geaendert: jetzt.toISOString(), geaendertVon: p.person }
      : a), p.wer);
  } catch (e) { console.warn('[vertraege] Versand-Vermerk:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
  if (!v?.kontaktId || !v.nummer) return;
  const kontaktId = v.kontaktId, nummer = v.nummer, titel = v.titel, vid = v.id;
  try {
    const { aendereKontakte } = await import('@/lib/crm/kartei-schreiben');
    const { wendeAktivitaetAn } = await import('@/lib/make-one/crm');
    const { tagPlus } = await import('@/lib/crm/followup');
    const kopf = vertragVermerkKopf(nummer);
    await aendereKontakte<{ kontakte: import('@/lib/make-one/crm').Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      const x0 = f.kontakte.find(x => x.id === kontaktId);
      if (!x0 || x0.eingeschraenkt || (x0.aktivitaeten ?? []).some(a => (a.text ?? '').startsWith(kopf))) return f;
      return { ...f, kontakte: f.kontakte.map(x => (x.id === kontaktId ? wendeAktivitaetAn(x, { art: 'mail', text: `${kopf} — ${titel}`, von: p.person, bezug: vid }, heute, jetzt.toISOString(), tagPlus) : x)) };
    }, p.wer);
  } catch (e) { console.warn('[vertraege] Akten-Vermerk:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
  try {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const { neuesFollowUp } = await import('@/lib/crm/followup');
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const k = (await kontakteFuerVerarbeitung()).find(x => x.id === kontaktId);
    if (!k) return; // eingeschränkt oder weg: kein Follow-up
    const id = vertragFollowUpId(vid);
    const fu = neuesFollowUp({ id, bezug: { art: 'kontakt', id: kontaktId }, kontaktId, art: 'mail', text: `${NACHFASSEN_TEXT} — Vertrag ${nummer}`, faellig: tagePlus(heute, NACHFASSEN_TAGE), quelle: 'hand' }, k, p.person, jetzt.toISOString());
    await aendereCrm(c => ((c.followups ?? []).some(x => x.id === id) ? c : { ...c, followups: [...(c.followups ?? []), { ...fu, geaendertVon: p.person }] }), p.wer);
  } catch (e) { console.warn('[vertraege] Follow-up:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
}

/**
 * Für den Dialog „Vertrag senden“: die Adressen des Vertragspartners (Kontakt am Vertrag) und der Vorgabe-Text — nichts wird gesendet.
 * Eingeschränkte Person (Art. 18) → keine Adressen, `eingeschraenkt: true`.
 */
export async function sendeZiele(haushalt: string, id: string): Promise<{ adressen: string[]; eingeschraenkt?: true; vorgabe: { betreff: string; text: string } }> {
  const v = (await vertraegeLaden(haushalt)).find(x => x.id === id);
  if (!v) throw new VertragFehler('Vertrag nicht gefunden.', 404);
  const vorgabe = vertragMailVorgabe(v);
  if (!v.kontaktId) return { adressen: [], vorgabe };
  const [{ kontakteFuerVerarbeitung }, { alleAdressen }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/crm/emails')]);
  const k = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === v.kontaktId);
  if (!k) return { adressen: [], vorgabe };
  if (k.eingeschraenkt) return { adressen: [], eingeschraenkt: true, vorgabe };
  return { adressen: alleAdressen(k), vorgabe };
}
