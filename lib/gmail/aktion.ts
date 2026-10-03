// ─── Gmail — Markieren, Archivieren, Anhänge (Server, 03.10.2026) ─────────────
// Was die Person in der Inbox mit einer Mail tut, geht an Gmail zurück (Gelesen, Archivieren = Label INBOX weg) — Gmail bleibt die
// Wahrheit, der Spiegel zieht sofort nach (ohne auf den nächsten Abgleich zu warten). Nie Löschen: `gmail.modify` kann Nachrichten
// nicht endgültig löschen, und MAKE OS legt auch keinen Weg dafür an (Papierkorb/Löschen macht man in Gmail).
// Anhänge: nur Metadaten im Spiegel; der Inhalt kommt auf Klick über die geschützte Route aus Gmail (nie im Spiegel).

import { googleAnfrage, GoogleApiFehler } from '@/lib/google/http';
import { GMAIL_API, nachrichtHolen } from './abgleich';
import { base64urlBytes, teilFinden } from './mime';
import { aendereGmailStand, ladeGmailStand } from './stand';
import { GMAIL_GRENZEN } from './typen';

export const MARKIER_AKTIONEN = ['gelesen', 'ungelesen', 'archivieren', 'posteingang'] as const;
export type MarkierAktion = typeof MARKIER_AKTIONEN[number];
export const istMarkierAktion = (v: unknown): v is MarkierAktion => (MARKIER_AKTIONEN as readonly string[]).includes(v as string);

export class AktionFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Welche Labels eine Aktion setzt/entfernt. Rein. */
export const AKTION_LABELS: Record<MarkierAktion, { add: string[]; remove: string[] }> = {
  gelesen: { add: [], remove: ['UNREAD'] },
  ungelesen: { add: ['UNREAD'], remove: [] },
  archivieren: { add: [], remove: ['INBOX'] },
  posteingang: { add: ['INBOX'], remove: [] },
};

export const labelsNach = (labels: readonly string[], a: MarkierAktion): string[] => {
  const { add, remove } = AKTION_LABELS[a];
  return [...labels.filter(l => !remove.includes(l)), ...add.filter(l => !labels.includes(l))];
};

/**
 * Eine Mail (bzw. ihren ganzen Thread) markieren. `gelesen`/`archivieren`/`posteingang` gelten für den Thread, `ungelesen` für die
 * Nachricht. Wirft `AktionFehler` (404, wenn die Mail nicht im Spiegel der Person liegt).
 */
export async function gmailMarkieren(person: string, nachrichtId: string, aktion: MarkierAktion): Promise<{ geaendert: number }> {
  const s = await ladeGmailStand(person);
  const k = s?.koepfe[nachrichtId];
  if (!s || !k) throw new AktionFehler('Diese Mail gibt es im Spiegel nicht (mehr).', 404);
  const { add, remove } = AKTION_LABELS[aktion];
  const proThread = aktion !== 'ungelesen';
  const pfad = proThread ? `/threads/${encodeURIComponent(k.threadId)}/modify` : `/messages/${encodeURIComponent(k.id)}/modify`;
  const r = await googleAnfrage(person, 'gmail', `${GMAIL_API}${pfad}`, { method: 'POST', body: { addLabelIds: add, removeLabelIds: remove } });
  if (r.status === 404) throw new AktionFehler('Die Mail gibt es in Gmail nicht mehr.', 404);
  if (r.status !== 200) throw new GoogleApiFehler(`Gmail hat die Änderung nicht angenommen (${r.status}).`, r.status);
  let n = 0;
  await aendereGmailStand(person, cur => {
    const koepfe = { ...cur.koepfe };
    for (const x of Object.values(koepfe)) {
      if (proThread ? x.threadId !== k.threadId : x.id !== k.id) continue;
      const neu = labelsNach(x.labels, aktion);
      if (JSON.stringify(neu) !== JSON.stringify(x.labels)) { koepfe[x.id] = { ...x, labels: neu }; n++; }
    }
    return { ...cur, koepfe };
  });
  return { geaendert: n };
}

export interface AnhangInhalt { name: string; bytes: Buffer }

/** Den Inhalt eines Anhangs aus Gmail holen (Teil-Kennung aus dem Spiegel). Wirft `AktionFehler` (404/413). */
export async function gmailAnhang(person: string, nachrichtId: string, teil: string): Promise<AnhangInhalt> {
  const s = await ladeGmailStand(person);
  const k = s?.koepfe[nachrichtId];
  const meta = k?.anhaenge.find(a => a.teil === teil);
  if (!s || !k || !meta) throw new AktionFehler('Diesen Anhang gibt es nicht.', 404);
  if (meta.groesse > GMAIL_GRENZEN.anhangMax) throw new AktionFehler(`Der Anhang ist größer als ${Math.round(GMAIL_GRENZEN.anhangMax / 1048576)} MB — bitte in Gmail öffnen.`, 413);
  // Die attachmentId ändert sich zwischen Abrufen — immer aus dem frisch geholten Baum nehmen.
  const m = await nachrichtHolen(person, nachrichtId);
  if (!m) throw new AktionFehler('Die Mail gibt es in Gmail nicht mehr.', 404);
  const p = teilFinden(m.payload, teil);
  if (!p) throw new AktionFehler('Diesen Anhang gibt es nicht mehr.', 404);
  if (p.body?.data) return { name: meta.name, bytes: base64urlBytes(p.body.data) };
  if (!p.body?.attachmentId) throw new AktionFehler('Dieser Anhang hat keinen Inhalt.', 404);
  const r = await googleAnfrage<{ data?: string; size?: number }>(person, 'gmail', `${GMAIL_API}/messages/${encodeURIComponent(nachrichtId)}/attachments/${encodeURIComponent(p.body.attachmentId)}`);
  if (r.status === 404) throw new AktionFehler('Diesen Anhang gibt es nicht mehr.', 404);
  if (r.status !== 200 || !r.json.data) throw new GoogleApiFehler(`Anhang nicht lesbar (${r.status}).`, r.status);
  const bytes = base64urlBytes(r.json.data);
  if (bytes.length > GMAIL_GRENZEN.anhangMax) throw new AktionFehler('Der Anhang ist zu groß.', 413);
  return { name: meta.name, bytes };
}
